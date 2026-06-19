/**
 * SafeTrack — SOS Module
 */

let _sosLat = null, _sosMng = null;

/**
 * Step 1: User taps SOS → show confirmation modal with current location.
 * The device shows NO visible feedback (per Silent Alert spec).
 */
function triggerSOS() {
  document.getElementById('sos-location-preview').textContent = 'Getting your location…';
  openModal('modal-sos-confirm');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        _sosLat = pos.coords.latitude;
        _sosMng = pos.coords.longitude;
        document.getElementById('sos-location-preview').textContent =
          `📍 ${_sosLat.toFixed(5)}, ${_sosMng.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m)`;
      },
      () => {
        document.getElementById('sos-location-preview').textContent = 'Location unavailable — SOS will be sent without exact coordinates';
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    document.getElementById('sos-location-preview').textContent = 'Geolocation not supported on this device';
  }
}

/**
 * Step 2: User confirms → fire the SOS alert silently.
 */
async function fireSOS() {
  const btn = document.getElementById('btn-sos-fire');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const settings = AppState.settings;
    const result = await API.post('/sos/trigger', {
      lat: _sosLat || 0,
      lng: _sosMng || 0,
      mode: settings?.sosMode || 'SILENT_ALERT',
      groupId: settings?.sosGroupId || null
    });

    closeModal('modal-sos-confirm');

    // Show SOS marker on map (only for the triggering user)
    if (_sosLat && _sosMng) {
      AppMap.addSOSMarker(_sosLat, _sosMng, 'Your SOS');
    }

    // Switch to alerts panel to show ack status
    showToast(`🚨 Alert sent to ${result.notifiedCount} contact(s)`, 'info', 5000);
    goToPanel('alerts', document.getElementById('nav-alerts'));
    loadAlerts();
  } catch (err) {
    showToast(`SOS failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Alert';
  }
}

/**
 * Load SOS alerts (outbound events & inbox).
 */
async function loadAlerts() {
  loadOutboundAlerts();
  loadInboxAlerts();
}

async function loadOutboundAlerts() {
  try {
    const events = await API.get('/sos/events');
    const list = document.getElementById('alerts-outbound');
    if (!events.length) {
      list.innerHTML = '<div class="empty-state">No SOS events triggered yet</div>';
      return;
    }
    list.innerHTML = events.map(ev => renderSosEvent(ev)).join('');
  } catch (err) {
    console.error('Load SOS events error:', err);
  }
}

function renderSosEvent(ev) {
  const isResolved = !!ev.resolvedAt;
  const timeStr = new Date(ev.createdAt).toLocaleString();
  const acks = ev.notifications || [];
  return `
    <div class="sos-event-card">
      <div class="sos-event-header">
        <div class="sos-event-indicator ${isResolved ? 'resolved' : ''}"></div>
        <div class="sos-event-info">
          <div class="sos-event-title">🚨 SOS — ${ev.mode.replace(/_/g,' ')}</div>
          <div class="sos-event-time">${timeStr}</div>
        </div>
        ${!isResolved ? `<button class="sos-resolve-btn" onclick="resolveSOS('${ev.id}')" aria-label="Mark SOS as resolved">Resolve</button>` : '<span style="font-size:12px;color:var(--clr-success)">✓ Resolved</span>'}
      </div>
      ${acks.length ? `
        <div class="sos-ack-list">
          ${acks.map(a => `
            <div class="sos-ack-item">
              <span class="sos-ack-name">${escHtml(a.notifiedId.slice(0,8))}…</span>
              <span class="sos-ack-status ${getAckClass(a.status)}">${formatAckStatus(a.status)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

async function resolveSOS(eventId) {
  try {
    await API.put(`/sos/${eventId}/resolve`, {});
    showToast('SOS event resolved', 'success');
    loadOutboundAlerts();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}

async function loadInboxAlerts() {
  try {
    const items = await API.get('/sos/inbox');
    const list = document.getElementById('alerts-inbox');

    // Update badge
    const unacked = items.filter(i => i.status === 'SENT' || i.status === 'DELIVERED');
    const badge = document.getElementById('alert-badge');
    badge.textContent = unacked.length;
    badge.classList.toggle('hidden', unacked.length === 0);

    if (!items.length) {
      list.innerHTML = '<div class="empty-state">No SOS alerts received</div>';
      return;
    }
    list.innerHTML = items.map(n => renderInboxItem(n)).join('');
  } catch (err) {
    console.error('Load inbox error:', err);
  }
}

function renderInboxItem(n) {
  const ev = n.sosEvent;
  const from = ev.triggeredBy;
  const name = from.displayName || from.username;
  const timeStr = new Date(n.createdAt).toLocaleString();
  const status = n.status;
  const canAck = status === 'SENT' || status === 'DELIVERED';

  return `
    <div class="sos-inbox-item">
      <div class="sos-inbox-icon">🚨</div>
      <div class="sos-inbox-info">
        <div class="sos-inbox-from">${escHtml(name)} sent an SOS</div>
        <div class="sos-inbox-time">${timeStr}</div>
      </div>
      ${canAck ? `
        <div class="sos-inbox-actions">
          <button class="btn-ack-seen" onclick="ackSOS('${ev.id}','Seen',this)" aria-label="Mark as seen">Seen</button>
          <button class="btn-ack-way" onclick="ackSOS('${ev.id}','On my way',this)" aria-label="Respond on my way">🏃 On Way</button>
        </div>
      ` : `<span style="font-size:12px;color:var(--clr-success);font-weight:600">${formatAckStatus(status)}</span>`}
    </div>
  `;
}

async function ackSOS(eventId, message, btn) {
  btn.disabled = true;
  try {
    await API.put(`/sos/${eventId}/ack`, { ackMessage: message });
    showToast(`SOS acknowledged — "${message}"`, 'success');
    await loadInboxAlerts();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

function getAckClass(status) {
  if (status === 'ON_MY_WAY') return 'ack-on-way';
  if (status === 'SEEN') return 'ack-seen';
  return 'ack-sent';
}

function formatAckStatus(status) {
  return status === 'ON_MY_WAY' ? '🏃 On my way' : status === 'SEEN' ? '👁 Seen' : '⏳ Sent';
}
