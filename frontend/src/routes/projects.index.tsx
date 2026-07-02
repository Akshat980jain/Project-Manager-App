import { Link } from "react-router-dom";
import { useQuery } from "@/hooks/use-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProjectCard, type ProjectCardData } from "@/components/ProjectCard";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { STATUS_LABEL, type ProjectStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

async function fetchAll() {
  const [{ data: projects }, { data: categories }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,slug,icon,color,status,tech_stack,updated_at,category_id,tags")
      .order("updated_at", { ascending: false }),
    supabase.from("categories").select("id,name,slug,color"),
  ]);
  return { projects: projects ?? [], categories: categories ?? [] };
}

const STATUSES: ProjectStatus[] = ["active", "in_development", "completed", "archived"];

function ProjectsPage() {
  const { data } = useQuery({ queryKey: ["all-projects"], queryFn: fetchAll });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [catId, setCatId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = (data?.projects ?? []) as (ProjectCardData & { category_id: string | null; tags: string[] })[];
    return list.filter((p) => {
      if (status && p.status !== status) return false;
      if (catId && p.category_id !== catId) return false;
      if (q) {
        const hay = (p.name + " " + p.tech_stack.join(" ") + " " + (p.tags ?? []).join(" ")).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, q, status, catId]);

  return (
    <AppShell>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {data?.projects.length ?? 0}</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, tech, or tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Pill active={status === null} onClick={() => setStatus(null)}>All statuses</Pill>
            {STATUSES.map((s) => (
              <Pill key={s} active={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</Pill>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Pill active={catId === null} onClick={() => setCatId(null)}>All categories</Pill>
            {data?.categories.map((c: any) => (
              <Pill key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)} accent={c.color}>
                {c.name}
              </Pill>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-7 6xl:grid-cols-8 4k:grid-cols-10 gap-4">
          {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12">
              No projects match. <Link to="/projects" className="text-primary underline" onClick={() => { setQ(""); setStatus(null); setCatId(null); }}>Clear filters</Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default ProjectsPage;

      function Pill({active, accent, onClick, children}: {active: boolean; accent?: string; onClick: () => void; children: React.ReactNode }) {
  return (
      <button
        onClick={onClick}
        className={cn(
          "px-3 py-1 rounded-full text-xs border transition",
          active
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
        )}
        style={active && accent ? { background: accent, borderColor: accent, color: "#0d1117" } : undefined}
      >
        {children}
      </button>
      );
}
