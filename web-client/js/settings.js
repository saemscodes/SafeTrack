/**
 * SafeTrack — Settings Module
 */

async function loadSettings() {
  try {
    const settings = await API.get('/settings');
    AppState.settings = settings;
    applySettingsToUI(settings);
  } catch (err) {
    console.error('Load settings error:', err);
  }
}

function applySettingsToUI(settings) {
  // Ping mode
  document.getElementById('setting-ping-mode').value = settings.pingMode || 'MEDIUM';
  document.getElementById('setting-adaptive').checked = settings.adaptivePingEnabled || false;

  if (settings.pingMode === 'CUSTOM' && settings.customPingIntervalSec) {
    document.getElementById('custom-interval-row').style.display = 'flex';
    document.getElementById('setting-custom-interval').value = settings.customPingIntervalSec;
  }

  // Effective interval
  let secs = Number(settings.effectiveIntervalSec);
  // Fallback to preset if undefined or invalid to avoid NaN
  if (!secs || isNaN(secs)) {
    const preset = settings.pingPresets?.find(p => p.mode === (settings.pingMode || 'MEDIUM'));
    secs = preset ? Number(preset.intervalSec) : 300; 
  }
  
  const effectiveIntervalEl = document.getElementById('effective-interval');
  effectiveIntervalEl.textContent = secs < 60 ? `${secs}s` : `${Math.round(secs/60)}min`;

  // Battery indicator
  const batt = settings.pingPresets?.find(p => p.mode === settings.pingMode);
  document.getElementById('ping-battery-indicator').textContent = batt ? `⚡ ${batt.batteryImpact}` : '';

  // Retention
  if (settings.retentionDays) {
    document.getElementById('setting-retention').value = settings.retentionDays;
  }

  // SOS mode
  document.getElementById('setting-sos-mode').value = settings.sosMode || 'SILENT_ALERT';

  // SOS label for the SOS button
  document.getElementById('sos-mode-label').textContent =
    (settings.sosMode || 'SILENT_ALERT').replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());

  // Show custom interval row
  document.getElementById('setting-ping-mode').onchange = function() {
    const isCustom = this.value === 'CUSTOM';
    document.getElementById('custom-interval-row').style.display = isCustom ? 'flex' : 'none';
  };
}

async function updateSetting(key, value) {
  try {
    const updated = await API.put('/settings', { [key]: value });
    AppState.settings = updated;
    applySettingsToUI(updated);
    showToast('Settings saved', 'success', 1800);
  } catch (err) {
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

async function loadWatchers() {
  try {
    const watchers = await API.get('/location/watchers');
    const list = document.getElementById('watchers-list');
    if (!watchers.length) {
      list.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0">No one can see your location yet</div>';
      return;
    }
    list.innerHTML = watchers.map(w => `
      <div class="watcher-item">
        <div class="watcher-name">
          ${escHtml(w.user.displayName || w.user.username)}
          <span style="font-size:11px;color:var(--text-muted)"> @${escHtml(w.user.username)}</span>
        </div>
        <button class="btn-revoke-watcher" onclick="revokeWatcher('${w.linkId}')" aria-label="Remove ${escHtml(w.user.username)}'s access">Remove</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load watchers error:', err);
  }
}

async function revokeWatcher(linkId) {
  if (!confirm('Remove this person\'s access to your location?')) return;
  try {
    await API.del(`/contacts/${linkId}`);
    showToast('Access removed', 'info');
    await loadWatchers();
    await loadContacts();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}
