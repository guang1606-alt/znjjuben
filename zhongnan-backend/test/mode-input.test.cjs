const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/mode-input.js');

describe('模式表单事实源·sanitizeModeInput 清洗', () => {
  it('persona 四字段 trim 入库、超长截断、非字符串剔除', () => {
    const mi = M.sanitizeModeInput({
      persona: {
        identity: '  32 岁急诊医生  ', want: '查出真相', fear: '自己早知道', lie: '「我没事」',
      },
    }, 'persona');
    assert.deepStrictEqual(mi, { persona: { identity: '32 岁急诊医生', want: '查出真相', fear: '自己早知道', lie: '「我没事」' } });
    const long = M.sanitizeModeInput({ persona: { identity: '长'.repeat(500), want: 'x' } }, 'persona');
    assert.ok(long.persona.identity.length <= 120);
  });
  it('persona 全空不收；其他命名空间按模式剥离', () => {
    assert.strictEqual(M.sanitizeModeInput({ persona: { identity: ' ', want: '', fear: '', lie: '' } }, 'persona'), undefined);
    // 当前模式是 duel 时，persona 命名空间不落库
    const d = M.sanitizeModeInput({ persona: { identity: '医生' }, duel: { a: { identity: 'CEO', want: '裁员', line: '生死协议' }, b: { identity: '老员工', want: '保兄弟', line: '车库情分' } } }, 'duel');
    assert.ok(!d.persona);
    assert.strictEqual(d.duel.a.identity, 'CEO');
    assert.strictEqual(d.duel.b.line, '车库情分');
  });
  it('duel 一侧全空剔除该侧；两侧全空 undefined', () => {
    const one = M.sanitizeModeInput({ duel: { a: { identity: 'CEO' }, b: { identity: ' ', want: '', line: '' } } }, 'duel');
    assert.ok(one.duel.a && !one.duel.b);
    assert.strictEqual(M.sanitizeModeInput({ duel: { a: {}, b: {} } }, 'duel'), undefined);
  });
  it('multiverse 空 route 行剔除、超 4 条截断、choice 入库', () => {
    const mi = M.sanitizeModeInput({
      multiverse: {
        choice: '  保险单受益人不是她  ',
        lines: [
          { route: '假装不知道', cost: '三年后成弃子' },
          { route: '  ', cost: '空路线剔除' },
          { route: '当场摊牌', cost: '净身出户' },
          { route: '第三条', cost: '' },
          { route: '第四条', cost: '' },
          { route: '第五条截断', cost: '' },
        ],
      },
    }, 'multiverse');
    assert.strictEqual(mi.multiverse.choice, '保险单受益人不是她');
    assert.strictEqual(mi.multiverse.lines.length, 4);
    assert.strictEqual(mi.multiverse.lines[0].route, '假装不知道');
    assert.strictEqual(mi.multiverse.lines[3].route, '第四条');
  });
  it('multiverse choice 与 lines 全空 undefined', () => {
    assert.strictEqual(M.sanitizeModeInput({ multiverse: { choice: ' ', lines: [] } }, 'multiverse'), undefined);
  });
  it('diary 合法档透传、非法档不落库', () => {
    assert.deepStrictEqual(M.sanitizeModeInput({ diary: { auth: 'selected' } }, 'diary'), { diary: { auth: 'selected' } });
    assert.deepStrictEqual(M.sanitizeModeInput({ diary: { auth: 'summary' } }, 'diary'), { diary: { auth: 'summary' } });
    assert.strictEqual(M.sanitizeModeInput({ diary: { auth: 'everything' } }, 'diary'), undefined);
  });
  it('非四模式（tag/spark 等）一律不落库；raw 非对象安全', () => {
    assert.strictEqual(M.sanitizeModeInput({ persona: { identity: '医生' } }, 'tag'), undefined);
    assert.strictEqual(M.sanitizeModeInput('garbage', 'persona'), undefined);
    assert.strictEqual(M.sanitizeModeInput(null, 'persona'), undefined);
    assert.strictEqual(M.sanitizeModeInput(undefined, 'persona'), undefined);
  });
});

