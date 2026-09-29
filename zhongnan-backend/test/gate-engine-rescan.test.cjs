'use strict';
// c218 无 score 四闸门键（cliche 反套路/tongue 台词口语化/grounded 落地感/lengthPlan 字数闸门）
// 限界落库形态 + /fix 按新正文纯函数重扫。
// 病象：四键契约是 pass+noveltyScore / pass+colloquialScore / groundedScore / ready+status，
// 无顶层 score，被 buildQcEngineDigest 硬过滤——落库✗ SSE done✗ /fix✗ 前端✗ 四点全盲；
// cliche/tongue 还是 QC 重试闸门引擎，重试耗尽的失败态曾静默出货。
const test = require('node:test');
const assert = require('node:assert');

const MOD = require('../dist/engine/gate-engine-rescan.js');

test('shapeGateEngines: 四键削形 + hits≤8 截断 + 白名单外字段剥除 + 长字段截断', () => {
  const out = MOD.shapeGateEngines({
    cliche: {
      pass: false,
      noveltyScore: 10,
      hits: Array.from({ length: 10 }, (_, i) => ({
        id: `trope_${i}`, cat: '剧情', found: '套'.repeat(80), alt: '改'.repeat(300), extraLeak: { x: 1 },
      })),
      debugRaw: 'shall-not-pass', // 白名单外顶层字段必须剥除
    },
    tongue: {
      pass: false,
      colloquialScore: 30,
      writtenPer100: 5.5,
      hits: Array.from({ length: 10 }, (_, i) => ({ word: `然而${i}${'长'.repeat(60)}`, fix: '可'.repeat(200), noise: true })),
    },
    grounded: {
      groundedScore: 20,
      abstractHits: Array.from({ length: 10 }, (_, i) => `抽象${i}${'空'.repeat(60)}`),
      suggestions: Array.from({ length: 5 }, (_, i) => `建议${i}${'长'.repeat(300)}`),
      mysteryField: 1,
    },
    lengthPlan: {
      ready: false, status: 'under', mode: 'LIVE', current: 100, target: 500, range: [400, 600],
      note: 'x'.repeat(500), expansion: { scenes: [1, 2, 3] }, need: 400, // 大白名单外字段必须剥除
    },
  });
  // cliche
  assert.strictEqual(out.cliche.pass, false);
  assert.strictEqual(out.cliche.noveltyScore, 10);
  assert.strictEqual(out.cliche.issueCount, 10, 'issueCount 是原始条数而非截断后条数');
  assert.strictEqual(out.cliche.hits.length, 8, 'hits 最多 8 条');
  assert.strictEqual(out.cliche.hits[0].found.length, 40, 'found 截断 40');
  assert.strictEqual(out.cliche.hits[0].alt.length, 160, 'alt 截断 160');
  assert.ok(!('extraLeak' in out.cliche.hits[0]), 'hit 白名单外字段必须剥除');
  assert.ok(!('debugRaw' in out.cliche), '顶层白名单外字段必须剥除');
  // tongue
  assert.strictEqual(out.tongue.issueCount, 10);
  assert.strictEqual(out.tongue.hits.length, 8);
  assert.strictEqual(out.tongue.hits[0].word.length, 40, 'word 截断 40');
  assert.strictEqual(out.tongue.hits[0].fix.length, 120, 'fix 截断 120');
  assert.ok(!('noise' in out.tongue.hits[0]));
  // grounded
  assert.strictEqual(out.grounded.issueCount, 10);
  assert.strictEqual(out.grounded.abstractHits.length, 8);
  assert.strictEqual(out.grounded.abstractHits[0].length, 40, 'abstractHits 元素截断 40');
  assert.strictEqual(out.grounded.suggestions.length, 3, 'suggestions 最多 3 条');
  assert.strictEqual(out.grounded.suggestions[0].length, 200);
  assert.ok(!('mysteryField' in out.grounded));
  // lengthPlan
  assert.strictEqual(out.lengthPlan.ready, false);
  assert.strictEqual(out.lengthPlan.issueCount, 1, 'ready:false 记 1 处问题');
  assert.deepStrictEqual(out.lengthPlan.range, [400, 600]);
  assert.ok(!('note' in out.lengthPlan) && !('expansion' in out.lengthPlan) && !('need' in out.lengthPlan), '大字段必须剥除');
});

test('shapeGateEngines: 契约不符/非对象/空值不出键（不写假壳）；lengthPlan 健康稿出健康壳', () => {
  const out = MOD.shapeGateEngines({
    cliche: { noveltyScore: 80 }, // 缺 pass → 不出键
    tongue: 'not-object',
    grounded: null,
    lengthPlan: { ready: true, status: 'ok', mode: 'LIVE', current: 500, target: 500, range: [400, 600] },
  });
  assert.ok(!('cliche' in out) && !('tongue' in out) && !('grounded' in out), '契约不符键必须缺席');
  assert.strictEqual(out.lengthPlan.issueCount, 0, 'ready:true 健康壳 issueCount:0（覆盖语义清旧账）');
  assert.strictEqual(out.lengthPlan.status, 'ok');
  assert.deepStrictEqual(MOD.shapeGateEngines(null), {});
  assert.deepStrictEqual(MOD.shapeGateEngines(undefined), {});
});

