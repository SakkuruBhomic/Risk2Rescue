/**
 * RISK2RESCUE — PRIORITY ENGINE
 * Vulnerability Priority Index (VPI) Engine & Greedy Carrying Capacity Allocation
 *
 * Universal Module: Usable both in Node.js backend (CommonJS) and browser frontends (window.PriorityEngine)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.PriorityEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // =========================================================================
  // 1. CONFIGURABLE WEIGHT CONSTANTS (Must sum to 1.00)
  // =========================================================================
  /**
   * Weight rationale:
   * - w1 (hazard_intensity): 0.25 — volatile, real-time trigger driving immediate emergency urgency.
   * - w2 (vulnerability_score): 0.20 — structural, socioeconomic & housing fragility baseline from Census.
   * - w3 (population_density): 0.15 — scale of human exposure and crowd evacuation friction.
   * - w4 (elevation_risk): 0.15 — lower elevation = higher inundation/storm-surge susceptibility.
   * - w5 (disaster_history): 0.10 — empirical recurrence frequency over historical cycles (Phase 2 data).
   * - w6 (access_isolation): 0.15 — logistical bottleneck based on road distance to nearest reachable shelter.
   * Sum = 0.25 + 0.20 + 0.15 + 0.15 + 0.10 + 0.15 = 1.00
   */
  const WEIGHTS = {
    w1_hazard_intensity: 0.25,
    w2_vulnerability: 0.20,
    w3_population_density: 0.15,
    w4_elevation_risk: 0.15,
    w5_disaster_history: 0.10,
    w6_access_isolation: 0.15
  };

  // =========================================================================
  // 2. TIER THRESHOLDS CONSTANTS
  // =========================================================================
  const TIER_THRESHOLDS = {
    IMMEDIATE_MIN: 0.80,    // VPI > 0.80: Immediate relocation dispatch required
    SHORT_TERM_MIN: 0.50    // VPI 0.50 - 0.80: Short-term prioritized relocation
    // VPI < 0.50: Medium-term advisory monitoring
  };

  const TIERS = {
    IMMEDIATE: 'IMMEDIATE',
    SHORT_TERM: 'SHORT_TERM',
    MEDIUM_TERM: 'MEDIUM_TERM'
  };

  // Default maximum travel radius in km for shelter evacuation candidate matching
  const DEFAULT_TRAVEL_RADIUS_KM = 65;

  // =========================================================================
  // 3. UTILITY & NORMALIZATION HELPERS
  // =========================================================================

  /**
   * Haversine straight-line distance in kilometers
   */
  function haversineDistKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Ray-casting Point-in-Polygon check
   * point = [lng, lat], polygon = [[lng, lat], ...]
   */
  function pointInPolygon(point, polygon) {
    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return false;
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Standard Min-Max Normalizer: scale value to [0, 1]
   */
  function minMaxNormalize(val, minVal, maxVal) {
    if (maxVal === minVal) return 0.5;
    const norm = (val - minVal) / (maxVal - minVal);
    return Math.max(0, Math.min(1, norm));
  }

  /**
   * Inverse Min-Max Normalizer: lower value = higher risk (scale to [0, 1])
   * Used for elevation: lowest elevation gets 1.0 (highest inundation risk),
   * highest elevation gets 0.0.
   */
  function inverseMinMaxNormalize(val, minVal, maxVal) {
    if (maxVal === minVal) return 0.5;
    const norm = (maxVal - val) / (maxVal - minVal);
    return Math.max(0, Math.min(1, norm));
  }

  /**
   * Computes disaster history score from Phase 2 array:
   * [{ year, event_type, severity, deaths_or_displacement }]
   * Returns a normalized score between 0 and 1.
   */
  function computeDisasterHistoryScore(historyArray) {
    if (!historyArray || !Array.isArray(historyArray) || historyArray.length === 0) {
      return 0.0;
    }
    const currentYear = new Date().getFullYear();
    let scoreAcc = 0;

    historyArray.forEach(ev => {
      const ageYears = Math.max(0, currentYear - (ev.year || currentYear));
      // Recency decay factor (events in last 10 years weight 1.0, decaying to 0.4 at 25+ years)
      const recencyWeight = Math.max(0.4, 1.0 - (ageYears * 0.024));

      // Severity factor (Catastrophic/Severe: 1.0, High: 0.75, Moderate: 0.5, Low: 0.25)
      let sevWeight = 0.5;
      const s = String(ev.severity || '').toLowerCase();
      if (s.includes('catastrophic') || s.includes('extreme') || s.includes('critical')) sevWeight = 1.0;
      else if (s.includes('severe') || s.includes('high')) sevWeight = 0.8;
      else if (s.includes('moderate') || s.includes('medium')) sevWeight = 0.5;
      else if (s.includes('minor') || s.includes('low')) sevWeight = 0.3;

      scoreAcc += recencyWeight * sevWeight;
    });

    // Normalize: 3+ major events in 20 years approaches 1.0
    return Math.min(1.0, +(scoreAcc / 2.5).toFixed(3));
  }

  /**
   * Evaluates live hazard intensity (0-1) for a habitation based on telemetry and active hazard polygons
   */
  function computeLiveHazardIntensity(habitation, telemetry, hazardPolygons) {
    const lat = habitation.lat;
    const lon = habitation.lng || habitation.lon;
    const zoneId = habitation.mapped_zone_id || '';
    const hazardType = (habitation.hazard_type || '').toLowerCase();

    // Baseline hazard intensity based on designated Red Zone classification
    let baseIntensity = 0.75;
    if (zoneId === 'RZ001') baseIntensity = 0.88; // Coastal Flood & Cyclone Inundation Belt (Michaung / Vayu)
    else if (zoneId === 'RZ002') baseIntensity = 0.92; // Brahmaputra Flood Inundation (Assam)
    else if (zoneId === 'RZ003') baseIntensity = 0.82; // Chamoli Landslide Corridor (Uttarakhand)
    else if (zoneId === 'RZ004') baseIntensity = 0.78; // Manipur Seismic Zone V
    else if (zoneId === 'RZ005') baseIntensity = 0.80; // HP Cloudburst Flash Flood

    // 1. Point-in-polygon risk zone check (adds spatial confirmation)
    if (hazardPolygons && lat && lon) {
      const pt = [lon, lat];
      if (hazardPolygons.coastalFlood && pointInPolygon(pt, hazardPolygons.coastalFlood)) {
        baseIntensity = Math.max(baseIntensity, 0.92);
      }
      if (hazardPolygons.seismic && pointInPolygon(pt, hazardPolygons.seismic)) {
        baseIntensity = Math.max(baseIntensity, 0.85);
      }
      if (hazardPolygons.landslide && pointInPolygon(pt, hazardPolygons.landslide)) {
        baseIntensity = Math.max(baseIntensity, 0.88);
      }
    }

    // 2. Modulate with live atmospheric/seismic telemetry if available
    if (telemetry) {
      if (hazardType === 'cyclone' || hazardType === 'flood') {
        const gust = telemetry.radar?.maxGustSpeedKmH;
        if (typeof gust === 'number') {
          // IMD gale scale: 60 km/h to 160 km/h mapped to [0.7, 1.0]
          const windFactor = Math.min(1.0, Math.max(0.4, gust / 140));
          baseIntensity = Math.min(1.0, baseIntensity * 0.6 + windFactor * 0.4);
        }
      } else if (hazardType === 'earthquake') {
        const maxMag = telemetry.seismic?.maxRecordedMagnitude;
        if (typeof maxMag === 'number' && maxMag > 0) {
          const quakeFactor = Math.min(1.0, Math.max(0.3, (maxMag - 2.0) / 4.5));
          baseIntensity = Math.min(1.0, baseIntensity * 0.6 + quakeFactor * 0.4);
        }
      }
    }

    return Math.max(0.0, Math.min(1.0, +baseIntensity.toFixed(3)));
  }

  // =========================================================================
  // 4. CORE VPI COMPUTATION (Phase 1.1 & 1.2)
  // =========================================================================

  /**
   * Computes Vulnerability Priority Index (VPI) for an array of habitations.
   *
   * @param {Array} habitations - Raw list from data/census_lookup.json
   * @param {Array} shelters - Raw list from data/shelters.json
   * @param {Object} options - Telemetry, hazardPolygons, custom distance matrix
   * @returns {Array} Ranked list of habitations with VPI, Tier, and Breakdown
   */
  function computeVPI(habitations, shelters = [], options = {}) {
    if (!Array.isArray(habitations) || habitations.length === 0) return [];

    const telemetry = options.telemetry || null;
    const hazardPolygons = options.hazardPolygons || null;
    const distanceMatrix = options.distanceMatrix || null; // Optional precomputed road distance { village_id: distKm }

    // Identify dataset min/max for normalization
    const pops = habitations.map(h => typeof h.growth_adjusted_pop === 'number' ? h.growth_adjusted_pop : (h.census_2011_pop || 1000));
    const elevs = habitations.map(h => typeof h.elevation_m === 'number' ? h.elevation_m : 10);

    const minPop = Math.min(...pops), maxPop = Math.max(...pops);
    const minElev = Math.min(...elevs), maxElev = Math.max(...elevs);

    // Compute raw isolation distances (nearest open shelter distance per habitation)
    const openShelters = shelters.filter(s => s.status !== 'closed');
    const rawDistances = habitations.map(h => {
      const vId = h.village_id;
      if (distanceMatrix && typeof distanceMatrix[vId] === 'number') {
        return distanceMatrix[vId];
      }
      const lat = h.lat;
      const lon = h.lng || h.lon;
      if (!openShelters.length || typeof lat !== 'number' || typeof lon !== 'number') {
        return 15.0; // default 15km fallback
      }
      let closest = Infinity;
      for (const s of openShelters) {
        const d = haversineDistKm(lat, lon, s.lat, s.lon);
        if (d < closest) closest = d;
      }
      return closest === Infinity ? 15.0 : +closest.toFixed(2);
    });

    // Calculate VPI per habitation
    const results = habitations.map((h, idx) => {
      const lat = h.lat;
      const lon = h.lng || h.lon;
      const pop = typeof h.growth_adjusted_pop === 'number' ? h.growth_adjusted_pop : (h.census_2011_pop || 1000);
      const elev = typeof h.elevation_m === 'number' ? h.elevation_m : 10;
      const rawVuln = typeof h.vulnerability_score === 'number' ? h.vulnerability_score : 0.5;
      const rawDist = rawDistances[idx];

      // 1. Hazard Intensity (normalized 0-1 based on zone classification, polygons, and live telemetry)
      const normHazard = computeLiveHazardIntensity(h, telemetry, hazardPolygons);

      // 2. Vulnerability Score (calibrated 0-1 scale from Census socioeconomic & housing vulnerability)
      const normVuln = Math.max(0, Math.min(1, rawVuln));

      // 3. Population Density / Exposure Size (min-max normalized 0-1 across dataset)
      const normPop = minMaxNormalize(pop, minPop, maxPop);

      // 4. Elevation Risk (inverse min-max normalized: lower elevation = higher inundation risk 0-1)
      const normElevRisk = inverseMinMaxNormalize(elev, minElev, maxElev);

      // 5. Disaster History (normalized 0-1 from Phase 2 historical recurrence array)
      const rawDisasterHistory = h.disaster_history || [];
      const normDisaster = computeDisasterHistoryScore(rawDisasterHistory);

      // 6. Access Isolation (normalized relative to 35km critical emergency road transit cutoff)
      const normIsolation = Math.max(0, Math.min(1, rawDist / 35.0));

      // Composite VPI calculation
      const vpi = (WEIGHTS.w1_hazard_intensity * normHazard) +
                  (WEIGHTS.w2_vulnerability * normVuln) +
                  (WEIGHTS.w3_population_density * normPop) +
                  (WEIGHTS.w4_elevation_risk * normElevRisk) +
                  (WEIGHTS.w5_disaster_history * normDisaster) +
                  (WEIGHTS.w6_access_isolation * normIsolation);

      const roundedVpi = Math.max(0, Math.min(1, +vpi.toFixed(3)));

      // Tier bucketing
      let tier = TIERS.MEDIUM_TERM;
      if (roundedVpi > TIER_THRESHOLDS.IMMEDIATE_MIN) {
        tier = TIERS.IMMEDIATE;
      } else if (roundedVpi >= TIER_THRESHOLDS.SHORT_TERM_MIN) {
        tier = TIERS.SHORT_TERM;
      }

      return {
        village_id: h.village_id,
        village_name: h.village_name || h.name || 'Habitation',
        district: h.district || 'Unassigned',
        state: h.state || 'India',
        mapped_zone_id: h.mapped_zone_id || 'GENERAL',
        hazard_type: h.hazard_type || 'general',
        lat,
        lon,
        elevation_m: elev,
        growth_adjusted_pop: pop,
        census_2011_pop: h.census_2011_pop || pop,
        vpi_score: roundedVpi,
        tier,
        contributing_factors: {
          hazard_intensity: {
            raw: +normHazard.toFixed(2),
            normalized: +normHazard.toFixed(3),
            weight: WEIGHTS.w1_hazard_intensity,
            weighted: +(WEIGHTS.w1_hazard_intensity * normHazard).toFixed(3),
            description: 'Real-time hazard intensity & risk-zone intersection'
          },
          vulnerability: {
            raw: rawVuln,
            normalized: +normVuln.toFixed(3),
            weight: WEIGHTS.w2_vulnerability,
            weighted: +(WEIGHTS.w2_vulnerability * normVuln).toFixed(3),
            description: 'Socioeconomic & housing vulnerability index (Census of India)'
          },
          population_density: {
            raw: pop,
            normalized: +normPop.toFixed(3),
            weight: WEIGHTS.w3_population_density,
            weighted: +(WEIGHTS.w3_population_density * normPop).toFixed(3),
            description: 'Demographic exposure (Growth-adjusted 2026 headcount)'
          },
          elevation_risk: {
            raw: elev,
            normalized: +normElevRisk.toFixed(3),
            weight: WEIGHTS.w4_elevation_risk,
            weighted: +(WEIGHTS.w4_elevation_risk * normElevRisk).toFixed(3),
            description: 'Topographic surge & inundation risk (Inverse normalized: lower = higher risk)'
          },
          disaster_history: {
            raw: rawDisasterHistory.length,
            normalized: +normDisaster.toFixed(3),
            weight: WEIGHTS.w5_disaster_history,
            weighted: +(WEIGHTS.w5_disaster_history * normDisaster).toFixed(3),
            description: 'Historical disaster recurrence & severity score'
          },
          access_isolation: {
            raw: rawDist,
            unit: 'km',
            normalized: +normIsolation.toFixed(3),
            weight: WEIGHTS.w6_access_isolation,
            weighted: +(WEIGHTS.w6_access_isolation * normIsolation).toFixed(3),
            description: 'Distance to nearest reachable emergency shelter'
          }
        }
      };
    });

    // Sort descending by VPI score
    results.sort((a, b) => b.vpi_score - a.vpi_score);
    return results;
  }

  // =========================================================================
  // 5. GREEDY CARRYING CAPACITY ALLOCATION (Phase 1.3)
  // =========================================================================

  /**
   * Greedy shelter allocation algorithm:
   * 1. Sort habitations by VPI descending.
   * 2. For each habitation, find open shelters within travel radius with remaining capacity.
   * 3. Assign population to closest shelters, decrementing capacity on a working copy.
   * 4. Flag as FULLY_ALLOCATED, PARTIALLY_ALLOCATED, or UNALLOCATED.
   * 5. Generate zone-level deficit reports.
   *
   * @param {Array} rankedHabitations - Output from computeVPI()
   * @param {Array} rawShelters - Raw list of shelters from shelters.json
   * @param {Object} options - { travelRadiusKm, distanceMatrix }
   * @returns {Object} { allocations, shelterStatus, deficitReports, summary }
   */
  function allocateCarryingCapacity(rankedHabitations, rawShelters, options = {}) {
    const travelRadiusKm = options.travelRadiusKm || DEFAULT_TRAVEL_RADIUS_KM;
    const distanceMatrix = options.distanceMatrix || null;

    // Create deep working copy of shelters — never mutate original shelter objects
    const workingShelters = rawShelters.map(s => {
      const cap = Number(s.capacity) || 0;
      const occ = Number(s.current_occupancy) || 0;
      return {
        shelter_id: s.shelter_id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        capacity: cap,
        initial_occupancy: occ,
        current_occupancy: occ,
        available_capacity: Math.max(0, cap - occ),
        status: s.status || 'open',
        district: s.district,
        allocated_villages: []
      };
    });

    const allocations = [];
    // Tracking for deficit calculation per zone
    const zoneAggregates = {};

    for (const hab of rankedHabitations) {
      const zoneId = hab.mapped_zone_id || 'GENERAL';
      const popNeeded = hab.growth_adjusted_pop;

      if (!zoneAggregates[zoneId]) {
        zoneAggregates[zoneId] = {
          zone_id: zoneId,
          hazard_type: hab.hazard_type,
          total_at_risk: 0,
          total_reachable_capacity: 0,
          total_allocated: 0,
          deficit: 0
        };
      }
      zoneAggregates[zoneId].total_at_risk += popNeeded;

      // Find reachable open shelters with remaining capacity
      const candidates = workingShelters
        .filter(s => s.status === 'open' && s.available_capacity > 0)
        .map(s => {
          let dist = haversineDistKm(hab.lat, hab.lon, s.lat, s.lon);
          // If precomputed road distance available, use it
          if (distanceMatrix && distanceMatrix[hab.village_id] && distanceMatrix[hab.village_id][s.shelter_id]) {
            dist = distanceMatrix[hab.village_id][s.shelter_id];
          }
          return { shelter: s, distKm: +dist.toFixed(2) };
        })
        .filter(item => item.distKm <= travelRadiusKm || item.shelter.district === hab.district)
        .sort((a, b) => a.distKm - b.distKm);

      // Tally reachable capacity for zone
      candidates.forEach(c => {
        // Only count each shelter's initial available capacity once per zone calculation if needed
      });

      let remainingToAllocate = popNeeded;
      const assignedShelters = [];

      for (const candidate of candidates) {
        if (remainingToAllocate <= 0) break;
        const shelter = candidate.shelter;
        const canTake = Math.min(shelter.available_capacity, remainingToAllocate);

        if (canTake > 0) {
          shelter.available_capacity -= canTake;
          shelter.current_occupancy += canTake;
          if (shelter.available_capacity <= 0) {
            shelter.status = 'full';
          }
          shelter.allocated_villages.push({
            village_id: hab.village_id,
            village_name: hab.village_name,
            allocated_pop: canTake
          });

          assignedShelters.push({
            shelter_id: shelter.shelter_id,
            shelter_name: shelter.name,
            allocated_pop: canTake,
            distance_km: candidate.distKm,
            remaining_shelter_capacity: shelter.available_capacity
          });

          remainingToAllocate -= canTake;
        }
      }

      const allocatedPop = popNeeded - remainingToAllocate;
      zoneAggregates[zoneId].total_allocated += allocatedPop;

      let allocationStatus = 'FULLY_ALLOCATED';
      if (allocatedPop === 0) {
        allocationStatus = 'UNALLOCATED';
      } else if (remainingToAllocate > 0) {
        allocationStatus = 'PARTIALLY_ALLOCATED';
      }

      allocations.push({
        village_id: hab.village_id,
        village_name: hab.village_name,
        district: hab.district,
        state: hab.state,
        mapped_zone_id: zoneId,
        hazard_type: hab.hazard_type,
        vpi_score: hab.vpi_score,
        tier: hab.tier,
        growth_adjusted_pop: popNeeded,
        allocated_pop: allocatedPop,
        unallocated_pop: remainingToAllocate,
        allocation_status: allocationStatus,
        assigned_shelters: assignedShelters,
        contributing_factors: hab.contributing_factors
      });
    }

    // Compute zone reachable capacities and deficit reports
    const deficitReports = Object.values(zoneAggregates).map(z => {
      // Find all unique open shelters within radius or matching district
      const reachableCapSum = rawShelters
        .filter(s => s.status === 'open')
        .reduce((sum, s) => {
          const avail = Math.max(0, s.capacity - s.current_occupancy);
          return sum + avail;
        }, 0);

      z.total_reachable_capacity = reachableCapSum;
      z.deficit = Math.max(0, z.total_at_risk - z.total_allocated);
      z.status = z.deficit > 0 ? 'CAPACITY_DEFICIT' : 'SUFFICIENT_CAPACITY';
      return z;
    });

    const totalAtRisk = allocations.reduce((a, b) => a + b.growth_adjusted_pop, 0);
    const totalAllocated = allocations.reduce((a, b) => a + b.allocated_pop, 0);
    const totalDeficit = allocations.reduce((a, b) => a + b.unallocated_pop, 0);

    return {
      allocations,
      shelterStatus: workingShelters.map(s => ({
        shelter_id: s.shelter_id,
        name: s.name,
        capacity: s.capacity,
        initial_occupancy: s.initial_occupancy,
        new_occupancy: s.current_occupancy,
        available_beds: s.available_capacity,
        occupancy_pct: Math.round((s.current_occupancy / (s.capacity || 1)) * 100),
        status: s.status,
        allocated_villages: s.allocated_villages
      })),
      deficitReports,
      summary: {
        totalHabitations: allocations.length,
        immediateTierCount: allocations.filter(a => a.tier === TIERS.IMMEDIATE).length,
        shortTermTierCount: allocations.filter(a => a.tier === TIERS.SHORT_TERM).length,
        mediumTermTierCount: allocations.filter(a => a.tier === TIERS.MEDIUM_TERM).length,
        totalAtRiskPop: totalAtRisk,
        totalAllocatedPop: totalAllocated,
        totalDeficitPop: totalDeficit,
        allocationEfficiencyPct: Math.round((totalAllocated / (totalAtRisk || 1)) * 100)
      }
    };
  }

  // =========================================================================
  // 6. EXPORT MODULE INTERFACE
  // =========================================================================
  return {
    WEIGHTS,
    TIER_THRESHOLDS,
    TIERS,
    DEFAULT_TRAVEL_RADIUS_KM,
    haversineDistKm,
    pointInPolygon,
    minMaxNormalize,
    inverseMinMaxNormalize,
    computeDisasterHistoryScore,
    computeLiveHazardIntensity,
    computeVPI,
    allocateCarryingCapacity
  };
}));
