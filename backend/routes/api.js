const express = require('express');
const router = express.Router();
const db = require('../db/config');
const { GoogleGenAI } = require('@google/genai');
const { tryGetCustomerIdFromAuthHeader } = require('../lib/customerSession');

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

function normalizeOrderItems(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [];
    return list
        .map((item) => {
            const menuItemId = Number(item?.menu_item_id);
            const quantity = Number(item?.quantity);
            const price = Number(item?.price);
            if (!Number.isFinite(menuItemId) || !Number.isFinite(quantity) || !Number.isFinite(price)) return null;
            if (quantity <= 0 || price < 0) return null;
            return {
                menu_item_id: menuItemId,
                quantity,
                customization: item?.customization || null,
                price,
            };
        })
        .filter(Boolean);
}

// Get all menu items
router.get('/menu', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                id,
                name,
                description,
                category,
                default_price,
                discount_percent,
                ROUND(default_price * (1 - discount_percent / 100.0), 2) AS effective_price,
                image_url,
                is_available,
                created_at
            FROM menu_items
            WHERE is_available = TRUE
            ORDER BY category, name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manager menu catalog (includes unavailable items)
router.get('/menu/all', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                id,
                name,
                description,
                category,
                default_price,
                discount_percent,
                ROUND(default_price * (1 - discount_percent / 100.0), 2) AS effective_price,
                image_url,
                is_available,
                created_at
            FROM menu_items
            ORDER BY category, name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/menu', async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            default_price,
            discount_percent = 0,
            image_url,
            is_available = true,
        } = req.body || {};

        const cleanName = String(name || '').trim();
        if (!cleanName) return res.status(400).json({ error: 'Name is required.' });

        const price = Number(default_price);
        if (!Number.isFinite(price) || price < 0) {
            return res.status(400).json({ error: 'default_price must be a non-negative number.' });
        }

        const discount = Number(discount_percent || 0);
        if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
            return res.status(400).json({ error: 'discount_percent must be between 0 and 100.' });
        }

        const result = await db.query(
            `
            INSERT INTO menu_items
            (name, description, category, default_price, discount_percent, image_url, is_available)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                cleanName,
                description ? String(description) : null,
                category ? String(category) : null,
                price,
                discount,
                image_url ? String(image_url) : null,
                Boolean(is_available),
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/menu/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid menu item id.' });

        const existingRes = await db.query('SELECT * FROM menu_items WHERE id = $1', [id]);
        if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Menu item not found.' });
        const existing = existingRes.rows[0];

        const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
        if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });

        const defaultPriceRaw = req.body?.default_price !== undefined ? req.body.default_price : existing.default_price;
        const defaultPrice = Number(defaultPriceRaw);
        if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
            return res.status(400).json({ error: 'default_price must be a non-negative number.' });
        }

        const discountRaw = req.body?.discount_percent !== undefined ? req.body.discount_percent : existing.discount_percent;
        const discountPercent = Number(discountRaw || 0);
        if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
            return res.status(400).json({ error: 'discount_percent must be between 0 and 100.' });
        }

        const result = await db.query(
            `
            UPDATE menu_items
            SET
                name = $1,
                description = $2,
                category = $3,
                default_price = $4,
                discount_percent = $5,
                image_url = $6,
                is_available = $7
            WHERE id = $8
            RETURNING *
            `,
            [
                name,
                req.body?.description !== undefined ? (req.body.description ? String(req.body.description) : null) : existing.description,
                req.body?.category !== undefined ? (req.body.category ? String(req.body.category) : null) : existing.category,
                defaultPrice,
                discountPercent,
                req.body?.image_url !== undefined ? (req.body.image_url ? String(req.body.image_url) : null) : existing.image_url,
                req.body?.is_available !== undefined ? Boolean(req.body.is_available) : existing.is_available,
                id,
            ]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove a menu item from customer-facing menus (soft delete).
// Keeps historical order/report integrity by preserving the row.
router.delete('/menu/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid menu item id.' });

        const result = await db.query(
            `
            UPDATE menu_items
            SET is_available = FALSE
            WHERE id = $1
            RETURNING id, name, is_available
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found.' });
        }

        res.json({
            message: 'Menu item removed from active menu.',
            item: result.rows[0],
        });
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

