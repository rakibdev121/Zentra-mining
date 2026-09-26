const crypto = require("crypto");

function verifyTelegramInitData(initData) {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
        throw new Error("BOT_TOKEN is not configured");
    }

    if (!initData) {
        throw new Error("Telegram initData is required");
    }

    const params = new URLSearchParams(initData);
    const receivedHash = params.get("hash");

    if (!receivedHash) {
        throw new Error("Telegram initData hash is missing");
    }

    params.delete("hash");

    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    const secretKey = crypto
        .createHmac("sha256", "WebAppData")
        .update(botToken)
        .digest();

    const calculatedHash = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

    const receivedBuffer = Buffer.from(receivedHash, "hex");
    const calculatedBuffer = Buffer.from(calculatedHash, "hex");

    if (
        receivedBuffer.length !== calculatedBuffer.length ||
        !crypto.timingSafeEqual(receivedBuffer, calculatedBuffer)
    ) {
        throw new Error("Invalid Telegram initData");
    }

    const authDate = Number(params.get("auth_date"));

    if (!authDate) {
        throw new Error("auth_date is missing");
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60;

    if (currentTime - authDate > maxAge) {
        throw new Error("Telegram initData has expired");
    }

    const userData = params.get("user");

    if (!userData) {
        throw new Error("Telegram user data is missing");
    }

    let telegramUser;

    try {
        telegramUser = JSON.parse(userData);
    } catch (error) {
        throw new Error("Invalid Telegram user data");
    }

    if (!telegramUser.id) {
        throw new Error("Telegram user ID is missing");
    }

    return telegramUser;
}

function telegramAuth(req, res, next) {
    try {
        const initData =
            req.headers["x-telegram-init-data"] ||
            req.body?.initData;

        const telegramUser = verifyTelegramInitData(initData);

        req.telegramUser = telegramUser;

        next();
    } catch (error) {
        console.error("Telegram auth error:", error.message);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    telegramAuth,
    verifyTelegramInitData
};
