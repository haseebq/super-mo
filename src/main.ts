import { createLoop } from "./core/loop.js";
import { createRenderer } from "./core/renderer.js";
import { createInput } from "./core/input.js";
import { loadImage, loadJson } from "./core/assets.js";
import { createAudio } from "./core/audio.js";
import { bouncePlayer, createPlayer, updatePlayer } from "./game/player.js";
import { createLevel1 } from "./game/level.js";
import { createMoomba, updateMoomba } from "./game/enemies/moomba.js";
import { createSpikelet, updateSpikelet } from "./game/enemies/spikelet.js";
import { createFlit, updateFlit } from "./game/enemies/flit.js";
import { createParticles } from "./game/particles.js";
import type { Collectible, Level, Rect } from "./game/level.js";
import type { Player } from "./game/player.js";
import type { MoombaEnemy } from "./game/enemies/moomba.js";
import type { SpikeletEnemy } from "./game/enemies/spikelet.js";
import type { FlitEnemy } from "./game/enemies/flit.js";
import type { Renderer } from "./core/renderer.js";
import type { InputState } from "./core/input.js";

type AssetFrame = { x: number; y: number; w: number; h: number };
type Assets = { image: HTMLImageElement; atlas: Record<string, AssetFrame> };
type Camera = { x: number; y: number };
type HudState = { lives: number; coins: number; shards: number };
type Mode = "title" | "playing" | "paused" | "complete";
type Enemy = MoombaEnemy | SpikeletEnemy | FlitEnemy;

type GameState = {
  player: Player;
  level: Level;
  enemies: Enemy[];
  particles: ReturnType<typeof createParticles>;
  assets: Assets | null;
  assetsReady: boolean;
  camera: Camera;
  hud: HudState;
  time: number;
  mode: Mode;
  invulnerableTimer: number;
};

declare global {
  interface Window {
    __SUPER_MO__?: {
      state: GameState;
      setMode: (mode: Mode) => void;
      resetPlayer: () => void;
    };
  }
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

const canvas = requireElement<HTMLCanvasElement>("#game");
const renderer = createRenderer(canvas);
const input: InputState = createInput();
const audio = createAudio();
const hud = requireElement<HTMLDivElement>(".hud");
const startOverlay = requireElement<HTMLDivElement>(".start-overlay");
const pauseOverlay = requireElement<HTMLDivElement>(".pause-overlay");
const completeOverlay = requireElement<HTMLDivElement>(".complete-overlay");
const hudLives = requireElement<HTMLSpanElement>("#hud-lives");
const hudCoins = requireElement<HTMLSpanElement>("#hud-coins");
const hudShards = requireElement<HTMLSpanElement>("#hud-shards");

const spawnPoint = { x: 24, y: 96 };

const state: GameState = {
  player: createPlayer(spawnPoint.x, spawnPoint.y),
  level: createLevel1(),
  enemies: [createMoomba(160, 160), createSpikelet(240, 160), createFlit(520, 80, 24)],
  particles: createParticles(),
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
  invulnerableTimer: 0,
};

loadAssets();
setMode("title");

function update(dt: number) {
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
  if (state.invulnerableTimer > 0) {
    state.invulnerableTimer = Math.max(0, state.invulnerableTimer - dt);
  }
  const events = updatePlayer(state.player, input, dt, state.level);
  if (events.jumped) {
    audio.playJump();
  }

  handleCollectibles();
  updateCamera();
  state.particles.update(dt);
  if (overlaps(state.player, state.level.goal)) {
    setMode("complete");
    return;
  }

  for (const enemy of state.enemies) {
    if (enemy.kind === "moomba") {
      updateMoomba(enemy, state.level, dt);
    }
    if (enemy.kind === "spikelet") {
      updateSpikelet(enemy, state.level, dt);
    }
    if (enemy.kind === "flit") {
      updateFlit(enemy, dt);
    }
  }

  handleEnemyCollisions();
}

function render() {
  renderer.clear("#78c7f0");

  if (state.mode === "title") {
    renderTitlePreview();
    renderer.text("Super Mo - Engine Scaffold", 8, 16, "#2b2b2b");
    return;
  }

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
      if (enemy.kind === "moomba") {
        drawSprite("moomba", enemy.x, enemy.y);
      }
      if (enemy.kind === "spikelet") {
        drawSprite("spikelet", enemy.x, enemy.y);
      }
      if (enemy.kind === "flit") {
        drawSprite("flit", enemy.x, enemy.y);
      }
    } else {
      const color = enemy.kind === "spikelet" ? "#4a2b3f" : "#7b4a6d";
      const tint = enemy.kind === "flit" ? "#5dbb63" : color;
      renderer.rect(enemy.x, enemy.y, enemy.width, enemy.height, tint);
    }
  }

  state.particles.draw(renderer);

  renderer.ctx.restore();

  renderer.text("Super Mo - Engine Scaffold", 8, 16, "#2b2b2b");
}