test('rescanGateEngines: 干净稿四键全部产出，健康壳 pass:true / issueCount:0', () => {
  const body = Array.from({ length: 30 }, (_, i) => `△ 林晚推开第${i + 1}扇门，快步穿过长廊。\n林晚：「东西在哪？说！」`).join('\n');
  const out = MOD.rescanGateEngines(body, { scriptFormat: 'LIVE' });
  for (const k of MOD.GATE_ENGINE_KEYS) {
    assert.ok(k in out, `${k} 缺席`);
  }
  assert.strictEqual(out.cliche.pass, true);
  assert.strictEqual(out.cliche.issueCount, 0);
  assert.strictEqual(out.tongue.pass, true);
  assert.strictEqual(out.grounded.issueCount, 0);
  assert.strictEqual(typeof out.lengthPlan.ready, 'boolean');
});

test('rescan: 套路桥段稿 → cliche pass:false，hits 带 id/cat/found/alt，noveltyScore 扣分', () => {
  const out = MOD.rescanGateEngines('霸道总裁失忆后查出绝症，原来她是替嫁新娘，战神归来复仇。');
  assert.strictEqual(out.cliche.pass, false, 'balanced 档 maxHits=2，命中 4 处必须闸门拦截');
  assert.ok(out.cliche.issueCount >= 4);
  assert.ok(out.cliche.noveltyScore < 100);
  const h = out.cliche.hits[0];
  assert.ok(h.id && h.cat && h.found && h.alt, 'hit 四字段齐全（前端 tooltip 直接消费 found→alt）');
});

test('rescan: 书面腔台词稿 → tongue hits 非空（word→fix 对照），colloquialScore 扣分', () => {
  const out = MOD.rescanGateEngines('林晚：「然而我早知如此，此外你毋庸解释，换言之我们结束了，总而言之别再联系。」');
  assert.ok(out.tongue.issueCount >= 3, `书面词应命中≥3，实际 ${out.tongue.issueCount}`);
  assert.ok(out.tongue.colloquialScore < 100);
  const h = out.tongue.hits[0];
  assert.ok(h.word && h.fix, 'hit 携带 word→fix 对照');
});

test('rescan: 抽象叙述稿 → grounded abstractHits 非空；超短稿 → lengthPlan ready:false status:under', () => {
  const out = MOD.rescanGateEngines('气氛尴尬，他十分生气，心中五味杂陈。');
  assert.ok(out.grounded.issueCount >= 2);
  assert.ok(out.grounded.groundedScore < 100);
  assert.ok(out.grounded.suggestions.length >= 1, '落地建议必须随行（前端 tooltip 消费）');
  assert.strictEqual(out.lengthPlan.ready, false, '超短稿字数闸门必须拦截');
  assert.strictEqual(out.lengthPlan.status, 'under');
  assert.strictEqual(out.lengthPlan.issueCount, 1);
  assert.ok(Array.isArray(out.lengthPlan.range) && out.lengthPlan.range.length === 2);
});

test('rescan: 空文本/空白退 {}；AIGC 格式传入不炸；键名事实源四键', () => {
  assert.deepStrictEqual(MOD.rescanGateEngines(''), {});
  assert.deepStrictEqual(MOD.rescanGateEngines('   \n  '), {});
  const out = MOD.rescanGateEngines('△ 林晚走进教室坐下。\n林晚：「开始了。」', { scriptFormat: 'AIGC', aigcDurationMin: 2 });
  assert.ok('lengthPlan' in out, 'AIGC 格式照产字数闸门');
  assert.deepStrictEqual([...MOD.GATE_ENGINE_KEYS], ['cliche', 'tongue', 'grounded', 'lengthPlan'], '键名事实源不得漂移');
});

// —— c222 请求级档位闭环：pipeline 落 _profile → 生成落库 → /fix 读档重放（normalize 白名单校验）——
test('c222 normalize: 合法档位透传，非法/undefined/脏数据回退默认档不抛错', () => {
  assert.strictEqual(MOD.normalizeAntiStrength('classic'), 'classic');
  assert.strictEqual(MOD.normalizeAntiStrength('innovative'), 'innovative');
  assert.strictEqual(MOD.normalizeAntiStrength('balanced'), 'balanced');
  assert.strictEqual(MOD.normalizeAntiStrength(undefined), 'balanced', '旧项目无 _profile 回退默认档');
  assert.strictEqual(MOD.normalizeAntiStrength('ultra_mode'), 'balanced', '存档脏数据回退默认档');
  assert.strictEqual(MOD.normalizeAntiStrength(42), 'balanced');
  assert.strictEqual(MOD.normalizeColloquialLevel('low'), 'low');
  assert.strictEqual(MOD.normalizeColloquialLevel('high'), 'high');
  assert.strictEqual(MOD.normalizeColloquialLevel(undefined), 'mid');
  assert.strictEqual(MOD.normalizeColloquialLevel('MAX'), 'mid');
  assert.strictEqual(MOD.normalizeColloquialLevel(null), 'mid');
});

