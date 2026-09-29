/**
 * craft-insights.ts —— 一线编剧实战洞察引擎
 *
 * 来源：2026-08-31 管理员投喂的 9 条一线短剧编剧短视频，其中 7 条成功提取逐字稿并沉淀于此，
 *      2 条（「听花岛爆火真相」「短剧别再只会复仇了」）被抖音分享页拦截、未取得逐字稿，不凭标题臆造，待补可访问链接。
 *
 * 与既有引擎的分工（避免重复/相悖）：
 *  - 钩子分层与排布 → hook-system（开场3秒狠钩子已由 OPEN_HOOKS 覆盖，本模块不再重复）
 *  - 生活化细节填充/去悬浮 → lifelike
 *  - 人设行为一致性 → character-logic
 *  - 本模块补齐五块：①选题风向(带时效) ②情绪代偿本质 ③传播标题前13字公式
 *    ④封闭微场景=关系图的冲突写法 ⑤人物驱动校验(人物不被剧情推着走)
 *  所有结论都以"可执行指令 + 可检验纯函数"落地，真正参与生成与质检，而非死知识。
 */

export const CRAFT_SOURCE = {
  date: '2026-08-31',
  total: 9,
  extracted: 7,
  blocked: ['听花岛短剧爆火真相', '短剧别再只会复仇了'],
  note: '被平台拦截的2条未取得逐字稿，未据标题臆造内容',
};

/* ===================== 1. 选题风向（带时效，可被自学习更新淘汰） ===================== */

export type Medium = '真人实拍' | 'AI仿真人' | '漫剧';
export type Segment = '女频' | '男频';

export interface TopicWind {
  id: string;
  name: string;
  segment: Segment;
  /** 核心打法 */
  core: string;
  /** 反面：不要怎么做 */
  avoid: string;
  /** 更适配的载体 */
  mediums: Medium[];
}

/** 2026 下半年风向（asOf 标注时效；过期后由自主学习闭环用新信号替换，不写死为永恒真理） */
export const TOPIC_WIND_ASOF = '2026H2';
export const TOPIC_WIND: TopicWind[] = [
  {
    id: 'female_growth_real',
    name: '现实女性成长',
    segment: '女频',
    core: '女主开场就有自己的目标（职场/婚姻/家庭皆可），主线是“她如何把人生主动权重新拿回来”',
    avoid: '不要再写被虐几十集、直到结尾才突然翻身',
    mediums: ['真人实拍', 'AI仿真人', '漫剧'],
  },
  {
    id: 'female_courtship_power',
    name: '古风权谋+强感情',
    segment: '女频',
    core: '女主主动为自己布局，男女主既合作又博弈，感情随权谋一起升级',
    avoid: '单纯宫斗宅斗已高度撞题，不要只争宠斗气',
    mediums: ['AI仿真人', '漫剧', '真人实拍'],
  },
  {
    id: 'female_suspense_emotion',
    name: '悬疑+情感',
    segment: '女频',
    core: '用一个秘密/谜团推动人物关系，观众既想知道真相、也想知道两人最终关系',
    avoid: '不是写纯刑侦；不要为破案而破案、丢掉情感牵引',
    mediums: ['真人实拍', 'AI仿真人', '漫剧'],
  },
  {
    id: 'male_underdog_vest',
    name: '都市逆袭+身份马甲',
    segment: '男频',
    core: '每揭开一层身份，都必须换来一次新的情绪回报，掉马=兑付',
    avoid: '不要堆十几个身份硬掉马、却没有对应的情绪兑付',
    mediums: ['真人实拍', 'AI仿真人'],
  },
  {
    id: 'male_rebirth_twist',
    name: '重生复仇+微创新',
    segment: '男频',
    core: '职场/身份/关系/世界观至少换掉一个；AI仿真人与漫剧可把现实难拍、高成本设定放大胆',
    avoid: '原封不动复刻老重生套路',
    mediums: ['AI仿真人', '漫剧', '真人实拍'],
  },
];

