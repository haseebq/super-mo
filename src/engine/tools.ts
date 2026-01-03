/**
 * Tool Interface
 *
 * All engine operations are exposed as tools.
 * AI controls engine exclusively via tool calls.
 * Tests use the same interface.
 */

import { GameEngine } from "./engine.js";
import { EngineState } from "./state.js";

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
    ];
  }

  /**
   * Execute a tool call.
   */
  call(toolName: string, args: Record<string, unknown> = {}): ToolResult {
    try {
      switch (toolName) {
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
