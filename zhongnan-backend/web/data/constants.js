// 终南集 · 纯数据常量（v2.324 从 app.js 外提，IIFE 挂载到 window.ZN_DATA）
// 零构建原生 ES，多个 script 顺序加载；app.js 保留同名 const 作为兜底
(function () {
  'use strict';
  const C = {};
C.HOME_TOOLS = [
    { id: 'toolPitch', key: 'tbCardPitch', desc: 'tbCardPitchP', cost: 'tbCostPitch' },
    { id: 'toolRead', key: 'tbCardRead', desc: 'tbCardReadP', cost: 'tbCostRead' },
    { id: 'toolTeardown', key: 'tbCardTd', desc: 'tbCardTdP', cost: 'tbCostTd' },
    { id: 'toolDiversity', key: 'tbCardDv', desc: 'tbCardDvP', cost: 'tbCostDv' },
  ];

C.X_REGIONS = [
    ['CN', '中国大陆', 'Chinese Mainland'], ['HK', '中国香港', 'Hong Kong SAR'], ['TW', '中国台湾', 'Chinese Taiwan'],
    ['US', '美国', 'United States'], ['JP', '日本', 'Japan'], ['KR', '韩国', 'South Korea'],
    ['EU', '欧盟', 'EU'], ['OTHER', '其他地区', 'Other region'],
  ];

C.MODE_BRIEF = {
    interview: { zh: ['把你零散的想法先倒在这里', '可以想到哪写到哪：核心创意、世界观、人物、想要的冲突都行；小南会在出本时把它们结构化，也可随时回来补充。'], en: ['Dump your scattered ideas here', 'Write freely: core idea, world, characters, conflicts. Xiaonan structures them at generation; you can come back anytime.'] },
    adapt: { zh: ['粘贴要改编的原作片段，或上传文件（自有/已授权内容）', '支持 txt/md/docx/epub/pdf（≤8MB），上传后自动提取正文；并在末尾写清想要续写/衍生/联动/同人中的哪种、原著尊重度高低。'], en: ['Paste the source you own/license, or upload a file', 'txt/md/docx/epub/pdf up to 8MB are auto-extracted. Add one line: sequel/spin-off/crossover/fanfic and how faithful to stay.'] },
    novel: { zh: ['粘贴小说原文，或上传小说文件（txt/md/docx/epub/pdf）', '上传后自动识别章节；注明必须保留的名场面或人物；系统会压缩冗余、按竖屏短剧节奏重排钩子与冲突。'], en: ['Paste novel chapters or upload a file (txt/md/docx/epub/pdf)', 'Chapters are auto-detected; mark must-keep scenes/characters; redundant narration is compressed into vertical-drama pacing.'] },
    interactive: { zh: ['描述主线起点与关键选择点', '分支要素填下方分支简报：选准分支风格（后果/关系/道德/悬疑）与利害压量；系统自动做闭环校验，确保每条支路有路可走。'], en: ['Describe the main line start and key choice points', 'Fill the branch brief below and pick the branch style (consequence/relationship/moral/mystery) and stakes; the system validates branch closure — every path leads somewhere.'] },
    hit_lab: { zh: ['粘贴高能名场面，或要逆向的爆款文本/链接描述', '两条轨道：①名场面拓展——写清冲突峰值、在场人物、要保留的关键台词/动作，向前补因向后延果；②爆款逆向（专业）——贴整剧爆款，只拆方法论骨架、换人设背景批量出不侵权新本，可在下方切换轨道。'], en: ['Paste a signature scene, or a hit text/link to reverse-engineer', 'Two tracks: ① Signature-scene expansion — give the conflict peak, people present and key line/action; ② Hit reverse (Pro) — paste the whole hit, reuse only the method skeleton, swap persona/setting and batch safe drafts. Switch track below.'] },
    long_ip: { zh: ['描述这个长系列IP的总体构想', '写清计划几季、每季核心问题、已有的世界观与常驻人物、想埋的跨季伏笔与多IP联动设想；系统建立系列圣经（总时间线/关系与伏笔账本），保证跨季不矛盾、季终有大钩、新观众单季可入坑。'], en: ['Describe the long-running IP concept', 'State planned seasons, each season’s core question, existing world & recurring cast, cross-season foreshadow and crossover ideas; a series bible (master timeline / relationship & foreshadow ledgers) keeps canon consistent, ends seasons on mega-hooks and lets new viewers enter any season.'] },
    hot: { zh: ['描述要借的热点（影视/社会/节日/行业）', '热点要素填下方热点简报：选准借法（同人设衍生/同背景改编/同套路复刻/反向反差）；系统自动做侵权与舆情预检，只借概念不抄表达。'], en: ['Describe the trend to ride (film/social/festival/industry)', 'Fill the trend brief below and pick the borrowing approach (persona/setting/formula/reversal); IP & opinion risk is pre-checked — borrow concepts, never expression.'] },
    shortvideo: { zh: ['描述这条爆款短视频的主题与目标', '写清主题、目标受众、时长（如30/60秒）、想要的钩子与转化动作；系统产出强节奏口播/分镜脚本。'], en: ['Describe the short video topic and goal', 'Give topic, audience, length (30/60s), wanted hook and CTA; a tight-paced voiceover/storyboard script is produced.'] },
    softad: { zh: ['描述想拍的剧情脑洞（人物困境/场景）', '在下方「品牌简报」里填品牌、唯一核心卖点与软性度；本框只写剧情灵感。系统产出剧情化软广脚本，品牌在转折处自然成解法。'], en: ['Describe the story idea (character predicament / scene)', 'Fill brand, the single core selling point and softness in the Brand brief below; this box is for the story idea only. The brand becomes the solution at the turning point.'] },
    default: { zh: ['用一句话描述你的故事创意', '谁、遇到什么麻烦、准备怎么反击；越具体出本越准。'], en: ['One-line story idea', 'Who, what trouble, how they fight back — the more specific, the better.'] },
  };

C.BRAND_UI = {
    zh: {
      heading: '剧情软广 · 品牌简报',
      tip: '品牌要素会作为「事实源」逐字注入创作：品牌名全程不改名、只锚定一个核心卖点、在剧情转折处自然成解法。品牌名与核心卖点必填；提交时自动做广告词合规预检（绝对化用语、医疗功效与收益承诺会被拦截）。',
      brand: '品牌名 *', brandPh: '如：橘隐',
      product: '产品/品类', productPh: '如：冷萃乌龙茶饮料',
      selling: '唯一核心卖点 *', sellingPh: '如：开盖即饮的冷萃乌龙，0 糖也有烘焙香',
      audience: '目标人群', audiencePh: '如：下午犯困又怕胖的上班族',
      symbol: '品牌记忆符号', symbolPh: '如：开罐声「啵」+ 橘色罐',
      cta: '期望转化动作', ctaPh: '如：评论区领尝鲜券',
      shell: '期望剧情外壳（选填）', shellPh: '如：加班深夜的办公室，新人被方案逼到崩溃',
      soft: '软性度',
      softOpts: { subtle: '轻植入（品牌转折后出现 1 次，无直接号召）', balanced: '均衡（体验证明 + 结尾软引导·推荐）', direct: '强转化（卖点清晰 + 明确 CTA，仍由剧情带出）' },
      required: '请先填齐品牌名与核心卖点（至少 2 个字），小南才能把品牌准确织进剧情。',
    },
    en: {
      heading: 'Branded skit · Brand brief',
      tip: 'These fields are injected verbatim as the source of truth: the brand name is never altered, only ONE selling point is anchored, and the product naturally becomes the solution at the turning point. Brand and selling point are required; ad-claim compliance is pre-checked on submit (absolute claims, medical/efficacy or return promises are blocked).',
      brand: 'Brand *', brandPh: 'e.g. Orange Hidden',
      product: 'Product / category', productPh: 'e.g. cold-brew oolong tea drink',
      selling: 'THE single core selling point *', sellingPh: 'e.g. ready-to-drink cold-brew oolong, roasted aroma with zero sugar',
      audience: 'Target audience', audiencePh: 'e.g. sleepy office workers avoiding sugar',
      symbol: 'Brand-owned memory symbol', symbolPh: 'e.g. the “pop” of the can + orange can',
      cta: 'Wanted conversion action', ctaPh: 'e.g. grab a trial coupon in comments',
      shell: 'Wanted story wrapper (optional)', shellPh: 'e.g. late-night office, a newcomer cornered by a deadline',
      soft: 'Softness',
      softOpts: { subtle: 'Subtle (brand appears once after the turn, no direct CTA)', balanced: 'Balanced (proof moment + soft end nudge · recommended)', direct: 'Conversion-led (clear point + explicit CTA, still plot-driven)' },
      required: 'Brand name and the single core selling point (≥2 chars) are required before the brand can be woven into the story.',
    },
  };

C.TREND_UI = {
    zh: {
      heading: '热点追更 · 热点简报',
      tip: '热点要素作为「事实源」注入创作：选准借法，系统只借概念/结构/情绪，不抄原作表达。热点名称与爆点必填；提交时自动做侵权与舆情预检（手机号/身份证号会被拦截，灾难悲剧、未定性案件、直接引用原台词会触发强制虚构化要求）。',
      name: '热点名称/出处 *', namePh: '如：最近刷屏的「xx」话题（写公共可识别的称呼即可）',
      kind: '热点类型',
      kinds: { social: '社会话题', film: '影视综热点', festival: '节日/时令节点', industry: '行业事件' },
      approach: '借法（借什么、禁什么各不相同）',
      approaches: {
        persona_spin: '同人设衍生：借人物关系原型，人名/职业/城市全换，不复演名场面',
        setting_remix: '同背景改编：借情境母题，事件链与结局全部原创',
        formula_clone: '同套路复刻：只借钩子/反转/节奏结构，台词一句不沿用·推荐',
        reversal: '反向反差：对热点共识唱反调，翻认知不消费苦难',
      },
      heat: '为什么爆 / 情绪母题 *', heatPh: '如：打工人对「努力被关系户截胡」的集体憋屈，爽点在当场反击',
      angle: '我的切入角度/故事落点', anglePh: '如：不靠开挂，靠一份谁也没想到的提案当场翻盘',
      avoid: '明确规避元素（选填）', avoidPh: '如：不出现原剧角色名、不使用「xx」那句标志台词',
      required: '请先填齐热点名称与爆点/情绪母题（至少 4 个字），小南才能在不踩侵权红线的前提下借势。',
      pii: '热点信息含手机号/身份证号等隐私内容，请删除后再生成。',
    },
    en: {
      heading: 'Trend chasing · Trend brief',
      tip: 'These fields are injected as the source of truth: pick the borrowing approach and the system borrows only concept/structure/emotion, never the source’s expression. Trend name and heat core are required; IP & public-opinion risk is pre-checked on submit (phone/ID numbers are blocked; disasters, unresolved cases and direct quotes trigger mandatory fictionalization).',
      name: 'Trend name / source *', namePh: 'e.g. the viral “xx” topic (a publicly recognizable label is enough)',
      kind: 'Trend type',
      kinds: { social: 'Social topic', film: 'Film/TV/show trend', festival: 'Festival / seasonal moment', industry: 'Industry event' },
      approach: 'Borrowing approach (different rules each)',
      approaches: {
        persona_spin: 'Persona spin: borrow relationship archetypes; rename all, change jobs/city; no signature scenes',
        setting_remix: 'Setting remix: borrow the premise; original event chains and ending only',
        formula_clone: 'Formula clone: borrow hook/twist/pacing only; not one source line reused · recommended',
        reversal: 'Reversal: challenge the consensus; overturn a belief, never exploit suffering',
      },
      heat: 'Why it is hot / emotional core *', heatPh: 'e.g. workers’ resentment when effort is stolen by connections; payoff is an on-the-spot counter',
      angle: 'Your angle / landing point', anglePh: 'e.g. no magic fix — win the room with a proposal nobody expected',
      avoid: 'Explicitly avoid (optional)', avoidPh: 'e.g. no original character names, never use the signature line “xx”',
      required: 'Trend name and the heat/emotional core (≥4 chars) are required before the trend can be ridden safely.',
      pii: 'The trend brief contains private data such as a phone or ID number. Remove it and try again.',
    },
  };

C.BRANCH_UI = {
    zh: {
      heading: '互动分支 · 分支简报',
      tip: '分支要素作为「事实源」注入创作：架构师据此规划分支结构，撰写师据此落地选择点与结局。主线与选择点必填；提交时自动做闭环预检（结局数矛盾/坏结局过多会被拦截）。分支选项与去向在成稿△动作行中自然标出。',
      main: '主线起点 *', mainPh: '如：外卖员小陈接到一单送到豪华别墅区，发现收件人是自己前女友',
      choice: '关键选择点描述 *', choicePh: '如：前女友求助他帮忙送一封文件给现任男友，小陈面临接不接的选择',
      mainN: '主线结局数', hiddenN: '隐藏结局数', badN: '坏结局数',
      style: '分支风格',
      styles: { consequence: '后果驱动：选择带来不可逆的资源/处境变化', relationship: '关系驱动：选择改变人物关系走向', moral: '道德困境：选择拷问价值观，无绝对正确答案', mystery: '悬疑揭示：选择决定信息揭露顺序' },
      stakes: '利害压量',
      stakesOpts: { low: '低利害：日常情境中的小取舍', medium: '中利害：职业/感情中的真实代价·推荐', high: '高利害：人生/安全/道德的硬碰硬' },
      custom: '期望的特定结局（选填）', customPh: '如：隐藏结局是小陈发现前女友其实是在帮他',
      required: '请先填齐主线起点与关键选择点（各至少 4 个字），小南才能规划分支结构。',
      totalMin: '总结局数至少 2 个（好+隐藏+坏），才能形成真正的分支选择。',
    },
    en: {
      heading: 'Interactive branch · Branch brief',
      tip: 'These fields are injected as the source of truth: the architect plans the branch structure from them and the writer lands the choice points and endings. Main line and choice points are required; closure is pre-checked on submit (contradictory ending counts or too many bad endings are blocked). Branch options and destinations appear naturally in △ action lines in the draft.',
      main: 'Main line start *', mainPh: 'e.g. a courier delivers to a villa and finds the recipient is his ex-girlfriend',
      choice: 'Key choice point(s) *', choicePh: 'e.g. the ex asks him to deliver a document to her current boyfriend — accept or refuse?',
      mainN: 'Main endings', hiddenN: 'Hidden endings', badN: 'Bad endings',
      style: 'Branch style',
      styles: { consequence: 'Consequence-driven: choices cause irreversible resource/situation changes', relationship: 'Relationship-driven: choices change relationship trajectories', moral: 'Moral dilemma: choices test values; no absolutely correct answer', mystery: 'Mystery-reveal: choices determine information unlock order' },
      stakes: 'Stakes level',
      stakesOpts: { low: 'Low stakes: small everyday trade-offs', medium: 'Medium stakes: real career/relationship costs · recommended', high: 'High stakes: life-and-death / moral hard collisions' },
      custom: 'Requested specific ending (optional)', customPh: 'e.g. hidden ending: the ex was actually trying to help him',
      required: 'Main line and key choice points (≥4 chars each) are required before branches can be planned.',
      totalMin: 'At least 2 endings total (main + hidden + bad) are needed for real branching.',
    },
  };

C.CRAFT_HOOK_EN = {
    episode_hook: 'Episode-end hook', scene_hook: 'Scene hook', action_hook: 'Action hook', atmosphere_hook: 'Atmosphere (bomb)',
    dialogue_hook: 'Dialogue hook', infogap_hook: 'Info-gap bomb', countdown_hook: 'Countdown hook', anticommon_hook: 'Counter-intuitive hook',
    endure_sell_hook: 'Endure-then-revenge', chain_hook: 'Chain hook',
  };

C.NOVEL_LIC_LABEL = {
    public_domain: { zh: '公版', en: 'PD' },
    cc: { zh: 'CC授权·遵协议', en: 'CC · per license' },
    platform_free: { zh: '正版免费·仅阅读', en: 'Free to read' },
  };

C.SELECT_OPTS = {
    platform: { zh: [['红果短剧','红果短剧'],['抖音','抖音'],['快手','快手'],['ReelShort','ReelShort'],['DramaBox','DramaBox']],
      en: [['红果短剧','Hongguo'],['抖音','Douyin'],['快手','Kuaishou'],['ReelShort','ReelShort'],['DramaBox','DramaBox']] },
    engine: { zh: [['STANDARD','标准（性价比）'],['HIGH','高阶（更强组合）'],['PRO','专业（最强组合）']],
      en: [['STANDARD','Standard (balanced)'],['HIGH','High (stronger mix)'],['PRO','Pro (strongest mix)']] },
    outLang: { zh: [['zh','中文'],['en','English'],['ja','日本語'],['ko','한국어'],['es','Español'],['ar','العربية']],
      en: [['zh','Chinese'],['en','English'],['ja','Japanese'],['ko','Korean'],['es','Spanish'],['ar','Arabic']] },
  };

C.WORKBENCH_TITLES = {
    tagBench:         { zh: '智能标签工作台',          en: 'Tag Bench' },
    craftBench:       { zh: '小南递招 · 方法卡与钩子',  en: 'Craft Cards & Hooks' },
    novelSrcBench:    { zh: '免费合法小说素材库',       en: 'Novel Sources' },
    branchPanel:      { zh: '互动分支可视化编辑器',     en: 'Branch Editor' },
    branchBriefPanel: { zh: '互动分支 · 分支简报',     en: 'Branch Brief' },
    diversityPanel:   { zh: '多版本去重体检',           en: 'Diversity Audit' },
    roomPanel:        { zh: '编剧室',                 en: 'Writers’ Room' },
    teardownPanel:    { zh: '拆爆款工作台',             en: 'Teardown' },
    interviewPanel:   { zh: '采访式创作',               en: 'Interview' },
    brandPanel:       { zh: '剧情软广 · 品牌简报',      en: 'Branded Skit' },
    trendPanel:        { zh: '热点追更 · 热点简报',      en: 'Trending' },
    sourceTextPanel:  { zh: '原作 / 原文参考',          en: 'Source Text' },
    taskQueuePanel:   { zh: '任务队列',                 en: 'Task Queue' },
    progressPanel:    { zh: '生成进度',                en: 'Generation Progress' },
    resultPanel:      { zh: '创作结果',                 en: 'Result' },
    failPanel:        { zh: '生成失败',                 en: 'Failure' },
  };

C.DIFF_LEVEL_LABEL = {
    negligible: ['几乎未动', 'Barely touched'],
    light: ['局部微调', 'Light polish'],
    partial: ['局部重写', 'Partial rewrite'],
    major: ['大幅重写', 'Major rewrite'],
  };

C.QC_ENGINE_LABELS = {
    faintOnCue: ['晕倒阀门', 'Faint-on-cue'], wakeOnCue: ['呼唤即醒', 'Wake-on-cue'], woundOnCue: ['带伤开挂', 'Wound-on-cue'],
    instantHack: ['黑客秒破', 'Instant hack'], instantLanguage: ['语言秒精通', 'Instant fluency'], instantEscape: ['束缚秒脱', 'Instant escape'],
    weaponJam: ['武器哑火', 'Weapon jam'], evidenceBlank: ['证据恰好失灵', 'Evidence on cue'], childBlurt: ['萌宝泄密', 'Child blabber'],
    deadlineStretch: ['假倒计时', 'Fake deadline'], softInterrogation: ['审讯秒招', 'Instant confession'], deathbedConfession: ['临终全招', 'Deathbed confession'],
    truthSerum: ['吐真剂秒招', 'Truth serum'], pregnancyOnCue: ['妊娠剧情阀门', 'Pregnancy on cue'], amnesiaOnCue: ['失忆剧情阀门', 'Amnesia on cue'],
    terminalDiagnosisOnCue: ['绝症剧情阀门', 'Terminal-illness on cue'], allergyOnCue: ['过敏剧情阀门', 'Allergy on cue'], poisonOnCue: ['中毒秒解毒', 'Poison on cue'],
    muteOnCue: ['失声复声阀门', 'Mute-on-cue'], deafOnCue: ['耳聋复聪阀门', 'Deaf-on-cue'], paralysisOnCue: ['瘫痪秒愈', 'Paralysis on cue'],
    fatigueOverdrive: ['疲劳透支开挂', 'Fatigue overdrive'], apologyLoop: ['道歉循环', 'Apology loop'], forcedProximity: ['困处生情', 'Forced proximity'],
    rescueRomance: ['救美必生情', 'Rescue romance'], fightReconcile: ['吵架秒和好', 'Instant reconciliation'], instantRepentance: ['加害者秒悔悟', 'Instant repentance'],
    talkDown: ['嘴炮退敌', 'Talk-down'], instantSurgery: ['野战手术秒成功', 'Instant surgery'], crowdFlip: ['当众倒戈', 'Crowd flip'],
    rumorSpeed: ['丑闻秒传遍', 'Rumor speed'], resultsOnCue: ['化验秒出', 'Results on cue'], trafficOnCue: ['路况掐点', 'Traffic on cue'],
    vehicleJam: ['载具掐点故障', 'Vehicle jam'], sleepTalk: ['梦呓泄密', 'Sleep talk'], feverTruth: ['高烧谵妄吐真言', 'Fever truth'],
    instantEndowment: ['无因馈赠', 'Unprompted gift'], lastSecondRescue: ['救兵天降', 'Last-second rescue'], villainStall: ['反派拖刀', 'Villain stall'], teamBriefing: ['开会式推进', 'Team briefing'], instantTrust: ['初见托付', 'Instant trust'],
    instantKinship: ['认亲白给', 'Instant kinship'], instantLove: ['初见白给', 'Instant love'], instantMarksman: ['神枪手开挂', 'Instant marksman'], propMotifRhythm: ['物象母题节奏', 'Prop motif rhythm'],
    convenientEncounter: ['转角偶遇', 'Convenient encounter'], alwaysLate: ['晚一步阀门', 'Always late'], delayedReveal: ['迟到揭秘', 'Delayed reveal'],
    // v2.133 复盘轮补齐：pipeline 全引擎 key 中文词条（此前缺失的走 humanizeEngineKey 英文兜底）
    voicePrint: ['声纹一致性', 'Voice print'], dialogueAiTaste: ['AI味', 'AI taste'], sceneEmotionFlat: ['情绪平线', 'Scene emotion flat'], sensoryDetail: ['感官细节', 'Sensory detail'],
    vagueWord: ['模糊措辞', 'Vague wording'], dialogueNameCall: ['直呼名公式', 'Name-calling dialogue'], dialoguePingpong: ['乒乓对白', 'Ping-pong dialogue'], hollowAction: ['动作空转', 'Hollow action'],
    emotionWhiplash: ['情绪秒横跳', 'Emotion whiplash'], echoDialogue: ['信息复述', 'Echo dialogue'], expositionDialogue: ['说明对白', 'Exposition dialogue'], sceneSoftEnding: ['软绵收尾', 'Soft scene ending'],
    emotionLabelDialogue: ['情绪直给台词', 'Emotion-label dialogue'], roundRobinDialogue: ['轮流发言', 'Round-robin dialogue'], rhetoricalBarrage: ['反问连珠', 'Rhetorical barrage'], mirrorVisualDialogue: ['台词复述画面', 'Mirror-visual dialogue'],
    mindReadingNarration: ['读心旁白', 'Mind-reading narration'], crowdReaction: ['群体反应', 'Crowd reaction'], patheticFallacy: ['天气拟情', 'Pathetic fallacy'], omniscientTease: ['全知预告', 'Omniscient tease'],
    effortGloss: ['努力蒙太奇', 'Effort gloss'], reactionCliche: ['反应公式', 'Reaction cliché'], infoDelivery: ['弹窗广播', 'Info delivery'], atmosphereTell: ['气氛直给', 'Atmosphere tell'],
    confrontationDodge: ['对质回避', 'Confrontation dodge'], selfIntroDump: ['自报家门', 'Self-intro dump'], moralNarration: ['说教旁白', 'Moral narration'], emptyThreat: ['狠话不兑付', 'Empty threat'],
    timeJumpPayoff: ['时间直给', 'Time-jump payoff'], emotionPropCrutch: ['情绪道具拐杖', 'Emotion-prop crutch'], emotionVentCliche: ['情绪宣泄套路', 'Emotion-vent cliché'], actionEcho: ['动作回声', 'Action echo'],
    eavesdropDump: ['偷听直给', 'Eavesdrop dump'], selfPity: ['苦难自怜', 'Self-pity'], villainConfession: ['不打自招', 'Villain over-confession'], cheapForgiveness: ['免费宽恕', 'Cheap forgiveness'],
    witnessGratuity: ['证人白给', 'Witness gratuity'], previewVoiceover: ['信息预告', 'Preview voiceover'], stanceFlip: ['立场横跳', 'Stance flip'], unplantedAsset: ['后手空降', 'Unplanted asset'],
    subtextErase: ['潜台词擦除', 'Subtext erase'], exitCliche: ['离场套路', 'Exit cliché'], phoneRelay: ['电话转达', 'Phone relay'], fakeChoice: ['假选择', 'Fake choice'],
    parenOverdirect: ['括号表演指令', 'Parenthetical over-directing'], abstractAccusation: ['空泛质问', 'Abstract accusation'], cheapEmpathy: ['安慰话术', 'Cheap empathy'], fidgetProp: ['道具小动作', 'Fidget prop'],
    emptyVow: ['空转誓言', 'Empty vow'], flashbackCrutch: ['闪回拐杖', 'Flashback crutch'], accidentalSpark: ['意外火花', 'Accidental spark'], commFailCrutch: ['通讯失灵', 'Comm-fail crutch'],
    drunkTruth: ['灌醉真心话', 'Drunken truth'], tearBait: ['泪点开关', 'Tear bait'], instantDeduction: ['秒推理', 'Instant deduction'], recordsOnDemand: ['一查必中', 'Records on demand'],
    walkInTiming: ['推门掐点', 'Walk-in timing'], helpOnDemand: ['随叫随到', 'Help on demand'], wakeUpCall: ['一句话点醒', 'Wake-up line'], blindnessOnCue: ['失明复明阀门', 'Blindness on cue'],
    character: ['人物行为逻辑', 'Character logic'], rhythm: ['节奏曲线', 'Rhythm'],
    openingWeld: ['跨集焊点承接', 'Episode weld'], // v2.323 /fix 重算 176 键唯一缺口，issues 形态靠 extras 兜底行渲染，补词条后有中文标签+click-to-fix attr
    // c218 闸门引擎四键（无 score，由下方闸门卡渲染；词条供兜底与检索）
    cliche: ['反套路闸门', 'Anti-cliché gate'], tongue: ['台词口语化', 'Colloquial gate'],
    grounded: ['落地感', 'Groundedness'], lengthPlan: ['字数闸门', 'Length gate'], styleCheck: ['风格一致性', 'Style consistency']
  };

C.MODEL_GROUPS = [
    { kind: 'text', label: { zh: '文本引擎（剧本创作）', en: 'Text engines (script)' }, tiers: [
      { key: 'economy', zh: '经济档', en: 'Economy' }, { key: 'standard', zh: '标准档', en: 'Standard' }, { key: 'flagship', zh: '旗舰档', en: 'Flagship' }] },
    { kind: 'image', label: { zh: '图片引擎（剧本海报）', en: 'Image engines (poster)' }, tiers: [
      { key: 'standard', zh: '标准图片', en: 'Standard image' }, { key: 'flagship', zh: '旗舰图片（gpt-image）', en: 'Flagship (gpt-image)' }] },
  ];
  window.ZN_DATA = C;
  // 兼容：把每个常量直接挂 window，让老代码不改也能读
  Object.keys(C).forEach(k => { if (!window[k]) window[k] = C[k]; });
})();
