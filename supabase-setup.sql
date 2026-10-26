-- ============================================================
--  Al Waad platform - database setup for Supabase
--  Paste this whole file into Supabase > SQL Editor > Run.
--
--  Safe to run again at any time. If you ran the old "Daily Quest"
--  version, this upgrades it: accounts are kept, old test questions
--  and answers are cleared, and your old admin becomes the owner.
--
--  All access goes through the functions below, so players can never
--  read answers, change their own points or see other scouts' ages.
-- ============================================================

-- ---------- Today's date in Cairo (new day = new quiz) ----------
create or replace function public.quiz_today()
returns date language sql stable as $$
  select (now() at time zone 'Africa/Cairo')::date
$$;

-- ---------- Clear the old "Daily Quest" structure (only once) ----------
do $$
begin
  if to_regclass('public.questions') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'questions' and column_name = 'difficulty') then
    drop table if exists public.answers cascade;
    drop table if exists public.questions cascade;
  end if;
end $$;

-- ---------- Drop our functions so they can be recreated cleanly ----------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'open_today','submit_answer','leaderboard','update_profile','is_admin','handle_new_user',
         'is_owner','require_admin','team_ok','rank_ok','me','save_profile','save_avatar','set_photo',
         '_play_build','play_state','open_question','my_ranks','wallet_history','shop_list','buy_item',
         'competitions_list','portfolio_list','portfolio_add','portfolio_delete',
         'admin_summary','admin_scouts','admin_update_scout','admin_set_role','admin_adjust','admin_clear_photo',
         'admin_questions','admin_save_questions','admin_delete_question',
         'admin_save_competition','admin_delete_competition',
         'admin_shop_items','admin_save_item','admin_delete_item','admin_orders','admin_deliver')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- ---------- Small helpers ----------
create or replace function public.team_ok(t text)
returns boolean language sql immutable as $$
  select t = any (array['buds','cubs','brownies','scouts','guides','adv_scouts','adv_guides','rovers','rover_girls','leaders'])
$$;

create or replace function public.rank_ok(r text)
returns boolean language sql immutable as $$
  select r = any (array['member','assistant','leader','first_leader'])
$$;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

alter table public.profiles
  add column if not exists photo        text,
  add column if not exists team         text,
  add column if not exists age          int,
  add column if not exists patrol_rank  text not null default 'member',
  add column if not exists role         text not null default 'player',
  add column if not exists hidden       boolean not null default false,
  add column if not exists streak       int not null default 0,
  add column if not exists best_streak  int not null default 0,
  add column if not exists last_played  date;

-- Upgrade from the old version: old admins become the owner
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin') then
    update public.profiles set role = 'owner' where is_admin and role = 'player';
    alter table public.profiles drop column is_admin;
  end if;
  alter table public.profiles drop column if exists xp;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_team_chk') then
    alter table public.profiles add constraint profiles_team_chk check (team is null or public.team_ok(team));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_rank_chk') then
    alter table public.profiles add constraint profiles_rank_chk check (public.rank_ok(patrol_rank));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_chk') then
    alter table public.profiles add constraint profiles_role_chk check (role in ('player','admin','owner'));
  end if;
end $$;

