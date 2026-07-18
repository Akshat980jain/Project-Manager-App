/**
 * Audit Log Helper — Server-Side Only (.server.ts)
 *
 * Writes a row to `terminal_audit_log` in Supabase for every mutating
 * terminal command (deploy, rollback, incident create).
 *
 * This file uses the service-role key so it can bypass RLS for inserts.
 * It must never be imported from client code (the .server.ts suffix
 * prevents Vite from bundling it into the browser bundle).
 */

import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  // Prefer the service-role key for server-side writes; fall back to anon key
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) {
    console.warn("[audit] Supabase credentials not configured — audit log skipped");
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AuditEntry {
  userId: string;
  action: string;
  args: Record<string, unknown>;
  resultSummary: string;
}

/**
 * Write a single audit log row. Fails silently — a broken audit log
 * must never block the command response.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const sb = getServiceClient();
    if (!sb) return;

    const { error } = await sb.from("terminal_audit_log").insert({
      user_id: entry.userId,
      action: entry.action,
      args: entry.args,
      result_summary: entry.resultSummary,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[audit] Failed to write audit log:", error.message);
    }
  } catch (err) {
    console.error("[audit] Unexpected error writing audit log:", err);
  }
}

/**
 * Verify a Supabase JWT token from an Authorization header.
 * Returns the user ID if valid, null otherwise.
 */
export async function verifySupabaseToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!url || !anonKey) return null;

    const sb = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * Check if a user has a required role (admin or deployer).
 * Queries the `user_roles` table in Supabase.
 */
export async function userHasRole(
  userId: string,
  role: "admin" | "deployer"
): Promise<boolean> {
  try {
    const sb = getServiceClient();
    if (!sb) return false;

    const { data } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // Admin always passes; deployer role or admin role passes the deployer gate
    return !!data?.some(
      (r: { role: string }) =>
        r.role === role || r.role === "admin"
    );
  } catch {
    return false;
  }
}
