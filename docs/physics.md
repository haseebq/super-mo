# Super Mo - Movement and Physics Spec

## Goals
- Instant response with forgiving jump arcs.
- Consistent, learnable physics across all levels.
- Expressive movement: short hops, full jumps, and momentum control.

## Player Movement
- **Walk speed:** 1.6 tiles/sec
- **Run speed:** 2.6 tiles/sec (hold Run)
- **Acceleration:** 10 tiles/sec^2
- **Deceleration:** 12 tiles/sec^2
- **Air control:** 70% of ground control

## Jumping
- **Jump impulse:** 6.1 tiles/sec
- **Gravity:** 10 tiles/sec^2
- **Short hop:** release jump within 120ms to cut velocity by 55%
- **Coyote time:** 120ms grace after leaving ground
- **Jump buffer:** 120ms buffer before landing

## Collision
- Axis-aligned bounding boxes (AABB)
- Solid tiles block movement
- One-way platforms (if added) block from above only

## Stomp
- Landing on enemy top: bounce with 75% of jump impulse
- Side collision: damage or knockback (Phase 1: reset to last checkpoint)

## Damage/Health
- Phase 1: 1-hit fail with instant restart at last checkpoint
- Optional: 2-hit buffer for easier mode

## Camera
- Follow player with slight look-ahead
- Vertical follow with damped smoothing to reduce motion sickness

## Tuning Notes
- All numbers are starting points and will be tuned by feel.
- Movement should be tested with early prototype in first level.