/** 三种载体各自拼什么（避免用同一套标准要求不同载体） */
export const MEDIUM_EDGE: Record<Medium, string> = {
  真人实拍: '拼真实情绪（演员可承担部分情绪，剧本仍要给足）',
  AI仿真人: '拼设定与视觉（现实难拍的高成本设定可大胆做）',
  漫剧: '拼世界观与想象力（大世界观、强视觉设定空间最大）',
};
/** 万变不离其宗的留人底层 */
export const TOPIC_BOTTOM_LINE = '题材只是入口，真正留住人的是人物冲突与情绪；单纯复制旧爆款会越来越难。';
/** v1.94 选题风向英文层（id 键控）：英文分区/名称/打法/避坑 */
export const TOPIC_EN: Record<string, { segment: string; name: string; core: string; avoid: string }> = {
  female_growth_real: { segment: 'Female', name: 'Realistic female growth', core: 'The lead has her own goal from the opening (career/marriage/family); the spine is how she takes back control of her life.', avoid: 'No more dozens of episodes of abuse with a sudden turnaround only at the end.' },
  female_courtship_power: { segment: 'Female', name: 'Period intrigue + strong romance', core: 'She schemes for herself; the leads cooperate and clash, and romance escalates with the intrigue.', avoid: 'Pure harem bickering is saturated; don’t just fight for favor.' },
  female_suspense_emotion: { segment: 'Female', name: 'Suspense + emotion', core: 'A secret/mystery drives the relationship; viewers want both the truth and where the pair ends up.', avoid: 'Not a pure police procedural; don’t chase the case and drop the emotional pull.' },
  male_underdog_vest: { segment: 'Male', name: 'Urban underdog + hidden identity', core: 'Every identity reveal must buy a fresh emotional payoff; the unmasking is the payout.', avoid: 'Don’t stack a dozen identities with no emotional payoff for each.' },
  male_rebirth_twist: { segment: 'Male', name: 'Rebirth revenge + micro-innovation', core: 'Change at least one of career/identity/relationship/worldview; AI-realistic and motion-comic can boldly amplify costly, hard-to-film premises.', avoid: 'Don’t copy the old rebirth template verbatim.' },
};
/** v1.94 留人底层（英文） */
export const TOPIC_BOTTOM_LINE_EN = 'Genre is only the doorway; what truly retains viewers is character conflict and emotion; blindly copying past hits gets harder over time.';

export function recommendTopics(segment?: Segment, medium?: Medium): TopicWind[] {
  return TOPIC_WIND.filter((t) => {
    if (segment && t.segment !== segment) return false;
    if (medium && !t.mediums.includes(medium)) return false;
    return true;
  });
}

/* ===================== 2. 情绪代偿（短剧真正卖的东西） ===================== */

export interface Compensation {
  id: string;
  /** 观众现实里的缺失/憋屈 */
  realLack: string;
  /** 剧中如何在约2分钟内即时解决 */
  instantPayoff: string;
}

export const EMOTION_COMPENSATION: Compensation[] = [
  { id: 'instant_justice', realLack: '现实里被欺负只能忍、无处说理', instantPayoff: '一个电话/一次亮身份，欺负人者立刻付出代价（即时正义）' },
  { id: 'status_turn', realLack: '被看不起、被衡量身价', instantPayoff: '下一集身份曝光，轻视者当场变脸（地位反转）' },
  { id: 'protected', realLack: '受委屈时没人撑腰', instantPayoff: '主角被欺时有人坚定站出撑腰（被守护感）' },
  { id: 'take_back_life', realLack: '人生被他人安排、身不由己', instantPayoff: '主角主动夺回主导权，替观众活出“不忍了”的人生' },
];
/** 短剧卖的不是霸总/豪门，而是“如果我有权力就不用再忍”的代偿；立场必须清晰（反派坏得明显、主角反击有理由） */
export const COMPENSATION_BOTTOM_LINE =
  '短剧卖的不是霸总或豪门，是“现实里忍下的气，在2分钟内被解决”的情绪代偿；一集只有一两分钟，反派要坏得明显、主角反击要有理由，观众没时间猜好坏。新一代受众要的是“我可以喜欢你，但不会为你丢掉我自己”的主体性。';
