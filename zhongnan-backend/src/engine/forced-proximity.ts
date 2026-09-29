import { isSceneHeaderLine } from './script-scenes';
/**
 * 被迫同处推进关系 / 困处阀门检测（v2.115 块123，创作能力类）
 * ------------------------------------------------------------------
 * 病象：电梯故障、暴雨停电、密室反锁——一困就心动、一困就近身、
 *   一困就同处一夜，物理困境成了关系开关：
 *     △电梯猛地一震，停住了。
 *     △苏晚（慌）：怎么回事？
 *     △陆总（低声）：别动。
 *     △黑暗中，她的心跳得很快。她不自觉靠近了他。
 * 一次困处是桥段，第三次观众就看穿：困处是编剧按着开关推关系。
 * 关系的推进要有来路——已有好感铺垫、拒绝摩擦、或者困处本身有
 * 代价（恐惧、寒冷、伤势），不该是"一关灯就心跳、一停电就靠近"。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - convenientEncounter：镜像/姊妹引擎——管"转角偶遇/世界太小"
 *    （短暂接触的相遇巧合），本引擎管"被迫长时间同处的困处阀门"
 *    （物理困境推进关系）；前者是"偶遇"（命运巧合），本引擎是
 *    "困处"（物理困境 forcing）——同一"物理接近推进关系"族的两面；
 *  - instantLove：管"初见三行内以身相许"（承诺速度问题，语言层），
 *    本引擎管"困处推进关系"（物理动作问题，行动层）；
 *  - commFailCrutch：管"通讯失灵当剧情阀门"（信息流扣押），本引擎
 *    管"物理困境当关系阀门"（关系流 forcing）——不重叠；
 *  - accidentalSpark：管"摔倒必被接住"（瞬时物理事故催生火花），
 *    本引擎管"被困长时间推进关系"（持续物理困境催生靠近）——
 *    时间尺度不同，前者秒级后者分钟/小时级；
 *  - faintOnCue / paralysisOnCue：身体阀门家族（生理当开关），
 *    本引擎是关系阀门家族（物理困境当关系开关）——不同族。
 *
 * "关系阀门"家族第一员：物理困境推进关系（困处→心动→靠近）。
 *
 * 判定（镜像 fatigue-overdrive 单型双锚）：
 *  - 困处锚（电梯故障/卡住/停电/暴雨/被困/密室/反锁/困在
 *    + elevator broke|stuck|power outage|trapped|locked in|
 *    stranded…）与浪漫推进锚（心跳/对视/脸红/心动/靠近/怦然/
 *    不自觉靠近 + heartbeat|eyes met|blush|draw closer|pulse
 *    racing…）±2 行窗口共现 → 构成一次"困处阀门"事件；双条件
 *    缺一不可——纯困处无浪漫推进放行（困处本身是戏），纯浪漫
 *    推进无困处放行（正常恋爱桥段）；
 *  - rescue：①已有关系基础锚（之前就有好感/暗恋已久/早就认识/
 *    早就喜欢 + had feelings for|secret crush|already knew each
 *    other）——关系有来路，困处只是催化；②挣脱/拒绝锚（挣开/
 *    别碰我/推开/你别过来/退后 + pushed away|don't touch me|
 *    backed away）——有人替观众保持距离；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过困处行与浪漫
 *    推进行自身；
 *  - 相邻 ≤2 行的浪漫推进表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次困处是桥段），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n ≤ 1 → 100；n ≥ 2 → max(20, 70 - (n-2)*20)，
 *    封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ForcedProximityHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有已有关系基础锚/挣脱拒绝锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface ForcedProximityResult {
  score: number;
  /** 困处阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: ForcedProximityHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 困处锚：物理困境把两个人按在一起 */
const TRAP_ZH = /电梯(?:故障|坏了?|停了?|卡住|停电|坠落|骤停|猛地一震|晃了?一下)|电梯门(?:打不开|开不了|卡住|坏了?)|被困(?:在|住)?[^。！？\n]{0,6}(?:电梯|密室|地下室|仓库|房间|车厢|车库|楼道|楼梯间)|反锁(?:在|住)?[^。！？\n]{0,6}(?:屋|房|室|库|厢|车间)|密室(?:反锁|门关|锁住)|停电(?:了)?|断电(?:了)?|暴雨(?:困|围|封|阻)|大雨困|被困[^。！？\n]{0,4}山上|雪崩(?:困|封|堵)|塌方(?:困|堵|封)|封路(?:了)?|封山(?:了)?|道路中断|山洪(?:暴发|围困)|洪水(?:围困|困住)|泥石流(?:困|堵)|暴风雪(?:困|封|围)|台风(?:困|封|围)|停电困|没电了?[^。！？\n]{0,4}(?:回不了|走不了|出不去)|门(?:锁了?|坏了?|打不开|开不了)[^。！？\n]{0,4}(?:出不去|回不了|走不了)|钥匙(?:没带|丢了|坏了?)[^。！？\n]{0,4}(?:出不去|回不了|门打不开)/;

