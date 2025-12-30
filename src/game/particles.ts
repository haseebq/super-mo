import type { Renderer } from "../core/renderer.js";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

export function createParticles() {
  const particles: Particle[] = [];
  let seed = 123456789;

  function random(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  }

  function spawn(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x,
        y,
        vx: (random() - 0.5) * 40,
        vy: -20 - random() * 30,
        life: 0.5,
        color,
        size: 2,
      });
    }
  }

  function update(dt: number) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.vy += 120 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function draw(renderer: Renderer) {
    for (const p of particles) {
      renderer.circle(p.x, p.y, p.size, p.color);
    }
  }

  return {
    spawn,
    update,
    draw,
  };
}
