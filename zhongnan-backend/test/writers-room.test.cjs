const { describe, it } = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/writers-room.js');

describe('选题会', () => {
  it('开场含5步议程与三硬维度问题（人物关系/冲突空间/拍摄难度）', () => {
    const o = R.openPitchMeeting({ idea: '一个被婆家赶出门的全职妈妈决定夺回女儿抚养权' });
    assert.strictEqual(o.agenda.length, 5);
    const all = o.questions.map((q) => q.question).join('');
    assert.ok(all.includes('人物关系'));
    assert.ok(all.includes('冲突'));
    assert.ok(all.includes('集'));
    assert.ok(o.questions.some((q) => q.seat === 'production'));
  });
  it('想法过短时提示补“谁/麻烦/反击”', () => {
    const o = R.openPitchMeeting({ idea: '复仇' });
    assert.ok(o.hints.some((h) => h.includes('简略')));
  });
  it('强输入（主动目标+关系+冲突+受众）应立项GO', () => {
    const v = R.decidePitch({
      idea: '被辞退的女厨师想要夺回自己创办的餐厅品牌，前合伙人处处打压，她暗中布局反击',
      audience: '25-40女性', relation: '师徒变对手、合伙人反目', conflict: '秘方、股权、口碑三层冲突逐层兑付',
      scenes: '后厨和街边小店', episodes: 70,
    });
    assert.strictEqual(v.decision, 'GO');
    assert.ok(v.scores.total >= 72 && v.scores.story >= 65);
    assert.ok(v.logline && v.episodes === 70);
  });
  it('计划集数超出冲突空间容量时不立项GO（防注水），给出容量风险与缩集/加码建议', () => {
    const base = {
      idea: '被辞退的女厨师想要夺回自己创办的餐厅品牌，前合伙人处处打压，她暗中布局反击',
      audience: '25-40女性', relation: '师徒变对手、合伙人反目', conflict: '秘方、股权、口碑三层冲突逐层兑付',
      scenes: '后厨和街边小店',
    };
    const v = R.decidePitch({ ...base, episodes: 300 });
    assert.notStrictEqual(v.decision, 'GO');
    assert.ok(v.capacityEpisodes > 0 && v.capacityEpisodes < 300, '必须返回确定性冲突容量且小于计划集数');
    assert.ok(v.risks.some((r) => r.includes('集')), '风险必须点明集数超载');
    assert.ok(v.fixes.some((f) => /集|副线|加码|升一级/.test(f)), '建议必须给出缩集或扩容量路径');
  });
  it('c197 超容量时决议卡“建议集数”必须取可执行容量，而非回显计划集数（消除自相矛盾）', () => {
    const base = {
      idea: '被辞退的女厨师想要夺回自己创办的餐厅品牌，前合伙人处处打压，她暗中布局反击',
      audience: '25-40女性', relation: '师徒变对手、合伙人反目', conflict: '秘方、股权、口碑三层冲突逐层兑付',
      scenes: '后厨和街边小店',
    };
    const v = R.decidePitch({ ...base, episodes: 300 });
    assert.ok(v.episodes <= v.capacityEpisodes, `建议集数 ${v.episodes} 不应超过可支撑容量 ${v.capacityEpisodes}`);
    assert.ok(v.episodes < 300, '不得再回显300集，否则风险栏说压缩、决议卡说300，自相矛盾');
  });
  it('EN: planned episodes over conflict capacity blocks GO with bilingual risk', () => {
    const v = R.decidePitch({
      idea: 'A fired single mom, hidden billionaire heir, decides to reclaim everything against her cruel boss and ex.',
      relation: 'She vs boss and ex with deep grudge', conflict: 'three conflict layers',
      audience: 'women 25-40', episodes: 300,
    }, 'en');
    assert.notStrictEqual(v.decision, 'GO');
    assert.ok(v.risks.some((r) => /episode|capacity/i.test(r)));
    assert.ok(/[A-Za-z]/.test(v.decisionText));
  });
  it('空泛想法不会被轻易立项（HOLD或NO），且给修改建议', () => {
    const v = R.decidePitch({ idea: '霸总爱上我' });
    assert.ok(v.decision === 'HOLD' || v.decision === 'NO');
    assert.ok(v.fixes.length >= 1);
  });
  it('高成本元素降低可行性并建议换载体', () => {
    const v = R.decidePitch({ idea: '古代战争，千军万马攻城，还有爆炸和雪崩大场面', relation: '敌国将领', conflict: '家国仇恨层层升级' });
    assert.ok(v.scores.feasibility < 70);
    assert.ok(/AI仿真人|漫剧/.test(v.medium));
    assert.ok(v.risks.some((r) => r.includes('高成本')));
  });
});

