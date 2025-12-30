export type ModdingRules = {
  physics: {
    gravity: number;
    jumpImpulse: number;
    moveSpeed: number;
  };
  scoring: {
    coinValue: number;
    enemyValue: number;
    shardValue: number;
    powerupValue: number;
  };
};

export const DEFAULT_RULES: ModdingRules = {
  physics: {
    gravity: 9.5 * 16, // From player.ts (9.5 * TILE_SIZE)
    jumpImpulse: 8.4 * 16, // From player.ts
    moveSpeed: 1.6 * 16, // From player.ts (WALK_SPEED? or RUN_SPEED?)
    // player.ts has RUN_SPEED = 2.6 * 16.
    // Let's assume we want to tune RUN_SPEED as 'moveSpeed'.
  },
  scoring: {
    coinValue: 10,
    enemyValue: 100, // Assuming this value, will need to check enemy kill logic
    shardValue: 50,
    powerupValue: 25,
  },
};

// Mutable rules state
export const activeRules: ModdingRules = JSON.parse(
  JSON.stringify(DEFAULT_RULES)
);

export function resetRules() {
  Object.assign(activeRules, JSON.parse(JSON.stringify(DEFAULT_RULES)));
}

export function updateRule(path: string, value: number) {
  const parts = path.split(".");
  let current: any = activeRules;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
    if (!current) return false; // Invalid path
  }
  const field = parts[parts.length - 1];
  if (typeof current[field] === "number") {
    current[field] = value;
    return true;
  }
  return false;
}
