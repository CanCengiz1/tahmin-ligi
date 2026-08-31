import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { empty, standings, confirmedAt, revealedTeams } from "./scoring.js";

const TEAMS = {
  gs: {
    key:"gs", name:"Galatasaray", short:"GS",
    lock:"2026-09-09T19:00:00Z",
    theme:{bg:"#12100B",panel:"#1C1810",line:"#3A3120",accent:"#F5A800",text:"#F6EEDC",dim:"#9A8F76"},
    matches:[
      {d:"9 Eyl",  iso:"2026-09-09T19:00:00Z", opp:"Sporting CP",  home:false},
      {d:"13 Eki", iso:"2026-10-13T19:00:00Z", opp:"Barcelona",    home:true},
      {d:"21 Eki", iso:"2026-10-21T19:00:00Z", opp:"Lille",        home:false},
      {d:"3 Kas",  iso:"2026-11-03T19:00:00Z", opp:"Stuttgart",    home:true},
      {d:"24 Kas", iso:"2026-11-24T19:00:00Z", opp:"Aston Villa",  home:true},
      {d:"8 Ara",  iso:"2026-12-08T19:00:00Z", opp:"AEK",          home:false},
      {d:"19 Oca", iso:"2027-01-19T19:00:00Z", opp:"Feyenoord",    home:true},
      {d:"27 Oca", iso:"2027-01-27T19:00:00Z", opp:"PSG",          home:false}
    ]
  },
  fb: {
    key:"fb", name:"Fenerbahçe", short:"FB",
    lock:"2026-09-10T19:00:00Z",
    theme:{bg:"#080D18",panel:"#101828",line:"#20304C",accent:"#FFE500",text:"#E8EFFA",dim:"#7C8CA6"},
    matches:[
      {d:"10 Eyl", iso:"2026-09-10T19:00:00Z", opp:"Roma",              home:true},
      {d:"14 Eki", iso:"2026-10-14T19:00:00Z", opp:"Aston Villa",       home:false},
      {d:"20 Eki", iso:"2026-10-20T19:00:00Z", opp:"Slavia Praha",      home:true},
      {d:"4 Kas",  iso:"2026-11-04T19:00:00Z", opp:"Liverpool",         home:true},
      {d:"25 Kas", iso:"2026-11-25T19:00:00Z", opp:"Shakhtar Donetsk",  home:false},
      {d:"9 Ara",  iso:"2026-12-09T19:00:00Z", opp:"LASK",              home:false},
      {d:"20 Oca", iso:"2027-01-20T19:00:00Z", opp:"Villarreal",        home:true},
      {d:"27 Oca", iso:"2027-01-27T19:00:00Z", opp:"Atlético Madrid",   home:false}
    ]
  }
};

const NEUTRAL = {bg:"#0B0D10",panel:"#14181E",line:"#252C36",accent:"#C8D2E0",text:"#EDF1F6",dim:"#7D8794"};
const ART = '<svg class="shake" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="İki kişi el ele tutuşuyor"><defs><pattern id="gsp" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#A90432"/><rect width="8" height="18" fill="#F5A800"/></pattern><pattern id="fbp" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#12356E"/><rect width="8" height="18" fill="#FFE500"/></pattern></defs><circle cx="100" cy="46" r="21" fill="#E9D9BE" stroke="#0B0D10" stroke-width="3"/><path d="M 79,44 A 21,21 0 0 1 121,44 Z" fill="#2A2117"/><rect x="92" y="60" width="16" height="14" fill="#E9D9BE"/><path d="M 68,90 L 56,120" stroke="#E9D9BE" stroke-width="13" stroke-linecap="round" fill="none"/><path d="M 132,90 L 145,116" stroke="#E9D9BE" stroke-width="13" stroke-linecap="round" fill="none"/><rect x="74" y="124" width="52" height="28" rx="6" fill="#191E26"/><rect x="79" y="148" width="15" height="34" rx="7" fill="#E9D9BE"/><rect x="106" y="148" width="15" height="34" rx="7" fill="#E9D9BE"/><rect x="59" y="68" width="17" height="24" rx="8" fill="url(#gsp)" stroke="#0B0D10" stroke-width="3"/><rect x="124" y="68" width="17" height="24" rx="8" fill="url(#gsp)" stroke="#0B0D10" stroke-width="3"/><rect x="72" y="66" width="56" height="66" rx="12" fill="url(#gsp)" stroke="#0B0D10" stroke-width="3"/><circle cx="200" cy="46" r="21" fill="#E9D9BE" stroke="#0B0D10" stroke-width="3"/><path d="M 179,44 A 21,21 0 0 1 221,44 Z" fill="#2A2117"/><rect x="192" y="60" width="16" height="14" fill="#E9D9BE"/><path d="M 232,90 L 244,120" stroke="#E9D9BE" stroke-width="13" stroke-linecap="round" fill="none"/><path d="M 168,90 L 155,116" stroke="#E9D9BE" stroke-width="13" stroke-linecap="round" fill="none"/><rect x="174" y="124" width="52" height="28" rx="6" fill="#191E26"/><rect x="179" y="148" width="15" height="34" rx="7" fill="#E9D9BE"/><rect x="206" y="148" width="15" height="34" rx="7" fill="#E9D9BE"/><rect x="159" y="68" width="17" height="24" rx="8" fill="url(#fbp)" stroke="#0B0D10" stroke-width="3"/><rect x="224" y="68" width="17" height="24" rx="8" fill="url(#fbp)" stroke="#0B0D10" stroke-width="3"/><rect x="172" y="66" width="56" height="66" rx="12" fill="url(#fbp)" stroke="#0B0D10" stroke-width="3"/><circle cx="150" cy="115" r="12" fill="#F3EBDA" stroke="#0B0D10" stroke-width="3"/></svg>';
const PICKS = [{v:3,t:"Galibiyet"},{v:1,t:"Beraberlik"},{v:0,t:"Mağlubiyet"}];
const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>';

