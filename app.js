// Configuration
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

// Initialize
async function init() {
    // 1. Identify User and Personalize UI
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        // Check for user name to personalize the welcome
        const user = tg.initDataUnsafe?.user;
        if (user) {
            const firstName = user.first_name || "Trader";
            // Optional: If you have a welcome element in your HTML, update it here
            console.log(`Welcome, ${firstName}`);
        }
    }

    const price = await fetchPrice();
    if (price) checkAllAlerts(price);
    
    setInterval(async () => {
        const newPrice = await fetchPrice();
        if (newPrice) checkAllAlerts(newPrice);
    }, REFRESH_INTERVAL);
}

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
            sendNotification(currentPrice, alert.asset);
            alert.notificationsSent++;
            alert.lastNotificationTime = now;
            renderAlerts();
        }
    });
}

function sendNotification(price, asset) {
    // WebApp alerts or browser notifications
    alert(`${asset} Alert: $${price}`);
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

// --- CRITICAL FIX FOR CHAT ID SAVING ---
alertBtn.addEventListener('click', async () => {
    const targetVal = parseFloat(targetInput.value);
    if (isNaN(targetVal)) return alert("Please enter a target price");

    let currentPrice = parseFloat(priceEl.textContent.replace('$', ''));
    if (isNaN(currentPrice)) {
        currentPrice = await fetchPrice();
    }

    if (!currentPrice) return alert("Waiting for market data...");
    
    const newAlert = {
        asset: assetSelect.value,
        target: targetVal,
        direction: targetVal > currentPrice ? 'up' : 'down',
        maxNotifications: parseInt(countInput.value),
        intervalMinutes: parseInt(intervalInput.value)
    };

    // 2. SEND DATA TO TELEGRAM BOT
    // Using sendData triggers the 'web_app_data' event in your Google Apps Script
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify(newAlert));
        // Note: sendData usually closes the Mini App automatically
    } else {
        // Fallback for browser testing
        activeAlerts.push({
            ...newAlert,
            notificationsSent: 0,
            lastNotificationTime: 0
        });
        renderAlerts();
        alert("Running outside Telegram. Alert saved locally.");
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
