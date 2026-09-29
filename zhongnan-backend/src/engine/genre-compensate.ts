/**
 * genre-compensate.ts —— 网文/短剧「流派 × 现实情绪代偿」库
 * 来源：2026-08 26条网文写作视频（25条完整逐字稿）抽象。核心洞察：
 *  一个流派能火，根本不是设定新奇，而是精准代偿了某类人在现实里求而不得的心理。
 *  短剧节奏更快、情绪更密，同一套“现实痛点→情绪代偿→核心技法”完全适用，且要前置、提速。
 *  供：标签创作模式、选题会、市场分析师、用户个性化推荐（地域/年龄/性别）复用。
 */

export interface GenreCompensation {
  id: string;
  name: string;
  aliases: string[];
  realityPain: string;        // 现实痛点
  compensation: string;       // 给读者/观众的情绪代偿
  coreTechnique: string;      // 核心技法
  shortDramaFit: string;      // 短剧迁移要点（比网文更快）
  avoid: string;              // 禁忌
  painKeywords: string[];     // 用于按用户画像/诉求匹配
}

export const GENRE_COMPENSATION: GenreCompensation[] = [
  {
    id: 'rebirth', name: '都市重生流', aliases: ['重生', '回到过去', '改写遗憾'],
    realityPain: '现实试错成本极高、人生没有撤回键（买房、爱错人、报错专业一步错步步错）',
    compensation: '人生后悔药：带着未来视野降维弥补遗憾',
    coreTechnique: '开局手起刀落完成命运绝对修正，睁眼第一秒就果断改命，不与旧人纠缠、不磨叽日常',
    shortDramaFit: '第一集开场即重生+第一个果断修正动作（踹渣男/锁定暴涨机会），把网文几章的铺垫压到前30秒',
    avoid: '都重生了还拖日常、还和上一世拖累自己的人纠缠不清',
    painKeywords: ['后悔', '重来', '遗憾', '回到', '如果当初', '改写'],
  },
  {
    id: 'mindRead', name: '偷听心声/读心流', aliases: ['读心', '心声', '看穿'],
    realityPain: '现实人情虚伪、人人戴面具，猜别人心思耗尽精力（职场PUA、亲戚假笑）',
    compensation: '降维审判权：一眼看穿底牌的上帝视角',
    coreTechnique: '用最随意的态度撕下最高尚的伪装——反派表面大义凛然，心声却龌龊，伪装越神圣、社死落差越强',
    shortDramaFit: '心声用字幕/画外音直给，反派“嘴上说 vs 心里想”同屏对撞，3秒一个打脸',
    avoid: '写成主角和反派明面对骂（低级）；要让伪善被当众揭穿',
    painKeywords: ['虚伪', '假面', '看穿', '读心', '心声', '伪君子', '社死'],
  },
  {
    id: 'farming', name: '种田基建流', aliases: ['种田', '基建', '囤物资', '经营'],
    realityPain: '现实充满不确定性（裁员、烂尾、失控），灵魂流浪、缺一块绝对安全的领地',
    compensation: '确定性反馈避风港：一分耕耘十分收获、努力必回报',
    coreTechnique: '拒绝破坏（别烧田攻城添堵），进度条化呈现资源一点点积累、荒地变堡垒',
    shortDramaFit: '适合女频治愈/逆袭副线，用“越变越好”的可视化进度给安全感，冲突以化解而非摧毁收尾',
    avoid: '为制造高潮反复破坏主角建好的东西，违背读者来找治愈的初衷',
    painKeywords: ['安全感', '不确定', '囤', '经营', '安稳', '治愈', '避风港'],
  },
  {
    id: 'invincible', name: '无敌满级流', aliases: ['开局满级', '大佬下山', '无敌'],
    realityPain: '被“延迟满足、先苦后甜”榨干，苦全吃了福没享到，没耐心陪主角熬成长',
    compensation: '即时回报精神SPA：不费吹灰之力的碾压',
    coreTechnique: '不制造生存危机、制造三观崩塌；主角永远风轻云淡，重点写反派底牌尽出后的认知破碎',
    shortDramaFit: '开局即大佬、扮猪吃虎，反派跳得越高摔得越碎，绝不安排主角苦战吐血',
    avoid: '让主角前三集受委屈、和敌人大战三百回合',
    painKeywords: ['即时', '满级', '碾压', '不熬', '风轻云淡', '下山'],
  },
  {
    id: 'lowProfile', name: '苟道/扫地僧流', aliases: ['苟', '藏拙', '扮猪吃虎', '扫地僧'],
    realityPain: '怕做出头鸟、能者多劳被压榨、出风头就背锅',
    compensation: '安全感+掌控感：用微不足道的身份掌控至高权力',
    coreTechnique: '战术认怂制造信息差三层结构——反派第一层嘲讽、主角第二层苟住等翻盘、读者第三层全知底牌',
    shortDramaFit: '用“只有观众知道主角多强”的信息差制造爽感，众人嘲讽时观众已在等打脸',
    avoid: '主角为了面子当场争辩；苟是降维打击前的伪装不是真窝囊',
    painKeywords: ['低调', '藏', '苟', '信息差', '扫地僧', '出头鸟', '扮猪'],
  },
  {
    id: 'cutTies', name: '断亲/决裂流', aliases: ['断亲', '决裂', '吸血鬼家人', '扶弟魔'],
    realityPain: '人情社会慢性绞杀、以爱为名的道德绑架、“都是一家人”被迫吸血',
    compensation: '绝对情感切割：替读者做现实中不敢做的冷血决裂',
    coreTechnique: '反向操作杀死心软；最高级惩罚是绝对物理冷漠（不是暴怒、不是声泪控诉、不团圆）',
    shortDramaFit: '第一集就决裂（砸信物转身走），反派后期下跪求原谅也冷漠，迟来的深情比草贱',
    avoid: '反派一掉泪悔过就大团圆；让主角声泪俱下控诉（不够狠）',
    painKeywords: ['断亲', '决裂', '道德绑架', '吸血鬼', '扶弟', '一家人', '偏心'],
  },
  {
    id: 'cutLover', name: '斩意中人/搞事业流', aliases: ['斩意中人', '无CP', '手撕绿茶', '搞事业'],
    realityPain: '亲密关系高成本低回报（彩礼、情绪拉扯、背叛），当够了卑微舔狗',
    compensation: '自我为王、绝不内耗：把讨好别人的精力全用来搞钱变强',
    coreTechnique: '绝对冷酷自爱，不写卑微求爱苦情戏，斩情丝后一路向上',
    shortDramaFit: '开场手撕渣男/绿茶后立刻转向事业翻盘，男主/女主清醒独立，不恋爱脑',
    avoid: '主角为感情寻死觅活、卑微求爱',
    painKeywords: ['斩', '绿茶', '不内耗', '搞钱', '搞事业', '自爱', '清醒'],
  },
  {
    id: 'saneMadman', name: '清醒癫狂流', aliases: ['发疯', '掀桌', '整顿', '疯批'],
    realityPain: '现实对谁都得赔笑脸、被体面死死压住，活得憋屈',
    compensation: '安全地失控：拥有掀翻酒席、说真话的特权',
    coreTechnique: '不是无脑乱砍的中二，是行为癫狂但逻辑极其清晰，笑着戳破真相、踩碎虚伪规则',
    shortDramaFit: '“整顿职场/整顿全家”名场面，疯子说正常人不敢说的真话，行为出格但句句在理',
    avoid: '写成纯生理失控、为疯而疯、逻辑崩盘',
    painKeywords: ['发疯', '掀桌', '整顿', '疯批', '不装了', '真话'],
  },
  {
    id: 'tragedyTurn', name: '悲剧黑化流', aliases: ['黑化', '被逼上绝路', '反英雄'],
    realityPain: '现实里太多无能为力、无效努力、以爱为名的绞杀',
    compensation: '被逼到临界点后掀桌黑化的极致清算（悲剧是爽点的情绪杠杆）',
    coreTechnique: '三种现实悲剧——两难困境、牛马虚无（无效努力）、道德绞肉机（以爱为名绑架）；先把憋屈压满，黑化才爆',
    shortDramaFit: '前几集把现实痛点快速压到临界，主角转变要有观众“早该如此”的正当性',
    avoid: '为虐而虐、靠死人流血制造悲剧（现代观众已麻痹）',
    painKeywords: ['黑化', '被逼', '两难', '无能为力', '道德绑架', '掀桌'],
  },
  {
    id: 'system', name: '系统金手指流', aliases: ['系统', '面板', '任务', '金手指'],
    realityPain: '普通人缺一个确定能改变命运的抓手（本条视频仅标题级，结合金手指技法）',
    compensation: '精神抗争与确定的上升通道',
    coreTechnique: '金手指必须带等价代价与隐藏代价，不是开局发大礼包；系统越“狠”，驾驭它的主角意志越惊人',
    shortDramaFit: '系统提示音/面板可视化直给，任务-奖励即时反馈，代价制造悬念',
    avoid: '毫无代价的新手大礼包、只会发任务的客服式系统',
    painKeywords: ['系统', '面板', '金手指', '任务', '外挂', '代价'],
  },
  {
    id: 'metaDrama', name: '戏中戏/元叙事套层', aliases: ['戏中戏', '剧中剧', '元叙事', '嵌套叙事', '片场套层', '剧本照进现实', '打破第四面墙'],
    realityPain: '现实常让人分不清“被安排的角色”与“真实的自己”——职场人设、社交表演、剧本式人生，人人都在演，又都想知道戏外真相',
    compensation: '双重解谜的智力快感与“看穿全局”的优越感：观众同时追两层故事，比剧中人更早摸到套层底牌',
    coreTechnique: '建立“内层戏（排练/直播/剧本/节目）—外层现实”两条可互相映照的线，用同一道具/台词在两层制造反差与伏笔；每次切层都让观众获得一次信息升维，内层台词一语双关预言外层走向',
    shortDramaFit: '第一集就用一个“戏外眼神/穿帮细节”埋套层钩子，3集内让观众确认“这出戏另有目的”；内层冲突必须能反打外层关系（排练的争吵正是真实裂痕），避免两层各演各的',
    avoid: '为套层而套层、两层故事互不咬合、规则朝令夕改导致观众看不懂；戏中戏不能替代真实情感，套层揭晓后人物动机仍要立得住',
    painKeywords: ['戏中戏', '剧中剧', '元叙事', '套层', '嵌套', '排练', '片场', '直播剧本', '第四面墙', '剧本照进现实'],
  },
];

