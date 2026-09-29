'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { characterPresenceCheck: check } = require('../dist/engine/character-presence-check.js');

const pick = (res, type) => res.issues.filter((i) => i.type === type);
const sevOf = (res, type) => pick(res, type).map((i) => i.severity);

// ============ 基础：空/短/无信号满分 ============

test('空文本与短文本返回满分空对象', () => {
  for (const t of ['', '   ', '太短', '\n\t\n']) {
    const r = check(t, 'zh');
    assert.equal(r.score, 100);
    assert.equal(r.issueCount, 0);
    assert.equal(r.sceneCount, 0);
    assert.deepEqual(r.issues, []);
  }
});

test('英文空短文本同样满分', () => {
  const r = check('too short', 'en');
  assert.equal(r.score, 100);
  assert.equal(r.issues.length, 0);
});

test('正常对话无离场/死亡/通话信号 → 满分', () => {
  const t = `场景一
林晚：今天天气不错。
陈峰：是啊，出去走走？
林晚：好啊。`;
  const r = check(t, 'zh');
  assert.equal(r.score, 100);
  assert.equal(r.issueCount, 0);
  assert.equal(r.speakerCount, 2);
  assert.equal(r.sceneCount, 1);
});

test('无标题单场也能检测', () => {
  const t = `林晚：我受够了。
△林晚摔门而去。
林晚：再见。`;
  const r = check(t, 'zh');
  assert.equal(r.sceneCount, 1);
  assert.equal(r.scenes[0].header, 'S1');
  assert.equal(pick(r, 'ghost_speech').length, 1);
});

// ============ ① ghost_speech 离场幽灵 ============

test('摔门而去后本人仍有台词 → 首次 mid，88 分', () => {
  const t = `场景一
林晚：我不想再看到你。
△林晚摔门而去，陈峰愣在原地。
陈峰：你回来！
林晚：我不回来，协议签了吧。`;
  const r = check(t, 'zh');
  assert.deepEqual(sevOf(r, 'ghost_speech'), ['mid']);
  assert.equal(r.ghostCount, 1);
  assert.equal(r.exitCount, 1);
  assert.equal(r.score, 88);
  assert.match(pick(r, 'ghost_speech')[0].evidence, /林晚/);
  assert.match(pick(r, 'ghost_speech')[0].evidence, /第1场/);
});

test('不同两场各发生一次离场幽灵 → 第 2 次 high，78 分，push≤2', () => {
  const t = `场景一
△林晚摔门而去。
林晚：我不回头。
场景二
△陈峰转身离开房间。
陈峰：别来找我。
场景三
△林晚夺门而出。
林晚：再也不见。`;
  const r = check(t, 'zh');
  assert.equal(r.ghostCount, 3);
  assert.deepEqual(sevOf(r, 'ghost_speech').sort(), ['high', 'mid']);
  assert.equal(pick(r, 'ghost_speech').length, 2); // push 上限 2
  assert.equal(r.score, 78);
});

test('离场后有明确回归动作 → 豁免并计正信号 fairReenter', () => {
  const t = `场景一
△林晚摔门而去，陈峰愣在原地。
陈峰：你走了就别回来。
△片刻后林晚推门而回，眼眶通红。
林晚：我想清楚了，我不走了。`;
  const r = check(t, 'zh');
  assert.equal(r.issueCount, 0);
  assert.equal(r.reenterCount, 1);
  assert.equal(r.fairReenterCount, 1);
  assert.equal(r.score, 100);
});

test('英文回归动作 walked back in → 豁免', () => {
  const t = `SCENE 1
MARY: Get out!
△Jane stormed out and slammed the door.
△A minute later Jane walked back in, eyes red.
JANE: I thought it through.`;
  const r = check(t, 'en');
  assert.equal(r.issueCount, 0);
  assert.equal(r.fairReenterCount, 1);
});

