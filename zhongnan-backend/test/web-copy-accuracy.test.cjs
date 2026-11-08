/**
 * v2.471 用户可见文案准确性守卫（纯静态，不起服务器）
 *
 * 背景：站点经历上百版迭代后，用户可见文案与实际实现脱节的三类真实残留：
 *  ① 死入口占位语——v2.188 工作台化后导航项全部改成 data-open / data-view，
 *    index.html 中已无任何 `data-nav` 元素，但 app.js 仍绑着
 *    「该板块正在建设中，敬请期待～」处理器，永远不可能触发；
 *  ② 死字段分支——`I18N.MODES` 九项（auto + 8 模式）自 v2.329 起没有 `soon` 字段，
 *    「研发中 / coming soon」徽章与「电影剧本功能正在打磨，敬请期待～」全是不可达分支
 *    （电影剧本已是 SCRIPT_TYPES.feature_film，PRO 会员可直接使用）；
 *  ③ 数量漂移——会员权益手写「全部12模式」「采访/改编/标签/小说/互动 5模式」，
 *    实际只有 8 种创作模式（web/i18n.js MODES 与后端 src/config/modes.ts CREATION_MODES
 *    都是 8），与首页「全部 8 种模式 + 自动匹配」自相矛盾。
 *
 * 本守卫把三类固化成回归断言：再写「敬请期待」类占位语、再引用不存在的字段、
 * 再手写模式数量，立即红。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const read = (...p) => fs.readFileSync(path.join(WEB, ...p), 'utf8');

function webSources() {
  const out = new Map();
  for (const f of fs.readdirSync(WEB)) if (f.endsWith('.js') || f.endsWith('.html')) out.set(f, read(f));
  return out;
}

describe('v2.471 文案准确性', () => {
  it('G1 不得再出现「敬请期待 / 建设中 / coming soon / 研发中」类占位语', () => {
    const BANNED = ['敬请期待', '建设中', '即将上线', 'coming soon', '研发中', '敬请关注'];
    const hits = [];
    for (const [file, src] of webSources()) {
      for (const w of BANNED) {
        let i = src.indexOf(w);
        while (i >= 0) {
          hits.push(`${file}:${src.slice(0, i).split('\n').length} 「${w}」`);
          i = src.indexOf(w, i + w.length);
        }
      }
    }
    assert.deepStrictEqual(hits, [], '占位语残留（功能已实现或入口已不存在时，不得用「敬请期待」搪塞）：\n' + hits.join('\n'));
  });

  it('G2 不得再绑定不存在的 data-nav 选择器', () => {
    const app = read('app.js');
    assert.ok(!/\[data-nav\]/.test(app), 'app.js 仍引用 [data-nav]，但 index.html 中已无该属性（死处理器）');
    assert.ok(!/data-nav/.test(read('index.html')), 'index.html 不应出现 data-nav');
  });

  it('G3 不得引用 I18N.MODES 中不存在的 soon 字段（含其徽章与 CSS）', () => {
    const i18n = read('i18n.js');
    const app = read('app.js');
    const css = read('styles.css');
    assert.ok(!/\bsoon\s*:/.test(i18n), 'i18n.js 的 MODES 现有实现不含 soon 字段；若新增必须先补该字段并同步本守卫');
    assert.ok(!/m\.soon/.test(app), 'app.js 仍引用 m.soon（MODES 无此字段 → 徽章与提示都是不可达分支）');
    assert.ok(!/soon-badge/.test(app), 'app.js 仍渲染 soon-badge 徽章');
    assert.ok(!/\.soon(-badge)?\b/.test(css), 'styles.css 仍有已死的 .soon / .soon-badge 规则');
  });

  it('G4 不得手写创作模式数量（实际 8 种；auto 是路由入口不计入）', () => {
    const app = read('app.js');
    const bad = app.match(/全部\s*12\s*模式|All 12 modes|\b12\s*模式|\b12\s*modes|5模式|5 core modes/g) || [];
    assert.deepStrictEqual(bad, [], '硬编码模式数量与实际不符：' + bad.join(', '));
  });

  it('G5 会员权益的模式名单必须由 I18N.MODES 派生（单一事实源，防再次漂移）', () => {
    const app = read('app.js');
    assert.ok(/const modesUpTo = I18N\.MODES\.filter\(/.test(app), '未找到由 I18N.MODES 派生的 modesUpTo 计算');
    assert.ok(/modesUpTo\.length/.test(app), '权益文案应使用派生数量 modesUpTo.length，而不是手写数字');
    assert.ok(/const modeNames = modesUpTo\.map\(/.test(app), '权益文案应使用派生的模式名单 modeNames');
  });

  it('G6 派生数量自检：i18n MODES 去掉 auto 后恰为 8，且与后端 CREATION_MODES 对齐', () => {
    const I18N = require(path.join(WEB, 'i18n.js'));
    const modes = I18N.MODES.filter((m) => m.id !== 'auto');
    assert.strictEqual(modes.length, 8, 'web/i18n.js MODES 去 auto 后应为 8 种，实际 ' + modes.length);
    const ts = fs.readFileSync(path.join(ROOT, 'src', 'config', 'modes.ts'), 'utf8');
    const block = ts.slice(ts.indexOf('export const CREATION_MODES'), ts.indexOf('/* -------', ts.indexOf('export const CREATION_MODES')));
    const ids = [...block.matchAll(/\bid:\s*'([a-z_]+)'/g)].map((m) => m[1]);
    assert.strictEqual(ids.length, 8, 'src/config/modes.ts CREATION_MODES 应为 8 项，实际 ' + ids.length);
    assert.deepStrictEqual(
      [...modes.map((m) => m.id)].sort(), [...ids].sort(),
      '前端模式 id 与后端 CREATION_MODES 不一致（会产生可选但不可建的卡片）',
    );
  });
});
