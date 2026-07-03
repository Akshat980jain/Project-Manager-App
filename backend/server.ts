import { WebSocketServer } from "ws";
import * as pty from "node-pty";
import path from "path";
import fs from "fs";
import url from "url";
import os from "os";

const PORT = 3000;

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

function resolveProjectPath(slug: string): string {
  const parentDir = "E:\\";
  const lowerSlug = slug.toLowerCase();
  
  if (MAPPED_DIRECTORIES[lowerSlug]) {
    const mappedPath = path.join(parentDir, MAPPED_DIRECTORIES[lowerSlug]);
    if (fs.existsSync(mappedPath)) {
      return mappedPath;
    }
  }
  
  const directPath = path.join(parentDir, slug);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  
  try {
    const items = fs.readdirSync(parentDir);
    for (const item of items) {
      const slugifiedItem = item
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
        
      if (slugifiedItem === lowerSlug) {
        return path.join(parentDir, item);
      }
    }
  } catch {}
  
  return parentDir;
}

const wss = new WebSocketServer({ port: PORT });
console.log(`DevEngine Terminal Agent listening on ws://localhost:${PORT}`);

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url ?? "", true);
  const projectDir = parsedUrl.query.projectDir as string || "";
  const workingDir = projectDir ? resolveProjectPath(projectDir) : "E:\\";
  
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
