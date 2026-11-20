/**
 * v2.581 版本号「五处一致」：运行时版本不再漂移。
 *
 * 背景（先证伪）：`bump-version.cjs` 会同步 `web/data/constants.js` 的 `C.ZN_VERSION`，
 * 但 v2.578~v2.580 的发布提交都漏带了该文件——`package.json` 已是 2.580.0，
 * 线上首页更新通知却仍显示「已更新到 v2.577.0」（app.js wireHomeUpdateNotice 读的就是它）。
 * 根因是 preflight 只校验「文件三件套 + 文档基线」四处，没有把会被用户直接看到的运行时版本纳入。
 *
 * 本用例锁两件事：
 *  1) constants.js 的 ZN_VERSION 与 package.json 同版本；
 *  2) preflight（scope-guard）确实把 constants.js 纳入一致性校验，今后漂移会被机械拦截。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function znVersionOf(text) {
  const m = text.match(/C\.ZN_VERSION = '([^']+)'/);
  return m ? m[1] : '';
}

describe('版本号一致性（v2.581）', () => {
  it('web/data/constants.js 的 ZN_VERSION 与 package.json 一致（首页更新通知按它展示）', () => {
    const text = fs.readFileSync(path.join(ROOT, 'web', 'data', 'constants.js'), 'utf8');
    assert.strictEqual(znVersionOf(text), pkg.version);
  });

  it('scope-guard 版本校验纳入 constants.js（五处一致）', () => {
    const { readVersionState } = require('../scripts/scope-guard.cjs');
    const v = readVersionState();
    assert.strictEqual(v.constants, pkg.version, 'preflight 必须把运行时版本纳入一致性校验');
    assert.deepStrictEqual(
      [...new Set([v.pkg, v.lock, v.lockRoot, v.docs, v.constants])],
      [pkg.version],
      '五处版本必须同值',
    );
  });
});
