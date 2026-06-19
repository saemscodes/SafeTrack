/**
 * SafeTrack — Main App JS
 * Auth flows, screen management, socket setup, global state.
 */

// ── Global State ─────────────────────────────────────
window.AppState = {
  user: null,
  socket: null,
  contacts: [],
  groups: [],
  settings: null,
  locationWatchId: null,
  currentPanel: 'map',
  pingIntervalId: null,
  isOnline: navigator.onLine,
  isSmsMode: false,
  isDemoMode: false,
  sosTargetUserId: null, // for remote ping modal
};

// ── Boot ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = API.getUser();
  const token = API.getToken();
  if (user && token) {
    AppState.user = user;
    showApp();
  } else {
    showAuthTab('login');
  }

  // Connectivity monitoring
  window.addEventListener('online', () => updateConnectivity(true));
  window.addEventListener('offline', () => updateConnectivity(false));
});

// ── Auth Screens ─────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  btn.textContent = 'Signing in…';
  btn.disabled = true;
  try {
    const data = await API.post('/auth/login', {
      usernameOrPhone: document.getElementById('login-id').value.trim(),
      password: document.getElementById('login-pass').value
    });
    API.saveTokens(data.accessToken, data.refreshToken);
    API.saveUser(data.user);
    AppState.user = data.user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message || 'Login failed. Check your credentials.';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';
  btn.textContent = 'Creating account…';
  btn.disabled = true;
  try {
    const data = await API.post('/auth/register', {
      displayName: document.getElementById('reg-name').value.trim(),
      username: document.getElementById('reg-username').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      password: document.getElementById('reg-pass').value
    });
    API.saveTokens(data.accessToken, data.refreshToken);
    API.saveUser(data.user);
    AppState.user = data.user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message || 'Registration failed. Try a different username.';
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

function logout() {
  API.post('/auth/logout', { refreshToken: API.getRefresh() }).catch(() => {});
  if (AppState.socket) AppState.socket.disconnect();
  if (AppState.locationWatchId) navigator.geolocation.clearWatch(AppState.locationWatchId);
  if (AppState.pingIntervalId) clearInterval(AppState.pingIntervalId);
  API.clearTokens();
  AppState.user = null;
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('auth-screen').classList.remove('hidden');
}

// ── Show App ─────────────────────────────────────────
function showApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('active');

  // Populate profile UI
  const u = AppState.user;
  const initials = (u.displayName || u.username || '?')[0].toUpperCase();
  document.getElementById('nav-avatar').textContent = initials;
  document.getElementById('settings-avatar').textContent = initials;
  document.getElementById('settings-displayname').textContent = u.displayName || u.username;
  document.getElementById('settings-username').textContent = `@${u.username}`;
  document.getElementById('settings-phone').textContent = u.phone;

  // Init socket
  initSocket();

  // Load everything
  loadContacts();
  loadTrackers();
  loadAlerts();
  loadSettings();
  loadWatchers();

  // Start geolocation
  startLocationWatch();

  // Init map (in map.js)
  initMap();

  // Default panel
  goToPanel('map', document.getElementById('nav-map'));
}

// ── Panel Navigation ─────────────────────────────────
function goToPanel(name, btn) {
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById(`panel-${name}`);
  panel.classList.remove('hidden');
  panel.classList.add('active');
  btn.classList.add('active');
  AppState.currentPanel = name;

  if (name === 'map') {
    // Invalidate map size after transition
    setTimeout(() => AppMap && AppMap.map && AppMap.map.invalidateSize(), 100);
  }
}

function openPanel(name) {
  const btn = document.getElementById(`nav-${name}`);
  goToPanel(name, btn);
}

// ── Connectivity ─────────────────────────────────────
function updateConnectivity(online) {
  AppState.isOnline = online;
  const badge = document.getElementById('connectivity-badge');
  const label = badge.querySelector('.badge-label');
  badge.className = `badge ${online ? 'badge-online' : 'badge-offline'}`;
  label.textContent = online ? 'Online' : 'Offline — SMS mode';
  AppState.isSmsMode = !online;

  if (!online) {
    showToast('📵 No internet — switching to SMS fallback mode', 'warn', 5000);
  } else {
    showToast('✅ Back online', 'success');
  }
}

// ── Socket.IO ─────────────────────────────────────────
function initSocket() {
  if (AppState.isDemoMode) {
    console.log('[Demo Mode] Socket connection skipped.');
    AppState.socket = { emit: () => {}, disconnect: () => {}, on: () => {} };
    // Simulate some demo locations after map load
    setTimeout(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const ts = Date.now();
          const d1 = { userId: 'c1', lat: lat + 0.005, lng: lng + 0.005, accuracy: 20, timestamp: ts };
          const d2 = { userId: 'c2', lat: lat - 0.003, lng: lng - 0.004, accuracy: 15, timestamp: ts - 60000 };
          AppMap.updateContactPin(d1); updateContactLocationList(d1);
          AppMap.updateContactPin(d2); updateContactLocationList(d2);
        });
      }
    }, 2500);
    return;
  }

  const socket = window.io({
    auth: { token: API.getToken() },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    socket.emit('presence:online');
    // Subscribe to all contact locations
    AppState.contacts
      .filter(c => c.status === 'ACCEPTED')
      .forEach(c => socket.emit('subscribe:location', { targetUserId: c.contact.id }));
  });

  socket.on('location:update', (data) => {
    AppMap.updateContactPin(data);
    updateContactLocationList(data);
  });

  socket.on('sos:alert', (data) => {
    showToast(`🚨 SOS from ${data.triggeredById}! Tap Alerts to respond.`, 'sos', 10000);
    const badge = document.getElementById('alert-badge');
    badge.classList.remove('hidden');
    badge.textContent = parseInt(badge.textContent || '0') + 1;
    loadAlerts(); // reload inbox
  });

  socket.on('sos:ack', (data) => {
    showToast(`✅ ${data.status === 'ON_MY_WAY' ? '🏃 On my way!' : '👁 Seen'} — someone acknowledged your SOS`, 'success', 5000);
    loadAlerts();
  });

  socket.on('contact:request', () => {
    showToast('👤 New contact request!', 'info');
    loadContacts();
  });

  socket.on('contact:accepted', () => {
    showToast('✅ Contact request accepted!', 'success');
    loadContacts();
  });

  socket.on('contact:revoked', () => {
    showToast('⚠️ A contact has disconnected from you', 'warn');
    loadContacts();
  });

  socket.on('ping:forced', async ({ pingId, fromUserId }) => {
    // Respond immediately with current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        await API.post('/location/update', {
          lat, lng, accuracy,
          source: 'REMOTE_PING_FORCED',
          pingMechanism: 'MANUAL'
        }).catch(console.error);
      });
    }
  });

  socket.on('disconnect', () => console.log('[Socket] Disconnected'));
  socket.on('connect_error', (err) => console.warn('[Socket] Error:', err.message));

  AppState.socket = socket;
}

