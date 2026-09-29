const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/craft-registry.js');
const F = require('../dist/engine/script-format.js');
const SL = require('../dist/engine/style-library.js');
const X = require('../dist/engine/xuanhuan-craft.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.26 注册表：21 套类型引擎全部登记、id 唯一、顺序稳定', () => {
  assert.strictEqual(R.craftEngineCount(), 21);
  const ids = R.CRAFT_ENGINES.map((e) => e.id);
  assert.deepStrictEqual(ids, ['comedy', 'mystery', 'tourism', 'transmigrate', 'romance', 'underdog', 'ruleloop', 'court', 'family', 'professional', 'xuanhuan', 'spy', 'apocalypse', 'military', 'esports', 'meta', 'investigation', 'tender', 'rural', 'sisterhood', 'nation']);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('v2.18 注册表：多类型叠加命中、空输入不命中、与直连引擎逐字一致', () => {
  const stack = R.detectCraftStack('女主穿书进修仙宗门，还带甜宠和喜剧包袱');
  assert.ok(stack.includes('xuanhuan') && stack.includes('transmigrate') && stack.includes('romance') && stack.includes('comedy'));
  assert.deepStrictEqual(R.detectCraftStack('一段普通日常买菜'), []);
  const reg = R.buildCraftStackDirective('男频玄幻修仙升级流筑基金丹', 'zh');
  assert.ok(reg.ids.includes('xuanhuan'));
  assert.ok(reg.directive.includes(X.buildXuanDirective('男频玄幻修仙升级流筑基金丹', 'zh')));
});

test('v2.18 注册表：英文组合指令零中文，任何窗口只调这一个入口即可拿全技能', () => {
  const en = R.buildCraftStackDirective('a xianxia cultivation transmigration romcom mystery', 'en');
  assert.ok(en.ids.length >= 3);
  assert.ok(!cjk(en.directive));
});

test('v2.18 双制式指令：真人实拍 800-1000 留导演空间，AIGC 1200-1500 补视听，英文零中文', () => {
  const live = F.scriptFormatDirective('LIVE', 'zh');
  const aigc = F.scriptFormatDirective('AIGC', 'zh');
  assert.ok(live.includes('800-1000') && live.includes('导演'));
  assert.ok(aigc.includes('1200-1500') && aigc.includes('流畅') && aigc.includes('提示词手册'));
  assert.ok(!live.includes('1200-1500'));
  const liveEn = F.scriptFormatDirective('LIVE', 'en');
  const aigcEn = F.scriptFormatDirective('AIGC', 'en');
  assert.ok(/800-1000/.test(liveEn) && /1200-1500/.test(aigcEn) && !cjk(liveEn) && !cjk(aigcEn));
});

test('v2.18 真人编剧风格库可被窗口调用：风格提示映射 + 成品风格一致性扫描', () => {
  assert.strictEqual(SL.resolveStyleByHint('都市甜宠恋爱').themeId, 'urban');
  assert.strictEqual(SL.resolveStyleByHint('修仙升级流').themeId, 'shuangwen');
  assert.strictEqual(SL.resolveStyleByHint('毫无风格线索的文本'), null);
  const p = SL.resolveStyleByHint('古装权谋');
  const scan = SL.styleConsistencyScan('王爷：此计yyds，简直绝绝子。', p);
  assert.ok(scan.issues.some((i) => i.type === 'anachronism'));
});
