'use strict';
const assert = require('assert');
const test = require('node:test');
const { scenePaddingCheck } = require('../dist/engine/scene-padding-check.js');

// —— 中文：节奏紧凑的健康短剧（每场都有冲突/新信息/关系变化，集尾带钩子）——
const ZH_HEALTHY = `场景1：内景·宴会厅·夜
△订婚宴现场，林晚当众被甩下一纸退婚书，宾客哗然举起手机拍摄。
△顾聿一把撕碎退婚书，冷笑着把黑卡拍在桌上："这婚，我替她结。"

场景2：内景·走廊·日
△林晚拦住顾聿质问退婚真相，他甩出一份录音证据，原来陷害她的人是继妹。
△她攥紧录音笔转身就走，当场报警，警察铐走了正在销毁账目的继妹。

场景3：内景·顾家·夜
△继妹被释放后持刀绑架林晚，顾聿冲进去挡在她身前，反手夺刀将人制服。
△林晚哭着抱住他，顾聿掏出戒指单膝跪下："嫁给我。"

场景4：外景·天台·黄昏
△林晚亮出亲子鉴定报告，股东当场签字，收购案翻盘。
△她转身推开天台门——本该在看守所的继妹抬起头，冲她笑了。`;

// —— 中文：三无场景（茶水间整场寒暄日常，零推进）——
const ZH_DEAD = `场景1：内景·办公室·日
△苏然把审计报告甩在总监桌上，揭穿他虚报合同，保安当场将人带走。

场景2：内景·走廊·日
△同事围上来追问，苏然冷冷宣布已经报警取证，转身走进电梯。

场景3：内景·茶水间·日
△午后阳光明媚，小陈端着茶走过来笑着打招呼："早上好呀，今天天气真不错，要不要喝点咖啡？这茶味道不错。"
△两人坐下来闲聊家常，窗外下着小雨，她伸了个懒腰，继续发呆。

场景4：内景·会议室·日
△苏然推门进来亮出录音证据，董事会当场宣布开除涉事副总，收购计划翻盘。`;

// —— 中文：复述注水（前情提要 + 换句话说 + 我不是告诉过你）——
const ZH_RECAP = `场景1：内景·客厅·夜
△前情提要：上集说到林晚撞破丈夫转移资产，她当场摔碎花瓶提出离婚。

场景2：内景·律师事务所·日
△王律师推过委托合同："换句话说，也就是说，您得证明钱是被他转走的。"
△林晚冷笑："我不是已经告诉过你，我留了录音。"她掏出U盘拍在桌上。

场景3：外景·法院门口·日
△法槌落下，前夫因诈骗被警察押走，林晚转身走进阳光里。`;

// —— 中文：闪回注水（多次闪回零新信息揭晓）——
const ZH_FLASHBACK = `场景1：内景·卧室·夜
△林晚看着旧照片，回忆涌上心头，闪回那一天雨夜他送她去医院的画面，她捂着脸崩溃。

场景2：内景·公司·日
△她冲进会议室，把辞职信甩在主管脸上，转身就走，保安拦都拦不住。

场景3：内景·街头·夜
△回忆片段再次袭来，那一年雪地里他松开她的手，她蹲在路边崩溃大哭。
△一辆车在她面前急刹，顾聿冲下来一把抱住她："别怕，有我在。"`;

// —— 中文：寒暄开场（开场 15% 全是起床洗漱天气手机）——
const ZH_SLOW_OPEN = `场景1：内景·卧室·清晨
△闹钟响了第三遍，林晚才慢吞吞起床，洗漱、刷牙、洗脸，对着镜子伸了个懒腰，打了个哈欠。
△今天天气真好，阳光明媚，她给自己倒了杯咖啡，慢悠悠地刷手机，看着窗外发呆，无聊地等水烧开，又给绿植浇了浇水。

场景2：内景·公司·日
△主管把解约合同甩在她脸上，宣布开除，林晚当场泼了他一脸咖啡，夺门而出。

场景3：内景·电梯·夜
△顾聿拦住她，亮出亲子鉴定报告，原来她是首富失散的女儿，记者举着相机冲上来。

场景4：外景·楼下·夜
△她转身推开大门，一群黑衣人齐刷刷跪下："大小姐，请回家。"天空响起一声雷。`;

