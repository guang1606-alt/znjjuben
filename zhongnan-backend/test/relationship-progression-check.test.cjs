const { test } = require('node:test');
const assert = require('node:assert');
const { relationshipProgressionCheck } = require('../dist/engine/relationship-progression-check.js');

// 健康甜宠：开场心动铺垫 → 误会阻力 → 表白升级 → 尾段强亲密（关系完整递进）
const ZH_HEALTHY = `场景1：内景·公司茶水间·日
△顾聿走进来时，林晚的心跳漏了一拍，她慌忙低下头，耳尖发红。
△他递来一杯咖啡，她接过时指尖相碰，两人都僵了一瞬，她小声说了句谢谢。

场景2：内景·会议室·日
△女实习生当众替顾聿整理领带，林晚心里一阵发酸，打翻了手边的文件。
△顾聿看见这一幕，眼里掠过笑意，却故意逗她：林秘书这是吃醋了？
△林晚又羞又急，误会他是在消遣自己，一整天没和他说话。

场景3：外景·公司楼下·夜
△加班到深夜，顾聿把外套披在她肩上，拉住她的手腕。
顾聿：我喜欢你，从很早以前开始，就是你。
△林晚愣住，下一秒他牵起她的手，十指相扣，她没有挣开。

场景4：内景·顾聿家·夜
△两人正式交往，女实习生送来的误会彻底解开，顾聿把她揽进怀里，低头吻了她。
△林晚闭上眼睛，心跳如鼓，却伸手环住了他的脖子。`;

// 有名无实：身份挂了一堆，两人从不同框、零亲密
const ZH_DECORATIVE = `场景1：内景·林宅·日
△林母叮嘱女儿：你未婚夫可是顾家的继承人，这门婚事关系两家公司，结婚后你就是名正言顺的顾太太。
林晚：我知道，婚礼定在下个月。
△林父补充：离婚的话林家要赔三倍违约金，所以无论如何这段夫妻关系都要维持。

场景2：内景·公司·日
△林晚独自处理并购案，开了一整天的会。

场景3：外景·街边·夜
△她一个人走回家，路灯把影子拉得很长。`;

// 突飞猛进：前面零心动节拍，中后段直接吻
const ZH_INSTANT = `场景1：内景·公司·日
△林晚抱着文件穿过工位区，电梯门开了，她走进去按下楼层。
△会议室里她汇报了第三季度的财报数据，高管们轮流提问，她一一作答。

场景2：内景·停车场·夜
△加班结束，顾聿靠在车边等她。
△他把一沓资料塞进她怀里，转身要走。
△林晚追上去想再问一个合同条款，顾聿突然回身，一把抱住她，低头吻了她。`;

// 一路糖水：亲密不断，零误会零阻力
const ZH_SWEET = `场景1：外景·游乐园·日
△林晚看到棉花糖眼睛一亮，顾聿笑了，凑近她耳边说想要就亲我一下，她脸红着轻轻碰了碰他的脸颊。

场景2：内景·旋转木马·黄昏
△他牵起她的手，两人十指相扣，林晚心跳加速，把头靠在他肩上。

场景3：外景·摩天轮·夜
△升到最高处时，顾聿低头吻了她，林晚闭上眼睛，环住他的脖子。

场景4：内景·顾聿家·夜
△他把她抱起来转了一圈，再次吻住她，说今晚的她最好看。`;

// 只暧昧不推进：心跳脸红一堆，没有任何关系突破
const ZH_STAGNANT = `场景1：内景·教室·日
△林晚看到他走进来就心跳加速，赶紧用书挡住脸，耳尖发红。

场景2：内景·图书馆·日
△他在对面坐下，她一直偷偷抬眼看他，四目相对时又慌忙移开目光，脸颊发烫。
△他递来一块橡皮，她接住时指尖相碰，整个人像被电到一样缩了一下。

场景3：外景·操场·黄昏
△跑步时他放慢速度等她，她呼吸急促，却一直和他保持着半臂距离。

场景4：内景·走廊·夜
△晚自习结束，他在走廊尽头对她笑了一下，她低下头，攥紧书包带快步走开。`;

