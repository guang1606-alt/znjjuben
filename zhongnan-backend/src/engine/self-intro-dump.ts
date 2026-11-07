import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 简历式自我介绍检测（Self-Intro Dump）
 * ============================================================
 * 治什么病：
 *   开场像念简历——"我叫林晚，今年二十五岁，是顾氏集团总裁助理"
 *   / "My name is Lin Wan. I'm 25, the CEO's assistant."
 *   姓名+年龄+身份三个履历字段被一口气报给观众，戏剧还没开始，
 *   人物先递上一张名片。这是 AI 短剧最高发的开场病之一。
 *
 * 判定（命中需同时凑齐三要素）：
 *   1) 姓名信号：我叫/我姓/我是/这位是/她叫/名叫…（或名片式开场
 *      "林晚，25岁，……" / "Lin Wan, 25, the new …"）
 *   2) 年龄信号：今年/现年/年仅 + N 岁；英文 N years old / , N,
 *   3) 身份信号：是/身为/担任 + 职业头衔（总裁/助理/千金/秘书…），
 *      或"岁，……头衔"名片句式；英文 CEO/secretary/heir…
 *   要素允许跨相邻两行打包（"我叫林晚。\n今年25岁，是总裁助理。"）。
 *
 * 豁免：执法/登记/问诊式问答（前两行内出现"姓名/年龄/职业/
 *   叫什么/多大/name?/how old?"）——分字段作答是真实场景，不是简历。
 *
 * 与既有引擎边界：
 *   - exposition-dialogue 管"你我都知道的信息"式台词，本引擎专管
 *     开场履历包（姓名×年龄×身份三字段同屏）；
 *   - info-delivery 管外部渠道替主角推剧情，本引擎管人物自己报菜名；
 *   - show-dont-tell 管情绪形容词，本引擎管事实性履历直述。
 *
 * 计分：0 次 100；1 次 75；≥2 次 max(25, 100-n*25)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


// 台词话者前缀（跨行打包不许越过话者边界）
const SPEAKER_PREFIX_RE = /^[一-鿿A-Z][^\s：:？?]{0,12}[：:]/;

