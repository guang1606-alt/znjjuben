import { isSceneHeaderLine } from './script-scenes';
/**
 * 事故心动检测（v2.80 块83，创作能力类）
 * ------------------------------------------------------------------
 * 病象：心动全靠物理事故批发——摔倒必被接住、转身必撞进怀里、
 * 脚下一滑必跌入怀抱、凑近必意外之吻：
 *   △她脚下一滑，整个人摔进了他的怀里。
 *   △两人四目相对，心跳漏了一拍。
 *   She stumbles and falls right into his arms.
 *   Their lips accidentally meet.
 * 事故能制造接触，制造不了心动。第一次是桥段，第三次观众替你
 * 尴尬；角色对彼此的好感必须来自选择——看清对方做的某件事、
 * 为彼此挡下什么——而不是地心引力。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - cheap-forgiveness：管和解场景"扑进怀里"当接受动作（被原谅
 *    方扑抱=廉价原谅的信号），本引擎管恋爱线的事故火花，场景相反；
 *  - cheap-empathy：管安慰动作话术，与心动无关；
 *  - reactionCliche：管反应镜头老套（瞪眼/倒吸凉气），不管身体接触；
 *  - hollowAction：管空身空调度，与此无关。
 *
 * 判定：
 *  - 叙述/动作行命中事故火花短语（摔|跌|栽|扑|撞 + 怀里/怀抱/胸膛；
 *    意外/不小心/恰好/不偏不倚 + 吻/唇；英文 stumbled into his arms /
 *    lips accidentally meet）——cue 台词提及（人物自嘲吐槽）不算；
 *  - 第 1 次豁免（喜剧调味合法），第 2 次起每次 1 hit；
 *  - rescue（±2 行出现拒绝/拉开距离锚点）：推开/挣脱/后退/跳开/
 *    尴尬/别过头/pulls away/steps back/scrambles up——事故之后
 *    写尴尬写距离，说明作者没把它当火花用；
 *  - 计分（结构性病，单次命中即成立）：n=1 → 70，每多 1 处 −20，
 *    封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface AccidentalSparkHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（事故后写拒绝/拉开距离，没当火花用） */
  rescued: boolean;
  reason: string;
}

export interface AccidentalSparkResult {
  score: number;
  /** 事故火花总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: AccidentalSparkHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const CUE_ZH = /^([一-鿿A-Za-z0-9·]{1,8})(?:（[^）]{0,40}）)?\s*[：:]\s*(.+)$/;
const CUE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\((?:V\.?O\.?|O\.?S\.?|CONT(?:'?D)?|OFFSCREEN|FILTERED|ON THE PHONE|[^()]{0,40})\))?\s*:\s*(.+)$/;

/* 事故火花：身体动词直落怀里/怀抱/胸膛（≤4 字间隔，逗号截断防误连） */
const SPARK_ZH = [
  /(?:摔|跌|栽|扑|撞|倒)[^。，；、]{0,4}(?:怀(?:里|中)|怀抱|胸膛)/,
  /(?:不偏不倚|恰好|正好|意外|不小心|猝不及防)[^。]{0,8}(?:吻上?|唇(?:瓣)?(?:贴|碰|触|落))/,
  /(?:吻|唇)[^。，；、]{0,6}(?:不偏不倚|恰好|正好|意外|猝不及防)/,
  /一个?踉跄[^。，；、]{0,10}(?:扑进|栽进|跌进|摔进)/,
  /跌坐(?:在)?[^。，；、]{0,4}(?:怀(?:里|中)|怀抱)/,
];

const SPARK_EN = [
  /\b(?:stumbl\w*|trip\w*|fall\w*|fell|slip\w*|lurch\w*|crash\w*|tumbl\w*)\b[^.\n]{0,24}\b(?:into (?:his|her|their) arms?|against (?:his|her|their) chest|into (?:his|her|their) chest)\b/i,
  /\b(?:accidental(?:ly)?|unexpected(?:ly)?|by accident|not on purpose)\b[^.\n]{0,20}\b(?:kiss(?:ed|ing)?|lips? (?:met|brushed|touched|landed))\b/i,
  /\blips?\b[^.\n]{0,14}\baccidental(?:ly)?\b|\baccidental(?:ly)?\b[^.\n]{0,14}\blips?\b/i,
  /\b(?:crashed?|slammed?|bumped?)\b[^.\n]{0,16}\b(?:his|her|their) (?:lips?|mouth)\b/i,
];

/* 救援：事故后 ±2 行写拒绝/拉开距离——作者没把事故当火花用 */
const REFUSE_ZH = /推开|挣脱|后退|退开|跳开|弹开|拉开距离|尴尬|别过头|连忙(?:站|退|起)|站好|整理(?:衣|裙|头发)/;
const REFUSE_EN = /\b(?:pulls? away|push(?:es|ed)? (?:him |her |them )?(?:away|back|off)|steps? back|scrambles? up|jumps? back|shoves?|awkward(?:ly)?|recoils?|straightens? (?:her|his|their) (?:jacket|clothes|dress))\b/i;

/**
 * 纯函数：检测"摔进怀里/意外之吻"式事故心动套路。
 */
export function accidentalSpark(draft: string): AccidentalSparkResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const sparkRes = zh ? SPARK_ZH : SPARK_EN;
  const cueRe = zh ? CUE_ZH : CUE_EN;
  const refuseRe = zh ? REFUSE_ZH : REFUSE_EN;

