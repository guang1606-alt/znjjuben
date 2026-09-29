/**
 * 钩子工程体系（去AI味·拉留存·促付费的核心创作引擎）
 *
 * 设计原则（导演思路落地）：
 *  1) 钩子分层：开场钩(黄金3秒) / 集钩(集首承接+集尾卡点) / 场钩(场景牵引) / 微钩(句子级)；
 *  2) 钩子不是僵硬堆砌：类型轮换避免疲劳、按强度档位留呼吸、伏笔必须兑现；
 *  3) 用户可选 + 系统默认：auto(系统智能) / manual(用户逐点指定) / hybrid(用户指定优先、其余系统补)；
 *  4) 举一反三：pickWithPreference 是通用机制，反转/爽点/情绪节拍同构复用（见 REVERSAL_TYPES）。
 * 纯函数、可离线对拍。
 */

export type HookLayer = 'open' | 'episode' | 'scene' | 'micro';
export interface HookType {
  id: string; name: string; layer: HookLayer;
  definition: string; technique: string; example: string;
  bestFor: string[]; cooldown: number; // 同型再次出现至少间隔的位置数，防疲劳
}

// —— 开场钩：黄金3秒，0铺垫直接炸（5种被验证公式 + 三型）——
export const OPEN_HOOKS: HookType[] = [
  { id: 'open_conflict', layer: 'open', name: '直接冲突型', definition: '第一帧即强冲突现场', technique: '不交代背景，直接进争执/打脸/对峙，背景靠后续补', example: '婚礼现场，新娘把戒指甩在新郎脸上', bestFor: ['逆袭','都市情感','家庭'], cooldown: 1 },
  { id: 'open_suspense', layer: 'open', name: '强悬念型', definition: '抛出无解疑问/危险', technique: '枪口、化验单、神秘来电，先给结果再回溯', example: '一份DNA鉴定摊在桌上，她手在抖', bestFor: ['悬疑','复仇','豪门'], cooldown: 1 },
  { id: 'open_contrast', layer: 'open', name: '极致反差型', definition: '上一秒巅峰下一秒谷底', technique: '用身份/境遇的剧烈落差制造好奇缺口', example: '前一秒她是总裁夫人，下一秒被保安拖出大楼', bestFor: ['逆袭','重生','豪门'], cooldown: 1 },
  { id: 'open_identity', layer: 'open', name: '身份逆转钩', definition: '表面身份与真实身份错位', technique: '一句身份压制句点破隐藏底牌', example: '所有人都以为我是保姆，不知道这栋楼是我家的', bestFor: ['扮猪吃虎','隐世高手','赘婿'], cooldown: 1 },
  { id: 'open_desperate', layer: 'open', name: '绝境钩', definition: '开篇即两难/无解处境', technique: '建立时限与严重后果(stakes)，观众必须看解法', example: '倒计时十分钟，绑匪让她选一个孩子', bestFor: ['冒险逃生','悬疑','灾难'], cooldown: 1 },
  { id: 'open_countdown', layer: 'open', name: '倒计时钩', definition: '紧迫时限+严重后果', technique: '显性时钟制造压迫感', example: '距离手术签字失效还有20分钟', bestFor: ['医疗','悬疑','救援'], cooldown: 1 },
  { id: 'open_reveal', layer: 'open', name: '惊天揭露钩', definition: '一句话颠覆认知', technique: '用信息炸弹重写人物关系', example: '“你护了二十年的恩人，就是当年害你家的人。”', bestFor: ['复仇','权谋','身世'], cooldown: 1 },
  { id: 'open_abnormal', layer: 'open', name: '反常画面钩', definition: '展示不合常理的画面', technique: '视觉反常先抓住眼，再解释', example: '普通街道上，他背后突然展开一对翅膀', bestFor: ['玄幻','科幻','脑洞'], cooldown: 1 },
  { id: 'open_line', layer: 'open', name: '金句开场钩', definition: '一句炸场台词定调', technique: '高信息密度金句即钩子', example: '“我嫁的不是人，是这座城最深的局。”', bestFor: ['权谋','大女主','悬疑'], cooldown: 1 },
  { id: 'open_endure', layer: 'open', name: '隐忍卖惨钩', definition: '被剥夺时不哭不闹，面无表情咽下，心里记下复仇倒计时', technique: '惨得有尊严、反弹延后；当众剥夺要够真，给隐忍一个明确兑付期限，比当场开挂高级', example: '他咽下所有羞辱，只在心里说：还有二十七天，你们就该跪了', bestFor: ['复仇','逆袭','赘婿','战神','大女主'], cooldown: 1 },
  { id: 'open_cognitive', layer: 'open', name: '认知颠覆钩', definition: '第一句推翻常识：你以为的X其实是Y', technique: '摘取全剧最诡异/最颠覆的一个判断放第一段，只给结论不解释为何，撬动认知基石', example: '物理学，不存在了。', bestFor: ['科幻','悬疑','奇幻','脑洞'], cooldown: 1 },
];