describe('主角登场四连问', () => {
  it('全齐=100分', () => {
    const r = R.firstAppearanceCheck('开场她就被婆婆逼离婚赶出家门（麻烦/对方），她决定暗中收集证据反击，而她藏着一个身世秘密');
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.missing.length, 0);
  });
  it('只介绍是谁→四项缺失、0分并列出问题', () => {
    const r = R.firstAppearanceCheck('林晚今年三十岁，在一家公司上班，性格温柔。');
    assert.strictEqual(r.score, 0);
    assert.strictEqual(r.missing.length, 4);
  });
});

describe('剧本围读', () => {
  it('四种参与模式齐全，xn_xn为AI自动', () => {
    assert.strictEqual(R.READ_MODES.length, 4);
    const ids = R.READ_MODES.map((m) => m.id);
    assert.deepStrictEqual(ids, ['me_xn', 'user_user', 'me_other_xn', 'xn_xn']);
    assert.strictEqual(R.READ_MODES.find((m) => m.id === 'xn_xn').aiAuto, true);
    assert.ok(R.READ_SEATS.some((s) => s.role === 'producer'));
  });
  it('差剧本能被各席位扫出问题并形成带优先级的修改清单', () => {
    const bad = '林晚今年三十岁，是一个普通人。\n她今天心情复杂，不由得陷入了沉思，命运的齿轮开始转动。\n震惊，她不敢相信，居然是这样的结果，令人万万没想到。';
    const r = R.aiTableRead({ script: bad, title: '一个故事', mode: 'LIVE' });
    assert.ok(Array.isArray(r.notes) && r.notes.length >= 1);
    for (const n of r.notes) {
      assert.ok(n.seat && n.problem && n.suggestion && ['P0', 'P1', 'P2'].includes(n.priority));
    }
    // 通用“震惊”反应必须被导演席抓到
    assert.ok(r.notes.some((n) => n.kind === '通用反应'));
    assert.ok(r.summary.includes('围读'));
    assert.ok(typeof r.scores.overall === 'number');
  });
  it('高成本剧本被制片标注成本等级', () => {
    const s = '第一场 她遇到麻烦被老板刁难，对方步步紧逼，她决定反击并藏着身份秘密。\n车祸爆炸直升机游艇战争大场面。';
    const r = R.aiTableRead({ script: s, mode: 'LIVE' });
    assert.ok(r.sceneCost.highCostHits.length >= 2);
    assert.ok(r.notes.some((n) => n.seat === 'producer'));
  });
  it('完整扎实的单集评分高于空洞文本', () => {
    const good = `第1集 反击
日 内 小饭馆
林晚被婆婆逼着离婚赶出门，对方拍桌叫她滚。她攥紧欠条，决定暗中夺回店铺。没人知道她藏着前主厨的身份。
△她一边擦桌子一边把录音笔推到账本下，手指发抖却没停。
婆婆：外人就别站着了。
林晚（抬眼，笑了一下）：巧了，这店的租约，还写的我名。
她转身进后厨，锅里的油正响，一场更大的麻烦在等着。`;
    const goodR = R.aiTableRead({ script: good, mode: 'LIVE' });
    const badR = R.aiTableRead({ script: '她陷入沉思，命运齿轮转动，震惊，不敢相信。', mode: 'LIVE' });
    assert.ok(goodR.scores.overall > badR.scores.overall);
  });
  it('c197 xn_xn 模式必须产出多立场互相辩论的交锋纪要（模式承诺差异，问而有判）', () => {
    const bad = '林晚今年三十岁，是一个普通人。\n她今天心情复杂，不由得陷入了沉思，命运的齿轮开始转动。\n震惊，她不敢相信，居然是这样的结果，令人万万没想到。';
    const r = R.aiTableRead({ script: bad, title: '一个故事', mode: 'LIVE', modeRead: 'xn_xn' });
    assert.ok(Array.isArray(r.debates), 'debates 必须是数组字段');
    assert.ok(r.debates.length >= 1 && r.debates.length <= 2, 'xn_xn 应确定性产出 1-2 组立场交锋，got ' + r.debates.length);
    for (const d of r.debates) {
      assert.ok(d.topic && d.challenge && d.reply && d.verdict, '交锋必须含议题/质询/反驳/裁决四要素');
      assert.ok(d.fromSeat && d.fromSeatName && d.toSeat && d.toSeatName, '交锋双方席位齐全');
      assert.notStrictEqual(d.fromSeat, d.toSeat, '交锋必须发生在两个不同立场之间');
      assert.ok(['editor', 'director', 'producer', 'audience'].includes(d.fromSeat), '质询方必须是围读席位');
      assert.ok(['editor', 'director', 'producer'].includes(d.toSeat), '反驳方必须能给出实战反方意见');
    }
  });
  it('c197 非 xn_xn 模式不产出辩论（me_xn/未传 modeRead 时 debates 为空数组）', () => {
    const bad = '林晚今年三十岁，是一个普通人。\n她心情复杂陷入沉思，震惊，不敢相信居然是这样。';
    assert.deepStrictEqual(R.aiTableRead({ script: bad, mode: 'LIVE', modeRead: 'me_xn' }).debates, []);
    assert.deepStrictEqual(R.aiTableRead({ script: bad, mode: 'LIVE', modeRead: 'user_user' }).debates, []);
    assert.deepStrictEqual(R.aiTableRead({ script: bad, mode: 'LIVE' }).debates, []);
  });
  it('c197 EN: xn_xn debates are fully localized with zero Chinese', () => {
    const bad = 'She explained meekly and tearfully said let it go forgive him spare him also pitiful. He was hysterical, screamed you trash, call security for no reason. A flicker of mockery in his eyes, heart tightened deep inside complicated emotion. She knelt down please spare me brainless, seems perhaps maybe slowly. '.repeat(3);
    const r = R.aiTableRead({ script: bad, title: 'a vague story', mode: 'LIVE', modeRead: 'xn_xn' }, 'en');
    assert.ok(r.debates.length >= 1, 'EN xn_xn must also produce debates');
    assert.ok(!/[一-龥]/.test(JSON.stringify(r.debates)), 'EN debates must contain no Chinese');
  });
  it('c198 真人讨论进结论：有人模式传 discussion 时按席位信号词确定性归类（席位/原文/采纳判定齐，≤3条）', () => {
    const bad = '林晚今年三十岁，是一个普通人。\n她今天心情复杂，不由得陷入了沉思，命运的齿轮开始转动。\n震惊，她不敢相信，居然是这样的结果，令人万万没想到。';
    const discussion = [
      '我觉得开头太慢了，观众进不来',
      '成本太高，不能再加场景了，预算扛不住',
      '这段台词太书面，演员根本没法念',
    ].join('\n');
    const r = R.aiTableRead({ script: bad, title: '一个故事', mode: 'LIVE', modeRead: 'user_user', discussion });
    assert.ok(Array.isArray(r.discussionPoints), 'discussionPoints 必须是数组字段（老 payload 前端需可兜底）');
    assert.ok(r.discussionPoints.length >= 2 && r.discussionPoints.length <= 3, '最多取3条讨论点，got ' + r.discussionPoints.length);
    const bySeat = Object.fromEntries(r.discussionPoints.map((p) => [p.seat, p]));
    assert.ok(bySeat.editor, '开头/慢信号必须归责编席，got seats ' + Object.keys(bySeat).join(','));
    assert.ok(bySeat.producer, '成本/加场/预算信号必须归制片席');
    assert.ok(bySeat.director, '台词/书面/演员信号必须归导演席');
    for (const p of r.discussionPoints) {
      assert.ok(p.seatName && typeof p.point === 'string' && p.point.length > 0, '席位名与讨论原文必须齐');
      assert.strictEqual(typeof p.adopted, 'boolean', 'adopted 必须是布尔判定，不允许含糊');
    }
    // 责编"开头太慢"与引擎独立扫出的慢开场意见重合 → 已采纳；该低成本剧本引擎无制片意见 → 真人制片意见保留为新增关注
    assert.strictEqual(bySeat.editor.adopted, true, '引擎责编席独立扫出慢开场，讨论点应标已采纳');
    assert.strictEqual(bySeat.producer.adopted, false, '引擎没扫出成本问题时，真人制片意见必须保留为新增关注，不得蒸发');
    assert.ok(r.summary.includes('讨论'), '主持人总结必须显性交代真人讨论的去向，不能假装没讨论过');
  });
  it('c198 xn_xn 无人模式/未传或空讨论：discussionPoints 恒为空数组', () => {
    const bad = '林晚今年三十岁，是一个普通人。\n她心情复杂陷入沉思，震惊，不敢相信居然是这样。';
    assert.deepStrictEqual(R.aiTableRead({ script: bad, mode: 'LIVE', modeRead: 'xn_xn', discussion: '开头太慢成本太高台词不行' }).discussionPoints, []);
    assert.deepStrictEqual(R.aiTableRead({ script: bad, mode: 'LIVE', modeRead: 'user_user' }).discussionPoints, []);
    assert.deepStrictEqual(R.aiTableRead({ script: bad, mode: 'LIVE', modeRead: 'me_xn', discussion: '   ' }).discussionPoints, []);
  });
  it('c198 EN: live discussion points classified by English signals, localized with zero Chinese', () => {
    const bad = 'She was an ordinary person. The weather was nice that day. She walked home slowly thinking about many things. '.repeat(3);
    const discussion = [
      'the opening is way too slow',
      'this is too expensive, do not add new scenes',
      'the lines are unplayable and too literary for the actors',
    ].join('\n');
    const r = R.aiTableRead({ script: bad, title: 'a vague story', mode: 'LIVE', modeRead: 'user_user', discussion }, 'en');
    assert.ok(Array.isArray(r.discussionPoints) && r.discussionPoints.length >= 2, 'EN discussion must be classified');
    const seats = r.discussionPoints.map((p) => p.seat);
    assert.ok(seats.includes('editor'), 'opening/slow → editor');
    assert.ok(seats.includes('producer'), 'expensive/new scenes → producer');
    assert.ok(seats.includes('director'), 'lines/unplayable/literary → director');
    assert.ok(!/[一-龥]/.test(JSON.stringify(r.discussionPoints)), 'EN discussion points zero Chinese');
    assert.ok(!/[一-龥]/.test(r.summary), 'EN summary (with discussion suffix) zero Chinese');
  });
  it('c199 同一席位多条不同真人意见必须都保留（修"每席只留最早一条"违反不蒸发原则）', () => {
    const bad = '林晚三十岁，普通人。\n她陷入沉思，命运齿轮转动，震惊万万没想到。';
    const discussion = [
      '开头太慢了，前三集都在铺垫',
      '女主人设前后矛盾，动机立不住',
      '成本太高，预算不够',
      '台词太书面，演员没法念',
    ].join('\n');
    const r = R.aiTableRead({ script: bad, mode: 'LIVE', modeRead: 'user_user', discussion });
    assert.strictEqual(r.discussionPoints.length, 4, '两条责编意见是不同问题，第二条不得蒸发，got ' + r.discussionPoints.length);
    assert.deepStrictEqual(r.discussionPoints.map((p) => p.seat), ['editor', 'director', 'producer', 'editor'],
      '席位轮转展平：先各席首条保多样性，再补同席第二条');
    const editors = r.discussionPoints.filter((p) => p.seat === 'editor');
    assert.ok(editors[0].point.includes('开头'), '席内按时间序，got ' + editors[0].point);
    assert.ok(editors[1].point.includes('人设') || editors[1].point.includes('动机'), '第二条责编意见原文必须保留，got ' + editors[1].point);
    assert.notStrictEqual(editors[0].point, editors[1].point);
  });
  it('c199 讨论点总数封顶5条：席位轮转截取，同席第3条及观众席延后项舍弃可解释', () => {
    const bad = '林晚三十岁，普通人。\n她陷入沉思，命运齿轮转动，震惊万万没想到。';
    const discussion = [
      '开头太慢了，前三集都在铺垫',
      '女主人设前后矛盾，动机立不住',
      '成本太高，预算不够',
      '换景太多，工期也紧',
      '台词太书面，演员没法念',
      '演员走位和动作设计也不清楚',
    ].join('\n');
    const r = R.aiTableRead({ script: bad, mode: 'LIVE', modeRead: 'user_user', discussion });
    assert.ok(r.discussionPoints.length <= 5, '总数封顶5条防刷屏，got ' + r.discussionPoints.length);
    assert.strictEqual(r.discussionPoints.length, 5);
    assert.deepStrictEqual(r.discussionPoints.map((p) => p.seat), ['editor', 'director', 'producer', 'editor', 'director'],
      '轮转顺序：各席首条先行，第二轮按职责序补位');
  });
});

