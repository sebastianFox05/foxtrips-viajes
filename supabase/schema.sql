-- ============================================================================
-- FoxTrips · Esquema de base de datos para Supabase
-- Pegalo entero en Supabase → SQL Editor → New query → Run.
-- Crea tablas, seguridad por filas (RLS), funciones, tiempo real y almacenamiento.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Perfiles (uno por usuario de Auth)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Viajero',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Viajes, miembros e invitaciones
-- ----------------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  description text,
  start_date date,
  end_date date,
  currency text default 'USD',
  lat double precision,
  lon double precision,
  cover_url text,
  public_token text unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.invites (
  code text primary key,
  trip_id uuid not null references public.trips on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

-- ----------------------------------------------------------------------------
-- 3. Contenido de cada viaje
-- ----------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  day date,
  time text,
  title text not null,
  place text,
  notes text,
  lat double precision,
  lon double precision,
  image_url text,
  image_thumb text,
  image_credit text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  url text not null,
  thumb_url text,
  storage_path text,
  provider text,
  caption text,
  credit text,
  source_url text,
  day date,
  activity_id uuid references public.activities on delete set null,
  uploaded_by uuid,
  uploader_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  target_type text not null check (target_type in ('activity', 'photo')),
  target_id uuid not null,
  body text not null,
  author_id uuid not null default auth.uid(),
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  title text not null,
  description text,
  day date,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  author_id uuid not null default auth.uid(),
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, trip_id)
);

-- El voto debe ser de una propuesta del MISMO viaje (clave foranea compuesta)
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  proposal_id uuid not null,
  user_id uuid not null default auth.uid(),
  value int not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, user_id),
  foreign key (proposal_id, trip_id) references public.proposals (id, trip_id) on delete cascade
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  name text not null,
  kind text,
  size bigint,
  storage_path text,
  url text,
  uploaded_by uuid,
  uploader_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  text text not null,
  is_shared boolean not null default true,
  is_done boolean not null default false,
  owner_id uuid not null default auth.uid(),
  assignee_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  day date not null,
  body text,
  author_id uuid,
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  actor_id uuid,
  actor_name text,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists activities_trip_idx on public.activities (trip_id);
create index if not exists photos_trip_idx on public.photos (trip_id);
create index if not exists comments_trip_idx on public.comments (trip_id);
create index if not exists log_trip_idx on public.activity_log (trip_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Funciones de permisos (security definer para evitar recursion en RLS)
-- ----------------------------------------------------------------------------
create or replace function public.trip_role(t uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.trip_members where trip_id = t and user_id = auth.uid()
$$;

create or replace function public.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.trip_role(t) is not null
$$;

create or replace function public.can_edit(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.trip_role(t) in ('owner', 'editor'), false)
$$;

create or replace function public.is_owner(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.trip_role(t) = 'owner', false)
$$;

-- El comentario debe apuntar a una actividad o foto del mismo viaje
create or replace function public.target_in_trip(kind text, target uuid, t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case kind
    when 'activity' then exists (select 1 from public.activities where id = target and trip_id = t)
    when 'photo' then exists (select 1 from public.photos where id = target and trip_id = t)
    else false end
$$;

-- Id del viaje a partir de la ruta "<trip_id>/archivo" (null si no es un uuid)
create or replace function public.folder_trip(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return ((storage.foldername(object_name))[1])::uuid;
exception when others then
  return null;
end $$;

-- Solo el organizador publica el viaje o cambia su creador; ademas mantiene updated_at
create or replace function public.protect_trip_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.public_token is distinct from old.public_token or new.created_by is distinct from old.created_by)
     and not public.is_owner(old.id) then
    raise exception 'Solo el organizador puede cambiar la página pública';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trips_protect on public.trips;
create trigger trips_protect before update on public.trips
  for each row execute function public.protect_trip_fields();

-- ----------------------------------------------------------------------------
-- 5. Seguridad por filas (RLS)
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.invites enable row level security;
alter table public.activities enable row level security;
alter table public.photos enable row level security;
alter table public.comments enable row level security;
alter table public.proposals enable row level security;
alter table public.votes enable row level security;
alter table public.documents enable row level security;
alter table public.checklist_items enable row level security;
alter table public.diary_entries enable row level security;
alter table public.activity_log enable row level security;

-- Para poder ejecutar el script mas de una vez: borra las politicas de las tablas de FoxTrips
do $$
declare
  policy record;
begin
  for policy in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'trips', 'trip_members', 'invites', 'activities', 'photos',
      'comments', 'proposals', 'votes', 'documents', 'checklist_items', 'diary_entries', 'activity_log')
  loop
    execute format('drop policy %I on public.%I', policy.policyname, policy.tablename);
  end loop;
end $$;

-- Perfiles: te ves a ti y a quien viaja contigo
create policy "profiles_select" on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.trip_members mine join public.trip_members theirs on mine.trip_id = theirs.trip_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id)
);
create policy "profiles_update" on public.profiles for update to authenticated using (id = auth.uid());