function drawLevel(level: Level) {
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

function renderTitlePreview() {
  const levelWidth = state.level.width * state.level.tileSize;
  const levelHeight = state.level.height * state.level.tileSize;
  const scale = Math.min((canvas.width - 16) / levelWidth, (canvas.height - 16) / levelHeight);
  const offsetX = (canvas.width - levelWidth * scale) / 2;
  const offsetY = (canvas.height - levelHeight * scale) / 2;

  renderer.ctx.save();
  renderer.ctx.translate(offsetX, offsetY);
  renderer.ctx.scale(scale, scale);
  drawLevel(state.level);
  drawCollectibles();
  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      continue;
    }
    if (state.assetsReady) {
      const spriteId = enemy.kind === "moomba" ? "moomba" : enemy.kind === "spikelet" ? "spikelet" : "flit";
      drawSprite(spriteId, enemy.x, enemy.y);
    } else {
      const color = enemy.kind === "spikelet" ? "#4a2b3f" : enemy.kind === "flit" ? "#5dbb63" : "#7b4a6d";
      renderer.rect(enemy.x, enemy.y, enemy.width, enemy.height, color);
    }
  }
  renderer.ctx.restore();
}

function drawSprite(id: string, x: number, y: number) {
  if (!state.assets) {
    return;
  }
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
    if (state.invulnerableTimer > 0) {
      continue;
    }
    if (!overlaps(state.player, enemy)) {
      continue;
    }

    const stompThreshold = state.player.y + state.player.height - enemy.y;
    if (state.player.vy > 0 && stompThreshold <= 8 && enemy.stompable) {
      enemy.alive = false;
      bouncePlayer(state.player);
      audio.playStomp();
      state.particles.spawn(enemy.x + 8, enemy.y + 8, 8, "#7b4a6d");
      continue;
    }

    applyDamage();
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
      state.particles.spawn(coin.x + 8, coin.y + 8, 6, "#f6d44d");
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
      state.particles.spawn(shard.x + 8, shard.y + 8, 10, "#78c7f0");
    }
  }
}

function overlaps(a: Rect, b: Rect) {
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

function resetRun() {
  state.hud.lives = 3;
  resetLevel();
}

function resetLevel() {
  state.level = createLevel1();
  state.enemies = [createMoomba(160, 160), createSpikelet(240, 160), createFlit(520, 80, 24)];
  state.particles = createParticles();
  state.hud.coins = 0;
  state.hud.shards = 0;
  state.camera.x = 0;
  state.camera.y = 0;
  state.invulnerableTimer = 0;
  resetPlayer();
  updateHud();
}

function setMode(mode: Mode) {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function updateHud() {
  hudLives.textContent = `Lives ${state.hud.lives}`;
  hudCoins.textContent = `Coins ${state.hud.coins}`;
  hudShards.textContent = `Shards ${state.hud.shards}`;
}

function applyDamage() {
  if (state.invulnerableTimer > 0) {
    return;
  }
  state.hud.lives = Math.max(0, state.hud.lives - 1);
  updateHud();
  state.invulnerableTimer = 1;
  resetPlayer();
  if (state.hud.lives === 0) {
    resetRun();
    setMode("title");
  }
}

async function loadAssets() {
  try {
    const [image, atlas] = await Promise.all([
      loadImage("assets/sprites.svg"),
      loadJson<Record<string, AssetFrame>>("assets/sprites.json"),
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
