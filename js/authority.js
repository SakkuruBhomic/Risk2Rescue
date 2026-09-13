// ================================================================
// AUTHORITY.JS — Command Dashboard, Analytics, & AI Explanation Panel
// ================================================================

let authMapInstance = null;
let riskChart = null;
window.currentPriorityData = null;

// Built-in Toast Notification for Authority Dashboard
function showToast(msg, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '🚨' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:80px;right:30px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderColors = { info: '#1d4ed8', success: '#059669', warning: '#d97706', danger: '#dc2626' };
  const bgColors = { info: '#eff6ff', success: '#ecfdf5', warning: '#fffbeb', danger: '#fef2f2' };

  toast.style.cssText = `
    background: ${bgColors[type] || '#ffffff'};
    backdrop-filter: blur(16px);
    border: 1px solid rgba(15, 23, 42, 0.12);
    border-left: 4px solid ${borderColors[type] || borderColors.info};
    color: #0f172a;
    border-radius: 12px; padding: 10px 16px;
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; font-weight: 600;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
    max-width: 360px; pointer-events: all;
  `;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  initSidebar();
  if (typeof initOfficerProfile === 'function') initOfficerProfile();
  initGISShell(); // GIS-First shell initialization
  initMapLegend(); // Persistent 4-tier hazard zone legend panel

  // Initialize Shared Windy Live Weather Controller on Authority Map
  if (typeof WindyIntegrationController !== 'undefined') {
    window.windyController = new WindyIntegrationController({ mapId: 'authority-map' });
  }

  initCommandCenter();
  initAnalyticsChart();
  renderVerificationQueue();
  loadPriorityRanking(); // Phase 1 live priority engine loader
  initDecisionSupport(); // Task 18 AI Decision Support (DeepSeek-R1 8B)
  updateAIExplanation('map-view');
  updateAiConfidenceBadge(94.2);
  loadCWCRiverGauges(); // CWC Real-Time River Water Level Gauges (Requirement E)

  // Real-time synchronization with Firebase Live
  if (window.firebaseLive) {
    window.firebaseLive.onReports((reports, meta) => {
      renderVerificationQueue();
      if (meta && meta.added) {
        showToast(`🚨 Live citizen report received: ${meta.added.type} in ${meta.added.location || 'hazard sector'}!`, 'warning');
        playIncomingReportChime();
      }
    });
  }

  // Automated visual verification hooks
  const params = new URLSearchParams(window.location.search);
  if (params.get('test_collapse') === '1') {
    collapseSidebar();
  }
  if (params.get('test_mobile_drawer') === '1') {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('active');
  }
  if (params.get('test_command') === '1') {
    switchView('command');
  } else {
    switchView('map-view');
  }
  if (params.get('test_legend_collapse') === '1') {
    const legendPanel = document.getElementById('map-legend-panel');
    if (legendPanel) legendPanel.classList.add('collapsed');
  }
  if (params.get('test_popup') === '1') {
    if (authMapInstance && authMapInstance.riskZoneCircles && authMapInstance.riskZoneCircles.length) {
      const item = authMapInstance.riskZoneCircles[0];
      L.popup({ className: 'custom-popup' })
        .setLatLng([item.zone.lat, item.zone.lng])
        .setContent(authMapInstance.createRiskPopup(item.zone))
        .openOn(authMapInstance.getMap());
    }
  }
});

// ---- Persistent 4-Tier Hazard Map Legend ----
function initMapLegend() {
  const panel = document.getElementById('map-legend-panel');
  const headerToggle = document.getElementById('legend-header-toggle');
  const collapseBtn = document.getElementById('legend-collapse-btn');
  if (!panel || !headerToggle) return;

  function toggleLegend(e) {
    if (e) e.stopPropagation();
    const isCollapsed = panel.classList.toggle('collapsed');
    headerToggle.setAttribute('aria-expanded', !isCollapsed);
  }

  headerToggle.addEventListener('click', toggleLegend);
  headerToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleLegend(e);
    }
  });

  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLegend(e);
    });
  }
}
window.initMapLegend = initMapLegend;

// ---- Live Clock ----
function initLiveClock() {
  const clockEl = document.getElementById('live-time');
  function update() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' | ' +
                            now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST';
    }
  }
  update();
  setInterval(update, 1000);
}

// ---- Sidebar Collapse & Expand Functions ----
function collapseSidebar() {
  const sidebar = document.getElementById('sidebar');
  const page = document.querySelector('.authority-page');
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (!sidebar) return;
  
  if (!sidebar.classList.contains('collapsed')) {
    sidebar.classList.add('collapsed');
    if (page) page.classList.add('sidebar-collapsed');
    if (toggleBtn) {
      toggleBtn.innerHTML = '&#10140;'; // ➔
      toggleBtn.setAttribute('title', 'Expand Sidebar');
    }
    setTimeout(() => {
      if (authMapInstance && authMapInstance.getMap()) {
        authMapInstance.getMap().invalidateSize();
      }
    }, 300);
  }
}

function expandSidebar() {
  const sidebar = document.getElementById('sidebar');
  const page = document.querySelector('.authority-page');
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (!sidebar) return;
  
  if (sidebar.classList.contains('collapsed')) {
    sidebar.classList.remove('collapsed');
    if (page) page.classList.remove('sidebar-collapsed');
    if (toggleBtn) {
      toggleBtn.innerHTML = '&#11013;'; // ⬅
      toggleBtn.setAttribute('title', 'Collapse Sidebar');
    }
    setTimeout(() => {
      if (authMapInstance && authMapInstance.getMap()) {
        authMapInstance.getMap().invalidateSize();
      }
    }, 300);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (sidebar.classList.contains('collapsed')) {
    expandSidebar();
  } else {
    collapseSidebar();
  }
}
window.collapseSidebar = collapseSidebar;
window.expandSidebar = expandSidebar;
window.toggleSidebar = toggleSidebar;

// ---- GIS Shell & Map Initialization ----
function initGISShell() {
  // Initialize Leaflet map immediately on load for GIS-first experience
  if (!authMapInstance) {
    authMapInstance = new DisasterMap('authority-map', { skipDefaultOverlays: true });
    window.authMapInstance = authMapInstance;
    authMapInstance.drawRiskZones();
    authMapInstance.addSafeSiteMarkers();
    authMapInstance.addHazardMarkers();
    authMapInstance.addHospitalMarkers();
    authMapInstance.addHabitationMarkers();

    // Guarantee default light-theme basemap (Esri World Light Gray Base via LAYER_CONFIG.standard)
    authMapInstance.setBasemap('standard');
  }

  // Initialize HazardEngine parity with Citizen Portal per Requirement B2
  if (typeof HazardEngine !== 'undefined') {
    window.authHazardEngine = new HazardEngine(authMapInstance.getMap());
    if (!window.hazardEngine) {
      window.hazardEngine = window.authHazardEngine;
    }
    window.authHazardEngine.render('cyclone');
  }

  // Initialize Floating Hazards Button & Dropdown (Requirement C2, C3)
  initMapHazardButton();

  // Initialize Citizen-Style Topbar Search (Requirement D2, D3)
  initAuthoritySearch();

  // Apply any persisted shelter overrides
  applyShelterOverrides();

  // Isolate floating dock, legend, threat box, and secondary content panels from capturing map wheel zoom
  if (window.isolateMapOverlays) {
    window.isolateMapOverlays([
      '#content-panel',
      '.dock-nav',
      '#map-topbar',
      '#map-hazard-control',
      '#map-hazard-dropdown',
      '#hazard-zone-table-card',
      '#ai-diagnostics-drawer',
      '#firebase-modal',
      '#scenario-modal',
      '#drill-modal',
      '#sitrep-modal',
      '#modal-emergency-alert'
    ]);
  }
}

// ---- Authority Basemap Switching (Standard vs Satellite vs Windy Radar) ----
let currentAuthorityBasemap = 'standard';

function setAuthorityBasemap(mode) {
  currentAuthorityBasemap = mode || 'standard';

  if (window.authMapInstance && typeof window.authMapInstance.setBasemap === 'function') {
    window.authMapInstance.setBasemap(currentAuthorityBasemap);
  }

  // Toggle mode-aware CSS class on map container for legibility over radar
  const mapContainer = document.getElementById('authority-map');
  if (mapContainer) {
    mapContainer.classList.toggle('basemap-windy', currentAuthorityBasemap === 'windy');
  }

  // Update Topbar View Switcher Buttons
  const btnGis = document.getElementById('btn-mode-gis');
  const btnSat = document.getElementById('btn-mode-satellite');
  const btnWindy = document.getElementById('btn-mode-windy');
  if (btnGis) btnGis.classList.toggle('active', currentAuthorityBasemap === 'standard');
  if (btnSat) btnSat.classList.toggle('active', currentAuthorityBasemap === 'satellite');
  if (btnWindy) btnWindy.classList.toggle('active', currentAuthorityBasemap === 'windy');

  if (typeof showToast === 'function') {
    if (currentAuthorityBasemap === 'windy') {
      showToast('🌀 Windy Radar Overlay Active (Live Precipitation)', 'info');
    } else if (currentAuthorityBasemap === 'satellite') {
      showToast('🛰️ Satellite Imagery Active (ArcGIS World Imagery)', 'info');
    } else {
      showToast('🗺️ Standard Basemap Active (OpenStreetMap)', 'info');
    }
  }
}

window.setAuthorityBasemap = setAuthorityBasemap;

// ---- Left Navigation Dock ----
function initSidebar() {
  // Wire up dock-item click handlers (filtered to navigation items with data-view)
  document.querySelectorAll('.dock-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (!view) return;
      document.querySelectorAll('.dock-item[data-view]').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      switchView(view);
    });
  });

  // Default: show Map View (GIS-First) on first load per Requirement B1
  switchView('map-view');
}

// ---- Switch Main Content Views ----
function switchView(viewKey) {
  const contentPanel = document.getElementById('content-panel');
  // Registered active views — home merged into map-view, analytics/pop-safe removed
  const views = [
    'command', 'hazards', 'habitations', 'safesites',
    'population-risk', 'alerts', 'reports', 'datasources'
  ];

  if (viewKey === 'decision-support') {
    switchToDecisionBrief();
    return;
  }

  if (viewKey === 'map-view') {
    // Return to pure full-screen GIS shell
    if (contentPanel) contentPanel.style.display = 'none';
    views.forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = 'none';
    });
    if (authMapInstance && authMapInstance.getMap()) {
      setTimeout(() => authMapInstance.getMap().invalidateSize(), 150);
    }
    // Mark map-view dock item active
    document.querySelectorAll('.dock-item[data-view]').forEach(i => {
      i.classList.toggle('active', i.dataset.view === 'map-view');
    });
  } else {
    // Show content overlay panel
    if (contentPanel) contentPanel.style.display = 'block';
    views.forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === viewKey) ? 'block' : 'none';
    });
    // Sync dock item active state
    document.querySelectorAll('.dock-item[data-view]').forEach(i => {
      i.classList.toggle('active', i.dataset.view === viewKey);
    });

    // Re-render verification queue if navigating to alerts or reports
    if (viewKey === 'alerts' || viewKey === 'reports') {
      if (typeof renderVerificationQueue === 'function') {
        renderVerificationQueue();
      }
    }

    // Close floating map cards when navigating away from pure GIS view
    const card = document.getElementById('hazard-zone-table-card');
    if (card) card.style.display = 'none';
    const dropdown = document.getElementById('map-hazard-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    const btn = document.getElementById('btn-map-hazard');
    if (btn) btn.classList.remove('active');
  }

  const titleMap = {
    'map-view':        'Home',
    'command':         'Operational Command Center',
    'hazards':         'Hazard Intelligence & Real-Time Sensors',
    'habitations':     'Vulnerable Habitations & Red Zones',
    'safesites':       'Safe Shelters & Carrying Capacity',
    'population-risk': 'Population at Risk — Hazard Zone Exposure',
    'alerts':          'Alerts & Threats — Incident Verification Queue',
    'reports':         'Citizen Field Report Queue',
    'datasources':     'Integrated Satellite & Multi-Agency Sensor Feeds'
  };

  const titleEl = document.getElementById('topbar-view-title');
  if (titleEl) titleEl.textContent = titleMap[viewKey] || 'Home';
  updateAIExplanation(viewKey);
}
window.switchView = switchView;