// —— 集钩：集首承接(防断线) + 集尾卡点(促追更/付费解锁) ——
export const EPISODE_END_HOOKS: HookType[] = [
  { id: 'ep_cliff_danger', layer: 'episode', name: '危机断点', definition: '集尾停在危险降临瞬间', technique: '动作未完成处切断，下一集首承接', example: '门被撞开的刹那，画面黑掉', bestFor: ['悬疑','动作','逃生'], cooldown: 2 },
  { id: 'ep_cliff_reveal', layer: 'episode', name: '揭秘断点', definition: '真相将揭未揭', technique: '关键信息说到一半切断', example: '“其实你的亲生母亲是——”本集完', bestFor: ['身世','权谋','复仇'], cooldown: 2 },
  { id: 'ep_cliff_reversal', layer: 'episode', name: '反转断点', definition: '集尾最后一句颠覆', technique: '最后10秒给预期违背', example: '一直帮她的人，转身拨通了反派的电话', bestFor: ['悬疑','谍战','复仇'], cooldown: 3 },
  { id: 'ep_cliff_choice', layer: 'episode', name: '抉择断点', definition: '停在两难选择前', technique: '把道德/利益两难抛给观众', example: '救母亲还是救女儿，她抬起了手', bestFor: ['家庭','情感','医疗'], cooldown: 2 },
  { id: 'ep_cliff_emotion', layer: 'episode', name: '情感断点', definition: '情绪顶到最高处切断', technique: '付费解锁点：情绪峰值即卡点', example: '他单膝跪下的瞬间，集终', bestFor: ['甜宠','虐恋','家庭'], cooldown: 2 },
  { id: 'ep_cliff_newperson', layer: 'episode', name: '新变量断点', definition: '关键新人/新证据登场', technique: '引入改变格局的新变量后切断', example: '会议室门开，来的竟是“死去”的他', bestFor: ['商战','豪门','悬疑'], cooldown: 3 },
];

// —— 场钩：场景之间的牵引 ——
export const SCENE_HOOKS: HookType[] = [
  { id: 'scene_goal_block', layer: 'scene', name: '目标受阻钩', definition: '角色目标刚建立就被打断', technique: '场末让新障碍出现，驱动下一场', example: '她刚拿到合同，对方宣布作废', bestFor: ['职场','逆袭'], cooldown: 2 },
  { id: 'scene_info_drop', layer: 'scene', name: '信息抛出钩', definition: '场末丢出一条关键信息', technique: '用一句新情报勾住下一场', example: '“监控里那天，还有第二个人。”', bestFor: ['悬疑','探案'], cooldown: 2 },
  { id: 'scene_cut_question', layer: 'scene', name: '转场疑问钩', definition: '带着问题切场', technique: '问题不在本场回答，切到平行线索', example: '她盯着空存折，镜头切到奢侈品店的丈夫', bestFor: ['家庭','悬疑'], cooldown: 2 },
];

