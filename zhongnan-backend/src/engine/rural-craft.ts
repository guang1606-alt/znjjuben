/**
 * 乡村乡土 / 地域年代机制引擎（v2.26）
 * ------------------------------------------------------------------
 * 第十九套类型引擎。AI 写乡土剧通病：把农民写得愚昧可笑、方言堆砌或写错、
 * 民俗想当然、农村只剩穷和坏、城乡对立脸谱化、政策口号化、人物脱离生计空谈。
 * 本模块 10 装置，非该类型返回空串。纯函数、确定性、双语。
 */
export type RuralLang = 'zh' | 'en';
export interface RuralDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const RURAL_DEVICES: RuralDevice[] = [
  {
    id: 'dialect_layer', name: '方言点染不堆砌', nameEn: 'Dialect as seasoning, not a wall',
    principle: '方言的作用是“一两个词立住地域”，而不是整段听不懂：少量高辨识度词汇+语气节奏即可传神，过度堆砌既影响理解也容易写错闹笑话', principleEn: 'A word or two of dialect establishes place while tone carries the rest; wall-to-wall dialect blocks comprehension and risks errors',
    technique: '为故事发生地选 8-12 个高辨识度方言词（称呼、感叹、特色食物/农具叫法）做“方言卡”，每集点染不超过若干处且首次出现靠上下文能懂；句式上模仿当地说话节奏（短句、倒装、语气词）而非逐句谐音；拿不准的方言宁可用泛地方口音，不生造', techniqueEn: 'Build an 8-12 word dialect card (kinship terms, interjections, local food or tool names), sprinkle sparingly so context explains each, mimic sentence rhythm rather than phonetic spelling, and use a generic regional accent instead of inventing forms when unsure',
    risk: '方言必须查证当地人怎么说，避免“伪方言”冒犯或穿帮', riskEn: 'Verify real usage with local sources; fake dialect rings false and can offend',
    kw: ['乡村', '农村', '乡土', '村里', '乡亲', '方言', '老乡', '屯里', '寨子', '村口', 'village', 'rural', 'countryside', 'hometown', 'farming village'],
  },
  {
    id: 'kinship_network', name: '熟人社会关系网', nameEn: 'A tight-knit kinship network',
    principle: '乡村是“没有陌生人”的熟人社会：人人沾亲带故、名声传得快、人情与面子是硬通货，矛盾和转机都要顺着这张关系网走才真实', principleEn: 'Rural life is a stranger-free web where everyone is connected, reputation travels fast, and renqing and face matter; conflict and turns must travel along this web',
    technique: '开篇列一张“村庄关系图”：谁家与谁家是本家、结过亲、有旧怨，村干部、长辈、能人、外姓户各在哪；让消息靠串门、集市、村群传播，冲突先经过“讲人情、找长辈、找村委”的层级，再升级到撕破脸', techniqueEn: 'Map the village up front: clans, in-laws, old grudges, cadres, elders, capable locals and outsider surnames; spread news through visits, market and village groups, and route conflict through renqing, elders and committee before it escalates',
    risk: '关系网人物控制在观众记得住的规模，旁支过多会乱', riskEn: 'Keep the network memorable; too many side branches confuse',
    kw: ['宗族', '本家', '亲戚', '邻里', '人情', '面子', '村支书', '族长', 'kinship', 'clan', 'neighbors', 'village committee', 'face and favor'],
  },
  {
    id: 'livelihood_engine', name: '土地与生计驱动', nameEn: 'Driven by land and livelihood',
    principle: '乡土人物的重大选择几乎都绕不开生计：地、收成、养殖、打工、手艺、拆迁补偿，把经济账算清楚，人物动机才立得住', principleEn: 'Rural choices revolve around livelihood—land, harvest, livestock, migrant work, crafts, relocation compensation; a clear economic ledger makes motives stand',
    technique: '为核心矛盾算一本具体的生计账（一亩地收成、一季养殖投入产出、一场天灾损失多少、外出务工月收入），让每个决定都与这笔账挂钩；主角的翻身靠具体营生（学技术、搞合作社、做电商、办乡村旅游）一步步实现，不一夜暴富', techniqueEn: 'Keep a concrete ledger (per-mu yield, a season’s livestock input and return, disaster losses, migrant monthly pay) tying decisions to money; the lead advances through a real trade—skills, a cooperative, e-commerce, rural tourism—not overnight wealth',
    risk: '数字要符合当时当地真实水平，查证后使用，不夸大收入', riskEn: 'Figures must match the time and place; verify, never inflate earnings',
    kw: ['种地', '收成', '养殖', '打工', '合作社', '脱贫', '致富', '土地流转', 'farming', 'harvest', 'livestock', 'livelihood', 'cooperative', 'shake off poverty'],
  },
  {
    id: 'custom_research', name: '节令民俗有考据', nameEn: 'Researched seasons and customs',
    principle: '节气、农时、婚丧嫁娶、地方戏、集市庙会是乡土剧独有的质感与天然戏剧场，但民俗必须考据准确，错一个规矩就被当地观众挑出戏', principleEn: 'Solar terms, farm calendar, weddings and funerals, local opera and fairs give rural drama unique texture and ready-made stages, but customs must be accurate—one wrong rule breaks local trust',
    technique: '按故事时间线列出涉及的节令与民俗，查证其真实流程、禁忌、食俗、说辞再写；让一场民俗活动同时承担戏剧功能（婚宴席间爆发冲突、庙会上重逢），不为展示而展示；不同地域民俗不混搭', techniqueEn: 'List the festivals and customs on the timeline, research their real steps, taboos, foods and phrases, then make each serve drama (a clash at a wedding banquet, a reunion at a fair); never blend customs across regions',
    risk: '少数民族地区民俗尤需严谨，避免刻板印象与想当然', riskEn: 'Be especially rigorous with ethnic-minority customs; avoid stereotypes and assumptions',
    kw: ['节气', '农时', '婚丧嫁娶', '庙会', '赶集', '地方戏', '民俗', 'harvest festival', 'village fair', 'folk custom', 'lunar calendar', 'wedding ritual'],
  },
  {
    id: 'urban_rural_fair', name: '城乡碰撞不丑化', nameEn: 'Fair urban-rural friction',
    principle: '城乡差异是富矿但不能变成“农村愚昧 vs 城市先进”的简单对立：两边各有局限与智慧，碰撞出的是理解、融合与双向改变', principleEn: 'Urban-rural difference is rich material but never a simple “backward village vs advanced city”; each side has limits and wisdom, and friction yields understanding and two-way change',
    technique: '设计返乡青年/驻村干部/城里媳妇等“桥梁人物”，让他先带着城市观念碰壁，再发现乡土智慧（老人的经验、熟人社会的信任）；同时让农村人物也指出城市方式的问题，最终方案是两者结合，不是一方征服另一方', techniqueEn: 'Use a bridge figure (a returnee, a stationed cadre, an urban daughter-in-law) whose city assumptions first fail, then discover rural wisdom, while villagers point out flaws in urban ways; the solution blends both rather than conquering',
    risk: '不拿土味、贫穷、无知当笑料，不地域黑', riskEn: 'Never mock rusticity or poverty, and never disparage a region',
    kw: ['返乡', '城乡', '驻村干部', '城里媳妇', '回村', '下乡', 'return to hometown', 'urban-rural', 'sent-down cadre', 'village returnee'],
  },
  {
    id: 'earth_humor', name: '乡土幽默有生活智慧', nameEn: 'Earthy humor rooted in wit',
    principle: '乡土的好笑来自人物的机智、语言的鲜活和处境的反差，而不是卖傻、扮丑和低俗段子，好的乡土幽默里藏着生存智慧', principleEn: 'Rural comedy comes from quick wits, vivid speech and situational irony—not stupidity, ugly acting or vulgar gags; the best earthy humor carries survival wisdom',
    technique: '安排一个“嘴利心热”的角色承担幽默，用俏皮话、歇后语、歪理正说制造笑点；笑点之后让他办成一件实事，幽默与能力绑定；避免靠残疾、贫穷、生理缺陷、方言口音本身取乐', techniqueEn: 'Give a sharp-tongued, warm-hearted character the humor through witty sayings and sound logic in funny wrapping, then let him get something done so comedy pairs with competence; never laugh at disability, poverty, appearance or accent',
    risk: '歇后语/俏皮话查证通用度，太冷僻观众接不住', riskEn: 'Check that sayings are broadly understandable; obscure ones miss',
    kw: ['幽默', '俏皮话', '歇后语', '憨厚', '搞笑', 'witty', 'folksy humor', 'dry wit', 'comic relief'],
  },
  {
    id: 'grassroots_power', name: '基层人情与权力真实', nameEn: 'Grassroots power and human feeling',
    principle: '村里的权力运作是“制度+人情”的混合体：村委、族老、能人、返乡者之间有制衡也有妥协，把基层治理写得真实可信，而不是一个村霸遮天或一个清官秒解决', principleEn: 'Village power blends institution and renqing: committee, elders, capable locals and returnees check and compromise; portray governance credibly rather than one tyrant or one instant-fix official',
    technique: '让一个具体公共事务（修路、分地、灌溉水、宅基地、征地）成为权力线主轴，呈现“提议—争议—协商—表决/上级介入”的真实过程；村干部有私心也有公心，矛盾最终靠规则加人情化解，涉公权力情节不抹黑也不悬浮歌颂', techniqueEn: 'Anchor the power line in one public matter (a road, land division, irrigation water, a housing plot, land acquisition) and show propose-dispute-negotiate-decide or higher-level process; give cadres both self-interest and public spirit, resolve through rules plus renqing, neither smearing nor hollowly glorifying authority',
    risk: '涉基层政策表述要准确，拿不准用泛称，不传播错误政策信息', riskEn: 'State grassroots policy accurately; use generic terms when unsure, never spread wrong policy claims',
    kw: ['村委', '村霸', '基层治理', '宅基地', '征地', '修路', '分地', 'village cadre', 'grassroots governance', 'land acquisition', 'village tyrant'],
  },
  {
    id: 'migrant_line', name: '务工与留守的牵挂', nameEn: 'Migrant work and those left behind',
    principle: '外出务工与留守（老人、妇女、儿童）是当代乡土最真实的情感结构：分离、牵挂、远程的爱与误会、归与不归的抉择，是天然的泪点与现实深度', principleEn: 'Migrant work and those left behind—elders, wives, children—are rural life’s most real emotional structure: separation, longing, distant love and misunderstanding, the choice to return or stay',
    technique: '为务工线建立“两头对照”：城里的工地/厂区生活与村里的家，用电话、视频、汇款单、带回来的礼物连接；让一次“回不回家”的抉择成为情感高潮（抢票、辞工、带病坚持），留守儿童/老人的处境真实但不渲染苦情，落点在亲情与出路', techniqueEn: 'Cross-cut the city worksite and the village home, linked by calls, video, remittance slips and gifts; make a “go home or not” choice the emotional peak (grabbing tickets, quitting, enduring illness), portray left-behind kin truthfully without wallowing, landing on family and a way forward',
    risk: '务工场景细节（工种、欠薪维权路径）查证，不提供错误维权示范', riskEn: 'Verify job details and lawful wage-claim routes; never model wrong rights-protection',
    kw: ['打工', '外出务工', '留守', '留守儿童', '留守老人', '农民工', '返乡', 'migrant worker', 'left-behind children', 'remittance', 'go home for new year'],
  },
  {
    id: 'season_rhythm', name: '农时节律做结构', nameEn: 'The farming calendar as structure',
    principle: '农时本身就是天然的叙事节奏：春耕夏长秋收冬藏对应着希望、忙碌、检验、沉淀，让剧情起伏踩着节气走，既有生活真实又有结构美感', principleEn: 'The farming calendar supplies natural rhythm—spring planting, summer growth, autumn harvest, winter rest map to hope, labor, testing and reflection, grounding plot turns in real seasonal structure',
    technique: '把全剧大节奏对齐一条农时线：播种时立目标与矛盾、管护期埋隐患、收获季迎来总爆发与清算、冬闲期收束情感；关键转折尽量落在节令节点（麦收、年关），用天气与农忙给情节加时限压力', techniqueEn: 'Align the macro-arc to the calendar: set goals at sowing, plant hazards during tending, detonate and settle at harvest, close emotion in winter slack; place turns on seasonal nodes (wheat harvest, New Year) and use weather and farm urgency as deadlines',
    risk: '南北方农时差异大，按故事所在地真实物候安排', riskEn: 'Farm calendars differ north vs south; follow the actual local phenology',
    kw: ['春耕', '秋收', '农忙', '麦收', '年关', '二十四节气', 'spring planting', 'autumn harvest', 'farming season', 'solar terms'],
  },
  {
    id: 'root_belonging', name: '根与归的情感落点', nameEn: 'Roots, belonging and return',
    principle: '乡土剧最深的情感是“根”：出走与归来、嫌弃与认同、个人与故土的和解，结局的力量来自人物重新理解自己从哪里来', principleEn: 'Its deepest emotion is roots: leaving and returning, rejecting then embracing, reconciling self with hometown; the ending gains force as the character re-understands where they come from',
    technique: '开篇让主角与故土处于一种紧张关系（想逃离、觉得丢人、发誓不回来），中段通过具体事件重新认识土地与乡亲的价值，结局让“留下/归来/带着故土走出去”成为人物主动的选择，并用一个贯穿全剧的家乡意象（老槐树、一口井、一块田）首尾呼应', techniqueEn: 'Open with the lead at odds with home (wanting to flee, ashamed, vowing never to return), let concrete events reveal its value, end on an active choice to stay, return or carry home outward, and bookend with one recurring hometown image (an old tree, a well, a field)',
    risk: '不强行拔高成“城市不好农村才好”，落点是各得其所', riskEn: 'Never force “city bad, country good”; land on everyone finding their place',
    kw: ['故土', '乡愁', '根', '归来', '家乡', '叶落归根', 'belonging', 'roots', 'homesickness', 'return home', 'hometown roots'],
  },
];

