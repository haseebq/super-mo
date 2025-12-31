import type { Rect } from "./level.js";

export type Rocket = Rect & {
  vx: number;
  vy: number;
  alive: boolean;
};

export function createRocket(x: number, y: number, vx: number, vy: number): Rocket {
  return {
    x,
    y,
    vx,
    vy,
    width: 4,
    height: 4,
    alive: true,
  };
}

export function updateRockets(rockets: Rocket[], dt: number) {
  for (const rocket of rockets) {
    if (!rocket.alive) continue;

    rocket.x += rocket.vx * dt;
    rocket.y += rocket.vy * dt;

    // Apply gravity
    rocket.vy += 200 * dt;

    // Remove if offscreen
    if (rocket.y > 200 || rocket.x < 0 || rocket.x > 640) {
      rocket.alive = false;
    }
  }
}

export function drawRocket(rocket: Rocket, renderer: any) {
  if (!rocket.alive) return;

  // Draw rocket as a circle
  renderer.circle(rocket.x + 2, rocket.y + 2, 2, "#ff6b35");
}
