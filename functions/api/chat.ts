const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  type: "function",
  function: {
    name: "apply_patch",
    description:
      "Propose game patch operations that modify rules or entities.",
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
  },
};

const ALLOWED_MODELS = new Set([
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-1.5-flash",
]);
const DEFAULT_MODEL = "openai/gpt-4o-mini";

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

export async function onRequest(context: {
  request: Request;
  env: { OPENROUTER_API_KEY?: string };
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

  if (!env.OPENROUTER_API_KEY) {
    return jsonResponse({ error: "Server missing API key" }, 500);
  }

  const model = typeof body.model === "string" ? body.model : DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
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
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...userMessages],
    tools: [TOOL_SCHEMA],
    tool_choice: {
      type: "function",
      function: { name: "apply_patch" },
    },
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
  };

  const host = request.headers.get("host");
  const referer = host ? `https://${host}` : "https://super-mo.local";
  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": "Super Mo",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await upstream.text();
  if (!upstream.ok) {
    return jsonResponse(
      {
        error: "Upstream request failed",
        status: upstream.status,
        detail: responseText.slice(0, 300),
      },
      502
    );
  }

  return new Response(responseText, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
