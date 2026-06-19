/**
 * SafeTrack — Trackers Module (BLE tags)
 */

async function loadTrackers() {
  try {
    const tags = await API.get('/trackers');
    const list = document.getElementById('trackers-list');
    if (!tags.length) {
      list.innerHTML = '<div class="empty-state">No tracker tags paired yet. Tap + to pair one.</div>';
      return;
    }
    list.innerHTML = tags.map(t => renderTrackerItem(t)).join('');
  } catch (err) {
    console.error('Load trackers error:', err);
  }
}

function renderTrackerItem(tag) {
  const lastSeen = tag.lastSeenAt ? new Date(tag.lastSeenAt) : null;
  const timeStr = lastSeen ? getRelativeTime(lastSeen) : 'Never seen';
  const locStr = tag.lastSeenAddress || (tag.lastSeenLat != null ? `${tag.lastSeenLat.toFixed(5)}, ${tag.lastSeenLng.toFixed(5)}` : '—');
  const batStr = tag.batteryPct != null ? `${tag.batteryPct}% 🔋` : '';

  const icons = ['📦','🎒','🔑','🚗','🏷️','📱'];
  const icon = icons[Math.abs(tag.label.charCodeAt(0)) % icons.length];

  return `
    <div class="tracker-item" id="tracker-${tag.id}">
      <div class="tracker-header">
        <div class="tracker-icon">${icon}</div>
        <div class="tracker-info">
          <div class="tracker-label">${escHtml(tag.label)}</div>
          <div class="tracker-uuid">${escHtml(tag.bleUuid.toUpperCase())}</div>
        </div>
        <div class="tracker-status">
          ${batStr ? `<div class="tracker-bat">${batStr}</div>` : ''}
          <div class="tracker-last-seen">${timeStr}</div>
        </div>
      </div>
      <div class="tracker-footer">
        <div class="tracker-location">📍 ${escHtml(locStr)}</div>
        <div class="tracker-actions">
          <button class="btn-tracker-action" onclick="renameTracker('${tag.id}','${escHtml(tag.label)}')" aria-label="Rename tag">Rename</button>
          <button class="btn-tracker-action btn-tracker-unpair" onclick="unpairTracker('${tag.id}')" aria-label="Unpair tag">Unpair</button>
        </div>
      </div>
    </div>
  `;
}

function openAddTracker() {
  document.getElementById('tracker-label').value = '';
  document.getElementById('tracker-uuid').value = '';
  document.getElementById('tracker-pair-error').textContent = '';
  openModal('modal-add-tracker');
}

async function pairTracker() {
  const label = document.getElementById('tracker-label').value.trim();
  const bleUuid = document.getElementById('tracker-uuid').value.trim();
  const errEl = document.getElementById('tracker-pair-error');
  const btn = document.getElementById('btn-pair-tracker');

  if (!label || !bleUuid) { errEl.textContent = 'Both fields are required'; return; }

  btn.disabled = true;
  btn.textContent = 'Pairing…';
  errEl.textContent = '';
  try {
    const tag = await API.post('/trackers', { label, bleUuid });
    showToast(`✅ "${tag.label}" paired!`, 'success');
    closeModal('modal-add-tracker');
    await loadTrackers();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to pair tag';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Pair Tag';
  }
}

async function renameTracker(id, currentLabel) {
  const newLabel = prompt('Rename tracker tag:', currentLabel);
  if (!newLabel || newLabel.trim() === currentLabel) return;
  try {
    await API.put(`/trackers/${id}`, { label: newLabel.trim() });
    showToast('Tag renamed', 'success');
    await loadTrackers();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}

async function unpairTracker(id) {
  if (!confirm('Unpair this tracker tag?')) return;
  try {
    await API.del(`/trackers/${id}`);
    showToast('Tag unpaired', 'info');
    await loadTrackers();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}
