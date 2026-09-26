const API_BASE_URL = "https://zentra-mining.onrender.com";

const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const initData = tg?.initData || "";

const telegramUser =
    tg?.initDataUnsafe?.user || null;

const telegramUserId =
    telegramUser?.id || null;

console.log("Zentra Telegram User:", telegramUser);
console.log("Telegram ID:", telegramUserId);
console.log("InitData:", initData ? "OK" : "MISSING");

const timer =
    document.querySelector("#mining-timer");

const balance =
    document.querySelector("#balance");

const miningStatus =
    document.querySelector("#mining-status");

const startButton =
    document.querySelector("#start-mining-btn");

const claimButton =
    document.querySelector("#claim-btn");

let remainingSeconds = 0;


// =========================
// Telegram notification
// =========================

function notify(message) {

    if (tg?.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}


// =========================
// Time formatter
// =========================

function formatTime(seconds) {

    seconds = Math.max(0, Math.floor(seconds));

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor((seconds % 3600) / 60);

    const secs =
        seconds % 60;

    return [
        hours,
        minutes,
        secs
    ]
        .map(v => String(v).padStart(2, "0"))
        .join(":");
}


// =========================
// Timer
// =========================

function renderTimer() {

    if (timer) {
        timer.textContent =
            formatTime(remainingSeconds);
    }
}


// =========================
// API
// =========================

async function api(path, options = {}) {

    if (!initData) {
        throw new Error(
            "Telegram authentication data missing."
        );
    }

    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            ...options,

            headers: {
                "Content-Type":
                    "application/json",

                "X-Telegram-Init-Data":
                    initData,

                ...(options.headers || {})
            }
        }
    );

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            "Invalid server response."
        );
    }

    if (!response.ok) {

        throw new Error(
            data.message ||
            "API request failed."
        );
    }

    return data;
}


// =========================
// Register user
// =========================

async function registerUser() {

    try {

        const data =
            await api(
                "/api/users/register",
                {
                    method: "POST"
                }
            );

        console.log(
            "User registered:",
            data
        );

        return true;

    } catch (error) {

        console.error(
            "Register error:",
            error
        );

        return false;
    }
}


// =========================
// Update UI
// =========================

function updateUI(data) {

    const mining =
        data.mining || data;

    if (
        balance &&
        mining.mining_balance !== undefined
    ) {

        balance.textContent =
            Number(
                mining.mining_balance
            ).toLocaleString(
                undefined,
                {
                    maximumFractionDigits: 6
                }
            );
    }


    const active =
        Boolean(
            mining.mining_active ??
            mining.active ??
            mining.is_active
        );


    if (miningStatus) {

        miningStatus.textContent =
            active
                ? "MINING ACTIVE"
                : "MINING INACTIVE";
    }


    if (startButton) {

        startButton.style.display =
            active
                ? "none"
                : "block";
    }


    if (
        mining.remaining_minutes !==
        undefined
    ) {

        remainingSeconds =
            Math.max(
                0,
                Number(
                    mining.remaining_minutes
                ) * 60
            );
    }


    renderTimer();


    const claimable =
        Number(
            mining.claimable || 0
        );


    if (
        claimable > 0 ||
        remainingSeconds === 0
    ) {

        claimButton.disabled = false;

        claimButton.textContent =
            "CLAIM 1,440 ZNT";

    } else {

        claimButton.disabled = true;

        claimButton.textContent =
            "CLAIM NOT READY";
    }
}


// =========================
// Load mining status
// =========================

async function loadMiningStatus() {

    try {

        const data =
            await api(
                "/api/mining/status"
            );

        console.log(
            "Mining status:",
            data
        );

        updateUI(data);

    } catch (error) {

        console.error(
            "Mining status error:",
            error
        );

        if (miningStatus) {
            miningStatus.textContent =
                "SERVER ERROR";
        }
    }
}


// =========================
// Start mining
// =========================

startButton?.addEventListener(
    "click",
    async () => {

        try {

            startButton.disabled =
                true;

            startButton.textContent =
                "STARTING...";


            const registered =
                await registerUser();


            if (!registered) {

                throw new Error(
                    "User registration failed."
                );
            }


            const data =
                await api(
                    "/api/mining/start",
                    {
                        method: "POST"
                    }
                );


            console.log(
                "Mining started:",
                data
            );


            await loadMiningStatus();

        } catch (error) {

            console.error(error);

            notify(
                error.message
            );

            startButton.disabled =
                false;

            startButton.textContent =
                "START MINING";
        }
    }
);


// =========================
// Claim mining reward
// =========================

claimButton?.addEventListener(
    "click",
    async () => {

        try {

            claimButton.disabled =
                true;

            claimButton.textContent =
                "CLAIMING...";


            const data =
                await api(
                    "/api/mining/claim",
                    {
                        method: "POST"
                    }
                );


            notify(
                `Claim successful!\n\nClaimed: ${data.claimed_amount} ZNT`
            );


            await loadMiningStatus();

        } catch (error) {

            console.error(error);

            notify(
                error.message
            );

            await loadMiningStatus();
        }
    }
);


// =========================
// Navigation
// =========================

function setActive(button) {

    document
        .querySelectorAll(
            ".bottom-nav button"
        )
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );
        });


    button.classList.add(
        "active"
    );
}


document
    .querySelector("#home-btn")
    ?.addEventListener(
        "click",
        () => {

            setActive(
                document.querySelector(
                    "#home-btn"
                )
            );

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );


document
    .querySelector("#mining-btn")
    ?.addEventListener(
        "click",
        () => {

            setActive(
                document.querySelector(
                    "#mining-btn"
                )
            );

            document
                .querySelector(
                    ".mining-card"
                )
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        }
    );


document
    .querySelector("#referral-btn")
    ?.addEventListener(
        "click",
        () => {

            setActive(
                document.querySelector(
                    "#referral-btn"
                )
            );

            notify(
                "Referral system coming soon."
            );
        }
    );


document
    .querySelector("#wallet-btn")
    ?.addEventListener(
        "click",
        () => {

            setActive(
                document.querySelector(
                    "#wallet-btn"
                )
            );

            notify(
                "Wallet system coming soon."
            );
        }
    );


document
    .querySelector("#referral-card")
    ?.addEventListener(
        "click",
        () => {

            notify(
                "Referral system coming soon."
            );
        }
    );


document
    .querySelector("#wallet-card")
    ?.addEventListener(
        "click",
        () => {

            notify(
                "Wallet system coming soon."
            );
        }
    );


document
    .querySelector("#profile-btn")
    ?.addEventListener(
        "click",
        () => {

            notify(
                telegramUser
                    ? `Telegram ID: ${telegramUser.id}`
                    : "Telegram user not detected."
            );
        }
    );


// =========================
// Initialize
// =========================

async function initializeApp() {

    console.log(
        "Initializing Zentra..."
    );


    if (!initData) {

        if (miningStatus) {

            miningStatus.textContent =
                "OPEN INSIDE TELEGRAM";
        }

        notify(
            "Please open Zentra from Telegram."
        );

        return;
    }


    const registered =
        await registerUser();


    if (registered) {

        await loadMiningStatus();

    } else {

        if (miningStatus) {

            miningStatus.textContent =
                "SERVER ERROR";
        }
    }
}


initializeApp();


// =========================
// Local countdown
// =========================

setInterval(
    () => {

        if (remainingSeconds > 0) {

            remainingSeconds--;

            renderTimer();
        }

    },
    1000
);


// Refresh status every 30 sec

setInterval(
    loadMiningStatus,
    30000
);
