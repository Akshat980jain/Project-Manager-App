export type ProjectStatus = "active" | "completed" | "in_development" | "archived";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  in_development: "In Development",
  archived: "Archived",
};

export const STATUS_CLASS: Record<ProjectStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  completed: "bg-info/15 text-info border-info/30",
  in_development: "bg-warning/15 text-warning border-warning/30",
  archived: "bg-muted text-muted-foreground border-border",
};

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function bytesFmt(n: number | null | undefined): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