test('同场每角色只报一次：离场后连续多句台词合并', () => {
  const t = `场景一
△林晚摔门而去。
林晚：第一句。
林晚：第二句。
林晚：第三句。`;
  const r = check(t, 'zh');
  assert.equal(r.ghostCount, 1);
  assert.equal(pick(r, 'ghost_speech').length, 1);
  assert.match(pick(r, 'ghost_speech')[0].key, /^ghost_s1_/);
});

test('离场后跨场重新开口不查（场标负责重新调度）', () => {
  const t = `场景一
△林晚摔门而去。
场景二
林晚：早啊。
陈峰：早。`;
  const r = check(t, 'zh');
  assert.equal(r.issueCount, 0);
});

test('否定语境"没有离开"不触发', () => {
  const t = `场景一
△林晚作势要走，却没有离开，站在门口。
林晚：我再给你一次机会。`;
  const r = check(t, 'zh');
  assert.equal(r.exitCount, 0);
  assert.equal(r.issueCount, 0);
});

test('纯台词"我走了"可反悔，不跟踪离场', () => {
  const t = `场景一
林晚：我走了。
陈峰：嗯。
林晚：对了，明天记得喂猫。`;
  const r = check(t, 'zh');
  assert.equal(r.ghostCount, 0);
  assert.equal(r.score, 100);
});

test('动作行无主且最近无说话人 → 不归属，不误报', () => {
  const t = `场景一
△门外传来摔门而去的声音，屋里只剩陈峰。
陈峰：她真走了。`;
  const r = check(t, 'zh');
  assert.equal(r.issueCount, 0);
});

test('最近说话人回退归属：陈峰起身离开后自己又开口', () => {
  const t = `场景一
陈峰：够了。
△陈峰起身离开房间，门重重合上。
林晚：你站住！
陈峰：我不想谈了。`;
  const r = check(t, 'zh');
  assert.equal(pick(r, 'ghost_speech').length, 1);
  assert.match(pick(r, 'ghost_speech')[0].evidence, /陈峰/);
});

test('旁观者视角动作行正确归属离场者（陈峰看林晚离去）', () => {
  const t = `场景一
△林晚摔门而去。
△陈峰看着林晚远去的背影，咬了咬牙。
林晚：协议记得签。`;
  const r = check(t, 'zh');
  assert.equal(pick(r, 'ghost_speech').length, 1);
  assert.match(pick(r, 'ghost_speech')[0].evidence, /林晚/);
});

// ============ ② dead_alive 亡者复活 ============

test('当场身亡后本人台词 → high，82 分', () => {
  const t = `场景一
△老张中弹，倒在陈峰怀里，当场身亡。
陈峰：老张你撑住！
老张：照顾好我女儿。`;
  const r = check(t, 'zh');
  assert.deepEqual(sevOf(r, 'dead_alive'), ['high']);
  assert.equal(r.deathCount, 1);
  assert.equal(r.deadAliveCount, 1);
  assert.equal(r.score, 82);
  assert.match(pick(r, 'dead_alive')[0].evidence, /老张已死亡/);
});

test('死亡行含"倒在X怀里"不误判怀抱者为死者', () => {
  const t = `场景一
△老张中弹，倒在陈峰怀里，当场身亡。
陈峰：老张！`;
  const r = check(t, 'zh');
  // 陈峰未死，他开口不触发；老张本人没开口 → 0 issue
  assert.equal(r.deadAliveCount, 0);
  assert.equal(r.issueCount, 0);
});

test('咽气写法 + 紧邻名字归属正确（"陈峰看着林晚咽了气"）', () => {
  const t = `场景一
△陈峰看着怀里的林晚咽了气，屋内一片寂静。
陈峰：晚晚！
林晚：我没事。`;
  const r = check(t, 'zh');
  assert.equal(pick(r, 'dead_alive').length, 1);
  assert.match(pick(r, 'dead_alive')[0].evidence, /林晚/);
});

