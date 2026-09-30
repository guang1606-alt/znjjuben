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
});
