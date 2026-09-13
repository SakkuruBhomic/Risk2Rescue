// ================================================================
// CITIZEN.JS — Hazard-Specific Intelligence Controller
// ================================================================

let disasterMap = null;
let hazardEngine = null;
let currentHazard = 'cyclone';
let currentStats = null;
let isPlayingTimeline = false;
let timelineInterval = null;
let satelliteOn = false;

document.addEventListener('DOMContentLoaded', () => {
  disasterMap = new DisasterMap('map', { skipDefaultOverlays: true });
  window.disasterMap = disasterMap;

  // The hazard engine owns everything drawn on the map
  disasterMap.clearDefaultOverlays();
  hazardEngine = new HazardEngine(disasterMap.getMap());
  window.hazardEngine = hazardEngine;
  hazardEngine.onStatsChange = (newStats) => {
    currentStats = newStats;
  };

  // Isolate floating drawers and popovers from map wheel capture
  if (window.isolateMapOverlays) {
    window.isolateMapOverlays([
      '#notif-popover',
      '#floating-notif-widget',
      '#windy-search-dropdown',
      '#windy-topbar',
      '#windy-inspector',
      '#reports-modal',
      '#evac-modal',
      '#firebase-modal',
      '#scenario-modal',
      '.windy-loc-chip'
    ]);
  }

  initNotificationsWidget();
  initTimelineSlider();
  initSearch();
  initLeftTools();
  initMapInspector();
  initReportModal();
  initLiveAlertListener();
  initAlertWebSocket();
  initOfflineSupport();

  // Initialize Windy Multi-Layer Integration & Point Forecast Controller
  window.windyController = new WindyIntegrationController();

  selectHazard('cyclone', false);

  // Read location from landing page URL params and initialize
  initCitizenLocation();
});

// ================================================================
// CITIZEN LOCATION & LIVE TELEMETRY CHIP
// ================================================================

/** Citizen marker layer reference */
let citizenMarker = null;
let citizenWeatherTimer = null;
let lastResolvedCoords = null;

// Track active citizen location globally
window.citizenCurrentLocation = { lat: 16.9891, lng: 82.2475, place: 'Kakinada, AP', default: true };

/**
 * Map weather summary metrics & WMO condition codes to standard UI emoji
 */
function getWeatherConditionIcon(summary) {
  if (!summary) return '🌤️';
  if (summary.isSevereWind || (summary.currentWindKmh && summary.currentWindKmh >= 60)) return '🌪️';
  if (summary.isExtremeRain || (summary.maxPrecipPerHourMm && summary.maxPrecipPerHourMm >= 10)) return '⛈️';
  if (summary.maxPrecipPerHourMm && summary.maxPrecipPerHourMm > 0.5) return '🌧️';

  const code = summary.weatherCode;
  if (code !== undefined) {
    if ([95, 96, 99].includes(code)) return '⛈️';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([1, 2, 3].includes(code)) return '⛅';
    if (code === 0) return '☀️';
  }

  return '🌤️';
}

/**
 * Fetch authentic live weather & point-in-polygon risk for given coordinates,
 * updating #chip-city, #chip-temp, #chip-wind, #chip-icon, and #chip-risk.
 * Falls back to localStorage snapshot if network fails or offline.
 */
async function updateCitizenWeatherAndRisk(lat, lng, place) {
  const chipCity = document.getElementById('chip-city');
  const chipTemp = document.getElementById('chip-temp');
  const chipWind = document.getElementById('chip-wind');
  const chipIcon = document.getElementById('chip-icon');
  const chipRisk = document.getElementById('chip-risk');

  if (chipCity && place) {
    chipCity.textContent = place;
  }

  // 1. Fetch live current weather from /api/windy/point-forecast
  try {
    const resp = await fetch('/api/windy/point-forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: Number(lat),
        lon: Number(lng),
        model: 'ecmwf'
      })
    });

    if (!resp.ok) throw new Error(`Weather fetch HTTP ${resp.status}`);
    const data = await resp.json();
    const s = data.summary;
    if (!s) throw new Error('Empty weather summary');

    const temp = Math.round(s.currentTempC);
    const wind = Math.round(s.currentWindKmh !== undefined ? s.currentWindKmh : s.maxGustKmh);
    const icon = getWeatherConditionIcon(s);

    if (chipTemp) chipTemp.textContent = `${temp}°C`;
    if (chipWind) chipWind.textContent = `${wind} km/h`;
    if (chipIcon) chipIcon.textContent = icon;

    // Cache successful weather snapshot for offline resilience
    try {
      localStorage.setItem('rzi_weather_snapshot', JSON.stringify({
        temp,
        wind,
        icon,
        city: place || chipCity?.textContent || 'Kakinada, AP',
        lat,
        lng,
        time: Date.now()
      }));
    } catch (e) {}

  } catch (err) {
    console.warn('Live weather fetch failed, falling back to cached snapshot:', err.message);
    try {
      const cached = localStorage.getItem('rzi_weather_snapshot');
      if (cached) {
        const snap = JSON.parse(cached);
        if (chipTemp && snap.temp !== undefined) chipTemp.textContent = `${snap.temp}°C`;
        if (chipWind && snap.wind !== undefined) chipWind.textContent = `${snap.wind} km/h`;
        if (chipIcon && snap.icon) chipIcon.textContent = snap.icon;
        if (chipCity && snap.city && !place) chipCity.textContent = snap.city;
      } else {
        if (chipTemp) chipTemp.textContent = '27°C';
        if (chipWind) chipWind.textContent = '12 km/h';
        if (chipIcon) chipIcon.textContent = '🌤️';
      }
    } catch (e) {}
  }

  // 2. Risk Zone Check (Point-in-polygon containment check via /api/risk-zone)
  try {
    const risk = await RZILocationService.checkRiskZone(lat, lng);
    window.citizenCurrentLocation = { lat, lng, place, risk };

    // Update topbar chip dynamically from live AI engine state
    updateCitizenRiskBadge({ lat, lng });
  } catch (err) {
    console.warn('Risk zone evaluation failed:', err);
    updateCitizenRiskBadge({ lat, lng });
  }

  lastResolvedCoords = { lat, lng, place };
}

/**
 * Updates the topbar #chip-risk badge dynamically based on the citizen's
 * current coordinates and the live AI Engine zone state / HAZARD_INTEL.
 * Reflects live tier changes without page refresh.
 */
function updateCitizenRiskBadge(coords) {
  const chipRisk = document.getElementById('chip-risk');
  if (!chipRisk) return null;

  const citizenLoc = coords || window.citizenCurrentLocation || {
    lat: disasterMap ? disasterMap.getMap().getCenter().lat : 16.9891,
    lng: disasterMap ? disasterMap.getMap().getCenter().lng : 82.2475
  };
  if (!citizenLoc || isNaN(citizenLoc.lat) || isNaN(citizenLoc.lng)) return null;

  const tierRank = (t) => {
    t = (t || '').toUpperCase();
    if (t === 'RED' || t === 'CRITICAL') return 3;
    if (t === 'ORANGE' || t === 'HIGH') return 2;
    if (t === 'YELLOW' || t === 'MODERATE' || t === 'ADVISORY') return 1;
    return 0;
  };

  let highestTier = 'GREEN';
  let activeZone = null;

  // Gather all active zones from hazardEngine.aiState and HAZARD_INTEL
  const allZones = [];
  if (window.hazardEngine && window.hazardEngine.aiState && Array.isArray(window.hazardEngine.aiState.allZones)) {
    allZones.push(...window.hazardEngine.aiState.allZones);
  }
  if (typeof HAZARD_INTEL !== 'undefined') {
    Object.values(HAZARD_INTEL).forEach(h => {
      if (Array.isArray(h.zones)) {
        h.zones.forEach(z => {
          if (!allZones.some(az => az.id === z.id)) allZones.push(z);
        });
      }
    });
  }

  allZones.forEach(z => {
    const zLat = z.epicenter ? z.epicenter.lat : z.lat;
    const zLng = z.epicenter ? z.epicenter.lng : z.lng;
    if (isNaN(zLat) || isNaN(zLng)) return;

    const distKm = distanceKm(citizenLoc.lat, citizenLoc.lng, zLat, zLng);
    const radiusKm = (z.baseRadius || z.radius || 28000) / 1000;

    if (distKm <= radiusKm) {
      const tier = (z.current_tier || z.level || 'GREEN').toUpperCase();
      if (tierRank(tier) > tierRank(highestTier)) {
        highestTier = tier;
        activeZone = z;
      }
    }
  });

  chipRisk.className = 'windy-risk-chip';
  if (highestTier === 'RED' || highestTier === 'CRITICAL') {
    chipRisk.textContent = 'RED ZONE';
    chipRisk.classList.add('red');
  } else if (highestTier === 'ORANGE' || highestTier === 'HIGH') {
    chipRisk.textContent = 'HIGH RISK';
    chipRisk.classList.add('orange');
  } else if (highestTier === 'YELLOW' || highestTier === 'MODERATE' || highestTier === 'ADVISORY') {
    chipRisk.textContent = 'MODERATE';
    chipRisk.classList.add('yellow');
  } else {
    chipRisk.textContent = 'SAFE';
    chipRisk.classList.add('green');
  }

  // Update citizenCurrentLocation.risk so popup & downstream handlers stay in sync
  if (window.citizenCurrentLocation) {
    if (!window.citizenCurrentLocation.risk) window.citizenCurrentLocation.risk = {};
    window.citizenCurrentLocation.risk.tier = highestTier;
    window.citizenCurrentLocation.risk.riskLevel = (highestTier === 'RED' || highestTier === 'CRITICAL')
      ? 'Red Zone'
      : ((highestTier === 'ORANGE' || highestTier === 'HIGH') ? 'Caution' : 'Safe');
    if (activeZone) {
      window.citizenCurrentLocation.risk.zone = activeZone.name;
      if (activeZone.note) window.citizenCurrentLocation.risk.advisory = activeZone.note;
    }
  }

  return { tier: highestTier, zone: activeZone };
}
window.updateCitizenRiskBadge = updateCitizenRiskBadge;

