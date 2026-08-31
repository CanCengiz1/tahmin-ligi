import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configured = !!(window.CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
if (!configured) {
  console.warn("Legacy account migration disabled: Supabase config is missing.");
} else {
  const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession:true, autoRefreshToken:false, detectSessionInUrl:false }
  });

  let legacyScreenOpen = false;
  let busy = false;
  let pendingOverwrite = false;

  const state = () => window.S;
  const userKey = suffix => state()?.user?.id ? `tl_legacy_${suffix}:${state().user.id}` : null;
  const normName = value => String(value || "").trim().replace(/\s+/g, " ");
  const legacyNameKey = value => normName(value).toLocaleLowerCase("tr");

  function hasVisiblePredictionData() {
    const me = state()?.me;
    if (!me) return false;
    return ["gs", "fb"].some(team =>
      (Array.isArray(me[team]) && me[team].some(value => value !== null)) ||
      !!me.conf?.[team]
    );
  }

  // Server tarafındaki claim RPC'si "hedefte tahmin var mı" kararını satır
  // varlığına göre veriyor (içerik boş olsa da). Uyarı/onay akışı bu yüzden
  // görsel sezgiye değil gerçek satır sayısına bakmalı.
  async function hasExistingPredictionRows() {
    const uid = state()?.user?.id;
    if (!uid) return false;
    try {
      const { count, error } = await supabase
        .from("team_predictions")
        .select("team_key", { count:"exact", head:true })
        .eq("user_id", uid);
      if (error) throw error;
      return (count || 0) > 0;
    } catch (e) {
      console.error(e);
      return hasVisiblePredictionData();
    }
  }

  function offerDismissed() {
    const key = userKey("offer_dismissed");
    return key ? localStorage.getItem(key) === "1" : false;
  }

  function alreadyMigrated() {
    const key = userKey("migrated");
    return key ? localStorage.getItem(key) === "1" : false;
  }

  // Kilit her iki takım için de geçtiyse legacy claim'in kilit-sonrası geri
  // yükleme özelliği hâlâ çalışır (RPC bunu bilerek destekler), ama teklifi
  // ön yüzde göstermeye artık gerek yok.
  function anyTeamOpen() {
    const isLocked = window.locked;
    if (typeof isLocked !== "function") return true;
    return ["gs", "fb"].some(k => !isLocked(k));
  }

  function eligibleForOffer() {
    const s = state();
    return !!s?.user && !!s?.me && !legacyScreenOpen && !alreadyMigrated() && anyTeamOpen();
  }

  function injectOffer() {
    if (!eligibleForOffer()) return;
    const app = document.getElementById("app");
    if (!app) return;
    const nav = app.querySelector(".wrap > nav");
    if (!nav || app.querySelector("#legacy-account-offer") || app.querySelector("#legacy-account-link")) return;

    if (offerDismissed()) {
      // Kart kapatıldı ama taşıma hâlâ mümkün: küçük bir giriş noktası bırak.
      const wrap = document.createElement("div");
      wrap.id = "legacy-account-link";
      wrap.style.margin = "12px 20px 0";
      wrap.innerHTML = '<button class="ghost">Eski PIN hesabını taşı</button>';
      wrap.querySelector("button")?.addEventListener("click", openClaimScreen);
      nav.insertAdjacentElement("afterend", wrap);
      return;
    }

    const card = document.createElement("div");
    card.id = "legacy-account-offer";
    card.className = "info";
    card.style.margin = "16px 20px 0";
    card.innerHTML = `
      <b>Eski PIN hesabın var mı?</b>
      Önceki sürümde tahmin girdiysen eski kullanıcı adın ve 6 haneli PIN'inle
      tahminlerini bu yeni hesaba tek seferde taşıyabilirsin.
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="ghost" id="legacy-claim-open">Tahminleri taşı</button>
        <button class="ghost" id="legacy-claim-dismiss">Bende yok</button>
      </div>`;
    nav.insertAdjacentElement("afterend", card);

    card.querySelector("#legacy-claim-open")?.addEventListener("click", openClaimScreen);
    card.querySelector("#legacy-claim-dismiss")?.addEventListener("click", () => {
      const key = userKey("offer_dismissed");
      if (key) localStorage.setItem(key, "1");
      card.remove();
      queueMicrotask(injectOffer);
    });
  }

  function renderMessage(text) {
    const el = document.getElementById("legacy-claim-message");
    if (el) el.textContent = text || "";
  }

  async function openClaimScreen() {
    const s = state();
    if (!s?.user || !s?.me) return;

    legacyScreenOpen = true;
    s.legacyClaimOpen = true;
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = '<div id="join"><div><h1 class="big">Eski hesabını taşı</h1><p class="lead">Yükleniyor…</p></div></div>';

    pendingOverwrite = await hasExistingPredictionRows();
    if (!legacyScreenOpen) return; // bu sırada kapatıldıysa (ör. çıkış yapıldı) çizme

    const warn = pendingOverwrite
      ? '<div class="warn">Bu hesapta zaten girilmiş tahminler var. Eski hesabı taşırsan bu tahminlerin üzerine yazılır ve geri alınamaz.</div>'
      : '';

    app.innerHTML = `
      <div id="join"><div>
        <h1 class="big">Eski hesabını taşı</h1>
        <p class="lead">
          Önceki Tahmin Ligi sürümünde kullandığın kullanıcı adı ve 6 haneli PIN ile
          eski GS/FB tahminlerini bu hesaba aktar.
        </p>
        ${warn}
        <label class="lbl" for="legacy-name">Eski kullanıcı adı</label>
        <input id="legacy-name" class="field" maxlength="40" autocomplete="off" placeholder="Eski takma adın">
        <label class="lbl" for="legacy-pin">Eski 6 haneli PIN</label>
        <input id="legacy-pin" class="field" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••">
        <button id="legacy-claim-submit" class="primary">Eski tahminleri taşı</button>
        <p id="legacy-claim-message" class="fine authmsg"></p>
        <p class="fine">
          Taşıma tek seferliktir. Eski admin yetkisi güvenlik nedeniyle otomatik taşınmaz.
        </p>
        <button id="legacy-claim-back" class="back">← Uygulamaya dön</button>
      </div></div>`;

    document.getElementById("legacy-claim-submit")?.addEventListener("click", claimLegacyAccount);
    document.getElementById("legacy-claim-back")?.addEventListener("click", closeClaimScreen);
    document.getElementById("legacy-pin")?.addEventListener("keydown", event => {
      if (event.key === "Enter") claimLegacyAccount();
    });
  }

  function closeClaimScreen() {
    legacyScreenOpen = false;
    if (state()) state().legacyClaimOpen = false;
    window.render?.();
    queueMicrotask(injectOffer);
  }

  async function legacyPinHash(name, pin) {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Bu tarayıcı güvenli hesap taşıma işlemini desteklemiyor.");
    }
    const bytes = new TextEncoder().encode(`${legacyNameKey(name)}:${pin}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function claimError(code) {
    switch (code) {
      case "legacy_account_not_found": return "Eski kullanıcı adı veya PIN eşleşmedi.";
      case "legacy_account_already_claimed": return "Bu eski hesap daha önce başka bir yeni hesaba taşınmış.";
      case "target_account_already_claimed_legacy": return "Bu yeni hesaba daha önce bir eski hesap taşınmış.";
      case "target_account_has_predictions": return "Bu yeni hesapta tahmin oluşturulduğu için eski verinin üstüne yazılmadı.";
      case "too_many_legacy_claim_attempts": return "Çok fazla hatalı deneme yapıldı. Bir saat sonra tekrar dene.";
      case "legacy_account_ambiguous": return "Eski kayıtlarda çakışma bulundu. Yönetici tarafından manuel kontrol gerekiyor.";
      default: return code || "Eski hesap taşınamadı.";
    }
  }

  async function claimLegacyAccount() {
    if (busy) return;
    const name = normName(document.getElementById("legacy-name")?.value);
    const pin = String(document.getElementById("legacy-pin")?.value || "").trim();
    if (!name) return renderMessage("Eski kullanıcı adını yaz.");
    if (!/^[0-9]{6}$/.test(pin)) return renderMessage("Eski PIN 6 rakam olmalı.");

    if (pendingOverwrite) {
      const ok = window.confirm(
        "Bu hesapta zaten girilmiş tahminler var. Eski hesabı taşırsan bu tahminlerin " +
        "üzerine yazılır ve geri alınamaz. Devam edilsin mi?"
      );
      if (!ok) return;
    }

    busy = true;
    const button = document.getElementById("legacy-claim-submit");
    if (button) { button.disabled = true; button.textContent = "Taşınıyor…"; }
    renderMessage("");

    try {
      const { data:{session}, error:sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user || session.user.id !== state()?.user?.id) throw new Error("Oturum doğrulanamadı. Tekrar giriş yap.");

      const pinHash = await legacyPinHash(name, pin);
      const { data, error } = await supabase.rpc("claim_legacy_account", { p_pin_hash:pinHash, p_overwrite:pendingOverwrite });
      if (error) throw error;
      if (!data?.ok) throw new Error(claimError(data?.code));

      const migratedKey = userKey("migrated");
      if (migratedKey) localStorage.setItem(migratedKey, "1");
      legacyScreenOpen = false;
      if (window.S) { window.S.legacyClaimOpen = false; window.S.msg = "Eski tahminlerin bu hesaba güvenli şekilde taşındı."; }
      await window.refresh?.();
    } catch (error) {
      console.error(error);
      renderMessage(claimError(error?.message));
    } finally {
      busy = false;
      const currentButton = document.getElementById("legacy-claim-submit");
      if (currentButton) { currentButton.disabled = false; currentButton.textContent = "Eski tahminleri taşı"; }
    }
  }

  function boot() {
    const app = document.getElementById("app");
    if (!app) return;
    const observer = new MutationObserver(() => queueMicrotask(injectOffer));
    observer.observe(app, { childList:true, subtree:false });
    injectOffer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once:true });
  } else {
    boot();
  }
}
