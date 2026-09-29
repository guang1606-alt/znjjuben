/**
 * 军旅特战 / 现代军事机制引擎（v2.23）
 * ------------------------------------------------------------------
 * 第十四套“类型机制引擎”。军旅剧 AI 通病：指挥链形同虚设、战术动作神剧化、
 * 子弹永远打不完、新兵一夜成神、对手集体弱智、牺牲被消费、家国全靠喊口号、
 * 涉密装备瞎编参数、军民关系失真。本模块沉淀 10 套装置（机理+技法+风险），
 * 自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type MilLang = 'zh' | 'en';
export interface MilDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const MILITARY_DEVICES: MilDevice[] = [
  {
    id: 'chain_command', name: '军令层级与临机张力', nameEn: 'Chain of command vs field judgment',
    principle: '军旅戏的真实感来自层级：谁下命令、谁执行、谁负责清清楚楚，而“将在外”的临机决断与服从军令之间的拉扯，正是人物成色的试金石', principleEn: 'Military realism rests on hierarchy: who orders, who executes and who answers is clear, and the tension between obeying orders and field judgment tests a character’s mettle',
    technique: '行动前明确指挥关系（谁是现场最高指挥员），命令用任务式语言（目标、时限、约束）；需要抗命/变通时，先让角色承担抗命后果（处分、写检查、战后复盘），再让临机决断被结果证明对错，绝不“想怎么打就怎么打”', techniqueEn: 'Establish the chain before action (who holds field command) and phrase orders as mission-type language (objective, deadline, constraints); when a character disobeys or adapts, make him bear the consequence first (disciplinary action, a review) before results justify him—never let anyone fight however they please',
    risk: '层级不能只在台词里提，部署、通信、汇报都要体现，否则像穿军装的黑帮', riskEn: 'Hierarchy must show in deployment, comms and reporting, not just dialogue, or the unit reads like a gang in uniform',
    kw: ['军令', '指挥', '部队', '连队', '特种兵', '作战命令', '首长', 'military', 'command', 'chain of command', 'squad', 'special forces'],
  },
  {
    id: 'brotherhood', name: '战友情群像', nameEn: 'Band-of-brothers ensemble',
    principle: '军旅的情感底座是“过命的交情”：战友各有战斗岗位与性格短板，一起扛过事才成立，群像比孤胆英雄更动人', principleEn: 'The emotional bedrock is bonds forged under fire: each comrade has a combat role and a flaw, and brotherhood is earned together, making ensemble more moving than a lone hero',
    technique: '班组按岗位配齐（尖兵、火力、爆破、通信、卫生员）并给每人一个生活化标签（爱吃啥、怕啥、惦记谁）；用 2-3 场共同扛事的戏（拉练、误事被一起罚、战场互相掩护）把交情“存”起来，后面的离别与托付才有重量', techniqueEn: 'Staff the fireteam by role (point, gunner, breacher, comms, medic) with one life tag each (favorite food, fear, someone back home); “deposit” the bond in 2-3 shared trials (a march, punishment for one mistake, covering each other) so later farewells land',
    risk: '核心班组控制在 5-7 人，人物过多观众记不住谁牺牲了', riskEn: 'Keep the core team to 5-7 so the audience feels each loss',
    kw: ['战友', '兄弟', '班长', '班组', '老兵', '新兵连', 'comrade', 'brotherhood', 'squadmate', 'platoon', 'veteran'],
  },
  {
    id: 'mission_loop', name: '任务简报闭环', nameEn: 'Mission brief-to-debrief loop',
    principle: '军事行动的专业感来自闭环：行动前有简报（情报、目标、预案、撤退路线），行动后有复盘，计划与变数前后对账，观众看得懂仗是怎么打的', principleEn: 'Operational professionalism comes from a closed loop: a brief beforehand (intel, objective, contingencies, extraction) and a debrief after, reconciling plan against change so the audience follows the fight',
    technique: '每场行动用“简报-执行-复盘”三段式：简报交代目标与最坏情况预案，执行中让至少一个预案失效逼出现场判断，复盘点明哪里打对、哪里侥幸；情报错误要成为变数来源而不是主角开天眼', techniqueEn: 'Shape each operation as brief-execute-debrief: the brief states objective and worst-case plans, execution breaks at least one plan to force field judgment, the debrief names what worked and what was luck; bad intel—not hero omniscience—drives surprises',
    risk: '简报不能写成说明书念稿，用地图、手势、对话自然带出', riskEn: 'Never deliver the brief as a recited manual; convey it through map, gesture and dialogue',
    kw: ['任务', '简报', '作战计划', '撤退', '预案', '复盘', 'mission', 'briefing', 'extraction', 'contingency', 'debrief'],
  },
  {
    id: 'tactical_realism', name: '战术动作可信', nameEn: 'Credible small-unit tactics',
    principle: '不拍神剧：火力压制、交替掩护、利用地形、清点房间、无线电呼号都符合常识，胜利靠配合与地形，而不是主角刀枪不入', principleEn: 'No fantasy combat: suppressing fire, bounding overwatch, use of terrain, room clearing and radio calls follow common sense; victory comes from teamwork and terrain, not an invulnerable hero',
    technique: '写枪战前先画地形（哪里有掩体、射界、退路），用“压制-迂回-夹击”的配合推进；弹药、伤亡、体力都是有限资源并前后对账；主角会中弹、会被压制、会呼叫支援，以少胜多必须给出地形、情报或火力支援的明确依据', techniqueEn: 'Map the ground before the firefight (cover, fields of fire, retreat) and advance via suppress-flank-pinch teamwork; treat ammo, casualties and stamina as finite tracked resources; the hero can be hit, pinned and need support, and any outnumbered win needs explicit grounds in terrain, intel or fire support',
    risk: '不杜撰真实涉密装备参数，型号拿不准就用泛称，避免错误军事细节', riskEn: 'Do not fabricate classified real-world specs; use generic terms when unsure to avoid technical errors',
    kw: ['战术', '火力压制', '掩护', '射击', '突袭', '反恐', 'tactics', 'suppressing fire', 'overwatch', 'raid', 'room clearing', 'firefight'],
  },
  {
    id: 'training_payoff', name: '训练伏笔回收', nameEn: 'Training planted and paid off',
    principle: '战场上的高光不是临场开挂：平时反复练的动作、记的地图、磨的配合，在关键时刻救命，训练戏与战斗戏形成伏笔闭环', principleEn: 'Battlefield brilliance is never a sudden power-up: a drill repeated, a map memorized or teamwork honed in training saves the day later, closing a plant-payoff loop',
    technique: '前期安排看似枯燥的训练（拆装枪计时、方位角越野、协同手语、抗审讯），并点出主角当时的短板；关键战斗让他正是靠这项训练过关，回收时给一个与训练时呼应的动作或台词', techniqueEn: 'Early on show seemingly dull drills (timed weapon breakdown, compass navigation, hand signals, resistance training) and the hero’s weak spot; in the key fight he survives precisely through that drill, echoed by a matching gesture or line',
    risk: '训练篇幅要短而具体，避免整集军训教学片', riskEn: 'Keep training scenes short and concrete; avoid a whole episode of instructional drills',
    kw: ['训练', '演习', '拉练', '比武', '考核', 'training', 'drill', 'exercise', 'qualification'],
  },
  {
    id: 'civilian_line', name: '群众纪律与军民关系', nameEn: 'Discipline and the civilian bond',
    principle: '人民军队的底色是纪律与民心：不拿群众一针一线、遇险先护百姓，军民关系的细节让“为谁而战”落到实处，而不是悬空说教', principleEn: 'A people’s army is defined by discipline and civilian trust: protect residents first and take nothing, grounding “whom we fight for” in concrete detail rather than sermon',
    technique: '安排一场军民相处的戏立住纪律（借东西打欠条、撤离帮收庄稼、宁可露宿不扰民），再在危机时刻让百姓的回报成为合理助力（带路、报信）；军民互助必须双向且有铺垫，不搞天降群众', techniqueEn: 'Stage a scene that establishes discipline (an IOU for borrowed goods, helping with harvest before withdrawal, camping out rather than disturbing residents), then let civilian help in crisis feel earned (guidance, warning); mutual aid must be two-way and seeded, never a convenient mob',
    risk: '群众不能成为工具人背景板，给一两个有名字、有态度的百姓', riskEn: 'Civilians are not backdrop; give one or two named, opinionated residents',
    kw: ['群众', '老百姓', '军民', '纪律', '乡亲', '村民', 'civilian', 'villagers', 'discipline', 'people'],
  },
  {
    id: 'boots_growth', name: '新兵成长弧', nameEn: 'The rookie’s growth arc',
    principle: '从怕到敢、从散到齐要有过程：靠班长带教、事件淬炼与一次次小选择累积，成长可信才有共鸣，突变式变强是神剧通病', principleEn: 'Growth from fear to courage and chaos to cohesion is a process built through mentorship, trials and accumulated small choices; credible growth resonates while instant mastery is the genre’s cliché',
    technique: '给新兵一个具体的“怕”（怕枪声、怕黑、怕对不起家里），前段让他出一次真实的丑或失误，再通过班长的一次带教、一次硬着头皮顶上的小胜利逐步转变；每次成长只跨一小步，最终高光前他已具备能力与心理依据', techniqueEn: 'Give the rookie a concrete fear (gunfire, darkness, letting family down), let him fail early, then transform through a mentor’s lesson and one reluctant small win at a time; he crosses only a small step each time, so his eventual heroism has both skill and psychological grounds',
    risk: '带教不是灌鸡汤，老班长要用行动和具体方法教', riskEn: 'Mentorship is not pep talks; the veteran teaches through action and concrete method',
    kw: ['新兵', '成长', '入伍', '老兵带新兵', '蜕变', 'rookie', 'recruit', 'growth arc', 'boot camp'],
  },
  {
    id: 'worthy_foe', name: '专业而值得尊重的对手', nameEn: 'A professional, worthy adversary',
    principle: '对手越专业，胜利越有分量：敌方也会侦察、设伏、断退路、打配合，赢强敌靠实力与牺牲，把敌人写蠢只会让胜利贬值', principleEn: 'The more professional the foe, the more victory weighs: the enemy also scouts, ambushes, cuts retreats and coordinates, so beating them takes skill and sacrifice; stupid enemies cheapen the win',
    technique: '给敌方指挥官一个清晰的作战逻辑与一次得手（让主角吃亏），交锋中体现双方互相预判；最终胜利来自找到对方逻辑的破绽，而不是对方突然犯错送死', techniqueEn: 'Give the enemy commander a clear operational logic and one success that hurts the hero, with mutual anticipation across clashes; the final win exploits a flaw in that logic rather than relying on the foe suddenly blundering to his death',
    risk: '不丑化特定民族/地域群体，对立止于立场与行为，不搞血统脸谱化', riskEn: 'Never demean an ethnicity or region; opposition stays at the level of stance and action, not caricature',
    kw: ['对手', '敌方', '敌人', '较量', '博弈', 'adversary', 'enemy', 'worthy foe', 'opponent'],
  },
  {
    id: 'sacrifice_weight', name: '牺牲有重量', nameEn: 'Death that carries weight',
    principle: '牺牲不是煽情工具：角色牺牲后，他的承诺、岗位、未竟之事会持续影响活着的人，悲痛转化为行动，观众才真正记住他', principleEn: 'Death is not a tear-jerking device: after a sacrifice, the character’s promise, role and unfinished business keep shaping the living, and grief converts into action',
    technique: '重要牺牲前先立住他的牵挂（等他回家的人、没说完的话、一个具体愿望），牺牲时克制不堆砌血腥，重点写战友后续的变化（接过岗位、完成约定、改掉毛病）；避免连续发便当把死亡通胀', techniqueEn: 'Before a major death establish what tethers him (someone waiting home, an unfinished sentence, a specific wish); stage it with restraint rather than gore and focus on how comrades change after (taking his post, keeping the promise, fixing a flaw); avoid death inflation through constant disposable kills',
    risk: '不渲染残肢血腥，悲壮靠情感与选择，不靠猎奇画面', riskEn: 'Do not dwell on gore; heroism comes from emotion and choice, not spectacle',
    kw: ['牺牲', '阵亡', '烈士', '就义', '缅怀', 'sacrifice', 'killed in action', 'fallen', 'memorial'],
  },
  {
    id: 'grounded_patriotism', name: '家国情落到具体选择', nameEn: 'Patriotism through concrete choice',
    principle: '家国情怀不靠口号密度：把“守护”拆成一个个具体选择（先救群众还是先追敌、探亲假被召回），人物用行动回答为谁扛枪，比十句宣言有力', principleEn: 'Patriotism is not slogan density: break protection into concrete choices (civilians first or pursuit first, a recalled leave), letting actions answer why he serves—more powerful than ten declarations',
    technique: '每集最多一次点题，且必须落在两难选择或具体行动上（让出仅剩的干粮、把防弹背心压到孩子身上、家书里报喜不报忧）；口号让配角和环境去说，主角用沉默的行动表态', techniqueEn: 'State the theme at most once per episode, always through a dilemma or concrete action (giving away the last ration, pressing the vest onto a child, a reassuring letter home); let supporting characters and setting carry slogans while the lead speaks through quiet action',
    risk: '避免空喊与过度拔高，真实的犹豫让信仰更可信', riskEn: 'Avoid empty slogans and over-inflation; honest hesitation makes conviction more credible',
    kw: ['家国', '爱国', '守护', '信仰', '为人民', '使命', 'patriotism', 'duty', 'protect', 'service'],
  },
];

export const VALID_MILITARY_DEVICES = new Set(MILITARY_DEVICES.map((d) => d.id));
const BY_ID = new Map(MILITARY_DEVICES.map((d) => [d.id, d]));

const MIL_HINT = ['军旅', '特种兵', '部队', '军人', '连队', '军营', '当兵', '退伍军人', '武警', '特战', '解放军', '军校', '新兵', '剿匪', '边境巡逻', '现代军事', 'military drama', 'special forces', 'army', 'soldier', 'platoon', 'military training', 'counter-terror unit'];
export function detectMilitary(text: string): boolean {
  const t = (text || '').toLowerCase();
  return MIL_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickMilitaryDevices(text: string, n = 3): MilDevice[] {
  const t = (text || '').toLowerCase();
  const hit = MILITARY_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: MilDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：指挥层级（地基）+ 战术可信（专业感）+ 战友情（情感）
  const fallback = ['chain_command', 'tactical_realism', 'brotherhood'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  MILITARY_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildMilitaryDirective(text: string, lang: MilLang = 'zh', n = 3): string {
  if (!detectMilitary(text)) return '';
  const ds = pickMilitaryDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a MODERN MILITARY / SPECIAL-FORCES drama. Engineer professionalism, brotherhood and duty deliberately. Use these devices this episode:\n${body}\nHard rules: respect the chain of command and make insubordination carry consequences, tactics must be credible with finite ammo and no invulnerable hero (no “war god” fantasy), never fabricate classified real-world equipment parameters, the adversary is professional rather than stupid, sacrifice stays non-graphic and keeps resonating, the unit protects civilians by discipline, and patriotism is shown through concrete choices rather than slogans, with no glorification of war.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为现代军旅/特战剧，专业感、战友情与使命感要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：指挥层级清晰、抗命变通必担后果；战术动作可信，弹药体力有限、主角不神剧、不刀枪不入，以少胜多必须给地形/情报/火力依据；不杜撰真实涉密装备参数；对手专业不弱智，胜利靠实力；牺牲克制不渲染血腥且影响持续；严守群众纪律、军民关系有铺垫；家国情靠具体选择而非口号密度，不美化战争。`;
}
