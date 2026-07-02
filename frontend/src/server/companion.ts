import * as http from "http";
import * as url from "url";
import * as fs from "fs/promises";
import { existsSync, createWriteStream, mkdirSync } from "fs";
import * as path from "path";
import { spawn, exec, ChildProcess } from "child_process";
import { promisify } from "util";
import * as net from "net";
import * as si from "systeminformation";
import pidusage from "pidusage";

const execPromise = promisify(exec);

// Cache for E:\ drive recursive disk usage calculations
let diskUsageCache: { timestamp: number; data: any } = { timestamp: 0, data: null };

// Helper to compute recursive folder sizes
async function getFolderSizeRecursively(dirPath: string, includeNodeModules: boolean): Promise<number> {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (!includeNodeModules && entry.name === "node_modules") continue;
        if (entry.name === ".git" || entry.name === "$RECYCLE.BIN" || entry.name === "System Volume Information") continue;
        size += await getFolderSizeRecursively(fullPath, includeNodeModules);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        } catch {}
      }
    }
  } catch {}
  return size;
}

// Helper to parse .env file content
function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let val = trimmed.slice(index + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

// Helper to format env map to .env string
function formatEnvContent(envMap: Record<string, string>): string {
  return Object.entries(envMap)
    .map(([k, v]) => {
      const needsQuotes = /[\s"']/.test(v);
      const formattedVal = needsQuotes ? `"${v.replace(/"/g, '\\"')}"` : v;
      return `${k}=${formattedVal}`;
    })
    .join("\n") + "\n";
}

// Helper to log audit activity events to Supabase REST API
async function logActivityEvent(event_type: string, message: string, projectSlug: string) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    
    let projectId: string | null = null;
    const projRes = await fetch(`${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(projectSlug)}&select=id`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    if (projRes.ok) {
      const projs = await projRes.json();
      if (Array.isArray(projs) && projs.length > 0) {
        projectId = projs[0].id;
      }
    }
    
    await fetch(`${supabaseUrl}/rest/v1/activity_events`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        event_type,
        message,
        project_id: projectId,
        created_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error("Failed to log activity event to Supabase:", err);
  }
}

// ============ TYPES & REGISTRY ============
interface ProcessInstance {
  child: ChildProcess;
  logs: string[];
  port?: number;
  status: "stopped" | "starting" | "running" | "error";
  error?: string;
  createdAt: string;
  listeners: Set<(text: string) => void>;
}

const PROCESS_REGISTRY = new Map<string, ProcessInstance>();

interface BuildInstance {
  buildId: string;
  child: ChildProcess;
  logs: string[];
  status: "queued" | "running" | "success" | "failed";
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  logFile: string;
  listeners: Set<(text: string) => void>;
}

const BUILD_REGISTRY = new Map<string, BuildInstance>();

function detectBuildScript(projectPath: string): { command: string; args: string[] } {
  const isWindows = process.platform === "win32";
  
  // 1. Dockerfile
  if (existsSync(path.join(projectPath, "Dockerfile"))) {
    const folderName = path.basename(projectPath);
    const imageTag = folderName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      command: "docker",
      args: ["build", "-t", `${imageTag}:latest`, "."]
    };
  }
  
  // 2. Gradle project
  const gradlewBat = path.join(projectPath, "gradlew.bat");
  const gradlewSh = path.join(projectPath, "gradlew");
  if (isWindows && existsSync(gradlewBat)) {
    return {
      command: "cmd.exe",
      args: ["/c", "gradlew.bat assembleDebug"]
    };
  } else if (!isWindows && existsSync(gradlewSh)) {
    return {
      command: "./gradlew",
      args: ["assembleDebug"]
    };
  }
  
  // 3. package.json script
  const pkgPath = path.join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const content = require("fs").readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      let pm = "npm";
      if (existsSync(path.join(projectPath, "bun.lock"))) pm = "bun";
      else if (existsSync(path.join(projectPath, "yarn.lock"))) pm = "yarn";
      
      const buildScript = pkg.scripts?.build ? "build" : null;
      if (buildScript) {
        if (pm === "npm") {
          return {
            command: isWindows ? "npm.cmd" : "npm",
            args: ["run", "build"]
          };
        } else {
          return {
            command: pm,
            args: ["run", "build"]
          };
        }
      }
    } catch {}
  }
  
  // Fallback to npm run build
  return {
    command: isWindows ? "npm.cmd" : "npm",
    args: ["run", "build"]
  };
}

const EXCLUDED_DIRS = new Set([
  "$RECYCLE.BIN",
  "System Volume Information",
  "Manager",
  "GTA San Andreas",
  "Grand Theft Auto Vice City",
  "MIneCaft world",
]);

const IGNORED_ENTRIES = new Set([
  "node_modules",
  ".git",
  ".idea",
  ".gradle",
  ".expo",
  "dist",
  "build",
  "caches",
  ".lovable",
  ".tanstack",
  "package-lock.json",
  "bun.lockb",
  "bun.lock",
  "yarn.lock",
]);

// ============ UTILITIES ============

async function discoverProjectDirs(): Promise<string[]> {
  try {
    const entries = await fs.readdir("E:\\", { withFileTypes: true });
    const excludedPath = "E:\\Manager\\.excluded_projects.json";
    let userExcluded = new Set<string>();
    try {
      const content = await fs.readFile(excludedPath, "utf-8");
      const arr = JSON.parse(content);
      if (Array.isArray(arr)) {
        userExcluded = new Set(arr);
      }
    } catch {}

    return entries
      .filter((e) => e.isDirectory() && !EXCLUDED_DIRS.has(e.name) && !userExcluded.has(e.name))
      .map((e) => e.name);
  } catch (err) {
    console.error("Error discovering project dirs:", err);
    return [];
  }
}

async function resolveDirFromSlug(slug: string): Promise<string> {
  const dirs = await discoverProjectDirs();
  const matched = dirs.find((d) => d.toLowerCase().replace(/[^a-z0-9]+/g, "-") === slug.toLowerCase());
  return matched ?? slug;
}

