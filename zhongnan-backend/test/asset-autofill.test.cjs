const { describe, it } = require('node:test');
const assert = require('node:assert');
const { autoFillCastAsset } = require('../dist/engine/asset-health.js');
const { autoFillPropAsset } = require('../dist/engine/prop-health.js');
const { autoFillSceneAsset } = require('../dist/engine/scene-health.js');

// v2.181 三族 autoFill 引擎层契约测试
// 哲学：只补占位级、不补声纹/出现集/指纹；persona/meaning 必填不替编导捏

describe('autoFillCastAsset · 角色家族规则模板补全', () => {
  it('缺 persona/缺 name：整条 skipped，不替编导捏人设', () => {
    for (const a of [null, undefined, {}, { name: '无名氏' }]) {
      const r = autoFillCastAsset(a);
      assert.strictEqual(r.filled.filledFields.length, 0);
      assert.ok(r.skipped.some((s) => s.field === 'persona'));
    }
  });

  it('全满配：filledFields 为空，skipped 也为空', () => {
    const r = autoFillCastAsset({
      name: '林昭', persona: '外冷内热的刑警，欲望是为父翻案', voice: '短句多', signatureLines: ['案子不会说谎'],
      visualAnchor: '左眉一道疤', voicePrint: { signature: '短句/疑问' },
    });
    assert.strictEqual(r.filled.filledFields.length, 0);
    assert.strictEqual(r.skipped.length, 0);
  });

  it('缺 voice/visualAnchor/signatureLines：三字段都被补全', () => {
    const r = autoFillCastAsset({ name: '张三', persona: '刚正的剑客，欲望是护民' });
    assert.ok(r.filled.filledFields.includes('voice'));
    assert.ok(r.filled.filledFields.includes('signatureLines'));
    assert.ok(r.filled.filledFields.includes('visualAnchor'));
    assert.ok(r.filled.voice && r.filled.voice.length > 0);
    assert.ok(Array.isArray(r.filled.signatureLines) && r.filled.signatureLines.length > 0);
    assert.ok(r.filled.visualAnchor && r.filled.visualAnchor.length > 0);
  });

  it('缺 voicePrint：skipped 返回不可补原因', () => {
    const r = autoFillCastAsset({ name: '李四', persona: '谨慎多疑的老捕快' });
    assert.ok(r.skipped.some((s) => s.field === 'voicePrint' && s.reason.includes('声纹')));
  });

  it('en 模式：filled 字段值为英文', () => {
    const r = autoFillCastAsset({ name: 'A', persona: '复仇者' }, 'en');
    assert.ok(r.filled.voice && r.filled.voice.toLowerCase().includes('rhythm'));
    assert.ok(r.filled.visualAnchor && r.filled.visualAnchor.toLowerCase().includes('build'));
  });
});

describe('autoFillPropAsset · 道具家族规则模板补全', () => {
  it('缺 meaning：整条 skipped', () => {
    const r = autoFillPropAsset({ name: '玉佩' });
    assert.strictEqual(r.filled.filledFields.length, 0);
    assert.ok(r.skipped.some((s) => s.field === 'meaning'));
  });

  it('缺 visualAnchor/taboo/tags：三字段都被补全', () => {
    const r = autoFillPropAsset({ name: '血玉', meaning: '认亲凭证，是复仇证据' });
    assert.ok(r.filled.filledFields.includes('visualAnchor'));
    assert.ok(r.filled.filledFields.includes('taboo'));
    assert.ok(r.filled.filledFields.includes('tags'));
    assert.ok(r.filled.taboo && r.filled.taboo.includes('认亲凭证'));
    assert.ok(Array.isArray(r.filled.tags) && r.filled.tags.length > 0);
  });

  it('缺 eps：skipped 返回不可补原因', () => {
    const r = autoFillPropAsset({ name: '玉佩', meaning: '认亲凭证' });
    assert.ok(r.skipped.some((s) => s.field === 'eps' && s.reason.includes('连续性')));
  });

  it('meaning 含"玉"：visualAnchor 材质推断为玉', () => {
    const r = autoFillPropAsset({ name: '玉璧', meaning: '认亲凭证，传家宝玉' });
    assert.ok(r.filled.visualAnchor && r.filled.visualAnchor.includes('玉'));
  });
});

describe('autoFillSceneAsset · 场景家族规则模板补全', () => {
  it('缺 meaning：整条 skipped', () => {
    const r = autoFillSceneAsset({ name: '祠堂' });
    assert.strictEqual(r.filled.filledFields.length, 0);
    assert.ok(r.skipped.some((s) => s.field === 'meaning'));
  });

  it('缺 visualAnchor/mood/tags：三字段都被补全', () => {
    const r = autoFillSceneAsset({ name: '林府', meaning: '权谋交锋的主舞台' });
    assert.ok(r.filled.filledFields.includes('visualAnchor'));
    assert.ok(r.filled.filledFields.includes('mood'));
    assert.ok(r.filled.filledFields.includes('tags'));
    assert.ok(r.filled.mood && r.filled.mood.length > 0);
  });

  it('meaning 含"权/谋"：mood 推断为阴沉', () => {
    const r = autoFillSceneAsset({ name: '议事厅', meaning: '权谋交锋的现场' });
    assert.strictEqual(r.filled.mood, '阴沉');
  });

  it('meaning 含"祠"：visualAnchor 形制推断为祠堂式', () => {
    const r = autoFillSceneAsset({ name: '祖祠', meaning: '认祖归宗的祠堂' });
    assert.ok(r.filled.visualAnchor && r.filled.visualAnchor.includes('祠堂式'));
  });

  it('缺 eps：skipped 返回不可补原因', () => {
    const r = autoFillSceneAsset({ name: '茶馆', meaning: '人物汇聚场所' });
    assert.ok(r.skipped.some((s) => s.field === 'eps' && s.reason.includes('置景')));
  });
});