// —— 微钩：场内句子级，共 9 种装置（动作/语言/氛围/情绪/信息差/伏笔/感官/微反转/连环）；对用户暴露归并为下方 6 大风味（HookFlavor）——
export const MICRO_HOOKS: HookType[] = [
  { id: 'micro_action', layer: 'micro', name: '动作钩子', definition: '一个反常/危险/意味深长的动作', technique: '用动作代替解释，展示而非讲述', example: '他笑着，却把遗嘱往火里推了推', bestFor: ['权谋','悬疑','家庭'], cooldown: 1 },
  { id: 'micro_line', layer: 'micro', name: '语言钩子', definition: '话里有话/一语双关/没说完', technique: '潜台词制造张力，避免说教式直说', example: '“你跟你爸，真是一模一样。”（她脸色骤变）', bestFor: ['家庭','情感','权谋'], cooldown: 1 },
  { id: 'micro_atmos', layer: 'micro', name: '氛围钩子', definition: '环境/光影/声音突变制造不安', technique: '用氛围预示，不直接说破', example: '楼道声控灯一层层熄灭，脚步声没停', bestFor: ['悬疑','惊悚','志怪'], cooldown: 1 },
  { id: 'micro_emotion', layer: 'micro', name: '情绪钩子', definition: '情绪反差/隐忍将爆/共情细节', technique: '给一个具体的情绪载体动作', example: '她笑着说没事，手却把纸巾攥成了团', bestFor: ['情感','家庭','治愈'], cooldown: 1 },
  { id: 'micro_gap', layer: 'micro', name: '信息差钩子', definition: '观众知角色不知(戏剧反讽)或反之', technique: '利用认知差制造紧张/期待', example: '观众看见身后有人，她还在开心做饭', bestFor: ['悬疑','惊悚','甜宠'], cooldown: 1 },
  { id: 'micro_foreshadow', layer: 'micro', name: '伏笔钩子', definition: '埋下待回收的谜/物/话', technique: '随手埋、后面必须兑现(payoff)', example: '第一集特写的旧钥匙，第十八集打开保险柜', bestFor: ['悬疑','权谋','长线'], cooldown: 2 },
  { id: 'micro_sense', layer: 'micro', name: '感官钩子', definition: '强画面/气味/声音特写', technique: '用具体感官落地烟火气与临场感', example: '雨水混着铁锈味灌进喉咙', bestFor: ['写实','灾难','烟火气'], cooldown: 1 },
  { id: 'micro_minitwist', layer: 'micro', name: '微反转钩子', definition: '场内小预期违背', technique: '一句/一个动作级别反转保持鲜活', example: '她递出辞职信，老板却先递来升职书', bestFor: ['职场','轻喜','逆袭'], cooldown: 2 },
  { id: 'micro_chain', layer: 'micro', name: '连环钩', definition: '第一句抓住人后第二句立刻再锁一次，禁止转去铺垫', technique: '感官钉死(视觉转听觉)/倒刺问题(结论后跟矛盾)/视角爆破(宏观缩微观)三选一', example: '血从天花板渗下来——正落进他面前的咖啡杯，洇开一圈暗红', bestFor: ['全部','悬疑','动作'], cooldown: 1 },
];

export const ALL_HOOKS: HookType[] = [...OPEN_HOOKS, ...EPISODE_END_HOOKS, ...SCENE_HOOKS, ...MICRO_HOOKS];
const HOOK_BY_ID = new Map(ALL_HOOKS.map((h) => [h.id, h]));

// v2.01 微钩「风味」分类（导演思路：动作/语言/氛围/情绪/信息差/伏笔结构 六大风味，用户可选、系统默认均衡）
// 仅对句子级微钩(micro)分层；开场钩/集尾卡点/场末牵引仍按各自层轮换，不受风味影响。
export type HookFlavor = 'action' | 'line' | 'atmos' | 'emotion' | 'gap' | 'foreshadow';
export const FLAVOR_META: Record<HookFlavor, { name: string; nameEn: string; desc: string; descEn: string }> = {
  action: { name: '动作钩子', nameEn: 'Action hook', desc: '用反常/危险/意味深长的动作或小反转代替解释，展示而非讲述', descEn: 'Show through an ominous, dangerous or telling action / mini-twist instead of explaining' },
  line: { name: '语言钩子', nameEn: 'Line hook', desc: '话里有话、一语双关、话没说完，用潜台词制造张力', descEn: 'Subtext, double meaning and unfinished lines create tension' },
  atmos: { name: '氛围/感官钩子', nameEn: 'Atmosphere/sense hook', desc: '环境、光影、声音、气味突变预示不安或临场感，不直接说破', descEn: 'Sudden shifts in setting, light, sound or smell foreshadow without spelling it out' },
  emotion: { name: '情绪钩子', nameEn: 'Emotion hook', desc: '情绪反差、隐忍将爆、共情细节，给情绪一个具体载体动作', descEn: 'Emotional contrast, restrained-about-to-burst moments, empathy via a concrete carrier action' },
  gap: { name: '信息差钩子', nameEn: 'Information-gap hook', desc: '观众知角色不知或反之，用认知差制造紧张与期待', descEn: 'Dramatic irony — the audience and a character know different things — builds suspense' },
  foreshadow: { name: '伏笔/连环钩子', nameEn: 'Foreshadow/chain hook', desc: '随手埋下待回收的谜/物/话，或第二句立刻再锁一次', descEn: 'Plant a mystery/object/line to pay off later, or chain a second lock immediately' },
};
export const HOOK_FLAVORS: HookFlavor[] = ['action', 'line', 'atmos', 'emotion', 'gap', 'foreshadow'];
const MICRO_FLAVOR_MAP: Record<string, HookFlavor> = {
  micro_action: 'action', micro_minitwist: 'action',
  micro_line: 'line',
  micro_atmos: 'atmos', micro_sense: 'atmos',
  micro_emotion: 'emotion',
  micro_gap: 'gap',
  micro_foreshadow: 'foreshadow', micro_chain: 'foreshadow',
};
/** 返回某微钩的风味；非微钩返回 undefined */
export function hookFlavor(id: string): HookFlavor | undefined { return MICRO_FLAVOR_MAP[id]; }
export function flavorName(f: HookFlavor, lang: 'zh' | 'en' = 'zh'): string { const m = FLAVOR_META[f]; return lang === 'en' ? m.nameEn : m.name; }
export const VALID_FLAVORS = new Set<string>(HOOK_FLAVORS);
/** 风味/偏好轴的软加权概率：约70%落在用户偏好，其余走全集，保证多样不霸占（v2.01/v2.02 两选择器共用） */
export const FLAVOR_BIAS = 0.7;

