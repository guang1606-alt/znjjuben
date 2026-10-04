/**
 * v2.312 常驻守卫测试：条件原子写静态设卡（scripts/guard-conditional-write.cjs）。
 *
 * 双证结构：
 *  ①真实 src 扫描必须 0 violation——现存敏感字段裸写面（状态机翻转/JSON 整体覆盖）
 *    全部被放行规则精确覆盖（含 v2.312 证伪固化白名单 17 条）；任何人新增裸写即刻转红。
 *  ②fixture 变异自证（红能力/绿能力）：裸写 fixture 必报（守卫会咬）、
 *    各类合规 fixture 必不报（守卫不误杀）——防守卫自身形同虚设。
 *
 * 四轮同族修复（v2.308/309/310/311）+ v2.312 teardown outline 修复沉淀为常驻设卡，
 * 同族漏网面封口；证伪清单固化进 ALLOW_MARKERS，后续勘察不再重复分析。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scanSource, scanProject } = require('../scripts/guard-conditional-write.cjs');

describe('v2.312 条件原子写静态设卡（AST-lite 守卫）', { concurrency: 1 }, () => {
  it('真实 src 全量扫描：0 violation（现状全合规，新增裸写即刻转红）', () => {
    const v = scanProject();
    assert.deepStrictEqual(v, [], `新增敏感字段裸写：\n${v.map((x) => `  ${x.file}:${x.line} ${x.snippet}`).join('\n')}`);
  });

  it('红能力①：读取快照后裸 update 状态字段（teardown outline 形态）必报', () => {
    const fx = `async function f(prisma, rec) {\n  await prisma.teardownRecord.update({\n    where: { id: rec.id },\n    data: { direction: 'flip_view', outline: {}, state: 'OUTLINED' },\n  });\n}`;
    const v = scanSource(fx, 'src/routes/fixture.ts');
    assert.strictEqual(v.length, 1, '状态机裸翻转必须被咬出');
    assert.strictEqual(v[0].line, 2);
  });

  it('红能力②：JSON 整体覆盖字段裸写（room payload 形态）必报', () => {
    const fx = `async function f(prisma, room, verdict) {\n  const prev = room.payload || {};\n  await prisma.writersRoom.update({ where: { id: room.id }, data: { payload: { ...prev, verdict } } });\n}`;
    const v = scanSource(fx, 'src/routes/fixture.ts');
    assert.strictEqual(v.length, 1, 'JSON 整体覆盖裸写必须被咬出');
  });

  it('红能力③：data 变量构造段含敏感字段（market relist 形态）必报', () => {
    const fx = `async function f(prisma, listing) {\n  const data = { status: 'ON_SHELF' };\n  await prisma.listing.update({ where: { id: listing.id }, data });\n}`;
    const v = scanSource(fx, 'src/routes/fixture.ts');
    assert.strictEqual(v.length, 1, '变量构造段敏感字段必须被咬出');
  });

  it('绿能力①：updateMany 条件更新 → 不设卡', () => {
    const fx = `await prisma.listing.updateMany({ where: { id: l.id, status: 'ON_SHELF' }, data: { status: 'OFF_SHELF' } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力②：where 多键条件更新（v2.312 teardown 修复形态）→ 不报', () => {
    const fx = `await prisma.teardownRecord.update({ where: { id: rec.id, direction: rec.direction }, data: { state: 'OUTLINED' } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力③：事务/行锁保护内（teardown TO_PROJECT 形态）→ 不报', () => {
    const fx = `async function f(prisma, rec) {\n  await withBillingTransaction(prisma, userId, async (tx) => {\n    await tx.lockAccount(userId);\n    await tx.raw.teardownRecord.update({ where: { id: rec.id }, data: { state: 'TO_PROJECT' } });\n  });\n}`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力④：前置条件抢占后同事务收尾（escrow SETTLED 形态）→ 不报', () => {
    const fx = `async function f(raw, p) {\n  const claimed = await raw.purchase.updateMany({ where: { id: p.id, status: 'ESCROW' }, data: { status: 'SETTLING' } });\n  if (!claimed.count) return;\n  await raw.purchase.update({ where: { id: p.id }, data: { status: 'SETTLED' } });\n}`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力⑤：非敏感字段更新（title/balance/hidden 等）→ 不报', () => {
    const fx = `await prisma.project.update({ where: { id: p.id }, data: { title } });\nawait prisma.post.update({ where: { id: post.id }, data: { hidden: true } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力⑥：文件级白名单（admin 后台面）→ 不报', () => {
    const fx = `await prisma.user.update({ where: { id: u.id }, data: { status: 'X' } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/admin.ts').length, 0, 'admin 面管理员语义放行');
  });

  it('绿能力⑦：行级白名单 marker（interview close 证伪面）→ 不报', () => {
    const fx = `await prisma.interviewSession.update({ where: { id: got.session.id }, data: { status: 'CLOSED' } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/interview.ts').length, 0, 'close 证伪面 marker 锚定放行');
  });

  it('绿能力⑧：create 不设卡', () => {
    const fx = `await prisma.interviewSession.create({ data: { userId, status: 'ACTIVE', materials: {} } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });
});
