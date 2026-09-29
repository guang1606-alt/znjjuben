const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'ex-secret';
process.env.JWT_REFRESH_SECRET = 'ex-refresh';
const { createApp } = require('../dist/server/app.js');
const { createExportRouter } = require('../dist/routes/export.js');
const { buildVisualStylePrompt } = require('../dist/engine/visual-style-library.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ export: createExportRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'free', level: 'FREE', penName: '免费甲' });
mem._seedUser({ id: 'basic', level: 'BASIC', penName: '基础乙' });
mem._seedUser({ id: 'adv', level: 'ADVANCED', penName: '高级丙' });
mem._seedUser({ id: 'other', level: 'PRO' });

async function seedProject(uid, pid, withScripts = true) {
  await mem.project.create({ data: { id: pid, userId: uid, title: pid === 'pEmpty' ? '空项目' : '逆袭翻盘', mode: 'tags', format: 'LIVE_ACTION',
    bible: { worldview: '都市', timeline: ['一句话梗概'], foreshadow: [], characters: { 主角: { traits: '坚韧', arc: '成长', voice: '利落' } } } } });
  if (withScripts) {
    await mem.script.create({ data: { projectId: pid, epNo: 1, title: '第一集', synopsis: '开局', content: '内景 餐厅 夜\n她放下筷子。\n“这婚我不结了。”', wordCount: 20 } });
    await mem.script.create({ data: { projectId: pid, epNo: 2, title: '第二集', synopsis: '反击', content: '内景 后厨 日\n火苗腾起，她神色平静。', wordCount: 18 } });
  }
}
const H = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const get = (pid, uid, level, qs = '') => fetch(base + `/api/export/${pid}${qs}`, { headers: H(uid, level) });

describe('剧本导出 HTTP（门控/归属/真实文件）', { concurrency: 1 }, () => {
  before(async () => { await seedProject('free', 'pF'); await seedProject('basic', 'p1'); await seedProject('adv', 'p2'); await seedProject('other', 'p3'); await seedProject('basic', 'pEmpty', false); });

  it('未登录 401', async () => { assert.strictEqual((await fetch(base + '/api/export/p1')).status, 401); });

  it('FREE：docx/pdf 403 引导升级，txt 可导出', async () => {
    const docx = await get('pF', 'free', 'FREE', '?format=docx');
    assert.strictEqual(docx.status, 403);
    assert.strictEqual((await docx.json()).needUpgrade, true);
    const pdf = await get('pF', 'free', 'FREE', '?format=pdf');
    assert.strictEqual(pdf.status, 403);
    const txt = await get('pF', 'free', 'FREE', '?format=txt');
    assert.strictEqual(txt.status, 200);
    assert.ok((await txt.text()).includes('分集目录'));
  });

  it('BASIC：docx 真实生成（PK zip 魔数、中文文件名、含正文），pdf 仍 403', async () => {
    const r = await get('p1', 'basic', 'BASIC', '?format=docx');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get('content-type'), /wordprocessingml/);
    assert.ok(/filename\*=UTF-8''/.test(r.headers.get('content-disposition')));
    const buf = Buffer.from(await r.arrayBuffer());
    assert.strictEqual(buf[0], 0x50); assert.strictEqual(buf[1], 0x4b); // ZIP/DOCX 魔数 PK
    assert.ok(buf.length > 2000);
    const pdf = await get('p1', 'basic', 'BASIC', '?format=pdf');
    assert.strictEqual(pdf.status, 403);
  });

  it('ADVANCED：pdf 真实生成（%PDF 头、多页、嵌入中文字体不报错）', async () => {
    const r = await get('p2', 'adv', 'ADVANCED', '?format=pdf');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get('content-type'), /pdf/);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.strictEqual(buf.slice(0, 5).toString(), '%PDF-');
    assert.ok(buf.length > 3000);
  });

  it('不能导出他人项目 404；空项目 400；非法格式 400', async () => {
    assert.strictEqual((await get('p3', 'adv', 'ADVANCED')).status, 404);
    assert.strictEqual((await get('pEmpty', 'basic', 'BASIC', '?format=docx')).status, 400);
    assert.strictEqual((await get('p1', 'basic', 'BASIC', '?format=xlsx')).status, 400);
  });
});

