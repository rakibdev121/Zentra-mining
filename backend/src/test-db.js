require("dotenv").config();

const pool = require("./db");

async function testDatabase() {
    try {
        const result = await pool.query("SELECT NOW() AS time");

        console.log("✅ Database connected!");
        console.log("🕒 Database time:", result.rows[0].time);

        await pool.end();
    } catch (error) {
        console.error("❌ Database connection failed!");
        console.error(error.message);

        process.exit(1);
    }
}

testDatabase();
