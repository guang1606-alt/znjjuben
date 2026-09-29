'use strict';
// v2.134 冲突升级阶梯检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { conflictEscalationCheck } = require('../dist/engine/conflict-escalation-check.js');

// —— 中文健康：四场烈度 1→2→3→3，动作多样 ——
const ZH_HEALTHY = `场景一 办公室
林晚冷笑一声：你挪用公款的事，以为没人知道？
赵天成皱眉：你别血口喷人。
林晚：那我们等着瞧。
场景二 会议室
赵天成猛拍桌子：把她给我赶出去！
他撕碎了手里的合同。
赵天成威胁道：再查下去，别怪我不客气。
场景三 走廊
林晚一巴掌扇在他脸上。
赵天成怒吼：报警！把她抓起来！
警笛声响起，两名警察冲进门。
场景四 法庭
赵天成被警察押走。
林晚：你破产的消息，明天就会上头条。
赵天成被摁住，仍死死瞪着她。`;

// —— 全程口角：三场只有冷笑/质问/争吵，没有任何实质动作 ——
const ZH_NO_PEAK = `场景一 茶水间
林晚冷笑：这事没完。
赵天成皱眉：你想怎样？
林晚：你心里清楚。
场景二 办公室
两人争吵了半天。
林晚质问他资金的去向，他只是皱眉。
赵天成不耐烦地转过身。
场景三 电梯口
林晚冷哼一声，扭头就走。
赵天成立在原地，挂断电话。
林晚回头瞪了他一眼。`;

// —— 原地踏步：三场都在"威胁/摔砸"档，一场都没冲上高潮 ——
const ZH_FLAT = `场景一 办公室
赵天成拍桌怒吼。
他威胁林晚不要再查。
林晚冷笑不语。
场景二 会议室
他摔门而去，撕碎了手边的文件。
赵天成怒吼着让所有人滚出去。
场景三 走廊
赵天成把林晚赶出去，拉黑了她所有联系方式。
他指着她的鼻子放下狠话。`;

// —— 开局即顶格：第一场绑架报警，后面只剩口角 ——
const ZH_FRONT = `场景一 仓库
赵天成绑架了孩子，林晚当场报警，警察冲进仓库。
场景二 客厅
林晚冷笑：你以为这样就能吓到我？
赵天成皱眉不语。
场景三 门口
赵天成扭头就走，林晚在身后冷笑。
场景四 车内
林晚挂断电话，望着窗外。`;

// —— 跳台阶：前两场口角，第三场直接掏刀见血 ——
const ZH_ABRUPT = `场景一 餐厅
林晚冷笑：你骗了我多久？
赵天成皱眉：你听我解释。
林晚质问他账户里的钱去了哪里。
场景二 车内
两人争吵起来。
赵天成不耐烦地让她闭嘴。
林晚冷哼一声扭过头。
场景三 停车场
赵天成掏出刀，一刀见血。
林晚倒在血泊里，他愣住了。`;

// —— 手段贫乏：正常升级到高潮，但翻来覆去只有拍桌、摔门 ——
const ZH_NARROW = `场景一 办公室
赵天成拍桌怒吼，又拍桌威胁。
林晚站在原地不动。
场景二 会议室
他再次拍桌，摔门而去。
片刻后又摔门回来，拍桌咆哮。
场景三 办公室
林晚当场报警。
赵天成最后一次拍桌，随即被警察带走。`;

// —— 英文健康：1→2→3→3，动作多样 ——
const EN_HEALTHY = `SCENE 1. OFFICE
Emma glared at him. "You embezzled the funds."
Jack frowned. "Don't accuse me."
Emma: We'll see about that.
SCENE 2. BOARDROOM
Jack slammed the table. "Get her out!"
He tore up the contract in his hand.
Jack threatened her to stop digging.
SCENE 3. HALLWAY
Emma slapped him across the face.
Jack shouted, "Call the police!"
Two officers burst through the door.
SCENE 4. COURT
Jack was arrested by the police.
Emma: Your bankruptcy makes headlines tomorrow.
He was pinned down, still glaring at her.`;