// ── Location Watching ─────────────────────────────────
function startLocationWatch() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    return;
  }

  AppState.locationWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng, accuracy, altitude, speed, heading } = pos.coords;
      AppMap.updateMyPin({ lat, lng, accuracy });

      // Send to backend (or queue for SMS if offline)
      if (AppState.isOnline) {
        await API.post('/location/update', {
          lat, lng, accuracy, altitude,
          speed, bearing: heading,
          source: 'NATIVE_GPS',
          pingMechanism: AppState.settings?.pingMode || 'MEDIUM'
        }).catch(console.error);
      } else {
        queueSMSUpdate(lat, lng, accuracy);
      }
    },
    (err) => console.warn('Geolocation error:', err.message),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

// ── SMS Fallback Queue ────────────────────────────────
let _smsQueue = [];
function queueSMSUpdate(lat, lng, accuracy) {
  const userId = AppState.user?.id || '';
  const payload = `LOC,${userId},${lat.toFixed(6)},${lng.toFixed(6)},${(accuracy||0).toFixed(1)},${getDeviceBattery()},${Date.now()}`;
  _smsQueue.push(payload);
  console.log('[SMS Fallback] Queued update:', payload);

  // Show user they are in SMS mode
  if (!AppState.isSmsMode) {
    showToast('📵 Location queued for SMS delivery', 'warn');
  }
}

function getDeviceBattery() {
  // Returns battery % if available
  return 99; // placeholder; real impl uses Battery API
}

// ── Modals ────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    toast.style.transition = '0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Live contact location list ────────────────────────
const _contactLocations = {};

function updateContactLocationList(data) {
  _contactLocations[data.userId] = data;
  renderContactLocationList();
}

function renderContactLocationList() {
  const list = document.getElementById('contact-location-list');
  const entries = Object.values(_contactLocations);
  if (!entries.length) { list.innerHTML = ''; return; }

  list.innerHTML = entries.map(d => {
    const contact = AppState.contacts.find(c => c.contact?.id === d.userId)?.contact;
    const name = contact?.displayName || contact?.username || d.userId.slice(0,8);
    const ago = getRelativeTime(new Date(d.timestamp));
    const init = name[0].toUpperCase();
    return `
      <div class="contact-loc-item" onclick="AppMap.flyToContact('${d.userId}')">
        <div class="cloc-avatar">${init}</div>
        <div class="cloc-info">
          <div class="cloc-name">${name}</div>
          <div class="cloc-time">Updated ${ago}</div>
        </div>
        <button class="cloc-ping" onclick="openRemotePing('${d.userId}','${name}');event.stopPropagation();" aria-label="Ping ${name}">Ping</button>
      </div>
    `;
  }).join('');
}

function openRemotePing(targetUserId, name) {
  AppState.sosTargetUserId = targetUserId;
  document.getElementById('ping-target-name').textContent = name;
  openModal('modal-remote-ping');
}

