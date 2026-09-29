const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildProductionMaterials, formatMaterialsLines, buildSceneBreakdown, formatMatrixLines } = require('../dist/engine/production-materials.js');

// 三集成稿样本：覆盖场头（内外景/日夜）、说话人（含情绪提示/旁白噪音）、信物（ planting→closed）
const EP1 = [
  '内景 餐厅 夜',
  '林昭（低声）：查。',
  '林昭：这案子不会说谎，人才会说谎。',
  '陈默：你不该回来的吧？',
  '△雨夜老巷，路灯忽明忽暗。',
  '旁白：深夜的城市仍在呼吸。',
  '玉佩在他掌心发烫。',
].join('\n');
const EP2 = [
  '外景 老巷 夜',
  '林昭：明天提审。',
  '林昭：嗯，得走完这一趟。',
  '林昭：冷不冷都得走。',
  '陈默：走吧。',
  '玉佩摔碎在地上。',
].join('\n');
const EP3 = [
  '内景 餐厅 日',
  '陈默：这案子，到此为止。',
].join('\n');

describe('制作物料引擎·聚合 buildProductionMaterials', () => {
  it('空输入全空，不抛错', () => {
    const m = buildProductionMaterials([]);
    assert.strictEqual(m.scenes.length, 0);
    assert.strictEqual(m.cast.length, 0);
    assert.strictEqual(m.props.length, 0);
    assert.strictEqual(m.stats.epCount, 0);
    const m2 = buildProductionMaterials([{ ep: 1, content: '' }, { ep: NaN, content: 'x' }]);
    assert.strictEqual(m2.stats.epCount, 1, '非法集号(NaN)丢弃；空正文仍是合法集，计入集数但产不出行');
  });

  it('场景总表：内外景前缀归一、日夜分行、跨集聚合、地点去重', () => {
    const m = buildProductionMaterials([
      { ep: 1, content: EP1 }, { ep: 2, content: EP2 }, { ep: 3, content: EP3 },
    ]);
    assert.strictEqual(m.stats.sceneCount, 3);
    assert.strictEqual(m.stats.uniqueLocations, 2, '餐厅/老巷 两个地点');
    const rest = m.scenes.find((s) => s.location === '餐厅' && s.timeOfDay === '夜');
    assert.ok(rest, '内景·餐厅·夜 成行');
    assert.strictEqual(rest.intExt, '内');
    assert.deepStrictEqual(rest.eps, [1]);
    const alley = m.scenes.find((s) => s.location === '老巷');
    assert.ok(alley && alley.intExt === '外' && alley.timeOfDay === '夜', '外景·老巷·夜 成行');
    const day = m.scenes.find((s) => s.location === '餐厅' && s.timeOfDay === '日');
    assert.ok(day, '同地点不同时间分行（餐厅·日）');
    assert.strictEqual(m.scenes.length, 3, '日夜分行后 3 行');
  });

  it('场景跨集合并：同场景头重复出现 → eps 升序 + count 累加，按场次降序排第一', () => {
    const m = buildProductionMaterials([
      { ep: 1, content: '内景 餐厅 夜\n甲：一。' },
      { ep: 2, content: '内景 餐厅 夜\n乙：二。\n内景 餐厅 夜\n甲：三。' },
    ]);
    assert.strictEqual(m.scenes.length, 1);
    assert.strictEqual(m.scenes[0].count, 3, '1+2 场次累加');
    assert.deepStrictEqual(m.scenes[0].eps, [1, 2]);
    assert.strictEqual(m.scenes[0].location, '餐厅');
  });

  it('时间未标注兜底"未标注"，无具体地点的场头不进总表', () => {
    const m = buildProductionMaterials([{ ep: 1, content: '内景 天台\n甲：风好大。' }]);
    assert.strictEqual(m.scenes.length, 1);
    assert.strictEqual(m.scenes[0].timeOfDay, '未标注');
    const m2 = buildProductionMaterials([{ ep: 1, content: '内景\n甲：在室内。' }]);
    assert.strictEqual(m2.scenes.length, 0, '仅"内景"无地点 → 跳过');
  });

  it('角色出场表：说话人计数、旁白剔除、跨集出场合并、按台词量降序', () => {
    const m = buildProductionMaterials([
      { ep: 1, content: EP1 }, { ep: 2, content: EP2 }, { ep: 3, content: EP3 },
    ]);
    assert.strictEqual(m.stats.castCount, 2, '旁白不计入');
    assert.ok(!m.cast.some((c) => c.name === '旁白'), '旁白剔除');
    const lin = m.cast.find((c) => c.name === '林昭');
    assert.ok(lin);
    assert.strictEqual(lin.lines, 5, '2+3 句');
    assert.deepStrictEqual(lin.eps, [1, 2]);
    const chen = m.cast.find((c) => c.name === '陈默');
    assert.strictEqual(chen.lines, 3);
    assert.deepStrictEqual(chen.eps, [1, 2, 3]);
    assert.strictEqual(m.cast[0].name, '林昭', '按台词量降序');
  });

  it('道具总表：信物跨集聚合 + 销毁封禁态', () => {
    const m = buildProductionMaterials([
      { ep: 1, content: EP1 }, { ep: 2, content: EP2 },
    ]);
    assert.strictEqual(m.props.length, 1);
    const jade = m.props[0];
    assert.strictEqual(jade.name, '玉佩');
    assert.deepStrictEqual(jade.eps, [1, 2]);
    assert.strictEqual(jade.closed, true, '第2集"摔碎"触发封禁');
  });

  it('无场头但有无台词的正文：场景空、角色仍可解析（容错）', () => {
    const m = buildProductionMaterials([{ ep: 1, content: '△一场没有场头的戏。\n林昭：走。' }]);
    assert.strictEqual(m.scenes.length, 0);
    assert.strictEqual(m.cast.length, 1);
  });
});

