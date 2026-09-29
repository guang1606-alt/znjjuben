/**
 * 刑侦法医 / 罪案程序机制引擎（v2.25）
 * ------------------------------------------------------------------
 * 第十七套类型引擎，是 mystery 悬疑之下更硬核的“刑侦程序/法医罪案”细分。
 * AI 写刑侦通病：证据链断裂靠直觉破案、关键线索结尾天降、法医开挂报答案、
 * 嫌疑人纯工具人、诡计违反物理时间、程序违法（诱供逼供）、美化罪犯、
 * 渲染血腥、写成可操作犯罪教程。本模块 10 装置，非该类型返回空串。纯函数、确定性、双语。
 */
export type InvLang = 'zh' | 'en';
export interface InvDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const INV_DEVICES: InvDevice[] = [
  {
    id: 'evidence_chain', name: '证据链闭环可对账', nameEn: 'A closed, auditable evidence chain',
    principle: '刑侦剧的硬核感来自“每个结论都站在证据上”：物证、言词、鉴定、电子证据环环相扣，破案是证据一点点拼出来的，不是主角灵光一闪', principleEn: 'Procedural credibility means every conclusion rests on evidence—physical, testimony, forensic and digital links that accumulate; the case is assembled, not divined',
    technique: '大纲阶段列一张证据账本：每个关键结论后面标注“由哪件证据支撑、第几集出现、谁提取、是否合法”；每推进一层结论必须先出现对应证据，证据与结论之间的推理写出来给观众看，禁止“他突然明白了”式跳步', techniqueEn: 'Keep an evidence ledger in the outline: for each conclusion note which exhibit supports it, episode found, who collected it, and legality; every new conclusion requires its evidence shown first and the inference made visible—no sudden “then he understood” leaps',
    risk: '证据要精炼呈现，避免堆砌专业流程拖慢节奏，一件证据承担一个推进作用', riskEn: 'Present evidence economically; one exhibit advances one beat, avoid procedural padding',
    kw: ['刑侦', '刑警', '法医', '破案', '证据', '尸检', '痕检', '专案组', '命案', 'detective', 'homicide', 'forensic', 'evidence', 'investigation', 'procedural crime'],
  },
  {
    id: 'fair_play', name: '公平推理线索前置', nameEn: 'Fair-play clues planted up front',
    principle: '高级的反转是“答案一直在，观众没看出来”：定案与翻案所需的关键线索必须提前给到，结局回收时观众能回溯印证，而非靠结尾抛出新信息', principleEn: 'A premium twist is “the answer was there all along”: decisive clues are planted early so the ending can be retraced, rather than dropped as new information',
    technique: '写定案/反转前先倒推：观众需要在哪几集看到哪三件事才能相信这个结论，把它们以“当时不起眼”的方式前置（一句闲聊、一个背景动作、一件被忽略的物证）；真相揭晓时用一个镜头/台词回扣最早的线索', techniqueEn: 'Work backward from each solve: identify the three things the audience must have seen, plant them as easy-to-miss beats (an aside, background action, an overlooked exhibit), and echo the earliest clue when the truth lands',
    risk: '线索前置要自然，不能用特写加配乐“喊”观众记住，那等于剧透', riskEn: 'Plant naturally; a scored close-up that screams “remember this” is self-spoiling',
    kw: ['线索', '伏笔', '公平推理', '倒推', '回扣', 'clue', 'fair play', 'planted clue', 'foreshadow', 'retrace'],
  },
  {
    id: 'forensic_realism', name: '法医程序克制可信', nameEn: 'Restrained, credible forensics',
    principle: '法医是“会说话的证据”，不是全知外挂：检验遵循真实流程与能力边界，能确定什么、不能确定什么要清楚，专业细节点到为止，靠观察推理而非报答案', principleEn: 'Forensics is evidence that speaks, not an omniscient cheat: it follows real procedure and limits—what it can and cannot establish—reasoning from observation rather than announcing answers',
    technique: '让法医给出“发现+多种可能”，再由侦查去排除（能推断死亡时间窗口而非精确到分、能判断凶器类型而非直接报出品牌）；不确定的结论标注不确定，后续可以被新证据修正；专业名词出现时用人物对话自然解释一句', techniqueEn: 'Have forensics deliver a finding plus possibilities that investigation narrows (a time window rather than an exact minute, a weapon class rather than a brand); mark uncertainty as correctable, and gloss terms once through dialogue',
    risk: '不杜撰精确的鉴定数据、毒物配比与解剖细节，拿不准用泛称', riskEn: 'Never invent precise forensic figures, poison formulas or autopsy detail; use generic terms when unsure',
    kw: ['尸检', '法医鉴定', '解剖', '死亡时间', '伤情', '毒理', 'autopsy', 'coroner', 'postmortem', 'toxicology', 'forensic report'],
  },
  {
    id: 'red_herring', name: '红鲱鱼误导有理由', nameEn: 'Motivated red herrings',
    principle: '每个被怀疑又洗清的人都要有“为什么看起来像他”的理由和“为什么不是他”的证据，误导来自人物自身的隐情，而不是编剧硬按头', principleEn: 'Every suspect who seems guilty then clears needs both a reason he looked guilty and evidence he is not; misdirection grows from his own secret, not authorial forcing',
    technique: '为每个主要嫌疑人写一张两面卡：表面疑点（案发时间出现在附近、说谎、有旧怨）+ 背后隐情（他在隐瞒另一件不相关的错事）；洗清时让那件隐情水落石出，同时制造新的社会观察，红鲱鱼用完要留下人物价值', techniqueEn: 'Give each suspect a two-sided card: surface suspicion (nearby, lying, a grudge) plus a hidden reason (concealing an unrelated wrong); clearing him reveals that secret and yields social insight, so the red herring leaves character value behind',
    risk: '红鲱鱼不超过 2-3 个，太多嫌疑人观众记不住也会疲劳', riskEn: 'Cap red herrings at 2-3; more suspects than the audience can track cause fatigue',
    kw: ['嫌疑人', '红鲱鱼', '误导', '洗清嫌疑', '隐情', 'suspect', 'red herring', 'misdirection', 'wrongly suspected'],
  },
  {
    id: 'time_lock', name: '时间线诡计不违物理', nameEn: 'Timelines and alibis that obey physics',
    principle: '不在场证明与诡计的魅力是“在常识物理规则内玩信息差”：路程时间、监控盲区、目击者误差都可对账，谜底揭开后路线与时间严丝合缝，不能靠瞬移和巧合', principleEn: 'Alibis and tricks play with information gaps inside real physics: travel time, blind spots, witness error all reconcile, and the solution closes the route and timeline exactly—no teleportation or coincidence',
    technique: '设计诡计时先画时间轴与空间图，逐段核对“几分钟能从哪到哪、谁在什么位置、监控覆盖哪里”；让诡计利用一个真实存在的信息差（楼栋双入口、时差、被误读的时间戳），谜底用一张清晰的复盘讲透', techniqueEn: 'Draw a timeline and map first, segment by segment checking travel minutes, positions and camera coverage; exploit a genuine information gap (twin entrances, a timezone, a misread timestamp), then explain cleanly in one reconstruction',
    risk: '巧合只能制造麻烦，不能解决案件；破案不能靠犯人自曝', riskEn: 'Coincidence may create trouble but never solves the case; the culprit must not simply confess it away',
    kw: ['不在场证明', '时间线', '诡计', '监控', '案发时间', 'alibi', 'timeline', 'locked room', 'surveillance gap', 'time of death'],
  },
  {
    id: 'motive_depth', name: '动机人性有前史', nameEn: 'Motives with human depth and history',
    principle: '凶手不是“为坏而坏”的纸片人：可信的动机来自长期积压的处境、关系与心理，观众理解其为何走到这一步，但价值判断上绝不认同其犯罪', principleEn: 'The culprit is not evil for evil’s sake: a credible motive grows from long-built circumstance, relationship and psychology—the audience understands how he got there without endorsing the crime',
    technique: '给施害者写一条“走到今天”的前史线（三次被压垮的关键节点），通过调查逐步揭开；让主角在理解动机的同时明确否定其选择，形成“理解但不原谅”的张力；受害者也不写成完美圣人，人物都有灰度', techniqueEn: 'Give the offender a backstory of three breaking points revealed through investigation; let the lead understand the motive yet explicitly reject the choice—“understand, never forgive”; keep the victim less than a saint too, in shades of gray',
    risk: '理解动机不等于同情洗白，落点必须是犯罪必付代价', riskEn: 'Understanding a motive is not exoneration; the landing must be that crime costs',
    kw: ['动机', '前史', '仇怨', '积怨', '心理', 'motive', 'backstory', 'grudge', 'psychology', 'why he did it'],
  },
  {
    id: 'detective_limit', name: '侦探有代价有局限', nameEn: 'A detective with limits and costs',
    principle: '主角不是神：刑侦是团队程序活，要走流程、会走错方向、要为判断失误付代价，个人生活与心理也被案件磨损，局限让胜利更可信', principleEn: 'The lead is not a god: detection is team procedure—following process, pursuing dead ends, paying for misjudgments, worn down personally; limits make the win credible',
    technique: '安排至少一次“主角判断错误导致后果”（抓错人、打草惊蛇、队友受伤），再靠证据纠偏；让技术、法医、外勤、审讯各岗位都有不可替代的贡献，主角负责整合而非全知；给一条被案件牵动的个人线', techniqueEn: 'Include at least one costly misjudgment (wrong arrest, tipping off the culprit, a hurt teammate) corrected by evidence; let forensics, tech, fieldwork and interrogation each contribute indispensably while the lead integrates rather than knows all; add a personal line the case strains',
    risk: '个人线为案件主题服务，不喧宾夺主变情感剧', riskEn: 'The personal line serves the case theme rather than hijacking it into melodrama',
    kw: ['队长', '专案组', '侦查员', '师徒', '办案', 'detective lead', 'task force', 'investigator', 'partner', 'procedural team'],
  },
  {
    id: 'reversal_chain', name: '翻案反转层层递进', nameEn: 'Layered reversals built on re-read evidence',
    principle: '刑侦剧的反转不是换个凶手，而是“同一件证据被重新解释”：每次翻案都建立在旧证据的新解读或新证据的合法取得上，层层递进指向唯一真相', principleEn: 'A reversal is not swapping culprits but re-reading the same evidence: each turn rests on a new interpretation or lawfully obtained new evidence, converging layer by layer on one truth',
    technique: '设计 2-3 层认知阶梯（以为是情杀→发现是侵财伪装→牵出多年旧案），每层翻案都明确“是什么证据让上一个结论站不住”；被推翻的结论里保留一部分仍然成立的事实，避免全盘推翻的悬浮感', techniqueEn: 'Design 2-3 cognitive rungs (crime of passion → staged robbery → an old case), each turn naming the evidence that breaks the prior conclusion while keeping part of it valid, avoiding all-or-nothing whiplash',
    risk: '反转不超过三层，层数过多观众会放弃推理、只等答案', riskEn: 'Cap reversals at three layers; beyond that the audience stops reasoning and waits',
    kw: ['反转', '翻案', '真凶', '重新鉴定', '案中案', 'twist', 'reopen the case', 'true culprit', 'case within a case'],
  },
  {
    id: 'procedural_ethics', name: '程序正义执法有边界', nameEn: 'Procedural justice and lawful limits',
    principle: '破案不能以违法为代价：审讯、搜查、取证都在程序边界内，非法证据被排除、诱供逼供被否定，主角靠扎实侦查而非程序违规取胜，这本身就是价值导向', principleEn: 'Solving a case never justifies breaking law: interrogation, search and collection stay within procedure, illegal evidence is excluded and coercion rejected; the lead wins through solid legwork—itself a value statement',
    technique: '设置一次“程序诱惑”（违规能更快破案、领导施压、舆论催办），让主角坚持合法路径并最终靠它赢；审讯靠证据与心理博弈突破，展现“政策与证据双管齐下”，不拍逼供桥段；让程序合规成为最后能定罪的关键', techniqueEn: 'Stage a procedural temptation (a shortcut, pressure from above, public opinion) where the lead stays lawful and wins that way; break suspects through evidence and psychology, never coercion, and make lawful procedure the very thing that secures conviction',
    risk: '不展示规避侦查、毁证串供的可操作细节，不把违规办案拍成英雄主义', riskEn: 'Do not show actionable anti-investigation or evidence-tampering detail, nor glorify rule-breaking',
    kw: ['审讯', '程序', '合法取证', '传唤', '非法证据', 'interrogation', 'due process', 'lawful evidence', 'miranda rights', 'exclusionary rule'],
  },
  {
    id: 'social_temperature', name: '罪案背后有社会温度', nameEn: 'Social temperature beneath the case',
    principle: '案件是入口，人心与社会是落点：罪案照见真实的关系与处境，让观众在推理之外有所感，但不消费苦难、不渲染猎奇、不贩卖焦虑', principleEn: 'The case is the doorway, human and social reality the landing: crime illuminates real relationships and conditions without consuming suffering, chasing grotesquerie or peddling anxiety',
    technique: '每个案件绑定一个可共情的现实切面（养老、校园、职场、邻里、家庭债务），通过受害者与相关人的生活细节自然呈现，不借角色之口长篇说教；结局在法之外留一点人的温度（家属善后、生者继续生活）', techniqueEn: 'Bind each case to one relatable social facet (elder care, school, workplace, neighborhood, family debt) shown through daily detail rather than lectures; end with a touch of human warmth beyond the verdict—families cared for, the living moving on',
    risk: '现实切面点到为止，避免议题大于故事、避免对特定群体污名化', riskEn: 'Touch the issue lightly; never let agenda dwarf the story or stigmatize a group',
    kw: ['现实', '社会', '民生', '人情', '善后', 'social realism', 'community', 'human cost', 'aftermath'],
  },
];