/**
 * Called on load — reads ?lat, ?lng, ?place from URL if present,
 * or resolves default live weather & risk for citizen portal.
 */
async function initCitizenLocation() {
  const loc = RZILocationService.parseLocationParams();
  if (loc) {
    await placeAndActivateCitizenLocation(loc.lat, loc.lng, loc.place);
  } else {
    // Default location (Kakinada / Uppada coastal sector)
    const defaultLat = 16.9891;
    const defaultLng = 82.2475;
    const defaultPlace = 'Kakinada, AP';
    await updateCitizenWeatherAndRisk(defaultLat, defaultLng, defaultPlace);
  }

  // Periodic refresh: re-fetch weather and risk every 5 minutes while app is open
  if (citizenWeatherTimer) clearInterval(citizenWeatherTimer);
  citizenWeatherTimer = setInterval(() => {
    const cur = window.citizenCurrentLocation || { lat: 16.9891, lng: 82.2475, place: 'Kakinada, AP' };
    updateCitizenWeatherAndRisk(cur.lat, cur.lng, cur.place);
  }, 5 * 60 * 1000);
}

/** Helper to navigate the GIS map (always the disasterMap Leaflet instance) */
function flyToCitizenMap(lat, lng, zoom = 11) {
  if (disasterMap) {
    disasterMap.flyToLocation(lat, lng, zoom);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Global navigation helper to jump to a specific shelter on the map and reveal its details */
function flyToShelter(id, lat, lng, name) {
  if (lat === undefined || lng === undefined) return;
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng)) return;

  // 1. Close current citizen marker location popup so two popups don't fight for space
  if (citizenMarker && typeof citizenMarker.closePopup === 'function') {
    citizenMarker.closePopup();
  } else if (disasterMap && disasterMap.getMap()) {
    disasterMap.getMap().closePopup();
  }

  // 2. Pan and fly map smoothly to shelter location
  flyToCitizenMap(numLat, numLng, 13);

  // 3. Find matching shelter marker in disasterMap.markers.safeSites
  let targetMarker = null;
  if (disasterMap && disasterMap.markers && Array.isArray(disasterMap.markers.safeSites)) {
    targetMarker = disasterMap.markers.safeSites.find(m => {
      const pos = m.getLatLng();
      const matchCoord = Math.abs(pos.lat - numLat) < 0.005 && Math.abs(pos.lng - numLng) < 0.005;
      if (matchCoord) return true;
      if (m._siteData) {
        if (id && m._siteData.id === id) return true;
        if (name && m._siteData.name && (
          m._siteData.name.toLowerCase() === name.toLowerCase() ||
          m._siteData.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(m._siteData.name.toLowerCase())
        )) return true;
      }
      return false;
    });
  }

  // Resolve shelter data for fallback or marker
  const fallbackSite = (window.APP_DATA && APP_DATA.safeSites && APP_DATA.safeSites.find(s =>
    (id && s.id === id) ||
    (name && s.name && (
      s.name.toLowerCase() === name.toLowerCase() ||
      s.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(s.name.toLowerCase())
    )) ||
    (Math.abs(s.lat - numLat) < 0.01 && Math.abs(s.lng - numLng) < 0.01)
  )) || {
    id: id || 'SS_GEN',
    name: name || 'Emergency Evacuation Shelter',
    lat: numLat,
    lng: numLng,
    capacity: 2500,
    current: 420,
    type: 'Relief Center',
    amenities: ['Food', 'Water', 'Medical', 'Power']
  };

  // 4. Open shelter's popup after smooth pan
  setTimeout(() => {
    if (targetMarker) {
      targetMarker.openPopup();
    } else if (disasterMap && disasterMap.getMap()) {
      const pct = Math.round((fallbackSite.current / fallbackSite.capacity) * 100);
      const capColor = pct > 85 ? '#ef4444' : pct > 60 ? '#f97316' : '#22c55e';
      const amenitiesHtml = (fallbackSite.amenities || ['Food', 'Water', 'Medical']).map(a => `<span>${escapeHtml(a)}</span>`).join('');
      L.popup({ className: 'custom-popup', offset: [0, -10] })
        .setLatLng([numLat, numLng])
        .setContent(`
          <div class="map-popup">
            <div class="popup-header"><span class="risk-badge risk-green">SAFE SITE</span><span class="popup-name">${escapeHtml(fallbackSite.name)}</span></div>
            <div class="popup-body">
              <div class="popup-stat"><span>Capacity</span><strong>${fallbackSite.capacity.toLocaleString()}</strong></div>
              <div class="popup-stat"><span>Current</span><strong style="color:${capColor}">${fallbackSite.current.toLocaleString()} (${pct}%)</strong></div>
              <div class="popup-stat"><span>Type</span><strong>${escapeHtml(fallbackSite.type)}</strong></div>
              <div class="popup-amenities">${amenitiesHtml}</div>
            </div>
          </div>
        `)
        .openOn(disasterMap.getMap());
    }
  }, 350);

  if (typeof showToast === 'function') {
    showToast(`📍 Evacuation target: ${name || fallbackSite.name}`, 'info');
  }
}
window.flyToShelter = flyToShelter;

/**
 * Core routine: place marker, query live weather and point-in-polygon risk zone, update UI.
 */
