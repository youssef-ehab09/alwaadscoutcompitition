/* Al Waad: DEMO mode. Runs entirely in this browser (nothing is shared),
   so you can try every screen before connecting Supabase.
   It follows the same rules as the real database. */
(function () {
  "use strict";
  const AW = (window.AW = window.AW || {});

  const KEY = "aw_demo_v2";
  const ORDER = { easy: 1, medium: 2, hard: 3 };
  const TEAM_KEYS = AW.TEAMS.map(function (t) { return t.k; });
  const RANK_KEYS = AW.RANKS.map(function (t) { return t.k; });
  const AV_CATS = ["bg", "skin", "hairStyle", "hairColor", "eyes", "mouth", "accessory"];

  function err(code) { const e = new Error(code); e.code = code; return e; }
  const clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  const SEED_QUESTIONS = [
    { diff: "easy", ar: "ما هو شعار الكشافة؟", en: "What is the Scout motto?", pts: 100, time: 30, correct: 0,
      opts: [["كن مستعدًا", "Be Prepared"], ["اعمل بجد", "Work Hard"], ["دائمًا للأمام", "Always Forward"], ["الوعد أمانة", "A Promise Is Trust"]] },
    { diff: "medium", ar: "من هو مؤسس الحركة الكشفية؟", en: "Who founded the Scout movement?", pts: 150, time: 40, correct: 0,
      opts: [["بادن باول", "Baden-Powell"], ["إديسون", "Edison"], ["نيوتن", "Newton"], ["كولومبوس", "Columbus"]] },
    { diff: "hard", ar: "ما عاصمة اليابان؟", en: "What is the capital of Japan?", pts: 200, time: 60, correct: 0,
      opts: [["طوكيو", "Tokyo"], ["كيوتو", "Kyoto"], ["أوساكا", "Osaka"], ["سول", "Seoul"]] }
  ];

  const SEED_ITEMS = [
    ["photo", "صورتي الشخصية", "My own photo", "ارفع صورتك لتظهر بدل الأفاتار", "Upload your photo to show instead of the avatar", 500, null, null, true],
    ["avatar", "تاج الأبطال", "Champion crown", "تاج ذهبي للأبطال فقط", "A golden crown for champions", 400, "accessory", 3, true],
    ["avatar", "قبعة الساحر", "Wizard hat", "قبعة سحرية مميزة", "A special magic hat", 300, "accessory", 6, true],
    ["avatar", "أذنا الأرنب", "Bunny ears", "أذنان مرحتان", "Fun bunny ears", 200, "accessory", 5, true],
    ["avatar", "نظارة شمسية", "Sunglasses", "نظارة سوداء أنيقة", "Cool dark sunglasses", 150, "accessory", 2, true],
    ["avatar", "عيون النجوم", "Star eyes", "عيون لامعة كالنجوم", "Eyes that sparkle like stars", 120, "eyes", 4, true],
    ["avatar", "تسريحة الموهوك", "Mohawk hair", "تسريحة جريئة", "A bold hairstyle", 120, "hairStyle", 5, true],
    ["avatar", "شعر فضي", "Silver hair", "لون شعر فضي لامع", "Shiny silver hair color", 100, "hairColor", 6, true],
    ["avatar", "خلفية الليل", "Night background", "خلفية داكنة أنيقة", "A dark stylish background", 80, "bg", 7, true],
    ["reward", "هدية من متجر المركز", "Gift from the center shop", "تُسلَّم لك في المركز الكشفي", "Handed to you at the scout center", 1500, null, null, false]
  ];

  const BOY_NAMES = ["أحمد", "محمد", "يوسف", "عمر", "كريم", "زياد", "مصطفى", "آدم", "مروان", "إياد", "حسن", "ياسين"];
  const GIRL_NAMES = ["نور", "سلمى", "مريم", "ليلى", "جنى", "هدى", "فرح", "ملك", "رنا", "سارة", "هبة", "ياسمين"];
  const TEAM_GENDER = { buds: "x", cubs: "b", brownies: "g", scouts: "b", guides: "g", adv_scouts: "b", adv_guides: "g", rovers: "b", rover_girls: "g", leaders: "x" };

  function makeBots() {
    const bots = [];
    let n = 0;
    TEAM_KEYS.forEach(function (team, ti) {
      for (let j = 0; j < 2; j++) {
        const g = TEAM_GENDER[team];
        const list = g === "g" ? GIRL_NAMES : g === "b" ? BOY_NAMES : (n % 2 ? GIRL_NAMES : BOY_NAMES);
        const base = 300 + ((n * 211) % 1100);
        const month = Math.round(base * 1.6);
        bots.push({
          id: "bot" + n, name: list[(ti * 2 + j + n) % list.length], team: team,
          avatar: AW.avatar.random(n * 7919 + 13), hidden: false,
          pts: { day: n % 3 === 0 ? 0 : 100 + ((n * 53) % 250), week: base, month: month, all: month * 3 },
          comp: { 1: Math.round(month * 0.8) },
          age: 9, patrol_rank: j === 0 ? "leader" : "member", created: "2026-09-" + String(1 + (n % 28)).padStart(2, "0")
        });
        n++;
      }
    });
    return bots;
  }

  function blank() {
    const today = AW.todayStr();
    return {
      v: 2, user: null, me: null, seq: 1000, seededDay: null,
      tx: [], answers: {}, purchases: [], portfolio: [],
      questions: [],
      competitions: [{ id: 1, name_ar: "أبطال أكتوبر", name_en: "October Champions", starts_on: today.slice(0, 8) + "01", ends_on: AW.addDays(today.slice(0, 8) + "01", 30) }],
      items: SEED_ITEMS.map(function (r, i) {
        return { id: i + 1, kind: r[0], name_ar: r[1], name_en: r[2], description_ar: r[3], description_en: r[4], price: r[5], avatar_cat: r[6], avatar_index: r[7], stock: null, active: r[8], sort: i + 1 };
      }),
      bots: makeBots()
    };
  }

  AW.makeDemoApi = function () {
    let D = null;
    const today = function () { return AW.todayStr(); };
    const save = function () { AW.ls.set(KEY, JSON.stringify(D)); };
    const nextId = function () { return ++D.seq; };

    function seedDay() {
      const t = today();
      if (D.seededDay === t) return;
      if (!D.questions.some(function (q) { return q.quiz_date === t; })) {
        SEED_QUESTIONS.forEach(function (s, i) {
          D.questions.push({
            id: nextId(), quiz_date: t, pos: i + 1, difficulty: s.diff, competition_id: 1, teams: [],
            question_ar: s.ar, question_en: s.en, options: s.opts.map(function (o) { return { ar: o[0], en: o[1] }; }),
            correct_index: s.correct, base_points: s.pts, time_limit: s.time
          });
        });
      }
      D.seededDay = t;
    }
    function load() {
      try { D = JSON.parse(AW.ls.get(KEY)); } catch (e) { D = null; }
      if (!D || D.v !== 2) D = blank();
      seedDay();
      save();
    }
    const requireMe = function () { if (!D.user || !D.me) throw err("E_AUTH"); };
    const requireAdmin = function () { requireMe(); if (D.me.role !== "owner" && D.me.role !== "admin") throw err("E_FORBIDDEN"); };

    // ---- wallet helpers ----
    const balance = function () { return D.tx.reduce(function (s, t) { return s + t.amount; }, 0); };
    const earnedAll = function () { return D.tx.filter(function (t) { return t.kind === "answer" || t.kind === "admin"; }).reduce(function (s, t) { return s + t.amount; }, 0); };
    const owns = function (item) {
      return D.purchases.some(function (p) { return p.status !== "refunded" && (p.item_id === item.id || (item.kind === "photo" && p.kind === "photo")); });
    };
    function periodFrom(p) {
      const t = today();
      return p === "day" ? t : p === "week" ? AW.addDays(t, -6) : p === "month" ? t.slice(0, 8) + "01" : "0000-00-00";
    }
    function myPoints(period, comp) {
      const from = periodFrom(period);
      return D.tx.filter(function (t) {
        return (t.kind === "answer" || t.kind === "admin") && t.date >= from && (!comp || t.comp === comp);
      }).reduce(function (s, t) { return s + t.amount; }, 0);
    }

    // ---- today's quiz ----
    function myQuestions() {
      return D.questions.filter(function (q) {
        return q.quiz_date === today() && (!q.teams.length || q.teams.indexOf(D.me.team) >= 0);
      }).sort(function (a, b) { return ORDER[a.difficulty] - ORDER[b.difficulty] || a.pos - b.pos || a.id - b.id; });
    }
    function build(open) {
      if (!D.me.team) return { status: "profile" };
      const qs = myQuestions(), out = [];
      let pending = false, done = 0, pts = 0;
      qs.forEach(function (q) {
        let a = D.answers[q.id];
        if (a && !a.answered && (Date.now() - a.started) / 1000 > q.time_limit + 3) {
          Object.assign(a, { answered: true, expired: true, correct: false, choice: null, base: 0, bonus: 0, streak_bonus: 0, points: 0 });
        }
        const head = { id: q.id, difficulty: q.difficulty, base_points: q.base_points, time_limit: q.time_limit };
        const full = Object.assign({}, head, { question_ar: q.question_ar, question_en: q.question_en, options: q.options });
        if (a && a.answered) {
          done++; pts += a.points;
          out.push(Object.assign({}, full, { status: "done", result: { correct: a.correct, expired: a.expired, choice: a.choice, correct_index: q.correct_index, points: a.points, base: a.base, bonus: a.bonus, streak_bonus: a.streak_bonus } }));
        } else if (a) {
          pending = true;
          out.push(Object.assign({}, full, { status: "open", seconds_left: Math.max(0, q.time_limit - (Date.now() - a.started) / 1000) }));
        } else if (!pending) {
          pending = true;
          if (open) {
            D.answers[q.id] = { started: Date.now(), answered: false };
            out.push(Object.assign({}, full, { status: "open", seconds_left: q.time_limit }));
          } else out.push(Object.assign({}, head, { status: "ready" }));
        } else out.push(Object.assign({}, head, { status: "locked" }));
      });
      save();
      return { status: qs.length ? "ok" : "none", date: today(), questions: out, total: qs.length, done: done, points: pts, streak: D.me.streak };
    }

    // ---- rankings ----
    function board(scope, period, comp) {
      const rows = [];
      D.bots.forEach(function (b) {
        if (b.hidden) return;
        if (scope === "team" && b.team !== D.me.team) return;
        const pts = comp ? (b.comp[comp] || 0) : b.pts[period];
        if (pts > 0) rows.push({ user_id: b.id, display_name: b.name, avatar: b.avatar, photo: null, team: b.team, points: pts, is_me: false });
      });
      if (!D.me.hidden && !(scope === "team" && !D.me.team)) {
        const pts = myPoints(period, comp);
        if (pts > 0) rows.push({ user_id: "me", display_name: D.me.display_name, avatar: D.me.avatar, photo: D.me.photo, team: D.me.team, points: pts, is_me: true });
      }
      rows.sort(function (a, b) { return b.points - a.points || a.display_name.localeCompare(b.display_name); });
      let rk = 0, prev = null;
      rows.forEach(function (r, i) { if (r.points !== prev) { rk = i + 1; prev = r.points; } r.rank_no = rk; });
      return rows.filter(function (r) { return r.rank_no <= 50 || r.is_me; });
    }

    function profileObj() {
      const m = D.me;
      return {
        id: "me", display_name: m.display_name, avatar: m.avatar, photo: m.photo, team: m.team, age: m.age,
        patrol_rank: m.patrol_rank, role: m.role, hidden: m.hidden, streak: m.streak, best_streak: m.best_streak,
        balance: balance(), earned: earnedAll(),
        owned: D.purchases.filter(function (p) { return p.status !== "refunded" && p.item_id; }).map(function (p) { return p.item_id; }),
        owns_photo: D.purchases.some(function (p) { return p.kind === "photo" && p.status !== "refunded"; }),
        email: D.user.email
      };
    }
    function createMe(email, meta) {
      D.user = { email: email };
      D.me = {
        display_name: (meta && meta.name) || email.split("@")[0].slice(0, 20),
        team: meta && TEAM_KEYS.indexOf(meta.team) >= 0 ? meta.team : null,
        age: meta && meta.age ? +meta.age : null, patrol_rank: meta && meta.rank ? meta.rank : "member",
        avatar: {}, photo: null, role: "owner", hidden: false, streak: 0, best_streak: 0, last_played: null
      };
      save();
    }
    function checkProfile(v) {
      const name = String(v.name || "").trim();
      if (name.length < 2 || name.length > 20) throw err("E_NAME");
      if (TEAM_KEYS.indexOf(v.team) < 0) throw err("E_TEAM");
      const age = +v.age;
      if (!age || age < 3 || age > 99) throw err("E_AGE");
      if (RANK_KEYS.indexOf(v.rank) < 0) throw err("E_RANK");
      return name;
    }
    function validateQuestion(it) {
      const o = it.options;
      if (!Array.isArray(o) || o.length < 2 || o.length > 4) throw err("E_OPTIONS");
      if (!(it.correct_index >= 0 && it.correct_index < o.length)) throw err("E_OPTIONS");
      if (!String(it.question_ar || "").trim() && !String(it.question_en || "").trim()) throw err("E_QTEXT");
      if (["easy", "medium", "hard"].indexOf(it.difficulty || "easy") < 0) throw err("E_BAD");
      const pts = it.base_points == null ? 100 : +it.base_points, tm = it.time_limit == null ? 30 : +it.time_limit;
      if (!(pts >= 1 && pts <= 10000) || !(tm >= 5 && tm <= 600)) throw err("E_BAD");
      if (!it.quiz_date) throw err("E_BAD");
      (it.teams || []).forEach(function (t) { if (TEAM_KEYS.indexOf(t) < 0) throw err("E_TEAM"); });
    }

    load();

    return {
      mode: "demo",

      // ----- accounts -----
      async init() { load(); return D.user ? { id: "me", email: D.user.email } : null; },
      async signUp(email, password, meta) { createMe(email, meta); return { id: "me", email: email }; },
      async signIn(email) {
        if (!D.me) createMe(email, null); else { D.user = { email: email }; save(); }
        return { id: "me", email: email };
      },
      async signOut() { D.user = null; save(); },

      // ----- the scout -----
      async me() { requireMe(); return profileObj(); },
      async saveProfile(v) {
        requireMe();
        const name = checkProfile(v);
        Object.assign(D.me, { display_name: name, team: v.team, age: +v.age, patrol_rank: v.rank });
        save();
      },
      async saveAvatar(a) {
        requireMe();
        if (!a || typeof a !== "object") throw err("E_BAD");
        Object.keys(a).forEach(function (k) {
          if (AV_CATS.indexOf(k) < 0 || typeof a[k] !== "number" || a[k] < 0 || a[k] > 30 || a[k] !== Math.floor(a[k])) throw err("E_BAD");
        });
        D.items.forEach(function (it) {
          if (it.active && it.kind === "avatar" && a[it.avatar_cat] === it.avatar_index && !owns(it)) throw err("E_LOCKED");
        });
        D.me.avatar = clone(a); save();
      },
      async setPhoto(p) {
        requireMe();
        if (p != null) {
          if (p.length > 40000 || p.indexOf("data:image/") !== 0) throw err("E_BADPHOTO");
          if (!D.purchases.some(function (x) { return x.kind === "photo" && x.status !== "refunded"; })) throw err("E_LOCKED");
        }
        D.me.photo = p || null; save();
      },
      async portfolioList() {
        requireMe();
        return clone(D.portfolio).sort(function (a, b) { return String(b.happened_on || "").localeCompare(String(a.happened_on || "")) || b.id - a.id; });
      },
      async portfolioAdd(v) {
        requireMe();
        const title = String(v.title || "").trim();
        if (["camp", "event"].indexOf(v.kind) < 0) throw err("E_BAD");
        if (title.length < 2 || title.length > 80) throw err("E_TITLE");
        D.portfolio.push({ id: nextId(), kind: v.kind, title: title, happened_on: v.date || null, notes: String(v.notes || "").trim().slice(0, 300) || null });
        save();
      },
      async portfolioDelete(id) { requireMe(); D.portfolio = D.portfolio.filter(function (p) { return p.id !== id; }); save(); },

      // ----- daily quiz -----
      async playState() { requireMe(); return build(false); },
      async openQuestion() { requireMe(); return build(true); },
      async submit(qid, choice) {
        requireMe();
        const q = myQuestions().find(function (x) { return x.id === qid; });
        if (!q) throw err("E_NOQ");
        const a = D.answers[qid];
        if (!a) throw err("E_NOTOPEN");
        if (a.answered) throw err("E_ANSWERED");
        const elapsed = (Date.now() - a.started) / 1000;
        const expired = elapsed > q.time_limit + 3;
        const ok = !expired && choice === q.correct_index;
        const t = today(), m = D.me;
        const streak = m.last_played === AW.addDays(t, -1) ? m.streak + 1 : (m.last_played === t ? m.streak : 1);
        let base = 0, bonus = 0, sb = 0;
        if (ok) {
          base = q.base_points;
          bonus = Math.round(q.base_points * 0.5 * Math.max(0, 1 - elapsed / Math.max(q.time_limit, 1)));
          const gotStreak = Object.keys(D.answers).some(function (k) { return D.answers[k].answered && D.answers[k].date === t && D.answers[k].streak_bonus > 0; });
          if (!gotStreak) sb = (Math.min(streak, 6) - 1) * 10;
        }
        const total = base + bonus + sb;
        Object.assign(a, { answered: true, choice: choice, correct: ok, expired: expired, base: base, bonus: bonus, streak_bonus: sb, points: total, date: t });
        m.streak = streak; m.best_streak = Math.max(m.best_streak || 0, streak); m.last_played = t;
        if (total > 0) D.tx.push({ id: nextId(), amount: total, kind: "answer", comp: q.competition_id, note: null, date: t });
        save();
        return { correct: ok, expired: expired, choice: choice, correct_index: q.correct_index, points: total, base: base, bonus: bonus, streak_bonus: sb };
      },

      // ----- rankings -----
      async leaderboard(scope, period, comp) { requireMe(); return board(scope, period, comp || null); },
      async myRanks(period) {
        requireMe();
        const g = board("group", period, null).find(function (r) { return r.is_me; });
        const tm = board("team", period, null).find(function (r) { return r.is_me; });
        return { group: g ? g.rank_no : null, team: tm ? tm.rank_no : null, points: g ? g.points : null };
      },
      async competitions(all) {
        requireMe();
        const t = today();
        return clone(D.competitions).filter(function (c) { return all || c.starts_on <= t; }).sort(function (a, b) { return b.starts_on.localeCompare(a.starts_on) || b.id - a.id; }).slice(0, 12);
      },

      // ----- wallet and shop -----
      async walletHistory() {
        requireMe();
        return clone(D.tx).sort(function (a, b) { return b.id - a.id; }).slice(0, 40).map(function (t) { return { id: t.id, amount: t.amount, kind: t.kind, note: t.note, tx_date: t.date }; });
      },
      async shopList() {
        requireMe();
        return D.items.filter(function (i) { return i.active; }).sort(function (a, b) { return a.sort - b.sort || a.id - b.id; }).map(function (i) {
          return {
            id: i.id, kind: i.kind, name_ar: i.name_ar, name_en: i.name_en, description_ar: i.description_ar, description_en: i.description_en,
            price: i.price, avatar_cat: i.avatar_cat, avatar_index: i.avatar_index, stock: i.stock, owned: i.kind === "reward" ? false : owns(i)
          };
        });
      },
      async buy(itemId) {
        requireMe();
        const it = D.items.find(function (i) { return i.id === itemId && i.active; });
        if (!it) throw err("E_ITEM");
        if ((it.kind === "avatar" || it.kind === "photo") && owns(it)) throw err("E_OWNED");
        if (it.stock != null && it.stock <= 0) throw err("E_STOCK");
        if (balance() < it.price) throw err("E_NOFUNDS");
        if (it.stock != null) it.stock--;
        D.purchases.push({ id: nextId(), item_id: it.id, item_name: it.name_ar, kind: it.kind, price: it.price, status: it.kind === "reward" ? "pending" : "done" });
        D.tx.push({ id: nextId(), amount: -it.price, kind: "purchase", comp: null, note: it.name_ar, date: today() });
        save();
        return { ok: true, balance: balance() };
      },

      // ----- admin -----
      async adminSummary() {
        requireAdmin();
        return {
          scouts: D.bots.length + 1,
          active_today: 1 + 5,
          pending_orders: D.purchases.filter(function (p) { return p.kind === "reward" && p.status === "pending"; }).length
        };
      },
      async adminScouts() {
        requireAdmin();
        const bots = D.bots.map(function (b) {
          return { id: b.id, display_name: b.name, team: b.team, age: b.age, patrol_rank: b.patrol_rank, role: "player", hidden: b.hidden, has_photo: false, last_played: today(), created_at: b.created, email: "scout" + b.id.slice(3) + "@example.com", balance: Math.round(b.pts.all * 0.6), earned: b.pts.all };
        });
        const me = { id: "me", display_name: D.me.display_name, team: D.me.team, age: D.me.age, patrol_rank: D.me.patrol_rank, role: D.me.role, hidden: D.me.hidden, has_photo: !!D.me.photo, last_played: D.me.last_played, created_at: today(), email: D.user.email, balance: balance(), earned: earnedAll() };
        return [me].concat(bots);
      },
      async adminUpdateScout(v) {
        requireAdmin();
        const name = checkProfile(v);
        if (v.id === "me") { Object.assign(D.me, { display_name: name, team: v.team, age: +v.age, patrol_rank: v.rank, hidden: !!v.hidden }); }
        else {
          const b = D.bots.find(function (x) { return x.id === v.id; });
          if (b) Object.assign(b, { name: name, team: v.team, age: +v.age, patrol_rank: v.rank, hidden: !!v.hidden });
        }
        save();
      },
      async adminSetRole(id, role) {
        requireMe();
        if (D.me.role !== "owner") throw err("E_FORBIDDEN");
        if (["player", "admin"].indexOf(role) < 0) throw err("E_BAD");
        // demo: only the owner exists as a real account, so there is nothing to change
      },
      async adminAdjust(id, amount, note) {
        requireAdmin();
        if (!amount || Math.abs(amount) > 100000) throw err("E_BAD");
        if (id === "me") D.tx.push({ id: nextId(), amount: amount, kind: "admin", comp: null, note: String(note || "").slice(0, 80) || null, date: today() });
        else {
          const b = D.bots.find(function (x) { return x.id === id; });
          if (!b) throw err("E_BAD");
          ["day", "week", "month", "all"].forEach(function (k) { b.pts[k] = Math.max(0, b.pts[k] + amount); });
        }
        save();
      },
      async adminClearPhoto(id) { requireAdmin(); if (id === "me") { D.me.photo = null; save(); } },
      async adminQuestions(from) {
        requireAdmin();
        const f = from || today();
        return clone(D.questions).filter(function (q) { return q.quiz_date >= f; }).sort(function (a, b) {
          return a.quiz_date.localeCompare(b.quiz_date) || ORDER[a.difficulty] - ORDER[b.difficulty] || a.pos - b.pos || a.id - b.id;
        });
      },
      async adminSaveQuestions(items) {
        requireAdmin();
        if (!Array.isArray(items) || !items.length) throw err("E_BAD");
        items.forEach(validateQuestion);
        items.forEach(function (it, i) {
          const row = {
            quiz_date: it.quiz_date, pos: it.pos || i + 1, difficulty: it.difficulty || "easy", competition_id: it.competition_id || null,
            teams: clone(it.teams || []), question_ar: String(it.question_ar || "").trim() || null, question_en: String(it.question_en || "").trim() || null,
            options: clone(it.options), correct_index: it.correct_index, base_points: it.base_points == null ? 100 : +it.base_points, time_limit: it.time_limit == null ? 30 : +it.time_limit
          };
          const ex = it.id ? D.questions.find(function (q) { return q.id === it.id; }) : null;
          if (ex) Object.assign(ex, row); else D.questions.push(Object.assign({ id: nextId() }, row));
        });
        save();
        return items.length;
      },
      async adminDeleteQuestion(id) { requireAdmin(); D.questions = D.questions.filter(function (q) { return q.id !== id; }); delete D.answers[id]; save(); },
      async adminSaveCompetition(v) {
        requireAdmin();
        const ar = String(v.name_ar || "").trim();
        if (ar.length < 2 || ar.length > 60) throw err("E_NAME");
        if (!v.starts_on || !v.ends_on || v.ends_on < v.starts_on) throw err("E_DATES");
        const row = { name_ar: ar, name_en: String(v.name_en || "").trim() || null, starts_on: v.starts_on, ends_on: v.ends_on };
        if (v.id) { const c = D.competitions.find(function (x) { return x.id === v.id; }); if (c) Object.assign(c, row); }
        else D.competitions.push(Object.assign({ id: nextId() }, row));
        save();
      },
      async adminDeleteCompetition(id) {
        requireAdmin();
        D.competitions = D.competitions.filter(function (c) { return c.id !== id; });
        D.questions.forEach(function (q) { if (q.competition_id === id) q.competition_id = null; });
        D.tx.forEach(function (t) { if (t.comp === id) t.comp = null; });
        save();
      },
      async adminShopItems() {
        requireAdmin();
        return clone(D.items).sort(function (a, b) { return a.sort - b.sort || a.id - b.id; }).map(function (i) {
          i.sold = D.purchases.filter(function (p) { return p.item_id === i.id && p.status !== "refunded"; }).length;
          i.created_at = today();
          return i;
        });
      },
      async adminSaveItem(id, item) {
        requireAdmin();
        if (["avatar", "photo", "reward"].indexOf(item.kind) < 0) throw err("E_BAD");
        if (!String(item.name_ar || "").trim()) throw err("E_NAME");
        const price = +item.price;
        if (!(price >= 0) || price > 1000000) throw err("E_BAD");
        if (item.kind === "avatar" && (AV_CATS.indexOf(item.avatar_cat) < 0 || !(item.avatar_index >= 0 && item.avatar_index <= 30))) throw err("E_BAD");
        const row = {
          kind: item.kind, name_ar: String(item.name_ar).trim(), name_en: String(item.name_en || "").trim() || null,
          description_ar: String(item.description_ar || "").trim() || null, description_en: String(item.description_en || "").trim() || null,
          price: price, avatar_cat: item.kind === "avatar" ? item.avatar_cat : null, avatar_index: item.kind === "avatar" ? +item.avatar_index : null,
          stock: item.stock === "" || item.stock == null ? null : +item.stock, active: item.active !== false
        };
        if (id) { const it = D.items.find(function (x) { return x.id === id; }); if (it) Object.assign(it, row); }
        else D.items.push(Object.assign({ id: nextId(), sort: D.items.length + 1 }, row));
        save();
      },
      async adminDeleteItem(id) { requireAdmin(); D.items = D.items.filter(function (i) { return i.id !== id; }); save(); },
      async adminOrders() {
        requireAdmin();
        return D.purchases.filter(function (p) { return p.kind === "reward" && p.status === "pending"; }).map(function (p) {
          return { id: p.id, display_name: D.me.display_name, team: D.me.team, item_name: p.item_name, price: p.price, created_at: today() };
        });
      },
      async adminDeliver(id) { requireAdmin(); const p = D.purchases.find(function (x) { return x.id === id; }); if (p) p.status = "delivered"; save(); }
    };
  };
})();