-- Viajes (se crean con create_trip; public_token y created_by los protege el trigger)
create policy "trips_select" on public.trips for select to authenticated using (public.is_member(id));
create policy "trips_update" on public.trips for update to authenticated using (public.can_edit(id)) with check (public.can_edit(id));
create policy "trips_delete" on public.trips for delete to authenticated using (public.is_owner(id));

-- Miembros (se añaden con join_trip)
create policy "members_select" on public.trip_members for select to authenticated using (public.is_member(trip_id));
create policy "members_update" on public.trip_members for update to authenticated using (public.is_owner(trip_id));
create policy "members_delete" on public.trip_members for delete to authenticated
  using (public.is_owner(trip_id) or user_id = auth.uid());

-- Invitaciones: caducan a los 14 dias y el organizador puede revocarlas
create policy "invites_select" on public.invites for select to authenticated using (public.can_edit(trip_id));
create policy "invites_insert" on public.invites for insert to authenticated
  with check (public.can_edit(trip_id) and created_by = auth.uid());
create policy "invites_delete" on public.invites for delete to authenticated using (public.is_owner(trip_id));

-- Tablas que solo editan organizadores y editores
create policy "activities_select" on public.activities for select to authenticated using (public.is_member(trip_id));
create policy "activities_write" on public.activities for all to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));

create policy "photos_select" on public.photos for select to authenticated using (public.is_member(trip_id));
create policy "photos_write" on public.photos for all to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));

create policy "documents_select" on public.documents for select to authenticated using (public.is_member(trip_id));
create policy "documents_write" on public.documents for all to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));

create policy "diary_select" on public.diary_entries for select to authenticated using (public.is_member(trip_id));
create policy "diary_write" on public.diary_entries for all to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));

-- Comentarios: cualquier miembro (tambien lectores), siempre sobre algo del mismo viaje
create policy "comments_select" on public.comments for select to authenticated using (public.is_member(trip_id));
create policy "comments_insert" on public.comments for insert to authenticated
  with check (public.is_member(trip_id) and author_id = auth.uid() and public.target_in_trip(target_type, target_id, trip_id));
create policy "comments_delete" on public.comments for delete to authenticated
  using (public.is_member(trip_id) and (author_id = auth.uid() or public.is_owner(trip_id)));

-- Propuestas: cualquiera propone, los editores aceptan o descartan
create policy "proposals_select" on public.proposals for select to authenticated using (public.is_member(trip_id));
create policy "proposals_insert" on public.proposals for insert to authenticated
  with check (public.is_member(trip_id) and author_id = auth.uid());
create policy "proposals_update" on public.proposals for update to authenticated
  using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));
create policy "proposals_delete" on public.proposals for delete to authenticated
  using (public.is_member(trip_id) and (author_id = auth.uid() or public.is_owner(trip_id)));

-- Votos: uno por persona y propuesta, solo mientras sigues en el viaje
create policy "votes_select" on public.votes for select to authenticated using (public.is_member(trip_id));
create policy "votes_insert" on public.votes for insert to authenticated with check (public.is_member(trip_id) and user_id = auth.uid());
create policy "votes_update" on public.votes for update to authenticated
  using (public.is_member(trip_id) and user_id = auth.uid()) with check (public.is_member(trip_id) and user_id = auth.uid());
create policy "votes_delete" on public.votes for delete to authenticated using (public.is_member(trip_id) and user_id = auth.uid());

-- Equipaje: lo comun lo editan los editores; lo personal solo su dueño (y solo el lo ve)
create policy "checklist_select" on public.checklist_items for select to authenticated
  using (public.is_member(trip_id) and (is_shared or owner_id = auth.uid()));
create policy "checklist_insert" on public.checklist_items for insert to authenticated
  with check (public.is_member(trip_id) and owner_id = auth.uid() and (not is_shared or public.can_edit(trip_id)));
create policy "checklist_update" on public.checklist_items for update to authenticated
  using (public.is_member(trip_id) and ((is_shared and public.can_edit(trip_id)) or (not is_shared and owner_id = auth.uid())));
create policy "checklist_delete" on public.checklist_items for delete to authenticated
  using (public.is_member(trip_id) and ((is_shared and public.can_edit(trip_id)) or (not is_shared and owner_id = auth.uid())));

