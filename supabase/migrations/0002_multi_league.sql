-- Faz 2 hedef semasi. HENUZ UYGULANMADI.
-- app/index.html bu semayi kullanmiyor; once on yuz tasinmali (bkz. ROADMAP.md).
-- Uygulamadan once bos bir Supabase projesinde deneyin.

-- ---------------------------------------------------------------- profiller
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------- ligler
create table leagues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 60),
  invite_code  text not null unique,          -- 6-8 karakter, paylasilabilir
  owner_id     uuid not null references profiles(id) on delete cascade,
  competition  text not null default 'CL',
  season       text not null default '2026/27',
  lock_lead    interval not null default '1 hour',
  created_at   timestamptz not null default now()
);

create table league_members (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Bir ligin takip ettigi takimlar. Bugun gs + fb; baska gruplar baska takim secebilir.
create table league_teams (
  league_id uuid not null references leagues(id) on delete cascade,
  team_key  text not null,
  primary key (league_id, team_key)
);

-- -------------------------------------------------------------- fikstur
-- Ligden bagimsiz, paylasilan veri. Koda gomulu dizi yerine tablo.
create table fixtures (
  id          uuid primary key default gen_random_uuid(),
  competition text not null,
  season      text not null,
  team_key    text not null,               -- 'gs', 'fb', ...
  matchday    int  not null check (matchday between 1 and 20),
  opponent    text not null,
  is_home     boolean not null,
  kickoff_at  timestamptz not null,
  unique (competition, season, team_key, matchday)
);

-- --------------------------------------------------------------- tahminler
create table predictions (
  league_id    uuid not null references leagues(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  fixture_id   uuid not null references fixtures(id) on delete cascade,
  points       int  not null check (points in (0,1,3)),
  confirmed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (league_id, user_id, fixture_id)
);

-- --------------------------------------------------------------- sonuclar
-- Lig basina ayri: her ligin admini kendi girer, bir grubun hatasi digerini etkilemez.
create table results (
  league_id       uuid not null references leagues(id) on delete cascade,
  fixture_id      uuid not null references fixtures(id) on delete cascade,
  goals_for       int  not null check (goals_for >= 0),
  goals_against   int  not null check (goals_against >= 0),
  points          int  not null check (points in (0,1,3)),
  entered_by      uuid references profiles(id),
  updated_at      timestamptz not null default now(),
  primary key (league_id, fixture_id)
);

-- ------------------------------------------------------------ yardimcilar
create or replace function is_member(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from league_members m
    where m.league_id = l and m.user_id = auth.uid()
  );
$$;

create or replace function is_admin(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from league_members m
    where m.league_id = l and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- Tahmin kilidi: o takimin ilk macindan lock_lead kadar once kapanir.
create or replace function picks_open(l uuid, f uuid) returns boolean
language sql stable as $$
  select now() < (
    select min(fx2.kickoff_at) - lg.lock_lead
    from fixtures fx1
    join fixtures fx2
      on fx2.competition = fx1.competition
     and fx2.season      = fx1.season
     and fx2.team_key    = fx1.team_key
    join leagues lg on lg.id = l
    where fx1.id = f
  );
$$;

-- ------------------------------------------------------------------- RLS
alter table profiles       enable row level security;
alter table leagues        enable row level security;
alter table league_members enable row level security;
alter table league_teams   enable row level security;
alter table fixtures       enable row level security;
alter table predictions    enable row level security;
alter table results        enable row level security;

create policy "profil oku"    on profiles for select using (true);
create policy "profil yaz"    on profiles for insert with check (id = auth.uid());
create policy "profil guncel" on profiles for update using (id = auth.uid());

create policy "lig oku"    on leagues for select using (is_member(id));
create policy "lig kur"    on leagues for insert with check (owner_id = auth.uid());
create policy "lig guncel" on leagues for update using (is_admin(id));

create policy "uyeler oku"  on league_members for select using (is_member(league_id));
create policy "uye ekle"    on league_members for insert with check (user_id = auth.uid());
create policy "uye yonet"   on league_members for update using (is_admin(league_id));

create policy "takim oku"   on league_teams for select using (is_member(league_id));
create policy "takim yaz"   on league_teams for all    using (is_admin(league_id));

create policy "fikstur oku" on fixtures for select using (true);

create policy "tahmin oku"  on predictions for select using (is_member(league_id));
create policy "tahmin yaz"  on predictions for insert
  with check (user_id = auth.uid() and is_member(league_id) and picks_open(league_id, fixture_id));
create policy "tahmin guncel" on predictions for update
  using       (user_id = auth.uid() and picks_open(league_id, fixture_id))
  with check  (user_id = auth.uid() and picks_open(league_id, fixture_id));

create policy "sonuc oku" on results for select using (is_member(league_id));
create policy "sonuc yaz" on results for all    using (is_admin(league_id))
                                     with check (is_admin(league_id));

-- Not: kilit ve yetki artik sunucuda uygulanir. Arayuz sadece gorunumu ayarlar.