async function sendRemotePing() {
  const btn = document.getElementById('btn-send-ping');
  btn.disabled = true; btn.textContent = 'Pinging…';
  try {
    await API.post('/pings/request', { targetUserId: AppState.sosTargetUserId });
    showToast('📡 Ping sent — waiting for response', 'info', 4000);
    closeModal('modal-remote-ping');
  } catch (err) {
    showToast(`Ping failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Send Ping';
  }
}

// ── Helpers ───────────────────────────────────────────
function getRelativeTime(date) {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return date.toLocaleDateString();
}

function toggleSharing(enabled) {
  API.put('/settings', { locationSharingEnabled: enabled }).catch(console.error);
  document.getElementById('sharing-sub').textContent = enabled
    ? `Sharing with ${AppState.contacts.filter(c=>c.status==='ACCEPTED').length} contacts`
    : 'Sharing paused';
}

function openAddContact() { openModal('modal-add-contact'); }

async function switchAlertTab(tab, btn) {
  document.querySelectorAll('.alert-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('alerts-outbound').classList.toggle('hidden', tab !== 'outbound');
  document.getElementById('alerts-inbox').classList.toggle('hidden', tab !== 'inbox');
}

// ── Demo Mode ─────────────────────────────────────────
function startDemoMode() {
  AppState.isDemoMode = true;
  AppState.user = { id: 'demo123', username: 'demo_user', displayName: 'Jane Doe (Demo)', phone: '+1234567890' };
  showApp();
  showToast('Running in Interactive Demo Mode (No DB required)', 'info', 4000);
}

window.demoApiRequest = async function(path, options) {
  const method = options.method || 'GET';
  await new Promise(r => setTimeout(r, 100 + Math.random() * 200)); // fake delay
  
  if (path.startsWith('/contacts')) {
    if (method === 'GET') {
      if (path === '/contacts') return [
        { linkId: 'link1', status: 'ACCEPTED', contact: { id: 'c1', username: 'alice', displayName: 'Alice' } },
        { linkId: 'link2', status: 'ACCEPTED', contact: { id: 'c2', username: 'bob', displayName: 'Bob' } },
        { linkId: 'link3', status: 'PENDING', isInitiator: false, contact: { id: 'c3', username: 'charlie', displayName: 'Charlie' } }
      ];
      if (path === '/contacts/groups') return [
        { id: 'g1', name: 'Family Group', members: [{id: 'c1'}, {id:'c2'}] }
      ];
    }
    if (method === 'POST') return { id: 'group_new' };
    if (method === 'DELETE' || method === 'PUT') return {};
  }
  
  if (path.startsWith('/trackers')) {
    if (method === 'GET') return [
      { id: 't1', label: 'My Backpack', bleUuid: 'E2C56DB5', lastSeenLat: 34.05, lastSeenLng: -118.25, lastSeenAt: new Date().toISOString(), batteryPct: 88 }
    ];
    if (method === 'POST') return { id: 't2', label: 'Keys', bleUuid: 'AAAA' };
    if (method === 'DELETE' || method === 'PUT') return {};
  }
  
  if (path.startsWith('/sos')) {
    if (method === 'GET') {
      if (path.includes('events')) return [
        { id: 'ev1', mode: 'SILENT_ALERT', createdAt: new Date(Date.now() - 86400000).toISOString(), resolvedAt: new Date().toISOString(), notifications: [
          { notifiedId: 'alice', status: 'ON_MY_WAY' }
        ] }
      ];
      if (path.includes('inbox')) return [
        { id: 'n1', status: 'DELIVERED', createdAt: new Date().toISOString(), sosEvent: { id: 'e1', mode: 'SILENT_ALERT', triggeredBy: { id: 'c1', displayName: 'Alice', username: 'alice' } } }
      ];
    }
    if (method === 'POST') {
      setTimeout(() => {
        if (AppMap && AppMap.map) {
          navigator.geolocation.getCurrentPosition(pos => {
            AppMap.addSOSMarker(pos.coords.latitude, pos.coords.longitude, 'Test SOS');
          });
        }
      }, 500);
      return { eventId: 'demo_event', notifiedCount: 2 };
    }
    if (method === 'PUT') return {};
  }
  
  if (path.startsWith('/settings')) {
    if (method === 'GET') return { pingMode: 'MEDIUM', adaptivePingEnabled: true, sosMode: 'SILENT_ALERT', retentionDays: 30, pingPresets: [{mode:'MEDIUM', batteryImpact:'Moderate'}] };
    if (method === 'PUT') return JSON.parse(options.body || '{}');
  }
  
  if (path.startsWith('/location/watchers')) {
    return [
      { linkId: 'link1', user: { id: 'c1', username: 'alice', displayName: 'Alice' } }
    ];
  }
  
  if (path === '/location/update') return {};
  if (path === '/pings/request') return {};
  if (path.startsWith('/users/search')) return [
       { id: 'search1', username: 'john_doe', displayName: 'John Doe' },
       { id: 'search2', username: 'jane_smith', displayName: 'Jane Smith' }
  ];
  if (path === '/auth/logout') return {};
  
  return {};
};
