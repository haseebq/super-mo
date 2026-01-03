import type { GamePatch, GameStateSnapshot } from "./types.js";

/**
 * A message in the conversation history.
 */
export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

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
   * Given a user prompt, conversation history, and current game state snapshot,
   * return patch operations that implement the user's request.
   */
  processPrompt(
    prompt: string,
    snapshot: GameStateSnapshot,
    messages?: ConversationMessage[]
  ): Promise<PromptResult>;
}

type ToolCall = {
  function?: { name?: string; arguments?: string | Record<string, unknown> };
  name?: string;
  arguments?: string | Record<string, unknown>;
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
  response?: string | null;
  tool_calls?: ToolCall[];
  result?: {
    response?: string | null;
    tool_calls?: ToolCall[];
  };
};

const DEFAULT_API_ENDPOINT = "/api/chat";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MODEL = "gpt-oss-120b";

function parseToolArguments(
  args: string | Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!args) return null;
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof args === "object") return args;
  return null;
}

function parseChatResponse(payload: ChatResponse): PromptResult {
  const message = payload.choices?.[0]?.message;
  const toolCalls: ToolCall[] = [
    ...(Array.isArray(message?.tool_calls) ? message.tool_calls : []),
    ...(Array.isArray(payload.tool_calls) ? payload.tool_calls : []),
    ...(Array.isArray(payload.result?.tool_calls)
      ? payload.result.tool_calls
      : []),
  ];

  let patch: GamePatch = { ops: [] };
  let explanation = "";

  for (const call of toolCalls) {
    const toolName = call?.function?.name ?? call?.name;
    if (toolName !== "apply_patch") continue;
    const args = parseToolArguments(call?.function?.arguments ?? call?.arguments);
    if (!args) continue;

    const argsPatch = (args.patch as GamePatch | undefined) ?? undefined;
    if (argsPatch?.ops && Array.isArray(argsPatch.ops)) {
      patch = { ops: argsPatch.ops };
    } else if (Array.isArray(args.ops)) {
      patch = { ops: args.ops as GamePatch["ops"] };
    }

    if (typeof args.explanation === "string") {
      explanation = args.explanation;
    }
  }

  if (!explanation && typeof message?.content === "string") {
    explanation = message.content;
  } else if (!explanation && typeof payload.response === "string") {
    explanation = payload.response;
  } else if (!explanation && typeof payload.result?.response === "string") {
    explanation = payload.result.response;
  }

  return {
    patch,
    explanation: explanation || "No response from AI.",
  };
}

export class ApiModdingProvider implements ModdingProvider {
  constructor(
    private options: {
      endpoint?: string;
      model?: string;
      timeoutMs?: number;
    } = {}
  ) {}

  async processPrompt(
    prompt: string,
    snapshot: GameStateSnapshot,
    messages?: ConversationMessage[]
  ): Promise<PromptResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await fetch(this.options.endpoint ?? DEFAULT_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          state: snapshot,
          model: this.options.model ?? DEFAULT_MODEL,
          messages: messages ?? [],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI service error (${response.status})`);
      }

      const payload = (await response.json()) as ChatResponse;
      return parseChatResponse(payload);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class FallbackModdingProvider implements ModdingProvider {
  constructor(
    private primary: ModdingProvider,
    private fallback: ModdingProvider
  ) {}

  async processPrompt(
    prompt: string,
    snapshot: GameStateSnapshot,
    messages?: ConversationMessage[]
  ): Promise<PromptResult> {
    try {
      return await this.primary.processPrompt(prompt, snapshot, messages);
    } catch (error: any) {
      const result = await this.fallback.processPrompt(prompt, snapshot, messages);
      const reason =
        error?.name === "AbortError"
          ? "Timed out."
          : "AI service unavailable.";
      return {
        patch: result.patch,
        explanation: `${result.explanation}\n(${reason} Using offline rules.)`,
      };
    }
  }
}

export function createDefaultModdingProvider(): ModdingProvider {
  return new FallbackModdingProvider(
    new ApiModdingProvider(),
    new KeywordModdingProvider()
  );
}

/**
 * Simple keyword-based modding provider for offline development.
 * Matches keywords in the user prompt to predefined patch operations.
 */
export class KeywordModdingProvider implements ModdingProvider {
  async processPrompt(
    prompt: string,
    _snapshot: GameStateSnapshot,
    _messages?: ConversationMessage[]
  ): Promise<PromptResult> {
    const lower = prompt.toLowerCase();

    // Audio toggles
    if (
      lower.includes("sound") ||
      lower.includes("audio") ||
      lower.includes("music")
    ) {
      const disable =
        lower.includes("off") ||
        lower.includes("mute") ||
        lower.includes("silence") ||
        lower.includes("quiet");
      const enable =
        lower.includes("on") ||
        lower.includes("unmute") ||
        lower.includes("enable");

      // Music track changes
      if (lower.includes("music")) {
        if (lower.includes("stop") || lower.includes("no music")) {
          return {
            patch: {
              ops: [{ op: "setMusic", action: "stop" }],
            },
            explanation: "Music stopped.",
          };
        }
        if (lower.includes("next") || lower.includes("change") || lower.includes("different")) {
          // Try to extract a track number
          const trackMatch = lower.match(/track\s*(\d+)/);
          const track = trackMatch ? parseInt(trackMatch[1], 10) - 1 : Math.floor(Math.random() * 6);
          return {
            patch: {
              ops: [{ op: "setMusic", track, action: "play" }],
            },
            explanation: `Now playing music track ${track + 1}.`,
          };
        }
        // Specific track number
        const trackNumMatch = lower.match(/(?:track|music)\s*(\d+)/);
        if (trackNumMatch) {
          const track = parseInt(trackNumMatch[1], 10) - 1;
          return {
            patch: {
              ops: [{ op: "setMusic", track, action: "play" }],
            },
            explanation: `Now playing music track ${track + 1}.`,
          };
        }
      }

      if (disable || enable) {
        return {
          patch: {
            ops: [{ op: "setAudio", muted: disable }],
          },
          explanation: disable
            ? "Audio muted."
            : "Audio enabled.",
        };
      }
    }

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

    // Sine wave enemy movement
    if (
      (lower.includes("sine") || lower.includes("wave") || lower.includes("wavy") || lower.includes("oscillat")) &&
      (lower.includes("enem") || lower.includes("monster"))
    ) {
      // Horizontal sine wave by default
      const isVertical = lower.includes("vertical") || lower.includes("up") || lower.includes("down");
      const script = isVertical
        ? "if (!entity.baseY) entity.baseY = entity.y; entity.y = entity.baseY + 30 * Math.sin(time * 2 + entity.x * 0.01);"
        : "if (!entity.baseX) entity.baseX = entity.x; entity.x = entity.baseX + 30 * Math.sin(time * 2 + entity.y * 0.01);";
      return {
        patch: {
          ops: [{ op: "setEntityScript", target: "enemy", script }],
        },
        explanation: isVertical
          ? "Enemies now move in a vertical sine wave pattern!"
          : "Enemies now move in a horizontal sine wave pattern!",
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
