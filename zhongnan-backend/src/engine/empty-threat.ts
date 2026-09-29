import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 空口威胁检测（Empty Threat）
 * ============================================================
 * 治什么病：
 *   冲突收尾不靠行动，靠一张"威胁欠条"——
 *   "你给我等着！""你会后悔的！""我会让你付出代价！"
 *   / "You'll regret this." "This isn't over." "Mark my words."
 *   狠话放完一整集没有下文，反派成了口嗨选手；第三次观众
 *   免疫，他真动手时也没人怕了。
 *
 * 判定（台词/叙述都扫）：
 *   命中空泛威胁套话（等着瞧/走着瞧/不会放过/付出代价/你完了/
 *   没完/好果子吃/regret this/pay for this/mark my words…）
 *   且同场没有兑现：
 *   rescue（当场兑现，记 rescued 不扣分）：
 *     - 本句自带具体后果（现在就取消婚礼/冻结你账户/让你净身出户）；
 *     - 之后 2 行内话者立刻动手（挥手/保镖扑上/耳光/吩咐/打电话/
 *       甩合同/signaled the guards/slapped/made a call…），
 *       换场即止。
 *
 * 与既有引擎边界：
 *   - villain-threat 是【跨集账本】（吃每集摘要，管压迫感升级），
 *     本引擎是【单场检测】（吃草稿，管狠话当欠条）；
 *   - confrontation-dodge 管外部信号替双方踩刹车，本引擎管威胁方
 *     自己只动嘴不动手；
 *   - antagonist-quality 管反派缺席/蠢/无动机，本引擎管威胁不兑现。
 *
 * 计分：0 次 100；1 次未兑现 75；≥2 次 max(25, 100-n*25)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


