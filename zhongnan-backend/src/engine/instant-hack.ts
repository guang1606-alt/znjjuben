import { isSceneHeaderLine } from './script-scenes';
/**
 * 黑客秒破 / 技术蒙太奇检测（v2.90 块98，创作能力类）
 * ------------------------------------------------------------------
 * 病象：主角键盘敲三下就黑进公安内网、一根数据线攻破国防防火墙、
 *   三秒破解银行加密——高安全系统零成本零失败地崩塌：
 *     △苏晚十指翻飞，屏幕上一行行代码刷过。
 *     苏晚：进了。公安内网，不过如此。
 * 一次秒破是爽点，第二次观众开始眯眼，第三次观众直接看穿：全剧
 * 的安保系统都是纸糊的，只有剧情需要时才亮红灯。技术戏的张力来
 * 自成本与风险——设备、时间、失败重试、被反追踪的代价；把这些
 * 全部跳过，等于告诉观众"紧张感是作者的口嗨"。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - instantDeduction：管"看一眼破案"的零成本推理（人脑破案），
 *    本引擎管零成本技术突破（电脑破防）——一个罚脑子开挂，一个
 *    罚键盘开挂；
 *  - recordsOnDemand：管合法查档"一查必中"（调档案/翻监控零阻
 *    力），本引擎管非法入侵"一黑就进"——一个走流程白给，一个
 *    绕流程白给；
 *  - plotArmor：管物理安保放水（守卫恰好睡着/摄像头恰好坏了），
 *    本引擎管电子安保放水（防火墙/加密/权限验证形同虚设）；
 *  - cheatRuleCheck：管金手指本身的代价设定，本引擎不问外挂，
 *    只罚"高安全目标×秒破"的密度。
 *
 * 判定：
 *  - 入侵动作锚（黑进/入侵/攻破/破解/绕过防火墙/盗取数据 + hack
 *    into/bypass the firewall/cracked the password…）与高安全目
 *    标锚（公安/银行/国防/军事/卫星/内网/数据库/防火墙/加密 +
 *    police database/federal/military/mainframe/firewall…）同句
 *    或 ±2 行窗口共现 → 构成一次"秒破"事件；双条件缺一不可——
 *    纯入侵动作无高安全目标放行（黑同事邮箱/蹭邻居家 WiFi 是生
 *    活戏），纯安保陈述无入侵动作放行（"防火墙固若金汤"）；
 *  - rescue：①成本锚（试了一夜/失败了三次/花了几个月/专业设备/
 *    组团协作 + took all night/failed dozens of times）——技术
 *    戏有真实的重量；②内应锚（内鬼给的权限/买来的账号/有人开门
 *    + insider/someone gave access/bought the credentials）——
 *    不是纯技术突破，是人的漏洞，反而更有戏；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过入侵行与目标行
 *    自身；
 *  - 相邻 ≤2 行的入侵表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次秒破是类型惯例/人设标签），第 2 次起每次
 *    1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantHackHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有成本锚/内应锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantHackResult {
  score: number;
  /** 秒破事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantHackHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 入侵动作锚：键盘成了万能钥匙 */
const HACK_ZH = /黑进|入侵|攻入|侵入|攻破|破解|破译|秒破|盗号|黑掉了|绕过(?:了)?防火墙|盗取(?:了)?数据|拿下(?:了)?(?:系统|后台|服务器)|入侵成功/;

const HACK_EN = /\b(?:hack(?:ed|s)? into|bypass(?:ed|es)? (?:the )?(?:firewall|security)|crack(?:ed)? (?:the )?(?:password|passcode|encryption|firewall)|breach(?:ed)? (?:the )?(?:system|network|firewall)|infiltrat(?:e|ed) (?:the )?(?:system|network|mainframe)|broke into (?:the )?(?:system|server|mainframe))\b/i;

/* 高安全目标锚：安保系统形同虚设的重灾区 */
const SECURE_ZH = /公安|刑侦|警队|警察局|派出所|经侦|银行|金库|国防|军事|军方|卫星|监控中心|天网|内网|数据库|中央系统|防火墙|加密系统|安检系统|档案系统|海关|移民局|情报局|国安局/;

const SECURE_EN = /\b(?:police (?:database|system|network|server)|federal|military|pentagon|bank(?:ing)? (?:system|network|server|mainframe)|treasury|satellite|surveillance (?:system|network)|cctv network|mainframe|firewall|encryption|security system|internal network|classified (?:database|system|network)|nsa|cia database|fbi (?:database|system))\b/i;

/* rescue A：成本锚——技术戏有真实的重量 */
const COST_ZH = /花了[^。！？\n]{0,4}(?:个月|周|天|夜)|试了[^。！？\n]{0,4}(?:次|遍|夜)|失败[^。！？\n]{0,4}(?:次|遍)|折腾了|熬了[^。！？\n]{0,4}夜|通宵|专业设备|整套装备|组团|联手|配合[^。！？\n]{0,4}才|换了好几台/;

