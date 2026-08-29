# Katkı

## Kurulum

```bash
cp app/config.example.js app/config.js
npx serve app
```

Kendi Supabase projenizi açıp `supabase/migrations/0001_single_league.sql`
dosyasını çalıştırın. Ortak geliştirme projesini kullanmayın; yanlış bir
sorgu herkesin verisini bozar.

## Kurallar

**Anahtarlar.** `config.js` ve `.env` commit edilmez. Yanlışlıkla gönderilirse
Supabase panelinden anahtarı yenileyin; geçmişi temizlemek yetmez.

**Migrasyonlar.** Mevcut SQL dosyaları düzenlenmez. Yeni değişiklik yeni
numaralı dosya olur: `0003_...sql`. Uygulanmış bir migrasyonu değiştirmek,
diğer geliştiricinin veritabanını sessizce farklı bırakır.

**Dallar.** `main` doğrudan yazılmaz. `feature/lig-davet` gibi dal açın, PR ile
gelin.

**Puanlama.** `scoring` içindeki kurallar testsiz değiştirilmez. Kural
değişikliği önce `ARCHITECTURE.md` içindeki bölüme yazılır, sonra koda geçer.

## Test

```bash
npm test        # Faz 1'den sonra
```

Elle kontrol listesi: kilitten önce tahmin değiştirilebiliyor mu, kilitten sonra
donuyor mu, admin olmayan sonuç girişini göremiyor mu, sıralama iki takımda
ayrı hesaplanıyor mu.
