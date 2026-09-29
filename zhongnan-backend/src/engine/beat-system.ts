/**
 * 节拍工程体系（钩子工程的“举一反三”同构落地）
 * ------------------------------------------------------------------
 * 导演思路从“钩子分层、用户可选+系统默认、不僵硬”推广到三类核心节拍：
 *   reversal 反转节拍 / payoff 爽点节拍 / emotion 情绪节拍。
 * 与既有模块分工（不重复、不相悖）：
 *   - hook-system：四层钩子（开场/集尾/场/微钩）
 *   - hit-reverse：第8模式“爆款逆向工程”的事后拆解与侵权校验
 *   - rhythm：成稿后的节奏扫描（事后体检）
 *   - 本文件：生成前的反转/爽点/情绪“事前排布”，同样 auto/manual/hybrid、强度档、轮换防疲劳、可审计。
 * 纯函数、可离线对拍。
 */
import { CuePref, Strength, DEFAULT_PREF, FLAVOR_BIAS } from './hook-system';

export interface BeatType {
  id: string; name: string; kind: BeatKind;
  definition: string; technique: string; example: string; bestFor: string[]; cooldown: number;
}
export type BeatKind = 'reversal' | 'payoff' | 'emotion';

// —— 反转节拍：8型（对齐 hook-system.REVERSAL_TYPES，补全方法论）——
export const REVERSAL_BEATS: BeatType[] = [
  { id: 'rev_identity', kind: 'reversal', name: '身份反转', definition: '人物真实身份与表面身份错位揭晓', technique: '前期埋身份线索，揭晓即重写人物关系', example: '被刁难的保洁竟是公司控股人', bestFor: ['逆袭', '赘婿', '扮猪吃虎'], cooldown: 2 },
  { id: 'rev_stance', kind: 'reversal', name: '立场反转', definition: '同一人物前后立场180度转变', technique: '用利益/认知变化驱动立场切换，给足动机', example: '力挺她的人突然倒戈，只因一份旧账', bestFor: ['权谋', '商战', '谍战'], cooldown: 2 },
  { id: 'rev_friendfoe', kind: 'reversal', name: '敌友反转', definition: '盟友是敌人、敌人反成援手', technique: '用信息差制造敌友误判，回收时给证据', example: '一直帮她的闺蜜才是内鬼，对手却递来关键证据', bestFor: ['悬疑', '复仇', '谍战'], cooldown: 3 },
  { id: 'rev_truefalse', kind: 'reversal', name: '真假反转', definition: '以为真的是假、以为假的是真', technique: '建立确信再推翻，物证/人证闭环', example: '那份“遗书”是伪造的，真人就在楼上', bestFor: ['悬疑', '身世', '探案'], cooldown: 3 },
  { id: 'rev_cause', kind: 'reversal', name: '因果反转', definition: '结果的真正成因与表象相反', technique: '倒埋因果链，揭晓时所有细节对上', example: '被指害人的他，其实是当年救人者', bestFor: ['悬疑', '家庭', '救赎'], cooldown: 2 },
  { id: 'rev_cognition', kind: 'reversal', name: '认知反转', definition: '颠覆观众与角色的既定认知', technique: '用一个新前提重写整个局面', example: '她以为在报恩，对方却说是在还债', bestFor: ['情感', '悬疑', '脑洞'], cooldown: 2 },
  { id: 'rev_strongweak', kind: 'reversal', name: '强弱反转', definition: '强弱易位，被压制者反占上风', technique: '先显弱藏锋，关键时刻露底牌', example: '所有人等她出丑，她三句话反将一军', bestFor: ['逆袭', '职场', '爽文'], cooldown: 2 },
  { id: 'rev_timeline', kind: 'reversal', name: '时间线反转', definition: '时间顺序错位带来真相倒置', technique: '插叙/倒叙拼合时间线，结尾闭环', example: '两段监控一对，案发时他根本不在现场', bestFor: ['悬疑', '犯罪', '烧脑'], cooldown: 3 },
];

