'use strict';
// v2.142 翻盘证据链公平性检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { evidenceChainCheck } = require('../dist/engine/evidence-chain-check.js');

const sum = (r) => r.scenes.reduce((a, s) => a + s.flagCount, 0);

// —— 1. 空文本 / 超短文本：满分 ——
test('empty / short text returns full score', () => {
  for (const t of ['', '   ', '太短了']) {
    const r = evidenceChainCheck(t, 'zh');
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.issueCount, 0);
    assert.strictEqual(r.sceneCount, 0);
  }
});

// —— 2. 无标题文本按单场处理 ——
test('header-less text treated as one scene', () => {
  const r = evidenceChainCheck('林晚没有标题，她当众播放录音，里面传出赵天成的声音。全场哗然。', 'zh');
  assert.strictEqual(r.sceneCount, 1);
  assert.strictEqual(r.issues[0].type, 'unplanted_evidence');
  assert.strictEqual(r.issues[0].scene, 1);
});

// —— 3. ZH 物证无铺垫：单次 mid -12 ——
test('zh: unplanted recording show is mid', () => {
  const txt = `场景三 宴会厅 夜
林晚走到台前，当众播放那段录音，里面传出赵天成的声音。
全场哗然，赵天成脸色煞白。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 88);
  assert.strictEqual(r.showCount, 1);
  assert.strictEqual(r.plantCount, 0);
  assert.strictEqual(r.issues[0].type, 'unplanted_evidence');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.match(r.issues[0].evidence, /^第1场：/);
  assert.ok(r.issues[0].advice.length > 20);
  assert.strictEqual(r.issues[0].key, 'unplanted');
});

// —— 4. ZH 先埋后打（跨场）：满分 + 正信号 ——
test('zh: planted earlier then shown is fair', () => {
  const txt = `场景一 办公室 夜
林晚偷偷把录音笔藏进花瓶，按下了开关。
赵天成交代了做假账的全部经过，全被录下。
场景三 宴会厅 夜
林晚当众播放那段录音，里面传出赵天成的声音。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.fairShowCount, 1);
  assert.strictEqual(r.plantCount, 1);
});

// —— 5. ZH 同行事后补铺垫无效（契诃夫之枪必须先响）——
test('zh: same-line retroactive plant still unplanted', () => {
  const txt = `场景三 宴会厅 夜
林晚播放录音——这是她提前让人录好的，全场哗然。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.showCount, 1);
  assert.strictEqual(r.plantCount, 1);
  assert.strictEqual(r.fairShowCount, 0);
  assert.strictEqual(r.issues[0].type, 'unplanted_evidence');
});

// —— 6. ZH 两次无铺垫物证：升级 high，扣分封顶 24 ——
test('zh: two unplanted shows escalate to high', () => {
  const txt = `场景三 宴会厅 夜
林晚当众播放录音，里面是赵天成的声音。
她又把照片甩在桌上，照片上的画面清清楚楚。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 76);
  assert.strictEqual(r.issues.length, 2);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.issues[1].severity, 'mid');
  assert.ok(r.issues.every((i) => i.type === 'unplanted_evidence'));
});

// —— 7. ZH 证据雨 3 种：overkill low（另带无铺垫）——
test('zh: three evidence kinds trigger low overkill', () => {
  const txt = `场景六 董事会 日
林晚当众播放录音，录音里是赵天成的罪证。
她又点开那段视频，画面显示他进过仓库。
她把照片甩在桌上。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.distinctEvidenceKinds, 3);
  const ok = r.issues.find((i) => i.type === 'evidence_overkill');
  assert.ok(ok);
  assert.strictEqual(ok.severity, 'low');
});

// —— 8. ZH 证据雨 4 种：overkill mid ——
test('zh: four evidence kinds escalate overkill to mid', () => {
  const txt = `场景六 董事会 日
林晚当众播放录音，录音里是赵天成的罪证。
她又调出监控，监控画面显示他签了假合同。
她甩出亲子鉴定报告，报告显示孩子是他的。
她翻出银行流水，流水证明钱进了他的账户。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 66);
  const ok = r.issues.find((i) => i.type === 'evidence_overkill');
  assert.strictEqual(ok.severity, 'mid');
  assert.match(ok.evidence, /4 种铁证/);
});

