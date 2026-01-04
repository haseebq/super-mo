/**
 * Representation Engine
 *
 * Swappable rendering backends for the pure data engine.
 * See docs/ai-first-engine.md for architecture.
 */

import { EngineState, Entity } from "../engine/state.js";

/**
 * Render log entry for testing/debugging.
 */
export interface RenderLogEntry {
  type: "entity" | "screen" | "hud" | "level";
  data: unknown;
}

/**
 * Entity render info extracted from state.
 */
export interface EntityRenderInfo {
  id: string;
  tags: string[];
  position?: { x: number; y: number };
  sprite?: {
    sheet?: string;
    animation?: string;
    frame?: number;
  };
  collider?: {
    width: number;
    height: number;
  };
}

/**
 * Screen render info based on current mode.
 */
export interface ScreenRenderInfo {
  mode: string;
  screenType: string;
  config: Record<string, unknown>;
}

/**
 * Renderer interface - all renderers must implement this.
 */
export interface Renderer {
  /**
   * Render the current engine state.
   */
  render(state: EngineState): void;

  /**
   * Clean up renderer resources.
   */
  destroy?(): void;
}

/**
 * Extended renderer that provides a render log for testing.
 */
export interface TestableRenderer extends Renderer {
  /**
   * Get the log of what was rendered.
   */
  getRenderLog(): RenderLogEntry[];

  /**
   * Clear the render log.
   */
  clearRenderLog(): void;

  /**
   * Get entities that were rendered.
   */
  getRenderedEntities(): EntityRenderInfo[];

  /**
   * Get the screen that was rendered (if any).
   */
  getRenderedScreen(): ScreenRenderInfo | null;
}

export * from "./headless.js";
