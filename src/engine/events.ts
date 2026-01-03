/**
 * Event System
 *
 * Event handlers as data: event name + action list.
 * Supports event chaining (emit within handler).
 */

import { Action, EngineState } from "./state.js";
import { executeActions, ActionContext } from "./actions.js";

export interface EventHandler {
  event: string;
  actions: Action[];
}

export interface EventLog {
  event: string;
  triggered: boolean;
  actionsExecuted: number;
  eventsEmitted: string[];
}

export interface ProcessEventsResult {
  eventsProcessed: EventLog[];
  totalActionsExecuted: number;
}

/**
 * Define an event handler.
 */
export function defineEvent(state: EngineState, event: string, actions: Action[]): void {
  state.events[event] = actions;
}

/**
 * Remove an event handler.
 */
export function removeEvent(state: EngineState, event: string): boolean {
  if (event in state.events) {
    delete state.events[event];
    return true;
  }
  return false;
}

/**
 * Get all event handlers.
 */
export function getEventHandlers(state: EngineState): EventHandler[] {
  return Object.entries(state.events).map(([event, actions]) => ({
    event,
    actions,
  }));
}

/**
 * Get handler for a specific event.
 */
export function getEventHandler(state: EngineState, event: string): EventHandler | null {
  if (event in state.events) {
    return { event, actions: state.events[event] };
  }
  return null;
}

/**
 * Trigger an event and execute its handler.
 * Returns info about what was executed and any chained events.
 */
export function triggerEvent(
  state: EngineState,
  event: string,
  data?: Record<string, unknown>
): EventLog {
  const log: EventLog = {
    event,
    triggered: false,
    actionsExecuted: 0,
    eventsEmitted: [],
  };

  const actions = state.events[event];
  if (!actions || actions.length === 0) {
    return log;
  }

  log.triggered = true;
  log.actionsExecuted = actions.length;

  // Create action context with event data
  const context: ActionContext = {
    state,
    entity: {},
    rules: state.rules,
    time: state.time,
    dt: 1 / 60,
    data: data ?? {},
  };

  const result = executeActions(actions, context);
  log.eventsEmitted = result.eventsEmitted;

  return log;
}

/**
 * Process a list of events (with chaining support).
 * Processes events in a queue to handle chains properly.
 * Limits iterations to prevent infinite loops.
 */
export function processEvents(
  state: EngineState,
  events: Array<{ event: string; data?: Record<string, unknown> }>,
  maxIterations: number = 100
): ProcessEventsResult {
  const result: ProcessEventsResult = {
    eventsProcessed: [],
    totalActionsExecuted: 0,
  };

  // Use a queue for event chaining
  const queue = [...events];
  let iterations = 0;

  while (queue.length > 0 && iterations < maxIterations) {
    const { event, data } = queue.shift()!;
    iterations++;

    const log = triggerEvent(state, event, data);
    result.eventsProcessed.push(log);
    result.totalActionsExecuted += log.actionsExecuted;

    // Queue any emitted events for chaining
    for (const emittedEvent of log.eventsEmitted) {
      queue.push({ event: emittedEvent, data });
    }
  }

  return result;
}

/**
 * Get a simple log of event handlers.
 */
export function getEventsLog(state: EngineState): Array<{
  event: string;
  actionCount: number;
}> {
  return Object.entries(state.events).map(([event, actions]) => ({
    event,
    actionCount: actions.length,
  }));
}
