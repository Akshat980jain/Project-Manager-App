import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ICON_NAMES, getIcon } from "@/lib/icons";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/projects/new")({
  component: NewProject,
});

function NewProject() {
  const nav = useNavigate();
  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const [form, setForm] = useState({
    name: "", description: "", icon: "Box", color: "#58a6ff",
    status: "in_development", tech: "", github_url: "", live_url: "",
    start_date: "", category_id: "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const slug = slugify(form.name);
    const { error } = await supabase.from("projects").insert({
      name: form.name, slug, description: form.description, icon: form.icon, color: form.color,
      status: form.status as any,
      tech_stack: form.tech.split(",").map((s) => s.trim()).filter(Boolean),
      github_url: form.github_url || null, live_url: form.live_url || null,
      start_date: form.start_date || null,
      category_id: form.category_id || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    nav({ to: "/admin/projects/$slug", params: { slug } });
  }

  const Icon = getIcon(form.icon);

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">New Project</h1>
      <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Icon</Label>
          <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {ICON_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Color</Label>
          <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="in_development">In Development</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {(cats ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Tech stack (comma-separated)</Label><Input value={form.tech} onChange={(e) => setForm({ ...form, tech: e.target.value })} placeholder="React, Node, Supabase" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>GitHub URL</Label><Input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} /></div>
        <div><Label>Live URL</Label><Input value={form.live_url} onChange={(e) => setForm({ ...form, live_url: e.target.value })} /></div>
      </div>
      <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
      <div className="flex items-center gap-3 pt-2">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in oklab, ${form.color} 18%, transparent)`, color: form.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create project"}</Button>
      </div>
    </form>
  );
}
