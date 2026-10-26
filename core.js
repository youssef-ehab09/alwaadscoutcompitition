/* Al Waad: shared constants and helpers */
(function () {
  "use strict";
  const AW = (window.AW = window.AW || {});

  // ---- settings (only the two Supabase values are needed in config.js) ----
  const raw = window.APP_CONFIG || {};
  AW.cfg = {
    SUPABASE_URL: (raw.SUPABASE_URL || "").trim(),
    SUPABASE_ANON_KEY: (raw.SUPABASE_ANON_KEY || "").trim(),
    TIMEZONE: raw.TIMEZONE || "Africa/Cairo"
  };
  AW.demo = !AW.cfg.SUPABASE_URL || !AW.cfg.SUPABASE_ANON_KEY;

  // ---- storage that never throws (private windows, previews) ----
  const mem = {};
  AW.ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] == null ? null : mem[k]; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  };

  // ---- language: Arabic first ----
  AW.lang = AW.ls.get("aw_lang") === "en" ? "en" : "ar";
  AW.setLang = function (l) { AW.lang = l === "en" ? "en" : "ar"; AW.ls.set("aw_lang", AW.lang); };
  AW.t = function (k, p) {
    const row = (AW.T || {})[k];
    let s = row ? (AW.lang === "ar" ? row[0] : (row[1] != null ? row[1] : row[0])) : k;
    if (p) for (const x in p) s = s.split("{" + x + "}").join(p[x]);
    return s;
  };
  AW.num = function (n) { return Number(n || 0).toLocaleString(AW.lang === "ar" ? "ar-EG" : "en-US"); };
  AW.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  // pick the Arabic or English version of a text pair like (question_ar, question_en)
  AW.pick = function (ar, en) { return AW.lang === "ar" ? (ar || en || "") : (en || ar || ""); };

  // ---- teams, ranks, difficulty ----
  AW.TEAMS = [
    { k: "buds",       icon: "🌱", ar: "البراعم",   en: "Buds",            age_ar: "أقل من ٨ سنوات", age_en: "under 8" },
    { k: "cubs",       icon: "🐺", ar: "الأشبال",   en: "Cubs",            age_ar: "٨ – ١١ سنة",     age_en: "8–11" },
    { k: "brownies",   icon: "🌸", ar: "الزهرات",   en: "Flowers",         age_ar: "٨ – ١١ سنة",     age_en: "8–11" },
    { k: "scouts",     icon: "⚜️", ar: "الكشافة",   en: "Scouts",          age_ar: "١١ – ١٥ سنة",    age_en: "11–15" },
    { k: "guides",     icon: "🏕️", ar: "المرشدات",  en: "Guides",          age_ar: "١١ – ١٥ سنة",    age_en: "11–15" },
    { k: "adv_scouts", icon: "🔥", ar: "المتقدم",    en: "Advanced Scouts", age_ar: "١٥ – ١٨ سنة",    age_en: "15–18" },
    { k: "adv_guides", icon: "✨", ar: "المتقدمات",  en: "Advanced Guides", age_ar: "١٥ – ١٨ سنة",    age_en: "15–18" },
    { k: "rovers",     icon: "🧭", ar: "الجوالة",   en: "Rovers",          age_ar: "١٨ سنة فأكثر",   age_en: "18 and up" },
    { k: "rover_girls",icon: "🌟", ar: "الجوالات",  en: "Rover Guides",    age_ar: "١٨ سنة فأكثر",   age_en: "18 and up" },
    { k: "leaders",    icon: "🎖️", ar: "القادة",    en: "Leaders",         age_ar: "القادة",         age_en: "leaders" }
  ];
  AW.RANKS = [
    { k: "member",       ar: "فرد",          en: "Member" },
    { k: "assistant",    ar: "مساعد عريف",   en: "Assistant Patrol Leader" },
    { k: "leader",       ar: "عريف",         en: "Patrol Leader" },
    { k: "first_leader", ar: "عريف أول",     en: "First Patrol Leader" }
  ];
  AW.DIFFS = [
    { k: "easy",   ar: "سهل",    en: "Easy",   points: 100, time: 30 },
    { k: "medium", ar: "متوسط",  en: "Medium", points: 150, time: 40 },
    { k: "hard",   ar: "صعب",    en: "Hard",   points: 200, time: 60 }
  ];
  AW.teamOf = function (k) { return AW.TEAMS.find(function (x) { return x.k === k; }); };
  AW.teamName = function (k) { const x = AW.teamOf(k); return x ? (AW.lang === "ar" ? x.ar : x.en) : ""; };
  AW.teamIcon = function (k) { const x = AW.teamOf(k); return x ? x.icon : ""; };
  AW.teamLabel = function (k) { const x = AW.teamOf(k); return x ? x.icon + " " + AW.teamName(k) : ""; };
  AW.rankName = function (k) { const x = AW.RANKS.find(function (r) { return r.k === k; }); return x ? (AW.lang === "ar" ? x.ar : x.en) : ""; };
  AW.diffName = function (k) { const x = AW.DIFFS.find(function (r) { return r.k === k; }); return x ? (AW.lang === "ar" ? x.ar : x.en) : ""; };

  // ---- levels: every 1000 Waadoz earned is a new level ----
  AW.LEVEL_STEP = 1000;
  AW.levelOf = function (earned) { return Math.floor((earned || 0) / AW.LEVEL_STEP) + 1; };
  AW.levelProgress = function (earned) { return ((earned || 0) % AW.LEVEL_STEP) / AW.LEVEL_STEP; };

  // ---- dates (all in the competition time zone) ----
  AW.todayStr = function () { return new Intl.DateTimeFormat("en-CA", { timeZone: AW.cfg.TIMEZONE }).format(new Date()); };
  AW.addDays = function (s, n) { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  AW.msUntilMidnight = function () {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: AW.cfg.TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const g = function (ty) { return +parts.find(function (p) { return p.type === ty; }).value; };
    return (86400 - (g("hour") * 3600 + g("minute") * 60 + g("second"))) * 1000;
  };
  AW.fmtHMS = function (ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), p = function (n) { return String(n).padStart(2, "0"); };
    return p(Math.floor(s / 3600)) + ":" + p(Math.floor((s % 3600) / 60)) + ":" + p(s % 60);
  };
  AW.fmtDate = function (s) {
    if (!s) return "";
    try {
      return new Date(String(s).slice(0, 10) + "T00:00:00Z").toLocaleDateString(AW.lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    } catch (e) { return String(s); }
  };

  // ---- errors: every API error carries a code like E_NOFUNDS ----
  AW.errText = function (e) {
    const code = e && e.code;
    if (code && AW.T && AW.T["err_" + code]) return AW.t("err_" + code);
    return (e && e.message) || AW.t("err_generic");
  };

  // ---- set a nested value by path ("qb.items.0.q_ar") ----
  AW.setPath = function (obj, path, value) {
    const keys = path.split(".");
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) return; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = value;
  };
})();