describe('v2.59 导出内嵌全剧情绪节奏页', { concurrency: 1 }, () => {
  it('docx 包内确有内嵌图片（word/media 目录名在中央目录明文可见）', async () => {
    const r = await get('p1', 'basic', 'BASIC', '?format=docx');
    assert.strictEqual(r.status, 200);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.ok(buf.includes(Buffer.from('word/media/')), 'docx 应内嵌波形 PNG');
  });
  it('txt 含导演节奏页文本（火花线+逐集张力）', async () => {
    const r = await get('p2', 'adv', 'ADVANCED', '?format=txt');
    assert.strictEqual(r.status, 200);
    const text = await r.text();
    assert.ok(text.includes('情绪节奏'));
    assert.ok(/[▁▂▃▄▅▆▇█]/.test(text), '含火花线字符');
    assert.strictEqual((text.match(/张力曲线/g) || []).length, 1, '火花线只出现一次不重复');
    assert.ok(text.includes('第1集') && text.includes('第2集'));
    // v2.60 节奏体检与主情绪短标
    assert.ok(text.includes('节奏结构'), '含节奏体检行');
    assert.ok(/推进\/高能占\d+%、呼吸留白占\d+%/.test(text), '压放占比成对');
    assert.ok(/第1集\d+·[一-鿿]{2}/.test(text), '逐集行带主情绪短标');
    // v2.61 钩子编排页
    assert.ok(text.includes('逐集钩子地图'), '含钩子编排页标题');
    assert.ok(text.includes('钩子编排：共'), '含钩子编排头行');
    assert.ok(/第1集 开场「.+」→集尾「.+」/.test(text), '逐集钩子行结构完整');
    // v2.62 爽点-反转兑现链
    assert.ok(text.includes('爽点-反转兑现链'), '含兑现链页标题');
    assert.ok(text.includes('兑现链总览：共'), '含兑现链总览行');
    assert.ok(/第1集 反转.+情绪弧：.+→/.test(text), '逐集兑现链行结构完整');
    // v2.63 人物表与成长弧
    assert.ok(text.includes('人物表与成长弧'), '含人物页标题');
    assert.ok(text.includes('主角五段成长曲线'), '含成长曲线段');
    assert.ok(/第1集 [①②③④⑤]/.test(text), '成长阶段行结构完整');
  });
  it('pdf 两遍法仍稳定出图（200 + PDF 头 + 体积合理）', async () => {
    const r1 = await get('p2', 'adv', 'ADVANCED', '?format=pdf');
    const r2 = await get('p2', 'adv', 'ADVANCED', '?format=pdf');
    assert.strictEqual(r1.status, 200); assert.strictEqual(r2.status, 200);
    const b1 = Buffer.from(await r1.arrayBuffer()); const b2 = Buffer.from(await r2.arrayBuffer());
    assert.strictEqual(b1.slice(0, 5).toString(), '%PDF-');
    // PDF 内嵌生成时间戳导致字节不可能逐字节相等；稳定性看页数一致（两遍法核心承诺）
    const pages = (b) => (b.toString('latin1').match(/\/Type\s*\/Page(?![s])/g) || []).length;
    assert.strictEqual(pages(b1), pages(b2), '两次渲染页数一致');
    assert.ok(pages(b1) >= 1);
  });
});