test('死者台词只报一条：死后多句台词 push≤2 且每人一条', () => {
  const t = `场景一
△林晚停止了呼吸。
林晚：水……
林晚：我好冷……
林晚：别走……`;
  const r = check(t, 'zh');
  assert.equal(r.deadAliveCount, 1);
  assert.equal(pick(r, 'dead_alive').length, 1);
});

test('跨场复活：中间有抢救生还交代 → 豁免，100 分', () => {
  const t = `场景一
△老张当场身亡，医生摇了摇头。
陈峰：老张！
场景二
△经过全力抢救，老张竟然没死，缓缓醒了过来。
老张：我这是在哪？`;
  const r = check(t, 'zh');
  assert.equal(r.issueCount, 0);
  assert.equal(r.score, 100);
});

test('跨场无任何生还交代，死者下一场开口 → high', () => {
  const t = `场景一
△林晚被击中，倒地身亡。
陈峰：林晚！
场景二
林晚：今天吃什么？
陈峰：你还活着？`;
  const r = check(t, 'zh');
  assert.deepEqual(sevOf(r, 'dead_alive'), ['high']);
});

test('假死/装死类否定词不立死亡', () => {
  const t = `场景一
△林晚倒地装死，连呼吸都屏住了。
陈峰：别装了。
林晚：哈哈吓到你了吧。`;
  const r = check(t, 'zh');
  assert.equal(r.deathCount, 0);
  assert.equal(r.issueCount, 0);
});

test('吓死/急死等夸张否定不立死亡', () => {
  const t = `场景一
△林晚吓死了，瘫坐在地，心脏狂跳。
林晚：吓死我了。`;
  const r = check(t, 'zh');
  assert.equal(r.deathCount, 0);
  assert.equal(r.score, 100);
});

test('抢救无效否定不被当成生还信号', () => {
  const t = `场景一
△林晚中弹倒地，抢救无效死亡。
林晚：我还能说两句。`;
  const r = check(t, 'zh');
  // "抢救无效死亡" 命中 DEATH；其后无有效 REVIVE → 仍报
  assert.equal(pick(r, 'dead_alive').length, 1);
});

test('死者是尚未有台词的新人（动态提取），其后本人开口仍报 high', () => {
  const t = `场景一
陈峰：什么声音？
△黑暗中老张中弹，倒在陈峰怀里，当场身亡。
陈峰：老张！
老张：盒子……在床底下……`;
  const r = check(t, 'zh');
  assert.equal(r.deathCount, 1);
  assert.equal(pick(r, 'dead_alive').length, 1);
  assert.match(pick(r, 'dead_alive')[0].evidence, /老张/);
});

test('新人死亡行不偷拿最近说话人：林晚说话后老张身亡，林晚再开口不报', () => {
  const t = `场景一
林晚：我先回家了。
△身后传来枪响，老张中弹倒地，当场身亡。
林晚：老张？你怎么了！
陈峰：他没气了。`;
  const r = check(t, 'zh');
  assert.equal(r.deadAliveCount, 0);
  assert.equal(r.issueCount, 0);
});

test('医生台词宣告死亡不归到医生名下', () => {
  const t = `场景一
医生：病人已经停止了呼吸，我们尽力了。
陈峰：不可能！
医生：请节哀。`;
  const r = check(t, 'zh');
  assert.equal(r.deathCount, 0);
  assert.equal(r.issueCount, 0);
});

// ============ ③ phantom_call 断线幽灵通话 ============

test('挂断后双方仍像通话对答（含电话特征词）→ low，93 分', () => {
  const t = `场景一
△陈峰拨通了电话。
陈峰：你在哪？
林晚：我在路上。
△陈峰挂断了电话，忙音响起。
陈峰：你听到没有，说话啊！
林晚：我听见了。`;
  const r = check(t, 'zh');
  assert.deepEqual(sevOf(r, 'phantom_call'), ['low']);
  assert.equal(r.phantomCallCount, 1);
  assert.equal(r.hangupCount, 1);
  assert.equal(r.score, 93);
});

