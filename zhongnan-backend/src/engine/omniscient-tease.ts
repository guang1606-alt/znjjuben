import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 全知预告/伪悬念检测（Omniscient Tease）
 * -----------------------------------------------------------
 * 创作能力类引擎：分镜本是人物的现在时，不是说书人的下回分解。
 * AI 改稿最爱的偷懒收尾——写不出真钩子，就让叙述者跳出来发预告：
 *   她不知道的是，一场更大的风暴正在等着她。
 *   此刻的她还不知道，自己已经走进了圈套。
 *   命运的齿轮开始转动，这只是开始。
 *   Little did she know, everything was about to change.
 * 问题：
 *  1) 视角越权——镜头只能拍人物此刻的所知所行，拍不出"她不知道的事"；
 *  2) 假悬念——用"将有大事发生"的空承诺替代一个真能拍出来的未解动作；
 *  3) 定调腔——命运/风暴/齿轮全是无法落地的宏大词，导演无画面可给。
 *
 * 判定（只扫叙述行）：
 *  A. 全知框架（强，直接判）：她不知道的是/她哪里知道/此刻的她还不知道/
 *     浑然不知/蒙在鼓里/little did she know/unbeknownst to her；
 *  B. 弱认知句 + 悬念空词共现（窗口内有"风暴/圈套/等着她/即将/真相"）：
 *     "他没想到……"紧接具体事实（"母亲会来/密码是错的"）豁免——
 *     那是正常事后反应，不是预告；
 *  C. 章末定调预告：命运的齿轮/这只是开始/真正的风暴/a bigger storm/
 *     wheels of fate/this was only the beginning。
 *
 * 边界：cliffhanger/punchline 把 little did 当"反转装置类型词"识别，
 * 本引擎判的是该装置"叙述者越权、无画面"的写法本身，维度不同。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface TeaseHit {
  line: number;
  kind: 'omniscient' | 'tail';
  phrase: string;
  snippet: string;
  reason: string;
}

export interface OmniscientTeaseResult {
  score: number;
  narrationLines: number;
  hits: TeaseHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// A. 强全知框架：出现即判
const STRONG_ZH = /(她|他)(?:不知道的是|哪里知道|做梦也(?:想不到|不会想到))|(?:此时|此刻)的(?:她|他)[^。！？\n]{0,8}(?:不知道|没想到|浑然不觉|蒙在鼓里)|蒙在鼓里|浑然不知|一无所知/;
const STRONG_EN = /\b(?:little did (?:she|he|they|i) know|unbeknownst to (?:her|him|them)|what (?:she|he|they) didn'?t know was (?:that|coming))\b/i;

// B. 弱认知句（需与悬念空词共现才判）
const WEAK_ZH = /(?:她|他)(?:还|仍|并|完全|丝毫|浑然)?(?:不知道|没(?:有)?想到|不曾想到|无从知道|想不到|没(?:有)?察觉)([^。！？\n]{0,24})/;
const WEAK_EN = /\b(?:she|he) had no idea\b[^.\n]{0,30}/i;

// 悬念空词：承诺"将有大事"，但没有任何可拍的具体动作
const SUSPENSE_ZH = /(一场(?:更|大|惊)|更大的|风暴|战争|阴谋|危机|劫难|考验|陷阱|圈套|埋伏|等着(?:她|他)|等待(?:着)?(?:她|他)|即将|就要来临|就在(?:眼前|身后|不远处)|命运|秘密|真相|这只是|才刚刚开始|将是|改变(?:她|他)?(?:一生|命运)|万劫不复|坠入|吞噬)/;
const SUSPENSE_EN = /\b(?:a (?:much )?bigger (?:storm|war|conspiracy|crisis|trap)|what (?:awaited|was coming|lay ahead)|everything (?:was|is) about to change|about to (?:unfold|begin|change)|a storm (?:was )?(?:brewing|coming)|the truth (?:that|which)|her life (?:was )?about to|would soon (?:regret|discover|learn))\b/i;

// C. 章末定调预告
const TAIL_ZH = /(命运的齿轮|这只是(?:个)?开始(?=[。！？\s]|$)|故事才刚刚开始|真正的(?:风暴|考验|战争|较量|阴谋)(?:才|即将|马上)|一场更大的(?:风暴|战争|阴谋|危机|较量)|等待(?:着)?(?:她|他)的?将是|暴风雨(?:即将|就要)来临)/;
const TAIL_EN = /\b(?:the wheels of fate(?: had)?(?: already)?(?: begun to)? turn(?:ed)?|this was only the beginning|(?:had|has) only just begun|a (?:much )?bigger storm (?:was )?(?:brewing|coming)|what awaited (?:her|him) (?:was|next)|everything was about to change)\b/i;

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function omniscientTease(draft: string): OmniscientTeaseResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const strongRe = isZh ? STRONG_ZH : STRONG_EN;
  const weakRe = isZh ? WEAK_ZH : WEAK_EN;
  const suspRe = isZh ? SUSPENSE_ZH : SUSPENSE_EN;
  const tailRe = isZh ? TAIL_ZH : TAIL_EN;

  const lines = draft.split(/\r?\n/);
  const hits: TeaseHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) return;
    if (DIALOGUE_RE.test(line)) return;
    narrationLines++;

