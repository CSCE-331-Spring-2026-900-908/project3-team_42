-- Fix points_ledger by dropping the legacy user_id column
ALTER TABLE points_ledger DROP COLUMN IF EXISTS user_id CASCADE;

-- Fix login_points_daily by dropping the legacy user_id column and recreating the primary key
ALTER TABLE login_points_daily DROP CONSTRAINT IF EXISTS login_points_daily_pkey CASCADE;
ALTER TABLE login_points_daily DROP COLUMN IF EXISTS user_id CASCADE;

-- Ensure customer_account_id is correctly set as NOT NULL and part of the new primary key
ALTER TABLE login_points_daily DROP COLUMN IF EXISTS customer_account_id CASCADE;
ALTER TABLE login_points_daily ADD COLUMN customer_account_id INT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE;
ALTER TABLE login_points_daily ADD PRIMARY KEY (customer_account_id, award_date);
