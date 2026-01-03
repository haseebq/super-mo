/**
 * Modes System
 *
 * Mode state machine and screen configurations as data.
 * All UI flow controlled via transitions.
 */

import { EngineState } from "./state.js";

export interface ScreenConfig {
  [key: string]: unknown;
}

export interface ModeTransition {
  from: string;
  trigger: string;
  to: string;
}

/**
 * Get current mode.
 */
export function getMode(state: EngineState): string {
  return state.modes.current;
}

/**
 * Set current mode directly.
 */
export function setMode(state: EngineState, mode: string): void {
  state.modes.current = mode;
}

/**
 * Define a mode transition.
 * When in mode 'from', trigger 'trigger' transitions to mode 'to'.
 */
export function defineTransition(
  state: EngineState,
  from: string,
  trigger: string,
  to: string
): void {
  if (!state.modes.transitions[from]) {
    state.modes.transitions[from] = {};
  }
  state.modes.transitions[from][trigger] = to;
}

/**
 * Remove a mode transition.
 */
export function removeTransition(
  state: EngineState,
  from: string,
  trigger: string
): boolean {
  if (!state.modes.transitions[from]) {
    return false;
  }
  if (!(trigger in state.modes.transitions[from])) {
    return false;
  }
  delete state.modes.transitions[from][trigger];
  return true;
}

/**
 * Attempt to trigger a transition from the current mode.
 * Returns true if transition occurred, false otherwise.
 */
export function triggerTransition(state: EngineState, trigger: string): boolean {
  const currentMode = state.modes.current;
  const transitions = state.modes.transitions[currentMode];

  if (!transitions || !(trigger in transitions)) {
    return false;
  }

  state.modes.current = transitions[trigger];
  return true;
}

/**
 * Get all transitions from a specific mode.
 */
export function getTransitionsFrom(
  state: EngineState,
  from: string
): Record<string, string> {
  return state.modes.transitions[from] ?? {};
}

/**
 * Get all transitions.
 */
export function getAllTransitions(
  state: EngineState
): Record<string, Record<string, string>> {
  return state.modes.transitions;
}

/**
 * Get a screen configuration.
 */
export function getScreen(
  state: EngineState,
  screenName: string
): ScreenConfig | undefined {
  const screens = state.screens as Record<string, ScreenConfig>;
  return screens[screenName];
}

/**
 * Set a screen configuration.
 */
export function setScreen(
  state: EngineState,
  screenName: string,
  config: ScreenConfig
): void {
  const screens = state.screens as Record<string, ScreenConfig>;
  screens[screenName] = config;
}

/**
 * Update a screen property.
 */
export function updateScreen(
  state: EngineState,
  screenName: string,
  property: string,
  value: unknown
): boolean {
  const screens = state.screens as Record<string, ScreenConfig>;
  if (!screens[screenName]) {
    return false;
  }
  screens[screenName][property] = value;
  return true;
}

/**
 * Get all screens.
 */
export function getAllScreens(state: EngineState): Record<string, ScreenConfig> {
  return state.screens as Record<string, ScreenConfig>;
}

/**
 * Get available triggers from current mode.
 */
export function getAvailableTriggers(state: EngineState): string[] {
  const transitions = state.modes.transitions[state.modes.current];
  return transitions ? Object.keys(transitions) : [];
}
