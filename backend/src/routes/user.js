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