export const VALID_INV_DEVICES = new Set(INV_DEVICES.map((d) => d.id));
const BY_ID = new Map(INV_DEVICES.map((d) => [d.id, d]));

const INV_HINT = ['刑侦', '刑警', '法医', '破案', '专案组', '命案', '凶杀', '追凶', '罪案', '侦查', '尸检', '悬疑刑侦', 'detective', 'homicide', 'murder investigation', 'forensic crime', 'police procedural', 'criminal investigation', 'crime scene', 'serial case'];
export function detectInvestigation(text: string): boolean {
  const t = (text || '').toLowerCase();
  return INV_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickInvDevices(text: string, n = 3): InvDevice[] {
  const t = (text || '').toLowerCase();
  const hit = INV_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: InvDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：证据链（地基）+ 公平推理（类型魂）+ 程序正义（价值底线）
  const fallback = ['evidence_chain', 'fair_play', 'procedural_ethics'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  INV_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildInvDirective(text: string, lang: InvLang = 'zh', n = 3): string {
  if (!detectInvestigation(text)) return '';
  const ds = pickInvDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a POLICE-PROCEDURAL / FORENSIC crime drama. Make detection hard-earned and lawful. Use these devices this episode:\n${body}\nHard rules: every conclusion rests on a traceable evidence chain with decisive clues planted before the payoff (fair play), forensics stay within real limits and never invent precise poison formulas, autopsy steps or figures, alibis and tricks obey real time and space, the detective is a limited team player who pays for mistakes, lawful procedure is never bypassed and never shown as heroism, do NOT provide actionable crime or evidence-tampering instructions, never glorify the offender or dwell on gore, treat minor victims without sensationalism, and keep social empathy without consuming suffering.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为刑侦法医/罪案程序剧，破案要硬核、可信、合法。本集重点使用以下装置：\n${body}\n硬性要求：每个结论都有可对账的证据链支撑，关键线索提前埋设、结局可回溯（公平推理）；法医守能力边界、不杜撰毒物配比/解剖步骤/精确数据；不在场证明与诡计不违反真实时间空间；主角是有局限、会为错误付代价的团队一员；严守程序正义，不把违规办案拍成英雄、不展示可操作的犯罪或毁证手法；不美化罪犯、不渲染血腥猎奇、涉及未成年人受害不煽情猎奇；保留社会温度但不消费苦难。`;
}