// 空泛威胁套话（无具体行动、无时间、无对象后果）
const THREAT_ZH = /(?:你给我等着|给我等着|走着瞧|咱们?走着瞧|你会后悔(?:的)?|后悔(?:来)?(?:找|求)我|不会放过你|不放过你|让你付出代价|付出代价|你完了|你死定了|咱们?没完|这事没完|有你好果子吃|好果子吃|信不信我[^\n。！？]{0,8}(?:滚|死|弄|废)|我要[你他她][^\n。！？]{0,6}(?:好看|后悔|完蛋)|给我小心点|你给我小心|别怪我[^\n。！？]{0,6}(?:不客气|翻脸)|迟早(?:要|会)(?:让你|把你|收拾|弄(?:死|废)|报(?:应|复)))/;
const THREAT_EN = /\b(?:you(?:'ll| will) regret this|you(?:'re| are) gonna regret|you(?:'ll| will) pay for this|mark my words|this (?:is not|isn'?t) over|it (?:is not|isn'?t) over|we(?:'re| are) not done|you(?:'re| are) dead meat|you(?:'re| are) finished|i(?:'ll| will) destroy you|you haven'?t seen the last of me|watch your back)\b/i;

// 本句自带具体后果（威胁与执行同屏，不是欠条）
const INLINE_PAYOFF_ZH = /(?:现在就|当场|立刻|马上)[^\n。！？]{0,14}(?:取消|冻结|开除|滚|离婚|报警|收回|停掉|撤掉|封杀)|(?:净身出户|滚出(?:顾家|公司|家门)|取消婚礼|冻结(?:账户|卡)|收回股份|明天就滚蛋)/;
const INLINE_PAYOFF_EN = /\b(?:cancel(?:s|ed|ling)? the wedding|right now|freeze[sd]? (?:your|the|all) (?:accounts?|cards?)|fire[sd]? you (?:today|right now)|divorce papers|you(?:'re| are) fired tonight|call(?:s|ed)? the cops)\b/i;

// 之后 2 行内立刻动手
const ACTION_ZH = /(?:一挥手|挥了挥手|使了个眼色|一个眼色|(?:保镖|保安|手下)[^\n。！？]{0,6}(?:冲|扑|围|上前|按住|架起)|一(?:记)?耳光|一巴掌|扬手|掏出手机|拨了(?:个)?电话|打了(?:个)?电话|吩咐|下令|命令道|甩出|扔(?:出|在|给|到)|撕(?:碎|毁)|夺过|扣住|揪住|按在|踹翻|抬脚|保安，?把他)/;
const ACTION_EN = /\b(?:signaled (?:the|his) guards|nodded at (?:the|his) (?:guards|men)|guards (?:lunged|grabbed|seized|moved in)|slapped him|swung (?:at|a)|grabbed (?:him|her) by|shoved|snatched|made a call|snapped his fingers|tore up|froze the|shoved the (?:contract|papers)|lunged)\b/i;
const THREAT_ZH_G = new RegExp(THREAT_ZH.source, 'g');
const THREAT_EN_G = new RegExp(THREAT_EN.source, 'gi');

export interface EmptyThreatHit {
  line: number;
  phrase: string;
  snippet: string;
  rescued: boolean;
  rescueLine?: number;
  reason: string;
}

export interface EmptyThreatResult {
  score: number;
  sceneCount: number;
  hits: EmptyThreatHit[];
  issues: string[];
  advice: string;
}

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * 检测空口威胁。
 */
export function emptyThreat(draft: string): EmptyThreatResult {
  if (!draft || !draft.trim()) {
    return { score: 100, sceneCount: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const lines = draft.split(/\r?\n/);
  const hits: EmptyThreatHit[] = [];
  let sceneCount = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneCount++; return; }

    const threatRe = isZh ? THREAT_ZH_G : THREAT_EN_G;
    threatRe.lastIndex = 0;
    const phrases = Array.from(line.matchAll(threatRe), (x) => x[0]);
    if (phrases.length === 0) return;

    const inlineRe = isZh ? INLINE_PAYOFF_ZH : INLINE_PAYOFF_EN;
    let rescued = inlineRe.test(line);
    let rescueLine: number | undefined;
    if (rescued) rescueLine = i + 1;

    // 后 2 个非空行内、换场前话者立刻动手
    if (!rescued) {
      const actionRe = isZh ? ACTION_ZH : ACTION_EN;
      for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
        const near = lines[k].trim();
        if (!near) continue;
        if (isSceneHeaderLine(near)) break;
        if (actionRe.test(near)) {
          rescued = true;
          rescueLine = k + 1;
          break;
        }
      }
    }

    for (const phrase of phrases) {
      hits.push({
        line: i + 1,
        phrase,
        snippet: snippet(line, isZh ? 30 : 48),
        rescued,
        rescueLine,
        reason: isZh
          ? '空泛狠话没有当场兑现，威胁成了欠条'
          : 'Bare threat with no on-screen enforcement — an IOU, not a strike',
      });
    }
  });

  const bad = hits.filter((h) => !h.rescued);
  const n = bad.length;
  const score = n === 0 ? 100 : n === 1 ? 75 : Math.max(25, 100 - n * 25);
  const issues = bad.map((h) => (isZh
    ? `第${h.line}行：空口威胁「${h.snippet}」——${h.reason}，同场立刻让他动手，或把威胁改成一个具体后果加死线`
    : `L${h.line}: empty threat "${h.snippet}" — ${h.reason}; make him strike in the same scene, or name a concrete consequence with a deadline`));
  const advice = isZh
    ? '狠话必须当场见血：删掉"你给我等着/你会后悔的"式空放，要么威胁出口的同一拍就让保镖扑上去，要么把后果和死线说死（现在就取消婚礼、明天冻结你账户）。光放狠话的反派，第三次出场就是笑话。'
    : 'A threat is a strike, not an IOU: cut "you will regret this / this is not over". Either the threatener moves in the same beat — guards lunge, hand strikes — or the threat names an exact consequence and a deadline (wedding cancelled today, accounts frozen tonight).';

  return { score, sceneCount, hits, issues, advice };
}
