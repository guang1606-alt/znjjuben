const { describe, it } = require('node:test');
const assert = require('node:assert');
const mp = require('../dist/lib/model-proxy.js');
const { runEpisode } = require('../dist/agents/pipeline.js');
const { EngineTier } = require('../dist/config/pricing.js');
const S = require('../dist/engine/sample-script.js');
const A2 = require('../dist/engine/aigc-screenplay.js');

const cjkRe = /[一-鿿]/;
const bible = () => ({ worldview: '', characters: {}, timeline: [], foreshadow: [] });

// 沙盘桩：所有模型调用回空，管线走离线兜底；返回 cap 供检查各岗 prompt
function stubSandbox() {
  const cap = [];
  mp.callText = async (t, r, p) => { cap.push({ r, p }); return { text: '', sandbox: true, costFen: 0 }; };
  mp.callJson = mp.callText;
  return cap;
}

describe('v2.80 AIGC 制式全链路对齐', () => {
  it('中文沙盘：AIGC 兜底为流畅制作本，闸门满分通过且成稿无△分镜标记', async () => {
    const cap = stubSandbox();
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭甜宠', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC' });
    assert.strictEqual(r.format.pass, true, r.format.violations.join(';'));
    assert.ok(r.format.cjk >= 1200 && r.format.cjk <= 1500, `实际${r.format.cjk}`);
    assert.ok(!r.draft.includes('△'), 'AIGC 成稿不应出现 △ 分镜标记');
    assert.ok(r.aigcManifest && r.aigcVolumePlan && Array.isArray(r.aigcCurve));
    // 润色岗收到的是“流畅自然段”保持语，而不是 LIVE 的 △ 版式硬指令
    const polisherPrompts = cap.filter((x) => x.r === 'polisher').map((x) => x.p);
    assert.ok(polisherPrompts.some((p) => p.includes('流畅自然段')));
    assert.ok(!polisherPrompts.some((p) => p.includes('必须以△开头')));
  });

  it('英文沙盘：AIGC 英文流畅本满分通过，全链路各岗 prompt 零中文', async () => {
    const cap = stubSandbox();
    const r = await runEpisode(EngineTier.STANDARD, bible(), 'an urban comeback sweet-romance mini-drama', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'en', scriptFormat: 'AIGC' });
    assert.strictEqual(r.format.pass, true, r.format.violations.join(';'));
    assert.strictEqual(r.format.lang, 'en');
    assert.ok(r.format.cjk >= 1200 && r.format.cjk <= 1500);
    assert.ok(!cjkRe.test(r.draft), '英文成稿零中文');
    assert.ok(!r.draft.includes('△'));
    assert.strictEqual(cap.filter((x) => cjkRe.test(x.p)).length, 0);
    assert.ok(r.aigcManifest && Array.isArray(r.aigcCurve));
  });

  it('小说化中文初稿（无场标/无台词、字数达标）触发 AIGC 版式修复轮，修复后满分', async () => {
    const cap = [];
    // 一份字数在 1200-1500（每句43汉字×28=1204）但完全小说化、无场标无台词的初稿
    const badSentence = '她推开门慢慢走进屋里，抬眼望着窗外一点点暗下去的天光，指尖攥紧衣角，脚步发沉，心里堵得说不出话。';
    const badDraft = badSentence.repeat(28);
    const golden = S.buildSampleScript('AIGC');
    mp.callText = async (t, r, p) => {
      cap.push({ r, p });
      // 撰写师给出小说化初稿（sandbox:false 才会原样透传）；只有 AIGC 制式修复轮才返回黄金流畅本，其余岗回空走兜底
      if (r === 'writer') return { text: badDraft, sandbox: false, costFen: 0 };
      if (r === 'polisher' && p.includes('AIGC制式修复')) return { text: golden, sandbox: false, costFen: 0 };
      return { text: '', sandbox: true, costFen: 0 };
    };
    mp.callJson = mp.callText;
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC' });
    const repairCalls = cap.filter((x) => x.r === 'polisher' && x.p.includes('AIGC制式修复'));
    assert.ok(repairCalls.length >= 1, '应触发 AIGC 版式修复轮');
    // 修复 prompt 必须带机器诊断出的具体问题与五条版式要求
    const task = repairCalls[0].p;
    assert.ok(task.includes('流畅自然段') && task.includes('18%-28%') && task.includes('五个维度'));
    assert.strictEqual(r.format.pass, true, r.format.violations.join(';'));
    assert.ok(r.format.cjk >= 1200 && r.format.cjk <= 1500);
  });

  it('真实模型拒绝砍半时：逐场硬预算下发 + 确定性硬剪兜底把成稿压回时长区间（台词全保）', async () => {
    const cap = [];
    const seg = '她推开木门，冷风灌进领口，楼道灯忽明忽暗，她攥紧纸箱带子，指节发白，脚步停在台阶上，听见楼下传来汽车熄火的声音。';
    const parts = [];
    for (let i = 1; i <= 4; i++) {
      parts.push(`内景 老楼${i}·夜`);
      parts.push(seg.repeat(11));
      parts.push('林晚（压低声音）：这一次，我不会再退了。');
      parts.push(seg.repeat(2));
    }
    const overDraft = parts.join('\n'); // 约2600+字
    mp.callText = async (t, r, p) => {
      cap.push({ r, p });
      // 撰写师给超长稿；所有润色岗都原样返回超长稿（模拟模型拒绝砍半）；其余结构化岗走沙盘
      if (r === 'writer') return { text: overDraft, sandbox: false, costFen: 0 };
      if (r === 'polisher') return { text: overDraft, sandbox: false, costFen: 0 };
      return { text: '', sandbox: true, costFen: 0 };
    };
    mp.callJson = mp.callText;
    const events = [];
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭复仇', (e) => events.push(e), { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC' });
    // 逐场硬预算确实下发给润色岗
    assert.ok(cap.some((x) => x.r === 'polisher' && x.p.includes('逐场硬预算') && x.p.includes('最多保留约')));
    // 硬剪兜底触发且最终落入 1200-1500
    assert.ok(events.some((e) => String(e.note).includes('超限硬剪兜底')));
    assert.ok(r.format.inRange, `实际${r.format.cjk}`);
    assert.ok(r.format.cjk >= 1200 && r.format.cjk <= 1500);
    assert.strictEqual((r.draft.match(/这一次，我不会再退了。/g) || []).length, 4, '硬剪不得删台词');
  });

  it('LIVE 沙盘仍走 △ 分镜兜底，不受 AIGC 改动影响', async () => {
    stubSandbox();
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市甜宠', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'LIVE' });
    assert.strictEqual(r.format.pass, true, r.format.violations.join(';'));
    assert.ok(r.draft.includes('△'));
    assert.strictEqual(r.aigcManifest, null);
  });

  it('人设师返回 {"cast":{…}} 包装层时自动解包，人物名正确联动且圣经写入', async () => {
    const cap = [];
    const golden = S.buildSampleScript('AIGC'); // 含林晚/陈凯
    const wrappedCast = {
      cast: {
        林晚: { want: '查明真相', voice: '平静短句', arc: '从隐忍到亮牌', hidden: ['欲望:掌控局面'] },
        陈凯: { want: '掩盖内鬼身份', voice: '色厉内荏', arc: '从嚣张到崩溃', hidden: ['欲望:自保'] },
      },
    };
    mp.callText = async (t, r, p) => {
      cap.push({ r, p });
      if (r === 'designer') return { text: JSON.stringify(wrappedCast), sandbox: false, costFen: 0 };
      if (r === 'writer') return { text: golden, sandbox: false, costFen: 0 };
      return { text: '', sandbox: true, costFen: 0 };
    };
    mp.callJson = mp.callText;
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC' });
    // 解包后人物名是林晚/陈凯，而不是字符串 "cast"
    assert.ok(r.cast['林晚'] && r.cast['陈凯'], 'cast 包装层应被解包为扁平人物卡');
    assert.ok(!r.cast.cast, '不应残留 cast 包装键');
    assert.ok(r.bible.characters['林晚'], '人物应写入圣经');
    assert.strictEqual(r.format.pass, true, r.format.violations.join(';'));
  });

  it('人设师返回顶层数组 [{name,…}] 或 {"characters":[…]} 时也正确解包', async () => {
    const golden = S.buildSampleScript('AIGC'); // 含林晚/陈凯
    for (const payload of [
      [{ name: '林晚', motivation: '查明真相', speakingStyle: '平静短句' }, { name: '陈凯', motivation: '掩盖身份', speakingStyle: '色厉内荏' }],
      { characters: [{ name: '林晚', objective: '复仇', tone: '冷' }, { name: '陈凯', goal: '自保', tone: '虚张声势' }] },
      { castList: [{ characterName: '林晚', bio: '复仇者' }, { characterName: '陈凯', bio: '内鬼' }], relationshipDynamics: { note: '对手' } },
    ]) {
      mp.callText = async (t, r) => {
        if (r === 'designer') return { text: JSON.stringify(payload), sandbox: false, costFen: 0 };
        if (r === 'writer') return { text: golden, sandbox: false, costFen: 0 };
        return { text: '', sandbox: true, costFen: 0 };
      };
      mp.callJson = mp.callText;
      const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC' });
      assert.ok(r.cast['林晚'] && r.cast['陈凯'], `应解包出林晚/陈凯，实际=${Object.keys(r.cast).join(',')}`);
    }
  });

  it('纯外部动作稿发声15-18%且无内心句可转时，外科微补只增不改把发声补进18-28%并满分', async () => {
    // 构造一份字数达标、五维齐全、仅发声15%的"纯外部动作"稿（避开全部内心关键词，确定性 boost 无法处理）
    const heads = ['内景 顶层会议室·黄昏', '内景 会议室·片刻后', '内景 会议室·稍后', '内景 电梯厅·傍晚'];
    const addNarr = [
      '玻璃幕墙外的云被落日压成一层暗橙色，远处塔吊的长臂正缓缓转动，城市高架上的车流拖出连续的红色灯带，一直铺到视野尽头。',
      '楼层保洁储物间的门半掩着，里面整齐码着清洁液与卷纸，挂在墙上的登记本被穿堂风掀得哗哗翻过两页，又慢慢合上。',
      '茶水间吧台上的微波炉跳停，发出一声短促提示音，没人起身去取，玻璃壶里的黑咖啡表面已经结起一层发亮的薄衣。',
      '消防通道的绿色指示牌在墙角发出稳定微光，一辆运货推车孤零零停在拐角，轮子上还沾着没擦净的灰色蜡痕。',
    ];
    const narr = [
      `冷白灯管斜切过整面落地玻璃，在深色大理石长桌上切出一道笔直的明暗分界，半空冷气混着走廊尽头咖啡机的低鸣缓缓流动。长桌两侧高管各自端坐，没有人开口，只有纸张摩擦与杯底磕碰桌面的细响，顶灯把每张脸都照得发白。林晚推着清洁车沿桌边慢慢走，橡胶轮在抛光地面压出断续的吱呀声，她伸手把歪斜的纸杯逐一扶正，又把散落的回形针拢成一小堆。墙上电子钟秒针一格格跳动，长桌尽头的投影幕布垂着没有升起。${addNarr[0]}她眉尖没动，嘴角绷成一条直线，拿干布一角慢慢擦掉袖口皂沫，目光始终落在对方鞋尖。（音效：远处咖啡机咕嘟声、轮子蹭地声、空调低鸣。）`,
      `成摞盖红章的密封文件压在桌沿，铜制镇纸反着顶灯的光，窗外天色一点点沉成铁灰。陈凯抬手把文件拍进她围裙前袋，指节用力到泛白，随即一拳重重砸在桌面，让钢笔滚出桌沿叮当落到地。他又扯松领带，皮鞋尖顶住清洁车轮子不让她走，桌面上的咖啡杯被震得晃出一圈深色水痕。旁边两名高管互相交换眼神，各自把文件夹往里收了半寸，没有人替他弯腰捡笔。${addNarr[1]}陈凯脸皮抽动两下，鼻孔里挤出一声短笑，双臂抱胸，脚跟却悄悄往后挪了半寸。（音效：拳头砸桌闷响、钢笔落地、皮鞋蹭地。）`,
      `打印机红色指示灯匀速闪烁，墙角立式空调送出的风把便签纸吹得微微翘起边角。她从围裙里抽出那份皱文件搁到桌子中央，发出沉闷一声，回形针被震得弹起又叮当落下，满桌目光齐刷刷压过去。她抬手解开脖子上的塑料工牌挂绳，五成一的股权章在水晶灯下反出一道冷光，又用指节把文件朝对面轻轻推过去半尺。长桌尽头玻璃显示屏自行亮起，跳出三年前工商备案页面，她的名字加粗印在文件抬头第一行。${addNarr[2]}她抬眼目光很冷，下巴微微一扬，指尖在桌面轻轻叩了两下。（音效：文件落桌、挂绳塑料扣轻响、指尖叩桌。）`,
      `电梯厅尽头感应灯逐节亮起，大理石地面映出两道被拉长的人影，空气里浮着消毒水与皮革混合的气味。陈凯脸上血色一寸寸退净，嘴唇开合却没发出声，膝盖微微发颤，伸手去够桌沿才勉强站稳。两名穿制服的保安已经站到玻璃门口，双手交叠在身前，皮鞋踩在地砖上没有多余动作。他口袋里的手机连续震了三下，屏幕亮起又暗下去，他低头瞥了一眼，肩膀随之垮下半分。${addNarr[3]}他喉结滚动两下，额角汗珠顺着鬓角滑下来，洇深色衬衫领口一小块。（音效：电梯提示音、保安脚步、粗重呼吸。）`,
    ];
    const dlgs = [
      ['林晚：这份文件我先替董事长收着，你不必再藏。', '陈凯：一个扫地的，也配碰董事会的东西。', '林晚：配不配，红章说了算。', '林晚：动手之前，先看清楚名字。'],
      ['林晚：红章是真的，三年前的备案也查得到。', '陈凯：就算是真的，这里也轮不到你说话。', '林晚：今天这话，该我来讲。', '林晚：你挪用的账，我也一并带来了。'],
      ['林晚：从现在起，请你立刻离开这间会议室。', '陈凯：你凭什么赶我走，这家公司还姓陈。', '林晚：它早就不姓你这一支。', '林晚：保安，替陈总开门。'],
      ['林晚：保安就在门口，警察已经在楼下等你。', '陈凯：等等，林小姐，这件事我们还能再谈。', '林晚：晚了，出去吧。', '林晚：账上的钱，一分都跑不掉。'],
    ];
    const badDraft = [];
    for (let i = 0; i < 4; i++) { badDraft.push(heads[i], narr[i]); dlgs[i].forEach((x) => badDraft.push(x)); }
    const bad = badDraft.join('\n');
    // 前置断言：1200-1500、五维全过、仅发声偏低且落在微补窗口 15-18%
    const pre = A2.validateAigcScreenplay(bad, 'zh');
    assert.ok(pre.composition.spokenRatio >= 0.15 && pre.composition.spokenRatio < 0.18, `前置发声比=${pre.composition.spokenRatio}`);
    assert.strictEqual(pre.sceneIssues.length + pre.smoothnessIssues.length, 0);

    let microCalled = 0;
    const golden = S.buildSampleScript('AIGC');
    mp.callText = async (t, r, p) => {
      if (r === 'writer') return { text: bad, sandbox: false, costFen: 0 };
      if (r === 'polisher' && p.includes('发声补写')) { microCalled++; return { text: golden, sandbox: false, costFen: 0 }; }
      // 普通制式修复轮：原样返回，模拟模型修不动发声
      if (r === 'polisher') return { text: bad, sandbox: false, costFen: 0 };
      return { text: '', sandbox: true, costFen: 0 };
    };
    mp.callJson = mp.callText;
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭', () => {}, { episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'AIGC' });
    assert.strictEqual(microCalled, 1, '应恰好触发一次发声下限微补');
    assert.strictEqual(r.format.pass, true, r.format.violations.join(';'));
    assert.ok(r.format.cjk >= 1200 && r.format.cjk <= 1500, `字数${r.format.cjk}`);
    // 微补候选（黄金流畅本）被采纳，发声进带；原低分稿不再是成稿
    const cc = A2.analyzeAigcComposition(r.draft);
    assert.ok(cc.spokenRatio >= 0.18 && cc.spokenRatio <= 0.28, `成稿发声比=${cc.spokenRatio}`);
  });
});