it('v1.91 lang=en：选题会/决议/围读/席位全英文且不含中文；默认中文不变', () => {
  const has = (o) => /[一-龥]/.test(JSON.stringify(o));
  const op = R.openPitchMeeting({ idea: 'A fired single mom finds she is the hidden heir and decides to fight her boss.' }, 'en');
  assert.ok(!has({ a: op.agenda, q: op.questions, h: op.hints }));
  const v = R.decidePitch({ idea: 'A fired single mom, hidden billionaire heir, decides to reclaim everything against her cruel boss and ex.', relation: 'She vs boss and ex with deep grudge', conflict: 'three conflict layers', audience: 'women 25-40' }, 'en');
  assert.ok(!has(v));
  assert.ok(/[A-Za-z]/.test(v.decisionText));
  const scr = 'INT. OFFICE - DAY. She is fired and betrayed by her boss. She decides to fight back and reclaim her hidden identity, a secret is buried. '.repeat(10);
  const tr = R.aiTableRead({ script: scr, title: 'The Hidden Heir Strikes Back', mode: 'LIVE' }, 'en');
  assert.ok(!has({ n: tr.notes, s: tr.summary, a: tr.actionItems, c: tr.sceneCost }));
  assert.ok(R.pitchSeats('en').every((s) => !/[一-龥]/.test(s.name + s.focus)));
  assert.ok(R.readModes('en').every((m) => !/[一-龥]/.test(m.name + m.desc)));
  assert.ok(R.readSeats('en').every((s) => !/[一-龥]/.test(s.name + s.duty)));
  // 默认中文逐字不变
  const opz = R.openPitchMeeting({ idea: '被开除的单亲妈妈发现自己是隐藏继承人，决定反击老板' });
  assert.ok(opz.agenda[0].startsWith('1. 市场前置'));
  const tz = R.aiTableRead({ script: '内景 办公室 日。她被老板开除背叛，决定反击，藏着一个秘密。'.repeat(10) });
  assert.ok(tz.notes.length === 0 || /[一-龥]/.test(tz.notes[0].seatName));
});

