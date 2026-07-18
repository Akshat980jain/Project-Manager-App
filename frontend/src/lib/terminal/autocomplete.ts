/**
 * Terminal Autocomplete
 *
 * Builds suggestion lists from the command registry (app commands)
 * and optionally from agent-reported completions (v1 stretch: empty stub).
 */

import { COMMAND_REGISTRY, COMMAND_NAMES } from "./registry.js";

export interface AutocompleteSuggestion {
  value: string;          // full value to insert
  label: string;          // display text
  description?: string;   // shown in suggestion popup
}

/**
 * Get autocomplete suggestions for the current input partial.
 *
 * @param partial - Everything the user has typed so far
 * @param agentConnected - Whether the local shell agent is live
 * @returns Sorted list of suggestions
 */
export function getSuggestions(
  partial: string,
  agentConnected = false
): AutocompleteSuggestion[] {
  const trimmed = partial.trimStart();
  if (!trimmed) return [];

  const parts = trimmed.split(/\s+/);
  const firstWord = parts[0].toLowerCase();

  // If only typing the first word, suggest matching command names
  if (parts.length === 1) {
    return COMMAND_NAMES.filter((name) => name.startsWith(firstWord) && name !== firstWord)
      .map((name) => ({
        value: name,
        label: name,
        description: COMMAND_REGISTRY[name]?.description,
      }));
  }

  // If first word is a known command, suggest its flags/subcommands
  const entry = COMMAND_REGISTRY[firstWord];
  if (!entry) {
    // Not a known app command — no suggestions (agent shell handles its own completions)
    return [];
  }

  // Sub-command suggestions
  if (entry.subcommands && parts.length === 2) {
    const subPartial = parts[1].toLowerCase();
    return entry.subcommands
      .filter((sc) => sc.name.startsWith(subPartial) && sc.name !== subPartial)
      .map((sc) => ({
        value: `${firstWord} ${sc.name}`,
        label: sc.name,
        description: sc.description,
      }));
  }

  // Flag suggestions based on the command
  const flagSuggestions = buildFlagSuggestions(firstWord, parts);
  return flagSuggestions;
}

function buildFlagSuggestions(
  cmd: string,
  parts: string[]
): AutocompleteSuggestion[] {
  const usedFlags = new Set(parts.filter((p) => p.startsWith("--")));

  const allFlags: Record<string, AutocompleteSuggestion[]> = {
    deploy: [
      { value: "--env staging", label: "--env staging", description: "Deploy to staging" },
      { value: "--env production", label: "--env production", description: "Deploy to production" },
      { value: "--ref", label: "--ref <git-ref>", description: "Git ref to deploy" },
      { value: "--yes", label: "--yes", description: "Skip confirmation (required for production)" },
    ],
    rollback: [
      { value: "--env staging", label: "--env staging", description: "Rollback staging" },
      { value: "--env production", label: "--env production", description: "Rollback production" },
      { value: "--to", label: "--to <git-ref>", description: "Target git ref" },
      { value: "--yes", label: "--yes", description: "Skip confirmation (required for production)" },
    ],
    logs: [
      { value: "--tail", label: "--tail <n>", description: "Number of lines to replay" },
      { value: "--filter", label: "--filter <text>", description: "Filter by text" },
    ],
    incident: [],
    status: [],
    help: [],
  };

  const candidates = (allFlags[cmd] ?? []).filter(
    (s) => !usedFlags.has(s.value.split(" ")[0])
  );

  const lastPart = parts[parts.length - 1];
  if (lastPart.startsWith("--")) {
    return candidates.filter((s) =>
      s.value.split(" ")[0].startsWith(lastPart)
    );
  }

  return candidates;
}

/**
 * Stretch goal: request completions from the local agent.
 * For v1 this is a no-op stub — wire in actual agent message when needed.
 */
export async function getAgentCompletions(
  _partial: string
): Promise<AutocompleteSuggestion[]> {
  // TODO v2: send { type: 'complete', partial } to agent WS,
  // wait for { type: 'completions', items: string[] } response
  return [];
}
