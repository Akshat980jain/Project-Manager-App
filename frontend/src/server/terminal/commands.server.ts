/**
 * Terminal App Command Handlers — Server-Side Only (.server.ts)
 *
 * These handlers are called by the Vite middleware (in dev) and would be
 * called by an Express/Node server in production. Each handler:
 *  1. Verifies the Supabase JWT from the Authorization header
 *  2. Validates inputs with Zod
 *  3. Executes the command (stub implementations with Supabase writes)
 *  4. Writes an audit log row for mutating commands
 *  5. Returns { lines: TerminalLine[] }
 *
 * NOTE: CI/CD, incident-management, and log-store integrations are stubbed
 * with realistic responses. Wire in real API clients by replacing the
 * sections marked with: // TODO: replace with real API call
 */

import { z } from "zod";
import { writeAuditLog, verifySupabaseToken, userHasRole } from "./audit.server.js";
import type { TerminalLine } from "../../lib/terminal/registry.js";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────────────────────────────────

const deploySchema = z.object({
  env: z.enum(["staging", "production"]),
  ref: z.string().optional(),
  yes: z.boolean().optional().default(false),
});

const rollbackSchema = z.object({
  env: z.enum(["staging", "production"]),
  toRef: z.string().min(1, "toRef is required"),
  yes: z.boolean().optional().default(false),
});

