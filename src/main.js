import { createLoop } from "./core/loop.js";
import { createRenderer } from "./core/renderer.js";
import { createInput } from "./core/input.js";
import { loadImage, loadJson } from "./core/assets.js";
import { createAudio } from "./core/audio.js";
import { bouncePlayer, createPlayer, updatePlayer } from "./game/player.js";
import { createLevel1 } from "./game/level.js";
import { createMoomba, updateMoomba } from "./game/enemies/moomba.js";

const canvas = document.querySelector("#game");
const renderer = createRenderer(canvas);
const input = createInput();
const audio = createAudio();
const hud = document.querySelector(".hud");
const startOverlay = document.querySelector(".start-overlay");
const pauseOverlay = document.querySelector(".pause-overlay");
const completeOverlay = document.querySelector(".complete-overlay");
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
  camera: {
    x: 0,
    y: 0,
  },
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

  if (state.mode === "complete") {
    if (input.consumePress("Enter")) {
      resetLevel();
      setMode("playing");
    }
    return;
  }

  if (input.consumePress("KeyP")) {
    setMode("paused");
    return;
  }

  state.time += dt;
  const events = updatePlayer(state.player, input, dt, state.level);
  if (events.jumped) {
    audio.playJump();
  }

  handleCollectibles();
  updateCamera();
  if (overlaps(state.player, state.level.goal)) {
    setMode("complete");
    return;
  }

  for (const enemy of state.enemies) {
    updateMoomba(enemy, state.level, dt);
  }

  handleEnemyCollisions();
}

function render() {
  renderer.clear("#78c7f0");
  renderer.ctx.save();
  renderer.ctx.translate(-state.camera.x, -state.camera.y);
  drawLevel(state.level);
  drawCollectibles();
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

  renderer.ctx.restore();

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

function drawCollectibles() {
  for (const coin of state.level.coins) {
    if (coin.collected) {
      continue;
    }
    if (state.assetsReady) {
      drawSprite("coin", coin.x, coin.y);
    } else {
      renderer.rect(coin.x + 4, coin.y + 4, 8, 8, "#f6d44d");
    }
  }

  for (const shard of state.level.shards) {
    if (shard.collected) {
      continue;
    }
    if (state.assetsReady) {
      drawSprite("shard", shard.x, shard.y);
    } else {
      renderer.rect(shard.x + 4, shard.y + 4, 8, 8, "#78c7f0");
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
      audio.playStomp();
      continue;
    }

    resetPlayer();
    return;
  }
}

function handleCollectibles() {
  for (const coin of state.level.coins) {
    if (coin.collected) {
      continue;
    }
    if (overlaps(state.player, coin)) {
      coin.collected = true;
      state.hud.coins += 1;
      updateHud();
    }
  }

  for (const shard of state.level.shards) {
    if (shard.collected) {
      continue;
    }
    if (overlaps(state.player, shard)) {
      shard.collected = true;
      state.hud.shards += 1;
      updateHud();
    }
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

function resetLevel() {
  state.level = createLevel1();
  state.enemies = [createMoomba(160, 160)];
  state.hud.coins = 0;
  state.hud.shards = 0;
  state.camera.x = 0;
  state.camera.y = 0;
  resetPlayer();
  updateHud();
}

function setMode(mode) {
  state.mode = mode;
  const isTitle = mode === "title";
  const isPaused = mode === "paused";
  const isComplete = mode === "complete";

  hud.classList.toggle("is-hidden", isTitle);
  startOverlay.classList.toggle("is-hidden", !isTitle);
  pauseOverlay.classList.toggle("is-hidden", !isPaused);
  completeOverlay.classList.toggle("is-hidden", !isComplete);
  updateHud();

  if (mode === "playing") {
    audio.unlock();
    audio.startMusic();
  } else {
    audio.stopMusic();
  }
}

function updateCamera() {
  const levelWidth = state.level.width * state.level.tileSize;
  const maxX = Math.max(0, levelWidth - canvas.width);
  const lookAhead = Math.sign(state.player.vx) * 24;
  const targetX = state.player.x + state.player.width / 2 - canvas.width / 2 + lookAhead;
  state.camera.x = clamp(targetX, 0, maxX);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
