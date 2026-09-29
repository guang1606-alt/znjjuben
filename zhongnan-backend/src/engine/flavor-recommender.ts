/**
 * 叙事风味智能推荐（v2.04）
 * ------------------------------------------------------------------
 * 把已选题材标签 / 一句话梗概，映射到 v2.01-v2.03 建好的四类风味轴：
 *   microFlavors(微钩6) / payoffFlavors(爽点5) / reversalFlavors(反转4) / emotionFlavors(情绪5)
 * 纯函数、确定性、可离线对拍；中英双语理由；无命中给通用均衡组合，永远返回可用方案。
 * 与既有模块分工：hook-system/beat-system 负责“怎么排布”，本模块只负责“按题材推荐选什么风味”。
 */
import type { HookFlavor } from './hook-system';
import type { PayoffFlavor, ReversalFlavor, EmotionFlavor } from './beat-system';

export type FlavorLocale = 'zh' | 'en';
export interface FlavorProfile {
  microFlavors: HookFlavor[];
  payoffFlavors: PayoffFlavor[];
  reversalFlavors: ReversalFlavor[];
  emotionFlavors: EmotionFlavor[];
  matched: string[];                 // 命中的规则名（内部可追溯）
  reasons: { zh: string; en: string }[]; // 面向用户的推荐理由（去重）
}
interface Rule {
  name: string;
  kw: string[];                       // 小写关键词，中文直接子串、英文小写子串
  micro?: HookFlavor[]; payoff?: PayoffFlavor[]; reversal?: ReversalFlavor[]; emotion?: EmotionFlavor[];
  zh: string; en: string;
}
// 规则顺序即优先级（更具体的题材放前面）；同一轴可被多规则加权
const RULES: Rule[] = [
  { name: 'revenge', kw: ['复仇', '虐渣', 'revenge', 'vengeance'], micro: ['gap', 'line'], payoff: ['truth_justice', 'face_slap'], reversal: ['truth_cause'], emotion: ['press_release', 'tear_angst'], zh: '复仇线要“憋—查—爆”，多用信息差与潜台词，真相揭穿+打脸即时兑现，情绪先压后放、可带破防。', en: 'A revenge arc needs press-investigate-detonate: lean on info-gap and subtext, cash out with truth/face-slap, suppress then release (a touch of angst).' },
  { name: 'sweet', kw: ['甜宠', '先婚后爱', '双向奔赴', '高甜', '撒糖', '甜', 'sweet', 'romance', 'fluff'], micro: ['line', 'emotion'], payoff: ['sweet_warm'], reversal: [], emotion: ['tender_heal'], zh: '甜宠/爱情重潜台词与情绪微钩，爽点走双向奔赴的甜暖回应，情绪以温情回甘为主。', en: 'Sweet romance leans on line/emotion micro hooks, mutual-devotion payoffs and tender, healing emotion.' },
  { name: 'angst', kw: ['虐恋', '虐心', '生离死别', '爱而不得', '误会错过', 'angst', 'tragic', 'star-crossed'], micro: ['emotion', 'line'], payoff: [], reversal: ['relation_turn'], emotion: ['tear_angst'], zh: '虐心题材以破防泪点为情绪主轴，靠情绪/语言微钩蓄力，关系立场反转制造错过。', en: 'Angst centers tearjerker emotion, charges with emotion/line hooks, and uses relationship turns to create missed chances.' },
  { name: 'mystery', kw: ['悬疑', '刑侦', '推理', '密室', '怪谈', '探案', '烧脑', '高能反转', 'mystery', 'crime', 'detective', 'thriller', 'suspense'], micro: ['atmos', 'gap', 'foreshadow'], payoff: ['truth_justice'], reversal: ['truth_cause', 'cognition_overturn'], emotion: ['suspense_tug'], zh: '悬疑烧脑靠氛围/信息差/伏笔微钩勾人，主反转走真相因果与认知颠覆，情绪保持揪心悬念。', en: 'Mystery drives on atmosphere/info-gap/foreshadow hooks, truth-cause and cognitive reversals, with tugging suspense.' },
  { name: 'underdog', kw: ['逆袭', '打脸', '赘婿', '战神', '扮猪吃虎', '废柴', '翻身', 'underdog', 'face-slap', 'face slap', 'comeback', 'hidden master'], micro: ['action', 'line'], payoff: ['face_slap', 'status_crush'], reversal: ['identity_shift'], emotion: ['press_release'], zh: '逆袭打脸要动作+语言微钩，爽点密集给打脸现报与身份实力压制，配身份/强弱反转、压抑后释放。', en: 'Underdog face-slap uses action/line hooks, face-slap and status-dominance payoffs, identity/power reversal, suppress-to-release.' },
  { name: 'comedy', kw: ['喜剧', '搞笑', '沙雕', '无厘头', '轻喜', '情景', '社死', 'comedy', 'funny', 'sitcom', 'parody'], micro: ['line', 'action'], payoff: ['comeback'], reversal: [], emotion: ['press_release'], zh: '喜剧靠语言与动作微钩制造包袱，爽点走愿望代偿式出气，节奏轻快、即时释放。', en: 'Comedy lands jokes via line/action hooks, wish-fulfillment payoffs, light pacing with instant release.' },
  { name: 'family', kw: ['家庭', '亲情', '婆媳', '亲子', '翁婿', '妯娌', 'family', 'kinship', 'domestic'], micro: ['emotion', 'atmos'], payoff: ['truth_justice'], reversal: [], emotion: ['tear_angst', 'tender_heal'], zh: '家庭亲情重情绪与生活氛围微钩，真相归位化解矛盾，泪点与温情回甘交替。', en: 'Family drama uses emotion/atmosphere hooks, truth-restoring payoffs, alternating tears and warm aftertaste.' },
  { name: 'workplace', kw: ['职场', '行业', '商战', '律政', '金融', '医疗职场', '大厂', 'workplace', 'career', 'business war', 'corporate'], micro: ['line', 'action'], payoff: ['comeback', 'status_crush'], reversal: ['relation_turn'], emotion: ['press_release'], zh: '职场/行业剧靠台词交锋与动作推进，翻盘+实力压制给爽感，用关系立场反转制造站队博弈。', en: 'Workplace drama uses verbal sparring/action, comeback and skill-dominance payoffs, stance-turn reversals for office politics.' },
  { name: 'hype', kw: ['高燃', '热血', '军旅', '特种兵', '消防', '励志', '家国', 'hot-blood', 'hype', 'inspirational', 'military', 'rescue'], micro: ['action'], payoff: ['status_crush'], reversal: ['identity_shift'], emotion: ['hype_burn'], zh: '高燃热血题材以动作微钩为主，实力压制给爽，情绪推到高燃点，可配身份反转。', en: 'Hot-blooded stories use action hooks, skill-dominance payoffs, hype-peak emotion and optional identity reversal.' },
  { name: 'transmigrate', kw: ['穿越', '穿书', '重生', '快穿', '系统', '金手指', '魂穿', 'rebirth', 'transmigration', 'isekai', 'system', 'time loop'], micro: ['foreshadow', 'gap'], payoff: ['status_crush'], reversal: ['cognition_overturn', 'identity_shift'], emotion: [], zh: '穿越/重生/系统流靠伏笔与信息差（读者知角色不知）制造优势，认知颠覆+身份反转，金手指资源改变格局。', en: 'Rebirth/isekai/system uses foreshadow and dramatic irony, cognitive/identity reversals, and resource windfalls that shift power.' },
  { name: 'travel', kw: ['文旅', '非遗', '美食', '风光', '古镇', '乡土', 'travel', 'heritage', 'food', 'road trip', 'culture'], micro: ['atmos', 'emotion'], payoff: [], reversal: [], emotion: ['tender_heal'], zh: '文旅/非遗/美食题材以氛围感官与情绪微钩呈现在地烟火，情绪走治愈回甘。', en: 'Travel/heritage/food stories foreground sensory atmosphere and emotion hooks with a healing, warm tone.' },
  { name: 'meta', kw: ['戏中戏', '剧中剧', '元叙事', '套层', '嵌套', '排练', '片场', '第四面墙', 'metafiction', 'story within', 'play within', 'show-within', 'nested', 'rehearsal', 'on set', 'fourth wall'], micro: ['gap', 'foreshadow', 'atmos'], payoff: ['truth_justice'], reversal: ['cognition_overturn', 'truth_cause'], emotion: ['suspense_tug'], zh: '戏中戏/元叙事靠信息差与伏笔微钩让观众“看穿套层”，主反转走认知颠覆与真相归位，情绪保持“两层何时撞破”的揪心悬念。', en: 'Metafiction uses info-gap/foreshadow hooks so the audience sees through the nested layers; the main turn is a cognitive/truth reversal and emotion stays on the suspense of when the two layers collide.' },
  { name: 'fantasy', kw: ['玄幻', '仙侠', '修仙', '科幻', '末世', '星际', '机甲', '奇幻', 'fantasy', 'xianxia', 'sci-fi', 'scifi', 'apocalypse'], micro: ['action', 'atmos'], payoff: ['status_crush'], reversal: ['cognition_overturn'], emotion: ['hype_burn'], zh: '玄幻/科幻以动作与宏大氛围微钩立世界观，认知颠覆反转设定，高燃推进升级。', en: 'Fantasy/sci-fi builds world via action/atmosphere hooks, cognitive world-view reversals and hype progression.' },
];
const FALLBACK: { micro: HookFlavor[]; payoff: PayoffFlavor[]; reversal: ReversalFlavor[]; emotion: EmotionFlavor[]; zh: string; en: string } = {
  micro: ['line', 'atmos'], payoff: ['face_slap', 'comeback'], reversal: ['identity_shift'], emotion: ['press_release'],
  zh: '题材特征不明显，先用“语言+氛围微钩、打脸+翻盘爽点、身份反转、压抑后释放”的均衡组合，可再手动微调。',
  en: 'No strong genre signal — start from a balanced mix (line+atmosphere hooks, face-slap+comeback payoffs, identity reversal, suppress→release) and fine-tune manually.',
};
const CAP = { micro: 3, payoff: 3, reversal: 2, emotion: 2 } as const;

