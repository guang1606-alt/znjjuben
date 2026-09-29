const { describe, it } = require('node:test');
const assert = require('node:assert');
const { canExport, canRemoveWatermark, buildScriptDoc, paginate } = require('../dist/lib/script-doc.js');

const project = {
  title: '测试剧', mode: 'tags', format: 'LIVE_ACTION', totalEps: 2,
  bible: {
    worldview: '现代都市',
    timeline: ['落魄继承人凭一道祖传菜谱逆袭'],
    foreshadow: ['神秘食客身份'],
    characters: { 林晚: { traits: '隐忍/要强', arc: '从退让到反击', voice: '短句、带刺' } },
  },
};
const scripts = [
  { epNo: 1, title: '开局受辱', synopsis: '她被当众退婚', content: '场景一 内景 餐厅\n林晚攥紧了筷子。\n“这婚，我不结了。”', wordCount: 30 },
  { epNo: 2, title: '初次反击', synopsis: '一道菜惊艳全场', content: '场景一 内景 后厨\n她掂起炒锅，火苗腾起。', wordCount: 28 },
];

describe('导出会员门控', () => {
  it('txt 登录即可；docx 需 BASIC+；pdf 需 ADVANCED+', () => {
    assert.strictEqual(canExport('FREE', 'txt'), true);
    assert.strictEqual(canExport('FREE', 'docx'), false);
    assert.strictEqual(canExport('FREE', 'pdf'), false);
    assert.strictEqual(canExport('BASIC', 'docx'), true);
    assert.strictEqual(canExport('BASIC', 'pdf'), false);
    assert.strictEqual(canExport('ADVANCED', 'pdf'), true);
    assert.strictEqual(canExport('PRO', 'pdf'), true);
  });
  it('去水印仅 ADVANCED+', () => {
    assert.strictEqual(canRemoveWatermark('FREE'), false);
    assert.strictEqual(canRemoveWatermark('BASIC'), false);
    assert.strictEqual(canRemoveWatermark('ADVANCED'), true);
  });
});

describe('buildScriptDoc 文档结构', () => {
  it('含封面/故事大纲/人物小传/分集目录/完整分集', () => {
    const d = buildScriptDoc(project, scripts, { penName: '终南老杨', level: 'BASIC' });
    const kinds = d.blocks.map((b) => b.kind);
    assert.ok(kinds.includes('cover') && kinds.includes('h1') && kinds.includes('toc') && kinds.includes('epStart'));
    const text = d.blocks.map((b) => JSON.stringify(b)).join('');
    assert.ok(text.includes('故事大纲') && text.includes('人物小传') && text.includes('分集目录'));
    assert.ok(text.includes('林晚') && text.includes('成长弧线'));      // 人物小传
    const toc = d.blocks.find((b) => b.kind === 'toc');
    assert.strictEqual(toc.items.length, 2);                            // 目录两集
    assert.strictEqual(d.blocks.filter((b) => b.kind === 'epStart').length, 2);
    assert.ok(text.includes('这婚，我不结了'));                          // 完整正文
  });
  it('bible 缺失/老项目也不崩，给占位', () => {
    const d = buildScriptDoc({ title: '空项目' }, [{ epNo: 1, title: '一', content: '正文' }], { level: 'FREE' });
    const text = d.blocks.map((b) => JSON.stringify(b)).join('');
    assert.ok(text.includes('人物设定随创作过程沉淀'));
  });
  it('低等级强制水印；高等级 noWatermark 去水印', () => {
    const low = buildScriptDoc(project, scripts, { penName: '甲', level: 'FREE' });
    assert.ok(low.watermark && low.watermark.includes('终南集 · 人工通用智能（AGI）编剧大师') && low.watermark.includes('甲'));
    const high = buildScriptDoc(project, scripts, { penName: '甲', level: 'ADVANCED', noWatermark: true });
    assert.strictEqual(high.watermark, null);
    const highNoFlag = buildScriptDoc(project, scripts, { level: 'ADVANCED' });
    assert.ok(highNoFlag.watermark); // 高级但没要求去水印，仍带
  });
});

