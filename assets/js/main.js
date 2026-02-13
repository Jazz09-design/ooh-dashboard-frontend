/**
 * Main
 */

'use strict';

let menu,
  animate;
document.addEventListener('DOMContentLoaded', function () {
  // class for ios specific styles
  if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
    document.body.classList.add('ios');
  }
});

(function () {
  // Initialize menu
  //-----------------

  let layoutMenuEl = document.querySelectorAll('#layout-menu');
  layoutMenuEl.forEach(function (element) {
    menu = new Menu(element, {
      orientation: 'vertical',
      closeChildren: false
    });
    // Change parameter to true if you want scroll animation
    window.Helpers.scrollToActive((animate = false));
    window.Helpers.mainMenu = menu;
  });

  // Initialize menu togglers and bind click on each
  let menuToggler = document.querySelectorAll('.layout-menu-toggle');
  menuToggler.forEach(item => {
    item.addEventListener('click', event => {
      event.preventDefault();
      window.Helpers.toggleCollapsed();
    });
  });

  // Display menu toggle (layout-menu-toggle) on hover with delay
  let delay = function (elem, callback) {
    let timeout = null;
    elem.onmouseenter = function () {
      // Set timeout to be a timer which will invoke callback after 300ms (not for small screen)
      if (!Helpers.isSmallScreen()) {
        timeout = setTimeout(callback, 300);
      } else {
        timeout = setTimeout(callback, 0);
      }
    };

    elem.onmouseleave = function () {
      // Clear any timers set to timeout
      document.querySelector('.layout-menu-toggle').classList.remove('d-block');
      clearTimeout(timeout);
    };
  };
  if (document.getElementById('layout-menu')) {
    delay(document.getElementById('layout-menu'), function () {
      // not for small screen
      if (!Helpers.isSmallScreen()) {
        document.querySelector('.layout-menu-toggle').classList.add('d-block');
      }
    });
  }

  // Display in main menu when menu scrolls
  let menuInnerContainer = document.getElementsByClassName('menu-inner'),
    menuInnerShadow = document.getElementsByClassName('menu-inner-shadow')[0];
  if (menuInnerContainer.length > 0 && menuInnerShadow) {
    menuInnerContainer[0].addEventListener('ps-scroll-y', function () {
      if (this.querySelector('.ps__thumb-y').offsetTop) {
        menuInnerShadow.style.display = 'block';
      } else {
        menuInnerShadow.style.display = 'none';
      }
    });
  }

  // Init helpers & misc
  // --------------------

  // Init BS Tooltip
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Accordion active class
  const accordionActiveFunction = function (e) {
    if (e.type == 'show.bs.collapse' || e.type == 'show.bs.collapse') {
      e.target.closest('.accordion-item').classList.add('active');
    } else {
      e.target.closest('.accordion-item').classList.remove('active');
    }
  };

  const accordionTriggerList = [].slice.call(document.querySelectorAll('.accordion'));
  const accordionList = accordionTriggerList.map(function (accordionTriggerEl) {
    accordionTriggerEl.addEventListener('show.bs.collapse', accordionActiveFunction);
    accordionTriggerEl.addEventListener('hide.bs.collapse', accordionActiveFunction);
  });

  // Auto update layout based on screen size
  window.Helpers.setAutoUpdate(true);

  // Toggle Password Visibility
  window.Helpers.initPasswordToggle();

  // Speech To Text
  window.Helpers.initSpeechToText();

  // Manage menu expanded/collapsed with templateCustomizer & local storage
  //------------------------------------------------------------------

  // If current layout is horizontal OR current window screen is small (overlay menu) than return from here
  if (window.Helpers.isSmallScreen()) {
    return;
  }

  // If current layout is vertical and current window screen is > small

  // Auto update menu collapsed/expanded based on the themeConfig
      window.Helpers.setCollapsed(true, false);
})();
// Utils
function isMacOS() {
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
}