function rank<T extends string>(score: Map<T, number>, cap: number): T[] {
  return [...score.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).slice(0, cap).map(([k]) => k);
}

export function recommendFlavorProfile(input: { tags?: string[]; brief?: string; locale?: FlavorLocale } = {}): FlavorProfile {
  const hay = [...(input.tags ?? []), input.brief ?? ''].join(' ').toLowerCase();
  const micro = new Map<HookFlavor, number>(); const payoff = new Map<PayoffFlavor, number>();
  const reversal = new Map<ReversalFlavor, number>(); const emotion = new Map<EmotionFlavor, number>();
  const matched: string[] = []; const reasons: { zh: string; en: string }[] = [];
  const add = <T extends string>(m: Map<T, number>, items: T[] | undefined, weight: number) => { (items ?? []).forEach((x) => m.set(x, (m.get(x) ?? 0) + weight)); };
  RULES.forEach((r, idx) => {
    const hit = r.kw.some((k) => hay.includes(k.toLowerCase()));
    if (!hit) return;
    matched.push(r.name);
    const weight = RULES.length - idx; // 更靠前（更具体）的规则权重更高
    add(micro, r.micro, weight); add(payoff, r.payoff, weight); add(reversal, r.reversal, weight); add(emotion, r.emotion, weight);
    if (!reasons.some((x) => x.zh === r.zh)) reasons.push({ zh: r.zh, en: r.en });
  });
  let profile: FlavorProfile;
  if (!matched.length) {
    profile = {
      microFlavors: FALLBACK.micro, payoffFlavors: FALLBACK.payoff, reversalFlavors: FALLBACK.reversal, emotionFlavors: FALLBACK.emotion,
      matched: [], reasons: [{ zh: FALLBACK.zh, en: FALLBACK.en }],
    };
  } else {
    profile = {
      microFlavors: rank(micro, CAP.micro), payoffFlavors: rank(payoff, CAP.payoff),
      reversalFlavors: rank(reversal, CAP.reversal), emotionFlavors: rank(emotion, CAP.emotion),
      matched, reasons,
    };
    // 某轴无任何规则命中时补一个安全缺省，保证四轴都有可执行建议
    if (!profile.microFlavors.length) profile.microFlavors = ['line'];
    if (!profile.payoffFlavors.length) profile.payoffFlavors = ['comeback'];
    if (!profile.reversalFlavors.length) profile.reversalFlavors = ['identity_shift'];
    if (!profile.emotionFlavors.length) profile.emotionFlavors = ['press_release'];
  }
  return profile;
}
