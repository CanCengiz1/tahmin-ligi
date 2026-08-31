-- Faz 1.7: Google OAuth ile giriş. 0003'teki handle_new_auth_user() yalnızca
-- signup formundan gelen raw_user_meta_data.display_name'i biliyordu ve
-- yoksa exception fırlatıp auth.users insert'ini iptal ediyordu — bu, Google
-- ile giren ve display_name alanı olmayan her kullanıcının hesap
-- oluşturmasını engellerdi.
--
-- Google OAuth kullanıcılarında raw_user_meta_data içinde display_name yok;
-- bunun yerine full_name / name geliyor. Bu migration:
-- 1. profiles.display_name'i nullable yapar (uygulama girişte ad ister).
-- 2. Trigger'ı full_name/name'e düşecek, hiçbir durumda exception atmayacak
--    şekilde günceller — isim yoksa veya başka bir profille çakışıyorsa
--    display_name null bırakılır, kullanıcı uygulama içinde ad seçer.

alter table public.profiles alter column display_name drop not null;
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (display_name is null or length(trim(display_name)) between 2 and 40);

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
  if v_display_name = '' then
    -- Google OAuth: display_name yok, full_name/name'e düş.
    v_display_name := trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ));
  end if;
  if length(v_display_name) < 2 or length(v_display_name) > 40 then
    v_display_name := null;
  end if;

  begin
    insert into public.profiles(id, display_name)
    values (new.id, v_display_name)
    on conflict (id) do update
      set display_name = coalesce(excluded.display_name, public.profiles.display_name);
  exception when unique_violation then
    -- Türetilen ad (ör. Google full_name) başka bir profille çakıştı. Girişi
    -- engellemek yerine adı boş bırak, kullanıcı uygulama içinde seçsin.
    insert into public.profiles(id, display_name)
    values (new.id, null)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;
