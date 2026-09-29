const test = require('node:test');
const assert = require('node:assert');
const { buildCastArcPage, formatCastArcLines, extractBibleCastNames, extractBibleCastArcs } = require('../dist/lib/cast-arc.js');

function zhTexts(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const pair = i % 3 === 0 ? '林晚、小刘' : '林晚、陈总';
    out.push(`第${i}集 标题\n【场景】白天/大厅/内\n【人物】${pair}\n林晚（平静）：第${i}句话。\n陈总：等着。`);
  }
  return out;
}

test('人物卡取自圣经、出场集数与对手戏由成稿真实解析', () => {
  const page = buildCastArcPage({
    characters: {
      林晚: { traits: '后发制人', voice: '平静短句', arc: '隐忍到亮明身份' },
      陈总: { traits: '自保', voice: '色厉内荏', arc: '嚣张到崩溃' },
    },
    epTexts: zhTexts(6), totalEps: 6,
  });
  assert.strictEqual(page.fromBible, true);
  const lin = page.cards.find((c) => c.name === '林晚');
  assert.strictEqual(lin.epCount, 6, '林晚6集全出场');
  const chen = page.cards.find((c) => c.name === '陈总');
  assert.strictEqual(chen.epCount, 6, '陈总每集都有台词，提及出场6集');
  const top = page.pairs[0];
  assert.strictEqual(top.a, '林晚'); assert.strictEqual(top.b, '陈总');
  assert.strictEqual(top.eps.length, 4, '同场共现只按场头算，第3/6集场头无陈总');
  assert.strictEqual(lin.topPartner, '陈总');
});

test('成长阶段线：确定性、五段封顶、每集都有阶段', () => {
  const a = buildCastArcPage({ epTexts: zhTexts(8), totalEps: 8 });
  const b = buildCastArcPage({ epTexts: zhTexts(8), totalEps: 8 });
  assert.strictEqual(a.growth.length, 8);
  assert.deepStrictEqual(a.growth.map((g) => g.stage), b.growth.map((g) => g.stage), '同输入确定');
  a.growth.forEach((g) => assert.ok(g.stage >= 0 && g.stage <= 4));
  assert.ok(a.growth[a.growth.length - 1].stage >= a.growth[0].stage, '阶段单调不减');
});

test('中文行包含人物卡/关系轴/成长曲线三部分', () => {
  const page = buildCastArcPage({
    characters: { 林晚: { traits: '后发制人', voice: '平静', arc: '亮明身份' }, 陈总: { voice: '摆架子', arc: '崩溃' } },
    epTexts: zhTexts(4), totalEps: 4,
  });
  const L = formatCastArcLines(page, 'zh');
  assert.ok(L.head[0].includes('人物表与成长弧'));
  assert.ok(L.cards.some((x) => x.includes('林晚') && x.includes('隐性设定')));
  assert.ok(L.relations.some((x) => x.includes('对手戏关系轴')));
  assert.ok(L.growth.some((x) => /第1集 [①②③④⑤]/.test(x)));
});

test('英文层零中文，且英文名内部空格不被切碎（Lin Wan / Mr. Chen）', () => {
  const texts = [];
  for (let i = 1; i <= 4; i++) {
    texts.push(`Episode ${i}\n[Characters] Lin Wan, Mr. Chen\nLin Wan: line ${i}.\nMr. Chen: wait.`);
  }
  const page = buildCastArcPage({
    characters: { 'Lin Wan': { traits: 'strike second', voice: 'calm', arc: 'cleaner to owner' } },
    epTexts: texts, totalEps: 4,
  });
  assert.ok(page.cards.some((c) => c.name === 'Lin Wan'));
  assert.ok(page.cards.some((c) => c.name === 'Mr. Chen'), 'Mr. Chen 完整保留');
  const L = formatCastArcLines(page, 'en');
  const all = L.head.concat(L.cards, L.relations, L.growth);
  assert.deepStrictEqual(all.filter((x) => /[一-鿿]/.test(x)), []);
  assert.ok(L.growth[0].includes('Lin Wan'));
});

test('无圣经时由成稿解析人物并诚实标注，空文本不炸', () => {
  const page = buildCastArcPage({ epTexts: zhTexts(3), totalEps: 3 });
  assert.strictEqual(page.fromBible, false);
  assert.ok(page.characterCount >= 2);
  const empty = buildCastArcPage({ epTexts: ['', ''], totalEps: 2 });
  assert.strictEqual(empty.characterCount, 0);
  const L = formatCastArcLines(empty, 'zh');
  assert.strictEqual(L.growth.length, 2, '即使解析不到人，成长线仍按集数输出');
});

