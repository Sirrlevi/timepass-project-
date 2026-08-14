/*
  Put track1.mp3 in the same folder as index.html.
  To add more songs, drop additional mp3 files in this folder and
  add them to the SONGS list below — the ♪ button will cycle through them.
*/
const SONGS = [
  { src: "track1.mp3", label: "a little song for you" },
  // { src: "track2.mp3", label: "our song" },
  // { src: "track3.mp3", label: "your favorite" },
];

const song = document.getElementById("loveSong");
const cornerVideo = document.getElementById("cornerVideo");
const balloonOverlay = document.getElementById("balloonOverlay");
const loveBalloon = document.getElementById("loveBalloon");
const confettiField = document.getElementById("confettiField");
const coupleSticker = document.querySelector(".couple-sticker");
const musicPlayer = document.querySelector(".music-player");
const songSwitch = document.getElementById("songSwitch");
const songToast = document.getElementById("songToast");
const introCurtain = document.getElementById("introCurtain");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let songIndex = 0;
song.src = SONGS[songIndex].src;
song.volume = 0.42;
song.preload = "auto";

cornerVideo.play().catch(() => {});

let balloonTriggered = false;
let audioCtx = null;
let analyser = null;
let analyserData = null;

const CONFETTI_GLYPHS = ["♥", "♡", "✦"];
const CONFETTI_COLORS = ["#B24D6E", "#6B2E48", "#AD8748"];

// Page-load reveal — the curtain parts once, then gets fully removed
// from the DOM so it never intercepts a stray tap.
if (introCurtain) {
  if (reducedMotion) {
    introCurtain.remove();
  } else {
    const rightPanel = introCurtain.querySelector(".intro-right");
    const cleanup = () => introCurtain.remove();
    if (rightPanel) {
      rightPanel.addEventListener("animationend", cleanup, { once: true });
    }
    setTimeout(cleanup, 3600);
  }
}

function spawnConfetti() {
  if (!confettiField) return;
  const pieceCount = 22;

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.textContent =
      CONFETTI_GLYPHS[Math.floor(Math.random() * CONFETTI_GLYPHS.length)];

    const angle = (Math.PI * 2 * i) / pieceCount + Math.random() * 0.4;
    const distance = 90 + Math.random() * 130;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - 40;

    piece.style.setProperty("--cf-x", `${x}px`);
    piece.style.setProperty("--cf-y", `${y}px`);
    piece.style.setProperty("--cf-rotate", `${(Math.random() * 360 - 180).toFixed(0)}deg`);
    piece.style.setProperty("--cf-scale", (0.6 + Math.random() * 0.7).toFixed(2));
    piece.style.setProperty("--cf-size", `${12 + Math.random() * 16}px`);
    piece.style.setProperty("--cf-duration", `${(0.9 + Math.random() * 0.6).toFixed(2)}s`);
    piece.style.setProperty("--cf-delay", `${(Math.random() * 0.15).toFixed(2)}s`);
    piece.style.setProperty(
      "--cf-color",
      CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    );

    confettiField.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

function setupVinylPulse() {
  if (audioCtx || !musicPlayer) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    const sourceNode = audioCtx.createMediaElementSource(song);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    analyserData = new Uint8Array(analyser.frequencyBinCount);

    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    if (!reducedMotion) {
      requestAnimationFrame(pulseVinyl);
    }
  } catch (error) {
    // Web Audio isn't available — the vinyl just won't pulse, song still plays fine.
  }
}

function pulseVinyl() {
  if (analyser && analyserData && musicPlayer) {
    analyser.getByteFrequencyData(analyserData);
    let sum = 0;
    for (let i = 0; i < analyserData.length; i++) sum += analyserData[i];
    const level = sum / analyserData.length / 255;
    musicPlayer.style.setProperty("--pulse", level.toFixed(3));
  }
  requestAnimationFrame(pulseVinyl);
}

async function burstBalloonAndPlay() {
  if (balloonTriggered) return;
  balloonTriggered = true;

  // The balloon tap is the intentional user gesture that unlocks audible audio.
  song.currentTime = 0;
  setupVinylPulse();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  try {
    await song.play();
  } catch (error) {
    song.addEventListener("canplay", () => {
      song.play().catch(() => {});
    }, { once: true });
  }

  balloonOverlay.classList.add("is-bursting");
  spawnConfetti();

  // Remove both balloon and instruction completely after the burst.
  setTimeout(() => {
    balloonOverlay.classList.add("burst-away");
    setTimeout(() => {
      balloonOverlay.remove();
      setTimeout(showHeartHint, 700);
    }, 700);
  }, 520);
}

loveBalloon.addEventListener("click", burstBalloonAndPlay);
loveBalloon.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    burstBalloonAndPlay();
  }
});

// Multilingual love-line rotation.
const loveLine = document.getElementById("loveLine");

const loveLines = [
  "I love Sana so much",
  "Je t'aime tellement, Sana",
  "Ich liebe Sana so sehr",
  "Amo tanto Sana",
  "Eu amo tanto a Sana",
  "Я так сильно люблю Сану",
  "我非常爱Sana",
  "サナのことが大好き",
  "사나를 정말 많이 사랑해",
  "मैं सना से बहुत प्यार करता हूँ",
  "أحب سانا كثيرًا",
  "Aku sangat mencintai Sana",
  "Aku sayang banget sama Sana",
  "Sana'yı çok seviyorum",
  "Ik hou zoveel van Sana",
  "Jag älskar Sana så mycket",
  "Jeg elsker Sana så høyt",
  "Jeg elsker Sana så meget",
  "Sana, te iubesc atât de mult",
  "Sana, volim te mnogo",
  "Σ' αγαπώ τόσο πολύ, Sana"
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
    setTimeout(() => loveLine.classList.remove("love-fade-in"), 700);
  }, 650);
}

