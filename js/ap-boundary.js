// ANDHRA PRADESH OPERATIONAL BOUNDARY ENFORCEMENT
// Ensures all project-generated data is restricted to the AP state border.

class APBoundary {
  constructor() {
    this.boundaryPoly = null;
    this.renderedLayer = null;
    this.ready = false;
    this.init();
  }

  async init() {
    try {
      const response = await fetch('data/andhra_pradesh_boundary.geojson');
      const data = await response.json();
      
      if (data && data.features && data.features.length > 0) {
        // Assume the first feature is the AP boundary
        this.boundaryPoly = data.features[0];
        this.ready = true;
      }
    } catch (e) {
      console.error('[APBoundaryService] Failed to load AP boundary GeoJSON', e);
    }
  }

  isReady() {
    return this.ready && typeof window.turf !== 'undefined';
  }

  /** Render a distinct visual border for AP, keeping basemap visible */
  drawBorder(map) {
    if (!this.ready || !this.boundaryPoly) return;
    
    if (this.renderedLayer) {
      map.removeLayer(this.renderedLayer);
    }

    this.renderedLayer = L.geoJSON(this.boundaryPoly, {
      style: {
        color: '#3b82f6', // subtle blue/cyan outline
        weight: 2.5,
        opacity: 0.85,
        fillColor: 'transparent',
        fillOpacity: 0,
        className: 'ap-boundary-line'
      },
      interactive: false // Should not interfere with clicks
    });

    this.renderedLayer.addTo(map);
  }

  /** Fits the given map to the AP boundary bounding box */
  fitMap(map) {
    if (!this.ready || !this.boundaryPoly) return;
    const layer = L.geoJSON(this.boundaryPoly);
    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  }

  /**
   * Check if a given coordinate is inside AP.
   * @param {Array} coords - [lng, lat]
   * @returns {boolean}
   */
  isPointInside(coords) {
    if (!this.isReady()) return true; // Fail open if data not loaded
    try {
      const pt = window.turf.point(coords);
      return window.turf.booleanPointInPolygon(pt, this.boundaryPoly);
    } catch (e) {
      return true; // fallback
    }
  }

  /**
   * Clips a given GeoJSON polygon to the AP boundary.
   * @param {Object} turfPolygon - Turf polygon feature
   * @returns {Object|null} - Clipped polygon, or null if completely outside
   */
  clipPolygon(turfPolygon) {
    if (!this.isReady()) return turfPolygon; // Fail open
    try {
      const intersection = window.turf.intersect(turfPolygon, this.boundaryPoly);
      return intersection;
    } catch (e) {
      console.warn('[APBoundaryService] Error clipping polygon', e);
      return turfPolygon;
    }
  }
}

window.APBoundaryService = new APBoundary();
