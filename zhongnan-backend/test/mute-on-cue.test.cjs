'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { muteOnCue } = require('../dist/engine/mute-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(muteOnCue('').score, 100);
  assert.strictEqual(muteOnCue('  \n ').score, 100);
  assert.strictEqual(muteOnCue('').hitCount, 0);
});

test('zh: 单次惊吓秒失声（STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 旧宅 夜',
    '△那夜她目睹灭门惨案。',
    '△她一个字都说不出来，再也没有开口。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次惊吓秒失声未救 → 70，元数据落失声行', () => {
  const draft = [
    '内景 林家 夜',
    '△那夜她目睹灭门惨案。',
    '△她一个字都说不出来，再也没有开口。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被人灌了一碗哑药。',
    '△他哑了，成了哑巴。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('林家'));
  assert.ok(h.snippet.includes('哑巴'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('惊吓秒失声'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('喉镜'));
});

test('zh: onset 被 CAUSE 声带麻痹/喉返神经损伤救回', () => {
  const draft = [
    '内景 医院 夜',
    '△她被狠狠掐住了脖子。',
    '△她哑了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他撞伤了喉咙。',
    '△他声带麻痹，喉返神经损伤，再也发不出声音。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: onset 被 DIAG 耳鼻喉喉镜/心理科/确诊救回', () => {
  const draft = [
    '内景 医院 夜',
    '△她目睹凶案，吓坏了。',
    '△她再也说不出话。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△一场大病之后，他不会说话了。',
    '△耳鼻喉科安排了喉镜检查，心理科干预，确诊为癔症性失声。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: onset 被 PRICE 终身没开口/纸笔手语救回', () => {
  const draft = [
    '内景 山村 日',
    '△她被那场大火吓坏了。',
    '△她失声了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被毒坏了嗓子。',
    '△他再也没有开口，只能靠纸笔写字交流，学了手语。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: "金针扎一下开口"不救 onset，且自身另算 cure 事件', () => {
  const draft = [
    '内景 病房 日',
    '△那场大火后，她哑了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被灌了哑药。',
    '△他成了哑巴。',
    '△神医金针扎向哑穴，他立刻开口说话。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 3);
  const onsetHit = r.hits.find((h) => h.kind === 'onset');
  assert.ok(onsetHit);
  assert.strictEqual(onsetHit.rescued, false);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('zh: WEAK 语塞无言语失能语境——噩耗后张口无语放行', () => {
  const draft = [
    '内景 巷口 夜',
    '△他被这噩耗吓了一跳。',
    '△他张了张嘴，说不出话。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 失声锚 + 哭泣情绪语境——哭到说不出话放行', () => {
  const draft = [
    '内景 灵堂 日',
    '△她被那场大火吓坏了。',
    '△她不能说话，只是哭，喉咙像被堵住，说不出话。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 语塞 + 声带/失声语境兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 医院 日',
    '△她目睹凶案，吓坏了。',
    '△她张了张嘴，发不出声音，医生说是声带受损导致的失声。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 嘶吼到嗓子哑/沙哑——物理嘶哑整体豁免', () => {
  const draft = [
    '内景 废墟 夜',
    '△她受了惊吓，嘶吼到嗓子都哑了，声音沙哑。',
    '△她仍在瓦砾间找人。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 高烧后嗓子哑了（嘶哑非失声）放行', () => {
  const draft = [
    '内景 家中 日',
    '△她发了三天高烧。',
    '△她嗓子哑了，声音沙哑，多喝热水便好。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: "失声痛哭"是哭到出不了声，不是失声病', () => {
  const draft = [
    '内景 灵堂 日',
    '△她目睹灭门，吓得失声痛哭。',
    '△她跪在棺前不肯起身。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯失声陈述无病因放行（天生失语是人设）', () => {
  const draft = [
    '内景 家中 日',
    '△她天生失语，不能说话。',
    '△她用手比划着与人交流。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯受惊无失声锚放行（普通创伤反应）', () => {
  const draft = [
    '内景 旧宅 夜',
    '△她目睹灭门惨案。',
    '△她浑身发抖，缩在墙角。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 撞喉→昏迷→醒来失语归 wake-on-cue，本引擎让路', () => {
  const draft = [
    '内景 医院 日',
    '△他撞伤了喉咙，昏迷了三天。',
    '△他醒过来，失语了。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 单次金针秒复声（型B）豁免不扣分', () => {
  const draft = [
    '内景 医馆 日',
    '△神医拈起金针，扎向她的哑穴。',
    '△她猛地喊出声：娘。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('zh: 第2次廉价秒复声未救 → 70，kind=cure', () => {
  const draft = [
    '内景 医馆 日',
    '△神医扎了金针。',
    '△她突然能说话了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△孩子在火里哭喊着娘。',
    '△她脱口而出喊了一声。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'cure');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.marker.includes('→'));
  assert.ok(h.reason.includes('廉价秒复声'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('言语治疗'));
});

test('zh: cure 被 CPROCESS 言语治疗/嗓音训练/气声渐进救回', () => {
  const draft = [
    '内景 医馆 日',
    '△神医一针扎下。',
    '△她当场开口说话。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△名医为她再扎哑穴。',
    '△她立刻重新开口。',
    '△之后仍是数月言语治疗和嗓音训练，从气声开始慢慢练。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: cure 被 PARTIAL 气声/沙哑/说久了疼救回', () => {
  const draft = [
    '内景 医馆 日',
    '△神医给了一颗灵药。',
    '△她当场能说话了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△偏方又灌下一碗。',
    '△她终于开口，却只能发出气声，声音依旧沙哑，说久了嗓子就疼。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: cure 被 COST 倾家荡产/往事回来救回', () => {
  const draft = [
    '内景 医馆 日',
    '△神医施针。',
    '△她猛地喊出了声。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△金针再扎一回。',
    '△她立刻重新开口，可医药费让全家倾家荡产，开口那一刻往事全回来了。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 无触发物的缓慢好转放行（合法康复）', () => {
  const draft = [
    '内景 家中 日',
    '△两个月的言语治疗后，她一天比一天说得清楚。',
    '△医生说声带在慢慢恢复。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头不配对——受惊在一场失声在下一场放行', () => {
  const draft = [
    '内景 旧宅 夜',
    '△她目睹灭门惨案。',
    '内景 林家 日',
    '△她哑了。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻病因锚行合并为同一事件', () => {
  const draft = [
    '内景 柴房 夜',
    '△她被毒哑。',
    '△又被掐住了喉咙。',
    '△她再也说不出一个字。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 八事件密度封底 20，rescued 事件仍入 hits', () => {
  const draft = [
    '内景 长剧 夜',
    '△她目睹灭门，哑了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被毒哑，成了哑巴。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△一场高烧，她不会说话了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被掐住脖子，再也发不出声音。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△从那夜以后，她失声了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被灌哑药，一个字都说不出。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医扎针，她当场能说话了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△孩子哭喊着娘，他猛地喊出声。',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 8);
  assert.strictEqual(r.unrescuedCount, 7);
  assert.strictEqual(r.score, 20);
  assert.ok(r.hits.some((h) => h.kind === 'onset'));
  assert.ok(r.hits.some((h) => h.kind === 'cure'));
});

/* ============ English ============ */

test('en: empty draft scores 100', () => {
  assert.strictEqual(muteOnCue('').score, 100);
});

test('en: single shock-to-muteness (STRONG) exempt', () => {
  const draft = [
    'INT. OLD HOUSE - NIGHT',
    'She witnessed the murder that night.',
    'She went mute overnight and never spoke again.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second unrescued onset → 70, kind=onset', () => {
  const draft = [
    'INT. LIN HOME - NIGHT',
    'She witnessed the murder that night.',
    'She went mute and could no longer speak.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'They forced her to drink the mute draught.',
    'She was struck mute and never said another word.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: onset rescued by CAUSE vocal cord paralysis', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'A hand closed on her throat.',
    'She went mute.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He was strangled.',
    'The doctor found vocal cord paralysis from recurrent laryngeal nerve damage; he could no longer speak.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: onset rescued by DIAG ENT and speech therapist', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'She was frightened by the terrible news.',
    'She lost her voice.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'After a grave illness he could no longer speak.',
    'ENT ran a laryngoscopy; a speech therapist and a psychiatrist diagnosed functional aphonia.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: onset rescued by PRICE notes and sign language', () => {
  const draft = [
    'INT. VILLAGE - DAY',
    'She was terrified after witnessing the massacre.',
    'She was rendered voiceless.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The fever destroyed her throat.',
    'She never spoke again; she wrote notes instead and learned sign language.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: a golden needle cure does not rescue the onset', () => {
  const draft = [
    'INT. WARD - DAY',
    'After the fire she went mute.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He was drugged into silence.',
    'He became permanently mute.',
    'The famed doctor drove a golden needle into the mute point and he could speak again at once.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 3);
  const onsetHit = r.hits.find((h) => h.kind === 'onset');
  assert.ok(onsetHit);
  assert.strictEqual(onsetHit.rescued, false);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('en: WEAK wordlessness without speech-loss context → pass', () => {
  const draft = [
    'INT. ALLEY - NIGHT',
    'The shock frightened him.',
    'His voice caught in his throat.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK mute anchor with tears nearby → emotional, pass', () => {
  const draft = [
    'INT. FUNERAL HOME - DAY',
    'She was shocked and in tears.',
    'She was unable to speak, her throat closed up, and she cried.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK anchor + vocal cord context → event, exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'She witnessed a murder and was shocked.',
    'She opened her mouth but no sound came; the doctor said her vocal cords were damaged.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: hoarse from shouting → physical hoarseness, pass', () => {
  const draft = [
    'INT. RUBBLE - NIGHT',
    'She was shocked and shouted herself hoarse; her voice was hoarse from screaming.',
    'She kept searching through the debris.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: pure muteness without cause → pass (mute from birth)', () => {
  const draft = [
    'INT. HOME - DAY',
    'She was born voiceless.',
    'She communicated with her hands.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: pure shock without mute anchor → pass', () => {
  const draft = [
    'INT. OLD HOUSE - NIGHT',
    'She witnessed the slaughter.',
    'She trembled and shrank into the corner.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: throat injury plus coma then waking aphonia belongs to wake-on-cue', () => {
  const draft = [
    'INT. HOSPITAL - DAY',
    'Her throat was crushed and she lay unconscious for days.',
    'When she woke, she could not speak.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: single one-shot instant cure exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The famed doctor placed an acupuncture needle at her throat.',
    'Suddenly she cried out: Mama!',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('en: second cheap instant cure unrescued → 70, kind=cure', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The famed doctor inserted a golden needle.',
    'She could speak again at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Seeing her child in danger, she acted.',
    'In desperation, she suddenly called out his name.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: cure rescued by CPROCESS speech therapy and whisper-first rehab', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The famed doctor inserted the needle.',
    'She could speak again instantly.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Acupuncture at her throat once more.',
    'Her voice returned the moment the needle went in.',
    'Months of speech therapy and vocal rehab followed, starting with a whisper.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cure rescued by PARTIAL whisper and hoarseness', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'A miracle cure was pressed into her hand.',
    'Her voice came back at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The herbal elixir went down.',
    'Finally she spoke, but only a whisper; her voice stayed hoarse and she could not speak for long.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: cure rescued by COST fortune and returning trauma', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The legendary doctor worked the needle.',
    'She miraculously spoke.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Another golden needle.',
    'The miracle cure worked and her voice returned, but it cost a fortune and the trauma returned with her voice.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: slow recovery without trigger → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'After months of speech therapy her voice slowly returned.',
    'The doctor called it a gradual healing.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cross-scene cause and muteness do not pair', () => {
  const draft = [
    'INT. OLD HOUSE - NIGHT',
    'She witnessed the murder.',
    'INT. LIN HOME - DAY',
    'She went mute.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: adjacent cause rows merge into one event', () => {
  const draft = [
    'INT. SHED - NIGHT',
    'They strangled her.',
    'A hand closed on her throat.',
    'She could no longer speak.',
  ].join('\n');
  const r = muteOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});
