/**
 * 角色弧光追踪引擎（PRD 2.1.7）
 * 跨集追踪角色情绪/关系状态变化，检测弧光停滞（多集无变化）和情绪跳变（无过渡的突变）。
 *
 * 离线启发式：
 *  - 情绪态：扫描角色名附近的情绪关键词，标记为 anger/fear/hope/despair/calm/joy
 *  - 弧光阶段：setup(铺垫) → conflict(对抗) → crisis(危机) → transformation(转变) → resolution(收束)
 *  - 关系态：扫描角色对之间的对抗/合作信号
 *  - 停滞检测：与 prevArc 对比，如果同角色情绪态和弧光阶段均无变化 → stalled
 *    （c210：本集完全缺席的 unknown/unknown 角色不算停滞）
 *  - 跳变检测：c210 起按情绪效价轴泛化，跨极变化（效价差≥2）且本集轨迹无中间缓冲情绪 → jump_cut
 */

export type EmotionState = 'anger' | 'fear' | 'hope' | 'despair' | 'calm' | 'joy' | 'unknown';
export type ArcStage = 'setup' | 'conflict' | 'crisis' | 'transformation' | 'resolution' | 'unknown';

export interface CharacterArc {
  name: string;
  /** 当前主导情绪态 */
  emotion: EmotionState;
  /** 当前弧光阶段 */
  stage: ArcStage;
  /** 情绪变化轨迹（按出现顺序） */
  emotionTrack: EmotionState[];
  /** 是否在本集有变化（与 prevArc 对比） */
  changed: boolean;
  /** 关系态：与其他角色的关系信号 */
  relations: { target: string; type: 'ally' | 'enemy' | 'lover' | 'family' | 'rival' }[];
}

export interface ArcTrackerResult {
  characters: CharacterArc[];
  /** 弧光停滞的角色（有前集对比时） */
  stalled: { name: string; reason: string }[];
  /** 情绪跳变的角色 */
  jumpCut: { name: string; from: EmotionState; to: EmotionState; reason: string }[];
  /** 弧光完整度 0-100 */
  score: number;
  /** 问题列表 */
  issues: { severity: 'high' | 'mid' | 'low'; type: string; advice: string }[];
}

// 情绪关键词映射
const EMOTION_MAP: Record<string, EmotionState> = {
  // anger
  怒: 'anger', 愤: 'anger', 骂: 'anger', 吼: 'anger', 摔: 'anger', 踹: 'anger', 冲: 'anger', 瞪: 'anger', 冷笑: 'anger',
  // fear
  怕: 'fear', 惊: 'fear', 颤: 'fear', 抖: 'fear', 退: 'fear', 躲: 'fear', 瑟瑟: 'fear', 慌: 'fear', 紧张: 'fear',
  // hope
  希望: 'hope', 相信: 'hope', 期待: 'hope', 一定要: 'hope', 会好的: 'hope', 坚持: 'hope',
  // despair
  绝望: 'despair', 崩溃: 'despair', 破灭: 'despair', 死心: 'despair', 无力: 'despair', 心如死灰: 'despair', 眼泪: 'despair', 哭: 'despair', 跪地: 'despair',
  // calm
  平静: 'calm', 冷静: 'calm', 沉默: 'calm', 默默: 'calm', 淡淡: 'calm', 不动声色: 'calm',
  // joy
  笑: 'joy', 喜: 'joy', 开心: 'joy', 激动: 'joy', 兴奋: 'joy', 欣喜: 'joy',
};

// 弧光阶段信号
const STAGE_MAP: Record<string, ArcStage> = {
  // setup
  介绍: 'setup', 亮相: 'setup', 初次: 'setup', 登场: 'setup',
  // conflict
  对抗: 'conflict', 冲突: 'conflict', 争吵: 'conflict', 反抗: 'conflict', 拒绝: 'conflict', 挑战: 'conflict',
  // crisis
  危机: 'crisis', 绝境: 'crisis', 最低谷: 'crisis', 崩溃: 'crisis', 逼迫: 'crisis', 最后: 'crisis',
  // transformation
  蜕变: 'transformation', 觉醒: 'transformation', 决定: 'transformation', 改变: 'transformation', 逆袭: 'transformation', 站起来: 'transformation',
  // resolution
  和解: 'resolution', 圆满: 'resolution', 结局: 'resolution', 尾声: 'resolution', 最终: 'resolution',
};

