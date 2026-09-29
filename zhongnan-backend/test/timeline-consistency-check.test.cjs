'use strict';
// v2.138 时间线一致性检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { timelineConsistencyCheck } = require('../dist/engine/timeline-consistency-check.js');

// —— 中文健康：标题带昼夜，倒计时 3→（次日）→2，只减不增 ——
const ZH_HEALTHY = `场景一 客厅 日
林晚：距离婚礼只剩三天，必须找到他。
赵天成：我去查航班记录。
场景二 走廊 夜
林晚：你查到了什么。
赵天成：他根本没上飞机。
次日。
场景三 书房 日
林晚：只剩两天了，婚礼不能取消。
赵天成：我已经有办法了。`;

// —— 倒计时反转 1 处：三天→（次日）→五天，mid ——
const ZH_REVERSAL_ONE = `场景一 客厅 日
林晚：距离婚礼只剩三天。
赵天成：来得及。
次日。
场景二 书房 日
林晚：我们还有五天，不用慌了。
赵天成：你怎么算的。`;

// —— 倒计时反转 2 处：high ——
const ZH_REVERSAL_TWO = `场景一 客厅 日
林晚：婚礼只剩三天。
次日。
场景二 书房 日
林晚：婚礼还有五天。
赵天成：荒唐。
次日。
场景三 走廊 日
林晚：慢慢办，婚礼还剩六天呢。`;

// —— 标题夜 + 正文正午阳光：昼夜矛盾 mid ——
const ZH_NIGHT_DAY = `场景一 别墅客厅 夜
林晚：你到底想干什么。
赵天成：正午的阳光刺眼，他却拉上了所有窗帘。
林晚：别转移话题。`;

// —— 标题日 + 正文凌晨月亮：反方向昼夜矛盾 ——
const ZH_DAY_NIGHT = `场景一 书房 日
林晚：这份合同你签不签。
赵天成：窗外是凌晨三点的月亮，整栋楼只有这间屋子亮着灯。
林晚：我等你的答复。`;

// —— 整行"N天后/次日"偷懒转场 4 处：low ——
const ZH_SKIPS = `场景一 天台 日
林晚：你给我等着。
三天后。
场景二 天台 日
赵天成：他来了。
一周后。
场景三 天台 日
林晚：又是你。
次日。
场景四 天台 日
赵天成：真巧。
两天后。
场景五 天台 日
林晚：结束吧。`;

// —— 同场"刚认识"与"结婚三年"：时长压扁 mid ——
const ZH_SQUASH = `场景一 客厅 日
林晚：我们昨天才认识，你别这样。
赵天成：胡说，我们结婚都三年了。
林晚：你疯了吧。`;

// —— FRESH 与 LONG 分居两场：不判压扁 ——
const ZH_SQUASH_SAFE = `场景一 客厅 日
林晚：我们昨天才认识。
赵天成：先别急。
场景二 餐厅 夜
林晚：后来我们在一起很多年。
赵天成：那是后话。`;

// —— 英文健康：3 days → next day → 2 days ——
const EN_HEALTHY = `Scene 1. Living Room - Day
Anna: Only three days left until the wedding.
Victor: I'll check the flights.
The next day.
Scene 2. Study - Night
Anna: We have two days left, the wedding stays on.
Victor: I have a plan.`;

// —— 英文倒计时反转 ——
const EN_REVERSAL = `Scene 1. Study - Day
Anna: Only three days left until the trial.
Victor: Fine.
Two days later.
Scene 2. Office - Day
Anna: Just five days left, plenty of time.
Victor: Impossible.`;

// —— 英文昼夜矛盾：NIGHT 标题 + bright morning sunlight ——
const EN_MISMATCH = `Scene 1. INT. STUDY - NIGHT
Anna: Sign the contract.
Victor: Bright morning sunlight flooded the room as he spoke.
Anna: Answer me.`;

test('ZH 健康：倒计时递减、昼夜一致、零 issue，昼夜标注回补', () => {
  const r = timelineConsistencyCheck(ZH_HEALTHY, 'zh');
  assert.strictEqual(r.sceneCount, 3);
  assert.strictEqual(r.deadlineCount, 2);
  assert.strictEqual(r.reversalCount, 0);
  assert.strictEqual(r.mismatchCount, 0);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.anchoredSceneCount, 3);
  assert.strictEqual(r.scenes[0].phase, 'day');
  assert.strictEqual(r.scenes[1].phase, 'night');
});

test('ZH 倒计时反转 1 处：countdown_reversal mid', () => {
  const r = timelineConsistencyCheck(ZH_REVERSAL_ONE, 'zh');
  assert.strictEqual(r.reversalCount, 1);
  const issue = r.issues.find((i) => i.type === 'countdown_reversal');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
  assert.ok(r.score < 100);
});

