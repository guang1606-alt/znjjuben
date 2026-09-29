const { describe, it } = require('node:test');
const assert = require('node:assert');
let M;
try {
  M = require('../dist/engine/script-scenes.js');
} catch (e) {
  M = null;
}

describe('c213 script-scenes 共享场头切分器（四规范场头全集，单一事实源）', () => {
  it('模块存在且导出三件 API', () => {
    assert.ok(M, 'dist/engine/script-scenes.js 必须存在（先 tsc 编译）');
    assert.strictEqual(typeof M.isSceneHeaderLine, 'function');
    assert.strictEqual(typeof M.splitScriptScenes, 'function');
    assert.strictEqual(typeof M.detectScriptLang, 'function');
  });

  const ZH_HEADERS = [
    '场景1：老宅厨房·日',
    '场景 2：客厅·夜',
    '场景: 天台',
    '第一场：卧室·晨',
    '第三场 医院走廊',
    '【场景3】天台·黄昏',
    '【第一场】教室',
    '内景 老宅厨房·夜',
    '外景 学校操场·日',
    '室内 卧室·晨',
    '室外 巷子口',
    '场12：医院走廊·夜',
    '第3集 风波骤起',
    '内. 厨房 日',
  ];
  const ZH_NEG = [
    '林小凡：场景我都看过了，别再提。',
    '△内景里灯光昏暗，她攥紧了催款单。',
    '他心里嘀咕：内景和外景到底有什么区别。',
    '（外景地离市区三十公里）',
    '今天天气真好。',
  ];

  it('中文：工具教学的全部规范场头（LIVE 场景N： / AIGC 内景外景 / 【】 / 第N场 / 第N集）全部识别', () => {
    for (const h of ZH_HEADERS) {
      assert.strictEqual(M.isSceneHeaderLine(h, 'zh'), true, `应识别场头：${h}`);
    }
  });

  it('中文负例：台词行/动作行/含场景词的正文不得误判', () => {
    for (const h of ZH_NEG) {
      assert.strictEqual(M.isSceneHeaderLine(h, 'zh'), false, `不得误判为场头：${h}`);
    }
  });

  const EN_HEADERS = [
    'INT. OLD APARTMENT HALLWAY - NIGHT',
    'EXT. SCHOOL TRACK - DAY',
    'INT. BEDROOM - NIGHT',
    'INTERIOR OFFICE - DAY',
    'EXTERIOR ROOFTOP - DUSK',
    'SCENE 1: HALLWAY - NIGHT',
    'SCENE 3 - OFFICE',
    'SCENE: BASEMENT',
    'FADE IN:',
    'CUT TO:',
    'INTERCUT - PHONE CALL',
    '[SCENE 2: KITCHEN]',
    // c213 回归：旧分裂正则小写/混合大小写漏切
    'Scene: Company lobby, Day, Interior',
    'scene 2 - Rooftop, Dusk',
    'int. bedroom - night',
  ];
  const EN_NEG = [
    'JANE: I saw the scene outside the window.',
    '(INT. props were scattered backstage.)',
    'Interesting, he thought, but said nothing.',
    'She extended her hand calmly.',
  ];

  it('英文：LIVE(SCENE N:) 与 AIGC(INT./EXT.) 双制式 + 转场口行全部识别', () => {
    for (const h of EN_HEADERS) {
      assert.strictEqual(M.isSceneHeaderLine(h, 'en'), true, `应识别场头：${h}`);
    }
  });

  it('英文负例：台词行/ Interesting 等词不得误判', () => {
    for (const h of EN_NEG) {
      assert.strictEqual(M.isSceneHeaderLine(h, 'en'), false, `不得误判为场头：${h}`);
    }
  });

  it('语种自探测：汉字稿 zh，英文稿 en', () => {
    assert.strictEqual(M.detectScriptLang('场景1：厨房·日\n林小凡：你好。'), 'zh');
    assert.strictEqual(M.detectScriptLang('INT. KITCHEN - DAY\nJANE: Hello.'), 'en');
  });

  it('splitScriptScenes：LIVE 三场景正确切分（场头归 header，正文归 body，index/startLine 正确）', () => {
    const text = [
      '场景1：老宅·夜',
      '△她推门。',
      '林小凡：我回来了。',
      '场景2：操场·日',
      '陈鹿：这边！',
      '场景3：办公室·日',
      '林国栋：签了它。',
    ].join('\n');
    const scenes = M.splitScriptScenes(text, 'zh');
    assert.strictEqual(scenes.length, 3);
    assert.deepStrictEqual(scenes.map((s) => s.index), [0, 1, 2]);
    assert.strictEqual(scenes[0].header, '场景1：老宅·夜');
    assert.ok(scenes[0].body.includes('林小凡：我回来了。'));
    assert.ok(!scenes[0].body.includes('场景'));
    assert.strictEqual(scenes[1].startLine, 3);
    assert.strictEqual(scenes[2].header, '场景3：办公室·日');
    assert.ok(scenes[2].body.includes('签了它'));
  });

  it('splitScriptScenes：AIGC 内景/外景 与英文 INT./SCENE 同样切三场（c213 核心回归）', () => {
    const zh = '内景 老宅·夜\n△她推门。\n外景 操场·日\n陈鹿：这边！\n内景 办公室·日\n林国栋：签了它。';
    assert.strictEqual(M.splitScriptScenes(zh, 'zh').length, 3);
    const en = 'INT. HALLWAY - NIGHT\nJANE: Hi.\nEXT. TRACK - DAY\nMAYA: Over here!\nSCENE 3: OFFICE - DAY\nUNCLE TED: Sign.';
    assert.strictEqual(M.splitScriptScenes(en, 'en').length, 3);
  });

  it('splitScriptScenes：无场头全文退化为单场（header 空串），正文不丢', () => {
    const text = '小明：今天天气真好。\n△他出门了。';
    const scenes = M.splitScriptScenes(text, 'zh');
    assert.strictEqual(scenes.length, 1);
    assert.strictEqual(scenes[0].header, '');
    assert.ok(scenes[0].body.includes('今天天气真好'));
  });

  it('splitScriptScenes：首场场头前的引子行归入开场（不静默丢弃）', () => {
    const text = '《暗流》第一集\n旁白：命运在那一夜转弯。\n场景1：老宅·夜\n△她推门。';
    const scenes = M.splitScriptScenes(text, 'zh');
    assert.strictEqual(scenes.length, 2);
    assert.strictEqual(scenes[0].header, '');
    assert.ok(scenes[0].body.includes('命运在那一夜转弯'));
    assert.strictEqual(scenes[1].header, '场景1：老宅·夜');
  });

  it('splitScriptScenes：空文本安全返回空数组（与 emotionalAftermath 短文本短路同纪律）', () => {
    assert.deepStrictEqual(M.splitScriptScenes('', 'zh'), []);
    assert.deepStrictEqual(M.splitScriptScenes('   \n  ', 'zh'), []);
  });

  it('c213 isSceneOrTitleLine：剧名/集标题/FADE OUT 算非正文行，但不被切分器当场头', () => {
    assert.strictEqual(M.isSceneOrTitleLine('《暗流》第一集', 'zh'), true);
    assert.strictEqual(M.isSceneOrTitleLine('集标题', 'zh'), true);
    assert.strictEqual(M.isSceneOrTitleLine('FADE OUT.', 'en'), true);
    assert.strictEqual(M.isSceneOrTitleLine('INT. OFFICE - DAY', 'en'), true);
    assert.strictEqual(M.isSceneOrTitleLine('场3：天台·日', 'zh'), true);
    // 普通对白/动作行不能误判
    assert.strictEqual(M.isSceneOrTitleLine('林小凡：合同我签了。', 'zh'), false);
    assert.strictEqual(M.isSceneOrTitleLine('JANE: I signed it.', 'en'), false);
    // 关键纪律：《剧名》与 FADE OUT 不是场头，splitScriptScenes 不得据此切场
    const scenes = M.splitScriptScenes('《暗流》\n旁白：起风了。\n场景1：老宅·夜\n△她推门。\nFADE OUT.', 'zh');
    assert.strictEqual(scenes.length, 2, 'FADE OUT/剧名不得切出新场');
  });
});
