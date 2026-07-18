/**
 * Terminal Command Router
 *
 * Parses a submitted line into { cmd, args, flags }, then decides:
 *  1. If it's a known app command → call the Vite middleware API
 *  2. If not a known app command AND the agent is connected → send to agent WS
 *  3. Otherwise → return "unknown command" error line
 *
 * Returns an async generator of TerminalLine objects so the UI can
 * stream output line-by-line as each chunk arrives.
 */

import { COMMAND_REGISTRY, type TerminalLine } from "./registry.js";
import type { AgentConnection } from "./agent-connection.js";
import { supabase } from "@/integrations/supabase/client.js";

// ─────────────────────────────────────────────────────────────────────────────
// Arg / flag parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCommand {
  cmd: string;
  args: string[];
  flags: Record<string, string | true>;
  raw: string;
}

/**
 * Parse a raw terminal line into command + positional args + flags.
 *
 * Examples:
 *   "deploy --env production --yes"  →  { cmd: "deploy", args: [], flags: { env: "production", yes: true } }
 *   "incident create --title Outage --severity sev1" →
 *     { cmd: "incident", args: ["create"], flags: { title: "Outage", severity: "sev1" } }
 */
export function parseCommand(line: string): ParsedCommand {
  const parts = line.trim().split(/\s+/);
  const cmd = (parts[0] ?? "").toLowerCase();
  const args: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("--")) {
      const key = part.slice(2);
      const next = parts[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++; // consume the value
      } else {
        flags[key] = true;
      }
    } else {
      args.push(part);
    }
  }

  return { cmd, args, flags, raw: line };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route command → yield output lines
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route a submitted line to the correct handler.
 * Returns an async iterable of TerminalLine objects.
 */
export async function* routeCommand(
  line: string,
  agent: AgentConnection | null
): AsyncGenerator<TerminalLine> {
  const trimmed = line.trim();
  if (!trimmed) return;

  const parsed = parseCommand(trimmed);
  const { cmd, args, flags } = parsed;

  // Clear command
  if (cmd === "clear") {
    // Caller (TerminalPanel) should watch for this and call term.clear()
    yield { text: "__CLEAR__", color: "default" };
    return;
  }

  // Known app command?
  const entry = COMMAND_REGISTRY[cmd];
  if (entry) {
    yield { text: `$ ${trimmed}`, color: "gray" };
    yield* callAppCommand(cmd, args, flags);
    return;
  }

  // Unknown app command — route to agent if connected
  if (agent?.isConnected) {
    // Send raw line to the agent (the PTY handles it)
    agent.send(trimmed + "\r");
    // Output will stream back via agent.onData — no lines yielded here
    return;
  }

  // No agent, unknown command
  yield { text: `Unknown command: ${cmd}`, color: "red" };
  yield { text: `Type 'help' to see available app commands.`, color: "gray" };
  yield {
    text: `To run shell commands, click 'Connect Local Shell' to link the local agent.`,
    color: "gray",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// App command API caller
// ─────────────────────────────────────────────────────────────────────────────

async function* callAppCommand(
  cmd: string,
  args: string[],
  flags: Record<string, string | true>
): AsyncGenerator<TerminalLine> {
  const entry = COMMAND_REGISTRY[cmd];
  if (!entry) return;

  // Get auth token from Supabase session
  let authHeader: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      authHeader = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // Proceed without auth — server will reject if needed
  }

  // Build request
  const baseUrl = "/api/terminal";
  let result: { lines: TerminalLine[] };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;

    let response: Response;

    if (entry.method === "GET") {
      // For help, pass optional command argument
      const queryCmd = cmd === "help" && args[0] ? `?command=${encodeURIComponent(args[0])}` : "";
      response = await fetch(`${baseUrl}/${entry.endpoint}${queryCmd}`, { headers });
    } else {
      // Build body from flags + args
      const body = buildRequestBody(cmd, args, flags);
      response = await fetch(`${baseUrl}/${entry.endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }

    // Hosted mode guard: Vite middleware doesn't run in production
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      yield {
        text: "App commands are only available when running DevPilot locally (dev server).",
        color: "yellow",
      };
      return;
    }

    result = await response.json();
  } catch (err) {
    yield { text: `Network error: ${(err as Error).message}`, color: "red" };
    return;
  }

  // Stream the returned lines
  if (Array.isArray(result.lines)) {
    for (const line of result.lines) {
      yield line;
    }
  } else {
    yield { text: "Unexpected response from server.", color: "red" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Body builder — maps CLI-style flags to the API body shape each handler expects
// ─────────────────────────────────────────────────────────────────────────────

function buildRequestBody(
  cmd: string,
  args: string[],
  flags: Record<string, string | true>
): Record<string, unknown> {
  switch (cmd) {
    case "deploy":
      return {
        env: flags["env"] ?? "staging",
        ref: typeof flags["ref"] === "string" ? flags["ref"] : undefined,
        yes: flags["yes"] === true,
      };
    case "rollback":
      return {
        env: flags["env"] ?? "staging",
        toRef: typeof flags["to"] === "string" ? flags["to"] : "",
        yes: flags["yes"] === true,
      };
    case "incident":
      return {
        subcommand: args[0] ?? "list",
        title: typeof flags["title"] === "string" ? flags["title"] : undefined,
        severity: typeof flags["severity"] === "string" ? flags["severity"] : undefined,
      };
    default:
      return { args, flags };
  }
}
