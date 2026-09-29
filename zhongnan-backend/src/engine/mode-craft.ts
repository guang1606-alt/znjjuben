/**
 * 模式级创作方法论引擎（v2.14）
 *  - buildHitLabDirective：爆款拆解·名场面工作台两条轨道的可执行指令（整合原“名场面引擎/爆款逆向工程”）
 *  - buildLongIpDirective：长系列IP创作（多季/长系列/多IP联动）的跨季结构与连续性指令
 * 纯函数、双语、零 IO；非对应模式返回空串。
 */
import { HitLabTrack } from '../config/modes';

type MLang = 'zh' | 'en';

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
export function buildModeCraftDirective(mode: string | undefined, lang: MLang = 'zh'): string {
  if (!mode) return '';
  const D = MODE_CRAFT_ZH[mode];
  if (lang === 'en') return MODE_CRAFT_EN[mode] ?? '';
  return D ?? '';
}

const MODE_CRAFT_ZH: Record<string, string> = {
  interview: `【采访式创作模式】（把用户口述的碎片灵感聊成剧本）：
· 素材即事实源：采访中用户给出的人物/事件/场景/原话优先，关键设定不得凭空编造；信息缺口先用合理想象补占位，并让用户可一句话替换。
· 先归位后戏剧化：把碎片按“人物欲望→核心冲突→代价→转折”归位，补的是因果链，不是新事实；一段闲聊只提取一条戏剧情报。
· 像采访不像问卷：一轮只追问最关键的一个缺口（先问决定冲突走向的），用户表达完毕再生成，不打断、不连珠炮提问。
· 四维记忆空间（人物关系/时间线/场景物件/原话金句）逐条落到大纲，金句保留用户原表达。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
  adapt: `【创意改编模式】（续写/衍生/联动/同人四态）：
· 动笔前先定性形态：续写忠于原设定向后推进；衍生让配角/支线独立成篇；联动让多部作品世界观相遇并统一规则；同人面向粉丝但守版权边界。
· 守核换境：保留人物内核、关系张力与说话风格，可以换处境不换灵魂；原著留白处的补写必须符合人物既定逻辑。
· 版权安全：未授权原作不沿用原文句子、标志性台词与独特情节序列，只借底层方法；公版元素与作者授权元素可直接用，存疑一律改写表达。
· 联动先立“相遇规则”：为什么世界相遇、冲突期间哪套规则统辖、各方粉丝各有一个兑付时刻。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
  tag: `【标签创建模式】（标签组合即出本宪法）：
· 每个被选中的标签都必须在大纲里落地为可指认的具体设定：情绪标签定基调、人设标签定主角、关系标签定核心冲突、题材标签定世界规则；标签不许只做标题装饰。
· 标签组合要焊接不要堆砌：看似不相干的标签用“一个身份/一个秘密/一个时间节点”搭一座合理性桥，让组合新鲜但自洽。
· 标签冲突时先满足情绪与关系标签（决定短剧留存），题材标签为其提供舞台。
· 随机标签组必须经用户确认才出本；一句话出本方向必须能回指全部已选标签。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
  novel: `【小说改编模式】（长篇小说压缩为竖屏短剧节奏）：
· 先做减法手术：心理独白、背景说明、多线叙事压成可拍摄的动作与对白，说明性内容改写成冲突场景，删支线而非旁白概括。
· 钩子前置：原著开篇铺垫的核心悬念/身份/危机前置到第 1 集前 3 秒；名场面优先提取，围绕它重排前因后果。
· 人物按功能合并：单集主要角色控制在 4 人内，合并功能性配角，但保留原著人物内核与标志性关系。
· 每集一个明确爽点或反转，集尾留钩；尊重度可调——高保真保主线名场面，低保真只借底层设定，版权存疑不沿用表达。
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
· 版式兼容：以“分镜化场景行 + △画面/景别/字幕动作行 + 旁白或主播（情绪）：口播台词行”写成可拍分镜脚本，不用表格、不堆关键词，并满足制式字数区间。`,
  branded_skit: `【剧情软广脑洞模式】（品牌植入剧情化）：
· 品牌是解题者不是主角：先用约三分之二时长立住人物困境与冲突，产品/品牌在转折点自然成为解法，杜绝开场报品牌名与口播念参数。
· 一条创意只植入一个品牌、一个核心卖点；卖点用剧情证明（人物因它改变处境），不用旁白宣称。
· 设计一个品牌专属记忆符号（动作/道具/台词），在结尾自然回扣一次；故事感优先于广告感，广告意图越隐越好但不得伪装成客观测评。
· 合规边界：禁绝对化用语、禁医疗与投资功效承诺、禁贬低竞品、禁虚假体验，必要的广告提示语按平台规则保留。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
  mature_x: `【成年向分级剧本模式】（合法成熟叙事：犯罪惊悚/黑暗人性/情欲张力，对标电影 R 级）：
· 张力靠暗示、留白与后果，不靠直露：情欲写情感与权力关系的拉扯，用关门/晨光/物件等镜头暗示替代性行为描写；暴力写压力与代价，不展示可操作的作案/制毒流程。
· 道德灰度不等于价值虚无：主角可以复杂，但恶行要有后果、弱势者有尊严；批判性距离必须存在，伤害与犯罪绝不被美化成酷。
· 零容忍红线：任何未成年人性化、露骨淫秽、血腥猎奇细节一律不写；疑似越界一律向“留白”收敛（成稿还会经过露骨内容硬禁闸，命中即拦截）。
· 台词可冷峻粗粝但不淫秽；靠处境选择、信息差与道德困境制造高级惊悚，而不是感官堆砌。
· 成稿仍按标准剧本版式与字数闸门：场景行、△动作行、角色（情绪）：台词行齐全。`,
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
  adapt: `ADAPTATION-MODE CRAFT (continue / spin-off / crossover / fan-fiction):
· Fix the form before writing: continuation stays faithful and moves forward; spin-off gives a supporting character or subplot its own story; crossover merges worlds under one rule-set; fan-fiction serves fans but respects copyright limits.
· Keep the core, change the situation: preserve character essence, relationship tension and voice; people may face new circumstances but never switch souls; filling source-material blanks must follow established character logic.
· IP safety: never reuse original sentences, signature lines or distinctive plot sequences from unlicensed works — reuse only underlying method; public-domain and explicitly licensed elements are usable, when in doubt rewrite the expression.
· For crossovers, establish why worlds meet, which single rule-set governs the conflict, and one payoff moment for each fanbase.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
  tag: `TAG-DRIVEN MODE CRAFT (the tag combo is the project's constitution):
· Every selected tag must land in the outline as a concrete, pointable element: emotion tags set the tone, persona tags set the protagonist, relationship tags set the core conflict, genre tags set the world rules; tags are never title decoration.
· Weld tags, don't pile them: bridge seemingly unrelated tags with one identity / one secret / one timeline node so the combo feels fresh yet self-consistent.
· When tags compete, serve emotion and relationship tags first (they drive short-drama retention); genre tags provide the stage.
· Random tag sets must be confirmed by the user before drafting; the one-line premise must point back to every selected tag.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
  novel: `NOVEL-TO-SHORT-DRAMA MODE CRAFT (compress a novel into vertical short-drama pacing):
· Do subtraction surgery first: turn inner monologue, exposition and parallel plotlines into filmable action and dialogue; convert narration into conflict scenes; cut subplots instead of summarizing them in voice-over.
· Front-load hooks: move the core mystery/identity/crisis the novel builds slowly into the first 3 seconds of episode 1; extract signature scenes first and re-arrange cause and effect around them.
· Merge characters by function: at most 4 principal roles per episode, fold functional minor characters together, but keep the source's character essence and signature relationships.
· One clear payoff or reversal per episode, end every episode on a hook; fidelity is adjustable — high fidelity keeps the spine and signature scenes, low fidelity borrows only the premise, never reuse expression when licensing is unclear.
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
  video_short: `VIRAL SHORT-VIDEO MODE CRAFT (hook-in-3-seconds, storyboarded voiceover, one line per shot):
· The form is a single vertical short video (voiceover / product seeding / live-commerce / dramatic slice), not a series: one core selling point or one emotion per video; fix in the outline who watches and the single desired action (like/comment/follow/link — choose one primary CTA).
· Structure: 3-second hook → 3-5 escalating shots → one memory hook → one call to action. Hook is one of pain-point question / counter-intuitive claim / result-first / identity gap; deliver an information increment or visual change every 5-8 seconds; the CTA appears once, no begging, no stacking.
· Voiceover is spoken-to-camera human talk: one ≤20-character line per shot, speakable in one breath, cut bookish phrasing and stacked adjectives; translate features into viewer benefit (spec → what is in it for me), prove it with before/after or a real usage scene.
· Compliance hard line: no absolute or efficacy claims (best / No.1 / national-level / cure / money-back), no competitor disparagement, no fabricated efficacy or sales figures; product/seeding content self-reviews to advertising standards.
· Layout compatibility: write a filmable storyboard as scene heads + △ visual/shot/caption action lines + NARRATOR or HOST (emotion): voiceover dialogue lines — no tables, no keyword dumps — and satisfy the format word-count range.`,
  branded_skit: `BRANDED SKIT MODE CRAFT (story-driven product placement):
· The brand is the problem-solver, not the protagonist: spend roughly the first two thirds building a human predicament and conflict, let the product/brand become the solution at the turning point; never open on the brand name or read specs aloud.
· One brand, one core selling point per idea; prove the selling point through plot (the character's situation changes because of it), never assert it in narration.
· Design one brand-owned memory symbol (gesture/prop/line) and callback it once at the end; story-first, hide the ad intent as much as possible but never disguise it as an objective review.
· Compliance boundary: no absolute claims, no medical/investment efficacy promises, no competitor disparagement, no fake experiences; keep ad disclaimers the platform requires.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
  mature_x: `MATURE-RATED MODE CRAFT (legal mature storytelling: crime thriller / dark human nature / erotic tension, cinematic R-rated register):
· Tension comes from implication, restraint and consequences, never explicitness: eroticism is written as the pull of emotion and power, suggested through a closing door / morning light / an object rather than sexual description; violence shows pressure and cost, never operational how-to for crimes or drug manufacture.
· Moral grey is not value nihilism: protagonists may be complex, but wrongdoing has consequences and the vulnerable keep their dignity; a critical distance is mandatory, harm and crime are never glamorized.
· Zero-tolerance lines: no sexualization of minors in any form, no explicit pornography, no gore or morbid detail; whenever a passage risks crossing the line, pull back toward restraint (a hard explicit-content gate screens the finished draft and blocks delivery).
· Dialogue may be cold and gritty but never obscene; build high-end suspense through dilemmas, information gaps and moral choice, not sensory overload.
· Still obey the mandatory screenplay layout and word-count gate: scene heads, △ action lines, NAME (emotion): dialogue lines all present.`,
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
