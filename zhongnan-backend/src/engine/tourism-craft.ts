/**
 * 文旅短剧融合创作引擎（v2.08）
 * ------------------------------------------------------------------
 * 用户点名“标签、创作功能里要有文旅属性”。文旅短剧的难点是：写成城市宣传片=硬广没人看，
 * 写成普通剧又丢了文旅价值。本模块沉淀 10 套“剧情×文旅”融合装置，让地标/非遗/美食/方言
 * 成为**推动情节与情绪的机关**，而不是空镜堆砌；并内置“剧情优先、风物服务冲突、不写成硬广”的底线。
 * - detectTourism：从标签/梗概识别文旅/地域宣传意图
 * - pickTourismDevices：关键词命中优先 + 通用三件套兜底，确定性、永不空、不重复
 * - buildTourismDirective：生成给架构师/编剧岗的双语文旅融合指令；非文旅返回空串
 * 纯函数、零 IO；中文单一事实源，英文并行层零中文。
 */
export type TourismLang = 'zh' | 'en';
export interface TourismDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const TOURISM_DEVICES: TourismDevice[] = [
  {
    id: 'landmark_plot', name: '地标入戏', nameEn: 'Landmark as plot device',
    principle: '地标不是背景板，让关键冲突只能在这个地点、借这个空间结构发生', principleEn: 'A landmark is not wallpaper; the key conflict can only happen in this place using its spatial layout',
    technique: '选 1-2 个真实地标，把追逐/对峙/告白安排在其独有结构上（桥头、戏台、缆车、古城门洞），用空间高差、出入口、人流制造阻碍与转折', techniqueEn: 'Pick 1–2 real landmarks and stage the chase/confrontation/confession on their unique structure (bridgehead, opera stage, cable car, old-town gate); use elevation, exits and crowds as obstacles and turns',
    risk: '一集塞太多地标等于旅游流水账；每个出现的地标都要承担情节功能', riskEn: 'Cramming landmarks per episode becomes a travelogue; every landmark shown must carry a plot function',
    kw: ['地标', '打卡', '景点', 'landmark', 'scenic spot', 'location', 'iconic place'],
  },
  {
    id: 'heritage_trick', name: '非遗做情节机关', nameEn: 'Intangible heritage as mechanism',
    principle: '把一门非遗技艺的工序变成解谜、翻盘或定情的关键，技艺过程即剧情过程', principleEn: 'Turn the steps of an intangible-heritage craft into the key to a puzzle, comeback or romance; the craft process becomes the plot process',
    technique: '选一门本地非遗（剪纸、皮影、扎染、制陶、社火），让其一道核心工序在高潮成为破局点，提前两集自然展示工序做伏笔，避免临时百科解说', techniqueEn: 'Choose a local heritage craft (paper-cut, shadow puppetry, tie-dye, pottery, folk fire dance); make one core step the turning point at climax, and show that step naturally two episodes earlier as setup instead of last-minute exposition',
    risk: '不能大段念非遗介绍打断剧情；技艺细节必须经得起专业推敲，不张冠李戴', riskEn: 'Never pause the story for a documentary lecture; craft details must be accurate, not mixed up between regions',
    kw: ['非遗', '手艺', '传承', '剪纸', '皮影', '扎染', 'heritage', 'craft', 'intangible', 'artisan'],
  },
  {
    id: 'food_anchor', name: '美食做情绪锚点', nameEn: 'Local food as emotional anchor',
    principle: '一道地方食物绑定一段关系或记忆，重复出现、每次情绪不同，成为人物的情感刻度', principleEn: 'Bind one local dish to a relationship or memory; repeat it with shifting emotion so it becomes the character’s emotional marker',
    technique: '选一道有制作过程的本地小吃，首现建立关系（一起做/第一次尝），复现用于冲突或和解，最后一次出现承载和解或离别；写清声音、热气、手感等可拍细节', techniqueEn: 'Choose one local snack with a making process: first appearance builds the bond (cooking together / first taste), a repeat fuels conflict or reconciliation, the final serving carries closure or parting; write filmable sound, steam and texture',
    risk: '只报菜名没有人物情绪就是美食广告；避免刻板化“某地人只吃某样”', riskEn: 'Listing dish names without emotion is a food ad; avoid stereotyping a whole region by one food',
    kw: ['美食', '小吃', '味道', '地方菜', 'food', 'cuisine', 'snack', 'dish', 'cooking'],
  },
  {
    id: 'dialect_texture', name: '方言烟火气', nameEn: 'Dialect & local texture',
    principle: '用方言词汇、称谓、语气节奏建立地域真实感，让人物一开口就“是这儿的人”', principleEn: 'Dialect words, forms of address and speech rhythm establish regional authenticity; one line and the character belongs to the place',
    technique: '挑 5-8 个全国观众能听懂的本地高频词/口头禅点缀（不整句方言以免出字幕障碍），配合本地称谓与生活习惯；主角对外来人可自然“翻译”，兼顾普适', techniqueEn: 'Sprinkle 5–8 widely understandable local words/catchphrases rather than whole dialect sentences (subtitle barrier); pair with local forms of address and habits; a local can naturally “translate” for an outsider to stay universal',
    risk: '方言堆砌或用错会被本地观众挑错、外地观众出戏；忌地域刻板印象与地图炮', riskEn: 'Overdone or wrong dialect is caught by locals and alienates others; avoid regional stereotypes and cheap shots',
    kw: ['方言', '口音', '乡土', '本地话', 'dialect', 'accent', 'local speech', 'vernacular'],
  },
  {
    id: 'legend_retell', name: '地方传说/名人新编', nameEn: 'Local legend retold',
    principle: '借用本地传说、历史名人或地名由来做故事母题，与现代主线互文，增加文化厚度', principleEn: 'Borrow a local legend, historical figure or place-name origin as the story motif, intertextual with the modern line for cultural depth',
    technique: '找一个与主题同构的本地传说（如坚守、归来、相守），让主角处境与传说形成镜像，关键抉择处用传说点题但不照搬结局；史实人物只取公认事实，不杜撰争议', techniqueEn: 'Find a local legend structurally matching the theme (persistence, return, devotion), mirror the protagonist’s predicament in it, echo it at the key choice without copying its ending; for real historical figures use only accepted facts, never fabricate controversy',
    risk: '戏说历史名人、篡改民族/宗教叙事有合规与情感风险；传说只能点到为止', riskEn: 'Frivolously rewriting historical figures or ethnic/religious narratives carries compliance risk; keep echoes light',
    kw: ['传说', '历史名人', '典故', '地名由来', 'legend', 'folklore', 'historical figure', 'myth'],
  },
  {
    id: 'route_map', name: '景区动线即剧情地图', nameEn: 'Scenic route as story map',
    principle: '把一条真实游览动线（码头→老街→山顶）设计成剧情推进路线，空间顺序=起承转合', principleEn: 'Design a real visiting route (dock → old street → summit) as the progression line; spatial order equals setup-development-turn-resolution',
    technique: '按真实可达的游览顺序安排场次，每到一个点位关系/信息推进一步，用“离终点还有多远”制造进度感与倒计时，点位之间安排移动戏而非转场硬切', techniqueEn: 'Order scenes along a real, walkable route; each stop advances relationship or information; use distance-to-end for progress and a ticking clock; write scenes during movement between stops instead of hard cuts',
    risk: '动线不符合真实地理会被游客识破；不能为剧情让角色瞬移', riskEn: 'Tourists spot impossible geography; never teleport characters for plot convenience',
    kw: ['动线', '游览路线', '路线', '行程', 'route', 'itinerary', 'trail', 'walking tour'],
  },
  {
    id: 'inn_hub', name: '民宿/客栈社交场', nameEn: 'Inn / B&B as social hub',
    principle: '民宿、茶馆、夜市这类“来来往往的容器”天然汇聚冲突与人物，是文旅剧低成本主场景', principleEn: 'An inn, teahouse or night market is a container of comings and goings, naturally gathering characters and conflict — a low-cost main set',
    technique: '把一家本地民宿/小店设为主场，让返乡主角在此遇到不同客人、每个客人带一个事件，店主身份串起本地关系网；用经营压力（淡季、拆迁、竞争）做主线驱动', techniqueEn: 'Make a local B&B/shop the home base where the returning lead meets guests, each bringing an incident; the owner role ties the local network; use business pressure (off-season, demolition, competition) as the engine',
    risk: '单元客人不能工具化，每个过客也要有自己的诉求；主场要写出地域质感而非通用客栈', riskEn: 'Episodic guests must not be tools — each needs their own want; the set must feel regional, not a generic inn',
    kw: ['民宿', '客栈', '茶馆', '夜市', '小店', 'inn', 'bnb', 'guesthouse', 'teahouse', 'night market'],
  },
  {
    id: 'city_tone', name: '城市气质定影像基调', nameEn: 'City temperament sets the tone',
    principle: '城市有性格（雾都迷离、海岛明亮、西北苍凉），影像基调与节奏应被地域气质统一', principleEn: 'A city has temperament (foggy-mysterious, island-bright, northwest-bleak); visual tone and rhythm should be unified by it',
    technique: '先用三个词定城市气质，再据此定光影（晨雾/斜阳）、色调、配乐乐器与剪辑节奏；让天气与季节参与情绪（雨天摊牌、雪夜和解），空镜只在情绪转折点使用', techniqueEn: 'Define the city in three words, then set light (morning fog / slanted sun), palette, local instruments and editing rhythm; let weather and season carry emotion (rainy confrontation, snowy reconciliation); use establishing shots only at emotional turns',
    risk: '空镜堆砌、风光片化会拖节奏；每个空镜都要有情绪功能', riskEn: 'B-roll overload and tourism-film pacing drag; every establishing shot needs an emotional function',
    kw: ['城市气质', '影像基调', '风光', '色调', 'city vibe', 'tone', 'atmosphere', 'cinematography', 'aesthetic'],
  },
  {
    id: 'specialty_prop', name: '风物特产做道具伏笔', nameEn: 'Local specialty as prop & foreshadow',
    principle: '把特产、药材、器物当关键道具与伏笔，让“只有这儿才有”的东西推动翻盘', principleEn: 'Use local produce, herbs or artifacts as key props and foreshadowing; something “only found here” drives the turnaround',
    technique: '选一样辨识度高的本地风物，早期作为闲笔出现（送人、置办），在关键处成为证据/解药/信物完成回收；交代其独特性时用人物动作而非旁白', techniqueEn: 'Choose one recognizable local item, plant it early as a throwaway (a gift, an errand), then cash it as evidence / remedy / token at the key moment; convey its uniqueness through action, not narration',
    risk: '不能把特产功效神化、做虚假宣传；回收要符合常识', riskEn: 'Do not mythologize a product’s efficacy or run false advertising; payoff must respect common sense',
    kw: ['特产', '风物', '药材', '器物', '伴手礼', 'specialty', 'local product', 'souvenir', 'produce'],
  },
  {
    id: 'soft_sell', name: '剧情优先/软植入底线', nameEn: 'Story-first soft integration',
    principle: '文旅的吸引力来自“我想去那生活”，靠人物与故事让观众向往，而非直接喊口号', principleEn: 'Tourism appeal is “I want to live there” — desire is created through people and story, not slogans',
    technique: '先立人物困境与情感，文旅元素只在“解决困境/承载情感”时出现；每集硬宣传信息不超过一处且化进台词或动作；结尾用人物的留下/归来完成情感种草，不出现“欢迎来到XX”式口号', techniqueEn: 'Build character trouble and emotion first; tourism elements appear only to solve trouble or carry feeling; at most one soft info beat per episode, woven into line or action; close on the character staying/returning rather than a “welcome to…” slogan',
    risk: '一旦观众察觉在被推销就会划走；地域呈现要真实，不美化现实问题', riskEn: 'Once viewers smell a sales pitch they scroll away; portray the place truthfully, not airbrushed',
    kw: ['宣传', '植入', '城市营销', '文旅推广', 'promote', 'soft sell', 'placement', 'destination marketing', 'showcase'],
  },
];
export const VALID_TOURISM_DEVICES = new Set(TOURISM_DEVICES.map((d) => d.id));
const BY_ID = new Map(TOURISM_DEVICES.map((d) => [d.id, d]));

