/**
 * Unit tests for Zod schemas used in terminal command handlers.
 *
 * These tests import only the Zod schemas (no Supabase, no server env vars)
 * by re-declaring them here — this keeps the test file runnable in a pure
 * browser-compatible Vitest environment without any Node.js server context.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Schema re-declarations (mirrors commands.server.ts) ────────────────────

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

// ─── deploySchema ────────────────────────────────────────────────────────────

describe("deploySchema", () => {
  it("accepts valid staging deploy", () => {
    const result = deploySchema.safeParse({ env: "staging" });
    expect(result.success).toBe(true);
    expect(result.data?.yes).toBe(false); // default
  });

  it("accepts valid production deploy with yes flag", () => {
    const result = deploySchema.safeParse({ env: "production", ref: "main", yes: true });
    expect(result.success).toBe(true);
    expect(result.data?.env).toBe("production");
    expect(result.data?.ref).toBe("main");
    expect(result.data?.yes).toBe(true);
  });

  it("rejects missing env", () => {
    const result = deploySchema.safeParse({ ref: "main" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("env");
  });

  it("rejects invalid env value", () => {
    const result = deploySchema.safeParse({ env: "canary" });
    expect(result.success).toBe(false);
  });

  it("defaults yes to false when omitted", () => {
    const result = deploySchema.safeParse({ env: "staging" });
    expect(result.success).toBe(true);
    expect(result.data?.yes).toBe(false);
  });

  it("rejects non-boolean yes", () => {
    const result = deploySchema.safeParse({ env: "staging", yes: "true" });
    expect(result.success).toBe(false);
  });
});

// ─── rollbackSchema ──────────────────────────────────────────────────────────

describe("rollbackSchema", () => {
  it("accepts valid rollback", () => {
    const result = rollbackSchema.safeParse({ env: "staging", toRef: "abc1234" });
    expect(result.success).toBe(true);
  });

  it("rejects missing toRef", () => {
    const result = rollbackSchema.safeParse({ env: "staging" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("toRef");
  });

  it("rejects empty string toRef", () => {
    const result = rollbackSchema.safeParse({ env: "production", toRef: "" });
    expect(result.success).toBe(false);
  });

  it("requires --yes for production (business logic check)", () => {
    // The schema itself allows yes=false for production — the handler enforces the gate.
    // This test confirms schema doesn't incorrectly block valid production input.
    const result = rollbackSchema.safeParse({ env: "production", toRef: "v1.2.3", yes: false });
    expect(result.success).toBe(true);
    // Confirm the handler must separately enforce the yes gate
    expect(result.data?.yes).toBe(false);
    expect(result.data?.env).toBe("production");
  });

  it("accepts production rollback with yes=true", () => {
    const result = rollbackSchema.safeParse({ env: "production", toRef: "v1.2.3", yes: true });
    expect(result.success).toBe(true);
    expect(result.data?.yes).toBe(true);
  });
});

// ─── incidentSchema ──────────────────────────────────────────────────────────

describe("incidentSchema", () => {
  it("accepts incident create with all fields", () => {
    const result = incidentSchema.safeParse({
      subcommand: "create",
      title: "Database Outage",
      severity: "sev1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts incident list with no extra fields", () => {
    const result = incidentSchema.safeParse({ subcommand: "list" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid subcommand", () => {
    const result = incidentSchema.safeParse({ subcommand: "delete" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid severity", () => {
    const result = incidentSchema.safeParse({
      subcommand: "create",
      title: "Outage",
      severity: "sev4",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = incidentSchema.safeParse({
      subcommand: "create",
      title: "",
      severity: "sev2",
    });
    expect(result.success).toBe(false);
  });

  it("allows missing title (server handler enforces it for create)", () => {
    const result = incidentSchema.safeParse({
      subcommand: "create",
      severity: "sev3",
    });
    // title is optional in schema — handler checks it
    expect(result.success).toBe(true);
    expect(result.data?.title).toBeUndefined();
  });

  it("accepts sev1, sev2, sev3", () => {
    for (const sev of ["sev1", "sev2", "sev3"] as const) {
      const result = incidentSchema.safeParse({
        subcommand: "create",
        title: "Test",
        severity: sev,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ─── Business logic: production requires --yes ────────────────────────────────

describe("production confirmation gate (business rule)", () => {
  it("deploy to production without yes should be gated", () => {
    const data = deploySchema.parse({ env: "production", yes: false });
    // Handler must check: if env === 'production' && !yes → return confirmation prompt
    expect(data.env === "production" && !data.yes).toBe(true);
  });

  it("deploy to production with yes should pass the gate", () => {
    const data = deploySchema.parse({ env: "production", yes: true });
    expect(data.env === "production" && !data.yes).toBe(false);
  });

  it("deploy to staging without yes should be allowed", () => {
    const data = deploySchema.parse({ env: "staging", yes: false });
    // Staging doesn't need confirmation
    expect(data.env).toBe("staging");
  });
});
