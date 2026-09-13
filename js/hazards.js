// ================================================================
// HAZARDS.JS — Hazard-Specific Intelligence Layers
// Each hazard carries: risk zones (red/orange/yellow/green),
// safe zones, live alerts, past disasters, affected habitations.
// ================================================================

const RISK_STYLE = {
  RED: {
    fill: '#ef4444',
    opacity: 0.38,
    stroke: '#ef4444',
    strokeOpacity: 0.95,
    label: 'CRITICAL',
    shortLabel: 'Critical',
    meaning: 'Ongoing/current hazard confirmed by live telemetry. Immediate danger core.',
    pulsing: true
  },
  ORANGE: {
    fill: '#f97316',
    opacity: 0.30,
    stroke: '#f97316',
    strokeOpacity: 0.85,
    label: 'HIGH ALERT',
    shortLabel: 'High Alert',
    meaning: 'Hazard estimated as imminent/high probability based on current conditions.',
    pulsing: false
  },
  YELLOW: {
    fill: '#eab308',
    opacity: 0.22,
    stroke: '#eab308',
    strokeOpacity: 0.75,
    label: 'MODERATE',
    shortLabel: 'Moderate',
    meaning: 'Elevated risk under monitoring corridor, not imminent.',
    pulsing: false
  },
  GREEN: {
    fill: '#22c55e',
    opacity: 0.16,
    stroke: '#22c55e',
    strokeOpacity: 0.65,
    label: 'LOW RISK',
    shortLabel: 'Low Risk',
    meaning: 'Verified low-risk perimeter and safe evacuation corridor.',
    pulsing: false
  }
};
if (typeof window !== 'undefined') {
  window.RISK_STYLE = RISK_STYLE;
}

const HAZARD_INTEL = {
  cyclone: {
    label: 'Cyclone', icon: '🌀', accent: '#ef4444',
    summary: 'Live telemetry and automated AI monitoring active.',
    zones: [],
    safeSites: [
      { name: 'Kakinada Port Relief Camp', lat: 16.9891, lng: 82.2475, capacity: 5000, current: 1240 },
      { name: 'Visakhapatnam Port Shelter', lat: 17.6868, lng: 83.2185, capacity: 4000, current: 890 },
      { name: 'Machilipatnam Cyclone Shelter', lat: 16.1875, lng: 81.1389, capacity: 3200, current: 640 }
    ],
    alerts: [],
    history: [
      { year: 2023, name: 'Cyclone Michaung', lat: 15.80, lng: 80.30, affected: 350000, note: 'Landfall Bapatla coast, AP' },
      { year: 2020, name: 'Cyclone Nivar',    lat: 14.44, lng: 80.00, affected: 180000, note: 'Severe damage in South AP' },
      { year: 2014, name: 'Cyclone Hudhud',   lat: 17.68, lng: 83.21, affected: 500000, note: 'Catastrophic impact Visakhapatnam' },
      { year: 1990, name: 'AP Super Cyclone', lat: 16.18, lng: 81.13, affected: 1000000, note: 'Historic Machilipatnam disaster' }
    ],
    habitations: [],
    hospitals: [
      { name: 'Kakinada Government General Hospital', lat: 16.9604, lng: 82.2381, beds: 450, trauma: true },
      { name: 'Visakhapatnam King George Hospital', lat: 17.7088, lng: 83.3056, beds: 1000, trauma: true },
      { name: 'Machilipatnam District Hospital', lat: 16.1820, lng: 81.1340, beds: 280, trauma: false }
    ]
  },

  flood: {
    label: 'Flood', icon: '🌊', accent: '#ef4444',
    summary: 'Live telemetry and automated AI monitoring active.',
    zones: [],
    safeSites: [
      { name: 'Guwahati Evacuation Hub', lat: 26.18, lng: 91.73, capacity: 8000, current: 6200 },
      { name: 'Jorhat Relief Center',    lat: 26.75, lng: 94.21, capacity: 3000, current: 2100 },
      { name: 'Majuli Boat Camp',        lat: 26.98, lng: 94.20, capacity: 1200, current: 980 }
    ],
    alerts: [],
    history: [
      { year: 2022, name: 'Assam Floods',   lat: 26.35, lng: 92.80, affected: 5800000, note: 'Worst in a decade' },
      { year: 2020, name: 'Bihar Floods',   lat: 25.90, lng: 85.60, affected: 8300000, note: 'Kosi + Gandak overflow' },
      { year: 2019, name: 'Kerala Floods',  lat: 9.90,  lng: 76.50, affected: 2100000, note: 'Landslide-linked flooding' },
      { year: 2018, name: 'Kerala Deluge',  lat: 10.52, lng: 76.21, affected: 5400000, note: 'Dam releases statewide' }
    ],
    habitations: []
  },

  landslide: {
    label: 'Landslide', icon: '⛰️', accent: '#f97316',
    summary: 'Live telemetry and automated AI monitoring active.',
    zones: [],
    safeSites: [
      { name: 'Chamoli Safe Zone',   lat: 30.42, lng: 79.37, capacity: 1500, current: 220 },
      { name: 'Kullu Relief Ground', lat: 31.94, lng: 77.11, capacity: 2200, current: 410 }
    ],
    alerts: [],
    history: [
      { year: 2024, name: 'Wayanad Landslides',  lat: 11.47, lng: 76.13, affected: 1500, note: 'Severe casualties' },
      { year: 2021, name: 'Chamoli Disaster',    lat: 30.45, lng: 79.60, affected: 200,  note: 'Glacier burst debris flow' },
      { year: 2013, name: 'Kedarnath Tragedy',   lat: 30.73, lng: 79.07, affected: 100000, note: 'Flood + landslide cascade' }
    ],
    habitations: []
  },

  earthquake: {
    label: 'Earthquake', icon: '📳', accent: '#f97316',
    summary: 'Live telemetry and automated AI monitoring active.',
    zones: [],
    safeSites: [
      { name: 'Imphal Central Shelter', lat: 24.82, lng: 93.97, capacity: 4000, current: 1800 },
      { name: 'Guwahati Open Ground',   lat: 26.16, lng: 91.78, capacity: 6000, current: 300 }
    ],
    alerts: [],
    history: [
      { year: 2023, name: 'M6.2 Nepal border quake', lat: 29.40, lng: 81.20, affected: 60000, note: 'Felt across North India' },
      { year: 2011, name: 'Sikkim Earthquake M6.9',  lat: 27.72, lng: 88.16, affected: 300000, note: 'Widespread damage' },
      { year: 2001, name: 'Bhuj Earthquake M7.7',    lat: 23.42, lng: 70.23, affected: 1600000, note: 'Deadliest recent quake' }
    ],
    habitations: []
  },

  tsunami: {
    label: 'Tsunami', icon: '🌊', accent: '#ef4444',
    summary: 'Live telemetry and automated AI monitoring active.',
    zones: [],
    safeSites: [
      { name: 'Nagapattinam High Ground', lat: 10.80, lng: 79.79, capacity: 4500, current: 0 },
      { name: 'Port Blair Vertical Shelter', lat: 11.66, lng: 92.75, capacity: 2000, current: 0 }
    ],
    alerts: [],
    history: [
      { year: 2004, name: 'Indian Ocean Tsunami', lat: 10.77, lng: 79.84, affected: 2790000, note: 'Catastrophic, Tamil Nadu' }
    ],
    habitations: []
  },

  cloudburst: {
    label: 'Cloudburst', icon: '⛈️', accent: '#f97316',
    summary: 'Live telemetry and automated AI monitoring active.',
    zones: [],
    safeSites: [
      { name: 'Shimla Community Hall', lat: 31.11, lng: 77.19, capacity: 1800, current: 120 },
      { name: 'Kangra Relief Camp',    lat: 32.09, lng: 76.26, capacity: 2400, current: 300 }
    ],
    alerts: [],
    history: [
      { year: 2023, name: 'Himachal Monsoon Fury', lat: 31.70, lng: 77.10, affected: 420000, note: 'Beas river devastation' }
    ],
    habitations: []
  },

  erosion: {
    label: 'Coastal Erosion', icon: '🏝️', accent: '#eab308',
    summary: 'Live telemetry and automated AI monitoring active.',
    zones: [],
    safeSites: [
      { name: 'Sagar Island Relocation Site', lat: 21.75, lng: 88.15, capacity: 2600, current: 780 }
    ],
    alerts: [],
    history: [
      { year: 2020, name: 'Sagar Island land loss', lat: 21.70, lng: 88.10, affected: 15000, note: 'Villages relocated' }
    ],
    habitations: []
  }
};
if (typeof window !== 'undefined') {
  window.HAZARD_INTEL = HAZARD_INTEL;
}

