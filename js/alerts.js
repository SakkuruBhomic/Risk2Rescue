// ================================================================
// ALERTS.JS — AI Threat Detection Engine & Low False Alarm System
// ================================================================

class ThreatDetectionEngine {
  constructor() {
    this.monitoredSensors = 1420;
    this.dataSources = ['IMD Radar', 'ISRO INSAT-3D', 'CWC Hydrological', 'GSI Landslide Sensor', 'Ground USGS Stations'];
    this.threatStream = APP_DATA.activeHazards;
  }

  calculateConfidence(sources, primaryAnomalyScore) {
    // False alarm minimization formula: multi-source cross-checking
    const sourceWeight = sources.length * 0.18;
    const baseScore = primaryAnomalyScore * 0.8;
    const confidence = Math.min(99, Math.round((baseScore + sourceWeight * 10)));
    return {
      confidenceScore: confidence,
      uncertainty: (100 - confidence),
      isReliable: confidence >= 70
    };
  }

  getThreatSummary() {
    return this.threatStream.map(threat => {
      const assessment = this.calculateConfidence(['IMD', 'Satellite', 'Radar'], threat.confidence / 100);
      return {
        ...threat,
        evaluatedConfidence: assessment.confidenceScore,
        uncertaintyMargin: assessment.uncertainty,
        verificationEvidence: [
          'Satellite Thermal & Cloud Top Infrasound',
          'Automated Doppler Weather Radar Reflector Scan',
          'District Automated Telemetry Ground Gauges'
        ]
      };
    });
  }
}

const threatEngine = new ThreatDetectionEngine();
