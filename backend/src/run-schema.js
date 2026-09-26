require("dotenv").config();

const fs = require("fs");
const pool = require("./db");

async function runSchema() {
    try {
        const sql = fs.readFileSync("./src/schema.sql", "utf8");

        await pool.query(sql);

        console.log("✅ Database schema created successfully!");
        console.log("✅ users table created");
        console.log("✅ claims table created");
        console.log("✅ indexes created");

        await pool.end();
    } catch (error) {
        console.error("❌ Schema creation failed!");
        console.error(error.message);

        await pool.end();
        process.exit(1);
    }
}

runSchema();