// 姓名信号
const NAME_ZH = /(?:我\s*叫|我\s*姓|我是|这位是|这就是?|名叫|叫做|她叫|他叫|镜子里的[^\n。]{0,6}叫)/;
const NAME_CARD_ZH = /^[一-鿿]{2,4}[，,、]\s*\d{1,2}\s*岁/;
const NAME_EN = /\b(?:my name is|i(?:'m| am)|this is|meet|the woman (?:in the mirror )?was|his name was|her name was)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
const NAME_CARD_EN = /^[A-Z][a-z]+\s+[A-Z][a-z]+,\s*\d{1,2}[,\s]/;

// 年龄信号
const AGE_ZH = /(?:今年|现年|年仅|年方|芳龄)?\s*(?:\d{1,2}|[一二两三四五六七八九十]{1,3})\s*岁/;
const AGE_EN = /\b\d{1,2}\s*years?\s*old\b|,\s*\d{1,2}\s*,|i(?:'m| am)\s+\d{1,2}\b/i;

// 身份信号：必须有"是/身为/担任"等判断动词带头衔，或"岁，……头衔"名片句
const TITLE_ZH = '(?:总裁|董事长|首席执行官|CEO|千金|大少爷?|二小姐|大小姐|少爷|小姐|少奶奶|少夫人|夫人|太太|继承人|接班人|秘书|助理|特助|总监|总经理|经理|主管|组长|医生|大夫|护士|律师|法官|检察官|教授|老师|导师|设计师|工程师|程序员|大学生|研究生|博士生|学生|保镖|保姆|保安|空姐|飞行员|主播|网红|博主|影后|影帝|明星|艺人|经纪人|记者|编辑|警察|刑警|法医|厨师|服务员|清洁工|外卖员|司机)';
const IDENTITY_ZH = new RegExp(`(?:是个?|身为|担任|出任|作为)[^\\n。！？]{0,12}${TITLE_ZH}|岁[，,、]\\s*[^\\n。]{0,12}${TITLE_ZH}`);
const IDENTITY_EN = /\b(?:the (?:new |future )?|a )?(?:CEO|chief executive(?: officer)?|president|chairman|heir(?:ess)?|secretary|(?:executive |personal )?assistant|director|manager|doctor|nurse|lawyer|professor|teacher|designer|engineer|(?:college )?student|bodyguard|nanny|intern|receptionist|anchor|influencer|actress|actor|talent agent|detective|police officer|chef|waitress|cleaner)\b/i;

// 执法/登记/问诊问答（分字段作答属真实场景）
const OFFICIAL_Q_ZH = /(?:姓名|名字|年龄|多大|几岁|职业|工作单位|报上名来|你叫什么|怎么称呼)/;
const OFFICIAL_Q_EN = /\b(?:name\s*\?|your name|how old|age\s*\?|occupation|what do you do|identify yourself)\b/i;

export interface SelfIntroHit {
  line: number;
  snippet: string;
  elements: string[]; // 命中的三要素
  reason: string;
}

export interface SelfIntroDumpResult {
  score: number;
  hits: SelfIntroHit[];
  issues: string[];
  advice: string;
}

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * 检测简历式自我介绍。
 */
export function selfIntroDump(draft: string): SelfIntroDumpResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const lines = draft.split(/\r?\n/);
  const hits: SelfIntroHit[] = [];

  const testTriple = (text: string): string[] => {
    const elements: string[] = [];
    if (isZh) {
      if (NAME_ZH.test(text) || NAME_CARD_ZH.test(text)) elements.push('name');
      if (AGE_ZH.test(text)) elements.push('age');
      if (IDENTITY_ZH.test(text)) elements.push('identity');
    } else {
      if (NAME_EN.test(text) || NAME_CARD_EN.test(text)) elements.push('name');
      if (AGE_EN.test(text)) elements.push('age');
      if (IDENTITY_EN.test(text)) elements.push('identity');
    }
    return elements;
  };

  const underOfficialQuestion = (i: number): boolean => {
    const qRe = isZh ? OFFICIAL_Q_ZH : OFFICIAL_Q_EN;
    for (let k = Math.max(0, i - 2); k < i; k++) {
      const near = lines[k].trim();
      if (near.includes('？') || near.includes('?') || /[:：]\s*$/.test(near)) {
        if (qRe.test(near)) return true;
      }
    }
    return false;
  };

  const consumed = new Set<number>();
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line) || consumed.has(i)) return;

    // 同行三要素
    let elements = testTriple(line);
    let span = 1;

    // 相邻行打包：本行有姓名，下一非场景行补齐年龄+身份；
    // 但提问行（结尾问号）和台词话者边界不许跨
    if (elements.length < 3 && i + 1 < lines.length && !/[？?]\s*$/.test(line)) {
      const next = lines[i + 1].trim();
      if (next && !isSceneHeaderLine(next) && !SPEAKER_PREFIX_RE.test(next)) {
        const merged = testTriple(`${line} ${next}`);
        if (merged.length === 3) {
          elements = merged;
          span = 2;
        }
      }
    }
    if (elements.length < 3) return;
    if (underOfficialQuestion(i)) return;

    if (span === 2) consumed.add(i + 1);
    hits.push({
      line: i + 1,
      snippet: snippet(span === 2 ? `${line} ${lines[i + 1].trim()}` : line, isZh ? 30 : 48),
      elements,
      reason: isZh
        ? '姓名、年龄、身份打包报出，像念简历'
        : 'Name, age and job title delivered together as a résumé readout',
    });
  });

  const n = hits.length;
  const score = n === 0 ? 100 : n === 1 ? 75 : Math.max(25, 100 - n * 25);
  const issues = hits.map((h) => (isZh
    ? `第${h.line}行：简历式自我介绍「${h.snippet}」——${h.reason}，删掉履历包，用一场正在发生的麻烦带出身份`
    : `L${h.line}: résumé intro "${h.snippet}" — ${h.reason}; cut the bio packet and expose the job through live trouble`));
  const advice = isZh
    ? '人物履历不能靠嘴报：删掉"我叫X、今年X岁、是XX"式开场，让名字从前台的呼喊/工牌/同事嘲讽里漏出来，让身份从她正在处理的麻烦里长出来。'
    : 'Never hand the audience a business card: cut "My name is X, I am N, the …". Let the name leak through a page call or a badge, and let the job show in the trouble she is already handling.';

  return { score, hits, issues, advice };
}

/**
 * 前置教学：buildSelfIntroDumpDirective(_format='LIVE', lang='zh')
 * -------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 selfIntroDump 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"姓名×年龄×身份三要素 / 相邻两行打包边界 /
 *       登记问诊豁免 / 0-1-≥2 计分"的口径，避免写完被 prePolish introHint 与 craft/deai 复评打回。
 */
