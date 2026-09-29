import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 道理升华旁白检测（Moral Narration）
 * ============================================================
 * 治什么病：
 *   冲突刚落，镜头不落在人物的下一个动作上，旁白跳出来替观众
 *   总结人生——"这一刻，她终于明白，心软是病，情深致命"
 *   / "原来豪门婚姻从来都是一场交易"
 *   / "In that moment she finally understood that love was a ledger."
 *   主题不是讲出来的，是观众自己从行动里尝出来的。格言一出口，
 *   戏就从"正在发生"塌成"朋友圈金句"。
 *
 * 判定（仅扫叙述行，台词行整行跳过——人物嘴里说格言是声口，
 *   不是旁白点题）：
 *   A) 领悟宣告：明白/懂得/学会/看透/教会她 + 抽象道理名词
 *      （心软/善良/世界/命运/男人/婚姻/钱/人性…）同屏；
 *   B) 格言起句：原来……从来都是/不过是；这就是……代价/报应；
 *      世人都说……；英文 Life/Love/Men… is/was/never… 全知句式；
 *
 * rescue：领悟句之后 2 行内立刻跟一个具体决断动作（拉黑/摔门/
 *   撕毁/挂断/摘下戒指/blocked/slammed/tore up…）——道理没停
 *   在嘴上，变成了行为，记 rescued 不扣分。
 *
 * 与既有引擎边界：
 *   - omniscient-tease 管前瞻全知预告（她不知道的是/命运的齿轮），
 *     本引擎管后顾式领悟格言（她终于明白/原来从来都是）；
 *   - show-dont-tell 管情绪形容词，本引擎管替观众总结主题的金句；
 *   - scene-soft-ending 管末拍泄气调度，本引擎管任何位置的格言句；
 *   - 具体事实发现（原来他早就出轨了）无抽象道理词，不判。
 *
 * 计分：0 次 100；1 次未兑现 75；≥2 次 max(25, 100-n*25)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

