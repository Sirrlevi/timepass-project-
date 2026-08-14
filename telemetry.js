/*
  Optional visitor diagnostics.
  Nothing is sent until the visitor checks the consent box.
  Telegram credentials stay server-side in Netlify environment variables.
*/

(() => {
  "use strict";

  const box = document.getElementById("telemetryConsent");
  if (!box) return;

  const CONSENT_KEY = "visitorDiagnosticsConsent";
  const ENDPOINT = "/.netlify/functions/telemetry";
  let interactionQueue = [];
  let flushTimer = null;
  let sentInitial = false;

  const hasConsent = () => box.checked === true;

  function saveConsent(enabled) {
    try {
      if (enabled) localStorage.setItem(CONSENT_KEY, "1");
      else localStorage.removeItem(CONSENT_KEY);
    } catch (_) {}
  }

  function previousConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === "1"; }
    catch (_) { return false; }
  }

  async function getDeviceHints() {
    const uaData = navigator.userAgentData;
    if (!uaData) return {};

    const hints = {
      brands: Array.isArray(uaData.brands) ? uaData.brands : [],
      mobile: !!uaData.mobile,
      platform: uaData.platform || null
    };

    if (typeof uaData.getHighEntropyValues === "function") {
      try {
        Object.assign(hints, await uaData.getHighEntropyValues([
          "model", "platformVersion", "fullVersionList"
        ]));
      } catch (_) {}
    }
    return hints;
  }

  async function buildPayload(events = []) {
    return {
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
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: devicePixelRatio || 1,
        colorDepth: screen.colorDepth || null
      },
      viewport: {
        width: innerWidth,
        height: innerHeight
      },
      touchPoints: navigator.maxTouchPoints || 0,
      deviceHints: await getDeviceHints(),
      networkProvider: "not exposed by standard browser APIs",
      location: {
        status: "not requested"
      },
      events
    };
  }

  async function sendPayload(payload) {
    if (!hasConsent()) return false;

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        keepalive: true
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  async function sendInitial() {
    if (!hasConsent() || sentInitial) return;
    sentInitial = true;

    // No geolocation call here: checking the box never triggers a browser
    // location permission prompt.
    const payload = await buildPayload([
      { name: "consent_enabled", at: new Date().toISOString() }
    ]);

    await sendPayload(payload);
  }

  function queueInteraction(name, detail = {}) {
    if (!hasConsent()) return;

    interactionQueue.push({
      name,
      at: new Date().toISOString(),
      detail
    });

    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushInteractions, 1800);
  }

  async function flushInteractions() {
    if (!hasConsent() || !interactionQueue.length) return;

    const events = interactionQueue.splice(0, 12);
    await sendPayload({
      type: "interaction",
      timestamp: new Date().toISOString(),
      page: location.href,
      events
    });
  }

  box.addEventListener("change", () => {
    if (box.checked) {
      saveConsent(true);
      // Send immediately after the checkbox is checked.
      void sendInitial();
    } else {
      saveConsent(false);
      sentInitial = false;
      interactionQueue = [];
      clearTimeout(flushTimer);
    }
  });

  if (previousConsent()) {
    box.checked = true;
    setTimeout(() => void sendInitial(), 250);
  }

  document.addEventListener("click", (event) => {
    if (!hasConsent()) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.id === "loveBalloon") queueInteraction("balloon_burst");
    else if (target.id === "songSwitch") queueInteraction("song_switch");
    else if (target.closest(".heart")) queueInteraction("love_note");
    else if (target.closest(".couple-sticker")) queueInteraction("couple_tap");
  }, { passive: true });

  window.addEventListener("pagehide", () => {
    if (!hasConsent() || !interactionQueue.length) return;

    try {
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([JSON.stringify({
          type: "interaction",
          timestamp: new Date().toISOString(),
          page: location.href,
          events: interactionQueue.splice(0, 12)
        })], { type: "application/json" })
      );
    } catch (_) {}
  });
})();
