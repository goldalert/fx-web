// --- CONFIGURATION ---
const API_KEY = 'a516f166d60743ecb6a85d5e430e87a3';
const REFRESH_INTERVAL = 120000; // 2 minutes

let activeAlerts = [];

// DOM Elements
const priceEl = document.getElementById('current-price');
const updateEl = document.getElementById('last-updated');
const targetInput = document.getElementById('target-price');
const alertBtn = document.getElementById('set-alert-btn');
const alertsList = document.getElementById('alerts-list');
const assetSelect = document.getElementById('asset-select');
const countInput = document.getElementById('notification-count');
const intervalInput = document.getElementById('notification-interval');
const toast = document.getElementById('notification-toast');
const activeAlertsContainer = document.getElementById('active-alerts-container');

/**
 * Initialize Mini App and retrieve Telegram User Data
 */
async function init() {
    // Check if Telegram WebApp is available
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        // DISPLAY USERNAME: Grabs the first name from Telegram profile
        const user = tg.initDataUnsafe?.user;
        if (user) {
            const firstName = user.first_name || "Trader";
            // Update the span in your <h1> tag
            const nameDisplay = document.querySelector('h1 span');
            if (nameDisplay) {
                nameDisplay.textContent = firstName;
            }
        }
    }

    const price = await fetchPrice();
    if (price) checkAllAlerts(price);
    
    // Set auto-refresh
    setInterval(async () => {
        const newPrice = await fetchPrice();
        if (newPrice) checkAllAlerts(newPrice);
    }, REFRESH_INTERVAL);
}

/**
 * Fetch current price from API
 */
async function fetchPrice() {
    try {
        const symbol = assetSelect.value;
        const response = await fetch(`https://api.twelvedata.com/price?symbol=${symbol}&apikey=${API_KEY}`);
        const data = await response.json();
        
        if (data.price) {
            const price = parseFloat(data.price).toFixed(2);
            updateUI(price);
            return parseFloat(price);
        }
    } catch (error) {
        console.error("Failed to fetch price:", error);
        priceEl.textContent = "Error";
    }
    return null;
}

function updateUI(price) {
    priceEl.textContent = `$${price}`;
    const now = new Date();
    updateEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

/**
 * Local UI rendering and checks
 */
function checkAllAlerts(currentPrice) {
    activeAlerts.forEach((alert) => {
        if (alert.notificationsSent >= alert.maxNotifications) return;

        const isMet = alert.direction === 'up' 
            ? currentPrice >= alert.target 
            : currentPrice <= alert.target;

        if (isMet) {
            alert.notificationsSent++;
            renderAlerts();
        }
    });
}

function renderAlerts() {
    alertsList.innerHTML = '';
    if (activeAlerts.length === 0) {
        activeAlertsContainer.classList.add('hidden');
        return;
    }
    activeAlertsContainer.classList.remove('hidden');
    
    activeAlerts.forEach((alert, index) => {
        const item = document.createElement('div');
        item.className = 'alert-item';
        const status = alert.notificationsSent >= alert.maxNotifications ? '✅ Done' : `🔔 ${alert.notificationsSent}/${alert.maxNotifications}`;
        item.innerHTML = `
            <div>
                <strong>${alert.asset} at $${alert.target}</strong><br>
                <small>Go ${alert.direction} | ${status}</small>
            </div>
            <button class="delete-btn" onclick="removeAlert(${index})">×</button>
        `;
        alertsList.appendChild(item);
    });
}

window.removeAlert = (index) => {
    activeAlerts.splice(index, 1);
    renderAlerts();
};

/**
 * Handle Set Alert Click
 */
alertBtn.addEventListener('click', async () => {
    const targetVal = parseFloat(targetInput.value);
    if (isNaN(targetVal)) return alert("Please enter a target price");

    let currentPriceText = priceEl.textContent.replace('$', '');
    let currentPrice = parseFloat(currentPriceText);
    
    if (isNaN(currentPrice)) {
        currentPrice = await fetchPrice();
    }

    if (!currentPrice) return alert("Waiting for market data...");
    
    const alertData = {
        asset: assetSelect.value,
        target: targetVal,
        direction: targetVal > currentPrice ? 'up' : 'down',
        maxNotifications: parseInt(countInput.value),
        intervalMinutes: parseInt(intervalInput.value)
    };

    // --- FIX: SEND DATA TO TELEGRAM BOT ---
    if (window.Telegram && window.Telegram.WebApp) {
        // Automatically includes user context/Chat ID
        window.Telegram.WebApp.sendData(JSON.stringify(alertData));
    } else {
        // Browser fallback
        activeAlerts.push({ ...alertData, notificationsSent: 0, lastNotificationTime: 0 });
        renderAlerts();
        alert("Running outside Telegram. ID not sent.");
    }

    targetInput.value = '';
    showSuccessToast();
});

function showSuccessToast() {
    toast.classList.remove('toast-hidden');
    setTimeout(() => {
        toast.classList.add('toast-hidden');
    }, 3000);
}

init();
