/**
 * prop-motif-rhythm 单测（v2.133 块140）——17 例
 * require dist/，改引擎后必须先 npm run build 再跑。
 */
const test = require('node:test');
const assert = require('node:assert');
const { propMotifRhythm } = require('../dist/engine/prop-motif-rhythm.js');

/* 填充行（不含词表物件与任何锚点词） */
const PAD = '窗外又下雨了，街上的灯一盏一盏亮起来。';

/** 生成 ≥30 行的稿：把关键行放到指定 1-based 行号位置 */
function makeDraft(spec, total = 30) {
  const lines = new Array(total).fill(null).map((_, i) => `${i + 1} ${PAD}`);
  for (const [lineNo, text] of Object.entries(spec)) lines[Number(lineNo) - 1] = text;
  return lines.join('\n');
}

test('1 空文本 → 100', () => {
  const r = propMotifRhythm('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
});

test('2 无信物族物件（只有日用品）→ 100', () => {
  const r = propMotifRhythm(makeDraft({
    5: '她摩挲着手机，出了神。',
    12: '他把雨伞随手一扔，丢在一边。',
  }));
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
});

test('3 全稿不足 25 行 → 不判节奏', () => {
  const r = propMotifRhythm(Array(20).fill(PAD).map((l, i) => (i === 4 ? '她摩挲着玉佩，出了神。' : l)).join('\n'));
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
});

test('4 focusOnce：玉佩郑重聚焦一次全稿唯一 → 1 hit −20', () => {
  const r = propMotifRhythm(makeDraft({ 5: '她摩挲着玉佩，出了神。' }));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits[0].kind, 'focus_once');
  assert.strictEqual(r.hits[0].prop, '玉佩');
  assert.strictEqual(r.hits[0].line, 5);
  assert.strictEqual(r.score, 80);
  assert.ok(r.issues.length >= 1 && r.advice.length >= 1);
});

test('5 focusOnce 豁免：聚焦行带 plant 钩子（留给跨集）', () => {
  const r = propMotifRhythm(makeDraft({ 5: '她摩挲着玉佩——这玉佩的事，以后再说。' }));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('6 focusOnce 豁免：物件仅一现但无聚焦语（普通拿放）', () => {
  const r = propMotifRhythm(makeDraft({ 5: '她把玉佩放进包里，转身走了。' }));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('7 focusOnce 豁免：物件出现两次（第二现普通提及）', () => {
  const r = propMotifRhythm(makeDraft({
    5: '她摩挲着玉佩，出了神。',
    18: '玉佩还在包里。',
  }));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('8 coldPayoff：首现早/终幕兑现/中间零互动 → 1 hit −30', () => {
  const r = propMotifRhythm(makeDraft({
    3: '戒指是她奶奶留下的。',
    27: '他掏出戒指：就是这，对上暗号了。',
  }));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits[0].kind, 'cold_payoff');
  assert.strictEqual(r.hits[0].prop, '戒指');
  assert.strictEqual(r.hits[0].line, 27);
  assert.strictEqual(r.score, 70);
});

test('9 coldPayoff 豁免：中间有互动（三现）', () => {
  const r = propMotifRhythm(makeDraft({
    3: '戒指是她奶奶留下的。',
    15: '戒指还在抽屉里。',
    27: '他掏出戒指：就是这，对上暗号了。',
  }));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('10 coldPayoff 豁免：末现不在终幕', () => {
  const r = propMotifRhythm(makeDraft({
    3: '戒指是她奶奶留下的。',
    20: '他掏出戒指：就是这，对上暗号了。',
  }));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('11 coldPayoff 豁免：末现行无决定性使用语', () => {
  const r = propMotifRhythm(makeDraft({
    3: '戒指是她奶奶留下的。',
    27: '他看了看戒指，没说话。',
  }));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('12 driftCarry：信物语×随手处置 ±3 行同物件 → hit 未救 −30', () => {
  const r = propMotifRhythm(makeDraft({
    10: '这是娘留下的项链，你得收好。',
    12: '小舟随手一扔，把项链丢在一边。',
  }));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits[0].kind, 'drift_carry');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('13 driftCarry rescue：处置窗口有柔情反应 → 已救回不扣分', () => {
  const r = propMotifRhythm(makeDraft({
    10: '这是娘留下的项链，你得收好。',
    12: '小舟随手一扔，把项链丢在一边。',
    13: '他红了眼，又把它捡了回来。',
  }));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('14 driftCarry rescue：处置窗口有反派语气 → 已救回', () => {
  const r = propMotifRhythm(makeDraft({
    10: '这是娘留下的项链，你得收好。',
    12: '他冷笑着，把项链丢进垃圾桶。',
  }));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('15 driftCarry 豁免：信物行与处置行距离 >3 行', () => {
  const r = propMotifRhythm(makeDraft({
    10: '这是娘留下的项链，你得收好。',
    16: '小舟随手一扔，把项链丢在一边。',
  }));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('16 en 综合：三类各一处 + en 层零中文', () => {
  const PAD_EN = 'The rain keeps falling outside while the lights of the city come on.';
  const lines = new Array(30).fill(null).map((_, i) => `${i + 1} ${PAD_EN}`);
  [
    [3, "The ring was her grandmother's."],
    [5, 'She turns it over in her hands, the locket gleaming.'],
    [10, "her mother's necklace, the last thing she left"],
    [12, 'He tosses the necklace aside without a word.'],
    [27, 'He pulls out the ring: this is it.'],
  ].forEach(([n, t]) => { lines[n - 1] = t; });
  const r = propMotifRhythm(lines.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  const kinds = r.hits.map((h) => h.kind).sort().join(',');
  assert.strictEqual(kinds, 'cold_payoff,drift_carry,focus_once');
  for (const h of r.hits) assert.ok(!/[一-鿿]/.test(h.reason), 'en reason 不得含中文');
  for (const s of [...r.issues, ...r.advice]) assert.ok(!/[一-鿿]/.test(s), 'en issues/advice 不得含中文');
  assert.strictEqual(r.score, 20);
});

test('17 计分封底 20 + hits 按 line 升序', () => {
  const r = propMotifRhythm(makeDraft({
    5: '她摩挲着玉佩，出了神。',
    3: '戒指是她奶奶留下的。',
    27: '他掏出戒指：就是这，对上暗号了。',
    10: '这是娘留下的项链。',
    12: '她随手一扔，把项链丢在一边。',
  }));
  assert.strictEqual(r.score, 20);
  assert.strictEqual(r.hitCount, 3);
  for (let i = 1; i < r.hits.length; i += 1) assert.ok(r.hits[i - 1].line <= r.hits[i].line);
});
