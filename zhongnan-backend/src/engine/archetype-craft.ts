/**
 * archetype-craft.ts —— 人物原型 / 反派哲学 / 系统流高级机制 / 张力工艺（2026-08，34条视频沉淀，32条完整逐字稿）
 * v1.93：7 把可检验尺子全规则中英双语（lang='en' 用英文检测词与 dim/advice）；
 *        原型/反派/系统选型库为创作侧中文知识库（选题会 EN 模式不注入），保持中文单一事实来源。
 */
import { LintIssue, LintLevel, LintLang } from './craft-lint';
const has = (t: string, ws: string[]) => ws.filter((w) => t.includes(w));
const count = (t: string, ws: string[]) => ws.reduce((n, w) => n + (t.split(w).length - 1), 0);
/* ============ 一、主角原型库（6型，供选题会选型/人物小传） ============ */
export interface Archetype { id: string; name: string; formula: string; core: string; fit: string[] }
export const PROTAG_ARCHETYPES: Archetype[] = [
  { id: 'bloody_guardian', name: '带血的庇护者', formula: '最恐怖的外表 × 最柔软的底线（底线对冲）', core: '可以与全世界为敌，唯独不伤害“他/她/它”；出场300字用一个极温柔的小动作（大雨里为流浪猫撑伞自己淋雨）击穿读者。', fit: ['硬汉', '都市逆袭', '保护', '兵王', '亲情'] },
  { id: 'asura_with_heart', name: '独守佛心的修罗（反英雄）', formula: '目的绝对正义 × 手段比反派更狠', core: '行事如魔鬼、心里藏菩萨；不用道德说教，用更狠的方式碾反派（黑暗荣耀式以毒攻毒），反圣母才有现代爽感。', fit: ['复仇', '逆袭', '扫黑', '商战', '大女主'] },
  { id: 'mask_crack', name: '面具碎裂者（谎言的创伤者）', formula: '表层欲望（世俗/自私假目标）× 深层恐惧（童年创伤）', core: '前半程用贪财/怕死的面具伪装，高潮在黄金与无辜者之间踢开黄金去救人，面具碎裂暴露滚烫真心（钢铁侠式）。', fit: ['成长', '群像', '治愈', '悬疑', '都市'] },
  { id: 'ruined_soul', name: '人格废墟（A/B面撕裂）', formula: '社会面具A面（极限能力）× 生理软肋B面（卑微怪癖）', core: '冷血杀手只喝热牛奶、不识字、细心擦一盆绿植；用“猛虎细嗅蔷薇”的场景对冲（喂奶后下一秒拔枪，血不溅到猫）制造共情。', fit: ['杀手', '谍战', '职业剧', '反派男主', '悬疑'] },
  { id: 'table_flipper', name: '掀桌狂徒（拒绝入局）', formula: '不破解你的局 × 直接掀翻你立局的根基', core: '主角行程不能由反派安排；明知是鸿门宴偏不去，反手抄了反派老巢（罗辑式同归于尽威慑），掌握绝对主动权。', fit: ['智斗', '系统', '权谋', '商战', '无敌流'] },
  { id: 'iron_queen', name: '大女主·扬灰审判者', formula: '极致被虐 × 绝对情感切割（迟来深情比草贱）', core: '价值不需要伤害者的后悔来证明；渣男跪求时她在暖房喝热茶，头也不抬“他死了没，没死报官说有狗乱叫”。绝不原谅、绝不破镜重圆。', fit: ['女频', '复仇', '追妻火葬场', '豪门', '重生'] },
];
/* ============ 二、反派哲学库（6型） ============ */
export const VILLAIN_ARCHETYPES: Archetype[] = [
  { id: 'martyr_faith', name: '扭曲正义的殉道者', formula: '崇高信仰 × 自认救世主', core: '最可怕的恶不出于贪婪而出于崇高；反派坚信自己在拯救世界（叶文洁式），用“我们本质是一类人”做理念镜像撕裂，让读者瞬间动摇。', fit: ['权谋', '科幻', '悬疑', '社会派', '商战'] },
  { id: 'chaos_disaster', name: '无序天灾', formula: '无动机 × 无软肋 × 不可沟通', core: '不解释他为何变坏，像地震/老虎一样凭本能毁灭（小丑式）；不爱钱不怕死，读者无法理解才真正恐惧。', fit: ['悬疑', '惊悚', '犯罪', '纯恶', '末日'] },
  { id: 'soul_corruptor', name: '深渊诛心者（腐化者）', formula: '不要你的命 × 要你的底线', core: '用残忍二选一把满口仁义的主角拖下下水道，逼屠龙者自己长出恶鳞（七宗罪式）；垃圾反派拼拳头，顶级反派拼谁击碎谁的底线。', fit: ['犯罪', '心理', '复仇', '暗黑', '律政'] },
  { id: 'hell_umbrella', name: '地狱撑伞人（逆向献祭）', formula: '不可饶恕的恶行 × 绝对纯洁悲壮的动机（咽气才揭）', core: '做尽恶事、背负血海深仇，其实以自身万劫不复为主角铺成神路（斯内普式）；咽气那秒交底牌，主角赢了战斗却输掉一生心安。', fit: ['虐恋', '群像', '仙侠', '权谋', '意难平'] },
  { id: 'twin_destiny', name: '双生宿敌（同体异面）', formula: '共享悲惨起点/同一道疤 × 走上分叉路', core: '反派是主角走错一步会坠入的深渊，主角是反派永远得不到的光；决战不需放狠话，只需一个悲凉微笑（无间道式），一死另一精神无法独活。', fit: ['双雄', '宿命', '武侠', '谍战', '成长'] },
  { id: 'elegant_mastermind', name: '高智商压迫者', formula: '优雅克制 × 天衣无缝连环死局 × 宏大立场', core: '绝不嘴臭、不逐级送小弟喂经验；平静倒茶说“为了新秩序你今天必须死”，再启动让主角九死一生的死局。反派智商在线，主角胜利才值钱。', fit: ['商战', '权谋', '霸总', '职场', '智斗'] },
];
/* ============ 三、系统/金手指高级机制（5选，拒绝小卖部/提款机） ============ */
export const SYSTEM_MECHANICS = [
  { id: 'poison_gift', name: '有毒金手指（魔鬼对赌）', formula: '毁天灭地的力量 × 惨烈等价代价', tip: '时停10秒心脏衰老1年、魔药越用越接近失控发疯；力量不迷人，为力量付出的世故之痛才迷人（桑德森代价法则）。' },
  { id: 'three_layer', name: '三层信息差阴谋', formula: '读者看第一层碾压 × 主角清醒走钢丝 × 系统在第三层圈养', tip: '金手指来源笼罩迷雾，中后期揭晓“无敌外挂是高危神明圈养主角的饲料”，细思极恐。' },
  { id: 'gacha_addiction', name: '盲盒成瘾（不确定奖励）', formula: '致命绝境 × 极度随机抽卡', tip: '别做明码标价商城；BOSS杀到面前才抽，可能是神器也可能是塑料拖鞋，薛定谔的奖励让心跳悬到半空（盲盒>确定奖励）。' },
  { id: 'causality', name: '因果律降维', formula: '儿戏的触发前提 × 谁都无法违背的强制结果', tip: '不拼物理输出，直接篡改规则（我叫你全名你就得跟我五五开/百分百空手接白刃），打破读者预期。' },
  { id: 'reverse_exploit', name: '反向奴役（卡BUG）', formula: '系统很牛 × 主角是它大爷', tip: '删主角换条狗，狗绑系统也能赢=失败。主角要找漏洞反向榨干系统（雇人远程刷仇恨值），读者崇拜的是人不是代码。' },
];
/* ============ v1.94 英文选型层（id 键控，中文库为单一事实来源） ============ */
type ArchEn = { name: string; formula: string; core: string; fit: string[] };
export const PROTAG_EN: Record<string, ArchEn> = {
  bloody_guardian: { name: 'Bloodied Guardian', formula: 'Terrifying exterior × softest bottom line', core: 'Enemy of the world, yet never harms the one protected; within 300 words a tiny tender act (shielding a stray cat in the rain while soaked) breaks the viewer.', fit: ['tough guy', 'underdog', 'protect', 'soldier king', 'family'] },
  asura_with_heart: { name: 'Asura with a Heart (anti-hero)', formula: 'Just goal × means harsher than the villain', core: 'Acts like a devil, keeps a bodhisattva heart; no moral lecturing — crush the villain a harder way (Glory-style), anti-saint is the modern catharsis.', fit: ['revenge', 'underdog', 'anti-crime', 'business war', 'strong female'] },
  mask_crack: { name: 'Cracking Mask (wounded liar)', formula: 'Surface desire × deep fear (childhood wound)', core: 'Hides behind greed/fear for half the story; at the climax kicks the gold away to save the innocent — the mask shatters to reveal a burning heart.', fit: ['growth', 'ensemble', 'healing', 'suspense', 'urban'] },
  ruined_soul: { name: 'Ruined Soul (A/B-face tear)', formula: 'Social mask A-face (extreme ability) × physical soft spot B-face (humble quirk)', core: 'A cold killer who only drinks warm milk, is illiterate, carefully wipes a potted plant; “fierce tiger sniffing a rose” contrast builds empathy.', fit: ['killer', 'spy', 'procedural', 'villain male lead', 'suspense'] },
  table_flipper: { name: 'Table-Flipper (refuses the game)', formula: 'Not solving your trap × flipping the very ground it stands on', core: 'The villain must not set the lead’s schedule; skip the banquet and raid the villain’s lair instead (Luo Ji-style mutually-assured deterrence), hold absolute initiative.', fit: ['mind game', 'system', 'intrigue', 'business war', 'invincible'] },
  iron_queen: { name: 'Iron Queen (ash trial)', formula: 'Extreme abuse × absolute emotional cut (late affection is worthless)', core: 'Her worth never needs the abuser’s regret; as he kneels she sips warm tea without looking up. Never forgive, never reconcile.', fit: ['female', 'revenge', 'chase-the-wife crematorium', 'wealthy clan', 'rebirth'] },
};
export const VILLAIN_EN: Record<string, ArchEn> = {
  martyr_faith: { name: 'Martyr of Twisted Justice', formula: 'Lofty faith × self-styled savior', core: 'The scariest evil springs not from greed but from the sublime; convinced of saving the world (Ye Wenjie-style), the “we are the same” mirror shakes the viewer.', fit: ['intrigue', 'sci-fi', 'suspense', 'social', 'business war'] },
  chaos_disaster: { name: 'Force-of-Nature Chaos', formula: 'No motive × no soft spot × cannot be reasoned with', core: 'Never explain why he turned bad; he destroys on instinct like an earthquake or a tiger (Joker-style) — incomprehensible is truly terrifying.', fit: ['suspense', 'thriller', 'crime', 'pure evil', 'apocalypse'] },
  soul_corruptor: { name: 'Soul Corruptor', formula: 'Not your life × your bottom line', core: 'Force a moral lead into the sewer with cruel dilemmas, make the dragon-slayer grow scales (Se7en-style); cheap villains trade punches, top ones shatter bottom lines.', fit: ['crime', 'psychological', 'revenge', 'dark', 'legal'] },
  hell_umbrella: { name: 'Umbrella in Hell (reverse sacrifice)', formula: 'Unforgivable acts × pure tragic motive revealed only at death', core: 'Commits atrocities, bears a blood feud, yet walks into damnation to pave the lead’s path (Snape-style); the hole card is shown at the last breath.', fit: ['angst', 'ensemble', 'xianxia', 'intrigue', 'regret'] },
  twin_destiny: { name: 'Twin Nemesis (same coin)', formula: 'Shared wretched origin / same scar × forked paths', core: 'The villain is who the lead becomes with one wrong step, the lead is the light the villain never got; a sad smile replaces threats (Infernal Affairs-style).', fit: ['dual leads', 'destiny', 'wuxia', 'spy', 'growth'] },
  elegant_mastermind: { name: 'Elegant Mastermind', formula: 'Restrained grace × airtight cascading death-trap × grand stance', core: 'Never trash-talks or feeds minions level by level; calmly pours tea and launches a trap the lead barely survives. A smart villain makes the win valuable.', fit: ['business war', 'intrigue', 'ceo', 'workplace', 'mind game'] },
};
export const SYSTEM_EN: Record<string, { name: string; tip: string }> = {
  poison_gift: { name: 'Poisoned Gift (devil’s bargain)', tip: 'World-breaking power × a brutal equivalent price (10s time-stop ages the heart a year); the pain paid for power is what fascinates (Sanderson cost law).' },
  three_layer: { name: 'Three-Layer Information Gap', tip: 'Readers see layer-1 domination, the awake lead walks a tightrope on layer 2, and the system is farming the lead on layer 3 — chilling on reveal.' },
  gacha_addiction: { name: 'Gacha Addiction (uncertain reward)', tip: 'No priced shop; draw randomly only in a deadly fix — artifact or plastic slipper, Schrödinger’s reward suspends the heartbeat (uncertain > certain).' },
  causality: { name: 'Causality as Dimensional Strike', tip: 'A playful trigger × an unbreakable forced result; rewrite rules instead of stacking stats, breaking reader expectation.' },
  reverse_exploit: { name: 'Reverse Enslavement (exploit the bug)', tip: 'If a dog with the system could win, the lead fails; the lead finds loopholes and drains the system — readers admire the person, not the code.' },
};
/* ============ 四、按题材/梗概选型（选题会用；v1.94 支持英文匹配） ============ */
function matchByFit<T extends { fit: string[] }>(lib: T[], text: string, max = 2, enFit?: (x: T) => string[]): T[] {
  const t = text || '';
  const scored = lib.map((x) => {
    const keys = enFit ? enFit(x) : x.fit;
    return { x, n: keys.reduce((s, k) => s + (k === '全部' || k === 'all' ? 1 : (t.includes(k) ? 1 : 0)), 0) };
  })
    .filter((s) => s.n > 0).sort((a, b) => b.n - a.n);
  return (scored.length ? scored.slice(0, max).map((s) => s.x) : lib.slice(0, 0));
}
export interface ArchetypeMatch { protag: Archetype[]; villain: Archetype[]; system: typeof SYSTEM_MECHANICS }
export function matchArchetype(input: { text?: string; tags?: string[] }, lang: 'zh' | 'en' = 'zh'): ArchetypeMatch {
  const en = lang === 'en';
  const rawText = `${input.text || ''} ${(input.tags || []).join(' ')}`;
  const text = en ? rawText.toLowerCase() : rawText;
  const isSystem = en ? /(system|cheat ability|panel|superpower|rebirth|transmigrat|golden finger|hud)/i.test(rawText) : /系统|金手指|外挂|面板|异能|重生|穿越/.test(text);
  if (en) {
    return {
      protag: matchByFit(PROTAG_ARCHETYPES, text, 2, (p) => PROTAG_EN[p.id]?.fit || []),
      villain: matchByFit(VILLAIN_ARCHETYPES, text, 2, (v) => VILLAIN_EN[v.id]?.fit || []),
      system: isSystem ? [SYSTEM_MECHANICS[0], SYSTEM_MECHANICS[2], SYSTEM_MECHANICS[3]] : [],
    };
  }
  return {
    protag: matchByFit(PROTAG_ARCHETYPES, text, 2),
    villain: matchByFit(VILLAIN_ARCHETYPES, text, 2),
    system: isSystem ? [SYSTEM_MECHANICS[0], SYSTEM_MECHANICS[2], SYSTEM_MECHANICS[3]] : [],
  };
}
/* ============ 五、可检验尺子（7把，文本模式识别+可执行建议） ============ */
/* 1. 反派廉价化：嘴臭拉仇恨 / 葫芦娃送经验，缺信仰与智商 */
const TRASH_TALK = ['穷逼', '废物', '蝼蚁', '找死', '给我上', '一起上', '哈哈哈', '也不看看', '臭', '滚出去', '打死他'];
const TRASH_TALK_EN = ['trash', 'loser', 'worm', 'ant', 'you’re dead', 'get him', 'all at once', 'hahaha', 'know your place', 'get out', 'beat him'];
const ELEGANT = ['欣赏', '秩序', '信仰', '理念', '平静', '微笑', '规矩', '新秩序', '不得不', '代价'];
const ELEGANT_EN = ['appreciate', 'order', 'faith', 'conviction', 'calm', 'slight smile', 'rules', 'new order', 'had to', 'price'];
export function villainCheapLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const trashWords = (en ? TRASH_TALK_EN : TRASH_TALK).map((w) => (en ? w.toLowerCase() : w));
  const elegantWords = (en ? ELEGANT_EN : ELEGANT).map((w) => (en ? w.toLowerCase() : w));
  const trash = count(probe, trashWords);
  const feed = count(probe, en ? ['minions', 'henchmen first', 'send in', 'delivered to the door', 'one by one'] : ['小弟', '手下先', '先派', '送上门', '逐个', '一个个来']);
  const elegant = count(probe, elegantWords);
  const bad = trash >= 2 && elegant === 0;
  return {
    rule: 'atVillainCheap', dim: en ? 'Antagonist depth' : '反派厚度', level: bad ? 'P1' : 'P2', hit: has(probe, trashWords),
    advice: bad
      ? (en
        ? 'A villain who trash-talks (“loser/trash/get him”) and feeds minions one level at a time insults the viewer’s intelligence. Give him a grand stance and a working brain: composed and restrained, launching airtight cascading traps, or recast as a martyr / force-of-nature / soul-corruptor; beating an equal makes the lead’s win valuable.'
        : '反派靠“穷逼/废物/给我上”嘴臭和逐级派小弟送经验=摩擦读者智商。给他宏大立场与在线智商：优雅克制、启动天衣无缝的连环死局，或改成殉道者/天灾/诛心者，击败旗鼓相当的对手主角才值钱。')
      : trash && elegant ? (en ? 'A hint of trash-talk but also a stance; don’t let cheap taunts drown out the battle of wits.' : '反派有嘴臭苗头但也有立场刻画，注意别让廉价嘲讽盖过智斗。')
        : (en ? 'No cheap-villain cliché; keep the antagonist’s intelligence and conviction on.' : '未见廉价反派套路，保持反派智商与信仰在线。'),
    score: bad ? 38 : trash ? 62 : 88,
  };
}
/* 2. 圣母/强行原谅：复仇语境下的廉价和解 */
const FORGIVE = ['原谅他', '算了吧', '以德报怨', '破镜重圆', '他也不容易', '放下吧', '知错能改', '再给一次机会', '不忍心'];
const FORGIVE_EN = ['forgive him', 'let it go', 'return good for evil', 'get back together', 'he had it hard', 'just let it pass', 'he learned his lesson', 'one more chance', "couldn’t bear to"];
export function saintMaryLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const revengeCtx = en ? /(revenge|betray|humiliat|called off the wedding|bully|harm|grudge|vendetta)/i.test(text) : /复仇|背叛|羞辱|退婚|霸凌|伤害|仇/.test(text);
  const forgive = has(probe, (en ? FORGIVE_EN : FORGIVE).map((w) => (en ? w.toLowerCase() : w)));
  const bad = revengeCtx && forgive.length >= 1;
  return {
    rule: 'atSaintMary', dim: en ? 'Lead edge' : '主角锋芒', level: bad ? 'P1' : 'P2', hit: forgive,
    advice: bad
      ? (en
        ? 'Viewers already endure swallowing grievances in real life; an easy forgiveness / reunion on a revenge line feels worse than work. A strong-female-lead / asura path makes an absolute emotional cut: late affection is worthless, self-worth doesn’t need the abuser’s regret; means may be harsher than the villain’s while the lead keeps their own bottom line.'
        : '现实里受够了委曲求全，复仇线却轻易原谅/破镜重圆=读者比上班还憋屈。大女主/修罗路线要做绝对情感切割：迟来的深情比草贱，不靠对方后悔证明价值，手段可以比反派更狠但守住自己的底线。')
      : (en ? 'No forced saintly reconciliation; the lead’s edge is intact. Keep it.' : '未见强行圣母和解，主角锋芒在线，保持。'),
    score: bad ? 42 : 86,
  };
}
/* 3. 系统小卖部：明码标价、确定奖励，缺盲盒/规则/反向利用 */
export function systemGachaLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const isSystem = en ? /(system|panel|shop|quest|points|gacha|cheat ability)/i.test(text) : /系统|面板|商城|任务|积分|抽奖|金手指/.test(text);
  if (!isSystem) return { rule: 'atSystemShop', dim: en ? 'System addiction design' : '系统成瘾机制', level: 'P2', hit: [], advice: en ? 'No system-story context detected.' : '未识别到系统文语境。', score: 80 };
  const shop = count(probe, en ? ['points exchange', 'shop', 'purchase', 'redeem', 'quest reward', 'obtained', 'price tag', 'deducted'] : ['积分兑换', '商城', '购买', '兑换', '任务完成奖励', '获得', '明码', '扣款']);
  const addictive = count(probe, en ? ['random', 'probability', 'gacha', 'blind box', 'rule', 'loophole', 'price', 'causality', 'backlash', 'exploit a bug', 'seal'] : ['随机', '概率', '抽奖', '盲盒', '规则', '漏洞', '代价', '因果', '反噬', '卡bug', '封印']);
  const bad = shop >= 2 && addictive === 0;
  return {
    rule: 'atSystemShop', dim: en ? 'System addiction design' : '系统成瘾机制', level: bad ? 'P1' : 'P2', hit: [],
    advice: bad
      ? (en
        ? 'A system written as “do quest → earn points → buy priced gear in a shop” is a boring convenience store that triggers no dopamine. Change to: ① uncertain blind-box rewards (gacha in a deadly fix); ② causality that rewrites rules instead of stacking stats; ③ the lead finds loopholes and reverse-enslaves the system; ④ rewards carry a brutal cost. Let the system be the dealer, not customer service.'
        : '系统写成“做任务→发积分→商城明码标价买装备”=无聊小卖部，刺激不出多巴胺。改成：①不确定的盲盒奖励（绝境抽卡）；②因果律改规则而非拼数值；③主角找漏洞反向奴役系统；④奖励带惨烈代价。让系统当荷官，不当客服。')
      : addictive ? (en ? 'The system has uncertainty / rules / cost or reverse exploitation; the addiction loop holds. Keep it.' : '系统具备不确定性/规则感/代价或反向利用，成瘾机制成立，保持。')
        : (en ? 'The system’s transaction feel is too literal; add blind-box randomness, rule-bending or a use cost, avoid a “ding — free artifact”.' : '系统交易感偏直白，建议补盲盒随机、规则篡改或使用代价，避免“叮一声白送神器”。'),
    score: bad ? 40 : addictive ? 88 : 60,
  };
}
/* 4. 台词情报直给/说教，缺潜台词（冰山法则） */
const ON_NOSE = ['你听我解释', '你知道吗', '我告诉你', '也就是说', '难道你不知道', '我是说', '实话跟你说', '你明白吗', '为什么要出卖', '我对你这么好'];
const ON_NOSE_EN = ['let me explain', 'you know what', 'i’m telling you', 'which means', "don’t you know", 'i mean', 'to be honest', 'you understand', 'why did you betray', 'i was so good to you'];
export function subtextLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const direct = has(probe, (en ? ON_NOSE_EN : ON_NOSE).map((w) => (en ? w.toLowerCase() : w)));
  const subtext = count(probe, en ? ['silence', 'didn’t look up', 'paused', 'sneer', 'deflect', 'rhetorical question', 'pour tea', 'lowered head', 'didn’t take it', 'change the subject'] : ['沉默', '没抬头', '顿了顿', '冷笑', '转移', '反问', '倒水', '低头', '没接话', '岔开']);
  const bad = direct.length >= 2;
  return {
    rule: 'atSubtext', dim: en ? 'Dialogue subtext' : '台词潜台词', level: 'P2', hit: direct,
    advice: bad
      ? (en
        ? 'Dialogue is not an information exchange; top dialogue conceals information and contests power. Cut on-the-nose Q&A (“why did you betray me / let me explain”); let characters counter through pouring tea, silence, rhetorical questions and non-answers. Keep only 10% on the surface — the 90% of desire beneath is what grips.'
        : '对话不是情报交换机，顶级对话在掩盖信息、争夺权力。删掉“你为什么出卖我/你听我解释”这类直白问答，让人物用倒茶、沉默、反问、答非所问来反击（“泼出去的水烧不热”），字面只留10%，水下90%的欲望才抓人。')
      : subtext ? (en ? 'Action/silence carries the subtext and lines have negative space. Keep it.' : '有动作/沉默承载潜台词，台词有留白，保持。')
        : (en ? 'In key conflict scenes, reduce on-the-nose statements; use non-answers and physical detail to create beneath-the-surface tension.' : '关键冲突戏可减少直白说破，用答非所问和肢体细节制造“字面之下”的张力。'),
    score: bad ? 48 : subtext ? 87 : 66,
  };
}
/* 5. 开篇设定堆砌：前500字背景多于危机 */
const SETTING_WORDS = ['大陆', '家族', '世界', '传说', '据说', '公元', '历史', '世代', '宗门', '王朝', '背景', '记载'];
const SETTING_WORDS_EN = ['continent', 'clan', 'world', 'legend', 'it is said', 'in the year', 'history', 'for generations', 'sect', 'dynasty', 'background', 'recorded'];
const CRISIS_WORDS = ['死', '债', '追杀', '绝境', '跪', '休', '退婚', '破产', '刀', '血', '牢', '斩', '逼', '羞辱', '离婚', '开除', '病危'];
const CRISIS_WORDS_EN = ['die', 'debt', 'hunted', 'desperate', 'kneel', 'divorce', 'called off', 'bankrupt', 'blade', 'blood', 'prison', 'execute', 'force', 'humiliat', 'fired', 'dying'];
export function flatOpeningLint(text: string, headLen = 500, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const head = (text || '').slice(0, en ? headLen * 2 : headLen).toLowerCase();
  const setting = count(head, (en ? SETTING_WORDS_EN : SETTING_WORDS).map((w) => (en ? w.toLowerCase() : w)));
  const crisis = count(head, (en ? CRISIS_WORDS_EN : CRISIS_WORDS).map((w) => (en ? w.toLowerCase() : w)));
  const bad = setting >= 3 && crisis === 0;
  return {
    rule: 'atFlatOpen', dim: en ? 'Golden opening' : '黄金开篇', level: bad ? 'P1' : 'P2', hit: [],
    advice: bad
      ? (en
        ? 'Spending the opening on worldbuilding/clan background drives readers off (slow-burn is an excuse for weak writing). Golden-first-three KPI: ch1 digs the hole (throw the lead into a life/dignity crisis early, sprinkle worldbuilding like salt), ch2 shows the trump card and builds expectation, ch3 delivers a clean counter and raises bigger trouble. Establish crisis fast, reveal the cheat soon after.'
        : '开篇前500字在铺世界观/家族背景=赶跑读者（慢热是写烂的遮羞布）。黄金前三章KPI：1章挖坑（前500字把主角扔进生死/尊严绝境，世界观像撒盐慢慢揉）、2章亮底牌建期待、3章干净反杀并引出更大麻烦。1000字立危机、3000字亮外挂。')
      : crisis ? (en ? 'The opening cuts straight into a concrete crisis/conflict — matches a strong cold open. Keep it.' : '开篇即切入具体危机/冲突，符合开局破局，保持。')
        : (en ? 'The opening is a little setting-heavy; push grand setup later and first grab with one concrete, personal crisis.' : '开篇背景略多，建议把宏大设定后置，先用一个具象切身危机抓人。'),
    score: bad ? 36 : crisis ? 90 : 64,
  };
}
/* 6. 静态外貌形容词堆砌，缺命运投影细节 */
const PRETTY_ADJ = ['剑眉星目', '俊美', '绝世容颜', '完美无瑕', '英俊潇洒', '美若天仙', '肤若凝脂', '五官精致', '仪表堂堂', '貌若潘安'];
const PRETTY_ADJ_EN = ['sword-like brows', 'gorgeous', 'peerless beauty', 'flawless', 'handsome and dashing', 'heavenly beauty', 'porcelain skin', 'exquisite features', 'distinguished looks'];
const DESTINY_DETAIL = ['茧', '疤', '伤', '老茧', '颤抖', '轮椅', '白发', '粗糙的手', '阴影', '佝偻', '勋章'];
const DESTINY_DETAIL_EN = ['callus', 'scar', 'wound', 'tremble', 'wheelchair', 'white hair', 'rough hand', 'shadow', 'hunched', 'medal'];
export function staticPortraitLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const adj = has(probe, (en ? PRETTY_ADJ_EN : PRETTY_ADJ).map((w) => (en ? w.toLowerCase() : w)));
  const detail = count(probe, (en ? DESTINY_DETAIL_EN : DESTINY_DETAIL).map((w) => (en ? w.toLowerCase() : w)));
  const bad = adj.length >= 2 && detail === 0;
  return {
    rule: 'atPortrait', dim: en ? 'Character distinctiveness' : '角色辨识度', level: 'P2', hit: adj,
    advice: bad
      ? (en
        ? 'Stacking “flawless / peerless beauty” won’t make a character memorable. 3D modeling: ① one point breaks the surface — magnify a single destiny anchor (bark-like callus on the right hand); ② spatial intrusion — profile through environment and others’ fear; ③ scar as setup — a shrapnel wound that cramps in the rain, telling fate through the body. Amateurs draw skin; masters carve the soul.'
        : '“剑眉星目/俊美无俦”堆再多读者也记不住。三维建模法：①以点破面——只放大一个命运锚点（右手虎口树皮般的老茧）；②空间入侵——用环境与旁人的恐惧反应侧写；③伤痕蓄势——阴雨天会抽筋的弹片伤，用肉体讲命运。三流画皮囊，顶级刻灵魂。')
      : detail ? (en ? 'Appearance carries destiny detail / action profiling — distinctive. Keep it.' : '外貌带命运细节/动作侧写，有辨识度，保持。')
        : adj ? (en ? 'Looks adjectives are static; swap for one piercing visual anchor or others’ reaction.' : '外貌形容词偏静态，建议换成一个刺骨的视觉锚点或他人反应。')
          : (en ? 'No ID-photo-style description. Keep it.' : '未见证件照式描白，保持。'),
    score: bad ? 46 : detail ? 88 : 68,
  };
}
/* 7. 情绪爆发写成工整控诉，缺生理性失控 */
const GRIEF_WORDS = ['死', '去世', '牺牲', '背叛', '崩溃', '离世', '没了'];
const ACCUSE = ['为什么', '老天爷', '不公平', '你还我', '怎么可以', '啊——', '我恨你'];
const ACCUSE_EN = ['why', 'god', 'not fair', 'give me back', 'how could you', 'i hate you'];
export function hystericalLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  if (!new RegExp((en ? 'die|died|death|passed away|sacrific|betray|breakdown|gone' : GRIEF_WORDS.join('|')), en ? 'i' : '').test(probe)) return { rule: 'atHysteria', dim: en ? 'Authentic emotional eruption' : '情绪爆发真实度', level: 'P2', hit: [], advice: en ? 'No major emotional eruption detected.' : '未识别到重大情绪爆发场景。', score: 80 };
  const accuse = count(probe, (en ? ACCUSE_EN : ACCUSE).map((w) => (en ? w.toLowerCase() : w)));
  const physical = count(probe, en ? ['tremble', 'gag', 'stutter', 'repeat', 'couldn’t hold', 'stare blank', 'abnormal', 'quiet', 'incoherent', 'shake', 'squat down', 'fixed stare'] : ['颤抖', '干呕', '结巴', '重复', '握不住', '发呆', '反常', '安静', '颠三倒四', '抖', '蹲下', '盯着']);
  const bad = accuse >= 2 && physical === 0;
  return {
    rule: 'atHysteria', dim: en ? 'Authentic emotional eruption' : '情绪爆发真实度', level: 'P2', hit: [],
    advice: bad
      ? (en
        ? 'In great grief, polished idioms and “god, it’s not fair” read like recited lines and cool the emotion. Extreme trauma is a physiological loss of control: cut exclamation marks and accusations; write a morbid fixation on a meaningless detail (obsessively wiping the dead’s shoes because “school is tomorrow”), or eerie calm (takes a sip of water, hand shakes until the cup shatters). Infect the reader through loss of control, not by announcing pain.'
        : '大悲时满口成语和“老天爷你不公平”=背台词、给情绪降温。极端创伤是生理性失控：删掉感叹号与控诉，写对无意义细节的病态执着（拼命擦死者鞋上的血说明天还要上学），或反常冷静（喝一口水，手抖到杯子摔碎）。用失控传染读者，而非用文字宣告痛苦。')
      : physical ? (en ? 'The eruption has physical reaction / eerie restraint — feels real. Keep it.' : '情绪爆发有生理反应/反常克制，真实可感，保持。')
        : (en ? 'For a heavy emotional scene, downgrade neat accusations into incoherence, gagging or eerie calm — it hits harder.' : '重头情绪戏建议把工整控诉降维成语无伦次、干呕或反常冷静，更戳人。'),
    score: bad ? 45 : physical ? 88 : 63,
  };
}
export interface ArchetypeLintResult { issues: LintIssue[]; avg: number; p1: LintIssue[] }
export function archetypeLint(input: { text?: string; opening?: string; lang?: LintLang }): ArchetypeLintResult {
  const lang: LintLang = input.lang === 'en' ? 'en' : 'zh';
  const text = input.text || '';
  const issues: LintIssue[] = [];
  if (text) {
    issues.push(
      villainCheapLint(text, lang), saintMaryLint(text, lang), systemGachaLint(text, lang), subtextLint(text, lang),
      staticPortraitLint(text, lang), hystericalLint(text, lang),
    );
  }
  if (input.opening || text) issues.push(flatOpeningLint(input.opening || text, 500, lang));
  const scored = issues.filter((i) => typeof i.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : 0;
  return { issues, avg, p1: issues.filter((i) => i.level === 'P1') };
}
