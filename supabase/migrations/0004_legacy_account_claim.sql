-- Faz 1.6: legacy nickname + 6 haneli PIN hesaplarını yeni Supabase Auth
-- kullanıcılarına self-service ve tek seferlik olarak bağlar.
--
-- Güvenlik prensipleri:
-- - entries tablosu client'a tekrar açılmaz.
-- - Doğrulama security definer RPC içinde yapılır.
-- - Legacy hesap yalnızca bir kez claim edilebilir.
-- - Yeni hesapta team_predictions satırı varsa veri üzerine yazılmaz.
-- - Başarısız denemeler kullanıcı başına saatte 10 ile sınırlandırılır.
-- - Legacy admin nickname'i admin rolüne çevrilmez; admin ataması manuel kalır.

-- -------------------------------------------------------- legacy sonuçları koru
-- 0003 sonrası yeni UI team_results kullanıyor. Eski results satırı varsa ve yeni
-- tabloda henüz karşılığı yoksa sonuçları tek seferlik taşı.
insert into public.team_results(team_key, points, scores, updated_by, updated_at)
select
  'gs',
  case
    when jsonb_typeof(e.data -> 'gs') = 'array' and jsonb_array_length(e.data -> 'gs') = 8
      then e.data -> 'gs'
    else '[null,null,null,null,null,null,null,null]'::jsonb
  end,
  case
    when jsonb_typeof(e.data -> 'sgs') = 'array' and jsonb_array_length(e.data -> 'sgs') = 8
      then e.data -> 'sgs'
    else '[null,null,null,null,null,null,null,null]'::jsonb
  end,
  null,
  coalesce(e.updated_at, now())
from public.entries e
where e.key = 'results'
on conflict (team_key) do nothing;

insert into public.team_results(team_key, points, scores, updated_by, updated_at)
select
  'fb',
  case
    when jsonb_typeof(e.data -> 'fb') = 'array' and jsonb_array_length(e.data -> 'fb') = 8
      then e.data -> 'fb'
    else '[null,null,null,null,null,null,null,null]'::jsonb
  end,
  case
    when jsonb_typeof(e.data -> 'sfb') = 'array' and jsonb_array_length(e.data -> 'sfb') = 8
      then e.data -> 'sfb'
    else '[null,null,null,null,null,null,null,null]'::jsonb
  end,
  null,
  coalesce(e.updated_at, now())
from public.entries e
where e.key = 'results'
on conflict (team_key) do nothing;

-- ----------------------------------------------------------- claim kayıtları
create table if not exists public.legacy_account_claims (
  legacy_player_id text primary key,
  -- Bilinçli olarak FK yok: Auth hesabı sonradan silinse bile legacy hesabın
  -- tekrar claim edilmesini önleyen tombstone kaydı korunur.
  claimed_by       uuid not null unique,
  claimed_at       timestamptz not null default now()
);

alter table public.legacy_account_claims enable row level security;
-- Bilinçli olarak client SELECT/INSERT/UPDATE/DELETE policy'si yok.
-- Claim yalnızca aşağıdaki security definer fonksiyonundan yapılır.

-- ------------------------------------------------------------- rate limiting
create table if not exists public.legacy_claim_attempts (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  window_started  timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0)
);

alter table public.legacy_claim_attempts enable row level security;
-- Bu tablo da doğrudan client'a açılmaz.

