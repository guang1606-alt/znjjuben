const test = require('node:test');
const assert = require('node:assert');
const { directTags } = require('../dist/engine/smart-tag-director.js');
const { findTagByName, validateCombo } = require('../dist/config/tag-taxonomy.js');
const { SEASONAL_CALENDAR } = require('../dist/engine/context-personalization.js');

// 结果合法性：无未知标签、无互斥、不超上限、必备维度可立项
function assertWellFormed(r, maxCap = 14) {
  assert.ok(Array.isArray(r.names) && r.names.length >= 3, '至少3个标签');
  assert.ok(r.names.length <= maxCap, `不超过上限 ${maxCap}，实际 ${r.names.length}`);
  assert.strictEqual(new Set(r.names).size, r.names.length, '无重复标签');
  r.names.forEach((n) => assert.ok(findTagByName(n), `标签真实存在：${n}`));
  const rep = validateCombo(r.names);
  assert.deepStrictEqual(rep.errors.filter((e) => e.includes('互斥')), [], '无互斥标签');
  assert.deepStrictEqual(rep.missingRequired, [], '必备维度齐全');
  r.injected.forEach((x) => assert.ok(r.names.includes(x.tag), 'injected 必须是最终组合子集'));
}

test('中文默认随机：组合合法、必备三维齐全、可重复、不超上限', () => {
  const r1 = directTags({ rng: () => 0.5, maxTags: 8 });
  assertWellFormed(r1, 8);
  assert.strictEqual(r1.locale, 'zh');
  const r2 = directTags({ rng: () => 0.5, maxTags: 8 });
  assert.deepStrictEqual(r1.names, r2.names, '同种子同随机结果确定');
});

test('maxTags 钳制到 3..14，不造成选择困难也不会空', () => {
  const big = directTags({ rng: () => 0.4, maxTags: 999 });
  assert.ok(big.names.length <= 14);
  const small = directTags({ rng: () => 0.4, maxTags: 0 });
  assert.ok(small.names.length >= 3);
});

test('高考季(06-07)自动注入校园时令标签并由小南解释——用户点名场景', () => {
  const r = directTags({ date: new Date('2026-06-07'), rng: () => 0.5 });
  assertWellFormed(r);
  const seasonal = r.injected.filter((x) => x.source === 'seasonal').map((x) => x.tag);
  assert.ok(seasonal.some((t) => ['校园青春', '高考陪考', '学霸逆袭'].includes(t)), `命中高考方向：${seasonal}`);
  assert.ok(r.xiaonanLines.some((l) => l.includes('高考') || l.includes('时令') || l.includes('校园')), '小南说明时令原因');
});

test('红果昨日爆款方向优先倾斜并标注来源', () => {
  const board = [{ title: '某爆款', platform: '红果短剧', tags: ['先婚后爱', '豪门婚恋'], heat: 95, date: new Date() }];
  const r = directTags({ board, rng: () => 0.5 });
  assertWellFormed(r);
  const trend = r.injected.filter((x) => x.source === 'trending').map((x) => x.tag);
  assert.ok(trend.includes('先婚后爱'), '爆款标签被注入');
});

test('用户画像(女性/历史偏好)迎合；关闭个性化则不注入 profile', () => {
  const profile = { gender: '女', pastTags: ['大女主', '女性觉醒'] };
  const on = directTags({ profile, rng: () => 0.5, personalized: true });
  assertWellFormed(on);
  assert.ok(on.injected.some((x) => x.source === 'profile'), '开启个性化时吸收偏好');
  const off = directTags({ profile, rng: () => 0.5, personalized: false });
  assert.ok(!off.injected.some((x) => x.source === 'profile'), '关闭个性化不注入画像');
});

test('受众维度向画像对齐：95后宝妈拿到女频+年轻白领，绝不给银发向；仅bio也成立', () => {
  // 仅靠 bio 推断（前端登录用户只传 bio 的场景）
  const profile = { bio: '95后宝妈，坐标辽宁沈阳，爱写家长里短' };
  // 对拍多个 rng，保证无论随机打底选到什么受众叶，最终都不出现与画像冲突的银发/男频
  for (let i = 0; i < 12; i++) {
    const r = directTags({ profile, rng: () => 0.1 + i * 0.07, maxTags: 8, personalized: true });
    assertWellFormed(r);
    assert.ok(!r.names.includes('银发50加'), '95后不应被推银发年龄段');
    assert.ok(!r.names.some((n) => ['玄幻男频', '都市男频', '军旅男频', '科幻男频'].includes(n)), '女性画像不应出现男频');
    assert.ok(r.names.some((n) => ['现言女频', '古言女频', '女性成长向', '宝妈向', '职场女性向', '银发女性向'].includes(n)), '应落到女频叶子');
    assert.ok(r.names.includes('年轻白领25_35'), '95后≈26岁应落年轻白领段');
  }
  // 60岁男性 → 银发段+男频
  const old = directTags({ profile: { gender: '男', age: 62 }, rng: () => 0.5, maxTags: 8 });
  assert.ok(old.names.includes('银发50加'));
  assert.ok(old.names.some((n) => ['玄幻男频', '都市男频', '军旅男频', '科幻男频'].includes(n)));
});

