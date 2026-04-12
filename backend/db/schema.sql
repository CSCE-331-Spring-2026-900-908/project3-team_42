-- Drops dependent tables safely to allow repeated execution
DROP TABLE IF EXISTS login_points_daily CASCADE;
DROP TABLE IF EXISTS points_ledger CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS TransactionItem CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS ProductInventory CASCADE;
DROP TABLE IF EXISTS manager_z_report_log CASCADE;
DROP TABLE IF EXISTS manager_report_state CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'manager', 'cashier', 'customer'
    email VARCHAR(255) UNIQUE NOT NULL,
    oauth_id VARCHAR(255),
    points_balance INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    quantity DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(50), -- 'oz', 'count', 'pump'
    restock_threshold DECIMAL(10,2) DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'Milk Tea', 'Fruit Tea', 'Slush'
    default_price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(255),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Project 2-compatible reporting model
-- ----------------------------

-- Maps which inventory ingredients are consumed by which menu product.
-- This is what powers "inventory consumed by sold products".
CREATE TABLE ProductInventory (
    ProductID INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    InventoryID INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    PRIMARY KEY (ProductID, InventoryID)
);

-- Transactions table (Project 2 uses "Transaction" and TransactionTimestamp/TotalAmount).
CREATE TABLE "Transaction" (
    TransactionID SERIAL PRIMARY KEY,
    TransactionTimestamp TIMESTAMP NOT NULL,
    TotalAmount DECIMAL(10,2) NOT NULL CHECK (TotalAmount >= 0)
);

CREATE TABLE TransactionItem (
    TransactionItemID SERIAL PRIMARY KEY,
    TransactionID INT NOT NULL REFERENCES "Transaction"(TransactionID) ON DELETE CASCADE,
    ProductID INT NOT NULL REFERENCES menu_items(id),
    Quantity INT NOT NULL CHECK (Quantity > 0),
    PriceAtPurchase DECIMAL(10,2) NOT NULL CHECK (PriceAtPurchase >= 0)
);

-- Z-report business-day state and log.
CREATE TABLE manager_report_state (
    singleton_id INT PRIMARY KEY,
    business_day_start TIMESTAMP NOT NULL,
    last_z_report_date DATE
);

CREATE TABLE manager_z_report_log (
    z_report_id SERIAL PRIMARY KEY,
    generated_at TIMESTAMP NOT NULL,
    business_day_start TIMESTAMP NOT NULL,
    business_day_end TIMESTAMP NOT NULL,
    total_sales DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    sales_count INT NOT NULL,
    employee_signature VARCHAR(100)
);

-- ----------------------------
-- Orders (app transactional model)
-- ----------------------------
-- Defined after "Transaction" to satisfy the FK reference during schema init.
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    cashier_id INT REFERENCES users(id),
    customer_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    transaction_id INT REFERENCES "Transaction"(TransactionID) ON DELETE SET NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    points_earned INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES menu_items(id),
    quantity INT DEFAULT 1,
    customization JSONB, -- e.g. {"ice": "50%", "sugar": "70%", "toppings": ["boba", "lychee jelly"]}
    price_at_time DECIMAL(10,2) NOT NULL
);

-- Loyalty / analytics: append-only ledger plus cached per-user balance (updated in the same transaction as inserts).
CREATE TABLE points_ledger (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(32) NOT NULL, -- 'order', 'login', 'bonus', 'order_reversal'
    points_delta INT NOT NULL,
    order_id INT REFERENCES orders(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_points_ledger_user_time ON points_ledger (user_id, created_at DESC);

-- Prevents farming login points: at most one successful award per user per UTC calendar day.
CREATE TABLE login_points_daily (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    award_date DATE NOT NULL,
    PRIMARY KEY (user_id, award_date)
);
