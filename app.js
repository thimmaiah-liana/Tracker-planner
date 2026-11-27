// ── Tracker's Planner ──
// Field team scheduling app backed by Google Sheets

const SHIFTS = [
  { key: 'Morning', label: 'Morning Visit', defaultTime: '06:00' },
  { key: 'Midday', label: 'Midday Visit', defaultTime: '12:00' },
  { key: 'Evening', label: 'Evening Visit', defaultTime: '17:00' },
];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MEMBER_COLORS = ['#1a7a3a','#d97706','#4f46e5','#dc2626','#059669','#9333ea','#0891b2','#c2410c'];

// ── State ──
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbz8YHy-ZQYlvGnejarCyJdCmrZU29eb1atynUlS1xJdRoDyQa_pxyzuA17Wy1S15DDRpg/exec';
let apiUrl = '';
let teamPairs = [];
let leadsList = [];
let supportsList = [];
let schedules = [];
let viewYear, viewMonth;
let currentUser = '';
let currentPage = 'calendar';
let shiftTimes = {};

const now = new Date();
viewYear = now.getFullYear();
viewMonth = now.getMonth();

// ── Init ──
function init() {
  loadLocalSettings();

  if (!currentUser) {
    showNamePrompt();
    return;
  }

  updateUserDisplay();
  setupNavigation();
  setupMobileMenu();
  setupModal();

  history.replaceState({ page: 'calendar' }, '', '#calendar');

  fetchAll();
}

function loadLocalSettings() {
  try {
    apiUrl = DEFAULT_API_URL;
    currentUser = localStorage.getItem('tp_username') || '';
    const saved = localStorage.getItem('tp_shift_times');
    if (saved) shiftTimes = JSON.parse(saved);
  } catch (e) {}
}

