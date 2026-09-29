/**
 * 萌宝银发 / 亲情治愈机制引擎（v2.25）
 * ------------------------------------------------------------------
 * 第十八套类型引擎，是 family 家庭年代之下的“萌宝带娃 + 银发养老 + 隔代亲情治愈”细分。
 * AI 写这类剧通病：孩子是大人传声筒/人小鬼大失真、老人糊涂工具人、
 * 为虐而虐卖惨、关系一秒变好、冲突全靠狗血撕逼、育儿养老知识错误、
 * 治愈悬浮无伤口、泪点堆砌。本模块 10 装置，非该类型返回空串。纯函数、确定性、双语。
 */
export type TenderLang = 'zh' | 'en';
export interface TenderDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const TENDER_DEVICES: TenderDevice[] = [
  {
    id: 'child_logic', name: '儿童言行符合年龄', nameEn: 'Age-true children',
    principle: '萌宝的“萌”来自真实的儿童逻辑，而不是小大人说大人话：不同年龄段有对应的词汇量、注意力、情绪表达方式，孩子的天真往往一句话戳中本质', principleEn: 'A child’s charm comes from real child logic, not an adult in a small body: each age has its vocabulary, attention span and emotional register, and innocence sometimes cuts to the truth in one line',
    technique: '先定孩子的精确年龄并查一遍该年龄的表达能力（3 岁不会讲大道理、会混淆想象与现实；6 岁会讨价还价但藏不住情绪）；让孩子用具体动作和童言童语推动情节（画一幅画、藏起某物、模仿大人），关键真相由孩子“无意中”说出而非被安排说教', techniqueEn: 'Fix the exact age and its real capacities (a 3-year-old reasons concretely and blurs fantasy; a 6-year-old negotiates but cannot hide feelings); let concrete childish acts drive plot (a drawing, hiding something, mimicking adults), with key truths surfacing accidentally rather than as scripted lectures',
    risk: '孩子不能成为解决一切成人矛盾的万能钥匙，童言点到即止', riskEn: 'A child cannot magically solve every adult conflict; use childish insight sparingly',
    kw: ['萌宝', '带娃', '宝宝', '孩子', '单亲带娃', '亲子', '五岁', '小孩', 'kid', 'toddler', 'single parent', 'raising a child', 'little one', 'child'],
  },
  {
    id: 'elder_dignity', name: '银发长辈有尊严', nameEn: 'Elders with dignity and agency',
    principle: '老人不是糊涂、拖累或只负责催婚的工具人：他们有自己的欲望、经验、尊严与社交，代际碰撞来自观念差异而非“老人变坏/变傻”', principleEn: 'Elders are not confused burdens or nagging props: they have desires, experience, dignity and social lives, and generational friction comes from differing worldviews, not from being foolishly old',
    technique: '给每位长辈一个“自己的目标”（想学手机、想找老战友、想守住老手艺、想黄昏恋），让他在关键时刻凭人生经验帮到下一代；衰老与健忘若涉及，要符合真实状态且被温柔对待，不用“老糊涂”制造廉价笑料', techniqueEn: 'Give every elder their own goal (learning a phone, finding an old comrade, keeping a craft, a late romance) and let life experience help the next generation at a key moment; portray aging or memory issues accurately and tenderly, never as cheap senility jokes',
    risk: '疾病（阿尔茨海默等）表现需查证、不煽情、不提供错误医疗信息', riskEn: 'Depict illnesses accurately after checking facts; no melodrama or wrong medical claims',
    kw: ['银发', '老人', '奶奶', '爷爷', '外婆', '外公', '养老', '隔代', '黄昏恋', 'grandma', 'grandpa', 'elderly', 'grandparent', 'aging parents', 'senior'],
  },
  {
    id: 'wound_first', name: '先立伤口再治愈', nameEn: 'Wound before healing',
    principle: '治愈之所以动人，是因为先有真实的伤口：经济压力、丧偶式育儿、职场妈妈困境、被忽略的老人，困境立得越真，后来的暖越有重量，不能一上来就岁月静好', principleEn: 'Healing moves because a real wound exists first—financial strain, absent co-parenting, the working-mother squeeze, a neglected elder; the truer the hardship, the heavier the later warmth',
    technique: '开篇用 1-2 个具体生活事件立住困境（凌晨独自带娃看病、老人在医院不会用挂号机），让困境可感但不卖惨；为每个主要人物写一句“最不愿被提起的伤”，治愈线围绕它分阶段推进', techniqueEn: 'Open with 1-2 concrete daily events that ground the hardship (a lone emergency-room trip at 3am, an elder lost at a hospital kiosk)—felt, not wallowed; give each lead a wound they avoid naming and heal it in stages',
    risk: '伤口要克制呈现，不反复渲染极端苦难博取眼泪', riskEn: 'Present wounds with restraint; avoid repeatedly milking extreme suffering',
    kw: ['治愈', '困境', '丧偶式育儿', '单亲妈妈', '难处', '暖心', 'healing', 'hardship', 'struggle', 'warmth', 'wound'],
  },
  {
    id: 'daily_texture', name: '生活流烟火细节', nameEn: 'Textured everyday life',
    principle: '亲情剧的质感在柴米油盐：做饭、接送、哄睡、买菜、量血压这些重复日常里藏着关系变化，细节越具体，人物越像你我身边的人', principleEn: 'Its texture lives in domestic routine—cooking, school runs, bedtime, groceries, blood-pressure checks—where relationships quietly shift; concrete detail makes characters feel like family',
    technique: '每集安排 1-2 个有叙事作用的生活动作（同一道菜前后做法变化映射关系、孩子的身高线、老人攒的塑料袋/旧物），用物件与动作代替直白抒情；季节、社区、菜场学校等空间细节贴合人物所在城市与阶层', techniqueEn: 'Give each episode 1-2 narrative domestic actions (a dish cooked differently as relations change, a height chart, an elder’s saved bags), using objects instead of stated feelings; ground season, neighborhood, market and school in the character’s actual city and class',
    risk: '细节服务情绪与关系，不堆砌流水账', riskEn: 'Details serve emotion and relation, not a flat log of chores',
    kw: ['烟火气', '日常', '做饭', '接送', '生活流', '柴米油盐', 'daily life', 'domestic', 'cooking', 'routine', 'everyday warmth'],
  },
  {
    id: 'bond_ladder', name: '羁绊分台阶靠近', nameEn: 'Bonds built in graded steps',
    principle: '亲情不是认个亲、抱一下就成立：两个原本有隔阂的人（父女、继母与孩子、隔代）要经过戒备、试探、松动、依赖几个台阶，每一步都由具体事件推动', principleEn: 'Bonding is not instant: estranged people (father-child, stepmother, generations) move through guard, probing, softening and reliance, each step earned by a concrete event',
    technique: '为核心关系画一条“靠近曲线”，标注每个台阶的触发事件（第一次被照顾、一次共同对外、一次误会后的道歉），中间至少安排一次反复（刚缓和又因旧伤冲突），和解前必须有一次双方都付出的具体行动', techniqueEn: 'Draw a closeness curve with trigger events (first being cared for, facing an outsider together, an apology after misunderstanding), include at least one relapse as an old wound reopens, and require concrete mutual effort before reconciliation',
    risk: '台阶不能跳，突然亲如一家最假', riskEn: 'Never skip rungs; instant family feels the falsest',
    kw: ['和解', '隔阂', '靠近', '破冰', '相处', 'bond', 'reconcile', 'warm up to', 'broken trust', 'grow close'],
  },
  {
    id: 'mutual_growth', name: '双向奔赴共同成长', nameEn: 'Mutual, two-way growth',
    principle: '治愈不是大人单方面拯救孩子/老人，而是彼此改变：孩子教会大人松弛与勇敢，老人教会年轻人从容与根，双向成长让主题立得住', principleEn: 'Healing is not one-way rescue: the child teaches the adult to loosen up and be brave, the elder teaches patience and roots—two-way growth makes the theme stand',
    technique: '给大人也设一条需要被治愈的缺陷线（控制狂、不敢再婚、只懂赚钱），让孩子/老人在关键节点反过来“教大人一次”；结局让双方都与开篇不同，用一个对照镜头呈现彼此的改变', techniqueEn: 'Give the adult a wound to heal too (control-freak, afraid to remarry, all work), let the child or elder teach them once at a key moment, and end with both changed, shown in a mirroring shot',
    risk: '孩子的“教”要符合年龄，老人的智慧不说教', riskEn: 'A child’s lesson must fit its age; an elder’s wisdom must not lecture',
    kw: ['共同成长', '双向', '彼此治愈', '改变', '一起长大', 'mutual growth', 'grow together', 'heal each other', 'two-way'],
  },
  {
    id: 'soft_conflict', name: '软冲突制造张力', nameEn: 'Tension through soft conflict',
    principle: '亲情剧不靠撕逼狗血也能抓人：育儿观念差、生活习惯摩擦、误会、善意的隐瞒、现实压力，软冲突更贴近生活也更耐品', principleEn: 'It grips without screaming melodrama: clashing parenting styles, habit friction, misunderstanding, well-meant concealment and real pressure—soft conflicts feel truer and age better',
    technique: '用“双方都有道理”的方式设计冲突（老人要把饭嚼碎喂孩子是出于爱但不卫生；妈妈要拼事业也是为了家），让观众理解两边；冲突解决靠沟通与让步而非反派使坏，每 2-3 集一个小摩擦并当集或次集化解', techniqueEn: 'Design conflicts where both sides have a point (an elder feeds a child out of love but unsafely; a mother works for the family), resolve through talk and concession rather than a villain, and place a small friction every 2-3 episodes resolved within an episode or two',
    risk: '可以有“不讨喜的亲戚”，但不把矛盾写成纯粹恶人，避免脸谱化', riskEn: 'An awkward relative is fine, but avoid one-note villains',
    kw: ['婆媳', '观念冲突', '误会', '摩擦', '育儿分歧', '家庭矛盾', 'in-law', 'parenting clash', 'misunderstanding', 'family friction'],
  },
  {
    id: 'tear_smile', name: '泪中带笑悲喜交替', nameEn: 'Tears with a smile: alternating tones',
    principle: '一直哭会麻木，一直甜会发腻：哭点之后紧跟一个暖点或笑点，悲喜交替形成呼吸感，观众笑着笑着就哭了才是高级治愈', principleEn: 'Constant tears numb and constant sweetness cloys: follow a tear-beat with warmth or humor so tones breathe; laughing until you cry is the higher register',
    technique: '排节奏时遵循“酸-甜-暖”小循环：让一个催泪点紧接孩子的一句童言或长辈的一个可爱举动化解；沉重一集后用一集轻松日常过渡；全剧大泪点前先铺一段欢乐，反差催泪', techniqueEn: 'Arrange a bitter-sweet-warm loop: follow a tear-beat with childish words or an elder’s cute gesture; after a heavy episode use a light one, and place joy before the biggest cry for contrast',
    risk: '笑点不拿弱者的缺陷、疾病、贫穷开涮', riskEn: 'Humor never mocks weakness, illness or poverty',
    kw: ['泪点', '笑点', '又哭又笑', '暖心治愈', '催泪', 'tearjerker', 'bittersweet', 'laugh and cry', 'heartwarming'],
  },
  {
    id: 'real_issue', name: '现实议题轻落地', nameEn: 'Real issues, lightly landed',
    principle: '育儿、养老、二胎、空巢、职场妈妈、隔代教育是天然共鸣点，但议题要“化在故事里”，让观众自己对号入座，而不是搬一堂说教课', principleEn: 'Parenting, elder care, second children, empty nests, working mothers and cross-generational schooling resonate naturally—but dissolve the issue into story so viewers recognize themselves rather than being lectured',
    technique: '一集只承载一个现实议题并通过人物的具体选择呈现两面（要不要生二胎通过一次真实的家庭算账展开）；涉及育儿/医疗/法律/政策的信息要查证准确，不确定处用泛称；结尾不给标准答案，给一个有人情味的取舍', techniqueEn: 'Carry one issue per episode through a concrete choice showing both sides (a second child via an honest family budget check); verify parenting, medical, legal and policy facts and use generic terms when unsure; end with a humane trade-off, not a preached answer',
    risk: '不传播错误育儿/急救/养老知识，不制造性别或地域对立', riskEn: 'Never spread wrong parenting, first-aid or elder-care claims, nor gender or regional antagonism',
    kw: ['二胎', '空巢', '职场妈妈', '隔代教育', '育儿焦虑', '养老压力', 'working mother', 'second child', 'empty nest', 'parenting pressure', 'elder care'],
  },
  {
    id: 'warm_payoff', name: '小约定温暖回收', nameEn: 'Warm payoff of small promises',
    principle: '治愈剧的终局要“暖得有据”：前期埋下的小约定、小物件、小愿望在结尾被一一兑现，观众的情绪有处安放，余温绵长', principleEn: 'Its ending must be earned warmth: small promises, objects and wishes planted early are paid off one by one, giving emotion somewhere to land and a long afterglow',
    technique: '前 1/3 埋 2-3 个“情感信物/约定”（孩子说想和妈妈去一次海边、老人想补一张婚纱照），中段因困境看似无法实现，终局用人物努力后的方式兑现（未必圆满但真诚）；最后一场戏回扣开篇画面，形成首尾呼应', techniqueEn: 'Plant 2-3 emotional tokens or promises in the first third (a child longing for the sea, an elder wanting wedding photos), make them seem impossible mid-story, then pay them off through effort—imperfect but sincere; let the final scene echo the opening image',
    risk: '兑现要靠人物自己的努力，不靠天降横财或贵人', riskEn: 'Payoff comes through the characters’ own effort, not windfalls or saviors',
    kw: ['约定', '愿望', '信物', '兑现', '圆满', '首尾呼应', 'promise', 'wish kept', 'payoff', 'earned happy ending'],
  },
];

