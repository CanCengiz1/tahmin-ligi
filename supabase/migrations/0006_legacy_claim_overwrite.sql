-- Faz 1.9: legacy claim akışını, hedef hesapta zaten tahmin varken de
-- kullanıcı onayıyla tamamlanabilir hale getirir.
--
-- Önceki davranış: hedef hesapta herhangi bir team_predictions satırı varsa
-- (target_account_has_predictions) claim tamamen reddediliyordu. Kullanıcı
-- bir maçı işaretler işaretlemez teklif kartı kayboluyor ve eski tahminlere
-- geri dönüş yolu kalmıyordu. Şimdi istemci, kullanıcı açıkça onay verdiğinde
-- p_overwrite=true göndererek eski veriyi yeni hesaptaki tahminlerin üzerine
-- yazdırabilir. Varsayılan davranış (p_overwrite=false) değişmedi.

drop function if exists public.claim_legacy_account(text);

create or replace function public.claim_legacy_account(p_pin_hash text, p_overwrite boolean default false)
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

  -- Onay verilmediyse yeni hesapta tahmin satırı oluştuysa eski verinin üstüne yazma.
  -- Onay verildiyse (p_overwrite) kullanıcı bunu bilerek istiyor demektir.
  if not p_overwrite and exists (
    select 1 from public.team_predictions p where p.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'target_account_has_predictions');
  end if;

  -- Bir Auth hesabı yalnızca tek legacy hesabı claim edebilir. p_overwrite bunu etkilemez.
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
  -- kendi eski hesabını doğrulayıp geçmiş tahminini geri alabilmelidir. p_overwrite ile
  -- gelindiyse hedef satırlar zaten var olabilir; bu durumda üzerine yazılır.
  insert into public.team_predictions(user_id, team_key, picks, confirmed_at, updated_at)
  values
    (v_uid, 'gs', v_gs, v_gs_conf, v_updated_at),
    (v_uid, 'fb', v_fb, v_fb_conf, v_updated_at)
  on conflict (user_id, team_key) do update
    set picks = excluded.picks, confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at;

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

revoke all on function public.claim_legacy_account(text, boolean) from public;
grant execute on function public.claim_legacy_account(text, boolean) to authenticated;
