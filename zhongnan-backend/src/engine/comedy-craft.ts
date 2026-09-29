/**
 * 喜剧机制级创作引擎（v2.06）
 * ------------------------------------------------------------------
 * 用户多次要求“喜剧大类深挖”。光有“喜剧/搞笑”标签不够，AI 需要知道**笑点是怎么造出来的**。
 * 本模块沉淀可执行的喜剧机制（包袱结构），每条含：原理、可操作技法、风险（避免尬笑/冒犯）。
 * - detectComedy：从标签/梗概识别喜剧意图与命中的机制关键词
 * - pickComedyMechanisms：确定性挑选（关键词命中优先，否则给通用三件套），永不返回空
 * - buildComedyDirective：生成给编剧/润色岗的双语喜剧执行指令
 * 纯函数、零 IO、可离线对拍；中文为单一事实源，英文并行层零中文。
 */
export type ComedyLang = 'zh' | 'en';
export interface ComedyMechanism {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;     // 为什么好笑（机理）
  technique: string; techniqueEn: string;     // 怎么写（可执行）
  risk: string; riskEn: string;               // 禁忌/风险
  kw: string[];                               // 中英识别关键词
}
export const COMEDY_MECHANISMS: ComedyMechanism[] = [
  {
    id: 'expect_break', name: '预期违背', nameEn: 'Expectation subversion',
    principle: '先沿观众惯性把预期铺到最高，再用一个更合理却完全相反的结果落地，落差即笑点', principleEn: 'Build the audience expectation along habit, then land on a more logical yet opposite result; the gap is the joke',
    technique: '前两拍认真铺垫惯性（越正经越好），第三拍一次反转兑现；铺垫里埋一个被忽略的伏笔，让反转“意料之外、情理之中”', techniqueEn: 'Play the first two beats dead straight, cash the third beat as a turn; plant one overlooked detail so the twist is surprising yet earned',
    risk: '为反而反、结果不合人物逻辑会变成闹剧；反转必须能从前文推出', riskEn: 'A turn that ignores character logic becomes farce; the reversal must be derivable from setup',
    kw: ['预期违背', '反转笑点', '意料之外', 'subvert', 'expectation', 'anti-climax', 'subversion'],
  },
  {
    id: 'triple_repeat', name: '三翻四抖/递进重复', nameEn: 'Rule of three / escalating repeat',
    principle: '同一情境重复两次建立规律，第三次在重复中升级或变形产生笑果（四抖）', principleEn: 'Repeat a pattern twice to set a rule; the third iteration escalates or mutates it for the laugh',
    technique: '设计一个可复用的动作/台词母题，三次出现逐级加码（规模、代价、围观者反应都升级），第四次抖出最大反差后立刻收，不拖', techniqueEn: 'Create a reusable action/line motif, escalate it on each repeat (scale, stakes, onlookers), then drop the biggest contrast and cut fast',
    risk: '重复超过四次不升级就腻；每次重复必须有新信息', riskEn: 'Repeating without escalation past three turns goes stale; each repeat needs new information',
    kw: ['三翻四抖', '递进', '重复', 'rule of three', 'callback repetition', 'running gag', 'escalat'],
  },
  {
    id: 'callback', name: 'CallBack 回扣', nameEn: 'Callback',
    principle: '把前段一个看似无用的闲笔/台词在后面关键处重新调用，观众因“我记得”而获得智力与会心双重满足', principleEn: 'Revive an earlier throwaway line/detail at a key moment; recognition gives the audience an intellectual, in-on-the-joke pleasure',
    technique: '开场前三集埋一个不起眼的口头禅/道具/承诺，在高潮或尴尬顶点原样回扣，措辞尽量一致以触发记忆', techniqueEn: 'Plant an unremarkable catchphrase/prop/promise early, repeat it verbatim at the peak or most awkward moment to trigger recognition',
    risk: '回扣点离铺垫太远观众会忘；闲笔不能刻意到一眼是伏笔', riskEn: 'Too far apart and the audience forgets; the plant must not look like an obvious setup',
    kw: ['callback', '回扣', '呼应', '前后呼应', 'call-back', 'payoff earlier joke'],
  },
  {
    id: 'deadpan_absurd', name: '一本正经地胡说', nameEn: 'Deadpan absurdity',
    principle: '越荒诞的内容用越冷静、流程化、专业的态度说出来，态度与内容的反差产生冷幽默', principleEn: 'Deliver the absurd with calm, procedural, professional seriousness; tone-versus-content contrast makes dry humor',
    technique: '让角色用开会/填表/做实验的严谨逻辑处理离谱事件，配术语和步骤，自己绝不笑场；周围人越认真越好笑', techniqueEn: 'Have characters treat the ridiculous with meeting-notes / lab-procedure rigor and jargon, never breaking face; the straighter everyone else, the funnier',
    risk: '演员/文本一笑场就垮；荒诞也要有自洽规则', riskEn: 'Winking at the audience kills it; the absurd still needs self-consistent rules',
    kw: ['一本正经', '冷幽默', '荒诞', 'deadpan', 'dry humor', 'absurd', 'straight face'],
  },
  {
    id: 'misinfo_escalate', name: '信息差误会升级', nameEn: 'Misunderstanding escalation',
    principle: '双方掌握的信息不对称，每个角色都按自己掌握的“真相”行动，越努力解释误会越深', principleEn: 'Asymmetric information: each side acts on its own version of the truth; the harder they explain, the deeper the misunderstanding',
    technique: '先让观众全知（比角色多知道一层），再让角色每次补救都恰好踩中下一个误会；每次升级提高代价，直到一个共同信息出现才一次性引爆', techniqueEn: 'Make the audience omniscient, then have each fix trigger the next misunderstanding; raise the stakes each round until one shared fact detonates it all',
    risk: '靠“主角就是不听解释”硬拖会招黑；误会升级要靠信息结构而非角色降智', riskEn: 'Forced “they just won’t listen” drag annoys viewers; escalation must come from information structure, not dumbed-down characters',
    kw: ['误会', '信息差', '错位', 'misunderstand', 'mistaken identity', 'crossed wires', 'miscommunication'],
  },
  {
    id: 'persona_clash', name: '反差人设对撞', nameEn: 'Contrasting-persona clash',
    principle: '把两套截然相反的行为逻辑关进同一情境（如社恐×话痨、劫匪×洁癖），冲突自带笑料', principleEn: 'Trap two opposite behavioral logics in one situation (introvert×chatterbox, robber×germaphobe); the clash generates comedy by itself',
    technique: '给每个角色一个“绝不能违背”的行为铁律，让两条铁律在同一目标下正面相撞；笑点写在双方都没做错却无法调和处', techniqueEn: 'Give each character an unbreakable behavioral rule and force the rules to collide toward one goal; the joke is that neither is wrong yet they cannot reconcile',
    risk: '人设只有标签没有逻辑会变小品喊口号；反差要靠选择而非造型', riskEn: 'A label without logic is just a sketch catchphrase; contrast must show in choices, not costumes',
    kw: ['反差', '人设对撞', '欢喜冤家', 'odd couple', 'clash', 'foil', 'polar opposite'],
  },
  {
    id: 'social_death', name: '大型社死现场', nameEn: 'Cringe / social death',
    principle: '当众暴露本想隐藏的真相，唤起观众“替他尴尬”的安全共情，尴尬到极致反而是爽', principleEn: 'Public exposure of a hidden truth triggers safe vicarious embarrassment; cringe pushed to the extreme flips into relief',
    technique: '先让角色拼命维持一个体面假象并让观众知道破绽，再安排最不该出现的人/设备（投屏、麦没关）当众揭穿，给一个想补救却越抹越黑的动作', techniqueEn: 'Let the character fight to keep up appearances while the audience sees the crack, then expose it publicly via the worst witness/device (screen mirror, hot mic), followed by a dig-deeper recovery',
    risk: '纯羞辱弱者不好笑反招厌；社死对象最好有自作自受或可爱属性', riskEn: 'Punching down is not funny; the target should be sympathetic or have brought it on themselves',
    kw: ['社死', '尴尬', '当众出丑', 'cringe', 'social death', 'awkward', 'public humiliation'],
  },
  {
    id: 'pacing_pause', name: '节奏顿挫与留白', nameEn: 'Timing, beat & pause',
    principle: '笑点=铺垫+停顿+抖包袱，停顿让观众自己补完预期，再在补完的瞬间打破', principleEn: 'A joke is setup + pause + punchline; the pause lets the audience finish the expectation so you can break it the instant they do',
    technique: '包袱前给一个明确的动作停顿或镜头留白（0.5-1秒），抖包袱用短句、把最意外的词放句尾；一场戏只留一个主包袱，其余做小笑点垫', techniqueEn: 'Insert a clear beat/pause before the punchline (0.5–1s), use a short sentence with the most unexpected word last; one main joke per scene, smaller gags only as padding',
    risk: '句句是梗等于没有梗，台词过满挤掉观众反应时间', riskEn: 'A joke in every line means no joke at all; overstuffed lines leave no room to react',
    kw: ['节奏', '留白', '顿挫', 'timing', 'pacing', 'beat pause', 'comic timing'],
  },
  {
    id: 'exaggerate_detail', name: '细节夸张与具象化', nameEn: 'Concrete exaggeration',
    principle: '抽象吐槽不好笑，把情绪夸张成一个具体、可视、超规格的画面/动作才好笑', principleEn: 'Abstract complaint is not funny; exaggerate an emotion into one concrete, visual, over-scaled image or action',
    technique: '把“很生气/很穷/很慌”改写成一个具体到离谱的动作或物件（如穷到给花呗设特别关注），用数字和细节让画面可拍', techniqueEn: 'Turn “furious/broke/panicked” into one absurdly specific, filmable action or object, using numbers and detail',
    risk: '夸张脱离人物处境会悬浮；夸张点要服务人物而非炫技', riskEn: 'Exaggeration detached from the situation floats free; it must serve the character',
    kw: ['夸张', '具象', '细节', 'exaggerat', 'specific detail', 'over the top', 'visual gag'],
  },
  {
    id: 'irony_warm', name: '毒舌下的温柔/反套路', nameEn: 'Sharp tongue, warm heart / anti-trope',
    principle: '用嘴硬刻薄的方式表达在乎，或故意绕开类型片老套桥段，观众在“以为要狗血”时被真诚/新鲜击中', principleEn: 'Express care through gruff sarcasm, or deliberately dodge the genre cliché; hit the audience with sincerity or novelty right when they expect melodrama',
    technique: '该煽情处让角色说反话、该套路处让角色“吐槽剧本”并选一个更真实的做法；吐槽点到为止，最后仍落到真情', techniqueEn: 'At the emotional beat let the character say the opposite; at the cliché beat have them call it out and choose the truer action. Keep meta-jokes brief and land on real feeling',
    risk: '为反套路而消解所有情感会空心；吐槽不能打断关键情绪', riskEn: 'Subverting every emotion leaves it hollow; meta-commentary must not break a key emotional beat',
    kw: ['毒舌', '反套路', '嘴硬', 'anti-trope', 'self-aware', 'meta joke', 'tsundere', 'snark'],
  },
];
export const VALID_COMEDY_MECHANISMS = new Set(COMEDY_MECHANISMS.map((m) => m.id));
const BY_ID = new Map(COMEDY_MECHANISMS.map((m) => [m.id, m]));

