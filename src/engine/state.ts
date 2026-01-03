/**
 * Engine State
 *
 * Complete engine state is pure JSON-serializable data.
 * No functions, no closures, no class instances.
 */

export type EntityId = string;

export interface ComponentData {
  [key: string]: unknown;
}

export interface Entity {
  id: EntityId;
  tags: string[];
  components: Record<string, ComponentData>;
}

export interface EntityTemplate {
  tags: string[];
  components: Record<string, ComponentData>;
}

export interface Query {
  has?: string[];
  not?: string[];
  tag?: string;
}

export type Expression = string;

export type Action =
  | { type: "set"; target: string; value: Expression }
  | { type: "add"; target: string; value: Expression }
  | { type: "remove"; target: string }
  | { type: "spawn"; template: string; at?: Expression }
  | { type: "destroy"; target: string }
  | { type: "emit"; event: string; data?: Record<string, unknown> }
  | { type: "when"; condition: Expression; then: Action[]; else?: Action[] }
  | { type: "forEach"; query: Query; do: Action[] }
  | { type: "setMode"; mode: string };

export interface System {
  name: string;
  phase: "input" | "update" | "physics" | "collision";
  query: Query;
  actions: Action[];
}

export interface CollisionHandler {
  between: [string, string];
  condition?: Expression;
  emit: string;
  data?: Record<string, unknown>;
}

export interface EngineState {
  // Simulation timing
  frame: number;
  time: number;

  // Entities (ECS without the S being code)
  entities: Entity[];
  templates: Record<string, EntityTemplate>;

  // Systems (data, not code)
  systems: System[];

  // Collisions & Events
  collisions: CollisionHandler[];
  events: Record<string, Action[]>;

  // Rules (configurable values)
  rules: {
    physics: {
      gravity: number;
      friction: number;
      moveSpeed: number;
      jumpImpulse: number;
    };
    scoring: {
      coinValue: number;
      enemyKillBonus: number;
    };
    controls: Record<string, string>;
  };

  // UI Flow
  screens: {
    title: { text: string; prompt: string };
    intro: { title: string; goal: string };
    complete: { message: string };
  };

  // Mode State Machine
  modes: {
    current: string;
    transitions: Record<string, Record<string, string>>;
  };

  // Level data
  level: {
    tiles: number[][];
    width: number;
    height: number;
  };
}

export function createInitialState(): EngineState {
  return {
    frame: 0,
    time: 0,

    entities: [],
    templates: {},

    systems: [],

    collisions: [],
    events: {},

    rules: {
      physics: {
        gravity: 980,
        friction: 0.9,
        moveSpeed: 150,
        jumpImpulse: 300,
      },
      scoring: {
        coinValue: 100,
        enemyKillBonus: 200,
      },
      controls: {},
    },

    screens: {
      title: { text: "Super Mo", prompt: "Press Enter to Start" },
      intro: { title: "Level 1", goal: "Reach the goal" },
      complete: { message: "Level Complete!" },
    },

    modes: {
      current: "title",
      transitions: {
        title: { start: "intro" },
        intro: { start: "playing" },
        playing: { pause: "paused", complete: "complete", die: "gameover" },
        paused: { resume: "playing", quit: "title" },
        complete: { next: "intro", quit: "title" },
        gameover: { retry: "intro", quit: "title" },
      },
    },

    level: {
      tiles: [],
      width: 0,
      height: 0,
    },
  };
}

export function cloneState(state: EngineState): EngineState {
  return JSON.parse(JSON.stringify(state));
}
