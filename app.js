const API_BASE_URL =
    "https://zentra-mining.onrender.com";

const tg =
    window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const initData =
    tg?.initData || "";

const telegramUser =
    tg?.initDataUnsafe?.user || null;


// =========================
// Elements
// =========================

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


// =========================
// Mining state
// =========================

let remainingSeconds = 0;

let liveBalance = 0;

let miningActive = false;


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
// Format time
// =========================

function formatTime(seconds) {

    seconds =
        Math.max(
            0,
            Math.floor(seconds)
        );

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const secs =
        seconds % 60;

    return [
        hours,
        minutes,
        secs
    ]
        .map(
            value =>
                String(value).padStart(2, "0")
        )
        .join(":");
}


// =========================
// Render
// =========================

function renderUI() {

    if (balance) {

        balance.textContent =
            Number(liveBalance)
                .toLocaleString(
                    undefined,
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                    }
                );
    }

    if (timer) {

        timer.textContent =
            formatTime(
                remainingSeconds
            );
    }

    if (miningStatus) {

        miningStatus.textContent =
            miningActive
                ? "MINING ACTIVE"
                : "MINING INACTIVE";
    }

    if (startButton) {

        startButton.style.display =
            miningActive
                ? "none"
                : "block";
    }

    if (claimButton) {

        claimButton.disabled =
            remainingSeconds > 0;

        claimButton.textContent =
            remainingSeconds <= 0
                ? "CLAIM 1,440 ZNT"
                : "CLAIM NOT READY";
    }
}


// =========================
// API
// =========================