// —— 爽点节拍：被验证的即时满足公式 ——
export const PAYOFF_BEATS: BeatType[] = [
  { id: 'pay_faceslap', kind: 'payoff', name: '打脸爽', definition: '被轻视者当场反证，围观者态度反转', technique: '先让对方把话说满，再用事实当众回击', example: '刚笑她买不起，经理小跑过来喊董事长', bestFor: ['逆袭', '赘婿', '都市'], cooldown: 1 },
  { id: 'pay_counter', kind: 'payoff', name: '逆袭翻盘', definition: '劣势方凭隐藏实力或谋划翻盘', technique: '示弱蓄势，一步反转劣势格局', example: '项目被判死刑，她掏出早已布好的Plan B', bestFor: ['职场', '商战', '逆袭'], cooldown: 1 },
  { id: 'pay_id压制', kind: 'payoff', name: '身份压制', definition: '隐藏高身份亮明，以位格碾压', technique: '身份逐层揭露，一级压一级', example: '一个电话，对方总部连夜改口', bestFor: ['豪门', '权谋', '隐世'], cooldown: 2 },
  { id: 'pay_crush', kind: 'payoff', name: '实力碾压', definition: '用硬实力/专业一招制敌', technique: '不解释，直接用专业结果说话', example: '对方百般刁难，她三分钟修好核心系统', bestFor: ['职业', '竞技', '高手'], cooldown: 1 },
  { id: 'pay_truth', kind: 'payoff', name: '真相揭晓', definition: '误会/阴谋被证据揭穿，正义归位', technique: '证据链当众闭合，让对方无从抵赖', example: '监控一放，栽赃她的人当场瘫坐', bestFor: ['悬疑', '家庭', '复仇'], cooldown: 2 },
  { id: 'pay_karma', kind: 'payoff', name: '恶人现报', definition: '反派当场遭报应，即时满足不憋屈', technique: '不让恶债拖过本集，给即时因果', example: '刚耍完威风，查处通知就到了', bestFor: ['复仇', '家庭', '下沉'], cooldown: 1 },
  { id: 'pay_sweet', kind: 'payoff', name: '双向奔赴', definition: '情感付出得到对等回应', technique: '用一个具体动作回应此前的付出', example: '她没说出口的难处，他早默默办妥', bestFor: ['甜宠', '情感', '治愈'], cooldown: 2 },
  { id: 'pay_wish', kind: 'payoff', name: '愿望代偿', definition: '替观众完成现实中不敢做的事', technique: '怼回去/裸辞/摊牌，给情绪出口', example: '面对PUA，她平静地把辞职信拍在桌上', bestFor: ['职场', '女性向', '现实'], cooldown: 1 },
  { id: 'pay_underdog', kind: 'payoff', name: '弱者扬眉', definition: '长期受压者一次赢回尊严', technique: '积压越久，扬眉瞬间越解气', example: '被欺负十年的她，今天第一次抬起头', bestFor: ['逆袭', '家庭', '下沉'], cooldown: 2 },
  { id: 'pay_resource', kind: 'payoff', name: '资源天降', definition: '获得关键金手指/人脉/财富改变格局', technique: '新资源立刻被用上，改变力量对比', example: '绝境时，一份尘封授权书到了她手里', bestFor: ['系统', '重生', '金手指'], cooldown: 2 },
];

// —— 情绪节拍：曲线单元，强调有起伏、不一条直线 ——
export const EMOTION_BEATS: BeatType[] = [
  { id: 'emo_suppress', kind: 'emotion', name: '憋屈蓄力', definition: '先压：被欺/被误解/被压制', technique: '让观众替角色憋着，为后续释放蓄势', example: '功劳被抢，她攥紧拳头没说话', bestFor: ['逆袭', '复仇'], cooldown: 1 },
  { id: 'emo_burst', kind: 'emotion', name: '情绪爆发', definition: '冲突或情绪到顶点的宣泄', technique: '积压后的总爆发，台词动作一起到位', example: '她终于开口，一字一句把账算清', bestFor: ['家庭', '情感', '冲突'], cooldown: 1 },
  { id: 'emo_release', kind: 'emotion', name: '爽感释放', definition: '压力解除的痛快瞬间', technique: '紧跟蓄力/爆发，给观众松一口气', example: '判决落下，她长舒一口气走出大门', bestFor: ['逆袭', '爽文'], cooldown: 1 },
  { id: 'emo_warmth', kind: 'emotion', name: '温情回甘', definition: '用一个柔软细节落地情感', technique: '大冲突后给一个小而具体的温柔', example: '吵完架，他默默把热粥放在她手边', bestFor: ['家庭', '情感', '治愈'], cooldown: 2 },
  { id: 'emo_suspense', kind: 'emotion', name: '揪心悬念', definition: '悬而未决让人牵挂', technique: '结果未定处收束，牵住下一段', example: '手术室的灯一直亮着，没人说话', bestFor: ['医疗', '悬疑', '情感'], cooldown: 1 },
  { id: 'emo_tear', kind: 'emotion', name: '破防泪点', definition: '共情峰值：牺牲/误解/亲情', technique: '用具体物件或细节催泪，不靠喊口号', example: '遗物里掉出那张她没舍得用的车票', bestFor: ['亲情', '虐恋', '现实'], cooldown: 2 },
  { id: 'emo_hype', kind: 'emotion', name: '高燃点', definition: '热血/使命感拉满', technique: '用信念宣言+行动把情绪推到燃点', example: '“这一次，我们自己说了算。”众人起身', bestFor: ['热血', '群像', '励志'], cooldown: 2 },
  { id: 'emo_heal', kind: 'emotion', name: '治愈慰藉', definition: '情绪平复与抚慰', technique: '给情绪一个落点，余味收束', example: '天亮了，她靠着窗边轻轻笑了', bestFor: ['治愈', '情感', '日常'], cooldown: 2 },
];
export const SUPPRESSION_IDS = new Set(['emo_suppress', 'emo_suspense']);
export const RELEASE_IDS = new Set(['emo_burst', 'emo_release', 'emo_tear', 'emo_hype']);

export const BEAT_LIBRARY: Record<BeatKind, BeatType[]> = {
  reversal: REVERSAL_BEATS, payoff: PAYOFF_BEATS, emotion: EMOTION_BEATS,
};