create table if not exists public.competitions (
  id         bigint generated always as identity primary key,
  name_ar    text not null,
  name_en    text,
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.questions (
  id             bigint generated always as identity primary key,
  quiz_date      date not null,
  pos            int  not null default 1,
  difficulty     text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  competition_id bigint references public.competitions(id) on delete set null,
  teams          text[] not null default '{}',          -- empty = every team
  question_ar    text,
  question_en    text,
  options        jsonb not null,                         -- [{"ar":"..","en":".."}, ...]
  correct_index  int  not null,
  base_points    int  not null default 100 check (base_points between 1 and 10000),
  time_limit     int  not null default 30  check (time_limit between 5 and 600),
  created_at     timestamptz not null default now(),
  check (question_ar is not null or question_en is not null)
);
create index if not exists questions_date_idx on public.questions (quiz_date);

create table if not exists public.answers (
  id            bigint generated always as identity primary key,
  user_id       uuid   not null references public.profiles(id) on delete cascade,
  question_id   bigint not null references public.questions(id) on delete cascade,
  quiz_date     date   not null,
  started_at    timestamptz not null default now(),
  answered_at   timestamptz,
  choice        int,
  correct       boolean,
  expired       boolean not null default false,
  base_points   int not null default 0,
  speed_bonus   int not null default 0,
  streak_bonus  int not null default 0,
  points_earned int not null default 0,
  unique (user_id, question_id)
);
create index if not exists answers_date_idx on public.answers (quiz_date);

-- Every Waadoz earned or spent is one row here. Balance = sum of rows.
create table if not exists public.wallet_tx (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  amount         int  not null,
  kind           text not null check (kind in ('answer','admin','purchase','refund')),
  competition_id bigint references public.competitions(id) on delete set null,
  question_id    bigint references public.questions(id) on delete set null,
  note           text,
  tx_date        date not null default public.quiz_today(),
  created_at     timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on public.wallet_tx (user_id);
create index if not exists wallet_tx_date_idx on public.wallet_tx (tx_date);

create table if not exists public.shop_items (
  id             bigint generated always as identity primary key,
  kind           text not null check (kind in ('avatar','photo','reward')),
  name_ar        text not null,
  name_en        text,
  description_ar text,
  description_en text,
  price          int  not null check (price >= 0),
  avatar_cat     text,
  avatar_index   int,
  stock          int,
  active         boolean not null default true,
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.purchases (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    bigint references public.shop_items(id) on delete set null,
  item_name  text not null,
  kind       text not null,
  price      int  not null,
  status     text not null default 'done' check (status in ('done','pending','delivered','refunded')),
  created_at timestamptz not null default now()
);
create index if not exists purchases_user_idx on public.purchases (user_id);

create table if not exists public.portfolio (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('camp','event')),
  title       text not null check (char_length(title) between 2 and 80),
  happened_on date,
  notes       text check (notes is null or char_length(notes) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists portfolio_user_idx on public.portfolio (user_id);

-- ---------- Lock the tables: the app only talks to functions ----------
alter table public.profiles     enable row level security;
alter table public.competitions enable row level security;
alter table public.questions    enable row level security;
alter table public.answers      enable row level security;
alter table public.wallet_tx    enable row level security;
alter table public.shop_items   enable row level security;
alter table public.purchases    enable row level security;
alter table public.portfolio    enable row level security;

drop policy if exists "profiles readable by players" on public.profiles;
drop policy if exists "admin manages questions" on public.questions;
drop policy if exists "players read own answers" on public.answers;

revoke all on public.profiles, public.competitions, public.questions, public.answers,
              public.wallet_tx, public.shop_items, public.purchases, public.portfolio
  from anon, authenticated;

-- ---------- Roles ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.role in ('admin','owner') from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.role = 'owner' from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'E_FORBIDDEN'; end if;
end $$;

-- ---------- New account -> profile ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text; v_team text; v_rank text; v_age int;
begin
  v_name := left(coalesce(nullif(trim(m->>'display_name'), ''), split_part(coalesce(new.email, 'scout'), '@', 1)), 20);
  v_team := m->>'team';
  if v_team is null or not public.team_ok(v_team) then v_team := null; end if;
  v_rank := coalesce(m->>'patrol_rank', 'member');
  if not public.rank_ok(v_rank) then v_rank := 'member'; end if;
  if (m->>'age') ~ '^[0-9]{1,2}$' then v_age := (m->>'age')::int; end if;
  insert into public.profiles (id, display_name, team, age, patrol_rank)
  values (new.id, v_name, v_team, v_age, v_rank)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- accounts created before this version get a profile too
insert into public.profiles (id, display_name)
select u.id, left(coalesce(split_part(u.email, '@', 1), 'scout'), 20)
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- ============================================================
--  Player functions
-- ============================================================

-- Everything the app needs to know about the signed-in scout.
create or replace function public.me()
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.profiles; v_bal bigint; v_earned bigint; v_owned jsonb;
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  select * into p from public.profiles where id = auth.uid();
  if not found then
    insert into public.profiles (id, display_name)
    select u.id, left(coalesce(split_part(u.email, '@', 1), 'scout'), 20) from auth.users u where u.id = auth.uid()
    on conflict (id) do nothing;
    select * into p from public.profiles where id = auth.uid();
  end if;
  select coalesce(sum(amount), 0),
         coalesce(sum(amount) filter (where kind in ('answer','admin')), 0)
    into v_bal, v_earned
    from public.wallet_tx where user_id = p.id;
  select coalesce(jsonb_agg(pu.item_id), '[]'::jsonb) into v_owned
    from public.purchases pu where pu.user_id = p.id and pu.status <> 'refunded' and pu.item_id is not null;
  return jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'avatar', p.avatar, 'photo', p.photo,
    'team', p.team, 'age', p.age, 'patrol_rank', p.patrol_rank, 'role', p.role, 'hidden', p.hidden,
    'streak', p.streak, 'best_streak', p.best_streak,
    'balance', v_bal, 'earned', v_earned, 'owned', v_owned,
    'owns_photo', exists (select 1 from public.purchases pu where pu.user_id = p.id and pu.kind = 'photo' and pu.status <> 'refunded'),
    'email', (select u.email from auth.users u where u.id = p.id));
end $$;

create or replace function public.save_profile(p_name text, p_team text, p_age int, p_rank text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 20 then raise exception 'E_NAME'; end if;
  if p_team is null or not public.team_ok(p_team) then raise exception 'E_TEAM'; end if;
  if p_age is null or p_age < 3 or p_age > 99 then raise exception 'E_AGE'; end if;
  if p_rank is null or not public.rank_ok(p_rank) then raise exception 'E_RANK'; end if;
  update public.profiles
     set display_name = v_name, team = p_team, age = p_age, patrol_rank = p_rank
   where id = auth.uid();
end $$;

-- Exclusive avatar pieces can only be used after buying them in the shop.
create or replace function public.save_avatar(p_avatar jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare it record; k text; v jsonb;
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  if p_avatar is null or jsonb_typeof(p_avatar) <> 'object' then raise exception 'E_BAD'; end if;
  for k, v in select key, value from jsonb_each(p_avatar) loop
    if k not in ('bg','skin','hairStyle','hairColor','eyes','mouth','accessory')
       or jsonb_typeof(v) <> 'number'
       or (v #>> '{}')::numeric not between 0 and 30
       or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) then
      raise exception 'E_BAD';
    end if;
  end loop;
  for it in select * from public.shop_items where active and kind = 'avatar' loop
    if (p_avatar ->> it.avatar_cat) = it.avatar_index::text
       and not exists (select 1 from public.purchases pu
                        where pu.user_id = auth.uid() and pu.item_id = it.id and pu.status <> 'refunded') then
      raise exception 'E_LOCKED';
    end if;
  end loop;
  update public.profiles set avatar = p_avatar where id = auth.uid();
end $$;

-- A real photo (small, resized in the browser) needs the photo item from the shop.
create or replace function public.set_photo(p_photo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  if p_photo is not null then
    if length(p_photo) > 40000 or left(p_photo, 11) <> 'data:image/' then raise exception 'E_BADPHOTO'; end if;
    if not exists (select 1 from public.purchases pu
                    where pu.user_id = auth.uid() and pu.kind = 'photo' and pu.status <> 'refunded') then
      raise exception 'E_LOCKED';
    end if;
  end if;
  update public.profiles set photo = p_photo where id = auth.uid();
end $$;

-- ---------- Daily quiz ----------
-- Builds today's quiz for one scout. A question's timer only starts when
-- the scout opens it (p_open = true), never just by looking at the page.
create or replace function public._play_build(uid uuid, p_open boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  today date := public.quiz_today();
  q public.questions;
  a public.answers;
  has_row boolean;
  qs jsonb := '[]'::jsonb;
  item jsonb;
  elapsed numeric;
  first_pending boolean := false;
  total int := 0; done_n int := 0; pts int := 0;
begin
  select * into p from public.profiles where id = uid;
  if not found or p.team is null then return jsonb_build_object('status', 'profile'); end if;

  for q in
    select * from public.questions
     where quiz_date = today and (cardinality(teams) = 0 or p.team = any (teams))
     order by (case difficulty when 'easy' then 1 when 'medium' then 2 else 3 end), pos, id
  loop
    total := total + 1;
    select * into a from public.answers where user_id = uid and question_id = q.id;
    has_row := found;

    -- time ran out while the scout was away: close it with no points
    if has_row and a.answered_at is null
       and extract(epoch from (clock_timestamp() - a.started_at)) > q.time_limit + 3 then
      update public.answers
         set answered_at = a.started_at + make_interval(secs => q.time_limit), expired = true, correct = false
       where id = a.id returning * into a;
    end if;

    if has_row and a.answered_at is not null then
      done_n := done_n + 1; pts := pts + a.points_earned;
      item := jsonb_build_object(
        'id', q.id, 'difficulty', q.difficulty, 'base_points', q.base_points, 'time_limit', q.time_limit,
        'status', 'done', 'question_ar', q.question_ar, 'question_en', q.question_en, 'options', q.options,
        'result', jsonb_build_object('correct', a.correct, 'expired', a.expired, 'choice', a.choice,
                  'correct_index', q.correct_index, 'points', a.points_earned, 'base', a.base_points,
                  'bonus', a.speed_bonus, 'streak_bonus', a.streak_bonus));
    elsif has_row then
      elapsed := extract(epoch from (clock_timestamp() - a.started_at));
      first_pending := true;
      item := jsonb_build_object(
        'id', q.id, 'difficulty', q.difficulty, 'base_points', q.base_points, 'time_limit', q.time_limit,
        'status', 'open', 'question_ar', q.question_ar, 'question_en', q.question_en, 'options', q.options,
        'seconds_left', greatest(0, q.time_limit - elapsed));
    elsif not first_pending then
      first_pending := true;
      if p_open then
        insert into public.answers (user_id, question_id, quiz_date) values (uid, q.id, today)
        on conflict (user_id, question_id) do nothing;
        select * into a from public.answers where user_id = uid and question_id = q.id;
        elapsed := extract(epoch from (clock_timestamp() - a.started_at));
        item := jsonb_build_object(
          'id', q.id, 'difficulty', q.difficulty, 'base_points', q.base_points, 'time_limit', q.time_limit,
          'status', 'open', 'question_ar', q.question_ar, 'question_en', q.question_en, 'options', q.options,
          'seconds_left', greatest(0, q.time_limit - elapsed));
      else
        item := jsonb_build_object('id', q.id, 'difficulty', q.difficulty, 'base_points', q.base_points,
                                   'time_limit', q.time_limit, 'status', 'ready');
      end if;
    else
      item := jsonb_build_object('id', q.id, 'difficulty', q.difficulty, 'base_points', q.base_points,
                                 'time_limit', q.time_limit, 'status', 'locked');
    end if;
    qs := qs || jsonb_build_array(item);
  end loop;

  return jsonb_build_object('status', case when total = 0 then 'none' else 'ok' end,
                            'date', today, 'questions', qs, 'total', total, 'done', done_n,
                            'points', pts, 'streak', p.streak);
end $$;

create or replace function public.play_state()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  return public._play_build(auth.uid(), false);
end $$;

create or replace function public.open_question()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  return public._play_build(auth.uid(), true);
end $$;

-- Checks the answer on the server and pays out Waadoz.
--   points = base + speed bonus (up to +50% for answering fast) + streak bonus (once a day)
create or replace function public.submit_answer(p_question_id bigint, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := public.quiz_today();
  p public.profiles; q public.questions; a public.answers;
  elapsed numeric; v_expired boolean; v_ok boolean;
  v_base int := 0; v_bonus int := 0; v_sb int := 0; v_total int; v_streak int;
begin
  if uid is null then raise exception 'E_AUTH'; end if;
  select * into p from public.profiles where id = uid for update;
  if not found or p.team is null then raise exception 'E_AUTH'; end if;

  select * into q from public.questions
   where id = p_question_id and quiz_date = today and (cardinality(teams) = 0 or p.team = any (teams));
  if not found then raise exception 'E_NOQ'; end if;

  select * into a from public.answers where user_id = uid and question_id = q.id for update;
  if not found then raise exception 'E_NOTOPEN'; end if;
  if a.answered_at is not null then raise exception 'E_ANSWERED'; end if;

  elapsed := extract(epoch from (clock_timestamp() - a.started_at));
  v_expired := elapsed > q.time_limit + 3;
  v_ok := (not v_expired) and p_choice = q.correct_index;

  v_streak := case when p.last_played = today - 1 then p.streak + 1
                   when p.last_played = today     then p.streak
                   else 1 end;

  if v_ok then
    v_base  := q.base_points;
    v_bonus := round(q.base_points * 0.5 * greatest(0, 1 - elapsed / greatest(q.time_limit, 1)));
    if not exists (select 1 from public.answers x
                    where x.user_id = uid and x.quiz_date = today and x.streak_bonus > 0) then
      v_sb := (least(v_streak, 6) - 1) * 10;
    end if;
  end if;
  v_total := v_base + v_bonus + v_sb;

  update public.answers
     set answered_at = clock_timestamp(), choice = p_choice, correct = v_ok, expired = v_expired,
         base_points = v_base, speed_bonus = v_bonus, streak_bonus = v_sb, points_earned = v_total
   where id = a.id;

  update public.profiles
     set streak = v_streak, best_streak = greatest(best_streak, v_streak), last_played = today
   where id = uid;

  if v_total > 0 then
    insert into public.wallet_tx (user_id, amount, kind, competition_id, question_id)
    values (uid, v_total, 'answer', q.competition_id, q.id);
  end if;

  return jsonb_build_object('correct', v_ok, 'expired', v_expired, 'choice', p_choice,
                            'correct_index', q.correct_index, 'points', v_total,
                            'base', v_base, 'bonus', v_bonus, 'streak_bonus', v_sb);
end $$;

-- ---------- Rankings ----------
--   p_scope:  'group' (everyone) or 'team' (the caller's team)
--   p_period: 'day' | 'week' (last 7 days) | 'month' (calendar month) | 'all'
--   p_competition: only Waadoz earned in that competition (or null for everything)
-- Spending Waadoz never lowers a rank: only earned Waadoz count.
create or replace function public.leaderboard(p_scope text, p_period text, p_competition bigint default null)
returns table (rank_no bigint, user_id uuid, display_name text, avatar jsonb, photo text,
               team text, points bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (select pr.team from public.profiles pr where pr.id = auth.uid()),
  lim as (
    select case p_period
             when 'day'   then public.quiz_today()
             when 'week'  then public.quiz_today() - 6
             when 'month' then date_trunc('month', public.quiz_today())::date
             else date '1970-01-01' end as d
  ),
  sums as (
    select t.user_id as uid, sum(t.amount)::bigint as pts
      from public.wallet_tx t
      join public.profiles pf on pf.id = t.user_id
     where t.kind in ('answer', 'admin')
       and t.tx_date >= (select d from lim)
       and (p_competition is null or t.competition_id = p_competition)
       and not pf.hidden
       and (p_scope <> 'team' or pf.team = (select team from me))
     group by t.user_id
    having sum(t.amount) > 0
  ),
  ranked as (
    select rank() over (order by s.pts desc) as rk, s.uid, s.pts from sums s
  )
  select r.rk, pf.id, pf.display_name, pf.avatar, pf.photo, pf.team, r.pts, (pf.id = auth.uid())
    from ranked r
    join public.profiles pf on pf.id = r.uid
   where r.rk <= 50 or pf.id = auth.uid()
   order by r.rk, pf.display_name
$$;

create or replace function public.my_ranks(p_period text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'group',  (select l.rank_no from public.leaderboard('group', p_period, null) l where l.is_me),
    'team',   (select l.rank_no from public.leaderboard('team',  p_period, null) l where l.is_me),
    'points', (select l.points  from public.leaderboard('group', p_period, null) l where l.is_me))
$$;

create or replace function public.competitions_list(p_all boolean default false)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.starts_on desc, c.id desc), '[]'::jsonb)
    from (select id, name_ar, name_en, starts_on, ends_on
            from public.competitions
           where p_all or starts_on <= public.quiz_today()
           order by starts_on desc, id desc limit 12) c
$$;

-- ---------- Wallet and shop ----------
create or replace function public.wallet_history()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc), '[]'::jsonb)
    from (select id, amount, kind, note, tx_date
            from public.wallet_tx where user_id = auth.uid() order by id desc limit 40) x
$$;

create or replace function public.shop_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'kind', i.kind, 'name_ar', i.name_ar, 'name_en', i.name_en,
           'description_ar', i.description_ar, 'description_en', i.description_en,
           'price', i.price, 'avatar_cat', i.avatar_cat, 'avatar_index', i.avatar_index, 'stock', i.stock,
           'owned', case when i.kind = 'reward' then false else exists (
                      select 1 from public.purchases pu
                       where pu.user_id = auth.uid() and pu.status <> 'refunded'
                         and (pu.item_id = i.id or (i.kind = 'photo' and pu.kind = 'photo'))) end)
         order by i.sort, i.id), '[]'::jsonb)
    from public.shop_items i where i.active
$$;

create or replace function public.buy_item(p_item_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles; it public.shop_items; v_bal bigint;
begin
  if uid is null then raise exception 'E_AUTH'; end if;
  select * into p from public.profiles where id = uid for update;   -- one purchase at a time
  if not found then raise exception 'E_AUTH'; end if;
  select * into it from public.shop_items where id = p_item_id and active for update;
  if not found then raise exception 'E_ITEM'; end if;
  if it.kind in ('avatar', 'photo') and exists (
       select 1 from public.purchases pu
        where pu.user_id = uid and pu.status <> 'refunded'
          and (pu.item_id = it.id or (it.kind = 'photo' and pu.kind = 'photo'))) then
    raise exception 'E_OWNED';
  end if;
  if it.stock is not null and it.stock <= 0 then raise exception 'E_STOCK'; end if;
  select coalesce(sum(amount), 0) into v_bal from public.wallet_tx where user_id = uid;
  if v_bal < it.price then raise exception 'E_NOFUNDS'; end if;
  if it.stock is not null then update public.shop_items set stock = stock - 1 where id = it.id; end if;
  insert into public.purchases (user_id, item_id, item_name, kind, price, status)
  values (uid, it.id, it.name_ar, it.kind, it.price, case when it.kind = 'reward' then 'pending' else 'done' end);
  insert into public.wallet_tx (user_id, amount, kind, note) values (uid, -it.price, 'purchase', it.name_ar);
  return jsonb_build_object('ok', true, 'balance', v_bal - it.price);
end $$;

-- ---------- Portfolio (camps and events) ----------
create or replace function public.portfolio_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.happened_on desc nulls last, x.id desc), '[]'::jsonb)
    from (select id, kind, title, happened_on, notes from public.portfolio where user_id = auth.uid()) x
$$;

create or replace function public.portfolio_add(p_kind text, p_title text, p_date date, p_notes text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_title text := trim(coalesce(p_title, ''));
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  if p_kind not in ('camp', 'event') then raise exception 'E_BAD'; end if;
  if char_length(v_title) < 2 or char_length(v_title) > 80 then raise exception 'E_TITLE'; end if;
  insert into public.portfolio (user_id, kind, title, happened_on, notes)
  values (auth.uid(), p_kind, v_title, p_date, nullif(left(trim(coalesce(p_notes, '')), 300), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.portfolio_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'E_AUTH'; end if;
  delete from public.portfolio where id = p_id and user_id = auth.uid();
end $$;

-- ============================================================
--  Admin functions (admins and the owner only)
-- ============================================================

create or replace function public.admin_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'scouts', (select count(*) from public.profiles),
    'active_today', (select count(distinct a.user_id) from public.answers a
                      where a.quiz_date = public.quiz_today() and a.answered_at is not null),
    'pending_orders', (select count(*) from public.purchases where kind = 'reward' and status = 'pending'));
end $$;

create or replace function public.admin_scouts()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'display_name', p.display_name, 'team', p.team, 'age', p.age,
             'patrol_rank', p.patrol_rank, 'role', p.role, 'hidden', p.hidden,
             'has_photo', p.photo is not null, 'last_played', p.last_played, 'created_at', p.created_at,
             'email', u.email, 'balance', coalesce(w.bal, 0), 'earned', coalesce(w.earned, 0))
           order by p.created_at desc)
      from public.profiles p
      left join auth.users u on u.id = p.id
      left join (select t.user_id, sum(t.amount) as bal,
                        sum(t.amount) filter (where t.kind in ('answer', 'admin')) as earned
                   from public.wallet_tx t group by t.user_id) w on w.user_id = p.id), '[]'::jsonb);
