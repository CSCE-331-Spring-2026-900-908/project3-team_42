-- Run from inside backend/db so relative paths resolve.
-- 1) Generate CSV first:
--    node generateSeedData.js
-- 2) Then load this file with psql (init.js handles this).

\copy users (id, name, role, email) FROM 'seed-data/users.csv' WITH (FORMAT csv, HEADER true);
\copy inventory (id, name, category, quantity, unit, restock_threshold) FROM 'seed-data/inventory.csv' WITH (FORMAT csv, HEADER true);
\copy menu_items (id, name, description, category, default_price, image_url, is_available) FROM 'seed-data/menu_items.csv' WITH (FORMAT csv, HEADER true);
\copy ProductInventory (ProductID, InventoryID) FROM 'seed-data/product_inventory.csv' WITH (FORMAT csv, HEADER true);
\copy "Transaction" (TransactionID, TransactionTimestamp, TotalAmount) FROM 'seed-data/transactions.csv' WITH (FORMAT csv, HEADER true);
\copy TransactionItem (TransactionItemID, TransactionID, ProductID, Quantity, PriceAtPurchase) FROM 'seed-data/transaction_items.csv' WITH (FORMAT csv, HEADER true);

-- Keep serial sequences consistent with explicitly loaded IDs.
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('inventory', 'id'), COALESCE((SELECT MAX(id) FROM inventory), 1), true);
SELECT setval(pg_get_serial_sequence('menu_items', 'id'), COALESCE((SELECT MAX(id) FROM menu_items), 1), true);
SELECT setval(pg_get_serial_sequence('"Transaction"', 'transactionid'), COALESCE((SELECT MAX(transactionid) FROM "Transaction"), 1), true);
SELECT setval(pg_get_serial_sequence('transactionitem', 'transactionitemid'), COALESCE((SELECT MAX(transactionitemid) FROM transactionitem), 1), true);

-- Manager report state singleton required by X/Z endpoints.
-- IMPORTANT: X/Z reports filter by business_day_start, so seed it to the earliest seeded transaction
-- (otherwise reports can show $0 if business_day_start is later than all seeded transactions).
INSERT INTO manager_report_state (singleton_id, business_day_start, last_z_report_date)
VALUES (
  1,
  COALESCE((SELECT MIN(transactiontimestamp) FROM "Transaction"), CURRENT_TIMESTAMP),
  NULL
)
ON CONFLICT (singleton_id)
DO UPDATE SET
  business_day_start = EXCLUDED.business_day_start,
  last_z_report_date = NULL;

-- Build orders/order_items from transaction data for UI history compatibility.
INSERT INTO orders (cashier_id, transaction_id, total_amount, status, created_at)
SELECT
  CASE
    WHEN (t.transactionid % 3) = 0 THEN 2
    WHEN (t.transactionid % 3) = 1 THEN 3
    ELSE 4
  END AS cashier_id,
  t.transactionid,
  t.totalamount,
  'completed',
  t.transactiontimestamp
FROM "Transaction" t
ORDER BY t.transactionid;

\copy order_items (order_id, menu_item_id, quantity, customization, price_at_time) FROM 'seed-data/order_items.csv' WITH (FORMAT csv, HEADER true);

-- Reflect consumed inventory in starting quantities like Project 2 report behavior.
UPDATE inventory inv
SET quantity = GREATEST(0, inv.quantity - used.used_qty)
FROM (
  SELECT pi.inventoryid AS inventory_id, SUM(ti.quantity) AS used_qty
  FROM transactionitem ti
  JOIN productinventory pi ON pi.productid = ti.productid
  GROUP BY pi.inventoryid
) used
WHERE inv.id = used.inventory_id;