-- Historial
create policy "log_select" on public.activity_log for select to authenticated using (public.is_member(trip_id));
create policy "log_insert" on public.activity_log for insert to authenticated
  with check (public.is_member(trip_id) and actor_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. Funciones llamadas desde la app
-- ----------------------------------------------------------------------------
create or replace function public.create_trip(trip jsonb)
returns public.trips language plpgsql security definer set search_path = public as $$
declare
  new_trip public.trips;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  insert into public.trips (name, destination, description, start_date, end_date, currency, lat, lon, cover_url, created_by)
  values (
    trip ->> 'name', trip ->> 'destination', trip ->> 'description',
    nullif(trip ->> 'start_date', '')::date, nullif(trip ->> 'end_date', '')::date,
    coalesce(trip ->> 'currency', 'USD'),
    (trip ->> 'lat')::double precision, (trip ->> 'lon')::double precision,
    trip ->> 'cover_url', auth.uid())
  returning * into new_trip;
  insert into public.trip_members (trip_id, user_id, role) values (new_trip.id, auth.uid(), 'owner');
  insert into public.activity_log (trip_id, actor_id, actor_name, text)
    select new_trip.id, auth.uid(), display_name, 'creó el viaje "' || new_trip.name || '"' from public.profiles where id = auth.uid();
  return new_trip;
end $$;

create or replace function public.join_trip(invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  invite public.invites;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into invite from public.invites where code = invite_code and expires_at > now();
  if not found then raise exception 'La invitación no existe o ha caducado.'; end if;
  insert into public.trip_members (trip_id, user_id, role)
    values (invite.trip_id, auth.uid(), invite.role)
    on conflict (trip_id, user_id) do nothing;
  if found then
    insert into public.activity_log (trip_id, actor_id, actor_name, text)
      select invite.trip_id, auth.uid(), display_name, 'se unió al viaje' from public.profiles where id = auth.uid();
  end if;
  return invite.trip_id;
end $$;

-- Pagina publica: solo si el viaje tiene public_token (no necesita cuenta).
-- Devuelve solo las columnas que se muestran (sin ids de usuarios ni rutas de almacenamiento).
create or replace function public.get_public_trip(token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'trip', json_build_object('id', t.id, 'name', t.name, 'destination', t.destination, 'description', t.description,
                              'start_date', t.start_date, 'end_date', t.end_date, 'cover_url', t.cover_url),
    'activities', coalesce((
      select json_agg(json_build_object('id', a.id, 'day', a.day, 'time', a.time, 'title', a.title, 'place', a.place,
                                        'notes', a.notes, 'image_url', a.image_url, 'image_thumb', a.image_thumb,
                                        'image_credit', a.image_credit, 'created_at', a.created_at))
      from public.activities a where a.trip_id = t.id), '[]'::json),
    'photos', coalesce((
      select json_agg(json_build_object('id', p.id, 'url', p.url, 'thumb_url', p.thumb_url, 'caption', p.caption,
                                        'credit', p.credit, 'source_url', p.source_url, 'day', p.day,
                                        'uploader_name', p.uploader_name) order by p.created_at desc)
      from public.photos p where p.trip_id = t.id), '[]'::json)
  )
  from public.trips t
  where token is not null and t.public_token = token
$$;

grant execute on function public.create_trip(jsonb) to authenticated;
grant execute on function public.join_trip(text) to authenticated;
grant execute on function public.get_public_trip(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Tiempo real (cambios en vivo para todo el grupo)
-- ----------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  foreach table_name in array array['trips', 'trip_members', 'activities', 'photos', 'comments', 'proposals', 'votes',
                                    'documents', 'checklist_items', 'diary_entries']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then
      null; -- ya estaba en la publicacion
    end;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 8. Almacenamiento: fotos (lectura publica por URL) y documentos (privado)
-- La primera carpeta de la ruta es siempre el id del viaje: <trip_id>/<archivo>
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

drop policy if exists "photos_read" on storage.objects;
drop policy if exists "photos_upload" on storage.objects;
drop policy if exists "photos_delete_own" on storage.objects;
drop policy if exists "photos_delete" on storage.objects;
drop policy if exists "documents_read" on storage.objects;
drop policy if exists "documents_upload" on storage.objects;
drop policy if exists "documents_delete" on storage.objects;

-- Sin politica de lectura en "photos": el bucket publico sirve cada foto por su URL,
-- pero nadie puede listar el contenido del bucket.
create policy "photos_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.can_edit(public.folder_trip(name)));
create policy "photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.can_edit(public.folder_trip(name)));

create policy "documents_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member(public.folder_trip(name)));
create policy "documents_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_edit(public.folder_trip(name)));
create policy "documents_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_edit(public.folder_trip(name)));