// 台词行（话者前缀 ≤4 字，避免把"她终于懂得：……"叙述句误判成台词）；
// 格言从人物嘴里说出来是声口，跳过
const SPEAKER_RE = /^[一-鿿A-Za-z0-9·]{1,4}(?:（[^）]{0,12}）)?\s*[：:]\s*\S/;
const QUOTE_RE = /^[“"「『]/;

// A) 领悟宣告
const REALIZE_ZH = /(?:终于)?(?:明白(?:了)?|懂得(?:了)?|领悟|醒悟|学会(?:了)?|看清(?:了)?|看透(?:了)?|弄懂|教会[她他我]|上了一课|学到的一?课)/;
const LESSON_ZH = /(?:心软|善良|真心|真情|感情|爱情|爱过|婚姻|男人|女人|人性|人心|世界|命运|报应|规矩|尊严|底线|尊重|钱|金钱|亲情|友情|信任|承诺|成长|代价|宿命|缘分|现实|权势|豪门|江湖|人情|白眼|嫌弃|门当户对|深情|薄情)/;
const REALIZE_EN = /\b(?:finally (?:understood|realized|learned|saw|knew)|(?:understood|realized|learned|knew) that|the day (?:she|he) (?:finally )?(?:learned|understood)|taught (?:her|him|me) (?:that|a lesson)|learned (?:her|his) lesson)\b/i;
const LESSON_EN = /\b(?:love|loved|loves|men|women|marriage|money|power|family|families|kindness|trust|promises?|dignity|the world|life|human nature|growing up|fate|destiny|betrayal|respect|wealth|status|the rich)\b/i;

// B) 格言起句
const APHORISM_ZH = /原来[^\n。]{0,24}(?:从来都是|向来(?:都)?是|不过是|注定|总归是)|这就是(?:所谓的)?[^\n。]{0,10}(?:道理|代价|报应|人生|现实|规矩|宿命|婚姻|爱情|人性|江湖)|(?:世人|人人|所有人|老话)都(?:说|知道|讲)/;
const APHORISM_EN = /^(?:life|love|men|women|marriage|money|power|family|the world)\b[^.\n]{0,60}\b(?:is|was|never|always|meant nothing|had always been)\b/i;

// rescue：领悟后立刻变成具体动作
const RESCUE_ZH = /(?:拉黑|删了?(?:掉)?|挂断|摔门|夺门|撕(?:碎|毁)|摘下戒指|撸下戒指|辞职|转头就走|没再回头|再没回头|拿钱砸|甩在|拍在|按下删除|扔进(?:垃圾桶|火)|塞回|夺过|拒接|开门就走)/;
const RESCUE_EN = /\b(?:blocked|slammed (?:the door|it)|tore up|hung up|handed in (?:her|his) resignation|didn'?t look back|never looked back|deleted (?:the number|him|her|it)|marched out|walked out|ripped up|threw (?:it|the ring)|pulled off (?:the|her) ring)\b/i;

export interface MoralNarrationHit {
  line: number;
  kind: 'realization' | 'aphorism';
  phrase: string;
  snippet: string;
  rescued: boolean;
  rescueLine?: number;
  reason: string;
}

export interface MoralNarrationResult {
  score: number;
  narrationLines: number;
  hits: MoralNarrationHit[];
  issues: string[];
  advice: string;
}

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * 检测道理升华旁白。
 */
export function moralNarration(draft: string): MoralNarrationResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const lines = draft.split(/\r?\n/);
  const hits: MoralNarrationHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    if (SPEAKER_RE.test(line) || QUOTE_RE.test(line)) return;
    narrationLines++;

    let kind: 'realization' | 'aphorism' | null = null;
    let phrase = '';
    if (isZh) {
      const r = line.match(REALIZE_ZH);
      if (r && LESSON_ZH.test(line)) {
        kind = 'realization';
        phrase = r[0];
      } else {
        const a = line.match(APHORISM_ZH);
        if (a) {
          kind = 'aphorism';
          phrase = a[0];
        }
      }
    } else {
      const r = line.match(REALIZE_EN);
      if (r && LESSON_EN.test(line)) {
        kind = 'realization';
        phrase = r[0];
      } else if (APHORISM_EN.test(line)) {
        kind = 'aphorism';
        phrase = 'aphorism';
      }
    }
    if (!kind) return;

    // rescue：后 2 个非空行内、换场前出现具体决断动作
    let rescued = false;
    let rescueLine: number | undefined;
    const rescueRe = isZh ? RESCUE_ZH : RESCUE_EN;
    for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
      const near = lines[k].trim();
      if (!near) continue;
      if (isSceneHeaderLine(near)) break;
      if (SPEAKER_RE.test(near)) continue;
      if (rescueRe.test(near)) {
        rescued = true;
        rescueLine = k + 1;
        break;
      }
    }

    hits.push({
      line: i + 1,
      kind,
      phrase,
      snippet: snippet(line, isZh ? 30 : 48),
      rescued,
      rescueLine,
      reason: kind === 'realization'
        ? (isZh ? '领悟被直接说出口，替观众总结主题' : 'The lesson is announced instead of dramatized')
        : (isZh ? '格言式旁白跳出场景下定义' : 'Aphorism narration steps outside the scene'),
    });
  });

  const bad = hits.filter((h) => !h.rescued);
  const n = bad.length;
  const score = n === 0 ? 100 : n === 1 ? 75 : Math.max(25, 100 - n * 25);
  const issues = bad.map((h) => (isZh
    ? `第${h.line}行：道理升华旁白「${h.snippet}」——${h.reason}，删掉金句，让人物的下一个动作替你点题`
    : `L${h.line}: moral narration "${h.snippet}" — ${h.reason}; cut the aphorism and let the next action carry the theme`));
  const advice = isZh
    ? '主题不能靠旁白喊出来：删掉"她终于明白/原来从来都是"式金句，把领悟翻译成一个拦不住的具体动作——拉黑、摔门、撕协议、摘戒指。观众自己会尝出道理。'
    : 'Never let the narrator deliver the thesis: cut "she finally understood" and standalone aphorisms. Translate the realization into one unstoppable physical action — block, slam, tear up, walk out — and let the audience taste the theme.';

  return { score, narrationLines, hits, issues, advice };
}
