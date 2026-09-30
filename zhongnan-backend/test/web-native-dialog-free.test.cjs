/**
 * D 轮交互统一：去原生弹窗 —— TDD 先红后绿
 * 守卫 web/app.js：
 *  1) 不再调用原生 alert/confirm/prompt（原生弹窗在移动端观感差、不可定制、与 toast/modal 体系割裂）
 *  2) 存在通用 Promise 化对话框助手 uiConfirm / uiPrompt（DOM 构建、Esc/遮罩可关、不用 innerHTML 注入用户内容）
 * 直接读文件断言，不起服务器，跑得快。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');

// 匹配裸调用与 window. 前缀调用（window.alert( / alert( / confirm( / prompt( 等）
const NATIVE_RE = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;

function extractMarkedRegion(name) {
  const start = src.indexOf(`/* ---------- ${name} ---------- */`);
  if (start < 0) return null;
  const endMarker = `/* ---------- ${name} 结束 ---------- */`;
  const end = src.indexOf(endMarker, start);
  if (end < 0) return null;
  return src.slice(start, end);
}

describe('D 轮：app.js 零原生弹窗', () => {
  it('不再包含原生 alert/confirm/prompt 调用', () => {
    const hits = [];
    let m;
    const re = new RegExp(NATIVE_RE.source, 'g');
    const lines = src.split('\n');
    while ((m = re.exec(src)) !== null) {
      const lineNo = src.slice(0, m.index).split('\n').length;
      hits.push(`L${lineNo}: ${lines[lineNo - 1].trim().slice(0, 80)}`);
    }
    assert.deepStrictEqual(hits, [], `发现 ${hits.length} 处原生弹窗调用，应全部替换为 toast/uiConfirm/uiPrompt:\n${hits.join('\n')}`);
  });
});

describe('D 轮：uiConfirm / uiPrompt 通用模态助手', () => {
  it('uiConfirm 已定义且 Promise 化', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(region, '应有标记区域「v2.202 通用模态对话框」…结束');
    assert.ok(/function uiConfirm\s*\(/.test(region), '应定义 function uiConfirm(');
    assert.ok(/new Promise\s*\(/.test(region), '应返回 Promise（new Promise）');
  });

  it('uiPrompt 已定义，支持默认值/占位符/回车确认', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(region, '标记区域缺失');
    assert.ok(/function uiPrompt\s*\(/.test(region), '应定义 function uiPrompt(');
    assert.ok(/\.focus\(\)/.test(region), '输入框应自动聚焦');
    assert.ok(/keydown/.test(region), '应监听键盘（Enter 确认 / Esc 取消）');
  });

  it('模态构建安全：区域内不使用 innerHTML 注入', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(region, '标记区域缺失');
    assert.ok(!region.includes('innerHTML'), '模态应用 DOM API 构建，不用 innerHTML（防 XSS 与转义遗漏）');
  });

  it('Esc / 遮罩点击均可关闭并 resolve', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(/Escape/.test(region), '应支持 Esc 关闭');
    assert.ok(/overlay\.onclick|\.onclick = \(e\) => \{ if \(e\.target === overlay\)/.test(region), '应支持点击遮罩关闭');
  });

  it('焦点圈定：Tab 在模态内循环，Shift+Tab 反向循环', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(/'Tab'/.test(region), '应监听 Tab 键');
    assert.ok(/shiftKey/.test(region), '应处理 Shift+Tab 反向循环');
    assert.ok(/_uiTrapTab/.test(region), '应有圈定 helper（首个↔末个循环）');
  });

  it('焦点恢复：关闭后焦点回到触发元素（记录 activeElement）', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(/document\.activeElement/.test(region), '应记录打开前的 document.activeElement');
    // uiConfirm 与 uiPrompt 都要有恢复动作：出现 ≥2 次 prevFocus.focus()
    const restores = (region.match(/prevFocus\.focus\(\)/g) || []).length;
    assert.ok(restores >= 2, `uiConfirm 与 uiPrompt 都应恢复焦点，实测 ${restores} 处`);
  });

  it('出场动画：resolve 即刻返回（不被动画阻塞），overlay 淡出后移除', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(/animate\(\[\{ opacity: 1 \}, \{ opacity: 0 \}\]/.test(region), '应有 overlay 退场淡出动画');
    assert.ok(/onfinish/.test(region), '动画完成后才移除 DOM');
    assert.ok(/oncancel|setTimeout\(/.test(region), '应有动画未触发的兜底清理（oncancel/超时）');
    // resolve 在动画之前调用：close() 内 resolve(result) 出现于退场动画路径之外（不依赖 onfinish 才 resolve）
    const closeBodies = region.match(/const close = \(result\) => \{[\s\S]*?\n      \};/g) || [];
    assert.ok(closeBodies.length >= 2, 'uiConfirm 与 uiPrompt 都应有统一 close');
    closeBodies.forEach((body, i) => {
      assert.ok(/resolve\(result\)/.test(body), `第 ${i + 1} 个对话框的 close 应同步 resolve`);
    });
  });

  it('防连点节流：生成按钮 UI 层 800ms 节流（程序化调用与测试直调不受影响）', () => {
    assert.ok(/let _lastGenClick = 0;/.test(src), '应有提交时间戳节流变量');
    assert.ok(/function genClickGuard\(/.test(src), '应有 UI 层节流包装 helper');
    assert.ok(/- _lastGenClick < \d+/.test(src), '应有短窗节流判断（拦截手抖连点，间隔足够仍放行新单）');
    const wraps = (src.match(/onclick = genClickGuard\(/g) || []).length;
    assert.ok(wraps >= 3, `生成类按钮应统一走 genClickGuard 包装，实测 ${wraps} 处`);
    assert.ok(/toastInfo\(/.test(src.slice(src.indexOf('function genClickGuard'), src.indexOf('function genClickGuard') + 600)), '拦截时应有轻提示，不静默吞点击');
  });
});

describe('F 轮：批量补全对话框迁移 v2.202 规范', () => {
  const region = extractMarkedRegion('v2.205 批量补全对话框');

  it('标记区域存在（showBatchCompleteDialog 应有 v2.205 标记注释）', () => {
    assert.ok(region, '应有标记区域「v2.205 批量补全对话框」…结束');
  });

  it('DOM 构建安全：不用 innerHTML / 不用 inline onmouseover/onmouseout', () => {
    assert.ok(region, '标记区域缺失');
    assert.ok(!region.includes('innerHTML'), '应改用 DOM API 构建，不用 innerHTML');
    assert.ok(!/onmouseover\s*=/.test(region), '不应有 inline onmouseover（hover 效果走 CSS）');
    assert.ok(!/onmouseout\s*=/.test(region), '不应有 inline onmouseout');
  });

  it('焦点管理：圈定 + 恢复 + dialog 语义', () => {
    assert.ok(region, '标记区域缺失');
    assert.ok(/_uiTrapTab/.test(region), 'Tab 焦点应圈定在模态内（复用 _uiTrapTab）');
    assert.ok(/prevFocus/.test(region) && /prevFocus\.focus\(\)/.test(region), '关闭后焦点应恢复到触发元素');
    assert.ok(/aria-modal/.test(region) || /_uiModalShell\(/.test(region), '应有 dialog/aria-modal 语义（或复用 _uiModalShell）');
  });

  it('动效：入场/出场动画 + reduced-motion 守卫', () => {
    assert.ok(region, '标记区域缺失');
    assert.ok(/_uiReducedMotion\(\)/.test(region), '动画前应查 prefers-reduced-motion');
    assert.ok(/\.animate\(/.test(region), '应有入场/出场动画（与 uiConfirm 一致）');
  });

  it('行为保留：全选/全不选/空选提示/按字段过滤 patches', () => {
    assert.ok(region, '标记区域缺失');
    assert.ok(/dash-batch-all/.test(region), '应保留全选');
    assert.ok(/dash-batch-none/.test(region), '应保留全不选');
    assert.ok(/dashThinBatchDialogEmpty/.test(region), '空选时应有提示');
    assert.ok(/filteredPatches/.test(region), '确认时应按选中字段过滤 patches');
  });
});

describe('F 轮：toast 堆叠上限（防错误风暴刷屏）', () => {
  it('toast 区域超出上限时移除最旧一条', () => {
    const region = extractMarkedRegion('v2.186 全局 Toast');
    assert.ok(region, 'toast 区域应有「v2.186 全局 Toast」…结束标记');
    assert.ok(/children\.length > \d+/.test(region), '应有堆叠条数上限判断');
    assert.ok(/firstElementChild\.remove\(\)/.test(region), '超出上限应移除最旧一条');
  });
});

describe('G 轮：ESC 双重响应修复（对话框打开时 ESC 不弹回上一视图）', () => {
  it('uiModalShell 遮罩带 ui-dlg-overlay 标识类，nav ESC 检测纳入该类', () => {
    const region = extractMarkedRegion('v2.202 通用模态对话框');
    assert.ok(region, 'v2.202 区域缺失');
    assert.ok(/overlay\.className = 'ui-dlg-overlay'/.test(region), '遮罩应有 ui-dlg-overlay 标识类');
    const navHits = (src.match(/ui-dlg-overlay/g) || []).length;
    assert.ok(navHits >= 2, `ui-dlg-overlay 至少出现 2 处（shell 标识 + nav ESC 检测），实测 ${navHits}`);
    assert.ok(
      /querySelector\('\.modal\.open, \.overlay\.open, \.modal-mask:not\(\.hidden\), #workbenchLayer:not\(\.hidden\), \.ui-dlg-overlay'\)/.test(src),
      'nav ESC 的 hasOverlay 检测应纳入 .modal-mask 与 .ui-dlg-overlay（v2.220 起模态打开时 ESC 让位）'
    );
  });

  it('uiConfirm / uiPrompt 全局暴露（供独立视图文件使用）', () => {
    assert.ok(/window\.uiConfirm\s*=\s*uiConfirm/.test(src), '应暴露 window.uiConfirm');
    assert.ok(/window\.uiPrompt\s*=\s*uiPrompt/.test(src), '应暴露 window.uiPrompt');
  });
});

describe('G 轮：web 视图文件零原生弹窗', () => {
  const FILES = ['diversity-view.js', 'room-view.js', 'branch-view.js', 'teardown-view.js'];
  for (const f of FILES) {
    it(`${f} 不含原生 alert/confirm/prompt`, () => {
      const code = fs.readFileSync(path.join(WEB, f), 'utf8');
      const lines = code.split('\n');
      const hits = [];
      let m;
      const re = new RegExp(NATIVE_RE.source, 'g');
      while ((m = re.exec(code)) !== null) {
        const lineNo = code.slice(0, m.index).split('\n').length;
        hits.push(`L${lineNo}: ${lines[lineNo - 1].trim().slice(0, 90)}`);
      }
      assert.deepStrictEqual(hits, [], `${f} 发现 ${hits.length} 处原生弹窗，应改用 window.Xn.toast / window.uiConfirm:\n${hits.join('\n')}`);
    });
  }
});

describe('H 轮：模态滚动锁 + toast 层级 + 图标按钮可达性', () => {
  it('H1-模态打开锁背景滚动，关闭恢复（计数式支持叠层）', () => {
    const modalRegion = extractMarkedRegion('v2.202 通用模态对话框');
    const batchRegion = extractMarkedRegion('v2.205 批量补全对话框');
    assert.ok(/function _uiModalLock\(/.test(src), '应有 _uiModalLock 定义');
    assert.ok(/function _uiModalUnlock\(/.test(src), '应有 _uiModalUnlock 定义');
    assert.ok(/overflow = 'hidden'/.test(src), '锁定期 body overflow hidden');
    assert.ok(/overflow = ''/.test(src), '归零后应恢复 body overflow');
    const locks = (modalRegion.match(/_uiModalLock\(\)/g) || []).length;
    const unlocks = (modalRegion.match(/_uiModalUnlock\(\)/g) || []).length;
    assert.ok(locks >= 2, `uiConfirm/uiPrompt 打开时应加锁，实测 ${locks} 处`);
    assert.ok(unlocks >= 2, `uiConfirm/uiPrompt 关闭时应解锁，实测 ${unlocks} 处`);
    assert.ok(/_uiModalLock\(\)/.test(batchRegion), '批量补全对话框打开时应加锁');
    assert.ok(/_uiModalUnlock\(\)/.test(batchRegion), '批量补全对话框关闭时应解锁');
  });

  it('H2-toast 层级高于模态遮罩（z-index >= 10000）', () => {
    const css = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8');
    const m = css.match(/\.toast-stack \{[^}]*?z-index:\s*(\d+)/);
    assert.ok(m, '.toast-stack 应声明 z-index');
    const z = parseInt(m[1], 10);
    assert.ok(z >= 10000, `.toast-stack z-index 应 >= 10000（遮罩为 9999，toast 不得被盖住），实测 ${z}`);
  });

  it('H3-标签移除控件键盘可达（role=button + tabindex + aria-label + 键盘触发）', () => {
    assert.ok(/role="button"/.test(src), '移除控件应声明 role="button"');
    assert.ok(/tabindex="0"/.test(src), '移除控件应可聚焦（tabindex="0"）');
    assert.ok(/aria-label=/.test(src), '移除控件应有 aria-label');
    const m = src.match(/c\.querySelector\('i'\)[\s\S]{0,400}/);
    assert.ok(m && /keydown|addEventListener\('keydown'/.test(m[0]), '移除控件应支持键盘 Enter/Space 触发');
  });
});
