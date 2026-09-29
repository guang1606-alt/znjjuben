/**
 * 职业行业剧机制引擎（v2.16）——医疗 / 律政 / 消防 / 刑侦等专业行业剧
 * ------------------------------------------------------------------
 * 第十套“类型机制引擎”。行业剧 AI 通病：专业流程跳步或硬伤、堆术语装专业、主角靠违规操作
 * （私刑/非法取证/擅自用药）逞英雄、把职业写成岗位符号、案例平铺无反转、团队沦为背景板。
 * 本模块沉淀 10 套装置（机理+技法+风险），自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type ProLang = 'zh' | 'en';
export interface ProDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const PRO_DEVICES: ProDevice[] = [
  {
    id: 'procedural_flow', name: '专业流程真实', nameEn: 'Authentic procedural workflow',
    principle: '行业剧的可信度建立在标准流程上：抢救、立案、出警、庭审都有不可跳步、不可颠倒的程序，程序本身就是戏剧张力', principleEn: 'Credibility rests on standard procedure — resuscitation, case filing, dispatch and trial have steps that cannot be skipped or reordered, and procedure itself creates tension',
    technique: '动笔前先列出该行业一条完整标准流程（如急诊：分诊—评估—检查—诊断—处置—交接），剧情严格沿流程推进，把冲突嵌进流程节点（检查结果未出就要先决策、流程被外力打断）；关键操作步骤需可查证，宁可不写也不写错', techniqueEn: 'Before writing, lay out one complete standard workflow (e.g. ER: triage—assessment—tests—diagnosis—treatment—handover), drive the plot strictly along it, and embed conflict at nodes (decide before results return, procedure interrupted by outside force); key steps must be verifiable — omit rather than invent',
    risk: '流程要为剧情服务、点到为止，避免写成操作手册式科普', riskEn: 'Procedure serves drama and stays concise, never a textbook manual',
    kw: ['流程', '抢救', '手术', '立案', '出警', '庭审', 'procedure', 'protocol', 'resuscitation', 'surgery', 'trial process'],
  },
  {
    id: 'jargon_grounded', name: '行话落地不堆砌', nameEn: 'Grounded jargon, never name-dropping',
    principle: '专业术语要准确，但必须借人物动作或通俗解释让观众秒懂；术语密度服务真实感，堆砌名词只会出戏', principleEn: 'Jargon must be accurate yet instantly understandable through action or plain paraphrase; density serves realism, name-dropping breaks immersion',
    technique: '每出现一个专业术语，紧跟一个可视化动作或一句“翻译成人话”的对白（用比喻、对家属解释）；同一集术语不堆砌，优先用观众能感知的症状/证据/后果替代冷僻名词；术语与岗位级别匹配，实习生说不出主任级判断', techniqueEn: 'Follow each term with a visible action or plain-language line (a metaphor, an explanation to family); don’t cluster jargon in one episode, prefer symptoms/evidence/consequences the audience can feel; match jargon to seniority — an intern wouldn’t voice an attending’s call',
    risk: '解释要自然融入对白，不能变成对着镜头讲课', riskEn: 'Explanation must live naturally in dialogue, never lecturing the camera',
    kw: ['术语', '行话', '专业名词', '医学', '法条', 'jargon', 'terminology', 'medical terms', 'legal terms'],
  },
  {
    id: 'ethics_dilemma', name: '职业伦理两难', nameEn: 'Professional ethical dilemma',
    principle: '行业剧最高级的冲突是“两个都对”的伦理两难：程序正义与结果正义、救一个还是救一群、保密与告知，没有标准答案才耐嚼', principleEn: 'The finest conflict is a dilemma where both sides are right — procedural vs substantive justice, save one vs save many, confidentiality vs disclosure; no easy answer is what lasts',
    technique: '给主角设置一道两难选择题并明确两边代价（违规救人但要担责 / 守程序但眼睁睁失去机会），让不同岗位角色持不同立场争论；主角的选择要承担真实后果，不能两头好处都占；避免用反派使坏替代真正的伦理困境', techniqueEn: 'Force a dilemma with clear costs on both sides (break protocol to save someone but face liability, or follow it and lose the chance), let roles of different positions argue each side; the hero’s choice carries real consequences, never gets both rewards; don’t replace a genuine dilemma with a villain’s scheming',
    risk: '两难不能和稀泥，价值观底线（生命权、程序正义）不能被功利计算压倒', riskEn: 'Don’t fudge the dilemma; baseline values (right to life, procedural justice) must not be overridden by mere expediency',
    kw: ['伦理', '两难', '抉择', '程序正义', '医德', 'ethics', 'dilemma', 'tough choice', 'due process'],
  },
  {
    id: 'mentor_chain', name: '师徒传承线', nameEn: 'Mentor–protégé lineage',
    principle: '老带新是行业剧天然的成长结构：书本知识与现场经验的碰撞、师徒互相改变，让专业能力的传承可感', principleEn: 'Mentoring is a natural growth structure: textbook knowledge collides with field experience, mentor and protégé change each other, and the passing-on of craft becomes tangible',
    technique: '设一对师徒/新老搭档：新人按书本与理想行事、老人凭经验与教训判断，前期冲突、中期老人的旧伤被新人治愈、后期新人独立做出让老人认可的判断；用一次具体的“手把手教学”场面展示真本事，而非口头夸能力', techniqueEn: 'Pair a rookie (by the book, idealistic) with a veteran (experience, past lessons): clash early, the rookie heals the veteran’s old wound mid-way, and finally makes a call the veteran respects; show craft in one concrete hands-on teaching scene rather than praising competence in words',
    risk: '师傅不能是全知工具人，也要有自己的局限与成长', riskEn: 'The mentor isn’t an omniscient tool — they have limits and growth too',
    kw: ['师徒', '带教', '新人', '老医生', '前辈', 'mentor', 'rookie', 'intern', 'veteran', 'training'],
  },
  {
    id: 'time_window', name: '高压时间窗', nameEn: 'High-pressure time window',
    principle: '行业剧的紧张感来自真实的时间窗：黄金抢救时间、举证期限、火势蔓延、审讯时限，倒计时把专业决策逼到极限', principleEn: 'Tension comes from real time windows — golden rescue time, evidence deadlines, fire spread, interrogation limits — a countdown that forces expert decisions to the edge',
    technique: '为关键事件设定一个有行业依据的倒计时并让观众明确感知（还剩多少时间、每拖延一分钟代价是什么）；在时间窗内安排两难判断、资源不足、信息不全三重压力；时间流逝用具体动作（监护仪数字、烟层下降、证据时效）呈现，而非空喊“快一点”', techniqueEn: 'Set an evidence-based countdown for the key event the audience can read (time left, the cost of each minute lost), and layer three pressures inside it: a dilemma, scarce resources, incomplete information; show elapsed time through concrete signs (monitor numbers, descending smoke layer, expiring evidence), not shouts of “hurry”',
    risk: '倒计时长度要符合行业常识，不能为了紧张违背物理与医学规律', riskEn: 'Countdown length must fit industry reality; never violate physics or medicine for suspense',
    kw: ['倒计时', '黄金时间', '时限', '紧急', '争分夺秒', 'countdown', 'golden hour', 'time window', 'race against time'],
  },
  {
    id: 'mistake_cost', name: '专业失误与复盘', nameEn: 'Mistakes with cost and review',
    principle: '专业主角也会判断失误，真实的失误、代价与复盘让人物可信、让专业被尊重；永不犯错的“神”反而悬浮', principleEn: 'Professionals misjudge too; real mistakes, their cost and the post-mortem make characters credible and honor the craft — an infallible genius feels fake',
    technique: '安排一次主角基于当时信息做出的“合理但错误”的判断，写出真实后果（病情恶化/败诉/险情升级），随后用一场复盘（病例讨论/案后分析/战评）找出偏差、明确责任、改进流程；主角要直面责任而不是甩锅，失误成为后续成长的伏笔', techniqueEn: 'Give the hero a reasonable-but-wrong call given the information at hand, show the real consequence (worsening condition, lost case, escalated danger), then a review (case discussion, post-incident analysis, debrief) that locates the error, assigns responsibility and improves process; the hero faces responsibility instead of shifting blame, and the mistake seeds later growth',
    risk: '失误不能源于低级愚蠢或违规，复盘不能流于形式口号', riskEn: 'The mistake must not be stupidity or rule-breaking, and the review must not be empty slogans',
    kw: ['失误', '误诊', '败诉', '复盘', '责任', 'mistake', 'misdiagnosis', 'post-mortem', 'accountability'],
  },
  {
    id: 'team_chain', name: '多岗位协作链', nameEn: 'Multi-role team chain',
    principle: '真实行业靠团队：一台手术、一场救援、一次公诉需要多岗位精密配合，协作链让专业世界立体、避免主角独角戏', principleEn: 'Real professions run on teams — surgery, rescue and prosecution need precise multi-role coordination; the chain makes the professional world three-dimensional and avoids a one-man show',
    technique: '为关键战役安排 3-4 个不同岗位角色各司其职（主刀/麻醉/护士、指挥/破拆/供水、侦查/技侦/法医），用简短指令与交接体现配合节奏；让某个辅助岗位在关键时刻起决定性作用；主角的成功明确依赖团队，而非一个人包打天下', techniqueEn: 'Staff the key battle with 3–4 roles each owning a job (surgeon/anesthetist/nurse; commander/forcible-entry/water-supply; detective/tech-forensics/medical examiner), show rhythm through terse orders and handovers; let a supporting role turn the tide at a key moment; the hero’s success visibly depends on the team',
    risk: '辅助岗位要有姓名与立场，不能是只会“收到”的背景音', riskEn: 'Supporting roles need names and stances, not background voices that only say “copy”',
    kw: ['团队', '协作', '配合', '多科室', '指挥', 'team', 'crew', 'coordination', 'unit', 'squad'],
  },
  {
    id: 'case_reversal', name: '病例/案情层层反转', nameEn: 'Layered case reversal',
    principle: '行业剧的智力快感来自逼近真相：初步诊断/结论被新证据推翻、再推翻，每次反转都基于专业逻辑而非巧合', principleEn: 'The intellectual pleasure is closing in on truth: the initial diagnosis/conclusion is overturned by new evidence, again and again, each reversal grounded in professional logic, not coincidence',
    technique: '设计三层认知：表面结论（看似显然）→专业疑点（一个对不上的细节）→真相（用专业知识重新拼合）；每次推翻都由一个新检查结果/证据/证词触发，并让主角的专业敏感度成为发现疑点的关键；反转后回看，所有线索早已埋下', techniqueEn: 'Build three layers: surface conclusion (seems obvious) → professional anomaly (one detail that doesn’t fit) → truth (reassembled with expertise); each overturn is triggered by a new test result/evidence/testimony, with the hero’s professional sensitivity spotting the anomaly; in hindsight every clue was planted',
    risk: '反转不能靠隐瞒关键信息骗观众，医学/法律推理要经得起推敲', riskEn: 'Never hide key information to fool the audience; medical/legal reasoning must hold up',
    kw: ['反转', '疑点', '真相', '诊断', '证据链', 'twist', 'diagnosis', 'evidence chain', 'uncover the truth'],
  },
  {
    id: 'work_life_bleed', name: '职业侵入私人生活', nameEn: 'Work bleeds into private life',
    principle: '职业身份会侵入私人关系与情绪：医生见多生死后的麻木、律师的辩论习惯带回家、救援者的创伤，让人物不只是岗位符号', principleEn: 'Professional identity invades relationships and emotion — a doctor’s numbness after witnessing death, a lawyer bringing argument habits home, a rescuer’s trauma — so characters are more than job titles',
    technique: '给主角安排一条与职业强相关的私人困境（因值班失约家庭、因职业习惯与亲人争执、因一次失败留下PTSD），让工作中的选择在私人线产生回响；私人线反过来影响一次职业决策，形成闭环；用生活细节而非自述表现职业烙印', techniqueEn: 'Give the hero a private struggle tightly tied to the job (missing family due to shifts, arguing with kin out of professional habit, PTSD after a failure), and let work choices echo in the private line, which in turn shapes a professional decision to close the loop; show the professional imprint through life details, not self-narration',
    risk: '感情线要服务人物与主题，不能变成与职业无关的悬浮偶像剧', riskEn: 'Romance serves character and theme, never floating idol-drama unrelated to the job',
    kw: ['职业与家庭', '私人生活', '创伤', 'PTSD', '值班', 'work-life', 'personal life', 'trauma', 'burnout'],
  },
  {
    id: 'expertise_payoff', name: '专业即爽点', nameEn: 'Expertise as the payoff',
    principle: '行业剧的爽点不是开挂，而是千万次训练形成的硬本事在关键时刻一击制胜：精准判断、神级操作、当庭翻盘', principleEn: 'The payoff isn’t a cheat power but hard-won mastery from endless training landing at the critical moment — a precise call, a masterful move, a courtroom turnaround',
    technique: '前期埋“枯燥基本功”（反复练习、记背、模拟、被师傅挑剔），关键时刻用一次干净利落的专业操作解决别人解决不了的难题，并让外行角色的反应衬托其含金量；爽点必须有前期训练做支撑，且符合科学与法律规律，不能违背常识开挂', techniqueEn: 'Plant tedious fundamentals early (drills, memorization, simulations, the mentor’s criticism), then at the key moment solve what others couldn’t with one clean expert move, framed by a layperson’s reaction to show its value; the payoff must be earned by prior training and consistent with science and law — never an implausible power-up',
    risk: '专业爽感不能神化到违背行业规律，更不能靠违规操作制造英雄', riskEn: 'Never mythologize expertise beyond industry reality or manufacture heroism through rule-breaking',
    kw: ['专业能力', '高光', '神操作', '翻盘', '硬本事', 'expertise', 'mastery', 'brilliant move', 'courtroom win'],
  },
];
export const VALID_PRO_DEVICES = new Set(PRO_DEVICES.map((d) => d.id));
const BY_ID = new Map(PRO_DEVICES.map((d) => [d.id, d]));

const PRO_HINT = ['医疗', '医生', '医院', '急诊', '抢救', '手术', '外科', '内科', '护士', '麻醉', '律政', '律师', '法官', '法庭', '诉讼', '检察官', '公诉', '消防', '火灾', '救援', '灭火', '民警', '刑警', '警察', '缉毒', '法医', '交警', '职业剧', '行业剧', 'medical', 'hospital', 'doctor', 'surgeon', 'ER', 'emergency room', 'nurse', 'legal drama', 'lawyer', 'attorney', 'courtroom', 'judge', 'prosecutor', 'litigation', 'firefighter', 'fire rescue', 'police', 'detective', 'cop drama', 'forensic', 'procedural drama', 'paramedic'];
export function detectPro(text: string): boolean {
  const t = (text || '').toLowerCase();
  return PRO_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickProDevices(text: string, n = 3): ProDevice[] {
  const t = (text || '').toLowerCase();
  const hit = PRO_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: ProDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：流程真实（可信）+ 伦理两难（高级冲突）+ 专业即爽点（爽感）
  const fallback = ['procedural_flow', 'ethics_dilemma', 'expertise_payoff'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  PRO_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildProDirective(text: string, lang: ProLang = 'zh', n = 3): string {
  if (!detectPro(text)) return '';
  const ds = pickProDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a PROFESSIONAL / INDUSTRY procedural (medical, legal, fire-rescue or police). Make the craft authentic. Use these devices this episode:\n${body}\nHard rules: all procedures, terminology, statutes and medical facts must be accurate and verifiable (never fabricate law or medicine that misleads), never glorify rule-breaking such as vigilante action, illegally obtained evidence or unauthorized medication — violations carry real consequences, do not exploit real disasters or patients’ suffering, heroism is built on training and teamwork rather than lone-wolf rule-breaking, and judicial storylines must respect due process and the rule of law.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为职业行业剧（医疗/律政/消防/刑侦等），专业感是生命线。本集重点使用以下装置：\n${body}\n硬性要求：所有流程、术语、法条、医学常识必须真实可考，绝不编造误导性的法条或医学知识；不美化违规操作（私刑、非法取证、擅自用药等），违规必须承担真实代价；不消费真实灾难与患者痛苦；英雄主义建立在训练与团队之上，不搞孤胆违规神化；涉及司法必须体现程序正义与法治精神。`;
}
