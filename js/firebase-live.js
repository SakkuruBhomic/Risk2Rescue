// ================================================================
// FIREBASE-LIVE.JS — Live Realtime Database & Multi-device Mesh Sync
// ================================================================

class FirebaseLiveService {
  constructor() {
    this.db = null;
    this.isCloudConnected = false;
    this.connectionMode = 'initializing'; // 'cloud', 'mesh', 'offline'
    this.meshChannel = null;
    this.reportListeners = [];
    this.alertListeners = [];
    this.statusListeners = [];

    // Local cached state (pre-populated from APP_DATA when available)
    this.reports = [];
    this.alerts = [];

    this.initMeshChannel();
    this.initFirebase();
  }

  // ---- Cross-tab BroadcastChannel & Local Storage Sync ----
  initMeshChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.meshChannel = new BroadcastChannel('rzi_mesh_sync');
        this.meshChannel.onmessage = (event) => {
          this.handleMeshMessage(event.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    // Load initial offline/mesh reports and alerts from localStorage if present
    try {
      const storedReports = localStorage.getItem('rzi_synced_reports');
      if (storedReports) {
        this.reports = JSON.parse(storedReports);
      } else if (typeof APP_DATA !== 'undefined' && APP_DATA.citizenReports) {
        this.reports = JSON.parse(JSON.stringify(APP_DATA.citizenReports));
      }

      const storedAlerts = localStorage.getItem('rzi_synced_alerts');
      if (storedAlerts) {
        this.alerts = JSON.parse(storedAlerts);
      } else if (typeof APP_DATA !== 'undefined' && APP_DATA.alerts) {
        this.alerts = JSON.parse(JSON.stringify(APP_DATA.alerts));
      }
    } catch (e) {
      console.warn('Error loading cached disaster data:', e);
    }
  }

  ensureInitialData() {
    try {
      if (this.reports.length === 0) {
        const stored = localStorage.getItem('rzi_synced_reports');
        if (stored) {
          this.reports = JSON.parse(stored);
        }
      }
      if (typeof APP_DATA !== 'undefined' && APP_DATA.citizenReports) {
        APP_DATA.citizenReports.forEach(defRep => {
          if (!this.reports.some(r => r.id === defRep.id)) {
            this.reports.push(JSON.parse(JSON.stringify(defRep)));
          }
        });
      }

      if (this.alerts.length === 0) {
        const storedAlerts = localStorage.getItem('rzi_synced_alerts');
        if (storedAlerts) {
          this.alerts = JSON.parse(storedAlerts);
        }
      }
      if (typeof APP_DATA !== 'undefined' && APP_DATA.alerts) {
        APP_DATA.alerts.forEach(defAlt => {
          if (!this.alerts.some(a => a.id === defAlt.id)) {
            this.alerts.push(JSON.parse(JSON.stringify(defAlt)));
          }
        });
      }
    } catch (e) {}
  }

  handleMeshMessage(data) {
    this.ensureInitialData();
    if (!data || !data.type) return;

    if (data.type === 'NEW_REPORT') {
      const exists = this.reports.some(r => r.id === data.payload.id);
      if (!exists) {
        this.reports.unshift(data.payload);
        this.persistLocalCache();
        this.notifyReportListeners(this.reports, { added: data.payload });
      }
    } else if (data.type === 'UPDATE_REPORT') {
      const idx = this.reports.findIndex(r => r.id === data.payload.id);
      if (idx !== -1) {
        this.reports[idx] = { ...this.reports[idx], ...data.payload };
        this.persistLocalCache();
        this.notifyReportListeners(this.reports, { updated: data.payload });
      }
    } else if (data.type === 'NEW_ALERT') {
      const exists = this.alerts.some(a => a.id === data.payload.id);
      if (!exists) {
        this.alerts.unshift(data.payload);
        this.persistLocalCache();
        this.notifyAlertListeners(this.alerts, { added: data.payload });
      }
    }
  }

  // ---- Firebase Cloud Firestore Initialization ----
  initFirebase() {
    const config = getFirebaseConfig();

    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded, falling back to Realtime Mesh Channel.');
      this.setConnectionStatus('mesh', 'Local Realtime Mesh Active');
      return;
    }

    try {
      // Check if default app is already initialized
      let app;
      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.app();
      }

      this.db = firebase.firestore();

      // Enable offline persistence in Firestore if possible
      try {
        this.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
          if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
            console.warn('Firestore persistence warning:', err);
          }
        });
      } catch (err) {
        // ignore multiple tab error
      }

      // Attach real-time cloud listeners
      this.attachCloudListeners(config);
    } catch (error) {
      console.warn('Firebase initialization notice:', error.message);
      this.setConnectionStatus('mesh', 'Local Mesh Active (Add Firebase Keys)');
    }
  }

  attachCloudListeners(config) {
    if (!this.db) return;

    // Listen to Citizen Reports collection
    this.db.collection('citizen_reports')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        const fromServer = snapshot.metadata && !snapshot.metadata.fromCache;
        if (fromServer) {
          this.isCloudConnected = true;
          this.setConnectionStatus('cloud', `Live Cloud Firestore (${config.projectId})`);
        } else if (!this.isCloudConnected) {
          this.setConnectionStatus('mesh', 'Local Mesh Active');
        }

        if (!snapshot.empty) {
          const cloudReports = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            cloudReports.push({ id: doc.id, ...data });
          });
          this.reports = cloudReports;
          this.persistLocalCache();
          this.notifyReportListeners(this.reports);
        } else {
          // If collection is empty and custom config is active, seed once
          if (config.isCustom && this.reports.length > 0 && fromServer) {
            this.seedCloudReports();
          }
        }
      }, (error) => {
        console.warn('Firestore reports listener notice (using mesh sync):', error.message);
        this.isCloudConnected = false;
        this.setConnectionStatus('mesh', 'Local Mesh Active');
      });

    // Listen to Emergency Alerts collection
    this.db.collection('emergency_alerts')
      .orderBy('timestamp', 'desc')
      .limit(30)
      .onSnapshot((snapshot) => {
        const fromServer = snapshot.metadata && !snapshot.metadata.fromCache;
        if (fromServer) {
          this.isCloudConnected = true;
          this.setConnectionStatus('cloud', `Live Cloud Firestore (${config.projectId})`);
        }

        if (!snapshot.empty) {
          const cloudAlerts = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            cloudAlerts.push({ id: doc.id, ...data });
          });
          this.alerts = cloudAlerts;
          this.persistLocalCache();
          this.notifyAlertListeners(this.alerts);
        }
      }, (error) => {
        console.warn('Firestore alerts listener notice:', error.message);
        this.isCloudConnected = false;
        this.setConnectionStatus('mesh', 'Local Mesh Active');
      });

    // Active server ping probe to verify whether backend Firestore is genuinely reachable
    this.checkCloudConnectivity();
  }

  /**
   * Directly probes Cloud Firestore server endpoint to verify genuine connectivity
   */
  async checkCloudConnectivity() {
    if (!this.db) {
      this.isCloudConnected = false;
      this.setConnectionStatus('mesh', 'Local Mesh Active');
      return false;
    }
    try {
      await this.db.collection('citizen_reports').limit(1).get({ source: 'server' });
      this.isCloudConnected = true;
      this.setConnectionStatus('cloud', 'Live Cloud Firestore Connected');
      return true;
    } catch (e) {
      this.isCloudConnected = false;
      this.setConnectionStatus('mesh', 'Local Mesh Active');
      return false;
    }
  }

  setConnectionStatus(mode, label) {
    this.connectionMode = mode;
    this.statusListeners.forEach(fn => {
      try { fn(mode, label); } catch (e) {}
    });
    this.updateDOMIndicator();
  }

  updateDOMIndicator() {
    if (typeof document === 'undefined') return;
    // Citizens operate silently without raw sync-state jargon
    if (document.body && document.body.classList.contains('citizen-page')) return;

    const indicators = document.querySelectorAll('#sync-status-indicator, .sync-status-indicator');
    indicators.forEach(el => {
      const isSynced = this.isCloudConnected;
      el.className = `sync-status-indicator ${isSynced ? 'synced' : 'offline'}`;
      el.title = isSynced
        ? '🟢 Live Cloud Firestore Connected & Synchronized'
        : '⚪ Operating in offline local storage / mesh fallback mode';
      el.innerHTML = `
        <span class="sync-dot"></span>
        <span class="sync-text">${isSynced ? '🟢 Synced' : '⚪ Offline (local only)'}</span>
      `;
    });
  }

  persistLocalCache() {
    try {
      localStorage.setItem('rzi_synced_reports', JSON.stringify(this.reports));
      localStorage.setItem('rzi_synced_alerts', JSON.stringify(this.alerts));
    } catch (e) {}
  }

  // ---- Public Event Subscription Methods ----
  onReports(callback) {
    this.ensureInitialData();
    this.reportListeners.push(callback);
    // Trigger immediately with current state
    if (this.reports.length > 0) {
      callback(this.reports);
    }
  }

  onAlerts(callback) {
    this.ensureInitialData();
    this.alertListeners.push(callback);
    if (this.alerts.length > 0) {
      callback(this.alerts);
    }
  }

  onStatus(callback) {
    this.statusListeners.push(callback);
    callback(this.connectionMode, this.isCloudConnected ? 'Live Cloud Firestore Connected' : 'Local Realtime Mesh Active');
  }

  notifyReportListeners(reports, meta) {
    this.reportListeners.forEach(fn => {
      try { fn(reports, meta); } catch (e) { console.error('Error in report listener:', e); }
    });
  }

  notifyAlertListeners(alerts, meta) {
    this.alertListeners.forEach(fn => {
      try { fn(alerts, meta); } catch (e) { console.error('Error in alert listener:', e); }
    });
  }

  // ---- Write Operations (Citizen & Authority) ----

  /**
   * Submit a new citizen incident report (e.g. from citizen.html)
   */
  async submitCitizenReport(reportData) {
    this.ensureInitialData();
    const id = 'REP-' + Date.now().toString().slice(-6);
    const fullReport = {
      id,
      type: reportData.type || 'Flood',
      severity: reportData.severity || 'High',
      status: 'Pending',
      desc: reportData.desc || '',
      reporter: reportData.reporter || 'Citizen Reporter',
      phone: reportData.phone || '+91-Verified',
      location: reportData.location || 'Kakinada Coastal Sector',
      lat: Number(reportData.lat) || 16.9891,
      lng: Number(reportData.lng) || 82.2475,
      time: 'Just now',
      timestamp: Date.now(),
      upvotes: 1
    };

    // 1. Update local cache & broadcast via mesh
    this.reports.unshift(fullReport);
    this.persistLocalCache();
    this.notifyReportListeners(this.reports, { added: fullReport });

    if (this.meshChannel) {
      this.meshChannel.postMessage({ type: 'NEW_REPORT', payload: fullReport });
    }

    // 2. Write to Firebase Cloud Firestore in background if available
    if (this.db) {
      this.db.collection('citizen_reports').doc(id).set(fullReport).catch(err => {
        console.warn('Saved report to mesh sync (Firestore cloud write pending):', err.message);
      });
    }

    return fullReport;
  }

  /**
   * Authority verifies a report
   */
  async verifyReport(reportId, officerNotes = '') {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return null;

    const updates = {
      id: reportId,
      status: 'Verified',
      officerNotes: officerNotes || 'Confirmed via GIS telemetry and Sentinel-2 satellite anomaly.',
      verifiedAt: new Date().toLocaleTimeString(),
      verifiedTimestamp: Date.now()
    };

    Object.assign(report, updates);
    this.persistLocalCache();
    this.notifyReportListeners(this.reports, { updated: report });

    if (this.meshChannel) {
      this.meshChannel.postMessage({ type: 'UPDATE_REPORT', payload: updates });
    }

    // Write to Firestore in background
    if (this.db) {
      this.db.collection('citizen_reports').doc(reportId).set(updates, { merge: true }).catch(err => {
        console.warn('Firestore report verify update notice:', err.message);
      });
    }

    // Automatically generate and broadcast regional emergency alert
    const newAlert = {
      id: 'ALT-' + Date.now().toString().slice(-4),
      level: report.severity === 'Critical' ? 'CRITICAL' : 'HIGH',
      type: report.type,
      title: `VERIFIED CITIZEN ALERT: ${report.type} at ${report.desc.slice(0, 30)}...`,
      message: `${report.desc} — Verified by Authority Incident Response Commander.`,
      time: 'Just now',
      timestamp: Date.now(),
      area: `Vicinity coordinates [${report.lat.toFixed(2)}, ${report.lng.toFixed(2)}]`,
      confidence: 96,
      sources: ['Citizen Verified', 'NDRF Dispatch', 'Satellite Radar Cross-check'],
      active: true
    };

    await this.broadcastEmergencyAlert(newAlert);
    return report;
  }

  /**
   * Authority rejects/dismisses a report
   */
  async rejectReport(reportId, reason = '') {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return null;

    const updates = {
      id: reportId,
      status: 'Rejected',
      rejectionReason: reason || 'Unsubstantiated condition; dismissed after drone inspection.',
      dismissedAt: new Date().toLocaleTimeString()
    };

    Object.assign(report, updates);
    this.persistLocalCache();
    this.notifyReportListeners(this.reports, { updated: report });

    if (this.meshChannel) {
      this.meshChannel.postMessage({ type: 'UPDATE_REPORT', payload: updates });
    }

    if (this.db) {
      this.db.collection('citizen_reports').doc(reportId).set(updates, { merge: true }).catch(err => {
        console.warn('Firestore reject update notice:', err.message);
      });
    }

    return report;
  }

  /**
   * Push a regional Emergency Alert (triggers instant warning across citizen devices)
   */
  async broadcastEmergencyAlert(alertData) {
    const alertId = alertData.id || ('ALT-' + Date.now().toString().slice(-4));
    const fullAlert = {
      id: alertId,
      level: alertData.level || 'CRITICAL',
      type: alertData.type || 'Emergency Broadcast',
      title: alertData.title || 'REGIONAL EMERGENCY BROADCAST',
      message: alertData.message || alertData.desc || 'Immediate caution advised.',
      time: alertData.time || 'Just now',
      timestamp: alertData.timestamp || Date.now(),
      area: alertData.area || 'All Active Hazard Zones',
      confidence: alertData.confidence || 95,
      sources: alertData.sources || ['Authority Command Center', 'IMD Doppler Radar'],
      active: true
    };

    this.alerts.unshift(fullAlert);
    this.persistLocalCache();
    this.notifyAlertListeners(this.alerts, { added: fullAlert });

    if (this.meshChannel) {
      this.meshChannel.postMessage({ type: 'NEW_ALERT', payload: fullAlert });
    }

    if (this.db) {
      this.db.collection('emergency_alerts').doc(alertId).set(fullAlert).catch(err => {
        console.warn('Firestore emergency alert broadcast notice:', err.message);
      });
    }

    return fullAlert;
  }

  /**
   * Seeds default Indian disaster scenarios into Cloud Firestore
   */
  async seedCloudReports() {
    if (!this.db) return;
    try {
      const batch = this.db.batch();
      const initialReports = (typeof APP_DATA !== 'undefined' && APP_DATA.citizenReports)
        ? APP_DATA.citizenReports
        : [];

      initialReports.forEach(rep => {
        const docRef = this.db.collection('citizen_reports').doc(rep.id);
        batch.set(docRef, { ...rep, timestamp: Date.now() - (Math.random() * 3600000) }, { merge: true });
      });

      const initialAlerts = (typeof APP_DATA !== 'undefined' && APP_DATA.alerts)
        ? APP_DATA.alerts
        : [];

      initialAlerts.forEach(alt => {
        const docRef = this.db.collection('emergency_alerts').doc(alt.id);
        batch.set(docRef, { ...alt, timestamp: Date.now() - (Math.random() * 1800000) }, { merge: true });
      });

      await batch.commit();
      console.log('Successfully seeded initial disaster datasets to Cloud Firestore.');
    } catch (e) {
      console.warn('Could not seed cloud reports:', e.message);
    }
  }
}

// Global Singleton Instance
window.firebaseLive = new FirebaseLiveService();

// Synchronize DOM connectivity indicators on initial load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.firebaseLive) window.firebaseLive.updateDOMIndicator();
    });
  } else {
    setTimeout(() => {
      if (window.firebaseLive) window.firebaseLive.updateDOMIndicator();
    }, 0);
  }
}
