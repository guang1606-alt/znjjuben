'use strict';
// v2.687 额度/积分失败指引：只显示「积分不足」等于把用户留在死路。
// 这里守三件事：①识别免费额度与积分两类可恢复失败；②指引里带余额与「还能做什么」，并给出会员/免费工具箱两个出口；
// ③所有失败入口（showFail）与语言切换都会刷新这块指引，不残留旧文案。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('web/index.html');
const css = read('web/styles.css');
const app = read('web/app.js');

test('失败面板含额度指引区与两个可继续的出口', () => {
  const panel = html.match(/<section class="panel hidden" id="failPanel">[\s\S]*?<\/section>/)[0];
  assert.match(panel, /id="failQuotaHelp"[^>]*class="fail-help hidden"|class="fail-help hidden"[^>]*id="failQuotaHelp"/);
  assert.match(panel, /id="failQuotaText"/);
  assert.match(panel, /id="failQuotaVip"/);
  assert.match(panel, /id="failQuotaFree"/);
  // 默认隐藏：没有额度失败时不打扰普通失败
  assert.match(panel, /fail-help hidden/);
});

test('quotaFailKind 区分免费额度与积分，不误伤普通失败', () => {
  const src = app.match(/function quotaFailKind\(msg\) \{[\s\S]*?\n  \}/)[0];
  const kind = new Function(src + '\nreturn quotaFailKind;')();
  assert.equal(kind('今日免费2集已用完，开通会员无限创作'), 'free');
  assert.equal(kind('Today’s free episodes are used up'), 'free');
  assert.equal(kind('积分不足，请先充值'), 'points');
  assert.equal(kind('INSUFFICIENT'), '');
  assert.equal(kind('Not enough points — balance 3'), 'points');
  assert.equal(kind('生成失败，已冻结积分将原路退回'), '');
});

test('指引带余额与免费工具清单，两个按钮文案成对刷新', () => {
  assert.match(app, /const raw = meCache && meCache\.points \? Number\(meCache\.points\.balance\) : NaN;/);
  assert.match(app, /当前余额 \$\{bal\} 积分/);
  assert.match(app, /剧本体检」「打磨阶梯」「多版本去重」「分支校验/);
  assert.match(app, /减少本次集数或切换经济档/);
  assert.match(app, /\$\('failQuotaVip'\)\.textContent = kind === 'free'/);
  assert.match(app, /\$\('failQuotaFree'\)\.textContent = en \? 'Open free toolbox' : '去免费工具箱'/);
  // 会员/免费工具箱两个出口都要真的能走
  assert.match(app, /\$\('failQuotaVip'\)\.onclick = \(\) => \{[^}]*switchView\('vip'\)/);
  assert.match(app, /\$\('failQuotaFree'\)\.onclick = \(\) => \{[^}]*switchView\('toolbox'\)/);
});

test('所有失败入口与语言切换都会刷新指引', () => {
  const showFail = app.match(/function showFail\(msg, refunded\) \{[\s\S]*?\n  \}/)[0];
  assert.match(showFail, /syncFailQuotaHelp\(msg\)/);
  const applyLang = app.match(/function applyLang\(\) \{[\s\S]*?\n  \}/)[0];
  assert.match(applyLang, /syncFailQuotaHelp\(\)/);
  // 指引卡走主题令牌，不写死颜色
  assert.match(css, /\.fail-help \{[^}]*background: var\(--soft-warn\)/);
});
