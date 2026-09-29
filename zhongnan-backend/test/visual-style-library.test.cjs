const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  VISUAL_STYLES, resolveVisualStyle, buildVisualStylePrompt,
  recommendVisualStyle, listVisualStyles, isValidVisualStyleId,
} = require('../dist/engine/visual-style-library.js');
const { buildScriptDoc } = require('../dist/lib/script-doc.js');

describe('visual-style-library 库完整性', () => {
  it('12 个画风族系，编号 VS01~VS12 格式合法且唯一', () => {
    assert.strictEqual(VISUAL_STYLES.length, 12);
    const ids = VISUAL_STYLES.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, 12);
    ids.forEach((id) => assert.match(id, /^VS\d{2}$/));
  });
  it('每个节点四要素齐全：中文名/英文prompt段/质感关键词/使用建议', () => {
    for (const s of VISUAL_STYLES) {
      assert.ok(s.label && s.label.length >= 2, `${s.id} label 缺失`);
      assert.ok(s.enPrompt && s.enPrompt.length >= 40, `${s.id} enPrompt 过短`);
      assert.ok(Array.isArray(s.keywords) && s.keywords.length >= 2, `${s.id} keywords 不足`);
      assert.ok(s.note && s.note.length >= 6, `${s.id} note 缺失`);
      // 适配/禁配题材 id 必须落在已知的 11 流派体系内，防手滑写错
      const VALID_GENRES = new Set(['rebirth', 'mindRead', 'farming', 'invincible', 'lowProfile', 'cutTies', 'cutLover', 'saneMadman', 'tragedyTurn', 'system', 'metaDrama']);
      [...s.suitedGenres, ...s.bannedGenres].forEach((g) => assert.ok(VALID_GENRES.has(g), `${s.id} 未知题材id: ${g}`));
    }
  });
});

describe('resolveVisualStyle / buildVisualStylePrompt', () => {
  it('合法编号返回节点；非法返回 null/空串（调用方静默兜底）', () => {
    const s = resolveVisualStyle('VS02');
    assert.ok(s && s.label === '韩漫厚涂');
    assert.strictEqual(resolveVisualStyle('VS99'), null);
    assert.strictEqual(resolveVisualStyle(''), null);
    assert.strictEqual(buildVisualStylePrompt('VS99'), '');
  });
  it('prompt 段含画风描述与全镜头统一约束后缀', () => {
    const p = buildVisualStylePrompt('VS02');
    assert.ok(p.includes('Korean webtoon'));
    assert.ok(p.includes('Consistent art style across all shots'));
  });
  it('isValidVisualStyleId 类型与库内校验', () => {
    assert.strictEqual(isValidVisualStyleId('VS01'), true);
    assert.strictEqual(isValidVisualStyleId('vs01'), false);  // 大小写敏感，防脏数据
    assert.strictEqual(isValidVisualStyleId(null), false);
    assert.strictEqual(isValidVisualStyleId(1), false);
  });
});

describe('recommendVisualStyle 题材推荐', () => {
  it('种田基建 → 绘本蜡笔/水彩淡彩置顶，禁配的韩漫厚涂沉底', () => {
    const r = recommendVisualStyle(['farming']).map((s) => s.id);
    assert.ok(['VS04', 'VS09'].includes(r[0]));
    assert.ok(r.indexOf('VS04') < r.indexOf('VS02'));
  });
  it('悲剧黑化 → 哥特线稿置顶；发疯流禁配哥特', () => {
    const r = recommendVisualStyle(['tragedyTurn']).map((s) => s.id);
    assert.strictEqual(r[0], 'VS08');
    const mad = recommendVisualStyle(['saneMadman']).map((s) => s.id);
    assert.ok(mad.indexOf('VS08') >= Math.floor(mad.length / 2), '发疯流下哥特应沉入后半段');
    assert.ok(mad.indexOf('VS05') < mad.indexOf('VS08'), '发疯流推荐美漫硬朗高于哥特');
  });
  it('多题材取并集打分；空题材按库序原样返回', () => {
    const r = recommendVisualStyle(['tragedyTurn', 'cutTies']).map((s) => s.id);
    assert.ok(r.indexOf('VS02') < r.indexOf('VS01'), '双题材命中的韩漫厚涂应高于无命中的水墨');
    const empty = recommendVisualStyle([]);
    assert.strictEqual(empty.length, 12);
    assert.strictEqual(empty[0].id, 'VS01');
  });
});

describe('script-doc 分镜附录画风锚点注入', () => {
  const aigcProject = (bible) => ({
    title: '测试漫剧', mode: 'tags', format: 'AIGC', totalEps: 1, bible,
  });
  const scripts = [{ epNo: 1, title: '一', content: '场景一 内景 餐厅\n林晚攥紧了筷子。\n“这婚，我不结了。”', wordCount: 30 }];
  const text = (d) => d.blocks.map((b) => JSON.stringify(b)).join('');

  it('bible 存有合法画风编号 → 附录注入画风锚点（编号/中文名/英文prompt段/统一约束）', () => {
    const d = buildScriptDoc(aigcProject({ visualStyleId: 'VS02' }), scripts, { level: 'BASIC' });
    const t = text(d);
    assert.ok(t.includes('画风锚点 VS02 · 韩漫厚涂'));
    assert.ok(t.includes('Korean webtoon'));
    assert.ok(t.includes('Consistent art style across all shots'));
    assert.ok(t.includes('禁止逐镜漂移'));
  });
  it('非法编号/缺 bible/老项目 → 静默不注入，导出零影响', () => {
    const bad = buildScriptDoc(aigcProject({ visualStyleId: 'VS99' }), scripts, { level: 'BASIC' });
    assert.ok(!text(bad).includes('画风锚点'));
    const none = buildScriptDoc(aigcProject(undefined), scripts, { level: 'BASIC' });
    assert.ok(!text(none).includes('画风锚点'));
  });
  it('opts.visualStyleId 优先于 bible（显式导出参数覆盖）', () => {
    const d = buildScriptDoc(aigcProject({ visualStyleId: 'VS02' }), scripts, { level: 'BASIC', visualStyleId: 'VS08' });
    const t = text(d);
    assert.ok(t.includes('画风锚点 VS08'));
    assert.ok(!t.includes('VS02'));
  });
  it('LIVE 项目即使 bible 带画风编号也不注入（画风锚点仅 AIGC 附录）', () => {
    const d = buildScriptDoc({ title: '真人剧', mode: 'tags', format: 'LIVE_ACTION', bible: { visualStyleId: 'VS02' } }, scripts, { level: 'BASIC' });
    assert.ok(!text(d).includes('画风锚点'));
  });
});

describe('listVisualStyles 契约', () => {
  it('返回全量 12 项且与库同引用序', () => {
    assert.strictEqual(listVisualStyles().length, 12);
    assert.deepStrictEqual(listVisualStyles().map((s) => s.id), VISUAL_STYLES.map((s) => s.id));
  });
});
