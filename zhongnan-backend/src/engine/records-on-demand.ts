import { isSceneHeaderLine } from './script-scenes';
/**
 * 万能档案检测（v2.80 块88，创作能力类）
 * ------------------------------------------------------------------
 * 病象：查证难写就许愿——主角每次调档案、翻监控、查户籍，
 * 都精确命中当下最需要的那条情报：
 *   △她调了档案——记录显示，三年前他来过这家医院。
 *   △他调取了监控，画面里果然有那辆车。
 *   She pulled the records. "Found it. Right here."
 * 档案库成了编剧的许愿池：没有查空、没有等待、没有审批
 * 阻力，情报随要随有。查证本该是攻防——跑空趟、排期、
 * 权限碰壁、查到的是不想要的东西；一查必中的世界线里，
 * 主角的"调查"只是走到答案前面念出它。单次命中是运气，
 * 全片每次都中就是密度病：观众不再为发现紧张，因为知道
 * 编剧随时会从库里递纸条。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - evidence-chain-check：管翻盘时刻证据出示的铺垫公平性
 *    （出示前必须 plant），本引擎管查证获取过程本身的便利
 *    密度（每次调取都命中、零阻力）；
 *  - instant-deduction：管单场"看一眼就下结论"的结构病，
 *    本引擎管全片"一查就有"的密度病；
 *  - eavesdrop-dump / phone-relay / drunk-truth / villain-
 *    overconfession：管其他免费情报渠道（偷听/电话复读/
 *    酒后吐真言/不打自招），本引擎专管档案库这条渠道；
 *  - causal-logic-check：管泛巧合推进（恰好/碰巧），"一查
 *    必中"是可复用的系统性便利，不是单点巧合。
 *
 * 判定（密度病：前 2 次豁免，第 3 次起每次 1 hit）：
 *  - VERIFY 锚命中（调取/翻/查 + 档案类宾语绑定，防"查水
 *    表"误报；pulled the records / checked the database…），
 *    且 ±2 行窗口内出现命中词（查到了/记录显示/监控拍到/
 *    果然/found it/sure enough…）——纯查询（无命中词）=
 *    查空/纯动作，放行；
 *  - 相邻 2 行内的命中表述视为同一次查询（"调了档案"+
 *    "记录显示"两行），不重复计；跨场景头重置；
 *  - rescue（±2 行）：查空类（没查到/查无此人/被删/一无所
 *    获/no record/deleted…）或等待阻力类（要等/走流程/
 *    排期/三个工作日/it takes days/backlog…）——这次命中
 *    付过代价；
 *  - 计分：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface RecordsOnDemandHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（查空过/等待过/走过流程） */
  rescued: boolean;
  reason: string;
}