// 告知式爱情：全靠旁白宣告，没有可拍摄的心动动作（有关系锚点，不是非情感题材）
const ZH_TOLD = `场景1：内景·出租屋·夜
△林晚看着前男友留下的钥匙，才意识到自己早就爱上了未婚夫顾聿。
△她对着镜子发呆，不得不承认，自己心里全是他。

场景2：内景·公司·日
△开会时她一直看着他发言的样子，发现自己已经深深地爱上了他。
△顾聿把文件推到她面前，她接过说了声谢谢，全程没有任何多余的表情。`;

// 非情感题材（复仇商战）：零关系信号，应豁免满分
const ZH_REVENGE = `场景1：内景·董事会·日
△林夏甩出审计报告，三名董事伪造交易的证据当场曝光，记者蜂拥而至。
△她当众宣布罢免陈董事长，反对者的投票被她提前拿到的授权书全数反杀。

场景2：内景·车库·夜
△陈总雇人堵她，保安队按埋伏信号冲出，将对方制服并当场报警。
△警察铐上主谋，涉案账户当晚被冻结。

场景3：内景·庆功宴·夜
△收购完成，对手公司全员离场，林夏站在落地窗前签下最终协议，全场死寂。`;

// 英文健康甜宠（铺垫→误会→表白→吻）
const EN_HEALTHY = `INT. OFFICE PANTRY - DAY
When Gu Yu walked in, Lin Wan's heart skipped a beat. She looked down, ears burning.
He handed her a coffee; their fingers brushed and both froze for a second.

INT. MEETING ROOM - DAY
An intern straightened Gu Yu's tie in public. Lin Wan knocked over her files, jealous.
Gu Yu caught her eye and teased: "Is someone jealous?" She spent the whole day not talking to him, misunderstanding his joke.

EXT. OFFICE BUILDING - NIGHT
Working late, Gu Yu draped his coat over her shoulders and grabbed her wrist.
GU YU: The person I like has always been you.
He held her hand, fingers intertwined, and she did not pull away.

INT. GU YU'S APARTMENT - NIGHT
They were officially dating. He pulled her close and kissed her, and she wrapped her arms around his neck.`;

// 英文突飞猛进：无铺垫直接床戏/吻
const EN_INSTANT = `INT. OFFICE - DAY
Lin Wan carried files across the floor, rode the elevator, and presented quarterly numbers in the boardroom.
Executives took turns asking questions and she answered each one.

INT. PARKING GARAGE - NIGHT
Gu Yu leaned against his car and handed her a stack of documents.
She chased after him with a contract question. He turned around suddenly, hugged her, and kissed her on the lips.`;

test('中文健康甜宠剧应得高分且无问题', () => {
  const r = relationshipProgressionCheck(ZH_HEALTHY, 'zh');
  assert.equal(r.hasRomanceLine, true, 'should detect romance line');
  assert.ok(r.score >= 70, `score should be >=70, got ${r.score}`);
  assert.equal(r.issues.length, 0, `issues: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.weakCount >= 2, 'should have heartbeat beats before intimacy');
  assert.ok(r.strongCount >= 2, 'should have confession + kiss');
  assert.ok(r.obstacleCount >= 1, 'should have misunderstanding obstacle');
  assert.ok(r.upgradeCount >= 1, 'should have relationship upgrade');
});

test('有名无实应触发 decorative_relationship（high）', () => {
  const r = relationshipProgressionCheck(ZH_DECORATIVE, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'decorative_relationship' && i.severity === 'high'),
    `got: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.anchorCount >= 2);
  assert.equal(r.interactionCount, 0);
});

test('突飞猛进应触发 instant_love（high）', () => {
  const r = relationshipProgressionCheck(ZH_INSTANT, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'instant_love' && i.severity === 'high'),
    `got: ${r.issues.map((i) => i.type).join(',')}`);
  assert.equal(r.weakBeforeStrongCount, 0);
  assert.ok(r.firstStrongPosition > 0.15);
});

