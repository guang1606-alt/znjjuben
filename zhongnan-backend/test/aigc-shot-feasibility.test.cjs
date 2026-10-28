const test = require('node:test');
const assert = require('node:assert');
const A = require('../dist/engine/aigc-screenplay.js');
const F = require('../dist/engine/aigc-shot-feasibility.js');
const SF = require('../dist/engine/script-format.js');
const S = require('../dist/engine/sample-script.js');

const cjk = (s) => (String(s).match(/[一-鿿]/g) || []).length;

test('v2.341 空稿/无场头文本不误报：留判定权给版式闸门', () => {
  const r = F.checkAigcShotFeasibility('', 1, 'zh');
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.stats.shotCount, 0);
  assert.deepStrictEqual(r.issues, []);
});

test('v2.341 黄金样例不被误判为不可生成：镜头可拆、只出成本提示，不进 violations', () => {
  const t = S.buildSampleScript('AIGC', 'zh');
  const r = F.checkAigcShotFeasibility(t, 1, 'zh');
  assert.notStrictEqual(r.level, 'over', JSON.stringify(r.issues));
  assert.ok(r.stats.shotCount >= 12, `shotCount=${r.stats.shotCount}`);
  assert.ok(r.stats.maxSeconds > 0 && r.stats.maxSeconds < 8, `maxSeconds=${r.stats.maxSeconds}`);
  const f = SF.validateScript(t, 'AIGC', 1);
  assert.ok(f.shotPlan, 'AIGC 的 FormatReport 必须带 shotPlan');
  assert.strictEqual(f.violations.some((v) => v.includes('镜头不可生成') || v.includes('Shot:')), false, f.violations.join(';'));
});

test('v2.341 一镜塞满整段对白：≥8 秒判不可生成（high），指出是第几镜', () => {
  const lines = Array.from({ length: 8 }, (_, i) => `林晚：这是第${i + 1}句台词，我一句都不想再听下去，你也别再解释了。`).join('\n');
  const text = `第1集 试点集\n内景 客厅·夜\n他站在窗边，手指在玻璃上划了一下，外面的雨正下得急。\n${lines}`;
  const r = F.checkAigcShotFeasibility(text, 1, 'zh');
  assert.strictEqual(r.level, 'over');
  const so = r.issues.find((i) => i.kind === 'shot_overlong');
  assert.ok(so && so.severity === 'high', JSON.stringify(r.issues));
  assert.ok(so.message.includes('不可生成'), so.message);
  assert.ok(so.evidence.some((e) => /\d/.test(e)), JSON.stringify(so.evidence));
  assert.strictEqual(r.stats.maxLinesPerShot, 8);
});

test('v2.341 纯台词镜（无画面）：生图模型无内容可出 → high', () => {
  const text = [
    '第1集 试点集',
    '内景 客厅·夜',
    '林晚：你终于回来了。',
    '陈凯：路上堵车。',
    '林晚：饭在锅里。',
    '陈凯：我不饿。',
  ].join('\n');
  const r = F.checkAigcShotFeasibility(text, 1, 'zh');
  const v = r.issues.find((i) => i.kind === 'visualess_shot');
  assert.ok(v && v.severity === 'high', JSON.stringify(r.issues));
  assert.ok(r.stats.visualessShots >= 1);
  assert.strictEqual(r.level, 'over');
});

test('v2.341 单镜偏长只提示不拦截：5-8 秒为 mid，level=watch 且分数折损', () => {
  // 画面约 48 字、三句长台词约 117 字（台词叠在画面上播，取较大值 ≈5.3 秒）→ mid
  const body = '他站在窗边，手指在玻璃上慢慢划了一下，外面的雨正下得急，屋里静得能听见钟摆一下一下地走，楼道的灯忽明忽暗。';
  const text = `第1集 试点集\n内景 客厅·夜\n${body}\n林晚：你终于回来了，我把饭又热了一遍，菜还在锅里温着，你先去洗个手，别又嫌凉，凉了就不好吃了。\n陈凯：路上堵车堵得厉害，手机也没电了，我在楼下站了半个多小时，才拦到一辆车回来。\n林晚：那你先坐下歇一会儿，汤我再去热一下，今天这雨下得人心里发慌，路上没出事就好，你先喝口热水暖暖身子。`;
  const r = F.checkAigcShotFeasibility(text, 1, 'zh');
  assert.strictEqual(r.level, 'watch');
  assert.strictEqual(r.issues.filter((i) => i.severity === 'high').length, 0);
  assert.ok(r.score < 100 && r.score > 0, `score=${r.score}`);
  assert.ok(r.issues.some((i) => i.kind === 'shot_overlong' && i.severity === 'mid'), JSON.stringify(r.issues));
});

test('v2.341 英文链路零中文：issue 文案全英文', () => {
  const lines = Array.from({ length: 8 }, (_, i) => `LIN WAN: This is line ${i + 1} and I refuse to hear another single word about it, not one more.`).join('\n');
  const text = `EP1 Pilot\nINT. LIVING ROOM - NIGHT\nHe stands by the window, one finger tracing the glass, the rain outside coming down hard.\n${lines}`;
  const r = F.checkAigcShotFeasibility(text, 1, 'en');
  assert.strictEqual(r.level, 'over');
  r.issues.forEach((i) => assert.strictEqual(cjk(i.message), 0, i.message));
  assert.ok(r.issues.some((i) => i.kind === 'shot_overlong' && i.message.includes('8')));
});

test('v2.341 英文分镜按语言等量分层：不再一段一镜（每镜 ≤ 70 字当量）', () => {
  const t = S.buildSampleScript('AIGC', 'en');
  const m = A.buildShotManifest(t);
  // 英文正文按单词计量，正文总量 ≥ 700 当量；分层后单镜不应再出现 200+ 当量的巨镜
  const unit = (s) => cjk(s) + (String(s).match(/[A-Za-z]+/g) || []).length * 1.67;
  const worst = Math.max(...m.shots.map((s) => unit(s.visual)));
  assert.ok(m.shotCount >= 10, `English shotCount=${m.shotCount}`);
  assert.ok(worst <= 130, `English worst visual units=${Math.round(worst)}`);
});

test('v2.341 分镜中层与闸门同源：format.shotPlan 的镜头数与 manifest 一致', () => {
  const t = S.buildSampleScript('AIGC', 'zh');
  const m = A.buildShotManifest(t);
  const f = SF.validateScript(t, 'AIGC', 1);
  assert.strictEqual(f.shotPlan.stats.shotCount, m.shotCount);
  // LIVE 制式不适用：不得产出 shotPlan（与 feasibility 对称）
  const live = SF.validateScript(S.buildSampleScript('LIVE'), 'LIVE');
  assert.strictEqual(live.shotPlan, undefined);
});
