import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 反问连珠检测（Rhetorical Barrage）
 * -----------------------------------------------------------
 * 创作能力类引擎：AI 写撒泼/质问戏有个偷懒套路——
 * 一个角色连珠炮似地甩问号，靠气势代替内容：
 *   林棠：你凭什么查我手机？
 *   沈知远：我……
 *   林棠：你有什么资格翻我东西？
 *   沈知远：你听我解释。
 *   林棠：解释？你配吗？
 * 三个反问，零事实增量，戏在原地吼。好质问是每一问都
 * 钉一个新事实、逼对方暴露新立场；问号本身不是信息量。
 *
 * 判定（求精度）：
 *  - 单句 ≥3 个问号；或
 *  - 同一说话人在同一场连续 ≥3 个问号句（中间至多夹 1 句
 *    对方的短回应：zh≤8字 / en≤5词），
 *    且至少 1 句带反问框架词（凭什么/难道/how dare…）。
 *
 * 边界：dialogue-pingpong 管跨说话人"问→直答"接球链，
 * 反问在那里算健康的不接球；本引擎专管同一人质问倾泻。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface BarrageHit {
  sceneHeader: string;
  speaker: string;
  startLine: number;
  endLine: number;
  questionCount: number;
  evidence: string[];
  reason: string;
}

