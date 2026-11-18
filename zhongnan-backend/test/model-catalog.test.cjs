const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/config/model-catalog.js');
const L = require('../dist/config/pricing.js');
const LEVELS = ['FREE', 'BASIC', 'ADVANCED', 'PRO'];
const TIERS = ['economy', 'standard', 'flagship'];

test('四档引擎组合（v2.54：3档全国产+海外档预留）：引用合法、多岗异构、岗位≥6、成本严格递增', () => {
  const tiers = C.buildTiers();
  assert.strictEqual(tiers.length, 4);
  let prev = -1;
  for (const t of tiers) {
    assert.ok(t.picks.length >= 6);
    for (const p of t.picks) if (p.modelId !== 'LOCAL') assert.ok(C.findModel(p.modelId), `非法模型 ${p.modelId}`);
    assert.ok(new Set(t.picks.map((p) => p.modelId)).size >= 3, '退化成单一模型');
    assert.ok(t.costFen > prev, '成本应随档位严格递增');
    prev = t.costFen;
  }
});

test('【不亏损铁底】每个会员×其可用档位，EP_PRICE实付价≥裸成本×2', () => {
  for (const lv of LEVELS) {
    for (const tid of TIERS) {
      if (!C.canUseTier(L.MemberLevel[lv], tid)) continue;
      const p = C.priceForTier(L.MemberLevel[lv], tid);
      assert.ok(p.chargedFen >= p.costFen * 2, `${lv}用${tid}亏本: 付${p.chargedFen} 裸成本${p.costFen}`);
      assert.ok(p.ok);
    }
  }
});

test('会员等级越高默认引擎越强；专业默认旗舰', () => {
  const rank = { economy: 0, standard: 1, flagship: 2 };
  let prev = -1;
  for (const lv of LEVELS) {
    const d = C.defaultTierForLevel(L.MemberLevel[lv]);
    assert.ok(rank[d] >= prev); prev = rank[d];
  }
  assert.strictEqual(C.defaultTierForLevel(L.MemberLevel.PRO), 'flagship');
});

test('引擎按会员等级逐级解锁（v1.32：高级即可用旗舰，基础不可）', () => {
  assert.strictEqual(C.canUseTier(L.MemberLevel.FREE, 'standard'), false);
  assert.strictEqual(C.canUseTier(L.MemberLevel.BASIC, 'flagship'), false);
  assert.strictEqual(C.canUseTier(L.MemberLevel.ADVANCED, 'flagship'), true);
  assert.strictEqual(C.canUseTier(L.MemberLevel.PRO, 'flagship'), true);
  assert.strictEqual(C.canUseTier(L.MemberLevel.BASIC, 'economy'), true);
});

test('旗舰档全国产顶配（v2.54：原海外组合迁移到 OVERSEAS，FLAGSHIP 不含 GPT-5/Claude/Gemini）', () => {
  const flag = C.buildTiers().find((x) => x.id === 'flagship');
  const ids = flag.picks.map((p) => p.modelId);
  assert.ok(!ids.includes('gpt_5flag') && !ids.includes('claude_sonnet5') && !ids.includes('gemini_3pro'),
    '旗舰档已全国产化，不应含海外模型');
  assert.ok(ids.includes('deepseek_v4pro') && ids.includes('doubao_seed2pro'),
    '旗舰档应含 DeepSeek-V4-Pro + 豆包 Seed2.1-Pro（国产顶配）');
  assert.ok(!ids.some((id) => id.includes('opus')), 'Opus 每集会击穿铁底，不应进每集组合');
  const p = C.priceForTier(L.MemberLevel.PRO, 'flagship');
  assert.ok(p.chargedFen >= p.costFen * 2);
  assert.ok(p.margin >= 0.5, `专业旗舰毛利偏低 ${p.margin}`);
});

