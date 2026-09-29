/**
 * narrative-craft.ts —— 叙事工艺深化引擎（2026-09，累计113条视频沉淀：首批81条 + v1.70新增32条）
 *
 * v1.70 新增32条视频的去重边界（不重复、不相悖，只收真增量）：
 *  - 真新增14张方法卡：怕贪坑三驱动/自我欺骗/危险吸引(间歇强化)/配角偷窃；能量负债(节奏=能量账,吸收掐瘾控牌管呼吸)/
 *    甲方加码/细节取信(骗术细节)/冲突解剖(叙事法医)/悬疑三步(喂食饲养掀桌=钩子饲料枪响)/亵渎创想(截缝反,接反套路引擎)/
 *    开篇三器(断头台饥饿兽梨花针)/画面三招(跳帧镜头埋套)；情感戏三刀；日常造恶(饭桌反派)。
 *  - 判定为重复、只做别名/要点合并、不新增卡片：三线叙事(死线/补给线/鬼线=饵/药引/配方)、打斗狠快透(并入打斗呼吸)、
 *    恐怖邪修升级(并入恐怖三招)、缺陷深渊/弱点是天赋另一张脸(=旧伤即武器/人性褶皱)、好人成本付不起(=顶级黑化)、
 *    弱点认领(=双强)、停不下来4毒招/暗格/陷阱伏笔(=钩子体系+伪装伏笔)、对话癌闭嘴(=情绪标签尺子+拆滤镜)、
 *    认知骇客(=三层反转+不可靠叙述)、世界观是神还是垃圾(=世界观四层)、抢劫画线生长(元方法非剧本工艺，不收)。
 *  - 新增第6把可执行尺子 despairTellLint（崩溃/绝望直给检测，曹雪芹式克制），其余难稳定识别的理念只进卡片不硬扣分。
 *
 * 本轮知识点与既有引擎的去重边界（不重复、不相悖）：
 *  - archetype-craft 管“选什么主角/反派/系统原型、张力与开篇硬伤”；
 *  - webnovel-craft 管断章点/金手指代价/以选择立人/情绪债等结构尺子；
 *  - emotion-craft 管爽点链路与情绪上限；
 *  - 本文件专管四件它们没覆盖的事：
 *    A. 钩子分类体系（导演提出的场/集/动作/氛围/语言钩 + 信息差/倒计时/反常识/连环钩，支持系统默认与用户自选）；
 *    B. 电影级“展示非讲述”文笔（拆滤镜戒感官动词、删情绪标签“说”、因果链替代“然后”流水账）；
 *    C. 人物内驱/缺陷/弧光、代价两难/亏欠、反转叙事/不可靠叙述/三线叙事等“创作方法论卡片”（供选题会/大纲/人设注入，纯理念不做硬扣分）；
 *    D. 分类型工具箱（喜剧四层/恐怖三招/打斗呼吸/小人物切片/世界观四层/悲剧三层/黑化/反派破局）。
 *  仍恪守“只收文本可稳定识别、建议可执行”的原则：文笔层落 5 把保守 P2 尺子；
 *  跨集弧线、叙事视角、两难深度这类难从单文本判定的，只进创作建议库，不做易误报的硬扣分。
 */
import { LintIssue, LintLang } from './craft-lint';

const has = (t: string, ws: string[]) => ws.filter((w) => t.includes(w));
const count = (t: string, ws: string[]) => ws.reduce((n, w) => n + (t.split(w).length - 1), 0);

/* =====================================================================
 * A. 钩子分类体系（场/集/动作/氛围/语言/信息差/倒计时/反常识/隐忍卖惨/连环）
 *    对应“钩子不是僵硬办法，要给用户选项 + 系统默认”的要求：系统默认按题材推荐组合，用户可自选。
 * =================================================================== */
export interface HookType {
  id: string; name: string; layer: string; definition: string; example: string; how: string; fit: string[];
}
export const HOOK_TAXONOMY: HookType[] = [
  { id: 'episode_hook', name: '集钩（蔡加尼克断章）', layer: '集尾', definition: '不在高潮句号上收尾，停在高潮将至未至或新反转刚露头的一瞬，制造未完成焦虑。', example: '他打开宝箱，里面没有宝剑，只有一面镜子，镜中是死去十年的师傅正冲他诡笑——本章完。', how: '把一件事说一半；结尾停在问号/惊叹号，别让主角安心睡去。', fit: ['全部'] },
  { id: 'scene_hook', name: '场钩（每场3秒入戏）', layer: '场次开头', definition: '每场开头不铺环境流水账，3秒内抛出冲突、异常或悬而未决的动作。', example: '不写“阳光刺眼他醒来”，写“他醒来时，刀尖正抵着喉咙。”', how: '删掉天气/起床/路上的无效开场，直接让麻烦压到人物身上。', fit: ['全部'] },
  { id: 'action_hook', name: '动作钩（反常动作开场）', layer: '开篇/转场', definition: '用一个具体、反常、正在进行的动作抓人，而非形容词与背景。', example: '天生废柴的他，每天坚持给同桌下毒。', how: '先给一个违背常识的动作，再让读者追问“为什么”。', fit: ['逆袭', '悬疑', '都市', '爽文'] },
  { id: 'atmosphere_hook', name: '氛围钩（桌下炸弹）', layer: '场景内部', definition: '希区柯克炸弹：让读者先知道危险在逼近，人物却还在照常生活，用氛围压迫攥心。', example: '读者已知酒里有毒，主角却笑着端起酒杯与反派称兄道弟。', how: '先给读者开上帝视角暴露危机，再让人物一步步靠近，中间用细节拖延。', fit: ['悬疑', '惊悚', '权谋', '犯罪'] },
  { id: 'dialogue_hook', name: '语言钩（倒刺台词）', layer: '台词', definition: '用一句答非所问、暗藏机锋或自相矛盾的台词制造问号。', example: '“我决定去死——但我得先弄清，昨晚给我送伞的人为什么用着亡妻同款香水。”', how: '第一句抛结论，第二句不解释原因、直接抛一根“倒刺”。', fit: ['情感', '悬疑', '都市', '女性向'] },
  { id: 'infogap_hook', name: '信息差炸弹钩', layer: '跨集结构', definition: '让读者比主角多知道一张底牌，读者追的不是“会发生什么”而是“他什么时候发现”。', example: '读者早知道管家是卧底，主角却把后背一次次交给他。', how: '一张主角没有的底牌 + 一次次差一点暴露 + 真相在最不该时揭开且回不去。', fit: ['悬疑', '谍战', '权谋', '卧底', '复仇'] },
  { id: 'countdown_hook', name: '倒计时钩（具象死亡线）', layer: '跨集结构', definition: '人类对倒计时无抵抗力；用具象载体（非钟表）呈现不断逼近的死线。', example: '距世界毁灭还有3小时，唯一知道真相的他正被全校通缉。', how: '死线要具象可视、不断被提醒，且与人物选择绑定。', fit: ['灾难', '悬疑', '求生', '职场', '爽文'] },
  { id: 'anticommon_hook', name: '反常识钩（认知颠覆）', layer: '开篇第一句', definition: '第一句就推翻读者常识：“你以为的X，其实是Y”，撬动认知基石。', example: '物理学不存在了。', how: '摘取全剧最诡异/最颠覆的一个结果或判断放在第一段，不解释为何如此。', fit: ['科幻', '悬疑', '奇幻', '脑洞'] },
  { id: 'endure_sell_hook', name: '隐忍卖惨钩（惨得有尊严）', layer: '开篇', definition: '被羞辱不哭不闹，面无表情咽下，心里记下倒计时复仇，比当场开挂高级。', example: '他咽下所有屈辱，只在心里说：还有二十七天，你们就该跪了。', how: '当众剥夺要够真，反弹要延后；给隐忍一个明确的兑付期限。', fit: ['复仇', '逆袭', '赘婿', '战神', '大女主'] },
  { id: 'chain_hook', name: '连环钩（第一句闪电第二句雷声）', layer: '开篇前两句', definition: '第一句抓住人后，第二句必须立刻再锁一次：感官钉死、倒刺问题或视角爆破，禁止第二句转去铺垫。', example: '血从天花板渗下来——正落进他面前的咖啡杯，洇开一圈暗红。', how: '视觉转听觉/宏观缩微观/结论后跟倒刺，两句之内不给读者划走的空隙。', fit: ['全部'] },
];

