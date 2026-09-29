const test = require('node:test');
const assert = require('node:assert');
const T = require('../dist/config/tag-taxonomy.js');

test('规模：12维度、叶子标签≥350、每维度非空、id唯一、父节点都存在', () => {
  assert.strictEqual(T.DIMENSIONS.length, 12);
  assert.ok(T.leafCount() >= 350, `叶子仅${T.leafCount()}`);
  T.DIMENSIONS.forEach((d) => assert.ok(d.count > 0, `${d.id} 为空`));
  const ids = T.ALL_TAGS.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, ids.length, '标签id重复');
  T.ALL_TAGS.filter((t) => t.level > 1).forEach((t) => assert.ok(T.ALL_TAGS.some((x) => x.id === t.parentId), `孤儿节点 ${t.id}`));
  // 全局名称唯一（防止跨维度重名导致按名定位串维度）
  const names = T.ALL_TAGS.map((t) => t.name);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepStrictEqual(dup, [], `存在重名标签: ${dup.join('、')}`);
});

test('八大优势品类分账加成：现代家庭+10%、悬疑+20%', () => {
  assert.strictEqual(T.validateCombo(['婆媳关系', '大女主', '打脸恶婆婆']).boostPct, 10);
  const susp = T.validateCombo(['悬疑推理', '大男主', '高能反转']);
  assert.strictEqual(susp.boostPct, 20);
  assert.ok(susp.boostedGenres.includes('悬疑'));
});

test('趋势标签可识别（现实主义=差异化）', () => {
  const r = T.validateCombo(['医疗职场', '女性联盟', '职场打脸', '现实主义']);
  assert.ok(r.trends.includes('差异化'));
});

test('检索毫秒级且命中别名/名称', () => {
  const t0 = Date.now();
  const r = T.searchTags('重生');
  assert.ok(r.length >= 2);
  assert.ok(r.some((x) => x.name.includes('重生')));
  assert.ok(Date.now() - t0 < 50);
});

test('组合自检：缺必备维度报错；互斥标签报错；完整组合通过', () => {
  assert.ok(T.validateCombo(['婆媳关系']).errors.some((e) => e.includes('必备')));
  assert.ok(T.validateCombo(['婆媳关系', '大女主', '打脸恶婆婆', 'HE圆满', 'BE虐心']).errors.some((e) => e.includes('互斥')));
  const ok = T.validateCombo(['婆媳关系', '大女主', '打脸恶婆婆', '现言女频', '现代都市', '高爽感', 'HE圆满']);
  assert.strictEqual(ok.ok, true, JSON.stringify(ok.errors));
  assert.ok(ok.completeness >= 80);
});

test('recommendNext 优先补齐缺失维度', () => {
  const rec = T.recommendNext(['婆媳关系'], 6);
  assert.ok(rec.some((t) => t.dim === 'protagonist'));
  assert.ok(rec.some((t) => t.dim === 'conflict'));
});

test('comboToBrief 输出维度行与平台扶持行', () => {
  const b = T.comboToBrief(['悬疑推理', '大男主', '高能反转']);
  assert.ok(b.raw.includes('【题材品类】'));
  assert.ok(b.raw.includes('平台扶持'));
});

test('randomCombo 成体系：抽三大必备维度后可通过立项校验', () => {
  for (let i = 0; i < 20; i++) {
    const names = T.randomCombo(['genre', 'protagonist', 'conflict'], () => Math.random());
    assert.strictEqual(T.validateCombo(names).missingRequired.length, 0);
  }
});

test('rankTags 动态排序：高热度/高频次靠前', () => {
  const dim = 'emotion';
  const ranked = T.rankTags(dim, {}, {});
  assert.ok(ranked.length > 0);
  // 人为抬高某标签频次后它应前移
  const first = ranked[ranked.length - 1].id;
  const r2 = T.rankTags(dim, { [first]: 999 }, {});
  assert.strictEqual(r2[0].id, first);
});

test('标签全局无重名，新增高泪点/情绪手法/前沿标签可检索', () => {
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '存在重名叶子标签');
  ['子欲养而亲不待','一封走了一生的信','父亲的记账本','先甜后刀','笑着笑着就哭了','遗物整理师','意难平','非血缘亲情'].forEach((n) =>
    assert.ok(T.findTagByName(n), `缺标签：${n}`));
  const emo = T.DIMENSIONS.find((d) => d.id === 'emotion');
  assert.ok(emo.count >= 50, `emotion 叶子仅 ${emo.count}`);
  assert.ok(T.searchTags('遗物').length >= 1);
});

