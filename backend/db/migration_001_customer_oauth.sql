-- Run once on existing databases that already have the pre-OAuth schema.
-- Safe to re-run: uses IF NOT EXISTS where supported.

CREATE TABLE IF NOT EXISTS customer_accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    picture_url VARCHAR(512),
    oauth_provider VARCHAR(50) NOT NULL DEFAULT 'google',
    oauth_subject VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (oauth_provider, oauth_subject),
    UNIQUE (email)
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_account_id INT REFERENCES customer_accounts(id) ON DELETE SET NULL;
