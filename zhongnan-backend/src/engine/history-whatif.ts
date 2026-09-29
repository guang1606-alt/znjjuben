/**
 * 历史脑洞 / What-if 创作方法论（源自“历史的另一种（离谱）可能”这类内容方向）
 * ----------------------------------------------------------------
 * 核心公式：一个观众认得的【真实历史锚点】 × 一个【离谱变量】 → 用当代逻辑自洽推演 → 反差喜感/新奇感。
 * 成立前提是“观众认得出锚点”：完全架空就不是历史脑洞，完全胡说会翻车，锚点必须真实可辨。
 *
 * 合规边界：本模块只【声明红线类别】，不内置任何敏感词表；具体文本检测依赖注入全局合规检测器
 * （依赖倒置，敏感词统一由合规中台维护，避免各处散落、口径不一）。
 */
export type WhatIfVariable =
  | 'event_flip'      // 关键历史事件走向反转
  | 'person_misplace' // 历史人物错位到另一时代/处境
  | 'tech_shift'      // 科技树/关键发明提前或滞后
  | 'rule_swap'       // 某条社会规则被替换
  | 'nobody_view';    // 用小人物视角重看大历史（最安全的路径）

export const WHATIF_VARIABLES: { type: WhatIfVariable; name: string; how: string }[] = [
  { type: 'event_flip', name: '事件反转', how: '挑一个结果人尽皆知的历史节点，只改一个关键选择，往后严密推演连锁反应' },
  { type: 'person_misplace', name: '人物错位', how: '把真实历史人物的性格能力放进错位的现代/异质处境，用其固有性格做反应' },
  { type: 'tech_shift', name: '科技树偏移', how: '让某项关键发明/作物/制度提前或晚出现数百年，推演社会结构连锁变化' },
  { type: 'rule_swap', name: '规则替换', how: '把一条古代规则换成当代规则（或反过来），让人物在错位规则里认真生活' },
  { type: 'nobody_view', name: '小人物视角', how: '不改大人物定论，从马夫/厨子/账房等小人物视角侧写大时代，安全又新鲜' },
];

/** 历史脑洞红线类别（只声明类别，判定词表归合规中台） */
export const HISTORY_REDLINE_CATEGORIES = [
  '革命先烈与英雄烈士不得戏谑丑化',
  '已有法定/历史定论的重大事件不得翻案、歪曲',
  '各民族与宗教不得贬损、挑动对立',
  '国家领导人不得作为戏说、穿越、恶搞对象',
  '重大历史是非与国际关系定评不得篡改',
] as const;

export interface WhatIfBriefInput { anchor: string; variable?: WhatIfVariable; tone?: '喜剧' | '热血' | '悬疑' | '温情' }
/** 生成历史脑洞创作简报（注入架构/撰写岗 prompt） */
export function historyWhatIfBrief(inp: WhatIfBriefInput): string {
  const v = WHATIF_VARIABLES.find((x) => x.type === (inp.variable ?? 'event_flip')) ?? WHATIF_VARIABLES[0];
  const tone = inp.tone ?? '喜剧';
  return [
    `【历史脑洞 What-if 创作法】`,
    `1. 真实锚点：以“${inp.anchor || '一个观众普遍认得的历史人物/事件/常识'}”为锚，先保留可被一眼认出的史实骨架（年代、人物性格、关键常识），这是梗能被接住的前提；`,
    `2. 单一离谱变量：只引入一个“${v.name}”——${v.how}。一次只改一个变量，反差才清晰，多变量会变成胡闹；`,
    `3. 自洽推演：变量之后每一步都按人物性格与现实逻辑认真推演，“一本正经地离谱”，越认真越上头；`,
    `4. 基调${tone}：反差中保持情感真实，人物的欲望、为难、选择让当代观众共情（联动真情感/活人感）；`,
    `5. 收束：每个脑洞落点要么有反转包袱，要么以古照今，避免为离谱而离谱；`,
    `6. 合规红线（命中即改用“小人物视角”或更换锚点）：${HISTORY_REDLINE_CATEGORIES.join('；')}。`,
  ].join('\n');
}

/** 给定锚点，一次给出全部 5 个变量方向的脑暴（供用户挑/随机） */
export function whatIfIdeas(anchor: string): { type: WhatIfVariable; name: string; premise: string }[] {
  const a = anchor || '该历史锚点';
  const premise: Record<WhatIfVariable, string> = {
    event_flip: `假如${a}的关键选择走向另一种结果，接下来会怎样连锁演变`,
    person_misplace: `假如${a}里那位带着原本的性格本事，空降到当代职场/校园/直播间`,
    tech_shift: `假如${a}时代提前拥有某样现代关键技术（或现代失去某样技术），社会会被怎样重写`,
    rule_swap: `假如${a}那条天经地义的规则被换成当代规则，所有人都得认真照做`,
    nobody_view: `不写大人物，改写${a}洪流里一个马夫/厨子/小吏的一天，大历史从他身边经过`,
  };
  return WHATIF_VARIABLES.map((v) => ({ type: v.type, name: v.name, premise: premise[v.type] }));
}

export type GlobalSensitiveChecker = (text: string) => string[]; // 返回命中的风险类别（由合规中台注入）
export interface HistorySafeResult { safe: boolean; hitCategories: string[]; fallbackAdvice: string }
/**
 * 历史脑洞合规校验：本模块不持有敏感词，检测逻辑由外部合规检测器注入。
 * 未注入检测器时返回 safe=false 的“待检”状态，绝不默认放行（安全侧默认拒绝）。
 */
export function assertHistorySafe(text: string, checker?: GlobalSensitiveChecker): HistorySafeResult {
  const fallbackAdvice = '历史脑洞优先采用“小人物视角”，并把成稿交合规审核师/全局敏感词库复核后再输出';
  if (!checker) return { safe: false, hitCategories: [], fallbackAdvice: '未接入全局合规检测器，按待处理：' + fallbackAdvice };
  const hit = checker(text || '');
  return { safe: hit.length === 0, hitCategories: hit, fallbackAdvice: hit.length ? '命中红线类别，改用小人物视角或更换历史锚点' : fallbackAdvice };
}
