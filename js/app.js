/* ============================================================
 * app.js —— 路由守卫 / 倒计时 / 启动（菜谱版）
 * ============================================================ */
(function (window) {
  'use strict';
  var RM = window.RM;

  window.addEventListener('error', function (e) {
    if (e.message && e.message.indexOf('Script error') === -1) {
      console.error('全局捕获到异常:', e.error || e.message);
    }
  });

  var Ticker = RM.Ticker = {
    _pending: false,
    start: function () { var self = this; setInterval(function () { self.tick(); }, 1000); },
    tick: function () {
      var self = this;
      var nodes = document.querySelectorAll('[data-countdown]');
      for (var i = 0; i < nodes.length; i++) {
        (function (el) {
          var end = Number(el.getAttribute('data-end'));
          if (!end || !isFinite(end)) return;
          var rem = end - Date.now();
          if (rem <= 0) {
            el.textContent = '即将解除';
            if (!el.__done) {
              el.__done = true;
              if (!self._pending) {
                self._pending = true;
                setTimeout(function () {
                  self._pending = false;
                  RM.Store.sweep();
                  if (RM.rerender) RM.rerender();
                }, 400);
              }
            }
          } else {
            el.textContent = RM.formatRemaining(rem);
          }
        })(nodes[i]);
      }
    }
  };

  var hasRendered = false;
  function playPageEnter(isFirstLoad) {
    var app = document.getElementById('app');
    if (!app) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof app.animate === 'function') {
      if (app.__pageAnim) { try { app.__pageAnim.cancel(); } catch (e) {} }
      app.__pageAnim = app.animate(
        [
          { opacity: 0, transform: 'translateY(' + (isFirstLoad ? '16px' : '10px') + ') scale(.997)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ],
        { duration: isFirstLoad ? 520 : 380, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'none' }
      );
      app.__pageAnim.onfinish = function () { app.__pageAnim = null; };
    } else {
      app.classList.remove('page-enter');
      void app.offsetHeight;
      app.classList.add('page-enter');
    }
  }

  RM.currentPath = null;
  function currentPath() {
    var h = window.location.hash || '';
    var p = h.replace(/^#/, '');
    if (!p || p === '/') p = '/login';
    return p;
  }

  function route() {
    try { RM.Store.sweep(); } catch (e) { console.warn('Store sweep error', e); }

    var path = currentPath();
    var prevPath = RM.currentPath;
    var isFirstLoad = !hasRendered;
    RM.currentPath = path;

    var user = null;
    try { user = RM.Store.currentUser(); } catch (e) {}

    var isAuthPage = (path === '/login' || path === '/register');
    var didRender = false;

    if (!user) {
      if (!isAuthPage) { window.location.hash = '#/login'; return; }
      if (path === '/register') renderRegister();
      else renderLogin();
      didRender = true;
    } else {
      var ban = RM.Store.banState(user);
      if (ban.active) {
        RM.Store.clearSession();
        RM.toast(ban.perm ? '账户已被永久封禁'
          : '账户已被封禁，还剩 ' + RM.formatRemaining(ban.remaining) + ' 解除', 'error');
        window.location.hash = '#/login';
        return;
      }
      if (isAuthPage) {
        window.location.hash = user.role === 'admin' ? '#/admin/dashboard' : '#/app/workbench';
        return;
      }
      if (user.role === 'admin') {
        if (path.indexOf('/admin') !== 0) { window.location.hash = '#/admin/dashboard'; return; }
        RM.Admin.render(path); didRender = true;
      } else {
        if (path.indexOf('/app') !== 0) { window.location.hash = '#/app/workbench'; return; }
        RM.User.render(path, user); didRender = true;
      }
    }

    if (didRender) {
      hasRendered = true;
      if (prevPath !== path) playPageEnter(isFirstLoad);
    }
  }

  RM.rerender = function () { if (!RM.currentPath) return; route(); };

  function renderLogin() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="auth-wrap">' +
        '<div class="auth-card">' +
          '<div class="auth-logo"><img src="ict.jpg" alt="logo"></div>' + 
          '<h1>小鲨鱼菜谱</h1>' +
          '<p class="auth-sub">圆润 · 简洁 · 清爽的菜谱库</p>' +
          '<form id="login-form" novalidate>' +
            '<label class="field"><span>用户名 / UID</span>' +
              '<input type="text" id="login-id" autocomplete="username" placeholder="请输入用户名或 UID"></label>' +
            '<label class="field"><span>密码</span>' +
              '<input type="password" id="login-pw" autocomplete="current-password" placeholder="请输入密码"></label>' +
            '<div class="form-msg" id="login-msg"></div>' +
            '<button type="submit" class="btn btn-primary btn-block">登 录</button>' +
          '</form>' +
          '<div class="auth-foot">还没有账户？<a href="#/register">去注册</a></div>' +
          '<div class="auth-tip">' +
            '演示站点：所有数据仅保存在当前浏览器 localStorage 中，<br>' +
            '换浏览器 / 换设备 / 清空缓存都会恢复初始状态。' +
          '</div>' +
        '</div>' +
      '</div>';

    var form = document.getElementById('login-form');
    var msg = document.getElementById('login-msg');
    var idInput = document.getElementById('login-id');
    var pwInput = document.getElementById('login-pw');
    setTimeout(function () { idInput.focus(); }, 60);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      msg.className = 'form-msg'; msg.textContent = '';
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = '登录中…';

      var res = await RM.Auth.login(idInput.value, pwInput.value);

      btn.disabled = false; btn.textContent = '登 录';
      if (!res.ok) { msg.textContent = res.msg; msg.className = 'form-msg error'; return; }

      RM.toast('欢迎回来，' + res.user.username, 'ok');
      window.location.hash = res.user.role === 'admin' ? '#/admin/dashboard' : '#/app/workbench';
    });
  }

  function renderRegister() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="auth-wrap">' +
        '<div class="auth-card">' +
          '<div class="auth-logo"><img src="ict.jpg" alt="logo"></div>' +
          '<h1>注册账户</h1>' +
          '<p class="auth-sub">填写信息，等待管理员审批（或使用邀请码直接激活）</p>' +
          '<form id="reg-form" novalidate>' +
            '<label class="field"><span>用户名</span>' +
              '<input type="text" id="reg-name" autocomplete="username" ' +
                'placeholder="不允许空白及 / \\ : * ? &quot; &lt; &gt; |"></label>' +
            '<label class="field"><span>密码</span>' +
              '<input type="password" id="reg-pw" autocomplete="new-password" placeholder="密码允许任意字符"></label>' +
            '<label class="field"><span>邀请码（选填）</span>' +
              '<input type="text" id="reg-invite" autocomplete="off" placeholder="有邀请码可跳过审批直接激活"></label>' +
            '<div class="form-msg" id="reg-msg"></div>' +
            '<button type="submit" class="btn btn-primary btn-block">注 册</button>' +
          '</form>' +
          '<div class="auth-foot">已有账户？<a href="#/login">去登录</a></div>' +
          '<div class="auth-tip">普通注册需要管理员审批通过后才能登录。</div>' +
        '</div>' +
      '</div>';

    var form = document.getElementById('reg-form');
    var msg = document.getElementById('reg-msg');
    var nameInput = document.getElementById('reg-name');
    var pwInput = document.getElementById('reg-pw');
    var inviteInput = document.getElementById('reg-invite');
    setTimeout(function () { nameInput.focus(); }, 60);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      msg.className = 'form-msg'; msg.textContent = '';
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = '注册中…';

      var res = await RM.Auth.register({
        username: nameInput.value,
        password: pwInput.value,
        inviteCode: inviteInput.value
      });

      btn.disabled = false; btn.textContent = '注 册';
      if (!res.ok) { msg.textContent = res.msg; msg.className = 'form-msg error'; return; }

      msg.textContent = res.msg + '（UID：' + res.uid + '）';
      msg.className = 'form-msg ' + (res.activated ? 'ok' : '');
      nameInput.value = ''; pwInput.value = ''; inviteInput.value = '';
      if (res.activated) setTimeout(function () { window.location.hash = '#/login'; }, 1600);
    });
  }

  async function boot() {
    RM.Theme.init();
    await RM.Store.init();
    
    RM.Store.loadOfficialRecipes().then(function() {
      if (RM.rerender) RM.rerender();
    });
    
    RM.Accent.init();

    window.addEventListener('hashchange', route);
    if (!window.location.hash) window.location.hash = '#/login';
    route();
    Ticker.start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);