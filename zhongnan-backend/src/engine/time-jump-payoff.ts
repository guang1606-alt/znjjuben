/**
 * v2.80 时间跳转兑付检测（Time-Jump Payoff）
 * ============================================================
 * 治什么病：
 *   最值钱的冲突场面不写，拿字幕当搬运工——
 *   "三天后，她已经签好了离婚协议。"
 *   "一年后，公司成功上市。"
 *   "第二天，婆婆松口答应了婚事。"
 *   / "Three days later, the divorce papers were signed."
 *   跳转只允许换场景状态，不允许替观众兑付冲突结果：
 *   签字那笔、决裂那场、翻盘那一招全在场外，爽点和信服力
 *   一起被时间词偷走。
 *
 * 判定（只扫含跳转词的行，或整行是裸跳转词的次行首句）：
 *   跳转词（N天/周/月/年后、次日/翌日/第二天、多年后、不知过了
 *   多久、N days/weeks/months later、the next morning…）
 *   与兑付动词（签好/撤诉/答应/原谅/复合/上市/破产/易主/去世/
 *   生下/出院/signed/dropped the charges/agreed/forgave/went public…）
 *   在同句近距离共现。
 *
 * 边界（查重后确认）：
 *   - effort-gloss 管"努力状语+结果"（几经周折，她签下了），
 *     本引擎管"时间跳转+结果"；
 *   - timeline-consistency 的 time_skip_stuffing 管裸跳转标记
 *     （整行只有"三天后。"）堆 ≥3 次，本引擎必须带兑付结果；
 *   - 跳转后只是进入新场景（三年后，她推门走进会议室）不判；
 *   - 无跳转的结果句（她当场签下协议）不判。
 *
 * 计分：0 次 100；1 次 75；≥2 次 max(25, 100-n*25)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

// 裸跳转行（整行基本只有时间词，允许句号/括号/破折号）
const BARE_JUMP_ZH = /^[（(]?\s*(?:[数半一二两三四五六七八九十百千\d]+\s*(?:天|日|周|个?月|年)后?|次日|翌日|第二天|当晚|当夜|多年以后?|几年后|不久后?|几天后?|很快|不知(?:道)?过了多久|转眼(?:间)?)\s*[，。、—\-）)]*$/;
const BARE_JUMP_EN = /^(?:[（(]?\s*(?:\d+|a|an|one|two|three|several|a few|many)\s+(?:days?|weeks?|months?|years?)\s*later|the\s+next\s+(?:day|morning|night|evening)|years?\s+went\s+by|time\s+passed|fast[\s-]?forward)[\s.,!?—\-）)]*$/i;

// 句中跳转词
const JUMP_ZH = /(?:[数半一二两三四五六七八九十百千\d]+\s*(?:天|日|周|个?月|年)后?(?:之后|过去)?|次日|翌日|第二天(?:早上|晚上|上午|中午|下午)?|当晚|当夜|多年以后?|几年后|不久后?|几天后?|不知(?:道)?过了多久|转眼(?:间)?|时间(?:一转|一晃))/;
const JUMP_EN = /\b(?:\d+|a|an|one|two|three|several|a few|many)\s+(?:days?|weeks?|months?|years?)\s+later\b|\bthe\s+next\s+(?:day|morning|night|evening)\b|\byears?\s+went\s+by\b|\btime\s+passed\b|\bfast[\s-]?forward\b/i;

// 场外兑付的结果（状态巨变/冲突结账，且是叙述者直接交代）
const PAYOFF_ZH = /(?:已经|早已|早已?经)?\s*(?:签(?:好|下|完了)|签了字|办(?:好|完)了离婚|领了离婚证|净身出户|撤诉|和解|答应(?:了|下来)?|同意(?:了|下来)?|原谅(?:了他|她)?|和好如初|复合|订婚|结婚|嫁人|怀孕|怀了|生下(?:了|孩子)|出院|醒(?:了|过来)|死了|去世|病逝|葬礼(?:已经)?结束|易主|上市|破产|倒闭|被收购|卖(?:掉|了|出)|拿下(?:了)?|追回(?:了)?|查到(?:了)?|辞职|离职|搬走|转学|录取|考上|翻身|成了(?:总裁|董事长|首富)|变回?身一?变)/;
const PAYOFF_EN = /\b(?:(?:had|was|were|already)\s+)?(?:signed|finalized|divorce[ds]?|drop(?:ped|s)?\s+the\s+charges|settled|agreed|consented|forgave|reconciled|engaged|married|pregnant|gave\s+birth|recovered|discharged|woke\s+up|died|passed\s+away|funeral\s+(?:was\s+)?over|went\s+public|went\s+bankrupt|was\s+acquired|changed\s+hands|resigned|moved\s+away|got\s+accepted|became\s+CEO)\b/i;

export interface TimeJumpPayoffHit {
  line: number;
  jump: string;
  payoff: string;
  snippet: string;
  reason: string;
}

export interface TimeJumpPayoffResult {
  score: number;
  hits: TimeJumpPayoffHit[];
  issues: string[];
  advice: string;
}

const snippet = (s: string, n = 32): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * 检测时间跳转兑付。
 */