test('ZH 倒计时反转 2 处：high 闸门', () => {
  const r = timelineConsistencyCheck(ZH_REVERSAL_TWO, 'zh');
  assert.strictEqual(r.reversalCount, 2);
  const issue = r.issues.find((i) => i.type === 'countdown_reversal');
  assert.strictEqual(issue.severity, 'high');
});

test('ZH 标题夜正文昼：day_night_mismatch mid', () => {
  const r = timelineConsistencyCheck(ZH_NIGHT_DAY, 'zh');
  assert.strictEqual(r.mismatchCount, 1);
  assert.strictEqual(r.scenes[0].phase, 'night');
  const issue = r.issues.find((i) => i.type === 'day_night_mismatch');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 标题昼正文夜：反向也判矛盾', () => {
  const r = timelineConsistencyCheck(ZH_DAY_NIGHT, 'zh');
  assert.strictEqual(r.mismatchCount, 1);
  assert.strictEqual(r.scenes[0].phase, 'day');
  assert.ok(r.issues.some((i) => i.type === 'day_night_mismatch'));
});

test('ZH 独立转场行 4 处：time_skip_stuffing low', () => {
  const r = timelineConsistencyCheck(ZH_SKIPS, 'zh');
  assert.ok(r.standaloneSkipCount >= 4);
  const issue = r.issues.find((i) => i.type === 'time_skip_stuffing');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'low');
});

test('ZH 同场时长压扁：timeline_squash mid', () => {
  const r = timelineConsistencyCheck(ZH_SQUASH, 'zh');
  assert.strictEqual(r.squashCount, 1);
  const issue = r.issues.find((i) => i.type === 'timeline_squash');
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 跨场的刚认识/多年不判压扁', () => {
  const r = timelineConsistencyCheck(ZH_SQUASH_SAFE, 'zh');
  assert.strictEqual(r.squashCount, 0);
  assert.strictEqual(r.issues.filter((i) => i.type === 'timeline_squash').length, 0);
});

test('EN 健康：倒计时递减零 issue', () => {
  const r = timelineConsistencyCheck(EN_HEALTHY, 'en');
  assert.strictEqual(r.reversalCount, 0);
  assert.strictEqual(r.mismatchCount, 0);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.scenes[1].phase, 'night');
});

test('EN 倒计时反转：countdown_reversal（2 天已过却变 5 天）', () => {
  const r = timelineConsistencyCheck(EN_REVERSAL, 'en');
  assert.strictEqual(r.reversalCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'countdown_reversal'));
});

test('EN 昼夜矛盾：NIGHT + morning sunlight', () => {
  const r = timelineConsistencyCheck(EN_MISMATCH, 'en');
  assert.strictEqual(r.mismatchCount, 1);
  assert.strictEqual(r.scenes[0].phase, 'night');
  assert.ok(r.issues.some((i) => i.type === 'day_night_mismatch'));
});

test('跨单位换算：只剩两天→48小时后→却说还有三天 = 反转', () => {
  const t = `场景一 客厅 日
林晚：婚礼只剩两天。
赵天成：我知道。
48小时后。
场景二 书房 日
林晚：不着急，婚礼还有三天呢。`;
  const r = timelineConsistencyCheck(t, 'zh');
  assert.strictEqual(r.reversalCount, 1);
});

test('不同事件各自计时不误伤：婚礼剩三天、开庭剩五天互不干涉', () => {
  const t = `场景一 客厅 日
林晚：婚礼只剩三天。
赵天成：我的开庭还有五天。
次日。
场景二 书房 日
林晚：婚礼只剩两天。
赵天成：开庭还剩四天。`;
  const r = timelineConsistencyCheck(t, 'zh');
  assert.strictEqual(r.reversalCount, 0);
  assert.strictEqual(r.issues.filter((i) => i.type === 'countdown_reversal').length, 0);
});

test('豁免与字段边界：空文本/无标题/分数范围/排序/phase 枚举', () => {
  assert.strictEqual(timelineConsistencyCheck('', 'zh').score, 100);
  const noHeader = '林晚：只剩三天了。\n赵天成：快走吧。\n林晚：次日就动手。';
  const r0 = timelineConsistencyCheck(noHeader, 'zh');
  assert.strictEqual(r0.sceneCount, 0);
  assert.strictEqual(r0.score, 100);
  const r1 = timelineConsistencyCheck(ZH_REVERSAL_TWO, 'zh');
  assert.ok(r1.score >= 0 && r1.score <= 100);
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r1.issues.length; i++) {
    assert.ok(order[r1.issues[i - 1].severity] <= order[r1.issues[i].severity]);
  }
  for (const s of r1.scenes) {
    assert.ok(s.phase === 'day' || s.phase === 'night' || s.phase === null);
    assert.strictEqual(typeof s.mismatch, 'boolean');
    assert.strictEqual(s.index >= 1, true);
  }
});
