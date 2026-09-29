const test = require('node:test');
const assert = require('node:assert');
const {
  arcTracker,
  arcTrackerDigest,
} = require('../dist/engine/arc-tracker.js');

// 构造一个前集弧光快照（digest 落库形态：只有四个持久化字段，正是跨集读取的真实输入）
function prevChar(name, emotion, stage, epNo = 7) {
  return { characters: [{ name, emotion, stage, changed: false }], epNo };
}

test('c210 旧规则保持：calm→despair 无恐惧信号判跳变；本集出现恐惧即赦免', () => {
  const cast = { 林夏: '' };
  const jump = arcTracker(cast, '林夏跪在雨里，绝望，崩溃，心如死灰。', prevChar('林夏', 'calm', 'conflict'));
  assert.ok(jump.jumpCut.some((j) => j.name === '林夏' && j.from === 'calm' && j.to === 'despair'));
  assert.ok(jump.issues.some((i) => i.type === 'emotion_jump'));
  // 本集情绪轨迹含恐惧（哪怕主导情绪仍是绝望）→ 有过渡，不判跳变
  const bridged = arcTracker(cast, '林夏先是害怕，紧张地发抖，后退，随后绝望，崩溃，心如死灰，无力地瘫倒，眼泪流下，跪地不起。', prevChar('林夏', 'calm', 'conflict'));
  assert.ok(!bridged.jumpCut.some((j) => j.name === '林夏'));
});

test('c210 旧规则保持：hope→despair 无恐惧/愤怒过渡判跳变', () => {
  const r = arcTracker({ 林夏: '' }, '林夏绝望，崩溃，眼泪掉下来，心如死灰。', prevChar('林夏', 'hope', 'conflict'));
  assert.ok(r.jumpCut.some((j) => j.from === 'hope' && j.to === 'despair'));
});

test('c210 跳变泛化：joy→despair 正负极硬切（旧引擎漏网）判跳变；含愤怒/恐惧过渡则赦免', () => {
  const cast = { 林夏: '' };
  const hard = arcTracker(cast, '林夏绝望，崩溃，心如死灰，无力地跪地。', prevChar('林夏', 'joy', 'crisis'));
  assert.ok(hard.jumpCut.some((j) => j.from === 'joy' && j.to === 'despair'), '喜悦直落绝望必须抓');
  // 有中间情绪（愤怒在轨迹里，主导仍是绝望）→ 可信的垮塌过程，不抓
  const soft = arcTracker(cast, '林夏先是怒吼，摔门，浑身发抖，后来绝望，崩溃跪地。', prevChar('林夏', 'joy', 'crisis'));
  assert.ok(!soft.jumpCut.some((j) => j.name === '林夏'));
});

test('c210 跳变泛化：despair→joy / calm→joy 无希望缓冲判跳变；有希望信号赦免', () => {
  const cast = { 阿昭: '' };
  const up = arcTracker(cast, '阿昭笑了，开心，兴奋，欣喜地站起来。', prevChar('阿昭', 'despair', 'crisis'));
  assert.ok(up.jumpCut.some((j) => j.from === 'despair' && j.to === 'joy'), '绝望直接狂喜必须抓');
  const upPardon = arcTracker(cast, '阿昭相信会好的，坚持，满怀希望，然后笑了，开心，兴奋，欣喜，狂喜，激动。', prevChar('阿昭', 'despair', 'crisis'));
  assert.ok(!upPardon.jumpCut.some((j) => j.name === '阿昭'));
  const calm2joy = arcTracker(cast, '阿昭笑得开心，兴奋，欣喜。', prevChar('阿昭', 'calm', 'setup'));
  assert.ok(calm2joy.jumpCut.some((j) => j.from === 'calm' && j.to === 'joy'), '平静直接狂喜也要缓冲');
});

test('c210 过渡情绪不能是目标情绪本身：fear 主导时 joy→fear 不得自我赦免', () => {
  // 旧引擎的赦免写法 emotions.includes(bridge) 会把主导情绪自身当过渡，泛化后必须排除目标情绪
  const r = arcTracker({ 林夏: '' }, '林夏害怕，紧张，发抖，慌了，瑟瑟后退。', prevChar('林夏', 'joy', 'resolution'));
  assert.ok(r.jumpCut.some((j) => j.from === 'joy' && j.to === 'fear'), '喜悦到恐惧缺愤怒/其他下行过渡，仍要抓');
});

