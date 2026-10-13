-- Schema for Job Crawler VN (Supabase / Postgres)

create table if not exists public.jobs (
  id text primary key,
  title text not null,
  company text not null,
  city text,
  level text,
  exp_min integer,
  exp_max integer,
  salary_min numeric,
  salary_max numeric,
  currency text,
  negotiable boolean not null default false,
  remote text,
  skills text[] not null default '{}',
  sources jsonb not null default '[]'::jsonb,
  description text not null default '',
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  matched boolean not null default false,
  status text not null default 'new'
);

create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_matched on public.jobs(matched);
create index if not exists idx_jobs_posted_at on public.jobs(posted_at desc);

create table if not exists public.quota (
  source text primary key,
  month text not null,
  used integer not null default 0,
  updated_at timestamptz not null default now()
);
