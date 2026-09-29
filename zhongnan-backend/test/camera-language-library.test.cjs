const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  CAMERA_STYLES, resolveCameraStyle, buildCameraStylePrompt,
  recommendCameraStyle, listCameraStyles, isValidCameraStyleId,
} = require('../dist/engine/camera-language-library.js');
const { buildScriptDoc } = require('../dist/lib/script-doc.js');

describe('camera-language-library 库完整性', () => {
  it('12 个镜头语言族系，编号 CL01~CL12 格式合法且唯一', () => {
    assert.strictEqual(CAMERA_STYLES.length, 12);
    const ids = CAMERA_STYLES.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, 12);
    ids.forEach((id) => assert.match(id, /^CL\d{2}$/));
  });
  it('每个节点五要素齐全：中文名/英文prompt段/中文镜头语法/镜头关键词/使用建议', () => {
    for (const s of CAMERA_STYLES) {
      assert.ok(s.label && s.label.length >= 2, `${s.id} label 缺失`);
      assert.ok(s.enPrompt && s.enPrompt.length >= 40, `${s.id} enPrompt 过短`);
      assert.ok(s.grammar && s.grammar.length >= 8, `${s.id} grammar（镜头语法）缺失`);
      assert.ok(Array.isArray(s.keywords) && s.keywords.length >= 2, `${s.id} keywords 不足`);
      assert.ok(s.note && s.note.length >= 6, `${s.id} note 缺失`);
      // 适配/禁配题材 id 必须落在已知的 11 流派体系内，防手滑写错
      const VALID_GENRES = new Set(['rebirth', 'mindRead', 'farming', 'invincible', 'lowProfile', 'cutTies', 'cutLover', 'saneMadman', 'tragedyTurn', 'system', 'metaDrama']);
      [...s.suitedGenres, ...s.bannedGenres].forEach((g) => assert.ok(VALID_GENRES.has(g), `${s.id} 未知题材id: ${g}`));
    }
  });
  it('11 题材全部至少有一个适配的镜头语言（防题材悬空无推荐）', () => {
    const VALID_GENRES = ['rebirth', 'mindRead', 'farming', 'invincible', 'lowProfile', 'cutTies', 'cutLover', 'saneMadman', 'tragedyTurn', 'system', 'metaDrama'];
    for (const g of VALID_GENRES) {
      const best = recommendCameraStyle([g])[0];
      assert.ok(best.suitedGenres.includes(g), `题材 ${g} 没有任何适配镜头语言（首推 ${best.id} 未命中）`);
    }
  });
});

describe('resolveCameraStyle / buildCameraStylePrompt', () => {
  it('合法编号返回节点；非法返回 null/空串（调用方静默兜底）', () => {
    const s = resolveCameraStyle('CL01');
    assert.ok(s && s.label === '快切直给爽点流');
    assert.strictEqual(resolveCameraStyle('CL99'), null);
    assert.strictEqual(resolveCameraStyle(''), null);
    assert.strictEqual(buildCameraStylePrompt('CL99'), '');
  });
  it('prompt 段含镜头语言描述与全镜头统一约束后缀', () => {
    const p = buildCameraStylePrompt('CL01');
    assert.ok(p.includes('rapid cutting rhythm'));
    assert.ok(p.includes('Consistent camera language across all shots'));
  });
  it('isValidCameraStyleId 类型与库内校验', () => {
    assert.strictEqual(isValidCameraStyleId('CL01'), true);
    assert.strictEqual(isValidCameraStyleId('cl01'), false);  // 大小写敏感，防脏数据
    assert.strictEqual(isValidCameraStyleId(null), false);
    assert.strictEqual(isValidCameraStyleId(1), false);
  });
});

