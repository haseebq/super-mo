export type Vec2 = { x: number; y: number };

export type BoneTransform = {
  rotation: number;
  translation: Vec2;
  scale: Vec2;
};

export type BoneTransformKey = {
  rotation?: number;
  translation?: Partial<Vec2>;
  scale?: Partial<Vec2>;
};

export type RigKeyframe = {
  time: number;
  bones: Record<string, BoneTransformKey>;
  easing?: EasingName;
};

export type RigAnimationClip = {
  duration: number;
  loop: boolean;
  keyframes: RigKeyframe[];
};

export type RigPose = Record<string, BoneTransform>;

export type RigAnimationState = {
  clips: Record<string, RigAnimationClip>;
  current: string;
  time: number;
  pose: RigPose;
  blend?: {
    from: string;
    to: string;
    duration: number;
    time: number;
    fromTime: number;
  };
};

export type EasingName = "linear" | "easeIn" | "easeOut" | "easeInOut";

const DEFAULT_TRANSFORM: BoneTransform = {
  rotation: 0,
  translation: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}

function applyEasing(name: EasingName, t: number): number {
  switch (name) {
    case "easeIn":
      return t * t;
    case "easeOut":
      return t * (2 - t);
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case "linear":
    default:
      return t;
  }
}

function normalizeTransform(input?: BoneTransformKey): BoneTransform {
  return {
    rotation: input?.rotation ?? DEFAULT_TRANSFORM.rotation,
    translation: {
      x: input?.translation?.x ?? DEFAULT_TRANSFORM.translation.x,
      y: input?.translation?.y ?? DEFAULT_TRANSFORM.translation.y,
    },
    scale: {
      x: input?.scale?.x ?? DEFAULT_TRANSFORM.scale.x,
      y: input?.scale?.y ?? DEFAULT_TRANSFORM.scale.y,
    },
  };
}

function mergePoseKeys(a: RigPose, b: RigPose): string[] {
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
}

function getOrderedKeyframes(clip: RigAnimationClip): RigKeyframe[] {
  return [...clip.keyframes].sort((first, second) => first.time - second.time);
}

function normalizeClipTime(clip: RigAnimationClip, time: number): number {
  if (clip.duration <= 0) return 0;
  if (clip.loop) {
    return ((time % clip.duration) + clip.duration) % clip.duration;
  }
  return Math.min(time, clip.duration);
}

export function sampleRigClip(
  clip: RigAnimationClip,
  time: number
): RigPose {
  if (!clip.keyframes.length) return {};

  const frames = getOrderedKeyframes(clip);
  const normalized = normalizeClipTime(clip, time);
  const first = frames[0];
  const last = frames[frames.length - 1];

  if (normalized <= first.time) {
    return buildPoseFromKeyframe(first);
  }

  if (normalized >= last.time) {
    return buildPoseFromKeyframe(last);
  }

  for (let i = 0; i < frames.length - 1; i += 1) {
    const current = frames[i];
    const next = frames[i + 1];
    if (normalized >= current.time && normalized <= next.time) {
      const span = Math.max(next.time - current.time, 0.0001);
      const rawT = (normalized - current.time) / span;
      const easing = next.easing ?? "linear";
      const t = applyEasing(easing, rawT);
      return interpolateKeyframes(current, next, t);
    }
  }

  return buildPoseFromKeyframe(last);
}

function buildPoseFromKeyframe(frame: RigKeyframe): RigPose {
  const pose: RigPose = {};
  Object.entries(frame.bones).forEach(([name, transform]) => {
    pose[name] = normalizeTransform(transform);
  });
  return pose;
}

function interpolateKeyframes(
  from: RigKeyframe,
  to: RigKeyframe,
  t: number
): RigPose {
  const pose: RigPose = {};
  const boneNames = new Set([
    ...Object.keys(from.bones),
    ...Object.keys(to.bones),
  ]);

  boneNames.forEach((name) => {
    const a = normalizeTransform(from.bones[name]);
    const b = normalizeTransform(to.bones[name]);
    pose[name] = {
      rotation: lerpAngle(a.rotation, b.rotation, t),
      translation: {
        x: lerp(a.translation.x, b.translation.x, t),
        y: lerp(a.translation.y, b.translation.y, t),
      },
      scale: {
        x: lerp(a.scale.x, b.scale.x, t),
        y: lerp(a.scale.y, b.scale.y, t),
      },
    };
  });

  return pose;
}

export function blendRigPoses(
  poseA: RigPose,
  poseB: RigPose,
  weight: number
): RigPose {
  const clamped = Math.min(Math.max(weight, 0), 1);
  const result: RigPose = {};

  mergePoseKeys(poseA, poseB).forEach((name) => {
    const a = poseA[name] ?? DEFAULT_TRANSFORM;
    const b = poseB[name] ?? DEFAULT_TRANSFORM;
    result[name] = {
      rotation: lerpAngle(a.rotation, b.rotation, clamped),
      translation: {
        x: lerp(a.translation.x, b.translation.x, clamped),
        y: lerp(a.translation.y, b.translation.y, clamped),
      },
      scale: {
        x: lerp(a.scale.x, b.scale.x, clamped),
        y: lerp(a.scale.y, b.scale.y, clamped),
      },
    };
  });

  return result;
}

export function createRigAnimationState(
  clips: Record<string, RigAnimationClip>,
  initial: string
): RigAnimationState {
  return {
    clips,
    current: initial,
    time: 0,
    pose: sampleRigClip(clips[initial], 0),
  };
}

export function setRigAnimation(
  state: RigAnimationState,
  name: string,
  blendDuration = 0
): void {
  if (state.current === name) return;
  const next = state.clips[name];
  if (!next) return;

  if (blendDuration > 0) {
    state.blend = {
      from: state.current,
      to: name,
      duration: blendDuration,
      time: 0,
      fromTime: state.time,
    };
  } else {
    state.blend = undefined;
  }

  state.current = name;
  state.time = 0;
}

export function updateRigAnimation(
  state: RigAnimationState,
  dt: number
): RigPose {
  const currentClip = state.clips[state.current];
  if (!currentClip) return state.pose;

  if (state.blend) {
    const blend = state.blend;
    blend.time += dt;
    blend.fromTime += dt;
    state.time += dt;

    const fromClip = state.clips[blend.from];
    const toClip = state.clips[blend.to];

    if (fromClip && toClip) {
      const fromPose = sampleRigClip(fromClip, blend.fromTime);
      const toPose = sampleRigClip(toClip, state.time);
      const weight = Math.min(blend.time / blend.duration, 1);
      state.pose = blendRigPoses(fromPose, toPose, weight);
      if (weight >= 1) {
        state.blend = undefined;
      }
      return state.pose;
    }
  }

  state.time += dt;
  state.pose = sampleRigClip(currentClip, state.time);
  return state.pose;
}
