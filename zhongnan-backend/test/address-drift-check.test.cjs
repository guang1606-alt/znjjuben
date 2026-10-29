/**
 * v2.354 称谓漂移检测（address-drift-check）先红测试
 * 盲区：同一角色台词标签漂移（张总/张建国/建国）——speakerSheet 按标签分音被拆成多声部。
 * 口径：唯一归属原则（标签对全 cast 关联匹配，归属≠1 丢弃）；
 *       同角色 ≥2 标签 mid / ≥3 标签 high；群体/旁白豁免；野生工具人不报。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  addressDriftCheck,
} = require('../dist/engine/address-drift-check');

// ---------- zh ----------

// 3 标签漂移 → high（行号：张总 L3 / 张建国 L4 / 建国 L6）
const ZH_HIGH = [
  '第1集 夜 内 办公室',
  '△张总坐在办公桌后。',
  '张总：这个方案必须今天定下来。',
  '张建国（沉声）：我不同意，风险太大。',
  '张总：舍不得孩子套不着狼。',
  '建国：爸那边我去说，你别插手。',
  '张建国：你不要自作主张了。',
].join('\n');

test('zh: 同一角色 3 个标签 → high address_drift_severe，score 78', () => {
  const r = addressDriftCheck({ 张建国: {} }, ZH_HIGH, 'zh');
  assert.equal(r.checked, true);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'address_drift_severe');
  assert.equal(r.score, 78);
});

test('zh: evidence 含全部标签与首现行号', () => {
  const r = addressDriftCheck({ 张建国: {} }, ZH_HIGH, 'zh');
  const ev = r.issues[0].evidence;
  assert.ok(ev.includes('张总'));
  assert.ok(ev.includes('张建国'));
  assert.ok(ev.includes('建国'));
  assert.ok(ev.includes('3')); // 张总首现第3行
  assert.ok(ev.includes('6')); // 建国首现第6行
});

test('zh: 2 个标签 → mid address_drift，score 90', () => {
  const draft = [
    '第1集 日 外 天台',
    '张建国：风大，回去吧。',
    '建国：我不走，我还有话说。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {} }, draft, 'zh');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'mid');
  assert.equal(r.issues[0].type, 'address_drift');
  assert.equal(r.score, 90);
});

test('zh: 全程只用一个非正名标签（张总）→ 不报（属 missing 地盘）', () => {
  const draft = [
    '第1集 日 内 会议室',
    '张总：今天把方案定了。',
    '张总：谁反对？',
    '张总：好，散会。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {} }, draft, 'zh');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 两兄弟同姓，姓+称谓标签不可唯一归属 → 不报', () => {
  const draft = [
    '第1集 日 内 客厅',
    '张总：大哥回来了。',
    '张建民：嗯。',
    '张总：爸在里面等你。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {}, 张建民: {} }, draft, 'zh');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 同姓但名变体唯一归属 → 仍报 mid', () => {
  const draft = [
    '第1集 日 内 客厅',
    '张建国：爸今天怎么样。',
    '建国：我去看看他。',
    '张建民：我也去。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {}, 张建民: {} }, draft, 'zh');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'mid');
  assert.ok(r.issues[0].evidence.includes('张建国'));
});

test('zh: 群体标签（众人/同学们/大家）豁免不报', () => {
  const draft = [
    '第1集 日 内 教室',
    '张建国：同学们安静。',
    '众人：好。',
    '同学们：知道了。',
    '大家：听老师的。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {} }, draft, 'zh');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 旁白/画外音标签豁免不报', () => {
  const draft = [
    '第1集 日 外 街道',
    '旁白：这座城市从不睡眠。',
    '张建国：又堵车了。',
    '画外音：他终究还是迟到了。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {} }, draft, 'zh');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 野生工具人标签（服务员/前台）与 cast 无关 → 不报', () => {
  const draft = [
    '第1集 日 内 餐厅',
    '张建国：一份牛肉面。',
    '服务员：好的，请稍等。',
    '前台：您的账结了。',
    '张建国：谢谢。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {} }, draft, 'zh');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 老+姓 前缀变体（老张）计入漂移 → mid', () => {
  const draft = [
    '第1集 日 内 车间',
    '老张：这批货今晚必须发走。',
    '张建国：知道了，我盯着。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {} }, draft, 'zh');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'mid');
  assert.ok(r.issues[0].evidence.includes('老张'));
});

test('zh: 两个角色同时漂移 → 扣分累计 score 80', () => {
  const draft = [
    '第1集 日 内 办公室',
    '张建国：这个案子你怎么看。',
    '建国：我觉得有诈。',
    '李梅：我同意。',
    '李姐：先查查再说。',
  ].join('\n');
  const r = addressDriftCheck({ 张建国: {}, 李梅: {} }, draft, 'zh');
  assert.equal(r.issues.length, 2);
  assert.equal(r.score, 80);
});

test('zh: cast 为空 → checked=false 满分放行', () => {
  const r = addressDriftCheck({}, ZH_HIGH, 'zh');
  assert.equal(r.checked, false);
  assert.equal(r.score, 100);
});

test('zh: 空稿 → checked=false 满分放行', () => {
  const r = addressDriftCheck({ 张建国: {} }, '', 'zh');
  assert.equal(r.checked, false);
  assert.equal(r.score, 100);
});

// ---------- en ----------

const EN_HIGH = [
  'INT. OFFICE - NIGHT',
  'Mr. Zhang: We must finalize this plan today.',
  'Zhang Jianguo: I disagree, the risk is too big.',
  'Mr. Zhang: No risk, no reward.',
  'Jianguo: I will talk to Dad about it myself.',
].join('\n');

test('en: 3 labels (Mr. Zhang / Zhang Jianguo / Jianguo) → high, evidence zero-Chinese', () => {
  const r = addressDriftCheck({ 'Zhang Jianguo': {} }, EN_HIGH, 'en');
  assert.equal(r.checked, true);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.score, 78);
  const blob = r.issues[0].evidence + r.issues[0].advice;
  assert.ok(!/[一-龥]/.test(blob), 'en 链路零中文');
  assert.ok(r.issues[0].evidence.includes('Mr. Zhang'));
});

test('en: 2 labels (Zhang Jianguo / Jianguo) → mid score 90', () => {
  const draft = [
    'EXT. ROOFTOP - DAY',
    'Zhang Jianguo: It is windy up here.',
    'Jianguo: I am not leaving yet.',
  ].join('\n');
  const r = addressDriftCheck({ 'Zhang Jianguo': {} }, draft, 'en');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'mid');
  assert.equal(r.score, 90);
});

test('en: 同姓两角色，title+surname 不可唯一归属 → 不报', () => {
  const draft = [
    'INT. HALL - DAY',
    'Dr. Smith: The results are in.',
    'John Smith: Let me see them.',
    'Mary Smith: Me too.',
  ].join('\n');
  const r = addressDriftCheck({ 'John Smith': {}, 'Mary Smith': {} }, draft, 'en');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});

test('en: 全程只用 Agent Smith 一个变体 → 不报', () => {
  const draft = [
    'INT. HQ - NIGHT',
    'Agent Smith: The package is secure.',
    'Agent Smith: Moving to extraction point now.',
  ].join('\n');
  const r = addressDriftCheck({ 'John Smith': {} }, draft, 'en');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});
