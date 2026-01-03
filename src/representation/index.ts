/**
 * Representation Engine
 *
 * Swappable rendering backends for the pure data engine.
 * See docs/ai-first-engine.md for architecture.
 */

export interface Renderer {
  render(state: unknown): void;
}
