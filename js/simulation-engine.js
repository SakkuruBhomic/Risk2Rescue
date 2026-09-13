/**
 * ================================================================
 * SIMULATION-ENGINE.JS — Disaster Drill Engine & Web Audio Siren
 * ================================================================
 * RISK2RESCUE PLATFORM
 */

class DisasterSimulationEngine {
  constructor() {
    this.isActive = false;
    this.currentStep = 0;
    this.scenario = null;
    this.drillTimer = null;
    this.audioCtx = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.isSirenSounding = false;
    this.casualtiesPrevented = 0;
    this.simulatedTimeMinutes = 0;

    this.steps = [
      { name: "Advisory Phase", label: "Advisory", desc: "Doppler radar & CWC telemetry identify escalating hazard signature.", riskLevel: "ELEVATED" },
      { name: "Red Zone Evacuation Order", label: "Evacuation", desc: "Mandatory evacuation ordered for all lowlands & coastal sectors.", riskLevel: "HIGH" },
      { name: "Surge & Peak Impact Window", label: "Peak Impact", desc: "Maximum storm surge / water flow peak. First responders secured.", riskLevel: "CRITICAL" },
      { name: "Rescue & Shelter Containment", label: "Rescue", desc: "NDRF and boat rescue units active. Safe shelter containment verified.", riskLevel: "MITIGATION" },
      { name: "All-Clear & Recovery", label: "Recovery", desc: "Hazard core dissipated. Damage assessment and relief distribution active.", riskLevel: "STABILIZED" }
    ];

    this.initAudioContext();
  }