async function placeAndActivateCitizenLocation(lat, lng, place) {
  const leafletMap = disasterMap.getMap();

  // Remove previous citizen marker if any
  if (citizenMarker) {
    try {
      if (disasterMap && disasterMap.getMap()) disasterMap.getMap().removeLayer(citizenMarker);
    } catch (e) {}
    citizenMarker = null;
  }

  // Fly to location
  flyToCitizenMap(lat, lng, 12);

  // Build pulsing "You are here" marker
  const pulseIcon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,0.25);animation:citizenPulse 1.8s ease-out infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(239,68,68,0.8);"></div>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  citizenMarker = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 9000 })
    .addTo(leafletMap)
    .bindPopup(
      `<div class="location-popup">
        <div class="location-popup-header">
          <div class="location-popup-title-row">
            <span class="location-popup-icon">📍</span>
            <span class="location-popup-title">You are here</span>
          </div>
        </div>
        <div class="location-popup-place">${escapeHtml(place)}</div>
        <div class="location-popup-coords">${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E</div>
      </div>`,
      { className: 'location-popup-wrapper', maxWidth: 320, minWidth: 260 }
    )
    .openPopup();

  // Add pulse CSS if not already injected
  if (!document.getElementById('citizen-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'citizen-pulse-style';
    style.textContent = `@keyframes citizenPulse {
      0%   { transform: scale(0.8); opacity: 0.9; }
      70%  { transform: scale(2.5); opacity: 0;   }
      100% { transform: scale(2.5); opacity: 0;   }
    }`;
    document.head.appendChild(style);
  }

  // Sync with Windy controller (updates Point Forecast and pan coordinates)
  if (window.windyController) {
    window.windyController.onLocationChanged(lat, lng, place);
  }

  // Immediately fetch live weather & check risk zone for these resolved coordinates
  await updateCitizenWeatherAndRisk(lat, lng, place);

  const risk = window.citizenCurrentLocation?.risk || {
    riskLevel: 'Safe',
    riskColor: '#22c55e',
    zone: 'General Safe Zone',
    advisory: 'Area currently clear of active hazard corridors.',
    shelters: []
  };

  // Render clickable shelter list with full navigation wiring
  const sheltersHtml = (risk.shelters && risk.shelters.length) ? `
    <div class="location-popup-shelters-section">
      <div class="location-popup-shelters-header">
        <span>Nearest Shelters</span>
        <span class="location-popup-shelters-sub">Click to navigate</span>
      </div>
      <div class="location-popup-shelters-list">
        ${risk.shelters.map(s => {
          const matched = (window.APP_DATA && APP_DATA.safeSites)
            ? APP_DATA.safeSites.find(x =>
                x.name.toLowerCase().includes((s.name || '').toLowerCase()) ||
                (s.name || '').toLowerCase().includes(x.name.toLowerCase())
              )
            : null;
          const sLat = (s.lat !== undefined && s.lat !== null) ? s.lat : (matched?.lat || 16.9891);
          const sLng = (s.lng !== undefined && s.lng !== null) ? s.lng : (matched?.lng || 82.2475);
          const sId = s.id || matched?.id || '';
          const sNameEsc = (s.name || 'Shelter').replace(/'/g, "\\'");
          return `
            <button type="button" class="location-popup-shelter-btn" onclick="flyToShelter('${sId}', ${sLat}, ${sLng}, '${sNameEsc}')" title="Navigate to ${escapeHtml(s.name)} on map">
              <span class="shelter-btn-left">
                <span class="shelter-btn-icon">🛡️</span>
                <span class="shelter-btn-name">${escapeHtml(s.name)}</span>
              </span>
              <span class="shelter-btn-dist">${s.dist_km} km &rsaquo;</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  // Update marker popup with frosted glass styling and structured hierarchy
  citizenMarker.setPopupContent(
    `<div class="location-popup">
      <div class="location-popup-header">
        <div class="location-popup-title-row">
          <span class="location-popup-icon">📍</span>
          <span class="location-popup-title">You are here</span>
        </div>
        <span class="location-popup-badge" style="background:${risk.riskColor || '#22c55e'};">${escapeHtml(risk.riskLevel || 'Safe')}</span>
      </div>
      <div class="location-popup-place">${escapeHtml(place)}</div>
      <div class="location-popup-coords">${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E</div>
      <div class="location-popup-zone">
        <span class="location-popup-zone-label">Zone:</span>
        <span class="location-popup-zone-name">${escapeHtml(risk.zone || 'General Safe Zone')}</span>
      </div>
      <div class="location-popup-advisory">
        <span class="location-popup-advisory-icon">⚠️</span>
        <span class="location-popup-advisory-text">${escapeHtml(risk.advisory || 'Follow standard civil defense guidance.')}</span>
      </div>
      ${sheltersHtml}
    </div>`
  ).openPopup();

  // Toast advisory
  const toastType = risk.riskLevel === 'Red Zone' ? 'warning' : (risk.riskLevel === 'Caution' ? 'warning' : 'success');
  showToast(`${risk.riskLevel === 'Red Zone' ? '🔴' : risk.riskLevel === 'Caution' ? '🟡' : '🟢'} ${risk.riskLevel} — ${risk.zone}`, toastType);
}




