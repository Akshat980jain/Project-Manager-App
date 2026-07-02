import { ChildProcess } from "child_process";
import * as net from "net";

export interface ProcessInstance {
  child: ChildProcess;
  logs: string[];
  port?: number;
  status: "stopped" | "starting" | "running" | "error";
  error?: string;
  createdAt: string;
}

// Persist the registry on globalThis during development hot-reloads (HMR)
const globalForRegistry = globalThis as unknown as {
  __PROCESS_REGISTRY__?: Map<string, ProcessInstance>;
};

export const PROCESS_REGISTRY =
  globalForRegistry.__PROCESS_REGISTRY__ ?? new Map<string, ProcessInstance>();

if (process.env.NODE_ENV !== "production") {
  globalForRegistry.__PROCESS_REGISTRY__ = PROCESS_REGISTRY;
}

/**
 * Scans a port on localhost using a short TCP connection check
 */
export function checkPortStatus(port: number, host = "127.0.0.1"): Promise<boolean> {
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

/**
 * Attempts to parse a port number out of typical dev server output logs
 */
export function extractPortFromLog(text: string): number | null {
  // Match "localhost:5173" or "127.0.0.1:3000" or similar HTTP urls
  const urlMatch = text.match(/(?:http:\/\/localhost|http:\/\/127\.0\.0\.1):(\d{4,5})/i) ||
                   text.match(/(?:localhost|127\.0\.0\.1):(\d{4,5})/i);
  if (urlMatch) {
    return parseInt(urlMatch[1], 10);
  }

  // Tomcat style: "Tomcat started on port(s): 8080"
  const tomcatMatch = text.match(/port\(s\):\s*(\d{4,5})/i);
  if (tomcatMatch) {
    return parseInt(tomcatMatch[1], 10);
  }

  // Generic listening line: "Listening on port 8080"
  const listeningMatch = text.match(/listening\s+on\s+.*?:?(\d{4,5})/i) ||
                         text.match(/listening\s+on\s+(\d{4,5})/i);
  if (listeningMatch) {
    return parseInt(listeningMatch[1], 10);
  }

  return null;
}