test('海外档异构最强（v2.54 预留：GPT-5+Claude Sonnet5+DeepSeek-V4+豆包Seed2.1），EP_PRICE 未列→拒售', () => {
  const ovs = C.buildTiers().find((x) => x.id === 'overseas');
  assert.ok(ovs, '海外档必须存在（预留）');
  const ids = ovs.picks.map((p) => p.modelId);
  assert.ok(ids.includes('gpt_5flag') && ids.includes('claude_sonnet5') && ids.includes('deepseek_v4pro') && ids.includes('doubao_seed2pro'),
    '海外档应含 GPT-5 + Claude Sonnet5 + DeepSeek-V4-Pro + 豆包 Seed2.1-Pro');
  // EP_PRICE 未列 OVERSEAS → priceForTier 返回 chargedFen=0 + margin=-1 + ok=false（自然拒售，无需额外守卫代码）
  const p = C.priceForTier(L.MemberLevel.PRO, 'overseas');
  assert.ok(!p.ok, '海外档预留期：EP_PRICE 未列 OVERSEAS，必须拒售');
  assert.strictEqual(p.chargedFen, 0, 'EP_PRICE 未列 OVERSEAS → 实付价应为 0');
  assert.strictEqual(p.margin, -1, '未定价档位 margin 应为 -1（拒售标记）');
});

test('LOCAL零成本；图片模型≥8家含GPT-image；文本模型都带BaseUrl；组合建议覆盖8岗', () => {
  assert.strictEqual(C.findModel('LOCAL'), undefined);
  assert.strictEqual(C.estimateComboCostFen([{ role: 'writer', modelId: 'LOCAL', backupIds: [] }]), 0);
  assert.ok(C.IMAGE_MODELS.length >= 8 && C.IMAGE_MODELS.some((m) => m.id === 'gpt_image'));
  C.TEXT_MODELS.forEach((m) => assert.ok(/^https?:\/\//.test(m.defaultBaseUrl)));
  const adv = C.portfolioAdvice();
  assert.strictEqual(adv.length, 8);
  adv.forEach((a) => assert.ok(a.primary && a.rule));
});

// v2.506 守卫：已退出型号不得残留在用户可见文案（豆包 Seed 2.0 已退出方舟，目录/采购单均为 2.1-Pro）
test('用户可见文案不残留已退出型号「豆包 Seed 2.0」，旗舰档描述与在售型号一致', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ROOT = path.join(__dirname, '..');
  const bad = /豆包\s*Seed\s*2\.0|Seed2\.0-Pro|Seed 2\.0 Pro/;
  for (const f of ['src/config/model-catalog.ts', 'src/routes/admin-model.ts']) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const hit = text.split('\n').findIndex((l) => bad.test(l));
    assert.strictEqual(hit, -1, `${f} 第 ${hit + 1} 行仍残留已退出型号「豆包 Seed 2.0」，会误导采购（应写 2.1-Pro）`);
  }
  const flag = C.buildTiers().find((t) => t.id === 'flagship');
  assert.ok(/2\.1/.test(flag.desc), '旗舰档描述应写当前在售的豆包 Seed 2.1');
  assert.ok(flag.picks.some((p) => p.modelId === 'doubao_seed2pro'));
});

