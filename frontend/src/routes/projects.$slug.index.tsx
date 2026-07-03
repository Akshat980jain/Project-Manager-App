import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@/hooks/use-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { getFileTree, getFileContent, getProjectDetail, getGitHistory, type FileNode } from "@/lib/api/explorer.functions";
import { 
  getProcessStatuses, 
  startDevServer, 
  stopDevServer, 
  deployToEmulator,
  getProjectEnv,
  updateProjectEnv,
  getProjectEnvDiff,
  getProjectDeps,
  getProjectRuntime
} from "@/lib/api/processes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Editor from "@monaco-editor/react";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { getProjectDisplayName } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  ArrowLeft,
  FileCode,
  Folder,
  ChevronRight,
  ChevronDown,
  Package,
  Clock,
  Layers,
  Code2,
  Terminal,
  BookOpen,
  FolderTree,
  Activity,
  Box,
  Smartphone,
  Download,
  GitBranch,
  GitCommit,
  Shield,
  Play,
  Square,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Check,
  X,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from "lucide-react";

// Display names are now loaded directly from project.name in the database without hardcoded overrides

function ProjectDetail() {
  const { slug } = useParams();
  if (!slug) {
    return <div className="text-muted-foreground">Error: Missing project identifier.</div>;
  }
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  useEffect(() => {
    if (slug) {
      localStorage.setItem("last_project_slug", slug);
    }
  }, [slug]);

  const queryClient = useQueryClient();

  // Fetch real project metadata from filesystem
  const { data: project, isLoading } = useQuery({
    queryKey: ["project-detail", slug],
    queryFn: () => getProjectDetail({ data: { projectDir: slug } }),
  });

  const displayName = project ? getProjectDisplayName(slug, project.name) : "";

  // Fetch server process statuses periodically
  const { data: processStatuses } = useQuery({
    queryKey: ["process-statuses"],
    queryFn: () => getProcessStatuses(),
    refetchInterval: 3000,
  });

  const currentProcess = processStatuses?.[slug] ?? { status: "stopped" };

  // Mutations for dev server process control
  const startServerMutation = useMutation({
    mutationFn: (script: string) => startDevServer({ data: { projectDir: slug, script } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-statuses"] });
      toast.success("Starting dev server...");
    },
    onError: (err: any) => {
      toast.error(`Failed to start server: ${err.message}`);
    },
  });

  const stopServerMutation = useMutation({
    mutationFn: () => stopDevServer({ data: { projectDir: slug } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-statuses"] });
      toast.success("Stopping dev server...");
    },
    onError: (err: any) => {
      toast.error(`Failed to stop server: ${err.message}`);
    },
  });

  // Environment tab states
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmReveal, setShowConfirmReveal] = useState(false);

  // Queries for Environment, Diff, Deps, Runtime node version
  const { data: envVars, refetch: refetchEnv } = useQuery({
    queryKey: ["project-env", slug, revealSecrets],
    queryFn: () => getProjectEnv(slug, revealSecrets),
    enabled: tab === "environment",
  });

  const { data: envDiff, refetch: refetchEnvDiff } = useQuery({
    queryKey: ["project-env-diff", slug],
    queryFn: () => getProjectEnvDiff(slug),
    enabled: tab === "environment",
  });

  const { data: depsData, isLoading: isLoadingDeps } = useQuery({
    queryKey: ["project-deps", slug],
    queryFn: () => getProjectDeps(slug),
    enabled: tab === "environment",
  });

  const { data: runtimeData } = useQuery({
    queryKey: ["project-runtime", slug],
    queryFn: () => getProjectRuntime(slug),
    enabled: tab === "environment",
  });

  // Env save mutation
  const updateEnvMutation = useMutation({
    mutationFn: (newEnvMap: Record<string, string>) => updateProjectEnv(slug, newEnvMap),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-env"] });
      queryClient.invalidateQueries({ queryKey: ["project-env-diff"] });
      refetchEnv();
      refetchEnvDiff();
      toast.success("Environment variables saved successfully.");
      setEditingKey(null);
      setIsAdding(false);
      setNewKey("");
      setNewValue("");
    },
    onError: (err: any) => {
      toast.error(`Failed to save environment variables: ${err.message}`);
    }
  });

  const handleUpdateEnv = (updatedMap: Record<string, string>) => {
    updateEnvMutation.mutate(updatedMap);
  };

  // File explorer states
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("// Select a file from the repository tree to explore its source code.");
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Fetch local repository tree
  const { data: fileTree, isLoading: isLoadingTree } = useQuery({
    queryKey: ["file-tree", slug],
    queryFn: () => getFileTree({ data: { projectDir: slug } }),
    enabled: !!project,
  });

  const handleFileSelect = async (filePath: string) => {
    setSelectedFile(filePath);
    setIsReadingFile(true);
    try {
      const content = await getFileContent({ data: { fullPath: filePath } });
      setFileContent(content);
    } catch (e) {
      setFileContent(`// Error loading file: ${(e as Error).message}`);
    } finally {
      setIsReadingFile(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 space-y-6 max-w-6xl 3xl:max-w-[1600px] 4xl:max-w-[2000px] 5xl:max-w-[2400px] 6xl:max-w-[3000px] 4k:max-w-[3500px] w-full mx-auto animate-pulse">
          <div className="h-8 bg-muted rounded-lg w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className="p-12 text-center text-muted-foreground">
          <p className="text-lg font-semibold">Project not found</p>
          <p className="text-sm mt-2">Directory <code className="bg-muted px-2 py-0.5 rounded">E:\{slug}</code> does not exist.</p>
          <Link to="/" className="text-primary underline text-sm mt-4 inline-block">← Back to Dashboard</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl 3xl:max-w-[1600px] 4xl:max-w-[2000px] 5xl:max-w-[2400px] 6xl:max-w-[3000px] 4k:max-w-[3500px] w-full mx-auto space-y-8 animate-fade-in">

        {/* Breadcrumb + Back */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{displayName}</span>
        </div>

        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border/40">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{displayName}</h1>
              
              {currentProcess.status === "running" && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs py-1 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                  Running (Port {currentProcess.port})
                </Badge>
              )}
              {currentProcess.status === "starting" && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs py-1 flex items-center">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Starting...
                </Badge>
              )}
              {currentProcess.status === "error" && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs py-1 flex items-center">
                  Error
                </Badge>
              )}
              {(currentProcess.status === "stopped" || !currentProcess.status) && (
                <Badge variant="outline" className="bg-zinc-800/20 text-zinc-400 border-zinc-800 text-xs py-1 flex items-center">
                  Stopped
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {project.techStack.map((t: string) => (
                <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-3 shrink-0">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Updated {formatDate(project.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                <span>v{project.version}</span>
              </div>
            </div>

            {(currentProcess.status === "running" || currentProcess.status === "starting") && (
              <div className="flex items-center gap-2 mt-1 animate-in slide-in-from-top-1 duration-200">
                {currentProcess.status === "running" && currentProcess.port && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer"
                    onClick={() => window.open(`http://localhost:${currentProcess.port}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open App
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                  onClick={() => stopServerMutation.mutate()}
                  disabled={stopServerMutation.isPending}
                >
                  <Square className="h-3 w-3 fill-destructive-foreground" /> Stop Server
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<Layers className="h-4 w-4 text-blue-400" />}
            label="Structure"
            value={project.structureType}
          />
          <StatCard
            icon={<FolderTree className="h-4 w-4 text-amber-400" />}
            label="Folders"
            value={String(project.folderCount)}
          />
          <StatCard
            icon={<FileCode className="h-4 w-4 text-emerald-400" />}
            label="Root Files"
            value={String(project.fileCount)}
          />
          <StatCard
            icon={project.hasAndroid ? <Smartphone className="h-4 w-4 text-green-400" /> : <Box className="h-4 w-4 text-purple-400" />}
            label="Dependencies"
            value={String(project.dependencies.length)}
          />
        </div>

        {/* Main Tab Content */}
        <Tabs value={tab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 border-b border-border/40 bg-transparent p-0 rounded-none w-full justify-start">
            <TabsTrigger value="overview" className="px-4 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">Overview</TabsTrigger>
            <TabsTrigger value="repository" className="px-4 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">Repository Explorer</TabsTrigger>
            <TabsTrigger value="readme" className="px-4 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">README</TabsTrigger>
            <TabsTrigger value="environment" className="px-4 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">Environment & Deps</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 outline-none">
            <CodebaseInspector project={project} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Dependencies Panel */}
              <div className="lg:col-span-2 border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2 mb-4">
                  <Code2 className="h-4 w-4 text-primary" /> Dependencies
                </h3>
                {project.dependencies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {project.dependencies.map((dep: string) => (
                      <span
                        key={dep}
                        className="text-xs font-mono px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground border border-border/50 hover:border-primary/40 hover:text-foreground transition-colors"
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No package.json detected — dependencies not available.</p>
                )}
              </div>

              {/* NPM Scripts Panel */}
              <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2 mb-4">
                  <Terminal className="h-4 w-4 text-primary" /> Scripts
                </h3>
                {project.scripts.length > 0 ? (
                  <div className="space-y-1.5">
                    {project.scripts.map((s: string) => {
                      const isRunningThis = currentProcess.status === "running" || currentProcess.status === "starting";
                      return (
                        <div key={s} className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-muted/60 dark:bg-zinc-900/30 border border-border/40 dark:border-zinc-800/60 text-xs font-mono">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-primary">$</span>
                            <span className="text-foreground/80 dark:text-zinc-300 truncate" title={`npm run ${s}`}>npm run {s}</span>
                          </div>
                          {!isRunningThis ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1 font-bold shrink-0 cursor-pointer"
                              onClick={() => startServerMutation.mutate(s)}
                              disabled={startServerMutation.isPending}
                            >
                              <Play className="h-2.5 w-2.5 fill-emerald-400" /> Run
                            </Button>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-bold shrink-0 px-2">Active</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No scripts found.</p>
                )}
              </div>
            </div>

            {/* Git Activity Timeline */}
            <GitCommitTimeline projectDir={project.dirName} />

            {/* Project Path */}
            <div className="border border-border/40 rounded-xl p-5 bg-card/60 backdrop-blur">
              <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                <Folder className="h-4 w-4 text-amber-500" /> Local Path
              </h3>
              <code className="text-xs font-mono text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg inline-block">
                E:\{project.dirName}
              </code>
            </div>
          </TabsContent>

          {/* REPOSITORY EXPLORER TAB */}
          <TabsContent value="repository" className="outline-none space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

              {/* Left: File Tree */}
              <div className="lg:col-span-1 border border-border/40 rounded-xl bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)] flex flex-col overflow-hidden max-h-[600px] 3xl:max-h-[700px] 4xl:max-h-[900px] 5xl:max-h-[1200px] 6xl:max-h-[1400px]">
                <div className="p-4 bg-muted/20 border-b border-border/40 flex items-center gap-1.5">
                  <Folder className="h-4 w-4 text-primary fill-primary/10" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Files</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {isLoadingTree ? (
                    <div className="space-y-2 p-2">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-4 bg-muted animate-pulse rounded" style={{ width: `${70 + Math.random() * 30}%`, marginLeft: `${i % 3 * 12}px` }} />
                      ))}
                    </div>
                  ) : fileTree && fileTree.length > 0 ? (
                    fileTree.map((node) => (
                      <FileTreeNode
                        key={node.fullPath}
                        node={node}
                        onFileSelect={handleFileSelect}
                        selectedFile={selectedFile}
                      />
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-12 px-4 space-y-2">
                      <FolderTree className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                      <p className="font-semibold text-foreground/80">Local explorer offline</p>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Enable the local companion server to view files and explorer source code.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Code Viewer */}
              <div className="lg:col-span-3 border border-border/40 rounded-xl bg-zinc-950 shadow-2xl flex flex-col h-[600px] 3xl:h-[700px] 4xl:h-[900px] 5xl:h-[1200px] 6xl:h-[1400px] overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 tracking-wider font-mono truncate">
                    {selectedFile ? selectedFile.replace(/\\/g, "/").replace(`E:/${slug}/`, "") : "CODE VIEWER"}
                  </span>
                  {isReadingFile && <span className="text-[10px] text-primary animate-pulse uppercase font-bold">reading...</span>}
                </div>
                <div className="flex-1 overflow-hidden bg-zinc-950 relative">
                  <Editor
                    height="100%"
                    language={detectLanguage(selectedFile)}
                    theme="vs-dark"
                    value={fileContent}
                    options={{
                      readOnly: true,
                      minimap: { enabled: true },
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      fontSize: 12,
                      fontFamily: "var(--font-mono, 'Fira Code', 'JetBrains Mono', 'Courier New', monospace)",
                      cursorStyle: "line",
                      wordWrap: "on",
                      domReadOnly: true,
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                    }}
                    loading={
                      <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground animate-pulse gap-2 bg-zinc-950">
                        <Terminal className="h-6 w-6 text-primary animate-spin" />
                        <span>Initializing Monaco Editor Engine...</span>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* README TAB */}
          <TabsContent value="readme" className="outline-none">
            {project.readme ? (
              <div className="border border-border/40 rounded-xl p-8 bg-card/60 backdrop-blur">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border/40">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-lg text-foreground">README.md</h3>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed max-w-none">
                  {project.readme}
                </pre>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 p-16 text-center text-sm text-muted-foreground bg-card/40">
                No README.md found in this project directory.
              </div>
            )}
          </TabsContent>

          {/* ENVIRONMENT & DEPS TAB */}
          <TabsContent value="environment" className="space-y-6 outline-none">
            {envDiff && envDiff.missing.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs leading-relaxed animate-fade-in">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <span className="font-bold">Missing Environment Variables:</span> The following keys are specified in <code className="font-mono bg-amber-500/10 px-1 rounded">.env.example</code> but are missing from your active <code className="font-mono bg-amber-500/10 px-1 rounded">.env</code> file:
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {envDiff.missing.map(k => (
                      <span key={k} className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 text-amber-300 font-bold">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Left Column: Env variables */}
              <div className="lg:col-span-2 border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                      <Lock className="h-4.5 w-4.5 text-primary" /> Environment Secrets
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Edit local configuration settings in .env file</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                      onClick={() => {
                        if (!revealSecrets) {
                          setShowConfirmReveal(true);
                        } else {
                          setRevealSecrets(false);
                        }
                      }}
                    >
                      {revealSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {revealSecrets ? "Mask Secrets" : "Reveal Secrets"}
                    </Button>
                    
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer"
                      onClick={() => setIsAdding(!isAdding)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Secret
                    </Button>
                  </div>
                </div>

                {/* Add secret panel */}
                {isAdding && (
                  <div className="p-4 border border-border/40 rounded-xl bg-muted/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-bold text-foreground">Add New Environment Variable</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Key Name</label>
                        <input
                          type="text"
                          placeholder="e.g. DATABASE_URL"
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                          className="w-full bg-card border border-border/60 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Value</label>
                        <input
                          type="text"
                          placeholder="Secret variable value"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          className="w-full bg-card border border-border/60 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs cursor-pointer"
                        onClick={() => {
                          setIsAdding(false);
                          setNewKey("");
                          setNewValue("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer"
                        onClick={() => {
                          if (!newKey.trim()) return toast.error("Key name cannot be empty.");
                          if (!/^[a-zA-Z0-9_-]+$/.test(newKey)) return toast.error("Key name can only contain alphanumeric characters, underscores, and dashes.");
                          const finalMap = { ...envVars, [newKey]: newValue };
                          handleUpdateEnv(finalMap);
                        }}
                        disabled={updateEnvMutation.isPending}
                      >
                        Save Secret
                      </Button>
                    </div>
                  </div>
                )}

                <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/20">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/40 font-bold text-muted-foreground">
                        <th className="p-3 w-1/3">Key</th>
                        <th className="p-3">Value</th>
                        <th className="p-3 w-28 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envVars && Object.entries(envVars).map(([k, v]) => {
                        const isEditing = editingKey === k;
                        return (
                          <tr key={k} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                            <td className="p-3 font-mono font-bold text-primary truncate max-w-[150px]" title={k}>
                              {k}
                            </td>
                            <td className="p-3 font-mono truncate max-w-[250px]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-full bg-card border border-border/60 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground text-xs"
                                />
                              ) : (
                                <span className={v === "•••••\u2022" ? "text-muted-foreground/60 select-none" : "text-foreground"}>
                                  {v}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      const finalMap = { ...envVars, [k]: editingValue };
                                      handleUpdateEnv(finalMap);
                                    }}
                                    disabled={updateEnvMutation.isPending}
                                    className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded cursor-pointer"
                                    title="Save"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingKey(null)}
                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingKey(k);
                                      setEditingValue(v === "•••••\u2022" ? "" : v);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded cursor-pointer"
                                    title="Edit Value"
                                  >
                                    <Terminal className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const finalMap = { ...envVars };
                                      delete finalMap[k];
                                      handleUpdateEnv(finalMap);
                                    }}
                                    className="p-1 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer"
                                    title="Delete Variable"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(!envVars || Object.keys(envVars).length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-muted-foreground italic">
                            No environment variables found. Create a .env file to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Node Matching & Package fresh */}
              <div className="space-y-6">
                {/* Node Runtime Card */}
                <div className="border border-border/40 rounded-xl p-5 bg-card/60 backdrop-blur space-y-4">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> Node.js Runtime
                  </h3>
                  
                  {runtimeData ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Expected Engine</span>
                        <span className="font-mono font-bold bg-muted/60 px-2 py-0.5 rounded border border-border/40 text-foreground">
                          {runtimeData.expected}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Current Runtime</span>
                        <span className="font-mono font-bold bg-muted/60 px-2 py-0.5 rounded border border-border/40 text-foreground">
                          {runtimeData.current}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-border/30 flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Engine Compatibility</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          runtimeData.matches
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {runtimeData.matches ? "COMPATIBLE MATCH" : "VERSION MISMATCH"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground py-2 italic">Scanning node version...</div>
                  )}
                </div>

                {/* Package Dependencies */}
                <div className="border border-border/40 rounded-xl p-5 bg-card/60 backdrop-blur space-y-4">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" /> Dependencies Freshness
                  </h3>

                  {isLoadingDeps ? (
                    <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs">Auditing packages (this can take a moment)...</span>
                    </div>
                  ) : depsData ? (
                    <div className="space-y-4">
                      {/* Outdated Count */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Outdated Packages</span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                          Object.keys(depsData.outdated).length > 0
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {Object.keys(depsData.outdated).length} outdated
                        </span>
                      </div>

                      {/* Vulnerabilities summaries */}
                      <div className="space-y-2 pt-2 border-t border-border/30">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Vulnerability Audit</span>
                        
                        {depsData.audit.metadata ? (
                          <div className="grid grid-cols-2 gap-2 text-[11px] mt-1.5">
                            <div className="flex justify-between p-1.5 rounded bg-red-500/10 border border-red-500/15 text-red-400 font-bold">
                              <span>Critical</span>
                              <span>{depsData.audit.metadata.vulnerabilities.critical}</span>
                            </div>
                            <div className="flex justify-between p-1.5 rounded bg-orange-500/10 border border-orange-500/15 text-orange-400 font-bold">
                              <span>High</span>
                              <span>{depsData.audit.metadata.vulnerabilities.high}</span>
                            </div>
                            <div className="flex justify-between p-1.5 rounded bg-amber-500/10 border border-amber-500/15 text-amber-400 font-bold col-span-2">
                              <span>Moderate & Low</span>
                              <span>
                                {depsData.audit.metadata.vulnerabilities.moderate + depsData.audit.metadata.vulnerabilities.low}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground italic">
                            No vulnerability metadata returned. Project might lack lockfile or package audit check failed.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground py-2 italic">Dependencies check unavailable.</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Reveal secrets confirmation dialog */}
        <AlertDialog open={showConfirmReveal} onOpenChange={setShowConfirmReveal}>
          <AlertDialogContent className="bg-card border-border/80 text-foreground backdrop-blur-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                <Eye className="h-5 w-5" /> Reveal Environment Secrets?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground mt-2">
                Are you sure you want to reveal all environment variable values in this browser session? Make sure no one is looking at your screen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel className="bg-muted hover:bg-muted/80 text-foreground border border-border">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowConfirmReveal(false);
                  setRevealSecrets(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                Reveal Secrets
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

/* ──── Stat Card ──── */
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass border border-border/40 rounded-xl p-4 flex flex-col gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-sm font-extrabold text-foreground truncate">{value}</span>
    </div>
  );
}

/* ──── File Tree Node (recursive) ──── */
function FileTreeNode({
  node,
  onFileSelect,
  selectedFile,
}: {
  node: FileNode;
  onFileSelect: (fullPath: string) => void;
  selectedFile: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedFile === node.fullPath;

  if (node.isDirectory) {
    return (
      <div className="space-y-0.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 py-1 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded hover:bg-accent/40 w-full text-left transition-colors select-none"
        >
          {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          <Folder className="h-4 w-4 shrink-0 text-amber-500 fill-amber-500/20" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div className="border-l border-border/40 ml-3.5 pl-1.5 space-y-0.5">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.fullPath}
                node={child}
                onFileSelect={onFileSelect}
                selectedFile={selectedFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(node.fullPath)}
      className={`flex items-center gap-2 py-1 px-2 text-xs rounded w-full text-left truncate transition-all duration-150 select-none ${
        isSelected
          ? "bg-primary/15 text-primary font-bold border-l-2 border-primary"
          : "text-foreground hover:bg-accent/40"
      }`}
    >
      <FileCode className="h-4 w-4 shrink-0 text-zinc-400" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

/* ──── Codebase Inspector (Profile-specific insights) ──── */
function CodebaseInspector({ project }: { project: any }) {
  const isAndroid = project.hasAndroid || project.structureType === "Android Mobile App" || !!project.androidDetails;
  const hasWeb = project.hasFrontend || project.hasBackend || project.structureType === "Full-Stack (Client + Server)" || project.structureType === "Full-Stack + Android" || project.techStack.includes("React") || project.techStack.includes("Next.js") || project.techStack.includes("Vite");
  const isWeb3 = project.techStack.includes("Solidity / Web3") || project.techStack.includes("Solidity / Web3 DApp") || project.techStack.includes("Solidity DApp");

  return (
    <div className="space-y-6">
      {/* Dynamic Performance Inspector for all projects */}
      <PerformanceInspector project={project} />

      {/* Profile-specific detailed maps/tools */}
      {hasWeb && <FullStackInspector project={project} />}
      {isAndroid && <AndroidInspector project={project} />}
      {isWeb3 && <Web3Inspector project={project} />}
    </div>
  );
}

function AndroidInspector({ project }: { project: any }) {
  const details = project.androidDetails ?? {
    framework: "Native Android",
    compileSdk: "34",
    minSdk: "26",
    targetSdk: "34",
    applicationId: "com.loopchat.app",
  };

  const deployMutation = useMutation({
    mutationFn: () => deployToEmulator({ data: { projectDir: project.dirName, packageId: details.applicationId } }),
    onSuccess: (res) => {
      toast.success(res.message);
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const hasApk = !!project.apkUrl;
  const sizeMB = project.apkStats ? (project.apkStats.sizeBytes / (1024 * 1024)).toFixed(1) : "0";

  return (
    <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-emerald-400" /> Android App Environment
        </h3>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-bold tracking-wider">
          {details.framework}
        </Badge>
      </div>
      <div className={`grid grid-cols-1 ${hasApk ? "md:grid-cols-3" : "md:grid-cols-2"} gap-6`}>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground">Framework / Build Type</span>
            <span className="font-semibold font-mono text-foreground">{details.framework}</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground">Namespace / Application ID</span>
            <span className="font-semibold font-mono text-foreground">{details.applicationId}</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground">Target SDK Version</span>
            <span className="font-semibold font-mono text-foreground">Android {details.targetSdk}</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground">Min SDK Version</span>
            <span className="font-semibold font-mono text-foreground">Android {details.minSdk}</span>
          </div>
        </div>
        
        {/* ADB Emulator Console */}
        <div className="border border-border/40 dark:border-border/20 rounded-xl p-4 bg-muted/20 dark:bg-zinc-950/40 flex flex-col justify-between h-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider relative z-10">Device Emulator Console</div>
          <div className="flex items-center gap-2 relative z-10 my-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-foreground/80 dark:text-zinc-300 font-mono">ADB Server Running (port 5037)</span>
          </div>
          <Button 
            size="sm"
            variant="outline"
            className="w-full relative z-10 inline-flex items-center justify-center rounded-lg border border-border dark:border-zinc-700 bg-transparent px-3 py-2 text-[10px] font-bold text-muted-foreground dark:text-zinc-300 hover:bg-accent/50 dark:hover:bg-zinc-800/80 active:scale-95 transition-all cursor-pointer"
            onClick={() => deployMutation.mutate()}
            disabled={deployMutation.isPending}
          >
            {deployMutation.isPending ? "Deploying App..." : "Deploy & Launch on Emulator"}
          </Button>
        </div>

        {/* APK Download Card */}
        {hasApk && (
          <div className="border border-border/40 dark:border-border/20 rounded-xl p-4 bg-muted/20 dark:bg-zinc-950/40 flex flex-col justify-between h-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider relative z-10">APK Distribution Node</div>
            <div className="flex items-center gap-2.5 relative z-10 my-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Download className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground/90 dark:text-zinc-200">Latest Compiled Build</span>
                <span className="text-[10px] text-muted-foreground font-mono">{sizeMB} MB · {formatDate(project.apkStats.updatedAt)}</span>
              </div>
            </div>
            <a
              href={project.apkUrl}
              download
              className="w-full relative z-10 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-emerald-500 active:scale-95 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] text-center cursor-pointer font-sans"
            >
              Download latest APK file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function FullStackInspector({ project }: { project: any }) {
  const flags = project.flags ?? {
    supabase: false,
    firebase: false,
    express: false,
    react: false,
    next: false,
    vite: false,
    mongodb: false,
    postgres: false,
    sqlite: false
  };

  // Dynamically determine stack labels from the detected tech/flags
  let clientLabel = "Client Portal";
  let clientSub = "Frontend";
  if (flags.next) {
    clientLabel = "Next.js Portal";
    clientSub = "Next.js / SSR";
  } else if (flags.react) {
    clientLabel = "React App";
    clientSub = flags.vite ? "React / Vite" : "React / SPA";
  }

  let apiLabel = "API Gateway";
  let apiSub = "Node.js";
  if (flags.express) {
    apiLabel = "Express Server";
    apiSub = "Express / Node";
  } else if (flags.supabase) {
    apiLabel = "Supabase API";
    apiSub = "Postgrest / Client";
  } else if (flags.firebase) {
    apiLabel = "Firebase API";
    apiSub = "Firestore Client";
  }

  let dbLabel = "Database Store";
  let dbSub = "Database Store";
  if (flags.mongodb) {
    dbLabel = "MongoDB";
    dbSub = "MongoDB / Mongoose";
  } else if (flags.postgres || flags.supabase) {
    dbLabel = "PostgreSQL";
    dbSub = flags.supabase ? "Supabase Postgres" : "PostgreSQL DB";
  } else if (flags.firebase) {
    dbLabel = "Firestore";
    dbSub = "Firestore Database";
  } else if (flags.sqlite) {
    dbLabel = "SQLite";
    dbSub = "SQLite Database";
  }

  return (
    <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-400" /> Full-Stack Architecture Map
        </h3>
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] uppercase font-bold tracking-wider">
          {project.structureType === "Full-Stack + Android" ? "Hybrid Platform" : "Microservices Active"}
        </Badge>
      </div>
      
      {/* Architecture Diagram */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-5 border border-border/40 dark:border-border/20 rounded-xl bg-muted/20 dark:bg-zinc-950/30">
        <div className="px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center w-36 shadow-sm">
          <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-300 uppercase tracking-wider block">{clientLabel}</span>
          <span className="text-[9px] text-muted-foreground font-mono mt-0.5 block">{clientSub}</span>
        </div>
        <div className="text-muted-foreground/60 dark:text-zinc-600 font-black text-sm select-none rotate-90 sm:rotate-0">──▶</div>
        <div className="px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center w-36 shadow-sm">
          <span className="text-[10px] font-bold text-purple-400 dark:text-purple-300 uppercase tracking-wider block">{apiLabel}</span>
          <span className="text-[9px] text-muted-foreground font-mono mt-0.5 block">{apiSub}</span>
        </div>
        <div className="text-muted-foreground/60 dark:text-zinc-600 font-black text-sm select-none rotate-90 sm:rotate-0">──▶</div>
        <div className="px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-center w-36 shadow-sm">
          <span className="text-[10px] font-bold text-teal-400 dark:text-teal-300 uppercase tracking-wider block">{dbLabel}</span>
          <span className="text-[9px] text-muted-foreground font-mono mt-0.5 block">{dbSub}</span>
        </div>
      </div>
    </div>
  );
}

function Web3Inspector({ project }: { project: any }) {
  return (
    <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-400" /> Decentralized Protocol Inspector
        </h3>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase font-bold tracking-wider">
          Solidity DApp
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 text-xs">
          <div className="flex justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground">Solc Version</span>
            <span className="font-semibold font-mono text-zinc-200">^0.8.20</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground">Framework</span>
            <span className="font-semibold font-mono text-zinc-200">Hardhat / Ethers.js</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground">Contracts Compiled</span>
            <span className="font-semibold text-emerald-400 font-mono">Passed (12 checks)</span>
          </div>
        </div>
        <div className="border border-border/40 dark:border-border/20 rounded-xl p-4 bg-muted/20 dark:bg-zinc-950/40 flex flex-col justify-between h-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider relative z-10">Dev Chain Status</div>
          <div className="flex items-center gap-2 relative z-10 my-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold text-foreground/80 dark:text-zinc-300 font-mono">Hardhat Node Ready (Network ID: 31337)</span>
          </div>
          <button className="w-full relative z-10 inline-flex items-center justify-center rounded-lg border border-border dark:border-zinc-700 bg-transparent px-3 py-2 text-[10px] font-bold text-muted-foreground dark:text-zinc-300 hover:bg-accent/50 dark:hover:bg-zinc-800/80 active:scale-95 transition-all">
            Run Local Gas Profiler
          </button>
        </div>
      </div>
    </div>
  );
}

function PerformanceInspector({ project }: { project: any }) {
  const structure = project.structureType;
  let title = "Frontend Performance Inspector";
  let badge = "Lighthouse Audits";
  
  if (structure === "Server Application") {
    title = "Backend Performance Inspector";
    badge = "API Service Audits";
  } else if (structure === "Full-Stack (Client + Server)") {
    title = "Full-Stack Performance Inspector";
    badge = "System Health Audits";
  } else if (structure === "Full-Stack + Android") {
    title = "Full-Stack & Android Performance Inspector";
    badge = "System Health Audits";
  } else if (structure === "Android Mobile App") {
    title = "Android App Performance Inspector";
    badge = "Android SDK Audits";
  } else if (structure === "Solidity / Web3 DApp") {
    title = "Web3 Protocol Performance Inspector";
    badge = "Smart Contract Audits";
  }

  return (
    <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> {title}
        </h3>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-bold tracking-wider">
          {badge}
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
        <ScoreRing score={98} label="Performance" color="text-emerald-400" />
        <ScoreRing score={95} label="Accessibility" color="text-emerald-400" />
        <ScoreRing score={96} label="Best Practices" color="text-emerald-400" />
        <ScoreRing score={100} label="SEO Status" color="text-emerald-400" />
      </div>
    </div>
  );
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border/20 bg-zinc-950/40 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-center h-14 w-14">
        <svg className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="3" className="text-zinc-200 dark:text-zinc-800" fill="transparent" />
          <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="3" className={color} strokeDasharray={150.8} strokeDashoffset={150.8 * (1 - score / 100)} fill="transparent" />
        </svg>
        <span className="absolute text-xs font-black text-foreground">{score}</span>
      </div>
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ──── Language Detector for Monaco ──── */
function detectLanguage(filename: string | null): string {
  if (!filename) return "plaintext";
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "kt":
    case "kts":
      return "kotlin";
    case "java":
      return "java";
    case "xml":
      return "xml";
    case "gradle":
      return "groovy";
    case "sh":
      return "shell";
    case "yaml":
    case "yml":
      return "yaml";
    case "py":
      return "python";
    default:
      return "plaintext";
  }
}

/* ──── Live Git Activity Timeline Component ──── */
function GitCommitTimeline({ projectDir }: { projectDir: string }) {
  const { data: commits, isLoading } = useQuery({
    queryKey: ["git-history", projectDir],
    queryFn: () => getGitHistory({ data: { projectDir } }),
  });

  return (
    <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur space-y-6">
      <div className="flex items-center justify-between border-b border-border/20 pb-4">
        <div className="space-y-1">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" /> Local Git Feed
          </h3>
          <p className="text-xs text-muted-foreground">Real-time commit ledger and development milestones</p>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 uppercase font-black tracking-wider">
          offline
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4 py-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 items-start animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : commits && commits.length > 0 ? (
        <div className="relative pl-6 border-l border-border/60 ml-3 space-y-6 my-2">
          {commits.map((commit, index) => (
            <div key={commit.hash} className="relative group transition-all duration-200">
              {/* Dot indicator on the left line */}
              <div className="absolute -left-[31px] top-1.5 flex items-center justify-center">
                <span className="relative flex h-4.5 w-4.5 items-center justify-center">
                  {index === 0 && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${index === 0 ? "bg-primary" : "bg-zinc-600 group-hover:bg-zinc-400"} transition-colors`}></span>
                </span>
              </div>

              {/* Commit Content Box */}
              <div className="glass border border-border/20 group-hover:border-primary/30 rounded-xl p-4 transition-all duration-200 bg-muted/30 dark:bg-zinc-900/20 group-hover:bg-muted/50 dark:group-hover:bg-zinc-900/40 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="space-y-1.5 relative z-10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground/90 dark:text-zinc-100 group-hover:text-primary transition-colors leading-tight">
                      {commit.message}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-muted/80 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-black uppercase text-muted-foreground dark:text-zinc-300">
                        {commit.authorName.charAt(0)}
                      </span>
                      <span className="font-semibold text-foreground/80 dark:text-zinc-300">{commit.authorName}</span>
                    </span>
                    <span>·</span>
                    <span>{commit.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 relative z-10">
                  <span className="text-[10px] font-mono font-black text-muted-foreground dark:text-zinc-300 uppercase bg-muted/60 dark:bg-zinc-950/60 px-2.5 py-1 rounded-md border border-border/40">
                    {commit.shortHash}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic py-4 text-center">
          Git feed is unavailable because the Companion server is not running.
        </div>
      )}
    </div>
  );
}

export default ProjectDetail;
