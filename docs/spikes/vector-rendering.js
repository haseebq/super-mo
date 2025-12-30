const canvas = document.getElementById("spike");
const ctx = canvas.getContext("2d");
const modeImageBtn = document.getElementById("mode-image");
const modePathBtn = document.getElementById("mode-path");
const modeLabel = document.getElementById("mode-label");
const fpsLabel = document.getElementById("fps");
const spriteSlider = document.getElementById("sprite-count");
const spriteReadout = document.getElementById("sprite-readout");

const spriteSize = 36;
const positions = [];

let mode = "image";
let spriteCount = Number(spriteSlider.value);
let lastFrame = performance.now();
let fpsWindowStart = lastFrame;
let frameCount = 0;
let phase = 0;

const svgMarkup = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e04b3a" />
      <stop offset="100%" stop-color="#f6d44d" />
    </linearGradient>
  </defs>
  <path d="M12 6h24l6 10-6 20H12L6 16z" fill="url(#body)" />
  <circle cx="20" cy="20" r="3" fill="#2b2b2b" />
  <circle cx="28" cy="20" r="3" fill="#2b2b2b" />
  <path d="M18 28c4 4 8 4 12 0" stroke="#2b2b2b" stroke-width="2" fill="none" />
</svg>`;

const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  svgMarkup.trim()
)}`;
const spriteImage = new Image();
let imageReady = false;

spriteImage.onload = () => {
  imageReady = true;
};

spriteImage.src = svgUrl;

const bodyPath = new Path2D("M12 6h24l6 10-6 20H12L6 16z");
const mouthPath = new Path2D("M18 28c4 4 8 4 12 0");

function setPositions(count) {
  positions.length = 0;
  const cols = Math.max(1, Math.floor(canvas.width / spriteSize));
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    positions.push({
      x: 20 + col * spriteSize * 1.2,
      y: 20 + row * spriteSize * 1.2,
    });
  }
}

function setMode(nextMode) {
  mode = nextMode;
  const isImage = mode === "image";
  modeImageBtn.classList.toggle("is-active", isImage);
  modePathBtn.classList.toggle("is-active", !isImage);
  modeLabel.textContent = isImage ? "SVG Image" : "Path2D";
}

modeImageBtn.addEventListener("click", () => setMode("image"));
modePathBtn.addEventListener("click", () => setMode("path"));

spriteSlider.addEventListener("input", () => {
  spriteCount = Number(spriteSlider.value);
  spriteReadout.textContent = String(spriteCount);
  setPositions(spriteCount);
});

function drawSprite({ x, y }, wobble) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wobble * 0.05);
  ctx.scale(1 + wobble * 0.02, 1 + wobble * 0.02);
  if (mode === "image") {
    if (imageReady) {
      ctx.drawImage(
        spriteImage,
        -spriteSize / 2,
        -spriteSize / 2,
        spriteSize,
        spriteSize
      );
    }
  } else {
    ctx.fillStyle = "#e04b3a";
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 1.5;
    ctx.fill(bodyPath);
    ctx.stroke(bodyPath);
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(19, 20, 2.5, 0, Math.PI * 2);
    ctx.arc(29, 20, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke(mouthPath);
  }
  ctx.restore();
}

function tick(now) {
  const delta = now - lastFrame;
  lastFrame = now;
  phase += delta * 0.0015;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < positions.length; i += 1) {
    drawSprite(positions[i], Math.sin(phase + i * 0.2));
  }

  frameCount += 1;
  if (now - fpsWindowStart >= 500) {
    const fps = (frameCount * 1000) / (now - fpsWindowStart);
    fpsLabel.textContent = fps.toFixed(1);
    fpsWindowStart = now;
    frameCount = 0;
  }

  requestAnimationFrame(tick);
}

setPositions(spriteCount);
requestAnimationFrame(tick);