    // C. 章末定调（独立判）
    const tm = line.match(tailRe);
    if (tm) {
      hits.push({
        line: i + 1, kind: 'tail', phrase: tm[0], snippet: snippet(line),
        reason: isZh
          ? '宏大预告腔：命运/风暴/齿轮没有画面，是用"将有大事"的空承诺冒充钩子'
          : 'a grand trailer line — fate, storms and wheels carry no image; an empty promise of "big things coming" pretends to be a hook',
      });
      return;
    }

    // A. 强全知框架
    const sm = line.match(strongRe);
    if (sm) {
      hits.push({
        line: i + 1, kind: 'omniscient', phrase: sm[0], snippet: snippet(line),
        reason: isZh
          ? '叙述者越过角色视角宣布"她不知道的事"，镜头拍不出人物未知之物，是说书人式假悬念'
          : 'the narrator announces what the character cannot know; the camera cannot film a character\'s unknown — a fake, narrator-held mystery',
      });
      return;
    }

    // B. 弱认知句 + 悬念空词
    const wm = line.match(weakRe);
    if (wm) {
      const window = isZh ? (wm[1] ?? '') : wm[0];
      if (suspRe.test(window)) {
        hits.push({
          line: i + 1, kind: 'omniscient', phrase: wm[0].slice(0, 10), snippet: snippet(line),
          reason: isZh
            ? '"没想到/不知道"后面接的是空泛预告而非具体事实，用全知视角吊着观众，不是人物此刻能演的反应'
            : 'the "had no idea" line is followed by a vague tease rather than a concrete fact — omniscient withholding, not an actable reaction',
        });
      }
    }
  });

  const score = Math.max(25, 100 - hits.length * 11);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」是全知预告——删掉叙述者的剧透腔，把悬念改成此刻可拍的未解动作：一只被藏起来的手、一句被门铃打断的话、一个对不上的时间`
      : `L${h.line} "${h.snippet}" is an omniscient tease — cut the narrator's trailer voice and turn the mystery into a shootable open action in the present: a hidden hand, a sentence cut by the doorbell, a time that does not add up`);

  const advice = isZh
    ? hits.length > 0
      ? '剧本只拍人物此刻知道的东西。真钩子不是"将要发生大事"，而是观众此刻就看见、但角色没看懂的一个具体动作或物证。删掉全知预告，把未来时改成正在进行时。'
      : '悬念都落在此刻可见可拍的动作与物证上，无全知越权，保持。'
    : hits.length > 0
      ? 'A script films only what the character knows now. A real hook is not "something big is coming" but a concrete action or object the audience sees now and the character misreads. Cut omniscient teasers; trade future tense for present continuous.'
      : 'Mystery lives in actions and evidence visible and filmable now, with no omniscient overreach; keep it.';

  return { score, narrationLines, hits, issues, advice };
}

/**
 * 前置教学：buildOmniscientTeaseDirective(_format='LIVE', lang='zh')
 * -------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 omniscientTease 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"叙述者越权发预告"的三类判定与具体事实豁免口径，
 *       避免写完被 prePolish teaseHint 与 craft/deai 复评打回。
 */