// =============================
// Outdoor Media Dashboard - API wiring (classic script, NOT module)
// Tujuan:
// - Pastikan dropdown filters terisi dari backend (/api/filters atau /api/dashboard/filters)
// - Aman untuk Safari (tanpa export/import)
// - Bisa dipakai walaupun halaman tidak memuat dashboard-api.js
// =============================
(function () {
  // Hindari dobel init
  if (window.__OUTDOOR_API_WIRED__) return;
  window.__OUTDOOR_API_WIRED__ = true;

  const CFG = window.APP_CONFIG || {};

  // Tentukan base API (DEMO-SAFE):
  // Prioritas:
  // 1) APP_CONFIG.API_BASE_URL (kalau ada)
  // 2) default: "" (same-origin) -> request ke /api/* akan diproxy oleh Vercel rewrite (vercel.json)
  //
  // NOTE: sengaja TIDAK auto-infer ke subdomain api.* supaya tidak kena CORS saat DNS api belum diarahkan ke backend.
  const API_BASE = String((CFG && CFG.API_BASE_URL) || "").replace(/\/+$/, "");

  async function apiGet(path) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async function getFiltersSafe() {
    // coba urutan endpoint yang mungkin ada
    const candidates = [
      `${window.APP_CONFIG.API_BASE_URL}/filters`,
      "/api/dashboard/filters",
      "/api/dashboard/filters", // keep (legacy)
    ];
    let lastErr = null;
    for (const p of candidates) {
      try {
        return await apiGet(p);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Filters endpoint not reachable");
  }

  function setOptions(selectEl, options, keepFirst = false) {
    if (!selectEl) return;

    const first = keepFirst ? selectEl.querySelector("option") : null;
    selectEl.innerHTML = "";

    if (keepFirst && first) selectEl.appendChild(first);

    (options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      selectEl.appendChild(o);
    });
  }

  function setNativeOptions(selectEl, values, withAllLabel) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    // tambahkan opsi "All"
    if (withAllLabel) {
      const o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = withAllLabel;
      selectEl.appendChild(o0);
    }

    (values || []).forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      selectEl.appendChild(o);
    });
  }

  function applyDateConstraints(resp) {
    const startEl = document.getElementById("filterStartDate");
    const endEl = document.getElementById("filterEndDate");

    if (!startEl || !endEl) return;

    const min = resp.date_min || null;
    const max = resp.date_max || null;

    if (min) {
      startEl.min = min;
      endEl.min = min;
    }
    if (max) {
      startEl.max = max;
      endEl.max = max;
    }

    // Default (kalau kosong): ambil max sebagai end, dan 7 hari kebelakang sebagai start
    if (!endEl.value && max) endEl.value = max;
    if (!startEl.value && max) {
      try {
        const d = new Date(max + "T00:00:00");
        d.setDate(d.getDate() - 6);
        const s = d.toISOString().slice(0, 10);
        startEl.value = s;
      } catch (e) {}
    }
  }

  // Ini fungsi yang dipanggil dari dashboard.html (bootstrapping)
  window.initFiltersFromAPI = async function initFiltersFromAPI() {
    try {
      const resp = await getFiltersSafe();
      // Simpan untuk debugging
      window.__filtersResp = resp;

      // Elemen dropdown (id berdasarkan dashboard.html Mas)
      const cityEl = document.getElementById("filterCity");
      const typeEl = document.getElementById("filterOOHType");
      const locEl = document.getElementById("filterLocation");

      // Prioritas pakai *_options jika ada (lebih rapi)
      if (resp.city_options) setOptions(cityEl, resp.city_options);
      else if (resp.cities) setNativeOptions(cityEl, resp.cities, "All Cities");

      if (resp.type_options) setOptions(typeEl, resp.type_options);
      else if (resp.ooh_types) setNativeOptions(typeEl, resp.ooh_types, "All Types");

      if (resp.site_options) setOptions(locEl, resp.site_options);
      else if (resp.sites) {
        const mapped = resp.sites.map((s) => ({ value: String(s.id), label: s.name || `Site ${s.id}` }));
        // prepend "All Locations"
        mapped.unshift({ value: "", label: "All Locations" });
        setOptions(locEl, mapped);
      }

      applyDateConstraints(resp);

      // Debug
      window.__API_BASE = API_BASE;
      console.log("[filters] loaded", { API_BASE, cities: resp.cities?.length, sites: resp.sites?.length });
    } catch (e) {
      console.error("[filters] failed:", e);
    }
  };

  // Expose minimal API (optional)
  window.DashboardAPI = window.DashboardAPI || {
    apiGet,
    getFilters: () => apiGet(`${window.APP_CONFIG.API_BASE_URL}/filters`),
  };

  // Auto-run kalau halaman tidak memanggil initFiltersFromAPI() sendiri
  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => window.initFiltersFromAPI && window.initFiltersFromAPI());
    } else {
      window.initFiltersFromAPI && window.initFiltersFromAPI();
    }
  } catch (e) {}
})();
