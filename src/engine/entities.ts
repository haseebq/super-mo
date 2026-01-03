/**
 * Entity System
 *
 * Entities are pure data: id + tags + components.
 * No behavior, just data containers.
 */

import { Entity, EntityId, EntityTemplate, Query, EngineState, ComponentData } from "./state.js";

let nextEntityId = 1;

export function generateEntityId(): EntityId {
  return `entity-${nextEntityId++}`;
}

export function resetEntityIdCounter(): void {
  nextEntityId = 1;
}

/**
 * Spawn an entity from a template.
 */
export function spawnEntity(
  state: EngineState,
  templateName: string,
  overrides?: { id?: EntityId; at?: { x: number; y: number }; tags?: string[] }
): Entity {
  const template = state.templates[templateName];
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  const entity: Entity = {
    id: overrides?.id ?? generateEntityId(),
    tags: [...template.tags, ...(overrides?.tags ?? [])],
    components: JSON.parse(JSON.stringify(template.components)),
  };

  // Apply position override
  if (overrides?.at && entity.components.Position) {
    entity.components.Position.x = overrides.at.x;
    entity.components.Position.y = overrides.at.y;
  }

  state.entities.push(entity);
  return entity;
}

/**
 * Create an entity directly (without template).
 */
export function createEntity(
  state: EngineState,
  config: { id?: EntityId; tags?: string[]; components?: Record<string, ComponentData> }
): Entity {
  const entity: Entity = {
    id: config.id ?? generateEntityId(),
    tags: config.tags ?? [],
    components: config.components ? JSON.parse(JSON.stringify(config.components)) : {},
  };

  state.entities.push(entity);
  return entity;
}

/**
 * Remove an entity by ID.
 */
export function removeEntity(state: EngineState, entityId: EntityId): boolean {
  const index = state.entities.findIndex((e) => e.id === entityId);
  if (index === -1) return false;
  state.entities.splice(index, 1);
  return true;
}

/**
 * Get an entity by ID.
 */
export function getEntity(state: EngineState, entityId: EntityId): Entity | undefined {
  return state.entities.find((e) => e.id === entityId);
}

/**
 * Query entities by tag and/or components.
 */
export function getEntities(state: EngineState, query: Query): Entity[] {
  return state.entities.filter((entity) => matchesQuery(entity, query));
}

/**
 * Check if entity matches a query.
 */
export function matchesQuery(entity: Entity, query: Query): boolean {
  // Tag filter
  if (query.tag && !entity.tags.includes(query.tag)) {
    return false;
  }

  // Has components filter
  if (query.has) {
    for (const componentType of query.has) {
      if (!(componentType in entity.components)) {
        return false;
      }
    }
  }

  // Not components filter
  if (query.not) {
    for (const componentType of query.not) {
      if (componentType in entity.components) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Set a component on an entity.
 */
export function setComponent(
  state: EngineState,
  entityId: EntityId,
  componentType: string,
  data: ComponentData
): boolean {
  const entity = getEntity(state, entityId);
  if (!entity) return false;
  entity.components[componentType] = JSON.parse(JSON.stringify(data));
  return true;
}

/**
 * Update a component value by path.
 */
export function updateComponent(
  state: EngineState,
  entityId: EntityId,
  path: string,
  value: unknown
): boolean {
  const entity = getEntity(state, entityId);
  if (!entity) return false;

  const parts = path.split(".");
  const componentType = parts[0];
  const component = entity.components[componentType];
  if (!component) return false;

  if (parts.length === 1) {
    entity.components[componentType] = value as ComponentData;
    return true;
  }

  let current = component as Record<string, unknown>;
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) return false;
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return true;
}

/**
 * Remove a component from an entity.
 */
export function removeComponent(
  state: EngineState,
  entityId: EntityId,
  componentType: string
): boolean {
  const entity = getEntity(state, entityId);
  if (!entity) return false;
  if (!(componentType in entity.components)) return false;
  delete entity.components[componentType];
  return true;
}

/**
 * Define an entity template.
 */
export function defineTemplate(
  state: EngineState,
  name: string,
  template: EntityTemplate
): void {
  state.templates[name] = JSON.parse(JSON.stringify(template));
}

/**
 * Get a template by name.
 */
export function getTemplate(state: EngineState, name: string): EntityTemplate | undefined {
  return state.templates[name];
}
