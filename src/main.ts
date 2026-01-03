/**
 * Super Mo - AI-First Game Engine
 *
 * Phase 0: Foundation stub
 * This will be replaced as we implement the engine.
 */

import { createInitialState } from "./engine/index.js";

const state = createInitialState();

// Expose for testing
declare global {
  interface Window {
    __SUPER_MO__: { state: typeof state };
    __RENDERER_READY__: boolean;
  }
}

window.__SUPER_MO__ = { state };
window.__RENDERER_READY__ = true;

// Update title screen to show engine is loading
const startOverlay = document.querySelector(".start-overlay h1");
if (startOverlay) {
  startOverlay.textContent = "Super Mo (Engine v0)";
}

console.log("AI-First Engine initialized", state);
