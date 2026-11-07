'use strict';
// v2.439 preview-voiceover 教学函数同源对齐测试
// 锚点紧贴引擎源码：marker|pitch 全片 / future_dump 仅尾部 12 非空行 /
// 旁白白名单 / 将来助词 12 字（英 30 字符）/ 句段一拍 / ≥2 拍才判 /
// 计分 marker -45 pitch -20 future_dump -26 floor 20 / 命中字段 42 字 /
// 邻居分界 omniscient-tease·cliffhanger-score·witness-gratuity /
// pipeline 消费 previewHint / 成稿自查 / en 层零 CJK

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/preview-voiceover.js');

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

const zh = mod.buildPreviewVoiceoverDirective ? mod.buildPreviewVoiceoverDirective('LIVE', 'zh') : '';
const en = mod.buildPreviewVoiceoverDirective ? mod.buildPreviewVoiceoverDirective('LIVE', 'en') : '';

describe('zh — buildPreviewVoiceoverDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildPreviewVoiceoverDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 400, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('导视'), '标题应点明导视');
  });

  test('format 不门控 — LIVE / AIGC / 缺省一致', () => {
    assert.equal(mod.buildPreviewVoiceoverDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildPreviewVoiceoverDirective(undefined, 'zh'), zh);
    const line = lineOf(zh, 'format 不门控');
    assert.ok(line.includes('format 不门控'), '应说明 format 不门控');
    assert.ok(line.includes('同一套'), '应说明规则跨格式一致');
  });

  test('检测范围 — marker/pitch 全片任意位置，future_dump 仅尾部', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('marker'), '应列出 marker');
    assert.ok(line.includes('pitch'), '应列出 pitch');
    assert.ok(line.includes('任意位置'), 'marker/pitch 应全片判');
    assert.ok(line.includes('场景头'), '应说明场景头除外');
    assert.ok(line.includes('12 个非空行'), 'future_dump 应只扫尾部 12 个非空行');
  });

  test('marker 预告标记 — 典型例词与说话人位写法', () => {
    const line = lineOf(zh, 'marker 预告标记');
    assert.ok(line.includes('下集预告'), '应列出下集预告');
    assert.ok(line.includes('未完待续'), '应列出未完待续');
    assert.ok(line.includes('且听下回分解'), '应列出且听下回分解');
    assert.ok(line.includes('说话人位'), '应说明写在说话人位也判');
    assert.ok(line.includes('行尾'), '应说明“待续”仅行尾算');
  });

  test('pitch 主播口播 — 关注/点赞/订阅与英文例词', () => {
    const line = lineOf(zh, 'pitch 主播口播');
    assert.ok(line.includes('关注'), '应列出关注');
    assert.ok(line.includes('点赞'), '应列出点赞');
    assert.ok(line.includes('订阅'), '应列出订阅');
    assert.ok(line.includes('subscribe'), '应列出英文 subscribe');
    assert.ok(line.includes('对观众喊话'), '应说明成片人物不能对观众喊话');
  });

  test('future_dump — 仅旁白白名单，角色当场计划豁免', () => {
    const line = lineOf(zh, 'future_dump 集尾将来时排播');
    assert.ok(line.includes('旁白'), '应说明只判旁白类');
    assert.ok(line.includes('NARRATOR'), '应给出英文旁白名单');
    assert.ok(line.includes('角色当场'), '应说明角色当场计划豁免');
  });

  test('节拍口径 — 句段一拍、将来助词窗口、单拍放行', () => {
    const line = lineOf(zh, '节拍口径');
    assert.ok(line.includes('句段'), '应按句段切分');
    assert.ok(line.includes('12 字'), '中文字符窗口 12 字');
    assert.ok(line.includes('30 字符'), '英文字符窗口 30 字符');
    assert.ok(line.includes('单拍放行'), '单拍应放行');
    assert.ok(line.includes('≥2 拍'), '同一叙述行 ≥2 拍才判');
  });

  test('具体动作 — 实体事件例词，空词不算', () => {
    const line = lineOf(zh, '具体动作：');
    assert.ok(line.includes('签字'), '应列出签字');
    assert.ok(line.includes('揭穿'), '应列出揭穿');
    assert.ok(line.includes('报警'), '应列出报警');
    assert.ok(line.includes('空词'), '应说明空词不算');
  });

  test('计分 — 100 起 marker -45 / pitch -20 / future_dump -26 / 最低 20', () => {
    const line = lineOf(zh, '计分');
    assert.ok(line.includes('100 起'), '应从 100 起');
    assert.ok(line.includes('-45'), 'marker 应 -45');
    assert.ok(line.includes('-20'), 'pitch 应 -20');
    assert.ok(line.includes('-26'), 'future_dump 应 -26');
    assert.ok(line.includes('20'), '应给出封底');
  });

  test('命中字段 — line/kind/narrator/beats/snippet/reason 与 42 字截断', () => {
    const line = lineOf(zh, '命中字段');
    for (const k of ['line', 'kind', 'narrator', 'beats', 'snippet', 'reason']) {
      assert.ok(line.includes(k), `应列出字段 ${k}`);
    }
    assert.ok(line.includes('42 字'), 'snippet 应 42 字截断');
  });

  test('邻居分界 — omniscient-tease / cliffhanger-score / witness-gratuity', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('omniscient-tease'), '应点名 omniscient-tease');
    assert.ok(line.includes('cliffhanger-score'), '应点名 cliffhanger-score');
    assert.ok(line.includes('witness-gratuity'), '应点名 witness-gratuity');
  });

  test('pipeline 消费 — previewHint 双注入', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('previewHint'), '应说明注入 previewHint');
    assert.ok(line.includes('撰写师'), '应说明撰写师首轮可见');
    assert.ok(line.includes('润色师'), '应说明润色师首轮可见');
  });

  test('pipeline 接线 — import/构造/两处注入齐备', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(path.join(ROOT, 'src/agents/pipeline.ts'), 'utf8');
    const importLine = lineOf(src, 'buildPreviewVoiceoverDirective');
    assert.ok(importLine.includes('preview-voiceover'), '应从 preview-voiceover 导入');
    assert.ok(src.includes('const previewVoiceoverDirective = buildPreviewVoiceoverDirective('), '应有构造调用');
    const injections = src.split('${previewVoiceoverDirective}').length - 1;
    assert.equal(injections, 2, '撰写师与润色师应各注入一次');
  });

  test('成稿自查 — 删导视、停在正在发生的动作', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('下集预告'), '应要求删下集预告');
    assert.ok(line.includes('关注'), '应要求删关注口播');
    assert.ok(line.includes('正在发生'), '应要求停在正在发生的瞬间');
    assert.ok(line.includes('打断'), '应要求停在被打断的台词');
  });
});