test('第 2 次断线通话 → mid', () => {
  const t = `场景一
△陈峰拨通电话。
△陈峰挂断了电话，忙音。
陈峰：喂？你还在吗？
林晚：在。
场景二
△陈峰又接到林晚的来电，视频通话接通。
△陈峰挂断电话。
陈峰：听到没有？
林晚：嗯。`;
  const r = check(t, 'zh');
  assert.equal(r.phantomCallCount, 2);
  assert.deepEqual(sevOf(r, 'phantom_call').sort(), ['low', 'mid']);
  assert.equal(r.score, 87);
});

test('挂断后转为身边人面对面、无电话特征词 → 不误报', () => {
  const t = `场景一
△陈峰拨通电话说了两句。
△陈峰挂断了电话。
陈峰：（对身边的林晚说）我们走吧。
林晚：好。`;
  const r = check(t, 'zh');
  assert.equal(r.phantomCallCount, 0);
  assert.equal(r.score, 100);
});

test('挂断后重新拨通再对话 → 豁免', () => {
  const t = `场景一
△陈峰拨通了电话。
陈峰：你在哪？
△陈峰挂断电话，忙音。
△片刻后林晚重新打来，陈峰再次接通。
陈峰：你到底想怎样？听到没有？
林晚：我们见面谈。`;
  const r = check(t, 'zh');
  assert.equal(r.phantomCallCount, 0);
});

test('无通话语境的孤立"挂断"不计 hangup', () => {
  const t = `场景一
△陈峰挂断了墙上的画，调整了一下角度。
林晚：歪了点。
陈峰：这样呢？`;
  const r = check(t, 'zh');
  // "挂断了画"前文无 CALL 信号 → 不建 hangup 事件
  assert.equal(r.hangupCount, 0);
  assert.equal(r.issueCount, 0);
});

test('"没有挂断"否定不触发', () => {
  const t = `场景一
△陈峰在打电话，他没有挂断，就那么听着。
陈峰：你说，我听着。
林晚：其实我……`;
  const r = check(t, 'zh');
  assert.equal(r.hangupCount, 0);
  assert.equal(r.phantomCallCount, 0);
});

test('挂断后窗口只有单方独白（无一来一回）→ 不报', () => {
  const t = `场景一
△陈峰拨通电话。
林晚：别说了。
△林晚挂断了电话，忙音。
陈峰：喂？喂？你还在吗？
陈峰：真挂了啊。`;
  const r = check(t, 'zh');
  // 窗口只有陈峰一人说话，speaker 数 <2
  assert.equal(r.phantomCallCount, 0);
});

// ============ 英文三主路径 ============

test('EN: stormed out 后本人台词 → ghost_speech', () => {
  const t = `SCENE 1
JOHN: I never want to see you again.
△John stormed out and slammed the door.
MARY: Come back!
JOHN: Never.`;
  const r = check(t, 'en');
  assert.equal(pick(r, 'ghost_speech').length, 1);
  assert.equal(r.speakerCount, 2);
  assert.match(pick(r, 'ghost_speech')[0].evidence, /Scene 1/);
  assert.match(pick(r, 'ghost_speech')[0].advice, /exited/);
});

test('EN: died on the spot 后本人台词 → dead_alive（动作行大小写归一）', () => {
  const t = `SCENE 1
△Old Zhang fell into Chen arms, lifeless. He had died on the spot.
CHEN: Hold on!
ZHANG: Take care of my daughter.`;
  const r = check(t, 'en');
  assert.equal(pick(r, 'dead_alive').length, 1);
  assert.match(pick(r, 'dead_alive')[0].evidence, /ZHANG/);
  assert.match(pick(r, 'dead_alive')[0].advice, /dead/);
});

test('EN: hung up 后继续通话对答 → phantom_call', () => {
  const t = `SCENE 1
△Jane picked up the phone for an incoming call.
JANE: Where are you?
BOB: On my way.
△Jane hung up; the line went dead.
JANE: Are you still there? Can you hear me?
BOB: Yeah.`;
  const r = check(t, 'en');
  assert.equal(pick(r, 'phantom_call').length, 1);
  assert.match(pick(r, 'phantom_call')[0].advice, /re-dial/);
});