// —— 9. ZH 空口证据：≥2 宣称且零出示，low -7 ——
test('zh: verbal claims without any show is low', () => {
  const txt = `场景一 客厅 夜
林晚：我手里有你的录音，你最好放了我妈。
赵天成冷笑不信。
场景二 书房 夜
林晚：证据就在我手里，你等着瞧。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 93);
  assert.strictEqual(r.claimCount, 2);
  assert.strictEqual(r.showCount, 0);
  assert.strictEqual(r.issues[0].type, 'verbal_evidence_only');
  assert.strictEqual(r.issues[0].severity, 'low');
});

// —— 10. ZH 只宣称 1 次：不报 ——
test('zh: single claim without show does not fire', () => {
  const txt = `场景一 客厅 夜
林晚盯着他：我有你挪用公款的证据。
赵天成心头一紧，但没有说话。
林晚转身离开，窗外下起了雨。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.claimCount, 1);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

// —— 11. ZH 宣称后真出示：不罚，且铺垫在前则满分 ——
test('zh: claims followed by a planted show are clean', () => {
  const txt = `场景一 办公室 夜
林晚暗中录下了赵天成承认行贿的全过程。
场景二 走廊 夜
林晚：我手里有你的录音。
场景三 宴会厅 夜
林晚：证据就在我手里。她当众播放录音，里面传出他的声音。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.claimCount, 2);
  assert.strictEqual(r.showCount, 1);
  assert.strictEqual(r.fairShowCount, 1);
  assert.strictEqual(r.issueCount, 0);
});

// —— 12. ZH 人证空降：mid -11 ——
test('zh: airdropped witness is mid', () => {
  const txt = `场景五 法庭 日
赵天成以为胜券在握。
就在这时，大门被推开，本该去世的林母走了进来，她要亲自作证。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 89);
  assert.strictEqual(r.witnessCount, 1);
  assert.strictEqual(r.issues[0].type, 'airdropped_witness');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

// —— 13. ZH 人证已安排：豁免 ——
test('zh: arranged witness is exempt', () => {
  const txt = `场景一 疗养院 日
林晚：我已经安排人去接你母亲，她答应出庭作证。
场景五 法庭 日
就在这时，大门被推开，林母走了进来，亲自作证。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.witnessCount, 1);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

// —— 14. ZH 两次人证空降：升级 high，封顶 -20 ——
test('zh: two airdropped witnesses escalate to high', () => {
  const txt = `场景四 法庭 日
就在这时，证人出现在门口，是当年的保姆。
场景五 法庭 日
话音刚落，第二个目击者走了进来，当面作证。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 80);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.issues[1].severity, 'mid');
  assert.ok(r.issues.every((i) => i.type === 'airdropped_witness'));
});

// —— 15. ZH 合同先拿后甩：公平 ——
test('zh: contract acquired earlier then slammed is fair', () => {
  const txt = `场景二 律所 日
律师把签好的股权转让协议备份交给林晚，她已经拿到原件。
场景六 董事会 日
林晚把股权转让协议甩在桌上，白纸黑字。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.fairShowCount, 1);
  assert.strictEqual(r.score, 100);
});

// —— 16. ZH 完整健康集：两类物证先埋后打 + 人证有安排 ——
test('zh: healthy full episode scores 100', () => {
  const txt = `场景一 办公室 夜
林晚偷偷在摆件里装了针孔摄像头，又让律师去调取当年的银行流水。
她还交代助理：我已经安排人去接保姆，她答应出庭作证。
场景三 宴会厅 夜
林晚当众播放录音——这是她提前录好备份的。
监控画面显示赵天成进过财务室。
场景五 法庭 日
就在这时，大门被推开，保姆走了进来，亲自作证。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.fairShowCount, 2);
  assert.strictEqual(r.witnessCount, 1);
});