it('v1.92 五大深度质检在英文围读下规则级本地化、零中文且深度层恢复', () => {
  const has = (o) => /[一-龥]/.test(JSON.stringify(o));
  const zh = '内景 办公室 日。她心中五味杂陈，脑海里暗自想，眼角闪过三分讥笑，薄唇勾起一抹弧度，她下跪磕头，求求你饶命，委屈地说，默默忍让，讲道理，仿佛一般，久久不能平静。他叫保安把她赶出去，破口大骂，歇斯底里，无缘无故欺负她。'.repeat(3);
  const r = R.aiTableRead({ script: zh, title: '逆袭归来夺回一切', mode: 'LIVE' }, 'en');
  assert.ok(!has({ n: r.notes, a: r.actionItems, s: r.summary }), 'EN read must contain no Chinese');
  // 深度知识层（五大引擎之一）必须以英文 dim 出现
  const deepKinds = r.notes.map((n) => n.kind).join('|');
  assert.ok(/Antagonist|Payoff|Show, don|Subtext|cliffhanger|wrinkle|sophistication|edge|agency|directness/i.test(deepKinds), 'deep lint layer should be localized: ' + deepKinds);
  assert.ok(r.notes.every((n) => !/[一-龥]/.test(n.seatName + n.suggestion)));
});