/* ============ v1.95 钩子英文层（id 键控，中文库为单一事实来源；默认中文逐字不变） ============ */
export type HookLang = 'zh' | 'en';
interface HookEn { name: string; definition: string; technique: string; example: string; bestFor: string[] }
const HOOK_EN: Record<string, HookEn> = {
  // 开场钩 11
  open_conflict: { name: 'Direct Conflict', definition: 'A strong-conflict scene in the very first frame', technique: 'Skip backstory, drop straight into a quarrel/face-slap/confrontation; fill background later', example: 'At the wedding, the bride flings the ring into the groom’s face', bestFor: ['underdog', 'urban romance', 'family'] },
  open_suspense: { name: 'High Suspense', definition: 'Raise an unsolvable question or danger', technique: 'A gun, a lab report, a mysterious call — show the result then flash back', example: 'A DNA report lies on the table; her hand is shaking', bestFor: ['mystery', 'revenge', 'wealthy clan'] },
  open_contrast: { name: 'Sharp Contrast', definition: 'Peak one second, rock bottom the next', technique: 'Use a violent drop in status/fortunes to open an information gap', example: 'One second she is the CEO’s wife, the next security drags her out of the building', bestFor: ['underdog', 'rebirth', 'wealthy clan'] },
  open_identity: { name: 'Identity Reversal', definition: 'Surface identity mismatched with the real one', technique: 'One status-suppressing line reveals the hidden hole card', example: 'Everyone thinks I’m the maid; nobody knows I own this building', bestFor: ['hide strength', 'hidden master', 'live-in son-in-law'] },
  open_desperate: { name: 'Desperate Spot', definition: 'Open on a dilemma or no-way-out situation', technique: 'Set a deadline and grave stakes so the viewer must see the way out', example: 'Ten minutes on the clock; the kidnapper makes her choose one child', bestFor: ['survival', 'mystery', 'disaster'] },
  open_countdown: { name: 'Countdown', definition: 'Pressing time limit + grave consequence', technique: 'A visible clock builds pressure', example: 'Twenty minutes before the surgery consent expires', bestFor: ['medical', 'mystery', 'rescue'] },
  open_reveal: { name: 'Earth-Shattering Reveal', definition: 'One line overturns everything known', technique: 'Use an information bomb to rewrite relationships', example: '“The benefactor you protected for twenty years is the one who destroyed your family.”', bestFor: ['revenge', 'intrigue', 'hidden origin'] },
  open_abnormal: { name: 'Abnormal Image', definition: 'Show an image that defies common sense', technique: 'A visual anomaly catches the eye first, explanation comes after', example: 'On an ordinary street, a pair of wings suddenly unfolds behind him', bestFor: ['fantasy', 'sci-fi', 'brain hole'] },
  open_line: { name: 'Killer Opening Line', definition: 'One showstopping line sets the tone', technique: 'A high-density golden line is itself the hook', example: '“I didn’t marry a man — I married the deepest scheme in this city.”', bestFor: ['intrigue', 'strong female', 'mystery'] },
  open_endure: { name: 'Endure with Dignity', definition: 'When stripped of everything, no tears or fuss — swallow it blank-faced and start a silent revenge countdown', technique: 'Suffering with dignity, payoff delayed; make the public deprivation real, give endurance a clear due date — classier than an instant power-up', example: 'He swallows every humiliation, thinking only: twenty-seven days, and you’ll all kneel', bestFor: ['revenge', 'underdog', 'live-in son-in-law', 'war god', 'strong female'] },
  open_cognitive: { name: 'Cognitive Overturn', definition: 'The first line refutes common sense: the X you assumed is actually Y', technique: 'Put the eeriest, most subversive verdict of the whole story in paragraph one, conclusion only, no explanation', example: 'Physics no longer exists.', bestFor: ['sci-fi', 'mystery', 'fantasy', 'brain hole'] },
  // 集尾 6
  ep_cliff_danger: { name: 'Danger Cut-off', definition: 'End the episode at the instant danger strikes', technique: 'Cut mid-action; the next episode opens by picking it up', example: 'The instant the door is smashed open, the screen cuts to black', bestFor: ['mystery', 'action', 'escape'] },
  ep_cliff_reveal: { name: 'Reveal Cut-off', definition: 'The truth is about to be told', technique: 'Cut a key piece of information halfway', example: '“Actually, your birth mother is —” end of episode', bestFor: ['hidden origin', 'intrigue', 'revenge'] },
  ep_cliff_reversal: { name: 'Reversal Cut-off', definition: 'The very last line overturns expectations', technique: 'Defy expectation in the final 10 seconds', example: 'The one who kept helping her turns and dials the villain', bestFor: ['mystery', 'spy', 'revenge'] },
  ep_cliff_choice: { name: 'Dilemma Cut-off', definition: 'Stop right before a two-way choice', technique: 'Hand a moral/interest dilemma to the viewer', example: 'Save the mother or the daughter — she lifts her hand', bestFor: ['family', 'romance', 'medical'] },
  ep_cliff_emotion: { name: 'Emotion Cut-off', definition: 'Cut at the emotional peak', technique: 'Pay-unlock point: the emotional peak is the cliff', example: 'The instant he drops to one knee, the episode ends', bestFor: ['sweet romance', 'angst', 'family'] },
  ep_cliff_newperson: { name: 'New-Variable Cut-off', definition: 'A key new person or piece of evidence enters', technique: 'Cut right after introducing a game-changing variable', example: 'The meeting-room door opens — in walks the “dead” man', bestFor: ['business war', 'wealthy clan', 'mystery'] },
  // 场钩 3
  scene_goal_block: { name: 'Goal Blocked', definition: 'The character’s goal is interrupted the moment it forms', technique: 'Drop a new obstacle at scene’s end to drive the next scene', example: 'She has just obtained the contract when the other side voids it', bestFor: ['workplace', 'underdog'] },
  scene_info_drop: { name: 'Information Drop', definition: 'Toss out a key piece of information at scene’s end', technique: 'Use one line of new intel to pull into the next scene', example: '“That day on the surveillance footage, there was a second person.”', bestFor: ['mystery', 'detective'] },
  scene_cut_question: { name: 'Question Cut', definition: 'Cut scenes while carrying a question', technique: 'Don’t answer the question here; cut to a parallel thread', example: 'She stares at the empty bankbook; the camera cuts to her husband in a luxury store', bestFor: ['family', 'mystery'] },
  // 微钩 9
  micro_action: { name: 'Action Hook', definition: 'One abnormal / dangerous / meaningful action', technique: 'Show, don’t tell — let an action replace explanation', example: 'Smiling, he nudges the will a little closer to the fire', bestFor: ['intrigue', 'mystery', 'family'] },
  micro_line: { name: 'Dialogue Hook', definition: 'Loaded subtext / double meaning / an unfinished sentence', technique: 'Subtext creates tension; avoid preachy direct statement', example: '“You and your father are exactly alike.” (her face changes)', bestFor: ['family', 'romance', 'intrigue'] },
  micro_atmos: { name: 'Atmosphere Hook', definition: 'A sudden shift in environment/light/sound creates unease', technique: 'Foreshadow through mood, never state it outright', example: 'The hallway’s motion-sensor lights go out floor by floor; the footsteps don’t stop', bestFor: ['mystery', 'thriller', 'supernatural'] },
  micro_emotion: { name: 'Emotion Hook', definition: 'Emotional contrast / restrained-about-to-burst / empathy detail', technique: 'Give emotion a concrete physical carrier', example: 'She says she’s fine with a smile, but her hand crumples the tissue into a ball', bestFor: ['romance', 'family', 'healing'] },
  micro_gap: { name: 'Information-Gap Hook', definition: 'The viewer knows what the character doesn’t (dramatic irony) or vice versa', technique: 'Exploit the cognitive gap for tension or anticipation', example: 'The viewer sees someone behind her while she happily cooks', bestFor: ['mystery', 'thriller', 'sweet romance'] },
  micro_foreshadow: { name: 'Foreshadow Hook', definition: 'Plant a riddle/object/line to be repaid later', technique: 'Plant casually; it must pay off later', example: 'The old key shown in close-up in episode 1 opens the safe in episode 18', bestFor: ['mystery', 'intrigue', 'long form'] },
  micro_sense: { name: 'Sensory Hook', definition: 'A strong close-up of image/smell/sound', technique: 'Use concrete senses for grounded, lived-in presence', example: 'Rain mixed with the metallic tang of rust floods his throat', bestFor: ['realistic', 'disaster', 'slice-of-life'] },
  micro_minitwist: { name: 'Mini-Twist', definition: 'A small expectation subversion within a scene', technique: 'A one-line/one-action twist keeps things fresh', example: 'She hands in her resignation, but the boss hands her a promotion first', bestFor: ['workplace', 'light comedy', 'underdog'] },
  micro_chain: { name: 'Chain Hook', definition: 'After line one grabs them, line two must lock again at once — never pivot to setup', technique: 'Pick one: sensory nail (visual→auditory), barbed question (conclusion→contradiction), or perspective burst (macro→micro)', example: 'Blood seeps through the ceiling — landing right in his coffee cup, blooming a dark red ring', bestFor: ['all', 'mystery', 'action'] },
};
/** v1.95 本地化单个钩子（lang=en 返回英文字段副本，zh 返回原对象，保证中文逐字不变） */
export function localizeHook(h: HookType, lang: HookLang = 'zh'): HookType {
  if (lang === 'en') {
    const e = HOOK_EN[h.id];
    return e ? { ...h, name: e.name, definition: e.definition, technique: e.technique, example: e.example, bestFor: e.bestFor } : h;
  }
  return h;
}
export function describeHook(id: string, lang: HookLang = 'zh'): HookType | undefined {
  const h = HOOK_BY_ID.get(id);
  return h ? localizeHook(h, lang) : undefined;
}

