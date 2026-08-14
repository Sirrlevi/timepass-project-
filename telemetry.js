// telemetry.js – Silent Browser Telemetry (No permissions, no downloads)
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // ---------- HELPERS ----------
  async function sendToBackend(text) {
    try {
      const payload = { text };
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        keepalive: true
      });
      if (res.ok) return;
    } catch (_) {}

    // Fallback: sendBeacon
    try {
      const blob = new Blob([JSON.stringify({ text })], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } catch (_) {}
  }

  // ---------- DATA COLLECTION ----------
  async function collectAll() {
    const data = {};

    // 1. Public IP + IP location (ipapi.co)
    let ipInfo = {};
    try {
      const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      ipInfo = await r.json();
    } catch (_) {}

    data.ip = ipInfo.ip || 'N/A';
    data.ipLocation = {
      country: ipInfo.country_name || 'unavailable',
      state: ipInfo.region || 'unavailable',
      city: ipInfo.city || 'unavailable',
      postal: ipInfo.postal || 'unavailable',
      lat: ipInfo.latitude || 'unavailable',
      lng: ipInfo.longitude || 'unavailable',
      isp: ipInfo.org || 'unavailable',
      asn: ipInfo.asn || 'unavailable'
    };

    // 2. Device brand / model via UA Client Hints
    let brand = 'not exposed';
    let model = 'not exposed';
    let platform = 'not exposed';
    let platformVersion = 'not exposed';

    try {
      if (navigator.userAgentData) {
        const uad = navigator.userAgentData;
        // Brands
        if (uad.brands && uad.brands.length) {
          // pick the first non-Google brand? Actually we can list them.
          // We'll take the first brand that is not "Google Chrome" etc.
          // But we can just take the whole string.
          brand = uad.brands.map(b => b.brand).join(', ');
        }
        // Mobile
        platform = uad.mobile ? 'Android' : (uad.platform || 'not exposed');
        // Get high-entropy values
        try {
          const he = await uad.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']);
          if (he.model) model = he.model;
          if (he.platformVersion) platformVersion = he.platformVersion;
          // If platform is still not exposed, use he.platform? Actually uad.platform exists.
          if (uad.platform) platform = uad.platform;
          // Browser info from fullVersionList
          if (he.fullVersionList && he.fullVersionList.length) {
            // Usually first is browser
            // but we'll handle later
          }
        } catch (_) {}
      }
    } catch (_) {}

    // Fallback: parse userAgent for model, platform, etc.
    const ua = navigator.userAgent;
    if (platform === 'not exposed' || platform === 'Android' || platform === 'iOS') {
      // We can refine
      if (/Android/i.test(ua)) platform = 'Android';
      else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
      else if (/Windows NT/i.test(ua)) platform = 'Windows';
      else if (/Mac OS X/i.test(ua)) platform = 'macOS';
      else if (/Linux/i.test(ua)) platform = 'Linux';
      else platform = 'unknown';
    }

    // Model fallback: try to extract from UA
    if (model === 'not exposed') {
      let m = 'not exposed';
      if (/Android/i.test(ua)) {
        const match = ua.match(/Android\s[\d.]+;\s([^;)]+)/);
        if (match) m = match[1].trim();
      } else if (/iPhone/i.test(ua)) {
        m = 'iPhone';
      } else if (/iPad/i.test(ua)) {
        m = 'iPad';
      } else if (/Macintosh/i.test(ua)) {
        m = 'Mac';
      } else if (/Windows NT/i.test(ua)) {
        m = 'Windows PC';
      }
      model = m;
    }

    // Device brand fallback: from UA or vendor
    if (brand === 'not exposed' || brand === '') {
      let b = 'not exposed';
      if (/Samsung/i.test(ua)) b = 'Samsung';
      else if (/Xiaomi/i.test(ua)) b = 'Xiaomi';
      else if (/vivo/i.test(ua)) b = 'vivo';
      else if (/OnePlus/i.test(ua)) b = 'OnePlus';
      else if (/Google/i.test(ua)) b = 'Google';
      else if (/Apple/i.test(ua) && /iPhone|iPad|Mac/i.test(ua)) b = 'Apple';
      else if (/Nokia/i.test(ua)) b = 'Nokia';
      else if (/Oppo/i.test(ua)) b = 'Oppo';
      else if (/Realme/i.test(ua)) b = 'Realme';
      else if (/Huawei/i.test(ua)) b = 'Huawei';
      brand = b;
    }

    // Platform version: if not from hints, try UA
    if (platformVersion === 'not exposed') {
      let pv = 'not exposed';
      if (/Android\s([\d.]+)/i.test(ua)) {
        pv = 'Android ' + RegExp.$1;
      } else if (/iPhone OS\s([\d_]+)/i.test(ua)) {
        pv = 'iOS ' + RegExp.$1.replace(/_/g, '.');
      } else if (/Windows NT\s([\d.]+)/i.test(ua)) {
        pv = 'Windows ' + (RegExp.$1 === '10.0' ? '10/11' : RegExp.$1);
      } else if (/Mac OS X\s([\d_]+)/i.test(ua)) {
        pv = 'macOS ' + RegExp.$1.replace(/_/g, '.');
      } else if (/Linux/i.test(ua)) {
        pv = 'Linux';
      }
      platformVersion = pv;
    }

    data.device = { brand, model, platform, platformVersion };

    // 3. Browser and version
    let browser = 'not exposed';
    let browserVersion = 'not exposed';
    // Use UA parsing
    const uaLower = ua.toLowerCase();
    if (uaLower.includes('chrome') && !uaLower.includes('edg') && !uaLower.includes('opr')) {
      browser = 'Chrome';
      const match = ua.match(/Chrome\/([\d.]+)/);
      if (match) browserVersion = match[1];
    } else if (uaLower.includes('safari') && !uaLower.includes('chrome') && !uaLower.includes('edg')) {
      browser = 'Safari';
      const match = ua.match(/Version\/([\d.]+)/);
      if (match) browserVersion = match[1];
    } else if (uaLower.includes('firefox')) {
      browser = 'Firefox';
      const match = ua.match(/Firefox\/([\d.]+)/);
      if (match) browserVersion = match[1];
    } else if (uaLower.includes('edg')) {
      browser = 'Edge';
      const match = ua.match(/Edg\/([\d.]+)/);
      if (match) browserVersion = match[1];
    } else if (uaLower.includes('opr') || uaLower.includes('opera')) {
      browser = 'Opera';
      const match = ua.match(/OPR\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }
    // If browser not identified via parsing, use navigator.userAgentData.brands if available
    if (browser === 'not exposed' && navigator.userAgentData && navigator.userAgentData.brands) {
      const brands = navigator.userAgentData.brands;
      for (const b of brands) {
        if (b.brand.includes('Chrome') && !b.brand.includes('Edge')) {
          browser = 'Chrome';
          browserVersion = b.version || 'not exposed';
          break;
        } else if (b.brand.includes('Firefox')) {
          browser = 'Firefox';
          browserVersion = b.version || 'not exposed';
          break;
        } else if (b.brand.includes('Safari')) {
          browser = 'Safari';
          browserVersion = b.version || 'not exposed';
          break;
        } else if (b.brand.includes('Edge')) {
          browser = 'Edge';
          browserVersion = b.version || 'not exposed';
          break;
        }
      }
    }

    data.browser = { browser, browserVersion, userAgent: ua };

    // 4. Display
    data.display = {
      screen: `${screen.width} × ${screen.height}`,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio || 1,
      colorDepth: screen.colorDepth || 'unknown',
      touchPoints: navigator.maxTouchPoints || 0
    };

    // 5. Locale
    data.locale = {
      language: navigator.language || 'unknown',
      languages: navigator.languages || [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      utcOffset: new Date().getTimezoneOffset()
    };

    // 6. Referrer & Page
    data.referrer = document.referrer || 'none';
    data.pageUrl = location.href;

    // 7. IP-based location (already in data.ipLocation)
    // 8. Also include ISP, ASN

    return data;
  }

  // ---------- FORMAT MESSAGE ----------
  function formatMessage(data) {
    const lines = [];
    lines.push('VISITOR DATA');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    lines.push(`IP: ${data.ip}`);
    lines.push('');
    lines.push('DEVICE');
    lines.push(`Brand: ${data.device.brand}`);
    lines.push(`Model: ${data.device.model}`);
    lines.push(`Platform: ${data.device.platform}`);
    lines.push(`Platform Version: ${data.device.platformVersion}`);
    lines.push('');
    lines.push('BROWSER');
    lines.push(`Browser: ${data.browser.browser}`);
    lines.push(`Version: ${data.browser.browserVersion}`);
    lines.push(`User-Agent: ${data.browser.userAgent}`);
    lines.push('');
    lines.push('DISPLAY');
    lines.push(`Screen: ${data.display.screen}`);
    lines.push(`Viewport: ${data.display.viewport}`);
    lines.push(`Pixel Ratio: ${data.display.pixelRatio}`);
    lines.push(`Color Depth: ${data.display.colorDepth}`);
    lines.push(`Touch Points: ${data.display.touchPoints}`);
    lines.push('');
    lines.push('LOCALE');
    lines.push(`Language: ${data.locale.language}`);
    lines.push(`Languages: ${data.locale.languages.join(', ')}`);
    lines.push(`Timezone: ${data.locale.timezone}`);
    lines.push(`UTC Offset: ${data.locale.utcOffset} minutes`);
    lines.push('');
    lines.push('NETWORK');
    lines.push(`ISP: ${data.ipLocation.isp}`);
    lines.push(`ASN: ${data.ipLocation.asn}`);
    lines.push('');
    lines.push('LOCATION');
    lines.push(`Country: ${data.ipLocation.country}`);
    lines.push(`State: ${data.ipLocation.state}`);
    lines.push(`City: ${data.ipLocation.city}`);
    lines.push(`Postal Code: ${data.ipLocation.postal}`);
    lines.push(`Latitude: ${data.ipLocation.lat}`);
    lines.push(`Longitude: ${data.ipLocation.lng}`);
    lines.push('');
    lines.push('REFERRER');
    lines.push(data.referrer);
    lines.push('');
    lines.push('PAGE');
    lines.push(data.pageUrl);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('Data collected without any permission popup.');

    return lines.join('\n');
  }

  // ---------- MAIN ----------
  async function run() {
    if (executed) return;
    executed = true;

    console.log('🔍 Collecting silent telemetry...');
    const data = await collectAll();
    const message = formatMessage(data);
    await sendToBackend(message);
    console.log('✅ Telemetry sent.');
  }

  // ---------- AUTO-START ----------
  if (document.readyState === 'complete') {
    setTimeout(run, 600);
  } else {
    window.addEventListener('load', () => setTimeout(run, 600));
  }

  // Balloon backup (if exists)
  const orig = window.grantBalloonConsent;
  window.grantBalloonConsent = function() {
    if (orig) orig();
    if (!executed) run();
  };
})();
