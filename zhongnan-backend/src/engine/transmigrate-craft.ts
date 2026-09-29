/**
 * 穿书/快穿子类型机制引擎（v2.09）
 * ------------------------------------------------------------------
 * 用户点名“穿越题材还有穿书这种，还有哪些自己想”。普通穿越引擎已覆盖，穿书/快穿有其**独有装置**：
 * 原著剧情惯性（剧情修正力）、读者上帝视角与信息差、原著 flag 回收、改命与反套路、NPC 觉醒、
 * 任务流与脱离条件、多世界锚点、现代知识金手指边界等。本模块沉淀 10 套可执行装置（机理+技法+风险），
 * 自动识别穿书/快穿意图并下发给架构师/编剧岗；非穿书返回空串。纯函数、确定性、双语零中文英文层。
 */
export type TransmigrateLang = 'zh' | 'en';
export interface TransDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const TRANSMIGRATE_DEVICES: TransDevice[] = [
  {
    id: 'cannon_fodder', name: '穿成炮灰/配角', nameEn: 'Reincarnated as cannon fodder',
    principle: '主角带着上帝视角穿成注定领盒饭的小角色，最大张力是“知道自己会死”与“如何改命”', principleEn: 'The lead, with reader foreknowledge, wakes as a minor character fated to die; tension is knowing the death and fighting to rewrite it',
    technique: '开场就交代原著里这个角色的死法与倒计时，主角每改一步都引发原著的连锁反作用力；把“求生”拆成几个可执行的小目标，逐个打脸原剧情', techniqueEn: 'Open by stating the character’s canonical death and its countdown; every change triggers a chain reaction from the original plot; break survival into executable goals that beat the canon one by one',
    risk: '主角若全知全能就没张力；必须保留信息盲区与改命代价', riskEn: 'An omniscient lead has no tension; keep blind spots and a cost to changing fate',
    kw: ['炮灰', '配角', '路人甲', '小透明', 'cannon fodder', 'side character', 'extra', 'background character'],
  },
  {
    id: 'villain_route', name: '穿成反派/恶毒女配', nameEn: 'Reincarnated as the villain',
    principle: '穿成人人喊打的反派，主角靠“知道所有人结局”反向洗白/布局，反差与求生欲是核心爽点', principleEn: 'Waking as the hated villain, the lead uses knowledge of every ending to whitewash/outmaneuver; contrast and survival drive the payoff',
    technique: '第一场先让主角承受原反派留下的烂摊子（仇家、婚约、黑料），用“反向操作”把原反派的恶行逐个变成翻盘筹码；关键关系人态度转变要有过程、不能一集倒戈', techniqueEn: 'Open with the mess the original villain left (enemies, engagement, bad PR), turn each villainous deed into leverage by reversing it; relationship turns must be earned, not flipped in one episode',
    risk: '洗白不能靠他人集体失忆；原反派做过的恶要被正视和偿还', riskEn: 'Redemption cannot rely on collective amnesia; the original villain’s wrongs must be faced and paid',
    kw: ['反派', '恶毒女配', '男配', '黑化', 'villain', 'villainess', 'antagonist route', 'whitewash'],
  },
  {
    id: 'white_moonlight', name: '白月光/替身错位', nameEn: 'White moonlight / substitute mismatch',
    principle: '穿成男主的白月光或其替身，利用“知道感情线走向”在错位关系里夺回主动权', principleEn: 'Reincarnated as the male lead’s first love or her substitute, the lead uses knowledge of the romance arc to seize agency in a mismatched relationship',
    technique: '先立清原著感情线（谁爱谁、谁是替身、第几集变心），主角刻意避开原剧情的情感陷阱，把“被选择”改成“我选择”；用一次主动退出测试对方真心，制造情感反转', techniqueEn: 'Lay out the canonical love line (who loves whom, who is the substitute, when feelings shift); the lead deliberately dodges its traps, turning “being chosen” into “I choose”; test true feelings with one deliberate exit',
    risk: '感情不能靠主角背剧本强推；对方心动要有具体事件支撑', riskEn: 'Romance cannot be forced by reciting the script; attraction needs concrete events',
    kw: ['白月光', '替身', '朱砂痣', 'white moonlight', 'substitute', 'first love stand-in', 'replace'],
  },
  {
    id: 'plot_inertia', name: '原著剧情惯性/修正力', nameEn: 'Plot inertia / world correction',
    principle: '世界会自我修正把偏离的剧情拉回原著，主角与“剧情惯性”对抗是穿书独有的外部压力源', principleEn: 'The world self-corrects to pull a derailed story back to canon; fighting plot inertia is the genre’s unique external pressure',
    technique: '设定明确的修正规则（小偏离遇巧合拉回、大改付出代价、关键节点最难改），让主角每次改命都遭遇升级的阻力；在某个关键节点让主角以为成功后剧情以另一种方式兑现原结局，制造二次危机', techniqueEn: 'Set clear correction rules (small deviations pulled back by coincidence, big changes cost more, key nodes hardest); after a seeming win at a key node, let the canon ending arrive another way for a second crisis',
    risk: '修正力不能随心所欲当万能胶水；规则一旦定下必须前后一致', riskEn: 'Correction must not be arbitrary plot glue; once set, rules stay consistent',
    kw: ['剧情惯性', '修正力', '世界意识', '天道', '剧情拉回', 'plot inertia', 'self-correct', 'world will', 'canon pull'],
  },
  {
    id: 'flag_callback', name: '原著flag回收', nameEn: 'Canon flag payoff',
    principle: '原著里的台词、伏笔、名场面是穿书者的“预言”，回收时给读过书的观众强烈的预判爽与反差', principleEn: 'Canon lines, foreshadowing and famous scenes become the transmigrator’s prophecies; cashing them gives book-reading viewers strong anticipation and contrast',
    technique: '前期让主角点出 2-3 个原著 flag（“按书里他今天会……”），部分精准兑现建立可信度，再让一个关键 flag 因主角干预而改写，形成“以为会这样结果那样”的爽点；flag 用人物原话触发记忆', techniqueEn: 'Early on have the lead cite 2–3 canon flags; let some land exactly to build credibility, then rewrite one key flag through intervention; trigger recognition with the original wording',
    risk: '没读过原著的观众也要能看懂，flag 出现时要自带最小上下文，不能只服务书粉', riskEn: 'Viewers who never read the book must still follow; give each flag minimal context, not fan-service only',
    kw: ['flag', '伏笔', '名场面', '原著剧情', '原著里', 'canon', 'flag payoff', 'original scene', 'foreshadow callback'],
  },
  {
    id: 'reader_edge', name: '读者上帝视角×信息差', nameEn: 'Reader omniscience × info gap',
    principle: '主角知道全局、书中人只看眼前，信息差既制造爽点（预判）也制造危机（知道却拦不住）', principleEn: 'The lead knows the whole book while characters see only now; the gap creates both payoff (foresight) and crisis (knowing but unable to stop)',
    technique: '把上帝视角切成“确定知道的”和“原著没写的盲区”两类，爽点来自用已知布局，危机来自盲区爆雷；安排一个主角误读原著的点，提醒观众全知有边界', techniqueEn: 'Split foreknowledge into “known for sure” and “gaps the book never wrote”; payoff comes from known setup, crisis from blind spots; include one moment the lead misread the book to show omniscience has limits',
    risk: '主角不能把剧本念成流水账；已知信息要转化为行动而非旁白解说', riskEn: 'The lead must not narrate the book aloud; turn foreknowledge into action, not exposition',
    kw: ['上帝视角', '预知', '知道剧情', '信息差', '读过原著', 'omniscient', 'foreknowledge', 'reader knowledge', 'know the plot'],
  },
  {
    id: 'npc_awaken', name: 'NPC觉醒/真人意识', nameEn: 'NPC awakening / sentience',
    principle: '当书中人物开始偏离原著、产生自我意识，“谁是真人、谁在被书写”成为高级悬念与情感点', principleEn: 'When a character deviates from canon and gains self-awareness, “who is real and who is written” becomes high-level suspense and emotion',
    technique: '让一个重要配角率先察觉“自己每次都按固定轨迹行事”，用一个反常小动作暴露觉醒；主角与觉醒者从互相试探到结盟，共同对抗剧情惯性；觉醒代价（被世界抹除）制造情感重量', techniqueEn: 'Let a key supporting character first notice they repeat a fixed track, revealed by one abnormal micro-action; lead and awakened character move from probing to alliance against plot inertia; the cost of awakening (erasure) gives emotional weight',
    risk: '觉醒设定要克制，全员觉醒会消解主角独特性；觉醒者逻辑要自洽', riskEn: 'Use awakening sparingly — everyone awakened dilutes the lead; an awakened character must stay self-consistent',
    kw: ['npc', '觉醒', '自我意识', '角色成精', 'sentient', 'self-aware', 'awakened character', 'free will'],
  },
  {
    id: 'quick_task', name: '快穿任务流', nameEn: 'Quick-transmigration task loop',
    principle: '快穿靠“一个个小世界+系统任务+结算”提供单元节奏与持续升级感，每个世界是一个独立爽点闭环', principleEn: 'Quick-transmigration uses small worlds + system tasks + settlement for episodic rhythm and escalation; each world is a self-contained payoff loop',
    technique: '每个小世界开场交代身份、任务、成功/失败代价与时限，3-8 集内完成“接任务—受阻—翻盘—结算”闭环；结算给可见奖励（积分/技能/记忆碎片）并埋下贯穿主线的碎片，避免单元割裂', techniqueEn: 'Open each world with identity, task, win/fail cost and deadline; close a receive-block-turn-settle loop in 3–8 episodes; settlement grants visible rewards and a main-line fragment so episodes do not feel disconnected',
    risk: '世界之间不能只是换皮重复；每个世界要有独立的情感命题或手法', riskEn: 'Worlds must not be reskinned repeats; each needs its own emotional question or device',
    kw: ['快穿', '任务', '系统任务', '小世界', '位面', 'quick transmigration', 'task world', 'system mission', 'world hop'],
  },
  {
    id: 'exit_condition', name: '脱离/回归条件', nameEn: 'Exit / return condition',
    principle: '明确“怎样才能离开书/回到现实”给主角和观众一个总目标钩子，贯穿全剧', principleEn: 'A clear “how to leave the book / return to reality” gives lead and audience an overarching goal-hook across the series',
    technique: '早期立清脱离规则（完成任务/改写悲剧/集齐某物/被谁真心爱上），中途安排一次“看似能走却选择留下”的抉择强化情感，结局的离开或留下必须回扣最初规则', techniqueEn: 'Establish exit rules early (finish the mission, rewrite the tragedy, collect items, earn true love); mid-story place a “could leave but chooses to stay” choice; the ending must callback the original rule',
    risk: '脱离规则不能中途随意更改；临时加条件会让观众觉得被耍', riskEn: 'Exit rules cannot change mid-story; last-minute conditions feel like cheating',
    kw: ['脱离', '回到现实', '回归', '离开书中', 'exit', 'return to real world', 'escape condition', 'way back'],
  },
  {
    id: 'modern_edge', name: '现代知识金手指边界', nameEn: 'Modern-knowledge edge & its limits',
    principle: '穿书者的现代知识/商业/审美是金手指，但必须设边界与代价，否则爽感失真、对手降智', principleEn: 'Modern knowledge (business, taste, technology) is the cheat, but it needs limits and cost or the payoff feels fake and rivals turn dumb',
    technique: '列出主角能用的现代知识清单并设约束（古代缺材料/产业链、世界规则禁用某类技术、知识只懂大概），每次用现代知识解题都配套一个新麻烦；让本土角色用本地智慧补上主角短板，形成搭档而非单方面碾压', techniqueEn: 'List usable modern knowledge and its constraints (missing materials/industry, world rules banning tech, only rough know-how); each modern solution creates a new problem; let locals complement the lead with native wisdom as partners, not one-sided domination',
    risk: '不能输出违背历史/科学常识的“神操作”，更不能让古人为难而集体降智', riskEn: 'No historically/scientifically impossible miracles, and no dumbed-down locals to make the lead shine',
    kw: ['现代知识', '金手指', '现代思维', '降维打击', 'modern knowledge', 'cheat skill', 'future know-how', 'outsider advantage'],
  },
];
export const VALID_TRANSMIGRATE_DEVICES = new Set(TRANSMIGRATE_DEVICES.map((d) => d.id));
const BY_ID = new Map(TRANSMIGRATE_DEVICES.map((d) => [d.id, d]));

