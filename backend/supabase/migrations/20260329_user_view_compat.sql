-- Compatibility layer for handoff documents that reference table "User".
-- This keeps the existing "users" table as source-of-truth while exposing
-- camelCase columns expected by the handoff contract.

begin;

create or replace view public."User" as
select
  id,
  "companyId",
  email,
  password_hash as "passwordHash",
  name,
  role,
  "managerId",
  created_at as "createdAt",
  updated_at as "updatedAt"
from public.users;

grant select, insert, update, delete on public."User" to service_role;

do $$
begin
  perform public.refresh_postgrest_schema();
exception
  when undefined_function then
    perform pg_notify('pgrst', 'reload schema');
end;
$$;

commit;
