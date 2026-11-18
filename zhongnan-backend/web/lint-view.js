/* 剧本体检 / 原型选型（v2.511）：把 /api/craft/lint 与 /api/craft/archetype-match 两个免费只读端点接成用户入口。
   自包含，复用全局 Api；纯本地规则引擎，不依赖模型与 Key，不耗积分。中英双语。 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const en = () => ((window.znLang ? window.znLang() : (localStorage.getItem('zn_lang') || 'zh')) === 'en');
  const L = {
    zh: {
      checking: '正在体检…', matching: '正在匹配原型…',
      needText: '请先粘贴一集正文（至少几十个字）', needIdea: '请先写一句话创意，再匹配原型',
      fail: '请求失败，请重试', avgCap: '体检分',
      counts: (c) => `P0 硬伤 ${c.p0} · P1 需修 ${c.p1} · P2 建议 ${c.p2} · 共 ${c.total} 条`,
      allClear: '✔ 三组检查均未发现硬伤：可以进入下一步打磨。',
      p0: 'P0 硬伤', p1: 'P1 需修', p2: 'P2 建议', groupAvg: (n) => `维度分 ${n}`,
      protag: '主角原型', villain: '反派原型', system: '系统 / 金手指机制',
      noMatch: '未匹配到足够鲜明的原型：补充人物身份、欲望与最怕的东西再试。',
      archHint: '原型只是选型参考——同名原型可以写出完全不同的戏，关键是 formula 里的对冲关系。',
      formula: '公式', core: '用法', tip: '机制', chars: (n) => `已读 ${n} 字`,
    },
    en: {
      checking: 'Checking…', matching: 'Matching archetypes…',
      needText: 'Paste at least one episode first (a few dozen characters)', needIdea: 'Write a one-line idea before matching archetypes',
      fail: 'Request failed, please retry', avgCap: 'Score',
      counts: (c) => `P0 ${c.p0} · P1 ${c.p1} · P2 ${c.p2} · ${c.total} in total`,
      allClear: '✔ All three groups passed — ready for the next polish pass.',
      p0: 'P0 critical', p1: 'P1 fix', p2: 'P2 advice', groupAvg: (n) => `dimension ${n}`,
      protag: 'Lead archetypes', villain: 'Villain archetypes', system: 'System / cheat mechanics',
      noMatch: 'No distinctive archetype matched yet — add identity, want and deepest fear, then retry.',
      archHint: 'Archetypes are reference only: the same archetype can carry a totally different story; the tension in the formula is what matters.',
      formula: 'Formula', core: 'How to use', tip: 'Mechanic', chars: (n) => `${n} chars read`,
    },
  };
  const T = () => (en() ? L.en : L.zh);
  const xnErr = (m) => window.Xn.toast(m, 'error');
  async function postJson(path, body) {
    const res = await window.Api.request(path, { method: 'POST', body: JSON.stringify(body || {}) });
    return window.Api.jsonOrThrow(res);
  }
  let last = null; // { kind: 'lint' | 'arch', data }

  function levelClass(level) {
    return level === 'P1' ? 'sev-mid' : level === 'P2' ? 'sev-low' : '';
  }
  function levelName(level) {
    const t = T();
    return level === 'P0' ? t.p0 : level === 'P1' ? t.p1 : t.p2;
  }
  function scoreClass(avg) {
    return avg >= 80 ? 'dv-good' : avg >= 60 ? 'dv-mid' : 'dv-bad';
  }

  function renderLint(d) {
    const t = T();
    const c = d.counts || { p0: 0, p1: 0, p2: 0, total: 0 };
    const head = `<div class="dv-score-row">
      <div class="dv-score ${scoreClass(Number(d.avg) || 0)}"><span class="dv-score-num">${Number(d.avg) || 0}</span><span class="dv-score-cap">${esc(t.avgCap)}</span></div>
      <div><div class="muted">${esc(t.counts(c))}</div><div class="muted">${esc(t.chars(Number(d.chars) || 0))}</div></div>
    </div>`;
    if (!c.total) {
      $('lintResult').innerHTML = `<div class="dv-report">${head}<div class="dv-good">${esc(t.allClear)}</div></div>`;
      return;
    }
    const groups = (d.groups || []).map((g) => {
      const rows = (g.issues || []).map((i) => `<div class="dv-issue ${levelClass(i.level)}">
        <b>${esc(levelName(i.level))}</b> · ${esc(i.dim || '')}：${esc(i.advice || '')}
      </div>`).join('');
      const avg = Number(g.avg) || 0;
      return `<div><b>${esc(g.name || '')}</b> <span class="muted">${esc(t.groupAvg(avg))}</span>${rows || `<div class="dv-good">✔</div>`}</div>`;
    }).join('');
    $('lintResult').innerHTML = `<div class="dv-report">${head}${groups}</div>`;
  }

  function archBlock(title, list) {
    if (!list || !list.length) return '';
    const t = T();
    const items = list.map((a) => `<div class="dv-issue sev-low">
      <b>${esc(a.name || '')}</b><br>
      <span class="muted">${esc(t.formula)}：</span>${esc(a.formula || '')}<br>
      <span class="muted">${esc(t.core)}：</span>${esc(a.core || '')}
    </div>`).join('');
    return `<div><b>${esc(title)}</b>${items}</div>`;
  }

  function renderArch(d) {
    const t = T();
    const blocks = archBlock(t.protag, d.protag) + archBlock(t.villain, d.villain);
    const sys = (d.system || []).map((m) => `<div class="dv-issue sev-low">
      <b>${esc(m.name || '')}</b><br>
      <span class="muted">${esc(t.formula)}：</span>${esc(m.formula || '')}<br>
      <span class="muted">${esc(t.tip)}：</span>${esc(m.tip || '')}
    </div>`).join('');
    const sysBlock = sys ? `<div><b>${esc(t.system)}</b>${sys}</div>` : '';
    $('lintResult').innerHTML = `<div class="dv-report">
      ${blocks || `<div class="muted">${esc(t.noMatch)}</div>`}${sysBlock}
      <div class="muted" style="font-size:12.5px">${esc(t.archHint)}</div>
    </div>`;
  }

  function reRender() {
    if (!last) return;
    if (last.kind === 'lint') renderLint(last.data); else renderArch(last.data);
  }

  async function runLint() {
    const text = String(($('lintText') || {}).value || '').trim();
    if (text.length < 20) { xnErr(T().needText); return; }
    const btn = $('lintRunBtn');
    const old = btn ? btn.disabled : false;
    if (btn) btn.disabled = true;
    $('lintResult').innerHTML = `<div class="muted">${esc(T().checking)}</div>`;
    try {
      const d = await postJson('/api/craft/lint', { text, lang: en() ? 'en' : 'zh' });
      last = { kind: 'lint', data: d };
      renderLint(d);
    } catch (e) {
      $('lintResult').innerHTML = `<div class="dv-bad">${esc(T().fail)}：${esc((e && e.message) || '')}</div>`;
    } finally {
      if (btn) btn.disabled = old;
    }
  }

  async function runArch() {
    const text = String(($('lintText') || {}).value || '').trim();
    if (!text) { xnErr(T().needIdea); return; }
    const btn = $('lintArchBtn');
    const old = btn ? btn.disabled : false;
    if (btn) btn.disabled = true;
    $('lintResult').innerHTML = `<div class="muted">${esc(T().matching)}</div>`;
    try {
      const d = await postJson('/api/craft/archetype-match', { text });
      last = { kind: 'arch', data: d };
      renderArch(d);
    } catch (e) {
      $('lintResult').innerHTML = `<div class="dv-bad">${esc(T().fail)}：${esc((e && e.message) || '')}</div>`;
    } finally {
      if (btn) btn.disabled = old;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('lintPanel')) return;
    $('lintRunBtn').onclick = runLint;
    $('lintArchBtn').onclick = runArch;
    $('lintClose').onclick = () => $('lintPanel').classList.add('hidden');
    document.addEventListener('zn-lang', reRender);
  });
})();