end $$;

create or replace function public.admin_update_scout(p_id uuid, p_name text, p_team text, p_age int, p_rank text, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := trim(coalesce(p_name, ''));
begin
  perform public.require_admin();
  if char_length(v_name) < 2 or char_length(v_name) > 20 then raise exception 'E_NAME'; end if;
  if p_team is null or not public.team_ok(p_team) then raise exception 'E_TEAM'; end if;
  if p_age is null or p_age < 3 or p_age > 99 then raise exception 'E_AGE'; end if;
  if p_rank is null or not public.rank_ok(p_rank) then raise exception 'E_RANK'; end if;
  update public.profiles
     set display_name = v_name, team = p_team, age = p_age, patrol_rank = p_rank, hidden = coalesce(p_hidden, false)
   where id = p_id;
end $$;

-- Only the owner can add or remove admins.
create or replace function public.admin_set_role(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'E_FORBIDDEN'; end if;
  if p_role not in ('player', 'admin') then raise exception 'E_BAD'; end if;
  update public.profiles set role = p_role where id = p_id and role <> 'owner';
end $$;

create or replace function public.admin_adjust(p_id uuid, p_amount int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then raise exception 'E_BAD'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then raise exception 'E_BAD'; end if;
  insert into public.wallet_tx (user_id, amount, kind, note)
  values (p_id, p_amount, 'admin', nullif(left(trim(coalesce(p_note, '')), 80), ''));
end $$;

create or replace function public.admin_clear_photo(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.profiles set photo = null where id = p_id;
end $$;

-- ---------- Questions ----------
create or replace function public.admin_questions(p_from date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id, 'quiz_date', q.quiz_date, 'pos', q.pos, 'difficulty', q.difficulty,
             'competition_id', q.competition_id, 'teams', to_jsonb(q.teams),
             'question_ar', q.question_ar, 'question_en', q.question_en, 'options', q.options,
             'correct_index', q.correct_index, 'base_points', q.base_points, 'time_limit', q.time_limit)
           order by q.quiz_date, (case q.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end), q.pos, q.id)
      from public.questions q where q.quiz_date >= coalesce(p_from, public.quiz_today())), '[]'::jsonb);
end $$;

-- Saves several questions at once. An item with an "id" updates that question.
create or replace function public.admin_save_questions(p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v_id bigint; v_opts jsonb; v_teams text[]; v_n int := 0; v_diff text;
  v_corr int; v_pts int; v_time int; v_date date; v_comp bigint; v_pos int;
  v_qa text; v_qe text;
begin
  perform public.require_admin();
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'E_BAD';
  end if;
  for it in select value from jsonb_array_elements(p_items) loop
    v_opts := it -> 'options';
    if v_opts is null or jsonb_typeof(v_opts) <> 'array' or jsonb_array_length(v_opts) not between 2 and 4 then
      raise exception 'E_OPTIONS';
    end if;
    v_corr := (it ->> 'correct_index')::int;
    if v_corr is null or v_corr < 0 or v_corr >= jsonb_array_length(v_opts) then raise exception 'E_OPTIONS'; end if;
    v_qa := nullif(trim(coalesce(it ->> 'question_ar', '')), '');
    v_qe := nullif(trim(coalesce(it ->> 'question_en', '')), '');
    if v_qa is null and v_qe is null then raise exception 'E_QTEXT'; end if;
    v_diff := coalesce(it ->> 'difficulty', 'easy');
    if v_diff not in ('easy', 'medium', 'hard') then raise exception 'E_BAD'; end if;
    v_pts  := coalesce((it ->> 'base_points')::int, 100);
    v_time := coalesce((it ->> 'time_limit')::int, 30);
    if v_pts not between 1 and 10000 or v_time not between 5 and 600 then raise exception 'E_BAD'; end if;
    v_date := (it ->> 'quiz_date')::date;
    if v_date is null then raise exception 'E_BAD'; end if;
    v_pos  := coalesce((it ->> 'pos')::int, v_n + 1);
    v_comp := nullif(it ->> 'competition_id', '')::bigint;
    v_teams := array(select jsonb_array_elements_text(coalesce(it -> 'teams', '[]'::jsonb)));
    if exists (select 1 from unnest(v_teams) x where not public.team_ok(x)) then raise exception 'E_TEAM'; end if;
    v_id := nullif(it ->> 'id', '')::bigint;
    if v_id is null then
      insert into public.questions (quiz_date, pos, difficulty, competition_id, teams, question_ar, question_en,
                                    options, correct_index, base_points, time_limit)
      values (v_date, v_pos, v_diff, v_comp, v_teams, v_qa, v_qe, v_opts, v_corr, v_pts, v_time);
    else
      update public.questions
         set quiz_date = v_date, pos = v_pos, difficulty = v_diff, competition_id = v_comp, teams = v_teams,
             question_ar = v_qa, question_en = v_qe, options = v_opts, correct_index = v_corr,
             base_points = v_pts, time_limit = v_time
       where id = v_id;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.admin_delete_question(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.questions where id = p_id;
end $$;

-- ---------- Competitions ----------
create or replace function public.admin_save_competition(p_id bigint, p_name_ar text, p_name_en text, p_starts date, p_ends date)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_ar text := trim(coalesce(p_name_ar, ''));
begin
  perform public.require_admin();
  if char_length(v_ar) < 2 or char_length(v_ar) > 60 then raise exception 'E_NAME'; end if;
  if p_starts is null or p_ends is null or p_ends < p_starts then raise exception 'E_DATES'; end if;
  if p_id is null then
    insert into public.competitions (name_ar, name_en, starts_on, ends_on)
    values (v_ar, nullif(trim(coalesce(p_name_en, '')), ''), p_starts, p_ends) returning id into v_id;
  else
    update public.competitions
       set name_ar = v_ar, name_en = nullif(trim(coalesce(p_name_en, '')), ''), starts_on = p_starts, ends_on = p_ends
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_competition(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.competitions where id = p_id;
end $$;

-- ---------- Shop management ----------
create or replace function public.admin_shop_items()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(i) || jsonb_build_object(
             'sold', (select count(*) from public.purchases pu where pu.item_id = i.id and pu.status <> 'refunded'))
           order by i.sort, i.id)
      from public.shop_items i), '[]'::jsonb);
end $$;

create or replace function public.admin_save_item(p_id bigint, p_item jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; v_kind text; v_ar text; v_price int; v_cat text; v_idx int; v_stock int;
begin
  perform public.require_admin();
  v_kind := p_item ->> 'kind';
  if v_kind is null or v_kind not in ('avatar', 'photo', 'reward') then raise exception 'E_BAD'; end if;
  v_ar := nullif(trim(coalesce(p_item ->> 'name_ar', '')), '');
  if v_ar is null then raise exception 'E_NAME'; end if;
  v_price := (p_item ->> 'price')::int;
  if v_price is null or v_price < 0 or v_price > 1000000 then raise exception 'E_BAD'; end if;
  v_stock := nullif(p_item ->> 'stock', '')::int;
  if v_kind = 'avatar' then
    v_cat := p_item ->> 'avatar_cat';
    v_idx := (p_item ->> 'avatar_index')::int;
    if v_cat is null or v_cat not in ('bg','skin','hairStyle','hairColor','eyes','mouth','accessory')
       or v_idx is null or v_idx < 0 or v_idx > 30 then
      raise exception 'E_BAD';
    end if;
  end if;
  if p_id is null then
    insert into public.shop_items (kind, name_ar, name_en, description_ar, description_en, price,
                                   avatar_cat, avatar_index, stock, active, sort)
    values (v_kind, v_ar, nullif(trim(coalesce(p_item ->> 'name_en', '')), ''),
            nullif(trim(coalesce(p_item ->> 'description_ar', '')), ''),
            nullif(trim(coalesce(p_item ->> 'description_en', '')), ''),
            v_price, v_cat, v_idx, v_stock, coalesce((p_item ->> 'active')::boolean, true),
            coalesce((p_item ->> 'sort')::int, 0))
    returning id into v_id;
  else
    update public.shop_items
       set kind = v_kind, name_ar = v_ar, name_en = nullif(trim(coalesce(p_item ->> 'name_en', '')), ''),
           description_ar = nullif(trim(coalesce(p_item ->> 'description_ar', '')), ''),
           description_en = nullif(trim(coalesce(p_item ->> 'description_en', '')), ''),
           price = v_price, avatar_cat = v_cat, avatar_index = v_idx, stock = v_stock,
           active = coalesce((p_item ->> 'active')::boolean, true), sort = coalesce((p_item ->> 'sort')::int, sort)
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_item(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.shop_items where id = p_id;
end $$;

-- Rewards that scouts bought and are waiting to be handed over at the center
create or replace function public.admin_orders()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', pu.id, 'display_name', p.display_name, 'team', p.team, 'item_name', pu.item_name,
             'price', pu.price, 'created_at', pu.created_at) order by pu.id)
      from public.purchases pu join public.profiles p on p.id = pu.user_id
     where pu.kind = 'reward' and pu.status = 'pending'), '[]'::jsonb);
