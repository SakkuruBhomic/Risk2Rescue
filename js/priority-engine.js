/**
 * RISK2RESCUE — PRIORITY ENGINE (Deterministic 6-Factor Model)
 *
 * Universal Module: Usable both in Node.js backend (CommonJS) and browser frontends.
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

  const WEIGHTS = {
    hazardSeverity: 0.25,
    populationAtRisk: 0.20,
    vulnerability: 0.15,
    immediateLifeRisk: 0.15,
    responseUrgency: 0.15,
    accessibility: 0.10
  };

  const TIERS = {
    CRITICAL: { min: 90, max: 100 },
    HIGH: { min: 75, max: 89 },
    MODERATE: { min: 50, max: 74 },
    LOW: { min: 0, max: 49 }
  };

  function normalize(val, min, max) {
    if (max === min) return 0;
    let norm = (val - min) / (max - min);
    return Math.max(0, Math.min(100, norm * 100));
  }

  function calculateHazardSeverity(incident) {
    // 0-100
    // Example fields mapped to hazard intensity
    let score = 0;
    if (incident.hazardSeverityRaw !== undefined) {
      score = incident.hazardSeverityRaw;
    } else {
      // Default mappings if raw score missing
      const hazardStr = String(incident.hazardType || incident.hazard_type || '').toLowerCase();
      if (hazardStr.includes('cyclone') || hazardStr.includes('hurricane')) score = 85;
      else if (hazardStr.includes('flood') || hazardStr.includes('tsunami')) score = 75;
      else if (hazardStr.includes('landslide')) score = 80;
      else if (hazardStr.includes('earthquake')) score = 90;
      else if (hazardStr.includes('fire')) score = 85;
      else score = 50; // generic hazard
    }
    return Math.max(0, Math.min(100, score));
  }

  function calculatePopulationRisk(incident) {
    const pop = Number(incident.populationAtRisk || incident.population || incident.growth_adjusted_pop || 0);
    // Band mapping based on standard scales
    if (pop > 10000) return 100;
    if (pop > 5000) return 85;
    if (pop > 1000) return 70;
    if (pop > 500) return 50;
    if (pop > 50) return 30;
    if (pop > 0) return 10;
    return 0;
  }

  function calculateVulnerability(incident) {
    let score = incident.vulnerabilityRaw !== undefined ? incident.vulnerabilityRaw : 50; 
    // Add logic for elderly, isolated, etc if data exists
    if (incident.elderlyPct) score += incident.elderlyPct * 100 * 0.3;
    if (incident.isolated === true) score += 20;
    if (incident.structuralVulnerability) score += incident.structuralVulnerability;
    return Math.max(0, Math.min(100, score));
  }

  function calculateImmediateLifeRisk(incident) {
    if (incident.immediateLifeRiskRaw !== undefined) return incident.immediateLifeRiskRaw;
    let score = 10; // Base life risk in disaster
    if (incident.personTrapped === true) score = 100;
    if (incident.lifeThreatening === true) score = 100;
    if (incident.rapidlyRisingWater) score += 40;
    if (incident.criticalInfrastructureFailure) score += 30;
    return Math.max(0, Math.min(100, score));
  }

  function calculateResponseUrgency(incident) {
    if (incident.responseUrgencyRaw !== undefined) return incident.responseUrgencyRaw;
    let score = 50; // Default moderate urgency
    if (incident.etaMins !== undefined) {
      if (incident.etaMins <= 15) score = 90; // Need to act now because it's happening
      else if (incident.etaMins <= 60) score = 75;
      else if (incident.etaMins <= 180) score = 50;
      else score = 30;
    }
    if (incident.escalating === true) score += 20;
    return Math.max(0, Math.min(100, score));
  }

  function calculateAccessibility(incident) {
    // HIGHER score = easier/faster response. 
    // We normalize eta: 0 ETA = 100 Accessibility, 3+ hr ETA = 0 Accessibility
    if (incident.accessibilityRaw !== undefined) return incident.accessibilityRaw;
    if (incident.noUsableRoute) return 0;
    const etaMins = incident.travelTimeMins || 60;
    if (etaMins < 15) return 100;
    if (etaMins < 30) return 80;
    if (etaMins < 60) return 60;
    if (etaMins < 120) return 30;
    return 10;
  }

  function assignPriorityLevel(score) {
    if (score >= TIERS.CRITICAL.min) return 'CRITICAL';
    if (score >= TIERS.HIGH.min) return 'HIGH';
    if (score >= TIERS.MODERATE.min) return 'MODERATE';
    return 'LOW';
  }

  function calculatePriority(incident) {
    const fA = calculateHazardSeverity(incident);
    const fB = calculatePopulationRisk(incident);
    const fC = calculateVulnerability(incident);
    const fD = calculateImmediateLifeRisk(incident);
    const fE = calculateResponseUrgency(incident);
    const fF = calculateAccessibility(incident);

    let rawScore = (fA * WEIGHTS.hazardSeverity) +
                   (fB * WEIGHTS.populationAtRisk) +
                   (fC * WEIGHTS.vulnerability) +
                   (fD * WEIGHTS.immediateLifeRisk) +
                   (fE * WEIGHTS.responseUrgency) +
                   (fF * WEIGHTS.accessibility);

    let overrideApplied = false;
    // EMERGENCY OVERRIDE
    if (fD >= 90 && fA >= 80) {
      if (rawScore < 90) {
        rawScore = 90;
        overrideApplied = true;
      }
    } else if (incident.lifeThreatening === true || incident.personTrapped === true) {
      if (rawScore < 90) {
        rawScore = 90;
        overrideApplied = true;
      }
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    const reasons = [];
    if (overrideApplied) reasons.push("Emergency life-safety override applied.");
    if (fD >= 80) reasons.push("High immediate life-safety risk.");
    if (fA >= 80) reasons.push("Extreme hazard severity.");
    if (fB >= 80) reasons.push("Large exposed population.");
    if (fE >= 80) reasons.push("Rapidly increasing hazard / High response urgency.");

    let recommendedAction = "Monitor situation.";
    if (finalScore >= 90) recommendedAction = "Immediate evacuation / rescue deployment.";
    else if (finalScore >= 75) recommendedAction = "Prepare for priority relocation.";
    else if (finalScore >= 50) recommendedAction = "Standby and stage resources.";

    return {
      score: finalScore,
      level: assignPriorityLevel(finalScore),
      overrideApplied,
      factors: {
        hazardSeverity: Math.round(fA),
        populationAtRisk: Math.round(fB),
        vulnerability: Math.round(fC),
        immediateLifeRisk: Math.round(fD),
        responseUrgency: Math.round(fE),
        accessibility: Math.round(fF)
      },
      reasons,
      recommendedAction
    };
  }

  function rankIncidents(incidents) {
    const scored = incidents.map(inc => {
      const p = calculatePriority(inc);
      return {
        ...inc,
        priorityScore: p.score,
        priorityLevel: p.level,
        factorScores: p.factors,
        overrideApplied: p.overrideApplied,
        reasons: p.reasons,
        recommendedAction: p.recommendedAction
      };
    });

    scored.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      // Tie-breaking
      if (b.factorScores.immediateLifeRisk !== a.factorScores.immediateLifeRisk)
        return b.factorScores.immediateLifeRisk - a.factorScores.immediateLifeRisk;
      if (b.factorScores.responseUrgency !== a.factorScores.responseUrgency)
        return b.factorScores.responseUrgency - a.factorScores.responseUrgency;
      if (b.factorScores.vulnerability !== a.factorScores.vulnerability)
        return b.factorScores.vulnerability - a.factorScores.vulnerability;
      // Accessibility (higher means easier, so lower accessibility might need to be resolved earlier, but user said "Lower ETA / better response accessibility", meaning higher accessibility is preferred in tie break)
      return b.factorScores.accessibility - a.factorScores.accessibility;
    });

    scored.forEach((inc, idx) => { inc.rank = idx + 1; });
    return scored;
  }

  function evaluateRelocationCandidates(incident, shelters, distanceMatrix) {
    const pop = Number(incident.populationAtRisk || incident.population || incident.growth_adjusted_pop || 0);
    const candidates = [];

    shelters.forEach(s => {
      const totalCapacity = Number(s.capacity || s.max_capacity || 0);
      const currentOccupancy = Number(s.current_occupancy || s.occupancy || 0);
      const availableCapacity = totalCapacity - currentOccupancy;
      
      const distInfo = distanceMatrix && distanceMatrix[incident.id] ? distanceMatrix[incident.id][s.id || s.shelter_id] : null;

      let status = "REJECTED";
      let reason = "";

      if (availableCapacity < pop) {
        reason = `Insufficient capacity (Avail: ${availableCapacity}, Needed: ${pop})`;
      } else if (distInfo === undefined || distInfo === null) {
        reason = "No practical route found.";
      } else {
        status = "RECOMMENDED";
      }

      candidates.push({
        shelter_id: s.id || s.shelter_id,
        shelter_name: s.name || s.shelter_name,
        availableCapacity,
        requiredCapacity: pop,
        distance: distInfo,
        status,
        reason
      });
    });

    // Sort recommended first, then by closest distance
    candidates.sort((a, b) => {
      if (a.status !== b.status) return a.status === "RECOMMENDED" ? -1 : 1;
      return (a.distance || Infinity) - (b.distance || Infinity);
    });

    return candidates;
  }

  return {
    WEIGHTS,
    TIER_THRESHOLDS: TIERS,
    calculatePriority,
    rankIncidents,
    evaluateRelocationCandidates
  };
}));
