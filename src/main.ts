import { createLoop } from "./core/loop.js";
import { activeRules, resetRules } from "./game/modding/rules.js";
import { ModdingAPI } from "./game/modding/api.js";
import { createDefaultModdingProvider, getDiscoveryTools, type PromptResult, type ConversationMessage, type DebugInfo } from "./game/modding/provider.js";
import { SandboxRuntime } from "./game/modding/sandbox/host.js";
import type { BackgroundThemePatch, ModOperation } from "./game/modding/types.js";
import type { RenderFilterSpec, Renderer } from "./core/renderer.js";
import { createPixiRenderer } from "./core/pixi-renderer.js";
import { createInput } from "./core/input.js";
import { loadVectorAssets } from "./game/vector-assets.js";
import { createAudio } from "./core/audio.js";
import { applyRuntimeCsp } from "./core/csp-utils.js";
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
import { createRocket, updateRockets, drawRocket } from "./game/rockets.js";
import type {
  Checkpoint,
  Collectible,
  Level,
  MovingPlatform,
  Rect,
} from "./game/level.js";
import type { Rocket } from "./game/rockets.js";
import type { Player } from "./game/player.js";
import type { MoombaEnemy } from "./game/enemies/moomba.js";
import type { SpikeletEnemy } from "./game/enemies/spikelet.js";
import type { FlitEnemy } from "./game/enemies/flit.js";

import type { InputState } from "./core/input.js";

type Assets = Record<string, { image: HTMLImageElement; w: number; h: number }>;
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
  jetpackTimer: number;
  jetpackWarning: boolean;
  backgroundTime: number;
  backgroundOverride: BackgroundThemePatch | null;
  renderFilters: RenderFilterSpec[] | null;
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
  rocketTimer: number;
  rocketCount: number;
  rockets: Rocket[];
  rocketMessageTimer: number;
  entityScripts: {
    enemy: ((entity: any, time: number, dt: number) => void) | null;
    coin: ((entity: any, time: number, dt: number) => void) | null;
    player: ((entity: any, time: number, dt: number) => void) | null;
  };
};

