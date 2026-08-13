/*
  Put track1.mp3 in the same folder as index.html.
*/
const SONG_URL = "track1.mp3";

const song = document.getElementById("loveSong");
const cornerVideo = document.getElementById("cornerVideo");
const balloonOverlay = document.getElementById("balloonOverlay");
const loveBalloon = document.getElementById("loveBalloon");
const confettiField = document.getElementById("confettiField");
const coupleSticker = document.querySelector(".couple-sticker");

song.src = SONG_URL;
song.volume = 0.42;
song.preload = "auto";

cornerVideo.play().catch(() => {});

let balloonTriggered = false;

const CONFETTI_GLYPHS = ["♥", "♡", "✦"];
const CONFETTI_COLORS = ["#B24D6E", "#6B2E48", "#AD8748"];

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

async function burstBalloonAndPlay() {
  if (balloonTriggered) return;
  balloonTriggered = true;

  // The balloon tap is the intentional user gesture that unlocks audible audio.
  song.currentTime = 0;

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
    setTimeout(() => balloonOverlay.remove(), 700);
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
if (coupleSticker && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
