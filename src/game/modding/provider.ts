import type { GamePatch, GameStateSnapshot } from "./types.js";

/**
 * Result from an AI agent/provider translating user prompt into patch operations.
 */
export type PromptResult = {
  patch: GamePatch;
  explanation: string;
};

/**
 * Interface for AI/Agent providers that translate natural language prompts
 * into modding patch operations.
 */
export interface ModdingProvider {
  /**
   * Given a user prompt and current game state snapshot, return patch operations
   * that implement the user's request.
   */
  processPrompt(
    prompt: string,
    snapshot: GameStateSnapshot
  ): Promise<PromptResult>;
}

/**
 * Simple keyword-based modding provider for offline development.
 * Matches keywords in the user prompt to predefined patch operations.
 */
export class KeywordModdingProvider implements ModdingProvider {
  async processPrompt(
    prompt: string,
    _snapshot: GameStateSnapshot
  ): Promise<PromptResult> {
    const lower = prompt.toLowerCase();

    // Gravity modifications
    if (lower.includes("gravity")) {
      const disable =
        lower.includes("off") ||
        lower.includes("0") ||
        lower.includes("no") ||
        lower.includes("disable") ||
        lower.includes("fly");

      const value = disable ? 0 : 152;
      return {
        patch: {
          ops: [{ op: "setRule", path: "physics.gravity", value }],
        },
        explanation: disable
          ? "Gravity disabled! You can now float."
          : "Gravity restored to normal.",
      };
    }

    // Flying ability
    if (lower.includes("fly") && !lower.includes("gravity")) {
      return {
        patch: {
          ops: [{ op: "setRule", path: "physics.gravity", value: 0 }],
        },
        explanation: "Gravity disabled! You can fly now.",
      };
    }

    // Coin value modifications
    if (
      lower.includes("coin") &&
      (lower.includes("10x") ||
        lower.includes("1000") ||
        lower.includes("points") ||
        lower.includes("score") ||
        lower.includes("value") ||
        lower.includes("multiplier"))
    ) {
      // Try to extract a multiplier from the prompt
      let value = 1000; // Default to 10x (100 * 10)
      const numMatch = lower.match(/(\d+)x/);
      if (numMatch) {
        const multiplier = parseInt(numMatch[1], 10);
        value = 100 * multiplier;
      } else if (lower.includes("1000")) {
        value = 1000;
      } else if (lower.includes("100")) {
        value = 100;
      }

      return {
        patch: {
          ops: [{ op: "setRule", path: "scoring.coinValue", value }],
        },
        explanation: `Each coin is now worth ${value} points!`,
      };
    }

    // Remove all coins
    if (
      (lower.includes("remove") || lower.includes("delete")) &&
      lower.includes("coin")
    ) {
      return {
        patch: {
          ops: [{ op: "removeEntities", filter: { kind: "coin" } }],
        },
        explanation: "All coins have been removed from the level.",
      };
    }

    // Remove all enemies
    if (
      (lower.includes("remove") ||
        lower.includes("delete") ||
        lower.includes("kill")) &&
      (lower.includes("enem") || lower.includes("monster"))
    ) {
      return {
        patch: {
          ops: [{ op: "removeEntities", filter: { kind: "enemy" } }],
        },
        explanation: "All enemies have been eliminated!",
      };
    }

    // Invincibility
    if (
      lower.includes("invincib") ||
      lower.includes("god") ||
      lower.includes("immortal") ||
      lower.includes("can't die") ||
      lower.includes("cant die")
    ) {
      return {
        patch: {
          ops: [{ op: "setAbility", ability: "invincible", active: true }],
        },
        explanation: "You are now invincible!",
      };
    }

    // Speed modifications
    if (
      lower.includes("speed") ||
      lower.includes("fast") ||
      lower.includes("quick")
    ) {
      const value =
        lower.includes("normal") || lower.includes("reset") ? 100 : 200;
      return {
        patch: {
          ops: [{ op: "setRule", path: "physics.moveSpeed", value }],
        },
        explanation:
          value > 100 ? "You're now super fast!" : "Speed restored to normal.",
      };
    }

    // Super jump
    if (
      lower.includes("jump") &&
      (lower.includes("high") ||
        lower.includes("super") ||
        lower.includes("boost"))
    ) {
      return {
        patch: {
          ops: [{ op: "setRule", path: "physics.jumpImpulse", value: 500 }],
        },
        explanation: "Super jump enabled! Jump higher than ever!",
      };
    }

    // No match found
    return {
      patch: { ops: [] },
      explanation:
        'I couldn\'t understand that request. Try things like:\n• "gravity off" or "let me fly"\n• "10x coin points" or "coins worth 1000"\n• "remove all coins" or "delete enemies"',
    };
  }
}
