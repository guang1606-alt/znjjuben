/**
 * v2.379 角色戏份均衡前置教学 —— buildCharacterBalanceDirective
 * 缺口：characterBalanceCheck（PRD 2.1.17 短剧人物驱动生死线）五类问题检测存在，
 *       pipeline 三处消费（首扫 / 随轮重算 / 终稿重算 + 打回 advice），
 *       但撰写师与润色师首轮零教学。邻近引擎均不覆盖戏份比例域：
 *       character-logic 只管人设一致，voice-print 只管声口同质化，
 *       character-presence-check 只管角色有没有出场。
 * 本组用例：全制式可用 + zh 五类阈值全覆盖 + en 零中文。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCharacterBalanceDirective } = require('../dist/engine/character-balance-check');

// ---------- 1. 缺省参数：中文教学（该检测全制式生效） ----------
test('缺省: 不传参时返回中文教学且非空', () => {
  const d = buildCharacterBalanceDirective();
  assert.ok(d.length > 0, '缺省应返回教学（本检测全制式生效）');
  assert.ok(/[\u4e00-\u9fff]/.test(d), '缺省应按 zh 输出');
});

// ---------- 2. LIVE 同样有教学（不是 AIGC 专属） ----------
test('LIVE: 真人稿同样注入戏份均衡教学', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(d.length > 0, 'LIVE 不应返回空串');
  assert.ok(/主角|戏份/.test(d), 'LIVE 未点名主角/戏份');
});

// ---------- 3. zh：主角戏份不足 —— < 30% / ≥30% / high 20 / mid 8 ----------
test('zh: 主角戏份不足（<20% high 扣 20 / <30% mid 扣 8），至少 30%', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(/主角戏份不足/.test(d), '未点名主角戏份不足');
  assert.ok(/≥30%|30%/.test(d), '未点名 ≥30% 线');
  assert.ok(/扣 20 分/.test(d), '未点名 high 20');
  assert.ok(/扣 8 分/.test(d), '未点名 mid 8');
  assert.ok(/≥2 个|至少两个/.test(d), '未点名 speakingChars≥2 前提');
});

// ---------- 4. zh：工具人独白剧 —— > 80% high / > 70% mid / 20 分 / 8 分 ----------
test('zh: 工具人独白剧（>80% high 扣 20 / >70% mid 扣 8），给对手/反对/揭秘', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(/工具人独白剧/.test(d), '未点名工具人独白剧');
  assert.ok(/80%/.test(d), '未点名 80% 线');
  assert.ok(/70%/.test(d), '未点名 70% 线');
  assert.ok(/至少 2 个|至少两个/.test(d), '未点名给 ≥2 其他角色');
  assert.ok(/提问|反对|揭秘/.test(d), '未给实质性对白类型');
});

// ---------- 5. zh：戏份悬殊 —— 最大/最小 > 5:1 / mid 10 / 最小 ≥ 3 句 ----------
test('zh: 戏份悬殊（最大/最小 >5:1 mid 扣 10），最小角色 ≥3 句，给决定性台词', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(/戏份悬殊/.test(d), '未点名戏份悬殊');
  assert.ok(/5:1|5比1|>5/.test(d), '未点名 >5:1 阈值');
  assert.ok(/扣 10 分/.test(d), '未点名 10 分');
  assert.ok(/≥3 句|不少于 3 句|3 句/.test(d), '未点名最小角色 ≥3 句');
  assert.ok(/决定性台词/.test(d), '未给最小角色的写法');
});

// ---------- 6. zh：对手戏缺失 —— 主角 ≤1 个同场 / mid 8 ----------
test('zh: 对手戏缺失（主角 ≤1 个同场 mid 扣 8），关系网至少 3 个方向', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(/对手戏缺失/.test(d), '未点名对手戏缺失');
  assert.ok(/≤1 个|1 个同场|只和 1 个/.test(d), '未点名 ≤1 同场阈值');
  assert.ok(/扣 8 分/.test(d), '未点名 8 分');
  assert.ok(/关系网|同场/.test(d), '未点明同场判定是场景块内相邻对白');
});

// ---------- 7. zh：龙套过场 —— ≥3 个角色只出现 1 句 / low 5 ----------
test('zh: 龙套过场（≥3 个角色只 1 句 low 扣 5），合并或给第二拍', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(/龙套过场|过场龙套/.test(d), '未点名龙套过场');
  assert.ok(/≥3 个|3 个及以上/.test(d), '未点名 ≥3 阈值');
  assert.ok(/扣 5 分/.test(d), '未点名 5 分');
  assert.ok(/合并为一个|第二拍|第二句/.test(d), '未给处理方式');
  assert.ok(/low/.test(d), '未点名 low 档');
});

// ---------- 8. zh：口径 —— 100-总扣分 / 主角=cast 第一个 key / cast 优先 ----------
test('zh: 口径（100-总扣分最低 0、cast 第一个 key 视为主角、>80% 为 high 阈值）', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(/100 - 总扣分|100-总扣分/.test(d), '未教戏份均衡分计算口径');
  assert.ok(/最低 0/.test(d), '未教分数下限');
  assert.ok(/第一个.*key|cast 第一个|人设卡.*第一个/.test(d), '未教主角识别优先级');
});

// ---------- 9. zh：同场判定口径 + 最小角色 ≥3 句才进比 ----------
test('zh: 同场判定口径（场景块内相邻对白算同场）+ 最大/最小比仅在最小角色 ≥3 句时计算', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'zh');
  assert.ok(/场景块|场头.*重置|相邻对白/.test(d), '未教同场判定口径');
  assert.ok(/≥3 句.*进比|少于 3 句.*不计|<3 句.*不计/.test(d), '未教 ≥3 句进比前提');
});

// ---------- 10. en：零中文 + 五类关键词 ----------
test('en: 零中文，五类问题英文关键词齐备', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), `en 指令混入中文: ${d}`);
  assert.ok(/Protagonist underweight/i.test(d), 'en 未教主角戏份不足');
  assert.ok(/Monologue drama/i.test(d), 'en 未教工具人独白剧');
  assert.ok(/Share gap/i.test(d), 'en 未教戏份悬殊');
  assert.ok(/Narrow co-scene/i.test(d), 'en 未教对手戏缺失');
  assert.ok(/Too many cameos/i.test(d), 'en 未教龙套过场');
});

// ---------- 11. en：六档扣分与阈值齐备 ----------
test('en: 六档扣分（20/8/18/8/10/8/5）与阈值（<30% / >70% / >80% / >5:1 / ≤1 / ≥3）齐备', () => {
  const d = buildCharacterBalanceDirective('LIVE', 'en');
  for (const n of ['20', '18', '10', '8', '5']) assert.ok(d.includes(n), `en 缺扣分 ${n}`);
  assert.ok(/30%/.test(d), 'en 缺 30% 阈值');
  assert.ok(/70%/.test(d), 'en 缺 70% 阈值');
  assert.ok(/80%/.test(d), 'en 缺 80% 阈值');
  assert.ok(/5:1|>5/.test(d), 'en 缺 >5:1 阈值');
  assert.ok(/≤1|1 character/.test(d), 'en 缺 ≤1 同场阈值');
  assert.ok(/≥3|3\+/.test(d), 'en 缺 ≥3 龙套阈值');
});
