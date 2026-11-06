import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 会议体轮转对白检测（Round-Robin Dialogue）
 * -----------------------------------------------------------
 * 创作能力类引擎：AI 写群像戏有个本能——按人头轮流发言，
 * 每人一句，句长差不多，没人抢话、没人打断、没人只说半句：
 *   张三：我觉得这个方案有风险。
 *   李四：我同意张三的看法。
 *   王五：但是我们也不能错过机会。
 *   赵六：那就投票决定吧。
 * 像开会读稿，不像活人。真群戏有长短、有打断、有接茬、
 * 有人一句话被堵回去、有人 dominate。
 *
 * 判定（三条同时满足才报，求精度）：
 *  1) 单场 ≥5 句对白、≥3 个说话人，且前若干轮严格轮转
 *     （相邻不重复、前 4 句互不相同）；
 *  2) 轮转段句长高度整齐（极差 zh≤8 字 / en≤4 词）；
 *  3) 全场零抢话/打断/叠词标记。
 *
 * 边界：dialogue-length-score 管全片长短节奏，不看多人轮转结构；
 * character-balance 管戏份占比；本引擎专管群戏的"读稿感"。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface RoundRobinHit {
  sceneHeader: string;
  speakers: string[];
  turnCount: number;
  minLen: number;
  maxLen: number;
  evidence: string[];
  reason: string;
}

