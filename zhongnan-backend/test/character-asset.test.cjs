const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'ca-secret';
process.env.JWT_REFRESH_SECRET = 'ca-refresh';
const { buildCastAssetDirective, extractCastAssetDrafts } = require('../dist/engine/character-asset.js');
const { scoreCastAsset, detectCastAssetConflicts } = require('../dist/engine/asset-health.js');
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
describe('角色资产引擎·指令构建 buildCastAssetDirective', () => {
  it('空/无效资产返回空串（不注入）', () => {
    assert.strictEqual(buildCastAssetDirective([]), '');
    assert.strictEqual(buildCastAssetDirective(null), '');
    assert.strictEqual(buildCastAssetDirective([{ name: '', persona: 'x' }, { name: 'A' }]), '');
  });

  it('中文指令：头部+资产块（多字段拼装）+五条强约束规则；标志性台词截 3 条', () => {
    const d = buildCastAssetDirective([{
      name: '林昭', persona: '外冷内热的刑警，欲望是为父翻案', voice: '短句多，口头禅"查下去"',
      signatureLines: ['案子不会说谎，人才会。', '第二句', '第三句', '第四句会被截断'],
      visualAnchor: '左眉一道疤', voicePrintDigest: { signature: '短句/疑问/嗯' },
    }]);
    assert.ok(d.includes('【角色资产强约束】'));
    assert.ok(d.includes('1. 「林昭」'));
    assert.ok(d.includes('人设内核：外冷内热的刑警'));
    assert.ok(d.includes('声音特质：短句多'));
    assert.ok(d.includes('视觉锚点：左眉一道疤'));
    assert.ok(d.includes('标志性台词（仅气质锚）：案子不会说谎，人才会。 / 第二句 / 第三句'));
    assert.ok(!d.includes('第四句会被截断'), '标志性台词最多 3 条');
    assert.ok(d.includes('声纹指纹：短句/疑问/嗯'));
    for (const marker of ['跨剧可辨识', '欲望链', '人物卡', '逐字照搬', '气质不得混用']) {
      assert.ok(d.includes(marker), `五条强约束必须含：${marker}`);
    }
  });

  it('英文指令与超上限截断（最多 10 个资产）', () => {
    const assets = Array.from({ length: 12 }, (_, i) => ({ name: `C${i + 1}`, persona: `p${i + 1}` }));
    const d = buildCastAssetDirective(assets, 'en');
    assert.ok(d.includes('[CHARACTER ASSET CONSTRAINTS]'));
    assert.ok(d.includes('persona: p10'));
    assert.ok(!d.includes('persona: p11'), '最多 10 个资产');
    assert.ok(d.includes('MUST stay recognizable') && d.includes('never copy signature lines verbatim'));
  });
});

describe('角色资产引擎·沉淀提取 extractCastAssetDrafts', () => {
  const UNIT_SCRIPT = [
    '△雨夜老巷，路灯忽明忽暗。',
    '林昭（低声）：查。',
    '林昭：这案子不会说谎，人才会说谎。你觉得呢？',
    '林昭：嗯，明天提审。',
    '林昭：冷不冷都得走完这一趟。',
    '陈默：你不该回来的吧？',
    '陈默：走吧，这条路没有回头路可走，你我都一样，谁先动谁先死。',
    '△两人擦肩而过。',
  ].join('\n');

  it('空圣经返回空；三项全空的角色跳过', () => {
    assert.deepStrictEqual(extractCastAssetDrafts(null, null), []);
    assert.deepStrictEqual(extractCastAssetDrafts({}, ''), []);
    const drafts = extractCastAssetDrafts({ '林昭': { traits: '', arc: '', voice: '' }, '陈默': { traits: '谨慎' } }, null);
    assert.strictEqual(drafts.length, 1);
    assert.strictEqual(drafts[0].name, '陈默');
  });

  it('人设拼装+声纹重算（≥2句）+标志性台词取最长句', () => {
    const drafts = extractCastAssetDrafts({ '林昭': { traits: '外冷内热', arc: '为父翻案', voice: '短句' }, '陈默': { traits: '谨慎', voice: '试探反问' } }, UNIT_SCRIPT);
    const lin = drafts.find((d) => d.name === '林昭');
    assert.ok(lin);
    assert.ok(lin.persona.includes('外冷内热') && lin.persona.includes('弧光：为父翻案'));
    assert.strictEqual(lin.voice, '短句');
    assert.ok(lin.voicePrint && lin.lineCount >= 4, '林昭 4 句对白必有声纹');
    assert.ok(Array.isArray(lin.voicePrint.topParticles));
    assert.strictEqual(lin.signatureLines[0], '这案子不会说谎，人才会说谎。你觉得呢？', '标志性台词=该角色最长一句');
    const chen = drafts.find((d) => d.name === '陈默');
    assert.ok(chen && chen.voicePrint && chen.lineCount >= 2);
    assert.ok(drafts[0].name === '林昭', '按对白样本量降序：主要角色在前');
  });

  it('成稿过短（<100字）不落声纹；无成稿时声纹为 null 且最多 5 个草稿', () => {
    const chars = {}; for (let i = 1; i <= 7; i++) chars[`角色${i}号`] = { traits: `性格${i}` };
    const drafts = extractCastAssetDrafts(chars, null);
    assert.strictEqual(drafts.length, 5, '单次沉淀最多 5 个角色');
    drafts.forEach((d) => assert.strictEqual(d.voicePrint, null));
    const d2 = extractCastAssetDrafts({ '林昭': { traits: 'x' }, '陈默': { traits: 'y' } }, '林昭：好。\n陈默：走。');
    assert.strictEqual(d2.length, 2);
    d2.forEach((d) => assert.strictEqual(d.voicePrint, null, '成稿不足 100 字不落声纹'));
  });

  it('c157 复盘修复：键名 trim 归一——带空白键沉淀出干净名、纯空白键不入档', () => {
    const drafts = extractCastAssetDrafts({ '  林昭  ': { traits: '外冷内热' }, '   ': { traits: '纯空白键' }, '陈默': { voice: '短句' } }, null);
    assert.strictEqual(drafts.length, 2, '纯空白键剔除，带空白键归一');
    assert.ok(drafts.some((d) => d.name === '林昭'), 'trim 后与手动 upsert 的 schema trim 口径一致，不建孤儿档');
    assert.ok(drafts.every((d) => d.name === d.name.trim() && d.name.length > 0), '所有草稿名干净非空');
  });

  // v2.191 c191 复盘 PX-1（缺陷捕获型）：bible.characters 经 pipeline LLM 裸 JSON 落库（无 zod 约束），
  // traits/arc/voice 形态不可控——非字符串值裸 .trim() 会 TypeError，一个畸形角色毒丸整批沉淀。
  // 防线名：沉淀入口字段类型壳（与 v2.160 signatureLines Json 污染防御同口径）
  it('c191 PX-1：traits/arc/voice 为非字符串（number/boolean/object/array）时不抛错，畸形字段视同缺失且不拖垮同批合法角色', () => {
    // 段A 全畸形角色：三项全非字符串 → 视同三项全空 → 该角色跳过
    const poisoned = {
      '毒丸甲': { traits: 123, arc: { x: 1 }, voice: true },
      '毒丸乙': { traits: ['外冷内热'], arc: null, voice: 999 },
    };
    let drafts;
    assert.doesNotThrow(() => { drafts = extractCastAssetDrafts(poisoned, null); }, '畸形 Json 不得抛 TypeError');
    assert.strictEqual(drafts.length, 0, '三项全畸形 → 无资产价值跳过（不产出坏草稿）');
    // 段B 毒丸隔离：畸形角色与合法角色同批，合法角色照常产出
    const mixed = {
      '毒丸': { traits: 123, arc: true, voice: ['短句'] },
      '陈默': { traits: '谨慎多疑', voice: '试探反问' },
    };
    let drafts2;
    assert.doesNotThrow(() => { drafts2 = extractCastAssetDrafts(mixed, null); });
    assert.strictEqual(drafts2.length, 1, '毒丸不拖垮同批合法角色');
    assert.strictEqual(drafts2[0].name, '陈默');
    assert.ok(drafts2[0].persona.includes('谨慎多疑'));
    assert.strictEqual(drafts2[0].voice, '试探反问');
    // 段C 部分畸形：voice 合法、traits 畸形 → 仍凭合法字段沉淀（voice 一手源保留，traits 视同空）
    const partial = { '阿紫': { traits: 42, arc: '', voice: '句句上扬带尾音' } };
    const drafts3 = extractCastAssetDrafts(partial, null);
    assert.strictEqual(drafts3.length, 1);
    assert.strictEqual(drafts3[0].voice, '句句上扬带尾音');
    assert.ok(!drafts3[0].persona.includes('42'), 'number 不得被字符串化混进 persona');
  });
});

