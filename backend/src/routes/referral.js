const express = require("express");
const router = express.Router();

const pool = require("../db");
const { telegramAuth } = require("../middleware/telegramAuth");

const REFERRAL_REWARD = 5000;


// GET REFERRAL INFO
router.get("/info", telegramAuth, async (req, res) => {
    try {
        const telegram_id = String(req.telegramUser.id);

        const result = await pool.query(
            `
            SELECT
                id,
                telegram_id,
                referral_count,
                referral_earned
            FROM users
            WHERE telegram_id = $1
            `,
            [telegram_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            referral: {
                referral_count:
                    user.referral_count || 0,

                referral_earned:
                    user.referral_earned || 0,

                reward_per_referral:
                    REFERRAL_REWARD
            }
        });

    } catch (error) {
        console.error(
            "Referral info error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// PROCESS REFERRAL
router.post("/process", telegramAuth, async (req, res) => {

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const telegram_id =
            String(req.telegramUser.id);

        const referralCode =
            String(req.body.referral_code || "").trim();

        if (!referralCode) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Referral code required"
            });
        }

        // Find current user
        const userResult = await client.query(
            `
            SELECT *
            FROM users
            WHERE telegram_id = $1
            FOR UPDATE
            `,
            [telegram_id]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = userResult.rows[0];

        // Already referred
        if (user.referred_by) {
            await client.query("ROLLBACK");

            return res.json({
                success: true,
                message: "Referral already processed"
            });
        }

        // Referral code = referrer's Telegram ID
        const referrerResult = await client.query(
            `
            SELECT *
            FROM users
            WHERE telegram_id = $1
            FOR UPDATE
            `,
            [referralCode]
        );

        if (referrerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Invalid referral code"
            });
        }

        const referrer =
            referrerResult.rows[0];

        // Cannot refer yourself
        if (
            String(referrer.telegram_id) ===
            telegram_id
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "You cannot refer yourself"
            });
        }

        // Create referral record
        await client.query(
            `
            INSERT INTO referrals
            (
                referrer_id,
                referred_user_id,
                reward
            )
            VALUES ($1, $2, $3)
            `,
            [
                referrer.id,
                user.id,
                REFERRAL_REWARD
            ]
        );

        // Update referrer
        await client.query(
            `
            UPDATE users
            SET
                referral_count =
                    COALESCE(referral_count, 0) + 1,

                referral_earned =
                    COALESCE(referral_earned, 0) + $1,

                mining_balance =
                    COALESCE(mining_balance, 0) + $1,

                total_mined =
                    COALESCE(total_mined, 0) + $1,

                updated_at = NOW()
            WHERE id = $2
            `,
            [
                REFERRAL_REWARD,
                referrer.id
            ]
        );

        // Mark current user as referred
        await client.query(
            `
            UPDATE users
            SET
                referred_by = $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
                referrer.id,
                user.id
            ]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Referral successful",
            reward: REFERRAL_REWARD
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Referral process error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {
        client.release();
    }
});

module.exports = router;
