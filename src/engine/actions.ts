/**
 * Action Executor
 *
 * Executes structured action types.
 * Actions are data, not code - they describe what to do.
 */

import { Action, EngineState, Query } from "./state.js";
import { evaluate, ExpressionContext } from "./expressions.js";
import {
  spawnEntity,
  removeEntity,
  getEntity,
  getEntities,
  updateComponent,
} from "./entities.js";

export interface ActionContext extends ExpressionContext {
  state: EngineState;
}

export interface ActionResult {
  success: boolean;
  eventsEmitted: string[];
  error?: string;
}

/**
 * Execute a single action.
 */
export function executeAction(action: Action, context: ActionContext): ActionResult {
  const result: ActionResult = {
    success: true,
    eventsEmitted: [],
  };

  try {
    switch (action.type) {
      case "set":
        executeSet(action, context);
        break;

      case "add":
        executeAdd(action, context);
        break;

      case "remove":
        executeRemove(action, context);
        break;

      case "spawn":
        executeSpawn(action, context);
        break;

      case "destroy":
        executeDestroy(action, context);
        break;

      case "emit":
        result.eventsEmitted.push(action.event);
        // Event data is stored for event handlers to process
        if (action.data) {
          context.data = { ...context.data, ...action.data };
        }
        break;

      case "when":
        const whenResult = executeWhen(action, context);
        result.eventsEmitted.push(...whenResult.eventsEmitted);
        break;

      case "forEach":
        const forEachResult = executeForEach(action, context);
        result.eventsEmitted.push(...forEachResult.eventsEmitted);
        break;

      case "setMode":
        context.state.modes.current = action.mode;
        break;

      default:
        result.success = false;
        result.error = `Unknown action type: ${(action as Action).type}`;
    }
  } catch (err) {
    result.success = false;
    result.error = String(err);
  }

  return result;
}

/**
 * Execute a list of actions.
 */
export function executeActions(actions: Action[], context: ActionContext): ActionResult {
  const result: ActionResult = {
    success: true,
    eventsEmitted: [],
  };

  for (const action of actions) {
    const actionResult = executeAction(action, context);
    result.eventsEmitted.push(...actionResult.eventsEmitted);
    if (!actionResult.success) {
      result.success = false;
      result.error = actionResult.error;
      break;
    }
  }

  return result;
}

function executeSet(action: Extract<Action, { type: "set" }>, context: ActionContext): void {
  const value = evaluateValue(action.value, context);
  setValueByPath(action.target, value, context);
}

function executeAdd(action: Extract<Action, { type: "add" }>, context: ActionContext): void {
  const addValue = evaluateValue(action.value, context) as number;
  const currentValue = getValueByPath(action.target, context) as number ?? 0;
  setValueByPath(action.target, currentValue + addValue, context);
}

function executeRemove(action: Extract<Action, { type: "remove" }>, context: ActionContext): void {
  // "remove" removes a property/component, not an entity
  const parts = action.target.split(".");
  if (parts.length < 2) return;

  const entityRef = parts[0];
  const entity = resolveEntityRef(entityRef, context);
  if (!entity) return;

  if (parts.length === 2) {
    // Remove entire component
    delete entity.components[parts[1]];
  } else {
    // Remove nested property
    const componentType = parts[1];
    const component = entity.components[componentType];
    if (!component) return;

    let current = component as Record<string, unknown>;
    for (let i = 2; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) return;
      current = current[part] as Record<string, unknown>;
    }
    delete current[parts[parts.length - 1]];
  }
}

function executeSpawn(action: Extract<Action, { type: "spawn" }>, context: ActionContext): void {
  let at: { x: number; y: number } | undefined;
  if (action.at) {
    const atValue = evaluateValue(action.at, context);
    if (typeof atValue === "object" && atValue !== null) {
      at = atValue as { x: number; y: number };
    }
  }
  spawnEntity(context.state, action.template, { at });
}

function executeDestroy(action: Extract<Action, { type: "destroy" }>, context: ActionContext): void {
  const entityId = resolveEntityId(action.target, context);
  if (entityId) {
    removeEntity(context.state, entityId);
  }
}

function executeWhen(
  action: Extract<Action, { type: "when" }>,
  context: ActionContext
): ActionResult {
  const condition = evaluateValue(action.condition, context);
  if (condition) {
    return executeActions(action.then, context);
  } else if (action.else) {
    return executeActions(action.else, context);
  }
  return { success: true, eventsEmitted: [] };
}

