/**
 * 无限流 / 规则怪谈机制引擎（v2.12）
 * ------------------------------------------------------------------
 * 第七套“类型机制引擎”。无限流/规则怪谈 AI 通病：规则一次说全没有解谜乐趣、破局靠主角
 * 灵光一现或天降、规则随剧情临时改、死亡廉价可随意复活、副本单元之间割裂无主线、靠血腥
 * 堆砌恐怖。本模块沉淀 10 套装置（机理+技法+风险），自动识别意图并下发；非该类型返回空串。
 * 纯函数、确定性、双语。
 */
export type RuleLoopLang = 'zh' | 'en';
export interface RuleLoopDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const RULELOOP_DEVICES: RuleLoopDevice[] = [
  {
    id: 'rule_briefing', name: '规则前置与字面陷阱', nameEn: 'Rule briefing & wording traps',
    principle: '开场给出可执行的规则清单建立“游戏框架”，真正的杀机藏在字面歧义、留白与相互冲突里', principleEn: 'Open with an actionable rule list to set the game frame; the real danger hides in wording ambiguity, omissions and conflicting rules',
    technique: '每个副本开场用告示/广播/纸条给出 5-8 条规则，其中 1-2 条故意表述模糊或互相牵制（如“白天不要回应敲门声”却又有“听到妈妈声音必须开门”）；让主角逐条标注可疑点，规则文本后续可被回看、成为解谜证据', techniqueEn: 'Open each instance with 5–8 rules via notice/broadcast/note, making 1–2 deliberately ambiguous or conflicting (e.g. “never answer the door by day” vs “always open for mother’s voice”); have the protagonist flag suspects so the text can be revisited as evidence',
    risk: '规则要短、具体、可执行，不能写成大段说明文；陷阱要公平地写在字面里', riskEn: 'Rules must be short, concrete and actionable, never info-dumps; traps must be fairly present in the wording',
    kw: ['规则', '守则', '告示', '字面', 'rules', 'rule list', 'instructions', 'wording'],
  },
  {
    id: 'rule_discovery', name: '隐藏规则渐进发现', nameEn: 'Gradual hidden-rule discovery',
    principle: '隐藏规则不能直接告知，要靠观察、试错与前人留下的痕迹补全，让观众和主角同步推理', principleEn: 'Hidden rules are never stated outright; they are pieced together through observation, trial-and-error and traces left by predecessors, letting viewers reason alongside the hero',
    technique: '把隐藏规则拆成 3 个线索点（异常现象→前人记录/尸体姿态→小规模试探验证），主角每确认一条就更新“规则手册”；用一次可控的小代价试探代替无脑送死，发现节奏与紧张感交替', techniqueEn: 'Split each hidden rule into three clue beats (anomaly → predecessor’s note/body posture → small controlled probe); the hero updates a rule handbook per confirmation; use a low-cost probe instead of reckless death, alternating discovery with tension',
    risk: '试错要付出代价但不能靠配角轮流送死推进；发现过程观众可跟上', riskEn: 'Trial costs something but must not progress by disposable side characters dying in turn; viewers must follow the discovery',
    kw: ['隐藏规则', '试错', '发现', '线索', 'hidden rule', 'discover', 'trial and error', 'figure out'],
  },
  {
    id: 'fair_clue', name: '破局线索公平', nameEn: 'Fair solve clues',
    principle: '最终破局用到的每条关键信息都必须提前埋下、可回推，杜绝主角光环式灵光一现', principleEn: 'Every key fact used in the final solve must be planted early and be retraceable; no protagonist-halo eureka moments',
    technique: '先设计破局答案，再倒推把答案拆成 2-3 个前置线索埋进前几场（道具细节、规则漏洞、NPC 一句话）；破局时让主角明确引用此前线索，观众有“原来如此”而非“凭空开挂”的感觉', techniqueEn: 'Design the solution first, then reverse-engineer 2–3 planted clues into earlier scenes (a prop detail, a rule loophole, an NPC line); at the solve the hero explicitly cites them, earning an “of course” rather than a cheat',
    risk: '线索不能藏到画面/台词之外，也不能靠最后一秒突然补设定', riskEn: 'Clues cannot hide off-screen/off-line, and no last-second worldbuilding patch is allowed',
    kw: ['破局', '解谜', '线索', '伏笔', 'solve', 'clue', 'fair play', 'puzzle'],
  },
  {
    id: 'cost_death', name: '代价与死亡重量', nameEn: 'Stakes & the weight of death',
    principle: '违规必须有真实、不可逆或高成本的代价，死亡有分量，紧张感才立得住', principleEn: 'Rule-breaking must carry real, irreversible or high-cost consequences, and death must have weight for tension to hold',
    technique: '明确每个副本的代价梯度（警告→损失（道具/记忆/感官/队友关系）→淘汰/死亡），让主角在一次违规中真切失去点什么；即便有回档/复活机制也设置稀缺次数或后遗症，避免“死了也无所谓”', techniqueEn: 'Define a cost ladder per instance (warning → loss of item/memory/sense/ally bond → elimination/death) and make the hero genuinely lose something in one violation; even with reset/revival, cap its uses or add after-effects so death never feels free',
    risk: '代价呈现重心理恐惧而非血腥猎奇；死亡不渲染残忍画面，守平台尺度', riskEn: 'Convey stakes through psychological dread, not gory spectacle; death avoids graphic cruelty to meet platform limits',
    kw: ['代价', '死亡', '淘汰', '惩罚', 'death', 'stakes', 'penalty', 'cost'],
  },
  {
    id: 'instance_arc', name: '副本单元闭环', nameEn: 'Self-contained instance arc',
    principle: '每个副本都是“进入—立规则—破局—结算”的完整闭环，单副本可独立爽，又为主线留钩子', principleEn: 'Each instance is a closed loop of enter → establish rules → solve → settle, satisfying on its own while seeding the main arc',
    technique: '单副本控制在 3-6 集：进入给目标与时限，中段规则博弈，结尾用既定规则反杀/逃出并结算奖励（积分/技能/情报），最后 30 秒抛一个主线碎片（下一副本线索、组织伏笔、身份疑点）', techniqueEn: 'Keep an instance to 3–6 episodes: entry states goal and time limit, the middle plays rule games, the ending uses established rules to counter-kill/escape and settles rewards (points/skills/intel), then the final 30 seconds drop a mainline fragment (next-instance lead, organization clue, identity doubt)',
    risk: '结算必须严格按本副本规则计算，不能临时发奖励；闭环不能烂尾', riskEn: 'Settlement strictly follows the instance’s own rules, no ad-hoc rewards; a loop must not end unresolved',
    kw: ['副本', '关卡', '通关', '结算', 'instance', 'level', 'clear the stage', 'settlement'],
  },
  {
    id: 'escalation', name: '副本难度阶梯', nameEn: 'Instance difficulty ladder',
    principle: '副本难度逐级抬升：从“遵守规则”到“利用规则”再到“与制定规则者博弈”，能力与危机同步成长', principleEn: 'Difficulty climbs from following rules, to exploiting them, to outplaying the rule-maker; ability and crisis grow together',
    technique: '排一条难度曲线：副本一规则直白、单一怪物；副本二规则互相矛盾、需要选择；副本三出现会利用规则的智能对手/假规则；主角的成长（经验、队友、道具）恰好够应对下一级，不留无敌感', techniqueEn: 'Chart a curve: instance one has plain rules and one anomaly; instance two has conflicting rules requiring choices; instance three introduces an intelligent opponent who exploits rules or fake rules; the hero’s growth (experience, allies, items) is just enough for the next level, never invincible',
    risk: '难度跃升要有铺垫，不能突然数值膨胀；主角不能无解强', riskEn: 'Difficulty jumps need setup, no sudden power inflation; the hero must never be unbeatable',
    kw: ['难度', '升级', '阶梯', '关卡递进', 'difficulty', 'escalate', 'harder', 'progression'],
  },
  {
    id: 'human_game', name: '规则下的人心博弈', nameEn: 'Human game beneath the rules',
    principle: '最可怕的不是怪物而是人：在生存压力下写合作、背叛、信息差与道德选择，层次才厚', principleEn: 'People, not monsters, are scariest: under survival pressure, write cooperation, betrayal, information asymmetry and moral choices for depth',
    technique: '每个副本安排立场不同的队友/竞争者（各有隐藏目的），设计 1-2 个“规则允许但道德两难”的选择（救一人可能害全队）；让背叛有动机伏笔、合作有信任建立过程，反派也遵循自保逻辑而非纯粹使坏', techniqueEn: 'Give each instance allies/rivals with distinct hidden aims and 1–2 morally hard choices the rules permit (saving one may doom the team); foreshadow betrayal, earn cooperation, and let antagonists follow self-preservation logic rather than generic evil',
    risk: '人性博弈要服务破局，不写成狗血内耗；不渲染人性之恶到价值观灰暗', riskEn: 'Human games serve the solve, not melodramatic infighting; don’t render human nature so bleak it distorts values',
    kw: ['人心', '背叛', '合作', '博弈', 'betrayal', 'trust', 'human nature', 'social game'],
  },
  {
    id: 'loop_reset', name: '循环回档规则化', nameEn: 'Rule-bound loops & resets',
    principle: '时间循环/死亡回档本身也是一种“规则”：触发条件、保留什么、代价是什么必须讲清并严格执行', principleEn: 'A time loop/death reset is itself a rule: its trigger, what carries over and its cost must be stated and strictly honored',
    technique: '开局明确回档三要素（什么触发重置、哪些信息/物品/伤势继承、每次回档付出什么），用“继承的信息 vs 不继承的关系”制造戏剧点；给循环设上限或递减资源（每次回档可用时间更短），逼主角在有限次数内破局', techniqueEn: 'State the reset triad early (trigger, what carries over—information/items/wounds, and the cost); mine “retained knowledge vs reset relationships” for drama; cap loops or shrink resources (less time each reset) to force a finite solve',
    risk: '回档不能成为万能后悔药；规则一旦定下不能为方便而改', riskEn: 'A reset is not an unlimited undo; once set, its rules cannot change for convenience',
    kw: ['循环', '回档', '重置', '读档', 'loop', 'reset', 'time loop', 'restart'],
  },
  {
    id: 'world_rule', name: '规则世界自洽', nameEn: 'Self-consistent rule world',
    principle: '副本世界的规则对所有人（包括怪物/Boss/设计者）一视同仁，主角靠理解规则赢，而非规则偏袒', principleEn: 'Instance rules bind everyone equally—anomaly, boss, designer included; the hero wins by understanding rules, not by rules favoring them',
    technique: '建一张“规则适用表”自查：每条规则约束谁、有无例外、例外的理由；Boss 的恐怖来自它更熟悉/更会利用规则而非它可以无视规则，结局让主角用 Boss 自己必须遵守的规则反制', techniqueEn: 'Keep a rule-applicability table: whom each rule binds, exceptions and their reasons; the boss is scary because it knows/exploits rules better, not because it ignores them, and the ending counters it with a rule it too must obey',
    risk: '严禁“剧情需要时规则失效”；世界观前后矛盾是该类型最大硬伤', riskEn: 'Never let rules fail “because the plot needs it”; world inconsistency is the genre’s fatal flaw',
    kw: ['世界观', '自洽', '规则约束', 'boss', 'consistent world', 'rules bind all', 'internal logic', 'worldbuilding'],
  },
  {
    id: 'exit_mainline', name: '出口与主线牵引', nameEn: 'Exit & mainline pull',
    principle: '每个副本要有明确出口目标给即时动力，同时用贯穿主线（谁造的世界、如何彻底离开）给长期追更理由', principleEn: 'Each instance needs a clear exit goal for immediate drive, while an overarching mainline (who built this world, how to leave for good) supplies long-term binge pull',
    technique: '单集/单副本反复可视化“出口进度”（剩余人数、钥匙碎片、距离出口层数）；主线按“疑问—线索—更大疑问”节奏每 2-3 个副本推进一格，关键 NPC/组织反复出现并与副本产出的情报咬合', techniqueEn: 'Visualize exit progress repeatedly (people left, key fragments, floors to exit); advance the mainline every 2–3 instances as question → clue → bigger question, with recurring NPCs/organizations interlocking with instance intel',
    risk: '主线碎片要能最终回收，不能挖一堆不填的坑；单元与主线比例均衡', riskEn: 'Mainline fragments must eventually pay off—no pile of abandoned holes; balance unit stories and mainline',
    kw: ['出口', '主线', '逃离', '真相', 'exit', 'escape', 'main mystery', 'overarching'],
  },
];
export const VALID_RULELOOP_DEVICES = new Set(RULELOOP_DEVICES.map((d) => d.id));
const BY_ID = new Map(RULELOOP_DEVICES.map((d) => [d.id, d]));

