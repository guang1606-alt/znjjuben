const { describe, it } = require('node:test');
const assert = require('node:assert');
const mp = require('../dist/lib/model-proxy.js');
mp.__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
const { runEpisode } = require('../dist/agents/pipeline.js');
const { EngineTier } = require('../dist/config/pricing.js');

function stub() { const cap = []; mp.callText = async (t, r, p) => { cap.push({ r, p }); return { text: '', sandbox: true, costFen: 0 }; }; mp.callJson = mp.callText; return cap; }
const bible = () => ({ worldview: '', characters: {}, timeline: [], foreshadow: [] });
const arch = (cap) => cap.find((x) => x.r === 'architect').p;
const writer = (cap) => cap.find((x) => x.r === 'writer').p;

describe('v2.18 管线双制式字数闭环与风格扫描接线', () => {
  it('结果携带 lengthPlan；AIGC 制式目标区间 1200-1500，架构师/撰写岗均收到制式指令', async () => {
    const cap = stub();
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC' });
    assert.ok(r.lengthPlan);
    assert.deepStrictEqual(r.lengthPlan.range, [1200, 1500]);
    const arch = cap.find((x) => x.r === 'architect').p;
    const wr = cap.find((x) => x.r === 'writer').p;
    assert.ok(arch.includes('1200-1500') && wr.includes('1200-1500'));
    // v2.35 AIGC 结果携带容量规划与逐场曲线；LIVE 为 null
    assert.ok(r.aigcVolumePlan && Array.isArray(r.aigcCurve) && r.aigcManifest);
    const r2 = await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC', aigcDurationMin: 2 });
    assert.deepStrictEqual(r2.lengthPlan.range, [2400, 3000]);
    assert.deepStrictEqual(r2.format.range, [2400, 3000]);
  });
  it('中文命中风格时返回 styleCheck；英文链路不注入中文风格画像且 7+ 岗零中文', async () => {
    let cap = stub();
    const zh = await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠追妻', () => {}, { style: '都市情感', episodeCount: 1, episodeIndex: 0, lang: 'zh' });
    assert.ok(zh.styleCheck && typeof zh.styleCheck.score === 'number');
    cap = stub();
    const en = await runEpisode(EngineTier.STANDARD, bible(), 'a xianxia cultivation story', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'en' });
    assert.strictEqual(en.styleCheck, null);
    const cjk = /[一-鿿]/;
    assert.strictEqual(cap.filter((x) => cjk.test(x.p)).length, 0);
  });
  it('v2.37 人物策略指令注入架构师/人设师/撰写师三岗', async () => {
    const cap = stub();
    await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', characterStrategy: 'bond_dynamic' });
    ['architect', 'designer', 'writer'].forEach((role) => {
      const p = cap.find((x) => x.r === role).p;
      assert.ok(p.includes('人物与关系策略：关系拉扯'), `${role} 应收到人物策略指令`);
    });
  });
  it('v2.327 历史 mature_x 归一为 film 后仍可生成；成年内容红线由授权层 + mode-craft 护栏承担（不再产出 matureScreen）', async () => {
    stub();
    const mature = await runEpisode(EngineTier.STANDARD, bible(), '黑暗犯罪悬疑', () => {}, { mode: 'mature_x', episodeCount: 1, episodeIndex: 0, lang: 'zh' });
    assert.ok(mature && mature.draft, '历史成年向 raw 模式归一后应能正常出稿');
    assert.strictEqual(mature.matureScreen, undefined, 'matureScreen 已随 v2.325 移除，改由授权层拦截');
    const normal = await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { mode: 'tag', episodeCount: 1, episodeIndex: 0, lang: 'zh' });
    assert.strictEqual(normal.matureScreen, undefined);
  });
  it('v2.88 film 三幕定位随 episodeIndex/episodeCount 注入架构师/撰写岗（totalEps 字段错配回归）', async () => {
    // 48 片段第 24 段（0 基 23）= 第二幕中点反转：指令必须真正到达 architect 与 writer
    const cap = stub();
    await runEpisode(EngineTier.STANDARD, bible(), '一桩尘封二十年的灭门悬案', () => {}, { mode: 'film', episodeCount: 48, episodeIndex: 23, lang: 'zh' });
    assert.ok(arch(cap).includes('片段 24/48') && arch(cap).includes('第二幕') && arch(cap).includes('中点反转段'), '架构师应收到三幕定位');
    assert.ok(writer(cap).includes('片段 24/48') && writer(cap).includes('中点反转段'), '撰写岗应收到三幕定位');
    // 非 film 模式即使 episodeCount 达标也不注入
    const cap2 = stub();
    await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { mode: 'tag', episodeCount: 48, episodeIndex: 23, lang: 'zh' });
    assert.ok(!arch(cap2).includes('片段 24/48'), '非 film 模式不应注入三幕定位');
  });
});

// —— c223 请求级反套路档位透传：路由 schema 补入口（此前三层支持但无 API 入口，请求永远 balanced）——
describe('c223 反套路档位请求级透传', () => {
  it('runEpisode 接受 antiStrength 并在 _profile 原值返回；缺省回退 balanced', async () => {
    stub();
    const inno = await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', antiStrength: 'innovative' });
    assert.strictEqual(inno._profile.antiStrength, 'innovative', '显式档位必须原值进 _profile（落库与 /fix 同档重放的事实源）');
    const def = await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh' });
    assert.strictEqual(def._profile.antiStrength, 'balanced', '缺省回退 pipeline 默认档');
    assert.ok(['low', 'mid', 'high'].includes(def._profile.colloquialLevel), 'colloquialLevel 随 _profile 一并落库');
  });
});
