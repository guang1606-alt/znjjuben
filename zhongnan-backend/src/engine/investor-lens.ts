/**
 * investor-lens.ts —— 资方选本视角评估（2026-09 一线短剧资方复盘沉淀）
 *
 * 核心认知（来自知识点“短剧资方看剧本，内容从来不在考量的前三位”）：
 *   对资方/出品方而言，剧本“内容好”是入场券、是及格线，却不是决定投不投钱的前三因素。
 *   真正排在前面的是：①赛道确定性（有没有被验证过、受众盘多大、平台缺不缺货）
 *                    ②成本与回收（成本量级、回款方式、盈亏平衡/投流ROI、回款周期）
 *                    ③可投流性（前3秒钩子、高能切片素材、付费卡点、标题封面抓手）
 *   内容达标只排第四（门槛项）：过线即可，不必追求文学性最好。
 *
 * 设计原则：纯本地确定性评估、零token边际成本，可作为免费只读诊断对外开放；
 *   只做文本可稳定识别的信号打分，难判定的交还给“资方必问清单”，不硬编结论。
 * 与既有模块边界：market-playbook 管“该走哪条赛道/海外怎么打”，decidePitch 管创作者视角立项分，
 *   本文件专管“出钱的人怎么看这个本、为什么内容好不代表能拿到钱”，互补不相悖。
 */

