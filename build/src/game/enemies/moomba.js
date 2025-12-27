import { isSolid } from "../level.js";
export function createMoomba(x, y) {
    return {
        kind: "moomba",
        x,
        y,
        width: 16,
        height: 16,
        vx: -20,
        alive: true,
        stompable: true,
    };
}
export function updateMoomba(enemy, level, dt) {
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
            }
            else {
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