// v2.02 爽点「风味」轴（与 hook-system 微钩风味同构：用户可选、系统软加权、不僵硬、永远兜底）
// 10 型爽点不重不漏归入 5 大风味；只作用于 payoff 节拍，反转/情绪节拍不受影响。
export type PayoffFlavor = 'face_slap' | 'comeback' | 'status_crush' | 'truth_justice' | 'sweet_warm';
export const PAYOFF_FLAVOR_META: Record<PayoffFlavor, { name: string; nameEn: string; desc: string; descEn: string }> = {
  face_slap: { name: '打脸现报', nameEn: 'Face-slap / instant karma', desc: '被轻视者当场反证、反派当场遭报，话先说满再当众回击', descEn: 'The scorned prove everyone wrong on the spot; the arrogant get instant comeuppance' },
  comeback: { name: '逆袭翻盘/愿望代偿', nameEn: 'Comeback / wish fulfillment', desc: '劣势方凭谋划或硬气翻盘，替观众出一口现实中不敢出的气', descEn: 'The underdog turns it around through planning or nerve — vicarious wish fulfillment' },
  status_crush: { name: '身份实力压制', nameEn: 'Status / skill dominance', desc: '隐藏身份或硬实力亮明，一级压一级、专业一招制敌，含金手指资源', descEn: 'Hidden status or hard skill is revealed to outrank or outperform, including cheat resources' },
  truth_justice: { name: '真相正义', nameEn: 'Truth & justice', desc: '证据链当众闭合，误会阴谋揭穿、正义归位', descEn: 'The evidence chain closes in public; the plot is exposed and justice returns' },
  sweet_warm: { name: '甜暖回应', nameEn: 'Sweet / warm payoff', desc: '情感付出得到对等回应，给观众柔软而确定的满足', descEn: 'Emotional effort gets an equal, tender response — a soft sure reward' },
};
export const PAYOFF_FLAVORS: PayoffFlavor[] = ['face_slap', 'comeback', 'status_crush', 'truth_justice', 'sweet_warm'];
const PAYOFF_FLAVOR_MAP: Record<string, PayoffFlavor> = {
  pay_faceslap: 'face_slap', pay_karma: 'face_slap',
  pay_counter: 'comeback', pay_underdog: 'comeback', pay_wish: 'comeback',
  pay_id压制: 'status_crush', pay_crush: 'status_crush', pay_resource: 'status_crush',
  pay_truth: 'truth_justice',
  pay_sweet: 'sweet_warm',
};
export function payoffFlavorOf(id: string): PayoffFlavor | undefined { return PAYOFF_FLAVOR_MAP[id]; }
export function payoffFlavorName(f: PayoffFlavor, lang: 'zh' | 'en' = 'zh'): string { const m = PAYOFF_FLAVOR_META[f]; return lang === 'en' ? m.nameEn : m.name; }
export const VALID_PAYOFF_FLAVORS = new Set<string>(PAYOFF_FLAVORS);

// v2.03 反转「风味」轴：8 型反转不重不漏归 4 风味
export type ReversalFlavor = 'identity_shift' | 'relation_turn' | 'truth_cause' | 'cognition_overturn';
export const REVERSAL_FLAVOR_META: Record<ReversalFlavor, { name: string; nameEn: string; desc: string; descEn: string }> = {
  identity_shift: { name: '身份/强弱易位', nameEn: 'Identity / power shift', desc: '真实身份揭晓或强弱易位，被压制者反占上风', descEn: 'True identity is revealed or power trade-places; the oppressed gains the upper hand' },
  relation_turn: { name: '关系/立场转向', nameEn: 'Relationship / stance turn', desc: '敌友、立场突变，靠利益与信息差驱动', descEn: 'Friend-foe or stance flips, driven by interest and information gaps' },
  truth_cause: { name: '真相/因果倒置', nameEn: 'Truth / cause inversion', desc: '真假、因果、时间线拼合后真相倒置', descEn: 'Real-fake, cause-effect and timeline reassemble into an inverted truth' },
  cognition_overturn: { name: '认知颠覆', nameEn: 'Cognitive overturn', desc: '用一个新前提重写角色与观众的既定认知', descEn: 'One new premise rewrites what characters and audience believed' },
};
export const REVERSAL_FLAVORS: ReversalFlavor[] = ['identity_shift', 'relation_turn', 'truth_cause', 'cognition_overturn'];
const REVERSAL_FLAVOR_MAP: Record<string, ReversalFlavor> = {
  rev_identity: 'identity_shift', rev_strongweak: 'identity_shift',
  rev_stance: 'relation_turn', rev_friendfoe: 'relation_turn',
  rev_truefalse: 'truth_cause', rev_cause: 'truth_cause', rev_timeline: 'truth_cause',
  rev_cognition: 'cognition_overturn',
};
export function reversalFlavorOf(id: string): ReversalFlavor | undefined { return REVERSAL_FLAVOR_MAP[id]; }
export function reversalFlavorName(f: ReversalFlavor, lang: 'zh' | 'en' = 'zh'): string { const m = REVERSAL_FLAVOR_META[f]; return lang === 'en' ? m.nameEn : m.name; }
export const VALID_REVERSAL_FLAVORS = new Set<string>(REVERSAL_FLAVORS);

