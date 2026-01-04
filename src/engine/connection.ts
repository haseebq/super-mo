/**
 * AI Connection
 *
 * External AI connection for tool calls via WebSocket or stdio.
 * Supports hot-swap: disconnect/reconnect preserves engine state.
 *
 * Protocol:
 * - Request:  { type: "request", id: string, tool: string, args?: object }
 * - Response: { type: "response", id: string, success: boolean, data?: any, error?: string }
 * - State:    { type: "state", state: EngineState, frame: number, time: number }
 * - Connected:{ type: "connected", tools: ToolDefinition[] }
 * - Error:    { type: "error", message: string }
 */

import { WebSocketServer, WebSocket, RawData } from "ws";
import { createInterface, Interface as ReadlineInterface } from "readline";
import { GameEngine, StepInput, StepResult } from "./engine.js";
import { ToolExecutor, ToolDefinition, ToolResult } from "./tools.js";
import { EngineState } from "./state.js";

// Message types for the protocol

export interface ToolRequest {
  type: "request";
  id: string;
  tool: string;
  args?: Record<string, unknown>;
}

export interface ToolResponse {
  type: "response";
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface StateUpdate {
  type: "state";
  state: EngineState;
  frame: number;
  time: number;
  stepResult?: StepResult;
}

export interface ConnectedMessage {
  type: "connected";
  tools: ToolDefinition[];
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage = ToolResponse | StateUpdate | ConnectedMessage | ErrorMessage;
export type ClientMessage = ToolRequest;

export interface ConnectionOptions {
  sendStateOnStep?: boolean;  // Send full state after each step (default: true)
  sendStateOnConnect?: boolean;  // Send full state on connect (default: true)
}

/**
 * Abstract connection that handles tool calls.
 * Extended by WebSocket and stdio implementations.
 */
abstract class BaseConnection {
  protected engine: GameEngine;
  protected tools: ToolExecutor;
  protected options: ConnectionOptions;
  protected connected: boolean = false;

  constructor(engine: GameEngine, options: ConnectionOptions = {}) {
    this.engine = engine;
    this.tools = new ToolExecutor(engine);
    this.options = {
      sendStateOnStep: true,
      sendStateOnConnect: true,
      ...options,
    };
  }

  /**
   * Handle incoming message and return response.
   */
  protected handleMessage(message: ClientMessage): ServerMessage {
    if (message.type !== "request") {
      return { type: "error", message: `Unknown message type: ${(message as { type: string }).type}` };
    }

    const { id, tool, args = {} } = message;

    // Special handling for step - we'll send state update after
    const result = this.tools.call(tool, args);

    const response: ToolResponse = {
      type: "response",
      id,
      success: result.success,
      data: result.data,
      error: result.error,
    };

    return response;
  }

  /**
   * Create connected message with tool list.
   */
  protected createConnectedMessage(): ConnectedMessage {
    return {
      type: "connected",
      tools: this.tools.getTools(),
    };
  }

  /**
   * Create state update message.
   */
  protected createStateMessage(stepResult?: StepResult): StateUpdate {
    return {
      type: "state",
      state: this.engine.getState(),
      frame: this.engine.getFrame(),
      time: this.engine.getTime(),
      stepResult,
    };
  }

  /**
   * Send message to connected client.
   */
  protected abstract send(message: ServerMessage): void;

  /**
   * Start the connection.
   */
  abstract start(): Promise<void>;

  /**
   * Stop the connection.
   */
  abstract stop(): Promise<void>;
}

/**
 * WebSocket server for AI connections.
 * Multiple clients can connect simultaneously.
 */
export class WebSocketConnection extends BaseConnection {
  private server: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private port: number;
  private host: string;

