const express = require('express');
const router = express.Router();
const db = require('../db/config');
const { GoogleGenAI } = require('@google/genai');
const { tryGetCustomerIdFromAuthHeader } = require('../lib/customerSession');

const TAX_RATE = 0.0825;
const BOBAS_PER_FREE_REWARD = 5;
const ORDER_NUMBER_DIGITS = '0123456789';
let customerRewardsSchemaReady = false;
let seasonalMenuReady = false;
let seasonalMenuReadyPromise = null;

const SEASONAL_MENU_ITEMS = [
    { name: 'Cherry Blossom Bliss Boba', defaultPrice: 6.25 },
    { name: 'Lavender Honey Cloud Tea', defaultPrice: 6.25 },
    { name: 'Strawberry Sakura Swirl', defaultPrice: 6.25 },
    { name: 'Peach Petal Milk Tea', defaultPrice: 6.25 },
    { name: 'Rose Garden Refresher', defaultPrice: 6.25 },
];

const SPECIALTY_MENU_REPLACEMENTS = [
    {
        oldName: 'Classic Tea',
        name: 'Sparkling Yuzu Jasmine Elixir',
        defaultPrice: 5.75,
        description: 'Premium specialty tea with bright citrus and jasmine notes.',
    },
    {
        oldName: 'Honey Tea',
        name: 'Honey Citrus Zen Brew',
        defaultPrice: 5.95,
        description: 'House specialty tea with floral honey and refreshing citrus.',
    },
];

function calculateRewardPoints(items) {
    return (items || []).reduce((sum, item) => {
        const quantity = Number(item.quantity || 0);
        return sum + quantity;
    }, 0);
}

function roundCurrency(value) {
    return Number(Number(value || 0).toFixed(2));
}

function calculateRewardPricing(items, pointsBalance) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const grossAmount = roundCurrency(
        normalizedItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
    );
    const canRedeemFreeBoba = Number(pointsBalance || 0) >= BOBAS_PER_FREE_REWARD && normalizedItems.length > 0;

    if (!canRedeemFreeBoba) {
        return {
            grossAmount,
            paidAmount: grossAmount,
            rewardDiscountAmount: 0,
            redeemedFreeBobaCount: 0,
            redeemedRewardPoints: 0,
            items: normalizedItems,
        };
    }

    const cheapestIndex = normalizedItems.reduce((bestIndex, item, index) => {
        if (bestIndex === -1) return index;
        return item.price < normalizedItems[bestIndex].price ? index : bestIndex;
    }, -1);

    const rewardDiscountAmount = roundCurrency(normalizedItems[cheapestIndex]?.price || 0);
    const pricedItems = normalizedItems.map((item, index) => {
        if (index !== cheapestIndex) return item;

        const paidLineTotal = roundCurrency(item.quantity * item.price - rewardDiscountAmount);
        return {
            ...item,
            price: item.quantity > 0 ? roundCurrency(paidLineTotal / item.quantity) : 0,
        };
    });

    return {
        grossAmount,
        paidAmount: roundCurrency(Math.max(0, grossAmount - rewardDiscountAmount)),
        rewardDiscountAmount,
        redeemedFreeBobaCount: 1,
        redeemedRewardPoints: BOBAS_PER_FREE_REWARD,
        items: pricedItems,
    };
}

function buildRewardsSummary(pointsBalance) {
    const normalizedBalance = Math.max(0, Number(pointsBalance || 0));
    const freeBobaCount = Math.floor(normalizedBalance / BOBAS_PER_FREE_REWARD);
    const pointsToNextFreeBoba =
        normalizedBalance % BOBAS_PER_FREE_REWARD === 0
            ? BOBAS_PER_FREE_REWARD
            : BOBAS_PER_FREE_REWARD - (normalizedBalance % BOBAS_PER_FREE_REWARD);

    return {
        pointsBalance: normalizedBalance,
        freeBobaCount,
        pointsToNextFreeBoba,
    };
}

function generateOrderNumber(length = 4) {
    let orderNumber = '';
    for (let index = 0; index < length; index += 1) {
        const randomIndex = Math.floor(Math.random() * ORDER_NUMBER_DIGITS.length);
        orderNumber += ORDER_NUMBER_DIGITS[randomIndex];
    }
    return orderNumber;
}