end $$;

create or replace function public.admin_deliver(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.purchases set status = 'delivered' where id = p_id and status = 'pending';
end $$;

-- ---------- Permissions: signed-in scouts can call the functions ----------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'quiz_today','is_admin','is_owner','require_admin','team_ok','rank_ok','me','save_profile','save_avatar',
         'set_photo','_play_build','play_state','open_question','submit_answer','leaderboard','my_ranks',
         'competitions_list','wallet_history','shop_list','buy_item','portfolio_list','portfolio_add',
         'portfolio_delete','admin_summary','admin_scouts','admin_update_scout','admin_set_role','admin_adjust',
         'admin_clear_photo','admin_questions','admin_save_questions','admin_delete_question',
         'admin_save_competition','admin_delete_competition','admin_shop_items','admin_save_item',
         'admin_delete_item','admin_orders','admin_deliver','handle_new_user')
  loop
    execute 'revoke all on function ' || r.sig || ' from public, anon, authenticated';
    if r.name not in ('_play_build', 'handle_new_user') then
      execute 'grant execute on function ' || r.sig || ' to authenticated';
    end if;
  end loop;
end $$;

-- ============================================================
--  Starter content (only added when the tables are empty)
--  Edit or delete all of this from the Admin screen.
-- ============================================================

insert into public.competitions (name_ar, name_en, starts_on, ends_on)
select 'أبطال أكتوبر', 'October Champions', date '2026-10-01', date '2026-10-31'
 where not exists (select 1 from public.competitions);