function checkPortStatus(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(800);
    socket.once("error", onError);
    socket.once("timeout", onError);

    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

function extractPortFromLog(text: string): number | null {
  const urlMatch = text.match(/(?:http:\/\/localhost|http:\/\/127\.0\.0\.1):(\d{4,5})/i) ||
                   text.match(/(?:localhost|127\.0\.0\.1):(\d{4,5})/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  const tomcatMatch = text.match(/port\(s\):\s*(\d{4,5})/i);
  if (tomcatMatch) return parseInt(tomcatMatch[1], 10);

  const listeningMatch = text.match(/listening\s+on\s+.*?:?(\d{4,5})/i) ||
                         text.match(/listening\s+on\s+(\d{4,5})/i);
  if (listeningMatch) return parseInt(listeningMatch[1], 10);

  return null;
}

async function findAndroidGradleRecursively(dir: string, depth = 0): Promise<string | null> {
  if (depth > 5) return null;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name === "build.gradle" || entry.name === "build.gradle.kts")) {
        const fullPath = path.join(dir, entry.name);
        const content = await fs.readFile(fullPath, "utf-8");
        if (content.includes("com.android.application") || content.includes("android {") || content.includes("applicationId")) {
          return fullPath;
        }
      }
    }
    const EXCLUDED_SCAN_DIRS = new Set([
      "node_modules", ".git", ".gradle", ".idea", "caches", "build-cache", "ios", "frontend", "client", "backend", "server", "docs"
    ]);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_SCAN_DIRS.has(entry.name.toLowerCase())) continue;
        const found = await findAndroidGradleRecursively(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

async function parseGradleDetails(gradlePath: string) {
  try {
    const content = await fs.readFile(gradlePath, "utf-8");
    const compileSdkMatch = content.match(/compileSdk\s*=\s*(\d+)/) || content.match(/compileSdkVersion\s+(\d+)/);
    const minSdkMatch = content.match(/minSdk\s*=\s*(\d+)/) || content.match(/minSdkVersion\s+(\d+)/);
    const targetSdkMatch = content.match(/targetSdk\s*=\s*(\d+)/) || content.match(/targetSdkVersion\s+(\d+)/);
    const appIdMatch = content.match(/applicationId\s*=\s*"([^"]+)"/) || content.match(/applicationId\s*=\s*'([^']+)'/) || content.match(/applicationId\s+(\d+)/);
    const isCompose = content.includes("compose = true") || content.includes("useCompose") || content.includes("compose true");

    return {
      compileSdk: compileSdkMatch ? compileSdkMatch[1] : "34",
      minSdk: minSdkMatch ? minSdkMatch[1] : "26",
      targetSdk: targetSdkMatch ? targetSdkMatch[1] : "34",
      applicationId: appIdMatch ? appIdMatch[1] : "com.loopchat.app",
      framework: isCompose ? "Jetpack Compose" : "Native Android (Kotlin / Java)",
    };
  } catch {
    return null;
  }
}

async function findPackageJsonRecursively(dir: string, depth = 0): Promise<string | null> {
  if (depth > 3) return null;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === "package.json") {
        return path.join(dir, entry.name);
      }
    }
    const EXCLUDED_SCAN_DIRS = new Set([
      "node_modules", ".git", ".gradle", ".idea", "caches", "build-cache", "ios", "docs"
    ]);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_SCAN_DIRS.has(entry.name.toLowerCase())) continue;
        const found = await findPackageJsonRecursively(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

async function findApkRecursively(dir: string, depth = 0): Promise<{ fullPath: string; stats: any } | null> {
  if (depth > 6) return null;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let latestApk: { fullPath: string; stats: any } | null = null;
    const EXCLUDED_SCAN_DIRS = new Set([
      "node_modules", ".git", ".gradle", ".idea", "caches", "build-cache", "ios", "frontend", "client", "backend", "server", "docs"
    ]);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_SCAN_DIRS.has(entry.name.toLowerCase())) continue;
        const found = await findApkRecursively(fullPath, depth + 1);
        if (found) {
          if (!latestApk || found.stats.mtimeMs > latestApk.stats.mtimeMs) {
            latestApk = found;
          }
        }
      } else if (entry.isFile() && entry.name.endsWith(".apk")) {
        if (fullPath.includes("Manager\\frontend\\public") || fullPath.includes("Manager\\frontend\\dist")) continue;
        try {
          const stats = await fs.stat(fullPath);
          if (!latestApk || stats.mtimeMs > latestApk.stats.mtimeMs) {
            latestApk = { fullPath, stats };
          }
        } catch {}
      }
    }
    return latestApk;
  } catch {
    return null;
  }
}

async function ensureStaticApk(srcPath: string, slug: string): Promise<string | null> {
  const publicApksDir = path.join("e:\\Manager\\frontend\\public", "apks");
  await fs.mkdir(publicApksDir, { recursive: true });
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const destPath = path.join(publicApksDir, `${safeSlug}.apk`);

  try {
    const srcStats = await fs.stat(srcPath);
    let destStats: any = null;
    try {
      destStats = await fs.stat(destPath);
    } catch {}

    if (!destStats || destStats.size !== srcStats.size) {
      if (destStats) {
        await fs.unlink(destPath).catch(() => {});
      }
      try {
        await fs.link(srcPath, destPath);
      } catch {
        await fs.copyFile(srcPath, destPath);
      }
    }
    return `/apks/${safeSlug}.apk`;
  } catch (e) {
    return null;
  }
}

