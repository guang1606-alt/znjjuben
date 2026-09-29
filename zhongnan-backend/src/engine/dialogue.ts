/**
 * 台词口语化校准引擎（PRD 2.1.2）
 *  - 识别书面腔/说教腔/AI 腔，按“口语化程度”档位判定
 *  - 按角色年龄/身份/地域/性格生成说话方式指令，喂给人设师与撰写师
 * 目标：台词像真人说的，有“不完美感”，不工整、不说教、不书面。
 */

export type ColloquialLevel = 'low' | 'mid' | 'high';
export const COLLOQUIAL: Record<ColloquialLevel, { maxPer100: number; label: string }> = {
  low: { maxPer100: 5, label: '相对规整（古装权谋/职场精英）' },
  mid: { maxPer100: 2.5, label: '自然口语（默认）' },
  high: { maxPer100: 1, label: '高度口语（现实/下沉/市井）' },
};

/** 书面腔 / 说教腔 / AI 腔标记，命中即“不像人话”，并给口语替换 */
export const WRITTEN_MARKERS = [
  // 原 23 个：基础书面腔与AI套话
  { word: '然而', fix: '可 / 但是' }, { word: '因此', fix: '所以' }, { word: '此外', fix: '再说 / 还有' },
  { word: '与此同时', fix: '这时候 / 另一边' }, { word: '换言之', fix: '说白了' }, { word: '毋庸置疑', fix: '删，直接说事' },
  { word: '众所周知', fix: '删，谁都知道别说' }, { word: '总而言之', fix: '反正' }, { word: '综上所述', fix: '删' },
  { word: '于是乎', fix: '结果' }, { word: '故而', fix: '所以' }, { word: '与此同时', fix: '这时候' },
  { word: '你应该', fix: '改成具体的话，别教育' }, { word: '我们必须', fix: '喊口号，删' },
  { word: '这就是', fix: '别下结论' }, { word: '人生就是', fix: '说教，删' }, { word: '所谓的', fix: '删' },
  { word: '仿佛', fix: '像 / 跟……似的' }, { word: '宛如', fix: '像' }, { word: '那一刻', fix: '这时候' },
  { word: '空气仿佛凝固', fix: 'AI 套话，换成具体动作' }, { word: '嘴角勾起一抹', fix: 'AI 套话，换真实表情' },
  { word: '不禁', fix: '删，直接做动作' }, { word: '缓缓开口', fix: '说 / 冒出一句' },
  // v2.91 新增 17 个：覆盖更多 AI 套话、书面腔、说教腔与网文坏味
  { word: '眼眸', fix: '眼 / 眼神' }, { word: '眸子', fix: '眼 / 眼睛' }, { word: '一抹笑意', fix: '笑了下 / 嘴角动了下' },
  { word: '淡淡地说', fix: '说 / 应了句' }, { word: '幽幽地', fix: '删，直接说' }, { word: '冷冷一笑', fix: '冷笑一声' },
  { word: '心中暗想', fix: '心里嘀咕 / 想到' }, { word: '暗自思忖', fix: '心里盘算' }, { word: '蓦地', fix: '突然 / 一下子' },
  { word: '霎时', fix: '一下 / 突然' }, { word: '瞬间', fix: '删或换成"一下"' }, { word: '一瞬', fix: '一下' },
  { word: '内心深处', fix: '心里 / 骨子里' }, { word: '心潮澎湃', fix: '心里翻腾' }, { word: '心绪复杂', fix: '心里乱' },
  { word: '思绪万千', fix: '想了一堆' }, { word: '显而易见', fix: '一眼就看出来' },
] as const;

export interface DialogueScan { hits: { word: string; fix: string }[]; colloquialScore: number; writtenPer100: number; pass: boolean; }

/** 短文本保护：每档至少容忍的书面词数，避免一句话被“每百字密度”放大误杀 */
const BASE_TOLERANCE: Record<ColloquialLevel, number> = { low: 4, mid: 2, high: 1 };

export function dialogueScan(text: string, level: ColloquialLevel = 'mid'): DialogueScan {
  const hits: DialogueScan['hits'] = [];
  for (const m of WRITTEN_MARKERS) {
    if (text.includes(m.word)) hits.push({ word: m.word, fix: m.fix });
  }
  const per100 = text.length ? (hits.length / (text.length / 100)) : 0;
  const colloquialScore = Math.max(0, 100 - hits.length * 12);
  // 绝对数兜底 + 密度约束：短文本看绝对数，长文本看密度，取更宽容者
  const cap = Math.max(BASE_TOLERANCE[level], Math.ceil((text.length / 100) * COLLOQUIAL[level].maxPer100));
  return {
    hits,
    colloquialScore,
    writtenPer100: Math.round(per100 * 10) / 10,
    pass: hits.length <= cap,
  };
}