// Create an order
router.post('/orders', async (req, res) => {
    const { cashier_id, items, placed_via } = req.body;
    let customerAccountId = null;
    const normalizedItems = normalizeOrderItems(items);
    if (normalizedItems.length === 0) {
        return res.status(400).json({ error: 'Order must include at least one valid item.' });
    }

    // Canonical source of truth for totals: derive from line items server-side.
    const computedTotal = normalizedItems.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
    );

    if (placed_via === 'customer_kiosk') {
        customerAccountId = tryGetCustomerIdFromAuthHeader(req.headers.authorization);
    }

    try {
        await db.query('BEGIN');

        const orderResult = await db.query(
            "INSERT INTO orders (cashier_id, customer_account_id, total_amount, status) VALUES ($1, $2, $3, 'completed') RETURNING id",
            [cashier_id, customerAccountId, computedTotal]
        );
        const orderId = orderResult.rows[0].id;

        for (const item of normalizedItems) {
            await db.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, customization, price_at_time) VALUES ($1, $2, $3, $4, $5)',
                [orderId, item.menu_item_id, item.quantity, item.customization || null, item.price]
            );
        }

        // Project 2-compatible transaction write:
        // 1) Create "Transaction" row
        // 2) Create TransactionItem rows
        // 3) Deduct ingredient inventory using ProductInventory mapping
        const txIdRes = await db.query(
            'SELECT COALESCE(MAX(TransactionID), 0) + 1 AS next_id FROM "Transaction"'
        );
        const transactionId = txIdRes.rows[0].next_id;

        const txItemIdRes = await db.query(
            'SELECT COALESCE(MAX(TransactionItemID), 0) + 1 AS next_id FROM TransactionItem'
        );
        let nextTransactionItemId = txItemIdRes.rows[0].next_id;

        await db.query(
            'INSERT INTO "Transaction" (TransactionID, TransactionTimestamp, TotalAmount) VALUES ($1, NOW(), $2)',
            [transactionId, computedTotal]
        );

        for (const item of normalizedItems) {
            await db.query(
                'INSERT INTO TransactionItem (TransactionItemID, TransactionID, ProductID, Quantity, PriceAtPurchase) VALUES ($1, $2, $3, $4, $5)',
                [nextTransactionItemId, transactionId, item.menu_item_id, item.quantity, item.price]
            );

            // Deduct ingredients: each product consumes linked inventory items by quantity.
            await db.query(
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

        // Ensure TotalAmount matches TransactionItem revenue (avoids float rounding drift).
        await db.query(
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

        await db.query(
            'UPDATE orders SET transaction_id = $1 WHERE id = $2',
            [transactionId, orderId]
        );

        await db.query('COMMIT');
        res.status(201).json({
            id: orderId,
            transaction_id: transactionId,
            total_amount: Number(computedTotal.toFixed(2)),
            message: 'Order created successfully',
        });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Manager order history: live orders + seeded orders from orders/order_items.
router.get('/orders/history', async (req, res) => {
    try {
        const rawLimit = Number(req.query.limit);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;

        const sql = `
            SELECT
                o.id,
                o.created_at,
                o.status,
                o.total_amount,
                o.transaction_id,
                o.cashier_id,
                u.name AS cashier_name,
                c.email AS customer_email,
                COALESCE(SUM(oi.quantity), 0) AS item_count,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'menu_item_id', oi.menu_item_id,
                            'item_name', COALESCE(mi.name, CONCAT('Item #', oi.menu_item_id)),
                            'quantity', oi.quantity,
                            'price_at_time', oi.price_at_time,
                            'customization', oi.customization
                        )
                        ORDER BY oi.id
                    ) FILTER (WHERE oi.id IS NOT NULL),
                    '[]'::json
                ) AS items
            FROM orders o
            LEFT JOIN users u ON u.id = o.cashier_id
            LEFT JOIN customer_accounts c ON c.id = o.customer_account_id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
            GROUP BY o.id, u.name, c.email
            ORDER BY o.created_at DESC, o.id DESC
            LIMIT $1
        `;

        const result = await db.query(sql, [limit]);
        const orders = (result.rows || []).map((row) => ({
            id: row.id,
            created_at: row.created_at,
            status: row.status,
            total_amount: Number(row.total_amount || 0),
            transaction_id: row.transaction_id,
            cashier_id: row.cashier_id,
            cashier_name: row.cashier_name,
            customer_email: row.customer_email,
            item_count: Number(row.item_count || 0),
            items: Array.isArray(row.items) ? row.items : [],
        }));

        res.json({ orders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel an order (so manager reports exclude it)
router.post('/orders/:orderId/cancel', async (req, res) => {
    const orderId = Number(req.params.orderId);
    try {
        await db.query('BEGIN');

        const orderRes = await db.query(
            'SELECT id, status, transaction_id FROM orders WHERE id = $1',
            [orderId]
        );

        if (orderRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderRes.rows[0];
        if (order.status === 'cancelled') {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Order already cancelled' });
        }

        // Reverse inventory deductions using order_items + ProductInventory mapping.
        await db.query(
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

        // Mark the order cancelled for UI/history.
        await db.query(
            "UPDATE orders SET status = 'cancelled' WHERE id = $1",
            [orderId]
        );

        // Remove the corresponding Project 2-style transaction so reports exclude it.
        if (order.transaction_id) {
            await db.query(
                'DELETE FROM "Transaction" WHERE TransactionID = $1',
                [order.transaction_id]
            );
        }

        await db.query('COMMIT');
        res.json({ id: orderId, message: 'Order cancelled successfully' });
    } catch (err) {
        await db.query('ROLLBACK');
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
                COALESCE(mi.name, CONCAT('Item #', ti.ProductID::text)) AS item_name,
                COALESCE(SUM(ti.Quantity), 0) AS qty_sold,
                COALESCE(SUM(ti.Quantity * ti.PriceAtPurchase), 0) AS revenue,
                COALESCE(
                    SUM(ti.Quantity * ti.PriceAtPurchase) / NULLIF(SUM(ti.Quantity), 0),
                    0
                ) AS avg_unit_price
            FROM TransactionItem ti
            JOIN "Transaction" t ON t.TransactionID = ti.TransactionID
            LEFT JOIN menu_items mi ON mi.id = ti.ProductID
            WHERE t.TransactionTimestamp >= $1 AND t.TransactionTimestamp < $2
            GROUP BY ti.ProductID, mi.name
            ORDER BY revenue DESC, mi.name
        `;

        const rows = await db.query(sql, [start, endExclusive]);
        const items = (rows.rows || []).map((r) => ({
            itemName: r.item_name,
            quantitySold: Number(r.qty_sold || 0),
            revenue: Number(r.revenue || 0),
            averageUnitPrice: Number(r.avg_unit_price || 0),
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
