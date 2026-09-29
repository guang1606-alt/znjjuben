import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 机械问答乒乓对白检测（Dialogue Ping-Pong / Q&A On Rails）
 * ------------------------------------------------------------------
 * 创作能力类引擎：AI 对话最假的特征——A 问 B 直答、句句接球，
 * 没有回避、反问、答非所问、打断、沉默。真实交谈充满"不接球"。
 *
 * 检测（按场景，纯确定性）：
 *  - 提取两人交替连续对白段；
 *  - Q：以问号结尾或疑问语气词收尾；
 *  - A（机械直答）：紧跟的对方短句（≤12字/词）或以直答词开头
 *    （是/不是/对/没有/嗯/因为 / yes/no/because…）；
 *  - 健康不接球：对方也在问（反问）、含回避语（没什么/随便/算了/凭什么）；
 *  - 判过密：出现 ≥3 连 Q→直答，或一段中问句被直答率 >60%（且问句≥4）。
 *
 * 查重：subtext-check 只给回避正信号、dialogue-water 管水分、dialogue-functionality 管功能；
 * 均不检测问答交替结构，无重叠。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface PingpongScene {
  sceneHeader: string;
  questionCount: number;
  directAnswerCount: number;
  maxChain: number;
  overused: boolean;
  evidence: string[];
}