// v2.03 情绪「风味」轴：8 型情绪不重不漏归 5 风味（有压必放的硬规则始终优先于风味偏好）
export type EmotionFlavor = 'press_release' | 'tender_heal' | 'suspense_tug' | 'tear_angst' | 'hype_burn';
export const EMOTION_FLAVOR_META: Record<EmotionFlavor, { name: string; nameEn: string; desc: string; descEn: string }> = {
  press_release: { name: '压抑→释放', nameEn: 'Suppress → release', desc: '先憋屈蓄力再爆发/释放，解气曲线', descEn: 'Press first, then burst/release — a cathartic curve' },
  tender_heal: { name: '温情治愈', nameEn: 'Tender / healing', desc: '柔软细节回甘、情绪平复慰藉', descEn: 'Soft details and emotional settling, warm and healing' },
  suspense_tug: { name: '揪心悬念', nameEn: 'Tugging suspense', desc: '结果未定处牵住观众，勾向下一段', descEn: 'Hold the audience at an unresolved outcome, pulling them onward' },
  tear_angst: { name: '破防虐心', nameEn: 'Tear / angst', desc: '牺牲、误解、亲情的共情峰值，用具体物件催泪', descEn: 'Empathy peaks of sacrifice, misunderstanding or kinship, tears via concrete objects' },
  hype_burn: { name: '高燃热血', nameEn: 'Hype / hot-blood', desc: '信念宣言加行动，把情绪推到燃点', descEn: 'Credo plus action pushes emotion to a hot-blooded peak' },
};
export const EMOTION_FLAVORS: EmotionFlavor[] = ['press_release', 'tender_heal', 'suspense_tug', 'tear_angst', 'hype_burn'];
const EMOTION_FLAVOR_MAP: Record<string, EmotionFlavor> = {
  emo_suppress: 'press_release', emo_burst: 'press_release', emo_release: 'press_release',
  emo_warmth: 'tender_heal', emo_heal: 'tender_heal',
  emo_suspense: 'suspense_tug',
  emo_tear: 'tear_angst',
  emo_hype: 'hype_burn',
};
export function emotionFlavorOf(id: string): EmotionFlavor | undefined { return EMOTION_FLAVOR_MAP[id]; }
export function emotionFlavorName(f: EmotionFlavor, lang: 'zh' | 'en' = 'zh'): string { const m = EMOTION_FLAVOR_META[f]; return lang === 'en' ? m.nameEn : m.name; }
export const VALID_EMOTION_FLAVORS = new Set<string>(EMOTION_FLAVORS);
/* ============ v1.95 节拍英文层（id 键控；中文库为单一事实来源，默认中文逐字不变） ============ */
type BeatLang = 'zh' | 'en';
const BEAT_EN: Record<string, { name: string; definition: string; technique: string; example: string; bestFor: string[] }> = {
  rev_identity: { name: 'Identity Reversal', definition: 'The character’s true identity, mismatched with the surface one, is revealed', technique: 'Plant identity clues early; the reveal rewrites relationships', example: 'The bullied cleaner turns out to be the controlling shareholder', bestFor: ['underdog', 'live-in son-in-law', 'hide strength'] },
  rev_stance: { name: 'Stance Reversal', definition: 'A character’s stance does a 180', technique: 'Drive the switch by interest/cognition change; give enough motive', example: 'Her strongest backer defects overnight over an old debt', bestFor: ['intrigue', 'business war', 'spy'] },
  rev_friendfoe: { name: 'Friend-Foe Reversal', definition: 'The ally is the enemy; the foe lends a hand', technique: 'Use information gaps to misdirect; supply evidence on payoff', example: 'The best friend helping her is the mole; the rival hands her key proof', bestFor: ['mystery', 'revenge', 'spy'] },
  rev_truefalse: { name: 'Real-Fake Reversal', definition: 'What seemed real is fake and vice versa', technique: 'Build certainty then overturn it; close the chain of proof', example: 'The “suicide note” is forged; the real person is upstairs', bestFor: ['mystery', 'hidden origin', 'detective'] },
  rev_cause: { name: 'Cause-Effect Reversal', definition: 'The true cause is the opposite of appearances', technique: 'Bury the causal chain in reverse; every detail lines up on reveal', example: 'The man blamed for harming others actually saved someone years ago', bestFor: ['mystery', 'family', 'redemption'] },
  rev_cognition: { name: 'Cognitive Reversal', definition: 'Overturn the settled belief of audience and characters', technique: 'Rewrite the whole situation with one new premise', example: 'She thought she was repaying kindness; he says he was settling a debt', bestFor: ['emotion', 'mystery', 'brain hole'] },
  rev_strongweak: { name: 'Strong-Weak Reversal', definition: 'Strength and weakness trade places; the oppressed gains the upper hand', technique: 'Appear weak and hide the edge, then show the hole card at the key moment', example: 'Everyone waits for her to fail; three sentences turn the tables', bestFor: ['underdog', 'workplace', 'power fantasy'] },
  rev_timeline: { name: 'Timeline Reversal', definition: 'Displaced time order inverts the truth', technique: 'Assemble the timeline via flashback/intercut; close the loop at the end', example: 'Two surveillance clips show he was nowhere near the scene', bestFor: ['mystery', 'crime', 'mind-bending'] },
  pay_faceslap: { name: 'Face-Slap', definition: 'The scorned person proves everyone wrong on the spot; onlookers flip', technique: 'Let the opponent overstate first, then strike back publicly with facts', example: 'Just mocked for not affording it, the manager jogs over calling her Chairwoman', bestFor: ['underdog', 'live-in son-in-law', 'urban'] },
  pay_counter: { name: 'Comeback Turnaround', definition: 'The underdog turns the game with hidden strength or planning', technique: 'Feign weakness to build momentum, then reverse in one move', example: 'The project is declared dead; she pulls out a ready Plan B', bestFor: ['workplace', 'business war', 'underdog'] },
  pay_id压制: { name: 'Status Suppression', definition: 'A hidden high status is revealed and crushes by rank', technique: 'Reveal identity layer by layer, each rank outranking the last', example: 'One call and the other side’s headquarters reverses course overnight', bestFor: ['wealthy clan', 'intrigue', 'hidden master'] },
  pay_crush: { name: 'Hard-Skill Crush', definition: 'Win in one move with raw professional strength', technique: 'No explaining — let the professional result speak', example: 'Under endless obstruction, she fixes the core system in three minutes', bestFor: ['profession', 'competition', 'expert'] },
  pay_truth: { name: 'Truth Revealed', definition: 'A misunderstanding/plot is exposed by evidence; justice returns', technique: 'Close the evidence chain in public so they can’t deny it', example: 'The surveillance plays; the one who framed her collapses on the spot', bestFor: ['mystery', 'family', 'revenge'] },
  pay_karma: { name: 'Instant Karma', definition: 'The villain gets what’s coming on the spot — no bottled-up frustration', technique: 'Don’t let the debt roll past this episode; give instant cause and effect', example: 'Right after throwing his weight around, the investigation notice arrives', bestFor: ['revenge', 'family', 'mass market'] },
  pay_sweet: { name: 'Mutual Devotion', definition: 'Emotional effort gets an equal response', technique: 'Answer earlier effort with one concrete action', example: 'The hardship she never voiced, he had quietly taken care of', bestFor: ['sweet romance', 'emotion', 'healing'] },
  pay_wish: { name: 'Wish Fulfillment', definition: 'Do for the viewer what they dare not do in real life', technique: 'Talk back / quit bare-faced / lay cards on the table — give an emotional outlet', example: 'Facing the PUA, she calmly slaps her resignation on the desk', bestFor: ['workplace', 'female-oriented', 'realistic'] },
  pay_underdog: { name: 'Dignity Regained', definition: 'The long-oppressed win back their dignity once', technique: 'The longer the buildup, the more cathartic the moment', example: 'Bullied for ten years, today she lifts her head for the first time', bestFor: ['underdog', 'family', 'mass market'] },
  pay_resource: { name: 'Windfall Resource', definition: 'Gain a key cheat ability / connection / fortune that changes the game', technique: 'The new resource is used at once, shifting the balance of power', example: 'At dead end, a dust-covered letter of authorization reaches her hands', bestFor: ['system', 'rebirth', 'golden finger'] },
  emo_suppress: { name: 'Suppressed Buildup', definition: 'Press first: bullied / misunderstood / held down', technique: 'Make the viewer hold it for the character, storing momentum for release', example: 'Her credit stolen, she clenches her fist and says nothing', bestFor: ['underdog', 'revenge'] },
  emo_burst: { name: 'Emotional Outburst', definition: 'The catharsis when conflict or emotion peaks', technique: 'After buildup, the total release — lines and action land together', example: 'She finally speaks, settling every account word by word', bestFor: ['family', 'emotion', 'conflict'] },
  emo_release: { name: 'Cathartic Release', definition: 'The exhilarating instant pressure lifts', technique: 'Right after buildup/outburst, let the viewer breathe', example: 'The verdict lands; she walks out the gate with a long exhale', bestFor: ['underdog', 'power fantasy'] },
  emo_warmth: { name: 'Warm Aftertaste', definition: 'Land emotion with one soft detail', technique: 'After a big conflict, give one small, concrete tenderness', example: 'After the fight, he quietly sets a warm congee beside her', bestFor: ['family', 'emotion', 'healing'] },
  emo_suspense: { name: 'Tugging Suspense', definition: 'The unresolved outcome that pulls you in', technique: 'Converge where the result is undecided, pulling to the next segment', example: 'The OR light stays on; nobody speaks', bestFor: ['medical', 'mystery', 'emotion'] },
  emo_tear: { name: 'Tearjerker Break', definition: 'Empathy peak: sacrifice / misunderstanding / kinship', technique: 'Move tears with a concrete object or detail, not slogans', example: 'From the belongings falls the train ticket she couldn’t bear to use', bestFor: ['kinship', 'angst', 'realistic'] },
  emo_hype: { name: 'Hype Peak', definition: 'Hot-blooded sense of mission maxed out', technique: 'Push emotion to a boil with a credo line plus action', example: '“This time, we call the shots.” Everyone rises', bestFor: ['hot-blooded', 'ensemble', 'inspirational'] },
  emo_heal: { name: 'Healing Comfort', definition: 'Emotion settles and is soothed', technique: 'Give emotion a landing point; let the aftertaste close', example: 'Dawn breaks; she leans by the window and smiles softly', bestFor: ['healing', 'emotion', 'slice-of-life'] },
};
const ALL_BEATS = [...REVERSAL_BEATS, ...PAYOFF_BEATS, ...EMOTION_BEATS];
const BEAT_BY_ID = new Map(ALL_BEATS.map((b) => [b.id, b]));
export function localizeBeat(b: BeatType, lang: BeatLang = 'zh'): BeatType {
  if (lang === 'en') { const e = BEAT_EN[b.id]; return e ? { ...b, ...e } : b; }
  return b;
}
export function beatNameOf(id: string | undefined, lang: BeatLang = 'zh'): string {
  if (!id) return '';
  const b = BEAT_BY_ID.get(id);
  if (!b) return id;
  return lang === 'en' ? (BEAT_EN[id]?.name ?? b.name) : b.name;
}

