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

  function offerDismissed() {
    const key = userKey("offer_dismissed");
    return key ? localStorage.getItem(key) === "1" : false;
  }

  function alreadyMigrated() {
    const key = userKey("migrated");
    return key ? localStorage.getItem(key) === "1" : false;
  }

  function shouldOffer() {
    const s = state();
    return !!s?.user && !!s?.me && !legacyScreenOpen &&
      !offerDismissed() && !alreadyMigrated() && !hasVisiblePredictionData();
  }

  function injectOffer() {
    if (!shouldOffer()) return;
    const app = document.getElementById("app");
    if (!app || app.querySelector("#legacy-account-offer")) return;
    const nav = app.querySelector(".wrap > nav");
    if (!nav) return;

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
    });
  }

  function renderMessage(text) {
    const el = document.getElementById("legacy-claim-message");
    if (el) el.textContent = text || "";
  }

  function openClaimScreen() {
    const s = state();
    if (!s?.user || !s?.me) return;
    if (hasVisiblePredictionData()) {
      s.msg = "Eski hesabı taşıma işlemi yeni hesapta tahmin oluşturmadan önce yapılabilir.";
      window.render?.();
      return;
    }

    legacyScreenOpen = true;
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = `
      <div id="join"><div>
        <h1 class="big">Eski hesabını taşı</h1>
        <p class="lead">
          Önceki Tahmin Ligi sürümünde kullandığın kullanıcı adı ve 6 haneli PIN ile
          eski GS/FB tahminlerini bu hesaba aktar.
        </p>
        <label class="lbl" for="legacy-name">Eski kullanıcı adı</label>
        <input id="legacy-name" class="field" maxlength="40" autocomplete="off" placeholder="Eski takma adın">
        <label class="lbl" for="legacy-pin">Eski 6 haneli PIN</label>
        <input id="legacy-pin" class="field" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••">
        <button id="legacy-claim-submit" class="primary">Eski tahminleri taşı</button>
        <p id="legacy-claim-message" class="fine authmsg"></p>
        <p class="fine">
          Taşıma tek seferliktir. Yeni hesabında tahmin oluşturduysan mevcut verinin
          üstüne yazılmaz. Eski admin yetkisi güvenlik nedeniyle otomatik taşınmaz.
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

    busy = true;
    const button = document.getElementById("legacy-claim-submit");
    if (button) { button.disabled = true; button.textContent = "Taşınıyor…"; }
    renderMessage("");

    try {
      const { data:{session}, error:sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user || session.user.id !== state()?.user?.id) throw new Error("Oturum doğrulanamadı. Tekrar giriş yap.");

      const pinHash = await legacyPinHash(name, pin);
      const { data, error } = await supabase.rpc("claim_legacy_account", { p_pin_hash:pinHash });
      if (error) throw error;
      if (!data?.ok) throw new Error(claimError(data?.code));

      const migratedKey = userKey("migrated");
      if (migratedKey) localStorage.setItem(migratedKey, "1");
      legacyScreenOpen = false;
      if (window.S) window.S.msg = "Eski tahminlerin bu hesaba güvenli şekilde taşındı.";
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
