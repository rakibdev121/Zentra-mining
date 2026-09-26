require("dotenv").config();

const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/user");
const miningRoutes = require("./routes/mining");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", userRoutes);
app.use("/api/mining", miningRoutes);

app.get("/", (req, res) => {
    res.json({
        project: "Zentra",
        status: "online",
        message: "Zentra Backend API is running"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "Zentra API"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Zentra API running on port ${PORT}`);
});
