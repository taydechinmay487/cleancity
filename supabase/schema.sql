-- CleanCity — Supabase schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- It creates every table, index, row-level-security policy, storage bucket and
-- function the app needs. Re-running it is safe: objects are created only when
-- they are missing and policies are replaced.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin create type public.user_role as enum ('citizen', 'authority', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.complaint_status as enum ('new', 'acknowledged', 'assigned', 'in_progress', 'resolved'); exception when duplicate_object then null; end $$;
do $$ begin create type public.priority_level as enum ('low', 'medium', 'high', 'urgent'); exception when duplicate_object then null; end $$;
do $$ begin create type public.photo_kind as enum ('report', 'before', 'after'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text,
  role        public.user_role not null default 'citizen',
  department  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.complaints (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  user_id         uuid references public.profiles (id) on delete set null,
  anonymous       boolean not null default false,
  reporter_name   text not null,
  reporter_phone  text not null,
  reporter_email  text,
  category        text not null,
  description     text not null,
  address         text not null,
  landmark        text,
  lat             double precision not null,
  lng             double precision not null,
  priority        public.priority_level not null default 'medium',
  status          public.complaint_status not null default 'new',
  assigned_to     text,
  department      text,
  resolution      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz
);

create table if not exists public.complaint_photos (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references public.complaints (id) on delete cascade,
  kind          public.photo_kind not null default 'report',
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.status_history (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references public.complaints (id) on delete cascade,
  status        public.complaint_status not null,
  note          text,
  actor_id      uuid,
  actor_name    text not null,
  actor_role    text not null default 'authority',
  created_at    timestamptz not null default now()
);

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  complaint_id  uuid references public.complaints (id) on delete cascade,
  type          text not null,
  title         text not null,
  body          text not null,
  email_status  text not null default 'pending',
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- Public, non-identifying projection of every complaint. The tracking page and
-- the home page map read from here so guest visitors never touch private rows.
create table if not exists public.complaint_feed (
  id            bigserial primary key,
  complaint_id  uuid not null unique,
  code          text not null,
  status        public.complaint_status not null,
  priority      public.priority_level not null,
  category      text not null,
  address       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Private settings. No RLS policy at all, so only security-definer functions
-- and the service role can read it.
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('authority_invite_code', 'cleancity-authority'),
  ('allow_anonymous_reports', 'true')
on conflict (key) do nothing;

create index if not exists idx_complaints_status   on public.complaints (status);
create index if not exists idx_complaints_created  on public.complaints (created_at desc);
create index if not exists idx_complaints_user     on public.complaints (user_id);
create index if not exists idx_complaints_category on public.complaints (category);
create index if not exists idx_complaints_priority on public.complaints (priority);
create index if not exists idx_photos_complaint    on public.complaint_photos (complaint_id);
create index if not exists idx_history_complaint   on public.status_history (complaint_id);
create index if not exists idx_notif_user          on public.notifications (user_id, read_at);
create index if not exists idx_feed_code           on public.complaint_feed (code);

-- ---------------------------------------------------------------------------
-- Lookup helpers
-- ---------------------------------------------------------------------------
create or replace function public.category_label(cat text)
returns text language sql immutable as $$
  select case cat
    when 'household' then 'Household waste'
    when 'plastic' then 'Plastic waste'
    when 'construction' then 'Construction debris'
    when 'ewaste' then 'E-waste'
    when 'medical' then 'Medical waste'
    when 'sewage' then 'Sewage / liquid waste'
    when 'deadanimal' then 'Dead animal'
    when 'organic' then 'Garden / organic waste'
    when 'other' then 'Other'
    else initcap(replace(coalesce(cat, ''), '_', ' '))
  end;
$$;

create or replace function public.status_label(st text)
returns text language sql immutable as $$
  select case st
    when 'new' then 'New complaint'
    when 'acknowledged' then 'Acknowledged'
    when 'assigned' then 'Assigned'
    when 'in_progress' then 'Cleaning in progress'
    when 'resolved' then 'Resolved'
    else coalesce(st, '')
  end;
$$;

-- Priority is derived from the waste category, matching the citizen form hint.
create or replace function public.priority_for_category(cat text)
returns public.priority_level language sql immutable as $$
  select (case cat
    when 'medical' then 'urgent'
    when 'sewage' then 'urgent'
    when 'deadanimal' then 'urgent'
    when 'construction' then 'high'
    when 'ewaste' then 'high'
    when 'household' then 'medium'
    when 'plastic' then 'medium'
    when 'organic' then 'low'
    else 'low'
  end)::public.priority_level;
$$;

create or replace function public.distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(least(1.0, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

/** True when the caller is a municipal account. Security definer avoids RLS recursion. */
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role in ('authority', 'admin')
  );
$$;

create or replace function public.make_complaint_code()
returns text language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  body text;
  candidate text;
  i int;
  attempt int;
begin
  for attempt in 1..20 loop
    body := '';
    for i in 1..6 loop
      body := body || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    candidate := 'CC-' || body;
    if not exists (select 1 from public.complaints c where c.code = candidate) then
      return candidate;
    end if;
  end loop;
  return 'CC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end $$;

-- ---------------------------------------------------------------------------
-- JSON projection shared by the API and realtime payloads
-- ---------------------------------------------------------------------------
create or replace function public.complaint_json(c public.complaints)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', c.id,
    'code', c.code,
    'category', c.category,
    'description', c.description,
    'address', c.address,
    'landmark', c.landmark,
    'lat', c.lat,
    'lng', c.lng,
    'priority', c.priority,
    'status', c.status,
    'assignedTo', c.assigned_to,
    'department', c.department,
    'resolution', c.resolution,
    'anonymous', c.anonymous,
    'reporterName', case when c.anonymous then 'Anonymous citizen' else c.reporter_name end,
    'reporterPhone', case when c.anonymous then null else c.reporter_phone end,
    'reporterEmail', case when c.anonymous then null else c.reporter_email end,
    'userId', c.user_id,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'acknowledgedAt', c.acknowledged_at,
    'resolvedAt', c.resolved_at,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'path', p.storage_path) order by p.created_at)
        from public.complaint_photos p where p.complaint_id = c.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', h.id, 'status', h.status, 'note', h.note,
               'actor_name', h.actor_name, 'actor_role', h.actor_role,
               'created_at', h.created_at) order by h.created_at)
        from public.status_history h where h.complaint_id = c.id
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Sign-up: create the matching profile row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    'citizen'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Invite-gated authority access
-- ---------------------------------------------------------------------------
create or replace function public.check_authority_invite(invite_code text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.app_settings s
     where s.key = 'authority_invite_code'
       and invite_code is not null
       and s.value = invite_code
  );
$$;

create or replace function public.claim_authority(invite_code text, dept text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in first.');
  end if;
  if not public.check_authority_invite(invite_code) then
    return jsonb_build_object('ok', false, 'error', 'Invalid authority invite code.');
  end if;
  update public.profiles
     set role = 'authority',
         department = coalesce(nullif(btrim(dept), ''), department)
   where id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Complaint creation (citizens + guests)
-- ---------------------------------------------------------------------------
create or replace function public.create_complaint(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid        uuid := auth.uid();
  v_anonymous  boolean := coalesce((p ->> 'anonymous')::boolean, false);
  v_category   text := coalesce(p ->> 'category', '');
  v_description text := btrim(coalesce(p ->> 'description', ''));
  v_address    text := btrim(coalesce(p ->> 'address', ''));
  v_landmark   text := nullif(btrim(coalesce(p ->> 'landmark', '')), '');
  v_phone      text := btrim(coalesce(p ->> 'phone', ''));
  v_name       text := btrim(coalesce(p ->> 'name', ''));
  v_email      text := nullif(btrim(coalesce(p ->> 'email', '')), '');
  v_lat        double precision := (p ->> 'lat')::double precision;
  v_lng        double precision := (p ->> 'lng')::double precision;
  v_force      boolean := coalesce((p ->> 'force')::boolean, false);
  v_allow_anon boolean;
  v_priority   public.priority_level;
  v_code       text;
  v_row        public.complaints%rowtype;
  v_dupe_id    uuid;
  v_dupe_code  text;
  v_photo      text;
begin
  select (value)::boolean into v_allow_anon
    from public.app_settings where key = 'allow_anonymous_reports';
  if v_allow_anon is null then v_allow_anon := true; end if;

  if v_uid is null and not v_allow_anon then
    raise exception 'Anonymous reporting is currently disabled. Please sign in.';
  end if;
  if v_category not in ('household', 'plastic', 'construction', 'ewaste', 'medical', 'sewage', 'deadanimal', 'organic', 'other') then
    raise exception 'Choose the type of garbage.';
  end if;
  if length(v_description) < 10 then
    raise exception 'Please describe the problem in at least 10 characters.';
  end if;
  if length(v_address) < 5 then
    raise exception 'Please enter the location or address.';
  end if;
  if v_lat is null or v_lng is null
     or v_lat < -90 or v_lat > 90 or v_lng < -180 or v_lng > 180 then
    raise exception 'Share your GPS location or pick the spot on the map.';
  end if;
  if v_phone !~ '^[+0-9][0-9\s\-()]{6,19}$' then
    raise exception 'Please enter a contact phone number.';
  end if;
  if not v_anonymous and length(v_name) < 2 then
    raise exception 'Please enter your name or report anonymously.';
  end if;

  v_priority := public.priority_for_category(v_category);

  -- Duplicate guard: same reporter, same category, within 150 m, last 24 hours.
  select c.id, c.code into v_dupe_id, v_dupe_code
    from public.complaints c
   where c.category = v_category
     and c.status <> 'resolved'
     and c.created_at > now() - interval '24 hours'
     and (
       (v_uid is not null and c.user_id = v_uid)
       or regexp_replace(c.reporter_phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
     )
     and public.distance_m(v_lat, v_lng, c.lat, c.lng) < 150
   order by c.created_at desc
   limit 1;

  if v_dupe_id is not null and not v_force then
    return jsonb_build_object(
      'ok', false,
      'reason', 'duplicate',
      'duplicate', jsonb_build_object('id', v_dupe_id, 'code', v_dupe_code)
    );
  end if;

  v_code := public.make_complaint_code();

  insert into public.complaints
    (code, user_id, anonymous, reporter_name, reporter_phone, reporter_email,
     category, description, address, landmark, lat, lng, priority, status)
  values
    (v_code, v_uid, v_anonymous,
     case when v_anonymous then 'Anonymous citizen' else v_name end,
     v_phone, v_email, v_category, v_description, v_address, v_landmark,
     v_lat, v_lng, v_priority, 'new')
  returning * into v_row;

  for v_photo in
    select jsonb_array_elements_text(coalesce(p -> 'photos', '[]'::jsonb))
  loop
    if btrim(v_photo) <> '' then
      insert into public.complaint_photos (complaint_id, kind, storage_path)
      values (v_row.id, 'report', v_photo);
    end if;
  end loop;

  insert into public.status_history (complaint_id, status, note, actor_id, actor_name, actor_role)
  values (v_row.id, 'new', 'Complaint submitted by citizen.', v_uid,
          case when v_anonymous then 'Anonymous citizen' else v_name end, 'citizen');

  if v_uid is not null then
    insert into public.notifications (user_id, complaint_id, type, title, body)
    values (v_uid, v_row.id, 'submitted',
      'Complaint ' || v_row.code || ' received',
      'Thank you for reporting garbage at ' || v_address || '. Your complaint ID is ' || v_row.code || '.');
  end if;

  insert into public.notifications (user_id, complaint_id, type, title, body)
  select pr.id, v_row.id, 'new_complaint',
         'New ' || v_priority::text || ' priority complaint ' || v_row.code,
         public.category_label(v_category) || ' reported at ' || v_address || '.'
    from public.profiles pr
   where pr.role in ('authority', 'admin');

  return jsonb_build_object('ok', true, 'complaint', public.complaint_json(v_row));
end $$;

-- ---------------------------------------------------------------------------
-- Municipal workflow
-- ---------------------------------------------------------------------------
create or replace function public.update_complaint(
  p_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_to text default null,
  p_department text default null,
  p_resolution text default null,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c            public.complaints%rowtype;
  v_status     public.complaint_status;
  v_priority   public.priority_level;
  v_assigned   text;
  v_department text;
  v_resolution text;
  v_note       text := nullif(btrim(coalesce(p_note, '')), '');
  v_changed    boolean;
  v_actor_name text;
  v_actor_role text;
begin
  if not public.is_staff() then
    raise exception 'This area is for municipal authority accounts.';
  end if;

  select * into c from public.complaints where id = p_id;
  if c.id is null then
    raise exception 'Complaint not found.';
  end if;

  v_status := coalesce(nullif(btrim(coalesce(p_status, '')), '')::public.complaint_status, c.status);
  v_priority := coalesce(nullif(btrim(coalesce(p_priority, '')), '')::public.priority_level, c.priority);
  v_assigned := nullif(btrim(coalesce(p_assigned_to, '')), '');
  v_department := nullif(btrim(coalesce(p_department, '')), '');
  v_resolution := coalesce(nullif(btrim(coalesce(p_resolution, '')), ''), c.resolution);

  if v_status = 'resolved' and v_resolution is null and v_note is null then
    raise exception 'Add resolution details before marking the complaint resolved.';
  end if;

  v_changed := v_status is distinct from c.status;

  update public.complaints set
    status = v_status,
    priority = v_priority,
    assigned_to = v_assigned,
    department = v_department,
    resolution = v_resolution,
    acknowledged_at = case
      when v_status = 'acknowledged' and acknowledged_at is null then now()
      else acknowledged_at end,
    resolved_at = case
      when v_status = 'resolved' then coalesce(resolved_at, now())
      else null end
  where id = c.id
  returning * into c;

  select p.name, p.role::text into v_actor_name, v_actor_role
    from public.profiles p where p.id = auth.uid();

  if v_changed or v_note is not null then
    insert into public.status_history (complaint_id, status, note, actor_id, actor_name, actor_role)
    values (c.id, v_status,
            coalesce(v_note, 'Status changed to ' || public.status_label(v_status::text) || '.'),
            auth.uid(),
            coalesce(v_actor_name, 'Municipal team'),
            coalesce(v_actor_role, 'authority'));
  end if;

  if v_changed and c.user_id is not null
     and v_status in ('acknowledged', 'assigned', 'in_progress', 'resolved') then
    insert into public.notifications (user_id, complaint_id, type, title, body)
    values (
      c.user_id, c.id, v_status::text,
      case v_status
        when 'acknowledged' then 'Complaint ' || c.code || ' acknowledged'
        when 'assigned' then 'Complaint ' || c.code || ' assigned'
        when 'in_progress' then 'Cleaning started for ' || c.code
        when 'resolved' then 'Complaint ' || c.code || ' resolved'
        else 'Complaint ' || c.code || ' updated'
      end,
      case v_status
        when 'acknowledged' then 'Your complaint ' || c.code || ' has been acknowledged by the municipal team and is being scheduled.'
        when 'assigned' then 'Complaint ' || c.code || ' has been assigned to a cleaning team. You will see progress as work begins.'
        when 'in_progress' then 'Cleaning work has started at ' || c.address || '. We will notify you when it is complete.'
        when 'resolved' then 'The location you reported has been cleaned. Thank you for helping keep the city clean.'
        else 'Your complaint ' || c.code || ' was updated.'
      end
    );
  end if;

  return jsonb_build_object('ok', true, 'complaint', public.complaint_json(c));
end $$;

create or replace function public.add_complaint_photos(
  p_id uuid,
  p_kind text,
  p_paths text[]
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c      public.complaints%rowtype;
  k      public.photo_kind;
  n      int;
  v_name text;
  v_role text;
begin
  if not public.is_staff() then
    raise exception 'This area is for municipal authority accounts.';
  end if;

  select * into c from public.complaints where id = p_id;
  if c.id is null then
    raise exception 'Complaint not found.';
  end if;

  k := case
    when p_kind = 'after' then 'after'::public.photo_kind
    when p_kind = 'before' then 'before'::public.photo_kind
    else 'report'::public.photo_kind
  end;

  if coalesce(array_length(p_paths, 1), 0) = 0 then
    raise exception 'Choose at least one photo.';
  end if;

  insert into public.complaint_photos (complaint_id, kind, storage_path)
  select p_id, k, path from unnest(p_paths) as path;
  get diagnostics n = row_count;

  select p.name, p.role::text into v_name, v_role from public.profiles p where p.id = auth.uid();

  insert into public.status_history (complaint_id, status, note, actor_id, actor_name, actor_role)
  values (p_id, c.status,
          'Uploaded ' || n || ' ' || case when k = 'report' then 'site' else k::text end ||
          ' photo' || case when n > 1 then 's' else '' end,
          auth.uid(), coalesce(v_name, 'Municipal team'), coalesce(v_role, 'authority'));

  select * into c from public.complaints where id = p_id;
  return jsonb_build_object('ok', true, 'complaint', public.complaint_json(c));
end $$;

create or replace function public.add_citizen_note(p_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c      public.complaints%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
  v_name text;
begin
  select * into c from public.complaints where id = p_id;
  if c.id is null then
    raise exception 'Complaint not found.';
  end if;
  if c.user_id is null or c.user_id <> auth.uid() then
    raise exception 'You cannot comment on this complaint.';
  end if;
  if length(v_note) < 3 then
    raise exception 'Please add a short note.';
  end if;

  select p.name into v_name from public.profiles p where p.id = auth.uid();

  insert into public.status_history (complaint_id, status, note, actor_id, actor_name, actor_role)
  values (c.id, c.status, v_note, auth.uid(), coalesce(v_name, 'Citizen'), 'citizen');

  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Public read models (safe for signed-out visitors)
-- ---------------------------------------------------------------------------
create or replace function public.track_complaint(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  c public.complaints%rowtype;
begin
  select * into c from public.complaints
   where upper(code) = upper(btrim(coalesce(p_code, '')))
   limit 1;
  if c.id is null then
    return null;
  end if;
  return public.complaint_json(c) - 'reporterPhone' - 'reporterEmail' - 'userId';
end $$;

create or replace function public.public_stats()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'total', count(*),
    'resolved', count(*) filter (where status = 'resolved'),
    'pending', count(*) filter (where status in ('new', 'acknowledged')),
    'active', count(*) filter (where status in ('assigned', 'in_progress')),
    'avgResolutionHours', round(avg(extract(epoch from (resolved_at - created_at)) / 3600)::numeric, 1),
    'categories', count(distinct category)
  ) from public.complaints;
$$;

create or replace function public.public_map()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'code', t.code, 'lat', t.lat, 'lng', t.lng,
    'status', t.status, 'priority', t.priority, 'category', t.category,
    'address', t.address, 'createdAt', t.created_at
  ) order by t.created_at desc), '[]'::jsonb)
  from (
    select id, code, lat, lng, status, priority, category, address, created_at
      from public.complaints
     order by created_at desc
     limit 400
  ) t;
$$;

-- ---------------------------------------------------------------------------
-- Municipal read models
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  base      record;
  by_pri    jsonb;
  by_cat    jsonb;
  trend     jsonb;
  avg_hours numeric;
begin
  if not public.is_staff() then
    raise exception 'This area is for municipal authority accounts.';
  end if;

  select count(*) as total,
         count(*) filter (where status = 'new') as new_count,
         count(*) filter (where status in ('new', 'acknowledged')) as pending,
         count(*) filter (where status in ('assigned', 'in_progress')) as processing,
         count(*) filter (where status = 'resolved') as resolved
    into base
    from public.complaints;

  select jsonb_build_object(
    'low',    count(*) filter (where priority = 'low'    and status <> 'resolved'),
    'medium', count(*) filter (where priority = 'medium' and status <> 'resolved'),
    'high',   count(*) filter (where priority = 'high'   and status <> 'resolved'),
    'urgent', count(*) filter (where priority = 'urgent' and status <> 'resolved')
  ) into by_pri from public.complaints;

  select coalesce(jsonb_agg(jsonb_build_object(
           'category', s.category,
           'label', public.category_label(s.category),
           'count', s.n) order by s.n desc), '[]'::jsonb)
    into by_cat
    from (select category, count(*) as n from public.complaints group by category) s;

  select coalesce(jsonb_agg(jsonb_build_object('day', s.d, 'count', s.n) order by s.d), '[]'::jsonb)
    into trend
    from (
      select to_char(created_at, 'YYYY-MM-DD') as d, count(*) as n
        from public.complaints
       where created_at > now() - interval '14 days'
       group by 1
    ) s;

  select round(avg(extract(epoch from (resolved_at - created_at)) / 3600)::numeric, 1)
    into avg_hours
    from public.complaints
   where status = 'resolved' and resolved_at is not null;

  return jsonb_build_object(
    'total', coalesce(base.total, 0),
    'newCount', coalesce(base.new_count, 0),
    'pending', coalesce(base.pending, 0),
    'processing', coalesce(base.processing, 0),
    'resolved', coalesce(base.resolved, 0),
    'highPriority', coalesce((by_pri ->> 'high')::int, 0) + coalesce((by_pri ->> 'urgent')::int, 0),
    'byPriority', by_pri,
    'byCategory', by_cat,
    'avgResolutionHours', avg_hours,
    'trend', trend
  );
end $$;

create or replace function public.crew_summary()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  w jsonb;
  d jsonb;
begin
  if not public.is_staff() then
    raise exception 'This area is for municipal authority accounts.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', s.assigned_to, 'department', s.department, 'open', s.n) order by s.n desc), '[]'::jsonb)
    into w
    from (
      select assigned_to, department, count(*) as n
        from public.complaints
       where assigned_to is not null and status <> 'resolved'
       group by assigned_to, department
    ) s;

  select coalesce(jsonb_agg(jsonb_build_object('name', s.department, 'total', s.n) order by s.n desc), '[]'::jsonb)
    into d
    from (
      select department, count(*) as n
        from public.complaints
       where department is not null
       group by department
    ) s;

  return jsonb_build_object('workers', w, 'departments', d);
end $$;

create or replace function public.monthly_report(p_month text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  m          text;
  start_ts   timestamptz;
  end_ts     timestamptz;
  v_total    int;
  v_resolved int;
  avg_hours  numeric;
  by_cat     jsonb;
  by_status  jsonb;
  by_pri     jsonb;
  rows_json  jsonb;
begin
  if not public.is_staff() then
    raise exception 'This area is for municipal authority accounts.';
  end if;

  m := case when coalesce(p_month, '') ~ '^\d{4}-\d{2}$' then p_month else to_char(now(), 'YYYY-MM') end;
  start_ts := (m || '-01')::timestamptz;
  end_ts := start_ts + interval '1 month';

  select count(*), count(*) filter (where status = 'resolved')
    into v_total, v_resolved
    from public.complaints
   where created_at >= start_ts and created_at < end_ts;

  select round(avg(extract(epoch from (resolved_at - created_at)) / 3600)::numeric, 1)
    into avg_hours
    from public.complaints
   where created_at >= start_ts and created_at < end_ts
     and status = 'resolved' and resolved_at is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'category', s.category, 'label', public.category_label(s.category), 'count', s.n)
           order by s.n desc), '[]'::jsonb)
    into by_cat
    from (
      select category, count(*) as n
        from public.complaints
       where created_at >= start_ts and created_at < end_ts
       group by category
    ) s;

  select jsonb_agg(jsonb_build_object('status', s.value, 'label', public.status_label(s.value), 'count', s.n))
    into by_status
    from (
      select v.value,
             (select count(*) from public.complaints c
               where c.created_at >= start_ts and c.created_at < end_ts
                 and c.status::text = v.value) as n
        from unnest(array['new', 'acknowledged', 'assigned', 'in_progress', 'resolved']) as v(value)
    ) s;

  select jsonb_agg(jsonb_build_object('priority', s.value, 'count', s.n))
    into by_pri
    from (
      select v.value,
             (select count(*) from public.complaints c
               where c.created_at >= start_ts and c.created_at < end_ts
                 and c.priority::text = v.value) as n
        from unnest(array['low', 'medium', 'high', 'urgent']) as v(value)
    ) s;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', c.code,
           'createdAt', c.created_at,
           'category', public.category_label(c.category),
           'address', c.address,
           'priority', c.priority,
           'status', public.status_label(c.status::text),
           'assignedTo', coalesce(c.assigned_to, ''),
           'resolvedAt', c.resolved_at) order by c.created_at), '[]'::jsonb)
    into rows_json
    from public.complaints c
   where c.created_at >= start_ts and c.created_at < end_ts;

  return jsonb_build_object(
    'month', m,
    'total', v_total,
    'resolved', v_resolved,
    'open', v_total - v_resolved,
    'resolutionRate', case when v_total > 0 then round((v_resolved::numeric / v_total) * 100) else 0 end,
    'avgResolutionHours', avg_hours,
    'byCategory', by_cat,
    'byStatus', by_status,
    'byPriority', by_pri,
    'rows', rows_json
  );
