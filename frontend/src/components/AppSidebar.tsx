import { Link, useLocation, useSearchParams } from "react-router-dom";
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
  BookOpen,
  HelpCircle,
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

import { getProjectDisplayName } from "@/lib/utils";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const pathname = location.pathname;
  const [searchParams] = useSearchParams();
  const searchTab = searchParams.get("tab");
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  // Extract the project slug from the path (e.g., /projects/project-alpha)
  const match = pathname.match(/^\/projects\/([^\/]+)/);
  const slug = match ? match[1] : (localStorage.getItem("last_project_slug") || "project-alpha");

  // Re-humanize slug for displaying in title
  const projectName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const displayName = getProjectDisplayName(slug, projectName);

  // Mapping dynamic slugs back to custom icons/logos
  const getSidebarLogo = (slug: string) => {
    const decoded = decodeURIComponent(slug).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (decoded === "ems" || decoded === "ems-frontend" || decoded.includes("ems")) {
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
    if (decoded === "qscan" || decoded.includes("qscan")) {
      return "/logos/qscan_logo.png";
    }
    if (decoded === "pulse-app" || decoded.includes("pulse")) {
      return "/logos/pulse_logo.png";
    }
    return null;
  };

  const logoPath = getSidebarLogo(slug);

  const items = [
    {
      title: "Overview",
      to: `/projects/${slug}?tab=overview`,
      icon: LayoutDashboard,
      isActive: pathname === `/projects/${slug}` && (!searchTab || searchTab === "overview"),
    },
    {
      title: "Security",
      to: "/settings/security",
      icon: Shield,
      isActive: pathname === "/settings/security",
    },
    {
      title: "Monitoring",
      to: "/admin/audit-log",
      icon: Activity,
      isActive: pathname === "/admin/audit-log",
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Sidebar Header - Matches Screenshot */}
      <SidebarHeader className={`border-b border-sidebar-border/60 py-4 ${collapsed ? "px-1.5" : "px-4"}`}>
        <div className={`flex items-center gap-3 w-full ${collapsed ? "justify-center" : ""}`}>
          {logoPath ? (
            <img
              src={logoPath}
              alt={displayName}
              className={`${collapsed ? "w-8 h-8 rounded-md" : "w-10 h-10 rounded-lg"} object-cover border border-sidebar-border shadow-sm shrink-0 transition-all`}
            />
          ) : (
            <div className={`flex ${collapsed ? "h-8 w-8 text-base" : "h-10 w-10 text-lg"} shrink-0 items-center justify-center rounded-lg bg-primary-container/25 text-primary font-black transition-all`}>
              {displayName.charAt(0)}
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col leading-tight animate-in fade-in duration-200">
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
      <SidebarFooter className={`border-t border-sidebar-border/60 p-2 gap-1 bg-sidebar ${collapsed ? "items-center" : ""}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={`text-muted-foreground hover:text-foreground hover:bg-accent/60 h-9 w-full ${collapsed ? "justify-center px-0" : "justify-start px-3"}`}
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
            className={`text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 w-full mt-1 ${collapsed ? "justify-center px-0" : "justify-start px-3"}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2 text-xs">Sign Out</span>}
          </Button>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={`text-muted-foreground hover:text-foreground hover:bg-accent/60 h-9 w-full mt-1 ${collapsed ? "justify-center px-0" : "justify-start px-3"}`}
          >
            <Link to="/login" className="flex items-center justify-center w-full h-full">
              <LogIn className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="ml-2 text-xs">Sign In</span>}
            </Link>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