// 举一反三：反转类型库（与钩子同构，同样可 auto/manual/hybrid 选择）
export const REVERSAL_TYPES = ['身份反转', '立场反转', '敌友反转', '真假反转', '因果反转', '认知反转', '强弱反转', '时间线反转'] as const;
/** v1.95 反转类型英文（按下标对齐 REVERSAL_TYPES） */
export const REVERSAL_TYPES_EN = ['Identity reversal', 'Stance reversal', 'Friend-foe reversal', 'Real-fake reversal', 'Cause-effect reversal', 'Cognitive reversal', 'Strong-weak reversal', 'Timeline reversal'] as const;
export function reversalName(zh: string, lang: HookLang = 'zh'): string {
  if (lang !== 'en') return zh;
  const i = (REVERSAL_TYPES as readonly string[]).indexOf(zh);
  return i >= 0 ? REVERSAL_TYPES_EN[i] : zh;
}

export type CueMode = 'auto' | 'manual' | 'hybrid';
export type Strength = 'relax' | 'balanced' | 'tight';
export interface CuePref {
  mode: CueMode; strength: Strength;
  preferred: string[];  // 用户偏好类型id（加权优先）
  avoid: string[];      // 用户禁用类型id
  manual: Record<number, string>; // 位置→指定类型id（manual/hybrid 生效）
  microFlavors?: HookFlavor[]; // v2.01 用户偏好的微钩风味（软加权，仅作用于 micro 层；空=系统均衡）
  payoffFlavors?: string[];   // v2.02 用户偏好的爽点风味（软加权，仅作用于 payoff 节拍；合法值由 beat-system 定义）
  reversalFlavors?: string[]; // v2.03 用户偏好的反转风味（仅作用于 reversal 节拍）
  emotionFlavors?: string[];  // v2.03 用户偏好的情绪风味（仅作用于 emotion 节拍；有压必放的硬规则优先）
}
export const DEFAULT_PREF: CuePref = { mode: 'auto', strength: 'balanced', preferred: [], avoid: [], manual: {}, microFlavors: [] };