test('一路糖水应触发 sweet_no_obstacle（mid）且不触发 instant_love', () => {
  const r = relationshipProgressionCheck(ZH_SWEET, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'sweet_no_obstacle'),
    `got: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(!r.issues.some((i) => i.type === 'instant_love'), '有暧昧铺垫不应判突飞猛进');
  assert.equal(r.obstacleCount, 0);
  assert.ok(r.strongCount >= 2);
});

test('只暧昧不推进应触发 stagnant_romance（mid）', () => {
  const r = relationshipProgressionCheck(ZH_STAGNANT, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'stagnant_romance'),
    `got: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.weakCount >= 3);
  assert.equal(r.strongCount, 0);
  assert.equal(r.upgradeCount, 0);
});

test('告知式爱情应触发 told_not_shown_love（low）', () => {
  const r = relationshipProgressionCheck(ZH_TOLD, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'told_not_shown_love'),
    `got: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.tellingCount >= 2);
  assert.ok(r.weakCount < 2);
});

test('复仇/商战题材零情感信号应豁免（满分且 hasRomanceLine=false）', () => {
  const r = relationshipProgressionCheck(ZH_REVENGE, 'zh');
  assert.equal(r.score, 100);
  assert.equal(r.hasRomanceLine, false);
  assert.equal(r.issues.length, 0);
});

test('空文本不应崩溃且返回满分', () => {
  const r = relationshipProgressionCheck('   ', 'zh');
  assert.equal(r.score, 100);
  assert.equal(r.hasRomanceLine, false);
});

test('英文健康甜宠剧应得高分且无问题', () => {
  const r = relationshipProgressionCheck(EN_HEALTHY, 'en');
  assert.equal(r.hasRomanceLine, true);
  assert.ok(r.score >= 70, `score=${r.score}`);
  assert.equal(r.issues.length, 0, `issues: ${r.issues.map((i) => i.type).join(',')}`);
  assert.ok(r.weakBeforeStrongCount >= 1);
  assert.ok(r.obstacleCount >= 1);
});

test('英文突飞猛进应触发 instant_love', () => {
  const r = relationshipProgressionCheck(EN_INSTANT, 'en');
  assert.ok(r.issues.some((i) => i.type === 'instant_love'),
    `got: ${r.issues.map((i) => i.type).join(',')}`);
  assert.equal(r.weakBeforeStrongCount, 0);
});

test('开场15%内的强亲密（已婚日常）不触发 instant_love', () => {
  const text = `场景1：内景·卧室·清晨
△顾聿醒来，低头吻了吻妻子的额头，林晚脸红着推开他，笑骂了一句，他又抱住她不放。
△楼下传来早餐的香味，两人十指相扣下了楼。
场景2：内景·餐厅·日
△婆婆提起抱孙子的事，林晚一阵害羞，顾聿握住她的手替她解围。`;
  const r = relationshipProgressionCheck(text, 'zh');
  assert.ok(!r.issues.some((i) => i.type === 'instant_love'),
    `开场即夫妻设定不应判突飞猛进: ${r.issues.map((i) => i.type).join(',')}`);
});

test('英文模式输出不得含中文', () => {
  const r = relationshipProgressionCheck(EN_INSTANT, 'en');
  for (const i of r.issues) {
    assert.ok(!/[\u4e00-\u9fff]/.test(i.evidence), `evidence has Chinese: ${i.evidence}`);
    assert.ok(!/[\u4e00-\u9fff]/.test(i.advice), `advice has Chinese: ${i.advice}`);
  }
});

test('分数与字段边界合法', () => {
  const r = relationshipProgressionCheck(ZH_HEALTHY, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(Number.isInteger(r.score));
  for (const h of [...r.anchorHits, ...r.strongHits, ...r.weakHits]) {
    assert.ok(h.position >= 0 && h.position <= 1, `position out of range: ${h.position}`);
    assert.ok(typeof h.strong === 'boolean');
  }
  if (r.firstStrongPosition !== null) {
    assert.ok(r.firstStrongPosition >= 0 && r.firstStrongPosition <= 1);
  }
  assert.ok(r.weakBeforeStrongCount >= 0);
});
