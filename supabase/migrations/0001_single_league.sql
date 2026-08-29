-- Faz 0: bugun yayinda olan sema.
-- Tek lig, anahtar-deger tablosu. Yeni kurulumda calistirilmasi gerekmez;
-- mevcut projeyi yeniden kurmak veya arkadasinin kendi Supabase projesini
-- ayaga kaldirmasi icin duruyor.

create table if not exists entries (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

alter table entries enable row level security;

-- Dikkat: bu politikalar linki bilen herkese yazma izni verir.
-- Faz 2'de 0002 migrasyonu ile degistirilecek.
drop policy if exists "herkes okur"      on entries;
drop policy if exists "herkes yazar"     on entries;
drop policy if exists "herkes günceller" on entries;

create policy "herkes okur"      on entries for select using (true);
create policy "herkes yazar"     on entries for insert with check (true);
create policy "herkes günceller"  on entries for update using (true) with check (true);

-- Saklanan anahtarlar:
--   player:<id>  -> { id, name, pin, gs[8], fb[8], conf:{gs,fb}, updatedAt }
--   results      -> { gs[8], fb[8], sgs[8][2], sfb[8][2] }
