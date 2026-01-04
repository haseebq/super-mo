/**
 * Canvas2D Renderer
 *
 * Visual rendering to an HTML5 Canvas using the 2D context.
 * Draws entities, level tiles, and UI screens based on engine state.
 */

import { EngineState, Entity } from "../engine/state.js";
import { Renderer, EntityRenderInfo, ScreenRenderInfo } from "./index.js";

/**
 * Camera/viewport configuration.
 */
export interface Camera {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Color palette for different entity types.
 */
const ENTITY_COLORS: Record<string, string> = {
  player: "#4a90d9",
  enemy: "#d94a4a",
  coin: "#ffd700",
  platform: "#8b4513",
  solid: "#555555",
  goal: "#00ff00",
  default: "#888888",
};

/**
 * Tile colors for level rendering.
 */
const TILE_COLORS: Record<number, string> = {
  0: "transparent",
  1: "#6b4423", // Solid ground
  2: "#8b5a2b", // Platform
  3: "#4a9", // Grass
  4: "#888", // Stone
};

/**
 * Screen colors and styles.
 */
const SCREEN_STYLES = {
  background: "rgba(0, 0, 0, 0.85)",
  titleColor: "#ffffff",
  textColor: "#cccccc",
  promptColor: "#88ccff",
};

/**
 * Canvas2D renderer implementation.
 */
export class Canvas2DRenderer implements Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private tileSize: number;

  constructor(
    canvas: HTMLCanvasElement,
    options: {
      tileSize?: number;
    } = {}
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from canvas");
    }
    this.ctx = ctx;
    this.tileSize = options.tileSize ?? 16;