insert into public.questions (quiz_date, pos, difficulty, competition_id, teams, question_ar, question_en,
                              options, correct_index, base_points, time_limit)
select public.quiz_today(), v.pos, v.diff, (select min(id) from public.competitions), '{}',
       v.qa, v.qe, v.opts::jsonb, v.corr, v.pts, v.tm
  from (values
    (1, 'easy',   'ما هو شعار الكشافة؟', 'What is the Scout motto?',
     '[{"ar":"كن مستعدًا","en":"Be Prepared"},{"ar":"اعمل بجد","en":"Work Hard"},{"ar":"دائمًا للأمام","en":"Always Forward"},{"ar":"الوعد أمانة","en":"A Promise Is Trust"}]', 0, 100, 30),
    (2, 'medium', 'من هو مؤسس الحركة الكشفية؟', 'Who founded the Scout movement?',
     '[{"ar":"بادن باول","en":"Baden-Powell"},{"ar":"إديسون","en":"Edison"},{"ar":"نيوتن","en":"Newton"},{"ar":"كولومبوس","en":"Columbus"}]', 0, 150, 40),
    (3, 'hard',   'ما عاصمة اليابان؟', 'What is the capital of Japan?',
     '[{"ar":"طوكيو","en":"Tokyo"},{"ar":"كيوتو","en":"Kyoto"},{"ar":"أوساكا","en":"Osaka"},{"ar":"سول","en":"Seoul"}]', 0, 200, 60)
  ) as v(pos, diff, qa, qe, opts, corr, pts, tm)
 where not exists (select 1 from public.questions);