  constructor(engine: GameEngine, port: number = 3001, host: string = "localhost", options: ConnectionOptions = {}) {
    super(engine, options);
    this.port = port;
    this.host = host;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({ port: this.port, host: this.host });

        this.server.on("listening", () => {
          this.connected = true;
          resolve();
        });

        this.server.on("connection", (ws: WebSocket) => {
          this.handleClientConnect(ws);
        });

        this.server.on("error", (err: Error) => {
          if (!this.connected) {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        // Close all client connections
        for (const client of this.clients) {
          client.close();
        }
        this.clients.clear();

        // Close the server
        this.server.close(() => {
          this.server = null;
          this.connected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleClientConnect(ws: WebSocket): void {
    this.clients.add(ws);

    // Send connected message with tool list
    this.sendToClient(ws, this.createConnectedMessage());

    // Optionally send current state
    if (this.options.sendStateOnConnect) {
      this.sendToClient(ws, this.createStateMessage());
    }

    ws.on("message", (data: RawData) => {
      this.handleClientMessage(ws, data);
    });

    ws.on("close", () => {
      this.clients.delete(ws);
    });

    ws.on("error", () => {
      this.clients.delete(ws);
    });
  }

  private handleClientMessage(ws: WebSocket, data: RawData): void {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      const response = this.handleMessage(message);
      this.sendToClient(ws, response);

      // If this was a step command and sendStateOnStep is enabled, send state update
      if (
        message.type === "request" &&
        message.tool === "step" &&
        this.options.sendStateOnStep &&
        response.type === "response" &&
        response.success
      ) {
        this.sendToClient(ws, this.createStateMessage(response.data as StepResult));
      }
    } catch (err) {
      const errorMsg: ErrorMessage = {
        type: "error",
        message: `Failed to parse message: ${String(err)}`,
      };
      this.sendToClient(ws, errorMsg);
    }
  }

  private sendToClient(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  protected send(message: ServerMessage): void {
    // Broadcast to all connected clients
    for (const client of this.clients) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcast state update to all connected clients.
   * Call this after each game step to keep AIs informed.
   */
  broadcastState(stepResult?: StepResult): void {
    this.send(this.createStateMessage(stepResult));
  }

  /**
   * Get number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if server is running.
   */
  isRunning(): boolean {
    return this.connected && this.server !== null;
  }

  /**
   * Get the port the server is listening on.
   */
  getPort(): number {
    return this.port;
  }
}

/**
 * stdio connection for CLI integration.
 * Reads JSON messages from stdin, writes to stdout.
 */
export class StdioConnection extends BaseConnection {
  private readline: ReadlineInterface | null = null;
  private inputStream: NodeJS.ReadableStream;
  private outputStream: NodeJS.WritableStream;

  constructor(
    engine: GameEngine,
    inputStream: NodeJS.ReadableStream = process.stdin,
    outputStream: NodeJS.WritableStream = process.stdout,
    options: ConnectionOptions = {}
  ) {
    super(engine, options);
    this.inputStream = inputStream;
    this.outputStream = outputStream;
  }

  async start(): Promise<void> {
    this.readline = createInterface({
      input: this.inputStream,
      output: this.outputStream,
      terminal: false,
    });

    this.connected = true;

    // Send connected message
    this.send(this.createConnectedMessage());

    // Optionally send current state
    if (this.options.sendStateOnConnect) {
      this.send(this.createStateMessage());
    }

    // Handle incoming lines
    this.readline.on("line", (line: string) => {
      this.handleLine(line);
    });

    this.readline.on("close", () => {
      this.connected = false;
    });
  }

  async stop(): Promise<void> {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }
    this.connected = false;
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;

    try {
      const message = JSON.parse(line) as ClientMessage;
      const response = this.handleMessage(message);
      this.send(response);

      // If this was a step command and sendStateOnStep is enabled, send state update
      if (
        message.type === "request" &&
        message.tool === "step" &&
        this.options.sendStateOnStep &&
        response.type === "response" &&
        response.success
      ) {
        this.send(this.createStateMessage(response.data as StepResult));
      }
    } catch (err) {
      const errorMsg: ErrorMessage = {
        type: "error",
        message: `Failed to parse message: ${String(err)}`,
      };
      this.send(errorMsg);
    }
  }

  protected send(message: ServerMessage): void {
    this.outputStream.write(JSON.stringify(message) + "\n");
  }

  /**
   * Send state update.
   * Call this after each game step to keep AI informed.
   */
  sendState(stepResult?: StepResult): void {
    this.send(this.createStateMessage(stepResult));
  }

  /**
   * Check if connection is active.
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Client-side connection helper for tests and external processes.
 * Connects to a WebSocket server and provides async tool call API.
 */
export class ConnectionClient {
  private ws: WebSocket | null = null;
  private url: string;
  private requestId: number = 0;
  private pendingRequests: Map<string, {
    resolve: (result: ToolResult) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private tools: ToolDefinition[] = [];
  private currentState: EngineState | null = null;
  private onStateUpdate?: (state: EngineState, stepResult?: StepResult) => void;

  constructor(url: string = "ws://localhost:3001") {
    this.url = url;
  }

  /**
   * Connect to the server.
   */
  async connect(): Promise<ToolDefinition[]> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        // Wait for connected message
      });

      this.ws.on("message", (data: RawData) => {
        try {
          const message = JSON.parse(data.toString()) as ServerMessage;
          this.handleMessage(message, resolve);
        } catch (err) {
          // Ignore parse errors
        }
      });

      this.ws.on("error", (err) => {
        reject(err);
      });

      this.ws.on("close", () => {
        this.ws = null;
        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
          pending.reject(new Error("Connection closed"));
        }
        this.pendingRequests.clear();
      });
    });
  }

  private handleMessage(
    message: ServerMessage,
    onConnect?: (tools: ToolDefinition[]) => void
  ): void {
    switch (message.type) {
      case "connected":
        this.tools = message.tools;
        if (onConnect) {
          onConnect(message.tools);
        }
        break;

      case "response": {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          pending.resolve({
            success: message.success,
            data: message.data,
            error: message.error,
          });
        }
        break;
      }

      case "state":
        this.currentState = message.state;
        if (this.onStateUpdate) {
          this.onStateUpdate(message.state, message.stepResult);
        }
        break;

      case "error":
        // Log errors but don't crash
        console.error("Server error:", message.message);
        break;
    }
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Call a tool on the server.
   */
  async call(tool: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: "Not connected" };
    }

    const id = `${++this.requestId}`;
    const request: ToolRequest = {
      type: "request",
      id,
      tool,
      args,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(request));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timed out"));
        }
      }, 30000);
    });
  }

  /**
   * Get the list of available tools.
   */
  getTools(): ToolDefinition[] {
    return this.tools;
  }

  /**
   * Get the current state (last received state update).
   */
  getState(): EngineState | null {
    return this.currentState;
  }

  /**
   * Set callback for state updates.
   */
  setStateUpdateHandler(handler: (state: EngineState, stepResult?: StepResult) => void): void {
    this.onStateUpdate = handler;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Create and start a WebSocket connection server.
 * Convenience function for quick setup.
 */
export async function createWebSocketServer(
  engine: GameEngine,
  port: number = 3001,
  host: string = "localhost",
  options: ConnectionOptions = {}
): Promise<WebSocketConnection> {
  const connection = new WebSocketConnection(engine, port, host, options);
  await connection.start();
  return connection;
}

/**
 * Create and start a stdio connection.
 * Convenience function for quick setup.
 */
export async function createStdioConnection(
  engine: GameEngine,
  options: ConnectionOptions = {}
): Promise<StdioConnection> {
  const connection = new StdioConnection(engine, process.stdin, process.stdout, options);
  await connection.start();
  return connection;
}

/**
 * Connect to a WebSocket server.
 * Convenience function for clients.
 */
export async function connectToServer(
  url: string = "ws://localhost:3001"
): Promise<ConnectionClient> {
  const client = new ConnectionClient(url);
  await client.connect();
  return client;
}
