# Optional visitor diagnostics — Netlify setup

The page contains a small checkbox in the top-right corner:

**share visitor diagnostics**

Nothing is sent until the visitor checks it.

## Netlify environment variables

In Netlify → Site configuration → Environment variables, add:

- `TELEGRAM_BOT_TOKEN` = your Telegram bot token
- `TELEGRAM_CHAT_ID` = the destination chat/channel ID

Do NOT put either value in `index.html`, `script.js`, or `telemetry.js`.

## What is sent after consent

The browser sends information it can legitimately expose, including:
- public IP observed server-side by the Netlify Function
- browser user-agent/platform
- screen and viewport size
- language/timezone
- browser User-Agent Client Hints when available, including model where the browser exposes it
- interaction events such as balloon burst, song switch, heart-note tap
- GPS latitude/longitude only if the visitor separately accepts the browser's native location permission prompt

Mobile carrier/network provider is not reliably exposed by normal web browsers, so it is reported as unavailable rather than guessed.

Unchecking the box removes the saved consent flag and stops future telemetry.