function showNamePrompt() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="page" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
      <div style="text-align:center;max-width:360px">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;margin-bottom:8px">Welcome</div>
        <p style="color:var(--fg-secondary);font-size:13px;margin-bottom:20px">Enter your name so we can show your assigned field visits.</p>
        <div style="display:flex;gap:8px">
          <input type="text" id="name-input" class="input" placeholder="Your name" style="flex:1" autofocus>
          <button class="btn-primary" id="name-submit">Continue</button>
        </div>
      </div>
    </section>`;

  const submit = () => {
    const val = document.getElementById('name-input').value.trim();
    if (!val) return;
    currentUser = val;
    try { localStorage.setItem('tp_username', currentUser); } catch (e) {}
    window.location.reload();
  };

  document.getElementById('name-submit').addEventListener('click', submit);
  document.getElementById('name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });
}

function updateUserDisplay() {
  const initials = getInitials(currentUser);
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent = currentUser;
  document.getElementById('mobile-avatar').textContent = initials;
}

// ── Navigation ──
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  document.getElementById('prev-month').addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    renderCalendar();
  });

  document.getElementById('add-lead-btn').addEventListener('click', () => addPerson('lead'));
  document.getElementById('add-support-btn').addEventListener('click', () => addPerson('support'));
  document.getElementById('save-times-btn').addEventListener('click', saveTimes);

  document.getElementById('new-lead').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPerson('lead');
  });
  document.getElementById('new-support').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPerson('support');
  });
}

function setupMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  let overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.getElementById('app').appendChild(overlay);

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  });
}

let pageHistory = ['calendar'];

function showPage(page, pushState = true) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById('page-' + page).style.display = 'block';

  if (pushState) {
    if (pageHistory[pageHistory.length - 1] !== page) {
      pageHistory.push(page);
    }
    history.pushState({ page }, '', '#' + page);
  }

  if (page === 'calendar') renderCalendar();
  if (page === 'today') renderToday();
  if (page === 'settings') renderSettings();
}

let backCount = 0;
let backTimer = null;

window.addEventListener('popstate', (e) => {
  // If modal is open, close it
  const overlay = document.getElementById('modal-overlay');
  if (overlay && overlay.classList.contains('open') && !e.state?.modal) {
    closeModal(true);
    backCount = 0;
    return;
  }

  if (e.state?.page && !e.state?.modal) {
    pageHistory.pop();
    showPage(e.state.page, false);
    backCount = 0;
    return;
  }

  if (pageHistory.length > 1) {
    pageHistory.pop();
    const prev = pageHistory[pageHistory.length - 1];
    showPage(prev, false);
    history.pushState({ page: prev }, '', '#' + prev);
    backCount = 0;
  } else {
    backCount++;
    if (backCount >= 2) {
      window.close();
      history.back();
    } else {
      history.pushState({ page: currentPage }, '', '#' + currentPage);
      showToast('Press back again to exit');
      clearTimeout(backTimer);
      backTimer = setTimeout(() => { backCount = 0; }, 2000);
    }
  }
});

// ── API ──

let loadingBar;
function showLoading() {
  if (!loadingBar) {
    loadingBar = document.createElement('div');
    loadingBar.className = 'loading-bar';
    document.getElementById('app').appendChild(loadingBar);
  }
  loadingBar.classList.remove('done');
  requestAnimationFrame(() => loadingBar.classList.add('active'));
}
function hideLoading() {
  if (loadingBar) {
    loadingBar.classList.remove('active');
    loadingBar.classList.add('done');
    setTimeout(() => loadingBar.classList.remove('done'), 300);
  }
}

async function apiGet(action, params = {}) {
  if (!apiUrl) return null;
  const url = new URL(apiUrl);
  url.searchParams.set('action', action);
  for (const k in params) url.searchParams.set(k, params[k]);
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(data) {
  if (!apiUrl) return null;
  const res = await fetch(apiUrl, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'text/plain' },
  });
  return res.json();
}

async function fetchAll() {
  showLoading();
  try {
    const [teamRes, schedRes] = await Promise.all([
      apiGet('getTeam'),
      apiGet('getSchedule'),
    ]);

    if (teamRes?.members) teamPairs = teamRes.members;
    if (teamRes?.leads) leadsList = teamRes.leads;
    if (teamRes?.supports) supportsList = teamRes.supports;
    if (schedRes?.schedule) schedules = schedRes.schedule;

    applyTimes();
    render();
    scheduleReminders();
  } catch (e) {
    console.error('Fetch failed:', e);
    showToast('Failed to load data');
  } finally {
    hideLoading();
  }
}

function applyTimes() {
  const mt = document.getElementById('time-morning');
  const md = document.getElementById('time-midday');
  const ev = document.getElementById('time-evening');
  if (mt && shiftTimes['Morning']) mt.value = shiftTimes['Morning'];
  if (md && shiftTimes['Midday']) md.value = shiftTimes['Midday'];
  if (ev && shiftTimes['Evening']) ev.value = shiftTimes['Evening'];
}

function getLeads() {
  if (leadsList.length) return leadsList.map(l => l.name);
  return [...new Set(teamPairs.map(p => p.lead).filter(Boolean))];
}

function getSupports() {
  if (supportsList.length) return supportsList.map(s => s.name);
  return [...new Set(teamPairs.map(p => p.support).filter(Boolean))];
}

// ── Render ──
function render() {
  if (currentPage === 'calendar') renderCalendar();
  if (currentPage === 'today') renderToday();
  if (currentPage === 'settings') renderSettings();
}

// ── Calendar ──
function renderCalendar() {
  const monthEl = document.getElementById('cal-month');
  monthEl.textContent = MONTHS[viewMonth] + ' ' + viewYear;

  const grid = document.getElementById('calendar-grid');
  const first = new Date(viewYear, viewMonth, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();
  const today = new Date();
  const todayStr = dateKey(today);

  let html = '';
  DAYS_SHORT.forEach(d => { html += `<div class="cal-head">${d}</div>`; });

  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDay + 1;
    let realDate, otherMonth = false;

    if (dayNum < 1) {
      realDate = new Date(viewYear, viewMonth - 1, prevDays + dayNum);
      otherMonth = true;
    } else if (dayNum > daysInMonth) {
      realDate = new Date(viewYear, viewMonth + 1, dayNum - daysInMonth);
      otherMonth = true;
    } else {
      realDate = new Date(viewYear, viewMonth, dayNum);
    }

    const dk = dateKey(realDate);
    const isToday = dk === todayStr;
    const daySchedules = getSchedulesForDate(dk);

    html += `<div class="cal-cell${otherMonth ? ' other' : ''}${isToday ? ' today' : ''}" data-date="${dk}">`;
    html += `<div class="cal-cell-num">${realDate.getDate()}</div>`;

    if (daySchedules.length > 0) {
      html += '<div class="cal-sessions">';
      daySchedules.forEach(s => {
        const cls = s.time.toLowerCase();
        const past = isPastSession(dk, s.time) ? ' past' : '';
        const leadInit = s.lead ? s.lead[0].toUpperCase() : '?';
        const supportNames = s.support ? s.support.split(',').map(x => x.trim()).filter(Boolean) : [];
        html += `<div class="cal-session ${cls}${past}">`;
        html += `<span class="session-shift-dot"></span>`;
        html += `<span class="session-circle lead" title="${esc(s.lead || 'Unassigned')}">${esc(leadInit)}</span>`;
        supportNames.forEach(name => {
          html += `<span class="session-circle support" title="${esc(name)}">${esc(name[0].toUpperCase())}</span>`;
        });
        if (supportNames.length === 0) {
          html += `<span class="session-circle support empty" title="No support">?</span>`;
        }
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="cal-dots">';
      daySchedules.forEach(s => {
        const cls = s.time.toLowerCase();
        html += `<div class="cal-dot" style="background:var(--${cls})"></div>`;
      });
      html += '</div>';
    }

    html += '</div>';
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-cell:not(.other)').forEach(cell => {
    cell.addEventListener('click', () => openDayModal(cell.dataset.date));
  });
}

// ── Today ──
function renderToday() {
  const dateEl = document.getElementById('today-date');
  const content = document.getElementById('today-content');
  const today = new Date();
  dateEl.textContent = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const dk = dateKey(today);
  const daySchedules = getSchedulesForDate(dk);

  if (daySchedules.length === 0 && teamPairs.length === 0) {
    content.innerHTML = `<div class="empty-state">
      <p>No visits scheduled for today.</p>
      <p>Add team members in Settings and assign them from the Calendar.</p>
    </div>`;
    return;
  }

  content.innerHTML = SHIFTS.map(shift => {
    const sched = daySchedules.find(s => s.time === shift.key);
    const time = shiftTimes[shift.key] || shift.defaultTime;
    const lead = sched?.lead || '';
    const support = sched?.support || '';
    const cls = shift.key.toLowerCase();

    const supportNames = support ? support.split(',').map(x => x.trim()).filter(Boolean) : [];

    let yourRole = '';
    if (lead.toUpperCase() === currentUser.toUpperCase()) yourRole = 'Lead';
    else if (supportNames.some(n => n.toUpperCase() === currentUser.toUpperCase())) yourRole = 'Support';

    return `<div class="today-card">
      <div class="today-card-header">
        <div>
          <div class="today-shift-name">${shift.label}</div>
          <div class="today-shift-time">${formatTime(time)}</div>
        </div>
        <span class="shift-badge ${cls}">${shift.key}</span>
      </div>
      <div class="assign-grid">
        <div class="assign-block">
          <div class="assign-label">Lead</div>
          <div class="assign-value ${lead ? '' : 'empty'}">${esc(lead) || 'Not assigned'}</div>
        </div>
        <div class="assign-block">
          <div class="assign-label">Support</div>
          <div class="assign-value ${support ? '' : 'empty'}">${supportNames.length ? supportNames.map(n => esc(n)).join(', ') : 'Not assigned'}</div>
        </div>
      </div>
      ${yourRole ? `<div class="your-role-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        You are assigned as ${yourRole}
      </div>` : ''}
    </div>`;
  }).join('');
}

// ── Settings ──
function renderSettings() {
  renderPersonList('lead-list', getLeads(), leadsList, 'lead');
  renderPersonList('support-list', getSupports(), supportsList, 'support');
}

function renderPersonList(containerId, names, listData, role) {
  const list = document.getElementById(containerId);
  if (!list) return;

  if (names.length === 0) {
    list.innerHTML = `<div class="empty-state">No ${role}s yet.</div>`;
    return;
  }

  list.innerHTML = names.map((name, i) => {
    const entry = listData.find(e => e.name === name);
    const row = entry?.row || null;
    return `<div class="member-row">
      <div class="member-info">
        <div class="member-initials" style="background:${MEMBER_COLORS[i % MEMBER_COLORS.length]}">${getInitials(name)}</div>
        <div class="member-details">
          <div class="member-name">${esc(name)}</div>
        </div>
      </div>
      <button class="remove-btn" data-name="${esc(name)}" ${row ? `data-row="${row}"` : ''} data-role="${role}" title="Remove">&times;</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.dataset.row ? parseInt(btn.dataset.row) : null;
      const r = btn.dataset.role;
      const name = btn.dataset.name;
      if (row) {
        await removePerson(row, r);
      } else {
        await removePersonByName(name, r);
      }
    });
  });
}