it('v1.92 英文围读恢复 craft/emotion 深度意见层（英文召回、零中文）', () => {
  const has = (o) => /[一-龥]/.test(JSON.stringify(o));
  const bad = 'She explained meekly and tearfully said let it go forgive him spare him also pitiful. He was hysterical, screamed you trash, call security for no reason. A flicker of mockery in his eyes, heart tightened deep inside complicated emotion. She knelt down please spare me brainless, seems perhaps maybe slowly. '.repeat(3);
  const r = R.aiTableRead({ script: bad, title: 'a vague story', mode: 'LIVE' }, 'en');
  assert.ok(!has({ n: r.notes, s: r.summary, a: r.actionItems }), '英文围读零中文');
  const kinds = r.notes.map((n) => n.kind).join(' ');
  assert.ok(/[A-Za-z]/.test(kinds) && r.notes.length >= 3, '应产出多条英文深度意见');
});

it('v1.94 英文选题会注入七类知识库 hints（流派/原型/反派/系统/钩子/工艺/资方/风向）且零中文', () => {
  const hasCjk = (o) => /[一-龥]/.test(JSON.stringify(o));
  const idea = 'A reborn woman takes back her life and revenge against a toxic wealthy family with a hidden system panel, enclosed modern indoor scenes, strong first-3-seconds hook and face-slap payoff, CEO romance underdog suspense';
  const o = R.openPitchMeeting({ idea, audience: 'female 18-35', tags: ['rebirth', 'revenge', 'system', 'suspense'] }, 'en');
  assert.ok(!hasCjk(o.hints), 'EN pitch hints must contain no Chinese');
  const blob = o.hints.join('\n');
  // 七类知识层都要在英文模式出现（此前只有 2 条通用 hint）
  assert.ok(o.hints.length >= 7, 'should inject at least 7 knowledge hints, got ' + o.hints.length);
  assert.ok(/fits the genre/i.test(blob), 'genre compensation');
  assert.ok(/Protagonist archetype/i.test(blob), 'protagonist archetype');
  assert.ok(/Antagonist archetype/i.test(blob), 'villain archetype');
  assert.ok(/golden-finger mechanic/i.test(blob), 'system mechanic');
  assert.ok(/Default hook mix/i.test(blob), 'hook mix');
  assert.ok(/Narrative craft points/i.test(blob), 'craft cards');
  assert.ok(/Investor lens/i.test(blob), 'investor lens');
  assert.ok(/topic wind/i.test(blob), 'topic wind');
});