describe('paginate 固定行高分页', () => {
  it('按每页行数正确切页并编号', () => {
    const p1 = paginate(['a', 'b', 'c'], 2);
    assert.strictEqual(p1.length, 2);
    assert.deepStrictEqual(p1.map((x) => x.pageNo), [1, 2]);
    assert.strictEqual(p1[1].lines.length, 1);
    const p0 = paginate([], 5);
    assert.strictEqual(p0.length, 1); // 空内容也至少一页
  });
});

describe('v2.36 Z-AIGC 机器分镜附录', () => {
  const { buildSampleScript } = require('../dist/engine/sample-script.js');
  const aigcBody = buildSampleScript('AIGC');
  const aigcProj = { title: 'AIGC剧', format: 'AIGC' };
  const aigcScripts = [{ epNo: 1, title: '开局', content: aigcBody }];
  it('ADVANCED+ 导出逐镜分镜表与构成概览；LIVE 项目无附录', () => {
    const adv = buildScriptDoc(aigcProj, aigcScripts, { level: 'ADVANCED', includeShotList: true });
    assert.ok(adv.blocks.some((b) => b.kind === 'h1' && b.text.includes('机器分镜层')));
    assert.ok(adv.blocks.some((b) => b.text && b.text.startsWith('镜1（场1）') && b.text.includes('景别')));
    assert.ok(adv.blocks.some((b) => b.text && b.text.includes('构成概览') && b.text.includes('发声占比')));
    const live = buildScriptDoc({ title: '实拍', format: 'LIVE_ACTION' }, aigcScripts, { level: 'PRO' });
    assert.ok(!live.blocks.some((b) => b.text && b.text.includes('机器分镜层')));
  });
  it('FREE/BASIC 只给构成概览与升级提示，不泄露逐镜表', () => {
    const free = buildScriptDoc(aigcProj, aigcScripts, { level: 'FREE' });
    assert.ok(free.blocks.some((b) => b.text && b.text.includes('高级会员')));
    assert.ok(!free.blocks.some((b) => b.text && b.text.startsWith('镜1')));
  });
});

describe('v2.59 全剧情绪节奏·导演页', () => {
  it('目录后、正文前插入 waveChart，波形与管线同源且逐集齐全', () => {
    const d = buildScriptDoc(project, scripts, { level: 'BASIC' });
    const kinds = d.blocks.map((b) => b.kind);
    const tocIdx = kinds.indexOf('toc'); const waveIdx = kinds.indexOf('waveChart'); const epIdx = kinds.indexOf('epStart');
    assert.ok(tocIdx >= 0 && waveIdx > tocIdx && epIdx > waveIdx, '顺序：目录→波形→正文');
    const wb = d.blocks.find((b) => b.kind === 'waveChart');
    assert.strictEqual(wb.wave.points.length, 2);
    assert.strictEqual(wb.wave.lang, 'zh');
    assert.ok(wb.wave.textLines.length >= 3 && wb.wave.textLines[1].includes('张力曲线'));
    // 标题块存在
    assert.ok(d.blocks.some((b) => b.kind === 'h1' && b.text.includes('情绪节奏')));
  });
  it('英文正文 → 导演页英文', () => {
    const enScripts = scripts.map((s) => ({ ...s, content: 'INT. RESTAURANT - NIGHT\nShe puts down the chopsticks.' }));
    const d = buildScriptDoc({ title: 'EN', totalEps: 2 }, enScripts, { level: 'PRO' });
    const wb = d.blocks.find((b) => b.kind === 'waveChart');
    assert.strictEqual(wb.wave.lang, 'en');
    assert.ok(wb.wave.textLines[0].includes('eps'));
    assert.ok(d.blocks.some((b) => b.kind === 'h1' && b.text.includes('Emotion Rhythm')));
  });
  it('beatPrefs 经 bible 透传影响波形（定点可复现）', () => {
    const projWithPref = { title: '定点剧', totalEps: 4, bible: { beatPrefs: { mode: 'auto', strength: 'balanced', preferred: [], payoffFlavors: [], reversalFlavors: [], emotionFlavors: [], manual: { 30000: 'emo_hype', 30001: 'emo_hype', 30002: 'emo_hype' } } } };
    const ss = [1, 2, 3, 4].map((n) => ({ epNo: n, title: `E${n}`, content: `第${n}集 内景 街道 日 她抬头。` }));
    const d = buildScriptDoc(projWithPref, ss, { level: 'PRO' });
    const wb = d.blocks.find((b) => b.kind === 'waveChart');
    assert.strictEqual(wb.wave.points[0].intensity >= 80, true); // 首集三拍全高燃
  });
});

