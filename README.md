# Tahmin Ligi

Şampiyonlar Ligi grup aşaması için arkadaş grubu tahmin oyunu. Her katılımcı,
takip edilen takımın 8 maçının her birinden kaç puan alacağını tahmin eder
(galibiyet 3, beraberlik 1, mağlubiyet 0). Tahminler ilk maçtan bir saat önce
kilitlenir. Takımın topladığı gerçek toplama en yakın tahmini yapan kazanır.

Uygulama şu an tek ligli çalışıyor. Kullanıcı kimliği Supabase Auth ile,
uygulama içi admin yetkisi ise veritabanındaki `app_admins` tablosu ve RLS ile
yönetilir. Hedef, daha sonra her grubun kendi ligini kurabildiği açık bir sürüm.
Yol haritası için `ROADMAP.md`, tasarım kararları için `ARCHITECTURE.md`.

## Hızlı kurulum

```bash
git clone <repo>
cd tahmin-ligi
cp app/config.example.js app/config.js
```

`app/config.js` içine Supabase proje URL'sini ve publishable key'i yazın.
Publishable key'in tarayıcıda görünmesi normaldir; yetki anahtar gizliliğine değil
Supabase Auth ve Row Level Security politikalarına dayanır.

### Veritabanı

Mevcut tek-lig kurulumunda SQL Editor'da sırasıyla:

1. `supabase/migrations/0001_single_league.sql`
2. `supabase/migrations/0003_auth_single_league.sql`

çalıştırın. `0002_multi_league.sql` gelecek çoklu-lig şemasıdır ve mevcut ön yüz
henüz onu kullanmaz.

Supabase Dashboard → Authentication → Providers altında Email provider açık
olmalıdır. Prod ortamında e-posta doğrulamasını açık tutmak önerilir.

### İlk admini atama

Önce kullanıcı normal şekilde hesap oluştursun. Ardından SQL Editor'da:

```sql
insert into app_admins(user_id)
select id from auth.users where email = 'admin@example.com';
```

Adminlik artık `config.js` içindeki bir takma ada bağlı değildir. İstemci bu
yetkiyi değiştiremez; sonuç yazma izni RLS tarafından veritabanında kontrol edilir.

## Yerelde çalıştırma

`app/` klasörünü bir HTTP sunucusuyla açın. `file://` kullanmayın.

```bash
npx serve app
# veya
python3 -m http.server 8000 --directory app
```

## Yayına alma

`app/` klasörü statiktir. Netlify, Vercel veya GitHub Pages ile yayınlanabilir.
`config.js` git'e girmediği için dağıtım ortamında ayrıca oluşturulmalıdır.

## Güvenlik notları

- Parolalar uygulama tarafından tutulmaz veya hash'lenmez; Supabase Auth yönetir.
- Kullanıcının açık takım tahmini yalnızca kendi hesabı tarafından yazılabilir.
- Başka kullanıcıların takım tahminleri o takım server saatine göre kilitlenmeden okunamaz.
- `team_results` satırlarını yalnızca `app_admins` tablosunda bulunan kullanıcı yazabilir.
- Anonim kullanıcılar uygulama verisini okuyamaz veya yazamaz.
- Eski `entries` tablosunun açık politikaları kaldırılır; yeni UI bu tabloyu kullanmaz.

## Depoya katkı

`config.js` ve `.env` asla commit edilmez. Şema değişiklikleri
`supabase/migrations/` altında numaralı dosya olarak eklenir, mevcut dosyalar
düzenlenmez. Ayrıntı için `CONTRIBUTING.md`.
