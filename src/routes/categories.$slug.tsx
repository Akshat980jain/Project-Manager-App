import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProjectCard, type ProjectCardData } from "@/components/ProjectCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/categories/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Categories` }] }),
  component: CatPage,
});

function CatPage() {
  const { slug } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["cat", slug],
    queryFn: async () => {
      const { data: cat } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
      const { data: projects } = await supabase
        .from("projects")
        .select("id,name,slug,icon,color,status,tech_stack,updated_at")
        .eq("category_id", cat?.id ?? "")
        .order("updated_at", { ascending: false });
      return { cat, projects: projects ?? [] };
    },
  });

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto space-y-6">
        <Link to="/categories" className="text-xs text-muted-foreground hover:text-foreground">← All categories</Link>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: data?.cat?.color }}>{data?.cat?.name ?? slug}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-7 6xl:grid-cols-8 4k:grid-cols-10 gap-4">
          {(data?.projects ?? []).map((p) => <ProjectCard key={p.id} project={p as ProjectCardData} />)}
          {data && data.projects.length === 0 && <div className="text-sm text-muted-foreground">No projects in this category yet.</div>}
        </div>
      </div>
    </AppShell>
  );
}
