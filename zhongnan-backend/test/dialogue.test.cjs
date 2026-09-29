const test = require('node:test');
const assert = require('node:assert');
const d = require('../dist/engine/dialogue.js');

test('书面腔/AI腔被识别并给改法', () => {
  const written = '然而他并未退缩，因此我们必须相信，那一刻空气仿佛凝固，他缓缓开口：人生就是如此。';
  const r = d.dialogueScan(written, 'high');
  assert.ok(r.hits.length >= 4, '命中然而/因此/那一刻/仿佛/缓缓/人生就是');
  assert.strictEqual(r.pass, false, '高度口语档不允许这么多书面腔');
  assert.ok(r.hits.every((h) => h.fix), '每个问题都给口语改法');
});

test('真人口语通过', () => {
  const human = '林晚头也没抬：“行吧，你是老板你说了算。”陈总愣了一下：“你啥意思？”“没啥意思，地还没擦完呢。”';
  const r = d.dialogueScan(human, 'high');
  assert.strictEqual(r.pass, true);
  assert.ok(r.colloquialScore >= 90);
});

test('口语化程度档：古装规整宽松、现实严苛', () => {
  const text = '然而此事尚有转机，因此本宫认为，不妨从长计议。'; // 2个书面词
  assert.strictEqual(d.dialogueScan(text, 'low').pass, true, '古装权谋允许相对规整');
  assert.strictEqual(d.dialogueScan(text, 'high').pass, false, '现实题材必须口语');
});

test('角色口吻指令按身份/地域/性格拼装', () => {
  const v = d.buildVoiceDirective({ name: '老马', identity: '老板', region: '东北', trait: '急躁' });
  assert.ok(v.includes('老马') && v.includes('结果') && v.includes('东北') && v.includes('语速快'));
  assert.ok(v.includes('念出口'));
});

test('风格推断口语程度', () => {
  assert.strictEqual(d.levelFromStyle('ancient_plot'), 'low');
  assert.strictEqual(d.levelFromStyle('kuai_shuang'), 'high');
  assert.strictEqual(d.levelFromStyle(undefined), 'mid');
});

test('v1.99 角色口吻指令英文层零中文，默认中文不变', () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const en = d.buildVoiceDirective({ name: 'Lin Wan', age: '28', identity: '老板', region: '东北', trait: '急躁', voice: 'calm, short' }, 'en');
  assert.ok(!cjk(en), '英文口吻指令零中文');
  assert.ok(en.includes('[Voice for Lin Wan]') && en.includes('speakable'));
  const zh = d.buildVoiceDirective({ name: '老马', identity: '老板', region: '东北', trait: '急躁' });
  assert.strictEqual(d.buildVoiceDirective({ name: '老马', identity: '老板', region: '东北', trait: '急躁' }, 'zh'), zh, '默认中文逐字不变');
  assert.ok(zh.includes('念出口'));
});

test('v2.91 新增身份口吻命中：医生/护士/律师/警察/外卖员/服务员/程序员/设计师/销售/教师/农民工/退休干部', () => {
  const cases = [
    { id: '医生', zh: '问诊式', en: 'diagnostic' },
    { id: '护士', zh: '边忙边说', en: 'busy' },
    { id: '律师', zh: '原则上', en: 'in principle' },
    { id: '警察', zh: '你叫什么', en: 'your name' },
    { id: '外卖员', zh: '不好意思', en: 'sorry' },
    { id: '服务员', zh: '这边请', en: 'this way' },
    { id: '程序员', zh: '理论上', en: 'in theory' },
    { id: '设计师', zh: '质感', en: 'texture' },
    { id: '销售', zh: '您觉得呢', en: 'what do you think' },
    { id: '教师', zh: '你要知道', en: 'you should know' },
    { id: '农民工', zh: '俺', en: 'I / us' },
    { id: '退休干部', zh: '当年', en: 'back in the day' },
  ];
  const cjk = (s) => /[一-鿿]/.test(String(s));
  for (const c of cases) {
    const zh = d.buildVoiceDirective({ name: '小张', identity: c.id });
    assert.ok(zh.includes(c.zh), `中文身份「${c.id}」应包含「${c.zh}」`);
    const en = d.buildVoiceDirective({ name: 'Zhang', identity: c.id }, 'en');
    assert.ok(!cjk(en), `英文身份「${c.id}」零中文`);
    assert.ok(en.toLowerCase().includes(c.en.toLowerCase()), `英文身份「${c.id}」应包含「${c.en}」`);
  }
});

