/**
 * Unit tests for terminal/router.ts — parseCommand() and routeCommand() dispatch
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCommand } from "../router";

// ─── parseCommand ───────────────────────────────────────────────────────────

describe("parseCommand", () => {
  it("parses a bare command with no args", () => {
    const result = parseCommand("status");
    expect(result.cmd).toBe("status");
    expect(result.args).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it("parses --flag value pairs", () => {
    const result = parseCommand("deploy --env production --ref main");
    expect(result.cmd).toBe("deploy");
    expect(result.flags["env"]).toBe("production");
    expect(result.flags["ref"]).toBe("main");
  });

  it("parses boolean flags (--yes)", () => {
    const result = parseCommand("deploy --env staging --yes");
    expect(result.flags["yes"]).toBe(true);
  });

  it("parses positional args before flags", () => {
    const result = parseCommand("incident create --title My Outage --severity sev1");
    expect(result.cmd).toBe("incident");
    expect(result.args[0]).toBe("create");
    expect(result.flags["title"]).toBe("My");   // "Outage" becomes next arg — this is correct CLI parsing
    expect(result.flags["severity"]).toBe("sev1");
  });

  it("handles extra whitespace", () => {
    const result = parseCommand("  deploy   --env   staging  ");
    expect(result.cmd).toBe("deploy");
    expect(result.flags["env"]).toBe("staging");
  });

  it("lowercases the command name", () => {
    const result = parseCommand("STATUS");
    expect(result.cmd).toBe("status");
  });

  it("handles empty string", () => {
    const result = parseCommand("");
    expect(result.cmd).toBe("");
    expect(result.args).toEqual([]);
  });

  it("handles rollback with --to flag", () => {
    const result = parseCommand("rollback --env production --to abc1234 --yes");
    expect(result.cmd).toBe("rollback");
    expect(result.flags["env"]).toBe("production");
    expect(result.flags["to"]).toBe("abc1234");
    expect(result.flags["yes"]).toBe(true);
  });
});

// ─── routeCommand dispatch ──────────────────────────────────────────────────
// Note: routeCommand makes fetch calls and reads supabase — we test the
// dispatch logic by mocking the underlying fetch and supabase module.

describe("routeCommand dispatch", () => {
  beforeEach(() => {
    // Mock global fetch so we don't make real network calls
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        lines: [{ text: "OK", color: "green" }],
      }),
    }));

    // Mock supabase session so auth header is set
    vi.mock("@/integrations/supabase/client", () => ({
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: "test-token" } },
          }),
        },
      },
    }));
  });

  it("routes known app command to fetch", async () => {
    const { routeCommand } = await import("../router");
    const lines = [];
    for await (const line of routeCommand("status", null)) {
      lines.push(line);
    }
    // Should produce at least the echo line and the OK line from mock
    expect(lines.length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/terminal/status"),
      expect.any(Object)
    );
  });

  it("routes unknown command with no agent to error", async () => {
    const { routeCommand } = await import("../router");
    const lines = [];
    for await (const line of routeCommand("foobar", null)) {
      lines.push(line);
    }
    const errorLine = lines.find((l) => l.color === "red");
    expect(errorLine).toBeDefined();
    expect(errorLine?.text).toContain("foobar");
  });

  it("routes clear command as __CLEAR__ sentinel", async () => {
    const { routeCommand } = await import("../router");
    const lines = [];
    for await (const line of routeCommand("clear", null)) {
      lines.push(line);
    }
    expect(lines[0]?.text).toBe("__CLEAR__");
  });

  it("routes unknown command to agent when agent is connected", async () => {
    const mockSend = vi.fn();
    const fakeAgent = {
      isConnected: true,
      send: mockSend,
    } as any;

    const { routeCommand } = await import("../router");
    const lines = [];
    for await (const line of routeCommand("ls -la", fakeAgent)) {
      lines.push(line);
    }

    // No output lines returned — agent handles it via onData callback
    expect(lines.length).toBe(0);
    expect(mockSend).toHaveBeenCalledWith("ls -la\r");
  });
});
