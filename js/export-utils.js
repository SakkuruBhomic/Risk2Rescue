/**
 * ================================================================
 * EXPORT-UTILS.JS — Incident Commander Situation Report (SitRep) Exporter
 * ================================================================
 * RISK2RESCUE PLATFORM
 */

class SitRepExporter {
  constructor() {
    this.reportData = null;
  }

  generateSitRep() {
    const timeNow = new Date().toLocaleString();
    const reportsCount = (window.firebaseLive && window.firebaseLive.reports) ? window.firebaseLive.reports.length : 3;
    const alertsCount = (window.firebaseLive && window.firebaseLive.alerts) ? window.firebaseLive.alerts.length : 4;

    this.reportData = {
      agency: "NDRF / SDMA Incident Command Center",
      operation: "OPERATION TEJA SHIELD — NATIONAL MULTI-HAZARD RESPONSE",
      generatedAt: timeNow,
      classification: "OFFICIAL OPERATIONAL BRIEFING",
      threatSummary: {
        activeHazards: 5,
        prioritySectors: ["Kakinada Coastal Belt, AP", "Guwahati Valley, AS", "Chamoli Ridge, UK"],
        redZonesTotal: 24,
        estimatedPopAtRisk: "385,000 Persons"
      },
      logistics: {
        sheltersActivated: 16,
        totalShelterCapacity: "26,000 Persons",
        currentShelterOccupancy: "14,200 Persons (54.6%)",
        ndrfBattalionsDeployed: 8,
        sdrfBoatTeams: 24
      },
      telemetry: {
        maxWindSpeed: "140 km/h (Doppler Radar)",
        peakStormSurge: "2.8 - 3.8 Meters",
        riverStatus: "Godavari, Krishna & Brahmaputra Exceeding Warning Mark"
      },
      reportsSummary: `${reportsCount} Verified Citizen Reports Triaged`,
      alertsSummary: `${alertsCount} Emergency Broadcasts Dispatched`
    };

    this.showSitRepModal();
  }

  showSitRepModal() {
    let modal = document.getElementById('teja-sitrep-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'teja-sitrep-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.style.zIndex = '10006';
      document.body.appendChild(modal);
    }

    const r = this.reportData;

    modal.innerHTML = `
      <div class="sitrep-modal">
        <div class="sitrep-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">🛡️</span>
              <h2 style="font-size:20px; font-weight:800; color:#38bdf8; margin:0;">
                OPERATIONAL SITUATION REPORT (SITREP)
              </h2>
            </div>
            <div style="font-size:12px; color:#94a3b8; margin-top:4px;">
              ${r.agency} &bull; ${r.operation}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; padding:4px 8px; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; border-radius:4px; font-weight:700; display:inline-block;">
              ${r.classification}
            </div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
              ${r.generatedAt}
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom:16px;">
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;">
            <div style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Active Hazards</div>
            <div style="font-size:20px; font-weight:800; color:#ef4444; margin-top:2px;">${r.threatSummary.activeHazards}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;">
            <div style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Red Zones</div>
            <div style="font-size:20px; font-weight:800; color:#f97316; margin-top:2px;">${r.threatSummary.redZonesTotal}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;">
            <div style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Shelter Capacity</div>
            <div style="font-size:20px; font-weight:800; color:#22c55e; margin-top:2px;">${r.logistics.totalShelterCapacity}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;">
            <div style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Deployed Teams</div>
            <div style="font-size:20px; font-weight:800; color:#38bdf8; margin-top:2px;">${r.logistics.ndrfBattalionsDeployed} BNs</div>
          </div>
        </div>

        <table class="sitrep-table">
          <thead>
            <tr><th>Operational Pillar</th><th>Telemetry Metric / Current Assessment</th><th>Directive Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Atmospheric & Radar</strong></td>
              <td>${r.telemetry.maxWindSpeed} &bull; Deep convective cloud bands</td>
              <td><span style="color:#ef4444; font-weight:700;">Active Tracking</span></td>
            </tr>
            <tr>
              <td><strong>Hydrological Surge</strong></td>
              <td>${r.telemetry.peakStormSurge} &bull; Lowland barrier breach</td>
              <td><span style="color:#ef4444; font-weight:700;">Evacuation Mandate</span></td>
            </tr>
            <tr>
              <td><strong>Shelter & Food Logistics</strong></td>
              <td>${r.logistics.currentShelterOccupancy} occupied across ${r.logistics.sheltersActivated} shelters</td>
              <td><span style="color:#22c55e; font-weight:700;">Sufficient (45.4% Margin)</span></td>
            </tr>
            <tr>
              <td><strong>Search & Rescue</strong></td>
              <td>${r.logistics.sdrfBoatTeams} motorized rescue skiffs deployed</td>
              <td><span style="color:#38bdf8; font-weight:700;">Sectors Patrolled</span></td>
            </tr>
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; pt:12px; border-top:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:12px; color:#94a3b8;">
            Auto-generated by Risk2Rescue Operational Command Suite &bull; v2.0
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary" onclick="window.print()">
              🖨️ Print / Save PDF
            </button>
            <button class="btn btn-glass" onclick="window.sitRepExporter.downloadJSON()">
              📥 Download JSON
            </button>
            <button class="btn btn-glass" onclick="document.getElementById('teja-sitrep-modal').remove()">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
  }

  downloadJSON() {
    if (!this.reportData) return;
    const blob = new Blob([JSON.stringify(this.reportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SitRep-Risk2Rescue-${Date.now()}.json`;
    link.click();
  }
}

// Singleton instance
if (typeof window !== 'undefined') {
  window.sitRepExporter = new SitRepExporter();
}
