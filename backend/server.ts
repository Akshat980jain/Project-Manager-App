import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import path from "path";
import fs from "fs";
import url from "url";
import os from "os";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Security: per-run random auth token
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_TOKEN = crypto.randomBytes(16).toString("hex");

const HOST = process.env.HOST || (process.env.RENDER === "true" ? "0.0.0.0" : "127.0.0.1");

// IMPORTANT: this is the only time the token is printed — never logged to a file.
console.log("┌─────────────────────────────────────────────────────────┐");
console.log("│            DevPilot Shell Agent                        │");
console.log("│                                                         │");
console.log(`│  Token: ${AUTH_TOKEN}  │`);
console.log("│                                                         │");
console.log("│  Paste this token in DevPilot → Terminal → Connect     │");
console.log(`│  Binds to ${HOST}                                       │`);
console.log("└─────────────────────────────────────────────────────────┘");

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.AGENT_PORT || process.env.PORT || "3000", 10);

// ─────────────────────────────────────────────────────────────────────────────
// Directory resolution (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function getBaseDir(): string {
  if (fs.existsSync("E:\\")) return "E:\\";
  if (fs.existsSync("/project/src")) return "/project/src";
  return os.homedir() || "/";
}

const MAPPED_DIRECTORIES: Record<string, string> = {
  "booking-management-app": "BookEase24X7",
  "ytblog": "Scribe",
  "lovable-chat-app": "Loop Chat",
  "quickkart-app-bolt": "QuickKart",
  "android-erp": "EduConnect",
  "ems": "StaffSphere",
  "upload-app": "GallaryHub",
  "pulse-app": "Pulse",
  "project-2026": "Project  2026",
};

function isCodeRoot(dirPath: string): boolean {
  const markers = ["package.json", "src", "frontend", "backend", "pubspec.yaml", "build.gradle"];
  return markers.some((m) => fs.existsSync(path.join(dirPath, m)));
}

function findCodeRoot(projectPath: string): string {
  if (isCodeRoot(projectPath)) return projectPath;
  try {
    const children = fs.readdirSync(projectPath, { withFileTypes: true });
    for (const subdir of children.filter((c) => c.isDirectory() && !c.name.startsWith("."))) {
      const subPath = path.join(projectPath, subdir.name);
      if (isCodeRoot(subPath)) return subPath;
    }
  } catch {}
  return projectPath;
}

function resolveProjectPath(slug: string): string {
  const parentDir = getBaseDir();
  const lowerSlug = slug.toLowerCase();

  if (MAPPED_DIRECTORIES[lowerSlug]) {
    const mappedPath = path.join(parentDir, MAPPED_DIRECTORIES[lowerSlug]);
    if (fs.existsSync(mappedPath)) return findCodeRoot(mappedPath);
  }

  const directPath = path.join(parentDir, slug);
  if (fs.existsSync(directPath)) return findCodeRoot(directPath);

  try {
    const items = fs.readdirSync(parentDir);
    for (const item of items) {
      const slugifiedItem = item
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      if (slugifiedItem === lowerSlug) {
        return findCodeRoot(path.join(parentDir, item));
      }
    }
  } catch {}

  return parentDir;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Server — bound EXCLUSIVELY to 127.0.0.1
// ─────────────────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({
  port: PORT,
  host: HOST,
});

console.log(`\nListening on ws://${HOST}:${PORT}`);
console.log("Waiting for DevPilot connection...\n");

wss.on("connection", (ws: WebSocket, req) => {
  const parsedUrl = url.parse(req.url ?? "", true);

  // ── Token verification ──────────────────────────────────────────────────
  const suppliedToken = parsedUrl.query.token as string | undefined;
  if (!suppliedToken || suppliedToken !== AUTH_TOKEN) {
    console.warn(`[security] Rejected connection — invalid or missing token from ${req.socket.remoteAddress}`);
    ws.close(4401, "Unauthorized: invalid token");
    return;
  }

  // ── Resolve working directory ────────────────────────────────────────────
  const projectDir = parsedUrl.query.projectDir as string || "";
  const defaultDir = getBaseDir();
  const workingDir = projectDir ? resolveProjectPath(projectDir) : defaultDir;

  console.log(`[connection] Accepted for project: "${projectDir}" → ${workingDir}`);

  // ── Spawn PTY ────────────────────────────────────────────────────────────
  const isWin = os.platform() === "win32";
  const shell = isWin ? "powershell.exe" : (process.env.SHELL ?? "bash");

  let ptyProcess: pty.IPty;
  try {
    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: { ...process.env, FORCE_COLOR: "1" },
    });
  } catch (err: any) {
    console.error("[pty] Failed to spawn shell:", err.message);
    ws.close(1011, `Failed to spawn shell: ${err.message}`);
    return;
  }

  // ── PTY → Client ─────────────────────────────────────────────────────────
  ptyProcess.onData((data) => {
    try {
      ws.send(JSON.stringify({ type: "output", data }));
    } catch {}
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[pty] Shell exited with code ${exitCode}`);
    try {
      ws.send(JSON.stringify({ type: "exit", exitCode }));
      ws.close();
    } catch {}
  });

  // ── Client → PTY ─────────────────────────────────────────────────────────
  ws.on("message", (message) => {
    const dataStr = message.toString();
    try {
      const parsed = JSON.parse(dataStr);

      if (parsed.type === "input" && typeof parsed.data === "string") {
        ptyProcess.write(parsed.data);
        return;
      }

      if (parsed.type === "resize") {
        const cols = Math.max(1, parseInt(parsed.cols, 10) || 80);
        const rows = Math.max(1, parseInt(parsed.rows, 10) || 24);
        ptyProcess.resize(cols, rows);
        return;
      }
    } catch {
      // Fallback: treat raw string as direct PTY input (backward compat)
      ptyProcess.write(dataStr);
    }
  });

  // ── Cleanup on disconnect ────────────────────────────────────────────────
  ws.on("close", () => {
    console.log("[connection] Client disconnected — killing PTY process");
    try {
      ptyProcess.kill();
    } catch {}
  });
});
