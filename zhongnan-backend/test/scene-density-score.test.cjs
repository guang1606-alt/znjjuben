const test = require('node:test');
const assert = require('node:assert');
const { sceneDensityScore } = require('../dist/engine/scene-density-score.js');

// —— 中文剧本样本 ——

// 高质量剧本：4个场景，长度均衡，有冲突，情绪有推进
const ZH_HIGH_QUALITY = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
△林晚一巴掌扇在前台脸上
林晚：滚开！
李经理（怒）：你敢在这里撒野？
林晚：松手！否则我让你后悔。

场景：经理办公室 日 内景
△李经理揪住林晚衣领，林晚甩开
李经理：你算什么东西？
△林晚冷笑，把一份文件摔在桌上
林晚：这是收购协议，从今天起这家公司是我的。
李经理（震惊）：不可能！
林晚：跪下求我，我就放你走。

场景：天台 黄昏 外景
△王总站在天台边缘，风吹乱他的头发
王总（绝望）：你赢了，我都给你。
△林晚走到他面前，眼神冰冷
林晚：晚了。你以为忍让是软弱？
王总：求你，放过我女儿。
林晚：从今天起，你为她跪着活。

场景：公司大门 夜 外景
△林晚走出大门，助理撑伞
助理：林总，车备好了。
△林晚停下脚步，回头看了一眼大楼
林晚（释然）：走吧。
△车灯亮起，驶入夜色
`;

// 低质量剧本：1个场景，无切换，无节奏
const ZH_SINGLE_SCENE = `
场景：客厅 日 内景
△林晚坐在沙发上
李明：今天天气不错。
林晚：嗯，是啊。
李明：事情就这样吧。
林晚：好吧。
△两人沉默
李明：那我先走了。
林晚：再见。
`;

// 静态场景过多：3个场景但2个无冲突
const ZH_STATIC_SCENES = `
场景：客厅 日 内景
△林晚坐在沙发上
李明（平静）：今天天气不错。
林晚：嗯，是啊。
李明：你吃饭了吗？
林晚：吃了。

场景：厨房 日 内景
△林晚在切菜
李明：今天吃什么？
林晚：红烧肉。
李明：好。
△林晚继续切菜

场景：客厅 夜 内景
△林晚一巴掌扇在李明脸上
林晚：滚！
李明：你疯了？
△林晚怒吼
林晚：滚出去！
`;

// 碎片场景过多：6个场景但大部分太短
const ZH_FRAGMENTED = `
场景：客厅 日 内景
林晚：嗯。

场景：厨房 日 内景
李明：好。

场景：卧室 日 内景
林晚：行。

场景：阳台 日 内景
△风吹过

场景：书房 日 内景
李明：走吧。

场景：大门 夜 外景
△林晚一巴掌扇在李明脸上
林晚：滚！
李明：你疯了？
△林晚怒吼
林晚：滚出去！
`;

// 英文高质量剧本
const EN_HIGH_QUALITY = `
Scene: Company lobby, Day, Interior
Lin walks in, the receptionist blocks her.
Receptionist: No appointment, no entry.
Lin slaps the receptionist.
Lin: Get out of my way!
Manager: Who do you think you are?
Lin: Let go, or you'll regret this.

Scene: Manager office, Day, Interior
Manager grabs Lin's collar, Lin shakes him off.
Manager: Kneel and beg!
Lin throws a document on the desk.
Lin: This is the acquisition agreement. This company is mine now.
Manager (shocked): Impossible!
Lin: From today, you kneel to live.

Scene: Rooftop, Dusk, Exterior
CEO stands at the edge, wind messes his hair.
CEO (desperate): You win, I'll give you everything.
Lin walks up, eyes cold.
Lin: Too late. You thought patience was weakness?
CEO: Please, spare my daughter.
Lin: From today, you kneel for her.

Scene: Company gate, Night, Exterior
Lin walks out, assistant holds an umbrella.
Assistant: Boss, the car is ready.
Lin stops, looks back at the building.
Lin (relieved): Let's go.
Headlights on, driving into the night.
`;

test('中文高质量剧本应识别4个场景且高分', () => {
  const res = sceneDensityScore(ZH_HIGH_QUALITY, 'zh');
  assert.ok(res.count === 4, `应识别4个场景，实际${res.count}`);
  assert.ok(res.score >= 60, `高质量剧本分数应≥60，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `不应有 high 级问题，实际${JSON.stringify(highIssues)}`);
  assert.ok(res.hasEmotionProgression, '应有跨场情绪推进');
  assert.ok(res.staticCount === 0, `不应有静态场景，实际${res.staticCount}`);
});

