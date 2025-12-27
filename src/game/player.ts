import { isSolid } from "./level.js";
import type { Level } from "./level.js";
import type { InputState } from "../core/input.js";

const TILE_SIZE = 16;
const WALK_SPEED = 1.6 * TILE_SIZE;
const RUN_SPEED = 2.6 * TILE_SIZE;
const ACCEL = 10 * TILE_SIZE;
const DECEL = 12 * TILE_SIZE;
const AIR_CONTROL = 0.7;
const JUMP_IMPULSE = 4.2 * TILE_SIZE;
const GRAVITY = 12 * TILE_SIZE;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.12;
const SHORT_HOP_WINDOW = 0.12;
const SHORT_HOP_FACTOR = 0.45;
const STOMP_BOUNCE = 0.7 * JUMP_IMPULSE;

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
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpHoldTime: number;
  jumpCut: boolean;
};

export type PlayerEvents = {
  jumped: boolean;
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
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpHoldTime: 0,
    jumpCut: false,
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

export function updatePlayer(
  player: Player,
  input: InputState,
  dt: number,
  level: Level
): PlayerEvents {
  const events: PlayerEvents = {
    jumped: false,
  };
  const wantsRun = input.isDown("KeyX");
  const speed = wantsRun ? RUN_SPEED : WALK_SPEED;
  const dir = (input.isDown("ArrowRight") ? 1 : 0) - (input.isDown("ArrowLeft") ? 1 : 0);
  const accel = (player.onGround ? 1 : AIR_CONTROL) * ACCEL;

  if (dir !== 0) {
    player.vx = approach(player.vx, dir * speed, accel * dt);
  } else {
    const decel = (player.onGround ? 1 : AIR_CONTROL) * DECEL;
    player.vx = approach(player.vx, 0, decel * dt);
  }

  if (input.consumePress("KeyZ")) {
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
    if (!input.isDown("KeyZ") && !player.jumpCut && player.jumpHoldTime <= SHORT_HOP_WINDOW) {
      player.vy *= SHORT_HOP_FACTOR;
      player.jumpCut = true;
    }
  }

  player.vy += GRAVITY * dt;

  player.x += player.vx * dt;
  resolveHorizontal(player, level);

  player.y += player.vy * dt;
  resolveVertical(player, level);
  return events;
}

export function bouncePlayer(player: Player): void {
  player.vy = -STOMP_BOUNCE;
  player.onGround = false;
  player.jumpHoldTime = 0;
  player.jumpCut = true;
}
