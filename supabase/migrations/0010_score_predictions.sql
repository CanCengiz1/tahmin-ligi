-- 0009_score_predictions.sql
-- Skor tahmini: ana yarismadan bagimsiz ikinci oyun katmani.
-- Puanlama kurali app/scoring.js icindeki scoreMatchPrediction ile ayni;
-- dokumantasyon docs/DOMAIN.md "Skor tahmini puanlamasi".
--
-- Tek ligli surum icin league_id yok. Cok ligli yapiya gecilirse sutun eklenir.

create table score_predictions (
  user_id    uuid not null references profiles(id) on delete cascade,
  fixture_id uuid not null references fixtures(id) on delete cascade,
  home_score int  not null check (home_score between 0 and 99),
  away_score int  not null check (away_score between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, fixture_id)
);

create index on score_predictions (fixture_id);

-- Kilit: mac baslayana kadar acik. Sunucu saatine bakar, tarayiciya degil.
create or replace function score_prediction_open(f uuid) returns boolean
language sql stable as $$
  select coalesce((select now() < fx.kickoff_at from fixtures fx where fx.id = f), false);
$$;

alter table score_predictions enable row level security;

-- Skor tahminleri mac oncesinde de herkese acik.
-- Ana oyundan farkli: orada gizlilik sart, cunku rakibin sezon toplamini gormek
-- kendi tahminini bozar. Burada boyle bir sakinca yok, herkesin farkli skor
-- soylemesi zaten oyunun kendisi.
create policy "skor tahmini oku" on score_predictions for select
  using (auth.uid() is not null);

create policy "skor tahmini ekle" on score_predictions for insert
  with check (user_id = auth.uid() and score_prediction_open(fixture_id));

create policy "skor tahmini guncelle" on score_predictions for update
  using      (user_id = auth.uid() and score_prediction_open(fixture_id))
  with check (user_id = auth.uid() and score_prediction_open(fixture_id));

create policy "skor tahmini sil" on score_predictions for delete
  using (user_id = auth.uid() and score_prediction_open(fixture_id));
