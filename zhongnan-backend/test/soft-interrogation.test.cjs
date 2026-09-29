'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { softInterrogation } = require('../dist/engine/soft-interrogation.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(softInterrogation('').score, 100);
  assert.strictEqual(softInterrogation('  \n ').score, 100);
  assert.strictEqual(softInterrogation('').hitCount, 0);
});

test('zh: 单次审讯秒招豁免不扣分（场景头锚定语境）', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子，台灯跟着一跳。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次秒招命中 → 70，元数据落供词行，相邻压力行合并', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 审讯室 夜',
    '△老周又是一掌拍在桌面上。',
    '老周：你呢？招不招！',
    '李四：扛不住了，钱藏在郊外桥洞下，我们计划明天提货。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 10);
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(h.sceneHeader.includes('审讯室'));
  assert.ok(h.snippet.includes('李四'));
  assert.ok(h.marker.includes('→'));
  assert.ok(h.marker.includes('一掌拍在'));
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('审讯秒招'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('证据'));
});

test('zh: 三次秒招 n=2 → 50（同伙/地点+计划/旧案三族 payload）', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 审讯室 夜',
    '△老周一掌拍在桌面上。',
    '老周：招不招！',
    '李四：扛不住了，钱藏在郊外桥洞下，我们计划明天提货。',
    '△风从铁窗灌进来。',
    '△楼道深处传来铁门声。',
    '内景 审讯室 夜',
    '△老周厉声吼道：最后一次机会！',
    '王五：我全说，三年前那桩纵火案也是我干的。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('审讯秒招'));
});

