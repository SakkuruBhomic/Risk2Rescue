// ================================================================
// WINDY-INTEGRATION.JS — Shared Windy.com Weather Radar Controller
// Used by both citizen.html and authority.html
// Uses iframe embed (embed.windy.com/embed2.html) — no API key needed
// ================================================================
class WindyIntegrationController {
  constructor(options = {}) {
    this.currentLat = options.lat || 16.99;
    this.currentLon = options.lon || 82.25;
    this.currentPlace = options.place || 'Kakinada, AP';
    this.activeMode = 'gis';
    this.timelineOffsetHours = 0;
    this._lastAutoHazard = null;

    this.mapId = options.mapId || (document.getElementById('authority-map') ? 'authority-map' : 'map');
    this.btnGis = document.getElementById('btn-mode-gis');

    this.init();
  }

  init() {
    // Mode toggle (Active GIS map)
    if (this.btnGis) {
      this.btnGis.addEventListener('click', () => this.setMode('gis'));
    }

    // Initial point forecast fetch
    this.fetchPointForecast(this.currentLat, this.currentLon);
  }

  setMode(mode) {
    this.activeMode = 'gis';
    if (this.btnGis) this.btnGis.classList.add('active');

    const mapEl = document.getElementById(this.mapId) || document.getElementById('authority-map') || document.getElementById('map');
    if (mapEl) mapEl.style.display = '';

    if (typeof showToast === 'function') {
      showToast('🗺️ GIS Risk Map: Active Hazard Corridors', 'info');
    }
  }

  setTimelineHourOffset(offsetHours) {
    this.timelineOffsetHours = offsetHours;
  }

  onLocationChanged(lat, lon, place) {
    this.currentLat = lat;
    this.currentLon = lon;
    if (place) this.currentPlace = place;
    if (typeof flyToCitizenMap === 'function') {
      flyToCitizenMap(lat, lon);
    } else if (window.authMapInstance && window.authMapInstance.flyToLocation) {
      window.authMapInstance.flyToLocation(lat, lon);
    }
    this.fetchPointForecast(lat, lon);
  }

  async fetchPointForecast(lat, lon) {
    const chipSourceTag = document.getElementById('chip-source-tag');
    try {
      const resp = await fetch('/api/windy/point-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: Number(lat),
          lon: Number(lon),
          model: 'ecmwf'
        })
      });

      if (!resp.ok) {
        if (chipSourceTag) {
          chipSourceTag.textContent = 'Data unavailable';
          chipSourceTag.title = 'Upstream meteorological API error';
          chipSourceTag.style.borderColor = 'rgba(239,68,68,0.4)';
          chipSourceTag.style.color = '#f87171';
        }
        return;
      }

      const data = await resp.json();
      if (!data || data.status === 'unavailable' || !data.summary) {
        if (chipSourceTag) {
          chipSourceTag.textContent = 'Data unavailable';
          chipSourceTag.title = data?.error || 'Meteorological stream offline';
          chipSourceTag.style.borderColor = 'rgba(239,68,68,0.4)';
          chipSourceTag.style.color = '#f87171';
        }
        return;
      }

      if (chipSourceTag) {
        const src = (data.source || '').toLowerCase();
        if (src.includes('open-meteo')) {
          chipSourceTag.textContent = 'Live: Open-Meteo';
          chipSourceTag.title = 'Authentic live weather observations via Open-Meteo ECMWF/GFS models';
          chipSourceTag.style.borderColor = 'rgba(56,189,248,0.4)';
          chipSourceTag.style.color = '#38bdf8';
        } else if (src.includes('windy')) {
          chipSourceTag.textContent = 'Live: Windy API';
          chipSourceTag.title = 'Windy Point Forecast API stream';
          chipSourceTag.style.borderColor = 'rgba(34,197,94,0.4)';
          chipSourceTag.style.color = '#22c55e';
        } else {
          chipSourceTag.textContent = 'Live API';
          chipSourceTag.title = data.source || 'Live sensor stream';
        }
      }

      const s = data.summary;

      const chipTemp = document.getElementById('chip-temp');
      const chipWind = document.getElementById('chip-wind');
      const chipIcon = document.getElementById('chip-icon');
      const chipRisk = document.getElementById('chip-risk');

      if (chipTemp) chipTemp.textContent = `${s.currentTempC}°C`;
      if (chipWind) chipWind.textContent = `${s.maxGustKmh} km/h`;
      if (chipIcon) {
        chipIcon.textContent = s.isExtremeRain ? '⛈️' : s.isSevereWind ? '🌪️' : '🌤️';
      }

      // On citizen portal, chipRisk is managed by point-in-polygon hazard containment logic
      const isCitizenPortal = document.body && document.body.classList.contains('citizen-page');
      if (chipRisk && !isCitizenPortal) {
        chipRisk.className = 'windy-risk-chip';
        if (s.overallRisk === 'RED') {
          chipRisk.textContent = 'RED ZONE';
          chipRisk.classList.add('red');
        } else if (s.overallRisk === 'ORANGE') {
          chipRisk.textContent = 'HIGH RISK';
          chipRisk.classList.add('orange');
        } else {
          chipRisk.textContent = 'SAFE';
          chipRisk.classList.add('green');
        }
      }

      const inspWind = document.getElementById('insp-wind');
      const inspRisk = document.getElementById('insp-risk');
      const inspSurge = document.getElementById('insp-surge');
      if (inspWind) inspWind.textContent = `${s.maxGustKmh} km/h`;
      if (inspRisk) {
        const tierNames = { RED: 'Active Hazard Zone', ORANGE: 'High Alert Zone', YELLOW: 'Moderate Risk Zone', GREEN: 'Safe Zone' };
        inspRisk.textContent = tierNames[s.overallRisk] || `${s.overallRisk} ZONE`;
        inspRisk.style.color = s.overallRisk === 'RED' ? '#ef4444' : s.overallRisk === 'ORANGE' ? '#f97316' : s.overallRisk === 'YELLOW' ? '#eab308' : '#22c55e';
      }
      if (inspSurge) {
        const estSurge = Math.max(0.8, (s.maxPrecipPerHourMm * 0.12 + (s.maxGustKmh / 140) * 2.2)).toFixed(1);
        inspSurge.textContent = `${estSurge} meters`;
      }

      if (s.isSevereWind || s.isExtremeRain) {
        const banner = document.getElementById('citizen-emergency-banner');
        const bTitle = document.getElementById('cit-banner-title');
        const bMsg = document.getElementById('cit-banner-msg');
        if (banner && bTitle && bMsg) {
          bTitle.textContent = `Severe Meteorological Warning — ${this.currentPlace}`;
          bMsg.textContent = s.advisoryMessage;
          banner.style.display = 'block';
        }
      }

    } catch (err) {
      console.warn('Point Forecast fetch error:', err);
    }
  }
}

if (typeof window !== 'undefined') {
  window.WindyIntegrationController = WindyIntegrationController;
}
