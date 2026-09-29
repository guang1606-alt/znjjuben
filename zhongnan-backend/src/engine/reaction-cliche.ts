import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 面部反应公式检测（Reaction Cliche）
 * -----------------------------------------------------------
 * 创作能力类引擎：单个生理特写是优点（情绪外化，emotion-craft 正向信号），
 * 病在 AI/网文把人脸当固定零件箱——任何刺激都甩同一套三连：
 *   她愣了愣，皱了皱眉，下意识咬了咬唇。
 *   他瞳孔一缩，嘴角抽搐，脸色瞬间沉了下来。
 *   She froze, blinked, then frowned and bit her lip.
 * 问题：
 *  1) 连缀冒充层次——两三个标配反应词堆在一句里，看着有细节，其实没有
 *     任何一个属于"这个人物"的选择，换成谁都成立；
 *  2) 全片万能复用——"瞳孔一缩/挑眉/脸色一沉"被当成所有情绪的快捷键，
 *     人物失去各自的身体语言；
 *  3) 反应原地打转——愣/皱眉/咬唇之后没有动作决定，戏在脸上停住。
 *
 * 判定（只扫叙述行，按句切分）：
 *  A. 反应连缀 chain：同一句命中 ≥2 个标配面部/生理反应词；
 *  B. 万能复用 repeat：同一个反应词全片出现 ≥3 次（单次出现不罚，
 *     那是正当外化）。
 *
 * 边界：
 *  - 单个反应词不判（emotion-craft 视生理外化为分层证据）；
 *  - 群体"倒吸凉气/全场愣住"归 crowd-reaction，本引擎只看个体面部；
 *  - 站坐叹气等身体调度归 hollow-action。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ReactionHit {
  line: number;
  kind: 'chain' | 'repeat';
  tokens: string[];
  snippet: string;
  reason: string;
}

export interface ReactionClicheResult {
  score: number;
  narrationLines: number;
  hits: ReactionHit[];
  tokenCounts: Record<string, number>;
  overusedTokens: string[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// 标配面部/生理反应零件（网文反应词库）
const TOKENS_ZH: { re: RegExp; token: string }[] = [
  { re: /瞳孔一缩|瞳孔微缩|瞳孔骤缩|眸光一缩/g, token: '瞳孔一缩' },
  { re: /愣了愣|愣了一下|愣在原地|微微一愣|不由得一愣|愣住了?/g, token: '愣' },
  { re: /皱了皱眉|皱起?眉头|眉头一皱|眉头紧锁|微微皱眉|蹙眉|皱眉/g, token: '皱眉' },
  { re: /咬了咬唇|咬了咬(?:下)?嘴唇|咬着唇|咬唇|贝齿咬唇/g, token: '咬唇' },
  { re: /嘴角抽搐|嘴角一抽|嘴角扯了扯|扯了扯嘴角/g, token: '嘴角抽搐' },
  { re: /挑了挑眉|挑眉|眉毛一挑/g, token: '挑眉' },
  { re: /脸色一沉|面色一沉|脸色瞬间(?:沉|变)|沉下脸|脸一黑|脸色发黑|面色发黑/g, token: '脸色一沉' },
  { re: /眼神一暗|眸光一暗|眼底闪过一丝|眼神闪烁|目光闪了闪/g, token: '眼神一暗' },
  { re: /眸光一闪|眼前一亮|眼睛一亮|双目一亮/g, token: '眸光一闪' },
  { re: /心头一紧|心中一紧|心里咯噔|心下一沉|心猛地一沉/g, token: '心头一紧' },
  { re: /倒吸(?:了)?一口(?:凉)?气|呼吸一滞|呼吸一凝|屏住呼吸/g, token: '呼吸一滞' },
  { re: /眼眶一红|红了眼眶|眼圈泛红|泪水在眼眶/g, token: '眼眶红' },
  { re: /勾起(?:一抹)?(?:冷笑|弧度|唇角)|唇角上扬|似笑非笑/g, token: '勾起唇角' },
  { re: /面无表情|神色复杂|表情意味深长/g, token: '脸色标签' },
];

const TOKENS_EN: { re: RegExp; token: string }[] = [
  { re: /\bpupils? (?:dilated|constricted|shrank)\b/gi, token: 'pupils' },
  { re: /\bfroze(?: for a beat| in place)?\b|\bfrozen\b/gi, token: 'froze' },
  { re: /\bblinked(?: in surprise| twice| hard)?\b/gi, token: 'blinked' },
  { re: /\bfrowned|brows? (?:furrowed|knit)|knitted (?:his|her) brows\b/gi, token: 'frowned' },
  { re: /\bbit (?:her|his) lip\b|\bbiting (?:her|his) lip\b/gi, token: 'bit lip' },
  { re: /\b(?:corner|edge) of (?:her|his) mouth (?:twitched|ticked)\b|\bmouth twitched\b/gi, token: 'mouth twitched' },
  { re: /\braised an? eyebrow\b|\beyebrows? shot up\b/gi, token: 'raised eyebrow' },
  { re: /\bjaw (?:tightened|clenched)|clenched (?:her|his) jaw\b/gi, token: 'jaw clenched' },
  { re: /\beyes widened\b|\bwidened (?:her|his) eyes\b/gi, token: 'eyes widened' },
  { re: /\bnarrowed (?:her|his) eyes\b|\beyes narrowed\b/gi, token: 'narrowed eyes' },
  { re: /\bswallowed hard\b|\bgulped\b/gi, token: 'swallowed hard' },
  { re: /\bbreath caught\b|\bcaught (?:her|his) breath\b/gi, token: 'breath caught' },
  { re: /\bhesitated(?: for a beat)?\b/gi, token: 'hesitated' },
  { re: /\bexpressionless\b|\bblank expression\b|\binscrutable look\b/gi, token: 'blank face' },
];

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function reactionCliche(draft: string): ReactionClicheResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], tokenCounts: {}, overusedTokens: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const tokens = isZh ? TOKENS_ZH : TOKENS_EN;

