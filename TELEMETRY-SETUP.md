# Balloon consent telemetry

The balloon text explicitly says:

“tap to burst balloon 🎈 & give consent to interact data”

The visitor’s balloon tap is the explicit consent action. No separate checkbox or location permission prompt is used.

Set these Netlify environment variables:

- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

The function sends only browser/server information that is actually exposed:
IP observed by the Netlify Function, browser/UA, available User-Agent Client Hints (including model where supported), screen, viewport, language, timezone, referrer, and the balloon interaction.

GPS is intentionally not requested, so no browser location permission popup appears.
