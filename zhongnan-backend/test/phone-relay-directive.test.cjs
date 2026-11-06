'use strict';
// v2.413 phone-relay 教学函数同源对齐测试
// 锚点紧贴引擎源码：电话锚点行 + 12 非空行窗口 + 场头截断 + 只数台词行 /
// 回声与内容复读词表 / 分句计数 / 阈值(内容≥1 或 回声≥3) / 三重豁免 / 40+10 扣分封底 20

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/phone-relay.js');

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

const zh = mod.buildPhoneRelayDirective('LIVE', 'zh');
const en = mod.buildPhoneRelayDirective('LIVE', 'en');

describe('zh — buildPhoneRelayDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildPhoneRelayDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('电话传话机'), '标题应点明电话传话机');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildPhoneRelayDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildPhoneRelayDirective(undefined, 'zh'), zh);
  });

  test('触发条件 — 先有电话锚点行，再算 12 个非空行窗口', () => {
    const line = lineOf(zh, '触发条件');
    assert.ok(line.includes('电话语境锚点'), '应说明需要锚点行');
    assert.ok(line.includes('接起'), '应列出接起类锚点');
    assert.ok(line.includes('12 个非空行'), '应给出窗口 12 行');
  });

  test('窗口遇场头立即截断', () => {
    assert.ok(zh.includes('遇场头立即截断'), '场头应截断窗口');
  });

  test('窗口内只数「角色：台词」行', () => {
    const line = lineOf(zh, '只数');
    assert.ok(line.includes('角色：台词'), '应说明只数台词行');
    assert.ok(line.includes('动作行'), '应说明动作行不参与');
  });

  test('复读回声词表', () => {
    const line = lineOf(zh, '复读回声（');
    assert.ok(line.includes('你再说一遍'), '应列出你再说一遍');
    assert.ok(line.includes('我马上到'), '应列出我马上到');
    assert.ok(line.includes('哪家医院'), '应列出哪家医院');
  });

  test('内容复读词表 — 把对方刚说的事实原样念回', () => {
    const line = lineOf(zh, '内容复读（');
    assert.ok(line.includes('死了'), '应列出死了');
    assert.ok(line.includes('签了'), '应列出签了');
    assert.ok(line.includes('原样念回'), '应说明内容复读定义');
  });

  test('分句计数 — 「什么？！他死了？我马上到！」算 3 句不是 1 句', () => {
    const line = lineOf(zh, '分句');
    assert.ok(line.includes('算 3 句'), '应按分句计数');
    assert.ok(line.includes('不是 1 句'), '应否定整行算一句');
  });

  test('阈值一 — 内容复读 ≥1 句即中', () => {
    assert.ok(zh.includes('内容复读 ≥1 句即中'), '内容复读一句即触发');
  });

  test('阈值二 — 回声 ≥3 句即中', () => {
    assert.ok(zh.includes('回声 ≥3 句即中'), '回声三句即触发');
  });

  test('豁免一 — 对切/另一边可见', () => {
    const line = lineOf(zh, '豁免一');
    assert.ok(line.includes('INTERCUT'), '应列出 INTERCUT');
    assert.ok(line.includes('画外音'), '应列出画外音');
    assert.ok(line.includes('不判'), '应说明豁免结论');
  });

  test('豁免二 — 说话人写成画外/电话/听筒/对方/V.O.', () => {
    const line = lineOf(zh, '豁免二');
    assert.ok(line.includes('听筒'), '应列出听筒');
    assert.ok(line.includes('V.O.'), '应列出 V.O.');
  });

  test('豁免三 — 非电话语境的当面震惊不判', () => {
    const line = lineOf(zh, '豁免三');
    assert.ok(line.includes('当面震惊'), '应说明当面震惊豁免');
    assert.ok(line.includes('电话锚点行'), '应强调必须有锚点行');
  });

  test('得分公式 — max(20, 100 - 命中条数 × 40 - 内容复读总句数 × 10)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(20, 100 - 命中条数 × 40 - 内容复读总句数 × 10)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('改写方向 — 直接切现场 / 只给半句再挂断', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('直接切现场'), '应要求切现场');
    assert.ok(line.includes('人没了'), '应给出半句示例');
  });

  test('分工 — info-delivery / character-presence / action-echo 不重叠', () => {
    const line = lineOf(zh, '与 info-delivery 分界');
    assert.ok(line.includes('info-delivery'), '应点明 info-delivery 分工');
    assert.ok(line.includes('character-presence'), '应点明 character-presence 分工');
    assert.ok(line.includes('action-echo'), '应点明 action-echo 分工');
  });

  test('pipeline 消费 phoneRelayHint + 成稿自查', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('phoneRelayHint'), '应点明注入的提示名');
    assert.ok(zh.includes('被角色念出来的'), '应给出成稿自查问句');
  });
});

describe('en — buildPhoneRelayDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('窗口与阈值 — 12 non-empty line window + content 1 / echo 3', () => {
    assert.ok(en.includes('12 non-empty line window'), '应给出 12 行窗口');
    assert.ok(en.includes('content echo >= 1'), '应给出内容复读阈值');
    assert.ok(en.includes('echo count >= 3'), '应给出回声阈值');
  });

  test('回声与内容复读词表', () => {
    assert.ok(en.includes('say that again'), '应列出 say that again');
    assert.ok(en.includes('I will be right there'), '应列出 I will be right there');
    assert.ok(en.includes('you are telling me'), '应列出内容复读开头');
  });

  test('得分 — max(20, 100 - hits x 40 - contentEchoes x 10)', () => {
    assert.ok(en.includes('max(20, 100 - hits x 40 - contentEchoes x 10)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('phoneRelayHint'), '应点明提示名');
    assert.equal(mod.buildPhoneRelayDirective('AIGC', 'en'), en);
    assert.equal(mod.buildPhoneRelayDirective(undefined, 'en'), en);
  });
});
