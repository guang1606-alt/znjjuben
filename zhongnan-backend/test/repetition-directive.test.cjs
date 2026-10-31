/**
 * v2.376 集内重复感前置教学 —— buildRepetitionDirective
 * 缺口：repetitionCheck（PRD 2.1.16 新鲜感生死线）五类重复检测存在、评分卡 dialogue 维度
 *       权重 0.0797 且三处重算，但撰写师与润色师首轮零教学。
 *       邻近引擎均不覆盖「集内重复」：episode-replay 只管跨集台词复读，
 *       dialogue-water 只管无功能水词，conflict-density 只管烈度递增。
 * 本组用例：双制式可用 + zh 五类阈值全覆盖 + en 零中文。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRepetitionDirective } = require('../dist/engine/repetition-check');

// ---------- 1. 缺省参数：中文教学（该检测对 LIVE/AIGC 全量生效） ----------
test('缺省: 不传参时返回中文教学且非空', () => {
  const d = buildRepetitionDirective();
  assert.ok(d.length > 0, '缺省应返回教学（本检测全制式生效）');
  assert.ok(/[\u4e00-\u9fff]/.test(d), '缺省应按 zh 输出');
});

// ---------- 2. LIVE 同样有教学（不是 AIGC 专属） ----------
test('LIVE: 真人稿同样注入集内重复感教学', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(d.length > 0, 'LIVE 不应返回空串');
  assert.ok(/重复|新鲜感/.test(d), 'LIVE 未教集内重复感');
});

// ---------- 3. zh：近似重复台词 —— 编辑距离 ≤3 / 长度 ≥4 / 2 次扣 8 / 3 次 high 扣 15 ----------
test('zh: 近似重复台词（编辑距离 ≤3 且 ≥4 字）2 次扣 8、3 次及以上 high 扣 15', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(/近似重复台词/.test(d), '未点名近似重复台词');
  assert.ok(/编辑距离 ≤3/.test(d), '未点名编辑距离 ≤3 阈值');
  assert.ok(/不少于 4 字/.test(d), '未点名原句 ≥4 字阈值');
  assert.ok(/2 次扣 8 分/.test(d), '未点名 2 次扣 8 分');
  assert.ok(/3 次及以上扣 15 分/.test(d), '未点名 3 次及以上扣 15 分');
  assert.ok(/high/.test(d), '未点名 high 档');
  assert.ok(/换句式|换说法/.test(d), '未教换句式/换说法');
});

// ---------- 4. zh：重复句式模板 —— 前 4 字骨架 / 3 次 / 2 组 mid / 8 与 12 ----------
test('zh: 重复句式模板（前 4 字骨架 3 次）3 次扣 8、4 次及以上扣 12、2 组 mid', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(/重复句式模板/.test(d), '未点名重复句式模板');
  assert.ok(/前 4 字骨架/.test(d), '未点名前 4 字骨架阈值');
  assert.ok(/3 次扣 8 分/.test(d), '未点名 3 次扣 8 分');
  assert.ok(/4 次及以上扣 12 分/.test(d), '未点名 4 次及以上扣 12 分');
  assert.ok(/2 组及以上/.test(d), '未点名 2 组及以上 mid');
  assert.ok(/疑问、陈述、感叹/.test(d), '未教句式交替');
});

// ---------- 5. zh：重复情绪 beat —— 3 次 / 无升级 / 2 种 mid / 6 与 10 ----------
test('zh: 重复情绪 beat（同词 3 次且无升级）3 次扣 6、4 次及以上扣 10、2 种 mid', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(/重复情绪 beat/.test(d), '未点名重复情绪 beat');
  assert.ok(/3 次及以上且无升级/.test(d), '未点名 3 次无升级阈值');
  assert.ok(/3 次扣 6 分/.test(d), '未点名 3 次扣 6 分');
  assert.ok(/4 次及以上扣 10 分/.test(d), '未点名 4 次及以上扣 10 分');
  assert.ok(/2 种及以上/.test(d), '未点名 2 种及以上 mid');
  assert.ok(/沉默→语言→肢体|沉默 → 语言 → 肢体/.test(d), '未教情绪递进');
});

// ---------- 6. zh：重复动作词 —— 4 次 / 2 个 mid / 5 与 8 ----------
test('zh: 重复动作词（同一动作动词 4 次）4 次扣 5、5 次及以上扣 8、2 个 mid', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(/重复动作词/.test(d), '未点名重复动作词');
  assert.ok(/4 次及以上/.test(d), '未点名 4 次及以上阈值');
  assert.ok(/4 次扣 5 分/.test(d), '未点名 4 次扣 5 分');
  assert.ok(/5 次及以上扣 8 分/.test(d), '未点名 5 次及以上扣 8 分');
  assert.ok(/2 个及以上动作词/.test(d), '未点名 2 个及以上动作词 mid');
  assert.ok(/摔\/砸\/掀\/掷\/甩/.test(d), '未给同类动作换动词清单');
});

// ---------- 7. zh：重复场景开头 —— 2 个及以上 / low / 每次扣 5 ----------
test('zh: 重复场景开头（场头+下一行前 10 字相同）2 个及以上 low、每次扣 5', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(/重复场景开头/.test(d), '未点名重复场景开头');
  assert.ok(/场头\+下一行前 10 字|下一行前 10 字/.test(d), '未点名场景开头判定口径');
  assert.ok(/两个及以上场景/.test(d), '未点名两个及以上场景阈值');
  assert.ok(/每次扣 5 分/.test(d), '未点名每次扣 5 分');
  assert.ok(/low/.test(d), '未点名 low 档');
  assert.ok(/动作开场、对白开场、环境开场/.test(d), '未教场景开场交替');
});

// ---------- 8. zh：变化策略三件套（换说法/升级/换动词换开场） ----------
test('zh: 变化策略齐备（换说法、升级烈度、换动词、换开场）', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(/重复不是禁用/.test(d), '未说明重复不是禁用而是必须变');
  assert.ok(/换说法/.test(d), '未教换说法');
  assert.ok(/升级烈度|升级/.test(d), '未教升级烈度');
  assert.ok(/换动词/.test(d), '未教换动词');
  assert.ok(/换开场/.test(d), '未教换开场');
});

// ---------- 9. zh：分数口径 + 与跨集复读区分 + 必要重复的变化标记 ----------
test('zh: 新鲜度=100-总扣分（最低 0）；与 episode-replay 区分；口头禅须变化标记', () => {
  const d = buildRepetitionDirective('LIVE', 'zh');
  assert.ok(/100 - 总扣分/.test(d), '未教分数口径 100-总扣分');
  assert.ok(/最低 0/.test(d), '未教下限 0');
  assert.ok(/episode-replay/.test(d), '未与跨集复读 episode-replay 区分');
  assert.ok(/口头禅/.test(d), '未提必要重复（口头禅）例外');
  assert.ok(/变化标记/.test(d), '未教必要重复须加变化标记');
});

// ---------- 10. en：零中文 + 五类关键词 ----------
test('en: 零中文，五类重复英文关键词齐备', () => {
  const d = buildRepetitionDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), `en 指令混入中文: ${d}`);
  assert.ok(/near-duplicate|edit distance/i.test(d), 'en 未教近似重复台词');
  assert.ok(/sentence pattern/i.test(d), 'en 未教重复句式模板');
  assert.ok(/emotional beat/i.test(d), 'en 未教重复情绪 beat');
  assert.ok(/action verb/i.test(d), 'en 未教重复动作词');
  assert.ok(/scene opener/i.test(d), 'en 未教重复场景开头');
});

// ---------- 11. en：五类阈值数字配语义锚点 ----------
test('en: 五类阈值（≤3 / ≥4 / 3+ / 4+ / 2+ / 每次扣 5）齐备', () => {
  const d = buildRepetitionDirective('LIVE', 'en');
  assert.ok(/edit distance ≤3/.test(d), 'en 缺编辑距离 ≤3');
  assert.ok(/length ≥4/.test(d), 'en 缺原句 ≥4 字');
  assert.ok(/3\+ deduct 15/.test(d), 'en 缺 3+ 扣 15');
  assert.ok(/12 at 4\+/.test(d), 'en 缺 4+ 扣 12');
  assert.ok(/10 at 4\+/.test(d), 'en 缺情绪 4+ 扣 10');
  assert.ok(/8 at 5\+/.test(d), 'en 缺动作 5+ 扣 8');
  assert.ok(/deduct 5 points each/.test(d), 'en 缺场景开头每次扣 5');
  assert.ok(/2\+/.test(d), 'en 缺 2+ 组合阈值');
});
