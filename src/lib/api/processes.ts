"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import { resolveDirFromSlug } from "./explorer.functions";
import { PROCESS_REGISTRY, ProcessInstance, checkPortStatus, extractPortFromLog } from "./processes.server";

const execPromise = promisify(exec);

// Get the list of all tracked process statuses
export const getProcessStatuses = createServerFn({ method: "POST" })
  .handler(async () => {
    const statuses: Record<string, { status: string; port?: number; createdAt?: string }> = {};
    for (const [projectDir, instance] of PROCESS_REGISTRY.entries()) {
      statuses[projectDir] = {
        status: instance.status,
        port: instance.port,
        createdAt: instance.createdAt,
      };
    }
    return statuses;
  });

// Start a dev server inside the project directory
export const startDevServer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      projectDir: z.string(),
      script: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const { projectDir, script } = data;
    const resolvedDir = await resolveDirFromSlug(projectDir);
    const projectPath = `E:\\${resolvedDir}`;

    const existing = PROCESS_REGISTRY.get(projectDir);
    if (existing && (existing.status === "starting" || existing.status === "running")) {
      throw new Error("Server is already running or starting.");
    }

    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "npm.cmd" : "npm";
    const args = ["run", script];

    // Spawn the child process
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
      if (instance.listeners) {
        for (const listener of instance.listeners) {
          try {
            listener(text);
          } catch {}
        }
      }
    };

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      appendLog(text);

      // Detect port
      if (!instance.port) {
        const port = extractPortFromLog(text);
        if (port) {
          instance.port = port;
          instance.status = "running";
        }
      }
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      appendLog(`[stderr] ${text}`);
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

    return { success: true };
  });

// Stop a dev server cleanly (killing process tree on Windows)
export const stopDevServer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ projectDir: z.string() }))
  .handler(async ({ data }) => {
    const { projectDir } = data;
    const instance = PROCESS_REGISTRY.get(projectDir);

    if (!instance) {
      return { success: false, message: "No running process found." };
    }

    const { child } = instance;
    instance.status = "stopped";
    instance.port = undefined;

    if (child.pid) {
      if (process.platform === "win32") {
        // Windows: Kill process tree cleanly to avoid orphaned node processes
        try {
          await execPromise(`taskkill /pid ${child.pid} /t /f`);
        } catch (e) {
          // Fallback if taskkill fails
          child.kill("SIGTERM");
        }
      } else {
        child.kill("SIGTERM");
      }
    }

    return { success: true };
  });

// Real-time server log streaming Server Function returning a readable stream
export const streamLogs = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectDir: z.string() }))
  .handler(async ({ data }) => {
    const { projectDir } = data;
    const instance = PROCESS_REGISTRY.get(projectDir);

    if (!instance) {
      return new Response("No logs found. Process is not initialized.", { status: 404 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Stream existing logs first (backlog)
        for (const line of instance.logs) {
          controller.enqueue(encoder.encode(line));
        }

        // Add dynamic log listener
        const logListener = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            // Controller closed
            instance.listeners?.delete(logListener);
          }
        };

        instance.listeners = instance.listeners ?? new Set();
        instance.listeners.add(logListener);

        // Keep connection alive
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(""));
          } catch {
            clearInterval(keepAliveInterval);
            instance.listeners?.delete(logListener);
          }
        }, 15000);

        // Clean up on close
        instance.child.on("close", () => {
          clearInterval(keepAliveInterval);
          instance.listeners?.delete(logListener);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        // Clean up log listener if client disconnects
        if (instance.listeners) {
          // Look for any listeners and remove them
          instance.listeners.clear();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  });

// Scan port status dynamically
export const scanPort = createServerFn({ method: "POST" })
  .inputValidator(z.object({ port: z.number() }))
  .handler(async ({ data }) => {
    const active = await checkPortStatus(data.port);
    return { active };
  });

// Launch Emulator & Deploy Android APK
export const deployToEmulator = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      projectDir: z.string(),
      apkPath: z.string().optional(),
      packageId: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const { projectDir, apkPath, packageId } = data;
    const resolvedDir = await resolveDirFromSlug(projectDir);
    
    // Resolve APK path: either client-provided relative path or the cached public APK path
    let fullApkPath = "";
    if (apkPath) {
      fullApkPath = `E:\\${resolvedDir}\\${apkPath}`;
    } else {
      const safeSlug = projectDir.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      fullApkPath = `e:\\Manager\\public\\apks\\${safeSlug}.apk`;
    }

    try {
      // 1. Check if adb is running & any emulator is connected
      const { stdout: devicesStdout } = await execPromise("adb devices");
      const deviceLines = devicesStdout.trim().split("\n").slice(1);
      const activeDevices = deviceLines.filter((l) => l.includes("\tdevice"));

      if (activeDevices.length === 0) {
        throw new Error("No connected Android emulator or device found. Please launch an emulator first.");
      }

      // 2. Install the APK
      await execPromise(`adb install -r "${fullApkPath}"`);

      // 3. Launch the main launcher activity
      await execPromise(`adb shell monkey -p ${packageId} -c android.intent.category.LAUNCHER 1`);

      return { success: true, message: "APK successfully installed and launched on emulator." };
    } catch (e) {
      throw new Error(`Deployment failed: ${(e as Error).message}`);
    }
  });
