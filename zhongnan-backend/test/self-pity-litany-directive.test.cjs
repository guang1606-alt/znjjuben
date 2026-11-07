'use strict';
// v2.436 self-pity-litany 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫台词/心声行并合并发言段 / 四族信号 / charged ≥2 族或单族 ≥2 次且段长达标 /
// 单族单次放行 / rescue 段内或紧邻下一拍且必须自己转身 / 0-1-≥2 计分 / 命中字段 /
// 邻居四分界 / 消费与自查

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/self-pity-litany.js');

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

const zh = mod.buildSelfPityDirective ? mod.buildSelfPityDirective('LIVE', 'zh') : '';
const en = mod.buildSelfPityDirective ? mod.buildSelfPityDirective('LIVE', 'en') : '';

describe('zh — buildSelfPityDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildSelfPityDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('自怜连祷'), '标题应点明自怜连祷');
  });

  test('format 不门控 — LIVE / AIGC / 缺省一致，中英同一套规则', () => {
    assert.equal(mod.buildSelfPityDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSelfPityDirective(undefined, 'zh'), zh);
    const line = lineOf(zh, '同一套四族');
    assert.ok(line.includes('同一套四族'), '应说明规则跨语言一致');
    assert.ok(line.includes('format 不门控'), '应说明 format 不门控');
  });

  test('检测范围 — 只扫台词/心声行，同话者连续发言合并为发言段', () => {
    const line = lineOf(zh, '检测范围：只扫台词行');
    assert.ok(line.includes('心声行'), '应说明心声行也扫');
    assert.ok(line.includes('合并为发言段'), '应说明同话者合并');
    assert.ok(line.includes('场头'), '应说明场头断段');
    assert.ok(line.includes('dialogueLines'), '应说明台词行计数');
  });

  test('doom 苦命陈述 — 我这辈子 / 从小到大 / 命苦', () => {
    const line = lineOf(zh, 'doom 苦命陈述');
    assert.ok(line.includes('我这辈子'), '应列出我这辈子');
    assert.ok(line.includes('从小到大'), '应列出从小到大');
    assert.ok(line.includes('命苦'), '应列出命苦');
    assert.ok(line.includes('贱命'), '应列出贱命');
  });

  test('heaven 问天控诉 — 老天爷为什么 / 凭什么是我', () => {
    const line = lineOf(zh, 'heaven 问天控诉');
    assert.ok(line.includes('老天爷'), '应列出老天爷');
    assert.ok(line.includes('为什么'), '应列出为什么');
    assert.ok(line.includes('不公'), '应列出不公');
    assert.ok(line.includes('凭什么是我'), '应列出凭什么是我');
  });

  test('blame 自我定罪乞怜 — 我做错了什么 / 可怜可怜我 / 活该', () => {
    const line = lineOf(zh, 'blame 自我定罪乞怜');
    assert.ok(line.includes('我做错了什么'), '应列出我做错了什么');
    assert.ok(line.includes('活该'), '应列出活该');
    assert.ok(line.includes('可怜可怜我'), '应列出可怜可怜我');
    assert.ok(line.includes('废物'), '应列出废物');
  });

  test('list 苦难罗列 — 同段 ≥2 个苦难事实短语', () => {
    const line = lineOf(zh, 'list 苦难罗列');
    assert.ok(line.includes('≥2 个'), '应说明数量门槛');
    assert.ok(line.includes('没爹没妈'), '应列出没爹没妈');
    assert.ok(line.includes('睡桥洞'), '应列出睡桥洞');
    assert.ok(line.includes('欠高利贷'), '应列出欠高利贷');
  });

  test('charged 判定 — ≥2 族共现或单族 ≥2 次，且段长达标', () => {
    const line = lineOf(zh, 'charged 判定');
    assert.ok(line.includes('≥2 族'), '应说明族数门槛');
    assert.ok(line.includes('任一族 ≥2 次'), '应说明单族重复');
    assert.ok(line.includes('14 字'), '应给出中文长度阈值');
    assert.ok(line.includes('10 词'), '应给出英文长度阈值');
  });

  test('放行口径 — 单族单次的短口语不罚', () => {
    const line = lineOf(zh, '放行口径');
    assert.ok(line.includes('单族单次'), '应说明放行条件');
    assert.ok(line.includes('叹一口气'), '应给出允许口径');
    assert.ok(line.includes('造的什么孽'), '应给放行例句');
  });

  test('rescued 通道 — 段内或紧邻下一拍的行动转向', () => {
    const line = lineOf(zh, 'rescued 通道');
    assert.ok(line.includes('紧邻下一拍'), '应说明邻拍窗口');
    assert.ok(line.includes('他人发言即止'), '应说明他人发言断窗');
    assert.ok(line.includes('擦干泪'), '应列出擦干泪');
    assert.ok(line.includes('冷笑'), '应列出冷笑');
    assert.ok(line.includes('明天就去'), '应列出具体决定');
  });

  test('rescue 口径 — 转折必须人物自己给', () => {
    const line = lineOf(zh, 'rescue 口径');
    assert.ok(line.includes('人物自己给'), '应说明转折归属');
    assert.ok(line.includes('求求你别走'), '应给出不算 rescue 的反例');
    assert.ok(line.includes('别人心软来哄'), '应说明他人安抚不算');
  });

  test('只算 bad — rescued 不进扣分，issues 只列 bad', () => {
    const line = lineOf(zh, '只算 bad');
    assert.ok(line.includes('bad = 未 rescued'), '应说明 bad 口径');
    assert.ok(line.includes('不参与扣分'), '应说明 rescued 豁免');
    assert.ok(line.includes('issues 只列 bad'), '应说明 issues 范围');
  });

  test('得分 — 0 次 100 / 1 次 80 / ≥2 次 max(30, 100 - n × 22)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 80'), '应给单次口径');
    assert.ok(line.includes('max(30, 100 - n × 22)'), '应给多次公式');
  });

  test('命中字段 — startLine / endLine / speaker / families / snippet 36 字 / rescueLine', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('startLine'), '应列出 startLine');
    assert.ok(line.includes('endLine'), '应列出 endLine');
    assert.ok(line.includes('speaker'), '应列出 speaker');
    assert.ok(line.includes('doom|heaven|blame|list'), '应列出四族取值');
    assert.ok(line.includes('36 字截断'), '应说明截断');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
  });

  test('邻居分界 — show-dont-tell / emotion-vent-cliche / rhetorical-barrage / 叙述行客观苦难', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('show-dont-tell'), '应点明 show-dont-tell');
    assert.ok(line.includes('emotion-vent-cliche'), '应点明 emotion-vent-cliche');
    assert.ok(line.includes('rhetorical-barrage'), '应点明 rhetorical-barrage');
    assert.ok(line.includes('管动作'), '应说明动作与语言的分工');
    assert.ok(line.includes('她三岁丧母'), '应说明叙述行客观苦难不扫');
  });

  test('pipeline 消费与成稿自查 — selfPityHint、v2.95 退役仅诊断、批量重扫、三连自查', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('selfPityHint'), '应说明 prePolish hint');
    assert.ok(line.includes('craft 初评/复评'), '应说明 craft 消费');
    assert.ok(line.includes('v2.95'), '应说明退役版本');
    assert.ok(line.includes('已退役'), '应说明仅诊断');
    assert.ok(line.includes('creative-batch-rescan'), '应说明批量重扫');
    const check = lineOf(zh, '成稿自查');
    assert.ok(check.includes('三连'), '应给自查触发形态');
    assert.ok(check.includes('带代价的动作'), '应给改写方向');
  });
});