const matchByFit = <T extends { fit: string[] }>(lib: T[], text: string, enFit?: (x: T) => string[]): T[] => {
  const t = text || '';
  const scored = lib
    .map((x) => {
      const keys = enFit ? enFit(x) : x.fit;
      return { x, n: keys.reduce((s, k) => s + (k === '全部' || k === 'all' ? 1 : (t.includes(k) ? 1 : 0)), 0) };
    })
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);
  return scored.map((s) => s.x);
};

/** v1.94 钩子英文层（id 键控）：英文名 + 用法 + 英文匹配词 */
export const HOOK_EN: Record<string, { name: string; how: string; fit: string[] }> = {
  episode_hook: { name: 'Episode hook (Zeigarnik cliff)', how: 'Say a thing halfway; end on a question/exclamation, never let the lead rest easy.', fit: ['all'] },
  scene_hook: { name: 'Scene hook (in-scene in 3s)', how: 'Cut weather/waking/commute openings; press trouble onto the character at once.', fit: ['all'] },
  action_hook: { name: 'Action hook (abnormal action)', how: 'Open with one concrete, abnormal, ongoing action before any adjective or backstory.', fit: ['underdog', 'suspense', 'urban', 'power fantasy'] },
  atmosphere_hook: { name: 'Atmosphere hook (bomb under the table)', how: 'Give the reader god-view of the approaching danger while the character lives on; delay with detail.', fit: ['suspense', 'thriller', 'intrigue', 'crime'] },
  dialogue_hook: { name: 'Dialogue hook (barbed line)', how: 'State a conclusion first, then throw a barb instead of explaining why.', fit: ['romance', 'suspense', 'urban', 'female'] },
  infogap_hook: { name: 'Information-gap bomb', how: 'One hole card the lead lacks, near-miss exposures, truth revealed at the worst moment.', fit: ['suspense', 'spy', 'intrigue', 'undercover', 'revenge'] },
  countdown_hook: { name: 'Countdown hook (concrete deadline)', how: 'Make the deadline visible, repeatedly reminded, and bound to the lead’s choice.', fit: ['disaster', 'suspense', 'survival', 'workplace', 'power fantasy'] },
  anticommon_hook: { name: 'Anti-common-sense hook', how: 'Put the most uncanny verdict in the first paragraph without explaining.', fit: ['sci-fi', 'suspense', 'fantasy', 'brain hole'] },
  endure_sell_hook: { name: 'Endure-with-dignity hook', how: 'Make the public deprivation real, delay the rebound, give endurance a clear due date.', fit: ['revenge', 'underdog', 'son-in-law', 'war god', 'strong female'] },
  chain_hook: { name: 'Chain hook (line-1 lightning, line-2 thunder)', how: 'Visual→auditory, macro→micro, or conclusion→barb; no gap to swipe away within two lines.', fit: ['all'] },
};
/** 系统默认钩子组合：任何题材都保底给集钩/场钩/连环钩，再按题材补专属钩；用户也可自行增删（前端做选项）。v1.94 支持英文匹配 */
export function recommendHooks(input: { text?: string; tags?: string[] }, lang: 'zh' | 'en' = 'zh'): HookType[] {
  const en = lang === 'en';
  const rawText = `${input.text || ''} ${(input.tags || []).join(' ')}`;
  const text = en ? rawText.toLowerCase() : rawText;
  const base = ['episode_hook', 'scene_hook', 'chain_hook'].map((id) => HOOK_TAXONOMY.find((h) => h.id === id)!);
  const rest = HOOK_TAXONOMY.filter((h) => !base.includes(h));
  const extra = en ? matchByFit(rest, text, (h) => HOOK_EN[h.id]?.fit || []) : matchByFit(rest, text);
  const seen = new Set<string>();
  return [...base, ...extra].filter((h) => !seen.has(h.id) && seen.add(h.id));
}

/** 开篇钩子审计：识别前300字已经用了哪些钩、缺哪些关键钩（系统自动体检，结果可转成优化建议） */
export function openingHookAudit(opening: string): { used: string[]; missing: HookType[]; advice: string } {
  const head = (opening || '').slice(0, 300);
  const used: string[] = [];
  if (/却|竟然|居然|偏偏|看似.*其实|实际上|根本不是/.test(head)) used.push('anticommon_hook');
  if (/倒计时|还有\s*\d+\s*(小时|天|分钟|秒)|距离.*只剩|\d+\s*(小时|天)后|24小时|三天后/.test(head)) used.push('countdown_hook');
  if (/刀|血|死|跪|逼|逃|追|撞|掐|枪|毒|火|坠|掐住|抵着/.test(head)) used.push('action_hook');
  if (/？|\?|谁|什么|为什么|到底|为何/.test(head)) used.push('dialogue_hook');
  if (/忍|咽下|记下|迟早|总有一天|跪着|羞辱|笑了笑.*没|二十七天|等着/.test(head)) used.push('endure_sell_hook');
  const crisisLike = used.length;
  const missing = crisisLike
    ? []
    : [HOOK_TAXONOMY.find((h) => h.id === 'action_hook')!, HOOK_TAXONOMY.find((h) => h.id === 'anticommon_hook')!];
  const advice = crisisLike
    ? `开篇已含钩子：${used.join('、')}。注意第二句必须是“雷声”而非背景铺垫，前300字内把人物扔进具体麻烦。`
    : '开篇前300字未见明确钩子（无反常动作/危机/倒计时/问号）。建议三选一立即破局：①一个反常动作开场；②第一句推翻常识；③面无表情隐忍并埋下复仇倒计时。删掉天气、起床、世界观铺陈。';
  return { used, missing, advice };
}

/* =====================================================================
 * B. 创作方法论卡片库（选题会/大纲/人设/分类型工具箱注入；纯理念，不做硬扣分）
 * =================================================================== */
export interface CraftCard { id: string; title: string; formula: string; steps: string[]; fit: string[] }

