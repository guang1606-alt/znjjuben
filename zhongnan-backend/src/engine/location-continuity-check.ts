import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.146 空间位移连续性检测（PRD 2.1.43——人物不能像量子一样在城市与房间之间跃迁）
 * ------------------------------------------------------------------
 * 竖屏短剧赶节奏赶出来的空间硬伤：
 *  - 上一场场标还在北京国贸办公室，下一场直接"上海某酒店"，两场之间没有飞机高铁、
 *    没有"次日/三天后"，人物零耗时跨城（跨城瞬移，观众：他怎么到的？）；
 *  - 同一场里，前一行她"躺在家里的床上"，隔两行没有任何出门/到达动作，
 *    就"推开会议室的门冲了进去"（同场房间瞬移，场记的景别全乱）；
 *  - 场标写"内景 林家卧室 夜"，正文却"她走在雨中的大街上仰望星空"（内外景矛盾）。
 * 本引擎专管**单稿内空间位移的交代是否存在**，行级/场标级触发，不需要 cast，无题材门控
 * （无地点信号即满分放行；场标自带交通/时间交代一律豁免）。
 *
 * 分工（近邻引擎边界）：
 *  - scene-header-convention：场标格式（缺地点/标题重复/格式错误），不管跨场语义
 *  - timeline-consistency(v2.138)：时钟（倒计时/昼夜/跳时），不管地理位置
 *  - continuity-supervision(v2.139)：镜头间物理状态（伤势/束缚/手机/道具），不管人在哪
 *  - scene-padding-check：同场注水（空间不变但没信息），本引擎管空间非法变化
 *
 * 三类问题：
 *  1) instant_travel     相邻两场场标分属不同城市/国家，窗口（前场末3行+后场前3行+两场标）
 *                                   零交通交代、零时间跳变 → 1 次 mid，第 2 次 high
 *  2) location_jump      同一场内两个互斥场所强锚点（家↔办公室/医院↔餐厅…）行距≤6，
 *                                   中间无任何离开/到达/转场词 → 1 次 low，第 2 次起 mid
 *  3) set_conflict       场标声明内景，正文却身处室外（淋雨/大街/星空），或反之 → low
 *
 * 正信号：fairTravel（跨城但给了飞机高铁/时间跳变）+2/对 cap4；
 *         transition（锚点行间出现明确离开/到达/转场词）+1/次 cap3。
 */

export type LcLang = 'zh' | 'en';

export interface LocationContinuityIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'instant_travel' | 'location_jump' | 'set_conflict';
  evidence: string;
  advice: string;
  scene: number;
  key: string;
}

export interface LocationContinuitySceneReport {
  index: number;
  header: string;
  flagCount: number;
}

export interface LocationContinuityResult {
  score: number;
  sceneCount: number;
  signalCount: number;
  issueCount: number;
  /** 场标带城市/国家名的场数 */
  citySceneCount: number;
  /** 相邻跨城/跨国场对总数 */
  travelPairCount: number;
  /** 其中给了交通/时间交代的场对数（正信号） */
  fairTravelCount: number;
  /** 正文场所强锚点行数（家/办公室/医院/学校…） */
  locationAnchorCount: number;
  /** 同场无转场场所切换的矛盾场次数（=问题②实际发生数） */
  jumpCount: number;
  /** 锚点行之间出现合法转场词的次数（正信号） */
  transitionCount: number;
  /** 带内景/外景声明的场数 */
  intExtSceneCount: number;
  /** 内外景与正文矛盾场次数（=问题③实际发生数） */
  conflictCount: number;
  /** 跨城瞬移条数（=问题①实际发生数） */
  instantTravelCount: number;
  /** 同场瞬移条数（=问题②实际发生数，同 jumpCount） */
  locationJumpCount: number;
  /** 内外景矛盾条数（=问题③实际发生数，同 conflictCount） */
  setConflictCount: number;
  scenes: LocationContinuitySceneReport[];
  issues: LocationContinuityIssue[];
}

// —— 场景切分（复用 v2.132/v2.138/v2.139 标题约定，英文版兼容 chapter/sequence）——

// —— 内/外景声明 ——
const DECL_ZH = /(内景|外景|室内|室外)/;
const DECL_EN = /\b(interior|exterior|int|ext)\b/i;

