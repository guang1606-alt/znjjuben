// v2.349 跨集钩子瞬间化解检测（cliffhanger dissolve）
// 分工：opening-continuity-check 查承接「有无」（说话人/词汇重叠）；memory-fakeout 查同集梦境作废；
// cliffhanger-score 查本集抛钩硬度。本引擎查跨集接钩「质量」——上集强钩被本集开场一句话消解
// （虚惊/误会/开玩笑/装的/道具枪），付费观众被骗感最强的一刀。假化解真升级（消解后紧跟新危机）豁免。
const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/cliffhanger-dissolve-check.js');

// ---------- 样例 ----------
const PREV_CRISIS = [
  '反派把枪口顶在林晚额头上：去死吧。',
  '林晚闭眼，无路可退。',
  '突然一声枪响。',
].join('\n');

const PREV_MYSTERY = [
  '门外传来脚步声，林晚屏住呼吸。',
  '到底是谁在那里？究竟是谁发的照片？',
].join('\n');

const PREV_EMOTIONAL = [
  '林晚瘫坐在地，泪水模糊了双眼。',
  '她崩溃地哭出声，全场沉默。',
].join('\n');

const PREV_WEAK = '所以，接下来会怎样呢？夜色渐深，没有人知道答案，一切归于平静。';
const PREV_NONE = '夜色渐深，宴会厅的灯一盏盏熄灭，一切都已经结束了，生活回归平静。';

const OPENING_DISSOLVE = [
  '第2集 死里逃生',
  '内景 仓库·夜',
  '反派哈哈大笑：逗你玩的，这是道具枪。',
  '林晚松了口气，拍拍胸口站起来。',
].join('\n');

const OPENING_HEALTHY = [
  '第2集 死里逃生',
  '内景 仓库·夜',
  '△ 枪声响过，林晚猛地侧身，子弹擦过耳边。',
  '林晚（喘）：你敢开枪，就别想走出这里。',
  '保镖冲进来拦住反派，场面瞬间失控。',
].join('\n');

const OPENING_ESCALATE = [
  '第2集 反转',
  '内景 仓库·夜',
  '反派收枪笑了：开玩笑的，我怎么会杀你。',
  '但下一秒，真正的杀手从暗处走出，枪口对准两人。',
].join('\n');

// ---------- 1. 强危机钩被开场消解 → high ----------
test('v2.349 危机钩被「逗你玩/道具枪」开场消解 → high cliffhanger_dissolved', () => {
  const r = M.cliffhangerDissolveCheck(PREV_CRISIS, OPENING_DISSOLVE, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.dissolved, true);
  const high = r.issues.filter((i) => i.severity === 'high');
  assert.ok(high.length >= 1, JSON.stringify(r.issues));
  assert.strictEqual(high[0].type, 'cliffhanger_dissolved');
  assert.ok(r.score < 100, `score=${r.score}`);
});

// ---------- 2. 悬念钩被「原来是误会」消解 → high ----------
test('v2.349 悬念钩被「原来是误会」消解 → high', () => {
  const opening = '第2集\n内景 客厅·夜\n林晚开门一看，原来是误会一场，是邻居家的猫。\n她哑然失笑，回屋继续睡觉。';
  const r = M.cliffhangerDissolveCheck(PREV_MYSTERY, opening, 'zh');
  assert.strictEqual(r.dissolved, true);
  assert.ok(r.issues.some((i) => i.severity === 'high' && i.type === 'cliffhanger_dissolved'), JSON.stringify(r.issues));
});

// ---------- 3. 健康承接：危机钩直接延续 → 无 issue ----------
test('v2.349 健康承接：开场延续危机（脱险/对峙），无消解锚 → 满分无 issue', () => {
  const r = M.cliffhangerDissolveCheck(PREV_CRISIS, OPENING_HEALTHY, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.dissolved, false);
  assert.deepStrictEqual(r.issues, []);
  assert.strictEqual(r.score, 100);
});

// ---------- 4. 第 1 集（无前集结尾）→ 不检测满分 ----------
test('v2.349 第1集：prevEnding 为空 → checked=false 满分零 issue', () => {
  const r = M.cliffhangerDissolveCheck('', OPENING_DISSOLVE, 'zh');
  assert.strictEqual(r.checked, false);
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.issues, []);
});

// ---------- 5. 上集弱钩/无钩 → 放行（无实质钩可化解） ----------
test('v2.349 上集弱钩（仅问号）→ 放行不罚', () => {
  const r = M.cliffhangerDissolveCheck(PREV_WEAK, OPENING_DISSOLVE, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.dissolved, false);
  assert.deepStrictEqual(r.issues, []);
});
test('v2.349 上集无钩 → 放行不罚', () => {
  const r = M.cliffhangerDissolveCheck(PREV_NONE, OPENING_DISSOLVE, 'zh');
  assert.strictEqual(r.dissolved, false);
  assert.deepStrictEqual(r.issues, []);
});

