import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { scanProjects, excludeProject, deleteProjectFolder } from "@/lib/api/explorer.functions";
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
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DevEngine — Fleet Console" },
      { name: "description", content: "Manage your local repository workspace and active codebase microservices." },
    ],
  }),
  component: DynamicGridDashboard,
});

// Mapping discovered project directories to custom icons/logos
function getProjectLogoSpec(dirName: string, idx: number) {
  // Check for copied actual logos in public folder
  if (dirName === "EMS") {
    return { isImage: true, path: "/logos/staffsphere_logo.png" };
  }
  if (dirName === "Booking Management App") {
    return { isImage: true, path: "/logos/bookease_logo.png" };
  }
  if (dirName === "YTBlog") {
    return { isImage: true, path: "/logos/scribe_logo.jpg" };
  }
  if (dirName === "QuickKart App Bolt") {
    return { isImage: true, path: "/logos/quickkart_logo.png" };
  }
  if (dirName === "Lovable Chat App") {
    return { isImage: true, path: "/logos/loop_logo.png" };
  }
  if (dirName === "Android ERP") {
    return { isImage: true, path: "/logos/android_erp_logo.png" };
  }
  if (dirName === "Upload App") {
    return { isImage: true, path: "/logos/upload_app_logo.png" };
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

// Override display names for projects whose folder names differ from their brand names
function getDisplayName(dirName: string): string {
  const overrides: Record<string, string> = {
    "EMS": "StaffSphere",
    "Booking Management App": "BookEase 24x7",
    "Lovable Chat App": "Loop Chat",
    "YTBlog": "Scribe",
  };
  return overrides[dirName] ?? dirName;
}

function DynamicGridDashboard() {
  const queryClient = useQueryClient();
  const [activeProjectMenu, setActiveProjectMenu] = useState<string | null>(null);
  
  // Deletion/Exclusion states
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  
  // Close popover when clicking elsewhere
  useEffect(() => {
    const handleGlobalClick = () => setActiveProjectMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["scanned-projects"],
    queryFn: () => scanProjects(),
  });

  const excludeMutation = useMutation({
    mutationFn: (projectDir: string) => excludeProject({ data: { projectDir } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scanned-projects"] });
      toast.success("Project hidden from console dashboard");
    },
    onError: (err: any) => {
      toast.error(`Exclusion failed: ${err.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (projectDir: string) => deleteProjectFolder({ data: { projectDir } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scanned-projects"] });
      setProjectToDelete(null);
      setDeleteConfirmInput("");
      toast.success("Project folder permanently removed from disk");
    },
    onError: (err: any) => {
      toast.error(`Deletion failed: ${err.message}`);
    }
  });

  const handleExclude = (dirName: string) => {
    excludeMutation.mutate(dirName);
  };

  const handleDeleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToDelete) return;
    
    if (deleteConfirmInput !== projectToDelete) {
      toast.error("Confirmation input does not match project name.");
      return;
    }

    deleteMutation.mutate(projectToDelete);
  };

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto space-y-10 animate-fade-in">
        {/* Page Sub-Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Dynamic <span className="text-primary font-black">Grid</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Active workspace explorer for repositories on your E:\ drive.
          </p>
        </div>

        {/* 4-Column Card Grid */}
        {isLoading ? (
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
            {(projects ?? []).map((project, idx) => {
              const logo = getProjectLogoSpec(project.dirName, idx);

              return (
                <Link
                  key={project.id}
                  to="/projects/$slug"
                  params={{ slug: project.dirName }}
                  className="group relative flex flex-col items-center justify-center gap-3 py-5 rounded-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  {/* Hover gradient wash */}
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* ⋮ management button — top-right, hover only */}
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

                  {/* Large centered logo */}
                  {logo.isImage ? (
                    <img
                      src={logo.path}
                      alt={getDisplayName(project.dirName)}
                      className="w-28 h-28 rounded-2xl object-cover shadow-lg group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className={`w-28 h-28 rounded-2xl flex items-center justify-center ${logo.iconBg} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {logo.icon && <logo.icon className="h-12 w-12" />}
                    </div>
                  )}

                  {/* App name */}
                  <p className="text-sm font-bold text-foreground text-center tracking-tight leading-tight px-3 group-hover:text-primary transition-colors">
                    {getDisplayName(project.dirName)}
                  </p>

                  {/* Full-Card Cover Action Overlay (covers entire card) */}
                  {activeProjectMenu === project.dirName && (
                    <div 
                      className="absolute inset-0 bg-card/95 backdrop-blur-md z-40 flex flex-col items-center justify-center p-4 gap-3 rounded-xl border border-primary/20 animate-in fade-in duration-200 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Close button on cover */}
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
                        <h4 className="text-xs font-bold text-foreground truncate max-w-[150px]">{project.dirName}</h4>
                      </div>

                      <div className="flex flex-col w-full gap-2 px-3">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveProjectMenu(null);
                            handleExclude(project.dirName);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] font-medium"
                        >
                          <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                          Hide Project
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveProjectMenu(null);
                            setProjectToDelete(project.dirName);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] font-semibold"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete from Disk
                        </button>
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}

            {/* Empty state if E:\ drive root is unreachable or has no folders */}
            {(projects ?? []).length === 0 && (
              <div className="col-span-full border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <FolderOpen className="h-10 w-10 text-muted-foreground/60" />
                <div>
                  <h3 className="font-bold text-base text-foreground">No local projects detected</h3>
                  <p className="text-xs text-muted-foreground mt-1">Make sure your E:\ drive has workspace repositories initialized.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Permanent Deletion Confirmation Modal */}
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md border border-border/80 rounded-2xl bg-card/95 backdrop-blur shadow-2xl p-6 space-y-6">
              {/* Close Button */}
              <button
                onClick={() => {
                  setProjectToDelete(null);
                  setDeleteConfirmInput("");
                }}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
                  <AlertTriangle className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">Permanent Deletion</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This action is destructive and irreversible!</p>
                </div>
              </div>

              {/* Warn text */}
              <div className="text-xs text-muted-foreground space-y-2 border-l-2 border-red-500/40 pl-3">
                <p>
                  You are about to delete the project folder <span className="font-mono font-bold text-red-400">E:\{projectToDelete}</span> recursively from your local hard drive.
                </p>
                <p>
                  All source code, git records, and compiled build outputs within this directory will be lost forever.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleDeleteSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="confirm-input" className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Type <span className="font-mono text-foreground font-semibold selection:bg-red-500/30">{projectToDelete}</span> to confirm:
                  </label>
                  <input
                    id="confirm-input"
                    type="text"
                    required
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="Enter project folder name"
                    autoComplete="off"
                    className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-red-500/60 font-mono transition-colors"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectToDelete(null);
                      setDeleteConfirmInput("");
                    }}
                    className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted active:scale-95 transition-all text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteConfirmInput !== projectToDelete || deleteMutation.isPending}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-[0_4px_12px_rgba(239,68,68,0.2)] text-center animate-in fade-in"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
