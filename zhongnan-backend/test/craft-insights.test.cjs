const { describe, it } = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/craft-insights.js');

describe('选题风向（带时效，女频3男频2）', () => {
  it('女频3、男频2', () => {
    assert.strictEqual(C.TOPIC_WIND.filter((t) => t.segment === '女频').length, 3);
    assert.strictEqual(C.TOPIC_WIND.filter((t) => t.segment === '男频').length, 2);
    assert.ok(C.TOPIC_WIND_ASOF);
  });
  it('按性别+载体过滤：漫剧女频可做成长/权谋/悬疑', () => {
    const r = C.recommendTopics('女频', '漫剧');
    assert.ok(r.length >= 2);
    assert.ok(r.every((t) => t.segment === '女频' && t.mediums.includes('漫剧')));
  });
  it('男频马甲方向强调每揭一层换一次情绪回报', () => {
    const vest = C.TOPIC_WIND.find((t) => t.id === 'male_underdog_vest');
    assert.ok(vest.core.includes('情绪回报'));
  });
});

describe('传播标题前13字公式', () => {
  it('身份+冲突+反差齐全=100分，且只取前13字', () => {
    const r = C.titlePitchCheck('屏幕别想困住我，重生现实大开金手指，超长后缀应该被截断');
    assert.strictEqual(r.first13.length, 13);
    assert.strictEqual(r.hasIdentity, true);
    assert.strictEqual(r.hasConflict, true);
    assert.strictEqual(r.hasContrast, true);
    assert.strictEqual(r.score, 100);
  });
  it('平淡标题低分并逐项给建议', () => {
    const r = C.titlePitchCheck('今天天气不错');
    assert.ok(r.score < 67);
    assert.ok(r.advice.some((a) => a.includes('身份')));
    assert.ok(r.advice.some((a) => a.includes('冲突')));
  });
});

describe('封闭微场景与通用偷懒反应', () => {
  it('内置饭桌/菜市场等微场景且带关系杠杆与示例', () => {
    const ids = C.MICRO_SCENES.map((s) => s.id);
    assert.ok(ids.includes('dinner_table') && ids.includes('wet_market'));
    assert.ok(C.MICRO_SCENES.every((s) => s.relationLevers.length >= 3 && s.example));
  });
  it('命中“震惊/居然是”等通用反应并要求换人物专属反应', () => {
    const r = C.genericReactionScan('她一脸不可置信，瞪大了眼睛：居然是他！');
    assert.ok(r.count >= 2);
    assert.ok(r.advice.includes === undefined || r.advice.length > 10);
  });
  it('干净文本不命中', () => {
    assert.strictEqual(C.genericReactionScan('阿姨把找零拍在摊上：两块钱你也磨半小时。').count, 0);
  });
});

describe('人物驱动校验', () => {
  it('无主动目标→判风险并给AIGC心理活动建议', () => {
    const r = C.characterDrivenScan('她被人欺负，被家里安排，事情一件件发生在她身上');
    assert.strictEqual(r.hasActiveGoal, false);
    assert.ok(r.advice.some((a) => a.includes('被剧情推着走')));
    assert.ok(r.advice.some((a) => a.includes('AIGC')));
  });
  it('有主动意志词→hasActiveGoal=true', () => {
    const r = C.characterDrivenScan('她决定夺回属于自己的公司，计划一步步布局');
    assert.strictEqual(r.hasActiveGoal, true);
  });
});

describe('岗位实战指令片段', () => {
  it('架构/成稿/观众/市场四段都非空且含各自关键要求', () => {
    assert.ok(C.craftArchitectBrief().includes('选题风向') && C.craftArchitectBrief().includes('微场景'));
    assert.ok(C.craftWriterBrief().includes('情绪兑付'));
    assert.ok(C.craftAudienceBrief().includes('情绪代偿'));
    assert.ok(C.craftMarketBrief().includes('前13字'));
  });
  it('来源可追溯且如实标注2条未提取', () => {
    assert.strictEqual(C.CRAFT_SOURCE.extracted, 7);
    assert.strictEqual(C.CRAFT_SOURCE.blocked.length, 2);
  });
});

describe('v1.98 四岗位实战 brief 中英双语', () => {
  const cjk = (s) => /[一-鿿]/.test(s);
  it('默认与显式 zh 逐字一致、关键中文要求仍在', () => {
    assert.strictEqual(C.craftArchitectBrief(), C.craftArchitectBrief('zh'));
    assert.strictEqual(C.craftWriterBrief(), C.craftWriterBrief('zh'));
    assert.strictEqual(C.craftAudienceBrief(), C.craftAudienceBrief('zh'));
    assert.strictEqual(C.craftMarketBrief(), C.craftMarketBrief('zh'));
  });
  it('英文四段非空、零中文，且各自承载对应方法论', () => {
    const a = C.craftArchitectBrief('en'), w = C.craftWriterBrief('en'), u = C.craftAudienceBrief('en'), m = C.craftMarketBrief('en');
    [a, w, u, m].forEach((s) => { assert.ok(s.length > 40); assert.ok(!cjk(s), '英文 brief 零中文'); });
    assert.ok(/Topic winds/i.test(a) && /micro-scene/i.test(a));
    assert.ok(/relationship levers/i.test(w) && /emotional/i.test(w));
    assert.ok(/emotional-compensation/i.test(u) && /swipe away/i.test(u));
    assert.ok(/first 13 characters/i.test(m));
  });
  it('英文架构 brief 覆盖全部5个选题风向（id 键控，不丢项）', () => {
    const a = C.craftArchitectBrief('en');
    Object.keys(C.TOPIC_EN).forEach((id) => assert.ok(a.includes(C.TOPIC_EN[id].name), `缺选题 ${id}`));
  });
  it('genericReactionScan 建议双语、中文偷懒反应检测不受影响', () => {
    assert.ok(!cjk(C.genericReactionScan('', 'en').advice));
    assert.ok(C.genericReactionScan('').advice.includes('通用反应'));
    assert.strictEqual(C.genericReactionScan('她一脸不可置信，瞪大了眼睛').count, 2);
  });
});
