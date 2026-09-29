const test = require('node:test');
const assert = require('node:assert');
// c206：听剧本多角色声线分配（确定性、零模型）。浏览器 speechSynthesis 用 pitch/rate 区分旁白与角色。
const { buildVoiceCast, VOICE_PROFILE_GRID, NARRATOR_PROFILE } = require('../dist/engine/listen-voice-cast');

test('c206 buildVoiceCast：旁白固定声线，空/脏角色表给空 cast 不抛错', () => {
  const c = buildVoiceCast([]);
  assert.deepStrictEqual(c.narrator, NARRATOR_PROFILE);
  assert.deepStrictEqual(c.characters, {});
  assert.strictEqual(c.voiceLang, 'zh-CN');
  for (const dirty of [null, undefined, {}, '林晚', 123]) {
    const d = buildVoiceCast(dirty);
    assert.deepStrictEqual(d.characters, {});
    assert.deepStrictEqual(d.narrator, NARRATOR_PROFILE);
  }
});

test('c206 buildVoiceCast：语言决定 BCP-47 选声提示（zh-CN/en-US）', () => {
  assert.strictEqual(buildVoiceCast(['林晚'], { lang: 'zh' }).voiceLang, 'zh-CN');
  assert.strictEqual(buildVoiceCast(['Jane'], { lang: 'en' }).voiceLang, 'en-US');
  assert.strictEqual(buildVoiceCast(['林晚'], { lang: 'fr' }).voiceLang, 'zh-CN', '未知语言回落 zh');
});

test('c206 buildVoiceCast：按出场顺序分配声线网格，确定性且与调用次数无关', () => {
  const a = buildVoiceCast(['林晚', '陈默', '母亲']);
  const b = buildVoiceCast(['林晚', '陈默', '母亲']);
  assert.deepStrictEqual(a, b, '同一份演员表两次结果必须一致');
  assert.deepStrictEqual(a.characters['林晚'], VOICE_PROFILE_GRID[0]);
  assert.deepStrictEqual(a.characters['陈默'], VOICE_PROFILE_GRID[1]);
  assert.deepStrictEqual(a.characters['母亲'], VOICE_PROFILE_GRID[2]);
  // 输入顺序即出场顺序：换序即重新分配（演员表本就按首次发言顺序构建）
  const swapped = buildVoiceCast(['母亲', '陈默', '林晚']);
  assert.deepStrictEqual(swapped.characters['母亲'], VOICE_PROFILE_GRID[0]);
});

test('c206 buildVoiceCast：新增角色追加在尾部，老角色声线绝不重排（听众已建立的声纹预期不被破坏）', () => {
  const before = buildVoiceCast(['林晚', '陈默']);
  const after = buildVoiceCast(['林晚', '陈默', '母亲', '老周']);
  assert.deepStrictEqual(after.characters['林晚'], before.characters['林晚']);
  assert.deepStrictEqual(after.characters['陈默'], before.characters['陈默']);
  assert.deepStrictEqual(after.characters['母亲'], VOICE_PROFILE_GRID[2]);
  assert.deepStrictEqual(after.characters['老周'], VOICE_PROFILE_GRID[3]);
});

test('c206 buildVoiceCast：脏元素清洗（trim/空串剔除/去重保首次出场/非字符串归一）', () => {
  const c = buildVoiceCast([' 林晚 ', '', null, '林晚', 42, '陈默']);
  // 注意：'42' 是整数样式键，Object.keys 按 ES 规范会把它排到字符串键前，故这里不校验枚举顺序
  assert.deepStrictEqual(Object.keys(c.characters).sort(), ['42', '林晚', '陈默']);
  assert.deepStrictEqual(c.characters['林晚'], VOICE_PROFILE_GRID[0], '重复角色只占第一个槽位');
  assert.deepStrictEqual(c.characters['42'], VOICE_PROFILE_GRID[1]);
  assert.deepStrictEqual(c.characters['陈默'], VOICE_PROFILE_GRID[2], '空串/null 不占槽位');
});

test('c206 buildVoiceCast：网格内角色声线两两不同；超出网格长度循环复用且有界', () => {
  const names = Array.from({ length: VOICE_PROFILE_GRID.length }, (_, i) => `角色${i}`);
  const c = buildVoiceCast(names);
  const seen = new Set(names.map((n) => JSON.stringify(c.characters[n])));
  assert.strictEqual(seen.size, VOICE_PROFILE_GRID.length, '网格内每个槽位声线唯一');
  names.forEach((n, i) => assert.deepStrictEqual(c.characters[n], VOICE_PROFILE_GRID[i]));
  // 第 11 个角色循环回 0 号槽（短剧配角通常 <10；循环是显式契约而非哈希碰撞的随机结果）
  const overflow = buildVoiceCast([...names, '路人甲']);
  assert.deepStrictEqual(overflow.characters['路人甲'], VOICE_PROFILE_GRID[0]);
});

test('c206 buildVoiceCast：所有音高/语速落在 speechSynthesis 安全可懂区间', () => {
  const all = [NARRATOR_PROFILE, ...VOICE_PROFILE_GRID];
  for (const p of all) {
    assert.ok(p.pitch >= 0.5 && p.pitch <= 1.5, `pitch 安全区间: ${p.pitch}`);
    assert.ok(p.rate >= 0.8 && p.rate <= 1.2, `rate 可懂区间: ${p.rate}`);
  }
  assert.notDeepStrictEqual(NARRATOR_PROFILE, VOICE_PROFILE_GRID[0], '旁白声线必须与首个角色槽不同');
});
