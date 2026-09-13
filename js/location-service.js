/**
 * ================================================================
 * LOCATION-SERVICE.JS — Citizen Geolocation & Risk Zone Resolver
 * ================================================================
 * RISK2RESCUE PLATFORM
 *
 * Provides:
 *  - GPS detection via Geolocation API (secure context / localhost)
 *  - Nominatim reverse-geocoding (free, no API key needed)
 *  - Static AP district fallback list with lat/lng centroids
 *  - Risk zone check via /api/risk-zone backend endpoint
 */

const RZILocationService = (() => {

  // ---------------------------------------------------------------
  // All 26 Andhra Pradesh districts with representative centroids
  // ---------------------------------------------------------------
  const AP_DISTRICTS = [
    { name: 'Alluri Sitharama Raju', lat: 17.9500, lng: 82.3500 },
    { name: 'Anakapalli',            lat: 17.6910, lng: 82.9980 },
    { name: 'Ananthapuramu',         lat: 14.6819, lng: 77.6006 },
    { name: 'Annamayya',             lat: 14.0489, lng: 78.7519 },
    { name: 'Bapatla',               lat: 15.9042, lng: 80.4672 },
    { name: 'Chittoor',              lat: 13.2172, lng: 79.1003 },
    { name: 'East Godavari',         lat: 17.3616, lng: 81.7755 },
    { name: 'Eluru',                 lat: 16.7107, lng: 81.0952 },
    { name: 'Guntur',                lat: 16.3067, lng: 80.4365 },
    { name: 'Kakinada',              lat: 16.9891, lng: 82.2475 },
    { name: 'Konaseema',             lat: 16.8150, lng: 81.9600 },
    { name: 'Krishna',               lat: 16.6000, lng: 80.7500 },
    { name: 'Kurnool',               lat: 15.8281, lng: 78.0373 },
    { name: 'Nandyal',               lat: 15.4786, lng: 78.4836 },
    { name: 'Nellore',               lat: 14.4426, lng: 79.9865 },
    { name: 'NTR (Vijayawada)',      lat: 16.5062, lng: 80.6480 },
    { name: 'Palnadu',               lat: 16.0600, lng: 79.6900 },
    { name: 'Parvathipuram Manyam',  lat: 18.7850, lng: 83.4280 },
    { name: 'Prakasam',              lat: 15.3540, lng: 79.5743 },
    { name: 'Sri Balaji (Tirupati)', lat: 13.6288, lng: 79.4192 },
    { name: 'Sri Sathya Sai',        lat: 14.1650, lng: 77.2930 },
    { name: 'Srikakulam',            lat: 18.2949, lng: 83.8938 },
    { name: 'Visakhapatnam',         lat: 17.6868, lng: 83.2185 },
    { name: 'Vizianagaram',          lat: 18.1066, lng: 83.3956 },
    { name: 'West Godavari',         lat: 16.9174, lng: 81.3369 },
    { name: 'YSR Kadapa',            lat: 14.4674, lng: 78.8241 },
  ];

  // ---------------------------------------------------------------
  // Key centers, mandals & coastal habitations from Census dataset
  // ---------------------------------------------------------------
  const AP_MANDALS = [
    { name: 'Srikakulam Urban', district: 'Srikakulam', lat: 18.2970, lng: 83.8965 },
    { name: 'Palasa-Kasibugga', district: 'Srikakulam', lat: 18.7667, lng: 84.4167 },
    { name: 'Sompeta Coastal Reach', district: 'Srikakulam', lat: 18.9333, lng: 84.6000 },
    { name: 'Kalingapatnam Port Corridor', district: 'Srikakulam', lat: 18.3364, lng: 84.1291 },
    { name: 'Vizianagaram Urban', district: 'Vizianagaram', lat: 18.1124, lng: 83.4074 },
    { name: 'Bhogapuram Coastal Belt', district: 'Vizianagaram', lat: 18.0267, lng: 83.4933 },
    { name: 'Bobbili', district: 'Vizianagaram', lat: 18.5667, lng: 83.3667 },
    { name: 'Visakhapatnam Urban Agglomeration', district: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
    { name: 'Bheemunipatnam (Bheemili)', district: 'Visakhapatnam', lat: 17.8913, lng: 83.4542 },
    { name: 'Anakapalle', district: 'Visakhapatnam', lat: 17.6913, lng: 83.0039 },
    { name: 'Gajuwaka Industrial Belt', district: 'Visakhapatnam', lat: 17.6990, lng: 83.2080 },
    { name: 'Kakinada Urban', district: 'East Godavari', lat: 16.9891, lng: 82.2475 },
    { name: 'Rajahmundry Urban Agglomeration', district: 'East Godavari', lat: 17.0005, lng: 81.8040 },
    { name: 'Amalapuram (Konaseema Delta)', district: 'East Godavari', lat: 16.5787, lng: 82.0061 },
    { name: 'Tallarevu Mandal', district: 'East Godavari', lat: 16.7800, lng: 82.2700 },
    { name: 'Uppada Coastal Belt', district: 'East Godavari', lat: 17.0800, lng: 82.3300 },
    { name: 'Eluru Urban', district: 'West Godavari', lat: 16.7107, lng: 81.0952 },
    { name: 'Bhimavaram Urban', district: 'West Godavari', lat: 16.5449, lng: 81.5212 },
    { name: 'Narasapuram Coastal Hub', district: 'West Godavari', lat: 16.4411, lng: 81.6917 },
    { name: 'Tanuku', district: 'West Godavari', lat: 16.7562, lng: 81.6811 },
    { name: 'Vijayawada Urban Agglomeration', district: 'Krishna', lat: 16.5062, lng: 80.6480 },
    { name: 'Machilipatnam Coastal Urban', district: 'Krishna', lat: 16.1875, lng: 81.1389 },
    { name: 'Gudivada', district: 'Krishna', lat: 16.4410, lng: 80.9926 },
    { name: 'Avanigadda / Diviseema Island', district: 'Krishna', lat: 16.0200, lng: 80.9200 },
    { name: 'Guntur Urban', district: 'Guntur', lat: 16.3067, lng: 80.4365 },
    { name: 'Bapatla Coastal Sector', district: 'Guntur', lat: 15.9042, lng: 80.4674 },
    { name: 'Tenali', district: 'Guntur', lat: 16.2430, lng: 80.6400 },
    { name: 'Nizampatnam Fishing Harbour', district: 'Guntur', lat: 15.9083, lng: 80.6722 },
    { name: 'Repalle Coastal Reach', district: 'Guntur', lat: 16.0200, lng: 80.8500 },
    { name: 'Ongole Urban', district: 'Prakasam', lat: 15.5057, lng: 80.0499 },
    { name: 'Chirala Coastal Urban', district: 'Prakasam', lat: 15.8246, lng: 80.3522 },
    { name: 'Kandukur', district: 'Prakasam', lat: 15.2165, lng: 79.9042 },
    { name: 'Kothapatnam Coastal Reach', district: 'Prakasam', lat: 15.4500, lng: 80.1200 },
    { name: 'Nellore Urban', district: 'Sri Potti Sriramulu Nellore', lat: 14.4426, lng: 79.9865 },
    { name: 'Kavali Coastal Urban', district: 'Sri Potti Sriramulu Nellore', lat: 14.9132, lng: 79.9928 },
    { name: 'Gudur', district: 'Sri Potti Sriramulu Nellore', lat: 14.1463, lng: 79.8504 },
    { name: 'Dugarajapatnam / Pulicat Sector', district: 'Sri Potti Sriramulu Nellore', lat: 13.9850, lng: 80.1500 },
    { name: 'Kadapa Urban', district: 'Y.S.R. (Kadapa)', lat: 14.4673, lng: 78.8242 },
    { name: 'Proddatur Urban', district: 'Y.S.R. (Kadapa)', lat: 14.7500, lng: 78.5500 },
    { name: 'Pulivendula', district: 'Y.S.R. (Kadapa)', lat: 14.4167, lng: 78.2333 },
    { name: 'Rajampet (Cheyyeru Basin)', district: 'Y.S.R. (Kadapa)', lat: 14.1833, lng: 79.1500 },
    { name: 'Kurnool Urban', district: 'Kurnool', lat: 15.8281, lng: 78.0373 },
    { name: 'Nandyal Urban', district: 'Kurnool', lat: 15.4800, lng: 78.4800 },
    { name: 'Adoni Urban', district: 'Kurnool', lat: 15.6300, lng: 77.2800 },
    { name: 'Yemmiganur', district: 'Kurnool', lat: 15.7333, lng: 77.4833 },
    { name: 'Anantapur Urban', district: 'Anantapur', lat: 14.6819, lng: 77.6006 },
    { name: 'Hindupur Urban', district: 'Anantapur', lat: 13.8290, lng: 77.4925 },
    { name: 'Dharmavaram', district: 'Anantapur', lat: 14.4140, lng: 77.7210 },
    { name: 'Guntakal Rail Hub', district: 'Anantapur', lat: 15.1700, lng: 77.3800 },
    { name: 'Tirupati Urban Agglomeration', district: 'Chittoor', lat: 13.6288, lng: 79.4192 },
    { name: 'Chittoor Urban', district: 'Chittoor', lat: 13.2172, lng: 79.1003 },
    { name: 'Madanapalle Urban', district: 'Chittoor', lat: 13.5500, lng: 78.5000 },
    { name: 'Srikalahasti', district: 'Chittoor', lat: 13.7500, lng: 79.7000 }
  ];

  /** Return static AP district list for fallback dropdown */
  function getAPDistricts() {
    return [...AP_DISTRICTS];
  }

  /** Return static AP mandals and key centers */
  function getAPMandals() {
    return [...AP_MANDALS];
  }

  /** Return all Andhra Pradesh static locations (districts + mandals/centers) */
  function getAllLocations() {
    const list = [];
    AP_DISTRICTS.forEach(d => {
      list.push({
        name: d.name,
        region: 'Andhra Pradesh',
        lat: d.lat,
        lng: d.lng,
        type: 'District',
        risk: 'GREEN'
      });
    });
    AP_MANDALS.forEach(m => {
      list.push({
        name: m.name,
        region: m.district,
        lat: m.lat,
        lng: m.lng,
        type: 'Mandal / Center',
        risk: 'GREEN'
      });
    });
    return list;
  }

  /**
   * Detect GPS position.
   * @returns Promise<{lat, lng, accuracy}>
   */
  function detectLocation() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by your browser.' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        (err) => {
          const messages = {
            1: 'Location permission was denied. Please enable it in your browser settings or search your district manually below.',
            2: 'Your location could not be determined. GPS signal unavailable.',
            3: 'Location request timed out. Please try again or search manually.',
          };
          reject({ code: err.code, message: messages[err.code] || 'Unknown location error.' });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  /**
   * Reverse-geocode lat/lng → readable place using Nominatim.
   * @returns Promise<{display, district, state, city}>
   */
  async function reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const resp = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'RedZoneIntelligence/2.0' }
      });
      if (!resp.ok) throw new Error('Nominatim error');
      const data = await resp.json();
      const addr  = data.address || {};
      const district = addr.county || addr.state_district || addr.city || addr.town || addr.village || 'Unknown District';
      const state    = addr.state || 'Andhra Pradesh';
      const city     = addr.city || addr.town || addr.village || addr.hamlet || district;
      return { display: `${city}, ${state}`, district, state, city, raw: addr };
    } catch (_) {
      return {
        display: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
        district: 'Unknown', state: 'Andhra Pradesh', city: 'Your Location', raw: {}
      };
    }
  }

  /**
   * Check hazard risk zone via backend.
   * @returns Promise<{riskLevel, riskColor, zone, shelters, advisory, district}>
   */
  async function checkRiskZone(lat, lng) {
    try {
      const resp = await fetch('/api/risk-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      try {
        localStorage.setItem('rzi_risk_snapshot', JSON.stringify({ lat, lng, risk: data, time: Date.now() }));
      } catch (e) {}
      return data;
    } catch (_) {
      // Fall back to last cached risk assessment
      try {
        const cached = localStorage.getItem('rzi_risk_snapshot');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.risk) {
            return parsed.risk;
          }
        }
      } catch (e) {}

      // Default fallback for coastal coordinates
      if (Math.abs(lat - 17.08) < 0.25 && Math.abs(lng - 82.33) < 0.25) {
        return {
          riskLevel: 'Red Zone',
          riskColor: '#ef4444',
          zone: 'Uppada Coastal Inundation Belt',
          shelters: [
            { id: 'SS001', name: 'Kakinada Port Relief Camp', lat: 16.9891, lng: 82.2475, dist_km: '13.4' },
            { id: 'SS002', name: 'Visakhapatnam Port Shelter', lat: 17.6868, lng: 83.2185, dist_km: '110.2' }
          ],
          advisory: 'Severe cyclone & coastal surge risk. Move to designated high-ground shelters.',
          district: 'Kakinada'
        };
      }

      return {
        riskLevel: 'Caution',
        riskColor: '#f59e0b',
        zone: 'Monitored Coastal Sector',
        shelters: [],
        advisory: 'Offline snapshot mode. Follow local safety protocols and shelter markers.',
        district: 'Andhra Pradesh'
      };
    }
  }

  /**
   * Build URL to citizen.html with location query params.
   */
  function buildCitizenUrl(lat, lng, place) {
    const params = new URLSearchParams({
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      place: place
    });
    return `citizen.html?${params.toString()}`;
  }

  /**
   * Parse location params from citizen.html URL.
   * @returns {lat, lng, place} or null
   */
  function parseLocationParams() {
    const p = new URLSearchParams(window.location.search);
    const lat = parseFloat(p.get('lat'));
    const lng = parseFloat(p.get('lng'));
    const place = p.get('place') ? decodeURIComponent(p.get('place')) : null;
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, place: place || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E` };
    }
    return null;
  }

  const service = {
    getAPDistricts,
    getAPMandals,
    getAllLocations,
    detectLocation,
    reverseGeocode,
    checkRiskZone,
    buildCitizenUrl,
    parseLocationParams
  };

  if (typeof window !== 'undefined') {
    window.RZILocationService = service;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }

  return service;

})();
