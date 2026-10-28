const test = require('node:test');
const assert = require('node:assert');
const MG = require('../dist/engine/mode-gate.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.92 非对应模式返回 allowed=true 空报告（不重复 mature_x/interactive 已有专属闸门）', () => {
  ['', undefined, null, 'unknown_xyz'].forEach((m) => {
    const r = MG.screenModeGate(m, '任意文本内容，无关模式不校验', 'zh');
    assert.strictEqual(r.allowed, true);
    assert.strictEqual(r.blocked.length, 0);
    assert.strictEqual(r.warnings.length, 0);
  });
  // mature_x 与 interactive 已有专属闸门（matureScreen/validateBranches），mode-gate 不重复覆盖
  ['mature_x', 'interactive'].forEach((m) => {
    const r = MG.screenModeGate(m, '任意文本', 'zh');
    assert.strictEqual(r.allowed, true, `${m} 不在 mode-gate 覆盖范围（已有专属闸门）`);
    assert.strictEqual(r.blocked.length, 0, `${m} blocked 必须空`);
  });
});

test('v2.92 video_short 模式：绝对化用语硬禁（广告法第九条）', () => {
  const draft = '这款榨汁杯是市面上最好的榨汁杯，100%根治便秘，无效退款！第一品牌，国家级专利。';
  const r = MG.screenModeGate('video_short', draft, 'zh');
  assert.strictEqual(r.allowed, false, '命中绝对化用语必须硬禁');
  assert.ok(r.blocked.length >= 1, '至少 1 条 blocked');
  assert.ok(r.blocked.some((h) => h.rule === 'absolute_claims'), '命中 absolute_claims 规则');
  assert.ok(r.blocked[0].evidence.includes('绝对化'), '证据点明示绝对化');
});

test('v2.92 video_short 模式：3秒钩子缺失软警', () => {
  // 前 80 字无冲突/疑问/反差/极端情绪信号
  const draft = '我们的榨汁杯非常方便，可以随时随地榨汁，质量很好，价格便宜，欢迎大家购买。' + '场景描述。'.repeat(20);
  const r = MG.screenModeGate('video_short', draft, 'zh');
  assert.strictEqual(r.allowed, true, '软警不拦截');
  assert.ok(r.warnings.some((h) => h.rule === 'missing_3s_hook'), '命中 missing_3s_hook 软警');
});

test('v2.92 video_short 模式：通过用例（3秒钩子+无绝对化）', () => {
  const draft = '你以为榨汁杯都一样？直到我用坏第三个，才发现问题不在杯。' +
    '「主播（疑惑）：这款到底有什么不同？」\n△ 镜头切到榨汁杯特写\n「主播（惊喜）：一键启动，30秒出汁，好清洗。」\n△ 镜头切到使用前后对比\n想了解更多？评论区告诉我。';
  const r = MG.screenModeGate('video_short', draft, 'zh');
  assert.strictEqual(r.allowed, true, '通过用例必须 allowed');
  assert.strictEqual(r.blocked.length, 0, '通过用例无 blocked');
  assert.ok(r.score >= 60, `通过用例得分不应过低：${r.score}`);
});

test('v2.92 branded_skit 模式：医疗功效+投资承诺+贬低竞品 三类硬禁', () => {
  // 医疗功效
  const med = '这款精油可以降血压、抗癌、消炎杀菌，是真正的万能药。';
  assert.strictEqual(MG.screenModeGate('branded_skit', med, 'zh').allowed, false, '医疗功效硬禁');
  assert.ok(MG.screenModeGate('branded_skit', med, 'zh').blocked.some((h) => h.rule === 'medical_claims'));
  // 投资承诺
  const inv = '投资这款产品保本稳赚，零风险翻倍，财富自由不是梦。';
  assert.strictEqual(MG.screenModeGate('branded_skit', inv, 'zh').allowed, false, '投资承诺硬禁');
  assert.ok(MG.screenModeGate('branded_skit', inv, 'zh').blocked.some((h) => h.rule === 'investment_claims'));
  // 贬低竞品
  const dis = '我们的产品秒杀竞品、碾压同行、完爆所有对手，远超同类。';
  assert.strictEqual(MG.screenModeGate('branded_skit', dis, 'zh').allowed, false, '贬低竞品硬禁');
  assert.ok(MG.screenModeGate('branded_skit', dis, 'zh').blocked.some((h) => h.rule === 'disparage_competitors'));
});

