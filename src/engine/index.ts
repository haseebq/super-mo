/**
 * AI-First Game Engine
 *
 * Pure data engine with tool-based interface.
 * See docs/ai-first-engine.md for architecture.
 */

export interface EngineState {
  frame: number;
  time: number;
}

export function createInitialState(): EngineState {
  return {
    frame: 0,
    time: 0,
  };
}