// —— v2.160 复盘补课：prop 家族三检测器各有"会响"测试，character 家族此前 0 覆盖（c153 教训：没验过"会响"的检测器等于没测）——
describe('角色资产引擎·冲突预警 detectCastAssetConflicts', () => {
  it('dup_name 会响：同名不同人设；same_persona 会响：异名同人设（norm 口径）', () => {
    const out = detectCastAssetConflicts([
      { name: '林昭', persona: '外冷内热的刑警人设内核' },
      { name: '林昭', persona: '纨绔子弟浪荡不羁的少爷人设' },
      { name: '乙', persona: '谨慎多疑步步为营的谋士人设内核' },
      { name: '丙', persona: '谨慎 多疑 步步为营的谋士人设内核' }, // 仅差空白：norm 后同人设
    ]);
    const dup = out.find((c) => c.type === 'dup_name');
    assert.ok(dup, '同名不同人设必须报 dup_name');
    assert.strictEqual(dup.a, '林昭');
    const sp = out.find((c) => c.type === 'same_persona');
    assert.ok(sp, '异名 norm 同人设必须报 same_persona');
    assert.strictEqual(sp.a, '乙'); assert.strictEqual(sp.b, '丙');
  });

  it('v2.160 口径统一：同名人设仅差空白不再误报 dup_name（与 same_persona 的 norm 口径一致，prop 家族同构）', () => {
    const out = detectCastAssetConflicts([
      { name: '林昭', persona: '外冷内热的刑警人设内核' },
      { name: '林昭', persona: '外冷内热的 刑警人设内核' }, // 仅差中间空白
    ]);
    assert.strictEqual(out.filter((c) => c.type === 'dup_name').length, 0, '空白差异视作同一人设，不误报同名冲突');
    assert.strictEqual(out.length, 0);
  });

  it('clash_print 会响：声纹指纹一致但人设不同；空/无效输入返回空', () => {
    const out = detectCastAssetConflicts([
      { name: '林昭', persona: '外冷内热的刑警人设内核', voicePrint: { signature: '短句/疑问/嗯' } },
      { name: '陈默', persona: '谨慎多疑的谋士人设内核', voicePrintDigest: { signature: '短句/疑问/嗯' } }, // 双命名兼容
    ]);
    const clash = out.find((c) => c.type === 'clash_print');
    assert.ok(clash, '声纹一致但人设不同必须报 clash_print（换剧串戏源）');
    assert.deepStrictEqual(detectCastAssetConflicts([]), []);
    assert.deepStrictEqual(detectCastAssetConflicts(null), []);
    assert.deepStrictEqual(detectCastAssetConflicts([{ name: '', persona: 'x' }, { name: 'A', persona: '' }]), []);
  });

  it('scoreCastAsset 对 signatureLines 污染成字符串不崩（Json 字段防御，v2.160）', () => {
    const h = scoreCastAsset({ name: '林昭', persona: '外冷内热的刑警人设内核', signatureLines: '被污染的字符串' });
    assert.strictEqual(typeof h.score, 'number', '字符串污染不再 TypeError');
    assert.ok(h.missing.includes('signatureLines'), '污染字段按缺失计');
  });
});

