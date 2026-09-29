import { isSceneHeaderLine } from './script-scenes';
/**
 * 武器哑火 / 装备阀门检测（v2.97 块105，创作能力类）
 * ------------------------------------------------------------------
 * 病象：枪成了编剧的阀门——平时扫射无限弹药，一到该杀反派的
 *   关键时刻，扣下扳机就是"咔哒"一声空膛：
 *     △他举枪瞄准了陈金海。
 *     △他扣下扳机——咔哒，枪哑火了。
 *     △陈金海冷笑着走近。
 * 一次卡壳是经典悬念，第三次观众就看穿：武器失灵是需要的时候
 * 才发生的事故。哑火要有来路（土造/受潮/生锈）、有当场处理
 * （退壳排障费时间）、或有备选方案（备用枪/拔刀）。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - commFailCrutch：管通讯工具失灵当阀门（打不通/没信号），
 *    本引擎管武器失灵当阀门（哑火/空膛/卡壳）——"工具当阀门"
 *    的镜像兄弟，本块其权重退役让位；
 *  - plotArmor：管物理控制下的生死免疫（枪口下不死），本引擎
 *    管武器本身的时机性失灵；
 *  - instantHack / instantMarksman：零成本获取家族（该成的事
 *    零成本成了），本引擎是"负阀门"——该成的动作被掐断；
 *  - causalLogic：泛巧合单发，本引擎管失灵密度病复用。
 *
 * 判定：
 *  - 失灵锚（哑火/卡壳/空膛/打不响/扣不动扳机/没子弹/子弹打光了/
 *    弹匣打空了 + misfired/gun jammed/clicked empty/out of
 *    bullets/no rounds left…）与关键场景锚（瞄准/对准/枪口顶着/
 *    扣下扳机/正要开枪/千钧一发/刀架脖子上 + aimed at/about to
 *    shoot/pulled the trigger/at gunpoint…）±2 行窗口共现 →
 *    构成一次"武器哑火"事件；双条件缺一不可——纯失灵放行（打靶
 *    打完子弹/老枪爱卡壳是道具交代），纯对峙无失灵放行（正常
 *    交火不归本引擎）；
 *  - rescue：①来路锚（土造/劣质子弹/受潮/进沙/没保养/生锈 +
 *    homemade/damp powder/never cleaned/rusted）——失灵有物理
 *    解释；②处理锚（退弹壳/拉枪栓/换弹匣/掏出备用枪/拔刀 +
 *    cleared the jam/racked the slide/spare magazine/drew his
 *    knife）——当场排障费时间或立刻换方案，阀门没有白掐；
 *  - rescue 扫描包含失灵行自身与事件 ±2 行（来路词天然与失灵词
 *    同行——"那把土造的旧枪又哑火了"），仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的失灵表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次卡壳是经典悬念），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface WeaponJamHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有来路/处理锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface WeaponJamResult {
  score: number;
  /** 武器哑火事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: WeaponJamHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 失灵锚：武器在关键时刻不响（哑火/卡壳/空膛本身即枪械语义） */
const FAIL_ZH = /哑火|卡(?:壳|在膛)|空膛|打不响|扣不动扳机|没(?:有)?子弹|没弹药|子弹(?:打光|用完|没了)了?|弹(?:匣|夹)(?:打空|空)了|上不了膛/;

const FAIL_EN = /\b(?:misfired?|(?:the |his |her )?(?:gun|pistol|rifle|revolver|shotgun|weapon) jammed|clicked empty|out of (?:bullets|ammo|rounds)|empty (?:magazine|mag|clip)|no (?:bullets|rounds|ammo) left|the gun clicked|chamber (?:was )?empty|trigger (?:jammed|stuck)|dry[- ]fired?)\b/i;

/* 关键场景锚：该杀没杀的当口（纯失灵无对峙=道具交代放行） */
const CRIT_ZH = /瞄准|对准|枪口(?:顶|指|抵)|正要开枪|就要开枪|扣(?:下|动)扳机|千钧一发|生死一线|最后关头|刀(?:已)?(?:架|抵|顶)在?脖子上?/;

const CRIT_EN = /\b(?:aimed (?:at|the gun at)|pointed (?:the gun|it|his pistol) at|gun pointed at|about to (?:shoot|fire|pull the trigger)|pulled the trigger|at gunpoint|now or never|knife (?:at|to) (?:his|her) throat)\b/i;