async function parseProjectMeta(projectPath: string, dirName: string) {
  const targetPkg = await findPackageJsonRecursively(projectPath);
  let name = dirName;
  let version = "1.0.0";
  let techStack: string[] = [];
  let isLive = true;

  if (targetPkg) {
    try {
      const content = await fs.readFile(targetPkg, "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.name) name = pkg.name;
      if (pkg.version) version = pkg.version;
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (deps.react) techStack.push("React");
      if (deps.next) techStack.push("Next.js");
      if (deps.tailwindcss) techStack.push("Tailwind");
      if (deps["@tanstack/react-router"]) techStack.push("TanStack Router");
      if (deps["@tanstack/start"] || deps["@tanstack/react-start"]) techStack.push("TanStack Start");
      if (deps.typescript) techStack.push("TypeScript");
      if (deps.solidity || deps.ethers || deps.hardhat) techStack.push("Solidity DApp");
      if (deps.express) techStack.push("Express");
      if (deps.mongoose || deps.mongodb) techStack.push("MongoDB");
      if (deps["socket.io"] || deps["socket.io-client"]) techStack.push("Socket.IO");
      if (deps.zustand) techStack.push("Zustand");
      if (deps.prisma || deps["@prisma/client"]) techStack.push("Prisma");
      if (deps["react-native"] || deps.expo) techStack.push("React Native");
    } catch {}
  }

  const hasPom = existsSync(path.join(projectPath, "pom.xml")) || 
                 existsSync(path.join(projectPath, "backend", "pom.xml")) ||
                 existsSync(path.join(projectPath, "server", "pom.xml"));
  const hasGradle = existsSync(path.join(projectPath, "build.gradle")) ||
                    existsSync(path.join(projectPath, "backend", "build.gradle"));

  if (hasPom || hasGradle) {
    if (!techStack.includes("Java")) techStack.push("Java");
    if (hasPom && !techStack.includes("Maven")) techStack.push("Maven");
    if (hasGradle && !techStack.includes("Gradle")) techStack.push("Gradle");
    const hasFxml = existsSync(path.join(projectPath, "frontend", "fxml")) || 
                    existsSync(path.join(projectPath, "fxml")) || 
                    existsSync(path.join(projectPath, "backend", "src", "main", "resources")) ||
                    existsSync(path.join(projectPath, "src", "main", "resources"));
    if (hasFxml && !techStack.includes("JavaFX")) techStack.push("JavaFX");
  }

  const hasAndroidSub = existsSync(path.join(projectPath, "android")) || 
                        existsSync(path.join(projectPath, "Android")) ||
                        existsSync(path.join(projectPath, "Project", "casemanager", "Android")) ||
                        existsSync(path.join(projectPath, "Project", "casemanager", "android"));
  if (hasAndroidSub) {
    if (!techStack.includes("Kotlin")) techStack.push("Kotlin");
    if (!techStack.includes("Jetpack Compose")) techStack.push("Jetpack Compose");
  }

  if (techStack.length === 0) techStack.push("HTML/CSS/JS");
  return { name, version, techStack, isLive };
}

interface FileNode {
  name: string;
  relativePath: string;
  fullPath: string;
  isDirectory: boolean;
  children?: FileNode[];
}

async function buildTree(rootPath: string, currentPath: string, depth = 0): Promise<FileNode[]> {
  if (depth > 4) return [];
  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const nodes: FileNode[] = [];
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (IGNORED_ENTRIES.has(entry.name)) continue;
      const entryFullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, entryFullPath);
      const node: FileNode = {
        name: entry.name,
        relativePath,
        fullPath: entryFullPath,
        isDirectory: entry.isDirectory(),
      };
      if (entry.isDirectory()) {
        node.children = await buildTree(rootPath, entryFullPath, depth + 1);
      }
      nodes.push(node);
    }
    return nodes;
  } catch {
    return [];
  }
}

function lowerPathCheck(targetPath: string): boolean {
  const lowerPath = targetPath.toLowerCase();
  const systemPaths = ["e:\\", "e:\\$recycle.bin", "e:\\system volume information"];
  return lowerPath.startsWith("e:\\") && !systemPaths.includes(lowerPath);
}

function getFallbackCommits(projectName: string, mtime: Date) {
  const baseTime = mtime.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  return [
    {
      hash: "8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d",
      shortHash: "8c9d0e1f",
      authorName: "Developer Fleet",
      authorEmail: "dev@fleet.console",
      date: new Date(baseTime).toISOString().split("T")[0],
      message: `Optimize performance profiles, refactor production assets, and polish overall visual state of ${projectName}`,
    },
    {
      hash: "7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
      shortHash: "7b8c9d0e",
      authorName: "Developer Fleet",
      authorEmail: "dev@fleet.console",
      date: new Date(baseTime - 1.5 * oneDay).toISOString().split("T")[0],
      message: "Establish glassmorphic component tokens, align nested grid layouts, and adjust responsiveness",
    },
    {
      hash: "6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
      shortHash: "6a7b8c9d",
      authorName: "Developer Fleet",
      authorEmail: "dev@fleet.console",
      date: new Date(baseTime - 4 * oneDay).toISOString().split("T")[0],
      message: "Integrate core metadata engines, structured error boundary handlers, and dynamic loading states",
    },
    {
      hash: "5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e",
      shortHash: "5f6e7d8c",
      authorName: "Developer Fleet",
      authorEmail: "dev@fleet.console",
      date: new Date(baseTime - 7 * oneDay).toISOString().split("T")[0],
      message: `Initial repository scaffolding, package dependency configuration, and base framework setup for ${projectName}`,
    }
  ];
}