insert into public.shop_items (kind, name_ar, name_en, description_ar, description_en, price, avatar_cat, avatar_index, active, sort)
select * from (values
  ('photo',  'صورتي الشخصية',   'My own photo',    'ارفع صورتك لتظهر بدل الأفاتار', 'Upload your photo to show instead of the avatar', 500, null, null, true, 1),
  ('avatar', 'تاج الأبطال',    'Champion crown',  'تاج ذهبي للأبطال فقط',          'A golden crown for champions',                    400, 'accessory', 3, true, 2),
  ('avatar', 'قبعة الساحر',    'Wizard hat',      'قبعة سحرية مميزة',              'A special magic hat',                             300, 'accessory', 6, true, 3),
  ('avatar', 'أذنا الأرنب',    'Bunny ears',      'أذنان مرحتان',                  'Fun bunny ears',                                  200, 'accessory', 5, true, 4),
  ('avatar', 'نظارة شمسية',    'Sunglasses',      'نظارة سوداء أنيقة',             'Cool dark sunglasses',                            150, 'accessory', 2, true, 5),
  ('avatar', 'عيون النجوم',    'Star eyes',       'عيون لامعة كالنجوم',            'Eyes that sparkle like stars',                    120, 'eyes', 4, true, 6),
  ('avatar', 'تسريحة الموهوك', 'Mohawk hair',     'تسريحة جريئة',                  'A bold hairstyle',                                120, 'hairStyle', 5, true, 7),
  ('avatar', 'شعر فضي',        'Silver hair',     'لون شعر فضي لامع',              'Shiny silver hair color',                         100, 'hairColor', 6, true, 8),
  ('avatar', 'خلفية الليل',    'Night background', 'خلفية داكنة أنيقة',            'A dark stylish background',                        80, 'bg', 7, true, 9),
  ('reward', 'هدية من متجر المركز', 'Gift from the center shop', 'تُسلَّم لك في المركز الكشفي', 'Handed to you at the scout center',   1500, null, null, false, 20)
) as v(kind, name_ar, name_en, description_ar, description_en, price, avatar_cat, avatar_index, active, sort)
 where not exists (select 1 from public.shop_items);

-- ============================================================
--  MAKE YOURSELF THE OWNER (run once, after you sign up on the site):
--
--    update public.profiles set role = 'owner'
--     where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
--
--  (If you already made yourself admin in the old version, you are
--   the owner now and don't need to do anything.)
-- ============================================================
