/**
 * v2.353 跨集台词复读检测引擎（episode-replay-check）
 * --------------------------------------------------------------
 * 盲区（勘察先证伪再坐实）：
 *  - scene-padding-check 只管集内 recap 注水词（前情提要/我不是告诉过你），不做跨集文本比对；
 *  - cliffhanger-payoff 管「上集钩子必须在本集复现」（反向要求重复）；
 *  - opening-continuity / cliffhanger-dissolve 管承接有无与消解质量；
 *  → 无人管「上集说过的台词本集原样再说一遍」——追更付费观众最敏感「这段我看过」，
 *    同样的狠话/误会台词相邻两集复用是评论区抓虫重灾区。
 * 口径（窄、确定性、零 IO）：
 *  - 只比对台词行（zh 复用 character-logic.parseDialogue 同源正则；en 复用 scene-crowd-check
 *    parseSpeakersEn 同源正则取台词文本），场头/△动作行天然不参与；
 *  - 归一化：zh 去全部非 CJK/字母/数字字符；en 小写+去非字母数字 → 标点差异仍判复读；
 *  - 长度门槛：zh ≥12 字 / en ≥20 字母才比对（「你走吧」「Let it go」级短句复现是正常节拍）；
 *  - 长句升级：zh ≥30 字 / en ≥50 字母 单条即 high（整段搬运比单句复读恶劣一档）；
 *  - 同一句本集内多次复读只报一次（按归一句去重）；
 *  - prevSummary <20 字或 draft <20 字 → checked=false 满分放行（第 1 集/无上集天然豁免）。
 * 扣分：high 22 / mid 10，score=max(0, 100-Σ)，与 fact/scene-crowd 家族同刻度。
 */
import { isSceneHeaderLine } from './script-scenes';

export type ReplayLang = 'zh' | 'en';

export interface ReplayIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export interface ReplayResult {
  score: number;
  /** prevSummary 与 draft 均 ≥20 字才真正检测 */
  checked: boolean;
  /** 复读台词条数（去重后） */
  replayCount: number;
  /** 本集参与比对的台词数（≥长度门槛） */
  compared: number;
  issues: ReplayIssue[];
}

// zh 与 character-logic.parseDialogue 同源（名字 1-6 字+全角括号+冒号）；en 与 scene-crowd-check.parseSpeakersEn 同源
const ZH_DLG = /^([一-龥A-Za-z·]{1,6})(?:（([^）]*)）)?[：:](.+)$/;
const EN_DLG = /^([A-Za-z][A-Za-z\s.'-]{0,22}?)(?:\s*\([^)]*\))?\s*:\s*(.+)$/;

const ZH_MIN = 12;
const ZH_LONG = 30;
const EN_MIN = 20;
const EN_LONG = 50;

interface DLine {
  line: number; // 1 基行号
  text: string; // 台词正文（不含说话人/情绪括注）
}

/** 逐行提台词（带行号）：跳过空行/△动作行/场头，只留 NAME: text 形态 */
function dialogueLines(text: string, lang: ReplayLang): DLine[] {
  const out: DLine[] = [];
  const lines = (text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('△') || isSceneHeaderLine(t, lang)) continue;
    const m = lang === 'en' ? t.match(EN_DLG) : t.match(ZH_DLG);
    if (!m) continue;
    // zh：group1=name, group2=emotion, group3=text；en：group1=name, group2=text
    const body = (lang === 'en' ? m[2] : m[3]) || '';
    const text2 = body.trim();
    if (text2) out.push({ line: i + 1, text: text2 });
  }
  return out;
}

/** zh 归一：去全部非 CJK/字母/数字字符（标点空白全去） */
const normZh = (s: string): string => s.replace(/[^一-龥A-Za-z0-9]/g, '');
/** en 归一：小写 + 去非字母数字（won't→wont，标点空白全去） */
const normEn = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function episodeReplayCheck(prevSummary: string, draft: string, lang: ReplayLang = 'zh'): ReplayResult {
  const empty: ReplayResult = { score: 100, checked: false, replayCount: 0, compared: 0, issues: [] };
  const prev = (prevSummary ?? '').trim();
  const text = (draft ?? '').trim();
  if (prev.length < 20 || text.length < 20) return empty;

  const norm = lang === 'en' ? normEn : normZh;
  const min = lang === 'en' ? EN_MIN : ZH_MIN;
  const longAt = lang === 'en' ? EN_LONG : ZH_LONG;

  // 上集台词归一集合（≥门槛）
  const prevSet = new Set<string>();
  for (const d of dialogueLines(prev, lang)) {
    const n = norm(d.text);
    if (n.length >= min) prevSet.add(n);
  }

  const issues: ReplayIssue[] = [];
  const seen = new Set<string>(); // 本集内同一句只报一次
  let compared = 0;
  for (const d of dialogueLines(text, lang)) {
    const n = norm(d.text);
    if (n.length < min) continue;
    compared++;
    if (!prevSet.has(n) || seen.has(n)) continue;
    seen.add(n);
    const isLong = n.length >= longAt;
    const clip = d.text.length > 40 ? `${d.text.slice(0, 40)}…` : d.text;
    issues.push({
      severity: isLong ? 'high' : 'mid',
      type: isLong ? 'episode_replay_long' : 'episode_replay_line',
      evidence:
        lang === 'en'
          ? `Line ${d.line} repeats a previous-episode line verbatim: "${clip}"`
          : `第${d.line}行台词与上集原文完全重复：「${clip}」`,
      advice:
        lang === 'en'
          ? 'Never repeat a previous-episode line verbatim — returning viewers are most sensitive to "I have seen this". Rephrase it, aim it at a different listener, or cut it and let action carry the beat. If it is an intentional callback, shrink it under 12 chars and forge it into a quotable punchline.'
          : '上集说过的原话别再说第二遍——追更观众最敏感「这段我看过」。改写角度：换说法（同义改写）、换说话对象（对谁说决定怎么说）、或删掉用动作接住节拍。若是有意 callback 让观众回味，缩到 12 字以内做成金句。',
    });
  }

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + (i.severity === 'high' ? 22 : 10), 0));
  return { score, checked: true, replayCount: issues.length, compared, issues };
}