/** 角色口吻范式：语气词 / 说话特征，按维度拼装 */
const REGION_PARTICLE: Record<string, string> = {
  // 原 5 个：基础地域口吻
  东北: '咋、啥、呗，直来直去带点自嘲幽默',
  川渝: '噻、撒、要得，软中带硬',
  粤语区: '啦、咩、点解，短句利落',
  北方: '呗、嘛、得嘞，干脆',
  南方: '呀、喔、好不好，委婉绵密',
  // v2.91 新增 5 个：补足常见地域覆盖
  西北: '咋、么、咧，倔直带糙，句尾爱拉长音',
  江浙沪: '伐、额、咯，软糯里带算计，话不说满',
  闽南: '啦、吼、齐，尾音上扬，软中带韧',
  港台: '囉、齁、有冇，中英夹杂，尾音飘',
  北方都市: '您、啊、得嘞，客气里带距离感',
};
const TRAIT_VOICE: Record<string, string> = {
  // 原 6 个：基础性格口吻
  急躁: '句子短、抢话、爱用反问，语速快',
  沉稳: '话少、停顿多、一句压场',
  泼辣: '敢怼、语气词多、不绕弯',
  怯懦: '吞吞吐吐、爱用“可能、要不、我是不是”',
  精明: '话里有话、先算账再表态',
  憨厚: '实在、不藏话、偶尔词不达意',
  // v2.91 新增 9 个：补足高频性格类型
  傲娇: '嘴硬心软、爱说"才不是为你"、反话正说',
  腹黑: '话不多、一句藏坑、表面笑里头算计',
  中二: '爱用大词、动不动"宿命/觉醒/封印"，台词戏剧化',
  社恐: '回答短、避免眼神、爱用"嗯、那个、不太知道"',
  社牛: '自来熟、第一句就喊哥姐、爱八卦和拉家常',
  闷骚: '表面沉默、关键时候冒一句狠的或撩的',
  毒舌: '一句戳人、不带脏字、爱用反讽',
  傻白甜: '说话没心机、爱用"真的吗/好厉害/怎么办"',
  暴躁: '动不动拍桌、爱用"老子/你他妈"、句尾常带吼',
};
const IDENTITY_VOICE: Record<string, string> = {
  // 原 5 个：基础身份口吻
  老板: '重结果、爱问“然后呢/成本呢”，不解释过程',
  打工人: '说“收到/行吧/又来”，带疲惫感和潜台词',
  宝妈: '三句不离孩子和家，情绪来得快',
  学生: '网络词多、语气跳、敢说敢冲',
  长辈: '爱念叨、翻旧账、用老话讲道理但别文绉绉',
  // v2.91 新增 12 个：补足常见职业身份
  医生: '问诊式短句、爱用"最近怎么样/有没有"、术语转白话',
  护士: '边忙边说、爱用"等一下啊/马上来"、温和里带催促',
  律师: '每句留余地、爱用"原则上/根据"、不带情绪',
  警察: '问句多、爱用"你叫什么/几点在哪"、压着火',
  外卖员: '一边喘一边说、爱用"不好意思/麻烦您"、句尾带抱歉',
  服务员: '礼貌中带职业化、爱用"您/这边请/稍等"、情绪藏着',
  程序员: '逻辑词多、爱用"理论上/应该没问题"、爱自嘲',
  设计师: '形容词跳、爱用"质感/调性/有点意思"、爱绕弯',
  销售: '热情过头、爱用"哥/姐您看"、句尾爱问"您觉得呢"',
  教师: '解释式、爱用"你要知道/其实"、忍不住上课',
  农民工: '话不多、爱用"俺/咱"、紧张时搓手说不出',
  退休干部: '爱用"当年/组织上"、句尾拉长、客气里带端着',
};