  const lines = draft.split(/\r?\n/);
  const hits: ReactionHit[] = [];
  const tokenCounts: Record<string, number> = {};
  let narrationLines = 0;

  const countIn = (s: string): string[] => {
    const found: string[] = [];
    for (const { re, token } of tokens) {
      re.lastIndex = 0;
      const m = s.match(re);
      if (m) {
        tokenCounts[token] = (tokenCounts[token] ?? 0) + m.length;
        if (!found.includes(token)) found.push(token);
      }
    }
    return found;
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) return;
    if (DIALOGUE_RE.test(line)) return;
    narrationLines++;

    const sentences = line.match(isZh ? /[^。！？；\n]+[。！？；]?/g : /[^.!?;\n]+[.!?;]?/g) ?? [line];
    for (const sentRaw of sentences) {
      const sent = sentRaw.trim();
      if (!sent) continue;
      const found = countIn(sent);
      if (found.length >= 2) {
        hits.push({
          line: i + 1, kind: 'chain', tokens: found, snippet: snippet(sent),
          reason: isZh
            ? '一句里堆叠多个标配面部反应，看似有细节，实则没有一个属于此人物的具体选择——换个人照样成立'
            : 'several stock facial reactions stacked in one line read as detail, but none is a choice specific to this character — they would fit anyone',
        });
      }
    }
  });

  const overusedTokens = Object.entries(tokenCounts)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  for (const t of overusedTokens) {
    hits.push({
      line: 0, kind: 'repeat', tokens: [t], snippet: '',
      reason: isZh
        ? `「${t}」全片 ${tokenCounts[t]} 次，成了所有情绪的万能快捷键，人物失去各自的身体语言`
        : `"${t}" appears ${tokenCounts[t]} times — a shortcut for every emotion; the characters lose distinct body language`,
    });
  }

  const chainHits = hits.filter((h) => h.kind === 'chain').length;
  const repeatPenalty = overusedTokens.reduce((a, t) => a + (tokenCounts[t] - 2) * 3, 0);
  const score = Math.max(25, 100 - chainHits * 12 - repeatPenalty);

  const issues = [
    ...hits.filter((h) => h.kind === 'chain').slice(0, 8).map((h) =>
      isZh
        ? `第${h.line}行反应公式「${h.snippet}」（${h.tokens.join('+')}）——只留一个最贴人物的生理反应，后面必须接一个动作决定：手伸向什么、对谁改口、把什么藏起来`
        : `L${h.line} reaction formula "${h.snippet}" (${h.tokens.join('+')}) — keep only the one tell that fits this character, then land a decision in action: a hand reaching for something, a line changed, an object hidden`),
    ...overusedTokens.map((t) =>
      isZh
        ? `「${t}」全片${tokenCounts[t]}次：给不同人物换专属反应——老江湖用沉默和物件，年轻人用动作失误，上位者用停顿`
        : `"${t}" ${tokenCounts[t]}x in the script: assign signature reactions — the veteran goes quiet with a prop, the rookie makes a physical slip, the powerful one simply pauses`),
  ];

  const advice = isZh
    ? hits.length > 0
      ? '反应不是零件拼装。每个刺激只给一个最贴人物的生理瞬间，并且立刻用"他接下来做什么"接住——反应暴露性格，动作推进局面。不同人物要有不同的身体：有人动脸，有人动手，有人只动语气。'
      : '反应词无连缀、无万能复用，人物各有身体语言，保持。'
    : hits.length > 0
      ? 'A reaction is not an assembly kit. Give each stimulus one physiological beat that fits the character, then immediately catch it with what they DO — reaction reveals character, action moves the scene. Different bodies for different people: face, hands, or merely tone.'
      : 'No stacked or recycled reactions; each character owns distinct body language; keep it.';

  return { score, narrationLines, hits, tokenCounts, overusedTokens, issues, advice };
}
