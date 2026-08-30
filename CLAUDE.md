# Claude Code için proje notları

## Proje nedir

Arkadaş grubu için Şampiyonlar Ligi tahmin oyunu. Katılımcı, takip edilen
takımın 8 maçının her birinden kaç puan alacağını tahmin eder (3/1/0).
Tahminler ilk maçtan 1 saat önce kilitlenir. Takımın gerçek toplamına en yakın
tahmini yapan kazanır.

## Şu anki durum

`app/index.html` (HTML + CSS + vanilla JS) ve `app/scoring.js` (saf puanlama
fonksiyonları, ES module olarak `index.html`'e import ediliyor). Derleme
adımı yok. Veri Supabase PostgREST'e `fetch` ile gidiyor. Ayrıntı için
`ARCHITECTURE.md`.

Hedef, çok ligli açık sürüm. Sıra ve kapsam `ROADMAP.md` içinde.

## Çalışma kuralları

- Türkçe arayüz metni, İngilizce kod ve değişken adları.
- Puanlama kurallarını değiştirmeden önce sor. Bu kurallar uzun tartışma
  sonucu oturdu, `ARCHITECTURE.md` içindeki "Puanlama kuralları" bölümü
  bağlayıcıdır.
- `app/config.js` okunmaz, yazılmaz, commit edilmez.
- Migrasyon dosyaları geriye dönük düzenlenmez, yeni numara eklenir.
- `app/scoring.js`'i değiştirdikten sonra `npm test` (Vitest) çalıştır.
- `index.html`'in ana script bloğu `type="module"`; sözdizimi doğrulaması
  için `node --check` kullan (`new Function` ile sarma artık `import`
  bildirimini parse edemez).
- Tasarım koyu tema üzerine kurulu, takım renkleri kimliği taşıyor
  (GS #F5A800/#A90432, FB #FFE500/#12356E). Yeni ekran eklerken bu dile uy.

## Bilinen sınırlar

Bunlar bilinçli tercih, hata değil. Faz 2'de çözülecek:

- Kimlik: takma ad + 6 haneli PIN, hash'li ama kırılabilir.
- Yetki ve kilit yalnızca arayüzde; RLS henüz uygulamıyor.
- Son yazan kazanır, eşzamanlı yazma çakışması ele alınmıyor.

## Sık yapılan iş

Fikstür güncelleme: `TEAMS.gs.matches` ve `TEAMS.fb.matches` dizileri,
`app/index.html` içinde. Kilit anı `TEAMS.<takim>.lock` alanından bir saat önce.
