/**
 * 终南集·AGI编剧大师 · 创作技能内核（Playbook）
 * ------------------------------------------------------------------
 * 这是六岗位智能体 + 双校验 Agent 共同消费的“编剧内功”单一事实源。
 * 接上真实大模型后，各岗位 system prompt 由 buildRoleDirective() 注入；
 * 去AI化校验 Agent 用 antiAiScan() 做第一版可运行检测（非空话）。
 * 学习进化中心吸收的新知识，最终也落到本内核对应分类，实现自进化。
 */

export type RoleId = 'architect' | 'character' | 'writer' | 'audience' | 'polish' | 'compliance' | 'market';

/** 观众代言官：模拟目标受众实时反应，预判划走点与追更欲 */
export const AUDIENCE = {
  retentionRules: [
    '前3秒若无冲突/悬念/极端情绪，判定高危划走点',
    '每30秒需一个信息增量或情绪增量，否则中段疲软',
    '结尾无钩子=追更欲骤降，必须留未解之谜或更强威胁',
    '爽点延迟超过2集未兑现，观众弃剧',
  ],
};

/** 黄金三秒钩子类型库 */
export const HOOK_TYPES = [
  { id: 'face_slap_pre', name: '打脸前置', use: '把最解气的羞辱→反杀结果剪到开头3秒', example: '“就你也配进这家门？”下一秒管家鞠躬：大小姐，老爷请您回家。' },
  { id: 'identity_gap', name: '身份错位', use: '真实身份与当下处境的极端反差', example: '被全公司嘲笑的保洁工，竟是收购方幕后老板。' },
  { id: 'crisis', name: '危机悬念', use: '生死/利益/情感危机直接砸脸', example: '婚礼当天，她收到丈夫和伴娘的开房记录。' },
  { id: 'secret', name: '秘密窥视', use: '观众知道而剧中人不知的致命秘密', example: '她笑着给婆婆盛汤，镜头扫过汤里的药瓶标签。' },
  { id: 'extreme_emotion', name: '极端情绪', use: '极致委屈/愤怒/恨意瞬间点燃共情', example: '母亲跪求医生救子，却被富人当众羞辱驱赶。' },
  { id: 'promise_gap', name: '承诺反差', use: '誓言与现实的残酷对照', example: '“我养你一辈子。”三年后他搂着别人让她净身出户。' },
] as const;

/** 单集节奏弧（刚性） */
export const EPISODE_ARC = ['hook(0-5秒抓人)', 'conflict(矛盾升级)', 'turn(反转/爽点)', 'cliffhanger(结尾钩子留白)'] as const;
/** v1.99 单集节奏弧（英文） */
export const EPISODE_ARC_EN = ['hook (grab in 0-5s)', 'conflict (escalation)', 'turn (reversal/payoff)', 'cliffhanger (end on an open hook)'] as const;

/** 人设反差三公式 + 隐性设定五维（人物不工具人） */
export const CHARACTER = {
  contrastFormulas: ['身份反差', '性格反差', '境遇反差', '认知反差'],
  hiddenDimensions: ['原生家庭', '行为习惯', '喜好禁忌', '思维模式', '底层欲望'],
  rules: [
    '每个主要角色必须有“底层欲望”，其一切行动由欲望驱动而非剧情需要',
    '配角也要有独立立场，不能只为推动主角而存在',
    '反派要有自洽动机，禁止“为坏而坏”',
    '人物成长/黑化要有至少3个铺垫节点，禁止突变',
  ],
};

/** 台词口语化规则 */
export const DIALOGUE = {
  rules: [
    '人话优先：说一半、会打断、有语气词，允许不完整句',
    '按身份/年龄/地域区分用词，老板不像学生、长辈不用网络梗',
    '一句话信息量≤15字为宜，长句拆短',
    '禁止角色替观众总结主题、禁止说教式金句堆砌',
    '潜台词>直白：情绪靠动作和停顿，不靠喊出来',
  ],
};

