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
3. `supabase/migrations/0004_legacy_account_claim.sql`

çalıştırın. `0002_multi_league.sql` gelecek çoklu-lig şemasıdır ve mevcut ön yüz
henüz onu kullanmaz.

Supabase Dashboard → Authentication → Providers altında Email provider açık
olmalıdır. Prod ortamında e-posta doğrulamasını açık tutmak önerilir.

### Legacy PIN hesaplarını taşıma

`0004_legacy_account_claim.sql`, eski nickname + 6 haneli PIN kullanıcılarının
tahminlerini kaybetmeden yeni Supabase Auth hesabına geçebilmesi için tek seferlik
self-service taşıma akışını ekler.

Akış:

1. Kullanıcı yeni sistemde e-posta + şifre ile normal Auth hesabını oluşturur.
2. Yeni hesapta henüz tahmin girmeden uygulamadaki **Eski PIN hesabın var mı?**
   kartından taşıma ekranını açar.
3. Eski kullanıcı adı ve 6 haneli PIN'i girer.
4. Tarayıcı, eski uygulamayla birebir aynı legacy SHA-256 proof'unu üretir.
5. `claim_legacy_account` RPC'si proof'u kapalı `entries` tablosundaki legacy
   kayıtla server-side eşleştirir ve GS/FB tahminlerini yeni Auth UUID'sine taşır.
6. Legacy hesap `legacy_account_claims` tablosunda claim edilmiş olarak işaretlenir
   ve ikinci kez başka hesaba taşınamaz.

Güvenlik korumaları:

- `entries` tablosu migration için tekrar client'a açılmaz.
- Bir Auth hesabı yalnızca bir legacy hesabı claim edebilir.
- Bir legacy hesap yalnızca bir Auth hesabına bağlanabilir.
- Yeni hesapta herhangi bir `team_predictions` satırı oluşmuşsa migration reddedilir;
  mevcut yeni verinin üzerine yazılmaz.
- Hatalı PIN denemeleri Auth kullanıcısı başına saatte 10 ile sınırlandırılır.
- Legacy admin nickname'i **admin rolüne çevrilmez**. Adminlik ayrı ve manuel atanır.
- Migration, takım kilidi geçmiş olsa bile doğrulanmış tarihsel tahmini olduğu gibi
  taşır; kullanıcı eski hesabını geç claim ettiği için tahmini kaybolmaz.
- Eski `results` kaydı varsa `team_results` tablosuna tek seferlik taşınır; yeni
  sonuç verisi varsa üzerine yazılmaz.

PIN'i hiç olmayan çok eski legacy kayıtlar güvenli biçimde self-service claim
edilemez. Böyle bir kayıt varsa admin tarafından kullanıcı kimliği ayrıca doğrulanıp
manuel taşınmalıdır.

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
- Legacy claim RPC'si `SECURITY DEFINER` olarak yalnızca kontrollü migration işlemini
  yapar; `entries` için yeni bir public RLS policy oluşturmaz.

## Depoya katkı

`config.js` ve `.env` asla commit edilmez. Şema değişiklikleri
`supabase/migrations/` altında numaralı dosya olarak eklenir, mevcut dosyalar
düzenlenmez. Ayrıntı için `CONTRIBUTING.md`.