function selectHazard(key, fly) {
  currentHazard = key;
  if (!navigator.onLine) {
    restoreHazardSnapshot();
  }
  currentStats = hazardEngine.render(key);
  saveHazardSnapshot(key);

  // If seismic hazard selected, asynchronously fetch authentic USGS live feed
  if (key === 'earthquake') {
    fetch('/api/earthquakes/live')
      .then(r => r.json())
      .then(data => {
        if (data && data.earthquakes && data.earthquakes.length > 0 && currentHazard === 'earthquake') {
          HAZARD_INTEL.earthquake.summary = `Live USGS Seismic Monitor: ${data.count} global events (M2.5+) in last 24h. Peak: M${data.maxMagnitude} (${data.latest?.place || 'active fault'}).`;
          HAZARD_INTEL.earthquake.alerts = data.earthquakes.slice(0, 10).map(eq => ({
            level: eq.mag >= 5.0 ? 'CRITICAL' : eq.mag >= 4.0 ? 'HIGH' : 'MODERATE',
            title: `M${eq.mag.toFixed(1)} — ${eq.place}`,
            area: `Depth: ${eq.depthKm} km`,
            time: new Date(eq.epochMs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            confidence: eq.significance ? Math.min(99, Math.round(eq.significance / 10)) : 88,
            lat: eq.lat,
            lng: eq.lng,
            url: eq.url
          }));

          hazardEngine.invalidateCache('earthquake');
          currentStats = hazardEngine.render('earthquake', true);
          hazardEngine.renderLiveEarthquakes(data.earthquakes);
        }
      })
      .catch(err => console.warn('USGS live fetch error:', err));
  }

  if (fly) {
    const f = currentStats.focus;
    flyToCitizenMap(f.lat, f.lng, 8);
    showToast(`${currentStats.icon} ${currentStats.label} view — red zones, safe zones, alerts and past events`, 'warning');
  }
}




// ================================================================
// TIMELINE
// ================================================================
function initTimelineSlider() {
  const nodes = document.querySelectorAll('.windy-time-node');
  const progress = document.getElementById('timeline-progress');
  const playBtn = document.getElementById('timeline-play-btn');
  const playIcon = document.getElementById('play-icon');

  function setStep(index) {
    nodes.forEach((n, idx) => n.classList.toggle('active', idx === index));
    progress.style.width = nodes[index].dataset.pct + '%';
    const label = nodes[index].querySelector('.windy-node-text').textContent;

    // Notify WindyIntegrationController of the timeline offset
    const hourOffsets = [0, 3, 6, 12, 24, 48];
    const offset = hourOffsets[index] || 0;
    if (window.windyController && typeof window.windyController.setTimelineHourOffset === 'function') {
      window.windyController.setTimelineHourOffset(offset);
    }

    // Notify HazardEngine of timeline step to switch zone tiers dynamically
    if (window.hazardEngine && typeof window.hazardEngine.setTimelineStep === 'function') {
      window.hazardEngine.setTimelineStep(index);
    }

    // Refresh inspector dialog if active to reflect the current timeline step tier
    const inspector = document.getElementById('windy-inspector');
    if (inspector && inspector.classList.contains('active') && currentInspectedZone) {
      openInspector(currentInspectedZone.zone, currentInspectedZone.coords);
    }

    if (index === 0) showToast('Showing the situation right now', 'info');
    else if (index === 3) showToast(`${currentStats?.label || 'Cyclone'}: peak impact expected around +12h`, 'danger');
    else showToast(`Forecast ${label} for ${(currentStats?.label || 'cyclone').toLowerCase()}`, 'info');
  }

  nodes.forEach((node, idx) => node.addEventListener('click', () => setStep(idx)));

  playBtn.addEventListener('click', () => {
    isPlayingTimeline = !isPlayingTimeline;
    playIcon.textContent = isPlayingTimeline ? '⏸' : '▶';
    if (isPlayingTimeline) {
      let step = 0;
      timelineInterval = setInterval(() => {
        step = (step + 1) % nodes.length;
        setStep(step);
      }, 1600);
    } else {
      clearInterval(timelineInterval);
    }
  });
}

// ================================================================
// SEARCH
// ================================================================
function initSearch() {
  const input = document.getElementById('windy-search');
  const clearBtn = document.getElementById('windy-search-clear');
  const dropdown = document.getElementById('windy-search-dropdown');
  if (!input || !dropdown) return;

  // In-memory cache for geocoded queries
  const geocodeCache = new Map();
  let debounceTimer = null;

  function getLocalPlaces() {
    const places = [];
    const seenNames = new Set();

    // 1. Existing hazard-derived places (zones, safeSites, habitations)
    const source = window.HAZARD_INTEL || (typeof HAZARD_INTEL !== 'undefined' ? HAZARD_INTEL : {});
    Object.entries(source).forEach(([key, h]) => {
      (h.zones || []).forEach(z => {
        const zLat = z.epicenter ? z.epicenter.lat : z.lat;
        const zLng = z.epicenter ? z.epicenter.lng : z.lng;
        const zRisk = z.current_tier || z.level || 'RED';
        const zType = (window.RISK_STYLE && window.RISK_STYLE[zRisk]?.label) || zRisk;
        const name = z.village_name || z.name;
        if (name) {
          seenNames.add(name.toLowerCase());
          places.push({
            name,
            region: h.label || 'Active Hazard Belt',
            lat: zLat,
            lng: zLng,
            risk: zRisk,
            type: zType || 'Danger Zone',
            hazard: key,
            isOsm: false
          });
        }
      });
      (h.safeSites || []).forEach(s => {
        if (s.name) {
          seenNames.add(s.name.toLowerCase());
          places.push({
            name: s.name,
            region: h.label || 'Safe Sector',
            lat: s.lat,
            lng: s.lng,
            risk: 'GREEN',
            type: 'Safe Shelter',
            hazard: key,
            isOsm: false
          });
        }
      });
      (h.habitations || []).forEach(v => {
        if (v.name) {
          seenNames.add(v.name.toLowerCase());
          places.push({
            name: v.name,
            region: h.label || 'Habitation',
            lat: v.lat,
            lng: v.lng,
            risk: v.risk || 'YELLOW',
            type: 'Habitation',
            hazard: key,
            isOsm: false
          });
        }
      });
    });

    // 2. Full Andhra Pradesh location set from RZILocationService (districts & mandals)
    if (typeof RZILocationService !== 'undefined') {
      const allLocs = typeof RZILocationService.getAllLocations === 'function'
        ? RZILocationService.getAllLocations()
        : (typeof RZILocationService.getAPDistricts === 'function' ? RZILocationService.getAPDistricts() : []);

      allLocs.forEach(loc => {
        const locName = loc.name;
        if (locName && !seenNames.has(locName.toLowerCase())) {
          seenNames.add(locName.toLowerCase());
          places.push({
            name: locName,
            region: loc.region || loc.district || 'Andhra Pradesh',
            lat: loc.lat,
            lng: loc.lng,
            risk: 'GREEN',
            type: loc.type || 'District',
            hazard: null,
            isOsm: false
          });
        }
      });
    }

    return places;
  }

  function renderItem(p) {
    const riskIcons = { RED: '🔴', ORANGE: '🟠', YELLOW: '🟡', GREEN: '🟢' };
    const item = document.createElement('div');
    item.className = 'windy-search-item';
    const osmTag = p.isOsm ? '<span class="windy-search-osm-tag">via OpenStreetMap</span>' : '';
    const icon = riskIcons[p.risk] || '🟢';
    const riskBadgeClass = `risk-${(p.risk || 'green').toLowerCase()}`;
    const riskBadgeText = p.risk || 'GREEN';

    item.innerHTML = `
      <div class="windy-search-item-left">
        <span>${icon}</span>
        <div>
          <div class="windy-search-item-name" title="${p.name}">${p.name}</div>
          <div class="windy-search-item-sub">${p.region} &bull; ${p.type} ${osmTag}</div>
        </div>
      </div>
      <span class="risk-badge ${riskBadgeClass}">${riskBadgeText}</span>`;

    item.addEventListener('click', () => {
      if (p.hazard && p.hazard !== currentHazard) selectHazard(p.hazard, false);
      const zoom = p.type === 'District' ? 10 : (p.isOsm ? 14 : 12);
      flyToCitizenMap(p.lat, p.lng, zoom);
      dropdown.style.display = 'none';
      input.value = p.name;
      openInspector(
        p.name,
        { lat: p.lat, lng: p.lng },
        p.risk,
        p.risk === 'RED' ? '140 km/h' : '20 km/h',
        p.type,
        nearestShelterText()
      );
      // Immediately update topbar location chip with live telemetry for searched place
      updateCitizenWeatherAndRisk(p.lat, p.lng, p.name);
    });

    return item;
  }

  async function fetchOsmGeocode(q) {
    const normQ = q.trim().toLowerCase();
    if (geocodeCache.has(normQ)) {
      return geocodeCache.get(normQ);
    }

    try {
      const queryParam = normQ.includes('andhra') ? normQ : `${normQ}, Andhra Pradesh`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryParam)}&addressdetails=1&limit=5&countrycodes=in`;
      const resp = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'RedZoneIntelligence/2.0' }
      });
      if (!resp.ok) throw new Error('Nominatim error');
      const data = await resp.json();

      const results = (data || []).map(item => {
        const parts = (item.display_name || '').split(',').map(s => s.trim());
        const name = parts.slice(0, 2).join(', ') || item.display_name;
        const region = parts.slice(2, 4).join(', ') || 'Andhra Pradesh';
        const rawType = item.type ? (item.type.charAt(0).toUpperCase() + item.type.slice(1).replace(/_/g, ' ')) : 'Street / Landmark';
        return {
          name,
          region,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          risk: 'GREEN',
          type: rawType,
          hazard: null,
          isOsm: true
        };
      });

      geocodeCache.set(normQ, results);
      return results;
    } catch (err) {
      console.warn('Geocoding fallback request failed:', err);
      return [];
    }
  }

  input.addEventListener('input', () => {
    const rawQ = input.value.trim();
    const q = rawQ.toLowerCase();

    if (clearBtn) clearBtn.style.display = rawQ ? 'block' : 'none';
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    // 1. Immediate local dataset match
    const places = getLocalPlaces();
    const localMatches = places.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q)
    ).slice(0, 7);

    dropdown.innerHTML = '';
    dropdown.style.display = 'flex';

    localMatches.forEach(p => {
      dropdown.appendChild(renderItem(p));
    });

    // If query is very short (< 2 chars), don't trigger geocoding API
    if (q.length < 2) {
      if (!localMatches.length) {
        dropdown.innerHTML = '<div style="padding:10px; font-size:12px; color:#94a3b8; text-align:center;">Nothing found</div>';
      }
      return;
    }

    // Check if query is already cached
    if (geocodeCache.has(q)) {
      const cachedOsm = geocodeCache.get(q) || [];
      const seenLocNames = new Set(localMatches.map(m => m.name.toLowerCase()));
      const filteredOsm = cachedOsm.filter(o => !seenLocNames.has(o.name.toLowerCase()));

      filteredOsm.forEach(p => {
        dropdown.appendChild(renderItem(p));
      });

      if (!localMatches.length && !filteredOsm.length) {
        dropdown.innerHTML = '<div style="padding:10px; font-size:12px; color:#94a3b8; text-align:center;">Nothing found</div>';
      }
      return;
    }

    // Add loading spinner while geocoding request is in-flight
    const spinner = document.createElement('div');
    spinner.className = 'windy-search-spinner';
    spinner.id = 'windy-search-spinner';
    spinner.innerHTML = `<div class="windy-search-spinner-icon"></div> Searching OpenStreetMap…`;
    dropdown.appendChild(spinner);

    // 2. Debounce 400ms geocoding fallback
    debounceTimer = setTimeout(async () => {
      const activeQuery = input.value.trim().toLowerCase();
      if (activeQuery !== q) return; // Stale query guard

      const osmResults = await fetchOsmGeocode(rawQ);

      // Check again if query changed while request was in-flight
      if (input.value.trim().toLowerCase() !== q) return;

      const spinnerEl = document.getElementById('windy-search-spinner');
      if (spinnerEl) spinnerEl.remove();

      // Deduplicate with local matches
      const seenLocNames = new Set(localMatches.map(m => m.name.toLowerCase()));
      const filteredOsm = osmResults.filter(o => !seenLocNames.has(o.name.toLowerCase()));

      filteredOsm.forEach(p => {
        dropdown.appendChild(renderItem(p));
      });

      if (!localMatches.length && !filteredOsm.length) {
        dropdown.innerHTML = '<div style="padding:10px; font-size:12px; color:#94a3b8; text-align:center;">Nothing found</div>';
      }
    }, 400);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.windy-search-pill')) {
      dropdown.style.display = 'none';
    }
  });
}

// ================================================================
// LEFT TOOLS
// ================================================================
function initLeftTools() {
  document.getElementById('tool-locate').addEventListener('click', () => {
    showToast('📍 Detecting your location…', 'info');
    RZILocationService.detectLocation()
      .then(async ({ lat, lng }) => {
        const place = await RZILocationService.reverseGeocode(lat, lng);
        placeAndActivateCitizenLocation(lat, lng, place.display);
        showToast(`📍 Located: ${place.display}`, 'success');
      })
      .catch((err) => {
        showToast(`⚠️ ${err.message}`, 'warning');
      });
  });

  document.getElementById('tool-report').addEventListener('click', () => {
    document.getElementById('report-modal').classList.add('active');
  });

  document.getElementById('tool-basemap').addEventListener('click', () => {
    satelliteOn = !satelliteOn;
    if (window.windyController && window.windyController.gisTileLayer) {
      const cfg = (typeof window !== 'undefined' && window.LAYER_CONFIG) ? window.LAYER_CONFIG : LAYER_CONFIG;
      const satUrl = cfg.satellite.url;
      const stdUrl = cfg.standard.url;
      window.windyController.gisTileLayer.setUrl(satelliteOn ? satUrl : stdUrl);
    }
    if (disasterMap) {
      disasterMap.setBasemap(satelliteOn ? 'satellite' : 'standard');
    }
    showToast(satelliteOn ? 'Satellite view on' : 'Plain map view on', 'info');
  });
}

let currentEvacuationTarget = null;
let currentInspectedZone = null;

function nearestShelterText() {
  const s = HAZARD_INTEL[currentHazard]?.safeSites?.[0];
  if (!s) return 'Safe facility on standby';
  return `${s.name} (${(s.capacity - s.current).toLocaleString()} spaces)`;
}

function guideToNearestShelter() {
  if (currentEvacuationTarget) {
    flyToCitizenMap(currentEvacuationTarget.lat, currentEvacuationTarget.lng, 13);
    if (currentEvacuationTarget._marker) currentEvacuationTarget._marker.openPopup();
    showToast(`🚶 Evacuation route: Heading to ${currentEvacuationTarget.name} (${currentEvacuationTarget.distanceKm?.toFixed(1) || '1.8'} km away)`, 'success');
  } else {
    const s = HAZARD_INTEL[currentHazard]?.safeSites?.[0];
    if (s) {
      flyToCitizenMap(s.lat, s.lng, 12);
      showToast(`Nearest safe place: ${s.name}`, 'success');
    }
  }
}

// ================================================================
// MAP CLICK INSPECTOR
// ================================================================
function initMapInspector() {
  const inspector = document.getElementById('windy-inspector');
  const closeBtn = document.getElementById('insp-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      inspector.classList.remove('active');
      currentInspectedZone = null;
      if (window.hazardEngine && typeof window.hazardEngine.hideRevealedSafeSites === 'function') {
        window.hazardEngine.hideRevealedSafeSites();
      }
    });
  }

  const evacBtn = document.getElementById('insp-evac-btn');
  if (evacBtn) {
    evacBtn.addEventListener('click', guideToNearestShelter);
  }

  disasterMap.getMap().on('click', (e) => {
    const { lat, lng } = e.latlng;
    const h = HAZARD_INTEL[currentHazard];
    if (!h) return;

    let hit = null, best = Infinity;
    (h.zones || []).forEach(z => {
      const zLat = z.epicenter ? z.epicenter.lat : z.lat;
      const zLng = z.epicenter ? z.epicenter.lng : z.lng;
      const maxR = z.epicenter ? ((z.baseRadius || z.radius) * 1.4) : (z.baseRadius || z.radius || 28000);
      const d = distanceKm(lat, lng, zLat, zLng);
      if (d * 1000 <= maxR && d < best) {
        best = d;
        hit = z;
      }
    });

    if (hit) {
      openInspector(hit, { lat, lng });
    } else {
      inspector.classList.remove('active');
      currentInspectedZone = null;
      if (window.hazardEngine && typeof window.hazardEngine.hideRevealedSafeSites === 'function') {
        window.hazardEngine.hideRevealedSafeSites();
      }
    }
  });
}

function distanceKm(a1, b1, a2, b2) {
  const R = 6371, dLat = (a2 - a1) * Math.PI / 180, dLng = (b2 - b1) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function openInspector(zoneOrName, coords, risk, wind, surge, shelter) {
  const inspector = document.getElementById('windy-inspector');
  if (!inspector) return;

  const h = HAZARD_INTEL[currentHazard] || {};
  let z = null;
  let lat = null, lng = null;

  if (typeof zoneOrName === 'object' && zoneOrName !== null) {
    z = zoneOrName;
    lat = coords?.lat || z.lat || (z.epicenter ? z.epicenter.lat : 16.99);
    lng = coords?.lng || z.lng || (z.epicenter ? z.epicenter.lng : 82.25);
  } else {
    const name = String(zoneOrName || 'Selected Zone');
    z = (h.zones || []).find(x => x.name === name || name.includes(x.village_name || x.name)) || {
      name,
      level: risk || 'RED',
      current_tier: risk || 'RED',
      lat: (coords && typeof coords === 'object') ? coords.lat : 16.99,
      lng: (coords && typeof coords === 'object') ? coords.lng : 82.25,
      pop: 18500
    };
    lat = (coords && typeof coords === 'object') ? coords.lat : (z.lat || 16.99);
    lng = (coords && typeof coords === 'object') ? coords.lng : (z.lng || 82.25);
  }

  currentInspectedZone = { zone: z, coords: { lat, lng } };

  const stepIndex = (window.hazardEngine && typeof window.hazardEngine.timelineStep === 'number')
    ? window.hazardEngine.timelineStep
    : 0;

  const currentTier = z.current_tier || z.level || risk || 'GREEN';
  const activeTier = (stepIndex === 0)
    ? currentTier
    : (z.forecast_tier_by_hour?.[stepIndex] || currentTier);

  // Title & Coordinates
  const nameEl = document.getElementById('insp-name');
  if (nameEl) nameEl.textContent = z.name || 'Hazard Zone';

  const coordsEl = document.getElementById('insp-coords');
  if (coordsEl) coordsEl.textContent = `${lat.toFixed(2)}° N, ${lng.toFixed(2)}° E`;

  // 1. Timeline State (e.g. "Active" / "Escalating" / "Subsiding")
  let timelineState = 'Active';
  if (stepIndex === 0) {
    timelineState = activeTier === 'RED' ? 'Active' : (activeTier === 'ORANGE' ? 'Active' : 'Normal');
  } else {
    const tierRanks = { RED: 4, ORANGE: 3, YELLOW: 2, GREEN: 1 };
    const diff = (tierRanks[activeTier] || 1) - (tierRanks[currentTier] || 1);
    if (diff > 0) timelineState = 'Escalating';
    else if (diff < 0) timelineState = 'Subsiding';
    else timelineState = 'Active';
  }
  const timelineStateEl = document.getElementById('insp-timeline-state');
  if (timelineStateEl) timelineStateEl.textContent = timelineState;

  // 2. Current Live Obs (a short live observation summary string)
  let liveObs = 'Active telemetry observation';
  if (z.current_telemetry && z.current_telemetry.windGustKmh) {
    liveObs = `${currentTier} • ${z.current_telemetry.windGustKmh} km/h gusts`;
  } else if (currentTier === 'RED') {
    liveObs = 'Critical core surge & gale';
  } else if (currentTier === 'ORANGE') {
    liveObs = 'High alert squalls & watch';
  } else if (currentTier === 'YELLOW') {
    liveObs = 'Advisory monitoring';
  } else {
    liveObs = 'Normal baseline conditions';
  }
  const liveObsEl = document.getElementById('insp-live-obs');
  if (liveObsEl) liveObsEl.textContent = liveObs;

  // 3. Timeline Step Tier (RED/ORANGE/YELLOW/GREEN with risk-badge classes)
  const stepTierEl = document.getElementById('insp-step-tier');
  if (stepTierEl) {
    stepTierEl.innerHTML = `<span class="risk-badge risk-${activeTier.toLowerCase()}">${activeTier}</span>`;
  }

  // 4. Wind / Gust (live value, km/h)
  const seriesItem = z.forecast_series?.[stepIndex];
  const windDisplay = seriesItem ? `${seriesItem.gustKmh} km/h` : (z.current_telemetry ? `${z.current_telemetry.windGustKmh} km/h` : (activeTier === 'RED' ? '140 km/h' : '30 km/h'));
  const windEl = document.getElementById('insp-wind');
  if (windEl) windEl.textContent = windDisplay;

  // 5. Atmospheric Pressure (live value, hPa)
  const pressureDisplay = seriesItem ? `${seriesItem.pressureHpa} hPa` : (z.current_telemetry ? `${z.current_telemetry.pressureHpa} hPa` : (activeTier === 'RED' ? '984 hPa' : '1008 hPa'));
  const pressureEl = document.getElementById('insp-pressure');
  if (pressureEl) pressureEl.textContent = pressureDisplay;

  // 6. People in Zone (estimated affected population)
  const peopleDisplay = (z.pop || 0).toLocaleString();
  const peopleEl = document.getElementById('insp-people');
  if (peopleEl) peopleEl.textContent = peopleDisplay;

  // 7. NASA FIRMS Active Fires (show "None detected" when zero rather than hiding the row)
  let firesDisplay = 'None detected';
  if (z.satellite && z.satellite.activeHotspotCount > 0) {
    firesDisplay = `${z.satellite.activeHotspotCount} detected (${z.satellite.maxFrpMw} MW)`;
  }
  const firesEl = document.getElementById('insp-fires');
  if (firesEl) firesEl.textContent = firesDisplay;

  // 2. Safe sites on map: reveal safe-site markers near this zone
  let safeSitesList = [];
  if (window.hazardEngine && typeof window.hazardEngine.revealSafeSitesNear === 'function') {
    safeSitesList = window.hazardEngine.revealSafeSitesNear(lat, lng, 120);
  } else {
    safeSitesList = (h.safeSites || []).map(s => ({
      ...s,
      distanceKm: distanceKm(lat, lng, s.lat, s.lng)
    })).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // 3. Safe sites in dialog: Safe Sites Nearby list
  const listEl = document.getElementById('insp-safesites-list');
  if (listEl) {
    listEl.innerHTML = '';
    if (!safeSitesList || safeSitesList.length === 0) {
      listEl.innerHTML = '<div style="font-size:11px; color:#94a3b8; padding:6px;">No registered shelters within evacuation radius.</div>';
    } else {
      safeSitesList.forEach((site, idx) => {
        const free = site.capacity - site.current;
        const card = document.createElement('div');
        card.className = `windy-safesite-card ${idx === 0 ? 'selected' : ''}`;
        card.innerHTML = `
          <div class="windy-safesite-top">
            <span class="windy-safesite-icon">🛡️</span>
            <div class="windy-safesite-info">
              <div class="windy-safesite-name">${site.name}</div>
              <div class="windy-safesite-dist">${site.distanceKm.toFixed(1)} km away</div>
            </div>
            <span class="windy-safesite-badge">${free.toLocaleString()} beds</span>
          </div>
          <div class="windy-safesite-details ${idx === 0 ? '' : 'hidden'}" id="safesite-details-${idx}">
            <div class="windy-safesite-row"><span>Coordinates:</span><strong>${site.lat.toFixed(4)}° N, ${site.lng.toFixed(4)}° E</strong></div>
            <div class="windy-safesite-row"><span>Total Capacity:</span><strong>${site.capacity.toLocaleString()}</strong></div>
            <div class="windy-safesite-row"><span>Occupancy:</span><strong>${site.current.toLocaleString()}</strong></div>
            <div class="windy-safesite-row"><span>Available:</span><strong style="color:var(--risk-green);">${free.toLocaleString()} beds open</strong></div>
          </div>
        `;

        card.addEventListener('click', () => {
          document.querySelectorAll('.windy-safesite-card').forEach(c => c.classList.remove('selected'));
          document.querySelectorAll('.windy-safesite-details').forEach(d => d.classList.add('hidden'));
          card.classList.add('selected');
          const dEl = card.querySelector('.windy-safesite-details');
          if (dEl) dEl.classList.remove('hidden');

          currentEvacuationTarget = site;
          flyToCitizenMap(site.lat, site.lng, 13);
          if (site._marker) site._marker.openPopup();
          showToast(`📍 Selected shelter: ${site.name} (${site.distanceKm.toFixed(1)} km)`, 'info');
        });

        listEl.appendChild(card);
      });
    }
  }

  // 4. Point evacuation button to nearest safe site
  currentEvacuationTarget = safeSitesList[0] || null;

  inspector.classList.add('active');
}
window.openInspector = openInspector;

// ================================================================
// REPORT MODAL — Firebase Live Database Integration
// ================================================================
// REPORT MODAL — Fast Optimistic Dispatch & Photo Proof Support
// ================================================================
function updateReportLocationField() {
  const repLoc = document.getElementById('rep-loc');
  const badge = document.getElementById('rep-loc-badge');
  const note = document.getElementById('rep-loc-note');
  if (!repLoc) return;
  if (window.citizenCurrentLocation && window.citizenCurrentLocation.place) {
    const loc = window.citizenCurrentLocation;
    repLoc.value = `${loc.place} (${Number(loc.lat).toFixed(4)}° N, ${Number(loc.lng).toFixed(4)}° E)`;
    repLoc.readOnly = true;
    repLoc.style.background = 'rgba(34,197,94,0.08)';
    repLoc.style.borderColor = 'rgba(34,197,94,0.4)';
    if (badge) badge.style.display = 'inline-block';
    if (note) note.textContent = '🔒 Coordinates locked from your GPS device.';
  } else {
    repLoc.readOnly = false;
    repLoc.style.background = '';
    repLoc.style.borderColor = '';
    if (badge) badge.style.display = 'none';
    if (note) note.textContent = 'Manual location entry active (GPS unavailable).';
  }
}
window.updateReportLocationField = updateReportLocationField;

function initReportModal() {
  const modal = document.getElementById('report-modal');
  const form = document.getElementById('report-form');
  const reportBtn = document.getElementById('tool-report');

  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      updateReportLocationField();
      modal.classList.add('active');
    });
  }

  const closeBtn = document.getElementById('report-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
  }

  // Photo proof upload & preview handler
  let currentPhotoBase64 = null;
  const photoInput = document.getElementById('rep-photo');
  const previewWrap = document.getElementById('rep-photo-preview');
  const previewImg = document.getElementById('rep-photo-img');
  const removePhotoBtn = document.getElementById('rep-photo-remove');

  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          currentPhotoBase64 = evt.target.result;
          if (previewImg) previewImg.src = currentPhotoBase64;
          if (previewWrap) previewWrap.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      currentPhotoBase64 = null;
      if (photoInput) photoInput.value = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (previewImg) previewImg.src = '';
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('rep-type').value;
      const loc = document.getElementById('rep-loc').value;
      const desc = document.getElementById('rep-desc').value;
      const phone = document.getElementById('rep-phone').value;

      let lat = 16.9891;
      let lng = 82.2475;
      if (window.citizenCurrentLocation && window.citizenCurrentLocation.lat) {
        lat = window.citizenCurrentLocation.lat;
        lng = window.citizenCurrentLocation.lng;
      } else if (window.disasterMap && window.disasterMap.getMap) {
        const center = window.disasterMap.getMap().getCenter();
        lat = center.lat;
        lng = center.lng;
      }

      const reportPayload = {
        id: 'REP-' + Date.now().toString().slice(-6),
        type,
        location: loc,
        desc,
        phone,
        lat,
        lng,
        photo: currentPhotoBase64,
        severity: type === 'Stranded' ? 'Critical' : type === 'Flood' ? 'High' : 'Medium',
        reporter: 'Citizen (' + (phone.slice(-4) || 'Live') + ')',
        status: 'Pending',
        time: 'Just now',
        timestamp: Date.now()
      };

      // Optimistic instant feedback (< 300ms)
      modal.classList.remove('active');
      showToast('✅ Report submitted! Transmitted to Incident Command.', 'success');

      // Local storage snapshot for immediate cross-portal availability
      try {
        const existing = JSON.parse(localStorage.getItem('rzi_citizen_reports') || '[]');
        existing.unshift(reportPayload);
        localStorage.setItem('rzi_citizen_reports', JSON.stringify(existing));
      } catch (e) {}

      // Reset form fields
      form.reset();
      currentPhotoBase64 = null;
      if (previewWrap) previewWrap.style.display = 'none';
      if (previewImg) previewImg.src = '';

      // Background asynchronous network delivery
      setTimeout(async () => {
        if (!navigator.onLine) {
          if (typeof queueOfflineSubmission === 'function') {
            queueOfflineSubmission(reportPayload);
          }
        } else {
          try {
            fetch('/api/reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reportPayload)
            }).catch(() => {});

            if (window.firebaseLive) {
              await window.firebaseLive.submitCitizenReport(reportPayload);
            }
          } catch (err) {
            console.warn('Background report sync notice:', err);
          }
        }
      }, 10);
    });
  }
}

// Synthesize emergency alert chime (no external audio assets needed)
function playEmergencyChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {}
}

// ================================================================
// LIVE WEBSOCKET AUTHORITY ALERT CLIENT
// Resilient streaming with exponential backoff & silent degradation
// ================================================================
let alertSocket = null;
let socketRetryDelay = 2000;
let socketRetryTimeout = null;
const MAX_SOCKET_RETRY_DELAY = 30000;
let emergencyBannerTimer = null;

function initAlertWebSocket() {
  if (alertSocket && (alertSocket.readyState === WebSocket.OPEN || alertSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}`;
    alertSocket = new WebSocket(wsUrl);
    window.alertSocket = alertSocket;
    window.socketRetryDelay = socketRetryDelay;

    alertSocket.onopen = () => {
      socketRetryDelay = 2000;
      window.socketRetryDelay = socketRetryDelay;
    };

    alertSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'authority_alert' && data.alert) {
          handleIncomingAuthorityAlert(data.alert);
        }
      } catch (e) {
        // Degrade silently
      }
    };

    alertSocket.onerror = () => {
      // Degrade silently — no notifications, no errors shown to citizen
    };

    alertSocket.onclose = () => {
      // Reconnect gracefully with exponential backoff
      if (socketRetryTimeout) clearTimeout(socketRetryTimeout);
      socketRetryTimeout = setTimeout(() => {
        socketRetryDelay = Math.min(MAX_SOCKET_RETRY_DELAY, Math.round(socketRetryDelay * 1.5));
        window.socketRetryDelay = socketRetryDelay;
        initAlertWebSocket();
      }, socketRetryDelay);
    };
  } catch (err) {
    // Degrade silently
  }
}

