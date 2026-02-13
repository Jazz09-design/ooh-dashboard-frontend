
// =============================
// dashboard-api.js (FIXED VERSION)
// Production-safe API base detection
// =============================

const CFG = window.APP_CONFIG || {};

// Local development default
const DEFAULT_LOCAL_API = "http://localhost:3000";

// Auto-detect production API domain
const inferredApiBase = (() => {
  try {
    if (typeof window === "undefined") return null;

    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";

    if (isLocal) return null;

    // Example:
    // media-analitik.project-asliku.com
    // → api.project-asliku.com
    const parts = host.split(".");

    if (parts.length >= 3) {
      parts[0] = "api";
    } else {
      parts.unshift("api");
    }

    return `https://${parts.join(".")}`;
  } catch (e) {
    return null;
  }
})();

const API_BASE = String(
  CFG.API_BASE_URL || inferredApiBase || DEFAULT_LOCAL_API
).replace(/\/+$/, "");

// Helper fetch wrapper
async function apiGet(path) {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  return res.json();
}

// =============================
// API FUNCTIONS
// =============================

export async function getFilters() {
  return apiGet("/api/dashboard/filters");
}

export async function getOverview(params) {
  const query = new URLSearchParams(params).toString();
  return apiGet(`/api/dashboard/overview?${query}`);
}

export async function getTraffic(params) {
  const query = new URLSearchParams(params).toString();
  return apiGet(`/api/dashboard/traffic?${query}`);
}

export async function getDemography(params) {
  const query = new URLSearchParams(params).toString();
  return apiGet(`/api/dashboard/demography?${query}`);
}
