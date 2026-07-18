/**
 * SSE Log-Tailing Endpoint Handler — Server-Side Only
 *
 * Streams audit log entries + live log lines via Server-Sent Events.
 * In dev: served by the Vite middleware plugin in vite.config.ts.
 *
 * Protocol:
 *   event: log
 *   data: { text, color, timestamp }
 *
 * Clients close the stream by closing the EventSource. The server
 * clears the interval and closes the response when `req` emits 'close'.
 */

import type { IncomingMessage, ServerResponse } from "http";
import { verifySupabaseToken } from "./audit.server.js";
import { createClient } from "@supabase/supabase-js";

// Rolling in-memory log buffer — filled by command handlers in dev
const LOG_BUFFER: Array<{ text: string; timestamp: string }> = [];
const MAX_BUFFER = 200;

/** Push a line into the in-memory log buffer (called by command handlers) */
export function pushLogLine(text: string) {
  LOG_BUFFER.push({ text, timestamp: new Date().toISOString() });
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
}

/**
 * SSE handler — attach to GET /api/terminal/logs-stream
 */
export async function logsStreamHandler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const authHeader = req.headers["authorization"];
  const userId = await verifySupabaseToken(authHeader);
  if (!userId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  // Parse query params for optional filters
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const tail = parseInt(url.searchParams.get("tail") ?? "50", 10);
  const filter = url.searchParams.get("filter") ?? "";

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = (data: object) => {
    res.write(`event: log\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send welcome line
  sendEvent({ text: `[Log stream started — user: ${userId}]`, timestamp: new Date().toISOString(), color: "cyan" });

  // Replay recent in-memory buffer
  const recent = LOG_BUFFER.slice(-tail).filter((l) =>
    filter ? l.text.toLowerCase().includes(filter.toLowerCase()) : true
  );
  for (const entry of recent) {
    sendEvent({ text: entry.text, timestamp: entry.timestamp, color: "gray" });
  }

  // Also tail Supabase audit log for persisted entries
  try {
    const url2 = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const key = process.env.VITE_SUPABASE_ANON_KEY || "";
    if (url2 && key) {
      const sb = createClient(url2, key, { auth: { persistSession: false } });
      const { data: auditRows } = await sb
        .from("terminal_audit_log")
        .select("action, args, result_summary, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (auditRows) {
        for (const row of auditRows.reverse()) {
          sendEvent({
            text: `[audit] ${row.action} — ${row.result_summary}`,
            timestamp: row.created_at,
            color: "gray",
          });
        }
      }
    }
  } catch {
    // Supabase not configured — continue with in-memory only
  }

  // Keep-alive heartbeat every 15 s so proxies don't drop the connection
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 15_000);

  // Poll new buffer entries every 2 s
  let lastIdx = LOG_BUFFER.length;
  const poll = setInterval(() => {
    try {
      const newEntries = LOG_BUFFER.slice(lastIdx).filter((l) =>
        filter ? l.text.toLowerCase().includes(filter.toLowerCase()) : true
      );
      lastIdx = LOG_BUFFER.length;
      for (const entry of newEntries) {
        sendEvent({ text: entry.text, timestamp: entry.timestamp, color: "default" });
      }
    } catch {
      clearInterval(poll);
    }
  }, 2_000);

  // Cleanup when client disconnects
  req.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(poll);
    res.end();
  });
}