/**
 * AI 腔负面清单——去AI化校验 Agent 的第一版可运行规则。
 * 命中即判定“有AI痕迹”，打回细节润色师。
 */
export const AI_CLICHE = {
  // 高频AI套路词/句式
  phrases: [
    '不禁', '嘴角勾起', '勾起一抹', '弧度', '五味杂陈', '心中一紧', '眼底闪过一丝',
    '空气仿佛凝固', '时间仿佛静止', '宛如', '犹如', '仿佛过了一个世纪',
    '深深地看了', '意味深长', '不容置疑', '毋庸置疑', '油然而生', '百感交集',
    '在这个', '众所周知', '总而言之', '综上所述', '值得一提的是', '不得不说',
    '不是别人，正是', '只见', '却说', '话说',
  ],
  // AI爱用的工整排比/对仗信号
  patterns: [/既[^，。]{1,8}又[^，。]{1,8}又/, /有的[^，。]+有的[^，。]+有的/],
  // 每集AI腔命中上限（超过即不合格）
  maxHitsPerEpisode: 2,
};

export interface AntiAiResult { hitCount: number; hits: string[]; pass: boolean; }

/** 去AI化扫描：返回命中的AI腔及是否通过 */
export function antiAiScan(text: string): AntiAiResult {
  const hits: string[] = [];
  AI_CLICHE.phrases.forEach((p) => { if (text.includes(p)) hits.push(p); });
  AI_CLICHE.patterns.forEach((re) => { const m = text.match(re); if (m) hits.push(m[0]); });
  return { hitCount: hits.length, hits: Array.from(new Set(hits)), pass: hits.length <= AI_CLICHE.maxHitsPerEpisode };
}

/** 双制式剧本格式（刚性字数区间，单位：字） */
export const SCRIPT_FORMAT = {
  LIVE: { min: 800, max: 1000, name: '真人实拍', fields: ['集数+标题', '场景(时间/地点/内外景)', '人物', '动作提示', '台词(情绪/动作标注)'] },
  AIGC: { min: 1200, max: 1500, name: 'AIGC制作', fields: ['集数+标题', '镜头(景别/运镜/光影)', '场景氛围', '人物状态(表情/动作/微情绪)', '台词', '音效/配乐'] },
} as const;
export type ScriptMode = keyof typeof SCRIPT_FORMAT;

export function validateEpisodeLength(text: string, mode: ScriptMode) {
  const len = text.replace(/\s/g, '').length;
  const f = SCRIPT_FORMAT[mode];
  return { len, inRange: len >= f.min && len <= f.max, min: f.min, max: f.max };
}

/** 目标平台尺度库（持续扩充；合规审核师消费） */
export const PLATFORMS = [
  { id: 'douyin', name: '抖音', episodeSec: '60-90秒', note: '前3秒强钩子，价值观正向，禁低俗血腥' },
  { id: 'kuaishou', name: '快手', episodeSec: '60-120秒', note: '下沉共情、家庭伦理，尺度偏严' },
  { id: 'hongguo', name: '红果', episodeSec: '1-3分钟', note: '免费分账，爽点密度高，禁违规价值观' },
  { id: 'wechat_mini', name: '微信小程序', episodeSec: '1-2分钟', note: '付费卡点清晰，投流合规' },
  { id: 'reelshort', name: 'ReelShort(海外)', episodeSec: '1-2分钟', note: '狼人/霸总/婚恋，文化本地化，禁中式说教' },
] as const;

