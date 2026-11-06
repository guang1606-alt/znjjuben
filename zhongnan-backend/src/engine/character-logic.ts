import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 人物行为逻辑校验（PRD 2.1.3 人物工具人化治理）
 * 离线启发式扫描，抓四类硬伤：
 *  1) 悬空人物：人物卡声明的主要角色本集零出场 / 只被提及没有台词（背景板）
 *  2) 人设在台词上崩塌：声明的说话风格与实际台词矛盾（寡言者长篇大论、粗犷者满口书面词）
 *  3) 情绪无过渡跳变：同一角色相邻台词情绪正负极性硬切，缺动作/情绪缓冲
 *  4) 配角工具人：功能性龙套只有一句推进剧情的台词、没有任何独立反应
 * 全部只做可解释的诊断与修改建议，不替用户改稿。
 */

export interface CharProfile {
  voice?: string;       // 说话风格标签，如“少言/粗犷市井/文雅”
  arc?: string;
  hidden?: string[];
}
export type CastMap = Record<string, CharProfile>;

export interface LogicIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'missing' | 'background' | 'voice_break' | 'emotion_jump' | 'tool_support';
  character: string;
  evidence: string;
  advice: string;
}

interface DLine { name: string; emotion: string; text: string }

const WRITTEN_WORDS = ['因此', '然而', '不仅', '而且', '综上所述', '换言之', '与此同时', '之所以', '由于', '显然'];
const TOOL_NAMES = ['路人', '服务员', '前台', '保安', '护士', '店员', '司机', '保洁', '助理', '秘书', '邻居'];
const POS = /笑|喜|开心|温柔|轻松|得意|释然|娇|甜|暖/;
const NEG = /怒|哭|吼|冷|恨|颤|怕|急|厉|酸|哽咽|咬|瞪/;

export function parseDialogue(text: string): DLine[] {
  const out: DLine[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = line.match(/^([一-龥A-Za-z·]{1,6})(?:（([^）]*)）)?[：:](.+)$/);
    if (m && !line.startsWith('△') && !isSceneHeaderLine(line)) {
      out.push({ name: m[1], emotion: m[2] || '', text: m[3].trim() });
    }
  }
  return out;
}

function polarity(emotion: string, text: string): 1 | -1 | 0 {
  const s = emotion + text;
  const p = POS.test(s), n = NEG.test(s);
  if (p && !n) return 1;
  if (n && !p) return -1;
  return 0;
}

export function characterLogicScan(cast: CastMap, text: string): { issues: LogicIssue[]; score: number } {
  const issues: LogicIssue[] = [];
  const dialogues = parseDialogue(text);
  const byName = new Map<string, DLine[]>();
  dialogues.forEach((d) => {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name)!.push(d);
  });

  // 1) 悬空 / 背景板主要人物
  for (const name of Object.keys(cast || {})) {
    const lines = byName.get(name);
    const mentioned = text.includes(name);
    if (!lines || lines.length === 0) {
      issues.push({
        severity: mentioned ? 'mid' : 'high',
        type: mentioned ? 'background' : 'missing',
        character: name,
        evidence: mentioned ? `人物「${name}」仅在动作/叙述中被提及，没有一句台词` : `人物卡有「${name}」，但本集完全未出场`,
        advice: mentioned ? `给「${name}」至少一次带个人立场的反应，避免沦为背景板` : `要么让「${name}」出场，要么从本集人物表移除，避免人设悬空`,
      });
    }
  }

  // 2) 人设在台词上崩塌
  for (const [name, profile] of Object.entries(cast || {})) {
    const lines = byName.get(name) || [];
    const voice = profile.voice || '';
    for (const d of lines) {
      if (/寡言|少言|沉默|话少/.test(voice) && d.text.replace(/[，。、…]/g, '').length > 30) {
        issues.push({ severity: 'mid', type: 'voice_break', character: name, evidence: `「${name}」设定少言，却说了长句：“${d.text.slice(0, 18)}…”`, advice: '压缩成短句或用动作代替，符合寡言人设' });
      }
      if (/粗犷|市井|大老粗|口语|接地气/.test(voice) && WRITTEN_WORDS.some((w) => d.text.includes(w))) {
        issues.push({ severity: 'mid', type: 'voice_break', character: name, evidence: `「${name}」设定粗犷口语，却用了书面词：${d.text}`, advice: '换成大白话，去掉连接词和书面腔' });
      }
    }
    // 3) 情绪无过渡跳变
    let prev = 0;
    for (const d of lines) {
      const cur = polarity(d.emotion, d.text);
      if (prev !== 0 && cur !== 0 && prev + cur === 0) {
        issues.push({ severity: 'low', type: 'emotion_jump', character: name, evidence: `「${name}」相邻台词情绪正负极硬切，缺少过渡`, advice: '中间补一个动作/停顿/心理缓冲，让情绪转折可信' });
      }
      if (cur !== 0) prev = cur;
    }
  }

  // 4) 配角工具人
  for (const [name, lines] of byName.entries()) {
    const isTool = TOOL_NAMES.includes(name) || TOOL_NAMES.some((t) => name.includes(t));
    if (isTool && lines.length === 1) {
      const hasOwnAction = new RegExp(`△[^\\n]*${name}[^\\n]*[。…]`).test(text);
      if (!hasOwnAction) {
        issues.push({ severity: 'low', type: 'tool_support', character: name, evidence: `「${name}」只说了一句推进剧情的话，无独立反应`, advice: '给配角一个符合其身份的小动作/态度，配角也应是活人，不是传声筒' });
      }
    }
  }

  const deduct = issues.reduce((s, i) => s + (i.severity === 'high' ? 18 : i.severity === 'mid' ? 9 : 4), 0);
  return { issues, score: Math.max(0, 100 - deduct) };
}

