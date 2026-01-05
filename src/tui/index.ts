#!/usr/bin/env node
/**
 * Super Mo TUI - Terminal User Interface
 *
 * A text-based interface for playing the game in a terminal.
 * Features split-screen with game view and AI chat console.
 *
 * Usage:
 *   npm run tui                              # Game only (no AI)
 *   ANTHROPIC_API_KEY=sk-... npm run tui     # With Claude API
 *   SUPER_MO_API_URL=https://... npm run tui # With Cloudflare Worker
 */

import blessed from "blessed";
import Anthropic from "@anthropic-ai/sdk";
import { GameEngine, ToolExecutor } from "../engine/index.js";

// AI backend types
type AIBackend = "none" | "anthropic" | "cloudflare";

// Type definitions for blessed (minimal)
type BlessedScreen = ReturnType<typeof blessed.screen>;
type BlessedBox = ReturnType<typeof blessed.box>;
type BlessedLog = ReturnType<typeof blessed.log>;
type BlessedTextbox = ReturnType<typeof blessed.textbox>;

// Initialize engine
const engine = new GameEngine();
const tools = new ToolExecutor(engine);

// Game constants
const GAME_WIDTH = 40;
const GAME_HEIGHT = 18;

// Entity ASCII representations
const ENTITY_CHARS: Record<string, string> = {
  player: "☺",
  coin: "●",
  platform: "═",
  enemy: "◆",
  goal: "⚑",
  default: "□",
};

// Create blessed screen with mouse support
const screen: BlessedScreen = blessed.screen({
  smartCSR: true,
  title: "Super Mo - Terminal Edition",
  mouse: true, // Enable mouse support
});

// Create main container
const mainBox: BlessedBox = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  style: { bg: "black" },
});

// Create game view (left side, 60% width)
const gameBox: BlessedBox = blessed.box({
  parent: mainBox,
  label: " 🎮 Game ",
  top: 0,
  left: 0,
  width: "60%",
  height: "100%-3",
  border: { type: "line" },
  style: {
    border: { fg: "cyan" },
    bg: "black",
  },
  focusable: true, // Allow focus for keyboard input
  keys: true, // Enable key events
});

// Game content area
const gameContent: BlessedBox = blessed.box({
  parent: gameBox,
  top: 1,
  left: 1,
  width: "100%-4",
  height: "100%-4",
  tags: true,
  style: { bg: "black", fg: "white" },
});

// HUD bar at top of game
const hudBox: BlessedBox = blessed.box({
  parent: gameBox,
  top: 0,
  left: 1,
  width: "100%-4",
  height: 1,
  tags: true,
  style: { bg: "blue", fg: "white" },
});

// Create AI console (right side, 40% width)
const consoleBox: BlessedBox = blessed.box({
  parent: mainBox,
  label: " 🤖 AI Console (Tab to chat) ",
  top: 0,
  left: "60%",
  width: "40%",
  height: "100%-3",
  border: { type: "line" },
  style: {
    border: { fg: "green" },
    bg: "black",
  },
});

// Console output (scrollable log)
const consoleLog: BlessedLog = blessed.log({
  parent: consoleBox,
  top: 0,
  left: 0,
  width: "100%-2",
  height: "100%-5",
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: "│",
    style: { fg: "green" },
  },
  style: { bg: "black", fg: "gray" },
});

// Console input
const consoleInput: BlessedTextbox = blessed.textbox({
  parent: consoleBox,
  label: " Type message... ",
  bottom: 0,
  left: 0,
  width: "100%-2",
  height: 3,
  border: { type: "line" },
  style: {
    border: { fg: "green" },
    bg: "black",
    fg: "white",
  },
  inputOnFocus: true,
});

// Status bar at bottom
const statusBar: BlessedBox = blessed.box({
  parent: mainBox,
  bottom: 0,
  left: 0,
  width: "100%",
  height: 3,
  border: { type: "line" },
  tags: true,
  style: {
    border: { fg: "yellow" },
    bg: "black",
    fg: "white",
  },
});

// Game state
let gameLoopInterval: ReturnType<typeof setInterval> | null = null;
let lastTime = Date.now();
const inputState = {
  horizontal: 0,
  vertical: 0,
  jump: false,
  dash: false,
};

