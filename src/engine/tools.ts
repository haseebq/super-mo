/**
 * Tool Interface
 *
 * All engine operations are exposed as tools.
 * AI controls engine exclusively via tool calls.
 * Tests use the same interface.
 */

import { GameEngine } from "./engine.js";
import { EngineState, Query, EntityTemplate, ComponentData } from "./state.js";
import {
  spawnEntity,
  createEntity,
  removeEntity,
  getEntity,
  getEntities,
  setComponent,
  updateComponent,
  removeComponent,
  defineTemplate,
  getTemplate,
} from "./entities.js";
import {
  evaluate,
  isValidExpression,
  ExpressionContext,
} from "./expressions.js";
import {
  executeAction,
  executeActions,
  ActionContext,
} from "./actions.js";
import {
  defineSystem,
  removeSystem,
  getSystem,
  getSystems,
  runSystem,
  runSystems,
} from "./systems.js";
import {
  defineCollision,
  removeCollision,
  getCollisionHandlers,
  detectCollisions,
  getCollisionsLog,
} from "./collisions.js";
import {
  defineEvent,
  removeEvent,
  getEventHandlers,
  getEventHandler,
  triggerEvent,
  processEvents,
  getEventsLog,
} from "./events.js";
import {
  getRule,
  setRule,
  getAllRules,
  getPhysicsRules,
  getScoringRules,
  getControls,
  setControl,
  resetRules,
} from "./rules.js";
import {
  getMode,
  setMode,
  defineTransition,
  removeTransition,
  triggerTransition,
  getTransitionsFrom,
  getAllTransitions,
  getScreen,
  setScreen,
  updateScreen,
  getAllScreens,
  getAvailableTriggers,
} from "./modes.js";
import { Action, System, CollisionHandler } from "./state.js";

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export class ToolExecutor {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  /**
   * List all available tools.
   */
  getTools(): ToolDefinition[] {
    return [
      // Simulation tools
      {
        name: "step",
        description: "Advance simulation by N frames",
        parameters: {
          frames: { type: "number", description: "Number of frames to advance", required: false },
          dt: { type: "number", description: "Delta time per frame (default: 1/60)", required: false },
        },
      },
      {
        name: "dump_state",
        description: "Export full engine state as JSON",
        parameters: {},
      },
      {
        name: "load_state",
        description: "Import state from JSON",
        parameters: {
          state: { type: "object", description: "Engine state to load", required: true },
        },
      },
      {
        name: "query_state",
        description: "Get full or filtered state",
        parameters: {
          path: { type: "string", description: "Dot-path to filter (e.g., 'rules.physics')", required: false },
        },
      },
      {
        name: "get_frame",
        description: "Get current frame number",
        parameters: {},
      },
      {
        name: "get_time",
        description: "Get current simulation time",
        parameters: {},
      },
      {
        name: "get_mode",
        description: "Get current game mode",
        parameters: {},
      },

      // Entity tools
      {
        name: "spawn_entity",
        description: "Create entity from template",
        parameters: {
          template: { type: "string", description: "Template name", required: true },
          at: { type: "object", description: "Position {x, y}", required: false },
          id: { type: "string", description: "Entity ID (auto-generated if omitted)", required: false },
          tags: { type: "array", description: "Additional tags", required: false },
        },
      },
      {
        name: "create_entity",
        description: "Create entity directly without template",
        parameters: {
          id: { type: "string", description: "Entity ID (auto-generated if omitted)", required: false },
          tags: { type: "array", description: "Entity tags", required: false },
          components: { type: "object", description: "Component data", required: false },
        },
      },
      {
        name: "remove_entity",
        description: "Delete entity by ID",
        parameters: {
          id: { type: "string", description: "Entity ID", required: true },
        },
      },
      {
        name: "get_entity",
        description: "Get entity by ID",
        parameters: {
          id: { type: "string", description: "Entity ID", required: true },
        },
      },
      {
        name: "get_entities",
        description: "Query entities by tag/components",
        parameters: {
          tag: { type: "string", description: "Filter by tag", required: false },
          has: { type: "array", description: "Required component types", required: false },
          not: { type: "array", description: "Excluded component types", required: false },
        },
      },
      {
        name: "set_component",
        description: "Set a component on an entity",
        parameters: {
          id: { type: "string", description: "Entity ID", required: true },
          component: { type: "string", description: "Component type", required: true },
          data: { type: "object", description: "Component data", required: true },
        },
      },
      {
        name: "update_component",
        description: "Update a component value by path",
        parameters: {
          id: { type: "string", description: "Entity ID", required: true },
          path: { type: "string", description: "Path (e.g., 'Position.x')", required: true },
          value: { type: "any", description: "New value", required: true },
        },
      },
      {
        name: "remove_component",
        description: "Remove a component from an entity",
        parameters: {
          id: { type: "string", description: "Entity ID", required: true },
          component: { type: "string", description: "Component type", required: true },
        },
      },
      {
        name: "define_template",
        description: "Define an entity template",
        parameters: {
          name: { type: "string", description: "Template name", required: true },
          template: { type: "object", description: "Template definition", required: true },
        },
      },
      {
        name: "get_template",
        description: "Get a template by name",
        parameters: {
          name: { type: "string", description: "Template name", required: true },
        },
      },

      // Expression tools
      {
        name: "evaluate_expression",
        description: "Evaluate a safe expression with context",
        parameters: {
          expression: { type: "string", description: "Expression to evaluate", required: true },
          context: { type: "object", description: "Context variables (entity, rules, time, dt, input, data)", required: false },
        },
      },
      {
        name: "validate_expression",
        description: "Check if an expression is valid and safe",
        parameters: {
          expression: { type: "string", description: "Expression to validate", required: true },
        },
      },

      // Action tools
      {
        name: "execute_action",
        description: "Execute a single action",
        parameters: {
          action: { type: "object", description: "Action to execute", required: true },
          context: { type: "object", description: "Context variables (entity, input, data)", required: false },
        },
      },
      {
        name: "execute_actions",
        description: "Execute a list of actions",
        parameters: {
          actions: { type: "array", description: "Actions to execute", required: true },
          context: { type: "object", description: "Context variables (entity, input, data)", required: false },
        },
      },

      // System tools
      {
        name: "define_system",
        description: "Define a system (query + actions)",
        parameters: {
          system: { type: "object", description: "System definition {name, phase, query, actions}", required: true },
        },
      },
      {
        name: "remove_system",
        description: "Remove a system by name",
        parameters: {
          name: { type: "string", description: "System name", required: true },
        },
      },
      {
        name: "get_system",
        description: "Get a system by name",
        parameters: {
          name: { type: "string", description: "System name", required: true },
        },
      },
      {
        name: "get_systems",
        description: "Get all systems",
        parameters: {},
      },
      {
        name: "run_systems",
        description: "Run all systems (usually called by step())",
        parameters: {
          input: { type: "object", description: "Input state (keyboard, mouse)", required: false },
        },
      },

      // Collision tools
      {
        name: "define_collision",
        description: "Define a collision handler (between layers + emit event)",
        parameters: {
          handler: { type: "object", description: "Collision handler {between: [layerA, layerB], condition?, emit, data?}", required: true },
        },
      },
      {
        name: "remove_collision",
        description: "Remove a collision handler",
        parameters: {
          between: { type: "array", description: "Layer pair [layerA, layerB]", required: true },
        },
      },
      {
        name: "get_collision_handlers",
        description: "Get all collision handlers",
        parameters: {},
      },
      {
        name: "detect_collisions",
        description: "Run collision detection (usually called by step())",
        parameters: {},
      },
      {
        name: "get_collisions_log",
        description: "Get log of current collisions",
        parameters: {},
      },

      // Event tools
      {
        name: "define_event",
        description: "Define an event handler (event name + actions)",
        parameters: {
          event: { type: "string", description: "Event name", required: true },
          actions: { type: "array", description: "Actions to execute when event fires", required: true },
        },
      },
      {
        name: "remove_event",
        description: "Remove an event handler",
        parameters: {
          event: { type: "string", description: "Event name", required: true },
        },
      },
      {
        name: "get_event",
        description: "Get an event handler by name",
        parameters: {
          event: { type: "string", description: "Event name", required: true },
        },
      },
      {
        name: "get_events",
        description: "Get all event handlers",
        parameters: {},
      },
      {
        name: "trigger_event",
        description: "Trigger an event and execute its handler",
        parameters: {
          event: { type: "string", description: "Event name", required: true },
          data: { type: "object", description: "Event data passed to handler", required: false },
        },
      },
      {
        name: "process_events",
        description: "Process multiple events with chaining support",
        parameters: {
          events: { type: "array", description: "Array of {event, data} objects", required: true },
        },
      },
      {
        name: "get_events_log",
        description: "Get log of event handlers",
        parameters: {},
      },

      // Rules tools
      {
        name: "get_rule",
        description: "Get a rule value by path",
        parameters: {
          path: { type: "string", description: "Path (e.g., 'physics.gravity', 'scoring.coinValue')", required: true },
        },
      },
      {
        name: "set_rule",
        description: "Set a rule value by path",
        parameters: {
          path: { type: "string", description: "Path (e.g., 'physics.gravity', 'scoring.coinValue')", required: true },
          value: { type: "any", description: "Value to set", required: true },
        },
      },
      {
        name: "get_rules",
        description: "Get all rules",
        parameters: {},
      },
      {
        name: "get_physics_rules",
        description: "Get physics rules",
        parameters: {},
      },
      {
        name: "get_scoring_rules",
        description: "Get scoring rules",
        parameters: {},
      },
      {
        name: "get_controls",
        description: "Get control key mappings",
        parameters: {},
      },
      {
        name: "set_control",
        description: "Set a control key mapping",
        parameters: {
          action: { type: "string", description: "Action name (e.g., 'jump', 'dash')", required: true },
          key: { type: "string", description: "Key name (e.g., 'Space', 'Shift')", required: true },
        },
      },
      {
        name: "reset_rules",
        description: "Reset all rules to defaults",
        parameters: {},
      },

      // Modes and Screens tools
      {
        name: "set_mode",
        description: "Set the current game mode directly",
        parameters: {
          mode: { type: "string", description: "Mode name", required: true },
        },
      },
      {
        name: "define_transition",
        description: "Define a mode transition rule",
        parameters: {
          from: { type: "string", description: "Source mode", required: true },
          trigger: { type: "string", description: "Trigger name", required: true },
          to: { type: "string", description: "Destination mode", required: true },
        },
      },
      {
        name: "remove_transition",
        description: "Remove a mode transition rule",
        parameters: {
          from: { type: "string", description: "Source mode", required: true },
          trigger: { type: "string", description: "Trigger name", required: true },
        },
      },
      {
        name: "trigger_transition",
        description: "Attempt to trigger a mode transition",
        parameters: {
          trigger: { type: "string", description: "Trigger name", required: true },
        },
      },
      {
        name: "get_transitions",
        description: "Get all mode transitions or transitions from a specific mode",
        parameters: {
          from: { type: "string", description: "Source mode (optional, returns all if omitted)", required: false },
        },
      },
      {
        name: "get_available_triggers",
        description: "Get triggers available from current mode",
        parameters: {},
      },
      {
        name: "get_screen",
        description: "Get a screen configuration",
        parameters: {
          screen: { type: "string", description: "Screen name", required: true },
        },
      },
      {
        name: "set_screen",
        description: "Set a screen configuration",
        parameters: {
          screen: { type: "string", description: "Screen name", required: true },
          config: { type: "object", description: "Screen configuration", required: true },
        },
      },
      {
        name: "update_screen",
        description: "Update a screen property",
        parameters: {
          screen: { type: "string", description: "Screen name", required: true },
          property: { type: "string", description: "Property name", required: true },
          value: { type: "any", description: "Property value", required: true },
        },
      },
      {
        name: "get_screens",
        description: "Get all screen configurations",
        parameters: {},
      },
    ];
  }

  /**
   * Execute a tool call.
   */
  call(toolName: string, args: Record<string, unknown> = {}): ToolResult {
    try {
      switch (toolName) {
        // Simulation tools
        case "step": {
          const frames = (args.frames as number) ?? 1;
          const dt = (args.dt as number) ?? 1 / 60;
          const results = [];
          for (let i = 0; i < frames; i++) {
            results.push(this.engine.step(dt));
          }
          return { success: true, data: results[results.length - 1] };
        }

        case "dump_state": {
          const json = this.engine.dumpState();
          return { success: true, data: JSON.parse(json) };
        }

        case "load_state": {
          const state = args.state as EngineState;
          if (!state) {
            return { success: false, error: "state parameter required" };
          }
          this.engine.loadState(state);
          return { success: true };
        }

        case "query_state": {
          const state = this.engine.getState();
          const path = args.path as string | undefined;
          if (!path) {
            return { success: true, data: state };
          }
          const value = getByPath(state, path);
          return { success: true, data: value };
        }

        case "get_frame": {
          return { success: true, data: this.engine.getFrame() };
        }

        case "get_time": {
          return { success: true, data: this.engine.getTime() };
        }

        case "get_mode": {
          return { success: true, data: this.engine.getMode() };
        }

        // Entity tools
        case "spawn_entity": {
          const template = args.template as string;
          if (!template) {
            return { success: false, error: "template parameter required" };
          }
          const state = this.engine.getStateMutable();
          const entity = spawnEntity(state, template, {
            id: args.id as string | undefined,
            at: args.at as { x: number; y: number } | undefined,
            tags: args.tags as string[] | undefined,
          });
          return { success: true, data: entity };
        }

        case "create_entity": {
          const state = this.engine.getStateMutable();
          const entity = createEntity(state, {
            id: args.id as string | undefined,
            tags: args.tags as string[] | undefined,
            components: args.components as Record<string, ComponentData> | undefined,
          });
          return { success: true, data: entity };
        }

        case "remove_entity": {
          const id = args.id as string;
          if (!id) {
            return { success: false, error: "id parameter required" };
          }
          const state = this.engine.getStateMutable();
          const removed = removeEntity(state, id);
          return { success: removed, error: removed ? undefined : "Entity not found" };
        }

        case "get_entity": {
          const id = args.id as string;
          if (!id) {
            return { success: false, error: "id parameter required" };
          }
          const state = this.engine.getState();
          const entity = getEntity(state, id);
          if (!entity) {
            return { success: false, error: "Entity not found" };
          }
          return { success: true, data: entity };
        }

        case "get_entities": {
          const query: Query = {
            tag: args.tag as string | undefined,
            has: args.has as string[] | undefined,
            not: args.not as string[] | undefined,
          };
          const state = this.engine.getState();
          const entities = getEntities(state, query);
          return { success: true, data: entities };
        }

        case "set_component": {
          const id = args.id as string;
          const component = args.component as string;
          const data = args.data as ComponentData;
          if (!id || !component || data === undefined) {
            return { success: false, error: "id, component, and data parameters required" };
          }
          const state = this.engine.getStateMutable();
          const set = setComponent(state, id, component, data);
          return { success: set, error: set ? undefined : "Entity not found" };
        }

        case "update_component": {
          const id = args.id as string;
          const path = args.path as string;
          const value = args.value;
          if (!id || !path || value === undefined) {
            return { success: false, error: "id, path, and value parameters required" };
          }
          const state = this.engine.getStateMutable();
          const updated = updateComponent(state, id, path, value);
          return { success: updated, error: updated ? undefined : "Entity or path not found" };
        }

        case "remove_component": {
          const id = args.id as string;
          const component = args.component as string;
          if (!id || !component) {
            return { success: false, error: "id and component parameters required" };
          }
          const state = this.engine.getStateMutable();
          const removed = removeComponent(state, id, component);
          return { success: removed, error: removed ? undefined : "Entity or component not found" };
        }

        case "define_template": {
          const name = args.name as string;
          const template = args.template as EntityTemplate;
          if (!name || !template) {
            return { success: false, error: "name and template parameters required" };
          }
          const state = this.engine.getStateMutable();
          defineTemplate(state, name, template);
          return { success: true };
        }

        case "get_template": {
          const name = args.name as string;
          if (!name) {
            return { success: false, error: "name parameter required" };
          }
          const state = this.engine.getState();
          const template = getTemplate(state, name);
          if (!template) {
            return { success: false, error: "Template not found" };
          }
          return { success: true, data: template };
        }

        // Expression tools
        case "evaluate_expression": {
          const expression = args.expression as string;
          if (!expression) {
            return { success: false, error: "expression parameter required" };
          }
          const context = (args.context as ExpressionContext) ?? {};
          // Merge engine state into context if not provided
          const state = this.engine.getState();
          const fullContext: ExpressionContext = {
            rules: state.rules,
            time: state.time,
            dt: 1 / 60,
            ...context,
          };
          const result = evaluate(expression, fullContext);
          return { success: true, data: result };
        }

        case "validate_expression": {
          const expression = args.expression as string;
          if (!expression) {
            return { success: false, error: "expression parameter required" };
          }
          const valid = isValidExpression(expression);
          return { success: true, data: { valid } };
        }

        // Action tools
        case "execute_action": {
          const action = args.action as Action;
          if (!action) {
            return { success: false, error: "action parameter required" };
          }
          const context = (args.context as Partial<ActionContext>) ?? {};
          const state = this.engine.getStateMutable();
          const fullContext: ActionContext = {
            state,
            rules: state.rules,
            time: state.time,
            dt: 1 / 60,
            ...context,
          };
          const result = executeAction(action, fullContext);
          return { success: result.success, data: { eventsEmitted: result.eventsEmitted }, error: result.error };
        }

        case "execute_actions": {
          const actions = args.actions as Action[];
          if (!actions || !Array.isArray(actions)) {
            return { success: false, error: "actions parameter required (array)" };
          }
          const context = (args.context as Partial<ActionContext>) ?? {};
          const state = this.engine.getStateMutable();
          const fullContext: ActionContext = {
            state,
            rules: state.rules,
            time: state.time,
            dt: 1 / 60,
            ...context,
          };
          const result = executeActions(actions, fullContext);
          return { success: result.success, data: { eventsEmitted: result.eventsEmitted }, error: result.error };
        }

        // System tools
        case "define_system": {
          const system = args.system as System;
          if (!system) {
            return { success: false, error: "system parameter required" };
          }
          const state = this.engine.getStateMutable();
          defineSystem(state, system);
          return { success: true };
        }

        case "remove_system": {
          const name = args.name as string;
          if (!name) {
            return { success: false, error: "name parameter required" };
          }
          const state = this.engine.getStateMutable();
          const removed = removeSystem(state, name);
          return { success: removed, error: removed ? undefined : "System not found" };
        }

        case "get_system": {
          const name = args.name as string;
          if (!name) {
            return { success: false, error: "name parameter required" };
          }
          const state = this.engine.getState();
          const system = getSystem(state, name);
          if (!system) {
            return { success: false, error: "System not found" };
          }
          return { success: true, data: system };
        }

        case "get_systems": {
          const state = this.engine.getState();
          return { success: true, data: getSystems(state) };
        }

        case "run_systems": {
          const input = (args.input as Record<string, unknown>) ?? {};
          const state = this.engine.getStateMutable();
          const result = runSystems(state, 1 / 60, input);
          return { success: true, data: result };
        }

        // Collision tools
        case "define_collision": {
          const handler = args.handler as CollisionHandler;
          if (!handler) {
            return { success: false, error: "handler parameter required" };
          }
          const state = this.engine.getStateMutable();
          defineCollision(state, handler);
          return { success: true };
        }

        case "remove_collision": {
          const between = args.between as [string, string];
          if (!between || between.length !== 2) {
            return { success: false, error: "between parameter required ([layerA, layerB])" };
          }
          const state = this.engine.getStateMutable();
          const removed = removeCollision(state, between);
          return { success: removed, error: removed ? undefined : "Collision handler not found" };
        }

        case "get_collision_handlers": {
          const state = this.engine.getState();
          return { success: true, data: getCollisionHandlers(state) };
        }

        case "detect_collisions": {
          const state = this.engine.getStateMutable();
          const result = detectCollisions(state);
          return { success: true, data: result };
        }

        case "get_collisions_log": {
          const state = this.engine.getState();
          return { success: true, data: getCollisionsLog(state) };
        }

        // Event tools
        case "define_event": {
          const event = args.event as string;
          const actions = args.actions as Action[];
          if (!event) {
            return { success: false, error: "event parameter required" };
          }
          if (!actions || !Array.isArray(actions)) {
            return { success: false, error: "actions parameter required (array)" };
          }
          const state = this.engine.getStateMutable();
          defineEvent(state, event, actions);
          return { success: true };
        }

        case "remove_event": {
          const event = args.event as string;
          if (!event) {
            return { success: false, error: "event parameter required" };
          }
          const state = this.engine.getStateMutable();
          const removed = removeEvent(state, event);
          return { success: removed, error: removed ? undefined : "Event handler not found" };
        }

        case "get_event": {
          const event = args.event as string;
          if (!event) {
            return { success: false, error: "event parameter required" };
          }
          const state = this.engine.getState();
          const handler = getEventHandler(state, event);
          if (!handler) {
            return { success: false, error: "Event handler not found" };
          }
          return { success: true, data: handler };
        }

        case "get_events": {
          const state = this.engine.getState();
          return { success: true, data: getEventHandlers(state) };
        }

        case "trigger_event": {
          const event = args.event as string;
          if (!event) {
            return { success: false, error: "event parameter required" };
          }
          const data = args.data as Record<string, unknown> | undefined;
          const state = this.engine.getStateMutable();
          const result = triggerEvent(state, event, data);
          return { success: true, data: result };
        }

        case "process_events": {
          const events = args.events as Array<{ event: string; data?: Record<string, unknown> }>;
          if (!events || !Array.isArray(events)) {
            return { success: false, error: "events parameter required (array)" };
          }
          const state = this.engine.getStateMutable();
          const result = processEvents(state, events);
          return { success: true, data: result };
        }

        case "get_events_log": {
          const state = this.engine.getState();
          return { success: true, data: getEventsLog(state) };
        }

        // Rules tools
        case "get_rule": {
          const path = args.path as string;
          if (!path) {
            return { success: false, error: "path parameter required" };
          }
          const state = this.engine.getState();
          const value = getRule(state, path);
          return { success: true, data: value };
        }

        case "set_rule": {
          const path = args.path as string;
          const value = args.value;
          if (!path) {
            return { success: false, error: "path parameter required" };
          }
          if (value === undefined) {
            return { success: false, error: "value parameter required" };
          }
          const state = this.engine.getStateMutable();
          const success = setRule(state, path, value);
          return { success, error: success ? undefined : "Failed to set rule" };
        }

        case "get_rules": {
          const state = this.engine.getState();
          return { success: true, data: getAllRules(state) };
        }

        case "get_physics_rules": {
          const state = this.engine.getState();
          return { success: true, data: getPhysicsRules(state) };
        }

        case "get_scoring_rules": {
          const state = this.engine.getState();
          return { success: true, data: getScoringRules(state) };
        }

        case "get_controls": {
          const state = this.engine.getState();
          return { success: true, data: getControls(state) };
        }

        case "set_control": {
          const action = args.action as string;
          const key = args.key as string;
          if (!action || !key) {
            return { success: false, error: "action and key parameters required" };
          }
          const state = this.engine.getStateMutable();
          setControl(state, action, key);
          return { success: true };
        }

        case "reset_rules": {
          const state = this.engine.getStateMutable();
          resetRules(state);
          return { success: true };
        }

        // Modes and Screens tools
        case "set_mode": {
          const mode = args.mode as string;
          if (!mode) {
            return { success: false, error: "mode parameter required" };
          }
          const state = this.engine.getStateMutable();
          setMode(state, mode);
          return { success: true };
        }

        case "define_transition": {
          const from = args.from as string;
          const trigger = args.trigger as string;
          const to = args.to as string;
          if (!from || !trigger || !to) {
            return { success: false, error: "from, trigger, and to parameters required" };
          }
          const state = this.engine.getStateMutable();
          defineTransition(state, from, trigger, to);
          return { success: true };
        }

        case "remove_transition": {
          const from = args.from as string;
          const trigger = args.trigger as string;
          if (!from || !trigger) {
            return { success: false, error: "from and trigger parameters required" };
          }
          const state = this.engine.getStateMutable();
          const removed = removeTransition(state, from, trigger);
          return { success: removed, error: removed ? undefined : "Transition not found" };
        }

        case "trigger_transition": {
          const trigger = args.trigger as string;
          if (!trigger) {
            return { success: false, error: "trigger parameter required" };
          }
          const state = this.engine.getStateMutable();
          const triggered = triggerTransition(state, trigger);
          return {
            success: true,
            data: {
              triggered,
              currentMode: getMode(state),
            },
          };
        }

        case "get_transitions": {
          const from = args.from as string | undefined;
          const state = this.engine.getState();
          if (from) {
            return { success: true, data: getTransitionsFrom(state, from) };
          }
          return { success: true, data: getAllTransitions(state) };
        }

        case "get_available_triggers": {
          const state = this.engine.getState();
          return { success: true, data: getAvailableTriggers(state) };
        }

        case "get_screen": {
          const screen = args.screen as string;
          if (!screen) {
            return { success: false, error: "screen parameter required" };
          }
          const state = this.engine.getState();
          const config = getScreen(state, screen);
          if (!config) {
            return { success: false, error: "Screen not found" };
          }
          return { success: true, data: config };
        }

        case "set_screen": {
          const screen = args.screen as string;
          const config = args.config as Record<string, unknown>;
          if (!screen || !config) {
            return { success: false, error: "screen and config parameters required" };
          }
          const state = this.engine.getStateMutable();
          setScreen(state, screen, config);
          return { success: true };
        }

        case "update_screen": {
          const screen = args.screen as string;
          const property = args.property as string;
          const value = args.value;
          if (!screen || !property || value === undefined) {
            return { success: false, error: "screen, property, and value parameters required" };
          }
          const state = this.engine.getStateMutable();
          const updated = updateScreen(state, screen, property, value);
          return { success: updated, error: updated ? undefined : "Screen not found" };
        }

        case "get_screens": {
          const state = this.engine.getState();
          return { success: true, data: getAllScreens(state) };
        }

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj as Record<string, unknown>;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part] as Record<string, unknown>;
  }
  return current;
}