// 关系信号
const RELATION_MAP: Record<string, 'ally' | 'enemy' | 'lover' | 'family' | 'rival'> = {
  帮: 'ally', 救: 'ally', 合作: 'ally', 联手: 'ally', 支持: 'ally',
  敌: 'enemy', 背叛: 'enemy', 复仇: 'enemy', 报复: 'enemy', 算计: 'enemy', 对付: 'enemy',
  爱: 'lover', 吻: 'lover', 拥抱: 'lover', 心动: 'lover', 表白: 'lover',
  父: 'family', 母: 'family', 儿: 'family', 女: 'family', 姐: 'family', 弟: 'family', 家人: 'family',
  竞争: 'rival', 较量: 'rival', 对比: 'rival',
};

// c210：情绪效价轴（-2 最负 ~ +2 最正）。跳变不再只写死 calm/hope→despair 两对：
// 相邻效价差 ≥2 且本集轨迹里找不到"非目标情绪自身"的中间缓冲，即判硬切。
const EMOTION_VALENCE: Record<EmotionState, number> = {
  joy: 2, hope: 1, calm: 0, anger: -1, fear: -1, despair: -2, unknown: 0,
};
const EMOTION_ZH: Record<EmotionState, string> = {
  joy: '喜悦', hope: '希望', calm: '平静', anger: '愤怒', fear: '恐惧', despair: '绝望', unknown: '未知',
};

/**
 * c210 情绪硬切检测（效价泛化）。
 * @param prevEmo 前集主导情绪
 * @param currEmo 本集主导情绪
 * @param currTrack 本集该角色全部情绪信号（含非主导信号——中间缓冲常只出现一两次）
 * @returns 跳变描述；有中间缓冲/效价相邻/任一端 unknown 时返回 null
 *
 * 关键纪律：缓冲情绪必须不同于目标主导情绪自身，否则"喜悦→恐惧"会因为轨迹里本来就全是恐惧
 * 而被自我赦免（旧引擎赦免写法 emotions.includes('fear') 在主导情绪恰为 fear 时必漏）。
 */
function detectEmotionJump(
  prevEmo: EmotionState,
  currEmo: EmotionState,
  currTrack: EmotionState[],
): { from: EmotionState; to: EmotionState; reason: string } | null {
  if (prevEmo === 'unknown' || currEmo === 'unknown' || prevEmo === currEmo) return null;
  const delta = EMOTION_VALENCE[currEmo] - EMOTION_VALENCE[prevEmo];
  if (Math.abs(delta) < 2) return null; // 相邻效价（fear→despair、hope→joy）是可信渐变
  const downward = delta < 0;
  // 下行硬切（如 joy→despair）要先经过恐惧/愤怒；上行硬切（如 despair→joy）要先经过希望/平静
  const bridgeSet: EmotionState[] = downward ? ['fear', 'anger'] : ['hope', 'calm'];
  const hasBridge = currTrack.some((e) => e !== currEmo && bridgeSet.includes(e));
  if (hasBridge) return null;
  return {
    from: prevEmo, to: currEmo,
    reason: `情绪从${EMOTION_ZH[prevEmo]}硬切到${EMOTION_ZH[currEmo]}，缺少${downward ? '恐惧/愤怒' : '希望/平静'}过渡`,
  };
}

/**
 * 提取角色名附近的情绪/阶段/关系信号
 */
type RelationType = 'ally' | 'enemy' | 'lover' | 'family' | 'rival';
interface Relation { target: string; type: RelationType }

function findSignalsNear(name: string, text: string, window: number = 30): {
  emotions: EmotionState[];
  stageHits: { stage: ArcStage; at: number }[];
  positions: number[];
} {
  const emotions: EmotionState[] = [];
  // c210：阶段命中必须带原文位置，lastStage 要按"文中最后出现的阶段"而不是词表迭代序
  const stageHits: { stage: ArcStage; at: number }[] = [];

  // 找到角色名在文中的所有位置
  const positions: number[] = [];
  let idx = text.indexOf(name);
  while (idx !== -1) {
    positions.push(idx);
    idx = text.indexOf(name, idx + 1);
  }

  for (const pos of positions) {
    const start = Math.max(0, pos - window);
    const end = Math.min(text.length, pos + name.length + window);
    const context = text.slice(start, end);

    // 情绪
    for (const [kw, emo] of Object.entries(EMOTION_MAP)) {
      if (context.includes(kw)) emotions.push(emo);
    }
    // 阶段（记录每个关键词命中的绝对位置，同一关键词出现多次都要记）
    for (const [kw, stage] of Object.entries(STAGE_MAP)) {
      let hit = context.indexOf(kw);
      while (hit !== -1) {
        stageHits.push({ stage: stage as ArcStage, at: start + hit });
        hit = context.indexOf(kw, hit + kw.length);
      }
    }
  }

  return { emotions, stageHits, positions };
}