const RULELOOP_HINT = ['无限流', '规则怪谈', '副本', '闯关', '生存游戏', '死亡游戏', '怪谈', '回档', '循环副本', '通关', 'infinite flow', 'rule horror', 'death game', 'survival game', 'instance', 'dungeon', 'time loop reset', 'escape room horror'];
export function detectRuleLoop(text: string): boolean {
  const t = (text || '').toLowerCase();
  return RULELOOP_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickRuleLoopDevices(text: string, n = 3): RuleLoopDevice[] {
  const t = (text || '').toLowerCase();
  const hit = RULELOOP_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: RuleLoopDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：隐藏规则发现（解谜乐趣）+ 线索公平（不空降）+ 副本闭环（结构完整）
  const fallback = ['rule_discovery', 'fair_clue', 'instance_arc'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  RULELOOP_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildRuleLoopDirective(text: string, lang: RuleLoopLang = 'zh', n = 3): string {
  if (!detectRuleLoop(text)) return '';
  const ds = pickRuleLoopDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is an INFINITE-FLOW / RULE-HORROR (death-game instance) story. Engineer the rules and puzzle-solving deliberately. Use these devices this episode:\n${body}\nHard rules: every clue used to solve must be planted early and be retraceable (no eureka/halo solves), once a rule is established it binds everyone including the boss and never changes for plot convenience, death/reset carries a real and finite cost (no free revives), each instance is a closed enter-rules-solve-settle loop with one mainline fragment, and build dread through rules and psychology rather than graphic gore, staying within content limits.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为无限流/规则怪谈（副本生存闯关）题材，规则与解谜要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：破局线索必须提前埋下、可回推，杜绝灵光一现/主角光环；规则一旦确立对所有人（含怪物/Boss/设计者）一视同仁、绝不为剧情临时改规则；死亡/回档要有真实且有限的代价、不廉价复活；每个副本“进入—立规则—破局—结算”闭环并留一个主线碎片；恐怖靠规则与心理而非血腥猎奇，守平台尺度、不宣扬封建迷信。`;
}
