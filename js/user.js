/* ============================================================
 * user.js —— 普通用户 / 游客界面（菜谱版）
 * 已调整为与管理员一致的左侧菜单栏布局 + 下拉分组
 * ============================================================ */
(function (window) {
  'use strict';
  var RM = window.RM;

  var CUISINES = [];

  // 用户端侧边栏导航配置（分组下拉）
  var USER_NAV = [
    { type: 'link', path: '/app/workbench', icon: '🍳', label: '食材匹配' },
    { type: 'link', path: '/app/library', icon: '📖', label: '菜谱库' },
    {
      type: 'group', key: 'my', icon: '📂', label: '我的空间',
      items: [
        { path: '/app/favorites', label: '我的收藏' },
        { path: '/app/playlists', label: '我的菜单' }
      ]
    },
    {
      type: 'group', key: 'settings', icon: '⚙️', label: '设置与信息',
      items: [
        { path: '/app/profile', label: '个人资料' },
        { path: '/app/about', label: '关于' }
      ]
    }
  ];

  var User = RM.User = {

    _libPage: 1,
    _favPage: 1,
    _plView: null,
    _lastResults: [],

    render: function (path, user) {
      var freeze = RM.Store.freezeState(user);
      if (freeze.active) { this.renderFrozen(user, freeze); return; }

      var app = document.getElementById('app');
      var unread = RM.Store.unreadCount(user);

      // 替换为与管理端一致的 shell 布局
      app.innerHTML =
        '<div class="shell">' +
          '<aside class="sidebar">' +
            '<div class="brand"><span class="brand-icon"><img src="ict.jpg" alt="logo"></span><span>小鲨鱼菜谱</span></div>' +
            this.navHtml(path) +
            '<div class="sidebar-foot">' +
              '<button type="button" class="btn btn-ghost btn-block" id="notify-btn">🔔 通知中心' +
                (unread > 0 ? ' <span class="badge badge-danger" style="margin-left:6px">' + unread + '</span>' : '') +
              '</button>' +
              '<button type="button" class="btn btn-ghost btn-block" id="palette-btn">🎨 主题色</button>' +
              '<button type="button" class="btn btn-ghost btn-block" id="theme-toggle">' +
                (RM.Theme.get() === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式') + '</button>' +
              '<button type="button" class="btn btn-ghost btn-block" id="user-logout">退出登录</button>' +
            '</div>' +
          '</aside>' +
          '<main class="main" id="main"></main>' +
        '</div>';

      // 绑定侧边栏底部按钮事件
      document.getElementById('user-logout').addEventListener('click', function () { RM.Auth.logout(); });
      document.getElementById('theme-toggle').addEventListener('click', function () {
        RM.Theme.toggle();
        this.textContent = RM.Theme.get() === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式';
      });
      document.getElementById('palette-btn').addEventListener('click', function () { RM.Accent.openDialog(); });
      document.getElementById('notify-btn').addEventListener('click', function () { RM.Notify.open(user); });

      // 绑定导航栏展开/折叠事件
      app.querySelector('.sidebar').addEventListener('click', function (e) {
        var head = e.target.closest('.nav-group-head');
        if (!head) return;
        head.parentNode.classList.toggle('open');
      });

      // 渲染主体内容
      var main = document.getElementById('main');
      if (path === '/app/profile') this.renderProfile(main, user);
      else if (path === '/app/favorites') this.renderFavorites(main, user);
      else if (path === '/app/playlists') this.renderPlaylists(main, user);
      else if (path === '/app/about') this.renderAbout(main);
      else if (path === '/app/library') this.renderLibrary(main, user);
      else this.renderWorkbench(main, user);
    },

    // 生成侧边栏 HTML
    navHtml: function (path) {
      return USER_NAV.map(function (n) {
        if (n.type === 'group') {
          var hasActive = n.items.some(function (it) { return it.path === path; });
          var sub = n.items.map(function (it) {
            var active = it.path === path ? ' active' : '';
            return '<a class="nav-item nav-sub-item' + active + '" href="#' + it.path + '">' +
              '<span>' + it.label + '</span></a>';
          }).join('');
          return '<div class="nav-group' + (hasActive ? ' open' : '') + '">' +
            '<button type="button" class="nav-item nav-group-head">' +
              '<span class="nav-ico">' + n.icon + '</span>' +
              '<span>' + n.label + '</span>' +
              '<span class="nav-caret">▾</span>' +
            '</button>' +
            '<div class="nav-sub">' + sub + '</div>' +
          '</div>';
        }
        var active = n.path === path ? ' active' : '';
        return '<a class="nav-item' + active + '" href="#' + n.path + '">' +
          '<span class="nav-ico">' + n.icon + '</span>' +
          '<span>' + n.label + '</span></a>';
      }).join('');
    },

    renderFrozen: function (user, freeze) {
      var app = document.getElementById('app');
      var timeHtml = freeze.perm ? '账户已被永久冻结'
        : '账户已冻结，还剩 <b data-countdown data-end="' + freeze.end + '"></b> 解除';
      app.innerHTML =
        '<div class="auth-wrap">' +
          '<div class="auth-card frozen-card">' +
            '<div class="frozen-icon">❄️</div>' +
            '<h2 style="font-size:22px">账户已冻结</h2>' +
            '<p class="frozen-time">' + timeHtml + '</p>' +
            '<p class="sub" style="margin-bottom:24px">冻结期间，除查看此提示和退出登录外，无法进行任何操作。</p>' +
            '<button type="button" class="btn btn-ghost btn-block" id="frozen-logout">退出登录</button>' +
          '</div>' +
        '</div>';
      document.getElementById('frozen-logout').addEventListener('click', function () { RM.Auth.logout(); });
    },

    announcementHtml: function (user) {
      var list = (RM.Store.db.announcements || [])
        .filter(function (a) { return a.enabled; })
        .sort(function (a, b) {
          return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.createdAt - a.createdAt);
        });
      if (!list.length) return '';
      var read = user.readAnnouncements || [];
      return list.slice(0, 3).map(function (a) {
        var isRead = read.indexOf(a.id) !== -1;
        return '<div class="notice notice-info announce" data-ann="' + RM.escapeHtml(a.id) + '">' +
          '<div class="announce-head"><b>' + (a.pinned ? '📌 ' : '') + RM.escapeHtml(a.title) + '</b>' +
            (isRead ? '' : '<span class="badge badge-warn">新</span>') + '</div>' +
          '<div class="announce-body">' + RM.escapeHtml(a.content) + '</div>' +
          (isRead ? '' : '<button type="button" class="btn btn-sm btn-ghost" data-read="' +
            RM.escapeHtml(a.id) + '">知道了</button>') +
        '</div>';
      }).join('');
    },

    bindAnnouncements: function (host, user) {
      host.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-read]');
        if (!btn) return;
        var id = btn.getAttribute('data-read');
        var read = user.readAnnouncements || (user.readAnnouncements = []);
        if (read.indexOf(id) === -1) read.push(id);
        RM.Store.save(); RM.rerender();
      });
    },

    cardHtml: function (r, idx, user, match) {
      var fav = RM.Store.isFavorite(user, r.id);
      var ratioHtml = '';
      var missHtml = '';
      if (match && match.ratio != null) {
        ratioHtml = '<span class="recipe-match ' + RM.RecipeUtil.matchClass(match.ratio) + '">命中 ' + match.ratio + '%</span>';
        var parts = [];
        if (match.missMain && match.missMain.length) parts.push('缺主食材：' + match.missMain.map(RM.escapeHtml).join('、'));
        if (match.missSea && match.missSea.length) parts.push('缺调料：' + match.missSea.map(RM.escapeHtml).join('、'));
        if (match.sub && match.sub.length) parts.push('可替代：' + match.sub.map(RM.escapeHtml).join('、'));
        if (parts.length) missHtml = '<div class="recipe-miss">' + parts.join(' · ') + '</div>';
      }
      var tagsHtml = (r.dietTags || []).slice(0, 4).map(function (t) {
        return '<span class="chip chip-ghost">' + RM.escapeHtml(t) + '</span>';
      }).join('');

      return '<div class="recipe-card" data-idx="' + idx + '" data-id="' + RM.escapeHtml(r.id) + '">' +
        '<button type="button" class="fav-btn-recipe' + (fav ? ' on' : '') +
          '" data-fav="' + RM.escapeHtml(r.id) + '" title="收藏">' + (fav ? '♥' : '♡') + '</button>' +
        '<div class="recipe-card-head">' +
          '<div class="recipe-card-title">' + RM.escapeHtml(r.title || r.name) + '</div>' +
          ratioHtml +
        '</div>' +
        '<div class="recipe-card-meta">' +
          '<span>' + RM.escapeHtml(r.cuisine || '') + '</span>' +
          (r.time ? '<span>· ' + RM.escapeHtml(r.time) + '</span>' : '') +
          (r.difficulty ? '<span>· ' + RM.escapeHtml(r.difficulty) + '</span>' : '') +
        '</div>' +
        (tagsHtml ? '<div class="recipe-card-tags">' + tagsHtml + '</div>' : '') +
        missHtml +
      '</div>';
    },

    bindCardClick: function (host, list) {
      var self = this;
      host.addEventListener('click', function (e) {
        var favBtn = e.target.closest('[data-fav]');
        if (favBtn) {
          e.stopPropagation();
          self.toggleFav(favBtn.getAttribute('data-fav'));
          return;
        }
        var card = e.target.closest('.recipe-card');
        if (!card) return;
        var idx = Number(card.getAttribute('data-idx'));
        if (isNaN(idx) || !list[idx]) return;
        var item = list[idx];
        RM.Recipe.open(item.recipe || item, item.match || null);
      });
    },

    toggleFav: function (recipeId) {
      var user = RM.Store.currentUser();
      if (!user) return;
      var on = RM.Store.toggleFavorite(user, recipeId);
      RM.toast(on ? '已收藏' : '已取消收藏');
      RM.rerender();
    },

    renderWorkbench: function (main, user) {
      var self = this;
      var allRecipes = RM.Store.allRecipes();

      main.innerHTML =
        '<div id="ann-host"></div>' +
        '<div class="page-head">' +
          '<h2>食材匹配</h2>' +
          '<p class="sub">输入你手头的食材和调料，按匹配度推荐菜谱（共 ' + allRecipes.length + ' 道）</p>' +
        '</div>' +
        '<section class="card workbench">' +
          '<label class="field"><span>现有食材与调料</span>' +
            '<textarea id="wb-input" placeholder="例如：番茄、鸡蛋、豆腐、酱油、蒜"></textarea></label>' +
          '<div class="quick-tags" id="quick-tags"></div>' +
          '<div class="filter-row">' +
            '<select id="f-veg"><option value="">素食不限</option><option value="1">仅素食</option></select>' +
            '<select id="f-halal"><option value="">清真不限</option><option value="1">仅清真</option></select>' +
            '<select id="f-gf"><option value="">无麸质不限</option><option value="1">仅无麸质</option></select>' +
            '<select id="f-lowoil"><option value="">少油不限</option><option value="1">仅少油</option></select>' +
            '<select id="f-lowsugar"><option value="">低糖不限</option><option value="1">仅低糖</option></select>' +
            '<select id="f-nuts"><option value="">含坚果不限</option><option value="1">仅含坚果</option></select>' +
            '<select id="f-sea"><option value="">含海鲜不限</option><option value="1">仅含海鲜</option></select>' +
            '<select id="f-cuisine"><option value="">菜系不限</option></select>' +
            '<select id="f-time"><option value="">时间不限</option><option value="15">≤15 分钟</option>' +
              '<option value="30">≤30 分钟</option><option value="60">≤60 分钟</option></select>' +
            '<select id="f-diff"><option value="">难度不限</option><option value="简单">简单</option>' +
              '<option value="中等">中等</option><option value="进阶">进阶</option></select>' +
          '</div>' +
          '<div class="gen-btn-row">' +
            '<button type="button" class="btn btn-primary" id="gen-btn">生成菜谱</button>' +
            '<button type="button" class="btn btn-ghost" id="clear-btn">清空</button>' +
          '</div>' +
        '</section>' +
        '<div id="result-area"></div>';

      var annHost = main.querySelector('#ann-host');
      annHost.innerHTML = self.announcementHtml(user);
      self.bindAnnouncements(annHost, user);

      var cuisineSel = main.querySelector('#f-cuisine');
      CUISINES.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        cuisineSel.appendChild(o);
      });

      var COMMON = ['番茄', '鸡蛋', '豆腐', '土豆', '洋葱', '蒜', '姜',
        '酱油', '醋', '糖', '盐', '鸡肉', '牛肉', '虾', '米饭', '面条',
        '辣椒', '葱', '蘑菇', '猪肉'];
      var qt = main.querySelector('#quick-tags');
      qt.innerHTML = COMMON.map(function (x) {
        return '<button type="button" class="chip chip-ghost" data-tag="' + x + '">' + x + '</button>';
      }).join('');
      qt.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-tag]');
        if (!btn) return;
        var inp = main.querySelector('#wb-input');
        var v = inp.value.trim();
        inp.value = v ? v + '、' + btn.getAttribute('data-tag') : btn.getAttribute('data-tag');
      });

      main.querySelector('#clear-btn').addEventListener('click', function () {
        main.querySelector('#wb-input').value = '';
        main.querySelector('#result-area').innerHTML = '';
        self._lastResults = [];
      });

      main.querySelector('#gen-btn').addEventListener('click', function () {
        var raw = main.querySelector('#wb-input').value;
        var items = RM.RecipeUtil.parseItems(raw);
        if (!items.length) { RM.toast('请先输入食材', 'warn'); return; }

        var filters = {
          veg: main.querySelector('#f-veg').value === '1',
          halal: main.querySelector('#f-halal').value === '1',
          gf: main.querySelector('#f-gf').value === '1',
          lowoil: main.querySelector('#f-lowoil').value === '1',
          lowsugar: main.querySelector('#f-lowsugar').value === '1',
          nuts: main.querySelector('#f-nuts').value === '1',
          sea: main.querySelector('#f-sea').value === '1',
          cuisine: main.querySelector('#f-cuisine').value,
          time: Number(main.querySelector('#f-time').value) || 0,
          diff: main.querySelector('#f-diff').value
        };

        var results = self.matchAll(items, filters);
        self._lastResults = results;
        self.paintResults(main, results, user);
      });
    },

    matchAll: function (items, filters) {
      var all = RM.Store.allRecipes();
      var synonyms = window.__SYNONYMS__ || {};
      var substitutions = window.__SUBSTITUTIONS__ || {};

      function expand(name) {
        var base = String(name || '').trim().toLowerCase();
        var set = new Set([base]);
        for (var k in synonyms) {
          var group = [k].concat(synonyms[k]).map(function (x) { return String(x).toLowerCase(); });
          if (group.indexOf(base) !== -1) group.forEach(function (x) { set.add(x); });
        }
        return set;
      }

      var userSet = new Set();
      items.forEach(function (i) { expand(i).forEach(function (x) { userSet.add(x); }); });

      var results = all.map(function (r) {
        var main = r.mainIngredients || [];
        var sea = r.seasonings || [];
        var hitMain = [], missMain = [], hitSea = [], missSea = [];
        main.forEach(function (m) {
          if ([...expand(m)].some(function (x) { return userSet.has(x); })) hitMain.push(m); else missMain.push(m);
        });
        sea.forEach(function (s) {
          if ([...expand(s)].some(function (x) { return userSet.has(x); })) hitSea.push(s); else missSea.push(s);
        });
        var mainRatio = main.length ? hitMain.length / main.length : 1;
        var seaRatio = sea.length ? hitSea.length / sea.length : 1;
        var score = mainRatio * 0.7 + seaRatio * 0.3;
        var sub = missSea.filter(function (s) { return substitutions[s]; });
        score += sub.length * 0.03;
        score -= missMain.length * 0.15;
        score = Math.max(0, Math.min(1, score));
        var ratio = Math.round(score * 100);
        return { recipe: r, match: { ratio: ratio, missMain: missMain, missSea: missSea, sub: sub } };
      });

      results = results.filter(function (x) {
        var r = x.recipe;
        var tags = r.dietTags || [];
        if (filters.veg && tags.indexOf('vegetarian') === -1) return false;
        if (filters.halal && tags.indexOf('halal') === -1) return false;
        if (filters.gf && tags.indexOf('gluten-free') === -1) return false;
        if (filters.lowoil && tags.indexOf('low-oil') === -1) return false;
        if (filters.lowsugar && tags.indexOf('low-sugar') === -1) return false;
        if (filters.nuts && tags.indexOf('contains-nuts') === -1) return false;
        if (filters.sea && tags.indexOf('contains-seafood') === -1) return false;
        if (filters.cuisine && String(r.cuisine || '').indexOf(filters.cuisine) === -1) return false;
        if (filters.time) {
          var t = parseInt(r.time, 10);
          if (!isNaN(t) && t > filters.time) return false;
        }
        if (filters.diff && r.difficulty !== filters.diff) return false;
        return true;
      });

      results.sort(function (a, b) { return b.match.ratio - a.match.ratio; });
      return results;
    },

    paintResults: function (main, results, user) {
      var area = main.querySelector('#result-area');
      if (!results.length) {
        area.innerHTML = '<div class="result-empty">没有匹配的菜谱，试试增加食材或放宽筛选条件。</div>';
        return;
      }
      var top = results.slice(0, 30);
      area.innerHTML =
        '<div class="page-head" style="margin:20px 0 14px"><h3 style="font-size:16px">' +
          '匹配结果（' + top.length + ' 道）</h3></div>' +
        '<div class="recipe-grid">' +
          top.map(function (x, i) { return User.cardHtml(x.recipe, i, user, x.match); }).join('') +
        '</div>';

      var list = top.map(function (x) { return { recipe: x.recipe, match: x.match }; });
      User.bindCardClick(area.querySelector('.recipe-grid'), list);
    },

    renderLibrary: function (main, user) {
      var self = this;
      var all = RM.Store.allRecipes();
      self._libPage = 1;

      main.innerHTML =
        '<div class="page-head">' +
          '<h2>菜谱库</h2>' +
          '<p class="sub">共 ' + all.length + ' 道菜谱，覆盖主流菜谱类型，支持持续扩展</p>' +
        '</div>' +
        '<div class="toolbar">' +
          '<input type="search" id="lib-search" placeholder="搜索菜名…" autocomplete="off">' +
          '<select id="lib-cuisine"><option value="">全部菜系</option></select>' +
          '<select id="lib-sort">' +
            '<option value="new">最新添加</option>' +
            '<option value="title">菜名 A-Z</option>' +
            '<option value="view">按热度</option>' +
          '</select>' +
        '</div>' +
        '<div class="recipe-grid" id="lib-grid"></div>' +
        '<div class="empty" id="lib-empty" hidden>没有找到匹配的菜谱</div>' +
        '<div id="lib-pager"></div>';

      var cuisineSel = main.querySelector('#lib-cuisine');
      CUISINES.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.name; o.textContent = c.name;
        cuisineSel.appendChild(o);
      });

      var grid = main.querySelector('#lib-grid');
      var emptyEl = main.querySelector('#lib-empty');
      var searchEl = main.querySelector('#lib-search');
      var sortEl = main.querySelector('#lib-sort');
      var pagerHost = main.querySelector('#lib-pager');

      function compute() {
        var kw = searchEl.value.trim().toLowerCase();
        var cu = cuisineSel.value;
        var sort = sortEl.value;
        var list = all.filter(function (r) {
          if (kw && String(r.title || r.name).toLowerCase().indexOf(kw) === -1) return false;
          if (cu && String(r.cuisine || '').indexOf(cu) === -1) return false;
          return true;
        });
        if (sort === 'new') list.sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
        else if (sort === 'view') list.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
        else list.sort(function (a, b) {
          return String(a.title || a.name).localeCompare(String(b.title || b.name), 'zh-Hans-CN');
        });
        return list;
      }

      function paint() {
        var current = compute();
        var paged = RM.pageSlice(current, self._libPage, 16);
        self._libPage = paged.page;

        if (!current.length) {
          grid.innerHTML = ''; emptyEl.hidden = false; pagerHost.innerHTML = '';
          return;
        }
        emptyEl.hidden = true;
        grid.innerHTML = paged.items.map(function (r, i) {
          return User.cardHtml(r, i, user, null);
        }).join('');
        pagerHost.innerHTML = RM.pagerHtml(paged.page, paged.pages);
        grid.__list = paged.items.map(function (r) { return { recipe: r, match: null }; });
      }
      paint();

      searchEl.addEventListener('input', RM.debounce(function () { self._libPage = 1; paint(); }, 150));
      sortEl.addEventListener('change', function () { self._libPage = 1; paint(); });
      cuisineSel.addEventListener('change', function () { self._libPage = 1; paint(); });

      pagerHost.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-page]');
        if (!btn) return;
        self._libPage = Number(btn.getAttribute('data-page'));
        paint();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      User.bindCardClick(grid, grid.__list || []);
    },

    renderFavorites: function (main, user) {
      var self = this;
      self._favPage = 1;
      var favRecipes = RM.Store.recipesByIds(user.favorites || []);

      main.innerHTML =
        '<div class="page-head">' +
          '<h2>我的收藏</h2>' +
          '<p class="sub">共 ' + favRecipes.length + ' 道收藏菜谱</p>' +
        '</div>' +
        '<div class="recipe-grid" id="fav-grid"></div>' +
        '<div class="empty" id="fav-empty" hidden>还没有收藏任何菜谱，去菜谱库点 ♡ 收藏吧</div>' +
        '<div id="fav-pager"></div>';

      var grid = main.querySelector('#fav-grid');
      var emptyEl = main.querySelector('#fav-empty');
      var pagerHost = main.querySelector('#fav-pager');
      var current = favRecipes;

      function paint() {
        var paged = RM.pageSlice(current, self._favPage, 16);
        self._favPage = paged.page;
        if (!current.length) {
          grid.innerHTML = ''; emptyEl.hidden = false; pagerHost.innerHTML = '';
          return;
        }
        emptyEl.hidden = true;
        grid.innerHTML = paged.items.map(function (r, i) {
          return User.cardHtml(r, i, user, null);
        }).join('');
        pagerHost.innerHTML = RM.pagerHtml(paged.page, paged.pages);
        grid.__list = paged.items.map(function (r) { return { recipe: r, match: null }; });
      }
      paint();

      pagerHost.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-page]');
        if (!btn) return;
        self._favPage = Number(btn.getAttribute('data-page'));
        paint();
      });
      User.bindCardClick(grid, grid.__list || []);
    },

    renderPlaylists: function (main, user) {
      var self = this;
      if (self._plView) { self.renderPlaylistDetail(main, user, self._plView); return; }

      main.innerHTML =
        '<div class="page-head">' +
          '<h2>我的菜单</h2>' +
          '<p class="sub">创建菜单把喜欢的菜谱归类，比如「快手菜」「周末硬菜」</p>' +
        '</div>' +
        '<form class="card form-grid" id="pl-form" style="max-width:640px">' +
          '<label class="field"><span>新建菜单</span>' +
            '<input type="text" id="pl-name" maxlength="20" placeholder="菜单名称（最多 20 字）" autocomplete="off">' +
          '</label>' +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">创建菜单</button></div>' +
        '</form>' +
        '<div id="pl-list"></div>';

      var host = main.querySelector('#pl-list');

      function renderList() {
        var items = user.playlists || [];
        if (!items.length) { host.innerHTML = '<div class="empty">还没有菜单，先创建一个吧</div>'; return; }
        host.innerHTML = items.map(function (p) {
          return '<div class="row-card" data-id="' + RM.escapeHtml(p.id) + '">' +
            '<div class="row-main">' +
              '<div class="row-title">' + RM.escapeHtml(p.name) + '</div>' +
              '<div class="row-sub">' + p.songIds.length + ' 道 · 创建于 ' +
                new Date(p.createdAt).toLocaleString() + '</div>' +
            '</div>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-sm btn-primary" data-act="open">管理</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-act="rename">重命名</button>' +
              '<button type="button" class="btn btn-sm btn-danger" data-act="delete">删除</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      renderList();

      main.querySelector('#pl-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var input = main.querySelector('#pl-name');
        var res = RM.Store.createPlaylist(user, input.value);
        if (!res.ok) { RM.toast(res.msg, 'error'); return; }
        input.value = ''; RM.toast('菜单已创建', 'ok'); renderList();
      });

      host.addEventListener('click', async function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var card = btn.closest('[data-id]');
        var id = card.getAttribute('data-id');
        var p = (user.playlists || []).filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        var act = btn.getAttribute('data-act');
        if (act === 'open') { self._plView = id; RM.rerender(); return; }
        if (act === 'rename') {
          var val = await RM.prompt({
            title: '重命名菜单', label: '新的菜单名称', value: p.name,
            validate: function (v) {
              var n = String(v || '').trim();
              if (!n) return '菜单名称不能为空';
              if (n.length > 20) return '不能超过 20 个字符';
              return null;
            }
          });
          if (val == null) return;
          var r2 = RM.Store.renamePlaylist(user, id, val);
          if (!r2.ok) { RM.toast(r2.msg, 'error'); return; }
          RM.toast('菜单已重命名', 'ok'); renderList(); return;
        }
        if (act === 'delete') {
          var ok = await RM.confirm({
            title: '删除菜单',
            message: '确定要删除菜单「' + p.name + '」吗？菜谱本身不会被删除。',
            confirmText: '删除', danger: true
          });
          if (!ok) return;
          RM.Store.deletePlaylist(user, id); RM.toast('菜单已删除'); renderList();
        }
      });
    },

    renderPlaylistDetail: function (main, user, id) {
      var self = this;
      var p = (user.playlists || []).filter(function (x) { return x.id === id; })[0];
      if (!p) { self._plView = null; RM.rerender(); return; }

      var recipes = RM.Store.recipesByIds(p.songIds);
      var all = RM.Store.allRecipes();

      main.innerHTML =
        '<div class="page-head">' +
          '<h2>' + RM.escapeHtml(p.name) + '</h2>' +
          '<p class="sub">共 ' + recipes.length + ' 道菜谱</p>' +
        '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">' +
          '<button type="button" class="btn btn-ghost" id="pl-back">返回菜单列表</button>' +
        '</div>' +
        '<div class="card" style="max-width:680px;margin-bottom:20px">' +
          '<h3 style="font-size:15px;margin-bottom:12px">添加菜谱</h3>' +
          (all.length
            ? '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
                '<select id="pl-add-sel" style="flex:1 1 240px">' +
                  all.map(function (r) {
                    return '<option value="' + RM.escapeHtml(r.id) + '">' +
                      RM.escapeHtml(r.title || r.name) + '</option>';
                  }).join('') +
                '</select>' +
                '<button type="button" class="btn btn-primary" id="pl-add-btn">添加</button>' +
              '</div>'
            : '<div class="sub">菜谱库为空</div>') +
        '</div>' +
        '<div class="recipe-grid" id="pl-grid"></div>';

      var grid = main.querySelector('#pl-grid');

      function paint() {
        var list = RM.Store.recipesByIds(p.songIds);
        if (!list.length) { grid.innerHTML = '<div class="empty">菜单里还没有菜谱</div>'; grid.__list = []; return; }
        grid.innerHTML = list.map(function (r, i) {
          return '<div class="recipe-card" data-idx="' + i + '">' +
            '<button type="button" class="fav-btn-recipe" data-remove="' + RM.escapeHtml(r.id) + '" title="移除">✕</button>' +
            '<div class="recipe-card-head">' +
              '<div class="recipe-card-title">' + RM.escapeHtml(r.title || r.name) + '</div>' +
            '</div>' +
            '<div class="recipe-card-meta">' +
              '<span>' + RM.escapeHtml(r.cuisine || '') + '</span>' +
              (r.time ? '<span>· ' + RM.escapeHtml(r.time) + '</span>' : '') +
            '</div>' +
          '</div>';
        }).join('');
        grid.__list = list.map(function (r) { return { recipe: r, match: null }; });
      }
      paint();

      main.querySelector('#pl-back').addEventListener('click', function () {
        self._plView = null; RM.rerender();
      });

      var addBtn = main.querySelector('#pl-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var sel = main.querySelector('#pl-add-sel');
          var res = RM.Store.addToPlaylist(user, p.id, sel.value);
          if (!res.ok) { RM.toast(res.msg, 'error'); return; }
          RM.toast('已加入菜单', 'ok'); paint();
        });
      }

      grid.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-remove]');
        if (rm) {
          e.stopPropagation();
          RM.Store.removeFromPlaylist(user, p.id, rm.getAttribute('data-remove'));
          RM.toast('已从菜单移除'); paint(); return;
        }
        var card = e.target.closest('.recipe-card');
        if (!card) return;
        var idx = Number(card.getAttribute('data-idx'));
        if (isNaN(idx) || !grid.__list[idx]) return;
        RM.Recipe.open(grid.__list[idx].recipe, null);
      });
    },

    renderProfile: function (main, user) {
      var favCount = (user.favorites || []).length;
      var plCount = (user.playlists || []).length;
      var hisCount = (user.history || []).length;
      var isSystemAdmin = user.uid === '000000';

      main.innerHTML =
        '<div class="page-head">' +
          '<h2>个人资料</h2>' +
          '<p class="sub">' + (isSystemAdmin
            ? '系统管理员用户名固定为「小鲨鱼」，不可修改；UID 由系统分配'
            : '可以修改自己的用户名，UID 由系统分配不可修改') + '</p>' +
        '</div>' +
        '<div class="card" style="max-width:560px;margin-bottom:20px">' +
          '<div class="row-card" style="box-shadow:none;padding:0 0 16px;margin-bottom:16px;border-bottom:1px solid var(--line)">' +
            '<div class="row-main">' +
              '<div class="row-title">当前用户名：' + RM.escapeHtml(user.username) + '</div>' +
              '<div class="row-sub">UID：' + RM.escapeHtml(user.uid) +
                (user.guest ? ' · 游客账户' : '') + '</div>' +
              '<div class="row-sub">收藏 ' + favCount + ' 道 · 菜单 ' + plCount +
                ' 个 · 最近查看 ' + hisCount + ' 道</div>' +
            '</div>' +
          '</div>' +
          '<form id="profile-form">' +
            '<label class="field"><span>新的用户名</span>' +
              '<input type="text" id="profile-name" value="' + RM.escapeHtml(user.username) + '"' +
                (isSystemAdmin ? ' disabled' : '') + ' autocomplete="off"></label>' +
            '<div class="form-msg" id="profile-msg"></div>' +
            '<button type="submit" class="btn btn-primary"' + (isSystemAdmin ? ' disabled' : '') + '>保存用户名</button>' +
          '</form>' +
        '</div>' +
        (user.guest ? '<div class="notice notice-warn" style="max-width:560px">游客账户首次登录后 24 小时自动销毁，届时将无法再登录。</div>' : '') +
        '<div class="notice notice-info" style="max-width:560px">演示站点：所有数据仅保存在当前浏览器中，清空浏览器缓存会恢复初始状态。</div>';

      var form = main.querySelector('#profile-form');
      var msg = main.querySelector('#profile-msg');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (isSystemAdmin) {
          msg.textContent = '系统管理员用户名固定为「小鲨鱼」，不可修改';
          msg.className = 'form-msg error'; return;
        }
        var name = main.querySelector('#profile-name').value.trim();
        var err = RM.validateUsername(name);
        if (err) { msg.textContent = err; msg.className = 'form-msg error'; return; }
        if (RM.Store.usernameExists(name, user.uid)) {
          msg.textContent = '该用户名已被占用（不区分英文大小写）';
          msg.className = 'form-msg error'; return;
        }
        user.username = name;
        user.usernameLower = name.toLowerCase();
        RM.Store.save();
        msg.textContent = '用户名已更新'; msg.className = 'form-msg ok';
        RM.toast('用户名已更新', 'ok'); RM.rerender();
      });
    },

    renderAbout: function (main) {
      main.innerHTML =
        '<div class="page-head">' +
          '<h2>关于</h2>' +
        '</div>' +
        '<div class="card" style="max-width:720px;margin-bottom:20px">' +
          '<h3 style="font-size:16px;margin-bottom:10px">覆盖范围</h3>' +
          '<p class="sub" style="line-height:1.9">' +
            '本网站通过「种子菜谱 + 菜系规则 + 味型模板 + 技法模板 + 食材同义词 + 替代规则」' +
            '覆盖全球主流家常菜谱类型，包括中国菜、日韩菜、东南亚菜、南亚菜、中东菜、' +
            '地中海菜、欧洲菜、美洲菜、非洲代表菜。<b>不承诺精确覆盖全球 80% 菜谱</b>，' +
            '仅提供类型覆盖与持续扩展能力。' +
          '</p>' +
        '</div>' +
        '<div class="card" style="max-width:720px;margin-bottom:20px">' +
          '<h3 style="font-size:16px;margin-bottom:10px">数据存储</h3>' +
          '<p class="sub" style="line-height:1.9">' +
            '所有用户数据（账号、收藏、菜单、历史、偏好）仅保存在当前浏览器的 localStorage 中。' +
            '官方菜谱库以 JSON 文件形式随站点托管在 <code>data/</code> 目录下，' +
            '按菜系分片加载' +
          '</p>' +
        '</div>' +
        '<div class="card" style="max-width:720px;margin-bottom:20px">' +
          '<h3 style="font-size:16px;margin-bottom:10px">安全说明</h3>' +
          '<p class="sub" style="line-height:1.9">' +
            '密码使用 Web Crypto API（SHA-256 + 固定盐）哈希存储，不以明文保存；' +
            '但纯前端版本的数据可被本地访问者查看或修改，不适合真正的多用户生产环境。' +
            '初始管理员用户名 小鲨鱼，密码写在种子逻辑中，仅作演示用途，请首次登录后立即修改。' +
          '</p>' +
        '</div>' +
        '<div class="card" style="max-width:720px">' +
          '<h3 style="font-size:16px;margin-bottom:10px">免责声明</h3>' +
          '<p class="sub" style="line-height:1.9">' +
            '菜谱为示例数据，供参考。请结合实际食材安全烹饪，注意过敏原（坚果、海鲜等）。' +
            '本站不承担因使用菜谱导致的任何责任。' +
          '</p>' +
        '</div>';
    }
  };

  window.__CUISINES_READY__ = (async function () {
    try {
      var c = await fetch('data/cuisines.json').then(function (r) { return r.json(); });
      CUISINES = c || [];
      var s = await fetch('data/synonyms.json').then(function (r) { return r.json(); });
      window.__SYNONYMS__ = s || {};
      var sub = await fetch('data/substitutions.json').then(function (r) { return r.json(); });
      window.__SUBSTITUTIONS__ = sub || {};
    } catch (e) {}
  })();
})(window);