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
                           │ Tool calls
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   GAME ENGINE (Pure Data)                    │
├─────────────────────────────────────────────────────────────┤
│  Components: Position, Velocity, Health, Collider, ...     │
│  Systems: gravity, movement, player-input (all as data)    │
│  Events: player-hit, collect-coin, game-over (handlers)    │
│  Rules: physics, scoring, controls                          │
│                                                              │
│  Deterministic: Same inputs → Same outputs                  │
│  No rendering, no I/O, no side effects                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ State (read-only)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              REPRESENTATION ENGINE (Swappable)               │
├─────────────────────────────────────────────────────────────┤
│  Implementations:                                            │
│    - Canvas2DRenderer    - WebGLRenderer                    │
│    - ThreeJSRenderer     - ASCIIRenderer                    │
│    - HeadlessRenderer (for testing)                         │
└─────────────────────────────────────────────────────────────┘
```

## Core Principles

1. **Engine is pure data**: All state is JSON-serializable. No functions, no closures.
2. **Structured actions, not code**: Systems and events use typed actions, not code strings.
3. **Expressions, not code**: Values use a safe expression language (math + references).
4. **Collisions emit events**: Collision detection and handling are separated.
5. **Tools are the only API**: All interaction via tool calls. No backdoors.
6. **Tests use tools too**: Test suite connects and uses the same tool interface as AI.

---

## Component-System-Event Model

### 1. Entities & Components (Pure Data)

Entities are IDs with attached component data. Components have no behavior.

```typescript
interface Entity {
  id: EntityId;
  tags: string[];                    // "player", "enemy", "coin"
  components: {
    [type: string]: ComponentData;
  };
}

// Example entity
{
  id: "player-1",
  tags: ["player"],
  components: {
    Position: { x: 100, y: 200 },
    Velocity: { vx: 0, vy: 0 },
    Collider: { width: 16, height: 16, layer: "player" },
    Health: { lives: 3, invincibleUntil: 0 },
    Stats: { coins: 0, score: 0 },
    Sprite: { sheet: "player", animation: "idle" }
  }
}
```

### 2. Systems as Data

Systems are NOT code. They are data: a query + a list of actions.

```typescript
interface System {
  name: string;
  phase: "input" | "update" | "physics" | "collision";
  query: { has?: string[], not?: string[], tag?: string };
  actions: Action[];
}

// Example systems
systems: [
  {
    name: "gravity",
    phase: "physics",
    query: { has: ["Velocity"], not: ["Static"] },
    actions: [
      { type: "add", target: "Velocity.vy", value: "rules.physics.gravity * dt" }
    ]
  },
  {
    name: "movement",
    phase: "physics",
    query: { has: ["Position", "Velocity"] },
    actions: [
      { type: "add", target: "Position.x", value: "Velocity.vx * dt" },
      { type: "add", target: "Position.y", value: "Velocity.vy * dt" }
    ]
  },
  {
    name: "player-input",
    phase: "input",
    query: { tag: "player", has: ["Velocity"] },
    actions: [
      { type: "set", target: "Velocity.vx", value: "input.horizontal * rules.physics.moveSpeed" },
      { type: "when", condition: "input.jump && grounded",
        then: [{ type: "set", target: "Velocity.vy", value: "-rules.physics.jumpImpulse" }]
      }
    ]
  }
]
```

### 3. Collision Handlers → Emit Events

Collisions detect overlaps and emit events. They don't execute logic directly.

```typescript
interface CollisionHandler {
  between: [string, string];   // layer names
  condition?: string;          // optional expression
  emit: string;                // event name
  data?: object;               // data to pass
}

collisions: [
  {
    between: ["player", "enemy"],
    condition: "a.Velocity.vy > 0 && a.Position.y < b.Position.y",
    emit: "stomp-enemy",
    data: { player: "a", enemy: "b" }
  },
  {
    between: ["player", "enemy"],
    condition: "time > a.Health.invincibleUntil",
    emit: "player-hit",
    data: { player: "a", enemy: "b" }
  },
  {
    between: ["player", "coin"],
    emit: "collect-coin",
    data: { player: "a", coin: "b" }
  }
]
```

### 4. Event Handlers (Reactive Rules)

Events trigger action chains. This is where game logic lives.

```typescript
events: {
  "stomp-enemy": [
    { type: "remove", target: "data.enemy" },
    { type: "add", target: "data.player.Stats.score", value: 100 },
    { type: "set", target: "data.player.Velocity.vy", value: -200 },
    { type: "emit", event: "spawn-particles", data: { at: "data.enemy.Position" } }
  ],

  "player-hit": [
    { type: "add", target: "data.player.Health.lives", value: -1 },
    { type: "set", target: "data.player.Health.invincibleUntil", value: "time + 2" },
    { type: "when", condition: "data.player.Health.lives <= 0",
      then: [{ type: "emit", event: "game-over" }],
      else: [{ type: "emit", event: "respawn-player" }]
    }
  ],

  "collect-coin": [
    { type: "remove", target: "data.coin" },
    { type: "add", target: "data.player.Stats.coins", value: 1 },
    { type: "add", target: "data.player.Stats.score", value: "rules.scoring.coinValue" }
  ],

  "game-over": [
    { type: "setMode", mode: "gameover" }
  ]
}
```

### 5. Action Types (Built-in)

```typescript
type Action =
  // Data manipulation
  | { type: "set", target: string, value: Expression }
  | { type: "add", target: string, value: Expression }
  | { type: "remove", target: string }

  // Entity operations
  | { type: "spawn", template: string, at?: Expression }
  | { type: "destroy", target: string }

  // Events
  | { type: "emit", event: string, data?: object }

  // Control flow
  | { type: "when", condition: Expression, then: Action[], else?: Action[] }
  | { type: "forEach", query: Query, do: Action[] }

  // Game state
  | { type: "setMode", mode: string }

  // Escape hatch (validated, sandboxed)
  | { type: "script", code: string }
