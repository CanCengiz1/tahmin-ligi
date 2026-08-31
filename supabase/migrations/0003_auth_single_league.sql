-- Faz 1.5: mevcut tek-lig UI'yi koruyup kimlik/yetki/veri erişimini güvenli hale getirir.
-- Eski entries JSON tablosu artık uygulama tarafından kullanılmaz. Yeni yapı takım bazlı
-- prediction satırları kullandığı için GS kilitliyken FB tahminlerinin API üzerinden sızması
-- da engellenebilir.

-- --------------------------------------------------------------- profiller
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 40),
  created_at   timestamptz not null default now()
);

create unique index if not exists profiles_display_name_unique
  on profiles (lower(trim(display_name)));

alter table profiles enable row level security;

drop policy if exists "profil oku" on profiles;
drop policy if exists "profil yaz" on profiles;
drop policy if exists "profil guncel" on profiles;

create policy "profil oku" on profiles
  for select to authenticated using (true);
create policy "profil yaz" on profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profil guncel" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Sign-up sırasında verilen display_name'i auth.users -> profiles'e taşır.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if length(v_display_name) < 2 or length(v_display_name) > 40 then
    raise exception 'display_name must be between 2 and 40 characters';
  end if;

  insert into public.profiles(id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ---------------------------------------------------------------- adminler
create table if not exists app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table app_admins enable row level security;
drop policy if exists "kendi admin durumunu oku" on app_admins;
create policy "kendi admin durumunu oku" on app_admins
  for select to authenticated using (user_id = auth.uid());

-- İstemciye app_admins INSERT/UPDATE/DELETE politikası verilmez.
-- Admin ataması SQL Editor / service role ile yapılır:
-- insert into app_admins(user_id)
-- select id from auth.users where email = 'admin@example.com';

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

-- --------------------------------------------------------------- takım kilitleri
create table if not exists team_locks (
  team_key text primary key check (team_key in ('gs','fb')),
  lock_at  timestamptz not null
);

insert into team_locks(team_key, lock_at) values
  ('gs', '2026-09-09T18:00:00Z'),
  ('fb', '2026-09-10T18:00:00Z')
on conflict (team_key) do update set lock_at = excluded.lock_at;

alter table team_locks enable row level security;
drop policy if exists "kilitleri oku" on team_locks;
create policy "kilitleri oku" on team_locks
  for select to authenticated using (true);

create or replace function public.predictions_open(p_team_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(now() < (select lock_at from public.team_locks where team_key = p_team_key), false);
$$;

revoke all on function public.predictions_open(text) from public;
grant execute on function public.predictions_open(text) to authenticated;

-- --------------------------------------------------------------- tahminler
create table if not exists team_predictions (
  user_id      uuid not null references profiles(id) on delete cascade,
  team_key     text not null check (team_key in ('gs','fb')),
  picks        jsonb not null default '[null,null,null,null,null,null,null,null]'::jsonb,
  confirmed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, team_key),
  constraint predictions_picks_array check (
    jsonb_typeof(picks) = 'array' and jsonb_array_length(picks) = 8
  )
);

alter table team_predictions enable row level security;

drop policy if exists "tahmin oku" on team_predictions;
drop policy if exists "tahmin ekle" on team_predictions;
drop policy if exists "tahmin guncelle" on team_predictions;

-- Kendi tahminin her zaman okunabilir. Başkasının takım tahmini sadece o takım
-- server saatine göre kilitlendikten sonra görünür.
create policy "tahmin oku" on team_predictions
  for select to authenticated
  using (user_id = auth.uid() or not public.predictions_open(team_key));

create policy "tahmin ekle" on team_predictions
  for insert to authenticated
  with check (user_id = auth.uid() and public.predictions_open(team_key));

create policy "tahmin guncelle" on team_predictions
  for update to authenticated
  using (user_id = auth.uid() and public.predictions_open(team_key))
  with check (user_id = auth.uid() and public.predictions_open(team_key));

-- ---------------------------------------------------------------- sonuçlar
create table if not exists team_results (
  team_key    text primary key check (team_key in ('gs','fb')),
  points      jsonb not null default '[null,null,null,null,null,null,null,null]'::jsonb,
  scores      jsonb not null default '[null,null,null,null,null,null,null,null]'::jsonb,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now(),
  constraint results_points_array check (
    jsonb_typeof(points) = 'array' and jsonb_array_length(points) = 8
  ),
  constraint results_scores_array check (
    jsonb_typeof(scores) = 'array' and jsonb_array_length(scores) = 8
  )
);

alter table team_results enable row level security;
drop policy if exists "sonuc oku" on team_results;
drop policy if exists "sonuc ekle" on team_results;
drop policy if exists "sonuc guncelle" on team_results;

create policy "sonuc oku" on team_results
  for select to authenticated using (true);
create policy "sonuc ekle" on team_results
  for insert to authenticated with check (public.is_app_admin());
create policy "sonuc guncelle" on team_results
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- --------------------------------------------------------------- legacy kapatma
-- 0001'deki entries tablosunda herkesin yazabildiği politikaları kapat. Yeni UI bu
-- tabloyu kullanmıyor; eski istemcilerin güvenlik modelini bypass etmesini istemiyoruz.
alter table entries enable row level security;
drop policy if exists "herkes okur" on entries;
drop policy if exists "herkes yazar" on entries;
drop policy if exists "herkes günceller" on entries;

-- DELETE politikaları bilinçli olarak yok. Tahmin ve sonuç silme, null değerlerle
-- kontrollü UPDATE olarak yapılıyor.
