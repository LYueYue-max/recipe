/* ============================================================
 * admin.js —— 管理员界面（菜谱版）
 * ============================================================ */
(function (window) {
  'use strict';
  var RM = window.RM;

  var NAV = [
    { type: 'link', path: '/admin/dashboard', icon: '🏠', label: '仪表盘' },
    { type: 'link', path: '/admin/library', icon: '📖', label: '菜谱库' },
    { type: 'link', path: '/admin/favorites', icon: '♥', label: '我的收藏' },
    { type: 'link', path: '/admin/playlists', icon: '📚', label: '我的菜单' },
    { type: 'link', path: '/admin/songs', icon: '🍳', label: '菜谱管理' },
    {
      type: 'group', key: 'users', icon: '👥', label: '用户管理',
      items: [
        { path: '/admin/users', label: '全部用户' },
        { path: '/admin/pending', label: '待审批注册', badgeKey: 'pending' },
        { path: '/admin/guests', label: '游客账户' },
        { path: '/admin/invites', label: '邀请码管理' }
      ]
    },
    {
      type: 'group', key: 'site', icon: '⚙️', label: '网站管理',
      items: [
        { path: '/admin/announcements', label: '公告管理' },
        { path: '/admin/logs', label: '操作日志' },
        { path: '/admin/backup', label: '备份与恢复' }
      ]
    },
    {
      type: 'group', key: 'account', icon: '🔒', label: '我的账户',
      items: [
        { path: '/admin/profile', label: '个人资料' },
        { path: '/admin/password', label: '修改密码' }
      ]
    }
  ];

  var Admin = RM.Admin = {
    _userPage: 1,
    _pendingPage: 1,
    _songPage: 1,
    _logPage: 1,
    _userTab: 'all',

    render: function (path) {
      var app = document.getElementById('app');
      var db = RM.Store.db;
      var user = RM.Store.currentUser();
      var pendingCount = db.users.filter(function (u) { return u.status === 'pending'; }).length;
      var unread = RM.Store.unreadCount(user);

      app.innerHTML =
        '<div class="shell">' +
          '<aside class="sidebar">' +
            '<div class="brand"><span class="brand-icon"><img src="ict.jpg" alt="logo"></span><span>小鲨鱼菜谱</span></div>' +
            '<div class="side-search">' +
              '<input type="search" id="admin-search" placeholder="搜索用户 / UID / 菜名"' +
                ' value="' + RM.escapeHtml(RM.adminQuery || '') + '" autocomplete="off">' +
            '</div>' +
            this.navHtml(path, pendingCount) +
            '<div class="sidebar-foot">' +
              '<button type="button" class="btn btn-ghost btn-block" id="notify-btn">🔔 通知中心' +
                (unread > 0 ? ' <span class="badge badge-danger" style="margin-left:6px">' + unread + '</span>' : '') +
              '</button>' +
              '<button type="button" class="btn btn-ghost btn-block" id="palette-btn">🎨 主题色</button>' +
              '<button type="button" class="btn btn-ghost btn-block" id="theme-toggle">' +
                (RM.Theme.get() === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式') + '</button>' +
              '<button type="button" class="btn btn-ghost btn-block" id="admin-logout">退出登录</button>' +
            '</div>' +
          '</aside>' +
          '<main class="main" id="main"></main>' +
        '</div>';

      document.getElementById('admin-logout').addEventListener('click', function () { RM.Auth.logout(); });
      document.getElementById('theme-toggle').addEventListener('click', function () {
        RM.Theme.toggle();
        this.textContent = RM.Theme.get() === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式';
      });
      document.getElementById('palette-btn').addEventListener('click', function () { RM.Accent.openDialog(); });
      document.getElementById('notify-btn').addEventListener('click', function () { RM.Notify.open(user); });

      var searchEl = document.getElementById('admin-search');
      searchEl.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        RM.adminQuery = searchEl.value.trim();
        if (RM.currentPath.indexOf('/admin/search') === 0) RM.rerender();
        else window.location.hash = '#/admin/search';
      });

      app.querySelector('.sidebar').addEventListener('click', function (e) {
        var head = e.target.closest('.nav-group-head');
        if (!head) return;
        head.parentNode.classList.toggle('open');
      });

      var main = document.getElementById('main');
      var self = this;

      if (path.indexOf('/admin/search') === 0) { self.renderSearch(main); return; }

      switch (path) {
        case '/admin/library': RM.User.renderLibrary(main, user); break;
        case '/admin/favorites': RM.User.renderFavorites(main, user); break;
        case '/admin/playlists': RM.User.renderPlaylists(main, user); break;
        case '/admin/profile': RM.User.renderProfile(main, user); break;
        case '/admin/pending': self.renderPending(main); break;
        case '/admin/users': self.renderUsers(main); break;
        case '/admin/invites': self.renderInvites(main); break;
        case '/admin/guests': self.renderGuests(main); break;
        case '/admin/songs': self.renderRecipesManage(main); break;
        case '/admin/password': self.renderPassword(main); break;
        case '/admin/announcements': self.renderAnnouncements(main); break;
        case '/admin/logs': self.renderLogs(main); break;
        case '/admin/backup': self.renderBackup(main); break;
        default: self.renderDashboard(main); break;
      }
    },

    navHtml: function (path, pendingCount) {
      return NAV.map(function (n) {
        if (n.type === 'group') {
          var hasActive = n.items.some(function (it) { return it.path === path; });
          var groupBadge = (n.key === 'users' && pendingCount > 0)
            ? '<span class="nav-count">' + pendingCount + '</span>' : '';
          var sub = n.items.map(function (it) {
            var active = it.path === path ? ' active' : '';
            var badge = (it.badgeKey === 'pending' && pendingCount > 0)
              ? '<span class="nav-count">' + pendingCount + '</span>' : '';
            return '<a class="nav-item nav-sub-item' + active + '" href="#' + it.path + '">' +
              '<span>' + it.label + '</span>' + badge + '</a>';
          }).join('');
          return '<div class="nav-group' + (hasActive ? ' open' : '') + '">' +
            '<button type="button" class="nav-item nav-group-head">' +
              '<span class="nav-ico">' + n.icon + '</span>' +
              '<span>' + n.label + '</span>' + groupBadge +
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

    renderDashboard: function (main) {
      var db = RM.Store.db;
      var all = RM.Store.allRecipes();
      var admins = db.users.filter(function (u) { return u.role === 'admin' && u.status === 'active'; }).length;
      var users = db.users.filter(function (u) { return u.role === 'user' && !u.guest; }).length;
      var pending = db.users.filter(function (u) { return u.status === 'pending'; }).length;
      var guests = db.users.filter(function (u) { return u.guest; }).length;
      var localRecipes = db.songs.length;
      var officialRecipes = (RM.Store._officialRecipes || []).length;

      var data = [];
      var now = new Date();
      for (var i = 6; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        var key = d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
        data.push({ key: key, label: (d.getMonth() + 1) + '/' + d.getDate() });
      }
      var regMap = {};
      db.users.forEach(function (u) {
        var d = new Date(u.createdAt);
        var k = d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
        regMap[k] = (regMap[k] || 0) + 1;
      });
      var stats = db.viewStats || {};
      data.forEach(function (row) { row.reg = regMap[row.key] || 0; row.view = stats[row.key] || 0; });

      function chartHtml(field) {
        var max = Math.max(1, Math.max.apply(null, data.map(function (r) { return r[field]; })));
        return '<div class="chart">' +
          data.map(function (r) {
            var h = Math.round((r[field] / max) * 100);
            return '<div class="chart-col" title="' + r.label + '：' + r[field] + '">' +
              '<div class="chart-value">' + r[field] + '</div>' +
              '<div class="chart-bar" style="height:' + Math.max(4, h) + '%"></div>' +
              '<div class="chart-label">' + r.label + '</div>' +
            '</div>';
          }).join('') +
        '</div>';
      }

      main.innerHTML =
        '<div class="page-head">' +
          '<h2>仪表盘</h2>' +
          '<p class="sub">欢迎回来，小鲨鱼。这里可以看到站点概览。</p>' +
        '</div>' +
        '<div class="stat-grid">' +
          '<div class="stat-card"><div class="stat-label">活跃管理员</div>' +
            '<div class="stat-value blue">' + admins + '</div></div>' +
          '<div class="stat-card"><div class="stat-label">普通用户</div>' +
            '<div class="stat-value blue">' + users + '</div></div>' +
          '<div class="stat-card"><div class="stat-label">待审批注册</div>' +
            '<div class="stat-value warn">' + pending + '</div></div>' +
          '<div class="stat-card"><div class="stat-label">游客账户</div>' +
            '<div class="stat-value mint">' + guests + '</div></div>' +
          '<div class="stat-card"><div class="stat-label">官方菜谱</div>' +
            '<div class="stat-value mint">' + officialRecipes + '</div></div>' +
          '<div class="stat-card"><div class="stat-label">本地新增菜谱</div>' +
            '<div class="stat-value blue">' + localRecipes + '</div></div>' +
          '<div class="stat-card"><div class="stat-label">菜谱总数</div>' +
            '<div class="stat-value blue">' + all.length + '</div></div>' +
        '</div>' +
        '<div class="card" style="margin-bottom:22px">' +
          '<h3 style="font-size:15px;margin-bottom:6px">近 7 天新增注册</h3>' +
          chartHtml('reg') +
        '</div>' +
        '<div class="card" style="margin-bottom:22px">' +
          '<h3 style="font-size:15px;margin-bottom:6px">近 7 天查看菜谱次数</h3>' +
          chartHtml('view') +
        '</div>' +
        '<div class="card">' +
          '<h3 style="margin-bottom:10px;font-size:16px">演示说明</h3>' +
          '<p class="sub" style="line-height:1.9">' +
            '本网站为纯前端静态菜谱站，所有用户数据（账号、收藏、菜单、历史、偏好）保存在当前浏览器的 localStorage 中。' +
          '</p>' +
          '<p class="sub" style="line-height:1.9;margin-top:8px">' +
            '官方菜谱库以 JSON 分片形式托管在 <code>data/</code>，按菜系独立加载，单文件远低于 5MB。' +
          '</p>' +
          '<p class="sub" style="line-height:1.9;margin-top:8px">' +
            '初始管理员：<b>小鲨鱼</b> / <b>xyy1314@</b>' +
          '</p>' +
        '</div>';
    },

    renderSearch: function (main) {
      var q = String(RM.adminQuery || '').trim();
      var lower = q.toLowerCase();
      main.innerHTML =
        '<div class="page-head"><h2>搜索结果</h2>' +
          '<p class="sub">关键词：' + (q ? RM.escapeHtml(q) : '（空）') + '</p></div>' +
        '<div id="search-result"></div>';

      var host = main.querySelector('#search-result');
      if (!q) { host.innerHTML = '<div class="empty">请输入用户名、UID 或菜名</div>'; return; }

      var users = RM.Store.db.users.filter(function (u) {
        return String(u.usernameLower).indexOf(lower) !== -1 || String(u.uid).indexOf(q) !== -1;
      });
      var recipes = RM.Store.allRecipes().filter(function (r) {
        return String(r.title || r.name).toLowerCase().indexOf(lower) !== -1;
      }).slice(0, 20);

      var self = this;
      host.innerHTML =
        '<h3 style="font-size:15px;margin-bottom:12px">用户（' + users.length + '）</h3>' +
        (users.length ? users.map(function (u) {
          return '<div class="row-card" data-uid="' + RM.escapeHtml(u.uid) + '">' +
            '<div class="row-main"><div class="row-title">' +
              '<button type="button" class="row-name-btn" data-open="' + RM.escapeHtml(u.uid) + '">' +
                RM.escapeHtml(u.username) + '</button> ' +
              '<span class="badge">UID ' + RM.escapeHtml(u.uid) + '</span>' +
              (u.role === 'admin' ? ' <span class="badge badge-primary">管理员</span>' : '') +
              (u.guest ? ' <span class="badge badge-mint">游客</span>' : '') +
            '</div></div></div>';
        }).join('') : '<div class="empty">没有匹配的用户</div>') +
        '<h3 style="font-size:15px;margin:24px 0 12px">菜谱（' + recipes.length + '）</h3>' +
        (recipes.length ? recipes.map(function (r) {
          return '<div class="row-card"><div class="row-main"><div class="row-title">' +
            RM.escapeHtml(r.title || r.name) + '</div>' +
            '<div class="row-sub">' + RM.escapeHtml(r.cuisine || '') + '</div></div></div>';
        }).join('') : '<div class="empty">没有匹配的菜谱</div>');

      host.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-open]');
        if (!btn) return;
        var u = RM.Store.getUserByUid(btn.getAttribute('data-open'));
        if (u) self.openUserDrawer(u);
      });
    },

    openUserDrawer: function (u) {
      var existingM = document.querySelector('.drawer-mask');
      var existingD = document.querySelector('.drawer');
      if (existingM) existingM.remove();
      if (existingD) existingD.remove();

      var favRecipes = RM.Store.recipesByIds(u.favorites || []);
      var plNames = (u.playlists || []).map(function (p) { return p.name + ' (' + p.songIds.length + ')'; });
      var relatedLogs = RM.Store.db.logs.filter(function (l) {
        return l.target === u.username || (l.detail || '').indexOf(u.uid) !== -1;
      }).slice(0, 15);

      var ban = RM.Store.banState(u);
      var freeze = RM.Store.freezeState(u);
      var banText = !ban.active ? '正常' : (ban.perm ? '永久封禁' : '封禁中');
      var freezeText = !freeze.active ? '正常' : (freeze.perm ? '永久冻结' : '冻结中');
      var statusText = u.status === 'pending' ? '待审批' : (u.status === 'rejected' ? '已拒绝' : '正常');
      var locked = u.loginFail && u.loginFail.until > Date.now();

      var host = document.getElementById('modal-host');
      var mask = document.createElement('div');
      mask.className = 'drawer-mask'; mask.id = 'drawer-mask';
      var drawer = document.createElement('aside');
      drawer.className = 'drawer'; drawer.id = 'user-drawer';

      drawer.innerHTML =
        '<div class="drawer-head"><h3>' + RM.escapeHtml(u.username) + '</h3>' +
          '<button type="button" class="icon-btn" id="drawer-close">✕</button></div>' +
        '<div class="drawer-body">' +
          '<div class="drawer-section">' +
            '<div class="drawer-kv"><span>UID</span><b>' + RM.escapeHtml(u.uid) + '</b></div>' +
            '<div class="drawer-kv"><span>角色</span><b>' +
              (u.role === 'admin' ? '管理员' : (u.guest ? '游客' : '普通用户')) + '</b></div>' +
            '<div class="drawer-kv"><span>状态</span><b>' + statusText + '</b></div>' +
            '<div class="drawer-kv"><span>封禁</span><b>' + banText + '</b></div>' +
            '<div class="drawer-kv"><span>冻结</span><b>' + freezeText + '</b></div>' +
            '<div class="drawer-kv"><span>登录锁定</span><b>' +
              (locked ? '锁定至 ' + new Date(u.loginFail.until).toLocaleString() : '未锁定') + '</b></div>' +
            '<div class="drawer-kv"><span>注册时间</span><b>' + new Date(u.createdAt).toLocaleString() + '</b></div>' +
          '</div>' +
          '<div class="drawer-section"><div class="drawer-title">收藏（' + favRecipes.length + '）</div>' +
            '<div class="drawer-tags">' + (favRecipes.length ? favRecipes.map(function (r) {
              return '<span class="chip">' + RM.escapeHtml(r.title || r.name) + '</span>';
            }).join('') : '<span class="sub">暂无</span>') + '</div></div>' +
          '<div class="drawer-section"><div class="drawer-title">菜单（' + (u.playlists || []).length + '）</div>' +
            '<div class="drawer-tags">' + (plNames.length ? plNames.map(function (n) {
              return '<span class="chip">' + RM.escapeHtml(n) + '</span>';
            }).join('') : '<span class="sub">暂无</span>') + '</div></div>' +
          '<div class="drawer-section"><div class="drawer-title">相关日志</div>' +
            (relatedLogs.length ? relatedLogs.map(function (l) {
              return '<div class="drawer-log"><div class="drawer-log-head">' +
                new Date(l.time).toLocaleString() + ' · ' + RM.escapeHtml(l.action) + '</div>' +
                '<div class="drawer-log-body">' + RM.escapeHtml(l.detail || '') + '</div></div>';
            }).join('') : '<span class="sub">暂无</span>') + '</div>' +
          (locked ? '<button type="button" class="btn btn-warn btn-block" id="drawer-unlock">解除登录锁定</button>' : '') +
        '</div>';

      host.appendChild(mask); host.appendChild(drawer);
      requestAnimationFrame(function () { mask.classList.add('open'); drawer.classList.add('open'); });

      function close() {
        mask.classList.remove('open'); drawer.classList.remove('open');
        setTimeout(function () {
          if (mask.parentNode) mask.parentNode.removeChild(mask);
          if (drawer.parentNode) drawer.parentNode.removeChild(drawer);
        }, 400);
      }
      document.getElementById('drawer-close').addEventListener('click', close);
      mask.addEventListener('click', close);

      var unlock = document.getElementById('drawer-unlock');
      if (unlock) {
        unlock.addEventListener('click', function () {
          u.loginFail = { count: 0, until: 0 };
          RM.Store.addLog('解除登录锁定', u.username, 'UID ' + u.uid);
          RM.toast('已解除登录锁定', 'ok'); close(); RM.rerender();
        });
      }
    },

    renderPending: function (main) {
      var self = this;
      var all = RM.Store.db.users.filter(function (u) { return u.status === 'pending'; });
      var paged = RM.pageSlice(all, self._pendingPage, 10);
      self._pendingPage = paged.page;

      main.innerHTML =
        '<div class="page-head"><h2>待审批注册</h2>' +
          '<p class="sub">共 ' + all.length + ' 个待审批账户</p></div>' +
        '<div id="pending-list"></div>';

      var host = main.querySelector('#pending-list');
      if (!all.length) { host.innerHTML = '<div class="empty">暂无待审批的注册申请 🎉</div>'; return; }

      host.innerHTML = paged.items.map(function (u) {
        return '<div class="row-card" data-uid="' + RM.escapeHtml(u.uid) + '">' +
          '<div class="row-main"><div class="row-title">' + RM.escapeHtml(u.username) +
            ' <span class="badge">UID ' + RM.escapeHtml(u.uid) + '</span>' +
            ' <span class="badge badge-warn">待审批</span></div>' +
            '<div class="row-sub">注册时间：' + new Date(u.createdAt).toLocaleString() +
              (u.invite ? ' · 使用了无效/不可用邀请码' : '') + '</div></div>' +
          '<div class="row-actions">' +
            '<button type="button" class="btn btn-sm btn-ok" data-act="approve">同意</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-act="reject">拒绝</button>' +
          '</div></div>';
      }).join('') + RM.pagerHtml(paged.page, paged.pages);

      host.addEventListener('click', function (e) {
        var pageBtn = e.target.closest('[data-page]');
        if (pageBtn) { self._pendingPage = Number(pageBtn.getAttribute('data-page')); RM.rerender(); return; }
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var card = btn.closest('[data-uid]');
        var uid = card.getAttribute('data-uid');
        var user = RM.Store.getUserByUid(uid);
        if (!user) return;
        var act = btn.getAttribute('data-act');
        if (act === 'approve') {
          user.status = 'active';
          RM.Store.addLog('审批通过', user.username, 'UID ' + user.uid);
          RM.toast('已同意 ' + user.username + ' 的注册申请', 'ok');
        } else {
          user.status = 'rejected';
          RM.Store.addLog('审批拒绝', user.username, 'UID ' + user.uid);
          RM.toast('已拒绝 ' + user.username + ' 的注册申请');
        }
        RM.rerender();
      });
    },

    renderUsers: function (main) {
      var self = this;
      var me = RM.Store.currentUser();
      var allUsers = RM.Store.db.users.filter(function (u) { return !u.guest && u.status !== 'pending' && u.status !== 'rejected'; });

      main.innerHTML =
        '<div class="page-head"><h2>用户管理</h2>' +
          '<p class="sub">共 ' + allUsers.length + ' 个用户（不含游客和待审批）</p></div>' +
        '<div class="card" style="margin-bottom:20px;max-width:820px">' +
          '<h3 style="font-size:15px;margin-bottom:14px">添加用户</h3>' +
          '<div class="form-grid">' +
            '<label class="field"><span>用户名</span><input type="text" id="nu-name" placeholder="用户名" autocomplete="off"></label>' +
            '<label class="field"><span>UID</span><input type="text" id="nu-uid" placeholder="6 位数字" autocomplete="off"></label>' +
            '<label class="field"><span>初始密码</span><input type="text" id="nu-pw" placeholder="用户首次登录需修改" autocomplete="off"></label>' +
            '<label class="field"><span>角色</span><select id="nu-role"><option value="user">普通用户</option><option value="admin">管理员</option></select></label>' +
            '<label class="field"><span>状态</span><select id="nu-status"><option value="active">启用</option><option value="disabled">禁用</option></select></label>' +
          '</div>' +
          '<div class="form-msg" id="nu-msg"></div>' +
          '<button type="button" class="btn btn-primary" id="nu-add">创建用户</button>' +
        '</div>' +
        '<div class="toolbar" style="margin-bottom:16px">' +
          '<button type="button" class="btn btn-sm ' + (self._userTab === 'all' ? 'btn-primary' : 'btn-ghost') + '" data-tab="all">全部用户</button>' +
          '<button type="button" class="btn btn-sm ' + (self._userTab === 'admin' ? 'btn-primary' : 'btn-ghost') + '" data-tab="admin">管理员</button>' +
          '<button type="button" class="btn btn-sm ' + (self._userTab === 'user' ? 'btn-primary' : 'btn-ghost') + '" data-tab="user">普通用户</button>' +
        '</div>' +
        '<div id="user-list"></div>';

      main.querySelector('.toolbar').addEventListener('click', function (e) {
        var b = e.target.closest('[data-tab]');
        if (!b) return;
        self._userTab = b.getAttribute('data-tab');
        self._userPage = 1;
        self.renderUsers(main);
      });

      main.querySelector('#nu-add').addEventListener('click', async function () {
        var name = main.querySelector('#nu-name').value.trim();
        var uid = main.querySelector('#nu-uid').value.trim();
        var pw = main.querySelector('#nu-pw').value;
        var role = main.querySelector('#nu-role').value;
        var status = main.querySelector('#nu-status').value;
        var msg = main.querySelector('#nu-msg');

        var err = RM.validateUsername(name);
        if (err) { msg.textContent = err; msg.className = 'form-msg error'; return; }
        if (RM.Store.usernameExists(name)) { msg.textContent = '用户名已被占用'; msg.className = 'form-msg error'; return; }
        var uidErr = RM.validateUid(uid);
        if (uidErr) { msg.textContent = uidErr; msg.className = 'form-msg error'; return; }
        if (uid === '000000') { msg.textContent = '该 UID 为系统保留'; msg.className = 'form-msg error'; return; }
        if (RM.Store.isUidTaken(uid)) { msg.textContent = '该 UID 已被占用'; msg.className = 'form-msg error'; return; }
        var pwErr = RM.validatePassword(pw);
        if (pwErr) { msg.textContent = pwErr; msg.className = 'form-msg error'; return; }

        var hash = await RM.hashPassword(pw);
        var newUser = {
          uid: uid, username: name, usernameLower: name.toLowerCase(),
          passHash: hash, role: role, status: status,
          mustChangePassword: true,
          createdAt: Date.now(),
          ban: { mode: 'none' }, freeze: { mode: 'none' },
          guest: false, guestExpireAt: null,
          history: [], favorites: [], playlists: [],
          readAnnouncements: [], notifications: [],
          loginFail: { count: 0, until: 0 }
        };
        RM.Store.db.users.push(newUser);
        RM.Store.addLog('添加用户', name, 'UID ' + uid + ' · ' + role + ' · ' + status);
        RM.Store.save();
        msg.textContent = '用户已创建（UID：' + uid + '），用户首次登录需修改密码';
        msg.className = 'form-msg ok';
        main.querySelector('#nu-name').value = '';
        main.querySelector('#nu-uid').value = '';
        main.querySelector('#nu-pw').value = '';
        self.renderUsers(main);
      });

      var filtered = allUsers.filter(function (u) {
        if (self._userTab === 'admin') return u.role === 'admin';
        if (self._userTab === 'user') return u.role === 'user';
        return true;
      });
      var paged = RM.pageSlice(filtered, self._userPage, 8);
      self._userPage = paged.page;

      var host = main.querySelector('#user-list');
      if (!filtered.length) { host.innerHTML = '<div class="empty">暂无用户</div>'; return; }

      var activeAdminCount = allUsers.filter(function (u) {
        return u.role === 'admin' && u.status === 'active';
      }).length;

      host.innerHTML = paged.items.map(function (u) {
        var ban = RM.Store.banState(u);
        var freeze = RM.Store.freezeState(u);
        var locked = u.loginFail && u.loginFail.until > Date.now();
        var isMe = u.uid === me.uid;
        var isSystemAdmin = u.uid === '000000';
        var isLastAdmin = u.role === 'admin' && activeAdminCount <= 1;

        var statusBadge = u.status === 'active'
          ? '<span class="badge badge-ok">正常</span>'
          : '<span class="badge">已禁用</span>';
        var banBadge = ban.active ? (ban.perm
          ? '<span class="badge badge-danger">永久封禁</span>'
          : '<span class="badge badge-danger">封禁中 · 还剩 <b data-countdown data-end="' + ban.end + '"></b></span>') : '';
        var freezeBadge = freeze.active ? (freeze.perm
          ? '<span class="badge badge-primary">永久冻结</span>'
          : '<span class="badge badge-primary">冻结中 · 还剩 <b data-countdown data-end="' + freeze.end + '"></b></span>') : '';
        var lockBadge = locked ? '<span class="badge badge-warn">登录锁定中</span>' : '';
        var meBadge = isMe ? '<span class="badge badge-primary">当前账户</span>' : '';
        var lastBadge = isLastAdmin ? '<span class="badge badge-warn">最后管理员</span>' : '';
        var roleBadge = u.role === 'admin'
          ? '<span class="badge badge-primary">管理员</span>'
          : '<span class="badge">普通用户</span>';

        var ops = '';
        if (isMe) {
          ops = '<span class="sub" style="font-size:12px">不能操作自己</span>';
        } else {
          ops =
            '<button type="button" class="btn btn-sm btn-ghost" data-act="rename"' +
              (isSystemAdmin ? ' disabled title="系统管理员用户名固定"' : '') + '>改用户名</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-act="reuid"' +
              (isSystemAdmin ? ' disabled title="系统管理员 UID 固定"' : '') + '>改 UID</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-act="repwd">改密码</button>';
          if (u.status === 'active') {
            ops += '<button type="button" class="btn btn-sm btn-warn" data-act="disable"' +
              (isLastAdmin || isSystemAdmin ? ' disabled title="不能禁用该账户"' : '') + '>禁用</button>';
          } else {
            ops += '<button type="button" class="btn btn-sm btn-ok" data-act="enable">启用</button>';
          }
          if (u.role === 'admin') {
            ops += '<button type="button" class="btn btn-sm btn-ghost" data-act="demote"' +
              (isLastAdmin || isSystemAdmin ? ' disabled title="不能降级该账户"' : '') + '>降为用户</button>';
          } else {
            ops += '<button type="button" class="btn btn-sm btn-ghost" data-act="promote">升为管理员</button>';
          }
          ops += '<button type="button" class="btn btn-sm btn-danger" data-act="delete"' +
            (isLastAdmin || isSystemAdmin ? ' disabled title="不能删除该账户"' : '') + '>删除</button>';
        }

        return '<div class="row-card" data-uid="' + RM.escapeHtml(u.uid) + '">' +
          '<div class="row-main">' +
            '<div class="row-title">' +
              '<button type="button" class="row-name-btn" data-open="' + RM.escapeHtml(u.uid) + '">' +
                RM.escapeHtml(u.username) + '</button>' +
              ' <span class="badge">UID ' + RM.escapeHtml(u.uid) + '</span> ' +
              roleBadge + statusBadge + banBadge + freezeBadge + lockBadge + meBadge + lastBadge +
            '</div>' +
            '<div class="row-sub">注册时间：' + new Date(u.createdAt).toLocaleString() + '</div>' +
          '</div>' +
          '<div class="row-actions">' + ops + '</div>' +
        '</div>';
      }).join('') + RM.pagerHtml(paged.page, paged.pages);

      host.addEventListener('click', function (e) {
        var pageBtn = e.target.closest('[data-page]');
        if (pageBtn) { self._userPage = Number(pageBtn.getAttribute('data-page')); self.renderUsers(main); return; }
        var openBtn = e.target.closest('[data-open]');
        if (openBtn) { var ou = RM.Store.getUserByUid(openBtn.getAttribute('data-open')); if (ou) self.openUserDrawer(ou); return; }
        var btn = e.target.closest('button[data-act]');
        if (!btn || btn.disabled) return;
        var card = btn.closest('[data-uid]');
        var uid = card.getAttribute('data-uid');
        var user = RM.Store.getUserByUid(uid);
        if (!user) return;
        var act = btn.getAttribute('data-act');

        if (act === 'rename') self.actionRename(user);
        else if (act === 'reuid') self.actionChangeUid(user);
        else if (act === 'repwd') self.actionChangePassword(user);
        else if (act === 'disable') self.actionSetStatus(user, 'disabled', activeAdminCount);
        else if (act === 'enable') self.actionSetStatus(user, 'active', activeAdminCount);
        else if (act === 'promote') self.actionSetRole(user, 'admin');
        else if (act === 'demote') self.actionSetRole(user, 'user', activeAdminCount);
        else if (act === 'delete') self.actionDeleteUser(user, activeAdminCount);
      });
    },

    _lastAdminGuard: function (target, activeAdminCount) {
      var me = RM.Store.currentUser();
      if (target.uid === '000000') return '系统管理员账户不可执行此操作';
      if (target.uid === me.uid) return '不能对自己执行此操作';
      if (target.role === 'admin' && activeAdminCount <= 1) return '不能操作最后一个管理员';
      return null;
    },

    actionSetStatus: async function (user, status, activeAdminCount) {
      var err = this._lastAdminGuard(user, activeAdminCount);
      if (err) { RM.toast(err, 'error'); return; }
      var label = status === 'disabled' ? '禁用' : '启用';
      var ok = await RM.confirm({
        title: label + '用户', message: '确定要' + label + '「' + user.username + '」吗？',
        confirmText: label, danger: status === 'disabled'
      });
      if (!ok) return;
      user.status = status;
      RM.Store.addLog(label + '用户', user.username, 'UID ' + user.uid);
      RM.Store.save(); RM.toast('已' + label, 'ok'); RM.rerender();
    },

    actionSetRole: async function (user, role, activeAdminCount) {
      var err = this._lastAdminGuard(user, activeAdminCount || 0);
      if (err) { RM.toast(err, 'error'); return; }
      var label = role === 'admin' ? '升为管理员' : '降为普通用户';
      var ok = await RM.confirm({
        title: label, message: '确定要将「' + user.username + '」' + label + '吗？',
        confirmText: '确定', danger: role === 'user'
      });
      if (!ok) return;
      user.role = role;
      RM.Store.addLog(label, user.username, 'UID ' + user.uid);
      RM.Store.save(); RM.toast('角色已更新', 'ok'); RM.rerender();
    },

    actionDeleteUser: async function (user, activeAdminCount) {
      var err = this._lastAdminGuard(user, activeAdminCount);
      if (err) { RM.toast(err, 'error'); return; }
      var ok = await RM.confirm({
        title: '删除用户',
        message: '确定要删除用户「' + user.username + '」吗？删除后不可恢复。',
        confirmText: '删除', danger: true
      });
      if (!ok) return;
      var pw = await RM.prompt({
        title: '验证管理员密码',
        label: '删除用户需要验证管理员密码',
        type: 'password', placeholder: '请输入管理员密码', confirmText: '验证并删除'
      });
      if (pw == null) return;
      var okPw = await RM.Auth.verifyAdminPassword(pw);
      if (!okPw) { RM.toast('管理员密码不正确', 'error'); return; }
      RM.Store.removeUser(user.uid);
      RM.Store.addLog('删除用户', user.username, 'UID ' + user.uid);
      RM.toast('已删除用户', 'ok'); RM.rerender();
    },

    actionRename: async function (user) {
      if (user.uid === '000000') { RM.toast('系统管理员用户名固定为「小鲨鱼」，不可修改', 'error'); return; }
      var val = await RM.prompt({
        title: '修改用户名',
        label: '新的用户名（不允许空白、控制字符及 / \\ : * ? " < > | ）',
        value: user.username,
        validate: function (v) {
          var err = RM.validateUsername(v);
          if (err) return err;
          if (RM.Store.usernameExists(v, user.uid)) return '该用户名已被占用';
          return null;
        }
      });
      if (val == null) return;
      user.username = val.trim();
      user.usernameLower = user.username.toLowerCase();
      RM.Store.addLog('修改用户名', user.username, 'UID ' + user.uid);
      RM.Store.save(); RM.toast('用户名已更新', 'ok'); RM.rerender();
    },

    actionChangeUid: async function (user) {
      if (user.uid === '000000') { RM.toast('系统管理员 UID 固定，不可修改', 'error'); return; }
      var val = await RM.prompt({
        title: '修改 UID', label: '新的 UID（6 位纯数字）', value: user.uid,
        validate: function (v) {
          var err = RM.validateUid(String(v).trim());
          if (err) return err;
          if (String(v).trim() === '000000') return '该 UID 为系统保留';
          if (RM.Store.isUidTaken(String(v).trim(), user.uid)) return '该 UID 已被占用';
          return null;
        }
      });
      if (val == null) return;
      var newUid = String(val).trim();
      var oldUid = user.uid;
      user.uid = newUid;
      var s = RM.Store.getSession();
      if (s && s.uid === oldUid) { s.uid = newUid; RM.Store.setSession(s); }
      RM.Store.addLog('修改 UID', user.username, oldUid + ' → ' + newUid);
      RM.Store.save(); RM.toast('UID 已更新为 ' + newUid, 'ok'); RM.rerender();
    },

    actionChangePassword: async function (user) {
      var val = await RM.prompt({
        title: '重置用户密码',
        label: '为「' + user.username + '」设置新密码（用户下次登录需修改）',
        type: 'text', placeholder: '输入新密码',
        validate: function (v) { return RM.validatePassword(v); }
      });
      if (val == null) return;
      user.passHash = await RM.hashPassword(val);
      user.mustChangePassword = true;
      RM.Store.addLog('重置密码', user.username, 'UID ' + user.uid);
      RM.Store.save(); RM.toast('密码已更新', 'ok');
    },

    renderInvites: function (main) {
      main.innerHTML =
        '<div class="page-head"><h2>邀请码管理</h2>' +
          '<p class="sub">使用有效邀请码注册可跳过管理员审批，直接激活账户</p></div>' +
        '<form class="card form-grid" id="invite-form">' +
          '<label class="field"><span>邀请码</span>' +
            '<input type="text" id="inv-code" placeholder="自定义码值，例如 VIP2024" autocomplete="off"></label>' +
          '<label class="field"><span>最大使用次数</span>' +
            '<select id="inv-max"><option value="1">1 次</option><option value="2">2 次</option><option value="3">3 次</option></select></label>' +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">创建邀请码</button></div>' +
        '</form>' +
        '<div id="invite-list"></div>';

      var host = main.querySelector('#invite-list');

      function renderList() {
        var items = RM.Store.db.invites;
        if (!items.length) { host.innerHTML = '<div class="empty">还没有邀请码</div>'; return; }
        host.innerHTML = items.map(function (inv) {
          var exhausted = inv.used >= inv.maxUses;
          var badge = !inv.enabled ? '<span class="badge">已停用</span>'
            : (exhausted ? '<span class="badge badge-warn">已用尽</span>' : '<span class="badge badge-ok">可用</span>');
          return '<div class="row-card" data-code="' + RM.escapeHtml(inv.code) + '">' +
            '<div class="row-main"><div class="row-title">' + RM.escapeHtml(inv.code) + ' ' + badge + '</div>' +
              '<div class="row-sub">已使用 ' + inv.used + ' / ' + inv.maxUses + ' 次 · 创建于 ' +
                new Date(inv.createdAt).toLocaleString() + '</div></div>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-sm btn-ghost" data-act="toggle">' +
                (inv.enabled ? '停用' : '启用') + '</button>' +
              '<button type="button" class="btn btn-sm btn-danger" data-act="delete">删除</button>' +
            '</div></div>';
        }).join('');
      }
      renderList();

      main.querySelector('#invite-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var code = main.querySelector('#inv-code').value.trim();
        var max = Number(main.querySelector('#inv-max').value);
        if (!code) { RM.toast('邀请码不能为空', 'error'); return; }
        if (code.length > 40) { RM.toast('邀请码不能超过 40 个字符', 'error'); return; }
        if (RM.Store.findInvite(code)) { RM.toast('该邀请码已存在（不区分大小写）', 'error'); return; }
        RM.Store.db.invites.push({
          code: code, maxUses: Math.max(1, Math.min(3, max)),
          used: 0, enabled: true, createdAt: Date.now()
        });
        RM.Store.addLog('创建邀请码', code, '上限 ' + max + ' 次');
        main.querySelector('#inv-code').value = '';
        RM.toast('邀请码已创建', 'ok'); renderList();
      });

      host.addEventListener('click', async function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var card = btn.closest('[data-code]');
        var inv = RM.Store.findInvite(card.getAttribute('data-code'));
        if (!inv) return;
        var act = btn.getAttribute('data-act');
        if (act === 'toggle') {
          inv.enabled = !inv.enabled;
          RM.Store.addLog(inv.enabled ? '启用邀请码' : '停用邀请码', inv.code, '');
          RM.Store.save(); RM.toast(inv.enabled ? '邀请码已启用' : '邀请码已停用'); renderList();
        } else if (act === 'delete') {
          var ok = await RM.confirm({
            title: '删除邀请码', message: '确定要删除邀请码「' + inv.code + '」吗？',
            confirmText: '删除', danger: true
          });
          if (!ok) return;
          RM.Store.db.invites = RM.Store.db.invites.filter(function (x) { return x.code !== inv.code; });
          RM.Store.addLog('删除邀请码', inv.code, '');
          RM.Store.save(); RM.toast('邀请码已删除'); renderList();
        }
      });
    },

    renderGuests: function (main) {
      main.innerHTML =
        '<div class="page-head"><h2>游客账户</h2>' +
          '<p class="sub">游客首次登录后开始 24 小时倒计时，到期自动销毁</p></div>' +
        '<form class="card form-grid" id="guest-form">' +
          '<label class="field"><span>游客用户名</span>' +
            '<input type="text" id="guest-name" placeholder="例如 访客小明" autocomplete="off"></label>' +
          '<label class="field"><span>游客密码</span>' +
            '<input type="text" id="guest-pw" placeholder="设置一个密码" autocomplete="off"></label>' +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">创建游客账户</button></div>' +
        '</form>' +
        '<div id="guest-list"></div>';

      var host = main.querySelector('#guest-list');

      function renderList() {
        var items = RM.Store.db.users.filter(function (u) { return u.guest; });
        if (!items.length) { host.innerHTML = '<div class="empty">还没有游客账户</div>'; return; }
        host.innerHTML = items.map(function (u) {
          var statusHtml = !u.guestExpireAt
            ? '<span class="badge badge-mint">未激活（首次登录开始计时）</span>'
            : '<span class="badge badge-warn">将在 <b data-countdown data-end="' + u.guestExpireAt + '"></b> 后销毁</span>';
          return '<div class="row-card" data-uid="' + RM.escapeHtml(u.uid) + '">' +
            '<div class="row-main"><div class="row-title">' + RM.escapeHtml(u.username) +
              ' <span class="badge">UID ' + RM.escapeHtml(u.uid) + '</span> ' + statusHtml + '</div>' +
              '<div class="row-sub">创建时间：' + new Date(u.createdAt).toLocaleString() + '</div></div>' +
            '<div class="row-actions"><button type="button" class="btn btn-sm btn-danger" data-act="destroy">销毁</button></div></div>';
        }).join('');
      }
      renderList();

      main.querySelector('#guest-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var name = main.querySelector('#guest-name').value.trim();
        var pw = main.querySelector('#guest-pw').value;
        var err = RM.validateUsername(name);
        if (err) { RM.toast(err, 'error'); return; }
        if (RM.Store.usernameExists(name)) { RM.toast('用户名已被占用', 'error'); return; }
        var pwErr = RM.validatePassword(pw);
        if (pwErr) { RM.toast(pwErr, 'error'); return; }
        var uid = RM.Store.generateUid();
        var hash = await RM.hashPassword(pw);
        RM.Store.db.users.push({
          uid: uid, username: name, usernameLower: name.toLowerCase(),
          passHash: hash, role: 'guest', status: 'active',
          createdAt: Date.now(),
          ban: { mode: 'none' }, freeze: { mode: 'none' },
          guest: true, guestExpireAt: null,
          history: [], favorites: [], playlists: [],
          readAnnouncements: [], notifications: [],
          loginFail: { count: 0, until: 0 }
        });
        RM.Store.addLog('创建游客', name, 'UID ' + uid);
        RM.Store.save();
        main.querySelector('#guest-name').value = '';
        main.querySelector('#guest-pw').value = '';
        RM.toast('游客账户已创建，UID：' + uid, 'ok'); renderList();
      });

      host.addEventListener('click', async function (e) {
        var btn = e.target.closest('button[data-act="destroy"]');
        if (!btn) return;
        var card = btn.closest('[data-uid]');
        var uid = card.getAttribute('data-uid');
        var user = RM.Store.getUserByUid(uid);
        if (!user) return;
        var ok = await RM.confirm({
          title: '销毁游客账户', message: '确定要销毁游客账户「' + user.username + '」吗？销毁后无法再登录。',
          confirmText: '销毁', danger: true
        });
        if (!ok) return;
        RM.Store.removeUser(uid);
        RM.Store.addLog('销毁游客', user.username, 'UID ' + uid);
        RM.toast('游客账户已销毁'); renderList();
      });
    },

    renderRecipesManage: function (main) {
      var self = this;
      main.innerHTML =
        '<div class="page-head"><h2>菜谱管理</h2>' +
          '<p class="sub">管理员可添加本地菜谱（写入 localStorage），官方菜谱库在 data/ 目录下只读</p></div>' +
        '<form class="card form-grid" id="recipe-form">' +
          '<label class="field"><span>菜名</span>' +
            '<input type="text" id="r-title" placeholder="例如 番茄炒蛋" autocomplete="off"></label>' +
          '<label class="field"><span>菜系</span>' +
            '<input type="text" id="r-cuisine" placeholder="例如 中国菜 · 家常" autocomplete="off"></label>' +
          '<label class="field"><span>主食材（逗号分隔）</span>' +
            '<input type="text" id="r-main" placeholder="番茄、鸡蛋" autocomplete="off"></label>' +
          '<label class="field"><span>调料（逗号分隔）</span>' +
            '<input type="text" id="r-sea" placeholder="盐、糖、食用油" autocomplete="off"></label>' +
          '<label class="field"><span>难度</span>' +
            '<select id="r-diff"><option>简单</option><option>中等</option><option>进阶</option></select></label>' +
          '<label class="field"><span>时间</span>' +
            '<input type="text" id="r-time" placeholder="例如 10 分钟" autocomplete="off"></label>' +
          '<label class="field"><span>份量</span>' +
            '<input type="text" id="r-serv" placeholder="例如 2 人份" autocomplete="off"></label>' +
          '<label class="field" style="grid-column:1/-1"><span>步骤（每行一步）</span>' +
            '<textarea id="r-steps" rows="4" placeholder="番茄切块，鸡蛋打散&#10;热油炒蛋盛出&#10;..."></textarea></label>' +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">添加菜谱</button></div>' +
        '</form>' +
        '<div id="recipe-admin-list"></div>';

      var host = main.querySelector('#recipe-admin-list');

      function renderList() {
        var local = RM.Store.db.songs.slice().sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
        if (!local.length) { host.innerHTML = '<div class="empty">还没有本地新增菜谱</div>'; return; }
        var paged = RM.pageSlice(local, self._songPage, 8);
        self._songPage = paged.page;
        host.innerHTML = paged.items.map(function (r) {
          return '<div class="row-card" data-id="' + RM.escapeHtml(r.id) + '">' +
            '<div class="row-main"><div class="row-title">' + RM.escapeHtml(r.title || r.name) +
              ' <span class="badge">查看 ' + (r.views || 0) + ' 次</span></div>' +
              '<div class="row-sub">' + RM.escapeHtml(r.cuisine || '') + ' · ' +
                RM.escapeHtml(r.difficulty || '') + ' · ' + RM.escapeHtml(r.time || '') + '</div></div>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-sm btn-ghost" data-act="preview">详情</button>' +
              '<button type="button" class="btn btn-sm btn-danger" data-act="delete">删除</button>' +
            '</div></div>';
        }).join('') + RM.pagerHtml(paged.page, paged.pages);
      }
      renderList();

      main.querySelector('#recipe-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var title = main.querySelector('#r-title').value.trim();
        var cuisine = main.querySelector('#r-cuisine').value.trim();
        var mainIng = RM.RecipeUtil.parseItems(main.querySelector('#r-main').value);
        var sea = RM.RecipeUtil.parseItems(main.querySelector('#r-sea').value);
        var diff = main.querySelector('#r-diff').value;
        var time = main.querySelector('#r-time').value.trim();
        var serv = main.querySelector('#r-serv').value.trim();
        var stepsRaw = main.querySelector('#r-steps').value;
        var steps = stepsRaw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);

        if (!title) { RM.toast('菜名不能为空', 'error'); return; }
        if (!mainIng.length) { RM.toast('主食材不能为空', 'error'); return; }
        if (!steps.length) { RM.toast('步骤不能为空', 'error'); return; }

        RM.Store.db.songs.push({
          id: RM.uid('recipe'), title: title, cuisine: cuisine,
          mainIngredients: mainIng, seasonings: sea, steps: steps,
          difficulty: diff, time: time, servings: serv,
          dietTags: [], optional: [], notes: '',
          views: 0, addedAt: Date.now()
        });
        RM.Store.addLog('添加菜谱', title, cuisine);
        RM.Store.save();
        main.querySelector('#recipe-form').reset();
        RM.toast('菜谱已添加', 'ok'); renderList();
      });

      host.addEventListener('click', async function (e) {
        var pageBtn = e.target.closest('[data-page]');
        if (pageBtn) { self._songPage = Number(pageBtn.getAttribute('data-page')); renderList(); return; }
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var card = btn.closest('[data-id]');
        var id = card.getAttribute('data-id');
        var r = RM.Store.songById(id);
        if (!r) return;
        var act = btn.getAttribute('data-act');
        if (act === 'preview') { RM.Recipe.open(r, null); return; }
        if (act === 'delete') {
          var ok = await RM.confirm({
            title: '删除菜谱', message: '确定要删除《' + (r.title || r.name) + '》吗？',
            confirmText: '删除', danger: true
          });
          if (!ok) return;
          RM.Store.db.songs = RM.Store.db.songs.filter(function (s) { return s.id !== id; });
          RM.Store.addLog('删除菜谱', r.title || r.name, '');
          RM.Store.save(); RM.toast('菜谱已删除'); renderList();
        }
      });
    },

    renderAnnouncements: function (main) {
      main.innerHTML =
        '<div class="page-head"><h2>公告管理</h2>' +
          '<p class="sub">发布的公告会显示在食材匹配页顶部，置顶公告优先展示</p></div>' +
        '<form class="card" id="ann-form" style="margin-bottom:24px">' +
          '<label class="field"><span>公告标题</span>' +
            '<input type="text" id="ann-title" maxlength="60" placeholder="例如 站点维护通知" autocomplete="off"></label>' +
          '<label class="field"><span>公告内容</span>' +
            '<input type="text" id="ann-content" maxlength="300" placeholder="填写公告正文" autocomplete="off"></label>' +
          '<label class="field" style="display:flex;align-items:center;gap:8px">' +
            '<input type="checkbox" id="ann-pinned" style="width:auto"><span style="margin:0">置顶显示</span></label>' +
          '<button type="submit" class="btn btn-primary">发布公告</button>' +
        '</form>' +
        '<div id="ann-list"></div>';

      var host = main.querySelector('#ann-list');
      function renderList() {
        var items = RM.Store.db.announcements.slice().sort(function (a, b) {
          return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.createdAt - a.createdAt);
        });
        if (!items.length) { host.innerHTML = '<div class="empty">还没有公告</div>'; return; }
        host.innerHTML = items.map(function (a) {
          return '<div class="row-card" data-id="' + RM.escapeHtml(a.id) + '">' +
            '<div class="row-main"><div class="row-title">' + (a.pinned ? '📌 ' : '') + RM.escapeHtml(a.title) +
              (a.enabled ? ' <span class="badge badge-ok">展示中</span>' : ' <span class="badge">已隐藏</span>') + '</div>' +
              '<div class="row-sub">' + RM.escapeHtml(a.content) + '</div>' +
              '<div class="row-sub">' + new Date(a.createdAt).toLocaleString() + '</div></div>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-sm btn-ghost" data-act="pin">' + (a.pinned ? '取消置顶' : '置顶') + '</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-act="toggle">' + (a.enabled ? '隐藏' : '展示') + '</button>' +
              '<button type="button" class="btn btn-sm btn-danger" data-act="delete">删除</button>' +
            '</div></div>';
        }).join('');
      }
      renderList();

      main.querySelector('#ann-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var title = main.querySelector('#ann-title').value;
        var content = main.querySelector('#ann-content').value;
        var pinned = main.querySelector('#ann-pinned').checked;
        var res = RM.Store.addAnnouncement(title, content, pinned);
        if (!res.ok) { RM.toast(res.msg, 'error'); return; }
        RM.Store.addLog('发布公告', String(title).trim(), pinned ? '置顶' : '');
        main.querySelector('#ann-title').value = '';
        main.querySelector('#ann-content').value = '';
        main.querySelector('#ann-pinned').checked = false;
        RM.toast('公告已发布', 'ok'); renderList();
      });

      host.addEventListener('click', async function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var card = btn.closest('[data-id]');
        var id = card.getAttribute('data-id');
        var ann = RM.Store.getAnnouncement(id);
        if (!ann) return;
        var act = btn.getAttribute('data-act');
        if (act === 'pin') { ann.pinned = !ann.pinned; RM.Store.save(); RM.toast(ann.pinned ? '已置顶' : '已取消置顶'); renderList(); }
        else if (act === 'toggle') { ann.enabled = !ann.enabled; RM.Store.save(); RM.toast(ann.enabled ? '公告已展示' : '公告已隐藏'); renderList(); }
        else if (act === 'delete') {
          var ok = await RM.confirm({
            title: '删除公告', message: '确定要删除公告「' + ann.title + '」吗？',
            confirmText: '删除', danger: true
          });
          if (!ok) return;
          RM.Store.removeAnnouncement(id);
          RM.Store.addLog('删除公告', ann.title, '');
          RM.Store.save(); RM.toast('公告已删除'); renderList();
        }
      });
    },

    renderLogs: function (main) {
      var self = this;
      var all = RM.Store.db.logs.slice();
      self._logPage = 1;

      main.innerHTML =
        '<div class="page-head"><h2>操作日志</h2>' +
          '<p class="sub">共 ' + all.length + ' 条记录（最多保留 500 条）</p></div>' +
        '<div style="margin-bottom:16px">' +
          '<button type="button" class="btn btn-sm btn-danger" id="clear-logs"' +
            (all.length ? '' : ' disabled') + '>清空日志</button></div>' +
        '<div id="log-host"></div>';

      var host = main.querySelector('#log-host');
      function paint() {
        var items = RM.Store.db.logs.slice();
        var paged = RM.pageSlice(items, self._logPage, 20);
        self._logPage = paged.page;
        if (!items.length) { host.innerHTML = '<div class="empty">暂无操作日志</div>'; return; }
        host.innerHTML = '<div class="log-list">' + paged.items.map(function (l) {
          return '<div class="log-item"><div class="log-time">' + new Date(l.time).toLocaleString() + '</div>' +
            '<div class="log-main"><div class="log-action">' + RM.escapeHtml(l.action) +
              (l.target ? ' · ' + RM.escapeHtml(l.target) : '') + '</div>' +
              '<div class="log-detail">操作人：' + RM.escapeHtml(l.actor) +
                (l.detail ? ' · ' + RM.escapeHtml(l.detail) : '') + '</div></div></div>';
        }).join('') + '</div>' + RM.pagerHtml(paged.page, paged.pages);
      }
      paint();

      main.querySelector('#clear-logs').addEventListener('click', async function () {
        var ok = await RM.confirm({
          title: '清空日志', message: '确定要清空全部操作日志吗？此操作不可恢复。',
          confirmText: '清空', danger: true
        });
        if (!ok) return;
        RM.Store.db.logs = [];
        RM.Store.addLog('清空日志', '', '');
        RM.Store.save(); RM.toast('日志已清空', 'ok'); RM.rerender();
      });

      host.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-page]');
        if (!btn) return;
        self._logPage = Number(btn.getAttribute('data-page'));
        paint();
      });
    },

    renderBackup: function (main) {
      main.innerHTML =
        '<div class="page-head"><h2>备份与恢复</h2>' +
          '<p class="sub">导出当前浏览器中的全部用户数据（不含官方菜谱库）或从 JSON 文件恢复</p></div>' +
        '<div class="card" style="max-width:680px;margin-bottom:20px">' +
          '<h3 style="font-size:16px;margin-bottom:8px">导出数据</h3>' +
          '<p class="sub" style="margin-bottom:14px">将用户、邀请码、本地菜谱、公告、日志等全部数据导出为 JSON 文件。</p>' +
          '<button type="button" class="btn btn-primary" id="btn-export">导出 JSON</button></div>' +
        '<div class="card" style="max-width:680px;margin-bottom:20px">' +
          '<h3 style="font-size:16px;margin-bottom:8px">导入数据</h3>' +
          '<p class="sub" style="margin-bottom:14px">选择之前导出的 JSON 文件覆盖当前数据。导入后需要重新登录。</p>' +
          '<input type="file" id="file-import" accept="application/json,.json"></div>' +
        '<div class="card" style="max-width:680px">' +
          '<h3 style="font-size:16px;margin-bottom:8px">重置为初始数据</h3>' +
          '<p class="sub" style="margin-bottom:14px">清空全部本地数据并恢复种子状态（管理员 小鲨鱼 / xyy1314@）。</p>' +
          '<button type="button" class="btn btn-danger" id="btn-reset">重置全部数据</button></div>';

      main.querySelector('#btn-export').addEventListener('click', function () {
        var text = RM.Store.exportJSON();
        var blob = new Blob([text], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'round-recipe-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        RM.toast('已导出数据文件', 'ok');
      });

      main.querySelector('#file-import').addEventListener('change', async function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var text;
        try { text = await file.text(); }
        catch (err) { RM.toast('读取文件失败', 'error'); return; }
        var confirmed = await RM.confirm({
          title: '导入数据', message: '导入将覆盖当前全部数据，确定继续吗？',
          confirmText: '继续', danger: true
        });
        if (!confirmed) { e.target.value = ''; return; }
        var pw = await RM.prompt({
          title: '验证管理员密码', label: '导入数据需要验证管理员密码',
          type: 'password', placeholder: '请输入管理员密码', confirmText: '验证并导入'
        });
        if (pw == null) { e.target.value = ''; return; }
        var okPw = await RM.Auth.verifyAdminPassword(pw);
        if (!okPw) { RM.toast('管理员密码不正确', 'error'); e.target.value = ''; return; }
        var res = await RM.Store.importJSON(text);
        if (!res.ok) { RM.toast(res.msg, 'error'); e.target.value = ''; return; }
        RM.Store.clearSession();
        RM.toast('数据已导入，请重新登录', 'ok');
        setTimeout(function () { window.location.hash = '#/login'; }, 800);
      });

      main.querySelector('#btn-reset').addEventListener('click', async function () {
        var confirmed = await RM.confirm({
          title: '重置全部数据', message: '确定要清空全部数据并恢复初始状态吗？此操作不可恢复。',
          confirmText: '继续', danger: true
        });
        if (!confirmed) return;
        var pw = await RM.prompt({
          title: '验证管理员密码', label: '重置数据需要验证管理员密码',
          type: 'password', placeholder: '请输入管理员密码', confirmText: '验证并重置'
        });
        if (pw == null) return;
        var okPw = await RM.Auth.verifyAdminPassword(pw);
        if (!okPw) { RM.toast('管理员密码不正确', 'error'); return; }
        await RM.Store.resetAll();
        RM.Store.clearSession();
        RM.toast('数据已重置，请重新登录', 'ok');
        setTimeout(function () { window.location.hash = '#/login'; }, 800);
      });
    },

    renderPassword: function (main) {
      main.innerHTML =
        '<div class="page-head"><h2>修改密码</h2>' +
          '<p class="sub">系统管理员用户名为「小鲨鱼」，固定不可更改；UID 为系统内部保留。</p></div>' +
        '<form class="card" id="pwd-form" style="max-width:520px">' +
          '<label class="field"><span>当前密码</span>' +
            '<input type="password" id="pwd-old" autocomplete="current-password" placeholder="请输入当前密码"></label>' +
          '<label class="field"><span>新密码</span>' +
            '<input type="password" id="pwd-new" autocomplete="new-password" placeholder="请输入新密码"></label>' +
          '<label class="field"><span>确认新密码</span>' +
            '<input type="password" id="pwd-new2" autocomplete="new-password" placeholder="请再次输入新密码"></label>' +
          '<div class="form-msg" id="pwd-msg"></div>' +
          '<button type="submit" class="btn btn-primary">保存新密码</button>' +
        '</form>' +
        '<div class="notice notice-info" style="margin-top:20px;max-width:520px">' +
          '提示：初始管理员为 <b>小鲨鱼</b>，初始密码为 <b>xyy1314@</b>，仅作演示用途。</div>';

      var form = main.querySelector('#pwd-form');
      var msg = main.querySelector('#pwd-msg');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var oldPw = main.querySelector('#pwd-old').value;
        var newPw = main.querySelector('#pwd-new').value;
        var newPw2 = main.querySelector('#pwd-new2').value;
        msg.className = 'form-msg'; msg.textContent = '';
        if (!oldPw) { msg.textContent = '请输入当前密码'; msg.className = 'form-msg error'; return; }
        if (!newPw) { msg.textContent = '请输入新密码'; msg.className = 'form-msg error'; return; }
        if (newPw !== newPw2) { msg.textContent = '两次输入的新密码不一致'; msg.className = 'form-msg error'; return; }
        var res = await RM.Auth.changeAdminPassword(oldPw, newPw);
        if (!res.ok) { msg.textContent = res.msg; msg.className = 'form-msg error'; return; }
        RM.Store.addLog('修改管理员密码', '小鲨鱼', '');
        msg.textContent = res.msg; msg.className = 'form-msg ok';
        main.querySelector('#pwd-old').value = '';
        main.querySelector('#pwd-new').value = '';
        main.querySelector('#pwd-new2').value = '';
        RM.toast('管理员密码已更新', 'ok');
      });
    }
  };
})(window);