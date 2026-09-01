# Domain modeli

Bu belge, uygulamanın hedef veri modelini tanımlar. Henüz uygulanmadı —
`supabase/migrations/0007_domain_model.sql` taslak hâlinde duruyor. Geçiş planı
en altta.

## Kavram ayrımı

En kritik ayrım isimlendirmede. Üç ayrı şey birbirine karışmamalı:

| Kavram | Tablo | Ne demek |
|---|---|---|
| Gerçek turnuva | `competitions` | UEFA Şampiyonlar Ligi, Süper Lig |
| Turnuvanın bir sezonu | `competition_seasons` | UCL 2026/27 |
| Kullanıcıların açtığı oda | `prediction_leagues` | "Can'ın Arkadaş Grubu" |

`competition` sözcüğü lig ve kupa formatlarını birlikte kapsadığı için `league`
yerine tercih edildi. `prediction_league` ise oyunun oynandığı oda — gerçek
futbolla ilgisi yok, sadece bir grup insan ve bir kurallar kümesi.

---

## Gerçek dünya verisi

Bu tablolar herkese açık okunur, yalnızca sistem yöneticisi yazar. Objektif
veri: hangi takım, hangi maç, kaç kaç bitti.

### teams

```
id               uuid pk
name             text          Galatasaray
short_name       text          GS
slug             text unique   galatasaray
country_code     text          TR
crest_url        text          (opsiyonel, telif dikkat)
primary_color    text          hex — #A90432
secondary_color  text          hex — #F5A800
active           boolean
```

`primary_color`/`secondary_color` `0009_teams_brand_colors.sql` ile eklendi
— `0007_domain_model.sql`'in ilk hâli bu iki sütunu tanımlamıyordu ama
`0008_seed_reference_data.sql` onlara zaten yazıyordu, bu belge de o ara
`colors jsonb` diye yanlış dokümante etmişti.

`app/app.js` içindeki `TEAMS` sabiti (artık `loadTeamsFromDB()` ile bu
tablodan dolduruluyor) bu satırın bugünkü karşılığı — `crest` `crest_url`'e,
`colors:[primary,secondary]` bu iki sütuna, `tla` ise `short_name`'e karşılık
gelir (bkz. `docs/ASSETS.md`). Geçiş, alan adı eşlemesi dışında ek dönüşüm
gerektirmeyecek şekilde tasarlandı.

### competitions

```
id            uuid pk
name          text          UEFA Champions League
slug          text unique   ucl
kind          text          league | cup | mixed
region        text          Europe | TR
```

### competition_seasons

```
id              uuid pk
competition_id  uuid fk
label           text        2026/27
starts_at       timestamptz
ends_at         timestamptz
status          text        upcoming | active | finished
```

### fixtures

```
id                     uuid pk
competition_season_id  uuid fk
matchday               int
home_team_id           uuid fk teams
away_team_id           uuid fk teams
kickoff_at             timestamptz
status                 text     scheduled | live | finished | postponed
home_goals             int null
away_goals             int null
```

Fikstür artık koda gömülü değil. `TEAMS` sabitindeki diziler bu tabloya taşınır.

**Karar: gerçek skor fixture üzerinde tutulur, lig başına değil.** Skor
objektif bir gerçek; her ligin admininin ayrı ayrı girmesi hem gereksiz emek
hem de aynı maç için farklı sonuçlar doğurma riski. Bugünkü `team_results`
tablosu lig başınaydı, bu modelde tek kaynağa iner.

Bunun bedeli: bir lig admini kendi başına sonuç giremez, sistem yöneticisini
bekler. Sezon başında bunu sen gireceğin için sorun değil; lig sayısı artınca
sonuçların otomatik çekilmesi zaten kaçınılmaz hale gelir.

---

## Oyun verisi

### profiles

```
id            uuid pk -> auth.users.id
display_name  text null
avatar_url    text null
created_at    timestamptz
```

`auth.users` doğrudan iş tablosu olarak kullanılmaz.

