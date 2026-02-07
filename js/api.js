import { state, setServices, setBranches } from './state.js';
import { DEFAULT_API_URL } from './config.js';

export async function loadConfig(apiUrl) {
    if (!apiUrl) return null;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for config

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

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
        mode: 'no-cors',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
        body: JSON.stringify(payload)
    });
}

export async function fetchDashboardData() {
    const url = localStorage.getItem('API_URL') || DEFAULT_API_URL;
    const fetchUrl = `${url}?action=get_dashboard&limit=3000`; // Request only 3000 rows

    try {
        const controller = new AbortController();
        // 30s timeout for dashboard data (Google Script can be slow)
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        if (error.name === 'AbortError') {
            throw new Error("Request timed out. (Google Script took too long)");
        }
        throw error;
    }
}
