# Vector Animation System

## Overview
Vector rigs use keyframed bone transforms (rotation, translation, scale) with optional easing between frames. Clip blending allows smooth transitions.

## Code Location
`src/core/rig-animation.ts`

## Clip Format
- `duration`: seconds
- `loop`: boolean
- `keyframes`: ordered list of `{ time, bones, easing }`

Each `bones` entry maps a bone name to transform values:
- `rotation`: radians
- `translation`: `{ x, y }`
- `scale`: `{ x, y }`

Missing values fall back to defaults (rotation 0, translation 0, scale 1).

## Usage
```ts
import {
  createRigAnimationState,
  setRigAnimation,
  updateRigAnimation,
} from "./core/rig-animation.js";

const state = createRigAnimationState(clips, "idle");
setRigAnimation(state, "run", 0.2);
const pose = updateRigAnimation(state, dt);
```

## Easing
Supported easing names:
- `linear`
- `easeIn`
- `easeOut`
- `easeInOut`

## Blending
`setRigAnimation(state, next, blendDuration)` blends from the current clip into the next clip, sampling both and mixing poses over time.