describe('v2.60 导演页主情绪标注与节奏体检', () => {
  const ss = [1, 2, 3, 4, 5, 6].map((n) => ({ epNo: n, title: `E${n}`, content: `第${n}集 内景 厨房 日 他颠勺。` }));
  it('逐集点带主导情绪短标、诊断行位于火花线前', () => {
    const d = buildScriptDoc({ title: '体检剧', totalEps: 6 }, ss, { level: 'PRO' });
    const wb = d.blocks.find((b) => b.kind === 'waveChart');
    assert.ok(wb.wave.points.every((p) => p.emoZh && p.emoEn), '每集都有中英主情绪短标');
    const texts = d.blocks.filter((b) => b.kind === 'p').map((b) => b.text);
    const diag = texts.findIndex((t) => t.includes('节奏结构'));
    const spark = texts.findIndex((t) => t.includes('张力曲线'));
    assert.ok(diag >= 0 && spark >= 0 && diag < spark, '诊断先于火花线');
  });
  it('英文项目诊断与短标均为英文', () => {
    const en = ss.map((x) => ({ ...x, content: 'INT. KITCHEN - DAY He flips the wok.' }));
    const d = buildScriptDoc({ title: 'EN6', totalEps: 6 }, en, { level: 'PRO' });
    const wb = d.blocks.find((b) => b.kind === 'waveChart');
    assert.ok(wb.wave.points.every((p) => !p.emoZh || /^[A-Za-z]+$/.test(p.emoEn)));
    const texts = d.blocks.filter((b) => b.kind === 'p').map((b) => b.text);
    assert.ok(texts.some((t) => /Rhythm: drive/.test(t) && !/[\u4e00-\u9fff]/.test(t)));
  });
});

describe('v2.61 逐集钩子地图编排页', () => {
  const ss = [1, 2, 3, 4].map((n) => ({ epNo: n, title: `E${n}`, content: `第${n}集 内景 天台 夜 他回头。` }));
  it('位置：情绪导演页之后、正文之前；逐集行齐全', () => {
    const d = buildScriptDoc({ title: '钩子剧', totalEps: 4 }, ss, { level: 'PRO' });
    const kinds = d.blocks.map((b) => b.kind);
    const waveIdx = kinds.indexOf('waveChart');
    const hookH = d.blocks.findIndex((b) => b.kind === 'h1' && b.text.includes('钩子地图'));
    const epIdx = kinds.indexOf('epStart');
    assert.ok(waveIdx >= 0 && hookH > waveIdx && epIdx > hookH, '顺序：波形→钩子页→正文');
    const texts = d.blocks.map((b) => b.text || '');
    assert.ok(texts.some((t) => t.includes('钩子编排：共4集')));
    for (let e = 1; e <= 4; e++) assert.ok(texts.some((t) => t.includes(`第${e}集 开场`)));
  });
  it('英文项目钩子页为英文', () => {
    const en = ss.map((x) => ({ ...x, content: 'EXT. ROOFTOP - NIGHT He turns.' }));
    const d = buildScriptDoc({ title: 'ENH', totalEps: 4 }, en, { level: 'PRO' });
    const texts = d.blocks.map((b) => b.text || '');
    assert.ok(texts.some((t) => t.includes('Hook Map')));
    const head = texts.find((t) => t.startsWith('Hook map:'));
    assert.ok(head && !/[一-鿿]/.test(head));
  });
});

