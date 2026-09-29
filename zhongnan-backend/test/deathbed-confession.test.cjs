'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { deathbedConfession } = require('../dist/engine/deathbed-confession.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(deathbedConfession('').score, 100);
  assert.strictEqual(deathbedConfession('  \n ').score, 100);
  assert.strictEqual(deathbedConfession('').hitCount, 0);
});

test('zh: 单次临终全招豁免不扣分（ICU 场景头强锚）', () => {
  const draft = [
    '内景 ICU重症监护室 夜',
    '△林伟冲到病床前。',
    '林伟：爸，你要说什么？',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松，监护仪发出长鸣。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次临终全招 → 70，元数据落情报行（血泊叙述锚 + 垂死叙述锚）', () => {
  const draft = [
    '内景 小巷 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松。',
    '△墙根的杂草被风吹得乱晃。',
    '△巷口有车灯扫过。',
    '内景 林家老宅 夜',
    '△外婆躺在里屋，奄奄一息。',
    '林伟：外婆，当年还有谁？',
    '外婆：内鬼是管家老吴，钱藏在祠堂地砖下。',
    '△外婆头一歪，彻底没了气息。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 11);
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(h.sceneHeader.includes('老宅'));
  assert.ok(h.snippet.includes('外婆'));
  assert.ok(h.marker.includes('→'));
  assert.ok(h.marker.includes('奄奄一息'));
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('临终全招'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('半个'));
});

test('zh: 三次临终全招 n=2 → 50（旧案/同伙/地点多族 payload）', () => {
  const draft = [
    '内景 小巷 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松。',
    '△墙根的杂草被风吹得乱晃。',
    '△巷口有车灯扫过。',
    '内景 林家老宅 夜',
    '△外婆奄奄一息。',
    '林伟：还有谁？',
    '外婆：内鬼是管家老吴，钱藏在祠堂地砖下。',
    '△外婆头一歪，彻底没了气息。',
    '△走廊的灯忽明忽暗。',
    '△雨水顺着瓦当往下滴。',
    '内景 医院走廊 夜',
    '△福伯靠在墙角，浑身是血，出气多进气少。',
    '林伟：福伯！',
    '福伯：当年那桩纵火案也是我干的，人质关在码头冷库。',
    '△福伯咽了气。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('临终全招'));
});

test('zh: 纯情感遗言放行（垂死+死亡但无实质情报）', () => {
  const draft = [
    '内景 老宅卧室 夜',
    '△外婆弥留之际，林伟握住她的手。',
    '外婆：照顾好妹妹，妈不怪你，好好过日子。',
    '△林伟含泪点头。',
    '△外婆手一松，永远地闭上了眼。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 垂死但没死放行（血泊中给情报，送医救活，死亡窗口内无封口锚）', () => {
  const draft = [
    '内景 废弃仓库 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！谁干的？',
    '老陈：杀你爹的人是张四海，账本埋在后山。',
    '△救护车鸣笛，医护冲进来把人抬走。',
    '△手术灯亮了一夜。',
    '△走廊里全是脚步声。',
    '△三天后，老陈脱离危险，能坐起来喝粥了。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 活人转述"我妈临终前说"放行（无现场死亡封口锚）', () => {
  const draft = [
    '内景 咖啡馆 日',
    '林伟：我妈临终前留过一句话，杀她的人是张四海。',
    '周彤：那我们去查，别让这句话白说。',
    '林伟：这些年我查了很多地方。',
    '周彤：先从账本开始。',
    '△窗外车水马龙。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: ICU 场景头强锚成立（无行内垂死叙述锚，照样命中第2次事件）', () => {
  const draft = [
    '内景 小巷 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松。',
    '△墙根的杂草被风吹得乱晃。',
    '△巷口有车灯扫过。',
    '内景 ICU重症监护室 夜',
    '△林伟扑到病床前。',
    '林伟：老福，你还认得我吗？',
    '福伯：内鬼是管家老吴，钱藏在祠堂地砖下。',
    '△福伯手一松，监护仪拉直成一条直线。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].sceneIndex, 1);
  assert.strictEqual(r.hits[0].line, 11);
  assert.strictEqual(r.score, 70);
});

test('zh: 普通病房弱头不锚（好转出院，无垂死叙述锚无死亡）', () => {
  const draft = [
    '内景 市立医院普通病房 日',
    '△林伟端着粥坐到床边。',
    '外婆：今天精神好多了，扶我坐起来。',
    '林伟：医生说明天就能出院。',
    '外婆：等出院了，给我熬碗糖水蛋。',
    '△阳光落在床头柜上。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 残缺谜——真凶名字只吐出一半，声音断了（rescued=true）', () => {
  const draft = [
    '内景 小巷 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松。',
    '△墙根的杂草被风吹得乱晃。',
    '△巷口有车灯扫过。',
    '内景 老宅 夜',
    '△外婆已经奄奄一息，嘴唇发白。',
    '林伟：外婆，是谁？',
    '外婆：杀你爹的人是……张……',
    '△外婆声音越来越小，手一松，再没睁开眼。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 求证代价——半本账本，剩下的要自己查（rescued=true）', () => {
  const draft = [
    '内景 小巷 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松。',
    '△墙根的杂草被风吹得乱晃。',
    '△巷口有车灯扫过。',
    '内景 老宅 夜',
    '△福伯奄奄一息，血顺着嘴角往下淌。',
    '林伟：证据呢？',
    '福伯：账本就埋在祠堂下，我只拿到半本，剩下的你要自己去查。',
    '△福伯手一松，头一歪。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 守口挣扎——秘密守了三十年，答应带进棺材才松口（rescued=true）', () => {
  const draft = [
    '内景 小巷 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松。',
    '△墙根的杂草被风吹得乱晃。',
    '△巷口有车灯扫过。',
    '内景 老宅 夜',
    '△奶奶气若游丝，躺在林伟怀里。',
    '林伟：奶奶，告诉我。',
    '奶奶：这事我守了三十年，答应过你爷爷带进棺材……杀你爹的人是张四海，账本埋在老槐树下。',
    '△奶奶手一松，永远地闭上了眼。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 词落在窗口外不救（事后旁白提及守了三十年，rescued=false → 70）', () => {
  const draft = [
    '内景 小巷 夜',
    '△老陈倒在血泊里，气若游丝。',
    '林伟：爸！',
    '老陈：杀你爹的人是张四海，账本埋在后山老槐树下。',
    '△老陈手一松。',
    '△墙根的杂草被风吹得乱晃。',
    '△巷口有车灯扫过。',
    '内景 老宅 夜',
    '△外婆奄奄一息。',
    '林伟：快说！',
    '外婆：内鬼是管家老吴，钱藏在祠堂地砖下。',
    '△外婆手一松。',
    '△窗外的雨下得很急。',
    '△油灯晃了两下。',
    '△后来林伟才知道，那个名字她守了三十年。',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* ============ 英文 ============ */

test('en: 两次临终全招 → 70，元数据完整，英文串零中文', () => {
  const draft = [
    'INT. ABANDONED ALLEY - NIGHT',
    '△Chen lies in a pool of blood, gasping for air.',
    'LIN WEI: Dad! Hold on!',
    'CHEN: The killer is Zhang Sihai. The ledger is buried under the old tree.',
    '△His hand dropped. He went still.',
    '△A cold wind swept the alley.',
    '△Somewhere a siren wailed.',
    'INT. OLD HOUSE BEDROOM - NIGHT',
    '△Granny Fu lay there, life slipping away.',
    'LIN WEI: Who else was there?',
    'GRANNY FU: My partner was Zhou. The money is hidden in the cellar.',
    '△She took her last breath, her head lolled.',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 11);
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(h.sceneHeader.includes('BEDROOM'));
  assert.ok(h.snippet.includes('GRANNY FU'));
  assert.ok(h.marker.includes('→'));
  assert.ok(h.marker.includes('life slipping'));
  assert.strictEqual(h.rescued, false);
  assert.strictEqual(r.score, 70);
  for (const s of [...r.issues, ...r.advice, h.reason]) {
    assert.ok(!/[一-鿿]/.test(s), `CJK leaked into EN string: ${s}`);
  }
});

test('en: rescue 残缺谜——名字断在省略号，voice trailed off（rescued=true）', () => {
  const draft = [
    'INT. ABANDONED ALLEY - NIGHT',
    '△Chen lies in a pool of blood, gasping for air.',
    'LIN WEI: Dad!',
    'CHEN: The killer is Zhang Sihai. The ledger is buried under the old tree.',
    '△His hand dropped. He went still.',
    '△A cold wind swept the alley.',
    '△Somewhere a siren wailed.',
    'INT. OLD HOUSE BEDROOM - NIGHT',
    '△Grandma was fading fast on the bed.',
    'LIN WEI: Who did it?',
    'GRANDMA: The killer is... Zh...',
    '△Her voice trailed off. The monitor went flat.',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: rescue 求证代价——half the truth, find the rest yourself（rescued=true）', () => {
  const draft = [
    'INT. ABANDONED ALLEY - NIGHT',
    '△Chen lies in a pool of blood, gasping for air.',
    'LIN WEI: Dad!',
    'CHEN: The killer is Zhang Sihai. The ledger is buried under the old tree.',
    '△His hand dropped. He went still.',
    '△A cold wind swept the alley.',
    '△Somewhere a siren wailed.',
    'INT. OLD HOUSE BEDROOM - NIGHT',
    '△Uncle Fu was dying, only minutes to live.',
    'LIN WEI: Where is the evidence?',
    'FU: The ledger is buried under the shrine, but I only have half the truth - the rest you have to find yourself.',
    '△His hand dropped and he was gone.',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.ok(!/[一-鿿]/.test(r.hits[0].reason));
});

test('en: "dying to know" 渴望语不误锚 + 纯情感遗言放行（0 事件）', () => {
  const draft = [
    'INT. CAFE - DAY',
    'LIN WEI: I\'m dying to know what really happened that night.',
    'ZHOU TONG: Me too. Let us start with the old files.',
    '△Coffee steamed between them.',
    'INT. HOSPICE ROOM - NIGHT',
    'GRANDMA: Take care of your sister for me.',
    'LIN WEI: I will, Grandma.',
    'GRANDMA: Live a good life.',
    '△She took her last breath and went still.',
  ].join('\n');
  const r = deathbedConfession(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});