declare global {
  interface Window {
    __SUPER_MO__?: {
      state: GameState;
      modding: ModdingAPI;
      discovery: ReturnType<typeof getDiscoveryTools>;
      setMode: (mode: Mode) => void;
      resetPlayer: () => void;
      setDebug: (flags: { tiles?: boolean; labels?: boolean }) => void;
    };
    __RENDERER_READY__?: boolean;
    __SANDBOX_READY__?: boolean;
    __SANDBOX_ERROR__?: string;
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
applyRuntimeCsp();
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
// Start with a no-op renderer until Pixi.js is ready.
const nullGradient = {
  addColorStop() {},
} as CanvasGradient;

const nullCtx = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  save() {},
  restore() {},
  translate() {},
  scale() {},
  setTransform() {},
  beginPath() {},
  closePath() {},
  moveTo() {},
  lineTo() {},
  quadraticCurveTo() {},
  arc() {},
  ellipse() {},
  fill() {},
  stroke() {},
  fillRect() {},
  createLinearGradient() {
    return nullGradient;
  },
  get globalAlpha() {
    return 1;
  },
  set globalAlpha(_value: number) {},
} as unknown as CanvasRenderingContext2D;

const nullRenderer: Renderer = {
  clear() {},
  rect() {},
  circle() {},
  sprite() {},
  text() {},
  ctx: nullCtx,
  render() {},
};

let renderer: Renderer = nullRenderer;
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
const hudMessage = requireElement<HTMLDivElement>("#hud-message");
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
type BackgroundTheme = {
  clear: string;
  showStars: boolean;
  stars: string;
  cloudPrimary: string;
  cloudSecondary: string;
  hillFarA: string;
  hillFarB: string;
  hillNearA: string;
  hillNearB: string;
  waterfallTop: string;
  waterfallMid: string;
  waterfallBottom: string;
  waterfallHighlight: string;
};

const BACKGROUND_THEMES: BackgroundTheme[] = [
  {
    clear: "#78c7f0",
    showStars: true,
    stars: "#ffffff",
    cloudPrimary: "#ffffff",
    cloudSecondary: "#f3f6ff",
    hillFarA: "#b7d9ff",
    hillFarB: "#9bc7ff",
    hillNearA: "#78c7f0",
    hillNearB: "#4aa0d0",
    waterfallTop: "#b9ecff",
    waterfallMid: "#78c7f0",
    waterfallBottom: "#4aa0d0",
    waterfallHighlight: "rgba(255,255,255,0.45)",
  },
  {
    clear: "#f7b07a",
    showStars: false,
    stars: "#fff2d5",
    cloudPrimary: "#fff1e3",
    cloudSecondary: "#ffd1b3",
    hillFarA: "#f3c3a2",
    hillFarB: "#e6a67f",
    hillNearA: "#d47a5c",
    hillNearB: "#b85a3f",
    waterfallTop: "#ffe1c6",
    waterfallMid: "#f7b07a",
    waterfallBottom: "#d9784f",
    waterfallHighlight: "rgba(255,255,255,0.35)",
  },
  {
    clear: "#5b7ba6",
    showStars: true,
    stars: "#e6f0ff",
    cloudPrimary: "#c9d6f2",
    cloudSecondary: "#b0c2e8",
    hillFarA: "#6b8fbc",
    hillFarB: "#5579a9",
    hillNearA: "#4a5f82",
    hillNearB: "#3c4a68",
    waterfallTop: "#b5c7e8",
    waterfallMid: "#7ea3d6",
    waterfallBottom: "#5a7fb0",
    waterfallHighlight: "rgba(255,255,255,0.3)",
  },
  {
    clear: "#7cc58f",
    showStars: false,
    stars: "#eafff1",
    cloudPrimary: "#e1f6ea",
    cloudSecondary: "#c6ecd6",
    hillFarA: "#9ad6a9",
    hillFarB: "#7fc495",
    hillNearA: "#5da873",
    hillNearB: "#478a60",
    waterfallTop: "#d7f5e2",
    waterfallMid: "#97d6b1",
    waterfallBottom: "#5fae82",
    waterfallHighlight: "rgba(255,255,255,0.35)",
  },
  {
    clear: "#3f4f6c",
    showStars: true,
    stars: "#d7e6ff",
    cloudPrimary: "#9aa9c4",
    cloudSecondary: "#7b8ba7",
    hillFarA: "#5c6d8b",
    hillFarB: "#4a5c79",
    hillNearA: "#3f4f6c",
    hillNearB: "#2e3d55",
    waterfallTop: "#a7b7d3",
    waterfallMid: "#6c83a6",
    waterfallBottom: "#495b7b",
    waterfallHighlight: "rgba(255,255,255,0.25)",
  },
  {
    clear: "#4b2b6b",
    showStars: true,
    stars: "#f6e8ff",
    cloudPrimary: "#c9b6e6",
    cloudSecondary: "#b099d6",
    hillFarA: "#6f4c9a",
    hillFarB: "#5a3c7f",
    hillNearA: "#4b2b6b",
    hillNearB: "#3a2057",
    waterfallTop: "#d7c9ff",
    waterfallMid: "#9a7bd1",
    waterfallBottom: "#6a4ea4",
    waterfallHighlight: "rgba(255,255,255,0.3)",
  },
];

function getBackgroundTheme(
  levelIndex: number,
  override: BackgroundThemePatch | null
): BackgroundTheme {
  const base = BACKGROUND_THEMES[levelIndex % BACKGROUND_THEMES.length];
  if (!override) {
    return base;
  }
  return { ...base, ...override };
}

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
  jetpackTimer: 0,
  jetpackWarning: false,
  backgroundTime: 0,
  backgroundOverride: null,
  renderFilters: null,
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
  rocketTimer: 0,
  rocketCount: 0,
  rockets: [],
  rocketMessageTimer: 0,
  entityScripts: {
    enemy: null,
    coin: null,
    player: null,
  },
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

  // Handle rocket launcher firing
  if (state.rocketCount > 0) {
    if (state.rocketTimer > 0) {
      state.rocketTimer = Math.max(0, state.rocketTimer - dt);
    }
    if (input.consumePress("KeyC") && state.rocketTimer <= 0 && state.rocketCount > 0) {
      // Fire rocket in direction player is facing
      const rocketSpeed = 300;
      const rocketOriginX = state.player.x + 8;
      const rocketOriginY = state.player.y + 8;
      let targetVX = state.player.facing * rocketSpeed;
      let targetVY = -20;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const enemyCenterX = enemy.x + enemy.width / 2;
        const enemyCenterY = enemy.y + enemy.height / 2;
        const dx = enemyCenterX - rocketOriginX;
        if (Math.sign(dx) !== state.player.facing || Math.abs(dx) > 260) {
          continue;
        }
        const dy = enemyCenterY - rocketOriginY;
        const distance = Math.hypot(dx, dy);
        if (distance < closestDistance) {
          closestDistance = distance;
          targetVX = (dx / distance) * rocketSpeed;
          targetVY = (dy / distance) * rocketSpeed;
        }
      }
      state.rockets.push(
        createRocket(
          rocketOriginX,
          rocketOriginY,
          targetVX,
          targetVY
        )
      );
      state.rocketCount -= 1;
      state.rocketTimer = 0.3; // Cooldown between shots
      audio.playPowerup();
      if (state.rocketCount === 0) {
        state.rocketTimer = 0;
      }
    }
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
  const prevJetpack = Math.ceil(state.jetpackTimer);
  const wasRocketMessageActive = state.rocketMessageTimer > 0;
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
  if (state.jetpackTimer > 0) {
    state.jetpackTimer = Math.max(0, state.jetpackTimer - dt);
    // Enable warning when 2 seconds remain
    if (state.jetpackTimer <= 2 && state.jetpackTimer > 0) {
      state.jetpackWarning = true;
    } else {
      state.jetpackWarning = false;
    }
  } else {
    state.jetpackWarning = false;
  }
  if (prevJetpack <= 0 && state.jetpackTimer > 0) {
    audio.startJetpackLoop();
  } else if (prevJetpack > 0 && state.jetpackTimer === 0) {
    audio.stopJetpackLoop();
  }
  if (state.rocketMessageTimer > 0) {
    state.rocketMessageTimer = Math.max(0, state.rocketMessageTimer - dt);
  }
  const timeChanged = Math.ceil(state.levelTimeRemaining) !== previousTime;
  const buffsChanged =
    Math.ceil(state.powerupTimer) !== prevPower ||
    Math.ceil(state.speedTimer) !== prevSpeed ||
    Math.ceil(state.shieldTimer) !== prevShield ||
    Math.ceil(state.jetpackTimer) !== prevJetpack;
  const messageChanged = wasRocketMessageActive !== (state.rocketMessageTimer > 0);
  if (timeChanged || buffsChanged || messageChanged) {
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
  if (events.dashed) {
    audio.playDash();
  }
  if (events.wallSliding) {
    audio.playWallSlide();
  }
  if (events.landed && prevVy > 120) {
    audio.playLanding();
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

  // Jetpack provides stronger anti-gravity for flying
  if (state.jetpackTimer > 0) {
    state.player.vy -= 180 * dt;
    // Spawn jetpack exhaust particles
    if (Math.random() < 0.6) {
      state.particles.spawn(
        state.player.x + 8,
        state.player.y + state.player.height,
        1,
        state.jetpackWarning ? "#ff5b4a" : "#78c7f0"
      );
    }
  }

  // Prevent player from going above the level
  if (state.player.y < 0) {
    state.player.y = 0;
    state.player.vy = 0;
  }

  handleCollectibles();
  handleCheckpoints();
  updateRockets(state.rockets, dt);
  handleRocketCollisions();
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

  if (state.entityScripts.enemy) {
    for (const enemy of state.enemies) {
      if (enemy.alive) {
        try {
          state.entityScripts.enemy(enemy, state.time, dt);
        } catch (error) {
          console.error("Entity script error:", error);
        }
      }
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
  const theme = getBackgroundTheme(state.levelIndex, state.backgroundOverride);
  renderer.clear(theme.clear);
  renderer.resize?.();

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
  drawBackground(state.camera.x, state.backgroundTime, theme);
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
      // Draw jetpack visual indicator when active
      if (state.jetpackTimer > 0) {
        const jetpackColor = state.jetpackWarning ? "#ff5b4a" : "#78c7f0";
        // Draw jetpack on player's back
        renderer.rect(
          state.player.x + 5,
          state.player.y + 8,
          6,
          10,
          jetpackColor
        );
        // Draw jetpack nozzles
        renderer.rect(
          state.player.x + 6,
          state.player.y + 17,
          2,
          3,
          "#2b2b2b"
        );
        renderer.rect(
          state.player.x + 8,
          state.player.y + 17,
          2,
          3,
          "#2b2b2b"
        );
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

  // Draw rockets
  for (const rocket of state.rockets) {
    drawRocket(rocket, renderer);
  }

  state.particles.draw(renderer);

  // Present the frame (required for Pixi.js renderer)
  renderer.render?.();

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

function drawWaterfall(x: number, y: number, height: number, theme: BackgroundTheme) {
  const ctx = renderer.ctx;
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, theme.waterfallTop);
  gradient.addColorStop(0.5, theme.waterfallMid);
  gradient.addColorStop(1, theme.waterfallBottom);

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, 18, height);

  ctx.fillStyle = theme.waterfallHighlight;
  ctx.fillRect(x + 3, y + 6, 4, height - 12);
  ctx.fillRect(x + 10, y + 10, 3, height - 20);
}

function drawBackground(camX: number, time: number, theme: BackgroundTheme) {
  renderer.ctx.save();
  renderer.ctx.translate(camX * 0.3, 0);

  const { width, tileSize } = state.level;
  const horizonY = 100;
  const totalWidth = width * tileSize;
  const cloudOffset = (time * 12) % 180;
  const farOffset = (time * 6) % 220;
  const fastCloudOffset = (time * 20) % 240;

  if (theme.showStars) {
    // Draw twinkling stars in the upper sky
    drawStars(totalWidth, time, theme.stars);
  }

  // Multiple cloud layers at different speeds for depth
  for (let x = -240; x < totalWidth + 240; x += 240) {
    const drift = x + fastCloudOffset;
    drawCloud(drift + 10, 12, 0.7, theme.cloudPrimary);
  }

  for (let x = -180; x < totalWidth + 180; x += 180) {
    const drift = x + cloudOffset;
    drawCloud(drift + 20, 26, 0.9, theme.cloudPrimary);
    drawCloud(drift + 70, 20, 1.1, theme.cloudSecondary);
  }

  // Occasional shooting star
  if (theme.showStars) {
    drawShootingStar(time, totalWidth, theme.stars);
  }

  for (let x = -220; x < totalWidth + 220; x += 220) {
    const drift = x + farOffset;
    drawHill(drift, horizonY + 70, 200, 90, theme.hillFarA, theme.hillFarB);
    drawHill(
      drift + 50,
      horizonY + 80,
      230,
      110,
      theme.hillFarB,
      theme.hillNearA
    );
  }

  for (let x = 0; x < totalWidth; x += 260) {
    const sway = Math.sin(time * 1.4 + x * 0.01) * 4;
    const baseX = x + 40;
    drawWaterfall(baseX + sway, 70, 80, theme);
    drawHill(baseX - 30, 80, 90, 60, theme.hillNearA, theme.hillNearB);
  }

  renderer.ctx.restore();
}

function drawStars(totalWidth: number, time: number, color: string) {
  const ctx = renderer.ctx;
  ctx.fillStyle = color;
  // Use deterministic positions based on time for twinkling effect
  for (let i = 0; i < 15; i++) {
    const x = (i * 137.5) % totalWidth; // Golden ratio distribution
    const y = (i * 23) % 60;
    const twinkle = Math.sin(time * 3 + i) * 0.5 + 0.5; // 0 to 1
    if (twinkle > 0.3) {
      ctx.globalAlpha = twinkle * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawShootingStar(time: number, totalWidth: number, color: string) {
  const ctx = renderer.ctx;
  // Shooting star appears every ~8 seconds, lasts for ~0.4 seconds
  const cycleTime = time % 8;
  if (cycleTime < 0.4) {
    const progress = cycleTime / 0.4;
    const startX = totalWidth * 0.6;
    const startY = 20;
    const x = startX + progress * 200;
    const y = startY + progress * 60;
    
    const gradient = ctx.createLinearGradient(x - 30, y - 10, x, y);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, "#ffffff");
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 10);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
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
        : powerup.kind === "jetpack"
        ? "#ff5b4a"
        : "#5dbb63";
    const inner =
      powerup.kind === "spring"
        ? "#f6d44d"
        : powerup.kind === "speed"
        ? "#e04b3a"
        : powerup.kind === "jetpack"
        ? "#78c7f0"
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
      audio.playCheckpoint();
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
  const offsetY = GAME_HEIGHT - levelHeight;

  renderer.ctx.save();
  renderer.ctx.translate(-scrollX, offsetY);

  const drawScene = (camX: number) => {
    const theme = getBackgroundTheme(0, state.backgroundOverride);
    drawBackground(camX, state.backgroundTime, theme);
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
  if (scrollX > levelWidth - GAME_WIDTH) {
    renderer.ctx.save();
    renderer.ctx.translate(levelWidth, 0);
    drawScene(scrollX - levelWidth);
    renderer.ctx.restore();
  }

  // Present the frame (required for Pixi.js renderer)
  renderer.render?.();

  renderer.ctx.restore();
}

function drawSprite(id: string, x: number, y: number, flipX = false) {
  if (!state.assets) {
    return;
  }
  const sprite = state.assets[id];
  if (!sprite) {
    return;
  }
  renderer.sprite(
    sprite.image,
    0,
    0,
    sprite.w,
    sprite.h,
    x,
    y,
    sprite.w,
    sprite.h,
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
  const sprite = state.assets[id];
  if (!sprite) {
    return;
  }
  const baseWidth = sprite.w;
  const baseHeight = sprite.h;
  const width = sprite.w * scaleX;
  const height = sprite.h * scaleY;
  const dx = x + (sprite.w - width) / 2;
  const dy = y + (sprite.h - height);
  renderer.sprite(
    sprite.image,
    0,
    0,
    sprite.w,
    sprite.h,
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
      } else if (powerup.kind === "shield") {
        state.shieldTimer = 6;
      } else if (powerup.kind === "jetpack") {
        state.jetpackTimer = 10;
        state.jetpackWarning = false;
      } else if (powerup.kind === "rocket") {
        state.rocketCount = 3;
        state.rocketTimer = 0;
        state.rocketMessageTimer = 3; // Show message for 3 seconds
        audio.playTriumph();
      }
      state.hud.score += activeRules.scoring.powerupValue;
      updateHud();
      if (powerup.kind !== "rocket") {
        audio.playPowerup();
      }
      state.particles.spawn(powerup.x + 8, powerup.y + 8, 12, "#78c7f0");
    }
  }
}

function handleRocketCollisions() {
  // Rockets vs enemies
  for (const rocket of state.rockets) {
    if (!rocket.alive) continue;

    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;

      if (overlaps(rocket, enemy)) {
        rocket.alive = false;
        enemy.alive = false;
        state.hud.score += 100;
        updateHud();
        audio.playStomp();
        triggerCameraShake(0.1, 3);
        state.particles.spawn(rocket.x, rocket.y, 12, "#ff6b35");
      }
    }
  }

  // Remove dead rockets
  state.rockets = state.rockets.filter((r) => r.alive);
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
  state.jetpackTimer = 0;
  state.jetpackWarning = false;
  state.rocketCount = 0;
  state.rocketTimer = 0;
  state.rockets = [];
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
    audio.startMusic(state.levelIndex);
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
  const maxX = Math.max(0, levelWidth - GAME_WIDTH);
  const maxY = Math.max(0, levelHeight - GAME_HEIGHT);
  const targetLook = Math.sign(state.player.vx) * 24;
  state.cameraLook = approach(state.cameraLook, targetLook, 180 * dt);
  const targetLookY =
    state.player.vy < -40 ? -18 : state.player.vy > 40 ? 22 : 0;
  state.cameraLookY = approach(state.cameraLookY, targetLookY, 140 * dt);
  const targetX =
    state.player.x +
    state.player.width / 2 -
    GAME_WIDTH / 2 +
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
    GAME_HEIGHT / 2 +
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
  if (state.jetpackTimer > 0) {
    const timeLeft = Math.ceil(state.jetpackTimer);
    const icon = state.jetpackWarning ? "🚀⚠" : "🚀";
    buffs.push(`${icon}${timeLeft}`);
  }
  hudBuffs.textContent = buffs.length ? buffs.join(" ") : "--";
  hudAudio.textContent = state.audioMuted ? "OFF" : "ON";
  hudCheckpoint.textContent = state.activeCheckpoint ? "✓" : "--";
  const showRocketMessage = state.rocketMessageTimer > 0;
  hudMessage.textContent = showRocketMessage
    ? "Rocket Launcher! Press C to fire"
    : "";
  hudMessage.classList.toggle("is-visible", showRocketMessage);
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
  audio.playDamage();
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

async function loadAssets() {
  try {
    state.assets = await loadVectorAssets();
    state.assetsReady = true;
  } catch (error) {
    console.error(error);
  }
}

const sandboxRuntime = new SandboxRuntime();
sandboxRuntime.whenReady().then(() => {
  window.__SANDBOX_READY__ = sandboxRuntime.isReady();
  if (!sandboxRuntime.isReady()) {
    window.__SANDBOX_ERROR__ =
      sandboxRuntime.getInitError() ?? "Sandbox failed to initialize.";
  }
});

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
  setAudioMuted: (muted) => {
    state.audioMuted = muted;
    audio.setMuted(muted);
    updateHud();
  },
  setBackgroundTheme: (theme) => {
    state.backgroundOverride = theme;
  },
  setRenderFilters: (filters) => {
    state.renderFilters = filters
      ? filters.map((filter) => ({ ...filter }))
      : null;
    renderer.setFilters?.(state.renderFilters);
  },
  reloadAssets: async () => {
    state.assetsReady = false;
    await loadAssets();
  },
  runScript: async (request) => {
    if (request.module) {
      return sandboxRuntime.evaluateModule(
        request.module.entry,
        request.module.modules
      );
    }
    if (request.code) {
      return sandboxRuntime.evaluate(request.code);
    }
    throw new Error("Script request missing code or module.");
  },
  setEntityScript: (target, script) => {
    if (!target || !["enemy", "coin", "player"].includes(target)) {
      console.error(`[setEntityScript] Invalid target: ${target}`);
      return;
    }
    try {
      const fn = new Function("entity", "time", "dt", script) as (
        entity: any,
        time: number,
        dt: number
      ) => void;
      state.entityScripts[target] = fn;
    } catch (error) {
      console.error(`Failed to compile entity script for ${target}:`, error);
    }
  },
  setMusic: (op) => {
    if (op.action === "stop") {
      audio.stopMusic();
      return;
    }
    if (typeof op.track === "number") {
      audio.startMusic(op.track);
    }
    // Volume is controlled globally via setMuted for now
    // Could add per-track volume control in the future
  },
});

// AI/Agent provider for translating prompts to patch operations
const moddingProvider = createDefaultModdingProvider();

window.__SUPER_MO__ = {
  state,
  modding: moddingAPI,
  discovery: getDiscoveryTools(),
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

// Initialize Pixi.js renderer asynchronously and swap it in when ready
(async () => {
  try {
    renderer = await createPixiRenderer(canvas);
    renderer.setFilters?.(state.renderFilters ?? null);
    window.__RENDERER_READY__ = true;
    console.log("Pixi.js renderer initialized");
  } catch (err) {
    console.error("Failed to initialize Pixi.js renderer:", err);
  }
})();

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
const moddingPanel = requireElement<HTMLDivElement>(".modding-panel");
const moddingHeader = requireElement<HTMLDivElement>(".modding-header");
const moddingInput = requireElement<HTMLInputElement>("#modding-input");
const moddingHistory = requireElement<HTMLDivElement>("#modding-history");
const moddingCloseBtn = requireElement<HTMLButtonElement>("#modding-close");
const moddingSendBtn = requireElement<HTMLButtonElement>("#modding-send");
const moddingResetBtn = requireElement<HTMLButtonElement>("#modding-reset");
const moddingDebugToggle = requireElement<HTMLButtonElement>("#modding-debug-toggle");
const moddingToggle = document.getElementById("modding-toggle");
const moddingCapabilityHint =
  "I can change rules (gravity, speed, scoring), remove coins or enemies, " +
  "toggle audio, change background themes, apply visual filters " +
  "(grayscale/blur/sepia), reload assets, and run scripts.";
let moddingHintShown = false;
let moddingDebugMode = false;

// Conversation history for multi-turn AI context (cleared on page reload or reset)
const conversationHistory: ConversationMessage[] = [];

function formatModOperationSummary(op: ModOperation): string {
  switch (op.op) {
    case "setRule":
      return `setRule ${op.path}=${op.value}`;
    case "setAbility":
      return `setAbility ${op.ability}=${op.active}`;
    case "removeEntities": {
      const area = op.filter.area ? " in area" : "";
      return `remove ${op.filter.kind}${area}`;
    }
    case "setAudio":
      return `setAudio muted=${op.muted === true}`;
    case "setBackgroundTheme":
      return op.theme ? "setBackgroundTheme (custom)" : "setBackgroundTheme (reset)";
    case "setRenderFilters":
      return op.filters && op.filters.length > 0
        ? `setRenderFilters ${op.filters.map((filter) => filter.type).join(", ")}`
        : "setRenderFilters (clear)";
    case "reloadAssets":
      return "reloadAssets";
    case "runScript":
      return op.module ? `runScript module ${op.module.entry}` : "runScript inline";
    case "setEntityScript":
      return `setEntityScript ${op.target}`;
    case "setMusic":
      if (op.action === "stop") return "stopMusic";
      return `setMusic track=${op.track ?? "current"}`;
  }
  const fallback = op as { op?: string };
  return fallback.op ? `op ${fallback.op}` : "op";
}

function hasOperationDetails(op: ModOperation): boolean {
  return (
    op.op === "runScript" ||
    op.op === "setEntityScript" ||
    op.op === "setBackgroundTheme" ||
    op.op === "setRenderFilters"
  );
}

function formatOperationDetails(op: ModOperation): string {
  switch (op.op) {
    case "runScript":
      if (op.code) return op.code;
      if (op.module) return `Entry: ${op.module.entry}\n${Object.entries(op.module.modules).map(([k, v]) => `--- ${k} ---\n${v}`).join("\n")}`;
      return "";
    case "setEntityScript":
      return op.script;
    case "setBackgroundTheme":
      return op.theme ? JSON.stringify(op.theme, null, 2) : "(reset to default)";
    case "setRenderFilters":
      return op.filters ? JSON.stringify(op.filters, null, 2) : "(clear filters)";
    default:
      return "";
  }
}

function createOperationElement(op: ModOperation): HTMLElement {
  const container = document.createElement("div");
  container.className = "modding-op";

  const summary = document.createElement("div");
  summary.className = "modding-op-summary";
  summary.textContent = formatModOperationSummary(op);

  if (hasOperationDetails(op)) {
    const details = formatOperationDetails(op);
    if (details) {
      const toggle = document.createElement("button");
      toggle.className = "modding-op-toggle";
      toggle.textContent = "[show]";
      toggle.type = "button";

      const code = document.createElement("pre");
      code.className = "modding-op-code is-hidden";
      code.textContent = details;

      toggle.addEventListener("click", () => {
        const isHidden = code.classList.contains("is-hidden");
        code.classList.toggle("is-hidden");
        toggle.textContent = isHidden ? "[hide]" : "[show]";
      });

      summary.appendChild(toggle);
      container.appendChild(summary);
      container.appendChild(code);
      return container;
    }
  }

  container.appendChild(summary);
  return container;
}

function appendOperationsMessage(ops: ModOperation[]): void {
  if (!Array.isArray(ops) || ops.length === 0) {
    appendModdingMessage("AI patch: (no ops)", "meta");
    return;
  }

  const container = document.createElement("div");
  container.className = "modding-message meta";

  const header = document.createElement("div");
  header.textContent = `AI patch (${ops.length} operation${ops.length > 1 ? "s" : ""}):`;
  container.appendChild(header);

  for (const op of ops) {
    container.appendChild(createOperationElement(op));
  }

  moddingHistory.appendChild(container);
  moddingHistory.scrollTop = moddingHistory.scrollHeight;
}

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
  type: "user" | "agent" | "system" | "error" | "meta" | "thinking" | "request" | "retry"
): HTMLDivElement {
  const div = document.createElement("div");
  div.className = `modding-message ${type}`;
  div.textContent = text;
  moddingHistory.appendChild(div);
  moddingHistory.scrollTop = moddingHistory.scrollHeight;
  return div;
}

function removeModdingMessage(el: HTMLDivElement): void {
  if (el.parentNode === moddingHistory) {
    moddingHistory.removeChild(el);
  }
}

function appendModdingHint() {
  if (moddingHintShown) return;
  moddingHintShown = true;
  appendModdingMessage(moddingCapabilityHint, "system");
}

function appendDebugInfo(debug: DebugInfo | undefined, source: "api" | "keyword"): void {
  if (!moddingDebugMode) return;

  const container = document.createElement("div");
  container.className = "modding-debug";

  const header = document.createElement("div");
  header.className = "modding-debug-header";
  header.textContent = `[DEBUG] Source: ${source} | ${new Date(debug?.timestamp ?? Date.now()).toISOString()}`;
  container.appendChild(header);

  if (source === "keyword") {
    const note = document.createElement("pre");
    note.className = "modding-debug-code";
    note.textContent = "Using offline KeywordModdingProvider (no API call)";
    container.appendChild(note);
  } else if (debug) {
    // Request section
    const reqHeader = document.createElement("div");
    reqHeader.className = "modding-debug-section";
    reqHeader.textContent = "▼ REQUEST";
    container.appendChild(reqHeader);

    const reqCode = document.createElement("pre");
    reqCode.className = "modding-debug-code";
    reqCode.textContent = JSON.stringify(debug.request, null, 2);
    container.appendChild(reqCode);

    // Response section
    const resHeader = document.createElement("div");
    resHeader.className = "modding-debug-section";
    resHeader.textContent = "▼ RESPONSE";
    container.appendChild(resHeader);

    const resCode = document.createElement("pre");
    resCode.className = "modding-debug-code";
    resCode.textContent = JSON.stringify(debug.response, null, 2);
    container.appendChild(resCode);
  }

  moddingHistory.appendChild(container);
  moddingHistory.scrollTop = moddingHistory.scrollHeight;
}

function isRollbackRequest(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === "undo" ||
    normalized === "undo last" ||
    normalized === "rollback" ||
    normalized === "roll back" ||
    normalized === "rollback last" ||
    normalized === "revert" ||
    normalized === "revert last"
  );
}

const MAX_AI_RETRIES = 3;

async function handleModdingRequest(text: string) {
  appendModdingMessage(text, "user");
  moddingInput.value = "";

  // Add user message to conversation history
  conversationHistory.push({ role: "user", content: text });

  try {
    if (isRollbackRequest(text)) {
      const rollback = moddingAPI.rollbackLastPatch();
      if (rollback.success) {
        updateHud();
        appendModdingMessage("Rolled back the last change.", "system");
      } else {
        appendModdingMessage(
          rollback.errors?.join(" ") ?? "Nothing to rollback.",
          "error"
        );
      }
      return;
    }

    const snapshot = moddingAPI.getSnapshot();

    // Show request info to user (subtle/greyed)
    appendModdingMessage(`→ "${text}"`, "request");

    // Show thinking indicator
    const thinkingEl = appendModdingMessage("Thinking", "thinking");

    let lastError: string | null = null;
    let result: PromptResult | null = null;

    // Retry loop with error feedback
    for (let attempt = 1; attempt <= MAX_AI_RETRIES; attempt++) {
      try {
        // If retrying, include error context in the prompt
        const promptWithContext = lastError && attempt > 1
          ? `${text}\n\n[Previous attempt failed with error: ${lastError}. Please try a different approach.]`
          : text;

        result = await moddingProvider.processPrompt(promptWithContext, snapshot, conversationHistory);

        // Remove thinking indicator
        removeModdingMessage(thinkingEl);

        // Show debug info if enabled
        appendDebugInfo(result.debug, result.debug ? "api" : "keyword");

        if (result.patch.ops.length === 0) {
          // No operations generated - show the explanation as help text
          appendModdingMessage(result.explanation, "system");
          appendModdingHint();
          return;
        }

        // Show what the AI returned
        appendOperationsMessage(result.patch.ops);

        // Apply the patch and check for errors
        const applyResult = await moddingAPI.applyPatch(result.patch, {
          prompt: text,
          explanation: result.explanation,
        });

        if (applyResult.success) {
          appendModdingMessage(result.explanation, "agent");
          // Add assistant response to conversation history
          conversationHistory.push({ role: "assistant", content: result.explanation });
          return; // Success - exit
        } else {
          // Capture error for retry
          lastError = applyResult.errors?.join(", ") ?? "Unknown error applying patch";

          if (attempt < MAX_AI_RETRIES) {
            appendModdingMessage(
              `Attempt ${attempt}/${MAX_AI_RETRIES} failed: ${lastError}. Retrying...`,
              "retry"
            );
          } else {
            // Final attempt failed
            appendModdingMessage(
              `Failed after ${MAX_AI_RETRIES} attempts. Last error: ${lastError}`,
              "error"
            );
            appendModdingHint();
            return;
          }
        }
      } catch (err: any) {
        lastError = err.message || "Unknown error";
        removeModdingMessage(thinkingEl);

        if (attempt < MAX_AI_RETRIES) {
          appendModdingMessage(
            `Attempt ${attempt}/${MAX_AI_RETRIES} failed: ${lastError}. Retrying...`,
            "retry"
          );
          // Show thinking again for retry
          const retryThinkingEl = appendModdingMessage("Thinking", "thinking");
          // Replace thinkingEl reference for cleanup on next iteration
          Object.assign(thinkingEl, { parentNode: retryThinkingEl.parentNode });
        } else {
          appendModdingMessage(
            `Failed after ${MAX_AI_RETRIES} attempts: ${lastError}`,
            "error"
          );
          appendModdingHint();
          return;
        }
      }
    }
  } catch (err: any) {
    appendModdingMessage(err.message, "error");
    appendModdingHint();
  }
}

moddingCloseBtn.addEventListener("click", toggleModdingUI);
moddingResetBtn.addEventListener("click", () => {
  resetRules();
  resetLevel();
  conversationHistory.length = 0; // Clear conversation history
  appendModdingMessage("Reset rules and level.", "system");
});
moddingDebugToggle.addEventListener("click", () => {
  moddingDebugMode = !moddingDebugMode;
  moddingDebugToggle.textContent = moddingDebugMode ? "Debug: On" : "Debug: Off";
  moddingDebugToggle.classList.toggle("is-active", moddingDebugMode);
  appendModdingMessage(
    moddingDebugMode
      ? "Debug mode enabled. Raw AI request/response will be shown."
      : "Debug mode disabled.",
    "system"
  );
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

// Drag functionality for modding panel
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panelStartX = 0;
let panelStartY = 0;

function startDrag(clientX: number, clientY: number) {
  isDragging = true;
  dragStartX = clientX;
  dragStartY = clientY;
  const rect = moddingOverlay.getBoundingClientRect();
  panelStartX = rect.left;
  panelStartY = rect.top;
  moddingHeader.style.cursor = "grabbing";
}

function doDrag(clientX: number, clientY: number) {
  if (!isDragging) return;
  const dx = clientX - dragStartX;
  const dy = clientY - dragStartY;
  const newX = panelStartX + dx;
  const newY = panelStartY + dy;
  // Constrain to viewport
  const maxX = window.innerWidth - moddingOverlay.offsetWidth;
  const maxY = window.innerHeight - moddingOverlay.offsetHeight;
  moddingOverlay.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
  moddingOverlay.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
  moddingOverlay.style.right = "auto";
}

function endDrag() {
  isDragging = false;
  moddingHeader.style.cursor = "move";
}

moddingHeader.addEventListener("mousedown", (e) => {
  if ((e.target as HTMLElement).tagName === "BUTTON") return;
  e.preventDefault();
  startDrag(e.clientX, e.clientY);
});

document.addEventListener("mousemove", (e) => {
  doDrag(e.clientX, e.clientY);
});

document.addEventListener("mouseup", () => {
  endDrag();
});

moddingHeader.addEventListener("touchstart", (e) => {
  if ((e.target as HTMLElement).tagName === "BUTTON") return;
  const touch = e.touches[0];
  startDrag(touch.clientX, touch.clientY);
}, { passive: true });

document.addEventListener("touchmove", (e) => {
  if (!isDragging) return;
  const touch = e.touches[0];
  doDrag(touch.clientX, touch.clientY);
}, { passive: true });

document.addEventListener("touchend", () => {
  endDrag();
});
