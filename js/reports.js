// ================================================================
// REPORTS.JS — Citizen Disaster Reporting & Human Verification
// ================================================================

class CitizenReportManager {
  constructor() {
    this.reports = [...APP_DATA.citizenReports];
    this.reputationDB = {
      '+91-**-****-3421': { score: 92, verifiedCount: 5, falseAlarms: 0 },
      '+91-**-****-8821': { score: 78, verifiedCount: 2, falseAlarms: 0 },
      '+91-**-****-5541': { score: 65, verifiedCount: 1, falseAlarms: 0 },
      '+91-**-****-9921': { score: 50, verifiedCount: 0, falseAlarms: 0 },
      '+91-**-****-1141': { score: 96, verifiedCount: 8, falseAlarms: 0 }
    };
  }

  getPendingReports() {
    const list = (window.firebaseLive && window.firebaseLive.reports && window.firebaseLive.reports.length > 0)
      ? window.firebaseLive.reports
      : this.reports;
    return list.filter(r => r.status === 'Pending' || r.status === 'Reviewing');
  }

  verifyReport(id, officerNotes) {
    // 1. Sync via Firebase Live Service
    if (window.firebaseLive) {
      window.firebaseLive.verifyReport(id, officerNotes);
    }

    const report = this.reports.find(r => r.id === id);
    if (!report) return null;
    report.status = 'Verified';
    report.officerNotes = officerNotes || 'Confirmed via Sentinel-2 satellite imagery and district field inspection team.';
    report.verifiedAt = new Date().toLocaleTimeString();

    // Update reputation
    if (this.reputationDB[report.phone]) {
      this.reputationDB[report.phone].verifiedCount += 1;
      this.reputationDB[report.phone].score = Math.min(100, this.reputationDB[report.phone].score + 4);
    }

    // Trigger Regional Alert Broadcast
    this.broadcastRegionalAlert(report);
    return report;
  }

  rejectReport(id, reason) {
    if (window.firebaseLive) {
      window.firebaseLive.rejectReport(id, reason);
    }

    const report = this.reports.find(r => r.id === id);
    if (!report) return null;
    report.status = 'Rejected';
    report.rejectionReason = reason || 'Unsubstantiated or localized non-critical condition.';

    // Adjust reputation
    if (this.reputationDB[report.phone]) {
      this.reputationDB[report.phone].falseAlarms += 1;
      this.reputationDB[report.phone].score = Math.max(10, this.reputationDB[report.phone].score - 10);
    }
    return report;
  }

  broadcastRegionalAlert(report) {
    const newAlert = {
      id: 'ALT-' + Date.now().toString().slice(-4),
      level: report.severity === 'Critical' ? 'CRITICAL' : 'HIGH',
      type: report.type,
      title: `VERIFIED CITIZEN ALERT: ${report.type} at ${report.desc.slice(0, 30)}...`,
      time: 'Just now',
      area: `Vicinity coordinates [${Number(report.lat).toFixed(2)}, ${Number(report.lng).toFixed(2)}]`,
      confidence: 94,
      sources: ['Citizen Verified', 'Officer Dispatch', 'Satellite Cross-check'],
      active: true
    };
    APP_DATA.alerts.unshift(newAlert);
  }
}

const reportManager = new CitizenReportManager();
