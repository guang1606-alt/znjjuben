const test = require('node:test');
const assert = require('node:assert');

// v2.350 台词时长物理超支检测（Dialogue Runtime Check）
// 盲区：script-format 字数闸门（LIVE 800-1000）只管「字够多不多」，不管「字读不读得完」。
// listen-script 的 estimateSpeechSeconds（4.3 字/秒+停顿）公式现成但只服务 /listen 端点，
// 零进生成管线 craftPass。真人侧无发声比上限，800-1000 字里台词占 600+ 字朗读 140+ 秒，
// 超 90 秒单集上限 1.5 倍——导演拿到稿子拍不完，要么删台词破坏剧情、要么演员赶台词像机关枪。

const { dialogueRuntimeCheck } = require('../dist/engine/dialogue-runtime-check');

// —— 样例：健康稿（台词 ~50%，朗读 ~60 秒，预算内）——
const HEALTHY_LIVE = `第1集 觉醒
△夜幕降临，林晚站在天台边缘，风吹乱她的头发。
林晚（哽咽）：你们逼我的。
△她掏出手机，屏幕上是丈夫的出轨照片。
林晚（咬牙）：今天，我要让你们全都付出代价。
△她转身下楼，脚步坚定。
△走廊里，保安拦住她。
保安（严肃）：女士，天台已封锁。
林晚（冷笑）：让开，不然我喊非礼。
△保安犹豫，让开一条路。
△电梯门打开，丈夫和情人相拥而出。
林晚（平静）：来得正好。
△她举起手机，闪光灯亮起。
丈夫（慌张）：你听我解释！
林晚（摇头）：不用了，法庭上见。
△她按下发送键，照片群发成功。
△丈夫脸色惨白，情人尖叫着跑开。
△林晚走出大楼，夜风吹散她的眼泪。
林晚（轻声）：结束了。
△她抬头看天，星星很亮。`;

// —— 样例：台词超支稿（台词 ~85%，朗读 ~150 秒，超预算）——
const OVERTIME_LIVE = `第1集 对峙
△会议室里，林晚和丈夫相对而坐。
林晚（冷冷地）：你知不知道我为了这个家付出了多少青春年华，每天早出晚归，照顾孩子伺候公婆，连生病都不敢请假，生怕耽误工作丢了饭碗。
丈夫（不耐烦地）：说这些有什么用，事情已经发生了，你再怎么哭闹也改变不了现实，不如冷静下来好好谈谈条件，看看怎么分割财产对双方都比较公平合理。
林晚（激动地）：谈条件？你还有脸跟我谈条件？当初你创业失败欠了一屁股债，是我拿出嫁妆给你还债，是我白天上班晚上做兼职帮你东山再起，现在你翅膀硬了就想一脚踢开我？
丈夫（冷笑地）：那又怎样，法律上财产是共同所有的，你拿不出证据证明那些钱是你个人出的，再说这些年你也没少花我的钱，买包买化妆品出去旅游，哪一样不是我在买单。
林晚（愤怒地）：你简直无耻到了极点，我瞎了眼才会嫁给你这种忘恩负义的白眼狼，我告诉你，这个婚我离定了，而且我要让你净身出户，一分钱都别想拿到。
丈夫（嘲讽地）：净身出户？你做梦去吧，我告诉你，公司法人是我，房产写的是我妈的名字，银行账户早就转移了，你能拿到什么？你什么都拿不到，等着喝西北风吧。
林晚（咬牙切齿地）：你别逼我，兔子急了还咬人呢，我手里有你出轨的证据，有你和那个女人的开房记录，有你们的聊天记录，我要是把这些都捅到你公司去，看你还怎么做人。
丈夫（不屑地）：随便你，大不了鱼死网破，反正我光脚的不怕穿鞋的，你要闹就闹，看最后谁吃亏，我劝你还是识相点，拿点钱走人，别到时候一分钱都拿不到还丢人现眼。`;

// —— 样例：紧张稿（台词 ~75%，朗读 ~80 秒，贴近预算上限 85%）——
const TIGHT_LIVE = `第1集 摊牌
△林晚把离婚协议推到丈夫面前。
林晚（平静地）：签字吧，好聚好散，别再互相折磨了。
△丈夫看都没看，把协议撕碎。
丈夫（傲慢地）：就凭你也想离婚？我告诉你，没有我的同意，你哪儿也去不了，这辈子都是我的人了，你死了这条心吧。
林晚（坚定地）：我不是在跟你商量，我是在通知你，律师我已经找好了，证据我也收集齐了，你不同意我们就法庭见，看到时候谁怕谁。
△丈夫愣住，没想到她这么坚决。
丈夫（阴沉地）：你别后悔，跟我斗，你还嫩了点，我会让你知道什么叫痛不欲生。
林晚（微笑地）：是吗？那我们就走着瞧，看看最后是谁后悔，谁痛不欲生。
△她站起身，拿起包准备离开。
林晚（头也不回地）：对了，忘了告诉你，我已经把咱们共同的存款都转到我妈名下了，房子我也挂到中介去了，你慢慢玩吧，祝你好运。
△丈夫猛地站起来，脸色铁青。
丈夫（咆哮地）：你敢！你这个疯女人，我不会放过你的！
林晚（冷冷地）：随便你，我等着。
△她转身走向门口。
林晚（停下脚步）：还有，你藏在书房保险柜里的那本假账，我已经拍照发给我律师了，你看着办吧。
△丈夫瘫坐在椅子上，面如死灰。
丈夫（喃喃自语）：完了，全完了……
林晚（头也不回）：这就是你背叛我的代价，好好享受吧。`;

