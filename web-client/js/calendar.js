/**
 * SafeTrack — Calendar Module (Fully Functional Decoy)
 * Renders a real iOS-inspired calendar. Also acts as the
 * universal auth entry point via the search bar.
 */

const CalendarApp = (() => {
  // ── State ─────────────────────────────────────────────────
  let currentDate = new Date();
  let selectedDate = null;
  let events = JSON.parse(localStorage.getItem('cal_events') || '[]');
  let view = 'month'; // month | week | day | agenda

  // ── Persist events locally (Supabase sync overlaid on top) ─
  function saveEvents() {
    localStorage.setItem('cal_events', JSON.stringify(events));
  }

  function getEventsOn(date) {
    const ds = dateStr(date);
    return events.filter(e => e.start_at && e.start_at.startsWith(ds));
  }

  function dateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const EVENT_COLORS = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#5AC8FA','#FF2D55'];

  // ── Render calendar grid (month view) ────────────────────
  function renderMonth() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    document.getElementById('cal-month-label').textContent = `${MONTHS[month]} ${year}`;

    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';

    // Day headers
    DAYS.forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-day-header';
      el.textContent = d;
      grid.appendChild(el);
    });

    // Empty cells before month start
    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'cal-day-cell cal-day-empty';
      grid.appendChild(el);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      cellDate.setHours(0,0,0,0);
      const dayEvents = getEventsOn(cellDate);
      const isToday = cellDate.getTime() === today.getTime();
      const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime();

      const el = document.createElement('div');
      el.className = `cal-day-cell${isToday ? ' cal-today' : ''}${isSelected ? ' cal-selected' : ''}`;
      el.dataset.date = dateStr(cellDate);
      el.innerHTML = `
        <span class="cal-day-num">${d}</span>
        <div class="cal-day-dots">
          ${dayEvents.slice(0,3).map(ev =>
            `<span class="cal-event-dot" style="background:${ev.color || '#007AFF'}"></span>`
          ).join('')}
        </div>
      `;
      el.onclick = () => selectDate(cellDate);
      grid.appendChild(el);
    }
  }

  function selectDate(date) {
    selectedDate = date;
    renderMonth();
    renderDayDetail(date);
  }

  function renderDayDetail(date) {
    const dayEvents = getEventsOn(date);
    const panel = document.getElementById('cal-day-detail');
    const label = document.getElementById('cal-detail-label');
    const list = document.getElementById('cal-detail-events');

    label.textContent = `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

    if (!dayEvents.length) {
      list.innerHTML = '<div class="cal-no-events">No events</div>';
    } else {
      list.innerHTML = dayEvents.map(ev => `
        <div class="cal-event-row" onclick="CalendarApp.openEditEvent('${ev.id}')">
          <div class="cal-event-side" style="background:${ev.color || '#007AFF'}"></div>
          <div class="cal-event-body">
            <div class="cal-event-title">${escCal(ev.title)}</div>
            <div class="cal-event-time">${ev.all_day ? 'All day' : formatEventTime(ev)}</div>
            ${ev.location ? `<div class="cal-event-location">📍 ${escCal(ev.location)}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    panel.classList.remove('hidden');
  }

  function formatEventTime(ev) {
    if (!ev.start_at) return '';
    const start = new Date(ev.start_at);
    const end = ev.end_at ? new Date(ev.end_at) : null;
    const fmt = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
  }

  function escCal(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Navigation ────────────────────────────────────────────
  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderMonth();
  }
  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderMonth();
  }
  function goToday() {
    currentDate = new Date();
    selectedDate = null;
    renderMonth();
    document.getElementById('cal-day-detail').classList.add('hidden');
  }

  // ── Event CRUD ────────────────────────────────────────────
  let editingEventId = null;

  function openNewEvent(dateObj) {
    editingEventId = null;
    const d = dateObj || selectedDate || new Date();
    const ds = dateStr(d);

    document.getElementById('cal-modal-title-label').textContent = 'New Event';
    document.getElementById('cal-event-title-input').value = '';
    document.getElementById('cal-event-desc').value = '';
    document.getElementById('cal-event-start').value = `${ds}T09:00`;
    document.getElementById('cal-event-end').value = `${ds}T10:00`;
    document.getElementById('cal-event-location').value = '';
    document.getElementById('cal-event-allday').checked = false;
    document.getElementById('cal-event-delete-btn').style.display = 'none';

    // Reset color selector
    document.querySelectorAll('.cal-color-swatch').forEach((sw, i) => {
      sw.classList.toggle('selected', i === 0);
    });

    document.getElementById('cal-event-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('cal-event-title-input').focus(), 50);
  }

  function openEditEvent(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    editingEventId = id;

    document.getElementById('cal-modal-title-label').textContent = 'Edit Event';
    document.getElementById('cal-event-title-input').value = ev.title;
    document.getElementById('cal-event-desc').value = ev.description || '';
    document.getElementById('cal-event-start').value = (ev.start_at || '').replace('Z','').slice(0,16);
    document.getElementById('cal-event-end').value = (ev.end_at || '').replace('Z','').slice(0,16);
    document.getElementById('cal-event-location').value = ev.location || '';
    document.getElementById('cal-event-allday').checked = ev.all_day || false;
    document.getElementById('cal-event-delete-btn').style.display = 'block';

    document.querySelectorAll('.cal-color-swatch').forEach(sw => {
      sw.classList.toggle('selected', sw.dataset.color === (ev.color || '#007AFF'));
    });

    document.getElementById('cal-event-modal').classList.remove('hidden');
  }

  function closeEventModal() {
    document.getElementById('cal-event-modal').classList.add('hidden');
  }

  function saveEvent() {
    const title = document.getElementById('cal-event-title-input').value.trim();
    if (!title) {
      document.getElementById('cal-event-title-input').focus();
      return;
    }

    const color = document.querySelector('.cal-color-swatch.selected')?.dataset.color || '#007AFF';
    const ev = {
      id: editingEventId || crypto.randomUUID(),
      title,
      description: document.getElementById('cal-event-desc').value.trim(),
      start_at: document.getElementById('cal-event-start').value,
      end_at: document.getElementById('cal-event-end').value,
      location: document.getElementById('cal-event-location').value.trim(),
      all_day: document.getElementById('cal-event-allday').checked,
      color,
    };

    if (editingEventId) {
      events = events.map(e => e.id === editingEventId ? ev : e);
    } else {
      events.push(ev);
    }

    saveEvents();
    renderMonth();
    if (selectedDate) renderDayDetail(selectedDate);
    closeEventModal();

    // Supabase sync (if authenticated)
    syncEventToServer(ev).catch(console.error);
  }

  function deleteEvent() {
    if (!editingEventId) return;
    if (!confirm('Delete this event?')) return;
    events = events.filter(e => e.id !== editingEventId);
    saveEvents();
    renderMonth();
    if (selectedDate) renderDayDetail(selectedDate);
    closeEventModal();
  }

  async function syncEventToServer(ev) {
    const token = localStorage.getItem('st_access_token');
    if (!token || !window.SUPABASE_URL) return;
    const url = `${window.SUPABASE_URL}/rest/v1/calendar_events`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(ev),
    });
  }

  // ── Search (local, instant) ───────────────────────────────
  function localSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return events.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }

  // ── Load events from server ───────────────────────────────
  async function loadFromServer() {
    const token = localStorage.getItem('st_access_token');
    if (!token || !window.SUPABASE_URL) return;
    try {
      const resp = await fetch(`${window.SUPABASE_URL}/rest/v1/calendar_events?order=start_at.asc`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': window.SUPABASE_ANON_KEY || '',
        },
      });
      if (!resp.ok) return;
      const serverEvents = await resp.json();
      events = serverEvents;
      saveEvents();
      renderMonth();
    } catch (e) {
      console.warn('[Calendar] Server sync failed, using local data');
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    renderMonth();
    selectDate(new Date()); // Select today by default
  }

  return {
    init,
    prevMonth,
    nextMonth,
    goToday,
    localSearch,
    openNewEvent,
    openEditEvent,
    closeEventModal,
    saveEvent,
    deleteEvent,
    loadFromServer,
    escCal,
  };
})();