export type InvestorVerdict = 'STRONG' | 'TALK' | 'CAUTION' | 'PASS';
export interface InvestorDim {
  id: 'track' | 'recoup' | 'marketability' | 'content';
  name: string;
  rank: number;          // 资方心中的真实排序（1最高，内容排第4）
  weight: number;        // 权重，合计1
  score: number;         // 0-100
  hit: string[];         // 命中的正向信号
  risk: string[];        // 命中的风险信号
  advice: string;
}
export interface InvestorLensResult {
  premise: string;
  ranking: { rank: number; name: string; point: string }[];
  dimensions: InvestorDim[];
  overall: number;
  verdict: InvestorVerdict;
  verdictLabel: string;
  vetoes: string[];
  funderQuestions: string[];
  pitchTips: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const hitOf = (t: string, ws: string[]) => ws.filter((w) => t.includes(w));

/* 赛道确定性：被验证过的题材/明确受众盘/平台在收，比“原创度”更让资方安心 */
const TRACK_POS = ['对标', '同款', '爆款', '风口', '红利', '平台缺', '已验证', '验证过', '热门赛道', '赛道', '红果', '登顶', '榜单', '破亿', '充值', '受众盘', '女性向', '下沉', '霸总', '重生', '逆袭', '复仇', '甜宠', '马甲', '战神'];
const TRACK_NEG = ['冷门', '太小众', '小众实验', '没有对标', '无对标', '全新世界观', '前所未见', '没人拍过', '自嗨', '纯原创实验'];
/* 成本与回收：低成本可控 + 回款路径清晰 = 资方最爱；高成本大场面是头号否决项 */
const COST_LOW = ['封闭场景', '单场景', '室内', '少量演员', '两三个演员', '现代装', '无特效', '成本可控', '小成本', '棚拍', '场景集中', '服化道简单'];
const COST_HIGH = ['大场面', '战争场面', '古装大场面', '大量特效', '玄幻大场面', '群演', '实景拍摄', '海外取景', '动作戏多', '爆破', '灾难场面', '大量外景', '豪车', '航拍'];
const RECOUP = ['分账', '买断', '投流', 'ROI', '回本', '盈亏平衡', '回款', '保底', '付费点', '充值模型', 'IAP', 'IAA', '定制'];
/* 可投流性：能不能剪出高点击素材、前3秒留不留得住人、付费卡点硬不硬 */
const MARKET_POS = ['前3秒', '黄金三秒', '强钩子', '钩子', '反转', '打脸', '爽点', '付费卡点', '卡点', '高能切片', '切片素材', '标题', '封面', '留存', '追更', '情绪冲击', '名场面', '冲突前置'];
const MARKET_NEG = ['慢热', '铺垫长', '前三集平', '文艺片节奏', '没有冲突', '平铺直叙'];
/* 内容合格线（门槛，不是决胜） */
const CONTENT_BASE = ['人设', '逻辑', '台词', '节奏', '弧光', '闭环', '动机', '自洽', '人物关系'];
/* 一票否决：政策/尺度风险（与 mature-gating、合规审核同向） */
const POLICY_RISK = ['涉政', '血腥', '未成年恋爱', '未成年人性', '擦边', '软色情', '赌博教程', '毒品制作', '邪教', '民族宗教敏感', '真实案件未授权', '抹黑'];
/* v1.94 英文检测词（与中文一一对应，英文 idea/梗概也能跑出资方视角） */
const TRACK_POS_EN = ['benchmark', 'comparable', 'hit', 'trend', 'dividend', 'platform is short of', 'proven', 'validated', 'hot track', 'track', 'redfruit', 'top of chart', 'chart', 'hundred million', 'top-up', 'female audience', 'mass market', 'ceo romance', 'rebirth', 'underdog', 'revenge', 'sweet romance', 'hidden identity', 'war god'];
const TRACK_NEG_EN = ['obscure', 'too niche', 'niche experiment', 'no benchmark', 'brand-new worldview', 'never seen before', 'self-indulgent', 'pure experiment'];
const COST_LOW_EN = ['enclosed scene', 'single location', 'indoor', 'small cast', 'two or three actors', 'modern wardrobe', 'no vfx', 'cost-controlled', 'low budget', 'studio shoot', 'concentrated scenes', 'simple props'];
const COST_HIGH_EN = ['big set piece', 'war scene', 'period epic', 'heavy vfx', 'fantasy spectacle', 'extras', 'location shoot', 'overseas location', 'heavy action', 'explosion', 'disaster scene', 'many locations', 'luxury cars', 'aerial shoot'];
const RECOUP_EN = ['revenue share', 'buyout', 'paid traffic', 'roi', 'recoup', 'break-even', 'payback', 'guaranteed minimum', 'pay point', 'monetization', 'iap', 'iaa', 'commissioned'];
const MARKET_POS_EN = ['first 3 seconds', 'golden 3 seconds', 'strong hook', 'hook', 'reversal', 'face-slap', 'payoff', 'pay point', 'cutdown material', 'title', 'cover', 'retention', 'binge', 'emotional hit', 'set piece', 'conflict up front'];
const MARKET_NEG_EN = ['slow burn', 'long setup', 'flat first episodes', 'arthouse pacing', 'no conflict', 'flat narration'];
const CONTENT_BASE_EN = ['character', 'logic', 'dialogue', 'pacing', 'arc', 'closed loop', 'motivation', 'self-consistent', 'relationships'];
const POLICY_RISK_EN = ['political', 'gory', 'minor romance', 'minor sexual', 'borderline erotic', 'soft porn', 'gambling tutorial', 'drug making', 'cult', 'ethnic-religious sensitivity', 'unlicensed real case', 'smear'];

/** 资方一定会问的尖锐问题（立项/路演前先自问自答） */
export const FUNDER_QUESTIONS: string[] = [
  '这个题材最近三个月有没有跑出过对标爆款？数据是多少？我们凭什么比对标做得更好或更便宜？',
  '总成本多少、多少集、单集成本多少？按什么方式回款（平台分账/买断/自营投流）？多少流水能回本？',
  '投流ROI模型算过吗？首集/前3集留存靠什么？第几个卡点开始收钱？',
  '能不能剪出3-5条高点击的投流切片？最炸的15秒在哪一集哪一秒？标题封面用哪一帧？',
  '需要几个主要演员、几个场景？有没有可以砍掉的高成本外景/特效/群演？',
  '题材有没有政策、尺度、版权或真实案件授权风险？哪个平台能过审？',
  '主演/制作团队有没有成功案例？拍摄周期多少天、能不能压到最短？',
  '如果数据不及预期，有没有可复用的资产（场景/服化道/素材）摊薄下一部成本？',
];
/** v1.94 资方必问清单（英文版） */
const FUNDER_QUESTIONS_EN: string[] = [
  'Has a comparable hit run in this genre in the last three months, and what were its numbers? Why can we do it better or cheaper?',
  'Total cost, episode count, per-episode cost? How does it recoup (platform revenue share / buyout / self-run paid traffic) and at what GMV does it break even?',
  'Have you modeled the paid-traffic ROI? What holds ep-1 / first-3 retention, and at which pay point does money start?',
  'Can you cut 3-5 high-CTR traffic clips? Where (which episode, which second) is the most explosive 15s, and which frame is the title/cover?',
  'How many leads and locations? Which costly locations/VFX/extras can be cut?',
  'Any policy, content-rating, copyright or real-case licensing risk? Which platform will approve it?',
  'Do the cast/crew have past hits? How many shoot days, and can the schedule be compressed to the minimum?',
  'If data underperforms, what reusable assets (sets/wardrobe/material) amortize the next production?',
];

function dimScore(base: number, posHits: string[], negHits: string[], perPos: number, perNeg: number) {
  return clamp(base + posHits.length * perPos - negHits.length * perNeg);
}

export function investorLens(input: { text?: string; tags?: string[]; episodes?: number }, lang: 'zh' | 'en' = 'zh'): InvestorLensResult {
  const en = lang === 'en';
  const raw = `${input.text || ''} ${(input.tags || []).join(' ')}`;
  const t = en ? raw.toLowerCase() : raw;

  const trackPos = hitOf(t, en ? TRACK_POS_EN : TRACK_POS), trackNeg = hitOf(t, en ? TRACK_NEG_EN : TRACK_NEG);
  const costLow = hitOf(t, en ? COST_LOW_EN : COST_LOW), costHigh = hitOf(t, en ? COST_HIGH_EN : COST_HIGH), recoup = hitOf(t, en ? RECOUP_EN : RECOUP);
  const mktPos = hitOf(t, en ? MARKET_POS_EN : MARKET_POS), mktNeg = hitOf(t, en ? MARKET_NEG_EN : MARKET_NEG);
  const content = hitOf(t, en ? CONTENT_BASE_EN : CONTENT_BASE), policy = hitOf(t, en ? POLICY_RISK_EN : POLICY_RISK);

  // ① 赛道确定性
  const trackScore = dimScore(50, trackPos, trackNeg, 5, 12);
  // ② 成本与回收：低成本加分、高成本减分、有回款模型显著加分
  const recoupScore = clamp(52 + costLow.length * 6 - costHigh.length * 9 + recoup.length * 6);
  // ③ 可投流性
  const mktScore = dimScore(50, mktPos, mktNeg, 5, 12);
  // ④ 内容合格线（权重最低，达标即65+即可，不奖励“文学性堆砌”）
  const contentScore = clamp(58 + content.length * 5);

  const dimensions: InvestorDim[] = [
    {
      id: 'track', name: en ? 'Track certainty' : '赛道确定性', rank: 1, weight: 0.35, score: trackScore,
      hit: trackPos, risk: trackNeg,
      advice: trackNeg.length
        ? (en
          ? 'No benchmark / experimental genre is the funder’s top worry: supply a proven comparable with the same emotional structure (need not be the same genre), and state the audience pool and platform gap.'
          : '缺对标/偏实验题材是资方最大顾虑：补一个“同情绪结构”的已验证对标（不必同题材），说清受众盘与平台缺口。')
        : trackPos.length
          ? (en
            ? 'The track shows validation signals; in the pitch, state comparable data and differentiation in one line.'
            : '赛道有验证信号，路演时把对标数据和差异化一句话讲清。')
          : (en
            ? 'Proactively supply a comparable hit and audience data; don’t make the funder guess whether the genre works.'
            : '主动给出对标爆款与受众盘数据，别让资方自己去猜这个题材行不行。'),
    },
    {
      id: 'recoup', name: en ? 'Cost & recoupment' : '成本与回收', rank: 2, weight: 0.30, score: recoupScore,
      hit: [...costLow, ...recoup], risk: costHigh,
      advice: costHigh.length && costLow.length === 0
        ? (en
          ? 'Many high-cost elements with no offset: shift to enclosed/modern/small-cast scenes, state a revenue-share or paid-traffic recoup model, and show the break-even math.'
          : '高成本元素偏多且无对冲：尽量改成封闭/现代/少演员场景，并明确分账或投流回本模型，把盈亏平衡点算给资方看。')
        : recoup.length === 0
          ? (en
            ? 'Add the recoup route and break-even estimate (GMV to break even, which pay point charges); funders want a certain recovery path.'
            : '补上回款方式与回本测算（多少流水回本、第几卡点收费），资方要的是确定的回收路径。')
          : (en
            ? 'Cost is controlled with a recoup path; keep quantifying per-episode cost and payback cycle.'
            : '成本可控且有回款路径，继续把单集成本与回款周期量化。'),
    },
    {
      id: 'marketability', name: en ? 'Paid-traffic marketability' : '可投流性', rank: 3, weight: 0.25, score: mktScore,
      hit: mktPos, risk: mktNeg,
      advice: mktNeg.length || mktPos.length === 0
        ? (en
          ? 'Traffic clips decide life or death: front-load the strongest conflict into the first 3s, mark 3-5 high-energy cut points, pay points, and title/cover hooks.'
          : '资方靠投流素材决定生死：把最强冲突前置到前3秒，明确3-5条高能切片点位、付费卡点与标题封面抓手。')
        : (en
          ? 'Traffic hooks exist; mark the most explosive 15s cut and the first pay point.'
          : '具备投流抓手，标出最炸的15秒切片与首个付费卡点位置。'),
    },
    {
      id: 'content', name: en ? 'Content bar (threshold)' : '内容合格线（门槛）', rank: 4, weight: 0.10, score: contentScore,
      hit: content, risk: [],
      advice: en
        ? 'Content is the entry ticket: keep character/logic/dialogue/pacing above the bar, don’t inflate cost and schedule chasing “the best script”; spend resources on the top three.'
        : '内容达标是入场券：人设/逻辑/台词/节奏过线即可，不必为追求“最好的剧本”堆高成本与周期，资源优先投给前三项。',
    },
  ];

  const overall = clamp(dimensions.reduce((s, d) => s + d.score * d.weight, 0));

  // 一票否决（硬风险，直接拉响，不被高分掩盖）
  const vetoes: string[] = [];
  if (policy.length) vetoes.push(en
    ? `Policy/content-rating risk (${policy.slice(0, 4).join(', ')}) may block approval; funders usually veto outright — do compliance and platform adaptation first.`
    : `存在政策/尺度风险点（${policy.slice(0, 4).join('、')}），可能无法过审，资方通常一票否决，需先做合规与平台适配。`);
  if (costHigh.length >= 3 && recoup.length === 0) vetoes.push(en
    ? `≥3 high-cost elements (${costHigh.slice(0, 4).join(', ')}) with no clear recoup model — recovery risk too high, funders likely pass.`
    : `高成本元素≥3处（${costHigh.slice(0, 4).join('、')}）却没有明确回款模型，回收风险过高，资方大概率直接放弃。`);
  if (trackNeg.length >= 2 && trackPos.length === 0) vetoes.push(en
    ? 'No benchmark and self-indulgent/experimental; funders cannot size the market — find a same-emotion comparable first.'
    : '无对标且偏自嗨/实验，资方无法估算市场盘子，建议先找同情绪结构对标再谈。');

  let verdict: InvestorVerdict;
  if (vetoes.length) verdict = 'PASS';
  else if (overall >= 75) verdict = 'STRONG';
  else if (overall >= 62) verdict = 'TALK';
  else verdict = 'CAUTION';
  const verdictLabel = en
    ? { STRONG: 'Strong funder interest: push actively', TALK: 'Worth a talk: fix gaps then push', CAUTION: 'Caution: build certainty first', PASS: 'Do not push yet: hard veto present' }[verdict]
    : { STRONG: '资方意愿强：可主动推', TALK: '值得谈：补短板后推', CAUTION: '谨慎：先补确定性再推', PASS: '暂不建议推：存在硬否决' }[verdict];

  const ranking = dimensions.map((d) => ({
    rank: d.rank, name: d.name,
    point: d.rank === 4
      ? (en ? 'Threshold / entry ticket, just clear the bar, not the decider' : '及格线/入场券，过线即可，非决胜项')
      : (en ? 'Decisive item, assessed first by funders' : '决胜项，资方优先评估'),
  }));

  // 可执行的“让本子显得好回收”的建议（按当前短板取前几条）
  const pitchTips: string[] = [];
  dimensions.forEach((d) => { if (d.score < 70) pitchTips.push(en ? `[${d.name}] ${d.advice}` : `【${d.name}】${d.advice}`); });
  if (!recoup.length) pitchTips.push(en ? 'Prepare a one-pager: cost/episodes/per-episode cost/recoup route/break-even GMV — funders only trust numbers.' : '准备一页纸：成本/集数/单集成本/回款方式/回本流水测算，资方只认数字。');
  if (!mktPos.some((w) => ['高能切片', '切片素材', '名场面', 'set piece', 'cutdown material'].includes(w))) pitchTips.push(en ? 'Cut (or mark in the script) the “most explosive 15s” set piece as traffic material and negotiation leverage.' : '提前剪出或在剧本里标注“最炸15秒”名场面，作为投流素材与谈判筹码。');
  if (!pitchTips.length) pitchTips.push(en ? 'All four dimensions are solid; focus the pitch on comparable data, break-even math and traffic material.' : '四项均较扎实，路演重点放在对标数据、回本测算与投流素材三件事上。');

  return {
    premise: en
      ? 'For a funder, content quality is only the entry ticket; the top three are track certainty, cost & recoupment, and paid-traffic marketability, with content merely fourth. Do the homework on the first three and the script becomes valuable, sellable and fundable.'
      : '资方选本，内容好坏只是入场券；真正排前三的是赛道确定性、成本与回收、可投流性，内容达标仅排第四。把功课做在前三件事上，剧本才“值钱、好卖、敢投”。',
    ranking, dimensions, overall, verdict, verdictLabel, vetoes,
    funderQuestions: en ? FUNDER_QUESTIONS_EN : FUNDER_QUESTIONS, pitchTips,
  };
}

/** 一句话资方结论（供小南/报告直接引用）；v1.94 支持英文 */
export function investorOneLiner(r: InvestorLensResult, lang: 'zh' | 'en' = 'zh'): string {
  const en = lang === 'en';
  return en
    ? `Investor lens ${r.overall} (track ${r.dimensions[0].score}/recoup ${r.dimensions[1].score}/traffic ${r.dimensions[2].score}/content bar ${r.dimensions[3].score}): ${r.verdictLabel}${r.vetoes.length ? `; ${r.vetoes.length} hard veto(es) to resolve first` : ''}.`
    : `资方视角综合 ${r.overall} 分（赛道${r.dimensions[0].score}/回收${r.dimensions[1].score}/投流${r.dimensions[2].score}/内容门槛${r.dimensions[3].score}）：${r.verdictLabel}${r.vetoes.length ? `；硬否决 ${r.vetoes.length} 条需先解决` : ''}。`;
}