async function ensureCustomerRewardsSchema() {
    if (customerRewardsSchemaReady) return;

    await db.query(`
        CREATE TABLE IF NOT EXISTS customer_accounts (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            picture_url VARCHAR(512),
            points_balance INT NOT NULL DEFAULT 0,
            oauth_provider VARCHAR(50) DEFAULT 'email',
            oauth_subject VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await db.query('ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS points_balance INT NOT NULL DEFAULT 0');
    await db.query('ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS picture_url VARCHAR(512)');
    await db.query("ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50) DEFAULT 'email'");
    await db.query('ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS oauth_subject VARCHAR(255)');
    await db.query("ALTER TABLE customer_accounts ALTER COLUMN oauth_provider SET DEFAULT 'email'");
    await db.query("UPDATE customer_accounts SET oauth_provider = 'email' WHERE oauth_provider IS NULL");
    await db.query("UPDATE customer_accounts SET oauth_subject = LOWER(email) WHERE oauth_subject IS NULL AND email IS NOT NULL");
    await db.query(`
        CREATE TABLE IF NOT EXISTS points_ledger (
            id SERIAL PRIMARY KEY,
            customer_account_id INT REFERENCES customer_accounts(id) ON DELETE CASCADE,
            activity_type VARCHAR(32),
            points_delta INT DEFAULT 0,
            order_id INT REFERENCES orders(id) ON DELETE SET NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await db.query('ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS customer_account_id INT REFERENCES customer_accounts(id) ON DELETE CASCADE');
    await db.query('ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS activity_type VARCHAR(32)');
    await db.query('ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS points_delta INT DEFAULT 0');
    await db.query('ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS order_id INT REFERENCES orders(id) ON DELETE SET NULL');
    await db.query("ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb");
    await db.query('ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await db.query('CREATE INDEX IF NOT EXISTS idx_points_ledger_customer_time ON points_ledger (customer_account_id, created_at DESC)');

    customerRewardsSchemaReady = true;
}

async function ensureSeasonalMenuItems() {
    if (seasonalMenuReady) return;
    if (seasonalMenuReadyPromise) {
        await seasonalMenuReadyPromise;
        return;
    }

    seasonalMenuReadyPromise = (async () => {
        // Keep Specialty category aligned with premium offerings.
        for (const specialty of SPECIALTY_MENU_REPLACEMENTS) {
            await db.query(
                `
                UPDATE menu_items
                SET
                    name = $1,
                    description = $2,
                    category = 'Specialty',
                    default_price = $3,
                    is_available = TRUE
                WHERE LOWER(name) = $4
                `,
                [
                    specialty.name,
                    specialty.description,
                    specialty.defaultPrice,
                    specialty.oldName.toLowerCase(),
                ]
            );
        }

        const specialtyNames = SPECIALTY_MENU_REPLACEMENTS.map((item) => item.name);
        const specialtyExistingRes = await db.query(
            `SELECT id, name
             FROM menu_items
             WHERE LOWER(name) = ANY($1::text[])`,
            [specialtyNames.map((name) => name.toLowerCase())]
        );
        const specialtyByName = new Map(
            specialtyExistingRes.rows.map((row) => [String(row.name || '').toLowerCase(), Number(row.id)])
        );

        for (const specialty of SPECIALTY_MENU_REPLACEMENTS) {
            const normalizedName = specialty.name.toLowerCase();
            if (!specialtyByName.has(normalizedName)) {
                const insertRes = await db.query(
                    `
                    INSERT INTO menu_items
                    (name, description, category, default_price, discount_percent, image_url, is_available)
                    VALUES ($1, $2, 'Specialty', $3, 0, $4, TRUE)
                    RETURNING id
                    `,
                    [specialty.name, specialty.description, specialty.defaultPrice, '/images/placeholder.png']
                );
                specialtyByName.set(normalizedName, Number(insertRes.rows[0].id));
            }
        }

        for (const specialty of SPECIALTY_MENU_REPLACEMENTS) {
            const productId = specialtyByName.get(specialty.name.toLowerCase());
            if (!productId) continue;

            const inventoryIds = [11, 12, 2]; // cup, straw, tea base
            const specialtyName = specialty.name.toLowerCase();
            if (specialtyName.includes('jasmine')) inventoryIds.push(10);
            if (specialtyName.includes('honey')) inventoryIds.push(8);

            for (const inventoryId of [...new Set(inventoryIds)]) {
                await db.query(
                    `
                    INSERT INTO ProductInventory (ProductID, InventoryID)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    `,
                    [productId, inventoryId]
                );
            }
        }

        const seasonalNames = SEASONAL_MENU_ITEMS.map((item) => item.name);
        const existingRes = await db.query(
            `SELECT id, name
             FROM menu_items
             WHERE LOWER(name) = ANY($1::text[])`,
            [seasonalNames.map((name) => name.toLowerCase())]
        );

        const idByName = new Map(
            existingRes.rows.map((row) => [String(row.name || '').toLowerCase(), Number(row.id)])
        );

        for (const seasonalItem of SEASONAL_MENU_ITEMS) {
            const normalizedName = seasonalItem.name.toLowerCase();
            if (!idByName.has(normalizedName)) {
                const insertRes = await db.query(
                    `
                    INSERT INTO menu_items
                    (name, description, category, default_price, discount_percent, image_url, is_available)
                    VALUES ($1, $2, $3, $4, 0, $5, TRUE)
                    RETURNING id
                    `,
                    [
                        seasonalItem.name,
                        `Limited-time seasonal drink: ${seasonalItem.name}`,
                        'Seasonal',
                        seasonalItem.defaultPrice,
                        '/images/placeholder.png',
                    ]
                );
                idByName.set(normalizedName, Number(insertRes.rows[0].id));
            }
        }

        for (const seasonalItem of SEASONAL_MENU_ITEMS) {
            const productId = idByName.get(seasonalItem.name.toLowerCase());
            if (!productId) continue;

            const inventoryIds = [11, 12, 2]; // cup, straw, tea base
            const itemName = seasonalItem.name.toLowerCase();
            if (itemName.includes('milk') || itemName.includes('cloud')) inventoryIds.push(4);
            if (itemName.includes('honey')) inventoryIds.push(8);
            if (
                itemName.includes('cherry')
                || itemName.includes('strawberry')
                || itemName.includes('peach')
                || itemName.includes('rose')
            ) {
                inventoryIds.push(9);
            }

            for (const inventoryId of [...new Set(inventoryIds)]) {
                await db.query(
                    `
                    INSERT INTO ProductInventory (ProductID, InventoryID)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    `,
                    [productId, inventoryId]
                );
            }
        }

        seasonalMenuReady = true;
    })();

    try {
        await seasonalMenuReadyPromise;
    } finally {
        seasonalMenuReadyPromise = null;
    }
}

async function requireManager(req, res) {
    const managerEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase();
    if (!managerEmail) {
        res.status(401).json({ error: 'Manager identity is required.' });
        return null;
    }
    const result = await db.query(
        `SELECT id, email, role, is_active
         FROM users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [managerEmail]
    );
    const row = result.rows[0];
    const allowedRoles = new Set(['manager', 'admin', 'supervisor']);
    if (!row || !allowedRoles.has(String(row.role || '').toLowerCase()) || row.is_active !== true) {
        res.status(403).json({ error: 'Manager-level access required.' });
        return null;
    }
    return row;
}

function addDays(dateObj, days) {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
}

async function writeAudit(actorEmail, actionType, entityType, entityId, details = {}) {
    await db.query(
        `INSERT INTO audit_log (actor_email, action_type, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [actorEmail || null, actionType, entityType, entityId != null ? String(entityId) : null, JSON.stringify(details || {})]
    );
}

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

async function findOrCreateEmailCustomerAccount(email, name) {
    const existingResult = await db.query(
        `SELECT id, points_balance
         FROM customer_accounts
         WHERE LOWER(email) = $1
         ORDER BY id
         LIMIT 1`,
        [email]
    );

    const existingCustomer = existingResult.rows[0];
    if (existingCustomer) {
        const updatedResult = await db.query(
            `UPDATE customer_accounts
             SET name = COALESCE(NULLIF($2, ''), name),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, points_balance`,
            [existingCustomer.id, name]
        );
        return updatedResult.rows[0] || existingCustomer;
    }

    const insertedResult = await db.query(
        `INSERT INTO customer_accounts (email, name, oauth_provider, oauth_subject)
         VALUES ($1, $2, 'email', $1)
         RETURNING id, points_balance`,
        [email, name]
    );
    return insertedResult.rows[0];
}

// Get all menu items
router.get('/menu', async (req, res) => {
    try {
        await ensureSeasonalMenuItems();
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
        await ensureSeasonalMenuItems();
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
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
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

        await writeAudit(actorEmail, 'menu.create', 'menu_item', result.rows[0].id, { name: cleanName });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/menu/:id', async (req, res) => {
    try {
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
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

        await writeAudit(actorEmail, 'menu.update', 'menu_item', id, { name });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove a menu item from customer-facing menus (soft delete).
// Keeps historical order/report integrity by preserving the row.
router.delete('/menu/:id', async (req, res) => {
    try {
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
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
        await writeAudit(actorEmail, 'menu.remove', 'menu_item', id, {});
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
        const includeInactive = String(req.query.include_inactive || '') === '1';
        const result = await db.query(
            `
            SELECT
                id, name, role, email, is_active, hired_at, terminated_at, created_at
            FROM users
            WHERE role <> 'customer'
              AND ($1::boolean = TRUE OR is_active = TRUE)
            ORDER BY is_active DESC, role, name
            `,
            [includeInactive]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/employees', async (req, res) => {
    try {
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
        const { name, role, email } = req.body || {};
        const cleanName = String(name || '').trim();
        const cleanRole = String(role || '').trim().toLowerCase();
        const cleanEmail = String(email || '').trim().toLowerCase();

        if (!cleanName) return res.status(400).json({ error: 'Employee name is required.' });
        if (!cleanRole) return res.status(400).json({ error: 'Employee role is required.' });
        if (cleanRole === 'customer') return res.status(400).json({ error: 'Role cannot be customer for employee records.' });
        if (!cleanEmail) return res.status(400).json({ error: 'Employee email is required.' });

        const result = await db.query(
            `
            INSERT INTO users (name, role, email, is_active, hired_at, terminated_at)
            VALUES ($1, $2, $3, TRUE, NOW(), NULL)
            RETURNING id, name, role, email, is_active, hired_at, terminated_at, created_at
            `,
            [cleanName, cleanRole, cleanEmail]
        );
        await writeAudit(actorEmail, 'employee.create', 'employee', result.rows[0].id, { role: cleanRole });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (String(err.message || '').includes('duplicate key')) {
            return res.status(409).json({ error: 'An employee with this email already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.patch('/employees/:id/deactivate', async (req, res) => {
    try {
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid employee id.' });
        const result = await db.query(
            `
            UPDATE users
            SET is_active = FALSE, terminated_at = NOW()
            WHERE id = $1
            RETURNING id, name, role, email, is_active, hired_at, terminated_at
            `,
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        await writeAudit(actorEmail, 'employee.deactivate', 'employee', id, {});
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/employees/:id/reactivate', async (req, res) => {
    try {
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid employee id.' });
        const result = await db.query(
            `
            UPDATE users
            SET is_active = TRUE, terminated_at = NULL
            WHERE id = $1
            RETURNING id, name, role, email, is_active, hired_at, terminated_at
            `,
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        await writeAudit(actorEmail, 'employee.reactivate', 'employee', id, {});
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/shifts', async (req, res) => {
    try {
        const { from, to } = req.query;
        let sql = `
            SELECT
                s.id,
                s.user_id,
                u.name AS employee_name,
                u.role AS employee_role,
                u.is_active,
                s.shift_date,
                s.start_time,
                s.end_time,
                s.role,
                s.notes
            FROM employee_shifts s
            JOIN users u ON u.id = s.user_id
            WHERE 1=1
        `;
        const params = [];
        if (from) {
            params.push(from);
            sql += ` AND s.shift_date >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            sql += ` AND s.shift_date <= $${params.length}`;
        }
        sql += ' ORDER BY s.shift_date, s.start_time, u.name';

        const result = await db.query(sql, params);
        res.json({ shifts: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/shifts', async (req, res) => {
    try {
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
        const { user_id, shift_date, start_time, end_time, role, notes } = req.body || {};
        const userId = Number(user_id);
        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Valid user_id is required.' });
        if (!shift_date || !start_time || !end_time) {
            return res.status(400).json({ error: 'shift_date, start_time, and end_time are required.' });
        }

        const overlap = await db.query(
            `
            SELECT id
            FROM employee_shifts
            WHERE user_id = $1
              AND shift_date = $2
              AND NOT ($4::time <= start_time OR $3::time >= end_time)
            LIMIT 1
            `,
            [userId, shift_date, start_time, end_time]
        );
        if (overlap.rows.length > 0) {
            return res.status(409).json({ error: 'Shift overlaps an existing shift for this employee.' });
        }

        const result = await db.query(
            `
            INSERT INTO employee_shifts (user_id, shift_date, start_time, end_time, role, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [userId, shift_date, start_time, end_time, role ? String(role) : null, notes ? String(notes) : null]
        );
        await writeAudit(actorEmail, 'shift.create', 'shift', result.rows[0].id, { userId, shift_date });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/shifts/:id', async (req, res) => {
    try {
        const actorEmail = String(req.headers['x-manager-email'] || '').trim().toLowerCase() || null;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid shift id.' });
        const result = await db.query('DELETE FROM employee_shifts WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Shift not found.' });
        await writeAudit(actorEmail, 'shift.delete', 'shift', id, {});
        res.json({ message: 'Shift removed.', id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create an order
router.post('/orders', async (req, res) => {
    const { cashier_id, items, placed_via, payment_method, customer_name, customer_email } = req.body;
    let customerAccountId = null;
    let rewardsBalance = null;
    const inferredMethod = placed_via === 'customer_kiosk' ? 'card' : 'cash';
    const paymentMethod = String(payment_method || inferredMethod || 'unspecified').trim().toLowerCase();
    const normalizedCustomerName = String(customer_name || '').trim();
    const normalizedCustomerEmail = String(customer_email || '').trim().toLowerCase();
    const normalizedItems = normalizeOrderItems(items);
    if (normalizedItems.length === 0) {
        return res.status(400).json({ error: 'Order must include at least one valid item.' });
    }

    // Canonical source of truth for totals: derive from line items server-side.
    let rewardPricing = calculateRewardPricing(normalizedItems, 0);

    try {
        if (placed_via === 'customer_kiosk' && normalizedCustomerName && normalizedCustomerEmail) {
            await ensureCustomerRewardsSchema();
        }

        await db.query('BEGIN');

        if (placed_via === 'customer_kiosk' && normalizedCustomerName && normalizedCustomerEmail) {
            const customer = await findOrCreateEmailCustomerAccount(normalizedCustomerEmail, normalizedCustomerName);
            customerAccountId = customer?.id ?? null;
            rewardsBalance = customer?.points_balance ?? null;
        }

        rewardPricing = calculateRewardPricing(normalizedItems, customerAccountId ? rewardsBalance : 0);
        const computedTotal = rewardPricing.paidAmount;
        const pointsEarned = customerAccountId
            ? Math.max(0, calculateRewardPoints(normalizedItems) - rewardPricing.redeemedFreeBobaCount)
            : 0;
        const orderResult = await db.query(
            "INSERT INTO orders (cashier_id, customer_account_id, total_amount, status, points_earned) VALUES ($1, $2, $3, 'completed', $4) RETURNING id",
            [cashier_id, customerAccountId, computedTotal, pointsEarned]
        );
        const orderId = orderResult.rows[0].id;

        for (const item of rewardPricing.items) {
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
        await db.query(
            'INSERT INTO transaction_payments (transaction_id, payment_method, amount) VALUES ($1, $2, $3)',
            [transactionId, paymentMethod || 'unspecified', computedTotal]
        );

        for (const item of rewardPricing.items) {
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

        if (customerAccountId && rewardPricing.redeemedRewardPoints > 0) {
            await db.query(
                `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    customerAccountId,
                    'reward_redemption',
                    -rewardPricing.redeemedRewardPoints,
                    orderId,
                    JSON.stringify({
                        placed_via: placed_via || 'unknown',
                        free_boba_count: rewardPricing.redeemedFreeBobaCount,
                        discount_amount: rewardPricing.rewardDiscountAmount,
                    }),
                ]
            );
        }

        if (customerAccountId && pointsEarned > 0) {
            await db.query(
                `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    customerAccountId,
                    'order',
                    pointsEarned,
                    orderId,
                    JSON.stringify({ placed_via: placed_via || 'unknown' }),
                ]
            );

        }

        const netRewardPointsDelta = pointsEarned - rewardPricing.redeemedRewardPoints;
        if (customerAccountId && netRewardPointsDelta !== 0) {
            const rewardsResult = await db.query(
                `UPDATE customer_accounts
                 SET points_balance = GREATEST(0, points_balance + $1),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING points_balance`,
                [netRewardPointsDelta, customerAccountId]
            );
            rewardsBalance = rewardsResult.rows[0]?.points_balance ?? null;
        }

        const rewardsSummary = buildRewardsSummary(rewardsBalance || 0);

        await db.query('COMMIT');
        res.status(201).json({
            id: orderId,
            orderNumber: generateOrderNumber(),
            transaction_id: transactionId,
            total_amount: Number(computedTotal.toFixed(2)),
            gross_amount: rewardPricing.grossAmount,
            rewardDiscountAmount: rewardPricing.rewardDiscountAmount,
            redeemedRewardPoints: rewardPricing.redeemedRewardPoints,
            redeemedFreeBobaCount: rewardPricing.redeemedFreeBobaCount,
            pointsEarned,
            rewardsBalance: rewardsSummary.pointsBalance,
            freeBobaCount: rewardsSummary.freeBobaCount,
            pointsToNextFreeBoba: rewardsSummary.pointsToNextFreeBoba,
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
            'SELECT id, status, transaction_id, customer_account_id, points_earned FROM orders WHERE id = $1',
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

        if (order.customer_account_id && Number(order.points_earned || 0) > 0) {
            const reversalPoints = Number(order.points_earned);
            await db.query(
                `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    order.customer_account_id,
                    'order_reversal',
                    -reversalPoints,
                    orderId,
                    JSON.stringify({ reason: 'order_cancelled' }),
                ]
            );

            await db.query(
                `UPDATE customer_accounts
                 SET points_balance = GREATEST(0, points_balance - $1),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [reversalPoints, order.customer_account_id]
            );
        }

        await db.query('COMMIT');
        res.json({ id: orderId, message: 'Order cancelled successfully' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.get('/rewards/me', async (req, res) => {
    const customerAccountId = tryGetCustomerIdFromAuthHeader(req.headers.authorization);
    if (!customerAccountId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const result = await db.query(
            'SELECT id, name, email, points_balance FROM customer_accounts WHERE id = $1',
            [customerAccountId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer account not found' });
        }

        const customer = result.rows[0];
        const rewardsSummary = buildRewardsSummary(customer.points_balance);
        res.json({
            customer: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
            },
            pointsBalance: rewardsSummary.pointsBalance,
            freeBobaCount: rewardsSummary.freeBobaCount,
            pointsToNextFreeBoba: rewardsSummary.pointsToNextFreeBoba,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------
// Operations: inventory, suppliers, purchase orders
// ----------------------------

router.get('/inventory/alerts', async (req, res) => {
    try {
        const rows = await db.query(
            `
            SELECT
                id,
                name,
                category,
                quantity,
                restock_threshold,
                CASE
                    WHEN quantity <= restock_threshold THEN 'now'
                    WHEN quantity <= restock_threshold * 1.25 THEN 'soon'
                    ELSE 'ok'
                END AS alert_level,
                GREATEST(0, restock_threshold - quantity) AS needed_to_threshold
            FROM inventory
            ORDER BY
                CASE
                    WHEN quantity <= restock_threshold THEN 0
                    WHEN quantity <= restock_threshold * 1.25 THEN 1
                    ELSE 2
                END,
                name
            `
        );
        const now = rows.rows.filter((r) => r.alert_level === 'now');
        const soon = rows.rows.filter((r) => r.alert_level === 'soon');
        res.json({ now, soon, all: rows.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/inventory/adjustments', async (req, res) => {
    try {
        const result = await db.query(
            `
            SELECT
                ia.id,
                ia.inventory_id,
                inv.name AS inventory_name,
                ia.previous_quantity,
                ia.delta_quantity,
                ia.new_quantity,
                ia.reason,
                ia.notes,
                ia.adjusted_by,
                ia.created_at
            FROM inventory_adjustments ia
            JOIN inventory inv ON inv.id = ia.inventory_id
            ORDER BY ia.created_at DESC, ia.id DESC
            LIMIT 250
            `
        );
        res.json({ adjustments: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/inventory/adjustments', async (req, res) => {
    try {
        const manager = await requireManager(req, res);
        if (!manager) return;
        const { inventory_id, delta_quantity, reason, notes } = req.body || {};
        const inventoryId = Number(inventory_id);
        const delta = Number(delta_quantity);
        if (!Number.isFinite(inventoryId) || !Number.isFinite(delta)) {
            return res.status(400).json({ error: 'inventory_id and delta_quantity are required numbers.' });
        }
        const cleanReason = String(reason || '').trim() || 'correction';

        await db.query('BEGIN');
        const invRes = await db.query('SELECT id, quantity FROM inventory WHERE id = $1 FOR UPDATE', [inventoryId]);
        if (invRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Inventory item not found.' });
        }
        const previousQty = Number(invRes.rows[0].quantity || 0);
        const newQty = Math.max(0, previousQty + delta);

        await db.query('UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newQty, inventoryId]);
        const logRes = await db.query(
            `
            INSERT INTO inventory_adjustments
            (inventory_id, previous_quantity, delta_quantity, new_quantity, reason, notes, adjusted_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [inventoryId, previousQty, delta, newQty, cleanReason, notes ? String(notes) : null, manager.email]
        );
        await writeAudit(manager.email, 'inventory.adjust', 'inventory', inventoryId, { previousQty, delta, newQty, reason: cleanReason });
        await db.query('COMMIT');
        res.status(201).json(logRes.rows[0]);
    } catch (err) {
        try { await db.query('ROLLBACK'); } catch {}
        res.status(500).json({ error: err.message });
    }
});

router.get('/suppliers', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM suppliers ORDER BY is_active DESC, name');
        res.json({ suppliers: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/suppliers', async (req, res) => {
    try {
        const manager = await requireManager(req, res);
        if (!manager) return;
        const { name, contact_name, contact_email, contact_phone } = req.body || {};
        const cleanName = String(name || '').trim();
        if (!cleanName) return res.status(400).json({ error: 'Supplier name is required.' });
        const result = await db.query(
            `
            INSERT INTO suppliers (name, contact_name, contact_email, contact_phone, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            RETURNING *
            `,
            [
                cleanName,
                contact_name ? String(contact_name) : null,
                contact_email ? String(contact_email) : null,
                contact_phone ? String(contact_phone) : null,
            ]
        );
        await writeAudit(manager.email, 'supplier.create', 'supplier', result.rows[0].id, { name: cleanName });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (String(err.message || '').includes('duplicate key')) {
            return res.status(409).json({ error: 'Supplier name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.get('/purchase-orders', async (req, res) => {
    try {
        const result = await db.query(
            `
            SELECT
                po.id,
                po.status,
                po.expected_date,
                po.notes,
                po.created_by,
                po.created_at,
                po.received_at,
                po.supplier_id,
                s.name AS supplier_name,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', poi.id,
                            'inventory_id', poi.inventory_id,
                            'inventory_name', inv.name,
                            'quantity', poi.quantity
                        )
                        ORDER BY poi.id
                    ) FILTER (WHERE poi.id IS NOT NULL),
                    '[]'::json
                ) AS items
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
            LEFT JOIN inventory inv ON inv.id = poi.inventory_id
            GROUP BY po.id, s.name
            ORDER BY po.created_at DESC, po.id DESC
            LIMIT 200
            `
        );
        res.json({ purchaseOrders: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/purchase-orders', async (req, res) => {
    try {
        const manager = await requireManager(req, res);
        if (!manager) return;
        const { supplier_id, expected_date, notes, items } = req.body || {};
        const supplierId = Number(supplier_id);
        const cleanItems = Array.isArray(items) ? items : [];
        if (!Number.isFinite(supplierId)) return res.status(400).json({ error: 'supplier_id is required.' });
        if (cleanItems.length === 0) return res.status(400).json({ error: 'At least one purchase-order item is required.' });

        await db.query('BEGIN');
        const poRes = await db.query(
            `
            INSERT INTO purchase_orders (supplier_id, status, expected_date, notes, created_by)
            VALUES ($1, 'ordered', $2, $3, $4)
            RETURNING *
            `,
            [supplierId, expected_date || null, notes ? String(notes) : null, manager.email]
        );
        const po = poRes.rows[0];
        for (const raw of cleanItems) {
            const inventoryId = Number(raw?.inventory_id);
            const qty = Number(raw?.quantity);
            if (!Number.isFinite(inventoryId) || !Number.isFinite(qty) || qty <= 0) continue;
            await db.query(
                'INSERT INTO purchase_order_items (purchase_order_id, inventory_id, quantity) VALUES ($1, $2, $3)',
                [po.id, inventoryId, qty]
            );
        }
        await writeAudit(manager.email, 'purchase_order.create', 'purchase_order', po.id, { supplierId });
        await db.query('COMMIT');
        res.status(201).json(po);
    } catch (err) {
        try { await db.query('ROLLBACK'); } catch {}
        res.status(500).json({ error: err.message });
    }
});

router.post('/purchase-orders/:id/receive', async (req, res) => {
    try {
        const manager = await requireManager(req, res);
        if (!manager) return;
        const poId = Number(req.params.id);
        if (!Number.isFinite(poId)) return res.status(400).json({ error: 'Invalid purchase order id.' });

        await db.query('BEGIN');
        const poRes = await db.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [poId]);
        if (poRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Purchase order not found.' });
        }
        const po = poRes.rows[0];
        if (po.status === 'received') {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Purchase order already received.' });
        }
        const itemsRes = await db.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [poId]);
        for (const item of itemsRes.rows) {
            const invRes = await db.query('SELECT id, quantity FROM inventory WHERE id = $1 FOR UPDATE', [item.inventory_id]);
            if (invRes.rows.length === 0) continue;
            const previousQty = Number(invRes.rows[0].quantity || 0);
            const delta = Number(item.quantity || 0);
            const newQty = previousQty + delta;
            await db.query('UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newQty, item.inventory_id]);
            await db.query(
                `
                INSERT INTO inventory_adjustments
                (inventory_id, previous_quantity, delta_quantity, new_quantity, reason, notes, adjusted_by)
                VALUES ($1, $2, $3, $4, 'supplier_receive', $5, $6)
                `,
                [item.inventory_id, previousQty, delta, newQty, `PO #${poId} received`, manager.email]
            );
        }
        await db.query(
            `UPDATE purchase_orders
             SET status = 'received', received_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [poId]
        );
        await writeAudit(manager.email, 'purchase_order.receive', 'purchase_order', poId, {});
        await db.query('COMMIT');
        res.json({ id: poId, message: 'Purchase order received and inventory updated.' });
    } catch (err) {
        try { await db.query('ROLLBACK'); } catch {}
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------
// Insights / audit / export
// ----------------------------

router.get('/insights/peak-hours', async (req, res) => {
    try {
        const days = Number(req.query.days);
        const lookbackDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 120) : 30;
        const sql = `
            SELECT
                EXTRACT(DOW FROM TransactionTimestamp) AS day_of_week,
                EXTRACT(HOUR FROM TransactionTimestamp) AS hour_of_day,
                COUNT(*) AS tx_count,
                COALESCE(SUM(TotalAmount), 0) AS revenue
            FROM "Transaction"
            WHERE TransactionTimestamp >= NOW() - ($1::text || ' days')::interval
            GROUP BY day_of_week, hour_of_day
            ORDER BY tx_count DESC, revenue DESC
        `;
        const result = await db.query(sql, [lookbackDays]);
        const points = (result.rows || []).map((r) => ({
            dayOfWeek: Number(r.day_of_week),
            hourOfDay: Number(r.hour_of_day),
            txCount: Number(r.tx_count || 0),
            revenue: Number(r.revenue || 0),
        }));
        const top = points.slice(0, 5);
        const suggestion = top.length > 0
            ? `Peak period is around day ${top[0].dayOfWeek} hour ${String(top[0].hourOfDay).padStart(2, '0')}:00. Consider one extra cashier during top 2 windows.`
            : 'Not enough data yet for staffing suggestions.';
        res.json({ lookbackDays, points, top, suggestion });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/insights/inventory-forecast', async (req, res) => {
    try {
        const days = Number(req.query.days);
        const lookbackDays = Number.isFinite(days) ? Math.min(Math.max(days, 3), 120) : 30;
        const sql = `
            WITH usage AS (
                SELECT
                    pi.inventoryid AS inventory_id,
                    COALESCE(SUM(ti.quantity), 0)::numeric AS total_used_units
                FROM productinventory pi
                LEFT JOIN transactionitem ti ON ti.productid = pi.productid
                LEFT JOIN "Transaction" t
                    ON t.transactionid = ti.transactionid
                   AND t.transactiontimestamp >= NOW() - ($1::text || ' days')::interval
                GROUP BY pi.inventoryid
            )
            SELECT
                inv.id,
                inv.name,
                inv.category,
                inv.quantity,
                inv.restock_threshold,
                COALESCE(u.total_used_units, 0) AS total_used_units
            FROM inventory inv
            LEFT JOIN usage u ON u.inventory_id = inv.id
            ORDER BY inv.name
        `;
        const result = await db.query(sql, [lookbackDays]);
        const points = (result.rows || []).map((r) => {
            const qty = Number(r.quantity || 0);
            const threshold = Number(r.restock_threshold || 0);
            const totalUsed = Number(r.total_used_units || 0);
            const avgDailyUse = totalUsed / lookbackDays;
            const daysUntilRestock = avgDailyUse > 0 ? Math.max(0, (qty - threshold) / avgDailyUse) : null;
            const suggestedReorderQty = Math.max(0, threshold * 2 - qty);
            return {
                inventoryId: r.id,
                inventoryName: r.name,
                category: r.category,
                quantity: qty,
                restockThreshold: threshold,
                totalUsedUnits: Number(totalUsed.toFixed(2)),
                avgDailyUse: Number(avgDailyUse.toFixed(2)),
                daysUntilRestock: daysUntilRestock == null ? null : Number(daysUntilRestock.toFixed(1)),
                suggestedReorderQty: Number(suggestedReorderQty.toFixed(2)),
            };
        });
        const atRisk = points
            .filter((p) => p.daysUntilRestock != null && p.daysUntilRestock <= 14)
            .sort((a, b) => Number(a.daysUntilRestock || 9999) - Number(b.daysUntilRestock || 9999))
            .slice(0, 12);
        res.json({ lookbackDays, points, atRisk });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/audit-log', async (req, res) => {
    try {
        const result = await db.query(
            `
            SELECT id, actor_email, action_type, entity_type, entity_id, details, created_at
            FROM audit_log
            ORDER BY created_at DESC, id DESC
            LIMIT 500
            `
        );
        res.json({ logs: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export/:kind', async (req, res) => {
    try {
        const kind = String(req.params.kind || '').toLowerCase();
        let rows = [];
        if (kind === 'sales') {
            const result = await db.query(
                `
                SELECT
                    t.transactionid,
                    t.transactiontimestamp,
                    t.totalamount,
                    COALESCE(tp.payment_method, 'unspecified') AS payment_method
                FROM "Transaction" t
                LEFT JOIN transaction_payments tp ON tp.transaction_id = t.transactionid
                ORDER BY t.transactiontimestamp DESC, t.transactionid DESC
                LIMIT 2000
                `
            );
            rows = result.rows;
        } else if (kind === 'inventory') {
            const result = await db.query(
                'SELECT id, name, category, quantity, unit, restock_threshold, updated_at FROM inventory ORDER BY category, name'
            );
            rows = result.rows;
        } else if (kind === 'labor') {
            const result = await db.query(
                `
                SELECT
                    s.id,
                    s.shift_date,
                    s.start_time,
                    s.end_time,
                    COALESCE(s.role, u.role) AS role_name,
                    u.name AS employee_name
                FROM employee_shifts s
                JOIN users u ON u.id = s.user_id
                ORDER BY s.shift_date DESC, s.start_time DESC
                LIMIT 2000
                `
            );
            rows = result.rows;
        } else {
            return res.status(400).json({ error: 'Unsupported export kind. Use sales, inventory, or labor.' });
        }
        if (!rows.length) {
            res.setHeader('Content-Type', 'text/csv');
            return res.send('No data\n');
        }
        const headers = Object.keys(rows[0]);
        const escapeCell = (v) => {
            if (v === null || v === undefined) return '';
            const s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const csv = [headers.join(',')]
            .concat(rows.map((r) => headers.map((h) => escapeCell(r[h])).join(',')))
            .join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${kind}-export.csv"`);
        res.send(`${csv}\n`);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export-schedules', async (req, res) => {
    try {
        const rows = await db.query(
            `
            SELECT id, name, export_kind, cadence_days, is_active, last_run_at, next_run_at, created_by, created_at
            FROM export_schedules
            ORDER BY is_active DESC, next_run_at ASC, id DESC
            `
        );
        res.json({ schedules: rows.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/export-schedules', async (req, res) => {
    try {
        const manager = await requireManager(req, res);
        if (!manager) return;
        const { name, export_kind, cadence_days } = req.body || {};
        const cleanName = String(name || '').trim();
        const kind = String(export_kind || '').trim().toLowerCase();
        const cadenceDays = Number(cadence_days);
        const allowedKinds = new Set(['sales', 'inventory', 'labor']);
        if (!cleanName) return res.status(400).json({ error: 'name is required.' });
        if (!allowedKinds.has(kind)) return res.status(400).json({ error: 'export_kind must be sales, inventory, or labor.' });
        if (!Number.isFinite(cadenceDays) || cadenceDays <= 0) return res.status(400).json({ error: 'cadence_days must be a positive integer.' });
        const now = new Date();
        const nextRunAt = addDays(now, cadenceDays);
        const created = await db.query(
            `
            INSERT INTO export_schedules (name, export_kind, cadence_days, is_active, next_run_at, created_by)
            VALUES ($1, $2, $3, TRUE, $4, $5)
            RETURNING *
            `,
            [cleanName, kind, Math.floor(cadenceDays), nextRunAt, manager.email]
        );
        await writeAudit(manager.email, 'export_schedule.create', 'export_schedule', created.rows[0].id, { name: cleanName, kind, cadenceDays });
        res.status(201).json(created.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/export-schedules/:id/run', async (req, res) => {
    try {
        const manager = await requireManager(req, res);
        if (!manager) return;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid schedule id.' });
        const scheduleRes = await db.query('SELECT * FROM export_schedules WHERE id = $1', [id]);
        if (!scheduleRes.rows.length) return res.status(404).json({ error: 'Export schedule not found.' });
        const schedule = scheduleRes.rows[0];
        if (!schedule.is_active) return res.status(400).json({ error: 'Cannot run inactive schedule.' });

        let countRes;
        if (schedule.export_kind === 'sales') {
            countRes = await db.query('SELECT COUNT(*)::int AS c FROM "Transaction"');
        } else if (schedule.export_kind === 'inventory') {
            countRes = await db.query('SELECT COUNT(*)::int AS c FROM inventory');
        } else {
            countRes = await db.query('SELECT COUNT(*)::int AS c FROM employee_shifts');
        }

        const now = new Date();
        const nextRunAt = addDays(now, Number(schedule.cadence_days || 1));
        await db.query(
            'UPDATE export_schedules SET last_run_at = $1, next_run_at = $2 WHERE id = $3',
            [now, nextRunAt, id]
        );
        await writeAudit(manager.email, 'export_schedule.run', 'export_schedule', id, { exportKind: schedule.export_kind, rowCount: countRes.rows[0].c });
        res.json({
            id,
            exportKind: schedule.export_kind,
            rowCount: Number(countRes.rows[0].c || 0),
            runAt: now,
            nextRunAt,
        });
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
        const stateRes = await db.query(
            'SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1'
        );
        const stateRow = stateRes.rows[0];
        const dayStart = stateRow?.business_day_start || null;

        const hourlySql = `
            SELECT
                EXTRACT(HOUR FROM TransactionTimestamp) AS hr,
                COUNT(*) AS sales_count,
                COALESCE(SUM(TotalAmount), 0) AS sales_total
            FROM "Transaction"
            WHERE TransactionTimestamp >= COALESCE(
                (SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1),
                date_trunc('day', NOW())
            )
              AND TransactionTimestamp < NOW()
            GROUP BY hr
            ORDER BY hr
        `;

        const totalsSql = `
            SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(TotalAmount), 0) AS sales_total
            FROM "Transaction"
            WHERE TransactionTimestamp >= COALESCE(
                (SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1),
                date_trunc('day', NOW())
            )
              AND TransactionTimestamp < NOW()
        `;

        const hourlyRows = await db.query(hourlySql);
        const totalsRows = await db.query(totalsSql);
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

        const dayStartLabel = dayStart && dayStart.toISOString ? dayStart.toISOString() : String(dayStart || 'N/A');
        const summary = `Business Day Start: ${dayStartLabel} | Sales: ${salesCount} | Revenue: $${salesTotal.toFixed(2)} | Returns/Voids/Discards: 0/0/0`;
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

// Labor report: scheduled hours by employee and by role over date range
router.get('/reports/labor', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'Missing from/to (YYYY-MM-DD)' });

        const byEmployeeSql = `
            SELECT
                u.id AS employee_id,
                u.name AS employee_name,
                COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0) AS scheduled_hours
            FROM users u
            LEFT JOIN employee_shifts s
              ON s.user_id = u.id
             AND s.shift_date >= $1
             AND s.shift_date <= $2
            WHERE u.role <> 'customer'
            GROUP BY u.id, u.name
            ORDER BY scheduled_hours DESC, u.name
        `;

        const byRoleSql = `
            SELECT
                COALESCE(NULLIF(TRIM(s.role), ''), u.role, 'staff') AS role_name,
                COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0) AS scheduled_hours
            FROM employee_shifts s
            JOIN users u ON u.id = s.user_id
            WHERE s.shift_date >= $1 AND s.shift_date <= $2
              AND u.role <> 'customer'
            GROUP BY role_name
            ORDER BY scheduled_hours DESC, role_name
        `;

        const [empRes, roleRes] = await Promise.all([
            db.query(byEmployeeSql, [from, to]),
            db.query(byRoleSql, [from, to]),
        ]);

        const byEmployee = (empRes.rows || []).map((r) => ({
            employeeId: r.employee_id,
            employeeName: r.employee_name,
            scheduledHours: Number(r.scheduled_hours || 0),
        }));
        const byRole = (roleRes.rows || []).map((r) => ({
            roleName: r.role_name,
            scheduledHours: Number(r.scheduled_hours || 0),
        }));

        res.json({ from, to, byEmployee, byRole });
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
            'SELECT business_day_start, last_z_report_date, NOW() AS business_end FROM manager_report_state WHERE singleton_id = 1 FOR UPDATE'
        );

        const state = stateRes.rows[0];
        if (!state) {
            await db.query('ROLLBACK');
            return res.status(500).json({ error: 'Z-report state row missing.' });
        }

        const businessStart = state.business_day_start;
        const lastZDate = state.last_z_report_date ? new Date(state.last_z_report_date) : null;
        const todayStr = new Date().toISOString().slice(0, 10);

        const alreadyGeneratedToday =
            lastZDate && lastZDate.toISOString().slice(0, 10) === todayStr;
        // Failsafe: allow rerunning the Z-report even if it was already generated today,
        // but DO NOT advance/reset the business day start again (prevents breaking report windows).

        const businessEnd = state.business_end;

        const totalsSql = `
            SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(TotalAmount), 0) AS sales_total
            FROM "Transaction"
            WHERE TransactionTimestamp >= (SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1)
              AND TransactionTimestamp < NOW()
        `;

        const topItemSql = `
            SELECT
                mi.name AS item_name,
                COALESCE(SUM(ti.Quantity), 0) AS units
            FROM TransactionItem ti
            JOIN menu_items mi ON mi.id = ti.ProductID
            JOIN "Transaction" t ON t.TransactionID = ti.TransactionID
            WHERE t.TransactionTimestamp >= (SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1)
              AND t.TransactionTimestamp < NOW()
            GROUP BY mi.id, mi.name
            ORDER BY units DESC, mi.name
            LIMIT 1
        `;

        const totalsRows = await db.query(totalsSql);
        const totals = totalsRows.rows[0] || { sales_count: 0, sales_total: 0 };

        const salesCount = Number(totals.sales_count || 0);
        const salesTotal = Number(totals.sales_total || 0);

        const taxAmount = salesTotal * TAX_RATE;
        const paymentsSql = `
            SELECT
                CASE
                    WHEN LOWER(COALESCE(NULLIF(TRIM(tp.payment_method), ''), 'unspecified')) = 'unspecified'
                        THEN CASE
                            WHEN o.customer_account_id IS NOT NULL THEN 'card'
                            ELSE 'cash'
                        END
                    ELSE LOWER(COALESCE(NULLIF(TRIM(tp.payment_method), ''), 'unspecified'))
                END AS method_name,
                COALESCE(SUM(COALESCE(tp.amount, t.TotalAmount)), 0) AS total_amount
            FROM "Transaction" t
            LEFT JOIN transaction_payments tp ON tp.transaction_id = t.TransactionID
            LEFT JOIN orders o ON o.transaction_id = t.TransactionID
            WHERE t.TransactionTimestamp >= (SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1)
              AND t.TransactionTimestamp < NOW()
            GROUP BY method_name
            ORDER BY total_amount DESC, method_name
        `;
        const adjustmentsSql = `
            SELECT
                COALESCE(SUM(CASE WHEN adjustment_type = 'discount' THEN amount ELSE 0 END), 0) AS discounts,
                COALESCE(SUM(CASE WHEN adjustment_type IN ('void', 'refund', 'comp') THEN amount ELSE 0 END), 0) AS voids,
                COALESCE(SUM(CASE WHEN adjustment_type = 'service_charge' THEN amount ELSE 0 END), 0) AS service_charges
            FROM manager_financial_adjustments
            WHERE created_at >= (SELECT business_day_start FROM manager_report_state WHERE singleton_id = 1)
              AND created_at < NOW()
        `;
        const [paymentsRes, adjustmentsRes] = await Promise.all([
            db.query(paymentsSql),
            db.query(adjustmentsSql),
        ]);
        const paymentMethods = (paymentsRes.rows || []).map((r) => ({
            methodName: r.method_name,
            totalAmount: Number(r.total_amount || 0),
        }));
        const adj = adjustmentsRes.rows[0] || {};
        const discounts = Number(adj.discounts || 0);
        const voids = Number(adj.voids || 0);
        const serviceCharges = Number(adj.service_charges || 0);
        const totalCash = Number(
            paymentMethods
                .filter((pm) => String(pm.methodName).toLowerCase() === 'cash')
                .reduce((sum, pm) => sum + Number(pm.totalAmount || 0), 0)
        );

        const topRows = await db.query(topItemSql);
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
                SET business_day_start = NOW(), last_z_report_date = $1
                WHERE singleton_id = 1
                `,
                [todayStr]
            );
        }

        await db.query('COMMIT');

        const paymentSummary = paymentMethods.length > 0
            ? paymentMethods
            : [{ methodName: 'unspecified', totalAmount: salesTotal }];

        res.json({
            startAt: businessStart?.toISOString ? businessStart.toISOString() : String(businessStart),
            endAt: businessEnd?.toISOString ? businessEnd.toISOString() : String(businessEnd),
            salesTotal,
            taxAmount,
            salesCount,
            totalCash,
            discounts,
            voids,
            serviceCharges,
            topItem,
            employeeSignature,
            paymentMethods: paymentSummary,
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
