/**
 * v2.699 常驻守卫测试：创作模式真源自洽 + 可见通路（scripts/guard-mode-wiring.cjs）。
 *
 * 双证结构：
 *  ①真实前端三份真源（i18n.js / data/constants.js / app.js）扫描必须 0 violation ——
 *    auto 模式在 MODE_BRIEF 唯一真源漏条目、中英 mode 名称表键集漂移两个真实缺口已修；
 *    任何人新增模式只补一处真源，本测试即刻转红。
 *  ②fixture 红黑自证（守卫自身不得形同虚设）：
 *    缺 brief 必报 / 两套名称表漂移必报 / 无可见输入面必报 / 结构化分支孤儿必报；
 *    四处齐备的完整 fixture 必不报（守卫不误杀）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scanSources, scanProject, parseModes, parseStructuredModes } = require('../scripts/guard-mode-wiring.cjs');

/** 生成一套与真实 i18n.js 同形的 mode 名称表块（多行，后接 modeDesc） */
function nameBlock(locale, keys) {
  const names = keys.map((k) => `${k}: '${locale}-${k}'`).join(', ');
  return `    mode: {\n      ${names}\n    },\n    modeDesc: { ${keys.map((k) => `${k}: 'd'`).join(', ')} },\n`;
}

/** 造一份四处真源齐备的最小前端源码 */
function fixture(opts = {}) {
  const modes = opts.modes || ['tag', 'spark'];
  const zhNames = opts.zhNames || modes;
  const enNames = opts.enNames || modes;
  const i18n = `const MODES = [\n${modes.map((m) => `    { id: '${m}', free: 'free' },`).join('\n')}\n  ];\n`
    + nameBlock('zh', zhNames) + nameBlock('en', enNames);
  const constants = `C.MODE_BRIEF = {\n${(opts.briefKeys || modes).map((m) => `    ${m}: { zh: ['a', 'b'], en: ['a', 'b'] },`).join('\n')}\n    default: { zh: ['a'], en: ['a'] },\n  };`;
  const panels = (opts.panelKeys || modes).map((m) => `    ${m}: [${opts.emptyPanels && opts.emptyPanels.includes(m) ? '' : `'${m}Panel'`}],`).join('\n');
  const app = `  const _MODE_PANEL_MAP = {\n${panels}\n  };\n`
    + `  function structuredModeBrief() {\n${(opts.structured || []).map((m) => `    if (selectedMode === '${m}') return 'x';`).join('\n')}\n    return '';\n  }`;
  return { i18n, constants, app };
}

describe('v2.699 模式真源自洽守卫（guard-mode-wiring）', { concurrency: 1 }, () => {
  it('真实前端全量扫描：0 violation（auto 缺 brief、中英名称漂移已修；新增模式只补一处即刻转红）', () => {
    const v = scanProject();
    assert.deepStrictEqual(v, [], `模式真源不自洽：\n${v.map((x) => `  [${x.rule}] ${x.file} ${x.why}`).join('\n')}`);
  });

  it('绿能力：四处真源齐备的 fixture → 0 violation（不误杀）', () => {
    assert.strictEqual(scanSources(fixture()).length, 0);
  });

  it('红能力①：MODES 有模式但 MODE_BRIEF 缺条目 → mode-brief-missing（v2.328 auto 事故同型）', () => {
    const v = scanSources(fixture({ modes: ['tag', 'auto'], briefKeys: ['tag'] }));
    assert.ok(v.some((x) => x.rule === 'mode-brief-missing' && /auto/.test(x.why)), v.map((x) => x.why).join('|'));
  });

  it('红能力②：中英 mode 名称表键集漂移 → mode-name-lang-drift（en 有 tags、zh 无）', () => {
    const v = scanSources(fixture({ modes: ['tag'], zhNames: ['tag'], enNames: ['tag', 'tags'] }));
    assert.ok(v.some((x) => x.rule === 'mode-name-lang-drift' && /tags/.test(x.why)), v.map((x) => x.why).join('|'));
  });

  it('红能力③：模式既无可见 panel 也无结构化合成 → mode-no-visible-input（v2.698 死路同型）', () => {
    const v = scanSources(fixture({ modes: ['persona'], emptyPanels: ['persona'] }));
    assert.ok(v.some((x) => x.rule === 'mode-no-visible-input' && /persona/.test(x.why)), v.map((x) => x.why).join('|'));
  });

  it('绿能力②：空 panel 但有 structuredModeBrief 分支 → 合规（v2.698 修复形态）', () => {
    const v = scanSources(fixture({ modes: ['multiverse'], emptyPanels: ['multiverse'], structured: ['multiverse'] }));
    assert.strictEqual(v.length, 0, v.map((x) => x.why).join('|'));
  });

  it('红能力④：structuredModeBrief 分支指向 MODES 之外 → structured-mode-orphan', () => {
    const v = scanSources(fixture({ modes: ['tag'], structured: ['ghost_mode'] }));
    assert.ok(v.some((x) => x.rule === 'structured-mode-orphan' && /ghost_mode/.test(x.why)), v.map((x) => x.why).join('|'));
  });

  it('解析器自证：MODES / structuredModeBrief 分支能被正确抽出（守卫不靠脆弱的全文正则）', () => {
    const f = fixture({ modes: ['tag', 'duel'], structured: ['duel'] });
    assert.deepStrictEqual(parseModes(f.i18n), ['tag', 'duel']);
    assert.deepStrictEqual(parseStructuredModes(f.app), ['duel']);
  });
});