const TRAP_EN = /\b(?:elevator (?:broke|stopped|jolted|jerked|got stuck|malfunctioned)|lift broke|stuck (?:in (?:the|an) (?:elevator|lift|basement|attic|storeroom|warehouse|room|closet|car|train))|trapped (?:in (?:the|an) (?:elevator|lift|basement|attic|storeroom|warehouse|room|closet|car|train|subway|metro))|locked in|locked (?:inside|together)|power outage|power cut|blackout|lights out|stranded (?:in|by|on|at)|snowed in|flooded in|grounded by (?:the|a) (?:storm|blizzard|typhoon|hurricane)|blizzard (?:trapped|stranded|snowed)|storm (?:trapped|stranded|marooned)|doors (?:locked|jammed|stuck|wouldn'?t (?:open|budge))|can'?t (?:get out|leave|open (?:the|a) door)|no way (?:out|to leave)|forced to (?:stay|share (?:the|a) (?:room|space|car)))\b/i;

/* 浪漫推进锚：困处催化出的关系推进 */
const ROMANCE_ZH = /心跳(?:得|得)?(?:很快|加速|漏拍|得厉害)|心跳加速|怦然心动|怦(?:然|怦)?跳|心(?:怦怦|砰砰)跳|不自觉(?:地)?(?:靠近|贴|挨|倚|靠)|不自觉(?:地)?向[^。！？\n]{0,3}靠|身体不自觉|脸(?:红|发烫|发红|烧)|红了脸|对视[^。！？\n]{0,4}(?:一眼|良久|片刻)|四目相对|目光(?:交汇|相遇|撞上)|眼神(?:交汇|相遇|撞上)|靠近了?[^。！？\n]{0,4}(?:他|她|你|一步|半步)|靠在[^。！？\n]{0,4}(?:肩|胸|怀|背上)|倚在[^。！？\n]{0,4}(?:肩|胸|怀|背上)|扑进|扑到|倒入怀|钻进怀|缩进怀|靠过去|贴近了?|离得(?:很)?近|呼吸(?:可闻|交织|交错)|气味|身上的味道|气息(?:扑|迎|拂)/;

const ROMANCE_EN = /\b(?:heart(?:beat)? (?:racing|pounding|skipped|skipping|quickening|fast|accelerat\w*|flutter\w*)|pulse (?:racing|quickening|pounding)|eyes (?:met|locked|found (?:each other|his|her))|their eyes met|blush(?:ed)?|cheeks (?:flushed|reddened|burned)|drew (?:closer|near)|leaned (?:in|toward|closer|against (?:him|her))|moved closer|shifted closer|bodies (?:close|touching|pressed)|skin (?:touching|brushed|against)|close enough to (?:feel|smell|hear) (?:his|her|their) (?:breath|heartbeat|scent|warmth)|electric|tension|chemistry|magnetism|couldn'?t help (?:but|to) (?:move|lean|draw) (?:closer|near))\b/i;

/* rescue A：已有关系基础锚——关系有来路，困处只是催化 */
const HISTORY_ZH = /之前就(?:有|喜欢|暗恋|有好感)|暗恋(?:已久|多年|很久|[^。！？\n]{0,6}年)|早(?:就)?(?:喜欢|爱|暗恋|有好感)|早就认识|认识很久|认识多年|青梅竹马|前男友|前女友|前任|前夫|前妻|初恋|旧爱|旧情人|这些日子|这段时间|相处|同窗|共事|多年(?:朋友|交情)|老朋友|早就(?:对|对上|有感觉)|一直(?:喜欢|暗恋|爱)|心里早就/;

const HISTORY_EN = /\b(?:had feelings for|secret crush|already knew each other|childhood sweetheart|old flame|ex-(?:husband|wife|boyfriend|girlfriend)|first love|we go way back|we'?ve known each other|for (?:years|months|a long time)|all these (?:years|months)|always (?:liked|loved|had a thing for)|been in love with (?:him|her) (?:for|since)|feelings (?:for|about) (?:him|her) (?:for|since))\b/i;

/* rescue B：挣脱/拒绝锚——有人替观众保持距离 */
const REPEL_ZH = /挣开|推开|别碰我|你别过来|退后|躲开|闪开|甩开|退了一步|后退[^。！？\n]{0,4}步|别过来|离我远点|别靠近|你干嘛|放手|松开|站回去|坐回去|离我(?:远点|远一点)|保持距离/;

const REPEL_EN = /\b(?:pushed (?:him|her|away)|pushed away|backed away|stepped back|don'?t (?:touch me|come near me|come closer|get close)|step back|keep (?:your|the) distance|stay back|hands off|let go|get off|shrank back|recoiled|moved away|shrugged (?:him|her) off)\b/i;

/**
 * 纯函数：检测"被困就推进关系"的困处阀门密度病。
 */
export function forcedProximity(draft: string): ForcedProximityResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const trapRe = zh ? TRAP_ZH : TRAP_EN;
  const romanceRe = zh ? ROMANCE_ZH : ROMANCE_EN;
  const historyRe = zh ? HISTORY_ZH : HISTORY_EN;
  const repelRe = zh ? REPEL_ZH : REPEL_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasT: boolean[] = new Array(rawLines.length).fill(false);
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasT[i] = trapRe.test(line);
    hasR[i] = romanceRe.test(line);
  });

  /* pass2：困处行与 ±2 行内的浪漫推进锚配对成事件（相邻 ≤2 行浪漫行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasT[i]) return;
    const m = raw.match(trapRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的困处表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasR[j],
    );
    if (win.length === 0) return; /* 纯困处无浪漫推进不构成事件 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（已有关系基础/挣脱拒绝；跳过困处行与浪漫行自身） */
  const hits: ForcedProximityHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次困处是桥段） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasT[j] || hasR[j]) continue; /* 困处行与浪漫行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = historyRe.test(win) || repelRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"困处推进关系"——电梯故障、暴雨停电、密室反锁，一困就心动一困就靠近，物理困境成了关系开关'
        : 'forced proximity again - elevator broke, power out, locked in, and the heart races on cue; the trap is the author turning on the romance',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n <= 1 ? 100 : Math.max(20, 70 - (n - 2) * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 2) {
    issues.push(zh
      ? `${hitCount} 处"被困推进关系"式困处阀门（${n} 处未救）——电梯故障、暴雨停电、密室反锁，一困就心动一困就靠近，物理困境成了关系开关。`
      : `${hitCount} forced-proximity beats (${n} unrescued) - every trap turns into a heartbeat; the stuck elevator is a romance vending machine.`);
    advice.push(zh
      ? '困处的戏剧价值在于"无处可逃逼出真"，不在于"黑暗就心跳"。给每次困处补一道来路：要么关系早有铺垫（暗恋已久——困处只是临门一脚，不是零度起步）、要么有拒绝摩擦（她推开他退后一步——替观众保持距离）、要么困处本身有代价（恐惧、寒冷、伤势——身体在受苦，心却靠过去显得突兀就让它显得突兀，让人物事后尴尬）。更好的写法是"困而不靠近"——困处更长，但人物坚持各睡各的角落、背对背、不说话——沉默比靠近更有张力，靠近留到困处解除之后、留到他们选择彼此的时候。如果剧情就是需要困处催化关系，让第三方点破"你们怎么每次出事都粘到一起"——替观众把吐槽说出口，白给就变成了自觉的浪漫。'
      : 'A trap is only romantic when it forces truth, not when it manufactures a heartbeat. Give each beat a pedigree: feelings already there (a long crush — the trap is the last nudge, not a cold start), resistance (she pushes away, steps back — let someone keep the distance), or a cost to the trap itself (fear, cold, injury — bodies suffering while hearts race is jarring, so let it be jarring and let the characters be awkward afterward). Better still, trap them but keep them apart: longer confinement, but they sleep in separate corners, back to back, in silence — the silence is more charged than any closeness, and the closeness can wait until after the trap, until they choose each other. If the plot truly needs the trap to catalyse romance, let a third party say "funny how every disaster brings you two together" — the audience\'s eye-roll, voiced, becomes wit.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