test('v2.92 branded_skit 模式：品牌名过早出现软警（前三分之一篇幅出现≥2次）', () => {
  // 前 1/3 篇幅反复出现"小熊牌"
  const head = '小熊牌榨汁杯真是神器。小熊牌让我每天都想榨汁。';
  const tail = '场景描写。'.repeat(30);
  const draft = head + tail;
  const r = MG.screenModeGate('branded_skit', draft, 'zh');
  assert.strictEqual(r.allowed, true, '软警不拦截');
  assert.ok(r.warnings.some((h) => h.rule === 'brand_too_early'), '命中 brand_too_early 软警');
});

test('v2.92 branded_skit 模式：通过用例（解题者定位+无硬禁词）', () => {
  // 前 2/3 立人物困境，转折点才让品牌成为解法
  const draft = '林晚加班到凌晨，胃又疼了。她已经第三个月没按时吃饭。\n' +
    '△ 办公室灯光昏暗，林晚揉着胃继续敲键盘。\n' +
    '「林晚（疲惫）：再撑一会儿，方案明天就要交。」\n' +
    '陈总路过看见，皱眉走了。第二天林晚桌上多了一个保温杯。\n' +
    '△ 镜头扫过保温杯上的"暖手牌"Logo。\n' +
    '「林晚（意外）：这是……？」\n' +
    '「陈总（淡淡）：暖手牌保温杯，能焖粥。胃不好就别喝凉的了。」\n' +
    '一周后，林晚的胃病再没犯。暖手牌陪她走过了每个加班夜。';
  const r = MG.screenModeGate('branded_skit', draft, 'zh');
  assert.strictEqual(r.allowed, true, '通过用例必须 allowed');
  assert.strictEqual(r.blocked.length, 0, '通过用例无 blocked');
});

test('v2.92 hot 模式：缺虚构声明+人物>3 双软警', () => {
  const draft = '林晚、陈总、小张、王姐四人围坐在会议室。\n' +
    '「林晚（愤怒）：你凭什么这么决定？」\n' +
    '「陈总（冷淡）：公司的事我说了算。」\n' +
    '「小张（犹豫）：要不……我们再商量？」\n' +
    '「王姐（无奈）：都别吵了。」\n' +
    '一场关于公司未来的争论就此展开。'.repeat(10);
  const r = MG.screenModeGate('hot', draft, 'zh');
  assert.strictEqual(r.allowed, true, 'hot 模式无硬禁，软警不拦截');
  assert.ok(r.warnings.some((h) => h.rule === 'missing_fiction_disclaimer'), '命中 missing_fiction_disclaimer');
  assert.ok(r.warnings.some((h) => h.rule === 'too_many_characters'), '命中 too_many_characters');
});

test('v2.92 hot 模式：通过用例（含虚构声明+人物≤3）', () => {
  const draft = '本剧改编自真实社会事件，剧情纯属虚构，如有雷同纯属巧合。\n' +
    '「林晚（震惊）：你说什么？」\n' +
    '「陈总（冷淡）：合同已经签了。」\n' +
    '一场关于职场权力的较量就此展开。'.repeat(10);
  const r = MG.screenModeGate('hot', draft, 'zh');
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.blocked.length, 0);
  // 虚构声明存在，不应命中 missing_fiction_disclaimer
  assert.ok(!r.warnings.some((h) => h.rule === 'missing_fiction_disclaimer'), '含虚构声明不应软警');
});