-- -------------------------------------------------------- legacy claim RPC
-- Frontend eski uygulamayla birebir aynı algoritmayla
-- SHA-256(lowercase-tr(normalize(name)) || ':' || pin) üretip p_pin_hash gönderir.
-- Hash karşılaştırması ve migration DB tarafında yapılır; entries client'a açılmaz.
create or replace function public.claim_legacy_account(p_pin_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_entry record;
  v_match_count integer;
  v_attempts public.legacy_claim_attempts%rowtype;
  v_updated_at timestamptz;
  v_gs jsonb;
  v_fb jsonb;
  v_gs_conf timestamptz;
  v_fb_conf timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'authentication_required');
  end if;

  if p_pin_hash is null or p_pin_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_legacy_pin_proof');
  end if;

  -- Yeni hesapta herhangi bir tahmin satırı oluştuysa eski verinin üstüne yazma.
  if exists (
    select 1 from public.team_predictions p where p.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'target_account_has_predictions');
  end if;

  -- Bir Auth hesabı yalnızca tek legacy hesabı claim edebilir.
  if exists (
    select 1 from public.legacy_account_claims c where c.claimed_by = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'target_account_already_claimed_legacy');
  end if;

  -- Kullanıcı başına rolling olmayan basit 1 saatlik pencere: 10 başarısız deneme.
  select * into v_attempts
  from public.legacy_claim_attempts a
  where a.user_id = v_uid
  for update;

  if found then
    if v_attempts.window_started < now() - interval '1 hour' then
      update public.legacy_claim_attempts
      set window_started = now(), failed_attempts = 0
      where user_id = v_uid;
      v_attempts.failed_attempts := 0;
    elsif v_attempts.failed_attempts >= 10 then
      return jsonb_build_object('ok', false, 'code', 'too_many_legacy_claim_attempts');
    end if;
  else
    insert into public.legacy_claim_attempts(user_id, window_started, failed_attempts)
    values (v_uid, now(), 0);
    v_attempts.failed_attempts := 0;
  end if;

  -- Legacy PIN hash zaten nickname + PIN birleşiminden üretildiği için entries içinde
  -- pin hash ile aramak, Türkçe lower/case normalizasyonunu DB'de yeniden üretme
  -- zorunluluğunu ortadan kaldırır.
  select count(*) into v_match_count
  from public.entries e
  where e.key like 'player:%'
    and nullif(e.data ->> 'pin', '') = p_pin_hash;

  if v_match_count = 0 then
    update public.legacy_claim_attempts
    set failed_attempts = failed_attempts + 1
    where user_id = v_uid;
    return jsonb_build_object('ok', false, 'code', 'legacy_account_not_found');
  elsif v_match_count > 1 then
    -- Aynı proof birden fazla legacy kayda denk geliyorsa otomatik seçim yapma.
    update public.legacy_claim_attempts
    set failed_attempts = failed_attempts + 1
    where user_id = v_uid;
    return jsonb_build_object('ok', false, 'code', 'legacy_account_ambiguous');
  end if;

  select e.key, e.data, e.updated_at
  into v_entry
  from public.entries e
  where e.key like 'player:%'
    and nullif(e.data ->> 'pin', '') = p_pin_hash
  limit 1
  for update;

  if v_entry.data ->> 'pin' is null or v_entry.data ->> 'pin' = '' then
    return jsonb_build_object('ok', false, 'code', 'legacy_account_has_no_pin');
  end if;

  if exists (
    select 1 from public.legacy_account_claims c where c.legacy_player_id = v_entry.key
  ) then
    return jsonb_build_object('ok', false, 'code', 'legacy_account_already_claimed');
  end if;

  v_gs := case
    when jsonb_typeof(v_entry.data -> 'gs') = 'array' and jsonb_array_length(v_entry.data -> 'gs') = 8
      then v_entry.data -> 'gs'
    else '[null,null,null,null,null,null,null,null]'::jsonb
  end;

  v_fb := case
    when jsonb_typeof(v_entry.data -> 'fb') = 'array' and jsonb_array_length(v_entry.data -> 'fb') = 8
      then v_entry.data -> 'fb'
    else '[null,null,null,null,null,null,null,null]'::jsonb
  end;

  v_updated_at := case
    when coalesce(v_entry.data ->> 'updatedAt', '') ~ '^[0-9]+$'
      then to_timestamp((v_entry.data ->> 'updatedAt')::double precision / 1000.0)
    else coalesce(v_entry.updated_at, now())
  end;

  v_gs_conf := case
    when coalesce(v_entry.data #>> '{conf,gs}', '') ~ '^[0-9]+$'
      and (v_entry.data #>> '{conf,gs}')::double precision > 0
      then to_timestamp((v_entry.data #>> '{conf,gs}')::double precision / 1000.0)
    else null
  end;

  v_fb_conf := case
    when coalesce(v_entry.data #>> '{conf,fb}', '') ~ '^[0-9]+$'
      and (v_entry.data #>> '{conf,fb}')::double precision > 0
      then to_timestamp((v_entry.data #>> '{conf,fb}')::double precision / 1000.0)
    else null
  end;

  -- SECURITY DEFINER olduğu için normal RLS kilit politikasını bypass ederek tarihsel
  -- veriyi olduğu gibi taşır. Bu gereklidir: kullanıcı ilk maç kilitlendikten sonra da
  -- kendi eski hesabını doğrulayıp geçmiş tahminini geri alabilmelidir.
  insert into public.team_predictions(user_id, team_key, picks, confirmed_at, updated_at)
  values
    (v_uid, 'gs', v_gs, v_gs_conf, v_updated_at),
    (v_uid, 'fb', v_fb, v_fb_conf, v_updated_at);

  insert into public.legacy_account_claims(legacy_player_id, claimed_by)
  values (v_entry.key, v_uid);

  delete from public.legacy_claim_attempts where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'legacy_player_id', v_entry.key,
    'migrated_teams', jsonb_build_array('gs', 'fb')
  );
end;
$$;

revoke all on function public.claim_legacy_account(text) from public;
grant execute on function public.claim_legacy_account(text) to authenticated;

-- entries doğrudan kapalı kalır. Bu migration hiçbir public RLS policy eklemez.