test('smartRandomCombo 懂市场懂用户：必备维度齐/数量封顶/无互斥重复/偏好主导/可复现/不抛错', () => {
  const lcg = (seed) => { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };
  const c = T.smartRandomCombo({ rng: lcg(1) });
  assert.ok(c.length <= 9, `默认不应过多造成选择困难，实际${c.length}`);
  assert.strictEqual(new Set(c).size, c.length, '不得重复');
  const rep = T.validateCombo(c);
  assert.strictEqual(rep.missingRequired.length, 0, `必备维度缺失：${rep.errors.join(';')}`);
  assert.ok(!rep.errors.some((e) => e.includes('互斥')), '不得出现互斥对');
  assert.deepStrictEqual(T.smartRandomCombo({ rng: lcg(7) }), T.smartRandomCombo({ rng: lcg(7) }));
  // 偏好主导“创作方向”：把喜剧子类整体偏好顶满，其被抽中概率应数倍于自然占比
  const comedyGroup = T.ALL_TAGS.find((t) => t.dim === 'genre' && t.level === 2 && t.name === '喜剧搞笑');
  const comedyNames = T.ALL_TAGS.filter((t) => t.parentId === comedyGroup.id).map((t) => t.name);
  const pref = {}; T.ALL_TAGS.filter((t) => t.parentId === comedyGroup.id).forEach((t) => { pref[t.id] = 100; });
  const groupCount = T.ALL_TAGS.filter((t) => t.dim === 'genre' && t.level === 2).length;
  const natural = 1 / groupCount;
  const trial = (withPref) => { let hit = 0; const N = 800;
    for (let i = 0; i < N; i++) { const one = T.smartRandomCombo({ dims: ['genre'], maxTags: 1, pref: withPref ? pref : {}, rng: lcg(i + 3) }); if (comedyNames.includes(one[0])) hit++; }
    return hit / N; };
  const rate = trial(true), base = trial(false);
  assert.ok(rate > natural * 3 && rate >= 0.2, `偏好方向未显著倾斜 rate=${rate} natural=${natural}`);
  assert.ok(rate > base * 1.5, `偏好未明显优于无偏好 rate=${rate} base=${base}`);
  assert.doesNotThrow(() => T.smartRandomCombo({ seed: ['霸道总裁'], rng: lcg(2) }));
  assert.doesNotThrow(() => T.smartRandomCombo({ dims: [], seed: ['不存在的标签'], freq: null, rng: lcg(3) }));
});

test('戏中戏/文旅短剧标签就位且全局无重名', () => {
  ['戏中戏元叙事','剧中剧反转','伪纪录片式','城市文旅打卡','非遗文旅','美食文旅','景区悬疑文旅'].forEach((n) =>
    assert.ok(T.findTagByName(n), `缺标签：${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '新增标签造成重名');
});

test('年代穿越新题材（#059）：可被检索、机制标签与年代锚点齐备', () => {
  const hitNames = T.searchTags('年代穿越').map((t) => t.name);
  assert.ok(hitNames.includes('年代穿越'), 'genre应含年代穿越机制标签');
  // 具体年代锚点
  assert.ok(T.ALL_TAGS.some((t) => t.name === '穿回七十年代'));
  assert.ok(T.ALL_TAGS.some((t) => t.name === '穿回八十年代'));
  assert.ok(T.ALL_TAGS.some((t) => t.name === '穿回九十年代'));
  // era 维度年代背景锚点
  assert.ok(T.ALL_TAGS.some((t) => t.name === '七十年代生产队'));
  assert.ok(T.ALL_TAGS.some((t) => t.name === '八十年代个体户'));
  // 选中年代穿越标签后组合校验不报错、可转 Brief
  const rep = T.validateCombo(['年代穿越', '穿回七十年代', '时代信息差']);
  assert.ok(!rep.errors.some((e) => e.includes('未知标签')), '新标签必须被识别，不得报未知标签');
  assert.ok(rep.matchedDim.includes('genre'));
});