end $$;

-- ---------------------------------------------------------------------------
-- Triggers: timestamps + the public feed
-- ---------------------------------------------------------------------------
create or replace function public.touch_complaint()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_complaints_touch on public.complaints;
create trigger trg_complaints_touch
  before update on public.complaints
  for each row execute function public.touch_complaint();

create or replace function public.sync_complaint_feed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.complaint_feed (complaint_id, code, status, priority, category, address, created_at, updated_at)
  values (new.id, new.code, new.status, new.priority, new.category, new.address, new.created_at, now())
  on conflict (complaint_id) do update set
    status = excluded.status,
    priority = excluded.priority,
    category = excluded.category,
    address = excluded.address,
    updated_at = now();
  return new;
end $$;

drop trigger if exists trg_complaints_feed on public.complaints;
create trigger trg_complaints_feed
  after insert or update on public.complaints
  for each row execute function public.sync_complaint_feed();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.complaints       enable row level security;
alter table public.complaint_photos enable row level security;
alter table public.status_history   enable row level security;
alter table public.notifications    enable row level security;
alter table public.complaint_feed   enable row level security;
alter table public.app_settings     enable row level security;

-- Profiles: you may read your own row; municipal accounts read everyone.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

-- Complaints: citizens see their own, municipal accounts see everything.
-- Writes happen only through the functions above.
drop policy if exists complaints_select on public.complaints;
create policy complaints_select on public.complaints
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists photos_select on public.complaint_photos;
create policy photos_select on public.complaint_photos
  for select to authenticated
  using (exists (
    select 1 from public.complaints c
     where c.id = complaint_id and (c.user_id = auth.uid() or public.is_staff())
  ));

