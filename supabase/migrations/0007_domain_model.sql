-- 0007_domain_model.sql
-- HENUZ UYGULANMADI. Hedef domain modeli — bkz. docs/DOMAIN.md
--
-- Bu migrasyon additive: mevcut team_predictions / team_results / team_locks
-- tablolarina dokunmaz. Uygulama gecisi tamamlanana kadar ikisi yan yana durur.
--
-- 0002_multi_league.sql bu dosyanin yerine gecti, uygulanmamalidir.

-- ============================================================ gercek dunya

create table teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  short_name   text not null,
  slug         text not null unique,
  country_code text,
  crest_url    text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table competitions (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  slug   text not null unique,
  kind   text not null default 'league' check (kind in ('league','cup','mixed')),
  region text
);

create table competition_seasons (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  label          text not null,                    -- '2026/27'
  starts_at      timestamptz,
  ends_at        timestamptz,
  status         text not null default 'upcoming'
                 check (status in ('upcoming','active','finished')),
  unique (competition_id, label)
);

create table fixtures (
  id                    uuid primary key default gen_random_uuid(),
  competition_season_id uuid not null references competition_seasons(id) on delete cascade,
  matchday              int  not null,
  home_team_id          uuid not null references teams(id),
  away_team_id          uuid not null references teams(id),
  kickoff_at            timestamptz not null,
  status                text not null default 'scheduled'
                        check (status in ('scheduled','live','finished','postponed')),
  home_goals            int check (home_goals >= 0),
  away_goals            int check (away_goals >= 0),
  updated_at            timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  unique (competition_season_id, matchday, home_team_id, away_team_id)
);

create index on fixtures (competition_season_id, kickoff_at);
create index on fixtures (home_team_id);
create index on fixtures (away_team_id);

-- ================================================================ oyun

-- profiles zaten 0003'te olusturuldu; burada yalnizca eksik sutun eklenir.
alter table profiles add column if not exists avatar_url text;

create table prediction_leagues (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(trim(name)) between 1 and 60),
  slug                  text not null unique,
  owner_user_id         uuid not null references profiles(id) on delete restrict,
  competition_season_id uuid not null references competition_seasons(id),
  visibility            text not null default 'private'
                        check (visibility in ('public','private')),
  join_policy           text not null default 'invite_only'
                        check (join_policy in ('open','invite_only','request')),
  invite_code           text unique,
  -- Oyunun temeli kilit oncesi gizlilik. 'live' bilincli bir tercih olmali.
  prediction_visibility text not null default 'after_lock'
                        check (prediction_visibility in ('live','after_lock')),
  lock_lead             interval not null default '1 hour',
  system_managed        boolean not null default false,
  created_at            timestamptz not null default now(),
  archived_at           timestamptz
);

create table prediction_league_teams (
  league_id uuid not null references prediction_leagues(id) on delete cascade,
  team_id   uuid not null references teams(id),
  primary key (league_id, team_id)
);

create table prediction_league_members (
  league_id uuid not null references prediction_leagues(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table predictions (
  league_id       uuid not null references prediction_leagues(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  fixture_id      uuid not null references fixtures(id) on delete cascade,
  subject_team_id uuid not null references teams(id),
  points          int  not null check (points in (0,1,3)),
  confirmed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (league_id, user_id, fixture_id, subject_team_id)
);

create index on predictions (league_id, subject_team_id);

-- ========================================================== yardimcilar

create or replace function is_member(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from prediction_league_members m
    where m.league_id = l and m.user_id = auth.uid()
  );
$$;

create or replace function is_league_admin(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from prediction_league_members m
    where m.league_id = l and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

-- Kilit ani turetilir: takimin o sezondaki ilk macindan lock_lead kadar once.
create or replace function lock_at(l uuid, t uuid) returns timestamptz
language sql stable as $$
  select min(f.kickoff_at) - lg.lock_lead
  from prediction_leagues lg
  join fixtures f on f.competition_season_id = lg.competition_season_id
  where lg.id = l
    and (f.home_team_id = t or f.away_team_id = t)
  group by lg.lock_lead;
$$;

create or replace function picks_open(l uuid, t uuid) returns boolean
language sql stable as $$
  select coalesce(now() < lock_at(l, t), false);
$$;

create or replace function team_locked(l uuid, t uuid) returns boolean
language sql stable as $$
  select not picks_open(l, t);
$$;

-- =================================================================== RLS

alter table teams                     enable row level security;
alter table competitions              enable row level security;
alter table competition_seasons       enable row level security;
alter table fixtures                  enable row level security;
alter table prediction_leagues        enable row level security;
alter table prediction_league_teams   enable row level security;
alter table prediction_league_members enable row level security;
alter table predictions               enable row level security;

-- Gercek dunya verisi: herkes okur, yalnizca sistem yoneticisi yazar.
create policy "takim oku"     on teams               for select using (true);
create policy "takim yaz"     on teams               for all using (is_app_admin()) with check (is_app_admin());
create policy "turnuva oku"   on competitions        for select using (true);
create policy "turnuva yaz"   on competitions        for all using (is_app_admin()) with check (is_app_admin());
create policy "sezon oku"     on competition_seasons for select using (true);
create policy "sezon yaz"     on competition_seasons for all using (is_app_admin()) with check (is_app_admin());
create policy "fikstur oku"   on fixtures            for select using (true);
create policy "fikstur yaz"   on fixtures            for all using (is_app_admin()) with check (is_app_admin());

-- Lig: uyeler gorur, public ligler herkese gorunur.
create policy "lig oku" on prediction_leagues for select
  using (visibility = 'public' or is_member(id));
create policy "lig kur" on prediction_leagues for insert
  with check (owner_user_id = auth.uid());
create policy "lig guncelle" on prediction_leagues for update
  using (is_league_admin(id)) with check (is_league_admin(id));

create policy "lig takim oku" on prediction_league_teams for select using (is_member(league_id));
create policy "lig takim yaz" on prediction_league_teams for all
  using (is_league_admin(league_id)) with check (is_league_admin(league_id));

create policy "uye oku"    on prediction_league_members for select using (is_member(league_id));
create policy "uye katil"  on prediction_league_members for insert with check (user_id = auth.uid());
create policy "uye yonet"  on prediction_league_members for update
  using (is_league_admin(league_id)) with check (is_league_admin(league_id));

-- Tahmin okuma: kendi tahminin her zaman; baskasininki lig ayarina ve kilide bagli.
create policy "tahmin oku" on predictions for select
  using (
    is_member(league_id)
    and (
      user_id = auth.uid()
      or exists (
        select 1 from prediction_leagues lg
        where lg.id = league_id and lg.prediction_visibility = 'live'
      )
      or team_locked(league_id, subject_team_id)
    )
  );

-- Tahmin yazma: yalnizca kendi satirin ve yalnizca kilit acikken.
create policy "tahmin ekle" on predictions for insert
  with check (
    user_id = auth.uid()
    and is_member(league_id)
    and picks_open(league_id, subject_team_id)
  );

create policy "tahmin guncelle" on predictions for update
  using (user_id = auth.uid() and picks_open(league_id, subject_team_id))
  with check (user_id = auth.uid() and picks_open(league_id, subject_team_id));

-- ============================================================== notlar
--
-- Uygulama sirasi ve seed adimlari icin docs/DOMAIN.md "Gecis plani".
-- Bu migrasyon uygulandiginda hicbir sey onu okumaz; mevcut uygulama
-- team_predictions / team_results uzerinden calismaya devam eder.
