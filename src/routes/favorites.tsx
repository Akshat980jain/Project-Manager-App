import { useQuery } from "@/hooks/use-query";
import { AppShell } from "@/components/AppShell";
import { ProjectCard, type ProjectCardData } from "@/components/ProjectCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

function FavPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("project_id, projects(id,name,slug,icon,color,status,tech_stack,updated_at)")
        .eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.projects).filter(Boolean);
    },
  });

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Favorites</h1>
        {!user && <p className="text-sm text-muted-foreground">Sign in to save your favorite projects.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-7 6xl:grid-cols-8 4k:grid-cols-10 gap-4">
          {(data ?? []).map((p: any) => <ProjectCard key={p.id} project={p as ProjectCardData} />)}
        </div>
        {user && data && data.length === 0 && <p className="text-sm text-muted-foreground">No favorites yet. Star a project to add it here.</p>}
      </div>
    </AppShell>
  );
}

export default FavPage;