/**
 * 主入口：追踪角色弧光
 * @param cast 角色表（name → 角色描述）
 * @param text 本集正文
 * @param prevArc 前集弧光状态（用于检测停滞和跳变）
 */
export function arcTracker(
  cast: Record<string, string>,
  text: string,
  prevArc?: { characters: CharacterArc[]; epNo: number } | null,
): ArcTrackerResult {
  const names = Object.keys(cast);
  const characters: CharacterArc[] = [];
  const stalled: { name: string; reason: string }[] = [];
  const jumpCut: { name: string; from: EmotionState; to: EmotionState; reason: string }[] = [];

  for (const name of names) {
    const { emotions, stageHits, positions } = findSignalsNear(name, text);

    // 主导情绪：取出现最多的
    const emoCount: Record<string, number> = {};
    for (const e of emotions) emoCount[e] = (emoCount[e] || 0) + 1;
    const dominantEmo: EmotionState = emotions.length > 0
      ? Object.entries(emoCount).sort((a, b) => b[1] - a[1])[0][0] as EmotionState
      : 'unknown';

    // 弧光阶段：取原文位置最后的阶段信号（c210 修正：旧实现按词表 Object.entries 序取，不是真"最后"）
    const lastStage: ArcStage = stageHits.length > 0
      ? stageHits.slice().sort((a, b) => a.at - b.at)[stageHits.length - 1].stage
      : 'unknown';

    // 关系：扫描角色对（c210 修正：旧实现只比两个角色名的首次出现位置，多场共现会漏判；
    // 改为任意共现窗口命中即记，同一 target 去重，整体封顶防止结果无界）
    const relations: CharacterArc['relations'] = [];
    for (const other of names) {
      if (other === name) continue;
      const otherPositions: number[] = [];
      let oIdx = text.indexOf(other);
      while (oIdx !== -1) { otherPositions.push(oIdx); oIdx = text.indexOf(other, oIdx + 1); }
      let matched: Relation['type'] | null = null;
      for (const pi of positions) {
        for (const oj of otherPositions) {
          if (Math.abs(pi - oj) < 80) {
            const lo = Math.min(pi, oj);
            const hi = Math.max(pi, oj);
            const context = text.slice(Math.max(0, lo - 10), Math.min(text.length, hi + other.length + 30));
            for (const [kw, type] of Object.entries(RELATION_MAP)) {
              if (context.includes(kw)) { matched = type; break; }
            }
            if (matched) break;
          }
        }
        if (matched) break;
      }
      if (matched) relations.push({ target: other, type: matched });
      if (relations.length >= 10) break;
    }

    // 与前集对比
    const prevChar = prevArc?.characters.find((c) => c.name === name);
    const changed = !prevChar || prevChar.emotion !== dominantEmo || prevChar.stage !== lastStage;

    // 停滞检测（c210 修正：本集零信号的角色=没出场，unknown/unknown 与前集相同不是停滞而是缺席）
    const absentThisEp = dominantEmo === 'unknown' && lastStage === 'unknown';
    if (prevChar && !changed && !absentThisEp) {
      stalled.push({
        name,
        reason: `情绪态(${dominantEmo})和弧光阶段(${lastStage})与上集相同，角色无成长`,
      });
    }

    // 跳变检测（c210：效价轴泛化，覆盖 joy→despair、despair→joy、joy→fear 等全部跨极硬切）
    if (prevChar) {
      const jump = detectEmotionJump(prevChar.emotion, dominantEmo, emotions);
      if (jump) jumpCut.push({ name, ...jump });
    }

    characters.push({
      name,
      emotion: dominantEmo,
      stage: lastStage,
      emotionTrack: emotions,
      changed,
      relations,
    });
  }

  // 计算弧光完整度
  const changedCount = characters.filter((c) => c.changed).length;
  const changeRate = characters.length > 0 ? changedCount / characters.length : 1;
  const stalledPenalty = Math.min(0.4, stalled.length * 0.15);
  const jumpPenalty = Math.min(0.3, jumpCut.length * 0.1);
  const unknownPenalty = characters.filter((c) => c.emotion === 'unknown').length * 0.05;
  const score = Math.round(Math.max(0, Math.min(100, changeRate * 100 * (1 - stalledPenalty - jumpPenalty - unknownPenalty))));

  // 问题列表
  const issues: ArcTrackerResult['issues'] = [];
  if (stalled.length >= 2) {
    issues.push({
      severity: 'high',
      type: 'arc_stalled',
      advice: `${stalled.length}个角色弧光停滞（${stalled.map((s) => s.name).join('、')}），需要给他们新的挑战或转折推动成长`,
    });
  } else if (stalled.length === 1) {
    issues.push({
      severity: 'mid',
      type: 'arc_stalled',
      advice: `${stalled[0].name}弧光停滞，注意给其新的变化`,
    });
  }
  if (jumpCut.length >= 1) {
    issues.push({
      severity: 'high',
      type: 'emotion_jump',
      advice: `${jumpCut.length}处情绪跳变（${jumpCut.map((j) => `${j.name}:${j.from}→${j.to}`).join('、')}），需要中间过渡情绪`,
    });
  }

  return { characters, stalled, jumpCut, score, issues };
}

