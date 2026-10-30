import { parseScriptLine, estimateSpeechSeconds } from './listen-script';

/**
 * v2.350 台词时长物理超支检测（Dialogue Runtime Check）
 * ------------------------------------------------------------------
 * 盲区坐实：script-format 字数闸门（LIVE 800-1000 字 / AIGC 1200-1500 字）只管「字够多不多」，
 * 不管「字读不读得完」。真人侧无发声比上限（AIGC 侧 18-28% 是画面/台词配比，不是时长约束），
 * 800-1000 字里台词占 600+ 字、朗读 140+ 秒，超 90 秒单集上限 1.5 倍——
 * 导演拿到稿子拍不完：要么删台词破坏剧情，要么演员赶台词像机关枪（付费观众听着就出戏）。
 *
 * 分工边界（先证伪再坐实，避免与邻居重复定罪）：
 *  - script-format：字数带闸门（800-1000/1200-1500），只管「量」，不管「朗读时长」；
 *  - listen-script：estimateSpeechSeconds（4.3 字/秒+停顿）公式现成，但只服务 /listen 端点，
 *    零进生成管线 craftPass；
 *  - aigc-screenplay 发声比 18-28%：AIGC 侧画面/台词配比（防台词塞满画面），不是时长约束；
 *  - dialogue-length-score：单句台词长度，不管集总时长；
 *  - 本引擎：把台词段 estSeconds 合计与单集时长预算比对，超支→high，贴近上限→mid。
 *
 * 预算口径：
 *  - LIVE 缺省 90 秒（竖屏短剧单集 60-90 秒，取上限）；
 *  - AIGC 按 durationMin×60×0.9（台词占比上限 90%，留 10% 给画面/动作节拍）。
 *
 * 纯确定性、零 LLM、零 IO；中英双语，en 层系统文案零中文。
 */

export type RtLang = 'zh' | 'en';
export type RtFormat = 'LIVE' | 'AIGC';

export interface RuntimeIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'dialogue_overtime' | 'dialogue_tight';
  evidence: string;
  advice: string;
}

export interface RuntimeResult {
  score: number;
  /** 输入有效（非空、有正文）才检测；空稿/畸形输入 checked=false 满分放行 */
  checked: boolean;
  /** 台词段朗读总秒数（estimateSpeechSeconds 同源） */
  spokenSeconds: number;
  /** 单集时长预算秒数（LIVE=90，AIGC=durationMin×60×0.9） */
  budgetSeconds: number;
  /** 台词段总字数（CJK+拉丁词折算） */
  spokenChars: number;
  /** 严重度：none（预算内）/ mid（贴近上限 85-100%）/ high（超支 >100%） */
  severity: 'none' | 'mid' | 'high';
  issues: RuntimeIssue[];
}

/** LIVE 单集时长预算（竖屏短剧 60-90 秒，取上限） */
const LIVE_BUDGET_SECONDS = 90;
/** AIGC 台词占比上限（留 10% 给画面/动作节拍） */
const AIGC_SPOKEN_RATIO_CAP = 0.9;
/** 贴近上限阈值（85%-100% 报 mid） */
const TIGHT_THRESHOLD = 0.85;