export function buildOmniscientTeaseDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Omniscient Tease Pre-Writing Briefing (same source as omniscientTease: the narrator jumps ahead to tease; 11 points per hit; floor 25)】',
      '- Scope: narration lines only; scene headers and "speaker: line" dialogue lines are skipped, and the rest count as narration lines for diagnostics.',
      '- Order of judgement: the chapter-end tail check runs first and independently, then the strong omniscient frame, then the weak cognition sentence plus suspense-word co-occurrence; the first match on a line wins, so each line scores at most one hit.',
      '- A strong frame: little did she / he / they / I know, unbeknownst to her / him / them, or what she / he / they didn\'t know was, recorded as kind omniscient.',
      '- B weak cognition: she / he had no idea followed within 30 characters by a suspense word is recorded as kind omniscient.',
      '- B suspense words: a bigger storm / war / conspiracy / crisis / trap, what awaited / was coming / lay ahead, everything was about to change, about to unfold / begin / change, a storm brewing / coming, the truth that / which, her life about to, would soon regret / discover / learn.',
      '- B concrete-fact exemption: when "had no idea" is followed by a filmable fact (her mother was coming / the password was wrong), it is a normal after-the-fact reaction, not a tease, and is not judged.',
      '- C tail: the wheels of fate turned / this was only the beginning / had only just begun / a bigger storm brewing / what awaited her / everything was about to change, recorded as kind tail.',
      '- Hit fields: line, kind (omniscient / tail), phrase, snippet (first 30 characters) and reason are returned so the polisher can locate the overreach.',
      '- Score: max(25, 100 - hits x 11); empty draft = 100.',
      '- Rewrite: trade future tense for present continuous — a hidden hand, a sentence cut off by the doorbell, a time that does not add up; the audience sees it now while the character misreads it.',
      '- Division: cliffhanger and punchline recognize "little did" as a twist-device type word; this engine judges the narrator-overreach, no-image writing itself, a different dimension.',
      '- Pipeline consumption: prePolish injects hits into the polisher as teaseHint; craft initial, craft re-eval and deai rescan consume the same result, and the deai dimension carries 0.01 weight.',
      '- Self-check: can the camera film this line right now? If not, cut the tease and replace it with an unresolved action visible in the present.',
    ].join('\n');
  }
  return [
    '【全知预告·前置教学（检测同源：omniscientTease 让叙述者跳到未来发预告，每条命中扣 11 分，25 分封底）】',
    '- 检测范围：只扫叙述行；场头与「说话人：台词」行跳过，其余行计入 narrationLines（仅诊断）。',
    '- 判定顺序：先章末定调（C，独立判），再强全知框架（A），最后弱认知句+悬念空词（B）；一行命中即停，每行最多记一条。',
    '- A·强全知框架：出现即判——她不知道的是/她哪里知道/她做梦也想不到/此刻的她还不知道/蒙在鼓里/浑然不知/一无所知 → 记 omniscient；英文 little did she know / unbeknownst to her / what she didn\'t know was。',
    '- B·弱认知句：她/他 + 还不知道/没想到/不曾想到/想不到/没察觉 后接 24 字窗口（英文 she had no idea 后 30 字符），窗口内出现悬念空词才判，记 omniscient。',
    '- B·悬念空词表：一场更大/更大的/风暴/战争/阴谋/危机/劫难/考验/陷阱/圈套/埋伏/等着她/等待着她/即将/就要来临/就在眼前/就在身后/命运/秘密/真相/这只是/才刚刚开始/将是/改变一生/改变命运/万劫不复/坠入/吞噬。',
    '- B·具体事实豁免："她没想到"后接可拍的具体事实（母亲会来/密码是错的/门没锁）不算预告，是正常事后反应，不记命中。',
    '- C·章末定调：命运的齿轮/这只是个开始/故事才刚刚开始/真正的风暴才/一场更大的风暴/等待她的将是/暴风雨即将来临 → 记 tail；英文 wheels of fate / this was only the beginning / had only just begun / a bigger storm / what awaited her / everything was about to change。',
    '- 命中字段：line（行号）、kind（omniscient/tail）、phrase（命中短语）、snippet（前 30 字）、reason 随命中返回，供润色师定位。',
    '- 得分：score = max(25, 100 - 命中条数 × 11)；空稿 100。',
    '- 改写方向：把未来时改成正在进行时——一只被藏起来的手、一句被门铃打断的话、一个对不上的时间，观众此刻看见但角色没看懂。',
    '- 与 cliffhanger/punchline 分界：它们把 little did 当反转装置类型词来识别；本引擎判的是该装置"叙述者越权、没有画面"的写法本身，维度不同。',
    '- pipeline 消费：prePolish 把命中注入润色师（teaseHint）；craft 初评、craft 复评、deai 复扫同一结果，deai 维度占 0.01 权重，并随管线返回值透出。',
    '- 成稿自查：这一句镜头此刻拍得到吗？拍不到就删掉预告，换成一个现在就能看见的未解动作。',
  ].join('\n');
}
