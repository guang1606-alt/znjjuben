/**
 * 女频宅斗 / 宫斗权谋复仇机制引擎（v2.13）
 * ------------------------------------------------------------------
 * 第八套“类型机制引擎”。宅斗宫斗 AI 通病：靠主角嘴炮和光环赢、反派为坏而坏集体降智、
 * 斗争无视礼制身份规则、满屏雌竞、一路零成本碾压、把封建糟粕当爽点。本模块沉淀 10 套装置
 * （机理+技法+风险），自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type CourtLang = 'zh' | 'en';
export interface CourtDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const COURT_DEVICES: CourtDevice[] = [
  {
    id: 'power_map', name: '势力棋盘', nameEn: 'Power map as chessboard',
    principle: '开局立清各方势力、立场与核心利益，斗争才有棋盘感，观众看得懂谁在跟谁博弈', principleEn: 'Establish each faction’s stance and core interest up front so the conflict reads as a chessboard the viewer can follow',
    technique: '用一场家宴/请安/朝会一次性交代 3-5 股势力（嫡系/旁支、宠妃/皇后、清流/权臣）及其想要什么、怕什么、握有什么筹码；画一张隐性关系网，后续每次冲突都能在网上定位，新人物登场先补其立场', techniqueEn: 'Use one banquet/greeting/court scene to lay out 3–5 factions (lineage branches, favored consort vs empress, scholar-officials vs strong minister) with wants, fears and leverage; keep an implicit relationship web, locate every conflict on it, and state a new character’s stance on entry',
    risk: '势力信息要融进事件，不能大段旁白讲家谱；立场要随利益变化而流动', riskEn: 'Faction info must ride on events, not narration dumps; stances shift with interest',
    kw: ['势力', '派系', '朝堂', '家族', 'faction', 'power map', 'court forces', 'household politics'],
  },
  {
    id: 'info_game', name: '信息差设局', nameEn: 'Information-asymmetry traps',
    principle: '宅斗宫斗的核心武器是信息：谁知道什么、谁误信什么，利用信息差做局比正面冲突高级', principleEn: 'Information is the core weapon: who knows what, who believes a falsehood; engineering asymmetry is sharper than open clash',
    technique: '每场博弈先列“信息表”：主角知道、对手知道、观众知道各是什么；让主角故意放出半真半假的消息引对手动作，或隐瞒关键身份/证据，在对手自以为得计时揭示；观众比对手多知道一层，产生“等着看你翻车”的期待', techniqueEn: 'Before each contest list who knows what (hero, rival, audience); have the hero leak a half-true bait or hide key identity/evidence, revealing it when the rival thinks they’ve won; let the audience know one layer more than the rival for comeuppance anticipation',
    risk: '信息差要对观众公平（提前埋），不能靠对手突然变蠢制造', riskEn: 'Asymmetry must be fair (planted early), not created by a suddenly stupid rival',
    kw: ['信息差', '设局', '算计', '布局', 'information', 'scheme', 'misdirection', 'trap'],
  },
  {
    id: 'evidence_counter', name: '证据链反杀', nameEn: 'Evidence-chain counter-kill',
    principle: '翻盘靠可拼合的证据链与人证物证，而非临场嘴炮；证据要提前埋、逐步凑、一次收网', principleEn: 'Turnarounds rely on a pieced-together evidence chain and witnesses, not improvised speeches; plant early, gather step by step, close the net once',
    technique: '主角每受一次害就暗中固定一个证据（账册、药方、书信、人证、时间线破绽），把零散证据攒成闭环；收网卡点在公开场合（祠堂/家宴/大殿）当面对质，按“指控—抵赖—逐条亮证—对方崩盘”四拍推进', techniqueEn: 'Each time the hero is wronged, secretly secure one piece (ledger, prescription, letter, witness, timeline flaw) into a closed chain; spring it in a public forum (ancestral hall/banquet/throne room) in four beats: accusation → denial → evidence shown one by one → rival collapses',
    risk: '证据来源要合法可信、不能伪造构陷无辜；否则主角与反派无异', riskEn: 'Evidence must be legitimate and credible, never fabricated to frame the innocent, or the hero becomes the villain',
    kw: ['证据', '人证物证', '反杀', '对质', 'evidence', 'proof', 'expose', 'counter'],
  },
  {
    id: 'motive_chain', name: '利益动机链', nameEn: 'Interest-driven motives',
    principle: '每个反派与盟友的行为都由利益或恐惧驱动，动机成立，斗争才真实、不降智', principleEn: 'Every rival and ally acts from interest or fear; sound motives make conflict real and keep characters smart',
    technique: '给每个对手写一句“他为什么非这么做不可”（继承权、位份、家族存亡、把柄被握），其每次出手都服务这个动机；反派失败后会按利益理性调整策略（拉拢、栽赃、断臂求生）而非情绪化重复同一招', techniqueEn: 'Give each antagonist one line on why they must act (inheritance, rank, family survival, blackmail leverage), with every move serving it; after losing they rationally adapt (co-opt, frame, cut losses) rather than repeat one tactic out of spite',
    risk: '不能为推动剧情让反派突然智商下线或无缘无故使坏', riskEn: 'Never dumb a rival down or make them evil for no reason just to advance plot',
    kw: ['动机', '利益', '图谋', '私心', 'motive', 'interest', 'agenda', 'self-interest'],
  },
  {
    id: 'forbearance', name: '蛰伏蓄力', nameEn: 'Forbearance & accumulation',
    principle: '主角开局弱势时先藏锋、攒筹码（证据/人脉/银钱/名分），时机不到不出手，出手必中', principleEn: 'When weak at the start, the hero hides edge and accumulates leverage (evidence, allies, funds, standing), never striking before the time is ripe, then striking true',
    technique: '排一条蓄力线：受辱—隐忍并记录—暗中结交关键人—拿到第一个把柄—小胜立威—最终清算；隐忍期用一两个“只有观众懂的反击小动作”体现主角没认命，避免憋屈感堆积', techniqueEn: 'Chart accumulation: wronged → endure while recording → quietly recruit key people → gain first leverage → small win to establish standing → final reckoning; during endurance, insert one or two small counter-moves only the audience reads, so it never feels helplessly grim',
    risk: '隐忍不等于窝囊受气，要让观众看到主动性与计划感', riskEn: 'Forbearance is not passivity; the audience must see agency and a plan',
    kw: ['蛰伏', '隐忍', '蓄力', '藏锋', 'forbearance', 'bide time', 'endure', 'lay low'],
  },
  {
    id: 'restraint_wit', name: '绵里藏针对白', nameEn: 'Veiled wit under decorum',
    principle: '礼制约束下古人不撕破脸当街吵，交锋靠话里有话、绵里藏针、以退为进，台词有层次才高级', principleEn: 'Under ritual decorum people do not brawl openly; clashes run on veiled meaning, a needle hidden in silk and strategic retreat — layered dialogue feels refined',
    technique: '冲突对白走“表面客气—话里带刺—对方听懂却抓不到错—主角笑着占上风”的路数，用称谓、敬语、典故、双关做武器；情绪最激烈时反而压低声音、用最平静的话放最狠的警告', techniqueEn: 'Play conflict as polite surface → barbed subtext → the rival understands but cannot fault it → the hero wins with a smile; use forms of address, honorifics, allusion and double meaning as weapons; at peak emotion, lower the voice and deliver the coldest warning calmly',
    risk: '古风台词要符合身份与时代，不能出现现代网络语；晦涩到观众听不懂也不行', riskEn: 'Period dialogue must fit status and era (no modern slang), yet stay understandable',
    kw: ['绵里藏针', '话里有话', '交锋', '口舌', 'veiled', 'wit', 'subtext', 'verbal duel'],
  },
  {
    id: 'female_alliance', name: '女性同盟群像', nameEn: 'Female alliances & ensemble',
    principle: '跳出“女人只为男人斗”的雌竞套路，写主仆情、姐妹盟、跨阶层互助，女性配角各有立场与弧光', principleEn: 'Move beyond women fighting only over a man; write mistress-servant bonds, sister alliances and cross-class mutual aid, with female supporting characters who have their own stances and arcs',
    technique: '给主角配 1-2 个有独立诉求的女性盟友（忠心但有自己难处的丫鬟、同样被压迫的妯娌/嫔妃、掌握技艺的女先生/女医），关键翻盘靠同盟协作而非单一男主拯救；反派阵营也写一个“身不由己”的复杂女性，避免全员工具人', techniqueEn: 'Give the hero 1–2 female allies with their own goals (a loyal servant with her own hardship, an equally oppressed sister-in-law/consort, a skilled female tutor/physician); key wins come through alliance teamwork, not a male lead’s rescue; give the rival side one complex trapped woman too',
    risk: '不能把所有女性写成情敌/坏人；同盟也要有利益与信任建立过程', riskEn: 'Don’t make every woman a rival or villain; alliances need earned trust',
    kw: ['女性同盟', '姐妹', '主仆', '群像', 'female alliance', 'sisterhood', 'women help women', 'ensemble'],
  },
  {
    id: 'revenge_ledger', name: '复仇账本清算', nameEn: 'Revenge ledger reckoning',
    principle: '把仇怨与亏欠列成账本，按轻重缓急逐个清算，节奏清晰、冤有头债有主，爽点不断档', principleEn: 'Keep a ledger of wrongs and debts and settle them by priority; clear pacing, the right culprit for each wrong, steady payoffs',
    technique: '开局列“谁害了谁、怎么害的、证据何在”的复仇清单，先清算外围爪牙立威、再断对手臂膀、最后直指主谋；每清算一笔回扣当初受害场景形成对照，同时让主角在复仇中守住底线、不迁怒无辜', techniqueEn: 'Open with a list of who wronged whom, how and where the proof is; settle outer lackeys first, then cut the rival’s arms, finally the mastermind; each reckoning callbacks the original harm, while the hero keeps boundaries and never harms the innocent',
    risk: '复仇止步于让对方承担应有代价（律法/名声/失去所依），不滥施私刑', riskEn: 'Revenge ends in due consequences (law, reputation, loss of support), never lynching',
    kw: ['复仇', '清算', '报仇', '讨债', 'revenge', 'reckoning', 'settle scores', 'payback'],
  },
  {
    id: 'status_rules', name: '身份礼制规则', nameEn: 'Status & ritual rules as game rules',
    principle: '嫡庶、位份、宗法、礼制就是这个世界的“游戏规则”，高手在规则内借力、用规则反制', principleEn: 'Legitimacy, rank, patriarchal clan law and ritual are this world’s game rules; experts leverage and counter within them',
    technique: '先讲清本局关键规则（嫡庶继承权、后宫位份与请安规矩、宗法过继/和离条件、诰命封赏），让主角用规则本身反制（以礼制压人、拿规矩堵嘴、借宗法正名）；对手若破坏规则要付出“失了名分/人心”的代价', techniqueEn: 'Clarify the rules in play (legitimacy and inheritance, harem rank and greeting protocol, clan adoption/divorce conditions, noble titles), then let the hero counter through the rules themselves (ritual authority, rule-based rebuttal, clan-law legitimation); rivals who break rules pay in standing and support',
    risk: '规则一旦设定全剧一致；涉及封建制度要呈现其压迫性而非理所当然地歌颂', riskEn: 'Rules stay consistent; portray feudal institutions as oppressive rather than glorifying them',
    kw: ['嫡庶', '位份', '宗法', '礼制', 'rank', 'ritual', 'status', 'propriety', 'concubine rank'],
  },
  {
    id: 'win_cost', name: '胜负有代价', nameEn: 'Victory carries a cost',
    principle: '赢一局也要付出代价或结下新仇、暴露新底牌，没有零成本碾压，博弈才有张力与后劲', principleEn: 'Every win costs something—new enmity, a revealed card, a trade-off; no zero-cost sweeps, so the contest keeps tension and momentum',
    technique: '每次胜利后给一个“代价尾拍”：虽赢了名声却失去某个盟友、暴露了一项底牌引来更强对手、为顾全大局做了取舍；把代价转化为下一局的难题，形成“赢—付代价—再破局”的螺旋上升', techniqueEn: 'After each win add a cost tail: reputation gained but an ally lost, a card exposed drawing a stronger foe, a trade-off for the greater good; turn that cost into the next contest’s problem, forming a win → cost → re-solve spiral',
    risk: '代价要真实影响后续，不能嘴上说有代价实则毫发无损', riskEn: 'Costs must truly affect later plot, not be claimed while the hero stays unscathed',
    kw: ['代价', '取舍', '输赢', '后患', 'cost', 'price of victory', 'trade-off', 'aftermath'],
  },
];
export const VALID_COURT_DEVICES = new Set(COURT_DEVICES.map((d) => d.id));
const BY_ID = new Map(COURT_DEVICES.map((d) => [d.id, d]));

const COURT_HINT = ['宅斗', '宫斗', '权谋', '嫡女', '庶女', '侧妃', '王妃', '皇后', '贵妃', '后宫', '夺嫡', '和离', '世家', '侯府', '将军府', '长房', '妯娌', '婆母', '重生复仇古言', 'court intrigue', 'harem politics', 'inner court', 'concubine', 'legitimate wife', 'aristocratic household', 'palace scheming'];
export function detectCourt(text: string): boolean {
  const t = (text || '').toLowerCase();
  return COURT_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickCourtDevices(text: string, n = 3): CourtDevice[] {
  const t = (text || '').toLowerCase();
  const hit = COURT_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: CourtDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：势力棋盘（看得懂）+ 证据链反杀（赢得实）+ 身份礼制（守类型质感）
  const fallback = ['power_map', 'evidence_counter', 'status_rules'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  COURT_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildCourtDirective(text: string, lang: CourtLang = 'zh', n = 3): string {
  if (!detectCourt(text)) return '';
  const ds = pickCourtDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a FEMALE-ORIENTED PERIOD HOUSEHOLD / COURT-INTRIGUE revenge story. Engineer the scheming deliberately. Use these devices this episode:\n${body}\nHard rules: win through an evidence chain and information play rather than protagonist halo or improvised speeches, every rival acts from credible interest/fear and stays smart, all schemes operate within consistent status-and-ritual rules, show female alliances and complex women instead of only catfights over a man, revenge stops at due consequences (never lynching), portray feudal oppression critically without glorifying it, and keep period dialogue free of modern slang and graphic cruelty.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为女频宅斗/宫斗权谋复仇题材，算计与博弈要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：翻盘靠证据链与信息差、不靠主角光环和临场嘴炮；反派都有可信的利益/恐惧动机且不降智；所有博弈在嫡庶位份宗法礼制规则内进行、规则全剧一致；写女性同盟与复杂女性群像、不搞“只为男人斗”的单薄雌竞；复仇止步于让对方承担应有代价、不滥施私刑；批判性呈现封建压迫而非歌颂糟粕；古风台词符合身份、无现代网络语、不渲染酷刑血腥。`;
}
