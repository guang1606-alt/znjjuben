/* 互动短剧可视化分支编辑器（PRD 3.5，v1.85；v1.88 中英双语）
 * 结构增删改全部走后端 /api/craft/branch-mutate（唯一事实源、已单测），前端只负责渲染/拖拽/检查器。
 * 节点拖拽位置仅为本地视图覆盖，不改变结构。纯本地计算，不耗积分。 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const en = () => ((window.znLang ? window.znLang() : (localStorage.getItem('zn_lang') || 'zh')) === 'en');
  const L = {
    zh: {
      type: { scene: '剧情', choice: '选择点', ending: '结局' }, end: { main: '主线', hidden: '隐藏', bad: '坏' }, endSuffix: '结局',
      prob: '概率', rand: '随机', outEdge: '出边', start: '●起点 ',
      insEmpty: '点画布节点编辑，按住拖动调整位置。',
      weightTitle: '各分支权重（自动换算概率）', applyW: '应用权重',
      kind: '选择机制', kFixed: '固定选项（玩家选）', kRandom: '等概率随机', kProb: '概率触发（设权重）',
      noOut: '暂无出边', unlink: '断开', node: '节点', name: '名称', ntype: '类型', endKind: '结局种类',
      badEnd: '坏结局', linkTo: '连到', link: '连线', delNode: '删除节点', startNoDel: '起点不可删除',
      score: (s) => `结构评分 ${s}/100 · `, closed: '✅ 全分支闭环', notClosed: '❌ 未完全闭环',
      reach: (a, b) => `可达 ${a}/${b} · 选择点 `, endCount: (c, m, h, b) => ` · 结局 主${m}/隐${h}/坏${b}`,
      sevHigh: '严重', sevMid: '中等', sevLow: '建议', structOk: '结构合法，可进入剧本生成。',
      newScene: '新剧情', newChoice: '新选择点', newEnding: '新结局',
      jsonFail: (m) => 'JSON 解析失败：' + m, jsonCopied: '分支图 JSON 已复制',
    },
    en: {
      type: { scene: 'Scene', choice: 'Choice', ending: 'Ending' }, end: { main: 'Main', hidden: 'Hidden', bad: 'Bad' }, endSuffix: ' end',
      prob: 'Weighted', rand: 'Random', outEdge: 'out', start: '●Start ',
      insEmpty: 'Tap a node to edit; drag to reposition.',
      weightTitle: 'Branch weights (auto % shown)', applyW: 'Apply weights',
      kind: 'Choice mode', kFixed: 'Fixed (player picks)', kRandom: 'Equal random', kProb: 'Weighted probability',
      noOut: 'No outgoing link', unlink: 'Unlink', node: 'Node', name: 'Label', ntype: 'Type', endKind: 'Ending kind',
      badEnd: 'Bad ending', linkTo: 'Link to', link: 'Link', delNode: 'Delete node', startNoDel: 'Start node cannot be deleted',
      score: (s) => `Structure ${s}/100 · `, closed: '✅ all branches closed', notClosed: '❌ not fully closed',
      reach: (a, b) => `Reachable ${a}/${b} · choices `, endCount: (c, m, h, b) => ` · endings main${m}/hidden${h}/bad${b}`,
      sevHigh: 'High', sevMid: 'Mid', sevLow: 'Hint', structOk: 'Structure valid — ready to generate.',
      newScene: 'New scene', newChoice: 'New choice', newEnding: 'New ending',
      jsonFail: (m) => 'JSON parse failed: ' + m, jsonCopied: 'Branch graph JSON copied',
    },
  };
  const T = () => (en() ? L.en : L.zh);
  const NODE_W = 168, NODE_H = 64;
  let graph = null;            // 当前 BranchGraph
  let layout = {};             // id -> {x,y,depth}
  let posOverride = {};        // 用户拖拽覆盖坐标 id->{x,y}
  let selected = null, lastReport = null;
  async function getJson(path) { const r = await window.Api.request(path); return window.Api.jsonOrThrow(r); }
  async function postJson(path, body) {
    const r = await window.Api.request(path, { method: 'POST', body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
    return j;
  }
  const posOf = (id) => posOverride[id] || layout[id] || { x: 40, y: 40 };
  function setState(next, nextLayout) {
    graph = next; layout = nextLayout || {};
    const keep = {}; Object.keys(posOverride).forEach((id) => { if (graph.nodes[id]) keep[id] = posOverride[id]; }); posOverride = keep;
    syncTextarea(); render(); renderInspector();
  }
  async function mutate(op) {
    if (!graph) return;
    try { const j = await postJson('/api/craft/branch-mutate', { graph, op, lang: en() ? 'en' : 'zh' }); setState(j.graph, j.layout); renderReport(j.report); }
    catch (e) { window.xnSay ? window.xnSay(e.message) : console.error(e.message); }
  }
  function render() {
    const t = T();
    const canvas = $('brCanvas'), nodesBox = $('brNodes'), svg = $('brEdges');
    if (!canvas || !graph) { if (nodesBox) nodesBox.innerHTML = ''; if (svg) svg.innerHTML = ''; return; }
    $('brEmpty').style.display = Object.keys(graph.nodes).length ? 'none' : '';
    const ids = Object.keys(graph.nodes);
    let maxX = 0, maxY = 0;
    ids.forEach((id) => { const p = posOf(id); maxX = Math.max(maxX, p.x + NODE_W + 40); maxY = Math.max(maxY, p.y + NODE_H + 40); });
    const W = Math.max(maxX, canvas.clientWidth || 600), H = Math.max(maxY, 380);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    nodesBox.style.width = W + 'px'; nodesBox.style.height = H + 'px';
    let lines = '';
    ids.forEach((id) => (graph.nodes[id].to || []).forEach((tx) => {
      if (!graph.nodes[tx]) return;
      const a = posOf(id), b = posOf(tx);
      const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2, mx = (x1 + x2) / 2;
      lines += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" class="br-edge${selected === tx || selected === id ? ' on' : ''}" marker-end="url(#brArrow)"/>`;
    }));
    svg.innerHTML = `<defs><marker id="brArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" class="br-arrow"/></marker></defs>${lines}`;
    nodesBox.innerHTML = ids.map((id) => {
      const n = graph.nodes[id], p = posOf(id);
      const cls = ['br-node', 'br-' + n.type, selected === id ? 'sel' : '', id === graph.start ? 'is-start' : ''].join(' ');
      const sub = n.type === 'ending' ? (t.end[n.endingType] || t.end.main) + t.endSuffix : (n.kind === 'probability' ? t.prob : n.kind === 'random' ? t.rand : t.type[n.type]);
      return `<div class="${cls}" data-id="${esc(id)}" style="left:${p.x}px;top:${p.y}px;width:${NODE_W}px">
        <div class="br-node-h">${id === graph.start ? t.start : ''}${esc(n.label || id)}</div>
        <div class="br-node-s">${esc(sub)} · ${t.outEdge} ${(n.to || []).length}</div></div>`;
    }).join('');
    bindNodeDrag();
  }
  function bindNodeDrag() {
    $('brNodes').querySelectorAll('.br-node').forEach((el) => {
      el.addEventListener('click', (e) => { e.stopPropagation(); selected = el.dataset.id; render(); renderInspector(); });
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const id = el.dataset.id; selected = id; renderInspector();
        const start = posOf(id), sx = e.clientX, sy = e.clientY;
        const move = (ev) => { posOverride[id] = { x: Math.max(0, start.x + ev.clientX - sx), y: Math.max(0, start.y + ev.clientY - sy) }; render(); };
        const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
      });
    });
  }
  function renderInspector() {
    const box = $('brInspector'); if (!box || !graph) return; const t = T();
    if (!selected || !graph.nodes[selected]) { box.innerHTML = znEmptyHtml(t.insEmpty); return; }
    const id = selected, n = graph.nodes[id];
    const others = Object.keys(graph.nodes).filter((x) => x !== id && !(n.to || []).includes(x));
    const kind = n.kind || 'fixed';
    // 概率触发：为每条出边给权重输入，并实时显示百分比
    let weightRows = '';
    if (n.type === 'choice' && kind === 'probability') {
      const ws = n.weights || (n.to || []).map(() => 1);
      const sum = ws.reduce((s, x) => s + (Number(x) || 0), 0) || 1;
      weightRows = '<div class="br-fld"><b>' + t.weightTitle + '</b>' + (n.to || []).map((tx, i) => {
        const pct = ((Number(ws[i]) || 0) / sum * 100).toFixed(0);
        return `<div class="br-wrow"><span>${esc(graph.nodes[tx]?.label || tx)}</span><input class="br-w" type="number" min="0" step="1" value="${Number(ws[i]) ?? 1}"/><em>${pct}%</em></div>`;
      }).join('') + `<button class="chip" id="brApplyW">${t.applyW}</button></div>`;
    }
    const kindBlock = n.type === 'choice' ? `<label class="br-fld">${t.kind}<select id="brInKind">
        <option value="fixed"${kind === 'fixed' ? ' selected' : ''}>${t.kFixed}</option>
        <option value="random"${kind === 'random' ? ' selected' : ''}>${t.kRandom}</option>
        <option value="probability"${kind === 'probability' ? ' selected' : ''}>${t.kProb}</option></select></label>${weightRows}` : '';
    const out = (n.to || []).map((tx) => `<li>${esc(graph.nodes[tx]?.label || tx)} <button class="chip br-unlink" data-to="${esc(tx)}">${t.unlink}</button></li>`).join('') || `<li class="muted">${t.noOut}</li>`;
    box.innerHTML = `
      <div><b>${t.node} ${esc(id)}</b></div>
      <label class="br-fld">${t.name}<input id="brInLabel" value="${esc(n.label || '')}" placeholder="${esc(id)}"/></label>
      <label class="br-fld">${t.ntype}<select id="brInType">
        <option value="scene"${n.type === 'scene' ? ' selected' : ''}>${t.type.scene}</option>
        <option value="choice"${n.type === 'choice' ? ' selected' : ''}>${t.type.choice}</option>
        <option value="ending"${n.type === 'ending' ? ' selected' : ''}>${t.type.ending}</option></select></label>
      ${n.type === 'ending' ? `<label class="br-fld">${t.endKind}<select id="brInEnd">
        <option value="main"${n.endingType === 'main' ? ' selected' : ''}>${t.end.main}</option>
        <option value="hidden"${n.endingType === 'hidden' ? ' selected' : ''}>${t.end.hidden}</option>
        <option value="bad"${n.endingType === 'bad' ? ' selected' : ''}>${t.badEnd}</option></select></label>` : ''}
      ${kindBlock}
      <div class="br-fld"><b>${t.linkTo}</b><select id="brLinkSel">${others.map((o) => `<option value="${esc(o)}">${esc(graph.nodes[o].label || o)}</option>`).join('')}</select>
        <button class="chip" id="brLinkBtn">${t.link}</button></div>
      <ul class="br-outlist">${out}</ul>
      <button class="chip" id="brDel" style="color:#d4473b">${t.delNode}</button>`;
    $('brInLabel').onchange = () => mutate({ op: 'relabel', id, label: $('brInLabel').value });
    $('brInType').onchange = () => mutate({ op: 'setType', id, nodeType: $('brInType').value, endingType: $('brInEnd') ? $('brInEnd').value : undefined });
    if ($('brInEnd')) $('brInEnd').onchange = () => mutate({ op: 'setType', id, nodeType: 'ending', endingType: $('brInEnd').value });
    if ($('brInKind')) $('brInKind').onchange = () => {
      const k = $('brInKind').value;
      const weights = k === 'probability' ? (n.to || []).map(() => 1) : undefined;
      mutate({ op: 'setKind', id, kind: k, weights });
    };
    const aw = $('brApplyW');
    if (aw) aw.onclick = () => {
      const weights = [...box.querySelectorAll('.br-w')].map((inp) => Math.max(0, Number(inp.value) || 0));
      mutate({ op: 'setKind', id, kind: 'probability', weights });
    };
    const lb = $('brLinkBtn'); if (lb) lb.onclick = () => { const v = $('brLinkSel').value; if (v) mutate({ op: 'link', from: id, to: v }); };
    box.querySelectorAll('.br-unlink').forEach((b) => b.onclick = () => mutate({ op: 'unlink', from: id, to: b.dataset.to }));
    $('brDel').onclick = () => { if (id === graph.start) { window.xnSay && window.xnSay(t.startNoDel); return; } selected = null; mutate({ op: 'removeNode', id }); };
  }
  function renderReport(report) {
    const box = $('brResult'); if (!box || !report) return;
    lastReport = report; const t = T();
    const e = report.endings || {}, issues = report.issues || [];
    const head = `<div class="dv-row" style="margin-top:8px"><div class="dv-row-head"><b>${t.score(report.score)}${report.closedLoop ? t.closed : t.notClosed}</b></div>
      <div class="muted">${t.reach(report.reachableCount, report.totalCount)}${report.choiceCount}${t.endCount(0, e.main || 0, e.hidden || 0, e.bad || 0)}</div></div>`;
    const list = issues.length ? `<ul class="plan-perks" style="margin-top:6px">${issues.map((i) => {
      const c = i.severity === 'high' ? '#d4473b' : i.severity === 'mid' ? '#d98a16' : '#7a8790';
      const sev = i.severity === 'high' ? t.sevHigh : i.severity === 'mid' ? t.sevMid : t.sevLow;
      return `<li><b style="color:${c}">[${sev}${i.node ? '·' + esc(i.node) : ''}]</b> ${esc(i.evidence)} <span class="muted">→ ${esc(i.advice)}</span></li>`;
    }).join('')}</ul>` : `<div class="tag-report ok" style="margin-top:8px">${t.structOk}</div>`;
    box.innerHTML = head + list;
  }
  function syncTextarea() { const ta = $('brGraph'); if (ta && graph) ta.value = JSON.stringify(graph, null, 2); }
  async function genSkeleton() {
    const cp = parseInt(($('brCp') && $('brCp').value) || '2', 10);
    const j = await getJson('/api/craft/branch-skeleton?choicePoints=' + cp + '&lang=' + (en() ? 'en' : 'zh'));
    posOverride = {}; selected = null; setState(j.graph, j.layout); renderReport(j.report);
  }
  async function validateOnly() { if (graph) { const j = await postJson('/api/craft/branch-validate', { graph, lang: en() ? 'en' : 'zh' }); renderReport(j.report); } }
  function init() {
    const card = $('toolBranch'), panel = $('branchPanel');
    if (!card) return;
    card.addEventListener('click', () => { panel.classList.remove('hidden'); if (!graph) genSkeleton().catch(() => {}); });
    $('brClose').addEventListener('click', () => panel.classList.add('hidden'));
    $('brSkelBtn').onclick = () => genSkeleton().catch((e) => window.xnSay && window.xnSay(e.message));
    $('brValidateBtn').onclick = () => validateOnly().catch((e) => window.xnSay && window.xnSay(e.message));
    $('brAddScene').onclick = () => mutate({ op: 'addNode', nodeType: 'scene', label: T().newScene });
    $('brAddChoice').onclick = () => mutate({ op: 'addNode', nodeType: 'choice', label: T().newChoice });
    $('brAddEnding').onclick = () => mutate({ op: 'addNode', nodeType: 'ending', endingType: 'main', label: T().newEnding });
    $('brImport').onclick = async () => {
      try {
        const g = JSON.parse($('brGraph').value);
        const v = await postJson('/api/craft/branch-validate', { graph: g, lang: en() ? 'en' : 'zh' });
        posOverride = {}; selected = null; setState(v.graph, v.layout); renderReport(v.report);
      } catch (e) { window.xnSay && window.xnSay(T().jsonFail(e.message)); }
    };
    $('brCopy').onclick = () => { if (graph) { navigator.clipboard?.writeText(JSON.stringify(graph, null, 2)); window.xnSay && window.xnSay(T().jsonCopied); } };
    window.addEventListener('resize', () => graph && render());
    document.addEventListener('zn-lang', () => { if (graph) { render(); renderInspector(); if (lastReport) renderReport(lastReport); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
