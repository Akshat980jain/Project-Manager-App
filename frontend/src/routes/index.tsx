import { Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@/hooks/use-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getProjectDisplayName } from "@/lib/utils";
import { scanProjects, excludeProject, deleteProjectFolder } from "@/lib/api/explorer.functions";
import { 
  getProcessStatuses, 
  getSystemStats, 
  getSystemProcesses, 
  getSystemPorts, 
  getSystemDiskUsage, 
  stopDevServer 
} from "@/lib/api/processes";
import {
  Rocket,
  MessageSquare,
  Triangle,
  Zap,
  ShieldAlert,
  Globe,
  Wind,
  Database,
  FolderOpen,
  MoreVertical,
  Trash2,
  EyeOff,
  AlertTriangle,
  X,
  RefreshCw,
} from "lucide-react";

// Mapping discovered project directories to custom icons/logos
function getProjectLogoSpec(name: string, dirName: string, idx: number) {
  // Check for copied actual logos in public folder
  const lowerName = name.toLowerCase();
  const lowerDir = dirName.toLowerCase();
  if (lowerName.includes("ems") || lowerDir.includes("ems")) {
    return { isImage: true, path: "/logos/staffsphere_logo.png" };
  }
  if (lowerName.includes("booking") || lowerDir.includes("booking")) {
    return { isImage: true, path: "/logos/bookease_logo.png" };
  }
  if (lowerName === "ytblog" || lowerDir === "ytblog") {
    return { isImage: true, path: "/logos/scribe_logo.jpg" };
  }
  if (lowerName.includes("quickkart") || lowerDir.includes("quickkart")) {
    return { isImage: true, path: "/logos/quickkart_logo.png" };
  }
  if (lowerName.includes("lovable chat") || lowerDir.includes("lovable-chat")) {
    return { isImage: true, path: "/logos/loop_logo.png" };
  }
  if (lowerName.includes("android erp") || lowerName.includes("educonnect") || lowerDir.includes("android-erp")) {
    return { isImage: true, path: "/logos/android_erp_logo.png" };
  }
  if (lowerName.includes("upload app") || lowerDir.includes("upload-app")) {
    return { isImage: true, path: "/logos/upload_app_logo.png" };
  }
  if (lowerName.includes("qscan") || lowerDir.includes("qscan") || lowerName.includes("qrvault") || lowerDir.includes("qrvault")) {
    return { isImage: true, path: "/logos/qscan_logo.png" };
  }
  if (lowerName.includes("pulse") || lowerDir.includes("pulse")) {
    return { isImage: true, path: "/logos/pulse_logo.png" };
  }

  // Fallback to high-quality curated framework icons
  const icons = [Rocket, MessageSquare, Triangle, Zap, ShieldAlert, Globe, Wind, Database];
  const IconComponent = icons[idx % icons.length];
  
  const bgColors = [
    "bg-violet-100 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400",
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400",
    "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400",
    "bg-orange-100 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400",
    "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/20 dark:text-cyan-400",
    "bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400",
  ];
  const iconBg = bgColors[idx % bgColors.length];

  return { isImage: false, icon: IconComponent, iconBg };
}

// Sparkline SVG helper
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="text-muted-foreground text-[10px] py-2">Gathering telemetry...</div>;
  const max = 100;
  const min = 0;
  const range = max - min;
  const width = 160;
  const height = 40;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / (range || 1)) * height;
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