describe('v2.62 爽点-反转兑现链时间线', () => {
  const ss = [1, 2, 3, 4].map((n) => ({ epNo: n, title: `E${n}`, content: `第${n}集 内景 天台 夜 他回头。` }));
  it('位置：钩子地图之后、正文之前；逐集行与体检齐全', () => {
    const d = buildScriptDoc({ title: '兑现剧', totalEps: 4 }, ss, { level: 'PRO' });
    const kinds = d.blocks.map((b) => b.kind);
    const hookH = d.blocks.findIndex((b) => b.kind === 'h1' && b.text.includes('钩子地图'));
    const chainH = d.blocks.findIndex((b) => b.kind === 'h1' && b.text.includes('兑现链'));
    const epIdx = kinds.indexOf('epStart');
    assert.ok(hookH >= 0 && chainH > hookH && epIdx > chainH, '顺序：钩子页→兑现链→正文');
    const texts = d.blocks.map((b) => b.text || '');
    assert.ok(texts.some((t) => t.startsWith('兑现链总览：共4集')));
    for (let e = 1; e <= 4; e++) assert.ok(texts.some((t) => t.includes(`第${e}集 反转`)));
    assert.ok(texts.some((t) => t.startsWith('兑现体检')));
  });
  it('英文项目兑现链页零中文', () => {
    const en = ss.map((x) => ({ ...x, content: 'EXT. ROOFTOP - NIGHT He turns.' }));
    const d = buildScriptDoc({ title: 'ENC', totalEps: 4 }, en, { level: 'PRO' });
    const texts = d.blocks.map((b) => b.text || '');
    assert.ok(texts.some((t) => t.includes('Payoff & Reversal Chain')));
    const head = texts.find((t) => t.startsWith('Payoff chain:'));
    assert.ok(head && !/[一-鿿]/.test(head));
  });
});

describe('v2.63 人物表与成长弧一页纸', () => {
  const mk = (n, pair) => `第${n}集 标题\n【场景】日/厅/内\n【人物】${pair}\n林晚（冷）：第${n}句。\n陈总：等着。`;
  const ss = [1, 2, 3, 4].map((n) => ({
    epNo: n, title: `第${n}集`,
    content: mk(n, n % 3 === 0 ? '林晚、小刘' : '林晚、陈总'),
  }));
  const bible = {
    characters: {
      林晚: { traits: '后发制人/白手起家', voice: '平静短句', arc: '隐忍到亮明身份' },
      陈总: { traits: '自保', voice: '色厉内荏', arc: '嚣张到崩溃' },
    },
  };
  it('位置：兑现链之后、正文之前；人物卡/关系轴/成长线齐全', () => {
    const d = buildScriptDoc({ title: '人物剧', totalEps: 4, bible }, ss, { level: 'PRO' });
    const kinds = d.blocks.map((b) => b.kind);
    const chainH = d.blocks.findIndex((b) => b.kind === 'h1' && b.text.includes('兑现链'));
    const castH = d.blocks.findIndex((b) => b.kind === 'h1' && b.text.includes('人物表与成长弧'));
    const epIdx = kinds.indexOf('epStart');
    assert.ok(chainH >= 0 && castH > chainH && epIdx > castH, '顺序：兑现链→人物页→正文');
    const texts = d.blocks.map((b) => b.text || '');
    assert.ok(texts.some((t) => t.includes('林晚') && t.includes('隐性设定')));
    assert.ok(texts.some((t) => t.includes('对手戏关系轴')));
    assert.ok(texts.some((t) => /第1集 [①②③④⑤]/.test(t)));
  });
  it('英文项目人物页零中文', () => {
    const en = [1, 2, 3, 4].map((n) => ({
      epNo: n, title: `E${n}`,
      content: `Episode ${n}\n[Characters] Lin Wan, Mr. Chen\nLin Wan: line ${n}.`,
    }));
    const d = buildScriptDoc({
      title: 'ENC', totalEps: 4,
      bible: { characters: { 'Lin Wan': { traits: 'calm', voice: 'short', arc: 'reveal' } } },
    }, en, { level: 'PRO' });
    const start = d.blocks.findIndex((b) => b.kind === 'h1' && b.text === 'Cast & Growth Sheet');
    assert.ok(start >= 0);
    for (let i = start; i < d.blocks.length && d.blocks[i].kind !== 'epStart'; i++) {
      assert.ok(!/[一-鿿]/.test(d.blocks[i].text || ''), '人物页英文零中文');
    }
  });
});