test('v2.92 双语：英文链路零中文（绝对化/医疗/投资/贬低/钩子/CTA/虚构声明 全走英文）', () => {
  // video_short 英文绝对化
  const vsEn = 'This is the best juicer, 100% cure, money-back guaranteed, number one in the world.';
  const vsR = MG.screenModeGate('video_short', vsEn, 'en');
  assert.strictEqual(vsR.allowed, false, 'EN 绝对化硬禁');
  assert.ok(!cjk(JSON.stringify(vsR.blocked)), 'video_short EN blocked 零中文');
  assert.ok(!cjk(JSON.stringify(vsR.warnings)), 'video_short EN warnings 零中文');

  // branded_skit 英文医疗
  const bsEn = 'This essential oil lowers blood pressure, anti-cancer, and is a miracle cure.';
  const bsR = MG.screenModeGate('branded_skit', bsEn, 'en');
  assert.strictEqual(bsR.allowed, false, 'EN 医疗功效硬禁');
  assert.ok(!cjk(JSON.stringify(bsR.blocked)), 'branded_skit EN blocked 零中文');

  // hot 英文缺虚构声明+人物>3
  const hotEn = '"Lin (angry): What did you say?"\n"Chen (cold): The contract is signed."\n"Zhang (hesitant): Maybe we should talk?"\n"Wang (helpless): Stop arguing."\nA battle over corporate power begins.' + ' The drama unfolds. '.repeat(20);
  const hotR = MG.screenModeGate('hot', hotEn, 'en');
  assert.ok(!cjk(JSON.stringify(hotR.warnings)), 'hot EN warnings 零中文');
  assert.ok(hotR.warnings.some((h) => h.rule === 'missing_fiction_disclaimer'), 'EN 命中 missing_fiction_disclaimer');
});

test('v2.92 默认中文：screenModeGate 不传 lang 等价于 zh', () => {
  const draft = '最好的产品，100%根治。';
  const a = MG.screenModeGate('video_short', draft);
  const b = MG.screenModeGate('video_short', draft, 'zh');
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), '默认中文逐字等价');
});

test('v2.92 纯函数：同参同果（确定性）', () => {
  const draft = '你以为榨汁杯都一样？直到我用坏第三个。' + '场景描述。'.repeat(10);
  const a = MG.screenModeGate('video_short', draft, 'zh');
  const b = MG.screenModeGate('video_short', draft, 'zh');
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), '同参同果');
});

test('v2.92 mode 别名归一：shortvideo/short_video/softad/x_script 都归一到规范 ModeId', () => {
  // 历史命名漂移归一表（与 modes.ts MODE_ALIASES 对齐）
  const shortvideo = MG.screenModeGate('shortvideo', '最好的产品100%根治', 'zh');
  const short_video = MG.screenModeGate('short_video', '最好的产品100%根治', 'zh');
  const video_short = MG.screenModeGate('video_short', '最好的产品100%根治', 'zh');
  assert.strictEqual(shortvideo.allowed, false, 'shortvideo 归一到 video_short');
  assert.strictEqual(short_video.allowed, false, 'short_video 归一到 video_short');
  assert.strictEqual(video_short.allowed, false);
  assert.strictEqual(shortvideo.blocked.length, video_short.blocked.length, '别名归一后规则一致');

  const softad = MG.screenModeGate('softad', '降血压抗癌消炎', 'zh');
  const branded_skit = MG.screenModeGate('branded_skit', '降血压抗癌消炎', 'zh');
  assert.strictEqual(softad.allowed, false, 'softad 归一到 branded_skit');
  assert.strictEqual(branded_skit.allowed, false);
});

test('v2.92 空文本：返回 allowed=true 空报告（防 NPE）', () => {
  assert.strictEqual(MG.screenModeGate('video_short', '', 'zh').allowed, true);
  assert.strictEqual(MG.screenModeGate('video_short', '   ', 'zh').allowed, true);
  assert.strictEqual(MG.screenModeGate('video_short', undefined, 'zh').allowed, true);
});

