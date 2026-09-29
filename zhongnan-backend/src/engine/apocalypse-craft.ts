/**
 * 科幻末世 / 废土求生机制引擎（v2.22）
 * ------------------------------------------------------------------
 * 第十三套“类型机制引擎”。末世短剧 AI 通病：灾变设定朝令夕改、资源无限像郊游、
 * 威胁跳级崩坏、主角团职能雷同、道德选择非黑即白、纯绝望无希望、反转靠玄学、
 * 血腥猎奇堆砌、坑越挖越大收不回。本模块沉淀 10 套装置（机理+技法+风险），
 * 自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type ApoLang = 'zh' | 'en';
export interface ApoDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const APOCALYPSE_DEVICES: ApoDevice[] = [
  {
    id: 'world_rules', name: '末世设定圣经', nameEn: 'A consistent apocalypse bible',
    principle: '末世剧的地基是一套不朝令夕改的世界规则：灾变成因、异变边界、资源从哪来、秩序剩多少，开篇定死，后续所有剧情都在规则内推演', principleEn: 'The genre’s foundation is a fixed rulebook: cause of the collapse, bounds of mutation, where resources come from and how much order remains; once set, every later plot is deduced inside those rules',
    technique: '大纲阶段先写一页“设定圣经”：灾变时间线、异变体能力边界（能做什么/怕什么）、残存势力地图、硬通货是什么；每次新设定出现先查圣经，需要突破规则必须付出解释与代价，杜绝临时加异能救场', techniqueEn: 'Write a one-page bible in the outline: collapse timeline, mutant ability bounds (what they can do and fear), a map of surviving factions and the hard currency; check the bible before introducing anything new, and any rule break needs an explanation and a price—never a last-minute superpower rescue',
    risk: '规则越少越稳，贪多求全会让观众记不住、后期必吃书', riskEn: 'Fewer rules are sturdier; piling them up confuses viewers and guarantees retcons',
    kw: ['末世', '灾变', '设定', '世界观', '丧尸病毒', '异变', '废土', 'apocalypse', 'post-apocalyptic', 'worldbuilding', 'outbreak', 'collapse'],
  },
  {
    id: 'scarcity_engine', name: '稀缺资源驱动', nameEn: 'Scarcity as the engine',
    principle: '末世的真实感来自“缺”：水、电、药、食物、安全、弹药永远不够，每一集的目标都和某种稀缺绑定，选择才有重量', principleEn: 'The genre feels real through lack: water, power, medicine, food, safety and ammo are never enough, and tying each episode’s goal to a shortage gives choices weight',
    technique: '给每集指定一个“刚需物”并量化（还剩几瓶水、几发子弹、几小时电量），让获取过程构成主线；得到资源必须付出对等代价（冒险、交换、放弃别的），杜绝随手就能翻到补给的便利', techniqueEn: 'Assign each episode one necessity with a number (bottles of water, rounds left, hours of battery) and make obtaining it the spine; every gain costs an equivalent price (risk, trade, a sacrifice) and supplies are never conveniently lying around',
    risk: '稀缺要前后对账，上一集说断水下一集却喝水自由就穿帮', riskEn: 'Scarcity must be tracked consistently; running out of water one episode and drinking freely the next breaks the world',
    kw: ['资源', '缺水', '物资', '短缺', '稀缺', '补给', '硬通货', 'scarcity', 'supplies', 'ration', 'resource', 'shortage'],
  },
  {
    id: 'safe_illusion', name: '安全假象与隐患预埋', nameEn: 'Illusion of safety',
    principle: '观众的喘息来自“看似安全的据点”，而张力来自观众隐约知道这里不安全：在安稳戏里埋下具体隐患，破防时一切都有出处', principleEn: 'Relief comes from a seemingly safe haven while tension comes from sensing it is not: plant concrete threats during the calm so the breach is fully earned',
    technique: '进入避难所/基地后给一段安稳（热饭、洗澡、睡床），同时用两三个反常细节埋雷（紧锁的仓库、回避问题的管理者、夜里的声响）；破防时每个细节都被回收，不靠天降危机', techniqueEn: 'After entering a shelter, grant real comfort (a hot meal, a shower, a bed) while seeding two or three wrong details (a locked warehouse, an evasive leader, night sounds); when it falls, every detail pays off rather than a crisis dropping from nowhere',
    risk: '隐患要给观众看到但角色可以误判，不能把关键信息完全藏起来', riskEn: 'Let the audience see the threat while characters misread it; never hide the key information entirely',
    kw: ['避难所', '安全区', '基地', '据点', '假象', '隐患', 'shelter', 'safe zone', 'haven', 'false safety', 'compound'],
  },
  {
    id: 'threat_ladder', name: '威胁阶梯升级', nameEn: 'A ladder of escalating threat',
    principle: '威胁必须一级级爬：从个体异变到小群、从异变到人心、从生存到立场，每一级都让主角用尽上一级的经验仍险胜，跳级只会让前期努力作废', principleEn: 'Threat climbs rung by rung—single mutant to pack, monsters to human malice, survival to moral stand; at each rung the hero barely wins using prior lessons, and skipping rungs voids earlier effort',
    technique: '大纲列一张威胁升级表（每 5-8 集抬一级），每级明确“比上一级难在哪”（数量/智能/环境/人心），并让主角先吃一次亏再找到新解法；同级威胁不重复制造廉价惊吓', techniqueEn: 'In the outline build a threat ladder (one rung every 5-8 episodes), stating what makes each harder (numbers, intelligence, environment, human betrayal); let the hero lose once before finding a new answer, and avoid repeating the same-level threat for cheap jumpscares',
    risk: '升级不能只靠怪物变大变强，加入环境与人心维度才耐看', riskEn: 'Escalation is not just a bigger monster; weave in environment and human dimensions',
    kw: ['丧尸', '怪物', '威胁', '变异兽', '尸潮', '升级', 'mutant', 'zombie horde', 'threat', 'escalation', 'monster'],
  },
  {
    id: 'base_building', name: '据点养成线', nameEn: 'Base-building progression',
    principle: '末世剧的长线黏性来自“养成”：据点从一处藏身地一步步加固、分工、扩张，观众像看经营游戏一样有投入感和盼头', principleEn: 'Long-term engagement comes from building: the holdout is fortified, staffed and expanded step by step, giving viewers the investment of a management game',
    technique: '给据点设可见的成长刻度（堵门→围墙→通电→种植→瞭望哨），每次升级都用前几集拼来的资源与人物技能兑现；安排一次据点受损再重建，让“家”的得失牵动情绪', techniqueEn: 'Give the base visible milestones (barricade, wall, power, farming, watchtower), each paid for with resources and skills earned in prior episodes; once let the base be damaged and rebuilt so the loss and recovery of “home” land emotionally',
    risk: '经营线必须服务人物与冲突，不能变成流水账式的建设清单', riskEn: 'Building must serve character and conflict, not become a laundry list of construction',
    kw: ['建造', '经营', '围墙', '防御', '营地建设', '种田', 'base building', 'fortify', 'settlement', 'homestead'],
  },
  {
    id: 'moral_dilemma', name: '极端道德两难', nameEn: 'Hard moral dilemmas',
    principle: '末世最扎心的不是怪物而是选择：救一个还是救一群、开门还是关门、分粮还是独存，两难必须两边都有代价，主角既不圣母也不冷血', principleEn: 'What cuts deepest is choice, not monsters: save one or many, open the gate or not, share or hoard. Both sides must cost something, and the hero is neither naively saintly nor cold-blooded',
    technique: '每个关键节点设计“两个都对也都错”的选项，先把两边代价摆到台面上（开门可能害死全队、不开门一个孩子会死），让主角的选择符合其成长弧光并在事后承担后果（愧疚、被质疑、关系裂痕）', techniqueEn: 'At each key node design two options both right and wrong, show both prices first (opening the gate may kill the team; closing it kills a child), let the choice fit the hero’s arc and carry aftermath—guilt, challenge, a cracked relationship',
    risk: '不能用两难给反人类行为洗白，底色仍是守护与人性', riskEn: 'Never use a dilemma to whitewash inhuman behavior; the baseline remains protection of human dignity',
    kw: ['道德', '两难', '抉择', '人性', '救不救', '牺牲', 'moral dilemma', 'hard choice', 'human nature', 'sacrifice choice'],
  },
  {
    id: 'team_roles', name: '小队职能互补', nameEn: 'A team of complementary roles',
    principle: '末世是群像戏：战力、医疗、技术、后勤、情报各有不可替代的职能，缺一环就会出事，团队配合比孤胆英雄更可信也更好看', principleEn: 'Apocalypse is ensemble storytelling: combat, medic, tech, logistics and scout are each irreplaceable; a missing role causes real trouble, and teamwork beats a lone hero',
    technique: '组队阶段就定死每人的“能解决什么/短板是什么”，关键行动必须两到三个岗位配合（技术开门、战力掩护、医疗待命）；安排一次因某人缺位导致的危机，让职能价值被剧情证明，配角不当工具人', techniqueEn: 'When forming the group fix what each member solves and their blind spot; key operations need two or three roles in concert (tech opens the door, combat covers, medic stands by); once stage a crisis caused by one role’s absence to prove its value, and never reduce side characters to tools',
    risk: '人多要控场，核心小队建议 4-6 人，观众才记得住', riskEn: 'Keep the core team to 4-6 so the audience can track them',
    kw: ['小队', '团队', '队友', '组队', '分工', '群像', 'squad', 'team roles', 'crew', 'ensemble'],
  },
  {
    id: 'hope_anchor', name: '绝望中的希望锚点', nameEn: 'A hope anchor in despair',
    principle: '末世可以黑，但不能让人看不到头：一个具体的希望锚点（找到亲人、疫苗线索、北方安全区）牵引主角和观众一路走下去，微光比强行大团圆更有力', principleEn: 'The world may be dark but never hopeless: one concrete anchor—finding family, a vaccine lead, a northern safe zone—pulls hero and viewer forward, and a faint glow beats a forced happy ending',
    technique: '开篇立一个可执行的长期目标并拆成阶段性坐标（先出城、再到中转站、最后抵达），每 3-5 集让目标靠近一点或被推翻再重建；用人物之间的小温情（半块饼干、一句承诺）做即时希望，避免持续压抑导致弃剧', techniqueEn: 'Set an actionable long-term goal up front, split into milestones (leave the city, reach the relay, arrive at the end) and advance or rebuild it every 3-5 episodes; use small human warmth (half a biscuit, a promise) as instant hope so sustained bleakness does not drive viewers away',
    risk: '希望不能廉价，目标兑现前必须有真实牺牲与努力', riskEn: 'Hope is not cheap; real sacrifice and effort must precede any payoff',
    kw: ['希望', '疫苗', '安全区', '找亲人', '活下去', '微光', 'hope', 'vaccine', 'safe zone', 'find family', 'survive'],
  },
  {
    id: 'sci_twist', name: '科幻反转讲机理', nameEn: 'Mechanism-driven sci-fi twists',
    principle: '末世的好反转是“原来如此”而非“闹鬼了”：异变原理、灾变真相、人物身份的反转都要能用已建立的科学/设定逻辑解释，伏笔回收带来智力快感', principleEn: 'A strong genre twist says “so that’s why,” not “it was supernatural”: mutation mechanics, outbreak truth and identity reversals must be explainable through established rules, paying off earlier clues',
    technique: '反转前埋至少两条符合设定逻辑的线索（实验日志、异常数据、一句被忽略的话），揭晓时用设定机理解释而不是新增玄学；灾变真相尽量与人性/利益相关（实验失控、人为隐瞒），比天降陨石更有戏剧张力', techniqueEn: 'Plant at least two rule-consistent clues (a lab log, anomalous data, an overlooked line) and explain the reveal through established mechanics rather than new mysticism; tie the outbreak truth to human motives—a failed experiment, a cover-up—which is more dramatic than a random meteor',
    risk: '科设可以软但必须自洽，不能一半科学一半玄学', riskEn: 'The science may be soft but must stay self-consistent, never half science half magic',
    kw: ['真相', '反转', '实验', '病毒来源', '伏笔', '科学原理', 'twist', 'reveal', 'lab', 'virus origin', 'lore reveal'],
  },
  {
    id: 'scale_convergence', name: '世界观有序收束', nameEn: 'Orderly convergence of scale',
    principle: '末世最容易烂尾在“越铺越大收不回”：势力、谜团、地图要有计划地合并收束，每填一个坑再开一个小坑，结局闭环而不是无限升级', principleEn: 'The genre’s worst failure is endless expansion: factions, mysteries and maps must merge and converge on schedule, closing a pit before opening a small new one so the finale resolves instead of inflating forever',
    technique: '大纲阶段就列“谜团-回收”对照表，标注每个坑的埋设与回收集；中后期主动合并势力（两股敌人合流、两个据点合一）压缩战线，最终季把核心问题（灾变/亲人/归宿）逐一回答，留白只留一个余味钩子', techniqueEn: 'Keep a mystery-payoff ledger in the outline with plant and payoff episodes; in the mid-to-late act merge factions and settlements to compress the board, and in the final arc answer the core questions (outbreak, family, home) one by one, leaving at most one lingering hook',
    risk: '战力与危机规模也要收束，避免结局还要靠更大的怪物救场', riskEn: 'Power and crisis scale must converge too; never rescue the finale with an even bigger monster',
    kw: ['收束', '结局', '闭环', '填坑', '谜团', '大结局', 'convergence', 'finale', 'pay off', 'resolve arcs'],
  },
];

export const VALID_APOCALYPSE_DEVICES = new Set(APOCALYPSE_DEVICES.map((d) => d.id));
const BY_ID = new Map(APOCALYPSE_DEVICES.map((d) => [d.id, d]));

const APO_HINT = ['末世', '废土', '丧尸', '僵尸', '末日', '灾变', '异变', '变异兽', '幸存者', '避难所', '安全区', '尸潮', '求生', '生存末日', '末世重生', '全球灾变', '极寒末日', '洪涝末日', '迷雾末日', 'apocalypse', 'post-apocalyptic', 'zombie', 'undead', 'wasteland', 'survival horror', 'end of the world', 'mutant outbreak', 'dystopian survival'];
export function detectApocalypse(text: string): boolean {
  const t = (text || '').toLowerCase();
  return APO_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickApocalypseDevices(text: string, n = 3): ApoDevice[] {
  const t = (text || '').toLowerCase();
  const hit = APOCALYPSE_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: ApoDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：设定圣经（地基）+ 稀缺驱动（张力）+ 希望锚点（追看）
  const fallback = ['world_rules', 'scarcity_engine', 'hope_anchor'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  APOCALYPSE_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildApocalypseDirective(text: string, lang: ApoLang = 'zh', n = 3): string {
  if (!detectApocalypse(text)) return '';
  const ds = pickApocalypseDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a SCI-FI APOCALYPSE / WASTELAND SURVIVAL drama. Engineer scarcity, dread and hope deliberately. Use these devices this episode:\n${body}\nHard rules: the outbreak rules and mutant bounds stay consistent with no retcons or last-minute superpower rescues; resources are tracked and never conveniently infinite; threats escalate rung by rung; moral dilemmas cost both sides without glorifying inhuman behavior; keep violence non-graphic with no gory spectacle and never map the fictional disaster onto real-world groups; the science may be soft but must be self-consistent, mysteries converge on schedule, and a concrete hope anchor keeps the story from despair.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为科幻末世/废土求生剧，稀缺、压迫与希望都要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：灾变规则与异变边界前后一致、不吃书，不靠临时异能救场；资源全程对账、绝不随手无限；威胁逐级升级不跳级；道德两难两边都有代价，但不为主角或任何反人类行为洗白；暴力点到为止、不渲染血腥猎奇，虚构灾难不影射现实特定群体；科设可软但必须自洽、不掺玄学，谜团有序收束不烂尾，并始终保留一个具体的希望锚点，避免纯绝望。`;
}