// —— HTTP 闭环（串行）——
describe('角色资产 HTTP 闭环（串行）', { concurrency: 1 }, () => {
  let projIdFromRef = null; // 用例2立项返回的项目 id，供用例3生成注入复用
  it('手动建档+非法参数400+按id编辑+列表归属隔离+删除防越权+未登录401', async () => {
    mem._seedUser({ id: 'u_ca_a', level: 'BASIC', balance: 5000 });
    mem._seedUser({ id: 'u_ca_b', level: 'BASIC', balance: 5000 });
    const r1 = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_a', 'BASIC', { name: '林昭', persona: '外冷内热刑警', voice: '短句' });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.updated, false);
    assert.strictEqual(r1.json.asset.usedCount, 0);
    const bad = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_a', 'BASIC', { name: '', persona: '' });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.json.field, 'name');
    const r2 = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_a', 'BASIC', { id: r1.json.asset.id, name: '林昭', persona: '升级版人设' });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.updated, true, '按 id 更新本人记录');
    assert.strictEqual(r2.json.asset.persona, '升级版人设');
    assert.strictEqual(mem._characterAssets.length, 1, '编辑不新建行');
    const listA = await jsonReq('GET', '/api/generate/character-assets', 'u_ca_a', 'BASIC');
    assert.strictEqual(listA.json.assets.length, 1);
    const listB = await jsonReq('GET', '/api/generate/character-assets', 'u_ca_b', 'BASIC');
    assert.strictEqual(listB.json.assets.length, 0, '归属隔离');
    const delOther = await jsonReq('DELETE', `/api/generate/character-assets/${r1.json.asset.id}`, 'u_ca_b', 'BASIC');
    assert.strictEqual(delOther.status, 404, '删他人资产防越权探测');
    const anon = await fetch(base + '/api/generate/character-assets');
    assert.strictEqual(anon.status, 401);
  });

  it('立项引用：非法/他人 id 静默丢弃，本人资产快照进 bible.castAssets 且 usedCount+1', async () => {
    const own = mem._characterAssets.find((x) => x.name === '林昭');
    const other = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_b', 'BASIC', { name: '陈默', persona: 'B用户的资产' });
    assert.strictEqual(other.status, 200);
    const proj = await jsonReq('POST', '/api/generate/projects', 'u_ca_a', 'BASIC', {
      title: '旧案重演', mode: 'tags',
      castAssetIds: [own.id, other.json.asset.id, 'ca_fake_not_exist'],
    });
    assert.strictEqual(proj.status, 200);
    projIdFromRef = proj.json.id;
    const snap = proj.json.bible?.castAssets;
    assert.ok(Array.isArray(snap) && snap.length === 1, '他人/不存在 id 静默丢弃，仅剩本人资产');
    assert.strictEqual(snap[0].name, '林昭');
    assert.strictEqual(snap[0].persona, '升级版人设');
    assert.strictEqual(mem._characterAssets.find((x) => x.id === own.id).usedCount, 1, '引用计数+1');
  });

  it('生成注入：架构师/人设师/撰写师 prompt 均含角色资产强约束与资产名', async () => {
    assert.ok(projIdFromRef, '上一用例已建项目');
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await callEpisode('u_ca_a', 'BASIC', { projectId: projIdFromRef, brief: '刑警林昭重启尘封旧案，发现真凶就在身边。' });
      assert.strictEqual(r.status, 200);
      assert.ok(r.events.some((e) => e.stage === 'done'), '必须跑到 done');
      const promptOf = (role) => captured.filter((c) => c.role === role).map((c) => c.prompt).join('\n');
      for (const role of ['architect', 'designer', 'writer']) {
        const p = promptOf(role);
        assert.ok(p.includes('角色资产强约束'), `${role} 必须注入角色资产强约束指令`);
        assert.ok(p.includes('林昭'), `${role} 必须含资产角色名`);
      }
      assert.ok(mem._accounts.get('u_ca_a').balance < 5000, '沙盘正常计费');
    } finally {
      MP.callText = orig;
    }
  });

  it('一键沉淀：数组形态归一+最近成稿（epNo desc）+声纹重算+同名保留 usedCount+他人项目404', async () => {
    mem._seedUser({ id: 'u_ca_h', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_ca_h', {
      id: 'p_ca_h', userId: 'u_ca_h', title: '旧案重演', mode: 'tags',
      bible: { characters: [{ name: '林昭', traits: '外冷内热', arc: '为父翻案', voice: '短句' }, { name: '陈默', traits: '谨慎多疑' }] },
    });
    const HARVEST_SCRIPT = [
      '△雨夜老巷，路灯忽明忽暗。',
      '林昭（低声）：查。',
      '林昭：这案子不会说谎，人才会说谎。你觉得呢？',
      '林昭：嗯，明天提审，谁都不许提前打招呼。',
      '林昭：冷不冷都得走完这一趟。',
      '陈默：你不该回来的吧？',
      '陈默：走吧，这条路没有回头路可走，你我都一样，谁先动谁先死。',
      '△两人擦肩而过，雨声盖住了脚步。',
    ].join('\n');
    await mem.script.create({ data: { projectId: 'p_ca_h', epNo: 1, content: '旧稿：林昭只说了一句：开始吧。' } });
    await mem.script.create({ data: { projectId: 'p_ca_h', epNo: 2, content: HARVEST_SCRIPT } });
    const r = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_h?lang=zh', 'u_ca_h', 'BASIC');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.created, 2);
    assert.strictEqual(r.json.updated, 0);
    const lin = r.json.assets.find((a) => a.name === '林昭');
    assert.ok(lin.persona.includes('外冷内热') && lin.persona.includes('弧光：为父翻案'));
    assert.ok(lin.voicePrint && typeof lin.voicePrint.signature === 'string' && lin.voicePrint.signature, '对最近成稿（epNo=2）重算声纹（资产行不透出草稿级 lineCount，验声纹摘要本体）');
    assert.ok(lin.signatureLines[0].includes('人才会说谎'));
    assert.strictEqual(lin.sourceProjectId, 'p_ca_h');
    assert.strictEqual(lin.sourceProjectTitle, '旧案重演');
    // 立项引用一次使 usedCount=1，再二次沉淀：同名 update 且不清零 usedCount
    const refProj = await jsonReq('POST', '/api/generate/projects', 'u_ca_h', 'BASIC', { title: '新剧引用', mode: 'tags', castAssetIds: [lin.id] });
    assert.strictEqual(refProj.status, 200);
    assert.strictEqual(mem._characterAssets.find((x) => x.id === lin.id).usedCount, 1);
    const r2 = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_h', 'u_ca_h', 'BASIC');
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.created, 0);
    assert.strictEqual(r2.json.updated, 2);
    assert.strictEqual(mem._characterAssets.find((x) => x.id === lin.id).usedCount, 1, '沉淀更新不得清零 usedCount');
    // 他人项目 404
    const r3 = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_h', 'u_ca_b', 'BASIC');
    assert.strictEqual(r3.status, 404);
  });

  it('字符串形态圣经归一 + 空圣经沉淀为 0', async () => {
    mem._seedUser({ id: 'u_ca_s', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_ca_str', {
      id: 'p_ca_str', userId: 'u_ca_s', title: '字符串圣经', mode: 'tags',
      bible: { characters: JSON.stringify({ '苏眉': { traits: '飒爽', voice: '句句带刺' } }) },
    });
    const r = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_str', 'u_ca_s', 'BASIC');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.created, 1);
    assert.strictEqual(r.json.assets[0].name, '苏眉');
    mem._projects.set('p_ca_empty', { id: 'p_ca_empty', userId: 'u_ca_s', title: '空圣经', mode: 'tags', bible: null });
    const r2 = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_empty', 'u_ca_s', 'BASIC');
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.created, 0);
    assert.strictEqual(r2.json.skipped, 0);
  });

  it('c157 复盘修复：带空白键的 bible 沉淀不建孤儿档，persona 一手源判定照常命中', async () => {
    mem._seedUser({ id: 'u_ca_ws', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_ca_ws', {
      id: 'p_ca_ws', userId: 'u_ca_ws', title: '空白键圣经', mode: 'tags',
      bible: { characters: { '  顾长安  ': { traits: '运筹帷幄的幕僚人设' } } }, // 键带首尾空白（LLM 生成形态不可控）
    });
    const r = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_ws', 'u_ca_ws', 'BASIC');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.created, 1);
    assert.strictEqual(r.json.assets[0].name, '顾长安', '沉淀名 trim 归一，与手动 upsert 同口径');
    assert.ok(r.json.assets[0].persona.includes('运筹帷幄'), 'chars 键归一后 hasPersonaSource 命中，一手源 persona 照常写入');
    // 二次沉淀命中同名档（trim 口径一致）→ update 而非再建孤儿
    const r2 = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_ws', 'u_ca_ws', 'BASIC');
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.updated, 1);
    assert.strictEqual(r2.json.created, 0);
    assert.strictEqual(mem._characterAssets.filter((x) => x.userId === 'u_ca_ws').length, 1, '不产生孤儿档');
  });

  it('沉淀只增强不降级（v2.153）：手动精修的 voice/signatureLines/visualAnchor 不被二次沉淀空值清空，persona 以 bible 一手源刷新', async () => {
    mem._seedUser({ id: 'u_ca_ng', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_ca_ng', {
      id: 'p_ca_ng', userId: 'u_ca_ng', title: '不降级验证', mode: 'tags',
      bible: { characters: { '沈青': { traits: '沉稳寡言' } } }, // 无 voice 字段 → 草稿 voice=null；无成稿 → 声纹/台词草稿为空
    });
    const first = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_ng', 'u_ca_ng', 'BASIC');
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.json.created, 1);
    const manual = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_ng', 'BASIC', {
      id: first.json.assets[0].id, name: '沈青', persona: '手动精修的完整人设内核', voice: '手动精修的声音特质',
      signatureLines: ['手动台词锚'], visualAnchor: '左眉疤痕',
    });
    assert.strictEqual(manual.status, 200);
    const second = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_ng', 'u_ca_ng', 'BASIC');
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.json.updated, 1, '同名走更新');
    const row = mem._characterAssets.find((x) => x.name === '沈青' && x.userId === 'u_ca_ng');
    assert.strictEqual(row.voice, '手动精修的声音特质', '空值不覆盖：手动 voice 不被草稿 null 清空');
    assert.deepStrictEqual(row.signatureLines, ['手动台词锚'], '空数组不覆盖：手动台词不被清空');
    assert.strictEqual(row.visualAnchor, '左眉疤痕', 'visualAnchor 沉淀从不触碰');
    assert.strictEqual(row.voicePrint, null, '新声纹为空时不覆盖旧声纹（本例本就无，验证不误写）');
    assert.ok(String(row.persona).includes('沉稳寡言'), 'persona 属沉淀本体语义：以 bible 一手源刷新');
    assert.strictEqual(row.sourceProjectId, 'p_ca_ng', '来源追踪随最近一次沉淀刷新');
  });

  it('v2.160 占位人设不覆盖手动档：bible 只有 voice（traits/arc 全空）时草稿 persona 是占位稿，不得降级手动精修', async () => {
    mem._seedUser({ id: 'u_ca_ph', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_ca_ph', {
      id: 'p_ca_ph', userId: 'u_ca_ph', title: '占位人设验证', mode: 'tags',
      bible: { characters: { '阿紫': { traits: '', arc: '', voice: '句句上扬带尾音' } } },
    });
    const manual = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_ph', 'BASIC', {
      name: '阿紫', persona: '刁蛮外表下藏善心的郡主人设内核',
    });
    assert.strictEqual(manual.status, 200);
    const r = await jsonReq('POST', '/api/generate/character-assets/from-project/p_ca_ph', 'u_ca_ph', 'BASIC');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.updated, 1, 'voice 有一手源仍走更新沉淀');
    const row = mem._characterAssets.find((x) => x.name === '阿紫' && x.userId === 'u_ca_ph');
    assert.strictEqual(row.persona, '刁蛮外表下藏善心的郡主人设内核', '占位稿"人设待补"不得覆盖手动 persona（修复前被覆盖）');
    assert.strictEqual(row.voice, '句句上扬带尾音', 'voice 属一手源正常沉淀增强');
  });

  it('资产体检端点：五维完整度 healths + 冲突预警 conflicts（v2.152）', async () => {
    const h = await jsonReq('GET', '/api/generate/character-assets/health?lang=zh', 'u_ca_a', 'BASIC');
    assert.strictEqual(h.status, 200);
    assert.ok(Array.isArray(h.json.healths) && Array.isArray(h.json.conflicts));
    const lin = h.json.healths.find((x) => x.name === '林昭');
    assert.ok(lin, '体检按用户归属，u_ca_a 有林昭档');
    assert.strictEqual(typeof lin.score, 'number');
    // 手动建档最后一次 upsert 只传 name+persona(5字,扣10)：全量覆盖语义 voice=null → 30-10=20 分 thin 档
    assert.strictEqual(lin.score, 20);
    assert.strictEqual(lin.level, 'thin');
    assert.ok(lin.missing.includes('voice') && lin.missing.includes('voicePrint') && lin.missing.includes('signatureLines') && lin.missing.includes('visualAnchor'));
    assert.ok(Array.isArray(lin.advice) && lin.advice.length <= 3 && lin.advice.length >= 1);
    const anon = await fetch(new URL('/api/generate/character-assets/health', base));
    assert.strictEqual(anon.status, 401);
  });

  it('体检分页（v2.155）：limit/offset/total + 冲突预警跑全量库（跨页 same_persona 不漏）', async () => {
    mem._seedUser({ id: 'u_ca_pg', level: 'BASIC', balance: 0 });
    // 创建顺序=updatedAt 升序 → 健康列表倒序：乙/丙被甲隔开，limit=2 时分属两页
    await mem.characterAsset.create({ data: { userId: 'u_ca_pg', name: '乙', persona: '谨慎多疑步步为营的谋士人设内核' } });
    await mem.characterAsset.create({ data: { userId: 'u_ca_pg', name: '甲', persona: '一人之下万人之上的枭雄人设内核' } });
    await mem.characterAsset.create({ data: { userId: 'u_ca_pg', name: '丙', persona: '谨慎多疑步步为营的谋士人设内核' } });
    await mem.characterAsset.create({ data: { userId: 'u_ca_pg', name: '丁', persona: '天真正直宁折不弯的少年人设内核' } });
    const p1 = await jsonReq('GET', '/api/generate/character-assets/health?limit=2&offset=0', 'u_ca_pg', 'BASIC');
    assert.strictEqual(p1.status, 200);
    assert.strictEqual(p1.json.total, 4);
    assert.strictEqual(p1.json.limit, 2);
    assert.strictEqual(p1.json.offset, 0);
    assert.strictEqual(p1.json.healths.length, 2, '页大小受 limit 约束');
    // 关键回归：conflicts 不吃分页页——乙丙分属不同页也必须检出同人设重复档
    const sp = p1.json.conflicts.find((c) => c.type === 'same_persona');
    assert.ok(sp, '冲突在全量库上计算，跨页重复档不漏');
    const p2 = await jsonReq('GET', '/api/generate/character-assets/health?limit=2&offset=2', 'u_ca_pg', 'BASIC');
    assert.strictEqual(p2.json.healths.length, 2);
    assert.strictEqual(p2.json.offset, 2);
    assert.strictEqual(p2.json.total, 4);
    // 钳制：limit 上限 200，负 offset 归零
    const p3 = await jsonReq('GET', '/api/generate/character-assets/health?limit=999&offset=-5', 'u_ca_pg', 'BASIC');
    assert.strictEqual(p3.json.limit, 200, 'limit 钳到 200');
    assert.strictEqual(p3.json.offset, 0, '负 offset 归零');
  });

  it('手动建档 tags 随档落库（v2.155）：整档覆盖语义下编辑不再静默清空标签', async () => {
    mem._seedUser({ id: 'u_ca_tag', level: 'BASIC', balance: 0 });
    const r = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_tag', 'BASIC', {
      name: '苏眉', persona: '飒爽利落句句带刺的女捕快人设', tags: ['复仇', '女捕快'],
    });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.json.asset.tags, ['复仇', '女捕快'], '建档即带标签');
    // 二次编辑（面板整档覆盖语义）仍随档提交 tags → 覆盖后保留并可增补
    const r2 = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_tag', 'BASIC', {
      id: r.json.asset.id, name: '苏眉', persona: '飒爽利落句句带刺的女捕快人设', tags: ['复仇', '女捕快', '市井'],
    });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.updated, true);
    assert.deepStrictEqual(r2.json.asset.tags, ['复仇', '女捕快', '市井'], '覆盖语义下标签随档保留');
  });

  it('列表端点 total + 200 硬帽（v2.156）：资产超 100 不再被静默截断，total 与实际可见数一致', async () => {
    mem._seedUser({ id: 'u_ca_cap', level: 'BASIC', balance: 0 });
    // 沉淀按项目累积可超 100：造 101 条验证原 take:100 帽已解除（101 条全部可见 = 立项下拉不漏资产）
    for (let i = 1; i <= 101; i++) {
      const r = await jsonReq('POST', '/api/generate/character-assets', 'u_ca_cap', 'BASIC', { name: `批量角色${i}号`, persona: `批量沉淀的人设内核${i}` });
      assert.strictEqual(r.status, 200);
    }
    const list = await jsonReq('GET', '/api/generate/character-assets', 'u_ca_cap', 'BASIC');
    assert.strictEqual(list.status, 200);
    assert.strictEqual(list.json.total, 101, 'total 为库内全量条数');
    assert.strictEqual(list.json.assets.length, 101, 'take:200 硬帽下 101 条全部可见（原 100 帽会截断）');
    // 列表与体检的可见范围一致（前端 limit=200 拉满后徽章不缺）
    const h = await jsonReq('GET', '/api/generate/character-assets/health?limit=200', 'u_ca_cap', 'BASIC');
    assert.strictEqual(h.json.total, 101);
    assert.strictEqual(h.json.healths.length, 101);
  });

  it('v2.163 检索：list/health q 关键词过滤（人设/声音/标签命中，total=命中数，冲突在过滤集上跑）', async () => {
    mem._seedUser({ id: 'u_ca_q', level: 'BASIC', balance: 0 });
    await mem.characterAsset.create({ data: { userId: 'u_ca_q', name: '林昭', persona: '外冷内热的刑警人设内核', voice: '短句干脆', visualAnchor: '左眉一道疤', signatureLines: ['案子不会说谎，人才会说谎'], tags: ['悬疑'] } });
    await mem.characterAsset.create({ data: { userId: 'u_ca_q', name: '陈默', persona: '谨慎多疑的谋士人设内核', voice: '试探反问', tags: ['权谋'] } });
    await mem.characterAsset.create({ data: { userId: 'u_ca_q', name: '苏眉', persona: '八面玲珑的线人人设内核', tags: ['Mystery'] } });
    await mem.characterAsset.create({ data: { userId: 'u_ca_q', name: '顾深', persona: '亦正亦邪的商人人设内核' } });
    await mem.characterAsset.create({ data: { userId: 'u_ca_q', name: '顾深', persona: '浪荡不羁的纨绔人设内核' } });
    // list：人设子串命中
    const l1 = await jsonReq('GET', `/api/generate/character-assets?q=${encodeURIComponent('刑警')}`, 'u_ca_q', 'BASIC');
    assert.strictEqual(l1.json.total, 1);
    assert.deepStrictEqual(l1.json.assets.map((a) => a.name), ['林昭']);
    // health：声音命中 / 标签大小写不敏感命中
    const h1 = await jsonReq('GET', `/api/generate/character-assets/health?q=${encodeURIComponent('反问')}`, 'u_ca_q', 'BASIC');
    assert.strictEqual(h1.json.total, 1, 'voice 子串命中');
    assert.strictEqual(h1.json.healths[0].name, '陈默');
    const h2 = await jsonReq('GET', `/api/generate/character-assets/health?q=${encodeURIComponent('mystery')}`, 'u_ca_q', 'BASIC');
    assert.strictEqual(h2.json.total, 1, '小写 mystery 命中大写 Mystery 标签');
    assert.strictEqual(h2.json.healths[0].name, '苏眉');
    // health：外观锚点/标志性台词命中（v2.164 复盘补 visualAnchor/signatureLines 字段——数组分支泛化后台词也能搜）
    const hA = await jsonReq('GET', `/api/generate/character-assets/health?q=${encodeURIComponent('一道疤')}`, 'u_ca_q', 'BASIC');
    assert.strictEqual(hA.json.total, 1, 'visualAnchor 锚点子串命中');
    assert.strictEqual(hA.json.healths[0].name, '林昭');
    const hB = await jsonReq('GET', `/api/generate/character-assets/health?q=${encodeURIComponent('不会说谎')}`, 'u_ca_q', 'BASIC');
    assert.strictEqual(hB.json.total, 1, 'signatureLines 台词气质锚命中（数组字段分支）');
    assert.strictEqual(hB.json.healths[0].name, '林昭');
    // health：dup_name 冲突在过滤集上会响，范围外不误报
    const h3 = await jsonReq('GET', `/api/generate/character-assets/health?q=${encodeURIComponent('顾深')}`, 'u_ca_q', 'BASIC');
    assert.strictEqual(h3.json.total, 2);
    assert.ok(h3.json.conflicts.some((c) => c.type === 'dup_name' && c.a === '顾深'), '冲突只对过滤后的集合计算且会响');
    const h4 = await jsonReq('GET', `/api/generate/character-assets/health?q=${encodeURIComponent('刑警')}`, 'u_ca_q', 'BASIC');
    assert.deepStrictEqual(h4.json.conflicts, [], '命中范围外没有冲突预警（搜索视角自洽）');
    // 不命中 → 空；无 q → 全量（向后兼容）
    const h5 = await jsonReq('GET', `/api/generate/character-assets/health?q=${encodeURIComponent('不存在的角色')}`, 'u_ca_q', 'BASIC');
    assert.strictEqual(h5.json.total, 0);
    assert.strictEqual(h5.json.healths.length, 0);
    const h6 = await jsonReq('GET', '/api/generate/character-assets/health', 'u_ca_q', 'BASIC');
    assert.strictEqual(h6.json.total, 5, '无 q 保持全量语义');
  });
});