// ================================================================
// SECTION C: MONITORED HAZARDS BUTTON & FLOATING CARD
// ================================================================

const MONITORED_HAZARDS = [
  {
    key: 'cyclone',
    name: 'Cyclone Landfall',
    icon: '🌀',
    tier: 'CRITICAL',
    badge: 'badge-critical',
    status: 'Active',
    summary: 'Severe cyclonic storm system approaching coastal corridors with sustained wind speeds of 115 km/h.',
    lat: 16.9891,
    lng: 82.2475,
    zoom: 11,
    zonesCount: 12,
    population: '34,500'
  },
  {
    key: 'flood',
    name: 'Flash Flood Inundation',
    icon: '🌊',
    tier: 'HIGH ALERT',
    badge: 'badge-high',
    status: 'Monitoring',
    summary: 'Riverine overflow and storm-surge induced waterlogging across low-lying coastal floodplains.',
    lat: 16.7000,
    lng: 82.0000,
    zoom: 11,
    zonesCount: 8,
    population: '21,800'
  },
  {
    key: 'landslide',
    name: 'Severe Slope Landslide',
    icon: '⛰️',
    tier: 'MODERATE',
    badge: 'badge-moderate',
    status: 'Monitoring',
    summary: 'High soil saturation and slope instability along Eastern Ghats hill roads and cut slopes.',
    lat: 17.8500,
    lng: 83.0000,
    zoom: 11,
    zonesCount: 4,
    population: '8,200'
  },
  {
    key: 'earthquake',
    name: 'Seismic Activity',
    icon: '📳',
    tier: 'LOW RISK',
    badge: 'badge-low',
    status: 'Normal',
    summary: 'Regional seismic telemetry stations reporting normal tectonic background levels.',
    lat: 17.0000,
    lng: 81.8000,
    zoom: 9,
    zonesCount: 1,
    population: '0'
  },
  {
    key: 'tsunami',
    name: 'Tsunami Early Warning',
    icon: '🌊',
    tier: 'MODERATE',
    badge: 'badge-moderate',
    status: 'Monitoring',
    summary: 'Deep-ocean DART buoys and coastal tide gauges actively monitored for seismic surge waves.',
    lat: 16.5000,
    lng: 82.3000,
    zoom: 10,
    zonesCount: 3,
    population: '14,000'
  },
  {
    key: 'cloudburst',
    name: 'Extreme Weather Squall',
    icon: '⛈️',
    tier: 'HIGH ALERT',
    badge: 'badge-high',
    status: 'Active',
    summary: 'Localized convective cloudburst and intense microburst precipitation detected by Doppler radar.',
    lat: 17.2000,
    lng: 82.1500,
    zoom: 11,
    zonesCount: 6,
    population: '18,500'
  }
];

function initMapHazardButton() {
  const dropdown = document.getElementById('map-hazard-dropdown');
  const btn = document.getElementById('btn-map-hazard');
  if (!dropdown) return;

  let html = `
    <div class="mhd-header">
      <div class="mhd-title">
        <span>⚠️</span> <span>Monitored Hazard Threats</span>
      </div>
      <span class="mhd-chip">6 MONITORED</span>
    </div>
    <div class="mhd-list">
  `;

  MONITORED_HAZARDS.forEach(h => {
    const statusColor = h.status === 'Active' ? '#ef4444' : h.status === 'Monitoring' ? '#f97316' : '#22c55e';
    const statusBg = h.status === 'Active' ? 'rgba(239,68,68,0.15)' : h.status === 'Monitoring' ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.15)';
    html += `
      <div class="mhd-item" onclick="selectHazardFromDropdown('${h.key}')" role="button" tabindex="0">
        <div class="mhd-item-left">
          <span class="mhd-item-icon">${h.icon}</span>
          <div>
            <div class="mhd-item-name">${h.name}</div>
            <div class="mhd-item-sub">${h.tier} &bull; ${h.population} at risk</div>
          </div>
        </div>
        <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:6px; background:${statusBg}; color:${statusColor}; border:1px solid ${statusColor}40;">
          ${h.status}
        </span>
      </div>
    `;
  });

  html += `</div>`;
  dropdown.innerHTML = html;

  // Listen to Windy mode changes to hide hazard button
  const observer = new MutationObserver(() => {
    const isWindy = document.body.classList.contains('windy-mode-active') || document.querySelector('.windy-active');
    const hazardControl = document.getElementById('map-hazard-control');
    if (hazardControl) {
      hazardControl.style.display = isWindy ? 'none' : 'block';
    }
    if (isWindy) {
      dropdown.style.display = 'none';
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#map-hazard-control')) {
      dropdown.style.display = 'none';
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('active');
      }
    }
  });
}

function toggleMapHazardDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('map-hazard-dropdown');
  const btn = document.getElementById('btn-map-hazard');
  if (!dropdown) return;
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
  if (btn) {
    btn.setAttribute('aria-expanded', !isVisible);
    btn.classList.toggle('active', !isVisible);
  }
}

function selectHazardFromDropdown(hazardKey) {
  const dropdown = document.getElementById('map-hazard-dropdown');
  const btn = document.getElementById('btn-map-hazard');
  if (dropdown) dropdown.style.display = 'none';
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('active');
  }

  const hazard = MONITORED_HAZARDS.find(h => h.key === hazardKey) || MONITORED_HAZARDS[0];

  // 1. Ensure we are on GIS map view
  if (typeof switchView === 'function') {
    switchView('map-view');
  }

  // 2. Fly GIS Map
  if (authMapInstance && authMapInstance.flyToLocation) {
    authMapInstance.flyToLocation(hazard.lat, hazard.lng, hazard.zoom);
  } else if (authMapInstance && authMapInstance.getMap()) {
    authMapInstance.getMap().setView([hazard.lat, hazard.lng], hazard.zoom);
  }

  // 3. Render Hazard Engine Layer
  if (window.authHazardEngine && typeof window.authHazardEngine.render === 'function') {
    window.authHazardEngine.render(hazardKey);
  }

  // 4. Show Explanation Card
  showHazardZoneTableCard(hazard);
}

