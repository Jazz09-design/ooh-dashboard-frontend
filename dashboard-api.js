// dashboard-api.final.js
// API wiring final untuk dashboard.html (Outdoor Media Analytics)
// - Load /filters (cities, months, sites, ooh_types, date_min/max)
// - Set min/max month + date range (global) + sync month<->dates
// - City -> Lokasi (filter lokasi berdasarkan city)
// - Render Demography: Gender donut + Age bar (ApexCharts)
// - Refresh data saat klik Terapkan

(() => {
  // Matikan script dummy template kalau file ini ter-load
  if (window.__USE_API_WIRING__ === true || window.APP_CONFIG?.USE_API === true) return;


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
  
  // ====== OVERRIDES DATA (from XLS sample) ======
  // Dipakai untuk menyelaraskan City/Type OOH bila data /filters.sites belum konsisten.
  const SITE_OVERRIDES = {"jl. raya serang view exit tol balaraja timur menuju cukupan tangerang, balaraja serang": {"city": "Kab. Tangerang", "ooh_type": "Billboard Vertical"}, "jl. raya pusdiklat view graha raya menuju alam sutra": {"city": "Tangerang Selatan", "ooh_type": "Billboard Vertical"}, "jl. arteri kh noer ali depan shell kalimalang": {"city": "Bekasi", "ooh_type": "Billboard Vertical"}, "lampu merah jl.raya cikupa": {"city": "Kab. Tangerang", "ooh_type": "Billboard Vertical"}, "perempatan jl.mt haryono": {"city": "Semarang", "ooh_type": "Billboard Vertical"}, "jl. setia budi menuju gombel golf": {"city": "Semarang", "ooh_type": "Billboard Vertical"}, "jl.sunset ring road": {"city": "Bali", "ooh_type": "Billboard Vertical"}, "jl.raya canggu kerobokan": {"city": "Bali", "ooh_type": "Billboard Vertical"}, "jl. raya solo - ngawi fly over palur, karang anyar": {"city": "Solo", "ooh_type": "Billboard Vertical"}, "pertigaan janti jl. laksda adi sucipto": {"city": "Jogjakarta", "ooh_type": "Billboard Vertical"}, "jl. kapten sumarsono simpang tol helvitia": {"city": "Medan", "ooh_type": "Billboard Horizontal"}, "jl. laswi": {"city": "Bandung", "ooh_type": "Billboard Vertical"}, "jl. cemara sukajadi (sebrang mandiri)": {"city": "Bandung", "ooh_type": "Billboard Vertical"}, "jl.raya ngagel": {"city": "Surabaya", "ooh_type": "Billboard Horizontal"}, "jl. gunung sari": {"city": "Surabaya", "ooh_type": "Billboard Vertical"}, "jl. mansyur": {"city": "Medan", "ooh_type": "Billboard Vertical"}, "jl. hang tuah": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Vertical"}, "jl. raya kalibata": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Vertical"}, "jl. sultan iskandar muda pim 3": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Vertical"}, "jl. sisingamangaraja (blok m)": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Vertical"}, "hr rasuna said (led granadi)": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Vertical"}, "bundaran tugu tani": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Vertical"}, "metro pondok indah": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Horizontal"}, "wolter monginsidi": {"city": "JAKARTA SELATAN", "ooh_type": "Billboard Horizontal"}, "jl. kyai tapa": {"city": "Jakarta Barat", "ooh_type": "Billboard Vertical"}, "jl. margonda raya depan serabi": {"city": "DEPOK", "ooh_type": "Billboard Vertical"}, "jl.margonda raya roti bakar eddy": {"city": "DEPOK", "ooh_type": "Billboard Vertical"}, "sun plaza mall": {"city": "Medan", "ooh_type": "Billboard Horizontal"}, "jl. samratulangi (depan hotel ibis)": {"city": "Makassar", "ooh_type": "Billboard Vertical"}, "mall jcm entrance": {"city": "YOGYAKARTA", "ooh_type": "Billboard Horizontal"}, "jl. padjajaran (perempatan anggajaya)": {"city": "YOGYAKARTA", "ooh_type": "Billboard Vertical"}};
  const normName = (s) => String(s||'').trim().toLowerCase().replace(/\s+/g,' ');

  function applySiteOverrides() {
    // apply override dari XLS ke sitesCache dan juga filtersCache.sites (agar konsisten untuk minimap/title)
    const applyTo = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return;
      arr.forEach((s) => {
        const key = normName(s.name);
        const ov = SITE_OVERRIDES[key];
        if (ov) {
          if (ov.city) s.city = ov.city;
          if (ov.ooh_type) s.ooh_type = ov.ooh_type;
        }
      });
    };
    applyTo(sitesCache);
    applyTo(filtersCache?.sites);
  }

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
    // opsi All (kosong) supaya filter bisa netral dan init tidak mismatch
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'All Cities';
    sel.appendChild(optAll);
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
    // opsi All (kosong) supaya filter bisa netral dan init tidak mismatch
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'All Types';
    sel.appendChild(optAll);
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

