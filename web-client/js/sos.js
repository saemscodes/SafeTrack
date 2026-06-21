/**
 * SafeTrack — SOS Module
 * Preserved original code, added native nostr-tools client-side signing constraint and triage relay logic.
 */

let _sosLat = null, _sosMng = null;

// Extracted globally for native gesture injection (e.g. Volume Down 3x bridged from Capacitor)
window.triggerNativeSOS = function() {
  triggerSOS(); 
  setTimeout(() => fireSOS(), 500); // Auto-fire natively bypassing UI confirmation
};

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
 * Utility: Simulates fetching memory-cached private key during active session
 */
async function _getMemoryPrivateKey() {
  // In production, this pulls from a highly secure memory enclave populated during login
  const stUser = localStorage.getItem('st_user');
  if (!stUser) return null;
  // This is a placeholder for the actual private key held in memory/secure storage
  return AppState.privKeyHex || null; 
}

/**
 * Step 2: User confirms → fire the SOS alert silently.
 * ZERO-EXPOSURE: Builds Nostr Event natively and signs it *before* it leaves the client.
 */
async function fireSOS() {
  const btn = document.getElementById('btn-sos-fire');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const settings = AppState.settings || {};
    const payload = JSON.stringify({
      lat: _sosLat || 0,
      lng: _sosMng || 0,
      mode: settings.sosMode || 'SILENT_ALERT',
      groupId: settings.sosGroupId || null,
      is_drill: settings.drillModeEnabled || false
    });

    const privKeyHex = await _getMemoryPrivateKey();
    let signedEvent = null;

    if (privKeyHex) {
      const { getEventHash, getSignature, getPublicKey } = await import('https://esm.sh/nostr-tools@1.17.0');
      signedEvent = {
        kind: 10001, // Custom SOS Payload kind
        pubkey: getPublicKey(privKeyHex),
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'sos'],
          ...(settings.drillModeEnabled ? [['drill', 'true']] : [])
        ],
        content: payload
      };
      signedEvent.id = getEventHash(signedEvent);
      signedEvent.sig = getSignature(signedEvent, privKeyHex);
    }

    // Attempt delivery to Edge Function, fallback to Service Worker Sync Queue
    if (!navigator.onLine && 'serviceWorker' in navigator && 'SyncManager' in window) {
      await cacheEventForBackgroundSync(signedEvent || { rawPayload: payload });
      showToast(`📵 Offline. Alert queued for Background Sync broadcast.`, 'warn', 5000);
      closeModal('modal-sos-confirm');
      return;
    }

    const result = await API.post('/sos/trigger', signedEvent || JSON.parse(payload));

    closeModal('modal-sos-confirm');

    // Show SOS marker on map (only for the triggering user)
    if (_sosLat && _sosMng) {
      AppMap.addSOSMarker(_sosLat, _sosMng, settings.drillModeEnabled ? 'DRILL: Your SOS' : 'Your SOS');
    }

    // Switch to alerts panel to show ack status
    showToast(`🚨 ${settings.drillModeEnabled ? 'DRILL ' : ''}Alert sent to ${result.notifiedCount || 'network'} contact(s)`, 'info', 5000);
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
 * Helper to cache offline SOS triggers for Service Worker Sync
 */
async function cacheEventForBackgroundSync(eventData) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('SafeTrackDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offline_sos')) {
        db.createObjectStore('offline_sos', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('offline_sos', 'readwrite');
      tx.objectStore('offline_sos').add({ data: eventData, timestamp: Date.now() });
      tx.oncomplete = () => {
        navigator.serviceWorker.ready.then(reg => {
          if (reg.sync) reg.sync.register('sync-sos');
        });
        resolve();
      };
      tx.onerror = reject;
    };
    request.onerror = reject;
  });
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
  const isDrill = ev.is_drill;
  const timeStr = new Date(ev.createdAt).toLocaleString();
  const acks = ev.notifications || [];
  return `
    <div class="sos-event-card">
      <div class="sos-event-header">
        <div class="sos-event-indicator ${isResolved ? 'resolved' : ''}" style="${isDrill ? 'background: var(--clr-amber); box-shadow: 0 0 10px var(--clr-amber)' : ''}"></div>
        <div class="sos-event-info">
          <div class="sos-event-title">${isDrill ? '🛡️ DRILL' : '🚨 SOS'} — ${ev.mode.replace(/_/g,' ')}</div>
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
    if (badge) {
       badge.textContent = unacked.length;
       badge.classList.toggle('hidden', unacked.length === 0);
    }
    
    // Specifically update the new internal Bell SVG badge
    if (window.IconResolver) {
       IconResolver.updateAlertBadge(unacked.length);
    }

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
  const isDrill = ev.is_drill;
  const canAck = status === 'SENT' || status === 'DELIVERED';

  return `
    <div class="sos-inbox-item" style="${isDrill ? 'border-left: 4px solid var(--clr-amber)' : 'border-left: 4px solid var(--clr-red)'}">
      <div class="sos-inbox-icon">${isDrill ? '🛡️' : '🚨'}</div>
      <div class="sos-inbox-info">
        <div class="sos-inbox-from">${escHtml(name)} sent a ${isDrill ? 'DRILL' : 'SOS'}</div>
        <div class="sos-inbox-time">${timeStr} <span style="opacity:0.5">· Hops: ${ev.hops || 1}</span></div>
      </div>
      ${canAck ? `
        <div class="sos-inbox-actions triage-pill-actions">
          <button class="btn-ack-seen" onclick="ackSOSEndpoint('${ev.id}','I will Help',this)" aria-label="Respond as Endpoint">🏃 I'll Help</button>
          <button class="btn-ack-way" onclick="relaySOSNode('${ev.id}', ${ev.hops || 1}, this)" aria-label="Relay to Network as Node">📡 Relay</button>
        </div>
      ` : `<span style="font-size:12px;color:var(--clr-success);font-weight:600">${formatAckStatus(status)}</span>`}
    </div>
  `;
}

/** Triage Core Mechanic: Response (ENDPOINT) */
async function ackSOSEndpoint(eventId, message, btn) {
  btn.disabled = true;
  try {
    await API.put(`/sos/${eventId}/ack`, { ackMessage: message, role: 'endpoint' });
    showToast(`SOS acknowledged — Heading there.`, 'success');
    await loadInboxAlerts();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

/** Triage Core Mechanic: Relay (NODE) */
async function relaySOSNode(originalEventId, currentHops, btn) {
  btn.disabled = true;
  try {
    const privKeyHex = await _getMemoryPrivateKey();
    let signedRelayEvent = null;

    // Build the NIP-01 Relay Broadcast Signed Event
    if (privKeyHex) {
      const { getEventHash, getSignature, getPublicKey } = await import('https://esm.sh/nostr-tools@1.17.0');
      signedRelayEvent = {
        kind: 10001,
        pubkey: getPublicKey(privKeyHex),
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', originalEventId],
          ['hops', (currentHops + 1).toString()]
        ],
        content: `Relaying SOS for ${originalEventId}`
      };
      signedRelayEvent.id = getEventHash(signedRelayEvent);
      signedRelayEvent.sig = getSignature(signedRelayEvent, privKeyHex);
    }
    
    await API.post(`/sos/relay`, signedRelayEvent || { originalEventId, hops: parseFloat(currentHops) + 1 });
    showToast(`Radar pinged. Relayed to your trusted network.`, 'success');
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