test('EN: faked death 不立死亡；survived 反转豁免', () => {
  const t = `SCENE 1
△She played dead on the floor, holding her breath.
JOHN: Nice acting.
JANE: Had him fooled.
SCENE 2
△The doctor said the real victim survived and was alive.
VICTIM: Water...`;
  const r = check(t, 'en');
  assert.equal(r.deathCount, 0);
  assert.equal(r.issueCount, 0);
});

// ============ 语言隔离 / 结构自洽 ============

test('中文离场词不串到英文检测', () => {
  const t = `SCENE 1
△林晚摔门而去。
LINWAN: Goodbye.`;
  const r = check(t, 'en');
  // 英文模式不识别中文离场词，且说话标签需全大写 → 无 issue
  assert.equal(r.issueCount, 0);
});

test('issues 排序：high→mid→low，再 scene，再 key', () => {
  const t = `场景一
△老张当场身亡。
老张：我还能说话。
△陈峰拨通电话又挂断，忙音。
陈峰：你还在吗？听到没？
林晚：在。
场景二
△林晚摔门而去。
林晚：等等。
场景三
△陈峰夺门而出。
陈峰：再见。`;
  const r = check(t, 'zh');
  const w = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i += 1) {
    const a = r.issues[i - 1];
    const b = r.issues[i];
    assert.ok(
      w[a.severity] < w[b.severity]
        || (w[a.severity] === w[b.severity] && a.scene <= b.scene)
        || (w[a.severity] === w[b.severity] && a.scene === b.scene && a.key <= b.key),
      `bad order: ${a.severity}/${a.scene}/${a.key} > ${b.severity}/${b.scene}/${b.key}`,
    );
  }
});

test('key 唯一、scene 字段正确、flagCount 与 issues 自洽', () => {
  const t = `场景一
△林晚摔门而去。
林晚：一。
△陈峰拨通电话又挂断，忙音。
陈峰：还在吗？
林晚：嗯。
场景二
△陈峰转身离开房间。
陈峰：二。`;
  const r = check(t, 'zh');
  const keys = r.issues.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const i of r.issues) assert.ok(i.scene >= 1 && i.scene <= 2);
  const totalFlags = r.scenes.reduce((s, b) => s + b.flagCount, 0);
  assert.equal(totalFlags, r.issues.length);
});

test('signalCount = exit+death+hangup+reenter', () => {
  const t = `场景一
△林晚摔门而去。
△林晚推门而回。
林晚：我回来了。
△老张当场身亡。
△陈峰拨通电话又挂断，忙音。
陈峰：喂？还在吗？
林晚：在。`;
  const r = check(t, 'zh');
  assert.equal(
    r.signalCount,
    r.exitCount + r.deathCount + r.hangupCount + r.reenterCount,
  );
  assert.ok(r.signalCount >= 4);
});

test('score 始终落在 0-100', () => {
  const t = `场景一
△老张当场身亡。
老张：a。
场景二
△林晚当场身亡。
林晚：b。
场景三
△陈峰摔门而去。
陈峰：c。
场景四
△老王夺门而出。
老王：d。
场景五
△阿珍拨通电话挂断，忙音。
阿珍：还在吗？
阿强：在。
场景六
△阿明拨打电话挂断，忙音。
阿明：听到没？
阿芳：嗯。`;
  const r = check(t, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(r.issues.every((i) => i.advice && i.evidence));
});

test('scenes 数组覆盖全部场且 header 被截断到 24 字符', () => {
  const t = `场景一
林晚：早上好呀，今天天气真不错。
场景二
陈峰：早上好，一起去吃早餐吗？`;
  const r = check(t, 'zh');
  assert.equal(r.scenes.length, 2);
  assert.ok(r.scenes.every((s) => s.header.length <= 24));
  assert.deepEqual(r.scenes.map((s) => s.index), [1, 2]);
});
