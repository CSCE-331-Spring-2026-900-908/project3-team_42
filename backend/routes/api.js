const express = require('express');
const router = express.Router();
const db = require('../db/config');
const { GoogleGenAI } = require('@google/genai');

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

// Create an order
router.post('/orders', async (req, res) => {
    const { cashier_id, total_amount, items } = req.body;
    try {
        await db.query('BEGIN');
        
        const orderResult = await db.query(
            'INSERT INTO orders (cashier_id, total_amount) VALUES ($1, $2) RETURNING id',
            [cashier_id, total_amount]
        );
        const orderId = orderResult.rows[0].id;
        
        // items should be an array of: { menu_item_id, quantity, customization, price }
        for (let item of items) {
            await db.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, customization, price_at_time) VALUES ($1, $2, $3, $4, $5)',
                [orderId, item.menu_item_id, item.quantity, item.customization || null, item.price]
            );
        }
        
        await db.query('COMMIT');
        res.status(201).json({ id: orderId, message: 'Order created successfully' });
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
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);

        const hourlySql = `
            SELECT
                EXTRACT(HOUR FROM created_at) AS hr,
                COUNT(*) AS sales_count,
                COALESCE(SUM(total_amount), 0) AS sales_total
            FROM orders
            WHERE created_at >= $1 AND created_at < $2
            GROUP BY hr
            ORDER BY hr
        `;

        const totalsSql = `
            SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(total_amount), 0) AS sales_total
            FROM orders
            WHERE created_at >= $1 AND created_at < $2
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

// Product usage: aggregate units sold per menu item over a date range
router.get('/reports/product-usage', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'Missing from/to (YYYY-MM-DD)' });

        const start = parseISODateParam(from);
        const endExclusive = endExclusiveFromInclusiveDate(to);

        const sql = `
            SELECT
                mi.name AS item_name,
                COALESCE(SUM(oi.quantity), 0) AS used_qty
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.created_at >= $1 AND o.created_at < $2
            GROUP BY mi.id, mi.name
            ORDER BY used_qty DESC, mi.name
        `;

        const rows = await db.query(sql, [start, endExclusive]);
        const points = (rows.rows || []).map((r) => ({
            itemName: r.item_name,
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
                COALESCE(SUM(oi.quantity), 0) AS qty_sold,
                COALESCE(SUM(oi.quantity * oi.price_at_time), 0) AS revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.created_at >= $1 AND o.created_at < $2
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

        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);

        const totalsSql = `
            SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(total_amount), 0) AS sales_total
            FROM orders
            WHERE created_at >= $1 AND created_at < $2
        `;

        const topItemSql = `
            SELECT
                mi.name AS item_name,
                COALESCE(SUM(oi.quantity), 0) AS units
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.created_at >= $1 AND o.created_at < $2
            GROUP BY mi.id, mi.name
            ORDER BY units DESC, mi.name
            LIMIT 1
        `;

        const totalsRows = await db.query(totalsSql, [dayStart, now]);
        const totals = totalsRows.rows[0] || { sales_count: 0, sales_total: 0 };

        const salesCount = Number(totals.sales_count || 0);
        const salesTotal = Number(totals.sales_total || 0);

        const taxAmount = salesTotal * TAX_RATE;
        const totalCash = salesTotal;
        const discounts = 0;
        const voids = 0;
        const serviceCharges = 0;

        const topRows = await db.query(topItemSql, [dayStart, now]);
        const topItem = topRows.rows[0]?.item_name || 'N/A';

        const paymentMethods = [
            { methodName: 'Unspecified', totalAmount: salesTotal },
        ];

        res.json({
            startAt: dayStart.toISOString(),
            endAt: now.toISOString(),
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