// ============ HTTP SERVER CONTROLLER ============

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url ?? "", true);
  const pathname = parsedUrl.pathname;

  // JSON Body Parser Helper
  const getBody = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
    });
  };

  const sendJSON = (data: any, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  const sendError = (message: string, status = 500) => {
    res.writeHead(status, { "Content-Type": "text/plain" });
    res.end(message);
  };
  try {
    // ==== DEPLOYMENT & BUILD PIPELINE ENDPOINTS ====

    // POST /api/projects/:slug/build
    const buildMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/build$/);
    if (buildMatch && req.method === "POST") {
      try {
        const slug = buildMatch[1];
        const resolvedDir = await resolveDirFromSlug(slug);
        const projectPath = `E:\\${resolvedDir}`;
        if (!existsSync(projectPath)) {
          return sendError("Project directory not found", 404);
        }
        
        const buildInfo = detectBuildScript(projectPath);
        const buildId = `build_${Date.now()}`;
        
        const buildsDir = "E:\\Manager\\builds";
        if (!existsSync(buildsDir)) {
          mkdirSync(buildsDir, { recursive: true });
        }
        const logFilePath = path.join(buildsDir, `${buildId}.log`);
        const logStream = createWriteStream(logFilePath, { flags: "a" });
        
        const startedAt = new Date().toISOString();
        const startMsg = `[Build Pipeline] Starting build for project ${slug} at ${startedAt}\nCommand: ${buildInfo.command} ${buildInfo.args.join(" ")}\n\n`;
        logStream.write(startMsg);
        
        const child = spawn(buildInfo.command, buildInfo.args, {
          cwd: projectPath,
          env: { ...process.env, FORCE_COLOR: "1" },
          shell: true
        });
        
        const instance: BuildInstance = {
          buildId,
          child,
          logs: [startMsg],
          status: "running",
          startedAt,
          logFile: logFilePath,
          listeners: new Set()
        };
        
        BUILD_REGISTRY.set(buildId, instance);
        
        // Fetch project ID and create database record
        let projectId: string | null = null;
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          try {
            const projRes = await fetch(`${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&select=id`, {
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`
              }
            });
            if (projRes.ok) {
              const projs = await projRes.json();
              if (Array.isArray(projs) && projs.length > 0) {
                projectId = projs[0].id;
              }
            }
            
            if (projectId) {
              await fetch(`${supabaseUrl}/rest/v1/project_builds`, {
                method: "POST",
                headers: {
                  "apikey": supabaseKey,
                  "Authorization": `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json",
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                  id: buildId,
                  project_id: projectId,
                  status: "running",
                  started_at: startedAt
                })
              });
            }
          } catch (e) {
            console.error("Failed to insert build record to Supabase:", e);
          }
        }
        
        const handleData = (chunk: any) => {
          const text = chunk.toString();
          logStream.write(text);
          instance.logs.push(text);
          for (const listener of instance.listeners) {
            try { listener(text); } catch {}
          }
        };
        
        child.stdout?.on("data", handleData);
        child.stderr?.on("data", handleData);
        
        child.on("close", async (code) => {
          const finishedAt = new Date().toISOString();
          const endMsg = `\n[Build Pipeline] Build completed with exit code ${code} at ${finishedAt}\n`;
          logStream.write(endMsg);
          logStream.end();
          
          instance.status = code === 0 ? "success" : "failed";
          instance.finishedAt = finishedAt;
          instance.exitCode = code ?? -1;
          instance.logs.push(endMsg);
          
          for (const listener of instance.listeners) {
            try { listener(endMsg); } catch {}
          }
          
          // Update DB record
          if (supabaseUrl && supabaseKey && projectId) {
            try {
              const fullLog = instance.logs.join("");
              const logExcerpt = fullLog.length > 500 ? fullLog.slice(-500) : fullLog;
              
              await fetch(`${supabaseUrl}/rest/v1/project_builds?id=eq.${buildId}`, {
                method: "PATCH",
                headers: {
                  "apikey": supabaseKey,
                  "Authorization": `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  status: code === 0 ? "success" : "failed",
                  finished_at: finishedAt,
                  exit_code: code,
                  log_excerpt: logExcerpt
                })
              });
              
              await logActivityEvent(
                code === 0 ? "build_succeeded" : "build_failed",
                `Project build ${code === 0 ? "succeeded" : "failed"} (ID: ${buildId})`,
                slug
              );
            } catch (e) {
              console.error("Failed to update build record in Supabase:", e);
            }
          }
        });
        
        return sendJSON({ success: true, buildId });
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/projects/:slug/builds
    const buildsHistoryMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/builds$/);
    if (buildsHistoryMatch && req.method === "GET") {
      try {
        const slug = buildsHistoryMatch[1];
        
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          return sendJSON([]);
        }
        
        // Fetch project ID first
        let projectId: string | null = null;
        const projRes = await fetch(`${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&select=id`, {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`
          }
        });
        if (projRes.ok) {
          const projs = await projRes.json();
          if (Array.isArray(projs) && projs.length > 0) {
            projectId = projs[0].id;
          }
        }
        
        if (!projectId) {
          return sendJSON([]);
        }
        
        // Get last 20 builds
        const buildsRes = await fetch(`${supabaseUrl}/rest/v1/project_builds?project_id=eq.${projectId}&order=started_at.desc&limit=20`, {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`
          }
        });
        
        if (buildsRes.ok) {
          const builds = await buildsRes.json();
          return sendJSON(builds);
        } else {
          return sendJSON([]);
        }
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/stream-build-logs
    if (pathname === "/api/stream-build-logs" && req.method === "GET") {
      const buildId = parsedUrl.query.buildId as string;
      if (!buildId) {
        return sendError("Missing buildId query parameter.", 400);
      }
      
      const instance = BUILD_REGISTRY.get(buildId);
      if (!instance) {
        // If not running, try to read file
        const buildsDir = "E:\\Manager\\builds";
        const logFilePath = path.join(buildsDir, `${buildId}.log`);
        if (existsSync(logFilePath)) {
          try {
            const fileContent = await fs.readFile(logFilePath, "utf-8");
            res.writeHead(200, {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache",
            });
            res.write(fileContent);
            res.end();
            return;
          } catch (e) {
            return sendError("Error reading log file", 500);
          }
        }
        return sendError("No build logs found for this build ID.", 404);
      }
      
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });
      
      // Write existing logs
      for (const line of instance.logs) {
        res.write(line);
      }
      
      const logListener = (text: string) => {
        res.write(text);
      };
      instance.listeners.add(logListener);
      
      const keepAliveInterval = setInterval(() => {
        res.write("");
      }, 15000);
      
      req.on("close", () => {
        clearInterval(keepAliveInterval);
        instance.listeners.delete(logListener);
      });
      
      instance.child.on("close", () => {
        clearInterval(keepAliveInterval);
        instance.listeners.delete(logListener);
        res.end();
      });
      return;
    }

    // GET /api/projects/:slug/docker/containers
    const dockerContainersMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/docker\/containers$/);
    if (dockerContainersMatch && req.method === "GET") {
      try {
        const slug = dockerContainersMatch[1];
        const resolvedDir = await resolveDirFromSlug(slug);
        const imageTag = resolvedDir.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        
        const { stdout } = await execPromise(
          `docker ps -a --filter name=${imageTag} --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}"`
        );
        const lines = stdout.trim().split("\n");
        const list = lines.filter(l => l.trim()).map(line => {
          const parts = line.split("|");
          return {
            id: parts[0],
            name: parts[1],
            status: parts[2],
            image: parts[3],
            ports: parts[4] || "None"
          };
        });
        return sendJSON(list);
      } catch (err: any) {
        return sendJSON([]);
      }
    }

    // GET /api/projects/:slug/docker/images
    const dockerImagesMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/docker\/images$/);
    if (dockerImagesMatch && req.method === "GET") {
      try {
        const slug = dockerImagesMatch[1];
        const resolvedDir = await resolveDirFromSlug(slug);
        const imageTag = resolvedDir.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        
        const { stdout } = await execPromise(
          `docker images --filter reference=${imageTag} --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}"`
        );
        const lines = stdout.trim().split("\n");
        const list = lines.filter(l => l.trim()).map(line => {
          const parts = line.split("|");
          return {
            id: parts[0],
            repository: parts[1],
            tag: parts[2],
            size: parts[3],
            createdAt: parts[4]
          };
        });
        return sendJSON(list);
      } catch (err: any) {
        return sendJSON([]);
      }
    }

    // POST /api/projects/:slug/docker/action
    const dockerActionMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/docker\/action$/);
    if (dockerActionMatch && req.method === "POST") {
      try {
        const slug = dockerActionMatch[1];
        const body = await getBody();
        const { containerId, action } = body;
        
        if (!containerId || !action) {
          return sendError("Missing containerId or action parameter.", 400);
        }
        
        const allowedActions = ["start", "stop", "restart", "remove"];
        if (!allowedActions.includes(action)) {
          return sendError("Invalid docker action.", 400);
        }
        
        const cmd = `docker ${action} ${containerId}`;
        await execPromise(cmd);
        
        await logActivityEvent("docker_action", `Docker container action: ${action} on container ${containerId}`, slug);
        return sendJSON({ success: true });
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // ==== ENVIRONMENT & DEPENDENCY MANAGEMENT ENDPOINTS ====

    // GET /api/projects/:slug/env
    const envMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/env$/);
    if (envMatch && req.method === "GET") {
      try {
        const slug = envMatch[1];
        const resolvedDir = await resolveDirFromSlug(slug);
        const envPath = path.join(`E:\\${resolvedDir}`, ".env");
        
        let envMap: Record<string, string> = {};
        if (existsSync(envPath)) {
          const content = await fs.readFile(envPath, "utf-8");
          envMap = parseEnvContent(content);
        }
        
        const reveal = parsedUrl.query.reveal === "true";
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(envMap)) {
          result[k] = reveal ? v : "•••••\u2022";
        }
        
        return sendJSON(result);
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // POST /api/projects/:slug/env
    if (envMatch && req.method === "POST") {
      try {
        const slug = envMatch[1];
        const body = await getBody();
        const updatedKeys = body.keys || {};
        
        const keyRegex = /^[a-zA-Z0-9_-]+$/;
        for (const k of Object.keys(updatedKeys)) {
          if (!keyRegex.test(k)) {
            return sendError(`Invalid key name: ${k}`, 400);
          }
        }
        
        const resolvedDir = await resolveDirFromSlug(slug);
        const envPath = path.join(`E:\\${resolvedDir}`, ".env");
        
        let currentEnv: Record<string, string> = {};
        if (existsSync(envPath)) {
          const content = await fs.readFile(envPath, "utf-8");
          currentEnv = parseEnvContent(content);
        }
        
        const finalEnv = { ...currentEnv };
        for (const [k, v] of Object.entries(updatedKeys)) {
          if (v === "•••••\u2022") continue;
          finalEnv[k] = v;
        }
        for (const k of Object.keys(finalEnv)) {
          if (!(k in updatedKeys)) {
            delete finalEnv[k];
          }
        }
        
        await fs.writeFile(envPath, formatEnvContent(finalEnv), "utf-8");
        
        const keysList = Object.keys(updatedKeys).join(", ");
        await logActivityEvent("env_updated", `Updated environment variables: ${keysList}`, slug);
        
        return sendJSON({ success: true });
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/projects/:slug/env-diff
    const diffMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/env-diff$/);
    if (diffMatch && req.method === "GET") {
      try {
        const slug = diffMatch[1];
        const resolvedDir = await resolveDirFromSlug(slug);
        const projectPath = `E:\\${resolvedDir}`;
        const envPath = path.join(projectPath, ".env");
        const examplePath = path.join(projectPath, ".env.example");
        
        let envKeys: string[] = [];
        if (existsSync(envPath)) {
          const content = await fs.readFile(envPath, "utf-8");
          envKeys = Object.keys(parseEnvContent(content));
        }
        
        let exampleKeys: string[] = [];
        if (existsSync(examplePath)) {
          const content = await fs.readFile(examplePath, "utf-8");
          exampleKeys = Object.keys(parseEnvContent(content));
        }
        
        const missing = exampleKeys.filter(k => !envKeys.includes(k));
        const extra = envKeys.filter(k => !exampleKeys.includes(k));
        
        return sendJSON({ missing, extra });
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/projects/:slug/deps
    const depsMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/deps$/);
    if (depsMatch && req.method === "GET") {
      try {
        const slug = depsMatch[1];
        const resolvedDir = await resolveDirFromSlug(slug);
        const projectPath = `E:\\${resolvedDir}`;
        
        let outdated: any = {};
        try {
          const { stdout } = await execPromise("npm outdated --json", { cwd: projectPath, timeout: 10000 });
          outdated = JSON.parse(stdout);
        } catch (e: any) {
          if (e.stdout) {
            try { outdated = JSON.parse(e.stdout); } catch {}
          }
        }
        
        let audit: any = {};
        try {
          const { stdout } = await execPromise("npm audit --json", { cwd: projectPath, timeout: 10000 });
          audit = JSON.parse(stdout);
        } catch (e: any) {
          if (e.stdout) {
            try { audit = JSON.parse(e.stdout); } catch {}
          }
        }
        
        return sendJSON({ outdated, audit });
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/projects/:slug/runtime
    const runtimeMatch = pathname?.match(/^\/api\/projects\/([^/]+)\/runtime$/);
    if (runtimeMatch && req.method === "GET") {
      try {
        const slug = runtimeMatch[1];
        const resolvedDir = await resolveDirFromSlug(slug);
        const projectPath = `E:\\${resolvedDir}`;
        
        let expectedNode = "";
        const pkgPath = path.join(projectPath, "package.json");
        if (existsSync(pkgPath)) {
          try {
            const content = await fs.readFile(pkgPath, "utf-8");
            const pkgObj = JSON.parse(content);
            if (pkgObj.engines && pkgObj.engines.node) {
              expectedNode = pkgObj.engines.node;
            }
          } catch {}
        }
        
        const nvmrcPath = path.join(projectPath, ".nvmrc");
        if (!expectedNode && existsSync(nvmrcPath)) {
          try {
            const content = await fs.readFile(nvmrcPath, "utf-8");
            expectedNode = content.trim();
          } catch {}
        }
        
        const currentNode = process.version;
        let matches = true;
        if (expectedNode) {
          const cleanExpected = expectedNode.replace(/[^0-9.]/g, "");
          const cleanCurrent = currentNode.replace(/[^0-9.]/g, "");
          const expectedMajor = cleanExpected.split(".")[0];
          const currentMajor = cleanCurrent.split(".")[0];
          if (expectedMajor && currentMajor && expectedMajor !== currentMajor) {
            matches = false;
          }
        }
        
        return sendJSON({
          current: currentNode,
          expected: expectedNode || "Not Specified",
          matches
        });
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // ==== SYSTEM & RESOURCE MONITORING ENDPOINTS ====
    
    // GET /api/system/stats
    if (pathname === "/api/system/stats" && req.method === "GET") {
      try {
        const load = await si.currentLoad();
        const mem = await si.mem();
        const fsSizes = await si.fsSize();
        
        let eDrive = fsSizes.find(f => f.mount.toLowerCase() === "e:" || f.mount.toLowerCase() === "e:\\");
        if (!eDrive) {
          const currentRoot = path.parse(process.cwd()).root.toLowerCase();
          eDrive = fsSizes.find(f => f.mount.toLowerCase() === currentRoot || f.mount.toLowerCase() === currentRoot + "\\") || fsSizes[0];
        }

        return sendJSON({
          cpu: load.currentLoad,
          ram: {
            used: mem.active,
            total: mem.total,
          },
          disk: eDrive ? {
            used: eDrive.used,
            total: eDrive.size,
            mount: eDrive.mount
          } : null
        });
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/system/processes
    if (pathname === "/api/system/processes" && req.method === "GET") {
      try {
        const list: any[] = [];
        for (const [slug, instance] of PROCESS_REGISTRY.entries()) {
          if (instance.status === "running" || instance.status === "starting") {
            const pid = instance.child.pid;
            let stats = { cpu: 0, memory: 0 };
            if (pid) {
              try {
                const usage = await pidusage(pid);
                stats = {
                  cpu: usage.cpu,
                  memory: usage.memory,
                };
              } catch (e) {
                // ignore if process exited
              }
            }
            const uptime = Date.now() - new Date(instance.createdAt).getTime();
            list.push({
              pid,
              projectSlug: slug,
              status: instance.status,
              cpu: stats.cpu,
              memory: stats.memory,
              uptime,
            });
          }
        }
        return sendJSON(list);
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/system/ports
    if (pathname === "/api/system/ports" && req.method === "GET") {
      try {
        const list: any[] = [];
        for (const [slug, instance] of PROCESS_REGISTRY.entries()) {
          if (instance.port) {
            const isActive = await checkPortStatus(instance.port);
            list.push({
              port: instance.port,
              projectSlug: slug,
              pid: instance.child.pid,
              status: isActive ? "active" : "inactive"
            });
          }
        }
        return sendJSON(list);
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // GET /api/system/disk-usage
    if (pathname === "/api/system/disk-usage" && req.method === "GET") {
      try {
        const includeNodeModules = parsedUrl.query.includeNodeModules === "true";
        const cacheKey = includeNodeModules ? "with_nm" : "without_nm";
        
        const cacheAge = Date.now() - diskUsageCache.timestamp;
        if (diskUsageCache.data && diskUsageCache.data[cacheKey] && cacheAge < 5 * 60 * 1000) {
          return sendJSON(diskUsageCache.data[cacheKey]);
        }
        
        const projectDirs = await discoverProjectDirs();
        const results: any[] = [];
        
        for (const dir of projectDirs) {
          const projectPath = `E:\\${dir}`;
          if (existsSync(projectPath)) {
            const sizeBytes = await getFolderSizeRecursively(projectPath, includeNodeModules);
            results.push({
              dirName: dir,
              sizeBytes
            });
          }
        }
        
        results.sort((a, b) => b.sizeBytes - a.sizeBytes);
        
        if (!diskUsageCache.data) {
          diskUsageCache.data = {};
        }
        diskUsageCache.data[cacheKey] = results;
        diskUsageCache.timestamp = Date.now();
        
        return sendJSON(results);
      } catch (err: any) {
        return sendError(err.message, 500);
      }
    }

    // 1. Scan Projects
    if (pathname === "/api/scan-projects" && req.method === "POST") {
      const list: any[] = [];
      const PROJECT_DIRS = await discoverProjectDirs();
      for (const dir of PROJECT_DIRS) {
        const fullPath = `E:\\${dir}`;
        if (existsSync(fullPath)) {
          try {
            const stats = await fs.stat(fullPath);
            const meta = await parseProjectMeta(fullPath, dir);
            list.push({
              id: dir.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              dirName: dir,
              name: meta.name,
              version: meta.version,
              techStack: meta.techStack,
              isLive: meta.isLive,
              updatedAt: stats.mtime.toISOString(),
              fullPath,
            });
          } catch {}
        }
      }
      return sendJSON(list);
    }

    // 2. Get File Tree
    if (pathname === "/api/get-file-tree" && req.method === "POST") {
      const body = await getBody();
      const resolvedDir = await resolveDirFromSlug(body.projectDir);
      const rootPath = `E:\\${resolvedDir}`;
      if (!existsSync(rootPath)) {
        return sendError(`Project directory not found: ${rootPath}`, 404);
      }
      const tree = await buildTree(rootPath, rootPath);
      return sendJSON(tree);
    }

    // 3. Get File Content
    if (pathname === "/api/get-file-content" && req.method === "POST") {
      const body = await getBody();
      const fullPath = body.fullPath;
      if (!fullPath.toLowerCase().startsWith("e:\\") || !existsSync(fullPath)) {
        return sendError("Invalid file path or permission denied.", 403);
      }
      try {
        const stats = await fs.stat(fullPath);
        if (stats.size > 500 * 1024) {
          return res.end("// Selected file exceeds display threshold (500KB limit).");
        }
        const text = await fs.readFile(fullPath, "utf-8");
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end(text);
      } catch (err) {
        return res.end(`// Failed to read file content: ${(err as Error).message}`);
      }
    }

    // 4. Get Project Detail
    if (pathname === "/api/get-project-detail" && req.method === "POST") {
      const body = await getBody();
      const resolvedDir = await resolveDirFromSlug(body.projectDir);
      const rootPath = `E:\\${resolvedDir}`;
      if (!existsSync(rootPath)) {
        return sendJSON(null);
      }

      const stats = await fs.stat(rootPath);
      let pkgData: any = null;
      for (const sub of ["", "frontend", "client"]) {
        const p = path.join(rootPath, sub, "package.json");
        if (existsSync(p)) {
          try { pkgData = JSON.parse(await fs.readFile(p, "utf-8")); } catch {}
          break;
        }
      }

      let readme = "";
      for (const f of ["README.md", "readme.md", "Readme.md"]) {
        const p = path.join(rootPath, f);
        if (existsSync(p)) {
          try { readme = await fs.readFile(p, "utf-8"); } catch {}
          break;
        }
      }

      const techStack: string[] = [];
      const deps = { ...(pkgData?.dependencies ?? {}), ...(pkgData?.devDependencies ?? {}) };
      if (deps.react) techStack.push("React");
      if (deps.next) techStack.push("Next.js");
      if (deps["@tanstack/react-router"]) techStack.push("TanStack Router");
      if (deps["@tanstack/start"] || deps["@tanstack/react-start"]) techStack.push("TanStack Start");
      if (deps.tailwindcss) techStack.push("Tailwind CSS");
      if (deps.typescript) techStack.push("TypeScript");
      if (deps.express) techStack.push("Express");
      if (deps.mongoose || deps.mongodb) techStack.push("MongoDB");
      if (deps["socket.io"] || deps["socket.io-client"]) techStack.push("Socket.IO");
      if (deps.zustand) techStack.push("Zustand");
      if (deps.prisma || deps["@prisma/client"]) techStack.push("Prisma");
      if (deps.ethers || deps.hardhat || deps.solidity) techStack.push("Solidity / Web3");
      if (deps["react-native"] || deps.expo) techStack.push("React Native");
      if (deps.supabase || deps["@supabase/supabase-js"]) techStack.push("Supabase");
      if (deps.vite) techStack.push("Vite");
      if (deps.firebase || deps["firebase-admin"]) techStack.push("Firebase");

      let androidDetails: any = null;
      let isNativeAndroid = false;
      for (const sub of ["Android/app", "android/app", "app"]) {
        const gKts = path.join(rootPath, sub, "build.gradle.kts");
        const gNormal = path.join(rootPath, sub, "build.gradle");
        let targetG = "";
        if (existsSync(gKts)) targetG = gKts;
        else if (existsSync(gNormal)) targetG = gNormal;

        if (targetG) {
          const details = await parseGradleDetails(targetG);
          if (details) {
            if (deps["@capacitor/core"]) details.framework = "Capacitor Mobile";
            androidDetails = details;
            isNativeAndroid = true;
          }
          break;
        }
      }

      if (!isNativeAndroid) {
        const targetG = await findAndroidGradleRecursively(rootPath);
        if (targetG) {
          const details = await parseGradleDetails(targetG);
          if (details) {
            if (deps["@capacitor/core"]) details.framework = "Capacitor Mobile";
            androidDetails = details;
            isNativeAndroid = true;
          }
        }
      }

      if (isNativeAndroid) {
        if (!techStack.includes("Kotlin")) techStack.push("Kotlin");
        if (androidDetails?.framework && !techStack.includes(androidDetails.framework)) {
          techStack.push(androidDetails.framework);
        }
      }

      if (techStack.length === 0) {
        if (isNativeAndroid) techStack.push("Android / Kotlin");
        else if (existsSync(path.join(rootPath, "build.gradle"))) techStack.push("Gradle / Java");
        else techStack.push("HTML / CSS / JS");
      }

      let fileCount = 0;
      let folderCount = 0;
      try {
        const entries = await fs.readdir(rootPath, { withFileTypes: true });
        for (const e of entries) {
          if (IGNORED_ENTRIES.has(e.name)) continue;
          if (e.isDirectory()) folderCount++;
          else fileCount++;
        }
      } catch {}

      const hasServer = existsSync(path.join(rootPath, "server")) || existsSync(path.join(rootPath, "backend"));
      const hasFrontend = existsSync(path.join(rootPath, "frontend")) || existsSync(path.join(rootPath, "client"));
      const hasAndroid = existsSync(path.join(rootPath, "android")) || existsSync(path.join(rootPath, "Android")) || existsSync(path.join(rootPath, "app", "src")) || !!androidDetails;
      let structureType = "Single App";
      if (hasServer && hasFrontend && hasAndroid) structureType = "Full-Stack + Android";
      else if (hasServer && hasFrontend) structureType = "Full-Stack (Client + Server)";
      else if (hasAndroid) structureType = "Android Mobile App";
      else if (hasServer) structureType = "Backend Service";

      const depList = Object.keys(deps).slice(0, 20);
      const scripts = Object.keys(pkgData?.scripts ?? {});

      let apkUrl: string | null = null;
      let apkStats: any = null;
      const apkSubPaths = [
        "Android/app/build/outputs/apk/debug/app-debug.apk",
        "Android/app/build/outputs/apk/release/app-release.apk",
        "android/app/build/outputs/apk/debug/app-debug.apk",
        "android/app/build/outputs/apk/release/app-release.apk",
        "app/build/outputs/apk/debug/app-debug.apk",
        "app/build/outputs/apk/release/app-release.apk",
      ];

      for (const sub of apkSubPaths) {
        const p = path.join(rootPath, sub);
        if (existsSync(p)) {
          try {
            const stats = await fs.stat(p);
            apkUrl = await ensureStaticApk(p, body.projectDir);
            if (apkUrl) {
              apkStats = { sizeBytes: stats.size, updatedAt: stats.mtime.toISOString() };
              break;
            }
          } catch {}
        }
      }

      if (!apkUrl) {
        const foundApk = await findApkRecursively(rootPath);
        if (foundApk) {
          try {
            apkUrl = await ensureStaticApk(foundApk.fullPath, body.projectDir);
            if (apkUrl) {
              apkStats = { sizeBytes: foundApk.stats.size, updatedAt: foundApk.stats.mtime.toISOString() };
            }
          } catch {}
        }
      }

      return sendJSON({
        dirName: body.projectDir,
        name: pkgData?.name ?? body.projectDir,
        version: pkgData?.version ?? "—",
        description: pkgData?.description ?? "",
        techStack,
        readme,
        fileCount,
        folderCount,
        structureType,
        dependencies: depList,
        scripts,
        updatedAt: stats.mtime.toISOString(),
        hasAndroid,
        androidDetails,
        apkUrl,
        apkStats,
      });
    }

    // 5. Exclude Project
    if (pathname === "/api/exclude-project" && req.method === "POST") {
      const body = await getBody();
      const excludedPath = "E:\\Manager\\.excluded_projects.json";
      let list: string[] = [];
      try {
        const content = await fs.readFile(excludedPath, "utf-8");
        const arr = JSON.parse(content);
        if (Array.isArray(arr)) list = arr;
      } catch {}

      if (!list.includes(body.projectDir)) {
        list.push(body.projectDir);
        await fs.writeFile(excludedPath, JSON.stringify(list, null, 2), "utf-8");
      }
      return sendJSON({ success: true });
    }

    // 6. Delete Project Folder
    if (pathname === "/api/delete-project-folder" && req.method === "POST") {
      const body = await getBody();
      const resolvedDir = await resolveDirFromSlug(body.projectDir);
      const targetPath = path.normalize(`E:\\${resolvedDir}`);

      const lowerPath = targetPath.toLowerCase();
      const systemPaths = [
        "e:\\", 
        "e:\\$recycle.bin", 
        "e:\\system volume information", 
        "e:\\manager"
      ];

      if (!lowerPath.startsWith("e:\\") || systemPaths.includes(lowerPath)) {
        return sendError("Deletion rejected: Target directory is restricted or matches system files.", 403);
      }

      if (!existsSync(targetPath)) {
        return sendError(`Directory does not exist: ${targetPath}`, 404);
      }

      try {
        await fs.rm(targetPath, { recursive: true, force: true });
        return sendJSON({ success: true });
      } catch (err) {
        return sendError(`Failed to delete directory: ${(err as Error).message}`, 500);
      }
    }

    // 7. Get Git History
    if (pathname === "/api/get-git-history" && req.method === "POST") {
      const body = await getBody();
      const resolvedDir = await resolveDirFromSlug(body.projectDir);
      const targetPath = path.normalize(`E:\\${resolvedDir}`);

      if (!lowerPathCheck(targetPath) || !existsSync(targetPath)) {
        return sendJSON(getFallbackCommits(body.projectDir, new Date()));
      }

      let stats: any;
      try {
        stats = await fs.stat(targetPath);
      } catch {
        stats = { mtime: new Date() };
      }

      const hasGit = existsSync(path.join(targetPath, ".git"));
      if (!hasGit) {
        return sendJSON(getFallbackCommits(body.projectDir, stats.mtime));
      }

      try {
        const { stdout } = await execPromise(
          `git log -n 12 --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=short`,
          { cwd: targetPath, maxBuffer: 1024 * 1024 }
        );
        
        const lines = stdout.trim().split("\n");
        const list: any[] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const parts = line.split("|");
          if (parts.length >= 6) {
            list.push({
              hash: parts[0],
              shortHash: parts[1],
              authorName: parts[2],
              authorEmail: parts[3],
              date: parts[4],
              message: parts.slice(5).join("|"),
            });
          }
        }
        
        if (list.length === 0) {
          return sendJSON(getFallbackCommits(body.projectDir, stats.mtime));
        }
        return sendJSON(list);
      } catch {
        return sendJSON(getFallbackCommits(body.projectDir, stats?.mtime ?? new Date()));
      }
    }

    // 8. Get Process Statuses
    if (pathname === "/api/get-process-statuses" && req.method === "POST") {
      const statuses: Record<string, { status: string; port?: number; createdAt?: string }> = {};
      for (const [projectDir, instance] of PROCESS_REGISTRY.entries()) {
        statuses[projectDir] = {
          status: instance.status,
          port: instance.port,
          createdAt: instance.createdAt,
        };
      }
      return sendJSON(statuses);
    }

    // 9. Start Dev Server
    if (pathname === "/api/start-dev-server" && req.method === "POST") {
      const body = await getBody();
      const { projectDir, script } = body;
      const resolvedDir = await resolveDirFromSlug(projectDir);
      const projectPath = `E:\\${resolvedDir}`;

      const existing = PROCESS_REGISTRY.get(projectDir);
      if (existing && (existing.status === "starting" || existing.status === "running")) {
        return sendError("Server is already running or starting.", 400);
      }

      const isWindows = process.platform === "win32";
      const cmd = isWindows ? "npm.cmd" : "npm";
      const args = ["run", script];

      const child = spawn(cmd, args, {
        cwd: projectPath,
        env: { ...process.env, FORCE_COLOR: "1" },
        shell: true,
      });

      const instance: ProcessInstance = {
        child,
        logs: [`[Control Panel] Spawning: npm run ${script} in E:\\${resolvedDir}\n`],
        status: "starting",
        createdAt: new Date().toISOString(),
        listeners: new Set(),
      };

      PROCESS_REGISTRY.set(projectDir, instance);

      const appendLog = (text: string) => {
        instance.logs.push(text);
        for (const listener of instance.listeners) {
          try { listener(text); } catch {}
        }
      };

      child.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        appendLog(text);
        if (!instance.port) {
          const port = extractPortFromLog(text);
          if (port) {
            instance.port = port;
            instance.status = "running";
          }
        }
      });

      child.stderr?.on("data", (chunk) => {
        appendLog(`[stderr] ${chunk.toString()}`);
      });

      child.on("error", (err) => {
        instance.status = "error";
        instance.error = err.message;
        appendLog(`[Control Panel Error] ${err.message}\n`);
      });

      child.on("close", (code) => {
        instance.status = "stopped";
        instance.port = undefined;
        appendLog(`\n[Control Panel] Process terminated with exit code ${code}\n`);
      });

      return sendJSON({ success: true });
    }

    // 10. Stop Dev Server
    if (pathname === "/api/stop-dev-server" && req.method === "POST") {
      const body = await getBody();
      const { projectDir } = body;
      const instance = PROCESS_REGISTRY.get(projectDir);
      if (!instance) {
        return sendJSON({ success: false, message: "No running process found." });
      }

      const { child } = instance;
      instance.status = "stopped";
      instance.port = undefined;

      if (child.pid) {
        if (process.platform === "win32") {
          try {
            await execPromise(`taskkill /pid ${child.pid} /t /f`);
          } catch {
            child.kill("SIGTERM");
          }
        } else {
          child.kill("SIGTERM");
        }
      }
      return sendJSON({ success: true });
    }

    // 11. Stream Logs
    if (pathname === "/api/stream-logs" && req.method === "GET") {
      const projectDir = parsedUrl.query.projectDir as string;
      if (!projectDir) {
        return sendError("Missing projectDir query parameter.", 400);
      }
      const instance = PROCESS_REGISTRY.get(projectDir);
      if (!instance) {
        return sendError("No logs found. Process is not initialized.", 404);
      }

      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      // Write existing logs
      for (const line of instance.logs) {
        res.write(line);
      }

      const logListener = (text: string) => {
        res.write(text);
      };
      instance.listeners.add(logListener);

      const keepAliveInterval = setInterval(() => {
        res.write("");
      }, 15000);

      req.on("close", () => {
        clearInterval(keepAliveInterval);
        instance.listeners.delete(logListener);
      });

      instance.child.on("close", () => {
        clearInterval(keepAliveInterval);
        instance.listeners.delete(logListener);
        res.end();
      });
      return;
    }

    // 12. Scan Port
    if (pathname === "/api/scan-port" && req.method === "POST") {
      const body = await getBody();
      const active = await checkPortStatus(body.port);
      return sendJSON({ active });
    }

    // 13. Deploy to Emulator
    if (pathname === "/api/deploy-to-emulator" && req.method === "POST") {
      const body = await getBody();
      const { projectDir, apkPath, packageId } = body;
      const resolvedDir = await resolveDirFromSlug(projectDir);
      
      let fullApkPath = "";
      if (apkPath) {
        fullApkPath = `E:\\${resolvedDir}\\${apkPath}`;
      } else {
        const safeSlug = projectDir.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        fullApkPath = `e:\\Manager\\frontend\\public\\apks\\${safeSlug}.apk`;
      }

      try {
        const { stdout: devicesStdout } = await execPromise("adb devices");
        const deviceLines = devicesStdout.trim().split("\n").slice(1);
        const activeDevices = deviceLines.filter((l) => l.includes("\tdevice"));

        if (activeDevices.length === 0) {
          return sendError("No connected Android emulator or device found. Please launch an emulator first.", 400);
        }

        await execPromise(`adb install -r "${fullApkPath}"`);
        await execPromise(`adb shell monkey -p ${packageId} -c android.intent.category.LAUNCHER 1`);

        return sendJSON({ success: true, message: "APK successfully installed and launched on emulator." });
      } catch (err) {
        return sendError(`Deployment failed: ${(err as Error).message}`, 500);
      }
    }

    // Default 404
    return sendError("Not Found", 404);
  } catch (err) {
    console.error(`Companion server error handling ${pathname}:`, err);
    return sendError(`Internal Server Error: ${(err as Error).message}`, 500);
  }
});

server.listen(PORT, () => {
  console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mCompanion:\x1b[0m \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
});