// Track pressed keys for proper key up/down
const keysPressed = new Set<string>();

// Track which pane is focused (game vs chat)
let chatFocused = false;

// AI state
let aiBackend: AIBackend = "none";
let anthropic: Anthropic | null = null;
let cloudflareUrl: string | null = null;
const conversationHistory: Array<{ role: string; content: unknown }> = [];
let isProcessingAI = false;

// Default Cloudflare Pages URL
const DEFAULT_API_URL = "https://super-mo.pages.dev";

// Initialize AI backend based on environment variables
const apiKey = process.env.ANTHROPIC_API_KEY;
const workerUrl = process.env.SUPER_MO_API_URL ?? DEFAULT_API_URL;

if (apiKey) {
  // Use Anthropic API if key is provided (more powerful, supports full tool use)
  anthropic = new Anthropic({ apiKey });
  aiBackend = "anthropic";
  logToConsole("{green-fg}✓ AI connected (Claude){/green-fg}");
  logToConsole("{gray-fg}Type a message and press Enter{/gray-fg}");
} else {
  // Default to Cloudflare Worker
  cloudflareUrl = workerUrl.replace(/\/$/, "");
  aiBackend = "cloudflare";
  logToConsole("{green-fg}✓ AI connected (Cloudflare){/green-fg}");
  logToConsole("{gray-fg}Type a message and press Enter{/gray-fg}");
}

/**
 * Log a message to the AI console.
 */
function logToConsole(message: string): void {
  consoleLog.log(message);
  screen.render();
}

/**
 * Create initial game state.
 */
function createInitialGameState(): void {
  // Define templates
  tools.call("define_template", {
    name: "player",
    template: {
      tags: ["player"],
      components: {
        Position: { x: 5, y: 14 },
        Velocity: { vx: 0, vy: 0 },
        Collider: { width: 1, height: 1 },
        Health: { lives: 3 },
        Stats: { coins: 0, score: 0 },
      },
    },
  });

  tools.call("define_template", {
    name: "coin",
    template: {
      tags: ["coin"],
      components: {
        Position: { x: 0, y: 0 },
        Collider: { width: 1, height: 1 },
      },
    },
  });

  tools.call("define_template", {
    name: "platform",
    template: {
      tags: ["platform", "solid"],
      components: {
        Position: { x: 0, y: 0 },
        Collider: { width: 5, height: 1 },
      },
    },
  });

  // Create player
  tools.call("spawn_entity", { template: "player", id: "player-1" });

  // Create coins in a pattern
  const coinPositions = [
    { x: 12, y: 12 },
    { x: 15, y: 10 },
    { x: 18, y: 12 },
    { x: 25, y: 8 },
    { x: 30, y: 10 },
  ];
  coinPositions.forEach((pos, i) => {
    tools.call("spawn_entity", {
      template: "coin",
      id: `coin-${i}`,
      at: pos,
    });
  });

  // Create ground
  tools.call("spawn_entity", {
    template: "platform",
    id: "ground",
    at: { x: 0, y: 16 },
  });
  tools.call("set_component", {
    id: "ground",
    component: "Collider",
    data: { width: GAME_WIDTH, height: 2 },
  });

  // Create floating platforms
  const platformPositions = [
    { x: 10, y: 13, width: 6 },
    { x: 20, y: 11, width: 5 },
    { x: 28, y: 9, width: 7 },
  ];
  platformPositions.forEach((p, i) => {
    tools.call("spawn_entity", {
      template: "platform",
      id: `platform-${i}`,
      at: { x: p.x, y: p.y },
    });
    tools.call("set_component", {
      id: `platform-${i}`,
      component: "Collider",
      data: { width: p.width, height: 1 },
    });
  });

  // Define player movement system
  tools.call("define_system", {
    system: {
      name: "player-input",
      phase: "input",
      query: { tag: "player", has: ["Position", "Velocity"] },
      actions: [
        { type: "set", target: "entity.Velocity.vx", value: "input.horizontal * 12" },
      ],
    },
  });

  // Define gravity system
  tools.call("define_system", {
    system: {
      name: "gravity",
      phase: "physics",
      query: { has: ["Velocity"], not: ["Static"] },
      actions: [{ type: "add", target: "entity.Velocity.vy", value: "20 * dt" }],
    },
  });

  // Define movement system
  tools.call("define_system", {
    system: {
      name: "movement",
      phase: "physics",
      query: { has: ["Position", "Velocity"] },
      actions: [
        { type: "add", target: "entity.Position.x", value: "entity.Velocity.vx * dt" },
        { type: "add", target: "entity.Position.y", value: "entity.Velocity.vy * dt" },
      ],
    },
  });

  logToConsole("{cyan-fg}Game initialized!{/cyan-fg}");
  logToConsole("{gray-fg}Arrow keys to move{/gray-fg}");
}