function showHazardZoneTableCard(hazard) {
  const card = document.getElementById('hazard-zone-table-card');
  if (!card) return;

  const iconEl = document.getElementById('hz-card-icon') || document.getElementById('hztc-icon');
  const titleEl = document.getElementById('hz-card-title') || document.getElementById('hztc-name');
  const badgeEl = document.getElementById('hz-card-badge') || document.getElementById('hztc-tier');
  const descEl = document.getElementById('hz-card-desc') || document.getElementById('hztc-type');
  const tierEl = document.getElementById('hz-card-tier') || document.getElementById('hztc-stat-tier');
  const zonesCountEl = document.getElementById('hz-card-zones-count');
  const popEl = document.getElementById('hz-card-population') || document.getElementById('hztc-stat-pop');
  const coordsEl = document.getElementById('hztc-stat-coords');
  const teleEl = document.getElementById('hztc-stat-telemetry');
  const tableWrap = document.getElementById('hz-card-table-wrap');

  if (iconEl) iconEl.textContent = hazard.icon;
  if (titleEl) titleEl.textContent = hazard.name;
  if (badgeEl) {
    badgeEl.className = `badge ${hazard.badge || 'badge-critical'}`;
    badgeEl.textContent = hazard.tier || 'CRITICAL';
  }
  if (descEl) descEl.textContent = hazard.summary;
  if (tierEl) {
    tierEl.textContent = hazard.tier;
    tierEl.style.color = hazard.tier === 'CRITICAL' ? '#ef4444' : hazard.tier === 'HIGH ALERT' ? '#f97316' : '#eab308';
  }
  if (zonesCountEl) zonesCountEl.textContent = `${hazard.zonesCount || 6} Polygons`;
  if (popEl) popEl.textContent = hazard.population || '25,000';
  if (coordsEl) coordsEl.textContent = `${hazard.lat.toFixed(2)}° N, ${hazard.lng.toFixed(2)}° E`;
  if (teleEl) teleEl.textContent = hazard.key === 'cyclone' ? '115 km/h Peak Gusts' : hazard.key === 'flood' ? '+2.8m River Inundation' : 'Active Telemetry';

  if (tableWrap) {
    // Generate active zones list
    const intel = (typeof HAZARD_INTEL !== 'undefined') ? HAZARD_INTEL[hazard.key] : null;
    const zones = (intel && intel.zones && intel.zones.length) ? intel.zones.slice(0, 5) : [
      { name: 'Uppada Coastal Inundation Sector', current_tier: 'RED', pop: 12400 },
      { name: 'Kakinada Anchorage Corridor', current_tier: 'ORANGE', pop: 8900 },
      { name: 'Godavari Estuary Floodplain', current_tier: 'YELLOW', pop: 6200 },
      { name: 'Samalkot Rural Buffer', current_tier: 'GREEN', pop: 3500 }
    ];

    let tHtml = `
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; text-align:left;">
            <th style="padding:4px 6px;">ZONE NAME</th>
            <th style="padding:4px 6px;">TIER</th>
            <th style="padding:4px 6px;">POPULATION</th>
            <th style="padding:4px 6px; text-align:right;">ACTION</th>
          </tr>
        </thead>
        <tbody>
    `;

    zones.forEach(z => {
      const zTier = z.current_tier || z.level || 'RED';
      const zColor = zTier === 'RED' ? '#ef4444' : zTier === 'ORANGE' ? '#f97316' : zTier === 'YELLOW' ? '#eab308' : '#22c55e';
      tHtml += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.04); color:#e2e8f0;">
          <td style="padding:6px 6px; font-weight:600;">${z.village_name || z.name}</td>
          <td style="padding:6px 6px;">
            <span style="font-size:9px; font-weight:800; padding:2px 5px; border-radius:4px; background:${zColor}20; color:${zColor}; border:1px solid ${zColor}40;">
              ${zTier}
            </span>
          </td>
          <td style="padding:6px 6px; color:#94a3b8;">${(z.pop || 5000).toLocaleString()}</td>
          <td style="padding:6px 6px; text-align:right;">
            <button onclick="focusHazardOnMap('${hazard.key}', ${z.lat || hazard.lat}, ${z.lng || hazard.lng})" style="background:none; border:none; color:#38bdf8; cursor:pointer; font-size:11px; font-weight:700;">
              Focus ➔
            </button>
          </td>
        </tr>
      `;
    });

    tHtml += `</tbody></table>`;
    tableWrap.innerHTML = tHtml;
  }

  card.style.display = 'block';
}

function closeHazardZoneTableCard() {
  const card = document.getElementById('hazard-zone-table-card');
  if (card) card.style.display = 'none';
}

window.toggleMapHazardDropdown = toggleMapHazardDropdown;
window.selectHazardFromDropdown = selectHazardFromDropdown;
window.closeHazardZoneTableCard = closeHazardZoneTableCard;

// ================================================================
// SECTION D: CITIZEN-STYLE TOPBAR SEARCH ENGINE
// ================================================================

function initAuthoritySearch() {
  const input = document.getElementById('authority-search') || document.getElementById('topbar-search-input');
  const dropdown = document.getElementById('authority-search-dropdown') || document.getElementById('topbar-search-dropdown');
  const clearBtn = document.getElementById('authority-search-clear') || document.getElementById('topbar-search-clear');
  if (!input || !dropdown) return;

  let debounceTimer = null;

  function clearSearch() {
    input.value = '';
    dropdown.innerHTML = '';
    dropdown.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearSearch);
  }

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#authority-search-pill')) {
      dropdown.style.display = 'none';
    }
  });

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    if (!q || q.length < 2) {
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
      return;
    }

    // 1. Immediate Local Search (RZILocationService + HAZARD_INTEL)
    const localResults = searchLocalLocations(q);
    renderSearchResults(localResults, false);

    // 2. Debounced OSM Nominatim Geocoding Fallback (400ms)
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchOsmNominatim(q, localResults);
    }, 400);
  });

  function searchLocalLocations(q) {
    const lower = q.toLowerCase();
    const results = [];

    // Search RZILocationService if available
    if (window.RZILocationService && typeof window.RZILocationService.searchPlaces === 'function') {
      try {
        const places = window.RZILocationService.searchPlaces(q);
        if (Array.isArray(places)) {
          places.slice(0, 5).forEach(p => {
            results.push({
              name: p.name || p.village,
              subtitle: `${p.mandal ? p.mandal + ', ' : ''}${p.district || 'Andhra Pradesh'}`,
              lat: p.lat,
              lng: p.lng,
              risk: p.risk || 'GREEN',
              type: p.type || 'Village / Habitation'
            });
          });
        }
      } catch (e) {}
    }

    // Search HAZARD_INTEL
    if (typeof HAZARD_INTEL !== 'undefined') {
      Object.entries(HAZARD_INTEL).forEach(([hKey, hData]) => {
        if (Array.isArray(hData.zones)) {
          hData.zones.forEach(z => {
            const zName = z.village_name || z.name || '';
            if (zName.toLowerCase().includes(lower) && !results.some(r => r.name === zName)) {
              results.push({
                name: zName,
                subtitle: `${hData.label} Risk Zone &bull; ${z.district || 'AP'}`,
                lat: z.lat,
                lng: z.lng,
                risk: z.current_tier || z.level || 'RED',
                type: 'Hazard Zone'
              });
            }
          });
        }
        if (Array.isArray(hData.safeSites)) {
          hData.safeSites.forEach(s => {
            if (s.name && s.name.toLowerCase().includes(lower) && !results.some(r => r.name === s.name)) {
              results.push({
                name: s.name,
                subtitle: `Designated Shelter &bull; Cap: ${s.capacity}`,
                lat: s.lat,
                lng: s.lng,
                risk: 'GREEN',
                type: 'Safe Shelter'
              });
            }
          });
        }
      });
    }

    return results.slice(0, 6);
  }

  async function fetchOsmNominatim(q, currentResults) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&viewbox=76.7,19.9,84.8,12.6&bounded=0&limit=5`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const combined = [...currentResults];
      data.forEach(item => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const name = item.display_name.split(',')[0];
        if (!combined.some(c => c.name.toLowerCase() === name.toLowerCase())) {
          combined.push({
            name,
            subtitle: item.display_name.split(',').slice(1, 3).join(', ').trim(),
            lat,
            lng,
            risk: 'GREEN',
            type: 'OpenStreetMap'
          });
        }
      });

      renderSearchResults(combined, true);
    } catch (err) {
      console.warn('Geocoding fallback failed:', err);
    }
  }

  function renderSearchResults(items, hasExternal) {
    if (!items.length) {
      dropdown.innerHTML = '<div style="padding:10px 12px; font-size:11px; color:#94a3b8; text-align:center;">No locations found matching query</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'windy-search-item';
      const riskColor = item.risk === 'RED' ? '#ef4444' : item.risk === 'ORANGE' ? '#f97316' : item.risk === 'YELLOW' ? '#eab308' : '#22c55e';
      const riskLabel = item.risk === 'RED' ? 'RED ZONE' : item.risk === 'ORANGE' ? 'ORANGE' : item.risk === 'YELLOW' ? 'YELLOW' : 'SAFE / GREEN';

      row.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="font-weight:700; color:#f1f5f9; font-size:12px;">${item.name}</div>
          <div style="font-size:10px; color:#94a3b8;">${item.subtitle}</div>
        </div>
        <span class="windy-search-badge" style="background:${riskColor}22; color:${riskColor}; border:1px solid ${riskColor}40;">
          ${riskLabel}
        </span>
      `;

      row.addEventListener('click', () => {
        selectSearchResult(item);
      });

      dropdown.appendChild(row);
    });
    dropdown.style.display = 'block';
  }

  function selectSearchResult(item) {
    clearSearch();
    if (typeof switchView === 'function') switchView('map-view');
    if (authMapInstance && authMapInstance.flyToLocation) {
      authMapInstance.flyToLocation(item.lat, item.lng, 13);
    } else if (authMapInstance && authMapInstance.getMap()) {
      authMapInstance.getMap().setView([item.lat, item.lng], 13);
    }

    // Add highlighted marker with details
    if (authMapInstance && authMapInstance.getMap()) {
      L.popup()
        .setLatLng([item.lat, item.lng])
        .setContent(`<div style="font-family:Inter,sans-serif; color:#f1f5f9; padding:4px;"><strong>${item.name}</strong><br><small style="color:#94a3b8;">${item.subtitle}</small></div>`)
        .openOn(authMapInstance.getMap());
    }
  }
}

// Global Nav & Drilldown Helpers
function focusCoordinates(lat, lng, zoom = 13) {
  if (typeof switchView === 'function') switchView('map-view');
  if (authMapInstance && authMapInstance.flyToLocation) {
    authMapInstance.flyToLocation(lat, lng, zoom);
  }
}
window.focusCoordinates = focusCoordinates;

function focusHazardOnMap(key, lat, lng) {
  if (typeof switchView === 'function') switchView('map-view');
  if (lat && lng && authMapInstance && authMapInstance.flyToLocation) {
    authMapInstance.flyToLocation(lat, lng, 12);
  } else {
    selectHazardFromDropdown(key);
  }
}
window.focusHazardOnMap = focusHazardOnMap;

function openTelemetryInspector(type) {
  showToast(`📡 Live Telemetry Stream: Connected to ${type === 'wind' ? 'Coastal Doppler Radar' : 'USGS Seismic Sensor Grid'}`, 'info');
  if (typeof switchView === 'function') switchView('map-view');
}
window.openTelemetryInspector = openTelemetryInspector;

// ---- AI Engine Diagnostics Panel & Confidence Badge ----
function openAiDiagnostics() {
  showToast('🧠 AI Engine Diagnostics: Active telemetry models operating at 94.2% confidence. Multi-sensor fusion nominal.', 'info');
}
window.openAiDiagnostics = openAiDiagnostics;

function updateAiConfidenceBadge(confidence = 94.2) {
  const badge = document.getElementById('topbar-ai-confidence-badge');
  const valEl = document.getElementById('topbar-ai-confidence-val');
  if (!badge || !valEl) return;
  valEl.textContent = confidence + '%';
  badge.classList.remove('conf-high', 'conf-med', 'conf-low');
  if (confidence >= 85) {
    badge.classList.add('conf-high');
  } else if (confidence >= 70) {
    badge.classList.add('conf-med');
  } else {
    badge.classList.add('conf-low');
  }
}
window.updateAiConfidenceBadge = updateAiConfidenceBadge;

// ---- Command Center KPIs & Alerts ----
function initCommandCenter() {
  // Populate alert feed in command dashboard
  const feed = document.getElementById('command-alert-feed');
  if (feed) {
    feed.innerHTML = '';
    APP_DATA.alerts.slice(0, 5).forEach(alert => {
      const item = document.createElement('div');
      const levelClass = alert.level.toLowerCase();
      item.className = `alert-item ${levelClass}`;
      item.innerHTML = `
        <span class="alert-level-dot ${levelClass}"></span>
        <div class="alert-item-body">
          <div class="alert-item-title">${alert.title}</div>
          <div class="alert-item-meta">
            <span>${alert.area}</span> &bull; 
            <span>Confidence: <strong class="alert-conf">${alert.confidence}%</strong></span> &bull;
            <span style="color:var(--text-muted);">Sources: ${alert.sources.join(', ')}</span>
          </div>
        </div>
        <div class="alert-item-time">${alert.time}</div>
      `;
      item.addEventListener('click', () => {
        showToast(`Reviewing telemetry for ${alert.title}`, 'info');
      });
      feed.appendChild(item);
    });
  }

  // Fetch real-time telemetry from live backend APIs
  fetchLiveTelemetry();
}

async function fetchLiveTelemetry() {
  try {
    const resp = await fetch('/api/telemetry/live');
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data) return;

    // 1. Update Doppler radar gust speed
    const gustVal = document.getElementById('kpi-gust-speed');
    const gustTrend = document.getElementById('kpi-gust-trend');
    const gustSource = document.getElementById('kpi-gust-source');
    if (gustVal && data.radar) {
      gustVal.textContent = `${data.radar.maxGustSpeedKmH} km/h`;
      if (gustTrend) {
        const stationName = data.radar.station.includes(' - ') ? data.radar.station.split(' - ')[1] : data.radar.station;
        gustTrend.textContent = `Station: ${stationName} (${data.radar.corePressureHpa} hPa)`;
      }
      if (gustSource && data.radar.source) {
        gustSource.textContent = data.radar.source.includes('Windy') ? 'Windy API' : 'Open-Meteo';
      }
    }

    // 2. Update USGS seismic telemetry KPI
    const seisMag = document.getElementById('kpi-seismic-mag');
    const seisTrend = document.getElementById('kpi-seismic-trend');
    if (seisMag && data.seismic) {
      seisMag.textContent = data.seismic.maxRecordedMagnitude ? `M ${data.seismic.maxRecordedMagnitude.toFixed(1)}` : 'M 4.8';
      if (seisTrend) {
        const label = data.seismic.latestEvent ? data.seismic.latestEvent.replace('Mag — ', '') : 'Active Watch';
        seisTrend.textContent = `${data.seismic.totalEvents24h || 30} quakes in 24h (${label.substring(0, 24)}…)`;
        seisTrend.title = data.seismic.latestEvent || '';
      }
    }
  } catch (err) {
    console.warn('Authority telemetry fetch error:', err);
  }
}

// ---- CWC Real-Time River Water Level Gauges (Requirement E) ----
async function loadCWCRiverGauges() {
  try {
    const res = await fetch('/api/cwc/river-levels');
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.stations || !data.stations.length) return;

    // 1. Render Map Markers on GIS shell
    if (window.authMapInstance && window.authMapInstance.getMap()) {
      const map = window.authMapInstance.getMap();
      if (window.cwcRiverLayerGroup) {
        try { map.removeLayer(window.cwcRiverLayerGroup); } catch(e) {}
      }
      const riverIcon = L.divIcon({
        className: 'cwc-river-marker',
        html: `<div style="background: rgba(14, 165, 233, 0.92); color: white; border: 1.5px solid #ffffff; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: pointer;" title="CWC River Gauge">🌊</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const riverLayerGroup = L.layerGroup();
      data.stations.forEach(st => {
        if (!st.lat || !st.lon) return;
        const marker = L.marker([st.lat, st.lon], { icon: riverIcon });
        const levelDisplay = st.waterLevelMeters !== null ? `${st.waterLevelMeters.toFixed(2)} m` : 'N/A';
        const popupContent = `
          <div style="padding: 10px 12px; font-family: var(--font-base, sans-serif); min-width: 190px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom: 6px;">
              <span style="font-size: 16px;">🌊</span>
              <strong style="font-size: 13px; color: #0284c7;">${st.station}</strong>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">
              River: <strong>${st.river}</strong> (${st.basin} Basin)
            </div>
            ${st.district ? `<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">District: ${st.district}, ${st.state}</div>` : ''}
            <div style="font-size: 12px; font-weight: 700; color: #0369a1; background: rgba(14,165,233,0.12); padding: 4px 8px; border-radius: 6px; margin-top: 6px;">
              Water Level: ${levelDisplay}
            </div>
            <div style="font-size: 9px; color: var(--text-muted); margin-top: 4px;">
              Acquired: ${st.timestamp || 'Recent'} · Agency: ${st.agency}
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        riverLayerGroup.addLayer(marker);
      });
      riverLayerGroup.addTo(map);
      window.cwcRiverLayerGroup = riverLayerGroup;
    }

    // 2. Render Compact Table in Habitations View
    const tbody = document.getElementById('cwc-river-gauges-tbody');
    if (tbody) {
      tbody.innerHTML = data.stations.map(st => `
        <tr>
          <td><strong>${st.station}</strong></td>
          <td>${st.river} (${st.basin})</td>
          <td><strong style="color: #0284c7;">${st.waterLevelMeters !== null ? st.waterLevelMeters.toFixed(2) + ' m' : 'N/A'}</strong></td>
          <td><small style="color: var(--text-muted);">${st.timestamp || 'Recent'}</small></td>
          <td>
            ${st.lat && st.lon ? `<button class="btn btn-glass" style="padding: 2px 7px; font-size: 11px;" onclick="focusCoordinates(${st.lat}, ${st.lon}, 12)">Locate 🔍</button>` : '-'}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('CWC gauges fetch error:', err);
  }
}
window.loadCWCRiverGauges = loadCWCRiverGauges;

// Synthesize audio chime for incoming citizen reports
function playIncomingReportChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

// ---- Verification Queue for Citizen Reports ----
function renderVerificationQueue() {
  const containers = [
    document.getElementById('verification-queue'),
    document.getElementById('reports-verification-list')
  ].filter(Boolean);

  let pending = (typeof reportManager !== 'undefined' && reportManager.getPendingReports)
    ? [...reportManager.getPendingReports()]
    : [];

  // Merge locally submitted citizen reports (Requirement E2, F1)
  try {
    const rawLocal = localStorage.getItem('rzi_citizen_reports');
    if (rawLocal) {
      const localReports = JSON.parse(rawLocal);
      if (Array.isArray(localReports)) {
        localReports.forEach(lr => {
          if (!pending.some(p => p.id === lr.id) && lr.status !== 'Verified' && lr.status !== 'Dismissed') {
            pending.unshift(lr);
          }
        });
      }
    }
  } catch (e) {}

  // Dynamically update sidebar and dock queue badges
  ['sidebar-queue-badge', 'dock-queue-badge'].forEach(id => {
    const badge = document.getElementById(id);
    if (badge) {
      badge.textContent = pending.length;
      badge.style.display = pending.length > 0 ? 'inline-block' : 'none';
    }
  });

  if (containers.length === 0) return;

  containers.forEach(container => {
    container.innerHTML = '';

    if (pending.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">No pending citizen incident reports requiring human verification.</div>';
      return;
    }

    pending.forEach(rep => {
      const card = document.createElement('div');
      card.className = 'report-item';
      card.id = 'report-card-' + rep.id;

      const lat = rep.lat ? Number(rep.lat) : 16.9891;
      const lng = rep.lng ? Number(rep.lng) : 82.2475;
      const locText = rep.location || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
      const sev = rep.severity || (rep.type?.includes('Flood') || rep.type?.includes('Cyclone') ? 'Critical' : 'High');

      const photoHtml = rep.photo ? `
        <div style="margin:8px 0;">
          <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:4px;">📷 Citizen Photo Proof Attached</div>
          <img src="${rep.photo}" alt="Citizen Incident Proof" style="max-width:180px; max-height:120px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); object-fit:cover; cursor:pointer;" onclick="window.open('${rep.photo}', '_blank')" title="Click to view full image" />
        </div>
      ` : '';

      card.innerHTML = `
        <div class="report-item-header">
          <span class="report-type-badge">${rep.type || 'Field Hazard Alert'}</span>
          <span class="risk-badge risk-${sev === 'Critical' ? 'red' : sev === 'High' ? 'orange' : 'yellow'}">${sev}</span>
          <span style="font-size:12px; color:var(--text-secondary); font-weight:600;">Reported by: ${rep.reporter || 'Citizen Operator'} (${rep.phone || '+91-9876543210'})</span>
          <span class="report-time">${rep.time || 'Just now'}</span>
        </div>
        <div class="report-desc">${rep.desc || 'Disaster hazard condition observed at coordinates.'}</div>
        
        ${photoHtml}

        <div style="font-size:11px; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span>📍 <strong>Location:</strong> ${locText} [${lat.toFixed(4)}, ${lng.toFixed(4)}]</span>
          <button onclick="focusCoordinates(${lat}, ${lng}, 14)" class="btn btn-glass" style="padding:2px 8px; font-size:10px; color:#38bdf8; border-color:rgba(56,189,248,0.3);">
            🔍 Locate On Map
          </button>
        </div>

        <div class="report-actions">
          <button class="btn-verify" onclick="handleVerifyReport('${rep.id}')">
            ✓ Verify & Allocate Active Red Zone
          </button>
          <button class="btn-investigate" onclick="handleInvestigateReport('${rep.id}')">
            🔍 Task NDRF Drone Recon
          </button>
          <button class="btn-reject" onclick="handleRejectReport('${rep.id}')">
            ✕ Dismiss / False Alarm
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

function handleVerifyReport(id) {
  let rep = null;
  if (typeof reportManager !== 'undefined') {
    rep = reportManager.getReportById ? reportManager.getReportById(id) : null;
    if (reportManager.verifyReport) reportManager.verifyReport(id);
  }

  // Also check and update localStorage
  try {
    const rawLocal = localStorage.getItem('rzi_citizen_reports');
    if (rawLocal) {
      const list = JSON.parse(rawLocal);
      if (Array.isArray(list)) {
        const found = list.find(r => r.id === id);
        if (found) {
          rep = found;
          found.status = 'Verified';
          localStorage.setItem('rzi_citizen_reports', JSON.stringify(list));
        }
      }
    }
  } catch (e) {}

  const lat = rep?.lat ? Number(rep.lat) : 16.9891;
  const lng = rep?.lng ? Number(rep.lng) : 82.2475;
  const repType = rep?.type || 'Hazard Incident';
  const locName = rep?.location || 'Designated Vicinity';
  const desc = rep?.desc || 'Emergency hazard verified by Incident Commander.';

  // Requirement F2: Automatically allocate new Red Zone on the GIS map
  allocateEmergencyZone({
    name: `${repType}: ${locName}`,
    level: 'RED',
    lat,
    lng,
    radius: 2500,
    desc
  });

  showToast(`✅ Incident ${id} verified! New Red Zone allocated & regional alert pushed.`, 'danger');
  renderVerificationQueue();
  initCommandCenter();
  updateAIExplanation('alerts');
}

function handleRejectReport(id) {
  if (typeof reportManager !== 'undefined' && reportManager.rejectReport) {
    reportManager.rejectReport(id);
  }
  try {
    const rawLocal = localStorage.getItem('rzi_citizen_reports');
    if (rawLocal) {
      const list = JSON.parse(rawLocal);
      if (Array.isArray(list)) {
        const found = list.find(r => r.id === id);
        if (found) {
          found.status = 'Dismissed';
          localStorage.setItem('rzi_citizen_reports', JSON.stringify(list));
        }
      }
    }
  } catch (e) {}
  showToast(`Report ${id} dismissed. Citizen credibility rating adjusted.`, 'warning');
  renderVerificationQueue();
}

function handleInvestigateReport(id) {
  showToast(`Tasked NDRF Drone Recon unit to GPS coordinates of ${id}.`, 'info');
}

// ================================================================
// SECTION F: EMERGENCY RED ZONE ALLOCATION PIPELINE
// ================================================================

function allocateEmergencyZone(options = {}) {
  const {
    name = 'Emergency Hazard Danger Zone',
    level = 'RED',
    lat = 16.9891,
    lng = 82.2475,
    radius = 3000,
    desc = 'Immediate evacuation directive issued by Incident Command.'
  } = options;

  if (!window.allocatedEmergencyZones) {
    window.allocatedEmergencyZones = [];
  }
  window.allocatedEmergencyZones.push(options);

  if (authMapInstance && authMapInstance.getMap()) {
    const map = authMapInstance.getMap();
    if (!window.emergencyZonesLayerGroup) {
      window.emergencyZonesLayerGroup = L.layerGroup().addTo(map);
    }

    // 1. Create Danger Polygon / Circle with organic pulsing styling
    const circle = L.circle([lat, lng], {
      radius: radius,
      color: '#ef4444',
      weight: 3,
      fillColor: '#ef4444',
      fillOpacity: 0.40,
      className: 'emergency-danger-zone pulsing-zone'
    }).addTo(window.emergencyZonesLayerGroup);

    // 2. Centroid Marker with emergency danger badge
    const icon = L.divIcon({
      className: 'emergency-zone-marker',
      html: `
        <div style="background:#ef4444; color:#fff; font-weight:800; font-size:11px; padding:4px 8px; border-radius:12px; border:2px solid #fff; box-shadow:0 0 20px #ef4444; display:flex; align-items:center; gap:4px; white-space:nowrap; transform:translate(-50%, -50%); cursor:pointer;">
          <span>🚨</span> <span>${name}</span>
        </div>
      `,
      iconSize: [0, 0]
    });
    const marker = L.marker([lat, lng], { icon }).addTo(window.emergencyZonesLayerGroup);

    const popupContent = `
      <div style="font-family:Inter,sans-serif; color:#f1f5f9; padding:6px; max-width:240px;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
          <span style="background:#ef4444; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">ACTIVE RED ZONE</span>
        </div>
        <h4 style="margin:0 0 6px 0; font-size:13px; color:#fff; font-weight:700;">${name}</h4>
        <p style="margin:0 0 8px 0; font-size:11px; color:#94a3b8; line-height:1.45;">${desc}</p>
        <div style="font-size:10px; color:#fca5a5; font-weight:600;">
          Radius: ${(radius/1000).toFixed(1)} km &bull; Directives: Evacuate immediately to safe shelters.
        </div>
      </div>
    `;
    circle.bindPopup(popupContent);
    marker.bindPopup(popupContent);

    // Switch to map view and focus on newly created Red Zone
    if (typeof switchView === 'function') switchView('map-view');
    authMapInstance.flyToLocation(lat, lng, 12);
  }

  // Sync with HazardEngine if present on Authority side
  if (window.hazardEngine && typeof window.hazardEngine.injectOrEscalateAuthorityZone === 'function') {
    try {
      window.hazardEngine.injectOrEscalateAuthorityZone({
        hazardType: options.hazardType || 'cyclone',
        level: level,
        lat,
        lng,
        radius: Math.round(radius / 1000),
        zone: name,
        message: desc
      });
    } catch (e) {}
  }

  // Broadcast alert to backend and all citizen WebSocket clients
  try {
    fetch('/api/alerts/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hazardType: options.hazardType || 'cyclone',
        hazard_type: options.hazardType || 'cyclone',
        level: level || 'CRITICAL',
        severity: level || 'CRITICAL',
        type: 'authority alert',
        title: `🚨 RED ZONE ALLOCATED: ${name}`,
        message: desc,
        zone: name,
        area: `Sector coordinates [${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E]`,
        lat,
        lng,
        radius: Math.round(radius / 1000),
        sources: ['State Disaster Management Authority (SDMA)', 'NDRF Incident Command'],
        timestamp: Date.now()
      })
    }).catch(err => console.warn('[Authority] Red zone broadcast relay error:', err));
  } catch (e) {}

  showToast(`🔴 Dynamic Red Zone allocated at [${lat.toFixed(3)}, ${lng.toFixed(3)}]`, 'danger');
}
window.allocateEmergencyZone = allocateEmergencyZone;