/** v1.98 情绪代偿底线（英文） */
export const COMPENSATION_BOTTOM_LINE_EN =
  'Short drama does not sell CEOs or wealth—it sells emotional compensation: the frustration you swallow in real life is resolved within about two minutes. With only a minute or two per episode, make the villain clearly wrong and the lead’s comeback earned; viewers have no time to guess who is good or bad. Modern audiences want agency: “I can love you, but I will not lose myself for you.”';

/* ===================== 3. 传播标题前13字公式（身份+冲突+反差） ===================== */

const IDENTITY_HINTS = ['我', '老板', '总裁', '保姆', '外卖员', '保洁', '保安', '妈', '婆婆', '妻', '夫', '前妻', '前夫', '编剧', '重生', '千金', '司机', '厨师', '阿姨', '大叔', '掌门', '王妃', '太子'];
const CONFLICT_HINTS = ['抢', '逼', '离', '赶', '查', '灭', '困', '选', '撕', '退婚', '开除', '困住', '绑架', '陷害', '背叛', '摊牌', '翻脸', '收购', '离婚', '逼婚', '复仇', '大开金手指', '别想困住'];
const CONTRAST_HINTS = ['却', '竟', '原来', '偏偏', '表面', '实际', '转身', '没想到', '重生', '伪装', '隐藏', '真实身份', '大开', '外人'];

export interface TitlePitchResult {
  first13: string;
  hasIdentity: boolean;
  hasConflict: boolean;
  hasContrast: boolean;
  /** 0~100，三要素齐全=100 */
  score: number;
  advice: string[];
}

/**
 * 传播端选题/标题校验：前13个字里最好同时放进【身份+冲突+反差】。
 * 注意：热度高≠剧本质量高，只代表传播端被接住（此校验服务于传播，不替代质量评分）。
 */
export function titlePitchCheck(title: string): TitlePitchResult {
  const first13 = String(title || '').trim().slice(0, 13);
  const hasIdentity = IDENTITY_HINTS.some((k) => first13.includes(k));
  const hasConflict = CONFLICT_HINTS.some((k) => first13.includes(k));
  const hasContrast = CONTRAST_HINTS.some((k) => first13.includes(k));
  const score = Math.round(((Number(hasIdentity) + Number(hasConflict) + Number(hasContrast)) / 3) * 100);
  const advice: string[] = [];
  if (!hasIdentity) advice.push('前13字补一个清晰身份/关系/职业（如外卖员、前妻、保洁阿姨）');
  if (!hasConflict) advice.push('前13字点出核心冲突动作（被逼、被赶、摊牌、收购等）');
  if (!hasContrast) advice.push('前13字埋一个反差/错位（表面…实际、原来、重生、身份错位）');
  if (first13.length < 8) advice.push('标题过短，信息密度不足');
  if (score === 100) advice.push('前13字已含身份+冲突+反差，传播抓手齐全');
  return { first13, hasIdentity, hasConflict, hasContrast, score, advice };
}

/* ===================== 4. 封闭微场景 = 一张人物关系图 ===================== */

export interface MicroScene {
  id: string;
  name: string;
  /** 这个场景里天然可用的关系杠杆 */
  relationLevers: string[];
  example: string;
}

export const MICRO_SCENES: MicroScene[] = [
  { id: 'dinner_table', name: '饭桌/年夜饭', relationLevers: ['谁坐主位', '谁给谁夹菜', '谁被晾在一边', '有没有谁的位置/碗筷'], example: '婆婆一句“家宴，外人就别坐了”，无人动手却立见女主地位；女主反手拉椅坐下“巧了，我今天还就饿了”，戏立刻起来' },
  { id: 'wet_market', name: '菜市场', relationLevers: ['谁抢谁的摊位', '谁偷偷降价', '谁欠谁钱没还', '谁家儿女突然开豪车回来'], example: '天天为两块钱砍价的大叔，竟是要收购整个菜市场的老板' },
  { id: 'elevator', name: '电梯', relationLevers: ['谁帮谁按楼层', '狭小空间里谁回避眼神', '谁被挤到最后'], example: '她在电梯里听见两个同事议论自己，门一开，她就是新来的总监' },
  { id: 'wedding', name: '婚礼', relationLevers: ['主桌席位', '敬酒顺序', '谁被安排坐角落', '新郎/新娘迟到'], example: '敬酒到主桌，新娘发现主位坐着的“亲戚”正是自己亲生母亲' },
  { id: 'parent_meeting', name: '家长会', relationLevers: ['谁被当众点名', '谁的家长没来', '座位按成绩排'], example: '被老师当众奚落的家长，转头被校长毕恭毕敬请上台' },
  { id: 'hospital_room', name: '病房/产房外', relationLevers: ['谁守在门口', '谁先问保大保小/钱', '谁签字'], example: '产房外婆家人只问男孩女孩，亲生父亲默默交了全部费用' },
];