### prediction_leagues

```
id                     uuid pk
name                   text
slug                   text unique
owner_user_id          uuid fk profiles
competition_season_id  uuid fk        hangi sezon oynanıyor
visibility             text           public | private
join_policy            text           open | invite_only | request
invite_code            text unique null
prediction_visibility  text           live | after_lock
lock_lead              interval       varsayılan 1 saat
system_managed         boolean        Main Server için true
created_at             timestamptz
archived_at            timestamptz null
```

### prediction_league_teams

```
league_id  uuid fk
team_id    uuid fk
pk (league_id, team_id)
```

**Bu tablo issue'da eksikti ve gerekli.** Puanlama takım bazlı: "GS'nin 8
maçından kaç puan toplayacağı". Bir ligin hangi takımları takip ettiği
bilinmeden ne tahmin ekranı ne sıralama kurulabilir. Bugünkü uygulamada bu
bilgi koda gömülü (`gs` ve `fb`).

### prediction_league_members

```
league_id  uuid fk
user_id    uuid fk profiles
role       text        owner | admin | member
joined_at  timestamptz
pk (league_id, user_id)
```

### predictions

```
league_id        uuid fk
user_id          uuid fk profiles
fixture_id       uuid fk
subject_team_id  uuid fk teams
points           int         0 | 1 | 3
confirmed_at     timestamptz null
updated_at       timestamptz
pk (league_id, user_id, fixture_id, subject_team_id)
```

**`subject_team_id` neden gerekli:** tahmin "bu maçtan şu takım kaç puan alır"
demek. Çoğu maçta takip edilen tek takım vardır ve fixture'dan türetilebilir.
Ama bir ligde hem GS hem FB takip ediliyorsa ve Süper Lig oynanıyorsa, GS–FB
derbisi tek bir fixture'dır ve iki ayrı tahmin gerektirir. Türetmeye
kalkarsan bu maçta çakışırsın.

---

## Skor tahmini puanlaması

