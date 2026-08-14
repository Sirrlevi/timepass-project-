exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return json(500, {
      ok: false,
      error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
    });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (_) {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  const forwarded = String(headers["x-forwarded-for"] || "")
    .split(",")[0].trim();

  const ip =
    headers["x-nf-client-connection-ip"] ||
    headers["client-ip"] ||
    forwarded ||
    "unavailable";

  const hints = data.deviceHints || {};
  const screen = data.screen || {};
  const viewport = data.viewport || {};
  const loc = data.location || {};

  const brands = Array.isArray(hints.brands)
    ? hints.brands.map(x => x.brand).filter(Boolean).join(", ")
    : "unavailable";

  const events = Array.isArray(data.events) ? data.events : [];

  const message = [
    "╔══════════════════════════════╗",
    "║     💌 VISITOR DIAGNOSTICS  ║",
    "╚══════════════════════════════╝",
    "",
    "👤 VISITOR",
    `• Consent: YES`,
    `• Received: ${data.timestamp || new Date().toISOString()}`,
    "",
    "🌐 NETWORK",
    `• Public IP: ${ip}`,
    `• Network provider: ${data.networkProvider || "not exposed by browser"}`,
    "",
    "📱 DEVICE",
    `• Model: ${hints.model || "not exposed"}`,
    `• Platform: ${hints.platform || data.platform || "unavailable"}`,
    `• Mobile: ${hints.mobile === true ? "Yes" : hints.mobile === false ? "No" : "unknown"}`,
    `• Browser brands: ${brands}`,
    `• User-Agent: ${String(data.userAgent || headers["user-agent"] || "unavailable").slice(0, 500)}`,
    "",
    "🖥️ DISPLAY",
    `• Screen: ${screen.width || "?"} × ${screen.height || "?"}`,
    `• Pixel ratio: ${screen.pixelRatio || "?"}`,
    `• Viewport: ${viewport.width || "?"} × ${viewport.height || "?"}`,
    `• Touch points: ${data.touchPoints ?? "?"}`,
    "",
    "🌍 BROWSER",
    `• Language: ${data.language || "unavailable"}`,
    `• Timezone: ${data.timezone || "unavailable"}`,
    `• Referrer: ${data.referrer || "direct / unavailable"}`,
    `• Page: ${String(data.page || "").slice(0, 500)}`,
    "",
    "📍 LOCATION",
    `• GPS: ${loc.status === "not requested" ? "Not requested — no permission prompt" : (loc.status || "unavailable")}`,
    "",
    "🖱️ INTERACTIONS",
    ...(events.length
      ? events.slice(0, 20).map(e =>
          `• ${String(e.name || "event").slice(0, 80)}`
        )
      : ["• Initial consent only"]),
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ].join("\n");

  const telegramUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;

  try {
    const tg = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true
      })
    });

    const result = await tg.json().catch(() => ({}));

    if (!tg.ok || !result.ok) {
      return json(502, {
        ok: false,
        error: "Telegram rejected the message",
        telegram: result.description || "unknown Telegram error"
      });
    }

    return json(200, { ok: true });
  } catch (error) {
    return json(502, { ok: false, error: "Telegram request failed" });
  }
};
