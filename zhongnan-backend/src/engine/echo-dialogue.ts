import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 对白回声复述检测（Echo Dialogue / Parrot & Restate）
 * -----------------------------------------------------------
 * 创作能力类引擎：两种"替观众复述"的懒写法——
 *  1) parrot（鹦鹉学舌）：对方刚说完，下一位用短问句/短回应把内容词
 *     原样抛回来——"我们离婚吧。""离婚？" / "孩子不能留。""不能留？"。
 *     偶尔一次是真人震惊反应，密集出现就是 AI 在替耳背观众做字幕。
 *  2) restate（旁白复述）：台词刚说完，下一行动作/叙述又把同义信息
 *     复述一遍——"沈知远：我明天搬。" / 他说他明天搬走。
 *     声画说了两遍，是小说改剧本的残留。
 *
 * 查重边界：repetition-check 管"全片任意位置编辑距离≤3的近似行/句式模板"，
 * 不看轮次相邻关系、不区分说话人、不管旁白复述台词；本引擎专打
 * 相邻对话轮的内容词回声 + 紧随叙述句复述，范围收紧，互补不重叠。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface EchoHit {
  type: 'parrot' | 'restate';
  line: number;
  speaker?: string;
  echoed: string;
  source: string;
  snippet: string;
}

export interface EchoDialogueResult {
  score: number;
  hits: EchoHit[];
  dialogueTurns: number;
  parrotCount: number;
  restateCount: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


// 纯功能性短语回声不算（没有内容信息）
const STOP_ECHO_ZH = ['不知道', '我知道', '知道了', '为什么', '怎么会', '真的吗', '不可能', '你说什么', '没什么', '干什么', '你再说一遍', '什么意思', '凭什么', '没有', '不是', '没事', '好的', '行吧', '算了', '闭嘴', '放开', '住手', '够了', '回来', '别走', '出去', '过来', '好吧', '是的', '对啊', '没错', '怎么', '什么', '难道', '居然', '竟然', '真的', '然后', '所以'];
const STOP_ECHO_EN = ['i know', "i don't know", 'really', 'what', 'why', 'come again', 'say that again', 'you what', 'are you serious', 'no way', 'no', 'yes', 'okay', 'fine', 'sure', 'please', 'sorry', 'thanks', 'what do you mean'];

// 叙述复述引导词（叙述句复述台词的强信号）
const RESTATE_LEAD_ZH = /(他说|她说|它说|他表示|她表示|他解释|她解释|他重申|她重申|他重复|她重复|他强调|她强调|他告诉|她告诉|回应道|答道|解释道|重申道)/;
const RESTATE_LEAD_EN = /\b(?:he|she|they)\b[^.]{0,18}\b(?:said(?: that)?|told (?:him|her|them)|explained|repeated|added|went on)\b/i;

interface Unit {
  idx: number;
  kind: 'dialogue' | 'action';
  speaker?: string;
  text: string;
}

function isDialogueLine(line: string): RegExpMatchArray | null {
  return line.trim().match(/^([^\s：:]{1,12})\s*[：:]\s*(.+)$/);
}

const stripPunct = (s: string, isZh: boolean): string =>
  isZh ? s.replace(/[，。！？、…""''（）()\s]/g, '') : s.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** 最长公共连续子串 */
function lcs(a: string, b: string): string {
  if (!a || !b) return '';
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  let best = 0;
  let end = 0;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > best) { best = dp[i][j]; end = i; }
      }
    }
  }
  return a.slice(end - best, end);
}

/** 英文最长连续公共词序列（按词） */
function lcsWords(a: string, b: string): string {
  const wa = a.split(/\s+/).filter(Boolean);
  const wb = b.split(/\s+/).filter(Boolean);
  if (!wa.length || !wb.length) return '';
  const dp: number[][] = Array.from({ length: wa.length + 1 }, () => new Array<number>(wb.length + 1).fill(0));
  let best = 0;
  let end = 0;
  for (let i = 1; i <= wa.length; i++) {
    for (let j = 1; j <= wb.length; j++) {
      if (wa[i - 1] === wb[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > best) { best = dp[i][j]; end = i; }
      }
    }
  }
  return wa.slice(end - best, end).join(' ');
}