setInterval(rotateLoveLine, 3600);

// Gentle parallax on the couple sticker — follows pointer, falls back to
// a light device-tilt on touch devices. Kept subtle by design.
if (coupleSticker && !reducedMotion) {
  const applyTilt = (nx, ny) => {
    coupleSticker.style.setProperty("--tilt-x", (nx * 10).toFixed(2));
    coupleSticker.style.setProperty("--tilt-y", (ny * 8).toFixed(2));
  };

  window.addEventListener("pointermove", (event) => {
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = (event.clientY / window.innerHeight) * 2 - 1;
    applyTilt(nx, ny);
  });

  window.addEventListener("deviceorientation", (event) => {
    if (event.gamma == null || event.beta == null) return;
    const nx = Math.max(-1, Math.min(1, event.gamma / 30));
    const ny = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
    applyTilt(nx, ny);
  });
}

// Song switcher — cycles through SONGS on tap of the ♪ button.
let toastTimer;

function showSongToast(label) {
  if (!songToast) return;
  songToast.textContent = label;
  songToast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => songToast.classList.remove("is-visible"), 2200);
}

function switchSong() {
  if (SONGS.length < 2) {
    showSongToast(SONGS[0].label);
    return;
  }

  songIndex = (songIndex + 1) % SONGS.length;
  const next = SONGS[songIndex];
  const wasPlaying = !song.paused;

  song.src = next.src;
  showSongToast(next.label);

  if (wasPlaying) {
    song.play().catch(() => {});
  }
}

if (songSwitch) {
  songSwitch.addEventListener("click", switchSong);
}

// Tap-to-reveal love notes — tapping any floating heart shows a small,
// random handwritten-style note near it.
const LOVE_NOTES = [
  "You are my favorite hello and hardest goodbye.",
  "Har pal tumhare saath sabse pyara lagta hai.",
  "Tumhari muskaan meri sabse badi khushi hai.",
  "You make ordinary days feel like magic.",
  "Tumse milna zindagi ka sabse acha itfaaq tha.",
  "My heart chose you, and it never once doubted.",
  "Tum ho toh sab kuch thik lagta hai.",
  "Falling for you was easy, loving you is forever.",
  "Tumhare bina din adhoora sa lagta hai.",
  "Every love line on this page still means you.",
];

let activeNote = null;
let noteTimer;

// Positions the note using its *actual* rendered width/height against the
// *current* viewport, then clamps both axes so it can never spill off any
// edge — this is what makes it correct on phones, tablets, and desktops
// alike, instead of guessing a fixed offset.
function showLoveNote(target) {
  if (activeNote) {
    activeNote.remove();
    activeNote = null;
  }

  const note = document.createElement("div");
  note.className = "love-note";
  note.textContent = LOVE_NOTES[Math.floor(Math.random() * LOVE_NOTES.length)];
  note.style.visibility = "hidden";
  note.style.left = "0px";
  note.style.top = "0px";
  document.body.appendChild(note);
  activeNote = note;

  const margin = 12;
  const gap = 14;
  const heartRect = target.getBoundingClientRect();
  const noteRect = note.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Horizontal: center on the heart, then clamp fully inside the viewport.
  let left = heartRect.left + heartRect.width / 2 - noteRect.width / 2;
  left = Math.min(Math.max(left, margin), viewportW - noteRect.width - margin);

  // Vertical: prefer above the heart; flip below if there isn't room.
  const spaceAbove = heartRect.top;
  const spaceBelow = viewportH - heartRect.bottom;
  const showBelow = spaceAbove < noteRect.height + gap + margin && spaceBelow > spaceAbove;

  let top;
  if (showBelow) {
    top = heartRect.bottom + gap;
    top = Math.min(top, viewportH - noteRect.height - margin);
  } else {
    top = heartRect.top - noteRect.height - gap;
    top = Math.max(top, margin);
  }

  // Arrow stays pointed at the heart even though the box itself shifted.
  const arrowLeft = Math.min(
    Math.max(heartRect.left + heartRect.width / 2 - left, 18),
    noteRect.width - 18
  );

  note.style.left = `${left}px`;
  note.style.top = `${top}px`;
  note.style.setProperty("--note-arrow-left", `${arrowLeft}px`);
  note.classList.toggle("note-below", showBelow);
  note.style.visibility = "visible";

  requestAnimationFrame(() => note.classList.add("is-visible"));

  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    note.classList.remove("is-visible");
    setTimeout(() => {
      if (activeNote === note) {
        note.remove();
        activeNote = null;
      }
    }, 400);
  }, 2600);
}

document.querySelectorAll(".heart").forEach((heart) => {
  heart.addEventListener("click", () => showLoveNote(heart));
  heart.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showLoveNote(heart);
    }
  });
});

// A gentle one-time nudge so it's clear the hearts are tappable, shown
// once the balloon intro is out of the way. The soft ripple ring on each
// heart (see CSS) then stays as a permanent reminder after this fades.
const heartHint = document.getElementById("heartHint");

function showHeartHint() {
  if (!heartHint) return;
  heartHint.textContent = "🩷 tap the floating hearts for a little surprise";
  requestAnimationFrame(() => heartHint.classList.add("is-visible"));
  setTimeout(() => heartHint.classList.remove("is-visible"), 4200);
}
