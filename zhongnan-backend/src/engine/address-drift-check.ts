/**
 * v2.354 称谓漂移检测引擎（address-drift-check）
 * --------------------------------------------------------------
 * 盲区（勘察先证伪再坐实）：
 *  - character-logic：管悬空/背景板/人设崩塌/情绪跳变/工具人，不管「同一角色标签漂移」；
 *  - dialogue-name-call：管台词里叫对方名字的密度（vocative），不管说话人标签；
 *  - character-presence-check：管全稿 distinct 说话人计数，不做别名归并；
 *  - listen-script speakerSheet（v2.342）按原始标签聚合分音——
 *    「张总/张建国/建国」被拆成 3 个声部，逐角色配音与 AIGC 角色一致性直接崩。
 *  → 无人管「同一角色在稿中用多个称呼标签」。
 * 口径（窄、确定性、零 IO）：
 *  - 只查台词标签（zh 复用 character-logic.parseDialogue 同源正则；
 *    en 复用 scene-crowd-check.parseSpeakersEn 同源正则），场头/△动作行天然不参与；
 *  - 唯一归属原则：每个标签对全 cast 做关联匹配，归属集合 ≠1 即丢弃——
 *    「张总」在张建国+张建民同姓时不归属任何人（防两兄弟同姓误报），
 *    名变体（建国）只匹配张建国时仍可唯一归属；
 *  - zh 关联规则：全等 / 互相包含（|L|≥2）/ [小老大]姓+称谓 / 名+称谓（建国哥）；
 *  - en 关联规则：token 交集（去 title 词、去单字符 initial）；
 *  - 群体标签（众人/大家/crowd…）与旁白/画外音标签豁免；
 *  - 野生工具人标签（服务员/前台，归属 0）不报；
 *  - 同角色 ≥2 标签 → mid address_drift；≥3 标签 → high address_drift_severe；
 *  - 只用一个非正名标签（全程「张总」）不报——那是 characterLogicScan missing 的地盘。
 * 扣分：high 22 / mid 10，score=max(0, 100-Σ)，与 fact/scene-crowd 家族同刻度。
 * cast 空或 draft <20 字 → checked=false 满分放行。
 */
import { isSceneHeaderLine } from './script-scenes';
import type { CastMap } from './character-logic';

export type DriftLang = 'zh' | 'en';

export interface DriftIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'address_drift' | 'address_drift_severe';
  evidence: string;
  advice: string;
}

export interface DriftResult {
  score: number;
  /** cast 非空且 draft ≥20 字才真正检测 */
  checked: boolean;
  /** 漂移角色数（≥2 标签的角色个数） */
  driftCount: number;
  /** 参与匹配的唯一标签数（已排除群体/旁白） */
  compared: number;
  issues: DriftIssue[];
}

// zh 与 character-logic.parseDialogue 同源（名字 1-6 字+全角括号+冒号）；en 与 scene-crowd-check.parseSpeakersEn 同源
const ZH_DLG = /^([一-龥A-Za-z·]{1,6})(?:（([^）]*)）)?[：:](.+)$/;
const EN_DLG = /^([A-Za-z][A-Za-z\s.'-]{0,22}?)(?:\s*\([^)]*\))?\s*:\s*(.+)$/;

// 群体/旁白清单与 scene-crowd-check 同源
const GROUP_ZH = /^(?:众人|群众|大家|同学们|同事们|朋友们|亲友们|宾客们|员工们|记者们|围观者|吃瓜群众)$/i;
const GROUP_EN = /^(?:crowd|everyone|everybody|all|group|audience|people|onlookers|bystanders|reporters|guests|students|colleagues|friends|relatives|shareholders)$/i;
const NARRATOR = /^(?:旁白|解说|画外音|旁述|叙述|narrator|voiceover|vo|narration)$/i;

/** zh 称谓后缀（姓+称谓 / 名+称谓） */
const TITLES_ZH = [
  '董事长', '老板娘',
  '总', '经理', '董', '老师', '哥', '姐', '弟', '妹', '叔', '姨', '婶', '伯', '爷', '奶',
  '夫人', '太太', '小姐', '先生', '医生', '大夫', '警官', '队长', '主任', '厂长', '校长',
  '教授', '律师', '院长', '科长', '处长', '局长', '书记', '师傅', '老板',
];
/** zh 昵称前缀（小/老/大 + 姓） */
const PREFIX_ZH = ['小', '老', '大'];

/** en title 词（token 交集时剔除，防 Mr. Zhang / Mr. Li 因 mr 相交） */
const TITLES_EN = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'detective', 'officer', 'captain',
  'sergeant', 'sgt', 'coach', 'mayor', 'president', 'judge', 'father', 'sister', 'brother',
  'uncle', 'aunt', 'agent', 'director', 'manager', 'boss', 'sir', 'madam', 'lady', 'lord',
]);

