import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@/hooks/use-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Upload as UploadIcon, Download } from "lucide-react";
import { bytesFmt } from "@/lib/format";

function EditProject() {
  const { slug } = useParams();
  if (!slug) {
    return <div className="text-muted-foreground">Error: Missing project identifier.</div>;
  }
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["admin-project", slug],
    queryFn: async () => {
      const { data: project } = await supabase.from("projects").select("*").eq("slug", slug).maybeSingle();
      if (!project) return null;
      const [shots, files, apk, docs] = await Promise.all([
        supabase.from("project_screenshots").select("*").eq("project_id", project.id).order("sort_order"),
        supabase.from("project_files").select("*").eq("project_id", project.id),
        supabase.from("project_apks").select("*").eq("project_id", project.id).maybeSingle(),
        supabase.from("project_docs").select("*").eq("project_id", project.id).maybeSingle(),
      ]);
      return { project, screenshots: shots.data ?? [], files: files.data ?? [], apk: apk.data, docs: docs.data };
    },
  });

  if (!data || !data.project) return <div className="text-muted-foreground">Loading…</div>;
  const currentData = data;
  const project = currentData.project;
  const currentApk = currentData.apk;
  const currentDocs = currentData.docs;

  async function uploadScreenshots(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const path = `${project.id}/${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from("screenshots").upload(path, f);
      if (error) { toast.error(error.message); continue; }
      await supabase.from("project_screenshots").insert({ project_id: project.id, storage_path: path });
    }
    toast.success("Uploaded");
    refetch();
  }

  async function deleteScreenshot(id: string, path: string) {
    await supabase.storage.from("screenshots").remove([path]);
    await supabase.from("project_screenshots").delete().eq("id", id);
    refetch();
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const path = `${project.id}/${Date.now()}-${f.name}`;
    const { error } = await supabase.storage.from("project-files").upload(path, f);
    if (error) { toast.error(error.message); return; }
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const kind = ext === "zip" ? "zip" : ["pdf"].includes(ext) ? "pdf" : ["doc", "docx"].includes(ext) ? "doc" : ["ppt", "pptx"].includes(ext) ? "ppt" : ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? "image" : "other";
    await supabase.from("project_files").insert({ project_id: project.id, storage_path: path, label: f.name, kind, size_bytes: f.size });
    toast.success("File uploaded");
    refetch();
  }

  async function deleteFile(id: string, path: string) {
    await supabase.storage.from("project-files").remove([path]);
    await supabase.from("project_files").delete().eq("id", id);
    refetch();
  }

  async function uploadApk(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const path = `${project.id}/${Date.now()}-${f.name}`;
    const { error } = await supabase.storage.from("apks").upload(path, f);
    if (error) { toast.error(error.message); return; }
    if (currentData.apk) {
      await supabase.storage.from("apks").remove([currentData.apk.storage_path]);
      await supabase.from("project_apks").update({ storage_path: path, size_bytes: f.size }).eq("project_id", project.id);
    } else {
      await supabase.from("project_apks").insert({ project_id: project.id, storage_path: path, size_bytes: f.size });
    }
    toast.success("APK uploaded");
    refetch();
  }

  async function deleteApk() {
    if (!currentData.apk) return;
    await supabase.storage.from("apks").remove([currentData.apk.storage_path]);
    await supabase.from("project_apks").delete().eq("id", currentData.apk.id);
    refetch();
  }

  async function saveDocs(form: { notes: string; research: string; requirements: string; documentation: string }) {
    const payload = { project_id: project.id, ...form };
    if (currentData.docs) {
      await supabase.from("project_docs").update(payload).eq("project_id", project.id);
    } else {
      await supabase.from("project_docs").insert(payload);
    }
    toast.success("Docs saved");
    refetch();
  }

  async function deleteProject() {
    if (!confirm(`Delete ${project.name}? This is irreversible.`)) return;
    await supabase.from("projects").delete().eq("id", project.id);
    toast.success("Deleted");
    window.location.href = "/admin";
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Edit: {project.name}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to={`/projects/${slug}`}>View</Link></Button>
          <Button onClick={deleteProject} variant="destructive" size="sm"><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
        </div>
      </div>

      <ProjectFields project={project} onSaved={() => refetch()} />

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Screenshots</h2>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" multiple className="hidden" onChange={uploadScreenshots} />
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"><UploadIcon className="h-3 w-3" /> Upload</span>
          </label>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {data.screenshots.map((s: any) => (
            <div key={s.id} className="relative aspect-video rounded-md overflow-hidden border border-border group">
              <img src={supabase.storage.from("screenshots").getPublicUrl(s.storage_path).data.publicUrl} className="h-full w-full object-cover" />
              <button onClick={() => deleteScreenshot(s.id, s.storage_path)} className="absolute top-1 right-1 p-1 rounded bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">APK</h2>
          <label className="cursor-pointer">
            <input type="file" accept=".apk" className="hidden" onChange={uploadApk} />
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"><UploadIcon className="h-3 w-3" /> {data.apk ? "Replace" : "Upload"} APK</span>
          </label>
        </div>
        {data.apk ? (
          <div className="flex items-center justify-between text-sm">
            <span>{bytesFmt(data.apk.size_bytes)}</span>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline"><a href={supabase.storage.from("apks").getPublicUrl(data.apk.storage_path).data.publicUrl} download><Download className="h-3 w-3 mr-1" />Download</a></Button>
              <Button onClick={deleteApk} size="sm" variant="destructive"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">No APK uploaded.</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Files</h2>
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={uploadFile} />
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"><UploadIcon className="h-3 w-3" /> Upload</span>
          </label>
        </div>
        <div className="divide-y divide-border">
          {data.files.map((f: any) => (
            <div key={f.id} className="flex justify-between items-center py-2 text-sm">
              <span>{f.label} <span className="text-xs text-muted-foreground">({bytesFmt(f.size_bytes)})</span></span>
              <Button onClick={() => deleteFile(f.id, f.storage_path)} size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      </section>

      <DocsEditor initial={data.docs} onSave={saveDocs} />
    </div>
  );
}

function ProjectFields({ project, onSaved }: { project: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: project.name, description: project.description ?? "", color: project.color,
    status: project.status, github_url: project.github_url ?? "", live_url: project.live_url ?? "",
    tech: (project.tech_stack ?? []).join(", "),
    tags: (project.tags ?? []).join(", "),
  });
  async function save() {
    const { error } = await supabase.from("projects").update({
      name: form.name, description: form.description, color: form.color, status: form.status as any,
      github_url: form.github_url || null, live_url: form.live_url || null,
      tech_stack: form.tech.split(",").map((s: string) => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map((s: string) => s.trim()).filter(Boolean),
    }).eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    onSaved();
  }
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Project info</h2>
      <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Status</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
            <option value="active">Active</option><option value="in_development">In Development</option><option value="completed">Completed</option><option value="archived">Archived</option>
          </select>
        </div>
        <div><Label>Color</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
      </div>
      <div><Label>Tech stack (comma)</Label><Input value={form.tech} onChange={(e) => setForm({ ...form, tech: e.target.value })} /></div>
      <div><Label>Tags (comma)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>GitHub URL</Label><Input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} /></div>
        <div><Label>Live URL</Label><Input value={form.live_url} onChange={(e) => setForm({ ...form, live_url: e.target.value })} /></div>
      </div>
      <Button onClick={save} size="sm">Save changes</Button>
    </section>
  );
}

function DocsEditor({ initial, onSave }: { initial: any; onSave: (f: any) => Promise<void> }) {
  const [f, setF] = useState({
    notes: initial?.notes ?? "", research: initial?.research ?? "",
    requirements: initial?.requirements ?? "", documentation: initial?.documentation ?? "",
  });
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Documentation</h2>
      {(["notes", "research", "requirements", "documentation"] as const).map((k) => (
        <div key={k}>
          <Label className="capitalize">{k}</Label>
          <Textarea rows={4} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      <Button size="sm" onClick={() => onSave(f)}>Save docs</Button>
    </section>
  );
}

export default EditProject;
