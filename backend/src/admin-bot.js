require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const pool = require("./db");

const BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_TELEGRAM_ID);

if (!BOT_TOKEN) {
    console.error("ADMIN_BOT_TOKEN missing");
    process.exit(1);
}

if (!ADMIN_ID) {
    console.error("ADMIN_TELEGRAM_ID missing");
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, {
    polling: true
});

console.log("Zentra Admin Bot started.");

function isAdmin(userId) {
    return String(userId) === ADMIN_ID;
}

async function sendAdminMenu(chatId) {
    await bot.sendMessage(
        chatId,
        "👑 Zentra Admin Panel\n\nChoose an option:",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "👥 Users", callback_data: "users" },
                        { text: "💰 Pending Claims", callback_data: "pending_claims" }
                    ],
                    [
                        { text: "📋 Claim History", callback_data: "claim_history" },
                        { text: "📊 Statistics", callback_data: "statistics" }
                    ],
                    [
                        { text: "🔄 Refresh", callback_data: "admin_menu" }
                    ]
                ]
            }
        }
    );
}

/* =========================
   /admin
========================= */

bot.onText(/^\/admin$/, async (msg) => {
    try {
        console.log("/admin received from:", msg.from.id);

        if (!isAdmin(msg.from.id)) {
            await bot.sendMessage(
                msg.chat.id,
                "⛔ Unauthorized."
            );
            return;
        }

        await sendAdminMenu(msg.chat.id);

    } catch (err) {
        console.error("Admin command error:", err);
    }
});

/* =========================
   CALLBACK
========================= */

bot.on("callback_query", async (query) => {
    try {
        const userId = query.from.id;
        const chatId = query.message.chat.id;
        const data = query.data;

        if (!isAdmin(userId)) {
            await bot.answerCallbackQuery(query.id, {
                text: "⛔ Unauthorized",
                show_alert: true
            });
            return;
        }

        await bot.answerCallbackQuery(query.id);

        /* MENU */

        if (data === "admin_menu") {
            await sendAdminMenu(chatId);
            return;
        }

        /* USERS */

        if (data === "users") {
            const result = await pool.query(`
                SELECT
                    telegram_id,
                    username,
                    wallet_address,
                    mining_balance,
                    total_mined,
                    total_claimed,
                    telegram_approved,
                    wallet_approved,
                    claim_enabled
                FROM users
                ORDER BY created_at DESC
                LIMIT 50
            `);

            if (!result.rows.length) {
                await bot.sendMessage(chatId, "👥 No users found.");
                return;
            }

            let text = "👥 Zentra Users\n\n";

            for (const user of result.rows) {
                text +=
`👤 Telegram: ${user.telegram_id}
📛 Username: ${user.username ? "@" + user.username : "N/A"}
👛 Wallet: ${user.wallet_address || "Not connected"}
💎 Balance: ${user.mining_balance}
⛏ Mined: ${user.total_mined}
💸 Claimed: ${user.total_claimed}
✅ Telegram: ${user.telegram_approved ? "Approved" : "Pending"}
✅ Wallet: ${user.wallet_approved ? "Approved" : "Pending"}
🔓 Claim: ${user.claim_enabled ? "Enabled" : "Disabled"}

`;
            }

            await bot.sendMessage(chatId, text);
            return;
        }

        /* PENDING CLAIMS */

        if (data === "pending_claims") {
            const result = await pool.query(`
                SELECT
                    c.id,
                    c.wallet_address,
                    c.amount,
                    c.fee_bnb,
                    c.status,
                    u.telegram_id,
                    u.username
                FROM claims c
                JOIN users u ON u.id = c.user_id
                WHERE c.status = 'pending'
                ORDER BY c.created_at ASC
                LIMIT 50
            `);

            if (!result.rows.length) {
                await bot.sendMessage(chatId, "💰 No pending claims.");
                return;
            }

            for (const claim of result.rows) {
                const text =
`💰 Claim #${claim.id}

👤 Telegram ID: ${claim.telegram_id}
📛 Username: ${claim.username ? "@" + claim.username : "N/A"}
👛 Wallet: ${claim.wallet_address}
💎 Amount: ${claim.amount} RAKI
💵 Fee: ${claim.fee_bnb} BNB
⏳ Status: ${claim.status}`;

                await bot.sendMessage(chatId, text, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✅ APPROVE",
                                    callback_data: `approve_claim:${claim.id}`
                                },
                                {
                                    text: "❌ REJECT",
                                    callback_data: `reject_claim:${claim.id}`
                                }
                            ]
                        ]
                    }
                });
            }

            return;
        }

        /* APPROVE */

        if (data.startsWith("approve_claim:")) {
            const claimId = data.split(":")[1];

            const result = await pool.query(`
                UPDATE claims
                SET status = 'approved'
                WHERE id = $1
                AND status = 'pending'
                RETURNING id
            `, [claimId]);

            if (!result.rows.length) {
                await bot.sendMessage(
                    chatId,
                    "⚠️ Claim already processed or not found."
                );
                return;
            }

            await bot.sendMessage(
                chatId,
                `✅ Claim #${claimId} approved.\n\nBlockchain transfer has NOT been made.`
            );

            return;
        }

        /* REJECT */

        if (data.startsWith("reject_claim:")) {
            const claimId = data.split(":")[1];

            const result = await pool.query(`
                UPDATE claims
                SET status = 'rejected'
                WHERE id = $1
                AND status = 'pending'
                RETURNING id
            `, [claimId]);

            if (!result.rows.length) {
                await bot.sendMessage(
                    chatId,
                    "⚠️ Claim already processed or not found."
                );
                return;
            }

            await bot.sendMessage(
                chatId,
                `❌ Claim #${claimId} rejected.`
            );

            return;
        }

        /* HISTORY */

        if (data === "claim_history") {
            const result = await pool.query(`
                SELECT
                    c.id,
                    c.amount,
                    c.wallet_address,
                    c.status,
                    u.telegram_id
                FROM claims c
                JOIN users u ON u.id = c.user_id
                ORDER BY c.created_at DESC
                LIMIT 50
            `);

            if (!result.rows.length) {
                await bot.sendMessage(
                    chatId,
                    "📋 No claim history."
                );
                return;
            }

            let text = "📋 Claim History\n\n";

            for (const claim of result.rows) {
                text +=
`#${claim.id}
👤 ${claim.telegram_id}
👛 ${claim.wallet_address}
💎 ${claim.amount} RAKI
📌 ${claim.status}

`;
            }

            await bot.sendMessage(chatId, text);
            return;
        }

        /* STATISTICS */

        if (data === "statistics") {
            const users = await pool.query(
                `SELECT COUNT(*) AS total FROM users`
            );

            const pending = await pool.query(
                `SELECT COUNT(*) AS total FROM claims WHERE status = 'pending'`
            );

            const approved = await pool.query(
                `SELECT COUNT(*) AS total FROM claims WHERE status = 'approved'`
            );

            const rejected = await pool.query(
                `SELECT COUNT(*) AS total FROM claims WHERE status = 'rejected'`
            );

            const text =
`📊 Zentra Statistics

👥 Users: ${users.rows[0].total}

💰 Pending Claims: ${pending.rows[0].total}
✅ Approved Claims: ${approved.rows[0].total}
❌ Rejected Claims: ${rejected.rows[0].total}`;

            await bot.sendMessage(chatId, text);
            return;
        }

    } catch (err) {
        console.error("Callback error:", err);
    }
});

bot.on("polling_error", (error) => {
    console.error("Polling error:", error.message);
});

console.log("Zentra Admin Bot is running...");
