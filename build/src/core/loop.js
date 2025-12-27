export function createLoop({ update, render }) {
    const step = 1 / 60;
    let last = performance.now();
    let accumulator = 0;
    let running = false;
    function frame(now) {
        if (!running) {
            return;
        }
        const delta = Math.min((now - last) / 1000, 0.25);
        last = now;
        accumulator += delta;
        while (accumulator >= step) {
            update(step);
            accumulator -= step;
        }
        render();
        requestAnimationFrame(frame);
    }
    return {
        start() {
            if (running) {
                return;
            }
            running = true;
            last = performance.now();
            requestAnimationFrame(frame);
        },
        stop() {
            running = false;
        },
    };
}
