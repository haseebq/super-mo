# AI-First Game Engine Architecture

## Vision

**AI-first development**: The game engine is designed from the ground up to be programmed via a chat/tool interface.

**Core Goal: Hot-swappable AI.** Any AI can connect to the running engine and have the exact same powers. Disconnect Claude Code, connect GPT-4, connect a local LLM - they all see the same state, have the same tools, can make the same changes. No special access, no backdoors.

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Agent                              │
│  (Claude Code during dev, deployed AI in production)        │
│                                                              │
│  Observes: Pure data state (JSON)                           │
│  Controls: Tool calls → Engine operations                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ Tool calls (query_state, spawn_entity, etc.)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   GAME ENGINE (Pure Data)                    │
├─────────────────────────────────────────────────────────────┤
│  State: {                                                    │
│    entities: [...],   // All game objects as data            │
│    rules: {...},      // Physics, scoring, behaviors         │
│    scripts: {...},    // Entity behavior definitions         │
│    frame: number,     // Simulation tick                     │
│  }                                                           │
│                                                              │
│  Operations: step(), spawn(), remove(), setRule(), etc.     │
│  Deterministic: Same inputs → Same outputs                  │
│  No rendering, no I/O, no side effects                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ State (read-only)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              REPRESENTATION ENGINE (Swappable)               │
├─────────────────────────────────────────────────────────────┤
│  Input: Game engine state                                    │
│  Output: Visual rendering                                    │
│                                                              │
│  Implementations:                                            │
│    - Canvas2DRenderer: 2D pixel art                         │
│    - WebGLRenderer: Hardware accelerated 2D                 │
│    - ThreeJSRenderer: 3D visualization                      │
│    - ASCIIRenderer: Terminal output                         │
│    - HeadlessRenderer: No output (AI simulation)            │
└─────────────────────────────────────────────────────────────┘
```

## Core Principles

1. **Engine is pure data**: All game state is JSON-serializable. No rendering, no I/O, no side effects.
2. **Representation renders state**: The representation engine just draws whatever the game engine state says. Swappable (2D Canvas, WebGL, 3D, ASCII).
3. **AI sees everything**: AI observes exact game state as data. No hidden state. What AI sees = what gets rendered.
4. **Tools are the API**: All engine operations exposed as tools. AI programs by making tool calls.
5. **Same interface everywhere**: Dev AI and deployed AI use identical tools. No special access.

## Architecture Components

### 1. GameEngine (Pure Simulation)

```typescript
// src/engine/engine.ts
interface GameEngine {
  // State
  getState(): EngineState;
  loadState(state: EngineState): void;

  // Simulation
  step(dt: number): StepResult;

  // Operations (all exposed as tools)
  setRule(path: string, value: unknown): void;
  spawnEntity(kind: EntityKind, props: EntityProps): EntityId;
  removeEntity(id: EntityId): void;
  setEntityScript(target: EntityKind, script: string): void;
  defineEntityType(name: string, schema: EntitySchema): void;
  // ... all operations
}

interface EngineState {
  frame: number;
  time: number;
  rules: Rules;
  entities: Map<EntityId, Entity>;
  scripts: Map<EntityKind, CompiledScript>;
  // Everything serializable
}
```

### 2. Tool Interface

```typescript
// src/engine/tools.ts
interface ChatInterface {
  // Tool definitions for AI
  getToolDefinitions(): ToolDefinition[];

  // Execute a tool call from AI
  executeTool(name: string, args: unknown): ToolResult;

  // Get current state summary for AI context
  getStateSummary(): string;
}

