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

-- Foto de perfil (URL de Cloudinary o Supabase Storage). Añadida el 5 nov 2026; el script se puede volver a ejecutar.
alter table public.profiles add column if not exists avatar_url text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_url_https') then
    alter table public.profiles add constraint profiles_avatar_url_https check (avatar_url is null or avatar_url like 'https://%');
  end if;
end $$;

-- Correos con dominio completo (nombre@gmail.com). Añadida el 7 nov 2026 (migracion validate_user_email).
-- Bloquea registros y cambios de correo incompletos, tambien si alguien llama a Supabase sin pasar por la app.
-- Las cuentas que ya existian no se tocan (solo se comprueba al crear la cuenta o al cambiar el correo).
create or replace function public.validate_user_email()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.email is not null
     and (tg_op = 'INSERT' or new.email is distinct from old.email)
     and new.email !~* '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)*\.[a-z]{2,}$' then
    raise exception 'invalid_email_domain: el correo debe tener un dominio completo (por ejemplo nombre@gmail.com)'
      using errcode = '22023';
  end if;
  return new;
end $$;

revoke execute on function public.validate_user_email() from public, anon, authenticated;

drop trigger if exists validate_email_before_write on auth.users;
create trigger validate_email_before_write
  before insert or update of email on auth.users
  for each row execute function public.validate_user_email();

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

-- Orden manual de los planes dentro de un dia (para los que no tienen hora). Añadida el 9 nov 2026.
alter table public.activities add column if not exists sort_order integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'activities_sort_order_range') then
    alter table public.activities add constraint activities_sort_order_range check (sort_order is null or sort_order between 0 and 100000);
  end if;
end $$;

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

-- Indices para las claves foraneas (aviso unindexed_foreign_keys del asesor de Supabase)
create index if not exists checklist_items_trip_idx on public.checklist_items (trip_id);
create index if not exists documents_trip_idx on public.documents (trip_id);
create index if not exists invites_trip_idx on public.invites (trip_id);
create index if not exists invites_created_by_idx on public.invites (created_by);
create index if not exists photos_activity_idx on public.photos (activity_id);
create index if not exists proposals_trip_idx on public.proposals (trip_id);
create index if not exists trip_members_user_idx on public.trip_members (user_id);
create index if not exists trips_created_by_idx on public.trips (created_by);
create index if not exists votes_trip_idx on public.votes (trip_id);
create index if not exists votes_proposal_trip_idx on public.votes (proposal_id, trip_id);

-- Limites de longitud en los textos libres (se añaden solo si no existen)
do $$
declare
  c record;
begin
  for c in select * from (values
    ('profiles',        'profiles_display_name_len',  'char_length(display_name) <= 80'),
    ('trips',           'trips_name_len',             'char_length(name) <= 120'),
    ('trips',           'trips_destination_len',      'char_length(destination) <= 200'),
    ('trips',           'trips_description_len',      'char_length(description) <= 5000'),
    ('activities',      'activities_title_len',       'char_length(title) <= 200'),
    ('activities',      'activities_place_len',       'char_length(place) <= 300'),
    ('activities',      'activities_notes_len',       'char_length(notes) <= 5000'),
    ('photos',          'photos_caption_len',         'char_length(caption) <= 1000'),
    ('comments',        'comments_body_len',          'char_length(body) <= 2000'),
    ('proposals',       'proposals_title_len',        'char_length(title) <= 200'),
    ('proposals',       'proposals_description_len',  'char_length(description) <= 2000'),
    ('documents',       'documents_name_len',         'char_length(name) <= 255'),
    ('checklist_items', 'checklist_items_text_len',   'char_length(text) <= 300'),
    ('diary_entries',   'diary_entries_body_len',     'char_length(body) <= 20000')
  ) as t(tbl, name, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table public.%I add constraint %I check (%s)', c.tbl, c.name, c.expr);
    end if;
  end loop;
end $$;

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
returns uuid language plpgsql immutable set search_path = public as $$
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

-- auth.uid() va siempre como (select auth.uid()) para que se calcule una vez por consulta y no por fila.

-- Perfiles: te ves a ti y a quien viaja contigo
create policy "profiles_select" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.trip_members mine join public.trip_members theirs on mine.trip_id = theirs.trip_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id)
);
create policy "profiles_update" on public.profiles for update to authenticated using (id = (select auth.uid()));

-- Viajes (se crean con create_trip; public_token y created_by los protege el trigger)
create policy "trips_select" on public.trips for select to authenticated using (public.is_member(id));
create policy "trips_update" on public.trips for update to authenticated using (public.can_edit(id)) with check (public.can_edit(id));
create policy "trips_delete" on public.trips for delete to authenticated using (public.is_owner(id));

-- Miembros (se añaden con join_trip)
create policy "members_select" on public.trip_members for select to authenticated using (public.is_member(trip_id));
create policy "members_update" on public.trip_members for update to authenticated using (public.is_owner(trip_id));
create policy "members_delete" on public.trip_members for delete to authenticated
  using (public.is_owner(trip_id) or user_id = (select auth.uid()));

-- Invitaciones: caducan a los 14 dias y el organizador puede revocarlas
create policy "invites_select" on public.invites for select to authenticated using (public.can_edit(trip_id));
create policy "invites_insert" on public.invites for insert to authenticated
  with check (public.can_edit(trip_id) and created_by = (select auth.uid()));
create policy "invites_delete" on public.invites for delete to authenticated using (public.is_owner(trip_id));

