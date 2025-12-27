export function createInput() {
    const down = new Set();
    const pressed = new Set();
    const blocked = new Set([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        "KeyZ",
        "KeyX",
    ]);
    function handleKeyDown(event) {
        if (blocked.has(event.code)) {
            event.preventDefault();
        }
        if (!down.has(event.code)) {
            pressed.add(event.code);
        }
        down.add(event.code);
    }
    function handleKeyUp(event) {
        if (blocked.has(event.code)) {
            event.preventDefault();
        }
        down.delete(event.code);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return {
        isDown(code) {
            return down.has(code);
        },
        consumePress(code) {
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
