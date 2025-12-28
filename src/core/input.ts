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
        const isDpadKey = key === "ArrowLeft" || key === "ArrowRight";

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

        if (!isDpadKey) {
          btn.addEventListener("touchstart", handleStart, { passive: false });
          btn.addEventListener("touchend", handleEnd, { passive: false });
          btn.addEventListener("touchcancel", handleEnd, { passive: false });
        }

        // Also support mouse for testing on desktop
        btn.addEventListener("mousedown", handleStart);
        btn.addEventListener("mouseup", handleEnd);
        btn.addEventListener("mouseleave", handleEnd);
      });

      const dpad = touchControls.querySelector<HTMLElement>(".touch-dpad");
      if (dpad) {
        const leftButton = dpad.querySelector<HTMLElement>(".touch-btn-left");
        const rightButton = dpad.querySelector<HTMLElement>(".touch-btn-right");
        let activeTouchId: number | null = null;
        let activeDirection: string | null = null;

        const applyDirection = (direction: string | null) => {
          if (activeDirection === direction) {
            return;
          }
          if (activeDirection) {
            down.delete(activeDirection);
          }
          activeDirection = direction;
          if (direction) {
            if (!down.has(direction)) {
              pressed.add(direction);
            }
            down.add(direction);
          }
          leftButton?.classList.toggle("is-pressed", direction === "ArrowLeft");
          rightButton?.classList.toggle("is-pressed", direction === "ArrowRight");
        };

        const updateDirectionFromX = (x: number) => {
          const rect = dpad.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const direction = x < center ? "ArrowLeft" : "ArrowRight";
          applyDirection(direction);
        };

        const handleTouchStart = (e: TouchEvent) => {
          if (activeTouchId !== null) {
            return;
          }
          const touch = e.changedTouches[0];
          if (!touch) return;
          activeTouchId = touch.identifier;
          updateDirectionFromX(touch.clientX);
          e.preventDefault();
        };

        const handleTouchMove = (e: TouchEvent) => {
          if (activeTouchId === null) {
            return;
          }
          for (const touch of Array.from(e.changedTouches)) {
            if (touch.identifier === activeTouchId) {
              updateDirectionFromX(touch.clientX);
              e.preventDefault();
              return;
            }
          }
        };

        const handleTouchEnd = (e: TouchEvent) => {
          if (activeTouchId === null) {
            return;
          }
          for (const touch of Array.from(e.changedTouches)) {
            if (touch.identifier === activeTouchId) {
              activeTouchId = null;
              applyDirection(null);
              e.preventDefault();
              return;
            }
          }
        };

        dpad.addEventListener("touchstart", handleTouchStart, { passive: false });
        dpad.addEventListener("touchmove", handleTouchMove, { passive: false });
        dpad.addEventListener("touchend", handleTouchEnd, { passive: false });
        dpad.addEventListener("touchcancel", handleTouchEnd, { passive: false });
      }
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