async function api(
    path,
    options = {}
) {

    if (!initData) {

        throw new Error(
            "Please open Zentra inside Telegram."
        );
    }

    const response =
        await fetch(
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
        data =
            await response.json();
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
// Register
// =========================

async function registerUser() {

    try {

        await api(
            "/api/users/register",
            {
                method: "POST"
            }
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
// Load mining status
// =========================

async function loadMiningStatus() {

    try {

        const data =
            await api(
                "/api/mining/status"
            );

        const mining =
            data.mining || data;

        miningActive =
            Boolean(
                mining.mining_active
            );

        remainingSeconds =
            Number(
                mining.remaining_seconds ??
                (
                    Number(
                        mining.remaining_minutes || 0
                    ) * 60
                )
            );

        liveBalance =
            Number(
                mining.live_balance ??
                mining.mining_balance ??
                0
            );

        renderUI();

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

            await api(
                "/api/mining/start",
                {
                    method: "POST"
                }
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
// Claim
// =========================

claimButton?.addEventListener(
    "click",
    async () => {

        if (remainingSeconds > 0) {
            return;
        }

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
                `Claim successful!\n\n+${data.claimed_amount} ZNT`
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
// Home
// =========================

document
    .querySelector("#home-btn")
    ?.addEventListener(
        "click",
        () => {

            document
                .querySelectorAll(
                    ".bottom-nav button"
                )
                .forEach(
                    btn =>
                        btn.classList.remove(
                            "active"
                        )
                );

            document
                .querySelector("#home-btn")
                ?.classList.add(
                    "active"
                );

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );


// =========================
// Mining navigation
// =========================

document
    .querySelector("#mining-btn")
    ?.addEventListener(
        "click",
        () => {

            document
                .querySelectorAll(
                    ".bottom-nav button"
                )
                .forEach(
                    btn =>
                        btn.classList.remove(
                            "active"
                        )
                );

            document
                .querySelector("#mining-btn")
                ?.classList.add(
                    "active"
                );

            document
                .querySelector(".mining-card")
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        }
    );


// =========================
// Referral
// =========================

document
    .querySelector("#referral-btn")
    ?.addEventListener(
        "click",
        () => {

            document
                .querySelectorAll(
                    ".bottom-nav button"
                )
                .forEach(
                    btn =>
                        btn.classList.remove(
                            "active"
                        )
                );

            document
                .querySelector("#referral-btn")
                ?.classList.add(
                    "active"
                );

            document
                .querySelector("#referral-panel")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
        }
    );


// =========================
// Wallet
// =========================

document
    .querySelector("#wallet-btn")
    ?.addEventListener(
        "click",
        () => {

            notify(
                "Wallet / Claim DApp coming soon."
            );
        }
    );


// =========================
// Profile
// =========================

document
    .querySelector("#profile-btn")
    ?.addEventListener(
        "click",
        () => {

            if (telegramUser) {

                notify(
                    `Telegram ID: ${telegramUser.id}`
                );

            } else {

                notify(
                    "Telegram user not detected."
                );
            }
        }
    );


// =========================
// Initialize
// =========================

async function initializeApp() {

    if (!initData) {

        if (miningStatus) {
            miningStatus.textContent =
                "OPEN INSIDE TELEGRAM";
        }

        return;
    }

    const registered =
        await registerUser();

    if (registered) {
        await loadMiningStatus();
    }
}


initializeApp();


// =========================
// LIVE MINING
// =========================

setInterval(
    () => {

        if (
            miningActive &&
            remainingSeconds > 0
        ) {

            remainingSeconds--;

            // 1 ZNT per minute
            // = 1/60 ZNT per second

            liveBalance +=
                1 / 60;

            renderUI();
        }

    },
    1000
);


// =========================
// Server sync
// =========================

setInterval(
    loadMiningStatus,
    30000
);


// =================================
// ZENTRA REFERRAL SYSTEM
// =================================

const referralCount =
    document.querySelector("#referral-count");

const referralEarned =
    document.querySelector("#referral-earned");

const referralLink =
    document.querySelector("#referral-link");

const copyReferralButton =
    document.querySelector("#copy-referral-btn");

const shareReferralButton =
    document.querySelector("#share-referral-btn");

async function loadReferralInfo() {
    try {
        const data =
            await api("/api/referral/info");

        if (!data.success) {
            return;
        }

        const referral =
            data.referral || {};

        if (referralCount) {
            referralCount.textContent =
                Number(
                    referral.referral_count || 0
                ).toLocaleString();
        }

        if (referralEarned) {
            referralEarned.textContent =
                `${Number(
                    referral.referral_earned || 0
                ).toLocaleString()} Zentra earned`;
        }

        if (telegramUser && referralLink) {

            const botUsername =
                "Zentra163bot";

            referralLink.value =
                `https://t.me/${botUsername}?startapp=ref_${telegramUser.id}`;
        }

    } catch (error) {

        console.error(
            "Referral info error:",
            error
        );
    }
}


// COPY REFERRAL LINK

copyReferralButton?.addEventListener(
    "click",
    async () => {

        if (!referralLink?.value) {
            return;
        }

        try {

            await navigator.clipboard.writeText(
                referralLink.value
            );

            notify(
                "Referral link copied! 🎁"
            );

        } catch {

            referralLink.select();

            document.execCommand("copy");

            notify(
                "Referral link copied! 🎁"
            );
        }
    }
);


// SHARE REFERRAL LINK

shareReferralButton?.addEventListener(
    "click",
    () => {

        if (!referralLink?.value) {
            return;
        }

        const text =
            "Join Zentra and earn Zentra Tokens! 🎁";

        const shareUrl =
            `https://t.me/share/url?url=${encodeURIComponent(
                referralLink.value
            )}&text=${encodeURIComponent(
                text
            )}`;

        if (tg?.openTelegramLink) {
            tg.openTelegramLink(shareUrl);
        } else {
            window.open(
                shareUrl,
                "_blank"
            );
        }
    }
);


// Referral card click

document
    .querySelector("#referral-card")
    ?.addEventListener(
        "click",
        () => {

            document
                .querySelector("#referral-panel")
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        }
    );


// Load referral information

if (initData) {
    loadReferralInfo();
}



// =================================
// TELEGRAM REFERRAL START PARAM
// =================================

function getReferralCode() {

    const startParam =
        tg?.initDataUnsafe?.start_param || "";

    if (
        startParam &&
        startParam.startsWith("ref_")
    ) {
        return startParam.substring(4);
    }

    return null;
}


async function processReferral() {

    const referralCode =
        getReferralCode();

    if (!referralCode) {
        return;
    }

    try {

        const data =
            await api(
                "/api/referral/process",
                {
                    method: "POST",
                    body: JSON.stringify({
                        referral_code:
                            referralCode
                    })
                }
            );

        if (
            data.success &&
            data.reward
        ) {
            console.log(
                `Referral successful: +${data.reward} Zentra`
            );

            await loadReferralInfo();
        }

    } catch (error) {

        console.error(
            "Referral process error:",
            error
        );
    }
}


// Process referral after Telegram auth is ready

if (initData) {
    processReferral();
}

