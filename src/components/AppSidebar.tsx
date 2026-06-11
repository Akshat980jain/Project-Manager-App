import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Rocket,
  Shield,
  Activity,
  LogIn,
  LogOut,
  Sun,
  Moon,
  Github,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  // Extract the project slug from the path (e.g., /projects/project-alpha)
  const match = pathname.match(/^\/projects\/([^\/]+)/);
  const slug = match ? match[1] : "project-alpha";

  // Re-humanize slug for displaying in title
  const projectName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // Brand name overrides: map humanized slug names to their actual brand names
  const brandNameOverrides: Record<string, string> = {
    "Ems": "StaffSphere",
    "Booking Management App": "BookEase 24x7",
    "Lovable Chat App": "Loop Chat",
    "Ytblog": "Scribe",
  };
  const displayName = brandNameOverrides[projectName] ?? projectName;

  // Mapping dynamic slugs back to custom icons/logos
  const getSidebarLogo = (slug: string) => {
    const decoded = decodeURIComponent(slug).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (decoded === "ems") {
      return "/logos/staffsphere_logo.png";
    }
    if (decoded === "booking-management-app") {
      return "/logos/bookease_logo.png";
    }
    if (decoded === "ytblog") {
      return "/logos/scribe_logo.jpg";
    }
    if (decoded === "lovable-chat-app") {
      return "/logos/loop_logo.png";
    }
    if (decoded === "quickkart-app-bolt") {
      return "/logos/quickkart_logo.png";
    }
    if (decoded === "android-erp") {
      return "/logos/android_erp_logo.png";
    }
    if (decoded === "upload-app") {
      return "/logos/upload_app_logo.png";
    }
    return null;
  };

  const logoPath = getSidebarLogo(slug);

  const routerState = useRouterState();
  const searchTab = (routerState.location.search as any)?.tab;

  const items = [
    {
      title: "Overview",
      to: "/projects/$slug" as const,
      search: { tab: "overview" as const },
      params: { slug },
      icon: LayoutDashboard,
      isActive: pathname === `/projects/${slug}` && (!searchTab || searchTab === "overview"),
    },
    {
      title: "Repository",
      to: "/projects/$slug" as const,
      search: { tab: "repository" as const },
      params: { slug },
      icon: FolderKanban,
      isActive: pathname === `/projects/${slug}` && searchTab === "repository",
    },
    {
      title: "Pipelines",
      to: "/projects/$slug/pipeline" as const,
      params: { slug },
      icon: Rocket,
      isActive: pathname === `/projects/${slug}/pipeline`,
    },
    {
      title: "Security",
      to: "/settings/security" as const,
      icon: Shield,
      isActive: pathname === "/settings/security",
    },
    {
      title: "Monitoring",
      to: "/admin/audit-log" as const,
      icon: Activity,
      isActive: pathname === "/admin/audit-log",
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Sidebar Header - Matches Screenshot */}
      <SidebarHeader className="border-b border-sidebar-border/60 py-4 px-4">
        <div className="flex items-center gap-3">
          {logoPath ? (
            <img
              src={logoPath}
              alt={displayName}
              className="w-10 h-10 rounded-lg object-cover border border-sidebar-border shadow-sm"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/25 text-primary font-black text-lg">
              {displayName.charAt(0)}
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold tracking-tight text-foreground">{displayName}</span>
              <span className="text-[10px] text-muted-foreground">v2.4.0-stable</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Sidebar Navigation Items */}
      <SidebarContent className="py-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = item.isActive;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={`relative flex items-center gap-3 py-6 px-4 transition-all duration-200 ${
                        isActive
                          ? "bg-primary-container/10 text-primary font-bold border-l-4 border-primary rounded-r-lg"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      }`}
                    >
                      <Link
                        to={item.to}
                        search={"search" in item ? item.search : undefined}
                        params={"params" in item ? item.params : undefined}
                        className="flex items-center w-full h-full"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer with Help and Settings */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2 gap-1 bg-sidebar">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="justify-start text-muted-foreground hover:text-foreground hover:bg-accent/60 h-9 w-full"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="ml-2 text-xs">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </Button>

        {!collapsed && (
          <div className="flex flex-col gap-0.5 border-t border-sidebar-border/30 pt-1 mt-1">
            <Link
              to="/admin/audit-log"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent/40"
            >
              <BookOpen className="h-3.5 w-3.5" /> Documentation
            </Link>
            <Link
              to="/admin/audit-log"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent/40"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Support Hub
            </Link>
          </div>
        )}

        {user ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 w-full mt-1"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2 text-xs">Sign Out</span>}
          </Button>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground hover:text-foreground hover:bg-accent/60 h-9 w-full mt-1"
          >
            <Link to="/login">
              <LogIn className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="ml-2 text-xs">Sign In</span>}
            </Link>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
