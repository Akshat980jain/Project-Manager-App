import { saveAgentConnection, clearAgentConnection } from "./agent-store.js";

/**
 * Local Shell Agent WebSocket Connection Manager
 *
 * Manages the lifecycle of the WebSocket connection to the local PTY agent
 * (backend/server.ts). This runs entirely client-side.
 *
 * Protocol (JSON):
 *   Client → Agent:  { type: 'input', data: string }
 *                    { type: 'resize', cols: number, rows: number }
 *   Agent → Client:  { type: 'output', data: string }
 *                    { type: 'exit', exitCode: number }
 */

export type AgentStatus = "disconnected" | "connecting" | "connected" | "error";

export interface AgentConnectionOptions {
  host: string;        // should always be localhost / 127.0.0.1
  port: number;
  token: string;
  onData: (data: string) => void;
  onExit: (exitCode: number) => void;
  onStatusChange: (status: AgentStatus, detail?: string) => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;

export class AgentConnection {
  private ws: WebSocket | null = null;
  private options: AgentConnectionOptions;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  constructor(options: AgentConnectionOptions) {
    this.options = options;
  }

  /** Open the WebSocket connection to the local agent */
  connect() {
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;
    this._openSocket();
  }

  private _openSocket() {
    const { host, port, token, onData, onExit, onStatusChange } = this.options;

    // Security: enforce localhost-only connections
    const normalizedHost = host.replace(/^https?:\/\//, "");
    if (
      normalizedHost !== "localhost" &&
      normalizedHost !== "127.0.0.1" &&
      !normalizedHost.startsWith("localhost:") &&
      !normalizedHost.startsWith("127.0.0.1:")
    ) {
      onStatusChange("error", "Agent connections are only permitted to localhost / 127.0.0.1");
      return;
    }

    const url = `ws://${normalizedHost}:${port}?token=${encodeURIComponent(token)}`;
    onStatusChange("connecting");

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      onStatusChange("error", String(err));
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      onStatusChange("connected");
      // Persist the connection details so other parts of the app (e.g. pipeline
      // terminal tabs) can build WS URLs with the correct token.
      saveAgentConnection({
        host: normalizedHost,
        port: this.options.port,
        token: this.options.token,
        connectedAt: new Date().toISOString(),
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output" && typeof msg.data === "string") {
          onData(msg.data);
        } else if (msg.type === "exit" && typeof msg.exitCode === "number") {
          onExit(msg.exitCode);
        }
      } catch {
        // Fallback: treat raw string messages as output (backward compat)
        if (typeof event.data === "string") {
          onData(event.data);
        }
      }
    };

    this.ws.onerror = () => {
      // onclose will fire right after, handle there
    };

    this.ws.onclose = (event) => {
      this.ws = null;
      if (this.intentionallyClosed) {
        onStatusChange("disconnected");
        return;
      }

      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_BACKOFF_MS * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;
        onStatusChange(
          "connecting",
          `Disconnected (code ${event.code}). Retrying in ${delay}ms… (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
        );
        this.reconnectTimeout = setTimeout(() => this._openSocket(), delay);
      } else {
        onStatusChange(
          "error",
          `Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Check that the agent is running.`
        );
      }
    };
  }

  /** Send raw keystroke input to the PTY */
  send(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "input", data }));
    }
  }

  /** Notify the agent of a terminal resize */
  resize(cols: number, rows: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }

  /** Close the WebSocket cleanly */
  disconnect() {
    this.intentionallyClosed = true;
    clearAgentConnection();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