/** v1.94 英文描述层（id 键控，中文库为单一事实来源；英文匹配关键词 + 英文呈现文案） */
export const GENRE_EN: Record<string, { name: string; kw: string[]; pain: string; comp: string; tech: string; fit: string; avoid: string }> = {
  rebirth: { name: 'Urban Rebirth', kw: ['rebirth', 'reborn', 'go back in time', 'second chance', 'redo', 'regret', 'rewrite', 'time leap'], pain: 'Real life has no undo button — one wrong choice (a house, a lover, a major) cascades forever', comp: 'A regret pill: future vision used to fix every loss with overwhelming advantage', tech: 'Correct fate decisively in the opening seconds; no lingering daily life or entanglement with people who dragged the past self down', fit: 'Episode 1 opens on the rebirth plus the first decisive fix (dump the loser / lock the windfall); compress chapters of setup into the first 30s', avoid: 'Dragging out daily life after rebirth, or staying tangled with those who exploited the previous life' },
  mindRead: { name: 'Mind-Reading / Inner-Voice', kw: ['mind read', 'inner voice', 'hear thoughts', 'telepath', 'see through', 'hypocrite', 'fake', 'two-faced'], pain: 'Everyone wears a mask in real life; reading others is exhausting (workplace PUA, relatives’ fake smiles)', comp: 'A god’s-eye verdict: seeing everyone’s hole card at a glance', tech: 'Tear off the noblest mask with the most casual attitude — the holier the surface, the filthier the inner voice, the bigger the public takedown', fit: 'Show inner voice as subtitle/VO, collide “said aloud vs thought” on screen, one face-slap every 3s', avoid: 'Reducing it to open shouting matches; the point is public unmasking of hypocrisy' },
  farming: { name: 'Cozy Base-Building', kw: ['farming', 'base build', 'stockpile', 'hoard supplies', 'manage', 'cozy', 'safe haven', 'healing', 'settlement'], pain: 'Life feels uncontrollable (layoffs, unfinished buildings); the soul lacks one patch of absolute safety', comp: 'A deterministic safe haven: effort always pays off, visible progress', tech: 'Refuse destruction; render resource accumulation as a progress bar, wasteland turning into a fortress', fit: 'Fits female-channel healing/underdog B-plots; resolve conflict rather than destroy, give security through visible betterment', avoid: 'Repeatedly wrecking what the lead built just to manufacture a climax, betraying the healing promise' },
  invincible: { name: 'Invincible Max-Level', kw: ['max level', 'invincible', 'overpowered', 'hidden master descends', 'no grind', 'instant', 'dominance', 'sweeping win'], pain: 'Burned out by “delayed gratification”; ate all the bitterness and never got the reward, no patience for a growth arc', comp: 'Instant-return mental SPA: effortless domination', tech: 'Don’t manufacture survival crises, manufacture worldview collapse; the lead stays serene while the villain’s certainty shatters after playing every card', fit: 'Open as a hidden boss playing weak; the higher the villain jumps the harder they fall; never a bloody drawn-out struggle', avoid: 'Making the lead suffer in early episodes or fight 300 rounds' },
  lowProfile: { name: 'Lay Low / Hidden Sage', kw: ['lay low', 'hide strength', 'play pig to eat tiger', 'hidden sage', 'underestimate', 'information gap', 'conceal power'], pain: 'Fear of being the nail that sticks out; the capable get exploited, standing out means taking the blame', comp: 'Safety plus control: wield supreme power from a nobody’s position', tech: 'Tactical concession builds a three-layer information gap — villain mocks (1), lead holds (2), audience knows the hole card (3)', fit: 'Use “only the viewer knows how strong the lead is” for satisfaction; the audience awaits the face-slap while others mock', avoid: 'Arguing on the spot to save face; laying low is camouflage before a dimensional strike, not real weakness' },
  cutTies: { name: 'Cut Ties / Severance', kw: ['cut ties', 'severance', 'toxic family', 'bloodsucking family', 'patriarchy', 'favoritism', 'walk away', 'disown'], pain: 'Slow strangulation by relational obligation, moral kidnapping “we’re family”, forced giving', comp: 'Absolute emotional cut: doing the cold severance readers dare not in real life', tech: 'Kill soft-heartedness in reverse; the highest punishment is absolute physical coldness — not rage, not tearful accusation, no reunion', fit: 'Sever in episode 1 (smash the token and leave); stay cold even when they kneel; late affection is worthless', avoid: 'A tearful apology triggering a big reunion; a tearful accusation is not ruthless enough' },
  cutLover: { name: 'Cut the Love Interest / Career-First', kw: ['cut the lover', 'no cp', 'career first', 'green tea', 'self-love', 'stop simping', 'independent', 'walk away from love'], pain: 'Relationships are high-cost/low-return (bride price, emotional tug-of-war, betrayal); tired of groveling', comp: 'Self as king, zero internal friction: redirect all people-pleasing energy into money and power', tech: 'Absolute cold self-love, no groveling romance; after cutting the tie, move only upward', fit: 'Right after dumping the cheat, pivot to a career comeback; the lead is clear-eyed and independent, no love-brain', avoid: 'The lead begging for love or dying for a relationship' },
  saneMadman: { name: 'Lucid Chaos', kw: ['snap', 'lose it on purpose', 'overturn the table', 'unhinged but lucid', 'speak truth', 'stop pretending', 'chaotic'], pain: 'Forced to smile at everyone in real life, crushed by decorum, living suffocated', comp: 'Safe loss of control: the privilege to flip the banquet table and tell the truth', tech: 'Not mindless rampage — wild behavior with razor logic, smiling while exposing truth and crushing hypocritical rules', fit: '“Fixing the workplace / fixing the family” set pieces; the madman says what normals dare not, outrageous yet airtight', avoid: 'Pure physiological meltdown, chaos for its own sake, collapsed logic' },
  tragedyTurn: { name: 'Tragic Dark Turn', kw: ['dark turn', 'villain arc', 'pushed to the brink', 'anti-hero', 'corruption', 'no way out', 'forced over the edge'], pain: 'Too much powerlessness and futile effort in real life, strangulation “for your own good”', comp: 'The ultimate reckoning of snapping after being pushed to a critical point (tragedy as the lever of catharsis)', tech: 'Three real tragedies — dilemma, futile toil, moral meat-grinder; compress grievance to the brim before the dark turn explodes', fit: 'Push the real-life pain to critical mass in early episodes; the transformation must feel “long overdue” to viewers', avoid: 'Angst for angst’s sake, manufacturing tragedy through death and blood (modern viewers are numb)' },
  system: { name: 'System / Cheat Ability', kw: ['system', 'panel', 'quest', 'cheat ability', 'hud', 'golden finger', 'interface', 'power-up'], pain: 'Ordinary people lack a reliable lever to change their fate', comp: 'Spiritual resistance and a deterministic upward channel', tech: 'The cheat must carry an equivalent and hidden price, never a starter handout; the harsher the system, the more astonishing the will to wield it', fit: 'Render system prompts/panels directly, instant quest-reward feedback, price creates suspense', avoid: 'A free starter pack, a customer-service system that only hands out quests' },
  metaDrama: { name: 'Play-Within-a-Play / Metafiction', kw: ['play within a play', 'story within a story', 'metafiction', 'meta drama', 'nested narrative', 'on set', 'rehearsal', 'fourth wall', 'script comes true', 'show within a show'], pain: 'In real life people play assigned roles (workplace personas, social performance) and crave the truth outside the performance', comp: 'A double puzzle and the pleasure of seeing the whole board: the audience tracks two layers and learns the nested hand before the characters do', tech: 'Run two interlocking lines — the inner show (rehearsal/livestream/script/program) and outer reality; reuse one prop or line across both layers for irony and foreshadow; every layer-switch grants the audience an information upgrade, inner dialogue double-meaning the outer arc', fit: 'Episode 1 plants a nested hook via an off-script glance or a continuity slip; within 3 episodes the audience learns “this show hides another agenda”; inner conflict must strike back at the outer relationship (a staged argument is the real rift), never two disconnected plots', avoid: 'Nesting for its own sake, two layers that never interlock, shifting rules that confuse the audience; metafiction cannot replace real emotion — after the reveal, motives must still hold' },
};
/** 按用户诉求/画像文本匹配最契合的流派（可多选，按命中痛点数排序）；v1.94 支持英文匹配 */
export function matchGenreByPain(text: string, limitOrLang: number | 'zh' | 'en' = 3, maybeLang: 'zh' | 'en' = 'zh'): GenreCompensation[] {
  const limit = typeof limitOrLang === 'number' ? limitOrLang : 3;
  const lang: 'zh' | 'en' = typeof limitOrLang === 'string' ? limitOrLang : maybeLang;
  const t = lang === 'en' ? (text || '').toLowerCase() : (text || '');
  return GENRE_COMPENSATION
    .map((g) => {
      let hit: number;
      if (lang === 'en') {
        const kw = (GENRE_EN[g.id]?.kw || []).map((k) => k.toLowerCase());
        hit = kw.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
      } else {
        hit = g.painKeywords.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0) + g.aliases.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
      }
      return { g, hit };
    })
    .filter((x) => x.hit > 0)
    .sort((a, b) => b.hit - a.hit)
    .slice(0, limit)
    .map((x) => x.g);
}

/** 旧瓶新酒：保留约80%熟悉套路降低认知成本，只做20%反常微创新（避免全原创高门槛/避免纯套娃） */
export const FAMILIAR_TWIST = {
  ratio: '80% 熟悉经典开局 + 20% 彻底反常设定',
  principle: '用最熟悉的套路把观众骗进来，再用一个连环反常反转制造惊喜；复杂世界观=阅读门槛，不是高级',
  check: (familiar: boolean, twist: boolean) => ({
    ok: familiar && twist,
    advice: !familiar
      ? '开局过于陌生烧脑，观众理解成本高；先用一个大众熟悉的经典情境锚定。'
      : !twist
        ? '只有老套路没有微创新=剩饭换盘，需在熟悉开局后接一个反常设定。'
        : '熟悉度与新鲜感平衡，保持。',
  }),
};
