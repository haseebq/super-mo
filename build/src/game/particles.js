export function createParticles() {
    const particles = [];
    let seed = 123456789;
    function random() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
    }
    function spawn(x, y, count, color) {
        for (let i = 0; i < count; i += 1) {
            particles.push({
                x,
                y,
                vx: (random() - 0.5) * 40,
                vy: -20 - random() * 30,
                life: 0.5,
                color,
            });
        }
    }
    function update(dt) {
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
    function draw(renderer) {
        for (const p of particles) {
            renderer.rect(p.x, p.y, 2, 2, p.color);
        }
    }
    return {
        spawn,
        update,
        draw,
    };
}
