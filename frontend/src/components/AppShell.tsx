import { useState, useEffect, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/CommandPalette";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Bind keydown listeners for Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Determine if this is a global full-width dashboard or project-focused workspace
  const isGlobalDashboard = pathname === "/" || pathname === "/analytics";

  return (
    <SidebarProvider defaultOpen={!isGlobalDashboard}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Render sidebar only on project-specific workspace pages */}
        {!isGlobalDashboard && <AppSidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Main Top Navigation Header */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-8">
              {/* Brand Logo (Styled Triangle) */}
              <Link to="/" className="flex items-center gap-2 group active:scale-95 transition-transform">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xl shadow-[0_4px_12px_rgba(0,104,95,0.2)]">
                  ▲
                </div>
                {isGlobalDashboard && (
                  <span className="font-bold tracking-tight text-lg text-primary group-hover:opacity-80 transition-opacity">
                    DevEngine
                  </span>
                )}
              </Link>

              {/* Sidebar Trigger (Only visible on workspace subpages) */}
              {!isGlobalDashboard && <SidebarTrigger className="h-9 w-9 text-muted-foreground" />}

              {/* Horizontal Navigation tabs */}
              {isGlobalDashboard && (
                <nav className="flex items-center gap-6 h-full ml-2">
                  <Link
                    to="/"
                    className={`text-sm font-medium transition-all py-1 border-b-2 hover:text-primary ${
                      pathname === "/" ? "text-primary border-primary font-bold" : "text-muted-foreground border-transparent"
                    }`}
                  >
                    Projects
                  </Link>
                  <Link
                    to="/analytics"
                    className={`text-sm font-medium transition-all py-1 border-b-2 hover:text-primary ${
                      pathname === "/analytics" ? "text-primary border-primary font-bold" : "text-muted-foreground border-transparent"
                    }`}
                  >
                    Analytics
                  </Link>
                </nav>
              )}
            </div>

            {/* Right-aligned actions (Search, Notifications, Profile) */}
            <div className="flex items-center gap-4">
              {/* Command Palette Trigger Input */}
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden md:flex items-center bg-card hover:bg-accent border border-border/80 rounded-lg px-3 py-1.5 w-64 text-left text-muted-foreground transition-all focus:outline-none"
              >
                <Search className="h-4 w-4 mr-2 text-muted-foreground/75" />
                <span className="text-xs flex-1">Search projects...</span>
                <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span>⌘</span>K
                </kbd>
              </button>

              {user && <NotificationsBell />}

              {user ? (
                <Avatar className="h-8 w-8 border border-border/40 cursor-pointer hover:opacity-85 transition-opacity">
                  <AvatarImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJ5qAlpvGDLvytv4q2c2uvvWQNOCNAFBOzKztRwpMcFbL5miJi5lBambbJTXhAMxydQxCxYMvVN5UB9-vvEzA1b89F7dO6fziiqBYSJaaZ17C4iHG6QfVgwiLuyqjq_vPq3QAAtqQ-mFNI5EbNNG9RhMuRzXByWwupbRL543pgWC8l0ZGa_qEt4Vr2_8DetI04tJvcpw9pFpWrAj5zVKfMWllqud0amxc1Fs5pao_SMX81rntFTXkSDm00iRP0PwOlMPbDVbsotIU" />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">U</AvatarFallback>
                </Avatar>
              ) : (
                <Button asChild size="sm" variant="outline" className="border-border">
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </header>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>

      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
    </SidebarProvider>
  );
}