/**
 * 通用"用户可选+系统默认"选择器（举一反三：钩子/反转/爽点/情绪节拍都能用）
 * - manual 指定位置强制用用户值；auto/hybrid 的空位由系统按 cooldown 轮换、避开 avoid、偏好加权
 */
export function pickWithPreference(position: number, candidates: HookType[], pref: CuePref, recent: string[], rng: () => number = Math.random): HookType {
  // forced 先记下但不提前 return：必须照常走完全部 rng() 抽取，保证「手动定点某一集不改变其他集」
  // （planHooks 全剧共用一条 rng 序列，提前 return 会少抽随机数、涟漪扰动后续集，与 beat-system pickBeat 同约定）
  const forced = (pref.mode === 'manual' || pref.mode === 'hybrid') && pref.manual[position]
    ? candidates.find((c) => c.id === pref.manual[position] && !pref.avoid.includes(c.id)) : undefined;
  const blockedAt = (h: HookType) => {
    // v2.56 冷却按「同层最近被选的间隔次数」计算，与位置键命名空间解耦（位置键分层后不再连续）
    const last = recent.lastIndexOf(h.id);
    return last !== -1 && (recent.length - 1 - last) < h.cooldown; // 冷却期内不连用
  };
  let pool = candidates.filter((h) => !pref.avoid.includes(h.id));
  if (!pool.length) pool = candidates; // 用户禁掉整层全部类型时回退全集，保证永远有结果、不返回 undefined
  let avail = pool.filter((h) => !blockedAt(h));
  if (!avail.length) avail = pool; // 都在冷却则放开，保证有结果
  const preferred = avail.filter((h) => pref.preferred.includes(h.id));
  if (preferred.length) avail = preferred;
  // v2.01 微钩风味软偏好：用户选了风味时，在同等可用集合里优先对应风味；为空或被冷却/禁用则回退，保证永远有结果
  const flavors = pref.microFlavors ?? [];
  if (flavors.length && candidates.some((h) => h.layer === 'micro')) {
    const byFlavor = avail.filter((h) => { const f = MICRO_FLAVOR_MAP[h.id]; return f && flavors.includes(f); });
    // 真软加权：约70%落在偏好风味，约30%仍从全集取，保证多样、不霸占（偏好组成员被冷却时自然回退全集）
    if (byFlavor.length && rng() < FLAVOR_BIAS) avail = byFlavor;
  }
  const selected = avail[Math.floor(rng() * avail.length)];
  return forced ?? selected;
}