test('v2.92 词表导出：ABSOLUTE_CLAIMS/MEDICAL_CLAIMS/INVESTMENT_CLAIMS/DISPARAGE_CLAIMS 双语非空', () => {
  assert.ok(MG.ABSOLUTE_CLAIMS_ZH.length >= 10, '中文绝对化词表≥10');
  assert.ok(MG.ABSOLUTE_CLAIMS_EN.length >= 10, '英文绝对化词表≥10');
  assert.ok(MG.MEDICAL_CLAIMS_ZH.length >= 10, '中文医疗功效词表≥10');
  assert.ok(MG.MEDICAL_CLAIMS_EN.length >= 10, '英文医疗功效词表≥10');
  assert.ok(MG.INVESTMENT_CLAIMS_ZH.length >= 5, '中文投资承诺词表≥5');
  assert.ok(MG.INVESTMENT_CLAIMS_EN.length >= 5, '英文投资承诺词表≥5');
  assert.ok(MG.DISPARAGE_CLAIMS_ZH.length >= 5, '中文贬低竞品词表≥5');
  assert.ok(MG.DISPARAGE_CLAIMS_EN.length >= 5, '英文贬低竞品词表≥5');
});

/* ============== v2.96 扩展：7 种新模式软警告闸门 ============== */

test('v2.96 adapt 模式：原作引用信号软警 + 缺改编形态信号软警', () => {
  // 原作引用 + 缺改编形态
  const r1 = MG.screenModeGate('adapt', '原著中林黛玉说："你既怕我多心，何苦来？"', 'zh');
  assert.strictEqual(r1.allowed, true, '软警告不拦截');
  assert.ok(r1.warnings.some((w) => w.rule === 'source_reference_signal'), '原作引用信号');
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_adapt_form'), '缺改编形态信号');
  // 改编形态齐全 + 无原作引用 → 零警告
  const r2 = MG.screenModeGate('adapt', '本作品为续写，衍生自原世界观，但人物与情节全部重写。', 'zh');
  assert.strictEqual(r2.warnings.length, 0, '改编形态齐全+无原作引用→零警告');
  // 英文：原作引用 + 缺改编形态
  const r3 = MG.screenModeGate('adapt', 'In the novel, the protagonist says: "You must choose."', 'en');
  assert.strictEqual(r3.allowed, true);
  assert.ok(r3.warnings.some((w) => w.rule === 'source_reference_signal'));
  assert.ok(r3.warnings.some((w) => w.rule === 'missing_adapt_form'));
});

test('v2.96 novel 模式：原作引用软警 + 钩子前置软警', () => {
  // 缺钩子 + 原作引用
  const r1 = MG.screenModeGate('novel', '原著中描写道：清晨的阳光洒在窗台上，林黛玉静静地看着落花。', 'zh');
  assert.strictEqual(r1.allowed, true);
  assert.ok(r1.warnings.some((w) => w.rule === 'source_reference_signal'), '原作引用');
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_hook_frontload'), '缺钩子前置');
  // 前 200 字有钩子 + 无原作引用 → 零警告
  const r2 = MG.screenModeGate('novel', '直到那一天，她才发现一切都错了！故事从这里开始……', 'zh');
  assert.strictEqual(r2.warnings.length, 0, '钩子前置+无原作引用→零警告');
  // 英文：钩子前置
  const r3 = MG.screenModeGate('novel', 'Nobody knew the truth until that day! The story begins here.', 'en');
  assert.strictEqual(r3.warnings.length, 0, '英文钩子前置→零警告');
});

