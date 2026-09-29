const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/ruleloop-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.12 规则怪谈装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(R.RULELOOP_DEVICES.length, 10);
  const ids = new Set();
  R.RULELOOP_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.12 detectRuleLoop 中英识别；普通悬疑/甜宠不注入', () => {
  assert.ok(R.detectRuleLoop('无限流规则怪谈副本闯关'));
  assert.ok(R.detectRuleLoop('a rule horror death game instance with time loop reset'));
  assert.ok(!R.detectRuleLoop('刑侦破案社会派悬疑'));
  assert.strictEqual(R.buildRuleLoopDirective('都市甜宠恋爱', 'zh'), '');
});

test('v2.12 pickRuleLoopDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = R.pickRuleLoopDevices('副本通关、回档循环、boss 也要守世界法则', 3);
  const b = R.pickRuleLoopDevices('副本通关、回档循环、boss 也要守世界法则', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'loop_reset'));
  assert.ok(a.some((d) => d.id === 'world_rule'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(R.pickRuleLoopDevices('', 3).length, 3);
  const big = R.pickRuleLoopDevices('副本', 20);
  assert.strictEqual(big.length, R.RULELOOP_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.12 指令含“线索公平/规则不临时改/死亡有代价/不靠血腥”底线，英文零中文', () => {
  const zh = R.buildRuleLoopDirective('无限流规则怪谈副本', 'zh');
  assert.ok(zh.includes('提前埋下') && zh.includes('一视同仁') && zh.includes('血腥'));
  const en = R.buildRuleLoopDirective('infinite-flow rule horror death game instance', 'en');
  assert.ok(/planted early/i.test(en) && /binds everyone/i.test(en) && !cjk(en));
});

test('v2.12 规则怪谈机制标签已入树且全局无重名', () => {
  ['规则字面陷阱', '隐藏规则试错', '破局线索公平', '违规代价梯度', '副本单元闭环', '副本难度阶梯', '规则下人心博弈', '循环回档规则化', '副本主线碎片牵引'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});
