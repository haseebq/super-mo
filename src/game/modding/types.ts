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

export type ModOperation = OpSetRule | OpSetAbility | OpRemoveEntities;

export type GamePatch = {
  ops: ModOperation[];
};

export type ModdingResult = {
  success: boolean;
  appliedOps: number;
  errors?: string[];
};