test('c210 缺席修正：本集零信号角色（unknown/unknown）不误判弧光停滞', () => {
  // 圣经挂名但连续两集没出场/无任何信号的配角，旧引擎判 stalled（"角色无成长"）——假阳性
  const cast = { 林夏: '主角', 路人甲: '挂名配角' };
  const prev = {
    characters: [
      { name: '林夏', emotion: 'calm', stage: 'conflict', changed: false },
      { name: '路人甲', emotion: 'unknown', stage: 'unknown', changed: false },
    ],
    epNo: 5,
  };
  const r = arcTracker(cast, '林夏冷静，沉默，在冲突现场淡淡看着对面。', prev);
  assert.ok(!r.stalled.some((s) => s.name === '路人甲'), '缺席角色不得报停滞');
  // 真正同情绪同阶段出场的主角仍要抓
  assert.ok(r.stalled.some((s) => s.name === '林夏'));
});

test('c210 digest：只落四字段角色（剥离无界 emotionTrack/relations），分数/停滞/跳变/issues 保留', () => {
  const prev = { characters: [{ name: '林夏', emotion: 'calm', stage: 'conflict', changed: false }], epNo: 3 };
  const res = arcTracker({ 林夏: '' }, '林夏绝望，崩溃，眼泪止不住，心如死灰。', prev);
  assert.ok(res.jumpCut.length >= 1);
  const d = arcTrackerDigest(res);
  assert.strictEqual(d.score, res.score);
  assert.ok(Array.isArray(d.characters) && d.characters.length === 1);
  const ch = d.characters[0];
  assert.deepStrictEqual(Object.keys(ch).sort(), ['changed', 'emotion', 'name', 'stage']);
  assert.ok(!('emotionTrack' in ch) && !('relations' in ch), '无界轨迹/关系表不落库');
  assert.ok(Array.isArray(d.stalled) && Array.isArray(d.jumpCut) && Array.isArray(d.issues));
  assert.ok(d.jumpCut.some((j) => j.from === 'calm' && j.to === 'despair'));
  assert.ok(d.issues.some((i) => i.type === 'emotion_jump' && typeof i.advice === 'string' && i.advice.length <= 160));
});

test('c210 digest 限界：角色/停滞/跳变/issues 封顶，reason/advice 截断，空结果安全形态', () => {
  const many = {};
  const characters = [];
  for (let i = 0; i < 25; i++) {
    const nm = `角色${String(i).padStart(2, '0')}`;
    many[nm] = '';
    // 每人都给一个与前集相同的 calm/conflict 信号 → 全部停滞
    characters.push({ name: nm, emotion: 'calm', stage: 'conflict', changed: false });
  }
  const prev = { characters, epNo: 1 };
  // 正文里让每人都冷静沉默且处在冲突中（同情绪同阶段），名字都要出现才会被扫到
  const text = Object.keys(many).map((nm) => `${nm}冷静，沉默，面对冲突，默默对峙。`).join('');
  const res = arcTracker(many, text, prev);
  assert.ok(res.stalled.length > 8, '前置：确实产生大量停滞');
  const d = arcTrackerDigest(res);
  assert.ok(d.characters.length <= 20);
  assert.ok(d.stalled.length <= 8, `停滞封顶 8，实际 ${d.stalled.length}`);
  assert.ok(d.jumpCut.length <= 8);
  assert.ok(d.issues.length <= 4);
  d.issues.forEach((i) => assert.ok(i.advice.length <= 160));

  const empty = arcTrackerDigest({ characters: [], stalled: [], jumpCut: [], score: 100, issues: [] });
  assert.deepStrictEqual(empty, { score: 100, characters: [], stalled: [], jumpCut: [], issues: [] });
  assert.throws(() => arcTrackerDigest(null), /arc/i, 'null 输入显式报错，不静默伪造');
});
