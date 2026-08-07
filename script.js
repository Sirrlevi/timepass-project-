/*
  Local audio file:
  Put track1.mp3 in the same folder as index.html.
*/
const SONG_URL = "track1.mp3";

const song = document.getElementById("loveSong");
const cornerVideo = document.getElementById("cornerVideo");

song.src = SONG_URL;
song.volume = 0.42;
song.autoplay = true;
song.loop = true;
song.preload = "auto";

/*
  IMPORTANT:
  There is NO vinyl-specific click/tap handler.
  We request audible autoplay immediately. If the browser blocks
  audible autoplay, ANY user interaction anywhere on the page can
  unlock the audio. The listener stays active until play() succeeds.
*/
let audioStarted = false;

async function tryStartSong() {
  if (audioStarted) return true;

  try {
    await song.play();
    audioStarted = true;
    removeAudioUnlockListeners();
    return true;
  } catch (_) {
    // Browser autoplay policy blocked it. Keep waiting for interaction.
    return false;
  }
}

function handleFirstInteraction() {
  tryStartSong();
}

function removeAudioUnlockListeners() {
  ["pointerdown", "touchstart", "click", "keydown"].forEach((eventName) => {
    window.removeEventListener(eventName, handleFirstInteraction, true);
  });
}

["pointerdown", "touchstart", "click", "keydown"].forEach((eventName) => {
  window.addEventListener(eventName, handleFirstInteraction, {
    passive: true,
    capture: true
  });
});

// Attempt autoplay as soon as possible.
tryStartSong();

// Retry when the page becomes visible/active again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tryStartSong();
});
window.addEventListener("pageshow", tryStartSong);

cornerVideo.play().catch(() => {});

// Multilingual love-line rotation.
const loveLine = document.getElementById("loveLine");

const loveLines = [
  "I love Sana so much",                 // English
  "Je t'aime tellement, Sana",          // French
  "Ich liebe Sana so sehr",             // German
  "Amo tanto Sana",                     // Spanish/Italian
  "Eu amo tanto a Sana",                // Portuguese
  "Я так сильно люблю Сану",            // Russian
  "我非常爱Sana",                        // Chinese
  "サナのことが大好き",                  // Japanese
  "사나를 정말 많이 사랑해",              // Korean
  "मैं सना से बहुत प्यार करता हूँ",       // Hindi
  "أحب سانا كثيرًا",                    // Arabic
  "Aku sangat mencintai Sana",          // Indonesian
  "Aku sayang banget sama Sana",        // Indonesian casual
  "Seni çok seviyorum, Sana",           // Turkish
  "Sana'yı çok seviyorum",              // Turkish
  "Eu te amo muito, Sana",              // Portuguese
  "Ik hou zoveel van Sana",             // Dutch
  "Jag älskar Sana så mycket",          // Swedish
  "Jeg elsker Sana så høyt",             // Norwegian
  "Jeg elsker Sana så meget",           // Danish
  "Sana, te iubesc atât de mult",       // Romanian
  "Sana, volim te mnogo",               // Serbian/Croatian
  "Sana, volim te puno",                // Croatian
  "Σ' αγαπώ τόσο πολύ, Sana",           // Greek
  "Sana, te quiero muchísimo",          // Spanish
];

let loveIndex = 0;

function rotateLoveLine() {
  if (!loveLine) return;

  loveLine.classList.add("love-fade-out");

  setTimeout(() => {
    loveIndex = (loveIndex + 1) % loveLines.length;
    loveLine.textContent = loveLines[loveIndex];
    loveLine.classList.remove("love-fade-out");
    loveLine.classList.add("love-fade-in");

    setTimeout(() => {
      loveLine.classList.remove("love-fade-in");
    }, 700);
  }, 650);
}

// Each phrase stays visible briefly, then cross-fades.
setInterval(rotateLoveLine, 3600);
