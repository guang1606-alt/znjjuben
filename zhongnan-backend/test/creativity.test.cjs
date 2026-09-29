const test = require('node:test');
const assert = require('node:assert');
const c = require('../dist/engine/creativity.js');

test('反套路：老套桥段被识别，创新稿通过', () => {
  const cliche = c.clicheScan('她失忆了，霸道总裁逼她做替嫁新娘，还要假装怀孕带球跑', 'balanced');
  assert.ok(cliche.hits.length >= 3, '命中失忆/霸总/替嫁等老套');
  assert.strictEqual(cliche.pass, false);
  assert.ok(cliche.noveltyScore < 60);
  const fresh = c.clicheScan('社区调解员老陈发现，整栋楼的纠纷都指向同一笔二十年前的公积金', 'balanced');
  assert.strictEqual(fresh.pass, true);
});

test('反套路强度档位：经典宽松、创新严苛', () => {
  const text = '霸道总裁爱上我'; // 命中1条
  assert.strictEqual(c.clicheScan(text, 'classic').pass, true, '经典档允许');
  assert.strictEqual(c.clicheScan(text, 'balanced').pass, true, '均衡档1条可过');
  assert.strictEqual(c.clicheScan(text, 'innovative').pass, false, '创新档零容忍');
});

test('真人编剧风格库三维度齐全且可生成指令', () => {
  assert.ok(c.STYLE_LIB.filter((s) => s.dim === '题材').length >= 5);
  assert.ok(c.STYLE_LIB.filter((s) => s.dim === '受众').length >= 4);
  assert.ok(c.STYLE_LIB.filter((s) => s.dim === '地域').length >= 3);
  const d = c.buildStyleDirective('kuai_shuang');
  assert.ok(d.includes('节奏') && d.includes('爽点'));
  assert.strictEqual(c.buildStyleDirective('not_exist'), '');
});

test('多版本强制差异化：换汤不换药被抓出', () => {
  const samey = c.diversityCheck([
    { logline: '保洁工被羞辱后亮出大股东身份反杀' },
    { logline: '保洁员被羞辱后亮出大老板身份反杀' }, // 只换同义词的伪多版本
  ]);
  assert.strictEqual(samey.diverse, false, '换汤不换药的伪多版本判雷同');
  assert.ok(samey.maxSim > 0.55);
  const diff = c.diversityCheck([
    { logline: '保洁工被羞辱后亮出大股东身份反杀' },
    { logline: '退休教师用一封旧信化解邻里二十年积怨' },
  ]);
  assert.strictEqual(diff.diverse, true, '差异足够判通过');
});

test('v1.99 12种编剧风格英文层全部零中文，默认中文不变', () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const ids = ['kuai_shuang', 'urban_emo', 'ancient_plot', 'suspense', 'hk_style', 'mass_down', 'female', 'male', 'premium', 'dongbei', 'nanfang', 'white_collar'];
  for (const id of ids) {
    const en = c.buildStyleDirective(id, 'en');
    assert.ok(en && !cjk(en), `${id} 英文风格零中文`);
    assert.strictEqual(c.buildStyleDirective(id), c.buildStyleDirective(id, 'zh'), `${id} 默认中文不变`);
  }
  assert.strictEqual(c.buildStyleDirective(undefined, 'en'), '', '无风格仍返回空');
});
