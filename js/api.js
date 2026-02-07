import { state, setServices, setBranches } from './state.js';

export async function loadConfig(apiUrl) {
    if (!apiUrl) return null;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === 'success') {
            setServices(data.services);
            setBranches(data.branches);
            return true;
        } else {
            console.error('Error loading config:', data);
            return false;
        }
    } catch (error) {
        console.error('Connection failed:', error);
        throw error;
    }
}

export function saveData(url, payload) {
    return fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Important for Google Apps Script Web App
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
        body: JSON.stringify(payload)
    });
}

export async function fetchDashboardData() {
    // We can't really "fetch" with GET from Google Apps Script Web App easily in no-cors mode if it returns JSON 
    // unless we use JSONP or the script is deployed as "Execute as: Me" and "Who has access: Anyone".
    // Assuming standard GET request structure.

    // For now, we will try to fetch from the same URL with an action parameter.
    // Note: Google Apps Script Web App GET requests usually redirect to content.
    // If CORS is an issue, this might fail without Proxy.

    const url = localStorage.getItem('API_URL') || 'https://script.google.com/macros/s/AKfycbxfu59Q25jwh2sd0gtQIZXhwKjie8-hRGDMJeyrC6yEOK8Yx7THmAKRWwgulfwRclhrzA/exec';
    const fetchUrl = `${url}?action=get_dashboard`;

    try {
        const response = await fetch(fetchUrl);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        throw error;
    }
}
