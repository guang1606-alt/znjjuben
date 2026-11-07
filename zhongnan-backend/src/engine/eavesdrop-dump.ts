import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 撞听秘密检测（Eavesdrop-Dump / Convenient Overhearing）
 * ============================================================
 * 治什么病：
 *   主角不长脑子也不长腿——关键真相永远在她"恰好走到门口"的
 *   那一刻，被屋里的人用完整句子免费宣讲：
 *     她走到书房门口，听见父亲压低声音："明天动手，做掉他，
 *     股权转走，亲子鉴定一并烧掉。"
 *   门外的人零布置、零风险、零代价，就拿到了带人名、时间表、
 *   全套手法的密谋套餐；屋里的人明明在害人，嗓门却像开记者会。
 *   一次偷听是戏，次次门口有真相，是作者替主角跑腿。
 *
 * 判定（只扫叙述行；位置帧 + 秘密内容必须同段共现）：
 *  1) 位置帧：门外/门后/拐角/楼梯口/路过… + 听见/传来/说话声
 *     （两个要件必须在同一行的短窗口内，防止"门外下雨了"误判）；
 *  2) 秘密内容：本行（或紧邻下一非空行）含剧情机密词；
 *  3) repeat：首次撞听是合法手法，不罚；第 2 次起 charged；
 *     package：单段机密词 ≥2 类且整段够长（密谋套餐一句话
 *     讲完计划+手法+时间表），单次即 charged——反派把秘密
 *     说成产品说明书，才是这个病最典型的症状。
 *  rescued（偷听有成本或被利用，不算白捡），±2 行窗口内出现：
 *   - 主动布置：屏住呼吸/提前守候/蹑手蹑脚/故意设局/冒险；
 *   - 差点暴露：差点被发现/脚步声逼近/门突然开了/赶紧躲；
 *   - 留证利用：掏出手机录音/按下录音（信息变成她抢的筹码）。
 *
 * 边界（查重后确认）：
 *   - causal-logic 抓"恰好/碰巧/conveniently"副词与尾段巧合解局，
 *     本引擎抓没有巧合词、纯靠调度的"门口完整秘密"结构；
 *   - info-delivery 管设备/广播/信使投喂，并把"偷听"整体豁免
 *     为主动取证——本引擎专抓豁免里的水分：无布置无风险的撞听；
 *   - exposition-dialogue 管两个在场人互相讲已知背景（as you know），
 *     本引擎管说话人不知道有第三者在场。
 *
 * 计分：bad=0 → 100；1 → 78；≥2 → max(25, 100-n*24)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^[一-鿿A-Za-z0-9·]{1,4}(?:（[^）]{0,12}）)?\s*[：:]\s*\S/;

const snippet = (s: string, n = 36): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/* ───────── 位置帧：藏身位 + 听觉动词必须短窗口共现 ───────── */

const FRAME_ZH = /(?:门外|门后|门口|门边|门缝|虚掩(?:着|的)?门|拐角|转角|走廊|楼道|楼梯口|楼梯间|墙根|墙后|柱子后|隔壁|窗外|窗台|阳台)[^。！？\n]{0,14}(?:听见|听到|传来[^。！？\n]{0,6}(?:声音|嗓音|说话|对话|争吵|动静))|(?:听见|听到)[^。！？\n]{0,10}(?:门外|门后|里面|屋里|房里|隔壁|走廊|楼下)|(?:路过|经过|刚走到|走到|走近|踱到|来到|上了?楼|拐过)[^。！？\n]{0,12}(?:书房|卧室|办公室|会议室|房间|病房|包厢|包间|客厅|门口|门边)[^。！？\n]{0,14}(?:听见|听到|传来)/;

const FRAME_EN = /\b(?:outside (?:the |his |her |their )?(?:door|office|room|ward|study)|behind (?:the |his |her |their )?(?:half-?open )?door|through (?:the |a )?(?:half-?open )?door|around the corner|down the hallway|through the wall|outside the window|at the doorway|paused (?:outside|at the door)|stopped outside|held still outside|as (?:she|he) (?:passed|walked by)|(?:walked|hurried|tiptoed) past[^.]{0,24}?(?:and )?heard|overheard through)[^.]{0,40}?\b(?:heard|overheard|voices|sound of voices|saying|came (?:the |a |his |her )?voices?)\b/i;

