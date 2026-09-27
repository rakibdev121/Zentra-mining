const express = require("express");
const router = express.Router();
const pool = require("../db");
const { telegramAuth } = require("../middleware/telegramAuth");

// Create / Get authenticated Telegram User
router.post("/register", telegramAuth, async (req, res) => {
    try {
        const telegramUser = req.telegramUser;

        const telegram_id = String(telegramUser.id);
        const username = telegramUser.username || null;

        const result = await pool.query(
            `
            INSERT INTO users (telegram_id, username)
            VALUES ($1, $2)
            ON CONFLICT (telegram_id)
            DO UPDATE SET
                username = EXCLUDED.username,
                updated_at = NOW()
            RETURNING *
            `,
            [telegram_id, username]
        );

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Register error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// Submit / Update authenticated user's wallet
router.post("/wallet", telegramAuth, async (req, res) => {
    try {
        const telegram_id = String(req.telegramUser.id);
        const wallet_address = String(
            req.body.wallet_address || ""
        ).trim();

        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                message: "Wallet address is required"
            });
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            return res.status(400).json({
                success: false,
                message: "Invalid BSC wallet address"
            });
        }

        // Make sure wallet request table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS wallet_requests (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id),
                telegram_id BIGINT NOT NULL,
                wallet_address TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_wallet_requests_status
            ON wallet_requests(status);

            CREATE INDEX IF NOT EXISTS idx_wallet_requests_telegram_id
            ON wallet_requests(telegram_id);
        `);

        const userResult = await pool.query(
            `SELECT id, telegram_id, username
             FROM users
             WHERE telegram_id = $1`,
            [telegram_id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = userResult.rows[0];

        // Replace any previous pending request
        await pool.query(
            `UPDATE wallet_requests
             SET status = 'replaced',
                 updated_at = NOW()
             WHERE user_id = $1
               AND status = 'pending'`,
            [user.id]
        );

        // Create new pending wallet request
        const requestResult = await pool.query(
            `INSERT INTO wallet_requests
                (user_id, telegram_id, wallet_address, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING id, telegram_id, wallet_address, status, created_at`,
            [
                user.id,
                telegram_id,
                wallet_address
            ]
        );

        res.json({
            success: true,
            message: "Wallet submitted. Waiting for admin approval.",
            request: requestResult.rows[0]
        });

    } catch (error) {
        console.error("Wallet submit error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Get authenticated user
router.get("/me", telegramAuth, async (req, res) => {
    try {
        const telegram_id = String(req.telegramUser.id);

        const result = await pool.query(
            "SELECT * FROM users WHERE telegram_id = $1",
            [telegram_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Get user error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


module.exports = router;
