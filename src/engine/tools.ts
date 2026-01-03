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
