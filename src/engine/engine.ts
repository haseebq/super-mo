/**
 * Game Engine
 *
 * Pure data engine that advances simulation state.
 * All operations are deterministic: same input = same output.
 */

import {
  EngineState,
  createInitialState,
  cloneState,
} from "./state.js";
import { runSystems } from "./systems.js";

export interface StepResult {
  frame: number;
  time: number;
  eventsEmitted: string[];
  systemsRun: number;
}

export interface StepInput {
  horizontal?: number;
  vertical?: number;
  jump?: boolean;
  dash?: boolean;
  [key: string]: unknown;
}

export class GameEngine {
  private state: EngineState;

  constructor(initialState?: EngineState) {
    this.state = initialState ? cloneState(initialState) : createInitialState();
  }

  /**
   * Advance simulation by dt seconds.
   * Returns info about what happened during the step.
   */
  step(dt: number, input: StepInput = {}): StepResult {
    this.state.frame += 1;
    this.state.time += dt;

    // Run all systems in phase order
    const systemsResult = runSystems(this.state, dt, input);

    // Future phases will add:
    // - Collision detection (Phase 6)
    // - Event handling (Phase 7)

    return {
      frame: this.state.frame,
      time: this.state.time,
      eventsEmitted: systemsResult.eventsEmitted,
      systemsRun: systemsResult.systemsRun.length,
    };
  }

  /**
   * Get current state (deep clone for safety).
   */
  getState(): EngineState {
    return cloneState(this.state);
  }

  /**
   * Replace entire state (for load_state tool).
   */
  loadState(newState: EngineState): void {
    this.state = cloneState(newState);
  }

  /**
   * Dump state as JSON string (for dump_state tool).
   */
  dumpState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Load state from JSON string.
   */
  loadStateFromJSON(json: string): void {
    this.state = JSON.parse(json) as EngineState;
  }

  /**
   * Get current mode.
   */
  getMode(): string {
    return this.state.modes.current;
  }

  /**
   * Get frame count.
   */
  getFrame(): number {
    return this.state.frame;
  }

  /**
   * Get simulation time.
   */
  getTime(): number {
    return this.state.time;
  }

  /**
   * Get mutable state reference (for entity operations).
   * Use with care - mutations affect engine state directly.
   */
  getStateMutable(): EngineState {
    return this.state;
  }
}
