/* 多版本反同质化（PRD 2.1.1）：写前正交种子 + 写后两两体检。自包含，复用全局 Api；craft 端点纯本地免费。中英双语。 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const en = () => ((window.znLang ? window.znLang() : (localStorage.getItem('zn_lang') || 'zh')) === 'en');
  const L = {
    zh: {
      version: '版本', remove: '移除', phLog: '这一版的梗概/故事核（谁+麻烦+怎么反击）',
      phArch: '主角原型，如 落魄原配', phConf: '冲突标签（顿号分隔），如 财产争夺、尊严羞辱', phPlot: '走向标签，如 证据反杀、反向利用',
      minTwoDel: '至少保留 2 个版本用于比对', minTwoAudit: '请至少填写 2 个版本（梗概或标签任一即可）', maxSix: '最多比对 6 个版本',
      seedTitle: '写前正交种子（从源头避免一个模子）', arch: '原型', conflict: '冲突', turn: '反转', tone: '基调',
      comparing: '小南正在两两比对…',
      vDiverse: '差异化达标', dDiverse: '各版本主角原型、冲突、走向区分清晰，不是换汤不换药。',
      vBorder: '部分趋同，建议拉开', dBorder: '整体不算伪多版本，但仍有维度偏近，按下方建议再拉开。',
      vPseudo: '检出伪多版本', dPseudo: '存在高度雷同的版本对，必须按下方建议重写故事核，否则等于只出了一版。',
      scoreCap: '差异化分', pairs: (n) => `（比对 ${n} 对版本）`, issuesTitle: '需要拉开的地方',
      ver: '版本', overlap: (p) => `重合度 ${p}%`, noOverlap: '✔ 没有发现过度重合的版本对',
      matrix: '查看两两重合度明细', thPair: '版本对', thConf: '冲突重合', thPlot: '走向重合', thLog: '梗概相似',
      auditFail: '体检失败', retry: '请重试',
      dims: { archetype: '主角原型', conflict: '核心冲突', plot: '剧情走向', logline: '梗概文本' },
    },
    en: {
      version: 'Version', remove: 'Remove', phLog: 'This version’s logline / core (who + trouble + counter)',
      phArch: 'Lead archetype, e.g. disgraced first wife', phConf: 'Conflict tags (comma separated)', phPlot: 'Plot-turn tags, e.g. evidence counter-kill',
      minTwoDel: 'Keep at least 2 versions to compare', minTwoAudit: 'Fill in at least 2 versions (logline or tags)', maxSix: 'Compare at most 6 versions',
      seedTitle: 'Pre-write orthogonal seeds (avoid same-mold from the source)', arch: 'Archetype', conflict: 'Conflict', turn: 'Turn', tone: 'Tone',
      comparing: 'Xiaonan is cross-comparing…',
      vDiverse: 'Diversity OK', dDiverse: 'Archetypes, conflicts and turns are clearly distinct — not a re-skin.',
      vBorder: 'Partially similar — widen the gap', dBorder: 'Not a fake multi-version overall, but some dimensions are close; widen per the advice below.',
      vPseudo: 'Fake multi-version detected', dPseudo: 'Highly similar pairs exist — rewrite the core per the advice, otherwise it is effectively one version.',
      scoreCap: 'Diversity', pairs: (n) => `(${n} pairs compared)`, issuesTitle: 'Where to widen the gap',
      ver: 'V', overlap: (p) => `overlap ${p}%`, noOverlap: '✔ No over-similar pair found',
      matrix: 'Show pairwise overlap detail', thPair: 'Pair', thConf: 'Conflict overlap', thPlot: 'Plot overlap', thLog: 'Logline similarity',
      auditFail: 'Audit failed', retry: 'please retry',
      dims: { archetype: 'Lead archetype', conflict: 'Core conflict', plot: 'Plot turn', logline: 'Logline text' },
    },
  };
  const T = () => (en() ? L.en : L.zh);
  const splitTags = (s) => String(s || '').split(/[,，、;；\s]+/).map((x) => x.trim()).filter(Boolean);
  let rowSeq = 0;
  async function getJson(path) {
    const res = await window.Api.request(path);
    return window.Api.jsonOrThrow(res);
  }
  async function postJson(path, body) {
    const res = await window.Api.request(path, { method: 'POST', body: JSON.stringify(body || {}) });
    return window.Api.jsonOrThrow(res);
  }
  function addRow(prefill) {
    const t = T();
    rowSeq += 1;
    const wrap = $('dvRows');
    const div = document.createElement('div');
    div.className = 'dv-row';
    div.dataset.idx = rowSeq;
    div.innerHTML = `
      <div class="dv-row-head"><b>${t.version} <span class="dv-no"></span></b><span class="spacer" style="flex:1"></span>
        <button type="button" class="chip dv-del">${t.remove}</button></div>
      <textarea class="dv-logline" rows="2" placeholder="${t.phLog}"></textarea>
      <div class="dv-tagline">
        <input class="dv-arch" placeholder="${t.phArch}" />
        <input class="dv-conf" placeholder="${t.phConf}" />
        <input class="dv-plot" placeholder="${t.phPlot}" />
      </div>`;
    wrap.appendChild(div);
    div.querySelector('.dv-del').onclick = () => {
      if ($('dvRows').children.length <= 2) { window.Xn.toast(T().minTwoDel); return; }
      div.remove(); renumber();
    };
    if (prefill) {
      if (prefill.archetype) div.querySelector('.dv-arch').value = prefill.archetype;
      if (prefill.logline) div.querySelector('.dv-logline').value = prefill.logline;
    }
    renumber();
    return div;
  }
  function renumber() {
    [...$('dvRows').children].forEach((r, i) => { const n = r.querySelector('.dv-no'); if (n) n.textContent = i + 1; });
  }
  function collect() {
    return [...$('dvRows').children].map((r, i) => ({
      id: i + 1,
      logline: r.querySelector('.dv-logline').value.trim(),
      archetype: r.querySelector('.dv-arch').value.trim() || undefined,
      conflictTags: splitTags(r.querySelector('.dv-conf').value),
      plotTags: splitTags(r.querySelector('.dv-plot').value),
    }));
  }
  let lastSeeds = null, lastAudit = null;
  function renderSeeds(j) {
    const t = T();
    $('dvResult').innerHTML = `<div class="dv-seed-box"><b>${t.seedTitle}</b>
      ${j.seeds.map((s) => `<div class="dv-seed-item"><span class="dv-seed-no">V${s.version}</span>
        <span class="dv-seed-tags">${t.arch}「${esc(s.archetype)}」·${t.conflict}「${esc(s.conflict)}」·${t.turn}「${esc(s.turn)}」·${t.tone}「${esc(s.tone)}」</span>
        <div class="muted">${esc(s.directive)}</div></div>`).join('')}</div>`;
  }
  async function genSeeds() {
    const n = Math.min(6, Math.max(2, $('dvRows').children.length));
    const j = await getJson('/api/craft/diverse-seeds?n=' + n + '&lang=' + (en() ? 'en' : 'zh'));
    // 把正交主角原型填进现有版本（只填空，不覆盖用户已写）
    const rows = [...$('dvRows').children];
    j.seeds.forEach((s, i) => {
      const row = rows[i]; if (!row) return;
      const arch = row.querySelector('.dv-arch');
      if (!arch.value) arch.value = s.archetype;
    });
    lastSeeds = j; lastAudit = null;
    renderSeeds(j);
  }
  function renderAudit(r) {
    const t = T();
    const verdictMap = {
      diverse: { t: t.vDiverse, c: 'dv-good', d: t.dDiverse },
      borderline: { t: t.vBorder, c: 'dv-mid', d: t.dBorder },
      pseudo: { t: t.vPseudo, c: 'dv-bad', d: t.dPseudo },
    };
    const v = verdictMap[r.verdict] || verdictMap.borderline;
    const pct = Math.round(r.score);
    $('dvResult').innerHTML = `
      <div class="dv-report">
        <div class="dv-score-row">
          <div class="dv-score ${v.c}"><span class="dv-score-num">${pct}</span><span class="dv-score-cap">${t.scoreCap}</span></div>
          <div><b class="${v.c}">${v.t}</b><div class="muted">${v.d}${t.pairs(r.pairs)}</div></div>
        </div>
        ${r.issues.length ? `<div class="dv-issues"><b>${t.issuesTitle}</b>${r.issues.map((x) =>
          `<div class="dv-issue sev-${x.severity}"><span>${t.ver}${esc(x.a)} × ${t.ver}${esc(x.b)} · ${dimName(x.dimension)} · ${t.overlap(Math.round(x.value * 100))}</span><div>${esc(x.advice)}</div></div>`).join('')}</div>`
          : `<div class="dv-good">${t.noOverlap}</div>`}
        <details class="dv-matrix"><summary>${t.matrix}</summary><table class="dv-table">
          <thead><tr><th>${t.thPair}</th><th>${t.thConf}</th><th>${t.thPlot}</th><th>${t.thLog}</th></tr></thead><tbody>
          ${r.matrix.map((m) => `<tr><td>${esc(m.a)} × ${esc(m.b)}</td><td>${Math.round(m.conflictOverlap * 100)}%</td><td>${Math.round(m.plotOverlap * 100)}%</td><td>${Math.round(m.loglineSim * 100)}%</td></tr>`).join('')}
          </tbody></table></details>
      </div>`;
  }
  async function audit() {
    const versions = collect().filter((v) => v.logline || v.archetype || v.conflictTags.length || v.plotTags.length);
    if (versions.length < 2) { window.Xn.toast(T().minTwoAudit); return; }
    $('dvResult').innerHTML = `<div class="muted">${T().comparing}</div>`;
    try {
      const r = await postJson('/api/craft/diversity-audit', { versions, lang: en() ? 'en' : 'zh' });
      lastAudit = r;
      renderAudit(r);
      $('dvResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      $('dvResult').innerHTML = `<div class="dv-bad">${T().auditFail}：${esc((e && e.message) || T().retry)}</div>`;
    }
  }
  function dimName(d) { return (T().dims[d]) || d; }
  document.addEventListener('DOMContentLoaded', () => {
    if (!$('diversityPanel')) return;
    addRow(); addRow(); addRow();
    $('toolDiversity').onclick = () => {
      const rp = $('roomPanel'); if (rp) rp.classList.add('hidden');
      $('diversityPanel').classList.remove('hidden');
      $('diversityPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $('dvClose').onclick = () => $('diversityPanel').classList.add('hidden');
    $('dvAddBtn').onclick = () => { if ($('dvRows').children.length >= 6) { window.Xn.toast(T().maxSix); return; } addRow(); };
    $('dvSeedBtn').onclick = genSeeds;
    $('dvAuditBtn').onclick = audit;
    document.addEventListener('zn-lang', () => {
      // 重建行标签/占位（保留已填内容）
      const saved = collect();
      $('dvRows').innerHTML = ''; rowSeq = 0;
      saved.forEach((s) => { const d = addRow(); d.querySelector('.dv-logline').value = s.logline || ''; d.querySelector('.dv-arch').value = s.archetype || ''; d.querySelector('.dv-conf').value = (s.conflictTags || []).join('、'); d.querySelector('.dv-plot').value = (s.plotTags || []).join('、'); });
      while ($('dvRows').children.length < 3) addRow();
      if (lastAudit) renderAudit(lastAudit); else if (lastSeeds) renderSeeds(lastSeeds);
    });
  });
})();