const incidentSchema = z.object({
  subcommand: z.enum(["create", "list"]),
  title: z.string().min(1).optional(),
  severity: z.enum(["sev1", "sev2", "sev3"]).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build error line
// ─────────────────────────────────────────────────────────────────────────────

function errLine(text: string): TerminalLine[] {
  return [{ text, color: "red" }];
}

function infoLine(text: string): TerminalLine[] {
  return [{ text, color: "cyan" }];
}

function okLine(text: string): TerminalLine[] {
  return [{ text, color: "green" }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard — reused by every handler
// ─────────────────────────────────────────────────────────────────────────────

async function requireAuth(
  authHeader: string | undefined
): Promise<{ userId: string } | { error: TerminalLine[] }> {
  const userId = await verifySupabaseToken(authHeader);
  if (!userId) {
    return { error: errLine("Unauthorized — please sign in and retry.") };
  }
  return { userId };
}

// ─────────────────────────────────────────────────────────────────────────────
// statusFn
// ─────────────────────────────────────────────────────────────────────────────

export async function statusFn(authHeader: string | undefined): Promise<{ lines: TerminalLine[] }> {
  const auth = await requireAuth(authHeader);
  if ("error" in auth) return { lines: auth.error };

  // TODO: replace with real health-check API calls
  const services = [
    { name: "API Gateway",    status: "up",   latencyMs: 24  },
    { name: "Database",       status: "up",   latencyMs: 8   },
    { name: "Auth Service",   status: "up",   latencyMs: 15  },
    { name: "CI/CD Runner",   status: "up",   latencyMs: 42  },
    { name: "Log Store",      status: "up",   latencyMs: 19  },
    { name: "Incident Track", status: "up",   latencyMs: 31  },
  ];

  const lines: TerminalLine[] = [
    { text: "Service Health — " + new Date().toUTCString(), color: "cyan" },
    { text: "────────────────────────────────────────────", color: "gray" },
  ];

  for (const svc of services) {
    const isUp = svc.status === "up";
    const indicator = isUp ? "●" : "○";
    lines.push({
      text: `  ${indicator} ${svc.name.padEnd(20)} ${svc.status.padEnd(6)} ${svc.latencyMs}ms`,
      color: isUp ? "green" : "red",
    });
  }

  lines.push({ text: "", color: "default" });
  lines.push({ text: `All ${services.length} services operational`, color: "green" });

  return { lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// deployFn
// ─────────────────────────────────────────────────────────────────────────────

export async function deployFn(
  authHeader: string | undefined,
  body: unknown
): Promise<{ lines: TerminalLine[] }> {
  const auth = await requireAuth(authHeader);
  if ("error" in auth) return { lines: auth.error };

  const parsed = deploySchema.safeParse(body);
  if (!parsed.success) {
    return {
      lines: [
        ...errLine("Invalid deploy arguments:"),
        ...parsed.error.issues.map((i) => ({ text: `  • ${i.path.join(".")}: ${i.message}`, color: "red" as const })),
        { text: "Usage: deploy --env <staging|production> [--ref <git-ref>] [--yes]", color: "gray" },
      ],
    };
  }

  const { env, ref, yes } = parsed.data;

  // Production requires explicit --yes flag
  if (env === "production" && !yes) {
    return {
      lines: [
        { text: "⚠  Production deploy requires explicit confirmation.", color: "yellow" },
        { text: `   Re-run: deploy --env production${ref ? ` --ref ${ref}` : ""} --yes`, color: "gray" },
      ],
    };
  }

  // Role gate for production
  if (env === "production") {
    const hasRole = await userHasRole(auth.userId, "deployer");
    if (!hasRole) {
      return { lines: errLine("Permission denied — deployer role required for production deployments.") };
    }
  }

  // TODO: replace with real CI/CD API call (e.g. GitHub Actions, GitLab CI, Render deploy hook)
  const runId = `run_${Date.now().toString(36)}`;
  const runUrl = `https://ci.example.com/runs/${runId}`;

  await writeAuditLog({
    userId: auth.userId,
    action: "deploy",
    args: { env, ref: ref ?? "HEAD" },
    resultSummary: `Triggered deploy to ${env}, run ${runId}`,
  });

  return {
    lines: [
      ...infoLine(`Deploying to ${env}${ref ? ` @ ${ref}` : " (HEAD)"}...`),
      ...okLine(`✓ Deploy triggered — Run ID: ${runId}`),
      { text: `  Track progress: ${runUrl}`, color: "cyan" },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// rollbackFn
// ─────────────────────────────────────────────────────────────────────────────

export async function rollbackFn(
  authHeader: string | undefined,
  body: unknown
): Promise<{ lines: TerminalLine[] }> {
  const auth = await requireAuth(authHeader);
  if ("error" in auth) return { lines: auth.error };

  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) {
    return {
      lines: [
        ...errLine("Invalid rollback arguments:"),
        ...parsed.error.issues.map((i) => ({ text: `  • ${i.path.join(".")}: ${i.message}`, color: "red" as const })),
        { text: "Usage: rollback --env <staging|production> --to <git-ref> [--yes]", color: "gray" },
      ],
    };
  }

  const { env, toRef, yes } = parsed.data;

  if (env === "production" && !yes) {
    return {
      lines: [
        { text: "⚠  Production rollback requires explicit confirmation.", color: "yellow" },
        { text: `   Re-run: rollback --env production --to ${toRef} --yes`, color: "gray" },
      ],
    };
  }

  if (env === "production") {
    const hasRole = await userHasRole(auth.userId, "deployer");
    if (!hasRole) {
      return { lines: errLine("Permission denied — deployer role required for production rollbacks.") };
    }
  }

  // TODO: replace with real CI/CD rollback API call
  const runId = `rb_${Date.now().toString(36)}`;
  const runUrl = `https://ci.example.com/runs/${runId}`;

  await writeAuditLog({
    userId: auth.userId,
    action: "rollback",
    args: { env, toRef },
    resultSummary: `Triggered rollback of ${env} to ${toRef}, run ${runId}`,
  });

  return {
    lines: [
      ...infoLine(`Rolling back ${env} to ${toRef}...`),
      ...okLine(`✓ Rollback triggered — Run ID: ${runId}`),
      { text: `  Track progress: ${runUrl}`, color: "cyan" },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// incidentFn
// ─────────────────────────────────────────────────────────────────────────────

export async function incidentFn(
  authHeader: string | undefined,
  body: unknown
): Promise<{ lines: TerminalLine[] }> {
  const auth = await requireAuth(authHeader);
  if ("error" in auth) return { lines: auth.error };

  const parsed = incidentSchema.safeParse(body);
  if (!parsed.success) {
    return {
      lines: [
        ...errLine("Invalid incident arguments:"),
        ...parsed.error.issues.map((i) => ({ text: `  • ${i.path.join(".")}: ${i.message}`, color: "red" as const })),
        { text: "Usage: incident create --title <text> --severity <sev1|sev2|sev3>", color: "gray" },
        { text: "       incident list", color: "gray" },
      ],
    };
  }

  const { subcommand, title, severity } = parsed.data;

  if (subcommand === "list") {
    // TODO: replace with real incident management API call
    return {
      lines: [
        { text: "Recent Incidents", color: "cyan" },
        { text: "─────────────────────────────────────────────", color: "gray" },
        { text: "  No open incidents. All systems normal.", color: "green" },
      ],
    };
  }

  // subcommand === "create"
  if (!title) {
    return { lines: errLine("--title is required for incident create") };
  }
  if (!severity) {
    return { lines: errLine("--severity is required (sev1|sev2|sev3)") };
  }

  // TODO: replace with real incident management API call
  const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;
  const incidentUrl = `https://incidents.example.com/${incidentId}`;
  const severityColors: Record<string, TerminalLine["color"]> = {
    sev1: "red",
    sev2: "yellow",
    sev3: "cyan",
  };

  await writeAuditLog({
    userId: auth.userId,
    action: "incident.create",
    args: { title, severity },
    resultSummary: `Created incident ${incidentId}: ${title}`,
  });

  return {
    lines: [
      { text: `✓ Incident created: ${incidentId}`, color: severityColors[severity] },
      { text: `  Title:    ${title}`, color: "default" },
      { text: `  Severity: ${severity.toUpperCase()}`, color: severityColors[severity] },
      { text: `  Link:     ${incidentUrl}`, color: "cyan" },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpFn
// ─────────────────────────────────────────────────────────────────────────────

export async function helpFn(
  authHeader: string | undefined,
  commandName?: string
): Promise<{ lines: TerminalLine[] }> {
  // help is public — no auth required, just use the registry
  const { buildHelpLines } = await import("../../lib/terminal/registry.js");
  return { lines: buildHelpLines(commandName) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logs Stream — handled separately in logs-stream.server.ts
// (this file just exports a type for the SSE event shape)
// ─────────────────────────────────────────────────────────────────────────────

export interface LogStreamEvent {
  type: "log" | "error" | "end";
  text: string;
  timestamp: string;
}
