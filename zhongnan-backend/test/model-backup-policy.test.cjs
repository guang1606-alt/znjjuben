const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/config/model-catalog.js');

test('v2.51 三档×八岗：每岗至少一个真实国产API替补，无海外/LOCAL混入', () => {
  const issues = C.validateAllTierBackups();
  assert.deepStrictEqual(issues, []);
  for (const tier of C.buildTiers()) {
    for (const pick of tier.picks) {
      assert.ok(pick.backupIds.length >= 1, `${tier.id}/${pick.role} 无替补`);
      for (const bid of pick.backupIds) {
        const m = C.findModel(bid);
        assert.ok(m, `${tier.id}/${pick.role} 替补${bid}不存在`);
        assert.strictEqual(m.region, 'domestic', `${tier.id}/${pick.role} 替补非国产`);
      }
    }
  }
});

test('portfolioAdvice 给出的替补全部国产；自我体检 ok 且明示需人工联网确认项', () => {
  for (const a of C.portfolioAdvice()) {
    assert.ok(a.backups.length >= 1, `${a.role} 无国产替补建议`);
  }
  const sc = C.portfolioSelfCheck();
  assert.strictEqual(sc.ok, true);
  assert.deepStrictEqual(sc.issues, []);
  assert.ok(sc.manualNeeded.length >= 1);
});

test('违规组合能被 validateComboBackups 抓出并给国产替代建议', () => {
  const bad = [
    { role: 'writer', modelId: 'gpt_5flag', backupIds: ['claude_sonnet5'] }, // 海外替补
    { role: 'polish', modelId: 'LOCAL', backupIds: ['LOCAL'] },               // LOCAL 不算替补API
    { role: 'architect', modelId: 'deepseek_v4pro', backupIds: [] },          // 无替补
  ];
  const good = ['market_pre', 'character', 'audience', 'compliance', 'market_post']
    .map((role) => ({ role, modelId: 'deepseek_v4flash', backupIds: ['doubao_seedflash'] }));
  const issues = C.validateComboBackups([
    ...good,
    ...bad,
  ]).filter((i) => bad.some((b) => b.role === i.role));
  assert.strictEqual(issues.length, 3);
  assert.ok(issues.find((i) => i.role === 'writer').suggest.length >= 1);
});

test('分工顺序合理：市场前置早于架构、市场终评最后（十阶段自检零错误）', () => {
  const O = require('../dist/agents/pipeline-order.js');
  assert.deepStrictEqual(O.validateOrder(), []);
  assert.strictEqual(O.orderedStages()[0].key, 'market_pre');
});

test('v2.52 第一替补必须是该岗国产最强：三档全部达标，弱替补能被抓', () => {
  for (const tier of C.buildTiers()) {
    assert.deepStrictEqual(C.validateStrongestBackup(tier.picks), [], `${tier.id} 第一替补非国产最强`);
  }
  const weak = [{ role: 'writer', modelId: 'gpt_5flag', backupIds: ['deepseek_v4flash'] }];
  const issues = C.validateStrongestBackup(weak);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].suggest[0], 'doubao_seed2pro');
  assert.strictEqual(C.strongestDomesticBackup('writer', 'doubao_seed2pro').id, 'minimax_m25');
});
