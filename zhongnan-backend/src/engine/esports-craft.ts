/**
 * 游戏电竞 / 体育竞技机制引擎（v2.23）
 * ------------------------------------------------------------------
 * 第十五套“类型机制引擎”。竞技类短剧 AI 通病：规则外行硬伤、训练看不见成长、
 * 比赛靠剪辑糊弄、翻盘无过程、对手纸糊、团队变单人秀、术语堆砌不解释、
 * 职业压力与伤病缺失、沾赌沾假赛价值观歪、胜利廉价。本模块沉淀 10 套装置
 * （机理+技法+风险），自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type EspLang = 'zh' | 'en';
export interface EspDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const ESPORTS_DEVICES: EspDevice[] = [
  {
    id: 'rule_mastery', name: '规则数据内行可信', nameEn: 'Rules and stats a pro would respect',
    principle: '竞技剧第一关是“内行不挑错”：赛制、段位、位置、数据准确，观众里的玩家/球迷才会信，外行也能被带着看懂', principleEn: 'The first hurdle is insider credibility: format, ranks, positions and stats must be accurate so playing fans believe and outsiders can follow',
    technique: '动笔前列一页“规则卡”：赛制（BO几/积分/淘汰）、核心位置与职责、3-5 个关键数据指标；剧中用人物对话或解说自然解释规则，一次只讲一个；拿不准的版本细节用泛称，不编造不存在的机制', techniqueEn: 'Before writing, make a rules card: format (best-of, points, elimination), positions and duties, and 3-5 key stats; explain one rule at a time through dialogue or commentary, and use generic terms for uncertain version details rather than inventing mechanics',
    risk: '规则解释不能变解说说明书，融进冲突与人物情绪里', riskEn: 'Never turn explanation into a manual; fold it into conflict and emotion',
    kw: ['电竞', '比赛', '段位', '赛制', '联赛', '战队', '体育', '球场', 'esports', 'match', 'rank', 'league', 'tournament', 'sports'],
  },
  {
    id: 'training_visible', name: '训练量可视化', nameEn: 'Visible training mileage',
    principle: '天赋之外必须看得见汗水：把训练拆成可量化的指标（手速、命中率、跑位、体能），成长有刻度，高光才有资格', principleEn: 'Beyond talent, effort must be visible: break training into quantifiable metrics (APM, accuracy, positioning, fitness) so growth has clear milestones and highlights feel earned',
    technique: '给主角定一个可量化短板与目标值（手速从 180 到 260、三分命中率、负重配速），用 2-3 个短镜头/细节呈现加练过程与平台期，数据曲线在关键赛前刚好达标或差一点，不靠一句“他很努力”交代', techniqueEn: 'Set a quantifiable weakness and target (APM 180 to 260, three-point rate, weighted pace), show grind and plateau in 2-3 short beats, and have the metric just reach—or miss—the mark before the key match instead of asserting “he worked hard”',
    risk: '训练蒙太奇要短，指标别一次抛太多，抓一个最有代表性的', riskEn: 'Keep training montages short and focus on one signature metric',
    kw: ['训练', '手速', '加练', '体能', '复盘', '苦练', 'practice', 'training', 'grind', 'aim training', 'scrim'],
  },
  {
    id: 'rival_mirror', name: '宿敌即镜像', nameEn: 'The rival as a mirror',
    principle: '最好的宿敌是“另一种可能的自己”：同样天赋、不同选择（天赋派/努力派、单干/团队），击败宿敌本质是主角与自己另一条路的和解', principleEn: 'The best rival is another version of the self: equal talent, different choice (natural vs grinder, solo vs team), so beating him is reconciling with the road not taken',
    technique: '给宿敌一套与主角对称的设定（同期出道、相似出身、关键岔路选择不同），安排三次交锋梯度（惨败→惜败→终局），每次交锋让主角从对手身上照见自己的一个问题；终局赢在成长而非数值碾压', techniqueEn: 'Give the rival a symmetric setup (same debut era and roots, a different fork), stage three graded clashes (rout, nail-biter, finale), each revealing one of the hero’s own flaws; the final win comes from growth, not stat-crushing',
    risk: '宿敌不能纯坏，给他自洽的逻辑与尊严', riskEn: 'The rival is not purely evil; give him coherent logic and dignity',
    kw: ['宿敌', '对手', '决赛', '恩怨', '宿敌之战', 'rival', 'nemesis', 'grudge match', 'final'],
  },
  {
    id: 'team_position', name: '位置哲学与团队配合', nameEn: 'Position philosophy and teamwork',
    principle: '团队竞技的魅力是“位置即性格”：每个位置有它的职责哲学与牺牲，胜利靠体系运转，明星球也要建立在队友拉扯出的空间上', principleEn: 'Team sports shine when position is personality: each role carries a philosophy and a sacrifice, victory runs through the system, and even a star play rests on space created by teammates',
    technique: '为每名主力写清“位置职责+性格映射”（指挥位冷静、突破手激进、辅助位默默牺牲），关键团战/进攻用两到三人的连锁配合完成（掩护→牵扯→致命一击），并安排一次“个人英雄主义失败、团队配合取胜”的对照', techniqueEn: 'Define each starter’s role and matching temperament (calm IGL, aggressive entry, selfless support), resolve key fights through 2-3 player chains (screen, pull, finish), and stage a contrast where solo heroism fails and teamwork wins',
    risk: '阵容人数控制在观众记得住的范围，替补与教练各有功能', riskEn: 'Keep the roster memorable; give bench and coach clear functions',
    kw: ['队友', '配合', '位置', '阵容', '战术体系', '团队', 'teamwork', 'rotation', 'lineup', 'composition', 'synergy'],
  },
  {
    id: 'comeback_curve', name: '逆风翻盘曲线', nameEn: 'A staged comeback curve',
    principle: '翻盘最忌一步到位：把大逆风拆成“止血→追分→僵持→反超”几个台阶，每一步都靠具体操作与决策，观众的情绪才被一步步推到顶点', principleEn: 'A comeback never happens in one leap: break a deficit into stem-the-bleeding, catch-up, deadlock and go-ahead stages, each earned through concrete plays so emotion climbs rung by rung',
    technique: '先量化落后差距（经济差 5000、落后两局、比分 0:2），再设计每个台阶的关键动作（一次抢龙/一个暂停调整/一次换人），反超前安排一次“差点翻盘失败”的挫折，最后一分用前面练过的配合兑现', techniqueEn: 'Quantify the hole first (a 5k gold deficit, two games down, 0-2), design each rung’s key action (an objective steal, a timeout adjustment, a substitution), insert a near-failed comeback before the go-ahead, and close with teamwork trained earlier',
    risk: '翻盘不能靠对手突然送，对方要持续施压到最后一刻', riskEn: 'Never let the foe gift the comeback; they must press until the last moment',
    kw: ['翻盘', '逆风', '落后', '反超', '让一追三', '绝杀', 'comeback', 'deficit', 'clutch', 'reverse sweep', 'go-ahead'],
  },
  {
    id: 'clutch_setup', name: '关键操作有铺垫', nameEn: 'Set up the clutch play',
    principle: '封神操作不是天降：高光动作的手法、习惯、甚至失败前科都要提前铺，终局那一下是“原来他练的就是这一手”的回收', principleEn: 'A legendary play never drops from nowhere: its technique, habit and even prior failure are seeded, so the finale pays off as “that’s what he was drilling”',
    technique: '为主角准备 1 个招牌操作并在训练/小赛里先出现两次（一次失败、一次差点成功），交代它的操作原理与代价（手会伤、需要队友给窗口），决赛高压下才完整兑现；解说与队友反应烘托，但操作过程写清楚', techniqueEn: 'Give the hero one signature move shown twice earlier in practice or a minor match (once failing, once near-miss), explain its mechanics and cost (a wrist injury, needing a teammate’s window), then fully cash it under finals pressure; let commentary and reactions amplify while the play stays clear',
    risk: '招牌操作别超过 1-2 个，多了就不值钱', riskEn: 'Limit signature moves to 1-2 or they lose value',
    kw: ['操作', '高光', '名场面', '关键球', '手速', 'clutch', 'highlight', 'signature play', 'game-winning shot'],
  },
  {
    id: 'meta_game', name: '版本理解与战术博弈', nameEn: 'Meta reading and tactical chess',
    principle: '高水平竞技是“赛前就开始”的博弈：BP/阵容克制、战术布置、针对与反针对，教练层的智斗让胜负在操作之外多一层智力快感', principleEn: 'High-level competition starts before the game: draft and counter-pick, game plans, targeting and counter-targeting add a layer of chess beyond mechanics',
    technique: '赛前用一场简短的战术会交代双方的“胜负手”（对方核心是谁、用什么体系克制），比赛中安排一次战术被识破、一次将计就计；让一次 BP/换人上的预判成为翻盘伏笔，体现“用脑子赢”', techniqueEn: 'In a short prep scene state both sides’ deciding factors (their carry, our counter-system), then have one tactic read and one counter-feint during play; let a draft or substitution foreshadow the comeback to show winning with the mind',
    risk: '战术博弈要让外行看得懂，用比喻和画面化表达', riskEn: 'Make tactical chess legible to outsiders through metaphor and visual action',
    kw: ['bp', 'ban pick', '战术', '克制', '版本', '教练', '布置', 'draft', 'meta', 'game plan', 'counter', 'coach'],
  },
  {
    id: 'pressure_cost', name: '心态伤病与职业压力', nameEn: 'Pressure, injury and the pro’s cost',
    principle: '职业之路有代价：手伤腰伤、状态起伏、舆论网暴、年龄与退役焦虑，让人物在赛场外也立得住，胜利才不悬浮', principleEn: 'Going pro has a price: wrist and back injuries, slumps, online abuse, age and retirement anxiety—life outside the game grounds the character so victory is not weightless',
    technique: '给主力至少一条场外压力线（旧伤复发、家里不理解、合同与资本、替补竞争），让它在关键赛节点发作并影响临场决策；人物带着问题上场、在比赛中与自己和解，压力线与比赛线互为隐喻', techniqueEn: 'Give a starter at least one off-stage pressure line (a recurring injury, family opposition, contract/capital, bench competition) that flares at a key match and shapes decisions; he plays carrying the problem and reconciles it in-game, the two lines mirroring each other',
    risk: '压力线为比赛服务，不喧宾夺主、不撒狗血', riskEn: 'Pressure lines serve the match; do not let them hijack or turn melodramatic',
    kw: ['手伤', '伤病', '压力', '状态', '网暴', '退役', '焦虑', 'injury', 'burnout', 'slump', 'pressure', 'retirement'],
  },
  {
    id: 'ecosystem_offstage', name: '赛场外生态与底线', nameEn: 'Off-stage ecosystem and red lines',
    principle: '真实的竞技圈有直播、粉丝、资本、转会与诱惑：写生态让世界变厚，但假赛、赌球、代打是红线，主角必须在诱惑前守住职业底线', principleEn: 'A real competitive world has streaming, fans, capital, transfers and temptation that thicken the world, but match-fixing, betting and boosting are red lines; the hero must hold professional integrity when tempted',
    technique: '用一两个配角呈现生态（运营、主播、经理、赞助商），安排一次具体诱惑（收钱放水、打假球、买分）并让主角付出代价拒绝；灰色可以呈现过程，但价值落点必须清晰：假赛必被惩处、努力比捷径长久', techniqueEn: 'Use a supporting character or two to show the ecosystem (operations, streamer, manager, sponsor), stage one concrete temptation (throw for money, fix a match, buy rank) and let the hero refuse at a cost; gray process is allowed, but the value landing is clear—fixing is punished and effort outlasts shortcuts',
    risk: '不展示可操作的赌博/作弊细节，不美化假赛；涉及未成年要导向健康防沉迷', riskEn: 'Do not show actionable gambling or cheating detail, never glorify fixing, and steer minors toward healthy play',
    kw: ['直播', '粉丝', '资本', '转会', '假赛', '赌', '合同', '赞助商', 'streaming', 'transfer', 'match-fixing', 'sponsor', 'contract'],
  },
  {
    id: 'dream_price', name: '梦想有价兑现不轻', nameEn: 'A dream that costs and pays honestly',
    principle: '逐梦要有取舍：放弃学业、背井离乡、收入不稳、关系让步，把代价写实，最终的奖杯/冠军才真正值钱，而不是喊着热爱就白给', principleEn: 'A dream demands trade-offs: schooling set aside, leaving home, unstable income, strained relationships; when costs are real, the trophy is worth something instead of being granted for “passion”',
    technique: '开篇立梦想的同时立清账单（要放弃什么、失败了怎么办、谁在反对、谁在托底），中段安排一次“值不值得”的至暗时刻让主角动摇，最终夺冠后用一个细节回应最初的代价（与反对者和解、给托底的人报喜），完成情感闭环', techniqueEn: 'When setting the dream, also set the bill (what is sacrificed, the fallback, who opposes, who supports); mid-story stage a darkest-hour “is it worth it” crisis, and after the title echo the opening cost through one detail (reconciliation, calling the supporter home) to close the emotional loop',
    risk: '结局可以有遗憾（亚军、退役），但人物弧光必须完整，不为大团圆硬凑', riskEn: 'A bittersweet ending (runner-up, retirement) is fine if the arc is complete; never force a happy result',
    kw: ['梦想', '冠军', '逐梦', '热爱', '坚持', '夺冠', 'dream', 'champion', 'title', 'passion', 'persevere'],
  },
];

export const VALID_ESPORTS_DEVICES = new Set(ESPORTS_DEVICES.map((d) => d.id));
const BY_ID = new Map(ESPORTS_DEVICES.map((d) => [d.id, d]));

const ESP_HINT = ['电竞', '战队', '职业选手', '打职业', '比赛冠军', '决赛局', '电竞战队', '游戏比赛', '篮球比赛', '足球比赛', '体育竞技', '运动员', '联赛冠军', '奥运', '青训', 'esports', 'pro gamer', 'esports team', 'competitive gaming', 'tournament final', 'sports drama', 'athlete', 'championship league'];
export function detectEsports(text: string): boolean {
  const t = (text || '').toLowerCase();
  return ESP_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickEsportsDevices(text: string, n = 3): EspDevice[] {
  const t = (text || '').toLowerCase();
  const hit = ESPORTS_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: EspDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：规则可信（地基）+ 翻盘曲线（爽感）+ 团队配合（类型魂）
  const fallback = ['rule_mastery', 'comeback_curve', 'team_position'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  ESPORTS_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildEsportsDirective(text: string, lang: EspLang = 'zh', n = 3): string {
  if (!detectEsports(text)) return '';
  const ds = pickEsportsDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is an ESPORTS / COMPETITIVE SPORTS drama. Engineer credibility, comeback tension and teamwork deliberately. Use these devices this episode:\n${body}\nHard rules: rules, ranks and stats must be accurate with rules folded into action not lectures, show quantifiable training and staged comebacks (never one leap, never a foe gifting the game), wins run through the team system rather than a one-man show, give the rival dignity, show the cost of going pro (injury, pressure), never depict actionable gambling or glorify match-fixing and steer minors to healthy play, and make the dream’s payoff honestly earned.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为游戏电竞/体育竞技剧，专业可信、翻盘张力与团队之魂要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：赛制段位数据准确、规则融进动作不说教；训练可量化，翻盘分台阶、绝不一步到位、不靠对手送；胜利靠团队体系而非单人秀；宿敌有尊严不纸糊；写出职业代价（伤病、压力、舆论）；不展示可操作的赌博作弊细节、不美化假赛代打，对未成年人导向健康防沉迷；梦想的兑现必须有代价、不廉价。`;
}