describe('en — buildSelfPityDirective', () => {
  test('en 层存在、返回有效文本且零 CJK', () => {
    assert.equal(typeof mod.buildSelfPityDirective, 'function');
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(en.includes('Self-Pity Litany'), '标题应点明 Self-Pity Litany');
    assert.ok(en.includes('selfPityLitany'), '应与检测器同源');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现 CJK');
  });

  test('en 范围与 doom — dialogue only / merged segment / my whole life', () => {
    const scope = lineOf(en, 'Scope:');
    assert.ok(scope.includes('dialogue and inner-voice lines only'), '应说明只扫台词/心声行');
    assert.ok(scope.includes('dialogueLines'), '应说明台词行计数');
    const seg = lineOf(en, 'Segmentation:');
    assert.ok(seg.includes('merge into one speech segment'), '应说明合并发言段');
    const doom = lineOf(en, 'doom family:');
    assert.ok(doom.includes('my whole life'), '应列出 my whole life');
    assert.ok(doom.includes('born to suffer'), '应列出 born to suffer');
  });

  test('en heaven/blame/list — why me / what did I do wrong / two or more suffering facts', () => {
    const heaven = lineOf(en, 'heaven family:');
    assert.ok(heaven.includes('why me'), '应列出 why me');
    assert.ok(heaven.includes('life is so unfair'), '应列出 life is so unfair');
    const blame = lineOf(en, 'blame family:');
    assert.ok(blame.includes('what did I do wrong'), '应列出自我定罪');
    assert.ok(blame.includes('nobody wants me'), '应列出 nobody wants me');
    const list = lineOf(en, 'list family:');
    assert.ok(list.includes('two or more'), '应说明数量门槛');
    assert.ok(list.includes('orphaned'), '应列出 orphaned');
    assert.ok(list.includes('loan sharks'), '应列出 loan sharks');
  });

  test('en charged/rescue — 10 English words / lifted the chin / turn must come from the character', () => {
    const charged = lineOf(en, 'Charged rule:');
    assert.ok(charged.includes('two or more families'), '应说明族数门槛');
    assert.ok(charged.includes('10 English words'), '应给出长度阈值');
    const rescue = lineOf(en, 'Rescue channel:');
    assert.ok(rescue.includes('lifted the chin'), '应列出转身动作');
    assert.ok(rescue.includes('just you wait'), '应列出反抗台词');
    const standard = lineOf(en, 'Rescue standard:');
    assert.ok(standard.includes('come from the character'), '应说明转折归属');
    assert.ok(standard.includes('please do not leave me'), '应给出不算 rescue 的反例');
  });

  test('en 计分/字段/邻居/消费 — 80 / max(30) / 36 characters / v2.95 / batch-rescan', () => {
    const score = lineOf(en, 'Score:');
    assert.ok(score.includes('1 bad = 80'), '应给单次口径');
    assert.ok(score.includes('max(30, 100 - n x 22)'), '应给多次公式');
    const fields = lineOf(en, 'Hit fields:');
    assert.ok(fields.includes('startLine'), '应列出 startLine');
    assert.ok(fields.includes('36 characters'), '应说明截断');
    const nb = lineOf(en, 'Neighbours:');
    assert.ok(nb.includes('show-dont-tell'), '应点明 show-dont-tell');
    assert.ok(nb.includes('emotion-vent-cliche'), '应点明 emotion-vent-cliche');
    assert.ok(nb.includes('rhetorical-barrage'), '应点明 rhetorical-barrage');
    const pipe = lineOf(en, 'Pipeline:');
    assert.ok(pipe.includes('selfPityHint'), '应说明 hint');
    assert.ok(pipe.includes('v2.95'), '应说明退役版本');
    assert.ok(pipe.includes('batch-rescan'), '应说明批量重扫');
  });
});
