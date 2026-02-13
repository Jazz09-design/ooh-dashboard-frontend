// app-config.js
// Ganti API_BASE_URL sesuai backend Anda.
// Contoh local: http://localhost:3000
/* dashboard-api.js
 * API wiring: Apply Filter -> /api/dashboard/overview -> update KPI + charts
 * PDF export: html2canvas + jsPDF
 */

/* dashboard-api.js
 * Apply Filter -> /api/dashboard/overview -> update KPI + ApexCharts
 * Export PDF -> html2canvas + jsPDF
 */

(function () {
  const CFG = window.APP_CONFIG || {USE_API: true,
        BASE_URL: "https://ooh-dashboard-backend.vercel.app/api/dashboard",
        USE_STATICMAP: false
        };
  const API_BASE = CFG.API_BASE_URL || "https://api.project-asliku.com";
  const DASH_PREFIX = CFG.DASHBOARD_PREFIX || "/api/dashboard";

  // Blok dummy wiring di HTML (script inline besar)
  window.__USE_API_WIRING__ = true;

  // ====== DOM refs (sesuai HTML yang kamu pakai) ======
  const el = {
    // filters
    loc: document.getElementById("filterLocation"),
    from: document.getElementById("filterStartDate"),
    to: document.getElementById("filterEndDate"),
    apply: document.getElementById("filterApply"),
    badge: document.getElementById("dateRangeBadge"),

    // KPI
    kpiMonthlyImpressions: document.getElementById("kpiMonthlyImpressions"),
    kpiTrafficScore: document.getElementById("kpiTrafficScore"),
    kpiPoiScore: document.getElementById("kpiPoiScore"),
    kpiDemoScore: document.getElementById("kpiDemoScore"),
    kpiTotalScore: document.getElementById("kpiTotalScore"),
    kpiTotalScoreLabel: document.getElementById("kpiTotalScoreLabel"),
    kpiTotalScoreBadge: document.getElementById("kpiTotalScoreBadge"),

    // Chart containers (ApexCharts)
    chartTraffic: document.querySelector("#irTrendChart"),       // line chart (traffic harian)
    chartHourlyOrAlt: document.querySelector("#totalRevenueChart"), // bar chart (opsional: bisa kita pakai avg/summary)
    chartGender: document.querySelector("#demoGenderChart"),     // donut (gender)
    chartPlace: document.querySelector("#demoAgeChart"),         // bar (kita isi place_category)

    // PDF
    btnPdf: document.getElementById("btnExportPdf"),
    pdfArea: document.querySelector(".layout-wrapper") || document.body
  };

  // ====== utils ======
  const fmtInt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return x.toLocaleString("id-ID");
  };
  const fmtDec1 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return x.toFixed(1);
  };
  const setText = (node, val) => {
    if (!node) return;
    node.textContent = val ?? "-";
  };

  function getParamsFromUI() {
    const raw = el.loc?.value;
    const siteId = Number(raw);
    return {
      site_id: Number.isFinite(siteId) ? siteId : 1,
      date_from: el.from?.value || "",
      date_to: el.to?.value || "",
      granularity: "daily"
    };
  }

  function setBadgeDateRange(p) {
    if (!el.badge) return;
    if (p.date_from && p.date_to) el.badge.textContent = `${p.date_from} s/d ${p.date_to}`;
  }

  let __reqSeq = 0;
  async function fetchJson(url) {
    const my = ++__reqSeq;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (my !== __reqSeq) return null;
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json;
  }

  // ====== ApexCharts init ======
  let trafficChart = null;
  let altChart = null;
  let genderChart = null;
  let placeChart = null;

  function ensureCharts() {
    if (typeof window.ApexCharts === "undefined") {
      console.warn("ApexCharts belum ter-load.");
      return;
    }

    // Traffic (line) -> pakai #irTrendChart
    if (el.chartTraffic && !trafficChart) {
      trafficChart = new ApexCharts(el.chartTraffic, {
        chart: { type: "line", height: 260, toolbar: { show: false } },
        series: [{ name: "Traffic", data: [] }],
        xaxis: { categories: [] },
        stroke: { curve: "smooth" },
        dataLabels: { enabled: false }
      });
      trafficChart.render();
    }

    // Alt (bar) -> pakai #totalRevenueChart
    // Kita isi misalnya "Avg Daily Traffic" satu bar atau fallback ke series juga.
    if (el.chartHourlyOrAlt && !altChart) {
      altChart = new ApexCharts(el.chartHourlyOrAlt, {
        chart: { type: "bar", height: 260, toolbar: { show: false } },
        series: [{ name: "Value", data: [] }],
        xaxis: { categories: [] },
        dataLabels: { enabled: false }
      });
      altChart.render();
    }

    // Gender (donut)
    if (el.chartGender && !genderChart) {
      genderChart = new ApexCharts(el.chartGender, {
        chart: { type: "donut", height: 260 },
        series: [0, 0],
        labels: ["Male", "Female"],
        dataLabels: { enabled: true }
      });
      genderChart.render();
    }

    // Place category (bar) -> kita pakai container #demoAgeChart
    if (el.chartPlace && !placeChart) {
      placeChart = new ApexCharts(el.chartPlace, {
        chart: { type: "bar", height: 260, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: true } },
        series: [{ name: "Share", data: [] }],
        xaxis: { categories: [] },
        dataLabels: { enabled: false }
      });
      placeChart.render();
    }
  }

  // ====== render sesuai response overview ======
  function renderKpis(overview) {
    const k = overview?.kpis || {};

    setText(el.kpiMonthlyImpressions, fmtInt(k.monthly_impression));
    setText(el.kpiTrafficScore, fmtDec1(k.traffic_score));
    setText(el.kpiPoiScore, fmtDec1(k.poi_score));
    setText(el.kpiDemoScore, fmtDec1(k.demographic_score));
    setText(el.kpiTotalScore, fmtDec1(k.total_score));

    // optional
    if (el.kpiTotalScoreLabel) el.kpiTotalScoreLabel.textContent = "Total Score";
    if (el.kpiTotalScoreBadge) el.kpiTotalScoreBadge.textContent = "LIVE";
  }

  function renderTraffic(overview) {
    const series = overview?.traffic?.series || [];
    const cats = series.map((p) => p.x);
    const vals = series.map((p) => Number(p.value) || 0);

    if (trafficChart) {
      trafficChart.updateOptions({ xaxis: { categories: cats } });
      trafficChart.updateSeries([{ name: "Traffic", data: vals }], true);
    }

    // chart kedua: isi ringkas avg daily traffic (1 bar) biar tidak kosong
    const avg = overview?.traffic?.summary?.avg_daily_traffic;
    if (altChart) {
      if (avg != null) {
        altChart.updateOptions({ xaxis: { categories: ["Avg Daily Traffic"] } });
        altChart.updateSeries([{ name: "Traffic", data: [Number(avg) || 0] }], true);
      } else {
        // fallback: mirror traffic series sebagai bar
        altChart.updateOptions({ xaxis: { categories: cats } });
        altChart.updateSeries([{ name: "Traffic", data: vals }], true);
      }
    }
  }

  function renderDemography(overview) {
    const demo = overview?.demography || {};

    // 1) Gender donut
    const g = demo?.audience_gender?.series || [];
    const male = Number(g.find((x) => (x.label || "").toLowerCase() === "male")?.value) || 0;
    const female = Number(g.find((x) => (x.label || "").toLowerCase() === "female")?.value) || 0;
    if (genderChart) genderChart.updateSeries([male, female], true);

    // 2) Place category (bar horizontal) -> isi ke #demoAgeChart
    const pc = demo?.place_category?.series || [];
    const pcCats = pc.map((x) => x.label);
    const pcVals = pc.map((x) => Number(x.value) || 0);
    if (placeChart) {
      placeChart.updateOptions({ xaxis: { categories: pcCats } });
      placeChart.updateSeries([{ name: "Share", data: pcVals }], true);
    }
  }

  async function applyFromApi() {
    ensureCharts();
    const p = getParamsFromUI();
    setBadgeDateRange(p);

    localStorage.setItem("dashboard_filters", JSON.stringify(p));

    const url =
      `${API_BASE}${DASH_PREFIX}/overview` +
      `?site_id=${encodeURIComponent(p.site_id)}` +
      `&date_from=${encodeURIComponent(p.date_from)}` +
      `&date_to=${encodeURIComponent(p.date_to)}` +
      `&granularity=${encodeURIComponent(p.granularity)}`;

    const overview = await fetchJson(url);
    if (!overview) return;

    renderKpis(overview);
    renderTraffic(overview);
    renderDemography(overview);
  }

  // ====== optional: load dropdown location dari /filters ======
  async function loadFiltersFromApi() {
    if (!el.loc) return;
    try {
      const data = await fetchJson(`${API_BASE}${DASH_PREFIX}/filters`);
      if (!data) return;

      const sites = data.sites || data.options?.sites || [];
      if (Array.isArray(sites) && sites.length) {
        el.loc.innerHTML = sites
          .map((s) => {
            const id = s.id ?? s.site_id ?? s.value;
            const name = s.name ?? s.site_name ?? s.label ?? `Site ${id}`;
            return `<option value="${id}">${name}</option>`;
          })
          .join("");
      }
    } catch (e) {
      console.warn("Gagal load /filters (pakai dropdown hardcoded).", e);
    }
  }

  // ====== PDF export ======
  async function exportPdf() {
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      alert("Library PDF (html2canvas/jsPDF) belum ter-load.");
      return;
    }

    const p = getParamsFromUI();
    const title = `Dashboard_${p.site_id}_${p.date_from}_to_${p.date_to}`;

    const canvas = await window.html2canvas(el.pdfArea, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: -window.scrollY
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new window.jspdf.jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    pdf.addImage(imgData, "JPEG", 0, y, imgWidth, imgHeight);

    let heightLeft = imgHeight - pageHeight;
    while (heightLeft > 0) {
      pdf.addPage();
      y = -(imgHeight - heightLeft);
      pdf.addImage(imgData, "JPEG", 0, y, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${title}.pdf`);
  }

  // ====== boot ======
  function restoreFilters() {
    const saved = localStorage.getItem("dashboard_filters");
    if (!saved) return;
    try {
      const p = JSON.parse(saved);
      if (el.loc && p.site_id != null) el.loc.value = String(p.site_id);
      if (el.from && p.date_from) el.from.value = p.date_from;
      if (el.to && p.date_to) el.to.value = p.date_to;
    } catch {}
  }

  window.addEventListener("load", async () => {
    restoreFilters();
    await loadFiltersFromApi();

    if (el.apply) {
      el.apply.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await applyFromApi();
        } catch (err) {
          console.error(err);
          alert(`Gagal apply filter: ${err.message}`);
        }
      });
    }

    if (el.btnPdf) {
      el.btnPdf.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await exportPdf();
        } catch (err) {
          console.error(err);
          alert(`Gagal export PDF: ${err.message}`);
        }
      });
    }

    // auto-load sekali saat pertama buka
    try {
      await applyFromApi();
    } catch (err) {
      console.error(err);
    }
  });
})();