const TRANS_HINT = ['穿书', '快穿', '穿成', '穿进', '书中', '书里', '原著', '进小说', '炮灰', '恶毒女配', '白月光', '小世界', '位面', 'transmigrate into the book', 'into the novel', 'isekai into a novel', 'villainess', 'reincarnated in a novel', 'quick transmigration', 'world hop', 'cannon fodder route'];
export function detectTransmigrate(text: string): boolean {
  const t = (text || '').toLowerCase();
  return TRANS_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickTransDevices(text: string, n = 3): TransDevice[] {
  const t = (text || '').toLowerCase();
  const hit = TRANSMIGRATE_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: TransDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：读者信息差（穿书立身之本）+ 原著 flag 回收 + 剧情惯性（最具类型辨识度）
  const fallback = ['reader_edge', 'flag_callback', 'plot_inertia'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  TRANSMIGRATE_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildTransmigrateDirective(text: string, lang: TransmigrateLang = 'zh', n = 3): string {
  if (!detectTransmigrate(text)) return '';
  const ds = pickTransDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a TRANSMIGRATED-INTO-A-NOVEL / QUICK-TRANSMIGRATION story. Use its genre-specific devices this episode:\n${body}\nHard rules: keep the lead’s foreknowledge limited (blind spots and costs exist), the world’s correction rules must stay consistent, pay off canon flags with minimal context so new viewers follow, never dumb down in-book characters, and every change to canon must cause a visible consequence.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为穿书/快穿题材，要用好该类型独有的装置。本集重点使用：\n${body}\n硬性要求：主角的“上帝视角”必须有盲区与改命代价，剧情修正规则前后一致；原著 flag 回收时自带最小上下文，让没读过原著的观众也看得懂；不为捧主角让书中人集体降智；每一次改动原著都要产生可见的连锁后果。`;
}
