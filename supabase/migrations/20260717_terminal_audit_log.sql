-- Terminal Audit Log Table
-- Records every mutating terminal command (deploy, rollback, incident create)
-- for accountability, compliance, and the log-stream endpoint.

create table if not exists public.terminal_audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  action        text not null,                       -- e.g. 'deploy', 'rollback', 'incident.create'
  args          jsonb not null default '{}'::jsonb,  -- command arguments
  result_summary text not null default '',           -- one-line outcome
  created_at    timestamptz not null default now()
);

-- Index for fast per-user queries (the log-stream endpoint filters by user)
create index if not exists terminal_audit_log_user_id_idx
  on public.terminal_audit_log (user_id, created_at desc);

-- Row-Level Security
alter table public.terminal_audit_log enable row level security;

-- Users can read only their own audit rows
create policy "Users read own audit rows"
  on public.terminal_audit_log
  for select
  using (auth.uid() = user_id);

-- Authenticated users can insert their own rows
create policy "Users insert own audit rows"
  on public.terminal_audit_log
  for insert
  with check (auth.uid() = user_id);

-- Admins can read all rows
create policy "Admins read all audit rows"
  on public.terminal_audit_log
  for select
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );

comment on table public.terminal_audit_log is
  'Audit trail for all mutating terminal commands (deploy, rollback, incident create).';