    // Initialize camera to match canvas size
    this.camera = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      scale: 1,
    };

    // Configure context defaults
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Render the engine state to the canvas.
   */
  render(state: EngineState): void {
    const { ctx, canvas } = this;

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Apply camera transform
    ctx.translate(-this.camera.x * this.camera.scale, -this.camera.y * this.camera.scale);
    ctx.scale(this.camera.scale, this.camera.scale);

    // Render level tiles (background layer)
    this.renderLevel(state);

    // Render entities
    this.renderEntities(state);

    // Restore context
    ctx.restore();

    // Render UI overlay (not affected by camera)
    this.renderUI(state);
  }

  /**
   * Render level tiles.
   */
  private renderLevel(state: EngineState): void {
    const { ctx } = this;
    const { level } = state;

    if (!level.tiles || level.tiles.length === 0) return;

    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const tile = level.tiles[y]?.[x];
        if (tile && tile !== 0) {
          const color = TILE_COLORS[tile] ?? TILE_COLORS[1];
          ctx.fillStyle = color;
          ctx.fillRect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize
          );
        }
      }
    }
  }

  /**
   * Render all entities.
   */
  private renderEntities(state: EngineState): void {
    // Sort entities by y position for proper layering
    const sortedEntities = [...state.entities].sort((a, b) => {
      const aPos = a.components.Position as { y?: number } | undefined;
      const bPos = b.components.Position as { y?: number } | undefined;
      return (aPos?.y ?? 0) - (bPos?.y ?? 0);
    });

    for (const entity of sortedEntities) {
      this.renderEntity(entity);
    }
  }

  /**
   * Render a single entity.
   */
  private renderEntity(entity: Entity): void {
    const { ctx } = this;
    const position = entity.components.Position as { x?: number; y?: number } | undefined;
    if (!position || position.x === undefined || position.y === undefined) {
      return; // Can't render without position
    }

    // Get size from Collider or Sprite, or use default
    const collider = entity.components.Collider as { width?: number; height?: number } | undefined;
    const sprite = entity.components.Sprite as { width?: number; height?: number; sheet?: string } | undefined;

    const width = collider?.width ?? sprite?.width ?? 16;
    const height = collider?.height ?? sprite?.height ?? 16;

    // Determine color based on tags
    let color = ENTITY_COLORS.default;
    for (const tag of entity.tags) {
      if (ENTITY_COLORS[tag]) {
        color = ENTITY_COLORS[tag];
        break;
      }
    }

    // Draw entity as a rectangle with rounded corners
    ctx.fillStyle = color;
    this.roundRect(position.x, position.y, width, height, 2);

    // Draw entity ID for debugging (small text)
    ctx.fillStyle = "#ffffff";
    ctx.font = "6px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      entity.id.substring(0, 8),
      position.x + width / 2,
      position.y + height + 8
    );
  }

  /**
   * Draw a rounded rectangle.
   */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render UI based on current mode.
   */
  private renderUI(state: EngineState): void {
    const mode = state.modes.current;

    // Only render overlay for non-playing modes
    if (mode === "playing") {
      this.renderHUD(state);
      return;
    }

    // Render screen overlay
    this.renderScreenOverlay(state, mode);
  }

  /**
   * Render in-game HUD.
   */
  private renderHUD(state: EngineState): void {
    const { ctx, canvas } = this;

    // Find player for stats
    const player = state.entities.find(e => e.tags.includes("player"));
    const stats = player?.components.Stats as { score?: number; coins?: number } | undefined;
    const health = player?.components.Health as { lives?: number } | undefined;

    // Draw HUD background bar
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, 16);

    // Draw HUD text
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Lives: ${health?.lives ?? 3}`, 5, 11);
    ctx.fillText(`Coins: ${stats?.coins ?? 0}`, 70, 11);

    ctx.textAlign = "right";
    ctx.fillText(`Score: ${stats?.score ?? 0}`, canvas.width - 5, 11);
  }

  /**
   * Render a screen overlay (title, intro, complete, etc.)
   */
  private renderScreenOverlay(state: EngineState, mode: string): void {
    const { ctx, canvas } = this;

    // Draw semi-transparent background
    ctx.fillStyle = SCREEN_STYLES.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get screen config
    const screenType = this.getScreenTypeForMode(mode);
    const screens = state.screens as Record<string, Record<string, unknown>>;
    const config = screens[screenType];

    if (!config) {
      // Fallback for unknown screens
      ctx.fillStyle = SCREEN_STYLES.titleColor;
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(mode.toUpperCase(), canvas.width / 2, canvas.height / 2);
      return;
    }

    // Render based on screen type
    switch (screenType) {
      case "title":
        this.renderTitleScreen(config);
        break;
      case "intro":
        this.renderIntroScreen(config);
        break;
      case "complete":
        this.renderCompleteScreen(config, mode);
        break;
      default:
        this.renderGenericScreen(config, mode);
    }
  }

  /**
   * Map mode to screen type.
   */
  private getScreenTypeForMode(mode: string): string {
    const mapping: Record<string, string> = {
      title: "title",
      intro: "intro",
      complete: "complete",
      gameover: "complete",
      paused: "paused",
    };
    return mapping[mode] ?? mode;
  }

  /**
   * Render title screen.
   */
  private renderTitleScreen(config: Record<string, unknown>): void {
    const { ctx, canvas } = this;
    const text = (config.text as string) ?? "Game";
    const prompt = (config.prompt as string) ?? "Press Enter to Start";

    // Title
    ctx.fillStyle = SCREEN_STYLES.titleColor;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 20);

    // Prompt
    ctx.fillStyle = SCREEN_STYLES.promptColor;
    ctx.font = "12px sans-serif";
    ctx.fillText(prompt, canvas.width / 2, canvas.height / 2 + 20);
  }

  /**
   * Render intro/level start screen.
   */
  private renderIntroScreen(config: Record<string, unknown>): void {
    const { ctx, canvas } = this;
    const title = (config.title as string) ?? "Level";
    const goal = (config.goal as string) ?? "";

    // Title
    ctx.fillStyle = SCREEN_STYLES.titleColor;
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 15);

    // Goal
    if (goal) {
      ctx.fillStyle = SCREEN_STYLES.textColor;
      ctx.font = "12px sans-serif";
      ctx.fillText(goal, canvas.width / 2, canvas.height / 2 + 10);
    }

    // Prompt
    ctx.fillStyle = SCREEN_STYLES.promptColor;
    ctx.font = "10px sans-serif";
    ctx.fillText("Press Enter to Start", canvas.width / 2, canvas.height / 2 + 35);
  }

  /**
   * Render complete/gameover screen.
   */
  private renderCompleteScreen(config: Record<string, unknown>, mode: string): void {
    const { ctx, canvas } = this;
    const message = (config.message as string) ?? (mode === "gameover" ? "Game Over" : "Complete!");

    // Title
    ctx.fillStyle = mode === "gameover" ? "#ff6666" : "#66ff66";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 10);

    // Prompt
    ctx.fillStyle = SCREEN_STYLES.promptColor;
    ctx.font = "10px sans-serif";
    ctx.fillText("Press Enter to Continue", canvas.width / 2, canvas.height / 2 + 20);
  }

  /**
   * Render generic screen (fallback).
   */
  private renderGenericScreen(config: Record<string, unknown>, mode: string): void {
    const { ctx, canvas } = this;

    ctx.fillStyle = SCREEN_STYLES.titleColor;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mode.toUpperCase(), canvas.width / 2, canvas.height / 2);
  }

  /**
   * Set camera position.
   */
  setCamera(x: number, y: number): void {
    this.camera.x = x;
    this.camera.y = y;
  }

  /**
   * Set camera to follow an entity.
   */
  followEntity(entity: Entity): void {
    const position = entity.components.Position as { x?: number; y?: number } | undefined;
    if (!position || position.x === undefined || position.y === undefined) return;

    // Center camera on entity
    this.camera.x = position.x - this.camera.width / 2;
    this.camera.y = position.y - this.camera.height / 2;
  }

  /**
   * Set camera scale (zoom).
   */
  setScale(scale: number): void {
    this.camera.scale = Math.max(0.1, Math.min(10, scale));
  }

  /**
   * Get current camera state.
   */
  getCamera(): Camera {
    return { ...this.camera };
  }

  /**
   * Get canvas dimensions.
   */
  getDimensions(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  /**
   * Clean up renderer resources.
   */
  destroy(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

/**
 * Create a Canvas2D renderer for an existing canvas element.
 */
export function createCanvas2DRenderer(
  canvas: HTMLCanvasElement,
  options?: { tileSize?: number }
): Canvas2DRenderer {
  return new Canvas2DRenderer(canvas, options);
}

/**
 * Create a Canvas2D renderer by finding a canvas by ID.
 */
export function createCanvas2DRendererById(
  canvasId: string,
  options?: { tileSize?: number }
): Canvas2DRenderer {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error(`Canvas element with id "${canvasId}" not found`);
  }
  return new Canvas2DRenderer(canvas, options);
}
