export function createAudio() {
    let ctx = null;
    let master = null;
    let music = null;
    function ensureContext() {
        if (!ctx) {
            ctx = new AudioContext();
            master = ctx.createGain();
            master.gain.value = 0.2;
            master.connect(ctx.destination);
        }
    }
    function unlock() {
        ensureContext();
        if (ctx.state === "suspended") {
            ctx.resume();
        }
    }
    function playTone(freq, duration, type) {
        if (!ctx) {
            return;
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = 0.2;
        osc.connect(gain).connect(master);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.stop(ctx.currentTime + duration);
    }
    function playJump() {
        playTone(660, 0.12, "square");
    }
    function playStomp() {
        playTone(220, 0.08, "triangle");
    }
    function startMusic() {
        if (!ctx || music) {
            return;
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 110;
        gain.gain.value = 0.03;
        osc.connect(gain).connect(master);
        osc.start();
        music = { osc, gain };
    }
    function stopMusic() {
        if (!music) {
            return;
        }
        music.osc.stop();
        music = null;
    }
    return {
        unlock,
        playJump,
        playStomp,
        startMusic,
        stopMusic,
    };
}
