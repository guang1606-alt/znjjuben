/**
 * 模式级创作方法论引擎（v2.14）
 *  - buildHitLabDirective：爆款拆解·名场面工作台两条轨道的可执行指令（整合原“名场面引擎/爆款逆向工程”）
 *  - buildLongIpDirective：长系列IP创作（多季/长系列/多IP联动）的跨季结构与连续性指令
 * 纯函数、双语、零 IO；非对应模式返回空串。
 */
import { HitLabTrack, canonicalModeId } from '../config/modes';

type MLang = 'zh' | 'en';
type DepthTier = 'speed' | 'balanced' | 'depth';

/** 名场面工作台：轨道不同，方法论不同 */
export function buildHitLabDirective(mode: string | undefined, track: HitLabTrack | string | undefined, lang: MLang = 'zh'): string {
  if (!mode || mode !== 'hit_lab') return '';
  const isReverse = track === 'hit_reverse';
  if (lang === 'en') {
    if (isReverse) {
      return `HIT REVERSE-ENGINEERING TRACK (deconstruct a whole hit drama, never copy it):
· Extract only the abstract method skeleton: golden-3-seconds hook type, payoff density & placement, reversal nodes, tension/emotion curve, persona contrast — never reuse original sentences.
· Replace persona, setting and worldview entirely; the new story must not share character names, signature lines, plot sequences or distinctive details with the source.
· Batch 3–5 versions whose persona, setting and core conflict are all different (no reskinned duplicates); run the n-gram overlap check and discard any high-overlap draft.
· Keep what made it work (rhythm and emotional payoff logic), change everything that is expression; add an infringement-risk note for each version.`;
    }
    return `SIGNATURE-SCENE EXPANSION TRACK (one high-energy scene → full script):
· Treat the given scene as the emotional/conflict PEAK: first decompose its core conflict, emotional peak value, relationships on site and the one key line/action that must survive.
· Backfill CAUSE before it (how relationships and stakes reached this point) and CONSEQUENCE after it (what changes irreversibly), keeping both logic and emotion continuous.
· The signature scene lands at the right payoff position (not wasted in episode 1 cold); build foreshadowing earlier and callback later so it feels earned.
· Expand to a full episode or whole series around this single peak without padding: every added scene must serve the path toward or away from it.`;
  }
  if (isReverse) {
    return `【爆款逆向·批量轨道】（拆解整剧爆款，只复用方法论、绝不复制表达）：
· 只抽取抽象方法论骨架：黄金三秒钩子类型、爽点密度与排布、反转节点、张力/情绪曲线、人设反差；原剧台词一句不沿用。
· 人设、背景、世界观全部替换：不得共用角色名、标志性台词、情节序列与独特细节。
· 批量产出 3-5 版，且各版人设/背景/核心冲突完全不同，杜绝换汤不换药；逐版跑文字重合度校验，高重合稿直接废弃。
· 保留“为什么爆”的节奏与情绪兑付逻辑，替换一切“具体表达”；每版附侵权风险说明。`;
  }
  return `【名场面拓展轨道】（一个高能场面 → 完整剧本）：
· 把给定场面当作全剧情绪/冲突峰值：先拆解其核心冲突、情绪峰值、在场人物关系、必须保留的那一句关键台词或动作。
· 向前补“因”（关系与利害如何一步步走到这里）、向后延“果”（此后什么被不可逆地改变），逻辑与情绪双连贯。
· 名场面要落在对的兑付位置（不浪费在第一集冷开场），提前埋期待、之后有回扣，让观众觉得“等到了”。
· 围绕这一个峰值扩成完整单集/全本，不灌水：新增每场戏都必须服务于“走向它或离开它”。`;
}

/**
 * 模式级创作方法论（v2.83 起；v2.86 电影剧本上线、v2.87 补三幕片段定位）
 * hit_lab / long_ip 已由各自专属函数承载；其余模式（含 film）由 MODE_CRAFT_ZH/EN 承载；未知/空模式返回空串。
 * 设计约束：①纯函数·双语·零 IO·确定性；②只约束创作方法，不改变既有版式与字数闸门——
 * 任何模式的成稿仍须满足 场景行/△动作行/角色（情绪）：台词行 与制式字数区间，
 * 短视频/口播类以“分镜化场景 + △画面动作 + 旁白（情绪）：口播行”落地，而不是表格或提示词。
 */
/** v2.327：历史成年向模式名（已并入 film）——授权闸门与成年向红线护栏都只对这些 raw 名生效 */
const ADULT_LEGACY = new Set(['mature_x', 'xscript', 'x_script']);

const ADULT_GUARD_ZH = `【成年向内容护栏】（历史成年向模式，仍受年龄分级授权约束）：
· 张力靠暗示、留白与后果，不靠直露：情欲写情感与权力关系的拉扯，用关门/晨光/物件等镜头暗示替代性行为描写；暴力写压力与代价，不展示可操作的作案/制毒流程。
· 道德灰度不等于价值虚无：主角可以复杂，但恶行要有后果、弱势者有尊严；批判性距离必须存在，伤害与犯罪绝不被美化成酷。
· 零容忍红线：任何未成年人性化、露骨淫秽、血腥猎奇细节一律不写；疑似越界一律向"留白"收敛（成稿还会经过露骨内容硬禁闸，命中即拦截）。
· 台词可冷峻粗粝但不淫秽；靠处境选择、信息差与道德困境制造高级惊悚，而不是感官堆砌。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`;