test('v2.96 hit_lab 模式：原作引用软警 + 缺峰值信号软警', () => {
  // 原作引用 + 缺峰值
  const r1 = MG.screenModeGate('hit_lab', '原作中这一段写得非常好，我们沿用它的节奏。', 'zh');
  assert.strictEqual(r1.allowed, true);
  assert.ok(r1.warnings.some((w) => w.rule === 'source_reference_signal'), '原作引用');
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_peak_signal'), '缺峰值信号');
  // 峰值信号 + 无原作引用 → 零警告
  const r2 = MG.screenModeGate('hit_lab', '这一场是全剧的高潮，名场面落在第3集。', 'zh');
  assert.strictEqual(r2.warnings.length, 0, '峰值信号+无原作引用→零警告');
  // 英文：峰值信号
  const r3 = MG.screenModeGate('hit_lab', 'This is the climax of the whole series, the signature scene lands in ep 3.', 'en');
  assert.strictEqual(r3.warnings.length, 0, '英文峰值信号→零警告');
});

test('v2.96 interview 模式：缺事实源回指软警 + 缺四维记忆空间软警', () => {
  // 缺事实源回指 + 缺四维信号
  const r1 = MG.screenModeGate('interview', '一个女医生回乡创业的故事，她要面对各种挑战。', 'zh');
  assert.strictEqual(r1.allowed, true);
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_fact_source_backref'), '缺事实源回指');
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_four_dim_memory'), '缺四维记忆空间');
  // 事实源回指 + 四维信号齐全 → 零警告
  const r2 = MG.screenModeGate('interview', '你刚才说的女主关系、时间线、场景物件、金句我都记下了。', 'zh');
  assert.strictEqual(r2.warnings.length, 0, '事实源回指+四维齐全→零警告');
  // 英文：事实源回指 + 四维
  const r3 = MG.screenModeGate('interview', 'You mentioned the relationship, timeline, scene-prop, and signature line.', 'en');
  assert.strictEqual(r3.warnings.length, 0, '英文四维齐全→零警告');
});

test('v2.96 tag 模式：缺标签落地软警 + 缺焊接桥软警', () => {
  // 缺标签落地 + 缺焊接桥
  const r1 = MG.screenModeGate('tag', '一个普通的故事，没有特别之处。', 'zh');
  assert.strictEqual(r1.allowed, true);
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_tag_landing'), '缺标签落地');
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_tag_weld_bridge'), '缺焊接桥');
  // 标签落地 + 焊接桥齐全 → 零警告
  const r2 = MG.screenModeGate('tag', '已选标签全部落地，焊接桥用"一个身份/一个秘密/一个时间节点"搭合理性桥。', 'zh');
  assert.strictEqual(r2.warnings.length, 0, '标签落地+焊接桥齐全→零警告');
  // 英文：标签 + 焊接桥
  const r3 = MG.screenModeGate('tag', 'Selected tag all landed, weld bridge uses one identity, one secret, one time node.', 'en');
  assert.strictEqual(r3.warnings.length, 0, '英文标签+焊接桥→零警告');
});

test('v2.96 film 模式：缺三幕结构软警 + 字数不达标软警', () => {
  // 缺三幕 + 字数过短
  const r1 = MG.screenModeGate('film', '一个短剧本。', 'zh');
  assert.strictEqual(r1.allowed, true);
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_three_act_structure'), '缺三幕结构');
  assert.ok(r1.warnings.some((w) => w.rule === 'word_count_too_short'), '字数过短');
  // 三幕齐全 + 字数达标 → 零警告（1400*4*3=16800 字符 + 三幕标记 15 = 16815，恰在 12000-18000 范围内）
  const longText = '第一幕建置' + '场景内容'.repeat(1400) + '第二幕对抗' + '场景内容'.repeat(1400) + '第三幕解决' + '场景内容'.repeat(1400);
  const r2 = MG.screenModeGate('film', longText, 'zh');
  assert.strictEqual(r2.warnings.length, 0, '三幕齐全+字数达标→零警告');
  // 英文：缺三幕 + 字数过短
  const r3 = MG.screenModeGate('film', 'A short script.', 'en');
  assert.strictEqual(r3.allowed, true);
  assert.ok(r3.warnings.some((w) => w.rule === 'missing_three_act_structure'));
  assert.ok(r3.warnings.some((w) => w.rule === 'word_count_too_short'));
});