/** 八大创作模式各自方法论要点（中央调度按模式注入） */
export const MODE_METHOD: Record<string, string[]> = {
  interview: ['四维记忆空间素材优先', '用户表达完毕才生成', '碎片信息结构化补全'],
  adapt: ['原著尊重度可调', '续写/衍生/联动/同人四态', '保留人设内核'],
  tags: ['四级标签严格命中', '标签组合决定人设与冲突', '随机标签需用户确认'],
  novel: ['压缩冗余叙事', '强化每集钩子', '名场面优先提取'],
  interactive: ['分支必须闭环无死胡同', '选择项有真实后果', '多结局匹配人物弧光'],
  scene: ['名场面为情绪峰值', '向前补因向后补果', '逻辑情绪双连贯'],
  hotspot: ['2小时内快速适配', '借势程度三档', '侵权风险前置提示'],
  viral_reverse: ['只复用底层逻辑不复制表达', '替换人设/背景/世界观', '批量3-5版强制差异化'],
  hit_lab: ['名场面为情绪峰值，向前补因向后延果', '逆向只复用方法论骨架、绝不复制原表达', '批量3-5版强制差异化并做重合度校验'],
  long_ip: ['系列圣经总控：时间线/关系/伏笔账本不与既定设定矛盾', '每季独立季问题+季终大钩开启下季', '跨季成长谱系不重置、伏笔登记兑付季', '多IP联动各守规则、统一统辖、粉丝各有兑付'],
};
/** v2.00 八大模式方法论英文层（键与 MODE_METHOD 对齐，默认中文不变） */
export const MODE_METHOD_EN: Record<string, string[]> = {
  interview: ['Prioritize the four-dimension memory-space material', 'Generate only after the user finishes expressing', 'Structure and complete fragmented information'],
  adapt: ['Adjustable fidelity to the source', 'Four modes: continue / spin-off / crossover / fan-fiction', 'Keep the character core'],
  tags: ['Strictly hit the four-level tags', 'The tag combo determines characters and conflict', 'Random tags need user confirmation'],
  novel: ['Compress redundant narration', 'Strengthen every episode hook', 'Extract famous scenes first'],
  interactive: ['Branches must close with no dead ends', 'Choices carry real consequences', 'Multiple endings match character arcs'],
  scene: ['The famous scene is the emotional peak', 'Backfill cause before and consequence after', 'Keep logic and emotion both coherent'],
  hotspot: ['Rapid adaptation within 2 hours', 'Three levels of trend-borrowing', 'Flag infringement risk up front'],
  viral_reverse: ['Reuse only underlying logic, never the expression', 'Replace characters/setting/worldview', 'Force 3-5 differentiated versions in a batch'],
  hit_lab: ['The signature scene is the emotional peak; backfill cause before and consequence after', 'Reverse-engineering reuses only the method skeleton, never original expression', 'Force 3-5 differentiated versions with an overlap check'],
  long_ip: ['Series bible governs: timeline/relationship/foreshadow ledgers never contradict canon', 'Each season has its own question and a season-end mega-hook opening the next', 'Cross-season growth never resets; every foreshadow is assigned a payoff season', 'In crossovers each IP keeps its rules under one shared rule-set and each fanbase gets a payoff'],
};

/** 六岗位指令（注入各模型 system prompt 的专业内功） */
export const ROLE_DIRECTIVE: Record<RoleId, string> = {
  architect: '你是顶级短剧结构师。先用黄金三秒钩子定开场，按 钩子-冲突-反转-留白 排每集节奏；爽点前置、每集结尾必留钩子；付费卡点前埋最强反转。从钩子库选型但不得套用同一套路。',
  character: '你是人设大师。用身份/性格/境遇/认知反差立人物，补齐隐性设定五维（原生家庭/习惯/喜忌/思维/底层欲望），所有行为由底层欲望驱动，配角与反派也需自洽动机。',
  writer: '你是单集撰写师。严格依据上游《大纲》的节拍/钩子和《人物卡》的底层欲望与说话风格写本集，不得另起炉灶；台词是口语、有潜台词、可被打断；冲突升级、结尾强钩子；遵守双制式格式与字数区间，禁止提示词式写法。',
  audience: '你是观众代言官，代表目标受众的“手指”。逐段预判哪里会划走、爽点是否到位、想不想看下一集；输出JSON {riskPoints:[{at,reason}],cravingScore:0-100,wantNext}。cravingScore低于70必须指出具体改法，倒逼撰写师强化。若体裁是单条带货/种草/口播短视频（非连续剧），cravingScore改评“转化欲”——看完是否想点行动引导、是否记住核心卖点；wantNext改为是否想点小黄车或记住品牌；打回理由围绕痛点未戳中、卖点未砸实、行动引导无力展开。',
  polish: '你是细节润色师兼去AI专员。在撰写师原稿上做“整稿修订”（保留剧情骨架与人物，输出完整修订稿，不要另写一个新故事、不要重复堆叠）：注入有叙事作用的烟火气细节，清除一切AI腔（禁用 AI_CLICHE 词表与排比套路），台词回归生活的不完美。',
  compliance: '你是合规审核师。按目标平台尺度库逐条核对内容安全与价值观，风险点打回；用户选择忽略规则时仍需记录风险。',
  market: '你是市场分析师。从人物/剧情/台词/市场/格式/去AI化六维打分（每维0-100整数，overall同为0-100整数，不得用10分制），给出可执行优化建议与爆款潜力评估，匹配投稿渠道。',
};

