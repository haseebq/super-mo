import { isSolid } from "./level.js";
import { createAnimationState, setAnimation, updateAnimation } from "../core/animation.js";
import type { AnimationState } from "../core/animation.js";
import type { Level } from "./level.js";
import type { InputState } from "../core/input.js";

const TILE_SIZE = 16;
const WALK_SPEED = 1.6 * TILE_SIZE;
const RUN_SPEED = 2.6 * TILE_SIZE;
const ACCEL = 10 * TILE_SIZE;
const DECEL = 12 * TILE_SIZE;
const AIR_CONTROL = 0.7;
const JUMP_IMPULSE = 8.4 * TILE_SIZE;
const GRAVITY = 9.5 * TILE_SIZE;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.12;
const SHORT_HOP_WINDOW = 0.12;
const SHORT_HOP_FACTOR = 0.45;
const STOMP_BOUNCE = 0.75 * JUMP_IMPULSE;
const WALL_SLIDE_SPEED = 1.5 * TILE_SIZE;
const WALL_JUMP_IMPULSE = 7 * TILE_SIZE;
const WALL_JUMP_HORIZONTAL = 3 * TILE_SIZE;
const DASH_SPEED = 6 * TILE_SIZE;
const DASH_DURATION = 0.15;
const DASH_COOLDOWN = 0.8;

function approach(current: number, target: number, delta: number): number {
  if (current < target) {
    return Math.min(current + delta, target);
  }
  if (current > target) {
    return Math.max(current - delta, target);
  }
  return current;
}

export type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  onGround: boolean;
  onWall: boolean;
  wallDir: number; // -1 for left wall, 1 for right wall, 0 for none
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpHoldTime: number;
  jumpCut: boolean;
  facing: number;
  anim: AnimationState;
  platformId: number | null;
  dashTimer: number;
  dashCooldown: number;
};

export type PlayerEvents = {
  jumped: boolean;
};

const PLAYER_ANIMATIONS = {
  idle: { frames: ["player"], frameRate: 1, loop: true },
  run: { frames: ["player_run1", "player_run2"], frameRate: 10, loop: true },
  jump: { frames: ["player_jump"], frameRate: 1, loop: true },
  fall: { frames: ["player_jump"], frameRate: 1, loop: true },
  death: { frames: ["player_death"], frameRate: 1, loop: false },
};

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    width: 16,
    height: 24,
    vx: 0,
    vy: 0,
    onGround: false,
    onWall: false,
    wallDir: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpHoldTime: 0,
    jumpCut: false,
    facing: 1,
    anim: createAnimationState(PLAYER_ANIMATIONS, "idle"),
    platformId: null,
    dashTimer: 0,
    dashCooldown: 0,
  };
}

function resolveHorizontal(player: Player, level: Level) {
  if (player.vx === 0) {
    return;
  }

  const tileSize = level.tileSize;
  const leadingX = player.vx > 0
    ? Math.floor((player.x + player.width - 1) / tileSize)
    : Math.floor(player.x / tileSize);
  const top = Math.floor(player.y / tileSize);
  const bottom = Math.floor((player.y + player.height - 1) / tileSize);

  for (let y = top; y <= bottom; y += 1) {
    const index = y * level.width + leadingX;
    const id = level.tiles[index];
    if (isSolid(id)) {
      if (player.vx > 0) {
        player.x = leadingX * tileSize - player.width;
      } else {
        player.x = (leadingX + 1) * tileSize;
      }
      player.vx = 0;
      return;
    }
  }
}

function checkWallContact(player: Player, level: Level): number {
  if (player.onGround) {
    return 0;
  }
  const tileSize = level.tileSize;
  const top = Math.floor((player.y + 4) / tileSize);
  const bottom = Math.floor((player.y + player.height - 4) / tileSize);

  // Check right side
  const rightX = Math.floor((player.x + player.width) / tileSize);
  for (let y = top; y <= bottom; y++) {
    const id = level.tiles[y * level.width + rightX];
    if (isSolid(id)) {
      return 1; // Wall on right
    }
  }

  // Check left side
  const leftX = Math.floor((player.x - 1) / tileSize);
  for (let y = top; y <= bottom; y++) {
    const id = level.tiles[y * level.width + leftX];
    if (isSolid(id)) {
      return -1; // Wall on left
    }
  }

  return 0;
}