// —— 样例：AIGC 稿（1 分钟时长，台词 ~22% 合规）——
const AIGC_HEALTHY = `第1集 觉醒
△夜幕降临，林晚站在天台边缘，风吹乱她的头发。
林晚（哽咽）：你们逼我的。
△她掏出手机，屏幕上是丈夫的出轨照片。
林晚（咬牙）：今天，我要让你们全都付出代价。
△她转身下楼，脚步坚定。
△走廊里，保安拦住她。
保安（严肃）：女士，天台已封锁。
林晚（冷笑）：让开，不然我喊非礼。
△保安犹豫，让开一条路。
△电梯门打开，丈夫和情人相拥而出。
林晚（平静）：来得正好。
△她举起手机，闪光灯亮起。
丈夫（慌张）：你听我解释！
林晚（摇头）：不用了，法庭上见。
△她按下发送键，照片群发成功。`;

// —— 样例：AIGC 超支稿（1 分钟时长，台词 ~50% 严重超标）——
const AIGC_OVERTIME = `第1集 对峙
△会议室里，林晚和丈夫相对而坐。
林晚（冷冷地）：你知不知道我为了这个家付出了多少青春年华，每天早出晚归，照顾孩子伺候公婆，连生病都不敢请假，生怕耽误工作丢了饭碗。
丈夫（不耐烦地）：说这些有什么用，事情已经发生了，你再怎么哭闹也改变不了现实，不如冷静下来好好谈谈条件，看看怎么分割财产对双方都比较公平合理。
林晚（激动地）：谈条件？你还有脸跟我谈条件？当初你创业失败欠了一屁股债，是我拿出嫁妆给你还债，是我白天上班晚上做兼职帮你东山再起，现在你翅膀硬了就想一脚踢开我？
丈夫（冷笑地）：那又怎样，法律上财产是共同所有的，你拿不出证据证明那些钱是你个人出的，再说这些年你也没少花我的钱，买包买化妆品出去旅游，哪一样不是我在买单。
林晚（愤怒地）：你简直无耻到了极点，我瞎了眼才会嫁给你这种忘恩负义的白眼狼，我告诉你，这个婚我离定了，而且我要让你净身出户，一分钱都别想拿到。
丈夫（嘲讽地）：净身出户？你做梦去吧，我告诉你，公司法人是我，房产写的是我妈的名字，银行账户早就转移了，你能拿到什么？你什么都拿不到，等着喝西北风吧。`;

// —— 样例：EN 健康稿 ——
const EN_HEALTHY = `Episode 1: Awakening
Night falls. Lin Wan stands at the edge of the rooftop, wind blowing through her hair.
Lin Wan (sobbing): You all forced me into this.
She pulls out her phone, showing photos of her husband's affair.
Lin Wan (gritting teeth): Today, I will make you all pay the price.
She turns and walks downstairs, her steps firm.
In the hallway, a security guard stops her.
Guard (sternly): Ma'am, the rooftop is closed.
Lin Wan (cold smile): Move, or I'll scream harassment.
The guard hesitates and steps aside.
The elevator doors open, and her husband walks out embracing his lover.
Lin Wan (calmly): Perfect timing.
She raises her phone, the flash lighting up.
Husband (panicked): Let me explain!
Lin Wan (shaking head): No need. See you in court.
She presses send, the photos mass-delivered.`;

test('v2.350 健康真人稿（台词~50%，朗读~60秒）不误报', () => {
  const r = dialogueRuntimeCheck(HEALTHY_LIVE, 'LIVE', 'zh');
  assert.strictEqual(r.severity, 'none');
  assert.strictEqual(r.score, 100);
  assert.ok(r.spokenSeconds > 0);
  assert.ok(r.spokenSeconds <= r.budgetSeconds);
  assert.strictEqual(r.issues.length, 0);
});

test('v2.350 台词超支真人稿（朗读~150秒，预算90秒）报 high', () => {
  const r = dialogueRuntimeCheck(OVERTIME_LIVE, 'LIVE', 'zh');
  assert.strictEqual(r.severity, 'high');
  assert.ok(r.score < 60);
  assert.ok(r.spokenSeconds > r.budgetSeconds);
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].type, 'dialogue_overtime');
  assert.ok(r.issues[0].evidence.includes('秒'));
});