/** zh：标签 L 是否是正名 N 的称呼变体 */
function relatedZh(n: string, l: string): boolean {
  if (l === n) return true;
  if (l.length >= 2 && (l.includes(n) || n.includes(l))) return true;
  const surname = n[0];
  // [小/老/大]姓[+称谓]
  let rest = l;
  if (PREFIX_ZH.includes(rest[0]) && rest.length >= 2) rest = rest.slice(1);
  if (rest === surname) return true; // 老张 / 小张
  if (rest.startsWith(surname) && TITLES_ZH.includes(rest.slice(1))) return true; // 张总 / 老张（前缀已剥）
  // 名+称谓（建国哥 / 明哥）
  const given = n.slice(1);
  if (given.length >= 1 && l.startsWith(given) && l.length > given.length && TITLES_ZH.includes(l.slice(given.length))) return true;
  return false;
}

/** en token：小写、去 title、去单字符 initial */
function enTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !TITLES_EN.has(t)),
  );
}

/** en：标签 L 是否是正名 N 的称呼变体（token 交集） */
function relatedEn(n: string, l: string): boolean {
  const nt = enTokens(n);
  if (nt.size === 0) return false;
  for (const t of enTokens(l)) if (nt.has(t)) return true;
  return false;
}

/** 逐行提台词标签（带首现行号）：跳过空行/△动作行/场头/群体/旁白 */
function speakerLabels(text: string, lang: DriftLang): Map<string, number> {
  const out = new Map<string, number>();
  const lines = (text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('△') || isSceneHeaderLine(t, lang)) continue;
    const m = lang === 'en' ? t.match(EN_DLG) : t.match(ZH_DLG);
    if (!m) continue;
    const name = m[1].trim();
    if (!name || GROUP_ZH.test(name) || GROUP_EN.test(name) || NARRATOR.test(name)) continue;
    if (!out.has(name)) out.set(name, i + 1);
  }
  return out;
}

export function addressDriftCheck(cast: CastMap, draft: string, lang: DriftLang = 'zh'): DriftResult {
  const empty: DriftResult = { score: 100, checked: false, driftCount: 0, compared: 0, issues: [] };
  const text = (draft ?? '').trim();
  const castNames = Object.keys(cast || {}).filter((n) => n.trim().length >= 2);
  if (castNames.length === 0 || text.length < 20) return empty;

  const labels = speakerLabels(text, lang);
  const related = lang === 'en' ? relatedEn : relatedZh;

  // 唯一归属：标签 → 唯一正名（归属 0 或 >1 均丢弃）
  const byChar = new Map<string, { label: string; line: number }[]>();
  for (const [label, line] of labels) {
    const owners = castNames.filter((n) => related(n, label));
    if (owners.length !== 1) continue;
    const owner = owners[0];
    if (!byChar.has(owner)) byChar.set(owner, []);
    byChar.get(owner)!.push({ label, line });
  }

  const issues: DriftIssue[] = [];
  for (const [char, list] of byChar) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.line - b.line);
    const isHigh = sorted.length >= 3;
    const pairs =
      lang === 'en'
        ? sorted.map((p) => `"${p.label}" (line ${p.line})`).join(', ')
        : sorted.map((p) => `「${p.label}」（第${p.line}行）`).join('、');
    issues.push({
      severity: isHigh ? 'high' : 'mid',
      type: isHigh ? 'address_drift_severe' : 'address_drift',
      evidence:
        lang === 'en'
          ? `Character "${char}" speaks under ${sorted.length} different labels: ${pairs}. Voice casting and AIGC character sheets split by speaker label, so one person is treated as ${sorted.length} different voices.`
          : `角色「${char}」在稿中使用 ${sorted.length} 种称呼标签：${pairs}。配音与 AIGC 角色表按标签拆声部——同一角色会被当成 ${sorted.length} 个人配 ${sorted.length} 种声音。`,
      advice:
        lang === 'en'
          ? 'Use one speaker label per character throughout: the canonical name from the character sheet, or one fixed address from first line to last. On first appearance you may annotate identity like "Zhang Jianguo (Mr. Zhang)", then never change the label again.'
          : '全稿统一为一个称呼标签：用人物卡正名，或固定一个称呼从一而终；首次出场可用「张建国（张总）」式括注交代身份，之后标签不再变。',
    });
  }

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + (i.severity === 'high' ? 22 : 10), 0));
  return { score, checked: true, driftCount: issues.length, compared: labels.size, issues };
}

