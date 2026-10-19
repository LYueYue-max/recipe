/* ============================================================
 * auth.js —— 登录 / 注册 / 鉴权
 * ============================================================ */
(function (window) {
  'use strict';
  var RM = window.RM;

  var Auth = RM.Auth = {

    login: async function (identifier, password) {
      RM.Store.sweep();

      var id = String(identifier == null ? '' : identifier).trim();
      if (!id) return { ok: false, msg: '请输入用户名或 UID' };
      if (password == null || String(password) === '') {
        return { ok: false, msg: '请输入密码' };
      }

      var user = RM.Store.findUserByLogin(id);
      if (!user) return { ok: false, msg: '用户名/UID 或密码错误' };

      var ok = await RM.verifyPassword(password, user.passHash);
      if (!ok) {
        return { ok: false, msg: '用户名/UID 或密码错误' };
      }

      if (user.guest && user.guestExpireAt && Date.now() >= user.guestExpireAt) {
        RM.Store.removeUser(user.uid);
        return { ok: false, msg: '游客账户已销毁，不可再登录' };
      }

      if (user.status === 'pending') {
        return { ok: false, msg: '等待管理员审批' };
      }
      if (user.status === 'rejected') {
        return { ok: false, msg: '注册申请已被拒绝，无法登录' };
      }

      var ban = RM.Store.banState(user);
      if (ban.active) {
        if (ban.perm) return { ok: false, msg: '账户已被永久封禁' };
        return {
          ok: false,
          msg: '账户已被封禁，还剩 ' + RM.formatRemaining(ban.remaining) + ' 解除'
        };
      }

      if (user.guest && !user.guestExpireAt) {
        user.guestExpireAt = Date.now() + 24 * 60 * 60 * 1000;
        RM.Store.save();
      }

      RM.Store.setSession({
        uid: user.uid,
        role: user.role,
        loginAt: Date.now()
      });

      return { ok: true, user: user };
    },

    register: async function (form) {
      var username = String(form.username == null ? '' : form.username).trim();
      var password = form.password;
      var inviteCode = String(form.inviteCode == null ? '' : form.inviteCode).trim();

      var nameErr = RM.validateUsername(username);
      if (nameErr) return { ok: false, msg: nameErr };

      var pwErr = RM.validatePassword(password);
      if (pwErr) return { ok: false, msg: pwErr };

      if (RM.Store.usernameExists(username)) {
        return { ok: false, msg: '用户名已被占用（不区分英文大小写）' };
      }

      var status = 'pending';
      var inviteMsg = '';
      var usedInviteCode = null;

      if (inviteCode) {
        var inv = RM.Store.findInvite(inviteCode);
        if (!inv) {
          inviteMsg = '邀请码无效，已转为待管理员审批';
        } else if (!inv.enabled) {
          inviteMsg = '邀请码已停用，已转为待管理员审批';
        } else if (inv.used >= inv.maxUses) {
          inviteMsg = '邀请码已达使用上限，已转为待管理员审批';
        } else {
          inv.used += 1;
          status = 'active';
          usedInviteCode = inv.code;
          inviteMsg = '邀请码有效，注册成功并已自动激活，可直接登录';
        }
      } else {
        inviteMsg = '注册成功，请等待管理员审批';
      }

      var uid = RM.Store.generateUid();
      var passHash = await RM.hashPassword(password);

      var user = {
        uid: uid,
        username: username,
        usernameLower: username.toLowerCase(),
        passHash: passHash,
        role: 'user',
        status: status,
        createdAt: Date.now(),
        ban: { mode: 'none' },
        freeze: { mode: 'none' },
        guest: false,
        guestExpireAt: null,
        invite: usedInviteCode,
        history: [],
        favorites: [],
        playlists: [],
        readAnnouncements: [],
        notifications: [],
        loginFail: { count: 0, until: 0 }
      };

      RM.Store.db.users.push(user);
      RM.Store.save();

      return {
        ok: true,
        msg: inviteMsg,
        activated: status === 'active',
        uid: uid
      };
    },

    verifyAdminPassword: async function (password) {
      var admin = RM.Store.getUserByUid('000000');
      if (!admin) return false;
      return await RM.verifyPassword(password, admin.passHash);
    },

    changeAdminPassword: async function (oldPw, newPw) {
      var admin = RM.Store.getUserByUid('000000');
      if (!admin) return { ok: false, msg: '管理员账户异常' };

      var ok = await RM.verifyPassword(oldPw, admin.passHash);
      if (!ok) return { ok: false, msg: '当前密码不正确' };
      if (!newPw || String(newPw) === '') return { ok: false, msg: '新密码不能为空' };

      admin.passHash = await RM.hashPassword(newPw);
      RM.Store.save();
      return { ok: true, msg: '管理员密码已更新' };
    },

    logout: function () {
      RM.Store.clearSession();
      if (RM.Player) RM.Player.close();
      window.location.hash = '#/login';
    }
  };
})(window);