drop policy if exists history_select on public.status_history;
create policy history_select on public.status_history
  for select to authenticated
  using (exists (
    select 1 from public.complaints c
     where c.id = complaint_id and (c.user_id = auth.uid() or public.is_staff())
  ));

-- Notifications belong to one person. Citizens may only mark their own as read.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The public feed carries no personal data, so anyone may read it (and follow
-- live status changes for a complaint ID they were given).
drop policy if exists feed_select on public.complaint_feed;
create policy feed_select on public.complaint_feed
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Storage: photos live in a public bucket, uploads are folder-scoped
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-photos', 'complaint-photos', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])
on conflict (id) do update set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

drop policy if exists "complaint photos read" on storage.objects;
create policy "complaint photos read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'complaint-photos');

drop policy if exists "complaint photos upload" on storage.objects;
create policy "complaint photos upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'complaint-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

drop policy if exists "complaint photos guest upload" on storage.objects;
create policy "complaint photos guest upload" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = 'guest'
  );

drop policy if exists "complaint photos delete" on storage.objects;
create policy "complaint photos delete" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'complaint-photos'
    and ((storage.foldername(name))[1] = coalesce(auth.uid()::text, 'guest') or public.is_staff())
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter table public.complaints      replica identity full;
alter table public.notifications   replica identity full;
alter table public.complaint_feed  replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.complaints;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.complaint_feed;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.complaints, public.complaint_photos,
  public.status_history, public.notifications, public.complaint_feed to authenticated;
grant select on public.complaint_feed to anon;
grant update (read_at) on public.notifications to authenticated;

grant execute on function public.create_complaint(jsonb) to anon, authenticated;
grant execute on function public.track_complaint(text) to anon, authenticated;
grant execute on function public.public_stats() to anon, authenticated;
grant execute on function public.public_map() to anon, authenticated;
grant execute on function public.check_authority_invite(text) to anon, authenticated;
grant execute on function public.claim_authority(text, text) to authenticated;
grant execute on function public.update_complaint(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.add_complaint_photos(uuid, text, text[]) to authenticated;
grant execute on function public.add_citizen_note(uuid, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.crew_summary() to authenticated;
grant execute on function public.monthly_report(text) to authenticated;

-- ---------------------------------------------------------------------------
-- First municipal account
-- ---------------------------------------------------------------------------
-- 1. Sign up on /authority/login → "Register with invite".
-- 2. Enter the invite code above (default: cleancity-authority).
-- To rotate it:  update public.app_settings set value = 'new-code' where key = 'authority_invite_code';
