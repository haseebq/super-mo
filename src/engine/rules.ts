/**
 * Rules System
 *
 * Configurable game rules as data: physics, scoring, controls.
 * All values accessible via path-based getters/setters.
 */

import { EngineState } from "./state.js";

export interface RulesPhysics {
  gravity: number;
  friction: number;
  moveSpeed: number;
  jumpImpulse: number;
}

export interface RulesScoring {
  coinValue: number;
  enemyKillBonus: number;
}

export interface Rules {
  physics: RulesPhysics;
  scoring: RulesScoring;
  controls: Record<string, string>;
}

/**
 * Get a rule value by path.
 * Path format: "physics.gravity", "scoring.coinValue", "controls.jump"
 */
export function getRule(state: EngineState, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = state.rules;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a rule value by path.
 * Path format: "physics.gravity", "scoring.coinValue", "controls.jump"
 * Creates intermediate objects if needed.
 */
export function setRule(state: EngineState, path: string, value: unknown): boolean {
  const parts = path.split(".");
  if (parts.length === 0) return false;

  let current: Record<string, unknown> = state.rules as unknown as Record<string, unknown>;

  // Navigate to the parent of the target
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    const next = current[part];
    if (typeof next !== "object" || next === null) {
      return false;
    }
    current = next as Record<string, unknown>;
  }

  // Set the value
  current[parts[parts.length - 1]] = value;
  return true;
}

/**
 * Get all rules.
 */
export function getAllRules(state: EngineState): Rules {
  return state.rules;
}

/**
 * Get physics rules.
 */
export function getPhysicsRules(state: EngineState): RulesPhysics {
  return state.rules.physics;
}

/**
 * Get scoring rules.
 */
export function getScoringRules(state: EngineState): RulesScoring {
  return state.rules.scoring;
}

/**
 * Get control mappings.
 */
export function getControls(state: EngineState): Record<string, string> {
  return state.rules.controls;
}

/**
 * Set a control mapping.
 */
export function setControl(state: EngineState, action: string, key: string): void {
  state.rules.controls[action] = key;
}

/**
 * Get a control mapping.
 */
export function getControl(state: EngineState, action: string): string | undefined {
  return state.rules.controls[action];
}

/**
 * Reset rules to defaults.
 */
export function resetRules(state: EngineState): void {
  state.rules = {
    physics: {
      gravity: 980,
      friction: 0.9,
      moveSpeed: 150,
      jumpImpulse: 300,
    },
    scoring: {
      coinValue: 100,
      enemyKillBonus: 200,
    },
    controls: {},
  };
}
