# Tahmin Ligi

Şampiyonlar Ligi grup aşaması için arkadaş grubu tahmin oyunu. Her katılımcı,
takip edilen takımın 8 maçının her birinden kaç puan alacağını tahmin eder
(galibiyet 3, beraberlik 1, mağlubiyet 0). Tahminler ilk maçtan bir saat önce
kilitlenir. Takımın topladığı gerçek toplama en yakın tahmini yapan kazanır.

Şu an tek ligli çalışıyor. Hedef, her grubun kendi ligini kurabildiği açık bir
sürüm. Yol haritası için `ROADMAP.md`, tasarım kararları için `ARCHITECTURE.md`.

## Hızlı kurulum

```bash
git clone <repo>
cd tahmin-ligi
cp app/config.example.js app/config.js   # kendi Supabase bilgilerinizi yazın
```

Veritabanı: Supabase'de yeni proje açın, SQL Editor'da
`supabase/migrations/0001_single_league.sql` dosyasını çalıştırın.
Ardından Settings → API Keys'ten publishable key'i ve proje adresini
`app/config.js` içine yazın.

Yerelde çalıştırmak için `app/` klasörünü bir HTTP sunucusuyla açın.
`file://` ile açmayın, tarayıcı istekleri engeller.

```bash
npx serve app          # veya: python3 -m http.server 8000 --directory app
```

## Yayına alma

`app/` klasörü statik. Netlify'da mevcut sitenin Deploys sekmesine sürükleyin
veya Vercel/GitHub Pages'e bağlayın. `config.js` git'e girmediği için, dağıtım
ortamında bu dosyanın ayrıca oluşturulması gerekir (Netlify'da elle sürüklerken
klasörde bulunması yeterli).

## Depoya katkı

`config.js` ve `.env` asla commit edilmez. Şema değişiklikleri
`supabase/migrations/` altında numaralı dosya olarak eklenir, mevcut dosyalar
düzenlenmez. Ayrıntı için `CONTRIBUTING.md`.
