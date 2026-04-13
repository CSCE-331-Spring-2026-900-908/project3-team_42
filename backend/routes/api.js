const express = require('express');
const router = express.Router();
const db = require('../db/config');
const { GoogleGenAI } = require('@google/genai');
const loyalty = require('../loyalty');
const recommendation = require('../recommendation');

const TAX_RATE = 0.0825;

function parseISODateParam(dateStr) {
    // Expects YYYY-MM-DD from the frontend.
    const [y, m, d] = String(dateStr).split('-').map((x) => Number(x));
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

function endExclusiveFromInclusiveDate(dateStr) {
    const start = parseISODateParam(dateStr);
    const endExclusive = new Date(start);
    endExclusive.setDate(endExclusive.getDate() + 1);
    return endExclusive;
}

// Get all menu items
router.get('/menu', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM menu_items WHERE is_available = TRUE');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get inventory
router.get('/inventory', async (req, res) => {
    try {
        // Order by category for better grouping in Manager view
        const result = await db.query('SELECT * FROM inventory ORDER BY category, name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get users/employees
router.get('/employees', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create an order (single connection = one real transaction)
router.post('/orders', async (req, res) => {
    const { cashier_id, total_amount, items, customer_user_id } = req.body;
    const client = await db.connect();
    try {
        let customerId = null;
        if (customer_user_id != null && customer_user_id !== '') {
            const cid = Number(customer_user_id);
            if (!Number.isFinite(cid) || cid <= 0) {
                return res.status(400).json({ error: 'Invalid customer_user_id' });
            }
            const ok = await loyalty.assertCustomer(client, cid);
            if (!ok) {
                return res.status(400).json({ error: 'Not a loyalty customer account' });
            }
            customerId = ok;
        }

        await client.query('BEGIN');

        const orderResult = await client.query(
            "INSERT INTO orders (cashier_id, customer_user_id, total_amount, status) VALUES ($1, $2, $3, 'completed') RETURNING id",
            [cashier_id, customerId, total_amount]
        );
        const orderId = orderResult.rows[0].id;

        for (let item of items || []) {
            await client.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, customization, price_at_time) VALUES ($1, $2, $3, $4, $5)',
                [orderId, item.menu_item_id, item.quantity, item.customization || null, item.price]
            );
        }

        const txIdRes = await client.query(
            'SELECT COALESCE(MAX(TransactionID), 0) + 1 AS next_id FROM "Transaction"'
        );
        const transactionId = txIdRes.rows[0].next_id;

        const txItemIdRes = await client.query(
            'SELECT COALESCE(MAX(TransactionItemID), 0) + 1 AS next_id FROM TransactionItem'
        );
        let nextTransactionItemId = txItemIdRes.rows[0].next_id;

        await client.query(
            'INSERT INTO "Transaction" (TransactionID, TransactionTimestamp, TotalAmount) VALUES ($1, NOW(), $2)',
            [transactionId, total_amount]
        );

        for (let item of items || []) {
            await client.query(
                'INSERT INTO TransactionItem (TransactionItemID, TransactionID, ProductID, Quantity, PriceAtPurchase) VALUES ($1, $2, $3, $4, $5)',
                [nextTransactionItemId, transactionId, item.menu_item_id, item.quantity, item.price]
            );

            await client.query(
                `UPDATE inventory inv
                 SET quantity = GREATEST(0, inv.quantity - $1)
                 WHERE inv.id IN (
                     SELECT pi.InventoryID
                     FROM ProductInventory pi
                     WHERE pi.ProductID = $2
                 )`,
                [item.quantity, item.menu_item_id]
            );

            nextTransactionItemId += 1;
        }

        await client.query(
            `
            UPDATE "Transaction" t
            SET TotalAmount = sub.total_amount
            FROM (
                SELECT SUM(Quantity * PriceAtPurchase) AS total_amount
                FROM TransactionItem
                WHERE TransactionID = $1
                GROUP BY TransactionID
            ) sub
            WHERE t.TransactionID = $1
            `,
            [transactionId]
        );

        await client.query(
            'UPDATE orders SET transaction_id = $1 WHERE id = $2',
            [transactionId, orderId]
        );

        let points = { points_earned: 0, breakdown: null };
        if (customerId) {
            points = await loyalty.awardOrderPoints(client, customerId, orderId, total_amount);
        }

        await client.query('COMMIT');
        res.status(201).json({
            id: orderId,
            message: 'Order created successfully',
            points_earned: points.points_earned,
            points_breakdown: points.breakdown,
        });
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Cancel an order (so manager reports exclude it)
router.post('/orders/:orderId/cancel', async (req, res) => {
    const orderId = Number(req.params.orderId);
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const orderRes = await client.query(
            'SELECT id, status, transaction_id FROM orders WHERE id = $1 FOR UPDATE',
            [orderId]
        );

        if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderRes.rows[0];
        if (order.status === 'cancelled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Order already cancelled' });
        }

        await loyalty.reverseOrderPoints(client, orderId);

        await client.query(
            `
            UPDATE inventory inv
            SET quantity = inv.quantity + used.used_qty
            FROM (
                SELECT pi.InventoryID AS inventory_id, SUM(oi.quantity) AS used_qty
                FROM order_items oi
                JOIN ProductInventory pi ON pi.ProductID = oi.menu_item_id
                WHERE oi.order_id = $1
                GROUP BY pi.InventoryID
            ) used
            WHERE inv.id = used.inventory_id
            `,
            [orderId]
        );

        await client.query(
            "UPDATE orders SET status = 'cancelled' WHERE id = $1",
            [orderId]
        );

        if (order.transaction_id) {
            await client.query(
                'DELETE FROM "Transaction" WHERE TransactionID = $1',
                [order.transaction_id]
            );
        }

        await client.query('COMMIT');
        res.json({ id: orderId, message: 'Order cancelled successfully' });
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/rewards/customers', async (req, res) => {
    try {
        const r = await db.query(
            "SELECT id, name, email, points_balance FROM users WHERE role = 'customer' ORDER BY id"
        );
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/rewards/login', async (req, res) => {
    const uid = Number(req.body?.user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
        return res.status(400).json({ error: 'user_id required' });
    }
    const client = await db.connect();
    try {
        const ok = await loyalty.assertCustomer(client, uid);
        if (!ok) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        await client.query('BEGIN');
        const login = await loyalty.awardDailyLogin(client, uid);
        const b = await client.query('SELECT points_balance FROM users WHERE id = $1', [uid]);
        await client.query('COMMIT');
        res.json({
            user_id: uid,
            login_awarded: login.awarded,
            login_points: login.points,
            award_date_utc: login.award_date_utc,
            points_balance: Number(b.rows[0]?.points_balance ?? 0),
        });
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/rewards/points', async (req, res) => {
    try {
        const uid = Number(req.query.user_id);
        if (!Number.isFinite(uid) || uid <= 0) {
            return res.status(400).json({ error: 'user_id required' });
        }
        const ok = await loyalty.assertCustomer(db, uid);
        if (!ok) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        const b = await db.query('SELECT points_balance, name FROM users WHERE id = $1', [uid]);
        const day = new Date().toISOString().slice(0, 10);
        const got = await db.query(
            'SELECT 1 FROM login_points_daily WHERE user_id = $1 AND award_date = $2::date',
            [uid, day]
        );
        const act = await db.query(
            `SELECT activity_type, points_delta, order_id, created_at
             FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12`,
            [uid]
        );
        res.json({
            points_balance: Number(b.rows[0]?.points_balance ?? 0),
            name: b.rows[0]?.name,
            login_points_today_utc: got.rows.length > 0,
            recent: act.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/recommendation/daily', async (req, res) => {
    try {
        const raw = req.query.user_id;
        const uid = raw != null && raw !== '' ? Number(raw) : null;
        if (raw != null && raw !== '' && (!Number.isFinite(uid) || uid <= 0)) {
            return res.status(400).json({ error: 'Invalid user_id' });
        }
        if (uid != null) {
            const ok = await loyalty.assertCustomer(db, uid);
            if (!ok) {
                return res.status(404).json({ error: 'Customer not found' });
            }
        }
        const out = await recommendation.dailyRecommendation(db, uid);
        res.json(out);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------
// Manager report endpoints
// ----------------------------

// X-Report: hourly sales (mid-day snapshot)
router.get('/reports/x', async (req, res) => {
    try {
        const now = new Date();

        const stateRes = await db.query(
            'SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1'
        );
        const stateRow = stateRes.rows[0];
        const dayStart = stateRow?.business_day_start ? new Date(stateRow.business_day_start) : (() => {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            return d;
        })();

        const hourlySql = `
            SELECT
                EXTRACT(HOUR FROM TransactionTimestamp) AS hr,
                COUNT(*) AS sales_count,
                COALESCE(SUM(TotalAmount), 0) AS sales_total
            FROM "Transaction"
            WHERE TransactionTimestamp >= $1 AND TransactionTimestamp < $2
            GROUP BY hr
            ORDER BY hr
        `;

        const totalsSql = `
            SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(TotalAmount), 0) AS sales_total
            FROM "Transaction"
            WHERE TransactionTimestamp >= $1 AND TransactionTimestamp < $2
        `;

        const hourlyRows = await db.query(hourlySql, [dayStart, now]);
        const totalsRows = await db.query(totalsSql, [dayStart, now]);
        const totals = totalsRows.rows[0] || { sales_count: 0, sales_total: 0 };

        const salesCount = Number(totals.sales_count || 0);
        const salesTotal = Number(totals.sales_total || 0);

        const byHour = new Map((hourlyRows.rows || []).map((r) => [Number(r.hr), r]));

        const hours = [];
        for (let hr = 0; hr < 24; hr++) {
            const row = byHour.get(hr);
            const amount = row ? Number(row.sales_total || 0) : 0;
            hours.push({
                hourBucket: `${String(hr).padStart(2, '0')}:00`,
                salesAmount: amount,
            });
        }

        const summary = `Business Day Start: ${dayStart.toISOString()} | Sales: ${salesCount} | Revenue: $${salesTotal.toFixed(2)} | Returns/Voids/Discards: 0/0/0`;
        const paymentMethodSummary = `Payment Methods: UNKNOWN=${salesCount} (no payment breakdown stored)`;

        res.json({ hours, summary, paymentMethodSummary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Product usage: inventory consumed by sold products over a date range
router.get('/reports/product-usage', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'Missing from/to (YYYY-MM-DD)' });

        const start = parseISODateParam(from);
        const endExclusive = endExclusiveFromInclusiveDate(to);

        const sql = `
            SELECT
                inv.id AS inventory_id,
                inv.name AS inventory_name,
                inv.quantity AS current_qty,
                COALESCE(SUM(CASE WHEN t.TransactionID IS NOT NULL THEN ti.Quantity ELSE 0 END), 0) AS used_qty
            FROM inventory inv
            LEFT JOIN ProductInventory pi ON pi.InventoryID = inv.id
            LEFT JOIN TransactionItem ti ON ti.ProductID = pi.ProductID
            LEFT JOIN "Transaction" t
                ON t.TransactionID = ti.TransactionID
                AND t.TransactionTimestamp >= $1
                AND t.TransactionTimestamp < $2
            GROUP BY inv.id, inv.name, inv.quantity
            ORDER BY used_qty DESC, inv.name
        `;

        const rows = await db.query(sql, [start, endExclusive]);
        const points = (rows.rows || []).map((r) => ({
            itemName: r.inventory_name,
            usedQuantity: Number(r.used_qty || 0),
        }));

        res.json({ points, from, to });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sales by item: units sold and revenue per menu item over a date range
router.get('/reports/sales-by-item', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'Missing from/to (YYYY-MM-DD)' });

        const start = parseISODateParam(from);
        const endExclusive = endExclusiveFromInclusiveDate(to);

        const sql = `
            SELECT
                mi.name AS item_name,
                COALESCE(SUM(ti.Quantity), 0) AS qty_sold,
                COALESCE(SUM(ti.Quantity * ti.PriceAtPurchase), 0) AS revenue
            FROM TransactionItem ti
            JOIN "Transaction" t ON t.TransactionID = ti.TransactionID
            JOIN menu_items mi ON mi.id = ti.ProductID
            WHERE t.TransactionTimestamp >= $1 AND t.TransactionTimestamp < $2
            GROUP BY mi.id, mi.name
            ORDER BY revenue DESC, mi.name
        `;

        const rows = await db.query(sql, [start, endExclusive]);
        const items = (rows.rows || []).map((r) => ({
            itemName: r.item_name,
            quantitySold: Number(r.qty_sold || 0),
            revenue: Number(r.revenue || 0),
        }));

        res.json({ items, from, to });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Z-Report: end-of-day summary + top item
router.post('/reports/z-report', async (req, res) => {
    try {
        const { signature } = req.body || {};
        const employeeSignature = String(signature || '').trim() || 'Manager';

        await db.query('BEGIN');

        const stateRes = await db.query(
            'SELECT business_day_start, last_z_report_date FROM manager_report_state WHERE singleton_id = 1 FOR UPDATE'
        );

        const state = stateRes.rows[0];
        if (!state) {
            await db.query('ROLLBACK');
            return res.status(500).json({ error: 'Z-report state row missing.' });
        }

        const businessStart = new Date(state.business_day_start);
        const lastZDate = state.last_z_report_date ? new Date(state.last_z_report_date) : null;
        const todayStr = new Date().toISOString().slice(0, 10);

        const alreadyGeneratedToday =
            lastZDate && lastZDate.toISOString().slice(0, 10) === todayStr;
        // Failsafe: allow rerunning the Z-report even if it was already generated today,
        // but DO NOT advance/reset the business day start again (prevents breaking report windows).

        const businessEnd = new Date();

        const totalsSql = `
            SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(TotalAmount), 0) AS sales_total
            FROM "Transaction"
            WHERE TransactionTimestamp >= $1 AND TransactionTimestamp < $2
        `;

        const topItemSql = `
            SELECT
                mi.name AS item_name,
                COALESCE(SUM(ti.Quantity), 0) AS units
            FROM TransactionItem ti
            JOIN menu_items mi ON mi.id = ti.ProductID
            JOIN "Transaction" t ON t.TransactionID = ti.TransactionID
            WHERE t.TransactionTimestamp >= $1 AND t.TransactionTimestamp < $2
            GROUP BY mi.id, mi.name
            ORDER BY units DESC, mi.name
            LIMIT 1
        `;

        const totalsRows = await db.query(totalsSql, [businessStart, businessEnd]);
        const totals = totalsRows.rows[0] || { sales_count: 0, sales_total: 0 };

        const salesCount = Number(totals.sales_count || 0);
        const salesTotal = Number(totals.sales_total || 0);

        const taxAmount = salesTotal * TAX_RATE;
        const totalCash = salesTotal;
        const discounts = 0;
        const voids = 0;
        const serviceCharges = 0;

        const topRows = await db.query(topItemSql, [businessStart, businessEnd]);
        const topItem = topRows.rows[0]?.item_name || 'N/A';

        await db.query(
            `
            INSERT INTO manager_z_report_log (
                generated_at,
                business_day_start,
                business_day_end,
                total_sales,
                tax_amount,
                sales_count,
                employee_signature
            ) VALUES (NOW(), $1, $2, $3, $4, $5, $6)
            `,
            [businessStart, businessEnd, salesTotal, taxAmount, salesCount, employeeSignature]
        );

        if (!alreadyGeneratedToday) {
            await db.query(
                `
                UPDATE manager_report_state
                SET business_day_start = $1, last_z_report_date = $2
                WHERE singleton_id = 1
                `,
                [businessEnd, todayStr]
            );
        }

        await db.query('COMMIT');

        const paymentMethods = [{ methodName: 'Unspecified', totalAmount: salesTotal }];

        res.json({
            startAt: businessStart.toISOString(),
            endAt: businessEnd.toISOString(),
            salesTotal,
            taxAmount,
            salesCount,
            totalCash,
            discounts,
            voids,
            serviceCharges,
            topItem,
            employeeSignature,
            paymentMethods,
        });
    } catch (err) {
        try {
            await db.query('ROLLBACK');
        } catch {
            // ignore rollback failures
        }
        res.status(500).json({ error: err.message });
    }
});

// Translate API using Google Translate
router.post('/translate', async (req, res) => {
    try {
        const { text, target } = req.body;
        const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
        
        // Use native fetch to proxy the request
        const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: text, target })
        });
        
        const data = await response.json();
        if (data.error) {
            return res.status(400).json({ error: data.error.message });
        }
        
        // Send back the first translation result
        res.json({ translatedText: data.data.translations[0].translatedText });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Weather API using weather.gov
router.get('/weather', async (req, res) => {
    try {
        const pointsResponse = await fetch('https://api.weather.gov/points/30.6280,-96.3344', {
            headers: { 'User-Agent': '(bubbletea-pos, reveille.bubbletea@gmail.com)' }
        });
        const pointsData = await pointsResponse.json();
        
        if (!pointsData.properties || !pointsData.properties.forecast) {
            return res.status(500).json({ error: 'Failed to retrieve forecast URL' });
        }
        
        const forecastResponse = await fetch(pointsData.properties.forecast, {
            headers: { 'User-Agent': '(bubbletea-pos, reveille.bubbletea@gmail.com)' }
        });
        const forecastData = await forecastResponse.json();
        const currentPeriod = forecastData.properties.periods[0];
        
        res.json({ 
            temperature: currentPeriod.temperature, 
            unit: currentPeriod.temperatureUnit,
            shortForecast: currentPeriod.shortForecast,
            icon: currentPeriod.icon
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chatbot API using Gemini LLM
router.post('/chat', async (req, res) => {
    try {
        const { message, menuContext, language } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const systemPrompt = `You are an incredibly helpful, friendly, and concise bubble tea shop assistant. Keep answers short (1-3 sentences) suited for a POS kiosk. Use this menu as context: ${menuContext}. The customer's interface language is ${language || 'en'}. Answer in that language. Explain what drinks are, or recommend them. Do NOT use markdown headers, just plain text or basic bolding.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\nCustomer: ${message}`,
        });
        
        res.json({ reply: response.text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
