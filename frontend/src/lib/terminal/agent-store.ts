/**
 * Agent Store — shared localStorage state for the active agent connection.
 *
 * Written by AgentConnection when a connection is established.
 * Read by any component that needs to open a WS to the same agent
 * (e.g. the pipeline page terminal tabs).
 */

const STORE_KEY = "devpilot_agent_connection";

export interface AgentConnectionState {
  host: string;
  port: number;
  token: string;
  connectedAt: string;
}

export function saveAgentConnection(state: AgentConnectionState) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("agent-connection-changed", { detail: state }));
  } catch {}
}

export function getAgentConnection(): AgentConnectionState | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AgentConnectionState;
  } catch {
    return null;
  }
}

export function clearAgentConnection() {
  try {
    localStorage.removeItem(STORE_KEY);
    window.dispatchEvent(new CustomEvent("agent-connection-changed", { detail: null }));
  } catch {}
}

/**
 * Build the WebSocket URL for the local agent, including the auth token.
 * Returns null if no agent connection is stored.
 */
export function buildAgentWsUrl(projectDir?: string): string | null {
  const state = getAgentConnection();
  if (!state) return null;

  const params = new URLSearchParams({ token: state.token });
  if (projectDir) params.set("projectDir", projectDir);

  return `ws://${state.host}:${state.port}?${params.toString()}`;
}
