# Mimari

## Bugünkü durum (Faz 0)

Tek bir `index.html`: HTML, CSS ve yaklaşık 900 satır vanilla JS. Derleme adımı
yok. Veri Supabase PostgREST'e doğrudan `fetch` ile gidiyor, istemci
kütüphanesi kullanılmıyor.

Veri tek tabloda, anahtar-değer olarak duruyor:

| anahtar | içerik |
|---|---|
| `player:<id>` | `{ id, name, pin, gs[8], fb[8], conf, updatedAt }` |
| `results` | `{ gs[8], fb[8], sgs[8][2], sfb[8][2] }` |

Fikstür `TEAMS` sabitinde koda gömülü. Yetki `CONFIG.ADMINS` listesinde.

### Bu yapının sınırları

Büyütmeden önce bilinmesi gerekenler:

1. **Kimlik zayıf.** Takma ad + 6 haneli PIN, SHA-256 ile hash'lenip veritabanına
   yazılıyor. Tabloyu okuyabilen biri 10^6 olasılığı çevrimdışı deneyebilir.
   Arkadaş grubunda kabul edilebilir, halka açık kullanımda değil.
2. **Yetki yalnızca arayüzde.** "Sonucu sadece admin girer" kuralı JavaScript'te.
   Anahtar tarayıcıda olduğu için isteyen doğrudan API'ye yazabilir.
3. **Kilit yalnızca arayüzde.** Tahmin kilidi istemci saatine bakıyor.
4. **Tek lig.** Tüm oyuncular aynı `entries` tablosunda; ikinci bir grup
   ekleyecek yer yok.
5. **Eşzamanlılık.** Son yazan kazanır. İki admin aynı anda sonuç girerse biri
   kaybolur. Bugünkü kullanımda görülmüyor.

## Hedef yapı (Faz 2–3)

### Kimlik
Supabase Auth, e-posta ile tek kullanımlık kod. Şifre yönetimi yok, gerçek
oturum var. `profiles` tablosu `auth.users` ile birebir.

### Yetki ve kilit
Row Level Security ile veritabanında. `is_member()`, `is_admin()` ve
`picks_open()` yardımcı fonksiyonları politikalar içinde kullanılır. Kilit
sunucu saatine bakar; tarayıcı saatini değiştirmek işe yaramaz.

### Şema
`profiles`, `leagues`, `league_members`, `league_teams`, `fixtures`,
`predictions`, `results`. Ayrıntı ve politikalar:
`supabase/migrations/0002_multi_league.sql`.

Fikstür artık veri. Bir lig kurulurken hangi takımları takip edeceği seçilir,
kod değişmeden başka takımlarla oynanabilir.

Sonuçlar lig başına tutulur. Objektif veri olduğu için ortak da tutulabilirdi,
ancak her ligin kendi adminine güvenmek, bir grubun hatasının diğerini
etkilememesi açısından daha sağlam.

### Ön yüz
Vite + React + TypeScript, `@supabase/supabase-js`. Tek dosya bu boyuttan sonra
okunmuyor; ayrıca oturum yönetimi ve gerçek zamanlı abonelikler için istemci
kütüphanesi işi kolaylaştırıyor.

Önerilen bölünme:

```
src/
  lib/supabase.ts        istemci
  lib/scoring.ts         saf fonksiyonlar: tally, standings, tiebreak
  features/auth/
  features/league/       kurma, davet, katılma
  features/predictions/  takım sekmeleri, kaydet/düzenle
  features/results/      admin skor girişi
  features/standings/    ana sıralama + yan sıralama
```

`lib/scoring.ts` saf tutulmalı: veritabanına dokunmadan test edilebilir olması,
puanlama kuralları tartışmaya açık olduğu için önemli.

## Puanlama kuralları

Takım başına ayrı yarışma. Bir maç için tahmin 3, 1 veya 0.

**Ana sıralama:** tahmin toplamı ile takımın gerçek toplamı arasındaki mutlak
fark küçük olan üstte. Eşitlikte maç bazında daha çok doğru bilen. O da eşitse
tahminini önce kesinleştiren.

**Yan sıralama:** maç bazında doğru sayısı. Kazananı belirlemez, göstergedir.

Fark ile doğru sayısı farklı ölçülerdir: sekiz maçı da bilen kişinin farkı
zorunlu olarak sıfırdır, ama farkı sıfır olan kişi maçları bilmemiş olabilir —
hataları birbirini götürmüş olabilir. Yan sıralama bu ayrımı görünür kılar.