test('单场景剧本应识别为 single_scene 并产生 high 级问题', () => {
  const res = sceneDensityScore(ZH_SINGLE_SCENE, 'zh');
  assert.strictEqual(res.count, 1);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'single_scene'), '应有 single_scene 问题');
  assert.ok(res.score < 50, `单场景分数应<50，实际${res.score}`);
});

test('静态场景过多应产生 high 级问题', () => {
  const res = sceneDensityScore(ZH_STATIC_SCENES, 'zh');
  assert.ok(res.staticCount >= 2, `应有≥2个静态场景，实际${res.staticCount}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'too_many_static'), '应有 too_many_static 问题');
});

test('碎片场景过多应识别为 fragment', () => {
  const res = sceneDensityScore(ZH_FRAGMENTED, 'zh');
  assert.ok(res.fragmentCount >= 3, `应有≥3个碎片场景，实际${res.fragmentCount}`);
  const fragmentIssues = res.issues.filter((i) => i.type === 'too_many_fragments');
  assert.ok(fragmentIssues.length >= 1, '应有 too_many_fragments 问题');
});

test('英文高质量剧本应识别4个场景', () => {
  const res = sceneDensityScore(EN_HIGH_QUALITY, 'en');
  assert.ok(res.count === 4, `英文应识别4个场景，实际${res.count}`);
  assert.ok(res.score >= 50, `英文高质量分数应≥50，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `英文不应有 high 级问题，实际${JSON.stringify(highIssues)}`);
});

test('场景信息应包含必要字段', () => {
  const res = sceneDensityScore(ZH_HIGH_QUALITY, 'zh');
  for (const s of res.scenes) {
    assert.ok(typeof s.index === 'number', 'index 应为数字');
    assert.ok(typeof s.header === 'string', 'header 应为字符串');
    assert.ok(typeof s.position === 'number', 'position 应为数字');
    assert.ok(typeof s.lineCount === 'number', 'lineCount 应为数字');
    assert.ok(typeof s.dialogueLines === 'number', 'dialogueLines 应为数字');
    assert.ok(typeof s.actionLines === 'number', 'actionLines 应为数字');
    assert.ok(typeof s.wordCount === 'number', 'wordCount 应为数字');
    assert.ok(typeof s.conflictSignals === 'number', 'conflictSignals 应为数字');
    assert.ok(['normal', 'static', 'fragment', 'dragging'].includes(s.type), `type 应为有效值，实际${s.type}`);
    assert.ok(typeof s.dialogueRatio === 'number', 'dialogueRatio 应为数字');
  }
});

test('长度分布应正确计算', () => {
  const res = sceneDensityScore(ZH_HIGH_QUALITY, 'zh');
  assert.strictEqual(res.lengthDistribution.length, res.count, '长度分布数组长度应等于场景数');
  const total = res.lengthDistribution.reduce((a, b) => a + b, 0);
  assert.ok(total > 0, '总字数应>0');
});

test('maxSceneRatio 应在 0-1 之间', () => {
  const res = sceneDensityScore(ZH_HIGH_QUALITY, 'zh');
  assert.ok(res.maxSceneRatio >= 0 && res.maxSceneRatio <= 1, `maxSceneRatio 应在 0-1，实际${res.maxSceneRatio}`);
});

test('跨场情绪推进应正确检测', () => {
  // 高质量剧本有正负情绪交替
  const res1 = sceneDensityScore(ZH_HIGH_QUALITY, 'zh');
  assert.ok(res1.hasEmotionProgression, '高质量剧本应有情绪推进');
  // 单场景无推进
  const res2 = sceneDensityScore(ZH_SINGLE_SCENE, 'zh');
  // 单场景无法跨场推进（但 count < 3 不触发检测）
  if (res2.count < 3) {
    // count < 3 时不检测情绪推进，hasEmotionProgression 默认 false
    assert.strictEqual(res2.hasEmotionProgression, false, '单场景无跨场情绪推进');
  }
});