// v2.186 c182 batch-complete 闭环契约测试（patches+fields 组合 4 种边界 + c181 篡改防护）
// 哲学：c178-c181 四轮落地的 dry-run+modal+patches 闭环，路由层一直缺契约测试，c182 补
// 覆盖：① patches+fields 都有 ② patches 无 fields ③ fields 无 patches ④ 都无
//      + c181 三连防护：白名单外字段跳过 / 类型错跳过 / "只填空格不覆盖"防旧 patches 覆盖手动修改
describe('v2.186 c182 · cast batch-complete 闭环契约（patches+fields 组合 4 种 + 篡改防护）', () => {
  // 测试用 helper：建一条空壳资产，dry-run 拿 patches，再带 patches 实际补全
  async function seedEmpty(uid = 'u_ca_bc') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.characterAsset.create({ data: { userId: uid, name: '林昭', persona: '外冷内热的刑警人设内核' } });
    // voice/signatureLines/visualAnchor 全空——autoFill 与 patches 都能补这三字段
  }

  it('组合①：patches+fields 都有——fields 是 patches 子集，只补交集（其他字段不动）', async () => {
    const a = await seedEmpty();
    const id = a.id;
    // 1) dry-run 拿 patches（autoFill 算出 voice/signatureLines/visualAnchor 三字段）
    const dr = await jsonReq('POST', '/api/generate/character-assets/batch-complete?dry-run=1', 'u_ca_bc', 'BASIC', { ids: [id] });
    assert.strictEqual(dr.status, 200);
    assert.strictEqual(dr.json.willUpdate.length, 1);
    const patch = dr.json.willUpdate[0].patch;
    assert.ok(patch.voice && patch.signatureLines && patch.visualAnchor, 'dry-run patch 含三字段');
    // 2) 用户在 modal 里只勾选 voice + visualAnchor 两字段（取消 signatureLines）
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc', 'BASIC', {
      ids: [id], patches: [{ id, patch }], fields: ['voice', 'visualAnchor'],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.deepStrictEqual(real.json.updated[0].filled.sort(), ['visualAnchor', 'voice'].sort(), '只补 fields 选中的两字段');
    // 3) signatureLines 不在 fields 内 → 跳过（仍是空数组）
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice && row.visualAnchor, '两字段已补');
    assert.deepStrictEqual(row.signatureLines, [], 'signatureLines 不在 fields 内不补');
  });

  it('组合②：patches 无 fields——全 patch 字段都补（白名单内）', async () => {
    const a = await seedEmpty('u_ca_bc2');
    const id = a.id;
    const dr = await jsonReq('POST', '/api/generate/character-assets/batch-complete?dry-run=1', 'u_ca_bc2', 'BASIC', { ids: [id] });
    const patch = dr.json.willUpdate[0].patch;
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc2', 'BASIC', {
      ids: [id], patches: [{ id, patch }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, '没 fields 时全 patch 字段都补');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice && row.visualAnchor && row.signatureLines.length, '三字段都已补');
  });

  it('组合③：fields 无 patches——走 autoFill 路径，按 fields 筛选 autoFill 结果', async () => {
    const a = await seedEmpty('u_ca_bc3');
    const id = a.id;
    // 不带 patches，只带 fields=['voice']：路由跑 autoFill 算三字段，但 fields 筛选后只补 voice
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc3', 'BASIC', {
      ids: [id], fields: ['voice'],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.deepStrictEqual(real.json.updated[0].filled, ['voice'], 'autoFill 算出三字段但 fields 只放行 voice');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice, 'voice 已补');
    assert.ok(!row.visualAnchor, 'visualAnchor 不在 fields 内不补');
    assert.deepStrictEqual(row.signatureLines, [], 'signatureLines 不在 fields 内不补');
  });

  it('组合④：patches 和 fields 都无——走 autoFill 全补（向后兼容旧路径）', async () => {
    const a = await seedEmpty('u_ca_bc4');
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc4', 'BASIC', { ids: [id] });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, 'autoFill 全补');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice && row.visualAnchor && row.signatureLines.length, '三字段已补');
  });

  it('c181 防护①：patches 含白名单外字段（如 id/userId/persona）→ 跳过不写库', async () => {
    const a = await seedEmpty('u_ca_bc5');
    const id = a.id;
    // 构造恶意 patches：试图改 persona（必填字段，不在白名单）+ id + userId
    const malicious = { id, patch: { persona: '篡改的人设', id: 'ca_hijack', userId: 'u_other', voice: '正常补' } };
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc5', 'BASIC', {
      ids: [id], patches: [malicious],
    });
    assert.strictEqual(real.status, 200);
    // voice 在白名单内 → 补；persona/id/userId 不在白名单 → 跳过
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice, 'voice 在白名单内已补');
    assert.strictEqual(row.persona, '外冷内热的刑警人设内核', 'persona 不在白名单内不被篡改');
    assert.strictEqual(row.id, id, 'id 不被篡改');
    assert.strictEqual(row.userId, 'u_ca_bc5', 'userId 不被篡改');
  });

  it('c181 防护②：patches 值类型错（string 字段传对象 / string[] 字段传字符串）→ 跳过', async () => {
    const a = await seedEmpty('u_ca_bc6');
    const id = a.id;
    // voice 是 string 类型，传对象 → 跳过；signatureLines 是 string[]，传字符串 → 跳过
    const badPatch = { id, patch: { voice: { hack: 1 }, signatureLines: '非数组', visualAnchor: '正常锚' } };
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc6', 'BASIC', {
      ids: [id], patches: [badPatch],
    });
    assert.strictEqual(real.status, 200);
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.visualAnchor, 'visualAnchor 类型正确已补');
    assert.ok(!row.voice, 'voice 类型错跳过');
    assert.deepStrictEqual(row.signatureLines, [], 'signatureLines 类型错跳过');
  });

  it('c181 防护③：dry-run 后编导手动改了字段，patches 旧值不覆盖（只填空格不覆盖）', async () => {
    const a = await seedEmpty('u_ca_bc7');
    const id = a.id;
    // 1) dry-run 拿 patches（含 voice 占位补全文案）
    const dr = await jsonReq('POST', '/api/generate/character-assets/batch-complete?dry-run=1', 'u_ca_bc7', 'BASIC', { ids: [id] });
    const patch = dr.json.willUpdate[0].patch;
    // 2) 模拟编导在 dry-run 后、实际补全前手动改了 voice 字段
    await mem.characterAsset.update({ where: { id }, data: { voice: '我自己写的声音特质' } });
    // 3) 带 patches 实际补全——patches 里的 voice 旧值不应覆盖手动修改
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc7', 'BASIC', {
      ids: [id], patches: [{ id, patch }],
    });
    assert.strictEqual(real.status, 200);
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.strictEqual(row.voice, '我自己写的声音特质', '手动修改不被 patches 旧值覆盖');
    assert.ok(row.visualAnchor, '未手动改的 visualAnchor 仍补');
  });

  it('空 ids 数组 / ids 超 200 上限 → 400', async () => {
    mem._seedUser({ id: 'u_ca_bc8', level: 'BASIC', balance: 0 });
    const r1 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc8', 'BASIC', { ids: [] });
    assert.strictEqual(r1.status, 400);
    assert.strictEqual(r1.json.error, 'IDS_REQUIRED');
    const r2 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bc8', 'BASIC', { ids: Array.from({ length: 201 }, (_, i) => `id${i}`) });
    assert.strictEqual(r2.status, 400);
    assert.strictEqual(r2.json.error, 'IDS_TOO_MANY');
  });

  it('dry-run 不写库：返回 willUpdate/willSkip/fieldsUnion/total 但库里字段仍空', async () => {
    const a = await seedEmpty('u_ca_bc9');
    const id = a.id;
    const dr = await jsonReq('POST', '/api/generate/character-assets/batch-complete?dry-run=1', 'u_ca_bc9', 'BASIC', { ids: [id] });
    assert.strictEqual(dr.status, 200);
    assert.ok(dr.json.dryRun, '响应带 dryRun:true 标志');
    assert.strictEqual(dr.json.willUpdate.length, 1);
    assert.ok(dr.json.fieldsUnion.length >= 2, 'fieldsUnion 是补全字段的并集');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(!row.voice && !row.visualAnchor && !row.signatureLines.length, 'dry-run 不写库');
  });
});

