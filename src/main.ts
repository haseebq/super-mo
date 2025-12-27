import { createLoop } from "./core/loop.js";
import { createRenderer } from "./core/renderer.js";
import { createInput } from "./core/input.js";
import { loadImage, loadJson } from "./core/assets.js";
import { createAudio } from "./core/audio.js";
import { getCurrentFrame, setAnimation, updateAnimation } from "./core/animation.js";
import { bouncePlayer, createPlayer, updatePlayer } from "./game/player.js";
import {
  createLevel1,
  createLevel2,
  createLevel3,
  createLevel4,
  createLevel5,
  createLevel6,
} from "./game/level.js";
import { createMoomba, updateMoomba } from "./game/enemies/moomba.js";
import { createSpikelet, updateSpikelet } from "./game/enemies/spikelet.js";
import { createFlit, updateFlit } from "./game/enemies/flit.js";
import { createParticles } from "./game/particles.js";
import type { Collectible, Level, MovingPlatform, Rect } from "./game/level.js";
import type { Player } from "./game/player.js";
import type { MoombaEnemy } from "./game/enemies/moomba.js";
import type { SpikeletEnemy } from "./game/enemies/spikelet.js";
import type { FlitEnemy } from "./game/enemies/flit.js";
import type { Renderer } from "./core/renderer.js";
import type { InputState } from "./core/input.js";

type AssetFrame = { x: number; y: number; w: number; h: number };
type Assets = { image: HTMLImageElement; atlas: Record<string, AssetFrame> };
type Camera = { x: number; y: number };
type HudState = { lives: number; score: number; coins: number; shards: number };
type Mode = "title" | "playing" | "paused" | "complete" | "death";
type Enemy = MoombaEnemy | SpikeletEnemy | FlitEnemy;

