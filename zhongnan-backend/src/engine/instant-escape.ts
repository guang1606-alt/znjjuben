import { isSceneHeaderLine } from './script-scenes';
/**
 * 束缚秒脱 / 脱身白给检测（v2.96 块104，创作能力类）
 * ------------------------------------------------------------------
 * 病象：被五花大绑锁进仓库的人，下一拍就自己走出来——绳子不知道
 *   什么时候松的，手铐不知道怎么开的，门不知道怎么出的：
 *     △他把小舟五花大绑，锁进了仓库。
 *     内景 仓库 夜
 *     △小舟从椅子上站起来，活动了一下手腕。
 *     小舟：该反击了。
 * 一次绝境反击是高光，第三次观众就看穿：绳子是纸糊的，锁是道具。
 * 束缚的账要当面算——工具铺垫、当场付费（磨出血/脱臼）、或有人来救。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - instantHack：管电子系统秒破（密码/防火墙/摄像头三下键盘崩塌），
 *    本引擎管物理束缚秒脱（绳/铐/锁/牢房下一拍就失效）；
 *  - plotArmor：管物理控制下的生死免疫（枪口下不死），本引擎管
 *    束缚失效脱身（五花大绑锁不死人）；
 *  - causal-logic-check：管泛巧合/机械降神（事件巧合），本引擎管
 *    同型障碍反复零成本失效的密度病；
 *  - disguise-ledger / impersonation-ledger：管跨集身份连续性，
 *    本引擎管单集内束缚脱身的时机与代价。
 *
 * 判定：
 *  - 束缚锚（五花大绑/绑在椅子上/手铐/脚镣/锁进仓库/囚禁 + tied
 *    up/bound to the chair/handcuffed/locked in/held captive）与
 *    脱身锚（挣脱/绳子松了/磨断/撬开手铐/回形针/从通风口爬出 +
 *    slipped the ropes/picked the lock/freed himself）±2 行共现
 *    → 构成一次"束缚秒脱"事件；双条件缺一不可——纯束缚陈述放行
 *    （囚禁交代本身是戏），纯开锁无束缚放行（正常开门不归本引擎）；
 *  - rescue：①工具铺垫锚（袖中藏发夹/偷了钥匙/早有预谋 + hid a
 *    pin/stole the key/hairpin）——有铺垫的脱身是伏笔回收；
 *    ②挣扎代价锚（磨了半夜/手腕渗血/肩膀脱臼 + ground for hours/
 *    wrists raw/dislocated his thumb）——脱身是疼出来的；
 *    ③外援锚（同伙开门/有人来救/看守放水 + someone unlocked the
 *    door/accomplice freed/cut him loose）——自由是别人给的；
 *  - rescue 扫描包含束缚行与脱身行自身（代价词天然与脱身词同行——
 *    "磨断了绳子，手腕渗出血"），仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的脱身表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次绝境反击是高光），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantEscapeHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有工具铺垫/挣扎代价/外援锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantEscapeResult {
  score: number;
  /** 束缚秒脱事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantEscapeHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 束缚锚：当前被物理束缚（裸"绑了"含"了起"限定，防"绑了马尾"施动语） */
const BIND_ZH = /五花大绑|(?:绑|捆|拴|吊)(?:在|住|上|得|了起)|手铐|脚镣|锁链|被?锁进|被锁在|关进(?:了)?(?:仓库|密室|牢房|地牢|地下室|囚室)|囚禁|被囚/;

const BIND_EN = /\b(?:tied (?:up|to|her|him|his)|bound (?:to|her|him)|roped (?:to|up)|hogtied|handcuff(?:ed|s)|cuffed|shackled|chained (?:to|up)|locked (?:in|up|him|her|them)|locked (?:him|her|them) (?:in|up)|imprisoned|held captive|trussed up|restrained)\b/i;

/* 脱身锚：束缚莫名失效的动作 */
const ESCAPE_ZH = /挣脱(?:了|开)?|挣开(?:了)?束缚|绳子(?:松|断|磨断)了?|磨断(?:了)?绳|解开(?:了)?(?:绳|绑|捆|镣)|松(?:了)?绑|撬开(?:了)?(?:手铐|脚镣|锁)|打开(?:了)?(?:手铐|脚镣)|手铐(?:开了|弹开)|从(?:通风口|气窗|天窗)爬|发夹(?:开锁|撬)|回形针|脱(?:了)?身/;

const ESCAPE_EN = /\b(?:slipped (?:the (?:ropes|knots|cuffs)|out of the (?:ropes|cuffs|knots))|picked (?:the lock|the handcuffs)|freed (?:himself|herself)|got (?:himself|herself) (?:free|loose)|worked (?:the knot|the rope|the pin) loose|untied (?:himself|herself)|broke free|squeezed (?:through|out of) the (?:vent|window)|got the ropes off)\b/i;

/* rescue A：工具铺垫锚——有来路的脱身 */
const TOOL_ZH = /袖中藏|藏在袖|口袋里?(?:的)?(?:回形针|发夹|刀片|别针)|发夹|偷了钥匙|钥匙(?:是)?(?:偷|顺)来|早有预谋|提前(?:松绑|解开|安排好|备好)|藏了(?:把)?(?:钥匙|刀)/;

const TOOL_EN = /\b(?:hid (?:a|the) (?:blade|key|pin)|hairpin|bobby pin|paperclip|stole the keys?|swiped the key|planned (?:this|it) (?:for weeks|ahead)|smuggled in)\b/i;