describe('制作物料引擎·文本行 formatMaterialsLines', () => {
  const m = buildProductionMaterials([
    { ep: 1, content: EP1 }, { ep: 2, content: EP2 }, { ep: 3, content: EP3 },
  ]);

  it('中文行：三段小节头 + 场景/角色/道具行', () => {
    const lines = formatMaterialsLines(m, 'zh');
    const text = lines.join('\n');
    assert.ok(text.includes('▸ 场景总表（3 场 / 2 个地点'));
    assert.ok(text.includes('内景·餐厅·夜 — 共1场（第1集）'), '内外景前缀归一渲染');
    assert.ok(text.includes('▸ 角色出场表（2 人'));
    assert.ok(text.includes('林昭 — 5句台词，出场第1集/第2集'));
    assert.ok(text.includes('▸ 道具总表（1 类'));
    assert.ok(text.includes('玉佩 — 第1集/第2集提及'));
    assert.ok(text.includes('已封禁'), '封禁态标注');
  });

  it('英文行：零中文系统文案（人名/地名透传）', () => {
    const lines = formatMaterialsLines(m, 'en');
    const text = lines.join('\n');
    assert.ok(text.includes('Scene Sheet'));
    assert.ok(text.includes('Cast Sheet'));
    assert.ok(text.includes('Prop Sheet'));
    assert.ok(text.includes('林昭'), '人名透传');
    assert.ok(!text.includes('▸ 场'), '系统文案零中文');
  });

  it('空物料渲染兜底提示行', () => {
    const empty = buildProductionMaterials([]);
    const lines = formatMaterialsLines(empty, 'zh');
    assert.ok(lines.some((l) => l.includes('无合规场头')));
    assert.ok(lines.some((l) => l.includes('无台词行')));
    assert.ok(lines.some((l) => l.includes('无关键信物')));
  });

  it('cap 截断：超限行数折叠为"详见 JSON 端点"提示', () => {
    const many = buildProductionMaterials([
      { ep: 1, content: ['内景 地点甲 夜', '内景 地点乙 夜', '内景 地点丙 夜'].join('\n') },
    ]);
    const lines = formatMaterialsLines(many, 'zh', { scenes: 2, cast: 20, props: 30 });
    assert.ok(lines.some((l) => l.includes('其余 1 条场景详见 JSON 端点')), '渲染行折叠');
    assert.ok(!lines.some((l) => l.includes('地点丙')), '被截断行不出现');
  });
});