export function timeJumpPayoff(draft: string): TimeJumpPayoffResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const lines = draft.split(/\r?\n/);
  const hits: TimeJumpPayoffHit[] = [];

  const firstSentence = (line: string): string => {
    const m = line.match(/^[^。！？!?\n]{1,60}/);
    return m ? m[0] : line.slice(0, 60);
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;

    const jumpRe = isZh ? JUMP_ZH : JUMP_EN;
    const payoffRe = isZh ? PAYOFF_ZH : PAYOFF_EN;
    const bareRe = isZh ? BARE_JUMP_ZH : BARE_JUMP_EN;

    // 同句共现：按句切分，一句内既跳又兑付才算
    const clauses = isZh ? line.split(/[。！？!?；;]/) : line.split(/[.!?;]/);
    for (const clause of clauses) {
      if (!clause.trim()) continue;
      const jm = clause.match(jumpRe);
      const pm = clause.match(payoffRe);
      if (jm && pm) {
        hits.push({
          line: i + 1,
          jump: jm[0],
          payoff: pm[0],
          snippet: snippet(clause.trim()),
          reason: isZh
            ? '时间跳转替观众兑付了冲突结果，最值钱的那场戏被跳过'
            : 'A time jump cashes out an off-screen result — the decisive scene is skipped',
        });
        break; // 一行只记一次
      }
    }
    if (hits.some((h) => h.line === i + 1)) return;

    // 裸跳转行 + 下一非空行首句即兑付
    if (bareRe.test(line)) {
      for (let k = i + 1; k < lines.length; k++) {
        const near = lines[k].trim();
        if (!near) continue;
        const lead = firstSentence(near);
        const pm = lead.match(payoffRe);
        if (pm) {
          hits.push({
            line: i + 1,
            jump: line.replace(/[（）()\s，。、—\-]/g, '').slice(0, 10),
            payoff: pm[0],
            snippet: snippet(lead),
            reason: isZh
              ? '跳转字幕下一拍直接交代结果，冲突全程在场外'
              : 'The beat after a jump caption just reports the result — conflict stays off-screen',
          });
        }
        break;
      }
    }
  });

  const n = hits.length;
  const score = n === 0 ? 100 : n === 1 ? 75 : Math.max(25, 100 - n * 25);
  const issues = hits.map((h) => (isZh
    ? `第${h.line}行：跳转「${h.jump}」直接兑付「${h.payoff}」——${h.reason}，把签字/决裂/翻盘那一场正面写出来，跳转只能用来进入新场景`
    : `L${h.line}: jump "${h.jump}" cashes out "${h.payoff}" — ${h.reason}; write the signing, breakup or reversal scene itself; use jumps only to enter new scenes`));
  const advice = isZh
    ? '时间跳转是转场工具，不是结果快递。删掉"三天后，她已经签好协议/一年后公司上市"，让观众看见最难的那场谈判或决裂；真要跳，跳转后第一拍必须是人物正在做事的具体场面（推门、拿起电话、对峙），而不是叙述者报账。'
    : 'A time jump changes scenes; it must not deliver verdicts. Cut "three days later, the papers were signed / a year later the company went public" and stage the hardest negotiation or breakup on screen. If you must jump, the first beat after it must be a person mid-action — a door, a phone call, a confrontation — never a narrator balance sheet.';

  return { score, hits, issues, advice };
}

/**
 * 前置教学：buildTimeJumpPayoffDirective(_format='LIVE', lang='zh')
 * -------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 timeJumpPayoff 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"只扫跳转行 + 裸跳转次行首句 / 同句共现 / 一行一次 /
 *       纯转场与无跳转结果不判"的口径，避免写完被 prePolish jumpHint 与 craft/deai 复评打回。
 */
export function buildTimeJumpPayoffDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Time-Jump Payoff Pre-Writing Briefing (same source as timeJumpPayoff: a jump caption cashes out an off-screen result; 1 hit = 75, 2+ hits = max(25, 100 - n x 25))】',
      '- Scope: only lines carrying a time phrase are scanned, plus the line that follows a bare jump caption; all other lines are ignored.',
      '- Jump phrases: three days later, two weeks later, N days / weeks / months / years later, the next day, the next morning, the following day, years later, time passed, fast-forward, and the equivalent bare caption lines.',
      '- Payoff phrases: signed / finalized / dropped the charges / settled / agreed / consented / forgave / reconciled / engaged / married / went public / went bankrupt / changed hands / died / passed away / gave birth / discharged.',
      '- Same-clause co-occurrence: each line is split on sentence punctuation (period, exclamation, question mark, semicolon); a hit needs a jump phrase and a payoff phrase inside the same clause, and one hit per line is recorded.',
      '- One hit per line: as soon as one clause in a line hits, the rest of that line is not scanned again.',
      '- Bare jump: when a whole line is only a time caption (bare jump), the first 60 characters of the next non-empty line are inspected; if a payoff phrase appears there, the jump caption line is charged.',
      '- Scene entry only: "three years later, she pushed the door and walked into the meeting room" merely changes scene and is not judged.',
      '- No-jump result: "she signed the agreement on the spot" has no time phrase and is not judged.',
      '- Neighbour divisions: effort-gloss covers an effort adverbial plus a result ("after much struggle, she signed"); this engine covers a time jump plus a result. timeline-consistency time_skip_stuffing covers bare jump markers stacked three or more times with no result; this engine requires the result.',
      '- Hit fields: line, jump, payoff, snippet (first 32 characters) and reason are returned.',
      '- Score: 0 hits = 100; 1 hit = 75; 2 or more = max(25, 100 - n x 25).',
      '- Rewrite: stage the signing, the breakup or the reversal itself; a jump may only enter a new scene. If you must jump, the first beat after it must be a person mid-action, never a narrator balance sheet.',
      '- Pipeline consumption: prePolish injects the hits into the polisher as jumpHint; craft initial, craft re-eval and deai rescan consume the same result; the former 0.01 deai weight was retired at v2.98 and the detector now runs unweighted.',
      '- Self-check: after the jump, is the first beat a person doing something concrete? If it is a reported verdict, the decisive scene was stolen.',
      '- Parity: same-clause co-occurrence, the bare-jump next line, the 32-character snippet and one hit per line match the Chinese layer.',
    ].join('\n');
  }
  return [
    '【时间跳转兑付·前置教学（检测同源：timeJumpPayoff 管跳转字幕替冲突结账；1 次 75 分，≥2 次 max(25, 100 - n × 25)）】',
    '- 检测范围：只扫含跳转词的行，以及裸跳转行的下一非空行首句；其余行不参与。',
    '- 跳转词：N 天后/周后/月后/年后、次日、翌日、第二天（早上/晚上）、当晚、当夜、多年后、几年后、不久后、几天后、不知过了多久、转眼间、时间一晃。',
    '- 兑付词：签好/签下/签了字、办完离婚、领离婚证、净身出户、撤诉、和解、答应、同意、原谅、和好如初、复合、订婚、结婚、怀孕、生下、出院、去世、病逝、易主、上市、破产、倒闭、被收购、辞职、搬家、录取、考上、翻身、成了总裁。',
    '- 同句共现：按句切分（句号/感叹号/问号/分号），一句内同时出现跳转词与兑付词才算命中，跨句不合并；一行只记一次。',
    '- 一行只记一次：一行内只要有一句命中，后续句子不再重复记录。',
    '- 裸跳转通道：整行基本只有时间词（允许句号/括号/破折号）时，看下一非空行句首 60 字内是否出现兑付词；出现则记在裸跳转行上。',
    '- 纯转场不判：「三年后，她推门走进会议室」只换场景状态，不判。',
    '- 无跳转结果不判：「她当场签下协议」没有时间词，属于正面写，不判。',
    '- 邻居分界：effort-gloss 管努力状语+结果（几经周折，她签下了）；timeline-consistency 的 time_skip_stuffing 管裸跳转标记堆 ≥3 次且无结果；本引擎必须「跳转词 × 兑付结果」同句共现。',
    '- 命中字段：line / jump / payoff / snippet（前 32 字）/ reason。',
    '- 得分：0 次 100；1 次 75；≥2 次 max(25, 100 - n × 25)。',
    '- 改写方向：把签字、决裂、翻盘那一场正面写出来；跳转只能用来进入新场景。真要跳，跳转后第一拍必须是人物正在做事的具体场面，不是叙述者报账。',
    '- pipeline 消费：prePolish 把命中注入润色师（jumpHint）；craft 初评、craft 复评、deai 复扫同一结果；deai 维度的 0.01 加权已于 v2.98 退役，检测器保留运行仅退出加权。',
    '- 成稿自查：跳转后第一拍是不是人物在做事？如果只是报了一句结果，最值钱的那场戏已经被偷走了。',
    '- 中英一致：同句共现、裸跳转次行首句、32 字符截断、一行一次与中文层一致。',
  ].join('\n');
}
