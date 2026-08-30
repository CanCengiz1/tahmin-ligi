# Yol haritası

Sıralama önemli: her faz bir öncekinin üstüne kuruluyor. Özellikle Faz 2'yi
Faz 3'ten önce yapmak, ön yüzü iki kez yazmamayı sağlıyor.

---

## Faz 0 — Depo düzeni  ·  yarım gün

Kod değişmez, çevresi düzenlenir.

- [x] Ayarlar `config.js` dosyasına taşındı, `.gitignore` eklendi
- [ ] GitHub'da özel depo, `main` korumalı
- [ ] Arkadaşına yazma yetkisi, çalışma dalları üzerinden PR
- [ ] Netlify'ı depoya bağla (elle sürükleme yerine push ile dağıtım)

**Bitti sayılır:** iki kişi de klonlayıp çalıştırabiliyor, kimsenin anahtarı
depoda değil.

---

## Faz 1 — Puanlama mantığını ayır  ·  1 gün

Ön yüzü taşımadan önce kuralları güvenceye al.

- [x] `tally`, `standings`, eşitlik bozma kurallarını `scoring.js` dosyasına çıkar
- [x] Vitest ile test yaz: eşit toplam farklı isabet, hataların birbirini
      götürmesi, yarım sezon, tek katılımcı, hiç sonuç yok
- [x] `index.html` bu dosyayı içe aktarsın

**Neden önce bu:** puanlama kuralları en çok tartıştığımız yer. Testler
olmadan taşıma sırasında sessizce bozulur.

---

## Faz 2 — Gerçek veritabanı ve kimlik  ·  3–5 gün

Açık betanın gerçek önkoşulu. Bunsuz yayılmak riskli.

- [ ] Yeni Supabase projesi (mevcut lig bozulmasın)
- [ ] `0002_multi_league.sql` migrasyonunu uygula
- [ ] Supabase Auth: e-posta ile tek kullanımlık kod
- [ ] Lig kurma, davet kodu üretme, kodla katılma akışları
- [ ] Fikstürü `fixtures` tablosuna taşı (2026/27 CL, gs + fb ile başla)
- [ ] Mevcut ligi taşıyan tek seferlik betik: `entries` → yeni tablolar
- [ ] RLS politikalarını doğrula: üye olmayan okuyamıyor, admin olmayan sonuç
      yazamıyor, kilit sonrası tahmin değişmiyor

**Bitti sayılır:** iki farklı lig birbirini görmüyor; kilit ve yetki
veritabanında uygulanıyor.

---

## Faz 3 — Ön yüzü taşı  ·  3–5 gün

- [ ] Vite + React + TypeScript iskeleti
- [ ] `supabase-js` istemcisi, oturum yönetimi
- [ ] Ekranları taşı: giriş, lig seçimi, takım sekmeleri, sıralama, sonuç girişi
- [ ] Tasarımı koru — mevcut koyu tema ve takım renkleri kimliği taşıyor
- [ ] Realtime abonelik: sonuç girilince herkeste anında güncellensin

---

## Faz 4 — Açık beta  ·  2–3 gün

- [ ] Karşılama sayfası: ne olduğu, nasıl lig kurulur
- [ ] Davet linki paylaşımı (WhatsApp'a uygun kısa link + önizleme)
- [ ] Hız sınırı: lig kurma ve katılma isteklerine sınır
- [ ] Basit kötüye kullanım koruması: isim uzunluğu, küfür filtresi tartışılır
- [ ] Hata izleme (Sentry ücretsiz katman)
- [ ] Gizlilik metni: hangi veri tutuluyor, nasıl silinir

---

## Faz 5 — İsteğe bağlı

Gerçek ihtiyaç doğmadan yapılmamalı.

- Sonuçları otomatik çekme (football-data.org, Edge Function + zamanlanmış görev).
  16 maç için elle giriş yeterliydi; lig sayısı artınca mantıklı hale gelir.
- "En mal" rozeti ve sezon sonu kartı (tasarımı hazır, kod bekliyor)
- Bildirimler: kilit yaklaşınca hatırlatma
- Diğer turnuvalar ve takımlar

---

## Kapsam dışı

Kaydedilmesi, sonradan tartışılmaması için:

- Mobil uygulama. Web yeterli, "ana ekrana ekle" ile uygulama gibi duruyor.
- Para veya bahis. Hukuki yük getirir, oyunun ruhunu değiştirir.
- Karmaşık puanlama (skor tahmini, joker, çarpan). Basitlik oyunun değeri.
