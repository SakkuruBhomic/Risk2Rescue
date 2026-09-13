// ================================================================
// MAP.JS — Leaflet Map Setup, Risk Zones, Layers
// ================================================================

// ================================================================
// 4-TIER HAZARD ZONE SEVERITY SYSTEM
// Unified tokens and operational meanings across GIS platform
// ================================================================
const RISK_TIERS = {
  RED: {
    level: 'RED',
    name: 'CRITICAL',
    title: 'Critical Active Zone',
    shortLabel: 'Critical',
    meaning: 'Direct hazard epicenter. Active ongoing threat confirmed by live telemetry.',
    fill: '#ef4444',
    fillOpacity: 0.48,
    stroke: '#dc2626',
    strokeOpacity: 0.95,
    pulsing: true,
    cssClass: 'level-red'
  },
  ORANGE: {
    level: 'ORANGE',
    name: 'HIGH ALERT',
    title: 'High Alert Zone',
    shortLabel: 'High Alert',
    meaning: 'Imminent danger zone. Severe impact corridor under immediate evacuation watch.',
    fill: '#f97316',
    fillOpacity: 0.40,
    stroke: '#ea580c',
    strokeOpacity: 0.88,
    pulsing: false,
    cssClass: 'level-orange'
  },
  YELLOW: {
    level: 'YELLOW',
    name: 'MODERATE',
    title: 'Moderate Risk Zone',
    shortLabel: 'Moderate',
    meaning: 'Elevated risk under monitoring corridor. Precautionary advisory active.',
    fill: '#eab308',
    fillOpacity: 0.35,
    stroke: '#ca8a04',
    strokeOpacity: 0.85,
    pulsing: false,
    cssClass: 'level-yellow'
  },
  GREEN: {
    level: 'GREEN',
    name: 'LOW RISK',
    title: 'Low Risk / Buffer Zone',
    shortLabel: 'Low Risk',
    meaning: 'Verified low-risk perimeter and safe evacuation corridor.',
    fill: '#22c55e',
    fillOpacity: 0.28,
    stroke: '#16a34a',
    strokeOpacity: 0.75,
    pulsing: false,
    cssClass: 'level-green'
  }
};

const RISK_COLORS = RISK_TIERS;