/**
 * v2.396 人物行为逻辑前置教学（与 characterLogicScan 检测口径 100% 同源）
 * 全制式生效，format 不设门控，仅保留签名。
 * 五类硬伤 + 扣分表 + 台词提取口径 + 无卡豁免，详见正文。
 */
export function buildCharacterLogicDirective(_format: string = 'LIVE', lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') {
    return [
      '[Character logic guardrail — same source as characterLogicScan (five hard failures)]',
      'Input: cast card + episode script. The checker only diagnoses and advises; it never rewrites. Without a cast card none of the five classes fire.',
      '',
      'Five hard limits (thresholds mirror the checker):',
      '1) missing (high, 18 points): a main character declared in the cast card never appears in this episode (the name never occurs in the text). Either bring them on screen or remove them from this episode cast.',
      '2) background (mid, 9 points): a declared character is only mentioned in action/description and has zero dialogue lines. Give at least one reaction with a personal stance.',
      '3) voice_break (mid, 9 points per line): the declared voice tag contradicts the actual line. A tag containing "terse / silent / few words" plus a line longer than 30 chars after removing commas, periods, enumeration marks and ellipses; or a tag containing "rough / street / colloquial / down-to-earth" plus written connectives (therefore, however, not only, moreover, in summary, in other words, meanwhile, the reason is, due to, obviously).',
      '4) emotion_jump (low, 4 points per case): two adjacent lines by the same character flip from positive to negative polarity with no action, pause or inner buffer between them. Positive markers: smile, happy, gentle, relaxed, proud, relieved, sweet, warm. Negative markers: angry, cry, roar, cold, hate, tremble, afraid, anxious, harsh, bitter, choke, bite, glare.',
      '5) tool_support (low, 4 points): the character name equals or contains a tool-name (passerby, waiter, receptionist, guard, nurse, clerk, driver, cleaner, assistant, secretary, neighbor), has exactly 1 dialogue line, and no action line (triangle marker) gives them an independent action in that line.',
      '',
      'Calibration:',
      '- Penalty: 18 / 9 / 4 points by severity, summed per issue; final score = max(0, 100 - penalty), no bonus, no upsampling.',
      '- Polarity: a line carrying both positive and negative markers counts as 0 (mixed emotion) and is not a hard flip; a 0-polarity line neither breaks nor updates the reference, so keep the last non-zero polarity.',
      '- Voice: judged only from the cast voice tag, never guessed; the long-line threshold is > 30 chars after removing commas, periods, enumeration marks and ellipses.',
      '- Dialogue parsing: 2-6 char name at line start + optional parenthesized emotion + colon; lines starting with the action marker and scene headers are not dialogue.',
      '- Without a cast card all five classes are skipped and the score is a full 100; with a cast card and zero dialogue, missing/background still apply.',
      '- Self-check: every main character gets at least one line; a terse character keeps each line at 30 chars or fewer; a rough character avoids written connectives; add an action or pause before an emotional flip; a single-line tool-name character needs an action of their own.',
    ].join('\n');
  }
  return [
    '【人物行为逻辑前置教学（检测同源：characterLogicScan 五类硬伤）】',
    '输入：人物卡 cast + 本集正文；本检测只做可解释诊断，不替用户改稿。',
    '',
    '五类硬线（与检测阈值同源）：',
    '1) missing 悬空人物（high，扣 18 分）：人物卡里的主要角色本集完全未出场（正文连名字都没出现）。要么让他本集出场，要么从本集人物表移除。',
    '2) background 背景板（mid，扣 9 分）：人物卡角色只在动作/叙述里被提及，一句台词都没有。至少给一次带个人立场的反应。',
    '3) voice_break 人设崩塌（mid，扣 9 分，逐句计）：声口标签与台词矛盾——标签含「寡言/少言/沉默/话少」却出现去掉「，。、…」后 > 30 字的长句；标签含「粗犷/市井/大老粗/口语/接地气」却出现书面词（因此/然而/不仅/而且/综上所述/换言之/与此同时/之所以/由于/显然）。',
    '4) emotion_jump 情绪硬切（low，扣 4 分，逐处计）：同一角色相邻台词情绪正负极直接翻转，中间没有任何动作/停顿/心理缓冲。',
    '   - 正极词：笑/喜/开心/温柔/轻松/得意/释然/娇/甜/暖；负极词：怒/哭/吼/冷/恨/颤/怕/急/厉/酸/哽咽/咬/瞪。',
    '   - 同一句同时命中正负极视为 0（情绪复杂）不算硬切；0 极性台词不打断也不更新参照，沿用上一个非 0 极性。',
    '5) tool_support 单句龙套（low，扣 4 分）：角色名等于或包含工具名（路人/服务员/前台/保安/护士/店员/司机/保洁/助理/秘书/邻居），且只有 1 句台词，正文 △ 动作行里也没有该角色的独立动作。',
    '',
    '口径：',
    '- 扣分：high 18 分 / mid 9 分 / low 4 分，逐条累加；最终分 = max(0, 100 - 扣分)，无 bonus、不设上采样。',
    '- 台词提取：行首 2-6 字符姓名 + 可选「（情绪）」+ 冒号；△ 开头与场头行不计台词。',
    '- 无 cast 时五类都不触发（情绪跳变也按人物卡条目遍历），直接满分 100；有 cast 但正文无对白时 missing/background 仍然报。',
    '- 成稿自查：每个主要角色至少一句台词；寡言者一句不超过 30 字；粗犷者不用书面连接词；情绪翻转前补一个动作或停顿；工具名角色单句必须配自己的动作。',
  ].join('\n');
}
