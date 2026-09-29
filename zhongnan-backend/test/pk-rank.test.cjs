const { describe, it } = require('node:test');
const assert = require('node:assert');
const { tierOf, seasonIdOf, summarizeUser, buildRankBoard, nextTierProgress } = require('../dist/lib/pk-rank.js');

const battle = (userId, totalA, winner) => ({ userId, result: { structured: { totalA, winner } } });

describe('PK 战力榜与赛季段位（v2.68，纯确定性）', () => {
  it('段位阈值：青铜→王者随战力递增', () => {
    assert.strictEqual(tierOf(0).key, 'BRONZE');
    assert.strictEqual(tierOf(55).key, 'SILVER');
    assert.strictEqual(tierOf(65).key, 'GOLD');
    assert.strictEqual(tierOf(72).key, 'PLATINUM');
    assert.strictEqual(tierOf(82).key, 'DIAMOND');
    assert.strictEqual(tierOf(95).key, 'KING');
  });

  it('赛季ID按月稳定：同锚点同月相同', () => {
    const d1 = new Date(2026, 8, 1); const d2 = new Date(2026, 8, 28);
    assert.strictEqual(seasonIdOf(d1), 'S2026-09');
    assert.strictEqual(seasonIdOf(d1), seasonIdOf(d2));
    assert.notStrictEqual(seasonIdOf(d1), seasonIdOf(new Date(2026, 9, 1)));
  });

  it('summarizeUser：无有效记录返回 null；战力=0.7均+0.3最高+胜率加成', () => {
    assert.strictEqual(summarizeUser('u', []), null);
    assert.strictEqual(summarizeUser('u', [{ userId: 'u', result: {} }]), null);
    const s = summarizeUser('u', [battle('u', 60, 'A'), battle('u', 80, 'A')]);
    // 均70 最高80 → base=0.7*70+0.3*80=73，胜率100% +10 = 83
    assert.strictEqual(s.power, 83);
    assert.strictEqual(s.wins, 2);
    assert.strictEqual(s.battles, 2);
    assert.strictEqual(s.winRate, 1);
  });

  it('buildRankBoard：按战力降序排名、笔名优先、当前用户 mine 带 rank', () => {
    const battles = [
      battle('weak', 50, 'B'), battle('weak', 55, 'A'),
      battle('strong', 90, 'A'), battle('strong', 95, 'A'), battle('strong', 88, 'A'),
      battle('mid', 70, 'A'),
    ];
    const board = buildRankBoard(battles, 'mid', {
      strong: { penName: '墨白' }, mid: { nickname: '阿中' }, weak: {},
    }, 20, new Date(2026, 8, 10));
    assert.strictEqual(board.seasonId, 'S2026-09');
    assert.strictEqual(board.totalPlayers, 3);
    assert.strictEqual(board.top[0].userId, 'strong');
    assert.strictEqual(board.top[0].displayName, '墨白');
    assert.strictEqual(board.top[0].rank, 1);
    assert.strictEqual(board.mine.userId, 'mid');
    assert.strictEqual(board.mine.displayName, '阿中');
    assert.strictEqual(board.mine.rank, 2); // strong > mid > weak
    // 英文层零中文
    board.top.forEach((e) => assert.ok(!/[一-鿿]/.test(e.tierEn)));
  });

  it('buildRankBoard：当前用户无记录 mine=null；可复现', () => {
    const b1 = buildRankBoard([battle('a', 70, 'A')], 'nobody', {}, 20);
    const b2 = buildRankBoard([battle('a', 70, 'A')], 'nobody', {}, 20);
    assert.strictEqual(b1.mine, null);
    assert.strictEqual(JSON.stringify(b1.top), JSON.stringify(b2.top));
  });

  it('nextTierProgress：王者无下一阶；其余给出进度与差距', () => {
    const king = nextTierProgress(95);
    assert.strictEqual(king.nextTierEn, null);
    assert.strictEqual(king.progress, 1);
    const gold = nextTierProgress(66); // 黄金[62,70)，下一阶铂金70
    assert.strictEqual(gold.nextTierEn, 'Platinum');
    assert.ok(gold.progress > 0 && gold.progress < 1);
    assert.ok(gold.gap > 0);
  });
});