/* ───────── 机密内容词（按类去重计数） ───────── */

const EVENTS_ZH: RegExp[] = [
  /真相/, /合同|协议/, /遗嘱|遗产/, /股权|股份|转让|转移(?:资产|财产|资金)/,
  /亲子鉴定|孩子不是|不是你的|亲生/, /陷害|嫁祸|栽赃/, /下毒|下药|毒药/,
  /灭口|做掉|除掉|干掉|杀了?他|解决掉/, /绑架|绑走/, /偷情|出轨|私情|奸情/,
  /勾结|串通|合谋|阴谋|密谋/, /计划|阴谋|圈套|陷阱/, /动手|明天.{0,4}(?:动手|行动|解决)|时机|日子就定/,
  /地址|下落|藏身/, /账本|黑账|账目/, /证据|录音|录像|U盘|文件|名单|黑名单/,
  /夺权|篡位|逼宫|架空|上位/, /火灾|放火|那场火|失火/, /车祸|刹车/,
  /身世|亲生女儿|流着.{0,4}血|骨肉/, /撤诉|封口|收买/, /怀孕|孩子是他的/,
];

const EVENTS_EN: RegExp[] = [
  /\btruth\b/i, /\bcontract|agreement\b/i, /\bwill|inheritance\b/i,
  /\bshares|stake|transfer(?:red|ring)? the assets?\b/i, /\bDNA|paternity|not his\b/i,
  /\bframed|frame him|set him up\b/i, /\bpoison(?:ed|ing)?\b/i,
  /\bsilence him|kill him|take him out|eliminate him|get rid of him\b/i,
  /\bkidnap(?:ped)?|abduct(?:ed)?\b/i, /\baffair|cheating|mistress\b/i,
  /\bcollud(?:ed|ing)?|conspired?|conspiracy|plotting\b/i,
  /\bthe plan|trap|tomorrow night|move on him|timing\b/i,
  /\baddress|whereabouts|hideout\b/i, /\bledger|books|black book\b/i,
  /\bevidence|recording|footage|USB|the file|blacklist\b/i,
  /\btake over|force (?:him|her) out|seize control|oust\b/i,
  /\bfire|arson|that fire\b/i, /\bcar crash|brakes\b/i,
  /\breal (?:daughter|identity|father)|biological\b/i,
  /\bdrop the charges|hush money|pay(?:ing)? (?:him|her) off\b/i,
  /\bpregnant|the baby is his\b/i,
];

/* ───────── rescued：偷听有成本或被利用 ───────── */

const RESCUE_ZH = /(?:屏住呼吸|大气(?:也|都)?不敢出|蹑手蹑脚|贴在门上|耳朵贴|提前[^。！？\n]{0,6}(?:守|等|埋伏)|守了?[^。！？\n]{0,4}(?:半天|许久|\d+分钟)|蹲守|埋伏|故意[^。！？\n]{0,6}(?:来|守|听|设)|设(?:了)?局|冒险|冒着[^。！？\n]{0,6}(?:险)|差点(?:被)?发现|险些被|差一点被|赶紧(?:躲|缩|退|闪)|连忙(?:躲|闪|退|藏)|脚步(?:声)?(?:逼近|响起|过来)|门突然|被(?:他|她|里面)?发现|掏出(?:手机)?[^。！？\n]{0,4}(?:录|拍)|按下(?:录音|录制)|偷偷(?:录|拍)|开了?录音)/;

