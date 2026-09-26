const API_BASE_URL = "https://zentra-mining.onrender.com";

const tg = window.Telegram?.WebApp;
const initData = tg?.initData || "";
alert("Telegram initData: " + (initData ? "OK" : "MISSING"));
const telegramUserId = tg?.initDataUnsafe?.user?.id || "UNKNOWN";
console.log("TELEGRAM USER ID:", telegramUserId);

if (tg) {
    tg.ready();
    tg.expand();
}

const timer = document.querySelector("#mining-timer");
const balance = document.querySelector("#balance");
const miningStatus = document.querySelector("#mining-status");
const startButton = document.querySelector("#start-mining-btn");
const claimButton = document.querySelector("#claim-btn");

let remainingSeconds = 0;

function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [hours, minutes, secs]
        .map(v => String(v).padStart(2, "0"))
        .join(":");
}

function renderTimer() {
    if (timer) {
        timer.textContent = formatTime(remainingSeconds);
    }
}

async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "X-Telegram-Init-Data": initData,
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "API request failed");
    }

    return data;
}

async function registerUser() {
    if (!initData) {
        console.error("Telegram initData is missing");
        return false;
    }

    try {
        const data = await api("/api/users/register", {
            method: "POST"
        });

        console.log("User registered:", data);
        return true;
    } catch (error) {
        console.error("Register error:", error);
        return false;
    }
}

function updateUI(data) {
    const mining = data.mining || data;

    if (balance && mining.mining_balance !== undefined) {
        balance.textContent =
            Number(mining.mining_balance).toLocaleString();
    }

    const active = Boolean(
        mining.mining_active ??
        mining.active ??
        mining.is_active
    );

    if (miningStatus) {
        miningStatus.textContent =
            active ? "MINING ACTIVE" : "MINING INACTIVE";
    }

    if (startButton) {
        startButton.style.display = active ? "none" : "block";
    }

    if (mining.remaining_minutes !== undefined) {
        remainingSeconds =
            Math.max(0, Number(mining.remaining_minutes) * 60);
    }

    renderTimer();

    if (mining.claimable > 0 || mining.remaining_minutes === 0) {
        claimButton.disabled = false;
        claimButton.textContent = "CLAIM 1,440 ZNT";
    } else {
        claimButton.disabled = true;
        claimButton.textContent = "CLAIM NOT READY";
    }
}

async function loadMiningStatus() {
    try {
        const data = await api("/api/mining/status");
        console.log("Mining status:", data);
        updateUI(data);
    } catch (error) {
        console.error("Mining status error:", error);
    }
}

startButton?.addEventListener("click", async () => {
    try {
        startButton.disabled = true;
        startButton.textContent = "STARTING...";

        const registered = await registerUser();

        if (!registered) {
            throw new Error("User registration failed");
        }

        const data = await api("/api/mining/start", {
            method: "POST"
        });

        console.log("Mining started:", data);

        await loadMiningStatus();

    } catch (error) {
        console.error(error);
        alert(error.message);

        startButton.disabled = false;
        startButton.textContent = "START MINING";
    }
});

claimButton?.addEventListener("click", async () => {
    try {
        claimButton.disabled = true;
        claimButton.textContent = "CLAIMING...";

        const data = await api("/api/mining/claim", {
            method: "POST"
        });

        alert(
            `Claim successful!\n\nClaimed: ${data.claimed_amount} ZNT`
        );

        await loadMiningStatus();

    } catch (error) {
        console.error(error);
        alert(error.message);
        await loadMiningStatus();
    }
});

async function initializeApp() {
    const registered = await registerUser();

    if (registered) {
        await loadMiningStatus();
    }
}

initializeApp();

setInterval(() => {
    if (remainingSeconds > 0) {
        remainingSeconds--;
        renderTimer();
    }
}, 1000);

setInterval(loadMiningStatus, 30000);
