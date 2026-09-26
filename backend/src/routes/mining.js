const express = require("express");
const router = express.Router();

const pool = require("../db");
const { telegramAuth } = require("../middleware/telegramAuth");

const MINING_RATE_PER_MINUTE = 1;
const CLAIM_INTERVAL_SECONDS = 24 * 60 * 60;
const CLAIM_REWARD = 1440;


// =========================
// START MINING
// =========================

router.post("/start", telegramAuth, async (req, res) => {
    try {
        const telegram_id = String(req.telegramUser.id);

        const result = await pool.query(
            `
            SELECT *
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

        if (user.mining_active) {
            return res.json({
                success: true,
                message: "Mining already active",
                mining_active: true
            });
        }

        const now = new Date();

        const update = await pool.query(
            `
            UPDATE users
            SET
                mining_active = TRUE,
                mining_started_at = $1,
                last_claim_at = $1,
                updated_at = NOW()
            WHERE telegram_id = $2
            RETURNING *
            `,
            [now, telegram_id]
        );

        res.json({
            success: true,
            message: "Mining started",
            mining_active: true,
            user: update.rows[0]
        });

    } catch (error) {
        console.error("Mining start error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// =========================
// MINING STATUS
// =========================

router.get("/status", telegramAuth, async (req, res) => {
    try {
        const telegram_id = String(req.telegramUser.id);

        const result = await pool.query(
            `
            SELECT *
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

        const baseBalance =
            Number(user.mining_balance || 0);

        let earnedSinceClaim = 0;
        let elapsedSeconds = 0;
        let remainingSeconds = 0;

        if (
            user.mining_active &&
            user.last_claim_at
        ) {
            elapsedSeconds = Math.floor(
                (Date.now() -
                    new Date(user.last_claim_at).getTime()) / 1000
            );

            elapsedSeconds =
                Math.max(0, elapsedSeconds);

            const miningSeconds =
                Math.min(
                    elapsedSeconds,
                    CLAIM_INTERVAL_SECONDS
                );

            earnedSinceClaim =
                (miningSeconds / 60) *
                MINING_RATE_PER_MINUTE;

            remainingSeconds =
                Math.max(
                    0,
                    CLAIM_INTERVAL_SECONDS -
                    elapsedSeconds
                );
        }

        const liveBalance =
            baseBalance + earnedSinceClaim;

        const claimable =
            elapsedSeconds >= CLAIM_INTERVAL_SECONDS
                ? CLAIM_REWARD
                : 0;

        res.json({
            success: true,

            mining: {
                mining_active: Boolean(user.mining_active),

                mining_balance:
                    user.mining_balance,

                live_balance:
                    liveBalance.toFixed(6),

                earned_since_claim:
                    earnedSinceClaim.toFixed(6),

                elapsed_seconds:
                    elapsedSeconds,

                remaining_seconds:
                    remainingSeconds,

                remaining_minutes:
                    Math.ceil(
                        remainingSeconds / 60
                    ),

                claimable:
                    claimable,

                mining_rate:
                    MINING_RATE_PER_MINUTE,

                claim_reward:
                    CLAIM_REWARD
            }
        });

    } catch (error) {
        console.error("Mining status error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// =========================
// CLAIM 24 HOUR REWARD
// =========================

router.post("/claim", telegramAuth, async (req, res) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const telegram_id =
            String(req.telegramUser.id);

        const result = await client.query(
            `
            SELECT *
            FROM users
            WHERE telegram_id = $1
            FOR UPDATE
            `,
            [telegram_id]
        );

        if (result.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "User not found"
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

        const elapsedSeconds =
            Math.floor(
                (Date.now() -
                    new Date(user.last_claim_at).getTime()) / 1000
            );

        if (
            elapsedSeconds <
            CLAIM_INTERVAL_SECONDS
        ) {

            const remaining =
                CLAIM_INTERVAL_SECONDS -
                elapsedSeconds;

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Claim is not ready",
                remaining_seconds: remaining
            });
        }

        await client.query(
            `
            UPDATE users
            SET
                mining_balance =
                    mining_balance + $1,

                total_mined =
                    total_mined + $1,

                total_claimed =
                    total_claimed + $1,

                last_claim_at = NOW(),

                updated_at = NOW()
            WHERE telegram_id = $2
            `,
            [
                CLAIM_REWARD,
                telegram_id
            ]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Claim successful",
            claimed_amount: CLAIM_REWARD
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Mining claim error:",
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