const TOURISM_HINT = ['文旅', '旅游', '旅行', '家乡', '返乡', '地域', '城市宣传', '地方', '古镇', '乡村振兴', '非遗', 'tourism', 'travel', 'hometown', 'return home', 'destination', 'regional drama', 'rural revitalization'];
export function detectTourism(text: string): boolean {
  const t = (text || '').toLowerCase();
  return TOURISM_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickTourismDevices(text: string, n = 3): TourismDevice[] {
  const t = (text || '').toLowerCase();
  const hit = TOURISM_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: TourismDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：地标入戏 + 美食情绪锚 + 剧情优先底线（文旅剧最普适的骨架）
  const fallback = ['landmark_plot', 'food_anchor', 'soft_sell'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  TOURISM_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildTourismDirective(text: string, lang: TourismLang = 'zh', n = 3): string {
  if (!detectTourism(text)) return '';
  const ds = pickTourismDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a TOURISM / REGIONAL drama. Make the place work FOR the story, never turn it into a promo clip. Use these integration devices this episode:\n${body}\nHard rules: story and character first; every landmark/food/heritage element must drive plot or emotion (no B-roll filler, no slogan); portray the region accurately and avoid stereotypes.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为文旅/地域题材，要让地方“为剧情服务”，绝不能拍成城市宣传片。本集重点使用以下融合装置：\n${body}\n硬性要求：人物与剧情优先，每个地标/美食/非遗都必须推动情节或承载情绪（不空镜堆砌、不喊宣传口号）；地域呈现必须真实准确，避免刻板印象与地图炮。`;
}
