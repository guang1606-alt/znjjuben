/* 编剧室：选题会 + 剧本围读（创作工具箱）。自包含，复用全局 Api 鉴权层。中英双语。 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const en = () => ((window.znLang ? window.znLang() : (localStorage.getItem('zn_lang') || 'zh')) === 'en');
  const L = {
    zh: {
      modes: [
        { id: 'me_xn', name: '我+我的小南', desc: '小南分饰多立场陪我围读' },
        { id: 'user_user', name: '用户+用户', desc: '邀请码拉真人异步讨论' },
        { id: 'me_other_xn', name: '我+别人的小南', desc: '对方派其小南一起提意见' },
        { id: 'xn_xn', name: '小南+小南', desc: '多立场小南自动围读、无人值守' },
      ],
      needLogin: '请先登录后再使用编剧室', authExpire: '登录已过期，请重新登录', opFail: '操作失败，请重试',
      me: '我', xn: '小南', needIdea: '先写一句创意', openPitchFirst: '请先开始选题会',
      needScript: '先粘贴需要围读的剧本文本', needRoom: '请先建立或加入围读室', needRoom2: '请先建立围读室',
      roomInfo: (mode, code) => `围读室已建立｜模式：<b>${mode}</b>｜邀请码：<b class="copyable">${code}</b>（可复制分享给协作者）`,
      decision: '决议', logline: '一句话卖点', epsSug: '建议集数', epsUnit: '集', capEps: '冲突容量约', audience: '受众', medium: '载体', difficulty: '制作难度',
      scores: '评分', sMarket: '市场', sStory: '故事', sFeas: '可行', sNov: '新颖', total: '综合', risk: '风险', noRisk: '无明显硬伤',
      next: '下一步', copyCard: '复制选题卡',
      rhythm: '节奏', deAi: '去AI', grounded: '落地', overall: '综合', sceneCost: '场景成本等级',
      histLoading: '记录加载中…', histEmpty: '还没有编剧室记录', histFail: '记录加载失败', histOpenFail: '打开记录失败',
      histResume: '点击进入，继续讨论', histKind: { PITCH: '选题会', READ: '剧本围读' },
      histState: { OPEN: '待开始', ACTIVE: '进行中', DECIDED: '已决议', CLOSED: '已关闭' },
      histPoints: (p) => `每次 ${p} 积分`, restored: '已恢复这个编剧室',
      roleOwner: '房主', roleMember: '参与',
      redecideConfirm: '本房已形成决议。重新决议将再次扣除 20 积分，确定继续吗？',
      debates: '立场交锋', debateVerdict: '主持裁决',
      toProject: '带着决议去立项', copyFixList: '复制修改清单',
      discTitle: '真人讨论', discAdopted: '已采纳', discNewFlag: '新增关注',
      fixListTitle: '修改清单',
      readAgainConfirm: '本房已出过一份围读结论。重新围读将再次扣除 30 积分，确定继续吗？',
      copied: '已复制',
      toRewrite: '带着修改意见去改写', toRewriteGuest: '仅房主可带去改写',
      toRewriteGuestHint: '围读的是房主的项目分集，只有项目主人能把意见带去定点改写',
      toRewriteFail: '改写入口加载失败，仍可复制修改清单带走',
      // c202 F3：围读来源选择器（作品分集 / 手贴文本二选一，选分集走 scriptId 零粘贴）
      pickLbl: '围读剧本来源（二选一）',
      pickBtn: '从我的作品选一集',
      pickProjectPh: '选择作品',
      pickEpPh: '选择分集（自动取每集最新版）',
      pickLoading: '作品列表加载中…',
      pickEmptyWorks: '还没有作品，先去创作台生成',
      pickEmptyEps: '该作品还没有成稿分集',
      pickFail: '作品列表加载失败，请稍后重试',
      pickedBar: (label) => `已选择作品分集：<b>${label}</b>。围读将读取该版本全文；在下方文本框中输入会切回粘贴模式。`,
      pickedClear: '清除选择',
      pickedHint: '选择作品与分集后，点“建立围读室”即可，无需粘贴全文。',
      rereadNote: '已带入最新版分集。建立围读室免费；点“开始AI围读”才扣 30 积分。',
    },
    en: {
      modes: [
        { id: 'me_xn', name: 'Me + my Xiaonan', desc: 'Xiaonan reads from multiple stances with you' },
        { id: 'user_user', name: 'User + User', desc: 'Invite code for async live discussion' },
        { id: 'me_other_xn', name: 'Me + their Xiaonan', desc: 'Their Xiaonan joins to give notes' },
        { id: 'xn_xn', name: 'Xiaonan + Xiaonan', desc: 'Multi-stance autonomous table read' },
      ],
      needLogin: 'Sign in to use the writers’ room', authExpire: 'Session expired, please sign in again', opFail: 'Action failed, please retry',
      me: 'Me', xn: 'Xiaonan', needIdea: 'Write a one-line idea first', openPitchFirst: 'Start a pitch meeting first',
      needScript: 'Paste the script text to table-read first', needRoom: 'Create or join a read room first', needRoom2: 'Create a read room first',
      roomInfo: (mode, code) => `Read room ready | Mode: <b>${mode}</b> | Invite code: <b class="copyable">${code}</b> (copy to share with collaborators)`,
      decision: 'Verdict', logline: 'Logline', epsSug: 'Suggested episodes', epsUnit: ' eps', capEps: 'Conflict capacity ~', audience: 'Audience', medium: 'Medium', difficulty: 'Production difficulty',
      scores: 'Scores', sMarket: 'Market', sStory: 'Story', sFeas: 'Feasibility', sNov: 'Novelty', total: 'Overall', risk: 'Risks', noRisk: 'No obvious flaw',
      next: 'Next step', copyCard: 'Copy pitch card',
      rhythm: 'Rhythm', deAi: 'De-AI', grounded: 'Grounded', overall: 'Overall', sceneCost: 'Scene-cost level',
      histLoading: 'Loading records…', histEmpty: 'No writers’ room yet', histFail: 'Failed to load records', histOpenFail: 'Failed to open record',
      histResume: 'Click to resume the discussion', histKind: { PITCH: 'Pitch Meeting', READ: 'Table Read' },
      histState: { OPEN: 'Not started', ACTIVE: 'In progress', DECIDED: 'Verdict given', CLOSED: 'Closed' },
      histPoints: (p) => `${p} pts / turn`, restored: 'Room restored',
      roleOwner: 'Owner', roleMember: 'Member',
      redecideConfirm: 'This room already has a verdict. Forming a new verdict costs 20 points again. Continue?',
      debates: 'Seat debates', debateVerdict: 'Host verdict',
      toProject: 'Turn verdict into a project', copyFixList: 'Copy fix list',
      discTitle: 'Live discussion', discAdopted: 'converged', discNewFlag: 'new flag',
      fixListTitle: 'Fix list',
      readAgainConfirm: 'A read conclusion already exists for this room. Running the read again costs another 30 points. Continue?',
      copied: 'Copied',
      toRewrite: 'Carry fix notes to rewrite', toRewriteGuest: 'Owner only',
      toRewriteGuestHint: 'This reads the owner’s episode; only the project owner can carry the notes into a targeted rewrite.',
      toRewriteFail: 'Could not load the rewrite entry — you can still copy the fix list',
      // c202 F3
      pickLbl: 'Script source (either one)',
      pickBtn: 'Choose one of my episodes',
      pickProjectPh: 'Select a work',
      pickEpPh: 'Select an episode (latest version auto-used)',
      pickLoading: 'Loading your works…',
      pickEmptyWorks: 'No works yet — create one in the studio',
      pickEmptyEps: 'This work has no finished episodes',
      pickFail: 'Could not load your works. Try again later.',
      pickedBar: (label) => `Linked episode: <b>${label}</b>. The read uses that version’s full text; typing in the box switches back to paste mode.`,
      pickedClear: 'Clear',
      pickedHint: 'Pick a work and an episode, then create the room — no pasting needed.',
      rereadNote: 'Latest episode loaded. Opening a room is free; “Start AI read” costs 30 pts.',
    },
  };
  const T = () => (en() ? L.en : L.zh);
  const idemToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  // c199：非安全上下文（http 非 localhost）navigator.clipboard 不存在，?. 静默失败用户无感知；
  // 统一走 Clipboard API + execCommand 兜底，并在触发按钮上给“已复制”瞬时反馈。
  function copyText(text, btn) {
    const flash = () => {
      if (!btn) return;
      const old = btn.textContent;
      btn.textContent = T().copied; btn.disabled = true;
      setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1200);
    };
    const legacy = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) { /* 老浏览器也失败时无降级可做 */ }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(() => { legacy(); flash(); });
    } else { legacy(); flash(); }
  }
  const READ_MODES = () => T().modes;
  const state = { pitchRoom: null, readRoom: null, readMode: 'me_xn', roomId: null, lastVerdict: null, lastRead: null, lastRoomMeta: null, historyOpen: false, histRooms: [], rewriteSeq: 0,
    // c202：选中的作品分集 {scriptId,label,note?}；存在时 readOpen 走 scriptId（后端再做归属校验），不读文本框
    pickedScript: null, pickProjects: [], pickLoaded: false };
  async function post(path, body) {
    const res = await window.Api.request(path, { method: 'POST', body: JSON.stringify(body || {}) });
    return window.Api.jsonOrThrow(res);
  }
  async function get(path) {
    const res = await window.Api.request(path);
    return window.Api.jsonOrThrow(res);
  }
  function needAuth() {
    if (!window.Api.isAuthed()) { window.Xn.toast(T().needLogin); return false; }
    return true;
  }
  function errMsg(e) {
    if (e && e.code === 'AUTH_REQUIRED') return T().authExpire;
    return (e && e.message) || T().opFail;
  }
  // —— 面板与 Tab ——
  function openPanel(tab) {
    $('roomPanel').classList.remove('hidden');
    switchTab(tab || 'pitch');
    $('roomPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function switchTab(tab) {
    document.querySelectorAll('.room-tab').forEach((b) => b.classList.toggle('on', b.dataset.rtab === tab));
    $('rtab-pitch').classList.toggle('hidden', tab !== 'pitch');
    $('rtab-read').classList.toggle('hidden', tab !== 'read');
  }
  // —— 消息流渲染 ——
  function stream(elId, msgs) {
    const el = $(elId); const t = T();
    el.innerHTML = msgs.map((m) => {
      const mine = m.speakerType === 'USER';
      const name = esc(m.speakerName || (mine ? t.me : t.xn));
      return `<div class="rm ${mine ? 'rm-me' : 'rm-xn'}"><div class="rm-who">${name}${m.seat && !mine ? ` · ${esc(m.seat)}` : ''}</div><div class="rm-bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }
  async function refreshPitch() {
    if (!state.pitchRoom) return;
    const j = await get(`/api/room/${state.pitchRoom}/messages`);
    stream('pitchStream', j.messages);
  }
  function renderReadInfo(r) {
    const t = T();
    const mode = (READ_MODES().find((m) => m.id === r.readMode) || {}).name || r.readMode;
    $('readRoomInfo').classList.remove('hidden');
    $('readRoomInfo').innerHTML = t.roomInfo(esc(mode), esc(r.inviteCode));
  }
  async function refreshRead() {
    if (!state.readRoom) return;
    const j = await get(`/api/room/${state.readRoom}/messages`);
    stream('readStream', j.messages);
    state.lastRoomMeta = j.room;
    renderReadInfo(j.room);
    $('readStream').classList.remove('hidden');
    $('readMore').classList.remove('hidden');
  }
  // —— 选题会 ——
  async function pitchOpen() {
    if (!needAuth()) return;
    const idea = $('pitchIdea').value.trim();
    if (idea.length < 2) { window.Xn.toast(T().needIdea); return; }
    const btn = $('pitchOpenBtn'); btn.disabled = true;
    try {
      const j = await post('/api/room/pitch/open', { idea, audience: $('pitchAud').value.trim() || undefined, medium: $('pitchMed').value.trim() || undefined, lang: en() ? 'en' : 'zh', clientToken: idemToken() });
      state.pitchRoom = j.roomId;
      $('pitchMore').classList.remove('hidden');
      await refreshPitch();
    } catch (e) { window.Xn.toast(errMsg(e)); } finally { btn.disabled = false; }
  }
  async function pitchSay() {
    if (!state.pitchRoom) { window.Xn.toast(T().openPitchFirst); return; }
    const content = $('pitchSay').value.trim();
    if (!content) return;
    try {
      await post(`/api/room/pitch/${state.pitchRoom}/speak`, { content, clientToken: idemToken() });
      $('pitchSay').value = ''; await refreshPitch();
    } catch (e) { window.Xn.toast(errMsg(e)); }
  }
  function renderVerdict(v) {
    const t = T();
    const color = v.decision === 'GO' ? '#4caf85' : v.decision === 'NO' ? '#e06666' : '#e0a13c';
    $('pitchVerdict').classList.remove('hidden');
    // c199：决议卡分隔标点随语言（EN 下全角：｜（）； 是中文排版残留）
    const c = en() ? ': ' : '：';
    const p = en() ? ' | ' : '｜';
    const lp = en() ? '(' : '（'; const rp = en() ? ')' : '）';
    const sc = en() ? '; ' : '；';
    $('pitchVerdict').innerHTML =
      `<div style="color:${color};font-weight:700;font-size:16px">${t.decision}${c}${esc(v.decisionText)}</div>
       <div>${t.logline}${c}${esc(v.logline)}</div>
       <div>${t.epsSug}${c}${v.episodes}${t.epsUnit}${p}${t.capEps}${v.capacityEpisodes || '—'}${t.epsUnit}${p}${t.audience}${c}${esc(v.audience)}${p}${t.medium}${c}${esc(v.medium)}${p}${t.difficulty}${c}${v.difficulty}</div>
       <div>${t.scores}${c}${t.sMarket}${v.scores.market} ${t.sStory}${v.scores.story} ${t.sFeas}${v.scores.feasibility} ${t.sNov}${v.scores.novelty} ${lp}${t.total}<b>${v.scores.total}</b>${rp}</div>
       <div>${t.risk}${c}${esc((v.risks.length ? v.risks : [t.noRisk]).join(sc))}</div>
       <div>${t.next}${c}${esc(v.fixes.join(sc))}</div>
       <div class="row-actions" style="margin-top:8px">${v.decision === 'GO' ? `<button class="btn-primary" id="pitchToProject">${t.toProject}</button>` : ''}<button class="btn-ghost" id="copyVerdict">${t.copyCard}</button></div>`;
    $('copyVerdict').onclick = (ev) => copyText($('pitchVerdict').innerText, ev.currentTarget);
    // c198：GO 决议必须有下游出口——把卖点与集数带到创作台标签立项（仅预填，不自动扣费生成）；
    // HOLD/NO 不显示：修改方向未定，带去立项只会产生垃圾项目。跨模块只走 window CustomEvent。
    if (v.decision === 'GO' && $('pitchToProject')) {
      $('pitchToProject').onclick = () => window.dispatchEvent(new CustomEvent('zn-pitch-to-project', {
        detail: { logline: v.logline || '', episodes: Number(v.episodes) || 0 },
      }));
    }
  }
  async function pitchDecide() {
    if (!state.pitchRoom) { window.Xn.toast(T().openPitchFirst); return; }
    // c197：恢复已决议房后按钮仍在；每次点击都带新幂等令牌、服务端必扣 20 积分，故必须有状态感知的二次确认防误触
    // 内部账户（超管/副管理员）重新决议 0 扣费，确认语不展示积分数
    // v2.206 confirm→uiConfirm（pitchDecide 本就 async，签名不变）
    if (state.lastVerdict && !(await window.uiConfirm({
      body: window.znIsStaff && window.znIsStaff()
        ? (en() ? 'This room already has a verdict. Re-deciding is free for staff. Continue?' : '本房已形成决议。内部账户重新决议免费，确定继续吗？')
        : T().redecideConfirm,
    }))) return;
    try {
      const j = await post(`/api/room/pitch/${state.pitchRoom}/decide`, {
        relation: $('pitchRel').value.trim(), conflict: $('pitchConf').value.trim(),
        scenes: $('pitchScene').value.trim(), episodes: Number($('pitchEps').value) || undefined,
        clientToken: idemToken(),
      });
      state.lastVerdict = j.verdict;
      renderVerdict(j.verdict);
      await refreshPitch();
    } catch (e) { window.Xn.toast(errMsg(e)); }
  }
  // —— 围读 ——
  function renderReadModes(selectedId) {
    // 无参时保留 state.readMode（语言切换/历史恢复不丢选中态，c196 预选）
    const sel = selectedId || state.readMode || READ_MODES()[0].id;
    state.readMode = sel;
    $('readModePick').innerHTML = READ_MODES().map((m) =>
      `<label class="rmode ${m.id === sel ? 'on' : ''}"><input type="radio" name="readmode" value="${m.id}" ${m.id === sel ? 'checked' : ''}/><b>${m.name}</b><small>${m.desc}</small></label>`).join('');
    document.querySelectorAll('#readModePick input').forEach((r) => r.onchange = () => {
      state.readMode = r.value;
      document.querySelectorAll('#readModePick .rmode').forEach((l) => l.classList.toggle('on', l.querySelector('input').value === state.readMode));
    });
  }
  // c202 F3：作品分集选择器。选分集后以 scriptId 开房（/read/open 二选一，服务端有 IDOR 归属校验），
  // 用户不必从作品库复制全文再粘贴；文本框路径完全保留，二者互斥。
  function renderPickedBar() {
    const bar = $('readPickedBar');
    if (!bar) return;
    const p = state.pickedScript;
    if (!p) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
    bar.innerHTML = T().pickedBar(esc(p.label || ''))
      + ` <a href="javascript:void(0)" id="readPickedClear" style="margin-left:8px;text-decoration:underline">${esc(T().pickedClear)}</a>`
      + (p.note ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(p.note)}</div>` : '');
    bar.style.display = 'block';
    const clr = $('readPickedClear');
    if (clr) clr.onclick = () => clearPicked();
  }
  function clearPicked() {
    state.pickedScript = null;
    // c203 D2：开房成功/手动清除后，两个 select 仍显示旧选择，用户看着“已选”直接点开会误走粘贴路径报 needScript。
    // 状态与显示必须一起复位（程序赋值不触发 onchange，不会回灌本函数）。
    const projSel = $('readPickProject');
    const epSel = $('readPickEp');
    if (projSel) projSel.value = '';
    if (epSel) { epSel.style.display = 'none'; epSel.innerHTML = ''; }
    renderPickedBar();
  }
  function applyPickLabels() {
    if (!$('readPickField')) return;
    const t = T();
    $('readPickLbl').textContent = t.pickLbl;
    $('readPickBtn').textContent = t.pickBtn;
    $('readPickHint').textContent = t.pickedHint;
    renderPickedBar();
  }
  async function fillPickProjects() {
    const t = T();
    const projSel = $('readPickProject');
    const epSel = $('readPickEp');
    const hint = $('readPickHint');
    projSel.innerHTML = `<option value="">${esc(t.pickLoading)}</option>`;
    try {
      const list = await get('/api/generate/projects');
      state.pickProjects = Array.isArray(list) ? list : [];
      state.pickLoaded = true;
      if (!state.pickProjects.length) {
        projSel.innerHTML = `<option value="">${esc(t.pickEmptyWorks)}</option>`;
        epSel.style.display = 'none';
        return;
      }
      projSel.innerHTML = `<option value="">${esc(t.pickProjectPh)}</option>`
        + state.pickProjects.map((p) => `<option value="${esc(p.id)}">${esc(p.title || p.id)}</option>`).join('');
    } catch (e) {
      projSel.innerHTML = `<option value="">${esc(t.pickFail)}</option>`;
    }
  }
  async function onPickProjectChange() {
    const t = T();
    const pid = $('readPickProject').value;
    const epSel = $('readPickEp');
    // c203 D3(前端)：换项目即作废旧选择——否则选过 A 项目某集后改选 B 项目但未选分集，
    // readOpen 仍拿 A 的 scriptId 开房（名实不符）。只清状态条，select 保留用户刚选的新项目。
    if (state.pickedScript) { state.pickedScript = null; renderPickedBar(); }
    if (!pid) { epSel.style.display = 'none'; epSel.innerHTML = ''; return; }
    epSel.style.display = 'block';
    epSel.innerHTML = `<option value="">${esc(t.pickLoading)}</option>`;
    try {
      const rows = await get(`/api/generate/projects/${encodeURIComponent(pid)}/scripts`);
      // 每集只取最新版（行按 epNo,version 升序，后者覆盖），绝不拿旧版开房
      const latest = new Map();
      (Array.isArray(rows) ? rows : []).forEach((s) => latest.set(s.epNo, s));
      const eps = [...latest.values()].sort((a, b) => a.epNo - b.epNo);
      if (!eps.length) { epSel.innerHTML = `<option value="">${esc(t.pickEmptyEps)}</option>`; return; }
      const proj = state.pickProjects.find((p) => p.id === pid);
      const pTitle = (proj && proj.title) || '';
      epSel.innerHTML = `<option value="">${esc(t.pickEpPh)}</option>`
        + eps.map((s) => `<option value="${esc(s.id)}" data-pid="${esc(pid)}" data-ep="${s.epNo}" data-ver="${s.version}">EP${s.epNo} · ${esc(s.title || '')} · v${s.version}</option>`).join('');
      epSel.onchange = () => {
        const opt = epSel.selectedOptions && epSel.selectedOptions[0];
        if (!opt || !opt.value) return;
        state.pickedScript = {
          scriptId: opt.value,
          label: `${pTitle ? pTitle + ' · ' : ''}EP${opt.dataset.ep} v${opt.dataset.ver}`,
        };
        renderPickedBar();
        $('readPickPanel').style.display = 'none';
      };
    } catch (e) {
      epSel.innerHTML = `<option value="">${esc(t.pickFail)}</option>`;
    }
  }
  function setupReadPicker() {
    const anchor = $('readScript') && $('readScript').closest('.field');
    if (!anchor || anchor.parentNode.querySelector('#readPickField')) return;
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.id = 'readPickField';
    wrap.innerHTML = `<label id="readPickLbl"></label>
      <div class="row-actions"><button type="button" class="btn-ghost" id="readPickBtn"></button></div>
      <div class="notice" id="readPickedBar" style="display:none"></div>
      <div class="diag-panel" id="readPickPanel" style="display:none;margin-top:8px">
        <select id="readPickProject" style="width:100%;margin-bottom:6px"></select>
        <select id="readPickEp" style="width:100%;display:none"></select>
        <div class="muted" id="readPickHint" style="font-size:12px"></div>
      </div>`;
    anchor.parentNode.insertBefore(wrap, anchor);
    applyPickLabels();
    $('readPickBtn').onclick = () => {
      if (!needAuth()) return;
      const panel = $('readPickPanel');
      const show = panel.style.display === 'none';
      panel.style.display = show ? 'block' : 'none';
      if (show && !state.pickLoaded) fillPickProjects();
    };
    $('readPickProject').onchange = onPickProjectChange;
    // 在文本框内输入即视为走粘贴路径，自动取消分集选择（互斥关系不能静默）
    $('readScript').addEventListener('input', () => { if (state.pickedScript) clearPicked(); });
  }
  // c202 F3：作品页漂移条 → 编剧室，用最新版 scriptId 预填。仅预填、不开房、不扣费。
  function prefillScript(pick) {
    if (!pick || !pick.scriptId) return;
    if (!$('readPickedBar')) setupReadPicker(); // 防御：极端情况下事件早于 DOMContentLoaded
    openPanel('read');
    state.pickedScript = {
      scriptId: pick.scriptId,
      label: pick.label || (pick.epNo ? `EP${pick.epNo}${pick.version ? ' v' + pick.version : ''}` : ''),
      note: (window.znIsStaff && window.znIsStaff())
        ? (en() ? 'Latest episode loaded. Opening a room and AI reads are free for staff.' : '已带入最新版分集。内部账户建立围读室与 AI 围读均免费。')
        : T().rereadNote,
    };
    if (pick.format === 'AIGC' || pick.scriptMode === 'AIGC') $('readFormat').value = 'AIGC';
    else if (pick.format === 'LIVE' || pick.scriptMode === 'LIVE') $('readFormat').value = 'LIVE';
    renderPickedBar();
  }
  window.addEventListener('zn-reread-latest', (ev) => {
    const d = (ev && ev.detail) || {};
    if (!d.scriptId) return;
    if (!needAuth()) return;
    prefillScript(d);
  });

  async function readOpen() {
    if (!needAuth()) return;
    const picked = state.pickedScript;
    const text = $('readScript').value.trim();
    if (!picked && text.length < 10) { window.Xn.toast(T().needScript); return; }
    try {
      const payload = { readMode: state.readMode, mode: $('readFormat').value, lang: en() ? 'en' : 'zh', clientToken: idemToken() };
      if (picked) payload.scriptId = picked.scriptId; // 选了作品分集：全文由后端按 id 取，不信客户端文本
      else payload.scriptText = text;
      const j = await post('/api/room/read/open', payload);
      state.readRoom = j.roomId;
      clearPicked();
      await refreshRead();
      if (state.readMode === 'xn_xn') readAi(); // 小南+小南：建室即自动围读（首次围读 30 积分由模式描述与既有确认链承担）
    } catch (e) { window.Xn.toast(errMsg(e)); }
  }
  async function readJoin() {
    if (!needAuth()) return;
    const code = $('readJoinCode').value.trim();
    if (!code) return;
    try { const j = await post('/api/room/read/join', { inviteCode: code }); state.readRoom = j.roomId; await refreshRead(); }
    catch (e) { window.Xn.toast(errMsg(e)); }
  }
  async function readSay() {
    if (!state.readRoom) { window.Xn.toast(T().needRoom); return; }
    const content = $('readSay').value.trim();
    if (!content) return;
    try { await post(`/api/room/read/${state.readRoom}/speak`, { content, clientToken: idemToken() }); $('readSay').value = ''; await refreshRead(); }
    catch (e) { window.Xn.toast(errMsg(e)); }
  }
  function renderReadActions(r) {
    const t = T();
    $('readActions').classList.remove('hidden');
    // c197：xn_xn 模式承诺“多立场小南互相辩论”，交锋纪要必须在结论里可见（无 debates 时不渲染区块）
    // c199：分隔标点随语言切换（EN 下全角｜： 是中文排版残留）
    const pipe = en() ? ' | ' : '｜';
    const colon = en() ? ': ' : '：';
    const debateHtml = (Array.isArray(r.debates) && r.debates.length)
      ? `<div style="margin-top:8px"><b>${t.debates}</b>${r.debates.map((d) => `<div style="border-left:3px solid #c9a86a;padding:4px 0 4px 8px;margin:6px 0">
          <div style="font-weight:600">${esc(d.fromSeatName)} → ${esc(d.toSeatName)}${pipe}${esc(d.topic)}</div>
          <div>${esc(d.challenge)}</div>
          <div style="color:#8a6d3b">${esc(d.toSeatName)}${colon}${esc(d.reply)}</div>
          <div style="color:#4caf85">${t.debateVerdict}${colon}${esc(d.verdict)}</div></div>`).join('')}</div>`
      : '';
    // c198：真人讨论必须在结论里可见可带走。老 payload.lastRead 无 discussionPoints 字段，必须 Array.isArray 兜底。
    const dp = Array.isArray(r.discussionPoints) ? r.discussionPoints : [];
    const discussionHtml = dp.length
      ? `<div style="margin-top:8px"><b>${t.discTitle}</b>${dp.map((p) => `<div style="border-left:3px solid #5b8def;padding:2px 0 2px 8px;margin:4px 0">
          <span style="font-weight:600">${esc(p.seatName)}</span>
          <span style="margin-left:6px;padding:0 6px;border-radius:8px;font-size:12px;color:#fff;background:${p.adopted ? '#4caf85' : '#e0a13c'}">${p.adopted ? t.discAdopted : t.discNewFlag}</span>
          <div>${esc(p.point)}</div></div>`).join('')}</div>`
      : '';
    const semi = en() ? '; ' : '；';
    const levelLabel = en() ? `"${r.sceneCost.level}"` : `「${r.sceneCost.level}」`;
    $('readActions').innerHTML =
      `<b>${esc(r.summary)}</b><br>${t.rhythm}${r.scores.rhythm}${pipe}${t.deAi}${r.scores.deAi}${pipe}${t.grounded}${r.scores.grounded}${pipe}${t.overall}${r.scores.overall}${semi}${t.sceneCost} ${levelLabel}<ol style="margin:6px 0 0 18px">${r.actionItems.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>${debateHtml}${discussionHtml}
       <div class="row-actions" style="margin-top:8px"><button class="btn-ghost" id="copyFixList">${t.copyFixList}</button></div>`;
    $('copyFixList').onclick = (ev) => {
      // 复制内容 = 修改清单 + 真人讨论去向，保证讨论产物能离开协作工具被下游（改稿/立项）消费
      const lines = [wrapTitle(t.fixListTitle), ...(r.actionItems || []).map((a, i) => `${i + 1}. ${a}`)];
      if (dp.length) {
        lines.push(wrapTitle(t.discTitle));
        lines.push(...dp.map((p) => `- [${p.seatName}] ${p.adopted ? t.discAdopted : t.discNewFlag}${colon}${p.point}`));
      }
      copyText(lines.join('\n'), ev.currentTarget);
    };
    function wrapTitle(s) { return en() ? s : `【${s}】`; }
    // c200：围读结论 → 定点改写一键出口（只读拉包，零扣费；预展示不自动生成）。
    // 粘贴房 linked=false 不出按钮（只保留复制）；参与者 mine=false 按钮置灰，避免点了才在 /fix 撞 403。
    loadRewritePack();
  }
  async function loadRewritePack() {
    if (!state.readRoom) return;
    const seq = ++state.rewriteSeq;
    let pack;
    try {
      pack = await get(`/api/room/read/${state.readRoom}/rewrite-pack`);
    } catch (e) { return; } // 增强出口失败不堵结论：复制修改清单仍可用（不弹错误窗打扰）
    if (seq !== state.rewriteSeq) return; // 切房/重跑后的过期响应不得覆盖新按钮
    const row = $('readActions') && $('readActions').querySelector('.row-actions');
    if (!row) return;
    const old = row.querySelector('#toRewriteBtn, #toRewriteGuest');
    if (old) old.remove();
    // c201：即使没有机器改写包、只有真人讨论点，房主也应能把讨论带到作品页（D1：讨论要能带走）
    if (!pack || !pack.linked || !pack.ready || (!(pack.packs || []).length && !(pack.discussionPoints || []).length)) return;
    const btn = document.createElement('button');
    btn.style.marginLeft = '8px';
    if (pack.mine) {
      btn.className = 'btn-primary'; btn.id = 'toRewriteBtn'; btn.textContent = T().toRewrite;
      // c202：点击时重新拉取零费只读包——围读期间该集可能已在别处产生新版，
      // 版本漂移/latestScriptId 必须是点击时刻的事实，不能用面板渲染时缓存的旧包。
      btn.onclick = async () => {
        let fresh = pack;
        try { fresh = await get(`/api/room/read/${state.readRoom}/rewrite-pack`); } catch (e) { fresh = pack; }
        window.dispatchEvent(new CustomEvent('zn-read-to-rewrite', { detail: fresh }));
      };
    } else {
      btn.className = 'btn-ghost'; btn.id = 'toRewriteGuest';
      btn.textContent = T().toRewriteGuest; btn.disabled = true;
      btn.title = T().toRewriteGuestHint;
    }
    row.appendChild(btn);
  }
  async function readAi() {
    if (!state.readRoom) { window.Xn.toast(T().needRoom2); return; }
    // c199：与 c197 决议二次确认同族——恢复历史房或重跑时结论已存在，再点按钮是一次新的 30 积分扣费，
    // 必须状态感知地明示；首次围读（含 xn_xn 建室自动触发）state.lastRead 为空，不打扰。
    // 内部账户 AI 围读 0 扣费，确认语不展示积分数
    // v2.206 confirm→uiConfirm（readAi 本就 async，签名不变）
    if (state.lastRead && !(await window.uiConfirm({
      body: window.znIsStaff && window.znIsStaff()
        ? (en() ? 'This room already has a read result. Another AI read is free for staff. Continue?' : '本房已出过一份围读结论。内部账户重新围读免费，确定继续吗？')
        : T().readAgainConfirm,
    }))) return;
    const btn = $('readAiBtn'); btn.disabled = true;
    try {
      const j = await post(`/api/room/read/${state.readRoom}/ai-read`, { mode: $('readFormat').value, clientToken: idemToken() });
      state.lastRead = j.result;
      renderReadActions(j.result);
      await refreshRead();
    } catch (e) { window.Xn.toast(errMsg(e)); } finally { btn.disabled = false; }
  }
  // —— c196 我的编剧室历史：每次打开新鲜拉取；点击恢复消息流 + 决议/围读结论，可继续发言 ——
  function modeName(modeId) {
    return (READ_MODES().find((m) => m.id === modeId) || {}).name || modeId;
  }
  function renderHistory() {
    const t = T(); const box = $('roomHistoryBox');
    const list = state.histRooms;
    if (!list.length) { box.innerHTML = znEmptyHtml(t.histEmpty); return; }
    box.innerHTML = list.map((r) => {
      const when = new Date(r.updatedAt).toLocaleString(en() ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const extras = [
        r.kind === 'READ' && r.readMode ? modeName(r.readMode) : '',
        r.pointsCost > 0 ? t.histPoints(r.pointsCost) : (window.znIsStaff && window.znIsStaff() ? (en() ? 'Staff free' : '内部免费') : ''),
      ].filter(Boolean).join('｜');
      // c197：参与房与自己的房同列表展示，用角色徽标区分（老缓存无 role 字段时不显示）
      const badge = r.role === 'member'
        ? `<span style="display:inline-block;font-size:11px;line-height:16px;padding:0 6px;border-radius:8px;margin-right:6px;background:#e3edf0;color:#3a6a78">${t.roleMember}</span>`
        : r.role === 'owner'
          ? `<span style="display:inline-block;font-size:11px;line-height:16px;padding:0 6px;border-radius:8px;margin-right:6px;background:#efe7d6;color:#7a5c2e">${t.roleOwner}</span>`
          : '';
      return `<div class="td-hist-card" data-rid="${esc(r.id)}">
        <div class="td-hist-main">
          <b>${badge}${esc(t.histKind[r.kind] || r.kind)} · ${esc(r.title || '—')} · ${esc(t.histState[r.state] || r.state)}</b>
          <small>${esc(when)}｜${esc(r.inviteCode || '')}${extras ? '｜' + esc(extras) : ''}｜${t.histResume}</small>
        </div>
        <span class="td-hist-go">↗</span>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-rid]').forEach((c) => {
      c.onclick = () => {
        const rec = list.find((x) => x.id === c.dataset.rid);
        if (rec) resumeRoom(rec);
      };
    });
  }
  async function toggleHistory() {
    if (!needAuth()) return;
    const box = $('roomHistoryBox');
    if (state.historyOpen) { // 再点收起
      state.historyOpen = false; box.classList.add('hidden'); return;
    }
    state.historyOpen = true;
    box.classList.remove('hidden');
    znSkeleton(box);
    try {
      const j = await get('/api/room/mine');
      state.histRooms = j.rooms || [];
      renderHistory();
    } catch (e) { box.innerHTML = znErrorHtml(T().histFail, errMsg(e)); }
  }
  async function resumeRoom(rec) {
    if (!needAuth()) return;
    try {
      const j = await get(`/api/room/${rec.id}/messages`);
      if (rec.kind === 'PITCH') {
        state.pitchRoom = rec.id;
        switchTab('pitch');
        stream('pitchStream', j.messages);
        $('pitchMore').classList.remove('hidden');
        state.lastVerdict = (j.room.payload && j.room.payload.verdict) || null;
        if (state.lastVerdict) renderVerdict(state.lastVerdict);
        else $('pitchVerdict').classList.add('hidden');
      } else {
        state.readRoom = rec.id;
        state.readMode = rec.readMode || j.room.readMode || 'me_xn';
        switchTab('read');
        renderReadModes(state.readMode);
        state.lastRoomMeta = j.room;
        stream('readStream', j.messages);
        renderReadInfo(j.room);
        $('readStream').classList.remove('hidden');
        $('readMore').classList.remove('hidden');
        // c199：恢复历史房时制式 select 必须与房 payload 一致，否则用户看到 LIVE、重跑却按 AIGC 算（控件撒谎）
        const savedFmt = (j.room.payload && j.room.payload.scriptMode) === 'AIGC' ? 'AIGC' : 'LIVE';
        if ($('readFormat')) $('readFormat').value = savedFmt;
        state.lastRead = (j.room.payload && j.room.payload.lastRead) || null;
        if (state.lastRead) renderReadActions(state.lastRead);
        else $('readActions').classList.add('hidden');
      }
    } catch (e) { window.Xn.toast(errMsg(e)); }
  }
  function rerender() {
    renderReadModes();
    applyPickLabels(); // c202：选择器静态词条随语言刷新（选中条也按新语言重绘）
    if (state.lastRoomMeta) renderReadInfo(state.lastRoomMeta);
    if (state.lastVerdict) renderVerdict(state.lastVerdict);
    if (state.lastRead) renderReadActions(state.lastRead);
    if (state.historyOpen) renderHistory();
  }
  document.addEventListener('DOMContentLoaded', function init() {
    if (!$('roomPanel')) return;
    renderReadModes();
    setupReadPicker(); // c202：围读 tab 注入“从我的作品选一集”入口
    document.addEventListener('zn-lang', rerender);
    const tp = $('toolPitch'); if (tp) tp.onclick = () => openPanel('pitch');
    const tr = $('toolRead'); if (tr) tr.onclick = () => openPanel('read');
    $('roomClose').onclick = () => $('roomPanel').classList.add('hidden');
    $('roomHistoryBtn').onclick = toggleHistory;
    document.querySelectorAll('.room-tab').forEach((b) => b.onclick = () => switchTab(b.dataset.rtab));
    $('pitchOpenBtn').onclick = pitchOpen;
    $('pitchSayBtn').onclick = pitchSay;
    $('pitchDecideBtn').onclick = pitchDecide;
    $('readOpenBtn').onclick = readOpen;
    $('readJoinBtn').onclick = readJoin;
    $('readSayBtn').onclick = readSay;
    $('readAiBtn').onclick = readAi;
  });
  // c202：prefillScript 供作品页漂移条桥接（仅预填 scriptId，不开房不扣费）
  window.RoomView = { openPanel, prefillScript };
})();