export interface SceneCue { scene: number; endHookId?: string; microHookIds: string[] }
export interface EpisodePlan { episode: number; openHookId: string; scenes: SceneCue[]; endHookId: string }
export interface HookPlan { episodes: EpisodePlan[]; strength: Strength; mode: CueMode }

const STRENGTH_MICRO = { relax: [0, 1], balanced: [1, 2], tight: [2, 3] } as Record<Strength, [number, number]>;
// v2.56 manual 位置键分层命名空间，杜绝开场/场末/集尾/微钩跨层撞号（open=e；scene=1000+e*100+s；end=20000+e；micro=40000+mPos）
export const HOOK_POS_NS = { sceneBase: 1000, endBase: 20000, microBase: 40000 } as const;
/** 生成全剧钩子布置计划：每集必有开场钩与集尾卡点，场钩/微钩按强度布置并轮换，manual 位置尊重用户 */
export function planHooks(episodeCount: number, scenesPerEp: number, pref: CuePref = DEFAULT_PREF, rng: () => number = Math.random): HookPlan {
  const episodes: EpisodePlan[] = [];
  const recentEnd: string[] = []; let endPos = 0;
  for (let e = 0; e < episodeCount; e++) {
    const open = pickWithPreference(e, OPEN_HOOKS, pref, [], rng); // 每集(尤其首集)开场钩
    const scenes: SceneCue[] = [];
    const recentMicro: string[] = []; let mPos = 0;
    for (let s = 0; s < scenesPerEp; s++) {
      const [lo, hi] = STRENGTH_MICRO[pref.strength];
      const n = lo + Math.floor(rng() * (hi - lo + 1));
      const micro: string[] = [];
      for (let k = 0; k < n; k++) { const h = pickWithPreference(HOOK_POS_NS.microBase + mPos++, MICRO_HOOKS, pref, recentMicro, rng); recentMicro.push(h.id); micro.push(h.id); }
      // 场末牵引：tight 每场都有，balanced 隔场，relax 稀疏（留呼吸）
      const needSceneHook = pref.strength === 'tight' || (pref.strength === 'balanced' && s % 2 === 1) || (pref.strength === 'relax' && s === scenesPerEp - 1);
      const sceneEnd = needSceneHook ? pickWithPreference(HOOK_POS_NS.sceneBase + e * 100 + s, SCENE_HOOKS, pref, [], rng).id : undefined;
      scenes.push({ scene: s + 1, endHookId: sceneEnd, microHookIds: micro });
    }
    const end = pickWithPreference(HOOK_POS_NS.endBase + endPos++, EPISODE_END_HOOKS, pref, recentEnd, rng); recentEnd.push(end.id);
    episodes.push({ episode: e + 1, openHookId: open.id, scenes, endHookId: end.id });
  }
  return { episodes, strength: pref.strength, mode: pref.mode };
}

