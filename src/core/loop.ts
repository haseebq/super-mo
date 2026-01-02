type LoopHandlers = {
  update: (dt: number) => void;
  render: () => void;
};

export function createLoop({ update, render }: LoopHandlers) {
  const step = 1 / 60;
  let last = performance.now();
  let accumulator = 0;
  let running = false;
  const useInterval =
    typeof navigator !== "undefined" && Boolean(navigator.webdriver);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function frame(now: number) {
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
    if (!useInterval) {
      requestAnimationFrame(frame);
    }
  }

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      last = performance.now();
      if (useInterval) {
        intervalId = setInterval(() => frame(performance.now()), step * 1000);
      } else {
        requestAnimationFrame(frame);
      }
    },
    stop() {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