const ADULT_GUARD_EN = `[ADULT-CONTENT GUARDRAIL - legacy mature mode, still age-gated]:
· Tension comes from implication, negative space and consequence, never from explicit depiction: erotic beats are written as an emotional and power struggle and conveyed through implication (a closing door, morning light, an object); violence conveys pressure and cost, never an executable crime or drug-making procedure.
· Moral grey is not moral nihilism: the protagonist may be complex, yet wrongdoing must carry consequences and the vulnerable keep their dignity; critical distance is mandatory and harm or crime is never glamorised.
· Zero-tolerance hard lines: any sexualisation of minors, explicit obscenity or gore-for-thrills is forbidden; when in doubt resolve toward implication - the draft still passes an explicit-content hard gate that blocks on hit.
· Dialogue may be cold and gritty, never obscene; build premium thriller through dilemma, information asymmetry and moral pressure rather than sensory overload.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, action lines, NAME (emotion): dialogue lines all present.`;

export function buildModeCraftDirective(mode: string | undefined, lang: MLang = 'zh'): string {
  if (!mode) return '';
  const raw = String(mode).trim().toLowerCase();
  // v2.327：历史模式名先归一（novel→adapt / branded_skit→video_short / mature_x→film），
  // 保证旧项目不会因合并而拿不到方法论，也避免出现"中文有、英文空"的单边残留。
  const canon = canonicalModeId(raw) ?? raw;
  const base = lang === 'en' ? (MODE_CRAFT_EN[canon] ?? '') : (MODE_CRAFT_ZH[canon] ?? '');
  if (ADULT_LEGACY.has(raw)) {
    const guard = lang === 'en' ? ADULT_GUARD_EN : ADULT_GUARD_ZH;
    return base ? `${base}\n${guard}` : guard;
  }
  return base;
}

/**
 * v2.326 Method Trace：成稿末尾显式输出"本集创作方法论"清单。
 * 对应 Claude 技术主管的"深度维度"——AI 不只给结果，还要把用了什么方法显式化，让用户可追溯、可学习、可复用。
 * 纯函数·双语·零 IO；hit_lab / long_ip / film 已有专属方法论指令，此处不追加（避免重复）。
 * 输出格式：成稿最后一行（任何 action/台词之后）追加一行方法论清单，如 "【本集创作方法论：钩子前置 · 名场面优先 · 人物按功能合并】"。
 */
const METHOD_TRACE_ZH: Record<string, string> = {
  interview: `· 成稿末尾（最后一个场景之后、任何附录之前）追加一行方法论清单，格式：\n【本集创作方法论：从口述碎片归位 · 人物欲望→核心冲突→代价→转折 · 四维记忆空间落地】\n按实际用到的方法列举，每条用"· "开头、用"、"或"· "分隔；最多列 3-5 条。`,
  adapt: `· 成稿末尾（最后一个场景之后、任何附录之前）追加一行方法论清单，格式：\n【本集创作方法论：形态定性（续写/衍生/联动/同人）· 守核换境 · 只借底层方法不沿用措辞】\n按实际用到的方法列举；novel 子轨道须额外注明"钩子前置 · 人物按功能合并"，最多列 3-6 条。`,
  tag: `· 成稿末尾追加一行方法论清单，格式：\n【本集创作方法论：标签焊接 · 情绪/关系先于题材 · 标签落地为具体设定】\n按实际用到的方法列举，最多列 3-5 条。`,
  interactive: `· 成稿末尾追加一行方法论清单，格式：\n【本集创作方法论：真选择设计 · 分支闭环 · 选择前压情绪后给反馈】\n按实际用到的方法列举，最多列 3-5 条。`,
  hot: `· 成稿末尾追加一行方法论清单，格式：\n【本集创作方法论：借势档位（强绑定/弱关联/反向）· 热点信号前置 · 故事脱离热点仍成立】\n按实际用到的方法列举，最多列 3-5 条。`,
  video_short: `· 成稿末尾追加一行方法论清单，格式：\n【本集创作方法论：3秒钩子 · 每镜≤20字口播 · 单一主行动引导】\n按实际用到的方法列举；soft-ad 子轨道须额外注明"品牌是解题者不是主角"，最多列 3-6 条。`,
};
const METHOD_TRACE_EN: Record<string, string> = {
  interview: `· Append one methodology line at the very end of the draft (after the last scene, before any appendix), format:\n【Episode methodology: fragment re-alignment · desire→conflict→stakes→turn · four-dimension memory】\nList methods actually used, each separated by " · "; 3-5 items max.`,
  adapt: `· Append one methodology line at the very end of the draft, format:\n【Episode methodology: form choice (continue/spin-off/crossover/fanfic) · core preserve, setting swap · borrow method not wording】\nList methods actually used; novel-compression sub-track must additionally mention "front-load hooks · merge characters by function"; 3-6 items max.`,
  tag: `· Append one methodology line at the very end of the draft, format:\n【Episode methodology: tag welding · emotion/rel before genre · tags land as concrete settings】\nList methods actually used, 3-5 items max.`,
  interactive: `· Append one methodology line at the very end of the draft, format:\n【Episode methodology: real-choice design · branch closure · build stakes before choice】\nList methods actually used, 3-5 items max.`,
  hot: `· Append one methodology line at the very end of the draft, format:\n【Episode methodology: borrow tier (strong/weak/inverse) · trend signal front-load · story stands on its own】\nList methods actually used, 3-5 items max.`,
  video_short: `· Append one methodology line at the very end of the draft, format:\n【Episode methodology: 3s hook · ≤20-char voiceover per shot · single CTA】\nList methods actually used; soft-ad sub-track must additionally mention "brand as problem-solver not protagonist"; 3-6 items max.`,
};
export function buildMethodTraceDirective(mode: string | undefined, lang: MLang = 'zh', tier: DepthTier = 'balanced'): string {
  if (!mode) return '';
  const canon = canonicalModeId(mode);
  if (!canon) return '';
  // hit_lab / long_ip / film 已有专属方法论指令，不追加（避免重复）
  if (canon === 'hit_lab' || canon === 'long_ip' || canon === 'film') return '';
  // speed 档：极简占位（只给方法名格式，不强制枚举）
  if (tier === 'speed') {
    return lang === 'en'
      ? `· Append one methodology line at the very end, format: 【Episode methodology: (briefly list methods used, 1-3 items)】`
      : `· 成稿末尾追加一行方法论清单，格式：【本集创作方法论：（简要列用到的方法，1-3 条即可）】`;
  }
  if (lang === 'en') return METHOD_TRACE_EN[canon] ?? '';
  return METHOD_TRACE_ZH[canon] ?? '';
}

