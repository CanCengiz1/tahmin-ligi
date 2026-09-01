-- 0009_teams_brand_colors.sql
-- 0008_seed_reference_data.sql "teams" tablosuna primary_color/secondary_color
-- sutunlarina yazar, ama 0007_domain_model.sql'deki "create table teams"
-- bu sutunlari hic tanimlamiyor — repo'daki migrasyon gecmisi production'daki
-- gercek semayla uyusmuyordu (0008 production'da calisti, yani sutunlar orada
-- zaten var). Bu migrasyon additive ve idempotent; sifirdan kurulan bir
-- ortamda 0001..0008 sirayla calistirildiginda ayni semaya ulasmayi saglar.
--
-- app/app.js artik bu iki sutunu (crest_url ile birlikte) dogrudan okuyor —
-- bkz. loadTeamsFromDB().

alter table teams add column if not exists primary_color   text;
alter table teams add column if not exists secondary_color text;
