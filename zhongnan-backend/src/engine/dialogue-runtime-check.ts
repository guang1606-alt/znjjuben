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
