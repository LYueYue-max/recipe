/* ============================================================
 * recipe.js —— 菜谱详情浮窗（原 player.js 改造）
 * 圆润方形卡片 · 可拖动 · 可最小化 · 支持收藏 / 加入菜单
 * ============================================================ */
(function (window) {
  'use strict';
  var RM = window.RM;

  var Recipe = RM.Recipe = {

    root: null,
    uiReady: false,
    current: null,        // 当前菜谱对象
    currentMatch: null,   // 当前匹配结果（含 missMain / missSea / sub / ratio）

    state: { isOpen: false, minimized: false },

    /* 打开：传入菜谱对象和匹配结果（可选） */
    open: function (recipe, match) {
      if (!recipe) { RM.toast('菜谱数据缺失', 'warn'); return; }
      this.current = recipe;
      this.currentMatch = match || null;
      this.state.isOpen = true;
      this.state.minimized = false;

      this.ensureUI();
      this.root.querySelector('#recipe-window').hidden = false;
      this.root.querySelector('#recipe-mini').hidden = true;

      var win = this.root.querySelector('#recipe-window');
      win.style.left = '50%';
      win.style.top = '50%';
      win.style.transform = 'translate(-50%, -50%)';

      this.render();
      this.updateFavUI();

      var user = RM.Store.currentUser();
      if (user && recipe.id) RM.Store.pushHistory(user, recipe.id);
    },

    close: function () {
      if (!this.state.isOpen) return;
      this.state.isOpen = false;
      this.state.minimized = false;
      if (this.root) {
        var win = this.root.querySelector('#recipe-window');
        var mini = this.root.querySelector('#recipe-mini');
        if (win) win.hidden = true;
        if (mini) mini.hidden = true;
      }
    },

    minimize: function () {
      if (!this.state.isOpen) return;
      this.state.minimized = true;
      this.root.querySelector('#recipe-window').hidden = true;
      this.root.querySelector('#recipe-mini').hidden = false;
      this.updateMini();
    },

    restore: function () {
      if (!this.state.isOpen) return;
      this.state.minimized = false;
      this.root.querySelector('#recipe-mini').hidden = true;
      this.root.querySelector('#recipe-window').hidden = false;
      this.render();
    },

    /* ---------------- 渲染 ---------------- */
    render: function () {
      if (!this.uiReady || !this.current) return;
      var r = this.current;
      var m = this.currentMatch || {};
      var $ = function (id) { return this.root.querySelector('#' + id); }.bind(this);

      $('recipe-title').textContent = r.title || r.name || '未命名菜谱';
      $('recipe-sub').textContent = (r.cuisine || '') +
        (r.time ? ' · ' + r.time : '') +
        (r.difficulty ? ' · ' + r.difficulty : '');

      // meta 网格
      var metaHtml =
        '<div class="recipe-meta-item"><b>菜系</b>' + RM.escapeHtml(r.cuisine || '—') + '</div>' +
        '<div class="recipe-meta-item"><b>时间</b>' + RM.escapeHtml(r.time || '—') + '</div>' +
        '<div class="recipe-meta-item"><b>难度</b>' + RM.escapeHtml(r.difficulty || '—') + '</div>' +
        '<div class="recipe-meta-item"><b>份量</b>' + RM.escapeHtml(r.servings || '—') + '</div>';
      $('recipe-meta').innerHTML = metaHtml;

      // 匹配信息
      if (m.ratio != null) {
        var missHtml = '';
        if (m.missMain && m.missMain.length) {
          missHtml += '<div class="recipe-miss-list">还缺主食材：' +
            m.missMain.map(RM.escapeHtml).join('、') + '</div>';
        }
        if (m.missSea && m.missSea.length) {
          missHtml += '<div class="recipe-miss-list">还缺调料：' +
            m.missSea.map(RM.escapeHtml).join('、') + '</div>';
        }
        if (m.sub && m.sub.length) {
          missHtml += '<div class="recipe-sub-list">可替代调料：' +
            m.sub.map(RM.escapeHtml).join('、') + '</div>';
        }
        $('recipe-match-block').innerHTML = missHtml
          ? '<div class="recipe-section"><div class="recipe-section-title">匹配情况 · 命中 ' + m.ratio + '%</div>' + missHtml + '</div>'
          : '';
      } else {
        $('recipe-match-block').innerHTML = '';
      }

      // 食材
      $('recipe-main').innerHTML = (r.mainIngredients || [])
        .map(function (x) { return '<span class="chip">' + RM.escapeHtml(x) + '</span>'; }).join('') || '<span class="sub">—</span>';
      $('recipe-sea').innerHTML = (r.seasonings || [])
        .map(function (x) { return '<span class="chip chip-ghost">' + RM.escapeHtml(x) + '</span>'; }).join('') || '<span class="sub">—</span>';

      // 可选食材
      var optBlock = $('recipe-opt-block');
      if (r.optional && r.optional.length) {
        optBlock.hidden = false;
        $('recipe-opt').innerHTML = r.optional
          .map(function (x) { return '<span class="chip">' + RM.escapeHtml(x) + '</span>'; }).join('');
      } else {
        optBlock.hidden = true;
      }

      // 步骤
      $('recipe-steps').innerHTML = (r.steps || []).map(function (s, i) {
        return '<div class="recipe-step"><span class="recipe-step-num">' + (i + 1) + '</span>' +
          '<span>' + RM.escapeHtml(s) + '</span></div>';
      }).join('') || '<div class="sub">暂无步骤</div>';

      // 饮食标签
      var tagBlock = $('recipe-tag-block');
      if (r.dietTags && r.dietTags.length) {
        tagBlock.hidden = false;
        $('recipe-tags').innerHTML = r.dietTags
          .map(function (t) { return '<span class="chip chip-ghost">' + RM.escapeHtml(t) + '</span>'; }).join('');
      } else {
        tagBlock.hidden = true;
      }

      // 备注
      var notesBlock = $('recipe-notes-block');
      if (r.notes) {
        notesBlock.hidden = false;
        $('recipe-notes').textContent = r.notes;
      } else {
        notesBlock.hidden = true;
      }

      this.updateFavUI();
    },

    /* ---------------- UI 构建 ---------------- */
    ensureUI: function () {
      if (this.uiReady && this.root && this.root.querySelector('#recipe-window')) return;

      var host = document.getElementById('recipe-host');
      host.innerHTML =
        '<div class="recipe-window" id="recipe-window" hidden>' +
          '<div class="recipe-drag" id="recipe-drag"><div class="recipe-drag-bar"></div></div>' +
          '<div class="recipe-head">' +
            '<div class="recipe-head-main">' +
              '<div class="recipe-title" id="recipe-title">菜谱</div>' +
              '<div class="recipe-sub" id="recipe-sub"></div>' +
            '</div>' +
            '<div class="recipe-head-actions">' +
              '<button type="button" class="icon-btn" id="rv-min" title="最小化">—</button>' +
              '<button type="button" class="icon-btn" id="rv-close" title="关闭">✕</button>' +
            '</div>' +
          '</div>' +
          '<div id="recipe-match-block"></div>' +
          '<div class="recipe-meta-grid" id="recipe-meta"></div>' +
          '<div class="recipe-section">' +
            '<div class="recipe-section-title">主食材</div>' +
            '<div class="recipe-section-body" id="recipe-main"></div>' +
          '</div>' +
          '<div class="recipe-section">' +
            '<div class="recipe-section-title">调料</div>' +
            '<div class="recipe-section-body" id="recipe-sea"></div>' +
          '</div>' +
          '<div class="recipe-section" id="recipe-opt-block" hidden>' +
            '<div class="recipe-section-title">可选添加</div>' +
            '<div class="recipe-section-body" id="recipe-opt"></div>' +
          '</div>' +
          '<div class="recipe-section">' +
            '<div class="recipe-section-title">步骤</div>' +
            '<div class="recipe-steps" id="recipe-steps"></div>' +
          '</div>' +
          '<div class="recipe-section" id="recipe-tag-block" hidden>' +
            '<div class="recipe-section-title">饮食标签</div>' +
            '<div class="recipe-section-body" id="recipe-tags"></div>' +
          '</div>' +
          '<div class="recipe-section" id="recipe-notes-block" hidden>' +
            '<div class="recipe-notes" id="recipe-notes"></div>' +
          '</div>' +
          '<div class="player-extra" style="justify-content:flex-end;gap:8px;margin-top:6px">' +
            '<button type="button" class="btn btn-sm btn-ghost" id="rv-fav">♡ 收藏</button>' +
            '<button type="button" class="btn btn-sm btn-primary" id="rv-addmenu">＋ 加入菜单</button>' +
          '</div>' +
        '</div>' +
        '<div class="recipe-mini" id="recipe-mini" hidden>' +
          '<span class="mini-title" id="rv-mini-title">菜谱</span>' +
          '<button type="button" class="ctrl-btn small" id="rv-mini-open" title="展开">⤢</button>' +
          '<button type="button" class="ctrl-btn small" id="rv-mini-close" title="关闭">✕</button>' +
        '</div>';

      this.root = host;
      this.uiReady = true;
      this.bindUI();
    },

    bindUI: function () {
      var self = this;
      var $ = function (id) { return self.root.querySelector('#' + id); };

      $('rv-close').addEventListener('click', function () { self.close(); });
      $('rv-min').addEventListener('click', function () { self.minimize(); });
      $('rv-mini-open').addEventListener('click', function () { self.restore(); });
      $('rv-mini-close').addEventListener('click', function () { self.close(); });
      $('rv-fav').addEventListener('click', function () { self.toggleFav(); });
      $('rv-addmenu').addEventListener('click', function () { self.addToMenuDialog(); });

      var dragHandle = $('recipe-drag');
      dragHandle.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        self.startDrag(e);
      });
      dragHandle.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        self.startDrag(e.touches[0]);
      }, { passive: true });
    },

    startDrag: function (startEvent) {
      var win = this.root.querySelector('#recipe-window');
      var rect = win.getBoundingClientRect();
      win.style.transform = 'none';
      win.style.left = rect.left + 'px';
      win.style.top = rect.top + 'px';

      var offX = startEvent.clientX - rect.left;
      var offY = startEvent.clientY - rect.top;
      var w = rect.width, h = rect.height;

      function move(clientX, clientY) {
        var x = clientX - offX, y = clientY - offY;
        x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
        y = Math.max(8, Math.min(window.innerHeight - h - 8, y));
        win.style.left = x + 'px';
        win.style.top = y + 'px';
      }
      var onMouseMove = function (e) { move(e.clientX, e.clientY); };
      var onTouchMove = function (e) {
        if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
      };
      var stop = function () {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', stop);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', stop);
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', stop);
    },

    /* ---------------- 收藏 / 菜单 ---------------- */
    toggleFav: function () {
      var user = RM.Store.currentUser();
      if (!user || !this.current) return;
      var on = RM.Store.toggleFavorite(user, this.current.id);
      RM.toast(on ? '已收藏' : '已取消收藏');
      this.updateFavUI();
      if (RM.rerender) RM.rerender();
    },

    updateFavUI: function () {
      if (!this.uiReady || !this.current) return;
      var btn = this.root.querySelector('#rv-fav');
      if (!btn) return;
      var user = RM.Store.currentUser();
      var on = !!(user && RM.Store.isFavorite(user, this.current.id));
      btn.textContent = on ? '♥ 已收藏' : '♡ 收藏';
      btn.classList.toggle('btn-ok', on);
    },

    addToMenuDialog: function () {
      var user = RM.Store.currentUser();
      if (!user || !this.current) return;
      var lists = user.playlists || [];
      if (!lists.length) {
        RM.toast('还没有菜单，先去「我的菜单」创建一个', 'warn');
        return;
      }
      var opts = lists.map(function (p) {
        return '<option value="' + RM.escapeHtml(p.id) + '">' +
          RM.escapeHtml(p.name) + '（' + p.songIds.length + ' 道）</option>';
      }).join('');

      RM.dialog({
        title: '加入菜单',
        content:
          '<p>将《' + RM.escapeHtml(this.current.title || this.current.name) + '》加入：</p>' +
          '<label class="field"><span>选择菜单</span>' +
            '<select id="menu-select">' + opts + '</select></label>',
        actions: [
          { text: '取消', kind: 'ghost' },
          {
            text: '加入', kind: 'primary',
            onClick: function (close, card) {
              var id = card.querySelector('#menu-select').value;
              var res = RM.Store.addToPlaylist(user, id, this.current.id);
              if (!res.ok) { RM.toast(res.msg, 'error'); return; }
              RM.toast('已加入菜单', 'ok');
              close();
            }.bind(this)
          }
        ]
      });
    },

    updateMini: function () {
      if (!this.uiReady) return;
      var el = this.root.querySelector('#rv-mini-title');
      if (el && this.current) el.textContent = this.current.title || this.current.name || '菜谱';
    }
  };
})(window);