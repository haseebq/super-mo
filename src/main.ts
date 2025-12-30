import { createLoop } from "./core/loop.js";
import { activeRules, resetRules } from "./game/modding/rules.js";
import { ModdingAPI } from "./game/modding/api.js";
import { KeywordModdingProvider } from "./game/modding/provider.js";
import { createRenderer } from "./core/renderer.js";
import { createInput } from "./core/input.js";
import { loadImage, loadJson } from "./core/assets.js";
import { createAudio } from "./core/audio.js";
import {
  getCurrentFrame,
  setAnimation,
  updateAnimation,
} from "./core/animation.js";
import { bouncePlayer, createPlayer, updatePlayer } from "./game/player.js";
import {
  createLevel1,
  createLevel2,
  createLevel3,
  createLevel4,
  createLevel5,
  createLevel6,
  isSpike,
} from "./game/level.js";
import { createMoomba, updateMoomba } from "./game/enemies/moomba.js";
import { createSpikelet, updateSpikelet } from "./game/enemies/spikelet.js";
import { createFlit, updateFlit } from "./game/enemies/flit.js";
import { createParticles } from "./game/particles.js";
import type {
  Checkpoint,
  Collectible,
  Level,
  MovingPlatform,
  Rect,
} from "./game/level.js";
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
type Mode =
  | "title"
  | "story"
  | "intro"
  | "playing"
  | "paused"
  | "complete"
  | "death";
type Enemy = MoombaEnemy | SpikeletEnemy | FlitEnemy;

type GameState = {
  player: Player;
  level: Level;
  levelIndex: number;
  enemies: Enemy[];
  particles: ReturnType<typeof createParticles>;
  assets: Assets | null;
  assetsReady: boolean;
  assetScale: number;
  camera: Camera;
  cameraLook: number;
  cameraLookY: number;
  hud: HudState;
  time: number;
  mode: Mode;
  invulnerableTimer: number;
  titleScroll: number;
  titleSelection: number;
  pauseSelection: number;
  difficultyIndex: number;
  levelTimeRemaining: number;
  powerupTimer: number;
  speedTimer: number;
  shieldTimer: number;
  backgroundTime: number;
  playerSquash: number;
  completeTimeBonus: number;
  completeGoalBonus: number;
  completeCoinScore: number;
  completeShardScore: number;
  tutorialSeen: boolean;
  hitFlashTimer: number;
  knockbackTimer: number;
  knockbackVelocity: number;
  cameraShakeTimer: number;
  cameraShakeStrength: number;
  audioMuted: boolean;
  activeCheckpoint: Checkpoint | null;
  controls: {
    jump: string;
    run: string;
  };
  storyIndex: number;
  storyCharCount: number;
  storyTimer: number;
  storySeen: boolean;
  debugTiles: boolean;
  debugLabels: boolean;
  debugPaint: boolean;
  deathTimer: number;
  deathVelocity: number;
  deathExitMode: Mode;
};

