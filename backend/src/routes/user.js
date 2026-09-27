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

        const result = await pool.query(
            `
            UPDATE users
            SET
                wallet_address = $1,
                wallet_approved = FALSE,
                claim_enabled = FALSE,
                updated_at = NOW()
            WHERE telegram_id = $2
            RETURNING
                id,
                telegram_id,
                username,
                wallet_address,
                wallet_approved,
                claim_enabled
            `,
            [wallet_address, telegram_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "Wallet submitted successfully",
            user: result.rows[0]
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
