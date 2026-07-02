import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/format";

type Notification = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  }

  useEffect(() => {
    if (!user) { setItems([]); return; }
    load();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function markAll() {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    load();
  }

  const unread = items.filter((i) => !i.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notifications</span>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0}>
            <Check className="h-3 w-3 mr-1" /> Mark read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
          ) : items.map((n) => (
            <Link
              key={n.id}
              to={n.link ?? "/"}
              className={`block px-3 py-2 border-b last:border-0 hover:bg-accent ${!n.read ? "bg-accent/30" : ""}`}
            >
              <div className="text-sm">{n.message}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{formatDate(n.created_at)}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