/** 通用、偷懒的“震惊式反应”——应替换成符合人物性格的专属反应 */
export const GENERIC_REACTIONS = ['震惊', '不敢相信', '怎么可能', '居然是', '万万没想到', '瞪大了眼睛', '倒吸一口凉气', '一脸不可置信', '满脸震惊', '目瞪口呆'];

export interface GenericReactionResult {
  hits: string[];
  count: number;
  advice: string;
}

export function genericReactionScan(text: string, lang: 'zh' | 'en' = 'zh'): GenericReactionResult {
  const src = String(text || '');
  const hits = GENERIC_REACTIONS.filter((w) => src.includes(w));
  return {
    hits,
    count: hits.length,
    advice: lang === 'en'
      ? 'At an identity/truth reveal, avoid generic reactions (“shocked”, “how is that possible”, wide-eyed disbelief). Replace them with words and actions only THIS character would have (e.g. a street-food vendor: “You’re that rich? Then why haggle over two yuan for half an hour?”)—the character instantly comes alive.'
      : '身份/真相揭晓时不要写“震惊、居然这么有钱”这类通用反应，要换成只有这个人物才会说的话、做的动作（如卖菜阿姨：“你这么有钱，前两天两块钱你跟我磨半小时？”），人物一下就活。',
  };
}

/* ===================== 5. 人物驱动校验（人物不被剧情推着走） ===================== */

// 主动意志信号：人物自己想要/决定/行动
const ACTIVE_GOAL_HINTS = ['想要', '要夺回', '决定', '计划', '誓要', '一定要', '证明', '查清', '逃离', '主动', '目标', '布局', '争取', '反抗', '拒绝', '选择', '拿回', '守住'];

export interface CharacterDrivenResult {
  hasActiveGoal: boolean;
  activeSignals: string[];
  advice: string[];
}

/**
 * 判断梗概/大纲里主角是否有“自己的目标与主动行动”。
 * 对应《渐染》拆解：人物情绪逻辑优先于剧情堆砌；人物不能全靠外部事件推着走。
 */
export function characterDrivenScan(outline: string): CharacterDrivenResult {
  const src = String(outline || '');
  const activeSignals = ACTIVE_GOAL_HINTS.filter((w) => src.includes(w));
  const advice: string[] = [];
  if (!activeSignals.length) {
    advice.push('主角缺少主动目标与主动行动，存在“被剧情推着走”的风险：开场就要交代TA想要什么、打算怎么做');
  }
  advice.push('给主角留缺陷与内心（如原生家庭带来的自卑、面对感情的怯懦），丰富内心世界才有代入与同情');
  advice.push('前面埋的伏笔/细节，后面回收时要形成情绪兑付（填坑瞬间情绪冲击拉满）');
  advice.push('AIGC（AI仿真人/漫剧）不会像真人演员那样自行补情绪，人物动机、情绪、心理活动必须在剧本里写足，否则成片会暴露空洞');
  return { hasActiveGoal: activeSignals.length > 0, activeSignals, advice };
}

/* ===================== 6. 岗位指令片段（注入 pipeline，最小侵入） ===================== */