// Helper to format file sizes
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function DynamicGridDashboard() {
  const [activeProjectMenu, setActiveProjectMenu] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"projects" | "system">("projects");
  const [includeNodeModules, setIncludeNodeModules] = useState(false);
  const [statsHistory, setStatsHistory] = useState<{ cpu: number[]; ram: number[] }>({ cpu: [], ram: [] });
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (projectDir: string) => deleteProjectFolder({ data: { projectDir } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scanned-projects"] });
      toast.success("Project removed successfully");
      setActiveProjectMenu(null);
    },
    onError: (err: any) => {
      toast.error(`Failed to remove project: ${err.message}`);
    },
  });

  const killProcessMutation = useMutation({
    mutationFn: (projectDir: string) => stopDevServer({ data: { projectDir } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["system-processes"] });
      queryClient.invalidateQueries({ queryKey: ["system-ports"] });
      toast.success("Process killed successfully");
    },
    onError: (err: any) => {
      toast.error(`Failed to kill process: ${err.message}`);
    }
  });
  
  // Close popover when clicking elsewhere
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Do not close popover if clicking inside buttons or the project menu overlay
      if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".project-menu-overlay")) {
        return;
      }
      setActiveProjectMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["scanned-projects"],
    queryFn: () => scanProjects(),
  });

  // Query server process statuses (polling every 4 seconds)
  const { data: processStatuses } = useQuery({
    queryKey: ["process-statuses"],
    queryFn: () => getProcessStatuses(),
    refetchInterval: 4000,
  });

  // Query system stats (polling every 5 seconds)
  const { data: systemStats } = useQuery({
    queryKey: ["system-stats"],
    queryFn: () => getSystemStats(),
    refetchInterval: 5000,
    enabled: activeTab === "system",
  });

  // Update statistics load history
  useEffect(() => {
    if (systemStats) {
      setStatsHistory(prev => {
        const nextCpu = [...prev.cpu, systemStats.cpu].slice(-15);
        const ramPct = systemStats.ram.total > 0 ? (systemStats.ram.used / systemStats.ram.total) * 100 : 0;
        const nextRam = [...prev.ram, ramPct].slice(-15);
        return { cpu: nextCpu, ram: nextRam };
      });
    }
  }, [systemStats]);

  // Query running process statistics
  const { data: runningProcesses } = useQuery({
    queryKey: ["system-processes"],
    queryFn: () => getSystemProcesses(),
    refetchInterval: 4000,
  });

  // Query active port allocations
  const { data: systemPorts } = useQuery({
    queryKey: ["system-ports"],
    queryFn: () => getSystemPorts(),
    refetchInterval: 5000,
    enabled: activeTab === "system",
  });

  // Query project folder disk size allocation
  const { data: diskUsage, isLoading: isLoadingDisk } = useQuery({
    queryKey: ["system-disk-usage", includeNodeModules],
    queryFn: () => getSystemDiskUsage(includeNodeModules),
    enabled: activeTab === "system",
  });
  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto space-y-10 animate-fade-in">
        {/* Page Sub-Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Dynamic <span className="text-primary font-black">Grid</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Centralized developer dashboard for registered projects.
            </p>
          </div>
          
          {/* Tabs Control */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                activeTab === "projects"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/60"
              }`}
            >
              Registered Projects
            </button>
            <button
              onClick={() => setActiveTab("system")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                activeTab === "system"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/60"
              }`}
            >
              System Monitor
            </button>
          </div>
        </div>

        {/* 4-Column Card Grid (Projects Tab) */}
        {activeTab === "projects" && (
          isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-7 6xl:grid-cols-8 4k:grid-cols-10 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 rounded-xl border border-border/60 bg-card animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-7 6xl:grid-cols-8 4k:grid-cols-10 gap-6">
              {(projects ?? []).map((project: any, idx: number) => {
                const logo = getProjectLogoSpec(project.name, project.dirName, idx);
                const displayName = getProjectDisplayName(project.id, project.name);

                return (
                  <div
                    key={project.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a")) {
                        return;
                      }
                      navigate(`/projects/${project.id}`);
                    }}
                    className="group relative flex flex-col items-center justify-center gap-3 py-6 rounded-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden border border-transparent hover:border-border/40"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Live Process Status & CPU/RAM badge */}
                    {processStatuses?.[project.dirName]?.status === "running" && (
                      <>
                        <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full text-[8px] font-bold text-emerald-400 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          RUNNING
                        </div>
                        {(() => {
                          const proc = (runningProcesses ?? []).find(p => p.projectSlug === project.dirName);
                          if (proc) {
                            return (
                              <div className="absolute top-9 left-3 z-30 flex items-center gap-1 bg-primary/15 border border-primary/20 px-2 py-0.5 rounded-full text-[8px] font-bold text-primary font-mono backdrop-blur-md">
                                {proc.cpu.toFixed(1)}% CPU | {Math.round(proc.memory / 1024 / 1024)}MB
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                    {processStatuses?.[project.dirName]?.status === "starting" && (
                      <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full text-[8px] font-bold text-amber-400 font-mono">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        STARTING
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveProjectMenu(activeProjectMenu === project.dirName ? null : project.dirName);
                      }}
                      className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-30"
                      title="Manage Project"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {logo.isImage ? (
                      <img
                        src={logo.path}
                        alt={displayName}
                        className="w-28 h-28 rounded-2xl object-cover shadow-lg group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className={`w-28 h-28 rounded-2xl flex items-center justify-center ${logo.iconBg} shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                        {logo.icon && <logo.icon className="h-12 w-12" />}
                      </div>
                    )}

                    <p className="text-sm font-bold text-foreground text-center tracking-tight leading-tight px-3 group-hover:text-primary transition-colors mt-2">
                      {displayName}
                    </p>

                    {activeProjectMenu === project.dirName && (
                      <div 
                        className="project-menu-overlay absolute inset-0 bg-card/95 backdrop-blur-md z-40 flex flex-col items-center justify-center p-4 gap-3 rounded-xl border border-primary/20 animate-in fade-in duration-200 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveProjectMenu(null);
                          }}
                          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-50 border border-transparent hover:border-border/30"
                          title="Close"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>

                        <div className="text-center mb-1">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Manage Project</span>
                          <h4 className="text-xs font-bold text-foreground truncate max-w-[150px]">{displayName}</h4>
                        </div>

                        <div className="flex flex-col w-full gap-2 px-3">
                          <Link
                            to={`/projects/${project.id}`}
                            onClick={() => setActiveProjectMenu(null)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] font-medium"
                          >
                            View Details
                          </Link>
                          
                          <Link
                            to={`/admin/projects/${project.id}`}
                            onClick={() => setActiveProjectMenu(null)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] font-semibold"
                          >
                            Admin Panel
                          </Link>

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setProjectToDelete({ id: project.id, name: project.name });
                            }}
                            disabled={deleteMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-all hover:scale-[1.02] active:scale-[0.98] font-semibold cursor-pointer"
                          >
                            {deleteMutation.isPending ? "Removing..." : "Remove Project"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(projects ?? []).length === 0 && (
                <div className="col-span-full border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/60" />
                  <div>
                    <h3 className="font-bold text-base text-foreground">No projects registered</h3>
                    <p className="text-xs text-muted-foreground mt-1">Register a new project in the admin panel to get started.</p>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* System Monitor Tab */}
        {activeTab === "system" && (
          <div className="space-y-8 animate-fade-in">
            {/* Overall Resource Sparkline Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CPU load */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 flex flex-col justify-between h-40 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.01] to-transparent pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">System Load</span>
                    <h3 className="text-2xl font-black text-foreground mt-1">CPU Load</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-primary font-mono">
                      {systemStats ? systemStats.cpu.toFixed(1) : "—"}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-end mt-4">
                  <div className="text-xs text-muted-foreground">Rolling 75s telemetry</div>
                  <Sparkline data={statsHistory.cpu} color="#00685f" />
                </div>
              </div>

              {/* RAM Allocation */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 flex flex-col justify-between h-40 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.01] to-transparent pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Memory Allocation</span>
                    <h3 className="text-2xl font-black text-foreground mt-1">System RAM</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-primary font-mono">
                      {systemStats ? ((systemStats.ram.used / systemStats.ram.total) * 100).toFixed(1) : "—"}%
                    </span>
                    <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                      {systemStats ? `${(systemStats.ram.used / 1024 / 1024 / 1024).toFixed(1)} GB / ${(systemStats.ram.total / 1024 / 1024 / 1024).toFixed(1)} GB` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-end mt-4">
                  <div className="text-xs text-muted-foreground">Active RAM allocation</div>
                  <Sparkline data={statsHistory.ram} color="#b05e3d" />
                </div>
              </div>

              {/* Disk usage */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 flex flex-col justify-between h-40 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.01] to-transparent pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Storage Partition</span>
                    <h3 className="text-2xl font-black text-foreground mt-1">
                      Disk ({systemStats?.disk?.mount || "E:"})
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-primary font-mono">
                      {systemStats?.disk ? ((systemStats.disk.used / systemStats.disk.total) * 100).toFixed(1) : "—"}%
                    </span>
                    <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                      {systemStats?.disk ? `${(systemStats.disk.used / 1024 / 1024 / 1024).toFixed(1)} GB / ${(systemStats.disk.total / 1024 / 1024 / 1024).toFixed(1)} GB` : ""}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden mt-4">
                  <div 
                    className="bg-primary h-full transition-all duration-500" 
                    style={{ width: `${systemStats?.disk ? (systemStats.disk.used / systemStats.disk.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Ports map and recursive disk size list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Port Mapping table */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-black text-foreground">Port Mapping</h3>
                  <p className="text-xs text-muted-foreground">TCP ports dynamically bound by console-managed processes</p>
                </div>
                
                <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/20">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/40 font-bold text-muted-foreground">
                        <th className="p-3">Port</th>
                        <th className="p-3">Project Directory</th>
                        <th className="p-3">PID</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(systemPorts ?? []).map((p) => (
                        <tr key={p.port} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                          <td className="p-3 font-mono font-bold text-primary">{p.port}</td>
                          <td className="p-3 font-medium">{p.projectSlug}</td>
                          <td className="p-3 font-mono text-muted-foreground">{p.pid || "—"}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              p.status === "active" 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}>
                              {p.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => killProcessMutation.mutate(p.projectSlug)}
                              disabled={killProcessMutation.isPending}
                              className="px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            >
                              Kill
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(systemPorts ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            No active port maps detected from spawned dev servers.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Disk Allocations list */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-foreground">Disk Allocation</h3>
                    <p className="text-xs text-muted-foreground">Recursive size of workspace directories on disk</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="nm-toggle"
                      type="checkbox"
                      checked={includeNodeModules}
                      onChange={(e) => setIncludeNodeModules(e.target.checked)}
                      className="rounded border-border bg-card text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <label className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer" htmlFor="nm-toggle">
                      Include node_modules
                    </label>
                  </div>
                </div>

                <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/20">
                  {isLoadingDisk ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs font-medium">Scanning folders in E:\ (this may take a moment)...</span>
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/40 font-bold text-muted-foreground">
                          <th className="p-3">Workspace Folder</th>
                          <th className="p-3 text-right">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(diskUsage ?? []).map((item) => (
                          <tr key={item.dirName} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                            <td className="p-3 font-medium flex items-center gap-2">
                              <FolderOpen className="h-3.5 w-3.5 text-primary/70" />
                              {item.dirName}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-foreground">
                              {formatBytes(item.sizeBytes)}
                            </td>
                          </tr>
                        ))}
                        {(diskUsage ?? []).length === 0 && (
                          <tr>
                            <td colSpan={2} className="p-6 text-center text-muted-foreground">
                              No workspace directories found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent className="bg-card border-border/80 text-foreground backdrop-blur-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirm Project Removal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground mt-2">
              Are you sure you want to remove <span className="font-bold text-foreground">{projectToDelete?.name}</span>? This action cannot be undone and will permanently delete the project record from the DevEngine Console database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="bg-muted hover:bg-muted/80 text-foreground border border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (projectToDelete) {
                  deleteMutation.mutate(projectToDelete.id);
                  setProjectToDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              Remove Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

export default DynamicGridDashboard;