// ==================== v2.157 场头合规率 ====================
describe('制作物料引擎·场头合规率 stats.headerRate', () => {
  it('合规率 = 合规场头/识别场头（bare_cn 与 live_cn 均为合法口径，缺时间不合规）', () => {
    const m = buildProductionMaterials([
      { ep: 1, content: ['场景1：餐厅·夜', '林昭：查。', '内景 老宅·日', '陈默：嗯。', '场景3：天台'].join('\n') },
    ]);
    assert.strictEqual(m.stats.headerTotal, 3, '三个场头全部识别');
    assert.strictEqual(m.stats.headerValid, 2, '「场景3：天台」缺时间标注不合规');
    assert.strictEqual(m.stats.headerRate, 67, '2/3 四舍五入 → 67%');
  });

  it('无场头时 headerRate=0 不抛错；文本行场景总表标题渲染合规率', () => {
    const m = buildProductionMaterials([{ ep: 1, content: '△没有场头的戏。\n林昭：走。' }]);
    assert.strictEqual(m.stats.headerTotal, 0);
    assert.strictEqual(m.stats.headerValid, 0);
    assert.strictEqual(m.stats.headerRate, 0);
    const lines = formatMaterialsLines(m, 'zh');
    assert.ok(lines[0].includes('场头合规率 0%'), `首行=${lines[0]}`);
    const en = formatMaterialsLines(buildProductionMaterials([{ ep: 1, content: 'INT. Cafe - NIGHT\nAmy: Hi.' }]), 'en');
    assert.ok(en[0].includes('header pass rate 100%'), `en首行=${en[0]}`);
  });
});

// ==================== v2.155 场景明细矩阵 ====================
describe('制作物料引擎·场景明细 buildSceneBreakdown', () => {
  it('逐集逐场明细：场块切分、块内角色/信物/字数、场号顺序', () => {
    const sb = buildSceneBreakdown([
      { ep: 1, content: EP1 }, { ep: 2, content: EP2 }, { ep: 3, content: EP3 },
    ]);
    assert.strictEqual(sb.details.length, 3, '三集各一场');
    const d1 = sb.details[0];
    assert.strictEqual(d1.ep, 1);
    assert.strictEqual(d1.sceneNo, 1);
    assert.strictEqual(d1.intExt, '内');
    assert.strictEqual(d1.location, '餐厅');
    assert.strictEqual(d1.timeOfDay, '夜');
    assert.deepStrictEqual(d1.cast, [{ name: '林昭', lines: 2 }, { name: '陈默', lines: 1 }], '块内角色台词量降序、旁白剔除');
    assert.deepStrictEqual(d1.props, ['玉佩'], '块内信物出现序');
    assert.ok(d1.charCount > 0 && typeof d1.charCount === 'number', '场块净字符数');
    const d2 = sb.details[1];
    assert.strictEqual(d2.intExt, '外');
    assert.strictEqual(d2.location, '老巷');
    assert.deepStrictEqual(d2.cast, [{ name: '林昭', lines: 3 }, { name: '陈默', lines: 1 }]);
  });

  it('场块边界：首场头前的序章行跳过；多场头按行切分互不串块', () => {
    const content = [
      '△序章：这是场头之前的引子，不应计入任何场块。',
      '林昭：序章里我也说句话。',
      '内景 餐厅 夜',
      '林昭：一场戏。',
      '外景 老巷 夜',
      '陈默：二场戏。',
    ].join('\n');
    const sb = buildSceneBreakdown([{ ep: 1, content }]);
    assert.strictEqual(sb.details.length, 2);
    assert.deepStrictEqual(sb.details[0].cast, [{ name: '林昭', lines: 1 }], '一场块不含序章台词');
    assert.deepStrictEqual(sb.details[1].cast, [{ name: '陈默', lines: 1 }], '二场块不含一场台词');
    assert.strictEqual(sb.details[0].sceneNo, 1);
    assert.strictEqual(sb.details[1].sceneNo, 2);
  });

  it('场景生图提示词：场景空镜描述兜底；注入 stylePrompt 时英文画风段置前', () => {
    const sb = buildSceneBreakdown([{ ep: 1, content: EP1 }]);
    assert.strictEqual(sb.details[0].prompt, '餐厅（内景，夜），空镜环境参考图');
    const sb2 = buildSceneBreakdown([{ ep: 1, content: EP1 }], { stylePrompt: 'Moody noir, cinematic' });
    assert.strictEqual(sb2.details[0].prompt, 'Moody noir, cinematic, 餐厅（内景，夜），空镜环境参考图', '英文画风段置前（v2.148 注入顺序约定）');
  });

  it('容错：非法集号丢弃；无场头/空正文不产出；仅"内景"无地点跳过（与总表同口径）', () => {
    assert.deepStrictEqual(buildSceneBreakdown([]), { details: [], matrix: [] });
    const noHeader = buildSceneBreakdown([{ ep: 1, content: '△没有场头。\n林昭：走。' }]);
    assert.strictEqual(noHeader.details.length, 0);
    assert.strictEqual(noHeader.matrix.length, 0);
    const bare = buildSceneBreakdown([{ ep: 1, content: '内景\n甲：在室内。' }]);
    assert.strictEqual(bare.details.length, 0, '无具体地点不进明细');
    const nan = buildSceneBreakdown([{ ep: NaN, content: EP1 }, { ep: 1, content: EP1 }]);
    assert.ok(nan.details.every((d) => d.ep === 1), 'NaN 集号丢弃');
  });

  it('通告矩阵：跨集同场景聚合 count/角色台词量/信物合集/eps，按场次降序', () => {
    const sb = buildSceneBreakdown([
      { ep: 1, content: EP1 }, { ep: 2, content: EP2 }, { ep: 3, content: EP3 },
    ]);
    assert.strictEqual(sb.matrix.length, 3);
    const rest = sb.matrix.find((r) => r.location === '餐厅' && r.timeOfDay === '夜');
    assert.ok(rest && rest.count === 1 && rest.intExt === '内');
    assert.deepStrictEqual(rest.eps, [1]);
    assert.deepStrictEqual(rest.cast, [{ name: '林昭', lines: 2 }, { name: '陈默', lines: 1 }]);
    assert.deepStrictEqual(rest.props, ['玉佩']);
    // 跨集同场景：内景 餐厅 夜 在两集重复出现
    const rep = buildSceneBreakdown([
      { ep: 1, content: '内景 餐厅 夜\n甲：一。' },
      { ep: 2, content: '内景 餐厅 夜\n乙：二。\n内景 餐厅 夜\n甲：三。' },
    ]);
    assert.strictEqual(rep.matrix.length, 1);
    const row = rep.matrix[0];
    assert.strictEqual(row.count, 3, '跨集场次累加（1+2=3，与场景总表同口径）');
    assert.deepStrictEqual(row.eps, [1, 2]);
    assert.deepStrictEqual(row.cast, [{ name: '甲', lines: 2 }, { name: '乙', lines: 1 }], '跨集台词量合并');
  });
});

