const test = require('node:test');
const assert = require('node:assert');
const { twistDensityScore } = require('../dist/engine/twist-density-score.js');

// —— 中文剧本样本 ——

// 高质量剧本：3个反转，多种类型，分布合理，结尾高潮
const ZH_HIGH_QUALITY = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
△林晚一巴掌扇在前台脸上
林晚：滚开！这是收购协议，从今天起，这家公司是我的。
李经理（震惊）：不可能！原来你是收购方的人？

场景：经理办公室 日 内景
△李经理揪住林晚衣领
李经理：跪下求我，我就放你走。
△林晚冷笑，把一份文件摔在桌上
林晚：你不知道我是谁吧？其实我才是真正的董事长。
李经理（惊）：你是董事长？怎么可能！

场景：天台 黄昏 外景
△王总站在天台边缘，风吹乱他的头发
王总（绝望）：你赢了，我都给你。原来你一直在装好人。
林晚：晚了。你以为忍让是软弱？原来你才是真正的大老板。
`;

// 无反转
const ZH_NO_TWIST = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
林晚：好的，那我下次再来。
△林晚转身离开

场景：经理办公室 日 内景
△李经理坐在椅子上
李经理：今天的会议就到这里，散会。
△众人起身离开

场景：天台 黄昏 外景
△王总站在天台边
王总：今天天气不错。
林晚：是的，确实不错。
`;

// 反转不足（仅1个反转）
const ZH_SINGLE_TWIST = `
场景：公司大厅 日 内景
△林晚走进大厅
前台：这位女士，没有预约不能进。
林晚：好的，那我下次再来。
△林晚转身离开

场景：经理办公室 日 内景
△李经理坐在椅子上
李经理：今天的会议就到这里，散会。
△众人起身离开

场景：天台 黄昏 外景
△王总站在天台边
王总（绝望）：你赢了，原来你一直在装好人。
林晚：晚了。
`;

// 反转类型单一（全部小反转）
const ZH_MONOTONE = `
场景：公司大厅 日 内景
△林晚走进大厅
前台：这位女士，没有预约不能进。
△林晚突然转身
林晚：没想到你会这么说。

场景：经理办公室 日 内景
△李经理突然站起来
李经理：谁知道事情会变成这样。

场景：天台 黄昏 外景
△王总突然大笑
王总：出乎意料啊。
林晚：没想到吧。
`;

// 反转全部集中在结尾
const ZH_BACKLOADED = `
场景：公司大厅 日 内景
△林晚走进大厅
前台：这位女士，没有预约不能进。
林晚：好的，那我下次再来。
△林晚转身离开

场景：经理办公室 日 内景
△李经理坐在椅子上
李经理：今天的会议就到这里，散会。
△众人起身离开

场景：天台 黄昏 外景
△王总站在天台边
王总（绝望）：你赢了，原来你一直在装好人。其实我才是真正的董事长。
林晚：晚了。
`;

// 弱反转过多
const ZH_WEAK_HEAVY = `
场景：公司大厅 日 内景
△林晚走进大厅
前台：这位女士，没有预约不能进。
△林晚突然转身
林晚：没想到你会这么说。

场景：经理办公室 日 内景
△李经理突然站起来
李经理：谁知道事情会变成这样。

场景：天台 黄昏 外景
△王总突然大笑
王总：出乎意料啊。
林晚：没想到吧。
`;

// —— 英文剧本样本 ——

const EN_HIGH_QUALITY = `
Scene: Company Lobby, Day, Interior
△ Lin Wan walks in; the receptionist blocks her.
Receptionist: No appointment, no entry.
△ Lin Wan slaps her.
Lin Wan: Back off! This is the acquisition agreement — the company is mine now.
Manager (shocked): Impossible! You were the buyer all along?

Scene: Manager's Office, Day, Interior
△ The manager grabs Lin Wan's collar.
Manager: Kneel and beg, and I'll let you go.
△ Lin Wan smirks, slams a file on the desk.
Lin Wan: You don't know who I am, do you? It turns out I am the real chairman.
Manager (alarmed): The chairman? How?

Scene: Rooftop, Dusk, Exterior
△ Wang stands at the edge, wind in his hair.
Wang (defeated): You win, take it all. You were faking your kindness all along.
Lin Wan: Too late. You thought patience was weakness?
`;

const EN_NO_TWIST = `
Scene: Company Lobby, Day, Interior
△ Lin Wan walks in; the receptionist blocks her.
Receptionist: No appointment, no entry.
Lin Wan: Alright, I'll come back next time.
△ Lin Wan turns and leaves.

Scene: Manager's Office, Day, Interior
△ The manager sits in his chair.
Manager: That concludes the meeting. Dismissed.
△ Everyone gets up and leaves.

Scene: Rooftop, Dusk, Exterior
△ Wang stands at the edge.
Wang: Nice weather today.
Lin Wan: Yes, quite nice.
`;

