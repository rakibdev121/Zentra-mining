const express = require("express");
const router = express.Router();
const pool = require("../db");
const { telegramAuth } = require("../middleware/telegramAuth");

const MINING_RATE_PER_MINUTE = 1;
const CLAIM_INTERVAL_MINUTES = 24 * 60;
const CLAIM_REWARD =
    CLAIM_INTERVAL_MINUTES * MINING_RATE_PER_MINUTE;


// Start mining
router.post("/start", telegramAuth, async (req, res) => {
    try {
        const telegram_id = String(req.telegramUser.id);

        const result = await pool.query(
            `SELECT
                id,
                telegram_id,
                mining_active,
                mining_started_at,
                last_claim_at
             FROM public.users
             WHERE telegram_id = $1`,
            [telegram_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not registered"
            });
        }

        const user = result.rows[0];

        if (user.mining_active) {
            return res.json({
                success: true,
                message: "Mining is already active",
                mining_active: true,
                mining_started_at: user.mining_started_at,
                last_claim_at: user.last_claim_at
            });
        }

        const now = new Date();

        const update = await pool.query(
            `UPDATE public.users
             SET mining_active = TRUE,
                 mining_started_at = $1,
                 last_claim_at = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING
                id,
                telegram_id,
                mining_active,
                mining_started_at,
                last_claim_at`,
            [now, user.id]
        );

        return res.json({
            success: true,
            message: "Mining started successfully",
            user: update.rows[0]
        });

    } catch (error) {
        console.error("Mining start error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Mining status
router.get("/status", telegramAuth, async (req, res) => {
    try {
        const telegram_id = String(req.telegramUser.id);

        const result = await pool.query(
            `SELECT
                id,
                telegram_id,
                mining_active,
                mining_started_at,
                last_claim_at,
                mining_balance,
                total_mined,
                total_claimed
             FROM public.users
             WHERE telegram_id = $1`,
            [telegram_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not registered"
            });
        }

        const user = result.rows[0];

        let minutesSinceClaim = 0;
        let remainingMinutes = CLAIM_INTERVAL_MINUTES;
        let claimable = 0;

        if (user.mining_active && user.last_claim_at) {
            const elapsedMs =
                Date.now() -
                new Date(user.last_claim_at).getTime();

            minutesSinceClaim = Math.max(
                0,
                Math.floor(elapsedMs / 60000)
            );

            if (minutesSinceClaim >= CLAIM_INTERVAL_MINUTES) {
                claimable = CLAIM_REWARD;
                remainingMinutes = 0;
            } else {
                remainingMinutes =
                    CLAIM_INTERVAL_MINUTES - minutesSinceClaim;
            }
        }

        return res.json({
            success: true,
            telegram_id,
            mining_active: user.mining_active,
            mining_started_at: user.mining_started_at,
            last_claim_at: user.last_claim_at,
            mining_balance: user.mining_balance,
            total_mined: user.total_mined,
            total_claimed: user.total_claimed,
            minutes_since_claim: minutesSinceClaim,
            remaining_minutes: remainingMinutes,
            claimable,
            claim_interval_minutes: CLAIM_INTERVAL_MINUTES,
            mining_rate_per_minute: MINING_RATE_PER_MINUTE
        });

    } catch (error) {
        console.error("Mining status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Claim mining
router.post("/claim", telegramAuth, async (req, res) => {
    const client = await pool.connect();

    try {
        const telegram_id = String(req.telegramUser.id);

        await client.query("BEGIN");

        const result = await client.query(
            `SELECT
                id,
                telegram_id,
                mining_active,
                mining_started_at,
                last_claim_at,
                mining_balance,
                total_mined,
                total_claimed
             FROM public.users
             WHERE telegram_id = $1
             FOR UPDATE`,
            [telegram_id]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "User not registered"
            });
        }

        const user = result.rows[0];

        if (!user.mining_active) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Mining is not active"
            });
        }

        if (!user.last_claim_at) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Mining claim time is not initialized"
            });
        }

        const now = new Date();
        const lastClaim = new Date(user.last_claim_at);

        const elapsedMs =
            now.getTime() - lastClaim.getTime();

        const elapsedMinutes = Math.max(
            0,
            Math.floor(elapsedMs / 60000)
        );

        if (elapsedMinutes < CLAIM_INTERVAL_MINUTES) {
            const remainingMinutes =
                CLAIM_INTERVAL_MINUTES - elapsedMinutes;

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Claim is not available yet",
                minutes_since_claim: elapsedMinutes,
                remaining_minutes: remainingMinutes,
                claim_interval_minutes: CLAIM_INTERVAL_MINUTES
            });
        }

        const claimAmount = CLAIM_REWARD;

        const update = await client.query(
            `UPDATE public.users
             SET mining_balance =
                    COALESCE(mining_balance, 0) + $1,
                 total_mined =
                    COALESCE(total_mined, 0) + $1,
                 total_claimed =
                    COALESCE(total_claimed, 0) + $1,
                 last_claim_at = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING
                id,
                telegram_id,
                mining_active,
                mining_balance,
                total_mined,
                total_claimed,
                last_claim_at`,
            [claimAmount, now, user.id]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Mining claimed successfully",
            claimed_amount: claimAmount,
            next_claim_after_minutes: CLAIM_INTERVAL_MINUTES,
            user: update.rows[0]
        });

    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (_) {}

        console.error("Mining claim error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {
        client.release();
    }
});


module.exports = router;
