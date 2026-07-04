import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@/hooks/use-query";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { 
  streamLogs, 
  stopDevServer, 
  startDevServer,
  triggerProjectBuild,
  getProjectBuilds,
  streamBuildLogs,
  getDockerContainers,
  getDockerImages,
  runDockerAction,
  type ProjectBuild,
  type DockerContainer,
  type DockerImage
} from "@/lib/api/processes";
import { getProjectDetail } from "@/lib/api/explorer.functions";
import { toast } from "sonner";
import {
  Play,
  RotateCw,
  XCircle,
  Clock,
  GitBranch,
  GitCommit,
  User,
  CheckCircle2,
  Terminal as TerminalIcon,
  Trash2,
  Maximize2,
  Loader2,
  Activity,
  Server,
  HardDrive,
  PlayCircle,
  StopCircle,
  RefreshCw,
  HelpCircle,
  Check,
  X,
  Plus,
  AlertTriangle,
} from "lucide-react";

function ProjectPipelinePage() {
  const { slug } = useParams();
  if (!slug) {
    return <div className="text-muted-foreground">Error: Missing project identifier.</div>;
  }
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [streamSource, setStreamSource] = useState<"dev" | "build" | "interactive">("dev");
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [expandedBuildId, setExpandedBuildId] = useState<string | null>(null);

  const [terminalTabs, setTerminalTabs] = useState<{ id: string; name: string }[]>([
    { id: "1", name: "powershell" }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>("1");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>("");
  const terminalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const xtermInstances = useRef<Record<string, XTerm>>({});
  const wsInstances = useRef<Record<string, WebSocket>>({});

  const addTerminalTab = () => {
    const newId = Date.now().toString();
    setTerminalTabs([...terminalTabs, { id: newId, name: "powershell" }]);
    setActiveTerminalId(newId);
  };

  const removeTerminalTab = (id: string) => {
    if (wsInstances.current[id]) {
      wsInstances.current[id].close();
      delete wsInstances.current[id];
    }
    if (xtermInstances.current[id]) {
      xtermInstances.current[id].dispose();
      delete xtermInstances.current[id];
    }
    if (terminalRefs.current[id]) {
      delete terminalRefs.current[id];
    }

    const filtered = terminalTabs.filter((t) => t.id !== id);
    setTerminalTabs(filtered);
    if (activeTerminalId === id && filtered.length > 0) {
      setActiveTerminalId(filtered[filtered.length - 1].id);
    }
  };

  useEffect(() => {
    if (streamSource !== "interactive") {
      Object.keys(wsInstances.current).forEach((id) => {
        try { wsInstances.current[id].close(); } catch {}
      });
      Object.keys(xtermInstances.current).forEach((id) => {
        try { xtermInstances.current[id].dispose(); } catch {}
      });
      wsInstances.current = {};
      xtermInstances.current = {};
      terminalRefs.current = {};
      return;
    }

    terminalTabs.forEach((tab) => {
      const container = terminalRefs.current[tab.id];
      if (!container || xtermInstances.current[tab.id]) return;

      const term = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.2,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        theme: {
          background: "#09090b",
          foreground: "#d4d4d8",
          cursor: "#10b981",
        },
        convertEol: true,
        logLevel: "off",
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();
      xtermInstances.current[tab.id] = term;

      const localWsHost = "ws://localhost:3000";
      const hostedWsHost = import.meta.env.VITE_BACKEND_WS_URL || "wss://devpilot-backend-keet.onrender.com";

      let currentWs: WebSocket | null = null;
      let isFallbackActive = false;

      const connect = (wsHostUrl: string, isFallback: boolean) => {
        const wsUrl = `${wsHostUrl}/terminal?projectDir=${encodeURIComponent(slug)}&session=${tab.id}`;
        const ws = new WebSocket(wsUrl);
        currentWs = ws;
        wsInstances.current[tab.id] = ws;

        let hasOpened = false;

        ws.onopen = () => {
          hasOpened = true;
          term.write(`\r\n\x1b[32m[Connected to DevPilot ${isFallback ? "Hosted" : "Local"} Terminal Agent]\x1b[0m\r\n`);
          term.write("\x1b[33mTo run frontend, type: cd frontend; npm run dev\x1b[0m\r\n");
          term.write("\x1b[33mTo run backend, type: cd backend; npm start\x1b[0m\r\n\r\n");
          const dims = { type: "resize", cols: term.cols, rows: term.rows };
          ws.send(JSON.stringify(dims));
        };

        ws.onmessage = (event) => {
          term.write(event.data);
        };

        ws.onerror = () => {
          if (!hasOpened && !isFallback && hostedWsHost && hostedWsHost !== localWsHost) {
            term.write("\r\n\x1b[33m[Local Terminal Agent unavailable. Trying hosted agent...]\x1b[0m\r\n");
            isFallbackActive = true;
            ws.close();
            connect(hostedWsHost, true);
          } else if (!hasOpened) {
            term.write(`\r\n\x1b[31m[Error connecting to DevPilot ${isFallback ? "Hosted" : "Local"} Agent.]\x1b[0m\r\n`);
          }
        };

        ws.onclose = (event) => {
          if (hasOpened) {
            term.write(`\r\n\x1b[31m[Terminal Agent Disconnected (Code: ${event.code})]\x1b[0m\r\n`);
          } else if (!isFallback && hostedWsHost && hostedWsHost !== localWsHost && !isFallbackActive) {
            isFallbackActive = true;
            connect(hostedWsHost, true);
          }
        };
      };

      connect(localWsHost, false);

      term.onData((data) => {
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
          currentWs.send(data);
        }
      });
    });

    const activeTerm = xtermInstances.current[activeTerminalId];
    if (activeTerm) {
      setTimeout(() => {
        try {
          const fitAddon = (activeTerm as any)._addons.find((a: any) => a instanceof FitAddon);
          if (fitAddon) fitAddon.fit();
        } catch {}
      }, 50);
    }
  }, [streamSource, terminalTabs, activeTerminalId, slug]);

  useEffect(() => {
    if (slug) {
      localStorage.setItem("last_project_slug", slug);
    }
  }, [slug]);

  const queryClient = useQueryClient();

  // Queries for Project details
  const { data: project } = useQuery({
    queryKey: ["project-detail", slug],
    queryFn: () => getProjectDetail({ data: { projectDir: slug } }),
  });

  // Queries for Build History
  const { data: buildHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["build-history", slug],
    queryFn: () => getProjectBuilds(slug),
  });

  // Queries for Docker assets
  const { data: dockerContainers, refetch: refetchContainers } = useQuery({
    queryKey: ["docker-containers", slug],
    queryFn: () => getDockerContainers(slug),
    enabled: !!project,
    refetchInterval: 5000,
  });

  const { data: dockerImages, refetch: refetchImages } = useQuery({
    queryKey: ["docker-images", slug],
    queryFn: () => getDockerImages(slug),
    enabled: !!project,
  });

  const stopServerMutation = useMutation({
    mutationFn: () => stopDevServer({ data: { projectDir: slug } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-statuses"] });
      toast.success("Dev server stopped.");
    },
    onError: (err: any) => {
      toast.error(`Failed to stop server: ${err.message}`);
    }
  });

  const restartServerMutation = useMutation({
    mutationFn: () => startDevServer({ data: { projectDir: slug, script: "dev" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-statuses"] });
      toast.success("Restarting dev server...");
      setTimerSeconds(0);
      setLogs(["[Control Panel] Connecting to console stream..."]);
    },
    onError: (err: any) => {
      toast.error(`Failed to start server: ${err.message}`);
    }
  });

  const triggerBuildMutation = useMutation({
    mutationFn: () => triggerProjectBuild(slug),
    onSuccess: (data) => {
      toast.success("Build pipeline initialized.");
      setActiveBuildId(data.buildId);
      setStreamSource("build");
      setLogs(["[Control Panel] Initializing build log stream..."]);
      refetchHistory();
    },
    onError: (err: any) => {
      toast.error(`Build failed to trigger: ${err.message}`);
    }
  });

  const dockerActionMutation = useMutation({
    mutationFn: ({ containerId, action }: { containerId: string; action: string }) =>
      runDockerAction(slug, containerId, action),
    onSuccess: () => {
      toast.success("Docker container command sent successfully.");
      refetchContainers();
    },
    onError: (err: any) => {
      toast.error(`Docker command failed: ${err.message}`);
    }
  });

  const projectName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // Dev server logs streaming reader
  useEffect(() => {
    if (streamSource !== "dev") return;
    let active = true;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    async function connectStream() {
      try {
        setLogs(["[Control Panel] Connecting to dev server console stream..."]);
        setIsRunning(true);

        const response = await streamLogs({ data: { projectDir: slug as string } });
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          setLogs(["[Console] Web service output stream idle."]);
          setIsRunning(false);
          return;
        }

        if (!response.body) {
          throw new Error("No response body stream found.");
        }

        setLogs([]);
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          if (buffer.includes("\n")) {
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            const filteredLines = lines.filter(line => line.trim() !== "");
            if (filteredLines.length > 0) {
              setLogs((prev) => [...prev, ...filteredLines]);
            }
          }
        }
      } catch (err: any) {
        if (active) {
          setLogs((prev) => [...prev, `[Control Panel] Dev server stream closed: ${err.message}`]);
        }
      } finally {
        if (active) {
          setIsRunning(false);
        }
      }
    }

    connectStream();

    return () => {
      active = false;
      if (reader) {
        reader.cancel().catch(() => { });
      }
    };
  }, [slug, streamSource]);

  // Build logs streaming reader
  useEffect(() => {
    if (streamSource !== "build" || !activeBuildId) return;
    let active = true;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    async function connectBuildStream() {
      try {
        setLogs(["[Control Panel] Connecting to build pipeline log stream..."]);
        setIsRunning(true);

        const response = await streamBuildLogs(activeBuildId!);
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          setLogs(["[Debug Console] Build pipeline stream idle."]);
          setIsRunning(false);
          return;
        }

        if (!response.body) {
          throw new Error("No response body stream found.");
        }

        setLogs([]);
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          if (buffer.includes("\n")) {
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            const filteredLines = lines.filter(line => line.trim() !== "");
            if (filteredLines.length > 0) {
              setLogs((prev) => [...prev, ...filteredLines]);
            }
          }
        }
      } catch (err: any) {
        if (active) {
          setLogs((prev) => [...prev, `[Control Panel] Build log stream completed/closed: ${err.message}`]);
        }
      } finally {
        if (active) {
          setIsRunning(false);
          refetchHistory();
        }
      }
    }

    connectBuildStream();

    return () => {
      active = false;
      if (reader) {
        reader.cancel().catch(() => { });
      }
    };
  }, [activeBuildId, streamSource]);

  // Live timer tick
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Autoscroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleRestart = () => {
    restartServerMutation.mutate();
  };

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl 3xl:max-w-[1600px] 4xl:max-w-[2000px] 5xl:max-w-[2400px] w-full mx-auto space-y-8 animate-fade-in">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <span className={`w-1.5 h-1.5 rounded-full bg-primary ${isRunning ? "animate-pulse" : ""}`} />
                {isRunning ? "Stream Active" : "Stream Idle"}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider font-mono">Build & Deploy Panel</span>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
              <Activity className="h-7 w-7 text-primary" /> {projectName} Pipeline
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Stream selector toggles */}
            <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40 text-xs font-semibold">
              <button
                onClick={() => {
                  setStreamSource("dev");
                  setLogs(["[Control Panel] Connecting to dev server logs..."]);
                }}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  streamSource === "dev" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Dev Server
              </button>
              <button
                onClick={() => {
                  setStreamSource("build");
                  if (activeBuildId) {
                    setLogs(["[Control Panel] Fetching active build stream..."]);
                  } else {
                    setLogs(["[Control Panel] Select a build from history or run a build to view pipeline output logs."]);
                  }
                }}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  streamSource === "build" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Build Pipeline
              </button>
            </div>

            <Button
              onClick={() => triggerBuildMutation.mutate()}
              disabled={triggerBuildMutation.isPending || (isRunning && streamSource === "build")}
              size="sm"
              className="gap-2 h-9 bg-primary text-primary-foreground hover:bg-primary/95 shadow-lg shadow-primary/10 cursor-pointer font-bold"
            >
              {triggerBuildMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Build
            </Button>
          </div>
        </header>

        {/* Meta Stats Panel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass border border-border/40 rounded-xl p-4 flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Branch</span>
            <span className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-primary" /> main
            </span>
          </div>
          
          <div className="glass border border-border/40 rounded-xl p-4 flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Stream</span>
            <span className="text-xs font-bold text-foreground capitalize">
              {streamSource === "dev" ? "Dev Server Console" : "Build Pipeline"}
            </span>
          </div>

          <div className="glass border border-border/40 rounded-xl p-4 flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Duration</span>
            <span className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {formatTimer(timerSeconds)}
            </span>
          </div>

          <div className="glass border border-border/40 rounded-xl p-4 flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Builds</span>
            <span className="text-xs font-bold text-foreground font-mono">
              {buildHistory ? buildHistory.length : 0} executions
            </span>
          </div>
        </div>

        {/* Pipeline flowchart + Live Terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: flowchart */}
          <div className="lg:col-span-12 border border-border/40 rounded-xl bg-card/60 backdrop-blur p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] relative overflow-hidden space-y-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-primary" /> Pipeline Execution Flow
            </h3>

            <div className="relative pl-6 space-y-6 text-xs">
              {/* Line connector */}
              <div className="absolute left-[13px] top-3 bottom-5 w-0.5 bg-border/40 rounded-full" />

              {/* Stage 1 */}
              <div className="relative flex gap-4">
                <div className="absolute left-[-21px] z-10 w-4.5 h-4.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow">
                  <Check className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-foreground">Trigger Build</span>
                    <span className="text-[9px] text-muted-foreground font-mono">Manual Trigger</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Build initialized via UI click event.</p>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="relative flex gap-4">
                <div className="absolute left-[-21px] z-10 w-4.5 h-4.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow">
                  <Check className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-foreground">Environment Setup</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Verified path folders, engines compatibility and .env variables.</p>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="relative flex gap-4 opacity-50">
                <div className="absolute left-[-21px] z-10 w-4.5 h-4.5 rounded-full bg-muted/40 border border-border text-muted-foreground flex items-center justify-center shadow">
                  <Check className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-foreground">Compilation & Bundling</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Compiles source code assets, runs build scripts, or constructs containers.</p>
                </div>
              </div>

              {/* Stage 4 */}
              <div className="relative flex gap-4 opacity-50">
                <div className="absolute left-[-21px] z-10 w-4.5 h-4.5 rounded-full bg-muted/40 border border-border text-muted-foreground flex items-center justify-center shadow">
                  <Check className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-foreground">Validation & Log Archive</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Saves build log excerpt to Database and notifies team members.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Console Terminal */}
          <div className="lg:col-span-12 border border-border/40 rounded-xl bg-[#18181b] shadow-2xl flex flex-col h-[500px] overflow-hidden text-[11px] font-sans">
            <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-[#2d2d2d] select-none text-zinc-400">
              <div className="flex items-center gap-4">
                <span className="cursor-not-allowed hover:text-zinc-500 transition-colors text-zinc-600">
                  Problems
                </span>
                <button
                  onClick={() => setStreamSource("dev")}
                  className={`transition-colors cursor-pointer hover:text-zinc-200 ${
                    streamSource === "dev"
                      ? "text-zinc-100 font-semibold border-b-2 border-primary pb-1 pt-0.5"
                      : "pb-1 pt-0.5"
                  }`}
                >
                  Output
                </button>
                <button
                  onClick={() => setStreamSource("build")}
                  className={`transition-colors cursor-pointer hover:text-zinc-200 ${
                    streamSource === "build"
                      ? "text-zinc-100 font-semibold border-b-2 border-primary pb-1 pt-0.5"
                      : "pb-1 pt-0.5"
                  }`}
                >
                  Debug Console
                </button>
                <button
                  onClick={() => setStreamSource("interactive")}
                  className={`transition-colors cursor-pointer hover:text-zinc-200 ${
                    streamSource === "interactive"
                      ? "text-zinc-100 font-semibold border-b-2 border-primary pb-1 pt-0.5"
                      : "pb-1 pt-0.5"
                  }`}
                >
                  Terminal
                </button>
                <span className="cursor-not-allowed hover:text-zinc-500 transition-colors text-zinc-600">
                  Ports
                </span>
              </div>

              <div className="flex items-center gap-2 text-zinc-500">
                {streamSource === "interactive" && (
                  <>
                    <button
                      onClick={addTerminalTab}
                      className="hover:text-zinc-300 p-1 rounded hover:bg-[#2d2d2d] transition-colors cursor-pointer"
                      title="New Terminal"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeTerminalTab(activeTerminalId)}
                      className="hover:text-zinc-300 p-1 rounded hover:bg-[#2d2d2d] transition-colors cursor-pointer"
                      title="Kill Terminal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {streamSource !== "interactive" && (
                  <button
                    onClick={() => setLogs(["-- Console Output Stream Cleared --"])}
                    className="hover:text-zinc-300 p-1 rounded hover:bg-[#2d2d2d] transition-colors cursor-pointer"
                    title="Clear Console"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {streamSource === "interactive" ? (
              <div className="flex-1 flex overflow-hidden bg-[#121212]">
                {/* Left: Terminal Shell Screens */}
                <div className="flex-1 p-4 overflow-hidden relative">
                  {terminalTabs.map((tab) => (
                    <div
                      key={tab.id}
                      ref={(el) => {
                        terminalRefs.current[tab.id] = el;
                      }}
                      className={tab.id === activeTerminalId ? "w-full h-full text-left bg-[#121212]" : "hidden"}
                    />
                  ))}
                </div>

                {/* Right: VS Code-style Shells Sidebar */}
                <div className="w-[155px] border-l border-zinc-800 bg-[#18181b] p-1 flex flex-col gap-0.5 select-none overflow-y-auto shrink-0">
                  {terminalTabs.map((tab) => {
                    const isActive = tab.id === activeTerminalId;
                    const isEditing = tab.id === editingTabId;
                    return (
                      <div
                        key={tab.id}
                        onClick={() => {
                          if (!isEditing) setActiveTerminalId(tab.id);
                        }}
                        onDoubleClick={() => {
                          setEditingTabId(tab.id);
                          setEditingTabName(tab.name);
                        }}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                          isActive
                            ? "bg-[#2d2d2d] text-zinc-100 font-bold border-l-2 border-primary"
                            : "text-zinc-400 hover:bg-[#1e1e1e] hover:text-zinc-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 w-full overflow-hidden">
                          <TerminalIcon className={`h-3 w-3 shrink-0 ${isActive ? "text-primary" : "text-zinc-500"}`} />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingTabName}
                              onChange={(e) => setEditingTabName(e.target.value)}
                              onBlur={() => {
                                if (editingTabName.trim()) {
                                  setTerminalTabs(
                                    terminalTabs.map((t) => (t.id === tab.id ? { ...t, name: editingTabName } : t))
                                  );
                                }
                                setEditingTabId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (editingTabName.trim()) {
                                    setTerminalTabs(
                                      terminalTabs.map((t) => (t.id === tab.id ? { ...t, name: editingTabName } : t))
                                    );
                                  }
                                  setEditingTabId(null);
                                } else if (e.key === "Escape") {
                                  setEditingTabId(null);
                                }
                              }}
                              className="bg-zinc-800 text-zinc-100 px-1 py-0.5 rounded outline-none border border-zinc-700 w-full"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate">{tab.name}</span>
                          )}
                        </div>
                        {terminalTabs.length > 1 && !isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTerminalTab(tab.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity p-0.5 shrink-0"
                            title="Kill Terminal"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-300 select-text">
                {logs.map((log, index) => {
                  let colorClass = "text-zinc-400";
                  const lowerLog = log.toLowerCase();
                  if (lowerLog.includes("error") || lowerLog.includes("failed")) {
                    colorClass = "text-red-400 font-bold";
                  } else if (lowerLog.includes("success") || lowerLog.includes("completed")) {
                    colorClass = "text-emerald-400 font-semibold";
                  } else if (log.startsWith("[warn]")) {
                    colorClass = "text-amber-400";
                  } else if (log.startsWith("[")) {
                    colorClass = "text-zinc-500 font-bold";
                  } else if (log.startsWith(">")) {
                    colorClass = "text-zinc-100";
                  }
                  return (
                    <div key={index} className={`mb-1 whitespace-pre-wrap ${colorClass}`}>
                      {log}
                    </div>
                  );
                })}
                {isRunning && (
                  <span className="inline-block w-2 h-3.5 bg-primary ml-1 animate-pulse" />
                )}
                <div ref={terminalEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Build History Table */}
        <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-4">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <HardDrive className="h-4.5 w-4.5 text-primary" /> Build Execution History
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Audit log of recent builds, statuses, and excerpts</p>
          </div>

          <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/20">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/40 font-bold text-muted-foreground">
                  <th className="p-3">Build ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Triggered</th>
                  <th className="p-3">Exit Code</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {buildHistory && buildHistory.map((build: ProjectBuild) => {
                  const isExpanded = expandedBuildId === build.id;
                  return (
                    <tr key={build.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                      <td colSpan={5} className="p-0">
                        <div className="flex w-full justify-between items-center p-3">
                          <span className="font-mono font-bold text-primary w-1/4 truncate">{build.id}</span>
                          <span className="w-1/6">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              build.status === "success"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : build.status === "failed"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}>
                              {build.status}
                            </span>
                          </span>
                          <span className="text-muted-foreground w-1/4">
                            {new Date(build.started_at).toLocaleString()}
                          </span>
                          <span className="font-mono text-foreground font-semibold w-1/12 text-center">
                            {build.exit_code !== undefined && build.exit_code !== null ? build.exit_code : "—"}
                          </span>
                          <div className="flex gap-3 text-right w-1/4 justify-end">
                            <button
                              onClick={() => {
                                setActiveBuildId(build.id);
                                setStreamSource("build");
                                setLogs(["[Control Panel] Loading build log from disk..."]);
                              }}
                              className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                            >
                              Load Logs
                            </button>
                            <button
                              onClick={() => setExpandedBuildId(isExpanded ? null : build.id)}
                              className="text-[10px] font-bold text-muted-foreground hover:underline cursor-pointer"
                            >
                              {isExpanded ? "Hide Excerpt" : "View Excerpt"}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 bg-muted/10 border-t border-border/20">
                            <div className="bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono text-[10px] p-3 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {build.log_excerpt || "No log excerpt saved for this run."}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(!buildHistory || buildHistory.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground italic">
                      No build history entries found. Trigger a build to populate this list.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Docker Management Panel */}
        {dockerImages && dockerImages.length > 0 && (
          <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-6 animate-fade-in">
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Server className="h-4.5 w-4.5 text-primary" /> Docker Container Pipelines
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Control Docker containers and inspect project deployment images</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Containers */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <PlayCircle className="h-4 w-4 text-emerald-400" /> Active Containers
                </h4>

                <div className="space-y-2.5">
                  {dockerContainers && dockerContainers.map((container: DockerContainer) => (
                    <div key={container.id} className="flex items-center justify-between p-3.5 border border-border/40 rounded-xl bg-muted/20 text-xs">
                      <div className="space-y-1 truncate max-w-[70%]">
                        <div className="font-bold text-foreground truncate">{container.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{container.image} · {container.ports}</div>
                        <div className="text-[10px] font-semibold text-emerald-400">{container.status}</div>
                      </div>

                      <div className="flex gap-2">
                        {container.status.toLowerCase().includes("up") ? (
                          <button
                            onClick={() => dockerActionMutation.mutate({ containerId: container.id, action: "stop" })}
                            disabled={dockerActionMutation.isPending}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"
                            title="Stop Container"
                          >
                            <StopCircle className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => dockerActionMutation.mutate({ containerId: container.id, action: "start" })}
                            disabled={dockerActionMutation.isPending}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                            title="Start Container"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => dockerActionMutation.mutate({ containerId: container.id, action: "restart" })}
                          disabled={dockerActionMutation.isPending}
                          className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                          title="Restart Container"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!dockerContainers || dockerContainers.length === 0) && (
                    <div className="text-xs text-muted-foreground italic py-3">No containers matched this project tag.</div>
                  )}
                </div>
              </div>

              {/* Images */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-primary" /> Image Repository
                </h4>

                <div className="space-y-2.5">
                  {dockerImages && dockerImages.map((image: DockerImage) => (
                    <div key={image.id} className="flex items-center justify-between p-3.5 border border-border/40 rounded-xl bg-muted/20 text-xs">
                      <div className="space-y-1">
                        <div className="font-bold text-foreground font-mono">{image.repository}:{image.tag}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">ID: {image.id.slice(0, 12)} · Size: {image.size}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold">{image.createdAt}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default ProjectPipelinePage;
