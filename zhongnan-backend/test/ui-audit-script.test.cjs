/**
 * v2.472 UI 巡检脚本自身守卫（纯静态，不启浏览器）
 *
 * 背景：dogfood 每轮都要"打开无头 Chrome 逐视图扫遮挡/点击/溢出"，此前靠 /tmp 临时脚本，
 * 用完即弃。v2.472 固化为 scripts/ui-audit.cjs（npm run audit:ui）。本守卫防止脚本被
 * 误删/误改后仍"假绿"：核心检查项少一项、视图列表漏一个、命令名被改掉都要红。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ui-audit.cjs');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const script = fs.existsSync(SCRIPT) ? fs.readFileSync(SCRIPT, 'utf8') : '';
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');

describe('v2.472 UI 巡检脚本守卫', () => {
  it('脚本存在且语法可解析', () => {
    assert.ok(script, 'scripts/ui-audit.cjs 缺失：巡检入口不能消失');
    const r = spawnSync(process.execPath, ['--check', SCRIPT], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, 'node --check 失败：' + (r.stderr || ''));
  });

  it('npm run audit:ui 指向该脚本', () => {
    assert.strictEqual(pkg.scripts['audit:ui'], 'node scripts/ui-audit.cjs');
  });

  it('核心检查项一个不能少（防误删后假绿）', () => {
    ['horizontalOverflow', 'clickStolen', 'unnamedControls', 'offscreenX', 'tinyTargets', 'overlayOpen', 'activeNavHidden']
      .forEach((k) => assert.ok(script.includes(k), '缺少检查项标记：' + k));
  });

  it('视图列表覆盖 index.html 全部 data-view', () => {
    const views = [...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(views.length >= 8, 'index.html data-view 数量异常：' + views.length);
    const listMatch = script.match(/const VIEWS = \[([^\]]*)\]/);
    assert.ok(listMatch, '脚本缺少 VIEWS 数组');
    const declared = [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    [...new Set(views)].forEach((v) => {
      assert.ok(declared.includes(v), '新增视图漏巡检：' + v + '（同步 scripts/ui-audit.cjs 的 VIEWS）');
    });
  });

  it('不包含危险/写库操作', () => {
    [/git\s+add/, /rm\s+-rf/, /DROP\s+TABLE/i].forEach((re) => {
      assert.ok(!re.test(script), '巡检脚本不应包含：' + re);
    });
  });

  it('浏览器路径可覆盖且使用 playwright-core（不依赖全局安装）', () => {
    assert.ok(script.includes('CHROME_PATH'), '需支持 CHROME_PATH 覆盖浏览器路径');
    assert.ok(script.includes("require('playwright-core')"), '需使用仓库内 playwright-core');
  });

  it('--deep 登录态巡检：令牌写入口径必须与 web/api.js 一致', () => {
    assert.ok(script.includes('--deep'), '缺少 --deep 选项');
    assert.ok(script.includes("'/api/auth/login'"), '缺少登录接口调用');
    ['zn_token', 'zn_refresh', 'zn_user'].forEach((k) => {
      assert.ok(script.includes("localStorage.setItem('" + k + "'"), '缺少会话键写入：' + k);
    });
    assert.ok(/JSON\.stringify/.test(script), '存储值必须是 JSON.stringify（与 web/api.js 同口径）');
  });

  it('弹窗巡检动态枚举且跳过空壳（避免强开误报）', () => {
    assert.ok(script.includes("querySelectorAll('.modal-mask[id]')"), '弹窗列表必须动态枚举，新增弹窗才能自动覆盖');
    assert.ok(script.includes('shell'), '缺少空壳弹窗跳过机制');
    assert.ok(script.includes('overlayControls'), '缺少遮罩内控件计数（判定空壳依据）');
  });

  it('一键收口命令存在且链路正确', () => {
    assert.strictEqual(pkg.scripts.verify, 'npm run typecheck && npm test');
    assert.match(pkg.scripts['verify:full'] || '', /audit:ui|ui-audit\.cjs/, 'verify:full 必须包含 UI 巡检');
    assert.match(pkg.scripts['verify:full'] || '', /--deep/, 'verify:full 应覆盖登录态与弹窗');
  });
});
