/**
 * AI Discovery Tools - allows AI to learn about available operations on-demand.
 * Instead of a bloated system prompt, AI can query for what it needs.
 */

export type OperationDoc = {
  op: string;
  brief: string;
  description: string;
  schema: Record<string, string>;
  examples: Array<{ prompt: string; op: Record<string, unknown> }>;
};

export type EntitySchema = {
  type: string;
  properties: Record<string, string>;
};

export type ScriptContext = {
  variables: Record<string, string>;
  blocked: string[];
  notes: string;
};

export type DiscoveryTools = {
  listOperations: () => Array<{ op: string; brief: string }>;
  getOperationDocs: (op: string) => OperationDoc | null;
  getEntitySchema: (type: "enemy" | "coin" | "player") => EntitySchema;
  getScriptContext: () => ScriptContext;
};

// Operation documentation registry - generated from types
const operationDocs: Record<string, OperationDoc> = {
  setRule: {
    op: "setRule",
    brief: "Change game rules (physics, scoring)",
    description: "Modify numeric game rules like gravity, speed, or scoring values.",
    schema: {
      path: "string - dot notation path (e.g., 'physics.gravity', 'scoring.coinValue')",
      value: "number - the new value",
    },
    examples: [
      { prompt: "disable gravity", op: { op: "setRule", path: "physics.gravity", value: 0 } },
      { prompt: "make coins worth 1000", op: { op: "setRule", path: "scoring.coinValue", value: 1000 } },
      { prompt: "run faster", op: { op: "setRule", path: "physics.moveSpeed", value: 200 } },
    ],
  },

  setAbility: {
    op: "setAbility",
    brief: "Toggle player abilities (fly, invincible)",
    description: "Enable or disable special player abilities.",
    schema: {
      ability: "'fly' | 'noclip' | 'invincible'",
      active: "boolean",
    },
    examples: [
      { prompt: "make me invincible", op: { op: "setAbility", ability: "invincible", active: true } },
      { prompt: "let me fly", op: { op: "setAbility", ability: "fly", active: true } },
    ],
  },

  removeEntities: {
    op: "removeEntities",
    brief: "Remove coins, enemies, or projectiles",
    description: "Remove entities from the game world, optionally within a specific area.",
    schema: {
      filter: "{ kind: 'coin' | 'enemy' | 'projectile', area?: { x, y, w, h } }",
    },
    examples: [
      { prompt: "remove all coins", op: { op: "removeEntities", filter: { kind: "coin" } } },
      { prompt: "kill all enemies", op: { op: "removeEntities", filter: { kind: "enemy" } } },
    ],
  },

  setAudio: {
    op: "setAudio",
    brief: "Mute or unmute game audio",
    description: "Control the game's audio state.",
    schema: {
      muted: "boolean - true to mute, false to unmute",
    },
    examples: [
      { prompt: "mute the game", op: { op: "setAudio", muted: true } },
      { prompt: "turn sound on", op: { op: "setAudio", muted: false } },
    ],
  },

  setMusic: {
    op: "setMusic",
    brief: "Control music playback",
    description: "Play, stop, or change music tracks.",
    schema: {
      track: "number (optional) - track index (0-5)",
      volume: "number (optional) - volume level",
      action: "'play' | 'stop' (optional)",
    },
    examples: [
      { prompt: "stop the music", op: { op: "setMusic", action: "stop" } },
      { prompt: "play track 3", op: { op: "setMusic", track: 2, action: "play" } },
    ],
  },

  setEntityScript: {
    op: "setEntityScript",
    brief: "Attach per-frame script to entities",
    description:
      "Attach a JavaScript script that runs every frame for each entity of the target type. " +
      "Use this for movement patterns, behaviors, or visual effects. " +
      "The script has access to: entity (current entity), time (game time in seconds), dt (delta time).",
    schema: {
      target: "'enemy' | 'coin' | 'player'",
      script: "string - JavaScript code to run per entity per frame",
    },
    examples: [
      {
        prompt: "make enemies move in sine wave",
        op: {
          op: "setEntityScript",
          target: "enemy",
          script:
            "if (!entity.baseX) entity.baseX = entity.x; entity.x = entity.baseX + 30 * Math.sin(time * 2);",
        },
      },
      {
        prompt: "make coins bob up and down",
        op: {
          op: "setEntityScript",
          target: "coin",
          script:
            "if (!entity.baseY) entity.baseY = entity.y; entity.y = entity.baseY + 5 * Math.sin(time * 3);",
        },
      },
      {
        prompt: "make enemies chase the player",
        op: {
          op: "setEntityScript",
          target: "enemy",
          script: "entity.vx = entity.x < player.x ? 50 : -50;",
        },
      },
    ],
  },

  setBackgroundTheme: {
    op: "setBackgroundTheme",
    brief: "Change background colors/theme",
    description: "Override background colors for sky, hills, clouds, etc.",
    schema: {
      theme:
        "{ clear?: color, showStars?: boolean, stars?: color, cloudPrimary?: color, hillFarA?: color, ... } | null",
    },
    examples: [
      {
        prompt: "make it night time",
        op: { op: "setBackgroundTheme", theme: { clear: "#0a0a20", showStars: true, stars: "#ffffff" } },
      },
      { prompt: "reset background", op: { op: "setBackgroundTheme", theme: null } },
    ],
  },

  setRenderFilters: {
    op: "setRenderFilters",
    brief: "Apply visual filters (grayscale, blur, etc)",
    description: "Apply post-processing visual filters to the game.",
    schema: {
      filters: "Array<{ type: 'grayscale' | 'blur' | 'sepia' | 'invert', amount?: number }> | null",
    },
    examples: [
      { prompt: "make it grayscale", op: { op: "setRenderFilters", filters: [{ type: "grayscale" }] } },
      { prompt: "blur the screen", op: { op: "setRenderFilters", filters: [{ type: "blur", amount: 5 }] } },
      { prompt: "remove filters", op: { op: "setRenderFilters", filters: null } },
    ],
  },

  reloadAssets: {
    op: "reloadAssets",
    brief: "Reload game assets",
    description: "Force reload of game assets (sprites, sounds).",
    schema: {},
    examples: [{ prompt: "reload assets", op: { op: "reloadAssets" } }],
  },

  runScript: {
    op: "runScript",
    brief: "Run one-shot sandbox script",
    description:
      "Run a JavaScript script once in the sandbox. Use for complex one-time setup. " +
      "For continuous per-entity behavior, use setEntityScript instead.",
    schema: {
      code: "string - JavaScript code to execute once",
    },
    examples: [
      {
        prompt: "complex multi-step change",
        op: { op: "runScript", code: "capabilities.setRule('physics.gravity', 0);" },
      },
    ],
  },
};