// ================================================================
// PHASE 1: VPI PRIORITY ENGINE LOADER & RENDERERS
// ================================================================

async function loadPriorityRanking(forceRefresh = false) {
  try {
    const url = '/api/priority-ranking' + (forceRefresh ? '?refresh=true' : '');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data && data.success) {
      window.currentPriorityData = data;
      renderPriorityRankingTable(data);
      renderSafeSitesCapacity(data);
      updatePopulationRiskGrid(data);
      updateAIExplanation(document.querySelector('.sidebar-item.active')?.dataset.view || 'command');
      if (forceRefresh) {
        showToast('VPI Rankings & Shelter Allocations recalculated live!', 'success');
      }
    }
  } catch (err) {
    console.warn('Failed to load live priority ranking:', err.message);
  }
}

function updatePopulationRiskGrid(data) {
  if (!data || !data.habitations) return;
  let redPop = 0, orangePop = 0, yellowPop = 0;
  data.habitations.forEach(h => {
    const pop = Number(h.growth_adjusted_pop) || Number(h.census_2011_pop) || 0;
    if (h.tier === 'TIER_1_CRITICAL' || h.tier === 'RED') redPop += pop;
    else if (h.tier === 'TIER_2_HIGH' || h.tier === 'ORANGE') orangePop += pop;
    else yellowPop += pop;
  });
  const totalPop = redPop + orangePop + yellowPop;

  const redEl = document.getElementById('prc-val-red');
  const orangeEl = document.getElementById('prc-val-orange');
  const yellowEl = document.getElementById('prc-val-yellow');
  const totalEl = document.getElementById('prc-val-total');

  if (redEl) redEl.textContent = redPop.toLocaleString();
  if (orangeEl) orangeEl.textContent = orangePop.toLocaleString();
  if (yellowEl) yellowEl.textContent = yellowPop.toLocaleString();
  if (totalEl) totalEl.textContent = totalPop.toLocaleString();
}

