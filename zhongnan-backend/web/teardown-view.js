/* 拆爆款工作台前端：拆解 → 选标签/方向 → 改编大纲 → 确认进入改编创作。中英双语。 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const en = () => ((window.znLang ? window.znLang() : (localStorage.getItem('zn_lang') || 'zh')) === 'en');
  const L = {
    zh: {
      busy: '处理中…', analyzeFail: '拆解失败，请检查内容长度或积分余额', done: (p) => `拆解完成，本次消耗 ${p} 积分`,
      outlineFail: '生成大纲失败', logline: '一句话', mainline: '主线', openHook: '开场钩子', endPay: '结局兑付',
      chars: '人物', want: '欲望', secret: '底牌', arc: '起承转合', isolation: '不侵权隔离',
      toProject: '确认，进入改编创作', copyOutline: '一键复制大纲', copied: '大纲已复制', outlineDone: (p) => `改编大纲已生成，消耗 ${p} 积分`,
      projLimit: '项目数已达当前会员上限，请升级或清理旧项目', projFail: '创建改编项目失败', projOk: '已为你创建改编项目，可在“我的作品”中继续生成完整剧本',
      reuse: '复用',
      history: '🕘 我的拆解记录', historyHide: '收起记录', histLoading: '记录加载中…', histEmpty: '还没有拆解记录，先拆一条爆款吧',
      histFail: '记录加载失败', histOpenFail: '打开记录失败', histResume: '点击恢复，继续改编',
      histState: { ANALYZED: '已拆解', OUTLINED: '已出大纲', TO_PROJECT: '已转项目' },
      histPoints: (p) => `耗 ${p} 积分`, histTags: (n) => `${n} 个标签`, histFallback: (wc) => `未命名拆解 · ${wc} 字`,
      srcName: { text: '文本', drama_url: '剧集链接', video_url: '视频链接' }, restored: '已恢复这条拆解记录',
    },
    en: {
      busy: 'Working…', analyzeFail: 'Teardown failed — check text length or point balance', done: (p) => `Teardown done, ${p} points used`,
      outlineFail: 'Failed to build outline', logline: 'Logline', mainline: 'Main line', openHook: 'Opening hook', endPay: 'Ending payoff',
      chars: 'Characters', want: 'Want', secret: 'Hidden card', arc: 'Setup / build / turn / resolve', isolation: 'Non-infringement isolation',
      toProject: 'Confirm & start adaptation', copyOutline: 'Copy outline', copied: 'Outline copied', outlineDone: (p) => `Adaptation outline ready, ${p} points used`,
      projLimit: 'Project limit reached for your tier — upgrade or remove old projects', projFail: 'Failed to create adaptation project', projOk: 'Adaptation project created — continue in “My Works”.',
      reuse: 'Reuse',
      history: '🕘 My teardowns', historyHide: 'Hide', histLoading: 'Loading records…', histEmpty: 'No teardowns yet — analyze a hit script first',
      histFail: 'Failed to load records', histOpenFail: 'Failed to open record', histResume: 'Click to resume adaptation',
      histState: { ANALYZED: 'Analyzed', OUTLINED: 'Outlined', TO_PROJECT: 'To project' },
      histPoints: (p) => `${p} pts`, histTags: (n) => `${n} tags`, histFallback: (wc) => `Untitled teardown · ${wc} chars`,
      srcName: { text: 'Text', drama_url: 'Drama URL', video_url: 'Video URL' }, restored: 'Teardown record restored',
    },
  };
  const T = () => (en() ? L.en : L.zh);
  // 内部账户（超管/副管理员）拆爆款 0 扣费，成功提示与历史徽标走免费口径
  const isStaff = () => !!(window.znIsStaff && window.znIsStaff());
  const freeDone = () => en() ? 'Teardown done — free for staff' : '拆解完成，内部账户免费';
  const freeOutline = () => en() ? 'Adaptation outline ready — free for staff' : '改编大纲已生成，内部账户免费';
  const freeHist = () => en() ? 'Staff free' : '内部免费';
  const toast = (msg) => { try { if (window.Xn && typeof window.Xn.toast === 'function') { window.Xn.toast(msg); return; } } catch { /* Xn 不可用时降级 */ } alert(msg); };
  const idemToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const failMsg = (e, fallback) => (e && e.code === 'AUTH_REQUIRED') ? '' : ((e && (e.message || e.error)) || fallback);
  const needLogin = (e) => { if (e && e.code === 'AUTH_REQUIRED') { window.dispatchEvent(new CustomEvent('zn-auth-required')); return true; } return false; };
  let state = { recordId: null, report: null, directions: [], picked: [], direction: 'swap_persona', lastOutline: null, restoreTags: null };
  async function raw(path, body) {
    const res = await window.Api.request(path, body ? { method: 'POST', body: JSON.stringify(body) } : {});
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }
  const btn = (id) => { const b = $(id); if (b) { b.disabled = true; b.dataset.t = b.textContent; b.textContent = T().busy; } return () => { if (b) { b.disabled = false; b.textContent = b.dataset.t; } }; };
  function openPanel() {
    const rp = $('roomPanel'); if (rp) rp.classList.add('hidden');
    $('teardownPanel').classList.remove('hidden');
    $('teardownPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderResult() {
    const r = state.report; const t = T();
    $('tdResult').classList.remove('hidden');
    $('tdBoom').innerHTML = r.boomReasons.map((x) => `<div class="td-line"><b>${esc(x.dim)}</b><span>${esc(x.conclusion)}</span></div>`).join('');
    $('tdTech').innerHTML = r.techniques.map((x, i) => `<div class="td-line"><b>${i + 1}. ${esc(x.point)}</b><span>${esc(x.why)}｜${t.reuse}：${esc(x.reuse)}</span></div>`).join('');
    // 新拆解默认全选；恢复历史记录时按当时 pickedTags 勾选（标签池始终以当前报告为准，旧标签已失效则自然过滤）
    const poolLabels = r.tagPool.map((x) => x.label);
    const wanted = state.restoreTags == null ? poolLabels : state.restoreTags.filter((x) => poolLabels.includes(x));
    state.picked = wanted;
    $('tdTags').innerHTML = r.tagPool.map((x) =>
      `<button type="button" class="chip td-tag ${wanted.includes(x.label) ? 'on' : ''}" data-tag="${esc(x.label)}">${esc(x.label)}<small>${esc(x.category)}</small></button>`).join('');
    document.querySelectorAll('.td-tag').forEach((c) => c.addEventListener('click', () => {
      c.classList.toggle('on');
      state.picked = Array.from(document.querySelectorAll('.td-tag.on')).map((x) => x.dataset.tag);
    }));
    // 方向恢复：历史 direction 若已不在候选中，回退第一个；新拆解保持默认 swap_persona
    const dirExists = state.directions.some((d) => d.id === state.direction);
    if (!dirExists && state.directions[0]) state.direction = state.directions[0].id;
    $('tdDirs').innerHTML = state.directions.map((d) =>
      `<label class="rmode ${d.id === state.direction ? 'on' : ''}"><span><input type="radio" name="tddir" value="${d.id}" ${d.id === state.direction ? 'checked' : ''}/><b>${esc(d.name)}</b></span><small>${esc(d.change)}</small></label>`).join('');
    document.querySelectorAll('input[name=tddir]').forEach((radio) => radio.addEventListener('change', () => {
      state.direction = radio.value;
      document.querySelectorAll('#tdDirs .rmode').forEach((m) => m.classList.remove('on'));
      radio.closest('.rmode').classList.add('on');
    }));
    $('tdOutlineBox').classList.add('hidden');
  }
  async function analyze() {
    const text = $('tdText').value.trim();
    const restore = btn('tdAnalyzeBtn');
    try {
      const r = await raw('/api/teardown/analyze', {
        text, sourceType: $('tdSource').value, sourceUrl: $('tdUrl').value.trim() || undefined, lang: en() ? 'en' : 'zh', clientToken: idemToken(),
      });
      if (!r.ok) { alert(r.data.message || r.data.error || T().analyzeFail); return; }
      state.recordId = r.data.recordId; state.report = r.data.report; state.directions = r.data.directions;
      state.direction = 'swap_persona'; state.restoreTags = null; state.lastOutline = null;
      renderResult();
      toast(r.data.staff ? freeDone() : T().done(r.data.points));
    } catch (e) {
      if (needLogin(e)) return; alert(failMsg(e, T().analyzeFail));
    } finally { restore(); }
  }
  function renderOutline(o) {
    const t = T();
    const box = $('tdOutlineBox');
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="td-outline">
        <p><b>${t.logline}：</b>${esc(o.logline)}</p>
        <p><b>${t.mainline}：</b>${esc(o.mainline)}</p>
        <p><b>${t.openHook}：</b>${esc(o.openingHook)}</p>
        <p><b>${t.endPay}：</b>${esc(o.endingPayoff)}</p>
        <div><b>${t.chars}：</b>${o.characters.map((c) => `<div class="td-line"><b>${esc(c.name)}（${esc(c.role)}）</b><span>${t.want}：${esc(c.want)}；${t.secret}：${esc(c.secret)}</span></div>`).join('')}</div>
        <div><b>${t.arc}：</b>${o.arc.map((a) => `<div class="td-line"><b>${esc(a.stage)}</b><span>${esc(a.goal)}</span></div>`).join('')}</div>
        <p class="muted">${t.isolation}：${esc(o.isolationNote)}</p>
        <div class="row-actions">
          <button class="btn-primary" id="tdToProject">${t.toProject}</button>
          <button class="btn-ghost" id="tdCopyOutline">${t.copyOutline}</button>
        </div>
      </div>`;
    $('tdToProject').addEventListener('click', toProject);
    $('tdCopyOutline').addEventListener('click', () => {
      navigator.clipboard?.writeText(box.innerText).then(() => toast(t.copied));
    });
  }
  async function outline() {
    if (!state.recordId) return;
    const restore = btn('tdOutlineBtn');
    try {
      const r = await raw(`/api/teardown/${state.recordId}/outline`, { pickedTags: state.picked, direction: state.direction, clientToken: idemToken() });
      if (!r.ok) { alert(r.data.message || r.data.error || T().outlineFail); return; }
      state.lastOutline = r.data.outline;
      renderOutline(state.lastOutline);
      toast(r.data.staff ? freeOutline() : T().outlineDone(r.data.points));
    } catch (e) {
      if (needLogin(e)) return; alert(failMsg(e, T().outlineFail));
    } finally { restore(); }
  }
  async function toProject() {
    const restore = btn('tdToProject');
    try {
      const r = await raw(`/api/teardown/${state.recordId}/to-project`, {});
      if (!r.ok) {
        if (r.data.error === 'REACH_PROJECT_LIMIT') { alert(r.data.message || T().projLimit); return; }
        alert(r.data.message || r.data.error || T().projFail); return;
      }
      alert(T().projOk);
    } catch (e) {
      if (needLogin(e)) return; alert(failMsg(e, T().projFail));
    } finally { restore(); }
  }
  /* ---------- c195 历史拆解记录：积分产物可追溯。
     /mine 仅摘要（无大 Json）→ 点击才取 /:id 完整报告/大纲；每次展开都新鲜拉取，不做本地缓存 ---------- */
  async function loadHistory() {
    const box = $('tdHistoryBox'); const t = T();
    box.classList.remove('hidden');
    box.innerHTML = `<p class="muted">${esc(t.histLoading)}</p>`;
    try {
      const r = await raw('/api/teardown/mine');
      if (!r.ok) { box.innerHTML = `<p class="muted">${esc(r.data.message || r.data.error || t.histFail)}</p>`; return; }
      const list = r.data.list || [];
      if (!list.length) { box.innerHTML = `<p class="muted">${esc(t.histEmpty)}</p>`; return; }
      const locale = en() ? 'en-GB' : 'zh-CN';
      box.innerHTML = list.map((x) => {
        const title = x.title || `${t.srcName[x.sourceType] || x.sourceType || ''} · ${t.histFallback(x.wordCount || 0)}`;
        const when = new Date(x.createdAt).toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `<button type="button" class="td-hist-card" data-id="${esc(x.id)}">
          <span class="td-hist-main"><b>${esc(title)}</b><small>${esc(when)} · ${esc(t.histState[x.state] || x.state)} · ${esc((x.pointsCost || 0) > 0 ? t.histPoints(x.pointsCost || 0) : (isStaff() ? freeHist() : t.histPoints(0)))} · ${esc(t.histTags((x.pickedTags || []).length))}</small></span>
          <span class="td-hist-go">${esc(t.histResume)}</span>
        </button>`;
      }).join('');
      box.querySelectorAll('.td-hist-card').forEach((c) => c.addEventListener('click', () => openRecord(c.dataset.id)));
    } catch (e) {
      if (needLogin(e)) { box.classList.add('hidden'); return; }
      box.innerHTML = `<p class="muted">${esc(t.histFail)}</p>`;
    }
  }
  async function openRecord(id) {
    const t = T();
    try {
      const r = await raw(`/api/teardown/${id}`);
      if (!r.ok) { alert(r.data.message || r.data.error || t.histOpenFail); return; }
      const rec = r.data;
      if (!rec.report) { alert(t.histOpenFail); return; }
      state.recordId = rec.id; state.report = rec.report; state.directions = rec.directions || [];
      state.restoreTags = rec.pickedTags || []; state.direction = rec.direction || 'swap_persona';
      state.lastOutline = rec.outline || null;
      renderResult();
      if (state.lastOutline) renderOutline(state.lastOutline);
      $('tdHistoryBox').classList.add('hidden');
      $('tdResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(t.restored);
    } catch (e) {
      if (needLogin(e)) return; alert(failMsg(e, t.histOpenFail));
    }
  }
  function toggleHistory() {
    const box = $('tdHistoryBox');
    if (box.classList.contains('hidden')) loadHistory();
    else { box.classList.add('hidden'); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('toolTeardown')?.addEventListener('click', openPanel);
    $('teardownClose')?.addEventListener('click', () => $('teardownPanel').classList.add('hidden'));
    $('tdAnalyzeBtn')?.addEventListener('click', analyze);
    $('tdOutlineBtn')?.addEventListener('click', outline);
    $('tdHistoryBtn')?.addEventListener('click', toggleHistory);
    document.addEventListener('zn-lang', () => {
      if (state.report) renderResult();
      if (state.lastOutline) renderOutline(state.lastOutline);
      if (!$('tdHistoryBox').classList.contains('hidden')) loadHistory();
    });
    window.TeardownView = { openPanel };
  });
})();