export function normalizeBeatPref(p?: Partial<CuePref> | null): CuePref {
  if (!p) return { ...DEFAULT_PREF, preferred: [], avoid: [], manual: {} };
  const valid = new Set<string>([...REVERSAL_BEATS, ...PAYOFF_BEATS, ...EMOTION_BEATS].map((b) => b.id));
  const clean = (a?: string[]) => (Array.isArray(a) ? a.filter((x) => valid.has(x)) : []);
  const manualIn = (p.manual ?? {}) as Record<string, string>;
  const manual: Record<number, string> = {};
  Object.entries(manualIn).forEach(([k, v]) => { const i = Number(k); if (Number.isInteger(i) && i >= 0 && i < 40000 && valid.has(v)) manual[i] = v; });
  const mode: CuePref['mode'] = p.mode === 'manual' || p.mode === 'hybrid' || p.mode === 'auto' ? p.mode : DEFAULT_PREF.mode;
  const strength: Strength = p.strength === 'relax' || p.strength === 'tight' ? p.strength : (p.strength === 'balanced' ? 'balanced' : DEFAULT_PREF.strength);
  const payoffFlavors = (Array.isArray(p.payoffFlavors) ? p.payoffFlavors.filter((x) => VALID_PAYOFF_FLAVORS.has(x)) : []);
  const reversalFlavors = (Array.isArray(p.reversalFlavors) ? p.reversalFlavors.filter((x) => VALID_REVERSAL_FLAVORS.has(x)) : []);
  const emotionFlavors = (Array.isArray(p.emotionFlavors) ? p.emotionFlavors.filter((x) => VALID_EMOTION_FLAVORS.has(x)) : []);
  return { mode, strength, preferred: clean(p.preferred), avoid: clean(p.avoid), manual, payoffFlavors, reversalFlavors, emotionFlavors };
}

