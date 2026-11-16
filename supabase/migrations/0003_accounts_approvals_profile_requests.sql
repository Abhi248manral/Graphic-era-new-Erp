-- ============================================================
-- CampusIQ · Missing Tables: accounts, approvals, profile_requests
-- ============================================================

-- ------------------------------------------------------------
-- accounts: Application user accounts for multi-role portal
-- ------------------------------------------------------------
create table if not exists public.accounts (
  id serial primary key,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  role text not null default 'student',
  student_id text,
  program text,
  semester integer,
  department text,
  institution text,
  status text not null default 'pending_approval' check (status in ('active', 'pending_approval', 'rejected', 'suspended')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_email_idx on public.accounts(email);
create index if not exists accounts_role_idx on public.accounts(role);
create index if not exists accounts_status_idx on public.accounts(status);

alter table public.accounts enable row level security;

drop policy if exists accounts_read on public.accounts;
create policy accounts_read on public.accounts
  for select using (
    public.is_admin()
    or email = (select email from public.profiles where id = auth.uid())
  );

drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts
  for insert with check (true);

drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts
  for update using (
    public.is_admin()
    or email = (select email from public.profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- approvals: Workflow audit trail and step transitions
-- ------------------------------------------------------------
create table if not exists public.approvals (
  id serial primary key,
  workflow_id integer references public.workflows(id) on delete cascade,
  action text not null check (action in ('submitted', 'approved', 'rejected', 'comment')),
  reason text,
  actor text not null,
  actor_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists approvals_workflow_idx on public.approvals(workflow_id);

alter table public.approvals enable row level security;

drop policy if exists approvals_read on public.approvals;
create policy approvals_read on public.approvals
  for select using (auth.role() = 'authenticated');

drop policy if exists approvals_write on public.approvals;
create policy approvals_write on public.approvals
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- profile_requests: Self-service profile change and registration requests
-- ------------------------------------------------------------
create table if not exists public.profile_requests (
  id serial primary key,
  user_email text not null,
  user_name text not null,
  role text not null,
  changes jsonb not null default '{}'::jsonb,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_name text,
  reviewer_comment text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists profile_requests_email_idx on public.profile_requests(user_email);
create index if not exists profile_requests_status_idx on public.profile_requests(status);

alter table public.profile_requests enable row level security;

drop policy if exists profile_requests_read on public.profile_requests;
create policy profile_requests_read on public.profile_requests
  for select using (
    public.is_admin()
    or user_email = (select email from public.profiles where id = auth.uid())
  );

drop policy if exists profile_requests_insert on public.profile_requests;
create policy profile_requests_insert on public.profile_requests
  for insert with check (true);

drop policy if exists profile_requests_update on public.profile_requests;
create policy profile_requests_update on public.profile_requests
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists profile_requests_delete on public.profile_requests;
create policy profile_requests_delete on public.profile_requests
  for delete using (public.is_admin());