const LAYER_CONFIG = {
  satellite: { name: 'Satellite', icon: '🛰️', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 },
  standard: { name: 'Standard', icon: '🗺️', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
  windy: { name: 'Windy Radar', icon: '🌀', url: 'https://tilecache.rainviewer.com/v2/radar/nowcast/256/{z}/{x}/{y}/2/1_1.png', maxZoom: 12, opacity: 0.75 },
  topo: { name: 'Elevation', icon: '⛰️', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17 }
};

if (typeof fetch !== 'undefined') {
  fetch('/api/windy/config')
    .then(res => res.json())
    .then(cfg => {
      if (cfg && cfg.configured && cfg.key) {
        LAYER_CONFIG.windy.url = `https://tiles.windy.com/tiles/v1.0/radar/{z}/{x}/{y}.png?key=${cfg.key}`;
      }
    })
    .catch(() => { });
}

if (typeof window !== 'undefined') {
  window.RISK_TIERS = RISK_TIERS;
  window.RISK_COLORS = RISK_COLORS;
  window.LAYER_CONFIG = LAYER_CONFIG;
}

// ================================================================
// ORGANIC ZONE POLYGON GENERATOR (Choropleth / Terrain Contour)
// ================================================================
function generateOrganicZonePolygon(lat, lng, radiusMeters, name = '', hazardType = 'cyclone') {
  let seed = 0;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) & 0xffffffff;
  const pseudo = (offset) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const numPoints = 28;
  const coords = [];
  const rLat = radiusMeters / 111320;
  const rLng = rLat / Math.cos((lat * Math.PI) / 180);

  let angleOffset = 0;
  let elongation = 1.35;
  const h = (hazardType || '').toLowerCase();
  if (h.includes('cyclone') || h.includes('tsunami') || h.includes('erosion')) {
    angleOffset = 0.78; // ~45 degrees (Bay of Bengal AP coast alignment)
    elongation = 1.6;
  } else if (h.includes('flood')) {
    angleOffset = 0.35;
    elongation = 1.85;
  } else if (h.includes('landslide')) {
    angleOffset = 1.15;
    elongation = 1.6;
  } else if (h.includes('earthquake')) {
    angleOffset = 0.55;
    elongation = 1.3;
  }

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const harmonic1 = Math.sin(2 * (theta - angleOffset)) * 0.28;
    const harmonic2 = Math.cos(3 * theta + pseudo(i)) * 0.14;
    const harmonic3 = Math.sin(5 * theta) * 0.08;
    const noise = (pseudo(i * 7) - 0.5) * 0.12;

    const stretch = 1 + (elongation - 1) * Math.cos(theta - angleOffset) ** 2;
    const factor = Math.max(0.42, (1 + harmonic1 + harmonic2 + harmonic3 + noise) * stretch);

    const ptLat = lat + rLat * factor * Math.sin(theta);
    const ptLng = lng + rLng * factor * Math.cos(theta);
    coords.push([ptLng, ptLat]);
  }
  coords.push(coords[0]); // Close polygon

  // Clip against land boundary using Turf.js so coastal zones do not extend over sea
  if (typeof window !== 'undefined' && window.LandBoundaryService && window.turf) {
    try {
      const clipped = window.LandBoundaryService.clipPolygonCoords(coords, {
        name,
        hazardType,
        lat,
        lng,
        radiusMeters
      });
      if (clipped && clipped.coordinates) {
        if (clipped.type === 'Polygon' && clipped.coordinates[0]) {
          return clipped.coordinates[0];
        } else if (clipped.type === 'MultiPolygon' && clipped.coordinates.length) {
          let largest = clipped.coordinates[0][0];
          for (let p of clipped.coordinates) {
            if (p[0] && p[0].length > largest.length) largest = p[0];
          }
          return largest;
        }
      }
    } catch (clipErr) {
      console.warn(`[generateOrganicZonePolygon] Clipping error for ${name}, falling back to unclipped polygon:`, clipErr);
    }
  }

  return coords;
}
if (typeof window !== 'undefined') {
  window.generateOrganicZonePolygon = generateOrganicZonePolygon;
}

