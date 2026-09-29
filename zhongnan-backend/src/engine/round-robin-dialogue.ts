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