// Every engine operation becomes a tool:
const TOOLS = [
  {
    name: "query_state",
    description: "Get current engine state (entities, rules, scripts)",
    parameters: { filter?: "entities" | "rules" | "scripts" | "all" }
  },
  {
    name: "step_simulation",
    description: "Advance simulation by N frames, return state diff",
    parameters: { frames: number }
  },
  {
    name: "spawn_entity",
    description: "Create a new entity in the world",
    parameters: { kind: string, x: number, y: number, props?: object }
  },
  {
    name: "set_rule",
    description: "Modify a game rule (physics, scoring, etc)",
    parameters: { path: string, value: unknown }
  },
  {
    name: "define_behavior",
    description: "Define a reusable behavior script for entity type",
    parameters: { target: string, script: string }
  },
  {
    name: "set_screen",
    description: "Configure a UI screen (title, intro, complete, etc)",
    parameters: { screen: string, config: object }
  },
  {
    name: "define_mode_transition",
    description: "Define how game modes transition",
    parameters: { from: string, trigger: string, to: string }
  },
  {
    name: "dump_state",
    description: "Export complete engine state as JSON",
    parameters: {}
  },
  {
    name: "load_state",
    description: "Load a previously exported state",
    parameters: { state: object }
  }
];
```

### 3. Representation Engine (Presentation Only)

```typescript
// src/representation/renderer.ts
interface Renderer {
  render(state: EngineState): void;
  setViewport(width: number, height: number): void;
}

// Renderer knows nothing about game logic
// Just draws what the state says
class Canvas2DRenderer implements Renderer {
  render(state: EngineState) {
    // Draw based on current mode
    if (state.modes.current === "title") {
      this.drawScreen(state.screens.title);
    } else if (state.modes.current === "playing") {
      this.drawLevel(state.level);
      for (const entity of state.entities) {
        this.drawEntity(entity);
      }
    }
    // ...
  }
}
```

## Everything Is Data

The game engine processes pure data. **Everything** is data:

```typescript
interface EngineState {
  // Game content
  entities: Entity[];           // Player, enemies, coins, platforms
  level: TileMap;               // World geometry

  // Behaviors (AI-written)
  scripts: {
    enemy: string;              // "entity.x += Math.sin(time) * 2"
    coin: string;               // "entity.y += Math.cos(time) * 0.5"
    player: string;             // Custom player behavior
  };

  // Rules (AI-configured)
  rules: {
    physics: { gravity: number, friction: number, jumpImpulse: number };
    scoring: { coinValue: number, enemyKillBonus: number };
    controls: { jump: string, left: string, right: string };
  };

  // UI Flow (AI-defined)
  screens: {
    title: { text: string, prompt: string };
    intro: { title: string, goal: string };
    story: Array<{ speaker: string, text: string }>;
    complete: { message: string };
  };

  // Mode state machine (AI-configured)
  modes: {
    current: "title" | "intro" | "playing" | "paused" | "complete";
    transitions: {
      title: { onInput: string };
      intro: { onInput: string };
      playing: { onDeath: string, onGoal: string };
    };
  };

  // Simulation state
  frame: number;
  time: number;
}
```

**AI writes the game by configuring this state.** When done, dump it. That dump IS the game.

## Golden Rule: No Shortcuts

**The development AI must never take shortcuts.** Every capability must go through the tool interface.

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

User: "Add a double-jump ability"
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  1. AI connects to running game engine                       │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  2. AI tries to implement via tools                          │
│     Can I do this with existing tools?                       │
└─────────────────────────────────────────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
       YES              NO
        │               │
        ▼               ▼
┌───────────────┐ ┌─────────────────────────────────────────────┐
│ 3a. Implement │ │ 3b. EXTEND THE ENGINE FIRST                 │
│ via tools     │ │     - Add new tool/capability to engine     │
│               │ │     - Hot reload engine                     │
│               │ │     - Reconnect to engine                   │
│               │ │     - NOW implement via the new tools       │
└───────────────┘ └─────────────────────────────────────────────┘
        │               │
        └───────┬───────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  4. dump_state() → save game definition                      │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Ship: Engine + State = Game                              │
│     Deployed AI has SAME capabilities as dev AI              │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- No "magic" dev-only features
- Deployed AI can do everything dev AI can do
- Engine grows organically based on real needs
- Every capability is documented as a tool

## AI Connection Protocol

```typescript
// AI connects via WebSocket or stdio
interface AIConnection {
  // Engine → AI
  onStateUpdate(state: EngineState): void;
  onToolResult(id: string, result: ToolResult): void;

