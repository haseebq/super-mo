export type InputState = {
  isDown: (code: string) => boolean;
  consumePress: (code: string) => boolean;
  reset: () => void;
};

export function createInput(): InputState {
  const down = new Set<string>();
  const pressed = new Set<string>();
  const blocked = new Set<string>([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "KeyZ",
    "KeyX",
  ]);

  function handleKeyDown(event: KeyboardEvent) {
    if (blocked.has(event.code)) {
      event.preventDefault();
    }
    if (!down.has(event.code)) {
      pressed.add(event.code);
    }
    down.add(event.code);
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (blocked.has(event.code)) {
      event.preventDefault();
    }
    down.delete(event.code);
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return {
    isDown(code: string) {
      return down.has(code);
    },
    consumePress(code: string) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    reset() {
      down.clear();
      pressed.clear();
    },
  };
}