export function dialogueRuntimeCheck(
  text: string | null | undefined,
  format: RtFormat = 'LIVE',
  lang: RtLang = 'zh',
  aigcDurationMin: number = 1,
): RuntimeResult {
  const isZh = lang === 'zh';
  const base: RuntimeResult = {
    score: 100, checked: false, spokenSeconds: 0, budgetSeconds: 0, spokenChars: 0,
    severity: 'none', issues: [],
  };
  const body = (text ?? '').replace(/\r\n?/g, '\n');
  if (body.trim().length < 20) return base;

  // 预算判定
  const budgetSeconds = format === 'AIGC'
    ? Math.round(aigcDurationMin * 60 * AIGC_SPOKEN_RATIO_CAP)
    : LIVE_BUDGET_SECONDS;

  // 逐行解析，只取台词段（dialogue 类），累加 estSeconds 与字数
  let spokenSeconds = 0;
  let spokenChars = 0;
  for (const raw of body.split('\n')) {
    const parsed = parseScriptLine(raw);
    if (parsed.kind !== 'dialogue') continue;
    const line = raw.trim();
    spokenSeconds += estimateSpeechSeconds(line);
    const cjk = (line.match(/[一-龥]/g) || []).length;
    const latinWords = (line.match(/[A-Za-z']+/g) || []).length;
    spokenChars += cjk + Math.round(latinWords * 1.67);
  }
  spokenSeconds = Math.round(spokenSeconds * 10) / 10;

  const out: RuntimeResult = {
    ...base, checked: true, spokenSeconds, budgetSeconds, spokenChars,
  };

  // 预算内满分放行
  if (spokenSeconds <= budgetSeconds * TIGHT_THRESHOLD) return out;

  // 贴近上限（85%-100%）→ mid
  if (spokenSeconds <= budgetSeconds) {
    out.severity = 'mid';
    out.score = Math.max(60, Math.round(100 - (spokenSeconds / budgetSeconds - TIGHT_THRESHOLD) * 100));
    out.issues = [{
      severity: 'mid',
      type: 'dialogue_tight',
      evidence: isZh
        ? `台词朗读约${spokenSeconds}秒，贴近单集预算${budgetSeconds}秒上限`
        : `Spoken lines ~${spokenSeconds}s, close to the ${budgetSeconds}s episode budget`,
      advice: isZh
        ? '台词时长已贴近单集上限：压缩次要角色的解释性台词，把信息转给动作/神态行；或删掉重复表态的句子，给演员留出表演呼吸感。'
        : 'Spoken runtime is near the episode cap: compress secondary characters\' explanatory lines, shift info into action/expression beats; cut repetitive statements to leave breathing room for performance.',
    }];
    return out;
  }

  // 超支（>100%）→ high
  out.severity = 'high';
  out.score = Math.max(0, Math.round(60 - (spokenSeconds / budgetSeconds - 1) * 60));
  out.issues = [{
    severity: 'high',
    type: 'dialogue_overtime',
    evidence: isZh
      ? `台词朗读约${spokenSeconds}秒，超单集预算${budgetSeconds}秒${Math.round((spokenSeconds / budgetSeconds - 1) * 100)}%`
      : `Spoken lines ~${spokenSeconds}s exceed the ${budgetSeconds}s episode budget by ${Math.round((spokenSeconds / budgetSeconds - 1) * 100)}%`,
    advice: isZh
      ? '台词物理读不完：拍摄时要么演员语速爆炸像机关枪、要么剪辑狂删台词破坏剧情。必须砍掉次要台词（合并同类表态/删掉解释性对话/把信息转给动作行），把朗读时长压回预算内。'
      : 'Spoken lines physically cannot fit the runtime: actors will either machine-gun the dialogue or editors will butcher the script. Cut secondary lines (merge redundant statements, remove exposition, shift info to action beats) to bring runtime back within budget.',
  }];
  return out;
}

/**
 * v2.369 台词时长前置教学（与 dialogueRuntimeCheck 同文件同源）：
 * 把「只算台词段朗读秒数 vs 单集预算」的检测口径反向前置到撰写师/润色师首轮，
 * 避免先写超支稿再打回重写白付 retry token（v2.157 前置教学优于事后纠偏）。
 * 缺省 format=LIVE；en 层系统文案零中文。
 */
export function buildDialogueRuntimeDirective(format: RtFormat = 'LIVE', lang: RtLang = 'zh'): string {
  if (lang === 'en') {
    return [
      '[Pre-write iron rule · Dialogue runtime — enough characters is not enough speech; count only spoken lines and fit the episode budget] This checklist shares the exact criteria of dialogueRuntimeCheck. The character band (LIVE 800-1000 / AIGC 1200-1500) only checks length, not whether the lines can be spoken: actors will machine-gun them and editors will butcher the script.',
      'Counting: only spoken lines (NAME (emotion/action cue): dialogue) count; scene headers, title lines, triangle action lines and technical notes are excluded. Estimate: 4.3 Chinese chars/second, 2.6 English words/second; +0.35 second per sentence-final punctuation, +0.15 second per mid-sentence pause.',
      'Budget: LIVE 90 seconds per episode (vertical short drama runs 60-90 seconds, we take the upper bound); AIGC budget = durationMin×60×0.9 (default 1 minute = 54 seconds, keeping 10% for visuals and action beats).',
      'Grading: at or below 85% of budget passes; 85%-100% of budget = mid (too tight, the audience can barely breathe); above 100% = high (physically unfilmable, rewrite required).',
      'Fixes that bring runtime back: merge repeated statements into the sharpest single line; delete exposition and move the information into triangle action lines or props; cut secondary characters down to one or two lines that push the conflict; turn persuasion/explanation/flashback into one visible action plus one key line; leave breathing room between lines instead of a wall of dialogue.',
      'Boundaries: the character band belongs to script-format; the AIGC 18-28% spoken ratio belongs to aigc-screenplay; single-line length belongs to dialogue-length-score; colloquial style and sentence shape belong to the dialogue strategy; this checklist only governs total spoken seconds versus the episode budget.',
      format === 'AIGC'
        ? 'AIGC format: no triangle action lines in the body; write compressed silence and action into continuous prose, and carry shifted information through visible action.'
        : 'LIVE format: alternate spoken lines with triangle action lines — after every two or three lines give one visible action/expression beat, which cuts runtime and gives the actors room to breathe.',
    ].join('\n');
  }
  return [
    '[撰写前置铁律 · 台词时长——字够 ≠ 读得完；只算台词段朗读秒数，必须压在单集预算内] 本清单与 dialogueRuntimeCheck 的检测同源，第一遍就写对。字数带（LIVE 800-1000 / AIGC 1200-1500）只管够不够长，读不读得完另算：写超了演员只能机关枪，剪辑只能狂删台词破坏剧情。',
    '计数口径：只累计台词行（「角色名（情绪/动作）：台词」），场头、剧名、△ 动作行、技术提示一律不计。朗读估算：汉字 4.3 字/秒、英文 2.6 词/秒；每个句末标点（。！？…）加 0.35 秒、每个句中停顿（，、；）加 0.15 秒。',
    '预算：LIVE 单集 90 秒（竖屏 60-90 秒取上限）；AIGC 预算 = 成片时长×60×0.9（缺省 1 分钟 = 54 秒，留 10% 给画面与动作节拍）。',
    '分级：台词合计 ≤ 预算 85% 满分放行；85%-100% 报 mid（贴近上限，观众听得喘不过气）；>100% 报 high（物理读不完，必须重写）。',
    '压回预算的正向动作：①合并同类表态——同一个意思只留最狠的一句；②删解释性对话，把信息转给 △ 动作行或道具（△ 他把协议推过去，签字栏空着）；③次要角色的长台词压成 1-2 句，只留推动冲突的那句；④把「说服/解释/回忆」改成「一个可见动作 + 一句关键台词」；⑤台词之间留呼吸（△ 沉默 / △ 他抬眼看她），别写台词墙。',
    '边界：字数带归 script-format；AIGC 发声比 18-28% 归 aigc-screenplay；单句长度归 dialogue-length-score；口语与句长风格归台词风格策略（dialogueDirective）；本清单只管「台词段合计朗读秒数 vs 单集预算」。',
    format === 'AIGC'
      ? 'AIGC 制式：正文不加 △，压缩后的沉默与动作写进连续自然段，转移的信息用可见动作承载。'
      : 'LIVE 制式：台词与 △ 动作行交替——每 2-3 句台词后给一行 △ 动作/神态，既压时长也给演员呼吸。',
  ].join('\n');
}
