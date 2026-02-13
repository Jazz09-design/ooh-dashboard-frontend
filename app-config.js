// ===============================
// APP CONFIG - PRODUCTION
// ===============================

// GANTI BASE URL KE BACKEND PRODUCTION
const API_BASE = "https://outdoor-dashboard-api-vercel.vercel.app";
// Kalau backend masih pakai domain default Vercel,
// pakai ini:
// const API_BASE = "https://ooh-dashboard-backend.vercel.app";


// ===============================
// HELPER FETCH
// ===============================
async function apiFetch(path) {
  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API ERROR:", err);
    throw err;
  }
}


// ===============================
// ENDPOINT WRAPPERS
// ===============================
function getKpi(params) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/dashboard/kpi?${query}`);
}

function getOverview(params) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/dashboard/overview?${query}`);
}

function getTraffic(params) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/dashboard/traffic?${query}`);
}

function getDemography(params) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/dashboard/demography?${query}`);
}

function getFilters() {
  return apiFetch(`/api/dashboard/filters`);
}
