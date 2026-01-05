/**
 * Super Mo - AI-First Game Engine
 *
 * Phase 13: Full Integration
 * Game loop with engine, renderer, input handling, and AI connection.
 */

import { GameEngine, ToolExecutor, EngineState, StepInput } from "./engine/index.js";
import {
  HeadlessRenderer,
  createHeadlessRenderer,
  Canvas2DRenderer,
  createCanvas2DRenderer,
  createCanvas2DRendererById,
} from "./representation/index.js";

// Initialize engine and tools
const engine = new GameEngine();
const tools = new ToolExecutor(engine);

// Initialize renderer (will be set up when DOM is ready)
let renderer: Canvas2DRenderer | null = null;
let gameLoopId: number | null = null;
let lastTime = 0;

// Input state
const inputState: StepInput = {
  horizontal: 0,
  vertical: 0,
  jump: false,
  dash: false,
};

// Key state tracking
const keysPressed = new Set<string>();

// Track if input is already set up (for idempotent setupInput)
let inputSetupDone = false;

/**
 * Handle keyboard input.
 */
function setupInput(): void {
  // Prevent duplicate event listeners
  if (inputSetupDone) return;
  inputSetupDone = true;

  document.addEventListener("keydown", (e) => {
    keysPressed.add(e.code);
    updateInputState();

    // Handle mode transitions
    handleModeInput(e.code);
  });

  document.addEventListener("keyup", (e) => {
    keysPressed.delete(e.code);
    updateInputState();
  });

  // Handle touch controls
  setupTouchControls();
}

/**
 * Update input state from pressed keys.
 */
function updateInputState(): void {
  inputState.horizontal = 0;
  if (keysPressed.has("ArrowLeft") || keysPressed.has("KeyA")) {
    inputState.horizontal = -1;
  } else if (keysPressed.has("ArrowRight") || keysPressed.has("KeyD")) {
    inputState.horizontal = 1;
  }

  inputState.vertical = 0;
  if (keysPressed.has("ArrowUp") || keysPressed.has("KeyW")) {
    inputState.vertical = -1;
  } else if (keysPressed.has("ArrowDown") || keysPressed.has("KeyS")) {
    inputState.vertical = 1;
  }

  inputState.jump = keysPressed.has("Space") || keysPressed.has("KeyZ");
  inputState.dash = keysPressed.has("ShiftLeft") || keysPressed.has("ShiftRight");
}

/**
 * Handle input for mode transitions.
 */
function handleModeInput(code: string): void {
  const mode = engine.getMode();

  // Enter/Space to advance through screens
  if (code === "Enter" || code === "Space") {
    switch (mode) {
      case "title":
        // Create initial game state when starting from title (if not already done)
        ensureGameStateExists();
        tools.call("trigger_transition", { trigger: "start" });
        break;
      case "intro":
        tools.call("trigger_transition", { trigger: "start" });
        break;
      case "complete":
        tools.call("trigger_transition", { trigger: "next" });
        break;
      case "gameover":
        tools.call("trigger_transition", { trigger: "retry" });
        break;
      case "paused":
        tools.call("trigger_transition", { trigger: "resume" });
        break;
    }
  }

  // P or Escape to pause/resume
  if (code === "KeyP" || code === "Escape") {
    if (mode === "playing") {
      tools.call("trigger_transition", { trigger: "pause" });
    } else if (mode === "paused") {
      tools.call("trigger_transition", { trigger: "resume" });
    }
  }
}

/**
 * Set up touch controls.
 */
function setupTouchControls(): void {
  const touchControls = document.getElementById("touch-controls");
  if (!touchControls) return;

  // Handle touch buttons
  touchControls.addEventListener("touchstart", (e) => {
    const target = e.target as HTMLElement;
    const key = target.dataset.key;
    if (key) {
      keysPressed.add(key);
      updateInputState();
      e.preventDefault();
    }
  });

  touchControls.addEventListener("touchend", (e) => {
    const target = e.target as HTMLElement;
    const key = target.dataset.key;
    if (key) {
      keysPressed.delete(key);
      updateInputState();
      e.preventDefault();
    }
  });

  // Handle taps on overlays
  document.querySelectorAll(".start-overlay, .intro-overlay, .complete-overlay").forEach((overlay) => {
    overlay.addEventListener("click", () => {
      handleModeInput("Enter");
    });
  });
}

/**
 * Main game loop.
 */
function gameLoop(currentTime: number): void {
  gameLoopId = requestAnimationFrame(gameLoop);

  // Calculate delta time (capped at 100ms to prevent spiral of death)
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  // Only step the engine when in playing mode
  const mode = engine.getMode();
  if (mode === "playing") {
    engine.step(dt, inputState);
  }

  // Always render (even for title/pause screens)
  if (renderer) {
    renderer.render(engine.getState());
  }

  // Update HTML overlays based on mode
  updateOverlays(mode);
}

/**
 * Update HTML overlay visibility based on mode.
 */
function updateOverlays(mode: string): void {
  const overlays: Record<string, string> = {
    title: ".start-overlay",
    intro: ".intro-overlay",
    paused: ".pause-overlay",
    complete: ".complete-overlay",
  };

  // Hide all overlays first
  Object.values(overlays).forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.classList.add("is-hidden");
  });

  // Show current mode's overlay
  const currentSelector = overlays[mode];
  if (currentSelector) {
    const el = document.querySelector(currentSelector);
    if (el) el.classList.remove("is-hidden");
  }
}

// Flag to skip initial state creation (for testing)
let skipInitialState = false;

// Track if game state has been initialized
let gameStateInitialized = false;