/**
 * v2.326 Purpose Gate：架构师动笔前先写"一句话目的陈述"。
 * 对应 Claude 技术主管的"高度维度"——大多数人只让 AI 执行"怎么做"，高手先追问"为什么做"。
 * 不破坏 outline JSON schema：目的陈述写入 overview 字段（本就是大纲的"本集核心想表达什么"字段）。
 * 纯函数·双语·零 IO；仅对"创作意图需要显式追问"的模式生效，跳过 interview/tag/hit_lab/long_ip/film。
 */
const PURPOSE_GATE_ZH: Record<string, string> = {
  adapt: `· 在 outline 的 overview 字段里先写一句话"本集改编的根本目的"（15-30 字），回答：改原作是想兑付什么？——是挖原作没说透的人物弧光？是借原作世界观讲新主题？还是满足原作粉丝的愿望清单？这是后续续写/衍生/联动/同人形态选择的锚点。`,
  interactive: `· 在 outline 的 overview 字段里先写一句话"本集互动设计的根本目的"（15-30 字），回答：让玩家做这个选择，是想体验什么？——是道德困境？是代价感知？是身份揭露？这是后续分支闭环设计的锚点。`,
  hot: `· 在 outline 的 overview 字段里先写一句话"借这个热点的根本目的"（15-30 字），回答：观众看完这个故事，带走什么情绪或反思？——是反套路爽感？是群体共鸣？是对热点的另一面思考？这是后续借势档位选择的锚点。`,
  video_short: `· 在 outline 的 overview 字段里先写一句话"种草/带货这条视频的根本目的"（15-30 字），回答：用户看完后应该做什么？——点赞/评论/关注/点链接（四选一）。这是后续钩子和 CTA 设计的锚点。`,
};
const PURPOSE_GATE_EN: Record<string, string> = {
  adapt: `· In the outline's overview field, write one sentence first: the core PURPOSE of this adaptation (15-30 chars) — answer WHY this adaptation exists: are you mining an unsaid character arc from the original? Using the world to tell a new theme? Or satisfying a fan wishlist? This anchors the continue/spin-off/crossover/fan-fiction form choice.`,
  interactive: `· In the outline's overview field, write one sentence first: the core PURPOSE of this interactive design (15-30 chars) — answer: the player makes this choice to experience what? moral dilemma? cost perception? identity reveal? This anchors the branch-closure design.`,
  hot: `· In the outline's overview field, write one sentence first: the core PURPOSE of riding this trend (15-30 chars) — answer: what emotion or reflection does the audience take away after watching? counter-cliché satisfaction? group resonance? a different angle on the trend? This anchors the borrow-tier choice.`,
  video_short: `· In the outline's overview field, write one sentence first: the core PURPOSE of this short video (15-30 chars) — answer: after watching, the user should DO what? like/comment/follow/click link (pick one primary CTA). This anchors the hook and CTA design.`,
};
export function buildPurposeGateDirective(mode: string | undefined, lang: MLang = 'zh', tier: DepthTier = 'balanced'): string {
  if (!mode) return '';
  const canon = canonicalModeId(mode);
  if (!canon) return '';
  // 仅 depth 档启用；speed/balanced 跳过（加速出本或平衡档）
  if (tier !== 'depth') return '';
  // interview（用户口述即目的）、tag（标签组合即目的）、hit_lab（拆解已有目的）、long_ip/film（已有专属指令）跳过
  const skip = new Set(['interview', 'tag', 'hit_lab', 'long_ip', 'film']);
  if (skip.has(canon)) return '';
  if (lang === 'en') return PURPOSE_GATE_EN[canon] ?? '';
  return PURPOSE_GATE_ZH[canon] ?? '';
}

/**
 * v2.326 Range Lens：让 audience 角色从跨界视角审视成稿。
 * 对应 Claude 技术主管的"范围维度"——借用数据分析师/调查记者/顶尖编辑的眼睛，同一个成稿能产出不同维度的洞见。
 * 不是新的评分维度（不替换追更欲/转化欲），而是追加 2-3 条跨界视角的可执行改进建议。
 * 纯函数·双语·零 IO；默认对所有模式生效（hit_lab/long_ip/film 跳过）。
 */