// v2.154 制作物料清单：JSON 端点（登录即可）+ 导出文档内嵌物料页
const MAT_EP1 = '内景 餐厅 夜\n林昭（低声）：查。\n林昭：这案子不会说谎。\n陈默：你不该回来的吧？\n玉佩在他掌心发烫。';
const MAT_EP2 = '外景 老巷 夜\n林昭：明天提审。\n陈默：走吧。\n玉佩摔碎在地上。';
describe('v2.154 制作物料清单 JSON 端点 + 导出物料页', { concurrency: 1 }, () => {
  before(async () => {
    await mem.project.create({ data: { id: 'pMat', userId: 'free', title: '物料之证', mode: 'tags', format: 'LIVE_ACTION', bible: {} } });
    await mem.script.create({ data: { projectId: 'pMat', epNo: 1, title: '第一集', synopsis: '开局', content: MAT_EP1, wordCount: 60 } });
    await mem.script.create({ data: { projectId: 'pMat', epNo: 2, title: '第二集', synopsis: '反击', content: MAT_EP2, wordCount: 30 } });
  });
  const matGet = (pid, uid, level) => fetch(base + `/api/export/${pid}/materials`, { headers: H(uid, level) });

  it('未登录 401；他人项目 404；空项目 400', async () => {
    assert.strictEqual((await fetch(base + '/api/export/pMat/materials')).status, 401);
    assert.strictEqual((await matGet('pMat', 'other', 'PRO')).status, 404);
    assert.strictEqual((await matGet('pEmpty', 'basic', 'BASIC')).status, 400);
  });

  it('FREE 可用：三表聚合结构正确（场景日夜分行/角色降序/道具封禁态）', async () => {
    const r = await matGet('pMat', 'free', 'FREE');
    assert.strictEqual(r.status, 200, '聚合概览层登录即可');
    const j = await r.json();
    assert.strictEqual(j.projectId, 'pMat');
    assert.strictEqual(j.title, '物料之证');
    assert.strictEqual(j.episodeCount, 2);
    // 场景：内景·餐厅·夜 + 外景·老巷·夜
    assert.strictEqual(j.scenes.length, 2);
    const rest = j.scenes.find((s) => s.location === '餐厅');
    assert.ok(rest && rest.intExt === '内' && rest.timeOfDay === '夜' && rest.count === 1);
    // 角色：林昭 3 句 > 陈默 2 句，降序
    assert.strictEqual(j.stats.castCount, 2);
    assert.strictEqual(j.cast[0].name, '林昭');
    assert.strictEqual(j.cast[0].lines, 3);
    assert.deepStrictEqual(j.cast[0].eps, [1, 2]);
    // 道具：玉佩 2 集提及 + 第2集摔碎封禁
    assert.strictEqual(j.props.length, 1);
    assert.strictEqual(j.props[0].name, '玉佩');
    assert.deepStrictEqual(j.props[0].eps, [1, 2]);
    assert.strictEqual(j.props[0].closed, true);
    assert.strictEqual(j.stats.epCount, 2);
    assert.strictEqual(j.stats.uniqueLocations, 2);
    // v2.155 场景明细矩阵：details 逐集逐场 + matrix 跨集聚合（无画风编号 → 纯场景空镜描述）
    assert.ok(Array.isArray(j.sceneBreakdown.details) && j.sceneBreakdown.details.length === 2, '两集各 1 场共 2 场');
    const d1 = j.sceneBreakdown.details[0];
    assert.strictEqual(d1.ep, 1);
    assert.strictEqual(d1.sceneNo, 1);
    assert.strictEqual(d1.intExt, '内');
    assert.strictEqual(d1.location, '餐厅');
    assert.deepStrictEqual(d1.cast, [{ name: '林昭', lines: 2 }, { name: '陈默', lines: 1 }]);
    assert.deepStrictEqual(d1.props, ['玉佩']);
    assert.ok(d1.charCount > 0);
    assert.strictEqual(d1.prompt, '餐厅（内景，夜），空镜环境参考图', '无画风编号时纯场景空镜描述');
    assert.ok(Array.isArray(j.sceneBreakdown.matrix) && j.sceneBreakdown.matrix.length === 2);
    const mxRest = j.sceneBreakdown.matrix.find((r) => r.location === '餐厅' && r.timeOfDay === '夜');
    assert.ok(mxRest && mxRest.count === 1 && mxRest.eps[0] === 1);
    assert.deepStrictEqual(mxRest.cast, [{ name: '林昭', lines: 2 }, { name: '陈默', lines: 1 }]);
  });

  it('v2.155 场景生图提示词：bible.visualStyleId 组装英文画风段置前（登录即可，FREE 可用）', async () => {
    await mem.project.create({ data: { id: 'pMat2', userId: 'free', title: '画风物料', mode: 'tags', format: 'AIGC', bible: { visualStyleId: 'VS02' } } });
    await mem.script.create({ data: { projectId: 'pMat2', epNo: 1, title: '第一集', synopsis: 'x', content: MAT_EP1, wordCount: 60 } });
    const r = await matGet('pMat2', 'free', 'FREE');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    const want = buildVisualStylePrompt('VS02');
    assert.ok(want, 'VS02 为合法画风编号');
    assert.ok(j.sceneBreakdown.details[0].prompt.startsWith(want), '英文画风段置前（v2.148 注入顺序约定）');
    assert.ok(j.sceneBreakdown.details[0].prompt.includes('空镜环境参考图'), '场景空镜描述在画风段之后');
  });

  it('导出文档内嵌物料页：txt 含「制作物料清单」与场景/角色/道具行', async () => {
    const r = await get('pMat', 'free', 'FREE', '?format=txt');
    assert.strictEqual(r.status, 200);
    const text = await r.text();
    assert.ok(text.includes('制作物料清单'), '物料页标题在文档中');
    assert.ok(text.includes('内景·餐厅·夜'), '场景行内外景归一');
    assert.ok(text.includes('▸ 角色出场表'), '角色表小节');
    assert.ok(text.includes('林昭 — 3句台词'), '角色行');
    assert.ok(text.includes('玉佩 — 第1集/第2集提及'), '道具行');
    assert.ok(text.includes('已封禁'), '封禁态标注');
    // 物料页在分集正文之前（导演交付页簇），且不重复出现
    assert.strictEqual((text.match(/制作物料清单/g) || []).length, 1);
    assert.ok(text.indexOf('制作物料清单') < text.indexOf('第1集　第一集'), '物料页先于正文');
  });
});
