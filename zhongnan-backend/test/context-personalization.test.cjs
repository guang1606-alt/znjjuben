const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/context-personalization.js');

test('时令日历：6月7日命中高考、12月31日命中跨年（含跨年窗口）', () => {
  const gaokao = C.seasonalSignals(new Date(2026, 5, 7)).map((s) => s.id);
  assert.ok(gaokao.includes('gaokao'));
  const ny = C.seasonalSignals(new Date(2026, 11, 31)).map((s) => s.id);
  assert.ok(ny.includes('newyear'));
  // 非节点日可不命中，但不报错
  assert.ok(Array.isArray(C.seasonalSignals(new Date(2026, 6, 20))));
});

test('爆款倾斜：时间衰减，越新的爆款方向分越高', () => {
  const now = new Date('2026-08-29T12:00:00Z');
  const board = [
    { title: 'A剧', platform: '红果', tags: ['重生复仇'], heat: 100, date: now },
    { title: 'B剧', platform: '红果', tags: ['旧题材'], heat: 100, date: new Date(now.getTime() - 30 * 86400000) },
  ];
  const top = C.trendingSignals(board, now, 5);
  assert.strictEqual(top[0].tag, '重生复仇');
  assert.ok(top[0].score > top[1].score);
});

test('用户画像：地域/历史偏好/受众学习', () => {
  const s = C.profileSignals({ region: '辽宁沈阳', gender: '女', age: 22, pastTags: ['大女主', '大女主', '都市情感'] });
  assert.strictEqual(s.regionCard.name, '东北');
  assert.strictEqual(s.preferredTags[0], '大女主');
  assert.ok(s.audience.includes('女性向'));
  assert.ok(s.audience.includes('Z世代'));
  assert.ok(s.reasons.join('').includes('东北'));
  // 空画像安全
  assert.doesNotThrow(() => C.profileSignals({}));
});

test('画像补抽：仅给 bio 也能识别地域/性别/年龄段，显式字段优先', () => {
  // 95后宝妈 + 东北：性别女、年龄约26（非Z世代）、地域东北
  const s1 = C.profileSignals({ bio: '95后宝妈，坐标辽宁沈阳，爱写家长里短' });
  assert.strictEqual(s1.regionCard.name, '东北');
  assert.ok(s1.audience.includes('女性向'));
  assert.ok(!s1.audience.includes('Z世代')); // 95后≈26岁，不划入Z世代
  // NN岁 + 男性词
  const d2 = C.inferDemographic({ bio: '32岁程序员大叔，北漂' });
  assert.strictEqual(d2.gender, '男');
  assert.strictEqual(d2.age, 32);
  // 00后女生 → Z世代女性向
  const s3 = C.profileSignals({ bio: '00后女生，学生党' });
  assert.ok(s3.audience.includes('女性向'));
  assert.ok(s3.audience.includes('Z世代'));
  // 显式字段优先于 bio 推断
  const d4 = C.inferDemographic({ gender: '男', age: 40, bio: '宝妈' });
  assert.strictEqual(d4.gender, '男');
  assert.strictEqual(d4.age, 40);
  // 无任何线索不乱贴标签
  assert.deepStrictEqual(C.inferDemographic({ bio: '热爱生活' }), {});
});

test('三路融合：产出方向+小南透明解释；关闭个性化则不采用画像', () => {
  const now = new Date(2026, 5, 7);
  const r = C.composePersonalization({
    date: now,
    board: [{ title: 'X', platform: '红果', tags: ['重生复仇'], heat: 100, date: now }],
    profile: { region: '成都', pastTags: ['大女主'] },
  });
  assert.ok(r.directions.length >= 1);
  assert.ok(r.xiaonanLines.some((l) => l.includes('重生复仇')));
  assert.ok(r.xiaonanLines.some((l) => l.includes('高考')));
  assert.ok(r.xiaonanLines.some((l) => l.includes('川渝')));
  const off = C.composePersonalization({ date: now, profile: { pastTags: ['大女主'] }, personalized: false });
  assert.ok(!off.directions.some((d) => d.tag === '大女主'));
  assert.ok(off.xiaonanLines.some((l) => l.includes('关闭个性化')));
});

test('多平台榜单：覆盖国内外清单，region过滤只取对应地区', () => {
  assert.ok(C.PLATFORM_BOARDS.some((b) => b.name === '红果短剧'));
  assert.ok(C.PLATFORM_BOARDS.some((b) => b.name === 'ReelShort'));
  const now = new Date('2026-08-29T00:00:00Z');
  const board = [
    { title: '国剧', platform: '红果', tags: ['国内题材'], heat: 100, date: now, region: 'domestic' },
    { title: '美剧', platform: 'ReelShort', tags: ['Werewolf'], heat: 100, date: now, region: 'overseas' },
  ];
  const overseas = C.trendingSignals(board, now, 5, 'overseas');
  assert.deepStrictEqual(overseas.map((t) => t.tag), ['Werewolf']);
  const all = C.trendingSignals(board, now, 5, 'all');
  assert.strictEqual(all.length, 2);
});
