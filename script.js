/*
  Put track1.mp3 in the same folder as index.html.
*/
const SONG_URL = "track1.mp3";

const song = document.getElementById("loveSong");
const cornerVideo = document.getElementById("cornerVideo");
const balloonOverlay = document.getElementById("balloonOverlay");
const loveBalloon = document.getElementById("loveBalloon");

song.src = SONG_URL;
song.volume = 0.42;
song.preload = "auto";

cornerVideo.play().catch(() => {});

let balloonTriggered = false;

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
