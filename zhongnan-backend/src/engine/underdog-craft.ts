/**
 * 下沉爽剧（逆袭/打脸/战神赘婿）机制引擎（v2.11）
 * ------------------------------------------------------------------
 * 第六套“类型机制引擎”。下沉爽剧 AI 通病：全程无脑碾压没有起伏、反派集体降智、
 * 打脸重复同质、主角强得没来源、为爽越过法律道德底线。本模块沉淀 10 套爽感装置
 * （机理+技法+风险），自动识别逆袭/打脸/战神/赘婿/马甲意图并下发；非爽剧返回空串。
 * 纯函数、确定性、双语。
 */
export type UnderdogLang = 'zh' | 'en';
export interface UnderdogDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const UNDERDOG_DEVICES: UnderdogDevice[] = [
  {
    id: 'hidden_identity', name: '马甲分层揭露', nameEn: 'Layered hidden identity',
    principle: '主角真实身份/实力要分层藏、分层揭，每揭一层都是一次爽点，一次亮完后续乏力', principleEn: 'Hide the protagonist’s true identity/power in layers and reveal one layer at a time; each reveal is a payoff — showing all at once kills later tension',
    technique: '开局列出主角的“身份洋葱”（表面废物→某领域高手→更高马甲→最终身份），每隔 2-4 集只揭一层，揭露前先让旁人误判、羞辱，揭露时用一个具体事件坐实；留一层到结局前引爆', techniqueEn: 'List an identity onion upfront (seemingly useless → expert in one field → bigger alias → final identity); reveal one layer every 2–4 episodes, preceded by others misjudging or humiliating, proven by a concrete event; keep one layer for near the finale',
    risk: '马甲必须前后一致、能自圆其说，不能临时编新身份救场', riskEn: 'Aliases must stay consistent and self-consistent; never invent a new identity on the spot to save the scene',
    kw: ['马甲', '隐藏身份', '扮猪吃虎', '身份', 'hidden identity', 'secret powerhouse', 'undercover boss', 'true identity'],
  },
  {
    id: 'face_slap_ladder', name: '打脸阶梯递进', nameEn: 'Escalating face-slap ladder',
    principle: '打脸要逐级升级：对象越来越强、场面越来越公开、方式越来越解气，重复同一种打脸会腻', principleEn: 'Face-slaps must escalate: stronger targets, more public stages, more satisfying methods; repeating the same kind numbs the viewer',
    technique: '排一条打脸阶梯（身边小人→主管→权贵→幕后大 Boss），每次打脸换不同武器（证据/实力/人脉/身份），并让上一级被打脸者成为下一级的见证者或铺垫；单次打脸遵循“被质疑—亮证据—反转—对方失态”四拍', techniqueEn: 'Build a ladder (petty rival → supervisor → powerful figure → hidden boss), varying the weapon each time (evidence, skill, connections, identity), making the previous loser witness the next; each slap follows four beats: doubted → evidence shown → reversal → opponent loses composure',
    risk: '打脸靠真本事/证据，不靠主角光环强词夺理；四拍缺一不爽', riskEn: 'Win through real ability or evidence, not protagonist halo; a missing beat weakens the payoff',
    kw: ['打脸', '逆袭', '翻身', '反打', 'face slap', 'comeuppance', 'prove them wrong', 'turnaround'],
  },
  {
    id: 'suppress_release', name: '压抑释放节奏', nameEn: 'Suppress-then-release rhythm',
    principle: '爽感来自落差：先把主角压到谷底，释放才解气；压得越实、反弹越爽，但压抑不能超过观众耐心', principleEn: 'Satisfaction comes from contrast: press the protagonist to the bottom first, then release; the firmer the suppression, the sweeter the rebound, but never past the audience’s patience',
    technique: '每个爽点单元做“受压（被误解/羞辱/剥夺）—忍耐（守住底线的小动作）—蓄力（拿到证据或实力）—爆发（一次性反打）”；单次压抑控制在 1-2 集内见到第一次释放，全剧压放交替、避免连压三集以上', techniqueEn: 'Each payoff unit runs: oppressed (misjudged/humiliated/stripped) → endure (small integrity-preserving move) → charge (gain evidence or power) → burst (counter in one move); keep a single suppression to 1–2 episodes before first release, alternating press/release, never three straight episodes of suppression',
    risk: '为虐而虐、压太久观众弃剧；压抑期主角也要有主动性，不能纯挨打', riskEn: 'Grim-for-its-own-sake or overlong suppression causes drop-off; even while pressed the protagonist must act, not merely suffer',
    kw: ['压抑', '释放', '谷底', '忍', 'suppress', 'underdog suffering', 'build up', 'catharsis'],
  },
  {
    id: 'underdog_dignity', name: '弱者尊严锚点', nameEn: 'Underdog dignity anchor',
    principle: '主角可以落魄，但必须在受辱时守住一条底线/善意，观众才会坚定站队、盼他翻身', principleEn: 'The protagonist may be down-and-out, but must hold one line of integrity or kindness under humiliation so viewers firmly root for the comeback',
    technique: '开局 1-2 场内立一个“尊严锚点”（再难也不偷不抢、护着家人/弱者、有一技之尊），后续每次被羞辱都让他用这个锚点回应一次；翻身之后回扣锚点，证明他没忘本', techniqueEn: 'Set a dignity anchor in the first 1–2 scenes (won’t steal even when desperate, protects family/the weak, pride in a craft); under each humiliation let him answer through that anchor, and callback to it after rising to show he hasn’t changed',
    risk: '不能为了卖惨让主角毫无骨气；观众同情弱者但追随有脊梁的人', riskEn: 'Don’t strip the protagonist of all backbone for pity; viewers pity the weak but follow those with spine',
    kw: ['尊严', '底线', '落魄', '善良', 'dignity', 'principled underdog', 'self-respect', 'good person'],
  },
  {
    id: 'power_logic', name: '实力金手指自洽', nameEn: 'Self-consistent power source',
    principle: '主角强必须有可信来源（多年苦练/奇遇规则/资源积累），且能力边界与规则前后一致，不无脑开挂', principleEn: 'Strength needs a credible source (years of training, rule-bound opportunity, accumulated resources), with consistent limits and rules — no mindless god-mode',
    technique: '前期埋实力来源（闪回/道具/师承/系统规则），明确金手指能做什么、不能做什么、代价是什么；每次用实力解决问题都在既定规则内，遇到更强对手时靠成长或智取而非突然变强', techniqueEn: 'Plant the power source early (flashback, item, mentor, system rules), state what the cheat can/cannot do and its cost; every win stays within those rules, and against a stronger foe rely on growth or wit rather than a sudden power-up',
    risk: '规则随剧情需要随意变、危机靠临时新能力化解，是最大悬浮感来源', riskEn: 'Rules shifting for plot convenience or crises solved by sudden new powers are the top source of unreality',
    kw: ['实力', '金手指', '开挂', '能力', 'power source', 'cheat ability', 'skill mastery', 'consistent power'],
  },
  {
    id: 'smart_villain', name: '反派逐级加码不降智', nameEn: 'Smart escalating villains',
    principle: '反派越聪明、手段越狠，主角赢了才越爽；让反派降智送人头等于自降爽感', principleEn: 'The smarter and more ruthless the antagonist, the sweeter the win; dumbing villains down to hand over victory cheapens the payoff',
    technique: '给反派合理动机、资源与连续策略，每次失败后升级手段（从使绊子→动用关系→铤而走险）；主角靠识破算计、提前布局反制取胜，关键局让反派自以为得计后再翻盘', techniqueEn: 'Give antagonists sound motives, resources and a sequence of tactics, escalating after each failure (obstruction → pulling strings → desperate move); the hero wins by seeing through schemes and pre-positioning, in key scenes letting the villain believe they’ve won before the reversal',
    risk: '反派不能脸谱化到只会叫嚣；也不能让反派强到主角无法合理取胜', riskEn: 'Avoid one-note villains who only shout; yet don’t make them so strong the win is implausible',
    kw: ['反派', '坏人', '对手', 'boss', 'villain', 'antagonist', 'scheming rival', 'nemesis'],
  },
  {
    id: 'crowd_witness', name: '围观见证放大', nameEn: 'Bystander-witness amplification',
    principle: '爽点需要见证者：围观者态度从轻视到震惊到追捧的集体反转，会成倍放大打脸快感', principleEn: 'Payoffs need witnesses: the crowd’s collective swing from disdain to shock to admiration multiplies the satisfaction',
    technique: '关键打脸安排在公开场合（同学会、宴会、会议、家族议事），设计 2-3 个有名字/立场的旁观者做“情绪解说”，打脸前让他们唱衰、打脸时给震惊反应、打脸后态度 180 度转变；避免每次都是同一批工具人', techniqueEn: 'Stage key slaps in public (reunion, banquet, meeting, family council), use 2–3 named bystanders as emotional commentators: dismissive before, shocked during, reversed after; avoid reusing the same faceless crowd every time',
    risk: '围观反应要具体、有层次，不能千篇一律“倒吸一口凉气”', riskEn: 'Crowd reactions must be specific and layered, not the same collective gasp every time',
    kw: ['围观', '见证', '震惊', '众人', 'bystander', 'crowd reaction', 'onlookers shocked', 'public reveal'],
  },
  {
    id: 'reversal_payoff', name: '羞辱者仰望兑现', nameEn: 'Humiliator-looks-up payoff',
    principle: '前期踩主角最狠的人，后期要亲眼见证并为当初的羞辱付出态度代价，形成情感闭环', principleEn: 'Whoever stepped on the hero hardest must later witness the rise and pay an attitude price, closing the emotional loop',
    technique: '建一张“羞辱账本”：谁、在什么场合、说了什么；主角翻身时按账本逐个回扣，让羞辱者在同一类场合亲口改观/道歉/求助；最重要的羞辱者放到中后段集中兑现', techniqueEn: 'Keep a humiliation ledger (who, where, what said); as the hero rises, callback each entry, making humiliators reverse/apologize/ask for help in a matching setting; save the biggest humiliator for a concentrated mid-late payoff',
    risk: '兑现要符合人物逻辑，不能为解气让所有人瞬间变脸、毫无代价', riskEn: 'Payoffs must fit character logic; not everyone flips instantly with zero cost just to satisfy',
    kw: ['仰望', '后悔', '改观', '高攀不起', 'regret', 'eat their words', 'look up to', 'former doubter'],
  },
  {
    id: 'revenge_boundary', name: '反击边界', nameEn: 'Counterattack within bounds',
    principle: '反击打脸要在法律与公序良俗内完成，主角可以狠但不能滥伤无辜、不能美化违法', principleEn: 'Counterattacks stay within law and public morality; the hero may be tough but must not harm the innocent or glorify illegality',
    technique: '让主角优先用合法手段反制（证据、合同、规则、舆论真相、让对方自食其果），私人惩戒止步于揭穿与切割；涉及暴力/商战情节时给出法律后果，不把违法手段当成正确答案', techniqueEn: 'Prefer lawful countermeasures (evidence, contracts, rules, public truth, letting opponents self-destruct), with personal payback limited to exposure and cutting ties; where violence or business warfare appears, show legal consequences rather than treating illegal moves as the answer',
    risk: '绝不能把违法报复、私刑、以暴制暴包装成“爽”；平台尺度红线前置', riskEn: 'Never frame illegal revenge, lynching or might-makes-right as satisfying; platform content limits take priority',
    kw: ['复仇', '反击', '讨回', 'revenge', 'payback', 'counterattack', 'justice', 'settle the score'],
  },
  {
    id: 'ep_cliff', name: '集尾强钩卡点', nameEn: 'End-of-episode cliff card',
    principle: '下沉爽剧靠集尾钩子拉留存：把“打脸前一秒/身份将揭未揭/更强敌人登场”卡在集尾', principleEn: 'Mass-market drama retains via end hooks: cut the episode one beat before the slap, at an almost-revealed identity, or as a stronger enemy appears',
    technique: '每集结尾设计一个“临门一脚”钩子：证据即将出示、门即将打开、身份即将说破、对方刚放狠话；下一集开头先快速兑现上集钩子再推进，形成连续追更动力', techniqueEn: 'End each episode on an about-to-happen card: evidence about to be shown, a door about to open, an identity about to be named, a rival’s threat just delivered; open the next episode by quickly cashing that hook before advancing, driving binge continuation',
    risk: '钩子不能只靠故弄玄虚，下集必须快速兑现，否则观众有被欺骗感', riskEn: 'Hooks can’t rely on empty teasing; the next episode must cash them fast or viewers feel cheated',
    kw: ['集尾', '卡点', '悬念', '下集', 'cliffhanger', 'end hook', 'to be continued', 'episode ending'],
  },
];
export const VALID_UNDERDOG_DEVICES = new Set(UNDERDOG_DEVICES.map((d) => d.id));
const BY_ID = new Map(UNDERDOG_DEVICES.map((d) => [d.id, d]));