/* rescue B：挣扎代价锚——脱身当场付费（可与脱身词同行） */
const STRUGGLE_ZH = /磨了[^。！？\n]{0,4}(?:小时|个钟头|半夜|一夜)|磨(?:得)?(?:出血|发烫|冒烟|断裂)|勒出(?:了)?血痕|手腕(?:磨破|渗(?:出)?了?血)|肩膀脱臼|脱(?:了)?臼|指甲(?:抠|掐)得?生疼|疼得[^。！？\n]{0,4}(?:发抖|发晕)|脱了层皮|指尖(?:抠|掐)出血/;

const STRUGGLE_EN = /\b(?:grind(?:ed)? [^.\n]{0,12}for (?:hours|half the night)|hours of (?:grinding|twisting)|dislocat(?:ed|ing) (?:his|her) (?:thumb|shoulder)|wrists? (?:bleeding|rubbed raw|raw)|skin (?:torn|rubbed) (?:off|away)|nearly broke (?:his|her) (?:wrist|thumb))\b/i;

/* rescue C：外援锚——自由是别人给的（防"没有人来救"失败语） */
const AID_ZH = /(?<![没无])有人(?:来救|开门|放了|接应)|同伙(?:开门|来救|赶到|放(?:了)?)|狱卒(?:放水|被收买)|看守(?:被收买|放水|放了)|替[^。！？\n]{0,4}(?:解开|松绑|撬开)|帮[^。！？\n]{0,4}(?:解开|松绑)/;

const AID_EN = /\b(?:someone (?:unlocked the (?:door|cell)|came to (?:free|rescue)|let (?:him|her) out)|accomplice (?:opened|freed|unlocked)|guard (?:was bribed|looked away)|cut (?:him|her) loose|freed (?:him|her) from outside)\b/i;

/**
 * 纯函数：检测"束缚下一拍就失效"式脱身白给的密度病。
 */
export function instantEscape(draft: string): InstantEscapeResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const bindRe = zh ? BIND_ZH : BIND_EN;
  const escRe = zh ? ESCAPE_ZH : ESCAPE_EN;
  const toolRe = zh ? TOOL_ZH : TOOL_EN;
  const strRe = zh ? STRUGGLE_ZH : STRUGGLE_EN;
  const aidRe = zh ? AID_ZH : AID_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasBind: boolean[] = new Array(rawLines.length).fill(false);
  const hasEscape: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasBind[i] = bindRe.test(line);
    hasEscape[i] = escRe.test(line);
  });

  /* pass2：脱身行与 ±2 行内的束缚配对成事件（相邻 ≤2 行脱身行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasEscape[i]) return;
    const m = raw.match(escRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的脱身表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasBind[j],
    );
    if (win.length === 0) return; /* 纯开锁无束缚放行（正常开门不归本引擎） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（工具铺垫/挣扎代价/外援三路；窗口含束缚行与
     脱身行自身——代价词天然与脱身词同行，仅跳过场景头行） */
  const hits: InstantEscapeHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次绝境反击是高光） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = toolRe.test(win) || strRe.test(win) || aidRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"束缚秒脱"——五花大绑锁进密室的人下一拍就自己走出来，绳子是纸糊的、锁是道具，束缚成了编剧的开关'
        : 'instant-escape again - the man bound hand and foot walks out a beat later; the ropes are paper and the lock is a prop, restraint is a switch the writer flips',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"束缚秒脱"式脱身白给（${n} 处未救）——被五花大绑锁进密室的人当剧情需要时就能自己走出来，一次是绝境反击，第三次观众就看穿绳子是纸糊的、锁是道具。`
      : `${hitCount} instant-escape beats (${n} unrescued) - the bound captive walks free whenever the plot needs it. Once is a desperate counter; by the third, the ropes are paper and the lock is a prop.`);
    advice.push(zh
      ? '束缚的账要当面算清，不在绑得紧不紧，而在脱身这一下有没有来路。给每次"束缚秒脱"补一道门槛：要么有工具铺垫（袖中藏的发夹、偷来的钥匙、进门前就松过一扣的绳结——观众回想起那一幕才叫伏笔回收）、要么当场付费（磨了半夜、手腕渗血、肩膀脱臼——脱身是疼出来的，不是等出来的）、要么有人外援（同伙开门、看守放水、老狱卒睁一只眼——自由是别人递进来的）、要么干脆写"脱不了"（挣了三次绳结纹丝不动，只能等外面递刀——不是每次绝境都配奇迹）。更高级的写法是让束缚变成信息：她发现绳子是特种兵打的结，解不开但记住了手法——束缚不是被跳过的障碍，是给对手立人设的牌。如果剧情必须一次脱身，把它留给唯一一次，并让这次脱身的来路在前面至少埋过一行。'
      : 'Restraint keeps honest books - what matters is not how tight the ropes are, but whether the escape has a source. Toll every instant get-away: a planted tool (the hairpin up her sleeve, the stolen key, the knot loosened a notch before he left - a payoff the audience can trace), a price paid on the spot (hours of grinding, wrists rubbed raw, a dislocated thumb - freedom hurts or it reads free), outside help (an accomplice unlocking the door, a bribed guard - liberation delivered by another hand), or write the failure (three tries and the knots hold - not every corner earns a miracle). If one escape is essential, spend it once, and plant its source at least a line earlier.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