export type IssueLevel = 'error' | 'warning';
export interface HookIssue { level: IssueLevel; at: string; msg: string; fix: string }
/** 钩子审计：防僵硬（同型连用/过密无呼吸）、防缺失（开场/集尾）、防伏笔不兑现；v1.95 支持英文输出 */
export function auditHooks(plan: HookPlan, paidOffForeshadow = true, lang: HookLang = 'zh'): HookIssue[] {
  const en = lang === 'en';
  const issues: HookIssue[] = [];
  let prevEnd = '';
  let microSeq: string[] = [];
  let hasForeshadow = false;
  plan.episodes.forEach((ep) => {
    if (!ep.openHookId) issues.push({ level: 'error', at: en ? `Episode ${ep.episode} opening` : `第${ep.episode}集开场`, msg: en ? 'Missing the golden-3-seconds opening hook' : '缺少黄金3秒开场钩', fix: en ? 'Add a direct-conflict / high-suspense / contrast opening' : '补一个直接冲突/强悬念/反差开场' });
    if (!ep.endHookId) issues.push({ level: 'error', at: en ? `End of episode ${ep.episode}` : `第${ep.episode}集集尾`, msg: en ? 'Missing the episode-end cliff' : '缺少集尾卡点', fix: en ? 'Cut at the emotional/danger/reveal peak to leave a hook' : '在情绪/危机/揭秘峰值处切断留钩' });
    if (ep.endHookId && ep.endHookId === prevEnd) issues.push({ level: 'warning', at: en ? `End of episode ${ep.episode}` : `第${ep.episode}集集尾`, msg: en ? 'The same end-hook type two episodes running — fatigue risk' : '连续两集集尾钩子同型，易疲劳', fix: en ? 'Rotate danger/reveal/reversal/emotion cut-offs' : '轮换危机/揭秘/反转/情感断点' });
    prevEnd = ep.endHookId;
    let blankScenes = 0;
    ep.scenes.forEach((sc) => {
      if (!sc.endHookId && sc.microHookIds.length === 0) { blankScenes++; if (blankScenes >= 2) issues.push({ level: 'warning', at: en ? `Episode ${ep.episode}, scene ${sc.scene}` : `第${ep.episode}集第${sc.scene}场`, msg: en ? 'Consecutive scenes with no hook at all — rhythm may sag' : '连续场次无任何钩子，节奏可能塌陷', fix: en ? 'Add an end-of-scene pull or a sentence-level micro hook' : '补场末牵引或句子级微钩' }); }
      else blankScenes = 0;
      sc.microHookIds.forEach((id) => {
        if (microSeq[microSeq.length - 1] === id) issues.push({ level: 'warning', at: en ? `Episode ${ep.episode}, scene ${sc.scene}` : `第${ep.episode}集第${sc.scene}场`, msg: en ? `Micro hook “${hookName(id, 'en')}” used back-to-back` : `微钩「${HOOK_BY_ID.get(id)?.name}」紧邻连用`, fix: en ? 'Switch to another micro-hook type to keep it fresh' : '换一种微钩类型，保持新鲜感' });
        microSeq.push(id);
        if (id === 'micro_foreshadow') hasForeshadow = true;
      });
    });
  });
  if (hasForeshadow && !paidOffForeshadow) issues.push({ level: 'error', at: en ? 'Whole series' : '全剧', msg: en ? 'A foreshadow hook is planted but not marked as paid off' : '埋了伏笔钩子但未标记兑现(payoff)', fix: en ? 'Arrange a payoff later; never dig a hole and leave it' : '在后段安排对应回收，避免挖坑不填' });
  return issues;
}

export function hookName(id: string, lang: HookLang = 'zh'): string { const h = HOOK_BY_ID.get(id); if (!h) return id; return lang === 'en' ? (HOOK_EN[id]?.name ?? h.name) : h.name; }
export function hooksByLayer(layer: HookLayer, lang: HookLang = 'zh'): HookType[] { return ALL_HOOKS.filter((h) => h.layer === layer).map((h) => localizeHook(h, lang)); }
