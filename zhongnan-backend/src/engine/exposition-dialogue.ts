import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 保姆式对白检测（Exposition Dialogue / As-You-Know-Bob）
 * -----------------------------------------------------------
 * 创作能力类引擎：AI 剧本最偷懒的背景交代方式——
 *  1) shared_memory（共知旧事）：两个当事人把彼此都在场、都记得的事
 *     长篇讲给对方听，实际是讲给观众听：
 *     "你还记得吗，十年前那个雨夜，是我爸出钱把你妈从医院抢救回来的。"
 *  2) rule_dump（规矩宣讲）：人物像念说明书一样交代世界观规则：
 *     "根据公司规定，连续三个月业绩垫底的员工会被无条件开除。"
 *
 * 边界：dialogue-water 的 repeat 类用关键词抓"你说过/我告诉过你"等
 * 短句水分（不推进就扣分）；本引擎只抓"框架词 + 成段事实 payload"
 * 的长信息倾倒——信息是真信息，但交付方式错误。治法也不同：
 * 水分句删掉，信息倾倒要拆进争吵/行动/选择里一次漏一点。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ExpositionHit {
  type: 'shared_memory' | 'rule_dump';
  line: number;
  speaker?: string;
  length: number;
  snippet: string;
  reason: string;
}

export interface ExpositionDialogueResult {
  score: number;
  hits: ExpositionHit[];
  dialogueLines: number;
  dumpRate: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


// 共知旧事框架：唤起"你也记得"的共同记忆
const MEMORY_FRAME_ZH = /(你还记得|你记不记得|你忘了|想当年|当年|那年|十年前|二十年前|三十年前|多年前|小时候|别忘了|不要忘了|难道你忘了|我们结婚.{0,4}年|我们在一起.{0,4}年|当初是我|当年要不是)/;
const MEMORY_FRAME_EN = /\b(do you remember|you remember|you've forgotten|back in the day|back when|years ago|when we first (met|started)|we've been (married|together) for|if it wasn't for me|i was the one who)\b/i;

// 规矩/设定宣讲框架
const RULE_FRAME_ZH = /(根据.{0,8}(?:规定|规矩|律法|法律|合同|协议|家规|祖训|制度|条例|章程)|按照.{0,8}(?:规定|规矩|律法|合同|协议|家规|祖训)|依据.{0,8}(?:规定|律法|合同)|咱们?这行的规矩|行规是|按规矩)/;
const RULE_FRAME_EN = /\b(per (?:company )?policy|according to (?:the |company |corporate |our )?(?:rules?|contract|law|policy|handbook|terms)|under section|the rules? (?:say|state)|company policy states)\b/i;

// 事实 payload 信号：数字/时间/金额/关系
const FACT_ZH = /(\d|[一二三四五六七八九十百千万亿两]\s*[年岁万亿天日月])/;
const FACT_EN = /\b\d|\b(year|years|month|months|million|billion|thousand)\b/i;

const stripPunct = (s: string): string => s.replace(/[，。！？、…：；""''（）()\s,.!?:;'"()-]/g, '');

export function expositionDialogue(draft: string): ExpositionDialogueResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], dialogueLines: 0, dumpRate: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const memFrame = isZh ? MEMORY_FRAME_ZH : MEMORY_FRAME_EN;
  const ruleFrame = isZh ? RULE_FRAME_ZH : RULE_FRAME_EN;
  const factRe = isZh ? FACT_ZH : FACT_EN;

  const hits: ExpositionHit[] = [];
  let dialogueLines = 0;
  const snippet = (s: string) => (s.length > 24 ? `${s.slice(0, 24)}…` : s);

  draft.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    const dm = line.match(/^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/);
    if (!dm) return;
    dialogueLines++;
    const speaker = dm[1].trim();
    const text = dm[2].trim();
    const len = isZh ? stripPunct(text).length : text.split(/\s+/).filter(Boolean).length;

    // ① 共知旧事：框架词 + 成段 payload（长度或硬事实）
    if (memFrame.test(text)) {
      const longEnough = isZh ? len >= 18 : len >= 16;
      if (longEnough || (factRe.test(text) && (isZh ? len >= 12 : len >= 10))) {
        hits.push({
          type: 'shared_memory',
          line: idx + 1,
          speaker,
          length: len,
          snippet: snippet(text),
          reason: isZh
            ? '双方都在场的旧事被长篇讲给对方听——信息是倒给观众的'
            : 'Shared history lectured back to someone who lived it — the info is for the audience',
        });
      }
    }

    // ② 规矩宣讲：框架词 + payload（规矩宣讲通常更长才构成"念说明书"）
    if (ruleFrame.test(text)) {
      const longEnough = isZh ? len >= 15 : len >= 12;
      if (longEnough) {
        hits.push({
          type: 'rule_dump',
          line: idx + 1,
          speaker,
          length: len,
          snippet: snippet(text),
          reason: isZh
            ? '人物像念说明书一样交代规则——世界观应通过选择与代价显现'
            : 'A character recites the rulebook — worldbuilding should surface through choices and costs',
        });
      }
    }
  });

  const dumpRate = dialogueLines > 0 ? hits.length / dialogueLines : 0;
  const score = Math.max(15, 100 - hits.length * 12);

  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? (h.type === 'shared_memory'
        ? `第${h.line}行「${h.speaker}」${h.reason}：「${h.snippet}」——把旧事拆进当下的争吵、动作或要挟里，一次只漏一个事实`
        : `第${h.line}行「${h.speaker}」${h.reason}：「${h.snippet}」——让人物在执行规则或钻规则空子时把规则演出来`)
      : (h.type === 'shared_memory'
        ? `Line ${h.line} "${h.speaker}": ${h.reason}: "${h.snippet}" — leak one fact at a time through a present-tense fight, favor, or threat`
        : `Line ${h.line} "${h.speaker}": ${h.reason}: "${h.snippet}" — play the rule by enforcing or bending it`));

  const advice = isZh
    ? hits.length > 0
      ? '观众不需要被科普，需要被卷入。共知的旧事只在当下冲突用得上时才漏一句；规则让人物在违反、利用或承受它时演出来。'
      : '背景信息均随冲突自然露出，无保姆式宣讲，保持。'
    : hits.length > 0
      ? 'Never brief the audience — involve them. Leak shared history only when the present fight needs it, one fact at a time; make rules visible by having someone break, exploit, or pay for them.'
      : 'Backstory surfaces through conflict with no exposition lectures; keep it.';

  return { score, hits, dialogueLines, dumpRate, issues, advice };
}