test('互斥 seed 只保留先选者，绝不产出互斥组合；未知 seed 被忽略不炸', () => {
  const r = directTags({ seed: ['HE圆满', 'BE虐心', '不存在的瞎编标签', '大女主'], rng: () => 0.3 });
  assertWellFormed(r);
  assert.ok(r.names.includes('HE圆满'));
  assert.ok(!r.names.includes('BE虐心'), '与先选 HE 互斥的 BE 被剔除');
  assert.ok(!r.names.includes('不存在的瞎编标签'));
});

test('英文模式：走海外标签体系、保证核心/关系/主角槽位、不套中国时令', () => {
  const r = directTags({ locale: 'en', date: new Date('2026-06-07'), rng: () => 0.5 });
  assert.strictEqual(r.locale, 'en');
  assert.ok(r.english && r.english.enNames.length >= 3, '产出英文标签');
  assert.strictEqual(r.report.ok, true, '海外组合自检通过');
  assert.ok(!r.injected.some((x) => x.source === 'seasonal'), '海外不强行套中国高考等节点');
  assert.ok(r.brief.raw.length > 0, '产出英文创作简报');
});

test('随机对拍 40 次：恒合法、injected 恒为子集、绝不抛错', () => {
  for (let i = 0; i < 40; i++) {
    const r = directTags({ rng: Math.random, maxTags: 6 + (i % 6) });
    assertWellFormed(r, 14);
  }
});

test('脏输入全面兜底：空对象/空数组/错误类型都安全返回合法组合', () => {
  assertWellFormed(directTags({}));
  assertWellFormed(directTags({ seed: null, board: 'wrong', profile: 1, dims: ['bogusDim'] }));
});

test('防回归：全年时令方向词必须都能落到真实标签（否则时令注入会落空）', () => {
  const miss = [];
  SEASONAL_CALENDAR.forEach((x) => x.directions.forEach((w) => { if (!findTagByName(w)) miss.push(`${x.id}:${w}`); }));
  assert.deepStrictEqual(miss, [], '不存在悬空时令词');
});

test('v1.96 英文选片：可产出穿书转生/喜剧/戏中戏新方向，且不报未知标签、恒有英文展示名', () => {
  const union = new Set(); let anyUnknown = false;
  for (let i = 0; i < 120; i++) {
    let s = i + 1; const lcg = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const r = directTags({ locale: 'en', maxTags: 10, rng: lcg });
    assert.strictEqual(r.locale, 'en');
    assert.ok(r.english && Array.isArray(r.english.enNames) && r.english.enNames.length >= 3, '恒有英文展示名');
    r.english.enNames.forEach((n) => union.add(n));
    if (r.report.errors.some((e) => e.includes('未知标签'))) anyUnknown = true;
  }
  assert.strictEqual(anyUnknown, false, '英文组合不得报未知标签');
  const hit = (re) => [...union].some((n) => re.test(n));
  assert.ok(hit(/Isekai|Villainess|Transmigrat|Quick Transmigration/i), '英文可随机到穿书/转生方向');
  assert.ok(hit(/Comedy|Sitcom|Cringe|Slapstick/i), '英文可随机到喜剧深挖方向');
  assert.ok(hit(/Metafiction|Show-Within|Mockumentary|Branch/i), '英文可随机到戏中戏/元叙事方向');
});

test('v2.62 时令注入×受众对齐后 injected 恒为最终组合子集（中秋+宝妈画像多rng）', () => {
  for (let i = 0; i < 12; i++) {
    const r = directTags({
      date: new Date('2026-09-15'),
      profile: { bio: '95后宝妈，坐标辽宁沈阳，爱写家长里短' },
      rng: () => 0.1 + i * 0.07, maxTags: 8, personalized: true,
    });
    assert.ok(r.names.length <= 8);
    r.injected.forEach((x) => assert.ok(r.names.includes(x.tag), `injected 残留：${x.tag}`));
  }
});
