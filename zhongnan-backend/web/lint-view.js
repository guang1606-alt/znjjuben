/* 剧本体检 / 原型选型（v2.511）：把 /api/craft/lint 与 /api/craft/archetype-match 两个免费只读端点接成用户入口。
   自包含，复用全局 Api；纯本地规则引擎，不依赖模型与 Key，不耗积分。中英双语。 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const en = () => ((window.znLang ? window.znLang() : (localStorage.getItem('zn_lang') || 'zh')) === 'en');
  // v2.526 英文界面不混中文标点：全角冒号/书名号只服务中文排版（与编剧室 c199 同口径）
  const colon = () => (en() ? ': ' : '：');
  const wrapGroup = (s) => (en() ? `[${s}] ` : `【${s}】`);
  const L = {
    zh: {
      checking: '正在体检…', matching: '正在匹配原型…',
      needText: '请先粘贴一集正文（至少几十个字）', needIdea: '请先写一句话创意，再匹配原型',
      fail: '请求失败，请重试', avgCap: '体检分',
      counts: (c) => `P0 硬伤 ${c.p0} · P1 需修 ${c.p1} · P2 建议 ${c.p2} · 共 ${c.total} 条`,
      allClear: '✔ 五组检查均未发现硬伤：可以进入下一步打磨。',
      lhEnding: '本集结尾（选填）', lhOutline: '终局大纲（选填）',
      p0: 'P0 硬伤', p1: 'P1 需修', p2: 'P2 建议', groupAvg: (n) => `维度分 ${n}`,
      protag: '主角原型', villain: '反派原型', system: '系统 / 金手指机制',
      noMatch: '未匹配到足够鲜明的原型：补充人物身份、欲望与最怕的东西再试。',
      archHint: '原型只是选型参考——同名原型可以写出完全不同的戏，关键是 formula 里的对冲关系。',
      formula: '公式', core: '用法', tip: '机制', chars: (n) => `已读 ${n} 字`,
      epsNote: (n, total) => (total && total > n
        ? `已检前 ${n} 集（共识别 ${total} 集，其余未检）——情绪线与开篇留存规则已生效`
        : `已识别 ${n} 集，情绪线与开篇留存规则已生效`),
      truncatedNote: '正文超过 2 万字上限，仅体检前 2 万字，后面的内容未检',
      copyReport: '复制问题单', copied: '已复制', copyFailed: '复制失败，请手动选择文本',
      unlockHint: (names) => `未填「${names}」，对应的断章 / 终局倒推检查未运行；补上后再体检可多查两项。`,
      staleHint: '正文或选填项已修改——下方结果对应修改前的内容。',
      staleRerun: '按新内容重跑',
      staleReportNote: '［注意］正文已修改，以下是修改前正文的体检结果。',
    },
    en: {
      checking: 'Checking…', matching: 'Matching archetypes…',
      needText: 'Paste at least one episode first (a few dozen characters)', needIdea: 'Write a one-line idea before matching archetypes',
      fail: 'Request failed, please retry', avgCap: 'Score',
      counts: (c) => `P0 ${c.p0} · P1 ${c.p1} · P2 ${c.p2} · ${c.total} in total`,
      allClear: '✔ All five groups passed — ready for the next polish pass.',
      lhEnding: 'Episode ending (optional)', lhOutline: 'Endgame outline (optional)',
      p0: 'P0 critical', p1: 'P1 fix', p2: 'P2 advice', groupAvg: (n) => `dimension ${n}`,
      protag: 'Lead archetypes', villain: 'Villain archetypes', system: 'System / cheat mechanics',
      noMatch: 'No distinctive archetype matched yet — add identity, want and deepest fear, then retry.',
      archHint: 'Archetypes are reference only: the same archetype can carry a totally different story; the tension in the formula is what matters.',
      formula: 'Formula', core: 'How to use', tip: 'Mechanic', chars: (n) => `${n} chars read`,
      epsNote: (n, total) => (total && total > n
        ? `Checked the first ${n} of ${total} episodes (the rest were not checked) — emotion arc and opening-retention rules are active`
        : `${n} episodes detected — emotion arc and opening-retention rules are active`),
      truncatedNote: 'Text exceeds the 20,000-character limit; only the first 20,000 characters were checked.',
      copyReport: 'Copy issue list', copied: 'Copied', copyFailed: 'Copy failed, please select the text manually',
      unlockHint: (names) => `"${names}" is empty, so the cliffhanger / ending-backcast checks did not run; fill it in and re-run to add two checks.`,
      staleHint: 'Text or optional fields changed — the result below reflects the earlier version.',
      staleRerun: 'Re-run on current text',
      staleReportNote: '[Note] Text has changed; the report below was produced from the earlier text.',
    },
  };
  const T = () => (en() ? L.en : L.zh);
  const xnErr = (m) => window.Xn.toast(m, 'error');
  async function postJson(path, body) {
    const res = await window.Api.request(path, { method: 'POST', body: JSON.stringify(body || {}) });
    return window.Api.jsonOrThrow(res);
  }
  let last = null; // { kind: 'lint' | 'arch', data }
  // v2.664 结果与输入同步：结果只对「提交那一刻的四段输入」成立。用户改了正文却照着旧结果改稿，
  // 等于把上一版结论当成本版结论——这里用输入指纹守卫，过期就提示并可一键按新内容重跑。
  let lastKey = null;
  const LINT_FIELDS = ['lintText', 'lintTitle', 'lintEnding', 'lintOutline'];
  function inputsKey() {
    return LINT_FIELDS.map((id) => String(($(id) || {}).value || '').trim()).join('\u0001');
  }
  function isStale() {
    return !!last && lastKey !== null && lastKey !== inputsKey();
  }
  function syncStale() {
    const box = $('lintResult');
    if (!box) return;
    const stale = isStale();
    box.classList.toggle('lint-stale', stale);
    const bar = box.querySelector('[data-lint-stale]');
    if (stale && !bar) {
      const t = T();
      const el = document.createElement('div');
      el.className = 'lint-stale-bar';
      el.setAttribute('data-lint-stale', '1');
      el.innerHTML = `<span class="lint-stale-dot" aria-hidden="true"></span><span>${esc(t.staleHint)}</span><button type="button" class="chip" data-lint-rerun>${esc(t.staleRerun)}</button>`;
      box.insertBefore(el, box.firstChild || null);
    } else if (!stale && bar) {
      bar.remove();
    }
  }

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

  // 多集正文：用户常把整段剧本一次粘进来。只有切成 episodes 数组交给后端，
  // 情绪线（跨集起伏）与开篇留存（首集钩子）两条规则才会真正生效；单集正文仍走整篇体检。
  function splitEpisodes(raw) {
    const s = String(raw || '');
    const re = /^\s*(?:第\s*[0-9一二三四五六七八九十百千]+\s*集|EP?\s*\d+|Episode\s*\d+)[^\n]*$/gim;
    const marks = [];
    let m;
    while ((m = re.exec(s))) marks.push(m.index);
    if (marks.length < 2) return { eps: [], total: 0 };
    const all = marks
      .map((start, i) => s.slice(start, i + 1 < marks.length ? marks[i + 1] : s.length).trim())
      .filter(Boolean);
    // 后端单次最多 10 集：超出的集不能静默丢掉，把总数一并回报给界面明示
    return { eps: all.slice(0, 10), total: all.length };
  }

  // 分组内按严重度排序：引擎内部按规则顺序产出，直接渲染会让 P2 夹在 P0 前面，用户容易漏掉硬伤
  const LEVEL_RANK = { P0: 0, P1: 1, P2: 2 };
  function sortByLevel(list) {
    return [...(list || [])].sort((a, b) => (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9));
  }

  function renderLint(d, epsN, meta) {
    const t = T();
    const c = d.counts || { p0: 0, p1: 0, p2: 0, total: 0 };
    const note = Number(epsN) >= 2 ? `<div class="muted">${esc(t.epsNote(Number(epsN), meta && meta.epsTotal))}</div>` : '';
    const cutNote = d.truncated ? `<div class="dv-mid">${esc(t.truncatedNote)}</div>` : '';
    const miss = [];
    if (!(meta && meta.ending)) miss.push(t.lhEnding);
    if (!(meta && meta.outline)) miss.push(t.lhOutline);
    const unlock = miss.length ? `<div class="muted">${esc(t.unlockHint(miss.join(' / ')))}</div>` : '';
    const head = `<div class="dv-score-row">
      <div class="dv-score ${scoreClass(Number(d.avg) || 0)}"><span class="dv-score-num">${Number(d.avg) || 0}</span><span class="dv-score-cap">${esc(t.avgCap)}</span></div>
      <div><div class="muted">${esc(t.counts(c))}</div><div class="muted">${esc(t.chars(Number(d.chars) || 0))}</div>${cutNote}${note}${unlock}
        <button type="button" class="chip" data-lint-copy>${esc(t.copyReport)}</button></div>
    </div>`;
    if (!c.total) {
      $('lintResult').innerHTML = `<div class="dv-report">${head}<div class="dv-good">${esc(t.allClear)}</div></div>`;
      return;
    }
    const groups = (d.groups || []).map((g) => {
      const rows = sortByLevel(g.issues).map((i) => `<div class="dv-issue ${levelClass(i.level)}">
        <b>${esc(levelName(i.level))}</b> · ${esc(i.dim || '')}${colon()}${esc(i.advice || '')}
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
      <span class="muted">${esc(t.formula)}${colon()}</span>${esc(a.formula || '')}<br>
      <span class="muted">${esc(t.core)}${colon()}</span>${esc(a.core || '')}
    </div>`).join('');
    return `<div><b>${esc(title)}</b>${items}</div>`;
  }

  function renderArch(d) {
    const t = T();
    const blocks = archBlock(t.protag, d.protag) + archBlock(t.villain, d.villain);
    const sys = (d.system || []).map((m) => `<div class="dv-issue sev-low">
      <b>${esc(m.name || '')}</b><br>
      <span class="muted">${esc(t.formula)}${colon()}</span>${esc(m.formula || '')}<br>
      <span class="muted">${esc(t.tip)}${colon()}</span>${esc(m.tip || '')}
    </div>`).join('');
    const sysBlock = sys ? `<div><b>${esc(t.system)}</b>${sys}</div>` : '';
    $('lintResult').innerHTML = `<div class="dv-report">
      ${blocks || `<div class="muted">${esc(t.noMatch)}</div>`}${sysBlock}
      <div class="muted" style="font-size:12.5px">${esc(t.archHint)}</div>
    </div>`;
  }

  // 问题单落地：把结构化结果拼成纯文本，用户可直接粘给改稿环节或自己的编辑工具
  function reportText(d, epsN, meta) {
    const t = T();
    const c = d.counts || {};
    const lines = [
      `${t.avgCap}: ${Number(d.avg) || 0}`,
      t.counts({ p0: c.p0 || 0, p1: c.p1 || 0, p2: c.p2 || 0, total: c.total || 0 }),
    ];
    if (d.truncated) lines.push(t.truncatedNote);
    if (Number(epsN) >= 2) lines.push(t.epsNote(Number(epsN), meta && meta.epsTotal));
    (d.groups || []).forEach((g) => {
      lines.push('', `${wrapGroup(g.name || '')}${t.groupAvg(Number(g.avg) || 0)}`);
      sortByLevel(g.issues).forEach((i) => lines.push(`- ${levelName(i.level)} · ${i.dim || ''}${colon()}${i.advice || ''}`));
    });
    return lines.join('\n');
  }

  // 非安全上下文（http 非 localhost）没有 navigator.clipboard，统一走 execCommand 兜底
  function copyText(text) {
    const legacy = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) { /* 老浏览器无降级可做 */ }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(legacy);
    }
    legacy();
    return Promise.resolve();
  }

  function reRender() {
    if (!last) return;
    if (last.kind === 'lint') renderLint(last.data, last.eps || 0, last.meta); else renderArch(last.data);
    syncStale(); // 重渲染会清掉提示条：过期状态要跟着结果一起补回来
  }

  async function runLint() {
    const text = String(($('lintText') || {}).value || '').trim();
    if (text.length < 20) { xnErr(T().needText); return; }
    const btn = $('lintRunBtn');
    const old = btn ? btn.disabled : false;
    if (btn) btn.disabled = true;
    $('lintResult').innerHTML = `<div class="muted">${esc(T().checking)}</div>`;
    try {
      const { eps, total: totalEps } = splitEpisodes(text);
      const lang = en() ? 'en' : 'zh';
      const ending = String(($('lintEnding') || {}).value || '').trim();
      const outline = String(($('lintOutline') || {}).value || '').trim();
      const title = String(($('lintTitle') || {}).value || '').trim();
      const body = eps.length >= 2 ? { text, lang, episodes: eps } : { text, lang };
      // 选填字段不填就不发，规则只在填了才有判据，避免给出无依据的结论
      if (title) body.title = title;
      if (ending) body.ending = ending;
      if (outline) body.outline = outline;
      const key = inputsKey(); // 提交前快照：请求期间用户再改动，结果落地后也会立刻被判过期
      const d = await postJson('/api/craft/lint', body);
      const meta = { ending: !!ending, outline: !!outline, epsTotal: totalEps };
      last = { kind: 'lint', data: d, eps: eps.length, meta };
      lastKey = key;
      renderLint(d, eps.length, meta);
    } catch (e) {
      $('lintResult').innerHTML = `<div class="dv-bad">${esc(T().fail)}${colon()}${esc((e && e.message) || '')}</div>`;
    } finally {
      if (btn) btn.disabled = old;
      syncStale();
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
      const key = inputsKey();
      const d = await postJson('/api/craft/archetype-match', { text, lang: en() ? 'en' : 'zh' });
      last = { kind: 'arch', data: d };
      lastKey = key;
      renderArch(d);
    } catch (e) {
      $('lintResult').innerHTML = `<div class="dv-bad">${esc(T().fail)}${colon()}${esc((e && e.message) || '')}</div>`;
    } finally {
      if (btn) btn.disabled = old;
      syncStale();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('lintPanel')) return;
    $('lintRunBtn').onclick = runLint;
    $('lintArchBtn').onclick = runArch;
    $('lintClose').onclick = () => $('lintPanel').classList.add('hidden');
    // 四个输入任一变化都重新判定结果是否还对应现在的正文
    LINT_FIELDS.forEach((id) => { const el = $(id); if (el) el.addEventListener('input', syncStale); });
    document.addEventListener('zn-lang', reRender);
    // 提示条里的「按新内容重跑」随结果区重建，走委托保证不丢
    document.addEventListener('click', (e) => {
      const hit = e.target && e.target.closest && e.target.closest('[data-lint-rerun]');
      if (hit) runLint();
    });
    // 复制按钮随结果区重渲染，用 document 级委托保证绑定不丢
    document.addEventListener('click', (e) => {
      const hit = e.target && e.target.closest && e.target.closest('[data-lint-copy]');
      if (!hit) return;
      if (!last || last.kind !== 'lint') return;
      const warn = isStale() ? T().staleReportNote + '\n' : '';
      copyText(warn + reportText(last.data, last.eps || 0, last.meta)).then(() => {
        const old = hit.textContent;
        hit.textContent = T().copied; hit.disabled = true;
        setTimeout(() => { hit.textContent = old; hit.disabled = false; }, 1200);
      }).catch(() => xnErr(T().copyFailed));
    });
  });
})();
