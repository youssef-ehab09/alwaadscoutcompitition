/* Al Waad: the app (player screens). Admin screens live in admin.js. */
(function () {
  "use strict";
  const AW = window.AW;
  const t = function (k, p) { return AW.t(k, p); };
  const esc = AW.esc, num = AW.num;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  let api = null;

  // Arabic-Indic digits typed on an Arabic keyboard -> normal digits
  AW.digits = function (s) {
    return String(s == null ? "" : s).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; })
                                      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; });
  };
  function fail(code) { const e = new Error(code); e.code = code; throw e; }
  AW.fail = fail;

  /* ============================================================
     State
     ============================================================ */
  const S = (AW.S = {
    booting: true, fatal: "", user: null, me: null, view: "home",
    af: { mode: "login", name: "", team: "", age: "", rank: "member", email: "", password: "" }, msg: "",
    play: null, last: null, deadline: 0, ranks: null, rankPeriod: AW.ls.get("aw_rp") === "all" ? "all" : "week", rankUp: null,
    lb: { scope: "group", period: "week", comp: null, rows: null }, comps: [],
    shop: null, history: null, walletTab: "shop", confirmBuy: null,
    pi: { name: "", team: "", age: "", rank: "member" }, av: null, portfolio: null,
    pf: { kind: "camp", title: "", date: "", notes: "" },
    busy: false, timer: null, admin: {}
  });
  AW.actions = {};
  AW.forms = {};
  AW.changes = {};

  const balanceOf = function () { return S.me ? S.me.balance : 0; };
  const isAdmin = function () { return !!S.me && (S.me.role === "admin" || S.me.role === "owner"); };

  /* ============================================================
     Small UI helpers
     ============================================================ */
  function toast(msg) {
    const old = $(".toast"); if (old) old.remove();
    const el = document.createElement("div");
    el.className = "toast"; el.setAttribute("role", "status"); el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3400);
  }
  function confetti() {
    const box = document.createElement("div"); box.className = "confetti";
    const cols = ["#f6a607", "#7fb0f0", "#ffffff", "#2fcf92", "#cd6216"];
    for (let i = 0; i < 52; i++) {
      const s = document.createElement("i");
      s.style.cssText = "left:" + (Math.random() * 100) + "%;background:" + cols[i % cols.length] + ";animation-delay:" + (Math.random() * 0.4) + "s;animation-duration:" + (1.4 + Math.random() * 1.2) + "s;transform:rotate(" + (Math.random() * 360) + "deg)";
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3200);
  }
  AW.toast = toast;
  AW.confetti = confetti;

  const logoImg = function (cls) { return '<img class="' + cls + '" src="logo.png" alt="' + esc(t("app")) + '">'; };
  const loadingCard = function () { return '<section class="card empty"><p class="muted">' + t("loading") + "</p></section>"; };
  const coin = '<span class="coin" aria-hidden="true">🪙</span>';
  AW.coin = coin;

  function teamOptions(sel) {
    return '<option value="">' + t("chooseTeam") + "</option>" + AW.TEAMS.map(function (x) {
      return '<option value="' + x.k + '"' + (sel === x.k ? " selected" : "") + ">" + x.icon + " " + (AW.lang === "ar" ? x.ar : x.en) + " (" + (AW.lang === "ar" ? x.age_ar : x.age_en) + ")</option>";
    }).join("");
  }
  function rankOptions(sel) {
    return AW.RANKS.map(function (r) { return '<option value="' + r.k + '"' + (sel === r.k ? " selected" : "") + ">" + (AW.lang === "ar" ? r.ar : r.en) + "</option>"; }).join("");
  }
  AW.teamOptions = teamOptions; AW.rankOptions = rankOptions;
  const teamChip = function (k) { return k ? '<span class="tchip">' + AW.teamLabel(k) + "</span>" : ""; };
  AW.teamChip = teamChip;

  function validateProfile(v) {
    const name = String(v.name || "").trim();
    if (name.length < 2 || name.length > 20) fail("E_NAME");
    if (!v.team) fail("E_TEAM");
    const age = parseInt(AW.digits(v.age), 10);
    if (!age || age < 3 || age > 99) fail("E_AGE");
    return { name: name, team: v.team, age: age, rank: v.rank || "member" };
  }

  /* ============================================================
     Screens: sign in / sign up / complete profile
     ============================================================ */
  function profileFields(prefix) {
    const f = prefix === "af" ? S.af : S.pi;
    return '<label class="f">' + t("name") + '<input type="text" maxlength="20" autocomplete="nickname" data-b="' + prefix + '.name" value="' + esc(f.name) + '"></label>' +
      '<label class="f">' + t("team") + '<select data-b="' + prefix + '.team">' + teamOptions(f.team) + "</select></label>" +
      '<div class="two"><label class="f">' + t("age") + '<input type="text" inputmode="numeric" maxlength="2" data-b="' + prefix + '.age" value="' + esc(f.age) + '"></label>' +
      '<label class="f">' + t("rank") + '<select data-b="' + prefix + '.rank">' + rankOptions(f.rank) + "</select></label></div>";
  }

  function authHTML() {
    const su = S.af.mode === "signup";
    return '<div class="auth">' +
      '<div class="langrow"><button class="chip" data-act="lang">' + t("language") + "</button></div>" +
      (AW.demo ? '<div class="demo">' + t("demoBanner") + "</div>" : "") +
      '<div class="hero"><div class="sticker">' + logoImg("logo-lg") + "</div><h1>" + t("app") + '</h1><p class="tagline">' + t("tagline") + "</p></div>" +
      '<div class="card"><div class="seg" role="tablist">' +
        '<button class="' + (su ? "" : "on") + '" data-act="authmode" data-v="login">' + t("login") + "</button>" +
        '<button class="' + (su ? "on" : "") + '" data-act="authmode" data-v="signup">' + t("signup") + "</button></div>" +
      '<form class="stack" data-form="auth" style="margin-top:14px" novalidate>' +
        (su ? profileFields("af") : "") +
        '<label class="f">' + t("email") + '<input type="email" autocomplete="email" dir="ltr" data-b="af.email" value="' + esc(S.af.email) + '"></label>' +
        '<label class="f">' + t("password") + '<input type="password" autocomplete="' + (su ? "new-password" : "current-password") + '" dir="ltr" data-b="af.password" value="' + esc(S.af.password) + '"></label>' +
        (S.msg ? '<div class="msg">' + esc(S.msg) + "</div>" : "") +
        '<button class="btn block" type="submit">' + (su ? t("signup") : t("login")) + "</button></form></div></div>";
  }

  function onboardHTML() {
    return '<div class="auth">' +
      '<div class="langrow"><button class="chip" data-act="lang">' + t("language") + '</button> <button class="chip" data-act="logout">' + t("logout") + "</button></div>" +
      '<div class="hero"><div class="sticker">' + logoImg("logo-lg") + "</div><h1>" + t("completeProfile") + '</h1><p class="tagline">' + t("completeProfileSub") + "</p></div>" +
      '<div class="card"><form class="stack" data-form="onboard" novalidate>' + profileFields("pi") +
      '<button class="btn block" type="submit">' + t("save") + "</button></form></div></div>";
  }

  AW.forms.auth = async function (f) {
    const a = S.af, su = a.mode === "signup";
    const email = a.email.trim();
    if (!email || a.password.length < 6) fail("E_FILL");
    let meta = null;
    if (su) meta = validateProfile(a);
    const btn = $("button[type=submit]", f); if (btn) btn.disabled = true;
    try {
      const u = su ? await api.signUp(email, a.password, meta) : await api.signIn(email, a.password);
      if (!u) { S.msg = t("checkEmail"); S.af.mode = "login"; S.af.password = ""; render(); return; }
      S.user = u; S.msg = ""; S.af.password = "";
      await afterLogin();
    } finally { if (btn) btn.disabled = false; }
  };
  AW.forms.onboard = async function () {
    const v = validateProfile(S.pi);
    await api.saveProfile({ name: v.name, team: v.team, age: v.age, rank: S.pi.rank });
    await refreshMe();
    await afterLogin();
  };

  async function afterLogin() {
    await refreshMe();
    S.view = "home"; S.last = null; S.play = null; S.ranks = null;
    S.pi = { name: S.me.display_name || "", team: S.me.team || "", age: S.me.age ? String(S.me.age) : "", rank: S.me.patrol_rank || "member" };
    render();
    if (S.me.team) enter("home");
  }
  async function refreshMe() { S.me = await api.me(); return S.me; }

  /* ============================================================
     Shell: header, navigation
     ============================================================ */
  function shellHTML() {
    const items = [["home", "🎯", t("nav_home")], ["rank", "🏆", t("nav_ranks")], ["wallet", "🪙", t("nav_wallet")], ["profile", "😎", t("nav_profile")]];
    if (isAdmin()) items.push(["admin", "🛠️", t("nav_admin")]);
    return '<header class="top"><div class="brand"><span class="badge">' + logoImg("logo-sm") + "</span></div>" +
      '<div class="top-actions"><button class="chip coin-chip" data-act="nav" data-v="wallet" aria-label="' + t("nav_wallet") + '">' + coin + " <b>" + num(balanceOf()) + "</b></button>" +
      '<button class="chip" data-act="lang">' + t("language") + "</button></div></header>" +
      (AW.demo ? '<div class="demo">' + t("demoBanner") + "</div>" : "") +
      '<main class="view" id="view">' + viewHTML() + "</main>" +
      '<nav class="nav" aria-label="' + t("nav_label") + '">' + items.map(function (i) {
        return '<button class="' + (S.view === i[0] ? "on" : "") + '" data-act="nav" data-v="' + i[0] + '"><span class="ic" aria-hidden="true">' + i[1] + "</span>" + i[2] + "</button>";
      }).join("") + "</nav>";
  }
  function viewHTML() {
    switch (S.view) {
      case "rank": return ranksHTML();
      case "wallet": return walletHTML();
      case "profile": return profileHTML();
      case "admin": return AW.admin ? AW.admin.html() : "";
      default: return homeHTML();
    }
  }

  /* ============================================================
     Home: profile card, rank card, daily quiz
     ============================================================ */
  function meCard() {
    const m = S.me, lvl = AW.levelOf(m.earned), pr = Math.round(AW.levelProgress(m.earned) * 100);
    return '<section class="card"><div class="me">' + AW.avatar.face(m, 64) +
      '<div class="who"><div class="name">' + esc(m.display_name) + "</div>" +
      '<div class="meta">' + teamChip(m.team) + (m.patrol_rank && m.patrol_rank !== "member" ? '<span class="rk">' + AW.rankName(m.patrol_rank) + "</span>" : "") + "</div>" +
      '<div class="lvl"><span class="pill">' + t("level") + " " + num(lvl) + '</span><div class="bar" role="progressbar" aria-valuenow="' + pr + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pr + '%"></i></div></div></div></div>' +
      '<div class="stats"><div class="stat"><span>' + t("waadoz") + "</span><b>" + coin + " " + num(m.balance) + "</b></div>" +
      '<div class="stat fire"><span>' + t("streak") + "</span><b>🔥 " + num(m.streak) + "</b></div></div></section>";
  }

  function rankCard() {
    const r = S.ranks, up = S.rankUp || {};
    const cell = function (label, v, gain) {
      return '<div class="rc-n"><span>' + label + "</span><b>" + (v ? "#" + num(v) : "—") + "</b>" +
        (gain ? '<i class="up" aria-label="' + t("rankedUp", { n: num(gain) }) + '">▲ ' + num(gain) + "</i>" : "") + "</div>";
    };
    const none = r && !r.group;
    return '<section class="card rankcard' + ((up.group || up.team) ? " flash" : "") + '"><div class="rc-head"><h2>' + t("yourRank") + "</h2>" +
      '<div class="seg sm"><button class="' + (S.rankPeriod === "week" ? "on" : "") + '" data-act="rankperiod" data-v="week">' + t("pWeek") + '</button><button class="' + (S.rankPeriod === "all" ? "on" : "") + '" data-act="rankperiod" data-v="all">' + t("pAll") + "</button></div></div>" +
      (r ? '<div class="rc-nums">' + cell(t("inGroup"), r.group, up.group) + cell(t("inTeam"), r.team, up.team) + "</div>" +
           (none ? '<p class="muted small">' + t("notRanked") + "</p>" : "")
         : '<p class="muted">' + t("loading") + "</p>") + "</section>";
  }

  function stepsHTML(qs) {
    return '<ol class="steps">' + qs.map(function (q, i) {
      let cls = "st " + q.difficulty, mark = num(i + 1);
      if (q.status === "done") { cls += q.result.correct ? " ok" : " bad"; mark = q.result.correct ? "✓" : "✗"; }
      else if (q.status === "open") cls += " now";
      return '<li class="' + cls + '"><span class="dot">' + mark + "</span><small>" + AW.diffName(q.difficulty) + "</small></li>";
    }).join("") + "</ol>";
  }

  function qPills(q) {
    return '<div class="qmeta"><span class="pill gold">' + coin + " " + num(q.base_points) + '+</span><span class="pill">⏱ ' + num(q.time_limit) + " " + t("sec") + "</span></div>";
  }
  const letters = function () { return AW.lang === "ar" ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"]; };
  const optText = function (o) { return AW.pick(o && o.ar, o && o.en); };

  function quizHTML() {
    const p = S.play;
    if (!p) return loadingCard();
    if (p.status === "none") return '<section class="card empty"><div class="big" aria-hidden="true">🏕️</div><h2>' + t("noQuizToday") + '</h2><p class="muted">' + t("noQuizTodaySub") + "</p></section>";
    if (p.status !== "ok") return loadingCard();
    const qs = p.questions, n = qs.length;

    if (S.last) {                                    // the answer the scout just gave
      const i = qs.findIndex(function (x) { return x.id === S.last.qid; });
      if (i >= 0 && qs[i].status === "done") return resultCard(qs, i);
    }
    const oi = qs.findIndex(function (x) { return x.status === "open"; });
    if (oi >= 0) return questionCard(qs, oi);
    const ri = qs.findIndex(function (x) { return x.status === "ready"; });
    if (ri >= 0) return readyCard(qs, ri);
    return doneCard(p);
  }

  function readyCard(qs, i) {
    const q = qs[i];
    return '<section class="card quest"><span class="ribbon diff-' + q.difficulty + '">' + t("todayQuiz") + "</span>" + stepsHTML(qs) +
      '<div class="readybox"><h2>' + t("qOf", { n: num(i + 1), total: num(qs.length) }) + " · " + AW.diffName(q.difficulty) + "</h2>" + qPills(q) +
      '<p class="muted">' + t("readyHint") + "</p>" +
      '<button class="btn block" data-act="start">' + t("startQ", { n: num(i + 1) }) + "</button></div></section>";
  }

  function questionCard(qs, i) {
    const q = qs[i];
    const opts = (q.options || []).map(function (o, k) {
      return '<button class="opt" data-act="answer" data-i="' + k + '"><span class="letter">' + (letters()[k] || k + 1) + '</span><span dir="auto">' + esc(optText(o)) + "</span></button>";
    }).join("");
    return '<section class="card quest"><span class="ribbon diff-' + q.difficulty + '">' + t("qOf", { n: num(i + 1), total: num(qs.length) }) + " · " + AW.diffName(q.difficulty) + "</span>" + stepsHTML(qs) + qPills(q) +
      '<p class="qtext" dir="auto">' + esc(AW.pick(q.question_ar, q.question_en)) + "</p>" +
      '<div class="timer" aria-hidden="true"><i id="tbar"></i></div><div class="timer-txt"><span>' + t("speedBonus") + '</span><b id="ttxt"></b></div>' +
      '<div class="opts">' + opts + "</div></section>";
  }

  function resultCard(qs, i) {
    const q = qs[i], r = q.result, timeout = S.last && S.last.timeout;
    const opts = (q.options || []).map(function (o, k) {
      let cls = "opt";
      cls += k === r.correct_index ? " correct" : (k === r.choice ? " wrong" : " dim");
      return '<button class="' + cls + '" disabled><span class="letter">' + (letters()[k] || k + 1) + '</span><span dir="auto">' + esc(optText(o)) + "</span></button>";
    }).join("");
    const more = qs.some(function (x) { return x.status === "ready" || x.status === "locked" || x.status === "open"; });
    const head = r.correct ? t("correct") : ((timeout || r.expired) ? t("timeUp") : t("wrong"));
    const body = r.correct
      ? '<ul class="breakdown"><li><span>' + t("base") + "</span><b>+" + num(r.base) + "</b></li><li><span>" + t("speed") + "</span><b>+" + num(r.bonus) + "</b></li><li><span>" + t("streakBonus") + "</span><b>+" + num(r.streak_bonus) + '</b></li><li class="total"><span>' + t("total") + "</span><b>" + coin + " +" + num(r.points) + "</b></li></ul>"
      : '<p class="muted">' + t("correctAnswer") + ": " + esc(optText(q.options[r.correct_index])) + "</p>";
    return '<section class="card quest"><span class="ribbon diff-' + q.difficulty + '">' + t("qOf", { n: num(i + 1), total: num(qs.length) }) + "</span>" + stepsHTML(qs) +
      '<p class="qtext" dir="auto">' + esc(AW.pick(q.question_ar, q.question_en)) + '</p><div class="opts">' + opts + "</div>" +
      '<div class="result ' + (r.correct ? "ok" : "bad") + '"><h2>' + head + "</h2>" + body + "</div>" +
      '<button class="btn block" style="margin-top:14px" data-act="next">' + (more ? t("nextQ") : t("seeSummary")) + "</button></section>";
  }

  function doneCard(p) {
    const right = p.questions.filter(function (q) { return q.result && q.result.correct; }).length;
    return '<section class="card quest donecard"><div class="big" aria-hidden="true">🎉</div><h2>' + t("doneTitle") + "</h2>" + stepsHTML(p.questions) +
      '<div class="stats"><div class="stat"><span>' + t("correctCount") + "</span><b>" + num(right) + "/" + num(p.total) + "</b></div>" +
      '<div class="stat"><span>' + t("earnedToday") + "</span><b>" + coin + " " + num(p.points) + "</b></div></div>" +
      '<p class="next">' + t("nextQuizIn") + ' <b id="nextin"></b></p>' +
      '<button class="btn ghost sm" data-act="share">' + t("share") + "</button></section>";
  }

  function homeHTML() { return meCard() + rankCard() + quizHTML(); }

  /* ---- home data ---- */
  function setPlay(p) {
    S.play = p;
    const open = p && p.questions && p.questions.find(function (q) { return q.status === "open"; });
    S.deadline = open ? Date.now() + open.seconds_left * 1000 : 0;
  }
  async function loadPlay() { setPlay(await api.playState()); }

  async function loadRanks(announce) {
    const r = await api.myRanks(S.rankPeriod);
    const key = "aw_rank_" + (S.me && S.me.id) + "_" + S.rankPeriod;
    let prev = null;
    try { prev = JSON.parse(AW.ls.get(key)); } catch (e) { prev = null; }
    const up = {};
    if (prev) {
      if (r.group && prev.group && r.group < prev.group) up.group = prev.group - r.group;
      if (r.team && prev.team && r.team < prev.team) up.team = prev.team - r.team;
    }
    S.ranks = r;
    S.rankUp = (up.group || up.team) ? up : null;
    AW.ls.set(key, JSON.stringify({ group: r.group, team: r.team }));
    if (S.view === "home") render();
    if (S.rankUp && announce !== false) { confetti(); toast(t("rankedUp", { n: num(up.group || up.team) })); }
  }

  /* ---- timers ---- */
  function startTimers() {
    clearInterval(S.timer); S.timer = null;
    if (S.view !== "home" || !S.play || S.play.status !== "ok") return;
    const open = S.play.questions.find(function (q) { return q.status === "open"; });
    if (open && !S.last) {
      const total = Math.max(1, open.time_limit);
      const upd = function () {
        const bar = $("#tbar"), tx = $("#ttxt"); if (!bar || !tx) return;
        const left = Math.max(0, (S.deadline - Date.now()) / 1000);
        bar.style.width = (left / total * 100) + "%";
        bar.classList.toggle("low", left < total * 0.3);
        tx.textContent = left > 0 ? num(Math.ceil(left)) + " " + t("sec") : t("noBonus");
        if (left <= 0 && !S.busy) { clearInterval(S.timer); answerQuestion(-1); }
      };
      upd(); S.timer = setInterval(upd, 200);
    } else if (!S.play.questions.some(function (q) { return q.status === "ready" || q.status === "locked" || q.status === "open"; }) && !S.last) {
      const upd = function () { const el = $("#nextin"); if (el) el.textContent = AW.fmtHMS(AW.msUntilMidnight()); };
      upd(); S.timer = setInterval(upd, 1000);
    }
  }

  async function answerQuestion(i) {
    const q = S.play && S.play.questions.find(function (x) { return x.status === "open"; });
    if (!q || S.busy) return;
    S.busy = true; clearInterval(S.timer);
    $$(".opt").forEach(function (b) { b.disabled = true; });
    try {
      const before = AW.levelOf(S.me.earned);
      const r = await api.submit(q.id, i);
      S.last = { qid: q.id, timeout: i < 0 };
      await refreshMe();
      setPlay(await api.playState());
      S.busy = false; render();
      if (r.correct) confetti();
      const after = AW.levelOf(S.me.earned);
      if (after > before) setTimeout(function () { toast(t("levelUp", { n: num(after) })); }, 700);
      await loadRanks();
    } catch (e) {
      S.busy = false; toast(AW.errText(e));
      try { await loadPlay(); } catch (e2) { /* ignore */ }
      render();
    }
  }

  /* ============================================================
     Rankings
     ============================================================ */
  function ranksHTML() {
    const L = S.lb;
    const comps = S.comps || [];
    const seg = function (items, cur, act) {
      return items.map(function (x) { return '<button class="tab ' + (cur === x[0] ? "on" : "") + '" data-act="' + act + '" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("");
    };
    const scope = '<div class="tabs t2" role="tablist">' + seg([["group", t("scopeGroup")], ["team", t("scopeTeam")]], L.scope, "lbscope") + "</div>";
    const periods = L.comp ? "" : '<div class="tabs t4" role="tablist">' + seg([["day", t("pDay")], ["week", t("pWeek")], ["month", t("pMonth")], ["all", t("pAll")]], L.period, "lbperiod") + "</div>";
    const chips = comps.length
      ? '<div class="chips" role="tablist"><button class="chipb ' + (!L.comp ? "on" : "") + '" data-act="lbcomp" data-v="">' + t("compAll") + "</button>" +
        comps.map(function (c) { return '<button class="chipb ' + (L.comp === c.id ? "on" : "") + '" data-act="lbcomp" data-v="' + c.id + '">🏆 ' + esc(AW.pick(c.name_ar, c.name_en)) + "</button>"; }).join("") + "</div>"
      : "";
    let list;
    const rows = L.rows;
    if (!rows) list = '<p class="center muted">' + t("loading") + "</p>";
    else if (!rows.length) list = '<div class="card empty"><div class="big" aria-hidden="true">🏆</div><p class="muted">' + t("emptyBoard") + "</p></div>";
    else {
      const topN = rows.filter(function (r) { return r.rank_no <= 3; }).slice(0, 3);
      const usePodium = topN.length === 3 && rows.length >= 3 && topN[0].rank_no === 1 && topN[1].rank_no === 2 && topN[2].rank_no === 3;
      const inPod = usePodium ? topN : [];
      const rest = rows.filter(function (r) { return inPod.indexOf(r) < 0; });
      const you = function (r) { return r.is_me ? ' <span class="muted">(' + t("you") + ")</span>" : ""; };
      const pod = function (r) {
        return '<div class="pod p' + r.rank_no + (r.is_me ? " mine" : "") + '">' + (r.rank_no === 1 ? '<span class="crown" aria-hidden="true">👑</span>' : "") +
          AW.avatar.face(r, r.rank_no === 1 ? 84 : 64) + '<span class="nm">' + esc(r.display_name) + you(r) + '</span><span class="tm">' + AW.teamIcon(r.team) + "</span>" +
          '<span class="pt">' + num(r.points) + "<small>" + t("pts") + '</small></span><div class="plinth">' + num(r.rank_no) + "</div></div>";
      };
      list = (usePodium ? '<div class="podium">' + [topN[1], topN[0], topN[2]].map(pod).join("") + "</div>" : "") +
        (rest.length ? '<div class="lb">' + rest.map(function (r) {
          return '<div class="row ' + (r.is_me ? "mine" : "") + '"><span class="rank">' + num(r.rank_no) + "</span>" + AW.avatar.face(r, 44) +
            '<span class="nm">' + esc(r.display_name) + you(r) + '<small class="tm">' + AW.teamLabel(r.team) + "</small></span>" +
            '<span class="pt">' + num(r.points) + "<small>" + t("pts") + "</small></span></div>";
        }).join("") + "</div>" : "");
    }
    return scope + periods + chips + list;
  }
  async function loadComps() { try { S.comps = await api.competitions(false); } catch (e) { S.comps = []; } }
  async function loadLB() {
    const L = S.lb, snap = L.scope + L.period + L.comp;
    L.rows = null; if (S.view === "rank") render();
    try {
      const rows = await api.leaderboard(L.scope, L.period, L.comp);
      if (snap === L.scope + L.period + L.comp) L.rows = rows;
    } catch (e) { toast(AW.errText(e)); L.rows = []; }
    if (S.view === "rank") render();
  }

  /* ============================================================
     Wallet and shop
     ============================================================ */
  function itemPreview(it) {
    if (it.kind === "avatar") return AW.avatar.thumb(it.avatar_cat, it.avatar_index, S.me && S.me.avatar, 56);
    return '<span class="ibig" aria-hidden="true">' + (it.kind === "photo" ? "📷" : "🎁") + "</span>";
  }
  function walletHTML() {
    const m = S.me, spent = Math.max(0, m.earned - m.balance);
    const head = '<section class="card walletcard"><div class="wbig">' + coin + '<div><span class="muted">' + t("yourBalance") + "</span><b>" + num(m.balance) + " <small>" + t("waadoz") + "</small></b></div></div>" +
      '<div class="stats"><div class="stat"><span>' + t("earned") + "</span><b>" + num(m.earned) + '</b></div><div class="stat"><span>' + t("spent") + "</span><b>" + num(spent) + "</b></div></div></section>";
    const tabs = '<div class="tabs t2" role="tablist"><button class="tab ' + (S.walletTab === "shop" ? "on" : "") + '" data-act="wtab" data-v="shop">' + t("shopTab") + '</button><button class="tab ' + (S.walletTab === "history" ? "on" : "") + '" data-act="wtab" data-v="history">' + t("historyTab") + "</button></div>";
    let body;
    if (S.walletTab === "history") {
      const h = S.history;
      if (!h) body = '<p class="center muted">' + t("loading") + "</p>";
      else if (!h.length) body = '<div class="card empty"><p class="muted">' + t("historyEmpty") + "</p></div>";
      else body = '<div class="hist">' + h.map(function (x) {
        const label = x.kind === "answer" ? t("tx_answer") : x.kind === "admin" ? t("tx_admin") : x.kind === "refund" ? t("tx_refund") : t("tx_purchase");
        return '<div class="hrow"><div><b>' + label + "</b>" + (x.note ? '<small class="muted"> ' + esc(x.note) + "</small>" : "") + '<small class="muted d">' + AW.fmtDate(x.tx_date) + '</small></div><span class="amt ' + (x.amount < 0 ? "neg" : "pos") + '">' + (x.amount < 0 ? "−" : "+") + num(Math.abs(x.amount)) + "</span></div>";
      }).join("") + "</div>";
    } else {
      const items = S.shop;
      if (!items) body = '<p class="center muted">' + t("loading") + "</p>";
      else if (!items.length) body = '<div class="card empty"><p class="muted">' + t("shopEmpty") + "</p></div>";
      else body = '<div class="shop">' + items.map(function (it) {
        const name = AW.pick(it.name_ar, it.name_en), desc = AW.pick(it.description_ar, it.description_en);
        let btn;
        if (it.owned) btn = it.kind === "avatar" ? '<button class="btn ghost sm" data-act="nav" data-v="profile">' + t("wear") + "</button>" : '<span class="own">✓ ' + t("owned") + "</span>";
        else if (it.stock != null && it.stock <= 0) btn = '<span class="own off">' + t("soldOut") + "</span>";
        else if (m.balance < it.price) btn = '<button class="btn sm" disabled>' + t("missing", { n: num(it.price - m.balance) }) + "</button>";
        else if (S.confirmBuy === it.id) btn = '<button class="btn sm go" data-act="buy" data-id="' + it.id + '">' + t("confirmBuy") + "</button>";
        else btn = '<button class="btn sm" data-act="buy" data-id="' + it.id + '">' + t("buy") + "</button>";
        return '<article class="item' + (it.owned ? " has" : "") + '"><div class="ipv">' + itemPreview(it) + '</div><h3>' + esc(name) + "</h3>" +
          (desc ? '<p class="muted small">' + esc(desc) + "</p>" : "") +
          (it.stock != null ? '<p class="muted small">' + t("stockLeft", { n: num(it.stock) }) + "</p>" : "") +
          '<div class="irow"><span class="price">' + coin + " " + num(it.price) + "</span>" + btn + "</div></article>";
      }).join("") + "</div>";
    }
    return head + tabs + body;
  }
  async function loadShop() { try { S.shop = await api.shopList(); } catch (e) { toast(AW.errText(e)); S.shop = []; } }
  async function loadHistory() { try { S.history = await api.walletHistory(); } catch (e) { toast(AW.errText(e)); S.history = []; } }

  /* ============================================================
     Profile: details, avatar, photo, portfolio
     ============================================================ */
  function gateFor(cat, idx) {
    return (S.shop || []).find(function (i) { return i.kind === "avatar" && i.avatar_cat === cat && i.avatar_index === idx; });
  }
  function avatarEditor() {
    const d = S.av || {};
    const rows = AW.avatar.CATS.map(function (k) {
      const items = [];
      for (let i = 0; i < AW.avatar.COUNTS[k]; i++) {
        const g = gateFor(k, i), lock = !!g && !g.owned, on = d[k] === i;
        items.push('<button type="button" class="pk ' + (on ? "on" : "") + (lock ? " locked" : "") + '" data-act="pick" data-k="' + k + '" data-i="' + i + '" aria-pressed="' + on + '"' + (lock ? ' aria-label="' + esc(t("lockedPrice", { n: num(g.price) })) + '"' : "") + ">" +
          AW.avatar.thumb(k, i, d, 46) + (lock ? '<span class="lk">🔒 ' + num(g.price) + "</span>" : "") + "</button>");
      }
      return '<div class="picker"><h3>' + t("cat_" + k) + '</h3><div class="opts-row">' + items.join("") + "</div></div>";
    }).join("");
    return '<section class="card"><h2 class="sec">' + t("myAvatar") + '</h2><div class="stage">' + AW.avatar.svg(d, 130) + "</div>" +
      '<div style="display:grid;gap:16px;margin-top:14px">' + rows + '<button class="btn block" data-act="saveavatar">' + t("saveAvatar") + "</button></div></section>";
  }
  function photoCard() {
    const m = S.me, g = (S.shop || []).find(function (i) { return i.kind === "photo"; });
    let inner;
    if (m.owns_photo) {
      inner = '<div class="photorow">' + (m.photo ? AW.avatar.face(m, 72) : '<span class="ibig" aria-hidden="true">📷</span>') +
        '<div><label class="btn sm filebtn">' + t("photoUpload") + '<input type="file" accept="image/*" data-change="photo" hidden></label>' +
        (m.photo ? ' <button class="btn ghost sm" data-act="photoremove">' + t("photoRemove") + "</button>" : "") + '</div></div><p class="muted small">' + t("photoNote") + "</p>";
    } else {
      inner = '<p class="muted">' + t("photoLocked", { n: g ? num(g.price) : "—" }) + '</p><button class="btn sm" data-act="goshop">' + t("openShop") + "</button>";
    }
    return '<section class="card"><h2 class="sec">' + t("myPhoto") + "</h2>" + inner + "</section>";
  }
  function portfolioCard() {
    const p = S.portfolio, f = S.pf;
    const list = !p ? '<p class="muted">' + t("loading") + "</p>" : !p.length ? '<p class="muted">' + t("emptyPortfolio") + "</p>" :
      '<ul class="pflist">' + p.map(function (x) {
        return '<li><span class="pfi" aria-hidden="true">' + (x.kind === "camp" ? "⛺" : "🎪") + '</span><div><b>' + esc(x.title) + "</b>" +
          '<small class="muted">' + (x.kind === "camp" ? t("camp") : t("event")) + (x.happened_on ? " · " + AW.fmtDate(x.happened_on) : "") + "</small>" +
          (x.notes ? '<small class="muted">' + esc(x.notes) + "</small>" : "") + '</div><button class="mini" data-act="pfdel" data-id="' + x.id + '" aria-label="' + t("remove") + '">✕</button></li>';
      }).join("") + "</ul>";
    return '<section class="card"><h2 class="sec">' + t("portfolioTitle") + '</h2><p class="muted small" style="margin-bottom:10px">' + t("portfolioHint") + "</p>" + list +
      '<form class="stack pfform" data-form="portfolio" novalidate><div class="seg"><button type="button" class="' + (f.kind === "camp" ? "on" : "") + '" data-act="pfkind" data-v="camp">⛺ ' + t("camp") + '</button><button type="button" class="' + (f.kind === "event" ? "on" : "") + '" data-act="pfkind" data-v="event">🎪 ' + t("event") + "</button></div>" +
      '<label class="f">' + t("pfName") + '<input type="text" maxlength="80" data-b="pf.title" value="' + esc(f.title) + '"></label>' +
      '<label class="f">' + t("pfDate") + '<input type="date" data-b="pf.date" value="' + esc(f.date) + '"></label>' +
      '<label class="f">' + t("pfNotes") + '<input type="text" maxlength="300" data-b="pf.notes" value="' + esc(f.notes) + '"></label>' +
      '<button class="btn block" type="submit">' + t("add") + "</button></form></section>";
  }
  function profileHTML() {
    const m = S.me;
    return '<section class="card"><h2 class="sec">' + t("myInfo") + '</h2><div class="center" style="margin-bottom:12px">' + AW.avatar.face(m, 88) + "</div>" +
      '<form class="stack" data-form="profile" novalidate>' + profileFields("pi") + '<button class="btn block" type="submit">' + t("save") + "</button></form></section>" +
      avatarEditor() + photoCard() + portfolioCard() +
      '<button class="btn ghost block" data-act="logout">' + t("logout") + "</button>";
  }
  AW.forms.profile = async function () {
    const v = validateProfile(S.pi);
    await api.saveProfile({ name: v.name, team: v.team, age: v.age, rank: S.pi.rank });
    const oldTeam = S.me.team;
    await refreshMe();
    if (oldTeam !== S.me.team) { S.play = null; S.ranks = null; }
    render(); toast(t("saved"));
  };
  AW.forms.portfolio = async function () {
    const f = S.pf;
    if (String(f.title).trim().length < 2) fail("E_TITLE");
    await api.portfolioAdd({ kind: f.kind, title: f.title, date: f.date || null, notes: f.notes });
    S.pf = { kind: f.kind, title: "", date: "", notes: "" };
    S.portfolio = await api.portfolioList();
    render(); toast(t("added"));
  };

  // shrink a chosen photo to a small square so it stays light
  function resizePhoto(file, size) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          const c = document.createElement("canvas"); c.width = c.height = size;
          const ctx = c.getContext("2d"), s = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL("image/jpeg", 0.72));
        } catch (e) { reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image")); };
      img.src = url;
    });
  }
  AW.changes.photo = async function (el) {
    const file = el.files && el.files[0]; if (!file) return;
    const data = await resizePhoto(file, 96);
    await api.setPhoto(data);
    await refreshMe(); render(); toast(t("photoSaved"));
  };

  /* ============================================================
     Navigation and data loading
     ============================================================ */
  async function enter(v) {
    S.view = v; S.confirmBuy = null; render();
    try {
      if (v === "home") {
        if (!S.play) { await loadPlay(); render(); }
        await loadRanks(false);
      } else if (v === "rank") {
        await loadComps(); render(); await loadLB();
      } else if (v === "wallet") {
        await refreshMe(); S.shop = null; S.history = null; render();
        await Promise.all([loadShop(), loadHistory()]); render();
      } else if (v === "profile") {
        S.pi = { name: S.me.display_name || "", team: S.me.team || "", age: S.me.age ? String(S.me.age) : "", rank: S.me.patrol_rank || "member" };
        S.av = Object.assign({}, AW.avatar.DEFAULT, S.me.avatar || {});
        render();
        await Promise.all([loadShop(), (async function () { S.portfolio = await api.portfolioList(); })()]); render();
      } else if (v === "admin" && AW.admin) {
        await AW.admin.enter();
      }
    } catch (e) { toast(AW.errText(e)); }
    window.scrollTo(0, 0);
  }
  AW.enter = enter;
  AW.refreshMe = refreshMe;

  /* ============================================================
     Actions
     ============================================================ */
  const A = AW.actions;
  A.lang = function () { AW.setLang(AW.lang === "ar" ? "en" : "ar"); render(); };
  A.nav = function (el) { return enter(el.dataset.v); };
  A.authmode = function (el) { S.af.mode = el.dataset.v; S.msg = ""; render(); };
  A.logout = async function () {
    await api.signOut();
    S.user = null; S.me = null; S.play = null; S.last = null; S.ranks = null; S.view = "home"; S.af.password = ""; render();
  };
  A.rankperiod = async function (el) { S.rankPeriod = el.dataset.v; AW.ls.set("aw_rp", S.rankPeriod); S.ranks = null; S.rankUp = null; render(); await loadRanks(false); };
  A.start = async function () {
    if (S.busy) return; S.busy = true;
    try { S.last = null; setPlay(await api.openQuestion()); } finally { S.busy = false; }
    render();
  };
  A.next = async function () {
    if (S.busy) return;
    S.last = null;
    const more = S.play && S.play.questions.some(function (q) { return q.status === "ready"; });
    if (more) return A.start();
    render();
  };
  A.answer = function (el) { return answerQuestion(parseInt(el.dataset.i, 10)); };
  A.share = async function () {
    const data = { title: t("app"), text: t("shareText"), url: location.href.split("#")[0] };
    if (navigator.share) { try { await navigator.share(data); } catch (e) { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(data.url); toast(t("copied")); } catch (e) { toast(data.url); } }
  };
  A.lbscope = function (el) { S.lb.scope = el.dataset.v; return loadLB(); };
  A.lbperiod = function (el) { S.lb.period = el.dataset.v; return loadLB(); };
  A.lbcomp = function (el) { S.lb.comp = el.dataset.v ? parseInt(el.dataset.v, 10) : null; return loadLB(); };
  A.wtab = function (el) { S.walletTab = el.dataset.v; S.confirmBuy = null; render(); };
  A.buy = async function (el) {
    const id = parseInt(el.dataset.id, 10);
    if (S.confirmBuy !== id) { S.confirmBuy = id; render(); return; }
    S.confirmBuy = null;
    const it = (S.shop || []).find(function (x) { return x.id === id; });
    await api.buy(id);
    await refreshMe(); await Promise.all([loadShop(), loadHistory()]);
    render(); confetti(); toast(t("bought", { name: it ? AW.pick(it.name_ar, it.name_en) : "" }));
  };
  A.goshop = function () { S.walletTab = "shop"; return enter("wallet"); };
  A.pick = function (el) {
    if (el.classList.contains("locked")) {
      const g = gateFor(el.dataset.k, parseInt(el.dataset.i, 10));
      toast(t("lockedPrice", { n: g ? num(g.price) : "" })); return;
    }
    S.av[el.dataset.k] = parseInt(el.dataset.i, 10); render();
  };
  A.saveavatar = async function () { await api.saveAvatar(S.av); await refreshMe(); render(); toast(t("saved")); };
  A.photoremove = async function () { await api.setPhoto(null); await refreshMe(); render(); toast(t("saved")); };
  A.pfkind = function (el) { S.pf.kind = el.dataset.v; render(); };
  A.pfdel = async function (el) { await api.portfolioDelete(parseInt(el.dataset.id, 10)); S.portfolio = await api.portfolioList(); render(); toast(t("removed")); };
  A.reload = function () { location.reload(); };

  /* ---- events ---- */
  document.addEventListener("click", async function (e) {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const fn = AW.actions[el.dataset.act]; if (!fn) return;
    try { await fn(el, e); } catch (err) { toast(AW.errText(err)); }
  });
  document.addEventListener("submit", async function (e) {
    const f = e.target.closest("form[data-form]"); if (!f) return;
    e.preventDefault();
    const fn = AW.forms[f.dataset.form]; if (!fn) return;
    try { await fn(f); } catch (err) { toast(AW.errText(err)); }
  });
  function bind(e) {
    const el = e.target, p = el && el.dataset && el.dataset.b; if (!p) return;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.dataset.num !== undefined) v = AW.digits(v);
    AW.setPath(S, p, v);
    if (e.type === "change" && el.dataset.re !== undefined) render();
  }
  document.addEventListener("input", bind);
  document.addEventListener("change", async function (e) {
    bind(e);
    const el = e.target, ch = el && el.dataset && el.dataset.change;
    if (ch && AW.changes[ch]) { try { await AW.changes[ch](el); } catch (err) { toast(AW.errText(err)); } }
  });

  /* ============================================================
     Render and start
     ============================================================ */
  function render() {
    clearInterval(S.timer);
    document.documentElement.lang = AW.lang;
    document.documentElement.dir = AW.lang === "ar" ? "rtl" : "ltr";
    document.title = t("app");
    const app = $("#app");
    // keep the page where it is when only the content changes
    const y = window.scrollY;
    if (S.booting) app.innerHTML = '<div class="auth"><div class="hero"><div class="sticker">' + logoImg("logo-lg") + '</div><p class="tagline">' + t("loading") + "</p></div></div>";
    else if (S.fatal) app.innerHTML = '<div class="auth"><div class="card empty"><h2>' + t("fatal") + '</h2><p class="muted">' + esc(S.fatal) + '</p><button class="btn" data-act="reload">' + t("retry") + "</button></div></div>";
    else if (!S.user || !S.me) app.innerHTML = authHTML();
    else if (!S.me.team) app.innerHTML = onboardHTML();
    else app.innerHTML = shellHTML();
    if (y) window.scrollTo(0, y);
    startTimers();
  }
  AW.render = render;

  async function boot() {
    try {
      if (AW.demo) api = AW.makeDemoApi();
      else {
        for (let i = 0; i < 40 && typeof window.supabase === "undefined"; i++) await new Promise(function (r) { setTimeout(r, 100); });
        api = AW.connectSupabase();
      }
      AW.api = api;
      S.user = await api.init();
      if (S.user) { await refreshMe(); S.pi = { name: S.me.display_name || "", team: S.me.team || "", age: S.me.age ? String(S.me.age) : "", rank: S.me.patrol_rank || "member" }; }
    } catch (e) { S.fatal = AW.errText(e); }
    S.booting = false; render();
    if (S.user && S.me && S.me.team) enter("home");
  }
  window.addEventListener("DOMContentLoaded", boot);
})();