export interface DialoguePingpongResult {
  score: number;
  scenes: PingpongScene[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


interface DLine { speaker: string; speech: string }

function isQuestionZh(s: string): boolean {
  if (/[？?]\s*$/.test(s)) return true;
  // 疑问语气词收尾（去标点后）
  const tail = s.replace(/[。！？!?…\s]+$/g, '');
  return /(吗|嘛|呢|么|啊|吧|何人|何时|何地|为什么|怎么|怎样|多少|几点|哪)$/.test(tail);
}

function isQuestionEn(s: string): boolean {
  if (/\?\s*$/.test(s)) return true;
  return /^(what|who|when|where|why|how|do|does|did|is|are|was|were|can|could|would|will|have|has|had)\b/i.test(s);
}

// 机械直答：短应答 或 直答词开头
const DIRECT_START_ZH = ['是', '不是', '对', '没错', '没有', '没', '嗯', '好', '因为', '当然', '知道', '可以', '行', '别'];
const DIRECT_START_EN = ['yes', 'no', 'yeah', 'yep', 'nope', 'because', 'sure', 'of course', 'correct', 'right', 'fine', 'okay', 'ok', 'never'];

// 回避/不接球信号
const DEFLECT_ZH = ['没什么', '随便', '算了', '凭什么', '关你', '别管', '不想说', '你管', '再说吧', '不知道', '无可奉告'];
const DEFLECT_EN = ['nothing', 'never mind', "doesn't matter", 'none of your', 'no comment', 'not telling', 'whatever', 'why do you care'];

// 沉默/拒绝作答 = 健康留白，不算直答
const SILENCE_ZH = ['沉默', '不语', '没说话', '没有说话', '一言不发', '不作声', '没吭声', '不吭声', '闭口'];
const SILENCE_EN = ['silence', 'silent', 'no answer', 'no reply', "doesn't answer", "doesn't respond", 'says nothing', 'stays quiet'];

// 命令/呵斥开头（英文无感叹号时也可能是命令，不是回答）
const IMPERATIVE_EN = ['answer me', 'answer the question', 'tell me', 'shut up', 'stop it', 'wait', 'look', 'speak', 'talk', 'come on', 'enough'];

function isDirectAnswer(s: string, isZh: boolean): boolean {
  // 反问/连续提问 = 不接球
  if ((isZh ? isQuestionZh(s) : isQuestionEn(s))) return false;
  const deflect = isZh ? DEFLECT_ZH : DEFLECT_EN;
  const silence = isZh ? SILENCE_ZH : SILENCE_EN;
  const lower = s.toLowerCase();
  if (deflect.some((w) => (isZh ? s.includes(w) : lower.includes(w)))) return false;
  const bare = s.replace(/^[（(\s]+|[）)\s]+$/g, '');
  if (silence.some((w) => (isZh ? bare.includes(w) : lower.includes(w)))) return false;
  const len = isZh ? bare.replace(/[，。！？、\s]/g, '').length : bare.split(/\s+/).length;
  const starts = isZh ? DIRECT_START_ZH : DIRECT_START_EN;
  if (starts.some((w) => (isZh ? s.startsWith(w) : lower.startsWith(w)))) return true;
  // 短促命令/呵斥（感叹结尾且非答词开头）不是回答
  if (/[！!]\s*$/.test(s)) return false;
  if (!isZh && IMPERATIVE_EN.some((w) => lower.startsWith(w))) return false;
  return len <= (isZh ? 12 : 8);
}

function parseScene(body: string): DLine[] {
  const out: DLine[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^([^\s：:]{1,12})\s*[：:]\s*(.+)$/);
    if (m) {
      const speech = m[2].trim();
      if (speech) out.push({ speaker: m[1].trim(), speech });
    }
  }
  return out;
}

function analyzeScene(header: string, lines: DLine[], isZh: boolean): PingpongScene {
  let questionCount = 0;
  let directAnswerCount = 0;
  let maxChain = 0;
  let chain = 0;
  const evidence: string[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (cur.speaker === next.speaker) continue; // 只看一来一回
    const q = isZh ? isQuestionZh(cur.speech) : isQuestionEn(cur.speech);
    if (!q) continue; // 非问句对（A→Q）不打断连答计数；只有"问句未被直答"才断链
    questionCount++;
    if (isDirectAnswer(next.speech, isZh)) {
      directAnswerCount++;
      chain++;
      if (chain > maxChain) maxChain = chain;
      if (chain === 3 && evidence.length < 4) {
        evidence.push(`「${cur.speech}」→「${next.speech}」`);
      }
    } else {
      chain = 0;
    }
  }

  const ratio = questionCount ? directAnswerCount / questionCount : 0;
  const overused = (maxChain >= 3) || (questionCount >= 4 && ratio > 0.6);
  return { sceneHeader: header, questionCount, directAnswerCount, maxChain, overused, evidence };
}

export function dialoguePingpong(draft: string): DialoguePingpongResult {
  if (!draft || !draft.trim()) {
    return { score: 100, scenes: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);

  const scenes: PingpongScene[] = [];
  let curHeader = isZh ? '(开场)' : '(opening)';
  let curBody: string[] = [];
  const flush = () => {
    if (curBody.length) scenes.push(analyzeScene(curHeader, parseScene(curBody.join('\n')), isZh));
  };
  for (const raw of draft.split(/\r?\n/)) {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      flush();
      curHeader = line;
      curBody = [];
    } else {
      curBody.push(raw);
    }
  }
  flush();

  const bad = scenes.filter((s) => s.overused);
  const score = Math.max(0, 100 - bad.length * 30 - bad.reduce((a, s) => a + Math.max(0, s.maxChain - 3) * 5, 0));

  const issues = bad.map((s) =>
    isZh
      ? `场景「${s.sceneHeader}」问答机械：${s.questionCount}个问句中${s.directAnswerCount}个被直答，最长${s.maxChain}连问直答——缺回避/反问/打断/沉默`
      : `Scene "${s.sceneHeader}" Q&A on rails: ${s.directAnswerCount}/${s.questionCount} questions answered directly, ${s.maxChain} in a row — add deflection/counter-question/interruption/silence`,
  );

  const advice = isZh
    ? bad.length > 0
      ? '拆掉接球式问答：至少三分之一的问题不被正面回答——用反问顶回去、答非所问、用动作岔开、沉默或打断；信息要挤在对抗里漏出来，不是问出来就答。'
      : '问答节奏自然，有对抗和留白，保持。'
    : bad.length > 0
      ? 'Break the Q&A rail: leave at least a third of questions unanswered head-on — counter with a question, deflect, change subject through action, stay silent or interrupt. Information should leak through conflict, not be handed over on request.'
      : 'Q&A rhythm has friction and silence; keep it.';

  return { score, scenes, issues, advice };
}
