import { describe, it, expect } from "vitest";
import { empty, tally, confirmedAt, standings, revealedTeams, MATCH_COUNT } from "./scoring.js";

const win = (...vals) => vals; // 3/1/0 dizisini okunaklı kurmak için

describe("empty", () => {
  it("8 elemanlı, hepsi null bir dizi döner", () => {
    const e = empty();
    expect(e).toHaveLength(MATCH_COUNT);
    expect(e.every(x => x === null)).toBe(true);
  });

  it("her çağrıda yeni bir dizi döner (paylaşılan referans yok)", () => {
    const a = empty();
    const b = empty();
    a[0] = 3;
    expect(b[0]).toBe(null);
  });
});

describe("tally", () => {
  it("tüm tahminler tutunca predicted, hits ve earned eşit ve tam olur", () => {
    const actual = win(3, 1, 0, 3, 1, 0, 3, 1);
    const t = tally(actual.slice(), actual);
    expect(t).toEqual({ predicted: 12, hits: 8, earned: 12 });
  });

  it("hiç tutmayan tahminlerde hits ve earned sıfır, predicted yine sayılır", () => {
    const actual = win(3, 3, 3, 3, 3, 3, 3, 3);
    const picks = win(0, 0, 0, 0, 0, 0, 0, 0);
    const t = tally(picks, actual);
    expect(t).toEqual({ predicted: 0, hits: 0, earned: 0 });
  });

  it("hatalar birbirini götürebilir: toplam doğru ama hiçbir maç tutmamış", () => {
    // gerçek: 3,0,3,0 (toplam 6) — tahmin: 0,3,0,3 (toplam 6) — hiçbiri tutmuyor
    const actual = win(3, 0, 3, 0);
    const picks = win(0, 3, 0, 3);
    const t = tally(picks, actual);
    expect(t.predicted).toBe(6);
    expect(t.hits).toBe(0);
    expect(t.earned).toBe(0);
  });

  it("hatalar birbirini götürebilir: 8 maçlık toplam tutar ama isabet az", () => {
    // gerçek: 3,3,3,3,3,0,0,0 (toplam 15) — tahmin: 0,0,0,3,3,3,3,3 (toplam 15)
    // sadece 4. ve 5. maçlar tutuyor, geri kalanı hatalar birbirini götürüyor
    const actual = win(3, 3, 3, 3, 3, 0, 0, 0);
    const picks = win(0, 0, 0, 3, 3, 3, 3, 3);
    const t = tally(picks, actual);
    expect(t.predicted).toBe(15);
    expect(actual.reduce((a, b) => a + b, 0)).toBe(15); // toplamlar eşit
    expect(t.hits).toBe(2);
    expect(t.earned).toBe(6); // 4. ve 5. maçlardan (3+3)
  });

  it("henüz oynanmamış maçlar (actual null) hem predicted'a hem hits'e girmez ama tahmin edilmişse predicted'a girer", () => {
    const actual = win(3, null, null, null, null, null, null, null);
    const picks = win(3, 1, 0, null, null, null, null, null);
    const t = tally(picks, actual);
    expect(t.predicted).toBe(4); // 3 + 1 + 0
    expect(t.hits).toBe(1);
    expect(t.earned).toBe(3);
  });

  it("picks null (hiç tahmin girilmemiş) verilirse empty() gibi davranır", () => {
    const actual = win(3, 1, 0, 3, 1, 0, 3, 1);
    const t = tally(null, actual);
    expect(t).toEqual({ predicted: 0, hits: 0, earned: 0 });
  });

  it("işaretli ama actual'da null olan maçlar sayılmaz", () => {
    const actual = empty();
    const picks = win(3, 1, 0, 3, 1, 0, 3, 1);
    const t = tally(picks, actual);
    expect(t).toEqual({ predicted: 12, hits: 0, earned: 0 });
  });
});

describe("confirmedAt", () => {
  it("conf alanında zaman damgası varsa onu döner", () => {
    expect(confirmedAt({ conf: { gs: 1700000000000 } }, "gs")).toBe(1700000000000);
  });

  it("conf yoksa veya ilgili takım kesinleştirilmemişse null döner", () => {
    expect(confirmedAt({ conf: { gs: null } }, "gs")).toBe(null);
    expect(confirmedAt({}, "gs")).toBe(null);
    expect(confirmedAt(null, "gs")).toBe(null);
  });
});

