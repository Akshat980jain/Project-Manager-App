-- ============ PROJECT BUILDS ============
CREATE TABLE IF NOT EXISTS public.project_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  exit_code INT,
  log_excerpt TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_builds TO authenticated, anon;
GRANT ALL ON public.project_builds TO service_role;

ALTER TABLE public.project_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_builds public read" ON public.project_builds FOR SELECT USING (true);
CREATE POLICY "project_builds public insert" ON public.project_builds FOR INSERT WITH CHECK (true);
CREATE POLICY "project_builds public update" ON public.project_builds FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "project_builds public delete" ON public.project_builds FOR DELETE USING (true);

-- Enable anonymous writes to activity_events for local companion integration
CREATE POLICY "anon insert activity" ON public.activity_events FOR INSERT TO anon WITH CHECK (true);
