export type FlitEnemy = {
  kind: "flit";
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  minY: number;
  maxY: number;
  alive: boolean;
  stompable: boolean;
};

export function createFlit(x: number, y: number, range: number): FlitEnemy {
  return {
    kind: "flit",
    x,
    y,
    width: 16,
    height: 16,
    vy: -20,
    minY: y - range,
    maxY: y + range,
    alive: true,
    stompable: true,
  };
}

export function updateFlit(enemy: FlitEnemy, dt: number): void {
  if (!enemy.alive) {
    return;
  }

  enemy.y += enemy.vy * dt;

  if (enemy.y <= enemy.minY) {
    enemy.y = enemy.minY;
    enemy.vy = Math.abs(enemy.vy);
  }

  if (enemy.y >= enemy.maxY) {
    enemy.y = enemy.maxY;
    enemy.vy = -Math.abs(enemy.vy);
  }
}
