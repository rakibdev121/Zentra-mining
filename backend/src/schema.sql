CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,

    wallet_address TEXT,

    mining_balance NUMERIC(36,18) DEFAULT 0,
    total_mined NUMERIC(36,18) DEFAULT 0,
    total_claimed NUMERIC(36,18) DEFAULT 0,

    telegram_approved BOOLEAN DEFAULT FALSE,
    wallet_approved BOOLEAN DEFAULT FALSE,

    claim_enabled BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claims (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id),

    wallet_address TEXT NOT NULL,
    amount NUMERIC(36,18) NOT NULL,

    fee_bnb NUMERIC(36,18) NOT NULL DEFAULT 0.5,

    nonce TEXT UNIQUE NOT NULL,
    tx_hash TEXT UNIQUE,

    status TEXT NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id
ON users(telegram_id);

CREATE INDEX IF NOT EXISTS idx_users_wallet_address
ON users(wallet_address);

CREATE INDEX IF NOT EXISTS idx_claims_user_id
ON claims(user_id);
