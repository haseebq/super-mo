import type { RenderFilterSpec } from "../../core/renderer.js";

export type GameStateSnapshot = {
  version: number;
  frame: number;
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
  entities: {
    coins: number;
    enemies: number;
  };
  audio: {
    muted: boolean;
  };
  rendering: {
    backgroundOverride: BackgroundThemePatch | null;
    filters: RenderFilterSpec[] | null;
  };
  assets: {
    ready: boolean;
  };
};

export type BackgroundThemePatch = {
  clear?: string;
  showStars?: boolean;
  stars?: string;
  cloudPrimary?: string;
  cloudSecondary?: string;
  hillFarA?: string;
  hillFarB?: string;
  hillNearA?: string;
  hillNearB?: string;
  waterfallTop?: string;
  waterfallMid?: string;
  waterfallBottom?: string;
  waterfallHighlight?: string;
};

export type OpSetRule = {
  op: "setRule";
  path: string;
  value: number;
};

export type OpSetAbility = {
  op: "setAbility";
  ability: "fly" | "noclip" | "invincible";
  active: boolean;
};

export type OpRemoveEntities = {
  op: "removeEntities";
  filter: {
    kind: "coin" | "enemy" | "projectile";
    area?: { x: number; y: number; w: number; h: number };
  };
};

export type OpSetAudio = {
  op: "setAudio";
  muted?: boolean;
};

export type OpSetBackgroundTheme = {
  op: "setBackgroundTheme";
  theme: BackgroundThemePatch | null;
};

export type OpSetRenderFilters = {
  op: "setRenderFilters";
  filters: RenderFilterSpec[] | null;
};

export type OpReloadAssets = {
  op: "reloadAssets";
};

export type OpSetEntityScript = {
  op: "setEntityScript";
  target: "enemy" | "coin" | "player";
  script: string;
};

export type SandboxModulePatch = {
  entry: string;
  modules: Record<string, string>;
};

export type OpRunScript = {
  op: "runScript";
  code?: string;
  module?: SandboxModulePatch;
};

export type ModOperation =
  | OpSetRule
  | OpSetAbility
  | OpRemoveEntities
  | OpSetAudio
  | OpSetBackgroundTheme
  | OpSetRenderFilters
  | OpReloadAssets
  | OpSetEntityScript
  | OpRunScript;

export type GamePatch = {
  ops: ModOperation[];
};

export type ModdingResult = {
  success: boolean;
  appliedOps: number;
  errors?: string[];
};
