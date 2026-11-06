'use strict';
// v2.407 dialogue-ai-taste 教学函数同源对齐测试
// 锚点词紧贴引擎源码：五类信号 + 优先级链 + score 公式 + severity 分级

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/dialogue-ai-taste.js');

try {
  require.resolve(MODULE_PATH);
} catch {
  execSync('npx tsc -p tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
}

const mod = require(MODULE_PATH);

const lineOf = (s, anchor) => {
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(anchor)) return lines[i];
  }
  return '';
};

const zh = mod.buildDialogueAiTasteDirective('LIVE', 'zh');
const en = mod.buildDialogueAiTasteDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildDialogueAiTasteDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildDialogueAiTasteDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('对白 AI 味'), '标题应点明对白 AI 味');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildDialogueAiTasteDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildDialogueAiTasteDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫对白行（1-12字姓名 + 冒号），场头/剧名页/日·夜·闪回纯标签行排除', () => {
    const s = lineOf(zh, '检测范围：');
    assert.ok(s, '应有检测范围口径');
    assert.ok(s.includes('对白行'), '只扫对白行');
    assert.ok(s.includes('1-12 字'), '姓名长度');
    assert.ok(s.includes('场头'), '场头排除');
    assert.ok(s.includes('日') && s.includes('夜') && s.includes('闪回'), '纯标签行排除');
  });

  test('五维度信号 — lecturing 说教腔 / expository 解释性 / aphorism 万能金句 / formal 书面语 / parallelism 排比堆砌', () => {
    const s = lineOf(zh, '五维度 AI 味：');
    assert.ok(s, '应有五维度信号清单');
    const types = ['lecturing', 'expository', 'aphorism', 'formal', 'parallelism'];
    for (const t of types) assert.ok(s.includes(t), `应包含 ${t}`);
    assert.ok(s.includes('说教腔') && s.includes('解释性') && s.includes('排比堆砌'), '中文类型名齐备');
  });

  test('lecturing 说教腔 — 关键词 8 个 + 长度 >20 才算命中', () => {
    const s = lineOf(zh, 'lecturing 说教腔：');
    assert.ok(s, '应有说教腔口径');
    const hits = ['你要知道', '你必须明白', '你应该懂得', '你听我说', '记住', '听好了', '我告诉你', '你给我记着'];
    for (const h of hits) assert.ok(s.includes(h), `应包含关键词 ${h}`);
    assert.ok(s.includes('>20'), '长度阈值 20');
  });

  test('expository 解释性台词 — 关键词 5 个', () => {
    const s = lineOf(zh, 'expository 解释性台词：');
    assert.ok(s, '应有解释性口径');
    const hits = ['因为所以', '是因为', '这就是为什么', '之所以是因为', '由于因此'];
    for (const h of hits) assert.ok(s.includes(h), `应包含关键词 ${h}`);
  });

  test('aphorism 万能金句 — 关键词 6 个', () => {
    const s = lineOf(zh, 'aphorism 万能金句：');
    assert.ok(s, '应有万能金句口径');
    const hits = ['真正的是', '人生就像', '只有才能', '不管都', '只要就一定', '没有就没有'];
    for (const h of hits) assert.ok(s.includes(h), `应包含关键词 ${h}`);
  });

  test('formal 书面语 — 关键词 8 个', () => {
    const s = lineOf(zh, 'formal 书面语：');
    assert.ok(s, '应有书面语口径');
    const hits = ['因此', '然而', '倘若', '故此', '众所周知', '综上所述', '由此可见', '毋庸置疑'];
    for (const h of hits) assert.ok(s.includes(h), `应包含关键词 ${h}`);
  });

  test('parallelism 排比堆砌 — ≥3 个相同词开头的短句（中文按前两字 / 英文按首个词）', () => {
    const s = lineOf(zh, 'parallelism 排比堆砌：');
    assert.ok(s, '应有排比口径');
    assert.ok(s.includes('≥3'), '数量阈值 3');
    assert.ok(s.includes('相同词开头'), '相同开头');
    assert.ok(s.includes('你不…你不…'), '排比示例');
  });

  test('优先级链 — lecturing > expository > aphorism > formal > parallelism', () => {
    const s = lineOf(zh, '优先级链：');
    assert.ok(s, '应有优先级链');
    assert.ok(s.indexOf('lecturing') < s.indexOf('parallelism'), 'lecturing 应在 parallelism 之前');
    assert.ok(s.indexOf('expository') < s.indexOf('aphorism'), 'expository 应在 aphorism 之前');
    assert.ok(s.indexOf('aphorism') < s.indexOf('formal'), 'aphorism 应在 formal 之前');
    assert.ok(s.indexOf('formal') < s.indexOf('parallelism'), 'formal 应在 parallelism 之前');
    assert.ok(s.includes('第一命中'), '单条只记第一命中');
  });

  test('score 公式 — round(问题数/总对白数×100) 封顶 100；空稿 0 分', () => {
    const s = lineOf(zh, '得分公式：');
    assert.ok(s, '应有得分公式');
    assert.ok(s.includes('问题数'), '问题数在分子');
    assert.ok(s.includes('总对白数'), '总对白数在分母');
    assert.ok(s.includes('×100'), '乘 100');
    assert.ok(s.includes('封顶 100'), '封顶 100');
    assert.ok(s.includes('空稿 0'), '空稿 0 分');
  });

  test('severity 分级 — lecturing/expository high；其余三类 medium', () => {
    const s = lineOf(zh, 'severity 分级：');
    assert.ok(s, '应有 severity 分级');
    assert.ok(s.includes('high'), 'high');
    assert.ok(s.includes('lecturing 和 expository'), 'high 只含 lecturing + expository');
    assert.ok(s.includes('medium'), 'medium');
    assert.ok(s.includes('aphorism / formal / parallelism 为 medium'), 'medium 完整列表');
  });

  test('建议替换词 — 每类给一个改写方向', () => {
    const s = lineOf(zh, '改写方向：');
    assert.ok(s, '应有改写方向');
    assert.ok(s.includes('拆解排比') || s.includes('保留一句点睛'), 'parallelism 改写');
    assert.ok(s.includes('改说教为行动') || s.includes('潜台词'), 'lecturing 改写');
    assert.ok(s.includes('换成口语') || s.includes('能说出口'), 'formal 改写');
    assert.ok(s.includes('藏进动作') || s.includes('藏进冲突'), 'expository 改写');
    assert.ok(s.includes('删万能金句') || s.includes('角色独有'), 'aphorism 改写');
  });

  test('pipeline 消费 — craft dialogue 维度加权 + deai 维度 (100-score)×0.02 负向分', () => {
    const s = lineOf(zh, 'pipeline 消费：');
    assert.ok(s, '应有 pipeline 消费说明');
    assert.ok(s.includes('dialogue'), 'craft dialogue 维度');
    assert.ok(s.includes('deai'), 'deai 维度');
    assert.ok(s.includes('× 0.02'), 'deai 权重');
    assert.ok(s.includes('100 - score'), '负向公式');
  });

  test('成稿自查 — 五类都要过一遍、避免教腔、避免排比、避免书面语', () => {
    const s = lineOf(zh, '成稿自查：');
    assert.ok(s, '应有成稿自查');
    assert.ok(s.includes('≥20'), '说教腔长度阈值');
    assert.ok(s.includes('动作/冲突') || s.includes('藏进'), '解释性口径');
    assert.ok(s.includes('角色独有'), '金句口径');
    assert.ok(s.includes('≥3'), '排比阈值');
    assert.ok(s.includes('能说出口') || s.includes('用嘴说'), '书面语口径');
  });
});