  const hits: AccidentalSparkHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prev = '';
  let prevWasHit = false;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { prev = ''; return; }
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prev = line; prevWasHit = false; return; }
    const isCue = cueRe.test(line);
    if (!isCue) {
      /* 上一行已是命中时只测本行，避免跨行窗口重复计数 */
      const window = prevWasHit ? line : `${prev}\n${line}`;
      const m = sparkRes.map((re) => window.match(re)).find(Boolean);
      if (m) {
        hitCount += 1;
        if (hitCount >= 2) {
          const lo = Math.max(0, i - 2);
          const hi = Math.min(rawLines.length - 1, i + 2);
          const rescued = refuseRe.test(rawLines.slice(lo, hi + 1).join('\n'));
          hits.push({
            line: i + 1,
            sceneIndex: Math.max(0, sceneIdx),
            sceneHeader: header,
            snippet: (line || prev).slice(0, 30),
            marker: (m[0] ?? '').slice(0, 28),
            rescued,
            reason: rescued
              ? (zh ? '事故之后写的是尴尬与距离，没有当火花用' : 'the accident lands into awkwardness and distance, not a spark')
              : (zh ? '火花全靠地心引力：摔/撞/跌直落怀里或意外之吻，好感没有来自选择' : 'gravity doing the falling: a stumble or bump straight into arms or an accidental kiss — no choice behind the attraction'),
          });
        }
        prevWasHit = true;
        prev = line;
        return;
      }
    }
    prevWasHit = false;
    prev = line;
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"摔进怀里/意外之吻"式事故心动（${n} 处未救）——火花全靠地心引力，事故能制造接触，制造不了心动。`
      : `${hitCount} accidental-spark beats (${n} unrescued) — stumbling into arms, bumping into a chest, lips meeting by accident. Gravity can create contact; it cannot create attraction.`);
    advice.push(zh
      ? '心动不许靠物理事故批发——摔倒必被接住、转身必撞进怀里，第一次是桥段，第三次观众替你尴尬。事故可以留一次当喜剧调味，但火花必须来自选择：她看清他做的某件事才心动，他为她挡下什么才靠近。事故发生后写尴尬与拉开距离（她推开他、两人后退半步整理衣角），别写四目相对心跳漏拍；实在要用接住，下一拍就交给具体动作——她踩着他的脚站起来、把外套扔回给他，别在怀里多待一秒。'
      : 'Attraction cannot be batch-produced by physical accidents — stumble into arms, spin into his chest, brake into her embrace. The first is a trope, the third is embarrassment. Keep one accident as comedy if you must, but sparks must come from choices: she falls for something he did, not something gravity did. After an accident, write awkwardness and distance — she pushes off, both step back and straighten their jackets — never lingering eye contact and a skipped heartbeat. If someone must catch her, hand the next beat to a concrete action: she stands on his foot, throws his jacket back at him, and moves.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
