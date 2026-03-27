const express = require('express');
const router = express.Router();
const db = require('../db/config');
const { GoogleGenAI } = require('@google/genai');

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
