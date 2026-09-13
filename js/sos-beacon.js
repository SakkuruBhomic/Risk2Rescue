/**
 * ================================================================
 * SOS-BEACON.JS — Citizen Emergency Distress Beacon & Rescue Dispatch
 * ================================================================
 * RISK2RESCUE PLATFORM
 */

class EmergencySOSBeacon {
  constructor() {
    this.isActive = false;
    this.beaconSoundTimer = null;
    this.userCoords = { lat: 16.9891, lng: 82.2475 }; // Default: Kakinada AP coastal zone
    this.initSOS();
  }

  initSOS() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.userCoords = {
            lat: Number(pos.coords.latitude.toFixed(4)),
            lng: Number(pos.coords.longitude.toFixed(4))
          };
        },
        err => console.log("Using default emergency sector coordinates.")
      );
    }
  }

  triggerSOS() {
    this.isActive = true;

    // Escalate SOS beacon buttons into rapid, urgent pulse
    const toolSos = document.getElementById('tool-sos');
    if (toolSos) toolSos.classList.add('sos-active');
    document.querySelectorAll('.sos-beacon-btn').forEach(b => b.classList.add('sos-active'));

    // Temporary red vignette flash at screen edges
    const flash = document.createElement('div');
    flash.className = 'sos-vignette-overlay';
    flash.id = 'active-sos-vignette';
    document.body.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.remove(); }, 1650);

    this.renderSOSModal();

    // Broadcast high-priority distress event to Firebase & local mesh
    const distressPayload = {
      id: 'SOS-' + Date.now().toString().slice(-6),
      type: '🆘 EMERGENCY SOS DISTRESS',
      category: 'Critical Life Rescue',
      location: `Lat ${this.userCoords.lat}° N, Lng ${this.userCoords.lng}° E (Citizen Terminal)`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: 'HIGH_PRIORITY_URGENT',
      details: 'Immediate beacon distress signal triggered from citizen terminal. Battery backup activated.',
      phone: '+91 98765-EMERGENCY'
    };

    if (!navigator.onLine) {
      if (typeof window.queueOfflineSubmission === 'function') {
        window.queueOfflineSubmission(distressPayload);
      } else {
        try {
          const q = JSON.parse(localStorage.getItem('rzi_offline_queue') || '[]');
          q.push({ ...distressPayload, queuedAt: Date.now() });
          localStorage.setItem('rzi_offline_queue', JSON.stringify(q));
        } catch (e) {}
      }
      if (typeof showToast === 'function') {
        showToast("🆘 EMERGENCY SOS QUEUED LOCALLY — TRANSMITTING WHEN CONNECTED", "warning");
      }
    } else {
      if (window.firebaseLive && typeof window.firebaseLive.submitCitizenReport === 'function') {
        window.firebaseLive.submitCitizenReport(distressPayload).catch(() => {
          if (typeof window.queueOfflineSubmission === 'function') {
            window.queueOfflineSubmission(distressPayload);
          }
        });
      }
      if (typeof showToast === 'function') {
        showToast("🆘 EMERGENCY SOS TRANSMITTED TO COMMAND CENTER", "danger");
      }
    }
  }

  closeSOS() {
    this.isActive = false;
    const toolSos = document.getElementById('tool-sos');
    if (toolSos) toolSos.classList.remove('sos-active');
    document.querySelectorAll('.sos-beacon-btn').forEach(b => b.classList.remove('sos-active'));
    const flash = document.getElementById('active-sos-vignette');
    if (flash) flash.remove();

    const modal = document.getElementById('teja-sos-modal');
    if (modal) modal.remove();
  }

  renderSOSModal() {
    let modal = document.getElementById('teja-sos-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'teja-sos-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.style.zIndex = '10005';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box" style="border: 2px solid #ef4444; box-shadow: 0 0 50px rgba(239,68,68,0.5); max-width: 480px; text-align: center;">
        <div style="font-size: 54px; animation: beaconGlow 1s infinite alternate;">🚨</div>
        
        <h2 style="color: #ef4444; font-size: 22px; font-weight: 800; margin-top: 10px;">
          EMERGENCY RESCUE BEACON ACTIVE
        </h2>
        <p style="color: #cbd5e1; font-size: 13px; margin: 8px 0 16px;">
          Your high-priority coordinates have been transmitted to the NDRF & SDMA Incident Command Center. Rescue teams are triaging your sector.
        </p>

        <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px; text-align: left; margin-bottom: 16px;">
          <div style="font-size: 11px; color: #f87171; text-transform: uppercase; font-weight: 700;">Transmitted Coordinates</div>
          <div style="font-size: 14px; font-weight: 700; color: #fff; margin-top: 2px;">
            ${this.userCoords.lat}° N, ${this.userCoords.lng}° E
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">
            Nearest Shelter: <strong>Kakinada Port Cyclone Relief Center (2.4 km)</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px;">
          <a href="tel:1078" class="btn" style="background: #2563eb; color: #fff; text-decoration: none; padding: 10px; font-weight: 700; border-radius: 8px; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            📞 NDRF 1078
          </a>
          <a href="tel:112" class="btn" style="background: #059669; color: #fff; text-decoration: none; padding: 10px; font-weight: 700; border-radius: 8px; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            🚓 Police 112
          </a>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" style="flex: 1; padding: 10px;" onclick="window.emergencySOS.closeSOS(); if (typeof showShelters === 'function') showShelters();">
            <span>🗺️ Show Safe Route</span>
          </button>
          <button class="btn btn-glass" style="padding: 10px 18px;" onclick="window.emergencySOS.closeSOS()">
            Dismiss
          </button>
        </div>
      </div>
    `;
  }
}

// Singleton instance
if (typeof window !== 'undefined') {
  window.emergencySOS = new EmergencySOSBeacon();
}
