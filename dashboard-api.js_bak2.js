// dashboard-api.final.js
// API wiring final untuk dashboard.html (Outdoor Media Analytics)
// - Load /filters (cities, months, sites, ooh_types, date_min/max)
// - Set min/max month + date range (global) + sync month<->dates
// - City -> Lokasi (filter lokasi berdasarkan city)
// - Render Demography: Gender donut + Age bar (ApexCharts)
// - Refresh data saat klik Terapkan

(() => {
  // Matikan script dummy template kalau file ini ter-load
  window.__USE_API_WIRING__ = true;

  const CFG = window.APP_CONFIG || {};
  const API_BASE = String(CFG.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const PREFIX = String(CFG.DASHBOARD_PREFIX || '/api/dashboard').replace(/\/+$/, '');

  const $ = (id) => document.getElementById(id);
  const els = {
    loc: () => $('filterLocation'),
    ooh: () => $('filterOOHType'),
    city: () => $('filterCity'),
    month: () => $('filterMonth'),
    from: () => $('filterStartDate'),
    to: () => $('filterEndDate'),
    apply: () => $('filterApply'),
    periodBadge: () => $('periodBadge'),
    dateRangeBadge: () => $('dateRangeBadge'),
    demoGenderChart: () => $('demoGenderChart'),
    demoAgeChart: () => $('demoAgeChart'),
    demoTopAge: () => $('demoTopAge'),
    demoMalePct: () => $('demoMalePct'),
    demoFemalePct: () => $('demoFemalePct'),
    demoSegmentReach: () => $('demoSegmentReach'),
    exportPdf: () => $('btnExportPdf'),
    hourlyChartEl: () => $('totalRevenueChart'),
    irChartEl: () => $('irTrendChart'),
    irDayBtn: () => $('irAggDay'),
    irWeekBtn: () => $('irAggWeek'),
    irMonthBtn: () => $('irAggMonth'),
    irBadgeOOH: () => $('irBadgeOOH'),
    irBadgeCity: () => $('irBadgeCity'),
    periodLabelInsights: () => $('periodLabelInsights'),
    periodLabelImpressions: () => $('periodLabelImpressions'),
    periodLabelReach: () => $('periodLabelReach'),
    autoInsightsList: () => $('autoInsightsList'),

  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ====== LOCALSTORAGE (persist filter state) ======
  const LS_KEY = 'ooh_dashboard_filter_state_v1';

  function saveFilterState() {
    try {
      const state = {
        city: els.city()?.value || '',
        ooh: els.ooh()?.value || '',
        location: els.loc()?.value || '',
        month: els.month()?.value || '',
        date_from: els.from()?.value || '',
        date_to: els.to()?.value || '',
      };
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function restoreFilterState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);

      if (s?.month && els.month()) els.month().value = s.month;
      if (s?.date_from && els.from()) els.from().value = s.date_from;
      if (s?.date_to && els.to()) els.to().value = s.date_to;
      if (s?.city && els.city()) els.city().value = s.city;
      if (s?.ooh && els.ooh()) els.ooh().value = s.ooh;
      if (s?.location && els.loc()) els.loc().value = s.location;

      return true;
    } catch (e) {
      return false;
    }
  }

  function qs(params) {
    const u = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      u.set(k, String(v));
    });
    return u.toString();
  }

  async function fetchJson(path, params) {
    const url = `${API_BASE}${PREFIX}${path}${params ? `?${qs(params)}` : ''}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status} ${res.statusText}`);
    return json;
  }

  function toYYYYMMDD(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  function toYYYYMM(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function parseISODate(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function monthToBounds(yyyyMM) {
    if (!/^\d{4}-\d{2}$/.test(yyyyMM)) return null;
    const [y, m] = yyyyMM.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return { first, last };
  }

  function clampDate(dt, minDt, maxDt) {
    if (!dt) return null;
    let t = dt.getTime();
    if (minDt && t < minDt.getTime()) t = minDt.getTime();
    if (maxDt && t > maxDt.getTime()) t = maxDt.getTime();
    return new Date(t);
  }

  function formatMonthIdToLabel(yyyyMM) {
    if (!/^\d{4}-\d{2}$/.test(yyyyMM)) return yyyyMM || '—';
    const [y, m] = yyyyMM.split('-').map(Number);
    const nama = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m - 1] || String(m);
    return `${nama} ${y}`;
  }

  function titleCaseCity(s) {
    if (!s) return '';
    // JAKARTA SELATAN -> Jakarta Selatan
    return String(s)
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w ? w[0].toUpperCase() + w.slice(1) : w)
      .join(' ');
  }


// Normalizer untuk compare value dropdown vs data API (case-insensitive, trim, dan handle typo)
function norm(s) {
  return String(s || '').trim().toUpperCase();
}

function normOOH(s) {
  const x = norm(s);
  // data demo ada typo: "vetikal" => harus dianggap "Billboard Vertical"
  if (x === 'VETIKAL' || x === 'VERTIKAL') return 'BILLBOARD VERTICAL';
  // jika suatu saat hanya "VERTICAL"/"HORIZONTAL" saja
  if (x === 'VERTICAL') return 'BILLBOARD VERTICAL';
  if (x === 'HORIZONTAL') return 'BILLBOARD HORIZONTAL';
  return x;
}

  // ====== FILTERS STATE ======
  let filtersCache = null;
  let lastPois = []; // cache POI untuk minimap

 
  let sitesCache = [];
 let globalMinDate = null;
  let globalMaxDate = null;

  function getSelectedSiteId() {
    const v = els.loc()?.value;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    return null;
  }

  function currentParams() {
    return {
      site_id: getSelectedSiteId(),
      date_from: els.from()?.value || '',
      date_to: els.to()?.value || '',
    };
  }

  // ====== UI POPULATION ======
  function populateCities(cities) {
    const sel = els.city();
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    const sorted = (cities || []).slice().filter(Boolean).sort((a, b) => titleCaseCity(a).localeCompare(titleCaseCity(b)));
    sorted.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = titleCaseCity(c);
      sel.appendChild(opt);
    });
    // restore (case-insensitive)
    const match = sorted.find((c) => String(c).toLowerCase() === String(cur).toLowerCase());
    sel.value = match || sorted[0] || '';
  }

  function populateOOHTypes(types) {
    const sel = els.ooh();
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    const sorted = (types || []).slice().filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
    sorted.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
    sel.value = sorted.includes(cur) ? cur : (sorted[0] || '');
  }

  function populateLocations(sites) {
    // simpan master list agar bisa difilter dengan aman (Safari kadang abaikan option.hidden)
    sitesCache = Array.isArray(sites) ? sites.slice() : [];
    rebuildLocationOptions();
  }

  function applyLocationFilters() {
    // dipanggil saat city/type berubah
    rebuildLocationOptions();
  }
  function rebuildLocationOptions() {
    const selLoc = els.loc();
    const selCity = els.city();
    const selOOH = els.ooh();
    if (!selLoc) return;

    const pickedCity = String(selCity?.value || '').trim();
    const pickedOOH  = String(selOOH?.value || '').trim();

const prev = selLoc.value;

    let filtered = sitesCache.slice();

const pickedCityN = norm(pickedCity);
const pickedOOHN = normOOH(pickedOOH);

if (pickedCityN) {
  filtered = filtered.filter((s) => norm(s.city) === pickedCityN);
}
if (pickedOOHN) {
  filtered = filtered.filter((s) => normOOH(s.ooh_type) === pickedOOHN);
}

    // fallback: kalau kosong, jangan bikin dropdown kosong — tampilkan semua lokasi
    if (filtered.length === 0) filtered = sitesCache.slice();

    selLoc.innerHTML = '';
    filtered.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(s.id);
      opt.textContent = `${s.name}${s.city ? ` — ${titleCaseCity(s.city)}` : ''}`;
      // simpan meta kalau nanti diperlukan
      opt.dataset.city = s.city || '';
      opt.dataset.ooh = s.ooh_type || '';
      selLoc.appendChild(opt);
    });

    // restore pilihan lama kalau masih ada
    const ids = Array.from(selLoc.options).map(o => o.value);
    selLoc.value = ids.includes(prev) ? prev : (ids[0] || '');

    // kalau setelah rebuild masih kosong, set city/type mengikuti lokasi terpilih
    syncCityTypeFromLocation();
  }

  function syncCityTypeFromLocation() {
    const selLoc = els.loc();
    const selCity = els.city();
    const selOOH = els.ooh();
    if (!selLoc) return;
    const sid = Number(selLoc.value);
    const s = sitesCache.find(x => Number(x.id) === sid);
    if (!s) return;

    // update city jika option-nya ada
    if (selCity && s.city) {
      const c = String(s.city).trim();
      const opt = Array.from(selCity.options).find(o => String(o.value).trim().toLowerCase() === c.toLowerCase());
      if (opt) selCity.value = opt.value;
    }
    // update ooh jika option-nya ada
    if (selOOH && s.ooh_type) {
      const ooh = String(s.ooh_type).trim();
      const opt = Array.from(selOOH.options).find(o => String(o.value).trim().toLowerCase() === ooh.toLowerCase());
      if (opt) selOOH.value = opt.value;
    }
  }


  function setMonthBounds(monthMin, monthMax) {
    const m = els.month();
    if (!m) return;
    if (monthMin) m.min = monthMin;
    if (monthMax) m.max = monthMax;
    // clamp value
    const v = m.value;
    if (monthMin && v && v < monthMin) m.value = monthMin;
    if (monthMax && v && v > monthMax) m.value = monthMax;
  }

  function setDateBounds(minDateISO, maxDateISO) {
    const f = els.from();
    const t = els.to();
    if (!f || !t) return;
    if (minDateISO) f.min = minDateISO;
    if (maxDateISO) f.max = maxDateISO;
    if (minDateISO) t.min = minDateISO;
    if (maxDateISO) t.max = maxDateISO;

    // clamp current values
    const fromDt = clampDate(parseISODate(f.value), parseISODate(minDateISO), parseISODate(maxDateISO));
    const toDt = clampDate(parseISODate(t.value), parseISODate(minDateISO), parseISODate(maxDateISO));
    if (fromDt) f.value = toYYYYMMDD(fromDt);
    if (toDt) t.value = toYYYYMMDD(toDt);
  }

  function syncDatesWithMonth() {
    const m = els.month();
    const f = els.from();
    const t = els.to();
    if (!m || !f || !t) return;

    const bounds = monthToBounds(m.value);
    if (!bounds) return;

    const minDt = globalMinDate ? new Date(globalMinDate) : null;
    const maxDt = globalMaxDate ? new Date(globalMaxDate) : null;

    const first = clampDate(bounds.first, minDt, maxDt);
    const last = clampDate(bounds.last, minDt, maxDt);

    // Set value ke awal/akhir bulan (dalam global bounds)
    if (first) f.value = toYYYYMMDD(first);
    if (last) t.value = toYYYYMMDD(last);
  }

  function syncMonthWithDates() {
    const m = els.month();
    const f = els.from();
    if (!m || !f) return;
    const fromDt = parseISODate(f.value);
    if (!fromDt) return;
    const mm = toYYYYMM(fromDt);
    if (mm) m.value = mm;
  }

  function updateBadges() {
    const m = els.month();
    const b = els.periodBadge();
    const dr = els.dateRangeBadge();

    // Derive month label from month input; fallback dari date_from
    let monthVal = m?.value || '';
    if (!/^\d{4}-\d{2}$/.test(monthVal)) {
      const f = els.from()?.value || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(f)) monthVal = f.slice(0, 7);
    }

    if (b) b.textContent = formatMonthIdToLabel(monthVal);
    if (els.periodLabelInsights()) els.periodLabelInsights().textContent = formatMonthIdToLabel(monthVal);
    if (els.periodLabelImpressions()) els.periodLabelImpressions().textContent = formatMonthIdToLabel(monthVal);
    if (els.periodLabelReach()) els.periodLabelReach().textContent = formatMonthIdToLabel(monthVal);

    if (dr) {
      const f = els.from()?.value || '—';
      const t = els.to()?.value || '—';
      dr.textContent = `${f} s/d ${t}`;
    }

    // badges IR
    if (els.irBadgeOOH()) els.irBadgeOOH().textContent = els.ooh()?.value || '—';
    if (els.irBadgeCity()) els.irBadgeCity().textContent = titleCaseCity(els.city()?.value || '') || '—';
  }

  // ====== MINI MAP (STATIC OSM) ======
  function formatMonthId(dateStr) {
    const m = String(dateStr || '').match(/^(\d{4})-(\d{2})/);
    if (!m) return '';
    const y = m[1];
    const mm = Number(m[2]);
    const nama = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][mm-1] || '';
    return `${nama} ${y}`;
  }

  function getSelectedSite(site_id) {
    const sites = Array.isArray(filtersCache?.sites) ? filtersCache.sites : [];
    return sites.find(s => String(s.id ?? s.site_id) === String(site_id)) || null;
  }

  function updateMiniMapStatic(p) {
    // Mini map versi Leaflet (multi-marker) + fallback iframe/img
    const mapEl = document.getElementById('miniMapLeaflet');
    const frame = document.getElementById('miniMapFrame'); // fallback (hidden)
    const img = document.getElementById('miniMapStaticImg'); // fallback (hidden by default)
    const title = document.getElementById('miniMapTitle');
    const subtitle = document.getElementById('miniMapSubtitle');
    const btn = document.getElementById('miniMapBtn');

    if (!mapEl && !frame && !img && !title && !subtitle && !btn) return;

    const site = getSelectedSite(p.site_id) || {};
    const name = site.name || site.location_name || site.label || site.site_name || `Site ${p.site_id}`;

    const lat = Number(site.lat ?? site.latitude);
    const lon = Number(site.lon ?? site.longitude);

    if (title) title.textContent = `Mini Map – ${name}`;
    if (subtitle) subtitle.textContent = `Lokasi terpilih untuk periode ${formatMonthId(p.date_from || p.date_to) || '-'} (${p.date_from} s/d ${p.date_to})`;

    // ===== Leaflet primary (multi marker) =====
    // State disimpan di window agar tidak re-init tiap refresh
    const st = window.__MINIMAP_STATE__ || (window.__MINIMAP_STATE__ = { map: null, siteMarker: null, poiLayer: null, tileOk: true });

    const canLeaflet = !!(window.L && mapEl);
    if (canLeaflet && Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        // tampilkan leaflet, sembunyikan fallback
        mapEl.style.display = 'block';
        if (frame) frame.style.display = 'none';
        if (img) img.style.display = 'none';

        if (!st.map) {
          st.map = window.L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([lat, lon], 16);
          const tile = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          });
          tile.on('tileerror', () => { st.tileOk = false; });
          tile.addTo(st.map);

          st.poiLayer = window.L.layerGroup().addTo(st.map);
        } else {
          st.map.setView([lat, lon], 16, { animate: false });
        }

        // site marker
        if (st.siteMarker) st.siteMarker.remove();
        st.siteMarker = window.L.marker([lat, lon]).addTo(st.map).bindPopup(`<b>${name}</b>`);

        // POI markers (jika ada)
        if (st.poiLayer) st.poiLayer.clearLayers();
        const pois = Array.isArray(p?.pois) ? p.pois : [];
        for (const poi of pois) {
          const plat = Number(poi.lat ?? poi.latitude);
          const plon = Number(poi.lon ?? poi.lng ?? poi.longitude);
          if (!Number.isFinite(plat) || !Number.isFinite(plon)) continue;
          const label = poi.name || poi.title || poi.label || 'POI';
          const cat = poi.category || poi.type || '';
          const popup = cat ? `<b>${label}</b><br/><span style="font-size:12px;color:#666;">${cat}</span>` : `<b>${label}</b>`;
          window.L.circleMarker([plat, plon], { radius: 6 }).addTo(st.poiLayer).bindPopup(popup);
        }

        // fit bounds kalau POI ada
        if (pois.length > 0) {
          const pts = [[lat, lon]];
          pois.forEach(poi => {
            const plat = Number(poi.lat ?? poi.latitude);
            const plon = Number(poi.lon ?? poi.lng ?? poi.longitude);
            if (Number.isFinite(plat) && Number.isFinite(plon)) pts.push([plat, plon]);
          });
          if (pts.length > 1) {
            const b = window.L.latLngBounds(pts);
            st.map.fitBounds(b.pad(0.25), { animate: false });
          }
        }

        if (btn) {
          btn.textContent = 'Open in Maps';
          btn.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lon}&z=17`, '_blank');
        }
        return; // Leaflet sukses, stop di sini
      } catch (e) {
        console.warn('[dashboard-api] Leaflet minimap failed, fallback ke iframe/img', e);
      }
    }

    // ===== Fallback: iframe embed + static image =====
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (mapEl) mapEl.style.display = 'none';

      // 1) iframe embed (OSM)
      if (frame) {
        frame.style.display = 'block';
        const d = 0.005; // ~500m
        const left = lon - d, right = lon + d, top = lat + d, bottom = lat - d;
        const bbox = `${left},${bottom},${right},${top}`;
        frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(lat + ',' + lon)}`;
      }

      // 2) static img
      if (img) {
        img.style.display = 'none';
        const base = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=16&size=900x420&maptype=mapnik`;
        const withMarker = `${base}&markers=${lat},${lon},red-pushpin`;
        const withoutMarker = base;

        img.onerror = () => {
          if (img.dataset.__fallback !== '1') {
            img.dataset.__fallback = '1';
            img.src = withoutMarker;
          }
        };

        img.onload = () => { img.style.display = 'block'; };
        img.src = withMarker;
        img.alt = `Mini map ${name} (${lat},${lon})`;
      }

      if (btn) {
        btn.textContent = 'Open in Maps';
        btn.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lon}&z=17`, '_blank');
      }
    }
  }


  // ====== DEMOGRAPHY CHARTS (Apex) ======
  let genderChart = null;
  let ageChart = null;

  function ensureDemographyCharts() {
    if (!window.ApexCharts) {
      console.warn('ApexCharts belum tersedia. Demography chart tidak dibuat.');
      return;
    }

    const gEl = els.demoGenderChart();
    const aEl = els.demoAgeChart();
    if (gEl && !genderChart) {
      try { gEl.innerHTML = ''; } catch {}
      genderChart = new window.ApexCharts(gEl, {
        chart: { type: 'donut', height: 260 },
        labels: ['male', 'female'],
        series: [0, 0],
        legend: { position: 'left' },
        dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(0)}%` },
      });
      genderChart.render();
    }

    if (aEl && !ageChart) {
      try { aEl.innerHTML = ''; } catch {}
      ageChart = new window.ApexCharts(aEl, {
        chart: { type: 'bar', height: 260, toolbar: { show: false } },
        series: [{ name: 'reach', data: [] }],
        plotOptions: { bar: { horizontal: true, barHeight: '55%' } },
        dataLabels: { enabled: false },
        xaxis: { categories: [] },
      });
      ageChart.render();
    }
  }

  function updateDemographyCharts(demoResp) {
    ensureDemographyCharts();
      initHourlyChart();
      initIRChart();

    // gender
    const gSeries = demoResp?.charts?.audience_gender?.series || [];
    const male = Number(gSeries.find((x) => String(x.label).toLowerCase() === 'male')?.value ?? 0);
    const female = Number(gSeries.find((x) => String(x.label).toLowerCase() === 'female')?.value ?? 0);
    const total = (male + female) || 1;
    const malePct = Math.round((male / total) * 100);
    const femalePct = 100 - malePct;

    if (genderChart) genderChart.updateSeries([malePct, femalePct], true);
    if (els.demoMalePct()) els.demoMalePct().textContent = String(malePct);
    if (els.demoFemalePct()) els.demoFemalePct().textContent = String(femalePct);

    // age distribution
    const aSeries = demoResp?.charts?.place_category?.series || demoResp?.charts?.age_distribution?.series || [];
    const cats = aSeries.map((x) => String(x.label));
    const vals = aSeries.map((x) => Number(x.value ?? 0));

    if (ageChart) {
      ageChart.updateOptions({ xaxis: { categories: cats } }, false, true);
      ageChart.updateSeries([{ name: 'reach', data: vals }], true);

      // Fix ApexCharts kadang kosong (width=0) saat reflow: paksa re-render & resize
      setTimeout(() => {
        try { ageChart.render(); } catch (e) {}
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      }, 0);
    }

    // top age group
    let top = '—';
    if (cats.length) {
      let maxIdx = 0;
      for (let i = 1; i < vals.length; i++) if (vals[i] > vals[maxIdx]) maxIdx = i;
      top = cats[maxIdx] || '—';
    }
    if (els.demoTopAge()) els.demoTopAge().textContent = top;

    // selected segment reach (kalau ada)
    if (els.demoSegmentReach()) {
      const seg = demoResp?.charts?.interest_segmentation?.series || [];
      els.demoSegmentReach().textContent = seg.length ? String(seg.reduce((a, b) => a + Number(b.value || 0), 0)) : '—';
    }
  }

  // ====== REFRESH ALL ======
  let reqSeq = 0;

  // ====== HOURLY TRAFFIC CHART (Apex) ======
  let hourlyChart = null;

  function initHourlyChart() {
    if (!window.ApexCharts) return;
    const el = els.hourlyChartEl();
    if (!el || hourlyChart) return;
    try { el.innerHTML = ''; } catch {}

    const categories = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

    const options = {
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
      dataLabels: { enabled: false },
      stroke: { show: false },
      xaxis: { categories },
      series: [{
        name: 'Potential Views',
        data: categories.map((x) => ({ x, y: 0 }))
      }],
      legend: { show: false },
      annotations: { xaxis: [] },
      tooltip: {
        y: {
          formatter: (val) => {
            try { return new Intl.NumberFormat('id-ID').format(val) + ' views'; } catch { return String(val) + ' views'; }
          }
        }
      }
    };

    hourlyChart = new window.ApexCharts(el, options);
    hourlyChart.render();
  }

  function updateHourlyChart(data24) {
    initHourlyChart();
    if (!hourlyChart) return;

    const categories = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
    const arr = Array.isArray(data24) ? data24.map((v) => Number(v) || 0) : new Array(24).fill(0);

    // --- peak detection (1 jam saja) ---
    // Morning: 06–11, Evening: 15–20
    const pickPeak = (fromH, toH) => {
      let bestH = fromH;
      let bestV = -Infinity;
      for (let h = fromH; h <= toH; h++) {
        const v = arr[h] ?? 0;
        if (v > bestV) { bestV = v; bestH = h; }
      }
      return { h: bestH, v: bestV };
    };

    const morning = pickPeak(6, 11);
    const evening = pickPeak(15, 20);

    // simpan untuk dipakai quick insights / badge lain
    window.__PEAK_HOURS__ = { morningHour: morning.h, eveningHour: evening.h };

    const fmtHour = (h) => String(h).padStart(2, '0') + ':00';

    // data points dengan warna highlight
    const dataPoints = categories.map((x, i) => {
      const y = arr[i] ?? 0;
      if (i === morning.h) return { x, y, fillColor: '#F59E0B' }; // morning peak
      if (i === evening.h) return { x, y, fillColor: '#EF4444' }; // evening peak
      return { x, y };
    });

    hourlyChart.updateSeries([{ name: 'Potential Views', data: dataPoints }], true);

    // annotations label
    const ann = [
      { x: fmtHour(morning.h), borderColor: '#F59E0B', label: { text: 'Morning Peak', style: { background: '#F59E0B', color: '#111827' } } },
      { x: fmtHour(evening.h), borderColor: '#EF4444', label: { text: 'Evening Peak', style: { background: '#EF4444', color: '#ffffff' } } },
    ];
    hourlyChart.updateOptions({ annotations: { xaxis: ann } }, false, true);

    // badges (kalau ada)
    const mm1 = document.getElementById('miniMapPeak1');
    const mm2 = document.getElementById('miniMapPeak2');
    if (mm1) mm1.textContent = fmtHour(morning.h);
    if (mm2) mm2.textContent = fmtHour(evening.h);

    // reflow fix
    setTimeout(() => {
      try { hourlyChart.render(); } catch {}
      try { window.dispatchEvent(new Event('resize')); } catch {}
    }, 0);
  }

  // Convert response /traffic?granularity=hourly menjadi avg 24 jam menjadi avg 24 jam
  function hourlyRowsToAvg24(resp) {
    const rows = Array.isArray(resp?.series) ? resp.series : (Array.isArray(resp?.hourly) ? resp.hourly : []);
    const sum = new Array(24).fill(0);
    const count = new Array(24).fill(0);

    for (const it of rows) {
      const x = String(it?.x ?? it?.ts ?? it?.ts_hour ?? '');
      const v = Number(it?.value ?? it?.volume ?? 0);

      let h = null;
      const m1 = x.match(/T(\d{2}):/);
      if (m1) h = Number(m1[1]);
      if (h === null) {
        const m2 = x.match(/(\d{2}):(\d{2})/);
        if (m2) h = Number(m2[1]);
      }
      if (h === null || !Number.isFinite(h) || h < 0 || h > 23) continue;

      sum[h] += v;
      count[h] += 1;
    }

    // average per hour (kalau count=0 tetap 0)
    return sum.map((s, i) => count[i] ? Math.round(s / count[i]) : 0);
  }

  // ====== IMPRESSIONS & REACH TREND CHART (Apex) ======
  let irChart = null;
  let irAgg = 'day';

  function initIRChart() {
    if (!window.ApexCharts) return;
    const el = els.irChartEl();
    if (!el || irChart) return;
    try { el.innerHTML = ''; } catch {}

    const options = {
      chart: { type: 'line', height: 330, toolbar: { show: false } },
      stroke: { width: 3, curve: 'smooth' },
      dataLabels: { enabled: false },
      xaxis: { categories: [] },
      series: [
        { name: 'Impressions', data: [] },
        { name: 'Reach', data: [] },
      ],
      legend: { position: 'top' },
    };

    irChart = new window.ApexCharts(el, options);
    irChart.render();
  }

  function isoWeekKey(dateStr) {
    // YYYY-MM-DD -> ISO week key
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
    const yy = dt.getUTCFullYear();
    return `${yy}-W${String(weekNo).padStart(2, '0')}`;
  }

  function aggregateIR(rows, mode) {
    if (!rows || !rows.length) return { categories: [], imp: [], reach: [] };

    if (mode === 'month') {
      const totalImp = rows.reduce((a, r) => a + (r.impressions || 0), 0);
      const totalReach = rows.reduce((a, r) => a + (r.reach || 0), 0);
      const monthStr = (els.month()?.value || rows[0].date.slice(0, 7));
      return { categories: [monthStr], imp: [totalImp], reach: [totalReach] };
    }

    const group = new Map();
    const order = [];
    for (const r of rows) {
      const key = mode === 'week' ? isoWeekKey(r.date) : r.date;
      if (!group.has(key)) { group.set(key, { imp: 0, reach: 0 }); order.push(key); }
      const g = group.get(key);
      g.imp += (r.impressions || 0);
      g.reach += (r.reach || 0);
    }

    return {
      categories: order,
      imp: order.map((k) => group.get(k).imp),
      reach: order.map((k) => group.get(k).reach),
    };
  }

  function renderIRChart(rows, mode) {
    initIRChart();
    if (!irChart) return;
    const data = aggregateIR(rows, mode);
    irChart.updateOptions({ xaxis: { categories: data.categories } }, false, true);
    irChart.updateSeries([
      { name: 'Impressions', data: data.imp },
      { name: 'Reach', data: data.reach },
    ], true);

    // reflow fix
    setTimeout(() => {
      try { irChart.render(); } catch {}
      try { window.dispatchEvent(new Event('resize')); } catch {}
    }, 0);
  }

  function setIRAggButtons(mode) {
    const day = els.irDayBtn();
    const week = els.irWeekBtn();
    const month = els.irMonthBtn();
    const setBtn = (btn, active) => {
      if (!btn) return;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-outline-primary', !active);
    };
    setBtn(day, mode === 'day');
    setBtn(week, mode === 'week');
    setBtn(month, mode === 'month');
  }

  function updateQuickInsightsFromDaily(rows) {
    const ul = els.autoInsightsList();
    if (!ul) return;
    if (!rows || !rows.length) { ul.innerHTML = '<li>—</li>'; return; }

    const peaks = window.__PEAK_HOURS__ || {};
    const fmtHour = (h) => (h === 0 || Number.isFinite(h)) ? String(h).padStart(2, '0') + ':00' : '—';

    // best day impressions & reach
    let bestImp = rows[0];
    let bestReach = rows[0];
    for (const r of rows) {
      if ((r.impressions || 0) > (bestImp.impressions || 0)) bestImp = r;
      if ((r.reach || 0) > (bestReach.reach || 0)) bestReach = r;
    }

    const peakLine = (Number.isFinite(peaks.morningHour) || peaks.morningHour === 0 || Number.isFinite(peaks.eveningHour) || peaks.eveningHour === 0)
      ? `<li><span class="fw-semibold">Peak Hours:</span>
            <span class="badge bg-label-warning ms-1">${fmtHour(peaks.morningHour)}</span>
            <span class="text-muted ms-1">(Morning)</span>
            <span class="badge bg-label-danger ms-2">${fmtHour(peaks.eveningHour)}</span>
            <span class="text-muted ms-1">(Evening)</span>
         </li>`
      : '';

    ul.innerHTML = `
      ${peakLine}
      <li><span class="fw-semibold">Best day (Impressions):</span> <span class="badge bg-label-success">${bestImp.date}</span></li>
      <li><span class="fw-semibold">Best day (Reach):</span> <span class="badge bg-label-info">${bestReach.date}</span></li>
    `;
  }


  async function refreshAll(reason = 'manual') {
    const seq = ++reqSeq;

    updateBadges();
    updateMiniMapStatic({ ...currentParams(), pois: lastPois });

    const p = currentParams();
    if (!p.site_id || !p.date_from || !p.date_to) {
      console.warn('[dashboard-api] Filter belum lengkap', p);
      return;
    }

    // Helper: update chart hourly (24 jam) dari response /traffic hourly
    function applyHourlyTraffic(trafficHourlyResp) {
      const series = Array.isArray(trafficHourlyResp?.series) ? trafficHourlyResp.series : [];
      const arr = new Array(24).fill(0);

      for (const it of series) {
        const x = String(it?.x ?? it?.ts ?? '');
        const v = Number(it?.value ?? 0);
        // x bisa "00:00" atau timestamp; ambil jamnya saja
        const m = x.match(/(\d{2}):\d{2}/);
        if (!m) continue;
        const h = Number(m[1]);
        if (Number.isFinite(h) && h >= 0 && h <= 23) arr[h] = v;
      }

      if (typeof window.updateHourlyChart === 'function') {
        window.updateHourlyChart(arr);
      } else {
        console.warn('[dashboard-api] updateHourlyChart tidak ditemukan (cek dashboard.html)');
      }
    }

    // Helper: update chart Impressions & Reach dari response /traffic daily (dipakai sebagai proxy)
    function applyIRTrendFromDailyTraffic(trafficDailyResp) {
      const series = Array.isArray(trafficDailyResp?.series) ? trafficDailyResp.series : [];
      const rows = series
        .map((it) => {
          const date = String(it?.x ?? it?.date ?? '');
          const impressions = Number(it?.value ?? 0);
          const reach = Math.round(impressions * 0.8); // demo: reach estimate 80%
          return { date, impressions, reach };
        })
        .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));

      window.__LAST_ROWS_FOR_IR = rows;
      if (typeof window.renderIRChart === 'function') {
        window.renderIRChart(rows, window.__currentAgg || 'day');
      } else {
        console.warn('[dashboard-api] renderIRChart tidak ditemukan (cek dashboard.html)');
      }
    }

    try {
      const results = await Promise.allSettled([
        fetchJson('/demography', p),
        fetchJson('/traffic', { ...p, granularity: 'hourly' }),
        fetchJson('/traffic', { ...p, granularity: 'daily' }),
        // optional: overview berisi POI (jika endpoint tersedia)
        fetchJson('/overview', p),
      ]);

      const demo = (results[0].status === 'fulfilled') ? results[0].value : null;
      const trafficHourly = (results[1].status === 'fulfilled') ? results[1].value : null;
      const trafficDaily = (results[2].status === 'fulfilled') ? results[2].value : null;
      const overview = (results[3].status === 'fulfilled') ? results[3].value : null;

      // update POI cache (support beberapa bentuk response)
      lastPois = Array.isArray(overview?.map?.pois) ? overview.map.pois
        : Array.isArray(overview?.pois) ? overview.pois
        : Array.isArray(overview?.data?.pois) ? overview.data.pois
        : [];


      if (seq !== reqSeq) return;

      updateMiniMapStatic({ ...p, pois: lastPois });

      if (demo) updateDemographyCharts(demo);
      if (trafficHourly) updateHourlyChart(hourlyRowsToAvg24(trafficHourly));
      {
        const rows = (Array.isArray(trafficDaily?.series) ? trafficDaily.series : (Array.isArray(trafficDaily?.daily) ? trafficDaily.daily : []))
          .map(it => ({ date: String(it?.x ?? it?.date ?? ''), impressions: Number(it?.value ?? it?.volume ?? 0), reach: Math.round(Number(it?.value ?? it?.volume ?? 0) * 0.8) }))
          .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
        window.__LAST_ROWS_FOR_IR = rows;
        renderIRChart(rows, irAgg);
        updateQuickInsightsFromDaily(rows);
      }
    } catch (e) {
      console.warn('[dashboard-api] refreshAll failed:', reason, e);
    }
  }

  // ====== INIT FROM /filters ======
  async function initFiltersFromApi() {
    const f = await fetchJson('/filters');
    filtersCache = f;

    // Month bounds (pakai daftar months dari API bila ada)
    const months = Array.isArray(f?.months)
      ? f.months.slice().filter((x) => /^\d{4}-\d{2}$/.test(x)).sort()
      : [];
    const monthMin = months.length ? months[0] : null;
    const monthMax = months.length ? months[months.length - 1] : null;

    if (monthMin && monthMax) setMonthBounds(monthMin, monthMax);

    // Derive global date bounds dari months (fallback paling aman)
    let derivedMin = null;
    let derivedMax = null;
    if (monthMin) {
      const b = monthToBounds(monthMin);
      if (b?.first) derivedMin = toYYYYMMDD(b.first);
    }
    if (monthMax) {
      const b = monthToBounds(monthMax);
      if (b?.last) derivedMax = toYYYYMMDD(b.last);
    }

    // Global date bounds dari API (date_min/date_max) — beberapa seed mengirim string tanpa tahun (mis. "Sat Nov 01")
    // Kalau hasil parse tahun "aneh" (mis. 2000), kita pakai derivedMin/derivedMax dari months.
    const apiMinDt = parseISODate(f?.date_min);
    const apiMaxDt = parseISODate(f?.date_max);

    const apiMinISO = apiMinDt ? toYYYYMMDD(apiMinDt) : null;
    const apiMaxISO = apiMaxDt ? toYYYYMMDD(apiMaxDt) : null;

    const isReasonableYear = (iso) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))) return false;
      const y = Number(String(iso).slice(0, 4));
      return y >= 2020 && y <= 2100;
    };

    globalMinDate = isReasonableYear(apiMinISO) ? apiMinISO : derivedMin;
    globalMaxDate = isReasonableYear(apiMaxISO) ? apiMaxISO : derivedMax;

    // Set date bounds (untuk input type=date)
    if (globalMinDate || globalMaxDate) setDateBounds(globalMinDate || '', globalMaxDate || '');

    // Populate dropdowns
    if (Array.isArray(f?.cities)) populateCities(f.cities);
    if (Array.isArray(f?.ooh_types)) populateOOHTypes(f.ooh_types);
    if (Array.isArray(f?.sites)) populateLocations(f.sites);

    // Apply filter (city + ooh) to locations
    applyLocationFilters();

    // Initial badges
    updateBadges();
  }
  // ====== EVENT WIRING ======
  function bindUI() {
    const btn = els.apply();
    if (btn) {
      btn.addEventListener('click', () => {
        syncMonthWithDates();
        updateBadges();
        saveFilterState();
        refreshAll('apply');
      });
    }

    // Export PDF (demo): pakai print agar stabil di Safari
    els.exportPdf()?.addEventListener('click', (e) => {
      e.preventDefault();
      updateBadges();
      saveFilterState();
      try { window.print(); } catch (err) { console.warn('print failed', err); }
    });

    // IR toggle
    els.irDayBtn()?.addEventListener('click', () => { irAgg = 'day'; setIRAggButtons(irAgg); renderIRChart(window.__LAST_ROWS_FOR_IR || [], irAgg); });
    els.irWeekBtn()?.addEventListener('click', () => { irAgg = 'week'; setIRAggButtons(irAgg); renderIRChart(window.__LAST_ROWS_FOR_IR || [], irAgg); });
    els.irMonthBtn()?.addEventListener('click', () => { irAgg = 'month'; setIRAggButtons(irAgg); renderIRChart(window.__LAST_ROWS_FOR_IR || [], irAgg); });


    // saat city berubah -> filter lokasi
    els.city()?.addEventListener('change', () => {
      applyLocationFilters();
      saveFilterState();
    });

    // saat type OOH berubah -> filter lokasi
    els.ooh()?.addEventListener('change', () => {
      applyLocationFilters();
      saveFilterState();
    });

    // saat lokasi berubah -> ikutkan city & type (biar konsisten)
    els.loc()?.addEventListener('change', () => {
      syncCityTypeFromLocation();
      saveFilterState();
    });


    // month berubah -> set tanggal bulan tsb
    els.month()?.addEventListener('change', () => {
      syncDatesWithMonth();
      updateBadges();
      saveFilterState();
    });

    // tanggal berubah -> update month + badges
    els.from()?.addEventListener('change', () => { syncMonthWithDates(); updateBadges(); saveFilterState(); });
    els.to()?.addEventListener('change', () => { updateBadges(); saveFilterState(); });

    // lokasi berubah -> update city agar konsisten (tanpa override user bila sudah pilih)
    els.loc()?.addEventListener('change', () => {
      const opt = els.loc().selectedOptions?.[0];
      if (!opt) return;
      const c = String(opt.dataset.city || '');
      if (!c) return;
      const citySel = els.city();
      if (!citySel) return;
      const match = Array.from(citySel.options).find((o) => String(o.value).toLowerCase() === c.toLowerCase());
      if (match) {
        citySel.value = match.value;
        applyLocationFilters();
        saveFilterState();
      }
    });
  }

  async function boot() {
    try {
      bindUI();
      await initFiltersFromApi();
      const restored = restoreFilterState();
      if (restored) {
        // setelah restore, pastikan dropdown lokasi ter-filter & badges sinkron
        applyLocationFilters();
        syncDatesWithMonth();
        syncMonthWithDates();
        updateBadges();
      }
      setIRAggButtons(irAgg);
      await sleep(50);
      ensureDemographyCharts();
      initHourlyChart();
      initIRChart();
      refreshAll('startup');
    } catch (e) {
      console.error('[dashboard-api] boot failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
