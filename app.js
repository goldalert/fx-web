// Configuration
const API_KEY = 'a516f166d60743ecb6a85d5e430e87a3'; 
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyK5X1Oe-aPWbFMO7U9aS0EH5PhLRJfb8jxRZOYIsqhiJcYEp7WmAZ5AaRiGD_4rZAm0A/exec';
const REFRESH_INTERVAL = 120000; // Updated to 2 minutes (120,000ms) for safer API usage

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
const assetLabel = document.getElementById('asset-label');
const toast = document.getElementById('notification-toast');
const activeAlertsContainer = document.getElementById('active-alerts-container');

// Initialize
async function init() {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand(); // Good for mobile users
    }

    if ("Notification" in window) {
        await Notification.requestPermission();
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
    if (Notification.permission === "granted") {
        new Notification(`${asset} Price Alert!`, {
            body: `${asset} has reached your target! Current price: $${price}`,
            icon: "https://cdn-icons-png.flaticon.com/512/272/272530.png"
        });
    } else {
        alert(`${asset} Alert: $${price}`);
    }
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

alertBtn.addEventListener('click', async () => {
    const targetVal = parseFloat(targetInput.value);
    if (isNaN(targetVal)) return alert("Please enter a target price");

    // Instantly determine direction using UI price to avoid API delay/failure blocking
    let currentPrice = parseFloat(priceEl.textContent.replace('$', ''));
    
    if (isNaN(currentPrice)) {
        currentPrice = await fetchPrice();
    }

    if (!currentPrice) return alert("Waiting for market data... try again in a second.");
    
    const newAlert = {
        asset: assetSelect.value,
        target: targetVal,
        direction: targetVal > currentPrice ? 'up' : 'down',
        maxNotifications: parseInt(countInput.value),
        intervalMinutes: parseInt(intervalInput.value),
        notificationsSent: 0,
        lastNotificationTime: 0
    };

    activeAlerts.push(newAlert);

    // Send data to Google Apps Script so it can be saved in Google Sheets
    if (window.Telegram && window.Telegram.WebApp) {
        const telegramData = window.Telegram.WebApp.initDataUnsafe;
        console.log("Telegram.WebApp.initDataUnsafe:", telegramData); // Log the full object
        
        // Ensure we capture the ID accurately
        let chatId = telegramData.user ? telegramData.user.id : null;

        console.log("Captured Chat ID:", chatId);

        if (!chatId) {
            alert("User ID not found! Please make sure you are opening this app from the Telegram Bot menu.");
            return; // Don't proceed without an ID
        }

        const payload = {
            ...newAlert,
            chatId: chatId,
            isAppRequest: true
        };

        fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // Required for Google Apps Script cross-origin POST
            body: JSON.stringify(payload)
        });
    }

    renderAlerts();
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
