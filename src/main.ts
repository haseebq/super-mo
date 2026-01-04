/**
 * Super Mo - AI-First Game Engine
 *
 * Phase 1: Engine Core
 * GameEngine with step() and state management.
 */

import { GameEngine, ToolExecutor, EngineState } from "./engine/index.js";
import {
  HeadlessRenderer,
  createHeadlessRenderer,
  Canvas2DRenderer,
  createCanvas2DRenderer,
  createCanvas2DRendererById,
} from "./representation/index.js";

const engine = new GameEngine();
const tools = new ToolExecutor(engine);

// Expose for testing (tools interface - same as AI would use)
declare global {
  interface Window {
    __SUPER_MO__: {
      engine: GameEngine;
      tools: ToolExecutor;
      state: EngineState;
      createHeadlessRenderer: typeof createHeadlessRenderer;
      createCanvas2DRenderer: typeof createCanvas2DRenderer;
      createCanvas2DRendererById: typeof createCanvas2DRendererById;
    };
    __RENDERER_READY__: boolean;
  }
}

window.__SUPER_MO__ = {
  engine,
  tools,
  get state() {
    return engine.getState();
  },
  createHeadlessRenderer,
  createCanvas2DRenderer,
  createCanvas2DRendererById,
};
window.__RENDERER_READY__ = true;

// Update title screen
const startOverlay = document.querySelector(".start-overlay h1");
if (startOverlay) {
  startOverlay.textContent = "Super Mo (Engine v1)";
}

console.log("AI-First Engine v1 initialized");
console.log("Available tools:", tools.getTools().map((t) => t.name));
