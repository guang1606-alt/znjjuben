/**
 * 自主进化·自动闭环服务测试（v2.186 新增）
 * ------------------------------------------------------------------
 * 痛点：scheduler 连续多日日志"采集0 新增0 生效0 归档0"但不暴露原因，
 *       三类采集源（榜单/政策/站内高分剧本）任一缺失都静默回退，
 *       运营无法判断"是没数据"还是"是采集器坏了"还是"是数据库空"。
 *
 * 本测试要求 runDailyLearningCycle 在返回值里显式给出 sources 诊断，
 * 让空跑原因可见、可观测、可定位。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const AL = require('../dist/services/auto-learning.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

describe('runDailyLearningCycle · 空采集源静默回退可见性 (v2.186)', () => {
  it('三类源全缺 → sources 显式暴露 NO_COLLECTOR / NO_COLLECTOR / EMPTY_TABLE', async () => {
    const prisma = createMemoryPrisma();
    // 不注入 collectBoards / collectPolicy；script 表无 qcPassed=true 行
    const r = await AL.runDailyLearningCycle(prisma, {}, 'u_test');

    // 返回值必须含 sources 诊断字段
    assert.ok(r.sources, '返回值必须含 sources 诊断字段');
    assert.ok(r.sources.boards, 'sources.boards 必须存在');
    assert.ok(r.sources.policy, 'sources.policy 必须存在');
    assert.ok(r.sources.topScripts, 'sources.topScripts 必须存在');

    // 三类源各自的缺口原因要明确
    assert.strictEqual(r.sources.boards.count, 0);
    assert.strictEqual(r.sources.boards.reason, 'NO_COLLECTOR', 'boards 采集器未注入要标 NO_COLLECTOR');
    assert.strictEqual(r.sources.policy.count, 0);
    assert.strictEqual(r.sources.policy.reason, 'NO_COLLECTOR', 'policy 采集器未注入要标 NO_COLLECTOR');
    assert.strictEqual(r.sources.topScripts.count, 0);
    assert.strictEqual(r.sources.topScripts.reason, 'EMPTY_TABLE', 'script 表无 qcPassed=true 行要标 EMPTY_TABLE');

    // 整体仍按原契约返回 0（不破坏旧调用方）
    assert.strictEqual(r.collected, 0);
    assert.strictEqual(r.fresh, 0);
  });

  it('deps 注入空采集器（返回 []）→ 标 EMPTY_COLLECTOR，区别于 NO_COLLECTOR', async () => {
    const prisma = createMemoryPrisma();
    const r = await AL.runDailyLearningCycle(prisma, {
      collectBoards: async () => [],
      collectPolicy: async () => [],
    }, 'u_test');

    assert.strictEqual(r.sources.boards.count, 0);
    assert.strictEqual(r.sources.boards.reason, 'EMPTY_COLLECTOR', '注入了采集器但返回空要标 EMPTY_COLLECTOR');
    assert.strictEqual(r.sources.policy.count, 0);
    assert.strictEqual(r.sources.policy.reason, 'EMPTY_COLLECTOR');
  });

  it('deps 注入采集器抛错 → 标 COLLECTOR_ERROR，不传播异常', async () => {
    const prisma = createMemoryPrisma();
    const r = await AL.runDailyLearningCycle(prisma, {
      collectBoards: async () => { throw new Error('网络超时'); },
      collectPolicy: async () => { throw new Error('RSS 拉取失败'); },
    }, 'u_test');

    assert.strictEqual(r.sources.boards.count, 0);
    assert.strictEqual(r.sources.boards.reason, 'COLLECTOR_ERROR');
    assert.ok(r.sources.boards.error.includes('网络超时'), '要带原始错误信息便于定位');
    assert.strictEqual(r.sources.policy.count, 0);
    assert.strictEqual(r.sources.policy.reason, 'COLLECTOR_ERROR');
  });

  it('script 表有 qcPassed=true 行 → topScripts 计数 > 0，reason 标 OK', async () => {
    const prisma = createMemoryPrisma();
    await prisma.script.create({ data: { projectId: 'p1', epNo: 1, synopsis: '外卖员逆袭成为集团掌门人', qcPassed: true, qcReport: { total: 88 } } });
    await prisma.script.create({ data: { projectId: 'p1', epNo: 2, synopsis: '另一条高分剧本', qcPassed: true, qcReport: { total: 85 } } });
    await prisma.script.create({ data: { projectId: 'p1', epNo: 3, synopsis: '未过质检的低分剧本', qcPassed: false } });

    const r = await AL.runDailyLearningCycle(prisma, {}, 'u_test');
    assert.strictEqual(r.sources.topScripts.count, 2, '只统计 qcPassed=true 的');
    assert.strictEqual(r.sources.topScripts.reason, 'OK');
  });
});

describe('runDailyLearningCycle · 闭环数据完整性', () => {
  it('采集器返回有效信号 → 进入 learning 流程，sources 全标 OK', async () => {
    const prisma = createMemoryPrisma();
    await prisma.script.create({ data: { projectId: 'p1', epNo: 1, synopsis: '外卖员逆袭成为集团掌门人', qcPassed: true, qcReport: { total: 88 } } });

    const r = await AL.runDailyLearningCycle(prisma, {
      collectBoards: async () => [
        { title: '剧A', platform: '红果', tags: ['逆袭'], heat: 100, date: new Date() },
      ],
      collectPolicy: async () => [
        { id: 'p1', title: '备案新规', content: '微短剧备案分类分级规则更新的详细说明文本，需要人工核验' },
      ],
    }, 'u_test');

    assert.strictEqual(r.sources.boards.count, 1);
    assert.strictEqual(r.sources.boards.reason, 'OK');
    assert.strictEqual(r.sources.policy.count, 1);
    assert.strictEqual(r.sources.policy.reason, 'OK');
    assert.strictEqual(r.sources.topScripts.count, 1);
    assert.strictEqual(r.sources.topScripts.reason, 'OK');
    assert.ok(r.collected >= 1, '采集到至少 1 条信号');
  });
});