test('v2.91 新增性格口吻命中：傲娇/腹黑/中二/社恐/社牛/闷骚/毒舌/傻白甜/暴躁', () => {
  const cases = [
    { id: '傲娇', zh: '嘴硬心软', en: 'Hard mouth' },
    { id: '腹黑', zh: '一句藏坑', en: 'trap' },
    { id: '中二', zh: '宿命', en: 'destiny' },
    { id: '社恐', zh: '嗯、那个', en: 'um' },
    { id: '社牛', zh: '哥姐', en: 'brother' },
    { id: '闷骚', zh: '关键时候冒一句', en: 'key moment' },
    { id: '毒舌', zh: '一句戳人', en: 'irony' },
    { id: '傻白甜', zh: '真的吗', en: 'really' },
    { id: '暴躁', zh: '拍桌', en: 'Slams' },
  ];
  const cjk = (s) => /[一-鿿]/.test(String(s));
  for (const c of cases) {
    const zh = d.buildVoiceDirective({ name: '小李', trait: c.id });
    assert.ok(zh.includes(c.zh), `中文性格「${c.id}」应包含「${c.zh}」`);
    const en = d.buildVoiceDirective({ name: 'Li', trait: c.id }, 'en');
    assert.ok(!cjk(en), `英文性格「${c.id}」零中文`);
    assert.ok(en.toLowerCase().includes(c.en.toLowerCase()), `英文性格「${c.id}」应包含「${c.en}」`);
  }
});

test('v2.91 新增地域口吻命中：西北/江浙沪/闽南/港台/北方都市', () => {
  const cases = [
    { id: '西北', zh: '咧', en: 'drawls' },
    { id: '江浙沪', zh: '伐', en: 'calculating' },
    { id: '闽南', zh: '啦、吼', en: 'rising tones' },
    { id: '港台', zh: '有冇', en: 'Code-switching' },
    { id: '北方都市', zh: '您', en: 'honorifics' },
  ];
  const cjk = (s) => /[一-鿿]/.test(String(s));
  for (const c of cases) {
    const zh = d.buildVoiceDirective({ name: '老王', region: c.id });
    assert.ok(zh.includes(c.zh), `中文地域「${c.id}」应包含「${c.zh}」`);
    const en = d.buildVoiceDirective({ name: 'Wang', region: c.id }, 'en');
    assert.ok(!cjk(en), `英文地域「${c.id}」零中文`);
    assert.ok(en.toLowerCase().includes(c.en.toLowerCase()), `英文地域「${c.id}」应包含「${c.en}」`);
  }
});

test('v2.91 新增 AI 套话标记识别：眼眸/眸子/一抹笑意/淡淡地说/幽幽地/冷冷一笑/心中暗想/暗自思忖/蓦地/霎时/瞬间/一瞬/内心深处/心潮澎湃/心绪复杂/思绪万千/显而易见', () => {
  const text = '他的眼眸深邃，眸子里闪过一抹笑意，淡淡地说："你来了。"她冷冷一笑，心中暗想：这人果然不简单。他暗自思忖，蓦地转身，霎时空气凝固，瞬间陷入死寂，一瞬之后，内心深处翻起心潮澎湃，心绪复杂，思绪万千，显而易见，他动了杀机。';
  const r = d.dialogueScan(text, 'high');
  // 应至少抓到 12 个新增标记
  const newHits = r.hits.filter((h) => ['眼眸','眸子','一抹笑意','淡淡地说','幽幽地','冷冷一笑','心中暗想','暗自思忖','蓦地','霎时','瞬间','一瞬','内心深处','心潮澎湃','心绪复杂','思绪万千','显而易见'].includes(h.word));
  assert.ok(newHits.length >= 12, `应至少抓到 12 个新增 AI 套话，实际 ${newHits.length}`);
  assert.strictEqual(r.pass, false, '高度口语档必须不通过');
  assert.ok(r.colloquialScore < 50, `口语分应低于 50，实际 ${r.colloquialScore}`);
});