export interface RecordsOnDemandResult {
  score: number;
  /** 一查必中总次数（含豁免的前 2 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: RecordsOnDemandHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 查询锚点：调取/调了/翻/查 + 档案类宾语绑定（防"查水表/查作业"误报） */
const VERIFY_ZH = /调(?:(?:取|出|阅)(?:了)?|了)(?:那份|这本|旧的)?(?:档案|监控|录像|记录|病历|户籍|卷宗|通话记录|银行流水|底档|名册|名单)|翻(?:了|出|查)?(?:那份|这本|旧的)?(?:档案|记录|旧账|卷宗|底档|名册)|查了?(?:一下|一遍)?(?:档案|监控|记录|户籍|病历|通话|流水|底档|名册|名单|老底|背景|底细)|查了?(?:他|她|对方)(?:的)?(?:名字|资料|底细|背景|老底)|(?:他的|她的)?名字(?:在)?(?:名单|记录|档案)上/;

const VERIFY_EN = /\b(?:pull(?:ed|ing)?\s+(?:up\s+)?(?:the\s+|his\s+|her\s+)?(?:(?:medical|patient|case|old|court|bank)\s+)?(?:records?|files?|file|footage|tapes?|registry|dossier)|check(?:ed|ing)?\s+(?:the\s+|his\s+|her\s+)?(?:(?:security|medical|court|bank)\s+)?(?:footage|video|records?|database|registry|files?|archives)|ran\s+(?:his|her|the|a)\s+name|search(?:ed|ing)\s+(?:the\s+)?(?:database|records?|archives|system)|went\s+through\s+(?:the\s+|his\s+|her\s+)?(?:(?:medical|patient|case|old|court)\s+)?(?:records?|files?|archives)|look(?:ed)?\s+up\s+(?:his|her|the)\s+(?:record|file|name|number)|request(?:ed)?\s+(?:the\s+)?(?:records?|files?|autopsy)|got\s+(?:the\s+)?(?:records?|files?)\s+from)\b/i;

/* 命中词：查询直接得到所需情报 */
const HIT_ZH = /查到了|找到了|就是(?:这|那)(?:份|条|张|笔|页|个)|果然|记录(?:显示|上写|上记着)|监控(?:拍到|显示|里)|录像(?:里|显示|拍到)|上面(?:写着|显示|记着)|名单上(?:有|写着)|登记(?:显示|着)|就在(?:这|那)(?:里|份|页)/;

const HIT_EN = /\b(?:the\s+(?:record|file|report|log)s?\s+(?:shows?|says?|lists?)|found\s+(?:it|him|her|something|a match)|there\s+it\s+is|the\s+footage\s+(?:shows|caught)|sure\s+enough|got\s+a\s+hit|there'?s\s+a\s+match|right\s+here\s+(?:on|in)\s+(?:the\s+)?(?:list|record|file)|it'?s\s+all\s+there)\b/i;

/* rescue：这次命中付过代价（查空过/等待过/走过流程） */
const RESCUE_ZH = /没查到|查无此人|查无记录|一无所获|什么都没?(?:查|翻|找)到|(?:记录|档案|监控|录像|数据|文件)(?:早)?(?:被|已)?(?:删|销毁|清空|抹掉|覆盖)(?:了|掉|除)?|没(?:有)?(?:任何)?(?:记录|发现|线索)|(?:要|得|需)等(?:上|着)?|走(?:了)?(?:流程|审批)|排期|排队|预约(?:满|不上)?|(?:三|几)(?:个)?工作日|(?:材料|手续)不全|系统(?:维护|升级)|跑(?:了)?(?:好几|三|几)趟/;

const RESCUE_EN = /\b(?:no\s+record|nothing\s+(?:in|on)\s+(?:the\s+)?(?:file|record|system)|comes?\s+up\s+empty|came\s+(?:up|back)\s+empty|not\s+on\s+file|been\s+(?:deleted|wiped|purged|erased)|records?\s+(?:were|was)\s+(?:deleted|destroyed|purged)|wiped\s+clean|draws?\s+a\s+blank|came\s+up\s+with\s+nothing|it(?:'ll|'s going to|\s+will)\s+take\s+(?:days|a while|time|weeks)|have\s+to\s+wait|takes?\s+(?:days|weeks)|waiting\s+(?:list|period)|backlog|processing\s+time|three\s+business\s+days|pending\s+approval|need(?:s)?\s+clearance|clearance|sealed|classified|restricted\s+access|took\s+(?:three|several)\s+trips)\b/i;

/**
 * 纯函数：检测"一查必中"万能档案密度病。
 */
export function recordsOnDemand(draft: string): RecordsOnDemandResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const verifyRe = zh ? VERIFY_ZH : VERIFY_EN;
  const hitRe = zh ? HIT_ZH : HIT_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: RecordsOnDemandHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevEventLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevEventLine = -10; return; }
    const m = line.match(verifyRe);
    if (!m) return;

    /* 命中词检查：±2 行窗口内须出现命中表述，纯查询/查空放行 */
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    /* 场景头不参与命中判定（"内景 档案室"不是查询结果） */
    const win = rawLines.slice(lo, hi + 1).filter((l) => !isSceneHeaderLine(l.trim())).join('\n');
    if (!hitRe.test(win)) return;

    /* 相邻 2 行内的命中表述 = 同一次查询（"调了档案"+"记录显示"），不重复计 */
    if (i - prevEventLine <= 2) { prevEventLine = i; return; }
    prevEventLine = i;

    hitCount += 1;
    if (hitCount >= 3) {
      hits.push({
        line: i + 1,
        sceneIndex: Math.max(0, sceneIdx),
        sceneHeader: header,
        snippet: line.slice(0, 30),
        marker: (m[0] ?? '').slice(0, 28),
        rescued: rescueRe.test(win),
        reason: zh
          ? '又"一查必中"——档案库像编剧的许愿池，每次调取都精确命中所需情报，没有查空、没有等待、没有阻力'
          : 'records on demand again — the archive is the writer\'s vending machine: every lookup lands exactly the needed fact, with no dead end, no wait, no friction',
      });
    }
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"一查必中"（${n} 处未救，前 2 次豁免）——查证密度病：全片每次调档案都直接命中，情报获取零阻力。`
      : `${hitCount} records-on-demand beats (${n} unrescued, first two exempted) — every lookup lands the needed fact; information comes with zero friction.`);
    advice.push(zh
      ? '档案库不是许愿池。让情报付出代价：至少一次查空（调了三个月的监控，唯独案发那晚硬盘坏了），一次等待（档案在市局，走调卷流程要三个工作日——就在这三日里证据被人转移），一次权限碰壁（人事档案不对外，她只能去骗前台）。查证本身就是戏：把"调取档案"从一行动作写成一整场攻防，观众才会信最后拿到的那页纸。偶尔也让查到的东西不是想要的——他查的是转账记录，翻出来的却是弟弟的住院单。'
      : 'The archive is not a vending machine. Make every fact cost something: one dead end (three months of footage, except the hard drive failed on the one night that matters), one wait (the file sits in another county — three business days for the transfer, during which the evidence moves), one locked door (sealed records she can only get by conning the clerk). The lookup itself is the scene: stretch "she pulled the file" from one line into a full sequence, and the audience will believe the page she finally holds. Sometimes let the search return the wrong thing — he pulls the bank statements and finds his brother\'s hospital bill instead.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
