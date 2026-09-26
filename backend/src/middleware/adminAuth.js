const crypto = require("crypto");

function adminAuth(req, res, next) {
    const provided = req.headers["x-admin-secret"];
    const expected = process.env.ADMIN_SECRET;

    if (!provided || !expected) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));

    if (a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    next();
}

module.exports = { adminAuth };