test('v2.121 高质量剧本：3+反转/多样/结尾高潮/分数高', () => {
  const res = twistDensityScore(ZH_HIGH_QUALITY, 'zh');
  assert.ok(res.count >= 3, `反转数应≥3，实际${res.count}`);
  assert.ok(res.variety >= 2, `多样性应≥2，实际${res.variety}`);
  assert.ok(res.hasClimaxTwist, '应有结尾高潮反转');
  assert.ok(res.score >= 70, `分数应≥70，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `不应有 high 级问题，但有：${highIssues.map((i) => i.type).join(', ')}`);
});

test('v2.121 无反转应触发 high 级问题', () => {
  const res = twistDensityScore(ZH_NO_TWIST, 'zh');
  assert.strictEqual(res.count, 0, `反转数应为0，实际${res.count}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_twist'), '应有 no_twist 问题');
  assert.ok(res.score <= 40, `无反转分数应≤40，实际${res.score}`);
});

test('v2.121 仅1个反转应触发 high 级问题', () => {
  const res = twistDensityScore(ZH_SINGLE_TWIST, 'zh');
  assert.ok(res.count >= 1, `反转数应≥1，实际${res.count}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'twist_insufficient'), '应有 twist_insufficient 问题');
});

test('v2.121 反转类型单一应触发 mid 级问题', () => {
  const res = twistDensityScore(ZH_MONOTONE, 'zh');
  if (res.count >= 2) {
    assert.ok(res.variety < 2, `多样性应<2，实际${res.variety}`);
    const midIssues = res.issues.filter((i) => i.severity === 'mid' && i.type === 'twist_monotone');
    assert.ok(midIssues.length >= 1, '应有 twist_monotone 问题');
  }
});

test('v2.121 反转集中结尾应触发 mid 级问题', () => {
  const res = twistDensityScore(ZH_BACKLOADED, 'zh');
  if (res.count >= 2) {
    assert.ok(res.distribution.head + res.distribution.mid < 1, '开头+中段反转应<1');
    const midIssues = res.issues.filter((i) => i.severity === 'mid' && i.type === 'twist_backloaded');
    assert.ok(midIssues.length >= 1, '应有 twist_backloaded 问题');
  }
});

test('v2.121 弱反转过多应触发 low 级问题', () => {
  const res = twistDensityScore(ZH_WEAK_HEAVY, 'zh');
  if (res.count >= 2 && res.weakRatio > 0.5) {
    const lowIssues = res.issues.filter((i) => i.severity === 'low' && i.type === 'twist_weak_heavy');
    assert.ok(lowIssues.length >= 1, '应有 twist_weak_heavy 问题');
  }
});

test('v2.121 英文链路：反转识别+零中文泄漏', () => {
  const res = twistDensityScore(EN_HIGH_QUALITY, 'en');
  assert.ok(res.count >= 2, `英文反转数应≥2，实际${res.count}`);
  // typeLabel 字段不应有中文字符
  const hasZh = res.hits.some((h) => /[一-龥]/.test(h.typeLabel));
  assert.strictEqual(hasZh, false, '英文链路 typeLabel 不应含中文字符');
  // issue advice 也不应有中文
  const hasZhAdvice = res.issues.some((i) => /[一-龥]/.test(i.advice));
  assert.strictEqual(hasZhAdvice, false, '英文链路 advice 不应含中文字符');
});

test('v2.121 英文无反转应触发 high 级问题且 advice 零中文', () => {
  const res = twistDensityScore(EN_NO_TWIST, 'en');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_twist'), '应有 no_twist 问题');
  const hasZh = res.issues.some((i) => /[一-龥]/.test(i.advice));
  assert.strictEqual(hasZh, false, '英文 advice 不应含中文');
});

test('v2.121 场景行不被误识别为反转', () => {
  const script = `
场景：公司大厅 日 内景
Scene: Office, Day, Interior
△林晚走进大厅
`;
  const res = twistDensityScore(script, 'zh');
  // 场景标题行本身不应被算作反转
  res.hits.forEach((h) => {
    assert.ok(!/^(场景|Scene)/.test(h.snippet), `场景行被误识别：${h.snippet}`);
  });
});

test('v2.121 同一行多个反转取强度最高的', () => {
  const script = `
场景：天台 黄昏 外景
王总（绝望）：你赢了，原来你一直在装好人。其实我才是真正的董事长。这一切都是假的。
`;
  const res = twistDensityScore(script, 'zh');
  // 同一行只算一个反转（最强）
  const hitsInOneLine = res.hits.filter((h) => h.position > 0.4 && h.position < 0.6);
  assert.ok(hitsInOneLine.length <= 1, `同一行不应有多个反转，实际${hitsInOneLine.length}`);
  if (hitsInOneLine.length === 1) {
    assert.ok(hitsInOneLine[0].strength >= 80, `最强反转强度应≥80，实际${hitsInOneLine[0].strength}`);
  }
});

test('v2.121 强度曲线按位置排序', () => {
  const res = twistDensityScore(ZH_HIGH_QUALITY, 'zh');
  for (let i = 1; i < res.strengthCurve.length; i++) {
    const prevPos = res.hits[i - 1].position;
    const curPos = res.hits[i].position;
    assert.ok(prevPos <= curPos, `强度曲线应按位置升序：位置${i - 1}=${prevPos} > 位置${i}=${curPos}`);
  }
});
