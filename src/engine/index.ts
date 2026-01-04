/**
 * AI-First Game Engine
 *
 * Pure data engine with tool-based interface.
 * See docs/ai-first-engine.md for architecture.
 */

export * from "./state.js";
export * from "./engine.js";
export * from "./entities.js";
export * from "./expressions.js";
export * from "./actions.js";
export * from "./systems.js";
export * from "./collisions.js";
export * from "./events.js";
export * from "./rules.js";
export * from "./modes.js";
export * from "./tools.js";
// Note: connection.js is Node.js-only (uses WebSocket, readline)
// Import directly: import { ... } from "./engine/connection.js"