```

### 6. Expression Language (Safe Subset)

Expressions are evaluated, not executed. No arbitrary code.

```typescript
// Valid expressions:
"entity.Velocity.vy + rules.physics.gravity * dt"
"time > entity.Health.invincibleUntil"
"Math.sin(time * 2) * 30"
"input.horizontal * rules.physics.moveSpeed"
"data.player.Health.lives <= 0"

// Allowed:
// - Math operators: + - * / %
// - Comparisons: < > <= >= == !=
// - Logic: && || !
// - References: entity.X, rules.X, time, dt, input.X, data.X
// - Functions: Math.sin, Math.cos, Math.abs, Math.min, Math.max

// NOT allowed:
// - Function calls (except Math.*)
// - Assignment
// - fetch, eval, Function, etc.
```

---

## Complete Engine State

```typescript
interface EngineState {
  // Simulation
  frame: number;
  time: number;

  // Entities (ECS)
  entities: Entity[];
  templates: Record<string, EntityTemplate>;

  // Systems (data, not code)
  systems: System[];

  // Collisions & Events
  collisions: CollisionHandler[];
  events: Record<string, Action[]>;

  // Rules
  rules: {
    physics: { gravity: number, friction: number, moveSpeed: number, jumpImpulse: number };
    scoring: { coinValue: number, enemyKillBonus: number };
    controls: Record<string, string>;
  };

  // UI Flow
  screens: {
    title: { text: string, prompt: string };
    intro: { title: string, goal: string };
    complete: { message: string };
  };

  // Mode State Machine
  modes: {
    current: string;
    transitions: Record<string, Record<string, string>>;
  };

  // Level
  level: {
    tiles: number[][];
    width: number;
    height: number;
  };
}
```

---

## Tool Interface

All engine operations are exposed as tools. AI controls engine exclusively via tools.

### Query Tools
- `query_state` - Get full or filtered state
- `get_entity` - Get single entity by ID
- `get_entities` - Query entities by tag/components
- `get_tools` - List available tools

### Entity Tools
- `spawn_entity` - Create entity from template
- `remove_entity` - Delete entity
- `set_component` - Update component data

### System Tools
- `define_system` - Add/update a system
- `remove_system` - Delete a system

### Event Tools
- `define_collision` - Add collision handler
- `define_event` - Add event handler
- `trigger_event` - Manually fire event (for testing)

### Rule Tools
- `set_rule` - Update a rule value
- `get_rule` - Read a rule value

### Screen/Mode Tools
- `set_screen` - Configure a screen
- `set_mode` - Change current mode
- `define_transition` - Add mode transition

### Simulation Tools
- `step` - Advance N frames
- `dump_state` - Export full state as JSON
- `load_state` - Import state from JSON

### Debug Tools
- `get_events_log` - Events fired last step
- `get_collisions_log` - Collisions detected last step

---

## Golden Rule: No Shortcuts

**The development AI must never take shortcuts.** Every capability must go through the tool interface.

```
User: "Add a double-jump ability"
        │
        ▼
┌─────────────────────────────────────────┐
│  1. AI connects to running game engine  │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  2. AI tries to implement via tools     │
│     Can I do this with existing tools?  │
└─────────────────────────────────────────┘
        │
   ┌────┴────┐
   │         │
  YES        NO
   │         │
   ▼         ▼
┌───────┐ ┌────────────────────────────────┐
│ Do it │ │ EXTEND THE ENGINE FIRST        │
│ via   │ │   - Add new tool/capability    │
│ tools │ │   - Hot reload engine          │
│       │ │   - Reconnect                  │
│       │ │   - NOW implement via tools    │
└───────┘ └────────────────────────────────┘
   │         │
   └────┬────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  3. dump_state() → save game definition │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  4. Ship: Engine + State = Game         │
