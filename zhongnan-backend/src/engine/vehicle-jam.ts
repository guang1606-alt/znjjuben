import { isSceneHeaderLine } from './script-scenes';
/**
 * 载具掐点故障 / 车辆阀门检测（v2.125 块133，创作能力类）
 * ------------------------------------------------------------------
 * 病象：车成了编剧的阀门——平时运人载货从没毛病，一到该追该逃
 *   的关键时刻，拧钥匙就是"哒哒哒"打不着，或者半路爆胎抛锚：
 *     △他拉开车门，正要开车追出去。
 *     △他拧动钥匙——发动机打不着火了。
 *     △凶手跑进了小巷。
 * 一次熄火是经典悬念，第三次观众就看穿：车辆失灵是需要的时候
 * 才发生的事故。失灵要有来路（破车/该报废/泡过水）、有当场处理
 * （换备胎/搭电/叫拖车费时间）、或有替代方案（打车/借车/跑步追）。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - trafficOnCue：管外部的路（堵车/红灯/封路/班次刚走），本引擎
 *    管身下的车（打不着火/爆胎/没油/抛锚）——路况是"路不让你走"，
 *    车况是"车走不动"，两套词表正交；
 *  - weaponJam：武器哑火当阀门——"工具失灵当阀门"的镜像兄弟，
 *    本块其权重退役让位；
 *  - commFailCrutch：通讯工具失灵当阀门（打不通/没信号）；
 *  - alwaysLate：抵达时机的错过（晚一步），本引擎管载具本身的
 *    时机性失灵；
 *  - causalLogic：泛巧合单发，本引擎管失灵密度病复用。
 *
 * 判定：
 *  - 失灵锚（打不着火/点不着火/发动不了/突然熄火/爆胎/抛锚/没油/
 *    电瓶亏电/发动机过热/水箱开锅/趴窝/车坏了 + won't start/
 *    flat tire/blowout/out of gas/broke down/overheated…）与关键
 *    场景锚（正要开车追/急着赶/来不及/逃命/追凶/送医/倒计时 +
 *    about to chase/rushing to/no time/on the run/catch the
 *    flight…）±2 行窗口共现 → 构成一次"载具失灵"事件；双条件
 *    缺一不可——纯失灵放行（修车铺交代车况/油表见底去加油是
 *    道具交代），纯赶路无失灵放行（正常赶路不归本引擎）；
 *  - rescue：①来路锚（老爷车/破车/该报废/泡过水/事故车/劣质油 +
 *    old beater/clunker/should've been scrapped/bad gas）——失灵
 *    有物理解释；②处理锚（换备胎/搭电/叫拖车/打车/借车/弃车跑步
 *    追 + changed the tire/jump-started/called a tow/hailed a
 *    cab/abandoned the car）——当场排障费时间或立刻换方案，阀门
 *    没有白掐；
 *  - rescue 扫描包含失灵行自身与事件 ±2 行（来路词天然与失灵词
 *    同行——"这辆破车又抛锚了"），仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的失灵表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次熄火是经典悬念），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface VehicleJamHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有来路/处理锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface VehicleJamResult {
  score: number;
  /** 载具失灵事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: VehicleJamHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 失灵锚：车在关键时刻走不动（打不着/爆胎/抛锚本身即载具语义） */
const FAIL_ZH = /打不着火|点不着火|发动不了|发动不起来|启动不了|(?:突然|当场|半路|偏偏|又)熄火|发动机熄火|爆胎了?|轮胎(?:爆了|没气)|车胎(?:爆了|没气|瘪了)|抛锚了?|没油了?|油箱见底|电瓶(?:没电|亏电|亏了)|发动机(?:过热|冒烟|开锅|坏了)|水箱开锅|趴窝了?|车坏了|车坏在半路/;

const FAIL_EN = /\b(?:(?:the )?(?:car|truck|van) (?:died|stalled|broke down|sputtered|won'?t start|wouldn'?t start|wouldn'?t turn over)|(?:won'?t|wouldn'?t) start|engine (?:won'?t|wouldn'?t) (?:turn over|start)|flat tire|tire (?:blew(?: out)?|is flat|went flat)|blowout|out of (?:gas|fuel)|ran out of (?:gas|fuel)|engine (?:overheated|is smoking)|radiator (?:boiled over|is steaming)|dead battery|battery(?:'s)? dead)\b/i;

/* 关键场景锚：该追没追上/该逃没逃掉的当口（纯失灵无赶路=道具交代放行） */
const CRIT_ZH = /正要(?:开车|发动|追|逃|走)|急着?(?:赶|去|送)|赶(?:去|往|到)|来不及了?|千钧一发|生死一线|最后关头|逃(?:跑|命|离|亡)|追(?:出去|上|捕|击|凶)|送医|送医院|甩掉|摆脱追踪|追兵|追车|飙车|倒计时/;

const CRIT_EN = /\b(?:about to (?:drive|chase|flee|leave|escape|start the car)|need(?:ed)? to (?:get there|be there|catch|hurry)|rushing to|hurrying to|no time (?:left|to spare)|running out of time|in hot pursuit|on the run|get(?:ting)? away|escape|fleeing|racing (?:to|against|the clock)|chasing (?:him|her|them|the (?:suspect|killer|thief))|the chase|catch (?:the |a )?(?:flight|train|ferry)|behind schedule|the getaway)\b/i;

