/**
 * Terminal Command Registry
 *
 * Single source of truth for all app commands. Used by:
 *  - The client-side router (to decide which path to take)
 *  - The help handler (to generate help text)
 *  - The autocomplete module (to build suggestion lists)
 *
 * NOTE: This is a client-side module — it contains no secrets.
 */

export type CommandColor = "red" | "green" | "yellow" | "cyan" | "gray" | "default";

export interface TerminalLine {
  text: string;
  color?: CommandColor;
}

export interface CommandEntry {
  /** Primary command name (e.g. "deploy") */
  name: string;
  /** Short description shown in help */
  description: string;
  /** Usage string shown in help */
  usage: string;
  /** Optional sub-commands shown in help */
  subcommands?: { name: string; description: string }[];
  /** If set, user must have this role to run the command */
  requiredRole?: "admin" | "deployer";
  /** Whether this is a mutating command (gets audit-logged) */
  mutating?: boolean;
  /** API endpoint path (relative to /api/terminal/) */
  endpoint: string;
  /** HTTP method for the API call */
  method: "GET" | "POST";
}

export const COMMAND_REGISTRY: Record<string, CommandEntry> = {
  status: {
    name: "status",
    description: "Show health status of all services",
    usage: "status",
    endpoint: "status",
    method: "GET",
  },
  deploy: {
    name: "deploy",
    description: "Trigger a deployment to staging or production",
    usage: "deploy --env <staging|production> [--ref <git-ref>] [--yes]",
    requiredRole: "deployer",
    mutating: true,
    endpoint: "deploy",
    method: "POST",
  },
  rollback: {
    name: "rollback",
    description: "Roll back an environment to a previous git ref",
    usage: "rollback --env <staging|production> --to <git-ref> [--yes]",
    requiredRole: "deployer",
    mutating: true,
    endpoint: "rollback",
    method: "POST",
  },
  incident: {
    name: "incident",
    description: "Manage incidents",
    usage: "incident <subcommand> [options]",
    subcommands: [
      { name: "create", description: "Create a new incident" },
      { name: "list", description: "List recent incidents" },
    ],
    mutating: true,
    endpoint: "incident",
    method: "POST",
  },
  logs: {
    name: "logs",
    description: "Stream live logs (opens SSE stream)",
    usage: "logs [--tail <n>] [--filter <text>]",
    endpoint: "logs-stream",
    method: "GET",
  },
  help: {
    name: "help",
    description: "List all available commands",
    usage: "help [command]",
    endpoint: "help",
    method: "GET",
  },
};

/** Ordered list of command names for autocomplete */
export const COMMAND_NAMES = Object.keys(COMMAND_REGISTRY);

/**
 * Build a help output for all commands (or a single command).
 * Returns an array of TerminalLine objects ready to write to xterm.
 */
export function buildHelpLines(commandName?: string): TerminalLine[] {
  if (commandName) {
    const entry = COMMAND_REGISTRY[commandName];
    if (!entry) {
      return [
        { text: `Unknown command: ${commandName}`, color: "red" },
        { text: "Type 'help' to list all commands.", color: "gray" },
      ];
    }
    const lines: TerminalLine[] = [
      { text: `  ${entry.name}`, color: "cyan" },
      { text: `    ${entry.description}`, color: "default" },
      { text: `    Usage: ${entry.usage}`, color: "gray" },
    ];
    if (entry.subcommands) {
      lines.push({ text: "    Subcommands:", color: "gray" });
      entry.subcommands.forEach((sc) => {
        lines.push({ text: `      ${sc.name.padEnd(12)} ${sc.description}`, color: "default" });
      });
    }
    if (entry.requiredRole) {
      lines.push({ text: `    Requires role: ${entry.requiredRole}`, color: "yellow" });
    }
    return lines;
  }

  // Full help listing
  const lines: TerminalLine[] = [
    { text: "DevPilot Terminal — App Commands", color: "cyan" },
    { text: "─────────────────────────────────────────", color: "gray" },
    { text: "", color: "default" },
  ];

  Object.values(COMMAND_REGISTRY).forEach((entry) => {
    lines.push({ text: `  ${entry.name.padEnd(12)} ${entry.description}`, color: "default" });
    lines.push({ text: `               Usage: ${entry.usage}`, color: "gray" });
    if (entry.requiredRole) {
      lines.push({ text: `               ⚠ Requires role: ${entry.requiredRole}`, color: "yellow" });
    }
    lines.push({ text: "", color: "default" });
  });

  lines.push({
    text: "For a local shell, click 'Connect Local Shell' or use the agent panel.",
    color: "gray",
  });

  return lines;
}