  // AI → Engine
  callTool(name: string, args: unknown): Promise<ToolResult>;
}

// Hot-swap example:
engine.disconnectAI();           // Current AI disconnected
engine.connectAI(newAISocket);   // New AI connected
// New AI receives current state, continues from there
```

**Any AI that speaks the tool protocol can control the engine.** The engine doesn't care if it's Claude, GPT-4, Llama, or a human typing JSON.

## Example: AI Development Session

```
1. AI connects to engine (fresh state)
2. AI calls set_screen("title", { text: "Super Mo", prompt: "Press Enter" })
3. AI calls define_mode_transition("title", "onInput", "playing")
4. AI calls spawn_entity("player", { x: 100, y: 200 })
5. AI calls define_behavior("player", "<movement script>")
6. AI calls set_rule("physics.gravity", 980)
7. AI calls step_simulation(100) → observes player falling
8. AI iterates: adjusts gravity, tweaks jump, adds enemies
9. AI calls dump_state() → saves complete game definition
10. Ship: Engine + dumped state = playable game
```

## Example: Extending the Engine

```
User: "Add particle effects when player jumps"

AI: Let me check if I can do this with existing tools...
AI: [calls get_tools()] → No particle system tool exists

AI: I need to extend the engine first.
AI: [writes src/engine/particles.ts]
AI: [adds spawn_particles tool to tools.ts]
AI: [hot reloads engine]
AI: [reconnects to engine]

AI: Now I can implement the feature:
AI: [calls define_behavior("player", "if (justJumped) spawn_particles(...)")]
AI: [calls step_simulation(60)] → sees particles
AI: [calls dump_state()]

Result: Engine now has particle system, deployed AI can use it too
```

## Implementation Phases

### Phase 1: Define Engine State Schema
- Design complete EngineState type (entities, rules, scripts, screens, modes)
- Make everything JSON-serializable
- No functions in state - behaviors are script strings

### Phase 2: Build Pure Engine
- Engine executes state (interprets scripts, applies rules)
- `step(dt)` advances simulation deterministically
- All operations exposed as methods: spawn, remove, setRule, defineScript, etc.

### Phase 3: Create Tool Interface
- Every engine operation becomes a tool
- Query tools: get_state, get_entities, get_rules
- Mutation tools: spawn_entity, set_rule, define_behavior, set_screen
- Simulation tools: step, dump_state, load_state

### Phase 4: Build Representation Engine
- Takes EngineState, renders it
- Reads screens/modes to show correct UI
- Completely stateless - just draws what state says

### Phase 5: AI Connection
- WebSocket/stdio interface for AI to connect
- AI receives state updates after each step
- AI sends tool calls, receives results
- Test: Development AI connects and builds the game live

## Files to Create

| File | Purpose |
|------|---------|
| `src/engine/engine.ts` | Pure game simulation |
| `src/engine/state.ts` | State types (EngineState), serialization |
| `src/engine/tools.ts` | Tool definitions for AI |
| `src/engine/connection.ts` | WebSocket/stdio AI connection |
| `src/representation/renderer.ts` | Representation interface |
| `src/representation/canvas2d.ts` | 2D Canvas implementation |
| `src/representation/webgl.ts` | WebGL implementation |

## Key Insight

The "code" for this game is not TypeScript files - it's the **state dump**.

When we ship:
1. The engine (fixed TypeScript)
2. The representation engine (fixed TypeScript)
3. The initial state JSON (AI-generated)

The deployed AI can modify the game at runtime. Swap AIs anytime. The new AI sees the same state, has the same tools, picks up where the last one left off.