function resolveVertical(player: Player, level: Level) {
  if (player.vy === 0) {
    player.onGround = false;
    return;
  }

  const tileSize = level.tileSize;
  const leadingY = player.vy > 0
    ? Math.floor((player.y + player.height - 1) / tileSize)
    : Math.floor(player.y / tileSize);
  const left = Math.floor(player.x / tileSize);
  const right = Math.floor((player.x + player.width - 1) / tileSize);

  for (let x = left; x <= right; x += 1) {
    const index = leadingY * level.width + x;
    const id = level.tiles[index];
    if (isSolid(id)) {
      if (player.vy > 0) {
        player.y = leadingY * tileSize - player.height;
        player.onGround = true;
      } else {
        player.y = (leadingY + 1) * tileSize;
        player.onGround = false;
      }
      player.vy = 0;
      return;
    }
  }

  player.onGround = false;
}

type ControlBindings = {
  jump: string;
  run: string;
};

export function updatePlayer(
  player: Player,
  input: InputState,
  dt: number,
  level: Level,
  speedBoost: number,
  controls: ControlBindings
): PlayerEvents {
  const events: PlayerEvents = {
    jumped: false,
  };
  // Always run at full speed
  const speed = RUN_SPEED * speedBoost;
  const dir = (input.isDown("ArrowRight") ? 1 : 0) - (input.isDown("ArrowLeft") ? 1 : 0);
  const accel = (player.onGround ? 1 : AIR_CONTROL) * ACCEL;

  // Update dash cooldown
  if (player.dashCooldown > 0) {
    player.dashCooldown -= dt;
  }

  // Dash input (Shift key)
  if (input.consumePress("ShiftLeft") || input.consumePress("ShiftRight")) {
    if (player.dashCooldown <= 0 && player.dashTimer <= 0) {
      player.dashTimer = DASH_DURATION;
      player.dashCooldown = DASH_COOLDOWN;
    }
  }

  // Apply dash or normal movement
  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.facing * DASH_SPEED;
    player.vy = 0; // Freeze vertical movement during dash
  } else if (dir !== 0) {
    player.vx = approach(player.vx, dir * speed, accel * dt);
    player.facing = dir;
  } else {
    const decel = (player.onGround ? 1 : AIR_CONTROL) * DECEL;
    player.vx = approach(player.vx, 0, decel * dt);
  }

  // Accept both configured jump key and Space
  if (input.consumePress(controls.jump) || input.consumePress("Space")) {
    player.jumpBufferTimer = JUMP_BUFFER;
  }

  if (player.jumpBufferTimer > 0) {
    player.jumpBufferTimer -= dt;
  }

  if (player.onGround) {
    player.coyoteTimer = COYOTE_TIME;
  } else if (player.coyoteTimer > 0) {
    player.coyoteTimer -= dt;
  }

  // Wall jump (check before normal jump)
  if (player.jumpBufferTimer > 0 && player.onWall && !player.onGround) {
    player.vy = -WALL_JUMP_IMPULSE;
    player.vx = -player.wallDir * WALL_JUMP_HORIZONTAL;
    player.facing = -player.wallDir;
    player.onWall = false;
    player.wallDir = 0;
    player.jumpBufferTimer = 0;
    player.jumpHoldTime = 0;
    player.jumpCut = false;
    events.jumped = true;
  }

  const canJump = player.coyoteTimer > 0;
  if (player.jumpBufferTimer > 0 && canJump) {
    player.vy = -JUMP_IMPULSE;
    player.onGround = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.jumpHoldTime = 0;
    player.jumpCut = false;
    events.jumped = true;
  }

  if (!player.onGround && player.vy < 0) {
    player.jumpHoldTime += dt;
    const holdingJump = input.isDown(controls.jump) || input.isDown("Space");
    if (!holdingJump && !player.jumpCut && player.jumpHoldTime <= SHORT_HOP_WINDOW) {
      player.vy *= SHORT_HOP_FACTOR;
      player.jumpCut = true;
    }
  }

  player.vy += GRAVITY * dt;

  // Wall slide (limit fall speed when on wall)
  if (player.onWall && player.vy > WALL_SLIDE_SPEED) {
    player.vy = WALL_SLIDE_SPEED;
  }

  player.x += player.vx * dt;
  resolveHorizontal(player, level);

  player.y += player.vy * dt;
  resolveVertical(player, level);

  // Update wall contact
  player.wallDir = checkWallContact(player, level);
  player.onWall = player.wallDir !== 0 && player.vy >= 0;

  // Update Animation
  if (!player.onGround) {
    if (player.vy < 0) {
      setAnimation(player.anim, "jump");
    } else {
      setAnimation(player.anim, "fall");
    }
  } else if (Math.abs(player.vx) > 1) {
    setAnimation(player.anim, "run");
    player.anim.animations.run.frameRate = 15;
  } else {
    setAnimation(player.anim, "idle");
  }

  updateAnimation(player.anim, dt);

  return events;
}

export function bouncePlayer(player: Player): void {
  player.vy = -STOMP_BOUNCE;
  player.onGround = false;
  player.jumpHoldTime = 0;
  player.jumpCut = true;
}