export function echoDialogue(draft: string): EchoDialogueResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], dialogueTurns: 0, parrotCount: 0, restateCount: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const stops = isZh ? STOP_ECHO_ZH : STOP_ECHO_EN;

  // 按场收集单元
  const scenes: Unit[][] = [];
  let cur: Unit[] = [];
  const pushScene = () => { if (cur.length) scenes.push(cur); cur = []; };
  draft.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { pushScene(); return; }
    const dm = isDialogueLine(line);
    if (dm) cur.push({ idx: idx + 1, kind: 'dialogue', speaker: dm[1].trim(), text: dm[2].trim() });
    else cur.push({ idx: idx + 1, kind: 'action', text: line });
  });
  pushScene();

  const hits: EchoHit[] = [];
  let dialogueTurns = 0;

  const snippet = (s: string) => (s.length > 18 ? `${s.slice(0, 18)}…` : s);

  for (const scene of scenes) {
    for (let i = 0; i < scene.length - 1; i++) {
      const u = scene[i];
      const v = scene[i + 1];

      // ① 相邻对白轮：不同说话人，v 是短回应/问句，复述 u 的内容词
      if (u.kind === 'dialogue' && v.kind === 'dialogue' && u.speaker !== v.speaker) {
        dialogueTurns++;
        const a = stripPunct(u.text, isZh);
        const b = stripPunct(v.text, isZh);
        const shortReaction = isZh ? b.length <= 12 : b.split(' ').length <= 8;
        const isQuestion = isZh ? /[？?]\s*$/.test(v.text) || /(吗|么|呢)$/.test(b) : /\?\s*$/.test(v.text);
        if (shortReaction || isQuestion) {
          const common = isZh ? lcs(a, b) : lcsWords(a, b);
          const commonLen = isZh ? common.length : common.split(' ').filter(Boolean).length;
          const minLen = isZh ? 2 : 2;
          const isStop = stops.some((w) => (isZh ? common === w || common.includes(w) : common === w));
          // 回声内容须占短回应的一半以上，避免长回应里偶然撞词
          const ratio = isZh ? commonLen / Math.max(1, b.length) : commonLen / Math.max(1, b.split(' ').length);
          if (commonLen >= minLen && !isStop && ratio >= 0.5) {
            hits.push({
              type: 'parrot',
              line: v.idx,
              speaker: v.speaker,
              echoed: common,
              source: snippet(u.text),
              snippet: snippet(v.text),
            });
          }
        }
      }

      // ② 台词后紧随的叙述句复述台词内容
      if (u.kind === 'dialogue' && v.kind === 'action') {
        const a = stripPunct(u.text, isZh);
        const bRaw = v.text.replace(/^[（(\s△]+|[）)\s]+$/g, '');
        const b = stripPunct(bRaw, isZh);
        const lead = isZh ? RESTATE_LEAD_ZH : RESTATE_LEAD_EN;
        const common = isZh ? lcs(a, b) : lcsWords(a, b);
        const commonLen = isZh ? common.length : common.split(' ').filter(Boolean).length;
        const bLen = isZh ? b.length : b.split(' ').filter(Boolean).length;
        const ratio = commonLen / Math.max(1, bLen);
        const isRestate = isZh
          ? (lead.test(bRaw) && commonLen >= 4) || (commonLen >= 5 && ratio >= 0.6)
          : (lead.test(bRaw) && commonLen >= 2) || (commonLen >= 4 && ratio >= 0.6);
        if (isRestate) {
          hits.push({
            type: 'restate',
            line: v.idx,
            echoed: common,
            source: snippet(u.text),
            snippet: snippet(bRaw),
          });
        }
      }
    }
  }

  const parrotCount = hits.filter((h) => h.type === 'parrot').length;
  const restateCount = hits.filter((h) => h.type === 'restate').length;
  const score = Math.max(0, 100 - parrotCount * 9 - restateCount * 11);

  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? h.type === 'parrot'
        ? `第${h.line}行「${h.speaker}」把对方的「${h.echoed}」原样抛回：震惊式回声一场戏最多一次，换成带立场的反应（曲解/顶回/接错重点）`
        : `第${h.line}行叙述复述了台词已说的「${h.echoed}」：声画二选一，删掉复述或改成台词里没有的新信息`
      : h.type === 'parrot'
        ? `Line ${h.line} "${h.speaker}" parrots "${h.echoed}" back: allow one shocked echo per scene at most; use a loaded reaction instead (twist the words, counter, miss the point)`
        : `Line ${h.line} narration restates "${h.echoed}" already spoken: show or tell, not both — cut the restatement or add information the dialogue did not`);

  const advice = isZh
    ? hits.length > 0
      ? '回声复述是给耳背观众准备的字幕。角色接话要带自己的立场和新信息——可以曲解、顶回、接错重点、用动作拒答；台词已经给到的信息，叙述不要再报一遍。'
      : '对话反应都有立场增量，无声画重复，保持。'
    : hits.length > 0
      ? 'Parroting is subtitles for the hard of hearing. Every reply should carry the character\'s own stake and new information — twist the words, counter, miss the point, or refuse via action. Never restate in prose what the line already said.'
      : 'Every reaction adds stance, no dialogue/narration redundancy; keep it.';

  return { score, hits, dialogueTurns, parrotCount, restateCount, issues, advice };
}