// —— 场标时间跳变（时间跳了，位移天然合法）——
const TIME_JUMP_ZH = /次日|第二天|隔日|三(?:天|日)后|几(?:天|日)后|数(?:天|日)后|[一二三四五六七八九十两\d]+个?月后|一周后|数周后|半年后|一年后|多年后|翌日/;
const TIME_JUMP_EN = /\b(?:the next day|the following day|that night|days later|three days later|a week later|weeks later|months later|half a year later|a year later|years later)\b/i;

// —— 在场途中（场标自带交通工具，直接豁免该场的跨城对）——
const IN_TRANSIT_ZH = /飞机上|飞机内|航班(?:上|中)?|机舱|高铁上|动车上|火车上|长途汽车(?:上|里)?|车里|车上|途[中经]/;
const IN_TRANSIT_EN = /\b(?:on the plane|in flight|on the flight|on the train|on the bus|in the car|on the road|en route)\b/i;

// —— 交通桥接（前场末/后场初的正文交代）——
const BRIDGE_ZH = /飞机|航班|飞(?:往|赴|到|抵|回|去)|坐飞|搭乘|订了?机票|登机|落地(?!窗)|转机|机场|高铁|动车|火车|长途汽车|自驾|驱车|车程|开了?\d+\s*个?多?小时|坐了?\d+\s*个?多?小时|十几个?小时|连夜(?:赶|飞)?|连夜赶|赶(?:赴|往|到|去|回)|抵(?:达|京|沪|穗|深)?|到达|抵达|坐最晚(?:一)?班|红眼航班/;
const BRIDGE_EN = /\b(?:by plane|by air|flight|flew to|flew out|took a flight|boarded|landing|landed in|at the airport|high-speed train|train ride|took the train|by train|drove(?: for)? \d+ hours|hours by (?:car|train)|rushed to the airport|red-eye|en route|arrived at|arrived in)\b/i;