/**
 * v2.372 前置教学指令：本集不许原样搬运上集台词
 * ----------------------------------------------------------------------
 * 与 episodeReplayCheck 同文件同源（v2.157 同源铁律）。
 * zh：只比对台词行 / 归一去标点 / 12 与 30 字门槛 / 22 与 10 扣分 /
 * 三种正向动作 / 短句豁免 / callback 缩句 / 五项边界 / 制式分叉。
 * en 层零中文（20 与 50 字母、22 与 10）。缺省 format=LIVE。
 */
export function buildEpisodeReplayDirective(
  format: 'LIVE' | 'AIGC' = 'LIVE',
  lang: ReplayLang = 'zh',
): string {
  if (lang === 'en') {
    const base = [
      '◆ Cross-episode line replay control: never copy a previous-episode line verbatim into this episode.',
      '  Only dialogue lines are compared (scene headers, title lines, and △ action lines are skipped). Punctuation differences do not count as a change — after normalization the line is still the same line.',
      '  Length gates: Chinese ≥12 chars, English ≥20 letters before comparison — a short line like "let it go" repeating is a normal beat, not replay.',
      '  Long-line escalation: Chinese ≥30 chars / English ≥50 letters → high, 22 points off each; 12-29 chars / 20-49 letters → mid, 10 points off each.',
      '◆ Three fixes: ① Rephrase it — keep the meaning, change the wording, ② Aim it at a different listener so the landing point changes, ③ Cut the line and let an action, a prop, or silence carry the beat.',
      '◆ Intentional callback for returning viewers: shrink it under 12 chars into a quotable punchline; never truck in the whole line again.',
      '◆ Exemptions: Episode 1 / previous summary under 20 chars / draft under 20 chars are not checked.',
      '◆ Boundaries: in-episode repetition → repetition-check / in-episode recap filler → scene-padding / previous hook must reappear → cliffhanger-payoff / opening weld → opening-continuity / flashback replay → flashback-crutch.',
    ];
    if (format === 'AIGC') {
      base.push('◆ AIGC mode: no △ lines in the body. Put a recalled line into a flowing paragraph and compress it into one short echo inside the paragraph; a whole verbatim block is not allowed.');
    } else {
      base.push('◆ LIVE mode: write a recall as a dedicated △ action line plus one short punchline, so the actor never re-reads the previous episode\'s lines.');
    }
    return base.join('\n');
  }

  const zh = [
    '◆ 跨集台词复读控制：本集不许原样搬运上集说过的话。',
    '  只比对台词行（场头/剧名/△ 动作行不计入）；标点差异不算改动——归一化去掉标点后，仍是同一句。',
    '  长度门槛：中文 ≥12 字、英文 ≥20 字母才比对；「你走吧」这类短句复现是正常节拍，不算复读。',
    '  长句升级：中文 ≥30 字 / 英文 ≥50 字母 单条判 high 扣 22 分；12-29 字 / 20-49 字母 判 mid 扣 10 分。',
    '  同一句在本集内只报一次，改一处就够。',
    '◆ 三种正向动作：① 换说法——同义改写，保住意思换措辞 ② 换说话对象——同一层意思对另一个人说，落点就变了 ③ 删掉用动作接住节拍——把台词落成 △ 动作、道具或沉默。',
    '◆ 有意 callback 让追更观众回味：必须缩到 12 字以内做成金句，不许整段照搬。',
    '◆ 豁免：第 1 集 / 上集摘要不足 20 字 / 本集正文不足 20 字 不检测。',
    '◆ 边界五项：集内重复归 repetition-check、集内 recap 注水词归 scene-padding、上集钩子必须复现归 cliffhanger-payoff、开场承接归 opening-continuity、闪回搬运归 flashback-crutch。',
  ];
  if (format === 'AIGC') {
    zh.push('◆ AIGC 制式：正文不加 △。复述回忆写进连续自然段，压成一句短回声即可（内心：…）合规，整段照搬不合规。');
  } else {
    zh.push('◆ LIVE 制式：复述回忆写成独占 △ 动作行 + 一句短金句，别让演员把上集的台词再念一遍。');
  }
  return zh.join('\n');
}
