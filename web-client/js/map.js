/**
 * SafeTrack — Map Module (Leaflet)
 */

const AppMap = (() => {
  let map, myMarker, myAccuracyCircle;
  const contactMarkers = {};

  function initMap() {
    map = L.map('map', {
      center: [0, 20],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '©OpenStreetMap ©CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Custom zoom control
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Attribution
    L.control.attribution({ position: 'bottomleft', prefix: '© SafeTrack' }).addTo(map);

    // Try get current location immediately
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          updateMyPin({ lat, lng, accuracy });
          map.setView([lat, lng], 15);
        },
        () => {}
      );
    }
  }

  function makeMyIcon() {
    let iconName = 'person-okay';
    // Sync with global AppState if it exists
    if (window.AppState) {
      if (AppState.sosStatus === 'ACTIVE' || AppState.isNotOkay) iconName = 'person-not-okay';
      if (AppState.hasReceivedHelp || AppState.isSurrendered) iconName = 'person-got-help';
    }

    return L.divIcon({
      className: 'safetrack-self-pin',
      html: window.IconResolver ? window.IconResolver.get(iconName) : `<div style="width:24px;height:24px;border-radius:50%;background:var(--clr-primary);"></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 30]
    });
  }

  function makeContactIcon(contactData) {
    let iconName = 'person-okay';
    if (contactData.status === 'SOS' || contactData.isNotOkay) iconName = 'person-not-okay';
    if (contactData.hasReceivedHelp || contactData.isSurrendered) iconName = 'person-got-help';

    return L.divIcon({
      className: 'safetrack-contact-pin',
      html: window.IconResolver ? window.IconResolver.get(iconName) : `<div style="width:24px;height:24px;border-radius:50%;background:var(--clr-accent);"></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 30]
    });
  }

  function makeSOSIcon() {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:24px;height:24px;
        border-radius:50%;
        background:linear-gradient(135deg,#dc2626,#b91c1c);
        border:3px solid white;
        box-shadow:0 0 0 4px rgba(220,38,38,0.3),0 4px 12px rgba(0,0,0,0.5);
        animation:none; display:flex;align-items:center;justify-content:center;
        font-size:10px;color:white;font-weight:700;
      ">!</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  function updateMyPin({ lat, lng, accuracy }) {
    if (!map) return;
    if (!myMarker) {
      myMarker = L.marker([lat, lng], { icon: makeMyIcon(), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<strong>You</strong><br>Live position');
    } else {
      myMarker.setLatLng([lat, lng]);
    }

    if (accuracy) {
      if (!myAccuracyCircle) {
        myAccuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          fillColor: 'var(--clr-violet)',
          fillOpacity: 0.1,
          color: 'var(--clr-violet)',
          weight: 1,
          opacity: 0.4
        }).addTo(map);
      } else {
        myAccuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
      }
    }
  }

  function updateContactPin(data) {
    if (!map) return;
    const { userId, lat, lng } = data;
    const contact = window.AppState?.contacts?.find(c => c.contact?.id === userId)?.contact;
    const name = contact?.displayName || contact?.username || userId.slice(0, 6);

    if (!contactMarkers[userId]) {
      const marker = L.marker([lat, lng], {
        icon: makeContactIcon(data),
        zIndexOffset: 500
      }).addTo(map);
      marker.bindPopup(`<strong>${name}</strong><br>${new Date().toLocaleTimeString()}`);
      contactMarkers[userId] = marker;
    } else {
      contactMarkers[userId].setLatLng([lat, lng]);
      contactMarkers[userId].setIcon(makeContactIcon(data));
      contactMarkers[userId].getPopup()?.setContent(`<strong>${name}</strong><br>${new Date().toLocaleTimeString()}`);
    }
  }

  function flyToContact(userId) {
    const marker = contactMarkers[userId];
    if (marker) {
      map.flyTo(marker.getLatLng(), 16, { duration: 1.2 });
      marker.openPopup();
    }
  }

  function addSOSMarker(lat, lng, label) {
    L.marker([lat, lng], { icon: makeSOSIcon() })
      .addTo(map)
      .bindPopup(`🚨 SOS: ${label}`)
      .openPopup();
    map.flyTo([lat, lng], 15, { duration: 1 });
  }

  return { initMap, updateMyPin, updateContactPin, flyToContact, addSOSMarker, map: null };
})();

// Override initMap to expose map ref
const _origInit = AppMap.initMap;
// Re-assign initMap is handled via initMap() call in app.js which calls AppMap.initMap()
function initMap() { AppMap.initMap(); }