describe("standings", () => {
  it("hiç sonuç yokken (bütün maçlar null) herkesin farkı ve isabeti sıfırdır, sezon bitmemiştir", () => {
    const players = [
      { id: "a", name: "Ali", gs: win(3, 1, 0, 3, 1, 0, 3, 1), updatedAt: 10 },
      { id: "b", name: "Beste", gs: win(0, 0, 0, 0, 0, 0, 0, 0), updatedAt: 20 },
    ];
    const results = { gs: empty(), fb: empty() };
    const st = standings(players, results, "gs");
    expect(st.played).toBe(0);
    expect(st.finished).toBe(false);
    expect(st.at).toBe(0);
    expect(st.rows.every(r => r.hits === 0)).toBe(true);
  });

  it("tek katılımcıda sıralama tek satırdan oluşur ve sıralama kararı gerekmez", () => {
    const players = [{ id: "a", name: "Ali", gs: win(3, 1, 0, 3, 1, 0, 3, 1), updatedAt: 10 }];
    const results = { gs: win(3, 1, 0, 3, 1, 0, 3, 1), fb: empty() };
    const st = standings(players, results, "gs");
    expect(st.rows).toHaveLength(1);
    expect(st.finished).toBe(true);
    expect(st.rows[0].total).toBe(12);
  });

  it("yarım sezonda (bazı maçlar oynanmamış) sıralama isabet sayısına göre yapılır, farka göre değil", () => {
    // İlk 4 maç oynandı, kalan 4'ü null. Ali 4/4 doğru, Beste hiç doğru değil
    // ama toplamları (predicted) tutuyor.
    const actual = win(3, 1, 0, 3, null, null, null, null);
    const players = [
      { id: "a", name: "Ali", gs: win(3, 1, 0, 3, 1, 0, 3, 1), updatedAt: 10 },
      { id: "b", name: "Beste", gs: win(1, 3, 3, 1, 0, 0, 0, 0), updatedAt: 20 },
    ];
    const results = { gs: actual, fb: empty() };
    const st = standings(players, results, "gs");
    expect(st.finished).toBe(false);
    expect(st.played).toBe(4);
    const ali = st.rows.find(r => r.id === "a");
    const beste = st.rows.find(r => r.id === "b");
    expect(ali.hits).toBe(4);
    expect(beste.hits).toBe(0);
    // sezon bitmediği için sıralama farka değil isabete bakar
    expect(st.rows[0].id).toBe("a");
  });

  it("sezon bitince eşit toplamda farklı isabet sayısı sıralamayı belirler", () => {
    // Gerçek toplam 12. Ali'nin tahmin toplamı da 12 ama hiçbir maçı bilmedi
    // (hatalar birbirini götürdü). Beste'nin toplamı da 12 ve 8 maçın 8'ini bildi.
    const actual = win(3, 0, 3, 0, 3, 0, 3, 0); // toplam 12
    const players = [
      { id: "a", name: "Ali", gs: win(0, 3, 0, 3, 0, 3, 0, 3), updatedAt: 10 }, // toplam 12, hits 0
      { id: "b", name: "Beste", gs: win(3, 0, 3, 0, 3, 0, 3, 0), updatedAt: 20 }, // toplam 12, hits 8
    ];
    const results = { gs: actual, fb: empty() };
    const st = standings(players, results, "gs");
    expect(st.finished).toBe(true);
    expect(st.at).toBe(12);
    const ali = st.rows.find(r => r.id === "a");
    const beste = st.rows.find(r => r.id === "b");
    expect(ali.total).toBe(12);
    expect(beste.total).toBe(12);
    expect(ali.hits).toBe(0);
    expect(beste.hits).toBe(8);
    // aynı farka (0) sahipler ama Beste maç bazında daha çok bildiği için önde
    expect(st.rows[0].id).toBe("b");
    expect(st.rows[1].id).toBe("a");
  });

  it("hatalar birbirini götürüp aynı toplama ulaşan iki tahminde az isabet eden geride kalır", () => {
    // gerçek: 3,3,3,3,3,0,0,0 (toplam 15)
    const actual = win(3, 3, 3, 3, 3, 0, 0, 0);
    const players = [
      // Ali: 0,0,0,3,3,3,3,3 — toplam 15 ama sadece 2 maç tutuyor (hatalar birbirini götürdü)
      { id: "a", name: "Ali", gs: win(0, 0, 0, 3, 3, 3, 3, 3), updatedAt: 10 },
      // Beste: gerçekle birebir aynı — toplam 15, 8 maçın 8'i de tutuyor
      { id: "b", name: "Beste", gs: win(3, 3, 3, 3, 3, 0, 0, 0), updatedAt: 20 },
    ];
    const results = { gs: actual, fb: empty() };
    const st = standings(players, results, "gs");
    expect(st.finished).toBe(true);
    const ali = st.rows.find(r => r.id === "a");
    const beste = st.rows.find(r => r.id === "b");
    expect(ali.total).toBe(15);
    expect(beste.total).toBe(15);
    expect(ali.hits).toBe(2);
    expect(beste.hits).toBe(8);
    expect(st.rows[0].id).toBe("b"); // aynı farka (0) sahipler, daha çok isabet eden önde
    expect(st.rows[1].id).toBe("a");
  });

  it("fark ve isabet de eşitse tahminini önce kesinleştiren (küçük conf/updatedAt) önde olur", () => {
    const actual = win(3, 1, 0, 3, 1, 0, 3, 1); // toplam 12
    const players = [
      { id: "a", name: "Ali", gs: win(0, 0, 0, 0, 0, 0, 0, 0), conf: { gs: 500 }, updatedAt: 500 }, // toplam 0, hits 0
      { id: "b", name: "Beste", gs: win(0, 0, 0, 0, 0, 0, 0, 0), conf: { gs: 100 }, updatedAt: 100 }, // toplam 0, hits 0, daha erken kesinleşti
    ];
    const results = { gs: actual, fb: empty() };
    const st = standings(players, results, "gs");
    expect(st.rows[0].id).toBe("b");
    expect(st.rows[1].id).toBe("a");
  });

  it("bilinmeyen scope 'gs'ye düşer", () => {
    const players = [{ id: "a", name: "Ali", gs: win(3, 1, 0, 3, 1, 0, 3, 1), updatedAt: 10 }];
    const results = { gs: win(3, 1, 0, 3, 1, 0, 3, 1), fb: empty() };
    const st = standings(players, results, "nope");
    expect(st.scope).toBe("gs");
    expect(st.finished).toBe(true);
  });

  it("opts.revealed sadece geri döner, sıralama mantığını etkilemez", () => {
    const players = [{ id: "a", name: "Ali", gs: empty(), updatedAt: 10 }];
    const results = { gs: empty(), fb: empty() };
    expect(standings(players, results, "gs", { revealed: true }).revealed).toBe(true);
    expect(standings(players, results, "gs", { revealed: false }).revealed).toBe(false);
    expect(standings(players, results, "gs").revealed).toBe(false);
  });
});

describe("revealedTeams", () => {
  it("karışık kilit penceresi: GS kilitli, FB değilken başkasının satırında FB gösterilmez", () => {
    // GS'nin ilk maçı FB'ninkinden önce, aradaki saatlerde GS kilitli olur ama
    // FB henüz açık kalır — tam da sızıntının yaşandığı pencere.
    const isLocked = k => k === "gs";
    const shown = revealedTeams(/* mine */ false, isLocked);
    expect(shown).toContain("gs");
    expect(shown).not.toContain("fb");
  });

  it("kendi satırında (mine) her iki takım da kilit durumundan bağımsız gösterilir", () => {
    const isLocked = () => false; // hiçbir takım kilitli değil
    const shown = revealedTeams(/* mine */ true, isLocked);
    expect(shown).toEqual(["gs", "fb"]);
  });

  it("hiçbir takım kilitli değilken ve satır başkasınaysa hiçbiri gösterilmez", () => {
    const isLocked = () => false;
    expect(revealedTeams(false, isLocked)).toEqual([]);
  });

  it("her iki takım da kilitliyken başkasının satırında ikisi de gösterilir", () => {
    const isLocked = () => true;
    expect(revealedTeams(false, isLocked)).toEqual(["gs", "fb"]);
  });
});