// v2.193 c193 复盘：故事大纲/人物小传段裸读 bible Json（无 try 包裹，旧码畸形即导出 500/污染）
describe('v2.193 c193 · buildScriptDoc 故事大纲/人物小传畸形 bible 防御', () => {
  const baseScripts = [{ epNo: 1, title: '一', content: '场景一 内景 宅\n正文' }];
  const allText = (d) => d.blocks.map((b) => JSON.stringify(b)).join('');

  it('foreshadow 为字符串（LLM 形态漂移）→ 不抛错，整条作为一条伏笔入文档（旧码 .filter 500）', () => {
    const d = buildScriptDoc({ title: 'T', bible: { foreshadow: '神秘食客就是集团继承人' } }, baseScripts, { level: 'FREE' });
    const text = allText(d);
    assert.ok(text.includes('神秘食客就是集团继承人'), '字符串伏笔按单条保留，不丢信息不截断首字');
  });

  it('timeline 为字符串 → logline 用整条而非首字符；非字符串元素被丢弃', () => {
    const d = buildScriptDoc({ title: 'T', bible: { timeline: '一道祖传菜谱改写命运' } }, baseScripts, { level: 'FREE' });
    const loglineBlock = d.blocks.find((b) => b.kind === 'p' && typeof b.text === 'string' && b.text.includes('菜谱'));
    assert.ok(loglineBlock, '字符串 timeline 作为单条 logline');
    assert.ok(loglineBlock.text.includes('一道祖传菜谱改写命运'));
    const d2 = buildScriptDoc({ title: 'T', bible: { timeline: [123, null, '有效梗概'] } }, baseScripts, { level: 'FREE' });
    const t2 = allText(d2);
    assert.ok(t2.includes('有效梗概') && !t2.includes('世界观：123'));
  });

  it('worldview 非字符串 → 视同缺失，不出现 123/[object Object] 污染', () => {
    const d = buildScriptDoc({ title: 'T', bible: { worldview: 123 } }, baseScripts, { level: 'FREE' });
    const text = allText(d);
    assert.ok(!text.includes('世界观：123') && !text.includes('[object Object]'));
  });

  it('characters 数组形态含 null/原始值元素 + 合法角色 → 不抛错（旧码 c.traits 500），合法角色四字段完整', () => {
    const d = buildScriptDoc({
      title: 'T',
      bible: { characters: [
        null, 42,
        { name: '林晚', traits: '隐忍', arc: '反击', voice: '短句', visualAnchor: '左眉疤痕' },
        { name: '恶角', traits: { x: 1 }, arc: ['a'], voice: 7 }, // 全字段错型：不污染
      ] },
    }, baseScripts, { level: 'FREE' });
    const text = allText(d);
    assert.ok(text.includes('林晚') && text.includes('隐忍') && text.includes('反击') && text.includes('短句') && text.includes('左眉疤痕'), '合法角色完整');
    assert.ok(text.includes('恶角') && !text.includes('[object Object]') && !text.includes('性格特质：7'), '错型字段视同缺失，不字符串化污染');
    assert.ok(!/"name":null/.test(text) && !text.includes('"42"'), 'null/原始值条目不产垃圾人物');
  });

  it('characters 为字符串 → 视同无圣经走占位，不产数字索引垃圾人物', () => {
    const d = buildScriptDoc({ title: 'T', bible: { characters: 'abc' } }, baseScripts, { level: 'FREE' });
    const text = allText(d);
    assert.ok(text.includes('人物设定随创作过程沉淀'));
    assert.ok(!text.includes('"0"') && !(d.blocks.some((b) => b.kind === 'h2' && b.text === '0')), '字符串形态不得拆成 0/1/2 垃圾人物名');
  });

  it('毒丸隔离：畸形 foreshadow/worldview 不影响合法 characters 与正文输出', () => {
    const d = buildScriptDoc({
      title: 'T',
      bible: { worldview: {}, foreshadow: 999, characters: { 林晚: { traits: '稳' } } },
    }, baseScripts, { level: 'FREE' });
    const text = allText(d);
    assert.ok(text.includes('林晚') && text.includes('稳') && text.includes('场景一') && text.includes('正文'), '好数据不被坏字段连坐');
  });
});
