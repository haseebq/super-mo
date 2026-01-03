/**
 * Systems
 *
 * Systems are data: a query to match entities + actions to run.
 * No code - just data describing behavior.
 */

import { System, EngineState, Action } from "./state.js";
import { getEntities, matchesQuery } from "./entities.js";
import { executeActions, ActionContext } from "./actions.js";

export type SystemPhase = "input" | "update" | "physics" | "collision";

const PHASE_ORDER: SystemPhase[] = ["input", "update", "physics", "collision"];

export interface SystemResult {
  systemName: string;
  entitiesProcessed: number;
  eventsEmitted: string[];
}

export interface RunSystemsResult {
  systemsRun: SystemResult[];
  eventsEmitted: string[];
}

/**
 * Define a new system.
 */
export function defineSystem(state: EngineState, system: System): void {
  // Remove existing system with same name
  state.systems = state.systems.filter((s) => s.name !== system.name);
  state.systems.push(system);
  // Sort by phase order
  state.systems.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
}

/**
 * Remove a system by name.
 */
export function removeSystem(state: EngineState, name: string): boolean {
  const index = state.systems.findIndex((s) => s.name === name);
  if (index === -1) return false;
  state.systems.splice(index, 1);
  return true;
}

/**
 * Get a system by name.
 */
export function getSystem(state: EngineState, name: string): System | undefined {
  return state.systems.find((s) => s.name === name);
}

/**
 * Get all systems.
 */
export function getSystems(state: EngineState): System[] {
  return state.systems;
}

/**
 * Get systems by phase.
 */
export function getSystemsByPhase(state: EngineState, phase: SystemPhase): System[] {
  return state.systems.filter((s) => s.phase === phase);
}

/**
 * Run a single system on all matching entities.
 */
export function runSystem(
  state: EngineState,
  system: System,
  dt: number,
  input: Record<string, unknown> = {}
): SystemResult {
  const result: SystemResult = {
    systemName: system.name,
    entitiesProcessed: 0,
    eventsEmitted: [],
  };

  // Find entities matching the query
  const entities = getEntities(state, system.query);

  // Execute actions on each entity
  for (const entity of entities) {
    const context: ActionContext = {
      state,
      entity: entity.components,
      rules: state.rules,
      time: state.time,
      dt,
      input,
      data: { entity },
    };

    const actionResult = executeActions(system.actions, context);
    result.eventsEmitted.push(...actionResult.eventsEmitted);
    result.entitiesProcessed++;
  }

  return result;
}

/**
 * Run all systems in phase order.
 */
export function runSystems(
  state: EngineState,
  dt: number,
  input: Record<string, unknown> = {}
): RunSystemsResult {
  const result: RunSystemsResult = {
    systemsRun: [],
    eventsEmitted: [],
  };

  for (const phase of PHASE_ORDER) {
    const phaseSystems = getSystemsByPhase(state, phase);
    for (const system of phaseSystems) {
      const systemResult = runSystem(state, system, dt, input);
      result.systemsRun.push(systemResult);
      result.eventsEmitted.push(...systemResult.eventsEmitted);
    }
  }

  return result;
}

/**
 * Run systems for a specific phase only.
 */
export function runSystemsForPhase(
  state: EngineState,
  phase: SystemPhase,
  dt: number,
  input: Record<string, unknown> = {}
): RunSystemsResult {
  const result: RunSystemsResult = {
    systemsRun: [],
    eventsEmitted: [],
  };

  const systems = getSystemsByPhase(state, phase);
  for (const system of systems) {
    const systemResult = runSystem(state, system, dt, input);
    result.systemsRun.push(systemResult);
    result.eventsEmitted.push(...systemResult.eventsEmitted);
  }

  return result;
}
