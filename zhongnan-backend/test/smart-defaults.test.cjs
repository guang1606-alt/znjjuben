const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildSmartDefaults } = require('../dist/lib/smart-defaults.js');

const CJK = /[一-鿿]/;
const fixedDate = new Date('2026-06-05T08:00:00+08:00'); // 高考季窗口附近

describe('v2.70 立项智能默认引擎（纯确定性）', () => {
  it('空榜单：诚实不伪造爆款，boardActive=false，仍给时令/画像与钩子默认', () => {
    const d = buildSmartDefaults({ tags: ['逆袭'], mode: 'tag', date: fixedDate, board: [], lang: 'zh' });
    assert.strictEqual(d.boardActive, false);
    assert.strictEqual(d.sourceCounts.trending, 0);
    assert.ok(d.hookStrategy.id);
    assert.strictEqual(d.hookStrategy.options.length, 5);
    assert.ok(d.linesZh.some((l) => l.includes('不会编造爆款')));
  });

  it('有保鲜期真实榜单：trending 方向被计入且 boardActive=true', () => {
    const board = [{ title: '保洁逆袭爆了', platform: '红果短剧', tags: ['逆袭', '复仇'], heat: 90, date: fixedDate, region: 'domestic' }];
    const d = buildSmartDefaults({ tags: ['逆袭'], date: fixedDate, board, lang: 'zh' });
    assert.strictEqual(d.boardActive, true);
    assert.ok(d.sourceCounts.trending >= 1);
    assert.ok(d.directions.some((x) => x.source === 'trending'));
  });

  it('英文播报平台层零中文（标签名不嵌入 linesEn）', () => {
    const d = buildSmartDefaults({ tags: ['逆袭'], date: fixedDate, board: [], lang: 'en' });
    assert.strictEqual(d.lang, 'en');
    d.linesEn.forEach((l) => assert.ok(!CJK.test(l), `英文播报不得含中文: ${l}`));
    assert.ok(!CJK.test(d.hookStrategy.nameEn));
    assert.ok(!CJK.test(d.hookStrategy.reasonEn));
    assert.ok(d.hookStrategy.options.every((o) => !CJK.test(o.nameEn)));
  });

  it('关闭个性化：不计画像偏好方向', () => {
    const d = buildSmartDefaults({ date: fixedDate, board: [], personalized: false, profile: { bio: '东北人', pastTags: ['逆袭'] } });
    assert.strictEqual(d.sourceCounts.profile, 0);
    assert.strictEqual(d.personalized, false);
  });

  it('确定性：同输入同输出', () => {
    const a = buildSmartDefaults({ tags: ['复仇'], date: fixedDate, board: [] });
    const b = buildSmartDefaults({ tags: ['复仇'], date: fixedDate, board: [] });
    assert.deepStrictEqual(a, b);
  });
});