// —— 中文：结尾拖堂（矛盾解决后"从此/回归平静/岁月静好"尾巴）——
const ZH_TAIL = `场景1：内景·法庭·日
△林晚当庭甩出转账证据，法官宣判前夫诈骗罪成立，法警把人押走，她转身离开原告席。

场景2：外景·法院门口·日
△顾聿冲过来抱住她，掏出戒指求婚，她笑着点头，围观记者举起相机。

场景3：内景·新家·一年后
△多年以后，林晚偶尔想起这段日子。从此，他们再也没有分开，生活回归平静，岁月静好，阳光洒在窗台上，日子一天天过去，一切都恢复了平静。
△故事到这里告一段落，他们各自开始了新的生活，幸福美满地生活在这座小城里。`;

// —— 英文：紧凑健康 ——
const EN_HEALTHY = `Scene 1: INT. BANQUET HALL - NIGHT
Emma slammed the divorce papers on the table and confronted him in front of the guests; he grabbed her wrist and threatened her.
Lucas tore up the papers, sneered and threw down a black card: "I'll marry her instead."

Scene 2: INT. CORRIDOR - DAY
Emma blocked Lucas and demanded the truth; he handed her a recording — her stepsister had framed her.
She turned and left at once, called the police, and officers arrested the stepsister on the spot.

Scene 3: INT. PENTHOUSE - NIGHT
The stepsister broke in and kidnapped Emma; Lucas stormed in, shoved her away and hugged Emma tight.
He knelt and pulled out a ring: "Marry me."

Scene 4: EXT. ROOFTOP - DUSK
Emma revealed the DNA test at the board meeting; every director signed and the acquisition reversed.
The rooftop door opened — the stepsister, supposed to be in custody, looked up and smiled at her.`;

// —— 英文：三无场景 ——
const EN_DEAD = `Scene 1: INT. OFFICE - DAY
Sara slammed the audit report on the desk and exposed the forged contract; security dragged the man out.

Scene 2: INT. PANTRY - DAY
"Good morning! Lovely weather today, isn't it?" She poured coffee and stirred her tea.
"How have you been? Take a seat." He yawned, stared blankly at the window, and they kept the small talk going.

Scene 3: INT. BOARDROOM - DAY
Sara revealed the recording as evidence; the board fired the vice president on the spot and the deal reversed.`;

// —— 英文：复述注水 ——
const EN_RECAP = `Scene 1: INT. LIVING ROOM - NIGHT
Previously on the show: Emma discovered the hidden accounts. She slammed the folder and filed for divorce.

Scene 2: INT. LAW OFFICE - DAY
The lawyer pushed over the contract: "In other words — to put it simply — you must prove the transfers."
Emma sneered: "Like I told you, I kept the recording." She grabbed the USB drive and walked out.

Scene 3: EXT. COURTHOUSE - DAY
The verdict came down; the police arrested her ex-husband and Emma walked into the sunlight.`;

// —— 英文：寒暄开场 ——
const EN_SLOW_OPEN = `Scene 1: INT. BEDROOM - MORNING
The alarm clock rang three times before Anna woke up. She stretched, yawned, washed her face and brushed her teeth.
"Nice weather," she mumbled. Bright sunlight filled the room; she poured coffee, scrolled through her phone and stared blankly at the ceiling, bored.

Scene 2: INT. OFFICE - DAY
Her manager slammed the termination contract on her face and fired her; Anna slapped him and stormed out.

Scene 3: INT. ELEVATOR - NIGHT
A stranger grabbed her wrist and revealed a DNA test — she was a tycoon's lost daughter. Reporters charged in.

Scene 4: EXT. LOBBY - NIGHT
The door swung open and a row of bodyguards knelt before her: "Welcome home, young lady." Thunder rolled overhead.`;

test('中文紧凑短剧应得高分且无问题', () => {
  const r = scenePaddingCheck(ZH_HEALTHY, 'zh');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.score >= 75, `分数应>=75，实际 ${r.score}`);
  assert.ok(r.sceneCount >= 4, `应识别>=4个场景，实际 ${r.sceneCount}`);
  assert.strictEqual(r.deadSceneCount, 0);
  assert.strictEqual(r.slowOpen, false);
  assert.strictEqual(r.draggyTail, false);
});

