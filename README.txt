ROMANTIC STATIC WEBPAGE - SINGLE SCREEN

Files:
- index.html
- style.css
- script.js

Required local audio:
- Put your song at: track1.mp3
- Keep track1.mp3 in the SAME folder as index.html.

AUDIO BEHAVIOR:
- No vinyl-specific tap/click dependency.
- The page requests audible autoplay immediately.
- If the browser allows audible autoplay, the song starts on page load/refresh.
- If the browser blocks audible autoplay (common on mobile Chrome/Safari), ANY first
  interaction anywhere on the page unlocks the audio. You do NOT need to tap the vinyl.
- The unlock listener remains active until playback actually succeeds.
- Volume is 42%.
- No visible audio controls are shown.

IMPORTANT:
No website can reliably force audible autoplay against a browser's autoplay policy.
That restriction is controlled by the browser, not JavaScript.