declare global {
  interface Window {
    __SUPER_MO__?: {
      state: GameState;
      modding: ModdingAPI;
      setMode: (mode: Mode) => void;
      resetPlayer: () => void;
      setDebug: (flags: { tiles?: boolean; labels?: boolean }) => void;
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
const introOverlay = requireElement<HTMLDivElement>(".intro-overlay");
const storyOverlay = requireElement<HTMLDivElement>(".story-overlay");
const completeOverlay = requireElement<HTMLDivElement>(".complete-overlay");
const hudLives = requireElement<HTMLSpanElement>("#hud-lives");
const hudTime = requireElement<HTMLSpanElement>("#hud-time");
const hudScore = requireElement<HTMLSpanElement>("#hud-score");
const hudCoins = requireElement<HTMLSpanElement>("#hud-coins");
const hudShards = requireElement<HTMLSpanElement>("#hud-shards");
const hudBuffs = requireElement<HTMLSpanElement>("#hud-buffs");
const hudAudio = requireElement<HTMLSpanElement>("#hud-audio");
const hudCheckpoint = requireElement<HTMLSpanElement>("#hud-checkpoint");
const completeScore = requireElement<HTMLParagraphElement>("#complete-score");
const completeBreakdown = requireElement<HTMLParagraphElement>(
  "#complete-breakdown"
);
const introTitle = requireElement<HTMLHeadingElement>("#intro-title");
const introGoal = requireElement<HTMLParagraphElement>("#intro-goal");
const introCollect = requireElement<HTMLParagraphElement>("#intro-collect");
const introDifficulty =
  requireElement<HTMLParagraphElement>("#intro-difficulty");
const storySpeaker = requireElement<HTMLParagraphElement>("#story-speaker");
const storyText = requireElement<HTMLParagraphElement>("#story-text");
const controlHints = Array.from(
  document.querySelectorAll<HTMLParagraphElement>(".controls")
);
const debugToggle = document.querySelector<HTMLInputElement>("#debug-toggle");
const pauseOptions = Array.from(
  document.querySelectorAll<HTMLSpanElement>(".pause-option")
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
const DEFAULT_CONTROLS = { jump: "KeyZ", run: "KeyX" };
const STORY_LINES = [
  { speaker: "Guide", text: "Welcome, runner. The valley is waking up." },
  {
    speaker: "Guide",
    text: "Reach the goal flag and gather coins and shards.",
  },
  { speaker: "Guide", text: "Use your jump and run boosts to cross the gaps." },
  { speaker: "Guide", text: "Each checkpoint will hold your progress." },
];
const DEBUG_FLAGS = new URLSearchParams(window.location.search);

function syncDebugToggle() {
  if (!debugToggle) {
    return;
  }
  debugToggle.checked = state.debugTiles || state.debugLabels;
}

function setDebugState(tiles: boolean, labels: boolean, updateUrl = true) {
  const nextPaint = tiles || labels || DEBUG_FLAGS.has("debugPaint");
  const paintChanged = nextPaint !== state.debugPaint;
  state.debugTiles = tiles;
  state.debugLabels = labels;
  state.debugPaint = nextPaint;
  syncDebugToggle();
  if (!updateUrl) {
    return;
  }
  const url = new URL(window.location.href);
  if (tiles) {
    url.searchParams.set("debugTiles", "1");
  } else {
    url.searchParams.delete("debugTiles");
  }
  if (labels) {
    url.searchParams.set("debugLabels", "1");
  } else {
    url.searchParams.delete("debugLabels");
  }
  window.history.replaceState(null, "", url.toString());
  if (paintChanged) {
    loadAssets();
  }
}

function loadControls() {
  try {
    const raw = localStorage.getItem("supermo-controls");
    if (!raw) {
      return { ...DEFAULT_CONTROLS };
    }
    const parsed = JSON.parse(raw) as { jump?: string; run?: string };
    return {
      jump: parsed.jump || DEFAULT_CONTROLS.jump,
      run: parsed.run || DEFAULT_CONTROLS.run,
    };
  } catch {
    return { ...DEFAULT_CONTROLS };
  }
}

const state: GameState = {
  player: createPlayer(spawnPoint.x, spawnPoint.y),
  level: LEVELS[0](),
  levelIndex: 0,
  enemies: [
    createMoomba(160, 160),
    createSpikelet(240, 160),
    createFlit(520, 80, 24),
  ],
  particles: createParticles(),
  assets: null,
  assetsReady: false,
  assetScale: 1,
  camera: {
    x: 0,
    y: 0,
  },
  cameraLook: 0,
  cameraLookY: 0,
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
  pauseSelection: 0,
  difficultyIndex: 1,
  levelTimeRemaining: LEVEL_TIME_LIMITS[1],
  powerupTimer: 0,
  speedTimer: 0,
  shieldTimer: 0,
  backgroundTime: 0,
  playerSquash: 0,
  completeTimeBonus: 0,
  completeGoalBonus: 0,
  completeCoinScore: 0,
  completeShardScore: 0,
  tutorialSeen: false,
  hitFlashTimer: 0,
  knockbackTimer: 0,
  knockbackVelocity: 0,
  cameraShakeTimer: 0,
  cameraShakeStrength: 0,
  audioMuted: false,
  activeCheckpoint: null,
  controls: loadControls(),
  storyIndex: 0,
  storyCharCount: 0,
  storyTimer: 0,
  storySeen: false,
  debugTiles: DEBUG_FLAGS.has("debugTiles"),
  debugLabels: DEBUG_FLAGS.has("debugLabels"),
  debugPaint:
    DEBUG_FLAGS.has("debugPaint") ||
    DEBUG_FLAGS.has("debugTiles") ||
    DEBUG_FLAGS.has("debugLabels"),
  deathTimer: 0,
  deathVelocity: 0,
  deathExitMode: "playing",
};

const neutralInput: InputState = {
  isDown: () => false,
  consumePress: () => false,
  press: () => {},
  reset: () => {},
};

loadAssets();
setMode("title");
syncDebugToggle();
debugToggle?.addEventListener("change", () => {
  const enabled = Boolean(debugToggle?.checked);
  setDebugState(enabled, enabled);
});

function update(dt: number) {
  if (state.mode !== "paused") {
    state.backgroundTime += dt;
    updatePlatforms(state.level.platforms, dt);
  }

  if (state.mode === "title") {
    state.titleScroll =
      (state.titleScroll + dt * 30) %
      (state.level.width * state.level.tileSize);
    if (input.consumePress("KeyJ")) {
      state.controls.jump = state.controls.jump === "KeyZ" ? "Space" : "KeyZ";
      localStorage.setItem("supermo-controls", JSON.stringify(state.controls));
      updateControlHints();
    }
    if (input.consumePress("KeyR")) {
      state.controls.run = state.controls.run === "KeyX" ? "ShiftLeft" : "KeyX";
      localStorage.setItem("supermo-controls", JSON.stringify(state.controls));
      updateControlHints();
    }
    if (input.consumePress("Enter")) {
      state.levelIndex = 0;
      resetLevel();
      setMode("intro");
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

  if (state.mode === "story") {
    updateStory(dt);
    return;
  }

  if (state.mode === "intro") {
    if (input.consumePress("Enter")) {
      setMode("playing");
    }
    return;
  }

  if (state.mode === "paused") {
    if (input.consumePress("KeyP")) {
      setMode("playing");
    }
    if (input.consumePress("ArrowDown")) {
      state.pauseSelection = (state.pauseSelection + 1) % pauseOptions.length;
      updatePauseMenu();
    }
    if (input.consumePress("ArrowUp")) {
      state.pauseSelection =
        (state.pauseSelection - 1 + pauseOptions.length) % pauseOptions.length;
      updatePauseMenu();
    }
    if (input.consumePress("Enter")) {
      const action = pauseOptions[state.pauseSelection]?.dataset.action;
      if (action === "restart") {
        resetLevel();
        setMode("playing");
      } else if (action === "quit") {
        resetRun();
        setMode("title");
      } else {
        setMode("playing");
      }
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
        setMode("intro");
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
  if (input.consumePress("KeyM")) {
    state.audioMuted = !state.audioMuted;
    audio.setMuted(state.audioMuted);
    updateHud();
  }

  state.time += dt;
  state.playerSquash = approach(state.playerSquash, 0, dt * 6);
  if (state.hitFlashTimer > 0) {
    state.hitFlashTimer = Math.max(0, state.hitFlashTimer - dt);
  }
  if (state.knockbackTimer > 0) {
    state.knockbackTimer = Math.max(0, state.knockbackTimer - dt);
  }
  if (state.cameraShakeTimer > 0) {
    state.cameraShakeTimer = Math.max(0, state.cameraShakeTimer - dt);
    if (state.cameraShakeTimer === 0) {
      state.cameraShakeStrength = 0;
    }
  }
  if (state.invulnerableTimer > 0) {
    state.invulnerableTimer = Math.max(0, state.invulnerableTimer - dt);
  }
  if (state.powerupTimer > 0) {
    state.powerupTimer = Math.max(0, state.powerupTimer - dt);
  }
  const previousTime = Math.ceil(state.levelTimeRemaining);
  const prevPower = Math.ceil(state.powerupTimer);
  const prevSpeed = Math.ceil(state.speedTimer);
  const prevShield = Math.ceil(state.shieldTimer);
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
  const timeChanged = Math.ceil(state.levelTimeRemaining) !== previousTime;
  const buffsChanged =
    Math.ceil(state.powerupTimer) !== prevPower ||
    Math.ceil(state.speedTimer) !== prevSpeed ||
    Math.ceil(state.shieldTimer) !== prevShield;
  if (timeChanged || buffsChanged) {
    updateHud();
  }
  const speedBoost = state.speedTimer > 0 ? 1.35 : 1;
  const wasOnGround = state.player.onGround;
  const prevVy = state.player.vy;
  applyPlatformCarry(state.player, state.level.platforms);
  const prevY = state.player.y;
  if (state.knockbackTimer > 0) {
    state.player.vx = state.knockbackVelocity;
  }
  const controlInput = state.knockbackTimer > 0 ? neutralInput : input;
  const events = updatePlayer(
    state.player,
    controlInput,
    dt,
    state.level,
    speedBoost,
    state.controls
  );
  if (events.jumped) {
    audio.playJump();
    state.playerSquash = -0.12;
  }
  if (!wasOnGround && state.player.onGround && prevVy > 120) {
    state.particles.spawn(
      state.player.x + 8,
      state.player.y + state.player.height,
      6,
      "#d4a86a"
    );
    state.playerSquash = 0.18;
  }
  if (prevVy < 0 && state.player.vy >= 0) {
    state.particles.spawn(state.player.x + 8, state.player.y + 4, 4, "#f6d44d");
  }

  if (state.powerupTimer > 0) {
    state.player.vy -= 40 * dt;
  }

  handleCollectibles();
  handleCheckpoints();
  updateCamera(dt);
  state.particles.update(dt);
  if (overlaps(state.player, state.level.goal)) {
    if (state.levelIndex === 0) {
      state.tutorialSeen = true;
    }
    const timeBonus = Math.ceil(state.levelTimeRemaining) * 10;
    state.completeTimeBonus = timeBonus;
    state.completeGoalBonus = 500;
    state.completeCoinScore = state.hud.coins * activeRules.scoring.coinValue;
    state.completeShardScore =
      state.hud.shards * activeRules.scoring.shardValue;
    state.hud.score += state.completeGoalBonus + state.completeTimeBonus;
    updateHud();
    updateCompleteSummary();
    audio.playGoal();
    triggerCameraShake(0.25, 6);
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

  for (const enemy of state.enemies) {
    if ("stompedTimer" in enemy && enemy.stompedTimer > 0) {
      enemy.stompedTimer = Math.max(0, enemy.stompedTimer - dt);
    }
  }

  resolvePlatformCollisions(state.player, state.level.platforms, prevY);

  handleEnemyCollisions();

  // Check for pit death (falling below level)
  const levelHeight = state.level.height * state.level.tileSize;
  if (state.player.y > levelHeight + 32) {
    applyDamage();
  }

  // Check for spike tile collision
  handleSpikeCollisions();
}

function handleSpikeCollisions() {
  if (state.invulnerableTimer > 0 || state.shieldTimer > 0) {
    return;
  }
  const { tileSize, tiles, width } = state.level;
  const player = state.player;
  // Check corners of player bounding box
  const corners = [
    { x: player.x + 2, y: player.y + 2 },
    { x: player.x + player.width - 2, y: player.y + 2 },
    { x: player.x + 2, y: player.y + player.height - 2 },
    { x: player.x + player.width - 2, y: player.y + player.height - 2 },
  ];
  for (const corner of corners) {
    const tx = Math.floor(corner.x / tileSize);
    const ty = Math.floor(corner.y / tileSize);
    const id = tiles[ty * width + tx] ?? 0;
    if (isSpike(id)) {
      applyDamage();
      return;
    }
  }
}

function render() {
  renderer.clear("#78c7f0");

  if (state.mode === "title") {
    renderTitlePreview();
    return;
  }

  renderer.ctx.save();
  const shakeMagnitude =
    state.cameraShakeTimer > 0 ? state.cameraShakeStrength : 0;
  const shakeX = shakeMagnitude ? (Math.random() - 0.5) * shakeMagnitude : 0;
  const shakeY = shakeMagnitude ? (Math.random() - 0.5) * shakeMagnitude : 0;
  renderer.ctx.translate(-state.camera.x + shakeX, -state.camera.y + shakeY);
  drawBackground(state.camera.x, state.backgroundTime);
  drawLevel(state.level);
  if (state.debugTiles) {
    drawTileDebug(state.level);
  }
  drawPlatforms(state.level.platforms);
  drawCollectibles();
  drawCheckpoints();
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
      if (state.hitFlashTimer > 0) {
        renderer.ctx.save();
        renderer.ctx.globalAlpha = 0.4;
        renderer.rect(
          state.player.x,
          state.player.y,
          state.player.width,
          state.player.height,
          "#ff5b4a"
        );
        renderer.ctx.restore();
      }
    } else {
      renderer.rect(
        state.player.x,
        state.player.y,
        state.player.width,
        state.player.height,
        "#e04b3a"
      );
    }
  }

  for (const enemy of state.enemies) {
    if (
      !enemy.alive &&
      (!("stompedTimer" in enemy) || enemy.stompedTimer === 0)
    ) {
      continue;
    }
    if (state.assetsReady) {
      const isStomped = "stompedTimer" in enemy && enemy.stompedTimer > 0;
      if (enemy.kind === "moomba") {
        if (isStomped) {
          drawSpriteScaled(
            "moomba",
            enemy.x,
            enemy.y + 6,
            1.1,
            0.4,
            enemy.vx > 0
          );
        } else {
          drawSprite(
            getCurrentFrame(enemy.anim),
            enemy.x,
            enemy.y,
            enemy.vx > 0
          );
        }
      }
      if (enemy.kind === "spikelet") {
        drawSprite("spikelet", enemy.x, enemy.y);
      }
      if (enemy.kind === "flit") {
        if (isStomped) {
          drawSpriteScaled("flit", enemy.x, enemy.y + 6, 1.1, 0.4);
        } else {
          drawSprite("flit", enemy.x, enemy.y);
        }
      }
    } else {
      const color = enemy.kind === "spikelet" ? "#4a2b3f" : "#7b4a6d";
      const tint = enemy.kind === "flit" ? "#5dbb63" : color;
      renderer.rect(enemy.x, enemy.y, enemy.width, enemy.height, tint);
    }
  }

  if (state.debugLabels) {
    drawSpriteLabels();
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
      if (state.assetsReady && id === 4) {
        drawSprite("spikelet", x * tileSize, y * tileSize);
        continue;
      }
      let color = "#d4a86a";
      if (id === 2) {
        color = "#f6d44d";
      }
      if (id === 3) {
        color = "#5dbb63";
      }
      if (id === 4) {
        color = "#e04b3a"; // Red for spikes
      }
      renderer.rect(x * tileSize, y * tileSize, tileSize, tileSize, color);
    }
  }
}

function drawTileDebug(level: Level) {
  const { width, height, tileSize, tiles } = level;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = tiles[y * width + x];
      if (id === 0) {
        continue;
      }
      renderer.text(String(id), x * tileSize + 4, y * tileSize + 12, "#2b2b2b");
    }
  }
}

function drawSpriteLabels() {
  renderer.text(
    getCurrentFrame(state.player.anim),
    state.player.x,
    state.player.y - 6,
    "#2b2b2b"
  );
  for (const enemy of state.enemies) {
    if (
      !enemy.alive &&
      (!("stompedTimer" in enemy) || enemy.stompedTimer === 0)
    ) {
      continue;
    }
    const label =
      enemy.kind === "moomba"
        ? getCurrentFrame(enemy.anim)
        : enemy.kind === "spikelet"
        ? "spikelet"
        : "flit";
    renderer.text(label, enemy.x, enemy.y - 6, "#2b2b2b");
  }
}

function drawPlatforms(platforms: MovingPlatform[]) {
  for (const platform of platforms) {
    const color = platform.kind === "vertical" ? "#7b4a6d" : "#4a2b3f";
    renderer.rect(
      platform.x,
      platform.y,
      platform.width,
      platform.height,
      color
    );
  }
}

function drawCloud(x: number, y: number, scale: number, tone: string) {
  const ctx = renderer.ctx;
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.ellipse(x, y, 18 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(
    x + 18 * scale,
    y - 4 * scale,
    16 * scale,
    12 * scale,
    0,
    0,
    Math.PI * 2
  );
  ctx.ellipse(x + 36 * scale, y, 20 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(
    x + 20 * scale,
    y + 6 * scale,
    22 * scale,
    10 * scale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawHill(
  x: number,
  baseY: number,
  width: number,
  height: number,
  fill: string,
  shadow: string
) {
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
  ctx.quadraticCurveTo(
    x + width * 0.45,
    baseY - height * 0.75,
    x + width * 0.7,
    baseY
  );
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

function drawCheckpoints() {
  for (const checkpoint of state.level.checkpoints) {
    const poleColor = checkpoint.activated ? "#4aa0d0" : "#2b2b2b";
    const flagColor = checkpoint.activated ? "#f6d44d" : "#ffffff";
    renderer.rect(checkpoint.x + 6, checkpoint.y - 12, 3, 20, poleColor);
    renderer.rect(checkpoint.x + 6, checkpoint.y - 12, 12, 6, flagColor);
  }
}

function handleCheckpoints() {
  for (const checkpoint of state.level.checkpoints) {
    if (checkpoint.activated) {
      continue;
    }
    if (overlaps(state.player, checkpoint)) {
      checkpoint.activated = true;
      state.activeCheckpoint = checkpoint;
      updateHud();
    }
  }
}

function drawPrompts() {
  if (state.tutorialSeen || state.levelIndex !== 0) {
    return;
  }
  const prompts = [
    { x: 64, y: 120, text: "Arrows: Move" },
    { x: 160, y: 96, text: `${formatKeyLabel(state.controls.jump)}: Jump` },
    { x: 240, y: 96, text: `${formatKeyLabel(state.controls.run)}: Run` },
    { x: 360, y: 96, text: "Grab coins + shards" },
  ];
  for (const prompt of prompts) {
    renderer.rect(
      prompt.x - 6,
      prompt.y - 12,
      140,
      18,
      "rgba(255,255,255,0.8)"
    );
    renderer.text(prompt.text, prompt.x, prompt.y, "#2b2b2b");
  }
}

function drawLandmark() {
  const { landmark } = state.level;
  renderer.rect(
    landmark.x,
    landmark.y,
    landmark.width,
    landmark.height,
    "#2b2b2b"
  );
  renderer.rect(
    landmark.x + 4,
    landmark.y + 4,
    landmark.width - 8,
    landmark.height - 8,
    "#e04b3a"
  );
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
      drawSprite(
        getCurrentFrame(state.player.anim),
        state.player.x,
        state.player.y,
        state.player.facing < 0
      );
    }

    for (const enemy of state.enemies) {
      if (!enemy.alive) {
        continue;
      }
      if (state.assetsReady) {
        if (enemy.kind === "moomba") {
          drawSprite(
            getCurrentFrame(enemy.anim),
            enemy.x,
            enemy.y,
            enemy.vx > 0
          );
        } else {
          const spriteId = enemy.kind === "spikelet" ? "spikelet" : "flit";
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
  const width = frame.w * state.assetScale;
  const height = frame.h * state.assetScale;
  renderer.sprite(
    state.assets.image,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    x,
    y,
    width,
    height,
    flipX
  );
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
  const baseWidth = frame.w * state.assetScale;
  const baseHeight = frame.h * state.assetScale;
  const width = baseWidth * scaleX;
  const height = baseHeight * scaleY;
  const dx = x + (baseWidth - width) / 2;
  const dy = y + (baseHeight - height);
  renderer.sprite(
    state.assets.image,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    dx,
    dy,
    width,
    height,
    flipX
  );
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
      if ("stompedTimer" in enemy) {
        enemy.stompedTimer = 0.25;
      }
      bouncePlayer(state.player);
      audio.playStomp();
      triggerCameraShake(0.12, 4);
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
      state.hud.score += activeRules.scoring.coinValue;
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
      state.hud.score += activeRules.scoring.shardValue;
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
      state.hud.score += activeRules.scoring.powerupValue;
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
  if (state.activeCheckpoint) {
    state.player.x = state.activeCheckpoint.x;
    state.player.y = state.activeCheckpoint.y - state.player.height;
  } else {
    state.player.x = spawnPoint.x;
    state.player.y = spawnPoint.y;
  }
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
  state.storySeen = false;
  resetLevel();
}

function resetLevel() {
  state.level = LEVELS[state.levelIndex]();
  state.enemies =
    state.levelIndex === 0
      ? [
          createMoomba(220, 160),
          createSpikelet(360, 160),
          createFlit(560, 80, 24),
        ]
      : [
          createMoomba(160, 160),
          createSpikelet(240, 160),
          createFlit(520, 80, 24),
        ];
  applyDifficultyToEnemies(
    state.enemies,
    DIFFICULTY_SPEED[state.difficultyIndex]
  );
  state.particles = createParticles();
  state.hud.coins = 0;
  state.hud.shards = 0;
  state.camera.x = 0;
  state.camera.y = 0;
  state.invulnerableTimer = 0;
  state.powerupTimer = 0;
  state.speedTimer = 0;
  state.shieldTimer = 0;
  state.completeTimeBonus = 0;
  state.completeGoalBonus = 0;
  state.completeCoinScore = 0;
  state.completeShardScore = 0;
  state.hitFlashTimer = 0;
  state.knockbackTimer = 0;
  state.knockbackVelocity = 0;
  state.activeCheckpoint = null;
  for (const checkpoint of state.level.checkpoints) {
    checkpoint.activated = false;
  }
  state.levelTimeRemaining = LEVEL_TIME_LIMITS[state.difficultyIndex];
  state.deathTimer = 0;
  state.deathVelocity = 0;
  resetPlayer();
  updateHud();
}

function setMode(mode: Mode) {
  state.mode = mode;
  const isTitle = mode === "title";
  const isStory = mode === "story";
  const isIntro = mode === "intro";
  const isPaused = mode === "paused";
  const isComplete = mode === "complete";
  const isDeath = mode === "death";

  hud.classList.toggle("is-hidden", isTitle);
  startOverlay.classList.toggle("is-hidden", !isTitle);
  storyOverlay.classList.toggle("is-hidden", !isStory);
  introOverlay.classList.toggle("is-hidden", !isIntro);
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
    updateControlHints();
  }
  if (isStory) {
    resetStory();
    updateStoryText();
  }
  if (isIntro) {
    updateIntroCard();
  }
  if (isPaused) {
    state.pauseSelection = 0;
    updatePauseMenu();
  }
  if (isDeath) {
    input.reset();
  }
}

function updateCamera(dt: number) {
  const levelWidth = state.level.width * state.level.tileSize;
  const levelHeight = state.level.height * state.level.tileSize;
  const maxX = Math.max(0, levelWidth - canvas.width);
  const maxY = Math.max(0, levelHeight - canvas.height);
  const targetLook = Math.sign(state.player.vx) * 24;
  state.cameraLook = approach(state.cameraLook, targetLook, 180 * dt);
  const targetLookY =
    state.player.vy < -40 ? -18 : state.player.vy > 40 ? 22 : 0;
  state.cameraLookY = approach(state.cameraLookY, targetLookY, 140 * dt);
  const targetX =
    state.player.x +
    state.player.width / 2 -
    canvas.width / 2 +
    state.cameraLook;
  const offset = targetX - state.camera.x;
  const deadZone = 6;
  if (Math.abs(offset) > deadZone) {
    const smoothing = Math.min(1, 8 * dt);
    state.camera.x += offset * smoothing;
  }
  state.camera.x = clamp(state.camera.x, 0, maxX);

  const targetY =
    state.player.y +
    state.player.height / 2 -
    canvas.height / 2 +
    state.cameraLookY;
  const offsetY = targetY - state.camera.y;
  const deadZoneY = 4;
  if (Math.abs(offsetY) > deadZoneY) {
    const smoothingY = Math.min(1, 6 * dt);
    state.camera.y += offsetY * smoothingY;
  }
  state.camera.y = clamp(state.camera.y, 0, maxY);
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
  hudLives.textContent = String(state.hud.lives);
  hudTime.textContent = String(Math.ceil(state.levelTimeRemaining));
  hudScore.textContent = String(state.hud.score);
  hudCoins.textContent = String(state.hud.coins);
  hudShards.textContent = String(state.hud.shards);
  const buffs: string[] = [];
  if (state.powerupTimer > 0) {
    buffs.push(`⬆${Math.ceil(state.powerupTimer)}`);
  }
  if (state.speedTimer > 0) {
    buffs.push(`⚡${Math.ceil(state.speedTimer)}`);
  }
  if (state.shieldTimer > 0) {
    buffs.push(`🛡${Math.ceil(state.shieldTimer)}`);
  }
  hudBuffs.textContent = buffs.length ? buffs.join(" ") : "--";
  hudAudio.textContent = state.audioMuted ? "OFF" : "ON";
  hudCheckpoint.textContent = state.activeCheckpoint ? "✓" : "--";
  completeScore.textContent = `Score ${state.hud.score}`;
  updateCompleteSummary();
}

function updateCompleteSummary() {
  completeBreakdown.textContent = `Time Bonus ${state.completeTimeBonus} · Goal ${state.completeGoalBonus} · Coins ${state.completeCoinScore} · Shards ${state.completeShardScore}`;
}

function updatePauseMenu() {
  for (let i = 0; i < pauseOptions.length; i += 1) {
    pauseOptions[i].classList.toggle("is-selected", i === state.pauseSelection);
  }
}

function formatKeyLabel(code: string) {
  if (code === "Space") return "Space";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code.startsWith("Key")) return code.slice(3);
  return code;
}

function updateControlHints() {
  if (controlHints.length === 0) {
    return;
  }
  const jumpLabel = formatKeyLabel(state.controls.jump);
  const runLabel = formatKeyLabel(state.controls.run);
  controlHints[0].textContent = `Arrows + ${jumpLabel} (jump) + ${runLabel} (run)`;
}

function resetStory() {
  state.storyIndex = 0;
  state.storyCharCount = 0;
  state.storyTimer = 0;
}

function updateStoryText() {
  const entry = STORY_LINES[state.storyIndex];
  if (!entry) {
    return;
  }
  storySpeaker.textContent = entry.speaker;
  storyText.textContent = entry.text.slice(0, state.storyCharCount);
}

function updateStory(dt: number) {
  const entry = STORY_LINES[state.storyIndex];
  if (!entry) {
    state.storySeen = true;
    setMode("intro");
    return;
  }
  state.storyTimer += dt;
  const targetChars = Math.min(
    entry.text.length,
    Math.floor(state.storyTimer * 30)
  );
  if (targetChars !== state.storyCharCount) {
    state.storyCharCount = targetChars;
    updateStoryText();
  }
  if (input.consumePress("Enter")) {
    if (state.storyCharCount < entry.text.length) {
      state.storyCharCount = entry.text.length;
      updateStoryText();
      return;
    }
    state.storyIndex += 1;
    state.storyCharCount = 0;
    state.storyTimer = 0;
    if (state.storyIndex >= STORY_LINES.length) {
      state.storySeen = true;
      setMode("intro");
      return;
    }
    updateStoryText();
  }
}

function updateIntroCard() {
  const levelNumber = state.levelIndex + 1;
  const difficultyLabel =
    DIFFICULTY_SPEED[state.difficultyIndex] < 1
      ? "Easy"
      : DIFFICULTY_SPEED[state.difficultyIndex] > 1
      ? "Hard"
      : "Normal";
  introTitle.textContent = `Level ${levelNumber}`;
  introGoal.textContent = "Reach the goal flag.";
  introCollect.textContent = `Collect ${state.level.coins.length} coins and ${state.level.shards.length} shards.`;
  introDifficulty.textContent = `Difficulty: ${difficultyLabel}`;
}

function updatePlatforms(platforms: MovingPlatform[], dt: number) {
  const twoPi = Math.PI * 2;
  for (const platform of platforms) {
    const prevX = platform.x;
    const prevY = platform.y;
    if (platform.kind === "vertical") {
      platform.angle += (twoPi / platform.period) * dt;
      platform.y =
        platform.baseY + Math.sin(platform.angle) * platform.amplitude;
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
    state.invulnerableTimer = 1;
    state.hitFlashTimer = 0.35;
    state.knockbackTimer = 0.2;
    state.knockbackVelocity = -state.player.facing * 140;
    state.player.vy = -180;
  }
}

function triggerCameraShake(duration: number, strength: number) {
  state.cameraShakeTimer = Math.max(state.cameraShakeTimer, duration);
  state.cameraShakeStrength = Math.max(state.cameraShakeStrength, strength);
}

function buildDebugPalette(count: number) {
  const palette = [
    "#e04b3a",
    "#5dbb63",
    "#78c7f0",
    "#f6d44d",
    "#4a2b3f",
    "#ff8a5c",
    "#9bc7ff",
    "#3c7d6b",
    "#d47b9f",
    "#7b4a6d",
    "#f28cb0",
    "#2b2b2b",
    "#a37c2e",
    "#6cc0a2",
  ];
  if (count <= palette.length) {
    return palette;
  }
  const extended = [];
  for (let i = 0; i < count; i += 1) {
    extended.push(palette[i % palette.length]);
  }
  return extended;
}

async function createDebugPaintedImage(
  image: HTMLImageElement,
  atlas: Record<string, AssetFrame>
): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return image;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const entries = Object.entries(atlas).sort(([a], [b]) => a.localeCompare(b));
  const palette = buildDebugPalette(entries.length);
  entries.forEach(([_, frame], index) => {
    ctx.fillStyle = palette[index];
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  });
  const debugImage = new Image();
  debugImage.src = canvas.toDataURL();
  await new Promise<void>((resolve, reject) => {
    debugImage.onload = () => resolve();
    debugImage.onerror = () =>
      reject(new Error("Failed to load debug-painted image"));
  });
  return debugImage;
}

async function loadAssets() {
  try {
    let image: HTMLImageElement | null = null;
    let atlas: Record<string, AssetFrame> | null = null;
    try {
      atlas = await loadJson<Record<string, AssetFrame>>(
        "assets/sprites.prod.json"
      );
      image = await loadImage("assets/sprites.prod.png");
    } catch (error) {
      console.warn(
        "Production sprites missing, falling back to placeholder assets.",
        error
      );
      atlas = await loadJson<Record<string, AssetFrame>>("assets/sprites.json");
      image = await loadImage("assets/sprites.svg");
    }
    if (state.debugPaint) {
      image = await createDebugPaintedImage(image, atlas);
    }
    state.assets = { image, atlas };
    state.assetScale = image.width >= 512 ? 0.5 : 1;
    state.assetsReady = true;
  } catch (error) {
    console.error(error);
  }
}

const moddingAPI = new ModdingAPI({
  getState: () => state,
  removeEntities: (filter) => {
    let removed = 0;
    if (filter.kind === "coin") {
      for (const coin of state.level.coins) {
        if (!coin.collected) {
          coin.collected = true;
          removed++;
        }
      }
    }
    if (filter.kind === "enemy") {
      for (const enemy of state.enemies) {
        if (enemy.alive) {
          enemy.alive = false;
          removed++;
        }
      }
    }
    return removed;
  },
  setPlayerAbility: (ability, active) => {
    if (ability === "invincible") {
      state.invulnerableTimer = active ? 3600 : 0;
    }
  },
});

// AI/Agent provider for translating prompts to patch operations
const moddingProvider = new KeywordModdingProvider();

window.__SUPER_MO__ = {
  state,
  modding: moddingAPI,
  setMode,
  resetPlayer,
  setDebug(flags: { tiles?: boolean; labels?: boolean }) {
    const tiles =
      typeof flags.tiles === "boolean" ? flags.tiles : state.debugTiles;
    const labels =
      typeof flags.labels === "boolean" ? flags.labels : state.debugLabels;
    setDebugState(tiles, labels, false);
  },
};

const loop = createLoop({ update, render });
loop.start();

window.addEventListener("blur", () => {
  input.reset();
});

// Touch/click handlers for overlays
function simulateEnter() {
  input.press("Enter");
}

function addOverlayTapHandler(
  overlay: HTMLElement,
  mode: Mode,
  beforeAction?: () => void
) {
  const handler = (e: Event) => {
    if (state.mode === mode) {
      e.preventDefault();
      beforeAction?.();
      simulateEnter();
    }
  };
  overlay.addEventListener("click", handler);
  overlay.addEventListener("touchend", handler, { passive: false });
}

addOverlayTapHandler(startOverlay, "title", () => audio.unlock());
addOverlayTapHandler(storyOverlay, "story");
addOverlayTapHandler(introOverlay, "intro");
addOverlayTapHandler(completeOverlay, "complete");

pauseOverlay.addEventListener("click", (e) => {
  if (state.mode !== "paused") return;
  const target = e.target as HTMLElement;
  const option = target.closest(".pause-option") as HTMLElement | null;
  if (option) {
    const action = option.dataset.action;
    if (action === "restart") {
      resetLevel();
      setMode("playing");
    } else if (action === "quit") {
      resetRun();
      setMode("title");
    } else {
      setMode("playing");
    }
  }
});

// Fullscreen button handler
const fullscreenBtn = document.getElementById("fullscreen-btn");
if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", toggleFullscreen);
  fullscreenBtn.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      toggleFullscreen();
    },
    { passive: false }
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen not supported or denied
    });
  }
}

// Modding UI Integration
const moddingOverlay = requireElement<HTMLDivElement>("#modding-overlay");
const moddingInput = requireElement<HTMLInputElement>("#modding-input");
const moddingHistory = requireElement<HTMLDivElement>("#modding-history");
const moddingCloseBtn = requireElement<HTMLButtonElement>("#modding-close");
const moddingSendBtn = requireElement<HTMLButtonElement>("#modding-send");
const moddingResetBtn = requireElement<HTMLButtonElement>("#modding-reset");
const moddingToggle = document.getElementById("modding-toggle");

function toggleModdingUI() {
  const isHidden = moddingOverlay.classList.contains("is-hidden");
  if (isHidden) {
    moddingOverlay.classList.remove("is-hidden");
    moddingToggle?.classList.add("is-active");
    moddingInput.focus();
  } else {
    moddingOverlay.classList.add("is-hidden");
    moddingToggle?.classList.remove("is-active");
    canvas.focus();
  }
}

function appendModdingMessage(
  text: string,
  type: "user" | "agent" | "system" | "error"
) {
  const div = document.createElement("div");
  div.className = `modding-message ${type}`;
  div.textContent = text;
  moddingHistory.appendChild(div);
  moddingHistory.scrollTop = moddingHistory.scrollHeight;
}

async function handleModdingRequest(text: string) {
  appendModdingMessage(text, "user");
  moddingInput.value = "";

  try {
    const snapshot = moddingAPI.getSnapshot();
    const result = await moddingProvider.processPrompt(text, snapshot);

    if (result.patch.ops.length === 0) {
      // No operations generated - show the explanation as help text
      appendModdingMessage(result.explanation, "system");
    } else {
      // Apply the patch and show the result
      const applyResult = moddingAPI.applyPatch(result.patch);
      if (applyResult.success) {
        appendModdingMessage(result.explanation, "agent");
      } else {
        appendModdingMessage(
          `Partial success: ${
            result.explanation
          }\nErrors: ${applyResult.errors?.join(", ")}`,
          "error"
        );
      }
    }
  } catch (err: any) {
    appendModdingMessage(err.message, "error");
  }
}

moddingCloseBtn.addEventListener("click", toggleModdingUI);
moddingResetBtn.addEventListener("click", () => {
  resetRules();
  resetLevel();
  appendModdingMessage("Reset rules and level.", "system");
});
moddingSendBtn.addEventListener("click", () => {
  const text = moddingInput.value.trim();
  if (text) handleModdingRequest(text);
});
moddingInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const text = moddingInput.value.trim();
    if (text) handleModdingRequest(text);
  }
  e.stopPropagation();
});
moddingOverlay.addEventListener("keydown", (e) => e.stopPropagation());

window.addEventListener("keydown", (e) => {
  if (e.key === "`" || e.key === "Backquote") {
    toggleModdingUI();
    e.preventDefault();
  }
});

const moddingTrigger = document.getElementById("modding-trigger");
if (moddingTrigger) {
  moddingTrigger.addEventListener("touchend", (e) => {
    e.preventDefault();
    toggleModdingUI();
  });
  moddingTrigger.addEventListener("click", (e) => {
    toggleModdingUI();
    // Keep focus in input if opening
    if (!moddingOverlay.classList.contains("is-hidden")) {
      moddingInput.focus();
    }
  });
}

// Always-visible modding toggle button in game shell
if (moddingToggle) {
  moddingToggle.addEventListener("touchend", (e) => {
    e.preventDefault();
    toggleModdingUI();
  });
  moddingToggle.addEventListener("click", () => {
    toggleModdingUI();
  });
}