test('v2.350 台词紧张真人稿（朗读~85秒，预算90秒）报 mid', () => {
  const r = dialogueRuntimeCheck(TIGHT_LIVE, 'LIVE', 'zh');
  assert.strictEqual(r.severity, 'mid');
  assert.ok(r.score >= 60 && r.score <= 100, `mid score ${r.score} should be in [60, 100]`);
  assert.ok(r.spokenSeconds > r.budgetSeconds * 0.85);
  assert.ok(r.spokenSeconds <= r.budgetSeconds);
  assert.strictEqual(r.issues[0].type, 'dialogue_tight');
});

test('v2.350 AIGC 健康稿（1分钟，台词~22%）不误报', () => {
  const r = dialogueRuntimeCheck(AIGC_HEALTHY, 'AIGC', 'zh', 1);
  assert.strictEqual(r.severity, 'none');
  assert.strictEqual(r.score, 100);
  assert.ok(r.spokenSeconds <= r.budgetSeconds);
});

test('v2.350 AIGC 超支稿（1分钟，台词~50%）报 high', () => {
  const r = dialogueRuntimeCheck(AIGC_OVERTIME, 'AIGC', 'zh', 1);
  assert.strictEqual(r.severity, 'high');
  assert.ok(r.spokenSeconds > r.budgetSeconds);
  assert.strictEqual(r.issues[0].type, 'dialogue_overtime');
});

test('v2.350 EN 健康稿不误报', () => {
  const r = dialogueRuntimeCheck(EN_HEALTHY, 'LIVE', 'en');
  assert.strictEqual(r.severity, 'none');
  assert.strictEqual(r.score, 100);
  assert.ok(r.issues.length === 0);
});

test('v2.350 空稿满分放行（checked=false）', () => {
  const r = dialogueRuntimeCheck('', 'LIVE', 'zh');
  assert.strictEqual(r.checked, false);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.spokenSeconds, 0);
});

test('v2.350 纯动作稿（零台词）满分放行', () => {
  const pureAction = '第1集\n△夜幕降临。\n△林晚站在天台。\n△风吹乱头发。\n△她转身离开。';
  const r = dialogueRuntimeCheck(pureAction, 'LIVE', 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.severity, 'none');
  assert.strictEqual(r.spokenSeconds, 0);
  assert.strictEqual(r.score, 100);
});

test('v2.350 畸形输入不崩溃（null/undefined/纯空白）', () => {
  const r1 = dialogueRuntimeCheck(null, 'LIVE', 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.checked, false);
  const r2 = dialogueRuntimeCheck(undefined, 'LIVE', 'zh');
  assert.strictEqual(r2.score, 100);
  const r3 = dialogueRuntimeCheck('   \n  \n  ', 'LIVE', 'zh');
  assert.strictEqual(r3.checked, false);
  assert.strictEqual(r3.score, 100);
});

test('v2.350 结构字段齐全（spokenSeconds/budgetSeconds/spokenChars/severity/score/issues）', () => {
  const r = dialogueRuntimeCheck(OVERTIME_LIVE, 'LIVE', 'zh');
  assert.ok(typeof r.spokenSeconds === 'number');
  assert.ok(typeof r.budgetSeconds === 'number');
  assert.ok(typeof r.spokenChars === 'number');
  assert.ok(typeof r.severity === 'string');
  assert.ok(typeof r.score === 'number');
  assert.ok(Array.isArray(r.issues));
  assert.ok(r.spokenSeconds > 0);
  assert.ok(r.budgetSeconds > 0);
});

test('v2.350 score 恒在 0-100 区间', () => {
  const samples = [HEALTHY_LIVE, OVERTIME_LIVE, TIGHT_LIVE, AIGC_HEALTHY, AIGC_OVERTIME, EN_HEALTHY, ''];
  for (const s of samples) {
    const r = dialogueRuntimeCheck(s, 'LIVE', 'zh');
    assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} out of range for: ${s.slice(0, 20)}`);
  }
});

test('v2.350 LIVE 缺省预算 90 秒', () => {
  const r = dialogueRuntimeCheck(HEALTHY_LIVE, 'LIVE', 'zh');
  assert.strictEqual(r.budgetSeconds, 90);
});

test('v2.350 AIGC 预算按时长缩放（2分钟→108秒）', () => {
  const r = dialogueRuntimeCheck(AIGC_HEALTHY, 'AIGC', 'zh', 2);
  assert.strictEqual(r.budgetSeconds, 108); // 2 * 60 * 0.9
});

test('v2.350 超支证据包含超支秒数与预算', () => {
  const r = dialogueRuntimeCheck(OVERTIME_LIVE, 'LIVE', 'zh');
  assert.strictEqual(r.issues[0].type, 'dialogue_overtime');
  assert.ok(r.issues[0].evidence.includes(String(r.spokenSeconds)));
  assert.ok(r.issues[0].evidence.includes(String(r.budgetSeconds)));
});