// ========== 英文层断言 ==========
describe('en — buildDialogueAiTasteDirective', () => {
  const CJK = /[\u4e00-\u9fa5]/;

  test('函数存在且英文层零中文', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
    assert.ok(!CJK.test(en), '英文层不得出现中文');
    assert.ok(en.includes('Dialogue AI Taste'), '标题应点明 Dialogue AI Taste');
  });

  test('format 不门控 — AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildDialogueAiTasteDirective('AIGC', 'en'), en);
    assert.equal(mod.buildDialogueAiTasteDirective(undefined, 'en'), en);
  });

  test('五维度类型名 + 优先级链齐全', () => {
    const s = lineOf(en, 'Five signal types');
    assert.ok(s, '应有五维度清单');
    const types = ['lecturing', 'expository', 'aphorism', 'formal', 'parallelism'];
    for (const t of types) assert.ok(s.includes(t), `应包含 ${t}`);
    assert.ok(lineOf(en, 'Priority').includes('lecturing') && lineOf(en, 'Priority').includes('parallelism'), '优先级链');
  });

  test('lecturing 英文关键词齐全', () => {
    const s = lineOf(en, 'lecturing keywords');
    const hits = ['you must understand', 'you need to know', 'you should realize', 'let me tell you', 'listen carefully'];
    for (const h of hits) assert.ok(s.includes(h), `应包含 ${h}`);
  });

  test('关键阈值 — 20 / 100 / 0.02', () => {
    assert.ok(lineOf(en, 'length > 20').includes('20'), '说教腔长度阈值');
    assert.ok(lineOf(en, 'Score formula').includes('100'), '封顶 100');
    assert.ok(lineOf(en, 'deai').includes('0.02'), 'deai 权重');
  });

  test('severity 分级 + 改写方向', () => {
    const s = lineOf(en, 'lecturing and expository');
    assert.ok(s.includes('high') && s.includes('medium'), '分级齐备');
    const rw = lineOf(en, 'Rewrite direction');
    assert.ok(rw.includes('action') || rw.includes('colloquial'), '改写方向');
  });
});
