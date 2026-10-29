const test = require('node:test');
const assert = require('node:assert');

// v2.351 数值/事实穿帮检测（Fact Consistency Check）
// 盲区坐实：continuity-supervision 只管「物理状态穿帮」（死了又活/伤了又好），
// 不管「数值口径穿帮」——「借50万后文变500万」「25岁变30岁」这类同主体同属性数值
// 前后矛盾，观众一秒出戏，真人/AIGC 双制式通用，且全引擎零覆盖。
// 分工边界：
//  - timeline-ledger：跨集时间线（时刻/日期顺序），故本引擎不收「点」、跳过日历年(19xx/20xx+年)；
//  - continuity-supervision：物理状态（生死/伤势），不管数值；
//  - script-format：字数带闸门，不管语义；
//  - 本引擎：同槽（名词片段+量词类）出现 ≥2 个不同归一值 → high fact_number_conflict。
// 控误报三闸门：场标行剔除 / 第X序数跳过 / 裸数字无名词槽不参与比对。

const { factConsistencyCheck } = require('../dist/engine/fact-consistency-check');

// —— 样例：健康稿（50万×3 同值提及、55岁一处）——
const HEALTHY = `第1集 筹钱
△医院走廊，林晚攥着诊断书。
医生（叹气）：手术费要50万，一周内交齐。
林晚（坚定）：这50万我想办法，一定凑齐。
△她拨通母亲电话。
林晚（哽咽）：妈，手术费50万，我把房子挂出去了。
母亲（心疼）：孩子，妈这里还有养老钱。
△林晚摇头拒绝，转身走进电梯。
△电梯门合上，她靠着墙滑坐在地。
林晚（自语）：父亲今年55岁，不能放弃。
△夜色深沉，医院灯火通明。`;

// —— 样例：金额矛盾稿（手术费 50万 vs 500万）——
const CONFLICT_AMOUNT = `第2集 变故
△病房外，林晚和哥哥争吵。
林晚（急）：医生说了，手术费50万，不能再拖。
哥哥（躲闪）：50万太多了，家里拿不出。
△林晚愣住，盯着哥哥。
林晚（质疑）：你昨天明明说手术费500万都借到了！
哥哥（心虚）：我……我记错了。
△林晚后退一步，心如死灰。`;

// —— 样例：年龄矛盾稿（母亲 25岁 vs 30岁）——
const CONFLICT_AGE = `第3集 身世
△档案室里，林晚翻看旧报纸。
林晚（喃喃）：母亲25岁那年生下了我。
△她翻到另一页，手指僵住。
林晚（震惊）：这上面写母亲30岁才有的我，到底哪句是真的？
△她合上报纸，心跳如鼓。`;

// —— 样例：中文数字归一（两百块=200块、三万五=35000元，不冲突）——
const CN_NORMALIZED = `第4集 红包
△婚礼现场，宾客满座。
司仪（高声）：改口费是两百块，图个吉利！
△台下哄笑。
伴娘（小声）：改口费明明200块，我刚才看见了。
司仪（补充）：彩礼三万五，一分不少。
伴娘（撇嘴）：彩礼35000元还嫌少。
△新郎尴尬地挠头，赶紧打圆场。`;

// —— 样例：场标编号稿（第1集…第12集 + 无数字正文）——
const HEADERS_ONLY = `第1集 初遇
△咖啡厅，午后阳光正好。
第2集 相知
△两人并肩走在江边。
第3集 误会
△她转身离去。
第4集 重逢
△雨夜，他撑伞等候。
第5集 告白
△烟花照亮夜空。
第6集 阻挠
△长辈拍桌反对。
第7集 私奔
△火车站台，汽笛长鸣。
第8集 打拼
△出租屋里泡面飘香。
第9集 危机
△公司濒临倒闭。
第10集 反转
△真相浮出水面。
第11集 和解
△两家人握手言和。
第12集 团圆
△婚礼进行曲响起。`;

// —— 样例：时刻稿（3点/5点/9点，时刻归 timeline-ledger 管，不报）——
const TIME_OF_DAY = `第5集 等待
△下午3点，林晚到达民政局门口。
△她等到5点，丈夫还没出现。
△晚上9点，她独自离开，雨越下越大。`;

