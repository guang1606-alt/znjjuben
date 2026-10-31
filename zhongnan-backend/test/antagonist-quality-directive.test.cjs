/**
 * v2.377 对手/反派质量前置教学 —— buildAntagonistQualityDirective
 * 缺口：antagonistQualityCheck（PRD 2.1.26 反派压迫感过硬线）六类问题检测存在，
 *       pipeline 三处消费（首扫 / 随轮重算 / 终稿重算 + 打回 advice），
 *       但撰写师与润色师首轮零教学。邻近引擎均不覆盖单集反派六类质量：
 *       villain-threat 只管跨集威胁升档台账，conflict-escalation 只管烈度递增，
 *       character-logic 只管人设一致，protagonist-goal 只管主角侧能动性。
 * 本组用例：全制式可用 + zh 六类阈值全覆盖 + en 零中文。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAntagonistQualityDirective } = require('../dist/engine/antagonist-quality-check');

// ---------- 1. 缺省参数：中文教学（该检测全制式生效） ----------
test('缺省: 不传参时返回中文教学且非空', () => {
  const d = buildAntagonistQualityDirective();
  assert.ok(d.length > 0, '缺省应返回教学（本检测全制式生效）');
  assert.ok(/[\u4e00-\u9fff]/.test(d), '缺省应按 zh 输出');
});

// ---------- 2. LIVE 同样有教学（不是 AIGC 专属） ----------
test('LIVE: 真人稿同样注入反派质量教学', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(d.length > 0, 'LIVE 不应返回空串');
  assert.ok(/反派|对手/.test(d), 'LIVE 未点名反派/对手');
});

// ---------- 3. zh：反派缺席 —— 施压 0 / high / 30 ----------
test('zh: 反派缺席（全片 0 处施压）high 扣 30、首场当面施压', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(/反派缺席/.test(d), '未点名反派缺席');
  assert.ok(/0 处施压|零施压/.test(d), '未点名施压 0 阈值');
  assert.ok(/扣 30 分/.test(d), '未点名 30 分');
  assert.ok(/第一场|首场/.test(d), '未教首场就施压');
  assert.ok(/甩合同|死线|当众羞辱/.test(d), '未给当面施压的具体示范');
});

// ---------- 4. zh：纸老虎 —— 施压 ≥3 / 布局 0 / mid 15 ----------
test('zh: 纸老虎（施压 ≥3 且布局 0）mid 扣 15、给一次聪明的狠', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(/纸老虎/.test(d), '未点名纸老虎');
  assert.ok(/施压 ≥3|3 处施压/.test(d), '未点名施压 ≥3 阈值');
  assert.ok(/布局 0|0 处布局/.test(d), '未点名布局 0 阈值');
  assert.ok(/扣 15 分/.test(d), '未点名 15 分');
  assert.ok(/买通|伪造证据|将计就计/.test(d), '未教布局/设局的具体手段');
});

// ---------- 5. zh：反派无动机 —— 施压 ≥4 / 动机 0 / mid 12 ----------
test('zh: 反派无动机（施压 ≥4 且动机 0）mid 扣 12、补一句歪理', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(/反派无动机/.test(d), '未点名反派无动机');
  assert.ok(/施压 ≥4|4 处施压/.test(d), '未点名施压 ≥4 阈值');
  assert.ok(/动机 0|0 句动机/.test(d), '未点名动机 0 阈值');
  assert.ok(/扣 12 分/.test(d), '未点名 12 分');
  assert.ok(/当年|我要的是|歪理/.test(d), '未教动机的具体写法');
});

// ---------- 6. zh：反派不登场 —— 施压 ≥3 / 正面对抗 0 / mid 12 ----------
test('zh: 反派不登场（施压 ≥3 且正面对抗 0）mid 扣 12、安排同框对峙', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(/反派不登场/.test(d), '未点名反派不登场');
  assert.ok(/正面对抗 0|0 次正面对抗/.test(d), '未点名正面对抗 0 阈值');
  assert.ok(/电话|转述/.test(d), '未点名电话/转述施压的病象');
  assert.ok(/同框|同场/.test(d), '未教同框对峙');
  assert.ok(/扣 12 分/.test(d), '未点名 12 分');
});

// ---------- 7. zh：弱威胁 —— 施压 ≥3 / 筹码 0 / low 8 ----------
test('zh: 弱威胁（施压 ≥3 且筹码 0）low 扣 8、把筹码摆上台面', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(/弱威胁/.test(d), '未点名弱威胁');
  assert.ok(/筹码 0|0 个筹码/.test(d), '未点名筹码 0 阈值');
  assert.ok(/扣 8 分/.test(d), '未点名 8 分');
  assert.ok(/合同|证据|权势|关系|资本/.test(d), '未给筹码清单');
  assert.ok(/low/.test(d), '未点名 low 档');
});

// ---------- 8. zh：纸片反派 —— 施压 ≥4 / 层次 0 / low 6 ----------
test('zh: 纸片反派（施压 ≥4 且层次 0）low 扣 6、给半秒人性缝隙', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(/纸片反派/.test(d), '未点名纸片反派');
  assert.ok(/层次 0|0 处层次/.test(d), '未点名层次 0 阈值');
  assert.ok(/扣 6 分/.test(d), '未点名 6 分');
  assert.ok(/扭曲逻辑|旧事|红眼|缝隙/.test(d), '未教人性缝隙的具体写法');
  assert.ok(/不是洗白/.test(d), '未点明缝隙不是洗白');
});

// ---------- 9. zh：口径 —— 100-总扣分 / 正面对抗 ≥1 / 短稿 <20 字 / 施压定义 ----------
test('zh: 口径（100-总扣分、正面对抗 ≥1 才落地、短稿 <20 字豁免、反杀不算施压）', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'zh');
  assert.ok(/100 - 总扣分|100-总扣分/.test(d), '未教反派质量分计算口径');
  assert.ok(/最低 0/.test(d), '未教分数下限');
  assert.ok(/≥1 次|至少 1 次/.test(d), '未教正面对抗 ≥1 次');
  assert.ok(/20 字/.test(d), '未教短稿豁免');
  assert.ok(/反杀|还手/.test(d), '未点明主角反杀不算施压');
});

// ---------- 10. en：零中文 + 六类关键词 ----------
test('en: 零中文，六类问题英文关键词齐备', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), `en 指令混入中文: ${d}`);
  assert.ok(/Absent antagonist/i.test(d), 'en 未教反派缺席');
  assert.ok(/Paper tiger/i.test(d), 'en 未教纸老虎');
  assert.ok(/Motiveless villain/i.test(d), 'en 未教反派无动机');
  assert.ok(/Offstage villain/i.test(d), 'en 未教反派不登场');
  assert.ok(/Weak threat/i.test(d), 'en 未教弱威胁');
  assert.ok(/Flat villain/i.test(d), 'en 未教纸片反派');
});

// ---------- 11. en：六档扣分与阈值齐备 ----------
test('en: 六档扣分（30/15/12/12/8/6）与阈值（3+/4+/0）齐备', () => {
  const d = buildAntagonistQualityDirective('LIVE', 'en');
  for (const n of ['30', '15', '12', '8', '6']) assert.ok(d.includes(n), `en 缺扣分 ${n}`);
  assert.ok(/3\+ pressure/i.test(d), 'en 缺 3+ 施压阈值');
  assert.ok(/4\+ pressure/i.test(d), 'en 缺 4+ 施压阈值');
  assert.ok(/0 strategic|0 motive|0 direct|0 leverage|0 layered/i.test(d), 'en 缺各类归零阈值');
});
