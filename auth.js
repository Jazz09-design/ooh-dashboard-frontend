(function () {
  const STORAGE_KEY = 'oma_auth';

  // Hardcode user demo (silakan ubah)
  const USERS = {
    'admin@pickooh.com': { password: 'admin123', role: 'admin', allowedCities: ['*'] },
    'demo@pickooh.com':  { password: 'demo123',  role: 'external', allowedCities: ['Bandung', 'Jakarta', 'Surabaya'] },
    'client@pickooh.com':{ password: 'client123',role: 'external', allowedCities: ['Bandung', 'Jakarta'] },
  };

  function nowTs() { return new Date().toISOString(); }

  function saveSession(session) {
    const payload = {
      email: session.email,
      role: session.role,
      allowedCities: session.allowedCities || ['*'],
      isDemo: !!session.isDemo,
      ts: nowTs(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      // key kompatibilitas (kalau file lama dashboard baca key ini)
      localStorage.setItem('oma_role', payload.role);
      localStorage.setItem('oma_allowedCities', JSON.stringify(payload.allowedCities));
      localStorage.setItem('demo_mode', payload.isDemo ? '1' : '0');
    } catch (e) {}
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // fallback key lama
    const role = (localStorage.getItem('oma_role') || '').trim();
    let allowedCities = ['*'];
    try {
      const rawCities = localStorage.getItem('oma_allowedCities');
      if (rawCities) allowedCities = JSON.parse(rawCities);
    } catch (e) {}
    if (role) return { email: '', role, allowedCities, isDemo: localStorage.getItem('demo_mode') === '1' };
    return null;
  }

  function clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('oma_role');
      localStorage.removeItem('oma_allowedCities');
      localStorage.removeItem('demo_mode');
    } catch (e) {}
  }

  // ===== API global kecil =====
  window.OMA_AUTH = {
    login(email, password) {
      const key = String(email || '').trim().toLowerCase();
      const user = USERS[key];
      if (!user) return { ok: false, message: 'User tidak ditemukan.' };
      if (String(password || '') !== user.password) return { ok: false, message: 'Password salah.' };

      saveSession({ email: key, role: user.role, allowedCities: user.allowedCities, isDemo: user.role !== 'admin' });
      return { ok: true, role: user.role };
    },

    enterDemo() {
      // default demo pakai user demo@pickooh.com (kalau ada)
      const fallback = USERS['demo@pickooh.com'] || { role: 'external', allowedCities: ['Bandung'] };
      saveSession({ email: 'demo@pickooh.com', role: fallback.role, allowedCities: fallback.allowedCities, isDemo: true });
      return { ok: true };
    },

    logout() {
      clearSession();
      return { ok: true };
    },

    requireAuth({ redirectTo = 'login.html' } = {}) {
      const session = readSession();
      if (!session || !session.role) {
        try { window.location.href = redirectTo; } catch (e) {}
        return null;
      }
      return session;
    },

    getSession() {
      return readSession();
    },

    applyCityRestrictions(selectEl) {
      const session = readSession();
      if (!session) return;
      const role = (session.role || '').toLowerCase();
      const allowed = Array.isArray(session.allowedCities) ? session.allowedCities : ['*'];
      if (role === 'admin' || allowed.includes('*')) return; // no restriction

      // Batasi opsi City (case-insensitive match)
      const allowedSet = new Set(allowed.map((c) => String(c).toLowerCase()));
      const sel = selectEl || document.getElementById('filterCity');
      if (!sel) return;

      const currentValue = (sel.value || '').toLowerCase();

      // Hapus option yang tidak diizinkan
      Array.from(sel.options).forEach((opt) => {
        const val = (opt.value || '').toLowerCase();
        // tetap boleh opsi kosong / "" / "all" kalau Mas punya
        const isSpecial = !val || val === 'all' || val === 'all cities' || val === 'semua' || val === 'all_cities';
        const isAllowed = allowedSet.has(val);
        if (!isSpecial && !isAllowed) {
          opt.disabled = true;
          opt.hidden = true;
        }
      });

      // Jika value sekarang tidak allowed, auto pilih allowed pertama
      if (currentValue && !allowedSet.has(currentValue)) {
        const firstAllowed = Array.from(sel.options).find((opt) => allowedSet.has((opt.value || '').toLowerCase()));
        if (firstAllowed) {
          sel.value = firstAllowed.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    },
  };
  // ====== UI helpers (Navbar + Sidebar) ======
  function _omaNormalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'administrator') return 'admin';
    return r || 'external';
  }

  function _omaDisplayRole(role) {
    const r = _omaNormalizeRole(role);
    return r === 'admin' ? 'Administrator' : 'User Demo';
  }

  function _omaEnsureLogoutInDropdown(dropdownMenu) {
    if (!dropdownMenu) return;
    if (dropdownMenu.querySelector('[data-oma-action="logout"]')) return;

    const divider = document.createElement('li');
    divider.innerHTML = '<div class="dropdown-divider my-1"></div>';

    const li = document.createElement('li');
    li.innerHTML = `
      <a class="dropdown-item" href="javascript:void(0)" data-oma-action="logout">
        <i class="icon-base bx bx-power-off icon-md me-3"></i><span>Logout</span>
      </a>
    `;

    dropdownMenu.appendChild(divider);
    dropdownMenu.appendChild(li);

    const btn = li.querySelector('[data-oma-action="logout"]');
    if (btn) {
      btn.addEventListener('click', () => {
        try { window.OMA_AUTH.logout(); } catch (e) {}
        try { window.location.href = 'index.html'; } catch (e) {}
      });
    }
  }

  function _omaApplyNavbarSession(session) {
    // Template Sneat biasanya punya .dropdown-user
    const dropdown = document.querySelector('.dropdown-user');
    if (!dropdown) return;

    const menu = dropdown.querySelector('.dropdown-menu');
    if (!menu) return;

    // Update nama/role
    const nameEl = menu.querySelector('h6.mb-0');
    const roleEl = menu.querySelector('small.text-body-secondary');
    if (nameEl) nameEl.textContent = session.email || 'User';
    if (roleEl) roleEl.textContent = _omaDisplayRole(session.role);

    // External/demo/client: hide item lain selain header & logout
    const role = _omaNormalizeRole(session.role);
    if (role !== 'admin') {
      const items = Array.from(menu.querySelectorAll('li'));
      items.forEach((li, idx) => {
        const hasLogout = li.querySelector('[data-oma-action="logout"]');
        if (idx === 0 || hasLogout) return;
        li.style.display = 'none';
      });
    }

    _omaEnsureLogoutInDropdown(menu);
  }

  function _omaApplySidebarRestrictions(session) {
    const role = _omaNormalizeRole(session.role);
    const aside = document.getElementById('layout-menu');
    if (!aside) return;

    if (role === 'admin') return;

    // demo/client hanya boleh Dashboard & Foto Lokasi
    const allowedPages = new Set(['dashboard.html', 'location-photos.html']);

    const menuItems = Array.from(aside.querySelectorAll('ul.menu-inner > li.menu-item'));
    menuItems.forEach((li) => {
      const a = li.querySelector('a.menu-link');
      if (!a) return;
      const href = (a.getAttribute('href') || '').trim();
      const base = href.split('?')[0].split('#')[0];
      if (!allowedPages.has(base)) li.style.display = 'none';
    });

    // Kalau user external nyasar ke halaman lain, redirect ke dashboard
    const current = (location.pathname || '').split('/').pop() || '';
    if (current && /html$/i.test(current) && !allowedPages.has(current)) {
      try { location.replace('dashboard.html'); } catch (e) {}
    }
  }

  // Public helper
  window.OMA_AUTH.applyRoleUI = function () {
    const session = window.OMA_AUTH.getSession ? window.OMA_AUTH.getSession() : null;
    if (!session) return null;
    _omaApplyNavbarSession(session);
    _omaApplySidebarRestrictions(session);
    return session;
  };


  // Auto-runjika di dashboard: enforce auth + restrict city
  document.addEventListener('DOMContentLoaded', () => {
    // jangan force auth di landing/index & login
    const onLanding = /index\.html/i.test(location.pathname) || /\/$/.test(location.pathname);
    const onLogin = /login\.html/i.test(location.pathname) || document.body?.dataset?.page === 'login';
    if (onLanding || onLogin) return;

    const session = window.OMA_AUTH.requireAuth({ redirectTo: 'login.html' });
    if (!session) return;

    // Logout + menu kiri role-based
    if (window.OMA_AUTH.applyRoleUI) window.OMA_AUTH.applyRoleUI();

    // City restriction tetap (dropdown city biasanya terisi async)
    const isDashboard = /dashboard\.html/i.test(location.pathname) || document.body?.dataset?.page === 'dashboard';
    if (isDashboard) {
      setTimeout(() => window.OMA_AUTH.applyCityRestrictions(), 300);
      setTimeout(() => window.OMA_AUTH.applyCityRestrictions(), 1200);
    }
  });
})();