/* B1. 人物内驱 / 缺陷 / 弧光（8张） */
export const CHARACTER_DEPTH_CARDS: CraftCard[] = [
  { id: 'want_need', title: '内驱天平（want×need）', formula: '用表层“想要”掩盖灵魂“需要”，高潮把两者放天平两端逼他亲手打碎want。', steps: ['want是推剧情的外部目标（复仇/天下第一/赚钱），need是灵魂残缺（被爱/放下/与平凡和解）', '一路用want掩盖need，不在前期说教点破', '最高潮让他为need放弃want（自废武功救爱人），弧光在“亲手打碎”瞬间拉满'], fit: ['全部'] },
  { id: 'shameful_secret', title: '丢人的秘密（反差钉）', formula: '社会形象 × 完全相反的隐秘，最糟时刻被当众逼到暴露边缘。', steps: ['秘密必须与外在形象相反（冷酷剑神怕黑、算无遗策的谋士不识字）', '不安排主动坦白，写他在万众瞩目下被敌人当场揭穿或险些揭穿', '让秘密真正影响剧情（怕黑却为救人第一次走进黑洞）'], fit: ['全部'] },
  { id: 'human_crease', title: '人性褶皱（去圣人化）', formula: '完美让人仰望，瑕疵让人代入；先有不光彩的本能反应，再坚定选择正义。', steps: ['听到呼救第一反应是逃，跑两步停下、骂句脏话再转身冲进去', '给他一个改不掉的小缺点当辨识度（贪小便宜/怕死/嘴硬）', '允许他带着问题活下去（原谅了但仍做噩梦），不写顿悟后通体澄澈'], fit: ['全部'] },
  { id: 'old_wound', title: '旧伤即武器', formula: '一个永远好不了的心理旧伤，既是弱点也是翻盘武器，最辉煌时让它疼一下。', steps: ['旧伤是心理的（被抛弃所以怕被丢下），不用反复提、只在关键决策时冒头', '让伤长出能力（总被欺负所以极能忍耐，熬死所有对手）', '登顶/受封的高光时刻用一个生理细节让旧伤抽痛一下（敬酒的手在抖）'], fit: ['全部'] },
  { id: 'inner_contrast', title: '内外对立（外在标签×内在真相）', formula: '外在与内在必须相反，平时伪装，关键时刻内在战胜外在，且对立到结局都不消失。', steps: ['外在：霸道/毒舌/冷漠；内在：自卑/温柔/恐惧，二者同时为真', '生死利益关头让内在压过外在（贪财者把钱全扔了救人）', '不要结尾克服缺点变完美——带着矛盾活下去才真实'], fit: ['全部'] },
  { id: 'mirror_foil', title: '镜像人物（优缺点长在一起）', formula: '正派与反派是同一内核的两种极端活法；优点本身就是致命弱点。', steps: ['一个特质既是盔甲也是软肋（重情→能为兄弟死，也注定孤独）', '把好坏审判交给读者：逼人物到两难、选一条路然后后悔一辈子', '让反派成为主角“走错一步会成为的人”，互为镜像才立得住'], fit: ['双雄', '权谋', '犯罪', '群像'] },
  { id: 'coward_first', title: '先怂后刚（代入感）', formula: '标签让读者认识主角，反应让读者成为主角。', steps: ['被欺负第一反应想跑/想躲（完了今天要破相），下一秒才咬牙还手', '给一个小而具体、甚至有点俗的普通人执念（攒钱给妹妹换轮椅，而非拯救苍生）', '决策时补一句内心弹幕（我是不是有病，她又不喜欢我）'], fit: ['全部'] },
  { id: 'arc_four', title: '弧光四层（炸承重墙）', formula: '装修级变强不算弧光；认知崩塌→道德负重→情感自爱→命运和解，锚点-风暴-抉择-新生。', steps: ['锚点：开局给一个坚定初始信念（力量就是一切）', '风暴：用连续失去/背叛/真相攻击这个信念，逼他怀疑挣扎', '抉择-新生：在两个互斥价值间选一个并付出最高代价，成为新人或走向毁灭'], fit: ['全部'] },
  { id: 'fear_greed_kill', title: '怕·贪·坑三驱动', formula: '写活一个人就三点：他最怕什么、最贪什么、最后是什么坑死他；三力交汇人物自动行动。', steps: ['怕：一个具体的恐惧（怕回到穷日子/怕被看穿出身），不是抽象的“害怕失败”', '贪：一个驱动他越界的渴望（贪那口被人看得起的气）', '坑：让“怕”和“贪”在同一事件里对撞，他亲手选的路最后坑死或成全他，性格即命运'], fit: ['全部'] },
  { id: 'self_deception', title: '自我欺骗（防御性动机）', formula: '工具人是“作者让他做”，活人是“他骗自己这么做”；给行为安个冠冕堂皇的借口，底下是不敢承认的私欲。', steps: ['人物每做关键决定，先写他对自己说的合理化台词（我都是为了这个家）', '让读者透过细节看见借口之下的真实动机（他真正受不了的是自己不再是中心）', '高潮逼他无法再骗自己，自我欺骗崩塌的一刻就是弧光或毁灭的一刻'], fit: ['全部', '现实', '家庭', '悲剧'] },
  { id: 'danger_pull', title: '危险吸引（间歇强化）', formula: '让人上头的不是一直好，是不可预测：在“给糖—抽走—再给一点”间间歇强化，副作用是明知危险却戒不掉。', steps: ['对主角/读者的奖惩要不规则间隔，杜绝每次付出都即时兑现', '先立危险或冷漠的既定印象，再在最没预期时漏一丝软、一次护短', '温柔给得越省越值钱；一旦变成稳定输出吸引力立刻归零，始终保留“他随时可能抽身”的不确定'], fit: ['言情', '虐恋', '霸总', '双强', '悬疑'] },
  { id: 'steal_scene', title: '配角偷窃（自带目标进场）', formula: '值钱的配角不为衬托主角而存在，他带着自己的目标进场并“偷”走一点戏；别让他只会“愣住”。', steps: ['每个有名有姓的配角进场前先给一个与主线无关的小目标（赶时间接孩子/藏自己的小算盘）', '让他按自己的逻辑而非主角需要反应，该打断就打断、该拆台就拆台', '给他一次为自己目标做出的意外动作并顺手改变主线，主角不在时世界也在运转'], fit: ['全部', '群像'] },
];

