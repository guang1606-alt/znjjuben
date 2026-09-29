'use strict';
// v2.133 配角工具人/群像质量检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { supportingCharacterCheck } = require('../dist/engine/supporting-character-check.js');

// —— 中文健康短剧：主角 + 有自我欲望线的闺蜜 + 有欲望的反派 + 有立场的律师 ——
const ZH_HEALTHY = `场景一 公司会议室
林晚：赵天成，你伪造签名的合同，我找到了。
林晚：我要的不是钱，是你们赵家当众认错。
林晚：给陈律师打电话，现在就报警。
林晚：这份遗嘱的日期比离婚协议晚三年。
林晚：我等这一天等了五年。
林晚：明天的发布会，我亲自出席。
△ 苏晴推门进来，把一叠银行流水拍在桌上。
苏晴：我查到资金流到了空壳公司。
苏晴：我决定明天去董事会摊牌。
苏晴：这是我的账，我自己算。
苏晴：林晚，你撑住，我带记者在楼下等。
△ 赵天成拍桌站起。
赵天成：你以为凭一份复印件就能扳倒我？
赵天成：我要让你在这个城市待不下去。
赵天成：保安，把她给我赶出去！
△ 陈律师推了推眼镜。
陈律师：林女士，证据链已经完整。
陈律师：我申请了证据保全，他的资产冻结了。
陈律师：我怀疑对方还有后手。`;

// —— 捧哏型配角：六句全是反应，零欲望 ——
const ZH_ECHO = `场景一 客厅
林晚：我找到他挪用公款的证据了。
林晚：明天董事会，我要当众揭穿他。
林晚：他手里的那份合同是伪造的。
林晚：记者我已经联系好了。
林晚：这一次，我不会再退让。
林晚：财务总监也答应出庭作证。
林晚：发布会定在上午十点。
△ 小芳端着茶杯坐在旁边，不停点头。
小芳：嗯。
小芳：真的吗？
小芳：天哪！
小芳：然后呢？
小芳：太好了，他终于要倒台了。
小芳：你说得对，我就知道你行的！`;

// —— 信息播报员 ——
const ZH_INFO = `场景一 办公室
林晚：周助理，外面什么情况？
林晚：赵天成今天去了哪里？
林晚：文件都核实过了吗？
林晚：几点开会？
林晚：记者那边安排好了？
林晚：你先出去吧。
△ 周助理递上文件袋。
周助理：林总，告诉你个消息，赵总刚才去了公证处。
周助理：报告！这是你要的文件。
周助理：根据资料显示，他上周转走了三千万。
周助理：董事长让我转告你，会议提前了。`;

// —— 无欲望保姆：全程服务主角 ——
const ZH_SERVE = `场景一 出租屋
林晚：我现在什么都没有了。
林晚：他把孩子也带走了。
林晚：我不敢回家。
林晚：手机一直在响。
林晚：我睡不着。
林晚：明天还要去法院。
△ 小夏握住林晚的手。
小夏：我陪你回去，别怕。
小夏：你没事吧？脸色这么差。
小夏：别担心，一切都会过去的。
小夏：我帮你约了医生，明天我陪你去。`;

// —— 夸夸群像：两个配角排队吹主角 ——
const ZH_CHORUS = `场景一 宴会厅
林晚：项目是我带队拿下来的。
林晚：合同在这里，各位可以传看。
林晚：对方的报价我压了三成。
林晚：预付款已经到账。
林晚：明年的目标是翻倍。
林晚：谢谢大家。
张磊：不愧是林总，佩服佩服！
李娜：还是你行，这一仗打得漂亮！`;

// —— 只动嘴的纸片人：动作描写从不出现，且功能句占满 ——
const ZH_OFFSTAGE = `场景一 办公室
林晚：董事长还没来吗？
林晚：今天的会议还开不开？
林晚：他知道证据的事吗？
林晚：我就在这里等。
林晚：把灯打开。
林晚：再给我倒杯水。
△ 林晚望向窗外，雨越下越大。
小周：嗯，我听说了。
小周：董事长让我转告，会议取消。
小周：我陪你等他回来。
小周：别担心。`;

// —— 英文健康短剧 ——
const EN_HEALTHY = `SCENE 1. BOARDROOM
Emma: Your forged contract is in my hands.
Emma: I want a public apology, not money.
Emma: Call the police. Right now.
Emma: This will is dated three years after the divorce.
Emma: I've waited five years for this day.
Emma: I'll speak at the press conference myself.
Lucy pushed the door open and dropped the bank statements on the table.
Lucy: I found out the money went to a shell company.
Lucy: I've decided to face the board tomorrow.
Lucy: My company is on the line too.
Lucy: I'll handle the reporters downstairs.
Jack slammed the table and stood up.
Jack: You think a copied document can take me down?
Jack: I will make sure you never work in this city again.
Jack: Guards, throw her out!
Clark adjusted his glasses calmly.
Clark: Ms. Lin, the chain of evidence is complete.
Clark: I filed for asset preservation; his assets are frozen.
Clark: I suspect he has a backup plan.`;

