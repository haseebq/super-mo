import { isSolid } from "../level.js";
import type { Level } from "../level.js";

export type SpikeletEnemy = {
  kind: "spikelet";
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  alive: boolean;
  stompable: boolean;
};

export function createSpikelet(x: number, y: number): SpikeletEnemy {
  return {
    kind: "spikelet",
    x,
    y,
    width: 16,
    height: 16,
    vx: -16,
    alive: true,
    stompable: false,
  };
}

export function updateSpikelet(enemy: SpikeletEnemy, level: Level, dt: number) {
  if (!enemy.alive) {
    return;
  }

  const tileSize = level.tileSize;
  enemy.x += enemy.vx * dt;

  const direction = enemy.vx >= 0 ? 1 : -1;
  const frontX = direction > 0 ? enemy.x + enemy.width : enemy.x - 1;
  const tileX = Math.floor(frontX / tileSize);
  const topY = Math.floor(enemy.y / tileSize);
  const bottomY = Math.floor((enemy.y + enemy.height - 1) / tileSize);

  for (let y = topY; y <= bottomY; y += 1) {
    const id = level.tiles[y * level.width + tileX];
    if (isSolid(id)) {
      if (direction > 0) {
        enemy.x = tileX * tileSize - enemy.width;
      } else {
        enemy.x = (tileX + 1) * tileSize;
      }
      enemy.vx *= -1;
      return;
    }
  }

  const footY = Math.floor((enemy.y + enemy.height) / tileSize);
  const supportId = level.tiles[footY * level.width + tileX];
  if (!isSolid(supportId)) {
    enemy.vx *= -1;
  }
}
