export type SandboxOp = {
  op: string;
  [key: string]: unknown;
};

export type SandboxResult = {
  ops: SandboxOp[];
  logs: string[];
  output?: unknown;
};

export type SandboxRequest =
  | { type: "init" }
  | { type: "eval"; id: string; code: string };

export type SandboxResponse =
  | { type: "ready" }
  | { type: "result"; id: string; result: SandboxResult }
  | { type: "error"; id: string; error: string; logs?: string[] };