// v2.188 c184 防御性边界契约测试（c183 复盘轮发现的三处"防御性边界"未覆盖）
// 哲学：c182 9 个 case 覆盖了主路径 + c181 三连防护，但路由层 patches 数组结构防御逻辑（c181 铁律③）
// 还有三处边界没测：① patches 传非数组 → Array.isArray false → autoFill 兜底
// ② 多 ids 部分 patches 混合 → id1 走 patches 路径用 patch 值、id2 走 autoFill 路径用 autoFill 值
// ③ patches id 不在 ids 数组里 → patches 被静默丢弃、ids 内资产走 autoFill 路径补全
describe('v2.188 c184 · cast batch-complete 防御性边界契约', () => {
  async function seedEmpty(uid = 'u_ca_bd') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.characterAsset.create({ data: { userId: uid, name: '林昭', persona: '外冷内热的刑警人设内核' } });
  }

  it('边界①：patches 传字符串（非数组）→ Array.isArray false → 走 autoFill 路径补三字段', async () => {
    const a = await seedEmpty();
    const id = a.id;
    // patches 传字符串 "hack"——路由层 Array.isArray 返回 false → patchesInput = null → patchesMap = null → 走 autoFill 路径
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bd', 'BASIC', {
      ids: [id], patches: 'hack',
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, '走 autoFill 路径补全三字段');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice && row.visualAnchor && row.signatureLines.length, '三字段已补（autoFill 兜底）');
  });

  it('边界②：多 ids 部分 patches 混合——id1 走 patches 路径用 patch 值、id2 走 autoFill 路径用 autoFill 值', async () => {
    const a1 = await seedEmpty('u_ca_bd2');
    const id1 = a1.id;
    const a2 = await seedEmpty('u_ca_bd2'); // 同一用户第二条空壳
    const id2 = a2.id;
    // patches 只覆盖 id1，用自定义 patch 值（与 autoFill 算出的值不同，便于区分两条路径）
    const customPatch = { voice: '[patches-path]', visualAnchor: '[patches-path]', signatureLines: ['[patches-path]'] };
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bd2', 'BASIC', {
      ids: [id1, id2], patches: [{ id: id1, patch: customPatch }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 2, '两条资产都补');
    const r1 = await mem.characterAsset.findUnique({ where: { id: id1 } });
    const r2 = await mem.characterAsset.findUnique({ where: { id: id2 } });
    assert.strictEqual(r1.voice, '[patches-path]', 'id1 走 patches 路径用 patch 值');
    assert.strictEqual(r1.visualAnchor, '[patches-path]', 'id1 走 patches 路径用 patch 值');
    assert.ok(r1.signatureLines.length && r1.signatureLines[0] === '[patches-path]', 'id1 走 patches 路径用 patch 值');
    assert.ok(r2.voice && r2.voice !== '[patches-path]', 'id2 走 autoFill 路径用 autoFill 值（不同于 patch 值）');
    assert.ok(r2.visualAnchor && r2.visualAnchor !== '[patches-path]', 'id2 走 autoFill 路径用 autoFill 值');
  });

  it('边界③：patches id 不在 ids 数组里 → patches 被静默丢弃、ids 内资产走 autoFill 路径补全', async () => {
    const a1 = await seedEmpty('u_ca_bd3');
    const id1 = a1.id;
    const a2 = await seedEmpty('u_ca_bd3'); // 同一用户第二条空壳（用于构造"patches 里有 id2 但 ids 不含 id2"）
    const id2 = a2.id;
    // patches 里有 id2 但 ids 只含 id1——patchesMap 有 id2 但 rows 循环只到 id1
    // → id1 走 autoFill 路径补全，id2 不在 ids 里没补（patches 被静默丢弃）
    const customPatch = { voice: '[orphan-patch]', visualAnchor: '[orphan-patch]', signatureLines: ['[orphan-patch]'] };
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bd3', 'BASIC', {
      ids: [id1], patches: [{ id: id2, patch: customPatch }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1, '只补 ids 内的 id1');
    const r1 = await mem.characterAsset.findUnique({ where: { id: id1 } });
    const r2 = await mem.characterAsset.findUnique({ where: { id: id2 } });
    assert.ok(r1.voice && r1.voice !== '[orphan-patch]', 'id1 走 autoFill 路径用 autoFill 值（不是 patches 里的 orphan 值）');
    assert.ok(!r2.voice && !r2.visualAnchor && !r2.signatureLines.length, 'id2 不在 ids 里没补（patches 被静默丢弃）');
  });
});

// v2.189 c186 防御性边界契约补强（c185 复盘轮发现的三处新遗漏，c184 铁律①补强后的输入覆盖铁律驱动）
// 哲学：c184 三处边界覆盖了"整个 patches 非数组/多 ids 部分 patches 混合/patches id 不在 ids 里"，
// 但 c185 复盘发现三处新遗漏——patches 数组里某项不合法、patches 空数组、ids 非字符串。
// c185 铁律①：防御性边界测试必须覆盖所有客户端输入（patches + ids + fields 等）的"可能误传或恶意构造的输入结构"。
describe('v2.189 c186 · cast batch-complete 防御性边界契约补强（c185 复盘三处新遗漏）', () => {
  async function seedEmpty(uid = 'u_ca_bdx') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.characterAsset.create({ data: { userId: uid, name: '林昭', persona: '外冷内热的刑警人设内核' } });
  }

  it('边界①：patches 数组里某项缺 id 或 patch 不是对象 → 不合法项被 filter 过滤、合法项走 patches 路径、对应 id 走 autoFill', async () => {
    const a1 = await seedEmpty('u_ca_bdx1');
    const id1 = a1.id;
    const a2 = await seedEmpty('u_ca_bdx1');
    const id2 = a2.id;
    // patches 含 3 项：第一项合法（id1+patch对象）、第二项缺 id、第三项 patch 不是对象
    const customPatch = { voice: '[patches-path]', visualAnchor: '[patches-path]', signatureLines: ['[patches-path]'] };
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bdx1', 'BASIC', {
      ids: [id1, id2],
      patches: [
        { id: id1, patch: customPatch },  // 合法项——保留
        { patch: { voice: 'x' } },         // 缺 id——过滤
        { id: id2, patch: 'not-object' },  // patch 不是对象——过滤
      ],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 2, '两条资产都补');
    const r1 = await mem.characterAsset.findUnique({ where: { id: id1 } });
    const r2 = await mem.characterAsset.findUnique({ where: { id: id2 } });
    assert.strictEqual(r1.voice, '[patches-path]', 'id1 走 patches 路径用 patch 值（合法项保留）');
    assert.ok(r2.voice && r2.voice !== '[patches-path]', 'id2 走 autoFill 路径用 autoFill 值（不合法项被过滤后无 patch 可用）');
  });

  it('边界②：patches 是空数组 [] → Array.isArray true、patchesMap 空映射、所有 id 走 autoFill', async () => {
    const a = await seedEmpty('u_ca_bdx2');
    const id = a.id;
    // patches 传 []——Array.isArray([]) 返回 true，filter 后仍是空数组，patchesMap = new Map() 空映射
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bdx2', 'BASIC', {
      ids: [id], patches: [],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, '走 autoFill 路径补全三字段');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice && row.visualAnchor && row.signatureLines.length, '三字段已补（patches 空数组 → patchesMap 空 → autoFill 兜底）');
  });

  it('边界③：ids 里有 null/undefined/非字符串 → filter 过滤掉、只剩合法 id 走补全路径；全非字符串 → 400', async () => {
    const a = await seedEmpty('u_ca_bdx3');
    const id1 = a.id;
    // 混合：合法 id + 非字符串——路由层行 601 filter 过滤掉非字符串项
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bdx3', 'BASIC', {
      ids: [id1, null, undefined, 123],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 1, 'filter 过滤掉 null/undefined/123 后只剩 id1');
    const r1 = await mem.characterAsset.findUnique({ where: { id: id1 } });
    assert.ok(r1.voice && r1.visualAnchor && r1.signatureLines.length, 'id1 三字段已补（autoFill 兜底）');
    // 全非字符串 → filter 后 [] → !ids.length → 400 IDS_REQUIRED
    const bad = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_ca_bdx3', 'BASIC', {
      ids: [null, undefined, 123],
    });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.json.error, 'IDS_REQUIRED', '全非字符串 filter 后空数组 → 400');
  });
});

