import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,slug,status,updated_at").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage projects, screenshots, files, and APKs.</p>
        </div>
        <Button asChild><Link to="/admin/projects/new"><Plus className="h-4 w-4 mr-1" />New Project</Link></Button>
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(data ?? []).map((p) => (
          <Link key={p.id} to="/admin/projects/$slug" params={{ slug: p.slug }} className="flex items-center justify-between p-3 hover:bg-accent">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.status} · {formatDate(p.updated_at)}</div>
            </div>
            <span className="text-xs text-primary">Edit →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
