/* Al Waad: admin screens (quiz builder, competitions, scouts, shop, orders) */
(function () {
  "use strict";
  const AW = window.AW, t = AW.t, esc = AW.esc, num = AW.num;
  Object.assign(AW.T, {
    a_summary: ["ملخص", "Summary"], a_scouts: ["الأعضاء", "Scouts"], a_activeToday: ["لعبوا اليوم", "Played today"], a_pending: ["طلبات تنتظر التسليم", "Pending orders"],
    a_tab_quiz: ["الأسئلة", "Quiz"], a_tab_scouts: ["الأعضاء", "Scouts"], a_tab_comps: ["المسابقات", "Seasons"], a_tab_shop: ["المتجر", "Shop"], a_tab_orders: ["الطلبات", "Orders"],
    a_newQuiz: ["أسئلة جديدة", "New questions"], a_editQ: ["تعديل سؤال", "Edit question"], a_date: ["تاريخ الأسئلة", "Quiz date"], a_comp: ["المسابقة", "Competition"], a_none: ["بدون", "None"],
    a_teams: ["الفرق (بدون اختيار = الكل)", "Teams (none = all)"], a_allTeams: ["كل الفرق", "All teams"], a_addQ: ["+ سؤال", "+ Question"], a_saveQs: ["حفظ الأسئلة", "Save questions"],
    a_qText: ["نص السؤال", "Question"], a_qTextEn: ["السؤال بالإنجليزية (اختياري)", "English question (optional)"], a_optAr: ["الخيار", "Option"], a_optEn: ["بالإنجليزية", "English"],
    a_correct: ["الصحيح", "Correct"], a_points: ["النقاط", "Points"], a_time: ["الوقت بالثواني", "Seconds"], a_upcoming: ["الأسئلة القادمة", "Upcoming questions"],
    a_noUpcoming: ["لا توجد أسئلة قادمة", "No upcoming questions"], a_edit: ["تعديل", "Edit"], a_delete: ["حذف", "Delete"], a_sure: ["اضغط مرة أخرى للتأكيد", "Tap again to confirm"], a_cancel: ["إلغاء", "Cancel"],
    a_qSaved: ["تم حفظ الأسئلة", "Questions saved"], a_removeQ: ["إزالة", "Remove"],
    a_compName: ["اسم المسابقة", "Name"], a_compNameEn: ["الاسم بالإنجليزية", "English name"], a_starts: ["تبدأ", "Starts"], a_ends: ["تنتهي", "Ends"], a_newComp: ["مسابقة جديدة", "New season"], a_noComps: ["لا توجد مسابقات", "No seasons yet"],
    a_search: ["ابحث بالاسم أو البريد", "Search name or email"], a_hide: ["إخفاء من الترتيب", "Hide from rankings"], a_role: ["الصلاحية", "Role"], a_player: ["عضو", "Player"], a_admin: ["مدير", "Admin"], a_owner: ["المالك", "Owner"],
    a_adjust: ["إضافة / خصم وعدوز", "Add / remove Waadoz"], a_amount: ["المبلغ (سالب للخصم)", "Amount (negative to remove)"], a_note: ["السبب", "Note"], a_apply: ["تنفيذ", "Apply"], a_clearPhoto: ["حذف صورته", "Delete photo"],
    a_close: ["إغلاق", "Close"], a_done: ["تم", "Done"], a_lastPlayed: ["آخر لعب", "Last played"], a_noScouts: ["لا يوجد أعضاء", "No scouts"],
    a_newItem: ["عنصر جديد", "New item"], a_kind: ["النوع", "Type"], a_k_avatar: ["قطعة شخصية", "Avatar piece"], a_k_photo: ["صورة شخصية", "Profile photo"], a_k_reward: ["جائزة حقيقية", "Real reward"],
    a_nameAr: ["الاسم", "Name"], a_nameEn: ["الاسم بالإنجليزية", "English name"], a_descAr: ["الوصف", "Description"], a_price: ["السعر", "Price"], a_stock: ["المخزون (فارغ = بلا حد)", "Stock (empty = unlimited)"],
    a_active: ["ظاهر في المتجر", "Shown in shop"], a_piece: ["القطعة", "Piece"], a_pieceIdx: ["رقم القطعة (يبدأ من ٠)", "Piece number (from 0)"], a_sold: ["مباع", "Sold"], a_off: ["مخفي", "Hidden"],
    a_noItems: ["لا توجد عناصر", "No items"], a_noOrders: ["لا توجد طلبات", "No pending orders"], a_deliver: ["تم التسليم", "Delivered"], a_delivered: ["تم تسليم الطلب", "Order delivered"],
    a_adjusted: ["تم التنفيذ", "Applied"], a_roleSaved: ["تم تغيير الصلاحية", "Role changed"], a_deleted: ["تم الحذف", "Deleted"]
  });

  const S = AW.S, A = AW.actions, F = AW.forms;
  const api = function () { return AW.api; };
  const isOwner = function () { return S.me && S.me.role === "owner"; };
  const D = function () { return S.admin; };
  const dg = function (v) { return AW.digits(v); };
  const nm = function (ar, en) { return AW.pick(ar, en); };
  const DIFF_ORDER = ["easy", "medium", "hard"];

  function blankQ(diff) {
    const d = AW.DIFFS.find(function (x) { return x.k === diff; });
    return { id: null, difficulty: diff, base_points: String(d.points), time_limit: String(d.time), question_ar: "", question_en: "", options: [{ ar: "", en: "" }, { ar: "", en: "" }, { ar: "", en: "" }, { ar: "", en: "" }], correct_index: 0 };
  }
  function newQb() {
    return { date: AW.todayStr(), comp: "", teams: [], items: DIFF_ORDER.map(blankQ), editing: false };
  }
  D().tab = "quiz"; D().qb = newQb(); D().sure = null;

  /* ---------- html ---------- */
  function tabs() {
    const items = [["quiz", t("a_tab_quiz")], ["scouts", t("a_tab_scouts")], ["comps", t("a_tab_comps")], ["shop", t("a_tab_shop")], ["orders", t("a_tab_orders")]];
    return '<div class="tabs t5" role="tablist">' + items.map(function (i) {
      return '<button class="tab ' + (D().tab === i[0] ? "on" : "") + '" data-act="atab" data-v="' + i[0] + '">' + i[1] + (i[0] === "orders" && D().summary && D().summary.pending_orders ? ' <i class="dotn">' + num(D().summary.pending_orders) + "</i>" : "") + "</button>";
    }).join("") + "</div>";
  }
  function summary() {
    const s = D().summary; if (!s) return "";
    return '<div class="stats s3"><div class="stat"><span>' + t("a_scouts") + "</span><b>" + num(s.scouts) + '</b></div><div class="stat"><span>' + t("a_activeToday") + "</span><b>" + num(s.active_today) + '</b></div><div class="stat"><span>' + t("a_pending") + "</span><b>" + num(s.pending_orders) + "</b></div></div>";
  }
  const sureBtn = function (act, id, label) {
    const key = act + id, on = D().sure === key;
    return '<button class="btn ' + (on ? "go" : "ghost") + ' sm" data-act="' + act + '" data-id="' + id + '">' + (on ? t("a_sure") : label) + "</button>";
  };
  const field = function (label, path, val, extra) { return '<label class="f">' + label + '<input type="text" data-b="' + path + '" value="' + esc(val == null ? "" : val) + '" ' + (extra || "") + "></label>"; };

  function quizTab() {
    const q = D().qb, comps = D().comps || [];
    const teamChips = '<div class="chips">' + '<button type="button" class="chipb ' + (!q.teams.length ? "on" : "") + '" data-act="aallteams">' + t("a_allTeams") + "</button>" +
      AW.TEAMS.map(function (x) { return '<button type="button" class="chipb ' + (q.teams.indexOf(x.k) >= 0 ? "on" : "") + '" data-act="ateam" data-v="' + x.k + '">' + x.icon + " " + AW.teamName(x.k) + "</button>"; }).join("") + "</div>";
    const blocks = q.items.map(function (it, n) {
      const p = "admin.qb.items." + n;
      const opts = it.options.map(function (o, k) {
        return '<div class="optedit"><button type="button" class="radio ' + (it.correct_index === k ? "on" : "") + '" data-act="acorrect" data-n="' + n + '" data-k="' + k + '" aria-label="' + t("a_correct") + '" aria-pressed="' + (it.correct_index === k) + '">' + (it.correct_index === k ? "✓" : "") + "</button>" +
          '<input type="text" maxlength="120" placeholder="' + t("a_optAr") + " " + num(k + 1) + '" data-b="' + p + ".options." + k + '.ar" value="' + esc(o.ar) + '">' +
          '<input type="text" maxlength="120" dir="ltr" placeholder="' + t("a_optEn") + '" data-b="' + p + ".options." + k + '.en" value="' + esc(o.en) + '"></div>';
      }).join("");
      return '<div class="qblock diff-' + it.difficulty + '"><div class="qb-head"><b>' + num(n + 1) + " · " + AW.diffName(it.difficulty) + "</b>" +
        (q.editing ? "" : '<button type="button" class="mini" data-act="aremoveq" data-n="' + n + '" aria-label="' + t("a_removeQ") + '">✕</button>') + "</div>" +
        (q.editing ? "" : '<div class="seg sm">' + AW.DIFFS.map(function (d) { return '<button type="button" class="' + (it.difficulty === d.k ? "on" : "") + '" data-act="adiff" data-n="' + n + '" data-v="' + d.k + '">' + AW.diffName(d.k) + "</button>"; }).join("") + "</div>") +
        field(t("a_qText"), p + ".question_ar", it.question_ar, 'maxlength="300"') + field(t("a_qTextEn"), p + ".question_en", it.question_en, 'maxlength="300" dir="ltr"') +
        '<div class="opts-edit">' + opts + "</div>" +
        '<div class="two"><label class="f">' + t("a_points") + '<input type="text" inputmode="numeric" data-b="' + p + '.base_points" value="' + esc(it.base_points) + '"></label><label class="f">' + t("a_time") + '<input type="text" inputmode="numeric" data-b="' + p + '.time_limit" value="' + esc(it.time_limit) + '"></label></div></div>';
    }).join("");
    const up = D().upcoming;
    const upList = !up ? "" : '<h3 class="sec">' + t("a_upcoming") + "</h3>" + (!up.length ? '<p class="muted">' + t("a_noUpcoming") + "</p>" : '<ul class="alist">' + up.map(function (x) {
      return '<li><div><b dir="auto">' + esc(nm(x.question_ar, x.question_en)) + '</b><small class="muted">' + AW.fmtDate(x.quiz_date) + " · " + AW.diffName(x.difficulty) + " · " + (x.teams && x.teams.length ? x.teams.map(AW.teamName).join("، ") : t("a_allTeams")) + '</small></div><div class="acts"><button class="btn ghost sm" data-act="aeditq" data-id="' + x.id + '">' + t("a_edit") + "</button>" + sureBtn("adelq", x.id, t("a_delete")) + "</div></li>";
    }).join("") + "</ul>");
    return '<section class="card"><h2 class="sec">' + (q.editing ? t("a_editQ") : t("a_newQuiz")) + '</h2><form class="stack" data-form="aquiz" novalidate>' +
      '<div class="two"><label class="f">' + t("a_date") + '<input type="date" data-b="admin.qb.date" value="' + esc(q.date) + '"></label>' +
      '<label class="f">' + t("a_comp") + '<select data-b="admin.qb.comp"><option value="">' + t("a_none") + "</option>" + comps.map(function (c) { return '<option value="' + c.id + '"' + (String(q.comp) === String(c.id) ? " selected" : "") + ">" + esc(nm(c.name_ar, c.name_en)) + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="f">' + t("a_teams") + teamChips + "</div>" + blocks +
      '<div class="acts">' + (q.editing ? "" : '<button type="button" class="btn ghost" data-act="aaddq">' + t("a_addQ") + "</button>") + (q.editing ? '<button type="button" class="btn ghost" data-act="acancelq">' + t("a_cancel") + "</button>" : "") + '<button class="btn" type="submit">' + t("a_saveQs") + "</button></div></form></section>" + upList;
  }

  function scoutsTab() {
    const list = D().scouts, q = (D().search || "").trim().toLowerCase();
    if (!list) return '<p class="center muted">' + t("loading") + "</p>";
    const rows = list.filter(function (s) { return !q || (s.display_name || "").toLowerCase().indexOf(q) >= 0 || (s.email || "").toLowerCase().indexOf(q) >= 0; }).slice(0, 100);
    const sel = D().sel;
    let detail = "";
    if (sel) {
      detail = '<section class="card selcard"><h2 class="sec">' + esc(sel._orig.display_name) + ' <small class="muted" dir="ltr">' + esc(sel._orig.email || "") + "</small></h2>" +
        '<form class="stack" data-form="ascout" novalidate>' + field(t("name"), "admin.sel.display_name", sel.display_name, 'maxlength="20"') +
        '<label class="f">' + t("team") + '<select data-b="admin.sel.team">' + AW.teamOptions(sel.team) + "</select></label>" +
        '<div class="two">' + field(t("age"), "admin.sel.age", sel.age, 'inputmode="numeric" maxlength="2"') + '<label class="f">' + t("rank") + '<select data-b="admin.sel.patrol_rank">' + AW.rankOptions(sel.patrol_rank) + "</select></label></div>" +
        '<label class="chk"><input type="checkbox" data-b="admin.sel.hidden"' + (sel.hidden ? " checked" : "") + "> " + t("a_hide") + '</label><button class="btn" type="submit">' + t("save") + "</button></form>" +
        (isOwner() && sel._orig.role !== "owner" ? '<div class="stack" style="margin-top:12px"><label class="f">' + t("a_role") + '<select data-b="admin.sel.role" data-change="arole"><option value="player"' + (sel.role === "player" ? " selected" : "") + ">" + t("a_player") + '</option><option value="admin"' + (sel.role === "admin" ? " selected" : "") + ">" + t("a_admin") + "</option></select></label></div>" : "") +
        '<form class="stack" data-form="aadjust" style="margin-top:12px" novalidate><b>' + t("a_adjust") + "</b>" + field(t("a_amount"), "admin.adj.amount", D().adj.amount, 'inputmode="numeric" dir="ltr"') + field(t("a_note"), "admin.adj.note", D().adj.note, 'maxlength="80"') + '<button class="btn" type="submit">' + t("a_apply") + "</button></form>" +
        '<div class="acts" style="margin-top:12px">' + (sel._orig.has_photo ? '<button class="btn ghost sm" data-act="aclrphoto">' + t("a_clearPhoto") + "</button>" : "") + '<button class="btn ghost sm" data-act="aclosesel">' + t("a_close") + "</button></div></section>";
    }
    return '<label class="f">' + t("a_search") + '<input type="search" data-b="admin.search" data-re value="' + esc(D().search || "") + '"></label>' + detail +
      (rows.length ? '<ul class="alist">' + rows.map(function (s) {
        return '<li class="clickable" data-act="aselscout" data-id="' + s.id + '"><div><b>' + esc(s.display_name) + (s.role !== "player" ? ' <span class="pill">' + (s.role === "owner" ? t("a_owner") : t("a_admin")) + "</span>" : "") + (s.hidden ? ' <span class="pill">' + t("a_off") + "</span>" : "") + '</b><small class="muted">' + AW.teamLabel(s.team) + " · " + (s.age ? num(s.age) : "—") + " · " + AW.rankName(s.patrol_rank) + '</small></div><span class="pill gold">' + AW.coin + " " + num(s.balance) + "</span></li>";
      }).join("") + "</ul>" : '<p class="muted center">' + t("a_noScouts") + "</p>");
  }

  function compsTab() {
    const c = D().cf, list = D().comps;
    const form = '<section class="card"><h2 class="sec">' + t("a_newComp") + '</h2><form class="stack" data-form="acomp" novalidate>' + field(t("a_compName"), "admin.cf.name_ar", c.name_ar, 'maxlength="60"') + field(t("a_compNameEn"), "admin.cf.name_en", c.name_en, 'maxlength="60" dir="ltr"') +
      '<div class="two"><label class="f">' + t("a_starts") + '<input type="date" data-b="admin.cf.starts_on" value="' + esc(c.starts_on) + '"></label><label class="f">' + t("a_ends") + '<input type="date" data-b="admin.cf.ends_on" value="' + esc(c.ends_on) + '"></label></div>' +
      '<div class="acts">' + (c.id ? '<button type="button" class="btn ghost" data-act="acancelcomp">' + t("a_cancel") + "</button>" : "") + '<button class="btn" type="submit">' + t("save") + "</button></div></form></section>";
    const ul = !list ? "" : !list.length ? '<p class="muted center">' + t("a_noComps") + "</p>" : '<ul class="alist">' + list.map(function (x) {
      return '<li><div><b>🏆 ' + esc(nm(x.name_ar, x.name_en)) + "</b><small class=\"muted\">" + AW.fmtDate(x.starts_on) + " → " + AW.fmtDate(x.ends_on) + '</small></div><div class="acts"><button class="btn ghost sm" data-act="aeditcomp" data-id="' + x.id + '">' + t("a_edit") + "</button>" + sureBtn("adelcomp", x.id, t("a_delete")) + "</div></li>";
    }).join("") + "</ul>";
    return form + ul;
  }

  function shopTab() {
    const f = D().itf, list = D().items;
    const pieces = f.kind === "avatar" ? '<div class="two"><label class="f">' + t("a_piece") + '<select data-b="admin.itf.avatar_cat">' + AW.avatar.CATS.map(function (k) { return '<option value="' + k + '"' + (f.avatar_cat === k ? " selected" : "") + ">" + t("cat_" + k) + "</option>"; }).join("") + "</select></label>" + field(t("a_pieceIdx"), "admin.itf.avatar_index", f.avatar_index, 'inputmode="numeric"') + "</div>" : "";
    const form = '<section class="card"><h2 class="sec">' + (f.id ? t("a_edit") : t("a_newItem")) + '</h2><form class="stack" data-form="aitem" novalidate>' +
      '<label class="f">' + t("a_kind") + '<select data-b="admin.itf.kind" data-re>' + ["avatar", "photo", "reward"].map(function (k) { return '<option value="' + k + '"' + (f.kind === k ? " selected" : "") + ">" + t("a_k_" + k) + "</option>"; }).join("") + "</select></label>" + pieces +
      field(t("a_nameAr"), "admin.itf.name_ar", f.name_ar, 'maxlength="60"') + field(t("a_nameEn"), "admin.itf.name_en", f.name_en, 'maxlength="60" dir="ltr"') + field(t("a_descAr"), "admin.itf.description_ar", f.description_ar, 'maxlength="200"') +
      '<div class="two">' + field(t("a_price"), "admin.itf.price", f.price, 'inputmode="numeric"') + field(t("a_stock"), "admin.itf.stock", f.stock, 'inputmode="numeric"') + "</div>" +
      '<label class="chk"><input type="checkbox" data-b="admin.itf.active"' + (f.active ? " checked" : "") + "> " + t("a_active") + '</label><div class="acts">' + (f.id ? '<button type="button" class="btn ghost" data-act="acancelitem">' + t("a_cancel") + "</button>" : "") + '<button class="btn" type="submit">' + t("save") + "</button></div></form></section>";
    const ul = !list ? "" : !list.length ? '<p class="muted center">' + t("a_noItems") + "</p>" : '<ul class="alist">' + list.map(function (i) {
      return '<li><div><b>' + esc(nm(i.name_ar, i.name_en)) + (i.active ? "" : ' <span class="pill">' + t("a_off") + "</span>") + '</b><small class="muted">' + t("a_k_" + i.kind) + " · " + AW.coin + " " + num(i.price) + " · " + t("a_sold") + " " + num(i.sold || 0) + '</small></div><div class="acts"><button class="btn ghost sm" data-act="aedititem" data-id="' + i.id + '">' + t("a_edit") + "</button>" + sureBtn("adelitem", i.id, t("a_delete")) + "</div></li>";
    }).join("") + "</ul>";
    return form + ul;
  }

  function ordersTab() {
    const o = D().orders;
    if (!o) return '<p class="center muted">' + t("loading") + "</p>";
    if (!o.length) return '<div class="card empty"><p class="muted">' + t("a_noOrders") + "</p></div>";
    return '<ul class="alist">' + o.map(function (x) {
      return '<li><div><b>🎁 ' + esc(x.item_name) + '</b><small class="muted">' + esc(x.display_name) + " · " + AW.teamLabel(x.team) + " · " + AW.fmtDate(x.created_at) + '</small></div><button class="btn sm" data-act="adeliver" data-id="' + x.id + '">' + t("a_deliver") + "</button></li>";
    }).join("") + "</ul>";
  }

  function html() {
    const tab = D().tab;
    return summary() + tabs() + (tab === "quiz" ? quizTab() : tab === "scouts" ? scoutsTab() : tab === "comps" ? compsTab() : tab === "shop" ? shopTab() : ordersTab());
  }

  /* ---------- data ---------- */
  async function load(tab) {
    const a = api();
    if (tab === "quiz") { const r = await Promise.all([a.competitions(true), a.adminQuestions(AW.todayStr())]); D().comps = r[0]; D().upcoming = r[1]; }
    else if (tab === "scouts") D().scouts = await a.adminScouts();
    else if (tab === "comps") D().comps = await a.competitions(true);
    else if (tab === "shop") D().items = await a.adminShopItems();
    else if (tab === "orders") D().orders = await a.adminOrders();
  }
  async function reloadTab() { await load(D().tab); D().summary = await api().adminSummary(); AW.render(); }

  AW.admin = {
    html: html,
    enter: async function () {
      D().adj = D().adj || { amount: "", note: "" };
      D().cf = D().cf || blankComp(); D().itf = D().itf || blankItem();
      AW.render();
      D().summary = await api().adminSummary(); await load(D().tab); AW.render();
    }
  };
  function blankComp() { const d = AW.todayStr(); return { id: null, name_ar: "", name_en: "", starts_on: d, ends_on: AW.addDays(d, 30) }; }
  function blankItem() { return { id: null, kind: "avatar", name_ar: "", name_en: "", description_ar: "", price: "100", stock: "", active: true, avatar_cat: "accessory", avatar_index: "0" }; }
  D().adj = { amount: "", note: "" }; D().cf = blankComp(); D().itf = blankItem();

  /* ---------- actions ---------- */
  A.atab = async function (el) { D().tab = el.dataset.v; D().sure = null; AW.render(); await reloadTab(); };
  A.aallteams = function () { D().qb.teams = []; AW.render(); };
  A.ateam = function (el) { const a = D().qb.teams, k = el.dataset.v, i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.push(k); AW.render(); };
  A.acorrect = function (el) { D().qb.items[+el.dataset.n].correct_index = +el.dataset.k; AW.render(); };
  A.adiff = function (el) { const it = D().qb.items[+el.dataset.n], d = AW.DIFFS.find(function (x) { return x.k === el.dataset.v; }); it.difficulty = d.k; it.base_points = String(d.points); it.time_limit = String(d.time); AW.render(); };
  A.aaddq = function () { if (D().qb.items.length >= 4) return; D().qb.items.push(blankQ("hard")); AW.render(); };
  A.aremoveq = function (el) { if (D().qb.items.length > 1) { D().qb.items.splice(+el.dataset.n, 1); AW.render(); } };
  A.acancelq = function () { D().qb = newQb(); AW.render(); };
  A.aeditq = function (el) {
    const q = D().upcoming.find(function (x) { return x.id === +el.dataset.id; }); if (!q) return;
    D().qb = { date: String(q.quiz_date).slice(0, 10), comp: q.competition_id || "", teams: (q.teams || []).slice(), editing: true, items: [{ id: q.id, pos: q.pos, difficulty: q.difficulty, base_points: String(q.base_points), time_limit: String(q.time_limit), question_ar: q.question_ar || "", question_en: q.question_en || "", correct_index: q.correct_index, options: [0, 1, 2, 3].map(function (i) { const o = (q.options || [])[i]; return { ar: (o && o.ar) || "", en: (o && o.en) || "" }; }) }] };
    AW.render(); window.scrollTo(0, 0);
  };
  A.adelq = async function (el) {
    const key = "adelq" + el.dataset.id; if (D().sure !== key) { D().sure = key; AW.render(); return; }
    D().sure = null; await api().adminDeleteQuestion(+el.dataset.id); AW.toast(t("a_deleted")); await reloadTab();
  };
  F.aquiz = async function () {
    const q = D().qb;
    const items = q.items.map(function (it, n) {
      const opts = it.options.map(function (o) { return { ar: o.ar.trim(), en: o.en.trim() }; }), idxMap = [], clean = [];
      opts.forEach(function (o, i) { if (o.ar || o.en) { idxMap[i] = clean.length; clean.push({ ar: o.ar || o.en, en: o.en || o.ar }); } });
      if (clean.length < 2 || idxMap[it.correct_index] == null) AW.fail("E_OPTIONS");
      return { id: it.id, quiz_date: q.date, pos: it.pos || n + 1, difficulty: it.difficulty, competition_id: q.comp ? +q.comp : null, teams: q.teams,
        question_ar: it.question_ar.trim(), question_en: it.question_en.trim(), options: clean, correct_index: idxMap[it.correct_index],
        base_points: parseInt(dg(it.base_points), 10) || 100, time_limit: parseInt(dg(it.time_limit), 10) || 30 };
    });
    await api().adminSaveQuestions(items);
    D().qb = newQb(); AW.toast(t("a_qSaved")); await reloadTab();
  };
  A.aselscout = function (el) {
    const s = D().scouts.find(function (x) { return x.id === el.dataset.id; }); if (!s) return;
    D().sel = Object.assign({}, s, { age: s.age ? String(s.age) : "", _orig: s }); D().adj = { amount: "", note: "" }; AW.render();
  };
  A.aclosesel = function () { D().sel = null; AW.render(); };
  F.ascout = async function () {
    const s = D().sel, age = parseInt(dg(s.age), 10);
    await api().adminUpdateScout({ id: s._orig.id, name: s.display_name, team: s.team, age: age || null, rank: s.patrol_rank, hidden: !!s.hidden });
    AW.toast(t("saved")); D().sel = null; await reloadTab();
  };
  AW.changes.arole = async function () {
    const s = D().sel; await api().adminSetRole(s._orig.id, s.role); AW.toast(t("a_roleSaved")); await reloadTab(); D().sel = null; AW.render();
  };
  F.aadjust = async function () {
    const amt = parseInt(dg(D().adj.amount).replace("−", "-"), 10);
    if (!amt) AW.fail("E_BAD");
    await api().adminAdjust(D().sel._orig.id, amt, D().adj.note);
    D().adj = { amount: "", note: "" }; AW.toast(t("a_adjusted")); D().sel = null; await reloadTab();
    if (D().tab === "scouts") await AW.refreshMe();
  };
  A.aclrphoto = async function () { await api().adminClearPhoto(D().sel._orig.id); AW.toast(t("a_done")); D().sel = null; await reloadTab(); };
  F.acomp = async function () {
    const c = D().cf;
    await api().adminSaveCompetition({ id: c.id, name_ar: c.name_ar.trim(), name_en: c.name_en.trim(), starts_on: c.starts_on, ends_on: c.ends_on });
    D().cf = blankComp(); AW.toast(t("saved")); await reloadTab();
  };
  A.aeditcomp = function (el) { const c = D().comps.find(function (x) { return x.id === +el.dataset.id; }); D().cf = { id: c.id, name_ar: c.name_ar || "", name_en: c.name_en || "", starts_on: String(c.starts_on).slice(0, 10), ends_on: String(c.ends_on).slice(0, 10) }; AW.render(); window.scrollTo(0, 0); };
  A.acancelcomp = function () { D().cf = blankComp(); AW.render(); };
  A.adelcomp = async function (el) {
    const key = "adelcomp" + el.dataset.id; if (D().sure !== key) { D().sure = key; AW.render(); return; }
    D().sure = null; await api().adminDeleteCompetition(+el.dataset.id); AW.toast(t("a_deleted")); await reloadTab();
  };
  F.aitem = async function () {
    const f = D().itf, price = parseInt(dg(f.price), 10), stock = String(f.stock).trim() === "" ? null : parseInt(dg(f.stock), 10);
    if (isNaN(price) || price < 0) AW.fail("E_BAD");
    const item = { kind: f.kind, name_ar: f.name_ar.trim(), name_en: f.name_en.trim(), description_ar: f.description_ar.trim(), price: price, stock: stock, active: !!f.active };
    if (f.kind === "avatar") { item.avatar_cat = f.avatar_cat; item.avatar_index = parseInt(dg(f.avatar_index), 10) || 0; }
    await api().adminSaveItem(f.id, item);
    D().itf = blankItem(); AW.toast(t("saved")); await reloadTab();
  };
  A.aedititem = function (el) {
    const i = D().items.find(function (x) { return x.id === +el.dataset.id; });
    D().itf = { id: i.id, kind: i.kind, name_ar: i.name_ar || "", name_en: i.name_en || "", description_ar: i.description_ar || "", price: String(i.price), stock: i.stock == null ? "" : String(i.stock), active: !!i.active, avatar_cat: i.avatar_cat || "accessory", avatar_index: String(i.avatar_index || 0) };
    AW.render(); window.scrollTo(0, 0);
  };
  A.acancelitem = function () { D().itf = blankItem(); AW.render(); };
  A.adelitem = async function (el) {
    const key = "adelitem" + el.dataset.id; if (D().sure !== key) { D().sure = key; AW.render(); return; }
    D().sure = null; await api().adminDeleteItem(+el.dataset.id); AW.toast(t("a_deleted")); await reloadTab();
  };
  A.adeliver = async function (el) { await api().adminDeliver(+el.dataset.id); AW.toast(t("a_delivered")); await reloadTab(); };
})();