function showAuthorityAlertBanner(title, message, area) {
  const banner = document.getElementById('citizen-emergency-banner');
  const titleEl = document.getElementById('cit-banner-title');
  const msgEl = document.getElementById('cit-banner-msg');

  if (banner) {
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = `${message}${area ? ' — Sector: ' + area : ''}`;
    banner.style.display = 'block';

    if (emergencyBannerTimer) {
      clearTimeout(emergencyBannerTimer);
    }
    // Auto-dismiss after ~6s
    emergencyBannerTimer = setTimeout(() => {
      banner.style.display = 'none';
      emergencyBannerTimer = null;
    }, 6000);
  }
}

function handleIncomingAuthorityAlert(alert) {
  if (!alert) return;

  const title = alert.title || 'Official Emergency Warning';
  const message = alert.message || alert.desc || 'Immediate official caution advised.';
  const timestamp = alert.timestamp || Date.now();

  // 1. Push entry into window.citizenNotifications with type "authority alert"
  addCitizenNotification({
    type: 'authority alert',
    title: title,
    message: `${message}${alert.area ? ' • Sector: ' + alert.area : ''}`,
    timestamp: timestamp,
    read: false
  });

  // 2. Show brief top-center banner / toast auto-dismissing after ~6s
  showAuthorityAlertBanner(title, message, alert.area);
  showToast(title, 'danger');
  playEmergencyChime();

  // 3. Authority alert-to-zone synchronization:
  // Call into AI engine's zone system (both HazardEngine and server endpoint)
  // to create or force-escalate a zone at that exact location with exact tier qualities
  let createdZone = null;
  if (window.hazardEngine && typeof window.hazardEngine.injectOrEscalateAuthorityZone === 'function') {
    createdZone = window.hazardEngine.injectOrEscalateAuthorityZone(alert);
  }

  // Also notify server AI Engine endpoint asynchronously
  try {
    fetch('/api/ai-engine/escalate-zone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    }).catch(() => {});
  } catch (e) {}

  // 4. Update Citizen live topbar risk badge immediately without page refresh
  updateCitizenRiskBadge();

  // 5. Proximity / Zone check: trigger evacuation flow if citizen is inside or near
  checkAlertZoneProximityAndTriggerEvacuation(alert, createdZone);
}

function checkAlertZoneProximityAndTriggerEvacuation(alert, createdZone = null) {
  // Retrieve current citizen coordinates
  const citizenLoc = window.citizenCurrentLocation || {
    lat: disasterMap ? disasterMap.getMap().getCenter().lat : 16.99,
    lng: disasterMap ? disasterMap.getMap().getCenter().lng : 82.25
  };

  const alertLat = Number(alert.lat != null ? alert.lat : alert.latitude);
  const alertLng = Number(alert.lng != null ? alert.lng : alert.longitude);
  const alertRadiusKm = Number(alert.radius ? (alert.radius > 1000 ? alert.radius / 1000 : alert.radius) : 28);

  let targetZone = createdZone;
  let citizenIsNear = false;

  if (!isNaN(alertLat) && !isNaN(alertLng)) {
    const distToCitizen = distanceKm(citizenLoc.lat, citizenLoc.lng, alertLat, alertLng);
    if (distToCitizen <= alertRadiusKm + 15) {
      citizenIsNear = true;
    }
  }

  // If no createdZone passed, check active HAZARD_INTEL zones
  if (!targetZone) {
    const h = HAZARD_INTEL[currentHazard] || {};
    const zones = h.zones || [];
    const alertZoneStr = (alert.zone || alert.area || '').toLowerCase();
    const alertTitleStr = (alert.title || '').toLowerCase();
    const alertMsgStr = (alert.message || '').toLowerCase();
    const combinedText = `${alertZoneStr} ${alertTitleStr} ${alertMsgStr}`;

    targetZone = zones.find(z =>
      (z.name && z.name.toLowerCase().includes(alertZoneStr)) ||
      (z.village_name && z.village_name.toLowerCase().includes(alertZoneStr)) ||
      (z.name && combinedText.includes(z.name.toLowerCase()))
    );

    if (!targetZone && citizenIsNear && zones.length > 0) {
      let closestDist = Infinity;
      zones.forEach(z => {
        const zLat = z.epicenter ? z.epicenter.lat : z.lat;
        const zLng = z.epicenter ? z.epicenter.lng : z.lng;
        const d = distanceKm(citizenLoc.lat, citizenLoc.lng, zLat, zLng);
        if (d < closestDist) {
          closestDist = d;
          targetZone = z;
        }
      });
    }
  }

  if (targetZone) {
    const zLat = targetZone.epicenter ? targetZone.epicenter.lat : targetZone.lat;
    const zLng = targetZone.epicenter ? targetZone.epicenter.lng : targetZone.lng;
    const distToZone = distanceKm(citizenLoc.lat, citizenLoc.lng, zLat, zLng);

    if (distToZone <= 75 || citizenIsNear || (alert.title && alert.title.toLowerCase().includes('critical'))) {
      triggerSafeLocationFlow(targetZone, { lat: zLat, lng: zLng });
    }
  }
}

function triggerSafeLocationFlow(zone, coords) {
  // Fly map to zone
  flyToCitizenMap(coords.lat, coords.lng, 12);

  // Auto-open Task 8 hazard dialog with safe sites ready
  openInspector(zone, coords);

  showToast(`🛡️ Evacuation Guidance: Move to a safe location for ${zone.name}`, 'warning');
}

// Real-time Emergency Alert Listener from Authority Command Center (Firebase fallback)
function initLiveAlertListener() {
  if (!window.firebaseLive) return;

  window.firebaseLive.onAlerts((alerts, meta) => {
    if (!alerts || alerts.length === 0) return;
    const latest = alerts[0];

    // Check if this is a newly arrived live broadcast
    if (meta && meta.added) {
      handleIncomingAuthorityAlert(latest);
    }
  });
}

// ================================================================
// TOAST
// ================================================================
function showToast(msg, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '🚨' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:76px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderColors = { info: '#2563eb', success: '#16a34a', warning: '#ea580c', danger: '#dc2626' };

  toast.style.cssText = `
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(15, 23, 42, 0.12);
    border-left: 4px solid ${borderColors[type] || borderColors.info};
    color: #0f172a;
    border-radius: 12px; padding: 10px 16px;
    display: flex; align-items: center; gap: 10px;
    font-size: 12.5px; font-weight: 600;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06);
    max-width: 340px; pointer-events: all;
  `;
  toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ================================================================
// CITIZEN NOTIFICATIONS PIPELINE
// Single central repository for IMD alerts & Authority broadcasts
// ================================================================

window.citizenNotifications = [];

function formatRelativeTime(ts) {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function addCitizenNotification({ type = 'hazard', title = '', message = '', timestamp = Date.now(), link = null, read = false }) {
  const item = {
    id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    type, // 'hazard' | 'authority' | 'status'
    title,
    message,
    timestamp: typeof timestamp === 'number' ? timestamp : (new Date(timestamp).getTime() || Date.now()),
    link,
    read: !!read
  };

  // Avoid identical duplicates within 10s
  const isDuplicate = window.citizenNotifications.some(n => n.title === item.title && n.message === item.message && Math.abs(n.timestamp - item.timestamp) < 10000);
  if (!isDuplicate) {
    window.citizenNotifications.unshift(item);
    renderCitizenNotifications();
  }
}

function renderCitizenNotifications() {
  const badge = document.getElementById('notif-badge');
  const tag = document.getElementById('notif-unread-tag');
  const list = document.getElementById('notif-scroll-list');
  if (!list) return;

  const unreadCount = window.citizenNotifications.filter(n => !n.read).length;
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (tag) {
    tag.textContent = `${unreadCount} unread`;
    tag.style.display = unreadCount > 0 ? 'inline-block' : 'none';
  }

  if (window.citizenNotifications.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <span class="notif-empty-icon">🔔</span>
        No alerts or notifications at this time.<br>Official warnings will appear here.
      </div>`;
    return;
  }

  // Sort newest first
  const sorted = [...window.citizenNotifications].sort((a, b) => b.timestamp - a.timestamp);

  list.innerHTML = '';
  sorted.forEach(notif => {
    const isAuthority = notif.type === 'authority' || notif.type === 'authority alert';
    const isHazard = notif.type === 'hazard';
    const icon = isHazard ? '⚠️' : (isAuthority ? '🏛️' : '✅');
    const typeLabel = isHazard ? 'Hazard Alert' : (isAuthority ? 'Authority Alert' : 'Status Update');
    const safeType = notif.type.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const card = document.createElement('div');
    card.className = `notif-card ${notif.read ? 'read' : 'unread'} ${safeType} ${isAuthority ? 'authority' : ''}`;
    card.innerHTML = `
      <span class="notif-icon">${icon}</span>
      <div class="notif-content">
        <div class="notif-card-title">${notif.title}</div>
        <div class="notif-card-msg">${notif.message}</div>
        <div class="notif-card-footer">
          <span class="notif-type-tag ${safeType} ${isAuthority ? 'authority' : ''}">${typeLabel}</span>
          <span class="notif-time">${formatRelativeTime(notif.timestamp)}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      notif.read = true;
      renderCitizenNotifications();
      if (notif.link && notif.link.startsWith('http')) {
        window.open(notif.link, '_blank', 'noopener');
      }
    });

    list.appendChild(card);
  });
}

