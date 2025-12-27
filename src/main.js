import { createLoop } from "./core/loop.js";
import { createRenderer } from "./core/renderer.js";
import { createInput } from "./core/input.js";
import { loadImage, loadJson } from "./core/assets.js";
import { bouncePlayer, createPlayer, updatePlayer } from "./game/player.js";
import { createLevel1 } from "./game/level.js";
import { createMoomba, updateMoomba } from "./game/enemies/moomba.js";

const canvas = document.querySelector("#game");
const renderer = createRenderer(canvas);
const input = createInput();
const hud = document.querySelector(".hud");
const startOverlay = document.querySelector(".start-overlay");
const pauseOverlay = document.querySelector(".pause-overlay");
const hudLives = document.querySelector("#hud-lives");
const hudCoins = document.querySelector("#hud-coins");
const hudShards = document.querySelector("#hud-shards");

const spawnPoint = { x: 24, y: 96 };

const state = {
  player: createPlayer(spawnPoint.x, spawnPoint.y),
  level: createLevel1(),
  enemies: [createMoomba(160, 160)],
  assets: null,
  assetsReady: false,
  hud: {
    lives: 3,
    coins: 0,
    shards: 0,
  },
  time: 0,
  mode: "title",
};

loadAssets();
setMode("title");

function update(dt) {
  if (state.mode === "title") {
    if (input.consumePress("Enter")) {
      setMode("playing");
    }
    return;
  }

  if (state.mode === "paused") {
    if (input.consumePress("KeyP")) {
      setMode("playing");
    }
    return;
  }

  if (input.consumePress("KeyP")) {
    setMode("paused");
    return;
  }

  state.time += dt;
  updatePlayer(state.player, input, dt, state.level);

  for (const enemy of state.enemies) {
    updateMoomba(enemy, state.level, dt);
  }

  handleEnemyCollisions();
}

function render() {
  renderer.clear("#78c7f0");
  drawLevel(state.level);
  if (state.assetsReady) {
    drawSprite("player", state.player.x, state.player.y);
  } else {
    renderer.rect(state.player.x, state.player.y, state.player.width, state.player.height, "#e04b3a");
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      continue;
    }
    if (state.assetsReady) {
      drawSprite("moomba", enemy.x, enemy.y);
    } else {
      renderer.rect(enemy.x, enemy.y, enemy.width, enemy.height, "#7b4a6d");
    }
  }

  renderer.text("Super Mo - Engine Scaffold", 8, 16, "#2b2b2b");
}

function drawLevel(level) {
  const { width, height, tileSize, tiles } = level;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = tiles[y * width + x];
      if (id === 0) {
        continue;
      }
      if (state.assetsReady && id === 2) {
        drawSprite("block", x * tileSize, y * tileSize);
        continue;
      }
      if (state.assetsReady && id === 3) {
        drawSprite("goal", x * tileSize, y * tileSize);
        continue;
      }
      let color = "#d4a86a";
      if (id === 2) {
        color = "#f6d44d";
      }
      if (id === 3) {
        color = "#5dbb63";
      }
      renderer.rect(x * tileSize, y * tileSize, tileSize, tileSize, color);
    }
  }
}

function drawSprite(id, x, y) {
  const frame = state.assets.atlas[id];
  if (!frame) {
    return;
  }
  renderer.sprite(state.assets.image, frame.x, frame.y, frame.w, frame.h, x, y);
}

function handleEnemyCollisions() {
  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      continue;
    }
    if (!overlaps(state.player, enemy)) {
      continue;
    }

    const stompThreshold = state.player.y + state.player.height - enemy.y;
    if (state.player.vy > 0 && stompThreshold <= 8) {
      enemy.alive = false;
      bouncePlayer(state.player);
      continue;
    }

    resetPlayer();
    return;
  }
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function resetPlayer() {
  state.player.x = spawnPoint.x;
  state.player.y = spawnPoint.y;
  state.player.vx = 0;
  state.player.vy = 0;
}

function setMode(mode) {
  state.mode = mode;
  const isTitle = mode === "title";
  const isPaused = mode === "paused";

  hud.classList.toggle("is-hidden", isTitle);
  startOverlay.classList.toggle("is-hidden", !isTitle);
  pauseOverlay.classList.toggle("is-hidden", !isPaused);
  updateHud();
}

function updateHud() {
  hudLives.textContent = `Lives ${state.hud.lives}`;
  hudCoins.textContent = `Coins ${state.hud.coins}`;
  hudShards.textContent = `Shards ${state.hud.shards}`;
}

async function loadAssets() {
  try {
    const [image, atlas] = await Promise.all([
      loadImage("assets/sprites.svg"),
      loadJson("assets/sprites.json"),
    ]);
    state.assets = { image, atlas };
    state.assetsReady = true;
  } catch (error) {
    console.error(error);
  }
}

window.__SUPER_MO__ = {
  state,
  setMode,
  resetPlayer,
};

const loop = createLoop({ update, render });
loop.start();

window.addEventListener("blur", () => {
  input.reset();
});
