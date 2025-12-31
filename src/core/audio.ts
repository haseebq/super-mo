type MusicNodes = {
  intervalId: number;
};

export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: MusicNodes | null = null;
  let muted = false;

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.2;
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
    // Victory fanfare
    const fanfare = [523, 659, 784, 1047]; // C E G C (high)
    fanfare.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, "square", 0.08), i * 120);
    });
  }

  function playTriumph() {
    // Short triumphant arpeggio for special pickups
    const notes = [659, 784, 988, 1318];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.14, "triangle", 0.1), i * 90);
    });
  }

  function playDash() {
    // Whoosh sound for dash
    playTone(440, 0.1, "square", 0.15);
    setTimeout(() => playTone(550, 0.08, "square", 0.12), 30);
  }

  function playCheckpoint() {
    // Two-note checkpoint sound
    playTone(392, 0.1, "square", 0.1);
    setTimeout(() => playTone(523, 0.1, "square", 0.1), 100);
  }

  function playWallSlide() {
    // Continuous sliding sound
    playTone(262, 0.15, "sine", 0.08);
  }

  function playLanding() {
    // Heavy landing impact
    playTone(180, 0.06, "triangle", 0.15);
  }

  function playDamage() {
    // Buzz/hit sound
    playTone(100, 0.1, "square", 0.12);
    setTimeout(() => playTone(150, 0.08, "square", 0.1), 40);
  }

  function startMusic() {
    if (!ctx || !master || music) {
      return;
    }
    // Chiptune-style melody (C major pentatonic, upbeat platformer feel)
    const melody = [
      523, 587, 659, 784, 659, 587, 523, 0,    // C5 D5 E5 G5 E5 D5 C5 rest
      659, 784, 880, 784, 659, 587, 523, 392,  // E5 G5 A5 G5 E5 D5 C5 G4
      523, 659, 784, 880, 784, 659, 523, 0,    // C5 E5 G5 A5 G5 E5 C5 rest
      880, 784, 659, 523, 587, 659, 523, 392,  // A5 G5 E5 C5 D5 E5 C5 G4
    ];
    const bass = [
      131, 0, 165, 0, 196, 0, 165, 0,  // C3 E3 G3 E3
      131, 0, 165, 0, 196, 0, 220, 0,  // C3 E3 G3 A3
      175, 0, 220, 0, 262, 0, 220, 0,  // F3 A3 C4 A3
      196, 0, 247, 0, 294, 0, 247, 0,  // G3 B3 D4 B3
    ];
    let melodyStep = 0;
    let bassStep = 0;
    let beat = 0;

    const playBeat = () => {
      if (!ctx) return;
      // Play melody note
      const note = melody[melodyStep];
      if (note > 0) {
        playTone(note, 0.12, "square", 0.04);
      }
      melodyStep = (melodyStep + 1) % melody.length;

      // Play bass on even beats
      if (beat % 2 === 0) {
        const bassNote = bass[bassStep];
        if (bassNote > 0) {
          playTone(bassNote, 0.18, "triangle", 0.05);
        }
        bassStep = (bassStep + 1) % bass.length;
      }
      beat++;
    };

    playBeat();
    const intervalId = window.setInterval(playBeat, 150);
    music = { intervalId };
  }

  function stopMusic() {
    if (!music) {
      return;
    }
    window.clearInterval(music.intervalId);
    music = null;
  }

  function setMuted(value: boolean) {
    muted = value;
    if (master) {
      master.gain.value = muted ? 0 : 0.2;
    }
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
    playTriumph,
    playDash,
    playCheckpoint,
    playWallSlide,
    playLanding,
    playDamage,
    startMusic,
    stopMusic,
    setMuted,
  };
}
