/* 打磨阶梯（v2.672）：大纲 → 初稿 → 润色 → 定稿四阶路线 + 产出物准入判定。
 * 免费、离线规则引擎：只判「结构要素齐不齐」，不判文采、不耗积分。
 * 设计取向：竖排阶梯 + 鎏金进度线；点阶段看交付物与准入标准；粘贴即判能不进下一阶、还差哪几项。
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const en = () => ((window.znLang ? window.znLang() : (localStorage.getItem('zn_lang') || 'zh')) === 'en');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // UI 帧文案（阶段名称/交付物/准入由后端按语言供给，避免双份维护）
  const L = {
    zh: {
      rung: (i, n) => `第 ${i} / ${n} 阶`,
      deliverable: '交付物', gate: '准入标准', roles: '分工',
      paste: '粘贴这一阶段的产出', pastePh: '把你这一阶段写好的内容贴进来，点下方按钮判定能否进入下一阶。只判结构要素，不评文采。',
      check: '判定能否进阶', checkBusy: '判定中…', needText: '先粘贴这一阶段的产出再判定。',
      okTitle: (next) => `达标，可进入「${next}」`,
      okTitleFinal: '已到定稿阶，结构要素齐全',
      okBody: '结构要素齐全。可以带着这一稿进入下一阶，或继续在本阶打磨。',
      badTitle: (n) => `还差 ${n} 项，暂不能进阶`,
      badBody: '补齐下面几项再判一次。缺失项按「有没有」判定，不涉及好坏。',
      final: '已是最后一阶', empty: '（暂无内容）', err: '判定失败，请稍后重试。',
      railHint: '点阶查看交付物与准入标准',
    },
    en: {
      rung: (i, n) => `Rung ${i} / ${n}`,
      deliverable: 'Deliverable', gate: 'Gate', roles: 'Roles',
      paste: 'Paste this rung’s output', pastePh: 'Paste what you wrote at this rung, then check whether it can move up. Structure only — no prose judging.',
      check: 'Check to advance', checkBusy: 'Checking…', needText: 'Paste this rung’s output first.',
      okTitle: (next) => `Passed — ready for “${next}”`,
      okTitleFinal: 'At the final rung — structure complete',
      okBody: 'All structural elements are present. Move up with this draft, or keep polishing here.',
      badTitle: (n) => `Missing ${n} item(s) — not ready yet`,
      badBody: 'Fill in the items below and check again. Gaps are presence checks, not quality.',
      final: 'Final rung', empty: '(empty)', err: 'Check failed, please retry.',
      railHint: 'Tap a rung to see its deliverable and gate',
    },
  };
  const T = () => L[en() ? 'en' : 'zh'];

  let cache = null;     // { lang, stages: [...], gaps: {...} }
  let curId = null;     // 当前选中的阶段 id
  const drafts = {};    // 阶段 -> 用户粘贴的文本（仅存内存，切阶不丢）
  const passed = {};    // 阶段 -> 本次会话是否判定通过（决定阶梯勾选与进度线）

  async function api(path, opts) {
    const res = await window.Api.request(path, opts || {});
    return window.Api.jsonOrThrow(res);
  }

  async function ensure(force) {
    const lang = en() ? 'en' : 'zh';
    if (!force && cache && cache.lang === lang) return cache;
    const data = await api(`/api/craft/stages?lang=${lang}`);
    cache = { lang, stages: data.stages || [], gaps: data.gaps || {} };
    if (!curId || !cache.stages.some((s) => s.id === curId)) curId = cache.stages.length ? cache.stages[0].id : null;
    renderRail();
    renderDetail();
    return cache;
  }

  function renderRail() {
    const rail = $('stageRail');
    if (!rail || !cache) return;
    const list = cache.stages;
    const curIdx = Math.max(0, list.findIndex((s) => s.id === curId));
    rail.innerHTML = list.map((s, i) => {
      const done = passed[s.id];
      const on = s.id === curId;
      const cls = ['stage-node', on ? 'on' : '', done ? 'done' : '', i < curIdx ? 'past' : ''].filter(Boolean).join(' ');
      return `<li class="${cls}" role="tab" tabindex="0" aria-selected="${on}" data-stage-node="${esc(s.id)}">
        <span class="stage-idx" aria-hidden="true">${done ? '✓' : i + 1}</span>
        <span class="stage-name">${esc(s.label)}</span>
        <span class="stage-tick" aria-hidden="true"></span>
      </li>`;
    }).join('');
  }

  function renderDetail() {
    const box = $('stageDetail');
    if (!box || !cache) return;
    const list = cache.stages;
    const s = list.find((x) => x.id === curId);
    if (!s) { box.innerHTML = ''; return; }
    const t = T();
    const i = list.findIndex((x) => x.id === curId) + 1;
    const text = drafts[s.id] || '';
    box.innerHTML = `
      <div class="stage-detail-head">
        <b>${esc(s.label)}</b>
        <span class="stage-chip">${esc(t.rung(i, list.length))}</span>
      </div>
      <dl class="stage-spec">
        <div><dt>${esc(t.deliverable)}</dt><dd>${esc(s.deliverable)}</dd></div>
        <div><dt>${esc(t.gate)}</dt><dd>${esc(s.gate)}</dd></div>
        <div><dt>${esc(t.roles)}</dt><dd>${(s.roles || []).map((r) => `<span class="stage-role">${esc(r)}</span>`).join('')}</dd></div>
      </dl>
      <label class="stage-paste-l" for="stageText">${esc(t.paste)}</label>
      <textarea id="stageText" class="stage-ta" rows="7" placeholder="${esc(t.pastePh)}">${esc(text)}</textarea>
      <div class="stage-act">
        <button type="button" class="btn-primary" data-stage-check>${esc(t.check)}</button>
        <span class="stage-chars" id="stageChars">${text ? esc(String(text.trim().length)) : ''}</span>
      </div>
      <div id="stageVerdict" class="stage-verdict" role="status" aria-live="polite"></div>`;
  }

  async function check() {
    const btn = document.querySelector('[data-stage-check]');
    const verdict = $('stageVerdict');
    const ta = $('stageText');
    if (!btn || !verdict || !ta || !curId) return;
    const t = T();
    const text = ta.value || '';
    drafts[curId] = text;
    if (!text.trim()) {
      verdict.className = 'stage-verdict blocked';
      verdict.innerHTML = `<b>${esc(t.needText)}</b>`;
      return;
    }
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = t.checkBusy;
    try {
      const r = await api('/api/craft/stage-check', {
        method: 'POST',
        body: JSON.stringify({ stage: curId, text, lang: en() ? 'en' : 'zh' }),
      });
      if (r.ok) passed[curId] = true; else delete passed[curId];
      renderRail();
      if (r.ok) {
        verdict.className = 'stage-verdict ok';
        const title = r.next ? t.okTitle(r.next.label) : t.okTitleFinal;
        verdict.innerHTML = `<b>✔ ${esc(title)}</b><span>${esc(t.okBody)}</span>`;
      } else {
        verdict.className = 'stage-verdict blocked ep-shake';
        const gaps = (r.gaps || []).map((g) => `<span class="stage-gap">${esc(g.label)}</span>`).join('');
        verdict.innerHTML = `<b>✗ ${esc(t.badTitle((r.gaps || []).length))}</b><span>${esc(t.badBody)}</span><div class="stage-gaps">${gaps}</div>`;
      }
    } catch (e) {
      verdict.className = 'stage-verdict blocked';
      verdict.innerHTML = `<b>${esc(t.err)}</b>`;
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  function select(id) {
    curId = id;
    renderRail();
    renderDetail();
  }

  // 阶段节点：点击 / 键盘 Enter·Space
  document.addEventListener('click', (e) => {
    const node = e.target.closest && e.target.closest('[data-stage-node]');
    if (node) { select(node.getAttribute('data-stage-node')); return; }
    if (e.target.closest && e.target.closest('[data-stage-check]')) check();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const node = e.target.closest && e.target.closest('[data-stage-node]');
    if (node) { e.preventDefault(); select(node.getAttribute('data-stage-node')); }
  });

  // 输入时记住草稿 + 轻量字数（不打扰：只在有内容时显示）
  document.addEventListener('input', (e) => {
    const ta = e.target;
    if (!ta || ta.id !== 'stageText' || !curId) return;
    drafts[curId] = ta.value;
    const chars = $('stageChars');
    if (chars) chars.textContent = ta.value.trim() ? String(ta.value.trim().length) : '';
  });

  // 工具箱卡片：点开时再加载（首屏零请求）
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#toolStage')) {
      ensure(false).catch(() => {});
    }
  });
  // 语言切换：清缓存重取
  document.addEventListener('zn-lang', () => {
    if (!cache) return;
    cache = null;
    if ($('stageLadder') && !$('stageLadder').classList.contains('hidden')) ensure(true).catch(() => {});
  });

  // 若面板初始就可见（深链/回退），补一次加载
  window.addEventListener('DOMContentLoaded', () => {
    const panel = $('stageLadder');
    if (panel && !panel.classList.contains('hidden')) ensure(false).catch(() => {});
  });
})();