/**
 * Render game state to ASCII.
 */
function renderGame(): void {
  const state = engine.getState();
  const mode = state.modes.current;

  // Create empty grid
  const grid: string[][] = [];
  for (let y = 0; y < GAME_HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < GAME_WIDTH; x++) {
      grid[y][x] = " ";
    }
  }

  // Render entities (platforms first, then others)
  const sortedEntities = [...state.entities].sort((a, b) => {
    if (a.tags.includes("platform") && !b.tags.includes("platform")) return -1;
    if (!a.tags.includes("platform") && b.tags.includes("platform")) return 1;
    return 0;
  });

  for (const entity of sortedEntities) {
    const pos = entity.components.Position as { x: number; y: number } | undefined;
    if (!pos) continue;

    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);

    if (entity.tags.includes("platform")) {
      const collider = entity.components.Collider as { width?: number } | undefined;
      const width = collider?.width ?? 1;
      for (let dx = 0; dx < width; dx++) {
        const px = x + dx;
        if (px >= 0 && px < GAME_WIDTH && y >= 0 && y < GAME_HEIGHT) {
          grid[y][px] = `{green-fg}═{/green-fg}`;
        }
      }
    } else if (x >= 0 && x < GAME_WIDTH && y >= 0 && y < GAME_HEIGHT) {
      let char = ENTITY_CHARS.default;
      let color = "white";

      if (entity.tags.includes("player")) {
        char = ENTITY_CHARS.player;
        color = "cyan";
      } else if (entity.tags.includes("coin")) {
        char = ENTITY_CHARS.coin;
        color = "yellow";
      } else if (entity.tags.includes("enemy")) {
        char = ENTITY_CHARS.enemy;
        color = "red";
      }

      grid[y][x] = `{${color}-fg}${char}{/${color}-fg}`;
    }
  }

  // Add mode overlay for non-playing modes
  if (mode !== "playing") {
    const centerY = Math.floor(GAME_HEIGHT / 2);
    const message =
      mode === "title"
        ? "SUPER MO - Press ENTER to Start"
        : mode === "intro"
          ? "Get Ready! - Press ENTER"
          : mode === "paused"
            ? "PAUSED - Press P to Resume"
            : mode;

    const startX = Math.floor((GAME_WIDTH - message.length) / 2);
    for (let i = 0; i < message.length && startX + i < GAME_WIDTH; i++) {
      if (startX + i >= 0) {
        grid[centerY][startX + i] = `{bold}{white-fg}${message[i]}{/white-fg}{/bold}`;
      }
    }
  }

  // Convert grid to string
  const content = grid.map((row) => row.join("")).join("\n");
  gameContent.setContent(content);

  // Update HUD
  const player = state.entities.find((e) => e.tags.includes("player"));
  const stats = (player?.components.Stats as { score?: number; coins?: number }) ?? {};
  const health = (player?.components.Health as { lives?: number }) ?? {};
  hudBox.setContent(
    ` {bold}${mode.toUpperCase()}{/bold} | Lives: ${health.lives ?? 0} | Coins: ${stats.coins ?? 0} | Score: ${stats.score ?? 0}`
  );

  // Update status bar
  const controls =
    mode === "playing"
      ? "← → Move | ↑ Jump | P Pause | Tab AI | Q Quit"
      : "Enter Start | Tab AI | Q Quit";
  statusBar.setContent(` ${controls}`);

  screen.render();
}

