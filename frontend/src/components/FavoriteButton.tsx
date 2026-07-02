import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function FavoriteButton({ projectId, size = "sm" }: { projectId: string; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setFav(false); return; }
    supabase.from("favorites")
      .select("project_id")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .maybeSingle()
      .then(({ data }) => setFav(!!data));
  }, [user?.id, projectId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error("Sign in to favorite projects"); return; }
    setLoading(true);
    if (fav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("project_id", projectId);
      setFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, project_id: projectId });
      setFav(true);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={fav ? "Remove favorite" : "Add favorite"}
      className={cn(
        "rounded-md p-1.5 transition hover:bg-accent",
        fav ? "text-warning" : "text-muted-foreground"
      )}
    >
      <Star className={cn(size === "md" ? "h-5 w-5" : "h-4 w-4", fav && "fill-current")} />
    </button>
  );
}