const EN_NO_PEAK = `SCENE 1. PANTRY
Emma glared. "This isn't over."
Jack frowned. "What do you want?"
Emma: You know exactly what.
SCENE 2. OFFICE
They argued for a long time.
Emma snapped at him about the missing money.
He turned away dismissively.
SCENE 3. ELEVATOR
Emma rolled her eyes and walked off.
She hung up without a word.
Jack scoffed in the empty hallway.`;

const EN_FRONT = `SCENE 1. WAREHOUSE
He kidnapped the child; she called the cops and the police stormed in.
SCENE 2. LIVING ROOM
Emma glared. "You think this scares me?"
Jack frowned in silence.
SCENE 3. DOOR
Jack walked off while Emma glared at his back.
SCENE 4. CAR
She hung up and stared out the window.`;

const EN_ABRUPT = `SCENE 1. RESTAURANT
Emma glared. "How long have you lied to me?"
Jack frowned. "Let me explain."
She retorted, asking where the money went.
SCENE 2. CAR
They argued the whole way.
Jack told her to shut up.
Emma scoffed and looked away.
SCENE 3. PARKING LOT
Jack stabbed him, blood pooling on the ground.
An ambulance arrived minutes later.`;

const CJK = /[\u4e00-\u9fff]/;

test('中文健康冲突应逐级爬坡且无问题', () => {
  const r = conflictEscalationCheck(ZH_HEALTHY, 'zh');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际：${JSON.stringify(r.issues)}`);
  assert.ok(r.score >= 75, `分数应≥75，实际 ${r.score}`);
  assert.deepStrictEqual(r.levels, [1, 2, 3, 3]);
  assert.strictEqual(r.maxLevel, 3);
  assert.strictEqual(r.firstWindowLevel, 1);
  assert.strictEqual(r.abruptIndex, -1);
  assert.ok(r.actionKinds >= 3, `冲突动作应≥3种，实际 ${r.actionKinds}`);
});

test('全程口角无高潮应触发 no_peak（mid）', () => {
  const r = conflictEscalationCheck(ZH_NO_PEAK, 'zh');
  const np = r.issues.find((i) => i.type === 'no_peak');
  assert.ok(np, '应有 no_peak 问题');
  assert.strictEqual(np.severity, 'mid');
  assert.strictEqual(r.maxLevel, 1);
  assert.ok(r.score < 95, `应扣分，实际 ${r.score}`);
});

test('中档烈度原地踏步应触发 flat_conflict（high）', () => {
  const r = conflictEscalationCheck(ZH_FLAT, 'zh');
  const f = r.issues.find((i) => i.type === 'flat_conflict');
  assert.ok(f, '应有 flat_conflict 问题');
  assert.strictEqual(f.severity, 'high');
  assert.ok(r.levels.every((lv) => lv === 2), `应全为2档，实际 ${r.levels}`);
  // 不应同时误判 no_peak / front_loaded
  assert.ok(!r.issues.some((i) => i.type === 'no_peak'));
  assert.ok(!r.issues.some((i) => i.type === 'front_loaded'));
});

test('开局即顶格后续接不住应触发 front_loaded（mid）', () => {
  const r = conflictEscalationCheck(ZH_FRONT, 'zh');
  const f = r.issues.find((i) => i.type === 'front_loaded');
  assert.ok(f, '应有 front_loaded 问题');
  assert.strictEqual(f.severity, 'mid');
  assert.strictEqual(r.firstWindowLevel, 3);
  assert.ok(Math.max(...r.levels.slice(1)) < 3);
});

test('口角直跳生死档应触发 abrupt_escalation（mid）', () => {
  const r = conflictEscalationCheck(ZH_ABRUPT, 'zh');
  const a = r.issues.find((i) => i.type === 'abrupt_escalation');
  assert.ok(a, '应有 abrupt_escalation 问题');
  assert.strictEqual(a.severity, 'mid');
  assert.strictEqual(r.abruptIndex, 2);
});

test('冲突手段单调应触发 narrow_methods（low）', () => {
  const r = conflictEscalationCheck(ZH_NARROW, 'zh');
  const n = r.issues.find((i) => i.type === 'narrow_methods');
  assert.ok(n, '应有 narrow_methods 问题');
  assert.strictEqual(n.severity, 'low');
  assert.ok(r.actionKinds <= 2, `动作种类应≤2，实际 ${r.actionKinds}`);
  const total = r.actionFrequency.reduce((s, a) => s + a.count, 0);
  assert.ok(total >= 6, `动作总数应≥6，实际 ${total}`);
  // 有正常升级到 3，不应误判 flat/abrupt
  assert.ok(!r.issues.some((i) => i.type === 'flat_conflict'));
  assert.strictEqual(r.abruptIndex, -1);
});

test('空文本/超短文本应返回满分不崩溃', () => {
  const r1 = conflictEscalationCheck('', 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.issues.length, 0);
  const r2 = conflictEscalationCheck('你好', 'zh');
  assert.strictEqual(r2.score, 100);
  // 有内容但冲突信号不足 4 个：不评结构
  const r3 = conflictEscalationCheck('场景一\n林晚冷笑：你好。\n场景二\n赵天成皱眉：早。', 'zh');
  assert.strictEqual(r3.score, 100);
  assert.strictEqual(r3.issues.length, 0);
});

test('英文健康冲突应逐级爬坡且无问题', () => {
  const r = conflictEscalationCheck(EN_HEALTHY, 'en');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际：${JSON.stringify(r.issues)}`);
  assert.ok(r.score >= 75, `分数应≥75，实际 ${r.score}`);
  assert.deepStrictEqual(r.levels, [1, 2, 3, 3]);
  assert.strictEqual(r.maxLevel, 3);
  assert.strictEqual(r.abruptIndex, -1);
  assert.ok(r.actionKinds >= 3);
});