const RANGE_LENS_ZH: Record<string, string> = {
  adapt: `· 除追更欲/转化欲评分外，额外从 2-3 个跨界视角各出一条可执行建议：
  - 调查记者视角：检查人物动机链条是否有断环、时间线是否自洽
  - 顶尖编辑视角：台词可否精炼 20% 而不减信息量、节奏可否提速
  - 法务编辑视角：改编内容是否可能被原作者粉丝圈质疑
  每条建议用【视角标签·具体改进】格式，如 调查记者·女主发现信件的时机太晚，提前到第 1 集开头可形成更早悬念。`,
  interactive: `· 除追更欲/转化欲评分外，额外从 2-3 个跨界视角各出一条可执行建议：
  - 调查记者视角：选择是否有真正的代价/后果，还是只是名义选择
  - 顶尖编辑视角：分支描述是否清晰，玩家会不会选错（信息不足）
  - 产品设计师视角：这个互动设计的核心爽点，用户能在 3 秒内识别吗
  每条建议用【视角标签·具体改进】格式。`,
  video_short: `· 除转化欲评分外，额外从 2-3 个跨界视角各出一条可执行建议：
  - 数据分析师视角：3 秒钩子的完播率预估、这条视频的互动率预估（点赞/评论/关注）
  - 顶尖编辑视角：口播台词可否再减 20% 而不减卖点信息
  - 行为设计师视角：CTA 是否足够单一明确，用户看完后不会犹豫"到底让我干什么"
  每条建议用【视角标签·具体改进】格式。`,
};
const RANGE_LENS_DEFAULT_ZH = `· 除追更欲/转化欲评分外，额外从 2-3 个跨界视角各出一条可执行建议：
  - 调查记者视角：检查动机链条是否有断环、时间线是否自洽
  - 顶尖编辑视角：台词可否精炼 20% 而不减信息量、节奏可否提速
  - 数据分析师视角：这条内容的目标受众完播率/追更欲预估
  每条建议用【视角标签·具体改进】格式。`;
const RANGE_LENS_EN: Record<string, string> = {
  adapt: `· Beyond retention/conversion scoring, additionally output 2-3 actionable suggestions from cross-domain perspectives:
  - Investigative reporter: check if character motivation chains have gaps, timeline consistency
  - Top editor: can dialogue be tightened 20% without losing information? can pacing be faster?
  - Legal editor: could this adaptation be challenged by the original author's fan community?
  Each suggestion uses 【Perspective · specific improvement】 format.`,
  interactive: `· Beyond retention/conversion scoring, additionally output 2-3 actionable suggestions from cross-domain perspectives:
  - Investigative reporter: does each choice have genuine consequence, or is it just nominal?
  - Top editor: are branches clearly described, or would players misunderstand from insufficient info?
  - Product designer: can users identify the core interactive satisfaction within 3 seconds?
  Each suggestion uses 【Perspective · specific improvement】 format.`,
  video_short: `· Beyond conversion scoring, additionally output 2-3 actionable suggestions from cross-domain perspectives:
  - Data analyst: estimated 3s-hook completion rate, engagement rate (like/comment/follow)
  - Top editor: can voiceover copy be cut 20% without losing selling-point info?
  - Behavior designer: is the CTA single and clear enough — no ambiguity about what the user should do?
  Each suggestion uses 【Perspective · specific improvement】 format.`,
};
const RANGE_LENS_DEFAULT_EN = `· Beyond retention/conversion scoring, additionally output 2-3 actionable suggestions from cross-domain perspectives:
  - Investigative reporter: check if motivation chains have gaps, timeline consistency
  - Top editor: can dialogue be tightened 20% without losing info? can pacing speed up?
  - Data analyst: estimated completion/retention rate for the target audience
  Each suggestion uses 【Perspective · specific improvement】 format.`;
export function buildRangeLensDirective(mode: string | undefined, lang: MLang = 'zh', tier: DepthTier = 'balanced'): string {
  if (!mode) return '';
  const canon = canonicalModeId(mode);
  if (!canon) return '';
  // 仅 depth 档启用
  if (tier !== 'depth') return '';
  const skip = new Set(['hit_lab', 'long_ip', 'film']);
  if (skip.has(canon)) return '';
  if (lang === 'en') return RANGE_LENS_EN[canon] ?? RANGE_LENS_DEFAULT_EN;
  return RANGE_LENS_ZH[canon] ?? RANGE_LENS_DEFAULT_ZH;
}