export const VALID_RURAL_DEVICES = new Set(RURAL_DEVICES.map((d) => d.id));
const BY_ID = new Map(RURAL_DEVICES.map((d) => [d.id, d]));

const RURAL_HINT = ['乡村', '农村', '乡土', '村里', '回村', '下乡', '屯子', '寨子', '老乡', '农民', '种地', '村干部', '村支书', '脱贫', '乡村振兴', '留守', '赶集', 'village', 'rural', 'countryside', 'farming village', 'hometown drama', 'back to the village', 'rural china'];
export function detectRural(text: string): boolean {
  const t = (text || '').toLowerCase();
  return RURAL_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickRuralDevices(text: string, n = 3): RuralDevice[] {
  const t = (text || '').toLowerCase();
  const hit = RURAL_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: RuralDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：生计驱动（地基）+ 熟人关系网（类型魂）+ 根与归（情感落点）
  const fallback = ['livelihood_engine', 'kinship_network', 'root_belonging'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  RURAL_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildRuralDirective(text: string, lang: RuralLang = 'zh', n = 3): string {
  if (!detectRural(text)) return '';
  const ds = pickRuralDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a RURAL / HOMETOWN drama rooted in a real Chinese village (or the matching regional setting). Make place and livelihood credible. Use these devices this episode:\n${body}\nHard rules: never mock villagers, poverty or regional accent and never regional-stereotype; use only a few verified dialect words with no invented or fake dialect; research kinship networks, folk customs, solar-term farm calendars and local phenology accurately and never blend regions; keep a believable livelihood ledger with realistic figures, portray grassroots governance and policy accurately (generic terms when unsure) without smearing or hollow glorification, model lawful rights-protection only, show urban-rural friction as two-way understanding rather than simple opposition, and land on belonging rather than “city bad / country good”.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为乡村乡土/地域年代剧，地域质感与生计逻辑必须真实可信。本集重点使用以下装置：\n${body}\n硬性要求：不丑化农民、不拿贫穷口音生理缺陷取乐、不搞地域黑；方言只做少量点染且必须查证、不生造伪方言；熟人关系网、节令民俗、农时物候考据准确、不跨地域混搭；生计账数字符合当时当地真实水平；基层治理与政策表述准确（拿不准用泛称），不抹黑也不空喊口号；维权只示范合法路径；城乡碰撞写成双向理解而非简单对立；情感落在“根与归属”，不做“城市不好农村才好”的强行拔高。`;
}