/**
 * Game loop tick.
 */
function gameLoop(): void {
  const now = Date.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Update input state from pressed keys
  inputState.horizontal = 0;
  if (keysPressed.has("left") || keysPressed.has("a")) {
    inputState.horizontal = -1;
  } else if (keysPressed.has("right") || keysPressed.has("d")) {
    inputState.horizontal = 1;
  }

  inputState.jump = keysPressed.has("up") || keysPressed.has("w") || keysPressed.has("space");

  const mode = engine.getMode();
  if (mode === "playing") {
    // Simple ground collision
    const player = engine.getState().entities.find((e) => e.tags.includes("player"));
    if (player) {
      const pos = player.components.Position as { x: number; y: number };
      const vel = player.components.Velocity as { vx: number; vy: number };

      // Ground at y=16
      if (pos && vel && pos.y >= 15) {
        tools.call("set_component", {
          id: player.id,
          component: "Position",
          data: { x: pos.x, y: 15 },
        });
        tools.call("set_component", {
          id: player.id,
          component: "Velocity",
          data: { vx: vel.vx, vy: 0 },
        });

        // Jump
        if (inputState.jump) {
          tools.call("set_component", {
            id: player.id,
            component: "Velocity",
            data: { vx: vel.vx, vy: -15 },
          });
        }
      }

      // Boundary check
      if (pos && pos.x < 0) {
        tools.call("set_component", {
          id: player.id,
          component: "Position",
          data: { x: 0, y: pos.y },
        });
      } else if (pos && pos.x > GAME_WIDTH - 1) {
        tools.call("set_component", {
          id: player.id,
          component: "Position",
          data: { x: GAME_WIDTH - 1, y: pos.y },
        });
      }
    }

    engine.step(dt, inputState);
  }

  renderGame();
}

/**
 * Get tool definitions for Claude.
 */
function getToolDefinitions(): Anthropic.Tool[] {
  const engineTools = tools.getTools();
  return engineTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(t.parameters).map(([name, param]) => [
          name,
          {
            type: param.type === "object" ? "object" : param.type,
            description: param.description,
          },
        ])
      ),
      required: Object.entries(t.parameters)
        .filter(([, param]) => param.required)
        .map(([name]) => name),
    },
  }));
}

/**
 * Process AI message via Cloudflare Worker.
 */