describe('recommendCameraStyle 题材推荐', () => {
  it('种田基建 → 慢摇治愈长镜置顶，快切爽点流沉底', () => {
    const r = recommendCameraStyle(['farming']).map((s) => s.id);
    assert.strictEqual(r[0], 'CL08');
    assert.ok(r.indexOf('CL08') < r.indexOf('CL01'), '慢摇治愈应高于快切爽点');
  });
  it('悲剧黑化 → 长镜压迫置顶；元叙事禁配长镜压迫', () => {
    const r = recommendCameraStyle(['tragedyTurn']).map((s) => s.id);
    assert.strictEqual(r[0], 'CL02');
    const meta = recommendCameraStyle(['metaDrama']).map((s) => s.id);
    assert.ok(meta.indexOf('CL02') >= Math.floor(meta.length / 2), '元叙事下长镜压迫应沉入后半段');
    assert.ok(meta.indexOf('CL07') < meta.indexOf('CL02'), '元叙事推荐跳切喜剧高于长镜压迫');
  });
  it('多题材取并集打分；空题材按库序原样返回', () => {
    const r = recommendCameraStyle(['cutTies', 'saneMadman']).map((s) => s.id);
    assert.ok(r.indexOf('CL12') < r.indexOf('CL07') || r.indexOf('CL01') < r.indexOf('CL07'), '双题材命中的节点应高于无命中节点');
    const empty = recommendCameraStyle([]);
    assert.strictEqual(empty.length, 12);
    assert.strictEqual(empty[0].id, 'CL01');
  });
});

describe('script-doc 分镜附录镜头语言锚点注入', () => {
  const aigcProject = (bible) => ({
    title: '测试漫剧', mode: 'tags', format: 'AIGC', totalEps: 1, bible,
  });
  const scripts = [{ epNo: 1, title: '一', content: '场景一 内景 餐厅\n林晚攥紧了筷子。\n“这婚，我不结了。”', wordCount: 30 }];
  const text = (d) => d.blocks.map((b) => JSON.stringify(b)).join('');

  it('bible 存有合法镜头语言编号 → 附录注入镜头锚点（编号/中文名/镜头语法/英文prompt段/统一约束）', () => {
    const d = buildScriptDoc(aigcProject({ cameraStyleId: 'CL01' }), scripts, { level: 'BASIC' });
    const t = text(d);
    assert.ok(t.includes('镜头语言锚点 CL01 · 快切直给爽点流'));
    assert.ok(t.includes('镜头语法'));
    assert.ok(t.includes('rapid cutting rhythm'));
    assert.ok(t.includes('禁止逐镜漂移'));
  });
  it('非法编号/缺 bible/老项目 → 静默不注入，导出零影响', () => {
    const bad = buildScriptDoc(aigcProject({ cameraStyleId: 'CL99' }), scripts, { level: 'BASIC' });
    assert.ok(!text(bad).includes('镜头语言锚点'));
    const none = buildScriptDoc(aigcProject(undefined), scripts, { level: 'BASIC' });
    assert.ok(!text(none).includes('镜头语言锚点'));
  });
  it('opts.cameraStyleId 优先于 bible（显式导出参数覆盖）', () => {
    const d = buildScriptDoc(aigcProject({ cameraStyleId: 'CL01' }), scripts, { level: 'BASIC', cameraStyleId: 'CL02' });
    const t = text(d);
    assert.ok(t.includes('镜头语言锚点 CL02'));
    assert.ok(!t.includes('CL01'));
  });
  it('画风锚点与镜头锚点可同时注入（三库家族并行，互不替代）', () => {
    const d = buildScriptDoc(aigcProject({ visualStyleId: 'VS02', cameraStyleId: 'CL01' }), scripts, { level: 'BASIC' });
    const t = text(d);
    assert.ok(t.includes('画风锚点 VS02'));
    assert.ok(t.includes('镜头语言锚点 CL01'));
  });
  it('LIVE 项目即使 bible 带镜头语言编号也不注入（镜头锚点仅 AIGC 附录）', () => {
    const d = buildScriptDoc({ title: '真人剧', mode: 'tags', format: 'LIVE_ACTION', bible: { cameraStyleId: 'CL01' } }, scripts, { level: 'BASIC' });
    assert.ok(!text(d).includes('镜头语言锚点'));
  });
});

describe('listCameraStyles 契约', () => {
  it('返回全量 12 项且与库同引用序', () => {
    assert.strictEqual(listCameraStyles().length, 12);
    assert.deepStrictEqual(listCameraStyles().map((s) => s.id), CAMERA_STYLES.map((s) => s.id));
  });
});
