// --- CONFIGURATION ---
const API_KEY = 'a516f166d60743ecb6a85d5e430e87a3';
const REFRESH_INTERVAL = 120000; // 2 minutes (120,000ms)

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
 * Initialize the Mini App and fetch Telegram User Data
 */
async function init() {
    // Check if running inside Telegram
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        // FEATURE: Display personalized username on the home screen
        const user = tg.initDataUnsafe?.user;
        if (user) {
            const firstName = user.first_name || "Trader";
            // Updates the <h1> span from your index.html
            const titleSpan = document.querySelector('h1 span');
            if (titleSpan) {
                titleSpan.textContent = firstName;
            }
            console.log("Mini App initialized for: " + firstName);
        }
    }

    // Initial price fetch
    const price = await fetchPrice();
    if (price) checkAllAlerts(price);
    
    // Set auto-refresh interval
    setInterval(async () => {
        const newPrice = await fetchPrice();
        if (newPrice) checkAllAlerts(newPrice);
    }, REFRESH_INTERVAL);
}

/**
 * Fetch current price from Twelve Data API
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
 * Local check for browser-based testing (non-Telegram)
 */
function checkAllAlerts(currentPrice) {
    activeAlerts.forEach((alert, index) => {
        if (alert.notificationsSent >= alert.maxNotifications) return;

        const now = Date.now();
        const intervalMs = alert.intervalMinutes * 60000;
        
        if (alert.notificationsSent > 0 && now - alert.lastNotificationTime < intervalMs) {
            return;
        }

        const isMet = alert.direction === 'up' 
            ? currentPrice >= alert.target 
            : currentPrice <= alert.target;

        if (isMet) {
            alert.notificationsSent++;
            alert.lastNotificationTime = now;
            renderAlerts();
            // Local browser alert
            alert(`${alert.asset} Alert: $${currentPrice}`);
        }
    });
}

/**
 * Render active alerts in the UI
 */
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
 * FEATURE: Set Alert and send to Telegram Bot
 */
alertBtn.addEventListener('click', async () => {
    const targetVal = parseFloat(targetInput.value);
    if (isNaN(targetVal)) return alert("Please enter a target price");

    let currentPriceText = priceEl.textContent.replace('$', '');
    let currentPrice = parseFloat(currentPriceText);
    
    if (isNaN(currentPrice)) {
        currentPrice = await fetchPrice();
    }

    if (!currentPrice) return alert("Waiting for market data... try again in a second.");
    
    const newAlert = {
        asset: assetSelect.value,
        target: targetVal,
        direction: targetVal > currentPrice ? 'up' : 'down',
        maxNotifications: parseInt(countInput.value),
        intervalMinutes: parseInt(intervalInput.value)
    };

    // --- CRITICAL FIX: Sending data back to the Telegram Bot ---
    if (window.Telegram && window.Telegram.WebApp) {
        // This method triggers 'web_app_data' in your Google Apps Script
        // Telegram automatically includes your Chat ID in the wrapper message
        window.Telegram.WebApp.sendData(JSON.stringify(newAlert));
        
        // Note: sendData usually closes the Mini App automatically
    } else {
        // Fallback for testing in a normal browser
        activeAlerts.push({
            ...newAlert,
            notificationsSent: 0,
            lastNotificationTime: 0
        });
        renderAlerts();
        console.log("Alert data (Browser Mode):", newAlert);
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

// Start the app
init();
