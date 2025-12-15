const API_BASE = 'http://localhost:8000';
let chart = null;

let liveBuffer = [];
const LIVE_BUFFER_SIZE = 120; // Keep last 120 samples (e.g., last 4 minutes if sampling every 2s)

function $(id) {
    return document.getElementById(id);
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString();
}