// v2.190 c188 防御性边界第二轮补强（c187 复盘轮发现的 5 处遗漏 + 断言分离/类型陷阱锁定两条新铁律驱动）
// c187 清单：① fields 空数组 truthy 陷阱 ② patch 是数组（typeof [] === 'object' 漏网）③ string[] 元素类型第三层校验
//          ④ batch-complete 越权 id 归属隔离 ⑤ patch 是 null（typeof null === 'object' 靠 truthy 短路拦截）
// 每个 case 遵守 c187 断言分离铁律：单一不合法项 + 注释写明"过滤失效推演"结论（红 / 无害+原因）
describe('v2.190 c188 · cast batch-complete 防御性边界第二轮补强（c187 五处遗漏）', () => {
  async function seedEmpty(uid = 'u_c188_c') {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.characterAsset.create({ data: { userId: uid, name: '林昭', persona: '外冷内热的刑警人设内核' } });
  }

  it('遗漏①：fields 是空数组 [] → 空数组 truthy 走筛选路径、循环零执行 → skipped（不是全选也不是 400）', async () => {
    const a = await seedEmpty('u_c188_c1');
    const id = a.id;
    const customPatch = { voice: '[f-empty]', visualAnchor: '[f-empty]', signatureLines: ['[f-empty]'] };
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c188_c1', 'BASIC', {
      ids: [id], patches: [{ id, patch: customPatch }], fields: [],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 0, 'fields=[] → for 循环零执行 → 零字段补全');
    assert.strictEqual(real.json.skipped.length, 1, '进入 skipped（路由行 637 中文 reason）');
    assert.strictEqual(real.json.skipped[0].id, id);
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(!row.voice && !row.visualAnchor && !row.signatureLines.length, '库里三字段仍空（零写入）');
    // 失效推演：若路由把 fieldsFilter ? 收紧为 fieldsFilter?.length ?（空数组改走 Object.keys(patch)）→ updated=1、三字段落库 → 本断言全红 ✓
  });

  it('遗漏①补：fields 非数组（字符串）→ Array.isArray false → null → 默认全选；fields 含非字符串 → filter 剔除后只补合法字段', async () => {
    // 段 A：fields 传字符串 'voice'（客户端误传）——Array.isArray('voice') === false → fieldsFilter=null → 全补 patch 三字段
    const aA = await seedEmpty('u_c188_c2a');
    const idA = aA.id;
    const patchA = { voice: '[non-arr]', visualAnchor: '[non-arr]', signatureLines: ['[non-arr]'] };
    const rA = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c188_c2a', 'BASIC', {
      ids: [idA], patches: [{ id: idA, patch: patchA }], fields: 'voice',
    });
    assert.strictEqual(rA.status, 200);
    assert.strictEqual(rA.json.updated.length, 1, '非数组 fields 不报错、走默认全选');
    const rowA = await mem.characterAsset.findUnique({ where: { id: idA } });
    assert.ok(rowA.voice && rowA.visualAnchor && rowA.signatureLines.length, '三字段全补（fieldsFilter=null 不筛选）');
    // 失效推演：若路由误把字符串当数组迭代（for...of 逐字符 v/o/i/c/e）→ 白名单无一命中 → skipped → updated=0，本断言红 ✓
    // 段 B：fields=['voice',123,null]——非字符串被 filter 剔除，只剩 voice
    const aB = await seedEmpty('u_c188_c2b');
    const idB = aB.id;
    const patchB = { voice: '[mix-elem]', visualAnchor: '[mix-elem]', signatureLines: ['[mix-elem]'] };
    const rB = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c188_c2b', 'BASIC', {
      ids: [idB], patches: [{ id: idB, patch: patchB }], fields: ['voice', 123, null],
    });
    assert.strictEqual(rB.status, 200);
    assert.deepStrictEqual(rB.json.updated[0].filled, ['voice'], '非字符串项剔除后只补 voice');
    const rowB = await mem.characterAsset.findUnique({ where: { id: idB } });
    assert.strictEqual(rowB.voice, '[mix-elem]');
    assert.ok(!rowB.visualAnchor && !rowB.signatureLines.length, '另外两字段不补');
    // 无害性标注（c187 断言分离铁律）：若非字符串 filter 失效，123/null 进入循环后 `f in patch` 为 false（patch 无此键）必 continue，
    // 结果与过滤后相同——该项漏过滤亦无害（in 检查 + 白名单双重拦截），无残余可观测差异；本 case 价值是锁定当前行为的活文档。
  });

  it('遗漏②：patch 是数组 [] → typeof [] === "object" 且 truthy 能过 input filter → Object.keys([])=[] 空转 → skipped', async () => {
    const a = await seedEmpty('u_c188_c3');
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c188_c3', 'BASIC', {
      ids: [id], patches: [{ id, patch: [] }],
    });
    assert.strictEqual(real.status, 200);
    assert.strictEqual(real.json.updated.length, 0, '数组 patch 过 filter 但零键可补 → 不写库');
    assert.strictEqual(real.json.skipped.length, 1);
    assert.strictEqual(real.json.skipped[0].id, id);
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(!row.voice && !row.visualAnchor && !row.signatureLines.length, '库里三字段仍空');
    // 失效推演（行为锁定型）：若未来 input filter 收紧加 !Array.isArray(x.patch) → 该项被过滤 → autoFill 全补 → updated=1 → 本断言红，
    // 即测试会主动提醒"数组 patch 从静默 skip 变成 autoFill 兜底"的语义变更，类型陷阱锁定铁律要求此提醒存在。
  });

  it('遗漏⑤：patch 是 null → typeof null === "object" 陷阱，靠 x.patch && truthy 短路拦截 → 该项过滤、id 走 autoFill', async () => {
    const a = await seedEmpty('u_c188_c4');
    const id = a.id;
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c188_c4', 'BASIC', {
      ids: [id], patches: [{ id, patch: null }],
    });
    assert.strictEqual(real.status, 200, 'null patch 被过滤后走 autoFill 正常补全，不抛错');
    assert.strictEqual(real.json.updated.length, 1);
    assert.ok(real.json.updated[0].filled.length >= 2, 'autoFill 补全三字段');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.ok(row.voice && row.visualAnchor && row.signatureLines.length, '三字段已补（autoFill 兜底）');
    // 失效推演：若误删 x.patch && 只留 typeof x.patch === 'object'（null 通过）→ Map.get 得 null → Object.keys(null) 抛 TypeError → 500，
    // 本断言 status===200 立即变红 ✓ 强证实 truthy 前缀不可删。
  });

  it('遗漏③：signatureLines 传"数组但含非字符串元素" → 行 629 every 第三层校验拦截该字段，同 patch 其他字段照补', async () => {
    const a = await seedEmpty('u_c188_c5');
    const id = a.id;
    // c181 防护②只测了 string 传对象（行 627）和 string[] 传字符串（行 628），行 629 every 元素校验 0 覆盖——本 case 补
    const badElemPatch = { signatureLines: ['合法台词', 123, null], voice: '[elem-ok]', visualAnchor: '[elem-ok]' };
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c188_c5', 'BASIC', {
      ids: [id], patches: [{ id, patch: badElemPatch }],
    });
    assert.strictEqual(real.status, 200);
    assert.deepStrictEqual(real.json.updated[0].filled.sort(), ['visualAnchor', 'voice'].sort(), '元素类型错只跳过 signatureLines 一个字段');
    const row = await mem.characterAsset.findUnique({ where: { id } });
    assert.strictEqual(row.voice, '[elem-ok]');
    assert.strictEqual(row.visualAnchor, '[elem-ok]');
    assert.deepStrictEqual(row.signatureLines, [], '污染数组整体不落库（不是截断、不是部分写入）');
    // 失效推演：若删掉行 629 every 校验 → ['合法台词',123,null] 整体写入 → signatureLines.length===3 → 本断言红 ✓
  });

  it('遗漏④：ids 混他人资产 id → findMany 的 userId 归属隔离：只补本人、他人资产不动、200 不报错、响应不泄露他人 id', async () => {
    const own = await seedEmpty('u_c188_c6');
    const ownId = own.id;
    mem._seedUser({ id: 'u_c188_c6_other', level: 'BASIC', balance: 0 });
    const other = await mem.characterAsset.create({ data: { userId: 'u_c188_c6_other', name: '他人角色', persona: '他人的人设内核' } });
    const otherId = other.id;
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c188_c6', 'BASIC', {
      ids: [ownId, otherId],
    });
    assert.strictEqual(real.status, 200, '混入他人 id 不报错（静默隔离，不泄露存在性）');
    assert.strictEqual(real.json.total, 1, 'rows 只含本人命中的 1 条');
    assert.strictEqual(real.json.updated.length, 1);
    assert.strictEqual(real.json.updated[0].id, ownId, '补的是本人资产');
    assert.ok(!real.json.skipped.some((s) => s.id === otherId), 'skipped 也不含他人 id（不泄露存在性）');
    const otherRow = await mem.characterAsset.findUnique({ where: { id: otherId } });
    assert.ok(!otherRow.voice && !otherRow.visualAnchor && !otherRow.signatureLines.length, '他人资产三字段保持空（零写入）');
    // 失效推演：若 findMany 去掉 userId 条件 → rows 含 2 条 → total=2、updated 含 otherId、他人资产被补 → 三处断言全红 ✓
  });
});

