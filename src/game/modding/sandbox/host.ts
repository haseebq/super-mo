import type { SandboxRequest, SandboxResponse, SandboxResult } from "./types.js";

type PendingRequest = {
  resolve: (result: SandboxResult) => void;
  reject: (error: Error) => void;
};

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export class SandboxRuntime {
  private worker: Worker;
  private pending = new Map<string, PendingRequest>();
  private ready: Promise<void>;
  private resolveReady?: () => void;

  constructor(workerUrl: URL = new URL("./worker.js", import.meta.url)) {
    this.worker = new Worker(workerUrl, { type: "module" });
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.worker.addEventListener("message", (event: MessageEvent<SandboxResponse>) => {
      const message = event.data;
      if (!message) return;
      if (message.type === "ready") {
        this.resolveReady?.();
        return;
      }
      if (message.type === "result") {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        pending.resolve(message.result);
        this.pending.delete(message.id);
        return;
      }
      if (message.type === "error") {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        const err = new Error(message.error);
        pending.reject(err);
        this.pending.delete(message.id);
      }
    });

    const initMessage: SandboxRequest = { type: "init" };
    this.worker.postMessage(initMessage);
  }

  async evaluate(code: string): Promise<SandboxResult> {
    await this.ready;
    return new Promise((resolve, reject) => {
      const id = createRequestId();
      this.pending.set(id, { resolve, reject });
      const message: SandboxRequest = { type: "eval", id, code };
      this.worker.postMessage(message);
    });
  }

  dispose(): void {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Sandbox runtime disposed."));
    }
    this.pending.clear();
    this.worker.terminate();
  }
}
