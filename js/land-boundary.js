// ================================================================
// LAND BOUNDARY SERVICE & COASTLINE CLIPPING (Turf.js)
// Loads India land boundary GeoJSON and clips hazard polygons
// so they do not extend over sea/ocean.
// ================================================================

(function(window) {
  'use strict';

  const LandBoundaryService = {
    data: null,
    promise: null,
    clippedCache: new Map(),

    async load() {
      if (this.data) return this.data;
      if (this.promise) return this.promise;

      this.promise = fetch('data/india_land_boundary.geojson')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status} loading india_land_boundary.geojson`);
          return res.json();
        })
        .then(geojson => {
          this.data = geojson;
          if (geojson && geojson.features) {
            geojson.features.forEach(f => {
              if (!f.bbox && window.turf) {
                try { f.bbox = window.turf.bbox(f); } catch (e) {}
              }
            });
          }
          console.log(`[LandBoundaryService] India land boundary GeoJSON loaded successfully (${geojson.features ? geojson.features.length : 0} features)`);
          // Automatically re-render active hazard zones to reflect clipped geometry
          try {
            if (window.hazardEngine) {
              window.hazardEngine.invalidateCache();
              if (window.hazardEngine.activeKey) {
                window.hazardEngine.render(window.hazardEngine.activeKey, true);
              }
            }
            if (window.mapApp && typeof window.mapApp.drawRiskZones === 'function') {
              window.mapApp.drawRiskZones();
            }
            if (window.authMapInstance && typeof window.authMapInstance.drawRiskZones === 'function') {
              window.authMapInstance.drawRiskZones();
            }
          } catch(e) {
            console.warn('[LandBoundaryService] Re-render error after load:', e);
          }
          return geojson;
        })
        .catch(err => {
          console.warn('[LandBoundaryService] Failed to load india_land_boundary.geojson:', err);
          return null;
        });

      return this.promise;
    },

    /**
     * Clips an organic polygon ring against the loaded land boundary.
     * @param {Array<[number, number]>} coords - [[lng, lat], ...] ring
     * @param {Object} options - { name, hazardType, lat, lng, radiusMeters }
     * @returns {Object} GeoJSON geometry (Polygon or MultiPolygon)
     */
    clipPolygonCoords(coords, options = {}) {
      const { name = 'zone', hazardType = 'cyclone', lat = 0, lng = 0, radiusMeters = 0 } = options;
      const cacheKey = `${name}_${hazardType}_${lat.toFixed(5)}_${lng.toFixed(5)}_${radiusMeters}`;

      if (this.clippedCache.has(cacheKey)) {
        return this.clippedCache.get(cacheKey);
      }

      const fallbackGeometry = {
        type: "Polygon",
        coordinates: [coords]
      };

      if (!window.turf || !this.data || !this.data.features || !this.data.features.length) {
        return fallbackGeometry;
      }

      try {
        const rawPoly = window.turf.polygon([coords]);
        const zoneBbox = window.turf.bbox(rawPoly);

        // Find candidate land features intersecting zone bbox
        const candidates = this.data.features.filter(f => {
          const b = f.bbox;
          if (!b) return true;
          return !(b[2] < zoneBbox[0] || b[0] > zoneBbox[2] || b[3] < zoneBbox[1] || b[1] > zoneBbox[3]);
        });

        if (!candidates.length) {
          console.warn(`[LandBoundaryService] No land polygon intersects bounding box for ${name}`);
          this.clippedCache.set(cacheKey, fallbackGeometry);
          return fallbackGeometry;
        }

        let clipped = null;
        for (let i = 0; i < candidates.length; i++) {
          try {
            const isect = window.turf.intersect(rawPoly, candidates[i]);
            if (isect) {
              clipped = !clipped ? isect : window.turf.union(clipped, isect);
            }
          } catch (clipErr) {
            console.warn(`[LandBoundaryService] Error intersecting ${name} with land feature:`, clipErr);
          }
        }

        if (!clipped || !clipped.geometry) {
          console.warn(`[LandBoundaryService] Intersection returned null for ${name} (possible ocean center). Falling back to original.`);
          this.clippedCache.set(cacheKey, fallbackGeometry);
          return fallbackGeometry;
        }

        const resultGeometry = clipped.geometry;
        this.clippedCache.set(cacheKey, resultGeometry);
        return resultGeometry;
      } catch (err) {
        console.warn(`[LandBoundaryService] Exception during clipping for ${name}:`, err);
        return fallbackGeometry;
      }
    }
  };

  window.LandBoundaryService = LandBoundaryService;

  // Auto-init load on script execution
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => LandBoundaryService.load());
    } else {
      LandBoundaryService.load();
    }
  }
})(window);
