# app/assets/teams/

Takım arması (crest) dosyaları buraya gelir. Tam standart için
[`docs/ASSETS.md`](../../../docs/ASSETS.md) belgesine bak — burada yalnızca
dosya adlandırma kuralı özetlenir.

## Adlandırma

```
app/assets/teams/<key>.<ext>
app/assets/teams/<key>.json      (zorunlu — bkz. docs/ASSETS.md)
```

`<key>`, `app/app.js` içindeki `TEAMS` nesnesinin anahtarıyla aynı olmalı
(bugün `gs`, `fb`; ileride `teams.slug` sütunuyla birebir eşleşecek). Küçük
harf, tire yok, alt çizgi yok.

Örnek:

```
app/assets/teams/gs.svg
app/assets/teams/gs.json
```

## Bu dosyayı `TEAMS`'e bağlamak

```js
gs: {
  ...
  crest: "./assets/teams/gs.svg",
  ...
}
```

`crest` alanı `null` bırakılırsa `teamLogo()` otomatik olarak monogram
rozetine düşer — kırık bir dosya yolu asla kullanıcıya kırık resim ikonu
olarak görünmez, ama önce burada, tarayıcıda test et.

## Bu PR'da

Bu dizin ve adlandırma kuralı kuruluyor, hiçbir arma dosyası eklenmiyor.
İlk dosyayı eklerken `docs/ASSETS.md`'deki adımları takip et.
