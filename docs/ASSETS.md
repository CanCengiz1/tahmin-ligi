# Varlık standardı: takım armaları

Bu belge `app/assets/teams/` altına eklenecek takım arması (crest) dosyaları
için standardı tanımlar. Bu PR'da hiçbir arma dosyası eklenmiyor — yalnızca
dizin, adlandırma kuralı ve bu süreç kuruluyor.

İlgili kod: `app/app.js` içindeki `TEAMS` sabiti ve `teamLogo(team, size)`.
İlgili şema: `docs/DOMAIN.md` içindeki `teams.crest_url`.

## Neden bu kadar katı

`teamLogo()` üç kademeli bir çözünürlük sırası izler: crest → iki renkli
monogram → "?" rozeti. Kırık bir görsel asla kullanıcıya kırık resim ikonu
olarak görünmemeli (`onerror` sessizce monograma düşer). Bunun güvenilir
çalışması için dosya adları, formatları ve `TEAMS`'teki `crest` yolu
öngörülebilir olmalı.

## Tercih edilen formatlar

1. **SVG** — ilk tercih. Ölçeklenebilir, 24/32/44px'in hepsinde keskin,
   dosya boyutu küçük. Şeffaf arka plan.
2. **PNG** — SVG yoksa. Şeffaf arka plan (alfa kanallı), en az 128×128px
   kaynak (44px'te dahi net görünmesi için), optimize edilmiş
   (`oxipng`/`pngquant` vb.).
3. **JPG kullanma.** Şeffaflık yok, `.tlogo-crest` arkasındaki nötr yüzeyle
   (`#F4F1EA`) her zaman bir kutu sınırı görünür.

Boyut sınırı: SVG için ~30KB, PNG için ~60KB. Daha büyükse önce optimize et.

Kare olması şart değil — `object-fit: contain` kullanıldığı için herhangi
bir en-boy oranı sığar, yerleşim bozulmaz. Ama aşırı yatay/dikey oranlardan
kaçın; küçük boyutlarda (24px) okunmaz hale gelir.

## Adlandırma

```
app/assets/teams/<key>.<ext>
app/assets/teams/<key>.json
```

`<key>` = `TEAMS` nesnesindeki anahtar (`gs`, `fb`, ileride `teams.slug`).
Küçük harf, sadece `[a-z0-9]`.

## Her dosya için tutulacak metadata

Her `<key>.<ext>` dosyasının yanında aynı isimde bir `<key>.json` bulunur:

```json
{
  "source_url": "https://…",
  "provider": "Wikimedia Commons",
  "license_note": "Kulüp logosu — ticari olmayan, kimlik gösterimi amaçlı kullanım. Ayrıntı: <lisans sayfası linki>",
  "verified_at": "2026-09-01"
}
```

| Alan | Açıklama |
|---|---|
| `source_url` | Dosyanın indirildiği tam adres. |
| `provider` | Kaynak (kulübün resmi medya kiti, Wikimedia Commons, football-data.org vb.). |
| `license_note` | Hangi lisans/izin altında kullanıldığı, kısa gerekçe. Emin değilsen ekleme — bkz. aşağıdaki uyarı. |
| `verified_at` | Lisansın ve dosyanın son kontrol edildiği tarih (`YYYY-MM-DD`). Kulüpler zaman zaman marka kullanım politikasını değiştirir; bu tarih yeniden kontrol zamanının geldiğini anlamak için var. |

Bu `.json` dosyaları uygulama tarafından okunmaz, yalnızca insan için arşiv
kaydıdır — repo içinde armanın nereden geldiğini ve hangi izinle
kullanıldığını izlenebilir tutar.

## Telif uyarısı

Takım armaları genelde tescilli marka. `docs/DOMAIN.md`'deki `teams.crest_url`
alanı bilinçli olarak "opsiyonel, telif dikkat" notuyla işaretli. Kaynağın
yeniden dağıtıma izin verdiğinden emin olmadan dosya ekleme; emin değilsen
`crest`'i `null` bırak — `teamLogo()` bunu sorunsuz karşılar ve monograma
düşer.

## Yeni bir arma ekleme adımları

1. İzinli bir kaynak bul (kulübün resmi medya kiti, uygun lisanslı Wikimedia
   Commons dosyası, ya da yeniden dağıtım hakkı tanıyan bir sağlayıcı).
2. Yukarıdaki format/boyut kurallarına göre dosyayı hazırla (gerekirse
   optimize et).
3. `app/assets/teams/<key>.<ext>` ve `app/assets/teams/<key>.json`
   dosyalarını ekle.
4. `app/app.js` içinde ilgili takımın `crest` alanını dosya yoluna ayarla:
   `crest:"./assets/teams/<key>.<ext>"`.
5. Uygulamayı aç, üç boyutta da (`sm`/`md`/`lg`) hem GS hem FB temasında
   kontrol et: kırpılma yok, bulanıklaşma yok, nötr yüzey üstünde okunur.
6. `onerror` yolunu test et: dosya adını geçici olarak değiştirip
   monograma sessizce düştüğünü doğrula, sonra adı geri al.
7. `npm test` çalıştır, commit et.