// v2.507 双源守卫：采购文档「官网现价」与 catalog 必须同源，避免文档改了代码没跟（或反之）导致买错/算错账
test('API-KEY 申请清单的官网价目与 catalog 一致，基准日同源', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ROOT = path.join(__dirname, '..');
  const doc = fs.readFileSync(path.join(ROOT, 'docs/API-KEY-申请清单.md'), 'utf8');
  const R = require('../dist/config/model-review.js');
  assert.ok(doc.includes(R.CATALOG_PRICING_AS_OF), '文档必须标注与代码同源的基准日（CATALOG_PRICING_AS_OF）');

  // 只校验可机读的「**输入 / 输出**」行；峰谷价/按张计费等自由文本行由下方单独守
  const rows = [
    { prefix: 'Doubao-Seed-2.1-pro', id: 'doubao_seed2pro' },
    { prefix: 'Kimi K3', id: 'kimi_k3' },
    { prefix: 'Qwen3.8-Max', id: 'qwen38max' },
    { prefix: 'MiniMax-M3', id: 'minimax_m25' },
  ];
  let checked = 0;
  for (const line of doc.split('\n')) {
    const cells = line.split('|').map((s) => s.trim());
    if (cells.length < 5) continue;
    const row = rows.find((r) => cells[1].startsWith(r.prefix));
    if (!row) continue;
    const m = cells[3].match(/\*\*([\d.]+)\s*\/\s*([\d.]+)\*\*/);
    if (!m) continue; // 非价目行（如采购建议表）不参与数值对拍
    const model = C.findModel(row.id);
    assert.strictEqual(Number(m[1]), model.inYuanPerMTok, `${row.prefix} 输入价与 catalog 漂移（文档 ${m[1]} vs 代码 ${model.inYuanPerMTok}）`);
    assert.strictEqual(Number(m[2]), model.outYuanPerMTok, `${row.prefix} 输出价与 catalog 漂移（文档 ${m[2]} vs 代码 ${model.outYuanPerMTok}）`);
    checked++;
  }
  assert.strictEqual(checked, rows.length, `应有 ${rows.length} 个文本模型价目可对拍，实际 ${checked} 个`);

  // 图片按张计费：文档价必须与 catalog 备注同值
  assert.match(doc, /0\.22/);
  assert.match(doc, /0\.30/);
  assert.match(C.findModel('seedream').note, /0\.22/, 'Seedream 5.0-lite 备注应含 0.22 元/张');
  assert.match(C.findModel('seedream_pro').note, /0\.30/, 'Seedream 5.0-pro 备注应含 0.30 元/张');
});

// v2.507 守卫：超管 FAQ 的价目月份必须由基准日派生，禁止再次硬编码（历史坑：代码改价、FAQ 仍写旧月份）
test('超管组合全景 FAQ 价目月份与 CATALOG_PRICING_AS_OF 同源', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/routes/admin-model.ts'), 'utf8');
  assert.match(src, /CATALOG_PRICING_AS_OF\.slice\(0,\s*7\)/, 'FAQ 价目月份应从 CATALOG_PRICING_AS_OF 派生');
  assert.ok(!/带出\s*20\d\d-\d\d\s*公开价/.test(src), 'FAQ 不应再硬编码价目月份');
});

// v2.507 组合自检补全：图片位国产兜底 + ×2 铁底，避免"文本岗全绿、海报断供/卖一集亏一集"漏检
test('imageFallbackCheck：当前图片组合完整，缺国产旗舰/标准位能被抓出', () => {
  assert.deepStrictEqual(C.imageFallbackCheck(), [], '当前目录图片位应完整');
  const noFlag = C.imageFallbackCheck(C.IMAGE_MODELS.filter((m) => m.id !== 'seedream_pro'));
  assert.ok(noFlag.some((i) => /国产旗舰替补/.test(i.problem)), '删掉国产旗舰图应报缺替补');
  const overseasOnly = C.imageFallbackCheck(C.IMAGE_MODELS.filter((m) => m.region === 'overseas'));
  assert.ok(overseasOnly.some((i) => /标准海报缺国产/.test(i.problem)), '只剩海外图应报标准位缺国产');
  assert.ok(overseasOnly.some((i) => /走量海报缺国产/.test(i.problem)), '只剩海外图应报经济位缺国产');
});

test('pricingFloorCheck：当前三档全部过×2铁底，注入虚高成本能被抓出', () => {
  assert.deepStrictEqual(C.pricingFloorCheck(), [], '当前定价应全部满足售价≥成本×2');
  const base = C.buildTiers()[0];
  const bad = [{ ...base, costFen: 999999 }];
  const issues = C.pricingFloorCheck(bad);
  assert.ok(issues.length > 0);
  assert.match(issues[0].problem, /违反不赔钱铁底/);
});