function ensureCityOOHOptionsFromSites() {
    const selCity = els.city();
    const selOOH = els.ooh();
    if (!sitesCache || !sitesCache.length) return;

    // derive unique values from sitesCache
    const cities = Array.from(new Set(sitesCache.map(s => titleCaseCity(String(s.city || '').trim())).filter(Boolean))).sort();
    const oohs = Array.from(new Set(sitesCache.map(s => String(s.ooh_type || '').trim()).filter(Boolean))).sort();

    const ensureMany = (sel, values) => {
      if (!sel) return;
      const existing = new Set(Array.from(sel.options).map(o => String(o.value).trim().toLowerCase()));
      values.forEach(v => {
        const key = String(v).trim().toLowerCase();
        if (!key || existing.has(key)) return;
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
        existing.add(key);
      });
    };

    ensureMany(selCity, cities);
    ensureMany(selOOH, oohs);
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
    // Jika hasil filter kosong, biarkan kosong (tidak fallback tampil semua)
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
    selLoc.value = ids.includes(prev) ? prev : '';
    // kalau setelah rebuild masih kosong, set city/type mengikuti lokasi terpilih
    syncCityTypeFromLocation();
  }

  function syncCityTypeFromLocation(forceAddOption = true) {
    const selLoc = els.loc();
    const selCity = els.city();
    const selOOH = els.ooh();
    if (!selLoc) return;

    const sid = Number(selLoc.value);
    const s = sitesCache.find(x => Number(x.id) === sid);
    if (!s) return;

    // helper: ensure option exists (so value bisa diset walau list cities dari API belum lengkap)
    const ensureOption = (sel, value) => {
      if (!sel || !value) return;
      const v = String(value).trim();
      if (!v) return;
      const existing = Array.from(sel.options).find(o => String(o.value).trim().toLowerCase() === v.toLowerCase());
      if (existing) return existing;
      if (!forceAddOption) return null;
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
      return opt;
    };

    // update city mengikuti lokasi
    if (selCity && s.city) {
      const opt = ensureOption(selCity, titleCaseCity(String(s.city).trim()));
      if (opt) selCity.value = opt.value;
    }

    // update ooh mengikuti lokasi
    if (selOOH && s.ooh_type) {
      const opt = ensureOption(selOOH, String(s.ooh_type).trim());
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
    const sites = (Array.isArray(sitesCache) && sitesCache.length)
      ? sitesCache
      : (Array.isArray(filtersCache?.sites) ? filtersCache.sites : []);
    return sites.find(s => String(s.id ?? s.site_id) === String(site_id)) || null;
  }

  
// ====== MINI MAP (Leaflet + POI, fallback iframe) ======
function formatMonthId(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  const y = m[1];
  const mm = Number(m[2]);
  const nama = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][mm-1] || '';
  return `${nama} ${y}`;
}

function showMiniMapLoading(p) {
  const title = document.getElementById('miniMapTitle');
  const subtitle = document.getElementById('miniMapSubtitle');
  if (title) title.textContent = `Mini Map`;
  if (subtitle && p?.date_from && p?.date_to) {
    subtitle.textContent = `Memuat peta untuk periode ${formatMonthId(p.date_from || p.date_to) || '-'} (${p.date_from} s/d ${p.date_to})...`;
  }
}