class DisasterMap {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.map = null;
    this.baseLayers = {};
    this.overlayLayers = {};
    this.activeBaseLayer = 'standard';
    this.riskZoneCircles = [];
    this.markers = { safeSites: [], hospitals: [], habitations: null, hazards: [] };
    this.userMarker = null;
    this.init();
  }

  init() {
    const config = APP_DATA.mapConfig || {};
    const minZ = config.minZoom || 4;
    const maxZ = config.maxZoom || 18;

    // Constrain geographical bounding box around India and neighboring hazard monitoring regions
    const regionalBounds = L.latLngBounds(
      L.latLng(4.0, 65.0),   // Southwest corner (Indian Ocean / Lakshadweep)
      L.latLng(37.5, 98.5)   // Northeast corner (Kashmir / Arunachal Pradesh)
    );

    this.map = L.map(this.containerId, {
      center: config.center || [16.99, 82.25],
      zoom: config.zoom || 7,
      minZoom: minZ,
      maxZoom: maxZ,
      maxBounds: regionalBounds,
      maxBoundsViscosity: 0.75,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false, // Disabled on startup to prevent scroll-locking during initial asset & tile loading
      wheelDebounceTime: 120, // Prevents event floods from trackpads and high-frequency wheels
      wheelPxPerZoomLevel: 120 // Smooth, gradual zoom control instead of sudden jumps
    });

    // Move zoom control to bottom-right
    this.map.zoomControl.setPosition('bottomright');

    this.map.on('zoomend', () => this.updateZoomVisibility());

    // Enable smooth scrollWheelZoom only once map is initialized and ready
    this.map.whenReady(() => {
      setTimeout(() => {
        if (this.map && this.map.scrollWheelZoom) {
          this.map.scrollWheelZoom.enable();
        }

        // AP Boundary Enforcement
        if (window.APBoundaryService) {
          const checkAPReady = setInterval(() => {
            if (window.APBoundaryService.ready) {
              clearInterval(checkAPReady);
              window.APBoundaryService.drawBorder(this.map);
              // Only fit bounds if no specific coordinate was requested (defaults to config center)
              if (!config.center || config.center[0] === 16.99) {
                window.APBoundaryService.fitMap(this.map);
              }
            }
          }, 100);
          setTimeout(() => clearInterval(checkAPReady), 3000);
        }
      }, 350);
    });

    // Setup base layers with idle update optimization (avoids tile thrashing on wheel scroll)
    this.baseLayers.standard = L.tileLayer(LAYER_CONFIG.standard.url, {
      maxZoom: 19,
      minZoom: minZ,
      attribution: '© OpenStreetMap',
      updateWhenIdle: true,
      keepBuffer: 2
    }).addTo(this.map);

    this.baseLayers.satellite = L.tileLayer(LAYER_CONFIG.satellite.url, {
      maxZoom: 19,
      minZoom: minZ,
      attribution: '© Esri',
      updateWhenIdle: true,
      keepBuffer: 2
    });

    this.baseLayers.windy = L.tileLayer(LAYER_CONFIG.windy.url, {
      maxZoom: 12,
      minZoom: minZ,
      attribution: 'Radar: RainViewer',
      opacity: LAYER_CONFIG.windy.opacity || 0.75,
      updateWhenIdle: true,
      keepBuffer: 2
    });

    this.baseLayers.topo = L.tileLayer(LAYER_CONFIG.topo.url, {
      maxZoom: 17,
      minZoom: minZ,
      attribution: '© OpenTopoMap',
      updateWhenIdle: true,
      keepBuffer: 2
    });

    // Dark styling for base tiles is applied via CSS filter (see .leaflet-tile-pane)

    // Draw default risk zones and markers only if not skipped by caller
    if (!this.options || !this.options.skipDefaultOverlays) {
      this.drawRiskZones();
      this.addSafeSiteMarkers();
      this.addHazardMarkers();
      this.addHospitalMarkers();
      this.addHabitationMarkers();
      this.updateZoomVisibility(); // Initial visibility check
    }

    // NOTE: No default user-location marker is placed here.
    // The real pulsing citizenMarker in citizen.js is the single source of truth
    // for "you are here" — it only appears after GPS/geolocation resolves.

    return this;
  }

  drawRiskZones() {
    if (this.riskZoneCircles && this.riskZoneCircles.length) {
      this.riskZoneCircles.forEach(rz => {
        if (rz.circle) try { this.map.removeLayer(rz.circle); } catch (e) { }
        if (rz.rings) rz.rings.forEach(r => { try { this.map.removeLayer(r); } catch (e) { } });
        if (rz.label) try { this.map.removeLayer(rz.label); } catch (e) { }
      });
    }
    this.riskZoneCircles = [];

    // Concentric multi-ring configuration:
    // Simplified to 2 rings to reduce visual clutter
    const CONCENTRIC_TIERS = [
      { level: 'YELLOW', multiplier: 1.00, subLabel: 'MODERATE', fillOpacity: 0.15, strokeOpacity: 0.60, ringName: 'Monitoring Zone' },
      { level: 'RED', multiplier: 0.35, subLabel: 'CRITICAL', fillOpacity: 0.30, strokeOpacity: 0.90, ringName: 'Critical Active Core' }
    ];

    APP_DATA.riskZones.forEach(zone => {
      const lat = zone.epicenter ? zone.epicenter.lat : zone.lat;
      const lng = zone.epicenter ? zone.epicenter.lng : zone.lng;
      const baseRadius = zone.baseRadius || zone.radius;
      const hazardType = zone.hazardType || (zone.name.toLowerCase().includes('cyclone') ? 'cyclone' : zone.name.toLowerCase().includes('flood') ? 'flood' : zone.name.toLowerCase().includes('landslide') ? 'landslide' : zone.name.toLowerCase().includes('earthquake') ? 'earthquake' : 'cyclone');

      if (zone.epicenter || zone.baseRadius) {
        // Multi-ring concentric hazard epicenter rendering
        const rings = [];
        let primaryCircle = null;

        CONCENTRIC_TIERS.forEach(tier => {
          const colors = RISK_COLORS[tier.level] || RISK_COLORS.YELLOW;
          const rMeters = baseRadius * tier.multiplier;
          // All 4 rings share same lat, lng, hazardType, and orientation seed (zone.name)
          const polygonCoords = generateOrganicZonePolygon(lat, lng, rMeters, zone.name, hazardType);

          const ringZoneData = {
            ...zone,
            level: tier.level,
            radius: rMeters,
            ringLabel: tier.subLabel,
            ringName: `${zone.name} — ${tier.ringName} (${tier.subLabel})`,
            desc: tier.level === 'RED' ? (zone.desc || 'Critical active hazard core. Direct impact corridor.') :
              tier.level === 'ORANGE' ? 'High alert buffer zone. Imminent severe impact watch.' :
                tier.level === 'YELLOW' ? 'Moderate risk monitoring zone. Squall & waterlogging monitoring.' :
                  'Low risk perimeter. Advisory monitoring zone.'
          };

          const geojsonFeature = {
            type: "Feature",
            properties: {
              name: ringZoneData.ringName,
              level: tier.level,
              pop: tier.level === 'RED' ? zone.pop : Math.round(zone.pop * (1 + (tier.multiplier - 0.35) * 0.8)),
              desc: ringZoneData.desc
            },
            geometry: {
              type: "Polygon",
              coordinates: [polygonCoords]
            }
          };

          const polygonLayer = L.geoJSON(geojsonFeature, {
            style: () => ({
              fillColor: colors.fill,
              fillOpacity: tier.fillOpacity,
              color: colors.stroke,
              weight: tier.level === 'RED' ? 2.5 : 1.8,
              opacity: tier.strokeOpacity,
              className: `hazard-polygon level-${tier.level.toLowerCase()}`
            })
          }).addTo(this.map);

          polygonLayer.bindPopup(this.createRiskPopup(ringZoneData), { className: 'custom-popup' });
          polygonLayer.bindTooltip(zone.name, { permanent: false, sticky: true, className: 'zone-tooltip' });
          rings.push(polygonLayer);

          if (!this.hazardPolygons) this.hazardPolygons = [];
          this.hazardPolygons.push({
            polygon: geojsonFeature,
            level: tier.level,
            hazardType: hazardType
          });
          if (tier.level === 'RED') {
            primaryCircle = polygonLayer;
          }
        });

        this.riskZoneCircles.push({
          zone,
          circle: primaryCircle || rings[rings.length - 1],
          rings,
          label: null // removed floating labels to reduce visual clutter
        });

      } else {
        // Single Regional Zone (e.g. distinct district safe zone)
        const colors = RISK_COLORS[zone.level] || RISK_COLORS.YELLOW;
        const polygonCoords = generateOrganicZonePolygon(lat, lng, zone.radius, zone.name, hazardType);

        const geojsonFeature = {
          type: "Feature",
          properties: {
            name: zone.name,
            level: zone.level,
            pop: zone.pop,
            desc: zone.desc
          },
          geometry: {
            type: "Polygon",
            coordinates: [polygonCoords]
          }
        };

        const polygonLayer = L.geoJSON(geojsonFeature, {
          style: () => ({
            fillColor: colors.fill,
            fillOpacity: colors.fillOpacity || 0.28,
            color: colors.stroke,
            weight: 2,
            opacity: colors.strokeOpacity || 0.8,
            className: `hazard-polygon level-${zone.level.toLowerCase()}`
          })
        }).addTo(this.map);

        polygonLayer.bindPopup(this.createRiskPopup(zone), { className: 'custom-popup' });
        polygonLayer.bindTooltip(zone.name, { permanent: false, sticky: true, className: 'zone-tooltip' });

        this.riskZoneCircles.push({ zone, circle: polygonLayer, rings: [polygonLayer], label: null });
      }
    });
  }

  createRiskPopup(zone) {
    const tier = RISK_COLORS[zone.level] || RISK_COLORS.YELLOW;
    const levelClass = zone.level.toLowerCase();
    return `
      <div class="map-popup zone-unified-popup">
        <div class="popup-header">
          <div class="popup-tier-chip tier-${levelClass}">
            <span class="chip-dot"></span>
            <span class="chip-label">${tier.name}</span>
          </div>
          <span class="popup-name">${zone.name}</span>
        </div>
        <div class="popup-meaning-bar tier-${levelClass}">${tier.meaning}</div>
        <div class="popup-body">
          <div class="popup-stat"><span>Population at Risk</span><strong>${zone.pop.toLocaleString()}</strong></div>
          <div class="popup-desc">${zone.desc}</div>
        </div>
      </div>
    `;
  }

  addSafeSiteMarkers() {
    APP_DATA.safeSites.forEach(site => {
      const pct = Math.round((site.current / site.capacity) * 100);
      const capColor = pct > 85 ? '#ef4444' : pct > 60 ? '#f97316' : '#22c55e';
      const icon = L.divIcon({
        html: `
          <div class="map-poi-pin poi-shelter" title="Evacuation Shelter: ${site.name}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
        `,
        className: '', iconSize: [24, 24], iconAnchor: [12, 12]
      });
      const marker = L.marker([site.lat, site.lng], { icon }).addTo(this.map);

      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-header"><span class="risk-badge risk-green">SAFE SITE</span><span class="popup-name">${site.name}</span></div>
          <div class="popup-body">
            <div class="popup-stat"><span>Capacity</span><strong>${site.capacity.toLocaleString()}</strong></div>
            <div class="popup-stat"><span>Current</span><strong style="color:${capColor}">${site.current.toLocaleString()} (${pct}%)</strong></div>
            <div class="popup-stat"><span>Type</span><strong>${site.type}</strong></div>
            <div class="popup-amenities">${site.amenities.map(a => `<span>${a}</span>`).join('')}</div>
          </div>
        </div>
      `, { className: 'custom-popup' });
      marker._siteData = site;
      this.markers.safeSites.push(marker);
    });
  }

  addHazardMarkers() {
    const icons = { Cyclone: '🌀', Flood: '🌊', Landslide: '⛰️', Earthquake: '📳', Cloudburst: '⛈️' };
    APP_DATA.activeHazards.forEach(h => {
      const icon = L.divIcon({
        html: `<div style="font-size:24px;text-shadow:0 2px 6px rgba(0,0,0,0.6);animation:float 2s ease-in-out infinite">${icons[h.type] || '⚠️'}</div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 16]
      });
      const marker = L.marker([h.lat, h.lng], { icon }).addTo(this.map);
      const sevClass = h.severity === 'CRITICAL' ? 'risk-red' : h.severity === 'HIGH' ? 'risk-orange' : 'risk-yellow';
      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-header"><span class="risk-badge ${sevClass}">${h.severity}</span><span class="popup-name">${h.name}</span></div>
          <div class="popup-body">
            <div class="popup-stat"><span>Type</span><strong>${h.type}</strong></div>
            <div class="popup-stat"><span>State</span><strong>${h.state}</strong></div>
            <div class="popup-stat"><span>Confidence</span><strong>${h.confidence}%</strong></div>
            <div class="popup-stat"><span>ETA</span><strong>${h.eta}</strong></div>
            <div class="popup-desc">${h.desc}</div>
          </div>
        </div>
      `, { className: 'custom-popup' });
      this.markers.hazards.push(marker);
    });
  }

  addHospitalMarkers() {
    APP_DATA.hospitals.forEach(h => {
      const icon = L.divIcon({
        html: `<div class="map-poi-pin poi-hospital" title="Hospital: ${h.name}">H</div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11]
      });
      const marker = L.marker([h.lat, h.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-header"><span class="risk-badge" style="background:rgba(220,38,38,0.2);color:#f87171;border:1px solid rgba(220,38,38,0.4)">HOSPITAL</span><span class="popup-name">${h.name}</span></div>
          <div class="popup-body">
            <div class="popup-stat"><span>Beds</span><strong>${h.beds || 'Available'}</strong></div>
            <div class="popup-stat"><span>Trauma Unit</span><strong>${h.trauma ? 'Yes' : 'Level 2'}</strong></div>
            <div class="popup-desc">${h.address || 'Emergency medical facility on standby'}</div>
          </div>
        </div>
      `, { className: 'custom-popup' });
      // Hidden by default, shown when hospital layer is active
      this.markers.hospitals.push(marker);
    });
  }

  addHabitationMarkers() {
    this.markers.habitations = L.markerClusterGroup({
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        let totalPop = 0;
        markers.forEach(m => totalPop += (m._habData.pop || m._habData.growth_adjusted_pop || 1000));

        return L.divIcon({
          html: `<div style="background: rgba(15,23,42,0.95); border: 2px solid rgba(255,255,255,0.2); color: #f1f5f9; padding: 6px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5); text-align: center;">
            <span style="font-size:12px;">🏠 ${count} Habitations</span><br>
            <span style="color:#94a3b8; font-size:10px;">~${totalPop.toLocaleString()} pop</span>
          </div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(110, 40)
        });
      },
      maxClusterRadius: 70,
      disableClusteringAtZoom: 11
    });

    APP_DATA.habitations.forEach(hab => {
      // Compute dynamic risk based on Turf.js point-in-polygon vs active hazards
      let computedRisk = 'GREEN';
      let activeThreat = 'None';
      if (typeof window.turf !== 'undefined' && this.hazardPolygons) {
        const pt = turf.point([hab.lng || hab.lon, hab.lat]);
        let maxRank = 0;
        const rankMap = { 'GREEN': 1, 'YELLOW': 2, 'ORANGE': 3, 'RED': 4 };

        this.hazardPolygons.forEach(hp => {
          if (turf.booleanPointInPolygon(pt, hp.polygon)) {
            if (rankMap[hp.level] > maxRank) {
              maxRank = rankMap[hp.level];
              computedRisk = hp.level;
              activeThreat = hp.hazardType.charAt(0).toUpperCase() + hp.hazardType.slice(1);
            }
          }
        });
      }

      hab.risk = computedRisk; // Override with live dynamic risk

      const riskColors = { RED: '#ef4444', ORANGE: '#f97316', YELLOW: '#eab308', GREEN: '#22c55e' };
      const col = riskColors[hab.risk] || '#94a3b8';

      const icon = L.divIcon({
        html: `
          <div class="map-poi-pin poi-habitation" style="--poi-accent:${col};" title="Habitation: ${hab.name}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </div>
        `,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11]
      });
      const marker = L.marker([hab.lat, hab.lng || hab.lon], { icon });
      marker._habData = hab;

      // Light-theme, high-contrast popup for habitations
      const bgColors = { RED: '#fef2f2', ORANGE: '#fff7ed', YELLOW: '#fefce8', GREEN: '#f0fdf4' };
      const txtColors = { RED: '#b91c1c', ORANGE: '#c2410c', YELLOW: '#a16207', GREEN: '#15803d' };
      const riskBg = bgColors[hab.risk] || '#f8fafc';
      const riskTxt = txtColors[hab.risk] || '#0f172a';

      marker.bindPopup(`
        <div class="map-popup light-theme">
          <div class="popup-header">
            <span class="risk-badge" style="background:${riskBg}; color:${riskTxt}; border:1px solid ${col}66; font-weight:700;">${hab.risk} RISK</span>
            <span class="popup-name">${hab.name}</span>
          </div>
          <div class="popup-body">
            <div class="popup-stat"><span>Population</span><strong>${(hab.pop || hab.growth_adjusted_pop || 0).toLocaleString()}</strong></div>
            <div class="popup-stat"><span>Status</span><strong>${hab.status || 'In Place'}</strong></div>
            <div class="popup-stat"><span>Immediate Threat</span><strong>${activeThreat}</strong></div>
            <div class="popup-stat"><span>Action</span><strong>${hab.risk === 'RED' ? 'Evacuate immediately' : hab.risk === 'ORANGE' ? 'Prepare for evacuation' : 'Monitor updates'}</strong></div>
          </div>
        </div>
      `, { className: 'custom-popup-light' });

      this.markers.habitations.addLayer(marker);
    });

    // Add cluster group to map immediately, zoom control is handled inside markercluster
    const isCitizen = window.location.pathname.includes('citizen');
    if (!isCitizen) {
      this.map.addLayer(this.markers.habitations);
    }
  }

  /**
   * @deprecated — No longer called from init().
   * The real pulsing citizenMarker in js/citizen.js is the single source of truth
   * for the citizen's location and only appears after genuine GPS resolution.
   * This method is retained only to avoid breaking any external callers (e.g., authority.html).
   */
  setUserLocation(latlng) {
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    const icon = L.divIcon({
      html: `
        <div style="position:relative;width:20px;height:20px">
          <div style="width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>
          <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(59,130,246,0.5);animation:pulse-ring 1.8s ease-out infinite"></div>
        </div>`,
      className: '', iconSize: [20, 20], iconAnchor: [10, 10]
    });
    this.userMarker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(this.map);
    this.userMarker.bindPopup('<div class="map-popup"><strong>Your Location</strong></div>', { className: 'custom-popup' });
  }

  toggleLayer(layerName, visible) {
    switch (layerName) {
      case 'satellite':
        if (visible) { this.baseLayers.satellite.addTo(this.map); }
        else { this.map.removeLayer(this.baseLayers.satellite); }
        break;
      case 'elevation':
        if (visible) { this.baseLayers.topo.addTo(this.map); }
        else { this.map.removeLayer(this.baseLayers.topo); }
        break;
      case 'flood': case 'cyclone': case 'landslide':
        this.riskZoneCircles.forEach(({ zone, circle, rings, label }) => {
          if (zone.level === 'RED' || zone.level === 'ORANGE' || zone.epicenter) {
            const targets = rings || (circle ? [circle] : []);
            targets.forEach(r => {
              if (visible) { if (!this.map.hasLayer(r)) r.addTo(this.map); }
              else { if (this.map.hasLayer(r)) this.map.removeLayer(r); }
            });
            if (label) {
              if (visible) { if (!this.map.hasLayer(label)) label.addTo(this.map); }
              else { if (this.map.hasLayer(label)) this.map.removeLayer(label); }
            }
          }
        });
        break;
      case 'hospitals':
        this.markers.hospitals.forEach(m => visible ? m.addTo(this.map) : this.map.removeLayer(m));
        break;
      case 'habitations':
        if (this.markers.habitations) {
          if (visible) this.map.addLayer(this.markers.habitations);
          else this.map.removeLayer(this.markers.habitations);
        }
        break;
      case 'shelters':
        this.markers.safeSites.forEach(m => visible ? m.addTo(this.map) : this.map.removeLayer(m));
        break;
      case 'redZones':
        this.riskZoneCircles.forEach(({ zone, circle, rings, label }) => {
          if (zone.level === 'RED' || zone.epicenter) {
            const targets = rings || (circle ? [circle] : []);
            targets.forEach(r => {
              if (visible) { if (!this.map.hasLayer(r)) r.addTo(this.map); }
              else { if (this.map.hasLayer(r)) this.map.removeLayer(r); }
            });
            if (label) {
              if (visible) { if (!this.map.hasLayer(label)) label.addTo(this.map); }
              else { if (this.map.hasLayer(label)) this.map.removeLayer(label); }
            }
          }
        });
        break;
    }
  }

  // Remove the generic demo overlays so a hazard-specific view can own the map.
  // Also removes any residual userMarker that may have been set externally.
  clearDefaultOverlays() {
    this.riskZoneCircles.forEach(({ circle, rings, label }) => {
      const targets = rings || (circle ? [circle] : []);
      targets.forEach(r => {
        if (this.map.hasLayer(r)) this.map.removeLayer(r);
      });
      if (label && this.map.hasLayer(label)) this.map.removeLayer(label);
    });
    Object.values(this.markers).forEach(list => {
      if (list) {
        if (typeof list.forEach === 'function') {
          list.forEach(m => { if (this.map.hasLayer(m)) this.map.removeLayer(m); });
        } else if (typeof list.eachLayer === 'function') {
          this.map.removeLayer(list);
        }
      }
    });
    // Clean up legacy userMarker if present (defensive — should not exist after the
    // setUserLocation() call was removed from init(), but kept for safety)
    if (this.userMarker && this.map.hasLayer(this.userMarker)) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }
  }

  setBasemap(name) {
    if (name === 'windy') {
      // Keep standard base map underneath so geography is visible beneath radar overlay
      if (!this.map.hasLayer(this.baseLayers.standard)) {
        this.baseLayers.standard.addTo(this.map);
      }
      if (this.baseLayers.windy && !this.map.hasLayer(this.baseLayers.windy)) {
        this.baseLayers.windy.addTo(this.map);
      }
      if (this.map.hasLayer(this.baseLayers.satellite)) this.map.removeLayer(this.baseLayers.satellite);
      if (this.map.hasLayer(this.baseLayers.topo)) this.map.removeLayer(this.baseLayers.topo);
    } else {
      if (this.baseLayers.windy && this.map.hasLayer(this.baseLayers.windy)) {
        this.map.removeLayer(this.baseLayers.windy);
      }
      Object.entries(this.baseLayers).forEach(([key, layer]) => {
        if (key === 'windy') return;
        if (key === name) { if (!this.map.hasLayer(layer)) layer.addTo(this.map); }
        else if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
      });
    }
    this.activeBaseLayer = name;
  }

  flyToLocation(lat, lng, zoom = 10) {
    this.map.flyTo([lat, lng], zoom, { duration: 1.5, easeLinearity: 0.5 });
  }

  updateZoomVisibility() {
    if (!this.map) return;
    const currentZoom = this.map.getZoom();

    // Habitations clustering logic is now handled internally by L.markerClusterGroup.
    // The disableClusteringAtZoom option will automatically reveal markers at high zoom levels.
  }

  getMap() { return this.map; }
}