test('c222 antiStrength 档位真实改变 pass 判定：同稿 classic 过闸 / 默认 balanced 拦截 / 单套路 innovative 拦截', () => {
  // 3 个不同套路（失忆→amnesia_cancer、霸道总裁→ceo_love、战神归来→war_god）= 3 hits
  const text3 = '他是个霸道总裁，战神归来后却发现失忆的真相。';
  const outClassic = MOD.rescanGateEngines(text3, { antiStrength: 'classic' });
  const outDefault = MOD.rescanGateEngines(text3);
  assert.strictEqual(outClassic.cliche.pass, true, 'classic maxHits=4，3 hits 应放行');
  assert.strictEqual(outDefault.cliche.pass, false, '默认 balanced maxHits=2，3 hits 必须拦截（老版重放错档即此处误判）');
  // 1 hit：balanced 放行 / innovative（零容忍）拦截
  const text1 = '战神归来，风云变色。';
  assert.strictEqual(MOD.rescanGateEngines(text1, { antiStrength: 'balanced' }).cliche.pass, true);
  assert.strictEqual(MOD.rescanGateEngines(text1, { antiStrength: 'innovative' }).cliche.pass, false, 'innovative maxHits=0 零容忍');
});

test('c222 colloquialLevel 档位真实改变 pass 判定：同稿 low 过闸 / high 拦截（密度兜底口径）', () => {
  // 4 个书面词（然而/因此/此外/换言之）+ ~240 字正文：low cap=max(4,13)=13 放行；high cap=max(1,3)=3 拦截
  const filler = '林晚把文件放到桌上，转身看窗外，走廊里有人快步走过，她低头翻了一页，又合上。';
  const body = (filler + '然而事情并不简单，因此她决定再等一天，此外还有一份材料没有交，换言之这次机会只剩最后一线。' + filler).repeat(2);
  assert.ok(body.length >= 200 && body.length < 400, `测试文本长度应落在 200-400 区间，实际 ${body.length}`);
  assert.strictEqual(MOD.rescanGateEngines(body, { colloquialLevel: 'low' }).tongue.pass, true, 'low 档相对规整，4 书面词应放行');
  assert.strictEqual(MOD.rescanGateEngines(body, { colloquialLevel: 'high' }).tongue.pass, false, 'high 档高度口语，4 书面词必须拦截');
  assert.strictEqual(MOD.rescanGateEngines(body).tongue.pass, true, '默认 mid 档 cap≈7，4 书面词放行');
});

test('c222 opts 透传：脏档位与合法档位混传不炸且按归一后档位判定', () => {
  const text3 = '他是个霸道总裁，战神归来后却发现失忆的真相。';
  const out = MOD.rescanGateEngines(text3, { antiStrength: 'GODMODE', colloquialLevel: 123, scriptFormat: 'AIGC', aigcDurationMin: 3 });
  assert.strictEqual(out.cliche.pass, false, '脏 antiStrength 回退 balanced：3 hits 拦截');
  assert.ok('tongue' in out && 'lengthPlan' in out, '脏档位不得阻断其余闸门产出');
});

// —— c223 修复：/fix 重放 lengthPlan 缺 aigcDurationMin（路由调用点漏传，AIGC 项目一律按默认
// 1 分钟算 target/range，ready/status 误判）。此测试锁死「时长真实流到区间计算」的契约——
// 路由侧从旧 qcReport._aigc.durationMin 读出传入（c219 口径），本测试保证传入后判定确实翻转。
test('c223 aigcDurationMin 真实改变 lengthPlan：同稿 AIGC 1 分钟与 5 分钟 range/target 不同', () => {
  const body = '△ 林晚推开第1扇门，快步穿过长廊。\n林晚：「东西在哪？说！」\n他低头不语，指节发白。';
  const d1 = MOD.rescanGateEngines(body, { scriptFormat: 'AIGC', aigcDurationMin: 1 });
  const d5 = MOD.rescanGateEngines(body, { scriptFormat: 'AIGC', aigcDurationMin: 5 });
  assert.notDeepStrictEqual(d1.lengthPlan.range, d5.lengthPlan.range, '成片时长必须真实流到字数区间计算');
  assert.notStrictEqual(d1.lengthPlan.target, d5.lengthPlan.target);
  assert.ok(d5.lengthPlan.target > d1.lengthPlan.target, '5 分钟片目标字数应显著大于 1 分钟片');
  assert.strictEqual(d1.lengthPlan.status, 'under', '同稿在 1 分钟档与 5 分钟档的 ready 判定由区间决定');
  assert.strictEqual(d5.lengthPlan.status, 'under');
});