// ── Modal ──
function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function openDayModal(dk) {
  const overlay = document.getElementById('modal-overlay');
  const dateEl = document.getElementById('modal-date');
  const weekdayEl = document.getElementById('modal-weekday');
  const body = document.getElementById('modal-body');

  const [y, m, d] = dk.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  dateEl.textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  weekdayEl.textContent = date.toLocaleDateString('en-US', { weekday: 'long' });

  const daySchedules = getSchedulesForDate(dk);
  const leads = getLeads();
  const supports = getSupports();

  body.innerHTML = SHIFTS.map(shift => {
    const sched = daySchedules.find(s => s.time === shift.key);
    const time = shiftTimes[shift.key] || shift.defaultTime;
    const cls = shift.key.toLowerCase();
    const currentLead = sched?.lead || '';
    const currentSupport = sched?.support || '';

    const currentSupports = currentSupport ? currentSupport.split(',').map(x => x.trim()) : [];

    return `<div class="shift-section ${cls}">
      <div class="shift-section-header">
        <span class="shift-section-title" style="color:var(--${cls})">${shift.label}</span>
        <span class="shift-section-time">${formatTime(time)}</span>
      </div>
      <div class="assign-row">
        <span class="assign-row-label">Lead</span>
        <select class="input select" data-date="${dk}" data-shift="${shift.key}" data-role="lead" style="flex:1">
          <option value="">— Select —</option>
          ${leads.map(name => `<option value="${esc(name)}" ${currentLead === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}
        </select>
      </div>
      <div class="assign-row" style="align-items:flex-start">
        <span class="assign-row-label" style="padding-top:4px">Support</span>
        <div class="support-checks" data-date="${dk}" data-shift="${shift.key}" style="flex:1">
          ${supports.map(name => `<label class="support-check-label">
            <input type="checkbox" value="${esc(name)}" ${currentSupports.includes(name) ? 'checked' : ''}>
            <span>${esc(name)}</span>
          </label>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');

  body.querySelectorAll('select[data-role="lead"]').forEach(sel => {
    sel.addEventListener('change', () => saveShiftAssignment(sel));
  });
  body.querySelectorAll('.support-checks input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const container = cb.closest('.support-checks');
      saveSupportAssignment(container);
    });
  });

  overlay.classList.add('open');
  history.pushState({ modal: true, page: currentPage }, '', '#modal');
}

function closeModal(fromPopstate) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay.classList.contains('open')) return;
  overlay.classList.remove('open');
  if (!fromPopstate) history.back();
}

// ── Data operations ──
async function addPerson(role) {
  const input = document.getElementById(role === 'lead' ? 'new-lead' : 'new-support');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }

  showLoading();
  try {
    await apiPost({ action: 'addPerson', role, name });
    input.value = '';
    await fetchAll();
    showToast(`${role === 'lead' ? 'Lead' : 'Support'} added`);
  } catch (e) {
    showToast('Failed to add');
  }
  hideLoading();
}

async function removePerson(row, role) {
  showLoading();
  try {
    await apiPost({ action: 'removePerson', role, row });
    await fetchAll();
    showToast('Removed');
  } catch (e) {
    showToast('Failed to remove');
  }
  hideLoading();
}

async function removePersonByName(name, role) {
  showLoading();
  try {
    await apiPost({ action: 'removePersonByName', role, name });
    await fetchAll();
    showToast('Removed');
  } catch (e) {
    showToast('Failed to remove');
  }
  hideLoading();
}

async function saveShiftAssignment(sel) {
  const dk = sel.dataset.date;
  const shift = sel.dataset.shift;

  const supportContainer = document.querySelector(`.support-checks[data-date="${dk}"][data-shift="${shift}"]`);
  const checkedSupports = supportContainer
    ? [...supportContainer.querySelectorAll('input:checked')].map(cb => cb.value).join(', ')
    : '';

  showLoading();
  try {
    await apiPost({
      action: 'saveSchedule',
      date: dk,
      time: shift,
      lead: sel.value,
      support: checkedSupports,
    });
    await fetchAll();
    showToast('Schedule updated');
  } catch (e) {
    showToast('Failed to save');
  }
  hideLoading();
}

async function saveSupportAssignment(container) {
  const dk = container.dataset.date;
  const shift = container.dataset.shift;

  const leadSel = document.querySelector(`select[data-date="${dk}"][data-shift="${shift}"][data-role="lead"]`);
  const checkedSupports = [...container.querySelectorAll('input:checked')].map(cb => cb.value).join(', ');

  showLoading();
  try {
    await apiPost({
      action: 'saveSchedule',
      date: dk,
      time: shift,
      lead: leadSel?.value || '',
      support: checkedSupports,
    });
    await fetchAll();
    showToast('Schedule updated');
  } catch (e) {
    showToast('Failed to save');
  }
  hideLoading();
}

function saveTimes() {
  shiftTimes['Morning'] = document.getElementById('time-morning').value;
  shiftTimes['Midday'] = document.getElementById('time-midday').value;
  shiftTimes['Evening'] = document.getElementById('time-evening').value;
  try { localStorage.setItem('tp_shift_times', JSON.stringify(shiftTimes)); } catch (e) {}
  showToast('Times saved');
}

// ── Notifications ──
const REMINDER_OFFSETS = [
  { minutes: 120, label: '2 hours' },
  { minutes: 30, label: '30 minutes' },
];

function scheduleReminders() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    document.addEventListener('click', function askOnce() {
      Notification.requestPermission();
      document.removeEventListener('click', askOnce);
    }, { once: true });
  }

  const dk = dateKey(new Date());
  const daySchedules = getSchedulesForDate(dk);

  daySchedules.forEach(sched => {
    const supList = sched.support ? sched.support.split(',').map(x => x.trim()) : [];
    const userUpper = currentUser.toUpperCase();
    const isLead = sched.lead.toUpperCase() === userUpper;
    const isSupport = supList.some(n => n.toUpperCase() === userUpper);
    if (!isLead && !isSupport) return;

    const shift = SHIFTS.find(s => s.key === sched.time);
    if (!shift) return;
    const time = shiftTimes[shift.key] || shift.defaultTime;
    const [h, m] = time.split(':').map(Number);
    const shiftDate = new Date();
    shiftDate.setHours(h, m, 0, 0);

    const role = isLead ? 'Lead' : 'Support';
    const partner = isLead
      ? (supList.length ? 'with ' + supList.join(', ') : '')
      : 'with ' + sched.lead;

    REMINDER_OFFSETS.forEach(offset => {
      const reminderTime = new Date(shiftDate.getTime() - offset.minutes * 60 * 1000);
      const msUntil = reminderTime.getTime() - Date.now();

      if (msUntil > 0 && msUntil < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification(`${shift.label} in ${offset.label}`, {
              body: `You are ${role} ${partner}`.trim(),
              tag: `tp-${dk}-${shift.key}-${offset.minutes}`,
              icon: 'icon-192.png',
            });
          }
        }, msUntil);
      }
    });
  });
}

// ── Helpers ──
function getSchedulesForDate(dk) {
  const all = schedules.filter(s => {
    const sDate = s.date instanceof Date ? dateKey(s.date) : normalizeDate(s.date);
    return sDate === dk;
  });
  const merged = {};
  all.forEach(s => {
    const key = s.time;
    if (!merged[key]) {
      merged[key] = { ...s };
    } else {
      if (s.lead && !merged[key].lead) merged[key].lead = s.lead;
      if (s.support && !merged[key].support) merged[key].support = s.support;
      else if (s.support && merged[key].support) {
        const existing = merged[key].support.split(',').map(x => x.trim()).filter(Boolean);
        const incoming = s.support.split(',').map(x => x.trim()).filter(Boolean);
        const combined = [...new Set([...existing, ...incoming])];
        merged[key].support = combined.join(', ');
      }
    }
  });
  return SHIFTS.map(sh => merged[sh.key]).filter(Boolean);
}

function isPastSession(dk, shiftKey) {
  const today = dateKey(new Date());
  if (dk < today) return true;
  if (dk > today) return false;
  const time = shiftTimes[shiftKey] || SHIFTS.find(s => s.key === shiftKey)?.defaultTime || '23:59';
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

function normalizeDate(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return dateKey(d);
  } catch (e) { return str; }
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Go ──
init();
