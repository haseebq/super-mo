const MUSIC_TRACKS = [
  "assets/audio/music/level1.mp3",
  "assets/audio/music/level2.mp3",
  "assets/audio/music/level3.mp3",
  "assets/audio/music/level4.mp3",
  "assets/audio/music/level5.mp3",
  "assets/audio/music/level6.mp3",
];
const MUSIC_VOLUME = 0.35;

export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const musicTracks = MUSIC_TRACKS.map((src) => {
    const track = new Audio(src);
    track.loop = true;
    track.preload = "auto";
    track.volume = MUSIC_VOLUME;
    return track;
  });
  let music: HTMLAudioElement | null = null;
  let musicIndex = -1;
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

  function startMusic(trackIndex = 0) {
    if (musicTracks.length === 0) {
      return;
    }
    const nextIndex = Math.min(Math.max(trackIndex, 0), musicTracks.length - 1);
    if (music && musicIndex === nextIndex) {
      return;
    }
    stopMusic();
    music = musicTracks[nextIndex];
    musicIndex = nextIndex;
    music.currentTime = 0;
    music.muted = muted;
    music.volume = MUSIC_VOLUME;
    const playResult = music.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {});
    }
  }

  function stopMusic() {
    if (!music) {
      return;
    }
    music.pause();
    music.currentTime = 0;
    music = null;
    musicIndex = -1;
  }

  function setMuted(value: boolean) {
    muted = value;
    if (master) {
      master.gain.value = muted ? 0 : 0.2;
    }
    if (music) {
      music.muted = muted;
      music.volume = muted ? 0 : MUSIC_VOLUME;
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
