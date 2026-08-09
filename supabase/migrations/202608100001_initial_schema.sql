create extension if not exists pgcrypto;

create type public.venue_role as enum ('owner', 'admin', 'employee');
create type public.employee_status as enum ('active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.venue_members (
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.venue_role not null default 'employee',
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create table public.employees (
  id text primary key,
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  position text not null check (char_length(trim(position)) > 0),
  phone text not null default '',
  status public.employee_status not null default 'active',
  rate numeric(12,2) not null default 0 check (rate >= 0),
  start_date date,
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employees_venue_id_idx on public.employees(venue_id);
create index venue_members_user_id_idx on public.venue_members(user_id);

create or replace function public.is_venue_member(target_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venue_members
    where venue_id = target_venue_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_venue_role(target_venue_id uuid, allowed_roles public.venue_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venue_members
    where venue_id = target_venue_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger venues_set_updated_at before update on public.venues
for each row execute function public.set_updated_at();
create trigger employees_set_updated_at before update on public.employees
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_venue_id uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''));

  insert into public.venues (name, created_by)
  values ('Моё заведение', new.id)
  returning id into default_venue_id;

  insert into public.venue_members (venue_id, user_id, role)
  values (default_venue_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.employees enable row level security;

create policy "Users can read own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "Users can update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read venues" on public.venues
for select to authenticated using (public.is_venue_member(id));
create policy "Owners and admins can update venues" on public.venues
for update to authenticated
using (public.has_venue_role(id, array['owner','admin']::public.venue_role[]))
with check (public.has_venue_role(id, array['owner','admin']::public.venue_role[]));

create policy "Members can read memberships" on public.venue_members
for select to authenticated using (public.is_venue_member(venue_id));
create policy "Owners can manage memberships" on public.venue_members
for all to authenticated
using (public.has_venue_role(venue_id, array['owner']::public.venue_role[]))
with check (public.has_venue_role(venue_id, array['owner']::public.venue_role[]));

create policy "Members can read employees" on public.employees
for select to authenticated using (public.is_venue_member(venue_id));
create policy "Owners and admins can create employees" on public.employees
for insert to authenticated
with check (public.has_venue_role(venue_id, array['owner','admin']::public.venue_role[]));
create policy "Owners and admins can update employees" on public.employees
for update to authenticated
using (public.has_venue_role(venue_id, array['owner','admin']::public.venue_role[]))
with check (public.has_venue_role(venue_id, array['owner','admin']::public.venue_role[]));
create policy "Owners and admins can delete employees" on public.employees
for delete to authenticated
using (public.has_venue_role(venue_id, array['owner','admin']::public.venue_role[]));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.venues to authenticated;
grant select, insert, update, delete on public.venue_members to authenticated;
grant select, insert, update, delete on public.employees to authenticated;

alter publication supabase_realtime add table public.employees;