// v2.190 c190 值域防线 + P3 留白强制处置（c189 复盘四元组驱动）
// BUG-1：补丁值类型合法但内容空（''/'   '/[]/['','  ']）→ 旧代码 isEmpty 只查旧值不查新值 → 空值脏写 + filledFields 谎报补全
// BUG-2：patches 路径无 zod → 超长 string / 超量数组绕过手动建档全部上限 → 存储膨胀 + 资产注入生成 prompt 污染
// P3 六项（c188 表连续两轮）：ids 空串 / ids 重复 / patches 同 id 重复 / lang 非法值 / dry-run 非严格 1 / 无 body
// 遗漏⑥：fields 显式选白名单外字段时白名单第二道防线的证实（c189 工作1 新查）
describe('v2.190 c190 · cast batch-complete 值域防线（空/长/量）+ P3 入口处置 + 白名单显式 fields', () => {
  async function seedEmpty(uid) {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.characterAsset.create({ data: { userId: uid, name: '林昭', persona: '外冷内热的刑警人设内核' } });
  }

  it('BUG-1：空串/全空白 string、空数组/全空白元素数组不落库且不谎报，同 patch 合法字段照补；dry-run 同步不谎报', async () => {
    // 段 A：string 两字段一空串一全空白 + 合法数组字段 → 只补数组字段（部分成功）
    const aA = await seedEmpty('u_c190_b1a');
    const rA = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b1a', 'BASIC', {
      ids: [aA.id], patches: [{ id: aA.id, patch: { voice: '', visualAnchor: '   ', signatureLines: ['[b1-ok]'] } }],
    });
    assert.strictEqual(rA.status, 200);
    assert.strictEqual(rA.json.updated.length, 1);
    assert.deepStrictEqual(rA.json.updated[0].filled, ['signatureLines'], '空值两字段不进 filled（旧代码会谎报三字段全补）');
    const rowA = await mem.characterAsset.findUnique({ where: { id: aA.id } });
    assert.ok(!rowA.voice && !rowA.visualAnchor, '空串/全空白不落库');
    assert.deepStrictEqual(rowA.signatureLines, ['[b1-ok]']);
    // 段 B1：空数组 []（vacuous truth 旧代码 every 直接放行）+ 合法 string
    const aB1 = await seedEmpty('u_c190_b1b');
    const rB1 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b1b', 'BASIC', {
      ids: [aB1.id], patches: [{ id: aB1.id, patch: { voice: '[b1-b]', signatureLines: [] } }],
    });
    assert.deepStrictEqual(rB1.json.updated[0].filled, ['voice']);
    assert.deepStrictEqual((await mem.characterAsset.findUnique({ where: { id: aB1.id } })).signatureLines, [], '空数组不占位');
    // 段 B2：数组元素全空白（类型全是 string，内容全废）
    const aB2 = await seedEmpty('u_c190_b1c');
    const rB2 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b1c', 'BASIC', {
      ids: [aB2.id], patches: [{ id: aB2.id, patch: { voice: '[b1-c]', signatureLines: ['', '   '] } }],
    });
    assert.deepStrictEqual(rB2.json.updated[0].filled, ['voice'], '全空白元素清洗后为空 → 该字段跳过');
    assert.deepStrictEqual((await mem.characterAsset.findUnique({ where: { id: aB2.id } })).signatureLines, []);
    // 段 C：dry-run 同样不谎报——willUpdate.fields/fieldsUnion 不含空值字段，且零写库
    const aC = await seedEmpty('u_c190_b1d');
    const rC = await jsonReq('POST', '/api/generate/character-assets/batch-complete?dry-run=1', 'u_c190_b1d', 'BASIC', {
      ids: [aC.id], patches: [{ id: aC.id, patch: { voice: '   ', signatureLines: ['[b1-d]'] } }],
    });
    assert.strictEqual(rC.json.dryRun, true);
    assert.deepStrictEqual(rC.json.willUpdate[0].fields, ['signatureLines']);
    assert.deepStrictEqual(rC.json.fieldsUnion, ['signatureLines'], 'fieldsUnion 不谎报 voice');
    const rowC = await mem.characterAsset.findUnique({ where: { id: aC.id } });
    assert.ok(!rowC.voice && !rowC.signatureLines.length, 'dry-run 零写库');
    // 失效推演：若删掉 normalizePatchValue 的内容非空关 → 段 A filled=['voice','visualAnchor','signatureLines'] 且空串落库 → 首断言即红 ✓
  });

  it('BUG-2：超上限 string/超量数组/超长元素静默跳过且不误伤贴线值，合规字段照补（约束与手动建档 zod 同源）', async () => {
    // 段 A：两 string 字段均 201 字（上限 200）+ 合法数组 → 只补数组
    const aA = await seedEmpty('u_c190_b2a');
    const long201 = '字'.repeat(201);
    const rA = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b2a', 'BASIC', {
      ids: [aA.id], patches: [{ id: aA.id, patch: { voice: long201, visualAnchor: long201, signatureLines: ['[b2-ok]'] } }],
    });
    assert.deepStrictEqual(rA.json.updated[0].filled, ['signatureLines'], '201 字双字段跳过');
    const rowA = await mem.characterAsset.findUnique({ where: { id: aA.id } });
    assert.ok(!rowA.voice && !rowA.visualAnchor, '超长值不落库（旧代码无长度关可落任意长度）');
    // 段 B：贴线值 200 字必须接受（防修复把 > 写成 >= 误伤）
    const aB = await seedEmpty('u_c190_b2b');
    const rB = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b2b', 'BASIC', {
      ids: [aB.id], patches: [{ id: aB.id, patch: { voice: '声'.repeat(200) } }],
    });
    assert.deepStrictEqual(rB.json.updated[0].filled, ['voice']);
    assert.strictEqual((await mem.characterAsset.findUnique({ where: { id: aB.id } })).voice.length, 200, '贴线接受');
    // 段 C1：数组 6 条（上限 5）+ 合法 string → 只补 string
    const aC1 = await seedEmpty('u_c190_b2c');
    const rC1 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b2c', 'BASIC', {
      ids: [aC1.id], patches: [{ id: aC1.id, patch: { visualAnchor: '[b2-c]', signatureLines: Array(6).fill('短句') } }],
    });
    assert.deepStrictEqual(rC1.json.updated[0].filled, ['visualAnchor'], '超量数组整字段跳过（不是截断成 5 条）');
    assert.deepStrictEqual((await mem.characterAsset.findUnique({ where: { id: aC1.id } })).signatureLines, []);
    // 段 C2：元素 61 字（上限 60）
    const aC2 = await seedEmpty('u_c190_b2d');
    const rC2 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b2d', 'BASIC', {
      ids: [aC2.id], patches: [{ id: aC2.id, patch: { visualAnchor: '[b2-d]', signatureLines: ['词'.repeat(61)] } }],
    });
    assert.deepStrictEqual(rC2.json.updated[0].filled, ['visualAnchor'], '超长元素整字段跳过');
    // 段 D：贴线数组 5 条 × 每条 60 字必须接受
    const aD = await seedEmpty('u_c190_b2e');
    const rD = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_b2e', 'BASIC', {
      ids: [aD.id], patches: [{ id: aD.id, patch: { signatureLines: Array(5).fill('句'.repeat(60)) } }],
    });
    const rowD = await mem.characterAsset.findUnique({ where: { id: aD.id } });
    assert.strictEqual(rowD.signatureLines.length, 5, '贴线条数接受');
    assert.strictEqual(rowD.signatureLines[0].length, 60, '贴线元素长度接受');
    // 失效推演：若规则表与 zod 数字漂移（如误抄 100）→ 段 B 200 字贴线值被跳过、filled=[] → 段 B 断言红（同源常量的活锁）✓
  });

  it('P3 六项强制处置（c188 表连续两轮，c189 P3 时效铁律：补测/判死/提级，本轮逐项补测锁定）', async () => {
    // 项1 ids 含空字符串：typeof 放行但 findMany 查无此行 → 只补真实 id，200 不报错
    const a1 = await seedEmpty('u_c190_p31');
    const r1 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_p31', 'BASIC', {
      ids: ['', a1.id], patches: [{ id: a1.id, patch: { voice: '[p31]' } }],
    });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.total, 1, '空串 id 查无行不计入 rows');
    assert.strictEqual(r1.json.updated.length, 1);
    // 项2 ids 重复：findMany in 去重 → 只一行一次 update（updated 不重复计）
    const a2 = await seedEmpty('u_c190_p32');
    const r2 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_p32', 'BASIC', {
      ids: [a2.id, a2.id], patches: [{ id: a2.id, patch: { voice: '[p32]' } }],
    });
    assert.strictEqual(r2.json.total, 1);
    assert.strictEqual(r2.json.updated.length, 1, '重复 id 不产生重复更新');
    // 项3 patches 同 id 重复：Map 后者覆盖 → 落库值是后者
    const a3 = await seedEmpty('u_c190_p33');
    const r3 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_p33', 'BASIC', {
      ids: [a3.id], patches: [{ id: a3.id, patch: { voice: '[first]' } }, { id: a3.id, patch: { voice: '[second]' } }],
    });
    assert.strictEqual((await mem.characterAsset.findUnique({ where: { id: a3.id } })).voice, '[second]', 'Map 后者覆盖语义锁定');
    // 项4 lang 非法值（fr）→ 不落在 en 严格等式上 → 中文兜底；en 显式传英文 reason（用 fields=[] 稳定触发 skip）
    const a4a = await seedEmpty('u_c190_p34a');
    const r4a = await jsonReq('POST', '/api/generate/character-assets/batch-complete?lang=fr', 'u_c190_p34a', 'BASIC', {
      ids: [a4a.id], patches: [{ id: a4a.id, patch: { voice: '[x]' } }], fields: [],
    });
    assert.ok(r4a.json.skipped[0].reason.includes('选中字段'), 'lang=fr 按中文兜底');
    const a4b = await seedEmpty('u_c190_p34b');
    const r4b = await jsonReq('POST', '/api/generate/character-assets/batch-complete?lang=en', 'u_c190_p34b', 'BASIC', {
      ids: [a4b.id], patches: [{ id: a4b.id, patch: { voice: '[x]' } }], fields: [],
    });
    assert.ok(r4b.json.skipped[0].reason.includes('Selected fields'), 'lang=en 英文 reason');
    // 项5 dry-run 非严格 "1"（?dry-run=0 与 "true" 都不算）→ 实际写库
    const a5 = await seedEmpty('u_c190_p35');
    const r5 = await jsonReq('POST', '/api/generate/character-assets/batch-complete?dry-run=0', 'u_c190_p35', 'BASIC', {
      ids: [a5.id], patches: [{ id: a5.id, patch: { voice: '[p35]' } }],
    });
    assert.strictEqual(r5.json.dryRun, undefined, 'dry-run=0 不是预检（响应无 dryRun 标记）');
    assert.strictEqual((await mem.characterAsset.findUnique({ where: { id: a5.id } })).voice, '[p35]', '实际写库');
    // 项6 无 body POST：可选链 → ids 非数组 → [] → 400 IDS_REQUIRED
    const r6 = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_p31', 'BASIC', undefined);
    assert.strictEqual(r6.status, 400);
    assert.strictEqual(r6.json.error, 'IDS_REQUIRED');
  });

  it('遗漏⑥：fields 显式选中白名单外字段（persona）→ 白名单第二道防线拦截、库值不被篡改，同请求合法字段照补', async () => {
    const a = await seedEmpty('u_c190_f6');
    const real = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c190_f6', 'BASIC', {
      ids: [a.id],
      fields: ['persona', 'voice'],
      patches: [{ id: a.id, patch: { persona: '[hack-篡建档核心字段]', voice: '[f6-ok]' } }],
    });
    assert.strictEqual(real.status, 200);
    assert.deepStrictEqual(real.json.updated[0].filled, ['voice'], 'persona 不在 patches 白名单（白名单=autoFill 可补字段），即使 fields 显式选中也拒');
    const row = await mem.characterAsset.findUnique({ where: { id: a.id } });
    assert.strictEqual(row.persona, '外冷内热的刑警人设内核', '越界字段零写入（不是被写成补丁值）');
    assert.strictEqual(row.voice, '[f6-ok]');
    // 失效推演：若白名单查表被绕过（如改成 fields 直接信任）→ persona 被改写、filled 含 persona → 两断言红 ✓
  });
});

