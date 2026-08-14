(() => {
  "use strict";

  // Consent is granted only by the clearly-labelled balloon action.
  const ENDPOINT = "/.netlify/functions/telemetry";
  let consented = false;
  let sentInitial = false;

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

  async function sendConsentTelemetry() {
    if (!consented || sentInitial) return;
    sentInitial = true;

    const payload = {
      type: "visitor_diagnostics",
      timestamp: new Date().toISOString(),
      page: location.href,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent || null,
      platform: navigator.platform || null,
      language: navigator.language || null,
      languages: Array.isArray(navigator.languages) ? navigator.languages : [],
      timezone: (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
        catch (_) { return null; }
      })(),
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: devicePixelRatio || 1,
        colorDepth: screen.colorDepth || null
      },
      viewport: { width: innerWidth, height: innerHeight },
      touchPoints: navigator.maxTouchPoints || 0,
      deviceHints: await deviceHints(),
      location: { status: "not requested" },
      networkProvider: "not exposed by standard browser APIs",
      events: [{ name: "balloon_burst_consent", at: new Date().toISOString() }]
    };

    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        keepalive: true
      });
    } catch (_) {}
  }

  window.grantBalloonConsent = () => {
    consented = true;
    void sendConsentTelemetry();
  };
})();