/* B2. 情节/叙事装置（9张） */
export const NARRATIVE_DEVICE_CARDS: CraftCard[] = [
  { id: 'causal_chain', title: '因果链（然后→所以）', formula: '情节不是时间流水而是锁链：每个事件是上一个的果、下一个的因。', steps: ['把“然后”全部改成“所以”：捡剑→封印激活→暴露行踪→仇家上门→被迫开战', '契诃夫之枪：第一幕出现的枪第三幕必须响；删掉某事件后剧情仍接得上=废话，删', '章与章用因果钉死：上一章结尾的“果”就是下一章的“因”'], fit: ['全部'] },
  { id: 'disguised_foreshadow', title: '伪装伏笔（日常藏雷）', formula: '最高级的伏笔读时像无关日常，回收时才知是必然。', steps: ['开篇就让读者闻到火药味（高潮前置），线索伪装成巧合/闲笔', '伏笔分散撒在前半程，反转是拼图最后一块而非天降神兵', '先给一个伪反转让读者自以为猜对，再在他最得意时掀桌'], fit: ['悬疑', '权谋', '复仇', '长篇'] },
  { id: 'triple_reversal', title: '三层反转（身份/目标/规则）', formula: '身份反转炸关系网，目标反转毁生存意义，规则反转颠覆整个世界；反转后必须回不去。', steps: ['身份反转让所有人重新站队（三角关系因一个“完美好人”暴露而全面崩盘）', '目标反转在达成巅峰证明其神圣目标恰是原罪（救世=格式化世界）', '规则反转揭示底层规则为假（世界是更高存在的实验/程序）；三层可连锁递进'], fit: ['悬疑', '科幻', '奇幻', '权谋'] },
  { id: 'unreliable_narrator', title: '不可靠叙述', formula: '用可靠的细节包装不可靠的核心；在事实/评价/感知任一层优雅地“欺骗”读者。', steps: ['定义叙述者的认知缺陷（信息缺失/价值扭曲/情感蒙蔽）', '事实自洽但结论错误（狂人日记：看病是真，“养肥了吃”是疯的判断却戳中真相）', '必须埋几粒渗着寒光的真实碎片当破绽，让读者自己拼出真相'], fit: ['悬疑', '心理', '第一人称', '文艺'] },
  { id: 'three_line', title: '三线叙事（饵/药引/配方，别名：死线/补给线/鬼线）', formula: '主线是带代价的“饵/死线”，支线是能给主线死局开生门的“药引/补给线”，暗线是藏世界底层规则的“配方/鬼线”，结尾合成而非解开。', steps: ['饵(死线)：目标要带“做不到就比死更难堪”的公开倒计时，而非空喊复仇', '药引(补给线)：每条支线只干一件事——拿到克boss之物/重定义战局的规则/能反手捅穿规则的盟友', '配方(鬼线)：只呈现不解释的世界异常（情绪激动时瞳孔闪过金光），结局三线化学反应合成更大真相'], fit: ['悬疑', '科幻', '权谋', '长篇'] },
  { id: 'leave_blank', title: '留白三法（写作即隐瞒）', formula: '给情绪不给解释、给结果不给过程、给选择不给答案。', steps: ['不写“他很后悔”，写输入“对不起”又删掉、锁屏把手机倒扣', '不写找了一整天，直接写傍晚他出现、手里多了张皱纸条', '停在岔路口不写选了哪边，下一场直接跳到三年后'], fit: ['全部'] },
  { id: 'cost_dilemma', title: '代价两难', formula: '两个都想要只能得一个，把余震刻进后半生，并让他第二次面对同样的局。', steps: ['得到的一切标好价码（神剑认主后旧武功全废），禁止无损获得', '两难是善善冲突/两害相权，不是对错题；选哪个都流血', '选择本身不值钱，选择后的余震（多年不敢进朋友家门）才值钱；结尾二次同局'], fit: ['全部'] },
  { id: 'debt_thorn', title: '亏欠扎根刺', formula: '读者忘不掉的不是完美是遗憾：差一点得到、没说完的话、等不到的约定、没人在意的小物件。', steps: ['让他差一步/差一句/差一秒，遗憾比圆满扎得深', '高潮留一句没说完的话（等打完这仗我……再没回来）', '一切结束后用一个小物件收束（翻出妹妹的破布娃娃，放上窗台）'], fit: ['情感', '虐恋', '群像', '文艺'] },
  { id: 'emotion_spring', title: '情绪弹簧（蓄-放-留白）', formula: '先做蓄水池压抑，再给意外阀门释放，最后情绪留白。', steps: ['先把主角压到谷底（被扫地出门、当众剥夺），压抑越深反弹越狠', '在读者快失去耐心时给一次超预期的意外释放（垃圾装备随手打爆职业选手）', '赢了不庆祝，用一句轻描淡写的话留白（“从头再来而已”，点一根烟）；奖励要不定期才成瘾'], fit: ['爽文', '逆袭', '竞技', '全部'] },
  { id: 'energy_debt', title: '能量负债（节奏=能量账）', formula: '故事节奏不是文字快慢，是“能量负债与湮灭”：先持续欠读者情绪债，再在精准点位一次性湮灭兑付。', steps: ['掐瘾：每场结束让读者手里攥着一笔没结清的情绪账（一个没回答的问题/没出的气）', '控牌：别一次性把底牌能量放光，按“欠一点—给一点—再欠更多”滚动叠加，负债总额只增不减直到高潮', '管呼吸：高能段后必须插一个低能量消化场（吃饭/沉默/日常），没有喘息就没有下一次拉升；湮灭要彻底，一次高潮把前面所有欠债同时结清'], fit: ['全部', '爽文', '悬疑', '长篇'] },
  { id: 'client_escalate', title: '甲方加码（需求-推翻循环）', formula: '像难缠甲方一样对待主角：刚满足一个要求立刻加码或推翻，让他越努力离安稳越远，读者一边心疼一边上头。', steps: ['主角达成一个小目标的同一刻，抛出一个更高/相反的新要求（拿到钱→发现钱是假的/要救的人不见了）', '每次加码都让此前的努力变成“必要但不充分”，禁止原地踏步式重复困难', '加码要踩在人物软肋上（最在乎什么就推翻什么），并让读者明确看见“退无可退”，虐得有逻辑而非为虐而虐'], fit: ['虐', '逆袭', '职场', '悬疑', '全部'] },
  { id: 'detail_con', title: '细节取信（骗术细节）', formula: '用高度具体、可核验、甚至带“无用信息”的细节骗取信任，读者一旦相信细节，就会相信你虚构的整体。', steps: ['关键设定处给一个精确到数字/品牌/动作的细节（药瓶标签卷边、第三颗纽扣崩掉），越无关功利越可信', '一个真实细节锚点能带过一处虚构（用真实的老街走法让虚构的店铺成立）', '细节必须服务叙事或情绪，不堆砌百科；悬疑里把关键线索伪装成这种“闲笔细节”，回收时威力最大'], fit: ['全部', '悬疑', '现实', '推理'] },
  { id: 'conflict_autopsy', title: '冲突解剖（叙事法医）', formula: '低级冲突是吵架打架，高级冲突像法医解剖：剖开立场→证据→判决三层，让冲突不可调和且无法回避。', steps: ['立场层：双方各自合理的诉求摆上桌（不是好人坏人，是两种都对的道理对撞）', '证据层：用具体事件/旧账/利益把矛盾坐实，让冲突无法靠一句解释化解', '判决层：逼主角当场做出有代价的选择并承担后果，每场冲突结束必须改变人物关系或力量对比，否则删'], fit: ['全部', '家庭', '职场', '权谋', '现实'] },
  { id: 'suspense_feed', title: '悬疑三步（喂食·饲养·掀桌）', formula: '先喂一个反常碎片勾住，再用更多半真半假的信息把疑心养肥，最后一次性掀桌翻盘（同“钩子-饲料-枪响”）。', steps: ['喂食：开篇尽早抛一个无法解释的异常细节，但不给答案', '饲养：每隔一段补一条指向不同结论的线索，让读者自己推理并不断推翻自己，疑心越养越大', '掀桌：在读者自以为拼齐真相时掀桌，真相反转前面所有线索却又全部对得上（公平推理，不空降）'], fit: ['悬疑', '推理', '惊悚', '犯罪'] },
  { id: 'blasphemy_ideate', title: '亵渎创想（截·缝·反）', formula: '灵感枯竭时的反套路三步：截取一个烂大街桥段→缝上一个不相干元素→反向操作，老梗立刻翻新。', steps: ['截：精准取出被用滥的套路（退婚流/重生复仇/霸总追妻），不回避它', '缝：强行嫁接一个异质元素（退婚现场+会计审计思维/霸总+社恐），错位产生新意', '反：把套路的关键一步反过来做（本该打脸的对象先帮了主角/重生者发现仇人也是重生的），反套路强度可按“经典稳妥→创新大胆”调节'], fit: ['全部', '喜剧', '脑洞', '反套路'] },
  { id: 'opening_three', title: '开篇三器（断头台·饥饿兽·梨花针）', formula: '开头三件武器：断头台=高悬的危机，饥饿兽=主角迫切的饥渴，梨花针=细密扎人的小冲突，三器齐下第一章立住。', steps: ['断头台：第一章就让读者看见一把迟早落下的刀（绝症诊断书/三天期限/已埋下的杀局）', '饥饿兽：给主角一个强烈到失态的当下饥渴（要这笔救命钱/要这个人正眼看他），驱动他立刻行动', '梨花针：用一连串细小摩擦（被插队、被挂断电话、鞋跟断掉）制造持续微痛，让读者代入感在细节里扎根'], fit: ['全部', '开篇', '逆袭', '现实'] },
  { id: 'visual_three', title: '画面三招（跳帧·镜头·埋套）', formula: '要画面感别堆形容词：跳帧剪切、镜头运动、把钩子埋进画面本身。', steps: ['跳帧：省略过程直切关键帧（不写走过去，直接“门被踹开时他正把存折塞进嘴里”）', '镜头：用推/拉/摇/特写的顺序写场景，先全景定危局、再猛推到一个特写细节钉住情绪', '埋套：让画面本身携带悬念（全家福里有一张脸被烟头烫掉），写景即写钩子，不靠旁白解释'], fit: ['全部', 'AIGC', '动作', '悬疑'] },
];

/* B3. 情感关系模型（4张） */
export const RELATIONSHIP_CARDS: CraftCard[] = [
  { id: 'fatal_pull', title: '宿命拉扯（非一见钟情）', formula: '明明不该爱却不得不爱：逃不开的对立相遇 × 克制不住的动心 × 在对方身上看见自己。', steps: ['在最不该的时间、最对立的立场被迫相遇（敌人/君臣有别/互为唯一同类）', '两人都清醒知道不能爱，却理智压不住本能，嘴上算计眼神心软', '不是彼此救赎而是镜子——全世界只有他看懂你的伤'], fit: ['虐恋', '古言', '双强', '宿命'] },
  { id: 'dual_strong', title: '双强（灵魂契合非能力对等）', formula: '我懂你的锋芒，也接住你的破碎。', steps: ['智谋势均：猎手猎物身份互换，不恋爱脑不降智', '心理势均：都满身防备，却是唯一懂对方强硬之下身不由己的人', '并肩对抗而非一方拯救，双向托底'], fit: ['双强', '职场', '权谋', '都市'] },
  { id: 'regret_second', title: '意难平女配（非恶毒女二）', formula: '耀眼底色 × 克制深情 × 体面退场，她输给的是自己的教养与底线。', steps: ['给她不输女主的才貌格局，只是晚一步或爱错时序', '再痛也笑着说没事，默默成全不歇斯底里', '最绝不是惨死，是还好好活着却永远失去，不纠缠不回头'], fit: ['女频', '群像', '虐恋'] },
  { id: 'iron_choice', title: '大女主困择模型', formula: '真困境（爱情美貌身份解不了）× 违背规训的真选择。', steps: ['困境必须是饥荒/国战/阶层真相，而非换个男人就能救的假麻烦', '选择野心而非爱情、选择冷酷而非“好女人”规训，承担众叛亲离', '清醒目标+杀伐手段+不动情软肋（痛到极致也不影响决策）'], fit: ['大女主', '女频', '复仇', '女强'] },
  { id: 'romance_scalpel', title: '情感戏三刀（生死墙·生理叛变·情绪蹦极）', formula: '感情戏不靠告白靠三刀：立一道跨不过的生死墙、让身体先于嘴叛变、把情绪反复拉到两极再松手。', steps: ['生死墙：给关系设一道客观上几乎无解的阻碍（身份死仇/时间不多/立场对立），越爱越不能爱', '生理叛变：嘴上拒绝，身体却诚实——下意识挡刀、记住他随口的忌口、人群里第一个找他，用动作代替情话', '情绪蹦极：一场戏内完成“靠近—误会推开—危险中再靠近”的两极拉扯，落差越大越上头；别让关系线性升温'], fit: ['言情', '虐恋', '双强', '古言', '都市情感'] },
];