// ================================================================
// ORGANIC ZONE POLYGON GENERATOR (Choropleth / Terrain Contour)
// ================================================================
function generateOrganicZonePolygon(lat, lng, radiusMeters, name, hazardType = 'cyclone') {
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

  // Directional elongation depending on hazard physics:
  // Coastal (Cyclone, Tsunami, Erosion): stretches along coastline (NE-SW: ~45 deg)
  // Flood: stretches along river flow channel
  // Landslide: stretches along contour ridge
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

class HazardEngine {
  constructor(map) {
    this.map = map;
    this.group = L.layerGroup().addTo(map);
    this.revealedSafeSitesGroup = L.layerGroup().addTo(map);
    this.visible = { zones: true, safe: false, alerts: true, habitations: true, hospitals: true };
    this.activeKey = null;
    this.layerCache = {}; // Cache compiled Leaflet layers by hazard key
    this.timelineStep = 0; // 0=Now, 1=+3h, 2=+6h, 3=+12h, 4=+24h, 5=+48h
    this.renderedZoneLayers = [];
    this.aiState = null;
    this.isFetchingState = false;
    this.onStatsChange = null;

    // Trigger initial fetch of unified AI engine state
    this.loadAIEngineState();
  }

  async loadAIEngineState(force = false) {
    if (this.aiState && !force) return this.aiState;
    if (this.isFetchingState) return null;
    this.isFetchingState = true;
    try {
      const res = await fetch('/api/ai-engine/state');
      if (res.ok) {
        const data = await res.json();
        this.aiState = data;
        if (data.zonesByHazard) {
          Object.keys(data.zonesByHazard).forEach(key => {
            if (HAZARD_INTEL[key]) {
              HAZARD_INTEL[key].zones = data.zonesByHazard[key];
              HAZARD_INTEL[key].habitations = data.zonesByHazard[key].map(z => ({
                name: z.village_name || z.name,
                lat: z.lat,
                lng: z.lng,
                pop: z.pop || 0,
                risk: z.current_tier || z.level || 'GREEN',
                evacuated: false
              }));
            }
          });
        }
        if (data.alerts && data.alerts.length) {
          Object.keys(HAZARD_INTEL).forEach(key => {
            HAZARD_INTEL[key].alerts = data.alerts;
          });
        }
        if (data.situationalBrief && data.situationalBrief.text) {
          Object.keys(HAZARD_INTEL).forEach(key => {
            HAZARD_INTEL[key].summary = data.situationalBrief.text;
          });
        }
        this.invalidateCache();
        if (this.activeKey) {
          this.render(this.activeKey, true);
        }
        if (typeof window !== 'undefined' && typeof window.updateCitizenRiskBadge === 'function') {
          window.updateCitizenRiskBadge();
        }
        return data;
      }
    } catch (e) {
      console.warn('[HazardEngine] Could not load live AI engine state:', e.message);
    } finally {
      this.isFetchingState = false;
    }
    return null;
  }

  /**
   * Authority alert-to-zone synchronization:
   * Injects or force-escalates a zone at the exact declared location and tier,
   * rendering identically to any AI-engine-generated zone (same organic polygon,
   * concentric rings / land clipping, tier styling).
   */
  injectOrEscalateAuthorityZone(alert) {
    if (!alert) return null;

    const rawHazard = (alert.hazardType || alert.hazard_type || alert.type || alert.title || this.activeKey || 'cyclone').toLowerCase();
    let normHazard = 'cyclone';
    if (rawHazard.includes('flood') || rawHazard.includes('inundat')) normHazard = 'flood';
    else if (rawHazard.includes('landslide') || rawHazard.includes('slope') || rawHazard.includes('debris')) normHazard = 'landslide';
    else if (rawHazard.includes('earthquake') || rawHazard.includes('seismic')) normHazard = 'earthquake';
    else if (rawHazard.includes('cloudburst') || rawHazard.includes('squall')) normHazard = 'cloudburst';
    else if (rawHazard.includes('tsunami')) normHazard = 'tsunami';
    else if (rawHazard.includes('erosion')) normHazard = 'erosion';

    const rawTier = (alert.level || alert.severity || alert.tier || 'RED').toUpperCase();
    let targetTier = 'RED';
    if (rawTier.includes('CRIT') || rawTier.includes('RED') || rawTier === '4') targetTier = 'RED';
    else if (rawTier.includes('HIGH') || rawTier.includes('ORANGE') || rawTier === '3') targetTier = 'ORANGE';
    else if (rawTier.includes('MOD') || rawTier.includes('YELLOW') || rawTier.includes('ADVISORY') || rawTier === '2') targetTier = 'YELLOW';
    else if (rawTier.includes('SAFE') || rawTier.includes('GREEN') || rawTier === '1') targetTier = 'GREEN';

    const lat = Number(alert.lat != null ? alert.lat : alert.latitude);
    const lng = Number(alert.lng != null ? alert.lng : alert.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;

    const radiusMeters = Number(alert.radius ? (alert.radius > 1000 ? alert.radius : alert.radius * 1000) : 28000);
    const zoneName = alert.zone || alert.area || alert.name || alert.title || `${normHazard.toUpperCase()} Warning Zone`;
    const message = alert.message || alert.desc || 'Official Emergency Directive Issued.';

    if (!HAZARD_INTEL[normHazard]) {
      HAZARD_INTEL[normHazard] = {
        label: normHazard.charAt(0).toUpperCase() + normHazard.slice(1),
        icon: '⚠️',
        accent: '#ef4444',
        summary: 'Live official emergency monitoring active.',
        zones: [],
        safeSites: [],
        alerts: []
      };
    }

    const zones = HAZARD_INTEL[normHazard].zones || (HAZARD_INTEL[normHazard].zones = []);

    const calcDist = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    let existing = zones.find(z => {
      const zLat = z.epicenter ? z.epicenter.lat : z.lat;
      const zLng = z.epicenter ? z.epicenter.lng : z.lng;
      const zName = (z.name || z.village_name || '').toLowerCase();
      const targetName = zoneName.toLowerCase();
      if (zName && targetName && (zName.includes(targetName) || targetName.includes(zName))) return true;
      if (zLat == null || zLng == null) return false;
      return calcDist(lat, lng, zLat, zLng) <= 5;
    });

    if (existing) {
      existing.current_tier = targetTier;
      existing.level = targetTier;
      if (Array.isArray(existing.forecast_tier_by_hour)) {
        existing.forecast_tier_by_hour = [targetTier, targetTier, targetTier, targetTier, targetTier, targetTier];
      }
      existing.note = `OFFICIAL AUTHORITY ESCALATION: ${message}`;
      if (radiusMeters) {
        existing.baseRadius = radiusMeters;
        existing.radius = radiusMeters;
      }
    } else {
      existing = {
        id: `zone-auth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        village_id: `auth-${Date.now()}`,
        name: zoneName,
        village_name: alert.zone || alert.area || zoneName,
        district: alert.district || 'Andhra Pradesh Sector',
        state: alert.state || 'Andhra Pradesh',
        hazardType: normHazard,
        lat: lat,
        lng: lng,
        baseRadius: radiusMeters,
        radius: radiusMeters,
        pop: alert.pop || 25000,
        current_tier: targetTier,
        level: targetTier,
        forecast_tier_by_hour: [targetTier, targetTier, targetTier, targetTier, targetTier, targetTier],
        note: `OFFICIAL AUTHORITY DECLARATION: ${message}`,
        isAuthorityDeclared: true
      };
      zones.push(existing);
    }

    // Sync into this.aiState as well if loaded
    if (this.aiState) {
      if (!this.aiState.zonesByHazard) this.aiState.zonesByHazard = {};
      if (!Array.isArray(this.aiState.zonesByHazard[normHazard])) this.aiState.zonesByHazard[normHazard] = [];
      const az = this.aiState.zonesByHazard[normHazard];
      const zIdx = az.findIndex(z => z.id === existing.id);
      if (zIdx >= 0) az[zIdx] = existing;
      else az.push(existing);

      if (Array.isArray(this.aiState.allZones)) {
        const allIdx = this.aiState.allZones.findIndex(z => z.id === existing.id);
        if (allIdx >= 0) this.aiState.allZones[allIdx] = existing;
        else this.aiState.allZones.push(existing);
      }
    }

    // Invalidate cache and re-render the map immediately
    this.invalidateCache(normHazard);
    const targetKey = (this.activeKey && HAZARD_INTEL[this.activeKey]) ? this.activeKey : normHazard;
    this.render(targetKey, true);

    return existing;
  }

  setMap(newMap) {
    if (!newMap) return;
    if (this.group && this.map) {
      try { this.map.removeLayer(this.group); } catch (e) {}
    }
    if (this.revealedSafeSitesGroup && this.map) {
      try { this.map.removeLayer(this.revealedSafeSitesGroup); } catch (e) {}
    }
    this.map = newMap;
    this.group = L.layerGroup().addTo(newMap);
    this.revealedSafeSitesGroup = L.layerGroup().addTo(newMap);
    if (this.activeKey) {
      this.render(this.activeKey);
    }
  }

  invalidateCache(key = null) {
    if (key) {
      delete this.layerCache[key];
    } else {
      this.layerCache = {};
    }
  }

  setTimelineStep(stepIndex) {
    this.timelineStep = Math.max(0, Math.min(5, stepIndex));
    if (!this.renderedZoneLayers || !this.renderedZoneLayers.length) return;

    this.renderedZoneLayers.forEach(({ polygonLayer, labelMarker, zone, hazard }) => {
      // Skip the merged green hull layer — it has no individual zone forecast data
      if (!zone.current_tier && !zone.forecast_tier_by_hour) return;

      const currentTier = zone.current_tier || zone.level || 'GREEN';
      const activeTier = (this.timelineStep === 0) 
        ? currentTier 
        : (zone.forecast_tier_by_hour?.[this.timelineStep] || currentTier);
      const s = RISK_STYLE[activeTier] || RISK_STYLE.GREEN;

      if (polygonLayer && typeof polygonLayer.setStyle === 'function') {
        polygonLayer.setStyle({
          fillColor: s.fill,
          fillOpacity: s.opacity || 0.28,
          color: s.stroke,
          weight: activeTier === 'RED' ? 2.6 : 1.8,
          opacity: s.strokeOpacity || 0.85,
          className: `hazard-polygon level-${activeTier.toLowerCase()}`
        });
      }

      if (polygonLayer && typeof polygonLayer.setPopupContent === 'function') {
        polygonLayer.setPopupContent(this.zonePopup(s, zone, hazard, this.timelineStep));
      }

      if (labelMarker && labelMarker.setIcon) {
        labelMarker.setIcon(this.zoneLabelIcon({ ...zone, level: activeTier }));
      }
    });

    if (typeof this.onStatsChange === 'function' && this.activeKey) {
      this.onStatsChange(this.stats(this.activeKey));
    }
  }

  render(key, force = false) {
    this.activeKey = key;
    const h = HAZARD_INTEL[key];
    if (!h) return null;

    this.group.clearLayers();
    this.renderedZoneLayers = [];

    // Fast-path: Reuse cached Leaflet layers if available and not forced
    if (!force && this.layerCache[key]) {
      const cached = this.layerCache[key];
      if (this.visible.zones && cached.zones) cached.zones.forEach(l => this.group.addLayer(l));
      if (this.visible.safe && cached.safe) cached.safe.forEach(l => this.group.addLayer(l));
      if (this.visible.alerts && cached.alerts) cached.alerts.forEach(l => this.group.addLayer(l));
      if (this.visible.habitations && cached.habitations) cached.habitations.forEach(l => this.group.addLayer(l));
      if (this.visible.hospitals && cached.hospitals) cached.hospitals.forEach(l => this.group.addLayer(l));
      return this.stats(key);
    }

    const bucket = {
      zones: [],
      safe: [],
      alerts: [],
      habitations: [],
      hospitals: []
    };

    const greenZoneData = [];    // Collect green zones for merging
    const dangerPolygons = [];   // Collect non-green polygons to carve out of green hull

    // 1. Dynamic GIS Hazard Zones (Derived directly from AI Engine live + forecast state)
    (h.zones || []).forEach(z => {
      const lat = z.epicenter ? z.epicenter.lat : z.lat;
      const lng = z.epicenter ? z.epicenter.lng : z.lng;
      const baseRadius = z.baseRadius || z.radius || 28000;
      const hazardType = z.hazardType || key;

      const currentTier = z.current_tier || z.level || 'GREEN';
      const activeTier = (this.timelineStep === 0)
        ? currentTier
        : (z.forecast_tier_by_hour?.[this.timelineStep] || currentTier);
      const s = RISK_STYLE[activeTier] || RISK_STYLE.GREEN;

      // ── GREEN zones: collect for merging into a single convex hull ──
      if (activeTier === 'GREEN' && typeof window !== 'undefined' && window.turf) {
        greenZoneData.push({ lat, lng, zone: z, hazard: h });

        // Still add the home icon marker for each green habitation
        const labelIcon = this.zoneLabelIcon({ ...z, level: activeTier });
        const labelMarker = L.marker([lat, lng], { icon: labelIcon, interactive: true });
        labelMarker.on('click', (ev) => {
          if (typeof window.openInspector === 'function') {
            L.DomEvent.stopPropagation(ev);
            window.openInspector(z, ev.latlng);
          }
        });
        bucket.zones.push(labelMarker);
        if (this.visible.zones) this.group.addLayer(labelMarker);
        this.renderedZoneLayers.push({ labelMarker, zone: z, hazard: h });
        return; // Skip individual green polygon — will be merged below
      }

      // ── Non-green zones (RED / ORANGE / YELLOW): render individually ──
      const polygonCoords = generateOrganicZonePolygon(lat, lng, baseRadius, z.name, hazardType);

      // Collect danger polygon geometry for carving out of the green hull later
      if (typeof window !== 'undefined' && window.turf) {
        try { dangerPolygons.push(window.turf.polygon([polygonCoords])); } catch (e) {}
      }

      const geojsonFeature = {
        type: "Feature",
        properties: {
          name: z.name,
          level: activeTier,
          current_tier: currentTier,
          pop: z.pop,
          note: z.note,
          hazard: h.label
        },
        geometry: {
          type: "Polygon",
          coordinates: [polygonCoords]
        }
      };

      const polygonLayer = L.geoJSON(geojsonFeature, {
        style: () => ({
          fillColor: s.fill,
          fillOpacity: s.opacity || 0.28,
          color: s.stroke,
          weight: activeTier === 'RED' ? 2.6 : 1.8,
          opacity: s.strokeOpacity || 0.85,
          className: `hazard-polygon level-${activeTier.toLowerCase()}`
        })
      });

      polygonLayer.on('click', (ev) => {
        if (typeof window.openInspector === 'function') {
          L.DomEvent.stopPropagation(ev);
          window.openInspector(z, ev.latlng);
        }
      });
      bucket.zones.push(polygonLayer);
      if (this.visible.zones) this.group.addLayer(polygonLayer);

      const labelIcon = this.zoneLabelIcon({ ...z, level: activeTier });
      const labelMarker = L.marker([lat, lng], { icon: labelIcon, interactive: true });
      labelMarker.on('click', (ev) => {
        if (typeof window.openInspector === 'function') {
          L.DomEvent.stopPropagation(ev);
          window.openInspector(z, ev.latlng);
        }
      });
      bucket.zones.push(labelMarker);
      if (this.visible.zones) this.group.addLayer(labelMarker);

      this.renderedZoneLayers.push({ polygonLayer, labelMarker, zone: z, hazard: h });
    });

    // ── Merge all GREEN zones into a single convex hull polygon ──
    if (greenZoneData.length > 2 && typeof window !== 'undefined' && window.turf) {
      try {
        const greenPts = greenZoneData.map(g => window.turf.point([g.lng, g.lat]));
        let greenHull = window.turf.convex(window.turf.featureCollection(greenPts));
        if (greenHull) {
          // Buffer outward by 5 km so the hull fully encloses the habitation areas
          greenHull = window.turf.buffer(greenHull, 5, { units: 'kilometers' });

          // Carve out (subtract) each danger zone so red/yellow/orange never overlap green
          dangerPolygons.forEach(dp => {
            try {
              // Buffer each danger polygon slightly so there's a visible gap
              const bufferedDanger = window.turf.buffer(dp, 1, { units: 'kilometers' });
              const diff = window.turf.difference(
                window.turf.featureCollection([greenHull, bufferedDanger])
              );
              if (diff) greenHull = diff;
            } catch (e) {
              // Fallback: try the legacy 2-arg difference API (Turf v5/v6 compat)
              try {
                const diff2 = window.turf.difference(greenHull, dp);
                if (diff2) greenHull = diff2;
              } catch (e2) {}
            }
          });

          // Clip against land boundary so green zone doesn't extend over water
          if (window.LandBoundaryService && window.LandBoundaryService.clipPolygonCoords) {
            try {
              const coords = greenHull.geometry.coordinates;
              const outerRing = greenHull.geometry.type === 'MultiPolygon'
                ? coords[0][0] : coords[0];
              const clipped = window.LandBoundaryService.clipPolygonCoords(outerRing, {
                name: 'Merged Safe Zone', hazardType: 'cyclone',
                lat: greenZoneData[0].lat, lng: greenZoneData[0].lng, radiusMeters: 50000
              });
              if (clipped && clipped.coordinates) {
                greenHull = {
                  type: 'Feature',
                  properties: greenHull.properties || {},
                  geometry: clipped
                };
              }
            } catch (clipErr) {}
          }

          const gs = RISK_STYLE.GREEN;
          const greenLayer = L.geoJSON(greenHull, {
            style: () => ({
              fillColor: gs.fill,
              fillOpacity: 0.14,
              color: gs.stroke,
              weight: 2,
              opacity: 0.7,
              dashArray: '6 4',
              className: 'hazard-polygon level-green merged-safe-zone'
            }),
            interactive: false
          });

          bucket.zones.unshift(greenLayer);  // Add FIRST so it renders behind danger zones
          if (this.visible.zones) this.group.addLayer(greenLayer);
          this.renderedZoneLayers.push({ polygonLayer: greenLayer, zone: { level: 'GREEN', name: 'Konaseema Safe Perimeter' }, hazard: h });
        }
      } catch (e) {
        console.warn('[HazardManager] Failed to merge green zones into hull:', e);
      }
    }

    // 2. Designated Safe Shelters
    (h.safeSites || []).forEach((s, idx) => {
      const free = s.capacity - s.current;
      const marker = L.marker([s.lat, s.lng], { icon: this.shelterIcon(idx * 40) })
        .bindPopup(this.popup('Safe Zone', 'green', s.name, [
          ['Capacity', s.capacity.toLocaleString()],
          ['Occupancy', `${s.current.toLocaleString()} (${Math.round((s.current / s.capacity) * 100)}%)`],
          ['Available beds', free.toLocaleString()],
          ['Resources', s.resources ? s.resources.join(', ') : 'Medical, Water, Power']
        ], 'Designated cyclone / flood multi-purpose safe shelter.'), { className: 'custom-popup' });
      bucket.safe.push(marker);
      if (this.visible.safe) this.group.addLayer(marker);
    });

    // 3. Live Sensor Threat Warnings / Alerts
    (h.alerts || []).forEach((a, i) => {
      const color = a.level === 'CRITICAL' ? 'red' : a.level === 'HIGH' ? 'orange' : 'yellow';
      const coords = a.lat && a.lng ? [a.lat, a.lng] : [16.9 + (i * 0.15), 82.2 + (i * 0.12)];
      const marker = L.marker(coords, { icon: this.alertIcon(color, i * 40) })
        .bindPopup(this.popup('Live Warning', color, a.title, [
          ['Severity', a.level],
          ['Area', a.area],
          ['Issued', a.time]
        ], 'Real-time alert propagated from IMD/NDMA early-warning grid.'), { className: 'custom-popup' });
      bucket.alerts.push(marker);
      if (this.visible.alerts) this.group.addLayer(marker);
    });

    // 4. At-Risk Habitations
    (h.habitations || []).forEach((hab, i) => {
      const marker = L.marker([hab.lat, hab.lng], { icon: this.habitationIcon(hab.risk, i * 35) })
        .bindPopup(this.popup(`Risk: ${hab.risk}`, hab.risk.toLowerCase(), hab.name, [
          ['Population', hab.pop.toLocaleString()],
          ['Status', hab.evacuated ? 'Evacuated' : 'In Place'],
          ['Immediate threat', h.label]
        ], 'Local habitation telemetry monitored by disaster grid.'), { className: 'custom-popup' });
      bucket.habitations.push(marker);
      if (this.visible.habitations) this.group.addLayer(marker);
    });

    // 6. Emergency Hospitals & Trauma Centers
    if (h.hospitals) {
      h.hospitals.forEach((hosp, i) => {
        const marker = L.marker([hosp.lat, hosp.lng], { icon: this.hospitalIcon(i * 35) })
          .bindPopup(this.popup('Emergency Care', 'red', hosp.name, [
            ['Total Beds', hosp.beds.toLocaleString()],
            ['Trauma Care', hosp.trauma ? 'Level 1 Trauma Available' : 'Basic Emergency Unit']
          ], 'Designated primary receiving hospital for disaster casualties.'), { className: 'custom-popup' });
        bucket.hospitals.push(marker);
        if (this.visible.hospitals) this.group.addLayer(marker);
      });
    }

    this.layerCache[key] = bucket;
    return this.stats(key);
  }

  setVisibility(part, on) {
    this.visible[part] = on;
    if (this.activeKey) this.render(this.activeKey);
  }

  stats(key) {
    const h = HAZARD_INTEL[key];
    if (!h) return { label: '', redZones: 0, atRisk: 0, shelter: 0 };
    const step = this.timelineStep || 0;
    const zones = h.zones || [];
    const atRisk = zones.reduce((sum, z) => {
      const tier = (step === 0) ? (z.current_tier || z.level) : (z.forecast_tier_by_hour?.[step] || z.current_tier || z.level);
      if (tier === 'RED' || tier === 'ORANGE') return sum + (z.pop || 0);
      return sum;
    }, 0);
    const redZones = zones.filter(z => {
      const tier = (step === 0) ? (z.current_tier || z.level) : (z.forecast_tier_by_hour?.[step] || z.current_tier || z.level);
      return tier === 'RED';
    }).length;
    const shelter = h.safeSites ? h.safeSites.reduce((a, s) => a + (s.capacity - s.current), 0) : 0;
    const focusZone = zones[0];
    const focus = focusZone ? { lat: focusZone.lat, lng: focusZone.lng, ...focusZone } : { lat: 16.99, lng: 82.25 };
    return {
      label: h.label, icon: h.icon, accent: h.accent, summary: h.summary,
      redZones,
      atRisk, shelter,
      alerts: h.alerts, history: h.history, habitations: h.habitations,
      focus
    };
  }

  zonePopup(s, z, h, stepIndex = 0) {
    const currentTier = z.current_tier || z.level || 'GREEN';
    const activeTier = (stepIndex === 0) ? currentTier : (z.forecast_tier_by_hour?.[stepIndex] || currentTier);
    const tierStyle = RISK_STYLE[activeTier] || s;
    const levelClass = activeTier.toLowerCase();
    const tierName = tierStyle.label || activeTier;

    const stepLabels = ['Now (Live Telemetry)', '+3h Forecast', '+6h Forecast', '+12h Projected Peak', '+24h Forward', '+48h Horizon'];
    const currentStepLabel = stepLabels[stepIndex] || 'Live';

    const seriesItem = z.forecast_series?.[stepIndex];
    const windDisplay = seriesItem ? `${seriesItem.gustKmh} km/h (peak gusts)` : (z.current_telemetry ? `${z.current_telemetry.windGustKmh} km/h` : '38 km/h');
    const pressureDisplay = seriesItem ? `${seriesItem.pressureHpa} hPa` : (z.current_telemetry ? `${z.current_telemetry.pressureHpa} hPa` : '1008 hPa');

    return `
      <div class="map-popup zone-unified-popup">
        <div class="popup-header">
          <div class="popup-tier-chip tier-${levelClass}">
            <span class="chip-dot"></span>
            <span class="chip-label">${tierName}</span>
          </div>
          <span class="popup-name">${z.name}</span>
        </div>
        <div class="popup-meaning-bar tier-${levelClass}">
          <strong>${currentStepLabel}:</strong> ${tierStyle.meaning}
        </div>
        <div class="popup-body">
          <div class="popup-stat"><span>Timeline State</span><strong>${currentStepLabel}</strong></div>
          <div class="popup-stat"><span>Current Live Obs</span><strong style="color:${(RISK_STYLE[currentTier]||{}).fill||'#22c55e'};">${currentTier}</strong></div>
          <div class="popup-stat"><span>Timeline Step Tier</span><strong style="color:${tierStyle.fill};">${activeTier}</strong></div>
          <div class="popup-stat"><span>Wind / Gust</span><strong>${windDisplay}</strong></div>
          <div class="popup-stat"><span>Atmospheric Pressure</span><strong>${pressureDisplay}</strong></div>
          <div class="popup-stat"><span>People in Zone</span><strong>${(z.pop || 0).toLocaleString()}</strong></div>
          ${z.satellite ? `
          <div class="popup-stat"><span>NASA FIRMS Active Fires</span><strong>${z.satellite.activeHotspotCount > 0 ? `${z.satellite.activeHotspotCount} spot(s) (${z.satellite.maxFrpMw} MW)` : '0 detected (VIIRS)'}</strong></div>
          <div class="popup-stat"><span>Sentinel Flood Inundation</span><strong>${z.satellite.floodExpansionPct > 0 ? `+${z.satellite.floodExpansionPct}% (${z.satellite.floodRiskStatus})` : 'Normal'}</strong></div>
          ` : ''}
          ${z.disaster_recurrence && z.disaster_recurrence.reasoning ? `
          <div class="popup-desc" style="margin-top:6px; background:rgba(234,179,8,0.08); border-left:3px solid #eab308; padding:5px 8px; border-radius:3px; color:#fde047; font-size:11px;">
            <strong>Historical Recurrence Risk:</strong> ${z.disaster_recurrence.reasoning}
          </div>` : ''}
          <div class="popup-desc" style="margin-top:6px;">${z.note || 'Dynamic habitation zone derived from live telemetry & Census baseline.'}</div>
        </div>
      </div>
    `;
  }

  popup(badge, badgeClass, title, rows, note) {
    return `
      <div class="map-popup">
        <div class="popup-header">
          <span class="risk-badge risk-${badgeClass}">${badge}</span>
          <span class="popup-name">${title}</span>
        </div>
        <div class="popup-body">
          ${rows.map(([k, v]) => `<div class="popup-stat"><span>${k}</span><strong>${v}</strong></div>`).join('')}
          <div class="popup-desc">${note}</div>
        </div>
      </div>`;
  }

  zoneLabelIcon(z) {
    const col = z.level === 'RED' ? '#ef4444' : z.level === 'ORANGE' ? '#f97316' : z.level === 'YELLOW' ? '#eab308' : '#22c55e';
    // Extract short name: use village_name if available, otherwise first 2 words of name
    const shortName = z.village_name || (z.name || '').split(' ').slice(0, 2).join(' ');
    return L.divIcon({
      html: `
        <div class="zone-label-pin" style="--poi-accent:${col};" title="${z.name}">
          <div class="map-poi-pin poi-habitation" style="--poi-accent:${col};">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </div>
          <span class="zone-label-text" style="color:#1e293b; background:rgba(255,255,255,0.88); padding:1px 4px; border-radius:3px; font-size:9px; font-weight:700; white-space:nowrap; text-shadow:0 0 2px #fff; margin-top:2px; display:block; text-align:center; max-width:80px; overflow:hidden; text-overflow:ellipsis; border:1px solid ${col}44;">${shortName}</span>
        </div>
      `,
      className: '',
      iconSize: [80, 38],
      iconAnchor: [40, 11]
    });
  }

  shelterIcon(delayMs = 0) {
    return L.divIcon({
      html: `
        <div class="map-poi-pin poi-shelter" style="--drop-delay:${delayMs}ms;" title="Evacuation Shelter">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  revealedShelterIcon(delayMs = 0) {
    return L.divIcon({
      html: `
        <div class="map-poi-pin poi-shelter safe-site-revealed" style="--drop-delay:${delayMs}ms;" title="Designated Safe Shelter">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  calcDistanceKm(a1, b1, a2, b2) {
    const R = 6371, dLat = (a2 - a1) * Math.PI / 180, dLng = (b2 - b1) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  revealSafeSitesNear(lat, lng, radiusKm = 120) {
    if (!this.revealedSafeSitesGroup) {
      this.revealedSafeSitesGroup = L.layerGroup().addTo(this.map);
    }
    this.revealedSafeSitesGroup.clearLayers();

    const h = HAZARD_INTEL[this.activeKey || 'cyclone'];
    if (!h || !h.safeSites) return [];

    const withDist = h.safeSites.map(s => ({
      ...s,
      distanceKm: this.calcDistanceKm(lat, lng, s.lat, s.lng)
    })).sort((a, b) => a.distanceKm - b.distanceKm);

    const nearby = withDist.filter(s => s.distanceKm <= radiusKm);
    const sitesToRender = nearby.length > 0 ? nearby : withDist.slice(0, 3);

    sitesToRender.forEach((s, idx) => {
      const free = s.capacity - s.current;
      const marker = L.marker([s.lat, s.lng], {
        icon: this.revealedShelterIcon(idx * 50)
      }).bindPopup(this.popup('Designated Safe Shelter', 'green', s.name, [
        ['Distance', `${s.distanceKm.toFixed(1)} km away`],
        ['Available Beds', free.toLocaleString()],
        ['Total Capacity', s.capacity.toLocaleString()],
        ['Occupancy', `${s.current.toLocaleString()} (${Math.round((s.current / s.capacity) * 100)}%)`],
        ['Coordinates', `${s.lat.toFixed(4)}° N, ${s.lng.toFixed(4)}° E`]
      ], 'Registered multi-purpose civil evacuation shelter.'), { className: 'custom-popup' });

      s._marker = marker;
      this.revealedSafeSitesGroup.addLayer(marker);
    });

    return sitesToRender;
  }

  hideRevealedSafeSites() {
    if (this.revealedSafeSitesGroup) {
      this.revealedSafeSitesGroup.clearLayers();
    }
  }

  habitationIcon(risk, delayMs = 0) {
    const col = risk === 'RED' ? '#ef4444' : risk === 'ORANGE' ? '#f97316' : risk === 'YELLOW' ? '#eab308' : '#22c55e';
    return L.divIcon({
      html: `
        <div class="map-poi-pin poi-habitation" style="--poi-accent:${col}; --drop-delay:${delayMs}ms;" title="Habitation Center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  alertIcon(level, delayMs = 0) {
    const col = level === 'CRITICAL' ? '#ef4444' : level === 'HIGH' ? '#f97316' : level === 'MODERATE' ? '#eab308' : '#22c55e';
    return L.divIcon({
      html: `<div class="alert-pin" style="--pin:${col}; --drop-delay:${delayMs}ms;"><span>!</span></div>`,
      className: '', iconSize: [24, 24], iconAnchor: [12, 12]
    });
  }

  hospitalIcon(delayMs = 0) {
    return L.divIcon({
      html: `<div class="map-poi-pin poi-hospital" style="--drop-delay:${delayMs}ms;" title="Emergency Hospital / Trauma Care">H</div>`,
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  renderLiveEarthquakes(earthquakes) {
    if (!earthquakes || !Array.isArray(earthquakes)) return;
    earthquakes.forEach(eq => {
      const color = eq.mag >= 5.5 ? '#ef4444' : eq.mag >= 4.5 ? '#f97316' : '#eab308';
      const size = Math.min(36, Math.max(18, Math.round(eq.mag * 5.2)));
      const icon = L.divIcon({
        className: '',
        html: `
          <div class="usgs-live-marker" style="--eq-color:${color}; width:${size}px; height:${size}px;" title="M${eq.mag.toFixed(1)} - ${eq.place}">
            <span class="eq-pulse"></span>
            <span style="font-size:${size > 24 ? '10px' : '9px'}; font-weight:800;">${eq.mag.toFixed(1)}</span>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const dateStr = new Date(eq.epochMs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST';
      const popupHtml = `
        <div class="map-popup">
          <div class="popup-header">
            <span class="risk-badge risk-${eq.mag >= 5.0 ? 'red' : 'orange'}">USGS Live (M${eq.mag.toFixed(1)})</span>
            <span class="popup-name">${eq.place}</span>
          </div>
          <div class="popup-body">
            <div class="popup-stat"><span>Magnitude</span><strong>M ${eq.mag.toFixed(1)}</strong></div>
            <div class="popup-stat"><span>Depth</span><strong>${eq.depthKm} km</strong></div>
            <div class="popup-stat"><span>Coordinates</span><strong>${eq.lat.toFixed(2)}° N, ${eq.lng.toFixed(2)}° E</strong></div>
            <div class="popup-stat"><span>Recorded</span><strong>${dateStr}</strong></div>
            <div class="popup-stat"><span>Tsunami Watch</span><strong>${eq.tsunamiAlert ? '⚠️ ALERT ACTIVE' : 'None'}</strong></div>
            <div class="popup-desc" style="margin-top:8px;">
              <div style="font-size:10px; color:#38bdf8; margin-bottom:6px; font-weight:600;">Data Source: USGS Earthquake Hazards Program</div>
              <a href="${eq.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:4px 8px; border-radius:4px; background:#2563eb; color:#ffffff; text-decoration:none; font-size:11px; font-weight:600;">View Official USGS Record ↗</a>
            </div>
          </div>
        </div>
      `;

      L.marker([eq.lat, eq.lng], { icon })
        .bindPopup(popupHtml, { className: 'custom-popup' })
        .addTo(this.group);
    });
  }
}

if (typeof window !== 'undefined') {
  window.HazardEngine = HazardEngine;
}
