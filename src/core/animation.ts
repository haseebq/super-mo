export type Animation = {
  frames: string[];
  frameRate: number;
  loop: boolean;
};

export type AnimationState = {
  currentAnimation: string;
  animations: Record<string, Animation>;
  timer: number;
  frameIndex: number;
};

export function createAnimationState(
  animations: Record<string, Animation>,
  initialAnimation: string
): AnimationState {
  return {
    currentAnimation: initialAnimation,
    animations,
    timer: 0,
    frameIndex: 0,
  };
}

export function updateAnimation(state: AnimationState, dt: number): void {
  const anim = state.animations[state.currentAnimation];
  if (!anim) return;

  state.timer += dt;
  if (state.timer >= 1 / anim.frameRate) {
    state.timer = 0;
    state.frameIndex += 1;
    if (state.frameIndex >= anim.frames.length) {
      if (anim.loop) {
        state.frameIndex = 0;
      } else {
        state.frameIndex = anim.frames.length - 1;
      }
    }
  }
}

export function setAnimation(state: AnimationState, name: string): void {
  if (state.currentAnimation === name) return;
  state.currentAnimation = name;
  state.timer = 0;
  state.frameIndex = 0;
}

export function getCurrentFrame(state: AnimationState): string {
  const anim = state.animations[state.currentAnimation];
  if (!anim) return "";
  return anim.frames[state.frameIndex];
}