export function buildSelfIntroDumpDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Résumé Intro Pre-Writing Briefing (same source as selfIntroDump: name, age and job title read out like a CV; 1 hit = 75, 2+ hits = max(25, 100 - n x 25))】',
      '- Scope: every non-empty line is scanned, scene headers are skipped, and dialogue lines are scanned too because a character reading out her own bio is still a bio; there is no opening-only limit, the whole script is scanned, and all of it is diagnostic only.',
      '- Name signals: my name is / I am / I am called / this is / meet, or a name-card opening such as "Lin Wan, 25, the new assistant".',
      '- Age signals: this year / now / only / aged plus a number and years old, in digits or spelled-out numerals.',
      '- Identity signals: a copula or serving-as verb (am / as / serves as / works as) plus a job title: CEO / chairman / heir / heiress / secretary / assistant / director / manager / lawyer / doctor / nurse / professor / teacher / student / bodyguard / driver.',
      '- Cross-line packing: the name and the age or identity may pack across two adjacent lines ("My name is Lin Wan. / I am 25, the CEO\'s assistant."), but a line ending with a question mark, a speaker prefix line and a scene header are never crossed.',
      '- Official-question exemption: if an official question or a colon-ended setup within the previous 2 lines asks for name, age or occupation, the field-by-field answer is a real registration, intake or interrogation exchange and is not judged.',
      '- Score: 0 hits = 100; 1 hit = 75; 2 or more hits = max(25, 100 - n x 25).',
      '- Hit fields: line, snippet (first 30 characters in Chinese and 48 characters in English), elements (name / age / identity) and reason are returned.',
      '- Neighbour divisions: exposition-dialogue covers lines that tell both parties what they already know; info-delivery covers an external channel pushing the plot; show-dont-tell covers emotion adjectives; this engine reads only the opening bio packet with all three fields on screen.',
      '- Rewrite: cut the bio packet; let the name leak through a page call, a badge or a colleague\'s mockery, and let the job grow out of the live trouble she is already handling.',
      '- Single hit per span: two adjacent lines that pack into one hit are charged once, and the second line is marked consumed so it is never charged again.',
      '- Pipeline consumption: prePolish injects the hits into the polisher as introHint; craft initial, craft re-eval and deai rescan consume the same result; the former 0.01 deai weight was retired at v2.103 and the detector now runs unweighted.',
      '- Self-check: does the opening hand the audience a business card? Are name and job earned from live trouble instead?',
      '- Parity: the 30/48-character snippet, two adjacent lines packing, the previous 2 lines exemption and the 0/1/2+ scoring match the Chinese layer.',
    ].join('\n');
  }
  return [
    '【简历式自我介绍·前置教学（检测同源：selfIntroDump 管姓名×年龄×身份三要素同屏报菜名；1 次 75 分，≥2 次 max(25, 100 - n × 25)）】',
    '- 检测范围：所有非空行参与，场头跳过，台词行同样扫描（人物自己念履历也是念履历），不限开场（全片任何位置都算），仅作诊断。',
    '- 三要素·姓名：我叫/我姓/我是/这位是/这就是/名叫/叫做/她叫/他叫，或名片式开场「林晚，25岁，……」。',
    '- 三要素·年龄：今年/现年/年仅/年方/芳龄 + N 岁（阿拉伯数字或中文数字均可）。',
    '- 三要素·身份：是/身为/担任/出任/作为 + 职业头衔（总裁/董事长/CEO/千金/少爷/小姐/秘书/助理/特助/总监/经理/律师/医生/护士/教授/老师/学生/保镖/司机…）。',
    '- 跨行打包：姓名与本行之外补齐的年龄/身份可跨相邻两行打包（"我叫林晚。/今年25岁，是总裁助理。"），但问号结尾的提问行不许跨、话者前缀行不许跨、场头不许跨（不跨场）。',
    '- 豁免·登记问答：命中行前 2 行内出现问号结尾或冒号结尾，且含姓名/名字/年龄/多大/几岁/职业/叫什么 → 分字段作答属真实登记/问诊/执法场景，不判。',
    '- 得分：0 次 100；1 次 75；≥2 次 max(25, 100 - n × 25)。',
    '- 命中字段：line / snippet（中文前 30 字，英文前 48 字符）/ elements（name / age / identity）/ reason。',
    '- 邻居分界：exposition-dialogue 管"你我都知道的信息"式台词；info-delivery 管外部渠道替主角推剧情；show-dont-tell 管情绪形容词直述；本引擎只管开场履历包（姓名×年龄×身份三字段同屏）。',
    '- 改写方向：删掉履历包，让名字从前台呼喊/工牌/同事嘲讽里漏出来，让身份从她正在处理的麻烦里长出来。',
    '- 一次检定：相邻两行打包成一条命中只记一次，第二行记 consumed，不再重复扣分。',
    '- pipeline 消费：prePolish 把命中注入润色师（introHint）；craft 初评、craft 复评、deai 复扫消费同一结果；deai 维度 0.01 加权已于 v2.103 退役，检测器保留运行仅退出加权。',
    '- 成稿自查：开场是不是递了一张名片？名字和身份有没有从正在发生的麻烦里挣出来？',
    '- 中英一致：snippet 30/48 字符、相邻两行打包、前 2 行豁免与 0/1/≥2 计分中英同口径。',
  ].join('\n');
}
