/**
 * 每日 API 选型体检提醒测试（v2.187 新增）
 * ------------------------------------------------------------------
 * 背景：模型"当下最强"无法离线自证。系统每天生成一条体检提醒，
 *       距上次人工核对 >=7 天亮黄、>=14 天亮红；超管联网核对后点"已核对"，
 *       写入 MODEL_REVIEW_ACK 流水，基准日刷新、提醒归零，形成闭环。
 * 本测试先于实现（红）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const MR = require('../dist/config/model-review.js');
const AL = require('../dist/services/auto-learning.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const DAY = 86400000;
const d = (y, m, day) => new Date(Date.UTC(y, m - 1, day, 4, 0, 0)); // 北京时间中午，避免跨日边界

const OK_SELF = { ok: true, issues: [], upgradeHints: [], manualNeeded: [] };
const BAD_SELF = { ok: false, issues: [{ role: 'writer', problem: 'x' }], upgradeHints: [], manualNeeded: [] };

describe('modelReviewStatus · 分级与基准日', () => {
  it('从无 ACK：以 CATALOG_PRICING_AS_OF=2026-08-01 为基准，2026-09-29 已 59 天 → overdue', () => {
    const s = MR.modelReviewStatus(null, d(2026, 9, 29), OK_SELF);
    assert.strictEqual(s.baseDate, '2026-08-01');
    assert.strictEqual(s.daysSinceReview, 59);
    assert.strictEqual(s.level, 'overdue');
    assert.strictEqual(s.due, true);
    assert.strictEqual(s.checkedToday, false);
  });

  it('基准日后第 2 天 → fresh、不提醒', () => {
    const s = MR.modelReviewStatus(null, d(2026, 8, 3), OK_SELF);
    assert.strictEqual(s.daysSinceReview, 2);
    assert.strictEqual(s.level, 'fresh');
    assert.strictEqual(s.due, false);
  });

  it('ACK 后第 6 天 fresh；第 7 天 due；第 13 天仍 due；第 14 天 overdue', () => {
    const ack = d(2026, 9, 1);
    assert.strictEqual(MR.modelReviewStatus(ack, new Date(ack.getTime() + 6 * DAY), OK_SELF).level, 'fresh');
    assert.strictEqual(MR.modelReviewStatus(ack, new Date(ack.getTime() + 7 * DAY), OK_SELF).level, 'due');
    assert.strictEqual(MR.modelReviewStatus(ack, new Date(ack.getTime() + 13 * DAY), OK_SELF).level, 'due');
    assert.strictEqual(MR.modelReviewStatus(ack, new Date(ack.getTime() + 14 * DAY), OK_SELF).level, 'overdue');
  });

  it('当天 ACK：daysSinceReview=0、checkedToday=true、fresh', () => {
    const now = d(2026, 9, 29);
    const s = MR.modelReviewStatus(now, now, OK_SELF);
    assert.strictEqual(s.daysSinceReview, 0);
    assert.strictEqual(s.checkedToday, true);
    assert.strictEqual(s.level, 'fresh');
  });

  it('ACK 时间在未来（时钟漂移）：天数钳为 0，不出现负数', () => {
    const now = d(2026, 9, 29);
    const future = new Date(now.getTime() + 3 * DAY);
    const s = MR.modelReviewStatus(future, now, OK_SELF);
    assert.strictEqual(s.daysSinceReview, 0);
    assert.strictEqual(s.level, 'fresh');
  });

  it('组合自检不通过（如国产替补缺失）：即使 7 天内也从 fresh 升级为 due', () => {
    const ack = d(2026, 9, 28);
    const now = d(2026, 9, 29);
    assert.strictEqual(MR.modelReviewStatus(ack, now, BAD_SELF).level, 'due');
    // overdue 不会因任何原因被降级
    const old = new Date(now.getTime() - 30 * DAY);
    assert.strictEqual(MR.modelReviewStatus(old, now, BAD_SELF).level, 'overdue');
  });
});

describe('modelReviewStatus · 提醒内容可执行', () => {
  it('厂商链接覆盖 5 家国产（DeepSeek/方舟/百炼/Kimi/MiniMax）+ 3 家海外，全部 https', () => {
    const s = MR.modelReviewStatus(null, d(2026, 9, 29), OK_SELF);
    const vendors = s.vendors.map((v) => v.vendor).join('|');
    for (const key of ['DeepSeek', '方舟', '百炼', 'Kimi', 'MiniMax', 'OpenAI', 'Anthropic', 'Google']) {
      assert.ok(vendors.includes(key), `缺厂商 ${key}`);
    }
    assert.ok(s.vendors.length >= 8);
    for (const v of s.vendors) {
      assert.match(v.pricingUrl, /^https:\/\//);
      assert.match(v.consoleUrl, /^https:\/\//);
    }
  });

  it('清单含停服/EOL、单价变动、真实账单、国产替补四类必查项', () => {
    const s = MR.modelReviewStatus(null, d(2026, 9, 29), OK_SELF);
    const text = s.checklist.join('\n') + s.message + s.title;
    for (const key of ['停服', '价', '账单', '替补']) assert.ok(text.includes(key), `清单缺 ${key}`);
    assert.ok(s.selfCheckIssues === 0 && s.upgradeHints === 0);
  });

  it('buildReviewText 产出非空纯文本且带状态与天数', () => {
    const s = MR.modelReviewStatus(null, d(2026, 9, 29), OK_SELF);
    const text = MR.buildReviewText(s);
    assert.ok(typeof text === 'string' && text.length > 80);
    assert.ok(text.includes('59'));
  });

  it('reviewSummary 是可落库的精简 JSON，含 level/daysSinceReview/due', () => {
    const s = MR.modelReviewStatus(null, d(2026, 9, 29), OK_SELF);
    const sum = MR.reviewSummary(s);
    assert.strictEqual(sum.level, 'overdue');
    assert.strictEqual(sum.daysSinceReview, 59);
    assert.strictEqual(sum.due, true);
    assert.ok(Array.isArray(sum.vendors));
  });
});

describe('runDailyModelReview / ackModelReview · 每日闭环', () => {
  it('首次运行落 1 条 MODEL_REVIEW；同日重跑幂等不新增；报告为 overdue（基准日已过 14 天）', async () => {
    const prisma = createMemoryPrisma();
    const now = d(2026, 9, 29);
    const r1 = await AL.runDailyModelReview(prisma, {}, 'scheduler', now);
    assert.ok(r1.reportId);
    assert.strictEqual(r1.status.level, 'overdue');
    const r2 = await AL.runDailyModelReview(prisma, {}, 'scheduler', new Date(now.getTime() + 3600000));
    assert.strictEqual(r2.skipped, true);
    const rows = await prisma.learningReport.findMany({ where: { kind: 'MODEL_REVIEW' } });
    assert.strictEqual(rows.length, 1);
  });

  it('超管 ACK 后写 MODEL_REVIEW_ACK 流水；次日定时任务状态归零 fresh', async () => {
    const prisma = createMemoryPrisma();
    const now = d(2026, 9, 29);
    const ack = await AL.ackModelReview(prisma, 'u_admin', now);
    assert.ok(ack.ackId);
    assert.strictEqual(ack.status.checkedToday, true);
    assert.strictEqual(ack.status.level, 'fresh');

    const tomorrow = new Date(now.getTime() + DAY);
    const r = await AL.runDailyModelReview(prisma, {}, 'scheduler', tomorrow);
    assert.strictEqual(r.status.daysSinceReview, 1);
    assert.strictEqual(r.status.level, 'fresh');
    assert.strictEqual(r.status.baseDate, '2026-09-29');
  });
});