/** v1.99 六岗位系统内功（英文，键与 ROLE_DIRECTIVE 对齐，默认中文逐字不变） */
export const ROLE_DIRECTIVE_EN: Record<RoleId, string> = {
  architect: 'You are a top-tier short-drama structuralist. Open with a golden-3-seconds hook, pace every episode as hook–conflict–reversal–breathing room; front-load payoffs and always end on a hook; place the strongest reversal right before a paywall point. Choose from the hook library but never reuse the same formulaic template.',
  character: 'You are a character master. Build people through identity/personality/circumstance/cognition contrast, complete the five hidden dimensions (family of origin, habits, likes & taboos, mindset, deepest desire), drive every action from that deepest desire, and give supporting roles and villains self-consistent motives.',
  writer: 'You are the episode writer. Strictly follow the upstream Outline beats/hooks and the Cast’s deepest desires and voices; do not start a different story. Dialogue is colloquial, carries subtext and can be interrupted; escalate conflict and end on a strong hook; obey the dual script format and word-count range; never write prompt-style text.',
  audience: 'You are the audience advocate, representing the viewer’s hovering finger. Beat by beat, predict where they swipe away, whether payoffs land, and whether they want the next episode; output JSON {riskPoints:[{at,reason}],cravingScore:0-100,wantNext}. Below 70 you must point to concrete fixes to force the writer to strengthen the draft. If the piece is a single short video (product selling / seeding / talking-head) rather than a serialized drama, cravingScore instead measures conversion intent — whether the ending makes viewers tap the call-to-action and remember the core selling point; wantNext describes whether they would tap the cart link or remember the brand; rejection reasons should target unpierced pain points, unproven selling points, or a weak call-to-action.',
  polish: 'You are the detail polisher and de-AI officer. Revise the writer’s draft as a whole (keep the plot skeleton and characters, output a complete revised script, do not write a new story and do not stack duplicates): inject purposeful, lifelike detail, remove every AI tell (banned AI_CLICHE words and parallelism), and return dialogue to the imperfection of real life.',
  compliance: 'You are the compliance reviewer. Check content safety and values line by line against the target platform’s rules, and send risky points back; even when the user chooses to ignore rules, still record the risk.',
  market: 'You are a market analyst. Score six dimensions—character/plot/dialogue/market/format/de-AI—each on a 0-100 integer scale (overall must also be a 0-100 integer, never a 10-point scale); give actionable optimization advice and hit-potential assessment, and match submission channels.',
};

/** 中央调度：为某岗位组装完整创作上下文 */
export function buildRoleDirective(role: RoleId, mode?: string, lang: 'zh' | 'en' = 'zh'): string {
  const base = lang === 'en' ? ROLE_DIRECTIVE_EN[role] : ROLE_DIRECTIVE[role];
  const methodLib = lang === 'en' ? MODE_METHOD_EN : MODE_METHOD;
  const modeTip = mode && methodLib[mode] ? (lang === 'en' ? `\nMode essentials: ${methodLib[mode].join('; ')}.` : `\n本模式要点：${methodLib[mode].join('；')}。`) : '';
  return `${base}${modeTip}`;
}
