import { isSceneHeaderLine } from './script-scenes';
/**
 * 旁白翻译机检测（v2.80 块73，创作能力类）
 * ------------------------------------------------------------------
 * 病象：台词刚把潜台词藏好，叙述行立刻替观众做阅读理解，把台词的
 * 言下之意用旁白点破、翻译、盖章——
 *   沈志国：你最近还是少出门。
 *   △这话分明是在警告她。
 *   林晚：茶凉了。
 *   △她听出了话里的逐客令。
 *   VICTOR: Be careful who you trust.
 *   His words were a warning she did not need spelled out.
 * 好的潜台词像字谜：观众自己解出来才有快感。叙述者当场报答案，
 * 等于演员说完暗号、字幕立刻打出"他在威胁她"——戏在两层文本上
 * 同时死一次：台词的含蓄白做，观众的参与感被没收。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - mind-reading：叙述者钻进角色脑子宣判抽象结论（"她知道这一走
 *    就是永别"），不需要对白锚点；本引擎必须【紧邻台词】出现，
 *    管的是"替这句台词做注解"；
 *  - subtext-check：只扫台词有没有把目的直说出口；本引擎只扫叙述行；
 *  - emotion-label/mind-reading：管情绪/认知直给，不涉及"翻译对白"；
 *  - subtext-erase（本引擎）：非台词叙述行 + 翻译框架词 + 紧邻上文
 *    （2 个非空行内）有台词，三者齐备才判。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface SubtextEraseHit {
  line: number;
  marker: string;
  /** 被注解的台词行号 */
  anchorLine: number;
  snippet: string;
  reason: string;
}

export interface SubtextEraseResult {
  score: number;
  hits: SubtextEraseHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const DIALOGUE_RE_ZH = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;
const DIALOGUE_RE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\(([^()]{0,40})\))?\s*:\s*(.+)$/;

/* ───────── 翻译框架词：只收"注解对白含义"的句式 ───────── */

const DECODE_ZH = /(?:言下之意|话里有话|话中有话|话里的(?:意思|话)|弦外之音|这(?:句)?话(?:分明|明明|显然|无疑|简直|不啻)?(?:是|就?等于|无异于)(?:在)?(?:警告|威胁|试探|挑衅|赶人|逐客|拒绝|答应|表态|护着|站队|宣战|摊牌|通牒|求饶|认输|下逐客令|敲警钟)|(?:分明|明明|显然|无疑)是在(?:警告|威胁|试探|挑衅|赶人|护着|拒绝|表态)|嘴上(?:虽然)?(?:没|不)(?:说|承认|表态)[^。！？!?]{0,14}(?:谁都|人人|在场的人?|大家|都)(?:听|看|明白|清楚)|没(?:有)?明说[^。！？!?]{0,12}(?:意思|谁都|大家|都)(?:明白|清楚|听得懂|懂)|意思(?:已经|很|再明白不过|不言自明|昭然若揭)|是说给[^\n。！？!?]{0,8}听的|(?:下了?|就是|等于下了?)逐客令|旁敲侧击(?:地)?(?:说|问|提醒|警告)|(?:潜台词|画外音)(?:是|就是)|[他她](?:也|还|早就|已经|忽然|突然)?(?:听出|听明白|听懂|读出|品出)(?:了)?(?:话里|这话|语气|声音|字里行间|那话)[^。！？!?]{0,10}|不用(?:他|她)?(?:把话|说破|明说|多说)[^。！？!?]{0,8}(?:也|都)?(?:明白|清楚|懂)|等于(?:是)?(?:当场|直接)?(?:宣战|拒绝|答应|摊牌|翻脸|认输))/;
const DECODE_EN = /\b(?:(?:his|her|the) words? (?:were|was) (?:as good as )?(?:a )?(?:clear )?(?:warning|threat|declaration(?: of war)?|refusal|challenge|provocation|sentence|dismissal)|(?:his|her) (?:meaning|message) was (?:clear|unmistakable|obvious|loud and clear)|the (?:subtext|meaning|message) was (?:clear|unmistakable|obvious)|could hear the (?:warning|threat|ice|challenge|dismissal) (?:in|underneath|behind|beneath) (?:his|her|their) (?:voice|tone|words)|heard the (?:warning|threat) (?:in|underneath) (?:his|her) voice|didn'?t (?:even )?need (?:him|her|them)?\s?to (?:say (?:it|more|the words)|finish|spell it out)|did not need (?:him|her|it) (?:spelled|said) out|might as well have (?:said|shouted|added)\b[^.\n]{0,30}|what (?:he|she|they) (?:really )?meant was|(?:read|heard) (?:the warning|the threat|everything) (?:in|into) (?:his|her) (?:eyes|voice|tone)|the unspoken (?:message|warning|threat|verdict)|loud and clear)\b/i;

export function subtextErase(draft: string): SubtextEraseResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(draft);
  const decodeRe = zh ? DECODE_ZH : DECODE_EN;
  const dialogueRe = zh ? DIALOGUE_RE_ZH : DIALOGUE_RE_EN;

  const lines = draft
    .split(/\r?\n/)
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter((l) => l.text.length > 0);

  const hits: SubtextEraseHit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isSceneHeaderLine(l.text)) continue;
    if (dialogueRe.test(l.text)) continue;

    const m = l.text.match(decodeRe);
    if (!m) continue;

    // 锚点：前 2 个非空行内必须有台词（叙述是在给这句台词做注解）
    let anchorLine: number | null = null;
    for (let j = i - 1; j >= 0 && j >= i - 2; j--) {
      if (isSceneHeaderLine(lines[j].text)) break;
      if (dialogueRe.test(lines[j].text)) {
        anchorLine = lines[j].line;
        break;
      }
    }
    if (anchorLine === null) continue;

    const reason = zh
      ? `第${l.line}行叙述替观众翻译了第${anchorLine}行的台词（"${m[0]}"）：潜台词刚由台词藏好，就被旁白当场报答案，含蓄白做、观众的参与感被没收`
      : `L${l.line} narration translates the line at L${anchorLine} ("${m[0]}"): the dialogue hides the subtext, then the narration hands over the answer — the indirection is wasted and the audience is denied the pleasure of decoding it`;

    hits.push({
      line: l.line,
      marker: m[0],
      anchorLine,
      snippet: l.text.slice(0, 60),
      reason,
    });
  }

  let score = 100 - hits.length * 23;
  if (score < 25) score = 25;

  const issues = hits.map((h) => (zh
    ? `旁白翻译机：${h.reason}`
    : `Narrator footnotes the subtext: ${h.reason}`));

  const advice = zh
    ? [
        '台词把意思藏好后，叙述不要跟上去解释——相信镜头和演员：让一个停顿、一个没接住的眼神、一次答非所问自己生效',
        '观众要的是"我听懂了"的快感，不是被旁白塞答案；真想加重那句台词，就写对方的反应动作（端茶的手停了半拍），别写"这话是在警告她"',
        '删掉翻译句后重读那场戏：如果不靠注解观众也能懂，说明台词成立；如果删了就看不懂，回去把台词和动作写得更准，而不是补一句旁白',
      ]
    : [
        'Once the line hides its meaning, never follow it with narration that explains it — trust the beat: a pause, an unheld gaze, a non-answer, all doing the work',
        'Viewers want the pleasure of getting it themselves, not a narrator handing over the answer; to weight the line, write the reaction instead (the teacup stopping halfway), never "his words were a warning"',
        'Delete the footnote and reread the scene: if it still reads clearly, the line stands; if it becomes opaque, sharpen the dialogue and action rather than translating them',
      ];

  return { score, hits, issues, advice };
}
