import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — ProjectHub" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <AppShell><div className="p-8 text-muted-foreground">Loading…</div></AppShell>;
  if (!user) return <AppShell><div className="p-8"><p className="mb-3">Please sign in.</p><Button asChild><Link to="/login">Sign in</Link></Button></div></AppShell>;
  if (!isAdmin) return <AppShell><div className="p-8 text-muted-foreground">Admin access only.</div></AppShell>;
  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link to="/admin" className="text-primary hover:underline">Admin</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/admin/projects/new" className="hover:underline">New project</Link>
        </div>
        <Outlet />
      </div>
    </AppShell>
  );
}
