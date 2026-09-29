import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 努力过程概述/场外达成检测（Effort Gloss）
 * -----------------------------------------------------------
 * 创作能力类引擎：短剧的钱在"怎么争来的"，不在"争到了"。
 * AI 改稿最偷懒的一笔——把本该正面拍的对抗（谈判/哀求/查找/追逐）
 * 压成一句努力状语 + 结果兑付：
 *   几经周折，她终于签下了合同。
 *   好说歹说，他才答应帮忙。
 *   费尽口舌，林棠总算说服了婆婆。
 *   After much persuasion, he finally agreed to sign.
 *   She managed to convince the board after a lot of back and forth.
 * 问题：
 *  1) 最值钱的冲突（最大的那次拒绝、拉扯、翻脸）发生在场外，观众没看到；
 *  2) 结果凭空兑付，人物没有为结果付出可视的代价，爽点/信服力双双落空；
 *  3) 努力成语是叙述者的打包胶带，镜头给不出"几经周折"任何一个画面。
 *
 * 判定（只扫叙述行，按句切分）：
 *  努力词（几经周折/好说歹说/费尽口舌/软硬兼施/软磨硬泡/苦苦哀求/
 *  反复沟通/不懈努力/after much persuasion/managed to convince…）
 *  与"达成结果动词"（签下/答应/说服/松口/拿下/查到/追回/agree/sign/
 *  convince/relent…）在同句近距离共现才判。
 *
 * 边界：
 *  - 裸结果句"她签下了合同"不判——那是场内正常的结果交代，本引擎只管
 *       "努力被概述、结果凭空来"的组合；
 *  - 裸过程短语"经过一番争辩"（无结果）归 show-dont-tell；
 *  - 裸时间跳"三天后"归 timeline-consistency；整场空转归 scene-padding。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface GlossHit {
  line: number;
  phrase: string;
  result: string;
  snippet: string;
  reason: string;
}

export interface EffortGlossResult {
  score: number;
  narrationLines: number;
  hits: GlossHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// 努力/周旋过程被成语化打包
const EFFORT_ZH = /(几经周折|几经辗转|费尽周折|几番周折|一番周折|好说歹说|费尽口舌|费了.{0,4}口舌|费了.{0,6}(?:功夫|力气|周折)|软硬兼施|连哄带骗|连求带[闹跪]|死缠烂打|软磨硬泡|磨破?嘴皮子?|好不容易才?|不懈努力|再三(?:恳求|哀求|劝说|请求)|反复(?:劝说|沟通|交涉|争取|坚持)|一再(?:坚持|请求|恳求)|多番(?:交涉|试探|恳求)|苦苦(?:哀求|恳求|央求|相求)|一哭二闹|三寸不烂之舌)/;
// 对抗兑付的结果：说服/拿到/逃出/被原谅——这些才是观众要看着发生的事
const RESULT_ZH = /(签下?|签成|答应了?|同意了?|松了?口|点了?头|拿到|拿下|搞到|搞定|弄来|弄到|查到|查出|找到|找回|说服|劝说?[住动服]|逃出?|逃脱|逃离|借到|借来|凑齐|凑够|摆平|救下|救回|追回|追到|要回|要到|夺回|夺到|获得|获准|获批|批文|批准|原谅|求来|劝回)/;

const EFFORT_EN = /\b(?:after much effort|with (?:great|considerable) difficulty|eventually managed to|somehow managed to|managed to\s+(?:convince|persuade|talk|get|coerce|cajole)|after a lot of back and forth|after much persuasion|after repeated pleas|begged and pleaded|cajoled(?:\s+him|\s+her)? into|relentlessly|finally talked (?:him|her) into|talked (?:him|her) (?:around|into)|after (?:hours|days) of (?:negotiation|negotiating|begging|persuasion|persuading|arguing))\b/i;
const RESULT_EN = /\b(?:convince[ds]?|persuade[ds]?|talked\s+(?:him|her)\s+into|agreed?|signed|got\s+(?:him|her)\s+to|secured|obtained|tracked\s+down|found|escaped|rescued|recovered|won\s+(?:him|her)\s+over|gave\s+in|relented)\b/i;

const SENT_SPLIT_ZH = /[^。！？；\n]+[。！？；]?/g;
const SENT_SPLIT_EN = /[^.!?\n]+[.!?]?/g;

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function effortGloss(draft: string): EffortGlossResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const effortRe = isZh ? EFFORT_ZH : EFFORT_EN;
  const resultRe = isZh ? RESULT_ZH : RESULT_EN;
  const WINDOW = isZh ? 26 : 100;

  const lines = draft.split(/\r?\n/);
  const hits: GlossHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) return;
    if (DIALOGUE_RE.test(line)) return;
    narrationLines++;

    const sentences = line.match(isZh ? SENT_SPLIT_ZH : SENT_SPLIT_EN) ?? [line];
    for (const sentRaw of sentences) {
      const sent = sentRaw.trim();
      if (!sent) continue;
      const em = sent.match(effortRe);
      if (!em || em.index === undefined) continue;
      // 结果须在努力词前后近距离窗口内共现（允许"他答应了——好说歹说才有用"倒装）
      const lo = Math.max(0, em.index - 10);
      const hi = Math.min(sent.length, em.index + em[0].length + WINDOW);
      const around = sent.slice(lo, hi);
      const rm = around.match(resultRe);
      if (!rm) continue;
      hits.push({
        line: i + 1,
        phrase: em[0],
        result: rm[0],
        snippet: snippet(sent),
        reason: isZh
          ? '把本该正面拍的对抗（拒绝/拉扯/哀求/谈判）用努力成语一笔带过，结果却在句尾当场兑付——最值钱的一场戏发生在场外'
          : 'the fight that should be played on screen (refusal, bargaining, pleading) is shrink-wrapped in an effort idiom while the result is cashed in the same line — the best scene happened off camera',
      });
      break; // 每行最多记一处
    }
  });

  const score = Math.max(25, 100 - hits.length * 11);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」概述了过程、直给了结果——挑出过程中最难的那一次交锋正面拍：对方把笔放下、把合同推回来、门在她面前关上，让"${h.result}"在动作里发生`
      : `L${h.line} "${h.snippet}" summarizes the struggle and hands over the result — stage the hardest single exchange head-on: the pen set down, the contract pushed back, the door shut in her face, and let "${h.result}" happen inside the action`);

  const advice = isZh
    ? hits.length > 0
      ? '观众要的是"怎么争来的"。删掉努力成语，选过程中阻力最大的一个瞬间写成一场戏：一个具体动作、一次当面拒绝、一句翻脸台词。结果必须是人物用动作换来的，不是叙述者发的。'
      : '结果都由人物当场动作换来，无场外打包，保持。'
    : hits.length > 0
      ? 'The audience wants to see HOW it was won. Cut the effort idiom and build one scene around the moment of greatest resistance: a concrete action, a face-to-face refusal, one break-line. The result must be earned in action, not delivered by narration.'
      : 'Outcomes are earned in on-screen action with no off-camera packaging; keep it.';

  return { score, narrationLines, hits, issues, advice };
}