describe('制作物料引擎·矩阵文本行 formatMatrixLines', () => {
  const sb = buildSceneBreakdown([
    { ep: 1, content: EP1 }, { ep: 2, content: EP2 }, { ep: 3, content: EP3 },
  ]);

  it('中文行：场景头 — 场次｜角色：名(句数)｜道具', () => {
    const lines = formatMatrixLines(sb.matrix, 'zh');
    const text = lines.join('\n');
    assert.ok(text.includes('▸ 场景×角色通告矩阵（3 个场景'));
    assert.ok(text.includes('内景·餐厅·夜 — 1场｜角色：林昭(2)/陈默(1)｜道具：玉佩'));
    assert.ok(text.includes('外景·老巷·夜 — 1场'));
    assert.ok(text.includes('内景·餐厅·日 — 1场｜角色：陈默(1)'), '无信物段省略');
  });

  it('英文行：零中文系统文案（人名/地名透传）', () => {
    const lines = formatMatrixLines(sb.matrix, 'en');
    const text = lines.join('\n');
    assert.ok(text.includes('Scene×Cast Matrix'));
    assert.ok(text.includes('Cast: 林昭(2)/陈默(1)'));
    assert.ok(text.includes('Props: 玉佩'));
    assert.ok(!text.includes('｜'), '系统分隔符零中文全角');
    assert.ok(!text.includes('个场景'), '系统文案零中文');
  });

  it('空矩阵兜底 + cap 折叠', () => {
    const lines = formatMatrixLines([], 'zh');
    assert.ok(lines.some((l) => l.includes('无合规场头，无法生成矩阵')));
    const many = buildSceneBreakdown([{ ep: 1, content: ['内景 地点甲 夜', '甲：一。', '内景 地点乙 夜', '甲：二。', '内景 地点丙 夜', '甲：三。'].join('\n') }]);
    const lines2 = formatMatrixLines(many.matrix, 'zh', 2);
    assert.ok(lines2.some((l) => l.includes('其余 1 个场景详见 JSON 端点')));
    assert.ok(!lines2.some((l) => l.includes('地点丙')), '被截断场景不出现');
  });
});
