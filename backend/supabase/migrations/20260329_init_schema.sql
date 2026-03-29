-- Supabase bootstrap migration for the NestJS expense backend.
-- Run this in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

-- Companies
create table if not exists public."Company" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency char(3) not null,
  country text,
  "createdAt" timestamptz not null default now(),
  constraint company_currency_upper_chk check (currency = upper(currency))
);

-- Users (auth managed by backend, not Supabase Auth)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  role text not null default 'EMPLOYEE',
  "companyId" uuid references public."Company" (id) on delete set null,
  "managerId" uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_chk check (role in ('ADMIN', 'MANAGER', 'EMPLOYEE'))
);

-- Expenses
create table if not exists public."Expense" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.users (id) on delete cascade,
  amount numeric(14, 2) not null,
  currency char(3) not null,
  "convertedAmount" numeric(14, 2) not null,
  "companyCurrency" char(3) not null,
  category text not null,
  description text not null,
  date timestamptz not null,
  "receiptUrl" text,
  status text not null default 'PENDING',
  "currentStep" integer not null default 0,
  "currentApproverId" uuid references public.users (id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint expense_amount_positive_chk check (amount > 0),
  constraint expense_converted_amount_nonnegative_chk check ("convertedAmount" >= 0),
  constraint expense_currency_upper_chk check (currency = upper(currency)),
  constraint expense_company_currency_upper_chk check ("companyCurrency" = upper("companyCurrency")),
  constraint expense_status_chk check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  constraint expense_current_step_chk check ("currentStep" >= 0),
  constraint expense_category_chk check (
    category in ('Travel', 'Food', 'Accommodation', 'Equipment', 'Other')
  )
);

-- Approval rules
create table if not exists public."ApprovalRule" (
  id uuid primary key default gen_random_uuid(),
  "companyId" uuid not null references public."Company" (id) on delete cascade,
  name text not null,
  type text not null,
  "percentageThreshold" numeric(5, 2),
  "specificApproverId" uuid references public.users (id) on delete set null,
  "createdAt" timestamptz not null default now(),
  constraint approval_rule_type_chk check (type in ('SEQUENTIAL', 'CONDITIONAL', 'HYBRID')),
  constraint approval_rule_percentage_threshold_chk check (
    "percentageThreshold" is null
    or ("percentageThreshold" >= 0 and "percentageThreshold" <= 100)
  )
);

-- Approval steps
create table if not exists public."ApprovalStep" (
  id uuid primary key default gen_random_uuid(),
  "ruleId" uuid not null references public."ApprovalRule" (id) on delete cascade,
  "approverId" uuid not null references public.users (id) on delete restrict,
  sequence integer not null,
  "isManagerApprover" boolean not null default false,
  constraint approval_step_sequence_chk check (sequence >= 0),
  constraint approval_step_rule_sequence_uniq unique ("ruleId", sequence)
);

-- Approval audit log
create table if not exists public."ApprovalLog" (
  id uuid primary key default gen_random_uuid(),
  "expenseId" uuid not null references public."Expense" (id) on delete cascade,
  "approverId" uuid not null references public.users (id) on delete restrict,
  action text not null,
  comment text,
  "stepSequence" integer not null,
  "timestamp" timestamptz not null default now(),
  constraint approval_log_action_chk check (action in ('APPROVED', 'REJECTED'))
);

-- Performance indexes
create index if not exists users_company_idx on public.users ("companyId");
create index if not exists users_manager_idx on public.users ("managerId");
create unique index if not exists company_name_unique_idx on public."Company" (lower(name));

create index if not exists expense_user_idx on public."Expense" ("userId");
create index if not exists expense_status_idx on public."Expense" (status);
create index if not exists expense_current_approver_idx on public."Expense" ("currentApproverId");
create index if not exists expense_created_at_idx on public."Expense" ("createdAt");

create index if not exists approval_rule_company_idx on public."ApprovalRule" ("companyId");
create index if not exists approval_step_rule_idx on public."ApprovalStep" ("ruleId");
create index if not exists approval_step_approver_idx on public."ApprovalStep" ("approverId");