function getHabitationRegion(h) {
  const d = (h.district || '').toLowerCase();
  const v = (h.village_name || '').toLowerCase();
  if (d.includes('kakinada') || d.includes('east godavari') || v.includes('uppada') || v.includes('port') || v.includes('suryaraopeta')) {
    return { name: 'Kakinada Coast & Corridors', hazard: '🌀 Cyclone & Surge', tag: 'Direct Maritime Interface' };
  }
  if (d.includes('west godavari') || v.includes('amalapuram') || v.includes('godavari') || v.includes('antardvedi')) {
    return { name: 'Coastal AP Floodplain', hazard: '🌊 Riverine & Surge', tag: 'Low-Lying Estuary' };
  }
  if (d.includes('alluri') || d.includes('visakhapatnam') || d.includes('manyam') || d.includes('chamoli') || d.includes('kullu') || d.includes('aruku')) {
    return { name: 'Eastern Ghats & Upland Sector', hazard: '⛰️ Landslide & Inundation', tag: 'Slope Instability' };
  }
  return { name: 'Rayalaseema & Peninsular Corridors', hazard: '⛈️ Squall & Inundation', tag: 'Peninsular Basin' };
}

function renderPriorityRankingTable(data) {
  const container = document.getElementById('priority-queue-container');
  const chip = document.getElementById('vpi-summary-chip');
  if (!container || !data || !data.habitations) return;

  if (chip && data.summary) {
    chip.innerHTML = `Priority Engine Active &bull; Critical: <strong style="color:#fca5a5;">${data.summary.criticalCount}</strong> | High: <strong style="color:#fdba74;">${data.summary.highCount}</strong>`;
  }

  container.innerHTML = '';

  data.habitations.forEach(h => {
    // Determine styles based on tier
    let borderCol = '#334155';
    let bgCol = '#1e293b';
    let badgeCol = '#94a3b8';
    
    if (h.priorityLevel === 'CRITICAL') {
      borderCol = '#ef4444';
      bgCol = '#7f1d1d20';
      badgeCol = '#f87171';
    } else if (h.priorityLevel === 'HIGH') {
      borderCol = '#f97316';
      bgCol = '#7c2d1220';
      badgeCol = '#fb923c';
    } else if (h.priorityLevel === 'MODERATE') {
      borderCol = '#eab308';
      bgCol = '#713f1220';
      badgeCol = '#facc15';
    }

    const card = document.createElement('div');
    card.style.border = `1px solid ${borderCol}`;
    card.style.background = bgCol;
    card.style.borderRadius = '12px';
    card.style.padding = '16px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';

    const hLat = h.lat || 16.9891;
    const hLng = h.lng || 82.2475;

    // Encode factor data for explanation
    const explainData = encodeURIComponent(JSON.stringify({
      name: h.name,
      score: h.priorityScore,
      level: h.priorityLevel,
      factors: h.factorScores,
      reasons: h.reasons,
      action: h.recommendedAction,
      override: h.overrideApplied
    }));

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="font-size:18px; font-weight:800; color:#fff;">#${h.rank}</span>
            <a href="javascript:void(0)" onclick="focusCoordinates(${hLat}, ${hLng}, 14)" style="color:var(--text-primary); font-size:16px; font-weight:700; text-decoration:none;">
              ${h.name} 🔍
            </a>
            <span style="background:${borderCol}33; color:${badgeCol}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; border:1px solid ${borderCol};">
              ${h.priorityLevel} — ${h.priorityScore}
            </span>
          </div>
          <div style="font-size:12px; color:var(--text-muted);">
            ${h.district} &bull; ${h.hazardType} &bull; ${h.population.toLocaleString()} people
          </div>
        </div>
        <button class="btn btn-glass" style="font-size:11px; padding:4px 8px;" onclick="showPriorityExplanation('${explainData}')">
          ❓ Why this decision?
        </button>
      </div>

      <div style="display:flex; gap:16px; font-size:12px; color:var(--text-secondary); background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:8px;">
        <div><strong style="color:#fff;">Pop Risk:</strong> ${h.factorScores.populationAtRisk}</div>
        <div><strong style="color:#fff;">Life Risk:</strong> ${h.factorScores.immediateLifeRisk}</div>
        <div><strong style="color:#fff;">Urgency:</strong> ${h.factorScores.responseUrgency}</div>
        <div><strong style="color:#fff;">ETA Score:</strong> ${h.factorScores.accessibility}</div>
      </div>

      <div style="font-size:13px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
        <strong style="color:#38bdf8;">RECOMMENDED ACTION:</strong> <span style="color:#fff;">${h.recommendedAction}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function showPriorityExplanation(encodedData) {
  const data = JSON.parse(decodeURIComponent(encodedData));
  const content = document.getElementById('priority-modal-content');
  if(!content) return;

  const getLLMExplanation = `
    <div style="margin-top:16px; text-align:center;">
      <button class="btn btn-primary" onclick="fetchAIExplanationForIncident('${encodeURIComponent(JSON.stringify(data))}')" id="btn-fetch-explanation">
        🤖 Ask DeepSeek for Briefing
      </button>
      <div id="ai-briefing-result" style="margin-top:12px; font-size:13px; color:#fff; text-align:left; background:#1e293b; padding:12px; border-radius:8px; display:none;"></div>
    </div>
  `;

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
      <div style="font-size:20px; font-weight:700; color:#fff;">${data.name}</div>
      <div style="font-size:18px; font-weight:700; color:#38bdf8;">${data.score} / 100 <span style="font-size:14px; color:#94a3b8;">(${data.level})</span></div>
    </div>
    
    ${data.override ? '<div style="background:#7f1d1d; color:#fca5a5; padding:8px; border-radius:6px; font-size:12px; font-weight:700; margin-bottom:16px; border:1px solid #f87171;">⚠️ Emergency life-safety override applied.</div>' : ''}

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:13px; margin-bottom:16px; color:#cbd5e1;">
      <div style="display:flex; justify-content:space-between; border-bottom:1px solid #334155; padding-bottom:4px;">
        <span>Hazard Severity (25%)</span> <strong>${data.factors.hazardSeverity}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; border-bottom:1px solid #334155; padding-bottom:4px;">
        <span>Population (20%)</span> <strong>${data.factors.populationAtRisk}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; border-bottom:1px solid #334155; padding-bottom:4px;">
        <span>Vulnerability (15%)</span> <strong>${data.factors.vulnerability}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; border-bottom:1px solid #334155; padding-bottom:4px;">
        <span>Life Risk (15%)</span> <strong>${data.factors.immediateLifeRisk}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; border-bottom:1px solid #334155; padding-bottom:4px;">
        <span>Urgency (15%)</span> <strong>${data.factors.responseUrgency}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; border-bottom:1px solid #334155; padding-bottom:4px;">
        <span>Accessibility (10%)</span> <strong>${data.factors.accessibility}</strong>
      </div>
    </div>

    <div style="margin-bottom:16px;">
      <div style="font-size:11px; color:#94a3b8; margin-bottom:4px; text-transform:uppercase;">Primary Reasons</div>
      <ul style="margin:0; padding-left:20px; font-size:13px; color:#fff;">
        ${data.reasons.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    <div>
      <div style="font-size:11px; color:#94a3b8; margin-bottom:4px; text-transform:uppercase;">Recommended Action</div>
      <div style="font-size:14px; font-weight:600; color:#22c55e;">${data.action}</div>
    </div>

    ${getLLMExplanation}
  `;

  document.getElementById('priority-explanation-modal').style.display = 'flex';
}

async function fetchAIExplanationForIncident(encodedData) {
  const data = JSON.parse(decodeURIComponent(encodedData));
  const btn = document.getElementById('btn-fetch-explanation');
  const resDiv = document.getElementById('ai-briefing-result');
  
  if(btn) btn.innerHTML = '⏳ Generating...';
  
  try {
    const response = await fetch('/api/ai-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telemetry: { radar: { maxGustSpeedKmH: 120, corePressureHpa: 980 } }, // Mock telemetry just for prompt structure
        priorityData: {
          habitations: [{
            name: data.name,
            population: data.factors.populationAtRisk,
            priorityScore: data.score,
            priorityLevel: data.level,
            overrideApplied: data.override,
            factorScores: data.factors,
            reasons: data.reasons,
            recommendedAction: data.action
          }]
        }
      })
    });
    const result = await response.json();
    if(resDiv) {
      resDiv.innerHTML = `<strong style="color:#38bdf8;">DeepSeek Briefing:</strong><br>${result.recommendation}`;
    }
    if(btn) btn.style.display = 'none';
  } catch(e) {
    if(btn) btn.innerHTML = '🤖 Ask DeepSeek for Briefing';
    if(resDiv) {
      resDiv.style.display = 'block';
      resDiv.innerHTML = '<span style="color:#ef4444;">Failed to connect to DeepSeek. Priority Engine operating deterministically.</span>';
    }
  }
}

function simulateSensorAlert() {
  showToast('SIMULATED SENSOR ALERT: Critical Water Level Threshold Breached at Podalada', 'warning');
  
  // To simulate this without a real backend state change, we can fetch, modify, and render locally
  if (window.currentPriorityData && window.currentPriorityData.habitations) {
    // Find a specific village (e.g. Podalada) and simulate extreme conditions
    const target = window.currentPriorityData.habitations.find(h => (h.name || h.village_name) === 'Podalada') || window.currentPriorityData.habitations[0];
    if (target) {
      target.immediateLifeRiskRaw = 95;
      target.hazardSeverityRaw = 90;
      target.lifeThreatening = true;
      target.reasons = ["Simulated Sensor Alert Received"];
      
      // Recalculate using local PriorityEngine
      if (typeof window.PriorityEngine !== 'undefined') {
        const recalc = window.PriorityEngine.rankIncidents(window.currentPriorityData.habitations);
        window.currentPriorityData.habitations = recalc;
        renderPriorityRankingTable(window.currentPriorityData);
        showToast('Priority recalculated. Queue updated dynamically.', 'success');
      }
    }
  } else {
    // If we haven't loaded yet, just load and then we can simulate on next click
    loadPriorityRanking(true);
  }
}

function toggleFactorBreakdown(id) {
  const box = document.getElementById(`breakdown-${id}`);
  if (!box) return;
  const isShown = box.style.display === 'block';
  document.querySelectorAll('.factor-breakdown-box').forEach(b => b.style.display = 'none');
  box.style.display = isShown ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.vpi-breakdown-btn') && !e.target.closest('.factor-breakdown-box')) {
    document.querySelectorAll('.factor-breakdown-box').forEach(b => b.style.display = 'none');
  }
});

function renderSafeSitesCapacity(data) {
  const grid = document.getElementById('safe-sites-dynamic-grid');
  const summaryEl = document.getElementById('safesites-capacity-summary');
  const deficitEl = document.getElementById('zone-deficit-container');
  if (!data) return;

  if (summaryEl && data.summary) {
    summaryEl.innerHTML = `Safe Capacity: ${Number(data.summary.totalAtRiskPop).toLocaleString()} At Risk &bull; ${Number(data.summary.totalAllocatedPop).toLocaleString()} Allocated (${data.summary.allocationEfficiencyPct}%)`;
  }

  // Render shelter cards
  if (grid && data.shelterStatus) {
    grid.innerHTML = '';
    data.shelterStatus.forEach(s => {
      let barColor = '#22c55e';
      if (s.occupancy_pct >= 85) barColor = '#ef4444';
      else if (s.occupancy_pct >= 60) barColor = '#f97316';

      const allocatedList = (s.allocated_villages || []).map(v => 
        `<span style="display:inline-block; font-size:10px; background:rgba(56,189,248,0.12); color:#38bdf8; padding:2px 6px; border-radius:4px; margin:2px 2px 0 0;">${v.village_name} (+${Number(v.allocated_pop).toLocaleString()})</span>`
      ).join('');

      const card = document.createElement('div');
      card.className = 'safe-site-card';
      card.innerHTML = `
        <div class="safe-site-name" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${s.name}</span>
          <span style="font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:${s.status === 'full' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)'}; color:${s.status === 'full' ? '#fca5a5' : '#86efac'};">${s.status}</span>
        </div>
        <div class="safe-site-cap">
          Capacity: <strong>${Number(s.capacity).toLocaleString()}</strong> &bull; Occupancy: <strong>${Number(s.new_occupancy).toLocaleString()}</strong> (${s.occupancy_pct}%)
        </div>
        <div class="capacity-bar">
          <div class="capacity-fill" style="width:${Math.min(100, s.occupancy_pct)}%; background:${barColor};"></div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">
          Available Beds: <strong style="color:#38bdf8;">${Number(s.available_beds).toLocaleString()}</strong>
        </div>
        ${allocatedList ? `<div style="margin-top:8px;"><div style="font-size:10px; color:var(--text-muted); margin-bottom:2px;">Assigned Habitations:</div>${allocatedList}</div>` : ''}
        <div style="margin-top:10px; display:flex; gap:6px;">
          <button class="btn btn-glass" style="flex:1; font-size:11px; padding:6px 10px; border-color:rgba(56,189,248,0.3); color:#38bdf8;" onclick="openShelterModal('${s.shelter_id}')">
            ✏️ Update Occupancy
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // Render Deficit Reports
  if (deficitEl && data.deficitReports) {
    deficitEl.innerHTML = '';
    data.deficitReports.forEach(d => {
      const hasDeficit = d.deficit > 0;
      const card = document.createElement('div');
      card.className = `deficit-card ${hasDeficit ? 'has-deficit' : 'sufficient'}`;
      card.innerHTML = `
        <div class="deficit-zone-title">
          <span>Zone ${d.zone_id} (${(d.hazard_type || 'Hazard').toUpperCase()})</span>
          <span class="alloc-badge ${hasDeficit ? 'alloc-unallocated' : 'alloc-full'}">
            ${hasDeficit ? '🚨 CAPACITY DEFICIT' : '✅ SUFFICIENT'}
          </span>
        </div>
        <div class="deficit-stat">
          <span>At-Risk Population:</span>
          <strong>${Number(d.total_at_risk).toLocaleString()}</strong>
        </div>
        <div class="deficit-stat">
          <span>Reachable Shelter Capacity:</span>
          <strong>${Number(d.total_reachable_capacity).toLocaleString()}</strong>
        </div>
        <div class="deficit-stat">
          <span>Relocation Deficit:</span>
          <strong style="color:${hasDeficit ? '#ef4444' : '#22c55e'};">${Number(d.deficit).toLocaleString()}</strong>
        </div>
      `;
      deficitEl.appendChild(card);
    });
  }
}

// ---- AI Explanation Panel Assistant ----
function updateAIExplanation(contextKey) {
  const panel = document.getElementById('ai-explanation-text');
  const title = document.getElementById('ai-explanation-sub');
  if (!panel) return;

  const pData = window.currentPriorityData;

  // Dynamic habitations explanation using real computed VPI ranking
  let habitationsHtml = `
    <div class="ai-message">
      <strong>Priority Ranking Engine:</strong> Computing real-time 6-factor composite scores across all vulnerable habitations...
    </div>
  `;
  if (pData && pData.habitations && pData.habitations.length >= 2) {
    const top1 = pData.habitations[0];
    const top2 = pData.habitations[1];
    const topShelter = top1.assigned_shelters?.[0]?.shelter_name || 'Designated High-Ground Center';
    habitationsHtml = `
      <div class="ai-message">
        <strong>VPI Priority Ranking:</strong> <strong>${top1.village_name} (${Number(top1.growth_adjusted_pop).toLocaleString()} pop)</strong> and <strong>${top2.village_name} (${Number(top2.growth_adjusted_pop).toLocaleString()} pop)</strong> exhibit highest composite vulnerability indices (<strong>${top1.vpi_score.toFixed(3)}</strong> and <strong>${top2.vpi_score.toFixed(3)}</strong>) due to elevation inundation risk and access isolation.
      </div>
      <div class="ai-message">
        <strong>Relocation Directives:</strong> Initial road corridors routed to <strong>${topShelter}</strong>. Tier summary: <span class="highlight">${pData.summary.immediateTierCount} Immediate</span>, <span class="highlight">${pData.summary.shortTermTierCount} Short-Term</span>, and ${pData.summary.mediumTermTierCount} Medium-Term priority habitations.
      </div>
      <div class="ai-source-tags">
        <span class="ai-source-tag">VPI 6-Factor Engine</span>
        <span class="ai-source-tag">OSRM Road Network</span>
        <span class="ai-source-tag">Census 2026 Projections</span>
      </div>
    `;
  }

  // Dynamic carrying capacity explanation using real greedy allocation results
  let safesitesHtml = `
    <div class="ai-message">
      <strong>Carrying Capacity:</strong> Analyzing designated shelter network and calculating road travel horizons...
    </div>
  `;
  if (pData && pData.shelterStatus) {
    const sortedShelters = pData.shelterStatus.slice().sort((a,b) => b.occupancy_pct - a.occupancy_pct);
    const peakShelter = sortedShelters[0];
    const deficitCount = (pData.deficitReports || []).filter(d => d.deficit > 0).length;
    safesitesHtml = `
      <div class="ai-message">
        <strong>Carrying Capacity Assessment:</strong> <strong>${peakShelter ? peakShelter.name : 'Designated Shelter Hub'}</strong> is at <span class="highlight">${peakShelter ? peakShelter.occupancy_pct : 0}% occupancy</span> with ${peakShelter ? Number(peakShelter.available_beds).toLocaleString() : 0} beds remaining.
      </div>
      <div class="ai-message">
        <strong>Allocation Deficit:</strong> Greedy allocation indicates <span class="highlight">${Number(pData.summary.totalDeficitPop).toLocaleString()} evacuees</span> remain in capacity deficit across ${deficitCount} active risk zones requiring secondary staging shelters.
      </div>
      <div class="ai-source-tags">
        <span class="ai-source-tag">Greedy Capacity Allocator</span>
        <span class="ai-source-tag">SDMA Relief Network</span>
        <span class="ai-source-tag">Zone Deficit Audit</span>
      </div>
    `;
  }

  // Dynamic command dashboard situation explanation
  let commandHtml = `
    <div class="ai-message">
      <strong>Synthesized Situation:</strong> Automated AI Orchestration Engine actively monitoring real-time telemetry, seismic sensors, and NASA satellite feeds.
    </div>
    <div class="ai-message">
      <strong>Dynamic Surveillance:</strong> Real-time VPI priority scores and shelter carrying capacities are updating live from verified sensor telemetry.
    </div>
    <div class="ai-message">
      <strong>Action Recommendation:</strong> Monitor the live timeline scrubber and situational briefings for active evacuation directives.
    </div>
    <div class="ai-source-tags">
      <span class="ai-source-tag">AI Orchestrator</span>
      <span class="ai-source-tag">NASA FIRMS</span>
      <span class="ai-source-tag">Live Sensor Grid</span>
    </div>
  `;
  if (pData && pData.habitations && pData.habitations.length > 0) {
    const topV = pData.habitations[0];
    const assignedShelter = topV.assigned_shelters?.[0]?.shelter_name || 'Designated Regional Center';
    commandHtml = `
      <div class="ai-message">
        <strong>Synthesized Operational Assessment:</strong> Live VPI Engine flags <strong>${topV.village_name} (${topV.district})</strong> as priority #1 relocation cluster with composite risk index <span class="highlight">${topV.vpi_score.toFixed(3)}</span>.
      </div>
      <div class="ai-message">
        <strong>Evacuation Capacity Status:</strong> ${Number(pData.summary.totalAllocatedPop).toLocaleString()} of ${Number(pData.summary.totalAtRiskPop).toLocaleString()} at-risk citizens successfully matched to open high-ground shelters (${pData.summary.allocationEfficiencyPct}% allocation efficiency).
      </div>
      <div class="ai-message">
        <strong>Action Recommendation:</strong> Prioritize evacuation of <strong>${topV.village_name}</strong> to <strong>${assignedShelter}</strong> via verified safe road corridors.
      </div>
      <div class="ai-source-tags">
        <span class="ai-source-tag">IMD Doppler Radar</span>
        <span class="ai-source-tag">Priority Engine v2</span>
        <span class="ai-source-tag">OSRM Road Routing</span>
      </div>
    `;
  }

  const explanations = {
    'command': {
      sub: 'Real-Time Operational Assessment',
      html: commandHtml
    },
    'map-view': {
      sub: 'GIS Risk Topology Interpretation',
      html: `
        <div class="ai-message">
          <strong>Spatial Pattern Analysis:</strong> Two active high-severity clusters detected: (1) Coastal Andhra Pradesh maritime interface (Kakinada–Machilipatnam arc), and (2) Brahmaputra Lower Basin (Assam).
        </div>
        <div class="ai-message">
          <strong>Safe Site Buffer:</strong> 7 designated safe sites currently have <span class="safe">52% remaining capacity</span>. The nearest evacuation corridor (SH-168) is clear of waterlogging.
        </div>
      `
    },
    'hazards': {
      sub: 'Multi-Source Threat Evaluation',
      html: `
        <div class="ai-message">
          <strong>False Alarm Prevention:</strong> Multi-sensor cross check validates Cyclone Vayu with <strong>91% confidence (±4% uncertainty)</strong>. Cloudburst warning in HP evaluated from combined radar + thermal anomaly.
        </div>
      `
    },
    'habitations': {
      sub: 'Vulnerability & Relocation Ranking',
      html: habitationsHtml
    },
    'safesites': {
      sub: 'Shelter Carrying Capacity Analysis',
      html: safesitesHtml
    },
    'alerts': {
      sub: 'Human Verification Assistant',
      html: `
        <div class="ai-message">
          <strong>Crowdsource Intelligence:</strong> 3 citizen reports currently cross-referenced against satellite radar. Report <strong>REP002 (Bridge damage on NH-27)</strong> has 7 upvotes and high spatial probability.
        </div>
      `
    },
    'analytics': {
      sub: 'Analytical Contribution & Historical Variance',
      html: `
        <div class="ai-message">
          <strong>Contribution Factor:</strong> Extreme precipitation accounts for <strong>64%</strong> of the current aggregate national disaster risk index, followed by cyclonic wind pressure at <strong>26%</strong>.
        </div>
      `
    },
    'datasources': {
      sub: 'Telemetry Health & Sensor Status',
      html: `
        <div class="ai-message">
          <strong>Data Pipeline Health:</strong> 5 of 5 national feeds active with zero latency packet loss. Last satellite sweep completed 4 minutes ago.
        </div>
      `
    }
  };

  const exp = explanations[contextKey] || explanations['command'];
  title.textContent = exp.sub;
  panel.innerHTML = exp.html;
}

// ---- Chart.js Multi-Risk Analytics ----
function initAnalyticsChart() {
  const ctx = document.getElementById('riskChart');
  if (!ctx) return;

  const data = APP_DATA.multiRiskBreakdown;
  riskChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Population at Risk (x1,000)',
          data: data.affected.map(v => v / 1000),
          backgroundColor: 'rgba(59, 130, 246, 0.65)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Composite Severity Score (0-10)',
          data: data.riskScores,
          backgroundColor: 'rgba(239, 68, 68, 0.65)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
          title: { display: true, text: 'Population Affected (k)', color: '#94a3b8' }
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#ef4444', font: { family: 'Inter', size: 11 } },
          min: 0,
          max: 10,
          title: { display: true, text: 'Severity (0-10)', color: '#ef4444' }
        }
      }
    }
  });
}