function updateMiniMapFromOverview(overviewResp, p) {
  if (!overviewResp) return;

  const mapEl = document.getElementById('miniMapLeaflet');
  const frame = document.getElementById('miniMapFrame'); // fallback
  const title = document.getElementById('miniMapTitle');
  const subtitle = document.getElementById('miniMapSubtitle');
  const btn = document.getElementById('miniMapBtn');

  const site = overviewResp.site || {};
  const name = site.name || site.location_name || site.label || site.site_name || `Site ${p?.site_id || ''}`;
  const lat = Number(site.latitude ?? site.lat ?? site.y);
  const lon = Number(site.longitude ?? site.lon ?? site.lng ?? site.x);

  // pois: dari overview.map.pois (jika ada) atau overview.pois
  const pois = Array.isArray(overviewResp?.map?.pois) ? overviewResp.map.pois
             : (Array.isArray(overviewResp?.pois) ? overviewResp.pois : []);

  // count poi within 500m: dari overview.map.poi_within_500m, atau overview.poi_within_500m
  const poiCountRaw =
    overviewResp?.map?.poi_within_500m ??
    overviewResp?.map?.poi_within_500m_count ??
    overviewResp?.poi_within_500m ??
    overviewResp?.poi_within_500m_count ??
    overviewResp?.poiWithin500m ??
    overviewResp?.poiWithin500mCount;

  const poiWithin = Number.isFinite(Number(poiCountRaw)) ? Number(poiCountRaw) : null;

  if (title) title.textContent = `Mini Map – ${name}`;
  if (subtitle && p?.date_from && p?.date_to) {
    subtitle.textContent = `Lokasi terpilih untuk periode ${formatMonthId(p.date_from || p.date_to) || '-'} (${p.date_from} s/d ${p.date_to})`;
  }

  const mmPoiCount = document.getElementById('miniMapPoiCount');
  if (mmPoiCount) mmPoiCount.textContent = String(poiWithin ?? (pois?.length || 0) ?? 0);

  if (btn && Number.isFinite(lat) && Number.isFinite(lon)) {
    btn.textContent = 'Open in Maps';
    btn.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lon}&z=17`, '_blank');
  }

  const canLeaflet = !!(window.L && mapEl && Number.isFinite(lat) && Number.isFinite(lon));
  const st = window.__MINIMAP_STATE__ || (window.__MINIMAP_STATE__ = { map: null, siteMarker: null, poiLayer: null, tileOk: true });

  // ===== Leaflet primary =====
  if (canLeaflet) {
    try {
      mapEl.style.display = 'block';
      if (frame) frame.style.display = 'none';

      if (!st.map) {
        st.map = window.L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([lat, lon], 16);
        const tile = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        });
        tile.on('tileerror', () => { st.tileOk = false; });
        tile.addTo(st.map);

        st.poiLayer = window.L.layerGroup().addTo(st.map);
      } else {
        st.map.setView([lat, lon], 16, { animate: false });
      }

      // marker lokasi (POV/site)
      if (st.siteMarker) st.siteMarker.remove();
      st.siteMarker = window.L.marker([lat, lon]).addTo(st.map).bindPopup(`<b>${name}</b>`);

      // marker POI
      if (st.poiLayer) st.poiLayer.clearLayers();
      for (const poi of (pois || [])) {
        const plat = Number(poi.lat ?? poi.latitude ?? poi.y);
        const plon = Number(poi.lon ?? poi.lng ?? poi.longitude ?? poi.x);
        if (!Number.isFinite(plat) || !Number.isFinite(plon)) continue;
        const label = poi.name || poi.title || poi.label || 'POI';
        const cat = poi.category || poi.type || '';
        const popup = cat ? `<b>${label}</b><br/><span style="font-size:12px;color:#666;">${cat}</span>` : `<b>${label}</b>`;
        window.L.circleMarker([plat, plon], { radius: 6 }).addTo(st.poiLayer).bindPopup(popup);
      }

      // fit bounds kalau POI ada
      if (Array.isArray(pois) && pois.length > 0) {
        const pts = [[lat, lon]];
        pois.forEach((poi) => {
          const plat = Number(poi.lat ?? poi.latitude ?? poi.y);
          const plon = Number(poi.lon ?? poi.lng ?? poi.longitude ?? poi.x);
          if (Number.isFinite(plat) && Number.isFinite(plon)) pts.push([plat, plon]);
        });
        if (pts.length > 1) {
          const b = window.L.latLngBounds(pts);
          st.map.fitBounds(b.pad(0.25), { animate: false });
        }
      }

      return; // Leaflet sukses
    } catch (e) {
      console.warn('[dashboard-api] Leaflet minimap failed, fallback iframe', e);
    }
  }

  // ===== Fallback iframe embed (tanpa POI markers) =====
  if (frame && Number.isFinite(lat) && Number.isFinite(lon)) {
    if (mapEl) mapEl.style.display = 'none';
    frame.style.display = 'block';

    const d = 0.01; // ~1km
    const left = lon - d, right = lon + d, top = lat + d, bottom = lat - d;
    const bbox = `${left},${bottom},${right},${top}`;
    frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(lat + ',' + lon)}`;
  }
}