test('zh: 纯短认无实质 payload 放行（"我招了，是我干的"不含可消费情报）', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我招了，是我干的，我认罪。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 审讯室 夜',
    '△老周又是一掌拍在桌面上。',
    '老周：你到底招不招！',
    '李四：我交代，人是我捅的，我认。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 无关押语境的拍桌吵架放行（夫妻吵架不归本引擎）', () => {
  const draft = [
    '内景 林家客厅 夜',
    '△林建国猛拍桌子。',
    '林建国：你说不说！',
    '林曼：我全说了，钱是我转的，账在我抽屉里。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 无场景头时 ±6 行内羁押叙述锚成立（审讯桌/手铐/对面坐着刑警）', () => {
  const draft = [
    '△灯管照着冰冷的审讯桌，陈三被铐在铁椅子上。',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '△陈三被押回审讯椅，对面坐着刑警老周。',
    '△老周一掌拍在桌面上。',
    '老周：招不招！',
    '李四：扛不住了，钱藏在郊外桥洞下。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.ok(r.hits[0].snippet.includes('李四'));
});

test('zh: 场景头不参与压力/供词匹配，且平静讯问（有语境无压力）放行', () => {
  const headerOnly = [
    '第3场：拍桌！说不说！',
    '△陈三被铐在审讯椅上，对面坐着刑警老周。',
    '陈三：我全招了，同伙是刀哥，人质关在码头。',
  ].join('\n');
  assert.strictEqual(softInterrogation(headerOnly).hitCount, 0);

  const calm = [
    '内景 审讯室 夜',
    '△老周平静地翻开笔录，台灯安安静静。',
    '老周：陈先生，十月三号晚上你在哪里？',
    '陈三：我在家看书，哪儿也没去。',
  ].join('\n');
  const r = softInterrogation(calm);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 证据博弈——监控甩上桌、用细节挤口供 → rescued', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 审讯室 夜',
    '△老周把监控录像甩在桌上，又把照片推到他面前。',
    '老周：拍到了你，招不招！',
    '李四：扛不住了，钱藏在郊外桥洞下。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 交易——戴罪立功、减刑、保家人 → rescued', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 审讯室 夜',
    '△老周一掌拍在桌面上。',
    '李四：我要做个交易，戴罪立功减刑，你们放了我女儿。',
    '李四：扛不住了，钱藏在郊外桥洞下。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 拉锯消耗——僵持六小时换三拨、沉默、要律师 → rescued', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 审讯室 夜',
    '△僵持了六个小时，换了三拨人，他始终沉默，只说要见律师。',
    '老周：最后一次机会，招不招！',
    '李四：扛不住了，钱藏在郊外桥洞下。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 窗口外的用刑过程不救本场秒招（±2 行划界）', () => {
  const draft = [
    '内景 审讯室 夜',
    '△老周猛拍桌子。',
    '老周：说不说！',
    '陈三：我全招了，同伙是刀哥，人质押在码头仓库。',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 审讯室 夜',
    '△老周一掌拍在桌面上。',
    '老周：招不招！',
    '李四：扛不住了，钱藏在桥洞下。',
    '△一。',
    '△二。',
    '△三。',
    '△他们打了一整夜，他昏死过去，又被泼凉水浇醒。',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* ============ English ============ */

test('en: first soft interrogation exempt, second counted → 70 with metadata', () => {
  const draft = [
    'INT. INTERROGATION ROOM - NIGHT',
    'Detective Cho slammed his fist on the table.',
    'CHO: Talk!',
    "DANNY: Fine, I'll talk. My accomplice is Razor, the girl is held at the dock warehouse.",
    'The corridor hummed with an old fluorescent tube.',
    'Rain streaked the tall windows.',
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho got in his face and snarled.',
    'CHO: Last chance! We know everything.',
    'LEO: He made me do it, the money is buried under the bridge, the drop was at dawn.',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 10);
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(/INTERROGATION/.test(h.sceneHeader));
  assert.ok(/LEO/.test(h.snippet));
  assert.strictEqual(h.rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: evidence rescue - footage and DNA on the table → rescued', () => {
  const draft = [
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho slammed his fist on the table.',
    'CHO: Talk!',
    "DANNY: I'll talk. My accomplice is Razor, the girl is held at the docks.",
    'The corridor hummed with an old light.',
    'Rain streaked the windows.',
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho slid the footage across the table and threw the photos down.',
    'CHO: The DNA proves it. Talk!',
    'LEO: Fine. The money is buried under the bridge.',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: deal rescue - witness protection, in exchange for family → rescued', () => {
  const draft = [
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho slammed his fist on the table.',
    'CHO: Talk!',
    "DANNY: I'll talk, my accomplice is Razor.",
    'The corridor hummed with an old light.',
    'Rain streaked the windows.',
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho pinned him to the chair.',
    'LEO: I want to make a deal. Witness protection, in exchange for my family.',
    'LEO: Fine. The money is buried under the bridge.',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: resist rescue - six hours, third detective, lawyer, silence → rescued', () => {
  const draft = [
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho slammed his fist on the table.',
    'CHO: Talk!',
    "DANNY: I'll talk, my accomplice is Razor.",
    'The corridor hummed with an old light.',
    'Rain streaked the windows.',
    'INT. INTERROGATION ROOM - NIGHT',
    'Six hours into the interrogation, a third detective came into the room.',
    'He had asked for a lawyer and stayed silent the whole time.',
    'CHO: Talk! One last chance!',
    'LEO: Fine. The money is buried under the bridge.',
  ].join('\n');
  const r = softInterrogation(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: bare confession without payload and non-custody row pass; en result is CJK-free', () => {
  const bare = [
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho slammed his fist on the table.',
    'CHO: Talk!',
    'DANNY: Okay, I confess. I did it. I am guilty.',
  ].join('\n');
  assert.strictEqual(softInterrogation(bare).hitCount, 0);

  const couple = [
    'INT. KITCHEN - NIGHT',
    'He slammed his fist on the table.',
    'HIM: Talk!',
    'HER: Fine! I transferred the money, my partner is Mark.',
  ].join('\n');
  assert.strictEqual(softInterrogation(couple).hitCount, 0);

  const hit = softInterrogation([
    'INT. INTERROGATION ROOM - NIGHT',
    'Detective Cho slammed his fist on the table.',
    'CHO: Talk!',
    "DANNY: Fine, I'll talk. My accomplice is Razor, the girl is held at the dock warehouse.",
    'The corridor hummed with an old fluorescent tube.',
    'Rain streaked the tall windows.',
    'INT. INTERROGATION ROOM - NIGHT',
    'Cho got in his face and snarled.',
    'CHO: Last chance! We know everything.',
    'LEO: He made me do it, the money is buried under the bridge, the drop was at dawn.',
  ].join('\n'));
  assert.ok(hit.hits.length >= 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(hit)), 'English result must contain no CJK');
});