// v1.99 口吻范式英文层（键与中文表对齐；英文人设的自由文本 voice 直接透传）
// v2.91 同步扩充：5 地域 + 9 性格 + 12 身份，全部英文译文，确保英文链路零中文
const REGION_LABEL_EN: Record<string, string> = {
  东北: 'Northeastern', 川渝: 'Sichuan-Chongqing', 粤语区: 'Cantonese', 北方: 'Northern', 南方: 'Southern',
  西北: 'Northwestern', 江浙沪: 'Jiang-Zhe-Hu', 闽南: 'Hokkien/Min-nan', 港台: 'HK-Taiwan', 北方都市: 'Northern urban',
};
const REGION_PARTICLE_EN: Record<string, string> = {
  东北: 'Blunt, straight-talking with self-deprecating humor',
  川渝: 'Soft on the surface, firm underneath, brisk phrasing',
  粤语区: 'Short, crisp Cantonese-flavored sentences',
  北方: 'Plain and decisive, easy-going particles',
  南方: 'Gentle, indirect, soft and layered',
  西北: 'Stubborn, raw-edged, drawls the end of a line',
  江浙沪: 'Soft, calculating, never says things fully',
  闽南: 'Sentence-final rising tones, soft on the surface, tough underneath',
  港台: 'Code-switching EN-CN, floaty final particles',
  北方都市: 'Polite but distant, leans on honorifics and "noted"',
};
const TRAIT_VOICE_EN: Record<string, string> = {
  急躁: 'Short sentences, interrupts, rhetorical questions, fast tempo',
  沉稳: 'Few words, long pauses, one line settles the room',
  泼辣: 'Willing to clash, lots of particles, never beats around the bush',
  怯懦: 'Hesitant, leans on “maybe / should I / am I…”',
  精明: 'Subtext in every line, calculates before committing',
  憨厚: 'Earnest, hides nothing, occasionally fumbles for words',
  傲娇: 'Hard mouth, soft heart, says "not for you" while doing it for you',
  腹黑: 'Few words, each line hides a trap, smiling on the surface while scheming',
  中二: 'Loves big words — "destiny/awakening/seal", theatrical delivery',
  社恐: 'Short answers, avoids eye contact, leans on "um / uh / not sure"',
  社牛: 'Instantly familiar, calls everyone brother/sister, gossip-heavy',
  闷骚: 'Quiet on the surface, drops one sharp or flirty line at the key moment',
  毒舌: 'One line pierces without cursing, loves irony',
  傻白甜: 'No hidden agenda, leans on "really? / amazing / what do I do"',
  暴躁: 'Slams the table, uses "I / your mother", yells at the end',
};
const IDENTITY_VOICE_EN: Record<string, string> = {
  老板: 'Results-first, asks “so? / what’s the cost?”, skips process',
  打工人: 'Says “got it / fine / again?”, tired tone with subtext',
  宝妈: 'Keeps circling back to kids and home, quick-shifting emotions',
  学生: 'Lots of internet slang, bouncy tone, blunt and bold',
  长辈: 'Nags, dredges up the past, reasons in old sayings without being bookish',
  医生: 'Short diagnostic sentences, leans on "how have you been / any", jargon into plain speech',
  护士: 'Talks while busy, leans on "one sec / coming", warm but urging',
  律师: 'Hedges every line, leans on "in principle / according to", no emotion',
  警察: 'Asks questions, leans on "your name / what time / where", holds temper',
  外卖员: 'Speaks while catching breath, leans on "sorry / excuse me", apologetic',
  服务员: 'Polite and professional, leans on "you / this way / one moment", hides emotion',
  程序员: 'Logical connectors, leans on "in theory / should be fine", self-deprecating',
  设计师: 'Bouncy adjectives, leans on "texture / vibe / interesting", circles the point',
  销售: 'Over-warm, leans on "bro / sis look", ends with "what do you think"',
  教师: 'Explanatory, leans on "you should know / actually", can’t help lecturing',
  农民工: 'Few words, leans on "I / us", rubs hands when nervous',
  退休干部: 'Leans on "back in the day / the organization", drawls final particles',
};
export interface VoiceInput { name: string; age?: string; identity?: string; region?: string; trait?: string; voice?: string }

/** 生成单个角色的“说话方式”指令，供人设师/撰写师严格执行（v1.99 中英双语，默认中文逐字不变） */
export function buildVoiceDirective(c: VoiceInput, lang: 'zh' | 'en' = 'zh'): string {
  const en = lang === 'en';
  const parts: string[] = [];
  if (c.age) parts.push(en ? `Age ${c.age}; word choice must fit this age group` : `年龄${c.age}，用词贴合该年龄段`);
  if (c.identity && IDENTITY_VOICE[c.identity]) parts.push(en ? (IDENTITY_VOICE_EN[c.identity] ?? IDENTITY_VOICE[c.identity]) : IDENTITY_VOICE[c.identity]);
  if (c.region && REGION_PARTICLE[c.region]) parts.push(en ? `${REGION_LABEL_EN[c.region] ?? c.region} accent: ${REGION_PARTICLE_EN[c.region] ?? REGION_PARTICLE[c.region]}` : `${c.region}口吻：${REGION_PARTICLE[c.region]}`);
  if (c.trait && TRAIT_VOICE[c.trait]) parts.push(en ? (TRAIT_VOICE_EN[c.trait] ?? TRAIT_VOICE[c.trait]) : TRAIT_VOICE[c.trait]);
  if (c.voice) parts.push(en ? `Given voice: ${c.voice}` : `既定口吻：${c.voice}`);
  parts.push(en
    ? 'Allow broken sentences, dropped subjects, filler words and imperfection; forbid neat parallelism and written preaching'
    : '允许断句、省略主语、口头语和“不完美”，禁止工整对仗与书面说教');
  return en
    ? `[Voice for ${c.name}] ${parts.join('; ')}. Every line must be speakable as written.`
    : `【${c.name}的说话方式】${parts.join('；')}。台词必须能直接念出口。`;
}

/** 依题材风格推断口语化程度 */
export function levelFromStyle(styleId?: string): ColloquialLevel {
  if (styleId === 'ancient_plot' || styleId === 'white_collar' || styleId === 'premium') return 'low';
  if (styleId === 'kuai_shuang' || styleId === 'mass_down' || styleId === 'dongbei') return 'high';
  return 'mid';
}
