/*
 * Puanlama mantığı — saf fonksiyonlar, DOM'a veya Supabase'e dokunmaz.
 * Kurallar ARCHITECTURE.md "Puanlama kuralları" bölümünde bağlayıcı olarak
 * tanımlı; burada değiştirilmeden index.html'den taşındı (Faz 1).
 */

export const MATCH_COUNT = 8;

export function empty() {
  return [null, null, null, null, null, null, null, null];
}

export function tally(picks, actual) {
  let predicted = 0, hits = 0, earned = 0;
  (picks || empty()).forEach((p, i) => {
    if (p !== null) predicted += p;
    if (actual[i] !== null && p !== null && p === actual[i]) { hits++; earned += actual[i]; }
  });
  return { predicted, hits, earned };
}

export function confirmedAt(p, k) {
  return (p && p.conf && p.conf[k]) || null;
}

/*
 * Bir oyuncunun satırı açıldığında hangi takımların tahminleri gösterilsin?
 * Kural her takım için ayrı: kendi satırınsa (mine) ya da o takım kilitliyse
 * (isLocked(k) === true) gösterilir. Tek bir "revealed" bayrağıyla ikisini
 * birden açıp kapatmak, biri kilitliyken diğeri açıkken sızıntıya yol açar.
 */
export function revealedTeams(mine, isLocked, teamKeys) {
  teamKeys = teamKeys || ["gs", "fb"];
  return teamKeys.filter(k => !!mine || !!isLocked(k));
}

/*
 * players: [{ id, name, gs[8], fb[8], conf:{gs,fb}, updatedAt }, ...]
 * results: { gs[8], fb[8] } — her eleman puan (3/1/0) ya da henüz girilmediyse null
 * scope:   "gs" | "fb" — geçersizse "gs" varsayılır
 * opts.revealed: kilit sonrası tahminlerin herkese açık gösterilip gösterilmeyeceği
 *   (saat/fikstür bilgisine bağlı, bu modülün dışında hesaplanır)
 */
export function standings(players, results, scope, opts) {
  opts = opts || {};
  scope = (scope === "gs" || scope === "fb") ? scope : "gs";
  const revealed = !!opts.revealed;
  const actual = results[scope] || empty();
  const at = actual.reduce((a, b) => a + (b || 0), 0);
  const rows = (players || []).map(p => {
    const t = tally(p[scope], actual);
    const g = tally(p.gs, results.gs || empty());
    const f = tally(p.fb, results.fb || empty());
    return Object.assign({}, p, { g, f, total: t.predicted, hits: t.hits });
  });
  const played = actual.filter(x => x !== null).length;
  const total = MATCH_COUNT;
  const finished = played === total;
  const ct = p => Math.max(confirmedAt(p, "gs") || 0, confirmedAt(p, "fb") || 0) || p.updatedAt || 0;
  rows.sort((a, b) => {
    // sezon boyunca: en cok maci bilen ustte
    // butun maclar bitince: toplam puana en yakin tahmin kazanir
    if (finished) {
      const da = Math.abs(a.total - at), db = Math.abs(b.total - at);
      if (da !== db) return da - db;
    }
    if (a.hits !== b.hits) return b.hits - a.hits;   // esitlikte: mac bazinda daha cok bilen
    return ct(a) - ct(b);                            // o da esitse: tahminini once kesinlestiren
  });
  return { rows, at, played, total, finished, revealed, scope };
}
