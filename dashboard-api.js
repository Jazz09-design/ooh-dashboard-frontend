// =============================
// dashboard-api.js (Browser Script)
// Dipakai via <script src="./dashboard-api.js"></script>
// Jadi: JANGAN pakai export/import (bukan module).
//
// Menyediakan helper API yang aman untuk:
// - Local (localhost) maupun deploy (Vercel/Netlify)
// - Same-origin (recommended) atau api subdomain.
// =============================

(function () {
  const CFG = window.APP_CONFIG || {};

  // 1) Tentukan API base
  // Prioritas:
  // - CFG.API_BASE_URL (mis: "https://api.project-asliku.com" atau "")
  // - inferred (ganti subdomain jadi api.*)
  // - default "" (same-origin)
  const inferredApiBase = (() => {
    try {
      const host = window.location.hostname;
      const isLocal = host === "localhost" || host === "127.0.0.1";
      if (isLocal) return ""; // di local, biasanya FE & BE same origin via proxy / serve

      // media-analitik.project-asliku.com -> api.project-asliku.com
      const parts = host.split(".");
      if (parts.length >= 3) parts[0] = "api";
      else parts.unshift("api");
      return `https://${parts.join(".")}`;
    } catch (e) {
      return "";
    }
  })();

  const API_BASE = String(
    CFG.API_BASE_URL ?? inferredApiBase ?? ""
  ).replace(/\/+$/, "");

  async function apiGet(path) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  // 2) Expose ke global (dipakai optional)
  window.DashboardAPI = {
    apiGet,
    getFilters: () => apiGet("/api/dashboard/filters"),
    getOverview: (params) => apiGet(`/api/dashboard/overview?${new URLSearchParams(params).toString()}`),
    getTraffic: (params) => apiGet(`/api/dashboard/traffic?${new URLSearchParams(params).toString()}`),
    getDemography: (params) => apiGet(`/api/dashboard/demography?${new URLSearchParams(params).toString()}`),
  };

  // Debug ringan (biar gampang cek di console)
  window.__API_BASE = API_BASE;
})();
