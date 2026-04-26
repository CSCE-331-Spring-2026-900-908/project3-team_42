-- Run on existing databases to move rewards ownership from employee users to customer kiosk accounts.

ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS points_balance INT NOT NULL DEFAULT 0;

ALTER TABLE points_ledger
  ADD COLUMN IF NOT EXISTS customer_account_id INT REFERENCES customer_accounts(id) ON DELETE CASCADE;

ALTER TABLE login_points_daily
  ADD COLUMN IF NOT EXISTS customer_account_id INT REFERENCES customer_accounts(id) ON DELETE CASCADE;
