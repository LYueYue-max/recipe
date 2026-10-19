/* ============================================================
 * store.js —— 本地数据层（localStorage）
 * 菜谱版：songs→recipes，playlists→menus，playStats→viewStats
 * 保留：用户 / 邀请码 / 游客 / 待审批 / 日志 / 公告 / 备份
 * ============================================================ */
(function (window) {
  'use strict';
  var RM = window.RM;

  var DB_KEY = 'RM_DB_V1';
  var SESSION_KEY = 'RM_SESSION_V1';
  var HASH_SALT = 'round-recipe-demo::v1::';

  var ADMIN_UID = '000000';
  var ADMIN_NAME = '小鲨鱼';
  var ADMIN_DEFAULT_PASSWORD = 'xyy1314@';

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ---------- 密码哈希 ---------- */
  function fnvHash(input) {
    var h1 = 0x811c9dc5 >>> 0, h2 = 0x01000193 >>> 0;
    for (var i = 0; i < input.length; i++) {
      var c = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c, 2246822519) >>> 0;
    }
    return 'fnv$' + h1.toString(16) + h2.toString(16);
  }

  async function sha256Hash(input) {
    var buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    var arr = Array.prototype.slice.call(new Uint8Array(buf));
    return 'sha256$' + arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function hashPassword(pw) {
    var input = HASH_SALT + String(pw) + '::end';
    try {
      if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
        return await sha256Hash(input);
      }
    } catch (e) {}
    return fnvHash(input);
  }
  RM.hashPassword = hashPassword;

  /* 按存储前缀选择算法校验，修复跨上下文/旧数据导致的登录失败 */
  async function verifyPassword(pw, stored) {
    if (!stored) return false;
    var input = HASH_SALT + String(pw) + '::end';
    if (stored.indexOf('fnv$') === 0) {
      return fnvHash(input) === stored;
    }
    if (stored.indexOf('sha256$') === 0) {
      try {
        if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
          return (await sha256Hash(input)) === stored;
        }
      } catch (e) {}
      return false;
    }
    // 无前缀旧格式：两种都试
    try {
      if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
        if ((await sha256Hash(input)) === stored) return true;
      }
    } catch (e) {}
    if (fnvHash(input) === stored) return true;
    return false;
  }
  RM.verifyPassword = verifyPassword;

  var Store = RM.Store = {
    db: null,
    _officialRecipes: [],
    _officialLoaded: false,

    init: async function () {
      var loaded = null;
      try {
        var raw = localStorage.getItem(DB_KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch (e) { loaded = null; }

      if (loaded && Array.isArray(loaded.users) && loaded.users.length) {
        this.db = loaded;
        this.migrate();
      } else {
        await this.seed();
      }
      await this.ensureAdminAccount();
      this.sweep();
      this.save();
    },

    /* 确保系统管理员账户为 小鲨鱼 / xyy1314@（仅旧版本迁移时重置一次） */
    ensureAdminAccount: async function () {
      if (!this.db || !Array.isArray(this.db.users)) return;
      var admin = null;
      for (var i = 0; i < this.db.users.length; i++) {
        if (this.db.users[i].uid === ADMIN_UID) { admin = this.db.users[i]; break; }
      }
      if (!admin) return;

      var changed = false;
      if (this.db._resetAdminPassword) {
        admin.username = ADMIN_NAME;
        admin.usernameLower = ADMIN_NAME.toLowerCase();
        admin.role = 'admin';
        admin.status = 'active';
        admin.passHash = await hashPassword(ADMIN_DEFAULT_PASSWORD);
        admin.ban = { mode: 'none' };
        admin.freeze = { mode: 'none' };
        admin.loginFail = { count: 0, until: 0 };
        delete this.db._resetAdminPassword;
        changed = true;
      } else {
        if (admin.role !== 'admin') { admin.role = 'admin'; changed = true; }
        if (!admin.username) {
          admin.username = ADMIN_NAME;
          admin.usernameLower = ADMIN_NAME.toLowerCase();
          changed = true;
        }
      }
      if (changed) this.save();
    },

    loadOfficialRecipes: async function () {
      if (this._officialLoaded) return this._officialRecipes;
      var self = this;

      // 支持通过 window 注入的全局内置数据（解决 file:// 协议下 fetch 失败的问题）
      if (window.__BUILTIN_RECIPES__ && Array.isArray(window.__BUILTIN_RECIPES__)) {
        this._officialRecipes = window.__BUILTIN_RECIPES__;
        this._officialLoaded = true;
        return this._officialRecipes;
      }

      var ids = ['chinese', 'japanese-korean', 'southeast-asian', 'south-asian',
                 'middle-eastern', 'mediterranean', 'european', 'american', 'african'];
      try {
        var chunks = await Promise.all(ids.map(function (id) {
          // 尝试多个可能的路径，解决用户直接将 json 放在根目录的问题
          var paths = [
            'data/recipes-' + id + '.json',
            'recipes-' + id + '.json',
            '../data/recipes-' + id + '.json'
          ];
          
          function tryFetch(index) {
            if (index >= paths.length) return Promise.resolve([]);
            return fetch(paths[index])
              .then(function (r) { return r.ok ? r.json() : tryFetch(index + 1); })
              .catch(function () { return tryFetch(index + 1); });
          }
          
          return tryFetch(0);
        }));
        
        this._officialRecipes = [];
        chunks.forEach(function (list) {
          (list || []).forEach(function (r) { self._officialRecipes.push(r); });
        });
      } catch (err) {
        console.warn('官方菜谱加载异常：', err);
        this._officialRecipes = [];
      }
      this._officialLoaded = true;

      if (this._officialRecipes.length === 0) {
        console.warn(
          '【警告】未能读取到内置菜谱，菜谱库为空。\n' +
          '原因 1：如果您是直接双击 index.html 打开，浏览器会因安全限制(CORS)拦截本地 JSON 文件的 fetch 请求。请使用 VSCode Live Server 等工具启动本地服务器（推荐）。\n' +
          '原因 2：请检查 recipes-chinese.json 等文件是否与 index.html 在同级目录，或放在了 data/ 目录下。'
        );
      }

      return this._officialRecipes;
    },

    allRecipes: function () {
      var local = (this.db && this.db.songs) || [];
      var official = this._officialRecipes || [];
      var seen = {};
      var out = [];
      local.forEach(function (r) { if (!seen[r.id]) { seen[r.id] = true; out.push(r); } });
      official.forEach(function (r) { if (!seen[r.id]) { seen[r.id] = true; out.push(r); } });
      return out;
    },

    migrate: function () {
      var db = this.db;
      var prevVersion = Number(db.version) || 0;

      if (!Array.isArray(db.songs)) db.songs = [];
      if (!Array.isArray(db.invites)) db.invites = [];
      if (!Array.isArray(db.logs)) db.logs = [];
      if (!Array.isArray(db.announcements)) db.announcements = [];
      if (!db.settings) db.settings = {};
      if (!db.settings.accent) db.settings.accent = 'blue';
      if (!db.viewStats || typeof db.viewStats !== 'object') {
        db.viewStats = db.playStats || {};
        delete db.playStats;
      }

      db.songs.forEach(function (s) {
        if (!Array.isArray(s.mainIngredients)) s.mainIngredients = [];
        if (!Array.isArray(s.seasonings)) s.seasonings = [];
        if (!Array.isArray(s.steps)) s.steps = [];
        if (!Array.isArray(s.dietTags)) s.dietTags = [];
        if (!Array.isArray(s.optional)) s.optional = [];
        if (typeof s.views !== 'number') s.views = s.plays || 0;
        delete s.plays;
        if (typeof s.cuisine !== 'string') s.cuisine = '';
      });

      db.users.forEach(function (u) {
        if (!Array.isArray(u.history)) u.history = [];
        if (!Array.isArray(u.favorites)) u.favorites = [];
        if (!Array.isArray(u.playlists)) u.playlists = [];
        if (!Array.isArray(u.readAnnouncements)) u.readAnnouncements = [];
        if (!Array.isArray(u.notifications)) u.notifications = [];
        if (!u.loginFail) u.loginFail = { count: 0, until: 0 };
        (u.playlists || []).forEach(function (p) {
          if (!p.shareCode) p.shareCode = '';
          if (!Array.isArray(p.songIds)) p.songIds = [];
        });
      });

      // 旧版本（< 6）统一重置管理员为 小鲨鱼 / xyy1314@
      if (prevVersion < 6) {
        db._resetAdminPassword = true;
      }

      db.version = 6;
    },

    /* 种子：管理员 小鲨鱼 / xyy1314@ + 3 道示例菜谱 */
    seed: async function () {
      var now = Date.now();
      var adminHash = await hashPassword(ADMIN_DEFAULT_PASSWORD);

      this.db = {
        version: 6,
        users: [
          {
            uid: ADMIN_UID, username: ADMIN_NAME, usernameLower: ADMIN_NAME.toLowerCase(),
            passHash: adminHash, role: 'admin', status: 'active', createdAt: now,
            ban: { mode: 'none' }, freeze: { mode: 'none' },
            guest: false, guestExpireAt: null,
            history: [], favorites: [], playlists: [],
            readAnnouncements: [], notifications: [],
            loginFail: { count: 0, until: 0 }
          }
        ],
        invites: [],
        songs: [
          {
            id: 'seed_recipe_1', title: '番茄炒蛋', cuisine: '中国菜 · 家常',
            mainIngredients: ['番茄', '鸡蛋'], seasonings: ['盐', '糖', '食用油'],
            steps: ['番茄切块，鸡蛋打散', '热油炒蛋盛出', '炒番茄出汁加蛋翻炒', '加盐糖调味'],
            difficulty: '简单', time: '10 分钟', servings: '2 人份',
            dietTags: ['vegetarian', 'gluten-free'], optional: [],
            notes: '', views: 0, addedAt: now
          },
          {
            id: 'seed_recipe_2', title: '麻婆豆腐', cuisine: '中国菜 · 川菜',
            mainIngredients: ['豆腐', '牛肉末'], seasonings: ['豆瓣酱', '花椒', '蒜', '酱油'],
            steps: ['豆腐焯水', '炒香牛肉末和豆瓣酱', '加水与豆腐同煮', '勾芡撒花椒粉'],
            difficulty: '中等', time: '20 分钟', servings: '2 人份',
            dietTags: [], optional: ['葱花'],
            notes: '', views: 0, addedAt: now - 1000
          },
          {
            id: 'seed_recipe_3', title: '亲子丼', cuisine: '日韩菜 · 日本',
            mainIngredients: ['鸡肉', '鸡蛋', '米饭'], seasonings: ['酱油', '味醂', '糖'],
            steps: ['鸡肉用酱油味醂糖煮', '淋蛋液半熟关火', '盖在米饭上'],
            difficulty: '简单', time: '15 分钟', servings: '1 人份',
            dietTags: [], optional: ['洋葱'],
            notes: '', views: 0, addedAt: now - 2000
          }
        ],
        logs: [], announcements: [],
        settings: { accent: 'blue' },
        viewStats: {},
        meta: { createdAt: now }
      };
    },

    save: function () {
      try { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); }
      catch (e) { RM.toast('本地存储写入失败，可能是空间已满', 'error'); }
    },

    sweep: function () {
      var now = Date.now(), changed = false, removed = [];
      var before = this.db.users.length;
      this.db.users = this.db.users.filter(function (u) {
        if (u.guest && u.guestExpireAt && now >= u.guestExpireAt) {
          removed.push(u.uid); return false;
        }
        return true;
      });
      if (this.db.users.length !== before) changed = true;

      this.db.users.forEach(function (u) {
        if (u.ban && u.ban.mode === 'temp' && (u.ban.end || 0) <= now) { u.ban = { mode: 'none' }; changed = true; }
        if (u.freeze && u.freeze.mode === 'temp' && (u.freeze.end || 0) <= now) { u.freeze = { mode: 'none' }; changed = true; }
        if (u.history && u.history.length > 50) { u.history.length = 50; changed = true; }
        if (u.notifications && u.notifications.length > 100) { u.notifications.length = 100; changed = true; }
      });

      if (this.db.logs && this.db.logs.length > 500) { this.db.logs.length = 500; changed = true; }
      if (removed.length) {
        var s = this.getSession();
        if (s && removed.indexOf(s.uid) !== -1) this.clearSession();
      }
      if (changed) this.save();
      return changed;
    },

    getSession: function () {
      try {
        var raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        var s = JSON.parse(raw);
        return (s && s.uid) ? s : null;
      } catch (e) { return null; }
    },
    setSession: function (s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); },
    clearSession: function () { localStorage.removeItem(SESSION_KEY); },
    currentUser: function () {
      var s = this.getSession();
      if (!s) return null;
      var u = this.getUserByUid(s.uid);
      if (!u) { this.clearSession(); return null; }
      return u;
    },
    getUserByUid: function (uid) {
      if (!this.db) return null;
      for (var i = 0; i < this.db.users.length; i++) {
        if (this.db.users[i].uid === uid) return this.db.users[i];
      }
      return null;
    },
    findUserByLogin: function (identifier) {
      var id = String(identifier == null ? '' : identifier).trim();
      if (!id) return null;
      var lower = id.toLowerCase();
      var byUid = this.getUserByUid(id);
      if (byUid) return byUid;

      // 系统管理员别名：admin / 小鲨鱼 / 000000 都指向同一账户
      if (lower === 'admin' || id === ADMIN_NAME || lower === ADMIN_NAME.toLowerCase()) {
        var sys = this.getUserByUid(ADMIN_UID);
        if (sys) return sys;
      }

      for (var i = 0; i < this.db.users.length; i++) {
        if (this.db.users[i].usernameLower === lower) return this.db.users[i];
      }
      return null;
    },
    usernameExists: function (name, exceptUid) {
      var lower = String(name == null ? '' : name).trim().toLowerCase();
      if (!lower) return false;
      if ((lower === 'admin' || lower === ADMIN_NAME.toLowerCase()) && exceptUid !== ADMIN_UID) {
        if (this.getUserByUid(ADMIN_UID)) return true;
      }
      for (var i = 0; i < this.db.users.length; i++) {
        var u = this.db.users[i];
        if (u.uid === exceptUid) continue;
        if (u.usernameLower === lower) return true;
      }
      return false;
    },
    isUidTaken: function (uid, exceptUid) {
      for (var i = 0; i < this.db.users.length; i++) {
        var u = this.db.users[i];
        if (u.uid === exceptUid) continue;
        if (u.uid === uid) return true;
      }
      return false;
    },
    generateUid: function () {
      var taken = {};
      this.db.users.forEach(function (u) { taken[u.uid] = true; });
      taken[ADMIN_UID] = true;
      for (var i = 0; i < 5000; i++) {
        var uid = RM.uid6();
        if (!taken[uid]) return uid;
      }
      for (var n = 100000; n <= 999999; n++) {
        var s = String(n);
        if (!taken[s]) return s;
      }
      return RM.uid6();
    },
    findInvite: function (code) {
      var c = String(code == null ? '' : code).trim();
      if (!c) return null;
      var lower = c.toLowerCase();
      for (var i = 0; i < this.db.invites.length; i++) {
        if (String(this.db.invites[i].code).toLowerCase() === lower) return this.db.invites[i];
      }
      return null;
    },
    banState: function (u) {
      var b = u && u.ban;
      if (!b || !b.mode || b.mode === 'none') return { active: false };
      if (b.mode === 'perm') return { active: true, perm: true, remaining: Infinity };
      var rem = (b.end || 0) - Date.now();
      if (rem <= 0) return { active: false, expired: true };
      return { active: true, perm: false, remaining: rem, end: b.end };
    },
    freezeState: function (u) {
      var f = u && u.freeze;
      if (!f || !f.mode || f.mode === 'none') return { active: false };
      if (f.mode === 'perm') return { active: true, perm: true, remaining: Infinity };
      var rem = (f.end || 0) - Date.now();
      if (rem <= 0) return { active: false, expired: true };
      return { active: true, perm: false, remaining: rem, end: f.end };
    },
    removeUser: function (uid) {
      this.db.users = this.db.users.filter(function (u) { return u.uid !== uid; });
      var s = this.getSession();
      if (s && s.uid === uid) this.clearSession();
      this.save();
    },
    resetAll: async function () {
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem(SESSION_KEY);
      await this.init();
    },

    addLog: function (action, target, detail) {
      if (!this.db) return;
      var u = this.currentUser();
      this.db.logs.unshift({
        id: RM.uid('log'), time: Date.now(),
        actor: u ? u.username : '系统',
        action: action || '', target: target || '', detail: detail || ''
      });
      if (this.db.logs.length > 500) this.db.logs.length = 500;
      this.save();
    },

    pushHistory: function (user, recipeId) {
      if (!user || !recipeId) return;
      var h = (user.history || (user.history = [])).filter(function (x) { return x.songId !== recipeId; });
      h.unshift({ songId: recipeId, at: Date.now() });
      user.history = h.slice(0, 50);
      this.save();
    },

    isFavorite: function (user, recipeId) {
      return !!(user && Array.isArray(user.favorites) && user.favorites.indexOf(recipeId) !== -1);
    },
    toggleFavorite: function (user, recipeId) {
      if (!user) return false;
      var f = user.favorites || (user.favorites = []);
      var i = f.indexOf(recipeId);
      if (i >= 0) { f.splice(i, 1); this.save(); return false; }
      f.push(recipeId); this.save(); return true;
    },

    recipeById: function (id) {
      var all = this.allRecipes();
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) return all[i];
      }
      return null;
    },
    recipesByIds: function (ids) {
      var self = this;
      return (ids || []).map(function (id) { return self.recipeById(id); }).filter(Boolean);
    },
    incView: function (recipeId) {
      var local = this.songById(recipeId);
      if (local) local.views = (local.views || 0) + 1;
      if (!this.db.viewStats) this.db.viewStats = {};
      var k = todayKey();
      this.db.viewStats[k] = (this.db.viewStats[k] || 0) + 1;
      this.save();
    },
    songById: function (id) {
      if (!this.db) return null;
      for (var i = 0; i < this.db.songs.length; i++) {
        if (this.db.songs[i].id === id) return this.db.songs[i];
      }
      return null;
    },

    createPlaylist: function (user, name) {
      var n = String(name == null ? '' : name).trim();
      if (!n) return { ok: false, msg: '菜单名称不能为空' };
      if (n.length > 20) return { ok: false, msg: '菜单名称不能超过 20 个字符' };
      var list = user.playlists || (user.playlists = []);
      var dup = list.some(function (p) { return p.name.toLowerCase() === n.toLowerCase(); });
      if (dup) return { ok: false, msg: '同名菜单已存在' };
      list.push({ id: RM.uid('pl'), name: n, songIds: [], createdAt: Date.now(), shareCode: '' });
      this.save();
      return { ok: true };
    },
    renamePlaylist: function (user, id, name) {
      var n = String(name == null ? '' : name).trim();
      if (!n) return { ok: false, msg: '菜单名称不能为空' };
      if (n.length > 20) return { ok: false, msg: '菜单名称不能超过 20 个字符' };
      var list = user.playlists || [];
      var dup = list.some(function (p) {
        return p.id !== id && p.name.toLowerCase() === n.toLowerCase();
      });
      if (dup) return { ok: false, msg: '同名菜单已存在' };
      var p = list.filter(function (x) { return x.id === id; })[0];
      if (!p) return { ok: false, msg: '菜单不存在' };
      p.name = n; this.save(); return { ok: true };
    },
    deletePlaylist: function (user, id) {
      user.playlists = (user.playlists || []).filter(function (p) { return p.id !== id; });
      this.save();
    },
    addToPlaylist: function (user, id, recipeId) {
      var p = (user.playlists || []).filter(function (x) { return x.id === id; })[0];
      if (!p) return { ok: false, msg: '菜单不存在' };
      if (p.songIds.indexOf(recipeId) !== -1) return { ok: false, msg: '该菜谱已在菜单中' };
      p.songIds.push(recipeId); this.save(); return { ok: true };
    },
    removeFromPlaylist: function (user, id, recipeId) {
      var p = (user.playlists || []).filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      p.songIds = p.songIds.filter(function (x) { return x !== recipeId; });
      this.save();
    },

    addAnnouncement: function (title, content, pinned) {
      var t = String(title == null ? '' : title).trim();
      var c = String(content == null ? '' : content).trim();
      if (!t) return { ok: false, msg: '公告标题不能为空' };
      if (!c) return { ok: false, msg: '公告内容不能为空' };
      this.db.announcements.unshift({
        id: RM.uid('ann'), title: t, content: c,
        pinned: !!pinned, enabled: true, createdAt: Date.now()
      });
      this.save(); return { ok: true };
    },
    removeAnnouncement: function (id) {
      this.db.announcements = this.db.announcements.filter(function (a) { return a.id !== id; });
      this.save();
    },
    getAnnouncement: function (id) {
      for (var i = 0; i < this.db.announcements.length; i++) {
        if (this.db.announcements[i].id === id) return this.db.announcements[i];
      }
      return null;
    },

    sendNotification: function (targetUid, title, content) {
      var t = String(title == null ? '' : title).trim();
      var c = String(content == null ? '' : content).trim();
      if (!t) return { ok: false, msg: '通知标题不能为空' };
      if (!c) return { ok: false, msg: '通知内容不能为空' };
      var targets = targetUid ? [this.getUserByUid(targetUid)].filter(Boolean)
                              : this.db.users.filter(function (u) { return u.role !== 'admin'; });
      if (!targets.length) return { ok: false, msg: '没有可发送的目标用户' };
      targets.forEach(function (u) {
        if (!Array.isArray(u.notifications)) u.notifications = [];
        u.notifications.unshift({ id: RM.uid('ntf'), title: t, content: c, at: Date.now(), read: false });
        if (u.notifications.length > 100) u.notifications.length = 100;
      });
      this.save(); return { ok: true, count: targets.length };
    },
    markNotificationRead: function (user, id) {
      var n = (user.notifications || []).filter(function (x) { return x.id === id; })[0];
      if (!n) return; n.read = true; this.save();
    },
    unreadCount: function (user) {
      return (user && user.notifications ? user.notifications : []).filter(function (n) { return !n.read; }).length;
    },
    markAllNotificationsRead: function (user) {
      (user.notifications || []).forEach(function (n) { n.read = true; });
      this.save();
    },

    getAccent: function () {
      return (this.db && this.db.settings && this.db.settings.accent) || 'blue';
    },
    setAccent: function (name) {
      if (!this.db.settings) this.db.settings = {};
      this.db.settings.accent = name; this.save();
    },

    exportJSON: function () { return JSON.stringify(this.db, null, 2); },
    importJSON: async function (text) {
      var data;
      try { data = JSON.parse(text); }
      catch (e) { return { ok: false, msg: 'JSON 解析失败，文件格式不正确' }; }
      if (!data || !Array.isArray(data.users) || !data.users.length) {
        return { ok: false, msg: '数据缺少有效的 users 数组' };
      }
      if (!Array.isArray(data.songs)) data.songs = [];
      if (!Array.isArray(data.invites)) data.invites = [];
      this.db = data;
      this.migrate();
      await this.ensureAdminAccount();
      this.sweep(); this.save();
      return { ok: true };
    }
  };
})(window);