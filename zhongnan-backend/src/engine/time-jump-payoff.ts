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
