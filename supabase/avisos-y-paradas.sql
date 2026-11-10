-- ============================================================================
-- FoxTrips · Avisos push y viajes con varias paradas (11 nov 2026)
-- Se puede ejecutar varias veces. Ejecutalo despues de schema.sql (ya aplicado en el proyecto de Supabase).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Viajes con varias paradas
-- trips.stops: paradas DESPUES del destino principal, en orden:
--   [{ "name": "Florencia, Italia", "lat": 43.77, "lon": 11.25, "from": "2027-05-04" }, …]
-- "from" es el dia de llegada; cada parada dura hasta el dia anterior a la siguiente.
-- ----------------------------------------------------------------------------
alter table public.trips add column if not exists stops jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_stops_shape') then
    alter table public.trips add constraint trips_stops_shape
      check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 20 and pg_column_size(stops) <= 8000);
  end if;
end $$;

create or replace function public.create_trip(trip jsonb)
returns public.trips language plpgsql security definer set search_path = public as $$
declare
  new_trip public.trips;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  insert into public.trips (name, destination, description, start_date, end_date, currency, lat, lon, cover_url, stops, created_by)
  values (
    trip ->> 'name', trip ->> 'destination', trip ->> 'description',
    nullif(trip ->> 'start_date', '')::date, nullif(trip ->> 'end_date', '')::date,
    coalesce(trip ->> 'currency', 'USD'),
    (trip ->> 'lat')::double precision, (trip ->> 'lon')::double precision,
    trip ->> 'cover_url',
    case when jsonb_typeof(trip -> 'stops') = 'array' then trip -> 'stops' else '[]'::jsonb end,
    auth.uid())
  returning * into new_trip;
  insert into public.trip_members (trip_id, user_id, role) values (new_trip.id, auth.uid(), 'owner');
  insert into public.activity_log (trip_id, actor_id, actor_name, text)
    select new_trip.id, auth.uid(), display_name, 'creó el viaje "' || new_trip.name || '"' from public.profiles where id = auth.uid();
  return new_trip;
end $$;

-- La pagina publica tambien muestra las paradas
create or replace function public.get_public_trip(token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'trip', json_build_object('id', t.id, 'name', t.name, 'destination', t.destination, 'description', t.description,
                              'start_date', t.start_date, 'end_date', t.end_date, 'cover_url', t.cover_url, 'stops', t.stops),
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

-- ----------------------------------------------------------------------------
-- 2. Avisos push
-- push_subscriptions: un dispositivo (navegador) de una persona. Solo lo ve y lo cambia su dueño.
--   prefs: { "plan": true, "votes": true, "group": true, "reminders": true } (lo que falta cuenta como true)
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  lang text not null default 'es' check (lang in ('es', 'en', 'pt')),
  time_zone text not null default 'UTC' check (char_length(time_zone) <= 64),
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_select_own" on public.push_subscriptions;
drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "push_delete_own" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Cambios del historial que ya se avisaron (cada cambio se avisa una sola vez)
create table if not exists public.push_log_sent (
  log_id uuid primary key references public.activity_log on delete cascade,
  trip_id uuid not null references public.trips on delete cascade,
  actor_id uuid,
  sent_at timestamptz not null default now()
);
create index if not exists push_log_sent_actor_idx on public.push_log_sent (trip_id, actor_id, sent_at desc);
alter table public.push_log_sent enable row level security; -- sin politicas: solo las funciones de abajo

-- Recordatorios ya enviados (uno por dispositivo, viaje, tipo y dia)
create table if not exists public.push_reminders_sent (
  subscription_id uuid not null references public.push_subscriptions on delete cascade,
  trip_id uuid not null references public.trips on delete cascade,
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, trip_id, kind, day)
);
alter table public.push_reminders_sent enable row level security; -- sin politicas

-- Ajustes privados del servidor (hash del secreto de los recordatorios). Nadie lo lee por la API.
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security; -- sin politicas

-- Guarda (o actualiza) el dispositivo de la persona con sesion. Si el navegador lo usaba otra cuenta, pasa a esta.
create or replace function public.save_push_subscription(sub jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, lang, time_zone, prefs)
  values (auth.uid(), sub ->> 'endpoint', sub ->> 'p256dh', sub ->> 'auth',
          coalesce(sub ->> 'lang', 'es'), coalesce(sub ->> 'time_zone', 'UTC'), coalesce(sub -> 'prefs', '{}'::jsonb))
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    lang = excluded.lang, time_zone = excluded.time_zone, prefs = excluded.prefs, updated_at = now();
end $$;