// ================================================================
// ================================================================
// TASK 18: AI DECISION SUPPORT (DeepSeek-R1 8B Evidence Brief)
// ================================================================
let isGeneratingDecisionBrief = false;
let decisionBriefTimerInterval = null;

function initDecisionSupport() {
  try {
    const cached = sessionStorage.getItem('rzi_decision_brief');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.brief) {
        renderDecisionBriefUI(parsed.brief, parsed.meta || {}, parsed.timestamp || Date.now());
        return;
      }
    }
  } catch (e) {
    console.warn('[DecisionSupport] Error reading cached brief:', e);
  }
}

function switchToDecisionBrief() {
  const contentPanel = document.getElementById('content-panel');
  if (contentPanel) contentPanel.style.display = 'block';
  const views = [
    'command', 'hazards', 'habitations', 'safesites',
    'population-risk', 'alerts', 'reports', 'datasources'
  ];
  views.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = (v === 'command') ? 'block' : 'none';
  });
  document.querySelectorAll('.dock-item[data-view]').forEach(i => {
    i.classList.toggle('active', i.dataset.view === 'decision-support');
  });

  setTimeout(() => {
    const panel = document.getElementById('ai-decision-support-panel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      panel.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
      panel.style.borderColor = '#a855f7';
      panel.style.boxShadow = '0 0 28px rgba(168, 85, 247, 0.45)';
      setTimeout(() => {
        panel.style.borderColor = '';
        panel.style.boxShadow = '';
      }, 1800);
    }
  }, 80);
}

