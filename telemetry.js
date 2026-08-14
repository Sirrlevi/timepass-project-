/*
  Optional, explicit visitor diagnostics.
  Nothing is sent until the visitor checks the consent box.
  Telegram credentials are server-side only:
    TELEGRAM_BOT_TOKEN
    TELEGRAM_CHAT_ID
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

  function hasConsent() {
    return box.checked === true;
  }

  function safeStorageGet() {
    try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch (_) { return false; }
  }

  function safeStorageSet(value) {
    try {
      if (value) localStorage.setItem(CONSENT_KEY, "1");
      else localStorage.removeItem(CONSENT_KEY);
    } catch (_) {}
  }

  async function getDeviceHints() {
    const uaData = navigator.userAgentData;
    let hints = {};

    if (uaData) {
      hints.brands = Array.isArray(uaData.brands) ? uaData.brands : undefined;
      hints.mobile = uaData.mobile;
      hints.platform = uaData.platform;

      if (typeof uaData.getHighEntropyValues === "function") {
        try {
          const high = await uaData.getHighEntropyValues([
            "model",
            "platformVersion",
            "fullVersionList"
          ]);
          hints = { ...hints, ...high };
        } catch (_) {}
      }
    }

    return hints;
  }

  async function getLocation() {
    if (!("geolocation" in navigator)) {
      return { status: "unavailable" };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          status: "granted",
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(pos.coords.accuracy)
        }),
        (err) => resolve({
          status: err && err.code === 1 ? "denied" : "unavailable"
        }),
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 300000
        }
      );
    });
  }

  async function buildPayload(events = []) {
    const deviceHints = await getDeviceHints();
    const location = await getLocation();

    return {
      type: "visitor_diagnostics",
      timestamp: new Date().toISOString(),
      page: location.href,
      referrer: document.referrer || null,

      // Browser-exposed device information.
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
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio || 1,
        colorDepth: window.screen.colorDepth || null
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      touchPoints: navigator.maxTouchPoints || 0,
      deviceHints,
      location,

      // Browser JS does not reliably expose the mobile carrier/network provider.
      networkProvider: "not exposed by browser",

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
    flushTimer = setTimeout(flushInteractions, 2500);
  }

  async function flushInteractions() {
    if (!hasConsent() || interactionQueue.length === 0) return;

    const events = interactionQueue.splice(0, 12);
    const payload = {
      type: "interaction",
      timestamp: new Date().toISOString(),
      page: location.href,
      events
    };

    await sendPayload(payload);
  }

  box.addEventListener("change", () => {
    if (box.checked) {
      safeStorageSet(true);
      sendInitial();
    } else {
      safeStorageSet(false);
      sentInitial = false;
      interactionQueue = [];
    }
  });

  // Respect a previously enabled checkbox state; otherwise collect nothing.
  if (safeStorageGet()) {
    box.checked = true;
    setTimeout(sendInitial, 1200);
  }

  // Small set of meaningful interaction events, not keystroke capture.
  document.addEventListener("click", (event) => {
    if (!hasConsent()) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.id === "loveBalloon") {
      queueInteraction("balloon_burst");
    } else if (target.id === "songSwitch") {
      queueInteraction("song_switch");
    } else if (target.closest(".heart")) {
      queueInteraction("love_note");
    } else if (target.closest(".couple-sticker")) {
      queueInteraction("couple_tap");
    }
  }, { passive: true });

  window.addEventListener("pagehide", () => {
    if (hasConsent() && interactionQueue.length) {
      const payload = {
        type: "interaction",
        timestamp: new Date().toISOString(),
        page: location.href,
        events: interactionQueue.splice(0, 12)
      };

      try {
        navigator.sendBeacon(
          ENDPOINT,
          new Blob([JSON.stringify(payload)], { type: "application/json" })
        );
      } catch (_) {}
    }
  });
})();