function executeForEach(
  action: Extract<Action, { type: "forEach" }>,
  context: ActionContext
): ActionResult {
  const entities = getEntities(context.state, action.query);
  const result: ActionResult = { success: true, eventsEmitted: [] };

  for (const entity of entities) {
    const entityContext: ActionContext = {
      ...context,
      entity: entity.components,
      data: { ...context.data, entity },
    };

    const actionResult = executeActions(action.do, entityContext);
    result.eventsEmitted.push(...actionResult.eventsEmitted);
    if (!actionResult.success) {
      result.success = false;
      result.error = actionResult.error;
      break;
    }
  }

  return result;
}

function evaluateValue(expr: string, context: ActionContext): unknown {
  return evaluate(expr, {
    entity: context.entity,
    rules: context.state.rules,
    time: context.state.time,
    dt: context.dt ?? 1 / 60,
    input: context.input,
    data: context.data,
  });
}

function resolveEntityRef(ref: string, context: ActionContext): Record<string, Record<string, unknown>> | undefined {
  // Handle "entity", "data.player", "data.enemy", etc.
  if (ref === "entity" && context.entity) {
    // Return a wrapper that looks like an entity with components
    return { components: context.entity } as unknown as Record<string, Record<string, unknown>>;
  }

  if (ref.startsWith("data.")) {
    const dataPath = ref.slice(5);
    const parts = dataPath.split(".");
    let current = context.data as Record<string, unknown> | undefined;
    for (const part of parts) {
      if (!current) return undefined;
      current = current[part] as Record<string, unknown> | undefined;
    }
    return current as Record<string, Record<string, unknown>> | undefined;
  }

  // Try to find by entity ID
  const entity = getEntity(context.state, ref);
  if (entity) {
    return entity as unknown as Record<string, Record<string, unknown>>;
  }

  return undefined;
}

function resolveEntityId(ref: string, context: ActionContext): string | undefined {
  if (ref.startsWith("data.")) {
    const value = evaluateValue(ref, context);
    if (typeof value === "object" && value !== null && "id" in value) {
      return (value as { id: string }).id;
    }
    return undefined;
  }
  return ref;
}

function getValueByPath(path: string, context: ActionContext): unknown {
  const parts = path.split(".");
  const entityRef = parts[0];

  if (entityRef === "rules") {
    let current = context.state.rules as Record<string, unknown>;
    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined) return undefined;
      current = current[parts[i]] as Record<string, unknown>;
    }
    return current;
  }

  const entity = resolveEntityRef(entityRef, context);
  if (!entity) return undefined;

  // Navigate to component and property
  let current: unknown = entity.components ?? entity;
  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[parts[i]];
  }

  return current;
}

function setValueByPath(path: string, value: unknown, context: ActionContext): void {
  const parts = path.split(".");

  // Handle rules updates
  if (parts[0] === "rules") {
    let current = context.state.rules as Record<string, unknown>;
    for (let i = 1; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
    return;
  }

  // Handle entity updates
  const entityRef = parts[0];

  // Special handling for "entity.Component.property" pattern
  if (entityRef === "entity" && context.entity) {
    if (parts.length >= 2) {
      const componentType = parts[1];
      if (parts.length === 2) {
        context.entity[componentType] = value as Record<string, unknown>;
      } else {
        if (!context.entity[componentType]) {
          context.entity[componentType] = {};
        }
        let current = context.entity[componentType] as Record<string, unknown>;
        for (let i = 2; i < parts.length - 1; i++) {
          if (!(parts[i] in current)) {
            current[parts[i]] = {};
          }
          current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = value;
      }
    }
    return;
  }

  // Handle data.* entity references
  if (entityRef.startsWith("data.") || !entityRef.includes(".")) {
    const entity = resolveEntityRef(entityRef, context);
    if (!entity) return;

    const componentPath = parts.slice(1);
    if (componentPath.length === 0) return;

    const componentType = componentPath[0];
    const components = entity.components ?? entity;

    if (componentPath.length === 1) {
      components[componentType] = value as Record<string, unknown>;
    } else {
      if (!components[componentType]) {
        components[componentType] = {};
      }
      let current = components[componentType] as Record<string, unknown>;
      for (let i = 1; i < componentPath.length - 1; i++) {
        if (!(componentPath[i] in current)) {
          current[componentPath[i]] = {};
        }
        current = current[componentPath[i]] as Record<string, unknown>;
      }
      current[componentPath[componentPath.length - 1]] = value;
    }
  }
}
