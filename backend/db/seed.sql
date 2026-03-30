INSERT INTO users (name, role, email) VALUES
('Manager Reveille', 'manager', 'reveille.bubbletea@gmail.com'),
('Cashier Alice', 'cashier', 'alice@boba.com'),
('Self-Service Kiosk', 'cashier', 'kiosk@reveilleboba.local');

INSERT INTO inventory (name, category, quantity, unit, restock_threshold) VALUES
('Tapioca Pearls (Boba)', 'Topping', 500, 'oz', 100),
('Black Tea Leaves', 'Tea Base', 200, 'oz', 50),
('Green Tea Leaves', 'Tea Base', 150, 'oz', 50),
('Milk powder', 'Dairy', 300, 'oz', 100),
('Lychee Jelly', 'Topping', 200, 'oz', 50),
('Mango Syrup', 'Syrup', 100, 'pump', 20),
('Cups (Regular)', 'Packaging', 1000, 'count', 200),
('Straws (Large)', 'Packaging', 2000, 'count', 300);

INSERT INTO menu_items (name, description, category, default_price, image_url) VALUES
('Classic Milk Tea', 'Traditional black milk tea with boba.', 'Milk Tea', 4.50, '/images/classic_milk_tea.png'),
('Taro Milk Tea', 'Creamy taro root blended with milk tea.', 'Milk Tea', 5.00, '/images/taro_milk_tea.png'),
('Mango Green Tea', 'Refreshing jasmine green tea with mango syrup.', 'Fruit Tea', 4.75, '/images/mango_green_tea.png'),
('Strawberry Slush', 'Ice blended with real strawberries over green tea.', 'Slush', 5.50, '/images/strawberry_slush.png'),
('Brown Sugar Boba', 'Fresh milk with warm brown sugar glaze and boba.', 'Specialty', 5.75, '/images/brown_sugar_boba.png');

-- ----------------------------
-- Seed data for manager reports
-- ----------------------------

-- Initialize Z-report business-day state.
INSERT INTO manager_report_state (singleton_id, business_day_start, last_z_report_date)
VALUES (1, DATE_TRUNC('day', CURRENT_TIMESTAMP), NULL)
ON CONFLICT (singleton_id) DO NOTHING;

-- Create a deterministic "product consumes inventory" mapping.
-- Each product links to 3 inventory ingredients (based on id ordering).
INSERT INTO ProductInventory (ProductID, InventoryID)
SELECT product_id, inventory_id
FROM (
  SELECT
    p.id AS product_id,
    i.id AS inventory_id,
    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY (p.id + i.id)) AS rn
  FROM menu_items p
  CROSS JOIN inventory i
) ranked
WHERE ranked.rn <= 3
ON CONFLICT DO NOTHING;

-- Seed transactions for "today" so X-report and product usage show data.
-- We insert explicit IDs to make item generation deterministic.
WITH params AS (
  SELECT
    DATE_TRUNC('day', CURRENT_TIMESTAMP) AS day_start,
    CURRENT_TIMESTAMP AS day_end,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - DATE_TRUNC('day', CURRENT_TIMESTAMP))) AS seconds_range
),
tx AS (
  SELECT gs AS tx_id
  FROM GENERATE_SERIES(1, 40) AS gs
)
INSERT INTO "Transaction" (TransactionID, TransactionTimestamp, TotalAmount)
SELECT
  tx.tx_id AS TransactionID,
  LEAST(
    p.day_end,
    GREATEST(
      p.day_start,
      p.day_start + ((tx.tx_id - 1)::float / 40.0) * p.seconds_range * INTERVAL '1 second'
    )
  ) AS TransactionTimestamp,
  0::DECIMAL(10,2) AS TotalAmount
FROM tx
CROSS JOIN params p
ORDER BY TransactionID;

-- Insert TransactionItem rows: 2 items per transaction.
INSERT INTO TransactionItem (TransactionItemID, TransactionID, ProductID, Quantity, PriceAtPurchase)
SELECT
  ((ti_tx.tx_id - 1) * 2 + item_idx) AS TransactionItemID,
  ti_tx.tx_id AS TransactionID,
  ((ti_tx.tx_id - 1 + item_idx - 1) % (SELECT COUNT(*) FROM menu_items)) + 1 AS ProductID,
  ((ti_tx.tx_id * item_idx) % 3) + 1 AS Quantity,
  mi.default_price AS PriceAtPurchase
FROM (
  SELECT gs AS tx_id
  FROM GENERATE_SERIES(1, 40) AS gs
) ti_tx
JOIN GENERATE_SERIES(1, 2) AS item(item_idx) ON TRUE
JOIN menu_items mi ON mi.id = (((ti_tx.tx_id - 1 + item_idx - 1) % (SELECT COUNT(*) FROM menu_items)) + 1);

-- Now compute Transaction.TotalAmount from its TransactionItem rows.
UPDATE "Transaction" t
SET TotalAmount = sub.total_amount
FROM (
  SELECT TransactionID, SUM(Quantity * PriceAtPurchase) AS total_amount
  FROM TransactionItem
  GROUP BY TransactionID
) sub
WHERE sub.TransactionID = t.TransactionID;

-- Finally, deduct inventory quantities based on ProductInventory links
-- and TransactionItem quantities (mirrors Project 2's saveTransaction behavior).
WITH used AS (
  SELECT
    pi.InventoryID,
    SUM(ti.Quantity) AS used_qty
  FROM TransactionItem ti
  JOIN ProductInventory pi ON pi.ProductID = ti.ProductID
  JOIN "Transaction" t ON t.TransactionID = ti.TransactionID
  GROUP BY pi.InventoryID
)
UPDATE inventory inv
SET quantity = GREATEST(0, inv.quantity - used.used_qty)
FROM used
WHERE used.InventoryID = inv.id;
