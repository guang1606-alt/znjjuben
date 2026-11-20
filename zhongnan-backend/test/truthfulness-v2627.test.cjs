/**
 * v2.627 圣经序列化损坏必须可归因：在场台账与 prevArc 回退不得静默失效。
 *
 * 先证伪：
 *  1) extractBibleCastNames 收到字符串只做 JSON.parse，失败一律 return []（注释称「普通字符串视同无圣经」）。
 *     但老库把 characters 以 JSON 字符串落库时，一旦被截断/损坏（如 '{"林晚":{"traits":' ），
 *     解析失败与「本来就是纯文本」无法区分 → 名表恒空 → 配角在场台账、关系线保鲜台账双双静默蒸发，
 *     第 2 集起架构师拿不到任何同场调度约束，全程无一条日志可查。
 *  2) extractBibleCastArcs 同根：损坏 JSON → return {} → prevArc 回退恒空，前集弧光静默不跟踪。
 * 修复：仅当字符串「看起来是 JSON」（trim 后以 { 或 [ 开头）却解析失败时才 logInternal 留痕；
 * 纯文本输入属常态，保持零日志（避免每集生成刷噪声）。返回契约不变。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { extractBibleCastNames, extractBibleCastArcs } = require('../dist/lib/cast-arc.js');

function withErrorCapture(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  try { return { value: fn(), calls }; } finally { console.error = orig; }
}

describe('v2.627 圣经序列化损坏必须留痕', () => {
  it('1) 截断的 characters JSON：名表仍返回空，但必须留痕 cast.names.parse', () => {
    const { value, calls } = withErrorCapture(() => extractBibleCastNames('{"林晚":{"traits":"忍'));
    assert.deepStrictEqual(value, [], '返回契约不变：损坏值仍视同无圣经');
    assert.ok(calls.some((c) => c.includes('[cast.names.parse]')),
      '截断 JSON 不得静默丢弃，必须留痕；实际：' + calls.join(' | '));
  });

  it('2) 纯文本 characters（非 JSON 前缀）属常态：零日志，不制造噪音', () => {
    const { value, calls } = withErrorCapture(() => extractBibleCastNames('林晚、陈总、阿紫'));
    assert.deepStrictEqual(value, []);
    assert.strictEqual(calls.length, 0, '纯文本不是损坏，不应记日志；实际：' + calls.join(' | '));
  });

  it('3) 截断的 characters JSON（arcs 路径）：弧光表仍返回空，但必须留痕 cast.arcs.parse', () => {
    const { value, calls } = withErrorCapture(() => extractBibleCastArcs('[{"name":"林晚","arc":"反'));
    assert.deepStrictEqual(value, {});
    assert.ok(calls.some((c) => c.includes('[cast.arcs.parse]')),
      '截断 JSON 不得静默丢弃，必须留痕；实际：' + calls.join(' | '));
  });

  it('4) 合法 JSON 与空串都不得产生日志（不误伤正常路径）', () => {
    const { value, calls } = withErrorCapture(() => {
      const names = extractBibleCastNames(JSON.stringify({ 林晚: {} }));
      const arcs = extractBibleCastArcs(JSON.stringify({ 林晚: { arc: '反击' } }));
      const empty = [extractBibleCastNames('   '), extractBibleCastArcs('')];
      return { names, arcs, empty };
    });
    assert.deepStrictEqual(value.names, ['林晚']);
    assert.deepStrictEqual(value.arcs, { 林晚: '反击' });
    assert.deepStrictEqual(value.empty, [[], {}]);
    assert.strictEqual(calls.length, 0, '正常路径不应记日志；实际：' + calls.join(' | '));
  });
});
