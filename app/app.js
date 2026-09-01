import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { empty, standings, confirmedAt, revealedTeams, MATCH_COUNT, scoreMatchPrediction, compareScorePredictionRows } from "./scoring.js";

// Son çare listesi: teams/fixtures sorgusu başarısız olursa (ağ, RLS, boş
// sezon) uygulama boş ekran yerine bununla açılır. loadTeamsFromDB()
// çözülene kadar da ilk boyama bununla yapılır, böylece kullanıcı hiçbir
// zaman yüklenmeyi beklemez. Rakip takımların rengi/forması burada yok —
// bu durumda teamLogo() "?" rozetine düşer, bu beklenen bir davranış.
const FALLBACK_TEAMS = {
  gs: {
    key:"gs", name:"Galatasaray", tla:"GS", crest:null, colors:["#A90432","#F5A800"],
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
    key:"fb", name:"Fenerbahçe", tla:"FB", crest:null, colors:["#12356E","#FFE500"],
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

// Tek ligli davranış korunuyor: takip edilen tek iki takım hâlâ bunlar.
// team_predictions/team_results hâlâ bu iki anahtarla (gs/fb) çalışıyor.
const TRACKED_SLUGS = { galatasaray:"gs", fenerbahce:"fb" };
const TEAM_THEME = {
  gs:{bg:"#12100B",panel:"#1C1810",line:"#3A3120",text:"#F6EEDC",dim:"#9A8F76"},
  fb:{bg:"#080D18",panel:"#101828",line:"#20304C",text:"#E8EFFA",dim:"#7C8CA6"}
};
const TR_MONTHS_SHORT = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const fmtMatchDay = iso => { const d = new Date(iso); return d.getUTCDate() + " " + TR_MONTHS_SHORT[d.getUTCMonth()]; };

function dbTeamToLogoTeam(row) {
  if (!row) return null;
  return {
    name: row.name,
    tla: row.short_name,
    crest: row.crest_url || null,
    colors: row.primary_color && row.secondary_color ? [row.primary_color, row.secondary_color] : null
  };
}

// Fikstür verisi nadiren değiştiği için bir kez çekilip bellekte tutulur;
// sonraki çağrılar aynı promise'i paylaşır, tekrar sorgu atılmaz.
let teamsLoadPromise = null;
function ensureTeamsLoaded() {
  if (!supabase) return Promise.resolve();
  if (!teamsLoadPromise) {
    teamsLoadPromise = loadTeamsFromDB()
      .then(loaded => { TEAMS = loaded; render(); })
      .catch(e => { console.error("Takım/fikstür verisi DB'den alınamadı, sabit listeyle devam ediliyor.", e); });
  }
  return teamsLoadPromise;
}

async function loadTeamsFromDB() {
  const { data:season, error:seasonError } = await supabase
    .from("competition_seasons")
    .select("id, competitions!inner(slug)")
    .eq("competitions.slug", "ucl")
    .in("status", ["upcoming", "active"])
    .order("starts_at", { ascending:false })
    .limit(1)
    .maybeSingle();
  if (seasonError) throw seasonError;
  if (!season) throw new Error("Aktif UCL sezonu bulunamadı.");

  const teamCols = "slug,name,short_name,crest_url,primary_color,secondary_color";
  const [{ data:teamRows, error:teamsError }, { data:fixtureRows, error:fixturesError }] = await Promise.all([
    supabase.from("teams").select(teamCols).in("slug", Object.keys(TRACKED_SLUGS)),
    supabase.from("fixtures")
      .select("id,kickoff_at,home_goals,away_goals,home:home_team_id(" + teamCols + "),away:away_team_id(" + teamCols + ")")
      .eq("competition_season_id", season.id)
      .order("kickoff_at", { ascending:true })
  ]);
  if (teamsError) throw teamsError;
  if (fixturesError) throw fixturesError;

  const teamBySlug = new Map((teamRows || []).map(r => [r.slug, r]));
  const byKey = { gs:[], fb:[] };
  (fixtureRows || []).forEach(row => {
    const homeKey = TRACKED_SLUGS[row.home?.slug], awayKey = TRACKED_SLUGS[row.away?.slug];
    // id/homeGoals/awayGoals maçın gerçek ev/deplasman skorudur, takip edilen
    // takıma göre değil — score_predictions.home_score/away_score ve
    // scoreMatchPrediction ile aynı anlamda kullanılıyor.
    if (homeKey) byKey[homeKey].push({ id:row.id, d:fmtMatchDay(row.kickoff_at), iso:row.kickoff_at, opp:row.away?.name || "?", home:true, oppTeam:dbTeamToLogoTeam(row.away), homeGoals:row.home_goals, awayGoals:row.away_goals });
    if (awayKey) byKey[awayKey].push({ id:row.id, d:fmtMatchDay(row.kickoff_at), iso:row.kickoff_at, opp:row.home?.name || "?", home:false, oppTeam:dbTeamToLogoTeam(row.home), homeGoals:row.home_goals, awayGoals:row.away_goals });
  });

  const built = {};
  for (const [slug, key] of Object.entries(TRACKED_SLUGS)) {
    const team = teamBySlug.get(slug);
    const matches = byKey[key].sort((a, b) => new Date(a.iso) - new Date(b.iso));
    if (!team || matches.length !== MATCH_COUNT) throw new Error("Eksik fikstür verisi: " + slug);
    const colors = team.primary_color && team.secondary_color ? [team.primary_color, team.secondary_color] : null;
    built[key] = {
      key, name:team.name, tla:team.short_name, crest:team.crest_url || null, colors,
      lock:matches[0].iso,
      theme:Object.assign({ accent: colors ? colors[1] : NEUTRAL.accent }, TEAM_THEME[key]),
      matches
    };
  }
  return built;
}

// DB'den yüklenene kadar (ve yükleme başarısız olursa) sabit listeyle çalışılır.
let TEAMS = FALLBACK_TEAMS;

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
  open:null, editing:false, msg:"", loading:true, openMatch:null, ptDraft:{}, scoreDraft:{}, editRow:null, scope:"gs",
  authMode:"login", authBusy:false, authMsg:"", legacyClaimOpen:false,
  accountMenuOpen:false, signOutBusy:false,
  predMode:"outcome", scorePreds:new Map()
};

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normName = n => String(n || "").trim().replace(/\s+/g, " ");
function normalizePicks(value) {
  if (!Array.isArray(value) || value.length !== 8) return empty();
  return value.map(v => (v === 0 || v === 1 || v === 3) ? v : null);
}

// teamLogo(team, size) — tek giriş noktası. team null/eksikse ya da renkleri
// bilinmiyorsa "?" rozetine düşer; bu, rakip takımlar için crest verisi
// tutulmadığı sürece beklenen sonuçtur.
const LOGO_SIZES = { sm:26, md:38, lg:48 };

function relLuminance(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return 0;
  const lin = v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const [r, g, b] = [0, 2, 4].map(i => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Sabit bir renk yerine hesaplanır: iki rengin ortalama parlaklığına göre
// beyaz ya da koyu metin seçilir, böylece keyfi renk çiftlerinde de okunur.
function contrastTextColor(colors) {
  const avg = colors.reduce((sum, hex) => sum + relLuminance(hex), 0) / colors.length;
  return avg > 0.45 ? "#0B0D10" : "#FFFFFF";
}

function teamMonogram(tla, colors, px) {
  const style = "width:" + px + "px;height:" + px + "px;font-size:" + Math.round(px * 0.36) + "px";
  if (!colors) return '<span class="tlogo tlogo-unknown" style="' + style + '">?</span>';
  const label = esc(String(tla || "?").slice(0, 4).toUpperCase());
  const [c1, c2] = colors;
  const ink = contrastTextColor(colors);
  return '<span class="tlogo" style="' + style + ';background:linear-gradient(135deg,' + esc(c1) + ' 50%,' + esc(c2) + ' 50%);color:' + ink + '">' + label + '</span>';
}

// <img> yüklenemezse (kırık resim ikonu asla görünmemeli) veriyi data-* ile
// taşıyıp aynı boyutta monograma sessizce düşer.
function teamLogoFallback(img) {
  const host = img.closest(".tlogo");
  if (!host) return;
  const px = parseInt(img.dataset.px, 10) || LOGO_SIZES.md;
  const tla = img.dataset.tla || "";
  const colors = img.dataset.c1 && img.dataset.c2 ? [img.dataset.c1, img.dataset.c2] : null;
  host.outerHTML = teamMonogram(tla, colors, px);
}

function teamLogo(team, size) {
  const px = LOGO_SIZES[size] || LOGO_SIZES.md;
  const tla = team && team.tla ? String(team.tla).slice(0, 4) : "";
  const colors = team && Array.isArray(team.colors) && team.colors.length === 2 ? team.colors : null;
  if (team && team.crest) {
    return '<span class="tlogo tlogo-crest" style="width:' + px + 'px;height:' + px + 'px">' +
      '<img src="' + esc(team.crest) + '" alt="' + esc(tla || team.name || "Takım") + '" loading="lazy" ' +
      'data-tla="' + esc(tla) + '" data-c1="' + esc(colors ? colors[0] : "") + '" data-c2="' + esc(colors ? colors[1] : "") + '" data-px="' + px + '" ' +
      'onerror="teamLogoFallback(this)"></span>';
  }
  return teamMonogram(tla, colors, px);
}

async function pull() {
  if (!supabase || !S.user) return;
  const [profilesRes, predictionsRes, resultsRes, scoreRes] = await Promise.all([
    supabase.from("profiles").select("id,display_name"),
    supabase.from("team_predictions").select("user_id,team_key,picks,confirmed_at,updated_at"),
    supabase.from("team_results").select("team_key,points,scores"),
    supabase.from("score_predictions").select("user_id,fixture_id,home_score,away_score")
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (predictionsRes.error) throw predictionsRes.error;
  if (resultsRes.error) throw resultsRes.error;
  if (scoreRes.error) throw scoreRes.error;

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

  S.scorePreds = new Map();
  for (const row of scoreRes.data || []) {
    if (!S.scorePreds.has(row.fixture_id)) S.scorePreds.set(row.fixture_id, new Map());
    S.scorePreds.get(row.fixture_id).set(row.user_id, { home:row.home_score, away:row.away_score });
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

async function saveScorePrediction(fixtureId, home, away) {
  if (!supabase || !S.user) return false;
  try {
    const { error } = await supabase.from("score_predictions").upsert({
      user_id:S.user.id,
      fixture_id:fixtureId,
      home_score:home,
      away_score:away,
      updated_at:new Date().toISOString()
    }, { onConflict:"user_id,fixture_id" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error(e);
    S.msg = /row-level security/i.test(String(e?.message || e))
      ? "Bu skor tahmini artık değiştirilemiyor. Maç başlamış olabilir."
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

// Gerçek skorların tek kaynağı fixtures.home_goals/away_goals — skor tahmini
// sıralaması buradan okuyor (bkz. scoreStandingsRows). team_results.scores
// hâlâ yazılıyor, ana sıralama ve "Maç sonuçları" listesi onu kullanmaya
// devam ediyor; ikisi arasında admin panelinde tek girişten türetiliyor.
async function saveFixtureResult(fixtureId, homeGoals, awayGoals) {
  if (!fixtureId) return true; // fikstür DB'den henüz yüklenmediyse (id yok) sessizce atlanır
  if (!supabase || !S.user || !isAdmin()) return false;
  try {
    const { error } = await supabase.from("fixtures").update({
      home_goals:homeGoals,
      away_goals:awayGoals,
      updated_at:new Date().toISOString()
    }).eq("id", fixtureId);
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
  if (!supabase || S.signOutBusy) return;
  S.signOutBusy = true; render();
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    S.accountMenuOpen = false;
    S.user = null; S.me = null; S.profile = null; S.admin = false;
    S.view = "gs"; S.authMode = "login"; S.authMsg = ""; S.msg = ""; S.legacyClaimOpen = false;
  } catch (e) {
    console.error(e);
    S.msg = "Çıkış yapılamadı — " + (e.message || e);
  } finally {
    S.signOutBusy = false;
    render();
  }
}

function toggleAccountMenu() {
  S.accountMenuOpen = !S.accountMenuOpen;
  render();
  if (S.accountMenuOpen) focusAccountMenu(); else focusAccountTrigger();
}

function closeAccountMenu() {
  if (!S.accountMenuOpen) return;
  S.accountMenuOpen = false;
  render();
  focusAccountTrigger();
}

function focusAccountTrigger() { document.getElementById("acctBtn")?.focus(); }
function focusAccountMenu() {
  const panel = document.getElementById("acctMenuPanel");
  if (!panel) return;
  const first = panel.querySelector('[role="menuitem"]:not([disabled])');
  (first || panel).focus();
}

function openLegacyClaim() {
  S.accountMenuOpen = false;
  window.openLegacyClaimScreen?.();
}

// Profil / Liglerim / Ayarlar gibi yeni satırlar buraya eklenecek.
function accountMenuItems() {
  const items = [];
  if (window.legacyClaimEligible?.()) {
    items.push({ label:"Eski PIN hesabını taşı", onClick:"openLegacyClaim()" });
  }
  return items;
}

function accountMenu() {
  if (!S.accountMenuOpen) return "";
  const email = S.user?.email || "";
  let html = '<div class="acct-backdrop"></div><div id="acctMenuPanel" class="acct-menu" role="menu" aria-label="Hesap menüsü" tabindex="-1">';
  html += '<div class="acct-head"><div class="acct-name">' + esc(S.me.name) + '</div>';
  if (email) html += '<div class="acct-email">' + esc(email) + '</div>';
  if (S.admin) html += '<div class="acct-badge">Admin</div>';
  html += '</div>';
  const items = accountMenuItems();
  if (items.length) {
    html += '<div class="acct-items">' + items.map(it =>
      '<button class="acct-item" role="menuitem" onclick="' + it.onClick + '">' + esc(it.label) + '</button>'
    ).join('') + '</div>';
  }
  html += '<div class="acct-danger"><button class="acct-item" role="menuitem" onclick="signOut()"' + (S.signOutBusy ? ' disabled' : '') + '>' + (S.signOutBusy ? 'Çıkış yapılıyor…' : 'Çıkış yap') + '</button></div>';
  html += '</div>';
  return html;
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

function setPredMode(v) { S.predMode = v === "score" ? "score" : "outcome"; render(); }

async function saveScorePick(fixtureId) {
  if (!S.user) return;
  const h = parseInt(String(document.getElementById("sh_" + fixtureId)?.value || "").trim(), 10);
  const a = parseInt(String(document.getElementById("sa_" + fixtureId)?.value || "").trim(), 10);
  if (!(h >= 0 && h <= 99) || !(a >= 0 && a <= 99)) { S.msg = "Skoru iki sayı olarak gir (0-99)."; render(); return; }
  S.msg = ""; render();
  const ok = await saveScorePrediction(fixtureId, h, a);
  if (ok) {
    if (!S.scorePreds.has(fixtureId)) S.scorePreds.set(fixtureId, new Map());
    S.scorePreds.get(fixtureId).set(S.user.id, { home:h, away:a });
  } else {
    S.msg = S.msg || "Skor tahmini kaydedilemedi.";
  }
  render();
}

function isAdmin() { return !!S.user && S.admin; }

// dk satırında admin şu an ne yazıyorsa (henüz kaydedilmemiş) onu döner.
// Öncelik: elle seçilmiş puan (ptDraft) > skor kutularından türetilen puan >
// önceden kaydedilmiş puan. Skor kutusu değiştiğinde ptDraft siliniyor
// (bkz. onScoreInput), böylece yeni skor otomatik türetmeye geri döner.
function currentPoint(team, i) {
  const dk = team + ":" + i;
  if (S.ptDraft[dk] !== undefined && S.ptDraft[dk] !== null) return S.ptDraft[dk];
  const draft = S.scoreDraft[dk];
  if (draft) {
    const f = parseInt(draft[0], 10), a = parseInt(draft[1], 10);
    if (Number.isInteger(f) && f >= 0 && Number.isInteger(a) && a >= 0) return f > a ? 3 : (f === a ? 1 : 0);
  }
  return S.results[team][i];
}

// Satırın <input> kutularında o an ne yazılıysa S.scoreDraft'a alır. Bir
// render() satırı yeniden çizmeden önce mutlaka çağrılmalı — aksi hâlde
// innerHTML değişimi kutulardaki henüz kaydedilmemiş yazıyı siler.
function captureScoreDraft(team, i) {
  const f = document.getElementById("sf_" + team + "_" + i)?.value;
  const a = document.getElementById("sa_" + team + "_" + i)?.value;
  if (f !== undefined && a !== undefined) S.scoreDraft[team + ":" + i] = [f, a];
}

// Tam render() yerine yalnızca puan düğmelerinin görünümünü günceller —
// odak/imleç konumunu kaybetmeden skor yazarken canlı önizleme sağlar.
function updatePointButtonsUI(team, i) {
  const wrap = document.getElementById("pts_" + team + ":" + i);
  if (!wrap) return;
  const cur = currentPoint(team, i);
  const accent = TEAMS[team].theme.accent;
  Array.from(wrap.querySelectorAll("button[data-pv]")).forEach(btn => {
    btn.style.cssText = Number(btn.dataset.pv) === cur ? ('background:' + accent + ';color:#0B0D10;border-color:' + accent) : '';
  });
}

function onScoreInput(team, i) {
  captureScoreDraft(team, i);
  delete S.ptDraft[team + ":" + i];
  updatePointButtonsUI(team, i);
}

async function saveScore(team, i) {
  if (!isAdmin()) return;
  const g = id => parseInt(String(document.getElementById(id)?.value || "").trim(), 10);
  const f = g("sf_" + team + "_" + i), a = g("sa_" + team + "_" + i);
  if (!(f >= 0) || !(a >= 0)) { S.msg = "Skoru iki rakam olarak gir."; render(); return; }
  const key = team + ":" + i;
  const p = S.ptDraft[key] !== undefined && S.ptDraft[key] !== null ? S.ptDraft[key] : (f > a ? 3 : (f === a ? 1 : 0));
  delete S.ptDraft[key];
  delete S.scoreDraft[key];
  if (S.editRow === key) S.editRow = null;
  S.results[team] = S.results[team].slice(); S.results[team][i] = p;
  S.scores[team] = S.scores[team].slice(); S.scores[team][i] = [f, a];
  S.msg = ""; render();

  // Admin her zaman "kendi takımı - rakip" sırasında girer; fixtures.home_goals
  // /away_goals gerçek maç yönelimi ister, o yüzden o takımın bu maçta iç saha
  // olup olmadığına bakarak çeviriyoruz.
  const m = TEAMS[team].matches[i];
  const homeGoals = m.home ? f : a, awayGoals = m.home ? a : f;
  const resultsOk = await saveResults(team);
  const fixtureOk = await saveFixtureResult(m.id, homeGoals, awayGoals);
  if (fixtureOk && m.id) { m.homeGoals = homeGoals; m.awayGoals = awayGoals; }
  if (!resultsOk || !fixtureOk) { S.msg = S.msg || "Sonuç kaydedilemedi."; render(); }
}

async function clearAllFixtureResults() {
  const matches = [].concat(TEAMS.gs.matches || [], TEAMS.fb.matches || []).filter(m => m.id);
  const oks = await Promise.all(matches.map(m => saveFixtureResult(m.id, null, null)));
  matches.forEach((m, idx) => { if (oks[idx]) { m.homeGoals = null; m.awayGoals = null; } });
  return oks.every(Boolean);
}

async function clearAllScores() {
  if (!isAdmin()) return;
  if (!confirm("Girilen bütün skorlar ve puanlar silinecek. Emin misin?")) return;
  S.results = {gs:empty(), fb:empty()}; S.scores = {gs:empty(), fb:empty()}; S.msg = ""; render();
  const resultsOk = (await Promise.all([saveResults("gs"), saveResults("fb")])).every(Boolean);
  const fixturesOk = await clearAllFixtureResults();
  if (!resultsOk || !fixturesOk) { S.msg = S.msg || "Silinemedi."; render(); }
}

async function clearAll() {
  if (!isAdmin()) return;
  if (!confirm("Girilen bütün skorlar ve puanlar silinecek. Emin misin?")) return;
  S.results = {gs:empty(), fb:empty()}; S.scores = {gs:empty(), fb:empty()}; S.ptDraft = {}; S.scoreDraft = {}; render();
  const resultsOk = (await Promise.all([saveResults("gs"), saveResults("fb")])).every(Boolean);
  const fixturesOk = await clearAllFixtureResults();
  if (!resultsOk || !fixturesOk) { S.msg = S.msg || "Sıfırlanamadı."; render(); }
}

async function clearScore(team, i) {
  if (!isAdmin()) return;
  S.results[team] = S.results[team].slice(); S.results[team][i] = null;
  S.scores[team] = S.scores[team].slice(); S.scores[team][i] = null;
  render();
  const m = TEAMS[team].matches[i];
  const resultsOk = await saveResults(team);
  const fixtureOk = await saveFixtureResult(m.id, null, null);
  if (fixtureOk && m.id) { m.homeGoals = null; m.awayGoals = null; }
  if (!resultsOk || !fixtureOk) { S.msg = S.msg || "Sonuç silinemedi."; render(); }
}

function setPt(team, i, v) {
  if (!isAdmin()) return;
  captureScoreDraft(team, i);
  S.ptDraft[team + ":" + i] = v;
  render();
}
function openRow(team, i) { if (isAdmin()) { S.editRow = team + ":" + i; render(); } }
function closeRow(team, i) { if (S.editRow === team + ":" + i) S.editRow = null; delete S.ptDraft[team + ":" + i]; delete S.scoreDraft[team + ":" + i]; render(); }
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

// Maç bazlı "Herkesin tahmini" paneli. Sonuç (3/1/0) dağılımı takım
// kilitlenene kadar gizli kalır — erken açılırsa rakip kopyalayabilir. Skor
// tahminleri bu kısıtla oynamıyor (0010_score_predictions.sql "skor tahmini
// oku" politikası kilit öncesinde de herkese açık), bu yüzden burada hep
// gösterilir ve panel her zaman tıklanabilir.
function everyoneGuessPanel(k, i, m, hardLock) {
  const pid = k + ':' + i;
  const open = S.openMatch === pid;
  const res = S.results[k];
  const actualPts = res[i];
  const votes = S.players.map(p => ({name:p.name, v:(p[k] || empty())[i]})).sort((x,y) => (y.v === null ? -1 : y.v) - (x.v === null ? -1 : x.v) || x.name.localeCompare(y.name,"tr"));
  const cnt = v => votes.filter(x => x.v === v).length;
  const scoreMap = m.id ? (S.scorePreds.get(m.id) || new Map()) : new Map();
  const scoreRows = Array.from(scoreMap.entries()).map(([uid, g]) => {
    const player = S.players.find(p => p.id === uid);
    return { name:player ? player.name : "?", home:g.home, away:g.away };
  }).sort((a,b) => a.name.localeCompare(b.name, "tr"));
  const hasActual = m.homeGoals !== undefined && m.homeGoals !== null && m.awayGoals !== undefined && m.awayGoals !== null;

  const summary = hardLock
    ? ('3: ' + cnt(3) + ' · 1: ' + cnt(1) + ' · 0: ' + cnt(0))
    : (scoreRows.length ? scoreRows.length + ' skor tahmini' : 'skor tahmini yok');
  let html = '<button class="peek" onclick="peek(\'' + pid + '\')"><span>Herkesin tahmini</span><span>' + summary + (open ? ' ▴' : ' ▾') + '</span></button>';
  if (open) {
    html += '<div class="peekbody">';
    if (hardLock) {
      html += '<div class="dist">Sonuç tahmini</div>';
      if (!votes.length) html += '<div class="dist">Kimse tahmin girmemiş.</div>';
      else votes.forEach(x => {
        const right = actualPts !== null && x.v !== null && x.v === actualPts;
        html += '<div class="prow"><span class="pn">' + esc(x.name) + '</span><span class="pv' + (right ? ' on' : '') + '">' + (x.v === null ? '·' : x.v) + '</span></div>';
      });
    }
    html += '<div class="dist">Skor tahmini' + (hasActual ? ' · gerçek ' + m.homeGoals + '-' + m.awayGoals : '') + '</div>';
    if (!scoreRows.length) html += '<div class="dist">Kimse skor tahmini girmemiş.</div>';
    else scoreRows.forEach(x => {
      const pts = hasActual ? scoreMatchPrediction(x.home, x.away, m.homeGoals, m.awayGoals) : null;
      html += '<div class="prow"><span class="pn">' + esc(x.name) + '</span><span class="pv wide' + (pts === 5 ? ' on' : '') + '">' + x.home + '-' + x.away + '</span></div>';
    });
    html += '</div>';
  }
  return html;
}

function scoreCardBody(T, m) {
  if (!m.id) return '<div class="meta" style="padding:12px 16px">Skor tahmini için fikstür verisi bekleniyor.</div>';
  const started = Date.now() >= new Date(m.iso).getTime();
  const homeName = m.home ? T.name : m.opp;
  const awayName = m.home ? m.opp : T.name;
  const mine = (S.scorePreds.get(m.id) || new Map()).get(S.user.id);
  const hasActual = m.homeGoals !== undefined && m.homeGoals !== null && m.awayGoals !== undefined && m.awayGoals !== null;

  let html = '<div class="spick"><span class="steam"><b>' + esc(homeName) + '</b></span>' +
    '<input id="sh_' + m.id + '" inputmode="numeric" maxlength="2" value="' + (mine ? mine.home : '') + '"' + (started ? ' disabled' : '') + '>' +
    '<span class="sep">–</span>' +
    '<input id="sa_' + m.id + '" inputmode="numeric" maxlength="2" value="' + (mine ? mine.away : '') + '"' + (started ? ' disabled' : '') + '>' +
    '<span class="steam" style="text-align:right"><b>' + esc(awayName) + '</b></span></div><div class="spactions">';

  if (hasActual && mine) {
    const pts = scoreMatchPrediction(mine.home, mine.away, m.homeGoals, m.awayGoals);
    const label = pts === 5 ? 'Tam skor · +5' : pts === 3 ? 'Averaj · +3' : pts === 1 ? 'Sonuç · +1' : 'Kaçtı · +0';
    html += '<span class="chip' + (pts === 5 ? ' hit' : '') + '">' + label + '</span>';
  } else if (hasActual) {
    html += '<span class="chip">Gerçek skor ' + m.homeGoals + '-' + m.awayGoals + '</span>';
  } else if (started) {
    html += '<span class="chip">Maç başladı</span>';
  } else {
    html += '<button onclick="saveScorePick(\'' + m.id + '\')">Kaydet</button>';
  }
  html += '</div>';
  return html;
}

function teamView(k) {
  const T = TEAMS[k], picks = S.me[k] || empty();
  const hardLock = locked(k), conf = confirmedAt(S.me, k), lk = hardLock || !!conf;
  const predicted = picks.reduce((a,b)=>a+(b||0),0);
  const filled = picks.filter(p=>p!==null).length;
  const res = S.results[k];
  const earned = res.reduce((a,b)=>a+(b||0),0);
  const played = res.filter(x=>x!==null).length;
  const scoreMode = S.predMode === "score";
  let html = '<div class="strip">' + (hardLock ? '<span>Tahminler kilitlendi — ' + T.matches[0].d + ' maçından 1 saat önce</span>' : '<span>' + (conf ? 'Kaydedildi · kilide kalan' : 'Kilide kalan') + '</span><b id="cd">' + (countdownText(lockAt(k))||"") + '</b>') + '</div><div class="pad">';

  html += '<div class="scope"><button class="' + (!scoreMode?'on':'') + '" onclick="setPredMode(\'outcome\')">Sonuç Tahmini</button><button class="' + (scoreMode?'on':'') + '" onclick="setPredMode(\'score\')">Skor Tahmini</button></div>';

  T.matches.forEach((m,i) => {
    const mine = picks[i], actual = res[i];
    const hit = actual !== null && mine !== null && actual === mine;
    const miss = actual !== null && mine !== null && actual !== mine;
    html += '<div class="card"><div class="top"><div style="display:flex;align-items:center;gap:10px;min-width:0">' + teamLogo(m.oppTeam, "sm") + '<div style="min-width:0"><div class="opp">' + esc(m.opp) + '</div><div class="meta">' + m.d + ' · ' + (m.home ? "İç saha" : "Deplasman") + '</div></div></div>' + (actual !== null ? '<span class="chip' + (hit ? ' hit' : '') + '">' + (hit ? "Tuttu" : miss ? "Kaçtı" : "Sonuç " + actual) + '</span>' : '') + '</div>';
    if (scoreMode) {
      html += scoreCardBody(T, m);
    } else {
      html += '<div class="picks">';
      PICKS.forEach(p => {
        const sel = mine === p.v;
        html += '<button class="' + (sel?'sel':'') + '"' + (lk?' disabled':'') + ' onclick="pick(\'' + k + '\',' + i + ',' + p.v + ')"><span class="v">' + p.v + '</span><span class="t">' + p.t + '</span></button>';
      });
      html += '</div>';
    }
    html += everyoneGuessPanel(k, i, m, hardLock);
    html += '</div>';
  });

  html += '</div>';
  if (!scoreMode) {
    html += '<div class="bar"><div class="in"><div><div class="k">' + T.tla + ' tahmin toplamın</div><div class="s">' + filled + '/8 maç işaretlendi' + (played ? ' · gerçekleşen ' + earned + ' puan (' + played + ' maç)' : '') + '</div></div><div class="tot">' + predicted + '</div></div><div class="act">' + (hardLock ? '<div class="shut">Tahminler kesinleşti, değiştirilemez.</div>' : conf ? '<button class="edit" onclick="editTeam(\'' + k + '\')">Düzenle</button>' : '<button class="save"' + (filled < 8 ? ' disabled' : '') + ' onclick="confirmTeam(\'' + k + '\')">' + (filled < 8 ? '8 maçın hepsini işaretle' : 'Kaydet ve kilitle') + '</button>') + '</div></div>';
  }
  return html;
}

// Skor tahmini sıralaması ana sıralamadan bağımsız: gs/fb kapsamı ayrımı
// yok, sonuçlanmış (fixtures.home_goals/away_goals dolu) her iki takımın
// maçı da tek havuzda toplanıyor.
function scoreStandingsRows() {
  const finishedMatches = [].concat(TEAMS.gs.matches || [], TEAMS.fb.matches || [])
    .filter(m => m.id && m.homeGoals !== undefined && m.homeGoals !== null && m.awayGoals !== undefined && m.awayGoals !== null);
  const rows = (S.players || []).map(p => {
    let points = 0, exact = 0, diff = 0;
    finishedMatches.forEach(m => {
      const guess = S.scorePreds.get(m.id)?.get(p.id);
      const pts = guess ? scoreMatchPrediction(guess.home, guess.away, m.homeGoals, m.awayGoals) : 0;
      if (pts === 5) exact++;
      else if (pts === 3) diff++;
      points += pts || 0;
    });
    return Object.assign({}, p, { points, exact, diff });
  });
  rows.sort(compareScorePredictionRows);
  return { rows, played:finishedMatches.length };
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
          html += '<div style="padding-top:12px"><div class="lbl">' + TEAMS[k].tla + '</div>';
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

  const sst = scoreStandingsRows();
  html += '<div class="rowhead" style="margin-top:26px"><h2 class="sec">Skor Tahmini Sıralaması</h2></div><p class="meta" style="margin:-4px 0 12px">' + (sst.played ? 'Tam skoru bilen en çok puanı alır. Eşitlikte tam skor sayısı, sonra doğru averaj sayısı belirleyici.' : 'Sonuçlanan maç olunca burada sıralama oluşacak.') + '</p>';
  if (!sst.played || !sst.rows.length) html += '<p class="meta" style="margin-bottom:24px">Henüz veri yok.</p>';
  else {
    sst.rows.forEach((p,i) => {
      const mine = S.me && p.id === S.me.id;
      html += '<div class="srow' + (mine?' me':'') + '"><span class="pos' + (i===0?' first':'') + '">' + (i+1) + '</span><span class="sn">' + esc(p.name) + (mine?' (sen)':'') + '</span><span class="sv">' + p.points + '<small>puan</small></span><span class="sv">' + p.exact + '<small>tam skor</small></span></div>';
    });
    html += '<div style="height:20px"></div>';
  }

  html += '<div class="rowhead"><h2 class="sec">Maç sonuçları</h2>' + (admin ? '<button class="ghost" onclick="toggleEdit()">' + (S.editing ? 'Girişi kapat' : 'Sonuç gir') + '</button>' : '') + '</div>' + (admin && S.editing ? '<button class="wipe" onclick="clearAllScores()">Bütün skorları sil</button>' : '') + '<p class="meta" style="margin:0 0 16px">' + (admin ? 'Maçın yanındaki Gir düğmesine bas, skoru yaz. Puan otomatik hesaplanır.' : 'Skorları yalnızca yarışma yöneticisi giriyor.') + '</p>';

  ["gs","fb"].forEach(k => {
    html += '<div style="margin-bottom:20px"><div class="lbl" style="color:' + TEAMS[k].theme.accent + ';display:flex;align-items:center;gap:8px">' + teamLogo(TEAMS[k], "sm") + '<span>' + TEAMS[k].name + '</span></div>';
    TEAMS[k].matches.forEach((m,i) => {
      const done = Date.now() >= new Date(m.iso).getTime(), v = S.results[k][i], sc = (S.scores[k] || empty())[i], dk = k + ':' + i, editing = admin && S.editing && S.editRow === dk;
      // Skor kutuları hep "kendi takımı - rakip" sırasında; kart başlığında
      // yalnızca rakip adı var, o yüzden kutuların altına takım kısaltmasını
      // yazmadan "1-2" hangi tarafın olduğu belirsiz kalıyor.
      const oppTla = (m.oppTeam && m.oppTeam.tla) ? m.oppTeam.tla : String(m.opp || "?").slice(0, 3).toUpperCase();
      html += '<div class="res' + (editing ? ' col' : '') + '">' + teamLogo(m.oppTeam, "sm") + '<div class="n"><div>' + esc(m.opp) + '</div><div>' + m.d + ' · ' + (m.home?'İç saha':'Deplasman') + '</div></div>';
      if (editing) {
        const draft = S.scoreDraft[dk];
        const fVal = draft ? draft[0] : (sc ? sc[0] : '');
        const aVal = draft ? draft[1] : (sc ? sc[1] : '');
        html += '<div class="sc">' +
          '<div class="scbox"><input id="sf_' + k + '_' + i + '" inputmode="numeric" maxlength="2" value="' + esc(fVal) + '" oninput="onScoreInput(\'' + k + '\',' + i + ')"><span class="scl">' + esc(TEAMS[k].tla) + '</span></div>' +
          '<span class="sep">-</span>' +
          '<div class="scbox"><input id="sa_' + k + '_' + i + '" inputmode="numeric" maxlength="2" value="' + esc(aVal) + '" oninput="onScoreInput(\'' + k + '\',' + i + ')"><span class="scl">' + esc(oppTla) + '</span></div>' +
        '</div>';
        const cur = currentPoint(k, i);
        html += '<div class="pts" id="pts_' + dk + '">';
        PICKS.forEach(pp => { const on = cur === pp.v; html += '<button data-pv="' + pp.v + '" onclick="setPt(\'' + k + '\',' + i + ',' + pp.v + ')" style="' + (on ? 'background:' + TEAMS[k].theme.accent + ';color:#0B0D10;border-color:' + TEAMS[k].theme.accent : '') + '">' + pp.v + '</button>'; });
        html += '<button class="ok" onclick="saveScore(\'' + k + '\',' + i + ')">Kaydet</button><button class="cancel" onclick="closeRow(\'' + k + '\',' + i + ')">Vazgeç</button></div>';
      } else {
        html += '<div class="done">' + (sc ? '<span class="skor"><small>' + esc(TEAMS[k].tla) + '</small>' + sc[0] + '-' + sc[1] + '<small>' + esc(oppTla) + '</small></span>' : '') + '<span class="val" style="' + (v===null?'color:var(--dim)':'') + '">' + (v===null ? (done?'—':'·') : v) + '</span>' + (admin && S.editing ? (v === null ? '<button class="mini" onclick="openRow(\'' + k + '\',' + i + ')">Gir</button>' : '<button class="mini" onclick="openRow(\'' + k + '\',' + i + ')">Düzenle</button><button class="mini del" onclick="clearScore(\'' + k + '\',' + i + ')">Sil</button>') : '') + '</div>';
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
  let html = '<div class="wrap"><header><h1>Tahmin Ligi</h1><div class="acct"><button id="acctBtn" class="out" aria-haspopup="true" aria-expanded="' + (S.accountMenuOpen ? 'true' : 'false') + '" aria-controls="acctMenuPanel" onclick="toggleAccountMenu()">' + esc(S.me.name) + (S.admin ? ' · Admin' : '') + '</button>' + accountMenu() + '</div></header><nav>';
  tabs.forEach(t => { const on = S.view === t[0]; const logo = TEAMS[t[0]] ? teamLogo(TEAMS[t[0]], "sm") : ""; html += '<button class="' + (on?'on':'') + '" style="color:' + (on?t[2]:'var(--dim)') + ';border-bottom-color:' + (on?t[2]:'transparent') + '" onclick="go(\'' + t[0] + '\')">' + logo + t[1] + '</button>'; });
  html += '</nav>';
  if (S.msg) html += '<div class="err">' + esc(S.msg) + '</div>';
  html += S.view === "board" ? boardView() : teamView(S.view);
  html += '</div>';
  app.innerHTML = html;
}

Object.assign(window, {
  S, render, go, setAuthMode, signUp, signIn, signInWithGoogle, requestPasswordReset, updatePassword, signOut,
  saveDisplayName, locked,
  pick, confirmTeam, editTeam, saveScore, clearAllScores, clearAll, clearScore, setPt, onScoreInput,
  setPredMode, saveScorePick,
  openRow, closeRow, setScope, peek, toggleEdit, refresh,
  toggleAccountMenu, closeAccountMenu, openLegacyClaim,
  teamLogoFallback
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
  ensureTeamsLoaded();
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

  document.addEventListener("keydown", e => {
    if (!S.accountMenuOpen) return;
    if (e.key === "Escape") { e.preventDefault(); closeAccountMenu(); return; }
    if (e.key === "Tab") {
      const panel = document.getElementById("acctMenuPanel");
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("click", e => {
    if (!S.accountMenuOpen) return;
    const panel = document.getElementById("acctMenuPanel");
    const btn = document.getElementById("acctBtn");
    if (panel?.contains(e.target) || btn?.contains(e.target)) return;
    closeAccountMenu();
  }, true);
})();