// —— 17. scenes 自洽：issue 数 = flagCount 之和，只列有问题的场 ——
test('zh: scene flag counts reconcile with issues', () => {
  const txt = `场景一 客厅 夜
林晚：我手里有你的录音，等着瞧。
赵天成冷笑。
场景二 书房 夜
林晚：证据就在我手里，你等着。
场景三 宴会厅 夜
林晚当众播放录音，里面传出赵天成的声音。`;
  const r = evidenceChainCheck(txt, 'zh');
  assert.strictEqual(r.sceneCount, 3);
  assert.strictEqual(sum(r), r.issueCount);
  const flagged = r.scenes.filter((s) => s.flagCount > 0);
  assert.strictEqual(flagged.length, 1);
  assert.strictEqual(flagged[0].index, 3);
});

// —— 18. issues 排序：high → mid → low ——
test('zh: issues sorted high to low then scene', () => {
  const txt = `场景三 宴会厅 夜
林晚当众播放录音，里面是赵天成的声音。
她又甩出照片。
场景四 走廊 夜
她掏出监控视频播放，画面清清楚楚。
她再亮出亲子鉴定报告，报告显示孩子是他的。`;
  const r = evidenceChainCheck(txt, 'zh');
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i++) {
    assert.ok(order[r.issues[i - 1].severity] <= order[r.issues[i].severity]);
  }
});

// —— 19. EN 无铺垫物证：mid ——
test('en: unplanted recording show is mid', () => {
  const txt = `Scene 3 - Ballroom - Night
Lin Wan played the recording, and his voice filled the room. Everyone froze.`;
  const r = evidenceChainCheck(txt, 'en');
  assert.strictEqual(r.score, 88);
  assert.strictEqual(r.issues[0].type, 'unplanted_evidence');
  assert.match(r.issues[0].evidence, /^Scene 1: /);
});

// —— 20. EN 先埋后打：满分 ——
test('en: planted recording then show is fair', () => {
  const txt = `Scene 1 - Office - Night
She had secretly recorded the whole conversation and kept a copy.
Scene 3 - Ballroom - Night
Lin Wan played the recording, and his voice filled the room.`;
  const r = evidenceChainCheck(txt, 'en');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.fairShowCount, 1);
});

// —— 21. EN 空口证据 + 人证空降/已安排 + 证据雨 ——
test('en: verbal claims, airdropped vs arranged witness, overkill', () => {
  const verbal = `Scene 1 - Living Room - Night
"I have the evidence. I hold all the cards," she said.
Scene 2 - Study - Night
"I have everything on you," she added.`;
  const rv = evidenceChainCheck(verbal, 'en');
  assert.strictEqual(rv.score, 93);
  assert.strictEqual(rv.issues[0].type, 'verbal_evidence_only');

  const air = `Scene 5 - Court - Day
Just then, the doors burst open and Mrs. Lin, presumed dead, walked in to testify.`;
  const ra = evidenceChainCheck(air, 'en');
  assert.strictEqual(ra.score, 89);
  assert.strictEqual(ra.issues[0].type, 'airdropped_witness');

  const arranged = `Scene 1 - Hallway - Day
I have a witness ready; she has already agreed to testify.
Scene 5 - Court - Day
Just then, the doors swung open and the old nanny walked in to testify.`;
  const rr = evidenceChainCheck(arranged, 'en');
  assert.strictEqual(rr.score, 100);
  assert.strictEqual(rr.issueCount, 0);

  const rain = `Scene 6 - Boardroom - Day
She played the recording of his confession.
The security footage showed him signing the fake contract.
She held up the paternity report which proved the child was his.
She pulled up the bank records that showed the transfers.`;
  const ro = evidenceChainCheck(rain, 'en');
  assert.strictEqual(ro.score, 66);
  assert.strictEqual(ro.distinctEvidenceKinds, 4);
  assert.strictEqual(ro.issues.find((i) => i.type === 'evidence_overkill').severity, 'mid');
});
