const CACHE_NAME = 'safetrack-v2-cache';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/calendar.css',
  '/js/app.js',
  '/js/sos.js',
  '/js/icons.js',
  '/js/dock.js',
  '/js/auth-router.js',
  '/js/map.js',
  '/js/bip39.js',
  '/js/calendar.js',
  '/js/api.js',
  '/js/contacts.js',
  '/js/trackers.js',
  '/js/settings.js',
  '/js/nostr-p2p.js',
  '/js/avatar-engine.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-sos') {
    event.waitUntil(flushSOSQueue());
  }
});

async function flushSOSQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SafeTrackDB', 1);
    request.onsuccess = async (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offline_sos')) {
        resolve();
        return;
      }
      const tx = db.transaction('offline_sos', 'readonly');
      const store = tx.objectStore('offline_sos');
      const getAll = store.getAll();
      getAll.onsuccess = async () => {
        for (const item of getAll.result) {
          try {
            const resp = await fetch('/sos/trigger', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data)
            });
            if (resp.ok) {
              const delTx = db.transaction('offline_sos', 'readwrite');
              delTx.objectStore('offline_sos').delete(item.id);
            }
          } catch (err) {
            console.error('[SW] Sync flush failed:', err);
          }
        }
        resolve();
      };
      getAll.onerror = reject;
    };
    request.onerror = reject;
  });
}