/* B4. 分类型工具箱（8张，含用户点名的喜剧深挖 + 恐怖/打斗/小人物/世界观/悲剧/黑化/反派破局） */
export const GENRE_TOOLKIT_CARDS: CraftCard[] = [
  { id: 'comedy_ladder', title: '喜剧四层阶梯', formula: '低级靠段子，高级靠逻辑，封神靠人心。', steps: ['段子层：人设+核心特质+场景化口头禅（吕树嘴欠），忌老梗、一章超3梗、脱离人设的无效梗', '逻辑层：固定世界观规则 × 主角反常规但自洽的行为（现代商业思维在古代搞加盟）', '人设层：专属搞笑标签+极致反差+行为一致，出场不讲话也想笑', '内核层：搞笑外壳裹真实动机（嘴欠是掩饰孤独的保护壳），笑中带泪不强行煽情'], fit: ['喜剧', '搞笑', '轻松', '沙雕'] },
  { id: 'horror_tools', title: '恐怖三招（不写鬼脸·电影级邪修）', formula: '写“可能真的有”比写鬼脸吓人一百倍；恐怖感靠熟悉事物的微小错位逐级升温，最后才给实体。', steps: ['异常藏日常：想倒水发现杯子是满的（明明喝完了）', '声音代画面：顶楼住户听到楼上凌晨弹珠声，让读者自己脑补', '自己吓自己：镜上“救命”是他自己写的却完全不记得；邪修升级走“不对劲→确认异常→规则失效→无处可逃”四级，越往后越慢、越静、越省字，把鬼脸/实体留到最后一击，前面全用日常错位堆压'], fit: ['恐怖', '惊悚', '悬疑'] },
  { id: 'fight_pacing', title: '打斗呼吸感（老虎与熊·狠快透）', formula: '好节奏不是一直快，是快慢之间的呼吸；不堆招式，写博弈、代价与情绪。单场打斗狠、快、透：下手狠（见血见代价）、切换快（不拖连招）、信息透（每场打完改变局势）。', steps: ['连续动作里插静止特写（出拳瞬间看见对手眼里的恐惧，闪回三年前）', '用感官拖延时间（风把嘴吹干、嗓子铁锈味、离终点三步两步一步）', '招式写实不悬浮（一拳砸在肋骨、自己指节震麻），有来有回先示弱再反制，战后必须留一段空白消化；删掉不改变胜负/关系/信息的无效过招'], fit: ['打斗', '动作', '武侠', '战争', '竞技'] },
  { id: 'everyman_slice', title: '小人物切片法（孔乙己心法）', formula: '用场景切片替代生平，用动词名词替代形容词，把个人悲剧升为环境吃人。', steps: ['只拍命运关键帧（站着喝酒/分豆/被打断腿后用手走来），不写履历流水账', '一个动词写尽命运（“排”出九文大钱的短暂尊严→“摸”出四文的落魄）', '对手不是某个恶人，而是哄笑的看客与整套结构，悲剧才有超越故事的力量'], fit: ['小人物', '现实', '文艺', '年代'] },
  { id: 'worldview_build', title: '世界观四层自洽', formula: '规则定边界、利益定冲突、文化定气质、漏洞定剧情；设定是发动机不是装饰画。', steps: ['规则天花板：写死力量上限/阶级边界/生死逻辑三条铁律，世界越自洽越高级', '利益链条：谁掌权谁赚钱谁卖命，人物被利益推着自动行动', '文化道德底色+隐秘漏洞：礼仪信仰决定行为理性，留一个制度bug/历史禁忌当引爆点；设定揉碎进动作对话，超200字纯设定就拆'], fit: ['奇幻', '仙侠', '科幻', '架空', '世界观'] },
  { id: 'tragedy_three', title: '悲剧三层', formula: '坏人之恶→命运之笼→系统之困，最高级是人人有理由、无人是凶手。', steps: ['第一层找具体凶手；第二层对抗天意多为徒劳', '第三层共犯结构：每个人在其位谋其责，却合力织成无人逃脱的网（“为你好”的爱成最锋利的刀）', '写“不得不”而非“不应该”，结尾留一扇打不开的窗，系统依然如故甚至新轮回已开始'], fit: ['悲剧', '现实', '群像', '文艺'] },
  { id: 'darkening', title: '顶级黑化三步', formula: '黑化不是好人变坏人，是从相信世界变成只相信自己。', steps: ['先给他拼命想守护却最终失去的人或信仰（黑化燃料是守护失败的绝望，不是被欺负）', '让他亲手发现旧信仰是谎言并亲手摧毁曾经的自己（转折是看穿谎言而非被伤害）', '在废墟上建立一套更冷更狠但自洽、且是唯一能保护剩余之物的新规则'], fit: ['黑化', '复仇', '反派男主', '虐'] },
  { id: 'villain_break', title: '高智商反派与破局链', formula: '反派不靠智商数值靠“制定规则”；主角破局=破信息→破逻辑→破信仰。', steps: ['反派三层架构：独特认知处理器+精准人性模拟（创造需求而非PUA）+自洽闭环逻辑，驱动力是重构秩序而非纯恶', '破信息局：把他最骄傲的优势变成唯一盲区，让他看错世界', '破逻辑局加入他算不到的变量（时间/人性/他瞧不起的小人物）；破信仰局用他自己的逻辑逼他看见信仰深渊，无需挥拳'], fit: ['权谋', '智斗', '商战', '悬疑', '反派'] },
  { id: 'banal_villain', title: '日常造恶（饭桌反派）', formula: '最有代入感的中国式反派不在悬崖而在客厅饭桌：用最家常的场景、最“为你好”的话术行控制之实，恶在习以为常里。', steps: ['把压迫放进吃饭/夹菜/递水等日常仪式，用关心的句式下达控制令（多吃点，那个工作我已经帮你辞了）', '反派真心觉得自己没错，甚至带着牺牲感，他的逻辑在家族语境里自洽，才让人脊背发凉', '冲突不靠吼叫靠绵里藏针：一句轻描淡写的话完成资源分配/尊严剥夺，写餐桌座次、谁先动筷、谁没资格说话来显权力'], fit: ['家庭', '现实', '年代', '婆媳', '中国式关系', '反派'] },
];

const ALL_CRAFT_CARDS: CraftCard[] = [...CHARACTER_DEPTH_CARDS, ...NARRATIVE_DEVICE_CARDS, ...RELATIONSHIP_CARDS, ...GENRE_TOOLKIT_CARDS];