/**
 * v2.360 台词标签唯一前置教学（与上方 addressDriftCheck 同源同文件）。
 * 检测口径只认冒号前的台词标签：同一角色换标签 → 配音/AIGC 角色表拆声部。
 * 因此在撰写师首轮就把「一人一标签、用人物卡正名」教下去，而不是生成后打回。
 * 空 cast 返回 ''（无正名可教，避免留下悬空标题）。
 * en 层零中文硬断言：英文名以外的中文正名不进 en 指令。
 */
export function buildAddressDriftDirective(
  cast: CastMap,
  mode: 'LIVE' | 'AIGC' = 'LIVE',
  lang: DriftLang = 'zh',
): string {
  const names = Object.keys(cast || {}).map((n) => n.trim()).filter((n) => n.length >= 2);
  if (names.length === 0) return '';
  if (lang === 'en') {
    const enNames = names.filter((n) => !/[\u4e00-\u9fff]/.test(n));
    const list = enNames.length > 0 ? enNames.join(', ') : 'the canonical name in each character sheet';
    const fmt = mode === 'AIGC'
      ? 'AIGC format: the body is flowing prose with no △ markers; dialogue still reads "NAME (emotion/action): line"; inner voice only as the (inner: ...) parenthetical.'
      : 'LIVE format: every action gets its own △ line; scene headers and △ lines are not speaker labels and never enter the label check.';
    return `[PRE-WRITING RULE · One speaker label per character — mirrors addressDriftCheck] Voice casting and AIGC character sheets split by the label before the colon, so every extra label turns one person into an extra voice. Write it right the first time:
1) Use exactly one speaker label per character for the whole episode, preferably the canonical name from the character sheet: ${list}.
2) Never mix surname+title, given-name short form, a bare title or the full name for the same person — do not switch between "Mr. Zhang", "Jianguo" and "Zhang Jianguo". On first appearance you may annotate identity once, e.g. "Zhang Jianguo (Mr. Zhang): line"; after that the label never changes.
3) How a character addresses another inside the line ("Mr. Zhang, you...") is free — only the label before the colon is constrained.
4) Crowd labels (crowd/everyone/everybody) and narrator/voice-over/narration labels are exempt; uncast minor roles (waiter/receptionist) may use their job title, but that one person keeps the same label throughout.
5) ${fmt}`;
  }
  const fmt = mode === 'AIGC'
    ? 'AIGC 制式：正文是流畅自然段、不加 △；台词行仍按「角色名（情绪/动作）：台词」，内心只走（内心：…）。'
    : 'LIVE 制式：每个动作独占 △ 行；场头与 △ 动作行不是台词标签，不参与唯一性判断（△ 行里提到「张总」不影响标签）。';
  return `【前置教学·台词标签唯一（与 addressDriftCheck 同源）】配音与 AIGC 角色表都按冒号前的台词标签拆声部——同一角色每多一个标签，就多出一个声部、多配一种声音。先写对再谈润色：
① 每个角色全稿只用一个台词标签，优先人物卡正名：${names.join('、')}。
② 禁止同一角色混用 姓氏+称谓 / 名简称 / 头衔 / 全名：不写「张总：」之后又写「建国：」「张建国：」；首次出场可写「张建国（张总）：台词」一次性交代身份，之后标签不再变。
③ 台词里怎么称呼对方（「张总，您……」）不受限——受限的只有冒号前的标签本身。
④ 群体标签（众人/大家）与旁白、画外音、解说标签豁免；无人物卡的野生角色（服务员/前台）可用职业名，但同一个人全程固定。
⑤ ${fmt}`;
}