export type CraftLang = 'zh' | 'en';
export function craftArchitectBrief(lang: CraftLang = 'zh'): string {
  const en = lang === 'en';
  if (en) {
    const topics = recommendTopics().map((t) => {
      const e = TOPIC_EN[t.id];
      return e ? `[${e.segment}]${e.name}: ${e.core} (avoid: ${e.avoid})` : '';
    }).filter(Boolean).join('; ');
    return [
      '[Frontline screenwriter craft · Structure]',
      `Topic winds (${TOPIC_WIND_ASOF}, reference only, do not follow blindly): ${topics}. ${TOPIC_BOTTOM_LINE_EN}`,
      'The protagonist must have their own goal and act on it from the opening; never let external events drag the character along.',
      'Conflict need not rely on car crashes/kidnapping/bankruptcy: prefer one enclosed micro-scene (dinner table / wet market / elevator / wedding / parent meeting) where seating, one action and one line detonate the biggest rift between characters.',
      'Every layer of a hidden identity must buy a fresh emotional payoff—never unmask into an empty beat.',
    ].join('\n');
  }
  const topics = recommendTopics().map((t) => `[${t.segment}]${t.name}：${t.core}（避免：${t.avoid}）`).join('；');
  return [
    '【一线编剧实战·架构】',
    `选题风向(${TOPIC_WIND_ASOF}，仅作参考不盲从)：${topics}。${TOPIC_BOTTOM_LINE}`,
    '主角开场就必须有自己的目标与主动行动，禁止全靠外部事件推着走。',
    '冲突不必靠车祸/绑架/破产堆大：优先用一个封闭微场景（饭桌/菜市场/电梯/婚礼/家长会）的座次、动作、一句话，把人物间最大矛盾炸出来。',
    '身份马甲每揭开一层，都必须换来一次新的情绪回报，不掉空马。',
  ].join('\n');
}

export function craftWriterBrief(lang: CraftLang = 'zh'): string {
  if (lang === 'en') {
    return [
      '[Frontline screenwriter craft · Drafting]',
      'In an enclosed micro-scene conflict, use relationship levers—seating, serving food, who is left hanging, whose seat is missing—to show status and rift; land the scene with small actions and one counter-line instead of narration.',
      genericReactionScan('', 'en').advice,
      'Character emotional logic first: let flawed, inner people make choices, and pay off every planted detail with full emotional force. AI-generated footage cannot add emotion on its own—motivation, inner life and micro-emotions must be written into the script.',
      COMPENSATION_BOTTOM_LINE_EN,
    ].join('\n');
  }
  return [
    '【一线编剧实战·成稿】',
    '写封闭微场景冲突时，用座次/夹菜/晾着谁/没有谁的位置等关系杠杆交代地位与矛盾，用小动作和一句反击把戏立起来，而不是靠旁白说明。',
    genericReactionScan('').advice,
    '人物情绪逻辑优先：带着缺陷与内心做选择，伏笔回收处给足情绪兑付；AI成片无法自行补情绪，动机、心理活动、微情绪必须写进剧本。',
    `${COMPENSATION_BOTTOM_LINE}`,
  ].join('\n');
}

export function craftAudienceBrief(lang: CraftLang = 'zh'): string {
  if (lang === 'en') {
    return [
      '[Audience advocate · emotional-compensation lens] When critiquing, judge: within about two minutes, does this beat solve for the viewer a problem they swallow in real life (instant justice / status reversal / being protected / taking back their life)?',
      'Does the lead have agency (“I can love you, but I will not lose myself”)? Is the villain clearly in the wrong and the lead’s comeback earned? Where exactly would a viewer swipe away?',
    ].join('\n');
  }
  return [
    '【观众代言·情绪代偿视角】挑刺时判断：这段是否在约2分钟内替观众解决了一个现实里忍下的问题（即时正义/地位反转/被守护/夺回人生）？',
    '主角是否有主体性（“我可以喜欢你，但不会为你丢掉我自己”）？反派是否坏得够明显、主角反击是否有理由？哪里观众会划走？',
  ].join('\n');
}

export function craftMarketBrief(lang: CraftLang = 'zh'): string {
  return lang === 'en'
    ? 'Distribution tip: try to pack [identity + conflict + contrast] into the first 13 characters of the outward title/cover (validate with titlePitchCheck). Remember: heat ≠ script quality; scoring still rests on character, emotion and logic.'
    : '传播建议：对外标题/封面前13字尽量同时含【身份+冲突+反差】（可用 titlePitchCheck 校验）；切记传播热度≠剧本质量，评分仍以人物、情绪、逻辑为准。';
}
