exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Telegram environment variables are not configured" })
    };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (_) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON" })
    };
  }

  // Only accept telemetry after the frontend's explicit consent control.
  if (!data || !data.type) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing telemetry type" })
    };
  }

  const forwarded = event.headers["x-forwarded-for"] || "";
  const netlifyIp = event.headers["x-nf-client-connection-ip"] || "";
  const ip = netlifyIp || forwarded.split(",")[0].trim() || "unavailable";

  const ua = data.userAgent || event.headers["user-agent"] || "unavailable";
  const location = data.location || {};
  const hints = data.deviceHints || {};

  const lines = [
    "💌 Visitor diagnostics",
    `Type: ${String(data.type).slice(0, 40)}`,
    `Time: ${String(data.timestamp || new Date().toISOString())}`,
    "",
    `🌐 IP: ${ip}`,
    `📱 UA: ${String(ua).slice(0, 350)}`,
    `🧩 Platform: ${data.platform || hints.platform || "unavailable"}`,
    `📲 Model: ${hints.model || "not exposed by browser"}`,
    `🏷️ Browser brands: ${Array.isArray(hints.brands) ? hints.brands.map(x => x.brand).join(", ") : "unavailable"}`,
    `📐 Screen: ${data.screen ? `${data.screen.width}×${data.screen.height} @${data.screen.pixelRatio}x` : "unavailable"}`,
    `🖥️ Viewport: ${data.viewport ? `${data.viewport.width}×${data.viewport.height}` : "unavailable"}`,
    `🌍 Language: ${data.language || "unavailable"}`,
    `🕐 Timezone: ${data.timezone || "unavailable"}`,
    `📶 Network provider: ${data.networkProvider || "not exposed by browser"}`,
    ""
  ];

  if (location.status === "granted") {
    lines.push(`📍 GPS: ${location.latitude}, ${location.longitude}`);
    lines.push(`🎯 Accuracy: ~${location.accuracyMeters}m`);
  } else {
    lines.push(`📍 GPS: ${location.status || "not provided"}`);
  }

  if (Array.isArray(data.events) && data.events.length) {
    lines.push("");
    lines.push("🖱️ Events:");
    for (const e of data.events.slice(0, 12)) {
      lines.push(`• ${String(e.name || "event").slice(0, 60)}`);
    }
  }

  const telegramUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;

  try {
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        disable_web_page_preview: true
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Telegram request failed" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (_) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to reach Telegram" })
    };
  }
};