const RESCUE_EN = /\b(?:held her breath|held his breath|didn'?t dare breathe|tiptoed|pressed her ear against the door|pressed his ear|had been waiting (?:outside|for)|staked out|deliberately|set a trap|risked|at the risk of|almost caught|nearly seen|nearly spotted|ducked back|stepped back into the shadows|footsteps (?:approaching|came closer)|the door (?:suddenly )?(?:opened|swung open)|hit record|quietly recorded|pulled out (?:her|his) phone (?:to )?record|started recording)\b/i;

export interface EavesdropHit {
  line: number;
  kind: 'repeat' | 'package';
  snippet: string;
  events: string[];
  charged: boolean;
  rescued: boolean;
  reason: string;
}

export interface EavesdropDumpResult {
  score: number;
  narrationLines: number;
  hits: EavesdropHit[];
  issues: string[];
  advice: string;
}

/** 提取段内命中的机密词类（去重，取正则源码前 10 字做标签） */
function eventHits(segment: string, events: RegExp[]): string[] {
  const found: string[] = [];
  events.forEach((re) => {
    const m = segment.match(re);
    if (m) found.push(m[0].slice(0, 10));
  });
  return [...new Set(found)];
}

export function eavesdropDump(draft: string): EavesdropDumpResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const frameRe = isZh ? FRAME_ZH : FRAME_EN;
  const eventRes = isZh ? EVENTS_ZH : EVENTS_EN;
  const rescueRe = isZh ? RESCUE_ZH : RESCUE_EN;

  const lines = draft.split(/\r?\n/);
  const hits: EavesdropHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line) || SPEAKER_RE.test(line)) return;
    narrationLines++;
    if (!frameRe.test(line)) return;

    // 秘密内容可延续到紧邻下一非空行（画外音对白常放下一拍）
    const parts = [line];
    for (let k = i + 1; k < lines.length; k++) {
      const near = lines[k].trim();
      if (!near) continue;
      if (isSceneHeaderLine(near)) break;
      parts.push(near);
      break;
    }
    const segment = parts.join('\n');
    const events = eventHits(segment, eventRes);
    if (events.length === 0) return;

    const isPackage = events.length >= 2 && (isZh ? stripLen(segment) >= 22 : segment.split(/\s+/).filter(Boolean).length >= 16);
    const charged = isPackage || hits.length >= 1;

    // rescued：±2 行窗口内有布置/风险/留证信号
    let rescued = false;
    for (let k = Math.max(0, i - 2); k <= Math.min(lines.length - 1, i + 2); k++) {
      if (rescueRe.test(lines[k])) { rescued = true; break; }
    }

    hits.push({
      line: i + 1,
      kind: isPackage ? 'package' : 'repeat',
      snippet: snippet(line),
      events,
      charged,
      rescued,
      reason: isZh
        ? '主角零布置零风险走到门口，密谋被人用完整句子免费宣讲（人名/手法/时间表打包送达）'
        : 'the protagonist walks to the door with zero setup or risk and receives a full spoken conspiracy package — names, method, timetable included',
    });
  });

  const bad = hits.filter((h) => h.charged && !h.rescued);
  const n = bad.length;
  const score = n === 0 ? 100 : n === 1 ? 78 : Math.max(25, 100 - n * 24);
  const issues = bad.map((h) => (isZh
    ? `第${h.line}行${h.kind === 'package' ? '【密谋套餐】' : '【撞听】'}「${h.snippet}」——${h.reason}；让真相靠代价到手（提前蹲守/差点被抓/冒险录音），或让密谋者惜字如金，观众只听到半句，剩下的靠主角去诈、去换、去赌`
    : `L${h.line}${h.kind === 'package' ? ' [conspiracy package]' : ' [overhear]'} "${h.snippet}" — ${h.reason}; make the truth cost something (a stakeout, a near-capture, a risky recording), or let the conspirators speak in half-sentences so the protagonist must bluff, trade or gamble for the rest`));
  const advice = isZh
    ? '偷听是最贵的廉价戏。白捡的真相不抓人：要么让主角提前布置、屏住呼吸、差点被发现，信息是她冒险抢来的；要么让屋里的人只说半句黑话，观众和她一起拼不全。更狠的写法——让她听到的是假的，等她据此出手，才发现自己是别人局里的那颗子。'
    : 'The overheard scene is cheap tension bought at full price. A free secret is no secret at all: either make her stake it out, hold her breath, nearly get caught — information taken at risk — or let the conspirators trade half-sentences in code, leaving her and the audience to assemble the rest. Harder still: let her hear the lie dressed as truth, act on it, and discover she was the piece in someone else\'s board game.';

  return { score, narrationLines, hits, issues, advice };
}