// kompatibilitas: kalau ada pemanggilan lama
function updateMiniMapStatic(p) {
  showMiniMapLoading(p);
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
    // minimap akan diupdate setelah /overview didapat (agar name/lat/lon/POI konsisten)

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
      const [overview, demo, trafficHourly, trafficDaily] = await Promise.all([
        fetchJson('/overview', p),
        fetchJson('/demography', p),
        fetchJson('/traffic', { ...p, granularity: 'hourly' }),
        fetchJson('/traffic', { ...p, granularity: 'daily' }),
      ]);

      if (seq !== reqSeq) return;

      // pastikan minimap selalu pakai data overview terbaru (name/lat/lon/poi)
      updateMiniMapFromOverview(overview, p);

      updateDemographyCharts(demo);
      updateHourlyChart(hourlyRowsToAvg24(trafficHourly));
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

    // Populate dropdowns (pakai sites sebagai sumber utama agar City/Type selalu konsisten)
  if (Array.isArray(f?.sites)) populateLocations(f.sites);

  // Apply override mapping (XLS) agar City/Type OOH sinkron dengan data referensi
  applySiteOverrides();

  // Derive Cities & OOH Types dari sitesCache (lebih akurat daripada f.cities/f.ooh_types yang kadang tidak lengkap)
  const derivedCities = Array.from(new Set((sitesCache || []).map(s => titleCaseCity(String(s.city || '').trim())).filter(Boolean))).sort();
  const derivedOOH = Array.from(new Set((sitesCache || []).map(s => String(s.ooh_type || '').trim()).filter(Boolean))).sort();

  populateCities(derivedCities);
  populateOOHTypes(derivedOOH);

  // Setelah override + populate, rebuild lokasi supaya option text & dataset ikut update
  rebuildLocationOptions();

  // Pastikan dropdown City & Type OOH mencakup semua nilai yang ada di sites (untuk kasus edge)
  ensureCityOOHOptionsFromSites();

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
  }

  async function boot() {
    try {
      bindUI();
      await initFiltersFromApi();
      // Set default filter netral agar lokasi tidak ter-filter sebelum state tersinkron
      if (els.city()) els.city().value = '';
      if (els.ooh()) els.ooh().value = '';
      rebuildLocationOptions();
      const restored = restoreFilterState();
      if (restored) {
        // setelah restore, paksa City & Type OOH mengikuti lokasi terpilih agar tidak mismatch
        syncCityTypeFromLocation(true);
        // lalu rebuild lokasi berdasarkan City/Type yang sudah sinkron
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



// ==============================
// Export PDF (print-to-PDF, Safari-safe)
// ==============================
(function(){
  function safePrint(){
    try { document.body.classList.add('pdf-mode'); } catch(e){}
    // Small delay so layout settles (Leaflet tiles/Charts)
    setTimeout(function(){
      window.print();
      // remove after print (some browsers fire afterprint)
      setTimeout(function(){ try { document.body.classList.remove('pdf-mode'); } catch(e){} }, 500);
    }, 350);
  }

  window.addEventListener('afterprint', function(){
    try { document.body.classList.remove('pdf-mode'); } catch(e){}
  });

  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('btnExportPdf');
    if (!btn) return;
    btn.addEventListener('click', function(e){
      if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.preventDefault();
      safePrint();
    });
  });
})();
