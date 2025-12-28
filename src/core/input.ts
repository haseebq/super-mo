export type InputState = {
  isDown: (code: string) => boolean;
  consumePress: (code: string) => boolean;
  press: (code: string) => void;
  reset: () => void;
};

function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

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
    "ShiftLeft",
    "ShiftRight",
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

  // Touch controls support
  if (isTouchDevice()) {
    const touchControls = document.getElementById("touch-controls");
    if (touchControls) {
      touchControls.classList.add("is-visible");

      const buttons = touchControls.querySelectorAll<HTMLButtonElement>("[data-key]");
      buttons.forEach((btn) => {
        const key = btn.dataset.key;
        if (!key) return;

        const handleStart = (e: Event) => {
          e.preventDefault();
          if (!down.has(key)) {
            pressed.add(key);
          }
          down.add(key);
          btn.classList.add("is-pressed");
        };

        const handleEnd = (e: Event) => {
          e.preventDefault();
          down.delete(key);
          btn.classList.remove("is-pressed");
        };

        btn.addEventListener("touchstart", handleStart, { passive: false });
        btn.addEventListener("touchend", handleEnd, { passive: false });
        btn.addEventListener("touchcancel", handleEnd, { passive: false });

        // Also support mouse for testing on desktop
        btn.addEventListener("mousedown", handleStart);
        btn.addEventListener("mouseup", handleEnd);
        btn.addEventListener("mouseleave", handleEnd);
      });
    }
  }

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
    press(code: string) {
      pressed.add(code);
    },
    reset() {
      down.clear();
      pressed.clear();
    },
  };
}
