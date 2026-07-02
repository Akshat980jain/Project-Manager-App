// Client-side wrappers for process management & system telemetry APIs

// 1. Get the list of all tracked process statuses
export async function getProcessStatuses(): Promise<Record<string, { status: string; port?: number; createdAt?: string }>> {
  try {
    const res = await fetch("/api/get-process-statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to load process statuses");
    return await res.json();
  } catch (e) {
    console.error("Error loading process statuses:", e);
    return {};
  }
}

// 2. Start a dev server inside the project directory
export async function startDevServer(args: { data: { projectDir: string; script: string } }) {
  const res = await fetch("/api/start-dev-server", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to start dev server");
  }
  return await res.json();
}

// 3. Stop a dev server cleanly
export async function stopDevServer(args: { data: { projectDir: string } }) {
  const res = await fetch("/api/stop-dev-server", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to stop dev server");
  }
  return await res.json();
}

// 4. Real-time server log streaming
export async function streamLogs(args: { data: { projectDir: string } }): Promise<Response> {
  return fetch(`/api/stream-logs?projectDir=${encodeURIComponent(args.data.projectDir)}`);
}

// 5. Scan port status dynamically
export async function scanPort(args: { data: { port: number } }): Promise<boolean> {
  try {
    const res = await fetch("/api/scan-port", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args.data),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.active;
  } catch {
    return false;
  }
}

// 6. Launch Emulator & Deploy Android APK
export async function deployToEmulator(args: { data: { projectDir: string; apkPath?: string; packageId: string } }): Promise<{ message: string }> {
  const res = await fetch("/api/deploy-to-emulator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to deploy to emulator");
  }
  return await res.json();
}

// ==========================================
// ==== SYSTEM & RESOURCE MONITORING APIs ===
// ==========================================

export interface SystemStats {
  cpu: number;
  ram: {
    used: number;
    total: number;
  };
  disk: {
    used: number;
    total: number;
    mount: string;
  } | null;
}

export interface RunningProcess {
  pid: number;
  projectSlug: string;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
}

export interface PortBinding {
  port: number;
  projectSlug: string;
  pid: number;
  status: "active" | "inactive";
}

export interface DiskUsageItem {
  dirName: string;
  sizeBytes: number;
}

// GET /api/system/stats
export async function getSystemStats(): Promise<SystemStats> {
  const res = await fetch("/api/system/stats");
  if (!res.ok) throw new Error("Failed to load system stats");
  return await res.json();
}

// GET /api/system/processes
export async function getSystemProcesses(): Promise<RunningProcess[]> {
  const res = await fetch("/api/system/processes");
  if (!res.ok) throw new Error("Failed to load system processes");
  return await res.json();
}

// GET /api/system/ports
export async function getSystemPorts(): Promise<PortBinding[]> {
  const res = await fetch("/api/system/ports");
  if (!res.ok) throw new Error("Failed to load system ports");
  return await res.json();
}

// GET /api/system/disk-usage
export async function getSystemDiskUsage(includeNodeModules = false): Promise<DiskUsageItem[]> {
  const res = await fetch(`/api/system/disk-usage?includeNodeModules=${includeNodeModules}`);
  if (!res.ok) throw new Error("Failed to load system disk usage");
  return await res.json();
}

// ==========================================
// ==== PROJECT SPECIFIC MANAGEMENT APIs ====
// ==========================================

export interface EnvDiff {
  missing: string[];
  extra: string[];
}

export interface DependencyDetails {
  outdated: Record<string, { current: string; wanted: string; latest: string; dependent: string; location: string }>;
  audit: {
    vulnerabilities: Record<string, { name: string; severity: string; via: any; range: string; effects: string[] }>;
    metadata?: {
      vulnerabilities: {
        info: number;
        low: number;
        moderate: number;
        high: number;
        critical: number;
        total: number;
      };
      dependencies: {
        prod: number;
        dev: number;
        optional: number;
        peer: number;
        peerOptional: number;
        total: number;
      };
    };
  };
}

export interface RuntimeDetails {
  current: string;
  expected: string;
  matches: boolean;
}

// GET /api/projects/:slug/env
export async function getProjectEnv(slug: string, reveal = false): Promise<Record<string, string>> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/env?reveal=${reveal}`);
  if (!res.ok) throw new Error("Failed to load environment variables");
  return await res.json();
}

// POST /api/projects/:slug/env
export async function updateProjectEnv(slug: string, envMap: Record<string, string>): Promise<{ success: boolean }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/env`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: envMap }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to save environment variables");
  }
  return await res.json();
}

// GET /api/projects/:slug/env-diff
export async function getProjectEnvDiff(slug: string): Promise<EnvDiff> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/env-diff`);
  if (!res.ok) throw new Error("Failed to load environment variable comparisons");
  return await res.json();
}

// GET /api/projects/:slug/deps
export async function getProjectDeps(slug: string): Promise<DependencyDetails> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/deps`);
  if (!res.ok) throw new Error("Failed to load dependencies audit");
  return await res.json();
}

// GET /api/projects/:slug/runtime
export async function getProjectRuntime(slug: string): Promise<RuntimeDetails> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/runtime`);
  if (!res.ok) throw new Error("Failed to load project runtime information");
  return await res.json();
}

// ==========================================
// ==== BUILD & DOCKER MANAGEMENT APIs ======
// ==========================================

export interface ProjectBuild {
  id: string;
  project_id: string;
  status: "queued" | "running" | "success" | "failed";
  started_at: string;
  finished_at?: string;
  exit_code?: number;
  log_excerpt?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: string;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  createdAt: string;
}

// POST /api/projects/:slug/build
export async function triggerProjectBuild(slug: string): Promise<{ success: boolean; buildId: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to trigger build");
  }
  return await res.json();
}

// GET /api/projects/:slug/builds
export async function getProjectBuilds(slug: string): Promise<ProjectBuild[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/builds`);
  if (!res.ok) throw new Error("Failed to load build history");
  return await res.json();
}

// GET /api/stream-build-logs?buildId=:buildId
export async function streamBuildLogs(buildId: string): Promise<Response> {
  const res = await fetch(`/api/stream-build-logs?buildId=${encodeURIComponent(buildId)}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to connect to build log stream");
  }
  return res;
}

// GET /api/projects/:slug/docker/containers
export async function getDockerContainers(slug: string): Promise<DockerContainer[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/docker/containers`);
  if (!res.ok) throw new Error("Failed to load Docker containers");
  return await res.json();
}

// GET /api/projects/:slug/docker/images
export async function getDockerImages(slug: string): Promise<DockerImage[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/docker/images`);
  if (!res.ok) throw new Error("Failed to load Docker images");
  return await res.json();
}

// POST /api/projects/:slug/docker/action
export async function runDockerAction(slug: string, containerId: string, action: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/docker/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ containerId, action })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to execute Docker action");
  }
  return await res.json();
}
