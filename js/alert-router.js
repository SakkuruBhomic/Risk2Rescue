/**
 * RISK2RESCUE — DIRECT ALERT ROUTER
 * Server-side Alert Routing Module (js/alert-router.js)
 *
 * Lightweight, zero-dependency email alert dispatcher for zone escalations.
 * Direct HTTP integration with free-tier providers (Resend / SendGrid) or local spool log.
 * Avoids standing up heavy second workflow engines (n8n / Node-RED).
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'alert_dispatches_log.json');
const DEDUPLICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown per zone

class AlertRouter {
  constructor() {
    this.zoneTierHistory = new Map(); // zoneId -> { tier: string, lastDispatchedAt: number }
    this.dispatchesLog = this.loadDispatchesLog();
  }

  loadDispatchesLog() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        const raw = fs.readFileSync(LOG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('[AlertRouter] Error loading dispatches log:', e.message);
    }
    return [];
  }

  saveDispatchesLog() {
    try {
      const dir = path.dirname(LOG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOG_FILE, JSON.stringify(this.dispatchesLog.slice(0, 100), null, 2), 'utf8');
    } catch (e) {
      console.warn('[AlertRouter] Error saving dispatches log:', e.message);
    }
  }

  getDispatchHistory() {
    return this.dispatchesLog;
  }

  /**
   * Evaluates dynamic zones and fires alerts if any zone escalates to RED or ORANGE
   */
  async checkZoneEscalations(zones = [], priorityData = null, telemetry = null, situationalBrief = null) {
    if (!Array.isArray(zones)) return [];

    const now = Date.now();
    const dispatchedEvents = [];

    for (const zone of zones) {
      const zoneId = zone.id || zone.village_id;
      const currentTier = zone.current_tier || zone.level || 'GREEN';
      const forecastPeakTier = zone.forecast_tier_by_hour ? zone.forecast_tier_by_hour[3] : currentTier;

      // Check if previously tracked
      const history = this.zoneTierHistory.get(zoneId);
      const prevTier = history ? history.tier : 'GREEN';
      const lastSent = history ? history.lastDispatchedAt : 0;

      // Escalation condition:
      // Zone is currently RED or ORANGE, or projected peak in +12h is RED,
      // AND tier is worse than previous tier (or cooldown expired if severe).
      const isSevere = currentTier === 'RED' || forecastPeakTier === 'RED' || currentTier === 'ORANGE';
      const isEscalation = (prevTier !== currentTier && isSevere) || (prevTier !== 'RED' && currentTier === 'RED');
      const isCooldownOver = (now - lastSent) > DEDUPLICATION_COOLDOWN_MS;

      if (isSevere && (isEscalation || (currentTier === 'RED' && isCooldownOver))) {
        // Record new tier in history
        this.zoneTierHistory.set(zoneId, { tier: currentTier, lastDispatchedAt: now });

        // Build alert payload
        const alertPayload = {
          zoneId,
          zoneName: zone.name,
          villageName: zone.village_name || zone.name,
          district: zone.district || 'Coastal Andhra Pradesh',
          hazardType: (zone.hazardType || 'cyclone').toUpperCase(),
          previousTier: prevTier,
          newTier: currentTier,
          forecastPeakTier,
          population: zone.pop || 0,
          telemetry: zone.current_telemetry || telemetry?.summary?.radar || {},
          assignedShelter: (zone.assigned_shelters && zone.assigned_shelters[0]) ? zone.assigned_shelters[0].shelter_name : 'Kakinada Port Cyclone Relief Camp',
          directive: situationalBrief?.text || 'Initiate priority evacuation protocol immediately.',
          triggeredAt: new Date().toISOString()
        };

        console.log(`[AlertRouter] 🚨 Escalation detected for ${zone.name}: ${prevTier} -> ${currentTier} (Peak: ${forecastPeakTier})`);

        // Dispatch email notification
        const dispatchResult = await this.sendEscalationEmail(alertPayload);
        dispatchedEvents.push({ alertPayload, dispatchResult });
      } else {
        // Still update tracked tier
        this.zoneTierHistory.set(zoneId, { tier: currentTier, lastDispatchedAt: history ? history.lastDispatchedAt : 0 });
      }
    }

    return dispatchedEvents;
  }

  /**
   * Formats and delivers email via Resend, SendGrid, or Local Spool
   */
  async sendEscalationEmail(alert) {
    const toEmail = process.env.ALERT_RECIPIENT_EMAIL || 'incident-commander@ap-sdma.gov.in';
    const fromEmail = process.env.ALERT_SENDER_EMAIL || 'alerts@resend.dev';
    
    const newTier = alert.newTier || alert.level || 'RED';
    const tierColor = newTier === 'RED' ? '#ef4444' : '#f97316';
    const zoneTitle = alert.zoneName || alert.name || 'Hazard Sector';
    const distTitle = alert.district || 'Coastal Andhra Pradesh';
    const hazType = (alert.hazardType || alert.hazard_type || 'CYCLONE').toUpperCase();
    const popVal = alert.population || alert.atRiskPop || alert.pop || 0;
    const peakTier = alert.forecastPeakTier || newTier;
    const telem = alert.telemetry || {};
    const gustStr = telem.windGustKmh ? `${telem.windGustKmh} km/h` : (telem.maxGustSpeedKmH ? `${telem.maxGustSpeedKmH} km/h` : 'Telemetry Active');
    const pressStr = telem.pressureHpa ? `${telem.pressureHpa} hPa` : (telem.corePressureHpa ? `${telem.corePressureHpa} hPa` : '1005 hPa');
    const shelter = alert.assignedShelter || alert.shelter || 'Kakinada Port Cyclone Relief Camp';
    const directive = alert.directive || alert.recommendation || 'Initiate priority evacuation protocol immediately.';
    const timeStr = alert.triggeredAt || new Date().toISOString();

    const subject = `🚨 [NDRF-SDMA ALERT] ${zoneTitle} Escalated to ${newTier} (${hazType})`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#070b13; color:#f1f5f9; padding:24px; }
          .card { background:#0f172a; border:1px solid rgba(255,255,255,0.12); border-left:4px solid ${tierColor}; border-radius:12px; padding:24px; max-width:620px; margin:0 auto; }
          .badge { display:inline-block; padding:4px 12px; border-radius:6px; font-weight:800; font-size:12px; background:${tierColor}; color:#fff; text-transform:uppercase; }
          .title { font-size:20px; font-weight:800; color:#fff; margin:12px 0 6px 0; }
          .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:18px 0; }
          .stat { background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); }
          .stat-label { font-size:11px; color:#94a3b8; text-transform:uppercase; font-weight:700; }
          .stat-val { font-size:15px; color:#fff; font-weight:800; margin-top:4px; }
          .directive { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; padding:14px; color:#fca5a5; font-size:13px; line-height:1.5; margin-top:16px; }
          .footer { font-size:11px; color:#64748b; margin-top:20px; text-align:center; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">${newTier} ESCALATION</span>
          <div class="title">${zoneTitle}</div>
          <div style="font-size:13px; color:#94a3b8;">${distTitle} &bull; ${hazType} Monitoring Sector</div>

          <div class="stat-grid">
            <div class="stat">
              <div class="stat-label">Population at Risk</div>
              <div class="stat-val">${Number(popVal).toLocaleString()}</div>
            </div>
            <div class="stat">
              <div class="stat-label">+12h Forecast Peak</div>
              <div class="stat-val" style="color:${tierColor};">${peakTier}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Live Wind / Gusts</div>
              <div class="stat-val">${gustStr}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Surface Pressure</div>
              <div class="stat-val">${pressStr}</div>
            </div>
          </div>

          <div class="stat" style="margin-bottom:14px;">
            <div class="stat-label">Primary Destination Shelter</div>
            <div class="stat-val" style="color:#38bdf8;">${shelter}</div>
          </div>

          <div class="directive">
            <strong>Incident Commander Directive:</strong><br>
            ${directive}
          </div>

          <div class="footer">
            Automated Alert from Risk2Rescue Single AI Orchestration Engine &bull; ${timeStr}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `🚨 [NDRF-SDMA ALERT] ${zoneTitle} reached ${newTier} (${hazType})
Population At Risk: ${Number(popVal).toLocaleString()}
+12h Forecast Peak: ${peakTier}
Primary Shelter: ${shelter}
Directive: ${directive}
Triggered At: ${timeStr}`;

    const resendKey = process.env.RESEND_API_KEY;
    const sendgridKey = process.env.SENDGRID_API_KEY;

    let providerUsed = 'Local Spool Log (Zero Cost / Offline Fallback)';
    let status = 'logged_locally';
    let responseId = null;

    if (resendKey) {
      try {
        const resendRes = await this.callResendApi(resendKey, { from: fromEmail, to: toEmail, subject, html, text });
        providerUsed = 'Resend Free-Tier REST API';
        status = 'delivered';
        responseId = resendRes?.id || 'resend_ok';
      } catch (err) {
        console.warn('[AlertRouter] Resend API delivery failed, logging locally:', err.message);
        status = 'failed_resend_fallback_local';
      }
    } else if (sendgridKey) {
      try {
        const sgRes = await this.callSendGridApi(sendgridKey, { from: fromEmail, to: toEmail, subject, html, text });
        providerUsed = 'SendGrid Free-Tier REST API';
        status = 'delivered';
        responseId = 'sendgrid_ok';
      } catch (err) {
        console.warn('[AlertRouter] SendGrid delivery failed, logging locally:', err.message);
        status = 'failed_sendgrid_fallback_local';
      }
    }

    const logEntry = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      recipient: toEmail,
      sender: fromEmail,
      subject,
      provider: providerUsed,
      status,
      responseId,
      zone: alert.zoneName,
      tier: alert.newTier,
      population: alert.population,
      preview: alert.directive
    };

    this.dispatchesLog.unshift(logEntry);
    this.saveDispatchesLog();

    return logEntry;
  }

  callResendApi(apiKey, { from, to, subject, html, text }) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        from: from || 'onboarding@resend.dev',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
      });

      const req = https.request({
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 6000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
          } else {
            reject(new Error(`Resend HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Resend API timeout')); });
      req.write(payload);
      req.end();
    });
  }

  callSendGridApi(apiKey, { from, to, subject, html, text }) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html }
        ]
      });

      const req = https.request({
        hostname: 'api.sendgrid.com',
        port: 443,
        path: '/v3/mail/send',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 6000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true });
          } else {
            reject(new Error(`SendGrid HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('SendGrid API timeout')); });
      req.write(payload);
      req.end();
    });
  }
}

const instance = new AlertRouter();
module.exports = instance;