/**
 * Ensure game state exists (creates it if not already done).
 * Called when transitioning from title screen.
 */
function ensureGameStateExists(): void {
  if (gameStateInitialized) return;

  // Check if player already exists (e.g., from test setup)
  const result = tools.call("get_entities", { tag: "player" });
  if (result.success && Array.isArray(result.data) && result.data.length > 0) {
    gameStateInitialized = true;
    return;
  }

  createInitialGameState();
  gameStateInitialized = true;
}

/**
 * Create initial game state with sample entities.
 * Can be skipped by setting skipInitialState = true before startGame().
 */
function createInitialGameState(): void {
  if (skipInitialState) {
    console.log("Skipping initial game state creation (test mode)");
    return;
  }

  // Define entity templates
  tools.call("define_template", {
    name: "player",
    template: {
      tags: ["player"],
      components: {
        Position: { x: 50, y: 100 },
        Velocity: { vx: 0, vy: 0 },
        Collider: { width: 16, height: 24, layer: "player" },
        Health: { lives: 3, invincibleUntil: 0 },
        Stats: { coins: 0, score: 0 },
        Sprite: { sheet: "player", animation: "idle" },
      },
    },
  });

  tools.call("define_template", {
    name: "coin",
    template: {
      tags: ["coin", "collectible"],
      components: {
        Position: { x: 0, y: 0 },
        Collider: { width: 8, height: 8, layer: "coin" },
        Sprite: { sheet: "items", animation: "coin" },
      },
    },
  });

  tools.call("define_template", {
    name: "platform",
    template: {
      tags: ["platform", "solid"],
      components: {
        Position: { x: 0, y: 0 },
        Collider: { width: 32, height: 8, layer: "solid" },
      },
    },
  });

  // Create player
  tools.call("spawn_entity", { template: "player", id: "player-1" });

  // Create some coins
  tools.call("spawn_entity", { template: "coin", id: "coin-1", at: { x: 100, y: 80 } });
  tools.call("spawn_entity", { template: "coin", id: "coin-2", at: { x: 130, y: 80 } });
  tools.call("spawn_entity", { template: "coin", id: "coin-3", at: { x: 160, y: 80 } });

  // Create platforms
  tools.call("spawn_entity", { template: "platform", id: "platform-1", at: { x: 80, y: 130 } });
  tools.call("spawn_entity", { template: "platform", id: "platform-2", at: { x: 150, y: 110 } });

  // Define basic systems
  tools.call("define_system", {
    system: {
      name: "gravity",
      phase: "physics",
      query: { has: ["Velocity"], not: ["Static"] },
      actions: [
        { type: "add", target: "Velocity.vy", value: "rules.physics.gravity * dt" },
      ],
    },
  });

  tools.call("define_system", {
    system: {
      name: "movement",
      phase: "physics",
      query: { has: ["Position", "Velocity"] },
      actions: [
        { type: "add", target: "Position.x", value: "Velocity.vx * dt" },
        { type: "add", target: "Position.y", value: "Velocity.vy * dt" },
      ],
    },
  });

  tools.call("define_system", {
    system: {
      name: "player-input",
      phase: "input",
      query: { tag: "player", has: ["Velocity"] },
      actions: [
        { type: "set", target: "Velocity.vx", value: "input.horizontal * rules.physics.moveSpeed" },
      ],
    },
  });

  const entityResult = tools.call("get_entities", {});
  const entities = entityResult.data as unknown[];
  console.log("Initial game state created with", entities?.length ?? 0, "entities");
}

/**
 * Set test mode to skip initial state creation.
 */
function setTestMode(enabled: boolean): void {
  skipInitialState = enabled;
}

/**
 * Start the game.
 * @param options.withInitialState - Create initial game entities (default: false for tests)
 */
function startGame(options: { withInitialState?: boolean } = {}): void {
  // Set up renderer
  renderer = createCanvas2DRendererById("game");

  // Set up input handling
  setupInput();

  // Create initial game state only if requested
  if (options.withInitialState) {
    createInitialGameState();
  }

  // Start game loop
  lastTime = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);

  console.log("Game loop started", options.withInitialState ? "with initial state" : "");
}

/**
 * Stop the game.
 */
function stopGame(): void {
  if (gameLoopId !== null) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }
  if (renderer) {
    renderer.destroy();
    renderer = null;
  }
}

// Expose for testing (tools interface - same as AI would use)
declare global {
  interface Window {
    __SUPER_MO__: {
      engine: GameEngine;
      tools: ToolExecutor;
      state: EngineState;
      createHeadlessRenderer: typeof createHeadlessRenderer;
      createCanvas2DRenderer: typeof createCanvas2DRenderer;
      createCanvas2DRendererById: typeof createCanvas2DRendererById;
      startGame: typeof startGame;
      stopGame: typeof stopGame;
      setTestMode: typeof setTestMode;
      inputState: StepInput;
    };
    __RENDERER_READY__: boolean;
  }
}

window.__SUPER_MO__ = {
  engine,
  tools,
  get state() {
    return engine.getState();
  },
  createHeadlessRenderer,
  createCanvas2DRenderer,
  createCanvas2DRendererById,
  startGame,
  stopGame,
  setTestMode,
  inputState,
};
window.__RENDERER_READY__ = true;

// Update title screen text
const startOverlay = document.querySelector(".start-overlay h1");
if (startOverlay) {
  startOverlay.textContent = "Super Mo";
}

// Auto-start game when document is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => startGame());
} else {
  startGame();
}

console.log("AI-First Engine initialized");
console.log("Available tools:", tools.getTools().map((t) => t.name).join(", "));
