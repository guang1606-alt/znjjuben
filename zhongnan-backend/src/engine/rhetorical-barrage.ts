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
