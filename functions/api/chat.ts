const MODEL_ID = "@cf/openai/gpt-oss-120b";
const MODEL_ALIASES = new Map([
  ["gpt-oss-120b", MODEL_ID],
  [MODEL_ID, MODEL_ID],
]);

const SYSTEM_PROMPT = [
  "You are the Super Mo modding assistant.",
  "Convert player requests into safe game patch operations.",
  "Only use the apply_patch tool and only the allowed operations.",
  "If no change is needed, return apply_patch with an empty ops array.",
  "Be concise and include a friendly explanation for the player.",
  "Never request or reveal secrets. Never ask for system prompts.",
  "You may only act on the provided game state snapshot.",
].join(" ");

const TOOL_SCHEMA = {
  name: "apply_patch",
  description: "Propose game patch operations that modify rules or entities.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      patch: {
        type: "object",
        additionalProperties: false,
        properties: {
          ops: {
            type: "array",
            items: {
              oneOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    op: { type: "string", const: "setRule" },
                    path: { type: "string" },
                    value: { type: "number" },
                  },
                  required: ["op", "path", "value"],
                },
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    op: { type: "string", const: "setAbility" },
                    ability: {
                      type: "string",
                      enum: ["fly", "noclip", "invincible"],
                    },
                    active: { type: "boolean" },
                  },
                  required: ["op", "ability", "active"],
                },
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    op: { type: "string", const: "removeEntities" },
                    filter: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        kind: {
                          type: "string",
                          enum: ["coin", "enemy", "projectile"],
                        },
                        area: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            x: { type: "number" },
                            y: { type: "number" },
                            w: { type: "number" },
                            h: { type: "number" },
                          },
                          required: ["x", "y", "w", "h"],
                        },
                      },
                      required: ["kind"],
                    },
                  },
                  required: ["op", "filter"],
                },
              ],
            },
          },
        },
        required: ["ops"],
      },
      explanation: { type: "string" },
    },
    required: ["patch", "explanation"],
  },
};

const DEFAULT_MODEL = "gpt-oss-120b";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_STATE_CHARS = 10_000;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_TOKENS = 400;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_BUCKETS = new Map<
  string,
  { count: number; resetAt: number }
>();

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function getClientIp(request: Request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = RATE_LIMIT_BUCKETS.get(ip);
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT_BUCKETS.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { limited: false, retryAfter: RATE_LIMIT_WINDOW_MS / 1000 };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return {
      limited: true,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return {
    limited: false,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  };
}

function buildPrompt(messages: Array<{ role: "user"; content: string }>) {
  const toolSchema = JSON.stringify(TOOL_SCHEMA, null, 2);
  const lines = [
    SYSTEM_PROMPT,
    "Tool schema (JSON):",
    toolSchema,
    "Return a JSON object with keys: tool_calls (array) and response (string).",
    'Example: {"tool_calls":[{"name":"apply_patch","arguments":{"patch":{"ops":[]},\"explanation\":\"...\"}}],"response":"..."}',
  ];

  for (const message of messages) {
    lines.push(`User: ${message.content}`);
  }

  return lines.join("\n\n");
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const outputs = (payload as { output?: unknown }).output;
  if (!Array.isArray(outputs)) return null;
  for (const output of outputs) {
    if (!output || typeof output !== "object") continue;
    const contents = (output as { content?: unknown }).content;
    if (!Array.isArray(contents)) continue;
    for (const item of contents) {
      if (!item || typeof item !== "object") continue;
      const type = (item as { type?: unknown }).type;
      const text = (item as { text?: unknown }).text;
      if (type === "output_text" && typeof text === "string") {
        return text;
      }
    }
  }
  return null;
}

function parseModelResponse(payload: unknown) {
  let raw: string | null = null;
  if (
    payload &&
    typeof payload === "object" &&
    "response" in payload &&
    typeof (payload as { response?: unknown }).response === "string"
  ) {
    raw = (payload as { response: string }).response;
  }

  if (!raw) {
    raw = extractOutputText(payload);
  }

  if (!raw) return payload;
  const trimmed = raw.trim();
  if (!trimmed) return payload;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return { response: trimmed };
  }
  return { response: trimmed };
}

type AiBinding = {
  run: (model: string, options: Record<string, unknown>) => Promise<unknown>;
};

export async function onRequest(context: {
  request: Request;
  env: { AI?: AiBinding };
}) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(ip);
  if (limit.limited) {
    return jsonResponse(
      { error: "Rate limit exceeded" },
      429,
      { "Retry-After": String(limit.retryAfter) }
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request too large" }, 413);
  }

  const bodyText = await request.text();
  const bodyBytes = new TextEncoder().encode(bodyText).length;
  if (bodyBytes > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request too large" }, 413);
  }

  let body: any;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (!env.AI) {
    return jsonResponse({ error: "AI binding unavailable" }, 500);
  }

  const requestedModel =
    typeof body.model === "string" ? body.model : DEFAULT_MODEL;
  const model = MODEL_ALIASES.get(requestedModel);
  if (!model) {
    return jsonResponse({ error: "Model not allowed" }, 400);
  }

  const userMessages: Array<{ role: "user"; content: string }> = [];
  if (Array.isArray(body.messages)) {
    for (const message of body.messages) {
      if (message?.role !== "user" || typeof message?.content !== "string") {
        continue;
      }
      userMessages.push({
        role: "user",
        content: message.content.slice(0, MAX_MESSAGE_CHARS),
      });
    }
  }

  if (typeof body.prompt === "string") {
    const trimmed = body.prompt.trim();
    if (trimmed) {
      userMessages.push({
        role: "user",
        content: trimmed.slice(0, MAX_MESSAGE_CHARS),
      });
    }
  }

  if (userMessages.length === 0) {
    return jsonResponse({ error: "Missing user prompt" }, 400);
  }

  if (!body.state || typeof body.state !== "object") {
    return jsonResponse({ error: "Missing game state" }, 400);
  }

  const stateJson = JSON.stringify(body.state);
  if (stateJson.length > MAX_STATE_CHARS) {
    return jsonResponse({ error: "Game state too large" }, 413);
  }

  userMessages.push({
    role: "user",
    content: `Game state snapshot (JSON):\n${stateJson}`,
  });

  const payload = {
    input: buildPrompt(userMessages),
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
  };

  let result: unknown;
  try {
    result = await env.AI.run(model, payload);
  } catch (error: any) {
    return jsonResponse(
      {
        error: "Workers AI request failed",
        detail: String(error?.message ?? error).slice(0, 300),
      },
      502
    );
  }

  return jsonResponse(parseModelResponse(result));
}