describe('en — buildPreviewVoiceoverDirective', () => {
  test('返回有效英文教学文本且零 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 400, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 层不得出现中文');
    assert.ok(en.includes('TV-guide'), '标题应点明 TV-guide');
  });

  test('检测范围 — 任意位置 vs 尾部 12 非空行', () => {
    const line = lineOf(en, 'Scan range');
    assert.ok(line.includes('anywhere'), 'marker/pitch 应全片判');
    assert.ok(line.includes('12 non-empty'), 'future_dump 应限尾部 12 非空行');
    assert.ok(line.includes('scene header'), '场景头应除外');
  });

  test('三型齐备 — marker / pitch / future_dump', () => {
    const line = lineOf(en, 'Kinds');
    assert.ok(line.includes('marker'), '应列出 marker');
    assert.ok(line.includes('pitch'), '应列出 pitch');
    assert.ok(line.includes('future_dump'), '应列出 future_dump');
  });

  test('节拍与计分 — 2 beats / -45 / -20 / -26 / floor', () => {
    const beat = lineOf(en, 'Beat counting');
    assert.ok(beat.includes('two beats') || beat.includes('2 beats'), '应说明 ≥2 拍才判');
    const line = lineOf(en, 'Scoring');
    assert.ok(line.includes('-45'), 'marker 应 -45');
    assert.ok(line.includes('-20'), 'pitch 应 -20');
    assert.ok(line.includes('-26'), 'future_dump 应 -26');
    assert.ok(line.includes('floor 20'), '应给出封底');
  });

  test('邻居与自查 — 三引擎分界 + 正在发生的动作', () => {
    const neighbors = lineOf(en, 'Neighbors');
    assert.ok(neighbors.includes('omniscient-tease'), '应点名 omniscient-tease');
    assert.ok(neighbors.includes('cliffhanger-score'), '应点名 cliffhanger-score');
    assert.ok(neighbors.includes('witness-gratuity'), '应点名 witness-gratuity');
    const selfCheck = lineOf(en, 'Self-check');
    assert.ok(selfCheck.includes('next episode') || selfCheck.includes('TV-guide'), '应要求删导视');
    assert.ok(selfCheck.includes('happening now'), '应要求停在正在发生的瞬间');
  });
});
