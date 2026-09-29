/**
 * 女性群像 / 女性互助机制引擎（v2.26）
 * ------------------------------------------------------------------
 * 第二十套类型引擎。AI 写女性题材通病：女主独角戏其余女性工具化、
 * 女性之间只会雌竞抢男人、困境全靠坏男人/恋爱解决、人物脸谱化（女强人/傻白甜）、
 * 贩卖容貌年龄焦虑、靠踩男性捧女性、事业线悬浮。本模块 10 装置，非该类型返回空串。纯函数、双语。
 */
export type SisLang = 'zh' | 'en';
export interface SisDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const SISTERHOOD_DEVICES: SisDevice[] = [
  {
    id: 'ensemble_balance', name: '群像戏份均衡有弧光', nameEn: 'A balanced ensemble with arcs',
    principle: '女性群像不是女主加背景板：每个主要女性都要有独立的目标、困境与成长线，戏份有分工、弧光不撞车，群像才立得住', principleEn: 'An ensemble is not a lead plus wallpaper: each major woman needs her own goal, obstacle and growth arc, with divided screen time and non-overlapping arcs',
    technique: '为 3-5 位核心女性各写一张“欲望-困境-转变”卡，标注每人的高光集与转变节点，轮流做单元主角；避免两人承担同一种功能（如两个都是“恋爱脑闺蜜”），用一场群戏让每人用不同方式应对同一件事，立住差异', techniqueEn: 'Give 3-5 core women a want-obstacle-change card, mark each one’s spotlight episode, rotate the unit lead, avoid duplicated functions (two “romance-obsessed best friends”), and use a group scene where each handles the same event differently to establish contrast',
    risk: '核心女性控制在 3-5 人，过多人物会摊薄每条线', riskEn: 'Keep core women to 3-5 or every line thins out',
    kw: ['女性群像', '姐妹团', '闺蜜', '女性互助', '群像', '她题材', 'women ensemble', 'female friendship', 'sisterhood', 'group of women', 'women supporting women'],
  },
  {
    id: 'distinct_voice', name: '各有欲望与说话方式', nameEn: 'Distinct desires and distinct voices',
    principle: '区分女性不能只靠发型和职业：她们的底层欲望、价值观、说话方式必须不同，观众蒙住名字也知道是谁在说话', principleEn: 'Women are not distinguished by hairstyle or job alone: their core wants, values and speech must differ so lines are recognizable with names hidden',
    technique: '给每人定一个“人生排序”（事业/家庭/自由/安全谁优先）与语言习惯（锋利/圆融/沉默/俏皮），写对话时做“换头测试”——把这句台词安到另一人身上若不违和就重写；让价值观差异成为女性之间真实分歧的来源', techniqueEn: 'Set each one’s life priority (career, family, freedom, security) and speech register (sharp, diplomatic, quiet, witty); run a head-swap test—reassign a line and rewrite if it still fits; let value differences drive genuine disagreement among the women',
    risk: '差异不等于刻板标签，避免“东北姑娘必泼辣”这类套路', riskEn: 'Difference is not a stereotype; avoid formulas like “the northern girl must be fierce”',
    kw: ['人物差异', '价值观', '说话方式', '女性角色', 'voice', 'distinct character', 'personality', 'values clash'],
  },
  {
    id: 'solidarity_earned', name: '互助关系分台阶建立', nameEn: 'Solidarity earned in steps',
    principle: '女性互助不能一上来就是“girls help girls”口号：她们可能有误会、竞争、立场差异，联盟是在共同经历中一步步建立的，才可信动人', principleEn: 'Solidarity is not an opening slogan: women may misunderstand, compete and differ, and their alliance is built step by step through shared experience',
    technique: '设计一条关系升温曲线：初见的偏见/利益冲突→一次被迫合作发现对方难处→关键节点互相托底→主动结盟；中间安排一次因立场不同的裂痕，再靠理解修复，互助最终落在具体行动（借钱、作证、顶班、带孩子）而非口号', techniqueEn: 'Chart a warming curve: initial bias or clash, forced cooperation revealing each other’s hardship, backing each other at a key moment, active alliance; insert an ideological rift repaired through understanding, and express help through concrete acts (a loan, testimony, covering a shift, childcare) rather than slogans',
    risk: '和解要靠事件推动，不能上一秒针锋相对下一秒情同姐妹', riskEn: 'Reconciliation needs events; enemies-one-beat, sisters-the-next feels fake',
    kw: ['互助', '结盟', 'girls help girls', '女性友谊', '托底', 'support each other', 'female solidarity', 'alliance', 'have each other’s back'],
  },
  {
    id: 'structural_barrier', name: '困境来自结构与处境', nameEn: 'Barriers rooted in structure and situation',
    principle: '女性面临的困境更多来自结构性处境（职场天花板、生育成本、家庭分工、偏见、年龄），把“具体的墙”写清楚，比塑造一个单纯坏男人更真实也更有力量', principleEn: 'Female obstacles are often structural—the glass ceiling, the cost of motherhood, unequal household labor, bias, age; naming the concrete wall is truer and stronger than a single evil man',
    technique: '为每个困境写出“制度/观念/现实成本”三层来源（晋升失败不仅因某人使坏，还有岗位编制、生育顾虑、她自己的自我怀疑）；反派可以是人，但让他成为结构的一个切面而非唯一原因；主角的破局靠能力、联盟与规则并用', techniqueEn: 'Give each obstacle three layers—institution, mindset, real cost (a denied promotion involves headcount, motherhood assumptions and self-doubt); a human antagonist may embody the structure but is not its sole cause; the lead breaks through with competence, alliance and rules combined',
    risk: '现实议题查证准确，不传播错误法律/职场常识', riskEn: 'Verify real-world issues; never spread wrong legal or workplace claims',
    kw: ['职场歧视', '性别偏见', '生育', '家庭分工', '天花板', '困境', 'gender bias', 'glass ceiling', 'motherhood penalty', 'structural barrier'],
  },
  {
    id: 'career_craft', name: '事业线专业可信', nameEn: 'A credible professional line',
    principle: '女性的成长不能只在情场：事业/手艺/学业线要有真实的行业细节与能力进阶，观众要看到她“凭什么赢”，而不是靠男主或贵人空降', principleEn: 'Growth is not only romantic: the career, craft or study line needs real industry detail and skill progression so the audience sees why she wins—not a male lead or savior dropping in',
    technique: '为女主选一个具体行当并做行业功课（岗位链条、专业术语、真实难点、晋升路径），安排 2-3 次“靠专业能力解决问题”的高光，胜利前先呈现她为此付出的学习与代价；感情线与事业线交织但不互相替代', techniqueEn: 'Pick a concrete trade and do industry homework (career ladder, terms, real difficulties, promotion path), stage 2-3 competence highlights, show the learning and cost before victory, and interweave romance and career without substituting one for the other',
    risk: '行业细节宁少勿错，避免“总裁/顶流”式悬浮职业', riskEn: 'Fewer but correct industry details; avoid floating CEO/superstar jobs',
    kw: ['事业', '职场', '创业', '专业能力', '女老板', '职业女性', 'career woman', 'professional', 'startup', 'women at work'],
  },
  {
    id: 'bond_beyond_romance', name: '关系不止爱情', nameEn: 'Bonds beyond romance',
    principle: '女性的情感世界是多维的：姐妹、母女、师徒、对手、与自己的关系同样重要，把非爱情关系写出深度，人物才不被爱情定义', principleEn: 'A woman’s emotional world is multidimensional: friendship, mother-daughter, mentor, rival and self-relationship carry equal depth so she is not defined by romance',
    technique: '除感情线外至少经营一条重头非爱情关系（与母亲和解、与女导师传承、与对手惺惺相惜），给它独立的场景与转折；让结局的情感满足不只来自“和谁在一起”，也来自这些关系的圆满', techniqueEn: 'Besides romance, build at least one major non-romantic bond (reconciliation with her mother, a female mentor lineage, respect with a rival) with its own scenes and turns, and let final emotional payoff come partly from these bonds, not only a partner',
    risk: '母亲/长辈同样避免脸谱化，不复制“恶婆婆/控制狂母亲”套路', riskEn: 'Avoid flat mothers or elders; skip the evil-mother-in-law cliché',
    kw: ['母女', '师徒', '女性友谊', '与自己和解', 'mother daughter', 'female mentor', 'female bond', 'self reconciliation'],
  },
  {
    id: 'non_zero_sum', name: '女性之间不是零和', nameEn: 'Women beyond zero-sum rivalry',
    principle: '默认“两个女人必争一个男人/一个位置”是最大的偷懒：可以有竞争，但好故事让她们发现彼此不是敌人，她人的成功不等于“我”的失败', principleEn: 'Defaulting to two women fighting over a man or a slot is lazy writing; rivalry is allowed, but a strong story reveals they are not enemies—another woman’s win is not the lead’s loss',
    technique: '若设置女性对手，给她合理立场与闪光点，安排一次“零和陷阱”（被挑唆、被规则逼着互斥），再让她们识破真正的问题并选择不互相消耗；需要反派女性时，其恶意要有成因与代价，不把恶归因于“她是女人”', techniqueEn: 'Give any female rival a sound position and strengths, stage a zero-sum trap (provocation, rules forcing mutual exclusion), then have them see the real problem and refuse to drain each other; a female villain’s malice needs causes and consequences, never “because she is a woman”',
    risk: '不回避真实矛盾，但不把内耗当女性本性', riskEn: 'Don’t avoid real conflict, but never treat infighting as female nature',
    kw: ['雌竞', '竞争', '零和', '女性对手', 'rival woman', 'competition', 'zero sum', 'catfight stereotype'],
  },
  {
    id: 'romance_optional', name: '爱情是选项不是唯一答案', nameEn: 'Romance as a choice, not the only answer',
    principle: '好的女性叙事里，爱情是人生的一个选项而非成功的唯一证明：结局可以恋爱、单身、复合、独自美丽，关键是选择出自人物本人且自洽', principleEn: 'In strong women’s stories romance is one option, not the sole proof of success: endings may be partnered, single, reconciled or happily independent—provided the choice is the character’s own and coherent',
    technique: '写感情线时同步推进她的个人目标，让“选不选这段关系”与“我要成为谁”对齐；避免用结婚/被求婚作为大团圆唯一标志，可为不同女性安排不同形态的幸福（事业、友情、亲情、自洽），尊重多元选择', techniqueEn: 'Advance her personal goal alongside romance so choosing the relationship aligns with who she wants to become; avoid marriage or a proposal as the sole happy ending, and give different women different forms of fulfillment—career, friendship, family, self-peace',
    risk: '不为“独立”而强行否定一切感情，避免另一种政治正确的刻板', riskEn: 'Don’t reject all romance to signal independence—that is its own stereotype',
    kw: ['独立', '单身', '爱情选择', '大女主', '不婚', 'independent woman', 'single and happy', 'female lead', 'relationship choice'],
  },
  {
    id: 'body_age_kindness', name: '身体与年龄友好', nameEn: 'Kindness toward body and age',
    principle: '不把容貌、身材、年龄、婚育状态当成女性的价签或焦虑开关：中年可以有魅力与欲望，普通长相可以有光芒，审美多元本身就是力量', principleEn: 'Looks, body, age and marital status are not price tags or anxiety switches: middle age has desire and charm, ordinary looks radiate, and diverse beauty is itself strength',
    technique: '用具体魅力替代外貌评判（能力、幽默、气场、温柔的力量），让年龄成为经验与资源而非倒计时；若呈现容貌焦虑，要让人物最终与自己和解而非靠“变美打脸”；不出现体重羞辱、年龄羞辱的“爽”', techniqueEn: 'Replace appearance judgments with concrete appeal (competence, humor, presence, gentle strength) and make age experience and resource rather than a countdown; if body anxiety appears, resolve through self-reconciliation rather than a glow-up revenge, and never play body- or age-shaming for triumph',
    risk: '也不反向制造“美貌原罪”，对各类外形一视同仁', riskEn: 'Nor treat beauty as guilt; treat all appearances even-handedly',
    kw: ['年龄焦虑', '容貌焦虑', '身材', '中年女性', '悦纳自己', 'body positivity', 'age is not a deadline', 'middle aged woman', 'self acceptance'],
  },
  {
    id: 'hardship_agency', name: '困境真实但保有力量', nameEn: 'Real hardship with agency',
    principle: '女性题材可以写苦难（家暴、出轨、职场打压、生育之痛），但不消费苦难、不渲染猎奇：落点永远是人物的主体性——她如何认知、反抗、求助、重建', principleEn: 'Women’s stories may face hardship—domestic abuse, betrayal, workplace suppression, the pain of childbirth—but never consume or sensationalize it; the landing is always agency: how she recognizes, resists, seeks help and rebuilds',
    technique: '写伤痛前先想“这一集她主动做了什么”，让每个受难点都伴随一次主体性动作（取证、求助、离开、反击、设立边界）；涉及家暴/性侵等只呈现必要程度、不拍猎奇细节，并给出真实合法的求助路径与支持系统，结局的疗愈来自她重新掌握生活', techniqueEn: 'Before a hardship beat ask what she actively does, pairing each with an agentic move (gathering evidence, seeking lawful help, leaving, pushing back, setting boundaries); show abuse or assault only as needed, never sensationally, provide real lawful help routes and support, and let healing come from regaining control of her life',
    risk: '涉及违法侵害只导向合法解决，不提供以暴制暴的错误示范，不二次伤害式呈现', riskEn: 'Unlawful harm is resolved only lawfully—no vigilante modeling, no re-traumatizing depiction',
    kw: ['家暴', '出轨', '女性困境', '反击', '重建', '主体性', 'domestic abuse', 'betrayal', 'rebuild life', 'agency', 'seek help'],
  },
];