async function processCloudflareMessage(userMessage: string): Promise<void> {
  if (!cloudflareUrl) return;

  const state = engine.getState();

  // Build a simplified state snapshot for the API
  const stateSnapshot = {
    mode: engine.getMode(),
    entities: state.entities.length,
    player: state.entities.find((e) => e.tags.includes("player"))?.components,
    rules: state.rules,
  };

  try {
    const response = await fetch(`${cloudflareUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: userMessage,
        state: stateSnapshot,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as { error?: string }).error ?? `HTTP ${response.status}`);
    }

    const data = await response.json() as {
      response?: string;
      tool_calls?: Array<{ name: string; arguments: { patch?: { ops?: unknown[] }; explanation?: string } }>;
    };

    // Show AI response
    if (data.response) {
      logToConsole(`{blue-fg}AI:{/blue-fg} ${data.response}`);
    }

    // Process tool calls (apply_patch operations)
    if (data.tool_calls && Array.isArray(data.tool_calls)) {
      for (const call of data.tool_calls) {
        if (call.name === "apply_patch" && call.arguments?.patch?.ops) {
          const ops = call.arguments.patch.ops as Array<{ op: string; [key: string]: unknown }>;
          for (const op of ops) {
            logToConsole(`{magenta-fg}⚙ ${op.op}{/magenta-fg}`);

            // Map apply_patch ops to engine tools
            if (op.op === "setRule" && typeof op.path === "string" && typeof op.value === "number") {
              tools.call("set_rule", { path: op.path, value: op.value });
              logToConsole(`{green-fg}  ✓ Set ${op.path} = ${op.value}{/green-fg}`);
            } else if (op.op === "removeEntities" && op.filter) {
              const filter = op.filter as { kind?: string };
              if (filter.kind) {
                const result = tools.call("get_entities", { tag: filter.kind });
                if (result.success && Array.isArray(result.data)) {
                  for (const entity of result.data) {
                    tools.call("destroy_entity", { id: entity.id });
                  }
                  logToConsole(`{green-fg}  ✓ Removed ${result.data.length} ${filter.kind}(s){/green-fg}`);
                }
              }
            }
          }

          if (call.arguments.explanation) {
            logToConsole(`{blue-fg}AI:{/blue-fg} ${call.arguments.explanation}`);
          }
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    logToConsole(`{red-fg}Error: ${err.message}{/red-fg}`);
  }
}

/**
 * Process AI message via Anthropic API (with full tool use).
 */
async function processAnthropicMessage(userMessage: string): Promise<void> {
  if (!anthropic) return;

  if (userMessage) {
    conversationHistory.push({ role: "user", content: userMessage });
  }

  const state = engine.getState();
  const systemPrompt = `You are an AI assistant controlling a game called Super Mo in a terminal TUI.

You have tools to:
- Create/modify/delete entities (players, coins, platforms, enemies)
- Change physics rules (gravity, speed)
- Trigger game events and mode changes
- Query game state

Current state: ${state.entities.length} entities, mode: ${engine.getMode()}
Player position: ${JSON.stringify(state.entities.find((e) => e.tags.includes("player"))?.components.Position)}

Be concise. Use tools to make requested changes. Confirm what you did.`;

  try {
    let continueLoop = true;

    while (continueLoop) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools: getToolDefinitions(),
        messages: conversationHistory as Anthropic.MessageParam[],
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );

      conversationHistory.push({ role: "assistant", content: response.content });

      if (toolUseBlocks.length > 0) {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          logToConsole(`{magenta-fg}⚙ ${toolUse.name}{/magenta-fg}`);

          const input = toolUse.input as Record<string, unknown>;
          const result = tools.call(toolUse.name, input);

          if (result.success) {
            logToConsole(`{green-fg}  ✓ Done{/green-fg}`);
          } else {
            logToConsole(`{red-fg}  ✗ ${result.error}{/red-fg}`);
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }

        conversationHistory.push({ role: "user", content: toolResults });
        continueLoop = response.stop_reason === "tool_use";
      } else {
        continueLoop = false;
      }

      for (const text of textBlocks) {
        logToConsole(`{blue-fg}AI:{/blue-fg} ${text.text}`);
      }
    }
  } catch (error) {
    const err = error as Error;
    logToConsole(`{red-fg}Error: ${err.message}{/red-fg}`);
  }
}

/**
 * Process AI message (routes to appropriate backend).
 */
async function processAIMessage(userMessage: string): Promise<void> {
  if (aiBackend === "none") {
    logToConsole("{red-fg}AI not available{/red-fg}");
    return;
  }

  if (isProcessingAI) {
    logToConsole("{yellow-fg}Still processing...{/yellow-fg}");
    return;
  }

  isProcessingAI = true;

  if (userMessage) {
    logToConsole(`{white-fg}You:{/white-fg} ${userMessage}`);
  }

  try {
    if (aiBackend === "cloudflare") {
      await processCloudflareMessage(userMessage);
    } else if (aiBackend === "anthropic") {
      await processAnthropicMessage(userMessage);
    }
  } catch (error) {
    const err = error as Error;
    logToConsole(`{red-fg}Error: ${err.message}{/red-fg}`);
  }

  isProcessingAI = false;
}

// Key bindings - track key state for game controls
// Only process when chat is NOT focused to avoid double input
screen.on("keypress", (_ch: string, key: { name: string; full: string }) => {
  // Skip if chat is focused (textbox handles its own input)
  if (chatFocused) return;

  if (key && key.name) {
    keysPressed.add(key.name);

    // Clear key after short delay (simulate key up)
    setTimeout(() => {
      keysPressed.delete(key.name);
    }, 100);
  }
});

// Mode transitions with Enter (only when not in chat)
screen.key(["enter"], () => {
  if (chatFocused) return; // Let textbox handle Enter
  const mode = engine.getMode();
  if (mode === "title") {
    createInitialGameState();
    tools.call("trigger_transition", { trigger: "start" }); // title -> intro
  } else if (mode === "intro") {
    tools.call("trigger_transition", { trigger: "start" }); // intro -> playing
  } else if (mode === "paused") {
    tools.call("trigger_transition", { trigger: "resume" });
  } else if (mode === "complete") {
    tools.call("trigger_transition", { trigger: "next" });
  } else if (mode === "gameover") {
    tools.call("trigger_transition", { trigger: "retry" });
  }
});

// Pause toggle (only when not in chat)
screen.key(["p"], () => {
  if (chatFocused) return; // Let textbox handle 'p'
  const mode = engine.getMode();
  if (mode === "playing") {
    tools.call("trigger_transition", { trigger: "pause" });
  } else if (mode === "paused") {
    tools.call("trigger_transition", { trigger: "resume" });
  }
});

/**
 * Focus the chat input pane.
 */
function focusChat(): void {
  chatFocused = true;
  consoleInput.focus();
  consoleInput.readInput();
  consoleBox.style.border.fg = "yellow"; // Highlight active pane
  gameBox.style.border.fg = "gray";
  screen.render();
}

/**
 * Focus the game pane (unfocus chat).
 */
function focusGame(): void {
  chatFocused = false;
  consoleInput.cancel();
  gameBox.focus(); // Return focus to game pane for controls
  gameBox.style.border.fg = "cyan"; // Highlight active pane
  consoleBox.style.border.fg = "green";
  screen.render();
}

// Tab to toggle between panes
screen.key(["tab"], () => {
  if (chatFocused) {
    focusGame();
  } else {
    focusChat();
  }
});

// Arrow key handlers - explicit bindings are more reliable than keypress events
screen.key(["left", "a"], () => {
  if (!chatFocused) {
    keysPressed.add("left");
    setTimeout(() => keysPressed.delete("left"), 150);
  }
});

screen.key(["right", "d"], () => {
  if (!chatFocused) {
    keysPressed.add("right");
    setTimeout(() => keysPressed.delete("right"), 150);
  }
});

screen.key(["up", "w", "space"], () => {
  if (!chatFocused) {
    keysPressed.add("up");
    setTimeout(() => keysPressed.delete("up"), 150);
  }
});

// Mouse click on game pane focuses it
gameBox.on("click", () => {
  focusGame();
});

// Keyboard input on game pane
gameBox.on("keypress", (_ch: string, key: { name: string }) => {
  if (key && key.name) {
    keysPressed.add(key.name);
    setTimeout(() => {
      keysPressed.delete(key.name);
    }, 100);
  }
});

// Mouse click on console pane focuses it
consoleBox.on("click", () => {
  focusChat();
});

// Console input handling
consoleInput.on("submit", async (value: string) => {
  if (value && value.trim()) {
    await processAIMessage(value.trim());
  }
  consoleInput.clearValue();
  // Stay in chat mode after submit - must call readInput again after clearValue
  consoleInput.readInput();
  screen.render();
});

// Tab in console cycles back to game
consoleInput.key(["tab"], () => {
  focusGame();
});

// Escape in console returns to game
consoleInput.key(["escape"], () => {
  focusGame();
});

// Quit
screen.key(["q", "C-c"], () => {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
  }
  process.exit(0);
});

// Welcome message
logToConsole("{bold}{cyan-fg}━━━━━━━━━━━━━━━━━━━━━━━━━{/cyan-fg}{/bold}");
logToConsole("{bold}{cyan-fg}  Super Mo Terminal UI  {/cyan-fg}{/bold}");
logToConsole("{bold}{cyan-fg}━━━━━━━━━━━━━━━━━━━━━━━━━{/cyan-fg}{/bold}");
logToConsole("");
logToConsole("{gray-fg}Press Enter to start{/gray-fg}");
logToConsole("{gray-fg}Press Tab to chat with AI{/gray-fg}");
logToConsole("");

// Initial render
renderGame();

// Focus game pane by default
gameBox.focus();

// Start game loop (30 FPS)
gameLoopInterval = setInterval(gameLoop, 1000 / 30);

screen.render();
