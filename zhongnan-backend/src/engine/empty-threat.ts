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

/**
 * 前置教学：buildEmptyThreatDirective(_format='LIVE', lang='zh')
 * -------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 emptyThreat 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"台词叙述都扫 / 本句后果与后 2 行动手两通道 rescue /
 *       一行多短语多条 / 只算未兑现"的口径，避免写完被 prePolish threatHint 与 craft/deai 复评打回。
 */
export function buildEmptyThreatDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Empty Threat Pre-Writing Briefing (same source as emptyThreat: bare threats with no on-screen enforcement; 1 hit = 75, 2+ hits = max(25, 100 - n x 25))】',
      '- Scope: both dialogue and narration lines are scanned; scene headers are skipped and counted into sceneCount; every non-empty line is eligible and the whole draft is scanned.',
      '- Threat phrases: you will regret this / you are gonna regret / you will pay for this / mark my words / this is not over / it is not over / we are not done / you are dead meat / you are finished / I will destroy you / you have not seen the last of me / watch your back.',
      '- Inline payoff: if the same line already carries a concrete consequence (right now / on the spot / immediately plus cancel / freeze / fire / divorce / call the cops, or cancel the wedding / freeze your accounts / divorce papers / you are fired tonight), the hit is rescued and not charged.',
      '- Action rescue: if the threatener strikes within the next 2 non-empty lines before the scene changes (a wave of the hand, a signal to the guards, guards lunging, a slap, a phone call, an order, tearing up a contract), the hit is rescued; the scan stops at the next scene and never crosses it.',
      '- Multiple phrase matches: one line that carries several threat phrases is recorded once per phrase, each becoming its own hit entry.',
      '- Unrescued only: rescued hits stay in hits for traceability but are excluded from scoring and from issues; only unrescued hits are charged.',
      '- Score: 0 unrescued hits = 100; 1 unrescued hit = 75; 2 or more = max(25, 100 - n x 25).',
      '- Hit fields: line, phrase, snippet (first 30 characters in Chinese and 48 characters in English), rescued, rescueLine and reason are returned.',
      '- Neighbour divisions: villain-threat is the cross-episode ledger that reads episode summaries and tracks pressure escalation; confrontation-dodge covers an external signal braking a confrontation; antagonist-quality covers an absent, stupid or unmotivated villain; this engine judges only a single scene where the threatener talks but never acts.',
      '- Single scene: enforcement is looked for only inside the same scene; nothing is carried to the next episode and no later payoff excuses an empty threat.',
      '- Rewrite: either the threatener moves in the same beat (guards lunge, a slap lands, a call is made), or the threat names an exact consequence and a deadline (wedding cancelled today, accounts frozen tonight).',
      '- Pipeline consumption: prePolish injects the unrescued hits into the polisher as threatHint; craft initial, craft re-eval and deai rescan consume the same result and surface it in the pipeline return; it is diagnostic only and carries no weight.',
      '- Self-check: after the threat, did anyone actually move? If the answer is no, the line is an IOU and must be cut or paid on screen.',
      '- Parity: dialogue and narration both scanned, the next 2 lines rescue, multiple phrase matches per line and the 30/48-character snippet match the Chinese layer.',
    ].join('\n');
  }
  return [
    '【空口威胁·前置教学（检测同源：emptyThreat 管狠话放完不兑现；1 次未兑现 75 分，≥2 次 max(25, 100 - n × 25)）】',
    '- 检测范围：台词与叙述都扫（叙述里写"他撂下狠话"也算），场头跳过并计入 sceneCount，所有非空行都参与，全稿扫描。',
    '- 威胁套话：你给我等着/给我等着/走着瞧/咱们走着瞧/你会后悔的/后悔来找我/不会放过你/让你付出代价/付出代价/你完了/你死定了/咱们没完/这事没完/有你好果子吃/好果子吃/信不信我…滚死弄废/我要你好看/给我小心点/别怪我不客气/迟早让你…。',
    '- 本句后果：同一行已带具体后果（现在就/当场/立刻/马上 + 取消/冻结/开除/滚/离婚/报警/收回/停掉/撤掉/封杀；净身出户/滚出公司/取消婚礼/冻结账户/收回股份/明天就滚蛋）→ 记 rescued，不扣分。',
    '- 动手 rescue：威胁行之后 2 个非空行内、换场即止（一挥手/使眼色/保镖扑上/一记耳光/掏出手机/打电话/吩咐/下令/甩出合同/撕碎/夺过/揪住/踹翻）→ 记 rescued；遇场头即中止，绝不跨场。',
    '- 一行多短语：同一行命中多个威胁套话时按短语逐个记录，各记一条，分别落进 hits。',
    '- 只算未兑现：rescued 命中仍留在 hits 里可追溯，但不计入得分、不进 issues；只有未兑现命中参与扣分。',
    '- 得分：0 次 100；1 次 75；≥2 次 max(25, 100 - n × 25)。',
    '- 命中字段：line / phrase / snippet（中文前 30 字，英文前 48 字符）/ rescued / rescueLine / reason。',
    '- 邻居分界：villain-threat 是跨集账本（吃每集摘要，管压迫感升级）；confrontation-dodge 管外部信号替双方踩刹车；antagonist-quality 管反派缺席/蠢/无动机；本引擎只管单场里威胁方只动嘴不动手。',
    '- 单场判定：兑现只在本场找，不跨集、不查下一集，后集补动作也不能豁免本场的空放。',
    '- 改写方向：要么威胁出口当场就让人动手（保镖扑上/耳光落下/电话拨出），要么把具体后果与死线写死（今天就取消婚礼、今晚冻结你账户）。',
    '- pipeline 消费：prePolish 把未兑现命中注入润色师（threatHint）；craft 初评、craft 复评、deai 复扫同一结果并随管线返回值透出，仅作诊断不计加权。',
    '- 成稿自查：狠话之后有没有人真的动手？没有就是欠条，删掉或当场兑付。',
    '- 中英一致：台词叙述都扫、后 2 行 rescue、一行多短语各记一条、30/48 字符截断与中文层一致。',
  ].join('\n');
}