// Entity schemas
const entitySchemas: Record<string, EntitySchema> = {
  enemy: {
    type: "enemy",
    properties: {
      x: "number - horizontal position",
      y: "number - vertical position",
      vx: "number - horizontal velocity",
      vy: "number - vertical velocity",
      width: "number - hitbox width",
      height: "number - hitbox height",
      baseX: "number (optional) - original x, set by your script for relative movement",
      baseY: "number (optional) - original y, set by your script for relative movement",
      index: "number - enemy index in array (useful for phase offsets)",
    },
  },
  coin: {
    type: "coin",
    properties: {
      x: "number - horizontal position",
      y: "number - vertical position",
      baseX: "number (optional) - original x",
      baseY: "number (optional) - original y",
    },
  },
  player: {
    type: "player",
    properties: {
      x: "number - horizontal position",
      y: "number - vertical position",
      vx: "number - horizontal velocity",
      vy: "number - vertical velocity",
      coins: "number - collected coins",
      lives: "number - remaining lives",
    },
  },
};

// Script context - what's blocked (everything else is allowed)
const scriptContext: ScriptContext = {
  variables: {
    entity: "The current entity being processed (enemy/coin/player)",
    time: "Game time in seconds (float, increases each frame)",
    dt: "Delta time - seconds since last frame (~0.016 at 60fps)",
    player: "Reference to player object (for enemy scripts)",
  },
  blocked: [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "eval",
    "Function",
    "document",
    "window",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "importScripts",
    "Worker",
    "SharedWorker",
    "navigator",
    "location",
  ],
  notes:
    "Standard JS is available (Math, JSON, Array, Object, String, Number, etc). " +
    "Scripts run per-entity per-frame - keep them fast! " +
    "Store persistent data on the entity object (e.g., entity.baseX = entity.x).",
};

/**
 * Create discovery tools for AI to query capabilities.
 */
export function createDiscoveryTools(): DiscoveryTools {
  return {
    listOperations() {
      return Object.values(operationDocs).map((doc) => ({
        op: doc.op,
        brief: doc.brief,
      }));
    },

    getOperationDocs(op: string) {
      return operationDocs[op] ?? null;
    },

    getEntitySchema(type: "enemy" | "coin" | "player") {
      return entitySchemas[type] ?? entitySchemas.enemy;
    },

    getScriptContext() {
      return scriptContext;
    },
  };
}

/**
 * Generate a minimal system prompt that teaches the AI how to discover capabilities.
 */
export function getDiscoverySystemPrompt(): string {
  return `You are a game modding assistant. You can modify a 2D platformer game.

IMPORTANT: Use discovery tools to learn what you can do:
- list_operations: See all available mod operations
- get_operation_docs(op): Get schema and examples for an operation
- get_entity_schema(type): See entity properties (enemy/coin/player)
- get_script_context: See what JS is available in scripts

Workflow:
1. Call list_operations to see what's possible
2. Call get_operation_docs for the relevant operation
3. Generate the correct operation based on schema and examples

For entity movement/behavior, use setEntityScript (not runScript).
Always check examples before generating operations.`;
}