const UNDERDOG_HINT = ['逆袭', '打脸', '战神', '赘婿', '龙王', '兵王', '神医', '扮猪吃虎', '马甲', '爽文', '爽剧', '复仇', '翻身', '大佬', '隐富', 'underdog', 'revenge', 'face-slap', 'face slap', 'hidden boss', 'son-in-law', 'comeback', 'power fantasy', 'rags to riches', 'hidden identity'];
export function detectUnderdog(text: string): boolean {
  const t = (text || '').toLowerCase();
  return UNDERDOG_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickUnderdogDevices(text: string, n = 3): UnderdogDevice[] {
  const t = (text || '').toLowerCase();
  const hit = UNDERDOG_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: UnderdogDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：压抑释放（爽感落差）+ 打脸阶梯（递进）+ 马甲分层（持续爽点），爽剧最普适骨架
  const fallback = ['suppress_release', 'face_slap_ladder', 'hidden_identity'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  UNDERDOG_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildUnderdogDirective(text: string, lang: UnderdogLang = 'zh', n = 3): string {
  if (!detectUnderdog(text)) return '';
  const ds = pickUnderdogDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a MASS-MARKET UNDERDOG / comeuppance power-fantasy story. Engineer the satisfaction deliberately. Use these devices this episode:\n${body}\nHard rules: press then release within 1–2 episodes (never three straight suppression episodes), villains stay smart and escalate, the hero’s power has a consistent source and limits, face-slaps are won through evidence/ability within law and public morality (never glorify illegal revenge or lynching), and end the episode on an about-to-happen cliff card that the next episode cashes quickly.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为下沉逆袭/打脸爽剧，爽感要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：压抑 1-2 集内必须见到释放、不连压三集以上；反派不降智且逐级加码；主角实力有可信来源与边界、规则前后一致；打脸靠证据和真本事、在法律与公序良俗内完成，绝不美化违法报复/私刑；每集结尾卡在“打脸前一秒/身份将揭”的强钩，下集开头快速兑现。`;
}