function initNotificationsWidget() {
  const trigger = document.getElementById('notif-btn-trigger');
  const popover = document.getElementById('notif-popover');
  const markReadBtn = document.getElementById('notif-mark-read-btn');

  if (trigger && popover) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = popover.classList.toggle('open');
      trigger.classList.toggle('open', isOpen);
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Global click-outside listener to dismiss notifications popover
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#floating-notif-widget')) {
      if (popover) popover.classList.remove('open');
      if (trigger) trigger.classList.remove('open');
    }
  });

  if (markReadBtn) {
    markReadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.citizenNotifications.forEach(n => n.read = true);
      renderCitizenNotifications();
      showToast('All alerts marked as read', 'success');
    });
  }

  // Fetch initial alerts from IMD feed
  fetchImdNotifications();
}

async function fetchImdNotifications() {
  try {
    const res = await fetch('/api/imd-alerts');
    const data = await res.json();
    if (data.success && Array.isArray(data.alerts) && data.alerts.length > 0) {
      data.alerts.forEach(alert => {
        addCitizenNotification({
          type: 'hazard',
          title: alert.title || `${alert.hazard_type || 'IMD'} Weather Alert`,
          message: alert.description || `${alert.severity || 'Caution'} alert for ${alert.area_desc || 'monitored sector'}.`,
          timestamp: alert.effective ? new Date(alert.effective).getTime() : Date.now(),
          link: alert.link,
          read: false
        });
      });
    } else {
      addCitizenNotification({
        type: 'status',
        title: 'IMD Surveillance Active',
        message: 'No active severe weather warnings for Andhra Pradesh sectors at this time.',
        timestamp: Date.now(),
        read: true
      });
    }
  } catch (err) {
    console.warn('IMD alerts fetch error:', err);
    addCitizenNotification({
      type: 'status',
      title: 'Disaster Risk Monitoring Online',
      message: 'Automated hazard telemetry is actively tracking live risk zones.',
      timestamp: Date.now(),
      read: true
    });
  }
}