-- Quita un dispositivo. El endpoint es secreto (solo lo conocen el navegador y el servidor de avisos),
-- asi que basta con conocerlo: lo usa la app al desactivar y la funcion de envio cuando el navegador lo da de baja.
create or replace function public.forget_push_subscription(endpoint_url text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = endpoint_url
$$;

-- Destinatarios del aviso de un cambio del historial:
-- solo quien hizo el cambio, en los 5 minutos siguientes y una sola vez. Devuelve los dispositivos
-- del resto del grupo. Si esa persona ya aviso en este viaje hace menos de 20 segundos, no se repite
-- (al reordenar varios planes seguidos llega un solo aviso).
create or replace function public.push_targets(log uuid)
returns table (trip_name text, actor_name text, text text, endpoint text, p256dh text, auth text, lang text, prefs jsonb)
language plpgsql security definer set search_path = public as $$
declare
  entry public.activity_log;
  is_recent_sender boolean;
begin
  select * into entry from public.activity_log l
    where l.id = log and l.actor_id = auth.uid() and l.created_at > now() - interval '5 minutes';
  if not found then return; end if;
  if exists (select 1 from public.push_log_sent s where s.log_id = entry.id) then return; end if;
  select exists (select 1 from public.push_log_sent s
                 where s.trip_id = entry.trip_id and s.actor_id = entry.actor_id and s.sent_at > now() - interval '20 seconds')
    into is_recent_sender;
  insert into public.push_log_sent (log_id, trip_id, actor_id) values (entry.id, entry.trip_id, entry.actor_id);
  if is_recent_sender then return; end if;
  return query
    select tr.name, entry.actor_name, entry.text, ps.endpoint, ps.p256dh, ps.auth, ps.lang, ps.prefs
    from public.trip_members m
    join public.trips tr on tr.id = m.trip_id
    join public.push_subscriptions ps on ps.user_id = m.user_id
    where m.trip_id = entry.trip_id and m.user_id <> entry.actor_id;
end $$;

-- Recordatorios pendientes (lo llama la funcion programada de Netlify cada hora con su secreto):
--   'tomorrow': a las 19 h (hora del dispositivo) del dia antes de empezar el viaje
--   'today':    a las 8 h de cada dia del viaje que tiene planes (cuantos y la hora del primero)
-- Marca cada uno como enviado para no repetirlo.
create or replace function public.due_reminders(secret text)
returns table (kind text, trip_id uuid, trip_name text, plans integer, first_time text, first_title text,
               endpoint text, p256dh text, auth text, lang text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if secret is null or not exists (
    select 1 from public.app_settings
    where key = 'reminders_secret_sha256' and value = encode(extensions.digest(secret, 'sha256'), 'hex')
  ) then
    raise exception 'No autorizado';
  end if;
  return query
  with subs as (
    select ps.*, (now() at time zone ps.time_zone) as local_now
    from public.push_subscriptions ps
    where coalesce((ps.prefs ->> 'reminders')::boolean, true)
      and ps.time_zone in (select name from pg_timezone_names)
  ),
  candidates as (
    select 'tomorrow'::text as kind, s.id as sub_id, tr.id as trip_id, tr.name as trip_name, s.local_now::date as day,
           s.endpoint, s.p256dh, s.auth, s.lang
    from subs s
    join public.trip_members m on m.user_id = s.user_id
    join public.trips tr on tr.id = m.trip_id
    where extract(hour from s.local_now) = 19 and tr.start_date = s.local_now::date + 1
    union all
    select 'today', s.id, tr.id, tr.name, s.local_now::date, s.endpoint, s.p256dh, s.auth, s.lang
    from subs s
    join public.trip_members m on m.user_id = s.user_id
    join public.trips tr on tr.id = m.trip_id
    where extract(hour from s.local_now) = 8
      and s.local_now::date between tr.start_date and coalesce(tr.end_date, tr.start_date)
      and exists (select 1 from public.activities a where a.trip_id = tr.id and a.day = s.local_now::date)
  ),
  fresh as (
    insert into public.push_reminders_sent (subscription_id, trip_id, kind, day)
    select c.sub_id, c.trip_id, c.kind, c.day from candidates c
    on conflict do nothing
    returning subscription_id, push_reminders_sent.trip_id, push_reminders_sent.kind, push_reminders_sent.day
  )
  select c.kind, c.trip_id, c.trip_name,
         (select count(*)::integer from public.activities a where a.trip_id = c.trip_id and a.day = c.day),
         (select a.time::text from public.activities a where a.trip_id = c.trip_id and a.day = c.day and a.time is not null
            order by a.time limit 1),
         (select a.title from public.activities a where a.trip_id = c.trip_id and a.day = c.day
            order by a.time nulls last, a.created_at limit 1),
         c.endpoint, c.p256dh, c.auth, c.lang
  from candidates c
  join fresh f on f.subscription_id = c.sub_id and f.trip_id = c.trip_id and f.kind = c.kind and f.day = c.day;
end $$;

-- Permisos: las de la app solo con sesion; la de recordatorios la protege su secreto
revoke execute on function public.save_push_subscription(jsonb), public.forget_push_subscription(text),
  public.push_targets(uuid), public.due_reminders(text) from anon, public;
grant execute on function public.save_push_subscription(jsonb), public.forget_push_subscription(text),
  public.push_targets(uuid) to authenticated;
grant execute on function public.forget_push_subscription(text), public.due_reminders(text) to anon;
-- La funcion programada llama sin sesion (anon); con sesion no hace falta
revoke execute on function public.due_reminders(text) from authenticated;