it('v1.94 中文选题会知识库 hints 逐字结构不变', () => {
  const o = R.openPitchMeeting({ idea: '重生女主逆袭复仇豪门恶婆婆，带系统金手指，封闭现代室内场景，前3秒强钩子打脸', audience: '女频', tags: ['重生', '复仇', '系统'] }, 'zh');
  const blob = o.hints.join('\n');
  assert.ok(o.hints.length >= 7);
  assert.ok(blob.includes('该诉求契合流派'));
  assert.ok(blob.includes('主角原型建议'));
  assert.ok(blob.includes('反派选型建议'));
  assert.ok(blob.includes('系统/金手指机制建议'));
  assert.ok(blob.includes('系统默认钩子组合'));
  assert.ok(blob.includes('叙事工艺要点'));
  assert.ok(blob.includes('资方视角'));
  assert.ok(blob.includes('题材风向'));
});

describe('c200 围读结论→定点改写包（结论必须能离开协作工具，落到/fix）', () => {
  const mk = (over) => ({
    seat: 'editor', seatName: '责编/老师', kind: '钩子弱', location: '集/场开头',
    problem: '缺少明确开场钩子', suggestion: '3秒内用直接冲突立住停不下来的理由', priority: 'P1', ...over,
  });
  it('buildReadRewritePacks 纯函数：只收 P0/P1（与 actionItems 同口径），P2 不进包', () => {
    const packs = R.buildReadRewritePacks([
      mk({ priority: 'P0' }), mk({ priority: 'P1', seat: 'director' }), mk({ priority: 'P2', seat: 'producer' }),
    ]);
    assert.strictEqual(packs.length, 2);
    assert.deepStrictEqual(packs.map((p) => p.priority), ['P0', 'P1'], '入参乱序也必须按 P0→P1 稳定排序');
  });
  it('pack.fix 满足 /fix schema 契约：rule 1-60 非空、dimLabel≤20、advice 1-500，advice=位置+改法（zh全角冒号）', () => {
    const packs = R.buildReadRewritePacks([mk({ rule: 'filler' })]);
    const fix = packs[0].fix;
    assert.ok(typeof fix.rule === 'string' && fix.rule.length >= 1 && fix.rule.length <= 60);
    assert.ok(Buffer.byteLength(fix.dimLabel, 'utf8') <= 60 && fix.dimLabel.length <= 20);
    assert.ok(fix.advice.length >= 1 && fix.advice.length <= 500);
    assert.ok(fix.advice.includes('集/场开头') && fix.advice.includes('3秒内'), 'advice 必须带位置与具体改法');
    assert.ok(fix.advice.includes('：'), 'zh advice 用全角冒号连接位置与改法');
  });
  it('rule 透传与兜底：lint 规则号原样保留；无 rule 的手写 note 用确定性 read.<seat>.<i> 兜底（未知规则在/fix闸门fail-closed按高级处理，不伪造质检号）', () => {
    const packs = R.buildReadRewritePacks([
      mk({ rule: 'sainthood', priority: 'P0' }),
      mk({ seat: 'director', seatName: '导演' }),
      mk({ rule: '../evil?x=1' }), // 非规则号字符必须回退，防注入/伪造
    ]);
    assert.strictEqual(packs[0].fix.rule, 'sainthood');
    assert.match(packs[1].fix.rule, /^read\.director\.r\d+$/, '手写 note 兜底键必须可复现，got ' + packs[1].fix.rule);
    assert.match(packs[2].fix.rule, /^read\.editor\.r\d+$/, '脏 rule 必须回退兜底键，got ' + packs[2].fix.rule);
    // 兜底键同输入两次构造结果一致（幂等窗重放/前端刷新必须拿到同一 pack）
    const again = R.buildReadRewritePacks([mk({ seat: 'director', seatName: '导演' })]);
    assert.strictEqual(again[0].fix.rule, R.buildReadRewritePacks([mk({ seat: 'director', seatName: '导演' })])[0].fix.rule);
  });
  it('超长 dimLabel/advice 截断不破契约；缺位置时不残留起始冒号', () => {
    const longDim = '维度'.repeat(30);
    const longAdvice = '改'.repeat(800);
    const packs = R.buildReadRewritePacks([mk({ kind: longDim, location: '', suggestion: longAdvice })]);
    assert.ok(packs[0].fix.dimLabel.length <= 20);
    assert.strictEqual(packs[0].fix.advice.length, 500);
    assert.ok(!packs[0].fix.advice.startsWith('：') && !packs[0].fix.advice.startsWith(':'));
  });
  it('脏输入（null/对象/非数组/缺suggestion）恒返回 [] 且不抛（老 payload.lastRead 容错必须兑现）', () => {
    for (const bad of [null, undefined, {}, 'x', 42, [mk({ suggestion: '' })]]) {
      assert.deepStrictEqual(R.buildReadRewritePacks(bad), []);
    }
  });
  it('en：advice 用 ASCII ": " 连接且整包零中文', () => {
    const packs = R.buildReadRewritePacks([{
      seat: 'director', seatName: 'Director', kind: 'AI-sounding dialogue', location: 'Dialogue',
      problem: 'AI-speak found', suggestion: 'Rewrite into spoken lines this character would say', priority: 'P1', rule: 'dialog.aiTone',
    }], { lang: 'en' });
    assert.match(packs[0].fix.advice, /^Dialogue: /);
    assert.ok(!/[一-龥]/.test(JSON.stringify(packs)), 'EN packs zero Chinese');
  });
  it('aiTableRead 结论带 rewritePacks：条数=actionItems；AI腔→dialog.aiTone、字数→format.length（规则号与意见语义同源，禁止为过闸门硬贴前缀）', () => {
    const bad = '林晚今年三十岁，是一个普通人。\n她今天心情复杂，不由得陷入了沉思，命运的齿轮开始转动。\n震惊，她不敢相信，居然是这样的结果，令人万万没想到。\n他嘴角勾起一抹弧度，心中一紧，眼底闪过一丝冷意，空气仿佛凝固，五味杂陈地看着她，意味深长地说这一切宛如梦境。';
    const r = R.aiTableRead({ script: bad, title: '一个故事', mode: 'LIVE' });
    assert.ok(Array.isArray(r.rewritePacks), 'TableReadResult 必须新增 rewritePacks（老 payload 由路由只读重建，前端无需等待重跑）');
    assert.strictEqual(r.rewritePacks.length, r.actionItems.length, 'packs 与修改清单同口径（仅 P0/P1）');
    const ai = r.notes.find((n) => n.kind === '台词AI腔');
    assert.ok(ai && ai.rule === 'dialog.aiTone', 'AI腔意见必须语义同源携带基础台词规则号，got rule=' + (ai && ai.rule));
    const lenN = r.notes.find((n) => n.kind === '字数偏差');
    assert.ok(lenN && lenN.rule === 'format.length', '字数意见必须携带 format 基础规则号，got rule=' + (lenN && lenN.rule));
    // 通用反应/场景成本等非台词非格式手写意见不得贴基础前缀（否则 BASIC 会员可越权深度改写）
    const generic = r.notes.find((n) => n.kind === '通用反应');
    if (generic) assert.ok(!generic.rule || !/^(dialog|spoken|colloquial|format|punct|typo|wording|tongue)/i.test(generic.rule), '通用反应意见不得伪装基础规则');
    // lint 派生 note 必须把真实规则号带出（此前构造 ReadNote 时 rule 被整体丢弃）
    assert.ok(r.notes.some((n) => typeof n.rule === 'string' && /^[a-z][a-zA-Z]+$/.test(n.rule) && !['dialog.aiTone', 'format.length'].includes(n.rule)),
      '至少一条 lint 派生 note 携带真实质检规则号');
  });
  it('aiTableRead EN：rewritePacks 零中文，每条 fix.advice 为 ASCII 冒号', () => {
    const bad = 'She explained meekly and tearfully said let it go forgive him spare him also pitiful. He was hysterical, screamed you trash, call security for no reason. A flicker of mockery in his eyes, heart tightened deep inside complicated emotion. She knelt down please spare me brainless, seems perhaps maybe slowly. '.repeat(3);
    const r = R.aiTableRead({ script: bad, title: 'a vague story', mode: 'LIVE' }, 'en');
    assert.ok(r.rewritePacks.length >= 1);
    assert.ok(!/[一-龥]/.test(JSON.stringify(r.rewritePacks)), 'EN packs zero Chinese');
    for (const p of r.rewritePacks) assert.ok(p.fix.advice.includes(': '));
  });
});

