import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Terminal,
  X,
  Wifi,
  WifiOff,
  ChevronDown,
  Trash2,
  Link2,
  Link2Off,
} from "lucide-react";
import { AgentConsentDialog, hasAgentConsent } from "./AgentConsentDialog";
import { AgentConnection, type AgentStatus } from "@/lib/terminal/agent-connection";
import { TerminalHistory } from "@/lib/terminal/history";
import { routeCommand } from "@/lib/terminal/router";
import { getSuggestions } from "@/lib/terminal/autocomplete";
import type { AutocompleteSuggestion } from "@/lib/terminal/autocomplete";
import type { TerminalLine } from "@/lib/terminal/registry";

// ─────────────────────────────────────────────────────────────────────────────
// ANSI color map
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  default: "\x1b[0m",
};

function writeLines(term: XTerm, lines: TerminalLine[]) {
  for (const line of lines) {
    const ansi = line.color && line.color !== "default" ? COLOR_MAP[line.color] ?? "" : "";
    const reset = ansi ? "\x1b[0m" : "";
    term.writeln(ansi + line.text + reset);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// xterm theme from CSS custom properties
// ─────────────────────────────────────────────────────────────────────────────

function buildXtermTheme() {
  return {
    background: "#0c0f17", // Sleek dark slate
    foreground: "#e2e8f8",
    cursor: "#6bd8cb",
    cursorAccent: "#0c0f17",
    selectionBackground: "rgba(107,216,203,0.3)",
    black: "#000000",
    red: "#ffb4ab",
    green: "#89f5e7",
    yellow: "#ffdbce",
    blue: "#c0c1ff",
    magenta: "#c678dd",
    cyan: "#6bd8cb",
    white: "#e2e8f8",
    brightBlack: "#3d4947",
    brightRed: "#ff897d",
    brightGreen: "#6bd8cb",
    brightYellow: "#ffb68b",
    brightBlue: "#c0c1ff",
    brightMagenta: "#c678dd",
    brightCyan: "#89f5e7",
    brightWhite: "#ffffff",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalPanelProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TerminalPanel({ open, onClose, userId }: TerminalPanelProps) {
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Agent
  const agentRef = useRef<AgentConnection | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("disconnected");
  const [agentStatusDetail, setAgentStatusDetail] = useState<string>("");

  // Mode
  const [mode, setMode] = useState<"app" | "shell">("app");
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Dialogs
  const [showConsent, setShowConsent] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [connectHost, setConnectHost] = useState("127.0.0.1");
  const [connectPort, setConnectPort] = useState("3000");
  const [connectToken, setConnectToken] = useState("");

  // Input
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);

  // History
  const historyRef = useRef<TerminalHistory | null>(null);

  // Theme
  const isDark = document.documentElement.classList.contains("dark");

  // Delay terminal initialization until it is actually opened for the first time
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  useEffect(() => {
    if (open) {
      setHasOpenedOnce(true);
    }
  }, [open]);

  // ── Init xterm ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasOpenedOnce || !containerRef.current) return;

    const term = new XTerm({
      theme: buildXtermTheme(),
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 2000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    
    if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
      try {
        fitAddon.fit();
      } catch (err) {
        console.warn("Failed to fit terminal on mount:", err);
      }
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      if (modeRef.current === "shell" && agentRef.current?.isConnected) {
        agentRef.current.send(data);
      }
    });

    // Welcome banner
    term.writeln("\x1b[36mDevPilot Terminal\x1b[0m  — type \x1b[33mhelp\x1b[0m to list app commands");
    term.writeln("\x1b[90m─────────────────────────────────────────────────────\x1b[0m");

    // Resize observer
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch {}
    });
    ro.observe(containerRef.current!);

    return () => {
      ro.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [hasOpenedOnce]); // initialize once when opened

  // ── Theme updates ────────────────────────────────────────────────────────
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = buildXtermTheme();
    }
  }, [isDark]);

  // ── Focus input when panel opens ─────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch (err) {
          console.warn("Failed to fit terminal on open:", err);
        }
      }, 100);
    }
  }, [open]);

  // ── Custom event listener to trigger connect flow ───────────────────────
  useEffect(() => {
    const handleOpenConnect = () => {
      initiateAgentConnect();
    };
    window.addEventListener("open-terminal-connect", handleOpenConnect);
    return () => window.removeEventListener("open-terminal-connect", handleOpenConnect);
  }, [agentStatus]);

  // ── History init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (userId) {
      historyRef.current = new TerminalHistory(userId);
    }
  }, [userId]);

  // ── Agent cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      agentRef.current?.disconnect();
    };
  }, []);

  // ── Autocomplete ─────────────────────────────────────────────────────────
  const updateSuggestions = useCallback(
    (val: string) => {
      if (!val.trim()) {
        setSuggestions([]);
        setSuggestionIdx(-1);
        return;
      }
      const results = getSuggestions(val, agentStatus === "connected");
      setSuggestions(results);
      setSuggestionIdx(-1);
    },
    [agentStatus]
  );

  // ── Submit command ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const line = inputValue.trim();
    setInputValue("");
    setSuggestions([]);
    setSuggestionIdx(-1);
    historyRef.current?.push(line);
    historyRef.current?.resetCursor();

    if (!line) return;

    const term = xtermRef.current;
    if (!term) return;

    // In shell mode, send directly to agent
    if (mode === "shell" && agentRef.current?.isConnected) {
      agentRef.current.send(line + "\r");
      return;
    }

    // App command routing
    const generator = routeCommand(line, agentRef.current);
    for await (const tline of generator) {
      if (tline.text === "__CLEAR__") {
        term.clear();
        continue;
      }
      const ansi = tline.color && tline.color !== "default" ? COLOR_MAP[tline.color] ?? "" : "";
      const reset = ansi ? "\x1b[0m" : "";
      term.writeln(ansi + tline.text + reset);
    }
  }, [inputValue, mode]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (suggestions.length > 0) {
          const idx = suggestionIdx < 0 ? 0 : (suggestionIdx + 1) % suggestions.length;
          setSuggestionIdx(idx);
          setInputValue(suggestions[idx].value);
          updateSuggestions(suggestions[idx].value);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const entry = historyRef.current?.up(inputValue);
        if (entry !== undefined) setInputValue(entry);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const entry = historyRef.current?.down() ?? "";
        setInputValue(entry);
        return;
      }

      if (e.key === "Escape") {
        setSuggestions([]);
        setSuggestionIdx(-1);
        return;
      }

      // Reset cursor on any other key
      historyRef.current?.resetCursor();
    },
    [handleSubmit, suggestions, suggestionIdx, inputValue, updateSuggestions]
  );

  // ── Agent connect flow ────────────────────────────────────────────────────
  const initiateAgentConnect = () => {
    if (!hasAgentConsent()) {
      setShowConsent(true);
    } else {
      setShowConnectDialog(true);
    }
  };

  const handleConsentGranted = () => {
    setShowConsent(false);
    setShowConnectDialog(true);
  };

  const handleConnect = () => {
    setShowConnectDialog(false);

    // Disconnect existing connection
    agentRef.current?.disconnect();

    const conn = new AgentConnection({
      host: connectHost,
      port: parseInt(connectPort, 10),
      token: connectToken,
      onData: (data) => {
        xtermRef.current?.write(data);
      },
      onExit: (exitCode) => {
        xtermRef.current?.writeln(
          `\r\n\x1b[33m[Shell exited with code ${exitCode}]\x1b[0m`
        );
        setAgentStatus("disconnected");
        setMode("app");
      },
      onStatusChange: (status, detail) => {
        setAgentStatus(status);
        setAgentStatusDetail(detail ?? "");

        const term = xtermRef.current;
        if (!term) return;
        if (status === "connected") {
          term.writeln(
            "\x1b[32m[Local shell connected — you can now run shell commands]\x1b[0m"
          );
          setMode("shell");
          setTimeout(() => term.focus(), 50);
        } else if (status === "error") {
          term.writeln(`\x1b[31m[Agent error: ${detail}]\x1b[0m`);
          setMode("app");
        } else if (status === "connecting" && detail) {
          term.writeln(`\x1b[33m[${detail}]\x1b[0m`);
        }
      },
    });

    agentRef.current = conn;
    conn.connect();
    setConnectToken("");
  };

  const handleDisconnect = () => {
    agentRef.current?.disconnect();
    agentRef.current = null;
    setAgentStatus("disconnected");
    setAgentStatusDetail("");
    setMode("app");
    xtermRef.current?.writeln("\x1b[33m[Local shell disconnected]\x1b[0m");
  };

  // ── Status badge ──────────────────────────────────────────────────────────
  const statusColor: Record<AgentStatus, string> = {
    disconnected: "text-muted-foreground",
    connecting: "text-yellow-500",
    connected: "text-green-500",
    error: "text-red-500",
  };

  // ── Panel slide animation class ───────────────────────────────────────────
  const panelClass = open
    ? "translate-y-0 opacity-100 pointer-events-auto"
    : "translate-y-full opacity-0 pointer-events-none";

  return (
    <>
      {/* ── Slide-up terminal panel ───────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-[#0f121a] border-t border-border/60 shadow-2xl transition-all duration-300 ease-in-out ${panelClass}`}
        style={{ height: "42vh", minHeight: "260px", maxHeight: "70vh" }}
        aria-hidden={!open}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-[#0d1018] shrink-0">
          <div className="flex items-center gap-3">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
              Terminal
            </span>

            {/* Mode tabs */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setMode("app")}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                  mode === "app"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                App Commands
              </button>
              <button
                onClick={() => {
                  if (agentStatus === "connected") {
                    setMode("shell");
                    setTimeout(() => xtermRef.current?.focus(), 50);
                  }
                }}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                  mode === "shell"
                    ? "bg-primary/20 text-primary"
                    : agentStatus === "connected"
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                Local Shell
              </button>
            </div>

            {/* Agent status */}
            <div className={`flex items-center gap-1.5 ml-2 text-[11px] ${statusColor[agentStatus]}`}>
              {agentStatus === "connected" ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">
                {agentStatus === "connected"
                  ? "Agent connected"
                  : agentStatus === "connecting"
                  ? "Connecting…"
                  : agentStatus === "error"
                  ? "Agent error"
                  : "No local shell"}
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {agentStatus === "connected" ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                onClick={handleDisconnect}
              >
                <Link2Off className="h-3 w-3" />
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                onClick={initiateAgentConnect}
              >
                <Link2 className="h-3 w-3" />
                Connect Local Shell
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                xtermRef.current?.clear();
              }}
              title="Clear terminal"
            >
              <Trash2 className="h-3 w-3" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close terminal (backtick)"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* xterm output viewport */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-hidden px-2 py-1 cursor-text bg-[#0c0f17]"
          onClick={() => {
            if (mode === "shell") {
              xtermRef.current?.focus();
            }
          }}
        />

        {/* Input row + autocomplete */}
        {mode === "app" ? (
          <div className="relative shrink-0 border-t border-border/20 bg-[#0d1018]">
            {/* Autocomplete suggestions */}
            {suggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 bg-[#12151e] border border-border/40 rounded-t-md overflow-hidden shadow-lg">
                {suggestions.slice(0, 6).map((s, i) => (
                  <button
                    key={s.value}
                    className={`w-full text-left px-4 py-1.5 text-xs flex items-center gap-3 transition-colors ${
                      i === suggestionIdx
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setInputValue(s.value);
                      setSuggestions([]);
                      setSuggestionIdx(-1);
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="font-mono font-semibold text-foreground">{s.label}</span>
                    {s.description && (
                      <span className="text-[11px] text-muted-foreground/70">{s.description}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Command input */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-primary font-mono text-xs select-none shrink-0">
                {"> "}
              </span>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  historyRef.current?.resetCursor();
                  updateSuggestions(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-foreground font-mono text-xs outline-none placeholder:text-muted-foreground/40 caret-primary"
                placeholder="App command — type 'help' for list, Tab to complete"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-border/20 bg-[#0d1018] px-4 py-2 text-[11px] text-zinc-500 font-mono flex items-center justify-between select-none">
            <span className="flex items-center gap-1.5 text-green-500/80">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Interactive Local Shell Active — Type directly in the terminal viewport above.
            </span>
            <span className="text-zinc-600">Press backtick (`) to close panel</span>
          </div>
        )}
      </div>

      {/* ── Consent dialog ────────────────────────────────────────────────── */}
      <AgentConsentDialog
        open={showConsent}
        onConsent={handleConsentGranted}
        onCancel={() => setShowConsent(false)}
      />

      {/* ── Connect dialog ────────────────────────────────────────────────── */}
      <Dialog open={showConnectDialog} onOpenChange={(o) => !o && setShowConnectDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wifi className="h-4 w-4 text-primary" />
              Connect Local Shell Agent
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground text-xs">
              Start the agent on your machine:
              <code className="block mt-1 bg-muted rounded px-2 py-1 font-mono text-[11px] text-foreground">
                cd backend && npm start
              </code>
            </p>
            <p className="text-muted-foreground text-xs">
              Then paste the token printed in the agent console.
            </p>

            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Host</Label>
                  <Input
                    value={connectHost}
                    onChange={(e) => setConnectHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input
                    value={connectPort}
                    onChange={(e) => setConnectPort(e.target.value)}
                    placeholder="3000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Agent Token</Label>
                <Input
                  value={connectToken}
                  onChange={(e) => setConnectToken(e.target.value)}
                  type="password"
                  placeholder="Paste token from agent console…"
                  className="h-8 text-xs font-mono"
                  onKeyDown={(e) => e.key === "Enter" && connectToken && handleConnect()}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowConnectDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConnect} disabled={!connectToken}>
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