export const VALID_TENDER_DEVICES = new Set(TENDER_DEVICES.map((d) => d.id));
const BY_ID = new Map(TENDER_DEVICES.map((d) => [d.id, d]));

const TENDER_HINT = ['萌宝', '带娃', '宝宝', '单亲妈妈', '单亲带娃', '奶爸', '亲子', '奶奶带娃', '爷爷带娃', '隔代亲', '银发', '养老', '黄昏恋', '祖孙', '亲情治愈', '带孙子', 'toddler', 'raising kid', 'single mom', 'single dad', 'grandparent raising', 'grandma grandpa', 'elder care drama', 'healing family', 'wholesome family'];
export function detectTender(text: string): boolean {
  const t = (text || '').toLowerCase();
  return TENDER_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickTenderDevices(text: string, n = 3): TenderDevice[] {
  const t = (text || '').toLowerCase();
  const hit = TENDER_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: TenderDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：先伤后愈（地基）+ 羁绊阶梯（类型魂）+ 温暖回收（情绪落点）
  const fallback = ['wound_first', 'bond_ladder', 'warm_payoff'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  TENDER_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildTenderDirective(text: string, lang: TenderLang = 'zh', n = 3): string {
  if (!detectTender(text)) return '';
  const ds = pickTenderDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a WHOLESOME FAMILY drama (young child / grandparents / cross-generational healing). Earn every warm moment. Use these devices this episode:\n${body}\nHard rules: children must speak and act exactly their age (never tiny adults delivering lectures), elders keep dignity, agency and accurate health portrayal, establish a real wound before healing it, build bonds in graded steps with relapses rather than instant family, growth runs both ways, prefer soft conflict where both sides have a point over cartoonish villains, alternate tears with warmth and never mock weakness or poverty, verify all parenting/medical/elder-care facts and never spread wrong advice or gender/regional antagonism, never use a child for misery-porn, and pay off warmth through the characters’ own effort.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为萌宝/银发/隔代亲情治愈剧，温暖必须被“挣来”。本集重点使用以下装置：\n${body}\n硬性要求：孩子言行严格符合真实年龄，不做说大人话的小大人；长辈有尊严、有自己的目标，疾病表现查证准确；先立真实伤口再治愈，不卖惨；关系按台阶靠近、允许反复，不瞬间亲如一家；成长必须双向；冲突用“双方都有道理”的软冲突，不写脸谱化恶人；泪点后给暖点、悲喜交替，不拿缺陷疾病贫穷开玩笑；育儿/医疗/养老/政策信息必须查证准确，不传播错误知识，不制造性别地域对立；不消费孩子卖惨；温暖回收靠人物自身努力，不靠天降好运。`;
}