export interface RoundRobinResult {
  score: number;
  sceneCount: number;
  hits: RoundRobinHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


// 抢话/打断/叠说：真人群戏的标志
const OVERLAP_ZH = /(打断|插话|抢(?:着|过|白)|插嘴|接过话|没等.{0,8}说完|话没说完|叠声|齐声|异口同声|——|…$)/;
const OVERLAP_EN = /\b(cuts? in|interrupts?|talks over|overlaps?|chimes in|jumps in|doesn't let .{0,10} finish|before .{0,10} can finish|all at once|in unison)\b|—\s*$/i;

interface Turn {
  speaker: string;
  len: number;
  text: string;
}

const turnLen = (text: string, isZh: boolean): number =>
  isZh ? text.replace(/[，。！？、…：；""''（）()\s,.!?:;'"()-]/g, '').length : text.split(/\s+/).filter(Boolean).length;

export function roundRobinDialogue(draft: string): RoundRobinResult {
  if (!draft || !draft.trim()) {
    return { score: 100, sceneCount: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const overlapRe = isZh ? OVERLAP_ZH : OVERLAP_EN;
  const spreadLimit = isZh ? 8 : 4;

  const scenes: { header: string; turns: Turn[]; rawLines: string[] }[] = [];
  let header = isZh ? '(开场)' : '(opening)';
  let turns: Turn[] = [];
  let rawLines: string[] = [];
  const flush = () => { if (rawLines.length) scenes.push({ header, turns, rawLines }); turns = []; rawLines = []; };

  draft.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { flush(); header = line; return; }
    rawLines.push(line);
    const dm = line.match(/^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/);
    if (dm) turns.push({ speaker: dm[1].trim(), len: turnLen(dm[2].trim(), isZh), text: dm[2].trim() });
  });
  flush();

  const hits: RoundRobinHit[] = [];
  for (const sc of scenes) {
    if (sc.turns.length < 5) continue;
    const speakers = new Set(sc.turns.map((t) => t.speaker));
    if (speakers.size < 3) continue;

    // 找最长严格轮转前缀：相邻说话人不同，且不出现"第三者还没说就回头"
    let prefixEnd = 1;
    const spokenCycle = new Set<string>([sc.turns[0].speaker]);
    for (; prefixEnd < sc.turns.length; prefixEnd++) {
      const cur = sc.turns[prefixEnd].speaker;
      const prev = sc.turns[prefixEnd - 1].speaker;
      if (cur === prev) break;
      if (spokenCycle.has(cur)) {
        // 一轮说满（≥3人）后回头可以继续，不算破；未满一轮就重复才算破
        if (spokenCycle.size < 3) break;
      } else {
        if (spokenCycle.size >= speakers.size) break;
        spokenCycle.add(cur);
      }
    }
    if (prefixEnd < 4) continue;

    const seg = sc.turns.slice(0, prefixEnd);
    const lens = seg.map((t) => t.len);
    const minLen = Math.min(...lens);
    const maxLen = Math.max(...lens);
    if (maxLen - minLen > spreadLimit) continue;

    // 全场有任何抢话/打断，就有活人气息，不判
    if (sc.rawLines.some((l) => overlapRe.test(l))) continue;

    hits.push({
      sceneHeader: sc.header,
      speakers: [...new Set(seg.map((t) => t.speaker))],
      turnCount: prefixEnd,
      minLen,
      maxLen,
      evidence: seg.slice(0, 5).map((t) => `${t.speaker}: ${t.text.length > 16 ? `${t.text.slice(0, 16)}…` : t.text}`),
      reason: isZh
        ? `${prefixEnd}句对白按人头轮转、句长只差${maxLen - minLen}字、零抢话，像开会读稿`
        : `${prefixEnd} turns rotate by roster within ${maxLen - minLen} words with zero cross-talk — reads like a read-through`,
    });
  }

  const score = Math.max(20, 100 - hits.length * 14);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `「${h.sceneHeader}」${h.reason}（${h.speakers.join('、')}）——给一个人加戏压场、让人抢话/被堵回半句、句长拉开，群戏才有主次`
      : `"${h.sceneHeader}" ${h.reason} (${h.speakers.join(', ')}) — let one person dominate, cut someone off mid-line, and vary line lengths so the room has hierarchy`);

  const advice = isZh
    ? hits.length > 0
      ? '群戏不是圆桌会议。让最强势的人多吃台词，让弱势者被打断，让一句话只有三个字——有主次、有抢话、有长短，才像活人。'
      : '群像对话有主次与抢话，无读稿轮转，保持。'
    : hits.length > 0
      ? 'Ensemble scenes are not board meetings. Let the strongest voice dominate, interrupt the weak, drop a three-word line — hierarchy, cross-talk, and uneven lengths make a room feel alive.'
      : 'Ensemble dialogue has hierarchy and cross-talk, no read-through rotation; keep it.';

  return { score, sceneCount: scenes.length, hits, issues, advice };
}

/**
 * 前置教学：buildRoundRobinDialogueDirective(_format='LIVE', lang='zh')
 * --------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 roundRobinDialogue 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"单场人头轮转读稿"的检测口径，
 *       避免写完被 prePolish roundRobinHint 与 craft/deai 复评打回。
 */
export function buildRoundRobinDialogueDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Round-Robin Dialogue Pre-Writing Briefing (same source as roundRobinDialogue: ensemble lines rotate by roster; 14 points per hit; floor 20)】',
      '- Scene split: split by scene headers; the opening block is labeled "(opening)"; each scene is judged independently and hits are counted per scene.',
      '- Trigger: a scene needs at least 5 turns and 3 speakers, plus a strict rotation prefix of at least 4 turns; all three must hold.',
      '- Rotation: adjacent turns have different speakers; after a full cycle of 3+ speakers the roster may repeat; repeating a third speaker before the cycle completes breaks it.',
      '- Even lengths: the rotation segment must span 8 characters or fewer in Chinese (4 words or fewer in English); wider variance already reads human.',
      '- Cross-talk exemption: any line in the scene with an interruption marker (cuts in / interrupts / talks over / chimes in / in unison / a dash or ellipsis tail) means a living room, so the scene is not judged; zero cross-talk is the symptom.',
      '- Evidence fields: sceneHeader, turnCount, minLen / maxLen and the first 5 evidence lines are returned with every hit so the polisher can locate the scene.',
      '- Score: max(20, 100 - hits x 14); empty draft = 100.',
      '- Diagnostics: sceneCount is display-only and never charged.',
      '- Rewrite: give the strongest voice more room, let the weak get cut off or stopped mid-line, and stretch the line lengths so the room has hierarchy.',
      '- Division: dialogue-length-score covers episode-wide rhythm; this engine only judges roster rotation inside one scene.',
      '- Division: character-balance covers screen share; this engine only judges the read-through feel.',
      '- Pipeline consumption: prePolish lists every hit into the polisher hint (roundRobinHint); craft initial, craft re-eval and deai rescan the same result.',
      '- Self-check: does this scene read like a board meeting? Who dominates, who gets cut off, who says only three words? If none of the three exists, it is a read-through.',
    ].join('\n');
  }
  return [
    '【会议体轮转对白·前置教学（检测同源：roundRobinDialogue 群戏按人头轮转读稿，每条命中扣 14 分，20 分封底）】',
    '- 场景切分：按场头切场（isSceneHeaderLine 同源），开场段记作「(开场)」；每场独立判定，命中按场计。',
    '- 触发门槛：单场台词 ≥5 句、≥3 个说话人，且最长严格轮转前缀 ≥4 句，三者同时满足才判。',
    '- 短场跳过：单场台词 <5 句或说话人 <3 个直接不判；空稿 100。',
    '- 轮转定义：相邻不重复——相邻两句说话人不同；一轮说满（≥3 人各说一次）后回头可以续；一轮未满就重复第三人，算破。',
    '- 句长整齐：轮转段内句长极差 ≤8 字（英文 ≤4 词）才判——长短拉得开就不像读稿。',
    '- 抢话豁免：整场任意一行出现抢话/打断/叠说标记（打断/插话/抢着/插嘴/没等…说完/叠声/齐声/异口同声/破折号/省略号收尾）→ 不判；零抢话才是病象。',
    '- 证据字段：sceneHeader（场头）、turnCount（轮转句数）、minLen/maxLen（句长极差）、evidence（前 5 句样本）随命中返回，供润色师定位。',
    '- 得分：score = max(20, 100 - 命中场数 × 14)；空稿 100。',
    '- 诊断字段：sceneCount（总场数）只做展示，不参与扣分。',
    '- 改写方向：给最强势的人压场加戏，让弱势者被打断、被抢话或只说半句被堵回去，句长刻意拉开——群戏才有主次。',
    '- 与 dialogue-length-score 分界：它管全片长短节奏；本引擎只判单场多人轮转结构。',
    '- 与 character-balance 分界：它管全片戏份占比；本引擎只判群戏的读稿感。',
    '- pipeline 消费：prePolish 把命中逐场注入润色师（roundRobinHint）；craft 初评、craft 复评、deai 复扫同一结果。',
    '- 成稿自查：这场像圆桌会议吗？谁最强势、谁被打断、谁只说三个字？三个都没有，就是读稿。',
  ].join('\n');
}
