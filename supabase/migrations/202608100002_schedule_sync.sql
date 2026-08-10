create table public.schedules (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  payload jsonb not null default '{"version":1,"currentWeek":"","source":null,"weeks":[]}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_payload_is_object check (jsonb_typeof(payload) = 'object')
);

create trigger schedules_set_updated_at before update on public.schedules
for each row execute function public.set_updated_at();

alter table public.schedules enable row level security;

create policy "Members can read schedules" on public.schedules
for select to authenticated using (public.is_venue_member(venue_id));

create policy "Owners and admins can create schedules" on public.schedules
for insert to authenticated
with check (
  public.has_venue_role(venue_id, array['owner','admin']::public.venue_role[])
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "Owners and admins can update schedules" on public.schedules
for update to authenticated
using (public.has_venue_role(venue_id, array['owner','admin']::public.venue_role[]))
with check (
  public.has_venue_role(venue_id, array['owner','admin']::public.venue_role[])
  and updated_by = auth.uid()
);

create policy "Owners can delete schedules" on public.schedules
for delete to authenticated
using (public.has_venue_role(venue_id, array['owner']::public.venue_role[]));

grant select, insert, update, delete on public.schedules to authenticated;

alter publication supabase_realtime add table public.schedules;