/* rescue A：来路锚——失灵有物理解释 */
const CAUSE_ZH = /土造|私枪|劣质(?:子弹|枪|弹药)|受潮|进(?:了)?(?:沙|泥|水)|没(?:保养|擦过|清洗)过?|生锈|老掉牙的枪|黑市(?:来的)?枪?/;

const CAUSE_EN = /\b(?:homemade|zip gun|cheap (?:ammo|ammunition|rounds)|damp (?:powder|ammo)|wet (?:powder|ammo)|sand (?:in|clogged)|mud (?:in|clogged)|never cleaned|rusted|ancient (?:revolver|pistol)|bad batch)\b/i;

/* rescue B：处理锚——当场排障费时间或换方案（可与失灵词同行/邻行） */
const FIX_ZH = /退出(?:了)?(?:卡壳的)?弹壳|拉(?:了)?(?:动)?枪栓|排(?:除了)?故障|换(?:了)?(?:上)?(?:个)?新?弹(?:匣|夹)|掏出(?:了)?备用枪|第二把枪|捡起(?:了)?刀|拔出(?:了)?匕首|抽出(?:了)?刀|徒手(?:扑|冲)|抢过刀/;

const FIX_EN = /\b(?:cleared the (?:jam|round|chamber)|ejected the (?:round|casing)|worked the slide|racked the slide|swapped (?:in |the )?(?:a )?fresh magazine|spare magazine|backup gun|second gun|drew (?:his|her) (?:knife|blade)|went for the knife|reloaded|switched to the knife)\b/i;

/**
 * 纯函数：检测"武器关键时刻必失灵"式装备阀门的密度病。
 */
export function weaponJam(draft: string): WeaponJamResult {
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
    if (win.length === 0) return; /* 纯失灵无对峙放行（道具交代不归本引擎） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（来路/处理两路；窗口含失灵行自身与事件 ±2 行——
     来路词天然与失灵词同行"那把土造的旧枪又哑火了"，仅跳过场景头行） */
  const hits: WeaponJamHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次卡壳是经典悬念） */
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
        ? '又是"武器哑火"——关键时刻枪必定没子弹，武器失灵成了编剧的阀门，该死的人永远死不成'
        : 'weapon-jam again - the gun fails exactly when the plot needs it to fail; the trigger is a switch the writer flips',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"武器哑火"式装备阀门（${n} 处未救）——枪在该响的时候必定不响，一次是悬念，第三次观众就看穿武器失灵是编剧的开关。`
      : `${hitCount} weapon-jam beats (${n} unrescued) - the gun goes silent exactly when it matters. Once is suspense; by the third, the misfire is a switch the writer flips.`);
    advice.push(zh
      ? '哑火的账要当面算清，不在枪响不响，而在失灵这一下有没有来路和下文。给每次"咔哒"补一道门槛：要么有来路（土造的私枪、受潮的劣质子弹、进了沙没保养、生锈的老左轮——失灵有物理解释，观众才信不是编剧掐的）、要么当场处理（退出卡壳的弹壳、拉枪栓排障、顶着对方的枪口换弹匣——排障费时间，这时间就是戏）、要么立刻换方案（掏出备用枪、拔刀、徒手扑上——门关了，人从窗户走）。最忌讳的是失灵完就当没事发生：枪明明空了，下一场又满弹扫射——弹药的账要连续。如果剧情必须一次"该杀没杀"，把它留给唯一一次，并让这次哑火在后续有人认账（去修枪、换枪、从此不信这把枪）——武器记得每一次掉链子。'
      : 'The misfire keeps honest books - what matters is not whether the gun fires, but whether the failure has a cause and a consequence. Toll every click: a cause (a homemade zip gun, damp cheap ammo, sand in the action, a rusted old revolver - physics, not plot), an on-the-spot fix (ejecting the jammed round, racking the slide, swapping magazines at gunpoint - the time it costs IS the scene), or a plan B right away (a backup gun, the knife, going in bare-handed - when the door closes, someone climbs out the window). The unforgivable version: the gun is empty on page one and spraying bullets next scene - ammo must keep books. If the plot needs one death-dodging click, save it for the single beat - and make someone pay for it later: repair the gun, replace it, never trust it again.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