│     Deployed AI has SAME capabilities   │
└─────────────────────────────────────────┘
```

---

## Testing Strategy

**Tests use the tool interface.** No backdoor method calls. Tests connect to the engine the same way AI does.

### Tests Are Tool Call Sequences

```json
{
  "name": "gravity-affects-velocity",
  "steps": [
    {
      "tool": "spawn_entity",
      "args": { "template": "ball", "at": { "x": 100, "y": 0 } },
      "storeAs": "ballId"
    },
    {
      "tool": "set_rule",
      "args": { "path": "physics.gravity", "value": 100 }
    },
    {
      "tool": "step",
      "args": { "frames": 60 }
    },
    {
      "tool": "get_entity",
      "args": { "id": "$ballId" },
      "assert": {
        "result.components.Velocity.vy": { "greaterThan": 0 },
        "result.components.Position.y": { "greaterThan": 0 }
      }
    }
  ]
}
```

### Test Categories

1. **Expression Evaluator** - Math, comparisons, references
2. **Action Executor** - Each action type works correctly
3. **System Runner** - Queries match, actions execute
4. **Collision Detection** - Overlaps detected, events emitted
5. **Event Handlers** - Actions execute, events chain
6. **Tool Interface** - Each tool works via connection
7. **Scenario Tests** - Full game scenarios as tool sequences
8. **Determinism Tests** - Same input = same output
9. **Replay Tests** - Recorded sessions replay identically

### Test Runner Connects Like AI

```typescript
async function runTest(testFile: string) {
  const test = loadJSON(testFile);
  const conn = await connectToEngine();

  for (const step of test.steps) {
    const result = await conn.call(step.tool, step.args);

    if (step.assert) {
      for (const [path, expected] of Object.entries(step.assert)) {
        assertPath(result, path, expected);
      }
    }
  }

  await conn.disconnect();
}
```

---

## Implementation Phases

### Phase 0: Foundation
- Clean slate, keep CI/Cloudflare infra
- New project structure: `src/engine/`, `src/representation/`
- Basic test runner that connects via tools

### Phase 1: Engine Core
- EngineState type, empty initial state
- step() advances frame/time
- State serialization/deserialization
- **Tests:** step works, state round-trips

### Phase 2: Entity System
- Entity type, EntityId, components
- spawn_entity, remove_entity, get_entity tools
- **Tests:** CRUD operations via tools

### Phase 3: Expression Evaluator
- Parse and evaluate safe expressions
- Math, comparisons, references
- Security: reject dangerous code
- **Tests:** expression evaluation, rejection of bad input

### Phase 4: Action Executor
- Execute action types: set, add, remove, when, emit
- Context: entity, rules, time, dt
- **Tests:** each action type via tools

### Phase 5: Systems
- System definitions (query + actions)
- System runner processes matching entities
- Phase ordering (input, update, physics)
- **Tests:** systems run via define_system tool

### Phase 6: Collision System
- Collision detection between layers
- Emit events on collision
- Conditions on collisions
- **Tests:** collision → event via tools

### Phase 7: Event System
- Event handlers as action lists
- Event chaining (emit within handler)
- Branching (when/else)
- **Tests:** event chains via trigger_event tool

### Phase 8: Rules System
- Physics, scoring, controls as data
- set_rule, get_rule tools
- Systems/expressions can reference rules
- **Tests:** rule changes affect simulation

### Phase 9: Screens & Modes
- Screen configurations
- Mode state machine
- Transitions
- **Tests:** mode changes via tools

### Phase 10: AI Connection
- WebSocket/stdio interface
- Tool call protocol
- Hot-swap support
- **Tests:** external process connects, calls tools

### Phase 11: Headless Representation
- Renderer interface
- Headless renderer logs what would be drawn
- Useful for testing
- **Tests:** correct entities in render log

### Phase 12: Canvas2D Representation
- Actual visual rendering
- Draws entities, UI, screens
- **Tests:** Playwright visual verification

### Phase 13: Integration
- Full game loop
- Load initial state, run game
- AI can build complete game via tools
- **Tests:** full scenario tests, replay tests

---

## Files to Create

```
src/
  engine/
    state.ts           # EngineState type, serialization
    engine.ts          # GameEngine class
    entities.ts        # Entity, Component types
    systems.ts         # System runner
    expressions.ts     # Expression evaluator
    actions.ts         # Action executor
    collisions.ts      # Collision detection
    events.ts          # Event handler
    rules.ts           # Rules management
    modes.ts           # Mode state machine
    tools.ts           # Tool definitions + executor
    connection.ts      # WebSocket/stdio connection

  representation/
    renderer.ts        # Renderer interface
    headless.ts        # Headless (test) renderer
    canvas2d.ts        # Canvas 2D renderer

tests/
  scenarios/           # JSON test files (tool call sequences)
  runner.ts            # Test runner (connects via tools)
```

---

## Key Insight

The "code" for this game is the **state dump**.

When we ship:
1. The engine (fixed TypeScript)
2. The representation engine (fixed TypeScript)
3. The initial state JSON (AI-generated via tools)

The deployed AI can modify the game at runtime. Swap AIs anytime. Tests verify behavior by connecting and calling tools - same as AI.
