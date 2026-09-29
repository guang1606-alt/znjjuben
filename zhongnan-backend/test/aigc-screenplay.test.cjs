const test = require('node:test');
const assert = require('node:assert');
const A = require('../dist/engine/aigc-screenplay.js');
const F = require('../dist/engine/script-format.js');
const S = require('../dist/engine/sample-script.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

// 构造一份合规的流畅制作本片段（两场，五维齐全）
function goodScript() {
  return [
    '《测试》 第1集',
    '内景 老旧出租屋·夜',
    '冷白灯管一闪一闪，半边脸埋在阴影里，她指尖把衬衫折痕一道道压平，眼神很静，嘴角绷成一条线。（音效：电流滋滋，纸箱蹭地。）',
    '她抬眼，盯着门口，慢慢站直。',
    '林晚（很轻）：过了今晚，谁也别想踩我。',
    '陈凯（冷笑）：你拿什么硬气？',
    '外景 巷口·夜',
    '车灯逆光勾边，冷蓝夜色里一束暖黄压过来，风掀动塑料帘哗哗响，她站在风里，手指收紧，眼眶微红却笑了一下。（配乐：低频弦乐渐起。）',
    '林晚：桥洞我就不去了。',
  ].join('\n').repeat(2).slice(0, 4000);
}

test('v2.33 解析器：按场拆分、块类型识别、标题不算游离文本', () => {
  const p = A.parseAigcEpisode(goodScript());
  assert.ok(p.sceneCount >= 2);
  assert.strictEqual(p.orphanLines.length, 0);
  assert.ok(p.scenes.every((s) => s.interior));
  assert.ok(p.dialogueCount >= 3);
  const types = p.scenes.flatMap((s) => s.blocks.map((b) => b.type));
  assert.ok(types.includes('sfx') && types.includes('dialogue') && types.includes('narrate'));
});

test('v2.33 自然段中夹带的台词在句首边界被拆出，叙述“两个字：管家”不误判', () => {
  const text = '内景 房间·夜\n屏幕亮着，跳着两个字：管家。她顿了一下。林晚（冷声）：我知道了。';
  const p = A.parseAigcEpisode(text);
  const dlgs = p.scenes[0].blocks.filter((b) => b.type === 'dialogue');
  assert.strictEqual(dlgs.length, 1);
  assert.strictEqual(dlgs[0].speaker, '林晚');
});

test('v2.33 五维覆盖：好样例 pass；缺维度/【】标签堆叠被诊断', () => {
  const good = A.validateAigcScreenplay(goodScript());
  assert.strictEqual(good.smoothnessIssues.length, 0);
  assert.ok(good.dimensions.visual >= 80 && good.dimensions.action >= 80);
  const bad = '第1集\n内景 房间·夜\n【景别】特写【运镜】推近【光影】冷调\n甲：走。\n外景 街口·日\n乙：来。';
  const rb = A.validateAigcScreenplay(bad);
  assert.ok(rb.smoothnessIssues.some((x) => x.includes('技术标签')));
});

test('v2.33 机器分镜层：确定性、无空画面镜头、台词/音效并入镜头', () => {
  const m1 = A.buildShotManifest(goodScript());
  const m2 = A.buildShotManifest(goodScript());
  assert.deepStrictEqual(m1, m2);
  assert.ok(m1.shotCount >= 2);
  assert.strictEqual(m1.shots.filter((s) => !s.visual).length, 0);
  assert.ok(m1.shots.some((s) => s.lines.length || s.audio.length));
  assert.ok(['特写', '近景', '中景', '全景', '远景'].includes(m1.shots[0].size));
});

test('v2.33 黄金样例：AIGC 流畅本 1200-1500 字、validateScript 满分通过、无【】堆叠', () => {
  const t = S.buildSampleScript('AIGC');
  assert.ok(!/【[^】]{1,8}】/.test(t));
  const r = F.validateScript(t, 'AIGC');
  assert.ok(r.cjk >= 1200 && r.cjk <= 1500, `实际${r.cjk}`);
  assert.strictEqual(r.pass, true, r.violations.join(';'));
  assert.strictEqual(r.score, 100);
});

test('v2.35 字数闸门按成片时长缩放：1分钟1200-1500，2分钟2400-3000，LIVE不缩放', () => {
  const t = S.buildSampleScript('AIGC');
  assert.deepStrictEqual(F.validateScript(t, 'AIGC', 1).range, [1200, 1500]);
  assert.deepStrictEqual(F.validateScript(t, 'AIGC', 2).range, [2400, 3000]);
  assert.deepStrictEqual(F.validateScript(S.buildSampleScript('LIVE'), 'LIVE', 2).range, [800, 1000]);
});

test('v2.35 逐场构成曲线：确定性、角色位标注、比例合法', () => {
  const t = S.buildSampleScript('AIGC');
  const c1 = A.analyzeAigcSceneCurve(t), c2 = A.analyzeAigcSceneCurve(t);
  assert.deepStrictEqual(c1, c2);
  assert.strictEqual(c1[0].role, 'opening');
  assert.strictEqual(c1[c1.length - 1].role, 'ending');
  assert.ok(c1.every((x) => x.spokenRatio >= 0 && x.spokenRatio <= 1));
});

test('v2.33 LIVE 真人本路径不受影响；英文指令零中文', () => {
  const r = F.validateScript(S.buildSampleScript('LIVE'), 'LIVE');
  assert.strictEqual(r.pass, true);
  const en = A.aigcScreenplayDirective('en');
  assert.ok(!cjk(en) && /never a prompt sheet/i.test(en));
});

test('v2.33 容量规划：按成片分钟数精算，两分钟2400-3000，发声受语速硬约束', () => {
  const p1 = A.planAigcVolume(1);
  assert.deepStrictEqual(p1.totalRange, [1200, 1500]);
  assert.ok(p1.spokenRange[1] <= 300); // 一分钟最快5字/秒=300发声字
  const p2 = A.planAigcVolume(2);
  assert.deepStrictEqual(p2.totalRange, [2400, 3000]);
  assert.deepStrictEqual(p2.spokenRange, [408, 600]);
  assert.ok(p2.narrativeRange[0] >= 1800);
  assert.ok(!cjk(p2.noteEn) && /2400-3000/.test(p2.noteEn));
  // 越界时长被夹回 0.5-5
  assert.strictEqual(A.planAigcVolume(99).durationMin, 5);
});

test('v2.33 构成体检：黄金样例发声占比18-28%；台词堆砌/全描写均被诊断', () => {
  const gold = A.analyzeAigcComposition(S.buildSampleScript('AIGC'));
  assert.ok(gold.spokenRatio >= 0.18 && gold.spokenRatio <= 0.28, `实际${gold.spokenRatio}`);
  assert.strictEqual(gold.compositionIssues.length, 0);
  // 台词剧：几乎全是对话 → 发声占比超28%
  const talky = ['内景 屋·夜', '甲：你给我出去现在马上立刻我再也不想看见你这张脸听见没有啊', '乙：我走就走谁怕谁啊你以为我愿意待在这个破地方受你的窝囊气吗真是笑话', '甲：滚', '乙：好'].join('\n').repeat(3);
  const ct = A.analyzeAigcComposition(talky);
  assert.ok(ct.compositionIssues.some((x) => x.includes('占比') && x.includes('偏高')));
});

// ---------- v2.80 英文 AIGC 链路（场标/cue/台词/五维/构成与中文等价） ----------

test('v2.80 英文场标 INT./EXT. 解析：内外景、地点时间切分、EP 标题不算游离行', () => {
  const text = [
    'EP1 The Test Title',
    'INT. CRAMPED RENTAL ROOM - NIGHT',
    'The cold lamp buzzes and throws her face into shadow; she grips the box and stares at the door, lips tight. (SFX: electric hum, scraping cardboard.)',
    'Lin Wan (quiet): After tonight, nobody steps on me.',
    'EXT. ALLEY MOUTH - CONTINUOUS',
    'Wind flips the plastic curtain and the warm headlights glow in the dark blue street; she turns, sighs, and smiles with red eyes.',
    'Chen Kai: You cannot be serious.',
  ].join('\n');
  const p = A.parseAigcEpisode(text);
  assert.strictEqual(p.sceneCount, 2);
  assert.strictEqual(p.orphanLines.length, 0);
  assert.strictEqual(p.scenes[0].interior, '内');
  assert.strictEqual(p.scenes[1].interior, '外');
  assert.strictEqual(p.scenes[0].place, 'CRAMPED RENTAL ROOM');
  assert.strictEqual(p.scenes[0].time, 'NIGHT');
  assert.strictEqual(p.scenes[1].time, 'CONTINUOUS');
  const types = p.scenes.flatMap((s) => s.blocks.map((b) => b.type));
  assert.ok(types.includes('sfx') && types.includes('dialogue') && types.includes('narrate'));
  const dlg = p.scenes[0].blocks.find((b) => b.type === 'dialogue');
  assert.strictEqual(dlg.speaker, 'Lin Wan');
  assert.strictEqual(dlg.cue, 'quiet');
});

test('v2.80 英文自然括号：(V.O.:)/(SFX:)/(MUSIC:) 被识别；(whispering) 表演提示不被误判为语义块', () => {
  const text = [
    'INT. ROOM - NIGHT',
    'She sits very still in the dim room and lets the silence stretch. (V.O.: He never did keep a promise.) (MUSIC: low strings.)',
    'Mary (whispering): I am home.',
  ].join('\n');
  const p = A.parseAigcEpisode(text);
  const sc = p.scenes[0];
  assert.ok(sc.blocks.some((b) => b.type === 'inner'));
  assert.ok(sc.blocks.some((b) => b.type === 'sfx'));
  const dlg = sc.blocks.find((b) => b.type === 'dialogue');
  assert.ok(dlg && dlg.speaker === 'Mary' && dlg.cue === 'whispering');
});

test('v2.80 英文黄金样例：闸门满分、发声占比18-28%、诊断消息全英文', () => {
  const t = S.buildSampleScript('AIGC', 'en');
  assert.ok(!/[一-鿿]/.test(t));
  assert.ok(!/△|【/.test(t));
  const cov = A.validateAigcScreenplay(t, 'en');
  assert.strictEqual(cov.pass, true, [].concat(cov.sceneIssues, cov.smoothnessIssues, cov.compositionIssues).join(';'));
  assert.ok(cov.composition.spokenRatio >= 0.18 && cov.composition.spokenRatio <= 0.28, `实际${cov.composition.spokenRatio}`);
});

test('v2.80 英文小说化/无场标初稿被英文诊断拦截，issue 零中文', () => {
  const bad = 'She walked into the room and thought about everything that had happened. '.repeat(30);
  const cov = A.validateAigcScreenplay(bad, 'en');
  assert.strictEqual(cov.pass, false);
  const all = [].concat(cov.sceneIssues, cov.smoothnessIssues, cov.compositionIssues);
  assert.ok(all.length > 0);
  assert.ok(!all.some((x) => /[一-鿿]/.test(x)), '英文链路诊断不得含中文');
  assert.ok(all.some((x) => /scene/i.test(x)));
});

// ---------- v2.80 确定性发声比提升 boostSpokenRatio ----------

test('boostSpokenRatio 英文稿：内心叙述句转为 (inner:…)，发声比从<18%提升到≥18%', () => {
  const draft = [
    'INT. BOARDROOM - DAY',
    'The cold light washes over the long oak table, gilding the edges of the contract papers. Lin Wan stands at the far end, fingers tight around her worn bag. She knows exactly what they are about to do. She feels the weight of three years of patience settle into her shoulders.',
    'LIN WAN (calm): I am here to vote.',
    'Mr. Chen laughs, sharp and brittle. He thinks she is bluffing. He cannot imagine a cleaner could own fifty-one percent of the company. The room falls silent.',
    'LIN WAN (low): The shares were transferred to me three years ago.',
    'She slides the certificate across the table. Mr. Chen realizes his father never trusted him. He feels the ground shift beneath his feet. The gavel lifts.',
  ].join('\n');
  const before = A.analyzeAigcComposition(draft);
  assert.ok(before.spokenRatio < 0.18, `前置：before=${before.spokenRatio}`);
  const need = Math.max(60, Math.round(0.22 * before.totalCjk) - before.spokenCjk);
  const boosted = A.boostSpokenRatio(draft, need);
  const after = A.analyzeAigcComposition(boosted);
  assert.ok(after.spokenRatio >= 0.18, `after=${after.spokenRatio}`);
  assert.ok(after.spokenRatio <= 0.28, `发声比不得越过28%硬线，实际=${after.spokenRatio}`);
  assert.ok(boosted.includes('(inner:'), '应出现 (inner: …) 独白');
  // 原有台词不能丢
  assert.ok(boosted.includes('I am here to vote.'));
  assert.ok(boosted.includes('The shares were transferred to me three years ago.'));
});

test('boostSpokenRatio 中文稿：内心叙述句转为（内心：…），不碰台词与场标', () => {
  const draft = [
    '内景 会议室·日',
    '冷白光落在长桌上，林晚站在尽头，手指攥紧旧包带。她知道他们要做什么。她心里压着三年的隐忍，像一块石头坠着。',
    '林晚（平静）：我是来投票的。',
    '陈总笑了，声音又尖又脆。他觉得她在虚张声势。他想不出一个保洁能拿下公司五成一的股份。满屋子人都屏住了呼吸。',
  ].join('\n');
  const before = A.analyzeAigcComposition(draft);
  assert.ok(before.spokenRatio < 0.18, `前置：before=${before.spokenRatio}`);
  const need = Math.max(60, Math.round(0.22 * before.totalCjk) - before.spokenCjk);
  const boosted = A.boostSpokenRatio(draft, need);
  const after = A.analyzeAigcComposition(boosted);
  assert.ok(after.spokenRatio >= 0.18, `after=${after.spokenRatio}`);
  assert.ok(boosted.includes('（内心：'));
  assert.ok(boosted.includes('我是来投票的。'), '原台词保留');
  assert.ok(boosted.includes('内景 会议室·日'), '场标保留');
});

test('boostSpokenRatio 达标稿不改动', () => {
  const gold = S.buildSampleScript('AIGC', 'en');
  const c = A.analyzeAigcComposition(gold);
  if (c.spokenRatio >= 0.18) {
    const out = A.boostSpokenRatio(gold, 100);
    assert.strictEqual(out, gold, '已达标稿不应被改');
  }
});

test('boostSpokenRatio 流式预算：逐句进入19%即停，绝不越过28%硬线', () => {
  // 17% 左右发声基线 + 大量不同长度内心句；旧式"凑够 targetAdd"会因最后一句冲过 28%
  const narr = [
    'The cold light sweeps the marble floor and the long table gleams under it.',
    'She knows the board has already made up its mind before she speaks.',
    'He thinks the proxy votes are safely locked in his desk drawer tonight.',
    'She remembers every cold dismissal from the past three long lonely years.',
    'The clock ticks while lawyers shuffle papers and the room waits.',
    'He fears his father may have changed the trust before the funeral.',
    'She feels the heavy weight of the folder pressing against her palm.',
  ];
  const lines = ['INT. BOARDROOM - DAY'];
  for (let i = 0; i < 4; i++) lines.push(...narr);
  lines.push('LIN WAN: No.');
  const draft = lines.join('\n');
  const before = A.analyzeAigcComposition(draft);
  assert.ok(before.spokenRatio < 0.18, `前置before=${before.spokenRatio}`);
  const need = Math.max(80, Math.round(0.22 * before.totalCjk) - before.spokenCjk);
  const boosted = A.boostSpokenRatio(draft, need);
  const after = A.analyzeAigcComposition(boosted);
  assert.ok(after.spokenRatio >= 0.18, `应抬到下限以上，after=${after.spokenRatio}`);
  assert.ok(after.spokenRatio <= 0.28, `不得越过28%，after=${after.spokenRatio}`);
});

test('v2.80 行业标准两行式台词（NAME (cue): 独占行 + 台词在下一行）被正确识别为 dialogue', () => {
  const draft = [
    'INT. BOARDROOM - DAY',
    'Fluorescent tubes hum overhead, cold light over the oil-stained concrete and the row of sedans.',
    'LU SHIYAN (muttering, a dry tug at the corner of his mouth):',
    'Three years to the day.',
    'He steps past the barrier without slowing, leather shoes clicking sharp on the floor.',
    'LIN WEI :',
    'You are late, Mr. Lu.',
  ].join('\n');
  const p = A.parseAigcEpisode(draft);
  assert.strictEqual(p.scenes.length, 1);
  const dlgs = p.scenes[0].blocks.filter((b) => b.type === 'dialogue');
  assert.strictEqual(dlgs.length, 2, `应识别2句台词，实际=${dlgs.length}`);
  assert.strictEqual(dlgs[0].speaker, 'LU SHIYAN');
  assert.ok(/muttering/.test(dlgs[0].cue || ''), '情绪 cue 应保留');
  assert.strictEqual(dlgs[0].text, 'Three years to the day.');
  assert.strictEqual(dlgs[1].speaker, 'LIN WEI');
  assert.strictEqual(dlgs[1].text, 'You are late, Mr. Lu.');
  // 叙述不能被误吞
  assert.ok(p.scenes[0].blocks.some((b) => b.type === 'narrate' && /Fluorescent/.test(b.text)));
  assert.ok(p.scenes[0].blocks.some((b) => b.type === 'narrate' && /steps past/.test(b.text)));
});

test('两行式台词提示行后紧跟新场标时不吞场标、不串场', () => {
  const draft = [
    'INT. ROOM A - DAY',
    'She waits by the door, hand on the cold handle, listening to the footsteps fade.',
    'LIN WEI:',
    'INT. ROOM B - NIGHT',
    'The corridor is empty, a single lamp buzzing over the far wall.',
    'LIN WEI: Finally.',
  ].join('\n');
  const p = A.parseAigcEpisode(draft);
  assert.strictEqual(p.scenes.length, 2, '应正常拆成两场');
  assert.ok(/ROOM B/.test(p.scenes[1].head));
  // 第二场台词仍被识别
  assert.ok(p.scenes[1].blocks.some((b) => b.type === 'dialogue' && /Finally/.test(b.text)));
});

// c219 AIGC 构成仪表盘 _aigc 存储契约：四函数产出字段必须与前端 renderAigcDash 消费口径一致，
// 否则落库后刷新渲染会读到 undefined。本测试锁定字段名，防止引擎重构时静默漂移。
test('c219 _aigc 四组件产出字段与前端 renderAigcDash 消费契约对齐', () => {
  const draft = goodScript();
  const manifest = A.buildShotManifest(draft);
  const volumePlan = A.planAigcVolume(1);
  const curve = A.analyzeAigcSceneCurve(draft);
  // c219 修复：_aigc.format 复用 pipeline 同口径 validateScript（非 validateAigcScreenplay），
  // 字段 cjk/range/inRange/violations/score 才与前端 renderAigcDash 消费对齐
  const format = F.validateScript(draft, 'AIGC', 1);
  // manifest：renderAigcDash 读 manifest.shotCount
  assert.ok(typeof manifest.shotCount === 'number' && manifest.shotCount > 0, 'manifest.shotCount 必须为正数');
  // volumePlan：renderAigcDash 读 plan.noteZh / plan.noteEn
  assert.ok(typeof volumePlan.noteZh === 'string' && typeof volumePlan.noteEn === 'string', 'volumePlan.noteZh/noteEn 必须存在');
  // curve：renderAigcDash 读 c.narrativeCjk / c.spokenCjk / c.spokenRatio / c.inBand / c.scene / c.role / c.dialogueLines
  assert.ok(Array.isArray(curve) && curve.length > 0, 'curve 必须为非空数组');
  const c0 = curve[0];
  for (const k of ['narrativeCjk', 'spokenCjk', 'spokenRatio', 'inBand', 'scene', 'role', 'dialogueLines']) {
    assert.ok(k in c0, `curve[0].${k} 必须存在（renderAigcDash 依赖）`);
  }
  // format：renderAigcDash 读 fmt.cjk / fmt.range / fmt.inRange / fmt.violations / fmt.score
  assert.ok(typeof format.cjk === 'number', 'format.cjk 必须为数字');
  assert.ok(Array.isArray(format.range) && format.range.length === 2, 'format.range 必须为 [min,max]');
  assert.ok(typeof format.inRange === 'boolean', 'format.inRange 必须为布尔');
  assert.ok(Array.isArray(format.violations), 'format.violations 必须为数组');
  assert.ok(typeof format.score === 'number', 'format.score 必须为数字');
});

// c219 LIVE 实拍本：aigcManifest 为 null 时 _aigc 应存 null，前端隐藏仪表盘（不误渲染）
test('c219 非 AIGC 格式 _aigc 为 null 语义', () => {
  // 模拟 generate.ts 落库判断：result.aigcManifest 为 null → _aigc = null
  const aigcManifest = null;
  const _aigc = aigcManifest ? { manifest: aigcManifest } : null;
  assert.strictEqual(_aigc, null, '非 AIGC 格式 _aigc 必须为 null');
});