test('v2.96 long_ip 模式：缺跨季信号软警 + 缺伏笔账本软警', () => {
  // 缺跨季 + 缺伏笔
  const r1 = MG.screenModeGate('long_ip', '一个普通的故事，没有连续性。', 'zh');
  assert.strictEqual(r1.allowed, true);
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_cross_season_signal'), '缺跨季信号');
  assert.ok(r1.warnings.some((w) => w.rule === 'missing_foreshadow_ledger'), '缺伏笔账本');
  // 跨季 + 伏笔齐全 → 零警告
  const r2 = MG.screenModeGate('long_ip', '上一季埋下的伏笔在本季兑付，跨季连续性明确。', 'zh');
  assert.strictEqual(r2.warnings.length, 0, '跨季+伏笔齐全→零警告');
  // 英文：跨季 + 伏笔
  const r3 = MG.screenModeGate('long_ip', 'The previous season foreshadow is paid off this season, cross-season continuity clear.', 'en');
  assert.strictEqual(r3.warnings.length, 0, '英文跨季+伏笔→零警告');
});

test('v2.96 模式归一：adapt/hit_lab/long_ip 历史命名归一到规范 ID', () => {
  // adapt 历史命名
  assert.strictEqual(MG.screenModeGate('adapt', '续写原著。', 'zh').mode, 'adapt');
  // hit_lab 历史命名（scene/reverse/viral_reverse）
  assert.strictEqual(MG.screenModeGate('scene', '原作中。', 'zh').mode, 'hit_lab');
  assert.strictEqual(MG.screenModeGate('reverse', '原作中。', 'zh').mode, 'hit_lab');
  assert.strictEqual(MG.screenModeGate('viral_reverse', '原作中。', 'zh').mode, 'hit_lab');
  // long_ip 历史命名（longip/longseries/long_series）
  assert.strictEqual(MG.screenModeGate('longip', '一个普通故事。', 'zh').mode, 'long_ip');
  assert.strictEqual(MG.screenModeGate('longseries', '一个普通故事。', 'zh').mode, 'long_ip');
  assert.strictEqual(MG.screenModeGate('long_series', '一个普通故事。', 'zh').mode, 'long_ip');
});

test('v2.327 全 canonical 模式 + 历史别名覆盖：screenModeGate 路由表完整', () => {
  // canonical 9 种模式 + 线上/历史 wire-id 别名，任一非空文本都应路由到对应 gate
  const expect = {
    video_short: 'video_short', branded_skit: 'video_short', softad: 'video_short', shortvideo: 'video_short',
    // novel 虽已在 registry 归一为 adapt，但 raw novel 仍走专属压缩闸门（钩子前置等），报告 mode 保留 novel
    hot: 'hot', adapt: 'adapt', novel: 'novel', hit_lab: 'hit_lab', scene: 'hit_lab',
    interview: 'interview', tag: 'tag', film: 'film', mature_x: 'film', long_ip: 'long_ip',
  };
  Object.entries(expect).forEach(([m, want]) => {
    const r = MG.screenModeGate(m, '一段普通文本用于路由检查', 'zh');
    assert.strictEqual(r.mode, want, `${m} 路由后 mode 字段应为 ${want}，实际 ${r.mode}`);
  });
  // interactive 不在 mode-gate 覆盖，返回空报告（allowed=true）是预期
  assert.strictEqual(MG.screenModeGate('interactive', '一段普通文本用于路由检查', 'zh').allowed, true);
});