// —— 城市/国家词表（高区分度全称，避免裸简称误伤）——
const CITIES_ZH = ['北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '南京', '武汉', '西安', '天津', '苏州', '长沙', '郑州', '青岛', '沈阳', '哈尔滨', '昆明', '大连', '厦门', '香港', '台北', '澳门', '纽约', '洛杉矶', '伦敦', '巴黎', '东京', '首尔', '美国', '英国', '法国', '日本', '韩国', '德国', '加拿大', '澳大利亚', '国外', '海外'];
const CITIES_EN = ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Chongqing', 'Hangzhou', 'Nanjing', 'Wuhan', "Xi'an", 'Tianjin', 'Suzhou', 'Changsha', 'Zhengzhou', 'Qingdao', 'Shenyang', 'Harbin', 'Kunming', 'Dalian', 'Xiamen', 'Hong Kong', 'Taipei', 'Macau', 'New York', 'Los Angeles', 'London', 'Paris', 'Tokyo', 'Seoul', 'America', 'the US', 'the UK', 'Britain', 'France', 'Japan', 'Korea', 'Germany', 'Canada', 'Australia', 'abroad', 'overseas'];

// —— 正文行内转场词（锚点行自带即合法空间切换）——
const TRANS_ZH = /离开|走出|出去|出门|下楼|上车|下车|打车|坐上|赶往|赶到|赶去|赶赴|抵达|到达|来到|来至|进了|走进|走入|步入|踏进|跨进|推门(?:而)?(?:入|进)|跑进|冲进|奔进|奔向|前往|转(?:场|到|镜|切)|画面(?:一)?(?:转|切)|镜头(?:一)?(?:转|切)|切到|回到|赶回/;
const TRANS_EN = /\b(?:left|leaving|walked out|got into|got out of|hopped in|rushed to|hurried to|drove to|drove back|arrived at|arrived in|reached|entered|headed to|made (?:his|her) way to|cut to|scene cuts|returned to|went back to|got back to)\b/i;

// —— 正文场所强锚点（同场瞬移检测；同一行命中的多个类都登记）——
const HOME_ZH = /家(?:里|中)?|卧室|客厅|厨房|公寓(?:里|中)?|别墅(?:里|中)?|书房|浴室|被窝|阳台|(?<!病)床(?:上|铺)?|大床|沙发(?:上)?/;
const HOME_NEG_ZH = /家门口|家门外|楼下|小区/;
const OFFICE_ZH = /办公室|会议室|总裁办|工位|写字楼|公司(?:里|大楼|前台|内)?/;
const OFFICE_NEG_ZH = /公司门口|公司门外|大楼门口/;
const HOSPITAL_ZH = /医院(?:里|大楼)?|病房|手术室|急诊(?:室|科|大厅)?|抢救室|护士站|ICU|诊室|挂号(?:处|厅)|病床/;
const HOSPITAL_NEG_ZH = /医院门口|医院大门/;
const SCHOOL_ZH = /学校(?:里)?|教室|操场|校园|教学楼|图书馆/;
const SCHOOL_NEG_ZH = /学校门口|校门口/;
const DINING_ZH = /餐厅|饭馆|饭店(?:里)?|包间|咖啡厅|咖啡馆|奶茶店|火锅店|酒吧|西餐厅|料理店/;
const STREET_ZH = /大街(?:上)?|街上|马路(?:边|上|旁)?|路边|人行道|巷子(?:里|口)?|十字街|广场(?:上)?|街头/;
const VEHICLE_ZH = /车(?:里|内|上)|副驾(?:驶座|座位)?|后座|出租车(?:里|上)?|公交车?(?:里|上)?|地铁车厢/;
const HOTEL_ZH = /酒店(?:里|大堂|房间|客房)?|宾馆|旅馆(?:里)?/;
const STATION_ZH = /机场(?:里|大厅|航站楼)?|高铁站?|火车站(?:里)?|候车厅|航站楼|登机口/;
const POLICE_ZH = /警局|派出所|审讯室|拘留所|看守所/;

const HOME_EN = /\b(?:at home|in bed|bedroom|living room|kitchen|apartment|villa|bathroom|under the covers|balcony|on the couch|on the sofa|his bed|her bed|my bed)\b/i;
const OFFICE_EN = /\b(?:office|conference room|meeting room|cubicle|workplace|headquarters|boardroom)\b/i;
const HOSPITAL_EN = /\b(?:hospital|ward|operating room|ER|emergency room|ICU|clinic|patient bed|hospital bed)\b/i;
const SCHOOL_EN = /\b(?:school|classroom|playground|campus|library|lecture hall)\b/i;
const DINING_EN = /\b(?:restaurant|cafe|coffee shop|diner|eatery|pub|private dining room)\b/i;
const STREET_EN = /\b(?:street|on the road|roadside|sidewalk|alley|plaza|on the curb)\b/i;
const VEHICLE_EN = /\b(?:in the car|in his car|in her car|backseat|passenger seat|in a taxi|in the cab|on the bus|subway car)\b/i;
const HOTEL_EN = /\b(?:hotel|motel|hotel room|hotel suite)\b/i;
const STATION_EN = /\b(?:airport|terminal|boarding gate|train station|station platform)\b/i;
const POLICE_EN = /\b(?:police station|precinct|interrogation room|holding cell)\b/i;

// —— 内外景矛盾的强身处动作（必须是"人在室外/室内"，隔窗观望不算）——
const OUTDOOR_ZH = /淋(?:着)?雨|在雨中|站在雨里|雨里(?:跑|奔|站|走)|走在(?:大街|马路|街头|雨中)|漫步(?:在)?(?:街头|雨中)|抬头望(?:着)?(?:星空|繁星|月亮|满月)|仰望星空|站在(?:天台|楼顶|屋顶|山顶|海边|沙滩|操场|广场)|在(?:院子|操场|广场|沙滩)(?:上)?(?:跑|奔|走|跳)|晒着?太阳|吹着?海风/;
const OUTDOOR_NEG_ZH = /窗外|隔着窗|透过窗|玻璃窗|玻璃后/;
const INDOOR_ZH = /躺(?:在|到)?(?:床|沙发|被窝)|钻进被窝|在浴室(?:洗澡|淋浴)?|浴缸(?:里)?(?:泡)?|打开冰箱|上了床|躺上床|钻进被子/;
const OUTDOOR_EN = /\b(?:in the rain|soaked by rain|walking in the rain|walking down the street|gazed up at the stars|under the stars|on the rooftop|on the beach|sunbathing|in the courtyard)\b/i;
const OUTDOOR_NEG_EN = /\b(?:through the window|from the window|behind the glass)\b/i;
const INDOOR_EN = /\b(?:lay in bed|lay on the couch|got into bed|in the shower|in the bathtub|opened the fridge|climbed into bed)\b/i;

interface LineRow {
  line: number;
  scene: number;
  text: string;
}

interface SceneBlock {
  index: number;
  header: string;
  decl: 'int' | 'ext' | null;
  city: string;
  inTransit: boolean;
  rows: LineRow[];
  report: LocationContinuitySceneReport;
}

interface LocationRule {
  key: string;
  re: RegExp;
  neg?: RegExp;
}

export function locationContinuityCheck(text: string, lang: LcLang = 'zh'): LocationContinuityResult {
  const isZh = lang === 'zh';
  const TIME_JUMP = isZh ? TIME_JUMP_ZH : TIME_JUMP_EN;
  const IN_TRANSIT = isZh ? IN_TRANSIT_ZH : IN_TRANSIT_EN;
  const BRIDGE = isZh ? BRIDGE_ZH : BRIDGE_EN;
  const TRANS = isZh ? TRANS_ZH : TRANS_EN;
  const OUTDOOR = isZh ? OUTDOOR_ZH : OUTDOOR_EN;
  const OUTDOOR_NEG = isZh ? OUTDOOR_NEG_ZH : OUTDOOR_NEG_EN;
  const INDOOR = isZh ? INDOOR_ZH : INDOOR_EN;
  const CITY_TABLE = isZh ? CITIES_ZH : CITIES_EN;

  const empty: LocationContinuityResult = {
    score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
    citySceneCount: 0, travelPairCount: 0, fairTravelCount: 0,
    locationAnchorCount: 0, jumpCount: 0, transitionCount: 0,
    intExtSceneCount: 0, conflictCount: 0,
    instantTravelCount: 0, locationJumpCount: 0, setConflictCount: 0,
    scenes: [], issues: [],
  };

  const clean = (text ?? '').replace(/\r\n?/g, '\n');
  if (!clean.trim() || clean.trim().length < 20) return empty;

  const rules: LocationRule[] = isZh
    ? [
        { key: 'home', re: HOME_ZH, neg: HOME_NEG_ZH },
        { key: 'office', re: OFFICE_ZH, neg: OFFICE_NEG_ZH },
        { key: 'hospital', re: HOSPITAL_ZH, neg: HOSPITAL_NEG_ZH },
        { key: 'school', re: SCHOOL_ZH, neg: SCHOOL_NEG_ZH },
        { key: 'dining', re: DINING_ZH },
        { key: 'street', re: STREET_ZH },
        { key: 'vehicle', re: VEHICLE_ZH },
        { key: 'hotel', re: HOTEL_ZH },
        { key: 'station', re: STATION_ZH },
        { key: 'police', re: POLICE_ZH },
      ]
    : [
        { key: 'home', re: HOME_EN },
        { key: 'office', re: OFFICE_EN },
        { key: 'hospital', re: HOSPITAL_EN },
        { key: 'school', re: SCHOOL_EN },
        { key: 'dining', re: DINING_EN },
        { key: 'street', re: STREET_EN },
        { key: 'vehicle', re: VEHICLE_EN },
        { key: 'hotel', re: HOTEL_EN },
        { key: 'station', re: STATION_EN },
        { key: 'police', re: POLICE_EN },
      ];

  /** 取一行命中的场所类（可多类；否定词撤掉对应室内类） */
  const pickKinds = (t: string): string[] => {
    const ks: string[] = [];
    for (const r of rules) {
      if (r.re.test(t) && !(r.neg && r.neg.test(t))) ks.push(r.key);
    }
    return ks;
  };

  /** 从场标文本提取城市/国家键（取第一个；跨国长串在前由词表顺序保证） */
  const pickCity = (header: string): string => {
    for (const c of CITY_TABLE) {
      if (isZh) {
        if (header.includes(c)) return c;
      } else if (new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(header)) return c;
    }
    return '';
  };

  // ---------- 切场 ----------
  const blocks: SceneBlock[] = [];
  let cur: SceneBlock | null = null;
  let globalLine = 0;
  let headerSeen = false;
  const pushBlock = (header: string) => {
    const h = header.trim().slice(0, 24) || `S${blocks.length + 1}`;
    let decl: 'int' | 'ext' | null = null;
    const dm = isZh ? h.match(DECL_ZH) : h.match(DECL_EN);
    if (dm) {
      const d = isZh ? dm[1] : dm[1].toLowerCase();
      decl = (d === '内景' || d === '室内' || d === 'int' || d === 'interior') ? 'int' : 'ext';
    }
    cur = {
      index: blocks.length + 1,
      header: h,
      decl,
      city: pickCity(header),
      inTransit: IN_TRANSIT.test(header),
      rows: [],
      report: { index: blocks.length + 1, header: h, flagCount: 0 },
    };
    blocks.push(cur);
  };
  clean.split('\n').forEach((raw) => {
    const t = raw.trim();
    if (isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      pushBlock(t);
      headerSeen = true;
      return;
    }
    if (!headerSeen && blocks.length === 0) {
      pushBlock(isZh ? '开场' : 'Opening');
      headerSeen = true;
    }
    if (t && cur) {
      globalLine += 1;
      cur.rows.push({ line: globalLine, scene: cur.index, text: t });
    }
  });
  if (blocks.length === 0) pushBlock(isZh ? '开场' : 'Opening');

  const issues: LocationContinuityIssue[] = [];
  const adviceMap = {
    travel: {
      zh: '跨城瞬移：相邻两场的城市/国家不同，中间没有任何交通与时间交代，人物零耗时跨城。补半句转场（"她坐最晚一班航班飞赴上海""三小时后，上海虹桥"），或在场标上标明时间跳变（次日/三天后）。',
      en: 'Instant travel: two adjacent scenes are set in different cities/countries with zero travel or time-jump between them. Add a half-line of transit ("she caught the last flight to Shanghai", "three hours later, Hongqiao") or mark a time jump in the scene header.',
    },
    jump: {
      zh: '同场瞬移：这一场里人物身处的房间类型直接跳变（如家里的床→会议室、病房→餐厅），中间没有出门、到达、转场等动作。要么把后半段拆成新场并写清场标，要么补一个离开/到达的动作行。',
      en: 'Location jump inside one scene: the character jumps between incompatible places (bedroom to boardroom, ward to restaurant) with no exit/arrival beat. Either split it into a new headed scene or add a leaving/arriving action line.',
    },
    conflict: {
      zh: '内外景矛盾：场标声明内景，正文里人物却身处室外空间（淋雨/大街/星空），或外景场标里演着上床开冰箱的室内戏。统一场标的内/外景声明与正文动作。',
      en: 'Interior/exterior contradiction: an INT. header has the character outdoors (rain/street/under the stars), or an EXT. header contains indoor-only actions (getting into bed, opening the fridge). Align the header declaration with the action.',
    },
  };

  // ---------- ① 跨城瞬移 ----------
  let travelPairCount = 0;
  let fairTravelCount = 0;
  let instantTravelCount = 0;
  for (let i = 0; i + 1 < blocks.length; i += 1) {
    const a = blocks[i];
    const b = blocks[i + 1];
    if (!a.city || !b.city || a.city === b.city) continue;
    if (a.inTransit || b.inTransit) continue;
    travelPairCount += 1;
    const windowText = [
      a.header, b.header,
      ...a.rows.slice(-3).map((r) => r.text),
      ...b.rows.slice(0, 3).map((r) => r.text),
    ].join('\n');
    const bridged = TIME_JUMP.test(windowText) || BRIDGE.test(windowText);
    if (bridged) {
      fairTravelCount += 1;
      continue;
    }
    instantTravelCount += 1;
    if (instantTravelCount <= 2) {
      issues.push({
        severity: instantTravelCount >= 2 ? 'high' : 'mid',
        type: 'instant_travel',
        evidence: isZh
          ? `第${a.index}场→第${b.index}场：${a.city}→${b.city}，两场无转场交代`
          : `Scene ${a.index} -> ${b.index}: ${a.city} -> ${b.city}, no transit beat`,
        advice: isZh ? adviceMap.travel.zh : adviceMap.travel.en,
        scene: b.index,
        key: `travel_s${b.index}`,
      });
    }
  }

  // ---------- ② 同场房间瞬移 & ③ 内外景矛盾 ----------
  let locationAnchorCount = 0;
  let jumpCount = 0;
  let transitionCount = 0;
  let conflictCount = 0;
  let intExtSceneCount = 0;

  blocks.forEach((blk) => {
    // ② 行级锚点序列：含转场词的锚点行会"重置"空间，其前后异类切换合法
    interface Anchor { line: number; kinds: string[]; isTrans: string | null }
    const anchors: Anchor[] = [];
    blk.rows.forEach((r) => {
      const kinds = pickKinds(r.text);
      if (kinds.length === 0) return;
      locationAnchorCount += 1;
      const isTrans = TRANS.test(r.text) ? r.text : null;
      anchors.push({ line: r.line, kinds, isTrans });
    });
    for (let i = 1; i < anchors.length; i += 1) {
      const prev = anchors[i - 1];
      const curA = anchors[i];
      // 转场动作行（走进/赶到/冲出…）本身即是空间隔断，先于异类判定：
      // 该行常同时挂前后两类场所词（"冲出家门赶到公司"），应视为合法移动
      if (curA.isTrans || prev.isTrans) {
        transitionCount += 1;
        continue;
      }
      // 两类集合无交集才算空间切换；同类/包含（医院→病床）不报
      const switched = curA.kinds.every((k) => !prev.kinds.includes(k));
      if (!switched) continue;
      if (curA.line - prev.line > 6) continue; // 同场间隔足够远，默认中间有省略的调度
      jumpCount += 1;
      if (jumpCount <= 2) {
        const prevRow = blk.rows.find((r) => r.line === prev.line);
        const curRow = blk.rows.find((r) => r.line === curA.line);
        issues.push({
          severity: jumpCount >= 2 ? 'mid' : 'low',
          type: 'location_jump',
          evidence: isZh
            ? `第${blk.index}场：${(prevRow?.text ?? '').slice(0, 22)} → ${(curRow?.text ?? '').slice(0, 22)}`
            : `Scene ${blk.index}: ${(prevRow?.text ?? '').slice(0, 40)} -> ${(curRow?.text ?? '').slice(0, 40)}`,
          advice: isZh ? adviceMap.jump.zh : adviceMap.jump.en,
          scene: blk.index,
          key: `jump_s${blk.index}_${curA.line}`,
        });
      }
      break; // 每场最多报 1 对矛盾
    }

    // ③ 内外景矛盾（仅对带声明的场；隔窗观望豁免，每场最多 1 条）
    if (blk.decl) {
      intExtSceneCount += 1;
      const bad = blk.rows.find((r) => {
        if (blk.decl === 'int') {
          return OUTDOOR.test(r.text) && !OUTDOOR_NEG.test(r.text);
        }
        return INDOOR.test(r.text);
      });
      if (bad) {
        conflictCount += 1;
        if (conflictCount <= 2) {
          issues.push({
            severity: 'low',
            type: 'set_conflict',
            evidence: isZh
              ? `第${blk.index}场（${blk.decl === 'int' ? '内景' : '外景'}）：${bad.text.slice(0, 34)}`
              : `Scene ${blk.index} (${blk.decl === 'int' ? 'INT' : 'EXT'}): ${bad.text.slice(0, 60)}`,
            advice: isZh ? adviceMap.conflict.zh : adviceMap.conflict.en,
            scene: blk.index,
            key: `conflict_s${blk.index}`,
          });
        }
      }
    }
  });

  const citySceneCount = blocks.filter((b) => b.city).length;

  // ---------- 场景旗标 ----------
  issues.forEach((it) => {
    const blk = blocks.find((b) => b.index === it.scene);
    if (blk) blk.report.flagCount += 1;
  });

  // ---------- 排序：high → mid → low，再按场，再按 key ----------
  const sevRank = { high: 0, mid: 1, low: 2 };
  issues.sort((a, b) =>
    (sevRank[a.severity] - sevRank[b.severity]) || a.scene - b.scene || a.key.localeCompare(b.key));

  // ---------- 评分 ----------
  let penalty = 0;
  if (instantTravelCount > 0) penalty += Math.min(12 + (instantTravelCount - 1) * 10, 22);
  if (jumpCount > 0) penalty += jumpCount >= 2 ? 14 : 6;
  if (conflictCount > 0) penalty += Math.min(conflictCount * 5, 10);

  let bonus = 0;
  bonus += Math.min(fairTravelCount * 2, 4);
  bonus += Math.min(transitionCount, 3);

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty + bonus)));
  const signalCount = citySceneCount + locationAnchorCount + intExtSceneCount;

  return {
    score,
    sceneCount: blocks.length,
    signalCount,
    issueCount: issues.length,
    citySceneCount,
    travelPairCount,
    fairTravelCount,
    locationAnchorCount,
    jumpCount,
    transitionCount,
    intExtSceneCount,
    conflictCount,
    instantTravelCount,
    locationJumpCount: jumpCount,
    setConflictCount: conflictCount,
    scenes: blocks.map((b) => b.report),
    issues,
  };
}
