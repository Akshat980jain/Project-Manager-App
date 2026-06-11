import { useState, useEffect, useRef } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

export const Route = createFileRoute("/projects/$slug/pipeline")({
  head: () => ({
    meta: [
      { title: "Deployment Pipeline — DevEngine" },
      { name: "description", content: "Active build status and compiler log streaming." },
    ],
  }),
  component: ProjectPipelinePage,
});

function ProjectPipelinePage() {
  const { slug } = useParams({ from: "/projects/$slug/pipeline" });
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(165); // starts at 2m 45s
  
  const projectName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // Custom live logs stream simulating a live webpack compiler
  const [logs, setLogs] = useState<string[]>([
    "-- DevEngine Output Stream Initialized --",
    "[info] Pulling repository...",
    "[info] Repository pulled successfully.",
    "Installing dependencies via yarn...",
    "➤ YN0000: ┌ Resolution step",
    "➤ YN0000: ├ Completed in 1.2s",
    "➤ YN0000: ┌ Fetch step",
    "➤ YN0000: ├ Completed in 0.8s",
    "➤ YN0000: ┌ Link step",
    "➤ YN0000: └ Completed in 2.1s",
    "[success] Dependencies installed.",
    "[info] Executing linting checks...",
    "eslint . --ext .js,.jsx,.ts,.tsx",
    "[success] Linting passed.",
    "[info] Initiating build process...",
    "> NODE_ENV=production webpack --config webpack.prod.js",
    "Asset modules: 12.4 KiB",
    "Entrypoint main [big] = runtime.js main.css main.js",
    "   ↳ [0] ./src/index.js 3.5 KiB {main} [built]",
    "   ↳ [1] ./src/app.jsx 14.2 KiB {main} [built]",
    "   ↳ [2] ./src/styles.css 2.1 KiB {main} [built]",
    "[warn] Bundle size exceeds recommended limit (244 KiB).",
    "> Optimizing chunks and minifying assets (85%)...",
  ]);

  // Live timer tick
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Append new logs occasionally
  useEffect(() => {
    if (!isRunning) return;
    const logInterval = setInterval(() => {
      const additionalLogs = [
        "➤ [Webpack] Chunks optimization completed in 1.4s",
        "➤ [Webpack] Compiled bundle assets successfully stored.",
        "[success] Build finished in 18.2s.",
        "[info] Preparing serverless bundle...",
        "[info] Deploying lambda to aws-east-1...",
        "[success] Service successfully routing 100% of production queries!",
      ];
      
      setLogs((prev) => {
        if (prev.length >= 23 + additionalLogs.length) {
          setIsRunning(false); // complete compilation
          return prev;
        }
        const nextIndex = prev.length - 23;
        return [...prev, additionalLogs[nextIndex]];
      });
    }, 4000);
    
    return () => clearInterval(logInterval);
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
    setLogs([
      "-- DevEngine Output Stream Initialized --",
      "[info] Pulling repository...",
      "[info] Repository pulled successfully.",
      "Installing dependencies via yarn...",
      "➤ YN0000: ┌ Resolution step",
      "➤ YN0000: └ Completed in 1.2s",
      "[success] Dependencies installed.",
      "[info] Executing linting checks...",
      "[success] Linting passed.",
      "[info] Initiating build process...",
      "> Optimizing chunks and minifying assets (10%)...",
    ]);
    setTimerSeconds(0);
    setIsRunning(true);
  };

  return (
    <AppShell>
      <div className="p-6 md:p-12 max-w-5xl 3xl:max-w-[1500px] 4xl:max-w-[1900px] 5xl:max-w-[2300px] 6xl:max-w-[2900px] 4k:max-w-[3400px] w-full mx-auto space-y-8 animate-fade-in">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-primary-container/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <span className={`w-2 h-2 rounded-full bg-primary ${isRunning ? "animate-pulse" : ""}`} />
                {isRunning ? "In Progress" : "Completed"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">Pipeline #8492</span>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
              Production Deployment
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isRunning && (
              <Button
                onClick={() => setIsRunning(false)}
                variant="outline"
                size="sm"
                className="gap-2 h-9 border-border bg-card hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <XCircle className="h-4 w-4" /> Cancel Run
              </Button>
            )}
            <Button
              onClick={handleRestart}
              size="sm"
              className="gap-2 h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_4px_12px_rgba(0,104,95,0.2)]"
            >
              <RotateCw className="h-4 w-4" /> Restart
            </Button>
          </div>
        </header>

        {/* Overview Meta Card (Glassmorphism) */}
        <div className="glass border border-border/40 rounded-xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Commit</span>
            <div className="flex items-center gap-1.5 font-mono text-sm text-foreground">
              <GitCommit className="h-4 w-4 text-muted-foreground" />
              a1b2c3d
            </div>
          </div>
          <div className="flex flex-col border-l border-border/20 pl-6">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Branch</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
              <GitBranch className="h-4 w-4" />
              main
            </div>
          </div>
          <div className="flex flex-col border-l border-border/20 pl-6">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Triggered By</span>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJ5qAlpvGDLvytv4q2c2uvvWQNOCNAFBOzKztRwpMcFbL5miJi5lBambbJTXhAMxydQxCxYMvVN5UB9-vvEzA1b89F7dO6fziiqBYSJaaZ17C4iHG6QfVgwiLuyqjq_vPq3QAAtqQ-mFNI5EbNNG9RhMuRzXByWwupbRL543pgWC8l0ZGa_qEt4Vr2_8DetI04tJvcpw9pFpWrAj5zVKfMWllqud0amxc1Fs5pao_SMX81rntFTXkSDm00iRP0PwOlMPbDVbsotIU"
                alt="Sarah Jenkins"
                className="w-5 h-5 rounded-full border border-border"
              />
              <span className="font-medium">Sarah Jenkins</span>
            </div>
          </div>
          <div className="flex flex-col border-l border-border/20 pl-6">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Duration</span>
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatTimer(timerSeconds)} {isRunning ? "(Running)" : "(Finished)"}
            </div>
          </div>
        </div>

        {/* Pipeline Flow & Terminal (Bento Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Execution flowchart */}
          <div className="lg:col-span-5 border border-border/40 rounded-xl bg-card p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <h3 className="text-base font-bold text-foreground mb-6 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary-container/10 text-primary">
                <Activity className="h-4 w-4" />
              </span>
              Execution Flow
            </h3>

            <div className="relative pl-6 space-y-8">
              {/* Connecting line */}
              <div className="absolute left-[13px] top-3 bottom-5 w-0.5 bg-border/40 rounded-full" />
              
              {/* Stage 1: Success */}
              <div className="relative flex gap-4">
                <div className="absolute left-[-21px] z-10 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-foreground">Triggered (GitHub)</span>
                    <span className="text-[10px] text-muted-foreground font-mono">10:42:01 AM</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Webhook received from repository push.</p>
                </div>
              </div>

              {/* Stage 2: Success */}
              <div className="relative flex gap-4">
                <div className="absolute left-[-21px] z-10 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-foreground">Linting & Analysis</span>
                    <span className="text-[10px] text-muted-foreground font-mono">10:42:15 AM</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Passed 1,204 rules with 0 warnings.</p>
                </div>
              </div>

              {/* Stage 3: Running / Done */}
              <div className="relative flex gap-4">
                <div className="absolute left-[-21px] z-10 w-4 h-4 rounded-full bg-card border-2 border-primary flex items-center justify-center text-primary shadow">
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-primary fill-primary-foreground" />
                  )}
                </div>
                <div className={`flex-1 p-3 rounded-lg border transition-all ${
                  isRunning ? "bg-primary-container/10 border-primary/20" : "bg-card border-border/80"
                }`}>
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className={isRunning ? "text-primary" : "text-foreground"}>Building Artifacts</span>
                    <span className={`text-[10px] ${isRunning ? "text-primary" : "text-muted-foreground"} font-mono`}>
                      {isRunning ? "Running..." : "Success"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Compiling assets and building Docker container.</p>
                  
                  {isRunning && (
                    <div className="mt-3 bg-zinc-950 text-emerald-400 p-2.5 rounded font-mono text-[10px] select-none border border-zinc-800">
                      <div className="opacity-60 truncate">[Webpack] Emitting chunks...</div>
                      <div className="animate-pulse">&gt; Optimizing assets: 85%</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stage 4: Pending / Done */}
              <div className="relative flex gap-4">
                <div className={`absolute left-[-21px] z-10 w-4 h-4 rounded-full border-2 flex items-center justify-center shadow ${
                  isRunning ? "bg-card border-border/80 text-muted-foreground" : "bg-primary border-primary text-primary-foreground"
                }`}>
                  {!isRunning && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className={`flex-1 ${isRunning ? "opacity-50" : ""}`}>
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-foreground">Optimizing & Testing</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {isRunning ? "Pending" : "10:44:12 AM"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Running unit tests and bundle compression.</p>
                </div>
              </div>

              {/* Stage 5: Pending / Done */}
              <div className="relative flex gap-4">
                <div className={`absolute left-[-21px] z-10 w-4 h-4 rounded-full border-2 flex items-center justify-center shadow ${
                  isRunning ? "bg-card border-border/80 text-muted-foreground" : "bg-primary border-primary text-primary-foreground"
                }`}>
                  {!isRunning && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className={`flex-1 ${isRunning ? "opacity-50" : ""}`}>
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-foreground">Deployment</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {isRunning ? "Pending" : "10:44:28 AM"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Push bundle and load balancer routing.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Console Compiler Logs */}
          <div className="lg:col-span-7 border border-border/40 rounded-xl bg-zinc-950 shadow-2xl flex flex-col h-[520px] 3xl:h-[650px] 4xl:h-[850px] 5xl:h-[1100px] 6xl:h-[1300px] overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <TerminalIcon className="h-4 w-4 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-400 tracking-wider">LIVE CONSOLE</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogs(["-- DevEngine Output Stream Re-Initialized --"])}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  title="Clear Logs"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button className="text-zinc-500 hover:text-zinc-300 transition-colors p-1" title="Expand">
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Terminal Logs Window */}
            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs leading-relaxed text-zinc-300 select-text">
              {logs.map((log, index) => {
                let colorClass = "text-zinc-400";
                if (log.startsWith("[info]")) {
                  colorClass = "text-cyan-400";
                } else if (log.startsWith("[success]")) {
                  colorClass = "text-emerald-400 font-semibold";
                } else if (log.startsWith("[warn]")) {
                  colorClass = "text-amber-500 font-bold";
                } else if (log.startsWith("--")) {
                  colorClass = "text-zinc-500 italic";
                } else if (log.startsWith(">")) {
                  colorClass = "text-zinc-100 font-bold";
                }
                
                return (
                  <div key={index} className={`mb-1 ${colorClass}`}>
                    {log}
                  </div>
                );
              })}
              
              {/* Blinking cursor */}
              {isRunning && (
                <span className="inline-block w-2.5 h-4 bg-primary ml-1 animate-[pulse_1s_infinite]" />
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
