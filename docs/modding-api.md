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

## Safety Model

The game runtime maintains a `ModdingSafety` layer that validates every patch before application.

### Validation Rules

1.  **Schema Validation**: The standard `zod` or similar library validation ensures the JSON structure matches the Typescript types.
2.  **Bounds Checking**:
    - `physics.gravity`: [0, 5000] (Prevent physics explosions)
    - `scoring.coinValue`: [0, 1000] (Prevent score overflow)
3.  **Rate Limiting**: The agent can only apply patches at a specific rate (e.g., once per second) to prevent flooding.
4.  **Transactionality**: A patch is applied atomically. If any operation fails validation, the entire patch is rejected, and the state remains unchanged.

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

1.  **Define Types**: Create `src/game/modding/types.ts`.
2.  **Create Registry**: Create `src/game/modding/rules.ts` to define the "tunables" and their bounds.
3.  **Implement Validator**: Implement the `applyPatch` function with validation logic.
