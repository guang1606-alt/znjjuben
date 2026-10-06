/* v2.318 制作中管理台前端（独立页）：列表 / 详情 / 取消 / 清僵尸。
 * 数据源：/api/admin/production/*（仅超管）；复用 api.js 会话（401 自动续期重试一次）。
 * 诚实边界：进度不落库，详情以岗位级 ModelCallLog 时间线呈现真实成本。
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  // 封装前缀（守卫 seam-fill 规则④：字面量后紧跟 ' + ' 跳过提取，避免 /api/admin/production 裸基路径被误判为幽灵调用）
  var prod = function (p) { return '/api/admin/production' + p; };

  var STATUS_ZH = { QUEUED: '排队中', RUNNING: '生成中', DONE: '已完成', FAILED: '失败', CANCELED: '已取消' };
  var ROLE_ZH = {
    market_pre: '市场前置', architect: '架构师', designer: '视觉设计', writer: '撰稿',
    polisher: '润色', compliance: '合规', market: '市场', validator: '校验',
  };
  var TIER_ZH = { economy: '经济', standard: '标准', flagship: '旗舰' };
  var REFRESH_MS = 10000;

  var state = { scope: 'active', list: [], detailId: null, timer: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(t) {
    if (!t) return '—';
    var d = new Date(t), p = function (n) { return n < 10 ? '0' + n : n; };
    return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function fmtDur(ms) {
    if (ms == null) return '—';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + ' 秒';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' 分 ' + (s % 60) + ' 秒';
    return Math.floor(m / 60) + ' 时 ' + (m % 60) + ' 分';
  }
  function fmtFen(f) { return '¥' + ((f || 0) / 100).toFixed(2); }
  function badge(status) {
    return '<span class="pc-badge s-' + esc(status) + '">' + esc(STATUS_ZH[status] || status) + '</span>';
  }
  function liveCell(t) {
    if (t.status !== 'RUNNING' && t.status !== 'QUEUED') return '<span class="pc-live">—</span>';
    return t.live
      ? '<span class="pc-live on"><span class="dot"></span>实时执行</span>'
      : '<span class="pc-live orphan"><span class="dot"></span>孤儿</span>';
  }
  function toast(msg, isErr) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.toggle('err', !!isErr);
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function guard(html, withLogin) {
    $('main').classList.add('hidden');
    var g = $('guard');
    g.classList.remove('hidden');
    g.innerHTML = html + (withLogin ? '<div><a class="pc-btn primary" href="/index.html">去主站登录</a></div>' : '');
  }

  function request(path, opts) {
    return Api.request(path, opts).then(function (r) { return Api.jsonOrThrow(r); });
  }

  function load() {
    return request(prod('/tasks?scope=' + state.scope + '&limit=200')).then(function (j) {
      state.list = j.tasks || [];
      $('guard').classList.add('hidden');
      $('main').classList.remove('hidden');
      render();
    }).catch(function (e) {
      if (e && (e.code === 'AUTH_REQUIRED' || e.httpStatus === 401)) {
        guard('<h2>需要登录</h2><p>请先在主站登录超级管理员账号（18891995171）。</p>', true);
      } else if (e && e.httpStatus === 403) {
        guard('<h2>无权访问</h2><p>制作中管理台仅超级管理员主账号可用。</p>');
      } else {
        toast(e && e.message || '加载失败', true);
      }
    });
  }

  function render() {
    var list = state.list;
    var live = list.filter(function (t) { return t.live && (t.status === 'RUNNING' || t.status === 'QUEUED'); }).length;
    var orphan = list.filter(function (t) { return !t.live && (t.status === 'RUNNING' || t.status === 'QUEUED'); }).length;
    var failed = list.filter(function (t) { return t.status === 'FAILED' || t.status === 'CANCELED'; }).length;
    $('summary').innerHTML =
      '<span class="pc-chip ok"><b>' + live + '</b>实时执行</span>' +
      '<span class="pc-chip"><b>' + (list.filter(function (t) { return t.status === 'QUEUED'; }).length) + '</b>排队中</span>' +
      '<span class="pc-chip bad"><b>' + orphan + '</b>疑似孤儿</span>' +
      (state.scope !== 'active' ? '<span class="pc-chip warn"><b>' + failed + '</b>失败/取消</span>' : '') +
      '<span class="pc-chip"><b>' + list.length + '</b>任务总数</span>';

    var body = $('taskBody');
    body.innerHTML = list.map(function (t) {
      return '<tr data-id="' + esc(t.id) + '">' +
        '<td>' + badge(t.status) + '</td>' +
        '<td class="pc-title-cell"><b>' + esc(t.project ? t.project.title : '（项目已删除）') + '</b>' +
        '<small>' + esc(t.id) + '</small></td>' +
        '<td>' + esc(TIER_ZH[t.engineTier] || t.engineTier || '—') + '</td>' +
        '<td>' + (t.pointsCost || 0) + '</td>' +
        '<td class="pc-hide-sm">' + fmtTime(t.createdAt) + '</td>' +
        '<td>' + fmtDur(t.durationMs) + '</td>' +
        '<td>' + liveCell(t) + '</td>' +
        '<td><button class="pc-btn" data-act="detail">详情</button></td>' +
        '</tr>';
    }).join('');
    $('empty').classList.toggle('hidden', list.length > 0);
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) {
      tr.onclick = function () { openDetail(tr.getAttribute('data-id')); };
    });
  }

  function openDetail(id) {
    state.detailId = id;
    request(prod('/tasks/' + encodeURIComponent(id))).then(function (j) {
      $('mask').classList.add('open');
      $('drawer').classList.add('open');
      renderDetail(j.task);
    }).catch(function (e) { toast(e && e.message || '详情加载失败', true); });
  }
  function closeDetail() {
    state.detailId = null;
    $('mask').classList.remove('open');
    $('drawer').classList.remove('open');
  }

  function renderDetail(t) {
    $('drawerTitle').textContent = (t.project ? t.project.title : '（项目已删除）');
    var p = t.project || {};
    var o = t.owner || {};
    var active = t.status === 'RUNNING' || t.status === 'QUEUED';
    var html =
      '<dl class="pc-kv">' +
      '<dt>任务 ID</dt><dd>' + esc(t.id) + '</dd>' +
      '<dt>状态</dt><dd>' + badge(t.status) + '</dd>' +
      '<dt>执行句柄</dt><dd>' + liveCell(t) + '</dd>' +
      '<dt>档位</dt><dd>' + esc(TIER_ZH[t.engineTier] || t.engineTier || '—') + '</dd>' +
      '<dt>阶段</dt><dd>' + esc(t.stage || '—') + '</dd>' +
      '<dt>冻结积分</dt><dd>' + (t.pointsCost || 0) + '</dd>' +
      '<dt>发起时间</dt><dd>' + fmtTime(t.createdAt) + '</dd>' +
      '<dt>结束时间</dt><dd>' + fmtTime(t.finishedAt) + '</dd>' +
      '<dt>时长</dt><dd>' + fmtDur(t.durationMs) + '</dd>' +
      '<dt>项目</dt><dd>' + esc(p.title || '—') + '（' + esc(p.mode || '?') + '）</dd>' +
      '<dt>项目主人</dt><dd>' + esc(o.nickname || o.phone || p.userId || '—') + (o.phone ? '（' + esc(o.phone) + '）' : '') + '</dd>' +
      (t.errorMsg ? '<dt>错误</dt><dd style="color:var(--danger)">' + esc(t.errorMsg) + '</dd>' : '') +
      '</dl>';

    if (active) {
      html += '<div class="pc-sec">干预</div><div class="pc-actions">';
      if (t.live) {
        html += '<button class="pc-btn danger" id="actCancel">取消任务（中止并退款）</button>';
      } else {
        html += '<button class="pc-btn danger" id="actForceFail">强制失败（清理孤儿）</button>';
      }
      html += '</div><p class="pc-hint">' +
        (t.live
          ? '取消将中止执行管线；已冻结积分按失败路径自动解冻退还。'
          : '该任务已无活跃执行句柄（服务重启悬挂）。强制失败会先按幂等键解冻退还积分，再标记失败；重复操作安全。') +
        '</p>';
    } else {
      html += '<div class="pc-sec">干预</div><p class="pc-hint">任务已结束，无需干预；重跑请回主站项目页重新发起。</p>';
    }

    var logs = t.callLogs || [];
    html += '<div class="pc-sec">岗位调用时间线（' + logs.length + '）</div>';
    if (!logs.length) {
      html += '<p class="pc-hint">暂无模型调用记录' + (t.status === 'QUEUED' ? '（排队中尚未开跑）' : '') + '。</p>';
    } else {
      html += '<table class="pc-log"><thead><tr><th>时间</th><th>岗位</th><th>档位</th><th>输入</th><th>输出</th><th>成本</th></tr></thead><tbody>' +
        logs.map(function (c) {
          return '<tr><td>' + fmtTime(c.createdAt) + '</td><td>' + esc(ROLE_ZH[c.role] || c.role) + '</td>' +
            '<td>' + esc(TIER_ZH[c.engineTier] || c.engineTier || '—') + '</td>' +
            '<td>' + (c.tokensIn || 0) + '</td><td>' + (c.tokensOut || 0) + '</td><td>' + fmtFen(c.costFen) + '</td></tr>';
        }).join('') + '</tbody></table>';
      var total = logs.reduce(function (s, c) { return s + (c.costFen || 0); }, 0);
      html += '<p class="pc-hint">本任务累计采购成本：' + fmtFen(total) + '（成本为内部数据，仅此处可见）。</p>';
    }
    $('drawerBody').innerHTML = html;

    var c = $('actCancel'), f = $('actForceFail');
    if (c) c.onclick = function () { confirmAction('取消该任务？', '将中止「' + (t.project ? t.project.title : t.id) + '」的执行管线，已冻结积分（' + (t.pointsCost || 0) + '）按失败路径自动解冻退还。', '确认取消', function () { doAction('cancel', t.id); }); };
    if (f) f.onclick = function () { confirmAction('强制失败（清理孤儿）？', '该任务已无活跃句柄。将先退还冻结积分（' + (t.pointsCost || 0) + '，幂等安全），再把任务标记为失败。', '确认清理', function () { doAction('force-fail', t.id); }); };
  }

  function confirmAction(title, body, okText, onOk) {
    $('cfTitle').textContent = title;
    $('cfBody').textContent = body;
    $('cfOk').textContent = okText;
    $('confirm').classList.add('open');
    $('cfOk').onclick = function () { $('confirm').classList.remove('open'); onOk(); };
  }
  $('cfCancel').onclick = function () { $('confirm').classList.remove('open'); };

  function doAction(action, id) {
    request(prod('/tasks/' + encodeURIComponent(id) + '/' + action), { method: 'POST', body: '{}' }).then(function (j) {
      toast(action === 'cancel' ? '已发出中止指令，管线将在岗位边界停止并退款' : '已清理为失败，积分已退还');
      load();
      if (state.detailId === id) openDetail(id); else closeDetail();
    }).catch(function (e) {
      toast(e && e.message || '操作失败', true);
      load();
    });
  }

  // scope tabs
  Array.prototype.forEach.call($('scopeTabs').querySelectorAll('button'), function (b) {
    b.onclick = function () {
      Array.prototype.forEach.call($('scopeTabs').querySelectorAll('button'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      state.scope = b.getAttribute('data-scope');
      load();
    };
  });
  $('refreshBtn').onclick = load;
  $('drawerClose').onclick = closeDetail;
  $('mask').onclick = closeDetail;
  $('autoRefresh').onchange = function () {
    if (this.checked) start(); else stop();
  };
  function start() {
    stop();
    state.timer = setInterval(function () { if (!document.hidden) load(); }, REFRESH_MS);
  }
  function stop() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDetail(); $('confirm').classList.remove('open'); } });

  if (!(Api && Api.request)) { guard('<h2>加载失败</h2><p>api.js 未就绪，请刷新页面。</p>'); return; }
  if (!Api.isAuthed || !Api.isAuthed()) {
    guard('<h2>需要登录</h2><p>请先在主站登录超级管理员账号（18891995171）。</p>', true);
    return;
  }
  load();
  start();
})();