Takımın 8 maçlık puan tahmininden (3/1/0, yukarıdaki `predictions.points`)
tamamen ayrı, bağımsız bir özellik: burada "GS kaç puan toplar" değil, "bu
maç kaç kaç biter" tahmin ediliyor. **Şu an yalnızca kural var** —
`app/scoring.js` içindeki `scoreMatchPrediction()` ve
`compareScorePredictionRows()` saf fonksiyonları ve testleri
(`app/scoring.test.js`). Veri modeli (tahminlerin nerede tutulacağı,
`fixtures.home_goals`/`away_goals`'a nasıl bağlanacağı) ve arayüz henüz yok —
bu belge yalnızca puanlama kuralını bağlayıcı olarak sabitliyor.

### Kural

Bir maç için tahmin edilen skor (`predictedHome`, `predictedAway`) gerçek
skorla (`actualHome`, `actualAway`) karşılaştırılır:

| Durum | Puan |
|---|---|
| Tam skor tutar | 5 |
| Sonuç (ev/deplasman/beraberlik) ve averaj doğru, ama tam skor değil | 3 |
| Yalnızca sonuç doğru | 1 |
| Sonuç yanlış | 0 |
| Gerçek skor henüz girilmedi | `null` |

**Beraberlik yalnızca tam skorla 3'ü geçebilir, aksi hâlde en fazla 1 alır.**
Beraberliğin averajı matematiksel olarak her zaman 0'dır — 1-1 tahmin edip
2-2 görmek de "doğru sonuç + doğru averaj" testini teknik olarak geçer. Bunu
3 puanla ödüllendirmek, beraberlik tahmin etmeyi galibiyet tahmin etmekten
sistematik olarak daha kazançlı hale getirir (galibiyet tahmininde averajı
tutturmak gerçek bir isabet gerektirir, beraberlikte otomatik gelir). Kural
bu yüzden beraberliği bilerek 3'lük kademenin dışında tutuyor: tam skor
tutmadıkça beraberlik tahmini en fazla 1 puan eder.

### Sıralama eşitlik bozucu

`compareScorePredictionRows(a, b)` iki satırı şu sırayla karşılaştırır:
toplam puan, sonra tam skor sayısı, sonra (tam skorlar hariç) doğru averaj
sayısı, hepsi eşitse eşit sıra. Ana puan-tahmini sıralamasındaki
"tahminini önce kesinleştiren önde" kuralı (bkz. `standings()`,
`app/scoring.js`) burada yok — iki sıralama kasıtlı olarak ayrı, biri
diğerine dokunmadan değişebilir.

---

## Kilit

Kilit anı türetilir, ayrı tabloda tutulmaz:

```
lock_at(league, team) =
  min(fixture.kickoff_at) - league.lock_lead
  fixture'lar: league'in sezonunda, o takımın oynadığı maçlar
```

Bugünkü `team_locks` tablosu bunun elle doldurulmuş hâli. Fikstür veriye
taşınınca gereksizleşir.

Kilit sunucuda uygulanır — RLS politikası `now()` ile karşılaştırır. Tarayıcı
saatiyle oynanamaz.

---

## Görünürlük: iki ayrı kavram

Issue bunu doğru ayırmış, tekrar vurgulamakta fayda var:

**`visibility`** ligin kimler tarafından bulunabileceğini söyler.
`public` keşfedilebilir, `private` yalnızca davet koduyla.

**`prediction_visibility`** üyelerin birbirlerinin tahminlerini ne zaman
göreceğini söyler. `after_lock` kilitten sonra, `live` her zaman.

### Varsayılan tercihi

Şema varsayılanı **`after_lock`**, Main Server da bu değerle seed edilir.

Gerekçe: bu oyunun asıl sorusu "takım 8 maçta kaç puan toplar". Rakibinin
toplamını kilit öncesinde görebiliyorsan kendi tahminini ona göre ayarlarsın
ve yarışma anlamını yitirir. Kilit öncesi gizlilik dekoratif bir özellik değil,
oyunun temeli — mevcut sistemde REST düzeyinde test edilip doğrulandı.

`live` yine de geçerli bir seçenek: maç maç oynanan, sohbetin parçası olan bir
grup isteyebilir. Ama ligi kuran kişinin bilinçli tercihi olmalı, sessiz
varsayılan değil.

---

## RLS tasarımı

Yardımcı fonksiyonlar:

```
is_member(league)         üyelik kontrolü
is_league_admin(league)   role in ('owner','admin')
is_app_admin()            sistem yöneticisi
picks_open(league, team)  now() < lock_at(league, team)
team_locked(league, team) picks_open'ın tersi
```

Politika özeti:

| Tablo | select | insert / update |
|---|---|---|
| `teams`, `competitions`, `competition_seasons`, `fixtures` | herkes | `is_app_admin()` |
| `profiles` | herkes | yalnızca kendi satırı |
| `prediction_leagues` | üye, ya da `visibility='public'` | kurucu / `is_league_admin` |
| `prediction_league_members` | aynı ligin üyeleri | kendi katılımı, ya da lig admini |
| `prediction_league_teams` | üye | lig admini |
| `predictions` | aşağıdaki kural | kendi satırı ve `picks_open` |

`predictions` okuma kuralı:

```
is_member(league_id)
and (
  user_id = auth.uid()
  or league.prediction_visibility = 'live'
  or team_locked(league_id, subject_team_id)
)
```

Görünürlük kuralı arayüzde değil burada uygulanır. Doğrudan PostgREST isteği de
aynı kurala tabi olur.

---

## Mevcut 0002 incelemesi

`0002_multi_league.sql` hiç uygulanmadı. Bu modele göre değerlendirmesi:

**Kullanılabilir:** `profiles`, `league_members` yapısı, `is_member` /
`is_admin` yardımcıları, RLS yaklaşımı.

**Değişmeli:**

- `leagues.competition` metin sütunu → `competitions` + `competition_seasons`
  tabloları
- `fixtures.team_key` metin → `home_team_id` / `away_team_id` FK
- `results` lig başına → `fixtures` üzerinde gerçek skor
- `league_teams` korunmalı, adı `prediction_league_teams` olmalı
- `prediction_visibility` sütunu yok, eklenmeli
- `leagues` → `prediction_leagues` olarak yeniden adlandırılmalı

**Sonuç:** `0002` silinmeli, yerine `0007` gelmeli. Hiç uygulanmadığı için
geriye dönük düzenleme kuralını ihlal etmez, ama dosyayı silmek yerine başına
"uygulanmadı, yerine 0007 geçti" notu koymak geçmişi daha okunur bırakır.

---

## Geçiş planı

Mevcut çalışan sistem tek PR'da kırılmamalı. Sıra:

**1. Şema kurulur, kimse kullanmaz.** `0007` uygulanır. Yeni tablolar boş
durur, uygulama eski tablolarla çalışmaya devam eder.

**2. Referans verisi doldurulur.** `teams` (GS, FB ve rakipleri),
`competitions` (UCL), `competition_seasons` (2026/27), `fixtures` (16 maç).
Kaynak: `app/app.js` içindeki `TEAMS` sabiti.

**3. Main Server seed edilir.** `prediction_leagues` içinde
`system_managed = true`, `prediction_visibility = 'after_lock'`,
`visibility = 'public'`. Takımları GS ve FB.

**4. Mevcut veri taşınır.** `profiles` zaten var. `team_predictions` satırları
`predictions` tablosuna, `team_results` verisi `fixtures.home_goals` /
`away_goals` alanlarına.

**5. Frontend adım adım geçer.** Önce okuma yeni tablolardan, yazma hâlâ
eskiye. Doğrulandıktan sonra yazma da geçer.

> Kısmen tamamlandı: `app/app.js` artık takım adı/tla/renk ve fikstürü
> `teams`/`fixtures`'tan okuyor (`loadTeamsFromDB()`). Tahmin ve sonuç
> okuma/yazma hâlâ tamamen `team_predictions` / `team_results` üzerinde —
> bu adımın geri kalanı henüz yapılmadı.

**6. Eski tablolar bırakılır.** `team_predictions`, `team_results`,
`team_locks` düşürülür.

### Zamanlama

Bu geçiş **kilitlerden sonra** yapılmalı: GS 9 Eylül 21:00, FB 10 Eylül 21:00.

Sebebi, kilit sonrasında tahminlerin donmuş olması. Taşıma sırasında bir şey
kırılırsa veri kaybı riski çok düşer, çünkü yazma trafiği yok. Kilit öncesinde
taşırsan ve bir şey ters giderse sekiz kişinin tahminleri tehlikeye girer ve
yarışma hiç başlamayabilir.

Adım 1 ve 2 (şema kurulumu ve referans verisi) risksiz, kilitten önce de
yapılabilir — çünkü hiçbir şey onları okumuyor.

---

## Açık sorular

**Sonuç girme yetkisi.** Model gerçek skoru global tutuyor, yani yalnızca
sistem yöneticisi girer. Lig adminlerinin kendi liglerinde skor girebilmesi
isteniyorsa bu karar değişir ve `fixtures` üzerinde değil ayrı bir tabloda
tutulması gerekir. Otomatik çekmeye geçilecekse global kalması daha doğru.

**Bir kullanıcı kaç ligde olabilir?** Model sınırlamıyor. Arayüzün lig seçici
ile başlaması gerekecek, bu ayrı bir tasarım işi.

**Takım seçimi serbest mi?** Bir lig herhangi bir takımı takip edebilir mi,
yoksa sezonun takımlarıyla mı sınırlı? Serbest bırakılırsa fikstürü olmayan bir
takım seçilebilir ve lig boş kalır.

**Fikstür değişiklikleri.** UEFA maç saatini erteleyebilir. Kilit türetilmiş
olduğu için kilit anı da kayar — kilitten sonra ertelenen bir maç için ne
olacağı tanımlanmalı.