test('三无寒暄场景应触发 dead_scene（high）', () => {
  const r = scenePaddingCheck(ZH_DEAD, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'dead_scene' && i.severity === 'high'),
    `应触发 dead_scene，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.deadSceneCount >= 1);
  assert.ok(r.deadScenes[0].length > 0);
});

test('复述注水应触发 recap_dump（mid）含开场前情提要', () => {
  const r = scenePaddingCheck(ZH_RECAP, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'recap_dump'),
    `应触发 recap_dump，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.recapCount >= 2);
});

test('多次闪回零新信息应触发 redundant_flashback（low）', () => {
  const r = scenePaddingCheck(ZH_FLASHBACK, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'redundant_flashback'),
    `应触发 redundant_flashback，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.flashbackCount >= 2);
  assert.strictEqual(r.newInfoCount, 0);
});

test('寒暄开场应触发 slow_open（mid）且首场不重复记 dead_scene', () => {
  const r = scenePaddingCheck(ZH_SLOW_OPEN, 'zh');
  assert.ok(r.slowOpen, '应判定 slowOpen');
  assert.ok(r.issues.some((i) => i.type === 'slow_open'),
    `应触发 slow_open，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(!r.issues.some((i) => i.type === 'dead_scene'), '开场空转不应重复记 dead_scene');
});

test('结尾拖堂应触发 draggy_tail（mid）', () => {
  const r = scenePaddingCheck(ZH_TAIL, 'zh');
  assert.ok(r.draggyTail, '应判定 draggyTail');
  assert.ok(r.issues.some((i) => i.type === 'draggy_tail'),
    `应触发 draggy_tail，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(!r.issues.some((i) => i.type === 'dead_scene'), '拖尾场景不应记为 dead_scene');
});

test('空文本/超短文本应返回满分不崩溃', () => {
  const r1 = scenePaddingCheck('', 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.issues.length, 0);
  const r2 = scenePaddingCheck('太短', 'zh');
  assert.strictEqual(r2.score, 100);
});

test('英文紧凑短剧应得高分且无问题', () => {
  const r = scenePaddingCheck(EN_HEALTHY, 'en');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.score >= 75, `分数应>=75，实际 ${r.score}`);
  assert.strictEqual(r.deadSceneCount, 0);
  assert.strictEqual(r.slowOpen, false);
  assert.strictEqual(r.draggyTail, false);
});

test('英文三无场景应触发 dead_scene', () => {
  const r = scenePaddingCheck(EN_DEAD, 'en');
  assert.ok(r.issues.some((i) => i.type === 'dead_scene' && i.severity === 'high'),
    `应触发 dead_scene，实际: ${r.issues.map((i) => i.type).join(',')}`);
});

test('英文复述注水应触发 recap_dump', () => {
  const r = scenePaddingCheck(EN_RECAP, 'en');
  assert.ok(r.issues.some((i) => i.type === 'recap_dump'),
    `应触发 recap_dump，实际: ${r.issues.map((i) => i.type).join(',')}`);
});

test('英文寒暄开场应触发 slow_open', () => {
  const r = scenePaddingCheck(EN_SLOW_OPEN, 'en');
  assert.ok(r.slowOpen, '应判定 slowOpen');
  assert.ok(r.issues.some((i) => i.type === 'slow_open'),
    `应触发 slow_open，实际: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(!r.issues.some((i) => i.type === 'dead_scene'));
});

test('英文模式输出不得含中文', () => {
  const r = scenePaddingCheck(EN_DEAD, 'en');
  for (const i of r.issues) {
    assert.ok(!/[\u4e00-\u9fff]/.test(i.evidence + i.advice + i.type), '英文结果不得含中文');
  }
});

test('字段边界合法', () => {
  const r = scenePaddingCheck(ZH_DEAD, 'zh');
  assert.ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100);
  assert.ok(r.sceneCount >= 1);
  assert.ok(r.deadSceneCount >= 1 && r.deadSceneCount === r.deadScenes.length);
  for (const i of r.issues) {
    assert.ok(['high', 'mid', 'low'].includes(i.severity));
    assert.ok(i.evidence.length > 0 && i.advice.length > 0);
  }
});