const MODE_CRAFT_ZH: Record<string, string> = {
  interview: `【采访式创作模式】（把用户口述的碎片灵感聊成剧本）：
· 素材即事实源：采访中用户给出的人物/事件/场景/原话优先，关键设定不得凭空编造；信息缺口先用合理想象补占位，并让用户可一句话替换。
· 先归位后戏剧化：把碎片按“人物欲望→核心冲突→代价→转折”归位，补的是因果链，不是新事实；一段闲聊只提取一条戏剧情报。
· 像采访不像问卷：一轮只追问最关键的一个缺口（先问决定冲突走向的），用户表达完毕再生成，不打断、不连珠炮提问。
· 四维记忆空间（人物关系/时间线/场景物件/原话金句）逐条落到大纲，金句保留用户原表达。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
  adapt: `【创意改编模式】（续写/衍生/联动/同人 + v2.325 合并小说压缩子轨道）：
· 动笔前先定性形态：续写忠于原设定向后推进；衍生让配角/支线独立成篇；联动让多部作品世界观相遇并统一规则；同人面向粉丝但守版权边界。
· 守核换境：保留人物内核、关系张力与说话风格，可以换处境不换灵魂；原著留白处的补写必须符合人物既定逻辑。
· 版权安全：未授权原作不沿用原文句子、标志性台词与独特情节序列，只借底层方法；公版元素与作者授权元素可直接用，存疑一律改写表达。
· 联动先立“相遇规则”：为什么世界相遇、冲突期间哪套规则统辖、各方粉丝各有一个兑付时刻。
· 【小说压缩子轨道 v2.325】源文是整本小说时做减法手术：心理描写/背景铺陈/多线并行一律转成可拍的动作与对话，叙述转冲突场，支线直接砍掉而不是用旁白总结；钩子前置——把核心悬念/身份/危机提到第 1 集前 3 秒；先抽名场面；人物按功能合并（单集不超过 4 人）但守住原作内核；每集一个明确兑付或反转，集尾留钩。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
  tag: `【标签创建模式】（标签组合即出本宪法）：
· 每个被选中的标签都必须在大纲里落地为可指认的具体设定：情绪标签定基调、人设标签定主角、关系标签定核心冲突、题材标签定世界规则；标签不许只做标题装饰。
· 标签组合要焊接不要堆砌：看似不相干的标签用“一个身份/一个秘密/一个时间节点”搭一座合理性桥，让组合新鲜但自洽。
· 标签冲突时先满足情绪与关系标签（决定短剧留存），题材标签为其提供舞台。
· 随机标签组必须经用户确认才出本；一句话出本方向必须能回指全部已选标签。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
interactive: `【互动短剧模式】（分支选择与多结局）：
· 本集必须包含至少一个“真选择”：选项对应不同代价/收益并导向可见的不同后果，禁止两个选项结果相同的假选择。
· 分支必须闭环：每条支路有路可走、无死胡同、无自环、无悬空连线；好/坏/隐藏结局由关键选择的累积倾向决定，并匹配人物弧光。
· 选择点前把情绪和利害压足，选择后立刻给反馈（人物态度/资源/危险发生变化），集尾在新悬念处断开。
· 用台词与动作引导选择，但不剧透选项后果；单集仍守 钩子-冲突-转折-留白 节奏。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全；分支选项与去向在动作行中用同一版式自然标出。`,
  hot: `【热点追更模式】（借势全网热点快速出本）：
· 先定借势档位：强绑定（同款公共事件改编，必须换人物姓名/细节并声明虚构）、弱关联（只借情绪母题、故事全原创）、反向借势（对热点唱反调提供新视角）；时效紧时优先单一冲突、3 个场景内可拍的方案。
· 风险前置：只借已证实的公共事实，不碰未定性案件/灾难悲剧/可识别的私人当事人；不影射真实个人、不用原热点标志性台词，大纲阶段先自标侵权与舆情风险。
· 开篇 3 秒内让观众认出热点信号（话题情境或情绪点），但故事脱离热点本身也必须成立，避免热度退了剧就废。
· 单集只解决一个冲突，主要人物不超过 3 个，关系与立场一句话能说清，保证 2 小时内可出本。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
  video_short: `【爆款短视频脚本模式】（强钩子前3秒·分镜化口播·每镜一句口播）：
· 体裁是竖屏单条短视频（口播/种草/带货/剧情切片），不是连续剧：单条只讲一个核心卖点或一个情绪，先在大纲里定死“给谁看、看完做什么（点赞/评论/关注/点链接，只选一个主行动）”。
· 结构遵循 3 秒钩子 → 3-5 个分镜递进 → 一个记忆点 → 一句行动引导：钩子用痛点提问/反常识结论/结果前置/身份反差四选一；每 5-8 秒给一个信息增量或画面变化；行动引导只重复一次、不哀求不堆砌。
· 口播是对镜说话的人话：每镜一句、≤20 字、能一口气念出口，删书面语与形容词堆叠；卖点必须翻译成观众利益（参数→对我有什么好处），用使用前后对比或真实使用场景证明。
· 合规红线：不用“最/第一/国家级/根治/无效退款”等绝对化与功效承诺词，不贬低竞品，不虚构疗效与销量；种草带货内容默认按广告标准自我审查。
· 【剧情软广子轨道 v2.325】带来品牌简报时：品牌是解题者不是主角——先用约三分之二篇幅立人物困境与冲突，产品/品牌在转折点自然成为解法；一条创意只植入一个品牌、一个核心卖点，卖点用剧情证明不用旁白宣称；设计一个品牌专属记忆符号并在结尾回扣一次；合规边界：禁绝对化用语、禁医疗与投资功效承诺、禁贬低竞品、禁虚假体验。
· 版式兼容：以“分镜化场景行 + △画面/景别/字幕动作行 + 旁白或主播（情绪）：口播台词行”写成可拍分镜脚本，不用表格、不堆关键词，并满足制式字数区间。`,
  film: `【电影剧本创作模式】（长片三幕结构·90-120分钟·院线/流媒体级别·分段连续生成）：
· 长片按"片段序列"推进：全片40-60个片段，单次生成=其中1个片段（1-3场戏），严格遵守每集字数闸门；片段之间靠系列圣经衔接（前情提要/人物状态/伏笔账本连续，禁止各写各的）。
· 三幕结构是骨架：第一幕（建置，约前25%片段）——日常世界→激励事件→主角被迫踏上旅程；第二幕（对抗，25%-75%）——递进障碍→中点反转（约50%）→灵魂黑夜→最终决定；第三幕（解决，后25%）——高潮决战→主题闭环→人物弧光完成。系统会标注本片段所处幕次，按幕次职责写。
· 每场戏必须有"角色想要什么"和"什么阻挡他"——没有冲突的场就删掉或合并；场景内按"目标→障碍→结果（变好或变更坏）"推进，禁止平场过渡。
· 主角弧光跨片段推进：每个片段都要让主角离"意识到真正需要什么"更近一步；配角弧光服务主题，不喧宾夺主。
· 伏笔账本：第一幕埋的枪第三幕必须响（契诃夫之枪）；中点反转必须重新定义主角对问题的理解；结尾闭环回开场但人物已不同。埋伏笔的片段在动作行自然交代，回收时简洁有力不解释。
· 台词要有潜台词——角色说的和想的不一样；避免说明性台词（"我告诉你……"），让信息从冲突中自然流出；每场戏只传递一个关键信息。
· 场景描写是"可拍摄的"——只写镜头能看到和听到的，不写心理小说式内心独白；动作行写具体动作和环境细节，给导演留调度空间。
· 节奏：每3-4个片段必须有一个转折点（大小反转/信息揭露/关系变化）；幕点片段（激励事件/中点/高潮）承担最大转折，高潮前压到最紧，高潮后留呼吸。
· 主题不说破：让故事本身传递"人在面对X时的选择"，结尾片段不留说教台词；可留一个开放性意象（道具/画面/一句未说完的话）让观众自己补完。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
};

const MODE_CRAFT_EN: Record<string, string> = {
  interview: `INTERVIEW-MODE CRAFT (turn the user's spoken fragments into a script):
· The interview material is the source of truth: people, events, scenes and the user's own lines take priority; never invent key facts. Fill gaps with placeholder guesses the user can replace in one sentence.
· Organize first, dramatize second: slot fragments into desire → core conflict → stakes → turn; you add causal links, not new facts; extract only one dramatic insight per chat beat.
· Interview, don't interrogate: ask only the single most decisive missing thing per round, wait until the user finishes before generating, no rapid-fire question lists.
· Land every item of the four-dimension memory space (relationships / timeline / scenes & objects / verbatim golden lines) in the outline; keep golden lines in the user's own words.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
  adapt: `ADAPTATION-MODE CRAFT (continue / spin-off / crossover / fan-fiction + v2.325 merged novel-compression sub-track):
· Fix the form before writing: continuation stays faithful and moves forward; spin-off gives a supporting character or subplot its own story; crossover merges worlds under one rule-set; fan-fiction serves fans but respects copyright limits.
· Keep the core, change the situation: preserve character essence, relationship tension and voice; people may face new circumstances but never switch souls; filling source-material blanks must follow established character logic.
· IP safety: never reuse original sentences, signature lines or distinctive plot sequences from unlicensed works — reuse only underlying method; public-domain and explicitly licensed elements are usable, when in doubt rewrite the expression.
· For crossovers, establish why worlds meet, which single rule-set governs the conflict, and one payoff moment for each fanbase.
· 【Novel-compression sub-track v2.325】(when sourceText is a full novel): do subtraction surgery — turn inner monologue, exposition and parallel plotlines into filmable action and dialogue; convert narration into conflict scenes; cut subplots instead of summarizing them in voice-over; front-load hooks — move the core mystery/identity/crisis into the first 3 seconds of episode 1; extract signature scenes first; merge characters by function (≤4 per episode) while keeping source essence; one clear payoff or reversal per episode, end on a hook.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
  tag: `TAG-DRIVEN MODE CRAFT (the tag combo is the project's constitution):
· Every selected tag must land in the outline as a concrete, pointable element: emotion tags set the tone, persona tags set the protagonist, relationship tags set the core conflict, genre tags set the world rules; tags are never title decoration.
· Weld tags, don't pile them: bridge seemingly unrelated tags with one identity / one secret / one timeline node so the combo feels fresh yet self-consistent.
· When tags compete, serve emotion and relationship tags first (they drive short-drama retention); genre tags provide the stage.
· Random tag sets must be confirmed by the user before drafting; the one-line premise must point back to every selected tag.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
  interactive: `INTERACTIVE SHORT-DRAMA MODE CRAFT (branches and multiple endings):
· Each episode must contain at least one REAL choice: options carry distinct costs/benefits and lead to visibly different consequences; fake choices where both options resolve identically are forbidden.
· Branches must close: every path stays walkable with no dead ends, no self-loops, no dangling links; good / bad / hidden endings are determined by accumulated key choices and must match the character arc.
· Build emotion and stakes before the choice, give immediate feedback after it (a visible shift in attitude/resources/danger), and cut the episode on a fresh question.
· Guide choices through action and dialogue without spoiling outcomes; each episode still follows hook–conflict–turn–breathing room.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present; mark branch options and destinations naturally inside action lines using the same layout.`,
  hot: `TREND-CHASING MODE CRAFT (ride live trends and draft fast):
· Pick the borrowing level first: strong tie (adapt a confirmed public event, must rename people/change details and label as fiction), weak tie (borrow only the emotional motif, story fully original), or inversion (take the opposite angle for a fresh take); under time pressure prefer one conflict filmable in ≤3 scenes.
· Risk up front: borrow only verified public facts; stay away from unresolved cases, disasters/tragedies and identifiable private individuals; never allude to a real identifiable person or reuse the trend's signature lines; flag infringement and PR risk yourself at outline stage.
· Viewers must recognize the trend signal (situation or emotion) within the first 3 seconds, yet the story must stand on its own without the trend, so it survives after attention fades.
· Resolve only one conflict per episode, at most 3 principal characters, premise expressible in one sentence — draftable within two hours.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
  video_short: `VIRAL SHORT-VIDEO MODE CRAFT (hook-in-3-seconds, storyboarded voiceover, one line per shot + v2.325 merged soft-ad sub-track):
· The form is a single vertical short video (voiceover / product seeding / live-commerce / dramatic slice), not a series: one core selling point or one emotion per video; fix in the outline who watches and the single desired action (like/comment/follow/link — choose one primary CTA).
· Structure: 3-second hook → 3-5 escalating shots → one memory hook → one call to action. Hook is one of pain-point question / counter-intuitive claim / result-first / identity gap; deliver an information increment or visual change every 5-8 seconds; the CTA appears once, no begging, no stacking.
· Voiceover is spoken-to-camera human talk: one ≤20-character line per shot, speakable in one breath, cut bookish phrasing and stacked adjectives; translate features into viewer benefit (spec → what is in it for me), prove it with before/after or a real usage scene.
· Compliance hard line: no absolute or efficacy claims (best / No.1 / national-level / cure / money-back), no competitor disparagement, no fabricated efficacy or sales figures; product/seeding content self-reviews to advertising standards.
· 【Soft-ad sub-track v2.325】(when brandBrief is provided): the brand is the problem-solver, not the protagonist — spend roughly the first two thirds building a human predicament, let the brand become the solution at the turning point; one brand, one core selling point; prove selling point through plot, never assert in narration; design one brand-owned memory symbol and callback it once; compliance boundary: no absolute claims, no medical/investment efficacy promises, no competitor disparagement.
· Layout compatibility: write a filmable storyboard as scene heads + △ visual/shot/caption action lines + NARRATOR or HOST (emotion): voiceover dialogue lines — no tables, no keyword dumps — and satisfy the format word-count range.`,
  film: `FEATURE FILM MODE CRAFT (three-act structure, 90-120 minutes, theatrical / streaming grade, fragment-sequence generation):
· A feature advances as a FRAGMENT SEQUENCE: 40-60 fragments for the whole film; one generation = one fragment (1-3 scenes), strictly obeying the per-episode word-count gate; fragments are stitched by the series bible (previous events / character state / foreshadow ledger stay continuous — never write fragments in isolation).
· Three-act structure is the backbone: Act I (Setup, first ~25% of fragments) — ordinary world → inciting incident → protagonist forced into the journey; Act II (Confrontation, 25%-75%) — escalating obstacles → midpoint reversal (~50%) → dark night of the soul → final decision; Act III (Resolution, last 25%) — climax confrontation → thematic closure → character arc completed. The system annotates the current fragment's act; write to that act's duty.
· Every scene must have "what the character wants" and "what blocks them" — delete or merge any scene without conflict; within a scene advance as goal → obstacle → result (better or worse), no flat transitions.
· Protagonist arc advances across fragments: every fragment moves the hero one step closer to "realizing what they truly need"; supporting arcs serve the theme, never steal the show.
· Setup and payoff: the gun shown in Act I must fire in Act III (Chekhov's gun); the midpoint reversal must redefine the protagonist's understanding of the problem; the ending loops back to the opening but the character has changed.
· Dialogue carries subtext — what characters say differs from what they think; avoid expository lines ("Let me tell you..."), let information emerge naturally from conflict; each scene delivers only one key piece of information.
· Scene description is "filmable" — write only what the camera can see and hear, no novelistic inner monologue; action lines describe concrete actions and environmental details, leaving room for the director to stage.
· Pacing: every 3-4 fragments must carry a turning point (reversal / revelation / relationship shift); act-point fragments (inciting incident / midpoint / climax) carry the biggest turns, tighten to the max before the climax, then leave breathing room after.
· Theme is shown not told: let the story itself convey "the human choice when facing X", no preachy closing lines; you may leave one open image (prop / shot / an unfinished line) for the audience to complete.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
};

/** 长系列IP：跨季结构、连续性与系列宇宙指令 */
export function buildLongIpDirective(mode: string | undefined, lang: MLang = 'zh'): string {
  if (!mode || mode !== 'long_ip') return '';
  if (lang === 'en') {
    return `LONG-RUNNING IP MODE (multi-season / long series / shared universe & IP crossover). Engineer continuity deliberately:
· Series bible first: maintain a master timeline, power/relationship ledger, unresolved-foreshadow ledger and a per-season status snapshot; nothing later may contradict established canon.
· Season arc = self-contained season question with its own climax AND a season-end mega-hook that opens the next season; each episode still obeys hook-conflict-turn-breathing room.
· Character growth ladder across seasons: protagonists and recurring rivals advance in stages; power-ups and status changes have visible sources and lasting costs, no resets between seasons.
· Foreshadow accounting: every cross-season clue is registered with a planned payoff season; close old threads while opening new ones, avoid dangling plot holes.
· Multi-IP crossover: each IP keeps its own rules/tone consistent; establish why worlds meet, one set of rules governs the crossover, and give each IP’s fans their payoff moment.
· Recurring signature: keep stable IP anchors (signature line/prop/ritual/motif) and callback famous scenes to build brand memory; new viewers must still understand each season as an entry point.
· Plan season finale payoffs and the “mainline fragment per arc” so a long series stays bingeable instead of dragging.`;
  }
  return `【长系列IP模式】（多季/长系列/系列宇宙/多IP联动），连续性要被“设计”出来：
· 先立系列圣经：总时间线、能力/关系台账、未回收伏笔账本、每季状态快照；后文不得与既定设定（canon）矛盾。
· 季结构：每季有独立的“季问题”与本季高潮，同时季末必留开启下一季的“季终大钩子”；单集仍守 钩子-冲突-转折-留白。
· 跨季成长谱系：主角与常驻反派分阶段进阶，能力/地位提升有可见来源与持续代价，季与季之间不重置、不塌人设。
· 伏笔账本：每条跨季伏笔登记“计划在哪一季兑付”，边收旧线边开新线，杜绝烂尾与挖坑不填。
· 多IP联动：各IP保留自身规则与调性，先交代“世界为何相遇”，联动期用同一套规则统辖，并让每个IP的粉丝都有专属兑付时刻。
· 系列记忆点：固定IP锚点（标志性台词/道具/仪式/母题）并持续回扣名场面形成品牌记忆；同时保证新观众单季可入坑、不看前季也看得懂。
· 规划好每季终局兑付与“每段主线碎片”，让长篇始终可追、不拖沓。`;
}

/**
 * 电影模式：片段 → 三幕定位（v2.87）。兑现 film 指令“系统会标注本片段所处幕次”的承诺。
 * 依据 episodeIndex/episodeCount（0基片段序号/全片片段总数）确定性推导幕次与幕内段落，
 * 注入架构师/撰写师提示词，让 40-60 个片段各自按幕职责书写。
 * 纯函数·双语·零 IO；非 film 模式、片段总数 <8 或序号越界返回空串（短片不值得分幕，长片 40-60 片段是主场景）。
 */
export function buildFilmActDirective(mode: string | undefined, episodeIndex: number, episodeCount: number, lang: MLang = 'zh'): string {
  if (!mode || mode !== 'film') return '';
  const total = Math.floor(Number(episodeCount) || 0);
  const idx = Math.floor(Number(episodeIndex) || 0);
  if (total < 8 || idx < 0 || idx >= total) return '';
  const center = (idx + 0.5) / total; // 片段中心占比，避免边界抖动
  const act = center >= 0.75 ? 3 : center >= 0.25 ? 2 : 1;
  const mid = Math.abs(idx + 0.5 - total / 2) <= 0.5; // 恰含中点的那一个片段
  const pos = idx === 0 ? 'opening'
    : (act === 1 && center >= 0.12 && center < 0.20) ? 'inciting'
    : mid ? 'midpoint'
    : (act === 2 && center >= 0.66) ? 'darknight'
    : (act === 3 && center < 0.88) ? 'climax'
    : (act === 3) ? 'finale' : 'progression';
  if (lang === 'en') {
    const actEn: Record<number, string> = {
      1: 'Act I (Setup) — ordinary world → inciting incident → protagonist forced onto the journey',
      2: 'Act II (Confrontation) — escalating obstacles → midpoint reversal → dark night of the soul → final decision',
      3: 'Act III (Resolution) — climax confrontation → thematic closure → character arc completed',
    };
    const posEn: Record<string, string> = {
      opening: 'Opening: establish the ordinary world and the protagonist\'s lack; plant the "opening image" that Act III must close back onto; press toward the inciting incident.',
      inciting: 'Inciting-incident section: the force that shatters the ordinary world lands here; the protagonist is forced onto the road — from now on every beat proves there is no way back.',
      progression: 'Progression: escalate obstacles, raise costs, shift relationships, push toward the next act point; flat transitional scenes are forbidden.',
      midpoint: 'Midpoint reversal: must redefine how the protagonist understands the problem — not a bigger explosion but a deeper truth; attack/defense flips here.',
      darknight: 'Dark night of the soul: the protagonist hits bottom — external failure plus shaken inner belief; the section must end with the "final decision".',
      climax: 'Climax confrontation: maximum-tension collision; the gun planted in Act I fires here; speak through action and choice, never explanation.',
      finale: 'Closing: callback the opening image with a changed character, arc completed; no preaching — one open image may close the film.',
    };
    return `[FRAGMENT ACT POSITION] Fragment ${idx + 1}/${total} · Act ${act} · ${pos.replace('_', ' ')}:\n· Act duty: ${actEn[act]}.\n· ${posEn[pos]}`;
  }
  const actZh: Record<number, string> = {
    1: '第一幕（建置）——日常世界→激励事件→主角被迫踏上旅程',
    2: '第二幕（对抗）——递进障碍→中点反转→灵魂黑夜→最终决定',
    3: '第三幕（解决）——高潮决战→主题闭环→人物弧光完成',
  };
  const posZh: Record<string, string> = {
    opening: '开场段：建立日常世界与主角缺憾，埋下第三幕要闭环回扣的“开场意象”，末尾向激励事件施压。',
    inciting: '激励事件段：打碎日常的力量在本段落地，主角被迫上路；从此每一幕都是“回不去”的证明。',
    progression: '递进段：障碍升级、代价加码、关系变化，向下一个幕点推进；禁止原地踏步的过渡场。',
    midpoint: '中点反转段：必须重新定义主角对问题的理解——不是更大的爆炸，而是更深的真相；攻守/虚实在此翻转。',
    darknight: '灵魂黑夜段：主角跌到最低点——外部失败+内在信念动摇；本段结尾必须做出“最终决定”。',
    climax: '高潮决战段：最大张力对撞，第一幕埋的枪在此响；用动作与选择说话，不解释。',
    finale: '闭环终段：回扣开场意象但人物已不同，弧光完成；不说教，可留一个开放性意象收束。',
  };
  return `【本片段三幕定位】片段 ${idx + 1}/${total} · 第${['一', '二', '三'][act - 1]}幕 · ${posZh[pos].split('：')[0]}：\n· 幕职责：${actZh[act]}。\n· ${posZh[pos]}`;
}
