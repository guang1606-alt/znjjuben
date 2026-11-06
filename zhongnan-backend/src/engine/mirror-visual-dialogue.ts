import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 台词复述画面检测（Mirror-Visual Dialogue）
 * -----------------------------------------------------------
 * 创作能力类引擎：AI 改分镜/小说本时最常见的穿帮——镜头已经
 * 演出来的东西，角色偏要用完整主谓宾再念一遍，台词替镜头说话：
 *   桌上摊着一份离婚协议书，林棠的手指按在落款处。
 *   林棠：桌上放着一份离婚协议书。
 *   窗外暴雨砸在玻璃上。
 *   沈知远：外面正在下大雨。
 * 画面已经给了，台词零增量，等于给盲人讲画面。
 *
 * 判定（三条同时满足，求精度）：
 *  1) 台词为陈述句（非问句、非祈使、非情绪反应）；
 *  2) 以视觉指代/眼前框架开头（这/那/你在…/this is/you are doing…）；
 *  3) 与紧邻上一叙述行实词高度重合（zh 共享 bigram≥3 /
 *     en 共享实词≥2 且占台词 40%+）。
 * 豁免：带新信息（因果/时间/数字）、长台词（在表达观点而非复述）。
 *
 * 边界：
 *  - echo-dialogue 管"叙述行复述台词"，本引擎管反方向"台词复述画面"；
 *  - exposition as_you_know 管双方已知的背景/旧事，本引擎管此刻共见画面；
 *  - 台词对画面做质问/反应（"你居然打我？"）不算，那是冲突。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface MirrorHit {
  line: number;
  speaker: string;
  narration: string;
  dialogue: string;
  shared: string[];
  reason: string;
}

