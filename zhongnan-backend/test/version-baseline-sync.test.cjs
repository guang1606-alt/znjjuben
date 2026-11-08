/**
 * v2.471 版本基线一致性守卫（纯静态）
 *
 * 背景：dogfood 节奏每轮固定「升版三件套」——package.json / docs/FRONTEND-ADAPTATION.md
 * 基线行 / 版本表最新行。三处此前只靠人工记忆同步，漏一处就会出现「代码 v2.470、
 * 文档还写 v2.469」的对外不一致（静态资源指纹 ?v=<package.json version> 也读同一来源，
 * 文档基线漂移会让排障者对不上缓存号）。本守卫把三处对齐固化成断言。
 *
 * 允许版本表用两位（v2.470）或三位（v2.277.0）写法，与既有历史行保持一致。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const doc = fs.readFileSync(path.join(ROOT, 'docs', 'FRONTEND-ADAPTATION.md'), 'utf8');

describe('v2.471 版本基线一致性', () => {
  it('package.json 版本为语义化 x.y.z', () => {
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'package.json version 必须是 x.y.z');
  });

  it('FRONTEND-ADAPTATION 基线行与 package.json 一致', () => {
    const m = doc.match(/当前基线：\*\*(v\d+\.\d+\.\d+)\*\*/);
    assert.ok(m, 'docs/FRONTEND-ADAPTATION.md 缺少「当前基线：**vX.Y.Z**」锚点');
    assert.strictEqual(m[1], 'v' + pkg.version, '基线行 ' + m[1] + ' 与 package.json v' + pkg.version + ' 不一致');
  });

  it('package-lock.json 根版本与 package.json 一致（v2.343 起长期漏更）', () => {
    const lockPath = path.join(ROOT, 'package-lock.json');
    if (!fs.existsSync(lockPath)) return;
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    assert.strictEqual(lock.version, pkg.version, 'package-lock.json version 应等于 package.json version');
    if (lock.packages && lock.packages['']) {
      assert.strictEqual(lock.packages[''].version, pkg.version, 'package-lock.json packages[""].version 应同步');
    }
  });

  it('版本表存在当前版本行（两位或三位写法）', () => {
    const two = 'v' + pkg.version.replace(/\.0$/, '');
    const three = 'v' + pkg.version;
    const hasTwo = doc.includes('| ' + two + ' |');
    const hasThree = doc.includes('| ' + three + ' |');
    assert.ok(hasTwo || hasThree, '版本表缺少 ' + three + '（或 ' + two + '）行：升版时先补文档再提交');
  });
});
