/**
 * 男频玄幻 / 修仙升级流机制引擎（v2.17）
 * ------------------------------------------------------------------
 * 第十一套“类型机制引擎”。男频升级流 AI 通病：境界体系混乱、升级白给无代价、金手指万能导致
 * 毫无张力、战力崩坏吃书、打脸廉价无铺垫、势力沦为背景板、数值通胀后期收不住、纯靠掠夺踩人。
 * 本模块沉淀 10 套装置（机理+技法+风险），自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type XuanLang = 'zh' | 'en';
export interface XuanDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const XUAN_DEVICES: XuanDevice[] = [
  {
    id: 'cultivation_ladder', name: '境界阶梯清晰', nameEn: 'A clear cultivation ladder',
    principle: '升级流的地基是一套读者随时能对照的境界体系：每一级有明确的能力边界、标志与寿命/地位变化，越级才有分量', principleEn: 'The foundation is a ladder readers can check at any time: each realm has clear ability bounds, hallmarks and changes in standing, so crossing realms means something',
    technique: '开篇先定死境界序列（小境界×大境界）与每级“能做什么/不能做什么”，主角当前境界、下一境界门槛、关键配角境界在大纲阶段就列成对照表；每次突破明确写出跨越了哪条能力边界，不临时新增未铺垫的境界', techniqueEn: 'Fix the realm sequence (minor and major stages) and what each can/cannot do up front; list the hero’s realm, the next threshold and key characters’ realms in the outline; every breakthrough states which ability boundary was crossed, never inventing unseeded realms on the spot',
    risk: '境界数量要克制，过多过碎读者记不住、后期必通胀', riskEn: 'Keep the number of realms restrained; too many tiny stages confuse readers and inflate the late game',
    kw: ['境界', '筑基', '金丹', '元婴', '渡劫', '等级', 'realm', 'cultivation stage', 'foundation', 'core formation', 'nascent soul', 'leveling'],
  },
  {
    id: 'breakthrough_cost', name: '突破有代价', nameEn: 'Breakthroughs carry a price',
    principle: '升级绝不能白给：资源、悟性、机缘、心魔、失败风险至少占其一，跨过门槛的艰难让收获有重量', principleEn: 'Leveling is never free: resources, comprehension, fortune, inner demons or failure risk must apply, so hard-won gains carry weight',
    technique: '每次突破前先交代缺什么（缺丹药/缺感悟/被人追杀时限），突破过程设置一个真实障碍（走火入魔、天劫、资源被抢、心境关），并让主角付出可感知的代价（寿元、旧伤、人情、暴露底牌）；失败或险胜比一路平推更有记忆点', techniqueEn: 'Before each breakthrough state what is missing (pill, insight, a deadline under pursuit), set a real obstacle (qi deviation, heavenly tribulation, stolen resources, a state-of-mind trial), and exact a felt price (lifespan, an old wound, a favor owed, exposing a trump card); a narrow or failed attempt is more memorable than a smooth climb',
    risk: '代价不能只写在设定里，要落到后续剧情（旧伤会复发、人情要还）', riskEn: 'The price must echo later (old wounds recur, favors are called in), not stay on the spec sheet',
    kw: ['突破', '天劫', '心魔', '走火入魔', '瓶颈', 'breakthrough', 'tribulation', 'inner demon', 'bottleneck', 'qi deviation'],
  },
  {
    id: 'cheat_rulebound', name: '金手指有规则', nameEn: 'A rule-bound cheat',
    principle: '系统、外挂、特殊体质是男频引擎，但必须有明确规则、限制与代价（冷却、反噬、条件触发），万能金手指会杀死所有张力', principleEn: 'A system, cheat or special constitution drives the genre, but it needs clear rules, limits and costs (cooldown, backlash, trigger conditions); an omnipotent cheat kills all tension',
    technique: '为主角金手指写一张“规则卡”：能做什么、不能做什么、触发条件、使用代价、成长方式；每次靠金手指取胜都受规则约束并留下后患或暴露风险；金手指随主角变强而成长，但永远保留一条它解决不了的难题，逼主角用智慧与心性破局', techniqueEn: 'Write a rule card for the cheat: what it can/cannot do, triggers, costs and growth path; every win through it obeys the rules and leaves fallout or exposure risk; it grows with the hero but always faces one problem it cannot solve, forcing wit and character',
    risk: '不能“需要时突然冒出新功能”，新能力必须提前埋线', riskEn: 'Never sprout a new function when convenient — new abilities must be seeded in advance',
    kw: ['系统', '金手指', '外挂', '特殊体质', '面板', 'cheat', 'system', 'golden finger', 'special constitution', 'status panel'],
  },
  {
    id: 'power_consistency', name: '战力标尺一致', nameEn: 'A consistent power scale',
    principle: '战力是男频的硬通货：谁强谁弱必须有稳定标尺，以弱胜强要靠明确依据（底牌、地形、克制、算计），绝不吃书', principleEn: 'Power scaling is the genre’s hard currency: relative strength needs a stable ruler, and winning against odds needs explicit grounds (a hidden card, terrain, counter, scheme), never retconning',
    technique: '维护一张“战力账本”：记录每个角色境界、招式、底牌与已展现的战绩，对决前让读者能据此预判；以弱胜强时让主角的赢来自提前布局/属性克制/信息差/临场悟道，并解释为什么强者会输；不允许同一招式时强时弱', techniqueEn: 'Maintain a power ledger of each character’s realm, techniques, trump cards and shown record so readers can predict fights; an underdog win comes from prior setup, attribute counter, information gap or on-the-spot insight, with the strong side’s loss explained; a move must not be strong one moment and weak the next',
    risk: '为爽感临时拔高主角、削弱反派是战力崩坏的主因，须禁止', riskEn: 'Never arbitrarily buff the hero or nerf the villain for a cheap thrill — that is the main cause of power-scaling collapse',
    kw: ['战力', '以弱胜强', '越级', '底牌', '克制', 'power scaling', 'overpower', 'punch above', 'hidden card', 'counter'],
  },
  {
    id: 'opportunity_scramble', name: '机缘多方争夺', nameEn: 'Contested opportunities',
    principle: '天材地宝、秘境、传承不是主角白捡：多方势力围绕机缘博弈，机缘伴随风险、抉择与代价，拿到才爽', principleEn: 'Treasures, secret realms and legacies are not picked up for free; factions contest them, and opportunity comes with risk, choice and price, making the win satisfying',
    technique: '每个机缘先铺“为何珍贵、谁在抢、有何凶险”，让主角在信息不全、实力不足的情况下做取舍（救人与夺宝、冒险与止损）；机缘常带考验（心性/悟性/因果），主角靠人格与判断而非纯运气通过；夺得后引发新的追杀或因果，勾连下一段剧情', techniqueEn: 'For each opportunity establish why it is precious, who contests it and the danger; force trade-offs under incomplete information and insufficient strength (save someone vs seize treasure, risk vs cut losses); opportunities carry trials of heart/comprehension/karma passed through character and judgment rather than luck; winning triggers new pursuit or karma that hooks the next arc',
    risk: '机缘不能排队送上门，也不能让配角集体降智衬托主角', riskEn: 'Opportunities must not line up for the hero, nor should supporting characters suddenly act stupid to elevate him',
    kw: ['机缘', '秘境', '传承', '天材地宝', '夺宝', 'opportunity', 'secret realm', 'legacy', 'treasure', 'contest'],
  },
  {
    id: 'faction_ecology', name: '势力生态自洽', nameEn: 'A self-consistent faction ecology',
    principle: '宗门、家族、王朝、妖族、商会各有利益逻辑与行事边界，主角在势力网络中借势、制衡、崛起，世界才不空', principleEn: 'Sects, clans, dynasties, demon tribes and merchant guilds each have interests and operating bounds; the hero leverages and balances within this network, making the world feel solid',
    technique: '列出主要势力的诉求、资源、敌对/同盟关系与规矩（门规、法度、潜规则），主角的每次行动都要考虑势力反应与代价；让主角先借势（拜师、结盟、立功劳）再一步步建立自己的班底与势力；反派也有合理目标与底线，不为坏而坏', techniqueEn: 'List each major faction’s goals, resources, alliances/feuds and rules (sect law, state law, unwritten norms), and have the hero weigh faction reactions; let him first leverage forces (take a master, ally, earn merit), then build his own team and power base; antagonists have rational aims and limits rather than being evil for evil’s sake',
    risk: '势力不能只是名字，要有至少一次按自身逻辑行动的戏', riskEn: 'A faction is not just a name — it must act by its own logic at least once',
    kw: ['宗门', '家族', '势力', '王朝', '妖族', 'sect', 'clan', 'faction', 'dynasty', 'demon tribe'],
  },
  {
    id: 'face_slap_cadence', name: '打脸有铺垫有节奏', nameEn: 'Earned, rhythmic face-slapping',
    principle: '被轻视—隐忍/蓄力—亮实力—反转打脸是男频核心爽感，但必须先铺垫对方为何有眼无珠、主角为何藏拙，打脸才不廉价', principleEn: 'Being looked down on → endurance/buildup → reveal strength → reversal is the core thrill, but it needs setup for why the doubter misjudged and why the hero hid strength, or the payoff feels cheap',
    technique: '打脸走三步：先让对方基于“合理信息差”轻视（主角藏修为/扮猪吃虎有理由），再给一次小露锋芒的预警被无视，最后在对方最笃定的场合一举反转并兑现实际收益（地位/资源/婚约反转）；大小打脸交替，避免每集同一套路', techniqueEn: 'Use three beats: the doubter scorns based on a plausible information gap (the hero hides cultivation for a reason), a small warning display is ignored, then the reversal lands where the doubter is most certain, converting into real gains (status, resources, an engagement reversal); alternate big and small payoffs instead of repeating one pattern every episode',
    risk: '被打脸方不能集体智商掉线，反派越有分量打脸越爽', riskEn: 'Those being humiliated must not lose all intelligence; the weightier the rival, the better the payoff',
    kw: ['打脸', '扮猪吃虎', '轻视', '反转', '装', 'face-slap', 'hide strength', 'underestimated', 'humiliate the doubter', 'reversal'],
  },
  {
    id: 'dao_heart', name: '道心与心性成长', nameEn: 'Dao-heart and inner growth',
    principle: '实力升级必须配心性升级：力量越大考验越大，主角在诱惑、仇恨、执念中守住道心，人物才立得住、不沦为打怪机器', principleEn: 'Power growth must pair with inner growth: greater strength brings greater trials, and the hero keeping his dao-heart amid temptation, hatred and obsession makes him a person, not a grinding machine',
    technique: '每个大境界突破配一次心性考验（力量诱惑、复仇边界、牺牲抉择、被误解的孤独），让主角的选择体现其道（守护/求真/护道而非纯掠夺）；安排对照角色（走火入魔的同代人、堕入邪道的天才）反衬主角道路；境界越高越要写“强者的责任”', techniqueEn: 'Pair each major breakthrough with an inner trial (the lure of power, the limits of revenge, a sacrifice choice, the loneliness of being misunderstood), with choices expressing his dao (guarding, seeking truth, protecting rather than merely plundering); use foils (a peer who deviated, a genius who fell to evil path) to contrast his road; higher realms bring the responsibility of the strong',
    risk: '道心不是喊口号，要通过具体抉择与代价体现', riskEn: 'Dao-heart is shown through concrete choices and costs, not slogans',
    kw: ['道心', '心性', '邪道', '守护', '悟道', 'dao heart', 'inner growth', 'demonic path', 'enlightenment', 'resolve'],
  },
  {
    id: 'world_coherent', name: '世界观设定自洽', nameEn: 'Coherent worldbuilding',
    principle: '修炼体系、地理、种族、货币、功法品阶、丹符器阵要互相咬合、前后一致，设定为剧情服务而非炫设定', principleEn: 'Cultivation system, geography, races, currency, technique grades, pills/talismans/artifacts/formations must interlock and stay consistent; worldbuilding serves the plot, not showing off',
    technique: '维护一张“设定圣经”：力量来源、资源循环（灵石如何产出消耗）、社会结构（凡人/修士关系）、地理距离与交通方式一次定清；新设定出现时检查与旧设定是否冲突；设定通过人物行动自然展开，避免大段设定讲解（info-dump）', techniqueEn: 'Keep a worldbuilding bible: the source of power, resource cycle (how spirit stones are produced and spent), social structure (mortals vs cultivators), geography and travel; check every new element against it; reveal settings through character action, avoiding info-dumps',
    risk: '设定不是越多越好，自洽与可理解优先于新奇堆砌', riskEn: 'More is not better; coherence and clarity outrank novelty stacking',
    kw: ['世界观', '设定', '灵石', '功法', '丹符器阵', 'worldbuilding', 'magic system', 'spirit stone', 'lore', 'setting'],
  },
  {
    id: 'payoff_rhythm', name: '升级爽点兑付节奏', nameEn: 'A cadence of payoffs',
    principle: '男频要“小爽不断、大爽按时”：每集有即时兑付（压制/收获/亮一手），每个小篇章有大兑付（突破/复仇/夺魁），期待不被长期拖欠', principleEn: 'The genre needs constant small payoffs and scheduled big ones: instant gratification each episode (suppression, a gain, a flash) and a major payoff per arc (breakthrough, revenge, winning the crown), never withholding expectation too long',
    technique: '排一张“兑付表”：每 1-2 集一个小爽点（反杀小反派、得小资源、身份小反转），每个 8-12 集小篇章收一个大爽点（境界突破、宿敌了结、势力地位跃升）；每次受压后必须在合理篇幅内兑付，压抑不连续超过两集；大爽点后立刻抛出下一个更大的目标钩子', techniqueEn: 'Plan a payoff table: a small win every 1–2 episodes (counter-kill a minor foe, gain a resource, a small identity reversal) and a major payoff per 8–12 episode arc (realm breakthrough, settling with a rival, a leap in standing); after pressure, deliver within reasonable length — never more than two episodes of pure suppression; right after a big payoff, hook the next larger goal',
    risk: '爽点不能透支信用：兑付要建立在前文铺垫上，不能凭空天降', riskEn: 'Payoffs must not spend unearned credibility — they rest on prior setup, never fall from the sky',
    kw: ['爽点', '兑付', '反杀', '复仇', '高潮', 'payoff', 'satisfaction', 'counter-kill', 'revenge', 'climax'],
  },
];
export const VALID_XUAN_DEVICES = new Set(XUAN_DEVICES.map((d) => d.id));
const BY_ID = new Map(XUAN_DEVICES.map((d) => [d.id, d]));

const XUAN_HINT = ['玄幻', '修仙', '修真', '仙侠', '境界', '筑基', '金丹', '元婴', '化神', '渡劫', '飞升', '宗门', '灵根', '功法', '灵气', '修士', '斗气', '魔法世界', '异世界', '男频升级', '升级流', '剑修', '妖族', '天道', 'xianxia', 'cultivation', 'xuanhuan', 'eastern fantasy', 'qi refining', 'foundation establishment', 'core formation', 'nascent soul', 'tribulation ascension', 'immortal sect', 'spirit root', 'isekai fantasy', 'progression fantasy', 'power fantasy', 'martial cultivation'];
export function detectXuan(text: string): boolean {
  const t = (text || '').toLowerCase();
  return XUAN_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickXuanDevices(text: string, n = 3): XuanDevice[] {
  const t = (text || '').toLowerCase();
  const hit = XUAN_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: XuanDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：境界阶梯（地基）+ 金手指规则（张力）+ 兑付节奏（爽感）
  const fallback = ['cultivation_ladder', 'cheat_rulebound', 'payoff_rhythm'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  XUAN_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildXuanDirective(text: string, lang: XuanLang = 'zh', n = 3): string {
  if (!detectXuan(text)) return '';
  const ds = pickXuanDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a MALE-ORIENTED XIANXUAN / CULTIVATION-PROGRESSION power fantasy. Engineer the leveling pleasure deliberately. Use these devices this episode:\n${body}\nHard rules: keep the realm ladder and power scale consistent with no retcons, every breakthrough and cheat use carries rules and a price (no omnipotent free power), underdog wins need explicit grounds, the hero’s strength is tied to dao-heart growth and responsibility rather than mere plundering or stepping on others, keep violence non-graphic without glorifying cruelty or feudal oppression as “correct”, and control numerical inflation so the story can still converge at the finale.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为男频玄幻/修仙升级流，升级爽感要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：境界阶梯与战力标尺前后一致、绝不崩坏吃书；每次突破与金手指使用都要有规则、有限制、有代价，杜绝万能白给；以弱胜强必须给出明确依据；主角的强要与道心成长、强者责任绑定，不纯靠掠夺与踩人上位；杀伐点到为止、不渲染血腥虐杀，不把封建等级压迫当作“天经地义”去宣扬；控制数值通胀，保证后期收得住、结局能闭环。`;
}