// —— 样例：裸数字无名词槽（50万/500万 前后皆无名词，不参与比对）——
const BARE_NUMBERS = `第6集 数字
△桌上摆着50万。
△箱子里装着500万。
△两人对视，沉默不语。
△窗外雷声滚滚。`;

// —— 样例：五槽全冲突稿（5 个冲突对，分数 clamp 到 0）——
const MULTI_CONFLICT = `第7集 清算
△律师楼，两人对账。
律师：手术费50万。
林晚：不对，手术费500万。
律师：彩礼8万。
林晚：彩礼18万。
律师：押金两千块。
林晚：押金五千块。
律师：学费3万。
林晚：学费9万。
律师：房租3000块。
林晚：房租8000块。
△双方争执不下。`;

// —— 样例：冲突对去重稿（8万×3 处、18万×1 处，仍只 1 个冲突对）——
const DEDUP_PAIRS = `第8集 重复
△媒人上门提亲。
媒人：彩礼8万，童叟无欺。
林母：8万太少。
△次日媒人改口。
媒人：彩礼涨到18万，爱结不结。
林母：不是说好8万吗？！
△双方不欢而散。`;

// —— 样例：三值冲突稿（8万/18万/80万 → 3 个冲突对）——
const THREE_VALUES = `第9集 变卦
△媒人再次上门。
媒人：彩礼8万，一口价。
林母：彩礼不是18万吗？
媒人：现在行情彩礼80万。
△林母当场晕厥。`;

// —— 样例：领域豁免稿（日历年 2024/2025 + 序数 第3次/第5次，均不报）——
const DOMAIN_EXCLUDED = `第10集 穿越
△故事发生在2024年春天。
△他意外穿越到2025年。
△第3次穿越失败了。
△第5次尝试终于成功。
△他望着陌生的城市发呆。`;

// —— 样例：EN 金额矛盾稿（surgery fee 50 thousand vs 500 thousand）——
const EN_CONFLICT = `EPISODE 10
Lin Wan checks the hospital bill at the counter.
Lin Wan (worried): The surgery fee is 50 thousand, we must pay this week.
Doctor (nodding): Yes, the bill says so.
Lin Wan (shocked): But yesterday you said the surgery fee is 500 thousand!
Doctor (nervous): I must have misremembered the number.
She steps back, her heart sinking fast.`;

test('v2.351 健康稿（同值多次提及）不误报', () => {
  const r = factConsistencyCheck(HEALTHY, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
  assert.ok(r.slotCount >= 2, `slotCount ${r.slotCount} should >= 2 (手术费/父亲年龄)`);
});

test('v2.351 金额矛盾（手术费50万 vs 500万）报 high', () => {
  const r = factConsistencyCheck(CONFLICT_AMOUNT, 'zh');
  assert.strictEqual(r.conflictCount, 1);
  assert.strictEqual(r.score, 78); // 100 - 22
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.issues[0].type, 'fact_number_conflict');
  assert.ok(r.issues[0].evidence.includes('手术费'));
  assert.ok(r.issues[0].evidence.includes('50万'));
  assert.ok(r.issues[0].evidence.includes('500万'));
});

test('v2.351 年龄矛盾（母亲25岁 vs 30岁）报 high', () => {
  const r = factConsistencyCheck(CONFLICT_AGE, 'zh');
  assert.strictEqual(r.conflictCount, 1);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.ok(r.issues[0].evidence.includes('25岁'));
  assert.ok(r.issues[0].evidence.includes('30岁'));
});

test('v2.351 中文数字归一（两百块=200块、三万五=35000元）不冲突', () => {
  const r = factConsistencyCheck(CN_NORMALIZED, 'zh');
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.slotCount, 2); // 改口费 + 彩礼
});

test('v2.351 场标编号（第1集…第12集）不误报', () => {
  const r = factConsistencyCheck(HEADERS_ONLY, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.slotCount, 0);
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.score, 100);
});

test('v2.351 时刻（3点/5点/9点）不提取不报', () => {
  const r = factConsistencyCheck(TIME_OF_DAY, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.slotCount, 0);
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.score, 100);
});

