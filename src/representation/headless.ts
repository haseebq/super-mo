/**
 * Headless Renderer
 *
 * A test renderer that logs what would be drawn without actually rendering.
 * Useful for testing game logic without visual output.
 */

import { EngineState, Entity } from "../engine/state.js";
import {
  TestableRenderer,
  RenderLogEntry,
  EntityRenderInfo,
  ScreenRenderInfo,
} from "./index.js";

/**
 * Mode to screen type mapping.
 * Determines which screen configuration to use for each mode.
 */
const MODE_SCREEN_MAP: Record<string, string> = {
  title: "title",
  intro: "intro",
  complete: "complete",
  gameover: "complete", // Reuse complete screen for gameover
  paused: "playing", // Paused still shows game (with overlay)
  playing: "playing", // No screen overlay during play
};

/**
 * Headless renderer implementation.
 * Logs all render operations for testing and debugging.
 */
export class HeadlessRenderer implements TestableRenderer {
  private renderLog: RenderLogEntry[] = [];
  private renderedEntities: EntityRenderInfo[] = [];
  private renderedScreen: ScreenRenderInfo | null = null;
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  /**
   * Render the engine state, logging what would be drawn.
   */
  render(state: EngineState): void {
    // Clear previous render
    this.clearRenderLog();

    // Determine what to render based on mode
    const mode = state.modes.current;
    const screenType = MODE_SCREEN_MAP[mode] || mode;

    // Render screen overlay if not in playing mode
    if (mode !== "playing") {
      this.renderScreen(state, mode, screenType);
    }

    // Always log entities (they're still there, just might be obscured)
    this.renderEntities(state);

    // Log level if present
    if (state.level.tiles.length > 0) {
      this.renderLevel(state);
    }

    // Log HUD info
    this.renderHUD(state);

    if (this.verbose) {
      console.log(`[HeadlessRenderer] Rendered frame ${state.frame}:`);
      console.log(`  Mode: ${mode}`);
      console.log(`  Entities: ${this.renderedEntities.length}`);
      if (this.renderedScreen) {
        console.log(`  Screen: ${this.renderedScreen.screenType}`);
      }
    }
  }

  /**
   * Render screen overlay (title, intro, etc.)
   */
  private renderScreen(state: EngineState, mode: string, screenType: string): void {
    const screens = state.screens as Record<string, Record<string, unknown>>;
    const screenConfig = screens[screenType];

    if (screenConfig) {
      this.renderedScreen = {
        mode,
        screenType,
        config: { ...screenConfig },
      };

      this.renderLog.push({
        type: "screen",
        data: this.renderedScreen,
      });
    }
  }

  /**
   * Render entities with position/sprite components.
   */
  private renderEntities(state: EngineState): void {
    for (const entity of state.entities) {
      const info = this.extractEntityRenderInfo(entity);
      this.renderedEntities.push(info);

      this.renderLog.push({
        type: "entity",
        data: info,
      });
    }
  }

  /**
   * Extract render-relevant info from an entity.
   */
  private extractEntityRenderInfo(entity: Entity): EntityRenderInfo {
    const info: EntityRenderInfo = {
      id: entity.id,
      tags: [...entity.tags],
    };

    // Extract Position component
    const position = entity.components.Position as { x?: number; y?: number } | undefined;
    if (position && typeof position.x === "number" && typeof position.y === "number") {
      info.position = { x: position.x, y: position.y };
    }

    // Extract Sprite component
    const sprite = entity.components.Sprite as {
      sheet?: string;
      animation?: string;
      frame?: number;
    } | undefined;
    if (sprite) {
      info.sprite = {
        sheet: sprite.sheet,
        animation: sprite.animation,
        frame: sprite.frame,
      };
    }

    // Extract Collider component (for debug rendering)
    const collider = entity.components.Collider as {
      width?: number;
      height?: number;
    } | undefined;
    if (collider && typeof collider.width === "number" && typeof collider.height === "number") {
      info.collider = { width: collider.width, height: collider.height };
    }

    return info;
  }

  /**
   * Render level tiles.
   */
  private renderLevel(state: EngineState): void {
    this.renderLog.push({
      type: "level",
      data: {
        width: state.level.width,
        height: state.level.height,
        tileCount: state.level.tiles.flat().filter(t => t !== 0).length,
      },
    });
  }

  /**
   * Render HUD information.
   */
  private renderHUD(state: EngineState): void {
    // Extract HUD-relevant info from player entity
    const player = state.entities.find(e => e.tags.includes("player"));

    const hudData: Record<string, unknown> = {
      frame: state.frame,
      time: state.time,
      mode: state.modes.current,
    };

    if (player) {
      const stats = player.components.Stats as { score?: number; coins?: number } | undefined;
      const health = player.components.Health as { lives?: number } | undefined;

      if (stats) {
        hudData.score = stats.score ?? 0;
        hudData.coins = stats.coins ?? 0;
      }
      if (health) {
        hudData.lives = health.lives ?? 0;
      }
    }

    this.renderLog.push({
      type: "hud",
      data: hudData,
    });
  }

  /**
   * Get the complete render log.
   */
  getRenderLog(): RenderLogEntry[] {
    return [...this.renderLog];
  }

  /**
   * Clear the render log.
   */
  clearRenderLog(): void {
    this.renderLog = [];
    this.renderedEntities = [];
    this.renderedScreen = null;
  }

  /**
   * Get entities that were rendered.
   */
  getRenderedEntities(): EntityRenderInfo[] {
    return [...this.renderedEntities];
  }

  /**
   * Get the screen that was rendered (if any).
   */
  getRenderedScreen(): ScreenRenderInfo | null {
    return this.renderedScreen ? { ...this.renderedScreen } : null;
  }

  /**
   * Get render log entries of a specific type.
   */
  getLogEntriesOfType(type: RenderLogEntry["type"]): RenderLogEntry[] {
    return this.renderLog.filter(entry => entry.type === type);
  }

  /**
   * Check if a specific entity was rendered.
   */
  wasEntityRendered(entityId: string): boolean {
    return this.renderedEntities.some(e => e.id === entityId);
  }

  /**
   * Check if a specific screen was rendered.
   */
  wasScreenRendered(screenType: string): boolean {
    return this.renderedScreen?.screenType === screenType;
  }

  /**
   * Get the last render summary.
   */
  getSummary(): {
    entityCount: number;
    screen: string | null;
    mode: string;
    frame: number;
  } {
    const hudEntry = this.renderLog.find(e => e.type === "hud");
    const hudData = hudEntry?.data as { mode?: string; frame?: number } | undefined;

    return {
      entityCount: this.renderedEntities.length,
      screen: this.renderedScreen?.screenType ?? null,
      mode: hudData?.mode ?? "unknown",
      frame: hudData?.frame ?? 0,
    };
  }

  /**
   * Clean up (no-op for headless).
   */
  destroy(): void {
    this.clearRenderLog();
  }
}

/**
 * Create a new headless renderer.
 */
export function createHeadlessRenderer(options?: { verbose?: boolean }): HeadlessRenderer {
  return new HeadlessRenderer(options);
}