test('超24集成长线全列（成长阶段不截断，最多10人物/6关系轴）', () => {
  const page = buildCastArcPage({ epTexts: zhTexts(30), totalEps: 30 });
  assert.strictEqual(page.growth.length, 30);
  assert.ok(page.cards.length <= 10);
  assert.ok(page.pairs.length <= 6);
});

// v2.192 c192 Json 读取不信任铁律（c191 立）主动扫查：人物页是 bible.characters 的另一消费方，
// 旧代码半截守卫 (c.traits || '').trim() 对 truthy 非字符串（123/[]/{}）抛 TypeError，
// 外层 try/catch 吞错后整页人物表静默丢失——毒丸形态是"页面蒸发"而非 500。
test('c192 bible.characters 为 null/原始值时不抛错，人物仍由成稿解析', () => {
  const pNull = buildCastArcPage({ characters: null, epTexts: zhTexts(3), totalEps: 3 });
  assert.strictEqual(pNull.fromBible, false);
  assert.ok(pNull.cards.some((c) => c.name === '林晚'), 'null 圣经不阻断成稿解析');
  // 字符串形态：旧代码在 "x in bibleChars" 处对原始值用 in 抛 TypeError
  const pStr = buildCastArcPage({ characters: 'abc', epTexts: zhTexts(3), totalEps: 3 });
  assert.strictEqual(pStr.fromBible, false);
  assert.ok(pStr.cards.some((c) => c.name === '林晚'));
});

test('c192 bible.characters 数组形态（[{name,...}]）归一识别，与沉淀入口三形态同口径', () => {
  const page = buildCastArcPage({
    characters: [{ name: '林晚', traits: '冷静后发', voice: '平静短句', arc: '隐忍到亮牌' }],
    epTexts: zhTexts(3), totalEps: 3,
  });
  assert.strictEqual(page.fromBible, true, '数组形态是有效圣经');
  const lin = page.cards.find((c) => c.name === '林晚');
  assert.ok(lin, '数组条目的 name 键被归一识别');
  assert.strictEqual(lin.traits, '冷静后发');
  assert.strictEqual(lin.voice, '平静短句');
  assert.strictEqual(lin.arc, '隐忍到亮牌');
});

test('c192 毒丸隔离：畸形角色与合法角色同批，不抛错且合法卡完整、畸形者降级为纯成稿解析', () => {
  // 成稿里林晚与恶角都出场；圣经中恶角三字段全畸形（number/array/boolean），串角条目本身是原始值
  const texts = [
    '第1集\n【人物】林晚、恶角\n林晚（平静）：收手吧。\n恶角（嚣张）：做梦。',
    '第2集\n【人物】林晚、恶角\n林晚：等着。\n恶角：哼。',
  ];
  const page = buildCastArcPage({
    characters: {
      林晚: { traits: '冷静后发', voice: '平静短句', arc: '隐忍到亮牌' },
      恶角: { traits: 123, arc: ['黑化', '崩溃'], voice: true },
      串角: '我是字符串不是对象',
    },
    epTexts: texts, totalEps: 2,
  });
  const lin = page.cards.find((c) => c.name === '林晚');
  assert.ok(lin, '合法角色不被毒丸连坐');
  assert.strictEqual(lin.traits, '冷静后发');
  assert.strictEqual(lin.voice, '平静短句');
  assert.strictEqual(lin.arc, '隐忍到亮牌');
  const evil = page.cards.find((c) => c.name === '恶角');
  assert.ok(evil, '畸形圣经角色仍可凭成稿出场解析上卡');
  assert.strictEqual(evil.traits, '', '畸形字段视同缺失，绝不字符串化 123');
  assert.strictEqual(evil.arc, '');
  assert.strictEqual(evil.voice, '');
  assert.ok(!page.cards.some((c) => c.name === '串角' || c.name === '0'), '原始值条目不产出垃圾卡');
});

// v2.193 c193 复盘：生成路由配角在场台账的名表提取旧码只认数组形态，而 pipeline 主路径
// 回写的是对象形态（pipeline.ts bible.characters[name]={...}）→ 第 2 集起名表恒空、
// 在场/关系线台账静默失效。抽出纯函数并支持对象/数组/JSON 字符串三形态。
test('c193 extractBibleCastNames 对象形态（pipeline 回写主形态）→ 返回键名，旧码此形态恒空', () => {
  assert.strictEqual(typeof extractBibleCastNames, 'function', '函数须导出');
  const names = extractBibleCastNames({ '林晚': { traits: '稳' }, '陈总': { voice: '沉' } });
  assert.deepStrictEqual(names.sort(), ['林晚', '陈总']);
});