const configured = !!(window.CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const supabase = configured ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
}) : null;

const S = {
  view:"gs", user:null, me:null, admin:false, profile:null,
  players:[], results:{gs:empty(),fb:empty()}, scores:{gs:empty(),fb:empty()},
  open:null, editing:false, msg:"", loading:true, openMatch:null, ptDraft:{}, editRow:null, scope:"gs",
  authMode:"login", authBusy:false, authMsg:"", legacyClaimOpen:false
};

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normName = n => String(n || "").trim().replace(/\s+/g, " ");
function normalizePicks(value) {
  if (!Array.isArray(value) || value.length !== 8) return empty();
  return value.map(v => (v === 0 || v === 1 || v === 3) ? v : null);
}

async function pull() {
  if (!supabase || !S.user) return;
  const [profilesRes, predictionsRes, resultsRes] = await Promise.all([
    supabase.from("profiles").select("id,display_name"),
    supabase.from("team_predictions").select("user_id,team_key,picks,confirmed_at,updated_at"),
    supabase.from("team_results").select("team_key,points,scores")
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (predictionsRes.error) throw predictionsRes.error;
  if (resultsRes.error) throw resultsRes.error;

  const byId = new Map();
  for (const profile of profilesRes.data || []) {
    byId.set(profile.id, {
      id:profile.id,
      name:profile.display_name,
      gs:empty(), fb:empty(),
      conf:{gs:null,fb:null},
      updatedAt:0
    });
  }

  for (const row of predictionsRes.data || []) {
    const player = byId.get(row.user_id);
    if (!player || !["gs","fb"].includes(row.team_key)) continue;
    player[row.team_key] = normalizePicks(row.picks);
    player.conf[row.team_key] = row.confirmed_at ? new Date(row.confirmed_at).getTime() : null;
    player.updatedAt = Math.max(player.updatedAt || 0, row.updated_at ? new Date(row.updated_at).getTime() : 0);
  }

  S.players = Array.from(byId.values());
  S.me = byId.get(S.user.id) || null;
  S.results = {gs:empty(), fb:empty()};
  S.scores = {gs:empty(), fb:empty()};
  for (const row of resultsRes.data || []) {
    if (!["gs","fb"].includes(row.team_key)) continue;
    S.results[row.team_key] = normalizePicks(row.points);
    S.scores[row.team_key] = Array.isArray(row.scores) && row.scores.length === 8 ? row.scores : empty();
  }
}

async function savePrediction(team) {
  if (!supabase || !S.user || !S.me || !["gs","fb"].includes(team)) return false;
  try {
    const { error } = await supabase.from("team_predictions").upsert({
      user_id:S.user.id,
      team_key:team,
      picks:normalizePicks(S.me[team]),
      confirmed_at:S.me.conf?.[team] ? new Date(S.me.conf[team]).toISOString() : null,
      updated_at:new Date().toISOString()
    }, { onConflict:"user_id,team_key" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error(e);
    S.msg = /row-level security/i.test(String(e?.message || e))
      ? "Bu tahmin artık değiştirilemiyor. Tahmin süresi dolmuş olabilir."
      : (e.message || String(e));
    return false;
  }
}

async function saveResults(team) {
  if (!supabase || !S.user || !isAdmin()) return false;
  try {
    const { error } = await supabase.from("team_results").upsert({
      team_key:team,
      points:normalizePicks(S.results[team]),
      scores:Array.isArray(S.scores[team]) ? S.scores[team] : empty(),
      updated_by:S.user.id,
      updated_at:new Date().toISOString()
    }, { onConflict:"team_key" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error(e);
    S.msg = /row-level security|permission denied/i.test(String(e?.message || e))
      ? "Bu işlem için admin yetkisi gerekli."
      : (e.message || String(e));
    return false;
  }
}

async function loadIdentity(user) {
  S.user = user;
  const [{ data:profile, error:profileError }, { data:adminRow, error:adminError }] = await Promise.all([
    supabase.from("profiles").select("id,display_name").eq("id", user.id).single(),
    supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle()
  ]);
  if (profileError) throw profileError;
  if (adminError) throw adminError;
  S.profile = profile;
  S.admin = !!adminRow;
}

async function bootstrapSession(session) {
  if (!session?.user) {
    S.user = null; S.me = null; S.profile = null; S.admin = false;
    return;
  }
  await loadIdentity(session.user);
  await pull();
  if (!S.me) throw new Error("Kullanıcı profili yüklenemedi.");
}

let bootstrapPromise = null;
function ensureBootstrapped(session) {
  if (!session?.user) return Promise.resolve();
  if (S.user?.id === session.user.id && S.me) return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = bootstrapSession(session)
    .then(() => { S.authMsg = ""; })
    .catch(e => { S.authMsg = authErrorMessage(e); })
    .finally(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}

function authErrorMessage(error) {
  const m = String(error?.message || error || "Bir hata oluştu.");
  if (/invalid login credentials/i.test(m)) return "E-posta veya şifre yanlış.";
  if (/user already registered/i.test(m)) return "Bu e-posta ile zaten bir hesap var.";
  if (/password should be at least/i.test(m)) return "Şifre en az 6 karakter olmalı.";
  return m;
}

function setAuthMode(mode) {
  S.authMode = mode;
  S.authMsg = "";
  render();
}

async function signUp() {
  if (!supabase || S.authBusy) return;
  const name = normName(document.getElementById("displayName")?.value);
  const email = String(document.getElementById("email")?.value || "").trim();
  const password = String(document.getElementById("password")?.value || "");
  if (name.length < 2 || name.length > 40) { S.authMsg = "Kullanıcı adı 2–40 karakter olmalı."; render(); return; }
  if (!email) { S.authMsg = "E-posta adresini yaz."; render(); return; }
  if (password.length < 6) { S.authMsg = "Şifre en az 6 karakter olmalı."; render(); return; }

  S.authBusy = true; S.authMsg = ""; render();
  const { data, error } = await supabase.auth.signUp({ email, password, options:{ data:{ display_name:name } } });
  S.authBusy = false;
  if (error) { S.authMsg = authErrorMessage(error); render(); return; }
  if (data.session) {
    await ensureBootstrapped(data.session);
  } else {
    S.authMode = "login";
    S.authMsg = "Hesap oluşturuldu. E-postana gelen doğrulama bağlantısına tıkladıktan sonra giriş yap.";
  }
  render();
}

async function signIn() {
  if (!supabase || S.authBusy) return;
  const email = String(document.getElementById("email")?.value || "").trim();
  const password = String(document.getElementById("password")?.value || "");
  if (!email || !password) { S.authMsg = "E-posta ve şifre gerekli."; render(); return; }

  S.authBusy = true; S.authMsg = ""; render();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  S.authBusy = false;
  if (error) { S.authMsg = authErrorMessage(error); render(); return; }
  await ensureBootstrapped(data.session);
  render();
}

async function signInWithGoogle() {
  if (!supabase || S.authBusy) return;
  S.authBusy = true; S.authMsg = ""; render();
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo } });
  if (error) { S.authBusy = false; S.authMsg = authErrorMessage(error); render(); }
}

async function requestPasswordReset() {
  if (!supabase || S.authBusy) return;
  const email = String(document.getElementById("email")?.value || "").trim();
  if (!email) { S.authMsg = "E-posta adresini yaz."; render(); return; }
  S.authBusy = true; S.authMsg = ""; render();
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  S.authBusy = false;
  S.authMsg = error ? authErrorMessage(error) : "Şifre yenileme bağlantısı e-postana gönderildi.";
  render();
}

async function updatePassword() {
  if (!supabase || S.authBusy) return;
  const p1 = String(document.getElementById("password")?.value || "");
  const p2 = String(document.getElementById("password2")?.value || "");
  if (p1.length < 6) { S.authMsg = "Şifre en az 6 karakter olmalı."; render(); return; }
  if (p1 !== p2) { S.authMsg = "Şifreler eşleşmiyor."; render(); return; }
  S.authBusy = true; S.authMsg = ""; render();
  const { error } = await supabase.auth.updateUser({ password:p1 });
  S.authBusy = false;
  if (error) { S.authMsg = authErrorMessage(error); render(); return; }
  await supabase.auth.signOut();
  S.user = null; S.me = null; S.profile = null; S.admin = false;
  S.authMode = "login";
  S.authMsg = "Şifren güncellendi. Yeni şifrenle giriş yap.";
  render();
}

async function signOut() {
  if (supabase) await supabase.auth.signOut();
  S.user = null; S.me = null; S.profile = null; S.admin = false;
  S.view = "gs"; S.authMode = "login"; S.authMsg = ""; S.msg = ""; S.legacyClaimOpen = false;
  render();
}

const LOCK_LEAD = 60 * 60 * 1000;
const lockAt = k => new Date(TEAMS[k].lock).getTime() - LOCK_LEAD;
const locked = k => Date.now() >= lockAt(k);

async function pick(team, i, v) {
  if (!S.me || locked(team) || confirmedAt(S.me, team)) return;
  S.me[team] = (S.me[team] || empty()).slice();
  S.me[team][i] = S.me[team][i] === v ? null : v;
  S.me.updatedAt = Date.now();
  const idx = S.players.findIndex(p => p.id === S.me.id);
  if (idx >= 0) S.players[idx] = S.me;
  render();
  if (!(await savePrediction(team))) { S.msg = S.msg || "Tahmin kaydedilemedi."; render(); }
}

async function confirmTeam(team) {
  if (!S.me || locked(team)) return;
  if ((S.me[team] || empty()).filter(x => x !== null).length < 8) return;
  S.me.conf = Object.assign({gs:null, fb:null}, S.me.conf);
  S.me.conf[team] = Date.now();
  S.me.updatedAt = Date.now();
  render();
  if (!(await savePrediction(team))) { S.msg = S.msg || "Kaydedilemedi."; render(); }
}

async function editTeam(team) {
  if (!S.me || locked(team)) return;
  S.me.conf = Object.assign({gs:null, fb:null}, S.me.conf);
  S.me.conf[team] = null;
  S.me.updatedAt = Date.now();
  render();
  if (!(await savePrediction(team))) { S.msg = S.msg || "Kaydedilemedi."; render(); }
}

function isAdmin() { return !!S.user && S.admin; }

async function saveScore(team, i) {
  if (!isAdmin()) return;
  const g = id => parseInt(String(document.getElementById(id)?.value || "").trim(), 10);
  const f = g("sf_" + team + "_" + i), a = g("sa_" + team + "_" + i);
  if (!(f >= 0) || !(a >= 0)) { S.msg = "Skoru iki rakam olarak gir."; render(); return; }
  const key = team + ":" + i;
  const p = S.ptDraft[key] !== undefined && S.ptDraft[key] !== null ? S.ptDraft[key] : (f > a ? 3 : (f === a ? 1 : 0));
  delete S.ptDraft[key];
  if (S.editRow === key) S.editRow = null;
  S.results[team] = S.results[team].slice(); S.results[team][i] = p;
  S.scores[team] = S.scores[team].slice(); S.scores[team][i] = [f, a];
  S.msg = ""; render();
  if (!(await saveResults(team))) { S.msg = S.msg || "Sonuç kaydedilemedi."; render(); }
}

async function clearAllScores() {
  if (!isAdmin()) return;
  if (!confirm("Girilen bütün skorlar ve puanlar silinecek. Emin misin?")) return;
  S.results = {gs:empty(), fb:empty()}; S.scores = {gs:empty(), fb:empty()}; S.msg = ""; render();
  if (!(await Promise.all([saveResults("gs"), saveResults("fb")])).every(Boolean)) { S.msg = S.msg || "Silinemedi."; render(); }
}

async function clearAll() {
  if (!isAdmin()) return;
  if (!confirm("Girilen bütün skorlar ve puanlar silinecek. Emin misin?")) return;
  S.results = {gs:empty(), fb:empty()}; S.scores = {gs:empty(), fb:empty()}; S.ptDraft = {}; render();
  if (!(await Promise.all([saveResults("gs"), saveResults("fb")])).every(Boolean)) { S.msg = S.msg || "Sıfırlanamadı."; render(); }
}

async function clearScore(team, i) {
  if (!isAdmin()) return;
  S.results[team] = S.results[team].slice(); S.results[team][i] = null;
  S.scores[team] = S.scores[team].slice(); S.scores[team][i] = null;
  render();
  if (!(await saveResults(team))) { S.msg = S.msg || "Sonuç silinemedi."; render(); }
}

function setPt(team, i, v) { if (isAdmin()) { S.ptDraft[team + ":" + i] = v; render(); } }
function openRow(team, i) { if (isAdmin()) { S.editRow = team + ":" + i; render(); } }
function closeRow(team, i) { if (S.editRow === team + ":" + i) S.editRow = null; delete S.ptDraft[team + ":" + i]; render(); }
function setScope(v) { S.scope = v; S.open = null; render(); }
function peek(id) { S.openMatch = S.openMatch === id ? null : id; render(); if (S.openMatch) refresh(); }
function toggleEdit() { if (isAdmin()) { S.editing = !S.editing; S.msg = ""; render(); } }
async function refresh() { if (!S.user) return; try { await pull(); S.msg = ""; } catch (e) { S.msg = "Veri alınamadı — " + (e.message || e); } render(); }
function go(v) { S.view = v; S.open = null; render(); if (v === "board") refresh(); }

function theme() {
  const t = S.view === "board" ? NEUTRAL : TEAMS[S.view];
  const theme = t.theme || t;
  const r = document.documentElement.style;
  r.setProperty("--bg",theme.bg); r.setProperty("--panel",theme.panel); r.setProperty("--line",theme.line);
  r.setProperty("--accent",theme.accent); r.setProperty("--text",theme.text); r.setProperty("--dim",theme.dim);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.bg);
}

function countdownText(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff/86400000), h = Math.floor(diff%86400000/3600000), m = Math.floor(diff%3600000/60000), s = Math.floor(diff%60000/1000);
  const p = n => String(n).padStart(2,"0");
  return d + "g " + p(h) + ":" + p(m) + ":" + p(s);
}

function authScreen() {
  const msg = S.authMsg ? '<p class="fine authmsg">' + esc(S.authMsg) + '</p>' : '';
  if (!configured) return '<div id="join"><div>' + ART + '<h1 class="big">Tahmin Ligi</h1><p class="lead">Supabase ayarları bulunamadı.</p><div class="err">app/config.js dosyasını oluşturup Supabase URL ve publishable key değerlerini gir.</div></div></div>';

  if (S.authMode === "register") {
    return '<div id="join"><div>' + ART + '<h1 class="big">Hesap oluştur</h1><p class="lead">Tahminlerin artık gerçek bir kullanıcı hesabına bağlı tutulur.</p>' +
      '<button class="google-btn" ' + (S.authBusy ? 'disabled' : '') + ' onclick="signInWithGoogle()">' + GOOGLE_ICON + '<span>Google ile devam et</span></button>' +
      '<div class="divider">veya</div>' +
      '<label class="lbl">Kullanıcı adı</label><input id="displayName" class="field" maxlength="40" autocomplete="nickname" placeholder="Arkadaşların seni nasıl tanıyor?">' +
      '<label class="lbl">E-posta</label><input id="email" class="field" type="email" autocomplete="email" placeholder="sen@ornek.com">' +
      '<label class="lbl">Şifre</label><input id="password" class="field" type="password" minlength="6" autocomplete="new-password" placeholder="En az 6 karakter">' +
      '<button class="primary" ' + (S.authBusy ? 'disabled' : '') + ' onclick="signUp()">' + (S.authBusy ? 'Oluşturuluyor…' : 'Hesap oluştur') + '</button>' + msg +
      '<button class="back" onclick="setAuthMode(\'login\')">Zaten hesabın var mı? Giriş yap</button></div></div>';
  }

  if (S.authMode === "forgot") {
    return '<div id="join"><div>' + ART + '<h1 class="big">Şifremi unuttum</h1><p class="lead">E-postana güvenli bir şifre yenileme bağlantısı gönderelim.</p>' +
      '<label class="lbl">E-posta</label><input id="email" class="field" type="email" autocomplete="email" placeholder="sen@ornek.com">' +
      '<button class="primary" ' + (S.authBusy ? 'disabled' : '') + ' onclick="requestPasswordReset()">Bağlantı gönder</button>' + msg +
      '<button class="back" onclick="setAuthMode(\'login\')">← Girişe dön</button></div></div>';
  }

  if (S.authMode === "reset") {
    return '<div id="join"><div>' + ART + '<h1 class="big">Yeni şifre</h1><p class="lead">Hesabın için yeni bir şifre belirle.</p>' +
      '<label class="lbl">Yeni şifre</label><input id="password" class="field" type="password" minlength="6" autocomplete="new-password">' +
      '<label class="lbl">Tekrar</label><input id="password2" class="field" type="password" minlength="6" autocomplete="new-password">' +
      '<button class="primary" ' + (S.authBusy ? 'disabled' : '') + ' onclick="updatePassword()">Şifreyi güncelle</button>' + msg + '</div></div>';
  }

  return '<div id="join"><div>' + ART + '<h1 class="big">Tahmin Ligi</h1>' +
    '<p class="lead">Galatasaray ve Fenerbahçe\'nin 8\'er Şampiyonlar Ligi maçını tahmin et. Hesabına her cihazdan güvenli şekilde dön.</p>' +
    '<button class="google-btn" ' + (S.authBusy ? 'disabled' : '') + ' onclick="signInWithGoogle()">' + GOOGLE_ICON + '<span>Google ile devam et</span></button>' +
    '<div class="divider">veya</div>' +
    '<label class="lbl">E-posta</label><input id="email" class="field" type="email" autocomplete="email" placeholder="sen@ornek.com">' +
    '<label class="lbl">Şifre</label><input id="password" class="field" type="password" autocomplete="current-password" placeholder="Şifren">' +
    '<button class="primary" ' + (S.authBusy ? 'disabled' : '') + ' onclick="signIn()">' + (S.authBusy ? 'Giriş yapılıyor…' : 'Giriş yap') + '</button>' + msg +
    '<button class="back" onclick="setAuthMode(\'register\')">Yeni misin? Hesap oluştur</button>' +
    '<button class="back subtle" onclick="setAuthMode(\'forgot\')">Şifremi unuttum</button></div></div>';
}

function nameScreen() {
  const msg = S.authMsg ? '<p class="fine authmsg">' + esc(S.authMsg) + '</p>' : '';
  return '<div id="join"><div>' + ART + '<h1 class="big">Kullanıcı adını seç</h1>' +
    '<p class="lead">Google hesabından görünen bir ad alamadık. Sıralamada görüneceği için bir kullanıcı adı belirle.</p>' +
    '<label class="lbl">Kullanıcı adı</label><input id="displayName2" class="field" maxlength="40" autocomplete="nickname" placeholder="Arkadaşların seni nasıl tanıyor?">' +
    '<button class="primary" ' + (S.authBusy ? 'disabled' : '') + ' onclick="saveDisplayName()">' + (S.authBusy ? 'Kaydediliyor…' : 'Devam et') + '</button>' + msg +
    '<button class="back" onclick="signOut()">Çıkış yap</button></div></div>';
}

async function saveDisplayName() {
  if (!supabase || !S.user || !S.me || S.authBusy) return;
  const name = normName(document.getElementById("displayName2")?.value);
  if (name.length < 2 || name.length > 40) { S.authMsg = "Kullanıcı adı 2–40 karakter olmalı."; render(); return; }

  S.authBusy = true; S.authMsg = ""; render();
  const { error } = await supabase.from("profiles").update({ display_name:name }).eq("id", S.user.id);
  S.authBusy = false;
  if (error) {
    S.authMsg = /duplicate key|unique/i.test(String(error.message || "")) ? "Bu kullanıcı adı zaten alınmış." : (error.message || String(error));
    render();
    return;
  }
  S.profile = Object.assign({}, S.profile, { display_name:name });
  S.me.name = name;
  const idx = S.players.findIndex(p => p.id === S.me.id);
  if (idx >= 0) S.players[idx] = S.me;
  S.authMsg = "";
  render();
}

function teamView(k) {
  const T = TEAMS[k], picks = S.me[k] || empty();
  const hardLock = locked(k), conf = confirmedAt(S.me, k), lk = hardLock || !!conf;
  const predicted = picks.reduce((a,b)=>a+(b||0),0);
  const filled = picks.filter(p=>p!==null).length;
  const res = S.results[k];
  const earned = res.reduce((a,b)=>a+(b||0),0);
  const played = res.filter(x=>x!==null).length;
  let html = '<div class="strip">' + (hardLock ? '<span>Tahminler kilitlendi — ' + T.matches[0].d + ' maçından 1 saat önce</span>' : '<span>' + (conf ? 'Kaydedildi · kilide kalan' : 'Kilide kalan') + '</span><b id="cd">' + (countdownText(lockAt(k))||"") + '</b>') + '</div><div class="pad">';

  T.matches.forEach((m,i) => {
    const mine = picks[i], actual = res[i];
    const hit = actual !== null && mine !== null && actual === mine;
    const miss = actual !== null && mine !== null && actual !== mine;
    html += '<div class="card"><div class="top"><div><div class="opp">' + esc(m.opp) + '</div><div class="meta">' + m.d + ' · ' + (m.home ? "İç saha" : "Deplasman") + '</div></div>' + (actual !== null ? '<span class="chip' + (hit ? ' hit' : '') + '">' + (hit ? "Tuttu" : miss ? "Kaçtı" : "Sonuç " + actual) + '</span>' : '') + '</div><div class="picks">';
    PICKS.forEach(p => {
      const sel = mine === p.v;
      html += '<button class="' + (sel?'sel':'') + '"' + (lk?' disabled':'') + ' onclick="pick(\'' + k + '\',' + i + ',' + p.v + ')"><span class="v">' + p.v + '</span><span class="t">' + p.t + '</span></button>';
    });
    html += '</div>';
    const pid = k + ':' + i, open = S.openMatch === pid;
    if (hardLock) {
      const votes = S.players.map(p => ({name:p.name, v:(p[k] || empty())[i]})).sort((x,y) => (y.v === null ? -1 : y.v) - (x.v === null ? -1 : x.v) || x.name.localeCompare(y.name,"tr"));
      const cnt = v => votes.filter(x => x.v === v).length;
      html += '<button class="peek" onclick="peek(\'' + pid + '\')"><span>Herkesin tahmini</span><span>3: ' + cnt(3) + ' · 1: ' + cnt(1) + ' · 0: ' + cnt(0) + (open ? ' ▴' : ' ▾') + '</span></button>';
      if (open) {
        html += '<div class="peekbody">';
        if (!votes.length) html += '<div class="dist">Kimse tahmin girmemiş.</div>';
        votes.forEach(x => { const right = actual !== null && x.v !== null && x.v === actual; html += '<div class="prow"><span class="pn">' + esc(x.name) + '</span><span class="pv' + (right ? ' on' : '') + '">' + (x.v === null ? '·' : x.v) + '</span></div>'; });
        html += '</div>';
      }
    } else html += '<div class="peek"><span>Herkesin tahmini</span><span>kilitten sonra açılır</span></div>';
    html += '</div>';
  });

  html += '</div><div class="bar"><div class="in"><div><div class="k">' + T.short + ' tahmin toplamın</div><div class="s">' + filled + '/8 maç işaretlendi' + (played ? ' · gerçekleşen ' + earned + ' puan (' + played + ' maç)' : '') + '</div></div><div class="tot">' + predicted + '</div></div><div class="act">' + (hardLock ? '<div class="shut">Tahminler kesinleşti, değiştirilemez.</div>' : conf ? '<button class="edit" onclick="editTeam(\'' + k + '\')">Düzenle</button>' : '<button class="save"' + (filled < 8 ? ' disabled' : '') + ' onclick="confirmTeam(\'' + k + '\')">' + (filled < 8 ? '8 maçın hepsini işaretle' : 'Kaydet ve kilitle') + '</button>') + '</div></div>';
  return html;
}

function boardView() {
  const st = standings(S.players, S.results, S.scope, {revealed:locked(S.scope)});
  let html = '<div class="pad"><div class="scope">';
  [["gs","Galatasaray"],["fb","Fenerbahçe"]].forEach(o => { html += '<button class="' + (S.scope === o[0] ? 'on' : '') + '" onclick="setScope(\'' + o[0] + '\')">' + o[1] + '</button>'; });
  html += '</div><div class="hero"><div><div class="k lbl" style="margin:0">' + TEAMS[st.scope].name + ' kaç puan topladı</div><div class="meta" style="margin-top:6px">' + st.played + '/' + st.total + ' maç girildi' + (st.finished ? ' · tamamlandı' : '') + '</div></div><div class="tot">' + st.at + '</div></div>';
  html += '<div class="rowhead"><h2 class="sec">Sıralama</h2><button class="ghost" onclick="refresh()">Yenile</button></div><p class="meta" style="margin:-4px 0 14px">' + (st.played ? (st.finished ? 'Toplam puanı tam tutturan kazanır. Tutturan yoksa en çok yaklaşan kazanmış sayılır.' : 'Sezon devam ederken daha çok maçı doğru bilen üstte. Kesin sonuç 8 maç bitince toplam puan farkına göre belli olur.') : 'Maçlar oynandıkça sıralama burada oluşacak.') + '</p>';

  if (!st.rows.length) html += '<p class="meta" style="margin-bottom:32px">Henüz kimse katılmadı.</p>';
  else {
    st.rows.forEach((p,i) => {
      const mine = S.me && p.id === S.me.id, open = S.open === p.id;
      html += '<div class="rank' + (mine?' me':'') + '"><button class="head" onclick="S.open=' + (open?'null':"'"+p.id+"'") + ';render()"><span class="pos' + (i===0 && st.played ? ' first':'') + '">' + (st.played ? i+1 : '·') + '</span><span class="who"><b>' + esc(p.name) + (mine?' (sen)':'') + '</b><small>' + (st.revealed ? 'puan tahmini ' + p.total + (st.played ? ' · ' + p.hits + '/' + st.played + ' maç doğru' : '') : 'tahminler kilitten sonra açılır') + '</small></span><span class="score">' + (st.played ? '<b>' + (st.finished ? Math.abs(p.total-st.at) : p.hits) + '</b><small>' + (st.finished ? 'fark' : 'doğru') + '</small>' : '') + '</span></button>';
      if (open) {
        html += '<div class="detail">';
        const shown = revealedTeams(mine, locked);
        ["gs","fb"].forEach(k => {
          html += '<div style="padding-top:12px"><div class="lbl">' + TEAMS[k].short + '</div>';
          if (shown.includes(k)) {
            html += '<div class="strip8">';
            (p[k] || empty()).forEach((v,j) => { const a = S.results[k][j], hit = a !== null && v !== null && a === v; html += '<div style="' + (hit ? 'background:' + TEAMS[k].theme.accent + ';color:#0B0D10;border-color:' + TEAMS[k].theme.accent : (v===null?'color:var(--dim)':'')) + '">' + (v===null?'·':v) + '</div>'; });
            html += '</div>';
          } else html += '<p class="meta" style="margin:2px 0 0">Tahminler kilitten sonra açılır.</p>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '<div style="height:20px"></div>';
  }

  const admin = isAdmin();
  if (st.played) {
    const byHits = st.rows.slice().sort((a,b) => b.hits - a.hits || Math.abs(a.total-st.at) - Math.abs(b.total-st.at));
    html += '<div class="rowhead" style="margin-top:26px"><h2 class="sec">En çok maç bilen</h2></div><p class="meta" style="margin:-4px 0 12px">Yan sıralama. Kazananı belirlemez, maçları en iyi okuyanı gösterir.</p>';
    byHits.forEach((p,i) => { const mine = S.me && p.id === S.me.id; html += '<div class="hrow' + (mine ? ' me' : '') + '"><span class="pos' + (i===0 ? ' first' : '') + '">' + (i+1) + '</span><span class="hn">' + esc(p.name) + (mine ? ' (sen)' : '') + '</span><span class="hv">' + p.hits + '<small>/' + st.played + '</small></span></div>'; });
    html += '<div style="height:12px"></div>';
  }

  html += '<div class="rowhead"><h2 class="sec">Maç sonuçları</h2>' + (admin ? '<button class="ghost" onclick="toggleEdit()">' + (S.editing ? 'Girişi kapat' : 'Sonuç gir') + '</button>' : '') + '</div>' + (admin && S.editing ? '<button class="wipe" onclick="clearAllScores()">Bütün skorları sil</button>' : '') + '<p class="meta" style="margin:0 0 16px">' + (admin ? 'Maçın yanındaki Gir düğmesine bas, skoru yaz. Puan otomatik hesaplanır.' : 'Skorları yalnızca yarışma yöneticisi giriyor.') + '</p>';

  ["gs","fb"].forEach(k => {
    html += '<div style="margin-bottom:20px"><div class="lbl" style="color:' + TEAMS[k].theme.accent + '">' + TEAMS[k].name + '</div>';
    TEAMS[k].matches.forEach((m,i) => {
      const done = Date.now() >= new Date(m.iso).getTime(), v = S.results[k][i], sc = (S.scores[k] || empty())[i], dk = k + ':' + i, editing = admin && S.editing && S.editRow === dk;
      html += '<div class="res' + (editing ? ' col' : '') + '"><div class="n"><div>' + esc(m.opp) + '</div><div>' + m.d + ' · ' + (m.home?'İç saha':'Deplasman') + '</div></div>';
      if (editing) {
        html += '<div class="sc"><input id="sf_' + k + '_' + i + '" inputmode="numeric" maxlength="2" placeholder="' + TEAMS[k].short + '" value="' + (sc ? sc[0] : '') + '"><span>-</span><input id="sa_' + k + '_' + i + '" inputmode="numeric" maxlength="2" placeholder="Rk" value="' + (sc ? sc[1] : '') + '"></div>';
        const cur = S.ptDraft[dk] !== undefined && S.ptDraft[dk] !== null ? S.ptDraft[dk] : v;
        html += '<div class="pts">';
        PICKS.forEach(pp => { const on = cur === pp.v; html += '<button onclick="setPt(\'' + k + '\',' + i + ',' + pp.v + ')" style="' + (on ? 'background:' + TEAMS[k].theme.accent + ';color:#0B0D10;border-color:' + TEAMS[k].theme.accent : '') + '">' + pp.v + '</button>'; });
        html += '<button class="ok" onclick="saveScore(\'' + k + '\',' + i + ')">Kaydet</button><button class="cancel" onclick="closeRow(\'' + k + '\',' + i + ')">Vazgeç</button></div>';
      } else {
        html += '<div class="done">' + (sc ? '<span class="skor">' + sc[0] + '-' + sc[1] + '</span>' : '') + '<span class="val" style="' + (v===null?'color:var(--dim)':'') + '">' + (v===null ? (done?'—':'·') : v) + '</span>' + (admin && S.editing ? (v === null ? '<button class="mini" onclick="openRow(\'' + k + '\',' + i + ')">Gir</button>' : '<button class="mini" onclick="openRow(\'' + k + '\',' + i + ')">Düzenle</button><button class="mini del" onclick="clearScore(\'' + k + '\',' + i + ')">Sil</button>') : '') + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  if (admin && S.editing) html += '<button class="wipe" onclick="clearAll()">Tüm sonuçları sıfırla</button>';
  html += '<div class="info"><b>Kazanan nasıl belirlenir</b>Her takım için ayrı yarışma var. Asıl iş, o takımın 8 maçta toplayacağı puanı bilmek:<br><br>1. Toplamı tam tutturan kazanır. Tutturan yoksa en çok yaklaşan kazanmış sayılır.<br>2. Aynı farka sahip olanlar arasında, maç bazında daha çok doğru bilen öne geçer.<br>3. O da eşitse, tahminini önce kesinleştiren üstte.<br><br>“En çok maç bilen” listesi ayrı bir göstergedir.</div></div>';
  return html;
}

function render() {
  theme();
  if (S.legacyClaimOpen) return;
  const app = document.getElementById("app");
  if (S.loading) { app.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;color:var(--dim)">Yükleniyor…</div>'; return; }
  if (S.authMode === "reset" || !S.user || !S.me) { app.innerHTML = authScreen(); return; }
  if (!S.me.name) { app.innerHTML = nameScreen(); return; }

  const tabs = [["gs","Galatasaray","#F5A800"],["fb","Fenerbahçe","#FFE500"],["board","Sıralama","#C8D2E0"]];
  let html = '<div class="wrap"><header><h1>Tahmin Ligi</h1><button class="out" onclick="signOut()">' + esc(S.me.name) + (S.admin ? ' · Admin' : '') + ' · Çıkış</button></header><nav>';
  tabs.forEach(t => { const on = S.view === t[0]; html += '<button class="' + (on?'on':'') + '" style="color:' + (on?t[2]:'var(--dim)') + ';border-bottom-color:' + (on?t[2]:'transparent') + '" onclick="go(\'' + t[0] + '\')">' + t[1] + '</button>'; });
  html += '</nav>';
  if (S.msg) html += '<div class="err">' + esc(S.msg) + '</div>';
  html += S.view === "board" ? boardView() : teamView(S.view);
  html += '</div>';
  app.innerHTML = html;
}

Object.assign(window, {
  S, render, go, setAuthMode, signUp, signIn, signInWithGoogle, requestPasswordReset, updatePassword, signOut,
  saveDisplayName,
  pick, confirmTeam, editTeam, saveScore, clearAllScores, clearAll, clearScore, setPt,
  openRow, closeRow, setScope, peek, toggleEdit, refresh
});

if (supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      S.user = session?.user || null;
      S.authMode = "reset";
      S.loading = false;
      render();
      return;
    }
    if (event === "SIGNED_OUT") {
      S.user = null; S.me = null; S.profile = null; S.admin = false; S.loading = false; S.legacyClaimOpen = false; render();
      return;
    }
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      await ensureBootstrapped(session);
      S.loading = false;
      render();
    }
  });
}

function oauthRedirectError() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("error") || url.hash.match(/error=([^&]+)/)?.[1];
  if (!code) return null;
  const desc = url.searchParams.get("error_description") || url.hash.match(/error_description=([^&]+)/)?.[1];
  ["error", "error_description", "error_code"].forEach(k => url.searchParams.delete(k));
  window.history.replaceState({}, "", url.pathname + url.search);
  return decodeURIComponent((desc || code).replace(/\+/g, " "));
}

(async function init(){
  const redirectError = oauthRedirectError();
  if (redirectError) S.authMsg = "Google ile giriş tamamlanamadı: " + redirectError;
  render();
  if (!supabase) { S.loading = false; render(); return; }
  try {
    const { data:{session}, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (session) await ensureBootstrapped(session);
  } catch (e) {
    S.authMsg = authErrorMessage(e);
  }
  S.loading = false;
  render();

  setInterval(() => {
    const el = document.getElementById("cd");
    if (el && S.view !== "board") {
      const txt = countdownText(lockAt(S.view));
      if (txt) el.textContent = txt; else render();
    }
  }, 1000);

  setInterval(() => { if (S.user && S.view === "board" && !S.editing) refresh(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.user) refresh(); });
})();
