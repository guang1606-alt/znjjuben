/**
 * v2.378 登录页凭证防泄漏回归
 * 缺口：v2.324 环境横幅为"避免密码/端口混淆"把超管账号与明文密码写进
 *       web/app.js，生产端口（8899）同样展示——任何访客打开首页的登录弹窗
 *       即可看到后台凭证，等同于超管权限公开。
 * 约束：横幅本身（模式提示）保留，仅移除凭证；演示/生产两档都不得硬编码。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const app = read('web/app.js');
const consoleJs = read('web/production-console.js');

test('web/app.js 不再硬编码任何测试/生产账号密码', () => {
  assert.ok(!app.includes('yxgnono0726'), 'app.js 仍含生产口令');
  assert.ok(!app.includes('demo123456'), 'app.js 仍含演示口令');
  assert.ok(!app.includes('18891995171'), 'app.js 仍含超管手机号');
});

test('web/production-console.js 不再硬编码超管手机号', () => {
  assert.ok(!consoleJs.includes('18891995171'), 'production-console.js 仍含超管手机号');
});

test('环境横幅保留模式提示但生产档不再展示任何凭证', () => {
  assert.ok(app.includes('生产模式'), '生产模式提示不应被整体删掉');
  assert.ok(app.includes('演示模式'), '演示模式提示不应被整体删掉');
  const prodIdx = app.indexOf('生产模式');
  const nextBranch = app.indexOf('当前端口', prodIdx);
  const branch = app.slice(prodIdx, nextBranch > prodIdx ? nextBranch : prodIdx + 120);
  assert.ok(!branch.includes('账号：'), `生产横幅仍展示账号: ${branch}`);
  assert.ok(!branch.includes('密码：'), `生产横幅仍展示密码: ${branch}`);
  assert.ok(!branch.includes('/ <b>'), `生产横幅仍展示「账号 / 密码」格式: ${branch}`);
});

test('生产档横幅不得出现「演示/测试账号」字样', () => {
  const prodIdx = app.indexOf('🗄️');
  assert.ok(prodIdx > -1, '生产横幅标记缺失');
  const branch = app.slice(prodIdx, prodIdx + 160);
  assert.ok(!branch.includes('测试账号'), '生产横幅仍引导使用测试账号');
  assert.ok(!branch.includes('演示账号'), '生产横幅仍引导使用演示账号');
});