create index if not exists approval_log_expense_idx on public."ApprovalLog" ("expenseId");
create index if not exists approval_log_approver_idx on public."ApprovalLog" ("approverId");
create index if not exists approval_log_action_idx on public."ApprovalLog" (action);

-- Keep API simple for backend usage via service_role.
alter table public.users disable row level security;
alter table public."Company" disable row level security;
alter table public."Expense" disable row level security;
alter table public."ApprovalRule" disable row level security;
alter table public."ApprovalStep" disable row level security;
alter table public."ApprovalLog" disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- Trigger functions to maintain updated timestamps.
create or replace function public.set_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_expense_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_users_updated_at();

drop trigger if exists expense_set_updated_at on public."Expense";
create trigger expense_set_updated_at
before update on public."Expense"
for each row
execute function public.set_expense_updated_at();

-- Helper function to force PostgREST schema cache reload.
create or replace function public.refresh_postgrest_schema()
returns void
language plpgsql
security definer
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
end;
$$;

-- Optional helper: bootstrap demo tenant and users.
-- Example: select * from public.bootstrap_demo_data('example.com', 'demo123');
create or replace function public.bootstrap_demo_data(
  p_domain text default 'demo.com',
  p_password text default 'demo123'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_company_name text;
  v_company_id uuid;
  v_admin_id uuid;
  v_manager_id uuid;
  v_employee_id uuid;
  v_rule_id uuid;
begin
  if position('@' in p_domain) > 0 then
    raise exception 'Pass only domain like "demo.com", not an email';
  end if;

  v_company_name := initcap(split_part(p_domain, '.', 1));

  insert into public."Company" (name, currency)
  values (v_company_name, 'USD')
  on conflict do nothing;

  select id into v_company_id
  from public."Company"
  where lower(name) = lower(v_company_name)
  order by "createdAt" asc
  limit 1;

  insert into public.users (email, password_hash, name, role, "companyId")
  values ('admin@' || p_domain, crypt(p_password, gen_salt('bf')), 'Admin', 'ADMIN', v_company_id)
  on conflict (email) do update
    set role = excluded.role,
        "companyId" = excluded."companyId"
  returning id into v_admin_id;

  insert into public.users (email, password_hash, name, role, "companyId", "managerId")
  values ('manager@' || p_domain, crypt(p_password, gen_salt('bf')), 'Manager', 'MANAGER', v_company_id, v_admin_id)
  on conflict (email) do update
    set role = excluded.role,
        "companyId" = excluded."companyId",
        "managerId" = excluded."managerId"
  returning id into v_manager_id;

  insert into public.users (email, password_hash, name, role, "companyId", "managerId")
  values ('employee@' || p_domain, crypt(p_password, gen_salt('bf')), 'Employee', 'EMPLOYEE', v_company_id, v_manager_id)
  on conflict (email) do update
    set role = excluded.role,
        "companyId" = excluded."companyId",
        "managerId" = excluded."managerId"
  returning id into v_employee_id;

  if not exists (
    select 1
    from public."ApprovalRule"
    where "companyId" = v_company_id
      and name = 'Default 2-Step Approval'
  ) then
    insert into public."ApprovalRule" ("companyId", name, type)
    values (v_company_id, 'Default 2-Step Approval', 'SEQUENTIAL')
    returning id into v_rule_id;

    insert into public."ApprovalStep" ("ruleId", "approverId", sequence, "isManagerApprover")
    values
      (v_rule_id, v_manager_id, 0, false),
      (v_rule_id, v_admin_id, 1, false);
  end if;

  return jsonb_build_object(
    'companyId', v_company_id,
    'adminEmail', 'admin@' || p_domain,
    'managerEmail', 'manager@' || p_domain,
    'employeeEmail', 'employee@' || p_domain,
    'password', p_password
  );
end;
$$;

grant execute on function public.refresh_postgrest_schema() to service_role;
grant execute on function public.bootstrap_demo_data(text, text) to service_role;

select public.refresh_postgrest_schema();

commit;