/** 通用“用户可选+系统默认”选择器（与 hook-system.pickWithPreference 同构，类型独立，互不影响）
 *  v2.57：manualKey 与冷却用 position 分离——三类节拍共用一份 manual，必须用分层命名空间键查 manual，
 *  否则反转/爽点/情绪的顺序位会撞号（如第11个反转=第11个爽点=某集情绪首拍，都是键10）。position 仍只承担冷却间隔。 */
export function pickBeat(position: number, candidates: BeatType[], pref: CuePref, recent: string[], rng: () => number = Math.random, manualKey?: number): BeatType {
  const mk = manualKey ?? position;
  // v2.58：forced 先记下但不提前 return——必须照常走完全部 rng() 抽取，保证「定点某集不改变其他集」
  // （planBeats 全剧共用一条 rng 序列，提前 return 会少抽随机数、涟漪扰动后续集，破坏调色板同源承诺）
  const forced = (pref.mode === 'manual' || pref.mode === 'hybrid') && pref.manual[mk]
    ? candidates.find((c) => c.id === pref.manual[mk] && !pref.avoid.includes(c.id)) : undefined;
  let pool = candidates.filter((b) => !pref.avoid.includes(b.id));
  if (!pool.length) pool = candidates;
  const blocked = (b: BeatType) => { const last = recent.lastIndexOf(b.id); return last !== -1 && position - last <= b.cooldown; };
  let avail = pool.filter((b) => !blocked(b));
  if (!avail.length) avail = pool;
  const preferred = avail.filter((b) => pref.preferred.includes(b.id));
  if (preferred.length) avail = preferred;
  // v2.02/v2.03 风味软偏好：按候选节拍类型选对应风味轴；约70%落偏好、30%走全集，被冷却/禁用清空时回退，永不返回空
  const kind = candidates[0]?.kind;
  let flavorIds: string[] = []; let flavorMap: Record<string, string> = {};
  if (kind === 'payoff') { flavorIds = pref.payoffFlavors ?? []; flavorMap = PAYOFF_FLAVOR_MAP; }
  else if (kind === 'reversal') { flavorIds = pref.reversalFlavors ?? []; flavorMap = REVERSAL_FLAVOR_MAP; }
  else if (kind === 'emotion') { flavorIds = pref.emotionFlavors ?? []; flavorMap = EMOTION_FLAVOR_MAP; }
  if (flavorIds.length && candidates.every((b) => b.kind === kind)) {
    const byFlavor = avail.filter((b) => { const f = flavorMap[b.id]; return f && flavorIds.includes(f); });
    if (byFlavor.length && rng() < FLAVOR_BIAS) avail = byFlavor;
  }
  const selected = avail[Math.floor(rng() * avail.length)];
  return forced ?? selected;
}

const PAYOFF_COUNT = { relax: [0, 1], balanced: [1, 2], tight: [2, 3] } as Record<Strength, [number, number]>;
/**
 * v2.57 节拍 manual 分层命名空间（根治三类节拍共用数字键撞号，与 hook-system v2.56 的 HOOK_POS_NS 同思想）：
 *  reversal = 10000 + 集0基序号（每集至多1个主反转）
 *  payoff   = 20000 + 集0基序号*10 + 集内爽点序（每集至多3个，步长10留余量）
 *  emotion  = 30000 + 集0基序号*3  + 集内情绪拍序（固定3拍：起/承/合）
 * 直接调用 pickBeat 不传 manualKey 时回退 position，旧行为与旧测试保持不变。
 */
export const BEAT_POS_NS = { reversalBase: 10000, payoffBase: 20000, emotionBase: 30000 } as const;
export function beatManualKey(kind: BeatKind, ep0Based: number, slot0Based = 0): number {
  if (kind === 'reversal') return BEAT_POS_NS.reversalBase + ep0Based;
  if (kind === 'payoff') return BEAT_POS_NS.payoffBase + ep0Based * 10 + slot0Based;
  return BEAT_POS_NS.emotionBase + ep0Based * 3 + slot0Based;
}
export interface EpisodeBeat {
  episode: number;
  reversalId?: string;
  payoffIds: string[];
  emotionPath: string[]; // 有序情绪弧，保证有起伏、有压必有放
}
export interface BeatPlan { episodes: EpisodeBeat[]; strength: Strength; mode: CuePref['mode'] }

