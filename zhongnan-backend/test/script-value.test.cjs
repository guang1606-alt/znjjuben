const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildScriptValue, gradeOf } = require('../dist/lib/script-value.js');

function ep() {
  let s = '【场景】日内 公司\n【人物】林晚、陈总\n林晚（冷笑）：你以为我真是保洁？\n';
  for (let i = 0; i < 12; i++) s += '陈总（震惊）：什么？！\n林晚：我占股51%，现在，滚出去。\n反转！打脸！爽点！钩子！名场面！\n';
  return s;
}

describe('剧本价值证书引擎（v2.69，纯确定性）', () => {
  it('无正文 → NA、无价值区间、不编造', () => {
    const c = buildScriptValue({ title: '空', tags: [], contents: [], lang: 'zh' });
    assert.strictEqual(c.episodes, 0);
    assert.strictEqual(c.grade, 'NA');
    assert.strictEqual(c.band, null);
  });

  it('等级阈值正确', () => {
    assert.strictEqual(gradeOf(90, 1), 'S');
    assert.strictEqual(gradeOf(78, 1), 'A');
    assert.strictEqual(gradeOf(65, 1), 'B');
    assert.strictEqual(gradeOf(40, 1), 'C');
    assert.strictEqual(gradeOf(99, 0), 'NA');
  });

  it('有正文 → 价值指数=创作与资方各半、区间=单集×集数、标注估算', () => {
    const c = buildScriptValue({ title: '保洁大股东', penName: '墨白', tags: ['逆袭', '复仇'], contents: [ep(), ep()], lang: 'zh' });
    assert.strictEqual(c.episodes, 2);
    assert.ok(Math.abs(c.valueIndex - (0.5 * c.craftScore + 0.5 * c.funderScore)) < 0.05);
    assert.ok(c.band && c.band.marketEstimated === true);
    assert.strictEqual(c.band.totalLow, c.band.perEpLow * 2);
    assert.strictEqual(c.band.totalHigh, c.band.perEpHigh * 2);
    assert.ok(c.strengthsZh.length >= 2);
    assert.ok(c.disclaimerZh.includes('非报价'));
    assert.ok(c.shareTextZh.includes('墨白') && c.shareTextZh.includes('保洁大股东'));
  });

  it('分享文案不含剧本全文（只含梗概级信息）', () => {
    const c = buildScriptValue({ title: 'T', tags: ['逆袭'], contents: [ep()], synopsis: '一句话', lang: 'zh' });
    assert.ok(!c.shareTextZh.includes('滚出去'));   // 正文台词不得外泄
    assert.ok(!c.shareTextZh.includes('占股51%'));  // 正文细节不得外泄
    assert.ok(c.shareTextZh.includes('一句话'));
  });

  it('确定性：同输入两次结果一致', () => {
    const a = buildScriptValue({ title: 'T', tags: ['逆袭'], contents: [ep(), ep()], lang: 'zh' });
    const b = buildScriptValue({ title: 'T', tags: ['逆袭'], contents: [ep(), ep()], lang: 'zh' });
    assert.strictEqual(JSON.stringify(a.dimensions), JSON.stringify(b.dimensions));
    assert.strictEqual(a.valueIndex, b.valueIndex);
  });

  it('英文层零中文', () => {
    const cjk = /[一-鿿]/;
    const en = buildScriptValue({ title: 'Hidden Boss', tags: ['underdog'], contents: [ep()], lang: 'en' });
    assert.ok(!cjk.test(en.gradeEn));
    assert.ok(!en.dimensions.some((d) => cjk.test(d.labelEn)));
    assert.ok(!cjk.test(en.shareTextEn));
    assert.ok(!cjk.test(en.disclaimerEn));
  });
});