it('v1.94 英文选型器按英文关键词召回（流派/原型/钩子/卡片/资方）', () => {
  const G = require('../dist/engine/genre-compensate.js');
  const A = require('../dist/engine/archetype-craft.js');
  const N = require('../dist/engine/narrative-craft.js');
  const I = require('../dist/engine/investor-lens.js');
  const g = G.matchGenreByPain('she is reborn with a second chance and a system panel', 'en');
  assert.ok(g.some((x) => x.id === 'rebirth'), 'EN genre rebirth recall');
  const a = A.matchArchetype({ text: 'female revenge against wealthy clan, strong female iron queen', tags: [] }, 'en');
  assert.ok(a.protag.some((p) => p.id === 'iron_queen'), 'EN protag recall');
  assert.ok(a.system.length === 0, 'no system keyword => no system mechanic');
  const h = N.recommendHooks({ text: 'a suspense spy undercover information gap thriller', tags: [] }, 'en');
  assert.ok(h.length >= 3, 'EN hook base mix');
  const c = N.matchCraftCards({ text: 'horror thriller suspense family realistic', tags: [], limit: 5 }, 'en');
  assert.ok(c.length >= 1, 'EN craft card recall got ' + c.length);
  const il = I.investorLens({ text: 'benchmark hit trend, enclosed indoor small cast low budget, strong hook reversal payoff, revenue share recoup break-even', tags: [] }, 'en');
  assert.ok(!/[一-龥]/.test(JSON.stringify(il)), 'EN investor lens zero CJK');
  assert.ok(/[A-Za-z]/.test(I.investorOneLiner(il, 'en')), 'EN one-liner');
});
