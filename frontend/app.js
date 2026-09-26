const CLAIM_TIME = 24 * 60 * 60;

let remainingSeconds = CLAIM_TIME;

const timer = document.querySelector(".mining-ring strong");
const claimButton = document.querySelector(".claim-btn");

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [
        hours,
        minutes,
        secs
    ]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
}

function updateMiningUI() {
    timer.textContent = formatTime(remainingSeconds);

    if (remainingSeconds <= 0) {
        timer.textContent = "READY";
        claimButton.disabled = false;
        claimButton.textContent = "CLAIM 1,440 ZNT";
        return;
    }

    claimButton.disabled = true;
    claimButton.textContent = "CLAIM NOT READY";

    remainingSeconds--;
}

claimButton.addEventListener("click", () => {
    if (remainingSeconds > 0) return;

    alert("Claim system will connect to the Zentra backend.");
});

updateMiningUI();

setInterval(updateMiningUI, 1000);
