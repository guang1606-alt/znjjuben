/**
 * v2.298 常驻守卫测试：软删除穿透静态设卡（scripts/guard-deleted-filter.cjs）。
 *
 * 双证结构：
 *  ①真实 src 扫描必须 0 violation——现存 48 处查询面（41 直接 + 7 间接）全部被
 *    放行规则精确覆盖；任何人新增裸 project 查询缺 status 过滤，本测试即刻转红。
 *  ②fixture 变异自证（红能力/绿能力）：裸查询 fixture 必报（守卫会咬）、
 *    各类合规 fixture 必不报（守卫不误杀）——防守卫自身形同虚设。
 *
 * 五轮同族修复（v2.292/293/295/296/297）沉淀为常驻设卡，同族漏网面封口。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scanSource, scanProject } = require('../scripts/guard-deleted-filter.cjs');

describe('v2.298 软删除穿透静态设卡（AST-lite 守卫）', { concurrency: 1 }, () => {
  it('真实 src 全量扫描：0 violation（现状全合规，新增裸查询即刻转红）', () => {
    const v = scanProject();
    assert.deepStrictEqual(v, [], `新增裸 project 查询缺 status 过滤：\n${v.map((x) => `  ${x.file}:${x.line} ${x.snippet}`).join('\n')}`);
  });

  it('红能力①：裸 project.findFirst（无 status）必报', () => {
    const fx = `async function f(prisma, id) {\n  const p = await prisma.project.findFirst({ where: { id, userId: 'u' } });\n  if (!p) throw new Error('x');\n}`;
    const v = scanSource(fx, 'src/routes/fixture.ts');
    assert.strictEqual(v.length, 1, '裸查询必须被咬出');
    assert.strictEqual(v[0].line, 2);
  });

  it('红能力②：script findFirst include project 间接面（无 status 判定）必报', () => {
    const fx = `async function f(prisma, sid) {\n  const s = await prisma.script.findFirst({ where: { id: sid }, include: { project: true } });\n  return s.project;\n}`;
    const v = scanSource(fx, 'src/routes/fixture.ts');
    assert.strictEqual(v.length, 1, '间接裸面必须被咬出');
  });

  it('绿能力①：where 内联 status 过滤 → 不报', () => {
    const fx = `const p = await prisma.project.findFirst({ where: { id, userId, status: { not: 'deleted' } } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力②：后置 deleted 判定（resolveScript 形态）→ 不报', () => {
    const fx = `let script = await prisma.script.findFirst({ where: { id: sid }, include: { project: true } });\nif (!script || !script.project) return null;\nif (script.project.status === 'deleted') return null;\nreturn script;`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力③：变量 where 构造段含 deleted（项目列表形态）→ 不报', () => {
    const fx = `const where = { userId, status: { not: 'deleted' } };\nif (q) where.title = { contains: q };\nconst list = await prisma.project.findMany({ where, orderBy: { createdAt: 'desc' } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力④：select 含 status（配额/资产统计形态）→ 不报', () => {
    const fx = `const mine = await prisma.project.findMany({ where: { userId }, select: { status: true } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });

  it('绿能力⑤：文件级白名单（admin 后台面）→ 不报', () => {
    const fx = `const projs = await prisma.project.findMany({ where: { userId: u.id } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/admin.ts').length, 0, 'admin 面管理员语义见全量');
  });

  it('绿能力⑥：行级白名单 marker（存量待拍板面）→ 不报', () => {
    const fx = `const anchor = await prisma.script.findFirst({ where: { id: listing.scriptId }, include: { project: true } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/market.ts').length, 0, '存量购买面待拍板，marker 锚定放行');
  });

  it('绿能力⑦：普通 script 查询（无 include project）→ 不报', () => {
    const fx = `const eps = await prisma.script.findMany({ where: { projectId: p.id }, orderBy: { epNo: 'asc' } });`;
    assert.strictEqual(scanSource(fx, 'src/routes/fixture.ts').length, 0);
  });
});