export interface MirrorVisualResult {
  score: number;
  dialogueLines: number;
  hits: MirrorHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// 眼前画面框架：指着眼前东西陈述
const VISUAL_ZH = /^(这|那|这些|那些|这里|那里|这儿|那儿|桌上|地上|墙上|门口|窗外|手里|盘子里|杯子里|外面|里面|你在|他在|她在|它在|你们在|他们在|她们在)(?:个|份|张|本|叠|些)?/;
const VISUAL_EN = /^(?:this|that|these|those|here|there|on the|in the|you ('re|are)|he'?s|she'?s|it'?s|they'?re)\b/i;

// 祈使/命令开头：不是陈述
const IMP_ZH = /^(把|给我|拿|滚|住手|住手|住嘴|闭嘴|别|不要|走|来|坐下|站起来|让开|看招)/;
const IMP_EN = /^(?:give|take|get|stop|shut|don'?t|do not|sit|stand|come|go|leave|let|put|hand|look out|watch it)\b/i;

// 非此刻的新信息词：在讲因果/时间/计划，不是复述画面
const NEWINFO_ZH = /(因为|所以|为了|由于|明天|昨天|后天|前天|上周|下个月|去年|当年|以后|回头|待会|马上就|准备|打算|计划|合同|转账|遗嘱|股权)/;
const NEWINFO_EN = /\b(because|so that|in order to|tomorrow|yesterday|next week|last month|will|going to|plan|contract|will transfer|inheritance|shares)\b/i;

// 情绪反应框架（就算指向眼前也不算复述）
const REACT_ZH = /(你居然|你竟敢|没想到|竟然|原来你|好啊你|行啊你)/;
const REACT_EN = /\b(i can'?t believe|you actually|how could you|so you'?ve been|you dare)\b/i;

const stripPunc = (s: string): string => s.replace(/[，。！？、…：；""''（）()【】《》\s,.!?:;'"()\[\]<>-]/g, '');

// zh 连续 2 字片段集合
const bigrams = (s: string): Set<string> => {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
};

// en 实词
const STOP_EN = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those', 'here', 'there', 'on', 'in', 'at', 'to', 'of', 'and', 'it', 'its', 'you', 'he', 'she', 'they', 'i', 'me', 'my', 'your', 'his', 'her', 'their', 'do', 'does', 'did', 'not', 'no', 'yes', 'so', 'just', 'very']);
const contentWords = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z'’\s-]/g, ' ').split(/\s+/).filter((w) => w && !STOP_EN.has(w));

const diaLen = (s: string, isZh: boolean): number =>
  isZh ? stripPunc(s).length : s.split(/\s+/).filter(Boolean).length;

const snippet = (s: string, n = 22): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function mirrorVisualDialogue(draft: string): MirrorVisualResult {
  if (!draft || !draft.trim()) {
    return { score: 100, dialogueLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const visualRe = isZh ? VISUAL_ZH : VISUAL_EN;
  const impRe = isZh ? IMP_ZH : IMP_EN;
  const newRe = isZh ? NEWINFO_ZH : NEWINFO_EN;
  const reactRe = isZh ? REACT_ZH : REACT_EN;

  const lines = draft.split(/\r?\n/);
  const hits: MirrorHit[] = [];
  let dialogueLines = 0;
  let lastNarration = '';

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { lastNarration = ''; return; }
    const dm = line.match(DIALOGUE_RE);
    if (!dm) { lastNarration = line.replace(/^（.+）\s*/, '').trim(); return; }

    dialogueLines++;
    const speaker = dm[1].trim();
    const text = dm[2].trim();
    if (!lastNarration) return;

    // ① 必须陈述句
    if (/[？?]\s*$/.test(text)) return;
    if (impRe.test(text)) return;
    if (reactRe.test(text)) return;
    // ② 眼前指代框架
    if (!visualRe.test(text)) return;
    // ③ 新信息豁免 / 长台词豁免
    if (newRe.test(text)) return;
    if (diaLen(text, isZh) > (isZh ? 20 : 14)) return;

    // ④ 与上一叙述行实词重合
    let shared: string[] = [];
    if (isZh) {
      const nb = bigrams(stripPunc(lastNarration));
      const db = [...bigrams(stripPunc(text))].filter((g) => nb.has(g));
      shared = db.slice(0, 6);
      if (db.length < 3) return;
    } else {
      const nw = new Set(contentWords(lastNarration));
      const dw = contentWords(text);
      shared = dw.filter((w) => nw.has(w));
      if (shared.length < 2 || shared.length / dw.length < 0.4) return;
    }

    hits.push({
      line: i + 1,
      speaker,
      narration: snippet(lastNarration, 30),
      dialogue: snippet(text, 30),
      shared: isZh ? shared : [...new Set(shared)],
      reason: isZh
        ? '镜头已演出的眼前画面，台词用完整句原样复述，零信息增量'
        : 'the line restates what the camera already shows, with zero new information',
    });
  });

  const score = Math.max(20, 100 - hits.length * 12);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.dialogue}」复述了上一镜头（${h.narration}）——观众已经看见了，删掉这句或改成带立场/新信息的反应（嘲讽、误读、要价、翻旧账）`
      : `L${h.line} "${h.dialogue}" restates the previous shot (${h.narration}) — the audience already sees it; cut it or replace with a loaded reaction (mockery, misread, a demand, an old grudge)`);

  const advice = isZh
    ? hits.length > 0
      ? '台词不替镜头说话。画面已经给的，角色要么不说，要么说出画面之外的东西——立场、算计、误解、旧账。让观众用眼睛看，让台词给画面给不了的信息。'
      : '台词不复述画面，信息都在画面之外，保持。'
    : hits.length > 0
      ? 'Dialogue must not do the camera\'s job. When the image already shows it, either stay silent or say what the image cannot — a stance, a calculation, a misread, a grudge. Let the audience watch; let dialogue deliver what the picture cannot.'
      : 'Dialogue never restates the image; all information lives beyond the frame; keep it.';

  return { score, dialogueLines, hits, issues, advice };
}

/**
 * 前置教学：buildMirrorVisualDialogueDirective(_format='LIVE', lang='zh')
 * ----------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 mirrorVisualDialogue 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"台词用完整句复述上一镜头画面"的检测口径，
 *       避免写完被 prePolish mirrorHint 与 craft/deai 复评打回。
 */
export function buildMirrorVisualDialogueDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Mirror-Visual Dialogue Pre-Writing Briefing (same source as mirrorVisualDialogue: a line restates the previous shot; 12 points per hit; floor 20)】',
      '- Baseline: the comparison target is the immediately previous non-empty line; a scene header clears it, a line with a colon is dialogue, and any other line becomes the new narration baseline.',
      '- Statement gate: the line must not end with a question mark, must not start with an imperative (give / take / stop / do not / look out), and must not carry a reaction frame (I cannot believe / you actually / how could you).',
      '- Visual frame: the line must open by pointing at what is on screen — this / that / these / those / here / there / on the / in the / you are / he is / she is / it is / they are.',
      '- New-information exemption: causal, temporal or planning words (because / so that / tomorrow / yesterday / next week / will / going to / plan / contract / inheritance / shares) mean the line adds something, so it is not judged.',
      '- Length exemption: lines over 20 characters in Chinese after punctuation is stripped, or over 14 words in English, are treated as a viewpoint, not a restatement.',
      '- Overlap threshold: Chinese needs at least 3 shared character bigrams with the previous narration after punctuation is stripped; English needs at least 2 shared content words and those must cover 40 percent or more of the line content words.',
      '- Hit fields: line, speaker, narration, dialogue and the shared fragments are returned so the polisher can locate the restated shot.',
      '- Score: max(20, 100 - hits x 12); empty draft = 100.',
      '- Diagnostics: dialogueLines is display-only and never charged.',
      '- Rewrite: cut the line, or replace it with what the image cannot show — a stance, a calculation, a misread, a demand or an old grudge.',
      '- Division: action-echo-dialogue covers question or confirmation echoes of an action just performed, and mirror explicitly exempts "you actually hit me"; this engine only judges statements pointing at a static visible frame.',
      '- Division: echo-dialogue covers narration restating dialogue, the opposite direction; this engine only judges dialogue restating the picture.',
      '- Division: exposition shared memory covers background both sides already know; this engine only judges the image both sides are looking at right now.',
      '- Pipeline consumption: prePolish injects mirrorHint into the polisher; craft initial, craft re-eval, deai rescan and the creative batch rescan all run the same detector.',
      '- Self-check: delete the line and ask whether the audience loses any information. If nothing is lost, the line is a caption, not dialogue.',
    ].join('\n');
  }
  return [
    '【台词复述画面·前置教学（检测同源：mirrorVisualDialogue 台词用完整句复述上一镜头，每条命中扣 12 分，20 分封底）】',
    '- 比对基准：上一非空行；场头出现即清空基准，带冒号的行是台词，其余行成为新的叙述基准（行首（动作提示）会先剥离）。',
    '- 陈述句门槛：台词不以问号（？/?）结尾、不以祈使/命令开头（把/给我/拿/滚/住手/闭嘴/别/不要/走/来/坐下/让开/看招）、不含情绪反应框架（你居然/你竟敢/没想到/竟然/原来你/好啊你/行啊你）。',
    '- 眼前框架：台词必须以指代眼前画面的词开头（这/那/这些/那些/这里/那里/这儿/那儿/桌上/地上/墙上/门口/窗外/手里/盘子里/杯子里/外面/里面/你在/他在/她在/它在/你们在/他们在/她们在）。',
    '- 新信息豁免：台词含因果/时间/计划类词（因为/所以/为了/由于/明天/昨天/后天/上周/下个月/去年/当年/以后/回头/待会/准备/打算/计划/合同/转账/遗嘱/股权）→ 说明有增量，不判。',
    '- 长台词豁免：中文去标点后 >20 字、英文 >14 词，视为表达观点而非复述，不判。',
    '- 重合阈值：中文与上一叙述行去标点后共享连续二字片段 ≥3 个；英文共享实词 ≥2 个且占台词实词 40% 以上（停用词不计）。',
    '- 命中字段：line（行号）、speaker（说话人）、narration（被复述的叙述）、dialogue（复述台词）、shared（重合片段）随命中返回，供润色师定位。',
    '- 得分：score = max(20, 100 - 命中条数 × 12)；空稿 100。',
    '- 诊断字段：dialogueLines（台词行数）只做展示，不参与扣分。',
    '- 改写方向：删掉这句，或换成画面给不了的东西——立场、算计、误读、要价、翻旧账；让观众用眼睛看画面，让台词给画面之外的信息。',
    '- 与 action-echo-dialogue 分界：它管问句/确认句回声刚发生的动作，且明确豁免「你居然打我？」；本引擎只判陈述句指着眼前静物复述。',
    '- 与 echo-dialogue 分界：它管叙述行复述台词，方向相反；本引擎只判台词复述画面。',
    '- 与 exposition 共知旧事分界：它管双方已知的背景旧事；本引擎只判此刻双方共见的画面。',
    '- pipeline 消费：prePolish 把命中注入润色师（mirrorHint）；craft 初评、craft 复评、deai 复扫与 creative-batch-rescan 跑同一检测器。',
    '- 成稿自查：把这句台词删掉，观众会少知道什么吗？什么都不少，它就是字幕不是台词，删。',
  ].join('\n');
}
