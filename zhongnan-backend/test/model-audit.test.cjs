const { describe, it } = require('node:test');
const assert = require('node:assert');
const A = require('../dist/engine/model-audit.js');
const C = require('../dist/config/model-catalog.js');
const SCH = require('../dist/services/scheduler.js');

describe('当前线上目录每周盘点', () => {
  it('默认目录健康、无阻断、9组会员×可用档铁底全过', () => {
    const r = A.auditPortfolio();
    assert.strictEqual(r.healthy, true, r.text);
    assert.strictEqual(r.summary.block, 0);
    assert.ok(r.floorChecks.length >= 9 && r.floorChecks.every((f) => f.ok));
    assert.ok(r.tierCosts.find((t) => t.tier === 'flagship').costFen > r.tierCosts.find((t) => t.tier === 'economy').costFen);
  });
});

describe('盘点能抓出各类问题', () => {
  const base = { textModels: C.TEXT_MODELS, imageModels: C.IMAGE_MODELS, tiers: C.buildTiers() };
  it('悬空型号 → BLOCK', () => {
    const tiers = [{ id: 'economy', name: 'x', picks: [{ role: 'writer', modelId: 'ghost_model', backupIds: [] }], costFen: 0, desc: '' }];
    const r = A.auditPortfolio({ ...base, tiers, levels: ['PRO'] });
    assert.ok(r.issues.some((i) => i.code === 'DANGLING_REF' && i.level === 'BLOCK'));
    assert.strictEqual(r.healthy, false);
  });
  it('单一厂商 → LOW_DIVERSITY 警告', () => {
    const picks = ['market_pre', 'architect', 'character', 'writer', 'audience', 'polish', 'compliance', 'market_post']
      .map((role) => ({ role, modelId: 'deepseek_v4flash', backupIds: [] }));
    const tiers = [{ id: 'economy', name: 'x', picks, costFen: 1, desc: '' }];
    const r = A.auditPortfolio({ ...base, tiers, levels: ['PRO'] });
    assert.ok(r.issues.some((i) => i.code === 'LOW_DIVERSITY'));
  });
  it('缺 gpt_image → BLOCK；图片少于8家 → WARN', () => {
    const r = A.auditPortfolio({ ...base, imageModels: C.IMAGE_MODELS.filter((m) => m.id !== 'gpt_image').slice(0, 3), levels: ['PRO'] });
    assert.ok(r.issues.some((i) => i.code === 'NO_GPT_IMAGE' && i.level === 'BLOCK'));
    assert.ok(r.issues.some((i) => i.code === 'IMAGE_FEW'));
  });
  it('过时型号 + 有继任者 → 升级建议', () => {
    const known = A.CURRENT_GENERATION.map((k) => k.id === 'deepseek_v4flash' ? { ...k, status: 'outdated', successorId: 'deepseek_v4pro' } : k);
    const r = A.auditPortfolio({ ...base, knownCurrent: known });
    assert.ok(r.upgrades.some((u) => u.currentId === 'deepseek_v4flash' && u.suggestId === 'deepseek_v4pro'));
  });
});

describe('价格刷新与铁底拦截', () => {
  it('抬价到击穿铁底 → plan 标记 breaksFloor，applyPriceRefresh 拒绝该条', () => {
    // doubao_seedflash 是经济档主力，输出价抬到 200/百万 token 必然击穿
    const r = A.auditPortfolio({ priceRefresh: { doubao_seedflash: { inYuanPerMTok: 50, outYuanPerMTok: 200 } } });
    const bad = r.priceRefreshPlan.filter((p) => p.id === 'doubao_seedflash');
    assert.ok(bad.some((p) => p.breaksFloor));
    const { applied, rejected } = A.applyPriceRefresh(C.TEXT_MODELS, bad);
    assert.strictEqual(applied.length, 0);
    assert.ok(rejected.some((x) => x.id === 'doubao_seedflash'));
  });
  it('温和降价不击穿 → 可应用，目录价格更新', () => {
    const r = A.auditPortfolio({ priceRefresh: { deepseek_v4flash: { inYuanPerMTok: 0.8, outYuanPerMTok: 1.6 } } });
    const plan = r.priceRefreshPlan.filter((p) => !p.breaksFloor);
    const { models, applied } = A.applyPriceRefresh(C.TEXT_MODELS, plan);
    assert.ok(applied.includes('deepseek_v4flash'));
    const m = models.find((x) => x.id === 'deepseek_v4flash');
    assert.strictEqual(m.outYuanPerMTok, 1.6);
  });
});

describe('调度器下次触发时间', () => {
  it('每日：当天已过点→次日03:17', () => {
    const now = new Date('2026-08-31T10:00:00'); // 周一上午
    const ms = SCH.nextDailyDelay(now, 3, 17);
    const target = new Date(now.getTime() + ms);
    assert.strictEqual(target.getHours(), 3); assert.strictEqual(target.getMinutes(), 17);
    assert.strictEqual(target.getDate(), 1); // 次日 9/1
  });
  it('每周：周一10:00已过当天04:20→下周一04:20（6天18小时余）', () => {
    const now = new Date('2026-08-31T10:00:00');
    const ms = SCH.nextWeeklyDelay(now, 4, 20);
    const target = new Date(now.getTime() + ms);
    assert.strictEqual(target.getDay(), 1); assert.strictEqual(target.getHours(), 4);
    const days = ms / 86400000;
    assert.ok(days > 6.7 && days < 6.8, `应约6.76天，实际${days}`);
  });
  it('每周：周三10:00→下周一04:20（4天18小时余）', () => {
    const now = new Date('2026-09-02T10:00:00'); // 周三
    const ms = SCH.nextWeeklyDelay(now, 4, 20);
    const target = new Date(now.getTime() + ms);
    assert.strictEqual(target.getDay(), 1);
    const days = ms / 86400000;
    assert.ok(days > 4.7 && days < 4.8, `应约4.76天，实际${days}`);
  });
  it('DISABLE_AUTO_SCHEDULER=1 时不启动', () => {
    process.env.DISABLE_AUTO_SCHEDULER = '1';
    const h = SCH.startAutoScheduler({});
    assert.strictEqual(h.running(), false);
    delete process.env.DISABLE_AUTO_SCHEDULER;
  });
});