/** v1.94 方法论卡片英文层（id 键控，中文卡片为单一事实来源）：英文标题/公式/英文匹配词 */
export const CARD_EN: Record<string, { title: string; formula: string; fit: string[] }> = {
  want_need: { title: 'Want × Need balance', formula: 'Surface want masks the soul’s need; the climax forces the lead to shatter the want for the need.', fit: ['all'] },
  shameful_secret: { title: 'Embarrassing secret (contrast nail)', formula: 'Public image × opposite secret, pushed to exposure at the worst moment.', fit: ['all'] },
  human_crease: { title: 'Human crease (de-saint)', formula: 'Perfection earns awe, flaws earn identification; an unflattering instinct before choosing right.', fit: ['all'] },
  old_wound: { title: 'Old wound as weapon', formula: 'A wound that never heals is both weakness and comeback weapon; let it ache at the peak.', fit: ['all'] },
  inner_contrast: { title: 'Inner-outer contrast', formula: 'Outer label × inner truth; the inner wins at the stake and the contradiction survives to the end.', fit: ['all'] },
  mirror_foil: { title: 'Mirror foil', formula: 'Hero and villain are two extremes of one core; a virtue is also the fatal soft spot.', fit: ['dual leads', 'intrigue', 'crime', 'ensemble'] },
  coward_first: { title: 'Flinch first, then stand', formula: 'Labels introduce the lead; reactions let the viewer become the lead.', fit: ['all'] },
  arc_four: { title: 'Four-layer arc (blow the load-bearing wall)', formula: 'Anchor belief → storm → costly choice → rebirth; cosmetic power-up is not an arc.', fit: ['all'] },
  fear_greed_kill: { title: 'Fear · Greed · Kill drivers', formula: 'What they fear most, crave most, and what finally destroys them — three forces collide and the character moves itself.', fit: ['all'] },
  self_deception: { title: 'Self-deception (defensive motive)', formula: 'Puppets act because the author says so; real people lie to themselves first.', fit: ['all', 'realistic', 'family', 'tragedy'] },
  danger_pull: { title: 'Dangerous pull (intermittent reinforcement)', formula: 'Addiction comes from unpredictability: give sugar, take it away, give a little — irregularly.', fit: ['romance', 'angst', 'ceo', 'dual strong', 'suspense'] },
  steal_scene: { title: 'Supporting-character scene theft', formula: 'Valuable side characters enter with their own goal and steal a beat; they never just “freeze”.', fit: ['all', 'ensemble'] },
  causal_chain: { title: 'Causal chain (then → therefore)', formula: 'Plot is a chain, not a timeline: each event is the prior fruit and the next seed.', fit: ['all'] },
  disguised_foreshadow: { title: 'Disguised foreshadowing', formula: 'The finest setup reads as idle daily life on first pass and as inevitability on payoff.', fit: ['suspense', 'intrigue', 'revenge', 'long form'] },
  triple_reversal: { title: 'Triple reversal (identity/goal/rule)', formula: 'Identity reversal wrecks relationships, goal reversal voids meaning, rule reversal overturns the world; no way back after.', fit: ['suspense', 'sci-fi', 'fantasy', 'intrigue'] },
  unreliable_narrator: { title: 'Unreliable narrator', formula: 'Wrap an unreliable core in reliable detail; deceive elegantly on fact/judgment/perception.', fit: ['suspense', 'psychological', 'first person', 'literary'] },
  three_line: { title: 'Three-line narrative (bait/catalyst/formula)', formula: 'Main line carries a costly deadline, sub-line supplies the way out, hidden line encodes the world’s rules; they synthesize at the end.', fit: ['suspense', 'sci-fi', 'intrigue', 'long form'] },
  leave_blank: { title: 'Three ways to leave blank', formula: 'Give emotion not explanation, result not process, choice not answer.', fit: ['all'] },
  cost_dilemma: { title: 'Costly dilemma', formula: 'Want both, keep one; carve the aftershock into the rest of the life, then face the same trap again.', fit: ['all'] },
  debt_thorn: { title: 'Debt thorn (the unfinished)', formula: 'Readers remember imperfection over perfection: almost-got, unsaid words, missed promises, a small object.', fit: ['romance', 'angst', 'ensemble', 'literary'] },
  emotion_spring: { title: 'Emotion spring (store-release-blank)', formula: 'First dam the emotion, then an unexpected valve releases it, then leave blank.', fit: ['power fantasy', 'underdog', 'competition', 'all'] },
  energy_debt: { title: 'Energy debt (rhythm = energy ledger)', formula: 'Keep owing the reader emotional debt, then annihilate it all at precise points; no breathing room means no next lift.', fit: ['all', 'power fantasy', 'suspense', 'long form'] },
  client_escalate: { title: 'Client escalation (demand-overturn loop)', formula: 'Treat the lead like a difficult client: satisfy one demand then raise or reverse it at once.', fit: ['angst', 'underdog', 'workplace', 'suspense', 'all'] },
  detail_con: { title: 'Detail trust (con-artist detail)', formula: 'Highly specific, verifiable, even “useless” detail buys belief in the whole fiction.', fit: ['all', 'suspense', 'realistic', 'mystery'] },
  conflict_autopsy: { title: 'Conflict autopsy (narrative forensics)', formula: 'Low conflict is arguing; high conflict dissects stance → evidence → verdict, irreconcilable and unavoidable.', fit: ['all', 'family', 'workplace', 'intrigue', 'realistic'] },
  suspense_feed: { title: 'Suspense in three steps (feed-raise-flip)', formula: 'Feed an odd fragment, fatten suspicion with half-truths, flip the table when the reader thinks it’s solved.', fit: ['suspense', 'mystery', 'thriller', 'crime'] },
  blasphemy_ideate: { title: 'Blasphemous ideation (cut-sew-reverse)', formula: 'Cut a worn trope, sew on an unrelated element, reverse its key step to refresh it.', fit: ['all', 'comedy', 'brain hole', 'anti-trope'] },
  opening_three: { title: 'Three opening weapons', formula: 'Guillotine (looming crisis) + hungry beast (urgent craving) + needle rain (fine friction) lock episode 1.', fit: ['all', 'opening', 'underdog', 'realistic'] },
  visual_three: { title: 'Three visual moves (jump-cut/camera/embed)', formula: 'Skip process to key frames; move camera wide-to-closeup; embed the hook inside the image itself.', fit: ['all', 'aigc', 'action', 'suspense'] },
  fatal_pull: { title: 'Fatal pull (not love at first sight)', formula: 'Shouldn’t love but can’t help it: forced encounter across opposing lines × unstoppable pull × seeing oneself in the other.', fit: ['angst', 'period romance', 'dual strong', 'destiny'] },
  dual_strong: { title: 'Dual strong (soul match, not equal power)', formula: 'I understand your edge and catch your broken pieces; matched wits and matched psychology.', fit: ['dual strong', 'workplace', 'intrigue', 'urban'] },
  regret_second: { title: 'Regretful second female lead (not a villainess)', formula: 'Brilliant base × restrained devotion × graceful exit; she loses to her own breeding and bottom line.', fit: ['female', 'ensemble', 'angst'] },
  iron_choice: { title: 'Iron-queen dilemma model', formula: 'A real trouble no romance/beauty/status can solve × a choice that defies the rules.', fit: ['strong female', 'female', 'revenge', 'female empowerment'] },
  romance_scalpel: { title: 'Three cuts of romance', formula: 'A life-or-death wall + the body betraying before the mouth + an emotional bungee between two poles.', fit: ['romance', 'angst', 'dual strong', 'period romance', 'urban romance'] },
  comedy_ladder: { title: 'Four-rung comedy ladder', formula: 'Low comedy runs on gags, high on logic, legendary on the human heart.', fit: ['comedy', 'funny', 'light', 'silly'] },
  horror_tools: { title: 'Three horror moves (no ghost face)', formula: '“It might really be there” is a hundred times scarier than a monster; escalate through tiny misplacements of the familiar.', fit: ['horror', 'thriller', 'suspense'] },
  fight_pacing: { title: 'Fight breathing (fierce-fast-clear)', formula: 'Good rhythm is the breath between fast and slow; insert still close-ups and sensory delay inside action.', fit: ['fight', 'action', 'wuxia', 'war', 'competition'] },
  everyman_slice: { title: 'Everyman slice (Kong Yiji method)', formula: 'Replace biography with scene slices, adjectives with verbs/nouns, lift personal tragedy into a system that eats people.', fit: ['nobody', 'realistic', 'literary', 'period'] },
  worldview_build: { title: 'Four-layer self-consistent worldview', formula: 'Rules set borders, interests set conflict, culture sets tone, loopholes set plot.', fit: ['fantasy', 'xianxia', 'sci-fi', 'alternate world', 'worldview'] },
  tragedy_three: { title: 'Three layers of tragedy', formula: 'A villain’s evil → fate’s cage → the system’s trap; the highest is everyone has a reason and nobody is the killer.', fit: ['tragedy', 'realistic', 'ensemble', 'literary'] },
  darkening: { title: 'Three-step top-tier dark turn', formula: 'Darkening isn’t good-to-bad; it’s from believing the world to trusting only oneself.', fit: ['dark turn', 'revenge', 'villain male lead', 'angst'] },
  villain_break: { title: 'Smart villain & break-the-game chain', formula: 'The villain rules by making rules; the lead breaks information, then logic, then belief.', fit: ['intrigue', 'mind game', 'business war', 'suspense', 'villain'] },
  banal_villain: { title: 'Banal evil (dinner-table villain)', formula: 'The most relatable Chinese villain is in the living room: control delivered through the most domestic “for your own good”.', fit: ['family', 'realistic', 'period', 'in-law', 'chinese relationship', 'villain'] },
};
/** 按题材/梗概匹配最相关的方法论卡片（选题会与大纲阶段用）。v1.94 支持英文匹配 */
export function matchCraftCards(input: { text?: string; tags?: string[]; limit?: number }, lang: 'zh' | 'en' = 'zh'): CraftCard[] {
  const en = lang === 'en';
  const rawText = `${input.text || ''} ${(input.tags || []).join(' ')}`;
  const text = en ? rawText.toLowerCase() : rawText;
  const limit = input.limit || 6;
  const scored = ALL_CRAFT_CARDS
    .map((c) => {
      const keys = en ? (CARD_EN[c.id]?.fit || []) : c.fit;
      const n = keys.reduce((s, k) => s + (k === '全部' || k === 'all' ? 1 : (text.includes(k) ? 1 : 0)), 0);
      return { c, n };
    })
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);
  return scored.slice(0, limit).map((s) => s.c);
}

/* =====================================================================
 * C. 六把保守 P2 尺子（电影级文笔/展示非讲述/因果/集尾/圣人化/崩溃外化），文本可稳定识别
 * =================================================================== */

