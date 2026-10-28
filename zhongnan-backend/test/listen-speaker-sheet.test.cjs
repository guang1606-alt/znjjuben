const test = require('node:test');
const assert = require('node:assert');
const L = require('../dist/engine/listen-script.js');

const SAMPLE = [
  '第1集 雨夜归来',
  '内景 老旧居民楼·楼道 夜',
  '镜头：缓推至302门口，声控灯忽明忽暗。',
  '△林晚攥紧钥匙，指节发白，鞋尖还滴着水。',
  '林晚（压低声音）：妈，是我，我回来了。',
  '母亲（哽咽）：你还知道回来……三年了。',
  '林晚：我这次不走了，真的。',
  '配乐：钢琴单音渐入。',
  '窗外一道闪电劈过，照亮她脸上未干的泪痕。',
].join('\n');

const EN = [
  'EP1 The Storm',
  'INT. APARTMENT HALLWAY - NIGHT',
  'JOHN (whispering): Mom, it is me. I am back.',
  'MOTHER (sobbing): Three years. You finally came home.',
  'JOHN: I am not leaving this time.',
].join('\n');

// v2.342 逐角色配音/台词清单：听剧本此前只有总时长与 speakerSet（有统计无清单），
// 制片排通告（真人）与 TTS 配音排期（AIGC）都需要「每个角色多少句、多少字、多少秒、占比」。
test('speakerSheet：空稿不产出角色清单，且不抛错', () => {
  const d = L.buildListenScript('', { lang: 'zh' });
  assert.deepStrictEqual(d.speakerSheet, []);
  assert.strictEqual(d.dialogueSeconds, 0);
});

test('speakerSheet：按角色聚合台词句数/字数/估算秒数，旁白不进清单', () => {
  const d = L.buildListenScript(SAMPLE, { lang: 'zh' });
  assert.ok(Array.isArray(d.speakerSheet));
  const names = d.speakerSheet.map((s) => s.name);
  assert.deepStrictEqual(names.slice().sort(), ['母亲', '林晚'].sort());
  assert.ok(!names.includes('旁白'), '旁白不是角色，不能进配音清单');
  assert.ok(!names.includes('Narrator'));
  const lin = d.speakerSheet.find((s) => s.name === '林晚');
  const mom = d.speakerSheet.find((s) => s.name === '母亲');
  assert.strictEqual(lin.lines, 2);
  assert.strictEqual(mom.lines, 1);
  assert.ok(lin.chars > 0 && mom.chars > 0);
  assert.ok(lin.estSeconds > 0 && mom.estSeconds > 0);
  // 首现段号指向该角色第一次开口的朗读段，便于前端点击定位
  const firstLin = d.segments.findIndex((s) => s.kind === 'dialogue' && s.speaker === '林晚');
  assert.strictEqual(lin.firstIdx, firstLin);
});

test('speakerSheet：按估算秒数降序，占比总和约 100%，与台词段总量一致', () => {
  const d = L.buildListenScript(SAMPLE, { lang: 'zh' });
  for (let i = 1; i < d.speakerSheet.length; i += 1) {
    assert.ok(d.speakerSheet[i - 1].estSeconds >= d.speakerSheet[i].estSeconds, '角色清单必须按发声秒数降序');
  }
  const dialogueSegs = d.segments.filter((s) => s.kind === 'dialogue');
  const segSum = Math.round(dialogueSegs.reduce((n, s) => n + s.estSeconds, 0) * 10) / 10;
  const sheetSum = Math.round(d.speakerSheet.reduce((n, s) => n + s.estSeconds, 0) * 10) / 10;
  assert.ok(Math.abs(sheetSum - segSum) <= 0.1, `角色秒数合计应等于台词段合计：${sheetSum} vs ${segSum}`);
  assert.strictEqual(d.speakerSheet.reduce((n, s) => n + s.lines, 0), d.dialogueCount);
  const shareSum = d.speakerSheet.reduce((n, s) => n + s.share, 0);
  assert.ok(shareSum >= 99 && shareSum <= 101, `占比合计应约 100，实际 ${shareSum}`);
});

test('speakerSheet：英文稿角色名原样保留，零中文注入', () => {
  const d = L.buildListenScript(EN, { lang: 'en' });
  const names = d.speakerSheet.map((s) => s.name).sort();
  assert.deepStrictEqual(names, ['JOHN', 'MOTHER']);
  for (const s of d.speakerSheet) {
    assert.ok(!/[\u4e00-\u9fff]/.test(String(s.name)), '英文链路角色名不得出现中文');
    assert.ok(s.lines >= 1 && s.estSeconds > 0 && s.chars > 0);
  }
});