test('v2.351 裸数字无名词槽（50万/500万 无邻近名词）不参与比对', () => {
  const r = factConsistencyCheck(BARE_NUMBERS, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.slotCount, 0);
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.score, 100);
});

test('v2.351 空稿满分放行（checked=false）', () => {
  const r = factConsistencyCheck('', 'zh');
  assert.strictEqual(r.checked, false);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.slotCount, 0);
  assert.strictEqual(r.conflictCount, 0);
});

test('v2.351 畸形输入不崩溃（null/undefined/纯空白）', () => {
  const r1 = factConsistencyCheck(null, 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.checked, false);
  const r2 = factConsistencyCheck(undefined, 'zh');
  assert.strictEqual(r2.score, 100);
  const r3 = factConsistencyCheck('   \n  \n  ', 'zh');
  assert.strictEqual(r3.checked, false);
  assert.strictEqual(r3.score, 100);
});

test('v2.351 结构字段齐全（score/checked/slotCount/conflictCount/issues）', () => {
  const r = factConsistencyCheck(CONFLICT_AMOUNT, 'zh');
  assert.ok(typeof r.score === 'number');
  assert.ok(typeof r.checked === 'boolean');
  assert.ok(typeof r.slotCount === 'number');
  assert.ok(typeof r.conflictCount === 'number');
  assert.ok(Array.isArray(r.issues));
  const it = r.issues[0];
  assert.ok(typeof it.severity === 'string');
  assert.ok(typeof it.type === 'string');
  assert.ok(typeof it.evidence === 'string' && it.evidence.length > 0);
  assert.ok(typeof it.advice === 'string' && it.advice.length > 0);
});

test('v2.351 score 恒在 0-100 区间（含五冲突 clamp 到 0）', () => {
  const samples = [HEALTHY, CONFLICT_AMOUNT, CONFLICT_AGE, MULTI_CONFLICT, ''];
  for (const s of samples) {
    const r = factConsistencyCheck(s, 'zh');
    assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} out of range`);
  }
  const r = factConsistencyCheck(MULTI_CONFLICT, 'zh');
  assert.strictEqual(r.conflictCount, 5);
  assert.strictEqual(r.score, 0); // 100 - 22*5 = -10 → clamp 0
});

test('v2.351 EN 链路（surgery fee 50 thousand vs 500 thousand）报 high 且英文文案零中文', () => {
  const r = factConsistencyCheck(EN_CONFLICT, 'en');
  assert.strictEqual(r.conflictCount, 1);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.ok(/surgery fee/i.test(r.issues[0].evidence));
  assert.ok(r.issues[0].evidence.includes('50 thousand'));
  assert.ok(r.issues[0].evidence.includes('500 thousand'));
  assert.ok(!/[一-龥]/.test(r.issues[0].advice), 'EN advice must contain no Chinese');
  assert.ok(!/[一-龥]/.test(r.issues[0].evidence), 'EN evidence must contain no Chinese');
});

test('v2.351 跨行冲突 evidence 含两处原文行与数值', () => {
  const r = factConsistencyCheck(CONFLICT_AMOUNT, 'zh');
  const ev = r.issues[0].evidence;
  assert.ok(ev.includes('手术费50万'), 'evidence should contain first line snippet');
  assert.ok(ev.includes('手术费500万'), 'evidence should contain second line snippet');
  assert.ok(ev.includes('第3行') || ev.includes('行'), 'evidence should carry line info');
});

test('v2.351 冲突对去重（8万×3 处 vs 18万×1 处 = 1 个冲突对）', () => {
  const r = factConsistencyCheck(DEDUP_PAIRS, 'zh');
  assert.strictEqual(r.conflictCount, 1);
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.score, 78);
});

test('v2.351 三值冲突（8万/18万/80万）按冲突对计 3 对', () => {
  const r = factConsistencyCheck(THREE_VALUES, 'zh');
  assert.strictEqual(r.conflictCount, 3);
  assert.strictEqual(r.issues.length, 3);
  assert.strictEqual(r.score, 34); // 100 - 22*3
});

test('v2.351 领域豁免（日历年 2024/2025、序数 第3次/第5次）不报', () => {
  const r = factConsistencyCheck(DOMAIN_EXCLUDED, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.slotCount, 0);
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.score, 100);
});
