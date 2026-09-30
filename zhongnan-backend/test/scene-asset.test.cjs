const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'sa-secret';
process.env.JWT_REFRESH_SECRET = 'sa-refresh';
const { buildSceneAssetDirective, extractSceneAssetDrafts } = require('../dist/engine/scene-asset.js');
const { scoreSceneAsset, detectSceneAssetConflicts } = require('../dist/engine/scene-health.js');
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 沙盘隔离：无供应商 → callText 走确定性兜底，零真实模型调用
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

async function jsonReq(method, path, uid, level, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (uid) headers.Authorization = `Bearer ${signAccess({ sub: uid, level })}`;
  const resp = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

async function callEpisode(uid, level, body) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` };
  const resp = await fetch(base + '/api/generate/episodes', { method: 'POST', headers, body: JSON.stringify(body) });
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; const events = [];
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) events.push(JSON.parse(l.slice(6))); });
      }
    }
    return { status: resp.status, events };
  }
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

// —— 引擎单元测试 ——
describe('场景资产引擎·指令构建 buildSceneAssetDirective', () => {
  it('空/无效资产返回空串（缺 meaning 视为无效，不注入）', () => {
    assert.strictEqual(buildSceneAssetDirective([]), '');
    assert.strictEqual(buildSceneAssetDirective(null), '');
    assert.strictEqual(buildSceneAssetDirective([{ name: '老宅祠堂', meaning: '' }, { name: '天台' }]), '');
  });

  it('中文指令：头部+资产块（功能/氛围/禁忌/锚点四字段）+四条强约束规则', () => {
    const d = buildSceneAssetDirective([{ name: '老宅祠堂', meaning: '家产争夺的主线舞台', mood: '森严压抑', taboo: '后期已烧毁，再现有须补重建交代', visualAnchor: '青砖黛瓦三进院' }]);
    assert.ok(d.includes('【场景资产强约束】'));
    assert.ok(d.includes('1. 「老宅祠堂」'));
    assert.ok(d.includes('剧情功能：家产争夺的主线舞台'));
    assert.ok(d.includes('氛围基调：森严压抑'));
    assert.ok(d.includes('状态禁忌：后期已烧毁'));
    assert.ok(d.includes('外观锚点：青砖黛瓦三进院'));
    for (const marker of ['剧情功能与氛围基调必须保持', '节拍适配', '撰写师', '自由创作']) {
      assert.ok(d.includes(marker), `四条强约束必须含：${marker}`);
    }
  });

  it('英文指令与超上限截断（最多 10 处场景）', () => {
    const assets = Array.from({ length: 12 }, (_, i) => ({ name: `S${i + 1}`, meaning: `m${i + 1}` }));
    const d = buildSceneAssetDirective(assets, 'en');
    assert.ok(d.includes('[SCENE ASSET CONSTRAINTS]'));
    assert.ok(d.includes('plot function: m10'));
    assert.ok(!d.includes('plot function: m11'), '最多 10 处场景');
    assert.ok(d.includes('MUST stay intact') && d.includes('visual anchor'));
  });
});

describe('场景资产引擎·沉淀提取 extractSceneAssetDrafts', () => {
  const EP1 = '场景1：老宅祠堂·日\n△烛火摇曳，家产争夺开场。\n场景2：天台·夜\n△林昭眺望城市。';
  const EP2 = '内景 老宅祠堂 夜\n△灵堂白烛，认亲仪式被搅局。';

  it('空/非法输入返回空数组；ep 非法或空 content 的条目被过滤', () => {
    assert.deepStrictEqual(extractSceneAssetDrafts(null), []);
    assert.deepStrictEqual(extractSceneAssetDrafts(undefined), []);
    assert.deepStrictEqual(extractSceneAssetDrafts([]), []);
    assert.deepStrictEqual(extractSceneAssetDrafts([{ ep: 0, content: '场景1：祠堂·日' }, { ep: 'x', content: '场景1：祠堂·日' }, { ep: 1, content: '   ' }]), []);
  });

  it('跨集聚合：内外景前缀归一（内景 X 与场景头 X 同档）、出现集升序、高频优先', () => {
    const drafts = extractSceneAssetDrafts([{ ep: 2, content: EP2 }, { ep: 1, content: EP1 }]); // 乱序输入安全
    assert.strictEqual(drafts.length, 2);
    assert.strictEqual(drafts[0].name, '老宅祠堂', '跨 2 集的高频场景排最前');
    assert.deepStrictEqual(drafts[0].eps, [1, 2], '「内景 老宅祠堂 夜」与「场景1：老宅祠堂·日」归一为同档');
    assert.strictEqual(drafts[1].name, '天台');
    assert.deepStrictEqual(drafts[1].eps, [1]);
  });

  it('仅「内景/外景」无具体地点的场头不进档；单次沉淀上限 12 处', () => {
    assert.deepStrictEqual(extractSceneAssetDrafts([{ ep: 1, content: '内景 日\n△空镜。' }]), [], '仅前缀无地点不建档');
    const eps = [{ ep: 1, content: '场景1：老宅祠堂·日\n△家产争夺。' }];
    for (let i = 2; i <= 13; i++) {
      eps.push({ ep: i, content: `场景1：街市${i}号·日\n△过场。` });
    }
    const drafts = extractSceneAssetDrafts(eps);
    assert.strictEqual(drafts.length, 12, '最多 12 处草稿（场头噪音低，比道具 8 放宽一档）');
    assert.strictEqual(drafts[0].name, '老宅祠堂', '跨 12 集高频场景排最前');
  });
});

describe('场景资产引擎·体检评分与冲突预警', () => {
  it('scoreSceneAsset：null/缺功能=0 分空壳；五维全满=100 丰满', () => {
    const zero = scoreSceneAsset(null);
    assert.strictEqual(zero.score, 0);
    assert.strictEqual(zero.level, 'thin');
    const full = scoreSceneAsset({ name: '老宅祠堂', meaning: '家产争夺的主线舞台', mood: '森严压抑', eps: [1, 2], taboo: '后期已烧毁', visualAnchor: '青砖黛瓦三进院', tags: ['权谋'] });
    assert.strictEqual(full.score, 100, '功能30+氛围15+出现集15+锚点25+标签15=100（taboo 随档生效不占预算）');
    assert.strictEqual(full.level, 'rich');
    assert.deepStrictEqual(full.missing, []);
  });

  it('短功能扣 10；无氛围有状态禁忌给半分 10（维度兼收，正向验证"会响"）', () => {
    const shortMeaning = scoreSceneAsset({ name: '老宅祠堂', meaning: '认亲', eps: [1], mood: '森严', visualAnchor: '青砖黛瓦' });
    assert.strictEqual(shortMeaning.score, 75, '30-10+15+15+25=75');
    assert.strictEqual(shortMeaning.level, 'usable');
    assert.ok(shortMeaning.advice.some((a) => a.includes('剧情功能过短')), '短功能必须给补功能建议');
    const halfMood = scoreSceneAsset({ name: '老宅祠堂', meaning: '家产争夺的主线舞台', eps: [1, 2], taboo: '后期已烧毁', visualAnchor: '青砖黛瓦三进院', tags: ['权谋'] });
    assert.strictEqual(halfMood.score, 95, '30+15+10+25+15=95（无氛围但红线在位给 Math.round(15*2/3)=10）');
    assert.ok(halfMood.advice.some((a) => a.includes('氛围') || a.includes('mood')), '有禁忌无氛围必须给补氛围建议');
    const noMoodNoTaboo = scoreSceneAsset({ name: '老宅祠堂', meaning: '家产争夺的主线舞台', eps: [1], visualAnchor: '青砖黛瓦', tags: ['权谋'] });
    assert.ok(noMoodNoTaboo.missing.includes('mood'), '无氛围无禁忌才算缺 mood 维度');
  });

  it('detectSceneAssetConflicts：dup_name/same_scene/closed_mismatch 三冲突各自会响，双键不全不误报', () => {
    const dup = detectSceneAssetConflicts([{ name: '老宅祠堂', meaning: '家产争夺的决策现场' }, { name: '老宅祠堂', meaning: '认亲仪式被搅局之地' }]);
    assert.strictEqual(dup.length, 1);
    assert.strictEqual(dup[0].type, 'dup_name');
    const same = detectSceneAssetConflicts([
      { name: '老宅祠堂', meaning: '家产争夺的主线舞台', visualAnchor: '青砖黛瓦三进院' },
      { name: '祠堂', meaning: '家产争夺的主线舞台', visualAnchor: '青砖黛瓦三进院' },
    ]);
    assert.strictEqual(same[0].type, 'same_scene', '异名+功能+锚点双键一致=重复档');
    assert.strictEqual(same[0].a, '老宅祠堂');
    assert.strictEqual(same[0].b, '祠堂');
    assert.strictEqual(detectSceneAssetConflicts([
      { name: '老宅祠堂', meaning: '家产争夺的主线舞台', visualAnchor: '青砖黛瓦三进院' },
      { name: '祠堂', meaning: '家产争夺的主线舞台', visualAnchor: '现代混凝土礼堂' },
    ]).length, 0, '锚点不同≠同一个场（双键防功能文本泛同误报）');
    const closed = detectSceneAssetConflicts([{ name: '老宅祠堂', meaning: '家产争夺的主线舞台', taboo: '已烧毁' }, { name: '老宅祠堂', meaning: '家产争夺的主线舞台' }]);
    assert.strictEqual(closed[0].type, 'closed_mismatch', '同名同功能状态红线不一致必须预警');
    assert.strictEqual(detectSceneAssetConflicts([{ name: '老宅祠堂', meaning: '家产争夺的主线舞台' }]).length, 0, '单档无冲突');
  });
});

// —— HTTP 闭环（串行）——
describe('场景资产 HTTP 闭环（串行）', { concurrency: 1 }, () => {
  let projIdFromRef = null;
  it('手动建档+非法参数400（含 eps 类型校验）+按id编辑+列表归属隔离+删除防越权+未登录401', async () => {
    mem._seedUser({ id: 'u_sc_a', level: 'BASIC', balance: 5000 });
    mem._seedUser({ id: 'u_sc_b', level: 'BASIC', balance: 5000 });
    const r1 = await jsonReq('POST', '/api/generate/scene-assets', 'u_sc_a', 'BASIC', { name: '老宅祠堂', meaning: '家产争夺的主线舞台', mood: '森严压抑', taboo: '后期已烧毁，再现有须补重建交代', eps: [1, 2, 2, 99999, 0] });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.updated, false);
    assert.strictEqual(r1.json.asset.usedCount, 0);
    assert.deepStrictEqual(r1.json.asset.eps, [1, 2], 'normalizeEps 清洗：去重/越界/非法项');
    const bad = await jsonReq('POST', '/api/generate/scene-assets', 'u_sc_a', 'BASIC', { name: '', meaning: '' });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.json.field, 'name');
    const badEps = await jsonReq('POST', '/api/generate/scene-assets', 'u_sc_a', 'BASIC', { name: '天台', meaning: '情感锚点', eps: '1,2' });
    assert.strictEqual(badEps.status, 400);
    assert.strictEqual(badEps.json.field, 'eps', 'eps 必须是数字数组');
    const r2 = await jsonReq('POST', '/api/generate/scene-assets', 'u_sc_a', 'BASIC', { id: r1.json.asset.id, name: '老宅祠堂', meaning: '手动精修后的主线舞台' });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.updated, true, '按 id 更新本人记录');
    assert.strictEqual(mem._sceneAssets.length, 1, '编辑不新建行');
    const listA = await jsonReq('GET', '/api/generate/scene-assets', 'u_sc_a', 'BASIC');
    assert.strictEqual(listA.json.assets.length, 1);
    const listB = await jsonReq('GET', '/api/generate/scene-assets', 'u_sc_b', 'BASIC');
    assert.strictEqual(listB.json.assets.length, 0, '归属隔离');
    const delOther = await jsonReq('DELETE', `/api/generate/scene-assets/${r1.json.asset.id}`, 'u_sc_b', 'BASIC');
    assert.strictEqual(delOther.status, 404, '删他人资产防越权探测');
    const anon = await fetch(base + '/api/generate/scene-assets');
    assert.strictEqual(anon.status, 401);
  });

  it('立项引用：非法/他人 id 静默丢弃，本人资产快照进 bible.sceneAssets 且 usedCount+1', async () => {
    const own = mem._sceneAssets.find((x) => x.name === '老宅祠堂' && x.userId === 'u_sc_a');
    const other = await jsonReq('POST', '/api/generate/scene-assets', 'u_sc_b', 'BASIC', { name: '医院走廊', meaning: 'B 用户的情感锚点' });
    assert.strictEqual(other.status, 200);
    const proj = await jsonReq('POST', '/api/generate/projects', 'u_sc_a', 'BASIC', {
      title: '认亲之路', mode: 'tags',
      sceneAssetIds: [own.id, other.json.asset.id, 'sa_fake_not_exist'],
    });
    assert.strictEqual(proj.status, 200);
    projIdFromRef = proj.json.id;
    const snap = proj.json.bible?.sceneAssets;
    assert.ok(Array.isArray(snap) && snap.length === 1, '他人/不存在 id 静默丢弃，仅剩本人资产');
    assert.strictEqual(snap[0].name, '老宅祠堂');
    assert.strictEqual(snap[0].meaning, '手动精修后的主线舞台');
    assert.strictEqual(mem._sceneAssets.find((x) => x.id === own.id).usedCount, 1, '引用计数+1');
  });

  it('生成注入：架构师/撰写师 prompt 含场景资产强约束，人设师不含（场景是舞台事实源非人设）', async () => {
    assert.ok(projIdFromRef, '上一用例已建项目');
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await callEpisode('u_sc_a', 'BASIC', { projectId: projIdFromRef, brief: '林昭回乡奔丧，家产争夺在老宅祠堂爆发。' });
      assert.strictEqual(r.status, 200);
      assert.ok(r.events.some((e) => e.stage === 'done'), '必须跑到 done');
      const promptOf = (role) => captured.filter((c) => c.role === role).map((c) => c.prompt).join('\n');
      for (const role of ['architect', 'writer']) {
        const p = promptOf(role);
        assert.ok(p.includes('场景资产强约束'), `${role} 必须注入场景资产强约束指令`);
        assert.ok(p.includes('老宅祠堂'), `${role} 必须含场景名`);
      }
      const designerPrompt = promptOf('designer');
      assert.ok(!designerPrompt.includes('场景资产强约束'), '人设师人物卡不含场景（注入语义划界）');
      assert.ok(mem._accounts.get('u_sc_a').balance < 5000, '沙盘正常计费');
    } finally {
      MP.callText = orig;
    }
  });

  it('一键沉淀：跨集聚合+前缀归一+占位"功能待补"+手动档不降级（更新不碰 meaning/mood/taboo/锚点/标签）', async () => {
    mem._seedUser({ id: 'u_sc_h', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_sc_h', { id: 'p_sc_h', userId: 'u_sc_h', title: '认亲之路', mode: 'tags', bible: null });
    const EP1 = '场景1：老宅祠堂·日\n△烛火摇曳，家产争夺开场。';
    const EP2 = '内景 老宅祠堂 夜\n△灵堂白烛，认亲仪式被搅局。';
    const EP3 = '场景3：天台·夜\n△林昭眺望城市。';
    await mem.script.create({ data: { projectId: 'p_sc_h', epNo: 1, title: 'EP1', synopsis: '', content: EP1, wordCount: EP1.length } });
    await mem.script.create({ data: { projectId: 'p_sc_h', epNo: 2, title: 'EP2', synopsis: '', content: EP2, wordCount: EP2.length } });
    await mem.script.create({ data: { projectId: 'p_sc_h', epNo: 3, title: 'EP3', synopsis: '', content: EP3, wordCount: EP3.length } });
    const r = await jsonReq('POST', '/api/generate/scene-assets/from-project/p_sc_h?lang=zh', 'u_sc_h', 'BASIC');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.created, 2);
    const first = r.json.assets[0];
    assert.strictEqual(first.name, '老宅祠堂', '跨 2 集高频场景排最前');
    assert.deepStrictEqual(first.eps, [1, 2], '「内景 老宅祠堂 夜」与场头「老宅祠堂·日」归一同档');
    assert.strictEqual(first.meaning, '功能待补', '场景无功能一手源，创建占位不臆造语义');
    // 手动精修功能/氛围/禁忌/锚点/标签（沉淀不产这些字段，只能手动补）
    const manual = await jsonReq('POST', '/api/generate/scene-assets', 'u_sc_h', 'BASIC', {
      id: first.id, name: '老宅祠堂', meaning: '家产争夺的主线舞台', mood: '森严压抑', taboo: '后期已烧毁', visualAnchor: '青砖黛瓦三进院', tags: ['权谋', '祠堂'],
    });
    assert.strictEqual(manual.status, 200);
    // 二次沉淀：同名 update 只并集 eps；功能/氛围/禁忌/锚点/标签一律不触碰（c155 占位稿不降级前置）
    const r2 = await jsonReq('POST', '/api/generate/scene-assets/from-project/p_sc_h', 'u_sc_h', 'BASIC');
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.created, 0);
    assert.strictEqual(r2.json.updated, 2);
    const row = mem._sceneAssets.find((x) => x.name === '老宅祠堂' && x.userId === 'u_sc_h');
    assert.strictEqual(row.meaning, '家产争夺的主线舞台', '手动功能不被沉淀覆盖（只增强不降级）');
    assert.strictEqual(row.mood, '森严压抑', '氛围沉淀从不触碰');
    assert.strictEqual(row.taboo, '后期已烧毁', '状态禁忌沉淀从不触碰');
    assert.strictEqual(row.visualAnchor, '青砖黛瓦三进院', '外观锚点沉淀从不触碰');
    assert.deepStrictEqual(row.tags, ['权谋', '祠堂'], '标签沉淀从不触碰');
    assert.deepStrictEqual(row.eps, [1, 2], '出现集并集语义（家族铁律：跨项目历史不丢）');
    assert.strictEqual(row.sourceProjectId, 'p_sc_h', '来源追踪刷新');
    // 他人项目 404
    const r3 = await jsonReq('POST', '/api/generate/scene-assets/from-project/p_sc_h', 'u_sc_b', 'BASIC');
    assert.strictEqual(r3.status, 404);
  });

  it('v2.161 跨项目沉淀并集：B 剧沉淀不抹掉 A 剧出现历史（eps 只增强不降级）', async () => {
    mem._seedUser({ id: 'u_sc_un', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_sc_unA', { id: 'p_sc_unA', userId: 'u_sc_un', title: 'A剧认亲', mode: 'tags', bible: null });
    const epA1 = '场景1：老宅祠堂·日\n△家产争夺开场。';
    const epA2 = '场景2：天台·夜\n△情感锚点戏。';
    await mem.script.create({ data: { projectId: 'p_sc_unA', epNo: 1, title: 'EP1', synopsis: '', content: epA1, wordCount: epA1.length } });
    await mem.script.create({ data: { projectId: 'p_sc_unA', epNo: 2, title: 'EP2', synopsis: '', content: epA2, wordCount: epA2.length } });
    const rA = await jsonReq('POST', '/api/generate/scene-assets/from-project/p_sc_unA?lang=zh', 'u_sc_un', 'BASIC');
    assert.strictEqual(rA.status, 200);
    assert.strictEqual(rA.json.created, 2);
    // B 剧老宅祠堂复现：覆盖语义下会抹掉 A 剧历史（eps 变 [9]，置景复用密度失真）
    mem._projects.set('p_sc_unB', { id: 'p_sc_unB', userId: 'u_sc_un', title: 'B剧复现', mode: 'tags', bible: null });
    const epB9 = '内景 老宅祠堂 夜\n△B 剧再借同一舞台。';
    await mem.script.create({ data: { projectId: 'p_sc_unB', epNo: 9, title: 'EP9', synopsis: '', content: epB9, wordCount: epB9.length } });
    const rB = await jsonReq('POST', '/api/generate/scene-assets/from-project/p_sc_unB', 'u_sc_un', 'BASIC');
    assert.strictEqual(rB.status, 200);
    assert.strictEqual(rB.json.updated, 1, '同名走更新');
    const row = mem._sceneAssets.find((x) => x.name === '老宅祠堂' && x.userId === 'u_sc_un');
    assert.deepStrictEqual(row.eps, [1, 9], 'A 剧历史 + B 剧新出现取并集（修复前被覆盖成 [9]）');
    const tt = mem._sceneAssets.find((x) => x.name === '天台' && x.userId === 'u_sc_un');
    assert.deepStrictEqual(tt.eps, [2], '未在 B 剧出现的场景档不受影响');
  });

  it('空项目沉淀为 0（skipped=0）+ 无场头内容不误建空档', async () => {
    mem._seedUser({ id: 'u_sc_e', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_sc_empty', { id: 'p_sc_empty', userId: 'u_sc_e', title: '空项目', mode: 'tags', bible: null });
    const r1 = await jsonReq('POST', '/api/generate/scene-assets/from-project/p_sc_empty', 'u_sc_e', 'BASIC');
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.created, 0);
    assert.strictEqual(r1.json.skipped, 0);
    mem._projects.set('p_sc_plain', { id: 'p_sc_plain', userId: 'u_sc_e', title: '无场头', mode: 'tags', bible: null });
    await mem.script.create({ data: { projectId: 'p_sc_plain', epNo: 1, title: 'EP1', synopsis: '', content: '两人在茶馆里聊了一下午天气。', wordCount: 15 } });
    const r2 = await jsonReq('POST', '/api/generate/scene-assets/from-project/p_sc_plain', 'u_sc_e', 'BASIC');
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.created, 0, '无合规场头不误建');
  });

  it('体检查询+五维评分+分页钳制+冲突跑全量库（dup_name/closed_mismatch 跨库触发）', async () => {
    const h = await jsonReq('GET', '/api/generate/scene-assets/health?lang=zh', 'u_sc_h', 'BASIC');
    assert.strictEqual(h.status, 200);
    assert.ok(Array.isArray(h.json.items) && Array.isArray(h.json.conflicts));
    const zt = h.json.items.find((x) => x.name === '老宅祠堂');
    assert.ok(zt, '体检按用户归属');
    assert.strictEqual(typeof zt.score, 'number');
    assert.strictEqual(zt.level, 'rich', '五维齐全（功能/氛围/出现集/锚点/标签）=丰满档');
    const anon = await fetch(new URL('/api/generate/scene-assets/health', base));
    assert.strictEqual(anon.status, 401);
    // 分页 + 冲突跑全量库：乙丙异名同功能同锚点被甲隔开，limit=2 时分属两页也必须检出
    mem._seedUser({ id: 'u_sc_pg', level: 'BASIC', balance: 0 });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_pg', name: '场景乙', meaning: '家产争夺的主线舞台', visualAnchor: '青砖黛瓦三进院' } });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_pg', name: '场景甲', meaning: '复仇夜雨中的天台' } });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_pg', name: '场景丙', meaning: '家产争夺的主线舞台', visualAnchor: '青砖黛瓦三进院' } });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_pg', name: '场景丁', meaning: '医院走廊情感锚点' } });
    const p1 = await jsonReq('GET', '/api/generate/scene-assets/health?limit=2&offset=0', 'u_sc_pg', 'BASIC');
    assert.strictEqual(p1.status, 200);
    assert.strictEqual(p1.json.total, 4);
    assert.strictEqual(p1.json.limit, 2);
    assert.strictEqual(p1.json.items.length, 2, '页大小受 limit 约束');
    const sp = p1.json.conflicts.find((c) => c.type === 'same_scene');
    assert.ok(sp, '冲突在全量库上计算，跨页重复档不漏');
    const p3 = await jsonReq('GET', '/api/generate/scene-assets/health?limit=999&offset=-5', 'u_sc_pg', 'BASIC');
    assert.strictEqual(p3.json.limit, 200, 'limit 钳到 200');
    assert.strictEqual(p3.json.offset, 0, '负 offset 归零');
    // closed_mismatch：同名同功能但状态红线不一致（一档已烧毁一档在用）
    mem._seedUser({ id: 'u_sc_cm', level: 'BASIC', balance: 0 });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_cm', name: '老宅祠堂', meaning: '家产争夺的主线舞台', taboo: '后期已烧毁' } });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_cm', name: '老宅祠堂', meaning: '家产争夺的主线舞台' } });
    const hcm = await jsonReq('GET', '/api/generate/scene-assets/health', 'u_sc_cm', 'BASIC');
    const cm = hcm.json.conflicts.find((c) => c.type === 'closed_mismatch');
    assert.ok(cm, '同名状态红线冲突必须预警（复用拿错烧毁/在用状态）');
  });

  it('列表端点 total + 200 硬帽：101 条全部可见，列表与体检可见范围一致', async () => {
    mem._seedUser({ id: 'u_sc_cap', level: 'BASIC', balance: 0 });
    for (let i = 1; i <= 101; i++) {
      await mem.sceneAsset.create({ data: { userId: 'u_sc_cap', name: `批量场景${i}号`, meaning: `批量沉淀的场景功能${i}` } });
    }
    const list = await jsonReq('GET', '/api/generate/scene-assets', 'u_sc_cap', 'BASIC');
    assert.strictEqual(list.status, 200);
    assert.strictEqual(list.json.total, 101, 'total 为库内全量条数');
    assert.strictEqual(list.json.assets.length, 101, 'take:200 硬帽下 101 条全部可见');
    const h = await jsonReq('GET', '/api/generate/scene-assets/health?limit=200', 'u_sc_cap', 'BASIC');
    assert.strictEqual(h.json.total, 101);
    assert.strictEqual(h.json.items.length, 101);
  });

  it('v2.163 检索：list/health q 关键词过滤（标签/氛围/名称命中，total=命中数，冲突在过滤集上跑）', async () => {
    mem._seedUser({ id: 'u_sc_q', level: 'BASIC', balance: 0 });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_q', name: '祠堂', meaning: '主线冲突爆发的舞台', mood: '压抑阴森', tags: ['权谋'] } });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_q', name: '集市', meaning: '市井信息集散地', mood: '喧闹', tags: ['市井'] } });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_q', name: 'OldManor', meaning: '家族恩怨主舞台', visualAnchor: '青砖黛瓦三进院', tags: ['Mansion'], taboo: '后期已烧毁' } });
    await mem.sceneAsset.create({ data: { userId: 'u_sc_q', name: 'OldManor', meaning: '家族恩怨主舞台', visualAnchor: '青砖黛瓦三进院' } });
    // list：标签命中
    const l1 = await jsonReq('GET', `/api/generate/scene-assets?q=${encodeURIComponent('权谋')}`, 'u_sc_q', 'BASIC');
    assert.strictEqual(l1.json.total, 1);
    assert.deepStrictEqual(l1.json.assets.map((a) => a.name), ['祠堂']);
    // health：氛围子串命中 + 名称子串命中（大小写不敏感）
    const h1 = await jsonReq('GET', `/api/generate/scene-assets/health?q=${encodeURIComponent('阴森')}`, 'u_sc_q', 'BASIC');
    assert.strictEqual(h1.json.total, 1, '氛围基调命中');
    assert.strictEqual(h1.json.items[0].name, '祠堂');
    const h2 = await jsonReq('GET', `/api/generate/scene-assets/health?q=${encodeURIComponent('oldmanor')}`, 'u_sc_q', 'BASIC');
    assert.strictEqual(h2.json.total, 2, '名称大小写不敏感命中两档 OldManor');
    assert.ok(h2.json.conflicts.some((c) => c.type === 'closed_mismatch' && c.a === 'OldManor'), '冲突只对过滤后的集合计算且会响');
    // health：外观锚点命中（v2.164 复盘补 visualAnchor 字段——搜"青砖黛瓦"类锚点词必须能命中）
    const hA = await jsonReq('GET', `/api/generate/scene-assets/health?q=${encodeURIComponent('黛瓦')}`, 'u_sc_q', 'BASIC');
    assert.strictEqual(hA.json.total, 2, 'visualAnchor 锚点子串命中两档 OldManor');
    const h3 = await jsonReq('GET', `/api/generate/scene-assets/health?q=${encodeURIComponent('集市')}`, 'u_sc_q', 'BASIC');
    assert.strictEqual(h3.json.total, 1);
    assert.deepStrictEqual(h3.json.conflicts, [], '命中范围外没有冲突预警（搜索视角自洽）');
    // 不命中 → 空；无 q → 全量（向后兼容）
    const h4 = await jsonReq('GET', `/api/generate/scene-assets/health?q=${encodeURIComponent('不存在的场')}`, 'u_sc_q', 'BASIC');
    assert.strictEqual(h4.json.total, 0);
    assert.strictEqual(h4.json.items.length, 0);
    const h5 = await jsonReq('GET', '/api/generate/scene-assets/health', 'u_sc_q', 'BASIC');
    assert.strictEqual(h5.json.total, 4, '无 q 保持全量语义');
  });
});

// v2.187 c183 复盘轮：scene 家族 batch-complete 闭环契约测试（与 cast c182 9 个 case 同构）
// 哲学：c182 只补了 cast 一族，prop/scene 是"族同构复制"，c183 复盘轮验证同构性是否成立
// 字段映射：cast voice/signatureLines/visualAnchor → scene visualAnchor/mood/tags（PATCH_FIELDS_SCENE 白名单）
// 必填非白名单字段：cast persona → scene meaning（必填、不在白名单，篡改防护关键字段）
describe('v2.187 c183 · scene batch-complete 闭环契约（族同构复制验证）', () => {
  // 测试用 helper：建一条空壳资产，dry-run 拿 patches，再带 patches 实际补全
  async function seedEmpty(uid = 'u_sc_bc') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.sceneAsset.create({ data: { userId: uid, name: '老宅祠堂', meaning: '家产争夺的主线舞台' } });
    // visualAnchor/mood/tags 全空——autoFill 与 patches 都能补这三字段
  }

  it('组合①：patches+fields 都有——fields 是 patches 子集，只补交集（其他字段不动）', async () => {
    const a = await seedEmpty();
    const id = a.id;
    // 1) dry-run 拿 patches（autoFill 算出 visualAnchor/mood/tags 三字段）
    const dr = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?dry-run=1', 'u_sc_bc', 'BASIC', { ids: [id] });
    assert.strictEqual(dr.status, 200);
    assert.strictEqual(dr.json.willUpdate.length, 1);
    const patch = dr.json.willUpdate[0].patch;
    assert.ok(patch.visualAnchor && patch.mood && patch.tags, 'dry-run patch 含三字段');
    // 2) 用户在 modal 里只勾选 visualAnchor + tags 两字段（取消 mood）
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc', 'BASIC', {
      ids: [id], patches: [{ id, patch }], fields: ['visualAnchor', 'tags'],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.deepStrictEqual(real.json.updated[0].filled.sort(), ['tags', 'visualAnchor'].sort(), '只补 fields 选中的两字段');
    // 3) mood 不在 fields 内 → 跳过（仍是空数组/空）
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor && Array.isArray(row.tags) && row.tags.length, '两字段已补：visualAnchor 非空 + tags 数组非空');
    assert.ok(!row.mood, 'mood 不在 fields 内不补');
  });

  it('组合②：patches 无 fields——全 patch 字段都补（白名单内）', async () => {
    const a = await seedEmpty('u_sc_bc2');
    const id = a.id;
    const dr = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?dry-run=1', 'u_sc_bc2', 'BASIC', { ids: [id] });
    const patch = dr.json.willUpdate[0].patch;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc2', 'BASIC', {
      ids: [id], patches: [{ id, patch }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, '没 fields 时全 patch 字段都补');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor && row.mood && row.tags.length, '三字段都已补');
  });

  it('组合③：fields 无 patches——走 autoFill 路径，按 fields 筛选 autoFill 结果', async () => {
    const a = await seedEmpty('u_sc_bc3');
    const id = a.id;
    // 不带 patches，只带 fields=['visualAnchor']：路由跑 autoFill 算三字段，但 fields 筛选后只补 visualAnchor
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc3', 'BASIC', {
      ids: [id], fields: ['visualAnchor'],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.deepStrictEqual(real.json.updated[0].filled, ['visualAnchor'], 'autoFill 算出三字段但 fields 只放行 visualAnchor');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor, 'visualAnchor 已补');
    assert.ok(!row.mood, 'mood 不在 fields 内不补');
    assert.deepStrictEqual(row.tags, [], 'tags 不在 fields 内不补');
  });

  it('组合④：patches 和 fields 都无——走 autoFill 全补（向后兼容旧路径）', async () => {
    const a = await seedEmpty('u_sc_bc4');
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc4', 'BASIC', { ids: [id] });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, 'autoFill 全补');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor && row.mood && row.tags.length, '三字段已补');
  });

  it('c181 防护①：patches 含白名单外字段（如 id/userId/meaning）→ 跳过不写库', async () => {
    const a = await seedEmpty('u_sc_bc5');
    const id = a.id;
    // 构造恶意 patches：试图改 meaning（必填字段，不在白名单）+ id + userId
    const malicious = { id, patch: { meaning: '篡改的功能', id: 'sa_hijack', userId: 'u_other', visualAnchor: '正常补' } };
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc5', 'BASIC', {
      ids: [id], patches: [malicious],
    });
    assert.strictEqual(real.status, 200);
    // visualAnchor 在白名单内 → 补；meaning/id/userId 不在白名单 → 跳过
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor, 'visualAnchor 在白名单内已补');
    assert.strictEqual(row.meaning, '家产争夺的主线舞台', 'meaning 不在白名单内不被篡改');
    assert.strictEqual(row.id, id, 'id 不被篡改');
    assert.strictEqual(row.userId, 'u_sc_bc5', 'userId 不被篡改');
  });

  it('c181 防护②：patches 值类型错（string 字段传对象 / string[] 字段传字符串）→ 跳过', async () => {
    const a = await seedEmpty('u_sc_bc6');
    const id = a.id;
    // visualAnchor 是 string 类型，传对象 → 跳过；tags 是 string[]，传字符串 → 跳过
    const badPatch = { id, patch: { visualAnchor: { hack: 1 }, tags: '非数组', mood: '正常氛围' } };
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc6', 'BASIC', {
      ids: [id], patches: [badPatch],
    });
    assert.strictEqual(real.status, 200);
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.mood, 'mood 类型正确已补');
    assert.ok(!row.visualAnchor, 'visualAnchor 类型错跳过');
    assert.deepStrictEqual(row.tags, [], 'tags 类型错跳过');
  });

  it('c181 防护③：dry-run 后编导手动改了字段，patches 旧值不覆盖（只填空格不覆盖）', async () => {
    const a = await seedEmpty('u_sc_bc7');
    const id = a.id;
    // 1) dry-run 拿 patches（含 visualAnchor 占位补全文案）
    const dr = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?dry-run=1', 'u_sc_bc7', 'BASIC', { ids: [id] });
    const patch = dr.json.willUpdate[0].patch;
    // 2) 模拟编导在 dry-run 后、实际补全前手动改了 visualAnchor 字段
    await mem.sceneAsset.update({ where: { id }, data: { visualAnchor: '我自己写的锚点' } });
    // 3) 带 patches 实际补全——patches 里的 visualAnchor 旧值不应覆盖手动修改
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc7', 'BASIC', {
      ids: [id], patches: [{ id, patch }],
    });
    assert.strictEqual(real.status, 200);
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.strictEqual(row.visualAnchor, '我自己写的锚点', '手动修改不被 patches 旧值覆盖');
    assert.ok(row.mood, '未手动改的 mood 仍补');
  });

  it('空 ids 数组 / ids 超 200 上限 → 400', async () => {
    mem._seedUser({ id: 'u_sc_bc8', level: 'BASIC', balance: 0 });
    const r1 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc8', 'BASIC', { ids: [] });
    assert.strictEqual(r1.status, 400);
    assert.strictEqual(r1.json.error, 'IDS_REQUIRED');
    const r2 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bc8', 'BASIC', { ids: Array.from({ length: 201 }, (_, i) => `id${i}`) });
    assert.strictEqual(r2.status, 400);
    assert.strictEqual(r2.json.error, 'IDS_TOO_MANY');
  });

  it('dry-run 不写库：返回 willUpdate/willSkip/fieldsUnion/total 但库里字段仍空', async () => {
    const a = await seedEmpty('u_sc_bc9');
    const id = a.id;
    const dr = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?dry-run=1', 'u_sc_bc9', 'BASIC', { ids: [id] });
    assert.strictEqual(dr.status, 200);
    assert.ok(dr.json.dryRun, '响应带 dryRun:true 标志');
    assert.strictEqual(dr.json.willUpdate.length, 1);
    assert.ok(dr.json.fieldsUnion.length >= 2, 'fieldsUnion 是补全字段的并集');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(!row.visualAnchor && !row.mood && !row.tags.length, 'dry-run 不写库');
  });
});

// v2.188 c184 防御性边界契约测试（c183 复盘轮发现的三处"防御性边界"未覆盖，与 cast c184 同构复制）
// 字段映射：cast voice/signatureLines/visualAnchor → scene visualAnchor/mood/tags（PATCH_FIELDS_SCENE 白名单）
// 必填非白名单字段：cast persona → scene meaning（必填、不在白名单，篡改防护关键字段）
describe('v2.188 c184 · scene batch-complete 防御性边界契约（族同构复制验证）', () => {
  async function seedEmpty(uid = 'u_sc_bd') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.sceneAsset.create({ data: { userId: uid, name: '老宅祠堂', meaning: '家产争夺的主线舞台' } });
    // visualAnchor/mood/tags 全空——autoFill 与 patches 都能补这三字段
  }

  it('边界①：patches 传字符串（非数组）→ Array.isArray false → 走 autoFill 路径补三字段', async () => {
    const a = await seedEmpty();
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bd', 'BASIC', {
      ids: [id], patches: 'hack',
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, '走 autoFill 路径补全三字段');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor && row.mood && row.tags.length, '三字段已补（autoFill 兜底）');
  });

  it('边界②：多 ids 部分 patches 混合——id1 走 patches 路径用 patch 值、id2 走 autoFill 路径用 autoFill 值', async () => {
    const a1 = await seedEmpty('u_sc_bd2');
    const id1 = a1.id;
    const a2 = await seedEmpty('u_sc_bd2');
    const id2 = a2.id;
    const customPatch = { visualAnchor: '[patches-path]', mood: '[patches-path]', tags: ['[patches-path]'] };
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bd2', 'BASIC', {
      ids: [id1, id2], patches: [{ id: id1, patch: customPatch }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 2, '两条资产都补');
    const r1 = await mem.sceneAsset.findUnique({ where: { id: id1 } });
    const r2 = await mem.sceneAsset.findUnique({ where: { id: id2 } });
    assert.strictEqual(r1.visualAnchor, '[patches-path]', 'id1 走 patches 路径用 patch 值');
    assert.strictEqual(r1.mood, '[patches-path]', 'id1 走 patches 路径用 patch 值');
    assert.ok(r1.tags.length && r1.tags[0] === '[patches-path]', 'id1 走 patches 路径用 patch 值');
    assert.ok(r2.visualAnchor && r2.visualAnchor !== '[patches-path]', 'id2 走 autoFill 路径用 autoFill 值');
    assert.ok(r2.mood && r2.mood !== '[patches-path]', 'id2 走 autoFill 路径用 autoFill 值');
  });

  it('边界③：patches id 不在 ids 数组里 → patches 被静默丢弃、ids 内资产走 autoFill 路径补全', async () => {
    const a1 = await seedEmpty('u_sc_bd3');
    const id1 = a1.id;
    const a2 = await seedEmpty('u_sc_bd3');
    const id2 = a2.id;
    const customPatch = { visualAnchor: '[orphan-patch]', mood: '[orphan-patch]', tags: ['[orphan-patch]'] };
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bd3', 'BASIC', {
      ids: [id1], patches: [{ id: id2, patch: customPatch }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1, '只补 ids 内的 id1');
    const r1 = await mem.sceneAsset.findUnique({ where: { id: id1 } });
    const r2 = await mem.sceneAsset.findUnique({ where: { id: id2 } });
    assert.ok(r1.visualAnchor && r1.visualAnchor !== '[orphan-patch]', 'id1 走 autoFill 路径用 autoFill 值');
    assert.ok(!r2.visualAnchor && !r2.mood && !r2.tags.length, 'id2 不在 ids 里没补（patches 被静默丢弃）');
  });
});

// v2.189 c186 防御性边界契约补强（c185 复盘轮发现的三处新遗漏，与 cast c186 同构复制）
// 字段映射：cast voice/signatureLines/visualAnchor → scene visualAnchor/mood/tags（PATCH_FIELDS_SCENE 白名单）
// 必填非白名单字段：cast persona → scene meaning（必填、不在白名单，篡改防护关键字段）
describe('v2.189 c186 · scene batch-complete 防御性边界契约补强（族同构复制验证）', () => {
  async function seedEmpty(uid = 'u_sc_bdx') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.sceneAsset.create({ data: { userId: uid, name: '老宅祠堂', meaning: '家产争夺的主线舞台' } });
    // visualAnchor/mood/tags 全空——autoFill 与 patches 都能补这三字段
  }

  it('边界①：patches 数组里某项缺 id 或 patch 不是对象 → 不合法项被 filter 过滤、合法项走 patches 路径、对应 id 走 autoFill', async () => {
    const a1 = await seedEmpty('u_sc_bdx1');
    const id1 = a1.id;
    const a2 = await seedEmpty('u_sc_bdx1');
    const id2 = a2.id;
    const customPatch = { visualAnchor: '[patches-path]', mood: '[patches-path]', tags: ['[patches-path]'] };
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bdx1', 'BASIC', {
      ids: [id1, id2],
      patches: [
        { id: id1, patch: customPatch },  // 合法项——保留
        { patch: { visualAnchor: 'x' } },   // 缺 id——过滤
        { id: id2, patch: 'not-object' },   // patch 不是对象——过滤
      ],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 2, '两条资产都补');
    const r1 = await mem.sceneAsset.findUnique({ where: { id: id1 } });
    const r2 = await mem.sceneAsset.findUnique({ where: { id: id2 } });
    assert.strictEqual(r1.visualAnchor, '[patches-path]', 'id1 走 patches 路径用 patch 值（合法项保留）');
    assert.ok(r2.visualAnchor && r2.visualAnchor !== '[patches-path]', 'id2 走 autoFill 路径用 autoFill 值（不合法项被过滤后无 patch 可用）');
  });

  it('边界②：patches 是空数组 [] → Array.isArray true、patchesMap 空映射、所有 id 走 autoFill', async () => {
    const a = await seedEmpty('u_sc_bdx2');
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bdx2', 'BASIC', {
      ids: [id], patches: [],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, '走 autoFill 路径补全三字段');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor && row.mood && row.tags.length, '三字段已补（patches 空数组 → patchesMap 空 → autoFill 兜底）');
  });

  it('边界③：ids 里有 null/undefined/非字符串 → filter 过滤掉、只剩合法 id 走补全路径；全非字符串 → 400', async () => {
    const a = await seedEmpty('u_sc_bdx3');
    const id1 = a.id;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bdx3', 'BASIC', {
      ids: [id1, null, undefined, 123],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1, 'filter 过滤掉 null/undefined/123 后只剩 id1');
    const r1 = await mem.sceneAsset.findUnique({ where: { id: id1 } });
    assert.ok(r1.visualAnchor && r1.mood && r1.tags.length, 'id1 三字段已补（autoFill 兜底）');
    const bad = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_sc_bdx3', 'BASIC', {
      ids: [null, undefined, 123],
    });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.json.error, 'IDS_REQUIRED', '全非字符串 filter 后空数组 → 400');
  });
});

// v2.190 c188 防御性边界第二轮补强（族同构复制 cast/prop；c187 复盘五处遗漏 + 断言分离/类型陷阱锁定铁律驱动）
describe('v2.190 c188 · scene batch-complete 防御性边界第二轮补强（c187 五处遗漏）', () => {
  async function seedEmpty(uid = 'u_c188_s') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.sceneAsset.create({ data: { userId: uid, name: '老宅祠堂', meaning: '家产争夺的主线舞台' } });
  }

  it('遗漏①：fields 是空数组 [] → 空数组 truthy 走筛选路径、循环零执行 → skipped（不是全选也不是 400）', async () => {
    const a = await seedEmpty('u_c188_s1');
    const id = a.id;
    const customPatch = { visualAnchor: '[f-empty]', mood: '[f-empty]', tags: ['[f-empty]'] };
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c188_s1', 'BASIC', {
      ids: [id], patches: [{ id, patch: customPatch }], fields: [],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 0, 'fields=[] → for 循环零执行 → 零字段补全');
    assert.strictEqual(real.json.skipped.length, 1, '进入 skipped（路由行 1111 中文 reason）');
    assert.strictEqual(real.json.skipped[0].id, id);
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(!row.visualAnchor && !row.mood && !row.tags.length, '库里三字段仍空（零写入）');
    // 失效推演：若路由把 fieldsFilter ? 收紧为 fieldsFilter?.length ?（空数组改走 Object.keys(patch)）→ updated=1、三字段落库 → 本断言全红 ✓
  });

  it('遗漏①补：fields 非数组（字符串）→ Array.isArray false → null → 默认全选；fields 含非字符串 → filter 剔除后只补合法字段', async () => {
    // 段 A：fields 传字符串 'visualAnchor'（客户端误传）——Array.isArray === false → fieldsFilter=null → 全补 patch 三字段
    const aA = await seedEmpty('u_c188_s2a');
    const idA = aA.id;
    const patchA = { visualAnchor: '[non-arr]', mood: '[non-arr]', tags: ['[non-arr]'] };
    const rA = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c188_s2a', 'BASIC', {
      ids: [idA], patches: [{ id: idA, patch: patchA }], fields: 'visualAnchor',
    });
    assert.strictEqual(rA.status, 200);
    assert.strictEqual(rA.json.updated.length, 1, '非数组 fields 不报错、走默认全选');
    const rowA = await mem.sceneAsset.findUnique({ where: { id: idA } });
    assert.ok(rowA.visualAnchor && rowA.mood && rowA.tags.length, '三字段全补（fieldsFilter=null 不筛选）');
    // 失效推演：若路由误把字符串当数组迭代（逐字符）→ 白名单无一命中 → skipped → updated=0，本断言红 ✓
    // 段 B：fields=['visualAnchor',123,null]——非字符串被 filter 剔除，只剩 visualAnchor
    const aB = await seedEmpty('u_c188_s2b');
    const idB = aB.id;
    const patchB = { visualAnchor: '[mix-elem]', mood: '[mix-elem]', tags: ['[mix-elem]'] };
    const rB = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c188_s2b', 'BASIC', {
      ids: [idB], patches: [{ id: idB, patch: patchB }], fields: ['visualAnchor', 123, null],
    });
    assert.strictEqual(rB.status, 200);
    assert.deepStrictEqual(rB.json.updated[0].filled, ['visualAnchor'], '非字符串项剔除后只补 visualAnchor');
    const rowB = await mem.sceneAsset.findUnique({ where: { id: idB } });
    assert.strictEqual(rowB.visualAnchor, '[mix-elem]');
    assert.ok(!rowB.mood && !rowB.tags.length, '另外两字段不补');
    // 无害性标注（c187 断言分离铁律）：若非字符串 filter 失效，123/null 进入循环后 `f in patch` 为 false 必 continue，
    // 结果与过滤后相同——漏过滤亦无害（in 检查 + 白名单双重拦截）；本 case 价值是锁定当前行为的活文档。
  });

  it('遗漏②：patch 是数组 [] → typeof [] === "object" 且 truthy 能过 input filter → Object.keys([])=[] 空转 → skipped', async () => {
    const a = await seedEmpty('u_c188_s3');
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c188_s3', 'BASIC', {
      ids: [id], patches: [{ id, patch: [] }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 0, '数组 patch 过 filter 但零键可补 → 不写库');
    assert.strictEqual(real.json.skipped.length, 1);
    assert.strictEqual(real.json.skipped[0].id, id);
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(!row.visualAnchor && !row.mood && !row.tags.length, '库里三字段仍空');
    // 失效推演（行为锁定型）：若未来 input filter 收紧加 !Array.isArray(x.patch) → 该项被过滤 → autoFill 全补 → updated=1 → 本断言红。
  });

  it('遗漏⑤：patch 是 null → typeof null === "object" 陷阱，靠 x.patch && truthy 短路拦截 → 该项过滤、id 走 autoFill', async () => {
    const a = await seedEmpty('u_c188_s4');
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c188_s4', 'BASIC', {
      ids: [id], patches: [{ id, patch: null }],
    });
    assert.strictEqual(real.status, 200, 'null patch 被过滤后走 autoFill 正常补全，不抛错');
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, 'autoFill 补全三字段');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor && row.mood && row.tags.length, '三字段已补（autoFill 兜底）');
    // 失效推演：若误删 x.patch && 只留 typeof === 'object'（null 通过）→ Object.keys(null) 抛 TypeError → 500，本断言 status===200 变红 ✓
  });

  it('遗漏③：tags 传"数组但含非字符串元素" → 行 1104 every 第三层校验拦截该字段，同 patch 其他字段照补', async () => {
    const a = await seedEmpty('u_c188_s5');
    const id = a.id;
    // c181 防护②只测了行 1102/1103 两层，行 1104 every 元素校验 0 覆盖——本 case 补
    const badElemPatch = { tags: ['合法标签', 123, null], visualAnchor: '[elem-ok]', mood: '[elem-ok]' };
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c188_s5', 'BASIC', {
      ids: [id], patches: [{ id, patch: badElemPatch }],
    });
    assert.strictEqual(real.status, 200);
    assert.deepStrictEqual(real.json.updated[0].filled.sort(), ['mood', 'visualAnchor'].sort(), '元素类型错只跳过 tags 一个字段');
    const row = await mem.sceneAsset.findUnique({ where: { id } });
    assert.strictEqual(row.visualAnchor, '[elem-ok]');
    assert.strictEqual(row.mood, '[elem-ok]');
    assert.deepStrictEqual(row.tags, [], '污染数组整体不落库（不是截断、不是部分写入）');
    // 失效推演：若删掉行 1104 every 校验 → ['合法标签',123,null] 整体写入 → tags.length===3 → 本断言红 ✓
  });

  it('遗漏④：ids 混他人资产 id → findMany 的 userId 归属隔离：只补本人、他人资产不动、200 不报错、响应不泄露他人 id', async () => {
    const own = await seedEmpty('u_c188_s6');
    const ownId = own.id;
    mem._seedUser({ id: 'u_c188_s6_other', level: 'BASIC', balance: 0 });
    const other = await mem.sceneAsset.create({ data: { userId: 'u_c188_s6_other', name: '他人祠堂', meaning: '他人的主线舞台' } });
    const otherId = other.id;
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c188_s6', 'BASIC', {
      ids: [ownId, otherId],
    });
    assert.strictEqual(real.status, 200, '混入他人 id 不报错（静默隔离，不泄露存在性）');
    assert.strictEqual(real.json.total, 1, 'rows 只含本人命中的 1 条');
    assert.strictEqual(real.json.updated.length, 1);
    assert.strictEqual(real.json.updated[0].id, ownId, '补的是本人资产');
    assert.ok(!real.json.skipped.some((s) => s.id === otherId), 'skipped 也不含他人 id（不泄露存在性）');
    const otherRow = await mem.sceneAsset.findUnique({ where: { id: otherId } });
    assert.ok(!otherRow.visualAnchor && !otherRow.mood && !otherRow.tags.length, '他人资产三字段保持空（零写入）');
    // 失效推演：若 findMany 去掉 userId 条件 → rows 含 2 条 → total=2、updated 含 otherId、他人资产被补 → 三处断言全红 ✓
  });
});

// v2.190 c190 值域防线 + P3 留白强制处置（族同构复制 cast/prop；c189 复盘四元组 BUG-1/BUG-2 驱动）
describe('v2.190 c190 · scene batch-complete 值域防线（空/长/量）+ P3 入口处置 + 白名单显式 fields', () => {
  async function seedEmpty(uid) {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.sceneAsset.create({ data: { userId: uid, name: '老宅祠堂', meaning: '家产争夺的主线舞台' } });
  }

  it('BUG-1：空串/全空白 string、空数组/全空白元素数组不落库且不谎报，同 patch 合法字段照补；dry-run 同步不谎报', async () => {
    // 段 A：两 string 字段一空串一全空白 + 合法数组 → 只补 tags（部分成功）
    const aA = await seedEmpty('u_c190_sb1a');
    const rA = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb1a', 'BASIC', {
      ids: [aA.id], patches: [{ id: aA.id, patch: { visualAnchor: '', mood: '   ', tags: ['[b1-ok]'] } }],
    });
    assert.strictEqual(rA.status, 200);
    assert.deepStrictEqual(rA.json.updated[0].filled, ['tags'], '空值两字段不进 filled（旧代码谎报三字段全补）');
    const rowA = await mem.sceneAsset.findUnique({ where: { id: aA.id } });
    assert.ok(!rowA.visualAnchor && !rowA.mood, '空串/全空白不落库');
    assert.deepStrictEqual(rowA.tags, ['[b1-ok]']);
    // 段 B1：空数组 []（vacuous truth 旧代码放行）
    const aB1 = await seedEmpty('u_c190_sb1b');
    const rB1 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb1b', 'BASIC', {
      ids: [aB1.id], patches: [{ id: aB1.id, patch: { visualAnchor: '[b1-b]', tags: [] } }],
    });
    assert.deepStrictEqual(rB1.json.updated[0].filled, ['visualAnchor']);
    assert.deepStrictEqual((await mem.sceneAsset.findUnique({ where: { id: aB1.id } })).tags, [], '空数组不占位');
    // 段 B2：数组元素全空白
    const aB2 = await seedEmpty('u_c190_sb1c');
    const rB2 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb1c', 'BASIC', {
      ids: [aB2.id], patches: [{ id: aB2.id, patch: { visualAnchor: '[b1-c]', tags: ['', '   '] } }],
    });
    assert.deepStrictEqual(rB2.json.updated[0].filled, ['visualAnchor'], '全空白元素清洗后为空 → 字段跳过');
    assert.deepStrictEqual((await mem.sceneAsset.findUnique({ where: { id: aB2.id } })).tags, []);
    // 段 C：dry-run 不谎报 + 零写库
    const aC = await seedEmpty('u_c190_sb1d');
    const rC = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?dry-run=1', 'u_c190_sb1d', 'BASIC', {
      ids: [aC.id], patches: [{ id: aC.id, patch: { mood: '   ', tags: ['[b1-d]'] } }],
    });
    assert.strictEqual(rC.json.dryRun, true);
    assert.deepStrictEqual(rC.json.willUpdate[0].fields, ['tags']);
    assert.deepStrictEqual(rC.json.fieldsUnion, ['tags'], 'fieldsUnion 不谎报 mood');
    const rowC = await mem.sceneAsset.findUnique({ where: { id: aC.id } });
    assert.ok(!rowC.mood && !rowC.tags.length, 'dry-run 零写库');
  });

  it('BUG-2：超上限 string（visualAnchor 200 / mood 100）/超量数组/超长元素静默跳过且不误伤贴线值，合规字段照补', async () => {
    // 段 A：visualAnchor 201 字 + mood 101 字（两族上限同时越界）+ 合法 tags
    const aA = await seedEmpty('u_c190_sb2a');
    const rA = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb2a', 'BASIC', {
      ids: [aA.id], patches: [{ id: aA.id, patch: { visualAnchor: '景'.repeat(201), mood: '氛'.repeat(101), tags: ['[b2-ok]'] } }],
    });
    assert.deepStrictEqual(rA.json.updated[0].filled, ['tags'], '201/101 字双字段跳过');
    const rowA = await mem.sceneAsset.findUnique({ where: { id: aA.id } });
    assert.ok(!rowA.visualAnchor && !rowA.mood, '超长值不落库');
    // 段 B：mood 贴线 100 字接受（本族独有上限，防与 200 混淆抄错）
    const aB = await seedEmpty('u_c190_sb2b');
    const rB = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb2b', 'BASIC', {
      ids: [aB.id], patches: [{ id: aB.id, patch: { mood: '氛'.repeat(100) } }],
    });
    assert.deepStrictEqual(rB.json.updated[0].filled, ['mood']);
    assert.strictEqual((await mem.sceneAsset.findUnique({ where: { id: aB.id } })).mood.length, 100, 'mood 贴线 100 接受');
    // 段 C1：tags 9 条（上限 8）
    const aC1 = await seedEmpty('u_c190_sb2c');
    const rC1 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb2c', 'BASIC', {
      ids: [aC1.id], patches: [{ id: aC1.id, patch: { visualAnchor: '[b2-c]', tags: Array(9).fill('短签') } }],
    });
    assert.deepStrictEqual(rC1.json.updated[0].filled, ['visualAnchor'], '超量数组整字段跳过（不是截断成 8 条）');
    assert.deepStrictEqual((await mem.sceneAsset.findUnique({ where: { id: aC1.id } })).tags, []);
    // 段 C2：元素 21 字（上限 20）
    const aC2 = await seedEmpty('u_c190_sb2d');
    const rC2 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb2d', 'BASIC', {
      ids: [aC2.id], patches: [{ id: aC2.id, patch: { visualAnchor: '[b2-d]', tags: ['标'.repeat(21)] } }],
    });
    assert.deepStrictEqual(rC2.json.updated[0].filled, ['visualAnchor'], '超长元素整字段跳过');
    // 段 D：贴线 8 条 × 20 字接受
    const aD = await seedEmpty('u_c190_sb2e');
    const rD = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sb2e', 'BASIC', {
      ids: [aD.id], patches: [{ id: aD.id, patch: { tags: Array(8).fill('签'.repeat(20)) } }],
    });
    const rowD = await mem.sceneAsset.findUnique({ where: { id: aD.id } });
    assert.strictEqual(rowD.tags.length, 8, '贴线条数接受');
    assert.strictEqual(rowD.tags[0].length, 20, '贴线元素长度接受');
  });

  it('P3 六项强制处置（c188 表连续两轮，c189 P3 时效铁律：逐项补测锁定）', async () => {
    // 项1 ids 含空字符串 → 查无此行，只补真实 id
    const a1 = await seedEmpty('u_c190_sp31');
    const r1 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sp31', 'BASIC', {
      ids: ['', a1.id], patches: [{ id: a1.id, patch: { visualAnchor: '[p31]' } }],
    });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.total, 1);
    assert.strictEqual(r1.json.updated.length, 1);
    // 项2 ids 重复 → findMany 去重，一次更新
    const a2 = await seedEmpty('u_c190_sp32');
    const r2 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sp32', 'BASIC', {
      ids: [a2.id, a2.id], patches: [{ id: a2.id, patch: { visualAnchor: '[p32]' } }],
    });
    assert.strictEqual(r2.json.total, 1);
    assert.strictEqual(r2.json.updated.length, 1, '重复 id 不产生重复更新');
    // 项3 patches 同 id 重复 → Map 后者覆盖
    const a3 = await seedEmpty('u_c190_sp33');
    const r3 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sp33', 'BASIC', {
      ids: [a3.id], patches: [{ id: a3.id, patch: { visualAnchor: '[first]' } }, { id: a3.id, patch: { visualAnchor: '[second]' } }],
    });
    assert.strictEqual((await mem.sceneAsset.findUnique({ where: { id: a3.id } })).visualAnchor, '[second]', 'Map 后者覆盖语义锁定');
    // 项4 lang=fr 中文兜底 / lang=en 英文 reason（fields=[] 稳定触发 skip）
    const a4a = await seedEmpty('u_c190_sp34a');
    const r4a = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?lang=fr', 'u_c190_sp34a', 'BASIC', {
      ids: [a4a.id], patches: [{ id: a4a.id, patch: { visualAnchor: '[x]' } }], fields: [],
    });
    assert.ok(r4a.json.skipped[0].reason.includes('选中字段'), 'lang=fr 按中文兜底');
    const a4b = await seedEmpty('u_c190_sp34b');
    const r4b = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?lang=en', 'u_c190_sp34b', 'BASIC', {
      ids: [a4b.id], patches: [{ id: a4b.id, patch: { visualAnchor: '[x]' } }], fields: [],
    });
    assert.ok(r4b.json.skipped[0].reason.includes('Selected fields'), 'lang=en 英文 reason');
    // 项5 ?dry-run=0 实际写库
    const a5 = await seedEmpty('u_c190_sp35');
    const r5 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete?dry-run=0', 'u_c190_sp35', 'BASIC', {
      ids: [a5.id], patches: [{ id: a5.id, patch: { visualAnchor: '[p35]' } }],
    });
    assert.strictEqual(r5.json.dryRun, undefined, 'dry-run=0 不是预检');
    assert.strictEqual((await mem.sceneAsset.findUnique({ where: { id: a5.id } })).visualAnchor, '[p35]', '实际写库');
    // 项6 无 body → 400 IDS_REQUIRED
    const r6 = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sp31', 'BASIC', undefined);
    assert.strictEqual(r6.status, 400);
    assert.strictEqual(r6.json.error, 'IDS_REQUIRED');
  });

  it('遗漏⑥：fields 显式选中白名单外字段（meaning）→ 白名单第二道防线拦截、库值不被篡改，合法字段照补', async () => {
    const a = await seedEmpty('u_c190_sf6');
    const real = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c190_sf6', 'BASIC', {
      ids: [a.id],
      fields: ['meaning', 'visualAnchor'],
      patches: [{ id: a.id, patch: { meaning: '[hack-篡建档核心字段]', visualAnchor: '[f6-ok]' } }],
    });
    assert.strictEqual(real.status, 200);
    assert.deepStrictEqual(real.json.updated[0].filled, ['visualAnchor'], 'meaning 不在 patches 白名单，fields 显式选中也拒');
    const row = await mem.sceneAsset.findUnique({ where: { id: a.id } });
    assert.strictEqual(row.meaning, '家产争夺的主线舞台', '越界字段零写入');
    assert.strictEqual(row.visualAnchor, '[f6-ok]');
  });
});

// v2.191 c191 复盘：遗漏⑦ autoFill 旧路径 fields 畸形（与 cast/prop 同族同构，第3次进表补测锁定）
describe('v2.191 c191 · scene batch-complete autoFill 旧路径 fields 畸形', () => {
  async function seedEmpty(uid) {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.sceneAsset.create({ data: { userId: uid, name: '老宅祠堂', meaning: '家产争夺的主线舞台' } });
  }

  it('遗漏⑦：不带 patches 走 autoFill 时 fields 四变体——单选/空数组/含非字符串/非数组全选', async () => {
    // 段A 单选 mood
    const aA = await seedEmpty('u_c191_sf7a');
    const rA = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c191_sf7a', 'BASIC', {
      ids: [aA.id], fields: ['mood'],
    });
    assert.strictEqual(rA.status, 200);
    assert.deepStrictEqual(rA.json.updated[0].filled, ['mood']);
    const rowA = await mem.sceneAsset.findUnique({ where: { id: aA.id } });
    assert.ok(rowA.mood && !rowA.visualAnchor && !rowA.tags.length, '只补选中字段');
    // 段B fields=[] → 零选中 skip
    const aB = await seedEmpty('u_c191_sf7b');
    const rB = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c191_sf7b', 'BASIC', {
      ids: [aB.id], fields: [],
    });
    assert.strictEqual(rB.json.updated.length, 0);
    assert.ok(rB.json.skipped[0].reason.includes('选中字段'));
    // 段C 含非字符串元素 → 过滤后只补 visualAnchor
    const aC = await seedEmpty('u_c191_sf7c');
    const rC = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c191_sf7c', 'BASIC', {
      ids: [aC.id], fields: [123, 'visualAnchor', null],
    });
    assert.deepStrictEqual(rC.json.updated[0].filled, ['visualAnchor']);
    const rowC = await mem.sceneAsset.findUnique({ where: { id: aC.id } });
    assert.ok(rowC.visualAnchor && !rowC.mood, '非字符串元素静默过滤');
    // 段D 非数组 → 兜底全选三字段
    const aD = await seedEmpty('u_c191_sf7d');
    const rD = await jsonReq('POST', '/api/generate/scene-assets/batch-complete', 'u_c191_sf7d', 'BASIC', {
      ids: [aD.id], fields: 'mood',
    });
    assert.deepStrictEqual([...rD.json.updated[0].filled].sort(), ['mood', 'tags', 'visualAnchor'], '非数组兜底全选（宽容默认，不 400）');
  });
});
