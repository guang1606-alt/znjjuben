/**
 * 国运秘境 / 全民觉醒流机制引擎（v2.30）
 * ------------------------------------------------------------------
 * 第二十一套“类型机制引擎”。国运流短剧 AI 通病：副本规则随口改、国运数值
 * 对不上账、选手凭天降无选拔、升级无代价无上限、外国选手集体纸糊且被丑化、
 * 围观弹幕只会喊6、赢靠蛮力而非读懂规则、失败没有代价、文化输出变喊口号、
 * 渲染现实民族对立。本模块沉淀 10 套装置（机理+技法+风险），自动识别意图并
 * 下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type NationLang = 'zh' | 'en';
export interface NationDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const NATION_DEVICES: NationDevice[] = [
  {
    id: 'realm_rules', name: '秘境规则即引擎', nameEn: 'Realm rules as the engine',
    principle: '国运流的核心悬念来自“规则”：副本怎么通关、违规受什么罚、边界在哪，开场立清且全程不反悔，智斗才有舞台，观众才能跟着解题', principleEn: 'The suspense of a national-fortune story comes from rules: how to clear the realm, penalties, boundaries—set early, never bent later, so clever play and audience participation become possible',
    technique: '进副本前用一张“规则卡”交代3-5条铁律（通关条件、计时、违规代价、一条看似无用的细节），关键转折必须是主角对既有规则的再解读，而不是临场新增设定；规则漏洞只能用一次，用后由系统补漏，避免反复钻空子失真', techniqueEn: 'Before entry, state 3-5 iron rules on a rule card (clear condition, timer, violation cost, one seemingly useless detail); every turning point must re-interpret an existing rule rather than add a new one on the spot; any loophole works once and is then patched, preventing repeat abuse',
    risk: '规则解释要融进紧张动作，禁止大段说明书式念稿', riskEn: 'Fold rule explanation into tense action; never deliver a long manual',
    kw: ['规则', '副本规则', '通关条件', '违规', '铁律', 'rule', 'clear condition', 'realm rule', 'instance rule'],
  },
  {
    id: 'national_binding', name: '国运联动账可见', nameEn: 'Visible national-fortune linkage',
    principle: '爽感来自“我赢一分，国家强一分”的即时联动：个人表现与国运资源、国民状态挂钩，数值可见、前后对得上，观众才有命运与共感', principleEn: 'The thrill is “I gain, the nation gains”: personal results link visibly to national resources and citizens’ state, with consistent numbers that create shared stakes',
    technique: '定一套统一计量（国运点/资源值），写清“通关S级=多少点=现实兑换什么（粮产、医疗、寿命、领土屏障）”，每次结算当场播报增减，前后集数值连续；主角受创时国家同步承压，把个人战斗升级为集体命运', techniqueEn: 'Define one currency (fortune points), fix what an S-clear yields and what it buys (food, medicine, lifespan, a barrier), report gains/losses on screen each time and keep numbers consistent across episodes; when the hero is hurt the nation feels it, lifting a personal fight into collective fate',
    risk: '数值换算一张表管到底，杜绝这集一分顶百、下集百分顶一', riskEn: 'One conversion table for the whole story; never inflate or deflate points episode to episode',
    kw: ['国运', '国运点', '国家资源', '全民', '绑定', 'national fortune', 'nation points', 'collective stake'],
  },
  {
    id: 'representative_legitimacy', name: '代表资格有来路', nameEn: 'Legitimate selection as representative',
    principle: '主角代表国家不能靠“偏偏选了他”的天降：选拔或征召过程要成立，他凭什么站上赛场要被看见，代表资格本身就有代价与责任', principleEn: 'A national representative cannot be anointed out of nowhere: the selection must be credible, his qualification visible, and representation itself carry cost and duty',
    technique: '用1-2场戏交代选拔逻辑（基层海选、特殊职业适配、上一次失败的替补、能力被低估的冷门），让质疑者真实存在并在首战后改观；给他一个“本可以不去”的选择点，主动担责才立住人物，拒绝纯龙傲天', techniqueEn: 'Use 1-2 scenes to establish selection (grassroots trial, profession fit, substitute after a prior failure, an underrated ability), let doubters exist and revise after the first battle; give him a real chance to opt out—choosing duty is what makes him a character, not a mary-sue',
    risk: '选拔不能黑箱内定，程序公平本身就是爽点前提', riskEn: 'Selection must look fair; procedural fairness underpins the payoff',
    kw: ['选拔', '征召', '代表', '天选', '替补', '国家队', 'selection', 'chosen', 'representative', 'national team'],
  },
  {
    id: 'resource_economy', name: '资源经济算得清', nameEn: 'A resource economy that adds up',
    principle: '积分、装备、天材地宝的获取与消耗构成微型经济：有稀缺、有取舍、有积累，主角的每个选择都付了成本，变强才不廉价', principleEn: 'Points, gear and rare materials form a mini-economy with scarcity, trade-offs and accumulation; every power-up costs something so strength is never cheap',
    technique: '列一张主角资源台账（初始、每战净增、关键消耗、兑换目标），安排至少一次“资源用在救人还是强化自己”的两难；稀有掉落必须伴随高风险，禁止敌人无限送装备', techniqueEn: 'Keep a resource ledger (starting amount, net gain per fight, key spends, upgrade goal), and stage at least one dilemma—spend to save others or to self-enhance; rare drops require high risk, foes never farm out infinite gear',
    risk: '账要经得起观众算，消耗与获取逐集对得上', riskEn: 'The ledger must survive viewer scrutiny across episodes',
    kw: ['积分', '兑换', '天材地宝', '装备', '掉落', '资源', 'points', 'exchange', 'loot', 'resource', 'currency'],
  },
  {
    id: 'global_chessboard', name: '多国博弈不脸谱', nameEn: 'A multi-nation board without caricature',
    principle: '赛场是多国棋盘：对手国选手各有文化逻辑与战术风格，强者值得尊重，博弈靠策略而非对方集体降智，赢才含金', principleEn: 'The arena is a multi-nation board: foreign rivals carry coherent cultural logic and tactical styles, the strong deserve respect, and victory comes from strategy rather than collective enemy stupidity',
    technique: '给2-3个主要对手国（建议用虚构国名/泛称，如“北境联盟”）各立一套打法与一名可敬选手，安排一次主角靠学习对手思路破局；反派可以傲慢，但要有傲慢的资本与逻辑，禁止现实国旗对骂式丑化', techniqueEn: 'Give 2-3 main rivals (preferably fictional names such as “the Northern League”) distinct styles and one honorable player each, and once let the hero win by learning from a rival’s idea; antagonists may be arrogant but need grounds for it—never real-flag insult or caricature',
    risk: '对手国一律虚构化/泛称化，不映射现实国家民族、不煽动仇恨', riskEn: 'Fictionalize/generalize rival nations; never map to real countries or incite hatred',
    kw: ['多国', '国战', '外国选手', '全球', '赛场', '各国', 'global arena', 'rival nation', 'international', 'world stage'],
  },
  {
    id: 'audience_reaction', name: '国民围观放大器', nameEn: 'The watching public as amplifier',
    principle: '全民直播围观是国运流的情绪放大器：从质疑到屏息到沸腾，舆论的弧线就是观众情绪的镜像，但弹幕要有层次、不能只会喊666', principleEn: 'The livestreamed national audience amplifies emotion: doubt to hush to euphoria mirrors the viewer, but reactions need layers, not uniform cheering',
    technique: '设计三类声音（质疑派/专业派/路人转粉）随战局递进转变，关键操作前压一条不看好的评论、操作后让同一ID“打脸式”改口；用现实侧一个普通家庭/哨所的反应把宏大国运落到具体的人', techniqueEn: 'Design three voices (doubters, experts, converts) that shift with the fight; before a key play show a dismissive comment, after it let the same handle reverse in embarrassment; ground grand national stakes in one ordinary family or outpost reacting on the home front',
    risk: '弹幕克制使用，避免刷屏淹没剧情；不搞民粹式辱骂', riskEn: 'Use barrage sparingly so it never drowns the plot; no populist abuse',
    kw: ['直播', '弹幕', '围观', '全民关注', '舆论', '直播间', 'livestream', 'chat', 'public opinion', 'viewers'],
  },
  {
    id: 'power_system', name: '能力体系自洽有顶', nameEn: 'A self-consistent power system with a ceiling',
    principle: '觉醒职业、等级、技能克制构成可推演的体系：强弱有边界、克制有逻辑、升级有代价，主角的强是“用对了体系”而非作者随时加码', principleEn: 'Awakened classes, levels and counters form a deducible system with bounds, logical matchups and costly growth; the hero wins by using the system well, not by authorial power inflation',
    technique: '开篇立“职业树+等级上限+克制环”（如力/敏/智/辅互相牵制），主角的隐藏能力也要遵守体系规则、只在应用方式上出奇；每次升级写明代价（寿元、副作用、冷却），关键战前让观众知道他还差什么', techniqueEn: 'Establish a class tree, level cap and counter-loop (might/agility/intellect/support); even hidden powers obey system rules and surprise only in application; every upgrade states a cost (lifespan, side effect, cooldown), and before key fights show what he still lacks',
    risk: '禁止“危急时刻突然觉醒新技能”无铺垫破体系', riskEn: 'No unseeded sudden awakening that breaks the system in a crisis',
    kw: ['觉醒', '转职', '职业', '等级', '技能', '克制', '升级', 'awaken', 'class', 'level', 'skill', 'skill tree'],
  },
  {
    id: 'secret_realm_puzzle', name: '解谜优先于蛮力', nameEn: 'Puzzle-solving over brute force',
    principle: '副本最精彩的赢法是读懂规则、借势打力：用环境、机制、怪物特性解题，智斗让普通观众有“原来如此”的参与快感', principleEn: 'The best realm win reads the rules and leverages environment, mechanics and monster traits; clever problem-solving gives viewers an “aha!” participation high',
    technique: '每个副本埋一个“机制题眼”（怪物只认移动热源、地形会反弹、规则文字有双关），提前给线索、让主角先试错一次再破解；硬碰硬只作为解题后的收尾，不作为主解法', techniqueEn: 'Bury one mechanical key per realm (the monster tracks moving heat, terrain rebounds, rule wording is a pun), seed clues, let the hero fail once then solve; raw force only finishes what cleverness set up, never carries the main solution',
    risk: '题眼线索必须前置可回看，不能靠主角凭空猜到', riskEn: 'Clues must be seeded and rewatchable, never guessed from nothing',
    kw: ['解谜', '机关', '题眼', '机制', '智斗', '通关', 'puzzle', 'mechanism', 'clever clear', 'solve'],
  },
  {
    id: 'stakes_escalation', name: '代价阶梯式加压', nameEn: 'A rising staircase of stakes',
    principle: '压迫感来自代价逐级升级：个人负伤→队友折损→国民承压→国家危亡，每跨一级观众的揪心程度上一个台阶，最终胜利才有重量', principleEn: 'Tension comes from escalating cost: personal injury, teammate loss, public burden, national peril—each rung raises dread so the final win has weight',
    technique: '把全剧代价分四级排进时间线，前几集只付小代价并明示“再失败会怎样”，中段真的让一名配角付出不可逆代价（不复活、不洗白），终局把主角逼到“赢了比赛也可能失去某人”的两难', techniqueEn: 'Map four cost levels onto the timeline: early episodes pay small costs while stating the next penalty, the midpoint truly charges a supporting character an irreversible price (no revival, no whitewash), and the finale forces “win yet possibly lose someone”',
    risk: '代价要真兑现，不能每次都“刚好没事”消解紧张', riskEn: 'Costs must actually be paid; repeated last-second rescues drain tension',
    kw: ['代价', '牺牲', '惩罚', '失败后果', '生死', 'stakes', 'cost', 'penalty', 'sacrifice', 'peril'],
  },
  {
    id: 'cultural_root', name: '文化根脉巧制胜', nameEn: 'Winning through cultural roots',
    principle: '主角的深层优势是文化根脉：用历史智慧、传统技艺、东方哲学解题，文化自信落在“真有用”的情节里，而非角色喊口号', principleEn: 'The hero’s deep advantage is cultural roots: historical wisdom, traditional craft and Eastern philosophy solve problems, cultural confidence shown through genuine utility rather than slogans',
    technique: '选1-2个具体文化点（榫卯结构、孙子兵法虚实、节气物候、中医辨证、围棋弃子）提前铺垫其原理，让它成为破解某副本的关键钥匙；用行动结果说话，让外国对手由衷认可而非被说教', techniqueEn: 'Pick 1-2 concrete cultural elements (mortise-tenon structure, Sunzi’s void-and-substance, solar-term phenology, TCM pattern differentiation, Go sacrifice), seed how they work, then make one the key to a realm; let results speak and a rival admire genuinely rather than being lectured',
    risk: '文化点要查证准确、服务解题，杜绝堆砌名词与贬低他国', riskEn: 'Verify cultural details and make them serve the puzzle; no name-dropping or belittling others',
    kw: ['文化', '历史智慧', '传统', '兵法', '国学', '中医', '节气', 'cultural', 'traditional wisdom', 'heritage', 'philosophy'],
  },
];

const BY_ID = new Map(NATION_DEVICES.map((d) => [d.id, d]));
const NATION_HINT = ['国运', '秘境', '副本', '全民觉醒', '转职', '神域', '异兽入侵', '国战', '代表国家', '全球赛场', 'national fortune', 'secret realm', 'dungeon instance', 'awakened class', 'global arena', 'nation vs'];

export function detectNation(text: string): boolean {
  const t = (text || '').toLowerCase();
  return NATION_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickNationDevices(text: string, n = 3): NationDevice[] {
  const t = (text || '').toLowerCase();
  const hit = NATION_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: NationDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：规则（地基）+ 国运联动（类型魂）+ 解谜智斗（爽感方式）
  const fallback = ['realm_rules', 'national_binding', 'secret_realm_puzzle'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  NATION_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildNationDirective(text: string, lang: NationLang = 'zh', n = 3): string {
  if (!detectNation(text)) return '';
  const ds = pickNationDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a NATIONAL-FORTUNE / SECRET-REALM (global awakened-arena) drama. Engineer rule-based puzzles, visible nation linkage and a self-consistent power system deliberately. Use these devices this episode:\n${body}\nHard rules: realm rules are set early and never bent, the points/resource ledger stays consistent, the representative is selected credibly and growth always has a cost and a ceiling, wins come from reading the rules rather than brute force; fictionalize rival nations and never map them to real countries, incite ethnic hatred or caricature foreigners, no populist abuse in the livestream, cultural roots must be accurate and solve problems through action rather than slogans, and costs must be truly paid.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为国运秘境/全民觉醒流，规则智斗、国运联动与自洽能力体系要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：副本规则开场立清且全程不反悔；国运点与资源账逐集对得上；代表选拔有来路、升级有代价有上限；赢在读懂规则而非蛮力；对手国一律虚构化/泛称，不映射现实国家、不煽动民族仇恨、不丑化外邦，直播弹幕不搞民粹辱骂；文化根脉须查证准确、靠行动解题而非喊口号；失败代价必须真实兑现。`;
}
