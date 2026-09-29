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
