# Netlify visitor diagnostics

A small checkbox in the top-right corner controls telemetry:

**share visitor diagnostics**

Nothing is sent until it is checked.

## Netlify environment variables

Set these in Netlify → Site configuration → Environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Keep both values server-side. Never paste them into frontend JavaScript.

## Important location behavior

This version intentionally does **not** call the browser Geolocation API.

Therefore checking the box does **not** trigger the browser's location permission popup.

The Telegram message will explicitly report:

`GPS: Not requested — no permission prompt`

A normal webpage cannot silently obtain precise GPS coordinates without the browser's location permission mechanism.

## Immediate delivery

When the checkbox is checked, the initial diagnostics request is sent immediately to:

`/.netlify/functions/telemetry`

The Netlify Function formats the data into a structured Telegram text message.

## Browser limitations

The standard browser APIs do not reliably expose mobile carrier/network provider. Device model is also only available when the browser provides the relevant User-Agent Client Hints.
