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

/**
 * 前置教学：buildMindReadingNarrationDirective(_format='LIVE', lang='zh')
 * ---------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 mindReadingNarration 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"叙述者读心、抽象结论直给"的检测口径，
 *       避免写完被 prePolish mindHint 与 craft/deai 复评打回。
 */
export function buildMindReadingNarrationDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Mind-Reading Narration Pre-Writing Briefing (same source as mindReadingNarration: the narrator hands down an inner verdict; 9 points per hit; floor 20)】',
      '- Scope: non-dialogue narration lines only; scene headers and "speaker: line" dialogue lines are skipped, and the rest count as narration lines.',
      '- Exemption one: explicit inner-monologue frames (thought to himself / said to herself) belong to show-dont-tell and are skipped here.',
      '- Exemption two: lines ending with a question mark are skipped.',
      '- Rule one: third person subject (he / she / they / the man / the woman) plus a cognitive verb (knew / realized / understood / could tell / felt / sensed / was certain / was sure / decided / made up his mind / became aware), with optional time or manner adverbs such as finally, suddenly, dimly, vaguely or clearly.',
      '- Rule two: the same line must carry an abstract verdict word (never / forever / always / finally / truly / everything / the truth / no way out / nowhere to / forgive / love / hate / lied / betray / regret / lost / meant to / was over / for the first time / deep down / at heart).',
      '- Voice exemption: a subject starting with first or second person (I / we / you) is a character speaking, not the narrator reading minds, so it is skipped.',
      '- Verifiable-fact exemption: text after the cognitive verb containing a digit, quoted speech, or a colon is filmable and provable, so it is skipped.',
      '- Hit fields: line, verb (last 10 characters of the matched cognitive phrase), snippet and reason are returned so the polisher can locate the verdict.',
      '- Score: max(20, 100 - hits x 9); empty draft = 100.',
      '- Diagnostics: narrationLines is display-only and never charged.',
      '- Rewrite: externalize the verdict into a concrete choice (sign, get in the car, hang up), a tell (a shaking hand, a changed form of address), or words spoken to someone else.',
      '- Division: show-dont-tell covers explicit inner-monologue markers; this engine only judges free indirect verdicts without the marker.',
      '- Division: subtext-erase must sit next to a dialogue line and annotate its meaning; this engine needs no dialogue anchor and judges inner verdicts.',
      '- Division: cheat-rule-check treats mind reading as a genre ability with rules and costs; this engine judges narration technique, not genre powers.',
      '- Pipeline consumption: prePolish injects mindHint into the polisher; craft initial, craft re-eval and deai rescan the same result.',
      '- Self-check: can the camera shoot this line? If not, delete the verdict and write what she actually did.',
    ].join('\n');
  }
  return [
    '【叙述者读心·前置教学（检测同源：mindReadingNarration 叙述者钻进角色脑子下抽象结论，每条命中扣 9 分，20 分封底）】',
    '- 检测范围：只扫非台词的叙述行；场头与「说话人：台词」行跳过，其余行计入 narrationLines（仅诊断）。',
    '- 豁免一·显性内心独白：句子含 心想/暗想/暗忖/心道/心中暗/内心想/心里想/嘀咕 → 归 show-dont-tell，本引擎不报。',
    '- 豁免二·问句：叙述行以问号（？/?）结尾 → 不判。',
    '- 口径一·第三人称认知框架：主语为他/她/它/那人/男人/女人等，中间可带时间/神态副词（这才/此刻/这时/那刻/当时/突然/忽然/终于/隐隐/隐约/分明/清楚/清晰地/心里），后接认知动词（知道/明白/意识到/发现/发觉/懂了/懂得/确信/深信/认定/感到/感觉/觉得/清楚/下定决心/决定/这才明白）。',
    '- 口径二·抽象结论词：同一行必须含不可拍的宣判词（永远/永别/诀别/再也/从不/从来没/真正/其实/原来/一切/注定/完了/没有退路/无路可退/不会再回来/回不去/回不来/原谅/信任/真相/命运/一辈子/这一生/值得/亏欠/辜负/爱/恨/撒谎/骗了他/后悔/遗憾/失去/结束了/走到头/真面目/心思/委屈/不易/苦衷/当年/为什么/缘由）。',
    '- 人称豁免：认知框架的主语以我/你/咱开头 → 那是角色在说话（画外音），不是叙述者读心，不判。',
    '- 可验证事实豁免：认知动词之后的部分含数字、引号引语（「…」/“…”）或冒号 → 可拍可证实，不判。',
    '- 命中字段：line（行号）、verb（认知短语末 10 字）、snippet（前 30 字）、reason 随命中返回，供润色师定位。',
    '- 得分：score = max(20, 100 - 命中条数 × 9)；空稿 100。',
    '- 改写方向：把结论外化成三样之一——具体选择（签字/上车/挂断）、露馅动作（手抖/改称呼）、对别人说的一句话；观众自己会得出那个结论。',
    '- 与 show-dont-tell 分界：它管「心想/暗想/he thought」这类显性标记词；本引擎只判没有标记的自由间接引语式宣判。',
    '- 与 subtext-erase 分界：它必须紧邻台词、替台词做注解；本引擎不需要对白锚点，只判角色脑内的抽象结论。',
    '- 与 cheat-rule-check 分界：它把读心当金手指能力查规则与代价；本引擎查叙述技法，不管题材能力。',
    '- pipeline 消费：prePolish 把命中注入润色师（mindHint）；craft 初评、craft 复评、deai 复扫同一结果。',
    '- 成稿自查：这句话镜头拍得出来吗？拍不出来就删掉结论，写她实际做了什么。',
  ].join('\n');
}
