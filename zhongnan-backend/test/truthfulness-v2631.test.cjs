/**
 * v2.631 导出文档的可选导演页/制片页异常必须可归因。
 *
 * 先证伪：
 *   `src/lib/script-doc.ts` 有 5 段「可选页不得阻断导出」的 `catch {}`：情绪波形、钩子地图、
 *   爽点-反转链、人物成长页、制作物料页。吞掉异常本身是产品既定（导出主流程优先），
 *   但全部零日志：一旦某个构建器因子数据/圣经形态变化而抛错，导出的 docx/pdf 会静默少掉整页
 *   （买家/出品方看到的交付物不完整），服务端却查不到任何原因，只能靠用户反馈「少了一页」。
 *   v2.627/v2.629 已把同源的解析失败改为条件留痕，这里补上页面级失败留痕。
 * 修复：5 处 catch 各补 `logInternal(e, 'script-doc.<页>')`，仍不阻断导出、响应/文档结构不变。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const SD = require('../dist/lib/script-doc.js');
const EW = require('../dist/engine/emotion-wave.js');
const HM = require('../dist/lib/hook-map.js');
const BC = require('../dist/lib/beat-chain.js');
const CA = require('../dist/lib/cast-arc.js');
const PM = require('../dist/engine/production-materials.js');

const project = {
  title: '测试剧', mode: 'tags', format: 'LIVE_ACTION', totalEps: 2,
  bible: {
    worldview: '现代都市',
    timeline: ['落魄继承人凭一道祖传菜谱逆袭'],
    characters: { 林晚: { traits: '隐忍/要强', arc: '从退让到反击', voice: '短句、带刺' } },
  },
};
const scripts = [
  { epNo: 1, title: '开局受辱', synopsis: '她被当众退婚', content: '场景一 内景 餐厅\n林晚攥紧了筷子。\n“这婚，我不结了。”', wordCount: 30 },
  { epNo: 2, title: '初次反击', synopsis: '一道菜惊艳全场', content: '场景一 内景 后厨\n她掂起炒锅，火苗腾起。', wordCount: 28 },
];

function captureErrors(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => (x instanceof Error ? x.stack || String(x) : String(x))).join(' ')); };
  try { return { value: fn(), calls }; } finally { console.error = orig; }
}
function withBroken(mod, name, scope) {
  const orig = mod[name];
  mod[name] = () => { throw new Error('构建器故障'); };
  const { value: doc, calls } = captureErrors(() => SD.buildScriptDoc(project, scripts, { level: 'BASIC' }));
  mod[name] = orig;
  const hit = calls.find((c) => c.includes(`[${scope}]`));
  assert.ok(hit, `${name} 抛错必须留痕 ${scope}；实际：${calls.join(' | ') || '(零日志)'}`);
  assert.ok(hit.includes('构建器故障'), '必须带错误信息；实际：' + hit);
  // 吞错不阻断导出：正文仍在、两集目录仍在
  const text = doc.blocks.map((b) => JSON.stringify(b)).join('');
  assert.ok(text.includes('这婚，我不结了'), '可选页失败不得阻断完整正文导出');
  assert.strictEqual(doc.blocks.filter((b) => b.kind === 'epStart').length, 2);
}

describe('v2.631 导出可选页失败留痕', () => {
  it('1) 情绪波形页异常 → script-doc.wave 且导出继续', () => withBroken(EW, 'buildEmotionWave', 'script-doc.wave'));
  it('2) 钩子地图页异常 → script-doc.hook-map 且导出继续', () => withBroken(HM, 'buildHookMap', 'script-doc.hook-map'));
  it('3) 爽点-反转链异常 → script-doc.beat-chain 且导出继续', () => withBroken(BC, 'buildBeatChain', 'script-doc.beat-chain'));
  it('4) 人物成长页异常 → script-doc.cast-arc 且导出继续', () => withBroken(CA, 'buildCastArcPage', 'script-doc.cast-arc'));
  it('5) 制作物料页异常 → script-doc.materials 且导出继续', () => withBroken(PM, 'buildProductionMaterials', 'script-doc.materials'));
});
