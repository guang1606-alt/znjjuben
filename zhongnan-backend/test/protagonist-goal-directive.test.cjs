/**
 * v2.375 主角目标与能动性前置教学 —— buildProtagonistGoalDirective
 * 缺口：protagonistGoalCheck（PRD 2.1.25）六类问题检测存在、pipeline 三处消费
 *       （craftPass 闸门 / 打回 advice / 评分卡 character+plot 加权），
 *       但撰写师与润色师首轮零教学。邻近引擎均不覆盖「欲望-障碍-行动」三件套：
 *       character-balance 只管戏份量，character-logic 只管人设一致，
 *       playbook 仅泛泛要求「底层欲望驱动」，无量化口径。
 * 本组用例：双制式可用 + zh 六类阈值全覆盖 + en 零中文。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProtagonistGoalDirective } = require('../dist/engine/protagonist-goal-check');

// ---------- 1. 缺省参数：中文教学（该检测对 LIVE/AIGC 全量生效） ----------
test('缺省: 不传参时返回中文教学且非空', () => {
  const d = buildProtagonistGoalDirective();
  assert.ok(d.length > 0, '缺省应返回教学（本检测全制式生效）');
  assert.ok(/[\u4e00-\u9fff]/.test(d), '缺省应按 zh 输出');
});

// ---------- 2. LIVE 同样有教学（不是 AIGC 专属） ----------
test('LIVE: 真人稿同样注入主角驱动教学', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(d.length > 0, 'LIVE 不应返回空串');
  assert.ok(/欲望|障碍|动作/.test(d), 'LIVE 未教欲望-障碍-动作三件套');
});

// ---------- 3. zh：欲望隐形 —— 开场 30% / 全文 <2 / high 30 ----------
test('zh: 欲望隐形（开场 30% 零欲望且全文 <2）high 扣 30、前 10 秒可听', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(/欲望隐形|看不见欲望|目标宣言/.test(d), '未点名欲望隐形');
  assert.ok(/开场 30%/.test(d), '未点名开场 30% 窗口');
  assert.ok(/不足 2|少于 2|<2|2 处/.test(d), '未点名全文欲望 <2 阈值');
  assert.ok(/30/.test(d), '未点名 30 分');
  assert.ok(/第一人称|我要|我必须/.test(d), '未教第一人称目标宣言');
  assert.ok(/10 秒/.test(d), '未教前 10 秒必须让观众知道主角图什么');
});

// ---------- 4. zh：主角被动 —— ≥3 被动 / 压过主动 / high 25 ----------
test('zh: 主角被动（被动 ≥3 且不少于主动行动）high 扣 25、每处被动配反制', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(/主角被动|被剧情推着走|被动/.test(d), '未点名主角被动');
  assert.ok(/≥3|3 处|三处/.test(d), '未点名被动 ≥3 阈值');
  assert.ok(/25/.test(d), '未点名 25 分');
  assert.ok(/反制|主动回应|主动行动/.test(d), '未教被动之后必须主动反制');
  assert.ok(/被开除|被赶出|录音|堵人/.test(d), '未给被动转主动的具体示范');
});

// ---------- 5. zh：有目标无障碍 —— 欲望 ≥2 / 障碍 0 / mid 15 ----------
test('zh: 有目标无障碍（欲望 ≥2 且障碍 0）mid 扣 15、立具体强大阻力', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(/有目标无障碍|没有阻力|没人挡/.test(d), '未点名有目标无障碍');
  assert.ok(/障碍 0|0 处.*阻力|阻力 0/.test(d), '未点名障碍 0 阈值');
  assert.ok(/15/.test(d), '未点名 15 分');
  assert.ok(/死线|拒绝|说不|锁/.test(d), '未教立具体且强大的阻力');
  assert.ok(/越值钱|越要狠/.test(d), '未教欲望与障碍的对等关系');
});

// ---------- 6. zh：有目标无行动 —— 欲望 ≥2 / 强动作 0 / mid 15 ----------
test('zh: 有目标无行动（欲望 ≥2 且强动作 0）mid 扣 15、宣言后跟可拍摄动作', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(/有目标无行动|空想|只会表决心/.test(d), '未点名有目标无行动');
  assert.ok(/强动作|行动 0|动作 0/.test(d), '未点名强动作 0 阈值');
  assert.ok(/推门|拨|翻窗|下跪|录音/.test(d), '未给可拍摄动作清单');
  assert.ok(/可拍摄|肢体动作/.test(d), '未教欲望要变成肢体动作');
});

// ---------- 7. zh：中段失焦 —— 25%-70% / mid 10 ----------
test('zh: 中段失焦（欲望 ≥2 但 25%-70% 零牵引）mid 扣 10、中段升级目标', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(/中段失焦|中段.*消失|黄金段/.test(d), '未点名中段失焦');
  assert.ok(/25%-70%/.test(d), '未点名 25%-70% 中段窗口');
  assert.ok(/10/.test(d), '未点名 10 分');
  assert.ok(/升级|改写目标/.test(d), '未教中段升级或改写目标');
});

// ---------- 8. zh：尾段无兑付 —— 欲望 ≥3 / 兑付 0 / low 5 ----------
test('zh: 尾段无兑付（欲望 ≥3 且全片 0 兑付）low 扣 5、给局部小兑付或钩子指下一步', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(/尾段.*兑付|毫无进展|无兑付/.test(d), '未点名尾段无兑付');
  assert.ok(/≥3|3 处|三处/.test(d), '未点名强烈目标 ≥3 阈值');
  assert.ok(/5/.test(d), '未点名 5 分');
  assert.ok(/小兑付|局部|线索/.test(d), '未教局部小兑付');
  assert.ok(/下一步行动|集尾悬置|钩子/.test(d), '未教集尾悬置须指向下一步');
});

// ---------- 9. zh：闭环三件套 + 能动性比 + 短稿 <20 字豁免 ----------
test('zh: 三件套闭环（欲望≥1+障碍≥1+强动作≥1）；能动性比过半；短稿 <20 字豁免', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'zh');
  assert.ok(/三件套|闭环/.test(d), '未教三件套闭环');
  assert.ok(/能动性比|主动.*过半|过半/.test(d), '未教能动性比过半');
  assert.ok(/20 字|不足 20|短稿/.test(d), '未教短稿豁免');
  assert.ok(/白日梦/.test(d), '未点名只有宣言的美化说法');
});

// ---------- 10. en：零中文 + 六类关键词 ----------
test('en: 零中文，六类问题英文关键词齐备', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), `en 指令混入中文: ${d}`);
  assert.ok(/invisible desire|no audible want/i.test(d), 'en 未教欲望隐形');
  assert.ok(/passive protagonist|carried by the plot/i.test(d), 'en 未教主角被动');
  assert.ok(/no obstacle/i.test(d), 'en 未教有目标无障碍');
  assert.ok(/no action|declares intent/i.test(d), 'en 未教有目标无行动');
  assert.ok(/midpoint/i.test(d), 'en 未教中段失焦');
  assert.ok(/no payoff|zero progress/i.test(d), 'en 未教尾段无兑付');
});

// ---------- 11. en：六档扣分与三个窗口阈值齐备 ----------
test('en: 六档扣分（30/25/15/15/10/5）与三个窗口（30%/25%-70%/70%）齐备', () => {
  const d = buildProtagonistGoalDirective('LIVE', 'en');
  for (const n of ['30', '25', '15', '10', '5']) assert.ok(d.includes(n), `en 缺扣分 ${n}`);
  for (const p of ['30%', '25%-70%', '70%']) assert.ok(d.includes(p), `en 缺窗口 ${p}`);
  assert.ok(/agency ratio/i.test(d), 'en 未教 agency ratio');
});