// ---------- 6. 中等钩（情感/动作）被消解 → mid ----------
test('v2.349 情感钩被「吓唬你」消解 → mid soft_hook_dissolved', () => {
  const opening = '第2集\n内景 客厅·日\n众人笑出声：吓唬你的，这是生日惊喜。\n林晚破涕为笑。';
  const r = M.cliffhangerDissolveCheck(PREV_EMOTIONAL, opening, 'zh');
  assert.strictEqual(r.dissolved, true);
  assert.ok(r.issues.some((i) => i.type === 'soft_hook_dissolved' && i.severity === 'mid'), JSON.stringify(r.issues));
  assert.strictEqual(r.issues.filter((i) => i.severity === 'high').length, 0);
});

// ---------- 7. 假化解真升级豁免 ----------
test('v2.349 消解后紧跟新危机（但…枪口）→ 合法反转豁免', () => {
  const r = M.cliffhangerDissolveCheck(PREV_CRISIS, OPENING_ESCALATE, 'zh');
  assert.strictEqual(r.dissolved, false, JSON.stringify(r.issues));
  assert.deepStrictEqual(r.issues, []);
});

// ---------- 8. 消解锚在中段（开场窗口外）不误报 ----------
test('v2.349 消解锚出现在开场 300 字窗口外（先延续危机再反转）→ 不误报', () => {
  const filler = [];
  filler.push('第2集 死里逃生', '内景 仓库·夜');
  for (let i = 0; i < 12; i += 1) {
    filler.push(`林晚与反派僵持对峙，枪口始终没有放下，汗水顺着额头滑落，第${i + 1}轮交锋互不相让。`);
  }
  filler.push('反派突然笑了：逗你玩的，这是道具枪。');
  const r = M.cliffhangerDissolveCheck(PREV_CRISIS, filler.join('\n'), 'zh');
  assert.strictEqual(r.dissolved, false, JSON.stringify(r.issues));
});

// ---------- 9. 英文链路 ----------
test('v2.349 EN: crisis hook dissolved by "Just kidding! prop gun" → high', () => {
  const prev = 'The villain pressed a gun to Elena\'s forehead. "Time to die."\nShe had no way out. A gunshot rang out.';
  const opening = 'Episode 2\nINT. WAREHOUSE - NIGHT\nThe villain burst out laughing. "Just kidding! It\'s a prop gun."\nElena sighed with relief.';
  const r = M.cliffhangerDissolveCheck(prev, opening, 'en');
  assert.strictEqual(r.dissolved, true);
  assert.ok(r.issues.some((i) => i.severity === 'high' && i.type === 'cliffhanger_dissolved'), JSON.stringify(r.issues));
});
test('v2.349 EN: healthy continuation → clean', () => {
  const prev = 'The villain pressed a gun to Elena\'s forehead. "Time to die."\nShe had no way out. A gunshot rang out.';
  const opening = 'Episode 2\nINT. WAREHOUSE - NIGHT\nElena twisted away as the bullet grazed her ear.\n"You fire that gun, you never leave this room," she snapped.\nGuards rushed in and pinned the villain down.';
  const r = M.cliffhangerDissolveCheck(prev, opening, 'en');
  assert.strictEqual(r.dissolved, false);
  assert.deepStrictEqual(r.issues, []);
});

// ---------- 10. 畸形输入不崩溃 ----------
test('v2.349 边界：null/undefined/纯空白不崩溃，满分放行', () => {
  for (const bad of [null, undefined, '   ', '\n\n']) {
    const r = M.cliffhangerDissolveCheck(bad, bad, 'zh');
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.ok(Array.isArray(r.issues));
  }
  const r2 = M.cliffhangerDissolveCheck(PREV_CRISIS, '', 'zh');
  assert.strictEqual(r2.score, 100);
  assert.deepStrictEqual(r2.issues, []);
});

// ---------- 11. 结构字段齐全 ----------
test('v2.349 结构：checked/prevHookType/dissolved/issues 齐全', () => {
  const r = M.cliffhangerDissolveCheck(PREV_CRISIS, OPENING_HEALTHY, 'zh');
  for (const k of ['score', 'checked', 'prevHookType', 'dissolved', 'issues']) {
    assert.ok(k in r, `missing ${k}`);
  }
  assert.strictEqual(typeof r.prevHookType, 'string');
  assert.strictEqual(typeof r.dissolved, 'boolean');
});

// ---------- 12. score 恒在 0-100 ----------
test('v2.349 score 恒在 0-100 区间', () => {
  const cases = [
    [PREV_CRISIS, OPENING_DISSOLVE],
    [PREV_CRISIS, OPENING_HEALTHY],
    [PREV_MYSTERY, OPENING_DISSOLVE],
    ['', ''],
  ];
  for (const [p, d] of cases) {
    const r = M.cliffhangerDissolveCheck(p, d, 'zh');
    assert.ok(r.score >= 0 && r.score <= 100, `score=${r.score}`);
  }
});