/* 1. 拆滤镜：戒掉“看到/听到/感觉到”这类在读者与故事间竖玻璃墙的感官滤镜词 */
const FILTER_WORDS = ['看到', '看见', '听到', '听见', '感觉到', '感到', '觉得', '闻到', '注意到', '发现自己'];
const FILTER_WORDS_EN = ['saw', 'seen', 'heard', 'could hear', 'felt', 'could feel', 'noticed', 'realized', 'sensed', 'smelled'];
const DIRECT_SENSE = ['咯吱', '咔', '嗡', '颤抖', '汗', '呼吸', '心跳', '铁锈味', '发冷', '发麻', '攥', '盯', '静'];
const DIRECT_SENSE_EN = ['creak', 'click', 'buzz', 'tremble', 'sweat', 'breath', 'heartbeat', 'metallic taste', 'went cold', 'tingle', 'clench', 'stare', 'silence'];
export function filterWordLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const t = en ? (text || '').toLowerCase() : (text || '');
  const n = count(t, (en ? FILTER_WORDS_EN : FILTER_WORDS).map((w) => (en ? w.toLowerCase() : w)));
  const direct = count(t, (en ? DIRECT_SENSE_EN : DIRECT_SENSE).map((w) => (en ? w.toLowerCase() : w)));
  const bad = n >= 4;
  return {
    rule: 'ntFilterWord', dim: en ? 'Show, don’t tell' : '展示非讲述', level: 'P2', hit: has(t, (en ? FILTER_WORDS_EN : FILTER_WORDS).map((w) => (en ? w.toLowerCase() : w))).slice(0, 6),
    advice: bad
      ? (en
        ? `Filter words (saw/heard/felt) appear ${n} times, putting a glass wall between reader and story (the reader only sees the lead being scared, feels nothing). Remove the filter and throw the objective image that causes the feeling directly at the reader — not “he heard footsteps and felt afraid”, but “the floorboard creaked; he clamped a hand over his mouth as the doorknob slowly turned”.`
        : `“看到/听到/感觉到/觉得”出现${n}次，像在读者和故事间竖玻璃墙（读者只看见主角害怕，自己没感觉）。拆滤镜：删掉感官滤镜词，把引发感受的客观画面直接砸给读者——不写“他听到脚步声、感觉很害怕”，写“木地板咯吱一响，他死死捂住嘴，门把手一点点向下转”。`)
      : n >= 2 && direct === 0
        ? (en ? 'Filter words outweigh direct imagery; rewrite “he felt / he saw” into audible, visible concrete action and environment.' : '感官滤镜词偏多、直接画面偏少，尝试把“他感到/他看到”改写成可听可见的具体动作与环境。')
        : (en ? 'No filter-word stacking; the imagery is direct and shown. Keep it.' : '未见感官滤镜堆砌，画面直接、展示充分，保持。'),
    score: bad ? 48 : n >= 2 && direct === 0 ? 64 : 87,
  };
}

/* 2. 删“说”字：愤怒地说/害怕地说这类情绪标签，改用生理反应与动作 */
const EMOTION_TAG = /(愤怒|生气|恼怒|气愤|害怕|恐惧|吃惊|惊讶|伤心|难过|开心|高兴|冷冷|淡淡|无奈|激动|委屈|不耐烦|慌张|震惊)[地的]?(说|道|吼|喊|问|回答|反驳)/g;
const EMOTION_TAG_EN = /(angrily|furiously|fearfully|afraid|terrified|surprised|shocked|sadly|happily|coldly|helplessly|excitedly|nervously|in panic|anxiously)\s+(said|asked|shouted|yelled|replied|snapped|cried|muttered)|(said|shouted|replied)\s+(angrily|furiously|fearfully|coldly|sadly|happily|nervously)/gi;
export function emotionTagLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const t = text || '';
  const m = (en ? (t.match(EMOTION_TAG_EN) || []) : (t.match(EMOTION_TAG) || []));
  const bad = m.length >= 3;
  return {
    rule: 'ntEmotionTag', dim: en ? 'Embodied dialogue' : '台词身体化', level: 'P2', hit: m.slice(0, 6),
    advice: bad
      ? (en
        ? `Emotion tags (“said angrily / shouted fearfully / coldly replied”) appear ${m.length} times — labeling emotion directly. Cut the emotion word and most “said”; let the body rebel first: not “he said angrily, you’re dead”, but “a vein stood out on his arm, yet his voice stayed low: say that once more.” Make dialogue, body and environment work together.`
        : `“愤怒地说/害怕地说/冷冷道”等情绪标签出现${m.length}处=直接给情绪贴标签。删掉情绪词与大半“说”，让身体先叛乱：不写“他愤怒地说你找死”，写“他右臂青筋暴起，声音却压得很低：你再说一句”。让台词、生理、环境三层同时发力。`)
        : m.length >= 1
          ? (en ? 'A few “emotion + said” tags remain; in key conflict scenes swap them for physiological reaction / action / environment for more flesh.' : '存在少量“情绪+说道”标签，关键冲突戏可替换为生理反应/动作/环境介入，更有血肉。')
          : (en ? 'No emotion-tag dialogue; emotion is carried by action and body. Keep it.' : '未见情绪标签式台词，情绪由动作与身体承载，保持。'),
    score: bad ? 50 : m.length >= 1 ? 68 : 88,
  };
}

/* 3. 因果链：“然后…然后…”流水账，缺因为所以 */
export function thenChainLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const t = en ? (text || '').toLowerCase() : (text || '');
  const then = count(t, en ? ['then', 'after that', 'next,'] : ['然后']);
  const causal = count(t, en ? ['because', 'so', 'therefore', 'thus', 'as a result', 'which led', 'in order to', 'forced to'] : ['因为', '所以', '因此', '于是', '导致', '为此', '之所以', '迫于']);
  const bad = then >= 3 && causal <= 1;
  return {
    rule: 'ntThenChain', dim: en ? 'Causal chain' : '因果链', level: 'P2', hit: bad ? (en ? ['then'] : ['然后']) : [],
    advice: bad
      ? (en
        ? `“Then/after that” appears ${then} times with only ${causal} causal link — a temporal log (he finds the sword, then gets strong, then takes revenge). Change to a causal chain: he finds the sword, which activates the seal, which exposes him, so enemies come for him. Per passage: if deleting an event leaves the plot intact, it is dead weight — cut it or make it the fruit of the prior beat / seed of the next.`
        : `“然后”出现${then}次、因果连接仅${causal}处=时间流水账（他捡剑然后变强然后报仇）。改成因果锁链：他捡剑，所以封印激活、所以暴露行踪、所以仇家上门。检查每段：删掉它后文仍接得上=无效情节，应删或改成上一事的果、下一事的因。`)
        : then >= 3 ? (en ? '“Then” is overused; recast some sequential links as cause/effect or purpose so beats interlock.' : '“然后”偏多，可把部分顺承改写为因果/目的关系，让情节一环扣一环。')
          : (en ? 'Causation interlocks well; no “then” log. Keep it.' : '情节因果咬合良好，未见“然后”流水账，保持。'),
    score: bad ? 52 : then >= 3 ? 66 : 88,
  };
}

/* 4. 集尾圆满收束（蔡加尼克反例）：在句号上安心收尾，缺未完成焦虑（与 webnovel 的“开打前放狠话”假断章互补） */
const SATISFIED_END = ['睡着', '盖上被子', '香甜', '安然', '睡去', '一夜无梦', '洗洗睡', '关灯', '圆满结束', '就这样过去了', '踏实的睡', '进入了梦乡'];
const SATISFIED_END_EN = ['fell asleep', 'drifted off', 'tucked in', 'slept soundly', 'slept peacefully', 'turned off the light', 'ended perfectly', 'all was well', 'into a deep sleep'];
const SUSPENSE_TAIL = ['？', '?', '谁', '什么', '为什么', '到底', '竟然', '原来', '秘密', '是谁', '还没', '就在这时', '突然', '不知', '刚要', '猛地'];
const SUSPENSE_TAIL_EN = ['?', 'who', 'what', 'why', 'turned out', 'secret', 'little did', 'not yet', 'just then', 'suddenly', 'was about to', 'abruptly'];
export function satisfiedEndingLint(ending: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const tail = (en ? (ending || '').slice(-280).toLowerCase() : (ending || '').slice(-140));
  if (!(ending || '').trim()) return { rule: 'ntSatisfiedEnd', dim: en ? 'Episode-end open loop' : '集尾未完成感', level: 'P2', hit: [], advice: en ? 'No episode-ending text provided.' : '未提供集尾文本。', score: 80 };
  const sat = has(tail, (en ? SATISFIED_END_EN : SATISFIED_END).map((w) => (en ? w.toLowerCase() : w)));
  const sus = count(tail, (en ? SUSPENSE_TAIL_EN : SUSPENSE_TAIL).map((w) => (en ? w.toLowerCase() : w)));
  const bad = sat.length >= 1 && sus === 0;
  return {
    rule: 'ntSatisfiedEnd', dim: en ? 'Episode-end open loop' : '集尾未完成感', level: 'P2', hit: sat,
    advice: bad
      ? (en
        ? 'Ending on the period of “fell asleep / all was well / ended perfectly” lets the reader close the book and not return (Zeigarnik: people cannot stand the unfinished). Don’t brake at the climax; pull the key one second before it lands or as a new reversal surfaces, ending on a question/exclamation.'
        : '集尾停在“睡着/盖上被子/圆满结束”的句号上=读者也安心合上、明天不再来（蔡加尼克效应：人无法忍受未完成）。别在高潮结束时踩刹车，在高潮将至未至或新反转刚露头的一瞬拔掉钥匙，停在问号/惊叹号上。')
        : sus ? (en ? 'The ending holds suspense / an unresolved action; open-loop anxiety holds. Keep it.' : '集尾留有悬念/未解动作，未完成焦虑成立，保持。')
          : (en ? 'The ending is a little flat; drop a bigger question or an odd detail to lock the next episode.' : '集尾收得略平，可在结尾抛一个更大的问号或反常细节锁住下一集。'),
    score: bad ? 46 : sus ? 88 : 66,
  };
}

