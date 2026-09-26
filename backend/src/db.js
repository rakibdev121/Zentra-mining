const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

pool.on("connect", () => {
    console.log("Database connected");
});

pool.on("error", (err) => {
    console.error("Database error:", err.message);
});

module.exports = pool;