const EN_ECHO = `SCENE 1. LIVING ROOM
Emma: I found proof that he embezzled the funds.
Emma: I'm going to expose him at the board meeting tomorrow.
Emma: The contract in his hand is forged.
Emma: I've already contacted the reporters.
Emma: This time I will not back down.
Emma: The finance director agreed to testify.
Emma: The press conference is set for ten.
Anna nodded along, holding her teacup.
Anna: Wow.
Anna: Really?
Anna: Oh my god!
Anna: Then what?
Anna: That's amazing!
Anna: You're right, I knew you could do it!`;

const EN_INFO = `SCENE 1. OFFICE
Emma: What's happening outside?
Emma: Where did he go today?
Emma: Have the documents been verified?
Emma: What time is the meeting?
Emma: Are the reporters arranged?
Emma: You can go now.
Nina handed over the envelope.
Nina: Ms. Lin, I have news. He went to the notary.
Nina: The report says he transferred thirty million last week.
Nina: According to the records, the contract predates the merger.
Nina: Mr. Zhao asked me to give you this file.`;

const EN_SERVE = `SCENE 1. APARTMENT
Emma: I have nothing left now.
Emma: He took the children too.
Emma: I can't go home.
Emma: My phone keeps ringing.
Emma: I can't sleep.
Emma: I have court tomorrow.
Mia held Emma's hand tightly.
Mia: I'll come with you. Don't be scared.
Mia: Are you okay? You look terrible.
Mia: Don't worry. It'll pass.
Mia: I'll drive you to the doctor tomorrow.`;

const CJK = /[\u4e00-\u9fff]/;

test('中文紧凑短剧应无配角工具人问题且得高分', () => {
  const r = supportingCharacterCheck(ZH_HEALTHY, null, 'zh');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际：${JSON.stringify(r.issues)}`);
  assert.ok(r.score >= 75, `分数应≥75，实际 ${r.score}`);
  assert.strictEqual(r.protagonist, '林晚');
  assert.ok(r.supportingChars >= 3, `参检配角应≥3，实际 ${r.supportingChars}`);
  assert.strictEqual(r.toolChars, 0);
  assert.strictEqual(r.echoCount, 0);
  assert.ok(!r.praiseChorus);
});

test('捧哏型配角应触发 echo_sidekick（high）', () => {
  const r = supportingCharacterCheck(ZH_ECHO, null, 'zh');
  const echo = r.issues.find((i) => i.type === 'echo_sidekick');
  assert.ok(echo, '应有 echo_sidekick 问题');
  assert.strictEqual(echo.severity, 'high');
  assert.ok(r.echoCount >= 1);
  assert.ok(r.score < 90, `应明显扣分，实际 ${r.score}`);
  const fang = r.characters.find((c) => c.name === '小芳');
  assert.ok(fang, '画像中应有小芳');
  assert.ok(fang.reactRatio >= 0.6, `反应句占比应≥0.6，实际 ${fang.reactRatio}`);
  assert.strictEqual(fang.desireHits, 0);
  assert.ok(fang.flags.includes('echo_sidekick'));
});

test('信息播报员应触发 info_dispenser（mid）', () => {
  const r = supportingCharacterCheck(ZH_INFO, null, 'zh');
  const info = r.issues.find((i) => i.type === 'info_dispenser');
  assert.ok(info, '应有 info_dispenser 问题');
  assert.strictEqual(info.severity, 'mid');
  assert.ok(r.dispenserCount >= 1);
  const zhou = r.characters.find((c) => c.name === '周助理');
  assert.ok(zhou.infoLines >= 2);
  assert.strictEqual(zhou.desireHits, 0);
});

test('无欲望保姆应触发 desireless_supporter（mid）', () => {
  const r = supportingCharacterCheck(ZH_SERVE, null, 'zh');
  const d = r.issues.find((i) => i.type === 'desireless_supporter');
  assert.ok(d, '应有 desireless_supporter 问题');
  assert.strictEqual(d.severity, 'mid');
  assert.ok(r.desirelessCount >= 1);
  const xia = r.characters.find((c) => c.name === '小夏');
  assert.ok(xia.serveLines >= 2);
  assert.strictEqual(xia.desireHits, 0);
  // 有动作描写，不应叠加 offstage
  assert.ok(!xia.flags.includes('offstage_mouthpiece'));
});

test('排队夸主角应触发 praise_chorus（low）', () => {
  const r = supportingCharacterCheck(ZH_CHORUS, null, 'zh');
  const c = r.issues.find((i) => i.type === 'praise_chorus');
  assert.ok(c, '应有 praise_chorus 问题');
  assert.strictEqual(c.severity, 'low');
  assert.strictEqual(r.praiseChorus, true);
});

test('只动嘴不动身的配角应触发 offstage_mouthpiece（low）', () => {
  const r = supportingCharacterCheck(ZH_OFFSTAGE, null, 'zh');
  const o = r.issues.find((i) => i.type === 'offstage_mouthpiece');
  assert.ok(o, '应有 offstage_mouthpiece 问题');
  assert.strictEqual(o.severity, 'low');
  assert.ok(r.offstageCount >= 1);
  const zhou = r.characters.find((c) => c.name === '小周');
  assert.strictEqual(zhou.actionMentions, 0);
  assert.ok(zhou.flags.includes('offstage_mouthpiece'));
});

test('空文本/超短文本/对白不足应返回满分不崩溃', () => {
  const r1 = supportingCharacterCheck('', null, 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.issues.length, 0);
  const r2 = supportingCharacterCheck('你好', null, 'zh');
  assert.strictEqual(r2.score, 100);
  // 对白不足 6 行：不检测
  const r3 = supportingCharacterCheck('林晚：你好\n小芳：嗯', null, 'zh');
  assert.strictEqual(r3.score, 100);
  assert.strictEqual(r3.issues.length, 0);
});

test('英文紧凑短剧应无工具人问题且得高分', () => {
  const r = supportingCharacterCheck(EN_HEALTHY, null, 'en');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际：${JSON.stringify(r.issues)}`);
  assert.ok(r.score >= 75, `分数应≥75，实际 ${r.score}`);
  assert.strictEqual(r.protagonist, 'Emma');
  assert.ok(r.supportingChars >= 3);
  assert.strictEqual(r.toolChars, 0);
});