type GameState = {
  player: Player;
  level: Level;
  levelIndex: number;
  enemies: Enemy[];
  particles: ReturnType<typeof createParticles>;
  assets: Assets | null;
  assetsReady: boolean;
  camera: Camera;
  cameraLook: number;
  hud: HudState;
  time: number;
  mode: Mode;
  invulnerableTimer: number;
  titleScroll: number;
  titleSelection: number;
  difficultyIndex: number;
  levelTimeRemaining: number;
  powerupTimer: number;
  speedTimer: number;
  shieldTimer: number;
  backgroundTime: number;
  playerSquash: number;
  deathTimer: number;
  deathVelocity: number;
  deathExitMode: Mode;
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
const hudTime = requireElement<HTMLSpanElement>("#hud-time");
const hudScore = requireElement<HTMLSpanElement>("#hud-score");
const hudCoins = requireElement<HTMLSpanElement>("#hud-coins");
const hudShards = requireElement<HTMLSpanElement>("#hud-shards");
const completeScore = requireElement<HTMLParagraphElement>("#complete-score");
const levelOptions = Array.from(document.querySelectorAll<HTMLSpanElement>(".level-option"));
const difficultyOptions = Array.from(
  document.querySelectorAll<HTMLSpanElement>(".difficulty-option")
);

const spawnPoint = { x: 100, y: 152 };
const LEVEL_TIME_LIMITS = [140, 120, 100];
const LEVELS = [
  createLevel1,
  createLevel2,
  createLevel3,
  createLevel4,
  createLevel5,
  createLevel6,
];
const DIFFICULTY_SPEED = [0.85, 1, 1.2];

const state: GameState = {
  player: createPlayer(spawnPoint.x, spawnPoint.y),
  level: LEVELS[0](),
  levelIndex: 0,
  enemies: [createMoomba(160, 160), createSpikelet(240, 160), createFlit(520, 80, 24)],
  particles: createParticles(),
  assets: null,
  assetsReady: false,
  camera: {
    x: 0,
    y: 0,
  },
  cameraLook: 0,
  hud: {
    lives: 3,
    score: 0,
    coins: 0,
    shards: 0,
  },
  time: 0,
  mode: "title",
  invulnerableTimer: 0,
  titleScroll: 0,
  titleSelection: 0,
  difficultyIndex: 1,
  levelTimeRemaining: LEVEL_TIME_LIMITS[1],
  powerupTimer: 0,
  speedTimer: 0,
  shieldTimer: 0,
  backgroundTime: 0,
  playerSquash: 0,
  deathTimer: 0,
  deathVelocity: 0,
  deathExitMode: "playing",
};

loadAssets();
setMode("title");

function update(dt: number) {
  if (state.mode !== "paused") {
    state.backgroundTime += dt;
    updatePlatforms(state.level.platforms, dt);
  }

  if (state.mode === "title") {
    state.titleScroll = (state.titleScroll + dt * 30) % (state.level.width * state.level.tileSize);
    if (input.consumePress("ArrowRight") || input.consumePress("ArrowDown")) {
      const maxOptions = Math.min(levelOptions.length, LEVELS.length);
      state.titleSelection = (state.titleSelection + 1) % maxOptions;
      updateLevelSelect();
    }
    if (input.consumePress("ArrowLeft") || input.consumePress("ArrowUp")) {
      const maxOptions = Math.min(levelOptions.length, LEVELS.length);
      state.titleSelection = (state.titleSelection - 1 + maxOptions) % maxOptions;
      updateLevelSelect();
    }
    if (input.consumePress("Digit1")) {
      state.difficultyIndex = 0;
      updateDifficultySelect();
    }
    if (input.consumePress("Digit2")) {
      state.difficultyIndex = 1;
      updateDifficultySelect();
    }
    if (input.consumePress("Digit3")) {
      state.difficultyIndex = 2;
      updateDifficultySelect();
    }
    if (input.consumePress("Enter")) {
      state.levelIndex = state.titleSelection;
      resetLevel();
      setMode("playing");
    }
    
    setAnimation(state.player.anim, "run");
    updateAnimation(state.player.anim, dt);

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
    return;
  }

  if (state.mode === "paused") {
    if (input.consumePress("KeyP")) {
      setMode("playing");
    }
    return;
  }

  if (state.mode === "death") {
    updateDeath(dt);
    return;
  }

  if (state.mode === "complete") {
    if (input.consumePress("Enter")) {
      if (state.levelIndex < LEVELS.length - 1) {
        state.levelIndex += 1;
        resetLevel();
        setMode("playing");
      } else {
        resetRun();
        setMode("title");
      }
    }
    return;
  }

  if (input.consumePress("KeyP")) {
    setMode("paused");
    return;
  }

  state.time += dt;
  state.playerSquash = approach(state.playerSquash, 0, dt * 6);
  if (state.invulnerableTimer > 0) {
    state.invulnerableTimer = Math.max(0, state.invulnerableTimer - dt);
  }
  if (state.powerupTimer > 0) {
    state.powerupTimer = Math.max(0, state.powerupTimer - dt);
  }
  const previousTime = Math.ceil(state.levelTimeRemaining);
  if (state.levelTimeRemaining > 0) {
    state.levelTimeRemaining = Math.max(0, state.levelTimeRemaining - dt);
    if (state.levelTimeRemaining === 0) {
      state.invulnerableTimer = 0;
      applyDamage();
    }
  }
  if (state.speedTimer > 0) {
    state.speedTimer = Math.max(0, state.speedTimer - dt);
  }
  if (state.shieldTimer > 0) {
    state.shieldTimer = Math.max(0, state.shieldTimer - dt);
  }
  if (Math.ceil(state.levelTimeRemaining) !== previousTime) {
    updateHud();
  }
  const speedBoost = state.speedTimer > 0 ? 1.35 : 1;
  const wasOnGround = state.player.onGround;
  const prevVy = state.player.vy;
  applyPlatformCarry(state.player, state.level.platforms);
  const prevY = state.player.y;
  const events = updatePlayer(state.player, input, dt, state.level, speedBoost);
  if (events.jumped) {
    audio.playJump();
    state.playerSquash = -0.12;
  }
  if (!wasOnGround && state.player.onGround && prevVy > 120) {
    state.particles.spawn(state.player.x + 8, state.player.y + state.player.height, 6, "#d4a86a");
    state.playerSquash = 0.18;
  }

  if (state.powerupTimer > 0) {
    state.player.vy -= 40 * dt;
  }

  handleCollectibles();
  updateCamera(dt);
  state.particles.update(dt);
  if (overlaps(state.player, state.level.goal)) {
    state.hud.score += 500;
    updateHud();
    audio.playGoal();
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

  resolvePlatformCollisions(state.player, state.level.platforms, prevY);

  handleEnemyCollisions();
}

function render() {
  renderer.clear("#78c7f0");

  if (state.mode === "title") {
    renderTitlePreview();
    return;
  }

  renderer.ctx.save();
  renderer.ctx.translate(-state.camera.x, -state.camera.y);
  drawBackground(state.camera.x, state.backgroundTime);
  drawLevel(state.level);
  drawPlatforms(state.level.platforms);
  drawCollectibles();
  drawLandmark();
  const shouldDrawPlayer =
    state.invulnerableTimer === 0 || Math.floor(state.time * 12) % 2 === 0;
  if (shouldDrawPlayer) {
    if (state.assetsReady) {
      const squash = state.playerSquash;
      const scaleX = Math.max(0.7, 1 - squash * 0.35);
      const scaleY = Math.max(0.7, 1 + squash);
      drawSpriteScaled(
        getCurrentFrame(state.player.anim),
        state.player.x,
        state.player.y,
        scaleX,
        scaleY,
        state.player.facing < 0
      );
    } else {
      renderer.rect(state.player.x, state.player.y, state.player.width, state.player.height, "#e04b3a");
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      continue;
    }
    if (state.assetsReady) {
      if (enemy.kind === "moomba") {
        drawSprite(getCurrentFrame(enemy.anim), enemy.x, enemy.y, enemy.vx > 0);
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

function drawPlatforms(platforms: MovingPlatform[]) {
  for (const platform of platforms) {
    const color = platform.kind === "vertical" ? "#7b4a6d" : "#4a2b3f";
    renderer.rect(platform.x, platform.y, platform.width, platform.height, color);
  }
}

function drawCloud(x: number, y: number, scale: number, tone: string) {
  const ctx = renderer.ctx;
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.ellipse(x, y, 18 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 18 * scale, y - 4 * scale, 16 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 36 * scale, y, 20 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 20 * scale, y + 6 * scale, 22 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHill(x: number, baseY: number, width: number, height: number, fill: string, shadow: string) {
  const ctx = renderer.ctx;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + width * 0.5, baseY - height, x + width, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.15, baseY);
  ctx.quadraticCurveTo(x + width * 0.45, baseY - height * 0.75, x + width * 0.7, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawWaterfall(x: number, y: number, height: number) {
  const ctx = renderer.ctx;
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "#b9ecff");
  gradient.addColorStop(0.5, "#78c7f0");
  gradient.addColorStop(1, "#4aa0d0");

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, 18, height);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(x + 3, y + 6, 4, height - 12);
  ctx.fillRect(x + 10, y + 10, 3, height - 20);
}

function drawBackground(camX: number, time: number) {
  renderer.ctx.save();
  renderer.ctx.translate(camX * 0.3, 0);

  const { width, tileSize } = state.level;
  const horizonY = 100;
  const totalWidth = width * tileSize;
  const cloudOffset = (time * 12) % 180;
  const farOffset = (time * 6) % 220;

  for (let x = -180; x < totalWidth + 180; x += 180) {
    const drift = x + cloudOffset;
    drawCloud(drift + 20, 26, 0.9, "#ffffff");
    drawCloud(drift + 70, 20, 1.1, "#f3f6ff");
  }

  for (let x = -220; x < totalWidth + 220; x += 220) {
    const drift = x + farOffset;
    drawHill(drift, horizonY + 70, 200, 90, "#b7d9ff", "#9bc7ff");
    drawHill(drift + 50, horizonY + 80, 230, 110, "#9bc7ff", "#7fb2f0");
  }

  for (let x = 0; x < totalWidth; x += 260) {
    const sway = Math.sin(time * 1.4 + x * 0.01) * 4;
    const baseX = x + 40;
    drawWaterfall(baseX + sway, 70, 80);
    drawHill(baseX - 30, 80, 90, 60, "#78c7f0", "#4aa0d0");
  }

  renderer.ctx.restore();
}

function drawCollectibles() {
  for (const coin of state.level.coins) {
    if (coin.collected) {
      continue;
    }
    const bob = Math.sin(state.time * 4 + coin.x * 0.05) * 1.5;
    if (state.assetsReady) {
      drawSprite("coin", coin.x, coin.y + bob);
    } else {
      renderer.rect(coin.x + 4, coin.y + 4 + bob, 8, 8, "#f6d44d");
    }
  }

  for (const shard of state.level.shards) {
    if (shard.collected) {
      continue;
    }
    const bob = Math.sin(state.time * 4 + shard.x * 0.05) * 1.5;
    if (state.assetsReady) {
      drawSprite("shard", shard.x, shard.y + bob);
    } else {
      renderer.rect(shard.x + 4, shard.y + 4 + bob, 8, 8, "#78c7f0");
    }
  }

  for (const powerup of state.level.powerups) {
    if (powerup.collected) {
      continue;
    }
    const bob = Math.sin(state.time * 4 + powerup.x * 0.05) * 1.5;
    const outer =
      powerup.kind === "spring"
        ? "#78c7f0"
        : powerup.kind === "speed"
          ? "#f6d44d"
          : "#5dbb63";
    const inner =
      powerup.kind === "spring"
        ? "#f6d44d"
        : powerup.kind === "speed"
          ? "#e04b3a"
          : "#ffffff";
    renderer.rect(powerup.x + 2, powerup.y + 2 + bob, 12, 12, outer);
    renderer.rect(powerup.x + 5, powerup.y + 5 + bob, 6, 6, inner);
  }
}

function drawLandmark() {
  const { landmark } = state.level;
  renderer.rect(landmark.x, landmark.y, landmark.width, landmark.height, "#2b2b2b");
  renderer.rect(landmark.x + 4, landmark.y + 4, landmark.width - 8, landmark.height - 8, "#e04b3a");
  renderer.rect(landmark.x + 12, landmark.y + 20, 8, 16, "#f6d44d");
}

function renderTitlePreview() {
  const levelWidth = state.level.width * state.level.tileSize;
  const levelHeight = state.level.height * state.level.tileSize;
  const scrollX = state.titleScroll % levelWidth;
  const offsetY = canvas.height - levelHeight;

  renderer.ctx.save();
  renderer.ctx.translate(-scrollX, offsetY);

  const drawScene = (camX: number) => {
    drawBackground(camX, state.backgroundTime);
    drawLevel(state.level);
    drawPlatforms(state.level.platforms);
    drawCollectibles();
    drawLandmark();
    
    // Render player preview if we want it on title screen
    if (state.assetsReady) {
      drawSprite(getCurrentFrame(state.player.anim), state.player.x, state.player.y, state.player.facing < 0);
    }

    for (const enemy of state.enemies) {
      if (!enemy.alive) {
        continue;
      }
      if (state.assetsReady) {
        if (enemy.kind === "moomba") {
          drawSprite(getCurrentFrame(enemy.anim), enemy.x, enemy.y, enemy.vx > 0);
        } else {
          const spriteId =
            enemy.kind === "spikelet"
              ? "spikelet"
              : "flit";
          drawSprite(spriteId, enemy.x, enemy.y);
        }
      } else {
        const color =
          enemy.kind === "spikelet"
            ? "#4a2b3f"
            : enemy.kind === "flit"
              ? "#5dbb63"
              : "#7b4a6d";
        renderer.rect(enemy.x, enemy.y, enemy.width, enemy.height, color);
      }
    }
  };

  drawScene(scrollX);

  // Seamless wrap: draw a second copy if the first one is scrolling off
  if (scrollX > levelWidth - canvas.width) {
    renderer.ctx.save();
    renderer.ctx.translate(levelWidth, 0);
    drawScene(scrollX - levelWidth);
    renderer.ctx.restore();
  }

  renderer.ctx.restore();
}

function drawSprite(id: string, x: number, y: number, flipX = false) {
  if (!state.assets) {
    return;
  }
  const frame = state.assets.atlas[id];
  if (!frame) {
    return;
  }
  renderer.sprite(state.assets.image, frame.x, frame.y, frame.w, frame.h, x, y, frame.w, frame.h, flipX);
}

function drawSpriteScaled(
  id: string,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  flipX = false
) {
  if (!state.assets) {
    return;
  }
  const frame = state.assets.atlas[id];
  if (!frame) {
    return;
  }
  const width = frame.w * scaleX;
  const height = frame.h * scaleY;
  const dx = x + (frame.w - width) / 2;
  const dy = y + (frame.h - height);
  renderer.sprite(state.assets.image, frame.x, frame.y, frame.w, frame.h, dx, dy, width, height, flipX);
}

function handleEnemyCollisions() {
  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      continue;
    }
    if (state.invulnerableTimer > 0 || state.shieldTimer > 0) {
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
      state.hud.score += 100;
      updateHud();
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
      state.hud.score += 10;
      updateHud();
      audio.playCoin();
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
      state.hud.score += 50;
      updateHud();
      audio.playShard();
      state.particles.spawn(shard.x + 8, shard.y + 8, 10, "#78c7f0");
    }
  }

  for (const powerup of state.level.powerups) {
    if (powerup.collected) {
      continue;
    }
    if (overlaps(state.player, powerup)) {
      powerup.collected = true;
      if (powerup.kind === "spring") {
        state.powerupTimer = 6;
      } else if (powerup.kind === "speed") {
        state.speedTimer = 6;
      } else {
        state.shieldTimer = 6;
      }
      state.hud.score += 25;
      updateHud();
      audio.playPowerup();
      state.particles.spawn(powerup.x + 8, powerup.y + 8, 12, "#78c7f0");
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
  state.player.platformId = null;
  setAnimation(state.player.anim, "idle");
}

function resetRun() {
  state.hud.lives = 3;
  state.hud.score = 0;
  state.levelIndex = 0;
  state.titleSelection = 0;
  resetLevel();
}

function resetLevel() {
  state.level = LEVELS[state.levelIndex]();
  state.enemies = [createMoomba(160, 160), createSpikelet(240, 160), createFlit(520, 80, 24)];
  applyDifficultyToEnemies(state.enemies, DIFFICULTY_SPEED[state.difficultyIndex]);
  state.particles = createParticles();
  state.hud.coins = 0;
  state.hud.shards = 0;
  state.camera.x = 0;
  state.camera.y = 0;
  state.invulnerableTimer = 0;
  state.powerupTimer = 0;
  state.speedTimer = 0;
  state.shieldTimer = 0;
  state.levelTimeRemaining = LEVEL_TIME_LIMITS[state.difficultyIndex];
  state.deathTimer = 0;
  state.deathVelocity = 0;
  resetPlayer();
  updateHud();
  updateDifficultySelect();
}

function setMode(mode: Mode) {
  state.mode = mode;
  const isTitle = mode === "title";
  const isPaused = mode === "paused";
  const isComplete = mode === "complete";
  const isDeath = mode === "death";

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

  if (isTitle) {
    updateLevelSelect();
    updateDifficultySelect();
  }
  if (isDeath) {
    input.reset();
  }
}

function updateCamera(dt: number) {
  const levelWidth = state.level.width * state.level.tileSize;
  const maxX = Math.max(0, levelWidth - canvas.width);
  const targetLook = Math.sign(state.player.vx) * 24;
  state.cameraLook = approach(state.cameraLook, targetLook, 180 * dt);
  const targetX = state.player.x + state.player.width / 2 - canvas.width / 2 + state.cameraLook;
  const offset = targetX - state.camera.x;
  const deadZone = 6;
  if (Math.abs(offset) > deadZone) {
    const smoothing = Math.min(1, 8 * dt);
    state.camera.x += offset * smoothing;
  }
  state.camera.x = clamp(state.camera.x, 0, maxX);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function approach(current: number, target: number, delta: number) {
  if (current < target) {
    return Math.min(current + delta, target);
  }
  if (current > target) {
    return Math.max(current - delta, target);
  }
  return current;
}

function updateHud() {
  hudLives.textContent = `Lives ${state.hud.lives}`;
  hudTime.textContent = `Time ${Math.ceil(state.levelTimeRemaining)}`;
  hudScore.textContent = `Score ${state.hud.score}`;
  hudCoins.textContent = `Coins ${state.hud.coins}`;
  hudShards.textContent = `Shards ${state.hud.shards}`;
  completeScore.textContent = `Score ${state.hud.score}`;
}

function updateLevelSelect() {
  const maxOptions = Math.min(levelOptions.length, LEVELS.length);
  for (let i = 0; i < levelOptions.length; i += 1) {
    levelOptions[i].classList.toggle("is-selected", i === state.titleSelection && i < maxOptions);
  }
}

function updateDifficultySelect() {
  for (let i = 0; i < difficultyOptions.length; i += 1) {
    difficultyOptions[i].classList.toggle("is-selected", i === state.difficultyIndex);
  }
}

function updatePlatforms(platforms: MovingPlatform[], dt: number) {
  const twoPi = Math.PI * 2;
  for (const platform of platforms) {
    const prevX = platform.x;
    const prevY = platform.y;
    if (platform.kind === "vertical") {
      platform.angle += (twoPi / platform.period) * dt;
      platform.y = platform.baseY + Math.sin(platform.angle) * platform.amplitude;
      platform.x = platform.baseX;
    } else {
      platform.angle += (twoPi / platform.period) * dt;
      platform.x = platform.baseX + Math.cos(platform.angle) * platform.radius;
      platform.y = platform.baseY + Math.sin(platform.angle) * platform.radius;
    }
    platform.deltaX = platform.x - prevX;
    platform.deltaY = platform.y - prevY;
  }
}

function applyPlatformCarry(player: Player, platforms: MovingPlatform[]) {
  if (player.platformId === null || !player.onGround) {
    return;
  }
  const platform = platforms[player.platformId];
  if (!platform) {
    player.platformId = null;
    return;
  }
  player.x += platform.deltaX;
  player.y += platform.deltaY;
}

function resolvePlatformCollisions(
  player: Player,
  platforms: MovingPlatform[],
  prevY: number
) {
  const prevBottom = prevY + player.height;
  player.platformId = null;
  for (let i = 0; i < platforms.length; i += 1) {
    const platform = platforms[i];
    if (
      player.x + player.width > platform.x &&
      player.x < platform.x + platform.width &&
      player.y + player.height >= platform.y &&
      player.y + player.height <= platform.y + platform.height
    ) {
      if (player.vy >= 0 && prevBottom <= platform.y + 4) {
        player.y = platform.y - player.height;
        player.vy = 0;
        player.onGround = true;
        player.platformId = i;
        break;
      }
    }
  }
}

function applyDifficultyToEnemies(enemies: Enemy[], multiplier: number) {
  for (const enemy of enemies) {
    if (enemy.kind === "flit") {
      enemy.vy *= multiplier;
      continue;
    }
    enemy.vx *= multiplier;
  }
}

function startDeath(exitMode: Mode) {
  state.deathTimer = 1.25;
  state.deathVelocity = -220;
  state.deathExitMode = exitMode;
  state.player.vx = 0;
  state.player.vy = 0;
  setAnimation(state.player.anim, "death");
  setMode("death");
}

function updateDeath(dt: number) {
  state.deathTimer = Math.max(0, state.deathTimer - dt);
  state.deathVelocity += 520 * dt;
  state.player.y += state.deathVelocity * dt;
  updateAnimation(state.player.anim, dt);

  if (state.deathTimer === 0) {
    if (state.deathExitMode === "title") {
      resetRun();
      setMode("title");
    } else {
      resetPlayer();
      state.invulnerableTimer = 1;
      setMode("playing");
    }
  }
}

function applyDamage() {
  if (state.invulnerableTimer > 0) {
    return;
  }
  state.hud.lives = Math.max(0, state.hud.lives - 1);
  updateHud();
  audio.playHurt();
  if (state.hud.lives === 0) {
    startDeath("title");
  } else {
    startDeath("playing");
  }
}

async function loadAssets() {
  try {
    let image: HTMLImageElement | null = null;
    let atlas: Record<string, AssetFrame> | null = null;
    try {
      atlas = await loadJson<Record<string, AssetFrame>>("assets/sprites.prod.json");
      image = await loadImage("assets/sprites.prod.png");
    } catch (error) {
      console.warn("Production sprites missing, falling back to placeholder assets.", error);
      atlas = await loadJson<Record<string, AssetFrame>>("assets/sprites.json");
      image = await loadImage("assets/sprites.svg");
    }
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
