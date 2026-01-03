/**
 * Collision System
 *
 * Detects collisions between entities and emits events.
 * Collision handlers are data: between layers + condition + emit event.
 */

import { CollisionHandler, EngineState, Entity } from "./state.js";
import { getEntities } from "./entities.js";
import { evaluate } from "./expressions.js";

export interface CollisionPair {
  a: Entity;
  b: Entity;
  handler: CollisionHandler;
}

export interface CollisionResult {
  collisionsDetected: CollisionPair[];
  eventsEmitted: Array<{ event: string; data: Record<string, unknown> }>;
}

/**
 * Define a collision handler.
 */
export function defineCollision(state: EngineState, handler: CollisionHandler): void {
  // Remove existing handler with same between pair (order matters)
  const key = handler.between.join("-");
  state.collisions = state.collisions.filter(
    (h) => h.between.join("-") !== key
  );
  state.collisions.push(handler);
}

/**
 * Remove a collision handler.
 */
export function removeCollision(state: EngineState, between: [string, string]): boolean {
  const key = between.join("-");
  const index = state.collisions.findIndex((h) => h.between.join("-") === key);
  if (index === -1) return false;
  state.collisions.splice(index, 1);
  return true;
}

/**
 * Get all collision handlers.
 */
export function getCollisionHandlers(state: EngineState): CollisionHandler[] {
  return state.collisions;
}

/**
 * Check if two AABBs overlap.
 */
export function checkAABBOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return (
    ax < bx + bw &&
    ax + aw > bx &&
    ay < by + bh &&
    ay + ah > by
  );
}

/**
 * Get entity bounds from Position and Collider components.
 */
function getEntityBounds(entity: Entity): { x: number; y: number; w: number; h: number } | null {
  const pos = entity.components.Position as { x: number; y: number } | undefined;
  const collider = entity.components.Collider as { width: number; height: number; offsetX?: number; offsetY?: number } | undefined;

  if (!pos || !collider) return null;

  return {
    x: pos.x + (collider.offsetX ?? 0),
    y: pos.y + (collider.offsetY ?? 0),
    w: collider.width,
    h: collider.height,
  };
}

/**
 * Get entity collision layer from Collider component.
 */
function getEntityLayer(entity: Entity): string | null {
  const collider = entity.components.Collider as { layer?: string } | undefined;
  return collider?.layer ?? null;
}

/**
 * Run collision detection for all handlers.
 */
export function detectCollisions(state: EngineState): CollisionResult {
  const result: CollisionResult = {
    collisionsDetected: [],
    eventsEmitted: [],
  };

  // Get all entities with colliders
  const collidableEntities = getEntities(state, { has: ["Position", "Collider"] });

  // Group entities by layer
  const entitiesByLayer = new Map<string, Entity[]>();
  for (const entity of collidableEntities) {
    const layer = getEntityLayer(entity);
    if (!layer) continue;
    if (!entitiesByLayer.has(layer)) {
      entitiesByLayer.set(layer, []);
    }
    entitiesByLayer.get(layer)!.push(entity);
  }

  // Check each collision handler
  for (const handler of state.collisions) {
    const [layerA, layerB] = handler.between;
    const entitiesA = entitiesByLayer.get(layerA) ?? [];
    const entitiesB = entitiesByLayer.get(layerB) ?? [];

    // Check all pairs
    for (const entityA of entitiesA) {
      for (const entityB of entitiesB) {
        // Don't collide with self
        if (entityA.id === entityB.id) continue;

        const boundsA = getEntityBounds(entityA);
        const boundsB = getEntityBounds(entityB);

        if (!boundsA || !boundsB) continue;

        // Check AABB overlap
        if (checkAABBOverlap(
          boundsA.x, boundsA.y, boundsA.w, boundsA.h,
          boundsB.x, boundsB.y, boundsB.w, boundsB.h
        )) {
          // Check condition if present
          if (handler.condition) {
            const conditionResult = evaluate(handler.condition, {
              entity: entityA.components,
              data: {
                a: entityA,
                b: entityB,
              },
              time: state.time,
              rules: state.rules,
            });
            if (!conditionResult) continue;
          }

          // Collision detected!
          const pair: CollisionPair = { a: entityA, b: entityB, handler };
          result.collisionsDetected.push(pair);

          // Build event data
          const eventData: Record<string, unknown> = {
            ...handler.data,
          };

          // Resolve data references (a, b become actual entities)
          if (handler.data) {
            for (const [key, value] of Object.entries(handler.data)) {
              if (value === "a") eventData[key] = entityA;
              else if (value === "b") eventData[key] = entityB;
            }
          }

          result.eventsEmitted.push({
            event: handler.emit,
            data: eventData,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Run collision detection and return a simplified log.
 */
export function getCollisionsLog(state: EngineState): Array<{
  entityA: string;
  entityB: string;
  event: string;
}> {
  const result = detectCollisions(state);
  return result.collisionsDetected.map((pair) => ({
    entityA: pair.a.id,
    entityB: pair.b.id,
    event: pair.handler.emit,
  }));
}
