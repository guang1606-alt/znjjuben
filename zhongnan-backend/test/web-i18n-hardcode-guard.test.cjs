/**
 * v2.262 i18n 双语覆盖守卫 —— 用户可见文案不得硬编码中文（防漏网）
 * 背景：v2.261 勘察发现两类真漏网：
 *  ① app.js toastError/toastOk 默认 title 硬编码「出错/成功」，且 toast 关闭按钮 aria-label 硬编码「关闭」，
 *     en 用户看到中文标题/读屏；
 *  ② progress-view.js 纯函数状态机的 done/failed_refunded/cancelled 分支把中文 label/error 直接写进 state
 *     （'新鲜剧本出炉'/'生成失败，已冻结积分将原路退回'/'已取消生成，冻结积分将原路退回'），
 *     en 用户生成完成/失败时看到中文。
 * 修复策略：progress-view.js 存语义键（__pv_done__/__pv_failed__/__pv_cancelled__），消费端按 lang 翻译；
 *  toast 默认 title 与 aria-label 走 _uiLangEn() 三元。
 * 本文件静态断言收口不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const appSrc = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const pvSrc = fs.readFileSync(path.join(WEB, 'progress-view.js'), 'utf8');
// 剥行注释
const appNoCmt = appSrc.replace(/\/\/.*$/gm, '');
const pvNoCmt = pvSrc.replace(/\/\/.*$/gm, '');

describe('v2.262 i18n 双语覆盖守卫（用户可见文案不硬编码中文）', () => {
  it('app.js toastError/toastOk/toastInfo 默认 title 不得硬编码中文（en 用户应看到英文）', () => {
    // 禁止：title || '出错' / title || '成功' / title || '网络问题' 等
    assert.doesNotMatch(appNoCmt, /toastError\(msg,\s*title\)[^}]*\|\|\s*'[^']*[一-鿿]/,
      'toastError 默认 title 不得硬编码中文');
    assert.doesNotMatch(appNoCmt, /toastOk\(msg,\s*title\)[^}]*\|\|\s*'[^']*[一-鿿]/,
      'toastOk 默认 title 不得硬编码中文');
  });

  it('app.js toast 关闭按钮 aria-label 不得硬编码中文（读屏场景）', () => {
    assert.doesNotMatch(appNoCmt, /setAttribute\('aria-label',\s*'[^']*[一-鿿]/,
      'toast 关闭按钮 aria-label 不得硬编码中文');
  });

  it('app.js onNetworkError/onServerBusy/onSessionRemoteChange 的 toast 调用不得硬编码中文', () => {
    // 定位 Api.on* 注册块
    const s = appNoCmt.indexOf('Api.onAuthRequired');
    assert.ok(s >= 0, '应定位到 Api.onAuthRequired 注册块');
    const e = appNoCmt.indexOf('document.querySelectorAll(\'.nav [data-view]\')', s);
    assert.ok(e > s, '注册块应延续到 nav 绑定之前');
    const region = appNoCmt.slice(s, e);
    // 该区域内 toastError/toastInfo 的第一个实参不得是硬编码中文字符串
    assert.doesNotMatch(region, /toastError\('[^']*[一-鿿]/, 'onNetworkError/onServerBusy 的 toastError 首参不得硬编码中文');
    assert.doesNotMatch(region, /toastInfo\('[^']*[一-鿿]/, 'onSessionRemoteChange 的 toastInfo 首参不得硬编码中文');
    // 区域内不得出现 const msg = ... ? '中文' : '中文' 形态
    assert.doesNotMatch(region, /const\s+msg\s*=\s*[^;]*'[^']*[一-鿿][^']*'\s*:\s*'[^']*[一-鿿]/,
      '网络错误 msg 构造不得出现硬编码中文三元');
  });

  it('progress-view.js done/failed_refunded/cancelled 分支不得把中文写入 state.label/state.error', () => {
    // done 分支：next.label = '...'
    const doneIdx = pvNoCmt.indexOf("case 'done'");
    assert.ok(doneIdx >= 0, '应定位到 done 分支');
    const doneRegion = pvNoCmt.slice(doneIdx, doneIdx + 400);
    assert.doesNotMatch(doneRegion, /next\.label\s*=\s*'[^']*[一-鿿]/, 'done 分支 next.label 不得硬编码中文');
    // failed_refunded 分支
    const failIdx = pvNoCmt.indexOf("case 'failed_refunded'");
    assert.ok(failIdx >= 0, '应定位到 failed_refunded 分支');
    const failRegion = pvNoCmt.slice(failIdx, failIdx + 400);
    assert.doesNotMatch(failRegion, /next\.error\s*=\s*'[^']*[一-鿿]/, 'failed_refunded 分支 next.error 不得硬编码中文');
    // cancelled 分支
    const cancelIdx = pvNoCmt.indexOf("case 'cancelled'");
    assert.ok(cancelIdx >= 0, '应定位到 cancelled 分支');
    const cancelRegion = pvNoCmt.slice(cancelIdx, cancelIdx + 400);
    assert.doesNotMatch(cancelRegion, /next\.error\s*=\s*'[^']*[一-鿿]/, 'cancelled 分支 next.error 不得硬编码中文');
  });

  it('progress-view.js 语义键常量 __pv_done__/__pv_failed__/__pv_cancelled__ 已定义且被使用', () => {
    assert.match(pvNoCmt, /__pv_done__/, '应定义 __pv_done__ 语义键');
    assert.match(pvNoCmt, /__pv_failed__/, '应定义 __pv_failed__ 语义键');
    assert.match(pvNoCmt, /__pv_cancelled__/, '应定义 __pv_cancelled__ 语义键');
  });

  it('app.js 渲染进度处应消费语义键并按 lang 翻译（防 state 键直接上屏）', () => {
    // app.js 中应有把 __pv_done__ 等键翻译成双语文案的逻辑
    assert.match(appNoCmt, /__pv_done__/, 'app.js 应消费 __pv_done__ 键');
    assert.match(appNoCmt, /__pv_failed__/, 'app.js 应消费 __pv_failed__ 键');
    assert.match(appNoCmt, /__pv_cancelled__/, 'app.js 应消费 __pv_cancelled__ 键');
    // 翻译函数应存在
    assert.match(appNoCmt, /function\s+\w*[Pp]rogress\w*[Ll]abel|function\s+\w*Pv\w*Text|function\s+translateProgressState/,
      'app.js 应有进度状态键翻译函数');
  });
});
