/* Al Waad: talks to your Supabase project (the real competition).
   Everything goes through the secure functions in supabase-setup.sql. */
(function () {
  "use strict";
  const AW = (window.AW = window.AW || {});

  function mkErr(error) {
    const msg = (error && error.message) || "";
    const e = new Error(msg || "error");
    let m = /E_[A-Z]+/.exec(msg);
    let code = m ? m[0] : "";
    if (!code) {
      if (/invalid login credentials/i.test(msg)) code = "E_LOGIN";
      else if (/already registered|already been registered/i.test(msg)) code = "E_EXISTS";
      else if (/password should be at least|weak password/i.test(msg)) code = "E_PW";
      else if (/email not confirmed/i.test(msg)) code = "E_CONFIRM";
      else if (/invalid path specified/i.test(msg)) code = "E_URL";
      else if (/invalid api key|jwt/i.test(msg)) code = "E_KEY";
      else if (/failed to fetch|networkerror|load failed/i.test(msg)) code = "E_NET";
      else if (/unable to validate email|invalid format/i.test(msg)) code = "E_EMAIL";
      else if (/rate limit/i.test(msg)) code = "E_RATE";
    }
    e.code = code;
    return e;
  }

  AW.makeSupaApi = function (sb) {
    async function rpc(fn, args) {
      let res;
      try { res = await sb.rpc(fn, args || {}); } catch (e) { throw mkErr({ message: e && e.message }); }
      if (res.error) throw mkErr(res.error);
      return res.data;
    }
    async function auth(promise) {
      let res;
      try { res = await promise; } catch (e) { throw mkErr({ message: e && e.message }); }
      if (res.error) throw mkErr(res.error);
      return res.data;
    }

    return {
      mode: "supabase",

      // ----- accounts -----
      async init() {
        const d = await auth(sb.auth.getSession());
        return d.session ? d.session.user : null;
      },
      async signUp(email, password, meta) {
        const d = await auth(sb.auth.signUp({
          email: email, password: password,
          options: { data: { display_name: meta.name, team: meta.team, age: String(meta.age), patrol_rank: meta.rank } }
        }));
        return d.session ? d.user : null;      // null = the project asks for email confirmation
      },
      async signIn(email, password) {
        const d = await auth(sb.auth.signInWithPassword({ email: email, password: password }));
        return d.user;
      },
      async signOut() { try { await sb.auth.signOut(); } catch (e) { /* ignore */ } },

      // ----- the scout -----
      me: function () { return rpc("me"); },
      saveProfile: function (v) { return rpc("save_profile", { p_name: v.name, p_team: v.team, p_age: v.age, p_rank: v.rank }); },
      saveAvatar: function (a) { return rpc("save_avatar", { p_avatar: a }); },
      setPhoto: function (dataUrl) { return rpc("set_photo", { p_photo: dataUrl }); },
      portfolioList: function () { return rpc("portfolio_list"); },
      portfolioAdd: function (v) { return rpc("portfolio_add", { p_kind: v.kind, p_title: v.title, p_date: v.date || null, p_notes: v.notes || null }); },
      portfolioDelete: function (id) { return rpc("portfolio_delete", { p_id: id }); },

      // ----- daily quiz -----
      playState: function () { return rpc("play_state"); },
      openQuestion: function () { return rpc("open_question"); },
      submit: function (questionId, choice) { return rpc("submit_answer", { p_question_id: questionId, p_choice: choice }); },

      // ----- rankings -----
      leaderboard: function (scope, period, competition) { return rpc("leaderboard", { p_scope: scope, p_period: period, p_competition: competition || null }); },
      myRanks: function (period) { return rpc("my_ranks", { p_period: period }); },
      competitions: function (all) { return rpc("competitions_list", { p_all: !!all }); },

      // ----- wallet and shop -----
      walletHistory: function () { return rpc("wallet_history"); },
      shopList: function () { return rpc("shop_list"); },
      buy: function (itemId) { return rpc("buy_item", { p_item_id: itemId }); },

      // ----- admin -----
      adminSummary: function () { return rpc("admin_summary"); },
      adminScouts: function () { return rpc("admin_scouts"); },
      adminUpdateScout: function (v) { return rpc("admin_update_scout", { p_id: v.id, p_name: v.name, p_team: v.team, p_age: v.age, p_rank: v.rank, p_hidden: !!v.hidden }); },
      adminSetRole: function (id, role) { return rpc("admin_set_role", { p_id: id, p_role: role }); },
      adminAdjust: function (id, amount, note) { return rpc("admin_adjust", { p_id: id, p_amount: amount, p_note: note || null }); },
      adminClearPhoto: function (id) { return rpc("admin_clear_photo", { p_id: id }); },
      adminQuestions: function (from) { return rpc("admin_questions", { p_from: from }); },
      adminSaveQuestions: function (items) { return rpc("admin_save_questions", { p_items: items }); },
      adminDeleteQuestion: function (id) { return rpc("admin_delete_question", { p_id: id }); },
      adminSaveCompetition: function (v) { return rpc("admin_save_competition", { p_id: v.id || null, p_name_ar: v.name_ar, p_name_en: v.name_en || null, p_starts: v.starts_on, p_ends: v.ends_on }); },
      adminDeleteCompetition: function (id) { return rpc("admin_delete_competition", { p_id: id }); },
      adminShopItems: function () { return rpc("admin_shop_items"); },
      adminSaveItem: function (id, item) { return rpc("admin_save_item", { p_id: id || null, p_item: item }); },
      adminDeleteItem: function (id) { return rpc("admin_delete_item", { p_id: id }); },
      adminOrders: function () { return rpc("admin_orders"); },
      adminDeliver: function (id) { return rpc("admin_deliver", { p_id: id }); }
    };
  };

  AW.connectSupabase = function () {
    if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
      const e = new Error("Supabase library missing"); e.code = "E_LIB"; throw e;
    }
    const sb = window.supabase.createClient(AW.cfg.SUPABASE_URL, AW.cfg.SUPABASE_ANON_KEY);
    return AW.makeSupaApi(sb);
  };
})();
