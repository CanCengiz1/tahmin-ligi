-- 0008_seed_reference_data.sql
-- Gercek dunya referans verisi: takimlar, turnuva, sezon, fikstur.
-- 0007_domain_model.sql uygulandiktan sonra calistirilir.
-- Tahmin verisine dokunmaz; mevcut uygulama etkilenmez.

insert into teams (slug, name, short_name, country_code, primary_color, secondary_color) values
  ('galatasaray', 'Galatasaray', 'GS', 'TR', '#A90432', '#F5A800'),
  ('fenerbahce', 'Fenerbahçe', 'FB', 'TR', '#12356E', '#FFE500'),
  ('sporting-cp', 'Sporting CP', 'SCP', 'PT', '#008057', '#FFFFFF'),
  ('barcelona', 'Barcelona', 'BAR', 'ES', '#A50044', '#004D98'),
  ('lille', 'Lille', 'LIL', 'FR', '#E01E13', '#041E42'),
  ('stuttgart', 'Stuttgart', 'VFB', 'DE', '#E32219', '#FFFFFF'),
  ('aston-villa', 'Aston Villa', 'AVL', 'EN', '#670E36', '#95BFE5'),
  ('aek-athens', 'AEK', 'AEK', 'GR', '#FFCC00', '#111111'),
  ('feyenoord', 'Feyenoord', 'FEY', 'NL', '#CC0000', '#FFFFFF'),
  ('psg', 'PSG', 'PSG', 'FR', '#004170', '#DA291C'),
  ('roma', 'Roma', 'ROM', 'IT', '#8E1F2F', '#F0BC42'),
  ('slavia-praha', 'Slavia Praha', 'SLA', 'CZ', '#D7141A', '#FFFFFF'),
  ('liverpool', 'Liverpool', 'LIV', 'EN', '#C8102E', '#FFFFFF'),
  ('shakhtar', 'Shakhtar Donetsk', 'SHK', 'UA', '#FF6600', '#111111'),
  ('lask', 'LASK', 'LSK', 'AT', '#111111', '#FFFFFF'),
  ('villarreal', 'Villarreal', 'VIL', 'ES', '#FFE667', '#005187'),
  ('atletico-madrid', 'Atlético Madrid', 'ATM', 'ES', '#CB3524', '#172554')
on conflict (slug) do nothing;

insert into competitions (slug, name, kind, region) values
  ('ucl', 'UEFA Champions League', 'cup', 'Europe')
on conflict (slug) do nothing;

insert into competition_seasons (competition_id, label, starts_at, ends_at, status)
select id, '2026/27', '2026-09-09', '2027-05-31', 'upcoming' from competitions where slug = 'ucl'
on conflict (competition_id, label) do nothing;

-- Fikstur. Ev sahibi/deplasman gercek maca gore yazildi.
insert into fixtures (competition_season_id, matchday, home_team_id, away_team_id, kickoff_at)
select s.id, 1, th.id, ta.id, timestamptz '2026-09-09 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'sporting-cp'
  join teams ta on ta.slug = 'galatasaray'
  where s.label = '2026/27'
union all
select s.id, 2, th.id, ta.id, timestamptz '2026-10-13 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'galatasaray'
  join teams ta on ta.slug = 'barcelona'
  where s.label = '2026/27'
union all
select s.id, 3, th.id, ta.id, timestamptz '2026-10-21 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'lille'
  join teams ta on ta.slug = 'galatasaray'
  where s.label = '2026/27'
union all
select s.id, 4, th.id, ta.id, timestamptz '2026-11-03 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'galatasaray'
  join teams ta on ta.slug = 'stuttgart'
  where s.label = '2026/27'
union all
select s.id, 5, th.id, ta.id, timestamptz '2026-11-24 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'galatasaray'
  join teams ta on ta.slug = 'aston-villa'
  where s.label = '2026/27'
union all
select s.id, 6, th.id, ta.id, timestamptz '2026-12-08 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'aek-athens'
  join teams ta on ta.slug = 'galatasaray'
  where s.label = '2026/27'
union all
select s.id, 7, th.id, ta.id, timestamptz '2027-01-19 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'galatasaray'
  join teams ta on ta.slug = 'feyenoord'
  where s.label = '2026/27'
union all
select s.id, 8, th.id, ta.id, timestamptz '2027-01-27 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'psg'
  join teams ta on ta.slug = 'galatasaray'
  where s.label = '2026/27'
union all
select s.id, 1, th.id, ta.id, timestamptz '2026-09-10 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'fenerbahce'
  join teams ta on ta.slug = 'roma'
  where s.label = '2026/27'
union all
select s.id, 2, th.id, ta.id, timestamptz '2026-10-14 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'aston-villa'
  join teams ta on ta.slug = 'fenerbahce'
  where s.label = '2026/27'
union all
select s.id, 3, th.id, ta.id, timestamptz '2026-10-20 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'fenerbahce'
  join teams ta on ta.slug = 'slavia-praha'
  where s.label = '2026/27'
union all
select s.id, 4, th.id, ta.id, timestamptz '2026-11-04 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'fenerbahce'
  join teams ta on ta.slug = 'liverpool'
  where s.label = '2026/27'
union all
select s.id, 5, th.id, ta.id, timestamptz '2026-11-25 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'shakhtar'
  join teams ta on ta.slug = 'fenerbahce'
  where s.label = '2026/27'
union all
select s.id, 6, th.id, ta.id, timestamptz '2026-12-09 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'lask'
  join teams ta on ta.slug = 'fenerbahce'
  where s.label = '2026/27'
union all
select s.id, 7, th.id, ta.id, timestamptz '2027-01-20 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'fenerbahce'
  join teams ta on ta.slug = 'villarreal'
  where s.label = '2026/27'
union all
select s.id, 8, th.id, ta.id, timestamptz '2027-01-27 19:00:00+00'
  from competition_seasons s
  join competitions c on c.id = s.competition_id and c.slug = 'ucl'
  join teams th on th.slug = 'atletico-madrid'
  join teams ta on ta.slug = 'fenerbahce'
  where s.label = '2026/27'
on conflict (competition_season_id, matchday, home_team_id, away_team_id) do nothing;