export const VALID_SIS_DEVICES = new Set(SISTERHOOD_DEVICES.map((d) => d.id));
const BY_ID = new Map(SISTERHOOD_DEVICES.map((d) => [d.id, d]));

const SIS_HINT = ['女性群像', '女性互助', '姐妹', '闺蜜', '她题材', '大女主群像', 'girls help girls', '女性友谊', 'women ensemble', 'female friendship', 'sisterhood', 'women supporting women', 'female solidarity', 'girl group drama'];
export function detectSisterhood(text: string): boolean {
  const t = (text || '').toLowerCase();
  return SIS_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickSisterhoodDevices(text: string, n = 3): SisDevice[] {
  const t = (text || '').toLowerCase();
  const hit = SISTERHOOD_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: SisDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：群像均衡（地基）+ 互助台阶（类型魂）+ 困境主体性（价值落点）
  const fallback = ['ensemble_balance', 'solidarity_earned', 'hardship_agency'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  SISTERHOOD_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildSisterhoodDirective(text: string, lang: SisLang = 'zh', n = 3): string {
  if (!detectSisterhood(text)) return '';
  const ds = pickSisterhoodDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a WOMEN’S ENSEMBLE / SISTERHOOD drama. Write women as full people and solidarity as earned. Use these devices this episode:\n${body}\nHard rules: every major woman gets her own goal, voice and arc (no background best friends), build alliance in steps through events rather than slogans, root obstacles in concrete structure and situation with verified facts rather than one cartoon villain, make career lines credible, value bonds beyond romance, reject default catfight/zero-sum rivalry and body-or-age shaming, never glorify or sensationalize abuse and steer all unlawful harm only to lawful help routes, and let romance be a choice rather than the only happy ending. Do not put men down to lift women up—write people.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为女性群像/女性互助题材，把女性写成完整的人，把互助写成挣来的。本集重点使用以下装置：\n${body}\n硬性要求：每位主要女性都有独立目标、说话方式与成长弧，不做背景板闺蜜；姐妹联盟靠事件分台阶建立、不喊口号；困境写清制度/观念/现实成本且事实查证，不靠一个纸片坏男人；事业线专业可信、非爱情关系（母女/师徒/对手）写出深度；拒绝默认雌竞零和、拒绝容貌年龄羞辱；家暴出轨等只呈现必要程度、不猎奇不二次伤害，只导向合法求助与重建；爱情是选项不是唯一圆满；不靠踩男性捧女性，写“人”而非写“性别标签”。`;
}
