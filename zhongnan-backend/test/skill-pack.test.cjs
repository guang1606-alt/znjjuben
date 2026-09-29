const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildBuiltinSkillPack, serializeBuiltinSkillPack, auditSkillPack, buildSkillMarkdown, buildSkillBundle, SKILL_NAME } = require('../dist/engine/skill-pack.js');

describe('v2.19 创作技能封装包（升级自动同步、跨窗口可调用）', () => {
  it('21套引擎全部装包、每套10装置且中英字段完整，健康自检零问题', () => {
    const p = buildBuiltinSkillPack('2.30.0');
    assert.strictEqual(p.engines.length, 21);
    assert.strictEqual(p.summary.devices, 210);
    assert.ok(p.engines.every((e) => e.deviceCount === 10));
    const audit = auditSkillPack(p);
    assert.deepStrictEqual(audit.problems, []);
    assert.strictEqual(audit.ok, true);
  });
  it('钩子四层齐全（开篇/集尾/场钩/微钩）、节拍三类26、双制式区间刚性', () => {
    const p = buildBuiltinSkillPack();
    const layers = new Set(p.hooks.map((h) => h.layer));
    assert.deepStrictEqual([...layers].sort(), ['episode', 'micro', 'open', 'scene']);
    assert.strictEqual(p.hooks.length, 29);
    assert.deepStrictEqual(p.beats.map((b) => b.count), [8, 10, 8]);
    assert.deepStrictEqual(p.scriptFormats.LIVE.cjkRange, [800, 1000]);
    assert.deepStrictEqual(p.scriptFormats.AIGC.cjkRange, [1200, 1500]);
  });
  it('序列化后可被任意窗口 JSON.parse 还原并调用方法知识；不含密钥/成本字段', () => {
    const raw = serializeBuiltinSkillPack('2.19.0');
    const p = JSON.parse(raw);
    const xuan = p.engines.find((e) => e.id === 'xuanhuan');
    assert.ok(xuan && xuan.devices[0].techniqueEn && xuan.devices[0].principle);
    // 结构上不含密钥/成本类字段（英文创作文本里出现 secret 等普通词不算泄漏）
    const walk = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { assert.ok(!/apiKey|baseUrl|costFen|secretKey|单价|密钥/.test(k), `敏感字段 ${k}`); walk(o[k]); } };
    walk(p);
    assert.ok(p.hardLines.length >= 6);
  });
  it('装置缺字段时自检能抓到（防“注册了但没装技能”）', () => {
    const p = buildBuiltinSkillPack();
    p.engines[0].devices[0].techniqueEn = '';
    const audit = auditSkillPack(p);
    assert.strictEqual(audit.ok, false);
    assert.ok(audit.problems[0].includes('缺字段'));
  });
});

describe('v2.19 标准 SKILL.md 与技能目录封装', () => {
  it('SKILL.md 含合法 YAML frontmatter（name/description/version）与可执行流程', () => {
    const md = buildSkillMarkdown(buildBuiltinSkillPack('2.19.0'));
    assert.ok(md.startsWith('---\nname: ' + SKILL_NAME));
    assert.ok(/description: .+/.test(md));
    assert.ok(md.includes('## 创作总流程') && md.includes('## 输出与自检清单'));
    assert.ok(md.includes('800-1000') && md.includes('1200-1500'));
  });
  it('buildSkillBundle 落盘即为完整 Skill：SKILL.md + 7 references + 机器可读 JSON', () => {
    const b = buildSkillBundle(buildBuiltinSkillPack('2.20.0'));
    const keys = Object.keys(b).sort();
    assert.deepStrictEqual(keys, ['SKILL.md', 'references/01-devices.md', 'references/02-hooks.md', 'references/03-beats.md', 'references/04-formats.md', 'references/05-unified-spec.md', 'references/06-evolution.md', 'references/07-aigc-exemplar.md', 'references/craft-pack.json'].sort());
    assert.ok(b['references/01-devices.md'].includes('210 装置'));
    assert.ok(b['references/02-hooks.md'].includes('四层结构'));
    JSON.parse(b['references/craft-pack.json']); // 机器可读副本可解析
  });
});

describe('v2.20 统一规范 + 进化反封闭协议入包', () => {
  it('SKILL.md 含四层钩子、统一规范与反自我封闭铁律', () => {
    const md = buildSkillMarkdown(buildBuiltinSkillPack('2.20.0'));
    assert.ok(md.includes('四层钩子') && md.includes('反自我封闭'));
    assert.ok(md.includes('外部校准') && md.includes('强制差异化'));
  });
  it('05 统一规范含四阶段/六维评分/语言与个性化；06 进化协议含输入-闸门-反封闭', () => {
    const b = buildSkillBundle(buildBuiltinSkillPack('2.20.0'));
    const spec = b['references/05-unified-spec.md'], evo = b['references/06-evolution.md'];
    ['梗概大纲', '初稿剧本', '润色优化', '精修定稿'].forEach((s) => assert.ok(spec.includes(s)));
    ['人物', '剧情', '台词', '市场', '格式', '去AI化'].forEach((d) => assert.ok(spec.includes(d)));
    assert.ok(evo.includes('知识输入') && evo.includes('生效闸门') && evo.includes('反封闭铁律'));
    assert.ok(evo.includes('缺市场校准'));
  });
  it('07 AIGC 黄金样例过格式闸门（1200-1500、零提示词污染）', () => {
    const { validateScript } = require('../dist/engine/script-format.js');
    const b = buildSkillBundle(buildBuiltinSkillPack('2.20.0'));
    const body = b['references/07-aigc-exemplar.md'].split('\n\n').slice(1).join('\n\n');
    const rep = validateScript(body, 'AIGC');
    assert.ok(rep.inRange && rep.pollution.length === 0, JSON.stringify(rep));
  });
});