test('英文捧哏型配角应触发 echo_sidekick', () => {
  const r = supportingCharacterCheck(EN_ECHO, null, 'en');
  const echo = r.issues.find((i) => i.type === 'echo_sidekick');
  assert.ok(echo, '应有 echo_sidekick');
  assert.strictEqual(echo.severity, 'high');
  const anna = r.characters.find((c) => c.name === 'Anna');
  assert.ok(anna.reactRatio >= 0.6);
  assert.strictEqual(anna.desireHits, 0);
});

test('英文信息播报员应触发 info_dispenser', () => {
  const r = supportingCharacterCheck(EN_INFO, null, 'en');
  assert.ok(r.issues.some((i) => i.type === 'info_dispenser'), JSON.stringify(r.issues));
  const nina = r.characters.find((c) => c.name === 'Nina');
  assert.ok(nina.infoLines >= 2);
  assert.strictEqual(nina.desireHits, 0);
});

test('英文无欲望保姆应触发 desireless_supporter', () => {
  const r = supportingCharacterCheck(EN_SERVE, null, 'en');
  assert.ok(r.issues.some((i) => i.type === 'desireless_supporter'), JSON.stringify(r.issues));
  const mia = r.characters.find((c) => c.name === 'Mia');
  assert.ok(mia.serveLines >= 2);
  assert.strictEqual(mia.desireHits, 0);
  assert.ok(!mia.flags.includes('offstage_mouthpiece'));
});

test('英文模式输出不得含中文', () => {
  for (const fx of [EN_ECHO, EN_INFO, EN_SERVE]) {
    const r = supportingCharacterCheck(fx, null, 'en');
    for (const i of r.issues) {
      assert.ok(!CJK.test(i.evidence), `evidence 含中文：${i.evidence}`);
      assert.ok(!CJK.test(i.advice), `advice 含中文：${i.advice}`);
    }
  }
});

test('字段边界合法', () => {
  const r = supportingCharacterCheck(ZH_ECHO, null, 'zh');
  assert.ok(Number.isFinite(r.score) && r.score >= 0 && r.score <= 100);
  assert.ok(Array.isArray(r.characters));
  assert.ok(r.speakingChars >= 2);
  assert.ok(r.toolChars >= 1);
  assert.ok(typeof r.protagonist === 'string' && r.protagonist.length > 0);
  for (const c of r.characters) {
    assert.ok(c.lineCount >= 3);
    assert.ok(c.reactRatio >= 0 && c.reactRatio <= 1);
    assert.ok(Array.isArray(c.flags));
  }
  for (const i of r.issues) {
    assert.ok(['high', 'mid', 'low'].includes(i.severity));
    assert.ok(i.evidence.length > 0 && i.advice.length > 0);
  }
});