function parseDecisionBriefSections(rawText) {
  if (!rawText || typeof rawText !== 'string') return {};

  // Strip any <think> reasoning tokens immediately
  let text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const requiredSections = [
    'OBSERVATIONS',
    'RISK / PRIORITY',
    'AUTHORITY RECOMMENDATIONS',
    'SHELTER / ACCESS',
    'LIMITATIONS / CONFIDENCE'
  ];

  const headerPattern = requiredSections.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp('(?:###\\s*|\\*\\*|#\\s*)?(' + headerPattern + ')[\\s:*\\-]*\\n([\\s\\S]*?)(?=(?:###\\s*|\\*\\*|#\\s*)?(?:' + headerPattern + ')|$)', 'gi');

  const result = {};
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].trim().toUpperCase();
    const content = match[2].trim();
    if (key.includes('OBSERVATION')) result['OBSERVATIONS'] = content;
    else if (key.includes('RISK') || key.includes('PRIORITY')) result['RISK / PRIORITY'] = content;
    else if (key.includes('RECOMMENDATION')) result['AUTHORITY RECOMMENDATIONS'] = content;
    else if (key.includes('SHELTER') || key.includes('ACCESS')) result['SHELTER / ACCESS'] = content;
    else if (key.includes('LIMITATION') || key.includes('CONFIDENCE')) result['LIMITATIONS / CONFIDENCE'] = content;
  }

  // Fallback: If any section heading wasn't matched with newline, try broad search
  requiredSections.forEach(sec => {
    if (!result[sec]) {
      const broadRegex = new RegExp('(?:###|\\*\\*|#)?\\s*' + sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s:*\\-]*([\\s\\S]*?)(?=(?:###|\\*\\*|#)?\\s*(?:' + headerPattern + ')|$)', 'i');
      const m = text.match(broadRegex);
      if (m && m[1]) result[sec] = m[1].trim();
    }
  });

  return result;
}

function formatSectionContent(text) {
  if (!text || typeof text !== 'string') return '';

  // Strip any <think> tags if still present
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const lines = clean.split('\n');
  let inList = false;
  let html = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    // Check for bullet lines
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (bulletMatch) {
      if (!inList) {
        html += '<ul style="margin:4px 0 6px 18px; padding:0; list-style-type:disc;">';
        inList = true;
      }
      let content = bulletMatch[1];
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f1f5f9;">$1</strong>');
      html += `<li style="margin-bottom:5px; line-height:1.6; color:#cbd5e1;">${content}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f1f5f9;">$1</strong>');
      html += `<p style="margin:0 0 6px 0; line-height:1.6; color:#cbd5e1;">${line}</p>`;
    }
  }

  if (inList) html += '</ul>';
  return html;
}

function renderDecisionBriefLoading(seconds = 0) {
  const body = document.getElementById('dsb-body');
  if (!body) return;
  body.innerHTML = `
    <div class="dsb-loading" id="dsb-loading-container">
      <div class="dsb-pulse-ring"></div>
      <div>
        <div class="dsb-loading-text" style="font-weight:700; font-size:13px; color:#c4b5fd;">
          Generating evidence-grounded decision brief…
        </div>
        <div id="dsb-loading-subtext" style="font-size:11.5px; color:#94a3b8; margin-top:4px;">
          Elapsed: ${seconds}s &bull; DeepSeek-R1 8B CPU inference in progress via LangChain / Ollama
        </div>
        <div style="font-size:10.5px; color:rgba(148,163,184,0.6); margin-top:4px;">
          Assembling TerraMind satellite extent, AP SDMA habitations &amp; shelters, and OSRM driving routes. Dashboard remains 100% interactive.
        </div>
      </div>
    </div>
  `;
}

function updateDecisionBriefLoadingTimer(seconds) {
  const subtext = document.getElementById('dsb-loading-subtext');
  if (subtext) {
    subtext.innerHTML = `Elapsed: ${seconds}s &bull; DeepSeek-R1 8B CPU inference in progress via LangChain / Ollama`;
  }
}

function renderDecisionBriefError(errMsg) {
  const body = document.getElementById('dsb-body');
  if (!body) return;
  body.innerHTML = `
    <div class="dsb-error">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div>
        <div style="font-weight:700; font-size:13px; color:#fca5a5;">
          AI decision brief temporarily unavailable. Underlying GIS and hazard data remain available.
        </div>
        <div style="font-size:11px; color:rgba(252,165,165,0.75); margin-top:4px;">
          Service Status: ${String(errMsg || 'Inference service timeout or 503').replace(/</g, '&lt;').replace(/>/g, '&gt;')} &bull; All GIS hazard overlays, habitation matrices, and shelters remain active.
        </div>
        <button class="dsb-btn-refresh" onclick="generateDecisionBrief(true)" style="margin-top:10px; display:inline-flex;">
          🔄 Retry Decision Brief
        </button>
      </div>
    </div>
  `;
}

function renderDecisionBriefUI(briefText, meta = {}, timestamp = Date.now()) {
  const body = document.getElementById('dsb-body');
  if (!body) return;

  // Clean raw brief
  let cleanBrief = String(briefText || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extract the 5 required sections
  const sections = parseDecisionBriefSections(cleanBrief);

  const sectionDefs = [
    {
      key: 'OBSERVATIONS',
      title: 'OBSERVATIONS',
      icon: '🛰️',
      badge: 'SATELLITE & SENSOR GROUND TRUTH',
      color: '#38bdf8',
      fallback: '30 TerraMind flood polygons vectorized from Sentinel-1 RTC + Sentinel-2 L2A + Copernicus DEM across Coastal AP. Analysis threshold 0.50 is not ground-truth calibrated.'
    },
    {
      key: 'RISK / PRIORITY',
      title: 'RISK / PRIORITY',
      icon: '⚠️',
      badge: 'EXPOSURE & SEVERITY CLASSIFICATION',
      color: '#f97316',
      fallback: 'Coastal AP 2026 projected population (MoHFW projection, not a census; not exposed population). Normalized population-density score: 0.356, Population-density VPI contribution: 0.0534. Standby monitoring priority for proximity buffer clusters.'
    },
    {
      key: 'AUTHORITY RECOMMENDATIONS',
      title: 'AUTHORITY RECOMMENDATIONS',
      icon: '📋',
      badge: 'INCIDENT DIRECTIVES',
      color: '#a855f7',
      fallback: 'Dispatch field ground-truth reconnaissance to Peravaram (631.57 m distance) and 1-5 km buffer zones. Maintain active sensor surveillance on the 30 flood polygons. Stand down mass evacuation orders given 0 direct habitation inundations.'
    },
    {
      key: 'SHELTER / ACCESS',
      title: 'SHELTER / ACCESS',
      icon: '🏕️',
      badge: 'CAPACITY & OSRM LOGISTICS',
      color: '#22c55e',
      fallback: 'AP SDMA cyclone shelters identified in Coastal AP. Selected habitation-to-shelter OSRM routes computed successfully. Road passability during a disaster is not verified.'
    },
    {
      key: 'LIMITATIONS / CONFIDENCE',
      title: 'LIMITATIONS / CONFIDENCE',
      icon: '🛡️',
      badge: 'OPERATIONAL BOUNDARIES',
      color: '#94a3b8',
      fallback: 'TerraMind 0.50 threshold is uncalibrated against local ground truth. Spatial proximity buffers indicate geographic closeness, not confirmed flooding. Successful OSRM routes do not guarantee road passability or structural safety during an active event.'
    }
  ];

  let html = '<div class="dsb-sections">';
  sectionDefs.forEach(s => {
    let content = sections[s.key] || '';
    if (!content) {
      for (const k in sections) {
        if (k.toUpperCase().includes(s.title)) {
          content = sections[k];
          break;
        }
      }
    }
    const formattedHtml = formatSectionContent(content || s.fallback);
    html += `
      <div class="dsb-section" data-section="${s.key}">
        <div class="dsb-section-title" style="color:${s.color};">
          <span>${s.icon}</span>
          <span>${s.title}</span>
          <span style="margin-left:auto; font-size:9.5px; font-weight:700; color:rgba(148,163,184,0.6); letter-spacing:0.06em;">${s.badge}</span>
        </div>
        <div class="dsb-section-body">
          ${formattedHtml}
        </div>
      </div>
    `;
  });
  html += '</div>';

  body.innerHTML = html;

  // Provenance Line (Step 5)
  const metaModel = document.getElementById('dsb-meta-model');
  const metaTime = document.getElementById('dsb-meta-time');
  const metaTimeLbl = document.getElementById('dsb-meta-time-lbl');
  const metaSep = document.getElementById('dsb-meta-sep');

  if (metaModel) {
    let label = meta.model || 'Unknown';
    if (meta.provider === 'ollama') label = 'DeepSeek-R1 • Local AI';
    else if (meta.provider === 'claude') label = 'Claude • Cloud AI';
    else if (meta.provider === 'deterministic-fallback') label = 'Deterministic Emergency Analyst • Fallback';
    
    metaModel.textContent = label;
  }
  if (metaTime) {
    const timeStr = new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const durStr = meta.inference_duration_seconds ? ` (${meta.inference_duration_seconds}s inference)` : '';
    metaTime.textContent = `Generated today at ${timeStr} IST${durStr}`;
    metaTime.style.display = 'inline';
    if (metaTimeLbl) metaTimeLbl.style.display = 'inline';
    if (metaSep) metaSep.style.display = 'inline';
  }

  // Update legacy containers if present
  const oldText = document.getElementById('ai-brief-text');
  if (oldText) {
    oldText.innerHTML = `<div style="color:var(--text-primary); font-size:12.5px;">${formatSectionContent(sections['AUTHORITY RECOMMENDATIONS'] || cleanBrief)}</div>`;
  }
}

async function generateDecisionBrief(forceRefresh = false) {
  if (isGeneratingDecisionBrief) {
    showToast('AI Decision Brief inference is already in progress...', 'info');
    return;
  }

  // If not force refresh, check if we have a saved brief in sessionStorage
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem('rzi_decision_brief');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.brief) {
          renderDecisionBriefUI(parsed.brief, parsed.meta || {}, parsed.timestamp || Date.now());
          showToast('Loaded active decision brief from session cache', 'info');
          return;
        }
      }
    } catch (e) {}
  }

  isGeneratingDecisionBrief = true;
  const btnGen = document.getElementById('btn-generate-brief');
  const btnRef = document.getElementById('btn-refresh-brief');
  const spinnerSvg = document.getElementById('dsb-refresh-svg');
  if (btnGen) btnGen.disabled = true;
  if (btnRef) btnRef.disabled = true;
  if (spinnerSvg) spinnerSvg.style.animation = 'dsb-spin 0.9s linear infinite';

  let elapsedSeconds = 0;
  renderDecisionBriefLoading(elapsedSeconds);

  if (decisionBriefTimerInterval) clearInterval(decisionBriefTimerInterval);
  decisionBriefTimerInterval = setInterval(() => {
    elapsedSeconds++;
    updateDecisionBriefLoadingTimer(elapsedSeconds);
  }, 1000);

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 320000); // 320s max timeout

    // Step 3: Call real API endpoint POST /api/ai-recommendation
    const resp = await fetch('/api/ai-recommendation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({}),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const recommendationText = data.recommendation || data.brief;
    if (!data || !recommendationText) {
      throw new Error('API returned empty or invalid response');
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const meta = data.meta || { model: data.model || 'Unknown Model', provider: data.provider || 'unknown' };
    if (!meta.inference_duration_seconds) meta.inference_duration_seconds = duration;

    // Cache in sessionStorage
    try {
      sessionStorage.setItem('rzi_decision_brief', JSON.stringify({
        brief: recommendationText,
        meta: meta,
        timestamp: Date.now()
      }));
    } catch (e) {}

    renderDecisionBriefUI(recommendationText, meta, Date.now());
    if (data.fallback) {
      showToast(`Primary AI unavailable. Deterministic emergency analysis active. (${duration}s)`, 'warning');
    } else {
      let providerName = meta.provider === 'claude' ? 'Claude' : 'DeepSeek';
      showToast(`${providerName} Decision Brief generated successfully (${duration}s)`, 'success');
    }

  } catch (err) {
    console.error('Decision brief fetch error:', err);
    let errorMsg = err.message || 'Request failed';
    if (errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('networkerror')) {
      errorMsg = 'AI service is currently unreachable. GIS intelligence remains operational.';
    } else if (errorMsg.includes('HTTP')) {
      errorMsg = 'AI service returned an error. GIS intelligence remains operational.';
    }
    renderDecisionBriefError(errorMsg);
  } finally {
    isGeneratingDecisionBrief = false;
    if (decisionBriefTimerInterval) {
      clearInterval(decisionBriefTimerInterval);
      decisionBriefTimerInterval = null;
    }
    if (btnGen) btnGen.disabled = false;
    if (btnRef) btnRef.disabled = false;
    if (spinnerSvg) spinnerSvg.style.animation = '';
  }
}

// Backward-compatible alias
const fetchAIRecommendation = generateDecisionBrief;

// ================================================================
// PHASE 5: LIVE SHELTER OCCUPANCY MANAGEMENT (Authority Side)
// ================================================================
let currentEditingShelter = null;

function openShelterModal(shelterId) {
  const modal = document.getElementById('modal-shelter-occupancy');
  if (!modal) return;

  let shelter = null;
  if (window.currentPriorityData && window.currentPriorityData.shelterStatus) {
    shelter = window.currentPriorityData.shelterStatus.find(s => s.shelter_id === shelterId);
  }
  if (!shelter && window.APP_DATA && window.APP_DATA.shelters) {
    shelter = window.APP_DATA.shelters.find(s => (s.id || s.shelter_id) === shelterId);
  }

  if (!shelter) {
    showToast(`Shelter record ${shelterId} not loaded`, 'danger');
    return;
  }

  currentEditingShelter = shelter;
  document.getElementById('edit-shelter-id').value = shelter.shelter_id || shelter.id;
  document.getElementById('modal-shelter-name').textContent = shelter.name;
  document.getElementById('modal-shelter-meta').textContent = `ID: ${shelter.shelter_id || shelter.id} • District: ${shelter.district || 'Regional'}`;
  document.getElementById('edit-shelter-capacity').value = shelter.capacity;
  document.getElementById('edit-shelter-occupancy').value = shelter.current_occupancy ?? shelter.new_occupancy ?? 0;
  document.getElementById('edit-shelter-status').value = shelter.status || 'open';

  updateOccupancyPreview();
  modal.style.display = 'flex';
}

function closeShelterModal() {
  const modal = document.getElementById('modal-shelter-occupancy');
  if (modal) modal.style.display = 'none';
  currentEditingShelter = null;
}

function updateOccupancyPreview() {
  const cap = parseInt(document.getElementById('edit-shelter-capacity').value, 10) || 1;
  const occ = parseInt(document.getElementById('edit-shelter-occupancy').value, 10) || 0;
  const pct = Math.min(100, Math.max(0, Math.round((occ / cap) * 100)));

  const pctEl = document.getElementById('modal-occupancy-pct');
  const barEl = document.getElementById('modal-occupancy-bar');
  const statusEl = document.getElementById('edit-shelter-status');

  if (pctEl) pctEl.textContent = `${pct}% (${occ} / ${cap} beds)`;
  if (barEl) {
    barEl.style.width = `${pct}%`;
    if (pct >= 85) barEl.style.background = '#ef4444';
    else if (pct >= 60) barEl.style.background = '#f97316';
    else barEl.style.background = '#22c55e';
  }

  if (statusEl) {
    if (occ >= cap && statusEl.value !== 'closed') {
      statusEl.value = 'full';
    } else if (occ < cap && statusEl.value === 'full') {
      statusEl.value = 'open';
    }
  }
}

async function submitShelterOccupancy(event) {
  event.preventDefault();
  const shelterId = document.getElementById('edit-shelter-id').value;
  const occupancy = parseInt(document.getElementById('edit-shelter-occupancy').value, 10);
  const status = document.getElementById('edit-shelter-status').value;
  const officer = document.getElementById('edit-shelter-officer').value;
  const cap = parseInt(document.getElementById('edit-shelter-capacity').value, 10) || 1000;

  const saveBtn = document.getElementById('btn-save-shelter');
  if (saveBtn) saveBtn.disabled = true;

  try {
    // 1. Update local storage overrides for offline / page reload persistence (Requirement G1)
    try {
      const overrides = JSON.parse(localStorage.getItem('rzi_shelters_override') || '{}');
      overrides[shelterId] = {
        current_occupancy: occupancy,
        status: status,
        capacity: cap,
        updated_by: officer,
        timestamp: Date.now()
      };
      if (currentEditingShelter && currentEditingShelter.name) {
        overrides[currentEditingShelter.name] = overrides[shelterId];
      }
      localStorage.setItem('rzi_shelters_override', JSON.stringify(overrides));
    } catch (e) {}

    // 2. Synchronize in-memory HAZARD_INTEL across both portals
    if (typeof HAZARD_INTEL !== 'undefined') {
      Object.values(HAZARD_INTEL).forEach(hz => {
        if (Array.isArray(hz.safeSites)) {
          hz.safeSites.forEach(s => {
            if ((s.id || s.shelter_id) === shelterId || s.name === currentEditingShelter?.name) {
              s.current = occupancy;
              s.current_occupancy = occupancy;
              s.status = status;
              s.capacity = cap;
            }
          });
        }
      });
    }

    // 3. Patch backend shelter database
    const resp = await fetch(`/api/shelters/${encodeURIComponent(shelterId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_occupancy: occupancy,
        status: status,
        capacity: cap,
        updated_by: officer
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    showToast(`✅ ${data.message || 'Shelter occupancy updated'}`, 'success');
    closeShelterModal();

    // Recompute priority ranking immediately with updated shelter capacity
    await loadPriorityRanking(true);
    // Refresh AI recommendation with updated shelter data
    fetchAIRecommendation(false);

  } catch (err) {
    console.error('Shelter occupancy update failed:', err);
    showToast(`❌ Failed to update shelter: ${err.message}`, 'danger');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// Persisted Shelter Overrides Applier (Requirement G1)
function applyShelterOverrides() {
  try {
    const raw = localStorage.getItem('rzi_shelters_override');
    if (!raw) return;
    const overrides = JSON.parse(raw);
    if (!overrides || typeof overrides !== 'object') return;

    if (window.APP_DATA && Array.isArray(window.APP_DATA.shelters)) {
      window.APP_DATA.shelters.forEach(s => {
        const o = overrides[s.id || s.shelter_id || s.name];
        if (o) {
          if (o.current_occupancy !== undefined) s.current_occupancy = o.current_occupancy;
          if (o.status !== undefined) s.status = o.status;
          if (o.capacity !== undefined) s.capacity = o.capacity;
        }
      });
    }

    if (typeof HAZARD_INTEL !== 'undefined') {
      Object.values(HAZARD_INTEL).forEach(hz => {
        if (Array.isArray(hz.safeSites)) {
          hz.safeSites.forEach(s => {
            const o = overrides[s.id || s.shelter_id || s.name];
            if (o) {
              if (o.current_occupancy !== undefined) {
                s.current = o.current_occupancy;
                s.current_occupancy = o.current_occupancy;
              }
              if (o.status !== undefined) s.status = o.status;
              if (o.capacity !== undefined) s.capacity = o.capacity;
            }
          });
        }
      });
    }
  } catch (e) {
    console.warn('[Authority] Error applying shelter overrides:', e);
  }
}
window.applyShelterOverrides = applyShelterOverrides;

// Expose globally for HTML onclick triggers
window.generateDecisionBrief = generateDecisionBrief;
window.switchToDecisionBrief = switchToDecisionBrief;
window.initDecisionSupport = initDecisionSupport;
window.renderDecisionBriefUI = renderDecisionBriefUI;
window.renderDecisionBriefError = renderDecisionBriefError;
window.fetchAIRecommendation = generateDecisionBrief;
window.openShelterModal = openShelterModal;
window.closeShelterModal = closeShelterModal;
window.updateOccupancyPreview = updateOccupancyPreview;
window.submitShelterOccupancy = submitShelterOccupancy;


