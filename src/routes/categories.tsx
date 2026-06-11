import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProjectCard, type ProjectCardData } from "@/components/ProjectCard";
import { supabase } from "@/integrations/supabase/client";
import { Tags } from "lucide-react";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — ProjectHub" }] }),
  component: CategoriesIndex,
});

async function fetchCats() {
  const [{ data: cats }, { data: projects }] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase.from("projects").select("id,category_id"),
  ]);
  const counts: Record<string, number> = {};
  (projects ?? []).forEach((p: any) => { if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1; });
  return (cats ?? []).map((c: any) => ({ ...c, count: counts[c.id] ?? 0 }));
}

function CategoriesIndex() {
  const { data } = useQuery({ queryKey: ["categories-index"], queryFn: fetchCats });
  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse projects grouped by type.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.map((c) => (
            <Link
              key={c.id}
              to="/categories/$slug"
              params={{ slug: c.slug }}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in oklab, ${c.color} 18%, transparent)`, color: c.color }}>
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.count} projects</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