/* 5. 完美圣人：正面标签堆砌、无弱点/犹豫/秘密/代价（人性褶皱） */
const VIRTUE_WORDS = ['善良', '勇敢', '聪明', '正义', '无私', '完美', '正直', '坚强', '从不犯错', '大公无私', '舍己为人', '光明磊落', '高大全', '毫无缺点', '一身正气'];
const VIRTUE_WORDS_EN = ['kind-hearted', 'brave', 'clever', 'righteous', 'selfless', 'perfect', 'upright', 'strong-willed', 'never makes mistakes', 'noble', 'flawless', 'incorruptible'];
const FLAW_WORDS = ['缺点', '弱点', '犹豫', '自私', '秘密', '怕', '软肋', '瑕疵', '褶皱', '挣扎', '愧疚', '私心', '不体面', '旧伤', '阴影', '骂了句', '怕黑', '不识字'];
const FLAW_WORDS_EN = ['flaw', 'weakness', 'hesitate', 'selfish', 'secret', 'afraid', 'soft spot', 'blemish', 'crease', 'struggle', 'guilt', 'private motive', 'old wound', 'shadow', 'cursed under breath', 'illiterate'];
export function perfectSaintLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const t = en ? (text || '').toLowerCase() : (text || '');
  const virtue = has(t, (en ? VIRTUE_WORDS_EN : VIRTUE_WORDS).map((w) => (en ? w.toLowerCase() : w)));
  const flaw = count(t, (en ? FLAW_WORDS_EN : FLAW_WORDS).map((w) => (en ? w.toLowerCase() : w)));
  const bad = virtue.length >= 4 && flaw === 0;
  return {
    rule: 'ntPerfectSaint', dim: en ? 'Human creases' : '人性褶皱', level: 'P2', hit: virtue.slice(0, 6),
    advice: bad
      ? (en
        ? `The lead is piled with positive labels (${virtue.slice(0, 4).join(', ')}) yet has no weakness / hesitation / secret — a saint, not a person, and readers stay cold. Add human creases: ① an unflattering instinct before choosing right (want to flee → curse → charge back); ② an embarrassing secret opposite the image; ③ a stubborn small flaw and a victory that costs something. Perfection earns awe; flaws earn identification.`
        : `主角被${virtue.slice(0, 4).join('、')}等正面标签堆满、却没有弱点/犹豫/秘密=圣人不是人，读者无感。补人性褶皱：①先给不光彩的本能反应再选正义（想逃→骂句脏话→冲回去）；②配一个与形象相反的“丢人秘密”；③给改不掉的小缺点和一次要付出代价的胜利。完美让人仰望，瑕疵让人代入。`)
        : virtue.length >= 3 && flaw === 0
          ? (en ? 'The lead leans “all-good”; add one hesitation, private motive or old wound so they read alive, not like a résumé.' : '主角偏“高大全”，建议补一处犹豫、私心或旧伤，让他像活人而非简历。')
          : (en ? 'The lead has weakness / struggle / secret; human creases hold. Keep it.' : '主角有弱点/挣扎/秘密，人性褶皱在线，保持。'),
    score: bad ? 48 : virtue.length >= 3 && flaw === 0 ? 64 : 86,
  };
}

/* 6. 崩溃直给（曹雪芹式克制）：反复用“崩溃/绝望/痛不欲生”等情绪结论词，却无生理/动作外化，高级的绝望是安静的 */
const DESPAIR_LABELS = ['崩溃', '绝望', '痛苦万分', '痛不欲生', '心如刀割', '心碎', '万念俱灰', '撕心裂肺', '泪崩', '嚎啕大哭', '哭得死去活来', '悲痛欲绝'];
const DESPAIR_LABELS_EN = ['broke down', 'in despair', 'in agony', 'heartbroken', 'shattered', 'all hope gone', 'torn apart', 'burst into tears', 'cried hysterically', 'overcome with grief', 'devastated'];
const DESPAIR_BODY = ['抖', '僵', '发麻', '发冷', '空白', '站不稳', '攥', '指甲', '喉咙', '发不出声', '机械', '重复', '沉默', '怔怔', '失神', '眼泪没有', '没掉', '轻轻', '缓缓', '坐下去', '蹲下'];
const DESPAIR_BODY_EN = ['tremble', 'froze', 'tingle', 'went cold', 'blank', 'unsteady', 'clench', 'fingernail', 'throat', 'no sound came', 'mechanically', 'repeat', 'silence', 'stared blankly', 'dazed', 'no tears', 'didn’t fall', 'softly', 'slowly', 'slid down', 'squatted'];
export function despairTellLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const t = en ? (text || '').toLowerCase() : (text || '');
  const labels = has(t, (en ? DESPAIR_LABELS_EN : DESPAIR_LABELS).map((w) => (en ? w.toLowerCase() : w)));
  const body = count(t, (en ? DESPAIR_BODY_EN : DESPAIR_BODY).map((w) => (en ? w.toLowerCase() : w)));
  const bad = labels.length >= 3 && body === 0;
  return {
    rule: 'ntDespairTell', dim: en ? 'Externalized breakdown' : '崩溃外化', level: 'P2', hit: labels.slice(0, 6),
    advice: bad
      ? (en
        ? `Emotion conclusions (“broke down / in despair / heartbroken / devastated”) appear ${labels.length} times with no bodily reaction — handing the reader the answer instead of moving them (the highest despair is quiet). Delete the labels and externalize into an out-of-control body and mechanical motion: not “she broke down and cried in despair”, but “her lips parted; no sound came; she slid slowly down the doorframe; the glass of water never reached her lips after three tries”.`
        : `“崩溃/绝望/痛不欲生/撕心裂肺”等情绪结论出现${labels.length}处、却看不到身体反应=把答案直接塞给读者，反而不走心（曹雪芹写崩溃一个“苦”字都不提）。高级的绝望是安静的：删掉结论词，外化到失控的身体与机械动作——不写“她崩溃了、绝望痛哭”，写“她张了张嘴，没发出声，慢慢顺着门框滑坐到地上，那杯水端了三次都没送到嘴边”。`)
        : labels.length >= 2 && body === 0
          ? (en ? 'Grief leans on emotion words; in the climactic scene switch to physiological reaction and externalized action — restraint kills more.' : '悲伤/崩溃多靠情绪词直给，关键高潮戏可改为生理反应与动作外化，越克制越杀人。')
          : (en ? 'Grief is carried by body/action; no hollow emotion-label stacking. Keep it.' : '悲痛处有身体/动作承载，未见空洞的情绪结论堆砌，保持。'),
    score: bad ? 47 : labels.length >= 2 && body === 0 ? 63 : 87,
  };
}
export interface NarrativeLintResult { issues: LintIssue[]; avg: number; p2: LintIssue[] }
export function narrativeLint(input: { text?: string; opening?: string; ending?: string; lang?: LintLang }): NarrativeLintResult {
  const lang: LintLang = input.lang === 'en' ? 'en' : 'zh';
  const text = input.text || '';
  const issues: LintIssue[] = [];
  if (text) {
    issues.push(filterWordLint(text, lang), emotionTagLint(text, lang), thenChainLint(text, lang), perfectSaintLint(text, lang), despairTellLint(text, lang));
  }
  const ending = input.ending || (text ? text.slice(-400) : '');
  if (ending) issues.push(satisfiedEndingLint(ending, lang));
  const scored = issues.filter((i) => typeof i.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : 0;
  return { issues, avg, p2: issues.filter((i) => i.level === 'P2' && i.score < 72) };
}
