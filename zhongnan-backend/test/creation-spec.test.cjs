const { describe, it } = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/creation-spec.js');
const F = require('../dist/engine/script-format.js');

describe('v2.20 统一创作规范唯一事实源', () => {
  it('四阶段/六维/四层钩子/进化协议齐备且与制式字数同源一致', () => {
    assert.strictEqual(C.CREATION_STAGES.length, 4);
    assert.strictEqual(C.SCORE_DIMENSIONS.length, 6);
    assert.strictEqual(C.HOOK_TAXONOMY.length, 4);
    assert.deepStrictEqual(C.HOOK_TAXONOMY.map((h) => h.id), ['open', 'episode', 'scene', 'micro']);
    assert.ok(C.EVOLUTION_PROTOCOL.antiEnclosure.some((x) => x.includes('外部校准')));
    const spec = C.unifiedSpecSummary();
    assert.ok(spec.includes('真人实拍') === false); // 字数以 script-format 为唯一源，这里不重复写死
    assert.deepStrictEqual(F.WORD_RANGE.LIVE, [800, 1000]);
    assert.deepStrictEqual(F.WORD_RANGE.AIGC, [1200, 1500]);
    assert.ok(C.evolutionProtocolMd().includes('优胜劣汰'));
  });
});
