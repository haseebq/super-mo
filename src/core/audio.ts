type MusicNodes = {
  intervalId: number;
};

export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: MusicNodes | null = null;

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
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function playTone(freq: number, duration: number, type: OscillatorType, volume = 0.2) {
    if (!ctx || !master) {
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
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

  function playCoin() {
    playTone(880, 0.06, "square");
  }

  function playShard() {
    playTone(540, 0.08, "triangle");
  }

  function playPowerup() {
    playTone(330, 0.12, "sawtooth");
  }

  function playHurt() {
    playTone(140, 0.14, "sine");
  }

  function playGoal() {
    playTone(740, 0.16, "triangle");
  }

  function startMusic() {
    if (!ctx || !master || music) {
      return;
    }
    const melody = [220, 262, 330, 392, 330, 262];
    let step = 0;
    playTone(melody[step], 0.2, "triangle", 0.06);
    step = (step + 1) % melody.length;
    const intervalId = window.setInterval(() => {
      if (!ctx) {
        return;
      }
      playTone(melody[step], 0.2, "triangle", 0.06);
      step = (step + 1) % melody.length;
    }, 260);
    music = { intervalId };
  }

  function stopMusic() {
    if (!music) {
      return;
    }
    window.clearInterval(music.intervalId);
    music = null;
  }

  return {
    unlock,
    playJump,
    playStomp,
    playCoin,
    playShard,
    playPowerup,
    playHurt,
    playGoal,
    startMusic,
    stopMusic,
  };
}
