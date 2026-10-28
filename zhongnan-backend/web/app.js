/* 终南集·AGI编剧大师 · 前端主逻辑（零构建原生 ES）。
   主题/语言持久化、12 模式、登录注册、作品库、带鉴权 SSE 生成、游戏化进度、结果与分享。 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // v2.170 复盘修复：原 s.replace('{k}', v) 只替换首次出现，文案含 2+ 个相同占位符（如 "{n} 天前，已 {n} 天没动"）第二个不被替换；改 split-join 全局替换
  const t = (key, vars) => { if (!window.I18N) return key; let s = I18N.t(lang, key); if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.split('{' + k + '}').join(String(v)); }); return s; };
  // v2.183 资产字段名 i18n 映射：扁平键（dashThinBatchFieldsVoice 等），与 t() 字符串查表兼容（对象类型会让 t() 调 .split 报错）
  // c179 复盘修复：原 `|| f` 兜底无效——t() 在 key 缺失时返回 key 本身（如 'dashThinBatchFieldsCatchphrase'），
  //   非空字符串是 truthy，`|| f` 拦不住——返回的长串前缀给编导看等于暴露 i18n 实现细节
  //   修复：先查 i18n，若返回值仍是 key 本身（兜底链最末端），回退到 f 原值
  const fieldName = (f) => {
    const key = 'dashThinBatchFields' + f.charAt(0).toUpperCase() + f.slice(1);
    const v = t(key);
    return v === key ? f : v;
  };
  const LEVEL_ZH = { FREE: '免费', BASIC: '基础', ADVANCED: '高级', PRO: '专业' };
  const LEVEL_EN = { FREE: 'Free', BASIC: 'Basic', ADVANCED: 'Advanced', PRO: 'Pro' };
  // v2.193 身份标签：超管/副管理员优先显示身份，普通用户显示会员档（避免超管登录显示"专业版"的名实不符）
  function userRoleLabel(u) {
    if (!u) return '';
    if (u.isSuperAdmin) return lang === 'en' ? 'Super Admin' : '超级管理员';
    if (u.isAdmin) return lang === 'en' ? 'Admin' : '管理员';
    return (lang === 'en' ? LEVEL_EN : LEVEL_ZH)[u.level] || u.level || '';
  }
  let lang = 'zh';

  // ═══ MODULE: config (152行, 1fn) ═══ 持久化偏好
  /* ---------- 持久化偏好 ---------- */
  const LS = { g: (k, d) => localStorage.getItem(k) || d, s: (k, v) => localStorage.setItem(k, v) };
  const THEMES = ['tech', 'light', 'dark', 'eye', 'auto'];
  let theme = LS.g('zn_theme', 'tech');
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function applyTheme() {
    const eff = theme === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : theme;
    document.documentElement.setAttribute('data-theme', eff);
    document.documentElement.setAttribute('data-theme-mode', theme);
  }
  function applyLang() {
    // c204 复盘修复：localStorage 可能是脏值（旧版本/手滑/带引号的 '"en"'），直接拿去索引双语表
    // 会让 renderSelects 等在每次加载时抛 TypeError、页面半崩；入口白名单归一并自愈写回。
    const stored = LS.g('zn_lang', 'zh');
    lang = stored === 'en' || stored === 'zh' ? stored : 'zh';
    if (stored !== lang) LS.s('zn_lang', lang);
    window.znLang = () => lang;   // 供独立 view（编剧室等）读取当前语言，一律返回归一后的值
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
    document.title = lang === 'en' ? 'ZhongnanJi · AGI Screenwriting Master' : '终南集 · 人工通用智能（AGI）编剧大师';
    renderStaticText(); renderModes(); renderHome(); renderSelects(); renderScriptTypes(); renderAuthButton();
    _applyToolboxHints(); // A3 工具箱卡片分层：静态卡注入方法论一句话提示行（随语言刷新）
    // v2.188 初始化同步守卫：applyLang 期间 syncTagBench/syncModeBrief 不主动调 openWorkbench（避免 layer 自动展开覆盖 12 模式主页）
    _initSyncing = true;
    // 语言切换时同步标签工作台（维度下拉与已选标签的显示语言）
    // v2.266 快照防双发：syncTagBench→initTagBench 首次取数并置 tagDimInited=true，活读标志会当轮再取一次；改用调用前快照
    if (typeof syncTagBench === 'function') { const _tagDimWasInited = tagDimInited; syncTagBench(); if (_tagDimWasInited) Api.request('/api/tags/dimensions').then((r) => r.json()).then(fillTagDimSel).catch(() => {}); }
    // 语言切换时同步小南递招面板（钩子/方法卡显示语言）
    if (typeof renderCraftHooks === 'function' && craftTaxonomy) { renderCraftHooks(); renderCraftCards(); renderCraftPicked(); }
    // v2.267 [P2-2a] 钩子编排摘要按钮（🎣 钩子编排：[系统智能]…）按界面语言重渲染；
    // refreshHookSummary 内部对元素/数据全空值守卫，钩子卡未初始化时调用安全
    if (typeof refreshHookSummary === 'function') refreshHookSummary();
    if (typeof renderBoardStatus === 'function') renderBoardStatus();
    if (typeof syncModeBrief === 'function') syncModeBrief();
    _initSyncing = false;
    if (typeof renderNovelLangRow === 'function' && novelAll) { renderNovelLangRow(); renderNovelGrid(); }
    // 语言切换时重渲染管理后台动态内容（tab/表头/按钮均为动态生成）
    const adm = $('view-admin');
    if (adm && !adm.classList.contains('hidden') && typeof renderAdmTabs === 'function') { renderAdmTabs(); loadAdmTab(); }
    // 通知独立 view（编剧室/拆爆款/多版本/分支）按新语言重渲染静态文案
    document.dispatchEvent(new CustomEvent('zn-lang', { detail: lang }));
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => theme === 'auto' && applyTheme());

  /* ---------- 静态文案 ---------- */
  function renderStaticText() {
    document.querySelectorAll('[data-i]').forEach((el) => { el.textContent = t(el.getAttribute('data-i')); });
    document.querySelectorAll('[data-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-ph'))); });
    document.querySelectorAll('[data-i-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i-aria'))); });
    $('brandSlogan').textContent = lang === 'en' ? 'Human-grade, AI-undetectable vertical short-drama studio' : '人类级、无AI感的竖屏短剧创作工作台';
    $('heroTitle').textContent = lang === 'en' ? 'Turn one idea into a full AI writers’ room' : '把一个灵感，交给一整支AI编剧团队';
    $('heroSub').textContent = lang === 'en'
      ? 'Ten specialized agents collaborate; gated, anti-AI, market-aware scripts.'
      : '十大岗位智能体协同创作，分级把关、去AI化、贴合市场，进度全程可见。';
    $('xnLine').textContent = lang === 'en' ? 'Xiaonan: Ready when you are.' : '小南：准备开工～';
    if (typeof refreshListenBtn === 'function') refreshListenBtn();
    // c207：切语言后播放器按钮（播放/暂停/继续）与进度文案也要立即跟随
    if (typeof listenSyncUI === 'function') listenSyncUI();
    // 内部账户：静态价格徽标统一改为「内部账户 · 免费」（动态卡片在各自渲染处处理）
    staffCostPatch();
    // v2.232 subAllBtn 展开/收起态文案自愈（按钮已去 data-i，展开态切语言由此复原）
    syncSubAllLabel();
  }

  /* ---------- v2.329 八模式（模式 × 剧本类型 × 输出语言 三维） ---------- */
  let selectedMode = 'tag';
  let draftProject = null;
  // 灵感式内部轨道：素材改编(默认,基础) / 名场面拓展(高级) / 爆款逆向批量(专业)
  let selectedTrack = 'material_rewrite';
  // 剧本类型：与后端 SCRIPT_TYPES 对齐；免费档默认真人实拍短剧
  let selectedScriptType = 'live_action_drama';
  // v2.332 互动类成品形态（互动剧 / 互动影游）共用分支简报与分支图工作台
  const isInteractiveType = (t) => t === 'interactive_drama' || t === 'interactive_game';
  // v2.329 契约数据（data/constants.js 已加载；与后端 modes.ts 同源）
  const SCRIPT_TYPES = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.SCRIPT_TYPES) || [];
  const OUT_LANGS = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.OUT_LANGS) || [];
  const TIER_NAME = { basic: '基础', advanced: '高级', pro: '专业' };
  // v2.330 多方评议（Council）理由缓存：登录后拉取一次（v2.332 起 48 项），锁定项以 title 展示「为什么是这个档」
  let councilHints = {};
  function councilText(id) {
    const hints = typeof councilHints === 'undefined' ? null : councilHints;
    const h = hints && hints[String(id)];
    if (!h) return '';
    return (lang === 'en' ? h.en : h.zh) || '';
  }
  function councilTitle(id) { const s = councilText(id); return s ? ` title="${escapeHtml(s)}"` : ''; }
  function loadCouncilHints() {
    if (!Api.isAuthed()) { councilHints = {}; return; }
    Api.request('/api/generate/council?module=all').then((r) => r.json()).then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      const next = {};
      items.forEach((it) => { next[it.id] = { zh: it.summary, en: it.summaryEn, status: it.status }; });
      councilHints = next;
      renderModes(); renderSelects(); renderScriptTypes();
    }).catch(() => {});
  }
  // 内部账户（超管杨光本人手机号 + 杨光指定的副管理员）：创作全免费，前端等级墙一律按专业级开放
  const _RANK = { free: 0, basic: 1, advanced: 2, pro: 3, paid: 3 };
  function isStaffAcct(me) { const m = me || meCache; return !!(m && (m.staff || m.isAdmin)); }
  // 供独立 view（编剧室/拆爆款等）与动态渲染处判断当前登录人是否内部账户
  window.znIsStaff = () => isStaffAcct();
  // 内部账户在一切价格徽标处看到的统一文案（真实模型成本由平台承担，向 staff 收 0）
  function staffCostLabel() { return lang === 'en' ? 'Staff · Free' : '内部账户 · 免费'; }
  // staff 工具箱文案精细化：保留操作名+数字归零+尾加「（内部免费）」/「 (Staff Free)」
  // 纯函数来自 web/staff-cost.js（浏览器与单测共用），不再笼统覆盖丢失操作名
    // @module config
  const staffCostNormalize = (typeof ZnStaffCost === 'object' && ZnStaffCost && ZnStaffCost.normalizeStaffCost)
    ? ZnStaffCost.normalizeStaffCost
    : function staffCostNormalizeFallback(rawTxt, en) { // 兜底：若 staff-cost.js 未加载（极少见），退化到原口径
        if (rawTxt == null) return rawTxt;
        return staffCostLabel();
      };
  function staffCostPatch(root) {
    if (!isStaffAcct()) return;
    // 工具箱价格徽标：保留操作名+数字归零+尾标（不再笼统替换为 staffCostLabel 丢失操作名）
    if (typeof ZnStaffCost === 'object' && ZnStaffCost && typeof ZnStaffCost.patchStaffCostInDom === 'function') {
      ZnStaffCost.patchStaffCostInDom(root || document, lang === 'en');
    }
    // 固定位置的静态收费按钮/提示：staff 统一换成免费口径（data-i 文本先于本补丁写入）
    const en = lang === 'en';
    const ID_FREE = {
      pitchOpenBtn: en ? 'Start pitch meeting · Free' : '开始选题会（内部免费）',
      pitchSayBtn: en ? 'Add note · Free' : '补充发言(内部免费)',
      pitchDecideBtn: en ? 'Form verdict · Free' : '形成选题决议(内部免费)',
      pkBtn: en ? '⚔️ Script PK · Free' : '⚔️ 剧本PK（内部免费）',
      ivStartBtn: en ? '🎬 Start interview · Free' : '🎬 开始采访（内部免费）',
      tdAnalyzeBtn: en ? 'Start teardown · Free' : '开始拆解（内部免费）',
      tdOutlineBtn: en ? 'Build adaptation outline · Free' : '生成改编大纲（内部免费）',
      readAiBtn: en ? 'Start AI read · Free' : '开始AI围读（内部免费）',
      valuePosterBtn: en ? 'Generate HD certificate poster · Free' : '生成高清证书海报（内部免费）',
    };
    Object.entries(ID_FREE).forEach(([id, txt]) => { const el = document.getElementById(id); if (el) el.textContent = txt; });
    const tdCostTip = document.getElementById('tdCostTip');
    if (tdCostTip) tdCostTip.textContent = en ? 'Free for staff accounts' : '内部账户免费';
    const pkHint = document.getElementById('pkSetupHint');
    if (pkHint) pkHint.textContent = en ? 'Pick an opponent: another project of yours or a platform benchmark. Free for staff; the result is gamified reference only.' : '选择对手：用你另一个项目对阵，或直接挑战平台标杆本。内部账户免费，结果仅作游戏化参考。';
  }
  window.znStaffCostLabel = () => staffCostLabel();
  function acctRank() {
    if (isStaffAcct()) return _RANK.pro;
    return _RANK[String(meCache?.level || 'FREE').toLowerCase()] ?? 0;
  }
  function renderModes() {
    const grid = $('modeGrid'); if (!grid || !window.I18N) return;
    const D = I18N.DICT[lang] || I18N.DICT.zh;
    grid.innerHTML = '';
    const RANK = _RANK;
    const myRank0 = acctRank();
    const TIER_ZH = { basic: '基础', advanced: '高级', pro: '专业' };
    I18N.MODES.forEach((m) => {
      const tierLocked = !m.soon && !m.lock && (RANK[m.free] ?? 0) > myRank0;
      const card = document.createElement('button');
      card.className = 'mode-card' + (m.id === selectedMode ? ' on' : '') + (m.soon ? ' soon' : '') + (m.lock ? ' lock' : '') + (tierLocked ? ' tier-lock' : '');
      const modeHint = councilText('mode:' + m.id); if (modeHint) card.title = modeHint;
      card.innerHTML = `<b>${D.mode[m.id] || m.id}</b><span>${D.modeDesc[m.id] || ''}</span>` +
        (m.soon ? `<em class="badge soon-badge">${lang === 'en' ? 'coming soon' : '研发中'}</em>` : '') +
        (m.lock ? `<em class="badge lock-badge">${lang === 'en' ? 'gated, age-verified' : '分级授权'}</em>` : '') +
        (tierLocked ? `<em class="badge tier-badge">${lang === 'en' ? `${m.free}+` : `需${TIER_ZH[m.free] || ''}会员`}</em>` : '') +
        // P1 trailing icon：Button-in-Button（high-end-visual-design）—— 不可进入态不显示箭头
        ((!m.soon && !m.lock && !tierLocked) ? `<em class="mode-go" aria-hidden="true">↗</em>` : '');
      card.onclick = () => {
        if (m.soon) { xnSay(lang === 'en' ? 'Feature film script is in the works. Stay tuned.' : '电影剧本功能正在打磨，敬请期待～'); return; }
        if (m.lock) { openXMature(); return; }
        // 会员等级软拦截：等级不足不进入，明确告知并引导升级（与后端 /projects 强校验同源）
        const RANK = _RANK;
        const myRank = acctRank();
        const needRank = RANK[m.free] ?? 0;
        if (needRank > myRank) {
          const needName = { basic: '基础会员', advanced: '高级会员', pro: '专业会员' }[m.free] || '更高等级会员';
          xnSay(lang === 'en' ? `This mode needs ${m.free} membership. Unlock it in the VIP area.` : `该模式需${needName}，已为你打开会员专区～`);
          if (typeof switchView === 'function') switchView('vip');
          return;
        }
        clearDraftProject();
        selectedMode = m.id; if (m.id !== 'spark') selectedTrack = 'material_rewrite'; renderModes(); syncTagBench(); syncModeBrief();
      };
      grid.appendChild(card);
    });
    znBindGrid(grid, { selector: '.mode-card' }); // v2.271 12 张模式卡四方向键导航（Tab 只需进网格一次）
  }
  // ═══ MODULE: misc (220行, 5fn) ═══ v2.190 清爽首页渲染
  /* ---------- v2.190 清爽首页渲染 ---------- */
  // v2.329 八模式：快捷创作精选 6 个常用（标签免费 + 采访/日记/灵感基础 + 热点/双人对撞高级）
  const HOME_QUICK_MODES = ['tag', 'interview', 'diary', 'spark', 'hot', 'duel'];
  const HOME_TOOLS = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.HOME_TOOLS) || [
    { id: 'toolPitch', key: 'tbCardPitch', desc: 'tbCardPitchP', cost: 'tbCostPitch' },
    { id: 'toolRead', key: 'tbCardRead', desc: 'tbCardReadP', cost: 'tbCostRead' },
    { id: 'toolTeardown', key: 'tbCardTd', desc: 'tbCardTdP', cost: 'tbCostTd' },
    { id: 'toolDiversity', key: 'tbCardDv', desc: 'tbCardDvP', cost: 'tbCostDv' },
  ];
  let _homeRendered = false;
  function renderHome() {
    const D = I18N.DICT[lang] || I18N.DICT.zh;
    // 快捷创作模式（6 个常用）
    const qg = $('homeQuickGrid');
    if (qg) {
      qg.innerHTML = '';
      const RANK = _RANK;
      const myRank0 = acctRank();
      const TIER_ZH = { basic: '基础', advanced: '高级', pro: '专业' };
      I18N.MODES.filter((m) => HOME_QUICK_MODES.includes(m.id)).forEach((m) => {
        const tierLocked = !m.soon && !m.lock && (RANK[m.free] ?? 0) > myRank0;
        const card = document.createElement('button');
        card.className = 'home-quick-card' + (tierLocked ? ' tier-lock' : '');
        card.innerHTML = `<b>${escapeHtml(D.mode[m.id] || m.id)}</b><span>${escapeHtml(D.modeDesc[m.id] || '')}</span>` +
          (tierLocked ? `<em class="home-go" style="opacity:1;color:var(--text-3)">${lang === 'en' ? `${m.free}+` : `需${TIER_ZH[m.free] || ''}会员`}</em>` : `<em class="home-go">${lang === 'en' ? 'Start →' : '开始 →'}</em>`);
        card.onclick = () => {
          if (tierLocked) {
            xnSay(lang === 'en' ? `This mode needs ${m.free} membership.` : `该模式需${TIER_ZH[m.free] || '更高等级'}会员，已为你打开会员专区～`);
            switchView('vip'); return;
          }
          switchView('studio');
          selectedMode = m.id; if (m.id !== 'spark') selectedTrack = 'material_rewrite';
          renderModes(); syncTagBench(); syncModeBrief();
        };
        qg.appendChild(card);
      });
      znBindGrid(qg, { selector: '.home-quick-card' }); // v2.271 首页快捷模式卡方向键导航
    }
    // 工具箱快捷入口（4 个）
    const tg = $('homeToolGrid');
    if (tg) {
      tg.innerHTML = '';
      HOME_TOOLS.forEach((tool) => {
        const card = document.createElement('button');
        card.className = 'home-tool-card';
        // staff 渲染分流：保留操作名+数字归零+尾标（不再笼统覆盖为 staffCostLabel 丢失操作名）
        const costTxt = isStaffAcct() ? staffCostNormalize(t(tool.cost), lang === 'en') : t(tool.cost);
        card.innerHTML = `<h3>${escapeHtml(t(tool.key))}</h3><p>${escapeHtml(t(tool.desc))}</p><span class="tool-cost">${escapeHtml(costTxt)}</span>`;
        card.onclick = () => {
    // @module misc
          const panel = ({ toolPitch: 'roomPanel', toolRead: 'roomPanel', toolTeardown: 'teardownPanel', toolDiversity: 'diversityPanel', toolBranch: 'branchPanel' })[tool.id];
          if (panel) openWorkbench(panel);
        };
        tg.appendChild(card);
      });
      znBindGrid(tg, { selector: '.home-tool-card' }); // v2.271 首页工具卡方向键导航
    }
    // CTA 绑定（仅首次）
    if (!_homeRendered) {
      const startBtn = $('homeStartBtn');
      if (startBtn) startBtn.onclick = () => switchView('studio');
      const sampleBtn = $('homeSampleBtn');
      if (sampleBtn) {
        const studioSample = $('sampleEntryBtn');
        sampleBtn.onclick = () => { if (studioSample) studioSample.click(); else openModal('sampleModal'); };
      }
      // "全部 12 种模式" 链接
      document.querySelectorAll('[data-view-go]').forEach((b) => {
        b.onclick = () => switchView(b.getAttribute('data-view-go'));
      });
      _homeRendered = true;
    }
    // 拉取最新动态
    loadHomeUpdates();
  }
  // v2.266 最新公告共享取数：loadHomeUpdates 与 initUpdateBanner 同源，60s TTL + 在途合并（启动不再双发）
  let _latestAnnCache = null; let _latestAnnAt = 0; let _latestAnnInflight = null;
  async function fetchLatestAnnouncement() {
    if (_latestAnnCache !== null && Date.now() - _latestAnnAt < 60000) return _latestAnnCache;
    if (_latestAnnInflight) return _latestAnnInflight;
    _latestAnnInflight = (async () => {
      try {
        const res = await Api.request('/api/updates/latest');
        const data = res.ok ? await Api.jsonOrThrow(res) : null;
        _latestAnnCache = data; _latestAnnAt = Date.now();
        return data;
      } finally { _latestAnnInflight = null; }
    })();
    return _latestAnnInflight;
  }
  async function loadHomeUpdates() {
    const body = $('homeUpdatesBody'); if (!body) return;
    try {
      const d = await fetchLatestAnnouncement();
      const a = d && d.announcement;
      if (!a) { body.innerHTML = `<div class="muted">${escapeHtml(t('homeUpdatesEmpty'))}</div>`; return; }
      const isEn = lang === 'en';
    // @module misc
      const title = (isEn && a.titleEn) ? a.titleEn : (a.titleZh || '');
    // @module misc
      const text = (isEn && a.bodyEn) ? a.bodyEn : (a.bodyZh || '');
      const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString(isEn ? 'en-US' : 'zh-CN') : '';
      body.innerHTML = `<div class="home-update-item">
        <span class="hu-title">${escapeHtml(title)}</span>
        ${text ? `<span class="hu-body">${escapeHtml(String(text).slice(0, 240))}</span>` : ''}
        ${date ? `<span class="hu-meta">${date}${a.version ? ' · v' + escapeHtml(a.version) : ''}</span>` : ''}
      </div>`;
    } catch {
      body.innerHTML = `<div class="muted">${escapeHtml(t('homeUpdatesEmpty'))}</div>`;
    }
  }
  /* ---------- X剧本成年分级问卷（v2.40；服务端 mature-gating 强校验，前端只做引导） ---------- */
  const X_REGIONS = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.X_REGIONS) || [
    ['CN', '中国大陆', 'Chinese Mainland'], ['HK', '中国香港', 'Hong Kong SAR'], ['TW', '中国台湾', 'Chinese Taiwan'],
    ['US', '美国', 'United States'], ['JP', '日本', 'Japan'], ['KR', '韩国', 'South Korea'],
    ['EU', '欧盟', 'EU'], ['OTHER', '其他地区', 'Other region'],
  ];
  function xTxt() {
    return lang === 'en' ? {
      title: 'X-Script · 18+ rating & consent',
      boundary: 'X-Script only creates legal mature-rated narratives (crime thriller / violence / dark human nature / sensual tension), equivalent to film R/18+. Explicit pornography is HARD-BANNED in every jurisdiction — the questionnaire cannot override this. Authorization lasts 30 days and is fully logged.',
      age: 'I confirm I am at least 18 years old (enter age)',
      region: 'Jurisdiction I am currently in',
      cks: [
        'For lawful personal creation only; no illegal use.',
        'I will never distribute this content to minors.',
        'I understand the platform never generates explicit pornography.',
        'I take legal responsibility under my local laws.',
      ],
      submit: 'Submit questionnaire & verify', checking: 'Verifying admission…', needAll: 'Please fill age (18+) and tick all four statements.',
      pass: 'Admission passed — you can enter X-Script now.', enter: 'Enter X-Script',
      buy: 'Add-on: X-Script monthly ¥99', revoke: 'Revoke my authorization',
      reasons: 'Not admitted yet: ', signed: 'Questionnaire signed, valid until ',
    } : {
      title: 'X剧本 · 成年分级问卷与免责授权',
      boundary: 'X剧本只创作合法的成熟向叙事（犯罪惊悚/暴力/黑暗人性/情欲张力），对标电影 R/18+ 分级；露骨淫秽色情在所有法域下一律硬禁，问卷不能豁免。授权 30 天有效，全程留痕。',
      age: '我已年满 18 周岁（填写年龄）',
      region: '我当前所在的法域/地区',
      cks: [
        '仅用于合法的个人创作，不用于任何违法用途',
        '承诺不向未成年人传播相关内容',
        '知悉并同意平台不生成露骨淫秽内容的边界',
        '自行承担所在地法律法规责任',
      ],
      submit: '提交问卷并核验准入', checking: '正在核验准入资格…', needAll: '请填写年龄（≥18）并逐项勾选全部四条声明。',
      pass: '准入已通过，可以进入 X剧本创作。', enter: '进入 X剧本',
      buy: '开通 X剧本月度功能 ¥99', revoke: '撤销我的授权',
      reasons: '暂未满足准入：', signed: '问卷已签署，有效期至 ',
    };
  }
  async function openXMature() {
    if (!Api.isAuthed()) { openAuth('login'); return; }
    const T = xTxt();
    $('xMatureTitle').textContent = T.title;
    $('xMatureBoundary').textContent = T.boundary;
    $('xAgeLb').textContent = T.age;
    $('xRegionLb').textContent = T.region;
    $('xMatureRegion').innerHTML = X_REGIONS.map(([v, zh, en]) => `<option value="${v}">${lang === 'en' ? en : zh}</option>`).join('');
    [['xckPurpose', T.cks[0]], ['xckMinor', T.cks[1]], ['xckBoundary', T.cks[2]], ['xckLegal', T.cks[3]]]
      .forEach(([id, tx]) => { $(id).textContent = tx; });
    $('xMatureSubmit').textContent = T.submit;
    $('xMatureBuy').textContent = T.buy;
    $('xMatureEnter').textContent = T.enter;
    $('xMatureRevoke').textContent = T.revoke;
    ['xMatureBuy', 'xMatureEnter', 'xMatureRevoke'].forEach((id) => $(id).classList.add('hidden'));
    const status = $('xMatureStatus'); status.classList.remove('hidden'); status.textContent = T.checking;
    openModal('xMatureModal');
    renderXAdmission(null, true);
    try {
      const r = await Api.request('/api/generate/mature/consent');
      const j = await Api.jsonOrThrow(r);
      renderXAdmission(j);
    } catch { status.textContent = ''; status.classList.add('hidden'); }
  }
  function renderXAdmission(j, loading) {
    const T = xTxt(); const status = $('xMatureStatus');
    $('xMatureEnter').classList.toggle('hidden', !(j && j.pass));
    $('xMatureRevoke').classList.toggle('hidden', !j?.latest);
    if (loading) { status.classList.remove('hidden'); status.textContent = T.checking; return; }
    if (!j) { status.classList.add('hidden'); return; }
    status.classList.remove('hidden');
    if (j.pass) {
      const until = j.expireAt ? new Date(j.expireAt).toLocaleDateString() : '';
      status.textContent = T.pass + (until ? `（${T.signed}${until}）` : '');
    } else {
    // @module misc
      const needPro = (j.reasons || []).some((x) => x.includes('专业会员') || x.includes('PRO'));
    // @module misc
      const needPay = (j.reasons || []).some((x) => x.includes('付费') || x.includes('开通'));
      $('xMatureBuy').classList.toggle('hidden', !(needPro || needPay));
      status.textContent = T.reasons + (j.reasons || []).join('；');
    }
  }
  $('xMatureSubmit').onclick = async () => {
    const T = xTxt();
    const age = Number($('xMatureAge').value);
    const allCk = ['xCkPurpose', 'xCkMinor', 'xCkBoundary', 'xCkLegal'].every((id) => $(id).checked);
    if (!(age >= 18 && age <= 120 && allCk)) { xnSay(T.needAll); return; }
    const btn = $('xMatureSubmit'); const old = btn.textContent; btn.disabled = true; btn.textContent = T.checking;
    try {
      const body = {
        age, region: $('xMatureRegion').value,
        purposePersonal: true, noMinorDistribution: true, boundaryAccepted: true, legalSelfResponsible: true,
      };
      const r = await Api.request('/api/generate/mature/consent', { method: 'POST', body: JSON.stringify(body) });
      const j = await Api.jsonOrThrow(r);
      renderXAdmission(j);
      if (j.pass) xnSay(lang === 'en' ? 'Admission passed — enter X-Script.' : '准入通过，可以进入 X剧本啦～');
      else xnSay((lang === 'en' ? 'Not admitted: ' : '还差几步：') + (j.reasons || []).join('；'));
    } catch (e) { xnSay(e.message || 'FAIL'); } finally { btn.disabled = false; btn.textContent = old; }
  };
  $('xMatureBuy').onclick = () => { $('xMatureModal').classList.add('hidden'); placeOrder('XSCRIPT_M'); };
  $('xMatureEnter').onclick = () => {
    $('xMatureModal').classList.add('hidden');
    // v2.329 X剧本（mature_x）归角色自述式 + 电影剧本类型，支持犯罪惊悚/黑暗人性等成熟题材，露骨色情仍硬拦截
    selectedMode = 'persona'; selectedScriptType = 'feature_film'; renderModes(); renderScriptTypes(); syncModeBrief();
    xnSay(lang === 'en' ? 'X-Script feature merged into Film mode — try it for crime thriller / dark human nature stories (explicit porn still blocked).' : 'X剧本已整合进电影剧本创作，支持犯罪惊悚/黑暗人性等成熟题材（露骨色情仍会被硬拦截）。');
  };
  $('xMatureRevoke').onclick = async () => {
    // v2.285 断网 reject 静默（全局网络 toast 已提示）；HTTP 非 ok 不得乐观提示撤销成功
    try {
      const r = await Api.request('/api/generate/mature/consent/revoke', { method: 'POST' });
      if (!r.ok) { xnSay(znSanitizeErr((await r.json().catch(() => ({}))).error, r.status) || (lang === 'en' ? 'Revoke failed, please try again.' : '撤销失败，请稍后重试')); return; }
    } catch { return; }
    xnSay(lang === 'en' ? 'Authorization revoked.' : '授权已撤销。');
    openXMature().catch(() => {});
  };
  // ═══ MODULE: config (107行, 0fn) ═══ 各模式内联创意输入（替代 window.prompt，按模式给专属引导，杜绝无输入入口的断点）
  /* ---------- 各模式内联创意输入（替代 window.prompt，按模式给专属引导，杜绝无输入入口的断点） ---------- */
  const MODE_BRIEF = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.MODE_BRIEF) || {
    // v2.328 自动匹配：用户只写想做什么，模式/轨道/策略由后端意图路由决定
    auto: { zh: ['直接写你想做什么，系统自动匹配模式', '例如「做个30秒抖音带货口播，前三秒要抓人」「把这部小说改成竖屏短剧」「拆解这部剧的爆款结构，批量出新本」——不用自己选模式，生成前会告诉你匹配到了什么，可随时改。'], en: ['Just describe what you want — mode is auto-picked', 'e.g. "a 30s TikTok voiceover with a 3-second hook", "adapt this novel into a vertical drama", "deconstruct this hit and batch out safe new drafts". No mode picking needed; we tell you what we matched before generating, and you can change it.'] },
    interview: { zh: ['把你零散的想法先倒在这里', '可以想到哪写到哪：核心创意、世界观、人物、想要的冲突都行；小南会在出本时把它们结构化，也可随时回来补充。'], en: ['Dump your scattered ideas here', 'Write freely: core idea, world, characters, conflicts. Xiaonan structures them at generation; you can come back anytime.'] },
    tag: { zh: ['标签就是你的创作基因', '在下方标签工作台选题材、人设、冲突等维度，系统按组合定向出本；想更准可在这里补一句故事方向。'], en: ['Tags are your creative DNA', 'Pick genre / persona / conflict dimensions in the tag bench below; the system drafts by combination. Add one line of direction here to sharpen it.'] },
    diary: { zh: ['把今天想写的日记写在这里（仅你可见）', '写真实感受即可。落稿前必须由你授权：摘要 / 指定段落 / 全部 三档任选，随时可撤回；未经授权不会进入剧本。'], en: ['Write today’s diary here (visible only to you)', 'Just write what you really feel. Nothing becomes a script until you authorize it: summary / selected passages / full, revocable anytime.'] },
    spark: { zh: ['写一句话灵感，或粘贴已有素材', '点「AI 提案」让小南先给方向，多轮对话聊到满意；只有你点确认后才落稿。素材改编可在下方切换轨道（素材改编/名场面/爆款逆向）。'], en: ['One-line spark, or paste existing material', 'Tap “AI pitch” for directions, talk it out over turns, and nothing is written until you confirm. Switch tracks below (material rewrite / signature scene / hit reverse).'] },
    persona: { zh: ['先定这个「我」是谁', '写清第一人称叙述者的身份、想要什么、最怕什么，以及他/她可能对自己撒的谎；系统用不可靠叙述在前半埋线、后半反转。'], en: ['Define who “I” is first', 'Give the first-person narrator’s identity, want, deepest fear and the lie they may tell themselves; the unreliable narration plants seeds early and pays off as a twist.'] },
    duel: { zh: ['写清对撞的两个人与各自不可退让的立场', 'A 要什么、B 要什么、为什么谁都不能退；系统让两人轮流出招逐轮加码，直到一方无法再退或被迫掀底牌。'], en: ['Describe the two opponents and their non-negotiable stances', 'What A wants, what B wants, why neither can retreat; they trade moves round by round, escalating until one cannot retreat or must show their card.'] },
    multiverse: { zh: ['写清那个「关键选择」', '同一个选择分出 2-4 条世界线：每条线写清路线与代价，最后合并回主线（或明确留白）；系统保证各线自洽、代价可回溯。'], en: ['Describe the pivotal choice', 'One choice forks 2–4 worldlines; state each route and its cost, then merge back to the main line (or leave it open). Every branch stays coherent and its cost traceable.'] },
    adapt: { zh: ['粘贴要改编的原作片段，或上传文件（自有/已授权内容）', '支持 txt/md/docx/epub/pdf（≤8MB），上传后自动提取正文；并在末尾写清想要续写/衍生/联动/同人中的哪种、原著尊重度高低。'], en: ['Paste the source you own/license, or upload a file', 'txt/md/docx/epub/pdf up to 8MB are auto-extracted. Add one line: sequel/spin-off/crossover/fanfic and how faithful to stay.'] },
    novel: { zh: ['粘贴小说原文，或上传小说文件（txt/md/docx/epub/pdf）', '上传后自动识别章节；注明必须保留的名场面或人物；系统会压缩冗余、按竖屏短剧节奏重排钩子与冲突。'], en: ['Paste novel chapters or upload a file (txt/md/docx/epub/pdf)', 'Chapters are auto-detected; mark must-keep scenes/characters; redundant narration is compressed into vertical-drama pacing.'] },
    interactive: { zh: ['描述主线起点与关键选择点', '分支要素填下方分支简报：选准分支风格（后果/关系/道德/悬疑）与利害压量；系统自动做闭环校验，确保每条支路有路可走。'], en: ['Describe the main line start and key choice points', 'Fill the branch brief below and pick the branch style (consequence/relationship/moral/mystery) and stakes; the system validates branch closure — every path leads somewhere.'] },
    hit_lab: { zh: ['粘贴高能名场面，或要逆向的爆款文本/链接描述', '两条轨道：①名场面拓展——写清冲突峰值、在场人物、要保留的关键台词/动作，向前补因向后延果；②爆款逆向（专业）——贴整剧爆款，只拆方法论骨架、换人设背景批量出不侵权新本，可在下方切换轨道。'], en: ['Paste a signature scene, or a hit text/link to reverse-engineer', 'Two tracks: ① Signature-scene expansion — give the conflict peak, people present and key line/action; ② Hit reverse (Pro) — paste the whole hit, reuse only the method skeleton, swap persona/setting and batch safe drafts. Switch track below.'] },
    long_ip: { zh: ['描述这个长系列IP的总体构想', '写清计划几季、每季核心问题、已有的世界观与常驻人物、想埋的跨季伏笔与多IP联动设想；系统建立系列圣经（总时间线/关系与伏笔账本），保证跨季不矛盾、季终有大钩、新观众单季可入坑。'], en: ['Describe the long-running IP concept', 'State planned seasons, each season’s core question, existing world & recurring cast, cross-season foreshadow and crossover ideas; a series bible (master timeline / relationship & foreshadow ledgers) keeps canon consistent, ends seasons on mega-hooks and lets new viewers enter any season.'] },
    hot: { zh: ['描述要借的热点（影视/社会/节日/行业）', '热点要素填下方热点简报：选准借法（同人设衍生/同背景改编/同套路复刻/反向反差）；系统自动做侵权与舆情预检，只借概念不抄表达。'], en: ['Describe the trend to ride (film/social/festival/industry)', 'Fill the trend brief below and pick the borrowing approach (persona/setting/formula/reversal); IP & opinion risk is pre-checked — borrow concepts, never expression.'] },
    shortvideo: { zh: ['描述这条爆款短视频的主题与目标', '写清主题、目标受众、时长（如30/60秒）、想要的钩子与转化动作；系统产出强节奏口播/分镜脚本。'], en: ['Describe the short video topic and goal', 'Give topic, audience, length (30/60s), wanted hook and CTA; a tight-paced voiceover/storyboard script is produced.'] },
    softad: { zh: ['描述想拍的剧情脑洞（人物困境/场景）', '在下方「品牌简报」里填品牌、唯一核心卖点与软性度；本框只写剧情灵感。系统产出剧情化软广脚本，品牌在转折处自然成解法。'], en: ['Describe the story idea (character predicament / scene)', 'Fill brand, the single core selling point and softness in the Brand brief below; this box is for the story idea only. The brand becomes the solution at the turning point.'] },
    default: { zh: ['用一句话描述你的故事创意', '谁、遇到什么麻烦、准备怎么反击；越具体出本越准。'], en: ['One-line story idea', 'Who, what trouble, how they fight back — the more specific, the better.'] },
  };
  function syncModeBrief() {
    if (draftProject && selectedMode !== 'spark') clearDraftProject();
    const panel = $('modeBriefPanel'); if (!panel) return;
    const show = selectedMode !== 'tag';
    panel.classList.toggle('hidden', !show);
    if (!show) return;
    const cfg = MODE_BRIEF[selectedMode] || MODE_BRIEF.default;
    const [label, tip] = lang === 'en' ? cfg.en : cfg.zh;
    $('modeBriefLabel').textContent = label;
    $('modeBriefTip').textContent = tip;
    const ta = $('modeBrief'); if (ta) ta.placeholder = label;
    // v2.329 灵感式轨道：素材改编=基础（默认）/ 名场面拓展=高级 / 爆款逆向批量=专业
    const trackBox = $('hitLabTracks');
    if (trackBox) {
      const showTracks = selectedMode === 'spark';
      trackBox.classList.toggle('hidden', !showTracks);
      if (showTracks) {
        const RANK = _RANK;
        const myRank = acctRank();
        const TRACKS = [
          { id: 'material_rewrite', rank: 1, zh: '① 素材改编（基础）', en: '① Material rewrite (Basic)' },
          { id: 'signature_scene', rank: 2, zh: '② 名场面拓展（高级）', en: '② Signature scene (Advanced)' },
          { id: 'hit_reverse', rank: 3, zh: '③ 爆款逆向·批量（专业）', en: '③ Hit reverse batch (Pro)' },
        ];
        trackBox.innerHTML = '';
        TRACKS.forEach((tk) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = (lang === 'en' ? tk.en : tk.zh) + (tk.rank > myRank ? (lang === 'en' ? ' 🔒' : ' 🔒升级') : '');
          b.className = 'track-btn' + (selectedTrack === tk.id ? ' on' : '');
          b.onclick = () => {
            if (tk.rank > myRank) { xnSay(tk.rank === 3 ? (lang === 'en' ? 'The reverse-engineering batch track needs Pro membership.' : '爆款逆向批量是专业版轨道，已为你打开会员专区～') : (lang === 'en' ? 'The signature-scene track needs Advanced membership.' : '名场面拓展是高级版轨道，已为你打开会员专区～')); if (typeof switchView === 'function') switchView('vip'); return; }
            selectedTrack = tk.id; syncModeBrief();
          };
          trackBox.appendChild(b);
        });
      }
    }
    // 仅灵感式·素材改编轨道显示文件上传（原作/小说并入此轨道）
    const up = $('briefUpload');
    if (up) up.classList.toggle('hidden', !(selectedMode === 'spark' && selectedTrack === 'material_rewrite'));
    initBriefUpload();
    // v2.92 采访式创作：选中该模式时展示采访会话面板
    const ivp = $('interviewPanel');
    if (ivp) {
      ivp.classList.toggle('hidden', selectedMode !== 'interview');
      if (selectedMode === 'interview') initInterviewPanel();
    }
    // v2.329 品牌简报按剧本类型显示（广告/软广脚本），不再绑定模式
    const bbp = $('brandPanel');
    if (bbp) {
      const showBrand = selectedScriptType === 'ad_script';
      bbp.classList.toggle('hidden', !showBrand);
      if (showBrand) renderBrandPanel();
    }
    // v2.94 热点追更：选中该模式时展示结构化热点简报面板
    const tbp = $('trendPanel');
    if (tbp) {
      tbp.classList.toggle('hidden', selectedMode !== 'hot');
      if (selectedMode === 'hot') renderTrendPanel();
    }
    // v2.329 互动分支简报按剧本类型显示（互动剧）；v2.332 互动影游共用同一面板
    const brp = $('branchBriefPanel');
    if (brp) {
      brp.classList.toggle('hidden', !isInteractiveType(selectedScriptType));
      if (isInteractiveType(selectedScriptType)) renderBranchPanel();
    }
    // v2.329 原作/原文参考：灵感式展示原文输入框（用于 n-gram 重合度侵权检测）
    const stp = $('sourceTextPanel');
    if (stp) {
      const showSource = selectedMode === 'spark';
      stp.classList.toggle('hidden', !showSource);
      if (showSource) renderSourceTextPanel();
    }
    // v2.188 主动调 openWorkbench：避免"panel 已是非 hidden 但 layer 未展开"边界（用户重复选当前 mode 时 Observer 不触发）
    if (typeof openWorkbench === 'function' && !_initSyncing) {
      const _target = selectedMode === 'interview' ? 'interviewPanel'
        : selectedMode === 'hot' ? 'trendPanel'
        : selectedScriptType === 'ad_script' ? 'brandPanel'
        : isInteractiveType(selectedScriptType) ? 'branchBriefPanel'
        : selectedMode === 'spark' ? 'sourceTextPanel' : '';
      if (_target) openWorkbench(_target);
    }
    // v2.267 [P1-1] 纯内联简报模式（shortvideo：有 modeBrief 但无专属工作台面板）：
    // 点击卡片后把内联简报区平滑滚入视口并聚焦输入框，避免"点了没反应"
    // （#workbenchLayer 不展开、简报区在卡片网格下方不可见）。初始化/语言同步期间不滚。
    if (!_initSyncing && !['interview', 'hot', 'spark', 'tag'].includes(selectedMode) && selectedScriptType !== 'ad_script' && !isInteractiveType(selectedScriptType)) {
      const _bp = $('modeBriefPanel');
      if (_bp && !_bp.hidden) {
        _bp.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { const _ta = $('modeBrief'); if (_ta && document.contains(_ta)) _ta.focus({ preventScroll: true }); }, 350);
      }
    }
  }
  // ═══ MODULE: tags (71行, 3fn) ═══ v2.93 剧情软广·结构化品牌简报（标签/占位/软性度双语渲染 + 采集 + 合规错误回显）
  /* ---------- v2.93 剧情软广·结构化品牌简报（标签/占位/软性度双语渲染 + 采集 + 合规错误回显） ---------- */
  const BRAND_UI = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.BRAND_UI) || {
    zh: {
      heading: '剧情软广 · 品牌简报',
      tip: '品牌要素会作为「事实源」逐字注入创作：品牌名全程不改名、只锚定一个核心卖点、在剧情转折处自然成解法。品牌名与核心卖点必填；提交时自动做广告词合规预检（绝对化用语、医疗功效与收益承诺会被拦截）。',
      brand: '品牌名 *', brandPh: '如：橘隐',
      product: '产品/品类', productPh: '如：冷萃乌龙茶饮料',
      selling: '唯一核心卖点 *', sellingPh: '如：开盖即饮的冷萃乌龙，0 糖也有烘焙香',
      audience: '目标人群', audiencePh: '如：下午犯困又怕胖的上班族',
      symbol: '品牌记忆符号', symbolPh: '如：开罐声「啵」+ 橘色罐',
      cta: '期望转化动作', ctaPh: '如：评论区领尝鲜券',
      shell: '期望剧情外壳（选填）', shellPh: '如：加班深夜的办公室，新人被方案逼到崩溃',
      soft: '软性度',
      softOpts: { subtle: '轻植入（品牌转折后出现 1 次，无直接号召）', balanced: '均衡（体验证明 + 结尾软引导·推荐）', direct: '强转化（卖点清晰 + 明确 CTA，仍由剧情带出）' },
      required: '请先填齐品牌名与核心卖点（至少 2 个字），小南才能把品牌准确织进剧情。',
    },
    en: {
      heading: 'Branded skit · Brand brief',
      tip: 'These fields are injected verbatim as the source of truth: the brand name is never altered, only ONE selling point is anchored, and the product naturally becomes the solution at the turning point. Brand and selling point are required; ad-claim compliance is pre-checked on submit (absolute claims, medical/efficacy or return promises are blocked).',
      brand: 'Brand *', brandPh: 'e.g. Orange Hidden',
      product: 'Product / category', productPh: 'e.g. cold-brew oolong tea drink',
      selling: 'THE single core selling point *', sellingPh: 'e.g. ready-to-drink cold-brew oolong, roasted aroma with zero sugar',
      audience: 'Target audience', audiencePh: 'e.g. sleepy office workers avoiding sugar',
      symbol: 'Brand-owned memory symbol', symbolPh: 'e.g. the “pop” of the can + orange can',
      cta: 'Wanted conversion action', ctaPh: 'e.g. grab a trial coupon in comments',
      shell: 'Wanted story wrapper (optional)', shellPh: 'e.g. late-night office, a newcomer cornered by a deadline',
      soft: 'Softness',
      softOpts: { subtle: 'Subtle (brand appears once after the turn, no direct CTA)', balanced: 'Balanced (proof moment + soft end nudge · recommended)', direct: 'Conversion-led (clear point + explicit CTA, still plot-driven)' },
      required: 'Brand name and the single core selling point (≥2 chars) are required before the brand can be woven into the story.',
    },
  };
  let brandPanelRenderedLang = '';
  function renderBrandPanel() {
    if (brandPanelRenderedLang === lang) return; // 同语言不重复渲染（只改标签/占位，绝不碰用户输入值）
    const cfg = BRAND_UI_DICT();
    // @module tags
    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    // @module tags
    const setPh = (id, val) => { const el = $(id); if (el) el.placeholder = val; };
    set('bbHeading', cfg.heading); set('bbTip', cfg.tip);
    set('bbLBrand', cfg.brand); setPh('bbBrand', cfg.brandPh);
    set('bbLProduct', cfg.product); setPh('bbProduct', cfg.productPh);
    set('bbLSelling', cfg.selling); setPh('bbSelling', cfg.sellingPh);
    set('bbLAudience', cfg.audience); setPh('bbAudience', cfg.audiencePh);
    set('bbLSymbol', cfg.symbol); setPh('bbSymbol', cfg.symbolPh);
    set('bbLCta', cfg.cta); setPh('bbCta', cfg.ctaPh);
    set('bbLShell', cfg.shell); setPh('bbShell', cfg.shellPh);
    set('bbLSoft', cfg.soft);
    const sel = $('bbSoft');
    if (sel) Array.from(sel.options).forEach((o) => { o.textContent = cfg.softOpts[o.value] || o.textContent; });
    brandPanelRenderedLang = lang;
  }
  function BRAND_UI_DICT() { return BRAND_UI[lang === 'en' ? 'en' : 'zh']; }
  function showBrandError(msg) {
    const box = $('bbError');
    if (box) { box.textContent = msg; box.style.display = 'block'; }
    $('brandPanel')?.classList.remove('hidden');
    xnSay(msg);
  }
  function hideBrandError() { const box = $('bbError'); if (box) { box.textContent = ''; box.style.display = 'none'; } }
  /** 返回 { brandBrief } 片段；剧本类型为广告/软广脚本时缺必填返回 null（已弹错），其余返回 {} */
  function brandBriefPayload() {
    if (selectedScriptType !== 'ad_script' || !$('bbBrand')) return {};
    // @module tags
    const v = (id) => String($(id)?.value || '').trim();
    const brand = v('bbBrand'); const sellingPoint = v('bbSelling');
    if (!brand || sellingPoint.length < 2) { showBrandError(BRAND_UI_DICT().required); return null; }
    hideBrandError();
    return { brandBrief: {
      brand, product: v('bbProduct'), sellingPoint, audience: v('bbAudience'),
      storyShell: v('bbShell'), memorySymbol: v('bbSymbol'), cta: v('bbCta'),
      softness: $('bbSoft')?.value || 'balanced',
    } };
  }
  // ═══ MODULE: misc (192行, 8fn) ═══ v2.94 热点追更·结构化热点简报（四借法双语渲染 + 采集 + 隐私/侵权风险回显）
  /* ---------- v2.94 热点追更·结构化热点简报（四借法双语渲染 + 采集 + 隐私/侵权风险回显） ---------- */
  const TREND_UI = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.TREND_UI) || {
    zh: {
      heading: '热点追更 · 热点简报',
      tip: '热点要素作为「事实源」注入创作：选准借法，系统只借概念/结构/情绪，不抄原作表达。热点名称与爆点必填；提交时自动做侵权与舆情预检（手机号/身份证号会被拦截，灾难悲剧、未定性案件、直接引用原台词会触发强制虚构化要求）。',
      name: '热点名称/出处 *', namePh: '如：最近刷屏的「xx」话题（写公共可识别的称呼即可）',
      kind: '热点类型',
      kinds: { social: '社会话题', film: '影视综热点', festival: '节日/时令节点', industry: '行业事件' },
      approach: '借法（借什么、禁什么各不相同）',
      approaches: {
        persona_spin: '同人设衍生：借人物关系原型，人名/职业/城市全换，不复演名场面',
        setting_remix: '同背景改编：借情境母题，事件链与结局全部原创',
        formula_clone: '同套路复刻：只借钩子/反转/节奏结构，台词一句不沿用·推荐',
        reversal: '反向反差：对热点共识唱反调，翻认知不消费苦难',
      },
      heat: '为什么爆 / 情绪母题 *', heatPh: '如：打工人对「努力被关系户截胡」的集体憋屈，爽点在当场反击',
      angle: '我的切入角度/故事落点', anglePh: '如：不靠开挂，靠一份谁也没想到的提案当场翻盘',
      avoid: '明确规避元素（选填）', avoidPh: '如：不出现原剧角色名、不使用「xx」那句标志台词',
      required: '请先填齐热点名称与爆点/情绪母题（至少 4 个字），小南才能在不踩侵权红线的前提下借势。',
      pii: '热点信息含手机号/身份证号等隐私内容，请删除后再生成。',
    },
    en: {
      heading: 'Trend chasing · Trend brief',
      tip: 'These fields are injected as the source of truth: pick the borrowing approach and the system borrows only concept/structure/emotion, never the source’s expression. Trend name and heat core are required; IP & public-opinion risk is pre-checked on submit (phone/ID numbers are blocked; disasters, unresolved cases and direct quotes trigger mandatory fictionalization).',
      name: 'Trend name / source *', namePh: 'e.g. the viral “xx” topic (a publicly recognizable label is enough)',
      kind: 'Trend type',
      kinds: { social: 'Social topic', film: 'Film/TV/show trend', festival: 'Festival / seasonal moment', industry: 'Industry event' },
      approach: 'Borrowing approach (different rules each)',
      approaches: {
        persona_spin: 'Persona spin: borrow relationship archetypes; rename all, change jobs/city; no signature scenes',
        setting_remix: 'Setting remix: borrow the premise; original event chains and ending only',
        formula_clone: 'Formula clone: borrow hook/twist/pacing only; not one source line reused · recommended',
        reversal: 'Reversal: challenge the consensus; overturn a belief, never exploit suffering',
      },
      heat: 'Why it is hot / emotional core *', heatPh: 'e.g. workers’ resentment when effort is stolen by connections; payoff is an on-the-spot counter',
      angle: 'Your angle / landing point', anglePh: 'e.g. no magic fix — win the room with a proposal nobody expected',
      avoid: 'Explicitly avoid (optional)', avoidPh: 'e.g. no original character names, never use the signature line “xx”',
      required: 'Trend name and the heat/emotional core (≥4 chars) are required before the trend can be ridden safely.',
      pii: 'The trend brief contains private data such as a phone or ID number. Remove it and try again.',
    },
  };
  let trendPanelRenderedLang = '';
  function TREND_UI_DICT() { return TREND_UI[lang === 'en' ? 'en' : 'zh']; }
  function fillSelectOptions(id, dict, order) {
    const sel = $(id);
    if (!sel) return;
    order.forEach((key) => {
      const o = Array.from(sel.options).find((x) => x.value === key);
      if (o) o.textContent = dict[key];
    });
  }
  function renderTrendPanel() {
    if (trendPanelRenderedLang === lang) return; // 同语言不重复渲染，避免清空用户已填内容
    const cfg = TREND_UI_DICT();
    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    const setPh = (id, val) => { const el = $(id); if (el) el.placeholder = val; };
    set('tbHeading', cfg.heading); set('tbTip', cfg.tip);
    set('tbLName', cfg.name); setPh('tbName', cfg.namePh);
    set('tbLKind', cfg.kind); fillSelectOptions('tbKind', cfg.kinds, ['social', 'film', 'festival', 'industry']);
    set('tbLApproach', cfg.approach); fillSelectOptions('tbApproach', cfg.approaches, ['persona_spin', 'setting_remix', 'formula_clone', 'reversal']);
    set('tbLHeat', cfg.heat); setPh('tbHeat', cfg.heatPh);
    set('tbLAngle', cfg.angle); setPh('tbAngle', cfg.anglePh);
    set('tbLAvoid', cfg.avoid); setPh('tbAvoid', cfg.avoidPh);
    trendPanelRenderedLang = lang;
  }
  function showTrendError(msg) {
    const box = $('tbError');
    if (box) { box.textContent = msg; box.style.display = 'block'; }
    $('trendPanel')?.classList.remove('hidden');
    xnSay(msg);
  }
  function hideTrendError() { const box = $('tbError'); if (box) { box.textContent = ''; box.style.display = 'none'; } }
  /** 返回 { trendBrief } 片段；hot 模式下缺必填返回 null（已弹错），其余模式返回 {} */
  function trendBriefPayload() {
    if (selectedMode !== 'hot') return {};
    const v = (id) => String($(id)?.value || '').trim();
    const trendName = v('tbName'); const heatCore = v('tbHeat');
    if (trendName.length < 2 || heatCore.length < 4) { showTrendError(TREND_UI_DICT().required); return null; }
    hideTrendError();
    return { trendBrief: {
      trendName, heatCore,
      trendKind: $('tbKind')?.value || 'social',
      approach: $('tbApproach')?.value || 'formula_clone',
      userAngle: v('tbAngle'), avoidElements: v('tbAvoid'),
    } };
  }
  /* ---------- v2.95 互动分支·结构化分支简报（双语渲染 + 采集 + 闭环校验回显） ---------- */
  const BRANCH_UI = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.BRANCH_UI) || {
    zh: {
      heading: '互动分支 · 分支简报',
      tip: '分支要素作为「事实源」注入创作：架构师据此规划分支结构，撰写师据此落地选择点与结局。主线与选择点必填；提交时自动做闭环预检（结局数矛盾/坏结局过多会被拦截）。分支选项与去向在成稿△动作行中自然标出。',
      main: '主线起点 *', mainPh: '如：外卖员小陈接到一单送到豪华别墅区，发现收件人是自己前女友',
      choice: '关键选择点描述 *', choicePh: '如：前女友求助他帮忙送一封文件给现任男友，小陈面临接不接的选择',
      mainN: '主线结局数', hiddenN: '隐藏结局数', badN: '坏结局数',
      style: '分支风格',
      styles: { consequence: '后果驱动：选择带来不可逆的资源/处境变化', relationship: '关系驱动：选择改变人物关系走向', moral: '道德困境：选择拷问价值观，无绝对正确答案', mystery: '悬疑揭示：选择决定信息揭露顺序' },
      stakes: '利害压量',
      stakesOpts: { low: '低利害：日常情境中的小取舍', medium: '中利害：职业/感情中的真实代价·推荐', high: '高利害：人生/安全/道德的硬碰硬' },
      custom: '期望的特定结局（选填）', customPh: '如：隐藏结局是小陈发现前女友其实是在帮他',
      required: '请先填齐主线起点与关键选择点（各至少 4 个字），小南才能规划分支结构。',
      totalMin: '总结局数至少 2 个（好+隐藏+坏），才能形成真正的分支选择。',
    },
    en: {
      heading: 'Interactive branch · Branch brief',
      tip: 'These fields are injected as the source of truth: the architect plans the branch structure from them and the writer lands the choice points and endings. Main line and choice points are required; closure is pre-checked on submit (contradictory ending counts or too many bad endings are blocked). Branch options and destinations appear naturally in △ action lines in the draft.',
      main: 'Main line start *', mainPh: 'e.g. a courier delivers to a villa and finds the recipient is his ex-girlfriend',
      choice: 'Key choice point(s) *', choicePh: 'e.g. the ex asks him to deliver a document to her current boyfriend — accept or refuse?',
      mainN: 'Main endings', hiddenN: 'Hidden endings', badN: 'Bad endings',
      style: 'Branch style',
      styles: { consequence: 'Consequence-driven: choices cause irreversible resource/situation changes', relationship: 'Relationship-driven: choices change relationship trajectories', moral: 'Moral dilemma: choices test values; no absolutely correct answer', mystery: 'Mystery-reveal: choices determine information unlock order' },
      stakes: 'Stakes level',
      stakesOpts: { low: 'Low stakes: small everyday trade-offs', medium: 'Medium stakes: real career/relationship costs · recommended', high: 'High stakes: life-and-death / moral hard collisions' },
      custom: 'Requested specific ending (optional)', customPh: 'e.g. hidden ending: the ex was actually trying to help him',
      required: 'Main line and key choice points (≥4 chars each) are required before branches can be planned.',
      totalMin: 'At least 2 endings total (main + hidden + bad) are needed for real branching.',
    },
  };
  let branchPanelRenderedLang = '';
  function BRANCH_UI_DICT() { return BRANCH_UI[lang === 'en' ? 'en' : 'zh']; }
  function renderBranchPanel() {
    if (branchPanelRenderedLang === lang) return;
    const cfg = BRANCH_UI_DICT();
    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    const setPh = (id, val) => { const el = $(id); if (el) el.placeholder = val; };
    set('brHeading', cfg.heading); set('brTip', cfg.tip);
    set('brLMain', cfg.main); setPh('brMain', cfg.mainPh);
    set('brLChoice', cfg.choice); setPh('brChoice', cfg.choicePh);
    set('brLMainN', cfg.mainN); set('brLHiddenN', cfg.hiddenN); set('brLBadN', cfg.badN);
    set('brLStyle', cfg.style); fillSelectOptions('brStyle', cfg.styles, ['consequence', 'relationship', 'moral', 'mystery']);
    set('brLStakes', cfg.stakes); fillSelectOptions('brStakes', cfg.stakesOpts, ['low', 'medium', 'high']);
    set('brLCustom', cfg.custom); setPh('brCustom', cfg.customPh);
    branchPanelRenderedLang = lang;
  }
  function showBranchError(msg) {
    const box = $('brError');
    if (box) { box.textContent = msg; box.style.display = 'block'; }
    $('branchBriefPanel')?.classList.remove('hidden');
    xnSay(msg);
  }
  function hideBranchError() { const box = $('brError'); if (box) { box.textContent = ''; box.style.display = 'none'; } }
  function branchBriefPayload() {
    if (!isInteractiveType(selectedScriptType) || !$('brMain')) return {};
    const v = (id) => String($(id)?.value || '').trim();
    const mainLine = v('brMain'); const choicePoints = v('brChoice');
    if (mainLine.length < 4 || choicePoints.length < 4) { showBranchError(BRANCH_UI_DICT().required); return null; }
    const main = parseInt($('brMainN')?.value, 10) || 1;
    const hidden = parseInt($('brHiddenN')?.value, 10) || 0;
    const bad = parseInt($('brBadN')?.value, 10) || 0;
    if (main + hidden + bad < 2) { showBranchError(BRANCH_UI_DICT().totalMin); return null; }
    hideBranchError();
    return { branchBrief: {
      mainLine, choicePoints,
      endingsMain: main, endingsHidden: hidden, endingsBad: bad,
      branchStyle: $('brStyle')?.value || 'consequence',
      stakesLevel: $('brStakes')?.value || 'medium',
      customEnding: v('brCustom'),
    } };
  }
  /* ---------- v2.96 原作/小说/名场面原文：adapt/novel/hit_lab 专用，用于 n-gram 重合度侵权检测 ---------- */
  let sourceTextRenderedLang = null;
  function sourceTextUI() {
    return lang === 'en' ? {
      heading: 'Source text (for infringement check)',
      tip: 'Paste the original work you own or are licensed to adapt. The system injects it as the reference source AND runs an n-gram overlap check on the finished draft — copied passages will be flagged so you can rewrite them. Leave empty to skip the check (keyword-based warning still applies).',
      label: 'Original text (optional, ≤50,000 chars)',
      placeholder: 'Paste the original novel chapter, the source scene, or the hit drama excerpt here…',
      hint: 'The n-gram gate flags copied wording, not ideas. Borrowing the underlying method is fine; copying sentences is not.',
    } : {
      heading: '原作/原文参考（侵权检测用）',
      tip: '粘贴你自有或已授权的原作。系统会把它作为参考源注入提示词，并在成稿后跑 n-gram 重合度检测——照搬的句子会被标记出来提醒你重写。留空则跳过检测（仍会触发关键词级提醒）。',
      label: '原文（选填，≤5 万字）',
      placeholder: '粘贴小说章节、名场面原文、或爆款剧片段……',
      hint: 'n-gram 闸门只查措辞抄袭，不查创意借鉴。借底层方法可以，照抄句子不行。',
    };
  }
  function renderSourceTextPanel() {
    if (sourceTextRenderedLang === lang) return;
    const cfg = sourceTextUI();
    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    const setPh = (id, val) => { const el = $(id); if (el) el.placeholder = val; };
    set('stHeading', cfg.heading); set('stTip', cfg.tip);
    set('stLLabel', cfg.label); setPh('sourceText', cfg.placeholder);
    set('stHint', cfg.hint);
    sourceTextRenderedLang = lang;
  }
  function sourceTextPayload() {
    if (selectedMode !== 'spark') return {};
    const v = String($('sourceText')?.value || '').trim();
    if (v.length < 10) return {};
    return { sourceText: v };
  }
  let briefUploadInited = false;
  // ═══ MODULE: interview (300行, 3fn) ═══ v2.92 采访式创作会话：一轮一问 + 四维记忆空间，就绪后产出结构化简报回填
  /* ---------- v2.92 采访式创作会话：一轮一问 + 四维记忆空间，就绪后产出结构化简报回填 ---------- */
  let ivInited = false, ivSessionId = null, ivTurn = 0, ivReady = false;
  let ivOwner = null, ivEpoch = 0, ivLoaded = false, ivLoading = null, ivBusy = false, ivClosed = false, ivConverted = false;
  let ivGaps = null, ivMaterials = null, ivIdeaValue = '', ivRestoreError = false;
  // v2.319 下游闭环：ivBrief / 刷新恢复 CONVERTED 时，简报会被回填进主创意框供「生成剧本」直接使用。
  // 若用户不开新采访直接生成，主框就是简报（正常）；但若用户在采访框写新创意并开新采访，必须用新创意
  // 覆盖主框——否则 ivCollectIdea 优先读主框，新创意根本采集不到，生成会沿用上一轮简报（张冠李戴）。
  let ivBriefFilledMain = false;
  function ivT() {
    return lang === 'en' ? {
      heading: 'Interview Mode · Xiaonan asks, you answer',
      start: '🎬 Start interview (5 pts/turn)', reply: 'Reply', briefBtn: '📋 Build brief & fill in (Free)',
      ivStop: '⏹ End session',
      restart: '🎬 New interview (5 pts/turn)', restoring: 'Restoring your interview…',
      restoreFailed: 'Could not restore your interview. Reopen this panel to retry, or start a new interview.',
      answer: 'Answer in your own words…',
      answerIdea: 'Tell Xiaonan your idea right here (at least 4 characters)…',
      startWithIdea: '🎬 Start with this idea',
      hintStart: 'Write your idea in the box below, then start — Xiaonan interviews you one question at a time.',
      hintOpen: 'One question per round — materials are captured automatically.',
      round: (n) => `Round ${n}`, ready: 'Ready to draft',
      gaps: { desire: 'Desire', conflict: 'Conflict', stakes: 'Stakes', turn: 'Turn' },
      gapHead: 'Story elements: ', you: 'You', xn: '🎙️ Xiaonan',
      briefDone: 'Brief filled into the idea box — review it and hit Generate.',
      closed: 'Interview finished. Review the brief, then generate.',
      needIdea: 'Write your idea in the box below first (at least 4 characters).',
      readySay: 'Materials look solid — build the brief whenever you like.',
    } : {
      heading: '采访式创作 · 小南来采访你',
      start: '🎬 开始采访（5积分/轮）', reply: '回答并继续', briefBtn: '📋 生成创意简报并回填（免费）',
      ivStop: '⏹ 结束会话',
      restart: '🎬 新建采访（5积分/轮）', restoring: '正在恢复已保存的采访…',
      restoreFailed: '采访恢复失败。可重新打开面板重试，或主动新建采访。',
      answer: '想到哪说到哪，像聊天一样…',
      answerIdea: '把你的创意直接写在这里（至少4个字），小南就开始采访你…',
      startWithIdea: '🎬 就用这个创意开始',
      hintStart: '在下面框里写下你的创意（至少4个字），点「开始采访」——小南会一轮只问一个问题，像聊天一样帮你把设定补立体。',
      hintOpen: '一轮只问一个问题——你的素材会被自动记录归档。',
      round: (n) => `第 ${n} 轮`, ready: '素材已就绪，可以出本',
      gaps: { desire: '欲望', conflict: '冲突', stakes: '代价', turn: '转折' },
      gapHead: '戏剧四要素：', you: '你', xn: '🎙️ 小南',
      briefDone: '简报已回填到创意框，检查后点「生成剧本」即可出本。',
      closed: '采访已完成。检查简报后即可生成剧本。',
      needIdea: '先在下面这个框里写下你的创意（至少4个字），小南才好开口采访你～',
      readySay: '素材够立体了，随时可以生成简报出本～',
    };
  }
  function ivBubble(text, who) {
    const wrap = document.createElement('div');
    const T = ivT(); const xn = who === 'xn';
    wrap.style.cssText = 'max-width:92%;padding:8px 12px;border-radius:12px;line-height:1.7;' +
      (xn ? 'align-self:flex-start;background:var(--muted-bg,rgba(127,127,127,.14));'
          : 'align-self:flex-end;background:rgba(80,130,255,.16);');
    const b = document.createElement('div');
    b.style.cssText = 'opacity:.6;font-size:12px;margin-bottom:2px';
    b.textContent = xn ? T.xn : T.you;
    const p = document.createElement('div');
    p.style.whiteSpace = 'pre-wrap'; p.textContent = text;
    wrap.appendChild(b); wrap.appendChild(p);
    return wrap;
  }
  function ivRenderGaps(gaps, ready) {
    const el = $('ivGaps'); if (!el) return;
    const T = ivT();
    // @module interview
    const chip = (label, ok) => `<span style="display:inline-block;padding:2px 8px;margin:0 6px 4px 0;border-radius:999px;border:1px solid currentColor;opacity:${ok ? 1 : .45}">${ok ? '✓' : '○'} ${label}</span>`;
    el.innerHTML = T.gapHead + Object.keys(T.gaps).map((k) => chip(T.gaps[k], !!(gaps && gaps[k]))).join('')
      + (ready ? ` <b>${T.ready}</b>` : '');
  }
  function ivRenderStatus() {
    const T = ivT();
    $('ivStatus').textContent = ivLoading ? T.restoring : ivClosed ? T.closed : ivSessionId ? (ivReady ? T.ready : T.round(ivTurn)) : T.hintStart;
    $('ivHeading').textContent = T.heading;
    $('ivStartBtn').textContent = ivSessionId ? T.restart : (isStaffAcct() ? (lang === 'en' ? '🎬 Start interview · Free' : '🎬 开始采访（内部免费）') : T.start);
    // v2.317 未开会话时，内嵌输入框即创意入口：按钮文案/placeholder 随之切换，杜绝“写在A框、校验B框”
    $('ivSendBtn').textContent = ivSessionId ? T.reply : T.startWithIdea;
    $('ivBriefBtn').textContent = T.briefBtn;
    $('ivAnswer').placeholder = ivSessionId ? T.answer : T.answerIdea;
    $('ivStartBtn').classList.remove('hidden');
    // v2.320 CLOSED 也显示生成简报按钮（补转 CONVERTED）；仅 CONVERTED 终态隐藏
    $('ivBriefBtn').classList.toggle('hidden', !ivSessionId || !ivReady || ivConverted);
    $('ivStopBtn').textContent = T.ivStop; // v2.233 会话关闭入口
    $('ivStopBtn').classList.toggle('hidden', !ivSessionId || ivClosed);
    $('ivStartBtn').disabled = ivBusy;
    $('ivStopBtn').disabled = ivBusy;
    $('ivAnswer').disabled = ivBusy || ivClosed;
    $('ivSendBtn').disabled = ivBusy || ivClosed;
    $('ivBriefBtn').disabled = ivBusy;
    $('ivTip').textContent = ivRestoreError ? T.restoreFailed : ivClosed ? T.closed : ivSessionId ? T.hintOpen : T.hintStart;
    ivRenderGaps(ivGaps, ivReady);
  }
  function ivCurrentOwner() { return Api.isAuthed() ? (Api.getUser()?.id || null) : null; }
  function ivSyncOwner() {
    const owner = ivCurrentOwner();
    if (owner !== ivOwner) {
      // 登录态改变时废弃旧请求，不能让上一账号的迟到响应重新填入面板。
      ivEpoch++; ivOwner = owner;
      ivSessionId = null; ivTurn = 0; ivReady = false; ivClosed = false; ivConverted = false;
      ivLoaded = false; ivLoading = null; ivBusy = false; ivRestoreError = false;
      ivGaps = null; ivMaterials = null;
      $('ivTranscript').innerHTML = ''; $('ivAnswer').value = '';
      const idea = $('modeBrief');
      if (ivIdeaValue && idea?.value === ivIdeaValue) idea.value = '';
      ivIdeaValue = '';
      ivRenderStatus();
    }
    return owner;
  }
  function ivIsCurrent(owner, epoch) {
    return owner === ivOwner && owner === ivCurrentOwner() && epoch === ivEpoch;
  }
  function ivRestoreSession() {
    const owner = ivSyncOwner();
    if (!owner || ivLoaded || ivLoading || ivBusy) return ivLoading;
    const epoch = ivEpoch;
    ivBusy = true; ivRestoreError = false;
    // 恢复只查询服务器已持久化内容，不调用付费开场/追问，也不生成简报。
    ivLoading = (async () => {
      try {
        const res = await Api.request('/api/interview/sessions');
        const j = await Api.jsonOrThrow(res);
        if (!ivIsCurrent(owner, epoch)) return;
        const sessions = Array.isArray(j?.sessions) ? j.sessions : [];
        // v2.319 ACTIVE 优先（可继续采访）；无 ACTIVE 时恢复最近一个 CONVERTED（已转简报的终态，刷新后可回看/直接生成）
        // v2.320 再兜底 CLOSED：用户结束采访但未生成简报时，刷新不应丢弃采访记录——CLOSED 可回看 + 补生成简报
        const session = sessions.find(s => s.status === 'ACTIVE')
          || sessions.find(s => s.status === 'CONVERTED')
          || sessions.find(s => s.status === 'CLOSED')
          || null;
        ivLoaded = true;
        if (!session) return;
        const isConverted = session.status === 'CONVERTED';
        const isClosed = session.status === 'CLOSED';
        ivSessionId = session.id; ivTurn = Number(session.turnCount) || 0; ivReady = !!session.ready;
        ivGaps = session.gaps; ivMaterials = session.materials;
        // CLOSED 与 CONVERTED 都禁言（不可继续回答），但只有 CONVERTED 是终态（不可再生成简报）
        ivClosed = isConverted || isClosed;
        ivConverted = isConverted;
        const transcript = Array.isArray(session.transcript) ? session.transcript : [];
        const box = $('ivTranscript'); box.innerHTML = '';
        transcript.forEach(row => {
          if (row.q) box.appendChild(ivBubble(row.q, 'xn'));
          if (row.a) box.appendChild(ivBubble(row.a, 'me'));
        });
        if (session.question) box.appendChild(ivBubble(session.question, 'xn'));
        box.scrollTop = box.scrollHeight;
        const idea = $('modeBrief');
        if (selectedMode === 'interview' && idea && !idea.value.trim()) {
          // CONVERTED 回填服务端确定性简报（采访内容已蒸馏进简报）；ACTIVE 沿用首轮创意
          const restoreText = isConverted ? (typeof session.brief === 'string' ? session.brief : '') : (transcript[0]?.a || '');
          if (restoreText) { idea.value = restoreText; ivIdeaValue = idea.value; if (isConverted) ivBriefFilledMain = true; }
        }
      } catch (e) {
        if (ivIsCurrent(owner, epoch)) ivRestoreError = true;
      } finally {
        if (ivIsCurrent(owner, epoch)) { ivBusy = false; ivLoading = null; ivRenderStatus(); }
      }
    })();
    ivRenderStatus();
    return ivLoading;
  }
  // v2.233 结束会话：消费 POST /api/interview/sessions/:id/close（后端已有一段时间，此前无前端入口）
  async function ivClose() {
    if (!ivSessionId || ivBusy || ivClosed) return;
    ivBusy = true; ivRenderStatus();
    try {
      await Api.request(`/api/interview/sessions/${ivSessionId}/close`, { method: 'POST' });
      ivClosed = true; ivConverted = false; // CLOSED 非终态：禁回答，但保留生成简报入口（补转 CONVERTED）
    } catch (e) {
      xnSay((e && e.message) || (lang === 'en' ? 'Failed to end the session, try again later.' : '结束失败，请稍后重试'));
    }
    ivBusy = false; ivRenderStatus();
  }
  function initInterviewPanel() {
    if (!ivInited) {
      ivInited = true;
      $('ivStartBtn').onclick = ivStart;
      $('ivSendBtn').onclick = ivReply;
      $('ivBriefBtn').onclick = ivBrief;
      $('ivStopBtn').onclick = ivClose;
      $('ivAnswer').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ivReply(); } });
      // v2.319 用户手动编辑主创意框，说明不再认「采访回填的简报」，开新采访时不应被自动清空
      const _mb = $('modeBrief'); if (_mb) _mb.addEventListener('input', () => { ivBriefFilledMain = false; });
      window.addEventListener('storage', (e) => { if (!e.key || e.key === 'zn_user' || e.key === 'zn_token') initInterviewPanel(); });
    }
    const pending = ivRestoreSession();
    ivRenderStatus();
    return pending;
  }
  // v2.317 创意取数：主创意框优先，空则认采访面板内嵌框（用户视线所在即输入所在）
  function ivCollectIdea() {
    // @module interview
    const fromMain = ($('modeBrief')?.value || '').trim();
    if (fromMain) return fromMain;
    return ($('ivAnswer')?.value || '').trim();
  }
  function ivSyncIdeaToMain(idea) {
    const main = $('modeBrief');
    if (main && !main.value.trim()) { main.value = idea; ivIdeaValue = idea; }
  }
  async function ivStart() {
    const owner = ivSyncOwner();
    if (!owner) { xnSay(t('needLogin')); openAuth('login'); return; }
    if (ivBusy) return;
    // v2.319 若主框里仍是上一轮采访回填的简报（未被用户手动编辑），开新采访前清空——
    // 让 ivCollectIdea 从采访框取新创意，随后 ivSyncIdeaToMain 写回主框；
    // 用户若手动改过主框（值已异于回填简报），则保留用户输入，不清空。
    if (ivBriefFilledMain) {
      const mb = $('modeBrief');
      if (mb && mb.value === ivIdeaValue) mb.value = '';
      ivBriefFilledMain = false;
    }
    const T = ivT();
    const idea = ivCollectIdea();
    if (idea.length < 4) { xnSay(T.needIdea); $('ivAnswer')?.focus(); return; }
    ivSyncIdeaToMain(idea); // 回填主创意框，保证随后「生成剧本」读到的是同一份创意
    const epoch = ivEpoch;
    ivBusy = true; ivRenderStatus();
    try {
      const res = await Api.request('/api/interview/sessions', { method: 'POST', body: JSON.stringify({ idea, lang: lang === 'en' ? 'en' : 'zh' }) });
      const j = await Api.jsonOrThrow(res);
      if (!ivIsCurrent(owner, epoch)) return;
      ivSessionId = j.sessionId; ivTurn = j.turnCount || 1; ivReady = !!j.ready;
      ivGaps = j.gaps; ivMaterials = j.materials; ivIdeaValue = idea;
      ivLoaded = true; ivClosed = false; ivConverted = false; ivRestoreError = false;
      const box = $('ivTranscript'); box.innerHTML = '';
      box.appendChild(ivBubble(idea, 'me'));
      if (j.question) box.appendChild(ivBubble(j.question, 'xn'));
      box.scrollTop = box.scrollHeight;
      $('ivAnswer').value = '';
    } catch (e) { if (ivIsCurrent(owner, epoch)) xnSay(e.message || 'FAIL'); }
    finally { if (ivIsCurrent(owner, epoch)) { ivBusy = false; ivRenderStatus(); } }
    if (ivIsCurrent(owner, epoch) && !ivClosed) $('ivAnswer').focus();
  }
  async function ivReply() {
    const owner = ivSyncOwner();
    if (ivBusy || ivClosed) return;
    if (!ivSessionId) return ivStart();
    const T = ivT();
    const ta = $('ivAnswer'); const text = (ta.value || '').trim();
    if (!text) { ta.focus(); return; }
    const epoch = ivEpoch;
    ivBusy = true; ivRenderStatus();
    try {
      const res = await Api.request(`/api/interview/sessions/${ivSessionId}/turn`, { method: 'POST', body: JSON.stringify({ text }) });
      const j = await Api.jsonOrThrow(res);
      if (!ivIsCurrent(owner, epoch)) return;
      const box = $('ivTranscript');
      box.appendChild(ivBubble(text, 'me'));
      if (j.question) box.appendChild(ivBubble(j.question, 'xn'));
      box.scrollTop = box.scrollHeight;
      ta.value = '';
      ivTurn = j.turnCount; ivReady = !!j.ready; ivGaps = j.gaps; ivMaterials = j.materials;
      if (ivReady) xnSay(T.readySay);
    } catch (e) { if (ivIsCurrent(owner, epoch)) xnSay(e.message || 'FAIL'); }
    finally { if (ivIsCurrent(owner, epoch)) { ivBusy = false; ivRenderStatus(); } }
  }
  async function ivBrief() {
    const owner = ivSyncOwner();
    if (!ivSessionId || ivBusy || ivConverted || !ivReady) return;
    const epoch = ivEpoch;
    ivBusy = true; ivRenderStatus();
    try {
      const res = await Api.request(`/api/interview/sessions/${ivSessionId}/brief`, { method: 'POST', body: JSON.stringify({}) });
      const j = await Api.jsonOrThrow(res);
      if (!ivIsCurrent(owner, epoch)) return;
      const ta = $('modeBrief');
      if (ta) { ta.value = j.brief; ivIdeaValue = ta.value; ta.focus(); }
      ivBriefFilledMain = true; // 主框是采访回填的简报：直接生成即用，开新采访则被新创意覆盖
      ivClosed = true; ivConverted = true;
      xnSay(ivT().briefDone);
    } catch (e) { if (ivIsCurrent(owner, epoch)) xnSay(e.message || 'FAIL'); }
    finally { if (ivIsCurrent(owner, epoch)) { ivBusy = false; ivRenderStatus(); } }
  }
  function initBriefUpload() {
    if (briefUploadInited) return; const input = $('briefFile'); if (!input) return; briefUploadInited = true;
    // @module interview
    const setStatus = (s, isErr) => { const el = $('briefUploadStatus'); if (el) { el.textContent = s; el.style.color = isErr ? 'var(--danger,#d4473b)' : ''; } };
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0]; if (!file) return;
      if (file.size > 8 * 1024 * 1024) { setStatus(lang === 'en' ? 'Over 8MB' : '文件超过 8MB', true); input.value = ''; return; }
      setStatus((lang === 'en' ? 'Extracting…' : '正在提取正文…') + file.name);
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = String(reader.result || '').split(',')[1] || '';
        try {
          const res = await Api.request('/api/generate/extract-source', { method: 'POST', body: JSON.stringify({ filename: file.name, dataBase64: b64 }) });
          const j = await Api.jsonOrThrow(res);
          if (!j.text) { setStatus(j.note || (lang === 'en' ? 'No text extracted' : '未提取到文本'), true); return; }
          // v2.319 原文三模式（改编/小说/名场面）提取的正文是「被改编原作」，必须进原文框供 n-gram 版权闸门使用，
          // 绝不能混进创意 brief（那会把原作原文当成用户自己的创意喂给架构师）；其余模式仍进创意简报框。
          const isSourceMode = selectedMode === 'spark';
          const ta = isSourceMode ? $('sourceText') : $('modeBrief');
          if (ta) ta.value = j.text + (ta.value.trim() ? '\n\n' + ta.value.trim() : '');
          const ch = j.chapters && j.chapters.length ? (lang === 'en' ? `, ${j.chapters.length} chapters` : `，识别 ${j.chapters.length} 章`) : '';
          setStatus((lang === 'en' ? `Extracted ${j.chars} chars${ch}` : `已提取 ${j.chars} 字${ch}`) + (j.truncated ? (lang === 'en' ? ' (truncated)' : '（已截断）') : ''));
          if (j.note) xnSay(j.note);
        } catch (e) { setStatus(e.message || 'error', true); }
      };
      reader.onerror = () => setStatus(lang === 'en' ? 'Read failed' : '读取失败', true);
      reader.readAsDataURL(file);
    });
  }
  // ═══ MODULE: tags (238行, 6fn) ═══ 标签工作台（PRD 3.3 标签创建 + 随机标签确认页）
  /* ---------- 标签工作台（PRD 3.3 标签创建 + 随机标签确认页） ---------- */
  const TAG_MAX = 14;
  const DIM_EN = { genre: 'Genre', protagonist: 'Protagonist', hook: 'Hook', conflict: 'Conflict', emotion: 'Emotion', era: 'Era', scene: 'Scene', audience: 'Audience', track: 'Track', structure: 'Structure', format: 'Format', style: 'Style' };
  let tagChosen = [];        // 流水线面向：始终存中文标签名
  let tagDirector = null;    // 最近一次智能随机结果（含中英文简报/小南解释）
  let tagDimInited = false, tagBusy = false, tagSearchTimer = null, lastPool = [];
  let tagPoolSeq = 0; // v2.258 起：标签池共享请求序号（v2.259 维度切换/搜索/清池共用，慢响应不得覆盖新池）
    // @module tags
  // v2.329 /episodes 的 lang 只接受 zh/en（引擎提示词语言）；剧本输出语种由 bible.outputLang 另行注入
  const outLocale = () => {
    const v = $('outLang') ? $('outLang').value : '';
    if (v === 'zh' || v === 'en') return v;
    return lang === 'en' ? 'en' : 'zh';
  };
  // 剧本输出语言（10 语种），与后端 OUTPUT_LANGUAGES 对齐
  const outputLangValue = () => ($('outLang') ? $('outLang').value : '') || 'zh';
  function tagEnLabel(zh) {
    const items = tagDirector && tagDirector.english && tagDirector.english.items;
    const hit = Array.isArray(items) && items.find((x) => x.zh === zh);
    return hit && hit.en ? hit.en : zh;
  }
  function syncTagBench() {
    const bench = $('tagBench'); if (!bench) return;
    const show = selectedMode === 'tag';
    bench.classList.toggle('hidden', !show);
    if (!show) return;
    if (!tagDimInited) { initTagBench(); tagDimInited = true; }
    renderTagChosen();
    if (!tagChosen.length) smartRandomTags(true); // 进入标签模式自动给一组，做到1分钟上手
    // v2.188 主动调 openWorkbench：避免"tagBench 已是非 hidden 但 layer 未展开"边界（用户重复选 tags 模式时 Observer 不触发）
    if (typeof openWorkbench === 'function' && !_initSyncing) openWorkbench('tagBench');
  }
  function fillTagDimSel(j) {
    const sel = $('tagDim'); if (!sel) return;
    sel.innerHTML = `<option value="">${lang === 'en' ? 'Browse by dimension' : '按维度浏览'}</option>` +
      j.dimensions.map((d) => `<option value="${d.id}">${lang === 'en' ? (DIM_EN[d.id] || d.id) : d.label} · ${d.count}</option>`).join('');
  }
  let boardStatusCache = null;
  async function loadBoardStatus() {
    try {
      const s = await (await Api.request('/api/tags/board-status')).json();
      boardStatusCache = s; renderBoardStatus();
    } catch { boardStatusCache = null; }
  }
  function renderBoardStatus() {
    const el = $('tagBoardStatus'); if (!el) return;
    const s = boardStatusCache;
    if (!s) { el.textContent = ''; return; }
    if (s.active) {
      const when = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN') : '';
      el.textContent = lang === 'en'
        ? `● Live board feed (${s.count} hits, ${(s.platforms || []).slice(0, 3).join('/')}, updated ${when}) — trending directions are auto-weighted.`
        : `● 已接入${(s.platforms || []).slice(0, 3).join('、')}等在榜数据（${s.count}条，更新于${when}），昨日爆款方向已自动加权。`;
      el.classList.add('live');
    } else {
      el.textContent = lang === 'en' ? '○ No fresh live board yet — picking by market frequency + season + your profile.' : '○ 暂无保鲜期内真实榜单，当前按市场频次＋时令节点＋你的画像选片（不虚构爆款）。';
      el.classList.remove('live');
    }
  }
  function initTagBench() {
    Api.request('/api/tags/dimensions').then((r) => Api.jsonOrThrow(r)).then(fillTagDimSel)
      .catch((e) => xnSay((e && e.message) || t('tagRecommendFail')));
    loadBoardStatus();
    $('tagDim').onchange = () => { if ($('tagDim').value) loadTagLeaves($('tagDim').value); else { ++tagPoolSeq; renderTagPool([]); } };
    $('tagSearch').oninput = () => { clearTimeout(tagSearchTimer); tagSearchTimer = setTimeout(searchTagPool, 250); };
    $('tagRandomBtn').onclick = () => smartRandomTags(false);
    $('tagRerollBtn').onclick = () => smartRandomTags(false);
    $('tagRecommendBtn').onclick = () => recommendTags();
    $('tagClearBtn').onclick = () => { tagChosen = []; tagDirector = null; ++tagPoolSeq; renderTagChosen(); renderTagPool([]); $('tagWhy').classList.add('hidden'); $('tagReport').textContent = ''; xnSay(lang === 'en' ? 'Cleared.' : '已清空，可重新随机或搜索标签。'); };
    const ol = $('outLang'); if (ol) ol.addEventListener('change', () => {
      if (selectedMode === 'tag') smartRandomTags(true);
      // v2.44 输出语言变化时，策略卡（钩子/节奏/台词/情绪/人物）按新语言重载
      hookOptsLoaded = false; creationStrategiesLoaded = false;
      if ($('hookPickers')?.children.length) loadHookOptions().catch(() => {});
      // v2.50 输出语言变化时，诊断/波形面板按新语言重载
      if (!$('diagPanel')?.classList.contains('hidden') && currentProjectId) loadDiagnosis(currentProjectId).catch(() => {});
      if (!$('wavePanel')?.classList.contains('hidden') && currentProjectId) loadEmotionWave(currentProjectId).catch(() => {});
    });
  }
  function renderTagPool(list) {
    lastPool = Array.isArray(list) ? list.slice() : [];
    const pool = $('tagPool'); pool.innerHTML = '';
    if (!lastPool.length) { pool.innerHTML = `<span class="tag-pool-hint">${t('tagPickHint')}</span>`; return; }
    lastPool.forEach((name) => {
      const on = tagChosen.includes(name);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tag-pick' + (on ? ' picked' : '');
      b.textContent = outLocale() === 'en' ? tagEnLabel(name) : name;
      b.onclick = () => (on ? removeTag(name) : addTag(name));
      pool.appendChild(b);
    });
  }
  async function searchTagPool() {
    const q = $('tagSearch').value.trim();
    // v2.259：与维度切换共享 tagPoolSeq——入口即自增（空词清池也作废旧在途请求）
    const seq = ++tagPoolSeq;
    if (!q) { renderTagPool([]); return; }
    try {
      const res = await Api.request('/api/tags/search?q=' + encodeURIComponent(q) + '&limit=24');
      const j = await Api.jsonOrThrow(res);
      if (seq !== tagPoolSeq) return;
      $('tagDim').value = ''; renderTagPool((j.results || []).map((x) => x.name));
    } catch (e) {
      if (seq !== tagPoolSeq) return;
      renderTagPool([]);
      xnSay((e && e.message) || t('tagRecommendFail'));
    }
  }
  async function loadTagLeaves(dim) {
    $('tagSearch').value = '';
    // v2.258：连切维度时旧响应作废；取数纳入 jsonOrThrow 脱敏层并补 catch（原为裸 .json() 无 catch）
    // v2.259：tagLeavesSeq 升级为标签池共享 tagPoolSeq（与搜索流互斥）
    const seq = ++tagPoolSeq;
    try {
      const res = await Api.request('/api/tags/leaves?dim=' + encodeURIComponent(dim) + '&limit=40');
      const j = await Api.jsonOrThrow(res);
      if (seq !== tagPoolSeq) return;
      renderTagPool((j.leaves || []).map((x) => x.name));
    } catch (e) {
      if (seq !== tagPoolSeq) return;
      renderTagPool([]);
      xnSay((e && e.message) || t('tagRecommendFail'));
    }
  }
  function addTag(name) {
    if (tagChosen.includes(name)) return;
    if (tagChosen.length >= TAG_MAX) { xnSay(t('tagMaxWarn')); return; }
    tagChosen.push(name); renderTagChosen(); renderTagPool(lastPool); validateTagCombo();
  }
  function removeTag(name) { tagChosen = tagChosen.filter((x) => x !== name); renderTagChosen(); renderTagPool(lastPool); validateTagCombo(); }
  function renderTagChosen() {
    const box = $('tagChosen'); if (!box) return;
    box.innerHTML = '';
    $('tagCount').textContent = tagChosen.length ? `${tagChosen.length}/${TAG_MAX}` : '';
    if (!tagChosen.length) { box.innerHTML = `<span class="tag-empty">${t('tagEmpty')}</span>`; return; }
    tagChosen.forEach((name) => {
      const c = document.createElement('span'); c.className = 'tag-chip';
      const label = outLocale() === 'en' ? tagEnLabel(name) : name;
      // v2.207 移除控件键盘可达：role=button + 可聚焦 + aria-label + Enter/Space 触发
      const rmLabel = outLocale() === 'en' ? 'Remove tag' : '移除标签';
      c.innerHTML = `${escapeHtml(label)}<i role="button" tabindex="0" title="${rmLabel}" aria-label="${rmLabel}: ${escapeHtml(label)}">×</i>`;
      const x = c.querySelector('i');
      x.onclick = () => removeTag(name);
      x.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeTag(name); } };
      box.appendChild(c);
    });
  }
  async function validateTagCombo() {
    const rep = $('tagReport');
    if (!tagChosen.length) { rep.textContent = ''; rep.className = 'tag-report'; return; }
    try {
      const j = await (await Api.request('/api/tags/validate', { method: 'POST', body: JSON.stringify({ names: tagChosen }) })).json();
      if (j.ok) { rep.className = 'tag-report ok'; rep.textContent = t('tagReportOk', { n: j.completeness }); }
      else {
        rep.className = 'tag-report bad';
        rep.textContent = (j.missingRequired && j.missingRequired.length ? t('tagReportBad', { d: j.missingRequired.join(' / ') }) : '') +
          (j.errors && j.errors.length ? '；' + j.errors.join('；') : '');
      }
    } catch { /* 自检失败不阻断创作 */ }
  }
  /* ---------- c195 智能补维：/api/tags/recommend 此前前端零接线。
     按已选标签补齐缺失维度（后端排重/避互斥），结果进备选池，点选即可加入，不自动替用户决定 ---------- */
  async function recommendTags() {
    const btn = $('tagRecommendBtn');
    if (btn) btn.disabled = true;
    try {
      const room = Math.max(1, TAG_MAX - tagChosen.length);
      const j = await (await Api.request('/api/tags/recommend', {
        method: 'POST',
        body: JSON.stringify({ names: tagChosen, n: Math.min(8, room) }),
      })).json();
    // @module tags
      const names = (j.recommend || []).map((x) => x.name).filter(Boolean);
      $('tagSearch').value = ''; $('tagDim').value = '';
      renderTagPool(names);
      xnSay(names.length
        ? t('tagRecommendOk', { n: names.length })
        : t('tagRecommendNone'));
    } catch { xnSay(t('tagRecommendFail')); }
    finally { if (btn) btn.disabled = false; }
  }
  /* ---------- 本地创作画像：累积历史选标签/手法偏好，随智能随机上报（不新增数据库字段，登出也保留） ---------- */
  const PREF_KEY = 'zn_pref_tags';
  function rememberPrefTags(names) {
    names = (names || []).map((x) => String(x).trim()).filter(Boolean);
    if (!names.length) return;
    const prev = LS.g(PREF_KEY, '').split('§').filter(Boolean);
    const merged = [...names, ...prev].filter((v, i, a) => a.indexOf(v) === i).slice(0, 30); // 最近优先、去重、封顶30
    LS.s(PREF_KEY, merged.join('§'));
  }
  function loadPrefProfile() {
    const profile = {};
    // @module tags
    const me = (typeof meCache !== 'undefined') ? meCache : null;
    if (me && me.bio) profile.bio = String(me.bio).slice(0, 300); // 后端据此识别地域/性别/年龄段
    const pastTags = LS.g(PREF_KEY, '').split('§').filter(Boolean).slice(0, 12);
    if (pastTags.length) profile.pastTags = pastTags;
    if (typeof craftSelCards !== 'undefined' && Array.isArray(craftSelCards) && craftSelCards.length) profile.editPreferredTags = craftSelCards.map((c) => c.title).slice(0, 8);
    return Object.keys(profile).length ? profile : undefined;
  }
  async function smartRandomTags(silent) {
    if (tagBusy) return;
    tagBusy = true; const btn = $('tagRandomBtn'); btn.disabled = true;
    if (!silent) xnSay(t('tagRandomBusy'));
    try {
      const profile = loadPrefProfile();
      const body = { locale: outLocale(), maxTags: 8, date: new Date().toISOString() };
      if (profile) body.profile = profile; // 懂用户：地域/年龄/性别(bio) + 历史标签 + 选用手法
      const j = await (await Api.request('/api/tags/random', { method: 'POST', body: JSON.stringify(body) })).json();
      tagDirector = j; tagChosen = (j.names || []).slice();
      rememberPrefTags(tagChosen); // 用户接受这组随机即沉淀为偏好，越用越懂
      renderTagChosen(); renderTagPool([]); $('tagSearch').value = ''; $('tagDim').value = '';
      const lines = j.xiaonanLines || [];
      const why = $('tagWhy');
      why.innerHTML = `<b>${t('tagWhyTitle')}</b>` + lines.map((l) => `<p>· ${escapeHtml(l)}</p>`).join('') +
        (j.english && j.english.notes && j.english.notes.length ? `<p class="tag-en-note">${escapeHtml(j.english.notes.join('；'))}</p>` : '');
      why.classList.toggle('hidden', !lines.length);
      validateTagCombo();
      // v2.267 [P2-2b] xiaonanLines 语言跟随"剧本输出语言"(#outLang)，与界面语言相互独立；
      // EN 界面+中文输出时原文行（如"小南提醒：国庆…"）会突兀弹进英文 UI。
      // 双语言一致才弹原文；否则弹界面语言中性就绪提示，推荐理由原文仍完整展示在 tagWhy 区。
      if (lines[0]) xnSay(lang === outLocale() ? lines[0]
        : (lang === 'en' ? 'Fresh tag combo is ready — see why these tags were picked below.'
          : '新的标签组合已就绪，下方可查看推荐理由。'));
      if (typeof craftGo === 'function') craftGo().catch(() => {}); // 随机标签后自动递招，形成“懂市场→给手法”闭环
    } catch (e) {
      if (!silent) xnSay(lang === 'en' ? 'Tag service is busy, please retry.' : '标签服务开小差了，再点一次试试～');
    } finally { tagBusy = false; btn.disabled = false; }
  }
  function buildTagBrief() {
    // @module tags
    const idea = ($('tagIdea') && $('tagIdea').value || '').trim();
    // @module tags
    const craftLine = (typeof craftBriefLine === 'function') ? craftBriefLine() : '';
    const parts = [];
    if (tagChosen.length) {
      const names = outLocale() === 'en' ? tagChosen.map(tagEnLabel) : tagChosen;
      parts.push((outLocale() === 'en' ? 'Tags: ' : '标签组合：') + names.join(outLocale() === 'en' ? ', ' : '、'));
    }
    if (idea) parts.push((outLocale() === 'en' ? 'Core idea: ' : '一句话创意：') + idea);
    if (craftLine) parts.push(craftLine);
    return parts.join('\n');
  }
  function tagProjectTitle() {
    const idea = ($('tagIdea') && $('tagIdea').value || '').trim();
    if (idea) return idea.slice(0, 40);
    const names = outLocale() === 'en' ? tagChosen.map(tagEnLabel) : tagChosen;
    return names.slice(0, 3).join('·').slice(0, 40) || (lang === 'en' ? 'Untitled' : '未命名剧本');
  }

  // ═══ MODULE: xiaonan (112行, 4fn) ═══ 小南递招：方法卡 + 钩子（免费只读，选中注入出本创意）
  /* ---------- 小南递招：方法卡 + 钩子（免费只读，选中注入出本创意） ---------- */
  let craftTaxonomy = null;
  let craftSelHooks = [];   // [{id,name}]
  let craftSelCards = [];   // [{id,title}]
  let craftRecCards = [];   // 推荐方法卡（含 formula/steps）
  async function loadCraftTaxonomy() {
    if (craftTaxonomy) return craftTaxonomy;
    craftTaxonomy = await (await Api.request('/api/craft/taxonomy')).json();
    const sel = $('craftHookAdd');
    if (sel) {
      craftTaxonomy.hooks.forEach((h) => {
        const o = document.createElement('option'); o.value = h.id; o.textContent = h.name; sel.appendChild(o);
      });
      sel.onchange = () => { if (sel.value) { addCraftHook(sel.value); sel.value = ''; } };
    }
    return craftTaxonomy;
  }
  function findHook(id) { return craftTaxonomy && craftTaxonomy.hooks.find((h) => h.id === id); }
  function addCraftHook(idOrObj) {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj.id;
    if (craftSelHooks.some((h) => h.id === id)) return;
    // @module xiaonan
    const h = (typeof idOrObj === 'object' && idOrObj.name) ? idOrObj : (findHook(id) || { id, name: id });
    craftSelHooks.push({ id, name: h.name }); renderCraftHooks(); renderCraftPicked();
  }
  function removeCraftHook(id) { craftSelHooks = craftSelHooks.filter((h) => h.id !== id); renderCraftHooks(); renderCraftPicked(); }
  function toggleCraftCard(c) {
    const on = craftSelCards.some((x) => x.id === c.id);
    craftSelCards = on ? craftSelCards.filter((x) => x.id !== c.id) : [...craftSelCards, { id: c.id, title: c.title }];
    renderCraftCards(); renderCraftPicked();
  }
  function renderCraftHooks() {
    const box = $('craftHooks'); if (!box) return;
    if (!craftSelHooks.length) { box.innerHTML = `<span class="tag-empty">${lang === 'en' ? 'None yet — hit “Suggest” above.' : '点上方「按当前创意递招」获取系统默认组合'}</span>`; return; }
    box.innerHTML = '';
    craftSelHooks.forEach((h) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tag-pick picked';
      b.textContent = (outLocale() === 'en' ? craftHookEn(h.id, h.name) : h.name) + ' ×';
      b.title = (findHook(h.id) && (findHook(h.id).definition + '\n' + findHook(h.id).how)) || h.name;
      b.onclick = () => removeCraftHook(h.id); box.appendChild(b);
    });
  }
  const CRAFT_HOOK_EN = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.CRAFT_HOOK_EN) || {
    episode_hook: 'Episode-end hook', scene_hook: 'Scene hook', action_hook: 'Action hook', atmosphere_hook: 'Atmosphere (bomb)',
    dialogue_hook: 'Dialogue hook', infogap_hook: 'Info-gap bomb', countdown_hook: 'Countdown hook', anticommon_hook: 'Counter-intuitive hook',
    endure_sell_hook: 'Endure-then-revenge', chain_hook: 'Chain hook',
  };
    // @module xiaonan
  const craftHookEn = (id, zh) => CRAFT_HOOK_EN[id] || zh;
  function renderCraftCards() {
    const box = $('craftCards'); if (!box) return;
    const recIds = new Set(craftRecCards.map((c) => c.id));
    // @module xiaonan
    const cardHtml = (c, rec) => {
      const on = craftSelCards.some((x) => x.id === c.id);
      const steps = c.steps && c.steps.length ? `<details class="craft-steps"><summary>${lang === 'en' ? 'Formula & steps' : '公式与步骤'}</summary>
        <p class="craft-formula">${escapeHtml(c.formula || '')}</p><ol>${c.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol></details>`
        : `<p class="craft-formula">${escapeHtml(c.formula || '')}</p>`;
      return `<div class="craft-card ${on ? 'on' : ''} ${rec ? 'rec' : ''}" data-cid="${c.id}">
        <div class="craft-card-h"><b>${escapeHtml(c.title)}</b><span>${on ? (lang === 'en' ? 'selected ✓' : '已选 ✓') : (lang === 'en' ? 'tap to use' : '点选')}</span></div>${steps}</div>`;
    };
    let html = '';
    if (craftRecCards.length) html += `<div class="craft-group-label">${lang === 'en' ? 'Best matches for your idea' : '最贴你创意的方法'}</div><div class="craft-grid">` + craftRecCards.map((c) => cardHtml(c, true)).join('') + '</div>';
    if (craftTaxonomy) {
      html += `<details class="craft-all"><summary>${lang === 'en' ? 'Browse all 43 craft cards' : '浏览全部 43 张方法卡'}</summary>` +
        craftTaxonomy.cardGroups.map((g) => `<div class="craft-group-label">${escapeHtml(g.name)}（${g.count}）</div><div class="craft-grid">` +
          g.cards.filter((c) => !recIds.has(c.id)).map((c) => cardHtml(c, false)).join('') + '</div>').join('') + '</details>';
    }
    box.innerHTML = html || `<span class="tag-empty">${lang === 'en' ? 'Free local toolkit — hit Suggest.' : '免费本地工艺库，点「按当前创意递招」开始'}</span>`;
    box.querySelectorAll('.craft-card').forEach((el) => {
      const head = el.querySelector('.craft-card-h');
      const id = el.getAttribute('data-cid');
      if (head) head.onclick = () => {
        const c = craftRecCards.find((x) => x.id === id) || (craftTaxonomy.cardGroups.flatMap((g) => g.cards).find((x) => x.id === id));
        if (c) toggleCraftCard(c);
      };
    });
  }
  function renderCraftPicked() {
    const el = $('craftPicked'); if (!el) return;
    el.textContent = lang === 'en'
      ? `Selected ${craftSelHooks.length} hook(s) · ${craftSelCards.length} card(s) — auto-injected into the draft brief.`
      : `已选 ${craftSelHooks.length} 钩 · ${craftSelCards.length} 法，将自动注入出本创意`;
  }
  function craftBriefLine() {
    if (!craftSelHooks.length && !craftSelCards.length) return '';
    const hk = craftSelHooks.map((h) => (outLocale() === 'en' ? craftHookEn(h.id, h.name) : h.name));
    const cd = craftSelCards.map((c) => c.title);
    if (lang === 'en') return `Craft: hooks [${hk.join(', ')}]; methods [${cd.join('; ')}]`;
    return `创作手法：钩子[${hk.join('、')}]；方法[${cd.join('；')}]`;
  }
  // v2.260 递招在途锁：craftGoBtn 双击与 smartRandomTags 后程序化调用共享一把锁（推荐幂等，重入纯浪费）
  let _craftGoing = false;
  async function craftGo() {
    if (_craftGoing) return;
    _craftGoing = true;
    const loading = $('craftLoading'); loading.classList.remove('hidden');
    loading.textContent = lang === 'en' ? 'Matching craft to your idea…' : '小南正在匹配最贴的钩子与方法…';
    try {
      await loadCraftTaxonomy();
      const idea = ($('tagIdea') && $('tagIdea').value || '').trim();
      const body = { text: idea, tags: tagChosen, limit: 6 };
      const j = await (await Api.request('/api/craft/recommend', { method: 'POST', body: JSON.stringify(body) })).json();
      craftSelHooks = (j.hooks || []).map((h) => ({ id: h.id, name: h.name }));
      craftRecCards = j.cards || [];
      craftSelCards = craftRecCards.map((c) => ({ id: c.id, title: c.title }));
      renderCraftHooks(); renderCraftCards(); renderCraftPicked();
      if (j.openingAudit && j.openingAudit.advice) xnSay(j.openingAudit.advice);
    } catch (e) { xnSay(e.message || 'craft error'); } finally { loading.classList.add('hidden'); _craftGoing = false; }
  }
  const craftGoBtn = $('craftGoBtn'); if (craftGoBtn) craftGoBtn.onclick = craftGo;
  const craftCopyBtn = $('craftCopyBtn');
  if (craftCopyBtn) craftCopyBtn.onclick = () => { const t = craftBriefLine(); if (t) copy(t, lang === 'en' ? 'Craft copied' : '手法已复制，可粘贴进创意'); else xnSay(lang === 'en' ? 'Nothing selected.' : '还没选用钩子或方法卡'); };
  loadCraftTaxonomy().then(() => { renderCraftHooks(); renderCraftCards(); renderCraftPicked(); }).catch(() => {});

  // ═══ MODULE: misc (88行, 1fn) ═══ 免费合法小说素材库（多语言，只读外链）
  /* ---------- 免费合法小说素材库（多语言，只读外链） ---------- */
  const NOVEL_LANG_LABEL = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', es: 'Español', de: 'Deutsch', fr: 'Français', it: 'Italiano', ru: 'Русский', pt: 'Português', ar: 'العربية', multi: '多语' };
  const NOVEL_LIC_LABEL = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.NOVEL_LIC_LABEL) || {
    public_domain: { zh: '公版', en: 'PD' },
    cc: { zh: 'CC授权·遵协议', en: 'CC · per license' },
    platform_free: { zh: '正版免费·仅阅读', en: 'Free to read' },
  };
  let novelAll = [], novelLangs = [], novelCurLang = '', novelSearchTimer = null;
  async function loadNovelSources() {
    try {
      // v2.255：取数走 jsonOrThrow 脱敏层；失败内部兜底，不再让素材库网格永久空白
      const r = await Api.request('/api/novels');
      const j = await Api.jsonOrThrow(r);
      novelAll = j.sources || []; novelLangs = j.languages || [];
      renderNovelLangRow(); renderNovelGrid();
    } catch (e) {
      const grid = $('novelSrcGrid');
      if (grid) {
        grid.innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Failed to load sources.' : '来源加载失败'))
          + '<div class="zn-retry-row"><button type="button" class="btn-ghost novel-src-retry">' + (lang === 'en' ? 'Retry' : '重试') + '</button></div>';
        const rb = grid.querySelector('.novel-src-retry');
        if (rb) rb.onclick = () => { loadNovelSources().catch(() => {}); };
      }
    }
  }
  function renderNovelLangRow() {
    const row = $('novelLangRow'); if (!row) return;
    const all = [{ lang: '' }, ...novelLangs.map((l) => ({ lang: l }))];
    row.innerHTML = '';
    all.forEach(({ lang: l }) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip novel-lang-chip' + (novelCurLang === l ? ' on' : '');
      b.textContent = (l === '' ? (lang === 'en' ? 'All' : '全部') : (NOVEL_LANG_LABEL[l] || l));
      b.onclick = () => { novelCurLang = l; renderNovelLangRow(); renderNovelGrid(); };
      row.appendChild(b);
    });
  }
  function renderNovelGrid() {
    const grid = $('novelSrcGrid'); if (!grid) return;
    // @module misc
    const q = ($('novelSrcSearch')?.value || '').trim().toLowerCase();
    const adaptOnly = $('novelAdaptOnly')?.checked;
    let list = novelAll.slice();
    if (novelCurLang) list = list.filter((s) => s.langs.includes(novelCurLang) || s.langs.includes('multi'));
    if (adaptOnly) list = list.filter((s) => s.adapt);
    if (q) list = list.filter((s) => [s.name, s.desc, s.adaptNote, s.id].join(' ').toLowerCase().includes(q));
    if (!list.length) { grid.innerHTML = `<div class="muted">${lang === 'en' ? 'No source matches.' : '没有匹配的来源'}</div>`; return; }
    grid.innerHTML = list.map((s) => {
      const lic = NOVEL_LIC_LABEL[s.license] || { zh: s.license, en: s.license };
      const licCls = s.license === 'public_domain' ? 'lic-pd' : (s.license === 'cc' ? 'lic-cc' : 'lic-pf');
      const fmt = s.formats.map((f) => `<span class="novel-fmt">${escapeHtml(f)}</span>`).join('');
      const langs = s.langs.filter((x) => x !== 'multi').map((x) => NOVEL_LANG_LABEL[x] || x).join(' / ') || (lang === 'en' ? 'Multilingual' : '多语言');
      return `<div class="novel-card">
        <div class="novel-card-head">
          <b>${escapeHtml(s.name)}</b>
          <span class="novel-lic ${licCls}">${lang === 'en' ? lic.en : lic.zh}${s.adapt ? ' · ' + (lang === 'en' ? 'adaptable' : '可改编') : ''}</span>
        </div>
        <div class="muted novel-desc">${escapeHtml(s.desc)}</div>
        <div class="novel-meta"><span>${escapeHtml(langs)}</span>${fmt}</div>
        <div class="novel-note">${escapeHtml(s.adaptNote)}</div>
        <a class="btn-primary novel-go" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer nofollow">${lang === 'en' ? 'Open site' : '前往下载 / 阅读'} ↗</a>
      </div>`;
    }).join('');
  }
  (function initNovelBench() {
    const search = $('novelSrcSearch'), adapt = $('novelAdaptOnly');
    if (search) search.oninput = () => { clearTimeout(novelSearchTimer); novelSearchTimer = setTimeout(renderNovelGrid, 200); };
    if (adapt) adapt.onchange = renderNovelGrid;
    loadNovelSources().catch(() => {});
  })();

  /* ---------- 下拉双语 ---------- */
  const SELECT_OPTS = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.SELECT_OPTS) || {
    platform: { zh: [['红果短剧','红果短剧'],['抖音','抖音'],['快手','快手'],['ReelShort','ReelShort'],['DramaBox','DramaBox']],
      en: [['红果短剧','Hongguo'],['抖音','Douyin'],['快手','Kuaishou'],['ReelShort','ReelShort'],['DramaBox','DramaBox']] },
    engine: { zh: [['STANDARD','标准（性价比）'],['HIGH','高阶（更强组合）'],['PRO','专业（最强组合）']],
      en: [['STANDARD','Standard (balanced)'],['HIGH','High (stronger mix)'],['PRO','Pro (strongest mix)']] },
    outLang: { zh: [['zh','中文'],['en','English'],['ja','日本語'],['ko','한국어'],['es','Español'],['pt','Português'],['th','ไทย'],['id','Bahasa Indonesia'],['vi','Tiếng Việt'],['ar','العربية']],
      en: [['zh','Chinese'],['en','English'],['ja','Japanese'],['ko','Korean'],['es','Spanish'],['pt','Portuguese'],['th','Thai'],['id','Indonesian'],['vi','Vietnamese'],['ar','Arabic']] },
  };
  function renderSelects() {
    [['platform', 'platform'], ['engine', 'engine'], ['outLang', 'outLang']].forEach(([id, key]) => {
      const el = $(id); if (!el) return;
      const cur = el.value || SELECT_OPTS[key][lang][0][0];
      const my = acctRank();
      el.innerHTML = SELECT_OPTS[key][lang].map(([v, lab]) => {
        // v2.329 输出语言按会员档解锁（与后端 LANGUAGE_LOCKED 同源）
        if (id !== 'outLang' || !OUT_LANGS.length) return `<option value="${v}">${lab}</option>`;
        const meta = OUT_LANGS.find((l) => l.code === v);
        const locked = meta ? (_RANK[meta.min] ?? 0) > my : false;
        return `<option value="${v}"${locked ? ' disabled' : ''}${councilTitle('language:' + v)}>${lab}${locked ? (lang === 'en' ? ` · 🔒 ${meta.min}` : ` · 🔒 需${TIER_NAME[meta.min] || ''}会员`) : ''}</option>`;
      }).join('');
      el.value = cur;
      // 当前值被降级锁定时回落到第一个可用项（如换账号/退出后）
      if (!el.value) { const i = [...el.options].findIndex((o) => !o.disabled); if (i >= 0) el.selectedIndex = i; }
    });
  }
  // v2.329 剧本类型（9 种，按会员档解锁）；选类型会影响品牌简报/分支简报的显隐
  function renderScriptTypes() {
    const el = $('scriptTypeSel');
    if (!el) return;
    if (!SCRIPT_TYPES.length) { $('scriptTypeBar')?.classList.add('hidden'); return; }
    const my = acctRank();
    let want = SCRIPT_TYPES.some((x) => x.id === selectedScriptType) ? selectedScriptType : 'live_action_drama';
    const wantMeta = SCRIPT_TYPES.find((x) => x.id === want);
    if (wantMeta && (_RANK[wantMeta.min] ?? 0) > my) want = 'live_action_drama';
    selectedScriptType = want;
    el.innerHTML = SCRIPT_TYPES.map((x) => {
      const locked = (_RANK[x.min] ?? 0) > my;
      const name = lang === 'en' ? x.en : x.zh;
      return `<option value="${x.id}"${locked ? ' disabled' : ''}${councilTitle('scriptType:' + x.id)}>${name}${locked ? (lang === 'en' ? ` · 🔒 ${x.min}` : ` · 🔒 需${TIER_NAME[x.min] || ''}会员`) : ''}</option>`;
    }).join('');
    el.value = want;
    if (!el._znBound) {
      el._znBound = true;
      el.addEventListener('change', () => { selectedScriptType = el.value || 'live_action_drama'; syncModeBrief(); });
    }
  }

  // ═══ MODULE: xiaonan (62行, 0fn) ═══ 小南
  /* ---------- 小南 ---------- */
  function xnSay(line, tip, kind) {
    $('xnLine').textContent = line;
    const tipEl = $('xnTip');
    if (tip) { tipEl.textContent = tip; tipEl.classList.remove('hidden'); } else tipEl.classList.add('hidden');
    znToast(line, kind); // c201 用户反馈：小南台词区不够醒目，校验/扣费/错误提示容易被无视成"点了没反应"——顶部 toast 兜底可见性（v2.225 起带 kind 色条语义）
  }
  /* ---------- c201 用户反馈修复：全局轻提示 / 模态输入 / 按钮小菜单 ----------
   * 背景：多端（尤其微信内置浏览器/手机 WebView）下 window.prompt 被禁用或极不显眼，
   * 原依赖 prompt 的功能（管理员调积分/重置密码/驳回原因）表现为"点了没动作"。
   * 统一替换为自制模态；全局 toast 让所有 xnSay 提示可见。 */
  function znToast(msg, kind) {
    // v2.225 统一到 v2.186 富版体系（#toastStack 常驻）：kind 色条/关闭按钮/堆叠上限全继承，
    // 双 host（#znToastHost 动态创建）退役；签名向后兼容，旧纯文本调用点零改动
    try { toast({ kind: kind || 'info', body: msg }); } catch { /* 无 DOM 环境忽略 */ }
  }
  window.znToast = znToast; // 供独立 view（room/branch 等）复用
  /* ---------- v2.221 加载/空态统一 ----------
   * 背景：styles.css v3.0 已内置 .skeleton/.sk-list 骨架屏体系但 JS 侧零使用（死样式）；
   * 加载态散落 <div class="muted">加载中…</div>、空态 .muted/.notice 混拼，视觉语言不统一。
   * 收口：znSkeletonHtml/znSkeleton（骨架屏，列表/网格两形态）+ znEmptyHtml/znEmpty（空态：图标+文案+可选引导）。
   * window 暴露供独立 view js（room/branch/diversity 等）复用。 */
  function _znEsc(s) {
    try { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
    catch { return String(s == null ? '' : s); }
  }
  function znSkeletonHtml(kind) {
    const bar = kind === 'grid' || kind === 'cards' ? 'skeleton s-card' : 'skeleton s-line';
    const n = kind === 'grid' ? 6 : 4;
    let bars = ''; for (let i = 0; i < n; i++) bars += `<div class="${bar}"></div>`;
    return `<div class="sk-list${kind === 'grid' ? ' s-grid' : ''}" role="status" aria-busy="true">${bars}</div>`;
  }
  function znSkeleton(el, kind) {
    const host = typeof el === 'string' ? $(el) : el;
    if (host) host.innerHTML = znSkeletonHtml(kind);
  }
  function znEmptyHtml(text, hint) {
    return `<div class="zn-empty" role="status"><span class="zn-empty-ico" aria-hidden="true">◌</span>`
      + `<span class="zn-empty-txt">${_znEsc(text)}</span>`
      + (hint ? `<span class="zn-empty-hint">${_znEsc(hint)}</span>` : '') + `</div>`;
  }
  function znEmpty(el, text, hint) {
    const host = typeof el === 'string' ? $(el) : el;
    if (host) host.innerHTML = znEmptyHtml(text, hint);
  }
  // v2.223 错误态统一：与 .zn-empty 同构的 .zn-error（⚠ + 文案 + 可选细节 hint），role=alert 即时播报
  function znErrorHtml(text, hint) {
    return `<div class="zn-error" role="alert"><span class="zn-error-ico" aria-hidden="true">⚠</span>`
      + `<span class="zn-error-txt">${_znEsc(text)}</span>`
      + (hint ? `<span class="zn-error-hint">${_znEsc(hint)}</span>` : '') + `</div>`;
  }
  function znError(el, text, hint) {
    const host = typeof el === 'string' ? $(el) : el;
    if (host) host.innerHTML = znErrorHtml(text, hint);
  }
  // v2.282 错误态重试入口：复用 v2.255 .zn-retry-row 范式（loadNovelSources/eps/hook-opts 同款），
  // 供主列表错误态拼接；各调用点渲染后按注入 class 查询并绑定重新加载
  function znRetryHtml(cls) {
    return `<div class="zn-retry-row"><button type="button" class="btn-ghost ${cls}">${lang === 'en' ? 'Retry' : '重试'}</button></div>`;
  }
  window.znSkeleton = znSkeleton; window.znEmpty = znEmpty; window.znEmptyHtml = znEmptyHtml; window.znSkeletonHtml = znSkeletonHtml;
  window.znError = znError; window.znErrorHtml = znErrorHtml;
  // ═══ MODULE: ui (722行, 20fn) ═══ v2.221 加载/空态统一 
  /* ---------- v2.221 加载/空态统一 结束 ---------- */
  // v2.239 内部裸码脱敏（与 api.js v2.226 jsonOrThrow 回落层同口径）：
  // 供 body 已被 text()/json() 消费的错误路径使用（jsonOrThrow 无法再消费 body 的场景）；
  // 仅 5xx 的 INTERNAL_ERROR/SERVER_BUSY/空文本回落本地友好文案，4xx 业务码原样透传。
  function znSanitizeErr(codeOrText, status) {
    const bare = !codeOrText || codeOrText === 'INTERNAL_ERROR' || codeOrText === 'SERVER_BUSY';
    if (bare && (status == null || status >= 500)) return lang === 'en' ? 'Server hiccup — please try again later.' : '服务开小差了，请稍后重试';
    return codeOrText;
  }
  // 模态输入框：替代 window.prompt。resolve(value|null)；Enter=确定，Esc=取消
  function askText(label, def) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'zn-ask-backdrop';
      backdrop.innerHTML = `<div class="zn-ask" role="dialog" aria-modal="true">
        <div class="zn-ask-label"></div>
        <input class="zn-ask-input" type="text" />
        <div class="zn-ask-btns"><button type="button" class="btn-ghost zn-ask-cancel"></button><button type="button" class="btn-primary zn-ask-ok"></button></div>
      </div>`;
    // @module ui
      const done = (val) => { backdrop.remove(); document.removeEventListener('keydown', onKey, true); resolve(val); };
    // @module ui
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        else if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('zn-ask-input')) { e.preventDefault(); done(inp.value.trim()); }
      };
      document.addEventListener('keydown', onKey, true);
      backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) done(null); });
      backdrop.querySelector('.zn-ask-label').textContent = label || '';
      const inp = backdrop.querySelector('.zn-ask-input');
      inp.value = def != null ? String(def) : '';
      backdrop.querySelector('.zn-ask-ok').textContent = t('askOk');
      backdrop.querySelector('.zn-ask-cancel').textContent = t('askCancel');
      backdrop.querySelector('.zn-ask-ok').onclick = () => done(inp.value.trim());
      backdrop.querySelector('.zn-ask-cancel').onclick = () => done(null);
      document.body.appendChild(backdrop);
      inp.focus(); inp.select();
    });
  }
  // 按钮下方小菜单（主题/字号直接选择，替代"单击轮切"）：items=[{label,value,cur}]
  function openMiniMenu(anchorBtn, items, onPick) {
    document.querySelectorAll('.zn-mini-menu').forEach((m) => m.remove());
    const menu = document.createElement('div');
    menu.className = 'zn-mini-menu';
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = (it.cur ? '✓ ' : '') + it.label;
      if (it.cur) b.classList.add('cur');
      b.onclick = () => { menu.remove(); onPick(it.value); };
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = anchorBtn.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 6 + window.scrollY) + 'px';
    const mw = menu.offsetWidth || 140;
    let left = r.right - mw; if (left < 8) left = Math.max(8, Math.round(r.left + window.scrollX));
    menu.style.left = left + 'px';
    setTimeout(() => {
    // @module ui
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);
  }
  // 供零构建子视图（branch-view / teardown-view 等独立 IIFE）调用
  window.xnSay = xnSay;
  window.Xn = Object.assign(window.Xn || {}, { toast: (m, kind) => xnSay(m, undefined, kind) });
  window.addEventListener('zn-auth-required', () => openAuth('login'));
  // c198：编剧室 GO 决议 → 带着决议去立项。统一落到唯一免费模式 tags（标签立项），
  // 只预填卖点与集数并自动给一组标签，不自动点击生成、不扣任何积分；HOLD/NO 房在 room-view 侧不发此事件。
  window.addEventListener('zn-pitch-to-project', (ev) => {
    // @module ui
    const d = (ev && ev.detail) || {};
    switchView('studio');
    selectedMode = 'tag';
    renderModes(); syncTagBench(); syncModeBrief();
    const ideaEl = $('tagIdea');
    if (ideaEl && d.logline) ideaEl.value = String(d.logline).slice(0, 80);
    const epEl = $('episodes');
    if (epEl) epEl.value = Math.max(1, Math.min(120, parseInt(d.episodes, 10) || 20));
    if (ideaEl) { try { ideaEl.focus(); ideaEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* 无滚动环境忽略 */ } }
    xnSay(lang === 'en'
      ? 'Verdict carried into Tag mode: logline and episodes prefilled. Confirm the tags, then generate — no points charged yet.'
      : '已把决议卖点和建议集数带到标签立项：创意与集数已预填、标签已自动给一组，确认后点生成即可（尚未扣费）。');
  });
  // c200：围读修改意见 → 作品库定点改写（只读桥接，零新增扣费动作）。
  // 自动打开关联作品分集并注入“围读改写清单”，每条只预填 fix{rule,dimLabel,advice}；
  // 用户逐条二次确认后才走既有付费 /fix 链路——不自动生成、不批量连点、不接受客户端幂等号。
  window.addEventListener('zn-read-to-rewrite', async (ev) => {
    const d = (ev && ev.detail) || {};
    // c201：只有真人讨论点（无机器改写包）时桥接也要成立——讨论点是给用户看的，不该被机器包门槛挡掉
    if (!d.projectId || (!(d.packs || []).length && !(d.discussionPoints || []).length)) return;
    switchView('works');
    try {
      const res = await Api.request('/api/generate/projects');
      const list = await Api.jsonOrThrow(res);
      const p = list.find((x) => x.id === d.projectId);
      if (!p) { xnSay(lang === 'en' ? 'The linked project no longer exists.' : '关联的项目已不存在。'); return; }
      await openProject(p);
      // c201 D5：两个 await 之间用户可能点开别的作品；当前作品不是目标作品就放弃挂载，避免 A 房意见挂到 B 作品
      if (!currentWorksProject || currentWorksProject.id !== d.projectId) return;
      renderReadRewritePanel(d);
    } catch (e) {
      xnSay(lang === 'en' ? 'Could not open the linked project. You can still paste the copied fix list manually.' : '打开关联项目失败，仍可手动粘贴已复制的修改清单。');
    }
  });

  /* ---------- 视图切换（v2.186 升级：fade+slide 过渡 + nav active 指示器）---------- */
  /* v2.200：接入导航栈 + 面包屑渲染，解决平级切换无层级/无返回链问题 */
  const VIEWS = ['home', 'studio', 'toolbox', 'works', 'vip', 'square', 'market', 'admin'];
  // view → 中英 label 映射（用于面包屑显示，与 i18n 字典对齐）
  const _VIEW_LABEL = {
    home: { zh: '首页', en: 'Home' },
    studio: { zh: '创作专区', en: 'Create' },
    toolbox: { zh: '工具箱', en: 'Toolbox' },
    works: { zh: '我的作品', en: 'Works' },
    vip: { zh: '会员充值', en: 'VIP' },
    square: { zh: '交流广场', en: 'Square' },
    market: { zh: '剧本交易', en: 'Market' },
    admin: { zh: '管理后台', en: 'Admin' },
  };
  // 全局导航栈实例（来自 web/nav-stack.js，浏览器与单测共用纯函数）
    // @module ui
  const _navStack = (typeof ZnNavStack === 'object' && ZnNavStack && ZnNavStack.createNavStack)
    ? ZnNavStack.createNavStack()
    : null;
  let _switchAnimToken = 0;
  function _viewLabel(v) {
    const m = _VIEW_LABEL[v];
    if (!m) return v;
    return lang === 'en' ? m.en : m.zh;
  }
  function _renderBreadcrumb() {
    if (!_navStack) return;
    const el = $('breadcrumb');
    if (!el) return;
    _navStack.renderBreadcrumb(el, { onJump: (view) => switchView(view) });
    // 父级显示控制：根视图（仅 1 层）时隐藏面包屑条，避免首页冗余
    el.style.display = _navStack.canPop() ? '' : 'none';
  }
  function switchView(v) {
    if (!VIEWS.includes(v)) return;
    if (v !== 'studio') closeWorkbench();
    const cur = document.querySelector('.nav-item.active');
    const sameView = cur && cur.getAttribute('data-view') === v;
    if (sameView) return;
    // 旧视图淡出（不阻塞 hidden 切换，过渡结束后清理）
    const oldEl = document.querySelector('#view-home, #view-studio, #view-toolbox, #view-works, #view-vip, #view-square, #view-market, #view-admin:not(.hidden)');
    VIEWS.forEach((x) => { const el = $('view-' + x); if (el) el.classList.toggle('hidden', x !== v); });
    // nav active 指示器（保留 on 类向后兼容，新加 active）；aria-current 同步屏幕阅读器可感知激活态
    document.querySelectorAll('.nav .nav-item').forEach((b) => { b.classList.remove('active', 'on'); b.removeAttribute('aria-current'); });
    document.querySelectorAll('.nav [data-view]').forEach((b) => {
      const on = b.getAttribute('data-view') === v;
      b.classList.toggle('on', on);
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    // 新视图淡入：先 hidden 移除后强制 reflow，再加 view-in 动画类
    const newEl = $('view-' + v);
    if (newEl && !sameView) {
      const token = ++_switchAnimToken;
      newEl.classList.remove('view-in');
      // 强制 reflow 触发动画
      void newEl.offsetWidth;
      newEl.classList.add('view-in');
      setTimeout(() => { if (token === _switchAnimToken) newEl.classList.remove('view-in'); }, 360);
    }
    // v2.200 导航栈：压栈（同 view 截断避免绕回环）+ 渲染面包屑
    if (_navStack) {
      _navStack.push({ view: v, label: _viewLabel(v) });
      _renderBreadcrumb();
    }
    if (v === 'home') renderHome();
    if (v === 'works') { loadMe(); loadWorks(); }
    if (v === 'vip') loadCatalog();
    if (v === 'square') loadFeed();
    if (v === 'market') loadListings();
    if (v === 'admin') enterAdmin();
  }
  // ESC 键返回上一级（仅在栈深 > 1 时生效，避免首页 ESC 退出）
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!_navStack || !_navStack.canPop()) return;
    // 若当前焦点在 input/textarea/contenteditable，不拦截 ESC（让用户先退出输入）
    // @module ui
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable)) return;
    // 若有打开的 modal/overlay/workbench/ui 对话框，先交给它们处理（不拦截）
    const hasOverlay = document.querySelector('.modal.open, .overlay.open, .modal-mask:not(.hidden), #workbenchLayer:not(.hidden), .ui-dlg-overlay');
    if (hasOverlay) return;
    e.preventDefault();
    const popped = _navStack.pop();
    if (popped && popped.view) switchView(popped.view);
  });

  /* ---------- v2.186 全局 Toast ---------- */
  // 统一错误/成功/加载反馈；v2.205 增加堆叠上限（防错误风暴刷屏）
  let _toastSeq = 0;
  function toast(opts) {
    const stack = $('toastStack'); if (!stack) return;
    const o = typeof opts === 'string' ? { body: opts } : (opts || {});
    const id = ++_toastSeq;
    const kind = o.kind || 'info';
    const ttl = o.ttl || (kind === 'error' ? 6000 : kind === 'ok' ? 3200 : 4200);
    const node = document.createElement('div');
    node.className = 'toast t-' + kind;
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const body = document.createElement('div'); body.className = 't-body';
    if (o.title) { const b = document.createElement('b'); b.textContent = String(o.title); body.appendChild(b); }
    if (o.body)  { const p = document.createElement('span'); p.textContent = String(o.body); body.appendChild(p); }
    node.appendChild(body);
    const close = () => {
      if (node.dataset.closed) return; node.dataset.closed = '1';
      node.classList.add('toast-out');
      setTimeout(() => node.remove(), 220);
    };
    if (o.action && o.action.label && typeof o.action.fn === 'function') {
      const ab = document.createElement('button'); ab.className = 't-action';
      ab.textContent = String(o.action.label);
      ab.onclick = () => { try { o.action.fn(node); } catch {} close(); };
      node.appendChild(ab);
    }
    const cb = document.createElement('button'); cb.className = 't-close'; cb.textContent = '×'; cb.setAttribute('aria-label', _uiLangEn() ? 'Close' : '关闭');
    cb.onclick = close;
    node.appendChild(cb);
    stack.appendChild(node);
    // v2.205 堆叠上限：错误风暴/连发时最多同时展示 5 条，超出移除最旧（旧条的 close 定时器对已移除节点幂等无害）
    while (stack.children.length > 5) stack.firstElementChild.remove();
    if (ttl > 0) setTimeout(close, ttl);
    return close;
  }
  function toastError(msg, title) { return toast({ kind: 'error', title: title || (_uiLangEn() ? 'Error' : '出错'), body: msg }); }
  function toastOk(msg, title)   { return toast({ kind: 'ok',    title: title || (_uiLangEn() ? 'Done' : '成功'), body: msg }); }
  function toastInfo(msg, title) { return toast({ kind: 'info',  title: title || '', body: msg }); }
  // v2.225 window 暴露：独立 view js 也可直接复用富版便捷函数（陪伴提示仍建议走 Xn.toast）
  window.toastError = toastError; window.toastOk = toastOk; window.toastInfo = toastInfo;
  /* ---------- v2.186 全局 Toast 结束 ---------- */

  /* ---------- v2.202 通用模态对话框 ---------- */
  // 交互统一：原生 confirm/prompt 在移动端观感差、样式不可控、与 toast/modal 体系割裂。
  // uiConfirm(opts) -> Promise<boolean>；uiPrompt(opts) -> Promise<string|null>
  // 全部用 DOM API 构建（不走 HTML 字符串拼接，杜绝用户内容注入），Esc / 遮罩点击 / 按钮统一 resolve 后清理 DOM。
  function _uiLangEn() { return typeof lang === 'string' && lang === 'en'; }
  function _uiModalShell(o) {
    const overlay = document.createElement('div');
    // v2.206 标识类：供顶层 ESC 返回上一级的 hasOverlay 检测识别，避免对话框打开时 ESC 同时弹回上一视图
    overlay.className = 'ui-dlg-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = 'background:var(--bg,#fff);color:var(--fg,#222);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);padding:18px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto';
    if (o.title) {
      const h = document.createElement('h3');
      h.style.cssText = 'margin:0 0 8px;font-size:16px';
      h.textContent = String(o.title);
      modal.appendChild(h);
    }
    let bodyEl = null;
    if (o.body) {
      bodyEl = document.createElement('div');
      bodyEl.style.cssText = 'font-size:13px;line-height:1.7;margin-bottom:14px;white-space:pre-wrap;word-break:break-word';
      bodyEl.textContent = String(o.body);
      modal.appendChild(bodyEl);
    }
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ui-dlg-cancel';
    cancelBtn.textContent = String(o.cancelText || (_uiLangEn() ? 'Cancel' : '取消'));
    cancelBtn.style.cssText = 'font-size:13px;padding:8px 16px;border:1px solid var(--muted,#888);background:transparent;color:var(--fg,#222);border-radius:6px;cursor:pointer';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'ui-dlg-ok';
    okBtn.textContent = String(o.okText || (_uiLangEn() ? 'OK' : '确定'));
    okBtn.style.cssText = 'font-size:13px;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;color:#fff;background:' + (o.danger ? '#c62828' : 'var(--jade,#2e7d32)');
    row.appendChild(cancelBtn);
    row.appendChild(okBtn);
    modal.appendChild(row);
    overlay.appendChild(modal);
    return { overlay, modal, bodyEl, okBtn, cancelBtn };
  }
  function _uiReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
  }
  // v2.207 模态打开期间锁定背景滚动（计数式：对话框叠层时只归零恢复，避免提前解锁）
  function _uiModalLock() {
    // @module ui
    const n = (parseInt(document.body.dataset.uiModalLock || '0', 10) || 0) + 1;
    document.body.dataset.uiModalLock = String(n);
    document.body.style.overflow = 'hidden';
  }
  function _uiModalUnlock() {
    const n = Math.max(0, (parseInt(document.body.dataset.uiModalLock || '0', 10) || 0) - 1);
    document.body.dataset.uiModalLock = String(n);
    if (n === 0) { document.body.style.overflow = ''; delete document.body.dataset.uiModalLock; }
  }
  // 焦点圈定（WAI-ARIA dialog）：Tab 在模态内首个↔末个元素循环，Shift+Tab 反向，焦点不逃逸到背景页
  function _uiTrapTab(e, modal) {
    const items = Array.from(modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = modal.contains(active);
    if (e.shiftKey) {
      if (active === first || !inside) { e.preventDefault(); last.focus(); }
    } else if (active === last || !inside) {
      e.preventDefault(); first.focus();
    }
  }
  function uiConfirm(opts) {
    const o = typeof opts === 'string' ? { body: opts } : (opts || {});
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const { overlay, modal, okBtn, cancelBtn } = _uiModalShell(o);
      _uiModalLock();
      let closed = false;
      const close = (result) => {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', keyHandler);
        resolve(result);
        _uiModalUnlock();
        try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch {}
        // 退场淡出只作视觉余韵，不阻塞 resolve；onfinish/oncancel + 超时兜底保证 DOM 必被清理
    // @module ui
        const finish = () => { overlay.remove(); };
        if (!_uiReducedMotion() && overlay.animate) {
          const anim = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-in' });
          anim.onfinish = finish; anim.oncancel = finish;
          setTimeout(finish, 300);
        } else finish();
      };
    // @module ui
      const keyHandler = (e) => {
        if (closed) return;
        if (e.key === 'Escape') close(false);
        else if (e.key === 'Tab') _uiTrapTab(e, modal);
      };
      document.addEventListener('keydown', keyHandler);
      okBtn.onclick = () => close(true);
      cancelBtn.onclick = () => close(false);
      overlay.onclick = (e) => { if (e.target === overlay) close(false); };
      document.body.appendChild(overlay);
      if (!_uiReducedMotion() && modal.animate) {
        modal.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 150, easing: 'ease-out' });
      }
      okBtn.focus();
    });
  }
  function uiPrompt(opts) {
    const o = typeof opts === 'string' ? { value: opts } : (opts || {});
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const { overlay, modal, bodyEl, okBtn, cancelBtn } = _uiModalShell(o);
      _uiModalLock();
      const input = document.createElement('input');
      input.type = o.type || 'text';
      input.value = o.value != null ? String(o.value) : '';
      if (o.placeholder != null) input.placeholder = String(o.placeholder);
      input.style.cssText = 'width:100%;box-sizing:border-box;font-size:14px;padding:9px 10px;margin-bottom:14px;border:1px solid var(--muted,#888);border-radius:6px;background:transparent;color:var(--fg,#222);outline:none';
      if (bodyEl) bodyEl.after(input); else modal.insertBefore(input, modal.lastElementChild);
      let closed = false;
      const close = (result) => {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', keyHandler);
        resolve(result);
        _uiModalUnlock();
        try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch {}
        // 退场淡出只作视觉余韵，不阻塞 resolve；onfinish/oncancel + 超时兜底保证 DOM 必被清理
        const finish = () => { overlay.remove(); };
        if (!_uiReducedMotion() && overlay.animate) {
          const anim = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-in' });
          anim.onfinish = finish; anim.oncancel = finish;
          setTimeout(finish, 300);
        } else finish();
      };
      const keyHandler = (e) => {
        if (closed) return;
        if (e.key === 'Escape') close(null);
        else if (e.key === 'Tab') _uiTrapTab(e, modal);
      };
      document.addEventListener('keydown', keyHandler);
    // @module ui
      const submit = () => { close(input.type === 'password' ? input.value : input.value.trim()); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      okBtn.onclick = submit;
      cancelBtn.onclick = () => close(null);
      overlay.onclick = (e) => { if (e.target === overlay) close(null); };
      document.body.appendChild(overlay);
      if (!_uiReducedMotion() && modal.animate) {
        modal.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 150, easing: 'ease-out' });
      }
      input.focus();
      if (input.value && input.type !== 'password') input.select();
    });
  }
  /* ---------- v2.202 通用模态对话框 结束 ---------- */
  // v2.206 全局暴露：供独立视图文件（room-view / teardown-view / diversity-view 等）统一交互
  window.uiConfirm = uiConfirm;
  window.uiPrompt = uiPrompt;

  // v2.186 注册全局 API 钩子：AUTH_REQUIRED 自动跳登录 + 网络错误 toast + 5xx toast
  if (typeof Api !== 'undefined' && Api.onAuthRequired) {
    Api.onAuthRequired(() => {
      toastError(_uiLangEn() ? 'Session expired — please sign in again.' : '登录已过期，请重新登录', _uiLangEn() ? 'Sign in required' : '需重新登录');
      renderAuthButton();
      openAuth('login');
    });
    Api.onNetworkError((err, path) => {
      const enUi = _uiLangEn();
      const msg = err.code === 'TIMEOUT'
        ? (enUi ? 'Request timed out — check your network and retry.' : '请求超时，请检查网络后重试')
        : (enUi ? 'Network error — please retry later.' : '网络异常，请稍后重试');
      toastError(msg + (path ? '（' + path + '）' : ''), enUi ? 'Network issue' : '网络问题');
    });
    Api.onServerBusy((res, path) => {
      toastError((_uiLangEn() ? 'Server busy, retrying…' : '服务器繁忙，正在重试…') + (path ? '（' + path + '）' : ''), _uiLangEn() ? 'Server busy' : '服务繁忙');
    });
    // v2.210 跨标签页会话同步：他页登录/换号 → 提示并刷新顶栏与用户态（他页登出走上面的 onAuthRequired）
    Api.onSessionRemoteChange((snap) => {
      const name = snap && snap.user ? (snap.user.nickname || snap.user.id) : '';
      toastInfo(_uiLangEn() ? 'Signed-in account switched to "' + name + '" in another tab.' : '登录账号已在其他标签页切换为「' + name + '」', _uiLangEn() ? 'Account synced' : '账号已同步');
      renderAuthButton();
      loadMe().catch(() => {});
    });
  }
  document.querySelectorAll('.nav [data-view]').forEach((b) => b.onclick = () => switchView(b.getAttribute('data-view')));
  // v2.272 skip link：激活后把焦点（含读屏光标）真正移到 <main>——裸 hash 跳转在部分浏览器只滚动不聚焦
  document.querySelectorAll('.skip-link').forEach((a) => a.addEventListener('click', (e) => {
    // @module ui
    const id = (a.getAttribute('href') || '').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target) { e.preventDefault(); target.focus(); target.scrollIntoView({ block: 'start' }); }
  }));
  // v2.191 编剧室/递招/素材库 等独立模块：直接打开对应工作台面板
  document.querySelectorAll('.nav [data-open]').forEach((b) => b.onclick = () => {
    const id = b.getAttribute('data-open'); if (!id) return;
    // 切换 nav active 态（data-open 按钮无 data-view，手动标记）；面板非页面，aria-current 用 true 而非 page
    document.querySelectorAll('.nav .nav-item').forEach((n) => { n.classList.remove('active', 'on'); n.removeAttribute('aria-current'); });
    b.classList.add('active', 'on');
    b.setAttribute('aria-current', 'true');
    openWorkbench(id);
  });
  document.querySelectorAll('.nav [data-nav]').forEach((b) => b.onclick = () => xnSay(lang === 'en' ? 'That area is being built.' : '该板块正在建设中，敬请期待～'));

  /* v2.186 创作辅助台 chip toggle → v2.188 改为打开工作台独立板块（不再同页折叠） */
  document.querySelectorAll('.bench-toggle').forEach((b) => b.onclick = () => {
    const id = b.getAttribute('data-bench'); if (!id) return;
    const layer = $('workbenchLayer');
    if (layer && layer.dataset.current === id) closeWorkbench();
    else openWorkbench(id);
  });

  /* ---------- v2.188 工作台独立板块（全屏覆盖层）----------
     所有"展开的功能工作区"独立成板块，不再和 12 模式 grid / 5 工具卡同页堆叠。
     实现：初始化时把 16 个工作台 panel 从 #view-studio 静态转移到 #workbenchBody；
     MutationObserver 监视 panel.hidden 变化，自动开/关 layer；外部代码（syncTagBench /
     syncModeBrief / 任务流等）依旧用 classList.toggle('hidden', ...) 即可触发。 */
  const _WORKBENCH_PANEL_IDS = [
    'tagBench', 'craftBench', 'novelSrcBench',
    'branchPanel', 'branchBriefPanel', 'diversityPanel', 'roomPanel', 'teardownPanel',
    'interviewPanel', 'brandPanel', 'trendPanel', 'sourceTextPanel',
    'taskQueuePanel', 'progressPanel', 'resultPanel', 'failPanel'
  ];
  const WORKBENCH_TITLES = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.WORKBENCH_TITLES) || {
    tagBench:         { zh: '智能标签工作台',          en: 'Tag Bench' },
    craftBench:       { zh: '小南递招 · 方法卡与钩子',  en: 'Craft Cards & Hooks' },
    novelSrcBench:    { zh: '免费合法小说素材库',       en: 'Novel Sources' },
    branchPanel:      { zh: '互动分支可视化编辑器',     en: 'Branch Editor' },
    branchBriefPanel: { zh: '互动分支 · 分支简报',     en: 'Branch Brief' },
    diversityPanel:   { zh: '多版本去重体检',           en: 'Diversity Audit' },
    roomPanel:        { zh: '编剧室',                 en: 'Writers’ Room' },
    teardownPanel:    { zh: '拆爆款工作台',             en: 'Teardown' },
    interviewPanel:   { zh: '采访式创作',               en: 'Interview' },
    brandPanel:       { zh: '剧情软广 · 品牌简报',      en: 'Branded Skit' },
    trendPanel:        { zh: '热点追更 · 热点简报',      en: 'Trending' },
    sourceTextPanel:  { zh: '原作 / 原文参考',          en: 'Source Text' },
    taskQueuePanel:   { zh: '任务队列',                 en: 'Task Queue' },
    progressPanel:    { zh: '生成进度',                en: 'Generation Progress' },
    resultPanel:      { zh: '创作结果',                 en: 'Result' },
    failPanel:        { zh: '生成失败',                 en: 'Failure' },
  };
  let _workbenchInited = false;
  let _initSyncing = false; // v2.188 初始化同步守卫：applyLang 期间为 true，syncTagBench/syncModeBrief 不主动调 openWorkbench（避免 layer 自动展开覆盖 12 模式主页）
  let _workbenchHideTimer = null; // v2.188 _hideWorkbenchLayer 的 setTimeout id，_showWorkbenchLayer 内 clearTimeout，避免切换 panel 时旧 timer 异步关闭 layer
  const _workbenchPrevHidden = {}; // 记录上次 hidden 状态，只在变化时行动（避免 view-in 等无关类变化触发死循环）
  let _workbenchOpenToken = ''; // v2.266 用户显式打开令牌：openWorkbench 设令牌，Observer 消费一次即放行 view-studio 守卫（后台直达 classList 无令牌仍被拦）
  // v2.189 生成类工作台：在这些 panel 内显示"生成剧本"按钮（举一反三：tagBench/craftBench/branchBriefPanel/interviewPanel/brandPanel/trendPanel/sourceTextPanel）
  const _GENERATIVE_PANELS = new Set(['tagBench', 'craftBench', 'branchBriefPanel', 'interviewPanel', 'brandPanel', 'trendPanel', 'sourceTextPanel']);
  function _syncWorkbenchTopInset() {
    const layer = $('workbenchLayer');
    const topbar = document.querySelector('.topbar');
    if (!layer || !topbar || typeof topbar.getBoundingClientRect !== 'function') return;
    const rect = topbar.getBoundingClientRect();
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
    const isVisible = rect.bottom > 0 && (!viewportHeight || rect.top < viewportHeight);
    layer.style.setProperty('--workbench-top', `${isVisible ? Math.ceil(Math.max(0, rect.bottom) + 8) : 8}px`);
  }
  function _initWorkbenchLayer() {
    if (_workbenchInited) return; _workbenchInited = true;
    const body = $('workbenchBody'); if (!body) return;
    const topbar = document.querySelector('.topbar');
    if (topbar && typeof ResizeObserver !== 'undefined') {
      _syncWorkbenchTopInset();
      new ResizeObserver(_syncWorkbenchTopInset).observe(topbar);
    }
    if (typeof window !== 'undefined') window.addEventListener('scroll', _syncWorkbenchTopInset, { passive: true });
    // 静态转移：把工作台 panel 从 #view-studio 移到 #workbenchBody，事件绑定不丢
    _WORKBENCH_PANEL_IDS.forEach((id) => { const el = $(id); if (el) body.appendChild(el); });
    // 返回按钮
    const back = $('workbenchBack');
    if (back) back.onclick = () => closeWorkbench();
    // v2.189 工作台内"生成剧本"按钮（生成类工作台共用，调 startGenerate）
    const genBtn = $('workbenchGenBtn');
    if (genBtn) genBtn.onclick = genClickGuard(() => { if (typeof startGenerate === 'function') startGenerate(); });
    // Observer：panel.classList 中 hidden 状态变化时自动开/关 layer（其他类变化如 view-in 不触发，避免死循环）
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName !== 'class') continue;
        const el = m.target;
        if (!el.id || !_WORKBENCH_PANEL_IDS.includes(el.id)) continue;
        const layer = $('workbenchLayer'); if (!layer) continue;
        const nowHidden = el.classList.contains('hidden');
        if (_workbenchPrevHidden[el.id] === nowHidden) continue; // 状态没变，跳过
        _workbenchPrevHidden[el.id] = nowHidden;
        if (!nowHidden) {
          // v2.266 守卫下移（修复 nav 编剧室/递招/素材库断链）：令牌标识用户显式打开，直接放行；
          // 无令牌的后台直达 classList 迟到更新，创作专区不可见时不劫持作品/会员等页面（aa95653 本意保留）
          const isUserOpen = _workbenchOpenToken === el.id;
          if (isUserOpen) _workbenchOpenToken = '';
          if (layer.dataset.current === el.id) continue; // openWorkbench 同步兜底已打开
          if (!isUserOpen) {
            const studio = $('view-studio');
            if (!studio || studio.classList.contains('hidden')) { el.classList.add('hidden'); continue; }
          }
          _showWorkbenchLayer(el.id);
        }
        else if (layer.dataset.current === el.id) _hideWorkbenchLayer();
      }
    });
    _WORKBENCH_PANEL_IDS.forEach((id) => {
      const el = $(id); if (!el) return;
      _workbenchPrevHidden[id] = el.classList.contains('hidden');
      mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // 注：不主动扫描初始状态。syncTagBench/syncModeBrief 在 Observer 启动前的 toggle 不触发 layer 显示，
    // 用户主动点击 mode-card / bench-chip / tool-card 时 Observer 才捕捉到状态变化，自然展开工作台板块。
  }
  function _showWorkbenchLayer(id) {
    const layer = $('workbenchLayer'); if (!layer) return;
    const body = $('workbenchBody');
    const el = $(id); if (!el) return;
    // v2.266 view-studio 守卫已上移至 MutationObserver 回调（只拦无令牌的后台直达路径）；
    // 本函数同时服务 openWorkbench 用户显式打开，不得再拦（曾致 nav 编剧室/递招/素材库断链）。
    // Observer、入口点击和后台同步最终都会经过这里；统一保证工作台只显示目标面板。
    _WORKBENCH_PANEL_IDS.forEach((panelId) => {
      if (panelId !== id) $(panelId)?.classList.add('hidden');
    });
    // v2.188 取消 pending 的 _hideWorkbenchLayer timer（切换 panel 时旧 timer 会异步关闭 layer）
    if (_workbenchHideTimer) { clearTimeout(_workbenchHideTimer); _workbenchHideTimer = null; }
    // 把 panel 移到 body 顶部（让它在最前）
    if (body && el.parentElement !== body) body.appendChild(el);
    _syncWorkbenchTopInset();
    layer.dataset.current = id;
    layer.classList.remove('hidden');
    layer.setAttribute('aria-hidden', 'false');
    // v2.191 动态顶部留白：必须在移除 hidden 后调用（_syncTopbarOffset 内有 !hidden 守卫）
    _syncTopbarOffset();
    // 标题
    const t = WORKBENCH_TITLES[id] || {};
    const titleEl = $('workbenchTitle');
    if (titleEl) {
      const h = (lang === 'en' ? t.en : t.zh) || el.querySelector('h2,h3,.room-tabs b, [data-i="tbBrTitle"]')?.textContent || id;
      titleEl.textContent = h;
    }
    // 动画
    layer.classList.remove('view-out'); void layer.offsetWidth;
    // v2.189 生成类工作台显示"生成剧本"按钮（举一反三：所有"配置完即出本"的工作台都提供入口，避免用户返回主页找按钮）
    const genBtn = $('workbenchGenBtn');
    if (genBtn) genBtn.classList.toggle('hidden', !_GENERATIVE_PANELS.has(id));
    // ESC 键关闭 + v2.243 Tab 焦点循环（复用 modal 的 _uiTrapTab，把焦点限制在面板内）
    document.addEventListener('keydown', _workbenchEsc);
    $('xnFloat')?.classList.add('workbench-hidden');
    if (body) body.scrollTop = 0;
    // v2.243 焦点移入面板：键盘/读屏用户打开后立即可操作；焦点已在 layer 内（如面板重显）不偷焦
    try { if (!layer.contains(document.activeElement)) $('workbenchBack')?.focus(); } catch {}
  }
  // v2.191 顶部留白统一同步：topbar 换行后高度不定，同步更新 workbench / toast / 模态框的顶部偏移，
  // 避免 topbar 浮岛压住返回键、toast 压在导航上、高模态框顶部被挡
  function _syncTopbarOffset() {
    const tb = document.querySelector('.topbar');
    const tbBottom = tb ? tb.getBoundingClientRect().bottom : 78;
    const pad = Math.max(78, Math.ceil(tbBottom) + 16) + 'px';
    // 工作台
    const wl = $('workbenchLayer');
    if (wl && !wl.classList.contains('hidden')) wl.style.paddingTop = pad;
    // Toast 通知（v2.225 起 #toastStack 富版单体系接管；v2.191 该让位逻辑此前只覆盖旧 znToastHost，富版压顶缺口一并修复）
    const stack = document.getElementById('toastStack');
    if (stack) stack.style.top = Math.ceil(tbBottom) + 8 + 'px';
    // 模态框：高模态框顶部需让开 topbar
    document.querySelectorAll('.modal-mask').forEach((m) => { m.style.paddingTop = pad; });
  }
  window.addEventListener('resize', _syncTopbarOffset);
  document.addEventListener('zn-lang', _syncTopbarOffset);
  function _hideWorkbenchLayer() {
    const layer = $('workbenchLayer'); if (!layer) return;
    layer.classList.add('view-out');
    if (_workbenchHideTimer) clearTimeout(_workbenchHideTimer);
    _workbenchHideTimer = setTimeout(() => {
      layer.classList.add('hidden');
      layer.classList.remove('view-out');
      layer.setAttribute('aria-hidden', 'true');
      layer.dataset.current = '';
      $('xnFloat')?.classList.remove('workbench-hidden');
      _workbenchHideTimer = null;
      // v2.242 恢复焦点到打开前的触发元素（若仍在文档中且可聚焦）
      if (_workbenchPrevFocus) {
        try { if (document.contains(_workbenchPrevFocus) && _workbenchPrevFocus.focus) _workbenchPrevFocus.focus(); } catch {}
        _workbenchPrevFocus = null;
      }
    }, 220);
    document.removeEventListener('keydown', _workbenchEsc);
  }
  let _workbenchPrevFocus = null; // v2.242 工作台打开时存触发焦点，关闭时恢复
  function openWorkbench(id) {
    _initWorkbenchLayer();
    const layer = $('workbenchLayer');
    const el = $(id); if (!el) return;
    // 存当前焦点（打开后关闭时恢复）
    if (!_workbenchPrevFocus) _workbenchPrevFocus = document.activeElement;
    // 初始化同步和后台更新都可能留下未登记到 dataset.current 的面板。
    // 每次打开都以目标面板为唯一真源，避免工作台串页。
    _WORKBENCH_PANEL_IDS.forEach((panelId) => {
      if (panelId !== id) $(panelId)?.classList.add('hidden');
    });
    _workbenchOpenToken = id; // v2.266 用户显式打开令牌：Observer 凭令牌放行 view-studio 守卫（消费一次）
    el.classList.remove('hidden'); // 触发 Observer _showWorkbenchLayer
    // 兜底：若 Observer 没反应（如已是非 hidden）
    if (layer && !layer.dataset.current) _showWorkbenchLayer(id);
    // 令牌仅本轮有效：Promise.then 微任务排在 MutationObserver 回调之后，Observer 消费后再清除
    Promise.resolve().then(() => { if (_workbenchOpenToken === id) _workbenchOpenToken = ''; });
  }
  function closeWorkbench() {
    const layer = $('workbenchLayer'); if (!layer) return;
    // 同一轮导航可能刚打开新 panel，Observer 尚未同步 current；一并关闭待展示面板。
    _WORKBENCH_PANEL_IDS.forEach((id) => { const el = $(id); if (el) el.classList.add('hidden'); });
    _hideWorkbenchLayer();
  }
  function _workbenchEsc(e) {
    if (e.key === 'Escape') { closeWorkbench(); return; }
    // v2.243 Tab 焦点循环：复用 modal 的 _uiTrapTab，把 Tab/Shift+Tab 限制在工作台面板内
    if (e.key === 'Tab') {
      const layer = $('workbenchLayer');
      if (layer && !layer.classList.contains('hidden')) _uiTrapTab(e, layer);
    }
  }

  // 5 工具卡 → 工作台 panel（toolPitch/toolRead → 编剧室；toolTeardown → 拆爆款；toolDiversity → 去重；toolBranch → 分支）
  const _TOOL_TO_PANEL = { toolPitch: 'roomPanel', toolRead: 'roomPanel', toolTeardown: 'teardownPanel', toolDiversity: 'diversityPanel', toolBranch: 'branchPanel' };
  Object.entries(_TOOL_TO_PANEL).forEach(([tid, pid]) => {
    const t = $(tid); if (t) t.addEventListener('click', () => openWorkbench(pid));
  });
  znBindGrid($('toolboxGrid'), { selector: '.tool-card' }); // v2.271 工具箱静态卡方向键导航（卡片已由 div 改 button，原生可聚焦）
  // A3 工具箱卡片分层：卡片 → 一句话方法论提示行（幂等，先清旧再注入）
  function _applyToolboxHints() {
    if (typeof ZnToolLesson === 'undefined' || !ZnToolLesson.hintLine) return;
    Object.keys(_TOOL_TO_PANEL).forEach((cardId) => {
      const card = $(cardId); if (!card) return;
      const old = card.querySelector('.tb-hint'); if (old) old.remove();
      const html = ZnToolLesson.hintLine(cardId, lang === 'en');
      if (html) card.insertAdjacentHTML('beforeend', html);
    });
  }
  // 各 panel 的"收起"按钮 → 关工作台层
  ['roomClose', 'teardownClose', 'dvClose', 'brClose'].forEach((id) => {
    const b = $(id); if (b) b.addEventListener('click', closeWorkbench);
  });
  // 首次 DOM 就绪后初始化（含静态转移）
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { _initWorkbenchLayer(); _syncTopbarOffset(); });
  else { _initWorkbenchLayer(); _syncTopbarOffset(); }

  /* v2.54 全局快速跳转 ⌘/Ctrl+K：不找功能，搜一下就到 */
  (function wireQuickSwitcher() {
    const mask = document.createElement('div');
    mask.className = 'modal-mask hidden'; mask.id = 'qsMask';
    mask.innerHTML = `<div class="modal" style="max-width:460px">
      <input id="qsInput" class="mini-input" style="width:100%;margin-bottom:8px" placeholder="搜索页面/创作模式，回车直达（Esc 关闭）" />
      <div id="qsList" class="qs-list"></div></div>`;
    document.body.appendChild(mask);
    const input = mask.querySelector('#qsInput'), list = mask.querySelector('#qsList');
    // @module ui
    const D = () => (window.I18N ? I18N.DICT[lang] || I18N.DICT.zh : null);
    // @module ui
    const targets = () => {
      const nav = [...document.querySelectorAll('.nav [data-view]')].map((b) => ({ k: b.textContent.trim(), v: b.getAttribute('data-view') }));
      const dict = D();
      const modes = window.I18N ? I18N.MODES.map((m, i) => ({ k: (dict?.mode?.[m.id] || m.id) + ' ' + m.id, modeIndex: i })) : [];
      return [...nav, ...modes];
    };
    let cur = 0, shown = [];
    function render(q) {
      const all = targets();
      shown = q ? all.filter((t) => t.k.toLowerCase().includes(q.toLowerCase())) : all;
      cur = 0;
      list.innerHTML = shown.slice(0, 12).map((t, i) => `<div class="qs-item${i === 0 ? ' on' : ''}" data-idx="${i}">${escapeHtml(t.k)}</div>`).join('') || '<div class="muted" style="padding:8px">无匹配</div>';
      list.querySelectorAll('.qs-item').forEach((el) => el.onclick = () => pick(+el.getAttribute('data-idx')));
    }
    function pick(i) {
      const t = shown[i]; if (!t) return;
      close();
      if (t.v) switchView(t.v);
      else if (t.modeIndex != null) {
        switchView('studio');
        const card = $('modeGrid')?.children[t.modeIndex]; if (card) card.click();
      }
    }
    function open() { mask.classList.remove('hidden'); input.value = ''; render(''); setTimeout(() => input.focus(), 30); }
    function close() { mask.classList.add('hidden'); }
    mask.onclick = (e) => { if (e.target === mask) close(); };
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(cur + 1, shown.length - 1); paintActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(cur - 1, 0); paintActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(cur); }
      else if (e.key === 'Escape') close();
    });
    function paintActive() { list.querySelectorAll('.qs-item').forEach((el, i) => el.classList.toggle('on', i === cur)); }
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); mask.classList.contains('hidden') ? open() : close(); }
    });
  })();

  // ═══ MODULE: auth (145行, 0fn) ═══ 登录/注册
  /* ---------- 登录/注册 ---------- */
  let authMode = 'login';
  let privateAccountOwner, privateAccountEpoch = 0;
  function privateAccountId() {
    if (!Api.isAuthed()) return null;
    const user = Api.getUser();
    return user?.id ? String(user.id) : (user?.phone || null);
  }
  function syncPrivateAccount() {
    const owner = privateAccountId();
    if (privateAccountOwner === undefined) { privateAccountOwner = owner; return; }
    if (owner === privateAccountOwner) return;
    // v2.280 匿名→登录沉降：旧 owner 为空（本页未登录）时用户已填的创意/资料是本页主动输入、不是上个账号残留，
    // 保留输入框内容；换号（A→B 双方都有值）与登出（有值→null）仍全清，防串号/防下个使用者看到。
    const anonSignIn = !privateAccountOwner && !!owner;
    privateAccountOwner = owner;
    privateAccountEpoch++;
    resetPrivateAccountState(anonSignIn ? { keepInputs: true } : undefined);
  }
  function capturePrivateSession() {
    syncPrivateAccount();
    return { owner: privateAccountOwner, epoch: privateAccountEpoch };
  }
  function isPrivateSessionCurrent(snapshot) {
    return !!snapshot?.owner && snapshot.owner === privateAccountOwner && snapshot.epoch === privateAccountEpoch
      && snapshot.owner === privateAccountId();
  }
  // 只清当前页面与在途任务；作品和按账号保存的采访草稿仍留在原存储中。
  function resetPrivateAccountState(opts) {
    curPurchase = null; purchaseViewSeq++;
    genSessions.forEach((session) => session.abortCtrl?.abort());
    abortCtrl?.abort();
    genSessions = []; activeSessionId = null;
    progress = lastDone = abortCtrl = currentProjectId = pendingWarnings = lastFiling = null;
    currentScripts = []; currentWorksProject = currentWorksDiagnosis = null;
    lastDiagnosis = lastWave = waveProjectId = meCache = capsCache = null;
    councilHints = {}; // v2.330 账号切换清空评议理由，防串号
    castAssetsLoaded = propAssetsLoaded = sceneAssetsLoaded = false;
    dashJumpTarget = dashConflictScroll = null;
    castThinActive = propThinActive = sceneThinActive = false;
    rrFixedKeys.clear();
    clearDraftProject(); stopWaitTips();
    listenFinish(); listenBumpReqSeq();
    listenTts.data = null;
    listenSeries.list = [];
    dpPages = []; dpActive = dpEpisodeCount = 0; matData = null;
    tagChosen = [];
    ['worksGrid', 'worksCount', 'worksDetailTitle', 'epsList', 'scriptText', 'scoreGrid', 'diagBars', 'waveChart',
      'roleStrip', 'staffLog', 'taskQueue', 'aigcDash', 'dashBody', 'listenSegments', 'listenMeta', 'listenNote',
      'dpBody', 'dpSummary', 'dpTabs', 'matBody', 'matSummary', 'tagChosen', 'tagReport', 'tagWhy',
      'meAvatar', 'meNickname', 'meLevel', 'mePen', 'meBio', 'mePoints', 'meStorage', 'meInvite',
      'mineBox', 'fullText', 'fullTitle', 'fullNotice'].forEach((id) => {
      const node = $(id); if (node) node.textContent = '';
    });
    // v2.280 匿名→登录沉降（keepInputs）保留用户本页已填输入；换号/登出仍清空
    if (!opts || !opts.keepInputs) {
      ['modeBrief', 'sourceText', 'tagIdea', 'tagSearch', 'inNickname', 'inPen', 'inBio', 'inRegion', 'inAgeBand', 'inGender'].forEach((id) => {
        const node = $(id); if (node) node.value = '';
      });
    }
    ['cast', 'prop', 'scene'].forEach((family) => {
      const select = $(family + 'AssetSelect');
      if (select) select.innerHTML = `<option value="">${t(family + 'AssetNone')}</option>`;
      ['Grid', 'Conflicts', 'Edit', 'Empty'].forEach((part) => { const node = $(family + 'Lib' + part); if (node) node.textContent = ''; });
      const search = $(family + 'LibSearch'); if (search) search.value = '';
      const editor = $(family + 'LibEdit'); if (editor) editor.classList.add('hidden');
    });
    ['worksDetail', 'profileEdit', 'progressPanel', 'resultPanel', 'failPanel', 'diagPanel', 'wavePanel', 'investorPanel',
      'taskQueuePanel', 'listenModal', 'assetDashboardModal', 'castLibModal', 'propLibModal', 'sceneLibModal',
      'dpModal', 'matModal', 'dlMenu', 'tagReport', 'tagWhy', 'mineModal', 'fullModal'].forEach((id) => $(id)?.classList.add('hidden'));
    if ($('profileCard')) $('profileCard').style.display = 'none';
    if ($('worksEmpty')) {
      $('worksEmpty').textContent = t(privateAccountOwner ? 'worksEmpty' : 'needLogin');
      $('worksEmpty').classList.remove('hidden');
    }
    $('readRewritePanel')?.remove();
    closeWorkbench(); renderTaskQueue(); refreshListenBtn();
  }
  function renderAuthButton() {
    syncPrivateAccount();
    if (ivInited) initInterviewPanel();
    const btn = $('loginBtn'); if (!btn || !window.Api) return;
    const u = Api.getUser();
    if (u) {
      const lv = userRoleLabel(u);
      btn.textContent = lv + ' · ' + t('logout');
      btn.onclick = () => { Api.auth.logout(); meCache = null; capsCache = null; refreshAdminNav(); renderAuthButton(); renderModes(); renderSelects(); renderScriptTypes(); refreshListenBtn(); xnSay(lang === 'en' ? 'Signed out.' : '已退出登录'); };
    } else {
      btn.textContent = t('login');
      btn.onclick = () => openAuth('login');
    }
  }
  window.addEventListener('storage', (event) => {
    if (event.key === 'zn_user' || event.key === 'zn_token' || event.key === null) {
      renderAuthButton(); refreshAdminNav(); renderModes();
    }
  });
  function openAuth(mode) { authMode = mode || 'login'; openModal('authModal'); syncAuthTabs();
    // v2.324 环境横幅：根据端口自动显示当前服务器模式 + 对应测试账号，避免密码/端口混淆
    // 注意：Node.js 测试环境无 location，需 typeof 防御（web-workflow.test.cjs / web-modal-a11y.test.cjs 调用 openAuth 会爆 ReferenceError）
    const bar = $('authEnvBar');
    if (bar && typeof location !== 'undefined') {
      const port = location.port || (location.protocol === 'https:' ? 443 : 80);
      if (port === '8099') {
        bar.style.cssText = 'font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:12px;line-height:1.6;background:#fff8e1;color:#8a6d00;border:1px solid #f0c800';
        bar.innerHTML = '🏠 <b>演示模式</b>（内存数据，重启即清空）<br>测试账号：<b>18891995171</b> / <b>demo123456</b>';
      } else if (port === '8899') {
        bar.style.cssText = 'font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:12px;line-height:1.6;background:#e8f5e9;color:#2e7d32;border:1px solid #66bb6a';
        bar.innerHTML = '🗄️ <b>生产模式</b>（真实 Postgres 数据）<br>账号：<b>18891995171</b> / <b>yxgnono0726</b>';
      } else {
        bar.style.cssText = 'font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:12px;line-height:1.6;background:#e3f2fd;color:#1565c0;border:1px solid #42a5f5';
        bar.innerHTML = `当前端口 <b>${port || '默认'}</b>，请确认使用正确的账号密码`;
      }
    }
  }
  function closeAuth() {
    closeModalEl($('authModal'));
    $('authErr').classList.add('hidden');
    // v2.246 a11y：清除字段错误标记（用户关闭后重开时不残留无效状态）
    $('authPhone').removeAttribute('aria-invalid');
    $('authPwd').removeAttribute('aria-invalid');
  }
  function syncAuthTabs() {
    $('tabLogin').classList.toggle('on', authMode === 'login');
    $('tabRegister').classList.toggle('on', authMode === 'register');
    $('tabRegister').textContent = t('register');
    $('inviteWrap').classList.toggle('hidden', authMode !== 'register');
    $('authSubmit').textContent = authMode === 'login' ? t('login') : t('register');
  }
  function showAuthErr(msg) {
    const e = $('authErr');
    e.textContent = msg;
    e.classList.remove('hidden');
    // v2.246 a11y：字段错误关联——读屏器在输入框焦点上可听到"无效输入"并通过 aria-describedby 跟读错误

    $('authPhone').setAttribute('aria-invalid', 'true');
    $('authPwd').setAttribute('aria-invalid', 'true');
  }
  // v2.246 a11y：用户重新输入时立即解除无效标记（错误修复反馈即时化）
  $('authPhone').addEventListener('input', () => { $('authPhone').removeAttribute('aria-invalid'); });
  $('authPwd').addEventListener('input', () => { $('authPwd').removeAttribute('aria-invalid'); });
  $('tabLogin').onclick = () => { authMode = 'login'; syncAuthTabs(); };
  $('tabRegister').onclick = () => { authMode = 'register'; syncAuthTabs(); };
  $('authClose').onclick = closeAuth;
  $('authModal').onclick = (e) => { if (e.target.id === 'authModal') closeAuth(); };
  $('authSubmit').onclick = async () => {
    const phone = $('authPhone').value.trim(), pwd = $('authPwd').value, invite = $('authInvite').value.trim();
    const isPhone = /^1[3-9]\d{9}$/.test(phone);
    const isAdminAcct = /^[A-Za-z0-9_]{6,20}$/.test(phone); // 允许字母数字的管理员账号
    if (!isPhone && !isAdminAcct) return showAuthErr(t('authErrPhone'));
    // v2.227 对齐后端 v2.212 统一密码策略（8-64 位 + 必含字母和数字，仅注册校验强度），
    // 与改密/admin 开号/admin 重置三入口同口径，弱密码不再白跑后端
    if (pwd.length < 8 || !/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return showAuthErr(t('authErrPwd'));
    $('authSubmit').disabled = true;
    try {
      if (authMode === 'register') await Api.auth.register(phone, pwd, invite);
      else await Api.auth.login(phone, pwd);
      closeAuth(); renderAuthButton(); loadMe();
      if (!$('view-works').classList.contains('hidden')) loadWorks().catch((e) => { if (e.code !== 'SESSION_CHANGED') toastError(e.message); });
      xnSay(authMode === 'register' ? t('regOk') : t('loginOk'));
    } catch (e) { showAuthErr(e.message); } finally { $('authSubmit').disabled = false; }
  };

  // ═══ MODULE: works (435行, 11fn) ═══ 作品库
  /* ---------- 作品库 ---------- */
  function syncDraftProject() {
    const note = $('draftProjectNotice');
    if (note) {
      note.classList.toggle('hidden', !draftProject);
      note.innerHTML = draftProject
        ? `${lang === 'en' ? 'Continuing saved project' : '继续已保存项目'}：${escapeHtml(draftProject.title)} · ${draftProject.totalEps} ${lang === 'en' ? 'episodes' : '集'}
          <span class="muted">${lang === 'en' ? 'The project episode count, engine and format are retained.' : '沿用该项目的集数、引擎和制式，可修改下方创作简报。'}</span>
          <button type="button" class="btn-ghost" id="leaveDraftBtn">${lang === 'en' ? 'Start a new project' : '另起新项目'}</button>`
        : '';
      if (draftProject) $('leaveDraftBtn').onclick = clearDraftProject;
    }
    ['episodes', 'engine', 'scriptFormatSel'].forEach((id) => { if ($(id)) $(id).disabled = !!draftProject; });
  }
  function clearDraftProject() { draftProject = null; syncDraftProject(); }
  function resumeAdaptationProject(project) {
    if (!project?.id) return;
    const draft = project?.bible?.adaptationDraft;
    const hasAdaptBrief = !!draft?.brief;
    const hasSource = typeof project.bible?.sourceText === 'string' && project.bible.sourceText.trim().length >= 10;
    if (!hasAdaptBrief && !hasSource) return; // 不满足门槛就放弃（与作品库 canResume 对称）
    draftProject = project;
    // v2.329 改编/小说统一归灵感式·素材改编轨道
    selectedMode = 'spark'; selectedTrack = 'material_rewrite';
    selectedScriptType = project.bible?.scriptType || 'live_action_drama';
    switchView('studio'); renderModes(); renderScriptTypes(); syncTagBench(); syncModeBrief();
    $('modeBrief').value = draft?.brief || '';
    $('episodes').value = project.totalEps || 20;
    $('engine').value = project.engineTier || 'STANDARD';
    if ($('scriptFormatSel')) {
      $('scriptFormatSel').value = project.format || 'LIVE_ACTION';
      $('scriptFormatSel').dispatchEvent?.(new Event('change'));
    }
    // v2.319 承接改编/草稿恢复时回填持久化原文（bible.sourceText；旧草稿兼容 adaptationDraft.sourceText），
    // v2.322 novel 同样走这条路径（立项时 sourceText 已持久化进 bible）
    if ($('sourceText')) $('sourceText').value = project.bible?.sourceText || draft?.sourceText || '';
    syncDraftProject(); closeWorkbench();
    $('modeBrief').focus();
    xnSay(hasAdaptBrief
      ? (lang === 'en' ? 'Your adaptation brief is ready. Review it, then generate this project.' : '已恢复改编大纲，确认简报后点击「生成剧本」即可继续这个项目。')
      : (lang === 'en' ? 'Source restored. Describe this episode direction, then generate.' : '原文已回填，填写本集方向后点击「生成剧本」即可继续。'));
  }
  window.addEventListener('zn-adaptation-project', (event) => resumeAdaptationProject(event.detail?.project));
  let worksReqSeq = 0; // v2.274：作品搜索同会话请求序号，弱网乱序时旧查询响应一律作废（同 mkReqSeq/feedReqSeq 范式）
  // v2.275：作品卡片写操作（重命名/克隆/归档/删除）统一在途锁 + 提交中按钮反馈。
  // 弱网下克隆等非幂等请求在途时重复点击会创建重复副本（dogfood 第十轮实测 clone 被连发 2 次、项目 1→3）。
  // 函数级锁跨卡片/跨 loadWorks 重渲染持久（同 _sqPosting/_placingOrder 范式）；被点按钮即时 disabled 并
  // 显示「…中」文案，消除移动端弱网「没点上」的误判。prompt/confirm 思考期不占锁，确认发请求才进入。
  let _workActionBusy = false;
  async function runWorkAction(btn, busyText, task) {
    if (_workActionBusy) return;
    _workActionBusy = true;
    const oldTxt = btn.textContent, oldDisabled = btn.disabled;
    btn.disabled = true; btn.textContent = busyText;
    try { await task(); }
    finally { btn.disabled = oldDisabled; btn.textContent = oldTxt; _workActionBusy = false; }
  }
  async function loadWorks() {
    const account = capturePrivateSession();
    const seq = ++worksReqSeq; // v2.274：发请求前自增，await 回来后据此判新旧（防抖连搜/翻页乱序）
    // v2.267 [P3-1] 再点 nav「我的作品」/触发搜索即回列表态：收起可能正展开的作品详情
    $('worksDetail')?.classList.add('hidden');
    const grid = $('worksGrid'), empty = $('worksEmpty'); grid.innerHTML = '';
    const ws = $('worksSearch');
    if (ws && !ws._bound) {
      ws._bound = true;
      let t;
      ws.addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadWorks, 250); });
    }
    if (!Api.isAuthed()) { empty.innerHTML = znEmptyHtml(t('needLogin')); empty.classList.remove('hidden'); $('worksCount').textContent = ''; return; }
    // v2.278 三态补全：作品列表此前缺骨架态——进入/搜索触发后 grid 已清空、弱网下全白零反馈；
    // 与资产库三面板同范式，取数前先铺卡片网格骨架
    znSkeleton(grid, 'grid');
    const q = ($('worksSearch')?.value || '').trim();
    // v2.238 静默失败根治：此前无 try/catch，切视图入口调用点亦无 .catch——请求失败时 grid 已清空、面板全白零提示
    try {
    const res = await Api.request('/api/generate/projects' + (q ? `?q=${encodeURIComponent(q)}` : ''));
    const list = await Api.jsonOrThrow(res);
    if (!isPrivateSessionCurrent(account) || seq !== worksReqSeq) return; // v2.274：换号或旧查询晚回，均不得写 DOM
    grid.innerHTML = ''; // v2.278：清骨架后渲染真实内容
    $('worksCount').textContent = t('worksCount', { n: list.length });
    empty.classList.toggle('hidden', list.length > 0);
    if (!list.length) empty.innerHTML = znEmptyHtml(t('worksEmpty'));
    list.forEach((p) => {
      const c = document.createElement('div'); c.className = 'work-card';
      c.innerHTML = `<h3>${escapeHtml(p.title)}</h3>
        <div class="muted">${p.mode} · ${p.totalEps || 0} eps · ${PV().formatDateTime(p.createdAt, lang)}</div>
        <div class="work-badges"><span class="badge">${p.engineTier || 'STANDARD'}</span><span class="badge">${p.format || 'LIVE_ACTION'}</span></div>
        <div class="work-actions">
          <button class="chip work-action-btn" data-act="rename">${lang === 'en' ? 'Rename' : '重命名'}</button>
          <button class="chip work-action-btn" data-act="clone">${lang === 'en' ? 'Clone' : '克隆'}</button>
          <button class="chip work-action-btn" data-act="archive">${p.status === 'archived' ? (lang === 'en' ? 'Restore' : '恢复') : (lang === 'en' ? 'Archive' : '归档')}</button>
          <button class="chip work-action-btn danger" data-act="delete">${lang === 'en' ? 'Delete' : '删除'}</button>
        </div>`;
      // 合并（剧本1）：账号隔离守卫——切号后旧响应不得打开他人项目
      c.onclick = () => { if (isPrivateSessionCurrent(account)) openProject(p); };
      c.querySelectorAll('.work-action-btn').forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const act = btn.getAttribute('data-act');
          if (act === 'rename') {
    // @module works
            const newTitle = ((await uiPrompt({ body: lang === 'en' ? 'New title:' : '输入新标题：', value: p.title })) || '').trim();
            if (!newTitle || newTitle === p.title) return;
            await runWorkAction(btn, lang === 'en' ? 'Renaming…' : '重命名中…', async () => {
            try {
              const r = await Api.request(`/api/generate/projects/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
              await Api.jsonOrThrow(r);
              xnSay(lang === 'en' ? 'Renamed.' : '已重命名');
              loadWorks();
            } catch (err) { xnSay((err && err.message) || (lang === 'en' ? 'Rename failed.' : '重命名失败')); }
            });
          } else if (act === 'clone') {
            const newTitle = ((await uiPrompt({ body: lang === 'en' ? 'Title for the cloned project:' : '克隆项目的新标题：', value: `${p.title} - 副本` })) || '').trim();
            if (!newTitle) return;
            await runWorkAction(btn, lang === 'en' ? 'Cloning…' : '克隆中…', async () => {
            try {
              const r = await Api.request(`/api/generate/projects/${p.id}/clone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
              await Api.jsonOrThrow(r);
              xnSay(lang === 'en' ? 'Cloned. Open it to start a new draft.' : '克隆成功，打开新项目开始创作');
              loadWorks();
            } catch (err) { xnSay((err && err.message) || (lang === 'en' ? 'Clone failed.' : '克隆失败')); }
            });
          } else if (act === 'archive') {
            const toArchive = p.status !== 'archived';
            await runWorkAction(btn, toArchive ? (lang === 'en' ? 'Archiving…' : '归档中…') : (lang === 'en' ? 'Restoring…' : '恢复中…'), async () => {
            try {
              const r = await Api.request(`/api/generate/projects/${p.id}/archive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archive: toArchive }) });
              await Api.jsonOrThrow(r);
              xnSay(toArchive ? (lang === 'en' ? 'Archived.' : '已归档') : (lang === 'en' ? 'Restored.' : '已恢复'));
              loadWorks();
            } catch (err) { xnSay((err && err.message) || (lang === 'en' ? 'Archive failed.' : '归档失败')); }
            });
          } else if (act === 'delete') {
            if (!(await uiConfirm({ body: lang === 'en' ? `Delete "${p.title}"? This can be undone later.` : `确定删除"${p.title}"吗？（软删除，可恢复）`, danger: true, okText: lang === 'en' ? 'Delete' : '删除' }))) return;
            await runWorkAction(btn, lang === 'en' ? 'Deleting…' : '删除中…', async () => {
            try {
              const r = await Api.request(`/api/generate/projects/${p.id}`, { method: 'DELETE' });
              await Api.jsonOrThrow(r);
              xnSay(lang === 'en' ? 'Deleted.' : '已删除');
              loadWorks();
            } catch (err) { xnSay((err && err.message) || (lang === 'en' ? 'Delete failed.' : '删除失败')); }
            });
          }
        };
      });
      grid.appendChild(c);
    });
    } catch {
      if (!isPrivateSessionCurrent(account) || seq !== worksReqSeq) return; // v2.274：旧查询失败晚回也不得冲掉新查询的正确态
      grid.innerHTML = ''; // v2.278：清骨架后写错误态
      $('worksCount').textContent = '';
      empty.classList.remove('hidden');
      empty.innerHTML = znErrorHtml(t('loadFail'));
    }
  }
  // c202 版本逐行对比（零扣费、确定性）：渲染/请求/文案辅助，供作品详情与 fix 成功后自动展开
  const DIFF_LEVEL_LABEL = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.DIFF_LEVEL_LABEL) || {
    negligible: ['几乎未动', 'Barely touched'],
    light: ['局部微调', 'Light polish'],
    partial: ['局部重写', 'Partial rewrite'],
    major: ['大幅重写', 'Major rewrite'],
  };
  function rewriteSpanText(span) {
    if (!span || !span.level) return '';
    const pair = DIFF_LEVEL_LABEL[span.level] || ['', ''];
    const pct = Math.round((Number(span.changedRatio) || 0) * 100);
    return lang === 'en' ? `${pair[1]} · ~${pct}% of lines changed` : `${pair[0]} · 约${pct}%行变动`;
  }
  // c204 变更摘要卡：把后端零 token 的分类计数+亮点渲染成"小南这次改了什么"（缺 summary 的旧响应静默不出卡）
  function diffSummaryHtml(d) {
    const en = lang === 'en';
    const s = d && d.summary;
    if (!s || !s.added || !s.removed) return '';
    const keys = ['dialogue', 'scene', 'action', 'other'];
    const total = keys.reduce((acc, k) => acc + (s.added[k] || 0) + (s.removed[k] || 0), 0);
    if (!total) return '';
    // [中文标签+量词, 英文单数, 英文复数]
    const CAT = {
      dialogue: ['台词', '句', 'dialogue line', 'dialogue lines'],
      scene: ['场标', '处', 'scene header', 'scene headers'],
      action: ['动作', '行', 'action line', 'action lines'],
      other: ['技术标注', '行', 'tech line', 'tech lines'],
    };
    // @module works
    const bucketTxt = (b) => {
      const parts = [];
      for (const k of keys) {
        const n = b[k] || 0;
        if (!n) continue;
        parts.push(en ? `${n} ${n === 1 ? CAT[k][2] : CAT[k][3]}` : `${CAT[k][0]}${n}${CAT[k][1]}`);
      }
      return parts.join(en ? ', ' : '、');
    };
    const addTxt = bucketTxt(s.added), rmTxt = bucketTxt(s.removed);
    // @module works
    const hlLine = (h, type) => {
      const prefix = h.category === 'dialogue' && h.speaker ? `${escapeHtml(h.speaker)}${en ? ': ' : '：'}` : '';
      return `<div class="diff-line diff-${type}"><span class="diff-mark">${type === 'added' ? '+' : '−'}</span><span class="diff-text">${prefix}${escapeHtml(h.text)}</span></div>`;
    };
    // @module works
    const addHl = (s.highlights && s.highlights.added || []);
    // @module works
    const rmHl = (s.highlights && s.highlights.removed || []);
    // @module works
    const hl = (addHl.length + rmHl.length)
      ? `<div class="ds-hl">${addHl.map((h) => hlLine(h, 'added')).join('')}${rmHl.map((h) => hlLine(h, 'removed')).join('')}</div>`
      : '';
    return `<div class="diff-summary"><div class="ds-title">${en ? 'What changed' : '本次改写变更'}</div>
      ${addTxt ? `<div class="ds-row ds-add"><b>${en ? 'Added' : '新增'}</b> ${escapeHtml(addTxt)}</div>` : ''}
      ${rmTxt ? `<div class="ds-row ds-rm"><b>${en ? 'Removed' : '删除'}</b> ${escapeHtml(rmTxt)}</div>` : ''}${hl}</div>`;
  }
  function renderScriptDiff(box, d) {
    const enLang = lang === 'en';
    // @module works
    const rows = (d.segments || []).map((s) => {
      const mark = s.type === 'added' ? '+' : s.type === 'removed' ? '−' : ' ';
      return `<div class="diff-line diff-${s.type}"><span class="diff-mark">${mark}</span><span class="diff-text">${escapeHtml(s.text)}</span></div>`;
    }).join('');
    const st = d.stats || {};
    // c203 D5：span 缺省时不得留下孤立的“ ·”分隔符
    const spanTxt = rewriteSpanText(d.span);
    const statTxt = enLang ? `+${st.added || 0} added · −${st.removed || 0} removed` : `新增${st.added || 0}行 · 删除${st.removed || 0}行`;
    box.classList.remove('hidden');
    box.innerHTML = `<div class="diff-head"><b>v${d.from.version} → v${d.to.version}</b>
        <span class="muted">${spanTxt ? `${escapeHtml(spanTxt)} · ` : ''}${statTxt}</span>
        <button type="button" class="btn-ghost diff-close-btn" data-diff-close>${enLang ? 'Close' : '收起对比'}</button></div>
      ${diffSummaryHtml(d)}
      <div class="diff-body">${rows}</div>`;
  }
  async function openVersionDiff(projectId, epNo, fromV, toV, box0) {
    const box = box0 || document.querySelector(`[data-diff-box="ep${epNo}"]`);
    if (!box || !currentWorksProject || currentWorksProject.id !== projectId) return;
    box.classList.remove('hidden');
    box.innerHTML = `<div class="muted">${lang === 'en' ? 'Comparing versions…' : '正在对比两版…'}</div>`;
    try {
      const r = await Api.request(`/api/generate/projects/${projectId}/scripts/diff?epNo=${encodeURIComponent(epNo)}&from=${encodeURIComponent(fromV)}&to=${encodeURIComponent(toV)}`);
      const d = await Api.jsonOrThrow(r);
      // await 期间用户可能切走项目，确认还在原项目才渲染
      if (currentWorksProject && currentWorksProject.id === projectId && document.body.contains(box)) renderScriptDiff(box, d);
    } catch (e) {
      if (!document.body.contains(box)) return;
      // c203 D4：后端 O(nm) DP 行数上限——给用户可执行的出路（看最新版全文），不是干巴巴的失败
      if (e && e.error === 'SCRIPT_TOO_LARGE') {
        box.innerHTML = `<div class="notice">${lang === 'en'
          ? 'This script is too long for inline line-by-line comparison. Open the latest version to read the full text.'
          : '剧本过长，暂不支持在线逐行对比，可展开最新版查看全文。'}</div>`;
        return;
      }
      box.innerHTML = znErrorHtml(lang === 'en' ? 'Version comparison failed. Try again later.' : '版本对比失败，请稍后重试。');
    }
  }

  // v2.267 [P3-1] 作品详情返回列表：收起详情、清空分集加载态、复位当前项目并平滑滚回作品网格
  function closeWorksDetail() {
    const detail = $('worksDetail');
    if (detail) detail.classList.add('hidden');
    const epsBox = $('epsList'); if (epsBox) epsBox.innerHTML = '';
    currentWorksProject = null; currentWorksDiagnosis = null;
    const grid = $('worksGrid'); if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function openProject(p) {
    const account = capturePrivateSession();
    if (!isPrivateSessionCurrent(account)) return;
    currentWorksProject = p; currentWorksDiagnosis = null;
    // @module works
    const isCurrentProject = () => isPrivateSessionCurrent(account) && currentWorksProject?.id === p.id;
    const stalePanel = document.getElementById('readRewritePanel'); if (stalePanel) stalePanel.remove(); // c200：切作品即清围读面板，防 A 房意见挂到 B 项目
    const detail = $('worksDetail'); detail.classList.remove('hidden');
    const worksBackBtn = $('worksBackBtn'); if (worksBackBtn) worksBackBtn.onclick = () => closeWorksDetail();
    $('worksDetailTitle').textContent = p.title;
    znSkeleton('epsList');
    // v2.257：scripts 取数失败必须就地兜底——作品卡片 onclick 为 fire-and-forget 无 catch，
    // 抛错冒泡会让 epsList 永久停在骨架屏（死骨架，与死 loading 同族）。
    let eps = [];
    try {
      const res = await Api.request(`/api/generate/projects/${p.id}/scripts`);
      eps = await Api.jsonOrThrow(res);
    } catch (e) {
      if (!isCurrentProject()) return;
      $('epsList').innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Failed to load episodes.' : '分集加载失败'))
        + `<div class="zn-retry-row"><button type="button" class="btn-ghost eps-retry">${lang === 'en' ? 'Retry' : '重试'}</button></div>`;
      const retryBtn = $('epsList').querySelector('.eps-retry');
      if (retryBtn) retryBtn.onclick = () => { openProject(p).catch(() => {}); };
      return;
    }
    if (!isCurrentProject()) return;
    if (!eps.length) {
      // v2.322 novel 模式与 adapt 对称：sourceText 已立项持久化进 bible，
      // 作品库必须给"继续创作"入口，否则用户刷新页面后想生成第 2 集只能重新立项（造孤儿项目+原文重贴）
      const hasAdaptDraft = !!p.bible?.adaptationDraft?.brief;
      const hasSource = typeof p.bible?.sourceText === 'string' && p.bible.sourceText.trim().length >= 10;
      const canResume = hasAdaptDraft || hasSource;
      const resumeBtn = canResume ? `<button type="button" class="btn-primary" id="worksResumeDraft">${lang === 'en' ? 'Continue creation' : '继续创作'}</button>` : '';
      $('epsList').innerHTML = znEmptyHtml(lang === 'en' ? 'No finished episodes yet.' : '暂无成稿分集。') + resumeBtn;
      if (canResume) $('worksResumeDraft').onclick = () => resumeAdaptationProject(p);
      return;
    }
    // c202 版本分组：/fix 每改一次新增一行版本，旧逻辑把每一行都渲染成独立 EP 块，改出 v2 后页面出现两个“EP1”。
    // 现在同 epNo 只渲染一个块（默认最新版全文），历史版本折叠，并提供两版逐行对比（零扣费只读端点）。
    const groups = new Map();
    eps.forEach((s) => { if (!groups.has(s.epNo)) groups.set(s.epNo, []); groups.get(s.epNo).push(s); });
    const latestEps = [...groups.values()].map((vs) => vs[vs.length - 1]);
    const epBlocks = [...groups.entries()].map(([epNo, vs]) => {
      const latest = vs[vs.length - 1];
      const oldVers = vs.slice(0, -1);
    // @module works
      const cmpBtn = (fv, tv) => `<button class="btn-ghost ep-diff-btn" type="button" data-diff="${epNo}:${fv}:${tv}">${lang === 'en' ? `Compare v${fv} → v${tv}` : `对比 v${fv}→v${tv}`}</button>`;
      const hist = oldVers.length
        ? `<details class="ep-history"><summary>${lang === 'en' ? `Past versions (${oldVers.length})` : `历史版本（${oldVers.length}）`}</summary>${oldVers.map((v) =>
            `<div class="ep-oldver"><span>${PV().formatVersion(v.version)} · ${v.wordCount || 0} ${lang === 'en' ? 'chars' : '字'}</span>${cmpBtn(v.version, latest.version)}</div>`).join('')}</details>`
        : '';
      return `<div class="ep-item" data-ep="${epNo}"><h4>EP${epNo} · ${escapeHtml(latest.title || '')} <span class="muted">(${PV().formatVersion(latest.version)} · ${latest.wordCount || 0} ${lang === 'en' ? 'chars' : '字'})</span>${oldVers.length ? cmpBtn(oldVers[oldVers.length - 1].version, latest.version) : ''}<button class="btn-ghost ep-listen-btn" type="button" data-listen-id="${latest.id}">🎧 ${lang === 'en' ? 'Listen' : '听剧本'}</button></h4>
        <div class="muted">${escapeHtml(latest.synopsis || '')}</div><pre>${escapeHtml(latest.content || '')}</pre>${hist}
        <div class="ep-diff hidden" data-diff-box="ep${epNo}"></div></div>`;
    }).join('');
    $('epsList').innerHTML = epBlocks
      + `<div class="row-actions" style="margin-top:10px"><button class="btn-primary" id="worksDiagBtn">${lang === 'en' ? 'Full-script diagnosis' : '全本质量诊断'}</button>
         <button class="btn-ghost" id="worksListenAllBtn" style="margin-left:8px">${t('listenAll')}</button>
         <button class="btn-ghost" id="castHarvestBtn" style="margin-left:8px" title="${t('castAssetHint')}">${t('castDepositBtn')}</button>
         <button class="btn-ghost" id="propHarvestBtn" style="margin-left:8px" title="${t('propAssetHint')}">${t('propDepositBtn')}</button>
         <button class="btn-ghost" id="sceneHarvestBtn" style="margin-left:8px" title="${t('sceneAssetHint')}">${t('sceneDepositBtn')}</button></div>
         <div class="diag-panel hidden" id="castHarvestNote" style="margin-top:10px"></div>
         <div class="diag-panel hidden" id="propHarvestNote" style="margin-top:10px"></div>
         <div class="diag-panel hidden" id="sceneHarvestNote" style="margin-top:10px"></div>
         <div class="diag-panel hidden" id="worksDiag" style="margin-top:10px"></div>`;
    // c206：作品详情每集"听剧本"入口——回访老作品此前只能进创作台重生成才出现听剧本按钮，
    // 现在直接对最新成稿打开多角色有声播放器；权益不足由 openListen 的 403 分支统一弹升级引导
    $('epsList').querySelectorAll('.ep-listen-btn').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); openListen(b.getAttribute('data-listen-id')); };
    });
    // c208：整剧连播入口（片单+续听定位+自动开播）；权益不足由 openListenSeries 的 403 分支统一引导
    const listenAllBtn = $('worksListenAllBtn');
    if (listenAllBtn) listenAllBtn.onclick = () => openListenSeries(p.id);
    const wd = $('worksDiag');
    // c220 质检 chip 点击即修：创作/结构/闸门三族 chip 携带 data-qcfix（台账跨集键不挂）。
    // 委托在 wd 容器上，诊断面板 innerHTML 每次重建处理器不丢；成功后重建作品+重跑诊断，chip 按新正文刷新。
    wd.addEventListener('click', async (e) => {
      if (!isCurrentProject()) return;
      const chip = e.target.closest && e.target.closest('[data-qcfix]');
      if (!chip || !wd.contains(chip)) return;
      const ep = Number(chip.getAttribute('data-ep'));
      const rule = chip.getAttribute('data-rule') || '';
      const dim = chip.getAttribute('data-dim') || '';
      const advice = chip.getAttribute('data-advice') || '';
      if (!ep || !rule || !advice) return;
      const enLang = lang === 'en';
      const ok = await uiConfirm({ body: isStaffAcct()
        ? (enLang ? `Have Xiaonan rewrite Ep${ep} for "${dim}"? Free for staff accounts.` : `让小南针对「${dim}」重写第${ep}集？内部账户免费，是否继续？`)
        : (enLang
        ? `Have Xiaonan rewrite Ep${ep} for "${dim}"? Paid targeted polish; member discount applies; the server settles actual points.`
        : `让小南针对「${dim}」重写第${ep}集？这是付费针对性优化，会员享折扣，实际扣积分以后端结算为准。是否继续？`), okText: enLang ? 'Continue' : '继续' });
      if (!ok) return;
      chip.style.opacity = '.55'; chip.style.pointerEvents = 'none';
      try {
        const res = await Api.request(`/api/generate/projects/${p.id}/fix`, {
          method: 'POST', body: JSON.stringify({ fix: { rule, dimLabel: dim, advice }, epNo: ep }),
        });
        const txt2 = await res.text(); const d = txt2 ? JSON.parse(txt2) : {};
        if (!isCurrentProject()) return;
        if (!res.ok) throw Object.assign(new Error(d.error || 'FAIL'), { msg: d.message, httpStatus: res.status, upsell: d.upsell });
        xnSay(d.staff
          ? (enLang ? `Done — Ep${d.epNo} rewritten to v${d.newVersion}, free for staff. Refreshing QC…` : `搞定！第${d.epNo}集已出新版 v${d.newVersion}，内部账户免费。正在刷新质检…`)
          : (enLang
          ? `Done — Ep${d.epNo} rewritten to v${d.newVersion}, used ${d.pointsCharged} pts. Refreshing QC…`
          : `搞定！第${d.epNo}集已出新版 v${d.newVersion}，消耗${d.pointsCharged}积分。正在刷新质检…`));
        await refreshResultScripts(p.id).catch(() => {});
        if (!isCurrentProject()) return;
        await openProject(p);
        if (!isCurrentProject()) return;
        const btn = $('worksDiagBtn'); if (btn) btn.click();
      } catch (err) {
        if (!isCurrentProject()) return;
        chip.style.opacity = ''; chip.style.pointerEvents = '';
        if (err.message === 'AUTH_REQUIRED') { openAuth('login'); return; }
        if (err.message === 'INSUFFICIENT') xnSay(enLang ? 'Not enough points — top up to keep polishing.' : '积分不够啦，充值后小南就能继续帮你打磨～');
        else if (err.message === 'ASSISTANT_LEVEL_REQUIRED') { xnSay(err.upsell ? (enLang ? err.upsell.en : err.upsell.zh) : (enLang ? 'Upgrade to unlock this Xiaonan capability.' : '升级会员后小南才能用这项能力哦～')); setTimeout(() => typeof switchView === 'function' && switchView('vip'), 900); }
        else if (err.message === 'SANDBOX') xnSay(enLang ? 'Sandbox without model keys: nothing charged.' : '当前是无密钥沙盘，本次没扣分；配置模型后即可一键优化。');
        else if (err.message === 'MODEL_FAIL') xnSay(enLang ? 'The model did not return a result; points were refunded. Try again in a moment.' : '模型这次没给出结果，积分已自动退回，稍后再试一次～');
        else if (err.message === 'SAVE_FAILED') xnSay(enLang ? 'The new version could not be saved; points were refunded.' : '新版本保存失败，积分已自动退回，稍后再试一次～');
        else xnSay(enLang ? 'Polish did not complete; points were refunded. Try again.' : '这次优化没成功，积分已自动退回，稍后再试一次～');
      }
    });
    // v2.151 一键沉淀：项目圣经+最近成稿 → 角色资产草稿（零 token 确定性提取），沉淀后刷新立项下拉
    $('castHarvestBtn').onclick = async () => {
      if (!isCurrentProject()) return;
      const note = $('castHarvestNote');
      note.classList.remove('hidden');
      note.textContent = lang === 'en' ? 'Harvesting…' : '正在提取角色资产…';
      try {
        const rr = await Api.request(`/api/generate/character-assets/from-project/${p.id}?lang=${lang === 'en' ? 'en' : 'zh'}`, { method: 'POST' });
        const d = await Api.jsonOrThrow(rr);
        if (!isCurrentProject()) return;
        note.textContent = (d.created + d.updated) > 0 ? t('castDepositDone', { c: d.created, u: d.updated }) : t('castDepositEmpty');
        castAssetsLoaded = false; loadCastAssets(true); // 沉淀后强制刷新立项引用下拉
      } catch { if (isCurrentProject()) note.textContent = t('castDepositFail'); }
    };
    // v2.159 一键沉淀：全部分集成稿 × 信物词典 → 道具资产草稿（零 token 确定性提取），沉淀后刷新立项下拉
    $('propHarvestBtn').onclick = async () => {
      if (!isCurrentProject()) return;
      const note = $('propHarvestNote');
      note.classList.remove('hidden');
      note.textContent = lang === 'en' ? 'Harvesting…' : '正在提取道具资产…';
      try {
        const rr = await Api.request(`/api/generate/prop-assets/from-project/${p.id}?lang=${lang === 'en' ? 'en' : 'zh'}`, { method: 'POST' });
        const d = await Api.jsonOrThrow(rr);
        if (!isCurrentProject()) return;
        note.textContent = (d.created + d.updated) > 0 ? t('propDepositDone', { c: d.created, u: d.updated }) : t('propDepositEmpty');
        propAssetsLoaded = false; loadPropAssets(true); // 沉淀后强制刷新立项引用下拉
      } catch { if (isCurrentProject()) note.textContent = t('propDepositFail'); }
    };
    // v2.161 一键沉淀：全部分集成稿 × 场头解析 → 场景资产草稿（零 token 确定性提取），沉淀后刷新立项下拉
    $('sceneHarvestBtn').onclick = async () => {
      if (!isCurrentProject()) return;
      const note = $('sceneHarvestNote');
      note.classList.remove('hidden');
      note.textContent = lang === 'en' ? 'Harvesting…' : '正在提取场景资产…';
      try {
        const rr = await Api.request(`/api/generate/scene-assets/from-project/${p.id}?lang=${lang === 'en' ? 'en' : 'zh'}`, { method: 'POST' });
        const d = await Api.jsonOrThrow(rr);
        if (!isCurrentProject()) return;
        note.textContent = (d.created + d.updated) > 0 ? t('sceneDepositDone', { c: d.created, u: d.updated }) : t('sceneDepositEmpty');
        sceneAssetsLoaded = false; loadSceneAssets(true); // 沉淀后强制刷新立项引用下拉
      } catch { if (isCurrentProject()) note.textContent = t('sceneDepositFail'); }
    };
    $('worksDiagBtn').onclick = async () => {
      if (!isCurrentProject()) return;
      wd.classList.remove('hidden');
      wd.innerHTML = `<div class="diag-loading">${lang === 'en' ? 'Running full-script diagnosis…' : '正在对全本跑四套质检尺子…'}</div>`;
      try {
        const rr = await Api.request(`/api/generate/projects/${p.id}/diagnosis?lang=${strategyLocale()}`);
        const d = await Api.jsonOrThrow(rr);
        if (!isCurrentProject()) return;
        currentWorksDiagnosis = d;
        const sc = d.scorecard || {}; const { bars, fixHtml } = buildDiagnosisHtml(d);
        // c202：QC 汇总卡只统计每集最新版，否则同一集 v1/v2 重复计数
        const qcHtml = buildQcReportHtml(latestEps);
        wd.innerHTML = `<div class="diag-head"><div class="diag-total"><b style="color:${diagColor(sc.total || 0)}">${sc.total ?? '—'}</b><span>${levelTag(sc.level || '')}</span>
            <small>${lang === 'en' ? `${d.counts.episodeCount} ep` : `共${d.counts.episodeCount}集`}</small></div></div>
            <div class="diag-bars">${bars}</div><div class="diag-fixes">${fixHtml}</div>${qcHtml}`;
      } catch (e) { if (isCurrentProject()) wd.innerHTML = znErrorHtml(lang === 'en' ? 'Diagnosis failed.' : '诊断失败，请稍后重试。'); }
    };
  }

  // ═══ MODULE: profile (223行, 5fn) ═══ 个人资料卡
  /* ---------- 个人资料卡 ---------- */
  let meCache = null;
  async function loadMe() {
    const account = capturePrivateSession();
    const card = $('profileCard');
    if (!Api.isAuthed()) { card.style.display = 'none'; return; }
    card.style.display = '';
    // v2.287 loadMe 被 4 处 fire-and-forget（启动/切视图/登录/保存资料）调用，裸 reject 会冒泡
    // unhandledrejection；catch 静默早退——网络面全局 onNetworkError 已 toast，401 由 api.js 拦截器处理，资料卡保旧即可
    let me;
    try {
      const res = await Api.request('/api/auth/me'); me = await Api.jsonOrThrow(res);
    } catch { return; }
    if (!isPrivateSessionCurrent(account)) return; // 合并（剧本1）：账号隔离守卫
    meCache = me;
    const lv = userRoleLabel(me);
    $('meAvatar').textContent = (me.penName || me.nickname || '编').slice(0, 1);
    $('meNickname').textContent = me.nickname || (lang === 'en' ? 'New writer' : '编剧新人');
    $('meLevel').textContent = lv;
    $('mePen').textContent = (me.penName ? (lang === 'en' ? 'Pen: ' : '笔名：') + me.penName : t('penHint'));
    $('meBio').textContent = me.bio || '';
    $('mePoints').textContent = isStaffAcct(me)
      ? (lang === 'en' ? 'Internal account · Free' : '内部账户 · 创作免费')
      : me.points.balance + (me.points.frozen ? ` (${lang==='en'?'frozen':'冻结'} ${me.points.frozen})` : '');
    $('meStorage').textContent = fmtBytes(me.storageUsedBytes + (me.extraStorageBytes || 0));
    $('meInvite').textContent = me.inviteCode || '—';
    $('inNickname').value = me.nickname || ''; $('inPen').value = me.penName || ''; $('inBio').value = me.bio || '';
    populateProfileOptions();
    $('inRegion').value = me.region || ''; $('inAgeBand').value = me.ageBand || '';
    $('inGender').value = me.gender || ''; $('inPersonalized').checked = me.personalized !== false;
    refreshAdminNav(); renderModes(); renderHome(); renderSelects(); renderScriptTypes(); staffCostPatch(); loadCaps(); loadCastAssets(); loadPropAssets(); loadSceneAssets(); // v2.151/v2.159/v2.161 登录后预取角色/道具/场景资产清单
    loadCouncilHints(); // v2.330 登录后预取多方评议结论，锁定项 hover 可见档位理由
  }
  // v2.71 显式画像下拉（与后端 profile-mapping 白名单一致；幂等，只填充一次）
  const PF_REGIONS = ['黑龙江','吉林','辽宁','北京','天津','陕西','甘肃','宁夏','青海','新疆','河南','河北','山西','内蒙古','山东','四川','重庆','湖南','湖北','上海','江苏','浙江','安徽','广东','广西','海南','福建','台湾','云南','贵州','江西','海外','其他'];
  const PF_AGES = [['u18','ageU18'],['18-24','age1824'],['25-30','age2530'],['31-40','age3140'],['41-50','age4150'],['over50','ageOver50']];
  let _pfOptsDone = false;
  function populateProfileOptions() {
    if (_pfOptsDone) return; _pfOptsDone = true;
    const en = lang === 'en';
    // @module profile
    const opt = (v, label) => `<option value="${v}">${escapeHtml(label)}</option>`;
    $('inRegion').innerHTML = opt('', en ? 'Not set' : '不限/未填') + PF_REGIONS.map((r) => opt(r, r)).join('');
    $('inAgeBand').innerHTML = opt('', en ? 'Not set' : '不限/未填') + PF_AGES.map(([v, k]) => opt(v, t(k))).join('');
    $('inGender').innerHTML = opt('', en ? 'Not set' : '不限/未填') + opt('男', en ? 'Male' : '男') + opt('女', en ? 'Female' : '女') + opt('保密', en ? 'Prefer not to say' : '保密');
  }
  // 仅管理员显示「管理后台」入口（依据 /me 返回的 isAdmin）；super-only 进一步仅超管主账号可见（v2.318 制作中管理台）
  function refreshAdminNav() {
    const isAdm = !!(meCache && meCache.isAdmin);
    document.querySelectorAll('.admin-only').forEach((el) => el.classList.toggle('hidden', !isAdm));
    const isSuper = !!(meCache && meCache.isSuperAdmin);
    document.querySelectorAll('.super-only').forEach((el) => el.classList.toggle('hidden', !isSuper));
  }
  $('editProfileBtn').onclick = () => $('profileEdit').classList.toggle('hidden');
  $('saveProfileBtn').onclick = async () => {
    try {
      const res = await Api.request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({
        nickname: $('inNickname').value.trim(), penName: $('inPen').value.trim(), bio: $('inBio').value.trim(),
        region: $('inRegion').value, ageBand: $('inAgeBand').value, gender: $('inGender').value,
        personalized: $('inPersonalized').checked }) });
      await Api.jsonOrThrow(res); $('profileEdit').classList.add('hidden'); xnSay(t('editOk')); loadMe(); renderAuthButton();
    } catch (e) { xnSay(e.message); }
  };
  // v2.214 自助修改密码：客户端预校验与后端统一密码策略一致；成功后清会话，旧密码即刻失效，强制用新密码重新登录
  $('changePwBtn').onclick = async () => {
    const cur = $('inCurPw').value, nw = $('inNewPw').value;
    if (!cur) { xnSay(t('curPw')); return; }
    if (nw.length < 8 || !/[a-zA-Z]/.test(nw) || !/[0-9]/.test(nw)) { xnSay(t('pwClientErr')); return; }
    try {
      await Api.auth.changePassword(cur, nw);
      Api.clearSession();
      meCache = null; capsCache = null; refreshAdminNav(); renderAuthButton();
      $('inCurPw').value = ''; $('inNewPw').value = '';
      $('profileEdit').classList.add('hidden');
      xnSay(t('pwChangeOk'));
      setTimeout(() => openAuth('login'), 1000);
    } catch (e) { xnSay(e.message); }
  };
  function fmtBytes(n) { if (!n) return '0 MB'; const mb = n / (1024 * 1024); return mb >= 1 ? mb.toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB'; }

  /* ---------- 会员充值（目录只认服务端） ---------- */
  async function loadCatalog() {
    // v2.287 裸 fetch 不经 Api 层（无全局网络 hook toast）：断网 reject 既冒泡又零反馈，
    // catch 与既有非 ok 分支同走 plansGrid 就地错误态
    let res;
    try {
      res = await fetch('/api/order/catalog');
    } catch { znError('plansGrid', t('loadFail')); return; }
    if (!res.ok) { znError('plansGrid', t('loadFail')); return; }
    const cat = await res.json().catch(() => null);
    if (!cat || !Array.isArray(cat.plans)) { znError('plansGrid', t('loadFail')); return; }
    const paymentUnavailable = cat.paymentAvailable === false;
    const disabled = paymentUnavailable ? ' disabled' : '';
    const purchaseLabel = paymentUnavailable ? (lang === 'en' ? 'Online payment unavailable' : '在线支付暂未开通') : t('subscribe');
    const paymentNotice = $('paymentNotice');
    if (paymentNotice) {
      paymentNotice.classList.toggle('hidden', !paymentUnavailable);
      paymentNotice.textContent = lang === 'en' ? 'Online payment is not available yet. Contact the administrator for credits or membership.' : '在线支付暂未开通，请联系管理员处理充值或会员开通。';
    }
    // @module profile
    const lvName = (lv) => (lang === 'en' ? LEVEL_EN : LEVEL_ZH)[lv] || lv;
    const cur = Api.getUser()?.level;
    $('plansGrid').innerHTML = cat.plans.map((p) => {
      const monthSku = p.level === 'BASIC' ? 'BASIC_M' : p.level === 'ADVANCED' ? 'ADVANCED_M' : p.level === 'PRO' ? 'PRO_M' : null;
      const yearSku = p.level === 'BASIC' ? 'BASIC_Y' : p.level === 'ADVANCED' ? 'ADVANCED_Y' : p.level === 'PRO' ? 'PRO_Y' : null;
      const yearItem = cat.items.find((i) => i.sku === yearSku);
      const price = p.monthlyFen ? (p.monthlyFen / 100) : 0;
      const perks = [];
      if (p.freeEpsPerDay) perks.push(lang==='en'?`${p.freeEpsPerDay} free eps/day`:`每日免费 ${p.freeEpsPerDay} 集`);
      if (p.quotaMonthly) perks.push((lang==='en'?'Monthly gift ':'每月赠 ')+p.quotaMonthly+(lang==='en'?' eps (economy)':' 集（经济档）'));
      if (p.overagePerEp) perks.push(`${t('perEp')} ${(p.overagePerEp / 10).toFixed(1)}`);
      // 引擎档/模式/项目数等显性权益，拉开档位差距、诱导升级
    // @module profile
      const engN = (p.engines || []).length;
      if (engN) perks.push(lang==='en'?`${engN} engine tiers`:`可用引擎档 ${engN} 档`);
      if (p.maxActiveProjects) perks.push((lang==='en'?'Up to ':'同时进行项目≤')+p.maxActiveProjects+(lang==='en'?' projects':' 个'));
      const MODE_PERK = {
        FREE: lang==='en'?'Tag mode only':'仅标签创建模式',
        BASIC: lang==='en'?'5 core modes':'采访/改编/标签/小说/互动 5模式',
        ADVANCED: lang==='en'?'+ Scene/Hot/ShortVideo/SoftAd':'+名场面/热点/短视频/软广，去水印·听剧本',
        PRO: lang==='en'?'All 12 modes, strongest mix, batch':'全部12模式·最强模型组合·批量生成·专属投稿',
      };
      if (MODE_PERK[p.level]) perks.push(MODE_PERK[p.level]);
      if (p.commission !== undefined) perks.push(`${t('commission')} ${p.commission}%`);
      const isCur = cur === p.level;
      // 年卡折算月价与节省比例
      let yearLine = '';
      if (yearItem) {
    // @module profile
        const yearMonthly = (yearItem.amountFen / 12 / 100);
        const savePct = Math.round((1 - yearItem.amountFen / (p.monthlyFen * 12)) * 100);
        yearLine = `<button class="btn-ghost plan-year" data-sku="${yearSku}"${disabled}>${lang==='en'?'Yearly':'年卡'} ¥${yearItem.amountYuan} · ${lang==='en'?'≈':'折'}¥${yearMonthly.toFixed(1)}/${lang==='en'?'mo':'月'} · ${lang==='en'?'save':'省'}${savePct}%</button>`;
      }
      return `<div class="plan-card ${p.level==='ADVANCED'?'featured':''} ${p.level==='FREE'?'plan-free':''}">
        <h3>${lvName(p.level)}${isCur?` <span class="badge">${t('currentPlan')}</span>`:''}</h3>
        <div class="plan-price">${price?('¥'+price):'¥0'}<small>/${lang==='en'?'mo':'月'}</small></div>
        <ul class="plan-perks">${perks.map((x)=>`<li>${x}</li>`).join('')}</ul>
        <div class="plan-actions">
          ${monthSku?`<button class="btn-primary" data-sku="${monthSku}"${disabled}>${purchaseLabel}</button>`:`<span class="plan-current-state">${lang==='en'?'Free plan · no activation needed':'免费方案 · 无需开通'}</span>`}
          ${yearLine}
        </div>
      </div>`;
    }).join('');
    $('skuGrid').innerHTML = cat.items.filter((i) => i.kind === 'POINTS').map((i) => {
      const base = i.amountYuan * 10;
      const bonus = i.points - base;
      const bonusTxt = bonus > 0 ? `<span class="badge pack-bonus">${lang==='en'?'bonus +':'赠 +'}${bonus}</span>` : '';
      return `<div class="plan-card"><h3>${i.points} ${t('points')} ${bonusTxt}</h3><div class="plan-price">¥${i.amountYuan}</div>
       <button class="btn-ghost" data-sku="${i.sku}"${disabled}>${purchaseLabel}</button></div>`;
    }).join('');
    document.querySelectorAll('[data-sku]').forEach((b) => b.onclick = () => placeOrder(b.getAttribute('data-sku')));
  }
  // v2.260 下单在途锁：[data-sku] 按钮与 xMatureBuy 两入口共享，函数级锁才能挡跨入口重入
  let _placingOrder = false;
  async function placeOrder(sku) {
    if (_placingOrder) return;
    if (!Api.isAuthed()) { openAuth('login'); return; }
    _placingOrder = true;
    try {
      const res = await Api.request('/api/order/create', { method: 'POST', body: JSON.stringify({ sku }) });
      const o = await Api.jsonOrThrow(res);
      xnSay(lang === 'en' ? `Order ${o.orderId} created (pending). Live pay coming soon.` : `已创建待支付订单 ${o.orderId}，正式支付通道接入中。`);
    } catch (e) { xnSay(e.message); } finally { _placingOrder = false; }
  }

  /* ---------- v2.220 模态统一收口（语义/Esc/焦点/清理钩子） ----------
     18 个 .modal-mask 业务弹窗此前只有 data-close/遮罩两条关闭路径：Esc 仅 dpModal 专属、
     无 role/aria-modal 语义、开关无焦点管理、关闭副作用各自为政。本区域统一收口：
     openModal/closeModalEl 单一出入口 + setModalCloseHook 清理钩子（关闭只 hidden，清理归各模块）。 */
  const _modalCloseHooks = new Map();
  function setModalCloseHook(id, fn) { _modalCloseHooks.set(id, fn); }
  // 语义补齐（幂等）：屏幕阅读器按对话框朗读
  document.querySelectorAll('.modal-mask').forEach((m) => {
    if (!m.getAttribute('role')) m.setAttribute('role', 'dialog');
    if (!m.hasAttribute('aria-modal')) m.setAttribute('aria-modal', 'true');
  });
  function _modalFocusables(el) {
    return Array.from(el.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((n) => !n.disabled && !n.classList.contains('hidden'));
  }
  function closeModalEl(el) {
    if (!el || el.classList.contains('hidden')) return;
    const hook = _modalCloseHooks.get(el.id);
    if (hook) { try { hook(); } catch { /* 清理失败不阻断关闭 */ } }
    el.classList.add('hidden');
    // 焦点仍留在模态内才恢复（避免打断用户已在别处的焦点）
    const prev = el._znPrevFocus;
    if (prev && prev.focus && el.contains(document.activeElement)) { try { prev.focus(); } catch { /* 焦点恢复失败忽略 */ } }
    delete el._znPrevFocus;
  }
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => closeModalEl($(b.getAttribute('data-close'))); });
  document.querySelectorAll('.modal-mask').forEach((m) => { m.addEventListener('click', (e) => { if (e.target === m) closeModalEl(m); }); });
  // Esc 关闭最上层可见模态（openModal 把节点搬到 body 末尾，DOM 序即层叠序）；workbench 的 ESC 退级已让位（见 hasOverlay 选择器）
  document.addEventListener('keydown', (e) => {
    // Tab 焦点圈闭：有可见弹窗时，焦点限定在最上层 mask 内循环
    // （dogfood 第三轮实测：authModal 打开后 Tab 序列逃出弹窗落到背景 mkSort 等）
    if (e.key === 'Tab') {
      const openMasks = document.querySelectorAll('.modal-mask:not(.hidden)');
      if (!openMasks.length) return;
      const top = openMasks[openMasks.length - 1];
      const items = _modalFocusables(top);
      if (!items.length) { e.preventDefault(); return; }
      const active = document.activeElement;
      const idx = items.indexOf(active);
      if (idx < 0) { e.preventDefault(); items[0].focus(); return; }
      if (e.shiftKey && idx === 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
      return;
    }
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    const openMasks = document.querySelectorAll('.modal-mask:not(.hidden)');
    if (!openMasks.length) return;
    closeModalEl(openMasks[openMasks.length - 1]);
  });
    // @module profile
  const openModal = (id) => {
    const el = $(id);
    if (!el) return;
    // c207 D9（P1）：13 个弹窗历史上被放在 #view-market 容器内，而视图切换靠祖先 display:none。
    // 从工作室/作品库/顶栏打开这些弹窗时，弹窗自身 flex 可见、数据与定时器照跑，但 0×0 不可见也关不掉
    // （听剧本表现为“点了没反应却有声音”）。显示前一次性把节点搬到 body 末尾：
    // fixed 定位、id、事件委托与元素级监听全部保留；已在视图外（authModal/qsMask）则无操作。
    if (el.closest('[id^="view-"]')) document.body.appendChild(el);
    el._znPrevFocus = document.activeElement;
    el.classList.remove('hidden');
    // 焦点入模态：键盘/读屏用户可直接 Tab 操作，不落在背景页
    const first = _modalFocusables(el)[0];
    if (first) { try { first.focus(); } catch { /* 焦点入失败忽略 */ } }
  };
  // ═══ MODULE: ui (277行, 6fn) ═══ v2.220 模态统一收口 
  /* ---------- v2.220 模态统一收口 结束 ---------- */
  /* ---------- v2.185.14 c194 用户反馈中心（提交建议/Bug + 我的工单进度 + 小南回复） ----------
     后端 /api/feedback（POST / 提交、GET /mine 查询、admin 三态处置）此前只有管理员处置端接线，
     终端创作者既无提交入口、也看不到处理状态与回复——完整工单子系统对 C 端零触达。本模块补齐闭环。 */
  (function initFeedbackCenter() {
    const entryBtn = $('feedbackEntryBtn');
    if (!entryBtn || !$('feedbackModal')) return;
    let fbType = 'SUGGESTION';
    // v2.189 反馈附图：base64 data URL 数组（前端压缩后存入，提交时随 body 发送）
    let fbImages = [];
    const FB_IMG_MAX = 3, FB_IMG_MAX_BYTES = 2 * 1024 * 1024;

    // @module ui
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s));

    // 把图片压到 ≤2MB 并输出 data URL；超限自动降质量/尺寸，不合法 MIME 直接 reject
    function compressImage(file) {
      return new Promise((resolve, reject) => {
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error(lang === 'en' ? 'Only png/jpeg/webp' : '仅支持 png/jpeg/webp'));
        if (file.size > 10 * 1024 * 1024) return reject(new Error(lang === 'en' ? 'Image too large (>10MB)' : '图片过大（>10MB）'));
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            let { width, height } = img;
            const maxDim = 1600;
            if (width > maxDim || height > maxDim) {
              const r = Math.min(maxDim / width, maxDim / height);
              width = Math.round(width * r); height = Math.round(height * r);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            // 优先 webp/jpeg 压缩，质量从 0.85 逐级降到 0.4 直到 ≤2MB；png 不压（保留透明）
    // @module ui
            const tryEncode = (mime, q) => new Promise((res) => {
              canvas.toBlob((b) => res(b), mime, q);
            });
            (async () => {
              let blob = await tryEncode(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
              if (blob && blob.size > FB_IMG_MAX_BYTES) {
                for (const q of [0.7, 0.55, 0.4]) {
                  blob = await tryEncode('image/jpeg', q);
                  if (!blob || blob.size <= FB_IMG_MAX_BYTES) break;
                }
              }
              if (!blob) return reject(new Error(lang === 'en' ? 'Encode failed' : '编码失败'));
              if (blob.size > FB_IMG_MAX_BYTES) return reject(new Error(lang === 'en' ? 'Still too large after compress' : '压缩后仍超过 2MB'));
              const r2 = new FileReader();
              r2.onload = () => resolve(r2.result);
              r2.onerror = () => reject(new Error('read failed'));
              r2.readAsDataURL(blob);
            })();
          };
          img.onerror = () => reject(new Error(lang === 'en' ? 'Invalid image' : '图片无效'));
          img.src = reader.result;
        };
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
    }

    function renderFbImgGrid() {
      const grid = $('fbImgGrid');
      grid.innerHTML = fbImages.map((src, i) => `
        <div class="fb-img-thumb">
          <img src="${esc(src)}" alt="preview ${i + 1}" />
          <button type="button" class="fb-img-del" data-idx="${i}" aria-label="remove">×</button>
        </div>`).join('');
      grid.querySelectorAll('.fb-img-del').forEach((b) => {
        b.onclick = () => { fbImages.splice(Number(b.getAttribute('data-idx')), 1); renderFbImgGrid(); };
      });
      // 达到上限隐藏添加按钮
      const addBtn = document.querySelector('.fb-img-add');
      if (addBtn) addBtn.style.display = fbImages.length >= FB_IMG_MAX ? 'none' : '';
    }

    // @module ui
    const showPane = (which) => {
      const submit = which === 'submit';
      $('fbSubmitPane').classList.toggle('hidden', !submit);
      $('fbMinePane').classList.toggle('hidden', submit);
      $('fbTabSubmit').classList.toggle('active', submit);
      $('fbTabMine').classList.toggle('active', !submit);
      // 进度/回复必须新鲜：每次进入「我的工单」都重新拉取，不用内存缓存（否则用户看不到管理员刚写的回复）
      if (!submit) loadMine();
    };

    function openFeedback() {
      if (!Api.isAuthed()) {
        xnSay(lang === 'en' ? 'Please log in to submit feedback.' : '登录后即可提交反馈、查看工单进度。');
        openAuth('login');
        return;
      }
      openModal('feedbackModal');
      showPane('submit');
    }

    async function loadMine() {
      const box = $('fbMineList');
      znSkeleton(box);
      try {
        const r = await Api.request('/api/feedback/mine');
        const list = await Api.jsonOrThrow(r);
        if (!Array.isArray(list) || list.length === 0) {
          znEmpty(box, t('fbEmpty'));
          return;
        }
        const locale = lang === 'en' ? 'en-US' : 'zh-CN';
        box.innerHTML = list.map((f) => {
          const rawStatus = String(f.status || 'PENDING');
          const statusKey = 'fbStatus_' + rawStatus;
          const looked = t(statusKey);
          const statusText = looked === statusKey ? rawStatus : looked;
          const isBug = f.type === 'BUG';
          const urgentTag = f.urgent ? `<span class="fb-badge fb-urgent">${esc(t('fbUrgentTag'))}</span>` : '';
          const time = f.createdAt
            ? new Date(f.createdAt).toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '';
          const reply = f.reply
            ? `<div class="fb-reply"><div class="fb-reply-h">${esc(t('fbReplyTitle'))}</div><div class="fb-reply-b">${esc(f.reply)}</div></div>`
            : '';
          const imgs = Array.isArray(f.images) && f.images.length
            ? `<div class="fb-img-row">${f.images.map((s) => `<img src="${esc(s)}" class="fb-img-thumb-mini" alt="" />`).join('')}</div>`
            : '';
          return `<div class="fb-card">
            <div class="fb-card-h">
              <span class="fb-badge ${isBug ? 'fb-bug' : 'fb-sug'}">${esc(isBug ? t('fbBadgeBug') : t('fbBadgeSug'))}</span>
              ${urgentTag}
              <span class="fb-status fb-st-${esc(rawStatus.toLowerCase())}">${esc(statusText)}</span>
              <span class="fb-no">${esc(t('fbTicketLabel'))} ${esc(f.ticketNo || '')}</span>
              <span class="fb-time">${esc(time)}</span>
            </div>
            <div class="fb-content">${esc(f.content)}</div>
            ${imgs}
            ${reply}
          </div>`;
        }).join('');
      } catch (e) {
        // token 过期且 refresh 失败时 Api 层已清登录态：必须引导重新登录，不能只甩一行英文错误码
        if (e && e.code === 'AUTH_REQUIRED') { $('feedbackModal').classList.add('hidden'); openAuth('login'); return; }
        box.innerHTML = znErrorHtml(e.message || (lang === 'en' ? 'Failed to load, please retry later' : '加载失败，请稍后重试'));
      }
    }

    async function submitFeedback() {
      const contentEl = $('fbContent');
      const content = contentEl.value.trim();
      if (!content) { xnSay(t('fbNeedContent')); contentEl.focus(); return; }
      const btn = $('fbSubmitBtn');
      const oldLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = t('fbSubmitting');
      try {
        const meta = {
          path: location.pathname + location.hash,
          lang: lang || 'zh',
          ua: (navigator.userAgent || '').slice(0, 200),
          ts: new Date().toISOString(),
        };
        const body = {
          type: fbType,
          urgent: $('fbUrgent').checked,
          content,
          contact: $('fbContact').value.trim() || undefined,
          meta,
          images: fbImages.length ? fbImages : undefined,
        };
        const r = await Api.request('/api/feedback', { method: 'POST', body: JSON.stringify(body) });
        const data = await Api.jsonOrThrow(r);
        // 分隔符随语言：英文环境不得出现中文冒号
        xnSay(`${t('fbSubmitOk')}${lang === 'en' ? ': ' : '：'}${data.ticketNo || ''}`);
        contentEl.value = '';
        $('fbCount').textContent = '0';
        $('fbContact').value = '';
        $('fbUrgent').checked = false;
        fbImages = []; renderFbImgGrid();
        $('fbImgInput').value = '';
        // 类型选择复位为建议，避免上次报 Bug 的选择残留到下一次提交
        fbType = 'SUGGESTION';
        $('fbTypeRow').querySelectorAll('.fb-type').forEach((x) => x.classList.toggle('active', x.getAttribute('data-type') === 'SUGGESTION'));
        showPane('mine');
      } catch (e) {
        if (e && e.code === 'AUTH_REQUIRED') { openAuth('login'); return; }
        xnSay(e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    entryBtn.onclick = openFeedback;
    $('fbTabSubmit').onclick = () => showPane('submit');
    $('fbTabMine').onclick = () => showPane('mine');
    $('fbTypeRow').querySelectorAll('.fb-type').forEach((b) => {
      b.onclick = () => {
        fbType = b.getAttribute('data-type') || 'SUGGESTION';
        $('fbTypeRow').querySelectorAll('.fb-type').forEach((x) => x.classList.toggle('active', x === b));
      };
    });
    $('fbContent').addEventListener('input', () => { $('fbCount').textContent = String($('fbContent').value.length); });
    $('fbSubmitBtn').onclick = submitFeedback;
    // v2.189 附图上传：多选逐个压缩，超限/格式错用 xnSay 提示，不阻断已选成功的图片
    $('fbImgInput').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        if (fbImages.length >= FB_IMG_MAX) { xnSay(lang === 'en' ? `Max ${FB_IMG_MAX} images` : `最多 ${FB_IMG_MAX} 张图片`); break; }
        try {
          const dataUrl = await compressImage(f);
          fbImages.push(dataUrl);
        } catch (err) { xnSay(err.message || String(err)); }
      }
      renderFbImgGrid();
      e.target.value = '';
    });
    renderFbImgGrid();
  })();
  /* ---------- v2.185.14 c194 制式样例馆（/api/generate/sample-script 此前前端零调用） ----------
     新用户 0 积分即可查看通过格式闸门的达标剧本；双制式 LIVE/AIGC，随界面语言取中英文稿，缓存避免重复请求。 */
  (function initSampleGallery() {
    const entry = $('sampleEntryBtn');
    if (!entry || !$('sampleModal')) return;
    const cache = {};
    let fmt = 'LIVE';
    let reqSeq = 0; // 快速切 Tab 时丢弃过期响应，防止慢请求把旧制式内容写回当前 Tab
    // @module ui
    const curLang = () => (lang === 'en' ? 'en' : 'zh');
    // @module ui
    const key = () => `${fmt}_${curLang()}`;

    async function ensure() {
      const pre = $('smpText');
      const k = key();
      if (cache[k]) { pre.textContent = cache[k]; return; }
      const seq = ++reqSeq;
      znSkeleton(pre);
      try {
        const r = await Api.request(`/api/generate/sample-script?format=${fmt}&lang=${curLang()}`);
        const d = await Api.jsonOrThrow(r);
        if (seq !== reqSeq) return; // 已切到别的制式/语言：丢弃过期响应（切回时重新拉取）
        cache[k] = d.script || '';
        pre.textContent = cache[k];
      } catch (e) {
        if (seq !== reqSeq) return;
        pre.textContent = `${t('smpFail')}（${e.message || ''}）`;
      }
    }
    // @module ui
    const switchTab = (f) => {
      fmt = f;
      $('smpTabLive').classList.toggle('active', f === 'LIVE');
      $('smpTabAigc').classList.toggle('active', f === 'AIGC');
      ensure();
    };
    entry.onclick = () => { openModal('sampleModal'); switchTab('LIVE'); };
    $('smpTabLive').onclick = () => switchTab('LIVE');
    $('smpTabAigc').onclick = () => switchTab('AIGC');
    $('smpCopy').onclick = () => {
      const text = cache[key()];
      // 加载中/失败时 cache 为空：静默无反应是坏体验，要明确反馈
      if (text) copy(text, t('smpCopied'));
      else xnSay(t('smpLoading'));
    };
  })();
  // v2.167 资产看板入口：三族面板共用，按钮 data-open-dash 触发 openAssetDashboard(family)
  document.querySelectorAll('[data-open-dash]').forEach((b) => { b.onclick = () => openAssetDashboard(b.getAttribute('data-open-dash') || 'cast'); });
  // v2.152 角色资产库管理面板入口（创作页引用下拉旁）
  const castLibBtn = $('castLibBtn');
  if (castLibBtn) castLibBtn.onclick = () => openCastLibrary();
  // v2.159 道具资产库管理面板入口（创作页引用下拉旁）
  const propLibBtn = $('propLibBtn');
  if (propLibBtn) propLibBtn.onclick = () => openPropLibrary();
  const sceneLibBtn = $('sceneLibBtn');
  if (sceneLibBtn) sceneLibBtn.onclick = () => openSceneLibrary();
  // v2.163 资产库检索：三面板搜索框防抖 300ms 触发重查（清空回全量；编辑/删除后重开面板保留搜索态）
  for (const [inpId, reopen] of [['castLibSearch', openCastLibrary], ['propLibSearch', openPropLibrary], ['sceneLibSearch', openSceneLibrary]]) {
    const inp = $(inpId);
    if (!inp) continue;
    let timer = null;
    inp.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => reopen(), 300); });
  }

  // ═══ MODULE: market (483行, 4fn) ═══ 交流广场
  /* ---------- 交流广场 ---------- */
  const SQ_SECTIONS = ['', 'experience', 'team', 'review', 'news'];
  let curSection = '';
  // v2.230 消费侧分页：后端 GET /api/community/posts 纳入 v2.215 六键契约，>50 帖不再静默截断
  let sqPage = 1;
  let feedReqSeq = 0; // v2.259：广场板块/翻页请求序号，旧板块慢响应不得覆盖当前 Tab
  const SQ_PAGE_SIZE = 50;
  function renderSqTabs() {
    $('sqTabs').innerHTML = SQ_SECTIONS.map((s) =>
      `<button data-sec="${s}" class="${s === curSection ? 'on' : ''}">${t(s === '' ? 'secAll' : 'sec' + s[0].toUpperCase() + s.slice(1))}</button>`).join('');
    $('sqTabs').querySelectorAll('[data-sec]').forEach((b) => b.onclick = () => { curSection = b.getAttribute('data-sec'); sqPage = 1; renderSqTabs(); loadFeed(); });
    znBindTablist($('sqTabs'), { selector: '[data-sec]' }); // v2.270 键盘方向键导航 + ARIA 语义
  }
  async function loadFeed() {
    renderSqTabs();
    const seq = ++feedReqSeq; // v2.259：切板块/翻页连点时旧响应作废
    // v2.281 三态补全：慢网取数期铺纵向卡片骨架，隐藏空态与旧分页器；响应回来后由完成路径统一接管
    // v2.282 重试即新周期：同步清空旧错误/空态内容，重试点击后 role=alert 即时消失而非滞留到响应返回
    $('sqEmpty').classList.add('hidden'); $('sqEmpty').innerHTML = '';
    $('sqPager').classList.add('hidden');
    znSkeleton($('sqFeed'), 'cards');
    let list = [], total = 0, failed = false;
    try {
      const res = await fetch('/api/community/posts?section=' + curSection + '&page=' + sqPage + '&pageSize=' + SQ_PAGE_SIZE);
      if (!res.ok) failed = true;
      else { const j = await res.json(); if (Array.isArray(j.items)) { list = j.items; total = Number(j.total) || list.length; } }
    } catch { failed = true; }
    if (seq !== feedReqSeq) return; // v2.259：过期响应不得写 sqEmpty/sqFeed
    const empty = $('sqEmpty'), feed = $('sqFeed');
    empty.innerHTML = failed ? znErrorHtml(t('loadFail')) + znRetryHtml('sq-retry') : znEmptyHtml(t('sqEmpty'));
    empty.classList.toggle('hidden', list.length > 0); feed.innerHTML = '';
    const sqRetry = empty.querySelector('.sq-retry');
    if (sqRetry) sqRetry.onclick = () => loadFeed();
    list.forEach((p) => {
      const c = document.createElement('div'); c.className = 'post-card';
      const mine = Api.isAuthed() && p.userId === Api.getUser()?.id;
      c.innerHTML = `<h4>${escapeHtml(p.title)}</h4>
        <div class="pc-body">${escapeHtml(p.body)}</div>
        <div class="pc-foot"><span>${escapeHtml(p.user?.nickname || (lang==='en'?'Anonymous':'匿名编剧'))}</span>
        <span>${new Date(p.createdAt).toLocaleString()}</span><span class="spacer"></span>
        ${mine ? `<button class="chip del-post" style="color:#c0392b">${lang==='en'?'Delete':'删除'}</button>` : ''}
        <button class="like-btn">♡ ${p.likes}</button></div>`;
      const likeBtn = c.querySelector('.like-btn');
      likeBtn.onclick = async () => {
        if (!Api.isAuthed()) { openAuth('login'); return; }
        const method = likeBtn.dataset.liked === '1' ? 'DELETE' : 'POST';
        // v2.283 网络层 reject 兜底：断网时 api.js 全局 onNetworkError 已弹 toast，
        // 此处静默 catch 防 unhandledrejection 冒泡污染监控；业务错误（非 ok）仍走 xnSay
        try {
        const r = await Api.request(`/api/community/posts/${p.id}/like`, { method });
        if (r.ok) { const j = await r.json().catch(() => ({})); likeBtn.textContent = `♡ ${j.likes ?? p.likes}`; likeBtn.dataset.liked = method === 'POST' ? '1' : '0'; }
        else xnSay(znSanitizeErr((await r.json().catch(() => ({}))).error, r.status) || 'error');
        } catch { /* 全局网络 toast 已提示，按钮保持原态可再点 */ }
      };
      const delBtn = c.querySelector('.del-post');
      if (delBtn) delBtn.onclick = async () => {
        if (!(await uiConfirm({ body: lang==='en' ? 'Delete this post?' : '确定删除这条帖子吗？', danger: true, okText: lang==='en' ? 'Delete' : '删除' }))) return;
        // v2.283 同 like handler：网络层异常由全局 toast 提示，静默 catch 防 unhandledrejection
        try {
        const r = await Api.request(`/api/community/posts/${p.id}`, { method: 'DELETE' });
        if (r.ok) { xnSay(lang==='en'?'Deleted':'已删除'); loadFeed(); }
        else xnSay(znSanitizeErr((await r.json().catch(() => ({}))).error, r.status) || 'error');
        } catch { /* 全局网络 toast 已提示，卡片保留可再删 */ }
      };
      feed.appendChild(c);
    });
    renderSqPager(total, failed);
  }
  // v2.230 交流广场翻页器（与 market 橱窗 renderMkPager 同构，复用 znPagerState）
  function renderSqPager(total, failed) {
    const pager = $('sqPager');
    const show = !failed && total > SQ_PAGE_SIZE;
    pager.classList.toggle('hidden', !show);
    if (!show) return;
    const { pages, hasPrev, hasNext } = znPagerState(total, sqPage, SQ_PAGE_SIZE);
    pager.innerHTML = `<button class="btn-ghost" id="sqPrevPage"${hasPrev ? '' : ' disabled'}>‹ ${lang === 'en' ? 'Prev' : '上一页'}</button>`
      + `<span>${t('admTotal')} ${total} · ${t('admPage')} ${sqPage}/${pages}</span>`
      + `<button class="btn-ghost" id="sqNextPage"${hasNext ? '' : ' disabled'}>${lang === 'en' ? 'Next' : '下一页'} ›</button>`;
    $('sqPrevPage').onclick = () => { sqPage--; loadFeed(); };
    $('sqNextPage').onclick = () => { sqPage++; loadFeed(); };
  }
  // v2.269 发帖在途锁：弱网/连点下双击「发布」不得产生两条重复帖
  let _sqPosting = false;
  $('sqSubmit').onclick = async () => {
    if (_sqPosting) return;
    if (!Api.isAuthed()) { openAuth('login'); return; }
    const title = $('sqTitle').value.trim(), body = $('sqBody').value.trim();
    if (!title || !body) { xnSay(lang === 'en' ? 'Title and body required.' : '请填写标题和正文'); return; }
    _sqPosting = true;
    try {
      const res = await Api.request('/api/community/posts', { method: 'POST', body: JSON.stringify({ section: curSection || 'experience', title, body }) });
      await Api.jsonOrThrow(res); $('sqTitle').value = ''; $('sqBody').value = ''; xnSay(t('postedOk')); loadFeed();
    } catch (e) { xnSay(e.message); } finally { _sqPosting = false; }
  };

  /* ---------- 剧本交易广场 ---------- */
  let curPurchase = null;
  let purchaseViewSeq = 0;
  // v2.229 消费侧分页：v2.215 契约 { items, total, ... } 全量消费，>50 条不再静默截断（后端 defaultLimit 50 / maxLimit 100）
  let mkPage = 1;
  let mkReqSeq = 0; // v2.258：市场网格（列表/榜单共用 mkGrid）请求序号，过期响应丢弃
  const MK_PAGE_SIZE = 50;
  const BOARD_LIMIT = 50; // v2.231 榜单页大小对齐后端 maxLimit（此前不传 limit 吃默认 20）
  function znPagerState(total, page, pageSize) {
    const pages = Math.max(1, Math.ceil((Number(total) || 0) / pageSize));
    return { pages, hasPrev: page > 1, hasNext: page < pages };
  }
  function renderMkPager(total, failed) {
    const pager = $('mkPager');
    const show = !failed && total > MK_PAGE_SIZE;
    pager.classList.toggle('hidden', !show);
    if (!show) return;
    const { pages, hasPrev, hasNext } = znPagerState(total, mkPage, MK_PAGE_SIZE);
    pager.innerHTML = `<button class="btn-ghost" id="mkPrevPage"${hasPrev ? '' : ' disabled'}>‹ ${lang === 'en' ? 'Prev' : '上一页'}</button>`
      + `<span>${t('admTotal')} ${total} · ${t('admPage')} ${mkPage}/${pages}</span>`
      + `<button class="btn-ghost" id="mkNextPage"${hasNext ? '' : ' disabled'}>${lang === 'en' ? 'Next' : '下一页'} ›</button>`;
    $('mkPrevPage').onclick = () => { mkPage--; loadListings(); };
    $('mkNextPage').onclick = () => { mkPage++; loadListings(); };
  }
  async function loadListings() {
    // v2.258：市场网格共享请求序号——翻页/排序/榜单 Tab 连点时，过期响应作废，不得覆盖新页
    const seq = ++mkReqSeq;
    const sort = $('mkSort').value || 'new';
    // v2.281 三态补全：慢网取数期铺网格骨架，隐藏空态与旧分页器；响应回来后由完成路径统一接管
    // v2.282 重试即新周期：同步清空 mkEmpty 旧内容
    $('mkEmpty').classList.add('hidden'); $('mkEmpty').innerHTML = '';
    $('mkPager').classList.add('hidden');
    znSkeleton($('mkGrid'), 'grid');
    let list = [], total = 0, failed = false;
    try { const res = await fetch('/api/market/listings?sort=' + sort + '&page=' + mkPage + '&pageSize=' + MK_PAGE_SIZE); if (!res.ok) failed = true; else { const j = await res.json(); if (Array.isArray(j.items)) { list = j.items; total = Number(j.total) || list.length; } } } catch { failed = true; }
    if (seq !== mkReqSeq) return; // 期间又翻页/切排序/切榜单：旧响应作废
    const grid = $('mkGrid'), empty = $('mkEmpty');
    empty.innerHTML = failed ? znErrorHtml(t('loadFail')) + znRetryHtml('mk-retry') : znEmptyHtml(t('mkEmpty'));
    empty.classList.toggle('hidden', list.length > 0); grid.innerHTML = '';
    const mkRetry = empty.querySelector('.mk-retry');
    if (mkRetry) mkRetry.onclick = () => loadListings();
    list.forEach((l) => {
      const c = document.createElement('div'); c.className = 'listing-card';
      const gradeBadge = l.valueGrade && l.valueGrade !== 'NA'
        ? `<span class="lv-grade lv-grade-sm" title="${lang === 'en' ? 'Value certified at listing' : '上架时价值认证'}">${l.valueGrade}${l.valueIndex != null ? '·' + Math.round(l.valueIndex) : ''}</span>` : '';
      c.innerHTML = `<h4>${escapeHtml(l.title)} ${gradeBadge}</h4>
        <div class="muted">${t('seller')}：${escapeHtml(l.seller?.nickname || '—')}</div>
        <div class="listing-sample">${escapeHtml(l.sample || (lang==='en'?'No sample':'暂无样章'))}</div>
        <div class="listing-foot"><span class="price-tag">${l.pricePoints} ${t('points')}</span>
        <button class="btn-primary">${lang === 'en' ? 'View' : '查看详情'}</button></div>`;
      c.querySelector('button').onclick = () => openListingDetail(l.id);
      grid.appendChild(c);
    });
    renderMkPager(total, failed);
  }
  // v2.73 买家详情页：完整价值维度+资方风险+样章，先建立信任再购买
  async function openListingDetail(id) {
    const body = $('detailBody');
    const dlg = $('detailModal');
    // v2.249 a11y：打开即重置可访问名为静态兜底，防上一作品标题残留（读屏器误读）
    dlg.setAttribute('aria-label', lang === 'en' ? 'Listing detail' : '作品详情');
    openModal('detailModal');
    znSkeleton(body);
    const seq = ++detailReqSeq; // v2.258：详情弹窗竞态令牌
    try {
      const res = await fetch('/api/market/listings/' + id);
      if (seq !== detailReqSeq) return; // 已关闭或已打开别的作品：旧响应作废（错误态也不得覆盖新骨架）
      if (!res.ok) {
        // v2.216 契约：INTERNAL_ERROR 是脱敏码，对用户回落本地友好文案而非甩错误码
        const e = await res.json().catch(() => ({}));
    // @module market
        const errText = (!e.error || e.error === 'INTERNAL_ERROR')
          ? (lang === 'en' ? 'Failed to load, please retry later' : '加载失败，请稍后重试') : e.error;
        body.innerHTML = znErrorHtml(errText); return;
      }
      const d = await res.json();
      if (seq !== detailReqSeq) return; // 二次 await 后再校验：正文渲染前确认仍是当前弹窗
      // v2.249 a11y：数据到达后同步 dialog 可访问名为具体作品名（读屏器报「作品详情：<标题>」）
      dlg.setAttribute('aria-label', (lang === 'en' ? 'Listing detail: ' : '作品详情：') + d.title);
      const v = d.value; const snap = d.valueSnapshot;
      const gradeColor = { S: '#d4a017', A: '#c0392b', B: '#2e7d32', C: '#5d6d7e', NA: '#888' }[(v && v.grade) || (snap && snap.grade) || 'NA'] || '#888';
    // @module market
      const grade = (v && v.grade) || (snap && snap.grade) || 'NA';
      const idx = v ? v.valueIndex : (snap ? snap.index : null);
      const dims = v && v.dimensions ? v.dimensions : [];
      const dimBars = dims.map((dm) => {
        const pct = Math.max(0, Math.min(100, dm.score));
        return `<div class="v-dim"><div class="v-dim-row"><span>${escapeHtml(dm.labelZh || dm.key)}</span><b>${dm.score}</b></div>
          <div class="v-bar"><div class="v-bar-fill" style="width:${pct}%"></div></div></div>`;
      }).join('');
      const strengths = v && v.strengthsZh ? v.strengthsZh.filter(Boolean).slice(0, 2).map((s) => `<li>${escapeHtml(s)}</li>`).join('') : '';
      const risks = v && v.risksZh ? v.risksZh.filter(Boolean).slice(0, 2).map((s) => `<li>${escapeHtml(s)}</li>`).join('') : '';
      const band = v && v.band ? `¥${v.band.perEpLow}–${v.band.perEpHigh}/集` : (snap ? `¥${snap.bandLow}–${snap.bandHigh}/集` : '—');
      body.innerHTML = `
        <div class="d-head">
          <span class="lv-grade" style="background:${gradeColor}">${grade}</span>
          <div><h3 style="margin:0">${escapeHtml(d.title)}</h3>
            <div class="muted">${lang === 'en' ? 'Seller' : '卖家'}：${escapeHtml(d.seller?.nickname || '—')} · ${lang === 'en' ? 'Value index' : '价值指数'} ${idx != null ? idx : '—'}</div></div>
        </div>
        ${v ? `<div class="v-section"><b>${lang === 'en' ? 'Six-dimension craft score' : '六维创作力评分'}</b>${dimBars}</div>` : ''}
        ${strengths ? `<div class="v-section"><b>${lang === 'en' ? 'Funder strengths' : '资方视角强项'}</b><ul>${strengths}</ul></div>` : ''}
        ${risks ? `<div class="v-section"><b style="color:#b05a00">${lang === 'en' ? 'Funder risks' : '资方视角风险'}</b><ul>${risks}</ul></div>` : ''}
        <div class="v-section"><b>${lang === 'en' ? 'Reference price band' : '参考价值区间'}</b> <span>${band}</span> <span class="muted">（${escapeHtml(d.disclaimer || '')}）</span></div>
        <div class="v-section"><b>${lang === 'en' ? 'Sample' : '样章'}</b><div class="listing-sample">${escapeHtml(d.sample || (lang==='en'?'No sample':'暂无样章'))}</div></div>
        <div class="listing-foot" style="margin-top:12px"><span class="price-tag">${d.pricePoints} ${t('points')}</span>
          <button class="btn-primary" id="detailBuyBtn">${t('buy')}</button></div>`;
      $('detailBuyBtn').onclick = () => { closeModalEl($('detailModal')); buyListing(id); };
    // v2.256：网络异常（fetch reject/JSON 解析失败）走本地友好文案，不把浏览器技术信息（Failed to fetch 等）裸上屏
    // v2.258：过期请求的网络失败不得覆盖当前弹窗
    } catch { if (seq !== detailReqSeq) return; body.innerHTML = znErrorHtml(lang === 'en' ? 'Failed to load, please retry later' : '加载失败，请稍后重试'); }
  }
  $('mkSort').onchange = () => { mkPage = 1; loadListings(); };
  // v2.74 榜单 Tab
  let curBoard = 'all';
  let detailReqSeq = 0; // v2.258：作品详情弹窗请求序号（关 A 立刻开 B，A 慢响应不得覆盖 B）
  async function loadBoard(type) {
    curBoard = type;
    // v2.258：序号必须在 all 分支前自增——all 分支调 loadListings 会再 ++，恰好作废旧榜单在途请求
    const seq = ++mkReqSeq;
    document.querySelectorAll('.board-tab').forEach((b) => b.classList.toggle('active', b.dataset.board === type));
    znBindTablist($('mkBoardTabs'), { selector: '.board-tab' }); // v2.270 键盘方向键导航 + ARIA 语义
    if (type === 'all') { $('mkBoardMeta').classList.add('hidden'); loadListings(); return; }
    // v2.281 榜单三态补全：慢网取数期铺网格骨架（all 分支的骨架由 loadListings 铺）
    // v2.282 重试即新周期：同步清空 mkEmpty 旧内容
    $('mkEmpty').classList.add('hidden'); $('mkEmpty').innerHTML = '';
    $('mkPager').classList.add('hidden');
    znSkeleton($('mkGrid'), 'grid');
    let data = { items: [] }, failed = false;
    try { const res = await fetch('/api/market/board?type=' + type + '&limit=' + BOARD_LIMIT); if (!res.ok) failed = true; else data = await res.json(); } catch { failed = true; }
    if (seq !== mkReqSeq) return; // 期间又点了别的榜单 Tab：旧响应作废
    const list = data.items || [];
    // v2.231 消费 total 真总数：共 X 条上榜 + 截断可见化（limit 50 / take 500 硬帽，v2.156 铁律）
    const total = Number(data.total) || list.length;
    const meta = $('mkBoardMeta');
    const showMeta = !failed && list.length > 0;
    meta.classList.toggle('hidden', !showMeta);
    meta.innerHTML = showMeta
      ? t('boardTotal', { total }) + (total > list.length ? ' · ' + t('boardTrunc', { shown: list.length }) : '')
      : '';
    const grid = $('mkGrid'), empty = $('mkEmpty');
    empty.innerHTML = failed ? znErrorHtml(t('loadFail')) + znRetryHtml('board-retry') : znEmptyHtml(t('mkEmpty'));
    $('mkPager').classList.add('hidden');
    empty.classList.toggle('hidden', list.length > 0); grid.innerHTML = '';
    const boardRetry = empty.querySelector('.board-retry');
    if (boardRetry) boardRetry.onclick = () => loadBoard(curBoard);
    list.forEach((l) => {
      const c = document.createElement('div'); c.className = 'listing-card';
      const gradeBadge = l.valueGrade && l.valueGrade !== 'NA'
        ? `<span class="lv-grade lv-grade-sm">${l.valueGrade}${l.valueIndex != null ? '·' + Math.round(l.valueIndex) : ''}</span>` : '';
      const soldBadge = l.status === 'SOLD' ? `<span class="sold-badge">${lang === 'en' ? 'Sold' : '已成交'}</span>` : '';
      const foot = l.status === 'SOLD'
        ? `<div class="listing-foot"><span class="price-tag">${l.pricePoints} ${t('points')}</span><span class="muted">${lang === 'en' ? 'Just sold' : '刚刚成交'}</span></div>`
        : `<div class="listing-foot"><span class="price-tag">${l.pricePoints} ${t('points')}</span><button class="btn-primary">${lang === 'en' ? 'View' : '查看详情'}</button></div>`;
      c.innerHTML = `<h4>${escapeHtml(l.title)} ${gradeBadge}${soldBadge}</h4>
        <div class="muted">${t('seller')}：${escapeHtml(l.sellerNickname || l.seller?.nickname || '—')}</div>
        <div class="listing-sample">${escapeHtml(l.sample || (lang==='en'?'No sample':'暂无样章'))}</div>${foot}`;
      const btn = c.querySelector('button');
      if (btn) btn.onclick = () => openListingDetail(l.id);
      grid.appendChild(c);
    });
  }
  document.querySelectorAll('.board-tab').forEach((b) => { b.onclick = () => loadBoard(b.dataset.board); });
  znBindTablist($('mkBoardTabs'), { selector: '.board-tab' }); // v2.270 初始绑定（loadBoard 前即可用方向键）
  $('mkListBtn').onclick = async () => {
    if (!Api.isAuthed()) { openAuth('login'); return; }
    // v2.284 网络层 reject 兜底：断网由全局 onNetworkError toast 提示，静默 catch 防 unhandledrejection
    try {
    const res = await Api.request('/api/generate/projects');
    if (!res.ok) { xnSay(znSanitizeErr((await res.json().catch(() => ({}))).error, res.status) || 'error'); return; }
    const projects = await res.json();
    if (!projects.length) { xnSay(lang === 'en' ? 'Create a script first.' : '请先创作一部剧本再上架'); return; }
    $('listScript').innerHTML = projects.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}（${p.totalEps || 0} eps）</option>`).join('');
    $('listValue').classList.add('hidden'); $('listValue').innerHTML = '';
    $('listScript').onchange = () => previewListingValue($('listScript').value);
    if (projects.length) previewListingValue(projects[0].id);
    openModal('listModal');
    } catch { /* 全局网络 toast 已提示，弹窗未开可再点 */ }
  };
  // v2.72 上架前价值预览：确定性免费，给卖家定价参考（等级徽章+指数+单集/全集区间+一键用建议价）
  async function previewListingValue(scriptId) {
    const box = $('listValue');
    if (!scriptId) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = znSkeletonHtml();
    try {
      const res = await Api.request('/api/market/listings/value-preview', { method: 'POST', body: JSON.stringify({ scriptId }) });
      const d = await Api.jsonOrThrow(res);
      if (!d.value) {
        box.innerHTML = znEmptyHtml(lang === 'en' ? 'No episodes yet — value reference unavailable.' : '该剧本暂无分集，无法生成价值参考。', lang === 'en' ? 'Create episodes first for a certified badge.' : '先生成分集后上架可获得认证徽章。');
        return;
      }
      const v = d.value, s = d.suggested;
      const gradeColor = { S: '#d4a017', A: '#c0392b', B: '#2e7d32', C: '#5d6d7e', NA: '#888' }[v.grade] || '#888';
      const range = s ? `${s.totalLowYuan}–${s.totalHighYuan}` : '—';
      const perEp = s ? `${s.perEpLowYuan}–${s.perEpHighYuan}` : '—';
      box.innerHTML = `
        <div class="lv-head">
          <span class="lv-grade" style="background:${gradeColor}">${v.grade}</span>
          <div><b>${lang === 'en' ? 'Value index' : '价值指数'} ${v.valueIndex}</b>
            <div class="muted">${lang === 'en' ? 'Algorithmic reference, not a deal promise' : '算法参考，非成交承诺'}</div></div>
        </div>
        <div class="lv-row"><span>${lang === 'en' ? 'Per-ep range' : '单集参考'}</span><b>¥${perEp}</b></div>
        <div class="lv-row"><span>${lang === 'en' ? `Full (${s ? s.episodes : 0} eps)` : `全集参考（${s ? s.episodes : 0}集）`}</span><b>¥${range}</b></div>
        <div class="lv-row"><span>${lang === 'en' ? 'Your commission' : '你的佣金'}</span><b>${d.commissionPct}%</b></div>
        ${s ? `<button class="btn-ghost" id="useSuggestedPrice">${lang === 'en' ? 'Use suggested mid price' : '一键填入建议中位价 ¥' + Math.round((s.totalLowYuan + s.totalHighYuan) / 2)}</button>` : ''}
        <button class="btn-ghost" id="genCertPoster" style="margin-left:6px">${isStaffAcct() ? (lang === 'en' ? 'Certified poster · Free' : '生成认证海报（内部免费）') : (lang === 'en' ? 'Certified poster (39 pts)' : '生成认证海报（39积分）')}</button>
        <div class="poster-grid hidden" id="certPosters"></div>`;
      const btn = $('useSuggestedPrice');
      if (btn) btn.onclick = () => { if (s) { $('listPrice').value = Math.round((s.totalLowYuan + s.totalHighYuan) / 2); xnSay(lang === 'en' ? 'Price filled.' : '已填入建议价，可自行调整'); } };
      const pbtn = $('genCertPoster');
      if (pbtn) pbtn.onclick = async () => {
        if (!d.projectId) { xnSay(lang === 'en' ? 'Project missing.' : '缺少项目信息'); return; }
        const certStaff = isStaffAcct();
        if (!(await uiConfirm({ body: certStaff
          ? (lang === 'en' ? 'Generate certified poster? Free for staff accounts.' : '生成认证海报？内部账户免费，确认？')
          : (lang === 'en' ? 'Generate certified poster? Costs 39 credits, no free.' : '生成认证海报将消耗39积分，图片生成无免费，确认？'), okText: lang === 'en' ? 'Continue' : '继续' }))) return;
        pbtn.disabled = true; pbtn.textContent = lang === 'en' ? 'Generating…' : '生成中…';
        try {
          const r = await Api.request('/api/va/poster', { method: 'POST', body: JSON.stringify({ projectId: d.projectId, tier: 'STANDARD', style: '价值认证海报，金色质感，突出等级与指数' }) });
          const j = await Api.jsonOrThrow(r);
          const pg = $('certPosters'); pg.classList.remove('hidden'); pg.innerHTML = (j.images || []).map((u, i) => `<img src="${escapeHtml(u)}" alt="poster${i}" /><div class="muted" style="text-align:center;font-size:11px">${lang === 'en' ? 'Option ' : '方案'}${i + 1}</div>`).join('');
          xnSay(j.staff
            ? (lang === 'en' ? 'Done — free for staff.' : '已生成，内部账户免费，可截图用于宣传')
            : (lang === 'en' ? `Done, spent ${j.points} credits.` : `已生成，消耗${j.points}积分，可截图用于宣传`));
        } catch (e) { xnSay(e.message); } finally { pbtn.disabled = false; pbtn.textContent = certStaff ? (lang === 'en' ? 'Certified poster · Free' : '生成认证海报（内部免费）') : (lang === 'en' ? 'Certified poster (39 pts)' : '生成认证海报（39积分）'); }
      };
    // v2.256：错误源已走 Api.jsonOrThrow 脱敏层；muted 弱提示改 znErrorHtml（⚠ + role=alert）
    } catch (e) { box.innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Failed to load.' : '加载失败')); }
  }
  // v2.228 对齐后端 validatePriceFen（market.ts：≥1 元且为 0.1 元(1积分)整数倍），
  // 上架/重新上架两入口本地同口径预检，粒度不符（如 10.55）不再白跑后端 400
  function priceFenFromYuan(text) {
    const yuan = Number(text);
    if (!Number.isFinite(yuan) || yuan < 1) return null;
    const fen = Math.round(yuan * 100);
    return fen % 10 === 0 ? fen : null;
  }
  // v2.269 上架在途锁：弱网/连点下双击「上架」不得为同一剧本挂出两条重复 listing
  let _listing = false;
  $('listSubmit').onclick = async () => {
    if (_listing) return;
    const scriptId = $('listScript').value;
    const fen = priceFenFromYuan($('listPrice').value);
    if (!scriptId) { xnSay(lang === 'en' ? 'Pick a script first.' : '请选择剧本'); return; }
    if (fen === null) { xnSay(lang === 'en' ? 'Price min ¥1, in 0.1-yuan (1 credit) steps.' : '价格不低于 1 元，且需为 0.1 元(1积分)的整数倍'); return; }
    const sample = $('listSample').value.trim();
    _listing = true;
    try {
      const res = await Api.request('/api/market/listings', { method: 'POST', body: JSON.stringify({ scriptId, priceFen: fen, sample }) });
      await Api.jsonOrThrow(res); $('listModal').classList.add('hidden'); $('listPrice').value = ''; $('listSample').value = '';
      xnSay(t('listedOk')); loadListings();
    } catch (e) { xnSay(e.message); } finally { _listing = false; }
  };
  // v2.260 购买在途锁：双击 detailBuyBtn 不得双扣积分建两笔托管
  let _buyingListing = false;
  async function buyListing(id) {
    if (_buyingListing) return;
    if (!Api.isAuthed()) { openAuth('login'); return; }
    _buyingListing = true;
    const account = capturePrivateSession(), requestSeq = ++purchaseViewSeq;
    try {
      const res = await Api.request(`/api/market/listings/${id}/buy`, { method: 'POST' });
      const d = await Api.jsonOrThrow(res);
      if (!isPrivateSessionCurrent(account) || requestSeq !== purchaseViewSeq) return;
      curPurchase = { id: d.purchaseId, account };
      $('fullTitle').textContent = lang === 'en' ? 'Full script unlocked' : '全本已解锁';
      $('fullText').textContent = d.fullText || '';
      $('fullNotice').textContent = (lang === 'en'
        ? `Spent ${d.spentPoints} credits, held in escrow. Refundable within ${d.refundableWithinHours}h; after confirming, funds settle to seller.`
        : `已支付 ${d.spentPoints} 积分，资金托管中。${d.refundableWithinHours} 小时内可退款；确认收货后货款结算给卖家。`);
      $('fullConfirm').classList.remove('hidden');
      $('fullRefund').classList.remove('hidden');
      openModal('fullModal'); xnSay(t('boughtOk'));
    } catch (e) { if (e.code !== 'SESSION_CHANGED' && isPrivateSessionCurrent(account) && requestSeq === purchaseViewSeq) xnSay(e.message); }
    finally { _buyingListing = false; }
  }
  async function viewPurchasedScript(id) {
    const account = capturePrivateSession(), requestSeq = ++purchaseViewSeq;
    try {
      const res = await Api.request(`/api/market/purchases/${encodeURIComponent(id)}/content`);
      const d = await Api.jsonOrThrow(res);
      if (!isPrivateSessionCurrent(account) || requestSeq !== purchaseViewSeq) return;
      const status = d.status;
      curPurchase = { id, account };
      $('fullTitle').textContent = d.title || (lang === 'en' ? 'Purchased script' : '已购剧本');
      $('fullText').textContent = d.fullText || '';
      $('fullNotice').textContent = status === 'ESCROW'
        ? (lang === 'en' ? 'Funds are held in escrow. Refunds are available within 24 hours of purchase.' : '资金托管中，可在购买后 24 小时内退款。')
        : (lang === 'en' ? 'Purchase complete. Your script remains available here.' : '交易已完成，可随时查看已购剧本。');
      $('fullConfirm').classList.toggle('hidden', status !== 'ESCROW');
      $('fullRefund').classList.toggle('hidden', status !== 'ESCROW');
      $('mineModal').classList.add('hidden');
      openModal('fullModal');
    } catch (e) { if (e.code !== 'SESSION_CHANGED' && isPrivateSessionCurrent(account) && requestSeq === purchaseViewSeq) xnSay(e.message); }
  }
  $('fullCopy').onclick = () => copy($('fullText').textContent);
  $('fullConfirm').onclick = async () => { if (!curPurchase || !isPrivateSessionCurrent(curPurchase.account)) return; await dealAction(`/api/market/purchases/${curPurchase.id}/confirm`); };
  $('fullRefund').onclick = async () => { if (!curPurchase || !isPrivateSessionCurrent(curPurchase.account)) return; await dealAction(`/api/market/purchases/${curPurchase.id}/refund`); };
  // v2.260 确认收货/退款在途锁：双击不重复提交（后端状态机虽会拒第二笔，前端先挡）
  let _dealBusy = false;
  async function dealAction(url) {
    if (_dealBusy) return;
    _dealBusy = true;
    try { const res = await Api.request(url, { method: 'POST' }); const d = await Api.jsonOrThrow(res); $('fullModal').classList.add('hidden'); xnSay(d.notice || (lang === 'en' ? 'Done.' : '操作成功')); loadListings(); }
    catch (e) { xnSay(e.message); }
    finally { _dealBusy = false; }
  }
  $('mkMineBtn').onclick = async () => {
    if (!Api.isAuthed()) { openAuth('login'); return; }
    const account = capturePrivateSession();
    let d, dash;
    try {
      const [resMy, resDash] = await Promise.all([
        Api.request('/api/market/my'),
        Api.request('/api/market/seller-dashboard'),
      ]);
      d = await Api.jsonOrThrow(resMy);
      dash = resDash.ok ? await Api.jsonOrThrow(resDash) : null;
    } catch (e) { if (e.code !== 'SESSION_CHANGED' && isPrivateSessionCurrent(account)) xnSay(e.message); return; }
    if (!isPrivateSessionCurrent(account)) return;
    // @module market
    const row = (x, isBuy) => `<div class="deal-row"><span>#${x.id.slice(-5)} · ${x.pricePoints} ${t('points')} · ${t(x.status === 'ESCROW' ? 'escrow' : x.status === 'REFUNDED' ? 'refunded' : 'settled')}</span>
      ${isBuy && (x.status === 'ESCROW' || x.status === 'SETTLED') ? `<span><button class="btn-ghost" data-view-purchase="${x.id}">${lang === 'en' ? 'View script' : '查看剧本'}</button> ${x.status === 'ESCROW' ? `<button class="btn-ghost" data-confirm="${x.id}">${t('confirmReceive')}</button> <button class="btn-ghost" data-refund="${x.id}">${t('refund24')}</button>` : ''}</span>` : ''}</div>`;
    // v2.75 卖家工作台：统计卡 + 我的上架列表
    let dashHtml = '';
    if (dash && dash.stats) {
      const s = dash.stats;
    // @module market
      const statCard = (label, val, cls) => `<div class="seller-stat ${cls || ''}"><b>${val}</b><span>${label}</span></div>`;
      const listingRows = dash.items.length ? dash.items.map((l) => {
        const grade = l.valueGrade && l.valueGrade !== 'NA' ? `<span class="lv-grade lv-grade-sm">${l.valueGrade}${l.valueIndex != null ? '·' + Math.round(l.valueIndex) : ''}</span>` : '';
        const statusText = l.status === 'ON_SHELF' ? t('onShelf') : l.status === 'SOLD' ? t('soldOut') : l.status === 'OFF_SHELF' ? (lang === 'en' ? 'Delisted' : '已下架') : t('escrow');
        const gain = l.sellerGainPoints != null ? ` · ${lang === 'en' ? 'earned' : '实得'} ${l.sellerGainPoints}${t('points')}` : '';
        const delistBtn = l.status === 'ON_SHELF' ? `<button class="btn-ghost" data-delist="${l.id}">${lang === 'en' ? 'Delist' : '下架'}</button>` : '';
        const relistBtn = l.status === 'OFF_SHELF' ? `<button class="btn-ghost" data-relist="${l.id}">${lang === 'en' ? 'Relist' : '重新上架'}</button>` : '';
        const boardBadge = l.onBoard && l.onBoard.length ? l.onBoard.map((b) => `<span class="board-badge">${b === 'rating' ? '🏆好评榜' : '🔥热销榜'}</span>`).join('') : '';
        // v2.77 在售低价值剧本提升提示：C级或无价值认证且分集<5，引导扩充分集
        const lowVal = l.status === 'ON_SHELF' && ((l.valueGrade === 'C' || l.valueGrade === 'NA' || !l.valueGrade) && (!l.valueEpisodes || l.valueEpisodes < 5));
        const hint = lowVal ? `<div class="seller-hint">${lang === 'en' ? '💡 Expand episodes to raise value grade & price' : '💡 建议扩充分集至5集以上，提升价值等级与售价'}</div>` : '';
        return `<div class="deal-row"><span>${escapeHtml(l.title)} ${grade}${boardBadge} · ${l.pricePoints}${t('points')} · ${statusText}${gain}</span>${delistBtn || relistBtn ? `<span>${delistBtn}${relistBtn}</span>` : ''}</div>${hint}`;
      }).join('') : znEmptyHtml(lang === 'en' ? 'No listings yet' : '暂无上架剧本');
      // v2.78 上榜荣誉横幅
      const honors = dash.honors && dash.honors.length ? dash.honors.map((h) => {
        const boardNames = h.boards.map((b) => b === 'rating' ? (lang === 'en' ? 'Rating Top10' : '好评榜TOP10') : (lang === 'en' ? 'Hot Top10' : '热销榜TOP10')).join(' · ');
        return `<div class="honor-banner">🏆 ${lang === 'en' ? 'Your script' : '您的剧本'}「${escapeHtml(h.title)}」${lang === 'en' ? 'is on' : '正在'} ${boardNames}！</div>`;
      }).join('') : '';
      dashHtml = `<div class="seller-dashboard">
        ${honors}
        <div class="seller-stats">
          ${statCard(lang === 'en' ? 'Total listings' : '上架总数', s.totalListings)}
          ${statCard(lang === 'en' ? 'On shelf' : '在售中', s.onShelf, 'ok')}
          ${statCard(lang === 'en' ? 'Sold' : '已成交', s.sold, 'hot')}
          ${statCard(lang === 'en' ? 'Total earned' : '累计实得', s.totalRevenuePoints + t('points'), 'gold')}
          ${statCard(lang === 'en' ? 'Pending' : '待结算', s.pendingPoints + t('points'), s.pendingPoints > 0 ? 'warn' : '')}
        </div>
        <h4 style="margin:12px 0 6px">${lang === 'en' ? 'My listings' : '我的上架'}</h4>
        ${listingRows}
      </div>`;
    }
    $('mineBox').innerHTML =
      `${dashHtml}
       <h4 style="margin-top:14px">${t('myBuys')}</h4>${d.buys.length ? d.buys.map((x) => row(x, true)).join('') : `<div class="muted">${t('noDeal')}</div>`}
       <h4 style="margin-top:14px">${t('mySales')}</h4>${d.sales.length ? d.sales.map((x) => row(x, false)).join('') : `<div class="muted">${t('noDeal')}</div>`}`;
    $('mineBox').querySelectorAll('[data-confirm]').forEach((b) => b.onclick = async () => { await dealAction(`/api/market/purchases/${b.getAttribute('data-confirm')}/confirm`); $('mkMineBtn').click(); });
    $('mineBox').querySelectorAll('[data-refund]').forEach((b) => b.onclick = async () => { await dealAction(`/api/market/purchases/${b.getAttribute('data-refund')}/refund`); $('mkMineBtn').click(); });
    $('mineBox').querySelectorAll('[data-view-purchase]').forEach((b) => b.onclick = () => viewPurchasedScript(b.getAttribute('data-view-purchase')));
    $('mineBox').querySelectorAll('[data-delist]').forEach((b) => b.onclick = async () => {
      if (!(await uiConfirm({ body: lang === 'en' ? 'Delist this script? It will be removed from the marketplace.' : '确认下架该剧本？下架后将从交易广场移除。', danger: true, okText: lang === 'en' ? 'Delist' : '下架' }))) return;
      // v2.284 网络层 reject 兜底（含非 ok 分支 r.json 次生 throw）；全局 toast 已提示，catch 静默
      try {
      const r = await Api.request(`/api/market/listings/${b.getAttribute('data-delist')}/delist`, { method: 'PATCH' });
      if (r.ok) { xnSay(lang === 'en' ? 'Delisted' : '已下架'); $('mkMineBtn').click(); } else { xnSay(znSanitizeErr((await r.json()).error, r.status) || '失败'); }
      } catch { /* 全局网络 toast 已提示，卡片保留可再操作 */ }
    });
    $('mineBox').querySelectorAll('[data-relist]').forEach((b) => b.onclick = async () => {
      const newPrice = await uiPrompt({ body: lang === 'en' ? 'New price in yuan (leave empty to keep current):' : '输入新售价（元），留空保持原价：' });
      if (newPrice === null) return;
      const body = {};
      if (newPrice.trim()) {
        const fen = priceFenFromYuan(newPrice);
        if (fen === null) { xnSay(lang === 'en' ? 'Price min ¥1, in 0.1-yuan (1 credit) steps.' : '价格不低于 1 元，且需为 0.1 元(1积分)的整数倍'); return; }
        body.priceFen = fen;
      }
      // v2.284 网络层 reject 兜底；全局 toast 已提示，catch 静默
      try {
      const r = await Api.request(`/api/market/listings/${b.getAttribute('data-relist')}/relist`, { method: 'PATCH', body: JSON.stringify(body) });
      if (r.ok) { xnSay(lang === 'en' ? 'Relisted' : '已重新上架'); $('mkMineBtn').click(); } else { xnSay(znSanitizeErr((await r.json()).error, r.status) || '失败'); }
      } catch { /* v2.284 全局网络 toast 已提示， catch 静默防 unhandledrejection */ }
    });
    openModal('mineModal');
  };

  // ═══ MODULE: generate (1058行, 26fn) ═══ 生成（带鉴权 SSE）
  /* ---------- 生成（带鉴权 SSE） ---------- */
  let progress = null, lastDone = null, abortCtrl = null, currentProjectId = null, pendingWarnings = null, lastFiling = null;
  // v2.132 多任务并行队列：每单生成=独立会话（独立 progress/abortCtrl 状态），主视口+任务卡片双视图，生成期间可再开新单
  let genSessions = [];   // {id,title,projectId,progress,abortCtrl,status:'running'|'done'|'failed',doneData,pendingWarnings,error}
  let activeSessionId = null;
  // 切换主视口到指定会话：running 恢复进度视图，done 跳项目详情，failed 展示失败原因
  async function switchSession(id) {
    const s = genSessions.find((x) => x.id === id);
    if (!s) return;
    activeSessionId = s.id;
    progress = s.progress; abortCtrl = s.abortCtrl; currentProjectId = s.projectId;
    lastDone = s.doneData || null; pendingWarnings = s.pendingWarnings || null;
    if (s.status === 'running' && s.progress) {
      closeWorkbench(); switchView('studio');
      resetPanels(); $('progressPanel').classList.remove('hidden'); renderProgress();
    } else if (s.status === 'done' && s.projectId) {
      switchView('works');
      try { await openProject(s.project || { id: s.projectId, title: s.title }); }
      catch (e) { toastError(e.message || (lang === 'en' ? 'Unable to open project.' : '打开作品失败，请重试。')); }
    } else if (s.status === 'failed') {
      resetPanels(); showFail(s.error || (lang === 'en' ? 'failed' : '生成失败'));
    }
    renderTaskQueue();
  }
  // 任务卡片栏：每单一张卡（状态/标题/当前岗位），running 卡点击切主视口，done 卡点击开项目
  function renderTaskQueue() {
    const panel = $('taskQueuePanel'), box = $('taskQueue');
    if (!panel || !box) return;
    if (genSessions.length > 6) {  // 上限 6 张，超出清最旧的非运行中卡片
      const running = genSessions.filter((s) => s.status === 'running');
      const rest = genSessions.filter((s) => s.status !== 'running').slice(0, 6 - running.length);
      genSessions = running.concat(rest);
      if (!genSessions.find((s) => s.id === activeSessionId)) activeSessionId = genSessions[0] ? genSessions[0].id : null;
    }
    if (!genSessions.length) { panel.classList.add('hidden'); box.innerHTML = ''; return; }
    // 切到作品后的 await/生成事件仍会刷新卡片；刷新数据不等于重新打开工作台。
    const studio = $('view-studio');
    panel.classList.toggle('hidden', !studio || studio.classList.contains('hidden'));
    box.innerHTML = genSessions.map((s) => {
      const icon = s.status === 'running' ? '⏳' : (s.status === 'done' ? '✅' : '❌');
      const stTxt = s.status === 'running'
        ? (s.recovering // v2.279：断流恢复中——连接已断但服务端仍在跑，区别于正常进度
          ? (lang === 'en' ? 'reconnecting…' : '重连中·服务端仍在生成')
          : (s.progress && s.progress.percent ? s.progress.percent + '%' : (lang === 'en' ? 'starting' : '启动中')))
        : (s.status === 'done' ? (lang === 'en' ? 'done' : '已完成') : (lang === 'en' ? 'failed' : '已失败'));
      const stage = s.progress && s.progress.label ? translateProgressState(s.progress.label) : '';
      const cur = s.id === activeSessionId;
      return `<div class="task-card ${s.status}${cur ? ' active' : ''}" data-sid="${s.id}" title="${lang === 'en' ? 'Click to view' : '点击查看'}">
        <span class="tk-icon">${icon}</span>
        <span class="tk-body"><b>${escapeHtml(s.title || (lang === 'en' ? 'Untitled task' : '未命名任务'))}</b>
        <small>${stage ? escapeHtml(stage) + ' · ' : ''}${stTxt}</small></span>
        <button class="tk-close" data-close="${s.id}" title="${lang === 'en' ? 'Remove card' : '移除卡片'}">×</button>
      </div>`;
    }).join('');
    box.querySelectorAll('.task-card').forEach((el) => {
      el.onclick = (ev) => { if (ev.target.closest('.tk-close')) return; switchSession(el.getAttribute('data-sid')); };
    });
    box.querySelectorAll('.tk-close').forEach((el) => {
      el.onclick = (ev) => {
        ev.stopPropagation();
        const id = el.getAttribute('data-close');
        const s = genSessions.find((x) => x.id === id);
        if (s && s.status === 'running') { xnSay(lang === 'en' ? 'Task is still running.' : '任务还在生成中，完成后再移除～'); return; }
        genSessions = genSessions.filter((x) => x.id !== id);
        if (activeSessionId === id) activeSessionId = genSessions[0] ? genSessions[0].id : null;
        renderTaskQueue();
      };
    });
  }
    // @module generate
  const PV = () => window.ProgressView;
  function resetPanels() { ['progressPanel', 'resultPanel', 'failPanel', 'diagPanel', 'investorPanel'].forEach((id) => $(id).classList.add('hidden')); lastDiagnosis = null; }
  let waitTipTimer = null; let waitTipIdx = 0;
  /* B2 v2.200：等待期小南课堂——tips 轮播时同步渲染对应工具的方法论卡片（费曼式：SVG 图 + 白话讲解） */
  function renderWaitLesson(idx) {
    const box = $('waitLesson'); if (!box) return;
    // @module generate
    const lessons = (PV().getXiaonanLessons && PV().getXiaonanLessons(lang === 'en')) || [];
    if (!lessons.length) { box.innerHTML = ''; box.classList.add('hidden'); return; }
    const c = lessons[((idx % lessons.length) + lessons.length) % lessons.length];
    if (!c) { box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML =
      `<div class="wl-head"><b>🎓 ${escapeHtml(c.title || '')}</b></div>` +
      `<div class="wl-oneliner">${escapeHtml(c.oneLiner || '')}</div>` +
      `<div class="wl-diagram">${c.diagram || ''}</div>` +
      c.steps.map((s) => `<div class="wl-step"><b>${escapeHtml(s.name)}</b><span>${escapeHtml(s.explain)}</span></div>`).join('') +
      `<div class="wl-plain">${escapeHtml(c.plainExplain || '')}</div>`;
  }
  function startWaitTips() {
    stopWaitTips();
    const el = $('waitTip'); if (!el) return;
    const tips = PV().waitTips(lang === 'en');
    waitTipIdx = Math.floor(Math.random() * tips.length);
    el.textContent = '💡 ' + tips[waitTipIdx];
    renderWaitLesson(waitTipIdx);
    waitTipTimer = setInterval(() => {
      waitTipIdx = (waitTipIdx + 1) % tips.length;
      el.textContent = '💡 ' + tips[waitTipIdx];
      renderWaitLesson(waitTipIdx);
    }, 6000);
  }
  function stopWaitTips() {
    if (waitTipTimer) { clearInterval(waitTipTimer); waitTipTimer = null; }
    const el = $('waitTip'); if (el) el.textContent = '';
    const box = $('waitLesson'); if (box) { box.innerHTML = ''; box.classList.add('hidden'); }
  }
  function renderRoleStrip() {
    const box = $('roleStrip'); if (!box) return;
    const list = PV().stageList(progress);
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = list.map((s) => {
      const meta = PV().roleMeta(s.role);
      const label = lang === 'en' ? meta.en : meta.zh;
      const state = s.status === 'active' ? 'active' : (s.status === 'done' ? 'done' : '');
      const bg = s.status === 'active' ? `background:${meta.color}` : '';
      return `<span class="role-chip ${state}" style="${bg}" title="${escapeHtml(s.label || '')}">${meta.icon} ${escapeHtml(label)}</span>`;
    }).join('');
  }
  // v2.132 AI 员工工位：岗位独白流水（progress.log 归集→渲染最近12条，最新在上；打回/拦截行橙色高亮）
  function renderStaffLog() {
    const box = $('staffLog'); if (!box) return;
    // @module generate
    const logs = (progress.log || []).slice(-12).reverse();
    if (!logs.length) { box.innerHTML = ''; return; }
    box.innerHTML = logs.map((l) => {
      const meta = PV().roleMeta(l.role);
      const isRetry = /打回|sent back|blocked|拦截|退回/.test(l.note || '');
      return `<div class="staff-line${isRetry ? ' retry' : ''}"><span class="staff-role">${meta.icon} ${escapeHtml(lang === 'en' ? meta.en : meta.zh)}</span><span class="staff-note">${escapeHtml(l.note || '')}</span></div>`;
    }).join('');
  }
  // v2.262 i18n：progress-view 状态机存语义键（state 不落文案），上屏前统一按 lang 翻译；非键原文直通
  function translateProgressState(text) {
    // @module generate
    const K = (window.ProgressView && window.ProgressView.PV_KEYS) || { done: '__pv_done__', failed: '__pv_failed__', cancelled: '__pv_cancelled__' };
    const en = lang === 'en';
    if (text === K.done) return en ? 'Fresh script ready' : '新鲜剧本出炉';
    if (text === K.failed) return en ? 'Generation failed — frozen points will be refunded' : '生成失败，已冻结积分将原路退回';
    if (text === K.cancelled) return en ? 'Generation cancelled — frozen points will be refunded' : '已取消生成，冻结积分将原路退回';
    return text;
  }
  function renderProgress() {
    if (!progress) return;
    $('pctText').textContent = Math.round(progress.percent) + '%';
    $('pbarFill').style.width = progress.percent + '%';
    $('stageLabel').textContent = progress.currentLabel || '';
    $('milestoneText').textContent = PV().milestone(progress.percent, lang !== 'en') || '';
    $('timeline').innerHTML = PV().stageList(progress).map((s) =>
      `<div class="tnode ${s.status === 'active' || s.status === 'done' ? s.status : ''}"><span class="dot"></span><span>${escapeHtml(s.label || '')}</span></div>`).join('');
    renderRoleStrip();
    renderStaffLog();
    if (progress.xiaonanLine) $('xnLine').textContent = progress.xiaonanLine;
    if (progress.tip) { $('xnTip').textContent = progress.tip; $('xnTip').classList.remove('hidden'); }
    $('pointsText').textContent = progress.frozen ? (progress.staff
      ? (lang === 'en' ? 'Internal account · free generation (0 pts)' : '内部账户 · 免费生成（0 积分）')
      : (lang === 'en'
        ? `Frozen ${progress.points} pts${progress.free ? ' (free quota)' : ''}`
        : `已冻结 ${progress.points} 积分${progress.free ? '（免费额度）' : ''}`)) : '';
    if (progress.phase === 'running' || progress.phase === 'context' || progress.phase === 'frozen') {
      if (!waitTipTimer) startWaitTips();
    } else {
      stopWaitTips();
    }
    // v2.233 取消按钮：会话运行中且已捕获 taskId 时可见；点击后置忙直至 cancelled 帧到达
    const as = genSessions.find((s) => s.id === activeSessionId);
    const canCancel = !!(as && as.status === 'running' && as.taskId);
    const cbtn = $('genCancelBtn');
    if (cbtn) {
      cbtn.classList.toggle('hidden', !canCancel);
      cbtn.disabled = !!(as && as.cancelling);
      if (as && as.cancelling) cbtn.textContent = t('genCancelling'); else cbtn.textContent = t('genCancel');
    }
  }
  // ===== 钩子编排控制台（v1.83，PRD 导演钩子体系：用户选项 vs 系统默认） =====
  const hookPref = { mode: 'auto', strength: 'balanced', preferred: [], microFlavors: [] };
  // v2.56 逐结构位点选（pos→hookId），由钩子调色板写入；与 hookPref.preferred 风味软偏好互补
  const hookManual = {};
  let hookPaletteData = null;
  // v2.27 钩子策略：'' = 系统按题材智能默认；也可由用户在策略卡中五选一（用户在下方做了精细自定义时精细项优先）
  let hookStrategy = '';
  // v2.28 节奏曲线策略 / 台词风格策略（同范式：'' = 系统智能默认）
  let paceStrategy = '', dialogueStrategy = '', emotionStrategy = '', characterStrategy = '', customStyleText = '';
  // c223 反套路档位（请求级）：'' = 系统默认 balanced 不传；classic 宽容 / innovative 严格
  let antiStrengthSel = '';
  let creationStrategiesLoaded = false;
  const beatPref = { mode: 'auto', strength: 'balanced', preferred: [], payoffFlavors: [], reversalFlavors: [], emotionFlavors: [] };
  // v2.57 逐集节拍点选（分层 pos→beatId），由节拍调色板写入；与风味软偏好互补
  const beatManual = {};
  let beatPaletteData = null;
  // v2.58 全剧情绪波形事前编排器：最近一次预览数据 + 区间连改落过的情绪键（清空只清这些，不误伤逐点手选）
  let waveDirData = null;
  const waveDirPlaced = new Set();
  let hookOptsLoaded = false; let hookOptsLang = '';
  const HM_ZH = { auto: '系统智能', hybrid: '混合', manual: '我来指定' };
  const HS_ZH = { relax: '舒缓留白', balanced: '均衡', tight: '强钩高密度' };
  const HM_EN = { auto: 'Auto', hybrid: 'Hybrid', manual: 'Manual' };
  const HS_EN = { relax: 'Sparse', balanced: 'Balanced', tight: 'Dense' };
  function refreshHookSummary() {
    const el = $('hookToggleText'); if (!el) return;
    const m = lang === 'en' ? HM_EN : HM_ZH, s = lang === 'en' ? HS_EN : HS_ZH;
    const n = hookPref.preferred.length; const fn = hookPref.microFlavors.length; const mn = Object.keys(hookManual).length; const bmn = Object.keys(beatManual).length;
    const stratName = hookStrategy ? (document.querySelector('.strat-chip.on')?.textContent || hookStrategy) : (lang === 'en' ? 'Smart Auto' : '系统智能');
    el.textContent = (lang === 'en' ? 'Hooks: ' : '钩子编排：') + '[' + stratName + '] ' + m[hookPref.mode] + '·' + s[hookPref.strength] + (n ? (lang === 'en' ? `·${n} picked` : `·已选${n}`) : '') + (fn ? (lang === 'en' ? `·${fn} flavor(s)` : `·${fn}种风味`) : '') + (mn ? (lang === 'en' ? `·${mn} fixed` : `·${mn}处定点`) : '') + (bmn ? (lang === 'en' ? `·${bmn} beats fixed` : `·节拍${bmn}处定点`) : '');
    const HM_T = lang === 'en' ? { auto: 'Auto (default)', hybrid: 'Hybrid (my picks first)', manual: 'I decide' } : { auto: '系统智能(默认)', hybrid: '混合(我选的优先)', manual: '我来指定' };
    const HS_T = lang === 'en' ? { relax: 'Sparse/breathing', balanced: 'Balanced (rec.)', tight: 'Dense hooks' } : { relax: '舒缓留白', balanced: '均衡(推荐)', tight: '强钩高密度' };
    document.querySelectorAll('[data-hm]').forEach((sp) => { sp.textContent = HM_T[sp.dataset.hm] || sp.textContent; });
    document.querySelectorAll('[data-hs]').forEach((sp) => { sp.textContent = HS_T[sp.dataset.hs] || sp.textContent; });
    const ml = $('hookModeLbl'), sl = $('hookStrLbl'), ph = $('hookPickHint');
    if (ml) ml.textContent = lang === 'en' ? 'Mode' : '编排方式';
    if (sl) sl.textContent = lang === 'en' ? 'Density' : '钩子密度';
    if (ph) ph.textContent = lang === 'en' ? 'Pick preferred hooks and reversal/payoff/emotion beats (multi; none = auto). Click again to remove:' : '点选你偏好的钩子与反转/爽点/情绪节拍（可多选，不选则系统智能排布；再点取消）：';
  }
  // v2.44 策略卡语言：跟随"输出语言"六语（zh/en/ja/ko/es/ar），未选时跟随界面语言
    // @module generate
  const strategyLocale = () => {
    const ol = $('outLang')?.value;
    return ['zh', 'en', 'ja', 'ko', 'es', 'ar'].includes(ol) ? ol : (lang === 'en' ? 'en' : 'zh');
  };
  async function loadHookOptions() {
    const sloc = strategyLocale();
    if (hookOptsLoaded && hookOptsLang === sloc) return;
    hookOptsLang = sloc;
    if (!Api.isAuthed()) return; // 选项需登录，未登录不加载，不影响默认生成
    let j;
    try {
      // v2.255：取数走 jsonOrThrow 脱敏层；失败内部兜底渲染降级态，外部 .catch(()=>{}) 不再造成永久空白
      const hr = await Api.request('/api/generate/hook-options?lang=' + encodeURIComponent(sloc));
      j = await Api.jsonOrThrow(hr);
    } catch (e) {
      const eb = $('hookPickers');
      if (eb) {
        eb.innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Failed to load strategies.' : '策略选项加载失败'))
          + '<div class="zn-retry-row"><button type="button" class="btn-ghost hook-opts-retry">' + (lang === 'en' ? 'Retry' : '重试') + '</button></div>';
        const rb = eb.querySelector('.hook-opts-retry');
        if (rb) rb.onclick = () => { loadHookOptions().catch(() => {}); };
      }
      return; // hookOptsLoaded 保持 false，重试或下次进入时重新拉取
    }
    const box = $('hookPickers'); box.innerHTML = '';
    // v2.04 按题材/梗概智能推荐四轴风味（不耗积分）：一键回填微钩/爽点/反转/情绪风味并说明理由
    const recBar = document.createElement('div'); recBar.className = 'hook-group flavor-rec-bar';
    const recBtn = document.createElement('button'); recBtn.type = 'button'; recBtn.className = 'chip flavor-rec-btn';
    recBtn.textContent = lang === 'en' ? '✨ Recommend flavors from my idea' : '✨ 按我的题材智能推荐风味';
    recBtn.title = lang === 'en' ? 'Reads your brief/tags and suggests hook/payoff/reversal/emotion flavors. No credits used.' : '读取你的梗概或所选标签，推荐微钩/爽点/反转/情绪风味组合，不耗积分';
    recBtn.onclick = async () => {
      try {
        recBtn.disabled = true;
    // @module generate
        const tagBrief = (typeof buildTagBrief === 'function') ? buildTagBrief() : '';
    // @module generate
        const brief = (tagBrief && tagBrief.trim()) ? tagBrief : ($('modeBrief')?.value || '');
        const res = await Api.request('/api/generate/flavor-recommend', { method: 'POST', body: JSON.stringify({ brief, lang: lang === 'en' ? 'en' : 'zh' }) });
        const d = await res.json();
        if (!res.ok) throw new Error(znSanitizeErr(d.error, res.status) || 'recommend failed');
        hookPref.microFlavors = (d.microFlavors || []).map((x) => x.id);
        beatPref.payoffFlavors = (d.payoffFlavors || []).map((x) => x.id);
        beatPref.reversalFlavors = (d.reversalFlavors || []).map((x) => x.id);
        beatPref.emotionFlavors = (d.emotionFlavors || []).map((x) => x.id);
        hookOptsLoaded = false; await loadHookOptions(); // 用最新选中态重渲染 chips
        refreshHookSummary();
        const names = (arr) => arr.map((x) => x.name).join(lang === 'en' ? ', ' : '、');
        const head = lang === 'en' ? 'Recommended by genre:' : '小南按题材为你搭配：';
        const lines = [
          (d.microFlavors || []).length ? `${lang === 'en' ? 'Micro-hook' : '微钩'}：${names(d.microFlavors)}` : '',
          (d.payoffFlavors || []).length ? `${lang === 'en' ? 'Payoff' : '爽点'}：${names(d.payoffFlavors)}` : '',
          (d.reversalFlavors || []).length ? `${lang === 'en' ? 'Reversal' : '反转'}：${names(d.reversalFlavors)}` : '',
          (d.emotionFlavors || []).length ? `${lang === 'en' ? 'Emotion' : '情绪'}：${names(d.emotionFlavors)}` : '',
        ].filter(Boolean);
        xnSay(`${head}\n${lines.join('\n')}${(d.reasons || []).length ? `\n${lang === 'en' ? 'Why' : '为什么'}：${d.reasons.join(lang === 'en' ? ' ' : '；')}` : ''}`);
      } catch (e) {
        xnSay(lang === 'en' ? `Recommendation failed: ${e.message}` : `推荐失败：${e.message}`);
      } finally { recBtn.disabled = false; }
    };
    recBar.appendChild(recBtn);
    // v2.192 c192 五大策略一键匹配：后端 hook-strategy/recommend + creation-strategy/recommend
    // 两个零积分推荐端点此前前端零接线（端点存在+契约测试完备 ≠ 用户可达）。一次并发回填
    // 钩子/节奏/台词/情绪/人物五策略并播报理由；不选=智能的产品语义不变，回填后仍可手动改。
    const stratBtn = document.createElement('button'); stratBtn.type = 'button'; stratBtn.className = 'chip flavor-rec-btn strat-rec-btn';
    stratBtn.textContent = lang === 'en' ? '🧠 Auto-match all 5 strategies' : '🧠 按题材一键匹配五大策略';
    stratBtn.title = lang === 'en' ? 'Reads your brief/tags and picks hook + pacing + dialogue + emotion + character strategies at once, with reasons. No credits. You can still tweak each.' : '读取梗概与标签，一次配好钩子/节奏/台词/情绪/人物五套策略并说明理由，不耗积分；配好仍可逐项手改';
    stratBtn.onclick = async () => {
      try {
        stratBtn.disabled = true;
        const tagBrief = (typeof buildTagBrief === 'function') ? buildTagBrief() : '';
        const brief = (tagBrief && tagBrief.trim()) ? tagBrief : ($('modeBrief')?.value || '');
        const sloc = strategyLocale(); // 策略卡内容六语跟随输出语言，与列表端点同口径
        const payload = { brief, tags: tagChosen, mode: selectedMode, lang: sloc };
        const [hRes, cRes] = await Promise.all([
          Api.request('/api/generate/hook-strategy/recommend', { method: 'POST', body: JSON.stringify(payload) }),
          Api.request('/api/generate/creation-strategy/recommend', { method: 'POST', body: JSON.stringify(payload) }),
        ]);
        const hd = await hRes.json(), cd = await cRes.json();
        if (!hRes.ok) throw new Error(znSanitizeErr(hd.error, hRes.status) || 'hook recommend failed');
        if (!cRes.ok) throw new Error(znSanitizeErr(cd.error, cRes.status) || 'creation recommend failed');
        // 回填五个策略变量（端点本场景全部 auto=true）
        hookStrategy = hd.strategy?.id || '';
        paceStrategy = cd.pace?.card?.id || '';
        dialogueStrategy = cd.dialogue?.card?.id || '';
        emotionStrategy = cd.emotion?.card?.id || '';
        characterStrategy = cd.character?.card?.id || '';
        hookOptsLoaded = false; await loadHookOptions(); // 整区按最新选中态重渲染 chips
        refreshHookSummary();
        // 播报：仅自动推荐项（auto），逐条给名字+理由
        const isEn = lang === 'en';
        const lines = [];
    // @module generate
        const pushLine = (label, card, reason) => {
          if (!card) return;
          lines.push(`${label}：${card.name}${reason ? `（${reason}）` : ''}`);
        };
        if (hd.auto !== false) pushLine(isEn ? 'Hook' : '钩子', hd.strategy, hd.reason);
        if (cd.pace?.auto !== false) pushLine(isEn ? 'Pacing' : '节奏', cd.pace.card, cd.pace.reason);
        if (cd.dialogue?.auto !== false) pushLine(isEn ? 'Dialogue' : '台词', cd.dialogue.card, cd.dialogue.reason);
        if (cd.emotion?.auto !== false) pushLine(isEn ? 'Emotion' : '情绪', cd.emotion.card, cd.emotion.reason);
        if (cd.character?.auto !== false) pushLine(isEn ? 'Character' : '人物', cd.character.card, cd.character.reason);
        xnSay(`${isEn ? 'Strategies matched to your genre:' : '小南按题材为你配好五套策略：'}\n${lines.join('\n')}`);
      } catch (e) {
        xnSay(lang === 'en' ? `Strategy match failed: ${e.message}` : `策略匹配失败：${e.message}`);
      } finally { stratBtn.disabled = false; }
    };
    recBar.appendChild(stratBtn);
    box.appendChild(recBar);
    // v2.27 钩子策略卡（用户选项 vs 系统默认）：系统智能 + 5 套命名策略，一键选择；不选=系统按题材自动
    if (Array.isArray(j.strategies) && j.strategies.length) {
      const sg = document.createElement('div'); sg.className = 'hook-group strategy-group';
      const title = document.createElement('div'); title.className = 'hook-group-title';
      title.textContent = lang === 'en' ? 'Hook strategy (pick one; default = smart auto by genre)' : '钩子策略（选一套，不选则系统按题材自动匹配）';
      sg.appendChild(title);
      const row = document.createElement('div'); row.className = 'chip-row';
      const autoChip = document.createElement('button'); autoChip.type = 'button'; autoChip.className = 'chip strat-chip' + (hookStrategy === '' ? ' on' : '');
      autoChip.textContent = lang === 'en' ? '🧠 Smart Auto' : '🧠 系统智能';
      autoChip.title = lang === 'en' ? 'The system reads your genre/tags and picks the best strategy, and tells you why via Xiaonan' : '系统读取题材与标签自动匹配最优策略，并由小南告知原因';
      autoChip.onclick = () => { hookStrategy = ''; row.querySelectorAll('.strat-chip').forEach((c) => c.classList.remove('on')); autoChip.classList.add('on'); refreshHookSummary(); };
      row.appendChild(autoChip);
      j.strategies.forEach((st) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip strat-chip' + (hookStrategy === st.id ? ' on' : '');
        c.textContent = st.name;
        c.title = `${st.tagline}\n${lang === 'en' ? 'Best for: ' : '适用：'}${st.fit}｜${lang === 'en' ? 'Density: ' : '密度：'}${st.strength}`;
        c.onclick = () => { hookStrategy = st.id; row.querySelectorAll('.strat-chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); refreshHookSummary(); xnSay(`${st.name}：${st.tagline}`); };
        row.appendChild(c);
      });
      sg.appendChild(row); box.appendChild(sg);
    }
    // v2.28 节奏/台词策略卡（与钩子策略同范式）
    if (!creationStrategiesLoaded || window.__csCache?.lang !== strategyLocale()) {
      try {
        const cr = await (await Api.request('/api/generate/creation-strategies?lang=' + encodeURIComponent(strategyLocale()))).json();
        window.__csCache = cr; creationStrategiesLoaded = true;
      } catch { window.__csCache = null; }
    }
    const cs = window.__csCache;
    // @module generate
    const buildCsGroup = (titleText, list, getter, setter) => {
      if (!Array.isArray(list) || !list.length) return null;
      const g = document.createElement('div'); g.className = 'hook-group strategy-group';
      const t = document.createElement('div'); t.className = 'hook-group-title'; t.textContent = titleText; g.appendChild(t);
      const row = document.createElement('div'); row.className = 'chip-row';
      const auto = document.createElement('button'); auto.type = 'button'; auto.className = 'chip strat-chip' + (getter() === '' ? ' on' : '');
      auto.textContent = lang === 'en' ? '🧠 Smart Auto' : '🧠 系统智能';
      auto.onclick = () => { setter(''); row.querySelectorAll('.strat-chip').forEach((c) => c.classList.remove('on')); auto.classList.add('on'); };
      row.appendChild(auto);
      list.forEach((st) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip strat-chip' + (getter() === st.id ? ' on' : '');
        c.textContent = st.name;
        c.title = `${st.tagline}\n${lang === 'en' ? 'Best for: ' : '适用：'}${st.fit}`;
        c.onclick = () => { setter(st.id); row.querySelectorAll('.strat-chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); xnSay(`${st.name}：${st.tagline}`); };
        row.appendChild(c);
      });
      g.appendChild(row); return g;
    };
    if (cs) {
      const pg = buildCsGroup(lang === 'en' ? 'Pacing strategy (default = smart auto by genre)' : '节奏策略（不选则系统按题材自动匹配）', cs.pace, () => paceStrategy, (v) => { paceStrategy = v; });
      if (pg) box.appendChild(pg);
      const dg = buildCsGroup(lang === 'en' ? 'Dialogue style (default = smart auto by genre)' : '台词风格（不选则系统按题材自动匹配）', cs.dialogue, () => dialogueStrategy, (v) => { dialogueStrategy = v; });
      if (dg) box.appendChild(dg);
      const eg = buildCsGroup(lang === 'en' ? 'Emotional arc (default = smart auto by genre)' : '情绪/爽点曲线（不选则系统按题材自动匹配）', cs.emotion, () => emotionStrategy, (v) => { emotionStrategy = v; });
      if (eg) box.appendChild(eg);
      const cg2 = buildCsGroup(lang === 'en' ? 'Character & relationship (default = smart auto by genre)' : '人物与关系（不选则系统按题材自动匹配）', cs.character, () => characterStrategy, (v) => { characterStrategy = v; });
      if (cg2) box.appendChild(cg2);
    }
    // c223 反套路档位：严格度控制套路桥段放行上限（classic≤4处 / balanced≤2处 / innovative 0处），
    // 不选走系统默认 balanced；选择随请求落库 _profile，/fix 修复重放同档不漂移
    {
      const ag = document.createElement('div'); ag.className = 'hook-group strategy-group';
      const at = document.createElement('div'); at.className = 'hook-group-title';
      at.textContent = lang === 'en' ? 'Anti-cliché strictness (default = balanced)' : '反套路严格度（不选则系统默认均衡档）';
      ag.appendChild(at);
      const arow = document.createElement('div'); arow.className = 'chip-row';
      const tiers = [
        { id: 'classic', zh: '宽容（经典桥段可留）', en: 'Lenient', tipZh: '允许常见桥段（≤4 处），适合练手稿/快速出稿', tipEn: 'Allows up to 4 familiar tropes; good for drafts' },
        { id: 'balanced', zh: '均衡（系统默认）', en: 'Balanced (default)', tipZh: '适中拦截（≤2 处），多数题材的推荐档', tipEn: 'Moderate filtering (≤2 hits); recommended' },
        { id: 'innovative', zh: '严格（零套路）', en: 'Strict (zero clichés)', tipZh: '零容忍套路，追求新颖表达的精品稿', tipEn: 'Zero tolerance for tropes; premium output' },
      ];
      tiers.forEach((t) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip strat-chip' + (antiStrengthSel === t.id || (t.id === 'balanced' && antiStrengthSel === '') ? ' on' : '');
        c.textContent = lang === 'en' ? t.en : t.zh;
        c.title = lang === 'en' ? t.tipEn : t.tipZh;
        c.onclick = () => {
          antiStrengthSel = t.id === 'balanced' ? '' : t.id; // balanced=默认不传，减负 payload
          arow.querySelectorAll('.strat-chip').forEach((x) => x.classList.remove('on'));
          c.classList.add('on');
        };
        arow.appendChild(c);
      });
      ag.appendChild(arow); box.appendChild(ag);
    }
    // v2.32 参考剧本学风格（会员能力）：只学叙事节奏与语言风格，不抄情节原句；≥100字才提交
    {
      const cg = document.createElement('div'); cg.className = 'hook-group strategy-group';
      const ct = document.createElement('div'); ct.className = 'hook-group-title';
      ct.textContent = lang === 'en' ? 'Learn style from a reference script (BASIC+)' : '参考剧本学风格（基础会员及以上，只学风格不抄内容）';
      cg.appendChild(ct);
      const ta = document.createElement('textarea');
      ta.rows = 3; ta.maxLength = 20000; ta.className = 'custom-style-input';
      ta.placeholder = lang === 'en' ? 'Paste 100+ chars of a reference script; we mirror its rhythm and tone only' : '粘贴100字以上参考剧本片段，系统只学习其节奏与语感，不会照搬情节和原句';
      ta.value = customStyleText || '';
      ta.oninput = () => { customStyleText = ta.value; };
      cg.appendChild(ta); box.appendChild(cg);
    }
    // v2.01 微钩风味（动作/语言/氛围/情绪/信息差/伏笔）：软偏好，多选，不选则系统均衡轮换
    if (Array.isArray(j.flavors) && j.flavors.length) {
      const grp = document.createElement('div'); grp.className = 'hook-group';
      grp.innerHTML = `<div class="hook-group-label">${lang === 'en' ? 'Micro-hook flavor (soft preference, multi)' : '微钩风味偏好（软加权·可多选·不选则系统均衡）'}</div>`;
      const wrap = document.createElement('div'); wrap.className = 'hook-chips';
      j.flavors.forEach((f) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip hook-chip flavor-chip';
        c.textContent = f.name; c.title = f.desc || ''; c.dataset.flavor = f.id;
        if (hookPref.microFlavors.includes(f.id)) c.classList.add('on');
        c.onclick = () => {
          const i = hookPref.microFlavors.indexOf(f.id);
          if (i >= 0) { hookPref.microFlavors.splice(i, 1); c.classList.remove('on'); }
          else { hookPref.microFlavors.push(f.id); c.classList.add('on'); }
          refreshHookSummary();
        };
        wrap.appendChild(c);
      });
      grp.appendChild(wrap); box.appendChild(grp);
    }
    j.layers.forEach((L) => {
      const grp = document.createElement('div'); grp.className = 'hook-group';
      grp.innerHTML = `<div class="hook-group-label">${escapeHtml(L.label)}</div>`;
      const wrap = document.createElement('div'); wrap.className = 'hook-chips';
      L.hooks.forEach((h) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip hook-chip';
        c.textContent = h.name; c.title = (h.definition || '') + (h.example ? (lang === 'en' ? '\ne.g. ' + h.example : '\n例：' + h.example) : '');
        c.dataset.id = h.id;
        c.onclick = () => {
          const i = hookPref.preferred.indexOf(h.id);
          if (i >= 0) { hookPref.preferred.splice(i, 1); c.classList.remove('on'); }
          else { if (hookPref.preferred.length >= 12) { xnSay(lang === 'en' ? 'Pick at most 12 hooks.' : '最多偏好12个钩子，系统会轮换使用～'); return; } hookPref.preferred.push(h.id); c.classList.add('on'); }
          refreshHookSummary();
        };
        wrap.appendChild(c);
      });
      grp.appendChild(wrap); box.appendChild(grp);
    });
    // 反转/爽点/情绪节拍（与钩子同构，复用同一套方式与密度）
    // v2.02 爽点风味（打脸现报/逆袭翻盘/身份实力压制/真相正义/甜暖）：软加权多选，不选则系统均衡
    if (Array.isArray(j.payoffFlavors) && j.payoffFlavors.length) {
      const grp = document.createElement('div'); grp.className = 'hook-group';
      grp.innerHTML = `<div class="hook-group-label">${lang === 'en' ? 'Payoff flavor (soft preference, multi)' : '爽点风味偏好（软加权·可多选·不选则系统均衡）'}</div>`;
      const wrap = document.createElement('div'); wrap.className = 'hook-chips';
      j.payoffFlavors.forEach((f) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip hook-chip flavor-chip';
        c.textContent = f.name; c.title = f.desc || '';
        if (beatPref.payoffFlavors.includes(f.id)) c.classList.add('on');
        c.onclick = () => {
          const i = beatPref.payoffFlavors.indexOf(f.id);
          if (i >= 0) { beatPref.payoffFlavors.splice(i, 1); c.classList.remove('on'); }
          else { beatPref.payoffFlavors.push(f.id); c.classList.add('on'); }
          refreshHookSummary();
        };
        wrap.appendChild(c);
      });
      grp.appendChild(wrap); box.appendChild(grp);
    }
    // v2.03 反转风味 / 情绪风味（与爽点风味同构的软加权多选）
    const beatFlavorGroups = [
      { list: j.reversalFlavors, store: beatPref.reversalFlavors, zh: '反转风味偏好（软加权·可多选）', en: 'Reversal flavor (soft preference, multi)' },
      { list: j.emotionFlavors, store: beatPref.emotionFlavors, zh: '情绪风味偏好（软加权·有压必放优先）', en: 'Emotion flavor (soft; press→release guaranteed)' },
    ];
    beatFlavorGroups.forEach((cfg) => {
      if (!Array.isArray(cfg.list) || !cfg.list.length) return;
      const grp = document.createElement('div'); grp.className = 'hook-group';
      grp.innerHTML = `<div class="hook-group-label">${lang === 'en' ? cfg.en : cfg.zh}</div>`;
      const wrap = document.createElement('div'); wrap.className = 'hook-chips';
      cfg.list.forEach((f) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip hook-chip flavor-chip';
        c.textContent = f.name; c.title = f.desc || '';
        if (cfg.store.includes(f.id)) c.classList.add('on');
        c.onclick = () => {
          const i = cfg.store.indexOf(f.id);
          if (i >= 0) { cfg.store.splice(i, 1); c.classList.remove('on'); }
          else { cfg.store.push(f.id); c.classList.add('on'); }
          refreshHookSummary();
        };
        wrap.appendChild(c);
      });
      grp.appendChild(wrap); box.appendChild(grp);
    });
    (j.beats || []).forEach((B) => {
      const grp = document.createElement('div'); grp.className = 'hook-group';
      grp.innerHTML = `<div class="hook-group-label">${escapeHtml(B.label)}${lang === 'en' ? ' (beats)' : '（节拍）'}</div>`;
      const wrap = document.createElement('div'); wrap.className = 'hook-chips';
      B.items.forEach((b) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip hook-chip beat-chip';
        c.textContent = b.name; c.title = (b.definition || '') + (b.example ? (lang === 'en' ? '\ne.g. ' + b.example : '\n例：' + b.example) : '');
        c.onclick = () => {
          const i = beatPref.preferred.indexOf(b.id);
          if (i >= 0) { beatPref.preferred.splice(i, 1); c.classList.remove('on'); }
          else { if (beatPref.preferred.length >= 12) { xnSay(lang === 'en' ? 'Pick at most 12 beats.' : '最多偏好12个节拍～'); return; } beatPref.preferred.push(b.id); c.classList.add('on'); }
          refreshHookSummary();
        };
        wrap.appendChild(c);
      });
      grp.appendChild(wrap); box.appendChild(grp);
    });
    renderHookPaletteBar(box);
    renderBeatPaletteBar(box);
    renderWaveDirector(box);
    hookOptsLoaded = true; hookOptsLang = strategyLocale();
  }
  // v2.56 钩子调色板：逐结构位「系统默认+2备选+理由」，点备选即接管该位（hybrid），不耗积分
  function renderHookPaletteBar(box) {
    const grp = document.createElement('div'); grp.className = 'hook-group hook-palette-group';
    const head = document.createElement('div'); head.className = 'hook-group-label';
    head.textContent = lang === 'en' ? 'Per-position hook palette (system default + alternatives)' : '逐点钩子调色板（系统默认 + 备选，点选即接管）';
    grp.appendChild(head);
    const ctrl = document.createElement('div'); ctrl.className = 'palette-ctrl';
    const scenesSel = document.createElement('select'); scenesSel.className = 'palette-scenes';
    [2, 3, 4, 5, 6, 7, 8].forEach((n) => { const o = document.createElement('option'); o.value = String(n); o.textContent = (lang === 'en' ? `${n} scenes/ep` : `每集${n}场`); if (n === 4) o.selected = true; scenesSel.appendChild(o); });
    const genBtn = document.createElement('button'); genBtn.type = 'button'; genBtn.className = 'chip palette-gen';
    genBtn.textContent = lang === 'en' ? '🎯 Build palette' : '🎯 生成逐点方案';
    const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'chip palette-clear';
    clearBtn.textContent = lang === 'en' ? 'Reset my picks' : '清空我的点选';
    ctrl.appendChild(scenesSel); ctrl.appendChild(genBtn); ctrl.appendChild(clearBtn); grp.appendChild(ctrl);
    const note = document.createElement('div'); note.className = 'muted palette-note'; grp.appendChild(note);
    const body = document.createElement('div'); body.className = 'palette-body'; grp.appendChild(body);
    box.appendChild(grp);

    const chip = (opt, pos, isDefault) => {
      const c = document.createElement('button'); c.type = 'button';
      c.className = 'chip palette-chip' + (isDefault ? ' sys' : ' alt');
      const picked = hookManual[pos] === opt.id || (!hookManual[pos] && isDefault);
      if (picked) c.classList.add('on');
      c.innerHTML = (isDefault ? '★ ' : '') + escapeHtml(opt.name);
      c.title = (opt.definition || '') + '\n' + (lang === 'en' ? 'Why: ' : '理由：') + (opt.reason?.zh || opt.reason || '') + (opt.example ? (lang === 'en' ? '\ne.g. ' : '\n例：') + opt.example : '');
      c.onclick = () => {
        if (isDefault) delete hookManual[pos]; else hookManual[pos] = opt.id;
        if (Object.keys(hookManual).length) hookPref.mode = 'hybrid'; else hookPref.mode = 'auto';
        const radios = document.querySelectorAll('input[name="hookMode"]');
        radios.forEach((r) => { r.checked = (r.value === hookPref.mode); });
        body.querySelectorAll('.palette-chip').forEach((x) => x.classList.remove('on'));
        // 重刷该 pos 的 on 态
        body.querySelectorAll(`[data-pos="${pos}"] .palette-chip`).forEach((x) => {
          if (x.dataset.id === (hookManual[pos] || x.dataset.default)) x.classList.add('on');
        });
        refreshHookSummary();
      };
      c.dataset.pos = String(pos); c.dataset.id = opt.id; if (isDefault) c.dataset.default = opt.id;
      return c;
    };
    // @module generate
    const renderBody = () => {
      body.innerHTML = '';
      if (!hookPaletteData) return;
      note.textContent = (hookPaletteData.note || '') + (lang === 'en' ? ' · This hook map is embedded in docx/pdf/txt downloads' : ' · 本逐集钩子地图会内嵌进 docx/pdf/txt 下载文件');
      const byEp = new Map();
      hookPaletteData.positions.forEach((p) => { if (!byEp.has(p.ep)) byEp.set(p.ep, []); byEp.get(p.ep).push(p); });
      const maxEp = Math.min(byEp.size, 12); // 界面默认展开前12集，再多折叠，避免超长
      let shown = 0;
      byEp.forEach((list, ep) => {
        shown++;
        const epBox = document.createElement('div'); epBox.className = 'palette-ep' + (shown > maxEp ? ' hidden' : '');
        epBox.innerHTML = `<div class="palette-ep-title">${lang === 'en' ? 'Episode ' : '第'}${ep}${lang === 'en' ? '' : '集'}</div>`;
        list.forEach((p) => {
          const row = document.createElement('div'); row.className = 'palette-row';
          const lb = document.createElement('span'); lb.className = 'palette-row-label'; lb.textContent = p.label;
          row.appendChild(lb);
          const chips = document.createElement('span'); chips.className = 'palette-row-chips';
          chips.appendChild(chip(p.systemDefault, p.pos, true));
          p.alternatives.forEach((a) => chips.appendChild(chip(a, p.pos, false)));
          row.appendChild(chips); epBox.appendChild(row);
        });
        body.appendChild(epBox);
      });
      if (byEp.size > maxEp) {
        const more = document.createElement('button'); more.type = 'button'; more.className = 'chip palette-more';
        more.textContent = lang === 'en' ? `Show all ${byEp.size} episodes` : `展开全部 ${byEp.size} 集`;
        more.onclick = () => { body.querySelectorAll('.palette-ep').forEach((e) => e.classList.remove('hidden')); more.remove(); };
        body.appendChild(more);
      }
    };
    genBtn.onclick = async () => {
      try {
        genBtn.disabled = true;
        const epCount = Math.max(1, Math.min(120, parseInt(($('episodes') || {}).value || '20', 10) || 20));
        const tagBrief = (typeof buildTagBrief === 'function') ? buildTagBrief() : '';
        const tags = Array.isArray(tagChosen) ? tagChosen.slice(0, 40) : [];
        const payload = { episodeCount: epCount, scenesPerEp: parseInt(scenesSel.value, 10), tags, lang: lang === 'en' ? 'en' : 'zh', brief: tagBrief.slice(0, 2000) };
        if (hookStrategy) payload.strategy = hookStrategy;
        const res = await Api.request('/api/generate/hooks/palette', { method: 'POST', body: JSON.stringify(payload) });
        const d = await res.json();
        if (!res.ok) throw new Error(znSanitizeErr(d.error, res.status) || 'palette failed');
        hookPaletteData = d; renderBody();
        xnSay(lang === 'en' ? 'Palette ready: ★ is the system default, tap any alternative to take over.' : '逐点方案已生成：★为系统默认，点备选即可接管该位置，未改的位置系统自动补～');
      } catch (e) { xnSay(String(e.message || e)); } finally { genBtn.disabled = false; }
    };
    clearBtn.onclick = () => {
      Object.keys(hookManual).forEach((k) => delete hookManual[k]);
      hookPref.mode = 'auto';
      document.querySelectorAll('input[name="hookMode"]').forEach((r) => { r.checked = r.value === 'auto'; });
      if (hookPaletteData) renderBody();
      refreshHookSummary();
    };
    if (hookPaletteData) renderBody();
  }
  // v2.57 节拍调色板：逐集「主反转/爽点①②/情绪起承合」系统默认+2备选，点选即接管，不耗积分
  function renderBeatPaletteBar(box) {
    const grp = document.createElement('div'); grp.className = 'hook-group hook-palette-group beat-palette-group';
    const head = document.createElement('div'); head.className = 'hook-group-label';
    head.textContent = lang === 'en' ? 'Per-episode reversal / payoff / emotion palette' : '逐集节拍调色板（主反转·爽点·情绪起承合，点选即接管）';
    grp.appendChild(head);
    const ctrl = document.createElement('div'); ctrl.className = 'palette-ctrl';
    const genBtn = document.createElement('button'); genBtn.type = 'button'; genBtn.className = 'chip palette-gen';
    genBtn.textContent = lang === 'en' ? '🎯 Build beat plan' : '🎯 生成逐集节拍方案';
    const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'chip palette-clear';
    clearBtn.textContent = lang === 'en' ? 'Reset my beat picks' : '清空我的节拍点选';
    ctrl.appendChild(genBtn); ctrl.appendChild(clearBtn); grp.appendChild(ctrl);
    const note = document.createElement('div'); note.className = 'muted palette-note'; grp.appendChild(note);
    const body = document.createElement('div'); body.className = 'palette-body'; grp.appendChild(body);
    box.appendChild(grp);

    const chip = (opt, pos, isDefault) => {
      const c = document.createElement('button'); c.type = 'button';
      c.className = 'chip palette-chip beat-' + opt.kind + (isDefault ? ' sys' : ' alt');
      const picked = beatManual[pos] === opt.id || (!beatManual[pos] && isDefault);
      if (picked) c.classList.add('on');
      c.innerHTML = (isDefault ? '★ ' : '') + escapeHtml(opt.name);
      c.title = (opt.definition || '') + '\n' + (lang === 'en' ? 'Why: ' : '理由：') + (opt.reason || '') + (opt.example ? (lang === 'en' ? '\ne.g. ' : '\n例：') + opt.example : '');
      c.onclick = () => {
        if (isDefault) delete beatManual[pos]; else beatManual[pos] = opt.id;
        if (Object.keys(beatManual).length) beatPref.mode = 'hybrid'; else beatPref.mode = hookPref.mode;
        body.querySelectorAll(`[data-pos="${pos}"] .palette-chip`).forEach((x) => {
          x.classList.toggle('on', x.dataset.id === (beatManual[pos] || x.dataset.default));
        });
        refreshHookSummary();
      };
      c.dataset.pos = String(pos); c.dataset.id = opt.id; if (isDefault) c.dataset.default = opt.id;
      return c;
    };
    const renderBody = () => {
      body.innerHTML = '';
      if (!beatPaletteData) return;
      note.textContent = (beatPaletteData.note || '') + (lang === 'en' ? ' · This payoff/reversal chain and the cast & growth sheet are embedded in docx/pdf/txt downloads' : ' · 本爽点-反转兑现链与人物表成长弧一页纸会内嵌进 docx/pdf/txt 下载文件');
      const maxEp = Math.min(beatPaletteData.episodes.length, 12);
      let shown = 0;
      beatPaletteData.episodes.forEach((ep) => {
        shown++;
        const epBox = document.createElement('div'); epBox.className = 'palette-ep' + (shown > maxEp ? ' hidden' : '');
        epBox.innerHTML = `<div class="palette-ep-title">${lang === 'en' ? 'Episode ' : '第'}${ep.ep}${lang === 'en' ? '' : '集'}</div>`;
        ep.slots.forEach((s) => {
          const row = document.createElement('div'); row.className = 'palette-row';
          const lb = document.createElement('span'); lb.className = 'palette-row-label'; lb.textContent = s.label;
          row.appendChild(lb);
          const chips = document.createElement('span'); chips.className = 'palette-row-chips';
          chips.appendChild(chip(s.systemDefault, s.pos, true));
          s.alternatives.forEach((a) => chips.appendChild(chip(a, s.pos, false)));
          row.appendChild(chips); epBox.appendChild(row);
        });
        body.appendChild(epBox);
      });
      if (beatPaletteData.episodes.length > maxEp) {
        const more = document.createElement('button'); more.type = 'button'; more.className = 'chip palette-more';
        more.textContent = lang === 'en' ? `Show all ${beatPaletteData.episodes.length} episodes` : `展开全部 ${beatPaletteData.episodes.length} 集`;
        more.onclick = () => { body.querySelectorAll('.palette-ep').forEach((e) => e.classList.remove('hidden')); more.remove(); };
        body.appendChild(more);
      }
    };
    genBtn.onclick = async () => {
      try {
        genBtn.disabled = true;
        const epCount = Math.max(1, Math.min(120, parseInt(($('episodes') || {}).value || '20', 10) || 20));
        const tags = Array.isArray(tagChosen) ? tagChosen.slice(0, 40) : [];
        const payload = {
          episodeCount: epCount, strength: hookPref.strength, tags, lang: lang === 'en' ? 'en' : 'zh',
          pref: {
            preferred: [...beatPref.preferred],
            payoffFlavors: [...beatPref.payoffFlavors], reversalFlavors: [...beatPref.reversalFlavors], emotionFlavors: [...beatPref.emotionFlavors],
          },
        };
        const res = await Api.request('/api/generate/beats/palette', { method: 'POST', body: JSON.stringify(payload) });
        const d = await res.json();
        if (!res.ok) throw new Error(znSanitizeErr(d.error, res.status) || 'palette failed');
        beatPaletteData = d; renderBody();
        xnSay(lang === 'en' ? 'Beat plan ready: ★ is the system default, tap any alternative to take over. No credits used.' : '逐集节拍方案已生成：★为系统默认（与实际生成一致），点备选即可接管该节拍位，不耗积分～');
      } catch (e) { xnSay(String(e.message || e)); } finally { genBtn.disabled = false; }
    };
    clearBtn.onclick = () => {
      Object.keys(beatManual).forEach((k) => delete beatManual[k]);
      waveDirPlaced.clear();
      beatPref.mode = hookPref.mode;
      if (beatPaletteData) renderBody();
      refreshHookSummary();
    };
    if (beatPaletteData) renderBody();
  }
  // v2.58 全剧情绪波形事前编排器：生成前预览张力曲线 + 区间框选连改（只写 beatManual 的 30000 情绪段，不碰反转/爽点）
  function renderWaveDirector(box) {
    const grp = document.createElement('div'); grp.className = 'hook-group hook-palette-group wave-director-group';
    const head = document.createElement('div'); head.className = 'hook-group-label';
    head.textContent = lang === 'en'
      ? 'Series emotion wave director (preview & range-edit before writing)'
      : '全剧情绪波形编排（生成前预览 · 区间框选连改）';
    grp.appendChild(head);

    const ctrl = document.createElement('div'); ctrl.className = 'palette-ctrl';
    const prevBtn = document.createElement('button'); prevBtn.type = 'button'; prevBtn.className = 'chip palette-gen';
    prevBtn.textContent = lang === 'en' ? '📈 Preview wave' : '📈 生成波形预览';
    ctrl.appendChild(prevBtn); grp.appendChild(ctrl);

    const svgBox = document.createElement('div'); svgBox.className = 'wave-dir-svg hidden'; grp.appendChild(svgBox);
    const stats = document.createElement('div'); stats.className = 'muted wave-dir-stats'; grp.appendChild(stats);

    const rangeRow = document.createElement('div'); rangeRow.className = 'wave-dir-range hidden';
    // @module generate
    const mkTxt = (t) => document.createTextNode(t);
    rangeRow.appendChild(mkTxt(lang === 'en' ? 'Ep ' : '第 '));
    const fromInput = document.createElement('input'); fromInput.type = 'number'; fromInput.min = '1'; fromInput.className = 'wave-dir-input wave-dir-from'; fromInput.value = '1';
    const toInput = document.createElement('input'); toInput.type = 'number'; toInput.min = '1'; toInput.className = 'wave-dir-input wave-dir-to';
    rangeRow.appendChild(fromInput);
    rangeRow.appendChild(mkTxt(lang === 'en' ? ' – ' : ' 集 — 第 '));
    rangeRow.appendChild(toInput);
    rangeRow.appendChild(mkTxt(lang === 'en' ? '' : ' 集'));
    grp.appendChild(rangeRow);

    const intentRow = document.createElement('div'); intentRow.className = 'hook-chips wave-dir-intents hidden'; grp.appendChild(intentRow);
    const actRow = document.createElement('div'); actRow.className = 'palette-ctrl wave-dir-actions hidden';
    const applyBtn = document.createElement('button'); applyBtn.type = 'button'; applyBtn.className = 'chip palette-gen';
    applyBtn.textContent = lang === 'en' ? '🎚 Apply to range' : '🎚 应用区间连改';
    const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'chip palette-clear';
    clearBtn.textContent = lang === 'en' ? 'Clear range edits' : '清空区间连改';
    actRow.appendChild(applyBtn); actRow.appendChild(clearBtn); grp.appendChild(actRow);

    const note = document.createElement('div'); note.className = 'muted palette-note'; grp.appendChild(note);
    box.appendChild(grp);

    let selectedIntent = '';
    // @module generate
    const epCount = () => Math.max(1, Math.min(120, parseInt(($('episodes') || {}).value || '20', 10) || 20));
    // @module generate
    const basePayload = (extra) => ({
      episodeCount: epCount(), strength: hookPref.strength, lang: lang === 'en' ? 'en' : 'zh',
      tags: Array.isArray(tagChosen) ? tagChosen.slice(0, 40) : [],
      pref: {
        preferred: [...beatPref.preferred],
        payoffFlavors: [...beatPref.payoffFlavors], reversalFlavors: [...beatPref.reversalFlavors], emotionFlavors: [...beatPref.emotionFlavors],
      },
      pins: { ...beatManual }, ...(extra || {}),
    });

    // @module generate
    const drawCurve = (before, after, patch) => {
      const n = before.points.length;
      const Wpx = 640, Hpx = 150, padL = 30, padR = 10, padT = 10, padB = 20;
    // @module generate
      const x = (i) => padL + i * (Wpx - padL - padR) / Math.max(1, n - 1);
    // @module generate
      const y = (v) => padT + (100 - v) * (Hpx - padT - padB) / 100;
    // @module generate
      const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.intensity).toFixed(1)}`).join(' ');
      const grid = [25, 50, 75].map((v) => `<line x1="${padL}" y1="${y(v)}" x2="${Wpx - padR}" y2="${y(v)}" class="wave-grid"/><text x="3" y="${y(v) + 3}" class="wave-axis">${v}</text>`).join('');
      let rangeRect = '';
      if (patch) rangeRect = `<rect x="${x(patch.from - 1)}" y="${padT}" width="${Math.max(2, x(patch.to - 1) - x(patch.from - 1))}" height="${Hpx - padT - padB}" class="wave-dir-range-rect"/>`;
      const main = after || before;
      const dots = main.points.map((p, i) => `<circle class="wave-dot${patch && i + 1 >= patch.from && i + 1 <= patch.to ? ' wave-dot-hit' : ''}" data-ep="${p.ep}" cx="${x(i).toFixed(1)}" cy="${y(p.intensity).toFixed(1)}" r="${n > 60 ? 1.5 : 3}" fill="${p.intensity >= 80 ? '#e06a5b' : p.intensity >= 60 ? '#e0a23a' : '#10b981'}"><title>${escapeHtml(lang === 'en' ? `Ep${p.ep} tension ${p.intensity}` : `第${p.ep}集 张力${p.intensity}`)}</title></circle>`).join('');
      const xLabels = n <= 30 ? main.points.map((p) => (p.ep === 1 || p.ep === n || p.ep % 5 === 0) ? `<text x="${x(p.ep - 1).toFixed(1)}" y="${Hpx - 6}" text-anchor="middle" class="wave-axis">${p.ep}</text>` : '').join('') : '';
      const beforeLine = after ? `<path d="${pathOf(before.points)}" class="wave-dir-before"/>` : '';
      svgBox.innerHTML = `<svg viewBox="0 0 ${Wpx} ${Hpx}" preserveAspectRatio="xMidYMid meet" role="img" class="wave-svg wave-dir-svg-el">${grid}${rangeRect}${beforeLine}<path d="${pathOf(main.points)}" class="${after ? 'wave-dir-after' : 'wave-dir-main'}"/>${dots}${xLabels}</svg>`;
      svgBox.classList.remove('hidden');
      const w = main;
      stats.textContent = (lang === 'en'
        ? `Avg tension ${w.avgIntensity} · peak Ep${w.peakEp} · range ${w.range}${w.flatWarn ? ' · warning: a flat 3-ep stretch' : ''}${after ? ' · dashed = before, solid = after range edit, shaded = edited range' : ''}`
        : `平均张力 ${w.avgIntensity} · 峰值第${w.peakEp}集 · 极差 ${w.range}${w.flatWarn ? ' · 预警：存在连续3集过平' : ''}${after ? ' · 灰虚线=连改前，实线=连改后，阴影=连改区间' : ''}`);
    };

    // @module generate
    const renderIntents = (intents) => {
      intentRow.innerHTML = '';
      intents.forEach((it) => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip wave-dir-intent';
        c.textContent = it.name; c.title = it.desc + (it.triple ? `\n${it.triple.join(' → ')}` : '');
        c.onclick = () => {
          selectedIntent = (selectedIntent === it.id ? '' : it.id);
          intentRow.querySelectorAll('.wave-dir-intent').forEach((x) => x.classList.toggle('on', x === c && selectedIntent));
        };
        intentRow.appendChild(c);
      });
    };

    // @module generate
    const syncBeatChips = () => {
      document.querySelectorAll('.beat-palette-group .palette-chip').forEach((chip) => {
        const pos = chip.dataset.pos;
        chip.classList.toggle('on', chip.dataset.id === (beatManual[pos] || chip.dataset.default));
      });
    };

    prevBtn.onclick = async () => {
      try {
        prevBtn.disabled = true;
        const res = await Api.request('/api/generate/emotion/director', { method: 'POST', body: JSON.stringify(basePayload()) });
        const d = await res.json();
        if (!res.ok) throw new Error(znSanitizeErr(d.error, res.status) || 'wave failed');
        waveDirData = d;
        fromInput.max = String(d.episodeCount); toInput.max = String(d.episodeCount);
        if (!toInput.value || parseInt(toInput.value, 10) > d.episodeCount) toInput.value = String(d.episodeCount);
        note.textContent = d.note || '';
        drawCurve(d.waveBefore, d.waveAfter, d.patch);
        renderIntents(d.intents || []);
        rangeRow.classList.remove('hidden'); intentRow.classList.remove('hidden'); actRow.classList.remove('hidden');
      } catch (e) { xnSay(String(e.message || e)); } finally { prevBtn.disabled = false; }
    };

    applyBtn.onclick = async () => {
      if (!selectedIntent) { xnSay(lang === 'en' ? 'Pick a wave intent first.' : '先选一个波形意图～'); return; }
      const n = epCount();
      let a = parseInt(fromInput.value, 10), b = parseInt(toInput.value, 10);
      if (!Number.isFinite(a)) a = 1; if (!Number.isFinite(b)) b = n;
      try {
        applyBtn.disabled = true;
        const res = await Api.request('/api/generate/emotion/director', { method: 'POST', body: JSON.stringify(basePayload({ from: a, to: b, intent: selectedIntent })) });
        const d = await res.json();
        if (!res.ok || !d.patch) throw new Error(znSanitizeErr(d.error, res.status) || 'range failed');
        Object.entries(d.patch.manual).forEach(([k, id]) => { beatManual[k] = id; waveDirPlaced.add(k); });
        beatPref.mode = 'hybrid';
        waveDirData = d;
        drawCurve(d.waveBefore, d.waveAfter, d.patch);
        syncBeatChips();
        refreshHookSummary();
        xnSay(lang === 'en'
          ? `Applied to Ep${d.patch.from}–Ep${d.patch.to} (${d.patch.affectedEps.length} eps, ${Object.keys(d.patch.manual).length} emotion beats pinned${d.patch.overwritten ? `, ${d.patch.overwritten} earlier pins replaced` : ''}). No credits used.`
          : `已对第${d.patch.from}–${d.patch.to}集连改（${d.patch.affectedEps.length}集、${Object.keys(d.patch.manual).length}处情绪定点${d.patch.overwritten ? `，覆盖此前定点${d.patch.overwritten}处` : ''}），不耗积分～`);
      } catch (e) { xnSay(String(e.message || e)); } finally { applyBtn.disabled = false; }
    };

    clearBtn.onclick = () => {
      waveDirPlaced.forEach((k) => delete beatManual[k]); waveDirPlaced.clear();
      if (!Object.keys(beatManual).length) beatPref.mode = hookPref.mode;
      selectedIntent = '';
      syncBeatChips(); refreshHookSummary();
      prevBtn.click();
    };
  }
  function initHookConsole() {
    const tg = $('hookToggle'), panel = $('hookPanel');
    if (!tg || tg.dataset.inited) return; tg.dataset.inited = '1';
    tg.onclick = () => { panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) loadHookOptions().catch(() => {}); };
    document.querySelectorAll('input[name="hookMode"]').forEach((r) => { r.onchange = () => { hookPref.mode = r.value; refreshHookSummary(); }; });
    document.querySelectorAll('input[name="hookStr"]').forEach((r) => { r.onchange = () => { hookPref.strength = r.value; refreshHookSummary(); }; });
    refreshHookSummary();
  }
  function collectHookPref() {
    return { mode: hookPref.mode, strength: hookPref.strength, preferred: [...hookPref.preferred], microFlavors: [...hookPref.microFlavors], manual: { ...hookManual } };
  }
  function collectBeatPref() {
    // 节拍沿用与钩子相同的编排方式与密度，只单独记录偏好的节拍、风味与 v2.57 逐位点选
    const mode = Object.keys(beatManual).length ? 'hybrid' : hookPref.mode;
    return { mode, strength: hookPref.strength, preferred: [...beatPref.preferred], payoffFlavors: [...beatPref.payoffFlavors], reversalFlavors: [...beatPref.reversalFlavors], emotionFlavors: [...beatPref.emotionFlavors], manual: { ...beatManual } };
  }
  // v2.27：用户未做任何精细钩子自定义时，不传 hookPref、改传策略 id，让后端按策略/题材智能编排（用户精细项永远优先）
  function hookAdvanced() {
    return hookPref.mode !== 'auto' || hookPref.strength !== 'balanced' || hookPref.preferred.length > 0 || hookPref.microFlavors.length > 0 || Object.keys(hookManual).length > 0;
  }
  function beatAdvanced() {
    return beatPref.preferred.length > 0 || beatPref.payoffFlavors.length > 0 || beatPref.reversalFlavors.length > 0 || beatPref.emotionFlavors.length > 0 || Object.keys(beatManual).length > 0;
  }
  function hookPayload() {
    const base = hookAdvanced() ? { hookPref: collectHookPref() } : (hookStrategy ? { hookStrategy } : {});
    if (paceStrategy) base.paceStrategy = paceStrategy;
    if (dialogueStrategy) base.dialogueStrategy = dialogueStrategy;
    if (emotionStrategy) base.emotionStrategy = emotionStrategy;
    if (characterStrategy) base.characterStrategy = characterStrategy;
    if (antiStrengthSel) base.antiStrength = antiStrengthSel; // c223 反套路档位（balanced 默认不传）
    if (customStyleText && customStyleText.replace(/\s/g, '').length >= 100) base.customStyleText = customStyleText;
    return base;
  }
  function beatPayload() { return beatAdvanced() ? { beatPref: collectBeatPref() } : {}; }
  // v2.35 AIGC 制式成片时长（仅 Z-AIGC 制作本传，按分钟精算字数与台词配比）
  function aigcPayload() {
    const sel = $('scriptFormatSel');
    if (!sel || sel.value !== 'AIGC') return {};
    const dur = parseFloat(($('aigcDuration') || {}).value || '2');
    // v2.148 视觉画风编号：选中非空时随创作请求落库 project.bible（分镜导出附录/海报自动注入统一画风）
    const styleSel = $('aigcVisualStyle');
    const visualStyleId = styleSel && styleSel.value ? { visualStyleId: styleSel.value } : {};
    // v2.149 镜头语言编号：选中非空时随创作请求落库 project.bible（分镜导出附录自动注入统一镜头语法）
    const camSel = $('aigcCameraLanguage');
    const cameraStyleId = camSel && camSel.value ? { cameraStyleId: camSel.value } : {};
    return { aigcDurationMin: Number.isFinite(dur) ? dur : 2, ...visualStyleId, ...cameraStyleId };
  }
  // v2.148 画风清单懒加载：首次切到 AIGC 制式时拉取，之后复用；随界面语言中英切换
  let visualStylesLoaded = false;
  async function loadVisualStyles() {
    if (visualStylesLoaded || !Api.isAuthed()) return;
    const sel = $('aigcVisualStyle');
    if (!sel) return;
    try {
      const res = await Api.request('/api/generate/visual-styles');
      const d = await res.json();
      if (!res.ok || !Array.isArray(d.styles)) return;
      d.styles.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.id} ${s.label}｜${(s.keywords || []).join('·')}`;
        opt.title = s.note || '';
        sel.appendChild(opt);
      });
      visualStylesLoaded = true;
    } catch { /* 画风清单加载失败不阻断创作，保持"默认"可选项 */ }
  }
  // v2.149 镜头语言清单懒加载：与画风清单同构，首次切到 AIGC 制式时拉取
  let cameraLanguagesLoaded = false;
  async function loadCameraLanguages() {
    if (cameraLanguagesLoaded || !Api.isAuthed()) return;
    const sel = $('aigcCameraLanguage');
    if (!sel) return;
    try {
      const res = await Api.request('/api/generate/camera-languages');
      const d = await res.json();
      if (!res.ok || !Array.isArray(d.styles)) return;
      d.styles.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.id} ${s.label}｜${s.grammar || (s.keywords || []).join('·')}`;
        opt.title = s.note || '';
        sel.appendChild(opt);
      });
      cameraLanguagesLoaded = true;
    } catch { /* 镜头语言清单加载失败不阻断创作，保持"默认"可选项 */ }
  }
  // v2.151 角色资产：立项引用跨剧人设（懒加载清单 + 选中项随立项落库 project.bible 快照，三岗位强约束注入）
  let castAssetsLoaded = false;
  async function loadCastAssets(force) {
    if ((castAssetsLoaded && !force) || !Api.isAuthed()) return;
    const account = capturePrivateSession();
    const sel = $('castAssetSelect');
    if (!sel) return;
    try {
      const res = await Api.request('/api/generate/character-assets');
      const d = await res.json();
      if (!isPrivateSessionCurrent(account)) return;
      if (!res.ok || !Array.isArray(d.assets)) return;
      sel.innerHTML = `<option value="">${t('castAssetNone')}</option>`;
      d.assets.forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `「${a.name}」${(a.persona || '').length > 24 ? a.persona.slice(0, 24) + '…' : a.persona}`;
        opt.title = [a.persona, a.voice].filter(Boolean).join('｜');
        sel.appendChild(opt);
      });
      // v2.156 复盘修复：列表端点 take:200 硬帽，超帽资产在下拉尾部给截断提示（原 100 帽静默截断）
      const listTotal = Number(d.total);
      if (Number.isFinite(listTotal) && listTotal > d.assets.length) {
        const more = document.createElement('option');
        more.disabled = true;
        more.textContent = lang === 'en' ? `— ${listTotal - d.assets.length} more not shown (cap 200) —` : `— 其余 ${listTotal - d.assets.length} 条未显示（上限 200）—`;
        sel.appendChild(more);
      }
      castAssetsLoaded = true;
    } catch { /* 角色资产清单加载失败不阻断创作，保持"不引用"可选项 */ }
  }
  function castAssetPayload() {
    const sel = $('castAssetSelect');
    if (!sel) return {};
    const ids = [...sel.selectedOptions].map((o) => o.value).filter(Boolean);
    return ids.length ? { castAssetIds: ids.slice(0, 10) } : {};
  }
  // v2.159 道具资产：立项引用跨剧关键信物（懒加载清单 + 选中项随立项落库 project.bible 快照，架构师/撰写师双岗强约束注入）
  let propAssetsLoaded = false;
  async function loadPropAssets(force) {
    if ((propAssetsLoaded && !force) || !Api.isAuthed()) return;
    const account = capturePrivateSession();
    const sel = $('propAssetSelect');
    if (!sel) return;
    try {
      const res = await Api.request('/api/generate/prop-assets');
      const d = await res.json();
      if (!isPrivateSessionCurrent(account)) return;
      if (!res.ok || !Array.isArray(d.assets)) return;
      sel.innerHTML = `<option value="">${t('propAssetNone')}</option>`;
      d.assets.forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `「${a.name}」${(a.meaning || '').length > 24 ? a.meaning.slice(0, 24) + '…' : a.meaning}`;
        opt.title = [a.meaning, a.taboo].filter(Boolean).join('｜');
        sel.appendChild(opt);
      });
      // 列表端点 take:200 硬帽，超帽资产在下拉尾部给截断提示（家族铁律：截断必须可见）
      const listTotal = Number(d.total);
      if (Number.isFinite(listTotal) && listTotal > d.assets.length) {
        const more = document.createElement('option');
        more.disabled = true;
        more.textContent = lang === 'en' ? `— ${listTotal - d.assets.length} more not shown (cap 200) —` : `— 其余 ${listTotal - d.assets.length} 条未显示（上限 200）—`;
        sel.appendChild(more);
      }
      propAssetsLoaded = true;
    } catch { /* 道具资产清单加载失败不阻断创作，保持"不引用"可选项 */ }
  }
  function propAssetPayload() {
    const sel = $('propAssetSelect');
    if (!sel) return {};
    const ids = [...sel.selectedOptions].map((o) => o.value).filter(Boolean);
    return ids.length ? { propAssetIds: ids.slice(0, 10) } : {};
  }
  // —— v2.161 场景资产：立项引用下拉（与道具家族同构：take 200 硬帽截断可见 + 失败不阻断创作） ——
  let sceneAssetsLoaded = false;
  async function loadSceneAssets(force) {
    if ((sceneAssetsLoaded && !force) || !Api.isAuthed()) return;
    const account = capturePrivateSession();
    const sel = $('sceneAssetSelect');
    if (!sel) return;
    try {
      const res = await Api.request('/api/generate/scene-assets');
      const d = await res.json();
      if (!isPrivateSessionCurrent(account)) return;
      if (!res.ok || !Array.isArray(d.assets)) return;
      sel.innerHTML = `<option value="">${t('sceneAssetNone')}</option>`;
      d.assets.forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `「${a.name}」${(a.meaning || '').length > 24 ? a.meaning.slice(0, 24) + '…' : a.meaning}`;
        opt.title = [a.meaning, a.mood, a.taboo].filter(Boolean).join('｜');
        sel.appendChild(opt);
      });
      // 列表端点 take:200 硬帽，超帽资产在下拉尾部给截断提示（家族铁律：截断必须可见）
      const listTotal = Number(d.total);
      if (Number.isFinite(listTotal) && listTotal > d.assets.length) {
        const more = document.createElement('option');
        more.disabled = true;
        more.textContent = lang === 'en' ? `— ${listTotal - d.assets.length} more not shown (cap 200) —` : `— 其余 ${listTotal - d.assets.length} 条未显示（上限 200）—`;
        sel.appendChild(more);
      }
      sceneAssetsLoaded = true;
    } catch { /* 场景资产清单加载失败不阻断创作，保持"不引用"可选项 */ }
  }
  function sceneAssetPayload() {
    const sel = $('sceneAssetSelect');
    if (!sel) return {};
    const ids = [...sel.selectedOptions].map((o) => o.value).filter(Boolean);
    return ids.length ? { sceneAssetIds: ids.slice(0, 10) } : {};
  }
  // —— v2.167 资产看板：跨族热度榜 + 空壳补全优先级队列（L3 运营决策面，三族共用入口） ——
  // 痛点：编导沉淀一堆资产后，不知道"哪些是明星资产/哪些待激活/空壳该先补哪个"。
  // dashboard 端点聚合三族：热度榜 top10（按 usedCount 降序）+ 空壳补全队列（score<55，缺失维度越少越优先）。
  // 渲染策略：热度榜按族分三块；空壳队列跨族合并，每行带 family 标签 + 缺失维度 + 跳转按钮。
  const DASH_LEVEL_COLOR = { rich: 'var(--ok, #2f8c4a)', usable: 'var(--gold, #c79a3a)', thin: 'var(--cinnabar, #c0392b)' };
  const DASH_FAMILY_KEY = { cast: 'dashFamilyCast', prop: 'dashFamilyProp', scene: 'dashFamilyScene' };
  // v2.171 资产编辑表单只读显示行：编导编辑资产时知道"从哪沉淀的"，可回溯原剧看上下文用法。
  // 紧凑形式（背景色 + 圆角）避免占用编辑表单字段空间；空 sourceProjectTitle 显示"手动创建"。
  // 三族共用（cast/prop/scene），避免三处重复，与 dashThinRow 行格式同口径（meta 行风格）。
  function libSourceRow(sourceProjectTitle) {
    const has = sourceProjectTitle && String(sourceProjectTitle).trim();
    return `<div style="font-size:12px;color:var(--muted,#888);margin:0 0 8px;padding:4px 8px;background:rgba(127,127,127,.05);border-radius:4px"><b>${t('libSourceLabel')}</b>：${has ? escapeHtml(String(sourceProjectTitle).trim()) : t('libSourceManual')}</div>`;
  }
  // v2.169 补全闭环：dashboard 跳转目标——点击 thinQueue 行的"去补全"按钮时设置，三族 renderXxxLibrary 渲染完该卡片后滚动到可视区并高亮 5 秒
  let dashJumpTarget = null;
  // v2.177 thin 筛选持久化：三族面板本地状态——dashJumpTarget.filter='thin' 是一次性（重渲染丢失），thinActive 持久保活，让用户在 thin 视图下输入搜索词不丢失 thin 状态
  // 闭环：dash-empty 设 true → renderXxxLibrary 检测 true 走 thin 分支（前端 score<55 过滤，与后端 q 过滤叠加） → dash-thin-clear 设 false 恢复全量
  let castThinActive = false, propThinActive = false, sceneThinActive = false;
  // v2.185 c180 dash-conflict 跳转后自动滚动到 conflicts 区 + 高亮（一次性消费）
  // 痛点：c179 dash-conflict 只清 thinActive，但族库面板的 conflicts 区位置较深，编导需手动滚动找到
  // 改：dash-conflict 跳来时设 dashConflictScroll='cast'/'prop'/'scene'，renderXxxLibrary 渲染完后 scrollIntoView + 5 秒高亮闪烁
  let dashConflictScroll = null;
  // v2.185 c180 批量补全 modal dialog（三族共用）：dry-run 后弹字段选择 dialog，编导可取消某些字段，
  // 确认后按选中字段过滤 patches，实际补全请求带 patches + fields 跳过 autoFill 重算
  // 返回 Promise<{patches, fields}> 或 null（取消）；patches 已按 fields 过滤，只含选中字段
  // ═══ MODULE: misc (95行, 8fn) ═══ v2.205 批量补全对话框
  /* ---------- v2.205 批量补全对话框 ---------- */
  // 薄弱资产「一键补全」确认弹窗：v2.205 迁移 v2.202 规范——DOM 构建（防注入）、
  // 焦点圈定/恢复（_uiTrapTab/prevFocus）、入场出场动画（_uiReducedMotion 守卫）、
  // 字段行 hover 效果移交 CSS（.dash-batch-field:hover）。
  function showBatchCompleteDialog(dryRes) {
    return new Promise((resolve) => {
    // @module misc
      const u = (dryRes.willUpdate || []).length;
    // @module misc
      const s = (dryRes.willSkip || []).length;
    // @module misc
      const fields = (dryRes.fieldsUnion || []);
    // @module misc
      const patches = (dryRes.willUpdate || []).map((x) => ({ id: x.id, name: x.name, patch: x.patch || {} }));
      const prevFocus = document.activeElement;
      const { overlay, modal, bodyEl, okBtn, cancelBtn } = _uiModalShell({
        title: t('dashThinBatchDialogTitle'),
        body: t('dashThinBatchDialogSummary', { u, s }),
        okText: t('dashThinBatchDialogConfirm'),
        cancelText: t('dashThinBatchDialogCancel'),
      });
      _uiModalLock();
      const fieldsLabel = document.createElement('div');
      fieldsLabel.style.cssText = 'font-size:12px;margin-bottom:4px;color:var(--muted,#888)';
      fieldsLabel.textContent = t('dashThinBatchDialogFields');
      const fieldsBox = document.createElement('div');
      fieldsBox.className = 'dash-batch-fields';
      fieldsBox.style.cssText = 'margin-bottom:12px';
      for (const f of fields) {
        const label = document.createElement('label');
        label.className = 'dash-batch-field';
        label.style.cssText = 'display:block;font-size:13px;margin:4px 0;cursor:pointer;padding:4px 6px;border-radius:4px';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = f; cb.checked = true; cb.style.marginRight = '6px';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + fieldName(f) + ' '));
        const count = document.createElement('span');
        count.className = 'muted';
        count.style.cssText = 'font-size:11px;margin-left:6px';
        count.textContent = '(' + patches.filter((p) => f in p.patch).length + ' 条)';
        label.appendChild(count);
        fieldsBox.appendChild(label);
      }
      const toggles = document.createElement('div');
      toggles.style.cssText = 'display:flex;gap:8px;margin-bottom:12px';
    // @module misc
      const mkToggle = (cls, text) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = cls; b.textContent = text;
        b.style.cssText = 'font-size:11px;padding:3px 10px;border:1px solid var(--muted,#888);background:transparent;color:var(--fg,#222);border-radius:4px;cursor:pointer';
        return b;
      };
      const allBtn = mkToggle('dash-batch-all', t('dashThinBatchDialogAll'));
      const noneBtn = mkToggle('dash-batch-none', t('dashThinBatchDialogNone'));
      toggles.appendChild(allBtn); toggles.appendChild(noneBtn);
      // 插在摘要之后、按钮行之前（_uiModalShell 已把按钮行 append 在 modal 末尾）
      if (bodyEl) bodyEl.after(fieldsLabel, fieldsBox, toggles);
      let closed = false;
      const close = (result) => {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', keyHandler);
        resolve(result);
        _uiModalUnlock();
        try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch {}
        // 退场淡出只作视觉余韵，不阻塞 resolve；onfinish/oncancel + 超时兜底保证 DOM 必被清理
        const finish = () => { overlay.remove(); };
        if (!_uiReducedMotion() && overlay.animate) {
          const anim = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-in' });
          anim.onfinish = finish; anim.oncancel = finish;
          setTimeout(finish, 300);
        } else finish();
      };
      const keyHandler = (e) => {
        if (closed) return;
        if (e.key === 'Escape') close(null);
        else if (e.key === 'Tab') _uiTrapTab(e, modal);
      };
      document.addEventListener('keydown', keyHandler);
      allBtn.onclick = () => { fieldsBox.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = true; }); };
      noneBtn.onclick = () => { fieldsBox.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; }); };
      cancelBtn.onclick = () => close(null);
      overlay.onclick = (e) => { if (e.target === overlay) close(null); };
      okBtn.onclick = () => {
        const selectedFields = [...fieldsBox.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value);
        if (!selectedFields.length) { toastInfo(t('dashThinBatchDialogEmpty')); return; }
        // 按选中字段过滤 patches——只保留选中字段；过滤后空 patch 的条目跳过
        const filteredPatches = patches.map((p) => {
          const patch = {};
          for (const f of selectedFields) if (f in p.patch) patch[f] = p.patch[f];
          return { id: p.id, patch };
        }).filter((p) => Object.keys(p.patch).length > 0);
        close({ patches: filteredPatches, fields: selectedFields });
      };
      document.body.appendChild(overlay);
      if (!_uiReducedMotion() && modal.animate) {
        modal.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 150, easing: 'ease-out' });
      }
      okBtn.focus();
    });
  }
  /* ---------- v2.205 批量补全对话框 结束 ---------- */
  function dashHotRow(a, family) {
    const color = DASH_LEVEL_COLOR[a.level] || DASH_LEVEL_COLOR.thin;
    const tag = t(DASH_FAMILY_KEY[family] || 'dashFamilyCast');
    // 明星空壳预警：usedCount>0 但 score<55 = 被多剧引用但已是空壳，最危险（编导以为有约束实际拿不到）
    const warn = a.usedCount > 0 && a.score < 55 ? `<span style="color:var(--cinnabar,#c0392b);margin-left:6px" title="${t('dashThinWarn')}">⚠ ${t('dashThinWarn')}</span>` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid rgba(127,127,127,.15)">
      <div style="flex:1;min-width:0">
        <span style="color:${color};font-weight:600">●</span>
        <span style="margin:0 6px">${escapeHtml(a.name)}</span>
        <span style="font-size:11px;color:var(--muted,#888)">[${tag}]</span>
        ${warn}
      </div>
      <div style="font-size:12px;color:var(--muted,#888);text-align:right;white-space:nowrap">
        <span title="${t('dashRefCount')}">📊 ${a.usedCount}</span>
        <span style="margin-left:8px;color:${color}">${a.score}</span>
      </div>
    </div>`;
  }
  function dashThinRow(a) {
    const color = DASH_LEVEL_COLOR[a.level] || DASH_LEVEL_COLOR.thin;
    const tag = t(DASH_FAMILY_KEY[a.family] || 'dashFamilyCast');
    // v2.168 复盘修复：thinQueue 行带 advice 字段但未渲染——改用 <details> 原生展开
    // v2.169 补全闭环：展开区显示源项目 + 编辑时间（编导回溯"从哪沉淀的、多久没动"），summary 加"去补全"跳转按钮
    const meta = (a.sourceProjectTitle || a.updatedAt)
      ? `<div style="font-size:11px;color:var(--muted,#888);margin:4px 0 2px">${a.sourceProjectTitle ? `${t('dashSourceFrom')}: ${escapeHtml(a.sourceProjectTitle)}` : ''}${a.sourceProjectTitle && a.updatedAt ? ' · ' : ''}${a.updatedAt ? t('dashEditedAgo', { n: daysSince(a.updatedAt) }) : ''}</div>`
      : '';
    const adviceHtml = Array.isArray(a.advice) && a.advice.length
      ? a.advice.map((s) => `<div style="margin:2px 0">· ${escapeHtml(s)}</div>`).join('')
      : '';
    const expandBody = (meta || adviceHtml)
      ? `<div style="padding:6px 12px 8px 24px;font-size:12px;color:var(--muted,#888);border-top:1px dashed rgba(127,127,127,.15)">${meta}${adviceHtml}</div>`
      : '';
    const inner = `<div style="flex:1;min-width:0">
        <span style="color:${color};font-weight:600">●</span>
        <span style="margin:0 6px">${escapeHtml(a.name)}</span>
        <span style="font-size:11px;color:var(--muted,#888)">[${tag}]</span>
        <span style="font-size:11px;color:var(--cinnabar,#c0392b);margin-left:6px">${t('dashMissingLabel')}: ${escapeHtml(a.missing.join(' / ')) || '—'}</span>
      </div>
      <div style="font-size:12px;color:var(--muted,#888);text-align:right;white-space:nowrap">
        <span style="color:${color}">${a.score}</span>
        <span style="margin-left:8px" title="${t('dashRefCount')}">📊 ${a.usedCount}</span>
        ${expandBody ? '<span style="margin-left:6px">💬</span>' : ''}
        <button type="button" class="btn-ghost dash-jump" style="font-size:11px;padding:2px 8px;margin-left:6px" data-jump-family="${escapeHtml(a.family)}" data-jump-id="${escapeHtml(a.id)}">${t('dashJumpBtn')}</button>
      </div>`;
    if (!expandBody) {
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid rgba(127,127,127,.15)">${inner}</div>`;
    }
    return `<details style="border-bottom:1px solid rgba(127,127,127,.15)">
      <summary style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;cursor:pointer;list-style:none">${inner}</summary>
      ${expandBody}
    </details>`;
  }
  // v2.171 冷门待激活行：紧凑形式（与 dashHotRow 同口径），右侧带"去激活"按钮跳转对应资产面板
  // 不显示 usedCount（恒为 0）和 advice（冷门资产非空壳，无需补全清单）；显示 sourceProjectTitle 让编导一眼看到来源
  // v2.172 复盘补强：加 updatedAt 闲置显示——编导决定激活时也想知道"沉淀后多久没用过"，长时间闲置的更该激活
  // （与 thinQueue 的 updatedAt 同口径，dashIdleAgo 用 daysSince helper 算天数）
  function dashColdRow(a, family) {
    const color = DASH_LEVEL_COLOR[a.level] || DASH_LEVEL_COLOR.usable;
    const tag = t(DASH_FAMILY_KEY[family] || a.family || 'dashFamilyCast');
    const src = a.sourceProjectTitle ? ` <span style="font-size:11px;color:var(--muted,#888);margin-left:6px">${t('dashSourceFrom')}: ${escapeHtml(a.sourceProjectTitle)}</span>` : '';
    const idle = a.updatedAt ? ` <span style="font-size:11px;color:var(--muted,#888);margin-left:6px">${t('dashIdleAgo', { n: daysSince(a.updatedAt) })}</span>` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid rgba(127,127,127,.15)">
      <div style="flex:1;min-width:0">
        <span style="color:${color};font-weight:600">●</span>
        <span style="margin:0 6px">${escapeHtml(a.name)}</span>
        <span style="font-size:11px;color:var(--muted,#888)">[${tag}]</span>
        ${src}${idle}
      </div>
      <div style="font-size:12px;color:var(--muted,#888);text-align:right;white-space:nowrap">
        <span style="color:${color}">${a.score}</span>
        <button type="button" class="btn-ghost dash-cold" style="font-size:11px;padding:2px 8px;margin-left:6px" data-jump-family="${escapeHtml(family || a.family || 'cast')}">${t('dashActivateBtn')}</button>
      </div>
    </div>`;
  }
  async function openAssetDashboard(family) {
    const modal = $('assetDashboardModal');
    if (!modal) return;
    const body = $('dashBody');
    openModal(modal.id);
    if (!Api.isAuthed()) { body.innerHTML = `<div class="notice">${t('needLogin')}</div>`; return; }
    const account = capturePrivateSession();
    znSkeleton(body);
    try {
      const res = await Api.request(`/api/generate/asset-dashboard?lang=${lang === 'en' ? 'en' : 'zh'}`);
      const data = await Api.jsonOrThrow(res);
      if (!isPrivateSessionCurrent(account)) return;
      const hotCast = Array.isArray(data.hotCast) ? data.hotCast : [];
      const hotProp = Array.isArray(data.hotProp) ? data.hotProp : [];
      const hotScene = Array.isArray(data.hotScene) ? data.hotScene : [];
      const thinQueue = Array.isArray(data.thinQueue) ? data.thinQueue : [];
      // v2.171 冷门待激活：三族分别拉取（后端已 family 字段，前端按族分块渲染）
      // v2.172 复盘修复：后端 pickCold 改返回 { items, total } 对象（c156"截断必须可见"铁律复发修复）
      // 前端按对象解构 items / total，sec 函数显示"+N 条未展示"提示
      const coldCastObj = data.coldCast && typeof data.coldCast === 'object' && Array.isArray(data.coldCast.items) ? data.coldCast : { items: [], total: 0 };
      const coldPropObj = data.coldProp && typeof data.coldProp === 'object' && Array.isArray(data.coldProp.items) ? data.coldProp : { items: [], total: 0 };
      const coldSceneObj = data.coldScene && typeof data.coldScene === 'object' && Array.isArray(data.coldScene.items) ? data.coldScene : { items: [], total: 0 };
      const coldCast = coldCastObj.items;
      const coldProp = coldPropObj.items;
      const coldScene = coldSceneObj.items;
      // v2.172 复盘补强：hotCastTotal/hotPropTotal/hotSceneTotal 三族总资产数，与 coldXxx.total 同口径
      const hotCastTotal = typeof data.hotCastTotal === 'number' ? data.hotCastTotal : hotCast.length;
      const hotPropTotal = typeof data.hotPropTotal === 'number' ? data.hotPropTotal : hotProp.length;
      const hotSceneTotal = typeof data.hotSceneTotal === 'number' ? data.hotSceneTotal : hotScene.length;
      // v2.173 dashboard 资产健康总览：三族 stats + 冲突数宏观卡片
      // 后端 buildStats 返回 { total, scanned, avgScore, empty, usable, complete, conflicts, truncated }
      // v2.173 复盘修复（c169）：total=真实总数（prisma.count），scanned=take 500 内扫描数，truncated=>500 时为 true
      const emptyStats = { total: 0, scanned: 0, avgScore: 0, empty: 0, usable: 0, complete: 0, conflicts: 0, truncated: false };
      const castStats = data.castStats && typeof data.castStats === 'object' ? data.castStats : emptyStats;
      const propStats = data.propStats && typeof data.propStats === 'object' ? data.propStats : emptyStats;
      const sceneStats = data.sceneStats && typeof data.sceneStats === 'object' ? data.sceneStats : emptyStats;
      const castLabel = t('dashFamilyCast');
      const propLabel = t('dashFamilyProp');
      const sceneLabel = t('dashFamilyScene');
      // v2.172 复盘修复：sec 加可选 total 参数，total > shown 时显示"展示前 N / 共 M"截断提示
      // （c156"截断必须可见"铁律：静默截断是数据丢失通道，编导资产 >10 或冷门 >5 时必须告诉编导还有多少没展示）
      const sec = (label, list, renderer, fam, total) => {
        const shown = list.length;
        const trunc = typeof total === 'number' && total > shown ? ` <span style="font-size:11px;color:var(--muted,#888);font-weight:400">（${t('dashTrunc', { shown, total })}）</span>` : '';
        return `<div style="margin:10px 0 4px;font-size:13px;color:var(--muted,#888);font-weight:600">${label}${trunc}</div>${shown ? list.map((a) => renderer(a, fam)).join('') : `<div class="muted" style="padding:6px 8px">${t('dashFamEmpty')}</div>`}`;
      };
      // v2.173 dashboard 资产健康总览卡片：三族并排，每族显示总数/平均分/空壳/可用/完整/冲突
      // 宏观信号让编导一眼判断"今天该补哪族、该消冲突、还是该激活冷门"——空壳率高优先补全，冲突数高优先消冲突，完整率高优先激活
      // v2.173 增量闭环：冲突数提示带"去消冲突"按钮（family 参数），点击关闭 dashboard + 调对应 openXxxLibrary——宏观 KPI 不只是"展示数据"而是"调度动作"
      const dashStatsCard = (label, s, family) => {
        const emptyRate = s.total ? Math.round((s.empty / s.total) * 100) : 0;
        const emptyColor = s.empty > 0 ? 'var(--cinnabar,#c0392b)' : 'var(--ok,#2f8c4a)';
        const conflictColor = s.conflicts > 0 ? 'var(--cinnabar,#c0392b)' : 'var(--muted,#888)';
        const resolveBtn = s.conflicts > 0 && family
          ? ` <button type="button" class="btn-ghost dash-conflict" style="font-size:10px;padding:1px 6px;margin-left:4px;border:1px solid ${conflictColor};color:${conflictColor}" data-jump-family="${escapeHtml(family)}">${t('dashResolveConflictBtn')}</button>`
          : '';
        // v2.173 复盘修复（c169）：truncated=true 时显示"共 600 条，统计前 500 条"截断提示——c156"截断必须可见"铁律
        const truncHint = s.truncated ? `<div style="font-size:10px;color:var(--muted,#888);margin:4px 0 0">📋 ${t('dashStatsTruncHint', { total: s.total, scanned: s.scanned })}</div>` : '';
        return `<div style="flex:1;min-width:0;border:1px solid rgba(127,127,127,.2);border-radius:6px;padding:8px;margin:2px;background:rgba(127,127,127,.03)">
          <div style="font-size:13px;font-weight:600;margin:0 0 6px">${label}</div>
          <div style="font-size:11px;color:var(--muted,#888);margin:0 0 6px">${t('dashStatsTotal')}: <b style="color:var(--text,#333)">${s.total}</b> · ${t('dashStatsAvg')}: <b style="color:${DASH_LEVEL_COLOR.usable}">${s.avgScore}</b></div>
          <div style="display:flex;gap:4px;font-size:11px;flex-wrap:wrap">
            <span style="color:${DASH_LEVEL_COLOR.rich}">●${t('dashStatsComplete')} ${s.complete}</span>
            <span style="color:${DASH_LEVEL_COLOR.usable}">●${t('dashStatsUsable')} ${s.usable}</span>
            <span style="color:${DASH_LEVEL_COLOR.thin}">●${t('dashStatsEmpty')} ${s.empty}</span>
          </div>
          ${s.empty > 0 ? (() => {
            const emptyBtn = family
              ? ` <button type="button" class="btn-ghost dash-empty" style="font-size:10px;padding:1px 6px;margin-left:4px;border:1px solid ${emptyColor};color:${emptyColor}" data-jump-family="${escapeHtml(family)}">${t('dashEmptyBtn')}</button>`
              : '';
            return `<div style="font-size:10px;color:${emptyColor};margin:4px 0 0;display:flex;align-items:center;flex-wrap:wrap">${t('dashStatsEmptyHint', { n: emptyRate })}${emptyBtn}</div>`;
          })() : ''}
          ${s.conflicts > 0 ? `<div style="font-size:10px;color:${conflictColor};margin:4px 0 0;display:flex;align-items:center;flex-wrap:wrap">⚠ ${t('dashStatsConflictHint', { n: s.conflicts })}${resolveBtn}</div>` : ''}
          ${truncHint}
        </div>`;
      };
      const coldTotal = coldCastObj.total + coldPropObj.total + coldSceneObj.total;
      body.innerHTML = `
        <div style="font-size:14px;font-weight:600;margin:4px 0 8px">${t('dashStatsTitle')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px">
          ${dashStatsCard(castLabel, castStats, 'cast')}
          ${dashStatsCard(propLabel, propStats, 'prop')}
          ${dashStatsCard(sceneLabel, sceneStats, 'scene')}
        </div>
        <div style="font-size:14px;font-weight:600;margin:4px 0 8px">${t('dashHotTitle')}</div>
        ${sec(castLabel, hotCast, dashHotRow, 'cast', hotCastTotal)}
        ${sec(propLabel, hotProp, dashHotRow, 'prop', hotPropTotal)}
        ${sec(sceneLabel, hotScene, dashHotRow, 'scene', hotSceneTotal)}
        <div style="font-size:14px;font-weight:600;margin:14px 0 8px">${t('dashThinTitle')}</div>
        ${thinQueue.length ? thinQueue.map(dashThinRow).join('') : `<div class="muted" style="padding:6px 8px">${t('dashNoThin')}</div>`}
        <div style="font-size:14px;font-weight:600;margin:14px 0 8px">${t('dashColdTitle')}</div>
        ${coldTotal
          ? sec(castLabel, coldCast, dashColdRow, 'cast', coldCastObj.total) + sec(propLabel, coldProp, dashColdRow, 'prop', coldPropObj.total) + sec(sceneLabel, coldScene, dashColdRow, 'scene', coldSceneObj.total)
          : `<div class="muted" style="padding:6px 8px">${t('dashNoCold')}</div>`}
      `;
      // v2.169 补全闭环：thinQueue 行的"去补全"按钮——关闭 dashboard + 设置 dashJumpTarget + 调用对应族库面板（renderXxxLibrary 内会消费 dashJumpTarget 滚动 + 高亮）
      body.querySelectorAll('.dash-jump').forEach((b) => {
        b.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fam = b.getAttribute('data-jump-family');
          const id = b.getAttribute('data-jump-id');
          if (!fam || !id) return;
          // v2.177 c173 复盘修复：dash-jump 跳来时强制清空对应面板的 thinActive——
          // 否则若用户在面板里开了 thin 视图后切到 dashboard 点 dash-jump，目标资产可能被 thin 过滤掉看不到高亮
          if (fam === 'cast') castThinActive = false;
          else if (fam === 'prop') propThinActive = false;
          else if (fam === 'scene') sceneThinActive = false;
          dashJumpTarget = { family: fam, id };
          modal.classList.add('hidden');
          if (fam === 'cast') openCastLibrary();
          else if (fam === 'prop') openPropLibrary();
          else if (fam === 'scene') openSceneLibrary();
        };
      });
      // v2.171 冷门待激活：每行"去激活"按钮——关闭 dashboard + 调对应 openXxxLibrary（不设 dashJumpTarget，因冷门资产非空壳无需强制滚动高亮）
      body.querySelectorAll('.dash-cold').forEach((b) => {
        b.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fam = b.getAttribute('data-jump-family');
          if (!fam) return;
          modal.classList.add('hidden');
          if (fam === 'cast') openCastLibrary();
          else if (fam === 'prop') openPropLibrary();
          else if (fam === 'scene') openSceneLibrary();
        };
      });
      // v2.173 宏观卡片"去消冲突"按钮：与 dash-cold 同口径跳转族库面板（冲突在族库面板的体检徽章 + conflicts 区显示）
      // v2.185 c180 增强：跳来时设 dashConflictScroll 标志，族库面板渲染完后 scrollIntoView + 5 秒高亮闪烁
      body.querySelectorAll('.dash-conflict').forEach((b) => {
        b.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fam = b.getAttribute('data-jump-family');
          if (!fam) return;
          // v2.184 c179 复盘修复：dash-conflict 跳来时同样要清对应面板的 thinActive——
          // 与 c173 dash-jump 同口径：若用户开了 thin 视图后回 dashboard 点 dash-conflict，
          // 跳回的族库面板 thinActive 还在 → 冲突资产可能被 thin 过滤看不到
          if (fam === 'cast') castThinActive = false;
          else if (fam === 'prop') propThinActive = false;
          else if (fam === 'scene') sceneThinActive = false;
          // v2.185 c180 设 dashConflictScroll 标志，族库面板渲染完后自动滚动 + 高亮 conflicts 区
          dashConflictScroll = fam;
          modal.classList.add('hidden');
          if (fam === 'cast') openCastLibrary();
          else if (fam === 'prop') openPropLibrary();
          else if (fam === 'scene') openSceneLibrary();
        };
      });
      // v2.175 空壳补全闭环：宏观卡片"空壳率红"信号一键跳族库面板的 thin 筛选视图
      // v2.177 改为持久态：原 dashJumpTarget.filter='thin' 是一次性（重渲染即丢失），用户在 thin 视图下输入搜索词会丢失 thin 状态
      // → 改用 castThinActive/propThinActive/sceneThinActive 持久变量；同时清空对应面板搜索框（一次性，避免旧搜索词与 thin 叠加）
      body.querySelectorAll('.dash-empty').forEach((b) => {
        b.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fam = b.getAttribute('data-jump-family');
          if (!fam) return;
          const searchInput = fam === 'cast' ? $('castLibSearch') : (fam === 'prop' ? $('propLibSearch') : $('sceneLibSearch'));
          if (searchInput) searchInput.value = '';
          if (fam === 'cast') castThinActive = true;
          else if (fam === 'prop') propThinActive = true;
          else if (fam === 'scene') sceneThinActive = true;
          modal.classList.add('hidden');
          if (fam === 'cast') openCastLibrary();
          else if (fam === 'prop') openPropLibrary();
          else if (fam === 'scene') openSceneLibrary();
        };
      });
    } catch {
      if (!isPrivateSessionCurrent(account)) return;
      body.innerHTML = znErrorHtml(t('dashFail'));
    }
  }
  // —— v2.152 角色资产库管理面板：列表+体检徽章+冲突预警+内联编辑/删除（与后端 health 端点同构） ——
  const CAST_LIB_LEVEL = { rich: 'castLibLevelRich', usable: 'castLibLevelUsable', thin: 'castLibLevelThin' };
  async function openCastLibrary() {
    const modal = $('castLibModal');
    if (!modal) return;
    if (!Api.isAuthed()) { openModal(modal.id); $('castLibGrid').innerHTML = ''; $('castLibConflicts').innerHTML = ''; $('castLibEdit').classList.add('hidden'); const e = $('castLibEmpty'); e.classList.remove('hidden'); e.innerHTML = znEmptyHtml(t('needLogin')); return; }
    const account = capturePrivateSession();
    openModal(modal.id);
    $('castLibEdit').classList.add('hidden');
    const grid = $('castLibGrid'); const empty = $('castLibEmpty');
    empty.classList.add('hidden'); $('castLibConflicts').innerHTML = '';
    znSkeleton(grid, 'grid');
    // v2.163 资产库检索：搜索框非空时带 q 关键词（后端大小写不敏感子串过滤，total=命中数）
    const sq = String($('castLibSearch')?.value ?? '').trim();
    const qs = sq ? `?q=${encodeURIComponent(sq)}` : '';
    const qh = sq ? `&q=${encodeURIComponent(sq)}` : '';
    try {
      const [listRes, healthRes] = await Promise.all([
        Api.request(`/api/generate/character-assets${qs}`),
        // v2.156 复盘修复：limit=200 拉满体检列表（原默认 50，资产 51+ 时徽章回退"空壳 0 分"误导）
        Api.request(`/api/generate/character-assets/health?lang=${lang === 'en' ? 'en' : 'zh'}&limit=200${qh}`),
      ]);
      const listJson = await Api.jsonOrThrow(listRes);
      const assets = listJson.assets || [];
      const health = await Api.jsonOrThrow(healthRes);
      if (!isPrivateSessionCurrent(account)) return;
      // v2.166 复盘修复：usage 是辅助观测（📌 当前 N 剧在用），失败不应让整个面板显示 loadFail——
      // 独立 try 兜底空对象，主列表/体检/徽章照常渲染，卡片只是看不到 📌 行
      let usage = {};
      try {
        const usageRes = await Api.request(`/api/generate/character-assets/usage`);
        usage = (await Api.jsonOrThrow(usageRes)).usage || {};
      } catch { /* usage 辅助信息，失败静默 */ }
      if (!isPrivateSessionCurrent(account)) return;
      renderCastLibrary(assets, health, Number(listJson.total), usage);
    } catch {
      if (!isPrivateSessionCurrent(account)) return;
      // v2.170 复盘修复：fetch 失败时清空 dashJumpTarget，防残留状态导致下次开库误触发滚动高亮
      // v2.185 c180 同口径：也清 dashConflictScroll，防残留导致下次开库误触发滚动高亮
      dashJumpTarget = null;
      dashConflictScroll = null;
      grid.innerHTML = ''; empty.classList.remove('hidden'); empty.innerHTML = znErrorHtml(t('castLibFail'));
    }
  }
  // v2.165 资产实时引用明细（三面板共用）：usage = { [assetId]: [{projectId, projectTitle, status}] }，与 usedCount 历史累计立项次数互补；空壳被引用时加红色预警
  function assetUsageHtml(a, usage, hLevel) {
    const refs = usage && usage[a.id];
    if (!refs || !refs.length) return '';
    const titles = refs.map((r) => String(r.projectTitle || r.projectId));
    const joiner = lang === 'en' ? ', ' : '、';
    const listStr = titles.slice(0, 3).join(joiner) + (titles.length > 3 ? t('libUsageMore', { n: titles.length - 3 }) : '');
    return `<div class="muted" style="font-size:11px;margin-top:2px">📌 ${t('libUsageNow', { n: refs.length })}：${escapeHtml(listStr)}</div>${hLevel === 'thin' ? `<div style="font-size:11px;margin-top:3px;color:#c0392b">⚠️ ${t('libThinInUse')}</div>` : ''}`;
  }
  // v2.178 资产补全建议渲染（三族共用）：1 条单行显示，多条用 <details> 折叠展开（CSP 友好，原生展开）
  // 复盘 c172-c173：thin 视图闭环里编导需要看完整 advice 清单，原代码只显示 advice[0] 隐藏后续——多条建议不可见
  // v2.179 c175 复盘修复：去掉 level==='rich' 条件——后端 asset-health L67-68 rich 资产也生成 advice（达标提醒"可直接跨剧引用..."），原条件把 rich 的达标提醒也隐藏了，编导看不到"已达标可跨剧引用"的正向反馈
  // → rich 用绿色（#2e7d32 正向反馈），usable/thin 用棕色（#8a6d3b 待补全建议）—— 颜色区分达标 vs 待补全
  function adviceHtml(h) {
    if (!h || !h.advice || !h.advice.length) return '';
    const color = h.level === 'rich' ? '#2e7d32' : '#8a6d3b';
    if (h.advice.length === 1) {
      return `<div class="muted" style="font-size:11px;margin-top:3px;color:${color}">💡 ${escapeHtml(h.advice[0])}</div>`;
    }
    const items = h.advice.map((s) => `<li style="margin:2px 0">${escapeHtml(s)}</li>`).join('');
    return `<details style="margin-top:3px"><summary style="font-size:11px;color:${color};cursor:pointer;list-style:none">${t('libAdviceMore', { n: h.advice.length })}</summary><ul style="margin:4px 0 0 18px;padding:0;font-size:11px;color:${color}">${items}</ul></details>`;
  }
  function renderCastLibrary(assets, health, listTotal, usage) {
    const grid = $('castLibGrid'); const empty = $('castLibEmpty');
    const hMap = new Map((health.items || []).map((h) => [h.id, h]));
    const conflicts = health.conflicts || [];
    let conflictHtml = conflicts.length
      ? `<div class="notice" style="border-color:#c0392b"><b>${t('castLibConflictTitle')}</b><ul style="margin:4px 0 0 18px;padding:0">${conflicts.map((c) => `<li style="font-size:12px">${escapeHtml(c.note)}</li>`).join('')}</ul></div>`
      : '';
    // v2.156 复盘修复：health.total / listTotal 超出渲染条数时给截断提示（不再静默截断）
    // v2.164 复盘修复：搜索态下 total=命中数，文案从"资产库共 N 条"切"搜索命中 N 条"（三面板同口径）
    const shown = Math.max(assets.length, (health.items || []).length);
    const totalKnown = Math.max(Number.isFinite(listTotal) ? listTotal : 0, Number(health.total) || 0);
    if (totalKnown > shown && shown > 0) {
      const searching = String($('castLibSearch')?.value ?? '').trim() !== '';
      conflictHtml += `<div class="notice" style="margin-top:6px">${lang === 'en'
        ? (searching
          ? `${totalKnown} matches — showing the first ${shown} (panel cap 200).`
          : `Library has ${totalKnown} assets — showing the first ${shown} (panel cap 200). Older entries still work via project snapshots.`)
        : (searching
          ? `搜索命中 ${totalKnown} 条，仅显示前 ${shown} 条（上限 200）。`
          : `资产库共 ${totalKnown} 条，面板仅显示前 ${shown} 条（上限 200）；超出部分已引用项目不受影响。`)}</div>`;
    }
    // v2.175 空壳补全闭环：从 dashboard 的"空壳率红"信号一键跳来时，按 score<55 筛选 assets 子集
    // v2.177 改用 castThinActive 持久态：原 dashJumpTarget.filter==='thin' 是一次性（重渲染即丢失），用户在 thin 视图下输入搜索词会丢失 thin 状态
    // → 改为持久态变量；thin+q 叠加：后端按 q 过滤（list 端点）+ 前端按 score<55 过滤（此处）；不再消费后置 null
    let thinFiltered = false;
    const thinActive = castThinActive;
    if (thinActive) {
      assets = assets.filter((a) => {
        const h = hMap.get(a.id);
        return h && typeof h.score === 'number' && h.score < 55;
      });
      thinFiltered = true;
    }
    if (thinFiltered) {
      const curQ = String($('castLibSearch')?.value ?? '').trim();
      conflictHtml = `<div class="notice" style="border-color:var(--cinnabar,#c0392b);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b>${curQ ? t('dashThinSearchFiltered', { n: assets.length, q: curQ }) : t('dashThinFiltered', { n: assets.length })}</b>
        <button type="button" class="btn-ghost dash-thin-clear" style="font-size:11px;padding:2px 8px">${t('dashThinClear')}</button>
        ${assets.length ? `<button type="button" class="btn-ghost dash-thin-batch-complete" style="font-size:11px;padding:2px 8px;border-color:var(--jade,#2e7d32);color:var(--jade,#2e7d32)">${t('dashThinBatchComplete')}</button>` : ''}
      </div>` + conflictHtml;
    }
    $('castLibConflicts').innerHTML = conflictHtml;
    // v2.176 复盘修复①：thin 筛选无结果时提前 return 会导致 dash-thin-clear 按钮事件不绑定 → 用户卡在筛选视图无法清除
    // → 把绑定提到 return 之前，确保按钮始终可点击（无论筛选有无结果）
    // v2.177 改为持久态清空：castThinActive=false + 清空搜索框 + openCastLibrary 恢复全量
    $('castLibConflicts').querySelectorAll('.dash-thin-clear').forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        castThinActive = false;
        const searchInput = $('castLibSearch');
        if (searchInput) searchInput.value = '';
        openCastLibrary();
      };
    });
    // v2.181 thin 视图"全部补全"：零 token 规则模板补全空缺字段，与 dash-thin-clear 同位置同构（prop/scene 三族同口径）
    // v2.183 闭环：dry-run 预检 → confirm 字段清单 → 实际补全 → 结果带字段清单预览（fieldName 函数已在顶层定义，三族共用）
    // v2.185 c180 升级：dry-run → modal dialog 字段选择（替代 confirm）→ 带 patches + fields 实际补全（跳过 autoFill 重算，降低延迟）
    $('castLibConflicts').querySelectorAll('.dash-thin-batch-complete').forEach((b) => {
      b.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        b.disabled = true; const old = b.textContent; b.textContent = t('dashThinBatchPreview');
        const restore = () => { b.disabled = false; b.textContent = old; };
        try {
          // 1) dry-run 预检：只计算不写库，返回 willUpdate/willSkip/fieldsUnion/patches
          const dryRes = await Api.request(`/api/generate/character-assets/batch-complete?lang=${lang}&dry-run=1`, {
            method: 'POST', body: JSON.stringify({ ids: assets.map((a) => a.id) }),
          });
          const d = await Api.jsonOrThrow(dryRes);
          const u = (d.willUpdate || []).length, s = (d.willSkip || []).length;
          // c179 复盘修复：u===0 时（资产全部已手填或不可规则补全）直接 alert，跳过 modal + 实际补全请求
          if (u === 0) {
            toastInfo(t('dashThinBatchNoop', { s }));
            restore();
            return;
          }
          // 2) c180 modal dialog：字段选择（替代 confirm），编导可取消某些字段
          const choice = await showBatchCompleteDialog(d);
          if (!choice) { restore(); return; } // 用户取消，不写库
          const { patches, fields } = choice;
          // 3) 实际补全：带 patches + fields，服务端跳过 autoFill 重算
          b.textContent = t('dashThinBatchDoing');
          const res = await Api.request(`/api/generate/character-assets/batch-complete?lang=${lang}`, {
            method: 'POST', body: JSON.stringify({ ids: assets.map((a) => a.id), patches, fields }),
          });
          const j = await Api.jsonOrThrow(res);
          // 4) 结果预览：补 N 条 + 涉及字段清单
          const updatedFields = (j.updated || []).flatMap((x) => x.filled || []);
          const uniqFields = [...new Set(updatedFields)];
          toastOk(t('dashThinBatchDoneWithFields', {
            u: (j.updated || []).length, s: (j.skipped || []).length,
            fields: uniqFields.length ? uniqFields.map(fieldName).join('、') : '-',
          }));
          castAssetsLoaded = false; openCastLibrary(); // 刷新族库
        } catch (err) {
          toastError(t('dashThinBatchFail') + (err && err.message ? `：${err.message}` : ''));
        } finally { restore(); }
      };
    });
    grid.innerHTML = '';
    empty.classList.toggle('hidden', assets.length > 0);
    if (!assets.length) { empty.innerHTML = znEmptyHtml(thinFiltered ? t('dashThinNoResult') : (String($('castLibSearch')?.value ?? '').trim() ? t('libSearchNoResult') : t('castLibEmpty'))); return; }
    assets.forEach((a) => {
      const h = hMap.get(a.id) || { score: 0, level: 'thin', advice: [] };
      const sigs = (a.signatureLines || []).slice(0, 2);
      const print = a.voicePrint && a.voicePrint.signature ? a.voicePrint.signature : '';
      const card = document.createElement('div');
      card.className = 'diag-panel';
      card.style.marginTop = '8px';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b style="font-size:14px">${escapeHtml(a.name)}</b>
          <span class="badge cast-lib-badge-${h.level}" title="${t('castLibScore')}: ${h.score}/100">${t(CAST_LIB_LEVEL[h.level])} ${h.score}</span>
          <span class="muted" style="font-size:11px">${t('castLibUsed', { n: a.usedCount || 0 })}${a.sourceProjectTitle ? ` · ${t('castLibFrom')}: ${escapeHtml(a.sourceProjectTitle)}` : ''}</span>
          <span style="flex:1"></span>
          <button class="btn-ghost cast-lib-edit" style="font-size:11px;padding:2px 8px">${t('castLibEdit')}</button>
          <button class="btn-ghost cast-lib-del" style="font-size:11px;padding:2px 8px">${t('castLibDelete')}</button>
        </div>
        <div style="font-size:12px;margin-top:4px">${escapeHtml(a.persona || '')}</div>
        ${assetUsageHtml(a, usage, h.level)}
        ${a.voice ? `<div class="muted" style="font-size:11px;margin-top:2px">${t('castLibVoice')}: ${escapeHtml(a.voice)}</div>` : ''}
        ${a.visualAnchor ? `<div class="muted" style="font-size:11px">${t('castLibAnchor')}: ${escapeHtml(a.visualAnchor)}</div>` : ''}
        ${print ? `<div class="muted" style="font-size:11px">${t('castLibPrint')}: ${escapeHtml(print)}</div>` : ''}
        ${sigs.length ? `<div class="muted" style="font-size:11px">${t('castLibSig')}: ${sigs.map((s) => escapeHtml(s)).join(' / ')}</div>` : ''}
        ${adviceHtml(h)}`;
      card.querySelector('.cast-lib-edit').onclick = () => renderCastLibEditor(a);
      card.querySelector('.cast-lib-del').onclick = async () => {
        if (!(await uiConfirm({ body: t('castLibDeleteConfirm', { n: a.name }), danger: true, okText: lang === 'en' ? 'Delete' : '删除' }))) return;
        try {
          const r = await Api.request(`/api/generate/character-assets/${a.id}`, { method: 'DELETE' });
          if (!r.ok && r.status !== 404) throw new Error('del');
          castAssetsLoaded = false; loadCastAssets(true);
          openCastLibrary();
        } catch { toastError(t('castLibFail')); }
      };
      // v2.169 补全闭环：从 dashboard 跳来时高亮该资产 + 滚到可视区（5 秒后清除），一次性消费 dashJumpTarget
      if (dashJumpTarget && dashJumpTarget.family === 'cast' && dashJumpTarget.id === a.id) {
        card.style.outline = '2px solid var(--gold, #c79a3a)';
        card.style.outlineOffset = '2px';
        setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 5000);
        dashJumpTarget = null;
      }
      grid.appendChild(card);
    });
    // v2.176 复盘修复②：dashJumpTarget 残留态——目标资产不在当前列表（被删除/分页截断在 200 上限外）时
    // forEach 内 id 高亮分支永远不触发 → dashJumpTarget 永不消费 → 残留至下次同族开库误触发高亮
    // → forEach 后无条件清空（thin 分支与 id 分支已消费的会跳过，因为已是 null）
    if (dashJumpTarget && dashJumpTarget.family === 'cast') dashJumpTarget = null;
    // v2.185 c180 dash-conflict 跳转后自动滚动到 conflicts 区 + 5 秒高亮闪烁
    // 痛点：dash-conflict 只清 thinActive，编导跳来后还要手动滚动找 conflicts 区
    // 改：dashConflictScroll='cast' 时 scrollIntoView + 加金色边框 5 秒，一次性消费
    if (dashConflictScroll === 'cast') {
      dashConflictScroll = null;
      const el = $('castLibConflicts');
      if (el) {
        setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 0 3px var(--gold, #c79a3a)';
        setTimeout(() => { el.style.boxShadow = ''; }, 5000);
      }
    }
  }
  function renderCastLibEditor(a) {
    const box = $('castLibEdit');
    box.classList.remove('hidden');
    box.innerHTML = `
      ${libSourceRow(a.sourceProjectTitle)}
      <div class="field"><label>${t('castLibName')}</label><input id="castLibEditName" value="${escapeHtml(a.name)}" maxlength="20" /></div>
      <div class="field"><label>${t('castLibPersona')}</label><textarea id="castLibEditPersona" rows="2" maxlength="200">${escapeHtml(a.persona || '')}</textarea></div>
      <div class="field"><label>${t('castLibVoice')}</label><input id="castLibEditVoice" value="${escapeHtml(a.voice || '')}" maxlength="200" /></div>
      <div class="field"><label>${t('castLibAnchor')}</label><input id="castLibEditAnchor" value="${escapeHtml(a.visualAnchor || '')}" maxlength="200" /></div>
      <div class="field"><label>${t('castLibSig')}</label><textarea id="castLibEditSigs" rows="2" maxlength="320" placeholder="${lang === 'en' ? 'One line each (≤60 chars), max 5' : '每行一条（≤60字），最多 5 条'}">${escapeHtml((a.signatureLines || []).join('\n'))}</textarea></div>
      <div class="field"><label>${t('castLibTags')}</label><input id="castLibEditTags" value="${escapeHtml((a.tags || []).join('，'))}" maxlength="200" placeholder="${lang === 'en' ? 'Comma separated, max 8 × 20 chars' : '逗号分隔，最多 8 个 × 20 字'}" /></div>
      <div class="row-actions" style="margin-top:6px">
        <button class="btn-primary" id="castLibEditSave">${t('castLibSave')}</button>
        <button class="btn-ghost" id="castLibEditCancel" style="margin-left:8px">${t('castLibCancel')}</button>
      </div>`;
    $('castLibEditCancel').onclick = () => box.classList.add('hidden');
    $('castLibEditSave').onclick = async () => {
      const saveButton = $('castLibEditSave');
      if (saveButton.disabled) return;
      const body = {
        id: a.id,
        name: $('castLibEditName').value.trim(),
        persona: $('castLibEditPersona').value.trim(),
        voice: $('castLibEditVoice').value.trim() || null,
        visualAnchor: $('castLibEditAnchor').value.trim() || null,
        signatureLines: $('castLibEditSigs').value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 60)).slice(0, 5), // 单条≤60字与后端 schema 对齐，就地截断（气质锚语义，同沉淀端点截40）
        // v2.155 修复：整档覆盖语义下 tags 不提交会被静默清空——编辑表单必须随档提交（逗号/、/，分隔，≤8×20字就地截断）
        tags: $('castLibEditTags').value.split(/[，,、]/).map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 20)).slice(0, 8),
      };
      if (!body.name || !body.persona) { toastInfo(t('castLibInvalid')); return; }
      saveButton.disabled = true;
      try {
        const r = await Api.request('/api/generate/character-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        await Api.jsonOrThrow(r); // v2.239：错误统一走 v2.226 脱敏层，内部裸码回落本地友好文案
        box.classList.add('hidden');
        // v2.177 c173 复盘修复：编辑成功后清空 thin 状态 + 清空搜索框，避免刚补全（score≥55）的资产被 thin 分支过滤掉，用户看不到刚编辑的资产
        castThinActive = false;
        const _si = $('castLibSearch');
        if (_si) _si.value = '';
        castAssetsLoaded = false; loadCastAssets(true);
        openCastLibrary();
      } catch (e) { toastError(e.message || t('castLibFail')); }
      finally { saveButton.disabled = false; }
    };
  }
  // —— v2.159 道具资产库管理面板：列表+体检徽章+冲突预警+内联编辑/删除（与 prop-assets health 端点同构） ——
  const PROP_LIB_LEVEL = { rich: 'propLibLevelRich', usable: 'propLibLevelUsable', thin: 'propLibLevelThin' };
  async function openPropLibrary() {
    const modal = $('propLibModal');
    if (!modal) return;
    if (!Api.isAuthed()) { openModal(modal.id); $('propLibGrid').innerHTML = ''; $('propLibConflicts').innerHTML = ''; $('propLibEdit').classList.add('hidden'); const e = $('propLibEmpty'); e.classList.remove('hidden'); e.innerHTML = znEmptyHtml(t('needLogin')); return; }
    const account = capturePrivateSession();
    openModal(modal.id);
    $('propLibEdit').classList.add('hidden');
    const grid = $('propLibGrid'); const empty = $('propLibEmpty');
    empty.classList.add('hidden'); $('propLibConflicts').innerHTML = '';
    znSkeleton(grid, 'grid');
    // v2.163 资产库检索：搜索框非空时带 q 关键词（与 cast 面板同口径）
    const sq = String($('propLibSearch')?.value ?? '').trim();
    const qs = sq ? `?q=${encodeURIComponent(sq)}` : '';
    const qh = sq ? `&q=${encodeURIComponent(sq)}` : '';
    try {
      const [listRes, healthRes] = await Promise.all([
        Api.request(`/api/generate/prop-assets${qs}`),
        // limit=200 拉满体检列表（家族铁律：默认 50 时徽章回退"空壳 0 分"误导）
        Api.request(`/api/generate/prop-assets/health?lang=${lang === 'en' ? 'en' : 'zh'}&limit=200${qh}`),
      ]);
      const listJson = await Api.jsonOrThrow(listRes);
      const assets = listJson.assets || [];
      const health = await Api.jsonOrThrow(healthRes);
      if (!isPrivateSessionCurrent(account)) return;
      // v2.166 复盘修复：usage 辅助观测失败不阻塞主面板（与 cast 面板同口径，独立 try 兜底空对象）
      let usage = {};
      try {
        const usageRes = await Api.request(`/api/generate/prop-assets/usage`);
        usage = (await Api.jsonOrThrow(usageRes)).usage || {};
      } catch { /* usage 辅助信息，失败静默 */ }
      if (!isPrivateSessionCurrent(account)) return;
      renderPropLibrary(assets, health, Number(listJson.total), usage);
    } catch {
      if (!isPrivateSessionCurrent(account)) return;
      // v2.170 复盘修复：fetch 失败时清空 dashJumpTarget，防残留状态导致下次开库误触发滚动高亮
      // v2.185 c180 同口径：也清 dashConflictScroll，防残留导致下次开库误触发滚动高亮
      dashJumpTarget = null;
      dashConflictScroll = null;
      grid.innerHTML = ''; empty.classList.remove('hidden'); empty.innerHTML = znErrorHtml(t('propLibFail'));
    }
  }
  function renderPropLibrary(assets, health, listTotal, usage) {
    const grid = $('propLibGrid'); const empty = $('propLibEmpty');
    const hMap = new Map((health.items || []).map((h) => [h.id, h]));
    const conflicts = health.conflicts || [];
    let conflictHtml = conflicts.length
      ? `<div class="notice" style="border-color:#c0392b"><b>${t('propLibConflictTitle')}</b><ul style="margin:4px 0 0 18px;padding:0">${conflicts.map((c) => `<li style="font-size:12px">${escapeHtml(c.note)}</li>`).join('')}</ul></div>`
      : '';
    // v2.164 复盘修复：搜索态下 total=命中数，文案从"资产库共 N 条"切"搜索命中 N 条"（三面板同口径）
    const shown = Math.max(assets.length, (health.items || []).length);
    const totalKnown = Math.max(Number.isFinite(listTotal) ? listTotal : 0, Number(health.total) || 0);
    if (totalKnown > shown && shown > 0) {
      const searching = String($('propLibSearch')?.value ?? '').trim() !== '';
      conflictHtml += `<div class="notice" style="margin-top:6px">${lang === 'en'
        ? (searching
          ? `${totalKnown} matches — showing the first ${shown} (panel cap 200).`
          : `Library has ${totalKnown} assets — showing the first ${shown} (panel cap 200). Older entries still work via project snapshots.`)
        : (searching
          ? `搜索命中 ${totalKnown} 条，仅显示前 ${shown} 条（上限 200）。`
          : `资产库共 ${totalKnown} 条，面板仅显示前 ${shown} 条（上限 200）；超出部分已引用项目不受影响。`)}</div>`;
    }
    // v2.175 空壳补全闭环：与 cast 面板同口径——v2.177 改用 propThinActive 持久态
    let thinFiltered = false;
    const thinActive = propThinActive;
    if (thinActive) {
      assets = assets.filter((a) => {
        const h = hMap.get(a.id);
        return h && typeof h.score === 'number' && h.score < 55;
      });
      thinFiltered = true;
    }
    if (thinFiltered) {
      const curQ = String($('propLibSearch')?.value ?? '').trim();
      conflictHtml = `<div class="notice" style="border-color:var(--cinnabar,#c0392b);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b>${curQ ? t('dashThinSearchFiltered', { n: assets.length, q: curQ }) : t('dashThinFiltered', { n: assets.length })}</b>
        <button type="button" class="btn-ghost dash-thin-clear" style="font-size:11px;padding:2px 8px">${t('dashThinClear')}</button>
        ${assets.length ? `<button type="button" class="btn-ghost dash-thin-batch-complete" style="font-size:11px;padding:2px 8px;border-color:var(--jade,#2e7d32);color:var(--jade,#2e7d32)">${t('dashThinBatchComplete')}</button>` : ''}
      </div>` + conflictHtml;
    }
    $('propLibConflicts').innerHTML = conflictHtml;
    // v2.176 复盘修复①：thin 筛选无结果时提前 return 会导致 dash-thin-clear 按钮事件不绑定 → 用户卡在筛选视图无法清除
    // → 把绑定提到 return 之前，确保按钮始终可点击（无论筛选有无结果）
    // v2.177 改为持久态清空：propThinActive=false + 清空搜索框 + openPropLibrary 恢复全量
    $('propLibConflicts').querySelectorAll('.dash-thin-clear').forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        propThinActive = false;
        const searchInput = $('propLibSearch');
        if (searchInput) searchInput.value = '';
        openPropLibrary();
      };
    });
    // v2.181 thin 视图"全部补全"（道具家族同构）：补 visualAnchor/taboo/tags，eps 不可补
    // v2.183 闭环（家族同构）：dry-run 预检 → confirm 字段清单 → 实际补全 → 结果带字段清单预览
    // v2.185 c180 升级（家族同构）：dry-run → modal dialog 字段选择 → 带 patches + fields 实际补全
    $('propLibConflicts').querySelectorAll('.dash-thin-batch-complete').forEach((b) => {
      b.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        b.disabled = true; const old = b.textContent; b.textContent = t('dashThinBatchPreview');
        const restore = () => { b.disabled = false; b.textContent = old; };
        try {
          const dryRes = await Api.request(`/api/generate/prop-assets/batch-complete?lang=${lang}&dry-run=1`, {
            method: 'POST', body: JSON.stringify({ ids: assets.map((a) => a.id) }),
          });
          const d = await Api.jsonOrThrow(dryRes);
          const u = (d.willUpdate || []).length, s = (d.willSkip || []).length;
          if (u === 0) {
            toastInfo(t('dashThinBatchNoop', { s }));
            restore();
            return;
          }
          const choice = await showBatchCompleteDialog(d);
          if (!choice) { restore(); return; }
          const { patches, fields } = choice;
          b.textContent = t('dashThinBatchDoing');
          const res = await Api.request(`/api/generate/prop-assets/batch-complete?lang=${lang}`, {
            method: 'POST', body: JSON.stringify({ ids: assets.map((a) => a.id), patches, fields }),
          });
          const j = await Api.jsonOrThrow(res);
          const updatedFields = (j.updated || []).flatMap((x) => x.filled || []);
          const uniqFields = [...new Set(updatedFields)];
          toastOk(t('dashThinBatchDoneWithFields', {
            u: (j.updated || []).length, s: (j.skipped || []).length,
            fields: uniqFields.length ? uniqFields.map(fieldName).join('、') : '-',
          }));
          propAssetsLoaded = false; openPropLibrary();
        } catch (err) {
          toastError(t('dashThinBatchFail') + (err && err.message ? `：${err.message}` : ''));
        } finally { restore(); }
      };
    });
    grid.innerHTML = '';
    empty.classList.toggle('hidden', assets.length > 0);
    if (!assets.length) { empty.innerHTML = znEmptyHtml(thinFiltered ? t('dashThinNoResult') : (String($('propLibSearch')?.value ?? '').trim() ? t('libSearchNoResult') : t('propLibEmpty'))); return; }
    assets.forEach((a) => {
      const h = hMap.get(a.id) || { score: 0, level: 'thin', advice: [] };
      const card = document.createElement('div');
      card.className = 'diag-panel';
      card.style.marginTop = '8px';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b style="font-size:14px">${escapeHtml(a.name)}</b>
          <span class="badge cast-lib-badge-${h.level}" title="${t('propLibScore')}: ${h.score}/100">${t(PROP_LIB_LEVEL[h.level])} ${h.score}</span>
          <span class="muted" style="font-size:11px">${t('propLibUsed', { n: a.usedCount || 0 })}${a.sourceProjectTitle ? ` · ${t('propLibFrom')}: ${escapeHtml(a.sourceProjectTitle)}` : ''}</span>
          <span style="flex:1"></span>
          <button class="btn-ghost prop-lib-edit" style="font-size:11px;padding:2px 8px">${t('propLibEdit')}</button>
          <button class="btn-ghost prop-lib-del" style="font-size:11px;padding:2px 8px">${t('propLibDelete')}</button>
        </div>
        <div style="font-size:12px;margin-top:4px">${escapeHtml(a.meaning || '')}</div>
        ${assetUsageHtml(a, usage, h.level)}
        ${a.taboo ? `<div class="muted" style="font-size:11px;margin-top:2px;color:#c0392b">⚠ ${t('propLibTaboo')}: ${escapeHtml(a.taboo)}</div>` : ''}
        ${(a.eps || []).length ? `<div class="muted" style="font-size:11px">${t('propLibEps')}: ${(a.eps || []).join(', ')}</div>` : ''}
        ${(a.closedEps || []).length ? `<div class="muted" style="font-size:11px">${t('propLibClosedEps')}: ${(a.closedEps || []).join(', ')}</div>` : ''}
        ${a.visualAnchor ? `<div class="muted" style="font-size:11px">${t('propLibAnchor')}: ${escapeHtml(a.visualAnchor)}</div>` : ''}
        ${adviceHtml(h)}`;
      card.querySelector('.prop-lib-edit').onclick = () => renderPropLibEditor(a);
      card.querySelector('.prop-lib-del').onclick = async () => {
        if (!(await uiConfirm({ body: t('propLibDeleteConfirm', { n: a.name }), danger: true, okText: lang === 'en' ? 'Delete' : '删除' }))) return;
        try {
          const r = await Api.request(`/api/generate/prop-assets/${a.id}`, { method: 'DELETE' });
          if (!r.ok && r.status !== 404) throw new Error('del');
          propAssetsLoaded = false; loadPropAssets(true);
          openPropLibrary();
        } catch { toastError(t('propLibFail')); }
      };
      // v2.169 补全闭环：从 dashboard 跳来时高亮该资产 + 滚到可视区（5 秒后清除），一次性消费 dashJumpTarget
      if (dashJumpTarget && dashJumpTarget.family === 'prop' && dashJumpTarget.id === a.id) {
        card.style.outline = '2px solid var(--gold, #c79a3a)';
        card.style.outlineOffset = '2px';
        setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 5000);
        dashJumpTarget = null;
      }
      grid.appendChild(card);
    });
    // v2.176 复盘修复②：dashJumpTarget 残留态——目标资产不在当前列表时 forEach 内 id 高亮分支永远不触发
    // → forEach 后无条件清空（thin 分支与 id 分支已消费的会跳过，因为已是 null）
    if (dashJumpTarget && dashJumpTarget.family === 'prop') dashJumpTarget = null;
    // v2.185 c180 dash-conflict 跳转后自动滚动到 conflicts 区 + 5 秒高亮闪烁（家族同构）
    if (dashConflictScroll === 'prop') {
      dashConflictScroll = null;
      const el = $('propLibConflicts');
      if (el) {
        setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 0 3px var(--gold, #c79a3a)';
        setTimeout(() => { el.style.boxShadow = ''; }, 5000);
      }
    }
  }
  function renderPropLibEditor(a) {
    const box = $('propLibEdit');
    box.classList.remove('hidden');
    box.innerHTML = `
      ${libSourceRow(a.sourceProjectTitle)}
      <div class="field"><label>${t('propLibName')}</label><input id="propLibEditName" value="${escapeHtml(a.name)}" maxlength="30" /></div>
      <div class="field"><label>${t('propLibMeaning')}</label><textarea id="propLibEditMeaning" rows="2" maxlength="200">${escapeHtml(a.meaning || '')}</textarea></div>
      <div class="field"><label>${t('propLibTaboo')}</label><input id="propLibEditTaboo" value="${escapeHtml(a.taboo || '')}" maxlength="200" placeholder="${lang === 'en' ? 'Usage taboo (optional)' : '使用禁忌(选填)'}" /></div>
      <div class="field"><label>${t('propLibEps')}</label><input id="propLibEditEps" value="${escapeHtml((a.eps || []).join(','))}" placeholder="${lang === 'en' ? 'e.g. 1,3,5' : '如 1,3,5'}" /></div>
      <div class="field"><label>${t('propLibClosedEps')}</label><input id="propLibEditClosedEps" value="${escapeHtml((a.closedEps || []).join(','))}" placeholder="${lang === 'en' ? 'e.g. 8' : '如 8'}" /></div>
      <div class="field"><label>${t('propLibAnchor')}</label><input id="propLibEditAnchor" value="${escapeHtml(a.visualAnchor || '')}" maxlength="200" /></div>
      <div class="field"><label>${t('propLibTags')}</label><input id="propLibEditTags" value="${escapeHtml((a.tags || []).join('，'))}" maxlength="200" placeholder="${lang === 'en' ? 'Comma separated, max 8 × 20 chars' : '逗号分隔，最多 8 个 × 20 字'}" /></div>
      <div class="row-actions" style="margin-top:6px">
        <button class="btn-primary" id="propLibEditSave">${t('propLibSave')}</button>
        <button class="btn-ghost" id="propLibEditCancel" style="margin-left:8px">${t('propLibCancel')}</button>
      </div>`;
    $('propLibEditCancel').onclick = () => box.classList.add('hidden');
    $('propLibEditSave').onclick = async () => {
      const saveButton = $('propLibEditSave');
      if (saveButton.disabled) return;
      // 整档覆盖语义（家族铁律）：eps/closedEps 不提交会被静默清空——编辑表单必须全字段随档提交；1-9999 与后端 normalizeEps 口径一致（超界就地剔除不静默存脏）
      const parseEps = (v) => v.split(/[，,、]/).map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 9999).slice(0, 500);
      const body = {
        id: a.id,
        name: $('propLibEditName').value.trim(),
        meaning: $('propLibEditMeaning').value.trim(),
        taboo: $('propLibEditTaboo').value.trim() || null,
        eps: parseEps($('propLibEditEps').value),
        closedEps: parseEps($('propLibEditClosedEps').value),
        visualAnchor: $('propLibEditAnchor').value.trim() || null,
        tags: $('propLibEditTags').value.split(/[，,、]/).map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 20)).slice(0, 8),
      };
      if (!body.name || !body.meaning) { toastInfo(t('propLibInvalid')); return; }
      saveButton.disabled = true;
      try {
        const r = await Api.request('/api/generate/prop-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        await Api.jsonOrThrow(r); // v2.239：错误统一走 v2.226 脱敏层，内部裸码回落本地友好文案
        box.classList.add('hidden');
        // v2.177 c173 复盘修复：编辑成功后清空 thin 状态 + 清空搜索框（与 cast 同构）
        propThinActive = false;
        const _si = $('propLibSearch');
        if (_si) _si.value = '';
        propAssetsLoaded = false; loadPropAssets(true);
        openPropLibrary();
      } catch (e) { toastError(e.message || t('propLibFail')); }
      finally { saveButton.disabled = false; }
    };
  }
  // —— v2.161 场景资产库管理面板：列表+体检徽章+冲突预警+内联编辑/删除（与 scene-assets health 端点同构，第三家族） ——
  const SCENE_LIB_LEVEL = { rich: 'sceneLibLevelRich', usable: 'sceneLibLevelUsable', thin: 'sceneLibLevelThin' };
  async function openSceneLibrary() {
    const modal = $('sceneLibModal');
    if (!modal) return;
    if (!Api.isAuthed()) { openModal(modal.id); $('sceneLibGrid').innerHTML = ''; $('sceneLibConflicts').innerHTML = ''; $('sceneLibEdit').classList.add('hidden'); const e = $('sceneLibEmpty'); e.classList.remove('hidden'); e.innerHTML = znEmptyHtml(t('needLogin')); return; }
    const account = capturePrivateSession();
    openModal(modal.id);
    $('sceneLibEdit').classList.add('hidden');
    const grid = $('sceneLibGrid'); const empty = $('sceneLibEmpty');
    empty.classList.add('hidden'); $('sceneLibConflicts').innerHTML = '';
    znSkeleton(grid, 'grid');
    // v2.163 资产库检索：搜索框非空时带 q 关键词（与 cast/prop 面板同口径）
    const sq = String($('sceneLibSearch')?.value ?? '').trim();
    const qs = sq ? `?q=${encodeURIComponent(sq)}` : '';
    const qh = sq ? `&q=${encodeURIComponent(sq)}` : '';
    try {
      const [listRes, healthRes] = await Promise.all([
        Api.request(`/api/generate/scene-assets${qs}`),
        // limit=200 拉满体检列表（家族铁律：默认 50 时徽章回退"空壳 0 分"误导）
        Api.request(`/api/generate/scene-assets/health?lang=${lang === 'en' ? 'en' : 'zh'}&limit=200${qh}`),
      ]);
      const listJson = await Api.jsonOrThrow(listRes);
      const assets = listJson.assets || [];
      const health = await Api.jsonOrThrow(healthRes);
      if (!isPrivateSessionCurrent(account)) return;
      // v2.166 复盘修复：usage 辅助观测失败不阻塞主面板（与 cast/prop 面板同口径，独立 try 兜底空对象）
      let usage = {};
      try {
        const usageRes = await Api.request(`/api/generate/scene-assets/usage`);
        usage = (await Api.jsonOrThrow(usageRes)).usage || {};
      } catch { /* usage 辅助信息，失败静默 */ }
      if (!isPrivateSessionCurrent(account)) return;
      renderSceneLibrary(assets, health, Number(listJson.total), usage);
    } catch {
      if (!isPrivateSessionCurrent(account)) return;
      // v2.170 复盘修复：fetch 失败时清空 dashJumpTarget，防残留状态导致下次开库误触发滚动高亮
      // v2.185 c180 同口径：也清 dashConflictScroll，防残留导致下次开库误触发滚动高亮
      dashJumpTarget = null;
      dashConflictScroll = null;
      grid.innerHTML = ''; empty.classList.remove('hidden'); empty.innerHTML = znErrorHtml(t('sceneLibFail'));
    }
  }
  function renderSceneLibrary(assets, health, listTotal, usage) {
    const grid = $('sceneLibGrid'); const empty = $('sceneLibEmpty');
    const hMap = new Map((health.items || []).map((h) => [h.id, h]));
    const conflicts = health.conflicts || [];
    let conflictHtml = conflicts.length
      ? `<div class="notice" style="border-color:#c0392b"><b>${t('sceneLibConflictTitle')}</b><ul style="margin:4px 0 0 18px;padding:0">${conflicts.map((c) => `<li style="font-size:12px">${escapeHtml(c.note)}</li>`).join('')}</ul></div>`
      : '';
    // v2.164 复盘修复：搜索态下 total=命中数，文案从"资产库共 N 条"切"搜索命中 N 条"（三面板同口径）
    const shown = Math.max(assets.length, (health.items || []).length);
    const totalKnown = Math.max(Number.isFinite(listTotal) ? listTotal : 0, Number(health.total) || 0);
    if (totalKnown > shown && shown > 0) {
      const searching = String($('sceneLibSearch')?.value ?? '').trim() !== '';
      conflictHtml += `<div class="notice" style="margin-top:6px">${lang === 'en'
        ? (searching
          ? `${totalKnown} matches — showing the first ${shown} (panel cap 200).`
          : `Library has ${totalKnown} assets — showing the first ${shown} (panel cap 200). Older entries still work via project snapshots.`)
        : (searching
          ? `搜索命中 ${totalKnown} 条，仅显示前 ${shown} 条（上限 200）。`
          : `资产库共 ${totalKnown} 条，面板仅显示前 ${shown} 条（上限 200）；超出部分已引用项目不受影响。`)}</div>`;
    }
    // v2.175 空壳补全闭环：与 cast/prop 面板同口径——v2.177 改用 sceneThinActive 持久态
    let thinFiltered = false;
    const thinActive = sceneThinActive;
    if (thinActive) {
      assets = assets.filter((a) => {
        const h = hMap.get(a.id);
        return h && typeof h.score === 'number' && h.score < 55;
      });
      thinFiltered = true;
    }
    if (thinFiltered) {
      const curQ = String($('sceneLibSearch')?.value ?? '').trim();
      conflictHtml = `<div class="notice" style="border-color:var(--cinnabar,#c0392b);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b>${curQ ? t('dashThinSearchFiltered', { n: assets.length, q: curQ }) : t('dashThinFiltered', { n: assets.length })}</b>
        <button type="button" class="btn-ghost dash-thin-clear" style="font-size:11px;padding:2px 8px">${t('dashThinClear')}</button>
        ${assets.length ? `<button type="button" class="btn-ghost dash-thin-batch-complete" style="font-size:11px;padding:2px 8px;border-color:var(--jade,#2e7d32);color:var(--jade,#2e7d32)">${t('dashThinBatchComplete')}</button>` : ''}
      </div>` + conflictHtml;
    }
    $('sceneLibConflicts').innerHTML = conflictHtml;
    // v2.176 复盘修复①：thin 筛选无结果时提前 return 会导致 dash-thin-clear 按钮事件不绑定 → 用户卡在筛选视图无法清除
    // → 把绑定提到 return 之前，确保按钮始终可点击（无论筛选有无结果）
    // v2.177 改为持久态清空：sceneThinActive=false + 清空搜索框 + openSceneLibrary 恢复全量
    $('sceneLibConflicts').querySelectorAll('.dash-thin-clear').forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        sceneThinActive = false;
        const searchInput = $('sceneLibSearch');
        if (searchInput) searchInput.value = '';
        openSceneLibrary();
      };
    });
    // v2.181 thin 视图"全部补全"（场景家族同构）：补 visualAnchor/mood/tags，eps 不可补
    // v2.183 闭环（家族同构）：dry-run 预检 → confirm 字段清单 → 实际补全 → 结果带字段清单预览
    // v2.185 c180 升级（家族同构）：dry-run → modal dialog 字段选择 → 带 patches + fields 实际补全
    $('sceneLibConflicts').querySelectorAll('.dash-thin-batch-complete').forEach((b) => {
      b.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        b.disabled = true; const old = b.textContent; b.textContent = t('dashThinBatchPreview');
        const restore = () => { b.disabled = false; b.textContent = old; };
        try {
          const dryRes = await Api.request(`/api/generate/scene-assets/batch-complete?lang=${lang}&dry-run=1`, {
            method: 'POST', body: JSON.stringify({ ids: assets.map((a) => a.id) }),
          });
          const d = await Api.jsonOrThrow(dryRes);
          const u = (d.willUpdate || []).length, s = (d.willSkip || []).length;
          if (u === 0) {
            toastInfo(t('dashThinBatchNoop', { s }));
            restore();
            return;
          }
          const choice = await showBatchCompleteDialog(d);
          if (!choice) { restore(); return; }
          const { patches, fields } = choice;
          b.textContent = t('dashThinBatchDoing');
          const res = await Api.request(`/api/generate/scene-assets/batch-complete?lang=${lang}`, {
            method: 'POST', body: JSON.stringify({ ids: assets.map((a) => a.id), patches, fields }),
          });
          const j = await Api.jsonOrThrow(res);
          const updatedFields = (j.updated || []).flatMap((x) => x.filled || []);
          const uniqFields = [...new Set(updatedFields)];
          toastOk(t('dashThinBatchDoneWithFields', {
            u: (j.updated || []).length, s: (j.skipped || []).length,
            fields: uniqFields.length ? uniqFields.map(fieldName).join('、') : '-',
          }));
          sceneAssetsLoaded = false; openSceneLibrary();
        } catch (err) {
          toastError(t('dashThinBatchFail') + (err && err.message ? `：${err.message}` : ''));
        } finally { restore(); }
      };
    });
    grid.innerHTML = '';
    empty.classList.toggle('hidden', assets.length > 0);
    if (!assets.length) { empty.innerHTML = znEmptyHtml(thinFiltered ? t('dashThinNoResult') : (String($('sceneLibSearch')?.value ?? '').trim() ? t('libSearchNoResult') : t('sceneLibEmpty'))); return; }
    assets.forEach((a) => {
      const h = hMap.get(a.id) || { score: 0, level: 'thin', advice: [] };
      const card = document.createElement('div');
      card.className = 'diag-panel';
      card.style.marginTop = '8px';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b style="font-size:14px">${escapeHtml(a.name)}</b>
          <span class="badge cast-lib-badge-${h.level}" title="${t('sceneLibScore')}: ${h.score}/100">${t(SCENE_LIB_LEVEL[h.level])} ${h.score}</span>
          <span class="muted" style="font-size:11px">${t('sceneLibUsed', { n: a.usedCount || 0 })}${a.sourceProjectTitle ? ` · ${t('sceneLibFrom')}: ${escapeHtml(a.sourceProjectTitle)}` : ''}</span>
          <span style="flex:1"></span>
          <button class="btn-ghost scene-lib-edit" style="font-size:11px;padding:2px 8px">${t('sceneLibEdit')}</button>
          <button class="btn-ghost scene-lib-del" style="font-size:11px;padding:2px 8px">${t('sceneLibDelete')}</button>
        </div>
        <div style="font-size:12px;margin-top:4px">${escapeHtml(a.meaning || '')}</div>
        ${assetUsageHtml(a, usage, h.level)}
        ${a.mood ? `<div class="muted" style="font-size:11px;margin-top:2px">${t('sceneLibMood')}: ${escapeHtml(a.mood)}</div>` : ''}
        ${a.taboo ? `<div class="muted" style="font-size:11px;margin-top:2px;color:#c0392b">⚠ ${t('sceneLibTaboo')}: ${escapeHtml(a.taboo)}</div>` : ''}
        ${(a.eps || []).length ? `<div class="muted" style="font-size:11px">${t('sceneLibEps')}: ${(a.eps || []).join(', ')}</div>` : ''}
        ${a.visualAnchor ? `<div class="muted" style="font-size:11px">${t('sceneLibAnchor')}: ${escapeHtml(a.visualAnchor)}</div>` : ''}
        ${adviceHtml(h)}`;
      card.querySelector('.scene-lib-edit').onclick = () => renderSceneLibEditor(a);
      card.querySelector('.scene-lib-del').onclick = async () => {
        if (!(await uiConfirm({ body: t('sceneLibDeleteConfirm', { n: a.name }), danger: true, okText: lang === 'en' ? 'Delete' : '删除' }))) return;
        try {
          const r = await Api.request(`/api/generate/scene-assets/${a.id}`, { method: 'DELETE' });
          if (!r.ok && r.status !== 404) throw new Error('del');
          sceneAssetsLoaded = false; loadSceneAssets(true);
          openSceneLibrary();
        } catch { toastError(t('sceneLibFail')); }
      };
      // v2.169 补全闭环：从 dashboard 跳来时高亮该资产 + 滚到可视区（5 秒后清除），一次性消费 dashJumpTarget
      if (dashJumpTarget && dashJumpTarget.family === 'scene' && dashJumpTarget.id === a.id) {
        card.style.outline = '2px solid var(--gold, #c79a3a)';
        card.style.outlineOffset = '2px';
        setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 5000);
        dashJumpTarget = null;
      }
      grid.appendChild(card);
    });
    // v2.176 复盘修复②：dashJumpTarget 残留态——目标资产不在当前列表时 forEach 内 id 高亮分支永远不触发
    // → forEach 后无条件清空（thin 分支与 id 分支已消费的会跳过，因为已是 null）
    if (dashJumpTarget && dashJumpTarget.family === 'scene') dashJumpTarget = null;
    // v2.185 c180 dash-conflict 跳转后自动滚动到 conflicts 区 + 5 秒高亮闪烁（家族同构）
    if (dashConflictScroll === 'scene') {
      dashConflictScroll = null;
      const el = $('sceneLibConflicts');
      if (el) {
        setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 0 3px var(--gold, #c79a3a)';
        setTimeout(() => { el.style.boxShadow = ''; }, 5000);
      }
    }
  }
  function renderSceneLibEditor(a) {
    const box = $('sceneLibEdit');
    box.classList.remove('hidden');
    box.innerHTML = `
      ${libSourceRow(a.sourceProjectTitle)}
      <div class="field"><label>${t('sceneLibName')}</label><input id="sceneLibEditName" value="${escapeHtml(a.name)}" maxlength="30" /></div>
      <div class="field"><label>${t('sceneLibMeaning')}</label><textarea id="sceneLibEditMeaning" rows="2" maxlength="200">${escapeHtml(a.meaning || '')}</textarea></div>
      <div class="field"><label>${t('sceneLibMood')}</label><input id="sceneLibEditMood" value="${escapeHtml(a.mood || '')}" maxlength="100" placeholder="${lang === 'en' ? 'Mood/tone (optional)' : '氛围基调(选填)'}" /></div>
      <div class="field"><label>${t('sceneLibTaboo')}</label><input id="sceneLibEditTaboo" value="${escapeHtml(a.taboo || '')}" maxlength="200" placeholder="${lang === 'en' ? 'State taboo (optional)' : '状态禁忌(选填)'}" /></div>
      <div class="field"><label>${t('sceneLibEps')}</label><input id="sceneLibEditEps" value="${escapeHtml((a.eps || []).join(','))}" placeholder="${lang === 'en' ? 'e.g. 1,3,5' : '如 1,3,5'}" /></div>
      <div class="field"><label>${t('sceneLibAnchor')}</label><input id="sceneLibEditAnchor" value="${escapeHtml(a.visualAnchor || '')}" maxlength="200" /></div>
      <div class="field"><label>${t('sceneLibTags')}</label><input id="sceneLibEditTags" value="${escapeHtml((a.tags || []).join('，'))}" maxlength="200" placeholder="${lang === 'en' ? 'Comma separated, max 8 × 20 chars' : '逗号分隔，最多 8 个 × 20 字'}" /></div>
      <div class="row-actions" style="margin-top:6px">
        <button class="btn-primary" id="sceneLibEditSave">${t('sceneLibSave')}</button>
        <button class="btn-ghost" id="sceneLibEditCancel" style="margin-left:8px">${t('sceneLibCancel')}</button>
      </div>`;
    $('sceneLibEditCancel').onclick = () => box.classList.add('hidden');
    $('sceneLibEditSave').onclick = async () => {
      const saveButton = $('sceneLibEditSave');
      if (saveButton.disabled) return;
      // 整档覆盖语义（家族铁律）：eps 不提交会被静默清空——编辑表单必须全字段随档提交；1-9999 与后端 normalizeEps 口径一致（超界就地剔除不静默存脏）
      const parseEps = (v) => v.split(/[，,、]/).map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 9999).slice(0, 500);
      const body = {
        id: a.id,
        name: $('sceneLibEditName').value.trim(),
        meaning: $('sceneLibEditMeaning').value.trim(),
        mood: $('sceneLibEditMood').value.trim() || null,
        taboo: $('sceneLibEditTaboo').value.trim() || null,
        eps: parseEps($('sceneLibEditEps').value),
        visualAnchor: $('sceneLibEditAnchor').value.trim() || null,
        tags: $('sceneLibEditTags').value.split(/[，,、]/).map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 20)).slice(0, 8),
      };
      if (!body.name || !body.meaning) { toastInfo(t('sceneLibInvalid')); return; }
      saveButton.disabled = true;
      try {
        const r = await Api.request('/api/generate/scene-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        await Api.jsonOrThrow(r); // v2.239：错误统一走 v2.226 脱敏层，内部裸码回落本地友好文案
        box.classList.add('hidden');
        // v2.177 c173 复盘修复：编辑成功后清空 thin 状态 + 清空搜索框（与 cast/prop 同构）
        sceneThinActive = false;
        const _si = $('sceneLibSearch');
        if (_si) _si.value = '';
        sceneAssetsLoaded = false; loadSceneAssets(true);
        openSceneLibrary();
      } catch (e) { toastError(e.message || t('sceneLibFail')); }
      finally { saveButton.disabled = false; }
    };
  }
  function wireFormatSelector() {
    const sel = $('scriptFormatSel'), dur = $('aigcDurField'), styleField = $('aigcStyleField'), camField = $('aigcCameraField');
    if (!sel || sel.dataset.wired) return;
    sel.dataset.wired = '1';
    const sync = () => {
      const isAigc = sel.value === 'AIGC';
      if (dur) dur.classList.toggle('hidden', !isAigc);
      if (styleField) styleField.classList.toggle('hidden', !isAigc);
      if (camField) camField.classList.toggle('hidden', !isAigc);
      if (isAigc) { loadVisualStyles(); loadCameraLanguages(); }
    };
    sel.addEventListener('change', sync); sync();
  }

  // v2.279 SSE 断流恢复：服务端断连后继续跑完、正常结算入库（generate.ts「断网不丢」语义），
  // 前端断流（NETWORK_ERR/TIMEOUT）不得直接判失败——否则用户看到失败但积分已扣、分集其实在生成。
  // 断流且已持 projectId 时按 /projects/:id/scripts 轮询分集落库：拿到分集即恢复（卡片转完成、
  // 切作品视图打开真实成稿）；超时/确认失败才落失败面板。全程尊重换号守卫与卡片移除。
  async function pollUntilSettled(session, account) {
    const DEADLINE_MS = 10 * 60 * 1000; // 与服务端全局硬超时 30min 错位：前端 10min 无落库即判恢复失败
    const INTERVAL_MS = 4000;
    const deadline = Date.now() + DEADLINE_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      if (!genSessions.includes(session) || !isPrivateSessionCurrent(account)) return false; // 卡片被移除/换号：放弃恢复
      try {
        const r = await Api.request(`/api/generate/projects/${session.projectId}/scripts`);
        const eps = await Api.jsonOrThrow(r);
        if (!genSessions.includes(session) || !isPrivateSessionCurrent(account)) return false;
        if (Array.isArray(eps) && eps.length > 0) {
          session.status = 'done';
          session.doneData = { episodes: eps, recovered: true }; // 断流恢复无 done 帧完整载荷：以真实分集为准
          renderTaskQueue();
          if (session.id === activeSessionId) {
            switchView('works');
            try { await openProject(session.project || { id: session.projectId, title: session.title }); }
            catch (e) { toastError((e && e.message) || (lang === 'en' ? 'Unable to open project.' : '打开作品失败，请重试。')); }
          }
          return true;
        }
      } catch (e) { if (e && e.code === 'AUTH_REQUIRED') return false; /* 其余错误下轮再试 */ }
    }
    return false;
  }
  function failGenerationSession(session, message) {
    session.status = 'failed'; session.error = message;
    if (session.id === activeSessionId) $('progressPanel').classList.add('hidden');
    renderTaskQueue();
  }
  // v2.203 防连点：UI 事件层 800ms 节流——手抖连点轻提示后忽略；程序化调用与测试直调 startGenerate 不经 guard、不受影响；
  // 间隔足够仍正常开新单（多任务并行特性不受影响）
  let _lastGenClick = 0;
  function genClickGuard(fn) {
    return (...args) => {
      const now = Date.now();
      if (now - _lastGenClick < 800) { toastInfo(lang === 'en' ? 'Easy there — one at a time.' : '点太快啦，稍等一下再开新单～'); return; }
      _lastGenClick = now;
      return fn(...args);
    };
  }
  // v2.276 建卡前「启动准备」瞬时单飞闸：弱网下入口到会话卡之间要串行 await 三份资产清单（数秒、期间零反馈），
  // 该窗口内重复点击会重放 GET 并连发 POST /projects（紧接扣费 episodes）。闸仅覆盖准备期，建卡前同一同步执行段
  // 立即释放，故 v2.132「卡后多任务并行」完全不受影响。
  let _genStarting = false;
  // v2.277 失败重试「项目复用句柄」：episodes 阶段失败时项目行已真实建成（占额度），点重试若整链路重跑
  // 会再 POST /projects 造空壳孤儿（实测一次重试 projects 1→2、两张同标题失败卡，FREE 档重试两次即触顶）。
  // #failRetry 仅对「已持服务端项目 + 已留 briefText」的失败会话安装句柄；startGenerate 入口同步取走即清空。
  let _retryProject = null;
  let _retryBrief = null;
  async function startGenerate() {
    if (!Api.isAuthed()) { xnSay(t('needLogin')); openAuth('login'); return; }
    if (_genStarting) {
      xnSay(lang === 'en' ? 'Still getting your last run ready…' : '正在准备上一条创作，马上就好～');
      return;
    }
    _genStarting = true;
    try {
    // v2.277 同步消费重试句柄（先于任何 await）：点击处理→此处同一同步执行段，并发不可见；取走即清空，普通生成永不误伤
    const reuseProject = _retryProject;
    const reuseBrief = _retryBrief;
    _retryProject = null;
    _retryBrief = null;
    const account = capturePrivateSession();
    const generationDraft = selectedMode === 'spark' ? draftProject : null;
    for (const loadAssets of [loadCastAssets, loadPropAssets, loadSceneAssets]) {
      await loadAssets();
      if (!isPrivateSessionCurrent(account)) return;
    }
    let brief, projTitle;
    const useTagBench = selectedMode === 'tag' && $('tagBench') && !$('tagBench').classList.contains('hidden');
    if (reuseBrief != null) {
      // v2.277 失败重试：沿用上一次已建项目的简报与标题，跳过输入框/tagBench 校验（失败时面板可能已不在原视图）
      brief = reuseBrief;
      projTitle = (reuseProject && reuseProject.title) || brief.slice(0, 40);
    } else if (useTagBench) {
      brief = buildTagBrief();
      if (!brief || !brief.trim()) { xnSay(t('tagNoPick')); return; }
      rememberPrefTags(tagChosen); // 手动确认出本的标签同样沉淀为长期偏好
      projTitle = tagProjectTitle();
    } else {
      brief = ($('modeBrief')?.value || '').trim();
      // v2.317 采访模式：主创意框为空时，认采访面板内嵌框里已写的创意并回填，不再让用户重抄一遍
      if (!brief && selectedMode === 'interview') {
        const fromIv = ($('ivAnswer')?.value || '').trim();
        if (fromIv.length >= 4) {
          brief = fromIv;
          if ($('modeBrief')) $('modeBrief').value = fromIv;
          ivIdeaValue = fromIv;
        }
      }
      if (!brief) {
        xnSay(selectedMode === 'interview'
          ? ivT().needIdea
          : (lang === 'en' ? 'Please fill in your idea above first.' : '先在上方输入框写清你的创意，小南才能开工～'));
        if (selectedMode === 'interview') { $('interviewPanel')?.classList.remove('hidden'); $('ivAnswer')?.focus(); }
        else { $('modeBrief')?.focus(); $('modeBriefPanel')?.classList.remove('hidden'); }
        return;
      }
      projTitle = generationDraft?.title || brief.slice(0, 40);
    }
    // v2.93 剧情软广：品牌简报必填校验（广告词合规由服务端在扣费前预检并回传命中词）
    const bbPayload = brandBriefPayload();
    if (bbPayload === null) return;
    // v2.94 热点追更：热点简报必填校验（隐私硬信息由服务端在扣费前预检拦截）
    const tbPayload = trendBriefPayload();
    if (tbPayload === null) return;
    // v2.95 互动分支：分支简报必填校验（闭环矛盾由服务端在扣费前预检拦截）
    const brPayload = branchBriefPayload();
    if (brPayload === null) return;
    // v2.132 多任务并行：每单注册独立会话卡片，genBtn 不再被单任务独占（生成期间可再开新单）
    const session = { id: 'S' + Date.now() + Math.random().toString(36).slice(2, 6), account, title: projTitle, projectId: null, progress: null, abortCtrl: null, status: 'running', doneData: null, pendingWarnings: null, error: null };
    _genStarting = false; // v2.276 建卡前瞬时释放（与下一行 unshift 同同步执行段，二次点击事件无法插入）；卡后即恢复 v2.132 并行
    genSessions.unshift(session); activeSessionId = session.id; renderTaskQueue();
    resetPanels(); $('progressPanel').classList.remove('hidden');
    try {
      const totalEps = Math.max(1, Math.min(300, parseInt($('episodes').value, 10) || 20));
      const investRaw = parseInt($('investWan').value, 10);
      const investWan = Number.isFinite(investRaw) && investRaw >= 0 ? investRaw : undefined;
      const specialTopic = $('specialTopic').checked;
      let project = generationDraft || reuseProject; // v2.277 episodes 阶段失败重试：项目已建行，复用之，不再 POST /projects 造孤儿
      if (!project) {
        const pr = await Api.request('/api/generate/projects', { method: 'POST', body: JSON.stringify({
          title: projTitle, mode: selectedMode, scriptType: selectedScriptType, outputLang: outputLangValue(), ...(selectedMode === 'spark' ? { track: selectedTrack } : {}), totalEps, engineTier: $('engine').value,
          // v2.328 自动匹配：创意随立项一起提交，后端据此路由模式/轨道（不手选）
          ...(selectedMode === 'auto' ? { brief: brief.trim() } : {}),
          // v2.319 tags 模式：选中标签结构化上传（中文原名，服务端消费端按中文精确匹配；不再只依赖纯文本 brief）
          ...(useTagBench ? { tags: tagChosen.slice(0, TAG_MAX) } : {}),
          // v2.319 adapt/novel/hit_lab：原文立项即持久化进 bible，刷新续写/草稿恢复版权闸门不中断（与 episodes 同口径）
          ...sourceTextPayload(),
          format: $('scriptFormatSel') ? $('scriptFormatSel').value : 'LIVE_ACTION', investWan, specialTopic, ...hookPayload(), ...beatPayload(), ...castAssetPayload(), ...propAssetPayload(), ...sceneAssetPayload() }) });
        if (!isPrivateSessionCurrent(account)) return;
        if (!pr.ok) {
          genSessions = genSessions.filter((x) => x !== session); renderTaskQueue(); // 建单失败即时撤卡
          const ej = await pr.json().catch(() => ({}));
          if (!isPrivateSessionCurrent(account)) return;
          if (ej.error === 'REACH_PROJECT_LIMIT') {
            toastError((ej.message || '项目数已达当前会员上限') + ' 免费2/基础10/高级30/专业100，升级会员或清理旧项目即可继续');
            return;
          }
          if (ej.error === 'MATURE_CONSENT_REQUIRED') { openXMature().catch(() => {}); return; }
          throw new Error(znSanitizeErr(ej.message || ej.error || ('HTTP ' + pr.status), pr.status)); // v2.239：内部裸码脱敏
        }
        project = await pr.json();
        // v2.328 自动匹配结果如实告知：匹配到什么、置信度、备选与是否需要澄清
        if (project.autoRouted) {
          const ar = project.autoRouted;
          const pct = Math.round((ar.confidence || 0) * 100);
          const alt = (ar.alternatives || []).slice(0, 2).map((x) => x.name).join(' / ');
          toastInfo(lang === 'en'
            ? `Auto-matched: ${ar.name} (${pct}%)${alt ? ` · also close: ${alt}` : ''}${ar.needsClarify ? ' · description is thin; switching to Interview is recommended' : ''}`
            : `已自动匹配：${ar.name}（${pct}%）${alt ? ` · 备选：${alt}` : ''}${ar.needsClarify ? ' · 描述偏少，建议改用采访式创作聊清楚' : ''}`, lang === 'en' ? 'Auto mode' : '自动匹配');
        }
      }
      if (!isPrivateSessionCurrent(account)) return;
      session.project = project;
      session.projectId = project.id;
      lastFiling = project.filing || null;
      session.abortCtrl = abortCtrl = new AbortController();
      session.progress = progress = PV().createProgress({ lang }); renderProgress(); pendingWarnings = null;
      renderTaskQueue();
      session.briefText = brief.trim(); // v2.277 仅 episodes 阶段留存原简报：失败后 #failRetry 凭此 + session.project 安装复用句柄
      const res = await Api.request('/api/generate/episodes', { method: 'POST', signal: abortCtrl.signal,
        body: JSON.stringify({ projectId: project.id, brief: brief.trim(), engineTier: $('engine').value, lang: outLocale(), ...hookPayload(), ...beatPayload(), ...(aigcPayload()), ...(selectedMode === 'spark' ? { track: selectedTrack } : {}), ...bbPayload, ...tbPayload, ...brPayload, ...sourceTextPayload() }) });
      if (!isPrivateSessionCurrent(account)) { res.body?.cancel().catch(() => {}); return; }
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        if (!isPrivateSessionCurrent(account)) return;
        let msg = txt || ('HTTP ' + res.status);
        let j = null;
        try { j = JSON.parse(txt); if (j && j.error) msg = j.error; } catch { /* 非 JSON 原样展示 */ }
        msg = znSanitizeErr(msg, res.status); // v2.239：内部裸码回落本地友好文案（body 已消费，走同口径 helper）
        // v2.95 互动分支：闭环校验/必填错误就地提示（尚未扣费）
        if (j && (j.error === 'BRANCH_VALIDATION_FAILED' || j.field === 'mainLine' || j.field === 'choicePoints' || j.field === 'endings')) {
          failGenerationSession(session, j.message || msg);
          showBranchError(j.message || BRANCH_UI_DICT().required);
          return;
        }
        // v2.94 热点简报：隐私硬信息/必填字段错误就地提示（尚未扣费），不弹通用失败
        if (j && (j.error === 'TREND_PII_BLOCKED' || j.field === 'trendName' || j.field === 'heatCore')) {
          failGenerationSession(session, j.message || msg);
          showTrendError(j.message || TREND_UI_DICT().pii);
          return;
        }
        // v2.93 品牌简报违规：在面板内就地提示命中词（此时尚未扣费），不再弹通用失败
        if (j && (j.error === 'AD_CLAIM_BLOCKED' || j.field)) {
          failGenerationSession(session, j.message || msg);
          const hits = Array.isArray(j.hits) && j.hits.length ? '：' + j.hits.join('、') : '';
          showBrandError((j.message || j.error || '品牌简报未通过校验') + hits);
          return;
        }
        throw new Error(msg);
      }
      if (draftProject?.id === project.id) clearDraftProject();
      const reader = res.body.getReader(), dec = new TextDecoder(); const buf = { text: '' };
      for (;;) {
        const { done, value } = await reader.read();
        if (!isPrivateSessionCurrent(account)) { reader.cancel().catch(() => {}); return; }
        if (done) break;
        const frames = PV().parseSseChunk(buf, dec.decode(value, { stream: true }));
        frames.forEach((f) => handleEvent(f, session));
      }
    } catch (e) {
      if (!isPrivateSessionCurrent(account) || e.code === 'SESSION_CHANGED') return;
      // v2.277 网络裸码（NETWORK_ERR/TIMEOUT，api.js makeNetErr 的 message 即裸码）与 5xx 同口径回落本地文案，
      // 失败面板大字不再直出 NETWORK_ERR；服务端业务错误在此之前已由 znSanitizeErr 脱敏，保持原样。
      const friendly = (e.code === 'NETWORK_ERR' || e.code === 'TIMEOUT')
        ? (lang === 'en'
          ? (e.code === 'TIMEOUT' ? 'Request timed out — check your network and retry.' : 'Network error — please retry later.')
          : (e.code === 'TIMEOUT' ? '请求超时，请检查网络后重试' : '网络异常，请稍后重试'))
        : String(e.message || e);
      // v2.279 断流恢复优先：连接断开≠生成失败（服务端断连后仍跑完入库）。
      // 已持 projectId 的断流先轮询分集落库恢复真实结果，恢复无果才落失败面板。
      if ((e.code === 'NETWORK_ERR' || e.code === 'TIMEOUT') && session.projectId) {
        session.recovering = true; renderTaskQueue(); // 卡片转「重连中」，用户知情服务端仍在跑
        const recovered = await pollUntilSettled(session, account);
        session.recovering = false;
        if (recovered) return; // 已渲染真实成稿，不再落失败
        if (!genSessions.includes(session) || !isPrivateSessionCurrent(account)) return; // 恢复期间卡片被移除/换号
      }
      failGenerationSession(session, friendly);
      if (e.code === 'AUTH_REQUIRED') openAuth('login'); else showFail(friendly);
    } finally { if (isPrivateSessionCurrent(account)) renderTaskQueue(); }
    } finally {
      _genStarting = false; // v2.276 兜底：准备期任何提前 return / 抛错都释放，杜绝一次失败后永久不能生成
    }
  }
  function handleEvent(data, session) {
    if (!genSessions.includes(session) || !isPrivateSessionCurrent(session.account)) return;
    if (data.taskId && !session.taskId) session.taskId = data.taskId; // v2.233 取消闭环：frozen 帧起捕获，供取消端点调用
    session.progress = PV().reduceProgress(session.progress, data);
    if (session.id === activeSessionId) { progress = session.progress; renderProgress(); }
    // v2.233 用户显式取消：后端已 abort 流水线、退还冻结积分并标 CANCELLED（v2.190 能力的前端消费）
    if (data.stage === 'cancelled') {
      session.status = 'failed'; session.error = t('genCancelled'); renderTaskQueue();
      if (session.id === activeSessionId) showFail(session.error, true);
      return;
    }
    // 受限题材合规预警（只提醒、不拦截）：小南先提示改写法，结果区再汇总（随会话保存，切回可复现）
    if (data.stage === 'context' && Array.isArray(data.complianceWarnings) && data.complianceWarnings.length) {
      session.pendingWarnings = data.complianceWarnings;
      if (session.id === activeSessionId) {
        pendingWarnings = data.complianceWarnings;
        const w0 = data.complianceWarnings[0];
        xnSay((lang === 'en' ? 'Compliance note: ' : '小南合规提醒：') + (w0.advice || w0.label || ''));
      }
    }
    if (data.stage === 'done') {
      session.status = 'done'; session.doneData = data; renderTaskQueue();
      if (session.id === activeSessionId) { lastDone = data; renderResult(data, session.projectId); }
    }
    if (data.stage === 'failed_refunded') {
      session.status = 'failed'; session.error = data.error || 'failed'; renderTaskQueue();
      if (session.id === activeSessionId) showFail(session.error, true);
    }
    if (session.status === 'running') renderTaskQueue(); // 进度事件刷新卡片面
  }
  // v2.35 Z-AIGC 构成仪表盘：总量/画面叙述/发声配比 + 逐场曲线 + 机器分镜数，让用户看懂"本子给模型看得够不够"
  function renderAigcDash(done) {
    const box = $('aigcDash'); if (!box) return;
    const plan = done.aigcVolumePlan, curve = Array.isArray(done.aigcCurve) ? done.aigcCurve : null;
    const fmt = done.format || null, manifest = done.aigcManifest || null;
    if (!plan || !fmt) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    const en = lang === 'en';
    const pct = (x) => Math.round((x || 0) * 100) + '%';
    // 全本发声占比：逐场加权
    let narr = 0, spoken = 0;
    (curve || []).forEach((c) => { narr += c.narrativeCjk || 0; spoken += c.spokenCjk || 0; });
    const tot = narr + spoken || 1, spokenPct = spoken / tot;
    const inBand = spokenPct >= 0.18 && spokenPct <= 0.28;
    const bar = (label, val, color) => `<div class="ad-row"><span class="ad-lbl">${label}</span><span class="ad-track"><i style="width:${Math.min(100, Math.round(val * 100))}%;background:${color}"></i></span><b>${pct(val)}</b></div>`;
    const roleZh = { opening: '开场', body: '铺陈', climax: '转折', ending: '集尾钩子' };
    const roleEn = { opening: 'Open', body: 'Body', climax: 'Turn', ending: 'Hook' };
    const spark = (curve || []).map((c) => {
      const v = Math.round(c.spokenRatio * 100);
      const color = c.inBand ? '#4c8dff' : '#e08a2e';
      const tip = `${c.scene}·${en ? c.role : roleZh[c.role] || c.role}｜${en ? 'spoken' : '发声'}${v}%｜${c.dialogueLines}${en ? ' lines' : '句'}`;
      return `<i class="ad-bar" title="${tip.replace(/"/g, '')}" style="height:${Math.max(8, v * 2)}px;background:${color}"></i>`;
    }).join('');
    const issues = [];
    if (fmt.violations && fmt.violations.length) issues.push(...fmt.violations.slice(0, 4));
    box.innerHTML = `
      <div class="ad-head"><b>${en ? 'Z-AIGC composition dashboard' : 'Z-AIGC 制作本构成仪表盘'}</b>
        <span class="ad-plan">${en ? plan.noteEn : plan.noteZh}</span></div>
      <div class="ad-grid">
        <div class="ad-block">
          ${bar(en ? 'Visual narrative (non-spoken)' : '画面叙述（不发声）', narr / tot, '#5b8def')}
          ${bar(en ? 'Dialogue+V.O. (spoken, target 18-28%)' : '台词+OS（发声，目标18-28%）', spokenPct, inBand ? '#3fbf8f' : '#e08a2e')}
          <div class="ad-meta">${en ? 'Total chars' : '全集字数'}：${fmt.cjk} / ${fmt.range[0]}-${fmt.range[1]}${fmt.inRange ? '✓' : '⚠'}　
            ${en ? 'Machine shots' : '机器分镜'}：${manifest ? manifest.shotCount : '-'}　
            ${en ? 'Format score' : '制式得分'}：${fmt.score}</div>
        </div>
        <div class="ad-block">
          <div class="ad-lbl">${en ? 'Per-scene spoken ratio (blue=in band, orange=off)' : '逐场发声占比（蓝=合理，橙=偏）'}</div>
          <div class="ad-spark">${spark}</div>
        </div>
      </div>
      ${issues.length ? `<div class="ad-issues">${en ? 'To fix: ' : '小南建议：'}${issues.map((x) => `· ${escapeHtml(x)}`).join(' ')}</div>` : `<div class="ad-ok">${en ? 'Composition is production-ready for an AI-video pipeline.' : '构成合理，可直接进入 AI 视频自动化工作流拆分镜。'}</div>`}`;
  }

  async function renderResult(done, projectId) {
    currentProjectId = projectId;
    $('progressPanel').classList.add('hidden'); $('resultPanel').classList.remove('hidden'); $('failPanel').classList.add('hidden');
    const sg = done.antiAi || {}, mk = done.market || {};
    const rows = [
      [lang === 'en' ? 'Anti-AI' : '去AI化', sg.antiAiScore ?? sg.score ?? '-'],
      [lang === 'en' ? 'Market fit' : '市场匹配', mk.overall ?? mk.score ?? mk.fit],
      [lang === 'en' ? 'Audience' : '受众精准', done.audience?.cravingScore ?? (typeof done.audience === 'number' ? done.audience : '-')],
    ];
    $('scoreGrid').innerHTML = rows.map(([k, v]) => `<div class="score-cell"><b>${escapeHtml(PV().formatDisplayValue(v))}</b><span>${k}</span></div>`).join('');
    $('sandboxTip').classList.toggle('hidden', !done.sandbox);
    if (done.sandbox) $('sandboxTip').textContent = t('sandboxTip');
    // 受限题材改写法建议（9·1《微短剧发展管理办法》对接，WARN 级不阻断创作）
    const cTip = $('complianceTip');
    if (cTip) {
      if (pendingWarnings && pendingWarnings.length) {
        cTip.classList.remove('hidden');
        const head = lang === 'en' ? 'Compliance rewrite tips: ' : '⚠ 合规改写法建议（不影响生成，供定稿参考）：';
        cTip.innerHTML = head + pendingWarnings.map((w) => `<div>· ${escapeHtml(w.advice || w.label)}</div>`).join('');
      } else cTip.classList.add('hidden');
    }
    // AIGC 剧本显著标注（《办法》强制，每集明显位置）
    const aiTip = $('aiLabelTip');
    if (aiTip) {
      if (done.aiLabel) { aiTip.classList.remove('hidden'); aiTip.textContent = done.aiLabel; }
      else aiTip.classList.add('hidden');
    }
    // 三类分级备案提示（9·1《办法》）
    const fTip = $('filingTip');
    if (fTip) {
      if (lastFiling) {
        const f = lastFiling;
        fTip.classList.remove('hidden');
        if (lang === 'en') {
          const cert = f.certName ? ` · pre-broadcast cert: ${f.certName}` : '';
          const qual = f.qualRequired ? ' · production license required' : '';
          const days = f.reviewDays ? ` · review within ${f.reviewDays} days` : '';
          const refile = (f.cls === 'I' || f.cls === 'II') ? ' · changing lead characterization or main storyline requires re-filing' : '';
          fTip.textContent = `Filing class ${f.cls} ${f.name || ''}${cert}${qual}${days}${refile}. ${(f.reasons || []).join('; ')}`;
        } else {
          const cert = f.certName ? `｜播出前凭证：${f.certName}` : '';
          const qual = f.qualRequired ? '｜须持《广播电视节目制作经营许可证》' : '';
          const days = f.reviewDays ? `｜受理起约${f.reviewDays}日` : '';
          const refile = (f.cls === 'I' || f.cls === 'II') ? '｜后续若改主角定位或主线走向须重新备案' : '';
          fTip.textContent = `📋 备案类别：${f.cls} 类 · ${f.name || ''}${cert}${qual}${days}${refile}。${(f.reasons || []).join('；')}`;
        }
      } else fTip.classList.add('hidden');
    }
    // 成稿后第三级机器抽检
    const psTip = $('postScanTip');
    if (psTip) {
      const ps = done.postScan;
      if (ps && ps.level === 'block') {
        psTip.classList.remove('hidden');
        psTip.textContent = (lang === 'en'
          ? `Post-check flagged ${ps.blocked.length} risk(s): ${ps.blocked.map((b) => b.matched).join(', ')} — revise before export.`
          : `⚠ 成稿抽检命中 ${ps.blocked.length} 处风险（${ps.blocked.map((b) => b.matched).join('、')}），建议修改后再导出/投稿`);
      } else if (ps && ps.level === 'warn') {
        psTip.classList.remove('hidden');
        psTip.textContent = (lang === 'en'
          ? `Post-check notes: ${ps.warnings.map((w) => w.label).join('; ')}`
          : `成稿抽检提示：${ps.warnings.map((w) => w.label).join('；')}，请正向表达、点到为止`);
      } else psTip.classList.add('hidden');
    }
    // v2.96 模式级成稿闸门提示：软警告（不拦截，仅提示）+ 硬拦截（不该走到这，防御性展示）
    const mgTip = $('modeGateTip');
    if (mgTip) {
      const mg = done.modeGate;
      if (mg && (mg.blocked?.length || mg.warnings?.length)) {
        mgTip.classList.remove('hidden');
        const warnRules = (mg.warnings || []).map((w) => w.rule);
        const blockRules = (mg.blocked || []).map((b) => b.rule);
        const scoreTxt = typeof mg.score === 'number' ? `（${mg.score}/100）` : '';
        const all = [...blockRules, ...warnRules];
        mgTip.textContent = (lang === 'en'
          ? `Mode gate ${mg.mode}${scoreTxt}: ${all.join(', ')} — see suggestions below.`
          : `模式闸门·${mg.mode}${scoreTxt}：${all.join('、')}，请参照建议优化`);
        mgTip.title = (mg.warnings || []).map((w) => `${w.rule}: ${w.advice}`).join('\n') || '';
      } else mgTip.classList.add('hidden');
    }
    // v2.97 一线编剧改稿尺子评分卡：avg 综合分 + P0/P1 硬伤列表（P2 仅在展开详情里）
    const clTip = $('craftLintTip');
    if (clTip) {
      const cl = done.craftLint;
      if (cl && cl.issues?.length) {
        clTip.classList.remove('hidden');
        const hard = [...(cl.p0 || []), ...(cl.p1 || [])];
        const avg = typeof cl.avg === 'number' ? cl.avg : 0;
        const color = avg >= 80 ? '#2e7d32' : avg >= 60 ? '#e0a030' : '#c0392b';
        if (hard.length) {
          clTip.innerHTML = (lang === 'en'
            ? `<b style="color:${color}">Craft score ${avg}/100</b> · ${hard.length} hard issue(s): ${hard.map((i) => i.dim).join(', ')}`
            : `<b style="color:${color}">编剧改稿尺子 ${avg}/100</b> · ${hard.length} 处硬伤：${hard.map((i) => i.dim).join('、')}`);
          clTip.title = hard.map((i) => `[${i.level}] ${i.dim}: ${i.advice}`).join('\n');
        } else {
          clTip.innerHTML = (lang === 'en'
            ? `<b style="color:${color}">Craft score ${avg}/100</b> · no hard issues, ${cl.issues.length} advisory note(s).`
            : `<b style="color:${color}">编剧改稿尺子 ${avg}/100</b> · 无硬伤，${cl.issues.length} 条优化建议`);
          clTip.title = cl.issues.map((i) => `[${i.level}] ${i.dim}(${i.score}): ${i.advice}`).join('\n');
        }
      } else clTip.classList.add('hidden');
    }
    // v2.98 四套进阶创作尺子聚合评分卡：情绪/网文/原型/叙事
    const cdTip = $('craftDepthTip');
    if (cdTip) {
      const cd = done.craftDepth;
      if (cd) {
        cdTip.classList.remove('hidden');
        const hard = (cd.p1 || []).length;
        const avg = typeof cd.avg === 'number' ? cd.avg : 0;
        const color = avg >= 80 ? '#1565c0' : avg >= 60 ? '#e0a030' : '#c0392b';
        const subs = [cd.emotion, cd.webnovel, cd.archetype, cd.narrative].filter(Boolean);
        cdTip.innerHTML = (lang === 'en'
          ? `<b style="color:${color}">Craft depth ${avg}/100</b> · ${subs.map((s) => `${s.avg}`).join('/')} across emotion/webnovel/archetype/narrative${hard ? ` · ${hard} hard issue(s)` : ''}`
          : `<b style="color:${color}">创作深度 ${avg}/100</b> · 情绪/网文/原型/叙事 ${subs.map((s) => s.avg).join('/')}${hard ? ` · ${hard} 处硬伤` : ''}`);
        cdTip.title = [...(cd.p1 || []), ...(cd.p2 || [])].map((i) => `[${i.level}] ${i.dim}: ${i.advice}`).join('\n') || '';
      } else cdTip.classList.add('hidden');
    }
    // v2.99 市场赛道识别（下沉 vs 精品）
    const tkTip = $('trackTip');
    if (tkTip) {
      const tk = done.track;
      if (tk) {
        tkTip.classList.remove('hidden');
        tkTip.innerHTML = (lang === 'en'
          ? `<b style="color:#ef6c00">Market track</b>: ${tk === 'mass' ? 'Mass (high-burst, instant payoff)' : 'Premium (high-floor, delayed payoff, character arc)'}`
          : `<b style="color:#ef6c00">市场赛道</b>：${tk === 'mass' ? '下沉剧（高爆发·即时兑付·钩子密度优先）' : '精品剧（高保底·延迟兑付·人物弧光优先）'}`);
      } else tkTip.classList.add('hidden');
    }
    // v2.99 标题传播力校验（前13字=身份+冲突+反差）
    const tpTip = $('titlePitchTip');
    if (tpTip) {
      const tp = done.titlePitch;
      if (tp && tp.first13) {
        tpTip.classList.remove('hidden');
        const score = tp.score || 0;
        const color = score >= 100 ? '#2e7d32' : score >= 66 ? '#e0a030' : '#c62828';
        tpTip.innerHTML = (lang === 'en'
          ? `<b style="color:${color}">Title pitch ${score}/100</b> · first 13 chars: "${tp.first13}" · identity ${tp.hasIdentity ? '✓' : '✗'} conflict ${tp.hasConflict ? '✓' : '✗'} contrast ${tp.hasContrast ? '✓' : '✗'}`
          : `<b style="color:${color}">标题传播力 ${score}/100</b> · 前13字「${tp.first13}」· 身份${tp.hasIdentity ? '✓' : '✗'} 冲突${tp.hasConflict ? '✓' : '✗'} 反差${tp.hasContrast ? '✓' : '✗'}`);
        tpTip.title = (tp.advice || []).join('\n');
      } else tpTip.classList.add('hidden');
    }
    // v2.100 每集三问诊断：主角想要什么/谁在阻拦/为什么追下一集
    const tqTip = $('epThreeQTip');
    if (tqTip) {
      const tq = done.epThreeQ;
      if (tq) {
        tqTip.classList.remove('hidden');
        const allOk = tq.want && tq.block && tq.whyNext;
        const color = allOk ? '#2e7d32' : '#c62828';
        tqTip.innerHTML = (lang === 'en'
          ? `<b style="color:${color}">Episode 3-Q</b> · Want ${tq.want ? '✓' : '✗'} Block ${tq.block ? '✓' : '✗'} Why-Next ${tq.whyNext ? '✓' : '✗'}${allOk ? ' — all present' : ' — missing element(s)'}`
          : `<b style="color:${color}">每集三问</b> · 想要${tq.want ? '✓' : '✗'} 阻拦${tq.block ? '✓' : '✗'} 追更${tq.whyNext ? '✓' : '✗'}${allOk ? '——三要素齐全' : '——缺项需补'}`);
      } else tqTip.classList.add('hidden');
    }
    // v2.101 开场四要素诊断：麻烦/施压者/反击意图/必看理由
    const ocTip = $('openingCheckTip');
    if (ocTip) {
      const oc = done.openingCheck;
      if (oc) {
        ocTip.classList.remove('hidden');
        const allOk = oc.trouble && oc.oppressor && oc.counterPlan && oc.mustWatch;
        const color = allOk ? '#2e7d32' : '#c62828';
        ocTip.innerHTML = (lang === 'en'
          ? `<b style="color:${color}">Opening 4-check</b> · Trouble ${oc.trouble ? '✓' : '✗'} Oppressor ${oc.oppressor ? '✓' : '✗'} Counter-plan ${oc.counterPlan ? '✓' : '✗'} Must-watch ${oc.mustWatch ? '✓' : '✗'} (${oc.score}/100)`
          : `<b style="color:${color}">开场四要素</b> · 麻烦${oc.trouble ? '✓' : '✗'} 施压者${oc.oppressor ? '✓' : '✗'} 反击${oc.counterPlan ? '✓' : '✗'} 必看${oc.mustWatch ? '✓' : '✗'}（${oc.score}/100）`);
        if (oc.missing && oc.missing.length) ocTip.title = oc.missing.join('\n');
      } else ocTip.classList.add('hidden');
    }
    // v2.101 六维统一评分卡
    const scTip = $('scorecardTip');
    if (scTip) {
      const sc = done.scorecard;
      if (sc) {
        scTip.classList.remove('hidden');
        const color = sc.total >= 85 ? '#2e7d32' : sc.total >= 70 ? '#1565c0' : sc.total >= 60 ? '#e0a030' : '#c62828';
        const dims = (sc.dimensions || []).map((d) => `${d.label}${d.score}`).join(' / ');
        scTip.innerHTML = (lang === 'en'
          ? `<b style="color:${color}">Quality scorecard ${sc.total}/100 (${sc.level})</b> · ${dims} · Weakest: ${sc.weakest.label}(${sc.weakest.score})`
          : `<b style="color:${color}">质量评分卡 ${sc.total}/100（${sc.level}）</b> · ${dims} · 最短板：${sc.weakest.label}(${sc.weakest.score})`);
        const actions = (sc.priorityActions || []).map((a) => `${a.label}(${a.score}): ${a.advice}`).join('\n');
        if (actions) scTip.title = actions;
      } else scTip.classList.add('hidden');
    }
    // v2.102 流派痛点代偿匹配
    const gnTip = $('genresTip');
    if (gnTip) {
      const gs = done.genres;
      if (gs && gs.length) {
        gnTip.classList.remove('hidden');
        gnTip.innerHTML = (lang === 'en'
          ? `<b style="color:#2e6512">Genre match</b>: ${gs.join(', ')}`
          : `<b style="color:#2e6512">流派匹配</b>：${gs.join('、')}`);
      } else gnTip.classList.add('hidden');
    }
    // v2.102 资方视角评估
    const ivTip = $('investorTip');
    if (ivTip) {
      const iv = done.investor;
      if (iv) {
        ivTip.classList.remove('hidden');
        const color = iv.verdict === 'STRONG' ? '#2e7d32' : iv.verdict === 'TALK' ? '#1565c0' : iv.verdict === 'CAUTION' ? '#e0a030' : '#c62828';
        ivTip.innerHTML = (lang === 'en'
          ? `<b style="color:${color}">Investor lens ${iv.overall}/100 (${iv.verdictLabel})</b>${iv.vetoes && iv.vetoes.length ? ' · Veto: ' + iv.vetoes.join('; ') : ''}`
          : `<b style="color:${color}">资方视角 ${iv.overall}/100（${iv.verdictLabel}）</b>${iv.vetoes && iv.vetoes.length ? ' · 否决：' + iv.vetoes.join('；') : ''}`);
        if (iv.pitchTips && iv.pitchTips.length) ivTip.title = iv.pitchTips.join('\n');
      } else ivTip.classList.add('hidden');
    }
    // v2.103 AIGC 微节拍计划展示
    const abTip = $('aigcBeatTip');
    if (abTip) {
      const bp = done.aigcBeatPlan;
      if (bp && bp.beats && bp.beats.length) {
        abTip.classList.remove('hidden');
        const beatsList = bp.beats.map((b) => `第${b.no}拍(${b.startSec}-${b.endSec}s${b.isTail ? '·尾' : ''})`).join(' | ');
        abTip.innerHTML = `<b style="color:#4527a0">AIGC微节拍</b> · 约${bp.totalSeconds}秒 / ${bp.beatCount}个30秒单元 · ${beatsList}`;
        abTip.title = bp.beats.map((b) => `第${b.no}拍：${b.arcPrompt}\n制作提示：${b.productionHints.join('；')}`).join('\n\n');
      } else abTip.classList.add('hidden');
    }
    // v2.108 伏笔账本展示
    const fsTip = $('foreshadowTip');
    if (fsTip) {
      const fs = done.foreshadow;
      if (fs) {
        fsTip.classList.remove('hidden');
        const sc = fs.score;
        const scColor = sc >= 70 ? '#2e7d32' : sc >= 40 ? '#f57f17' : '#c62828';
        const danglingList = (fs.dangling || []).map((d) => `${d.signal}(第${d.plantedInEp}集种)`);
        fsTip.innerHTML = `<b style="color:#5d4037">伏笔账本</b> · <span style="color:${scColor}">健康度 ${sc}</span> · 植入 ${fs.plants} / 回收 ${fs.payoffs}${danglingList.length ? ' · <span style="color:#c62828">悬空: ' + danglingList.join('、') + '</span>' : ''}`;
        fsTip.title = (fs.issues || []).map((i) => `[${i.severity}] ${i.advice}`).join('\n') || '伏笔状态良好';
      } else fsTip.classList.add('hidden');
    }
    // v2.108 角色弧光追踪展示
    const atTip = $('arcTrackTip');
    if (atTip) {
      const at = done.arcTrack;
      if (at) {
        atTip.classList.remove('hidden');
        const sc = at.score;
        const scColor = sc >= 70 ? '#2e7d32' : sc >= 40 ? '#f57f17' : '#c62828';
        const chars = (at.characters || []).map((c) => `${c.name}:${c.emotion}/${c.stage}${c.changed ? '' : '·停'}`);
        atTip.innerHTML = `<b style="color:#00695c">角色弧光</b> · <span style="color:${scColor}">完整度 ${sc}</span> · ${chars.join(' | ')}`;
        const tips = [];
        if (at.stalled && at.stalled.length) tips.push(...at.stalled.map((s) => `[停滞] ${s.name}: ${s.reason}`));
        if (at.jumpCut && at.jumpCut.length) tips.push(...at.jumpCut.map((j) => `[跳变] ${j.name}: ${j.from}→${j.to} ${j.reason}`));
        if (at.issues) tips.push(...at.issues.map((i) => `[${i.severity}] ${i.advice}`));
        atTip.title = tips.join('\n') || '角色弧光正常';
      } else atTip.classList.add('hidden');
    }
    // v2.97 爆款逆向·源文本结构化拆解：钩子类型/人设反差/爽点密度/张力曲线/为什么爆/可取技法
    const htTip = $('hitTeardownTip');
    if (htTip) {
      const ht = done.hitTeardown;
      if (ht) {
        htTip.classList.remove('hidden');
        const reasons = (ht.boomReasons || []).map((b) => `${b.dim}：${b.conclusion}`).join('；');
        const tech = (ht.techniques || []).map((t) => `${t.point}（${t.reuse}）`).join('；');
        htTip.innerHTML = (lang === 'en'
          ? `<b style="color:#6a1b9a">Hit reverse-engineering</b> · hook ${ht.hookType} · persona contrast ${ht.personaContrast} · payoff density ${Number(ht.coolDensity).toFixed(2)}/100 chars`
          : `<b style="color:#6a1b9a">爆款逆向拆解</b> · 钩子「${ht.hookType}」· 人设反差 ${ht.personaContrast} · 爽点密度 ${Number(ht.coolDensity).toFixed(2)}/百字`);
        htTip.title = `${lang === 'en' ? 'Why it works' : '为什么爆'}：${reasons}\n${lang === 'en' ? 'Reusable techniques' : '可取技法'}：${tech}\n${lang === 'en' ? 'Tension curve' : '张力曲线'}：${JSON.stringify(ht.tensionCurve)}`;
      } else htTip.classList.add('hidden');
    }
    renderAigcDash(done);
    refreshResultScripts(projectId);
    if (done.opportunity) xnSay(lang === 'en' ? 'Done. Check the opportunity radar.' : '完成啦，记得看机会雷达评估～');
    // 全本质量诊断（craft/emotion/webnovel/去AI 四套尺子归一的六维报告）
    loadDiagnosis(projectId).catch(() => {});
    loadEmotionWave(projectId).catch(() => {});
    // 资方视角投稿前体检（免费本地评估，让用户知道本子值不值钱、怎么才好卖）
    loadInvestorLens(projectId).catch(() => {});
  }

  function latestScriptsByEpisode(scripts) {
    const latest = new Map();
    for (const script of scripts) {
      const previous = latest.get(script.epNo);
      if (!previous || (script.version || 1) > (previous.version || 1)) latest.set(script.epNo, script);
    }
    return [...latest.values()].sort((a, b) => a.epNo - b.epNo);
  }
  // 正文、复制、TXT 与听剧本只使用每集最新版；历史版本仍在作品详情中保留。
  async function refreshResultScripts(projectId) {
    const account = capturePrivateSession();
    try {
      const r = await Api.request(`/api/generate/projects/${projectId}/scripts`);
      const eps = latestScriptsByEpisode(await Api.jsonOrThrow(r));
      if (!isPrivateSessionCurrent(account) || (currentProjectId && currentProjectId !== projectId)) return;
      currentScripts = eps;
      const txt = eps.map((s) => `第${s.epNo}集 ${s.title || ''}\n${s.content || ''}`).join('\n\n');
      $('scriptText').textContent = txt || (lang === 'en' ? 'No text in sandbox mode.' : '沙盘模式暂无正文，配置模型密钥后产出。');
      // c219 AIGC 构成仪表盘刷新复现：从最新集 qcReport._aigc 读取并渲染（此前仅 SSE done 时有，刷新即失明）
      const latest = eps.reduce((m, s) => (!m || s.epNo > m.epNo ? s : m), null);
      const aigc = latest && latest.qcReport && latest.qcReport._aigc;
      if (aigc && aigc.manifest) {
        renderAigcDash({ aigcManifest: aigc.manifest, aigcVolumePlan: aigc.volumePlan, aigcCurve: aigc.curve, format: aigc.format });
      } else {
        const box = $('aigcDash'); if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
      }
      refreshListenBtn();
    } catch { if (isPrivateSessionCurrent(account) && (!currentProjectId || currentProjectId === projectId)) $('scriptText').textContent = ''; }
  }
  // v2.55 听剧本：缓存当前项目分集与小南能力矩阵
  let currentScripts = [];
  let capsCache = null;
  async function loadCaps() {
    if (!Api.isAuthed()) { capsCache = null; refreshListenBtn(); return; }
    const account = capturePrivateSession();
    try {
      const r = await Api.request('/api/generate/assistant/capabilities');
      const data = await Api.jsonOrThrow(r);
      if (!isPrivateSessionCurrent(account)) return;
      capsCache = data;
    } catch { if (!isPrivateSessionCurrent(account)) return; capsCache = null; }
    refreshListenBtn();
  }
  function listenAllowed() {
    if (!capsCache || !Array.isArray(capsCache.capabilities)) return null; // 未知（未登录/未拉到）
    const c = capsCache.capabilities.find((x) => x.action === 'listen_script');
    return c ? c.allowed : null;
  }
  function refreshListenBtn() {
    const btn = $('listenBtn'); if (!btn) return;
    const allowed = listenAllowed();
    const hasScript = currentScripts.length > 0;
    btn.disabled = !hasScript;
    if (allowed === false) { btn.innerHTML = '🔒 🎧 ' + (lang === 'en' ? 'Listen (Advanced+)' : '听剧本（高级起）'); btn.classList.add('tier-lock'); }
    else { btn.textContent = '🎧 ' + (lang === 'en' ? 'Listen' : '听剧本'); btn.classList.remove('tier-lock'); }
  }
  // c208：403 统一降级（关弹窗→提示→900ms 后跳会员页）；连播片单与单集共用
  async function listenHandleGate(r, modal) {
    const j = await r.json().catch(() => ({}));
    modal.classList.add('hidden');
    const up = j.upsell || {};
    xnSay(lang === 'en' ? (up.en || 'Advanced membership required.') : (up.zh || '听剧本是高级会员及以上权益，升级后即可使用～'));
    setTimeout(() => switchView('vip'), 900);
  }
  async function openListen(scriptId) {
    const modal = $('listenModal'); openModal('listenModal');
    if (typeof listenFinish === 'function') listenFinish(); // 换集/重开先静音，403 或加载失败也不会残留旧朗读
    const token = listenBumpReqSeq(); // c208：单集入口清上一部剧片单上下文并作废在途连播请求
    const segBox = $('listenSegments');
    segBox.innerHTML = `<div class="diag-loading">${lang === 'en' ? 'Building narration script…' : '正在生成分段朗读稿…'}</div>`;
    $('listenMeta').textContent = ''; $('listenNote').textContent = ''; $('listenTtsTip').classList.add('hidden');
    $('listenSeriesBar').classList.add('hidden'); $('listenResumeBar').classList.add('hidden');
    try {
      const r = await Api.request(`/api/generate/scripts/${scriptId}/listen?lang=${strategyLocale() === 'en' ? 'en' : 'zh'}`);
      if (token !== listenReqSeq) return; // 期间又打开了别的听剧本弹窗，旧响应作废
      if (r.status === 403) { await listenHandleGate(r, modal); return; }
      const d = await Api.jsonOrThrow(r);
      if (token !== listenReqSeq) return;
      renderListen(d, {});
      if (d.projectId && d.neighbors && d.neighbors.epCount > 1) listenHydratePlaylist(d.projectId); // 懒拉片单选集，失败静默
    } catch (e) {
      segBox.innerHTML = znErrorHtml(e.message || (lang === 'en' ? 'Failed to load.' : '加载失败'));
    }
  }
  // c208 整剧连播入口：先拿轻量片单 → 定位续听集（有进度进进度，无则第一集）→ 自动开播
  async function openListenSeries(projectId) {
    const modal = $('listenModal'); openModal('listenModal');
    if (typeof listenFinish === 'function') listenFinish();
    listenResetSeries(); listenSeries.auto = listenAutoPref();
    const token = listenBumpReqSeq();
    const segBox = $('listenSegments');
    znSkeleton(segBox);
    $('listenMeta').textContent = ''; $('listenNote').textContent = ''; $('listenTtsTip').classList.add('hidden');
    $('listenSeriesBar').classList.add('hidden'); $('listenResumeBar').classList.add('hidden');
    try {
      const pr = await Api.request(`/api/generate/projects/${projectId}/listen/playlist?lang=${strategyLocale() === 'en' ? 'en' : 'zh'}`);
      if (pr.status === 403) { await listenHandleGate(pr, modal); return; }
      const pl = await Api.jsonOrThrow(pr);
      if (token !== listenReqSeq) return; // 用户已切到别的弹窗/剧集
      listenSeries.list = Array.isArray(pl.episodes) ? pl.episodes : [];
      if (!listenSeries.list.length) { znEmpty(segBox, lang === 'en' ? 'No playable episodes yet.' : '暂无可朗读的分集。'); return; }
      // 续听定位：片单中最近一次保存过进度的集。
      // c209 修复：改版/重新生成会让最新版换 scriptId，旧进度 id 已不在片单里——直接加载必 404，
      // 连播入口整个废掉。id 失效时回退第一集；id 仍有效但段数对不上由 renderListen 内部回退从头。
      let target = listenSeries.list[0].scriptId; let startIdx = 0;
      const saved = listenLatestPos(listenSeries.list.map((e) => e.scriptId));
      if (saved && listenSeries.list.some((e) => e.scriptId === saved.scriptId)) { target = saved.scriptId; startIdx = saved.idx; }
      await listenLoadEpisode(target, { autostart: true, startAt: 'idx', startIdx, crossNext: false });
    } catch (e) {
      if (token === listenReqSeq) segBox.innerHTML = znErrorHtml(e.message || (lang === 'en' ? 'Failed to load.' : '加载失败'));
    }
  }
  // c206 修复：时长原来写死中文"分/秒"，英文界面也显示中文；按当前界面语言出格式
  function fmtDur(sec) {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    if (lang === 'en') return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
    return m ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
  }

  /* ---------- c206 多角色有声播放器（浏览器原生 speechSynthesis，零模型零扣费） ----------
     状态机铁律：
     1) 全局只有一个朗读实例，每次 speak 前 cancel 旧 utterance；seq 令牌作废旧回调，防止 onend/onerror 串段；
     2) onend 自然推进 idx+1；关闭弹窗/重新打开/切语言重渲染必须先 cancel，杜绝"人走了还在念"；
     3) 不支持 speechSynthesis 的浏览器：整条控制条隐藏，仅保留复制朗读稿，能力增强不阻断核心。
     c207 加固（Chrome 系两个著名顽疾的真机经验，mock 环境测不出来）：
     4) cancel() 后同步 speak() 在 Chrome 可能被整段吞掉（不发声也无回调→播放器卡死），统一延迟一拍再发声，
        延迟回调带 seq 校验，换段/停止/关窗立刻作废；
     5) 长 utterance 与后台标签页约 15s 会被 Chrome 静默 pause 且不触发 onend（听一半没声），播放期 8s 保活 resume，
        用户主动暂停（paused=true）时绝不能保活，否则暂停形同虚设；连续保活无效则重播当前段自救。 */
  const LISTEN_SPEAK_DELAY = 80;   // ms：cancel→speak 间隔，绕开 Chrome 吞句竞态
  const LISTEN_KEEPALIVE_MS = 8000; // 长文本/后台标签静默暂停的保活节拍（<15s 阈值）
  const listenTts = {
    supported: typeof window !== 'undefined' && 'speechSynthesis' in window
      && typeof window.SpeechSynthesisUtterance !== 'undefined',
    data: null, idx: -1, playing: false, paused: false, rateMul: 1, seq: 0,
    pending: 0, keepAlive: 0, stuck: 0, loading: false,
  };
  /* ---------- c208 整剧连播 + 续听记忆 ----------
     list：后端片单（每集最新版且可朗读）；auto：自然播完最后一段是否自动跨集（手动 ⏭/集按钮不受它限制）；
     reqSeq：弹窗/换集请求令牌，迟到的片单或朗读稿响应必须作废，防止 A 集数据盖掉 B 集。
     续听位置存 localStorage（仅 scriptId/段索引/段总数/时间戳，无正文内容），按段节流（段切换才写），
     容量 120 条 LRU；本集听完或主动跨集即清除，不做云端同步。 */
  const LISTEN_POS_KEY = 'zn_listen_pos_v1';
  const LISTEN_AUTO_KEY = 'zn_listen_autoplay_v1';
  const listenSeries = { list: [], auto: true };
  let listenReqSeq = 0;
  function listenBumpReqSeq() { return ++listenReqSeq; }
  function listenResetSeries() { listenSeries.list = []; listenSeries.auto = listenAutoPref(); }
  function listenAutoPref() { try { return localStorage.getItem(LISTEN_AUTO_KEY) !== '0'; } catch { return true; } }
  function listenSaveAutoPref() { try { localStorage.setItem(LISTEN_AUTO_KEY, listenSeries.auto ? '1' : '0'); } catch { /* 隐私模式忽略 */ } }
  function listenReadPosMap() {
    try { const o = JSON.parse(localStorage.getItem(LISTEN_POS_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch { return {}; }
  }
  function listenWritePosMap(m) { try { localStorage.setItem(LISTEN_POS_KEY, JSON.stringify(m)); } catch { /* ignore */ } }
  function listenSavePos(scriptId, idx, total) {
    if (!scriptId || idx < 0 || total <= 0) return;
    const m = listenReadPosMap();
    m[scriptId] = { idx, total, ts: Date.now() };
    const keys = Object.keys(m);
    if (keys.length > 120) {
      keys.sort((a, b) => (m[a].ts || 0) - (m[b].ts || 0));
      keys.slice(0, keys.length - 120).forEach((k) => { delete m[k]; });
    }
    listenWritePosMap(m);
  }
  function listenGetPos(scriptId) { const p = listenReadPosMap()[scriptId]; return p || null; }
  function listenClearPos(scriptId) {
    if (!scriptId) return;
    const m = listenReadPosMap();
    if (m[scriptId]) { delete m[scriptId]; listenWritePosMap(m); }
  }
  function listenLatestPos(ids) {
    const m = listenReadPosMap(); let best = null;
    for (const id of ids) {
      const p = m[id];
      if (p && typeof p.idx === 'number' && (!best || (p.ts || 0) > best.ts)) best = { scriptId: id, idx: p.idx, total: p.total, ts: p.ts || 0 };
    }
    return best;
  }
  // 跨集加载器：掐旧声 → 拉单集朗读稿 → 按 opts 开播。任何换集路径（自动连播/⏭/集按钮/下拉/片单入口）只走这一个口
  async function listenLoadEpisode(scriptId, opts = {}) {
    const token = listenBumpReqSeq();
    listenFinish();
    listenTts.loading = true; // 加载途中段控制（播放/上下段）一律忽略，防止操作在旧集数据上开口
    // 记录加载开始时的朗读序号：加载途中用户点停止/关窗/又换集会让 listenTts.seq 自增，
    // 迟到的一集即便渲染也不得自动开口（否则会出现"弹窗关了还在念"）
    const ttsSeqAtStart = listenTts.seq;
    const segBox = $('listenSegments');
    znSkeleton(segBox);
    $('listenResumeBar').classList.add('hidden');
    try {
      const r = await Api.request(`/api/generate/scripts/${scriptId}/listen?lang=${strategyLocale() === 'en' ? 'en' : 'zh'}`);
      if (token !== listenReqSeq) return;
      if (r.status === 403) { listenTts.loading = false; await listenHandleGate(r, $('listenModal')); return; }
      const d = await Api.jsonOrThrow(r);
      if (token !== listenReqSeq) return;
      const stillWanted = ttsSeqAtStart === listenTts.seq;
      renderListen(d, { autostart: !!opts.autostart && stillWanted, startAt: opts.startAt || 'first', startIdx: opts.startIdx, crossNext: opts.crossNext });
    } catch (e) {
      if (token === listenReqSeq) { listenTts.loading = false; segBox.innerHTML = znErrorHtml(e.message || (lang === 'en' ? 'Failed to load.' : '加载失败')); }
    }
  }
  // 单集打开后懒拉片单，只用于补选集下拉；拉不到时上一集/下一集按钮仍有 neighbors 可用
  async function listenHydratePlaylist(projectId) {
    const token = listenReqSeq;
    try {
      const r = await Api.request(`/api/generate/projects/${projectId}/listen/playlist?lang=${strategyLocale() === 'en' ? 'en' : 'zh'}`);
      if (!r.ok || token !== listenReqSeq) return;
      const pl = await r.json().catch(() => null);
      if (!pl || token !== listenReqSeq || !listenTts.data || listenTts.data.projectId !== projectId) return;
      listenSeries.list = Array.isArray(pl.episodes) ? pl.episodes : [];
      if (listenSeries.list.length > 1) listenRenderSeries(listenTts.data);
    } catch { /* 片单是增强，不是主交易 */ }
  }
  function listenEpLabel(epNo, title) {
    return lang === 'en' ? `Ep ${epNo}${title ? ' · ' + title : ''}` : `第${epNo}集 ${title || ''}`;
  }
  function listenRenderSeries(d) {
    const bar = $('listenSeriesBar'); if (!bar) return;
    const sel = $('listenEpSelect');
    const list = listenSeries.list;
    const inList = Array.isArray(list) && list.length > 1 && list.some((e) => e.scriptId === d.scriptId);
    bar.classList.remove('hidden');
    if (inList) {
      sel.disabled = false;
      sel.innerHTML = list.map((e) => `<option value="${e.scriptId}"${e.scriptId === d.scriptId ? ' selected' : ''}>${escapeHtml(listenEpLabel(e.epNo, e.title))}</option>`).join('');
    } else {
      // 片单未到时先给当前集占位项，只靠 neighbors 驱动前后按钮
      sel.disabled = true;
      sel.innerHTML = `<option value="">${escapeHtml(listenEpLabel(d.epNo, d.title))}</option>`;
    }
    $('listenEpPrev').disabled = !(d.neighbors && d.neighbors.prevScriptId);
    $('listenEpNext').disabled = !(d.neighbors && d.neighbors.nextScriptId);
    $('listenAuto').checked = !!listenSeries.auto;
  }
  function listenShowResumeBar(idx, total) {
    const bar = $('listenResumeBar');
    if (!bar || !listenTts.supported) return; // 无 TTS 时没有"继续播放"语义
    bar.classList.remove('hidden');
    bar.innerHTML = `<span>${lang === 'en' ? `Last time you stopped at segment ${idx + 1}/${total}` : `上次听到第 ${idx + 1} / ${total} 段`}</span>`
      + `<button class="btn-primary" id="listenResumeBtn" type="button">${t('listenResume')}</button>`
      + `<button class="btn-ghost" id="listenRestartBtn" type="button">${t('listenRestart')}</button>`;
    $('listenResumeBtn').onclick = () => { bar.classList.add('hidden'); speakListenIdx(idx); };
    $('listenRestartBtn').onclick = () => { bar.classList.add('hidden'); listenClearPos(listenTts.data.scriptId); speakListenIdx(0); };
  }
  function listenSs() { return listenTts.supported ? window.speechSynthesis : null; }
  // c209：iOS Safari/WKWebView 规定 speechSynthesis.speak 必须挂在用户手势调用栈里。
  // 连播/跨集/片单入口的自动开口都发生在网络请求返回之后（脱离点击手势），iOS 会静默拒声且不报错，
  // 用户看到"在播"却没声音。这类路径统一改为"下一集就绪→轻点播放"，按钮点击即真实手势，必能开口。
  function listenIsIos() {
    try {
      return /ipad|iphone|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1); // iPadOS 13+ 伪装成 Mac
    } catch { return false; }
  }
  // iOS 自动开播兜底条：文案区分"续播本集/下一集已就绪"，点击即从 startIdx 开口
  function listenShowTapToPlay(startIdx, nextEp) {
    const bar = $('listenResumeBar');
    if (!bar || !listenTts.supported) return;
    bar.classList.remove('hidden');
    const msg = nextEp
      ? (lang === 'en' ? `Next episode is ready. Tap to keep listening.` : `下一集已加载，轻点继续连播。`)
      : (lang === 'en' ? 'Ready. Tap play to start listening.' : '朗读稿已就绪，轻点开始播放。');
    bar.innerHTML = `<span>${msg}</span><button class="btn-primary" id="listenTapPlayBtn" type="button">${lang === 'en' ? '▶ Play' : '▶ 播放'}</button>`;
    $('listenTapPlayBtn').onclick = () => { bar.classList.add('hidden'); speakListenIdx(startIdx); };
  }
  function listenClamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function pickListenVoice(voiceLang) {
    const ss = listenSs(); if (!ss) return null;
    let voices = [];
    try { voices = ss.getVoices ? ss.getVoices() : []; } catch { voices = []; }
    if (!voices.length) return null;
    const prefix = String(voiceLang || 'zh').slice(0, 2).toLowerCase();
    return voices.find((v) => v.lang === voiceLang)
      || voices.find((v) => v.lang && v.lang.toLowerCase() === voiceLang.toLowerCase())
      || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix))
      || null;
  }
  function listenClearActive() {
    document.querySelectorAll('#listenSegments .listen-seg.listen-active')
      .forEach((el) => el.classList.remove('listen-active'));
  }
  function listenSyncUI() {
    const btn = $('listenPlay');
    if (btn) {
      if (!listenTts.playing) btn.textContent = lang === 'en' ? '▶ Play' : '▶ 播放';
      else if (listenTts.paused) btn.textContent = lang === 'en' ? '▶ Resume' : '▶ 继续';
      else btn.textContent = lang === 'en' ? '❚❚ Pause' : '❚❚ 暂停';
    }
    const prog = $('listenProgress');
    if (prog) {
      const total = listenTts.data ? listenTts.data.segments.length : 0;
      if (!listenTts.supported) prog.textContent = lang === 'en' ? 'System TTS unavailable' : '系统不支持朗读';
      else if (!total) prog.textContent = '';
      else if (listenTts.idx < 0) prog.textContent = lang === 'en' ? `0 / ${total}` : `0 / ${total} 段`;
      else prog.textContent = lang === 'en'
        ? `Segment ${listenTts.idx + 1} / ${total}${listenTts.paused ? ' (paused)' : ''}`
        : `第 ${listenTts.idx + 1} / ${total} 段${listenTts.paused ? '（已暂停）' : ''}`;
    }
  }
  function listenStopKeepAlive() {
    if (listenTts.keepAlive) { clearInterval(listenTts.keepAlive); listenTts.keepAlive = 0; }
    listenTts.stuck = 0;
  }
  function listenStartKeepAlive() {
    listenStopKeepAlive();
    if (!LISTEN_KEEPALIVE_MS) return;
    listenTts.keepAlive = setInterval(() => {
      const ss = listenSs();
      if (!ss || !listenTts.playing || listenTts.paused) return; // 用户主动暂停时不许保活
      try {
        if (ss.paused) {
          // 非用户暂停却处于 paused：Chrome 长文本/切后台的静默暂停。先 resume 自救，连续两拍无效则重播当前段
          listenTts.stuck += 1;
          ss.resume();
          if (listenTts.stuck >= 2 && listenTts.idx >= 0) speakListenIdx(listenTts.idx);
        } else {
          listenTts.stuck = 0;
        }
      } catch { /* 保活失败不抛错，下一拍再试 */ }
    }, LISTEN_KEEPALIVE_MS);
  }
  function listenFinish() {
    listenTts.seq++;
    clearTimeout(listenTts.pending); listenTts.pending = 0;
    listenStopKeepAlive();
    const ss = listenSs(); if (ss) { try { ss.cancel(); } catch { /* 无语音引擎时忽略 */ } }
    listenTts.playing = false; listenTts.paused = false; listenTts.idx = -1;
    listenClearActive(); listenSyncUI();
  }
  // how='natural'：onend 自然走到集尾，受自动连播开关约束；'manual'：手动 ⏭ 越过末段，总是尝试跨集
  function speakListenIdx(i, how = 'natural') {
    const ss = listenSs(); const d = listenTts.data;
    if (!ss || !d) return;
    const segs = Array.isArray(d.segments) ? d.segments : [];
    if (i < 0 || i >= segs.length) {
      const nextId = d.neighbors && d.neighbors.nextScriptId;
      if (nextId && (how === 'manual' || listenSeries.auto)) {
        // c208 自动连播/手动越末段：本集进度作废，下一集从段 0 自动开播（加载器内部统一 cancel 旧声）
        listenClearPos(d.scriptId);
        listenLoadEpisode(nextId, { autostart: true, startAt: 'first', loadingText: t('listenLoadingNext') });
        return;
      }
      listenClearPos(d.scriptId); // 真正听完本集（关了连播或已是末集）：清续听点后收尾
      listenFinish();
      return;
    }
    const mySeq = ++listenTts.seq; // 作废前一段的所有回调与在途延迟
    clearTimeout(listenTts.pending); listenTts.pending = 0;
    try { ss.cancel(); } catch { /* ignore */ }
    listenTts.idx = i; listenTts.playing = true; listenTts.paused = false;
    listenSavePos(d.scriptId, i, segs.length); // c208：每段开声即落续听点（停止/关窗/崩溃回来都能接）
    // c207 乐观高亮：部分 Safari onstart 不触发/延迟，调度发声时即刻标记当前段，滚动仍等真正 onstart
    listenMarkActive(i, false);
    listenSyncUI();
    // c207：cancel 后同步 speak 在 Chrome 可能被吞；延迟一拍发声，期间换段/停止/关窗使 seq 变化即作废
    listenTts.pending = setTimeout(() => {
      listenTts.pending = 0;
      if (mySeq !== listenTts.seq) return;
      const seg = segs[i];
      const cast = d.cast || { characters: {}, narrator: { pitch: 1, rate: 1 }, voiceLang: 'zh-CN' };
      const profile = seg.kind === 'dialogue' ? (cast.characters[seg.speaker] || cast.narrator) : cast.narrator;
      const u = new window.SpeechSynthesisUtterance(seg.text || ' ');
      u.pitch = listenClamp(profile.pitch || 1, 0.5, 1.5);
      u.rate = listenClamp((profile.rate || 1) * listenTts.rateMul, 0.6, 1.6);
      u.lang = cast.voiceLang || 'zh-CN';
      // 个别浏览器给 utterance.voice 赋非本机原生 SpeechSynthesisVoice 会同步抛 TypeError；
      // 选不到原生语音就退回只设 lang，绝不能因为选声失败让整条播放链崩掉
      const v = pickListenVoice(u.lang);
      if (v) { try { u.voice = v; } catch { /* 退回 lang 选声 */ } }
      u.onstart = () => {
        if (mySeq !== listenTts.seq) return;
        listenTts.stuck = 0;
        listenMarkActive(i, true); // 真正开声：保证高亮在，并跨段滚到视口（不打断手动翻看）
      };
      u.onend = () => { if (mySeq !== listenTts.seq) return; if (listenTts.playing && !listenTts.paused) speakListenIdx(i + 1); };
      // cancel 换段产生的 interrupted/canceled 已被 seq 令牌挡掉；走到这里的是真异常，结束播放避免按钮卡死
      u.onerror = () => { if (mySeq !== listenTts.seq) return; listenFinish(); };
      try { ss.speak(u); listenStartKeepAlive(); } catch { listenFinish(); }
    }, LISTEN_SPEAK_DELAY);
  }
  // c207：高亮标记单列；scroll=true 时才滚动（onstart），调度阶段只点亮
  function listenMarkActive(i, scroll) {
    listenClearActive();
    const el = document.querySelectorAll('#listenSegments .listen-seg')[i];
    if (!el) return;
    el.classList.add('listen-active');
    if (scroll) { try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* 老浏览器忽略 */ } }
    listenSyncUI();
  }
  // c207：上一段/下一段跳转。c208：首段再点上一段→跨进上一集末段；越过末段→跨进下一集首段
  // （手动跨集不受自动连播开关限制）；未开播时点上一段=从 0 开始
  function listenJump(delta) {
    if (!listenTts.data || !listenTts.supported || listenTts.loading) return;
    const d = listenTts.data;
    const total = (Array.isArray(d.segments) ? d.segments.length : 0);
    if (!total) return;
    if (listenTts.idx < 0) { speakListenIdx(0); return; }
    const i = listenTts.idx + delta;
    if (i >= total) {
      const nextId = d.neighbors && d.neighbors.nextScriptId;
      if (nextId) { listenClearPos(d.scriptId); listenLoadEpisode(nextId, { autostart: true, startAt: 'first' }); }
      else listenFinish();
      return;
    }
    if (i < 0) {
      const prevId = d.neighbors && d.neighbors.prevScriptId;
      if (prevId) { listenClearPos(d.scriptId); listenLoadEpisode(prevId, { autostart: true, startAt: 'last' }); }
      else speakListenIdx(0);
      return;
    }
    speakListenIdx(i);
  }
  function listenTogglePlay() {
    if (!listenTts.data || !listenTts.supported || listenTts.loading) return;
    const ss = listenSs();
    if (!listenTts.playing) { speakListenIdx(listenTts.idx < 0 ? 0 : listenTts.idx); return; }
    try {
      if (listenTts.paused) { ss.resume(); listenTts.paused = false; }
      else { ss.pause(); listenTts.paused = true; }
    } catch { listenFinish(); return; }
    listenSyncUI();
  }
  function initListenPlayer() {
    if (initListenPlayer._done) return; initListenPlayer._done = true;
    $('listenPlay').onclick = listenTogglePlay;
    $('listenStop').onclick = listenFinish;
    $('listenPrev').onclick = () => listenJump(-1);
    $('listenNext').onclick = () => listenJump(1);
    // c208 集导航/连播开关
    $('listenAuto').onchange = (e) => { listenSeries.auto = !!e.target.checked; listenSaveAutoPref(); };
    $('listenEpPrev').onclick = () => {
      const d = listenTts.data; const id = d && d.neighbors && d.neighbors.prevScriptId;
      if (id) { listenClearPos(d.scriptId); listenLoadEpisode(id, { autostart: true, startAt: 'last' }); }
    };
    $('listenEpNext').onclick = () => {
      const d = listenTts.data; const id = d && d.neighbors && d.neighbors.nextScriptId;
      if (id) { listenClearPos(d.scriptId); listenLoadEpisode(id, { autostart: true, startAt: 'first' }); }
    };
    $('listenEpSelect').onchange = (e) => {
      const id = e.target.value;
      if (!id || id === (listenTts.data && listenTts.data.scriptId)) return;
      if (listenTts.data) listenClearPos(listenTts.data.scriptId);
      listenLoadEpisode(id, { autostart: true, startAt: 'first' });
    };
    $('listenRate').onchange = (e) => {
      listenTts.rateMul = listenClamp(parseFloat(e.target.value) || 1, 0.5, 2);
      // 语速在当前段立即生效：以当前段重播（暂停态下只存设置，不强行开口）
      if (listenTts.playing && !listenTts.paused && listenTts.idx >= 0) speakListenIdx(listenTts.idx);
    };
    // v2.220 关闭收口：X/关闭按钮/遮罩/Esc 统一走 closeModalEl，清理经钩子触发（listenFinish 只停播清态，不负责 hidden）
    setModalCloseHook('listenModal', listenFinish);
    window.addEventListener('beforeunload', listenFinish);
  }
  // opts.autostart：连播/选集/片单入口自动开口；startAt: first|last|idx（配 startIdx）
  function renderListen(d, opts = {}) {
    initListenPlayer();
    // 重新渲染（切换集/语言）必须先掐断旧播放，防止旧稿声音继续念
    if (listenTts.playing || listenTts.idx >= 0) listenFinish();
    // c207：后端字段缺失/脏数据归一，任何一个字段异常都不许让整个弹窗渲染崩掉
    d.segments = Array.isArray(d.segments) ? d.segments : [];
    d.speakerSet = Array.isArray(d.speakerSet) ? d.speakerSet : [];
    d.dialogueCount = Number(d.dialogueCount) || 0;
    d.estSeconds = Number(d.estSeconds) || 0;
    d.note = d.note || {}; d.note.lines = Array.isArray(d.note.lines) ? d.note.lines : [];
    // c208：老后端/邻接查询熔断时 neighbors 可能缺失，退化为纯单集播放器
    d.neighbors = d.neighbors || { prevScriptId: null, nextScriptId: null, epPos: 1, epCount: 1 };
    listenTts.loading = false; // 新稿已落地，段控制恢复（loader 在请求期间加的锁）
    $('listenResumeBar').classList.add('hidden'); $('listenResumeBar').innerHTML = '';
    listenTts.data = d; listenTts.idx = -1;
    $('listenTitle').textContent = lang === 'en'
      ? `🎧 Ep.${d.epNo} ${d.title || ''}`.trim()
      : `🎧 第${d.epNo}集 ${d.title || ''}`.trim();
    $('listenMeta').textContent = lang === 'en'
      ? `${d.segments.length} segments · ${d.dialogueCount} lines · roles: ${d.speakerSet.join('/') || '-'} · est. ${fmtDur(d.estSeconds)}`
      : `共${d.segments.length}个朗读段 · 台词${d.dialogueCount}句 · 角色：${d.speakerSet.join('、') || '旁白'} · 估算时长 ${fmtDur(d.estSeconds)}`;
    $('listenNote').textContent = (d.note.title ? d.note.title + '：' : '') + d.note.lines.join(' ');
    const tts = $('listenTtsTip');
    const bar = $('listenPlayer');
    if (!listenTts.supported) {
      // 优雅降级：不支持语音合成时隐藏控制条，给出说明，复制稿仍是完整兜底
      bar.classList.add('hidden');
      tts.classList.remove('hidden');
      tts.textContent = lang === 'en'
        ? 'Voice playback is not supported in this browser; the reading script below is ready to copy and use with any TTS app.'
        : '当前浏览器不支持网页语音朗读，可复制下面的朗读稿，用任意朗读/听书应用打开。';
    } else {
      bar.classList.remove('hidden');
      // 云端真人 TTS 未配置的旧提示不再展示：浏览器内置合成已可即时分角色朗读
      tts.classList.add('hidden');
    }
    const kindLabel = { scene: lang === 'en' ? 'Scene' : '场标', action: lang === 'en' ? 'Narration' : '旁白', dialogue: lang === 'en' ? 'Line' : '台词' };
    $('listenSegments').innerHTML = d.segments.map((s) =>
      `<div class="listen-seg listen-${s.kind}" title="${lang === 'en' ? 'Click to play from this segment' : '点击从这一段开始朗读'}"><span class="listen-tag">${kindLabel[s.kind] || s.kind}${s.kind === 'dialogue' ? ' · ' + escapeHtml(s.speaker || '') : ''}${s.cue ? '（' + escapeHtml(s.cue) + '）' : ''}</span><p>${escapeHtml(s.text || '')}</p><span class="listen-sec">${(Number(s.estSeconds) || 0).toFixed(1)}s</span></div>`
    ).join('');
    const segEls = document.querySelectorAll('#listenSegments .listen-seg');
    segEls.forEach((el, i) => { el.addEventListener('click', () => { if (listenTts.supported) speakListenIdx(i); }); });
    $('listenCopy').onclick = () => copy(d.narration || '');
    // c208：多集才出集导航条；自动开播路径（连播/选集/片单续听）直接定位，不弹续听条
    if (d.neighbors.epCount > 1 || listenSeries.list.length > 1) listenRenderSeries(d);
    else $('listenSeriesBar').classList.add('hidden');
    const totalSeg = d.segments.length;
    let startIdx = -1;
    if (opts.autostart && listenTts.supported) {
      if (opts.startAt === 'last') startIdx = totalSeg - 1;
      else if (opts.startAt === 'idx' && Number.isInteger(opts.startIdx) && opts.startIdx >= 1 && opts.startIdx < totalSeg) startIdx = opts.startIdx;
      else startIdx = 0;
    } else if (!opts.autostart && listenTts.supported) {
      // 非自动入口：有有效续听点（段总数一致，防改版后错位）才给"继续收听/从头"
      const saved = listenGetPos(d.scriptId);
      if (saved && saved.total === totalSeg && saved.idx >= 1 && saved.idx < totalSeg) listenShowResumeBar(saved.idx, totalSeg);
    }
    listenSyncUI();
    if (startIdx >= 0) {
      // c209：iOS 上网络回调里的自动 speak 会被静默拒声，改为出"轻点播放"条（按钮点击是真手势）
      if (listenIsIos()) listenShowTapToPlay(startIdx, opts.crossNext !== false);
      else speakListenIdx(startIdx);
    }
  }

  // ═══ MODULE: qc (843行, 21fn) ═══ 全本质量诊断
  /* ---------- 全本质量诊断 ---------- */
  let lastDiagnosis = null;
  async function loadDiagnosis(projectId) {
    const panel = $('diagPanel'); if (!panel || !projectId) return;
    const account = capturePrivateSession();
    const bars = $('diagBars'); bars.innerHTML = `<div class="diag-loading">${lang === 'en' ? 'Running full-script diagnosis…' : '正在对全本跑四套质检尺子…'}</div>`;
    panel.classList.remove('hidden');
    // v2.254：内部 catch 兜底——失败时渲染 znErrorHtml 替代死 loading（面板右上角 diagRefreshBtn 可重试）
    try {
      const r = await Api.request(`/api/generate/projects/${projectId}/diagnosis?lang=${strategyLocale()}`);
      const d = await Api.jsonOrThrow(r);
      if (!isPrivateSessionCurrent(account) || (currentProjectId && currentProjectId !== projectId)) return;
      lastDiagnosis = d;
      renderDiagnosis(d);
    } catch (e) {
      if (!isPrivateSessionCurrent(account)) return;
      bars.innerHTML = znErrorHtml((e && e.message) || t('loadFail'));
    }
  }
  function diagColor(s) { return s >= 85 ? '#3fb67a' : s >= 70 ? '#7c9cff' : s >= 60 ? '#e0a23a' : '#e06a5b'; }
  // v2.38 全剧情绪曲线波形（确定性，与创作管线同源；免费可视化）
  let lastWave = null, waveProjectId = null;
  async function loadEmotionWave(projectId) {
    const panel = $('wavePanel'); if (!panel || !projectId) return;
    const account = capturePrivateSession();
    waveProjectId = projectId;
    const r = await Api.request(`/api/generate/projects/${projectId}/emotion-wave?lang=${strategyLocale()}`);
    if (!isPrivateSessionCurrent(account) || waveProjectId !== projectId) return;
    if (!r.ok) { panel.classList.add('hidden'); return; }
    const w = await Api.jsonOrThrow(r);
    if (!isPrivateSessionCurrent(account) || waveProjectId !== projectId) return;
    lastWave = w;
    renderEmotionWave(w);
  }
  function renderEmotionWave(w) {
    const panel = $('wavePanel'); panel.classList.remove('hidden');
    $('waveTitle').textContent = lang === 'en' ? 'Series emotion wave' : '全剧情绪曲线';
    const warnTxt = w.flatWarn ? (lang === 'en' ? ' · some 3-episode stretches are too flat, add suppression/release alternation' : ' · 存在连续3集过平，建议补压放交替') : '';
    // v2.60 压放结构体检（与导出导演页同口径：≥60 为推进/高能）
    const _drive = pts0 => pts0.filter(p => p.intensity >= 60).length;
    // @module qc
    const _n = (w.points || []).length || 1;
    const _drivePct = Math.round((_drive(w.points || []) / _n) * 100);
    const rhythmTxt = lang === 'en' ? ` · drive ${_drivePct}% / breathing ${100 - _drivePct}%` : ` · 推进${_drivePct}%/留白${100 - _drivePct}%`;
    $('waveSub').textContent = lang === 'en'
      ? `${w.episodeCount} ep · avg intensity ${w.avgIntensity} · peak Ep${w.peakEp}${rhythmTxt}${warnTxt}`
      : `共${w.episodeCount}集 · 平均张力${w.avgIntensity} · 峰值第${w.peakEp}集${rhythmTxt}${warnTxt}`;
    const pts = w.points || [];
    const Wpx = 640, Hpx = 180, padL = 34, padR = 10, padT = 14, padB = 24;
    const iw = Wpx - padL - padR, ih = Hpx - padT - padB;
    const x = (i) => pts.length <= 1 ? padL + iw / 2 : padL + (i / (pts.length - 1)) * iw;
    const y = (v) => padT + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.intensity).toFixed(1)}`).join(' ');
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${(padT + ih)} L${x(0).toFixed(1)},${(padT + ih)} Z`;
    const wloc = strategyLocale();
    const WLAB = { zh: ['；爽点：', '；反转：', (n, v) => `第${n}集 张力${v}`], en: ['; payoffs: ', '; reversal: ', (n, v) => `Ep${n} intensity ${v}`], ja: ['／カタルシス：', '／反転：', (n, v) => `第${n}話 テンション${v}`], ko: ['／쾌점: ', '／반전: ', (n, v) => `제${n}화 긴장도 ${v}`], es: ['; recompensas: ', '; giro: ', (n, v) => `Ep.${n} tensión ${v}`], ar: ['؛ إشباع: ', '؛ انقلاب: ', (n, v) => `الحلقة ${n} توتر ${v}`] };
    const wl = WLAB[wloc] || WLAB.zh;
    const dots = pts.map((p, i) => {
      const names = p.path.map((q) => (wloc === 'en' ? q.nameEn : q.name)).join(wloc === 'en' ? ' → ' : '→');
      const pay = p.payoffs.length ? `${wl[0]}${p.payoffs.map((q) => (wloc === 'en' ? q.nameEn : q.name)).join('/')}` : '';
      const rev = p.reversal ? `${wl[1]}${wloc === 'en' ? p.reversal.nameEn : p.reversal.name}` : '';
      const label = wl[2](p.ep, p.intensity) + `｜${names}${pay}${rev}`;
      return `<circle class="wave-dot" data-ep="${p.ep}" cx="${x(i).toFixed(1)}" cy="${y(p.intensity).toFixed(1)}" r="${pts.length > 60 ? 1.6 : 3.4}" fill="${p.intensity >= 80 ? '#e06a5b' : p.intensity >= 60 ? '#e0a23a' : '#7c9cff'}"><title>${escapeHtml(label)}</title></circle>`;
    }).join('');
    const grid = [20, 40, 60, 80].map((v) => `<line x1="${padL}" y1="${y(v)}" x2="${Wpx - padR}" y2="${y(v)}" class="wave-grid"/><text x="4" y="${y(v) + 3}" class="wave-axis">${v}</text>`).join('');
    const xLabels = pts.length <= 30 ? pts.filter((_, i) => i === 0 || i === pts.length - 1 || (i + 1) % Math.ceil(pts.length / 8) === 0)
      .map((p) => `<text x="${x(p.ep - 1).toFixed(1)}" y="${Hpx - 6}" text-anchor="middle" class="wave-axis">${p.ep}</text>`).join('') : '';
    $('waveSvg').innerHTML = `<svg viewBox="0 0 ${Wpx} ${Hpx}" preserveAspectRatio="xMidYMid meet" role="img" class="wave-svg">${grid}
      <path d="${area}" class="wave-area"/>
      <path d="${line}" class="wave-line"/>${dots}${xLabels}</svg>`;
    $('waveLegend').innerHTML = lang === 'en'
      ? '<span><i style="background:#e06a5b"></i>High (≥80)</span><span><i style="background:#e0a23a"></i>Mid (60-79)</span><span><i style="background:#7c9cff"></i>Breathing (&lt;60)</span><small>Click a dot for diagnosis · this director page is embedded in docx/pdf/txt downloads</small>'
      : '<span><i style="background:#e06a5b"></i>高能（≥80）</span><span><i style="background:#e0a23a"></i>推进（60-79）</span><span><i style="background:#7c9cff"></i>呼吸（&lt;60）</span><small>点击圆点看诊断 · 本导演节奏页会内嵌进 docx/pdf/txt 下载文件</small>';
    const adv = $('waveAdvice'); if (adv) { adv.classList.add('hidden'); adv.innerHTML = ''; }
  }
  // v2.39 波形点集→诊断→增值改稿闭环
  function showWaveAdvice(ep) {
    const box = $('waveAdvice'); if (!box || !lastWave) return;
    const p = lastWave.points.find((q) => q.ep === ep); if (!p) return;
    // @module qc
    const adv = (lastWave.advices || []).find((a) => a.ep === ep);
    box.classList.remove('hidden');
    if (!adv) {
      box.innerHTML = `<em class="wave-adv-ok">${lang === 'en' ? `Ep${ep} wave is healthy — suppression/release balanced, keep it.` : `第${ep}集波形健康，压放均衡，保持这个节奏。`}</em>`;
      return;
    }
    const wloc2 = strategyLocale();
    const txt = wloc2 === 'en' ? adv.adviceEn : adv.advice;
    box.innerHTML = `<em class="${adv.level === 'P1' ? 'wave-adv-p1' : 'wave-adv-p2'}">${lang === 'en' ? `Ep${ep}` : `第${ep}集`} · ${adv.level === 'P1' ? (lang === 'en' ? 'high priority' : '优先改') : (lang === 'en' ? 'tip' : '建议')}</em>
      <p>${escapeHtml(txt)}</p>
      <button class="diag-fix-btn" data-wave-fix="${ep}">${isStaffAcct() ? (lang === 'en' ? 'Let Xiaonan rewrite this episode · Free' : '让小南重写这一集 · 内部免费') : (lang === 'en' ? 'Let Xiaonan rewrite this episode · from 15 pts' : '让小南重写这一集 · 15积分起')}</button>`;
  }
  // c200：作品详情注入“围读改写清单”面板。包内 rule/dimLabel/advice 由后端只读生成并已截断校验，
  // 前端原样回传，不改写、不补造规则号；逐条按钮各自二次确认，杜绝一键连点批量扣费。
  // c201：①版本漂移显性提示（围读冻结旧版、/fix 作用最新版）；②真人讨论点随包呈现（c198 新增关注不得蒸发）；
  // ③按服务端 gate 提前置灰会员能力（安全仍由 /fix 兜底）；④已成功条目锁定，杜绝同版重复扣费入口。
  const rrFixedKeys = new Map(); // key=`${projectId}:${epNo}:${packKey}` → 新版本号（409 命中为 null）
  function renderReadRewritePanel(d) {
    const detail = $('worksDetail');
    if (!detail) return;
    const old = document.getElementById('readRewritePanel'); if (old) old.remove();
    const packs = Array.isArray(d.packs) ? d.packs : [];
    const dps = Array.isArray(d.discussionPoints) ? d.discussionPoints : [];
    if (!packs.length && !dps.length) return;
    const enLang = lang === 'en';
    const panel = document.createElement('div');
    panel.className = 'diag-panel'; panel.id = 'readRewritePanel'; panel.style.marginTop = '10px';
    const epTxt = enLang ? `Ep${d.epNo}` : `第${d.epNo}集`;
    const head = enLang ? `Table-read fix notes · ${epTxt}` : `围读改写清单 · ${epTxt}`;
    const sub = isStaffAcct()
      ? (enLang ? 'Each note is prefetched only. Confirm an item to run the rewrite — free for staff.' : '每条意见仅预填展示，逐条确认后定点改写；内部账户免费。')
      : (enLang ? 'Each note is prefetched only. Confirm an item to run the paid targeted rewrite.' : '每条意见仅预填展示，逐条确认后才付费定点改写。');
    // @module qc
    const lvTxt = (p) => enLang ? ({ P0: 'block', P1: 'high' }[p.priority] || p.priority) : (p.priority === 'P0' ? '必改' : '优先改');
    const btnTxt = isStaffAcct()
      ? (enLang ? 'Let Xiaonan fix this · Free' : '让小南优化这处 · 内部免费')
      : (enLang ? 'Let Xiaonan fix this · from 15 pts' : '让小南优化这处 · 15积分起');
    const LV_NAME = { BASIC: enLang ? 'Basic' : '基础会员', ADVANCED: enLang ? 'Advanced' : '高级会员' };
    // c201 版本漂移条：房内意见扫描的是冻结旧版，付费改写会落到最新版——必须让用户在点之前看见这个事实。
    // c202 F3：房主可一键用最新版开新围读房（latestScriptId 仅房主响应携带）；费用事实先讲清：开房免费，AI 围读才扣 30。
    const reReadHtml = d.latestScriptId
      ? `<div class="row-actions" style="margin-top:6px">
          <button type="button" class="btn-ghost" data-reread="${escapeHtml(d.latestScriptId)}">${enLang ? `Re-read the latest v${d.currentVersion}` : `用最新版 v${d.currentVersion} 重新围读`}</button>
          <span class="muted" style="font-size:12px;margin-left:8px">${isStaffAcct() ? (enLang ? 'Opening a room and AI reads are free for staff.' : '内部账户建立围读室与 AI 围读均免费。') : (enLang ? 'Opening a room is free; “Start AI read” costs 30 pts.' : '建立围读室免费；点“开始AI围读”才扣 30 积分。')}</span>
        </div>`
      : '';
    const driftHtml = d.versionDrift
      ? `<div style="margin:0 0 8px;padding:6px 10px;border-radius:6px;background:#fdf3e2;color:#8a6d3b;font-size:13px">
          ${enLang
            ? `The read was run on v${d.roomVersion}; this episode now has v${d.currentVersion}. The rewrite will apply to the latest v${d.currentVersion}, and old notes may no longer match verbatim.`
            : `围读基于第${d.epNo}集 v${d.roomVersion}，该集现已更新到 v${d.currentVersion}。定点改写将作用于最新版 v${d.currentVersion}，旧意见可能与正文不再逐字对应。`}${reReadHtml}</div>`
      : '';
    // c201 真人讨论点（后端已按席位归类并标注 adopted）：只读呈现，制片预算等引擎不可见信息不能在作品页蒸发。
    const dpHtml = dps.length
      ? `<div style="margin:0 0 8px"><b>${enLang ? 'Live discussion' : '真人讨论'}</b>${dps.map((p) => `<div style="border-left:3px solid #5b8def;padding:2px 0 2px 8px;margin:4px 0">
          <span style="font-weight:600">${escapeHtml(p.seatName || '')}</span>
          <span style="margin-left:6px;padding:0 6px;border-radius:8px;font-size:12px;color:#fff;background:${p.adopted ? '#4caf85' : '#e0a13c'}">${p.adopted ? (enLang ? 'converged' : '已采纳') : (enLang ? 'new flag' : '新增关注')}</span>
          <div>${escapeHtml(p.point || '')}</div></div>`).join('')}</div>`
      : '';
    // null 版本号=409 幂等命中（处理中/已处理但拿不到新版号），同样锁定，重绘不复活按钮
    // @module qc
    const fixedBtn = (ver) => ver
      ? (enLang ? `Rewritten · new v${ver}` : `已改写 · 新版 v${ver}`)
      : (enLang ? 'In progress / already handled' : '处理中/已处理');
    const packsHtml = packs.length ? packs.map((pk) => {
      const fk = `${d.projectId}:${d.epNo}:${pk.key}`;
      const fixed = rrFixedKeys.has(fk);
      const locked = !fixed && pk.gate && pk.gate.allowed === false;
      const lockTag = locked
        ? ` <span style="font-size:12px;color:#b07a2e">🔒${escapeHtml(LV_NAME[pk.gate.needLevel] || pk.gate.needLevel)}</span>`
        : '';
      const btn = fixed
        ? `<button class="diag-fix-btn" disabled>${fixedBtn(rrFixedKeys.get(fk))}</button>`
          + `<button type="button" class="diag-fix-btn diag-refresh-btn" data-rrrefresh="${escapeHtml(fk)}">${enLang ? 'Refresh for new version' : '刷新查看新版'}</button>`
        : locked
          ? `<button class="diag-fix-btn" data-rrlock="${escapeHtml(pk.gate.needLevel)}" style="opacity:.65">${enLang ? 'Member ability' : '会员能力'} · 🔒${escapeHtml(LV_NAME[pk.gate.needLevel] || pk.gate.needLevel)}</button>`
          : `<button class="diag-fix-btn" data-rrfix="${escapeHtml(pk.key)}">${btnTxt}</button>`;
      return `<div class="diag-fix ${pk.priority === 'P0' ? 'fix-p0' : 'fix-p1'}">
          <em>${escapeHtml(lvTxt(pk))} · ${escapeHtml(pk.seatName || '')} · ${escapeHtml(pk.fix && pk.fix.dimLabel || pk.kind || '')}${lockTag}</em>
          <p>${escapeHtml(pk.fix && pk.fix.advice || pk.suggestion || '')}</p>${btn}</div>`;
    }).join('') : '';
    panel.innerHTML = `<div class="diag-fix-head">${escapeHtml(head)}</div>
      <div class="muted" style="margin:2px 0 8px">${escapeHtml(sub)}</div>${driftHtml}${dpHtml}${packsHtml}`;
    detail.appendChild(panel);
    panel.querySelectorAll('[data-rrfix]').forEach((b) => {
      const pk = packs.find((x) => x.key === b.getAttribute('data-rrfix'));
      b.onclick = () => applyReadPackFix(b, d, pk);
    });
    panel.querySelectorAll('[data-rrlock]').forEach((b) => {
      // 锁定项不弹付费确认、不发请求：直接给升级引导（硬闸门仍在服务端，前端只省一次无意义点击）
      b.onclick = () => {
        const need = b.getAttribute('data-rrlock');
        xnSay(enLang ? `This Xiaonan capability requires ${LV_NAME[need] || need} or above.` : `这项小南能力需要${LV_NAME[need] || need}及以上，升级后即可使用。`);
        setTimeout(() => typeof switchView === 'function' && switchView('vip'), 900);
      };
    });
    // c202 F2：已锁定条目零费刷新（重新拉作品版本行，再把本面板挂回去；不发任何 fix 请求）
    panel.querySelectorAll('[data-rrrefresh]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true; const old = b.textContent; b.textContent = enLang ? 'Refreshing…' : '刷新中…';
        try {
          if (currentWorksProject && currentWorksProject.id === d.projectId) await openProject(currentWorksProject);
          if (currentWorksProject && currentWorksProject.id === d.projectId) renderReadRewritePanel(d);
          xnSay(enLang
            ? 'Refreshed — expand “Past versions” or compare the two versions.'
            : '已刷新到最新版本，可展开“历史版本”或逐行对比改动。');
        // v2.256：补 catch（失败 xnSay 提示，不静默冒泡）+ finally 恢复 disabled（否则 openProject 抛错时按钮死在「刷新中…」）
        } catch { xnSay(enLang ? 'Refresh failed, please try again.' : '刷新失败，请稍后重试'); }
        finally { const stale = panel.querySelector('[data-rrrefresh]'); if (stale) { stale.disabled = false; stale.textContent = old; } }
      };
    });
    // c202 F3：漂移条“用最新版重新围读”——确认费用事实后跨页把 scriptId 交给编剧室（房间由 /read/open 再做归属校验）
    panel.querySelectorAll('[data-reread]').forEach((b) => {
      b.onclick = async () => {
        const scriptId = b.getAttribute('data-reread');
        if (!scriptId) return;
        const ok = await uiConfirm({ body: isStaffAcct()
          ? (enLang ? `Open a new table-read room on Ep${d.epNo} latest v${d.currentVersion}?\nFree for staff accounts (opening and AI reads).` : `将用第${d.epNo}集最新版 v${d.currentVersion} 开一间新的围读室。\n内部账户开房与 AI 围读均免费。是否继续？`)
          : (enLang
          ? `Open a new table-read room on Ep${d.epNo} latest v${d.currentVersion}?\nOpening a room is free. “Start AI read” inside the room costs 30 points.`
          : `将用第${d.epNo}集最新版 v${d.currentVersion} 开一间新的围读室。\n建立围读室免费；进入后点“开始AI围读”才扣 30 积分。是否继续？`), okText: enLang ? 'Continue' : '继续' });
        if (!ok) return;
        window.dispatchEvent(new CustomEvent('zn-reread-latest', {
          detail: { scriptId, epNo: d.epNo, version: d.currentVersion, title: d.scriptTitle || d.roomTitle || '', scriptMode: d.scriptMode || 'LIVE' },
        }));
      };
    });
    try { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* 无滚动环境忽略 */ }
    xnSay(enLang
      ? `Table-read notes carried to ${epTxt}: ${packs.length} prefetched item(s), nothing charged yet.`
      : `围读意见已带到${epTxt}：预填 ${packs.length} 条修改项，尚未扣费。`);
  }
  async function applyReadPackFix(btn, d, pk) {
    if (!d || !d.projectId || !pk || !pk.fix || !pk.fix.rule) return;
    const enLang = lang === 'en';
    const epTxt = enLang ? `Ep${d.epNo}` : `第${d.epNo}集`;
    const ok = await uiConfirm({ body: isStaffAcct()
      ? (enLang ? `Let Xiaonan rewrite ${epTxt} for this table-read note? Free for staff accounts.` : `让小南针对这条围读意见重写${epTxt}？内部账户免费，是否继续？`)
      : (enLang
      ? `Let Xiaonan rewrite ${epTxt} for this table-read note? Paid targeted polish; member discount applies; server settles actual points.`
      : `让小南针对这条围读意见重写${epTxt}？这是付费针对性优化，会员享折扣，实际扣积分以后端结算为准。是否继续？`), okText: enLang ? 'Continue' : '继续' });
    if (!ok) return;
    const oldTxt = btn.textContent; btn.disabled = true; btn.textContent = enLang ? 'Polishing…' : '小南正在改…';
    try {
      const res = await Api.request(`/api/generate/projects/${d.projectId}/fix`, {
        method: 'POST',
        body: JSON.stringify({ fix: { rule: pk.fix.rule, dimLabel: pk.fix.dimLabel, advice: pk.fix.advice }, epNo: d.epNo }),
      });
      const txt2 = await res.text(); const rj = txt2 ? JSON.parse(txt2) : {};
      if (!res.ok) throw Object.assign(new Error(rj.error || 'FAIL'), { msg: rj.message, upsell: rj.upsell, httpStatus: res.status });
      // c201 D4：成功即锁定本条目（会话内），重绘也不再给可点按钮——版本已变，再点是一次新扣费。
      if (pk.key) rrFixedKeys.set(`${d.projectId}:${d.epNo}:${pk.key}`, rj.newVersion || '');
      xnSay(rj.staff
        ? (enLang ? `Ep${rj.epNo} rewritten to v${rj.newVersion}, free for staff. ${rewriteSpanText(rj.rewriteSpan)} Refreshing…` : `搞定！${epTxt}已出新版 v${rj.newVersion}，内部账户免费。${rewriteSpanText(rj.rewriteSpan)}正在刷新～`)
        : (enLang ? `Ep${rj.epNo} rewritten to v${rj.newVersion}, used ${rj.pointsCharged} pts. ${rewriteSpanText(rj.rewriteSpan)} Refreshing…` : `搞定！${epTxt}已出新版 v${rj.newVersion}，消耗${rj.pointsCharged}积分。${rewriteSpanText(rj.rewriteSpan)}正在刷新～`));
      // c203 D3：currentWorksProject 可能为 null（面板游离/会话切换边缘）。旧代码无判空直接 await openProject(null)，
      // openProject 内取 title 抛 TypeError 落入 catch，对一笔已成功扣费的改写误报“积分已自动退回”——钱文案撒谎。
      if (currentWorksProject && currentWorksProject.id === d.projectId) {
        await openProject(currentWorksProject);
        // c201 D5：两次 await 之间用户可能切走作品；只在仍停留在本项目时挂面板，避免 A 房意见串到 B 作品。
        renderReadRewritePanel(d);
        // c202：付费后自动展开旧版→新版逐行对比，让用户立刻看到这条意见小南具体改了什么
        openVersionDiff(d.projectId, rj.epNo, rj.oldVersion, rj.newVersion);
      }
    } catch (err) {
      // c201 D2：409=服务端幂等命中（处理中或已处理），既未重复扣费也无退款；旧文案谎称“积分已退回”，必须单列。
      // c204 复盘修复：VERSION_ADVANCED 与 IDEMPOTENT_REPLAY 同为 409，必须先放行前者，
      // 否则并发败者（已退款、可基于新版重试）被误判成幂等锁死，刷新/重试入口永不出现。
      if (err.message === 'IDEMPOTENT_REPLAY' || (err.httpStatus === 409 && err.message !== 'VERSION_ADVANCED')) {
        if (pk.key) rrFixedKeys.set(`${d.projectId}:${d.epNo}:${pk.key}`, null); // 重绘也保持锁定
        btn.disabled = true; btn.textContent = enLang ? 'In progress / already handled' : '处理中/已处理';
        attach409Refresh(btn, d.projectId, true, () => {
          if (currentWorksProject && currentWorksProject.id === d.projectId) renderReadRewritePanel(d);
        });
        xnSay(enLang ? 'This item is already in progress or has been handled — please do not submit it again. No extra points were charged.' : '这项正在处理或已经处理过，请勿重复提交；不会重复扣积分，稍等刷新查看新版即可。');
        return;
      }
      btn.disabled = false; btn.textContent = oldTxt;
      if (err.message === 'VERSION_ADVANCED') {
        handleVersionAdvanced(btn, d.projectId, true, () => {
          if (currentWorksProject && currentWorksProject.id === d.projectId) renderReadRewritePanel(d);
        }, async () => {
          // c204：零费刷新到最新版后，找重绘面板里的同条目新按钮再点（仍弹付费确认，不静默扣费）
          if (currentWorksProject && currentWorksProject.id === d.projectId) {
            await openProject(currentWorksProject);
            renderReadRewritePanel(d);
          }
          const fresh = Array.from(document.querySelectorAll('#readRewritePanel [data-rrfix]'))
            .find((b) => b.isConnected && !b.disabled && b.getAttribute('data-rrfix') === pk.key);
          if (!fresh) {
            xnSay(enLang
              ? 'After refresh this note is no longer an actionable item on the latest version (another rewrite may have covered it). Open a new table-read if needed.'
              : '刷新后这条意见在最新版上已不是可改项（可能已被其他改写覆盖），需要的话可用最新版重新围读。');
            return;
          }
          fresh.click();
        });
        return;
      }
      if (err.message === 'AUTH_REQUIRED') { openAuth('login'); return; }
      if (err.message === 'INSUFFICIENT') xnSay(enLang ? 'Not enough points — top up to keep polishing.' : '积分不够啦，充值后小南就能继续帮你打磨～');
      else if (err.message === 'ASSISTANT_LEVEL_REQUIRED') { xnSay(err.upsell ? (enLang ? err.upsell.en : err.upsell.zh) : (enLang ? 'Upgrade to unlock this Xiaonan capability.' : '升级会员后小南才能用这项能力哦～')); setTimeout(() => typeof switchView === 'function' && switchView('vip'), 900); }
      else if (err.message === 'SANDBOX') xnSay(enLang ? 'Sandbox without model keys: nothing charged.' : '当前是无密钥沙盘，本次没扣分；配置模型后即可一键优化。');
      else if (err.message === 'MODEL_FAIL') xnSay(enLang ? 'The model did not return a result; points were refunded. Try again in a moment.' : '模型这次没给出结果，积分已自动退回，稍后再试一次～');
      else if (err.message === 'SAVE_FAILED') xnSay(enLang ? 'The new version could not be saved; points were refunded. Try again in a moment.' : '新版本保存失败，积分已自动退回，稍后再试一次～');
      else xnSay(enLang ? 'Polish did not complete; points were refunded. Try again.' : '这次优化没成功，积分已自动退回，稍后再试一次～');
    }
  }
  async function applyWaveFix(btn, ep) {
    const projectId = waveProjectId || currentProjectId;
    if (!lastWave || !projectId) return;
    const adv = (lastWave.advices || []).find((a) => a.ep === ep);
    if (!adv) return;
    const fix = { rule: adv.rule, dimLabel: lang === 'en' ? adv.dimLabelEn : adv.dimLabel, advice: lang === 'en' ? adv.adviceEn : adv.advice };
    const ok = await uiConfirm({ body: isStaffAcct()
      ? (lang === 'en' ? `Let Xiaonan rewrite Ep${ep} for its wave issue? Free for staff accounts.` : `让小南针对波形问题重写第${ep}集？内部账户免费，是否继续？`)
      : (lang === 'en'
      ? `Let Xiaonan rewrite Ep${ep} for its wave issue? Paid targeted polish; member discount applies; server settles actual points.`
      : `让小南针对波形问题重写第${ep}集？这是付费针对性优化，会员享折扣，实际扣积分以后端结算为准。是否继续？`), okText: lang === 'en' ? 'Continue' : '继续' });
    if (!ok) return;
    const oldTxt = btn.textContent; btn.disabled = true; btn.textContent = lang === 'en' ? 'Polishing…' : '小南正在改…';
    try {
      const res = await Api.request(`/api/generate/projects/${projectId}/fix`, { method: 'POST', body: JSON.stringify({ fix, epNo: ep }) });
      const txt2 = await res.text(); const d = txt2 ? JSON.parse(txt2) : {};
      if (!res.ok) throw Object.assign(new Error(d.error || 'FAIL'), { msg: d.message, httpStatus: res.status });
      xnSay(d.staff
        ? (lang === 'en' ? `Ep${d.epNo} rewritten to v${d.newVersion}, free for staff. ${rewriteSpanText(d.rewriteSpan)} Refreshing…` : `搞定！第${d.epNo}集已出新版 v${d.newVersion}，内部账户免费。${rewriteSpanText(d.rewriteSpan)}正在刷新波形～`)
        : (lang === 'en' ? `Ep${d.epNo} rewritten to v${d.newVersion}, used ${d.pointsCharged} pts. ${rewriteSpanText(d.rewriteSpan)} Refreshing…` : `搞定！第${d.epNo}集已出新版 v${d.newVersion}，消耗${d.pointsCharged}积分。${rewriteSpanText(d.rewriteSpan)}正在刷新波形～`));
      await refreshResultScripts(projectId);
      await Promise.all([loadDiagnosis(projectId).catch(() => {}), loadEmotionWave(projectId).catch(() => {})]);
    } catch (err) {
      // c201：409 幂等命中≠失败退款，文案不得再谎称“积分已退回”
      // c204 复盘修复：VERSION_ADVANCED 与 IDEMPOTENT_REPLAY 同为 409，必须先放行前者，
      // 否则并发败者（已退款、可基于新版重试）被误判成幂等锁死，刷新/重试入口永不出现。
      if (err.message === 'IDEMPOTENT_REPLAY' || (err.httpStatus === 409 && err.message !== 'VERSION_ADVANCED')) {
        btn.disabled = true; btn.textContent = lang === 'en' ? 'In progress / already handled' : '处理中/已处理';
        // c203 D6：波形页原来只刷脚本列表不重建波形/建议卡，用户在本页看不到并发改出的新版，after 补上
        attach409Refresh(btn, projectId, false, () => { loadEmotionWave(projectId).catch(() => {}); });
        xnSay(lang === 'en' ? 'This item is already in progress or has been handled — do not submit it again; no extra points were charged.' : '这项正在处理或已经处理过，请勿重复提交；不会重复扣积分，稍等刷新即可。');
        return;
      }
      btn.disabled = false; btn.textContent = oldTxt;
      if (err.message === 'VERSION_ADVANCED') {
        handleVersionAdvanced(btn, projectId, false, () => { loadEmotionWave(projectId).catch(() => {}); }, async () => {
          // c204：刷新脚本列表+波形/诊断，再点重绘后的同集波形改写按钮（重新走付费确认）
          await refreshResultScripts(projectId).catch(() => {});
          await Promise.all([loadDiagnosis(projectId).catch(() => {}), loadEmotionWave(projectId).catch(() => {})]);
          const fresh = findFreshEntry(`[data-wave-fix="${ep}"]`);
          if (!fresh) {
            xnSay(lang === 'en'
              ? 'After refresh the wave shows no remaining issue for this episode — the new version already covers it.'
              : '刷新后波形已无该集待优化项，新版应该已经覆盖了这个问题。');
            return;
          }
          fresh.click();
        });
        return;
      }
      if (err.code === 'AUTH_REQUIRED') { openAuth('login'); return; }
      if (err.message === 'INSUFFICIENT') xnSay(lang === 'en' ? 'Not enough points — top up to keep polishing.' : '积分不够啦，充值后小南就能继续帮你打磨～');
        else if (err.message === 'ASSISTANT_LEVEL_REQUIRED') { xnSay(err.upsell ? (lang==='en'?err.upsell.en:err.upsell.zh) : (lang==='en'?'Upgrade to unlock this Xiaonan capability.':'升级会员后小南才能用这项能力哦～')); setTimeout(()=>typeof switchView==='function'&&switchView('vip'), 900); }
      else if (err.message === 'SANDBOX') xnSay(lang === 'en' ? 'Sandbox without model keys: nothing charged.' : '当前是无密钥沙盘，本次没扣分；配置模型后即可一键优化。');
      else if (err.message === 'SAVE_FAILED') xnSay(lang === 'en' ? 'The new version could not be saved; points were refunded. Try again in a moment.' : '新版本保存失败，积分已自动退回，稍后再试一次～');
      else xnSay(lang === 'en' ? 'Polish did not complete; points were refunded. Try again.' : '这次优化没成功，积分已自动退回，稍后再试一次～');
    }
  }
  function levelTag(lv) {
    if (lang === 'en') return { '优秀': 'Excellent', '良好': 'Good', '及格': 'Pass', '待打磨': 'Needs work' }[lv] || lv;
    return lv;
  }
  const dimEn = { 人物: 'Character', 剧情: 'Plot', 台词: 'Dialogue', 市场: 'Market', 格式: 'Format', 去AI化: 'De-AI' };
  function buildDiagnosisHtml(d) {
    // @module qc
    const bars = (d.groups || []).map((g) => {
      const lab = lang === 'en' ? (dimEn[g.label] || g.label) : g.label;
      return `<div class="diag-row"><span class="diag-k">${lab}</span>
        <span class="diag-track"><i style="width:${g.score}%;background:${diagColor(g.score)}"></i></span>
        <b class="diag-v" style="color:${diagColor(g.score)}">${g.score}</b></div>`;
    }).join('');
    const fixes = d.topFixes || [];
    const head = lang === 'en' ? 'Priority fixes' : '优先修改清单';
    const fixHtml = fixes.length
      ? `<div class="diag-fix-head">${head}（${fixes.length}）</div>` + fixes.map((f, i) => {
        const tagCls = f.level === 'P0' ? 'fix-p0' : f.level === 'P1' ? 'fix-p1' : 'fix-p2';
        const lvTxt = lang === 'en' ? { P0: 'block', P1: 'high', P2: 'tip' }[f.level] : f.level;
        const dimLab = lang === 'en' ? (dimEn[f.dimLabel] || f.dimLabel) : f.dimLabel;
        return `<div class="diag-fix ${tagCls}"><em>${lvTxt} · ${dimLab}</em><p>${escapeHtml(f.advice)}</p>
          <button class="diag-fix-btn" data-fix-idx="${i}">${isStaffAcct() ? (lang === 'en' ? 'Let Xiaonan fix this · Free' : '让小南优化这处 · 内部免费') : (lang === 'en' ? 'Let Xiaonan fix this · from 15 pts' : '让小南优化这处 · 15积分起')}</button></div>`;
      }).join('')
      : `<div class="diag-ok">${lang === 'en' ? 'No major issues found. Nice.' : '未发现明显硬伤，保持这个质感。'}</div>`;
    return { bars, fixHtml };
  }
  // v2.129 创作质检聚合卡：通用遍历每集 qcReport——凡带 hits[] 结构且 score<100 的创作引擎自动上卡，新引擎无需改前端
  const QC_ENGINE_LABELS = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.QC_ENGINE_LABELS) || {
    faintOnCue: ['晕倒阀门', 'Faint-on-cue'], wakeOnCue: ['呼唤即醒', 'Wake-on-cue'], woundOnCue: ['带伤开挂', 'Wound-on-cue'],
    instantHack: ['黑客秒破', 'Instant hack'], instantLanguage: ['语言秒精通', 'Instant fluency'], instantEscape: ['束缚秒脱', 'Instant escape'],
    weaponJam: ['武器哑火', 'Weapon jam'], evidenceBlank: ['证据恰好失灵', 'Evidence on cue'], childBlurt: ['萌宝泄密', 'Child blabber'],
    deadlineStretch: ['假倒计时', 'Fake deadline'], softInterrogation: ['审讯秒招', 'Instant confession'], deathbedConfession: ['临终全招', 'Deathbed confession'],
    truthSerum: ['吐真剂秒招', 'Truth serum'], pregnancyOnCue: ['妊娠剧情阀门', 'Pregnancy on cue'], amnesiaOnCue: ['失忆剧情阀门', 'Amnesia on cue'],
    terminalDiagnosisOnCue: ['绝症剧情阀门', 'Terminal-illness on cue'], allergyOnCue: ['过敏剧情阀门', 'Allergy on cue'], poisonOnCue: ['中毒秒解毒', 'Poison on cue'],
    muteOnCue: ['失声复声阀门', 'Mute-on-cue'], deafOnCue: ['耳聋复聪阀门', 'Deaf-on-cue'], paralysisOnCue: ['瘫痪秒愈', 'Paralysis on cue'],
    fatigueOverdrive: ['疲劳透支开挂', 'Fatigue overdrive'], apologyLoop: ['道歉循环', 'Apology loop'], forcedProximity: ['困处生情', 'Forced proximity'],
    rescueRomance: ['救美必生情', 'Rescue romance'], fightReconcile: ['吵架秒和好', 'Instant reconciliation'], instantRepentance: ['加害者秒悔悟', 'Instant repentance'],
    talkDown: ['嘴炮退敌', 'Talk-down'], instantSurgery: ['野战手术秒成功', 'Instant surgery'], crowdFlip: ['当众倒戈', 'Crowd flip'],
    rumorSpeed: ['丑闻秒传遍', 'Rumor speed'], resultsOnCue: ['化验秒出', 'Results on cue'], trafficOnCue: ['路况掐点', 'Traffic on cue'],
    vehicleJam: ['载具掐点故障', 'Vehicle jam'], sleepTalk: ['梦呓泄密', 'Sleep talk'], feverTruth: ['高烧谵妄吐真言', 'Fever truth'],
    instantEndowment: ['无因馈赠', 'Unprompted gift'], lastSecondRescue: ['救兵天降', 'Last-second rescue'], villainStall: ['反派拖刀', 'Villain stall'], teamBriefing: ['开会式推进', 'Team briefing'], instantTrust: ['初见托付', 'Instant trust'],
    instantKinship: ['认亲白给', 'Instant kinship'], instantLove: ['初见白给', 'Instant love'], instantMarksman: ['神枪手开挂', 'Instant marksman'], propMotifRhythm: ['物象母题节奏', 'Prop motif rhythm'],
    convenientEncounter: ['转角偶遇', 'Convenient encounter'], alwaysLate: ['晚一步阀门', 'Always late'], delayedReveal: ['迟到揭秘', 'Delayed reveal'],
    // v2.133 复盘轮补齐：pipeline 全引擎 key 中文词条（此前缺失的走 humanizeEngineKey 英文兜底）
    voicePrint: ['声纹一致性', 'Voice print'], dialogueAiTaste: ['AI味', 'AI taste'], sceneEmotionFlat: ['情绪平线', 'Scene emotion flat'], sensoryDetail: ['感官细节', 'Sensory detail'],
    vagueWord: ['模糊措辞', 'Vague wording'], dialogueNameCall: ['直呼名公式', 'Name-calling dialogue'], dialoguePingpong: ['乒乓对白', 'Ping-pong dialogue'], hollowAction: ['动作空转', 'Hollow action'],
    emotionWhiplash: ['情绪秒横跳', 'Emotion whiplash'], echoDialogue: ['信息复述', 'Echo dialogue'], expositionDialogue: ['说明对白', 'Exposition dialogue'], sceneSoftEnding: ['软绵收尾', 'Soft scene ending'],
    emotionLabelDialogue: ['情绪直给台词', 'Emotion-label dialogue'], roundRobinDialogue: ['轮流发言', 'Round-robin dialogue'], rhetoricalBarrage: ['反问连珠', 'Rhetorical barrage'], mirrorVisualDialogue: ['台词复述画面', 'Mirror-visual dialogue'],
    mindReadingNarration: ['读心旁白', 'Mind-reading narration'], crowdReaction: ['群体反应', 'Crowd reaction'], patheticFallacy: ['天气拟情', 'Pathetic fallacy'], omniscientTease: ['全知预告', 'Omniscient tease'],
    effortGloss: ['努力蒙太奇', 'Effort gloss'], reactionCliche: ['反应公式', 'Reaction cliché'], infoDelivery: ['弹窗广播', 'Info delivery'], atmosphereTell: ['气氛直给', 'Atmosphere tell'],
    confrontationDodge: ['对质回避', 'Confrontation dodge'], selfIntroDump: ['自报家门', 'Self-intro dump'], moralNarration: ['说教旁白', 'Moral narration'], emptyThreat: ['狠话不兑付', 'Empty threat'],
    timeJumpPayoff: ['时间直给', 'Time-jump payoff'], emotionPropCrutch: ['情绪道具拐杖', 'Emotion-prop crutch'], emotionVentCliche: ['情绪宣泄套路', 'Emotion-vent cliché'], actionEcho: ['动作回声', 'Action echo'],
    eavesdropDump: ['偷听直给', 'Eavesdrop dump'], selfPity: ['苦难自怜', 'Self-pity'], villainConfession: ['不打自招', 'Villain over-confession'], cheapForgiveness: ['免费宽恕', 'Cheap forgiveness'],
    witnessGratuity: ['证人白给', 'Witness gratuity'], previewVoiceover: ['信息预告', 'Preview voiceover'], stanceFlip: ['立场横跳', 'Stance flip'], unplantedAsset: ['后手空降', 'Unplanted asset'],
    subtextErase: ['潜台词擦除', 'Subtext erase'], exitCliche: ['离场套路', 'Exit cliché'], phoneRelay: ['电话转达', 'Phone relay'], fakeChoice: ['假选择', 'Fake choice'],
    parenOverdirect: ['括号表演指令', 'Parenthetical over-directing'], abstractAccusation: ['空泛质问', 'Abstract accusation'], cheapEmpathy: ['安慰话术', 'Cheap empathy'], fidgetProp: ['道具小动作', 'Fidget prop'],
    emptyVow: ['空转誓言', 'Empty vow'], flashbackCrutch: ['闪回拐杖', 'Flashback crutch'], accidentalSpark: ['意外火花', 'Accidental spark'], commFailCrutch: ['通讯失灵', 'Comm-fail crutch'],
    drunkTruth: ['灌醉真心话', 'Drunken truth'], tearBait: ['泪点开关', 'Tear bait'], instantDeduction: ['秒推理', 'Instant deduction'], recordsOnDemand: ['一查必中', 'Records on demand'],
    walkInTiming: ['推门掐点', 'Walk-in timing'], helpOnDemand: ['随叫随到', 'Help on demand'], wakeUpCall: ['一句话点醒', 'Wake-up line'], blindnessOnCue: ['失明复明阀门', 'Blindness on cue'],
    character: ['人物行为逻辑', 'Character logic'], rhythm: ['节奏曲线', 'Rhythm'],
    openingWeld: ['跨集焊点承接', 'Episode weld'], // v2.323 /fix 重算 176 键唯一缺口，issues 形态靠 extras 兜底行渲染，补词条后有中文标签+click-to-fix attr
    // c218 闸门引擎四键（无 score，由下方闸门卡渲染；词条供兜底与检索）
    cliche: ['反套路闸门', 'Anti-cliché gate'], tongue: ['台词口语化', 'Colloquial gate'],
    grounded: ['落地感', 'Groundedness'], lengthPlan: ['字数闸门', 'Length gate'], styleCheck: ['风格一致性', 'Style consistency']
  };
    // @module qc
  const humanizeEngineKey = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  // c220：质检 chip 点击即修——携带规则键/维度/首条建议到委托点击处理器（台账 30 键跨集，不挂此入口）
    // @module qc
  const qcFixAttrs = (ep, rule, dim, advice) =>
    ` data-qcfix="1" data-ep="${Number(ep) || 0}" data-rule="${escapeHtml(rule)}"`
    + ` data-dim="${escapeHtml(String(dim || '').slice(0, 20))}" data-advice="${escapeHtml(String(advice || '').slice(0, 400))}"`;
  function qcIssueText(issue) {
    if (typeof issue === 'string') return issue.trim();
    if (!issue || typeof issue !== 'object') return '';
    for (const key of ['advice', 'message', 'evidence']) {
      if (typeof issue[key] === 'string' && issue[key].trim()) return issue[key].trim();
    }
    return '';
  }
  function buildQcReportHtml(eps) {
    const rows = [];
    let total = 0;
    (eps || []).forEach((s) => {
      const qc = s.qcReport || {};
      const chips = [];
      Object.keys(qc).forEach((k) => {
        const v = qc[k];
        if (!v || typeof v !== 'object' || typeof v.score !== 'number' || v.score >= 100) return;
        if (!Array.isArray(v.hits) || !v.hits.length) return; // 创作能力引擎统一形态：score + hits[]；结构维度不混入此卡
        if (k === 'sceneSoftEnding' || k === 'showDontTell') return; // c211：专用卡接管（旧库残留的通用摘要行不重复渲染）
        const msgs = [].concat(Array.isArray(v.issues) ? v.issues : []).concat(Array.isArray(v.advice) ? v.advice : [])
          .map(qcIssueText).filter(Boolean);
        const pair = QC_ENGINE_LABELS[k];
        const name = pair ? (lang === 'en' ? pair[1] : pair[0]) : humanizeEngineKey(k);
        const unrescued = typeof v.unrescuedCount === 'number' ? v.unrescuedCount : v.hits.filter((h) => !h.rescued).length;
        const tip = msgs.length ? msgs.slice(0, 3).join(' / ') : (lang === 'en' ? 'Writing-quality finding' : '创作质检命中');
        chips.push(`<span class="qc-chip qc-chip-fix ${v.score < 60 ? 'qc-bad' : 'qc-warn'}"${qcFixAttrs(s.epNo, k, name, tip)} title="${escapeHtml(`${name} · ${lang === 'en' ? 'unresolved' : '未化解'} ${unrescued} — ${tip}${lang === 'en' ? ' · Click to have Xiaonan rewrite this' : ' · 点击让小南针对性改写'}`.slice(0, 240))}">${escapeHtml(name)} <b>${v.score}</b></span>`);
      });
      if (chips.length) {
        total += chips.length;
        rows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em><div class="qc-chips">${chips.join('')}</div></div>`);
      }
    });
    // v2.133 资产总览条：契诃夫之枪家族三表合一——跨集伏笔账本（悬空数）/ 后手空降（命中数）/ 物象母题节奏（断点数），盯同一件道具的叙事债
    const assetRows = [];
    (eps || []).forEach((s) => {
      const qc = s.qcReport || {};
      const dangling = qc.foreshadow && Array.isArray(qc.foreshadow.dangling) ? qc.foreshadow.dangling.length : null;
      const unplant = qc.unplantedAsset && Array.isArray(qc.unplantedAsset.hits) ? qc.unplantedAsset.hits.length : 0;
      const pm = qc.propMotifRhythm && Array.isArray(qc.propMotifRhythm.hits) ? qc.propMotifRhythm.hits.length : 0;
      if (!dangling && !unplant && !pm) return;
    // @module qc
      const fmt = (n) => (n === null ? '—' : String(n));
    // @module qc
      const cell = (label, val) => `<div class="diag-row"><span class="diag-k">${label}</span>${val}</div>`;
      assetRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em>`
        + cell(lang === 'en' ? 'Dangling foreshadow' : '悬空伏笔', fmt(dangling))
        + cell(lang === 'en' ? 'Unplanted asset' : '后手空降', fmt(unplant))
        + cell(lang === 'en' ? 'Prop-rhythm breaks' : '物象节奏断点', fmt(pm))
        + `</div>`);
    });
    // v2.132 修复闭环对比卡：闸门前 → 终稿六维总分对比（qcReport.fixLoop），AI味为润色师定向指标（越低越好）
    const FIXLOOP_DIMS = { character: ['人物', 'Character'], plot: ['剧情', 'Plot'], dialogue: ['台词', 'Dialogue'], market: ['市场', 'Market'], format: ['格式', 'Format'], deai: ['去AI化', 'De-AI'] };
    // @module qc
    const deltaTag = (before, after, lowerBetter) => {
      if (typeof before !== 'number' || typeof after !== 'number') return `<span class="muted">—</span>`;
      const d = after - before;
      const good = lowerBetter ? d < 0 : d > 0;
      const color = d === 0 ? 'var(--text-2)' : (good ? '#2e9e5b' : '#d64545');
      const sign = d > 0 ? '+' : '';
      return `<span style="color:${color};font-weight:600">${before} → ${after} <small>(${sign}${d})</small></span>`;
    };
    const fixRows = [];
    (eps || []).forEach((s) => {
    // @module qc
      const fl = (s.qcReport || {}).fixLoop;
      if (!fl || !fl.before || !fl.after) return;
      const dims = Object.keys(FIXLOOP_DIMS).map((k) => {
        const b = fl.before.dims ? fl.before.dims[k] : undefined;
        const a = fl.after.dims ? fl.after.dims[k] : undefined;
        return `<div class="diag-row"><span class="diag-k">${lang === 'en' ? FIXLOOP_DIMS[k][1] : FIXLOOP_DIMS[k][0]}</span>${deltaTag(b, a, false)}</div>`;
      }).join('');
      fixRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em>
        <div class="diag-row"><span class="diag-k">${lang === 'en' ? 'Overall' : '总评'}</span>${deltaTag(fl.before.total, fl.after.total, false)}</div>${dims}
        <div class="diag-row"><span class="diag-k">${lang === 'en' ? 'AI-taste (lower is better)' : 'AI味（越低越好）'}</span>${deltaTag(fl.aiTaste && fl.aiTaste.before, fl.aiTaste && fl.aiTaste.after, true)}</div></div>`);
    });
    // c209 集尾钩子卡（留存生死线）：cliffhanger 引擎是 issues 形态（无 hits），上面的通用 chips
    // 硬过滤 hits[] 会让它永远不可见；这里只挂“需要关注”的集（无钩/弱钩/<80/有问题/偏离规划），
    // 过硬的集只在副标题计数，避免长篇全绿噪音。
    const HOOK_TYPE_FALLBACK = {
      reversal: ['反转钩', 'Reversal'], crisis: ['危机钩', 'Crisis'], reveal: ['揭秘钩', 'Reveal'],
      mystery: ['悬念钩', 'Mystery'], emotional: ['情感钩', 'Emotional'], action_cut: ['动作钩', 'Action cut'],
      weak: ['弱钩', 'Weak'], none: ['无钩子', 'No hook'],
    };
    const hookRows = [];
    let hookStrong = 0;
    (eps || []).forEach((s) => {
    // @module qc
      const hk = (s.qcReport || {}).cliffhanger;
      if (!hk || typeof hk.score !== 'number') return;
      const issues = Array.isArray(hk.issues) ? hk.issues : [];
      const weakish = hk.type === 'none' || hk.type === 'weak' || hk.score < 80 || issues.length > 0 || hk.planAlignment === false;
      if (weakish) {
        const fb = HOOK_TYPE_FALLBACK[hk.type] || [hk.typeLabel || hk.type || '?', hk.typeLabel || hk.type || '?'];
        const typeName = hk.typeLabel ? hk.typeLabel : (lang === 'en' ? fb[1] : fb[0]);
        const cls = hk.score < 60 ? 'qc-bad' : 'qc-warn';
        const tips = issues.slice(0, 4).map((i) => i && (i.advice || i.evidence)).filter(Boolean);
        const tipParts = [];
        if (hk.planAlignment === false) tipParts.push(lang === 'en' ? 'Diverges from the planned cliffhanger' : '结尾偏离规划钩子');
        if (tips.length) tipParts.push(...tips);
        if (hk.endingSnippet) tipParts.push(`${lang === 'en' ? 'Ending: ' : '结尾：'}${String(hk.endingSnippet).replace(/\s+/g, ' ').slice(-80)}`);
        const title = `${typeName} · ${hk.score}${tipParts.length ? ` — ${tipParts.join(' / ')}` : ''}`;
        const misTag = hk.planAlignment === false
          ? ` <span class="qc-chip qc-warn">${lang === 'en' ? 'off-plan' : '偏离规划'}</span>` : '';
        hookRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em>`
          + `<div class="diag-row"><span class="diag-k">${lang === 'en' ? 'Episode-end hook' : '集尾钩子'}</span>`
          + `<span class="qc-chip ${cls}" title="${escapeHtml(title.slice(0, 400))}">${escapeHtml(typeName)} <b>${hk.score}</b></span>${misTag}</div></div>`);
      } else hookStrong += 1;
    });
    // c210 角色弧光卡：arcTrack 与 cliffhanger 同为 issues 形态（无 hits），通用 chips 卡同样不可见。
    // 只挂"需要关注"的集（停滞/跨极跳变/有 issues/<70 分），健康集只计数；兼容旧库仅 {characters,score} 的行。
    const ARC_EMO_LABEL = {
      anger: ['愤怒', 'Anger'], fear: ['恐惧', 'Fear'], hope: ['希望', 'Hope'], despair: ['绝望', 'Despair'],
      calm: ['平静', 'Calm'], joy: ['喜悦', 'Joy'], unknown: ['未知', '—'],
    };
    const ARC_STAGE_LABEL = {
      setup: ['铺垫', 'Setup'], conflict: ['对抗', 'Conflict'], crisis: ['危机', 'Crisis'],
      transformation: ['转变', 'Transform'], resolution: ['收束', 'Resolution'], unknown: ['—', '—'],
    };
    const arcRows = [];
    let arcHealthy = 0;
    (eps || []).forEach((s) => {
    // @module qc
      const at = (s.qcReport || {}).arcTrack;
      if (!at || typeof at.score !== 'number' || !Array.isArray(at.characters)) return;
      const stalled = Array.isArray(at.stalled) ? at.stalled : [];
      const jumps = Array.isArray(at.jumpCut) ? at.jumpCut : [];
      const issues = Array.isArray(at.issues) ? at.issues : [];
      if (!stalled.length && !jumps.length && !issues.length && at.score >= 70) { arcHealthy += 1; return; }
    // @module qc
      const emoL = (e) => { const p = ARC_EMO_LABEL[e]; return p ? (lang === 'en' ? p[1] : p[0]) : String(e || ''); };
      const chips = [];
      stalled.slice(0, 8).forEach((x) => {
        chips.push(`<span class="qc-chip qc-warn" title="${escapeHtml((lang === 'en' ? 'Arc stalled: ' : '弧光停滞：') + String(x.reason || '').slice(0, 200))}">${lang === 'en' ? 'Stalled ' : '停滞 '}${escapeHtml(x.name || '')}</span>`);
      });
      jumps.slice(0, 8).forEach((j) => {
        chips.push(`<span class="qc-chip qc-bad" title="${escapeHtml(String(j.reason || '').slice(0, 200))}">${lang === 'en' ? 'Jump ' : '跳变 '}${escapeHtml(j.name || '')} ${emoL(j.from)}→${emoL(j.to)}</span>`);
      });
      // 悬停总分标签时给出全局 issues 建议（与生成页 arcTrackTip 同数据源，落库后不丢）
      const issueTip = issues.map((i) => i && i.advice).filter(Boolean).slice(0, 4).join(' / ');
      const scoreChip = `<span class="qc-chip ${at.score < 60 ? 'qc-bad' : 'qc-warn'}" title="${escapeHtml(issueTip.slice(0, 400))}">${lang === 'en' ? 'Arc' : '弧光分'} <b>${at.score}</b></span>`;
      // 角色当前态速览（悬停看情绪/阶段），帮助判断停滞标签是否成立
      const charBits = at.characters.slice(0, 20).map((c) => {
        const ep = ARC_EMO_LABEL[c.emotion] ? (lang === 'en' ? ARC_EMO_LABEL[c.emotion][1] : ARC_EMO_LABEL[c.emotion][0]) : '';
        const sp = ARC_STAGE_LABEL[c.stage] ? (lang === 'en' ? ARC_STAGE_LABEL[c.stage][1] : ARC_STAGE_LABEL[c.stage][0]) : '';
        const tag = [ep, sp].filter(Boolean).join('/');
        return `<span class="muted" title="${escapeHtml(c.name || '')}">${escapeHtml((c.name || '') + (tag ? `:${tag}` : ''))}</span>`;
      }).join(lang === 'en' ? ' · ' : '、');
      arcRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em>`
        + `<div class="diag-row"><span class="diag-k">${lang === 'en' ? 'Character arc' : '角色弧光'}</span>${scoreChip}${chips.join('')}</div>`
        + (charBits ? `<div class="qc-sub" style="margin:2px 0 0">${charBits}</div>` : '')
        + `</div>`);
    });
    // c211 场景软收尾卡：sceneSoftEnding 虽有 hits 但旧落库 advice（字符串）被通用卡按数组丢弃、
    // issues 截断口径与 SSE 不一致；统一 digest 后由专用卡接管（同 hook/arc 范式），通用 chips 不再渲染它。
    // 只挂有泄气尾巴的集；过硬集只计数。兼容旧库（hits 缺省 []）。
    const softRows = [];
    let softHealthy = 0;
    (eps || []).forEach((s) => {
    // @module qc
      const sf = (s.qcReport || {}).sceneSoftEnding;
      if (!sf || typeof sf.score !== 'number') return;
      const hits = Array.isArray(sf.hits) ? sf.hits : [];
      const issues = Array.isArray(sf.issues) ? sf.issues : [];
      if (!hits.length && sf.score >= 100) { softHealthy += 1; return; }
      const advice = typeof sf.advice === 'string' ? sf.advice : '';
      const scoreChip = `<span class="qc-chip ${sf.score < 60 ? 'qc-bad' : 'qc-warn'}" title="${escapeHtml(advice.slice(0, 400))}">${lang === 'en' ? 'Soft ending' : '软收尾'} <b>${sf.score}</b></span>`;
      const chips = hits.slice(0, 8).map((h) => {
        const where = `${h.sceneHeader || (lang === 'en' ? 'scene' : '某场')}${h.endLine ? ` · L${h.endLine}` : ''}`;
        const tip = [h.ending ? `${lang === 'en' ? 'Tail: ' : '尾句：'}${String(h.ending).replace(/\s+/g, ' ')}` : '', h.reason || '', advice].filter(Boolean).join(' / ');
        return `<span class="qc-chip qc-warn" title="${escapeHtml(tip.slice(0, 400))}">${escapeHtml(where)}</span>`;
      });
      const issueBit = issues.length ? `<div class="qc-sub" style="margin:2px 0 0">${escapeHtml(issues.slice(0, 3).join(' / ').slice(0, 300))}</div>` : '';
      softRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em>`
        + `<div class="diag-row"><span class="diag-k">${lang === 'en' ? 'Scene ending' : '场景收尾'}</span>${scoreChip}${chips.join('')}</div>`
        + issueBit + `</div>`);
    });
    // c211 展示而非叙述卡：showDontTell 是 issues 形态（无顶层 hits，四类命中只留计数），
    // 旧通用 chips 按 hits 硬过滤使它生成后从未在面板出现。severity high 红、mid/low 黄。
    const SDT_TYPE_LABEL = {
      tell_emotion: ['直说情绪', 'Telling emotion'],
      summary_not_scene: ['总结代戏', 'Summary not scene'],
      abstract_adj: ['抽象形容', 'Abstract adjectives'],
      inner_monologue: ['内心独白', 'Inner monologue'],
      long_prose_no_action: ['叙述墙', 'Prose wall, no action'],
    };
    const sdtRows = [];
    let sdtHealthy = 0;
    (eps || []).forEach((s) => {
    // @module qc
      const sd = (s.qcReport || {}).showDontTell;
      if (!sd || typeof sd.score !== 'number') return;
      const issues = Array.isArray(sd.issues) ? sd.issues : [];
      // 兼容旧库：c211 前的扁平计数字段
      const counts = sd.counts || {
        tellEmotion: sd.tellEmotionCount ?? 0, summary: sd.summaryCount ?? 0,
        abstractAdj: sd.abstractAdjCount ?? 0, innerMonologue: sd.innerMonologueCount ?? 0,
      };
      if (!issues.length && sd.score >= 100) { sdtHealthy += 1; return; }
      const chips = issues.slice(0, 6).map((i) => {
        const pair = SDT_TYPE_LABEL[i.type];
        const name = pair ? (lang === 'en' ? pair[1] : pair[0]) : humanizeEngineKey(String(i.type || ''));
        const cls = i.severity === 'high' ? 'qc-bad' : 'qc-warn';
        const tip = [i.evidence ? `${lang === 'en' ? 'Evidence: ' : '原文：'}${String(i.evidence).replace(/\s+/g, ' ')}` : '', i.advice || ''].filter(Boolean).join(' / ');
        return `<span class="qc-chip ${cls}" title="${escapeHtml(tip.slice(0, 400))}">${escapeHtml(name)}</span>`;
      });
    // @module qc
      const c = (n, z, e) => (n ? `${z}${n}${e}` : '');
      const tally = lang === 'en'
        ? [c(counts.tellEmotion, 'tell ', ''), c(counts.summary, 'summary ', ''), c(counts.abstractAdj, 'adj ', ''), c(counts.innerMonologue, 'inner ', '')].filter(Boolean).join(' · ')
        : [c(counts.tellEmotion, '直说', '处'), c(counts.summary, '总结', '处'), c(counts.abstractAdj, '抽象', '处'), c(counts.innerMonologue, '独白', '处')].filter(Boolean).join(' · ');
      const tallyBit = tally ? ` <span class="muted">${escapeHtml(tally)}</span>` : '';
      sdtRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em>`
        + `<div class="diag-row"><span class="diag-k">${lang === 'en' ? 'Show, don’t tell' : '展示而非叙述'}</span>`
        + `<span class="qc-chip ${sd.score < 60 ? 'qc-bad' : 'qc-warn'}">${lang === 'en' ? 'Score' : '影视化'} <b>${sd.score}</b></span>${tallyBit}${chips.join('')}</div></div>`);
    });
    // c212 结构维度体检卡：v2.114-v2.147 共 32 个结构引擎，SSE 全量发送但旧 digest 硬要求非空 hits[]，
    // 其中 25 键（score+issues 形态）生成后从不落库、刷新即失明，/fix 也不重算。c212 后：
    // ① 批量落库 buildQcEngineDigest 双路径收录；② /fix 按新正文统一重扫 32 键（健康空壳清旧账）；
    // ③ 本卡统一渲染：hits 形态七键（爽点/水分/冲突/金句/反转/重复/信息密度）仍归上方通用创作卡，
    // 不重复渲染；/fix 重扫后七键切到 issues 形态，自然转入本卡，信息不减（evidence/advice 随悬停可见）。
    const STRUCT_DIM_LABELS = {
      coolMoment: ['爽点密度', 'Payoff density'], dialogueWater: ['台词水分', 'Dialogue water'],
      conflictDensity: ['冲突密度', 'Conflict density'], punchlineDensity: ['金句密度', 'Punchline density'],
      sceneDensity: ['场景密度节奏', 'Scene pacing'], repetition: ['重复感', 'Repetition'],
      characterBalance: ['戏份均衡', 'Screen-time balance'], twistDensity: ['反转密度', 'Twist density'],
      dialogueLength: ['对白长度速度', 'Dialogue length'], informationDensity: ['信息密度', 'Information density'],
      suspenseTension: ['悬念张力曲线', 'Tension curve'], sceneHeader: ['场景标题规范', 'Scene headers'],
      dialogueFunction: ['对白功能性', 'Dialogue function'], causalLogic: ['因果逻辑链', 'Causal logic'],
      protagonistGoal: ['主角目标行动链', 'Protagonist goal'], antagonistQuality: ['反派质量', 'Antagonist quality'],
      relationship: ['情感关系递进', 'Relationship progression'], scenePadding: ['场景注水空转', 'Scene padding'],
      supporting: ['配角工具人', 'Supporting cast'], conflictEscalation: ['冲突升级阶梯', 'Conflict escalation'],
      subtext: ['台词潜台词', 'Subtext'], supportingArc: ['配角弧光', 'Supporting arcs'],
      scenePurpose: ['场景目的效率', 'Scene purpose'], continuity: ['场记连续性', 'Continuity'],
      misunderstanding: ['误会拖延', 'Misunderstanding drag'], plotArmor: ['降智与主角光环', 'Plot armor'],
      evidenceChain: ['翻盘证据链', 'Evidence chain'], cheatRule: ['金手指规则一致', 'Cheat-rule consistency'],
      memoryFakeout: ['闪回梦境公平', 'Memory fakeout'], emotionalAftermath: ['情绪余波', 'Emotional aftermath'],
      locationContinuity: ['空间位移连续性', 'Location continuity'], characterPresence: ['角色在场感', 'Character presence'],
    };
    const STRUCT_KEYS = Object.keys(STRUCT_DIM_LABELS);
    const STRUCT_OWNED = new Set(['sceneSoftEnding', 'showDontTell', 'cliffhanger', 'arcTrack']);
    // c216+c217 跨集连续性台账：30 本无 score 的长名诊断账（c216 六键掉钩/欠账/干旱/疲劳/空转 +
    // c217 二十四键信物/死亡/下场/伤势/境界/关系/阵营等硬穿帮）。旧版通用卡硬要求 numeric score，
    // 这些键在 SSE/落库/fix 三点齐全后前端仍整体失明。本卡按 issueCount/issues 渲染，
    // level=high 或存在 high severity issue 着红，健康（issueCount=0）不显示。
    const LEDGER_DIM_LABELS = {
      hookPayoff: ['钩子兑付台账', 'Hook payoff ledger'], humiliationDebt: ['屈辱打脸欠账', 'Humiliation debt'],
      mysteryDrought: ['悬念干旱', 'Mystery drought'], hookFatigue: ['钩型疲劳', 'Hook fatigue'],
      promiseDrought: ['承诺兑付欠账', 'Promise drought'], villainThreat: ['反派威胁空转', 'Villain threat'],
      propLedger: ['信物台账', 'Prop ledger'], timelineLedger: ['时间线跨度', 'Timeline span'],
      costLedger: ['连胜代价', 'Winning cost'], deathLedger: ['死亡穿帮', 'Death continuity'],
      villainFate: ['反派下场', 'Villain fate'], woundRecovery: ['伤势恢复', 'Wound recovery'],
      powerProgress: ['境界进阶', 'Power progression'], itemOwnership: ['物品归属', 'Item ownership'],
      relLedger: ['关系裂痕', 'Relationship rifts'], affLedger: ['阵营离队', 'Affiliation exits'],
      locLedger: ['地点滞留', 'Stranded characters'], leakLedger: ['泄密知情', 'Secret leaks'],
      disguiseLedger: ['伪装身份', 'Disguise ledger'], debtLedger: ['人情债', 'Favor debts'],
      allianceLedger: ['联盟盟约', 'Alliances'], memoryLedger: ['失忆账', 'Amnesia'],
      impersonationLedger: ['冒充身份', 'Impersonation'], betrayalLedger: ['背叛背刺', 'Betrayal'],
      sacrificeLedger: ['牺牲恩义', 'Sacrifice debts'], curseLedger: ['诅咒账', 'Curses'],
      possessionLedger: ['附身账', 'Possession'], timeTravelLedger: ['穿越往返', 'Time travel'],
      transformationLedger: ['变身恢复', 'Transformation'], poisonLedger: ['中毒解毒', 'Poisoning'],
    };
    const LEDGER_KEYS = Object.keys(LEDGER_DIM_LABELS);
    // c218 QC 闸门四键：cliche/tongue/grounded/lengthPlan 无顶层 score（digest 见 gate-engine-rescan.ts），
    // 通用卡与 extras 卡都硬要求 numeric score，四键此前整体失明。本卡按 issueCount 驱动渲染：
    // pass===false / ready===false / groundedScore<60 着红，健康（无计数且无失败态）不显示。
    const GATE_DIM_LABELS = {
      cliche: QC_ENGINE_LABELS.cliche, tongue: QC_ENGINE_LABELS.tongue,
      grounded: QC_ENGINE_LABELS.grounded, lengthPlan: QC_ENGINE_LABELS.lengthPlan,
    };
    const GATE_KEYS = Object.keys(GATE_DIM_LABELS);
    // @module qc
    const dimChip = (k, v, issues, pair, ep) => {
      const name = pair ? (lang === 'en' ? pair[1] : pair[0]) : humanizeEngineKey(k);
      const hasHigh = issues.some((i) => i && i.severity === 'high');
      const cls = hasHigh || v.score < 60 ? 'qc-bad' : 'qc-warn';
      const tip = issues.slice(0, 3).map((i) => {
        const t = i && typeof i.type === 'string' && i.type ? `${i.type}: ` : '';
        const ev = i && typeof i.evidence === 'string' ? i.evidence.replace(/\s+/g, ' ') : '';
        const ad = i && typeof i.advice === 'string' ? i.advice : '';
        return [t + ev, ad].filter(Boolean).join(' → ');
      }).filter(Boolean).join(' / ');
      const gate = typeof v.gate === 'string' && v.gate ? ` · ${v.gate}` : '';
      return `<span class="qc-chip qc-chip-fix ${cls}"${qcFixAttrs(ep, k, name, tip || name)} title="${escapeHtml((name + gate + (tip ? ` — ${tip}` : '') + (lang === 'en' ? ' · Click to have Xiaonan rewrite this' : ' · 点击让小南针对性改写')).slice(0, 400))}">${escapeHtml(name)} <b>${v.score}</b></span>`;
    };
    const structRows = [];
    const extraRows = [];
    const ledgerRows = [];
    const gateRows = [];
    let structHealthy = 0;
    (eps || []).forEach((s) => {
      const qc = s.qcReport || {};
      const dims = [];
      let presentHealthy = 0;
      STRUCT_KEYS.forEach((k) => {
        const v = qc[k];
        if (!v || typeof v !== 'object' || typeof v.score !== 'number' || Array.isArray(v.hits)) return;
        const issues = Array.isArray(v.issues) ? v.issues.filter((i) => i && typeof i === 'object') : [];
        const count = typeof v.issueCount === 'number' ? v.issueCount : issues.length;
        if (!count) { if (v.score >= 100) presentHealthy++; return; }
        dims.push(dimChip(k, v, issues.slice(0, 3), STRUCT_DIM_LABELS[k], s.epNo));
      });
      if (dims.length) {
        structRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em><div class="qc-chips">${dims.join('')}</div></div>`);
      } else if (presentHealthy) structHealthy += 1;
      // 同族兜底：voicePrint/dialogueAiTaste 等 issues-only 创作引擎（无顶层 hits、无专用卡），
      // 有词条用词条、无词条英文 humanize；新增引擎落库即自动可见，不再逐族补卡。
      const extras = [];
      Object.keys(qc).forEach((k) => {
        if (STRUCT_KEYS.includes(k) || STRUCT_OWNED.has(k) || LEDGER_KEYS.includes(k)) return;
        const v = qc[k];
        if (!v || typeof v !== 'object' || typeof v.score !== 'number' || Array.isArray(v.hits)) return;
        const issues = Array.isArray(v.issues) ? v.issues.filter((i) => i && typeof i === 'object') : [];
        if (!issues.length) return;
        extras.push(dimChip(k, v, issues.slice(0, 3), QC_ENGINE_LABELS[k], s.epNo));
      });
      if (extras.length) {
        extraRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em><div class="qc-chips">${extras.join('')}</div></div>`);
      }
      // c216+c217 跨集台账 30 键：无 score，按 issueCount/issues 收集；
      // villainFate 与短名 rows 摘要行合流共存（rows 供下一集 prev，诊断供本卡渲染）
      const ledgerChips = [];
      LEDGER_KEYS.forEach((k) => {
        const v = qc[k];
        if (!v || typeof v !== 'object') return;
        const issues = Array.isArray(v.issues) ? v.issues.filter((i) => i && typeof i === 'object') : [];
        const count = typeof v.issueCount === 'number' ? v.issueCount : issues.length;
        if (!count) return;
        const pair = LEDGER_DIM_LABELS[k];
        const name = pair ? (lang === 'en' ? pair[1] : pair[0]) : humanizeEngineKey(k);
        const hasHigh = issues.some((i) => i.severity === 'high') || v.level === 'high';
        const tip = issues.slice(0, 3).map((i) => {
          const t = i && typeof i.type === 'string' && i.type ? `${i.type}: ` : '';
          const ev = i && typeof i.evidence === 'string' ? i.evidence.replace(/\s+/g, ' ') : '';
          const ad = i && typeof i.advice === 'string' ? i.advice : '';
          return [t + ev, ad].filter(Boolean).join(' → ');
        }).filter(Boolean).join(' / ');
        ledgerChips.push(`<span class="qc-chip ${hasHigh ? 'qc-bad' : 'qc-warn'}" title="${escapeHtml((name + (tip ? ` — ${tip}` : '')).slice(0, 400))}">${escapeHtml(name)} <b>${count}</b></span>`);
      });
      if (ledgerChips.length) {
        ledgerRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em><div class="qc-chips">${ledgerChips.join('')}</div></div>`);
      }
      // c218 闸门四键收集：无 score，issueCount 驱动；lengthPlan 额外带 当前/目标字数 后缀
      const gateChips = [];
      GATE_KEYS.forEach((k) => {
        const v = qc[k];
        if (!v || typeof v !== 'object') return;
        const count = typeof v.issueCount === 'number' ? v.issueCount : 0;
        const failing = v.pass === false || v.ready === false || (typeof v.groundedScore === 'number' && v.groundedScore < 60);
        if (!count && !failing) return;
        const pair = GATE_DIM_LABELS[k];
        const name = pair ? (lang === 'en' ? pair[1] : pair[0]) : humanizeEngineKey(k);
        const cls = failing ? 'qc-bad' : 'qc-warn';
        let tip = '';
        let suffix = '';
        if (k === 'cliche' || k === 'tongue') {
          const hits = Array.isArray(v.hits) ? v.hits : [];
          tip = hits.slice(0, 3).map((h) => {
            if (!h || typeof h !== 'object') return '';
            const a = typeof h.found === 'string' ? h.found : (typeof h.word === 'string' ? h.word : '');
            const b = typeof h.alt === 'string' ? h.alt : (typeof h.fix === 'string' ? h.fix : '');
            return [a, b].filter(Boolean).join(' → ');
          }).filter(Boolean).join(' / ');
        } else if (k === 'grounded') {
          const abs = Array.isArray(v.abstractHits) ? v.abstractHits.slice(0, 3).join('、') : '';
          const sug = Array.isArray(v.suggestions) && v.suggestions.length ? String(v.suggestions[0]) : '';
          tip = [abs, sug].filter(Boolean).join(' → ');
        } else if (k === 'lengthPlan') {
          const range = Array.isArray(v.range) ? `${v.range[0]}-${v.range[1]}` : '';
          const state = v.status === 'under' ? (lang === 'en' ? 'under length' : '字数不足') : (lang === 'en' ? 'over length' : '字数超标');
          tip = `${state} · ${v.current}${lang === 'en' ? ' chars / target ' : '字 / 目标'}${v.target}${range ? `（${range}）` : ''}`;
          suffix = ` ${v.current}/${v.target}${lang === 'en' ? 'ch' : '字'}`;
        }
        gateChips.push(`<span class="qc-chip qc-chip-fix ${cls}"${qcFixAttrs(s.epNo, k, name, tip || name)} title="${escapeHtml((name + (tip ? ` — ${tip}` : '') + (lang === 'en' ? ' · Click to have Xiaonan rewrite this' : ' · 点击让小南针对性改写')).slice(0, 400))}">${escapeHtml(name)} <b>${count || '!'}</b>${escapeHtml(suffix)}</span>`);
      });
      if (gateChips.length) {
        gateRows.push(`<div class="qc-ep"><em>EP${s.epNo} · ${escapeHtml(s.title || '')}</em><div class="qc-chips">${gateChips.join('')}</div></div>`);
      }
    });
    if (!rows.length && !fixRows.length && !assetRows.length && !hookRows.length && !arcRows.length && !softRows.length && !sdtRows.length && !structRows.length && !extraRows.length && !ledgerRows.length && !gateRows.length) return '';
    const head = lang === 'en' ? `Writing QC · ${total} finding(s)` : `创作质检 · ${total} 处提示`;
    const sub = lang === 'en' ? 'Per-episode creative-engine findings at generation time (hover a chip for issue & advice)' : '逐集创作引擎质检结果（悬停标签查看问题与修改建议）';
    const fixHead = lang === 'en' ? 'Repair loop · pre-gate → final' : '修复闭环 · 闸门前 → 终稿';
    const fixSub = lang === 'en' ? 'Six-dimension scores before vs. after gate rewrites; AI-taste tracks the polisher effect (lower is better).' : '闸门打回重写前后的六维对比；AI味为润色师定向指标（越低越好）。';
    const hookHead = lang === 'en' ? 'Episode-end hooks · the retention line' : '集尾钩子 · 留存生死线';
    const hookSub = lang === 'en'
      ? `${hookRows.length} ep need hook work; ${hookStrong} ep are hook-strong. No-hook / weak-hook endings are the #1 reason viewers drop before paying (hover for the fix).`
      : `${hookRows.length} 集钩子待加强，${hookStrong} 集钩子过硬。无钩/弱钩收尾是用户付费追更前流失的头号原因（悬停看改法）。`;
    const arcHead = lang === 'en' ? 'Character arcs · emotion continuity' : '角色弧光 · 情绪连续性';
    const arcSub = lang === 'en'
      ? `${arcRows.length} ep need arc work; ${arcHealthy} ep are arc-healthy. Stalled characters feel flat; polarity jumps (joy→despair with no bridge) feel fake (hover for the fix).`
      : `${arcRows.length} 集弧光待修，${arcHealthy} 集弧光健康。角色停滞显平、跨极硬切（如喜悦直落绝望无缓冲）显假（悬停看改法）。`;
    const softHead = lang === 'en' ? 'Scene endings · hard-cut on tension' : '场景收尾 · 张力硬切';
    const softSub = lang === 'en'
      ? `${softRows.length} ep have sigh-out / walk-away tails; ${softHealthy} ep hard-cut clean. A soft exhale after every argument trains viewers to leave before the pay point (hover for the fix).`
      : `${softRows.length} 集存在泄气/离场式尾巴，${softHealthy} 集硬切干净。每次冲突后都松一口气，观众会在付费点前被训练得随时能走（悬停看改法）。`;
    const sdtHead = lang === 'en' ? 'Show, don’t tell · screen vs. prose' : '展示而非叙述 · 影视化程度';
    const sdtSub = lang === 'en'
      ? `${sdtRows.length} ep tell instead of showing; ${sdtHealthy} ep are screen-healthy. Named emotions, summary verbs and adjective labels read like a novel — the camera can’t film “she felt sad” (hover for the rewrite).`
      : `${sdtRows.length} 集存在直说/概述，${sdtHealthy} 集影视化达标。点名情绪、总结动词、抽象形容是小说写法，摄影机拍不出"她很难过"（悬停看改法）。`;
    const structHead = lang === 'en' ? 'Structure dimensions · 32 craft checks' : '结构维度体检 · 32 维';
    const structSub = lang === 'en'
      ? `${structRows.length} ep fail structural checks (causality, density, escalation, continuity…); ${structHealthy} ep clean across all scored dimensions. Scores are recomputed after every /fix rewrite — old findings never linger (hover for evidence & fix).`
      : `${structRows.length} 集存在结构问题（因果/密度/升级/连续性等 32 维），${structHealthy} 集已扫维度全部达标。每次 /fix 改写后按新正文重算，修好了的问题不再挂旧账（悬停看证据与改法）。`;
    const extraHead = lang === 'en' ? 'Other engine findings' : '其他创作引擎提示';
    const extraSub = lang === 'en' ? 'Issues-only engines without a dedicated card (voice print, AI taste…); auto-surfaced as soon as persisted.' : 'issues 形态、尚无专用卡的创作引擎（声纹/AI 味等）；落库即自动可见。';
    const ledgerHead = lang === 'en' ? 'Cross-episode continuity ledgers · 30 books' : '跨集连续性台账 · 30 本账';
    const ledgerSub = lang === 'en'
      ? `${ledgerRows.length} ep carry continuity debt: banned props returning, dead characters reviving, unresolved villain fates, instant wound/power recovery, unpaid favors, leaked secrets… Recomputed on every /fix rewrite; healthy books stay hidden (hover for evidence & fix).`
      : `${ledgerRows.length} 集挂着跨集旧账：封禁信物再现、死者复活、反派下场无后文、伤势/境界秒恢复、人情债不还、泄密无追查等 30 类硬穿帮。每次 /fix 改写后按新正文重算，健康的账不显示（悬停看证据与改法）。`;
    const gateHead = lang === 'en' ? 'QC gates · anti-cliché / colloquial / grounded / length' : 'QC 闸门 · 反套路/口语化/落地感/字数';
    const gateSub = lang === 'en'
      ? `${gateRows.length} ep tripped a hard gate: clichéd beats, written-style dialogue, abstract prose, or length out of range. These gates can force rewrites during generation and are re-run on every /fix (hover for evidence & fix).`
      : `${gateRows.length} 集触发硬闸门：套路桥段、台词书卷气、抽象不落地或字数越界。闸门在生成期可强制重写，每次 /fix 改写后按新正文重算（悬停看证据与改法）。`;
    return `<div class="diag-qc"><div class="diag-fix-head">${head}</div><div class="qc-sub">${sub}</div>${rows.join('')}`
      + (hookRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${hookHead}</div><div class="qc-sub">${hookSub}</div>${hookRows.join('')}` : '')
      + (arcRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${arcHead}</div><div class="qc-sub">${arcSub}</div>${arcRows.join('')}` : '')
      + (softRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${softHead}</div><div class="qc-sub">${softSub}</div>${softRows.join('')}` : '')
      + (sdtRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${sdtHead}</div><div class="qc-sub">${sdtSub}</div>${sdtRows.join('')}` : '')
      + (structRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${structHead}</div><div class="qc-sub">${structSub}</div>${structRows.join('')}` : '')
      + (ledgerRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${ledgerHead}</div><div class="qc-sub">${ledgerSub}</div>${ledgerRows.join('')}` : '')
      + (gateRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${gateHead}</div><div class="qc-sub">${gateSub}</div>${gateRows.join('')}` : '')
      + (extraRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${extraHead}</div><div class="qc-sub">${extraSub}</div>${extraRows.join('')}` : '')
      + (fixRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${fixHead}</div><div class="qc-sub">${fixSub}</div>${fixRows.join('')}` : '')
      + (assetRows.length ? `<div class="diag-fix-head" style="margin-top:14px">${lang === 'en' ? 'Asset ledger · Chekhov family' : '资产总览 · 契诃夫之枪家族'}</div><div class="qc-sub">${lang === 'en' ? 'Cross-episode foreshadow ledger / unplanted assets / single-episode prop-rhythm breaks — one prop, one narrative debt.' : '跨集伏笔账本 / 后手空降 / 单稿物象节奏断点——同一件道具的叙事债，三表并看。'}</div>${assetRows.join('')}` : '')
      + `</div>`;
  }
  function renderDiagnosis(d) {
    const sc = d.scorecard || {};
    $('diagTotal').textContent = sc.total ?? '—';
    $('diagTotal').style.color = diagColor(sc.total || 0);
    $('diagLevel').textContent = levelTag(sc.level || '');
    $('diagSub').textContent = lang === 'en'
      ? `${d.counts.episodeCount} ep · craft ${d.engineAvg.craft} / emotion ${d.engineAvg.emotion} / structure ${d.engineAvg.webnovel}`
      : `共${d.counts.episodeCount}集 · 基础${d.engineAvg.craft} 情绪${d.engineAvg.emotion} 结构${d.engineAvg.webnovel}`;
    const { bars, fixHtml } = buildDiagnosisHtml(d);
    $('diagBars').innerHTML = bars;
    $('diagFixes').innerHTML = fixHtml;
    const note = $('diagNote');
    if (d.marketEstimated) {
      note.classList.remove('hidden');
      note.textContent = lang === 'en' ? '* Market score is estimated from text; it becomes precise after a market-agent run.' : '* 市场维度为文本估算，跑过市场分析岗后会替换为精准分。';
    } else note.classList.add('hidden');
  }
  // ═══ MODULE: misc (49行, 1fn) ═══ 资方视角投稿前体检（免费·本地确定性评估）
  /* ---------- 资方视角投稿前体检（免费·本地确定性评估） ---------- */
  const INV_DIM_EN = { track: 'Track certainty', recoup: 'Cost & recoup', marketability: 'Ad-marketability', content: 'Content baseline' };
  const INV_VERDICT_EN = { STRONG: 'Strong: pitch it', TALK: 'Worth talking after fixes', CAUTION: 'Caution: build certainty first', PASS: 'Hold: hard veto to clear' };
  async function loadInvestorLens(projectId) {
    const panel = $('investorPanel'); if (!panel || !projectId) return;
    const account = capturePrivateSession();
    $('invBars').innerHTML = `<div class="diag-loading">${lang === 'en' ? 'Assessing through a funder’s eyes…' : '正在用资方视角评估赛道/成本/投流…'}</div>`;
    panel.classList.remove('hidden');
    // 自取全本正文，避免与正文渲染抢时序
    let text = '';
    try {
      const r = await Api.request(`/api/generate/projects/${projectId}/scripts`);
      const eps = await Api.jsonOrThrow(r);
      if (!isPrivateSessionCurrent(account)) return;
      text = eps.map((s) => `第${s.epNo}集 ${s.title || ''}\n${s.content || ''}`).join('\n\n');
    } catch { if (!isPrivateSessionCurrent(account)) return; text = resultText(); }
    if (!isPrivateSessionCurrent(account)) return;
    // @module misc
    const tags = (typeof tagChosen !== 'undefined' && Array.isArray(tagChosen)) ? tagChosen : [];
    try {
      const res = await Api.request('/api/market/investor-lens', { method: 'POST', body: JSON.stringify({ text: text.slice(0, 6000), tags }) });
      const d = await Api.jsonOrThrow(res);
      if (!isPrivateSessionCurrent(account) || (currentProjectId && currentProjectId !== projectId)) return;
      renderInvestorLens(d);
      // 体检后串联：按所选标签推荐适配投稿渠道（商业闭环最后一公里）
      loadSubmissionMatch(tags);
    } catch { if (isPrivateSessionCurrent(account)) panel.classList.add('hidden'); }
  }
  function renderInvestorLens(d) {
    const vCls = { STRONG: 'inv-strong', TALK: 'inv-talk', CAUTION: 'inv-caution', PASS: 'inv-pass' }[d.verdict] || 'inv-talk';
    const vText = lang === 'en' ? (INV_VERDICT_EN[d.verdict] || d.verdict) : d.verdictLabel;
    const verdict = $('invVerdict'); verdict.className = 'investor-verdict ' + vCls;
    verdict.innerHTML = `<b>${escapeHtml(d.overall)}</b><span>${escapeHtml(vText)}</span><small>${escapeHtml(d.oneLiner || '')}</small>`;
    $('invBars').innerHTML = (d.dimensions || []).map((g) => {
      const lab = lang === 'en' ? (INV_DIM_EN[g.id] || g.name) : g.name;
      const rank = g.rank === 4 ? (lang === 'en' ? 'baseline' : '门槛') : '#' + g.rank;
      return `<div class="diag-row"><span class="diag-k">${lab}<em class="inv-rank">${rank}</em></span>
        <span class="diag-track"><i style="width:${g.score}%;background:${diagColor(g.score)}"></i></span>
        <b class="diag-v" style="color:${diagColor(g.score)}">${g.score}</b></div>`;
    }).join('');
    const veto = $('invVeto');
    if ((d.vetoes || []).length) { veto.classList.remove('hidden'); veto.innerHTML = (lang === 'en' ? 'Hard vetoes: ' : '⚠ 一票否决项：') + d.vetoes.map((x) => `<div>· ${escapeHtml(x)}</div>`).join(''); }
    else veto.classList.add('hidden');
    $('invTips').innerHTML = (d.pitchTips || []).map((x) => `<div class="inv-tip">${escapeHtml(x)}</div>`).join('');
    $('invQList').innerHTML = (d.funderQuestions || []).map((x, i) => `<div class="inv-q">${i + 1}. ${escapeHtml(x)}</div>`).join('');
    $('invPremise').textContent = d.premise || '';
  }
  const invRefreshBtn = $('invRefreshBtn');
  if (invRefreshBtn) invRefreshBtn.onclick = () => { if (currentProjectId) loadInvestorLens(currentProjectId); };

  // ═══ MODULE: tags (79行, 2fn) ═══ 投稿渠道推荐（按标签匹配适配平台，商业闭环）
  /* ---------- 投稿渠道推荐（按标签匹配适配平台，商业闭环） ---------- */
  async function loadSubmissionMatch(tags) {
    const panel = $('submissionPanel'); if (!panel) return;
    if (!tags || !tags.length) { panel.classList.add('hidden'); return; }
    const seq = ++subMatchSeq; // v2.258：投资人体检串联触发，连跑两个项目时旧匹配作废
    try {
      const r = await Api.request('/api/submission/match?tags=' + encodeURIComponent(tags.join(',')) + '&count=6');
      const d = await Api.jsonOrThrow(r);
      if (seq !== subMatchSeq) return;
      renderSubmission(d.matches);
      panel.classList.remove('hidden');
    } catch { if (seq !== subMatchSeq) return; panel.classList.add('hidden'); }
  }
  function renderSubmission(matches) {
    const list = $('submissionList'); if (!list) return;
    list.innerHTML = matches.map((c) => {
      const verifiedBadge = c.verified
        ? `<span class="chip" style="background:#e8f5e9;color:#2e7d32">${lang === 'en' ? 'Verified' : '联系方式已核验'}</span>`
        : `<span class="chip" style="background:#fff3e0;color:#e65100">${lang === 'en' ? 'Contact pending' : '联系方式待核验'}</span>`;
    // @module tags
      const kinds = (c.kinds || []).join('·');
    // @module tags
      const matched = (c.matched || []).map((t) => `<span class="chip" style="font-size:11px">${escapeHtml(t)}</span>`).join('');
      return `<div class="sub-card">
        <div class="sub-head"><b>${escapeHtml(c.name)}</b><span class="muted">${escapeHtml(c.region === 'overseas' ? (lang === 'en' ? 'Overseas' : '海外') : (lang === 'en' ? 'Domestic' : '国内'))}</span>${verifiedBadge}</div>
        <div class="sub-meta"><span>${escapeHtml(kinds)}</span>${matched}</div>
        ${c.highlight ? `<div class="sub-hl">${escapeHtml(c.highlight)}</div>` : ''}
      </div>`;
    }).join('');
    const notice = $('submissionNotice');
    if (notice) notice.textContent = lang === 'en'
      ? 'Tip: platforms with pending contacts are listed for reference only; verify official entry before submitting.'
      : '提示：标"待核验"的渠道仅作题材适配参考，投稿前请务必到官方入口核验对接方式，勿轻信第三方。';
  }
  /* v2.219 全量投稿渠道展示：GET /api/submission/channels 此前无前端入口，按需懒加载展开
     v2.232 文案收口 syncSubAllLabel：按钮不再挂 data-i（展开态文案是多段 t() 拼接，静态 data-i
     绑定会在语言切换时把它洗回「查看全部」而列表仍展开）；展开态计数入 subAllCache，切语言后可复原 */
  const subAllBtn = $('subAllBtn');
  let subAllCache = null;
  let subMatchSeq = 0; // v2.258：投稿匹配请求序号，连跑两次体检旧匹配结果不得覆盖新结果
  function syncSubAllLabel() {
    if (!subAllBtn) return;
    const box = $('submissionAllList');
    if (!box || box.classList.contains('hidden')) { subAllBtn.textContent = t('subShowAll'); return; }
    subAllBtn.textContent = subAllCache
      ? `${t('subHideAll')}（${subAllCache.channels} ${t('subAllCount')} · ${subAllCache.unv} ${t('subUnverifiedN')}）`
      : t('subShowAll');
  }
  if (subAllBtn) subAllBtn.onclick = async () => {
    const box = $('submissionAllList');
    if (!box.classList.contains('hidden')) {
      box.classList.add('hidden');
      syncSubAllLabel();
      return;
    }
    try {
      const r = await Api.request('/api/submission/channels');
      const d = await Api.jsonOrThrow(r);
      const channels = d.channels || [];
      box.innerHTML = channels.map((c) => {
        const verifiedBadge = c.verified
          ? `<span class="chip" style="background:#e8f5e9;color:#2e7d32">${lang === 'en' ? 'Verified' : '已核验'}</span>`
          : `<span class="chip" style="background:#fff3e0;color:#e65100">${lang === 'en' ? 'Contact pending' : '待核验'}</span>`;
        return `<div class="sub-card">
          <div class="sub-head"><b>${escapeHtml(c.name)}</b><span class="muted">${escapeHtml(c.region === 'overseas' ? (lang === 'en' ? 'Overseas' : '海外') : (lang === 'en' ? 'Domestic' : '国内'))}</span>${verifiedBadge}</div>
          <div class="sub-meta"><span>${escapeHtml((c.kinds || []).join('·'))}</span></div>
          ${c.highlight ? `<div class="sub-hl">${escapeHtml(c.highlight)}</div>` : ''}
        </div>`;
      }).join('') || znEmptyHtml(lang === 'en' ? 'No channels.' : '暂无渠道数据');
      box.classList.remove('hidden');
      const unv = d.unverified ?? channels.filter((c) => !c.verified).length;
      subAllCache = { channels: channels.length, unv };
      syncSubAllLabel();
    } catch (e) { xnSay(e.message); }
  };

  function showFail(msg, refunded) {
    $('progressPanel').classList.add('hidden'); $('failPanel').classList.remove('hidden');
    $('failText').textContent = (refunded ? (lang === 'en' ? 'Failed and refunded: ' : '已失败并退回积分：') : '') + translateProgressState(msg);
  }

  // ═══ MODULE: misc (17行, 2fn) ═══ 结果操作
  /* ---------- 结果操作 ---------- */
    // @module misc
  const resultText = () => $('scriptText').textContent || '';
  $('copyBtn').onclick = () => copy(resultText());
  $('listenBtn').onclick = () => {
    if (!Api.isAuthed()) { xnSay(lang === 'en' ? 'Please sign in first.' : '先登录再听剧本哦～'); openAuth('login'); return; }
    if (!currentScripts.length) { xnSay(lang === 'en' ? 'Generate an episode first.' : '请先生成剧本再听～'); return; }
    // 默认取最新一集
    const latest = currentScripts.reduce((a, b) => (b.epNo >= a.epNo ? b : a), currentScripts[0]);
    openListen(latest.id);
  };
  $('shareBtn').onclick = async () => {
    // @module misc
    const syn = (lastDone && lastDone.market && lastDone.market.synopsis) || resultText().slice(0, 120);
    const payload = lang === 'en' ? `My new vertical drama on Zhongnan Screenwriter:\n${syn}\n→ Create yours`
      : `我在「终南集·AGI编剧大师」写了部新短剧：\n${syn}\n→ 一起来创作`;
    if (navigator.share) { try { await navigator.share({ text: payload }); return; } catch {} }
    copy(payload, lang === 'en' ? 'Synopsis copied' : '梗概与邀请文案已复制');
  };
  // ═══ MODULE: qc (717行, 18fn) ═══ v2.67 剧本PK
  /* ---------- v2.67 剧本PK ---------- */
  let pkOpponentId = null; // null = 平台标杆本
  async function openPk() {
    if (!Api.isAuthed()) { xnSay(lang === 'en' ? 'Please sign in first.' : '先登录再PK哦～'); openAuth('login'); return; }
    if (!currentProjectId) { xnSay(lang === 'en' ? 'Generate a script first.' : '先生成剧本再来PK～'); return; }
    pkOpponentId = null;
    $('pkSetup').classList.remove('hidden');
    $('pkResult').classList.add('hidden');
    $('pkLoading').classList.add('hidden');
    $('pkBoard').classList.add('hidden');
    // 拉取用户自己的项目列表作为对手候选
    const box = $('pkOpponents'); box.innerHTML = '';
    const bench = document.createElement('div');
    bench.className = 'pk-opp selected';
    bench.textContent = lang === 'en' ? '🏆 Platform Benchmark (recommended)' : '🏆 平台标杆本（推荐）';
    bench.onclick = () => { pkOpponentId = null; document.querySelectorAll('.pk-opp').forEach((o) => o.classList.remove('selected')); bench.classList.add('selected'); };
    box.appendChild(bench);
    try {
      const projects = await Api.jsonOrThrow(await Api.request('/api/generate/projects'));
      (projects || []).filter((p) => p.id !== currentProjectId && (p.totalEps || 0) > 0).slice(0, 8).forEach((p) => {
        const el = document.createElement('div');
        el.className = 'pk-opp';
        el.textContent = `📄 ${p.title}（${p.totalEps}集）`;
        el.onclick = () => { pkOpponentId = p.id; document.querySelectorAll('.pk-opp').forEach((o) => o.classList.remove('selected')); el.classList.add('selected'); };
        box.appendChild(el);
      });
    } catch { /* 列表拉取失败不影响标杆本选项 */ }
    openModal('pkModal');
  }
  $('pkBtn').onclick = openPk;
  $('pkStartBtn').onclick = async () => {
    $('pkStartBtn').disabled = true; // 防双击重复扣分（再靠 clientToken 兜底网络重试）
    $('pkSetup').classList.add('hidden');
    $('pkResult').classList.add('hidden');
    $('pkLoading').classList.remove('hidden');
    try {
      const body = { projectAId: currentProjectId, clientToken: idemToken() };
      if (pkOpponentId) body.projectBId = pkOpponentId;
      const r = await Api.jsonOrThrow(await Api.request('/api/va/pk', { method: 'POST', body: JSON.stringify(body) }));
      $('pkLoading').classList.add('hidden');
      $('pkResult').classList.remove('hidden');
      renderPkResult(r);
    } catch (e) {
      $('pkLoading').classList.add('hidden');
      $('pkSetup').classList.remove('hidden');
      xnSay((e && e.message) ? e.message : (lang === 'en' ? 'PK failed, points refunded.' : 'PK失败，积分已退回～'));
    } finally {
      $('pkStartBtn').disabled = false;
    }
  };
  $('pkAgainBtn').onclick = () => { $('pkResult').classList.add('hidden'); $('pkSetup').classList.remove('hidden'); };
  $('pkBoardBtn').onclick = openPkBoard;
  $('pkResultBoardBtn').onclick = openPkBoard;
  $('pkBoardBackBtn').onclick = () => {
    $('pkBoard').classList.add('hidden');
    // 从结果页进入则回结果页，否则回选择页
    if (!$('pkResult').classList.contains('hidden')) return;
    $('pkSetup').classList.remove('hidden');
  };
  let pkBoardSeq = 0; // v2.259：战力榜重入请求序号，旧在途失败不覆盖新加载
  async function openPkBoard() {
    const seq = ++pkBoardSeq;
    $('pkSetup').classList.add('hidden');
    $('pkResult').classList.add('hidden');
    $('pkLoading').classList.add('hidden');
    $('pkBoard').classList.remove('hidden');
    const card = $('pkMineCard'), list = $('pkTopList'), season = $('pkBoardSeason');
    znSkeleton(card);
    list.innerHTML = '';
    try {
      const j = await Api.jsonOrThrow(await Api.request('/api/va/pk/leaderboard'));
      if (seq !== pkBoardSeq) return;
      const b = j.board;
      season.textContent = (lang === 'en' ? `Season ${b.seasonId} · ${b.totalPlayers} ranked · ${b.totalBattles} battles`
        : `${b.seasonId} 赛季 · ${b.totalPlayers} 人上榜 · 共 ${b.totalBattles} 局`);
      renderMineCard(card, b.mine, j.nextTier);
      if (!b.top.length) {
        const li = document.createElement('li');
        li.className = 'pk-empty';
        li.innerHTML = znEmptyHtml(lang === 'en' ? 'No battles yet — be the first on the board.' : '还没有人上榜，快去PK第一局吧～');
        list.appendChild(li);
      }
      b.top.forEach((e) => {
        const li = document.createElement('li');
        li.className = 'pk-top-row' + (b.mine && e.userId === b.mine.userId ? ' me' : '');
        const tier = lang === 'en' ? e.tierEn : e.tierZh;
        li.innerHTML = `<span class="pk-rank-no">${e.rank}</span><span class="pk-rank-name">${escapeHtml(e.displayName)}</span><span class="pk-rank-tier">${escapeHtml(tier)}</span><span class="pk-rank-power">${e.power}</span>`;
        list.appendChild(li);
      });
    } catch (e) {
      if (seq !== pkBoardSeq) return;
      card.innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Failed to load board.' : '榜单加载失败～'));
    }
  }
  function renderMineCard(card, mine, nextTier) {
    if (!mine) {
      card.innerHTML = lang === 'en'
        ? '<div class="pk-mine-tier">Unranked</div><div class="pk-mine-sub">Finish one PK to enter the season board.</div>'
        : '<div class="pk-mine-tier">尚未上榜</div><div class="pk-mine-sub">完成一局 PK 即可登上本赛季战力榜</div>';
      return;
    }
    const tier = lang === 'en' ? mine.tierEn : mine.tierZh;
    const pct = nextTier ? Math.round(nextTier.progress * 100) : 100;
    // @module qc
    const nextTxt = (nextTier && nextTier.nextTierZh)
      ? (lang === 'en'
        ? `${nextTier.gap} power to ${nextTier.nextTierEn}`
        : `距 ${nextTier.nextTierZh} 还差 ${nextTier.gap} 战力`)
      : (lang === 'en' ? 'Top tier reached 👑' : '已达最高段位 👑');
    card.innerHTML = `
      <div class="pk-mine-line"><span class="pk-mine-tier">${tier}</span><span class="pk-mine-rank">#${mine.rank}</span></div>
      <div class="pk-mine-power">${lang === 'en' ? 'Power' : '战力'} <b>${mine.power}</b> · ${lang === 'en' ? 'Win rate' : '胜率'} ${Math.round(mine.winRate * 100)}% · ${mine.wins}/${mine.battles}</div>
      <div class="pk-mine-bar"><i style="width:${pct}%"></i></div>
      <div class="pk-mine-sub">${nextTxt}</div>`;
  }
  function renderPkResult(r) {
    $('pkLoading').classList.add('hidden');
    $('pkResult').classList.remove('hidden');
    const res = r.result;
    $('pkNameA').textContent = r.titleA || 'A';
    $('pkNameB').textContent = r.titleB || 'B';
    $('pkTotalA').textContent = res.totalA.toFixed(1);
    $('pkTotalB').textContent = res.totalB.toFixed(1);
    $('pkSideA').className = 'pk-side' + (res.winner === 'A' ? ' win' : res.winner === 'B' ? ' lose' : '');
    $('pkSideB').className = 'pk-side' + (res.winner === 'B' ? ' win' : res.winner === 'A' ? ' lose' : '');
    const winText = res.winner === 'tie' ? (lang === 'en' ? '🤝 Dead heat!' : '🤝 旗鼓相当！')
      : (lang === 'en' ? `🏆 ${res.winner} wins by ${Math.abs(res.totalA - res.totalB).toFixed(1)}` : `🏆 ${res.winner === 'A' ? r.titleA : r.titleB} 胜出，领先 ${Math.abs(res.totalA - res.totalB).toFixed(1)} 分`);
    $('pkWinner').textContent = winText;
    // 段位/排名即时反馈（v2.68）
    const strip = $('pkMineStrip');
    if (r.mine) {
      strip.classList.remove('hidden');
      const tier = lang === 'en' ? r.mine.tierEn : r.mine.tierZh;
      strip.textContent = (lang === 'en'
        ? `You are now ${tier} · Power ${r.mine.power} · Rank #${r.mine.rank}`
        : `当前段位：${tier} · 战力 ${r.mine.power} · 全榜第 #${r.mine.rank} 名`);
    } else { strip.classList.add('hidden'); }
    const bars = $('pkBars'); bars.innerHTML = '';
    res.dimensions.forEach((d) => {
      const row = document.createElement('div'); row.className = 'pk-bar-row';
      const label = document.createElement('div'); label.className = 'pk-bar-label';
      label.innerHTML = `<span>${lang === 'en' ? d.labelEn : d.labelZh}</span><span>${d.scoreA.toFixed(0)} / ${d.scoreB.toFixed(0)}</span>`;
      const track = document.createElement('div'); track.className = 'pk-bar-track';
      const sum = Math.max(1, d.scoreA + d.scoreB);
      const a = document.createElement('div'); a.className = 'pk-bar-a'; a.style.width = (d.scoreA / sum * 100) + '%';
      const b = document.createElement('div'); b.className = 'pk-bar-b'; b.style.width = (d.scoreB / sum * 100) + '%';
      track.appendChild(a); track.appendChild(b);
      row.appendChild(label); row.appendChild(track);
      bars.appendChild(row);
    });
    $('pkComment').textContent = '🐼 小南：' + (lang === 'en' ? res.xiaonanCommentEn : res.xiaonanCommentZh);
  }
  // ===== v2.69 剧本价值证书 =====
  let valueCardCache = null;
  async function openValueCard() {
    if (!Api.isAuthed()) { xnSay(lang === 'en' ? 'Please sign in first.' : '先登录再生成价值证书哦～'); openAuth('login'); return; }
    if (!currentProjectId) { xnSay(lang === 'en' ? 'Generate a script first.' : '先生成剧本再看价值～'); return; }
    const pid = currentProjectId; // v2.259：固化项目 id，A 项目慢响应不得覆盖 B 项目弹窗
    openModal('valueModal');
    const body = $('valueBody'); $('valueActions').classList.add('hidden');
    body.innerHTML = znSkeletonHtml();
    try {
      const j = await Api.jsonOrThrow(await Api.request(`/api/generate/projects/${pid}/value-card?lang=${lang}`));
      if (pid !== currentProjectId) return;
      valueCardCache = j.card;
      renderValueCard(j.card);
      $('valueActions').classList.remove('hidden');
    } catch (e) {
      if (pid !== currentProjectId) return;
      body.innerHTML = znErrorHtml((e && e.message) ? e.message : (lang === 'en' ? 'Failed to evaluate.' : '评估失败～'));
    }
  }
  function renderValueCard(c) {
    const en = lang === 'en';
    const gradeCls = `vc-grade vc-g-${c.grade}`;
    const band = c.band
      ? (en
        ? `<div class="vc-band">Reference value: <b>¥${c.band.totalLow}–${c.band.totalHigh}</b> (${c.episodes} eps · ¥${c.band.perEpLow}–${c.band.perEpHigh}/ep)</div>`
        : `<div class="vc-band">参考价值区间：<b>¥${c.band.totalLow}–${c.band.totalHigh}</b>（${c.episodes}集 · 单集¥${c.band.perEpLow}–${c.band.perEpHigh}）</div>`)
      : '';
    const dims = c.dimensions.map((d) => {
      const name = en ? d.labelEn : d.labelZh;
      return `<div class="vc-dim"><span>${escapeHtml(name)}</span><div class="vc-dim-track"><i style="width:${Number(d.score) || 0}%"></i></div><b>${Number(d.score).toFixed(0)}</b></div>`;
    }).join('');
    // @module qc
    const strengths = (en ? c.strengthsEn : c.strengthsZh);
    const risks = en ? c.risksEn : c.risksZh;
    // @module qc
    const li = (arr, cls) => (arr && arr.length ? `<ul class="${cls}">${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '');
    $('valueBody').innerHTML = `
      <div class="vc-cert">
        <div class="vc-head">
          <div class="${gradeCls}">${c.grade}</div>
          <div class="vc-head-meta">
            <div class="vc-title">${escapeHtml(c.title)}${c.penName ? ` · ${escapeHtml(c.penName)}` : ''}</div>
            <div class="vc-grade-label">${escapeHtml(en ? c.gradeEn : c.gradeZh)}</div>
          </div>
          <div class="vc-index"><span>${en ? 'Value index' : '价值指数'}</span><b>${c.valueIndex}</b></div>
        </div>
        ${band}
        <div class="vc-scores"><div class="vc-score"><span>${en ? 'Craft' : '创作分'}</span><b>${c.craftScore}</b></div><div class="vc-score"><span>${en ? 'Funder' : '资方分'}</span><b>${c.funderScore}</b></div></div>
        <div class="vc-dims">${dims}</div>
        <div class="vc-sec"><h5>${en ? 'Strengths' : '亮点'}</h5>${li(strengths, 'vc-strength')}</div>
        <div class="vc-sec"><h5>${en ? 'Risks to fix' : '待补风险'}</h5>${li(risks, 'vc-risk') || `<p class="muted">${en ? 'No hard risk detected.' : '暂无硬性风险。'}</p>`}</div>
        <p class="vc-disclaimer">${escapeHtml(en ? c.disclaimerEn : c.disclaimerZh)}</p>
      </div>`;
  }
  $('valueCardBtn').onclick = openValueCard;
  $('valueShareCopyBtn').onclick = () => {
    if (!valueCardCache) return;
    const txt = lang === 'en' ? valueCardCache.shareTextEn : valueCardCache.shareTextZh;
    copy(txt, lang === 'en' ? 'Share text copied (synopsis only). Paste it anywhere!' : '分享文案已复制（仅梗概，不含全文），快去分享吧～');
  };
  $('valuePosterBtn').onclick = async () => {
    if (!currentProjectId) return;
    const btn = $('valuePosterBtn'); btn.disabled = true;
    const old = btn.textContent;
    const hdStaff = isStaffAcct();
    btn.textContent = hdStaff ? (lang === 'en' ? 'Generating (free)…' : '高清生成中（内部免费）…') : (lang === 'en' ? 'Generating (39 pts)…' : '高清生成中（扣39积分）…');
    try {
      const r = await Api.jsonOrThrow(await Api.request('/api/va/poster', { method: 'POST', body: JSON.stringify({ projectId: currentProjectId, tier: 'STANDARD', clientToken: idemToken() }) }));
    // @module qc
      const urls = (r.images || []).filter((u) => /^https?:\/\//.test(u) || u.startsWith('data:image/'));
      if (urls.length) {
        const wrap = document.createElement('div'); wrap.className = 'vc-poster-out';
        wrap.innerHTML = `<p class="muted">${lang === 'en' ? 'HD certificate posters (pick one to save/share):' : '高清证书海报（选一张保存/分享）：'}</p><div class="vc-poster-grid">${urls.map((u) => `<img src="${escapeHtml(u)}" alt="poster"/>`).join('')}</div>`;
        $('valueBody').appendChild(wrap);
        xnSay(r.staff ? (lang === 'en' ? 'Done — free for staff.' : '生成完成，内部账户免费～') : (lang === 'en' ? `Done, ${r.points} points used.` : `生成完成，已扣 ${r.points} 积分～`));
      }
    } catch (e) {
      xnSay((e && e.message) ? e.message : (lang === 'en' ? 'Generation failed, points refunded.' : '生成失败，积分已退回～'));
    } finally { btn.disabled = false; btn.textContent = old; }
  };

  // v2.70 立项前「智能默认」预览：免费、零大模型，让用户生成前看到系统默认与小南理由（可改）
  $('smartDefaultBtn').onclick = async () => {
    const en = lang === 'en';
    const modal = $('smartModal'), body = $('smartBody');
    openModal(modal.id);
    body.innerHTML = `<p class="muted">${en ? 'Xiao-nan is preparing your smart defaults…' : '小南正在结合时令、热趋势和你的偏好整理默认方案…'}</p>`;
    try {
      const fmtSel = $('scriptFormatSel');
      const payload = {
        tags: (typeof tagChosen !== 'undefined' ? tagChosen : []).slice(0, 24),
        mode: (typeof selectedMode !== 'undefined') ? selectedMode : undefined,
        scriptMode: (fmtSel && fmtSel.value === 'AIGC') ? 'AIGC' : 'LIVE',
        scriptType: selectedScriptType,
        outputLang: outputLangValue(),
        lang: en ? 'en' : 'zh',
      };
      const r = await Api.jsonOrThrow(await Api.request('/api/generate/smart-defaults', { method: 'POST', body: JSON.stringify(payload) }));
      const d = r.defaults, bs = r.boardStatus || {};
      const lines = en ? d.linesEn : d.linesZh;
      const hs = d.hookStrategy;
      const srcBadge = { trending: en ? 'Trend' : '热趋势', seasonal: en ? 'Season' : '时令', profile: en ? 'You' : '偏好' };
    // @module qc
      const dirs = (d.directions || []).map((x) =>
        `<span class="sd-chip sd-${x.source}">${escapeHtml(x.tag)}<i>${escapeHtml(en ? x.sourceEn : x.sourceZh)}</i></span>`).join('');
      const boardNote = d.boardActive
        ? (en ? `Live board: ${bs.count} fresh item(s) from ${(bs.platforms || []).slice(0, 4).join(', ')}.` : `已接入保鲜期内真实榜单 ${bs.count} 条（${(bs.platforms || []).slice(0, 4).join('、')}），热趋势已参与默认。`)
        : (en ? 'No fresh real board: no fabricated trending — defaults use tag fit, season and your profile.' : (bs.note || '当前无保鲜期真实榜单，按标签契合+时令+你的偏好默认，不编造爆款。'));
      body.innerHTML = `
        <div class="sd-lines"><div class="sd-xn">🐼 ${en ? 'Xiao-nan' : '小南'}</div>${lines.map((l) => `<p>· ${escapeHtml(l)}</p>`).join('')}</div>
        <div class="sd-board ${d.boardActive ? 'on' : ''}">${escapeHtml(boardNote)}</div>
        <div class="sd-sec"><b>${en ? 'Prioritized directions' : '本次优先方向'}</b><div class="sd-chips">${dirs || `<span class="muted">${en ? 'Pick tags to see directions.' : '选择标签后这里会给出优先方向。'}</span>`}</div></div>
        <div class="sd-sec"><b>${en ? 'Default hook pacing' : '钩子节奏系统默认'}</b>
          <div class="sd-hook">${escapeHtml(en ? hs.nameEn : hs.name)} — ${escapeHtml(en ? hs.reasonEn : hs.reason)}</div>
          <div class="sd-opts">${hs.options.map((o) => `<span class="${o.id === hs.id ? 'cur' : ''}">${escapeHtml(en ? o.nameEn : o.name)}</span>`).join('')}</div>
          <p class="muted sd-tip">${en ? 'Defaults are adjustable in 🎣 Hook Console before generating.' : '这些都是系统默认，可在下方「🎣 钩子编排」里手动调整。'}</p>
        </div>`;
    } catch (e) {
      body.innerHTML = znErrorHtml((e && e.message) ? e.message : (en ? 'Failed to load defaults.' : '智能默认加载失败，不影响正常生成。'));
    }
  };

    // @module qc
  const downloadTxtLocal = () => {
    const blob = new Blob(['﻿' + resultText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'script.txt'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('dlBtn').onclick = (e) => {
    e.stopPropagation();
    const lv = Api.getUser() && Api.getUser().level;
    $('dlNoWmWrap').classList.toggle('hidden', !(lv === 'ADVANCED' || lv === 'PRO'));
    const sh = $('dlShotHint');
    if (sh) sh.classList.toggle('hidden', !(lastDone && lastDone.format && lastDone.format.mode === 'AIGC'));
    $('dlMenu').classList.toggle('hidden');
  };
  // 从后端导出带封面/大纲/人物小传/分集目录/页码的成稿文件；门控由服务端裁决
    // @module qc
  const downloadFromServer = async (fmt, epNo) => {
    if (!currentProjectId) { xnSay(lang === 'en' ? 'Generate a script first.' : '请先生成剧本再导出哦～'); return; }
    if (!Api.getUser()) { openAuth('login'); return; }
    const noWm = fmt !== 'txt' && $('dlNoWm') && !$('dlNoWm').classList.contains('hidden') && $('dlNoWm').checked ? '&noWatermark=1' : '';
    const epQs = epNo ? `&ep=${encodeURIComponent(epNo)}` : '';
    $('dlMenu').classList.add('hidden');
    try {
      const r = await Api.request(`/api/export/${currentProjectId}?format=${fmt}${noWm}${epQs}`);
      if (!r.ok) {
        let msg = lang === 'en' ? 'Export failed.' : '导出失败';
        try { const j = await r.json(); if (j.error && j.error !== 'INTERNAL_ERROR') msg = j.error; if (j.needUpgrade) { switchView('vip'); } } catch {}
        xnSay(msg); return;
      }
      const disp = r.headers.get('content-disposition') || '';
      const m = /filename\*=UTF-8''([^;]+)/i.exec(disp);
      const fname = m ? decodeURIComponent(m[1]) : `script.${fmt}`;
      const buf = await r.arrayBuffer();
      const mime = fmt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: mime })); a.download = fname; a.click(); URL.revokeObjectURL(a.href);
      xnSay(lang === 'en' ? 'Exported. It includes outline, cast, TOC and page numbers.' : '导出成功，已含故事大纲、人物小传、分集目录和页码～');
    } catch (err) { xnSay(err.message || (lang === 'en' ? 'Export failed.' : '导出失败')); }
  };
  document.querySelectorAll('#dlMenu [data-fmt]').forEach((b) => {
    b.onclick = () => { const fmt = b.dataset.fmt; if (fmt === 'txt') { $('dlMenu').classList.add('hidden'); downloadTxtLocal(); } else downloadFromServer(fmt); };
  });
  // 单集导出：输入集号，复用 downloadFromServer 的 ep 参数
  const dlEpBtn = $('dlEpBtn');
  if (dlEpBtn) dlEpBtn.onclick = async () => {
    if (!currentProjectId) { xnSay(lang === 'en' ? 'Generate a script first.' : '请先生成剧本再导出哦～'); return; }
    const latestEp = currentScripts.length ? currentScripts[currentScripts.length - 1].epNo : 1;
    const input = await uiPrompt({ body: lang === 'en' ? `Export which episode? (1-${latestEp})` : `导出第几集？（1-${latestEp}）`, value: String(latestEp) });
    if (!input) return;
    const epNo = parseInt(input.trim(), 10);
    if (!Number.isFinite(epNo) || epNo < 1) { xnSay(lang === 'en' ? 'Invalid episode number.' : '集号无效'); return; }
    $('dlMenu').classList.add('hidden');
    downloadFromServer('txt', epNo); // 单集默认 txt 免费；docx/pdf 走会员门控
  };
  // v2.64 导演交付包预览：导出前先看情绪/钩子/兑现链/人物成长四页
  let dpPages = []; let dpActive = 0; let dpEpisodeCount = 0;
    // @module qc
  const renderDpPage = () => {
    const body = $('dpBody'); if (!body) return;
    const p = dpPages[dpActive];
    if (!p) { znEmpty(body, t('dpEmpty')); return; }
    body.innerHTML = '';
    if (p.type === 'wave' && p.wave && p.wave.textLines) {
      p.wave.textLines.forEach((ln) => { const d = document.createElement('div'); d.className = 'dp-line dp-wave'; d.textContent = ln; body.appendChild(d); });
    }
    p.lines.forEach((ln) => { const d = document.createElement('div'); d.className = 'dp-line'; d.textContent = ln; body.appendChild(d); });
  };
    // @module qc
  const renderDpSummary = () => {
    const s = $('dpSummary'); if (!s) return;
    if (!dpPages.length) { s.textContent = ''; return; }
    const labels = { wave: lang === 'en' ? 'Emotion' : '情绪', hook: lang === 'en' ? 'Hooks' : '钩子', chain: lang === 'en' ? 'Payoff' : '兑现链', cast: lang === 'en' ? 'Cast' : '人物', materials: lang === 'en' ? 'Materials' : '物料' };
    const names = dpPages.map((p) => labels[p.type] || p.type).join(' / ');
    s.textContent = (lang === 'en' ? `Episodes: ${dpEpisodeCount} · Director pages (${dpPages.length}): ` : `共 ${dpEpisodeCount} 集 · 导演交付页（${dpPages.length} 页）：`) + names + (lang === 'en' ? ' — preview only; download below for the formatted file.' : ' — 此为预览，下方按钮下载正式排版文件。');
  };
    // @module qc
  const openDirectorPack = async () => {
    $('dlMenu').classList.add('hidden');
    if (!currentProjectId) { xnSay(lang === 'en' ? 'Generate a script first.' : '请先生成剧本再预览哦～'); return; }
    if (!Api.getUser()) { openAuth('login'); return; }
    const account = capturePrivateSession(), projectId = currentProjectId;
    const isCurrentProject = () => isPrivateSessionCurrent(account) && currentProjectId === projectId;
    $('dpTitle').textContent = t('dpTitle');
    $('dpTabs').innerHTML = ''; $('dpSummary').textContent = ''; znSkeleton('dpBody');
    openModal('dpModal');
    try {
      const r = await Api.request(`/api/generate/projects/${projectId}/director-pack`);
      // v2.238：统一走 jsonOrThrow（v2.226 脱敏层）——不再手动判响应码取 error 字段裸上屏，INTERNAL_ERROR 回落本地友好文案
      const data = await Api.jsonOrThrow(r);
      if (!isCurrentProject()) return;
      dpPages = data.pages || []; dpActive = 0; dpEpisodeCount = data.episodeCount || 0;
      const tabs = $('dpTabs'); tabs.innerHTML = '';
      if (!dpPages.length) { znEmpty('dpBody', t('dpEmpty')); return; }
      dpPages.forEach((p, i) => {
        const b = document.createElement('button'); b.className = 'dp-tab' + (i === 0 ? ' active' : '');
        b.textContent = p.title; b.onclick = () => { dpActive = i; tabs.querySelectorAll('.dp-tab').forEach((x, j) => x.classList.toggle('active', j === i)); renderDpPage(); };
        tabs.appendChild(b);
      });
      renderDpSummary();
      renderDpPage();
    } catch (err) { if (isCurrentProject()) znError('dpBody', (err && err.message) || t('dpEmpty')); }
  };
  if ($('dpBtn')) $('dpBtn').onclick = openDirectorPack;
  if ($('dpCopy')) $('dpCopy').onclick = () => { const p = dpPages[dpActive]; if (!p) return; const txt = (p.type === 'wave' && p.wave && p.wave.textLines ? p.wave.textLines.join('\n') + '\n' : '') + p.lines.join('\n'); copy(txt, lang === 'en' ? 'Page copied' : '当前页已复制'); };
  // v2.65 预览弹窗内直接下载对应格式，形成预览→导出闭环
  document.querySelectorAll('#dpModal [data-dp-fmt]').forEach((b) => {
    b.onclick = () => { const fmt = b.dataset.dpFmt; $('dpModal').classList.add('hidden'); downloadFromServer(fmt); };
  });
  // v2.154 制作物料清单预览：场景总表/角色出场表/道具总表（跨集聚合，制片交付层，登录即可）
  let matData = null;
    // @module qc
  const openMaterials = async () => {
    $('dlMenu').classList.add('hidden');
    if (!currentProjectId) { xnSay(lang === 'en' ? 'Generate a script first.' : '请先生成剧本再预览哦～'); return; }
    if (!Api.getUser()) { openAuth('login'); return; }
    const account = capturePrivateSession(), projectId = currentProjectId;
    const isCurrentProject = () => isPrivateSessionCurrent(account) && currentProjectId === projectId;
    $('matTitle').textContent = t('matTitle');
    $('matSummary').textContent = '';
    znSkeleton('matBody');
    openModal('matModal');
    try {
      const r = await Api.request(`/api/export/${projectId}/materials`);
      // v2.239：统一走 jsonOrThrow（v2.226 脱敏层）——不再手动判响应码取 error 字段裸上屏（v2.238 dpBody 同族收口）
      const data = await Api.jsonOrThrow(r);
      if (!isCurrentProject()) return;
      matData = data;
      const en = lang === 'en'; const st = data.stats || {};
      $('matSummary').textContent = en
        ? `${data.title} · ${data.episodeCount} eps · ${st.sceneCount} scenes / ${st.castCount} cast / ${st.propCount} props · header pass ${st.headerRate ?? 0}%`
        : `${data.title} · 共${data.episodeCount}集 · 场景${st.sceneCount}场 / 角色${st.castCount}人 / 道具${st.propCount}类 · 场头合规率${st.headerRate ?? 0}%`;
      const body = $('matBody'); body.innerHTML = '';
    // @module qc
      const sec = (title) => { const d = document.createElement('div'); d.className = 'dp-line'; d.textContent = title; body.appendChild(d); };
      const row = (txt) => { const d = document.createElement('div'); d.className = 'dp-line'; d.textContent = txt; body.appendChild(d); };
    // @module qc
      const epsStr = (eps) => eps.map((e) => (en ? `ep${e}` : `第${e}集`)).join('/');
      sec(en ? '▸ Scene Sheet (by scene count)' : '▸ 场景总表（按场次降序）');
      (data.scenes || []).forEach((s) => {
        const head = [en ? '' : (s.intExt ? s.intExt + '景' : ''), s.location, s.timeOfDay].filter(Boolean).join('·');
        row(en ? `${head} — ${s.count} scene(s) (${s.eps.join('/')})` : `${head} — 共${s.count}场（${epsStr(s.eps)}）`);
      });
      if (!(data.scenes || []).length) row(en ? '(No valid scene headers)' : '（无合规场头，建议逐集补「内景/外景 地点 时间」）');
      sec(en ? '▸ Cast Sheet (by line count)' : '▸ 角色出场表（按台词量降序）');
      (data.cast || []).forEach((c) => row(en ? `${c.name} — ${c.lines} line(s), eps ${c.eps.join('/')}` : `${c.name} — ${c.lines}句台词，出场${epsStr(c.eps)}`));
      if (!(data.cast || []).length) row(en ? '(No dialogue lines)' : '（无台词行，建议检查「角色名：台词」格式）');
      sec(en ? '▸ Prop Sheet (key props)' : '▸ 道具总表（关键信物）');
      (data.props || []).forEach((p) => {
        const tail = p.closed ? (en ? ' (closed — verify re-appearances)' : '（已封禁：销毁/丢失后再现场景需复核）') : '';
        row(en ? `${p.name} — eps ${p.eps.join('/')}${tail}` : `${p.name} — ${epsStr(p.eps)}提及${tail}`);
      });
      if (!(data.props || []).length) row(en ? '(No key props)' : '（无关键信物记录）');
      // v2.155 场景×角色通告矩阵（跨集按场景聚合：场次/角色台词量/信物）
      sec(en ? '▸ Scene×Cast Matrix (by scene count)' : '▸ 场景×角色通告矩阵（按场次降序）');
    // @module qc
      const mx = (data.sceneBreakdown && data.sceneBreakdown.matrix) || [];
      // v2.156 复盘增强：场景生图提示词进预览层（details 首现场景 → prompt，AIGC 空镜参考图即拿即用）
      const promptMap = new Map(
        ((data.sceneBreakdown && data.sceneBreakdown.details) || [])
          .filter((d) => d && d.prompt)
          .map((d) => [`${d.intExt}|${d.location}|${d.timeOfDay}`, d.prompt])
      );
      mx.forEach((r) => {
        const head = [en ? '' : (r.intExt ? r.intExt + '景' : ''), r.location, r.timeOfDay].filter(Boolean).join('·');
        const segs = [`${head} — ${en ? `${r.count} scene(s)` : `${r.count}场`}`];
        if ((r.cast || []).length) segs.push(`${en ? 'Cast: ' : '角色：'}${r.cast.map((c) => `${c.name}(${c.lines})`).join('/')}`);
        if ((r.props || []).length) segs.push(`${en ? 'Props: ' : '道具：'}${r.props.join(en ? ', ' : '、')}`);
        row(segs.join(en ? ' | ' : '｜'));
        const pr = promptMap.get(`${r.intExt}|${r.location}|${r.timeOfDay}`);
        if (pr) {
          const p = document.createElement('div');
          p.className = 'dp-line';
          p.style.cssText = 'font-size:11px;color:#8a6d3b;margin:1px 0 4px';
          p.textContent = `🎨 ${pr}`;
          body.appendChild(p);
        }
      });
      if (!mx.length) row(en ? '(No valid scene headers)' : '（无合规场头，无法生成矩阵）');
    } catch (err) { if (isCurrentProject()) { znError('matBody', (err && err.message) || t('matEmpty')); matData = null; } }
  };
  if ($('dlMat')) $('dlMat').onclick = openMaterials;
  if ($('matCopy')) $('matCopy').onclick = () => {
    if (!matData) return;
    const body = $('matBody');
    const text = [$('matSummary').textContent, ...Array.from(body.children).map((d) => d.textContent)].join('\n');
    copy(text, lang === 'en' ? 'Materials copied' : '物料清单已复制');
  };

  document.addEventListener('click', (e) => { const m = $('dlMenu'); if (m && !m.classList.contains('hidden') && !m.contains(e.target) && e.target !== $('dlBtn')) m.classList.add('hidden'); });
  $('retryBtn').onclick = genClickGuard(() => startGenerate());
  $('diagRefreshBtn').onclick = () => { if (currentProjectId) loadDiagnosis(currentProjectId); };
  $('diagCopyBtn').onclick = () => {
    if (!lastDiagnosis) return;
    const sc = lastDiagnosis.scorecard;
    const lines = [`【全本质量诊断】总评 ${sc.total}（${sc.level}）`,
      ...lastDiagnosis.groups.map((g) => `· ${g.label} ${g.score}`),
      '', '【优先修改清单】',
      ...lastDiagnosis.topFixes.map((f, i) => `${i + 1}. [${f.level}/${f.dimLabel}] ${f.advice}`)];
    copy(lines.join('\n'), lang === 'en' ? 'Fix list copied' : '修改清单已复制，可直接发给小南或编剧协作者');
  };

  /* ---------- 诊断→一键针对性优化（付费增值，失败后端自动退积分） ---------- */
  let currentWorksProject = null, currentWorksDiagnosis = null;
  // c202 F2：409（处理中/已处理）锁定按钮旁补一个零费“刷新查看新版”。
  // 刷新只重新拉作品/结果页，绝不重新提交 fix（rrFixedKeys 仍在服务端拦截重复扣费）。
  function attach409Refresh(btn, projectId, inWorks, after) {
    if (!btn || btn.parentNode === null || btn.dataset.refreshAttached === '1') return;
    const rb = document.createElement('button');
    rb.type = 'button';
    rb.className = (btn.className || 'diag-fix-btn') + ' diag-refresh-btn';
    rb.textContent = lang === 'en' ? 'Refresh for new version' : '刷新查看新版';
    btn.insertAdjacentElement('afterend', rb);
    btn.dataset.refreshAttached = '1';
    rb.onclick = async () => {
      rb.disabled = true; rb.textContent = lang === 'en' ? 'Refreshing…' : '刷新中…';
      try {
        if (inWorks) { if (currentWorksProject && currentWorksProject.id === projectId) await openProject(currentWorksProject); }
        else { if (typeof refreshResultScripts === 'function') await refreshResultScripts(projectId).catch(() => {}); }
        // c205：after 可能是 async（作品页 reopenWorksDiagnosis 轮询最长 8s），不 await 会在
        // 诊断还没重开完时就提示"已刷新"并移除按钮，用户看到的仍是空诊断面板。同步回调 await 无副作用。
        if (typeof after === 'function') await after();
        xnSay(lang === 'en' ? 'Refreshed to the latest version(s).' : '已刷新到最新版本。');
      } finally { if (document.body.contains(rb)) rb.remove(); }
    };
  }

  // c203 D1：并发败者语义（VERSION_ADVANCED）——另一笔改写已先落新版本，本笔未生效、积分已原路退回。
  // 与 IDEMPOTENT_REPLAY 的关键区别：那笔没扣钱且条目锁死；这笔真扣了又真退了，用户基于最新版重试是一次
  // 新的合法付费，所以按钮必须恢复可点，同时旁挂零费刷新，让他先看到胜者改出的新版再决定要不要再来一次。
  // c204：补一键"基于新版重试"——先零费刷新到最新版（重取诊断/波形/围读面板，拿新鲜数据），
  // 再由 onRetry 点击重绘后的新按钮，仍走原有的付费确认弹窗；刷新后条目已消失则如实告知，绝不静默重发。
  function handleVersionAdvanced(btn, projectId, inWorks, after, onRetry) {
    attach409Refresh(btn, projectId, inWorks, after);
    if (btn && btn.parentNode && btn.dataset.retryAttached !== '1' && typeof onRetry === 'function') {
      const yb = document.createElement('button');
      yb.type = 'button';
      yb.className = (btn.className || 'diag-fix-btn') + ' diag-retry-btn';
      yb.textContent = lang === 'en' ? 'Retry on latest' : '基于新版重试';
      // 刷新按钮已插在 btn 之后，重试按钮跟在刷新按钮之后，三个入口成组：改写按钮 / 基于新版重试 / 刷新查看新版
      (btn.nextElementSibling || btn).insertAdjacentElement('afterend', yb);
      btn.dataset.retryAttached = '1';
      yb.onclick = async () => {
        const oldTxt = yb.textContent;
        yb.disabled = true; yb.textContent = lang === 'en' ? 'Loading latest…' : '载入新版中…';
        try {
          await onRetry();
        } catch {
          // v2.306：onRetry 回调跨函数传入（8601 面回调内裸 await openProject/reopenWorksDiagnosis），
          // reject 不得冒泡——提示后由 finally 恢复按钮可点，用户可再次手动重试
          xnSay(lang === 'en' ? 'Retry failed, please try again.' : '重试失败，请稍后重试');
        } finally {
          // onRetry 通常已把旧面板重绘（本组按钮随旧 DOM 一起销毁）；仍在页面上说明重试没发出去，恢复可点
          if (document.body.contains(yb)) { yb.disabled = false; yb.textContent = oldTxt; }
        }
      };
    }
    xnSay(lang === 'en'
      ? 'Another rewrite on this episode landed first — yours did not apply and the points were refunded. Refresh to see the new version, then retry on it if needed.'
      : '该集刚被另一项优化更新成新版本，本次改写未生效、积分已原路退回。可刷新查看新版，再基于新版重试。');
  }

  // c204：在当前文档里找重绘后的同名入口按钮（优先可见且可点的），找不到说明条目已被新版消化
  function findFreshEntry(selector) {
    const all = Array.from(document.querySelectorAll(selector));
    return all.find((b) => b.isConnected && b.offsetParent !== null && !b.disabled)
      || all.find((b) => b.isConnected && !b.disabled)
      || null;
  }
  // c204：作品页 openProject 会重建一个隐藏的空 #worksDiag（诊断结果不随项目数据返回）。
  // 零费刷新/一键重试后必须重新点诊断按钮拉最新诊断，并等新按钮真正渲染出来，否则找重绘入口必扑空。
  function reopenWorksDiagnosis() {
    return new Promise((resolve) => {
      const btn = document.querySelector('#worksDiagBtn');
      if (!btn) { resolve(); return; }
      btn.click();
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (document.querySelector('#worksDiag [data-fix-idx]')
          || document.querySelector('#worksDiag .notice')
          || Date.now() - t0 > 8000) { clearInterval(iv); resolve(); }
      }, 150);
    });
  }

  async function applyTargetedFix(btn, projectId, diagnosis) {
    const idx = Number(btn.getAttribute('data-fix-idx'));
    const fix = diagnosis?.topFixes?.[idx];
    if (!fix || !projectId) return;
    const ok = await uiConfirm({ body: isStaffAcct()
      ? (lang === 'en' ? `Let Xiaonan locate and rewrite the weakest episode for: "${fix.advice}"?\nFree for staff accounts.` : `让小南针对「${fix.advice}」自动定位并重写最差的那一集？\n内部账户免费，是否继续？`)
      : (lang === 'en'
      ? `Let Xiaonan locate and rewrite the weakest episode for: "${fix.advice}"?\nThis is a paid targeted polish (member discount applies; actual points are settled by the server).`
      : `让小南针对「${fix.advice}」自动定位并重写最差的那一集？\n这是付费针对性优化，会员享折扣，实际扣积分以后端结算为准。是否继续？`), okText: lang === 'en' ? 'Continue' : '继续' });
    if (!ok) return;
    const oldTxt = btn.textContent; btn.disabled = true; btn.textContent = lang === 'en' ? 'Polishing…' : '小南正在改…';
    try {
      const res = await Api.request(`/api/generate/projects/${projectId}/fix`, { method: 'POST', body: JSON.stringify({ fix }) });
      const txt = await res.text(); const d = txt ? JSON.parse(txt) : {};
      if (!res.ok) throw Object.assign(new Error(d.error || 'FAIL'), { msg: d.message, httpStatus: res.status });
      xnSay(d.staff
        ? (lang === 'en' ? `EP${d.epNo} rewritten to v${d.newVersion}, free for staff. ${rewriteSpanText(d.rewriteSpan)} Re-scoring…` : `搞定！第${d.epNo}集已出新版 v${d.newVersion}，内部账户免费。${rewriteSpanText(d.rewriteSpan)} 小南重新打分中～`)
        : (lang === 'en'
        ? `EP${d.epNo} rewritten to v${d.newVersion}, used ${d.pointsCharged} pts. ${rewriteSpanText(d.rewriteSpan)} Re-scoring…`
        : `搞定！第${d.epNo}集已出新版 v${d.newVersion}，消耗${d.pointsCharged}积分。${rewriteSpanText(d.rewriteSpan)} 小南重新打分中～`));
      const inWorksDiag = !!btn.closest('#worksDiag');
      if (inWorksDiag) {
        if (currentWorksProject) await openProject(currentWorksProject);
        // c202：付过费就要立刻看到“改了什么”——自动展开旧版→新版逐行对比
        openVersionDiff(projectId, d.epNo, d.oldVersion, d.newVersion);
      }
      else { await refreshResultScripts(projectId); await loadDiagnosis(projectId); }
    } catch (err) {
      // c201：409 幂等命中≠失败退款，文案不得再谎称“积分已退回”
      // c204 复盘修复：VERSION_ADVANCED 与 IDEMPOTENT_REPLAY 同为 409，必须先放行前者，
      // 否则并发败者（已退款、可基于新版重试）被误判成幂等锁死，刷新/重试入口永不出现。
      if (err.message === 'IDEMPOTENT_REPLAY' || (err.httpStatus === 409 && err.message !== 'VERSION_ADVANCED')) {
        btn.disabled = true; btn.textContent = lang === 'en' ? 'In progress / already handled' : '处理中/已处理';
        const inWorksDiag = !!btn.closest('#worksDiag');
        // c202 F2：锁死的入口旁给零费刷新，用户能看到别人（自己的并发请求）改出的新版，不用干等
        // c204：作品页刷新会重建空诊断面板，after 里把最新诊断重新跑出来，刷新才真正"看得见新版诊断"
        attach409Refresh(btn, projectId, inWorksDiag, inWorksDiag ? reopenWorksDiagnosis : undefined);
        xnSay(lang === 'en' ? 'This item is already in progress or has been handled — do not submit it again; no extra points were charged.' : '这项正在处理或已经处理过，请勿重复提交；不会重复扣积分，稍等刷新即可。');
        return;
      }
      btn.disabled = false; btn.textContent = oldTxt;
      if (err.message === 'VERSION_ADVANCED') {
        const inWorksDiag = !!btn.closest('#worksDiag');
        handleVersionAdvanced(btn, projectId, inWorksDiag, undefined, async () => {
          // c204：零费刷新到最新版（作品页重开项目/结果页重刷脚本与诊断），再点重绘后的同顺位优化按钮
          if (inWorksDiag) {
            if (currentWorksProject && currentWorksProject.id === projectId) {
              await openProject(currentWorksProject);
              await reopenWorksDiagnosis();
            }
          } else {
            await refreshResultScripts(projectId).catch(() => {});
            await loadDiagnosis(projectId).catch(() => {});
          }
          const fresh = findFreshEntry(`[data-fix-idx="${idx}"]`);
          if (!fresh) {
            xnSay(lang === 'en'
              ? 'After refresh this fix item is no longer in the latest diagnosis — the new version may already cover it.'
              : '刷新后这项优化已不在最新诊断清单里，新版可能已经覆盖了该问题。');
            return;
          }
          fresh.click();
        });
        return;
      }
      if (err.code === 'AUTH_REQUIRED') { openAuth('login'); return; }
      if (err.message === 'INSUFFICIENT') xnSay(lang === 'en' ? 'Not enough points — top up to keep polishing.' : '积分不够啦，充值后小南就能继续帮你打磨～');
        else if (err.message === 'ASSISTANT_LEVEL_REQUIRED') { xnSay(err.upsell ? (lang==='en'?err.upsell.en:err.upsell.zh) : (lang==='en'?'Upgrade to unlock this Xiaonan capability.':'升级会员后小南才能用这项能力哦～')); setTimeout(()=>typeof switchView==='function'&&switchView('vip'), 900); }
      else if (err.message === 'SANDBOX') xnSay(lang === 'en' ? 'Sandbox without model keys: nothing charged. Configure keys to enable one-tap polish.' : '当前是无密钥沙盘，本次没扣分；配置模型后即可一键优化。');
      else xnSay(lang === 'en' ? 'Polish did not complete; points were refunded. Try again.' : '这次优化没成功，积分已自动退回，稍后再试一次～');
    }
  }
  document.addEventListener('click', (e) => {
    // c202 版本对比：用一次性委托（document 级，不随 openProject 重渲染重复绑定）
    const dClose = e.target.closest && e.target.closest('[data-diff-close]');
    if (dClose) {
      const box = dClose.closest('.ep-diff');
      if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
      return;
    }
    const dBtn = e.target.closest && e.target.closest('[data-diff]');
    if (dBtn && currentWorksProject) {
      const parts = String(dBtn.getAttribute('data-diff')).split(':').map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 1)) {
        openVersionDiff(currentWorksProject.id, parts[0], parts[1], parts[2]);
      }
      return;
    }
    const wf = e.target.closest && e.target.closest('[data-wave-fix]');
    if (wf) { applyWaveFix(wf, Number(wf.getAttribute('data-wave-fix'))); return; }
    const dot = e.target.closest && e.target.closest('.wave-dot');
    if (dot) { showWaveAdvice(Number(dot.getAttribute('data-ep'))); return; }
    const b = e.target.closest && e.target.closest('[data-fix-idx]');
    if (!b) return;
    const inWorks = !!b.closest('#worksDiag');
    applyTargetedFix(b, inWorks ? currentWorksProject?.id : currentProjectId, inWorks ? currentWorksDiagnosis : lastDiagnosis);
  });
  $('failRetry').onclick = genClickGuard(() => {
    // v2.277 仅当失败会话已持有服务端项目（episodes 阶段失败，项目行已占额度）时安装复用句柄，
    // 让 startGenerate 跳过 POST /projects 直接重发 episodes；projects 阶段失败（project/briefText 缺失）仍整链路重跑。
    const s = genSessions.find((x) => x.id === activeSessionId);
    if (s && s.status === 'failed' && s.project && s.briefText != null) {
      _retryProject = s.project;
      _retryBrief = s.briefText;
    }
    startGenerate();
  });
  // v2.233 取消生成：调后端取消端点（abort 流水线 + 退冻结积分），随后等 cancelled 帧统一走失败态
  $('genCancelBtn').onclick = async () => {
    const as = genSessions.find((s) => s.id === activeSessionId);
    if (!as || !as.taskId || as.status !== 'running' || as.cancelling) return;
    as.cancelling = true; renderProgress();
    try {
      await Api.request('/api/generate/tasks/' + as.taskId + '/cancel', { method: 'POST' });
    } catch (e) {
      as.cancelling = false; renderProgress();
      xnSay((e && e.message) || t('genCancelFail'));
    }
  };
  $('genBtn').onclick = genClickGuard(() => startGenerate());

  /* ---------- v2.261 小南深度共创入口（🐼 悬浮球 → 付费问答弹窗） ----------
     POST /api/va/xiaonan：10积分/次（内部账户免费），后端 idemWindow 幂等拒重。
     前端仍按 v2.260 资金动作惯例上函数级在途锁：双击发送/Ctrl+Enter 连按不发起第二笔，
     用户也不会撞上 409 幂等提示。弹窗静态文案为中文默认，打开时按当前语言同步。 */
  let _xnAsking = false;
  async function askXiaonan() {
    if (_xnAsking) return;
    if (!Api.isAuthed()) { closeModalEl($('xnChatModal')); openAuth('login'); return; }
    const input = $('xnAskInput'), btn = $('xnAskBtn'), answerBox = $('xnAskAnswer');
    // @module qc
    const question = (input.value || '').trim();
    const enLang = lang === 'en';
    if (!question) { xnSay(enLang ? 'Type your question first — the more specific, the sharper the answer.' : '先把问题写上哦，越具体小南答得越准～'); input.focus(); return; }
    const ok = await uiConfirm({ body: isStaffAcct()
      ? (enLang ? 'Ask Xiaonan for deep co-creation advice? Free for staff accounts.' : '让小南深度共创答疑？内部账户免费，是否继续？')
      : (enLang ? 'Ask Xiaonan for deep co-creation advice? 10 pts per question; the server settles actual points.' : '让小南深度共创答疑？10 积分/次，实际扣积分以后端结算为准。是否继续？'), okText: enLang ? 'Continue' : '继续' });
    if (!ok) return;
    _xnAsking = true;
    btn.disabled = true;
    const oldTxt = btn.textContent;
    btn.textContent = enLang ? 'Xiaonan is thinking…' : '小南正在思考…';
    answerBox.classList.add('hidden');
    answerBox.innerHTML = '';
    try {
      const res = await Api.request('/api/va/xiaonan', { method: 'POST', body: JSON.stringify({ question }) });
      const d = await Api.jsonOrThrow(res);
      answerBox.innerHTML = `<div class="xn-qa-a">${escapeHtml(d.answer || '')}</div>`
        + `<div class="muted" style="margin-top:8px;font-size:12px">${d.staff
          ? (enLang ? 'Free for staff — 0 pts used.' : '内部账户免费，本次 0 积分。')
          : (enLang ? `${d.points} pts used this time.` : `本次消耗 ${d.points} 积分。`)}</div>`;
      answerBox.classList.remove('hidden');
      answerBox.scrollIntoView({ block: 'nearest' });
    } catch (e) {
      if (e.message === 'AUTH_REQUIRED') { closeModalEl($('xnChatModal')); openAuth('login'); return; }
      if (e.message === 'INSUFFICIENT') xnSay(enLang ? 'Not enough points — top up to keep creating with Xiaonan.' : '积分不够啦，充值后小南就能继续陪你聊～');
      else xnSay(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
      _xnAsking = false;
    }
  }
  $('xnFloat').onclick = () => {
    const enLang = lang === 'en';
    $('xnAskTitle').textContent = enLang ? '🐼 Xiaonan Deep Co-creation' : '🐼 小南深度共创';
    $('xnAskHint').innerHTML = enLang
      ? '1-on-1 screenwriting advice: premise, structure, hooks, submission strategy — ask anything. <b>10 pts per question</b> (free for staff); the server settles actual points.'
      : '编剧策划 1 对 1 答疑：题材定位、结构卡点、钩子设计、投稿策略都可以问。<b>10 积分/次</b>（内部账户免费），实际扣积分以后端结算为准。';
    $('xnAskInput').placeholder = enLang ? 'Type your question — the more specific, the sharper the answer (max 2000 chars)… Ctrl/⌘+Enter to send' : '写下你的问题，越具体小南答得越准（2000 字以内）… Ctrl/⌘+Enter 发送';
    $('xnAskBtn').textContent = enLang ? 'Send · 10 pts' : '发送 · 10 积分';
    openModal('xnChatModal');
    setTimeout(() => $('xnAskInput')?.focus(), 60);
  };
  $('xnAskBtn').onclick = () => { askXiaonan(); };
  $('xnAskInput').addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); askXiaonan(); } });
  // ═══ MODULE: xiaonan (2行, 0fn) ═══ v2.261 小南深度共创入口end
  /* ---------- v2.261 小南深度共创入口end ---------- */

  // ═══ MODULE: misc (108行, 0fn) ═══ 顶栏控件
  /* ---------- 顶栏控件 ---------- */
  $('themeBtn').onclick = () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]; LS.s('zn_theme', theme); applyTheme(); };
  $('langBtn').onclick = () => { const nx = lang === 'zh' ? 'en' : 'zh'; LS.s('zn_lang', nx); applyLang(); };

  /* ---------- 工具 ---------- */
  function copy(text, okMsg) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => xnSay(okMsg || (lang === 'en' ? 'Copied' : '已复制'))).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    });
  }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // v2.270 Roving tabindex 键盘导航：Tab 键只需按一次进入 tab 组，方向键在组内移动，Home/End 跳首尾
  // 幂等：同一 container 重复调用不会叠加事件监听；每次调用都会重新同步 tabindex/aria 状态
  function znBindTablist(container, opts = {}) {
    if (!container) return { sync() {} };
    const sel = opts.selector || 'button';
    const vertical = !!opts.vertical;
    function tabs() { return [...container.querySelectorAll(sel)]; }
    function isActive(el) {
      return el.classList.contains('on') || el.classList.contains('active') || el.getAttribute('aria-selected') === 'true';
    }
    function sync() {
      container.setAttribute('role', 'tablist');
      tabs().forEach((tab) => {
        tab.setAttribute('role', 'tab');
        const active = isActive(tab);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
      });
    }
    if (!container._znTablistBound) {
      container._znTablistBound = true;
      container.addEventListener('keydown', (e) => {
        const list = tabs();
        if (!list.length) return;
        const cur = list.findIndex((el) => el === document.activeElement);
        const fwd = vertical ? 'ArrowDown' : 'ArrowRight';
        const back = vertical ? 'ArrowUp' : 'ArrowLeft';
        let next = -1;
        if (e.key === fwd) next = (cur + 1) % list.length;
        else if (e.key === back) next = (cur - 1 + list.length) % list.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = list.length - 1;
        if (next >= 0) { e.preventDefault(); list[next].focus(); }
      });
      // 点击后同步 tabindex（click 事件在 keydown Enter/Space 之后触发）
      container.addEventListener('click', () => setTimeout(sync, 0));
    }
    sync();
    return { sync };
  }
  // v2.271 卡片网格二维键盘导航：roving tabindex + 四方向键 + Home/End，列数运行时感知（offsetTop 分行法，适配 CSS auto-fill 响应式列数）
  // 与 znBindTablist 的区别：tablist 是一维且带 ARIA tab 语义；网格是二维卡片集合，不套 grid role（避免读屏期望行列结构），仅做焦点管理与方向键。
  function znBindGrid(container, opts = {}) {
    if (!container) return { sync() {} };
    const sel = opts.selector || 'button';
    function items() { return [...container.querySelectorAll(sel)]; }
    // 列数感知：数第一行（与首项 offsetTop 相同）的元素个数；auto-fill 下随视口宽度变化，故每次按键实时计算
    function colCount(list) {
      if (list.length < 2) return 1;
      const top0 = list[0].offsetTop;
      let n = 0;
      for (const el of list) { if (el.offsetTop === top0) n++; else break; }
      return Math.max(1, n);
    }
    // 记忆焦点项（卡片重渲染后元素被替换，从 0 重新开始；focusin 时按真实焦点校正）
    let focusIdx = 0;
    function sync() {
      const list = items();
      if (focusIdx >= list.length) focusIdx = 0;
      list.forEach((el, i) => { el.tabIndex = (i === focusIdx) ? 0 : -1; });
    }
    if (!container._znGridBound) {
      container._znGridBound = true;
      container.addEventListener('keydown', (e) => {
        const list = items();
        if (!list.length) return;
        const cur = list.findIndex((el) => el === document.activeElement);
        if (cur < 0) return;
        const cols = colCount(list);
        const n = list.length;
        let next = -1;
        if (e.key === 'ArrowRight') next = (cur + 1) % n;                    // 线性 wrap：行尾进下一行行首
        else if (e.key === 'ArrowLeft') next = (cur - 1 + n) % n;
        else if (e.key === 'ArrowDown') { if (cur + cols < n) next = cur + cols; }  // 列向 clamp：越界不动
        else if (e.key === 'ArrowUp') { if (cur - cols >= 0) next = cur - cols; }
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = n - 1;
        if (next >= 0) { e.preventDefault(); focusIdx = next; sync(); list[next].focus(); }
      });
      // 焦点跟随：鼠标点击/Tab 进入时同步 roving tabindex 记忆
      container.addEventListener('focusin', (e) => {
        const list = items();
        const i = list.findIndex((el) => el === e.target);
        if (i >= 0 && i !== focusIdx) { focusIdx = i; sync(); }
      });
      // 点击后兜底同步（click 在 keydown Enter/Space 之后触发）
      container.addEventListener('click', () => setTimeout(sync, 0));
    }
    sync();
    return { sync };
  }
  // v2.169 补全闭环：ISO 日期距今天数（dashboard thinQueue 行显示"X 天前编辑"）
  function daysSince(iso) { const t = new Date(iso).getTime(); return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0; }
  // 付费动作客户端幂等令牌：每次点击生成新令牌（刻意重复操作可再扣费），网络重试/双击重发复用同一请求体
  function idemToken() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }

  // ═══ MODULE: admin (1096行, 22fn) ═══ 超级管理员后台
  /* ---------- 超级管理员后台 ---------- */
  const ADM_TABS = ['users', 'stats', 'finance', 'posts', 'models', 'knowledge', 'feedback', 'safety', 'handoff', 'updates', 'balances', 'ads'];
  let admTab = 'users', admPage = 1, admInited = false;
  const lvName = (lv) => (lang === 'en' ? LEVEL_EN : LEVEL_ZH)[lv] || lv;
  async function admApi(path, opts) {
    const res = await Api.request('/api/admin' + path, opts);
    const j = await Api.jsonOrThrow(res);
    return j;
  }
  // v2.54 后台二进制下载（带鉴权头，不走浏览器直链）
  async function admDownload(path, filename) {
    // v2.286 网络层 reject 与 res.blob() 失败均兜底：固定文案，不直送技术 message
    try {
      const res = await Api.request('/api/admin' + path);
      if (!res.ok) { xnSay('下载失败，请重试'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { xnSay('下载失败，请重试'); }
  }
  function enterAdmin() {
    if (!Api.isAuthed()) { openAuth('login'); switchView('studio'); return; }
    // 入口虽只对管理员显示，仍做一次服务端口径校验
    const ensure = meCache ? Promise.resolve(meCache) : Api.request('/api/auth/me').then((r) => r.json()).then((m) => { meCache = m; return m; });
    ensure.then((me) => {
      if (!me || !me.isAdmin) { xnSay(lang === 'en' ? 'Admin only.' : '仅超级管理员可进入后台'); switchView('studio'); return; }
      if (!admInited) { initAdmin(); admInited = true; }
      // c199 「开设账号」仅主账号可见（isSuperAdmin 由服务端口径判定，副管理员不可见此入口）
      const createBox = $('admCreateBox'); if (createBox) createBox.classList.toggle('hidden', !me.isSuperAdmin);
      renderAdmTabs(); loadAdmTab();
    }).catch(() => switchView('studio'));
  }
  function renderAdmTabs() {
    $('admTabs').innerHTML = ADM_TABS.map((k) =>
      `<button data-atab="${k}" class="${k === admTab ? 'on' : ''}">${t('admTab_' + k)}</button>`).join('');
    $('admTabs').querySelectorAll('[data-atab]').forEach((b) => b.onclick = () => { admTab = b.getAttribute('data-atab'); renderAdmTabs(); loadAdmTab(); });
    znBindTablist($('admTabs'), { selector: '[data-atab]' }); // v2.270 键盘方向键导航 + ARIA 语义（12 个后台 tab 不再靠 Tab 键逐个穿越）
  }
  function loadAdmTab() {
    ['Users', 'Stats', 'Finance', 'Posts', 'Models', 'Knowledge', 'Feedback', 'Safety', 'Handoff', 'Updates', 'Balances', 'Ads'].forEach((n) => $('adm' + n + 'Pane').classList.add('hidden'));
    const map = { users: 'Users', stats: 'Stats', finance: 'Finance', posts: 'Posts', models: 'Models', knowledge: 'Knowledge', feedback: 'Feedback', safety: 'Safety', handoff: 'Handoff', updates: 'Updates', balances: 'Balances', ads: 'Ads' };
    $('adm' + map[admTab] + 'Pane').classList.remove('hidden');
    if (admTab === 'users') loadAdmUsers();
    if (admTab === 'stats') loadAdmStats();
    if (admTab === 'finance') loadAdmFinance();
    if (admTab === 'posts') loadAdmPosts();
    if (admTab === 'models') { loadAdmModels(); loadAdmPortfolio().catch((e) => { $('admPfSummary').innerHTML = znErrorHtml((e && e.message) || t('loadFail')); }); loadProviders().catch((e) => { xnSay((e && e.message) || t('loadFail')); }); }
    if (admTab === 'knowledge') { renderKnCategory(); loadAdmKnowledge(); }
    if (admTab === 'feedback') loadAdmFeedback();
    if (admTab === 'safety') loadAdmSafety();
    if (admTab === 'handoff') loadAdmHandoff();
    if (admTab === 'updates') loadAdmUpdates();
    if (admTab === 'balances') loadAdmBalances();
    if (admTab === 'ads') loadAdmAds();
  }
  function initAdmin() {
    $('admUserSearch').onclick = () => { admPage = 1; loadAdmUsers(); };
    $('admUserQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') { admPage = 1; loadAdmUsers(); } });
    // c199 开设账号：权限档下拉动态填充（跟语言走），提交走 /api/admin/users
    $('admCreateLevel').innerHTML = ['FREE', 'BASIC', 'ADVANCED', 'PRO'].map((L) => `<option value="${L}">${lvName(L)}</option>`).join('');
    $('admCreateBtn').onclick = admCreateUser;
    $('admPostReload').onclick = loadAdmPosts;
    $('admPostFilter').onchange = loadAdmPosts;
    // 模型配置
    $('admModelReload').onclick = loadAdmModels;
    $('admModelSave').onclick = saveAdmModels;
    // v2.41 组合全景/供应商池
    $('admPfReload').onclick = loadAdmPortfolio;
    $('pvCatalog').onchange = fillPvByCatalog;
    $('pvSave').onclick = savePv;
    $('routeSave').onclick = saveRoutes;
    // 学习窗口
    $('knKind').onchange = toggleKnKind;
    $('knSubmit').onclick = submitKnowledge;
    $('knReload').onclick = loadAdmKnowledge;
    $('knFilter').onchange = loadAdmKnowledge;
    $('knDownload').onclick = downloadSkillPackage;
    const mdBtn = $('knDownloadMd'); if (mdBtn) mdBtn.onclick = downloadBuiltinSkillMd;
    const bundleBtn = $('knDownloadBundle'); if (bundleBtn) bundleBtn.onclick = downloadBuiltinSkillBundle;
    $('knRunAuto').onclick = runAutoLearning;
    $('knRunAudit').onclick = runWeeklyAudit;
    $('knReports').onclick = loadLearnReports;
    toggleKnKind();
    // 反馈处置
    $('fbReload').onclick = loadAdmFeedback;
    // v2.189 导出反馈总表：带当前筛选条件，触发浏览器下载 JSON（含附图 base64，可投喂 TRAE）
    $('fbExportBtn').onclick = async () => {
      const status = $('fbStatus').value, type = $('fbType').value;
      const q = new URLSearchParams(); if (status) q.set('status', status); if (type) q.set('type', type);
      try {
        const r = await Api.request('/api/feedback/admin/export' + (q.toString() ? '?' + q.toString() : ''));
        if (!r.ok) await Api.jsonOrThrow(r); // v2.239：失败统一走 v2.226 脱敏层（成功路径保留 blob 下载）
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedback-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        xnSay(lang === 'en' ? 'Exported' : '已导出');
      } catch (e) { xnSay(e.message || String(e)); }
    };
    $('fbStatus').onchange = loadAdmFeedback;
    $('fbType').onchange = loadAdmFeedback;
    $('fbTodoBtn').onclick = toggleTodoView;
    $('fbTodoSort').onchange = loadAdmTodos;
    // v2.219 广告位管理
    $('adReload').onclick = loadAdmAds;
    $('adNewBtn').onclick = () => openAdForm(null);
    $('adSave').onclick = saveAd;
    $('adCancel').onclick = () => { $('adFormBox').classList.add('hidden'); adEditingId = null; };
    // 合规规则库
    $('sfReload').onclick = loadAdmSafety;
    $('sfAdd').onclick = addAdmSafetyRule;
    $('sfReset').onclick = resetAdmSafety;
    // v2.43 接续档案
    $('hdReload').onclick = loadAdmHandoff;
    $('hdSave').onclick = saveAdmHandoff;
    $('hdAppend').onclick = appendAdmHandoff;
    $('hdCopy').onclick = copyHandoffBrief;
    $('hdDownload').onclick = downloadHandoffBrief;
    $('hdImport').onchange = importAdmHandoff;
    // v2.187 工具优化弹窗铁律：发布更新公告面板事件绑定
    $('admUpdReload').onclick = loadAdmUpdates;
    $('admUpdSubmit').onclick = submitAdmUpdate;
    // v2.612 供应商余额监控面板事件绑定
    $('balReload').onclick = loadAdmBalances;
    $('balSave').onclick = saveAdmBalance;
    $('balRefresh').onclick = refreshAdmBalances;
  }
  // ── v2.612 供应商余额监控（仅超管）──
  const BAL_COLOR = { NORMAL: '#16a34a', LOW: '#eab308', CRITICAL: '#dc2626', UNKNOWN: '#6b7280' };
  function balBadge(level) { return `<span class="bal-badge bal-${level.toLowerCase()}" style="background:${BAL_COLOR[level] || '#6b7280'}">${level}</span>`; }
  async function loadAdmBalances() {
    const listEl = $('balList'); const sumEl = $('balSummary'); const sel = $('balProvider'); const missEl = $('balMissing');
    if (listEl) znSkeleton(listEl);
    if (sumEl) sumEl.textContent = '';
    try {
      const res = await Api.request('/api/admin/model/balances');
      const d = await Api.jsonOrThrow(res); // v2.239：统一走 v2.226 脱敏层，内部裸码回落本地友好文案
      // 列表
      const rows = Array.isArray(d.balances) ? d.balances : [];
      if (listEl) {
        if (rows.length === 0) listEl.innerHTML = `<div class="muted">尚无记录。可点"触发自动查询"或右侧手动填值。</div>`;
        else listEl.innerHTML = rows.map((r) => {
          const yuan = r.balanceYuan === null || r.balanceYuan === undefined ? '—' : `¥${Number(r.balanceYuan).toFixed(2)}`;
          const src = r.source === 'MANUAL' ? '手动' : '自动';
          const upd = r.updatedAt ? new Date(r.updatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN') : '';
          const err = r.errorMsg ? `<div class="muted" style="color:#c0392b;font-size:11px;margin-top:2px">⚠ ${escapeHtml(r.errorMsg)}</div>` : '';
          return `<div class="card row-card">
            <div>${balBadge(r.alertLevel)} <b>${escapeHtml(r.providerName)}</b> <span class="muted">(${escapeHtml(r.vendor)})</span></div>
            <div class="muted" style="margin-top:4px">余额 <b>${yuan}</b> · 阈值 ¥${Number(r.thresholdYuan || 0).toFixed(2)} · ${src} · ${upd}</div>
            ${err}
          </div>`;
        }).join('');
      }
      // 汇总
      const s = d.summary || {};
      if (sumEl) sumEl.textContent = `汇总：合计 ¥${(s.total || 0).toFixed(2)} · CRITICAL ${s.critical?.length || 0} · LOW ${s.low?.length || 0} · UNKNOWN ${s.unknown?.length || 0} · 最严重 ${s.worstLevel || 'NORMAL'}`;
      // 手动填值下拉：合并 missing + 已记录余额的 provider（让用户也能改既有记录）
      const all = [
        ...(d.missing || []).map((m) => ({ providerId: m.providerId, providerName: m.providerName, vendor: m.vendor })),
        ...rows.map((r) => ({ providerId: r.providerId, providerName: r.providerName, vendor: r.vendor })),
      ];
      const seen = new Set(); const uniq = all.filter((x) => !seen.has(x.providerId) && seen.add(x.providerId));
      if (sel) sel.innerHTML = uniq.length === 0 ? '<option value="">（先在「模型配置」里加供应商）</option>'
        : uniq.map((p) => `<option value="${escapeHtml(p.providerId)}">${escapeHtml(p.providerName)} · ${escapeHtml(p.vendor)}</option>`).join('');
      // missing 提示
      if (missEl) {
        const miss = d.missing || [];
        const autoMiss = miss.filter((m) => m.strategy?.auto);
        const manualMiss = miss.filter((m) => !m.strategy?.auto);
        missEl.innerHTML = autoMiss.length || manualMiss.length
          ? `<div class="muted" style="font-size:12px">未记录余额的供应商：${autoMiss.length} 个可自动查询、${manualMiss.length} 个需手动填值</div>`
          : `<div class="muted" style="font-size:12px">全部供应商均已记录余额</div>`;
      }
    // v2.256：错误源已走 Api.jsonOrThrow 脱敏层；muted 弱提示改 znErrorHtml（balRefresh 可重试）
    } catch (e) { if (listEl) listEl.innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Failed to load.' : '加载失败')); }
  }
  async function saveAdmBalance() {
    const pid = $('balProvider')?.value; if (!pid) { xnSay('请先选择供应商'); return; }
    const yuan = parseFloat($('balYuan').value);
    if (Number.isNaN(yuan)) { xnSay('余额必须是数字'); return; }
    const threshold = $('balThreshold').value ? parseFloat($('balThreshold').value) : undefined;
    const note = $('balNote').value.trim() || undefined;
    try {
      const res = await Api.request(`/api/admin/model/balances/${encodeURIComponent(pid)}`, {
        method: 'POST', body: JSON.stringify({ balanceYuan: yuan, thresholdYuan: threshold, note }),
      });
      if (!res.ok) await Api.jsonOrThrow(res); // v2.239：失败统一走 v2.226 脱敏层
      xnSay(lang === 'en' ? 'Saved' : '已保存');
      $('balYuan').value = ''; $('balNote').value = '';
      await loadAdmBalances();
    } catch (e) { xnSay(e.message || String(e)); }
  }
  async function refreshAdmBalances() {
    const btn = $('balRefresh'); if (btn) { btn.disabled = true; btn.textContent = '查询中…'; }
    try {
      const res = await Api.request('/api/admin/model/balances/refresh', { method: 'POST', body: '{}' });
      const d = await Api.jsonOrThrow(res); // v2.239：统一走 v2.226 脱敏层，内部裸码回落本地友好文案
      const arr = Array.isArray(d.results) ? d.results : [];
      const ok = arr.filter((r) => !r.skipped && !r.error).length;
      const fail = arr.filter((r) => r.error).length;
      const skip = arr.filter((r) => r.skipped).length;
      xnSay(`自动查询完成：成功 ${ok} / 失败 ${fail} / 跳过 ${skip}`);
      await loadAdmBalances();
    } catch (e) { xnSay(e.message || String(e)); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '触发自动查询'; } }
  }
  // ── v2.187 工具优化弹窗铁律：超管发布更新公告 ──
  async function loadAdmUpdates() {
    const listEl = $('admUpdList');
    if (listEl) znSkeleton(listEl);
    try {
      // 复用 /api/updates/latest（只读最新一条）；历史全量走 /api/updates/since?version=0.0.0
      const res = await Api.request('/api/updates/since?version=0.0.0');
      const data = await Api.jsonOrThrow(res);
      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) { if (listEl) znEmpty(listEl, lang === 'en' ? 'No announcements yet.' : '暂无公告。'); return; }
      if (listEl) listEl.innerHTML = items.map((a) => {
        const title = a.titleZh || a.titleEn || `v${a.version}`;
    // @module admin
        const body = (a.bodyZh || a.bodyEn || '').slice(0, 200);
        const pinned = a.pinned ? `<span class="badge">${lang === 'en' ? 'Pinned' : '置顶'}</span> ` : '';
        const ver = escapeHtml(a.version);
        const t1 = escapeHtml(title);
        const b1 = escapeHtml(body);
        const d = a.createdAt ? new Date(a.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN') : '';
        return `<div class="card row-card"><div>${pinned}<b>v${ver}</b> <span>${t1}</span> <span class="muted">${d}</span></div><div class="muted" style="margin-top:4px;white-space:pre-wrap">${b1}</div></div>`;
      }).join('');
    // v2.256：错误源已走 Api.jsonOrThrow 脱敏层；muted 弱提示改 znErrorHtml
    } catch (e) { if (listEl) listEl.innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Failed to load.' : '加载失败')); }
  }
  async function submitAdmUpdate() {
    const version = $('admUpdVer').value.trim();
    const titleZh = $('admUpdTitleZh').value.trim();
    const titleEn = $('admUpdTitleEn').value.trim() || null;
    const bodyZh = $('admUpdBodyZh').value.trim();
    const bodyEn = $('admUpdBodyEn').value.trim() || null;
    const pinned = $('admUpdPinned').checked;
    if (!version) { xnSay(lang === 'en' ? 'Version required' : '请填写版本号'); return; }
    if (!titleZh) { xnSay(lang === 'en' ? 'Title required' : '请填写中文标题'); return; }
    if (!bodyZh) { xnSay(lang === 'en' ? 'Body required' : '请填写中文正文'); return; }
    try {
      const res = await Api.request('/api/admin/updates', {
        method: 'POST',
        body: JSON.stringify({ version, titleZh, titleEn, bodyZh, bodyEn, pinned }),
      });
      const j = await Api.jsonOrThrow(res);
      xnSay(lang === 'en' ? `Published v${j.version}` : `已发布 v${j.version}`);
      $('admUpdVer').value = ''; $('admUpdTitleZh').value = ''; $('admUpdTitleEn').value = '';
      $('admUpdBodyZh').value = ''; $('admUpdBodyEn').value = ''; $('admUpdPinned').checked = false;
      loadAdmUpdates();
    } catch (e) { xnSay(e.message || String(e)); }
  }
  // ── v2.43 迭代接续档案：系统快照只读、脉络可编辑、口令一键带走 ──
  let hdCache = null;
    // @module admin
  const linesOf = (id) => $(id).value.split('\n').map((s) => s.trim()).filter(Boolean);
  async function loadAdmHandoff() {
    // v2.286 tab loader 断网/非 ok 就地错误态，绝不冒泡 unhandledrejection
    let hd;
    try {
      hd = await admApi('/handoff');
    } catch (e) {
      $('hdSnapshot').innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Request failed.' : '请求失败'));
      return;
    }
    hdCache = hd;
    const { snapshot, data, brief } = hd;
    $('hdSnapshot').innerHTML = `<b>${escapeHtml(snapshot.product)} v${escapeHtml(snapshot.version)}</b>　` +
      snapshot.facts.map((f) => `${escapeHtml(f.label)}：${escapeHtml(f.value)}`).join('　｜　');
    $('hdLast').value = data.lastDelivery || '';
    $('hdBacklog').value = (data.backlog || []).join('\n');
    $('hdQuestions').value = (data.openQuestions || []).join('\n');
    $('hdNext').value = data.nextPlan || '';
    $('hdNotes').value = data.notes || '';
    $('hdBrief').value = brief;
  }
  function hdBody() {
    return {
      lastDelivery: $('hdLast').value, nextPlan: $('hdNext').value, notes: $('hdNotes').value,
      backlog: linesOf('hdBacklog'), openQuestions: linesOf('hdQuestions'),
      iterationLog: hdCache?.data?.iterationLog || [],
    };
  }
  async function saveAdmHandoff() {
    try {
      const j = await admApi('/handoff', { method: 'PUT', body: JSON.stringify(hdBody()) });
      hdCache = { ...(hdCache || {}), data: j.data, brief: j.brief };
      $('hdBrief').value = j.brief; xnSay('接续脉络已加密保存');
    } catch (e) { xnSay((e && e.message) || (lang === 'en' ? 'Save failed.' : '保存失败')); }
  }
  async function appendAdmHandoff() {
    const version = $('hdLogVer').value.trim(), summary = $('hdLogSum').value.trim();
    if (!version || !summary) { xnSay('版本号与内容都要填'); return; }
    try {
      const j = await admApi('/handoff/append', { method: 'POST', body: JSON.stringify({ version, date: new Date().toISOString().slice(0, 10), summary }) });
      hdCache = { ...(hdCache || {}), data: j.data };
      await saveAdmHandoff(); $('hdLogVer').value = ''; $('hdLogSum').value = '';
    } catch (e) { xnSay((e && e.message) || (lang === 'en' ? 'Save failed.' : '保存失败')); }
  }
  async function copyHandoffBrief() {
    const txt = $('hdBrief').value;
    try { await navigator.clipboard.writeText(txt); xnSay('接续口令已复制，去新窗口粘贴即可'); }
    catch { $('hdBrief').select(); document.execCommand('copy'); xnSay('已复制'); }
  }
  function downloadHandoffBrief() {
    const blob = new Blob([$('hdBrief').value], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'zhongnan-handoff-v' + (hdCache?.snapshot?.version || '') + '.md';
    a.click(); URL.revokeObjectURL(a.href);
  }
  async function importAdmHandoff(ev) {
    const file = ev.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const j = await admApi('/handoff/import', { method: 'POST', body: JSON.stringify({ data }) });
      hdCache = { ...(hdCache || {}), data: j.data }; await loadAdmHandoff(); xnSay('档案已导入并保存');
    } catch (e) { xnSay('导入失败：' + (e.message || '文件不合法')); }
    ev.target.value = '';
  }
  // ── 合规规则库（PRD 9.2.6 敏感词库，默认规则只读可停用，自定义可增删）──
  async function loadAdmSafety() {
    // v2.286 断网/非 ok 就地错误态进表区，不冒泡（切 tab fire-and-forget 无调用点 catch）
    let d;
    try {
      d = await admApi('/safety/rules');
    } catch (e) {
      $('sfTbody').innerHTML = `<tr><td colspan="6">${znErrorHtml((e && e.message) || (lang === 'en' ? 'Request failed.' : '请求失败'))}</td></tr>`;
      return;
    }
    const c = d.counts || {};
    $('sfCounts').textContent = (lang === 'en'
      ? `Total ${c.total} · active ${c.active} · BLOCK ${c.block} · WARN ${c.warn} · custom ${c.custom} · disabled ${c.disabled}`
      : `共 ${c.total} 条 · 生效 ${c.active} · 硬拦截 ${c.block} · 预警 ${c.warn} · 自定义 ${c.custom} · 停用 ${c.disabled}`);
    // @module admin
    const sevTag = (sv) => sv === 'BLOCK'
      ? '<span style="color:var(--danger,#e5484d);font-weight:600">BLOCK</span>'
      : '<span style="color:#d9a23b;font-weight:600">WARN</span>';
    $('sfTbody').innerHTML = d.rules.map((r) => {
      const src = r.builtin ? (lang === 'en' ? 'builtin' : '内置') : (lang === 'en' ? 'custom' : '自定义');
      const toggle = `<button data-id="${r.id}" data-act="toggle" data-active="${r.active ? '0' : '1'}" class="btn-ghost">${r.active ? (lang==='en'?'disable':'停用') : (lang==='en'?'enable':'启用')}</button>`;
      const del = r.builtin ? '<span class="muted">—</span>' : `<button data-id="${r.id}" data-act="del" class="btn-ghost">${lang==='en'?'delete':'删除'}</button>`;
      return `<tr style="${r.active ? '' : 'opacity:.5'}">
        <td>${sevTag(r.severity)}</td>
        <td><b>${escapeHtml(r.label)}</b><div class="muted">${escapeHtml(r.category||'')}</div></td>
        <td class="muted" style="max-width:260px">${r.patterns.map(escapeHtml).join('、')}</td>
        <td>${src}</td>
        <td>${r.active ? (lang==='en'?'active':'生效中') : (lang==='en'?'disabled':'已停用')}</td>
        <td class="adm-acts">${toggle}${del}</td></tr>`;
    }).join('');
    $('sfTbody').querySelectorAll('[data-act="toggle"]').forEach((b) => b.onclick = () => toggleAdmSafety(b.getAttribute('data-id'), b.getAttribute('data-active') === '1'));
    $('sfTbody').querySelectorAll('[data-act="del"]').forEach((b) => b.onclick = () => delAdmSafety(b.getAttribute('data-id')));
  }
  async function addAdmSafetyRule() {
    const severity = $('sfSeverity').value, label = $('sfLabel').value.trim();
    const patterns = $('sfPatterns').value.trim();
    const advice = $('sfAdvice').value.trim();
    if (!label || !patterns) { xnSay(lang === 'en' ? 'Name and keywords required.' : '请填规则名称和命中词'); return; }
    try {
      await admApi('/safety/rules', { method: 'POST', body: JSON.stringify({ severity, label, patterns, advice }) });
      $('sfLabel').value = ''; $('sfPatterns').value = ''; $('sfAdvice').value = '';
      xnSay(lang === 'en' ? 'Rule added, effective immediately.' : '规则已新增，全局即时生效～'); loadAdmSafety();
    } catch (e) { xnSay(e.message); }
  }
  async function toggleAdmSafety(id, active) {
    try {
      await admApi(`/safety/rules/${encodeURIComponent(id)}/toggle`, { method: 'POST', body: JSON.stringify({ active }) });
      loadAdmSafety();
    } catch (e) { xnSay((e && e.message) || (lang === 'en' ? 'Request failed.' : '操作失败')); }
  }
  async function delAdmSafety(id) {
    if (!(await uiConfirm({ body: lang === 'en' ? 'Delete this custom rule?' : '删除该自定义规则？', danger: true, okText: lang === 'en' ? 'Delete' : '删除' }))) return;
    try {
      await admApi(`/safety/rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadAdmSafety();
    } catch (e) { xnSay((e && e.message) || (lang === 'en' ? 'Request failed.' : '删除失败')); }
  }
  async function resetAdmSafety() {
    if (!(await uiConfirm({ body: lang === 'en' ? 'Reset to built-in rules?' : '恢复为默认规则库？所有自定义与停用将清空', danger: true, okText: lang === 'en' ? 'Reset' : '重置' }))) return;
    try {
      await admApi('/safety/reset', { method: 'POST', body: '{}' });
      xnSay(lang === 'en' ? 'Reset done.' : '已恢复默认规则库'); loadAdmSafety();
    } catch (e) { xnSay((e && e.message) || (lang === 'en' ? 'Request failed.' : '操作失败')); }
  }
  // c199 开设账号（仅主账号）：预设初始密码 + 权限档，可选授副管理员；成功即刷新列表
  async function admCreateUser() {
    const phone = $('admCreatePhone').value.trim();
    const pw = $('admCreatePw').value;
    const nickname = $('admCreateNick').value.trim();
    const level = $('admCreateLevel').value;
    if (!/^1[3-9]\d{9}$/.test(phone)) { xnSay(lang === 'en' ? 'Invalid phone number.' : '手机号格式不正确'); return; }
    if ((pw || '').length < 8 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) { xnSay(lang === 'en' ? 'Initial password: 8+ characters with letters and numbers.' : '初始密码至少 8 位，且需同时包含字母和数字'); return; }
    try {
      await admApi('/users', { method: 'POST', body: JSON.stringify({ phone, initialPassword: pw, level, nickname: nickname || undefined, isAdmin: $('admCreateIsAdmin').checked }) });
      xnSay(lang === 'en' ? 'Account created. Share the phone + initial password with the user.' : '账号已开设，把手机号与初始密码交给对方即可登录');
      $('admCreatePhone').value = ''; $('admCreatePw').value = ''; $('admCreateNick').value = ''; $('admCreateIsAdmin').checked = false;
      admPage = 1; loadAdmUsers();
    } catch (e) { xnSay(e.message); }
  }
  // v2.229 admin 用户表翻页：纯文本页码升级为可交互 pager（admPage 此前恒为 1，第 2 页不可达）
  function renderAdmUserPager(d) {
    const { pages, hasPrev, hasNext } = znPagerState(d.total, d.page, 20);
    $('admUserPager').innerHTML = `<span>${t('admTotal')} ${d.total} · ${t('admPage')} ${d.page}/${pages}</span>`
      + ` <button class="btn-ghost" id="admPrevPage"${hasPrev ? '' : ' disabled'}>‹ ${lang === 'en' ? 'Prev' : '上一页'}</button>`
      + ` <button class="btn-ghost" id="admNextPage"${hasNext ? '' : ' disabled'}>${lang === 'en' ? 'Next' : '下一页'} ›</button>`;
    $('admPrevPage').onclick = () => { if (admPage > 1) { admPage--; loadAdmUsers(); } };
    $('admNextPage').onclick = () => { admPage++; loadAdmUsers(); };
  }
  async function loadAdmUsers() {
    const q = encodeURIComponent($('admUserQ').value.trim());
    // v2.267 [P1-2] 403（非超管）必须就地兜底：裸 await 会变 unhandled rejection 上报 pageerror，
    // 与 models/balances tab 同范式——错误渲染进表区、清空 pager，绝不冒泡。
    let d;
    try {
      d = await admApi(`/users?q=${q}&page=${admPage}&pageSize=20`);
    } catch (e) {
      $('admUserTable').innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Request failed.' : '请求失败'));
      $('admUserPager').innerHTML = '';
      return;
    }
    const head = `<thead><tr>
      <th>${t('admU_user')}</th><th>${t('admU_level')}</th><th>${t('points')}</th><th>${t('admU_works')}</th><th>${t('admU_actions')}</th></tr></thead>`;
    const rows = d.items.map((u) => {
      const opts = ['FREE', 'BASIC', 'ADVANCED', 'PRO'].map((L) => `<option value="${L}" ${u.level === L ? 'selected' : ''}>${lvName(L)}</option>`).join('');
      const name = escapeHtml(u.nickname || '—') + (u.penName ? ` <span class="muted">(${escapeHtml(u.penName)})</span>` : '') + (u.isAdmin ? ` <span class="muted">· ${t('admAdminTag')}</span>` : '');
      const phone = `<div class="muted">${escapeHtml(u.phone || '—')}${u.banned ? ` <b style="color:var(--danger,#e5484d)">${t('admBanned')}</b>` : ''}</div>`;
      return `<tr data-uid="${u.id}">
        <td>${name}${phone}</td>
        <td><select data-act="level">${opts}</select></td>
        <td>${u.balance}</td>
        <td>${u.projectCount}</td>
        <td class="adm-acts">
          <input data-act="delta" type="number" step="1" placeholder="±${t('points')}" class="mini-num" />
          <button data-act="points" class="btn-ghost">${t('admAdjust')}</button>
          <button data-act="ban" class="btn-ghost">${u.banned ? t('admUnban') : t('admBan')}</button>
          <button data-act="resetpw" class="btn-ghost">${t('admResetPw')}</button>
          <button data-act="adminflag" class="btn-ghost">${u.isAdmin ? t('admUnsetAdmin') : t('admSetAdmin')}</button>
        </td></tr>`;
    }).join('');
    $('admUserTable').innerHTML = head + '<tbody>' + rows + '</tbody>';
    renderAdmUserPager(d);
    $('admUserTable').querySelectorAll('tbody tr').forEach((tr) => {
      const uid = tr.getAttribute('data-uid');
      tr.querySelector('[data-act="level"]').onchange = (e) => admSetLevel(uid, e.target.value);
      tr.querySelector('[data-act="points"]').onclick = async () => {
        const delta = parseInt(tr.querySelector('[data-act="delta"]').value, 10);
        if (!delta) { xnSay(lang === 'en' ? 'Enter a non-zero number.' : '请输入非零积分变动'); return; }
        const reason = await uiPrompt({ body: lang === 'en' ? 'Reason (logged):' : '调整原因（记入流水）：', value: '后台调整' });
        if (!reason) return;
        admApi('/users/' + uid + '/points', { method: 'POST', body: JSON.stringify({ delta, reason }) })
          .then(() => { xnSay(t('admOk')); loadAdmUsers(); }).catch((e) => xnSay(e.message));
      };
      tr.querySelector('[data-act="ban"]').onclick = () => {
        const cur = tr.querySelector('[data-act="ban"]').textContent;
        const banned = cur === t('admBan');
        admApi('/users/' + uid + '/ban', { method: 'POST', body: JSON.stringify({ banned }) })
          .then(() => { xnSay(t('admOk')); loadAdmUsers(); }).catch((e) => xnSay(e.message));
      };
      tr.querySelector('[data-act="resetpw"]').onclick = async () => {
        const np = await uiPrompt({ body: lang === 'en' ? 'New password (8-64, letters + numbers):' : '为该用户设置新密码（8-64 位，需含字母和数字）：', type: 'password' });
        if (!np) return;
        if (np.length < 8 || !/[a-zA-Z]/.test(np) || !/\d/.test(np)) { xnSay(lang === 'en' ? '8+ characters with letters and numbers.' : '至少 8 位，且需同时包含字母和数字'); return; }
        admApi('/users/' + uid + '/reset-password', { method: 'POST', body: JSON.stringify({ newPassword: np }) })
          .then(() => xnSay(t('admOk'))).catch((e) => xnSay(e.message));
      };
      // v2.219 管理员标记（isAdmin）：主账号「一人独大」口径下唯一的副管理员授予/回收口
      tr.querySelector('[data-act="adminflag"]').onclick = () => {
        const grant = tr.querySelector('[data-act="adminflag"]').textContent === t('admSetAdmin');
        admApi('/users/' + uid + '/admin-flag', { method: 'POST', body: JSON.stringify({ isAdmin: grant }) })
          .then(() => { xnSay(t('admAdminFlagOk')); loadAdmUsers(); }).catch((e) => xnSay(e.message));
      };
    });
  }
  async function admSetLevel(uid, level) {
    try { await admApi('/users/' + uid + '/level', { method: 'POST', body: JSON.stringify({ level }) }); xnSay(t('admOk')); }
    catch (e) { xnSay(e.message); loadAdmUsers(); }
  }
  function statCard(label, val, sub) {
    return `<div class="stat-card"><b>${val}</b><span>${label}${sub ? `<em>${sub}</em>` : ''}</span></div>`;
  }
  async function loadAdmStats() {
    let d;
    try {
      d = await admApi('/stats/overview');
    } catch (e) {
      $('admStatCards').innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Request failed.' : '请求失败'));
      return;
    }
    const cards = [
      statCard(t('admS_users'), d.users.total, `${t('admS_newToday')} ${d.users.newToday} · ${t('admS_banned')} ${d.users.banned}`),
      statCard(t('admS_projects'), d.projects.total, Object.entries(d.projects.byMode).map(([k, v]) => `${k}:${v}`).join(' ')),
      statCard(t('admS_scripts'), d.scripts.total, `${t('admS_qc')} ${d.scripts.qcPassed}`),
      statCard(t('admS_posts'), d.community.posts, `${t('admS_hidden')} ${d.community.postsHidden}`),
      statCard(t('admS_listings'), d.market.listings, `${t('admS_onShelf')} ${d.market.onShelf} · ${t('admS_sold')} ${d.market.sold}`),
      statCard(t('admS_orders'), d.orders.total, Object.entries(d.orders.byStatus).map(([k, v]) => `${k}:${v}`).join(' ')),
      statCard(t('admS_levels'), Object.entries(d.users.byLevel).map(([k, v]) => `${lvName(k)}${v}`).join(' / ')),
    ];
    $('admStatCards').innerHTML = cards.join('');
  }
  async function loadAdmFinance() {
    let d;
    try {
      d = await admApi('/finance/overview');
    } catch (e) {
      $('admFinanceCards').innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Request failed.' : '请求失败'));
      return;
    }
    $('admFinanceCards').innerHTML =
      statCard(t('admF_revenue'), '¥' + (d.paidRevenueFen / 100).toFixed(2), `${t('admF_paidCount')} ${d.paidOrderCount}`) +
      statCard(t('admF_pointsIn'), d.points.in, '') +
      statCard(t('admF_pointsOut'), d.points.out, '');
    const kinds = Object.entries(d.byKind);
    $('admKindTable').innerHTML = `<thead><tr><th>${t('admF_kind')}</th><th>${t('admF_count')}</th><th>${t('admF_amount')}</th><th>${t('points')}</th></tr></thead>
      <tbody>${kinds.map(([k, v]) => `<tr><td>${k}</td><td>${v.count}</td><td>¥${(v.amountFen / 100).toFixed(2)}</td><td>${v.points}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">—</td></tr>`}</tbody>`;
  }
  async function loadAdmPosts() {
    const filter = $('admPostFilter').value;
    let d;
    try {
      d = await admApi('/posts?hidden=' + filter);
    } catch (e) {
      $('admPostList').innerHTML = znErrorHtml((e && e.message) || (lang === 'en' ? 'Request failed.' : '请求失败'));
      return;
    }
    $('admPostList').innerHTML = d.items.map((p) => `<div class="post-card">
      <h4>${escapeHtml(p.title)} ${p.hidden ? `<b style="color:var(--danger,#e5484d)">[${t('admHidden')}]</b>` : ''}</h4>
      <div class="pc-body">${escapeHtml(p.body)}</div>
      <div class="pc-foot"><span class="muted">${p.section} · ${new Date(p.createdAt).toLocaleString()}</span><span class="spacer"></span>
      <button class="btn-ghost" data-hide="${p.id}" data-tohide="${p.hidden ? 0 : 1}">${p.hidden ? t('admRestore') : t('admHide')}</button></div></div>`).join('') ||
      znEmptyHtml(lang === 'en' ? 'No posts.' : '暂无帖子');
    $('admPostList').querySelectorAll('[data-hide]').forEach((b) => b.onclick = () => {
      admApi('/posts/' + b.getAttribute('data-hide') + '/hide', { method: 'POST', body: JSON.stringify({ hidden: b.getAttribute('data-tohide') === '1' }) })
        .then(() => { xnSay(t('admOk')); loadAdmPosts(); }).catch((e) => xnSay(e.message));
    });
  }
  /* ---------- 管理后台：模型配置 ---------- */
  // 文本三档 + 图片两档；图片旗舰默认 gpt-image-1（PRD 必含 ChatGPT image 生成）
  const MODEL_GROUPS = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.MODEL_GROUPS) || [
    { kind: 'text', label: { zh: '文本引擎（剧本创作）', en: 'Text engines (script)' }, tiers: [
      { key: 'economy', zh: '经济档', en: 'Economy' }, { key: 'standard', zh: '标准档', en: 'Standard' }, { key: 'flagship', zh: '旗舰档', en: 'Flagship' }] },
    { kind: 'image', label: { zh: '图片引擎（剧本海报）', en: 'Image engines (poster)' }, tiers: [
      { key: 'standard', zh: '标准图片', en: 'Standard image' }, { key: 'flagship', zh: '旗舰图片（gpt-image）', en: 'Flagship (gpt-image)' }] },
  ];
  async function loadAdmModels() {
    let cfg;
    try { cfg = await admApi('/model/'); }
    catch (e) { $('admModelWrap').innerHTML = znErrorHtml((e && e.message) || t('loadFail')); return; }
    $('admModelUpdated').textContent = cfg.updatedAt
      ? (lang === 'en' ? 'Updated: ' : '最近更新：') + new Date(cfg.updatedAt).toLocaleString()
      : (lang === 'en' ? 'Not configured yet' : '尚未配置，将回退环境变量');
    $('admModelWrap').innerHTML = MODEL_GROUPS.map((g) => {
      const rows = g.tiers.map((tt) => {
        const c = cfg[g.kind][tt.key] || {};
        return `<div class="model-row" data-kind="${g.kind}" data-tier="${tt.key}">
          <div class="model-tier">${lang === 'en' ? tt.en : tt.zh}
            ${c.hasKey ? `<span class="badge ok">${escapeHtml(c.keyMask || '')}</span>` : `<span class="badge">${lang==='en'?'no key':'未配置'}</span>`}</div>
          <div class="model-fields">
            <input data-f="baseUrl" value="${escapeHtml(c.baseUrl || '')}" placeholder="${lang === 'en' ? 'Base URL (e.g. https://api.openai.com/v1)' : 'Base URL（如 https://api.openai.com/v1）'}" />
            <input data-f="model" value="${escapeHtml(c.model || '')}" placeholder="${lang === 'en' ? 'Model (e.g. gpt-4.1-mini / gpt-image-1)' : 'Model（如 gpt-4.1-mini / gpt-image-1）'}" />
            <input data-f="apiKey" type="password" autocomplete="new-password" placeholder="${c.hasKey ? (lang==='en'?'Leave blank to keep current key':'留空表示不修改已加密密钥') : 'API Key'}" />
          </div></div>`;
      }).join('');
      return `<div class="model-group"><h4>${lang === 'en' ? g.label.en : g.label.zh}</h4>${rows}</div>`;
    }).join('');
  }
  async function saveAdmModels() {
    const body = { text: {}, image: {} };
    $('admModelWrap').querySelectorAll('.model-row').forEach((row) => {
      const kind = row.getAttribute('data-kind'), tier = row.getAttribute('data-tier');
    // @module admin
      const get = (f) => row.querySelector(`[data-f="${f}"]`).value.trim();
      const entry = { baseUrl: get('baseUrl'), model: get('model') };
      const key = get('apiKey'); if (key) entry.apiKey = key; // 空则不传，后端保留原密钥
      body[kind][tier] = entry;
    });
    try {
      await admApi('/model/', { method: 'PUT', body: JSON.stringify(body) });
      xnSay(lang === 'en' ? 'Saved (encrypted).' : '已加密保存');
      await loadAdmModels();
    } catch (e) { xnSay(e.message); }
  }

  /* ---------- v2.41 组合全景 + 供应商池 + 九岗路由 ---------- */
  let pfCache = null, pvCache = { providers: [], routing: {} }, editingPvId = '';
  async function loadAdmPortfolio() {
    // v2.306 裸 await 收口：admApi reject（断网/非 ok）不得冒泡 unhandledrejection——失败提示后早退，面板保旧
    try { pfCache = await admApi('/model/portfolio'); } catch (e) { xnSay(e.message); return; }
    const j = pfCache;
    $('admPfSummary').textContent = `顺序自检：${j.orderErrors.length ? '❌ ' + j.orderErrors.join('；') : '✅ 合法（市场前置→架构→…→市场终评）'} · 自定义路由每集估算裸成本 ${j.routedCostFenPerEp} 分`;
    const orderTxt = j.order.map((s) => `${s.order}.${s.label}`).join(' → ');
    const floorRows = ['FREE', 'BASIC', 'ADVANCED', 'PRO'].map((lv) => {
      const cells = ['economy', 'standard', 'flagship'].map((tid) => {
        const f = j.floorChecks.find((x) => x.level === lv && x.tier === tid);
        if (!f) return '<td>—</td>';
        const pct = f.margin >= 0 ? Math.round(f.margin * 100) + '%' : '—';
        return `<td style="color:${f.ok ? 'var(--ok,#3a9e6e)' : 'var(--danger,#e5484d)'}">售${(f.chargedFen / 100).toFixed(2)}元/成本${(f.costFen / 100).toFixed(3)}元/毛利${pct} ${f.ok ? '✓' : '✗击穿'}</td>`;
      }).join('');
      return `<tr><td>${lv}</td>${cells}</tr>`;
    }).join('');
    const adviceRows = j.advice.map((a) => `<tr><td>${j.roleLabels[a.role] || a.role}</td><td><b>${escapeHtml(a.primary)}</b></td><td>${a.backups.map(escapeHtml).join('、') || '—'}</td></tr>`).join('');
    const imgRows = j.imageCatalog.map((m) => `<tr><td>${escapeHtml(m.vendor)}·${escapeHtml(m.name)}</td><td>${escapeHtml(m.defaultBaseUrl || '中转')}</td><td>${escapeHtml(m.note)}</td></tr>`).join('');
    const faq = j.faq.map((f) => `<p><b>Q：${escapeHtml(f.q)}</b><br>${escapeHtml(f.a)}</p>`).join('');
    // v2.51 国产替补铁规自检 + 自动迭代提示
    const sc = j.backupSelfCheck || { ok: true, issues: [], upgradeHints: [], manualNeeded: [] };
    const bkIssues = sc.issues.length
      ? znErrorHtml('国产替补自检未过', sc.issues.map((i) => `${i.role}：${i.problem}${i.suggest.length ? ' → 建议：' + i.suggest.join('/') : ''}`).join('；'))
      : '<div class="notice">国产最强替补自检 ✅ 三档八岗每岗第一替补均为该岗中国国内最强 API（v2.52 策展排序），海外首选断供时不降配兜底。</div>';
    const bkUp = sc.upgradeHints && sc.upgradeHints.length
      ? `<div class="notice">自动迭代候选（需联网横评+真实账单确认后换型）：<br>${sc.upgradeHints.map((h) => `· ${escapeHtml(h.role)}：${escapeHtml(h.note)}`).join('<br>')}</div>` : '';
    // @module admin
    const bkManual = (sc.manualNeeded || []).length ? `<details><summary>系统无法自动迭代、需你拍板的情形</summary><div class="notice">${sc.manualNeeded.map((m) => '· ' + escapeHtml(m)).join('<br>')}</div></details>` : '';
    $('admPortfolio').innerHTML = `
      <div class="notice">流水线顺序：${orderTxt}</div>
      ${bkIssues}${bkUp}${bkManual}
      <table class="adm-table"><thead><tr><th>等级</th><th>经济档（实付/裸成本/毛利）</th><th>标准档</th><th>旗舰档</th></tr></thead><tbody>${floorRows}</tbody></table>
      <table class="adm-table"><thead><tr><th>岗位</th><th>首选</th><th>备选（前三）</th></tr></thead><tbody>${adviceRows}</tbody></table>
      <details><summary>图片模型端口（${j.imageCatalog.length} 家，含 GPT-image）</summary><table class="adm-table"><tbody>${imgRows}</tbody></table></details>
      <details><summary>口径 FAQ（baseUrl/单价/赚钱/黑盒）</summary><div class="notice">${faq}</div></details>
      <details><summary>v2.53 全量 API 清单与官方申请链接（点击展开，含基础设施 API）</summary><div id="admApiDir">${znSkeletonHtml()}</div></details>`;
    loadApiDirectory().catch(() => znError('admApiDir', '清单加载失败，可重试'));
    // 目录型号下拉
    const opts = ['<option value="">— 自定义/中转（手填端点与单价）—</option>']
      .concat(j.textCatalog.map((m) => `<option value="${m.id}">${escapeHtml(m.vendor)}·${escapeHtml(m.name)}（入${m.inYuanPerMTok}/出${m.outYuanPerMTok}）</option>`))
      .concat(j.imageCatalog.map((m) => `<option value="${m.id}">[图片] ${escapeHtml(m.vendor)}·${escapeHtml(m.name)}</option>`));
    $('pvCatalog').innerHTML = opts.join('');
  }
  async function loadApiDirectory() {
    const box = $('admApiDir'); if (!box) return;
    const j = await admApi('/model/api-directory');
    const row = (e) => `<tr><td>${escapeHtml(e.vendor)}<br><small class="muted">${escapeHtml(e.product)}</small></td>
      <td>${(e.usedBy || []).map(escapeHtml).join('<br>')}</td>
      <td>${e.region === 'domestic' ? '国产' : e.region === 'overseas' ? '海外' : '均可'}${e.necessity === 'core' ? '·必需' : e.necessity === 'alternative' ? '·备选' : '·可选'}</td>
      <td>${e.consoleUrl ? `<a href="${encodeURI(e.consoleUrl)}" target="_blank" rel="noopener">${escapeHtml(e.consoleUrl)}</a> <button class="btn-ghost" data-copy="${escapeHtml(e.consoleUrl)}">复制</button>` : '<span class="muted">无官方开放API</span>'}<br><small class="muted">${escapeHtml(e.note || '')}</small></td></tr>`;
    // @module admin
    const tbl = (title, list) => `<h4 style="margin:10px 0 4px">${title}（${list.length}）</h4>
      <table class="adm-table"><thead><tr><th>厂商/产品</th><th>用于哪些功能/岗位</th><th>属性</th><th>官方申请入口与说明</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table>`;
    const cov = j.coverage && (j.coverage.missing.length || j.coverage.extra.length)
      ? znErrorHtml('目录覆盖异常', `缺 ${j.coverage.missing.join(',') || '无'} / 多 ${j.coverage.extra.join(',') || '无'}`)
      : '<div class="notice">目录覆盖自检 ✅ 模型目录每个型号都有申请入口</div>';
    box.innerHTML = cov + '<div style="margin:6px 0 10px"><button class="btn-primary" id="apiDirDocx">下载设计版 Word 清单（封面/预留填写位/签署位）</button></div>' + tbl('一、文本大模型（10 岗位流水线）', j.text) + tbl('二、图片大模型（海报/分镜，全部收费）', j.image) + tbl('三、基础设施 API（登录/支付/存储/审核/语音等）', j.infra);
    const dl = $('apiDirDocx'); if (dl) dl.onclick = () => { admDownload('/model/api-directory/docx', 'zhongnanji-api-directory.docx'); };
    box.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy || ''); b.textContent = '已复制'; setTimeout(() => (b.textContent = '复制'), 1200); });
  }
  function fillPvByCatalog() {
    const id = $('pvCatalog').value; if (!id || !pfCache) return;
    const m = pfCache.textCatalog.find((x) => x.id === id) || pfCache.imageCatalog.find((x) => x.id === id);
    if (!m) return;
    $('pvModality').value = pfCache.textCatalog.some((x) => x.id === id) ? 'text' : 'image';
    if (!$('pvBase').value) $('pvBase').value = m.defaultBaseUrl || '';
    if (!$('pvModel').value) $('pvModel').value = m.name;
    const tm = pfCache.textCatalog.find((x) => x.id === id);
    if (tm) { $('pvIn').value = tm.inYuanPerMTok; $('pvOut').value = tm.outYuanPerMTok; }
  }
  async function loadProviders() {
    pvCache = await admApi('/model/providers');
    $('pvList').innerHTML = pvCache.providers.length ? pvCache.providers.map((p) => `
      <div class="model-row" style="margin-bottom:6px">
        <div class="model-tier">${escapeHtml(p.name)} <span class="badge">${p.modality}</span> ${p.enabled ? '' : '<span class="badge">停用</span>'} <span class="muted">${escapeHtml(p.keyMask || p.apiKey || '')}</span></div>
        <div class="row-actions">
          <button class="btn-ghost" data-pvedit="${p.id}">编辑</button>
          <button class="btn-ghost" data-pvdel="${p.id}">删除</button>
        </div></div>`).join('') : znEmptyHtml('暂无自定义供应商', '岗位全部走三档引擎组合');
    $('pvList').querySelectorAll('[data-pvdel]').forEach((b) => b.onclick = async () => {
      if (!(await uiConfirm({ body: '删除该供应商？相关岗位路由将自动解绑回退。', danger: true, okText: '删除' }))) return;
      // v2.285 admApi 经 jsonOrThrow 把网络层与 HTTP 非 ok 都 throw：catch 给失败结论并阻断乐观成功
      try {
        await admApi('/model/providers/' + b.getAttribute('data-pvdel'), { method: 'DELETE' });
      } catch { xnSay('删除失败，请稍后重试'); return; }
      xnSay('已删除并解绑路由'); await loadProviders(); await loadAdmPortfolio();
    });
    $('pvList').querySelectorAll('[data-pvedit]').forEach((b) => b.onclick = () => {
      const p = pvCache.providers.find((x) => x.id === b.getAttribute('data-pvedit'));
      editingPvId = p.id; $('pvName').value = p.name; $('pvModality').value = p.modality;
      $('pvModel').value = p.model; $('pvBase').value = p.baseUrl || '';
      $('pvIn').value = p.inYuanPerMTok; $('pvOut').value = p.outYuanPerMTok; $('pvEnabled').checked = p.enabled;
      $('pvCatalog').value = p.catalogId || ''; $('pvKey').placeholder = '留空保留原密钥'; window.scrollTo({ top: $('pvName').offsetTop - 80 });
    });
    renderRouting();
  }
  function renderRouting() {
    const ids = pvCache.providers.filter((p) => p.modality === 'text');
    const opt = (sel) => '<option value="">回退引擎档位</option>' + ids.map((p) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    const roles = pfCache ? pfCache.order.filter((s) => s.kind === 'llm').map((s) => ({ key: s.key === 'market_pre' || s.key === 'market_post' ? 'market' : s.key, label: s.label })) : [];
    const uniq = []; for (const r of roles) if (!uniq.some((x) => x.key === r.key)) uniq.push(r);
    $('routeList').innerHTML = uniq.map((r) => `<div class="field"><label>${r.label}</label><select data-role="${r.key}" class="mini-select">${opt(pvCache.routing[r.key])}</select></div>`).join('');
  }
  async function savePv() {
    const body = {
      id: editingPvId || '', name: $('pvName').value.trim(), modality: $('pvModality').value,
      catalogId: $('pvCatalog').value, baseUrl: $('pvBase').value.trim(), model: $('pvModel').value.trim(),
      apiKey: $('pvKey').value.trim(), inYuanPerMTok: Number($('pvIn').value) || 0, outYuanPerMTok: Number($('pvOut').value) || 0,
      enabled: $('pvEnabled').checked,
    };
    if (!body.name) { xnSay('供应商名称必填'); return; }
    try {
      await admApi('/model/providers', { method: 'PUT', body: JSON.stringify(body) });
      xnSay(editingPvId ? '已更新（密钥加密）' : '已新增（密钥加密）');
      editingPvId = ''; ['pvName', 'pvModel', 'pvBase', 'pvKey'].forEach((id) => $(id).value = '');
      await loadProviders(); await loadAdmPortfolio();
    } catch (e) { xnSay(e.message); }
  }
  async function saveRoutes() {
    const body = {};
    $('routeList').querySelectorAll('[data-role]').forEach((s) => { body[s.getAttribute('data-role')] = s.value; });
    try {
      await admApi('/model/routing', { method: 'PUT', body: JSON.stringify(body) });
      xnSay('岗位路由已保存'); await loadProviders(); await loadAdmPortfolio();
    } catch (e) { xnSay((e && e.message) || (lang === 'en' ? 'Save failed.' : '保存失败')); }
  }

  /* ---------- 管理后台：学习窗口 ---------- */
  const KN_CATS = ['character', 'plot', 'payoff', 'reversal', 'scene', 'dialogue', 'av', 'compliance'];
  const KN_CAT_ZH = { character: '人设', plot: '剧情结构', payoff: '爽点', reversal: '反转', scene: '场景', dialogue: '台词风格', av: '视听语言', compliance: '合规政策' };
  const KN_CAT_EN = { character: 'Character', plot: 'Plot', payoff: 'Payoff', reversal: 'Reversal', scene: 'Scene', dialogue: 'Dialogue', av: 'A/V', compliance: 'Compliance' };
    // @module admin
  const knCatName = (c) => (lang === 'en' ? KN_CAT_EN[c] || c : KN_CAT_ZH[c] || c);
  function renderKnCategory() {
    $('knCategory').innerHTML = KN_CATS.map((c) => `<option value="${c}">${knCatName(c)}</option>`).join('');
  }
  function toggleKnKind() {
    const kind = $('knKind').value;
    $('knUrl').parentElement.classList.toggle('hidden', !(kind === 'URL' || kind === 'VIDEO'));
    document.querySelector('.kn-file').classList.toggle('hidden', kind !== 'FILE');
  }
  async function submitKnowledge() {
    const kind = $('knKind').value, title = $('knTitle').value.trim(), content = $('knContent').value.trim();
    if (!title || !content) { xnSay(lang === 'en' ? 'Title and content required.' : '请填写标题与内容（视频/文件请先转写或读取为文本）'); return; }
    const payload = { kind, title, content, category: $('knCategory').value };
    if (kind === 'URL' || kind === 'VIDEO') payload.sourceUrl = $('knUrl').value.trim();
    if (kind === 'FILE') payload.fileName = ($('knFile').files[0] || {}).name || '';
    try {
      const j = await admApi('/knowledge', { method: 'POST', body: JSON.stringify(payload) });
      const note = j.conflictNote ? `\n${j.conflictNote}` : '';
      xnSay((j.status === 'REJECTED' ? (lang==='en'?'Blocked: ':'已拦截：') : j.status === 'PENDING' ? (lang==='en'?'Queued for review. ':'已进入待审队列。') : '') + note);
      $('knTitle').value = ''; $('knContent').value = ''; $('knUrl').value = ''; $('knFile').value = '';
      loadAdmKnowledge();
    } catch (e) { xnSay(e.message); }
  }
  // 选择本地文本文件时读取为文本填入内容框（视频需先转写，这里只支持文本类文件直读）
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'knFile') {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 4_000_000) { xnSay(lang === 'en' ? 'File too large (>4MB).' : '文件过大（>4MB），请粘贴关键文本'); return; }
      const rd = new FileReader();
      rd.onload = () => { $('knContent').value = String(rd.result || '').slice(0, 1_900_000); };
      rd.readAsText(f);
    }
  });
  async function loadAdmKnowledge() {
    const status = $('knFilter').value;
    let list = [];
    try { list = await admApi('/knowledge' + (status ? '?status=' + status : '')); } catch (e) { xnSay(e.message); return; }
    const stBadge = { PENDING: 'warn', APPROVED: 'ok', REJECTED: 'bad', ARCHIVED: '' };
    $('admKnowList').innerHTML = list.map((k) => `<div class="post-card" data-kid="${k.id}">
      <h4>[${k.kind}] ${escapeHtml(k.title)} <span class="badge ${stBadge[k.status] || ''}">${k.status}</span> <span class="muted">${knCatName(k.category)}</span></h4>
      ${k.conflictNote ? `<div class="warn-text">${escapeHtml(k.conflictNote)}</div>` : ''}
      <div class="pc-foot"><span class="muted">${new Date(k.createdAt).toLocaleString()}</span><span class="spacer"></span>
      ${k.status === 'PENDING' ? '<button class="btn-ghost" data-kn="approve">' + (lang === 'en' ? 'Approve & sync' : '通过并同步技能') + '</button><button class="btn-ghost" data-kn="reject">' + (lang === 'en' ? 'Reject' : '驳回') + '</button>' : ''}
      ${k.status === 'ARCHIVED'
        ? '<button class="btn-ghost" data-kn="restore">' + (lang === 'en' ? 'Restore' : '恢复（转待审）') + '</button>'
        : '<button class="btn-ghost" data-kn="archive">' + (lang === 'en' ? 'Archive' : '归档') + '</button>'}
      </div></div>`).join('') || znEmptyHtml(lang === 'en' ? 'Empty.' : '暂无知识条目');
    $('admKnowList').querySelectorAll('[data-kn]').forEach((b) => b.onclick = async () => {
      const id = b.closest('[data-kid]').getAttribute('data-kid'), act = b.getAttribute('data-kn');
      try {
        if (act === 'reject') {
          const reason = await uiPrompt({ body: lang === 'en' ? 'Reject reason:' : '驳回原因（可空）：', value: '' });
          await admApi(`/knowledge/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || '人工驳回' }) });
        } else if (act === 'archive') {
          const reason = await uiPrompt({ body: lang === 'en' ? 'Archive reason (optional):' : '归档原因（可空）：', value: '' });
          await admApi(`/knowledge/${id}/archive`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) });
          xnSay(lang === 'en' ? 'Archived.' : '已归档');
        } else if (act === 'restore') {
          await admApi(`/knowledge/${id}/restore`, { method: 'POST' });
          xnSay(lang === 'en' ? 'Restored to pending.' : '已恢复并转入待审');
        } else { await admApi(`/knowledge/${id}/approve`, { method: 'POST' }); xnSay(lang === 'en' ? 'Synced to skills.' : '已吸收并同步到创作技能'); }
        loadAdmKnowledge();
      } catch (e) { xnSay(e.message); }
    });
  }
  async function downloadSkillPackage() {
    try {
      const res = await Api.request('/api/admin/knowledge/skill-package');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `zhongnan-skill-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { xnSay(e.message); }
  }
  // 下载标准 SKILL.md（可直接放进任意窗口 skills 目录调用）
  async function downloadBuiltinSkillMd() {
    try {
      const res = await Api.request('/api/admin/knowledge/builtin-skill-md');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'SKILL.md';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      xnSay(lang === 'en' ? 'SKILL.md downloaded. Put it into a skill folder to call it.' : 'SKILL.md 已下载，放进目标窗口的技能目录即可调用');
    } catch (e) { xnSay(e.message); }
  }
  // 下载标准技能目录文件映射（SKILL.md + references，JSON，便于离线落盘/打包）
  async function downloadBuiltinSkillBundle() {
    try {
      const res = await Api.request('/api/admin/knowledge/builtin-skill-bundle');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const blob = new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${j.skillName || 'skill'}-v${j.version || 'x'}-bundle.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const n = j.files ? Object.keys(j.files).length : 0;
      xnSay((lang === 'en' ? `Bundle downloaded (${n} files). ` : `技能目录已导出（${n} 个文件），可离线落盘；`) + (lang === 'en' ? '' : '如需 zip 可在交付侧打包'));
    } catch (e) { xnSay(e.message); }
  }

  // 自主学习闭环 / 每周API盘点 / 报告历史（仅管理员可见，用户侧无入口）
  function showAutoReport(title, bodyHtml) {
    const box = $('admAutoBox');
    box.classList.remove('hidden');
    box.innerHTML = `<div class="auto-head"><b>${escapeHtml(title)}</b><span class="spacer"></span><button class="btn-ghost" id="autoClose">×</button></div><pre class="auto-pre">${bodyHtml}</pre>`;
    $('autoClose').onclick = () => box.classList.add('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function runAutoLearning() {
    const btn = $('knRunAuto'); btn.disabled = true; const old = btn.textContent; btn.textContent = '学习中…';
    try {
      const j = await admApi('/knowledge/self-learn/run-auto', { method: 'POST', body: '{}' });
    // @module admin
      const created = (j.created || []).map((c) => `· [${c.decision}] ${escapeHtml(c.title)}（置信${c.confidence}）`).join('\n') || '（本轮无新增，已学过的自动跳过）';
    // @module admin
      const pruned = (j.pruned || []).map((p) => `· ${escapeHtml(p.title)}｜${escapeHtml(p.reason)}`).join('\n') || '（无淘汰）';
      showAutoReport('自主学习一轮报告',
        `采集信号 ${j.collected}｜新增 ${j.created.length}｜跳过(已学) ${j.skipped}｜自主淘汰 ${j.pruned.length}\n\n【新增/决策】\n${created}\n\n【自主淘汰】\n${pruned}\n\n${escapeHtml(j.reportText || '')}`);
      loadAdmKnowledge();
      xnSay('自主学习完成：市场/高分剧本/政策已自动提炼，合规项仍需你确认');
    } catch (e) { xnSay(e.message); } finally { btn.disabled = false; btn.textContent = old; }
  }
  async function runWeeklyAudit() {
    const btn = $('knRunAudit'); btn.disabled = true; const old = btn.textContent; btn.textContent = '盘点中…';
    try {
      const j = await admApi('/model/portfolio/audit', { method: 'POST', body: '{}' });
      const r = j.report || {};
      showAutoReport('每周API组合盘点', escapeHtml(r.text || JSON.stringify(r.summary)));
      xnSay(r.healthy ? '组合健康，铁底全过，无阻断项' : '盘点发现阻断/警告，详见报告');
    } catch (e) { xnSay(e.message); } finally { btn.disabled = false; btn.textContent = old; }
  }
  async function loadLearnReports() {
    try {
      const j = await admApi('/knowledge/self-learn/reports');
      const rows = (j.reports || []).map((r) => {
        const t = typeof r.text === 'string' ? r.text : '';
        return `<div class="post-card"><h4><span class="badge ${r.kind === 'WEEKLY_MODEL' ? 'ok' : ''}">${r.kind}</span> <span class="muted">${new Date(r.createdAt).toLocaleString()}</span></h4><pre class="auto-pre short">${escapeHtml(t.slice(0, 1200))}</pre></div>`;
      }).join('') || znEmptyHtml('暂无报告', '每日03:17自主学习、每周一04:20自动盘点，也可点上方按钮立即执行');
      showAutoReport('学习 / 盘点报告（最近50条）', rows);
    } catch (e) { xnSay(e.message); }
  }

  /* ---------- 管理后台：反馈/Bug 处置 ---------- */
  // 反馈工单路由挂载在 /api/feedback（其 admin/* 子路径由 requireAdmin 守护）
    // @module admin
  const fbAdm = async (path, opts) => { const r = await Api.request('/api/feedback' + path, opts); return Api.jsonOrThrow(r); };
  const FB_STATUS_ZH = { PENDING: '待处理', EXECUTING: '已安排执行', TODO: '待办', REJECTED: '未采纳' };
    // @module admin
  const fbStatusName = (s) => (lang === 'en' ? s : (FB_STATUS_ZH[s] || s));
  async function loadAdmFeedback() {
    const status = $('fbStatus').value, type = $('fbType').value;
    const q = new URLSearchParams(); if (status) q.set('status', status); if (type) q.set('type', type);
    let list = [];
    try { list = await fbAdm('/admin/list' + (q.toString() ? '?' + q.toString() : '')); } catch (e) { xnSay(e.message); return; }
    $('admFbList').innerHTML = list.map((f) => {
      const u = f.user || {};
      const imgs = Array.isArray(f.images) && f.images.length
        ? `<div class="fb-img-row">${f.images.map((s) => `<img src="${escapeHtml(s)}" class="fb-img-thumb-mini" alt="" />`).join('')}</div>`
        : '';
      return `<div class="fb-card" data-fid="${f.id}">
        <div class="fb-head">
          <b>${escapeHtml(f.ticketNo || f.id)}</b>
          <span class="badge ${f.type === 'BUG' ? 'bad' : ''}">${f.type}</span>
          ${f.urgent ? '<span class="badge bad">' + (lang === 'en' ? 'URGENT' : '紧急') + '</span>' : ''}
          <span class="badge">${lvName(u.level || 'FREE')}</span>
          <span class="muted">${escapeHtml(u.penName || '')} ${escapeHtml(u.phone || '')}</span>
          <span class="spacer"></span><span class="badge">${fbStatusName(f.status)}</span>
          <span class="muted">${new Date(f.createdAt).toLocaleString()}</span>
        </div>
        <div class="fb-body">${escapeHtml(f.content)}</div>
        ${imgs}
        ${f.reply ? `<div class="fb-reply">${lang === 'en' ? 'Xiaonan reply: ' : '小南回复：'}${escapeHtml(f.reply)}</div>` : ''}
        <div class="fb-preview hidden" data-role="preview"></div>
        <div class="fb-acts">
          <button class="btn-ghost" data-fb="preview">${lang === 'en' ? 'Analyze' : '梳理诉求/修复路径'}</button>
          <button class="btn-primary" data-fb="execute">${lang === 'en' ? 'Execute' : '一键执行'}</button>
          <button class="btn-ghost" data-fb="todo">${lang === 'en' ? 'To-do' : '加入待办'}</button>
          <button class="btn-ghost" data-fb="reject">${lang === 'en' ? 'Decline' : '否定'}</button>
          <input data-role="manual" class="fb-manual" placeholder="${lang === 'en' ? 'Optional custom reply to user' : '可手改给用户的小南回复（留空用暖心模板）'}" />
        </div></div>`;
    }).join('') || znEmptyHtml(lang === 'en' ? 'No tickets.' : '暂无工单');
    $('admFbList').querySelectorAll('.fb-card').forEach((card) => bindFbCard(card));
  }
  function bindFbCard(card) {
    const id = card.getAttribute('data-fid');
    const prevBox = card.querySelector('[data-role="preview"]');
    const manual = card.querySelector('[data-role="manual"]');
    card.querySelector('[data-fb="preview"]').onclick = async () => {
      try {
        const p = await fbAdm(`/admin/${id}/preview`, { method: 'POST' });
        prevBox.classList.remove('hidden');
        prevBox.innerHTML = `<div>${lang === 'en' ? 'Category' : '分类'}：<b>${escapeHtml(p.category)}</b> · ${lang === 'en' ? 'Summary' : '摘要'}：${escapeHtml(p.summary)}</div>
          <div class="fix-route ${p.fixPath.route}"><b>${escapeHtml(p.fixPath.label)}</b>：${escapeHtml(p.fixPath.suggestion)}</div>`;
      } catch (e) { xnSay(e.message); }
    };
    ['execute', 'todo', 'reject'].forEach((act) => {
      card.querySelector(`[data-fb="${act}"]`).onclick = async () => {
        try {
          const r = await fbAdm(`/admin/${id}/action`, { method: 'POST', body: JSON.stringify({ action: act, manualText: manual.value.trim() || undefined }) });
          if (r.fixPath) xnSay(`${r.fixPath.label}：${r.fixPath.suggestion}`);
          loadAdmFeedback();
        } catch (e) { xnSay(e.message); }
      };
    });
  }
  async function loadAdmTodos() {
    const sortBy = $('fbTodoSort').value;
    let list = [];
    try { list = await fbAdm(`/admin/todos?sortBy=${sortBy}`); } catch (e) { xnSay(e.message); return; }
    $('admTodoList').innerHTML = list.map((x) => {
      const tk = x.ticket || {};
      return `<div class="post-card"><h4>${escapeHtml(tk.ticketNo || x.id)} <span class="badge">${lvName(x.level || 'FREE')}</span></h4>
        <div class="pc-body">${escapeHtml(x.content)}</div><div class="muted">${new Date(x.createdAt).toLocaleString()}</div></div>`;
    }).join('') || `<div class="notice">${lang === 'en' ? 'No to-dos.' : '待办为空'}</div>`;
  }
  function toggleTodoView() {
    const box = $('admTodoList');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) loadAdmTodos();
  }

  /* ---------- v2.219 广告位管理：/api/ads/admin/* 前端入口补齐 ----------
   * 此前后端完整 CRUD（list/create/update/delete）仅 API 可操作，运营无法自助管理广告。
   * 表单新建/编辑复用；删除直接执行（与 providers 删除同一风格）；slot 下拉由接口 slots 动态填充。 */
  let adSlots = [], adRows = [], adEditingId = null;
    // @module admin
  const adAdm = async (path, opts) => { const r = await Api.request('/api/ads' + path, opts); return Api.jsonOrThrow(r); };
    // @module admin
  const toLocalInput = (v) => { if (!v) return ''; const d = new Date(v); if (isNaN(d.getTime())) return ''; const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  function adSlotName(s) { const hit = (adSlots || []).find((x) => x.id === s); return hit ? hit.name : s; }
  function fillAdSlotSel(sel) {
    $('adSlot').innerHTML = (adSlots || []).map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
    if (sel) $('adSlot').value = sel;
  }
  function fmtAdRange(a) {
    // @module admin
    const has = (v) => v && new Date(v).toString() !== 'Invalid Date';
    if (!has(a.startAt) && !has(a.endAt)) return t('admAds_long');
    const fmt = (v) => has(v) ? new Date(v).toLocaleDateString() : '—';
    return `${fmt(a.startAt)} → ${fmt(a.endAt)}`;
  }
  async function loadAdmAds() {
    let d;
    try { d = await adAdm('/admin/list'); } catch (e) { xnSay(e.message); return; }
    adSlots = d.slots || []; adRows = d.list || [];
    if (!$('adFormBox').classList.contains('hidden')) fillAdSlotSel($('adSlot').value);
    $('admAdList').innerHTML = adRows.map((a) => `
      <div class="fb-card" data-aid="${escapeHtml(a.id)}">
        <div class="fb-head">
          <b>${escapeHtml(a.title)}</b>
          <span class="badge">${escapeHtml(adSlotName(a.slot))}</span>
          <span class="badge ${a.active ? '' : 'bad'}">${a.active ? t('admAds_on') : t('admAds_off')}</span>
          <span class="muted">${t('admAds_clicks')} ${a.clicks ?? 0} · ${t('admAds_sortN')} ${a.sort ?? 0} · ¥${((a.priceFenDay || 0) / 100).toFixed(2)}/${t('admAds_day')}</span>
          <span class="spacer"></span><span class="muted">${fmtAdRange(a)}</span>
        </div>
        ${a.imageUrl ? `<div class="fb-img-row"><img src="${escapeHtml(a.imageUrl)}" class="fb-img-thumb-mini" alt=""/></div>` : ''}
        ${a.linkUrl ? `<div class="muted" style="font-size:12px;word-break:break-all">${escapeHtml(a.linkUrl)}</div>` : ''}
        <div class="fb-acts">
          <button class="btn-ghost" data-ad="edit">${lang === 'en' ? 'Edit' : '编辑'}</button>
          <button class="btn-ghost" data-ad="del">${t('admAds_del')}</button>
        </div>
      </div>`).join('') || `<div class="notice">${t('admAds_empty')}</div>`;
    $('admAdList').querySelectorAll('.fb-card').forEach((card) => {
      const id = card.getAttribute('data-aid');
      card.querySelector('[data-ad="edit"]').onclick = () => openAdForm(id);
      card.querySelector('[data-ad="del"]').onclick = async () => {
        if (!(await uiConfirm({ body: t('admAds_delConfirm'), danger: true, okText: t('admAds_del') }))) return;
        try { await adAdm(`/admin/${id}/delete`, { method: 'POST' }); xnSay(t('admAds_deleted')); loadAdmAds(); }
        catch (e) { xnSay(e.message); }
      };
    });
  }
  function openAdForm(id) {
    adEditingId = id || null;
    if (id) {
    // @module admin
      const a = (adRows || []).find((x) => x.id === id);
      if (!a) return;
      fillAdSlotSel(a.slot);
      $('adTitle').value = a.title || '';
      $('adImageUrl').value = a.imageUrl || '';
      $('adLinkUrl').value = a.linkUrl || '';
      $('adBadge').value = a.badge || '';
      $('adSponsor').value = a.sponsorName || '';
      $('adPrice').value = a.priceFenDay ?? 0;
      $('adSort').value = a.sort ?? 0;
      $('adActive').value = a.active ? '1' : '0';
      $('adStart').value = toLocalInput(a.startAt);
      $('adEnd').value = toLocalInput(a.endAt);
      $('adFormHint').textContent = `${t('admAds_editing')} #${a.id}`;
    } else {
      fillAdSlotSel();
      ['adTitle', 'adImageUrl', 'adLinkUrl', 'adSponsor'].forEach((k) => { $(k).value = ''; });
      $('adBadge').value = lang === 'en' ? 'AD' : '广告';
      $('adPrice').value = 0; $('adSort').value = 0; $('adActive').value = '1';
      $('adStart').value = ''; $('adEnd').value = '';
      $('adFormHint').textContent = '';
    }
    const box = $('adFormBox');
    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function saveAd() {
    const title = $('adTitle').value.trim();
    if (!title) { xnSay(t('admAds_needTitle')); return; }
    const body = {
      slot: $('adSlot').value, title,
      imageUrl: $('adImageUrl').value.trim() || null,
      linkUrl: $('adLinkUrl').value.trim() || null,
      badge: $('adBadge').value.trim() || null,
      sponsorName: $('adSponsor').value.trim() || null,
      priceFenDay: Math.max(0, parseInt($('adPrice').value, 10) || 0),
      sort: Math.max(0, parseInt($('adSort').value, 10) || 0),
      active: $('adActive').value === '1',
      startAt: $('adStart').value ? new Date($('adStart').value).toISOString() : null,
      endAt: $('adEnd').value ? new Date($('adEnd').value).toISOString() : null,
    };
    try {
      if (adEditingId) await adAdm(`/admin/${adEditingId}/update`, { method: 'POST', body: JSON.stringify(body) });
      else await adAdm('/admin/create', { method: 'POST', body: JSON.stringify(body) });
      xnSay(t('admAds_saved'));
      $('adFormBox').classList.add('hidden');
      adEditingId = null;
      loadAdmAds();
    } catch (e) { xnSay(e.message); }
  }

  /* ---------- v2.186 工具优化弹窗铁律：UpdateBanner 全局组件 ----------
   * 用户 2026-09-29 拍板铁律——「工具的每一次优化、调整、更新都要有弹窗」。
   * 启动时拉 /api/updates/latest，与本地 zn_seen_version 比对：
   *   · 不同版本 + 未勾「不再提示」→ 弹模态（标题 + body + 「我知道了」+ 「不再提示此版本」）
   *   · 点「我知道了」→ 写 zn_seen_version = version，关闭弹窗
   *   · 勾「不再提示」→ 写 zn_dont_show_${version} = '1'，关闭弹窗
   * 复用 .modal-mask/.modal 基础样式；少量增强样式见 styles.css 末尾。
   * 错误容忍：拉取失败/无 DOM 环境忽略，绝不阻断主应用启动。 */
  function showUpdateBanner(ann) {
    if (!ann || !ann.version) return;
    const dontShow = LS.g(`zn_dont_show_${ann.version}`, null);
    if (dontShow === '1') return; // 用户已勾「不再提示此版本」
    const seen = LS.g('zn_seen_version', null);
    if (seen === ann.version) return; // 已确认过此版本
    // 移除可能存在的旧弹窗
    document.querySelectorAll('.update-banner-mask').forEach((el) => el.remove());
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-mask update-banner-mask';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    const title = ann.titleZh || ann.titleEn || `v${ann.version}`;
    const body = ann.bodyZh || ann.bodyEn || '';
    const pinnedTag = ann.pinned ? `<span class="update-banner-pinned">${lang === 'en' ? 'Pinned' : '置顶'}</span> ` : '';
    const versionTag = `<span class="update-banner-version">v${escapeHtml(ann.version)}</span>`;
    backdrop.innerHTML = `<div class="modal update-banner">
      <div class="update-banner-header">${pinnedTag}${versionTag}
        <button type="button" class="update-banner-close" aria-label="关闭">×</button>
      </div>
      <div class="update-banner-title"></div>
      <div class="update-banner-body"></div>
      <label class="update-banner-mute"><input type="checkbox" class="update-banner-mute-input" /><span class="update-banner-mute-label"></span></label>
      <div class="update-banner-actions">
        <button type="button" class="btn-primary update-banner-ok"></button>
      </div>
    </div>`;
    const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    backdrop.querySelector('.update-banner-close').onclick = close;
    backdrop.querySelector('.update-banner-title').textContent = title;
    backdrop.querySelector('.update-banner-body').textContent = body;
    const muteLabel = backdrop.querySelector('.update-banner-mute-label');
    if (muteLabel) muteLabel.textContent = (lang === 'en' ? 'Don\'t show this version again' : '不再提示此版本');
    const okBtn = backdrop.querySelector('.update-banner-ok');
    okBtn.textContent = (lang === 'en' ? 'Got it' : '我知道了');
    okBtn.onclick = () => {
      const mute = backdrop.querySelector('.update-banner-mute-input').checked;
      LS.s('zn_seen_version', ann.version);
      if (mute) LS.s(`zn_dont_show_${ann.version}`, '1');
      close();
      try { xnSay(lang === 'en' ? `Updated to v${ann.version}` : `已更新至 v${ann.version}`); } catch { /* xnSay 可能未初始化 */ }
    };
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
  }
  async function initUpdateBanner() {
    try {
      const data = await fetchLatestAnnouncement(); // v2.266 共享取数（与首页动态同源，60s TTL 不双发）
      if (data && data.announcement) showUpdateBanner(data.announcement);
    } catch { /* 静默失败：弹窗不阻断主应用 */ }
  }
  // 延迟 1.5s 启动，避免与首屏渲染/鉴权抢资源
  setTimeout(initUpdateBanner, 1500);

  // ═══ MODULE: bootstrap (5行, 0fn) ═══ 启动
  /* ---------- 启动 ---------- */
  applyTheme(); applyLang(); renderAuthButton(); initHookConsole(); wireFormatSelector();
  if (Api.isAuthed()) loadMe();
})();