-- Tablas que solo editan organizadores y editores. Lectura: cualquier miembro (*_select);
-- escritura: una politica por accion (sin "for all", para no duplicar el SELECT; can_edit implica is_member).
create policy "activities_select" on public.activities for select to authenticated using (public.is_member(trip_id));
create policy "activities_insert" on public.activities for insert to authenticated with check (public.can_edit(trip_id));
create policy "activities_update" on public.activities for update to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));
create policy "activities_delete" on public.activities for delete to authenticated using (public.can_edit(trip_id));

create policy "photos_select" on public.photos for select to authenticated using (public.is_member(trip_id));
create policy "photos_insert" on public.photos for insert to authenticated with check (public.can_edit(trip_id));
create policy "photos_update" on public.photos for update to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));
create policy "photos_delete" on public.photos for delete to authenticated using (public.can_edit(trip_id));

create policy "documents_select" on public.documents for select to authenticated using (public.is_member(trip_id));
create policy "documents_insert" on public.documents for insert to authenticated with check (public.can_edit(trip_id));
create policy "documents_update" on public.documents for update to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));
create policy "documents_delete" on public.documents for delete to authenticated using (public.can_edit(trip_id));

create policy "diary_select" on public.diary_entries for select to authenticated using (public.is_member(trip_id));
create policy "diary_insert" on public.diary_entries for insert to authenticated with check (public.can_edit(trip_id));
create policy "diary_update" on public.diary_entries for update to authenticated using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));
create policy "diary_delete" on public.diary_entries for delete to authenticated using (public.can_edit(trip_id));

-- Comentarios: cualquier miembro (tambien lectores), siempre sobre algo del mismo viaje
create policy "comments_select" on public.comments for select to authenticated using (public.is_member(trip_id));
create policy "comments_insert" on public.comments for insert to authenticated
  with check (public.is_member(trip_id) and author_id = (select auth.uid()) and public.target_in_trip(target_type, target_id, trip_id));
create policy "comments_delete" on public.comments for delete to authenticated
  using (public.is_member(trip_id) and (author_id = (select auth.uid()) or public.is_owner(trip_id)));

-- Propuestas: cualquiera propone, los editores aceptan o descartan
create policy "proposals_select" on public.proposals for select to authenticated using (public.is_member(trip_id));
create policy "proposals_insert" on public.proposals for insert to authenticated
  with check (public.is_member(trip_id) and author_id = (select auth.uid()));
create policy "proposals_update" on public.proposals for update to authenticated
  using (public.can_edit(trip_id)) with check (public.can_edit(trip_id));
create policy "proposals_delete" on public.proposals for delete to authenticated
  using (public.is_member(trip_id) and (author_id = (select auth.uid()) or public.is_owner(trip_id)));

-- Votos: uno por persona y propuesta, solo mientras sigues en el viaje
create policy "votes_select" on public.votes for select to authenticated using (public.is_member(trip_id));
create policy "votes_insert" on public.votes for insert to authenticated with check (public.is_member(trip_id) and user_id = (select auth.uid()));
create policy "votes_update" on public.votes for update to authenticated
  using (public.is_member(trip_id) and user_id = (select auth.uid())) with check (public.is_member(trip_id) and user_id = (select auth.uid()));
create policy "votes_delete" on public.votes for delete to authenticated using (public.is_member(trip_id) and user_id = (select auth.uid()));

-- Equipaje: lo comun lo editan los editores; lo personal solo su dueño (y solo el lo ve)
create policy "checklist_select" on public.checklist_items for select to authenticated
  using (public.is_member(trip_id) and (is_shared or owner_id = (select auth.uid())));
create policy "checklist_insert" on public.checklist_items for insert to authenticated
  with check (public.is_member(trip_id) and owner_id = (select auth.uid()) and (not is_shared or public.can_edit(trip_id)));
create policy "checklist_update" on public.checklist_items for update to authenticated
  using (public.is_member(trip_id) and ((is_shared and public.can_edit(trip_id)) or (not is_shared and owner_id = (select auth.uid()))));
create policy "checklist_delete" on public.checklist_items for delete to authenticated
  using (public.is_member(trip_id) and ((is_shared and public.can_edit(trip_id)) or (not is_shared and owner_id = (select auth.uid()))));

-- Historial
create policy "log_select" on public.activity_log for select to authenticated using (public.is_member(trip_id));
create policy "log_insert" on public.activity_log for insert to authenticated
  with check (public.is_member(trip_id) and actor_id = (select auth.uid()));

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

-- Permisos de las funciones. Supabase da EXECUTE a anon y authenticated por defecto: se quita a anon
-- (y a public) en todo lo que necesita sesion. authenticated las sigue necesitando para las politicas RLS
-- y para netlify/functions/borrar-foto.mjs (llama a /rpc/can_edit e /rpc/is_owner con el token del usuario).
revoke execute on function public.trip_role(uuid), public.is_member(uuid), public.can_edit(uuid), public.is_owner(uuid),
  public.target_in_trip(text, uuid, uuid), public.folder_trip(text), public.create_trip(jsonb), public.join_trip(text)
  from anon, public;
grant execute on function public.trip_role(uuid), public.is_member(uuid), public.can_edit(uuid), public.is_owner(uuid),
  public.target_in_trip(text, uuid, uuid), public.folder_trip(text), public.create_trip(jsonb), public.join_trip(text)
  to authenticated;
-- Funciones de trigger: nadie las llama por la API (los triggers funcionan igual sin este permiso)
revoke execute on function public.handle_new_user(), public.protect_trip_fields() from anon, authenticated, public;
-- Pagina publica: la usan visitantes sin cuenta
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
