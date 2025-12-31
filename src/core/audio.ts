type SfxKey =
  | "jump"
  | "stomp"
  | "coin"
  | "shard"
  | "powerup"
  | "hurt"
  | "goal"
  | "triumph"
  | "dash"
  | "jetpack"
  | "checkpoint"
  | "wallSlide"
  | "landing"
  | "damage";

const MUSIC_TRACKS = [
  "assets/audio/music/level1.mp3",
  "assets/audio/music/level2.mp3",
  "assets/audio/music/level3.mp3",
  "assets/audio/music/level4.mp3",
  "assets/audio/music/level5.mp3",
  "assets/audio/music/level6.mp3",
];
const MUSIC_VOLUME = 0.35;

const SFX_TRACKS: Record<SfxKey, string> = {
  jump: "assets/audio/sfx/jump.mp3",
  stomp: "assets/audio/sfx/stomp.mp3",
  coin: "assets/audio/sfx/coin.mp3",
  shard: "assets/audio/sfx/shard.mp3",
  powerup: "assets/audio/sfx/powerup.mp3",
  hurt: "assets/audio/sfx/hurt.mp3",
  goal: "assets/audio/sfx/goal.mp3",
  triumph: "assets/audio/sfx/triumph.mp3",
  dash: "assets/audio/sfx/dash.mp3",
  jetpack: "assets/audio/sfx/jetpack.mp3",
  checkpoint: "assets/audio/sfx/checkpoint.mp3",
  wallSlide: "assets/audio/sfx/wallslide.mp3",
  landing: "assets/audio/sfx/landing.mp3",
  damage: "assets/audio/sfx/damage.mp3",
};

const SFX_VOLUME = 0.45;
const SFX_POOL_SIZE = 4;
const SFX_COOLDOWNS: Partial<Record<SfxKey, number>> = {
  wallSlide: 200,
};
const JETPACK_LOOP_VOLUME = 0.28;

export function createAudio() {
  const musicTracks = MUSIC_TRACKS.map((src) => {
    const track = new Audio(src);
    track.loop = true;
    track.preload = "auto";
    track.volume = MUSIC_VOLUME;
    return track;
  });
  const sfxPools = new Map<SfxKey, HTMLAudioElement[]>();
  const sfxLastPlayed = new Map<SfxKey, number>();
  const jetpackLoop = new Audio(SFX_TRACKS.jetpack);
  jetpackLoop.loop = true;
  jetpackLoop.preload = "auto";
  jetpackLoop.volume = JETPACK_LOOP_VOLUME;
  let music: HTMLAudioElement | null = null;
  let musicIndex = -1;
  let muted = false;

  const createSfxPool = (src: string) =>
    Array.from({ length: SFX_POOL_SIZE }, () => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = SFX_VOLUME;
      return audio;
    });

  (Object.keys(SFX_TRACKS) as SfxKey[]).forEach((key) => {
    sfxPools.set(key, createSfxPool(SFX_TRACKS[key]));
  });

  function unlock() {
    for (const track of musicTracks) {
      track.muted = muted;
    }
    for (const pool of sfxPools.values()) {
      for (const track of pool) {
        track.muted = muted;
      }
    }
    jetpackLoop.muted = muted;
  }

  function playSfx(key: SfxKey) {
    if (muted) {
      return;
    }
    const cooldown = SFX_COOLDOWNS[key] ?? 0;
    const now = performance.now();
    const last = sfxLastPlayed.get(key) ?? -Infinity;
    if (now - last < cooldown) {
      return;
    }
    sfxLastPlayed.set(key, now);
    const pool = sfxPools.get(key);
    if (!pool) {
      return;
    }
    const track = pool.find((entry) => entry.paused) ?? pool[0];
    track.currentTime = 0;
    track.muted = muted;
    track.volume = SFX_VOLUME;
    const playResult = track.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {});
    }
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

  function startJetpackLoop() {
    if (!jetpackLoop.paused) {
      return;
    }
    jetpackLoop.currentTime = 0;
    jetpackLoop.muted = muted;
    jetpackLoop.volume = JETPACK_LOOP_VOLUME;
    const playResult = jetpackLoop.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {});
    }
  }

  function stopJetpackLoop() {
    if (jetpackLoop.paused) {
      return;
    }
    jetpackLoop.pause();
    jetpackLoop.currentTime = 0;
  }

  function setMuted(value: boolean) {
    muted = value;
    if (music) {
      music.muted = muted;
      music.volume = muted ? 0 : MUSIC_VOLUME;
    }
    for (const pool of sfxPools.values()) {
      for (const track of pool) {
        track.muted = muted;
        track.volume = muted ? 0 : SFX_VOLUME;
      }
    }
    jetpackLoop.muted = muted;
    jetpackLoop.volume = muted ? 0 : JETPACK_LOOP_VOLUME;
  }

  return {
    unlock,
    playJump: () => playSfx("jump"),
    playStomp: () => playSfx("stomp"),
    playCoin: () => playSfx("coin"),
    playShard: () => playSfx("shard"),
    playPowerup: () => playSfx("powerup"),
    playHurt: () => playSfx("hurt"),
    playGoal: () => playSfx("goal"),
    playTriumph: () => playSfx("triumph"),
    playDash: () => playSfx("dash"),
    playJetpack: () => playSfx("jetpack"),
    playCheckpoint: () => playSfx("checkpoint"),
    playWallSlide: () => playSfx("wallSlide"),
    playLanding: () => playSfx("landing"),
    playDamage: () => playSfx("damage"),
    startJetpackLoop,
    stopJetpackLoop,
    startMusic,
    stopMusic,
    setMuted,
  };
}
