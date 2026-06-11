// Client-side wrappers for process management APIs

// Get the list of all tracked process statuses
export async function getProcessStatuses(): Promise<Record<string, { status: string; port?: number; createdAt?: string }>> {
  const res = await fetch("/api/get-process-statuses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Start a dev server inside the project directory
export async function startDevServer(args: { data: { projectDir: string; script: string } }) {
  const res = await fetch("/api/start-dev-server", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Stop a dev server cleanly
export async function stopDevServer(args: { data: { projectDir: string } }) {
  const res = await fetch("/api/stop-dev-server", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Real-time server log streaming
export async function streamLogs(args: { data: { projectDir: string } }): Promise<Response> {
  const res = await fetch(`/api/stream-logs?projectDir=${encodeURIComponent(args.data.projectDir)}`);
  if (!res.ok) throw new Error(await res.text());
  return res;
}

// Scan port status dynamically
export async function scanPort(args: { data: { port: number } }) {
  const res = await fetch("/api/scan-port", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Launch Emulator & Deploy Android APK
export async function deployToEmulator(args: { data: { projectDir: string; apkPath?: string; packageId: string } }) {
  const res = await fetch("/api/deploy-to-emulator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