/** 规划全剧反转/爽点/情绪节拍：强度决定密度，轮换防疲劳；情绪弧强制“有起伏、有压必有放” */
export function planBeats(episodeCount: number, pref: CuePref = normalizeBeatPref(), rng: () => number = Math.random): BeatPlan {
  const episodes: EpisodeBeat[] = [];
  const recentRev: string[] = []; const recentPay: string[] = [];
  let revPos = 0; let payPos = 0;
  for (let e = 0; e < episodeCount; e++) {
    // 反转密度：tight 每集；balanced 约 2/3 集（0,1集即前两集给足，之后隔集）；relax 每3集，其余留呼吸（不僵硬）
    const needRev = pref.strength === 'tight' ? true : pref.strength === 'balanced' ? e % 3 !== 2 : e % 3 === 0;
    let reversalId: string | undefined;
    if (needRev) { reversalId = pickBeat(revPos++, REVERSAL_BEATS, pref, recentRev, rng, beatManualKey('reversal', e)).id; recentRev.push(reversalId); }
    // 爽点密度
    const [lo, hi] = PAYOFF_COUNT[pref.strength];
    const n = Math.max(lo, lo + Math.floor(rng() * (hi - lo + 1)));
    const payoffIds: string[] = [];
    for (let k = 0; k < n; k++) { const b = pickBeat(payPos++, PAYOFF_BEATS, pref, recentPay, rng, beatManualKey('payoff', e, k)); recentPay.push(b.id); payoffIds.push(b.id); }
    // 情绪弧：3拍，强制首尾不同型；若起拍是压抑/揪心类，后段必须跟一个释放类（有压有放，不憋观众）
    const path: string[] = [];
    const first = pickBeat(e * 10, EMOTION_BEATS, pref, [], rng, beatManualKey('emotion', e, 0)); path.push(first.id);
    const mid = pickBeat(e * 10 + 1, EMOTION_BEATS, pref, path, rng, beatManualKey('emotion', e, 1)); path.push(mid.id);
    let last: BeatType;
    if (SUPPRESSION_IDS.has(first.id) || SUPPRESSION_IDS.has(mid.id)) {
      const releasePool = EMOTION_BEATS.filter((b) => RELEASE_IDS.has(b.id) && !pref.avoid.includes(b.id) && b.id !== mid.id && b.id !== first.id);
      const pool = releasePool.length ? releasePool : EMOTION_BEATS.filter((b) => b.id !== first.id && b.id !== mid.id);
      // v2.58：合拍在「有压必放」分支也尊重用户逐点指定——但只接受本身即释放类的合法点选，硬规则不放松
      const landKey = beatManualKey('emotion', e, 2);
      const manualLand = (pref.mode === 'manual' || pref.mode === 'hybrid') && pref.manual[landKey]
        ? pool.find((b) => b.id === pref.manual[landKey]) : undefined;
      // 同样照常抽 rng 再覆盖，避免少抽一个随机数涟漪扰动后续集
      const picked = pool[Math.floor(rng() * pool.length)];
      last = manualLand ?? picked;
    } else {
      last = pickBeat(e * 10 + 2, EMOTION_BEATS, pref, path, rng, beatManualKey('emotion', e, 2));
      if (last.id === first.id) last = EMOTION_BEATS.find((b) => b.id !== first.id) ?? last;
    }
    path.push(last.id);
    // v2.03 结构性兜底：整条情绪弧只要含压抑/揪心类，就必须含释放类（含末拍随机落到压抑类的情形），保证“有压必放”硬规则不被随机/风味偏好破坏
    const pathPress = path.some((x) => SUPPRESSION_IDS.has(x));
    const pathRelease = path.some((x) => RELEASE_IDS.has(x));
    const safe = EMOTION_BEATS.filter((b) => RELEASE_IDS.has(b.id) && !pref.avoid.includes(b.id) && !path.slice(0, 2).includes(b.id));
    const fbPool = safe.length ? safe : EMOTION_BEATS.filter((b) => RELEASE_IDS.has(b.id));
    // v2.58：无论是否需要兜底都照常抽一次 rng，保证每集随机数抽数恒定——用户定点某集不会涟漪改变其他集
    const fallback = fbPool[Math.floor(rng() * fbPool.length)];
    if (pathPress && !pathRelease) path[2] = fallback.id;
    episodes.push({ episode: e + 1, reversalId, payoffIds, emotionPath: path });
  }
  return { episodes, strength: pref.strength, mode: pref.mode };
}

export type BeatIssueLevel = 'error' | 'warning';
export interface BeatIssue { level: BeatIssueLevel; at: string; msg: string; fix: string }
const beatName = (id?: string) => beatNameOf(id);

/** 节拍审计：反转不紧邻连用、爽点密度合强度、情绪不一条直线、有压必有放 */
export function auditBeats(plan: BeatPlan, lang: BeatLang = 'zh'): BeatIssue[] {
  const en = lang === 'en';
  const issues: BeatIssue[] = [];
  let prevRev = '';
  plan.episodes.forEach((ep) => {
    if (ep.reversalId) {
      if (ep.reversalId === prevRev) issues.push({ level: 'warning', at: en ? `Episode ${ep.episode} reversal` : `第${ep.episode}集反转`, msg: en ? 'Adjacent reversals are the same type — predictable' : '相邻反转同型，易 predictable', fix: en ? 'Switch reversal type to preserve surprise' : '换一种反转类型，保持意外感' });
      prevRev = ep.reversalId;
    } else prevRev = '';
    const [lo, hi] = PAYOFF_COUNT[plan.strength];
    if (ep.payoffIds.length < lo) issues.push({ level: 'warning', at: en ? `Episode ${ep.episode} payoff` : `第${ep.episode}集爽点`, msg: en ? `Fewer payoffs than the ${plan.strength} floor` : `爽点数量低于${plan.strength}档下限`, fix: en ? 'Add one instant-gratification payoff beat' : '补一个即时满足的爽点节拍' });
    if (ep.payoffIds.length > hi + 1) issues.push({ level: 'warning', at: en ? `Episode ${ep.episode} payoff` : `第${ep.episode}集爽点`, msg: en ? 'Over-dense payoffs numb the audience' : '爽点过密反而麻木', fix: en ? 'Leave breathing room, then detonate in concentration' : '留白蓄力，集中引爆' });
    if (ep.emotionPath.length >= 2 && ep.emotionPath.every((x) => x === ep.emotionPath[0]))
      issues.push({ level: 'warning', at: en ? `Episode ${ep.episode} emotion` : `第${ep.episode}集情绪`, msg: en ? 'Emotion is a flat line with no undulation' : '情绪一条直线，缺少起伏', fix: en ? 'Arrange suppress→release or tension alternation' : '安排压抑→释放或张弛转换' });
    const hasPress = ep.emotionPath.some((x) => SUPPRESSION_IDS.has(x));
    const hasRelease = ep.emotionPath.some((x) => RELEASE_IDS.has(x));
    if (hasPress && !hasRelease) issues.push({ level: 'error', at: en ? `Episode ${ep.episode} emotion` : `第${ep.episode}集情绪`, msg: en ? 'Only suppression without release — viewers drop out from frustration' : '只压抑不释放，观众会憋屈弃剧', fix: en ? 'Add an outburst/release/tear payoff within this episode' : '在本集内补一个爆发/释放/泪点回收' });
  });
  return issues;
}