// v2.191 c191 复盘：PX-1 沉淀毒丸（bible Json 畸形）路由级回归 + 遗漏⑦ autoFill 路径 fields 畸形
describe('v2.191 c191 · cast from-project 畸形 bible 防御（沉淀入口字段类型壳）', () => {
  it('PX-1 路由级：bible.characters 含非字符串 traits/arc/voice（数组形态复刻 LLM 裸落库）→ 200 不毒丸，畸形角色跳过、合法角色照常沉淀', async () => {
    mem._seedUser({ id: 'u_c191_fp1a', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_c191_a', {
      id: 'p_c191_a', userId: 'u_c191_fp1a', title: '畸形圣经甲', mode: 'tags',
      // 数组形态：路由三形态归一接受（只检 name 是 string），值字段未经 zod——pipeline LLM 裸 JSON 落库的真实形态
      bible: { characters: [
        { name: '毒丸', traits: 123, arc: { x: 1 }, voice: true },
        { name: '陈默', traits: '谨慎多疑', voice: '试探反问' },
      ] },
    });
    const r = await jsonReq('POST', '/api/generate/character-assets/from-project/p_c191_a', 'u_c191_fp1a', 'BASIC');
    assert.strictEqual(r.status, 200, '畸形角色不得导致整批沉淀 500（旧代码 TypeError 毒丸）');
    assert.strictEqual(r.json.created, 1, '全畸形角色视同三项全空被跳过，合法角色正常沉淀');
    assert.strictEqual(r.json.assets[0].name, '陈默');
    assert.ok(r.json.assets[0].persona.includes('谨慎多疑'));
  });

  it('PX-1 路由级段B：畸形 traits + 合法 voice 混合 → 引擎出草稿后路由层一手源判定同样不得炸，voice 正常沉淀、persona 走占位', async () => {
    mem._seedUser({ id: 'u_c191_fp1b', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_c191_b', {
      id: 'p_c191_b', userId: 'u_c191_fp1b', title: '畸形圣经乙', mode: 'tags',
      bible: { characters: { '阿紫': { traits: 42, arc: '', voice: '句句上扬带尾音' } } },
    });
    const r = await jsonReq('POST', '/api/generate/character-assets/from-project/p_c191_b', 'u_c191_fp1b', 'BASIC');
    assert.strictEqual(r.status, 200, '路由层 hasPersonaSource 对 chars 原始值裸 trim 是第二处同源炸点（旧代码仅修引擎仍 500）');
    assert.strictEqual(r.json.created, 1);
    const row = mem._characterAssets.find((x) => x.name === '阿紫' && x.userId === 'u_c191_fp1b');
    assert.strictEqual(row.voice, '句句上扬带尾音', '合法一手源 voice 照常沉淀');
    assert.ok(!String(row.persona).includes('42'), 'number traits 不得字符串化污染 persona');
  });
});

describe('v2.191 c191 · cast batch-complete autoFill 旧路径 fields 畸形（遗漏⑦第3次进表，补测锁定）', () => {
  async function seedEmpty(uid) {
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    return mem.characterAsset.create({ data: { userId: uid, name: '林昭', persona: '外冷内热的刑警人设内核' } });
  }

  it('遗漏⑦：不带 patches 走 autoFill 时 fields 四变体——单选/空数组/含非字符串/非数组全选', async () => {
    // 段A fields 单选：autoFill 三字段产出经 delete 筛选只剩 visualAnchor
    const aA = await seedEmpty('u_c191_f7a');
    const rA = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c191_f7a', 'BASIC', {
      ids: [aA.id], fields: ['visualAnchor'],
    });
    assert.strictEqual(rA.status, 200);
    assert.deepStrictEqual(rA.json.updated[0].filled, ['visualAnchor']);
    const rowA = await mem.characterAsset.findUnique({ where: { id: aA.id } });
    assert.ok(rowA.visualAnchor && !rowA.voice && !rowA.signatureLines.length, '只补选中字段');
    // 段B fields=[]：合法但零选中 → 全删 → skip（与 patches 路径同 reason 口径）
    const aB = await seedEmpty('u_c191_f7b');
    const rB = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c191_f7b', 'BASIC', {
      ids: [aB.id], fields: [],
    });
    assert.strictEqual(rB.json.updated.length, 0);
    assert.ok(rB.json.skipped[0].reason.includes('选中字段'), '零选中走 skip 不报错');
    // 段C fields 含非字符串元素：filter 后只剩合法字段
    const aC = await seedEmpty('u_c191_f7c');
    const rC = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c191_f7c', 'BASIC', {
      ids: [aC.id], fields: [123, 'voice', null],
    });
    assert.deepStrictEqual(rC.json.updated[0].filled, ['voice'], '非字符串元素静默过滤不抛错');
    const rowC = await mem.characterAsset.findUnique({ where: { id: aC.id } });
    assert.ok(rowC.voice && !rowC.visualAnchor, '过滤后只补 voice');
    // 段D fields 非数组（旧客户端误传字符串）：Array.isArray 兜底为 null → 全选
    const aD = await seedEmpty('u_c191_f7d');
    const rD = await jsonReq('POST', '/api/generate/character-assets/batch-complete', 'u_c191_f7d', 'BASIC', {
      ids: [aD.id], fields: 'voice',
    });
    assert.deepStrictEqual([...rD.json.updated[0].filled].sort(), ['signatureLines', 'visualAnchor', 'voice'], '非数组兜底全选（宽容默认，不 400）');
  });
});

// v2.192 c192 P3 闭环（c191 记名）：沉淀 persona/voice 是 bible 快照语义（区别于手填 zod 200），
// 宽硬帽 1000 仅防 LLM 异常巨串拖垮列表/撑爆卡片。双向边界：N 贴线完整接受、N+1 截断到 N。
describe('v2.192 c192 · cast from-project 沉淀文本宽硬帽 1000（异常护栏，不碰手填 200 口径）', () => {
  it('persona 1000 字贴线完整保留、1001 字截断到 1000；voice 同帽', async () => {
    // 段A 贴线：traits 1000 字（无 arc，persona 即 traits 本体）→ 一字不截
    mem._seedUser({ id: 'u_c192_capA', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_c192_a', {
      id: 'p_c192_a', userId: 'u_c192_capA', title: '贴线项目', mode: 'tags',
      bible: { characters: { '贴线姐': { traits: '稳'.repeat(1000) } } },
    });
    const rA = await jsonReq('POST', '/api/generate/character-assets/from-project/p_c192_a', 'u_c192_capA', 'BASIC');
    assert.strictEqual(rA.status, 200);
    const rowA = mem._characterAssets.find((x) => x.name === '贴线姐' && x.userId === 'u_c192_capA');
    assert.strictEqual(rowA.persona.length, 1000, '1000 贴线接受（护栏不是手填 200 口径）');
    assert.strictEqual(rowA.persona, '稳'.repeat(1000), '贴线内容完整不截');

    // 段B 越线：traits 1001 → persona 1001 → 截到 1000
    mem._seedUser({ id: 'u_c192_capB', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_c192_b', {
      id: 'p_c192_b', userId: 'u_c192_capB', title: '越线项目', mode: 'tags',
      bible: { characters: { '巨串哥': { traits: '长'.repeat(1001) } } },
    });
    const rB = await jsonReq('POST', '/api/generate/character-assets/from-project/p_c192_b', 'u_c192_capB', 'BASIC');
    assert.strictEqual(rB.status, 200);
    const rowB = mem._characterAssets.find((x) => x.name === '巨串哥' && x.userId === 'u_c192_capB');
    assert.strictEqual(rowB.persona.length, 1000, '1001 触发尾部截断（N+1 拒绝侧）');
    assert.strictEqual(rowB.persona, '长'.repeat(1000));

    // 段C voice 同帽：traits 短保证不跳过，voice 1001 → 1000
    mem._projects.set('p_c192_c', {
      id: 'p_c192_c', userId: 'u_c192_capB', title: '声纹巨串', mode: 'tags',
      bible: { characters: { '话痨仙': { traits: '话密', voice: '哦'.repeat(1001) } } },
    });
    const rC = await jsonReq('POST', '/api/generate/character-assets/from-project/p_c192_c', 'u_c192_capB', 'BASIC');
    assert.strictEqual(rC.status, 200);
    const rowC = mem._characterAssets.find((x) => x.name === '话痨仙' && x.userId === 'u_c192_capB');
    assert.strictEqual(rowC.voice.length, 1000, 'voice 同 1000 宽硬帽');
  });
});
