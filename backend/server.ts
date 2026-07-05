import { WebSocketServer } from "ws";
import * as pty from "node-pty";
import path from "path";
import fs from "fs";
import url from "url";
import os from "os";

const PORT = process.env.PORT || 3000;

const MAPPED_DIRECTORIES: Record<string, string> = {
  "booking-management-app": "BookEase24X7",
  "ytblog": "Scribe",
  "lovable-chat-app": "Loop Chat",
  "quickkart-app-bolt": "QuickKart",
  "android-erp": "EduConnect",
  "ems": "StaffSphere",
  "upload-app": "GallaryHub",
  "pulse-app": "Pulse",
  "project-2026": "Project  2026"
};

/**
 * Checks if a directory looks like a code project root by looking for
 * common project markers (package.json, src/, frontend/, backend/).
 */
function isCodeRoot(dirPath: string): boolean {
  const markers = ["package.json", "src", "frontend", "backend", "pubspec.yaml", "build.gradle"];
  return markers.some(m => fs.existsSync(path.join(dirPath, m)));
}

/**
 * If the resolved project directory doesn't look like a code root,
 * drill down into subdirectories (up to 1 level) to find one.
 * This handles projects like BookEase24X7/BMS or Pulse/Pulse Web
 * where there's a wrapper directory before the actual code.
 */
function findCodeRoot(projectPath: string): string {
  // If the directory itself looks like a code root, use it directly
  if (isCodeRoot(projectPath)) {
    return projectPath;
  }

  // Otherwise, check immediate subdirectories for a code root
  try {
    const children = fs.readdirSync(projectPath, { withFileTypes: true });
    const subdirs = children.filter(c => c.isDirectory() && !c.name.startsWith("."));

    for (const subdir of subdirs) {
      const subPath = path.join(projectPath, subdir.name);
      if (isCodeRoot(subPath)) {
        return subPath;
      }
    }
  } catch {}

  // Fallback: return the original path
  return projectPath;
}

function resolveProjectPath(slug: string): string {
  let parentDir = "E:\\";
  if (!fs.existsSync(parentDir)) {
    parentDir = os.homedir() || "/";
  }
  const lowerSlug = slug.toLowerCase();
  
  if (MAPPED_DIRECTORIES[lowerSlug]) {
    const mappedPath = path.join(parentDir, MAPPED_DIRECTORIES[lowerSlug]);
    if (fs.existsSync(mappedPath)) {
      return findCodeRoot(mappedPath);
    }
  }
  
  const directPath = path.join(parentDir, slug);
  if (fs.existsSync(directPath)) {
    return findCodeRoot(directPath);
  }
  
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

const wss = new WebSocketServer({ port: PORT });
console.log(`DevPilot Terminal Agent listening on ws://localhost:${PORT}`);

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url ?? "", true);
  const projectDir = parsedUrl.query.projectDir as string || "";
  
  let defaultDir = "E:\\";
  if (!fs.existsSync(defaultDir)) {
    defaultDir = os.homedir() || "/";
  }
  const workingDir = projectDir ? resolveProjectPath(projectDir) : defaultDir;
  
  console.log(`Client connected for project: ${projectDir} -> resolved dir: ${workingDir}`);
  
  const isWin = os.platform() === "win32";
  const shell = isWin ? "powershell.exe" : "bash";
  
  let ptyProcess: pty.IPty;
  try {
    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: { ...process.env, FORCE_COLOR: "1" }
    });
  } catch (err: any) {
    console.error("Failed to spawn shell process:", err);
    ws.close(1011, `Failed to spawn shell: ${err.message}`);
    return;
  }
  
  // Stream data from PTY process to WebSocket client
  ptyProcess.onData((data) => {
    ws.send(data);
  });
  
  // Handle PTY process exit
  ptyProcess.onExit(({ exitCode }) => {
    console.log(`Shell process exited with code ${exitCode}`);
    try {
      ws.send(`\r\n[Shell exited with code ${exitCode}]\r\n`);
      ws.close();
    } catch {}
  });
  
  // Handle inputs from WebSocket client to PTY process
  ws.on("message", (message) => {
    const dataStr = message.toString();
    try {
      // Check if it's a resize command
      const parsed = JSON.parse(dataStr);
      if (parsed.type === "resize") {
        const cols = parsed.cols || 80;
        const rows = parsed.rows || 24;
        ptyProcess.resize(cols, rows);
        return;
      }
    } catch {}
    
    // Write keystrokes directly to the PTY process
    ptyProcess.write(dataStr);
  });
  
  ws.on("close", () => {
    console.log("WebSocket client disconnected, killing PTY process...");
    try {
      ptyProcess.kill();
    } catch {}
  });
});