/* ---------- v2.96 n-gram 重合度检测（真实侵权检测） ---------- */
test('v2.96 nGramOverlap 中文：成稿大段照搬原文应返回重合片段', () => {
  const source = '那年冬天特别冷，林晓第一次见到陈默是在街角的便利店门口，他穿着一件洗得发白的旧军大衣，手里攥着半块干硬的馒头。';
  const draft = '那年冬天特别冷，林晓第一次见到陈默是在街角的便利店门口，他穿着一件洗得发白的旧军大衣，手里攥着半块干硬的馒头。她站在雨里看了很久。';
  const r = MG.nGramOverlap(draft, source, 'zh');
  assert.ok(r.fragments.length >= 1, '应检测到至少 1 个重合片段');
  assert.ok(r.ratio > 0.5, `重合比例应 > 0.5，实际 ${r.ratio}`);
});

test('v2.96 nGramOverlap 中文：完全原创应返回空', () => {
  const source = '那年冬天特别冷，林晓第一次见到陈默是在街角的便利店门口。';
  const draft = '春日的午后阳光正好，苏婉推开咖啡馆的门，风铃叮咚作响。';
  const r = MG.nGramOverlap(draft, source, 'zh');
  assert.strictEqual(r.fragments.length, 0, '无重合应返回空片段');
  assert.strictEqual(r.ratio, 0, '重合比例应为 0');
});

test('v2.96 nGramOverlap 英文：词级 4-gram 重合检测', () => {
  const source = 'the quick brown fox jumps over the lazy dog every single morning';
  const draft = 'the quick brown fox jumps over the lazy dog and then runs away';
  const r = MG.nGramOverlap(draft, source, 'en');
  assert.ok(r.fragments.length >= 1, '应检测到英文重合片段');
});

test('v2.96 screenModeGate adapt+sourceText：照搬原文触发 source_text_overlap 软警', () => {
  const source = '那年冬天特别冷，林晓第一次见到陈默是在街角的便利店门口，他穿着一件洗得发白的旧军大衣。';
  const draft = '那年冬天特别冷，林晓第一次见到陈默是在街角的便利店门口，他穿着一件洗得发白的旧军大衣。本作为续写衍生。';
  const r = MG.screenModeGate('adapt', draft, 'zh', source);
  assert.strictEqual(r.allowed, true, '软警不拦截');
  assert.ok(r.warnings.some((w) => w.rule === 'source_text_overlap'), '命中 source_text_overlap 软警');
  // 证据应包含具体重合片段
  const ov = r.warnings.find((w) => w.rule === 'source_text_overlap');
  assert.ok(ov.evidence.includes('重合'), '证据应包含"重合"字样');
});

test('v2.96 screenModeGate adapt 无 sourceText：退化为原作引用关键词信号', () => {
  const draft = '原著中林晓站在雨里。本作为续写衍生。';
  const r = MG.screenModeGate('adapt', draft, 'zh');
  assert.ok(r.warnings.some((w) => w.rule === 'source_reference_signal'), '无原文时退化为关键词信号');
  assert.ok(!r.warnings.some((w) => w.rule === 'source_text_overlap'), '无原文不应触发 source_text_overlap');
});

test('v2.96 screenModeGate novel+sourceText：照搬小说原文触发重合检测', () => {
  const source = '苏晓晓从来没想过自己会穿越，更没想过一睁眼就成了将军府最不受宠的嫡女。';
  const draft = '苏晓晓从来没想过自己会穿越，更没想过一睁眼就成了将军府最不受宠的嫡女。谁知命运的齿轮才刚刚转动。';
  const r = MG.screenModeGate('novel', draft, 'zh', source);
  assert.ok(r.warnings.some((w) => w.rule === 'source_text_overlap'), 'novel 模式触发 source_text_overlap');
});

test('v2.96 screenModeGate hit_lab+sourceText：照搬爆款台词触发重合检测', () => {
  const source = '我陈默今天就算饿死，从这里跳下去，也不会吃你们一口东西！';
  const draft = '我陈默今天就算饿死，从这里跳下去，也不会吃你们一口东西！真香。名场面峰值。';
  const r = MG.screenModeGate('hit_lab', draft, 'zh', source);
  assert.ok(r.warnings.some((w) => w.rule === 'source_text_overlap'), 'hit_lab 模式触发 source_text_overlap');
});
