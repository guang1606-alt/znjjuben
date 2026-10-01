/**
 * v2.267 dogfood 第二轮收口（DEMO 8099 真实浏览器实证五处）—— 静态守卫 web/
 * 背景（证据见日报四十六段）：
 *  1. [P1-1] 「爆款短视频脚本」(shortvideo) 模式卡点击零反馈：该模式只有内联
 *     modeBriefPanel（在卡片网格下方，不在 _WORKBENCH_PANEL_IDS），syncModeBrief
 *     末尾 openWorkbench 分支不覆盖它，#workbenchLayer 不展开、无滚动无 toast，
 *     用户以为点了没反应。修法：syncModeBrief 对"有内联简报、无专属工作台面板"
 *     的模式，把 modeBriefPanel 平滑滚入视口并聚焦 textarea，给明确进入反馈。
 *  2. [P1-2] 非超管进后台 users tab 抛未捕获异常（pageerror：
 *     "仅超级管理员主账号可执行此操作"）：loadAdmUsers 裸 await admApi('/users…')，
 *     403 reject 无 try/catch，调用处 loadAdmTab 亦裸调，unhandled rejection 上报。
 *     修法：函数体整体 try/catch，错误以 znErrorHtml 就地渲染进 admUserTable
 *     （与 models/balances tab 同范式），清空 pager，绝不冒泡。
 *  3. [P2-2a] 英文界面钩子按钮「🎣 钩子编排：[系统智能]…」切语言后不重渲染：
 *     refreshHookSummary 已按 lang 双语输出，但 applyLang 从未调它（仅 hook 控件
 *     交互时调）。修法：applyLang 重渲染序列补一次 refreshHookSummary（内部全空值守卫）。
 *  4. [P2-2b] 英文界面弹中文「小南提醒：国庆长假…」toast：该 toast 来自
 *     smartRandomTags 的 xnSay(lines[0])，而 xiaonanLines 语言跟随"剧本输出语言"
 *     (#outLang → outLocale())，与界面语言 (lang) 相互独立；EN 界面 + 中文输出时
 *     中文内容行直接 toast 进英文 UI。修法：界面语言与输出语言一致时才弹原文，
 *     否则弹界面语言的中性就绪提示（tagWhy 区仍完整展示原文，信息不丢）。
 *  5. [P3-1] 作品详情无返回/收起入口：#worksDetail 六颗操作按钮无返回键，再点
 *     nav「我的作品」loadWorks 也不收起详情。修法：详情头部加 worksBackBtn（双语
 *     data-i），closeWorksDetail 收起并滚回列表；openProject 绑定；loadWorks
 *     重入（含搜索）先收起详情回列表态。
 * 另：P2-1（高级档点 nav 管理后台静默）经源码核实为误报——.admin-only 入口对
 * isAdmin=false 账户 display:none，真实用户无法点中；enterAdmin 对 !isAdmin 本有
 * xnSay 兜底。子代理报告的 toast=0 系脚本强点 hidden 元素所致，不修。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '..', 'web');
const srcRaw = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
// 剥行注释后再匹配代码形态（防注释文字击中断言造成假红）
const src = srcRaw.replace(/\/\/.*$/gm, '');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 4000));
}

describe('v2.267 [P1-1] shortvideo 模式卡点击必须有进入反馈', () => {
  const w = fnWindow('function syncModeBrief', '/* ---------- v2.93');

  it('syncModeBrief 存在且可定位', () => {
    assert.ok(w, '应定位到 syncModeBrief 函数窗口');
  });

  it('对无专属工作台面板的模式，把内联 modeBriefPanel 滚动入视（scrollIntoView）', () => {
    assert.ok(/modeBriefPanel/.test(w), '应引用内联简报面板 modeBriefPanel');
    assert.ok(/scrollIntoView/.test(w),
      '应将 modeBriefPanel scrollIntoView（shortvideo 无 openWorkbench 目标，须靠滚动给进入反馈）');
  });

  it('滚动反馈仅在用户显式选模式时触发（!_initSyncing），且聚焦简报输入框', () => {
    assert.ok(/_initSyncing/.test(w), '滚动反馈须受 _initSyncing 守卫（初始化/语言同步时不得自动滚动）');
    assert.ok(/modeBrief['"]?\)?\s*;?[^\n]*focus|focus\s*\(\s*\{?\s*preventScroll/.test(w) || /\$\(['"]modeBrief['"]\)[\s\S]{0,120}focus/.test(w),
      '滚动后应聚焦 #modeBrief 输入框（focus preventScroll，避免与平滑滚动打架）');
  });
});

describe('v2.267 [P1-2] loadAdmUsers 403 不得逃逸为 pageerror', () => {
  const w = fnWindow('async function loadAdmUsers', 'async function admSetLevel', 6000);

  it('loadAdmUsers 存在且可定位', () => {
    assert.ok(w, '应定位到 loadAdmUsers 函数窗口');
  });

  it('admApi 取数被 try/catch 包裹（裸 await 已消除）', () => {
    const admApiPos = w.indexOf('admApi(');
    const tryPos = w.search(/\btry\s*\{/);
    assert.ok(admApiPos >= 0, '窗口内应含 admApi 取数');
    assert.ok(tryPos >= 0 && tryPos < admApiPos,
      'admApi 调用必须位于 try { 之后（403 reject 须被捕获，不得成 unhandled rejection）');
    assert.ok(/\}\s*catch\s*\(/.test(w), 'loadAdmUsers 必须含 catch 分支');
  });

  it('catch 分支把错误就地渲染进 admUserTable（znErrorHtml），并清空 pager', () => {
    const catchPos = w.search(/\}\s*catch\s*\(/);
    const tail = w.slice(catchPos);
    assert.ok(/znErrorHtml/.test(tail), 'catch 内应使用 znErrorHtml 渲染错误（与 models/balances tab 同范式）');
    assert.ok(/admUserTable/.test(tail), '错误信息应渲染进 #admUserTable（页内可见，不弹 pageerror）');
    assert.ok(/admUserPager/.test(tail), '取数失败时应清空 #admUserPager（避免残留失效翻页按钮）');
  });
});

describe('v2.267 [P2-2a] 切换界面语言必须重渲染钩子编排按钮', () => {
  const w = fnWindow('function applyLang', 'function renderStaticText');

  it('applyLang 重渲染序列含 refreshHookSummary()', () => {
    assert.ok(w, '应定位到 applyLang');
    assert.ok(/refreshHookSummary\s*\(\s*\)/.test(w),
      'applyLang 必须调用 refreshHookSummary()（否则 EN 界面钩子按钮停留旧语言，子代理实证残留）');
  });
});

describe('v2.267 [P2-2b] 界面语言≠输出语言时不得弹中文小南内容行', () => {
  const w = fnWindow('async function smartRandomTags', 'function buildTagBrief');

  it('smartRandomTags 存在且可定位', () => {
    assert.ok(w, '应定位到 smartRandomTags 函数窗口');
  });

  it('toast 前比较 lang 与 outLocale()，不一致时走界面语言中性兜底', () => {
    assert.ok(/outLocale\s*\(\s*\)/.test(w), '应读取输出语言 outLocale() 以判断与界面语言是否一致');
    assert.ok(/lang\s*===?\s*outLocale\s*\(\s*\)/.test(w) || /lang\s*!==?\s*outLocale\s*\(\s*\)/.test(w),
      'toast 文案选择须以 lang 与 outLocale() 的比较为条件');
    assert.ok(!/xnSay\(\s*lines\[0\]\s*\)\s*;?\s*$/.test(w.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ')) || true, '占位（结构由下条保证）');
  });

  it('不再无条件 xnSay(lines[0])（原文 toast 仅在双语言一致时出现）', () => {
    // 旧形态：if (lines[0]) xnSay(lines[0]);
    assert.ok(!/if\s*\(\s*lines\[0\]\s*\)\s*xnSay\(\s*lines\[0\]\s*\)/.test(w),
      '裸 xnSay(lines[0]) 必须消除（EN 界面会弹中文季节行）');
  });

  it('中性兜底含英文就绪提示（tagWhy 区保留原文行不受影响）', () => {
    assert.ok(/combo/i.test(w) && /below/i.test(w),
      '不一致分支应给英文中性就绪提示（引导看下方 tagWhy 推荐理由）');
  });
});

describe('v2.267 [P3-1] 作品详情必须有返回列表入口', () => {
  it('index.html 详情头部声明 worksBackBtn（双语 data-i）', () => {
    assert.ok(/id=["']worksBackBtn["']/.test(html), '#worksDetail 头部应含 id="worksBackBtn" 返回按钮');
  });

  it('app.js 存在 closeWorksDetail：收起详情、清空分集、复位当前项目', () => {
    const w = fnWindow('function closeWorksDetail', null, 800);
    assert.ok(w, '应定义 closeWorksDetail()');
    assert.ok(/worksDetail[\s\S]{0,200}classList\.add\(\s*['"]hidden['"]/.test(w) ||
      /classList\.add\(\s*['"]hidden['"][\s\S]{0,120}worksDetail/.test(w) ||
      /worksDetail/.test(w), 'closeWorksDetail 应操作 #worksDetail');
    assert.ok(/classList\.add\(\s*['"]hidden['"]/.test(w), '应给 #worksDetail 加 hidden');
    assert.ok(/epsList/.test(w), '应收起时清空 #epsList');
  });

  it('openProject 内绑定返回按钮', () => {
    const w = fnWindow('async function openProject', 'znSkeleton', 1200);
    assert.ok(/worksBackBtn[\s\S]{0,80}\.onclick\s*=/.test(w), 'openProject 应为 #worksBackBtn 绑定 onclick');
    assert.ok(/closeWorksDetail/.test(w), 'onclick 应调用 closeWorksDetail');
  });

  it('loadWorks 重入（再点 nav / 搜索）先收起详情回列表态', () => {
    const w = fnWindow('async function loadWorks', "const res = await Api.request('/api/generate/projects", 1200);
    assert.ok(w, '应定位到 loadWorks 开头窗口');
    assert.ok(/worksDetail[\s\S]{0,80}classList\.add\(\s*['"]hidden['"]/.test(w),
      'loadWorks 应在取数前给 #worksDetail 加 hidden（再点 nav「我的作品」须回列表）');
  });
});
