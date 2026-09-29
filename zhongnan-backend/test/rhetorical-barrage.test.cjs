// v2.80 反问连珠检测（Rhetorical Barrage）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/rhetorical-barrage.js');

const HEADER = '内景·客厅·夜';

describe('v2.80 rhetorical-barrage 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.rhetoricalBarrage('').score, 100);
  });
});

describe('v2.80 rhetorical-barrage 命中', () => {
  test('同一人夹短回应连发三问，判 1 hit', () => {
    const draft = [
      HEADER,
      '林棠：你凭什么查我手机？',
      '沈知远：我……',
      '林棠：你有什么资格翻我东西？',
      '沈知远：你听我解释。',
      '林棠：解释？你配吗？',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].speaker, '林棠');
    assert.ok(r.hits[0].questionCount >= 3);
    assert.ok(r.score < 100);
  });

  test('同 speaker 连续三行反问也判', () => {
    const draft = [
      HEADER,
      '林棠：你凭什么查我？',
      '林棠：你有什么资格？',
      '林棠：你当我是傻子吗？',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.equal(r.hits.length, 1);
  });

  test('单句三个问号带框架词判', () => {
    const draft = [
      HEADER,
      '林棠：你凭什么？你配吗？你当我瞎吗？',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.ok(r.hits.some((h) => h.startLine === h.endLine));
  });
});

describe('v2.80 rhetorical-barrage 豁免', () => {
  test('每问钉新事实不判（信息递进）', () => {
    const draft = [
      HEADER,
      '林棠：昨晚十点你在哪？',
      '沈知远：在公司。',
      '林棠：那公司楼下监控里，上你车的女人是谁？',
      '沈知远：你跟踪我？',
      '林棠：她手里那份股权转让书，你准备什么时候给我看？',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    // 林棠的问句被对方长回应隔开，不构成连珠
    assert.equal(r.hits.filter((h) => h.speaker === '林棠').length, 0);
  });

  test('夹的回应太长不算连珠（对方真在辩解）', () => {
    const draft = [
      HEADER,
      '林棠：你凭什么查我手机？',
      '沈知远：因为你上周开始改密码删记录，出差说是去上海但航班记录在三亚，我必须知道真相。',
      '林棠：你有什么资格翻我东西？',
      '沈知远：东西是我买的，家是我供的。',
      '林棠：你配吗？',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.equal(r.hits.length, 0);
  });

  test('只有两个问句不判', () => {
    const draft = [
      HEADER,
      '林棠：你凭什么查我手机？',
      '沈知远：我……',
      '林棠：你有什么资格？',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.equal(r.hits.length, 0);
  });

  test('普通连续追问无反问框架不判', () => {
    const draft = [
      HEADER,
      '警察：姓名？',
      '嫌犯：张三。',
      '警察：年龄？',
      '嫌犯：三十五。',
      '警察：住址？',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 rhetorical-barrage en', () => {
  test('barrage with short deflections flagged', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'Anna: How dare you check my phone?',
      'Ben: I...',
      'Anna: Who do you think you are?',
      'Ben: Listen.',
      'Anna: Do you even trust me at all?',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].speaker, 'Anna');
  });

  test('factual escalation exempt', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'Anna: Where were you at ten last night?',
      'Ben: At the office working late on the merger papers.',
      'Anna: Then who is the woman in the lobby camera getting into your car?',
      'Ben: Are you spying on me now?',
    ].join('\n');
    const r = M.rhetoricalBarrage(draft);
    assert.equal(r.hits.length, 0);
  });
});
