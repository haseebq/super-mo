# Modding API Design

This document defines the schema and safety model for the Runtime Modding API.
The API allows an AI agent (or other inputs) to modify the game state and rules safely at runtime without executing arbitrary code.

## Core Concepts

1.  **Game State Snapshot**: A readonly, versioned view of the current game state provided to the agent.
2.  **Game Patch**: A JSON-serializable list of operations to apply to the game state.
3.  **Safety Layer**: A validation step that ensures patches are well-formed, within bounds, and do not violate game invariants.

## Data Schema

### 1. Game State Snapshot

The state exposed to the agent.

```typescript
type GameStateSnapshot = {
  version: number; // Incrementing counter
  frame: number; // Current game frame

  // Tunable Rules (Physics, Scoring, etc.)
  rules: {
    physics: {
      gravity: number;
      jumpImpulse: number;
      moveSpeed: number;
    };
    scoring: {
      coinValue: number;
      enemyValue: number;
    };
  };

  // Player State
  player: {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    stats: {
      coins: number;
      lives: number;
    };
    abilities: {
      canFly: boolean;
      invincible: boolean;
    };
  };

  // Level Analysis (Simplified view)
  entities: {
    coins: number; // Count of active coins
    enemies: number;
  };
};
```

### 2. Game Patch

A patch is a collection of operations.

```typescript
type GamePatch = {
  ops: ModOperation[];
};

type ModOperation = OpSetRule | OpSetAbility | OpRemoveEntities | OpSpawnEntity; // Future extension
```

### 3. Operations

#### `setRule`

Modifies a global game rule (physics, scoring).

```typescript
type OpSetRule = {
  op: "setRule";
  path: string; // e.g., "physics.gravity", "scoring.coinValue"
  value: number;
};
```

**Validation:**

- `path` must be a valid path in the allowed rules registry.
- `value` must be within defined min/max bounds (e.g., gravity cannot be negative if not allowed).
- Types must match.

#### `setAbility`

Grants or revokes player abilities.

```typescript
type OpSetAbility = {
  op: "setAbility";
  ability: "fly" | "noclip" | "invincible";
  active: boolean;
};
```

**Validation:**

- `ability` must be a known ability key.

#### `removeEntities`

Removes entities matching a filter.

```typescript
type OpRemoveEntities = {
  op: "removeEntities";
  filter: {
    kind: "coin" | "enemy" | "projectile";
    area?: { x: number; y: number; w: number; h: number }; // Optional: remove only in area
  };
};
```

**Validation:**

- `kind` must be valid.

## Prompting Layer

The runtime ships with a keyword-based provider for local development:

- `src/game/modding/provider.ts` implements `KeywordModdingProvider`.
- It maps phrases like "gravity off" or "remove all coins" into patch operations.
- Providers implement `ModdingProvider` and can be swapped without changing the patch schema.

## Safety Model

The runtime validates patches through a small, explicit set of allowed operations and rule-path checks.

### Validation Rules

1.  **Schema Validation**: Patch structure is validated by TypeScript types and the `ModdingAPI` operation handlers.
2.  **Path Validation**: `setRule` checks against known rules via `updateRule`.
3.  **Operation Whitelist**: Only explicit operations (`setRule`, `setAbility`, `removeEntities`) are allowed.

**Why no arbitrary code execution?** Allowing code execution would expose the runtime to security and stability risks. The patch model keeps changes scoped, auditable, and safe to reject.

### Current Gaps

- No numeric bounds checking yet (ex: gravity min/max).
- No rate limiting or transactional rollback.
- Validation failures currently return errors but do not block the entire patch.

## Examples (User Stories)

### 1. "Each coin gives me 10x points"

**User Request:** "Make coins worth 1000 points"
**Patch:**

```json
{
  "ops": [
    {
      "op": "setRule",
      "path": "scoring.coinValue",
      "value": 1000
    }
  ]
}
```

### 2. "Remove all coins"

**User Request:** "I hate money, delete it."
**Patch:**

```json
{
  "ops": [
    {
      "op": "removeEntities",
      "filter": {
        "kind": "coin"
      }
    }
  ]
}
```

### 3. "I want to fly"

**User Request:** "Let me fly!"
**Patch:**

```json
{
  "ops": [
    {
      "op": "setAbility",
      "ability": "fly",
      "active": true
    },
    {
      "op": "setRule",
      "path": "physics.gravity",
      "value": 0
    }
  ]
}
```

_(Agent might choose to disable gravity 0 to simulate flight if the game engine doesn't have a native fly mode, or toggle a `fly` ability if it exists.)_

## Implementation Plan (Next Steps)

1.  **Define Types**: Update `src/game/modding/types.ts` if new operations are needed.
2.  **Extend Rules**: Add tunables in `src/game/modding/rules.ts`.
3.  **Apply Operations**: Add handling in `src/game/modding/api.ts`.
4.  **Teach the Provider**: Update `src/game/modding/provider.ts` to map prompts to new ops.