/* ─── c210 落库摘要 ─────────────────────────────────────────────
 * 批量写库 / SSE / /fix 重算三处必须共用此形态，防止：
 *  1. characters 裸存无界 emotionTrack/relations（单脚本 JSON 无限膨胀）；
 *  2. stalled/jumpCut/issues 随角色表无界增长；
 *  3. advice 拼接全角色名后超长。
 * 字段名与 arcTracker() 原结果保持一致，前端/SSE 消费方零改动。
 * ───────────────────────────────────────────── */
export const ARC_DIGEST_CHAR_CAP = 20;
export const ARC_DIGEST_LIST_CAP = 8;
export const ARC_DIGEST_ISSUES_CAP = 4;
export const ARC_DIGEST_REASON_MAX = 80;
export const ARC_DIGEST_ADVICE_MAX = 160;

export interface ArcTrackDigest {
  score: number;
  characters: { name: string; emotion: EmotionState; stage: ArcStage; changed: boolean }[];
  stalled: { name: string; reason: string }[];
  jumpCut: { name: string; from: EmotionState; to: EmotionState; reason: string }[];
  issues: { severity: 'high' | 'mid' | 'low'; type: string; advice: string }[];
}

export function arcTrackerDigest(res: ArcTrackerResult | null | undefined): ArcTrackDigest {
  if (!res || typeof res !== 'object') throw new Error('arcTrackerDigest: invalid arc tracker result');
  const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    score: typeof res.score === 'number' && Number.isFinite(res.score) ? res.score : 0,
    characters: arr<CharacterArc>(res.characters).slice(0, ARC_DIGEST_CHAR_CAP).map((c) => ({
      name: String(c?.name ?? ''),
      emotion: c?.emotion ?? 'unknown',
      stage: c?.stage ?? 'unknown',
      changed: !!c?.changed,
    })),
    stalled: arr<ArcTrackerResult['stalled'][number]>(res.stalled).slice(0, ARC_DIGEST_LIST_CAP).map((s) => ({
      name: String(s?.name ?? ''),
      reason: clip(s?.reason, ARC_DIGEST_REASON_MAX),
    })),
    jumpCut: arr<ArcTrackerResult['jumpCut'][number]>(res.jumpCut).slice(0, ARC_DIGEST_LIST_CAP).map((j) => ({
      name: String(j?.name ?? ''),
      from: j?.from ?? 'unknown',
      to: j?.to ?? 'unknown',
      reason: clip(j?.reason, ARC_DIGEST_REASON_MAX),
    })),
    issues: arr<ArcTrackerResult['issues'][number]>(res.issues).slice(0, ARC_DIGEST_ISSUES_CAP).map((i) => ({
      severity: i?.severity ?? 'mid',
      type: String(i?.type ?? ''),
      advice: clip(i?.advice, ARC_DIGEST_ADVICE_MAX),
    })),
  };
}