const COST_EN = /\b(?:took (?:me |him |her |us )?(?:months|weeks|days|all night)|failed \w+ times|dozens of (?:attempts|tries)|after (?:several|multiple|countless) attempts|tried for (?:hours|days|weeks)|all night|needed (?:specialized |pro |serious )?equipment|spent (?:days|weeks|hours)|worked (?:together|as a team)|finally got (?:in|through) after)\b/i;

/* rescue B：内应锚——不是技术突破，是人的漏洞 */
const INSIDER_ZH = /内鬼|内应|内部人员|有人给(?:了)?(?:我|他|她|我们)?(?:权限|密码|账号|门禁卡)|拿到(?:了)?(?:权限|密码|账号|门禁卡)|买来的?(?:账号|密码|权限)|偷来的?(?:密码|账号|权限)|有人开门|有人带路|走了后门/;

const INSIDER_EN = /\b(?:insider|inside (?:man|job|help)|someone (?:on the inside|gave (?:us|me|him|her) access|handed (?:over|it) to)|bought the credentials|stole the (?:password|credentials|keycard)|already had the (?:password|access|credentials)|got the (?:password|access code|keycard) from|someone opened the door|walked (?:him|her) through|paid off (?:a |an )?(?:guard|employee|insider))\b/i;

/**
 * 纯函数：检测"键盘敲三下黑进公安内网"式黑客秒破的密度病。
 */
export function instantHack(draft: string): InstantHackResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const hackRe = zh ? HACK_ZH : HACK_EN;
  const secureRe = zh ? SECURE_ZH : SECURE_EN;
  const costRe = zh ? COST_ZH : COST_EN;
  const insiderRe = zh ? INSIDER_ZH : INSIDER_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasH: boolean[] = new Array(rawLines.length).fill(false);
  const hasS: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasH[i] = hackRe.test(line);
    hasS[i] = secureRe.test(line);
  });

  /* pass2：入侵动作行与 ±2 行内的高安全目标配对成事件（相邻 ≤2 行入侵行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasH[i]) return;
    const m = raw.match(hackRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的入侵表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasS[j],
    );
    if (win.length === 0) return; /* 纯入侵动作/无高安全目标放行 */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（成本锚/内应锚；跳过入侵行与目标行自身） */
  const hits: InstantHackHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次秒破是爽点） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasH[j] || hasS[j]) continue; /* 入侵行与目标行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = costRe.test(win) || insiderRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"三秒黑客"——高安全系统零成本零失败攻破，键盘敲三下就进，等于告诉观众安保是纸糊的'
        : 'instant hack again - a high-security system falls to three keystrokes with zero cost, zero failure',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"黑客秒破"式技术蒙太奇（${n} 处未救）——入侵高安全系统零成本零失败，一次是爽点，第三次观众就看穿全剧安保形同虚设。`
      : `${hitCount} instant-hack beats (${n} unrescued) - high-security systems keep falling to a few keystrokes. Once is a flex; by the third, every lock in the story is made of paper.`);
    advice.push(zh
      ? '技术戏的张力来自成本与风险，不在敲键盘的速度。给每次入侵补一道门槛：要么有设备（改用信号截获车、定制固件、机房里接了根物理线——专业感本身就是戏）、要么有过程（试了一夜、失败了三次、第六次才进去——失败让成功有重量）、要么有内应（权限是内鬼给的、账号是买来的——技术突破变成人性漏洞，反而更有戏）、要么有代价（进去了，但日志记下了他的 IP，反追踪已经在路上——每次胜利都埋着下一场危机）。更高级的写法是"反秒破"：他黑公安内网三天没进展，最后是从退休网警的旧密码登进去的——最结实的墙永远是人。如果剧情确实需要一次爽快的秒破，让它留给全场唯一一次，并且给对手一句"不可能，我们的加密是军工级"——观众要的不是合理性说明书，是有人在替他们惊讶。'
      : 'Hacking scenes get their tension from cost and risk, not from typing speed. Give every breach a toll: equipment (a signal-interception van, custom firmware, a physical line spliced in the server room - the professionalism itself is drama), process (a night of trial and error, three failures, success on the sixth try - failure gives success weight), an inside angle (the credentials came from a mole, the account was bought - a technical breach becomes a human one, which is better drama), or a price (he got in, but the logs captured his IP and the trace-back is already running - every win plants the next crisis). Better still, invert the hack: he spends three days against the police network and gets nowhere, until he gets in through a retired cyber-cop\'s old password - the strongest wall is always a person. If the plot truly needs one breezy breach, save it for the single moment and let the opponent say "impossible - our encryption is military grade" - the audience does not want a plausibility manual, they want someone on screen to be as surprised as they are.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