const COMEDY_HINT = ['喜剧', '搞笑', '轻喜', '爆笑', '沙雕', '无厘头', '幽默', '滑稽', 'comedy', 'funny', 'sitcom', 'parody', 'humor', 'humour', 'gag'];
export function detectComedy(text: string): boolean {
  const t = (text || '').toLowerCase();
  return COMEDY_HINT.some((k) => t.includes(k.toLowerCase()));
}

/** 确定性挑选机制：命中关键词的优先，其余用稳定默认补齐到 n 个；任何输入都返回非空数组 */
export function pickComedyMechanisms(text: string, n = 3): ComedyMechanism[] {
  const t = (text || '').toLowerCase();
  const hit = COMEDY_MECHANISMS.filter((m) => m.kw.some((k) => t.includes(k.toLowerCase())));
  const out: ComedyMechanism[] = [];
  hit.forEach((m) => { if (out.length < n) out.push(m); });
  // 通用三件套兜底：预期违背 + 节奏顿挫 + 细节夸张（覆盖面最广的底层功）
  const fallback = ['expect_break', 'pacing_pause', 'exaggerate_detail'];
  for (const id of fallback) { if (out.length >= n) break; const m = BY_ID.get(id)!; if (!out.includes(m)) out.push(m); }
  COMEDY_MECHANISMS.forEach((m) => { if (out.length < n && !out.includes(m)) out.push(m); });
  return out.slice(0, n);
}

/** 生成给编剧/润色岗的喜剧执行指令（双语）；非喜剧文本返回空串，调用方据此决定是否注入 */
export function buildComedyDirective(text: string, lang: ComedyLang = 'zh', n = 3): string {
  if (!detectComedy(text)) return '';
  const ms = pickComedyMechanisms(text, n);
  if (lang === 'en') {
    const body = ms.map((m) => `· ${m.nameEn} — ${m.techniqueEn} (risk: ${m.riskEn})`).join('\n');
    return `This is a COMEDY. Engineer the laughs deliberately, do not rely on characters saying “funny”. Use these mechanisms this episode:\n${body}\nRule: one main joke per scene, plant before payoff, never punch down, and keep character logic intact while being funny.`;
  }
  const body = ms.map((m) => `· ${m.name}——${m.technique}（风险：${m.risk}）`).join('\n');
  return `本剧为喜剧，笑点要被“设计”出来，不能靠角色自称搞笑、不能靠网络梗堆砌。本集重点使用以下喜剧机制：\n${body}\n要求：一场一个主包袱、先铺垫后兑现、不拿弱者开涮，好笑的同时人物逻辑不能崩。`;
}
