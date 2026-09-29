const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/engine/professional-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.16 职业行业装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(P.PRO_DEVICES.length, 10);
  const ids = new Set();
  P.PRO_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.16 detectPro 中英识别医疗/律政/消防/刑侦；甜宠不注入', () => {
  assert.ok(P.detectPro('急诊医生抢救手术'));
  assert.ok(P.detectPro('律师法庭公诉'));
  assert.ok(P.detectPro('a firefighter rescue and a forensic detective procedural'));
  assert.ok(!P.detectPro('都市甜宠恋爱'));
  assert.strictEqual(P.buildProDirective('校园青春', 'zh'), '');
});

test('v2.16 pickProDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = P.pickProDevices('倒计时高压时间窗里的师徒带教与团队协作', 3);
  const b = P.pickProDevices('倒计时高压时间窗里的师徒带教与团队协作', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'time_window'));
  assert.ok(a.some((d) => d.id === 'mentor_chain'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(P.pickProDevices('', 3).length, 3);
  const big = P.pickProDevices('医生', 20);
  assert.strictEqual(big.length, P.PRO_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.16 指令含“流程可考/不美化违规/程序正义/团队非孤胆”底线，英文零中文', () => {
  const zh = P.buildProDirective('医疗律政职业剧', 'zh');
  assert.ok(zh.includes('真实可考') && zh.includes('违规') && zh.includes('程序正义') && zh.includes('团队'));
  const en = P.buildProDirective('medical legal procedural', 'en');
  assert.ok(/verifiable/i.test(en) && /due process/i.test(en) && /teamwork/i.test(en) && !cjk(en));
});

test('v2.16 职业机制标签已入树且全局无重名', () => {
  ['标准流程专业感', '行话落地不堆砌', '职业伦理两难', '师徒传承带教', '高压时间窗', '专业失误与复盘', '多岗位协作链', '病例案情层层反转', '职业侵入私人生活', '专业硬本事爽点'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});
