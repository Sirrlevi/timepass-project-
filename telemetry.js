(() => {
  "use strict";

  const ENDPOINT = "/.netlify/functions/telemetry";
  let sent = false;

  // ---------- Device Hints (high-entropy UA CH) ----------
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
          "model", "platformVersion", "fullVersionList"
        ]));
      } catch (_) {}
    }
    return out;
  }

  // ---------- IP Location (ipapi.co) ----------
  async function fetchIPInfo() {
    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      return await res.json();
    } catch (_) {
      return {};
    }
  }

  // ---------- Collect All Data ----------
  async function collectTelemetry() {
    const ua = navigator.userAgent || "";
    const hints = await deviceHints();

    // Device brand, model, platform, version
    let brand = "not exposed";
    let model = "not exposed";
    let platform = hints.platform || "unknown";
    let platformVersion = "not exposed";

    if (hints.model) model = hints.model;
    if (hints.platformVersion) platformVersion = hints.platformVersion;

    // Fallback UA parsing
    if (model === "not exposed" || model === "") {
      if (/Android/i.test(ua)) {
        const m = ua.match(/Android\s[\d.]+;\s([^;)]+)/);
        model = m ? m[1].trim() : "Android device";
      } else if (/iPhone/i.test(ua)) model = "iPhone";
      else if (/iPad/i.test(ua)) model = "iPad";
      else if (/Macintosh/i.test(ua)) model = "Mac";
      else if (/Windows NT/i.test(ua)) model = "Windows PC";
      else if (/Linux/i.test(ua)) model = "Linux PC";
    }

    // Brand fallback
    if (brand === "not exposed") {
      if (/Samsung/i.test(ua)) brand = "Samsung";
      else if (/Xiaomi/i.test(ua)) brand = "Xiaomi";
      else if (/vivo/i.test(ua)) brand = "vivo";
      else if (/OnePlus/i.test(ua)) brand = "OnePlus";
      else if (/Google/i.test(ua)) brand = "Google";
      else if (/Apple/i.test(ua) && /iPhone|iPad|Mac/i.test(ua)) brand = "Apple";
      else if (/Nokia/i.test(ua)) brand = "Nokia";
      else if (/Oppo/i.test(ua)) brand = "Oppo";
      else if (/Realme/i.test(ua)) brand = "Realme";
      else if (/Huawei/i.test(ua)) brand = "Huawei";
    }

    // Platform version fallback
    if (platformVersion === "not exposed") {
      if (/Android\s([\d.]+)/i.test(ua)) {
        platformVersion = "Android " + RegExp.$1;
      } else if (/iPhone OS\s([\d_]+)/i.test(ua)) {
        platformVersion = "iOS " + RegExp.$1.replace(/_/g, ".");
      } else if (/Windows NT\s([\d.]+)/i.test(ua)) {
        platformVersion = "Windows " + (RegExp.$1 === "10.0" ? "10/11" : RegExp.$1);
      } else if (/Mac OS X\s([\d_]+)/i.test(ua)) {
        platformVersion = "macOS " + RegExp.$1.replace(/_/g, ".");
      } else if (/Linux/i.test(ua)) {
        platformVersion = "Linux";
      } else {
        platformVersion = platform;
      }
    }

    // Browser & version
    let browser = "not exposed";
    let browserVersion = "not exposed";
    const uaLower = ua.toLowerCase();
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
    // Use hints if available
    if (hints.brands && hints.brands.length) {
      for (const b of hints.brands) {
        if (b.brand.includes("Chrome") && !b.brand.includes("Edge")) {
          browser = "Chrome";
          browserVersion = b.version || browserVersion;
          break;
        } else if (b.brand.includes("Firefox")) {
          browser = "Firefox";
          browserVersion = b.version || browserVersion;
          break;
        } else if (b.brand.includes("Safari")) {
          browser = "Safari";
          browserVersion = b.version || browserVersion;
          break;
        } else if (b.brand.includes("Edge")) {
          browser = "Edge";
          browserVersion = b.version || browserVersion;
          break;
        }
      }
    }

    // IP info
    const ipInfo = await fetchIPInfo();

    // Build payload
    return {
      ip: ipInfo.ip || "unavailable",
      device: { brand, model, platform, platformVersion },
      browser: { name: browser, version: browserVersion, userAgent: ua },
      display: {
        screenWidth: screen.width,
        screenHeight: screen.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        pixelRatio: devicePixelRatio || 1,
        colorDepth: screen.colorDepth || "unknown",
        touchPoints: navigator.maxTouchPoints || 0
      },
      locale: {
        language: navigator.language || "unknown",
        languages: Array.isArray(navigator.languages) ? navigator.languages : [],
        timezone: (() => {
          try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
          catch (_) { return null; }
        })(),
        utcOffset: new Date().getTimezoneOffset()
      },
      network: {
        isp: ipInfo.org || "unavailable",
        asn: ipInfo.asn || "unavailable"
      },
      location: {
        country: ipInfo.country_name || "unavailable",
        state: ipInfo.region || "unavailable",
        city: ipInfo.city || "unavailable",
        postal: ipInfo.postal || "unavailable",
        latitude: ipInfo.latitude || "unavailable",
        longitude: ipInfo.longitude || "unavailable"
      },
      referrer: document.referrer || "none",
      pageUrl: location.href,
      timestamp: new Date().toISOString()
    };
  }

  // ---------- Format as Structured Text ----------
  function formatMessage(data) {
    const lines = [];
    lines.push("VISITOR DATA");
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push(`IP: ${data.ip}`);
    lines.push("");
    lines.push("DEVICE");
    lines.push(`Brand: ${data.device.brand}`);
    lines.push(`Model: ${data.device.model}`);
    lines.push(`Platform: ${data.device.platform}`);
    lines.push(`Platform Version: ${data.device.platformVersion}`);
    lines.push("");
    lines.push("BROWSER");
    lines.push(`Browser: ${data.browser.name}`);
    lines.push(`Version: ${data.browser.version}`);
    lines.push(`User-Agent: ${data.browser.userAgent}`);
    lines.push("");
    lines.push("DISPLAY");
    lines.push(`Screen: ${data.display.screenWidth} × ${data.display.screenHeight}`);
    lines.push(`Viewport: ${data.display.viewportWidth} × ${data.display.viewportHeight}`);
    lines.push(`Pixel Ratio: ${data.display.pixelRatio}`);
    lines.push(`Color Depth: ${data.display.colorDepth}`);
    lines.push(`Touch Points: ${data.display.touchPoints}`);
    lines.push("");
    lines.push("LOCALE");
    lines.push(`Language: ${data.locale.language}`);
    lines.push(`Languages: ${data.locale.languages.join(", ")}`);
    lines.push(`Timezone: ${data.locale.timezone}`);
    lines.push(`UTC Offset: ${data.locale.utcOffset} minutes`);
    lines.push("");
    lines.push("NETWORK");
    lines.push(`ISP: ${data.network.isp}`);
    lines.push(`ASN: ${data.network.asn}`);
    lines.push("");
    lines.push("LOCATION");
    lines.push(`Country: ${data.location.country}`);
    lines.push(`State: ${data.location.state}`);
    lines.push(`City: ${data.location.city}`);
    lines.push(`Postal Code: ${data.location.postal}`);
    lines.push(`Latitude: ${data.location.latitude}`);
    lines.push(`Longitude: ${data.location.longitude}`);
    lines.push("");
    lines.push("REFERRER");
    lines.push(data.referrer);
    lines.push("");
    lines.push("PAGE");
    lines.push(data.pageUrl);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("Collected without any permission popup.");
    return lines.join("\n");
  }

  // ---------- Send to Netlify ----------
  async function sendTelemetry(text) {
    if (sent) return;
    sent = true;
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        cache: "no-store",
        keepalive: true
      });
    } catch (_) {
      // Fallback: sendBeacon
      try {
        const blob = new Blob([JSON.stringify({ text })], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
      } catch (__) {}
    }
  }

  // ---------- Main: Auto-Run on Load ----------
  async function run() {
    const data = await collectTelemetry();
    const message = formatMessage(data);
    await sendTelemetry(message);
  }

  // Auto-start when page loads
  if (document.readyState === "complete") {
    setTimeout(run, 600);
  } else {
    window.addEventListener("load", () => setTimeout(run, 600));
  }
})();