export interface BarrageResult {
  score: number;
  dialogueLines: number;
  hits: BarrageHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


// 反问框架词：质问语气标记（命中才报，避免误伤正常追问）
const FRAME_ZH = /(凭什么|有什么资格|你配|难道|至于吗|你是不是|你知不知道|你知道.{0,4}吗|还想|还要脸|讲不讲|有没有良心|算什么|当我.{0,3}吗|你管得着)/;
const FRAME_EN = /\b(who do you think|how dare|do you even|why should i|what gives you the right|how could you|are you (?:kidding|serious)|you know what|don'?t you (?:dare|care)|what kind of|since when)\b/i;

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

const countQ = (s: string): number => (s.match(/[？?]/g) || []).length;
const bareLen = (s: string, isZh: boolean): number =>
  isZh ? s.replace(/[，。！？、…：；""''（）()\s,.!?:;'"()-]/g, '').length : s.replace(/[.,!?;:'"()-]/g, '').split(/\s+/).filter(Boolean).length;
const snippet = (s: string): string => (s.length > 24 ? `${s.slice(0, 24)}…` : s);

interface U { speaker: string; text: string; line: number; isDialogue: boolean }

export function rhetoricalBarrage(draft: string): BarrageResult {
  if (!draft || !draft.trim()) {
    return { score: 100, dialogueLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const frameRe = isZh ? FRAME_ZH : FRAME_EN;

  const scenes: { header: string; units: U[] }[] = [];
  let header = isZh ? '(开场)' : '(opening)';
  let units: U[] = [];
  const flush = () => { if (units.length) scenes.push({ header, units }); units = []; };
  draft.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { flush(); header = line; return; }
    const dm = line.match(DIALOGUE_RE);
    units.push(dm
      ? { speaker: dm[1].trim(), text: dm[2].trim(), line: i + 1, isDialogue: true }
      : { speaker: '', text: line, line: i + 1, isDialogue: false });
  });
  flush();

  const hits: BarrageHit[] = [];
  let dialogueLines = 0;

  for (const sc of scenes) {
    const dUnits = sc.units.filter((u) => u.isDialogue);
    dialogueLines += dUnits.length;

    // ① 单句 ≥3 问号
    for (const u of dUnits) {
      const n = countQ(u.text);
      if (n >= 3 && frameRe.test(u.text)) {
        hits.push({
          sceneHeader: sc.header, speaker: u.speaker, startLine: u.line, endLine: u.line,
          questionCount: n, evidence: [`${u.speaker}: ${snippet(u.text)}`],
          reason: isZh ? `单句 ${n} 个反问，质问倾泻无事实增量` : `${n} questions in one line, barraged without new facts`,
        });
      }
    }

    // ② 同 speaker 连续 ≥3 问句（中间至多夹 1 句对方短回应）
    for (let i = 0; i < dUnits.length; i++) {
      const first = dUnits[i];
      if (countQ(first.text) === 0) continue;
      const chain: U[] = [first];
      let j = i + 1;
      while (j < dUnits.length && chain.length < 6) {
        const u = dUnits[j];
        if (u.speaker === first.speaker && countQ(u.text) > 0) {
          chain.push(u);
          j++;
          continue;
        }
        // 允许夹一句对方短回应，其后必须紧跟同一 speaker 的问句
        if (u.speaker !== first.speaker && bareLen(u.text, isZh) <= (isZh ? 8 : 5)) {
          const nxt = dUnits[j + 1];
          if (nxt && nxt.speaker === first.speaker && countQ(nxt.text) > 0) {
            j += 2;
            chain.push(nxt);
            continue;
          }
        }
        break;
      }
      if (chain.length >= 3 && chain.some((u) => frameRe.test(u.text))) {
        hits.push({
          sceneHeader: sc.header, speaker: first.speaker,
          startLine: chain[0].line, endLine: chain[chain.length - 1].line,
          questionCount: chain.length,
          evidence: chain.slice(0, 4).map((u) => `${u.speaker}: ${snippet(u.text)}`),
          reason: isZh
            ? `${first.speaker}连发${chain.length}问，气势代替内容，缺新事实`
            : `${first.speaker} fires ${chain.length} questions in a row — volume instead of new facts`,
        });
        i = j - 1;
      }
    }
  }

  const score = Math.max(20, 100 - hits.length * 12);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `「${h.sceneHeader}」${h.reason}（第${h.startLine}${h.endLine > h.startLine ? `-${h.endLine}` : ''}行）——每一问钉一个新事实或逼出新立场，答不出新东西的问号删掉，改成动作或具体指控`
      : `"${h.sceneHeader}" ${h.reason} (L${h.startLine}${h.endLine > h.startLine ? `-${h.endLine}` : ''}) — make every question pin a new fact or force a new position; cut empty questions and replace with action or a concrete accusation`);

  const advice = isZh
    ? hits.length > 0
      ? '质问戏不是比谁嗓门大。把反问拆成事实：每一问必须钉出一个新信息或逼对方选边；答不出新东西的问号删掉，用动作和具体指控顶上去。'
      : '问句都带事实增量或立场逼迫，无反问连珠，保持。'
    : hits.length > 0
      ? 'Interrogation is not a shouting contest. Turn each question into a fact: every one must surface new information or force a side. Delete empty questions and replace them with action or concrete accusations.'
      : 'Questions carry new facts or force positions; no rhetorical barrage; keep it.';

  return { score, dialogueLines, hits, issues, advice };
}

/**
 * 前置教学：buildRhetoricalBarrageDirective(_format='LIVE', lang='zh')
 * -----------------------------------------------------------------
 * 同源铁律：教学函数与检测器 rhetoricalBarrage 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"同一人反问连珠、气势代替事实"的检测口径，
 *       避免写完被 prePolish barrageHint 与 craft/deai 复评打回。
 */
export function buildRhetoricalBarrageDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Rhetorical Barrage Pre-Writing Briefing (same source as rhetoricalBarrage: one speaker firing questions instead of facts; 12 points per hit; floor 20)】',
      '- Scope: only "speaker: line" dialogue lines (speaker 1-12 chars, optional parenthetical action); scene headers split scenes; the opening block is labeled "(opening)".',
      '- Rule one — single line: 3 or more question marks in one dialogue line AND at least one rhetorical frame phrase in the same line.',
      '- Rule two — chain: the same speaker fires 3 or more question-bearing lines in a row inside one scene, with at most one short reply from the other side in between (8 characters or fewer in Chinese, 5 words or fewer in English); the chain is capped at 6 lines and at least one line must carry a frame phrase.',
      '- Frame phrases in English: who do you think / how dare / do you even / why should I / what gives you the right / how could you / are you kidding or serious / you know what / do not you dare or care / what kind of / since when.',
      '- The two rules are judged independently and may both fire on the same stretch of dialogue.',
      '- Short scenes and empty drafts: no dialogue line means no hit; empty draft = 100.',
      '- Hit fields: sceneHeader, speaker, startLine / endLine, questionCount and up to 4 evidence lines are returned so the polisher can locate the barrage.',
      '- Score: max(20, 100 - hits x 12); empty draft = 100.',
      '- Diagnostics: dialogueLines is display-only and never charged.',
      '- Rewrite: keep the single hardest question, turn the rest into statements, actions or silence; every question must pin a new fact or force the other side to pick a position; delete any question that cannot surface new information.',
      '- Division: dialogue-pingpong covers the cross-speaker question-to-direct-answer chain, where a rhetorical question counts as healthy non-receipt; this engine only judges one speaker barraging.',
      '- Division: self-pity-litany covers inward self-pity litany; this engine only judges outward attack by questions.',
      '- Pipeline consumption: prePolish lists the barrage into the polisher hint (barrageHint); craft initial, craft re-eval and deai rescan the same result.',
      '- Self-check: how many question marks sit on one line? If a question can be deleted without losing information or a position change, it is volume, not drama.',
    ].join('\n');
  }
  return [
    '【反问连珠·前置教学（检测同源：rhetoricalBarrage 同一人连发问句、气势代替事实，每条命中扣 12 分，20 分封底）】',
    '- 场景切分：按场头切场（isSceneHeaderLine 同源），开场段记作「(开场)」；每场独立判定，命中按处计。',
    '- 检测范围：只扫「说话人：台词」行（说话人 1-12 字，可带（括号）动作提示，全/半角冒号均可）；场头与无冒号动作行不参与。',
    '- 口径一·单句：同一句台词出现 ≥3 个问号（？/?），且该句至少含 1 个反问框架词 → 记一条。',
    '- 口径二·链式：同一说话人在同一场连续 ≥3 句带问号的台词，中间至多夹 1 句对方的短回应（中文去标点 ≤8 字、英文 ≤5 词），链条上限 6 句，且至少 1 句带反问框架词 → 记一条。',
    '- 框架词（中文）：凭什么/有什么资格/你配/难道/至于吗/你是不是/你知不知道/你知道…吗/还想/还要脸/讲不讲/有没有良心/算什么/当我…吗/你管得着。',
    '- 框架词（英文）：who do you think / how dare / do you even / why should i / what gives you the right / how could you / are you kidding 或 serious / you know what / do not you dare 或 care / what kind of / since when。',
    '- 两口径独立：单句判与链式判互不排斥，同一处可以各记一条。',
    '- 短场跳过：没有台词行的场次不判；空稿 100。',
    '- 命中字段：sceneHeader（场头）、speaker（连问者）、startLine/endLine（起止行）、questionCount（问句数）、evidence（至多 4 句样本）随命中返回，供润色师定位。',
    '- 得分：score = max(20, 100 - 命中处数 × 12)；空稿 100。',
    '- 诊断字段：dialogueLines（台词行数）只做展示，不参与扣分。',
    '- 改写方向：只留最狠的那一问，其余改成陈述、动作或静场；每一问必须钉出一个新事实或逼对方选边，答不出新东西的问号删掉。',
    '- 与 dialogue-pingpong 分界：它管跨说话人「问→直答」接球链，反问在那里算健康的不接球；本引擎只判同一人质问倾泻。',
    '- 与 self-pity-litany 分界：它管向内自怜的排比诉苦；本引擎只判向外攻击的反问连珠。',
    '- pipeline 消费：prePolish 把命中逐条注入润色师（barrageHint）；craft 初评、craft 复评、deai 复扫同一结果。',
    '- 成稿自查：同一句里有几个问号？哪一问删掉后信息量和立场都没变？那一问就是气势不是戏，删掉换成动作或具体指控。',
  ].join('\n');
}
