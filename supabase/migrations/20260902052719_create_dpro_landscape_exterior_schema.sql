-- DPRO 造園・外構 G7 SHARED-SUPABASE schema
-- Target project: liff-salon-reserve / cbknucemarcpbscirzyv
-- Isolation boundary: dpro_landscape_exterior schema + landscape_ table prefix.
-- IMPORTANT: Do not alter existing public/other DPRO schemas, tables, or data.
-- No secrets are stored in this file.

create schema if not exists dpro_landscape_exterior;
revoke all on schema dpro_landscape_exterior from public, anon, authenticated;
grant usage on schema dpro_landscape_exterior to service_role;

set search_path = dpro_landscape_exterior, extensions, public;

create table if not exists landscape_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists landscape_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  name text not null,
  phone_normalized text,
  email text,
  line_user_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists landscape_customers_tenant_phone_idx on landscape_customers(tenant_id, phone_normalized) where deleted_at is null;

-- Production Auth access mapping. Authorization comes from this table, never user_metadata.
create table if not exists landscape_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  dpro_role text not null check (dpro_role in ('owner','staff','customer','dpro_admin')),
  customer_id uuid references landscape_customers(id) on delete restrict,
  support_scoped boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((dpro_role = 'customer' and customer_id is not null) or dpro_role <> 'customer')
);
create index if not exists landscape_user_access_tenant_role_idx on landscape_user_access(tenant_id, dpro_role) where active = true;

create table if not exists landscape_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  customer_id uuid not null references landscape_customers(id) on delete restrict,
  name text not null default '施工場所',
  postal_code text,
  address text,
  address_summary text,
  access_note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists landscape_sites_customer_idx on landscape_sites(tenant_id, customer_id) where deleted_at is null;

create table if not exists landscape_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  customer_id uuid not null references landscape_customers(id) on delete restrict,
  site_id uuid not null references landscape_sites(id) on delete restrict,
  title text not null,
  category text not null,
  status text not null default 'inquiry' check (status in ('inquiry','survey_planned','surveyed','estimate_draft','estimate_sent','contracted','scheduled','in_progress','completion_review','completed')),
  desired_timing text,
  customer_request text,
  assigned_staff_ids jsonb not null default '[]'::jsonb,
  next_action text,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists landscape_cases_tenant_status_idx on landscape_cases(tenant_id, status, updated_at desc) where deleted_at is null;
create index if not exists landscape_cases_customer_idx on landscape_cases(tenant_id, customer_id, updated_at desc) where deleted_at is null;

create table if not exists landscape_inquiries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references landscape_tenants(id) on delete restrict,
  case_id uuid references landscape_cases(id) on delete set null,
  source text not null default 'web',
  contact_name text,
  phone_normalized text,
  external_user_ref text,
  attachment_paths jsonb not null default '[]'::jsonb,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists landscape_photo_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  name text not null,
  required_before boolean not null default true,
  required_after boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists landscape_photo_points_case_idx on landscape_photo_points(tenant_id, case_id, sort_order);

create table if not exists landscape_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  photo_point_id uuid references landscape_photo_points(id) on delete set null,
  phase text not null check (phase in ('inquiry','survey','before','progress','after')),
  storage_path text not null,
  thumbnail_path text,
  caption text,
  shared_with_customer boolean not null default false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists landscape_photos_case_phase_idx on landscape_photos(tenant_id, case_id, phase) where deleted_at is null;

create table if not exists landscape_surveys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  staff_id uuid,
  summary text,
  measurements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists landscape_estimates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  version_no integer not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','returned','superseded','cancelled')),
  total_yen bigint not null default 0 check (total_yen >= 0),
  customer_note text,
  response_note text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(case_id, version_no)
);

create table if not exists landscape_estimate_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  estimate_id uuid not null references landscape_estimates(id) on delete cascade,
  item_name text not null,
  qty numeric(12,2) not null default 1,
  unit text,
  amount_yen bigint not null default 0 check (amount_yen >= 0),
  evidence_photo_point_id uuid references landscape_photo_points(id) on delete set null,
  sort_order integer not null default 0
);

create table if not exists landscape_schedule_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  type text not null check (type in ('survey','work','visit','followup')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('tentative','confirmed','reschedule_requested','cancelled','completed')),
  staff_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists landscape_schedule_tenant_time_idx on landscape_schedule_events(tenant_id, start_at, end_at);

create table if not exists landscape_work_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  staff_id uuid,
  progress integer not null default 0 check (progress between 0 and 100),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists landscape_issues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  severity text not null default 'normal' check (severity in ('low','normal','high','safety')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','cancelled')),
  title text not null,
  detail text,
  reported_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists landscape_completion_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','pending','approved','returned')),
  requested_at timestamptz,
  responded_at timestamptz,
  response_note text,
  unique(case_id)
);

create table if not exists landscape_followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid not null references landscape_cases(id) on delete restrict,
  category text not null,
  candidate_date date not null,
  status text not null default 'candidate' check (status in ('candidate','approved','notified','booked','done','dismissed')),
  owner_approved boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists landscape_followups_due_idx on landscape_followups(tenant_id, candidate_date, status);

create table if not exists landscape_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  case_id uuid references landscape_cases(id) on delete set null,
  channel text not null check (channel in ('line','email','web')),
  event_key text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  recipient_ref text,
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, event_key)
);

create table if not exists landscape_integration_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  provider text not null check (provider in ('line','storage','webhook')),
  external_event_id text not null,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, external_event_id)
);
create index if not exists landscape_integration_events_tenant_time_idx on landscape_integration_events(tenant_id, created_at desc);

create table if not exists landscape_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references landscape_tenants(id) on delete restrict,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists landscape_audit_tenant_time_idx on landscape_audit_events(tenant_id, created_at desc);

-- Defense in depth. The Worker uses a server-side service role after enforcing role + tenant scope.
-- No anon/authenticated direct-table policies are created in G4.
alter table landscape_tenants enable row level security;
alter table landscape_user_access enable row level security;
alter table landscape_customers enable row level security;
alter table landscape_sites enable row level security;
alter table landscape_cases enable row level security;
alter table landscape_inquiries enable row level security;
alter table landscape_photo_points enable row level security;
alter table landscape_photos enable row level security;
alter table landscape_surveys enable row level security;
alter table landscape_estimates enable row level security;
alter table landscape_estimate_items enable row level security;
alter table landscape_schedule_events enable row level security;
alter table landscape_work_logs enable row level security;
alter table landscape_issues enable row level security;
alter table landscape_completion_approvals enable row level security;
alter table landscape_followups enable row level security;
alter table landscape_notifications enable row level security;
alter table landscape_integration_events enable row level security;
alter table landscape_audit_events enable row level security;

-- Private photo bucket. Worker server secret creates signed upload/download URLs after role + case scope validation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dpro-landscape-exterior-private', 'dpro-landscape-exterior-private', false, 12582912, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=12582912, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- No anon/authenticated object policies are granted. Public clients never receive the server secret.
-- Signed upload/download URLs are generated by the Worker only after authorization.

-- Server-side Worker only. No direct anon/authenticated table access.
revoke all on all tables in schema dpro_landscape_exterior from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema dpro_landscape_exterior to service_role;
revoke all on all sequences in schema dpro_landscape_exterior from public, anon, authenticated;
grant usage, select on all sequences in schema dpro_landscape_exterior to service_role;
alter default privileges for role postgres in schema dpro_landscape_exterior revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema dpro_landscape_exterior grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema dpro_landscape_exterior revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema dpro_landscape_exterior grant usage, select on sequences to service_role;