/** 把某集节拍计划翻译成给岗位模型的可执行指令（规定用哪类节拍+怎么用，具体情节仍由模型创作） */
export interface BeatFlavorPref { payoffFlavors?: string[]; reversalFlavors?: string[]; emotionFlavors?: string[] }
export function buildBeatDirective(ep: EpisodeBeat, lang: BeatLang = 'zh', flavors: BeatFlavorPref = {}): string {
  const en = lang === 'en';
  const lines: string[] = [];
  const favP = (flavors.payoffFlavors ?? []).filter(Boolean) as PayoffFlavor[];
  if (favP.length) {
    const names = favP.map((f) => payoffFlavorName(f, lang)).join(en ? ', ' : '、');
    lines.push(en
      ? `Creator-preferred payoff flavor(s): ${names}. Favor these for instant-gratification beats where natural; never force one that does not fit, and keep payoff variety.`
      : `创作者偏好的爽点风味：${names}。爽点节拍在自然前提下优先这些风味，不合适处绝不硬塞，并保持爽点类型多样。`);
  }
  const favR = (flavors.reversalFlavors ?? []).filter(Boolean) as ReversalFlavor[];
  if (favR.length) {
    const names = favR.map((f) => reversalFlavorName(f, lang)).join(en ? ', ' : '、');
    lines.push(en
      ? `Creator-preferred reversal flavor(s): ${names}. Lean this way for the main twist, but always plant clues first and keep the reveal earned and non-repetitive.`
      : `创作者偏好的反转风味：${names}。主反转在自然前提下向这些风味靠拢，但必须先埋线索、揭晓可信，且不与邻近反转同型。`);
  }
  const favE = (flavors.emotionFlavors ?? []).filter(Boolean) as EmotionFlavor[];
  if (favE.length) {
    const names = favE.map((f) => emotionFlavorName(f, lang)).join(en ? ', ' : '、');
    lines.push(en
      ? `Creator-preferred emotion flavor(s): ${names}. Favor this emotional texture, yet the curve MUST still undulate and any suppression must be released within the episode — that rule comes first.`
      : `创作者偏好的情绪风味：${names}。情绪质感可向这些风味靠拢，但情绪曲线仍必须有起伏、先压必在本集释放，该硬规则优先于风味。`);
  }
  if (ep.reversalId) {
    const r = REVERSAL_BEATS.find((b) => b.id === ep.reversalId);
    if (r) {
      const rr = localizeBeat(r, lang);
      lines.push(en
        ? `The main reversal MUST be “${rr.name}”: ${rr.definition}; technique: ${rr.technique} (reference: ${rr.example}); plant clues before and pay off on reveal — never drop it from nowhere.`
        : `本集主反转用「${rr.name}」：${rr.definition}；手法：${rr.technique}（参考：${rr.example}），反转前埋线索、揭晓时回收，不能空降`);
    }
  } else {
    lines.push(en ? 'Do not force a big reversal this episode; focus on advancing and building momentum, leaving rhythmic breathing room (avoid reversal for its own sake).' : '本集不强行安排大反转，重在推进与蓄力，给节奏留白（避免为反转而反转）');
  }
  if (ep.payoffIds.length) {
    const ps = ep.payoffIds.map((id) => { const b = BEAT_BY_ID.get(id); if (!b) return ''; const bb = localizeBeat(b, lang); return en ? `“${bb.name}” (${bb.technique})` : `「${bb.name}」(${bb.technique})`; }).filter(Boolean);
    lines.push(en
      ? `Place ${ep.payoffIds.length} payoff beat(s) this episode and cash them out instantly, no IOUs: ${ps.join('; ')}`
      : `本集安排 ${ep.payoffIds.length} 个爽点节拍并即时兑现、不拖账：${ps.join('；')}`);
  }
  const emo = ep.emotionPath.map((id) => beatNameOf(id, lang)).filter(Boolean).join(en ? ' → ' : '→');
  lines.push(en
    ? `Follow the emotional curve “${emo}”; it MUST undulate, and whatever is pressed first must be released within this episode — never hold one emotion throughout.`
    : `本集情绪曲线按「${emo}」推进，必须有起伏、先压的必须在本集内释放，不允许全程一个情绪`);
  lines.push(en
    ? 'Reversals / payoffs / emotions must grow naturally out of character and situation; no slogans, labels, or mechanical check-boxing.'
    : '反转/爽点/情绪都要从人物与情境里自然长出来，禁止喊口号、贴标签或机械打卡');
  return lines.join('\n');
}