const stripLen = (s: string): number => s.replace(/[，。！？、…：；""''（）()【】《》\s,.!?:;'"()\[\]<>\n-]/g, '').length;

/**
 * 前置教学：buildEavesdropDirective(_format='LIVE', lang='zh')
 * -------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 eavesdropDump 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"只扫叙述行 / 位置帧与路径帧同行共现 / 21 类机密词 /
 *       repeat 第 2 次起 / package ≥2 类且够长单次即罚 / ±2 行 rescue / 只算 bad"的口径，
 *       避免写完被 prePolish eavesdropHint 与 craft/deai 复评打回。
 */
export function buildEavesdropDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '[Eavesdrop Dump Pre-Writing Briefing (same source as eavesdropDump: truth must cost something; the first overheard secret is legal, charged from the second, and a single conspiracy package is charged at once)]',
      '- Scope: narration lines only; speaker lines and scene headers are skipped, and narrationLines counts narration lines only.',
      '- Position frame: a hiding spot (outside the door, behind the door, at the doorway, the door gap, the half-open door, around the corner, down the hallway, the stairwell, behind the wall, next door, outside the window, on the balcony) and a hearing verb (heard, overheard, came voices, the sound of voices) must co-occur on the same line within a short window; rain outside the door is not a frame.',
      '- Path frame: walked past, passed by, stopped at, stepped up to plus a room word (study, bedroom, office, meeting room, ward, private room, living room, doorway) plus heard, overheard or came voices, also on the same line only.',
      '- Secret content: the frame line or the immediate next non-empty line before the next scene header must contain a secret term; there are 21 categories — truth, contract, will or inheritance, shares or asset transfer, paternity or not his child, framing, poison, silencing or killing, kidnapping, affair, collusion or conspiracy, plan or trap, timing or move on him, address or hideout, ledger, evidence or recording or USB, seizing control, fire, car crash, real parentage, dropping charges or hush money, pregnancy.',
      '- Repeat rule: the first overheard secret in the whole script is a legitimate device and stays uncharged; from the second hit onward it is charged, based on the running hit count, not the second time in one segment.',
      '- Package rule: two or more secret categories in one segment plus a long enough segment (22 Chinese characters after punctuation is stripped, or 16 English words) is a conspiracy package and is charged on the first occurrence — the villain reading out plan, method and timetable like a product manual is the clearest symptom.',
      '- Charged merge: charged = package or at least one earlier hit; a package is penalized on first sight, a plain overhear only from the second time.',
      '- Rescue window: a setup, risk or recording signal within plus or minus 2 lines uncharges the hit — held her breath, did not dare breathe, tiptoed, pressed her ear against the door, staked out, waited in advance, set a trap, risked it, almost caught, nearly seen, ducked back, footsteps approaching, the door suddenly opened, pulled out her phone to record, hit record, quietly recorded.',
      '- Rescue standard: an overheard secret is a scene only when it costs something — prior setup, near exposure or a risky recording; walking to the door with zero setup and zero risk and receiving the full secret is the disease.',
      '- Bad only: bad = charged and not rescued; rescued hits do not count, and issues lists bad hits only.',
      '- Score: 0 bad = 100; 1 bad = 78; 2 or more = max(25, 100 - n x 24).',
      '- Hit fields: line / kind (repeat or package) / snippet (36 characters) / events (deduplicated category labels) / charged / rescued / reason; narrationLines counts narration lines only.',
      '- Neighbours: causal-logic catches the conveniently and coincidence adverbs plus a coincidence-resolved ending; info-delivery covers devices, broadcasts and messengers and exempts overhearing wholesale as active evidence gathering, while this engine targets the water inside that exemption; exposition-dialogue covers people in the room telling each other known background (as you know), while this engine covers speakers who do not know a third person is listening.',
      '- Pipeline: prePolish emits eavesdropHint, craft first and second passes plus the return field are kept, and the deai weight has been retired since v2.99, so the engine is diagnostic and batch-rescan only.',
      '- Self-check: when the protagonist hears a complete conspiracy the moment she reaches the door, cut the free briefing — make her stake it out, hold her breath, nearly get caught or record at risk, or let the conspirators speak in half-sentences and force her to bluff, trade or gamble for the rest.',
      '- Same frame, event, charged and rescue rules across languages, with separate word lists; this briefing lives in the same file as the detector and is never gated by format.',
    ].join('\n');
  }
  return [
    '[撞听秘密 前置教学（同源 eavesdropDump：真相必须有代价；首次偷听合法，第 2 次起 charged，套餐单次即 charged）]',
    '- 检测范围：只扫叙述行；台词行（话者 + 冒号）与场头跳过，narrationLines 只统计叙述行。',
    '- 位置帧：藏身位（门外/门后/门口/门边/门缝/虚掩的门/拐角/转角/走廊/楼道/楼梯口/楼梯间/墙根/墙后/柱子后/隔壁/窗外/窗台/阳台）与听觉动词（听见/听到/传来…声音）必须同一行短窗口共现；"门外下雨了"不算。',
    '- 路径帧：路过/经过/刚走到/走到/走近/踱到/来到/上了楼/拐过 + 房间词（书房/卧室/办公室/会议室/房间/病房/包厢/包间/客厅/门口/门边）+ 听见/听到/传来，同样只认同一行。',
    '- 秘密内容：位置帧所在行或紧邻下一非空行（遇场头即止）必须含机密词，共 21 类——真相/合同协议/遗嘱遗产/股权转让/亲子鉴定/陷害嫁祸/下毒/灭口/绑架/偷情/勾结合谋/计划陷阱/动手时机/地址下落/账本/证据录音U盘/夺权/火灾/车祸/身世/撤诉封口/怀孕。',
    '- repeat 判定：全片第一次撞听是合法手法，不罚（charged=false）；第 2 次起 charged=true——按 hits 累计，不是同段第 2 次。',
    '- package 判定：单段机密词 ≥2 类且整段够长（中文去标点 ≥22 字 / 英文 ≥16 词）即密谋套餐，单次即 charged——反派把计划+手法+时间表说成产品说明书是最典型症状。',
    '- charged 合并：charged = package 或此前已有 ≥1 条 hit；package 首犯就罚，plain 从第 2 次罚。',
    '- rescued 通道：±2 行窗口内出现布置/风险/留证信号即不扣分——屏住呼吸/大气不敢出/蹑手蹑脚/贴在门上/耳朵贴门/提前守候/蹲守/埋伏/故意设局/冒险/差点被发现/赶紧躲/脚步声逼近/门突然开了/掏出手机录音/按下录音/偷偷录。',
    '- rescue 口径：偷听有成本或被利用才算戏——提前布置、差点暴露、冒险录音三者任一；零布置零风险走到门口就拿到完整秘密，才是病。',
    '- 只算 bad：bad = charged 且未 rescued；rescued 命中不参与扣分，issues 只列 bad。',
    '- 得分：0 次 100；1 次 78；≥2 次 max(25, 100 - n × 24)。',
    '- 命中字段：line / kind（repeat|package）/ snippet（36 字截断）/ events（去重词类标签）/ charged / rescued / reason；narrationLines 只计叙述行。',
    '- 邻居分界：causal-logic 抓"恰好/碰巧/conveniently"副词与尾段巧合解局；info-delivery 管设备/广播/信使投喂并把偷听整体豁免为主动取证，本引擎专抓豁免里的水分；exposition-dialogue 管在场人互讲已知背景（as you know），本引擎管说话人不知道有第三者在场。',
    '- pipeline 消费：prePolish 生成 eavesdropHint，craft 初评/复评与 return 字段保留；deai 加权自 v2.99 起已退役，仅作诊断与批量重扫（creative-batch-rescan eavesdropDump）。',
    '- 成稿自查：主角"走到门口就听见"完整密谋时，删掉免费宣讲——改成提前蹲守、屏息、差点被发现、冒险录音，或让屋里只说半句黑话，剩下靠她去诈去换去赌。',
    '- 中英一致：同一套帧/事件/charged/rescue 规则，中英词表各自独立；教学与检测器同文件同源，format 不门控。',
  ].join('\n');
}

