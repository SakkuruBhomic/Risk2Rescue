/**
 * ================================================================
 * SIGNIN-MODAL.JS — Shared Sign In & Location Modal Controller
 * ================================================================
 * Handles:
 *  1. Sign In floating modal (Desktop side-by-side / Mobile stacked)
 *  2. Task 4 Citizen Location Flow:
 *     - Requesting state: Pulse animation + "Detecting your location..."
 *     - Success state: "Location found: [District Name]" + checkmark + ~800ms redirect
 *     - Denied / Error / Timeout state: Auto fallback to AP district dropdown + "Continue"
 *     - Edge case 1: Unsupported browser skips detecting straight to fallback dropdown
 *     - Edge case 2: "Use a different location" link cancels redirect & opens dropdown
 */

(function () {
  'use strict';

  let locRedirectTimer = null;

  /** Helper to safely retrieve RZILocationService in any scope */
  function getLocationService() {
    return window.RZILocationService || (typeof RZILocationService !== 'undefined' ? RZILocationService : null);
  }

  /** Clear any pending redirection timeout */
  function clearLocRedirect() {
    if (locRedirectTimer) {
      clearTimeout(locRedirectTimer);
      locRedirectTimer = null;
    }
  }

  // --------------------------------------------------------------
  // 1. SIGN IN MODAL CONTROLS
  // --------------------------------------------------------------

  /** Open the main Sign In portal selector modal */
  window.openSignInModal = function () {
    const modal = document.getElementById('signInModal');
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  };

  /** Close the main Sign In portal selector modal */
  window.closeSignInModal = function () {
    const modal = document.getElementById('signInModal');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  /** Handle backdrop click to dismiss Sign In modal */
  window.handleSignInModalBackdrop = function (e) {
    const modal = document.getElementById('signInModal');
    if (e.target === modal) {
      window.closeSignInModal();
    }
  };

  // --------------------------------------------------------------
  // 2. LOCATION MODAL CONTROLS & LIFECYCLE
  // --------------------------------------------------------------

  /** Close Location modal and abort pending redirection */
  window.closeLocModal = function () {
    clearLocRedirect();
    const modal = document.getElementById('loc-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  /** Handle backdrop click to dismiss Location modal */
  window.handleLocModalBackdrop = function (e) {
    const modal = document.getElementById('loc-modal');
    if (e.target === modal) {
      window.closeLocModal();
    }
  };

  /** Switch from Success state to manual selection when user clicks "Use a different location" */
  window.switchToManualSelection = function () {
    clearLocRedirect();
    window.showLocModal('fallback', 'Choose your preferred district below.');
  };

  // --------------------------------------------------------------
  // 3. TASK 4: "ENTER AS CITIZEN" FLOW
  // --------------------------------------------------------------

  /**
   * Main entry point when user clicks "Enter as Citizen".
   * Reuses RZILocationService from js/location-service.js.
   */
  window.enterAsCitizen = function () {
    window.closeSignInModal();
    clearLocRedirect();

    // Edge case 1: Browser does not support Geolocation API at all
    // Skip straight to manual dropdown without showing "Detecting..." state
    if (!('geolocation' in navigator)) {
      window.showLocModal('fallback', 'Geolocation is not supported by your browser. Please select your district manually.');
      return;
    }

    // State 1: Requesting state
    window.showLocModal('detecting');

    const locService = getLocationService();
    if (locService) {
      locService.detectLocation()
        .then(async ({ lat, lng }) => {
          let districtName = 'Andhra Pradesh';
          let fullDisplay = '';

          try {
            const place = await locService.reverseGeocode(lat, lng);
            districtName = place.district || place.city || 'Andhra Pradesh';
            fullDisplay = place.display || districtName;
          } catch (_) {
            districtName = 'Andhra Pradesh';
            fullDisplay = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
          }

          // State 2: Success state
          window.showLocModal('success', { districtName, lat, lng, fullDisplay });
        })
        .catch((err) => {
          // Edge case 1 fallback: Unsupported error code
          if (err && err.code === 'UNSUPPORTED') {
            window.showLocModal('fallback', 'Geolocation is not supported by your browser. Please select your district manually.');
          } else {
            // State 3: Denied / Timed out / Errored
            const msg = (err && err.message) || 'Unable to detect your GPS position. Please select your district manually.';
            window.showLocModal('fallback', msg);
          }
        });
    } else {
      // Graceful fallback if location-service.js is not loaded
      window.showLocModal('fallback', 'Location service unavailable. Please select your district manually.');
    }
  };

  /** Retry GPS detection from fallback panel */
  window.retryGeolocation = function () {
    clearLocRedirect();

    if (!('geolocation' in navigator)) {
      window.showLocModal('fallback', 'Geolocation is not supported by your browser. Please select your district manually.');
      return;
    }

    window.showLocModal('detecting');

    const locService = getLocationService();
    if (locService) {
      locService.detectLocation()
        .then(async ({ lat, lng }) => {
          let districtName = 'Andhra Pradesh';
          let fullDisplay = '';

          try {
            const place = await locService.reverseGeocode(lat, lng);
            districtName = place.district || place.city || 'Andhra Pradesh';
            fullDisplay = place.display || districtName;
          } catch (_) {
            districtName = 'Andhra Pradesh';
            fullDisplay = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
          }

          window.showLocModal('success', { districtName, lat, lng, fullDisplay });
        })
        .catch((err) => {
          const msg = (err && err.message) || 'GPS detection failed. Please select your district manually.';
          window.showLocModal('fallback', msg);
        });
    }
  };

  /** Manual AP District dropdown Continue button */
  window.useManualLocation = function () {
    const sel = document.getElementById('loc-district-select');
    if (!sel || !sel.value) {
      if (sel) {
        sel.style.borderColor = '#ef4444';
        sel.focus();
      }
      return;
    }

    const locService = getLocationService();
    if (locService && typeof locService.getAPDistricts === 'function') {
      const districts = locService.getAPDistricts();
      const d = districts.find(x => x.name === sel.value);
      if (d) {
        // Persist in sessionStorage for citizen session
        try {
          sessionStorage.setItem('rzi_citizen_location', JSON.stringify({
            lat: d.lat,
            lng: d.lng,
            place: d.name,
            district: d.name,
            manual: true
          }));
        } catch (_) {}

        // Redirect to citizen.html with query parameters
        window.location.href = locService.buildCitizenUrl(d.lat, d.lng, d.name);
        return;
      }
    }

    // Fallback if service or district not matched
    window.location.href = 'citizen.html';
  };

  // --------------------------------------------------------------
  // 4. MODAL STATE SWITCHER
  // --------------------------------------------------------------

  /**
   * Switch the Location modal UI between:
   *  - 'detecting'
   *  - 'success'
   *  - 'fallback'
   */
  window.showLocModal = function (state, detail) {
    const modal = document.getElementById('loc-modal');
    if (!modal) {
      window.location.href = 'citizen.html';
      return;
    }

    clearLocRedirect();

    const sDetecting = document.getElementById('loc-state-detecting');
    const sSuccess   = document.getElementById('loc-state-success');
    const sFallback  = document.getElementById('loc-state-fallback');
    const errorText  = document.getElementById('loc-error-text');
    const placeName  = document.getElementById('loc-place-name');
    const distSelect = document.getElementById('loc-district-select');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (sDetecting) sDetecting.style.display = 'none';
    if (sSuccess)   sSuccess.style.display   = 'none';
    if (sFallback)  sFallback.style.display  = 'none';

    // 1. Requesting state
    if (state === 'detecting') {
      if (sDetecting) sDetecting.style.display = 'block';
    }

    // 2. Success state (~800ms auto redirect + diff location link)
    else if (state === 'success') {
      if (sSuccess) sSuccess.style.display = 'block';

      const info = (typeof detail === 'object' && detail !== null)
        ? detail
        : { districtName: detail || 'Andhra Pradesh', lat: 17.6868, lng: 83.2185, fullDisplay: detail || 'Visakhapatnam' };

      if (placeName) {
        placeName.textContent = info.districtName;
      }

      // Persist in sessionStorage for citizen portal
      try {
        sessionStorage.setItem('rzi_citizen_location', JSON.stringify({
          lat: info.lat,
          lng: info.lng,
          place: info.fullDisplay || info.districtName,
          district: info.districtName,
          manual: false
        }));
      } catch (_) {}

      const locService = getLocationService();
      const targetUrl = (locService && typeof locService.buildCitizenUrl === 'function')
        ? locService.buildCitizenUrl(info.lat, info.lng, info.fullDisplay || info.districtName)
        : `citizen.html?lat=${info.lat}&lng=${info.lng}&place=${encodeURIComponent(info.fullDisplay || info.districtName)}`;

      // Automatically redirect after ~800ms checkmark confirmation unless paused for testing
      if (new URLSearchParams(window.location.search).get('pause') !== '1') {
        locRedirectTimer = setTimeout(() => {
          window.location.href = targetUrl;
        }, 800);
      }
    }

    // 3. Fallback state (Manual AP District dropdown + Continue)
    else if (state === 'fallback') {
      if (sFallback) sFallback.style.display = 'block';

      if (errorText && typeof detail === 'string' && detail.trim()) {
        errorText.textContent = detail;
      }

      // Populate AP districts list if not already done (guarded on data-populated)
      if (distSelect && !distSelect.dataset.populated) {
        const locService = getLocationService();
        if (locService && typeof locService.getAPDistricts === 'function') {
          const list = locService.getAPDistricts();
          // Ensure placeholder option exists
          if (distSelect.options.length === 0) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '— Choose your Andhra Pradesh District —';
            distSelect.appendChild(placeholder);
          }
          list.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.name;
            opt.textContent = d.name;
            distSelect.appendChild(opt);
          });
          distSelect.dataset.populated = 'true';
        }
      }

      if (distSelect) {
        distSelect.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        if (!distSelect.dataset.changeBound) {
          distSelect.addEventListener('change', () => {
            if (distSelect.value) {
              distSelect.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
          });
          distSelect.dataset.changeBound = 'true';
        }
      }
    }
  };

  // --------------------------------------------------------------
  // 5. AUTHORITY LOGIN ROUTE
  // --------------------------------------------------------------

  window.enterAsAuthority = function () {
    window.closeSignInModal();
    window.location.href = 'authority-login.html';
  };

  // --------------------------------------------------------------
  // 6. GLOBAL KEYBOARD ESCAPE LISTENER
  // --------------------------------------------------------------

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      window.closeSignInModal();
      window.closeLocModal();
    }
  });

  // Global modal backdrop click fallback
  window.addEventListener('click', function (e) {
    const locModal = document.getElementById('loc-modal');
    if (locModal && e.target === locModal) {
      window.closeLocModal();
    }
  });

})();
