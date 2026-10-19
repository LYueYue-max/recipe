/* ============================================================
 * utils.js —— 通用工具函数（菜谱版完整版）
 * 包含原音乐版全部基础工具 + 菜谱专用 RM.RecipeUtil
 * ============================================================ */
(function (window) {
  'use strict';
  var RM = window.RM = window.RM || {};

  /* ---------------- 默认封面（菜谱版也保留，避免遗留引用报错） ---------------- */
  RM.DEFAULT_COVER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#dbe8ff"/><stop offset="1" stop-color="#dff5ee"/>' +
      '</linearGradient></defs>' +
      '<rect width="320" height="320" rx="64" fill="url(#g)"/>' +
      '<circle cx="160" cy="160" r="62" fill="#ffffff" opacity="0.72"/>' +
      '<circle cx="160" cy="160" r="20" fill="#5b8def" opacity="0.85"/>' +
      '<circle cx="160" cy="160" r="7" fill="#ffffff"/>' +
    '</svg>'
  );

  /* ---------------- 基础工具 ---------------- */
  RM.uid6 = function () {
    var s = '';
    for (var i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
    return s;
  };

  RM.escapeHtml = function (str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var FORBIDDEN_CHARS = /[\/\\:*?"<>|]/;
  var CONTROL_OR_SPACE = /[\s\u0000-\u001F\u007F\u00A0\u3000]/;

  RM.validateUsername = function (name) {
    if (name == null) return '用户名不能为空';
    var s = String(name);
    if (s.trim() === '') return '用户名不能为空';
    if (s.length > 20) return '用户名不能超过 20 个字符';
    if (CONTROL_OR_SPACE.test(s)) return '用户名不能包含空白或控制字符';
    if (FORBIDDEN_CHARS.test(s)) return '用户名不能包含 / \\ : * ? " < > | 等字符';
    return null;
  };

  RM.validatePassword = function (pw) {
    if (pw == null || String(pw) === '') return '密码不能为空';
    return null;
  };

  RM.validateUid = function (uid) {
    if (!/^\d{6}$/.test(String(uid == null ? '' : uid))) return 'UID 必须为 6 位纯数字';
    return null;
  };

  RM.formatRemaining = function (ms) {
    if (!isFinite(ms) || ms <= 0) return '0 分钟';
    var totalMin = Math.ceil(ms / 60000);
    var d = Math.floor(totalMin / 1440);
    var h = Math.floor((totalMin % 1440) / 60);
    var m = totalMin % 60;
    if (d > 0) return d + ' 天 ' + h + ' 小时';
    if (h > 0) return h + ' 小时 ' + m + ' 分钟';
    return m + ' 分钟';
  };

  RM.fmtTime = function (sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    var s = Math.floor(sec % 60);
    var m = Math.floor(sec / 60) % 60;
    var h = Math.floor(sec / 3600);
    var ss = s < 10 ? '0' + s : String(s);
    if (h > 0) {
      var mm = m < 10 ? '0' + m : String(m);
      return h + ':' + mm + ':' + ss;
    }
    return m + ':' + ss;
  };

  RM.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  /* ---------------- 主题（深浅） ---------------- */
  RM.Theme = {
    KEY: 'RM_THEME',
    init: function () {
      var saved = 'light';
      try { saved = localStorage.getItem(this.KEY) || 'light'; } catch (e) {}
      this.apply(saved, true);
    },
    get: function () {
      try { return localStorage.getItem(this.KEY) || 'light'; }
      catch (e) { return 'light'; }
    },
    apply: function (mode, silent) {
      document.body.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
      try { localStorage.setItem(this.KEY, mode); } catch (e) {}
      this.syncBtn();
      if (!silent) return;
    },
    syncBtn: function () {
      var btns = document.querySelectorAll('#theme-toggle');
      var self = this;
      Array.prototype.forEach.call(btns, function (b) {
        b.textContent = self.get() === 'dark' ? '☀️' : '🌙';
      });
    },
    toggle: function () {
      var next = this.get() === 'dark' ? 'light' : 'dark';
      this.apply(next, true);
      RM.toast(next === 'dark' ? '已切换到深色主题' : '已切换到浅色主题');
    }
  };

  /* ---------------- 主色 ---------------- */
  RM.Accent = {
    KEY: 'RM_ACCENT',
    LIST: {
      blue:   { name: '静谧蓝', primary: '#5b8def', dark: '#4a7ade', soft: '#e9f0ff', light: '#7fafff', rgb: '91,141,239' },
      mint:   { name: '薄荷绿', primary: '#4fbf9f', dark: '#38a383', soft: '#e2f7f0', light: '#6fdcb9', rgb: '79,191,159' },
      purple: { name: '紫罗兰', primary: '#9b7bf0', dark: '#8260e0', soft: '#f0e9ff', light: '#b59bff', rgb: '155,123,240' },
      orange: { name: '暖阳橙', primary: '#f0935a', dark: '#dd7b3d', soft: '#fff0e3', light: '#ffb07a', rgb: '240,147,90' },
      pink:   { name: '樱花粉', primary: '#ee7ea6', dark: '#d9608c', soft: '#ffe9f1', light: '#ff9dbf', rgb: '238,126,166' }
    },
    init: function () {
      var saved = 'blue';
      try {
        saved = localStorage.getItem(this.KEY) ||
          (RM.Store && RM.Store.db && RM.Store.db.settings && RM.Store.db.settings.accent) ||
          'blue';
      } catch (e) {}
      this.apply(saved, true);
    },
    get: function () {
      try { return localStorage.getItem(this.KEY) || 'blue'; } catch (e) { return 'blue'; }
    },
    apply: function (name, silent) {
      if (!this.LIST[name]) name = 'blue';
      var c = this.LIST[name];
      var b = document.body;
      b.setAttribute('data-accent', name);
      b.style.setProperty('--primary', c.primary);
      b.style.setProperty('--primary-dark', c.dark);
      b.style.setProperty('--primary-soft', c.soft);
      b.style.setProperty('--primary-light', c.light);
      b.style.setProperty('--primary-rgb', c.rgb);
      try { localStorage.setItem(this.KEY, name); } catch (e) {}
      if (RM.Store && RM.Store.db) RM.Store.setAccent(name);
      if (!silent) RM.toast('已切换主题色：' + c.name, 'ok');
    },
    openDialog: function () {
      var self = this;
      var cur = self.get();
      var content =
        '<div class="accent-grid">' +
          Object.keys(self.LIST).map(function (k) {
            var c = self.LIST[k];
            return '<button type="button" class="accent-dot' + (k === cur ? ' on' : '') +
              '" data-accent="' + k + '" title="' + c.name + '"' +
              ' style="background:linear-gradient(135deg,' + c.light + ',' + c.primary + ')"></button>';
          }).join('') +
        '</div>' +
        '<div class="sub" style="margin-top:14px">深浅主题请使用顶栏月亮 / 太阳按钮切换</div>';

      RM.dialog({
        title: '主题色',
        content: content,
        actions: [{ text: '关闭', kind: 'ghost' }],
        onMount: function (card, close) {
          card.querySelector('.accent-grid').addEventListener('click', function (e) {
            var btn = e.target.closest('[data-accent]');
            if (!btn) return;
            self.apply(btn.getAttribute('data-accent'));
            close();
          });
        }
      });
    }
  };

  /* ---------------- 标签 ---------------- */
  RM.Tags = {
    parse: function (str) {
      return String(str || '')
        .split(/[,，;；\s]+/)
        .map(function (t) { return t.trim(); })
        .filter(Boolean)
        .filter(function (t, i, arr) { return arr.indexOf(t) === i; })
        .slice(0, 6);
    },
    join: function (arr) { return (arr || []).join('，'); }
  };

  /* ---------------- 分页 ---------------- */
  RM.pageSlice = function (list, page, size) {
    var total = list.length;
    var pages = Math.max(1, Math.ceil(total / size));
    var p = Math.min(Math.max(1, page || 1), pages);
    var start = (p - 1) * size;
    return { items: list.slice(start, start + size), page: p, pages: pages, total: total };
  };

  RM.pagerHtml = function (page, pages) {
    if (pages <= 1) return '';
    return '<div class="pager">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-page="' + (page - 1) + '"' +
        (page <= 1 ? ' disabled' : '') + '>上一页</button>' +
      '<span class="pager-info">' + page + ' / ' + pages + '</span>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-page="' + (page + 1) + '"' +
        (page >= pages ? ' disabled' : '') + '>下一页</button>' +
    '</div>';
  };

  /* ---------------- Toast ---------------- */
  RM.toast = function (msg, type) {
    var host = document.getElementById('toast-host');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    }, 3200);
  };

  /* ---------------- 对话框 ---------------- */
  RM.dialog = function (opts) {
    opts = opts || {};
    var host = document.getElementById('modal-host');
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    var card = document.createElement('div');
    card.className = 'modal-card';

    var head = document.createElement('div');
    head.className = 'modal-head';
    head.innerHTML = '<h3>' + RM.escapeHtml(opts.title || '提示') + '</h3>';

    var xBtn = document.createElement('button');
    xBtn.className = 'icon-btn modal-x';
    xBtn.type = 'button';
    xBtn.setAttribute('aria-label', '关闭');
    xBtn.textContent = '✕';
    head.appendChild(xBtn);

    var body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = opts.content || '';

    var foot = document.createElement('div');
    foot.className = 'modal-foot';

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(foot);
    overlay.appendChild(card);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      overlay.classList.add('closing');
      setTimeout(function () { overlay.remove(); }, 160);
      if (opts.onClose) opts.onClose();
    }

    (opts.actions || []).forEach(function (a) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (a.kind ? 'btn-' + a.kind : 'btn-ghost');
      btn.textContent = a.text;
      btn.addEventListener('click', function () {
        if (a.onClick) a.onClick(close, card);
        else close();
      });
      foot.appendChild(btn);
    });

    xBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });

    host.appendChild(overlay);
    if (opts.onMount) opts.onMount(card, close);

    return { close: close, card: card };
  };

  RM.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      RM.dialog({
        title: opts.title || '请确认',
        content: '<p>' + RM.escapeHtml(opts.message || '') + '</p>',
        actions: [
          {
            text: opts.cancelText || '取消', kind: 'ghost',
            onClick: function (close) {
              if (!settled) { settled = true; resolve(false); }
              close();
            }
          },
          {
            text: opts.confirmText || '确定',
            kind: opts.danger ? 'danger' : 'primary',
            onClick: function (close) {
              if (!settled) { settled = true; resolve(true); }
              close();
            }
          }
        ],
        onClose: function () {
          if (!settled) { settled = true; resolve(false); }
        }
      });
    });
  };

  RM.prompt = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      var type = opts.type || 'text';
      var content =
        '<label class="field"><span>' + RM.escapeHtml(opts.label || '') + '</span>' +
        '<input type="' + type + '" id="prompt-input" autocomplete="off" ' +
        'value="' + RM.escapeHtml(opts.value || '') + '" ' +
        'placeholder="' + RM.escapeHtml(opts.placeholder || '') + '"></label>' +
        '<div class="form-msg" id="prompt-msg"></div>';

      function finish(val) {
        if (!settled) { settled = true; resolve(val); }
      }

      RM.dialog({
        title: opts.title || '请输入',
        content: content,
        actions: [
          {
            text: '取消', kind: 'ghost',
            onClick: function (close) { finish(null); close(); }
          },
          {
            text: opts.confirmText || '确定', kind: 'primary',
            onClick: function (close, card) {
              var input = card.querySelector('#prompt-input');
              var val = input.value;
              if (opts.validate) {
                var err = opts.validate(val);
                if (err) {
                  var msg = card.querySelector('#prompt-msg');
                  msg.textContent = err;
                  msg.className = 'form-msg error';
                  return;
                }
              }
              finish(val);
              close();
            }
          }
        ],
        onMount: function (card) {
          var input = card.querySelector('#prompt-input');
          setTimeout(function () { input.focus(); if (input.select) input.select(); }, 60);
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              var btn = card.querySelector('.modal-foot .btn-primary');
              if (btn) btn.click();
            }
          });
        },
        onClose: function () { finish(null); }
      });
    });
  };

  /* ---------------- 通知中心 ---------------- */
  RM.Notify = {
    open: function (user) {
      var list = (user.notifications || []).slice();
      var content = list.length
        ? '<div class="notify-list">' + list.map(function (n) {
            return '<div class="notify-item' + (n.read ? '' : ' unread') + '">' +
              '<div class="notify-head">' +
                '<b>' + RM.escapeHtml(n.title) + '</b>' +
                '<span class="notify-time">' + new Date(n.at).toLocaleString() + '</span>' +
              '</div>' +
              '<div class="notify-body">' + RM.escapeHtml(n.content) + '</div>' +
              (n.read ? '' : '<button type="button" class="btn btn-sm btn-ghost" data-read="' +
                RM.escapeHtml(n.id) + '">标为已读</button>') +
            '</div>';
          }).join('') + '</div>'
        : '<div class="empty">还没有收到通知</div>';

      var hasUnread = list.some(function (n) { return !n.read; });

      RM.dialog({
        title: '通知中心',
        content: content,
        actions: hasUnread ? [
          { text: '关闭', kind: 'ghost' },
          {
            text: '全部已读', kind: 'primary',
            onClick: function (close) {
              RM.Store.markAllNotificationsRead(user);
              close();
              RM.rerender();
            }
          }
        ] : [{ text: '关闭', kind: 'ghost' }],
        onMount: function (card, close) {
          card.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-read]');
            if (!btn) return;
            RM.Store.markNotificationRead(user, btn.getAttribute('data-read'));
            close();
            RM.rerender();
          });
        }
      });
    }
  };

  /* ---------------- 防抖 ---------------- */
  RM.debounce = function (fn, wait) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 200);
    };
  };

  /* ============================================================
   * 菜谱专用工具（原"追加到 utils.js 末尾"的部分，现已并入 IIFE）
   * ============================================================ */
  RM.RecipeUtil = {
    // 将用户输入的字符串解析为食材数组
    parseItems: function (raw) {
      return String(raw || '')
        .split(/[,，、;；\s]+/)
        .map(function (s) { return s.trim(); })
        .filter(Boolean)
        .filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    },

    // 匹配度徽章 class
    matchClass: function (ratio) {
      if (ratio >= 70) return '';
      if (ratio >= 40) return 'mid';
      return 'low';
    }
  };
})(window);