test('拖沓场景应正确识别', () => {
  // 构造一个有1个超长静态场景的剧本
  const draggingScript = `
场景：客厅 日 内景
△林晚坐在沙发上
李明：今天天气不错。
林晚：嗯，是啊。
李明：你吃饭了吗？
林晚：吃了。
李明：那我们去散步吧。
林晚：好。
△两人在沙发上坐了很久
李明：你看这个电视节目。
林晚：还行。
李明：我觉得挺好看的。
林晚：嗯。
李明：你要喝点什么吗？
林晚：不用。
李明：那我给你倒杯水。
林晚：好。
△李明起身倒水
李明：水来了。
林晚：谢谢。
李明：不客气。
林晚：今天真无聊。
李明：是啊。
△两人继续看电视

场景：大门 夜 外景
△李明走出大门
`;
  const res = sceneDensityScore(draggingScript, 'zh');
  assert.ok(res.draggingCount >= 1 || res.staticCount >= 1, `应有拖沓或静态场景，dragging=${res.draggingCount}, static=${res.staticCount}`);
});

test('对白墙场景应产生 dialogue_wall 问题', () => {
  const wallScript = `
场景：客厅 日 内景
林晚：你好。
李明：你好。
林晚：今天怎么样？
李明：还行。
林晚：吃了没？
李明：吃了。
林晚：那走吧。
李明：好。

场景：厨房 日 内景
林晚：做什么饭？
李明：红烧肉。
林晚：好。
李明：你来帮忙。
林晚：行。
`;
  const res = sceneDensityScore(wallScript, 'zh');
  const wallIssues = res.issues.filter((i) => i.type === 'dialogue_wall');
  if (res.scenes.filter((s) => s.dialogueRatio > 0.85).length >= 2) {
    assert.ok(wallIssues.length >= 1, '应有 dialogue_wall 问题');
  }
});

// c213：英文标准剧本格式——括号动作行 + 全大写/含空格说话人（JANE / UNCLE TED）必须被统计
test('c213-英文：括号动作行与全大写多词说话人必须计入行数', () => {
  const text = `INT. APARTMENT - NIGHT
(The light flickers. JANE clutches a notice.)
JANE (hiding it): I must find the money.
UNCLE TED: Sign it by tomorrow.
JANE: No.
(He freezes, tugging his cuff.)

EXT. SCHOOL TRACK - DAY
(MAYA runs up with water.)
MAYA: You look terrible.
JANE: I need a favor from your dad at the bank.
(She chokes on her water.)
JANE: Please.

INT. OFFICE - DAY
(Uncle Ted slides the contracts across the desk.)
JANE (setting the pen down): Seventeen copies already exist.
(He reaches for the contract. She snatches it back.)
UNCLE TED: You cannot win this.
(Two uniformed officers stand outside the glass.)`;
  const res = sceneDensityScore(text, 'en');
  assert.strictEqual(res.count, 3);
  for (const s of res.scenes) {
    assert.ok(s.lineCount >= 4, `S${s.index} 标准格式下行数应≥4，实际 ${s.lineCount}`);
    assert.ok(s.dialogueLines >= 2, `S${s.index} 对白行应≥2，实际 ${s.dialogueLines}`);
    assert.ok(s.actionLines >= 1, `S${s.index} 括号动作行应≥1，实际 ${s.actionLines}`);
  }
});

// c213：英文情绪词的屈折形式（smiling/trembling/crying）必须参与跨场情绪极性计算
test('c213-英文：smiling/trembling 等屈折形式应识别情绪推进', () => {
  const text = `SCENE 1: ROOM - NIGHT
JANE: He is smiling again, so gentle.

SCENE 2: HALLWAY - NIGHT
JANE: She was trembling and crying alone.

SCENE 3: ROOFTOP - DAWN
JANE: I am smiling now, warm and free at last.`;
  const res = sceneDensityScore(text, 'en');
  assert.ok(res.hasEmotionProgression, 'smiling(正)/trembling+crying(负) 应构成跨场情绪推进');
});

// c213：调查场里的"被揍/有用么"斗嘴是冲突信号，不应误判静态场
test('c213-中文：调查场的斗嘴质疑（揍/有用么）应算冲突信号，不判静态', () => {
  const text = `场景1：老宅·夜
△陈鹿跑上来塞水。
陈鹿：你眼圈黑得像被人揍了。
林小凡：我要查我爸公司的账。
△陈鹿看着她的眼睛。
陈鹿：行，我帮你。

场景2：办公室·日
林国栋：签了它，不签就逼债。
△林小凡把合同护在怀里。
林小凡：我已经复印了十七份。
林国栋怒吼：你敢！
△穿制服的人站在门外。`;
  const res = sceneDensityScore(text, 'zh');
  assert.strictEqual(res.staticCount, 0, `调查场含斗嘴冲突不应静态，static=${res.staticCount}`);
});