/* rescue A：来路锚——失灵有物理解释 */
const CAUSE_ZH = /老(?:爷)?车|破车|二手车|年久失修|早该报废|该报废了?|该换(?:的)?车|泡过水|事故车|劣质(?:油|汽油)|来路不明的油|超龄服役|机件老化|零件老化/;

const CAUSE_EN = /\b(?:old (?:car|truck|van|beater)|beater|clunker|junk(?:er|yard car|heap)|should(?: have|'ve) been (?:scrapped|junked)|worn[- ]out (?:engine|car|parts)|bad (?:gas|fuel)|water[- ]damaged|salvage(?:d)? (?:car|title)|on its (?:last legs|last mile))\b/i;

/* rescue B：处理锚——当场排障费时间或换方案（可与失灵词同行/邻行） */
const FIX_ZH = /搭电|换(?:了)?(?:上)?备胎|换胎|补胎|打(?:了)?(?:救援|拖车)电话|叫(?:了)?拖车|打车|拦(?:了)?(?:一)?辆?(?:出租|的士|网约)车|叫(?:了)?网约车|搭(?:了)?(?:顺风|便)车|推(?:着)?车|修(?:了)?车|借(?:了)?(?:一辆|台)?车|换(?:了)?(?:一辆|台)车|弃车|下车跑|步行去|跑步追/;

const FIX_EN = /\b(?:jump[- ]start(?:ed|ing)?|changed (?:the )?(?:tire|wheel)|spare tire|patched the tire|called (?:a )?(?:tow truck|mechanic)|towed|hail(?:ed)? (?:a )?(?:cab|taxi)|called (?:for )?a ride|flagged (?:down )?(?:a )?(?:cab|taxi|ride)|push(?:ed)? the car|fixed (?:the )?(?:car|engine|tire)|borrowed (?:a |another |his |her )?car|swapped (?:cars|vehicles)|abandoned the car|on foot|ran after|continued on foot)\b/i;

/**
 * 纯函数：检测"车辆关键时刻必失灵"式载具阀门的密度病。
 */
export function vehicleJam(draft: string): VehicleJamResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const failRe = zh ? FAIL_ZH : FAIL_EN;
  const critRe = zh ? CRIT_ZH : CRIT_EN;
  const causeRe = zh ? CAUSE_ZH : CAUSE_EN;
  const fixRe = zh ? FIX_ZH : FIX_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasFail: boolean[] = new Array(rawLines.length).fill(false);
  const hasCrit: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasFail[i] = failRe.test(line);
    hasCrit[i] = critRe.test(line);
  });

  /* pass2：失灵行与 ±2 行内的关键场景配对成事件（相邻 ≤2 行失灵行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasFail[i]) return;
    const m = raw.match(failRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的失灵表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasCrit[j],
    );
    if (win.length === 0) return; /* 纯失灵无赶路放行（修车铺交代不归本引擎） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（来路/处理两路；窗口含失灵行自身与事件 ±2 行——
     来路词天然与失灵词同行"这辆破车又抛锚了"，仅跳过场景头行） */
  const hits: VehicleJamHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次熄火是经典悬念） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = causeRe.test(win) || fixRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"车辆掐点故障"——正要追人车就打不着火，逃命半路必爆胎，载具失灵成了编剧的阀门，该追上的永远追不上'
        : 'vehicle-jam again - the car breaks down exactly when the plot needs it to; the ignition is a switch the writer flips',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"车辆掐点故障"式载具阀门（${n} 处未救）——车在该走的时候必定走不动，一次是悬念，第三次观众就看穿车辆失灵是编剧的开关。`
      : `${hitCount} vehicle-jam beats (${n} unrescued) - the car dies exactly when it matters. Once is suspense; by the third, the breakdown is a switch the writer flips.`);
    advice.push(zh
      ? '故障的账要当面算清，不在车响不响，而在失灵这一下有没有来路和下文。给每次"打不着火"补一道门槛：要么有来路（跑出租的老爷车、早该报废的破车、泡过水的事故车、加了来路不明的劣质油——失灵有物理解释，观众才信不是编剧掐的）、要么当场处理（换备胎满手油污、搭电等待、叫拖车排队——排障费时间，这时间就是戏）、要么立刻换方案（拦出租车、借邻居的车、弃车跑步追——门关了，人从窗户走）。最忌讳的是失灵完就当没事发生：上一场打不着火，下一场同一辆车一脚油门甩掉追兵——车况的账要连续。如果剧情必须一次"该追没追上"，把它留给唯一一次，并让这次抛锚在后续有人认账（送去大修、换了新车、从此提前半小时出发）——车记得每一次掉链子。'
      : 'The breakdown keeps honest books - what matters is not whether the car runs, but whether the failure has a cause and a consequence. Toll every no-start: a cause (a beat-up taxi with 300,000 miles, a clunker that should have been scrapped, a flood-damaged salvage, bad gas from a no-name station - physics, not plot), an on-the-spot fix (changing the tire with grease-stained hands, waiting for a jump-start, queuing for a tow - the time it costs IS the scene), or a plan B right away (hailing a cab, borrowing the neighbor\'s car, abandoning it and running - when the door closes, someone climbs out the window). The unforgivable version: the engine will not turn over in one scene, and the same car dusts the pursuers next scene - the car\'s condition must keep books. If the plot needs one missed catch, save it for the single beat - and make someone pay for it later: a major overhaul, a new car, leaving half an hour earlier from then on.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
