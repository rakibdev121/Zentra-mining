require("dotenv").config({ path: __dirname + "/../.env" });

const pool = require("./db");

async function main() {
    try {
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS referred_by BIGINT,
            ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS referral_earned NUMERIC(36,18) DEFAULT 0;

            CREATE TABLE IF NOT EXISTS referrals (
                id BIGSERIAL PRIMARY KEY,
                referrer_id BIGINT NOT NULL REFERENCES users(id),
                referred_user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
                reward NUMERIC(36,18) NOT NULL DEFAULT 5000,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_referrals_referrer
            ON referrals(referrer_id);
        `);

        console.log("✅ Zentra Referral Database Ready!");
        console.log("🎁 Referral Reward: 5,000 Zentra");

        await pool.end();
    } catch (error) {
        console.error("❌ Referral migration error:", error.message);
        await pool.end();
        process.exit(1);
    }
}
main();