  initAudioContext() {
    // Lazy initialize on first interaction to comply with browser audio policies
    const setupAudio = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      document.removeEventListener('click', setupAudio);
    };
    document.addEventListener('click', setupAudio, { once: true });
  }

  toggleSiren() {
    if (this.isSirenSounding) {
      this.stopSiren();
    } else {
      this.startSiren();
    }
    this.updateSirenUI();
  }

  startSiren() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // Create two-tone warble siren
      this.sirenOsc = this.audioCtx.createOscillator();
      this.sirenGain = this.audioCtx.createGain();

      this.sirenOsc.type = 'sawtooth';
      this.sirenOsc.frequency.setValueAtTime(550, this.audioCtx.currentTime);

      // Modulate frequency between 550Hz and 880Hz
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      lfo.frequency.value = 1.2; // 1.2 Hz cycle
      lfoGain.gain.value = 220; // Swing +/- 220Hz

      lfo.connect(this.sirenOsc.frequency);
      lfo.start();

      this.sirenGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime); // Soft, non-ear-splitting volume

      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.audioCtx.destination);
      this.sirenOsc.start();

      this.isSirenSounding = true;
      this.lfoRef = lfo;
      if (typeof showToast === 'function') {
        showToast("🚨 Emergency Warning Siren Active", "danger");
      }
    } catch (e) {
      console.warn("Web Audio Siren error:", e);
    }
  }

  stopSiren() {
    try {
      if (this.sirenOsc) {
        this.sirenOsc.stop();
        this.sirenOsc.disconnect();
        this.sirenOsc = null;
      }
      if (this.lfoRef) {
        this.lfoRef.stop();
        this.lfoRef.disconnect();
        this.lfoRef = null;
      }
      this.isSirenSounding = false;
    } catch (e) {
      console.warn("Error stopping siren:", e);
    }
  }

  playWarningChime() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const chimeNotes = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad
      chimeNotes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(this.audioCtx.currentTime + idx * 0.12);
        osc.stop(this.audioCtx.currentTime + idx * 0.12 + 0.65);
      });
    } catch (e) {
      console.warn("Chime error:", e);
    }
  }

  startDrill(scenario) {
    this.isActive = true;
    this.currentStep = 0;
    this.scenario = scenario || { name: "National Rapid Response Drill", habitationsAtRisk: 28 };
    this.casualtiesPrevented = 0;
    this.simulatedTimeMinutes = 0;

    this.renderDrillBanner();
    this.playWarningChime();

    // Auto-advance timeline ticker every 8 seconds
    if (this.drillTimer) clearInterval(this.drillTimer);
    this.drillTimer = setInterval(() => {
      this.simulatedTimeMinutes += 30;
      this.casualtiesPrevented += Math.floor(Math.random() * 800 + 450);
      this.updateDrillStats();
    }, 4000);

    if (typeof showToast === 'function') {
      showToast(`🎮 Simulation Drill Started: ${this.scenario.name}`, "info");
    }
  }

  stopDrill() {
    this.isActive = false;
    this.stopSiren();
    if (this.drillTimer) clearInterval(this.drillTimer);
    const banner = document.getElementById('teja-drill-banner');
    if (banner) banner.remove();

    if (typeof showToast === 'function') {
      showToast("⏹️ Simulation Drill Concluded", "info");
    }
  }

  advanceStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.playWarningChime();
      if (this.currentStep === 1) {
        this.startSiren();
      } else if (this.currentStep === 4) {
        this.stopSiren();
      }
      this.updateDrillBanner();
    } else {
      this.stopDrill();
    }
  }

  renderDrillBanner() {
    let banner = document.getElementById('teja-drill-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'teja-drill-banner';
      banner.className = 'drill-banner';
      document.body.appendChild(banner);
    }
    this.updateDrillBanner();
  }

  updateDrillBanner() {
    const banner = document.getElementById('teja-drill-banner');
    if (!banner) return;

    const step = this.steps[this.currentStep];
    const phaseFlowHtml = this.steps.map((st, i) => {
      const isCurrent = i === this.currentStep;
      const isDone = i < this.currentStep;
      const cls = isCurrent ? 'drill-phase-step active' : isDone ? 'drill-phase-step completed' : 'drill-phase-step upcoming';
      return `
        <div class="${cls}" title="${st.desc}">
          <span class="drill-phase-dot">${isDone ? '✓' : i + 1}</span>
          <span class="drill-phase-label">${st.label}</span>
        </div>
        ${i < this.steps.length - 1 ? '<span class="drill-phase-sep">→</span>' : ''}
      `;
    }).join('');

    banner.innerHTML = `
      <div class="drill-indicator">
        <span class="drill-pulse"></span>
        <div>
          <strong style="color:#38bdf8; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">DRILL MODE ACTIVE</strong>
          <div style="font-weight:700; color:#fff; font-size:13px;">${step.name}</div>
        </div>
      </div>

      <div class="drill-phases-tracker">
        ${phaseFlowHtml}
      </div>

      <div class="drill-stats">
        <div class="drill-stat-item">
          <span class="drill-stat-lbl">Simulated Clock</span>
          <span class="drill-stat-val" id="drill-clock-val">+${this.simulatedTimeMinutes} mins</span>
        </div>
        <div class="drill-stat-item">
          <span class="drill-stat-lbl">Casualties Mitigated</span>
          <span class="drill-stat-val" id="drill-casualties-val" style="color:#22c55e;">${this.casualtiesPrevented.toLocaleString()}</span>
        </div>
        <div class="drill-stat-item">
          <span class="drill-stat-lbl">Phase</span>
          <span class="drill-stat-val" style="color:#f59e0b;">${this.currentStep + 1}/${this.steps.length}</span>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <button class="siren-badge-btn ${this.isSirenSounding ? 'sounding' : ''}" id="drill-siren-btn" onclick="window.simulationEngine.toggleSiren()">
          <span>${this.isSirenSounding ? '🔊 Mute Siren' : '🚨 Sound Siren'}</span>
        </button>
        <button class="btn btn-glass" style="padding:6px 12px; font-size:11px; border-radius:8px;" onclick="window.simulationEngine.advanceStep()">
          <span>Next Phase ➔</span>
        </button>
        <button class="btn btn-glass" style="padding:6px 10px; font-size:11px; border-radius:8px; color:#94a3b8;" onclick="window.simulationEngine.stopDrill()" title="Stop Drill">
          &times;
        </button>
      </div>
    `;
  }

  updateDrillStats() {
    const clock = document.getElementById('drill-clock-val');
    const cas = document.getElementById('drill-casualties-val');
    if (clock) clock.textContent = `+${this.simulatedTimeMinutes} mins`;
    if (cas) cas.textContent = this.casualtiesPrevented.toLocaleString();
  }

  updateSirenUI() {
    const btn = document.getElementById('drill-siren-btn');
    if (btn) {
      if (this.isSirenSounding) {
        btn.classList.add('sounding');
        btn.innerHTML = '<span>🔊 Mute Siren</span>';
      } else {
        btn.classList.remove('sounding');
        btn.innerHTML = '<span>🚨 Sound Siren</span>';
      }
    }
    const topSirenBtn = document.getElementById('topbar-siren-toggle');
    if (topSirenBtn) {
      if (this.isSirenSounding) {
        topSirenBtn.classList.add('sounding');
        topSirenBtn.innerHTML = '<span>🔊 Siren Sounding</span>';
      } else {
        topSirenBtn.classList.remove('sounding');
        topSirenBtn.innerHTML = '<span>🚨 Test Siren</span>';
      }
    }
  }
}

// Global singleton instance
if (typeof window !== 'undefined') {
  window.simulationEngine = new DisasterSimulationEngine();
}
