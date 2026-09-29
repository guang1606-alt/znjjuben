import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 叙述者读心/认知结论直给检测（Mind-Reading Narration）
 * -----------------------------------------------------------
 * 创作能力类引擎：影视剧本只能拍外化的东西，AI 却常让叙述者
 * 钻进角色脑子里替他下结论——没有"心想"框架（那个归 show-dont-tell），
 * 而是自由间接引语直接宣判：
 *   她知道，这一走就是永别。
 *   他明白自己已经没有退路了。
 *   她突然意识到，自己从来没有真正了解过这个男人。
 *   这一刻他终于懂了，父亲当年为什么离开。
 * 这些句子"读"起来像小说，"拍"出来什么都没有。结论必须
 * 改成可演的选择、动作、台词、物证。
 *
 * 判定（两条同时满足）：
 *  1) 非台词叙述行，第三人称 + 认知动词框架
 *     （知道/明白/意识到/发现/懂了/确信/感到/认定/决定…；
 *      knew/realized/understood/felt/could tell/decided…）；
 *  2) 认知宾语是抽象结论（永远/再也/真正/从来/没有退路/原谅/
 *      真相/一辈子…；never/forever/finally/the truth/no way out…）。
 * 豁免：
 *  - 显性内心独白框架（心想/暗想/he thought）——归 show-dont-tell；
 *  - 后跟具体可验证事实（数字、引语、台词冒号）；
 *  - 第一/二人称句、问句。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface MindReadingHit {
  line: number;
  verb: string;
  snippet: string;
  reason: string;
}

export interface MindReadingResult {
  score: number;
  narrationLines: number;
  hits: MindReadingHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// 显性内心独白：归 show-dont-tell，本引擎不重复报
const MONO_FRAME_ZH = /(心想|暗想|暗忖|心道|心中暗|内心(?:想|嘀咕)|心里(?:想|嘀咕|道))/;
const MONO_FRAME_EN = /\b(?:thought to (?:him|her|them)?self|said to (?:him|her)self)\b/i;

// 认知动词框架（第三人称主语 + 认知/判断/决定）
const COG_ZH = new RegExp(`(?:[他她它]|那[人个]|男[人孩]|女[人孩]|[\u4e00-\u9fff]{2,4}?)(?:这才|此刻|这时|那刻|当时|突然|忽然|终于|隐隐|隐约|分明|清楚|清晰地|心里)?(?:知道|明白|意识到|发现|发觉|懂了|懂得|确信|深信|认定|感到|感觉|觉得|清楚|意识到了|下定决心|决定了?|这才明白)`);
const COG_EN = /\b(?:he|she|they|the (?:man|woman|boy|girl))\s+(?:finally |suddenly |suddenly realized|dimly |vaguely |clearly )?(?:knew|realized|realised|understood|could tell|felt|sensed|was certain|was sure|decided|made up (?:his|her|their) mind|became aware)\b/i;

// 抽象结论词：不可拍的命运/关系/真假宣判
const ABSTRACT_ZH = /(永远|永别|诀别|再也|从不|从来没?|真正|其实|原来|一切|注定|完了|没有退路|无路可退|不会再?回来?|回不去|回不来|原谅|信任?|真相|命运|一辈子|这一生|值得|亏欠|辜负|爱(?:上|过|着)?|恨(?:过)?|撒谎|骗(?:了|过)?他|后悔|遗憾|失去|结束了|走到头|真面目|心思|委屈|不易|苦衷|当年|为什么|缘由)/;
const ABSTRACT_EN = /\b(never|forever|always|finally|truly|really|everything|the truth|no way out|nowhere to|wouldn'?t|couldn'?t|forgive|forgiven|love|loved|hated|lying|lied|betray|regret|lost|meant to|was over|for the first time|deep down|at heart)\b/i;

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function mindReadingNarration(draft: string): MindReadingResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const cogRe = isZh ? COG_ZH : COG_EN;
  const absRe = isZh ? ABSTRACT_ZH : ABSTRACT_EN;
  const monoRe = isZh ? MONO_FRAME_ZH : MONO_FRAME_EN;

  const hits: MindReadingHit[] = [];
  let narrationLines = 0;

  draft.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line) || DIALOGUE_RE.test(line)) return;
    narrationLines++;
    if (monoRe.test(line)) return;
    if (/[？?]\s*$/.test(line)) return;

    const cm = line.match(cogRe);
    if (!cm) return;
    // 第一/二人称（画外音口吻）不判：那是角色在说话，不是叙述者读心
    if (/^[我你咱]/.test(cm[0])) return;
    if (!absRe.test(line)) return;

    // 后跟具体可验证事实：数字、引号引语、冒号台词——可拍/可证实，不判
    const after = line.slice(line.indexOf(cm[0]) + cm[0].length);
    if (/\d/.test(after)) return;
    if (/[「“"].+?[”」"]/.test(after)) return;
    if (/[：:]/.test(after)) return;

    hits.push({
      line: i + 1,
      verb: cm[0].replace(/[，。！？、\s].*$/, '').slice(-10),
      snippet: snippet(line),
      reason: isZh
        ? '叙述者替角色下抽象判断，结论只存在于脑子里，无外化动作/台词/物证，不可拍'
        : 'the narrator hands down an abstract verdict inside the character\'s head with no external action, line, or prop — unfilmable',
    });
  });

  const score = Math.max(20, 100 - hits.length * 9);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」是读心结论——把它改成观众能看见听见的东西：一个具体选择（签字/上车/挂断）、一个露馅动作（手抖/改称呼）、或一句对别人说的话`
      : `L${h.line} "${h.snippet}" is mind-reading — replace with something the audience can see or hear: a concrete choice (sign, get in, hang up), a tell (a shaking hand, a changed form of address), or words spoken to someone else`);

  const advice = isZh
    ? hits.length > 0
      ? '剧本里没有"她知道"，只有她做了什么。所有脑子里的结论都要外化成选择、动作、台词、物证——观众自己会得出那个结论，不需要叙述者替他宣判。'
      : '心理活动均已外化，无读心结论，保持。'
    : hits.length > 0
      ? 'In a script there is no "she knew", only what she does. Externalize every inner verdict into a choice, an action, a line, or a prop — let the audience reach the conclusion instead of sentencing it for them.'
      : 'Inner states are externalized; no mind-reading verdicts; keep it.';

  return { score, narrationLines, hits, issues, advice };
}
