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
