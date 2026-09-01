-- 0011_backfill_fixture_goals.sql
-- Gercek mac skorlari icin tek kaynak artik fixtures.home_goals/away_goals
-- (skor tahmini siralamasi buradan okuyor, bkz. app/app.js scoreStandingsRows).
-- team_results.scores'a onceden girilmis skorlari ayni takima gore siraya
-- konmus fikstur listesiyle eslestirip oraya tasir.
--
-- Orientasyon: team_results.scores[i] = [takimin golu, rakibin golu] (admin
-- "kendi takimi - rakip" sirasiyla girer). fixtures.home_team_id'e bakarak
-- gercek ev/deplasman golune ceviriyoruz — deplasman macinda iki sayi yer
-- degistirir. Zaten fixtures'a girilmis satirlar (home_goals/away_goals dolu)
-- dokunulmadan birakilir.

with gs_fixtures as (
  select
    f.id,
    (f.home_team_id = t.id) as team_is_home,
    row_number() over (order by f.kickoff_at asc) - 1 as idx
  from fixtures f
  join teams t on t.slug = 'galatasaray'
  where f.home_team_id = t.id or f.away_team_id = t.id
),
gs_scores as (
  select scores from team_results where team_key = 'gs'
)
update fixtures f
set
  home_goals = case when gf.team_is_home then (gs.scores -> gf.idx ->> 0)::int else (gs.scores -> gf.idx ->> 1)::int end,
  away_goals = case when gf.team_is_home then (gs.scores -> gf.idx ->> 1)::int else (gs.scores -> gf.idx ->> 0)::int end,
  updated_at = now()
from gs_fixtures gf, gs_scores gs
where f.id = gf.id
  and f.home_goals is null and f.away_goals is null
  and gs.scores -> gf.idx is not null
  and jsonb_typeof(gs.scores -> gf.idx) = 'array';

with fb_fixtures as (
  select
    f.id,
    (f.home_team_id = t.id) as team_is_home,
    row_number() over (order by f.kickoff_at asc) - 1 as idx
  from fixtures f
  join teams t on t.slug = 'fenerbahce'
  where f.home_team_id = t.id or f.away_team_id = t.id
),
fb_scores as (
  select scores from team_results where team_key = 'fb'
)
update fixtures f
set
  home_goals = case when ff.team_is_home then (fb.scores -> ff.idx ->> 0)::int else (fb.scores -> ff.idx ->> 1)::int end,
  away_goals = case when ff.team_is_home then (fb.scores -> ff.idx ->> 1)::int else (fb.scores -> ff.idx ->> 0)::int end,
  updated_at = now()
from fb_fixtures ff, fb_scores fb
where f.id = ff.id
  and f.home_goals is null and f.away_goals is null
  and fb.scores -> ff.idx is not null
  and jsonb_typeof(fb.scores -> ff.idx) = 'array';
