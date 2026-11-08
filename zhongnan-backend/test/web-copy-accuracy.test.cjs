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

  it('G7 岗位数量必须与后端 ALL_ROLE_IDS 对齐（九大），不得手写「十大 / 10 岗位」', () => {
    const policy = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'model-config-policy.ts'), 'utf8');
    const m = policy.match(/ALL_ROLE_IDS:\s*RoleId\[\]\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(m, 'model-config-policy.ts 缺少 ALL_ROLE_IDS');
    const count = (m[1].match(/'[a-z]+'/g) || []).length;
    assert.strictEqual(count, 9, 'ALL_ROLE_IDS 应恰为 9 个（本守卫的数量基准），实际 ' + count);
    const zhNum = { 9: '九', 10: '十' }[count];
    // 前端：任何文件都不得再写「十大岗位 / 10 岗位 / 十岗位」
    const bad = [];
    for (const [file, src] of webSources()) {
      if (/十大岗位|10\s*岗位|十岗位/.test(src)) bad.push(file);
    }
    assert.deepStrictEqual(bad, [], '岗位数量与实际不符（后端 ALL_ROLE_IDS 为 ' + count + ' 个）：' + bad.join(', '));
    // 首页副标题必须用对齐后的数字（中英各一处，i18n 与 app.js 兜底文案都要对）
    const i18n = read('i18n.js');
    assert.match(i18n, new RegExp(zhNum + '大岗位智能体协同创作'), 'i18n 中文首页副标题的岗位数必须为' + zhNum + '大');
    assert.match(i18n, /homeSub:\s*'Nine agent roles/, 'i18n 英文首页副标题必须为 Nine agent roles');
    assert.ok(!/Ten agent roles|Ten specialized agents/.test(read('app.js')), 'app.js 英文兜底文案仍写 Ten');
    // 后端对外的 Word 清单同源文案
    const docx = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'api-directory-docx.ts'), 'utf8');
    assert.ok(!/十岗位|10\s*岗位/.test(docx), 'api-directory-docx.ts 的岗位数文案仍与实际不符');
  });

  it('G8 导出权益文案的会员档位必须与后端门控常量一致', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'script-doc.ts'), 'utf8');
    const min = doc.match(/EXPORT_MIN_LEVEL[^{]*\{([\s\S]*?)\};/);
    assert.ok(min, 'script-doc.ts 缺少 EXPORT_MIN_LEVEL');
    const levelOf = (body, fmt) => (body.match(new RegExp(fmt + ':\\s*MemberLevel\\.(\\w+)')) || [])[1];
    const docxLevel = levelOf(min[1], 'docx');
    const pdfLevel = levelOf(min[1], 'pdf');
    assert.ok(docxLevel && pdfLevel, 'EXPORT_MIN_LEVEL 必须声明 docx/pdf 档位');
    // 去水印 / 分镜附录：比较表达式里的档位才是真源（函数开头的 ?? FREE 兜底不算）
    const wmLevel = (doc.match(/canRemoveWatermark[\s\S]{0,260}?LEVEL_RANK\[MemberLevel\.(\w+)\]/) || [])[1];
    const shotLevel = (doc.match(/canExportShotList[\s\S]{0,320}?LEVEL_RANK\[MemberLevel\.(\w+)\]/) || [])[1];
    assert.ok(wmLevel && shotLevel, '去水印/分镜附录的门控档位应可从 script-doc.ts 读出');

    const ZH = { FREE: '免费', BASIC: '基础', ADVANCED: '高级', PRO: '专业' };
    const EN = { FREE: 'Free', BASIC: 'Basic', ADVANCED: 'Advanced', PRO: 'Pro' };
    const i18n = read('i18n.js');
    const copy = (key, lang) => {
      const block = i18n.slice(i18n.indexOf(lang === 'zh' ? '  zh: {' : '  en: {'));
      const m = block.match(new RegExp(key + ":\\s*'([^']*)'"));
      assert.ok(m, '词典缺少 ' + key + '（' + lang + '）');
      return m[1];
    };
    const cases = [
      ['dlDocx', docxLevel],
      ['dlPdf', pdfLevel],
      ['dlShotHint', shotLevel],
    ];
    for (const [key, level] of cases) {
      assert.ok(copy(key, 'zh').includes(ZH[level]), `${key} 中文文案未写对档位（应为${ZH[level]}会员）`);
      assert.ok(copy(key, 'en').includes(EN[level] + '+'), `${key} 英文文案未写对档位（应为 ${EN[level]}+）`);
    }
    // 去水印文案没有档位声明是允许的，但不能写着更低的档位（会诱导基础会员点空）
    const noWm = copy('dlNoWm', 'zh');
    for (const low of ['免费', '基础']) assert.ok(!noWm.includes(low), '去水印文案不得暗示低于 ' + ZH[wmLevel] + ' 的档位');
  });
});