test('英文全程口角应触发 no_peak', () => {
  const r = conflictEscalationCheck(EN_NO_PEAK, 'en');
  assert.ok(r.issues.some((i) => i.type === 'no_peak'), JSON.stringify(r.issues));
  assert.strictEqual(r.maxLevel, 1);
});

test('英文开局即顶格应触发 front_loaded', () => {
  const r = conflictEscalationCheck(EN_FRONT, 'en');
  assert.ok(r.issues.some((i) => i.type === 'front_loaded'), JSON.stringify(r.issues));
  assert.strictEqual(r.firstWindowLevel, 3);
});

test('英文跳台阶应触发 abrupt_escalation', () => {
  const r = conflictEscalationCheck(EN_ABRUPT, 'en');
  assert.ok(r.issues.some((i) => i.type === 'abrupt_escalation'), JSON.stringify(r.issues));
  assert.strictEqual(r.abruptIndex, 2);
});

test('英文模式输出不得含中文', () => {
  for (const fx of [EN_NO_PEAK, EN_FRONT, EN_ABRUPT]) {
    const r = conflictEscalationCheck(fx, 'en');
    for (const i of r.issues) {
      assert.ok(!CJK.test(i.evidence), `evidence 含中文：${i.evidence}`);
      assert.ok(!CJK.test(i.advice), `advice 含中文：${i.advice}`);
    }
  }
});

test('字段边界合法', () => {
  const r = conflictEscalationCheck(ZH_HEALTHY, 'zh');
  assert.ok(Number.isFinite(r.score) && r.score >= 0 && r.score <= 100);
  assert.strictEqual(r.levels.length, r.windowCount);
  for (const lv of r.levels) assert.ok([0, 1, 2, 3].includes(lv));
  assert.ok(r.maxLevel >= 0 && r.maxLevel <= 3);
  assert.ok(r.abruptIndex >= -1 && r.abruptIndex < r.windowCount);
  assert.ok(Array.isArray(r.actionFrequency));
  for (const i of r.issues) {
    assert.ok(['high', 'mid', 'low'].includes(i.severity));
    assert.ok(i.evidence.length > 0 && i.advice.length > 0);
  }
});
