const express = require("express");
const router = express.Router();

const pool = require("../db");
const { adminAuth } = require("../middleware/adminAuth");

router.use(adminAuth);


// Get all users
router.get("/users", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                telegram_id,
                username,
                wallet_address,
                mining_balance,
                total_mined,
                total_claimed,
                telegram_approved,
                wallet_approved,
                claim_enabled,
                mining_active,
                mining_started_at,
                last_claim_at,
                created_at,
                updated_at
            FROM users
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            count: result.rows.length,
            users: result.rows
        });

    } catch (error) {
        console.error("Admin users error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Approve Telegram user
router.post("/users/:telegramId/approve", async (req, res) => {
    try {
        const telegramId = String(req.params.telegramId);

        const result = await pool.query(`
            UPDATE users
            SET telegram_approved = TRUE,
                updated_at = NOW()
            WHERE telegram_id = $1
            RETURNING *
        `, [telegramId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "Telegram user approved",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Telegram approval error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Set wallet address
router.post("/users/:telegramId/wallet", async (req, res) => {
    try {
        const telegramId = String(req.params.telegramId);
        const walletAddress = String(req.body.wallet_address || "").trim();

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: "wallet_address is required"
            });
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({
                success: false,
                message: "Invalid BSC wallet address"
            });
        }

        const result = await pool.query(`
            UPDATE users
            SET wallet_address = $1,
                wallet_approved = FALSE,
                claim_enabled = FALSE,
                updated_at = NOW()
            WHERE telegram_id = $2
            RETURNING *
        `, [walletAddress, telegramId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "Wallet saved. Approval is still required.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Wallet update error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Approve wallet
router.post("/users/:telegramId/wallet/approve", async (req, res) => {
    try {
        const telegramId = String(req.params.telegramId);

        const result = await pool.query(`
            UPDATE users
            SET wallet_approved = TRUE,
                updated_at = NOW()
            WHERE telegram_id = $1
              AND wallet_address IS NOT NULL
            RETURNING *
        `, [telegramId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User or wallet not found"
            });
        }

        res.json({
            success: true,
            message: "Wallet approved",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Wallet approval error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Enable / disable claim
router.post("/users/:telegramId/claim-enable", async (req, res) => {
    try {
        const telegramId = String(req.params.telegramId);
        const enabled = req.body.enabled === true;

        const result = await pool.query(`
            UPDATE users
            SET claim_enabled = $1,
                updated_at = NOW()
            WHERE telegram_id = $2
              AND telegram_approved = TRUE
              AND wallet_approved = TRUE
            RETURNING *
        `, [enabled, telegramId]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "User must have approved Telegram ID and wallet"
            });
        }

        res.json({
            success: true,
            message: enabled ? "Claim enabled" : "Claim disabled",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Claim enable error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


module.exports = router;
