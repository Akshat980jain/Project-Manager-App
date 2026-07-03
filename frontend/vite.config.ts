import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from "fs";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    {
      name: "fs-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith("/api/")) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const pathname = url.pathname;
            
            if (pathname === "/api/get-file-tree") {
              res.setHeader("Content-Type", "application/json");
              const projectDir = url.searchParams.get("projectDir");
              if (!projectDir) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Missing projectDir" }));
                return;
              }
              
              const targetPath = resolveProjectPath(projectDir);
              try {
                if (targetPath && fs.existsSync(targetPath)) {
                  const tree = buildFileTree(targetPath, targetPath, projectDir);
                  res.end(JSON.stringify(tree));
                } else {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Directory not found" }));
                }
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
              return;
            }
            
            if (pathname === "/api/get-file-content") {
              const fullPath = url.searchParams.get("fullPath");
              if (!fullPath) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Missing fullPath" }));
                return;
              }
              
              const parts = fullPath.replace(/\\/g, "/").split("/");
              const projectDir = parts[0];
              const relativeFilePath = parts.slice(1).join("/");
              
              const targetProjectPath = resolveProjectPath(projectDir);
              if (!targetProjectPath) {
                res.statusCode = 404;
                res.end("Project directory not found");
                return;
              }
              
              const targetPath = path.join(targetProjectPath, relativeFilePath);
              
              try {
                if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
                  const content = fs.readFileSync(targetPath, "utf-8");
                  res.setHeader("Content-Type", "text/plain");
                  res.end(content);
                } else {
                  res.statusCode = 404;
                  res.end("File not found");
                }
              } catch (e: any) {
                res.statusCode = 500;
                res.end(e.message);
              }
              return;
            }
            
            if (pathname === "/api/get-file-stats") {
              res.setHeader("Content-Type", "application/json");
              const projectDir = url.searchParams.get("projectDir");
              if (!projectDir) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Missing projectDir" }));
                return;
              }
              
              const targetPath = resolveProjectPath(projectDir);
              try {
                if (targetPath && fs.existsSync(targetPath)) {
                  const stats = getDirStats(targetPath);
                  res.end(JSON.stringify(stats));
                } else {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Directory not found" }));
                }
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
              return;
            }
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});

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

function resolveProjectPath(projectDir: string): string | null {
  const parentDir = path.resolve(process.cwd(), "../..");
  
  // 0. Check mapped directory first
  const lowerDir = projectDir.toLowerCase();
  if (MAPPED_DIRECTORIES[lowerDir]) {
    const mappedPath = path.join(parentDir, MAPPED_DIRECTORIES[lowerDir]);
    if (fs.existsSync(mappedPath)) {
      return mappedPath;
    }
  }
  
  // 1. Direct match (exact case-insensitive match)
  const directPath = path.join(parentDir, projectDir);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  
  // 2. Scan parent directory and match slugified folder names
  try {
    const items = fs.readdirSync(parentDir);
    for (const item of items) {
      const itemPath = path.join(parentDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const slugifiedItem = item
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
          
        if (slugifiedItem === projectDir.toLowerCase()) {
          return itemPath;
        }
      }
    }
  } catch (e) {
    console.error("Error scanning directories in resolveProjectPath:", e);
  }
  
  return null;
}

function buildFileTree(dir: string, baseDir: string, projectDir: string): any[] {
  const items = fs.readdirSync(dir);
  const result: any[] = [];
  
  for (const item of items) {
    if (item === "node_modules" || item === ".git" || item === "dist" || item === "build") {
      continue;
    }
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    const isDirectory = fs.statSync(fullPath).isDirectory();
    
    const node: any = {
      name: item,
      relativePath,
      fullPath: `${projectDir}/${relativePath}`,
      isDirectory,
    };
    
    if (isDirectory) {
      const depth = relativePath.split("/").length;
      if (depth <= 3) {
        node.children = buildFileTree(fullPath, baseDir, projectDir);
      } else {
        node.children = [];
      }
    }
    
    result.push(node);
  }
  
  return result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

function findAndroidGradleSync(dir: string, depth = 0): string | null {
  if (depth > 5) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name === "build.gradle" || entry.name === "build.gradle.kts")) {
        const fullPath = path.join(dir, entry.name);
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes("com.android.application") || content.includes("android {") || content.includes("applicationId")) {
          return fullPath;
        }
      }
    }
    const EXCLUDED = new Set(["node_modules", ".git", ".gradle", ".idea", "caches", "build-cache", "ios", "frontend", "client", "backend", "server", "docs"]);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED.has(entry.name.toLowerCase())) continue;
        const found = findAndroidGradleSync(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

function parseGradleDetailsSync(gradlePath: string) {
  try {
    const content = fs.readFileSync(gradlePath, "utf-8");
    const compileSdkMatch = content.match(/compileSdk\s*=\s*(\d+)/) || content.match(/compileSdkVersion\s+(\d+)/);
    const minSdkMatch = content.match(/minSdk\s*=\s*(\d+)/) || content.match(/minSdkVersion\s+(\d+)/);
    const targetSdkMatch = content.match(/targetSdk\s*=\s*(\d+)/) || content.match(/targetSdkVersion\s+(\d+)/);
    const appIdMatch = content.match(/applicationId\s*=\s*"([^"]+)"/) || content.match(/applicationId\s*=\s*'([^']+)'/);
    const isCompose = content.includes("compose = true") || content.includes("useCompose") || content.includes("compose true");

    return {
      compileSdk: compileSdkMatch ? compileSdkMatch[1] : "34",
      minSdk: minSdkMatch ? minSdkMatch[1] : "26",
      targetSdk: targetSdkMatch ? targetSdkMatch[1] : "34",
      applicationId: appIdMatch ? appIdMatch[1] : `com.${path.basename(path.dirname(path.dirname(gradlePath))).toLowerCase().replace(/[^a-z0-9]+/g, ".")}.app`,
      framework: isCompose ? "Jetpack Compose" : "Native Android (Kotlin / Java)",
    };
  } catch {
    return null;
  }
}

