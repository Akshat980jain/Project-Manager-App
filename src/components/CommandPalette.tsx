import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@/hooks/use-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, Folder, Rocket, Shield, Key, Users } from "lucide-react";

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const navigate = useNavigate();

  // Fetch recent projects for palette
  const { data: projects } = useQuery({
    queryKey: ["palette-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, slug, updated_at")
        .order("updated_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const handleSelect = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, projects, or jump to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {projects && projects.length > 0 && (
          <CommandGroup heading="Recent Projects">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                onSelect={() => handleSelect(() => navigate(`/projects/${project.slug}`))}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer"
              >
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-primary shrink-0">
                  <Folder className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-sm text-foreground">{project.name}</span>
                  <span className="text-[10px] text-muted-foreground">Jump to workspace</span>
                </div>
                <CommandShortcut>↵ Enter</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        
        <CommandSeparator />
        
        <CommandGroup heading="Common Actions">
          <CommandItem
            onSelect={() => handleSelect(() => navigate("/admin/projects/new"))}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm">Trigger New Deploy / Project</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => navigate("/settings/security"))}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm">Configure API Credentials</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => handleSelect(() => navigate("/"))}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <span className="text-sm">Go to Projects Board</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => navigate("/team"))}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-sm">Go to Teams</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => navigate("/analytics"))}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-sm">Go to Fleet Analytics</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
