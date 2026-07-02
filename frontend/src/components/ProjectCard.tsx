import { Link } from "react-router-dom";
import { getIcon } from "@/lib/icons";
import { STATUS_CLASS, STATUS_LABEL, formatDate, type ProjectStatus } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "./FavoriteButton";

export type ProjectCardData = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string | null;
  status: ProjectStatus;
  tech_stack: string[];
  updated_at: string;
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const Icon = getIcon(project.icon);
  return (
    <Link
      to={`/projects/${project.slug}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg"
          style={{
            background: `color-mix(in oklab, ${project.color ?? "#58a6ff"} 18%, transparent)`,
            color: project.color ?? "#58a6ff",
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <FavoriteButton projectId={project.id} />
      </div>
      <div className="min-w-0">
        <div className="font-semibold leading-tight truncate group-hover:text-primary">{project.name}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {project.tech_stack.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <Badge variant="outline" className={STATUS_CLASS[project.status]}>
          {STATUS_LABEL[project.status]}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{formatDate(project.updated_at)}</span>
      </div>
    </Link>
  );
}