// Leaflet popup styles (injected dynamically in browser)
if (typeof document !== 'undefined') {
  const popupStyles = document.createElement('style');
  popupStyles.textContent = `
    .custom-popup .leaflet-popup-content-wrapper {
      background: rgba(255,255,255,0.98); backdrop-filter: blur(20px);
      border: 1px solid rgba(15,23,42,0.12); border-radius: 14px;
      padding: 0; box-shadow: 0 8px 32px rgba(0,0,0,0.15); color: #0F172A;
    }
    .custom-popup .leaflet-popup-tip-container { display: none; }
    .custom-popup .leaflet-popup-content { margin: 0; }
    .map-popup { min-width: 220px; }
    .popup-header { padding: 12px 14px 8px; border-bottom: 1px solid rgba(15,23,42,0.12); display: flex; align-items: center; gap: 8px; }
    .popup-name { font-size: 14px; font-weight: 700; color: #0F172A; }
    .popup-body { padding: 10px 14px 14px; }
    .popup-stat { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748B; margin-bottom: 5px; }
    .popup-stat span { color: #475569; font-weight: 500; }
    .popup-stat strong { color: #0F172A; font-weight: 700; }
    .popup-desc { font-size: 12px; color: #334155; line-height: 1.5; margin-top: 8px; }
    .popup-amenities { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .popup-amenities span { padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); color: #15803d; }
    .hab-tooltip { background: rgba(255,255,255,0.95); border: 1px solid rgba(15,23,42,0.12); color: #0F172A; font-size: 12px; border-radius: 6px; padding: 4px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    
    /* Light Theme Popups */
    .custom-popup-light .leaflet-popup-content-wrapper {
      background: #FFFFFF;
      border: 1px solid rgba(15,23,42,0.12); border-radius: 14px;
      padding: 0; box-shadow: 0 8px 32px rgba(0,0,0,0.15); color: #0f172a;
    }
    .custom-popup-light .leaflet-popup-tip-container { display: none; }
    .custom-popup-light .leaflet-popup-content { margin: 0; }
    .custom-popup-light .popup-header { border-bottom: 1px solid rgba(15,23,42,0.08); }
    .custom-popup-light .popup-name { color: #0f172a; font-weight: 700; }
    .custom-popup-light .popup-stat { color: #475569; }
    .custom-popup-light .popup-stat strong { color: #0f172a; }

    @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
    @keyframes pulse-ring { 0% { opacity: 0.8; transform: scale(0.8); } 80% { opacity: 0; transform: scale(2.2); } 100% { opacity: 0; } }
  `;
  document.head.appendChild(popupStyles);
}

// Utility to isolate overlay panels from capturing or chaining wheel zoom into the Leaflet map
function isolateMapOverlays(selectorsOrElements) {
  if (typeof L === 'undefined' || !L.DomEvent) return;
  const list = Array.isArray(selectorsOrElements) ? selectorsOrElements : [selectorsOrElements];
  list.forEach(item => {
    const el = typeof item === 'string' ? document.querySelector(item) : item;
    if (el) {
      try {
        L.DomEvent.disableScrollPropagation(el);
        L.DomEvent.disableClickPropagation(el);
        el.addEventListener('wheel', (e) => {
          e.stopPropagation();
        }, { passive: true });
      } catch (err) {
        // Safe fallback
      }
    }
  });
}

if (typeof window !== 'undefined') {
  window.isolateMapOverlays = isolateMapOverlays;
}