describe('模式表单事实源·buildModeInputDirective 双语指令', () => {
  it('persona 中文指令：身份/欲望/恐惧/谎言齐备 + 不可靠叙述铁律', () => {
    const d = M.buildModeInputDirective('persona', { persona: { identity: '急诊医生', want: '查真相', fear: '早知道', lie: '我没事' } }, 'zh');
    assert.ok(d.includes('急诊医生') && d.includes('查真相') && d.includes('早知道') && d.includes('我没事'));
    assert.ok(/不可靠叙述|自欺|撕开/.test(d));
  });
  it('persona 英文指令同字段', () => {
    const d = M.buildModeInputDirective('persona', { persona: { identity: 'ER doctor', want: 'truth', fear: 'knew it', lie: 'I am fine' } }, 'en');
    assert.ok(d.includes('ER doctor') && d.includes('truth') && d.includes('knew it') && d.includes('I am fine'));
    assert.ok(/unreliable/i.test(d));
  });
  it('duel 指令含 A/B 双方与「都有道理」铁律', () => {
    const d = M.buildModeInputDirective('duel', { duel: { a: { identity: 'CEO', want: '裁员', line: '生死协议' }, b: { identity: '老员工', want: '保兄弟', line: '车库情分' } } }, 'zh');
    assert.ok(d.includes('CEO') && d.includes('老员工') && d.includes('生死协议') && d.includes('车库情分'));
    assert.ok(/都有道理|轮流出招|加码/.test(d));
  });
  it('multiverse 指令含关键选择与各世界线路线/代价', () => {
    const d = M.buildModeInputDirective('multiverse', { multiverse: { choice: '受益人不是她', lines: [{ route: '装不知道', cost: '成弃子' }, { route: '摊牌', cost: '净身出户' }] } }, 'zh');
    assert.ok(d.includes('受益人不是她') && d.includes('装不知道') && d.includes('成弃子') && d.includes('摊牌') && d.includes('净身出户'));
    assert.ok(/自洽|不可逆/.test(d));
  });
  it('diary 指令含授权档与使用边界', () => {
    const d = M.buildModeInputDirective('diary', { diary: { auth: 'summary' } }, 'zh');
    assert.ok(/摘要/.test(d) && /逐字|引用/.test(d));
    const d2 = M.buildModeInputDirective('diary', { diary: { auth: 'full' } }, 'zh');
    assert.ok(/全部放行|完整/.test(d2) && /化名/.test(d2));
  });
  it('空输入/模式不匹配 → 空串', () => {
    assert.strictEqual(M.buildModeInputDirective('persona', null, 'zh'), '');
    assert.strictEqual(M.buildModeInputDirective('tag', { persona: { identity: 'x' } }, 'zh'), '');
    assert.strictEqual(M.buildModeInputDirective('persona', { duel: { a: { identity: 'x' } } }, 'zh'), '');
  });
});

describe('v2.346 diary 三档授权·applyDiaryAuth 岗位分级裁剪', () => {
  const diary = '今天被领导当众批评，我攥紧了笔。\n// 纳入 晚上回家妈妈说：没事，吃饭。\n其实我想哭，但忍住了。';
  it('summary：架构师得全文提炼梗概，撰写师与原文隔离', () => {
    assert.strictEqual(M.applyDiaryAuth('summary', diary, 'architect'), diary);
    assert.strictEqual(M.applyDiaryAuth('summary', diary, 'writer'), '');
  });
  it('summary：闸门拿全文做逐字引用校验', () => {
    assert.strictEqual(M.applyDiaryAuth('summary', diary, 'gate'), diary);
  });
  it('selected：双岗位仅见「// 纳入」段（标记剥离），闸门见未纳入段', () => {
    const inc = M.applyDiaryAuth('selected', diary, 'architect');
    assert.ok(inc.includes('晚上回家妈妈说：没事，吃饭。'));
    assert.ok(!inc.includes('//'));
    assert.ok(!inc.includes('攥紧了笔'));
    assert.strictEqual(M.applyDiaryAuth('selected', diary, 'writer'), inc);
    const exc = M.applyDiaryAuth('selected', diary, 'gate');
    assert.ok(exc.includes('攥紧了笔') && exc.includes('忍住了'));
    assert.ok(!exc.includes('妈妈说'));
  });
  it('selected 支持英文 // include 标记', () => {
    const en = 'Got yelled at.\n// include Mom said: dinner first.\nI held back tears.';
    const inc = M.applyDiaryAuth('selected', en, 'writer');
    assert.ok(inc.includes('Mom said: dinner first.') && !inc.includes('yelled'));
  });
  it('selected 无任何标记 → 双岗位空、闸门全文禁引', () => {
    assert.strictEqual(M.applyDiaryAuth('selected', '无标记的日记全文', 'architect'), '');
    assert.strictEqual(M.applyDiaryAuth('selected', '无标记的日记全文', 'gate'), '无标记的日记全文');
  });
  it('full：双岗位全文，闸门不查（脱敏靠指令）', () => {
    assert.strictEqual(M.applyDiaryAuth('full', diary, 'writer'), diary);
    assert.strictEqual(M.applyDiaryAuth('full', diary, 'architect'), diary);
    assert.strictEqual(M.applyDiaryAuth('full', diary, 'gate'), '');
  });
  it('空文本 → 空；非法档兜底最严按 summary 处理', () => {
    assert.strictEqual(M.applyDiaryAuth('summary', '', 'architect'), '');
    assert.strictEqual(M.applyDiaryAuth('bogus', diary, 'writer'), '');
    assert.strictEqual(M.applyDiaryAuth('bogus', diary, 'architect'), diary);
  });
});
