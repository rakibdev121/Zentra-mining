const API_BASE_URL = "https://zentra-mining.onrender.com";

const tg = window.Telegram?.WebApp;
const initData = tg?.initData || "";

if (tg) {
    tg.ready();
    tg.expand();
}

const timer = document.querySelector(".mining-ring strong");
const claimButton = document.querySelector(".claim-btn");

function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [hours, minutes, secs]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
}

async function api(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "API request failed");
    }

    return data;
}

async function startMining() {
    try {
        const data = await api("/api/mining/start", {
            method: "POST"
        });

        console.log("Mining started:", data);
        await loadMiningStatus();

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

async function loadMiningStatus() {
    try {
        const data = await api("/api/mining/status");

        console.log("Mining status:", data);

        if (data.mining) {
            const mining = data.mining;

            if (typeof mining.remaining_seconds === "number") {
                updateTimer(mining.remaining_seconds);
            }
        }

    } catch (error) {
        console.error("Mining status error:", error);
    }
}

function updateTimer(seconds) {
    timer.textContent = formatTime(seconds);
}

claimButton.addEventListener("click", async () => {
    try {
        claimButton.disabled = true;
        claimButton.textContent = "CLAIMING...";

        const data = await api("/api/mining/claim", {
            method: "POST"
        });

        alert(
            `Claim successful!\n\nClaimed: ${data.claimed} ZNT`
        );

        await loadMiningStatus();

    } catch (error) {
        console.error(error);
        alert(error.message);
        claimButton.disabled = false;
        claimButton.textContent = "CLAIM";
    }
});

loadMiningStatus();