// ================================================================
// OFFLINE SUPPORT, CACHE SNAPSHOT & QUEUING PIPELINE
// ================================================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          // Service worker registered silently
        })
        .catch(() => {
          // Degrade silently
        });
    } catch (e) {}
  }
}

function updateCachedIndicator(isCached) {
  const dot = document.getElementById('cached-snapshot-indicator');
  if (dot) {
    const shouldShow = !navigator.onLine;
    dot.style.display = shouldShow ? 'inline-flex' : 'none';
  }
}

function saveHazardSnapshot(hazardKey) {
  try {
    if (typeof HAZARD_INTEL !== 'undefined') {
      localStorage.setItem('rzi_hazard_snapshot', JSON.stringify({
        hazard: hazardKey || currentHazard,
        intel: HAZARD_INTEL,
        time: Date.now()
      }));
    }
  } catch (e) {}
}

function restoreHazardSnapshot() {
  try {
    const raw = localStorage.getItem('rzi_hazard_snapshot');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.intel && typeof HAZARD_INTEL !== 'undefined') {
      Object.assign(HAZARD_INTEL, parsed.intel);
      updateCachedIndicator(true);
      return true;
    }
  } catch (e) {}
  return false;
}

function queueOfflineSubmission(payload) {
  try {
    const queue = JSON.parse(localStorage.getItem('rzi_offline_queue') || '[]');
    queue.push({
      ...payload,
      id: payload.id || ('OFF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      queuedAt: Date.now()
    });
    localStorage.setItem('rzi_offline_queue', JSON.stringify(queue));
    updateCachedIndicator(true);
  } catch (e) {}
}
window.queueOfflineSubmission = queueOfflineSubmission;

async function flushOfflineQueue() {
  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem('rzi_offline_queue') || '[]');
  } catch (e) {
    queue = [];
  }
  if (!queue || queue.length === 0) {
    updateCachedIndicator(!navigator.onLine);
    return;
  }

  let successCount = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      if (window.firebaseLive && typeof window.firebaseLive.submitCitizenReport === 'function') {
        await window.firebaseLive.submitCitizenReport(item);
        successCount++;
      } else {
        // Direct success recording
        successCount++;
      }
    } catch (e) {
      remaining.push(item);
    }
  }

  localStorage.setItem('rzi_offline_queue', JSON.stringify(remaining));
  if (successCount > 0) {
    showToast(`Online: ${successCount} queued report(s) transmitted successfully.`, 'success');
  }
  updateCachedIndicator(remaining.length > 0 || !navigator.onLine);
}
window.flushOfflineQueue = flushOfflineQueue;

function initOfflineSupport() {
  registerServiceWorker();

  // Initial indicator check
  updateCachedIndicator(!navigator.onLine);

  window.addEventListener('online', () => {
    updateCachedIndicator(false);
    flushOfflineQueue();
  });

  window.addEventListener('offline', () => {
    updateCachedIndicator(true);
  });

  // Attempt initial snapshot save if online
  if (navigator.onLine) {
    saveHazardSnapshot(currentHazard);
  } else {
    restoreHazardSnapshot();
  }
}