function findPackageJsonSync(dir: string, depth = 0): string[] {
  if (depth > 3) return [];
  const paths: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === "package.json") {
        paths.push(path.join(dir, entry.name));
      }
    }
    const EXCLUDED = new Set(["node_modules", ".git", ".gradle", ".idea", "caches", "build-cache", "ios", "docs"]);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED.has(entry.name.toLowerCase())) continue;
        paths.push(...findPackageJsonSync(path.join(dir, entry.name), depth + 1));
      }
    }
  } catch {}
  return paths;
}

function getDirStats(dir: string): {
  folderCount: number;
  fileCount: number;
  readmeContent: string;
  hasAndroid: boolean;
  hasFrontend: boolean;
  hasBackend: boolean;
  androidDetails: any;
  structureType: string;
  dependencies: string[];
  detectedSupabase: boolean;
  detectedFirebase: boolean;
  detectedExpress: boolean;
  detectedReact: boolean;
  detectedNext: boolean;
  detectedVite: boolean;
  detectedMongoDB: boolean;
  detectedPostgreSQL: boolean;
  detectedSQLite: boolean;
} {
  let folderCount = 0;
  let fileCount = 0;
  let readmeContent = "";
  
  function walk(currentDir: string) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      if (item === "node_modules" || item === ".git" || item === "dist" || item === "build") {
        continue;
      }
      const fullPath = path.join(currentDir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        folderCount++;
        walk(fullPath);
      } else {
        fileCount++;
      }
    }
  }
  
  try {
    walk(dir);
    
    // Check for README.md or readme.md
    const readmePaths = [
      path.join(dir, "README.md"),
      path.join(dir, "readme.md"),
      path.join(dir, "README"),
      path.join(dir, "readme")
    ];
    
    for (const rp of readmePaths) {
      if (fs.existsSync(rp) && fs.statSync(rp).isFile()) {
        readmeContent = fs.readFileSync(rp, "utf-8");
        break;
      }
    }
  } catch (e) {}

  // Scan for components
  let hasAndroid = false;
  let androidDetails = null;
  let hasFrontend = false;
  let hasBackend = false;

  try {
    const androidGradlePath = findAndroidGradleSync(dir);
    if (androidGradlePath) {
      hasAndroid = true;
      androidDetails = parseGradleDetailsSync(androidGradlePath);
    } else if (fs.existsSync(path.join(dir, "android")) || fs.existsSync(path.join(dir, "Android"))) {
      hasAndroid = true;
    }

    const subDirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name.toLowerCase());

    for (const name of subDirs) {
      if (name === "frontend" || name === "client" || name.includes("web")) {
        hasFrontend = true;
      }
      if (name === "backend" || name === "server" || name === "api") {
        hasBackend = true;
      }
    }
  } catch (e) {}

  // Parse package.json dependencies and detect frameworks
  const dependencies: string[] = [];
  let detectedSupabase = false;
  let detectedFirebase = false;
  let detectedExpress = false;
  let detectedReact = false;
  let detectedNext = false;
  let detectedVite = false;
  let detectedMongoDB = false;
  let detectedPostgreSQL = false;
  let detectedSQLite = false;

  try {
    const packageJsonPaths = findPackageJsonSync(dir);
    for (const pkgPath of packageJsonPaths) {
      const content = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {})
      };
      
      for (const dep of Object.keys(allDeps)) {
        if (!dependencies.includes(dep)) {
          dependencies.push(dep);
        }
        const lowerDep = dep.toLowerCase();
        if (lowerDep.includes("supabase")) detectedSupabase = true;
        if (lowerDep.includes("firebase")) detectedFirebase = true;
        if (lowerDep.includes("express")) detectedExpress = true;
        if (lowerDep.includes("react")) detectedReact = true;
        if (lowerDep.includes("next")) detectedNext = true;
        if (lowerDep.includes("vite")) detectedVite = true;
        if (lowerDep.includes("mongodb") || lowerDep.includes("mongoose")) detectedMongoDB = true;
        if (lowerDep.includes("pg") || lowerDep.includes("postgres")) detectedPostgreSQL = true;
        if (lowerDep.includes("sqlite")) detectedSQLite = true;
      }
    }
  } catch (e) {}

  let structureType = "Single App";
  if (hasBackend && hasFrontend && hasAndroid) {
    structureType = "Full-Stack + Android";
  } else if (hasBackend && hasFrontend) {
    structureType = "Full-Stack (Client + Server)";
  } else if (hasFrontend && hasAndroid) {
    structureType = "Full-Stack + Android";
  } else if (hasAndroid) {
    structureType = "Android Mobile App";
  } else if (hasBackend) {
    structureType = "Backend Service";
  } else if (hasFrontend) {
    structureType = "Frontend Application";
  }

  return {
    folderCount,
    fileCount,
    readmeContent,
    hasAndroid,
    hasFrontend,
    hasBackend,
    androidDetails,
    structureType,
    dependencies,
    detectedSupabase,
    detectedFirebase,
    detectedExpress,
    detectedReact,
    detectedNext,
    detectedVite,
    detectedMongoDB,
    detectedPostgreSQL,
    detectedSQLite,
  };
}