test('c193 extractBibleCastNames 数组形态（立项解析）→ 取 name 字段；字符串元素直接当名', () => {
  const names = extractBibleCastNames([{ name: '林晚' }, '陈总', { name: '阿紫' }]);
  assert.deepStrictEqual(names.sort(), ['林晚', '阿紫', '陈总']);
});

test('c193 extractBibleCastNames JSON 字符串形态（老库序列化）→ parse 后归一；非法 JSON 视同无', () => {
  assert.deepStrictEqual(extractBibleCastNames(JSON.stringify([{ name: '林晚' }])), ['林晚']);
  assert.deepStrictEqual(extractBibleCastNames(JSON.stringify({ 林晚: {} })), ['林晚']);
  assert.deepStrictEqual(extractBibleCastNames('{bad json'), []);
});

test('c193 extractBibleCastNames 畸形防御：null/原始值/非对象条目/非字符串名一律丢弃', () => {
  assert.deepStrictEqual(extractBibleCastNames(null), []);
  assert.deepStrictEqual(extractBibleCastNames(123), []);
  assert.deepStrictEqual(extractBibleCastNames([null, 42, { name: 123 }, { name: ' ' }, { name: '林晚' }]), ['林晚']);
});

test('c193 extractBibleCastNames 长度窗 ≥2≤12、去重、cap 20（与生成路由旧注释口径一致）', () => {
  assert.deepStrictEqual(extractBibleCastNames({ '林': {}, '林晚': {} }), ['林晚']);
  const long = '超长角色名十二字以上不收哦哦哦';
  assert.deepStrictEqual(extractBibleCastNames({ [long]: {}, '林晚': {} }), ['林晚']);
  const many = {}; for (let i = 0; i < 25; i++) many[`角色${String(i).padStart(2, '0')}`] = {};
  assert.strictEqual(extractBibleCastNames(many).length, 20, 'cap 20 控提示词预算');
});

// v2.194 c194 复盘（与 c193 同根）：prevArc 圣经重算回退旧码 for...of 直接迭代 b.characters，
// 对象形态（pipeline 主回写形态）抛 not iterable，被外层 try/catch 吞掉 → castNames 恒空 →
// 回退对主形态结构性死代码，前集弧光在 qcReport 缺失时静默不跟踪。
test('c194 extractBibleCastArcs 对象形态（pipeline 主形态）→ 键名取弧光，旧 for...of 此形态直接抛错', () => {
  assert.strictEqual(typeof extractBibleCastArcs, 'function', '函数须导出');
  const arcs = extractBibleCastArcs({ 林晚: { arc: '隐忍到亮明', voice: '平静' }, 陈总: { arc: '嚣张到崩溃' } });
  assert.deepStrictEqual(arcs, { 林晚: '隐忍到亮明', 陈总: '嚣张到崩溃' });
});

test('c194 extractBibleCastArcs 数组形态 → name 取键，arc 缺失回退 role（保留旧码口径）', () => {
  assert.deepStrictEqual(
    extractBibleCastArcs([{ name: '林晚', arc: '亮牌' }, { name: '陈总', role: '反派' }, { name: '阿紫' }]),
    { 林晚: '亮牌', 陈总: '反派', 阿紫: '' },
  );
});

test('c194 extractBibleCastArcs JSON 字符串两形态均可；非法 JSON 视同无', () => {
  assert.deepStrictEqual(extractBibleCastArcs(JSON.stringify({ 林晚: { arc: '反击' } })), { 林晚: '反击' });
  assert.deepStrictEqual(extractBibleCastArcs(JSON.stringify([{ name: '陈总', role: '对手' }])), { 陈总: '对手' });
  assert.deepStrictEqual(extractBibleCastArcs('{坏'), {});
});

test('c194 extractBibleCastArcs 畸形防御：null/原始值/非字符串 arc 视同缺失，键名 trim，不抛错', () => {
  assert.deepStrictEqual(extractBibleCastArcs(null), {});
  assert.deepStrictEqual(extractBibleCastArcs(123), {});
  assert.deepStrictEqual(extractBibleCastArcs({ ' 林晚 ': { arc: 123 }, 陈总: '原始值' }), { 林晚: '', 陈总: '' });
  assert.deepStrictEqual(extractBibleCastArcs([null, 42, { name: '林晚', arc: ['黑化'] }, { name: 9 }]), { 林晚: '' });
});
