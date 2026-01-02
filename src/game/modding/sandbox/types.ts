export type SandboxOp = {
  op: string;
  [key: string]: unknown;
};

export type SandboxResult = {
  ops: SandboxOp[];
  logs: string[];
  output?: unknown;
};

export type SandboxModuleMap = Record<string, string>;

export type SandboxRequest =
  | { type: "init" }
  | { type: "eval"; id: string; code: string }
  | { type: "evalModule"; id: string; entry: string; modules: SandboxModuleMap };

export type SandboxResponse =
  | { type: "ready" }
  | { type: "result"; id: string; result: SandboxResult }
  | { type: "error"; id: string; error: string; logs?: string[] };
