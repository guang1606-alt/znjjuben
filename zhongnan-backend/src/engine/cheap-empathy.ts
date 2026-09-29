import { isSceneHeaderLine } from './script-scenes';
/**
 * 廉价共情检测（v2.80 块79，创作能力类）
 * ------------------------------------------------------------------
 * 病象：一方刚袒露伤口，另一方零磕绊、零自我，立刻派发标准共情话术——
 *   林晚：我妈走那年我才八岁。
 *   沈志国：我理解你的感受，这些年你一定很不容易。想哭就哭吧。
 *   LINNA: I lost my mother when I was eight.
 *   VICTOR: I understand how you feel. That must have been so hard.
 *           It is okay to cry.
 * 这是心理咨询师话术，不是人物关系：
 *  1) 真实安慰是笨拙、跑题、带行动的——递纸巾、倒水、沉默地坐着；
 *  2) 真正的共情用自己的伤口陪（"我爸走那年我也是……"），而不是精准
 *     复述对方情绪；无成本的共情让说话人变成情绪按摩椅；
 *  3) 每场苦情戏都配一个这样的角色，袒露立刻被话术收编，观众出戏。
 *
 * 与既有引擎的分工：
 *  - self-pity-litany：管袒露方自己哭诉清单，本引擎管倾听方的话术回应；
 *  - cheap-forgiveness：管伤害方秒被原谅，本引擎管第三方/同伴秒共情；
 *  - emotion-label-dialogue：管角色喊自己的情绪名，本引擎管替对方命名情绪；
 *  - dialogue-water：管无功能水词，本引擎管"有功能但假"的咨询师腔。
 *
 * 判定：
 *  - EMPATHY 词表命中台词（我理解你的感受/你一定很难受/想哭就哭/我懂你/
 *    I understand how you feel/That must have been hard/It's okay to cry…）；
 *  - rescue（±3 行同场）：安慰者自我暴露（我当年/我爸走的时候/
 *    when my own…/I remember when I lost…），或笨拙行动安抚
 *    （递纸巾/倒水/沉默/披外套/pushed the tissues/said nothing/sat with…）；
 *  - 职业豁免：±4 行出现医生/心理咨询师/社工或 doctor/therapist/
 *    counselor/psychiatrist/social worker——职业共情不算病；
 *  - 单次不判（人偶尔会说句人话），未豁免命中 ≥2 起判。
 * 计分：n=2 → 70；每多 1 句 −20，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface CheapEmpathyHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  speaker: string;
  snippet: string;
  marker: string;
  /** 是否被救援（自我暴露/笨拙行动） */
  rescued: boolean;
  /** 是否职业身份豁免 */
  professional: boolean;
  reason: string;
}

export interface CheapEmpathyResult {
  score: number;
  hitCount: number;
  /** 计入计分的命中（未救援、非职业） */
  unrescuedCount: number;
  hits: CheapEmpathyHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const CUE_ZH = /^([一-鿿A-Za-z0-9·]{1,8})(?:（[^）]{0,40}）)?\s*[：:]\s*(.+)$/;
const CUE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\((?:V\.?O\.?|O\.?S\.?|CONT(?:'?D)?|OFFSCREEN|FILTERED|ON THE PHONE|[^()]{0,40})\))?\s*:\s*(.+)$/;

/* 标准化共情话术（倾听方替对方做情绪按摩） */
const EMPATHY_ZH = [
  /我理解你的?感受/,
  /我(?:能|完全|特别)?(?:理解|懂)你/,
  /你(?:一定|肯定|心里)(?:很|特别|非常)?(?:难受|痛苦|难过|委屈|不容易|辛苦)/,
  /想哭就哭/,
  /哭出来(?:会|就)(?:好|舒服)/,
  /你(?:已经)(?:做得|够)(?:很好|好|不容易)了?/,
  /你有(?:权利|资格)(?:生气|难过|愤怒|哭)/,
  /我会(?:一直)?陪(?:着|在)你(?:身边)?/,
  /别(?:一个人|自己)扛着?/,
  /你的感受(?:我|是)(?:能)?(?:理解|体会)/,
];
const EMPATHY_EN = [
  /\bi understand (?:how|exactly how) you feel\b/i,
  /\bi know (?:exactly )?how you feel\b/i,
  /\bthat must (?:have been|be) (?:so |really |incredibly )?(?:hard|difficult|painful|tough|scary|lonely)\b/i,
  /\bit(?:'?s| is) okay to cry\b/i,
  /\byou have (?:every )?right to (?:be |feel )?(?:angry|upset|sad|hurt|furious)\b/i,
  /\byou did everything you could\b/i,
  /\byou(?:r feelings) (?:are|'?re) valid\b/i,
  /\bi hear you\b/i,
  /\byou(?:'?ve| have) been so strong\b/i,
  /\byou don'?t have to (?:be strong|hold it in)\b/i,
  /\bi'?m (?:always )?here for you\b/i,
  /\blet it all out\b/i,
];

/* 救援 A：安慰者用自己的伤口陪（自我暴露） */
const SELF_DISCLOSURE_ZH = /(?:我(?:当年|那时候|那阵子|小时候)|我爸|我妈|我(?:丈夫|妻子|老公|老婆|哥哥|姐姐|孩子)(?:走|死|离开|没)的?时候|我也(?:曾|有过|经历过)|换作是我|我(?:第一次|上次)失(?:去|恋))/;
const SELF_DISCLOSURE_EN = /\b(?:when i (?:was|lost|left)|my (?:own )?(?:father|mother|mom|dad|husband|wife|brother|sister|child|son|daughter) (?:died|passed|left)|i (?:also )?(?:once|remember when i|have been there)|when my (?:own )?family|i lost (?:mine|someone) too)\b/i;

/* 救援 B：笨拙的行动安抚（做，而不是精准复述情绪） */
const ACTION_COMFORT_ZH = /(?:递[过了]?(?:纸巾|毛巾|水|杯|外套|衣服)|塞[了过]?(?:颗?糖|杯热水)|倒[了杯]?(?:杯?热水|温水|水)|默默?地?(?:坐|陪|站)|沉默[了着]|拍[了拍]?(?:拍)?(?:他|她|你)?的?(?:肩|背|手背|头)|把手放在|披上|擦(?:掉|了擦)(?:眼泪|泪)|红了眼眶|喉结动|把人(?:拉|拽)进(?:怀里|怀中))/;
const ACTION_COMFORT_EN = /\b(?:push(?:ed)? (?:the )?(?:tissues?|a tissue)|hand(?:ed)? (?:her|him) (?:a |the |some )?(?:tissue|water|glass|coat)|pour(?:ed)? (?:her|him) (?:some )?water|said nothing|without a word|in silence|sat (?:down )?with (?:her|him)|squeez(?:ed|e) (?:her|his) (?:hand|shoulder)|put (?:his|her|own )?(?:arm|coat|jacket) around|drew (?:her|him) close|wip(?:ed|e) (?:away )?(?:the |her|his )?tears|held (?:her|him) (?:for|without))\b/i;

/* 职业豁免：医生/心理咨询师/社工的共情是工作动作 */
const PROFESSIONAL_ZH = /(?:医生|护士|心理(?:医生|咨询师|治疗师)|咨询师|社工|主治|张大夫|李大夫|王大夫|刘大夫|陈大夫)/;
const PROFESSIONAL_EN = /\b(?:doctor|dr\.?\s+nurse|therapist|counselor|counsellor|psychiatrist|psychologist|social worker|psychiatrist)\b/i;

interface SceneBlock {
  index: number;
  header: string;
  /** 正文第一行在全文的 0 基行号 */
  bodyStart: number;
  lines: string[];
}

/**
 * 纯函数：检测倾听方的廉价心理咨询师式共情。
 */
export function cheapEmpathy(draft: string): CheapEmpathyResult {
  const text = draft ?? '';
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);

  const scenes: SceneBlock[] = [];
  let cur: SceneBlock = { index: 0, header: '', bodyStart: 0, lines: [] };
  rawLines.forEach((raw, idx) => {
    if (isSceneHeaderLine(raw.trim())) {
      if (cur.lines.length > 0 || cur.header) scenes.push(cur);
      cur = { index: scenes.length, header: raw.trim(), bodyStart: idx + 1, lines: [] };
    } else {
      cur.lines.push(raw);
    }
  });
  scenes.push(cur);

  const empathyRes = zh ? EMPATHY_ZH : EMPATHY_EN;
  const selfRe = zh ? SELF_DISCLOSURE_ZH : SELF_DISCLOSURE_EN;
  const actionRe = zh ? ACTION_COMFORT_ZH : ACTION_COMFORT_EN;
  const profRe = zh ? PROFESSIONAL_ZH : PROFESSIONAL_EN;
  const cueRe = zh ? CUE_ZH : CUE_EN;

  const hits: CheapEmpathyHit[] = [];
  let hitCount = 0;

  for (const scene of scenes) {
    scene.lines.forEach((raw, localIdx) => {
      const line = raw.trim();
      if (!line) return;
      const cue = cueRe.exec(line);
      if (!cue) return;
      const speaker = cue[1] ?? '';
      const speech = cue[2] ?? '';
      if (!speech) return;

      const sentences = zh
        ? speech.split(/[。！？!?…，,；;]+/).map((s) => s.trim()).filter(Boolean)
        : speech.split(/[.!?…,;]+/).map((s) => s.trim()).filter(Boolean);

      for (const sent of sentences) {
        const re = empathyRes.find((r) => r.test(sent));
        if (!re) continue;
        const matched = sent.match(re);
        hitCount += 1;

        const lo = Math.max(0, localIdx - 3);
        const hi = Math.min(scene.lines.length - 1, localIdx + 3);
        /* 救援文本只收：同一说话人的台词（自我暴露）与叙述行（行动安抚）；
           伤者本人的袒露（"我妈走那年我才八岁"）不算安慰者的救援。 */
        const rescueBits: string[] = [];
        for (let j = lo; j <= hi; j += 1) {
          const w = scene.lines[j].trim();
          if (!w) continue;
          const wCue = cueRe.exec(w);
          if (!wCue || wCue[1] === speaker) {
            rescueBits.push(wCue ? (wCue[2] ?? '') : w);
          }
        }
        const rescueText = rescueBits.join('\n');
        const loPro = Math.max(0, localIdx - 4);
        const hiPro = Math.min(scene.lines.length - 1, localIdx + 4);
        const profWindow = scene.lines.slice(loPro, hiPro + 1).join('\n');

        /* 职业豁免窗口含说话人名（中文稿 cue 常直接写"医生："） */
        const professional = profRe.test(`${speaker}\n${profWindow}`);
        const selfDisclosed = selfRe.test(rescueText);
        const actionComfort = actionRe.test(rescueText);
        const rescued = !professional && (selfDisclosed || actionComfort);

        hits.push({
          line: scene.bodyStart + localIdx + 1,
          sceneIndex: scene.index,
          sceneHeader: scene.header,
          speaker,
          snippet: zh ? sent.slice(0, 30) : sent.slice(0, 60),
          marker: (matched?.[0] ?? '').slice(0, 24),
          rescued,
          professional,
          reason: professional
            ? (zh ? '职业身份的共情是工作动作，豁免' : 'professional empathy in role, exempt')
            : rescued
              ? (zh
                  ? (selfDisclosed ? '用自我暴露陪，不是话术' : '用笨拙行动安抚，不是精准复述情绪')
                  : (selfDisclosed ? 'comfort via self-disclosure, not script' : 'comfort via awkward action, not emotion labeling'))
              : (zh ? '零自我零行动的咨询师式共情话术，说话人沦为情绪按摩椅' : 'zero-cost therapist script with no self and no action; the speaker is an emotional vending machine'),
        });
      }
    });
  }

  const unrescued = hits.filter((h) => !h.rescued && !h.professional);
  const n = unrescued.length;
  const score = n <= 1 ? 100 : Math.max(20, 70 - (n - 2) * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 2) {
    issues.push(zh
      ? `${n} 句回应是"我理解你的感受/你一定很难受/想哭就哭"式咨询师话术——零自我暴露、零笨拙行动，安慰者像情绪按摩椅。`
      : `${n} replies are therapist scripts ("I understand how you feel", "That must have been hard", "It is okay to cry") with no self-disclosure and no awkward action — the comforter is an emotional vending machine.`);
    advice.push(zh
      ? '真实的人不会精准复述对方的情绪：让安慰变笨拙——递纸巾递错成了湿巾、倒的水太烫、陪着坐着半天只憋出一句"我不会说"；或者让安慰者掏自己的旧伤（"我爸走那年，我在殡仪馆睡着的"），用自己的伤口陪，而不是替对方命名情绪。能不说话就不说话，一个具体动作胜过三句共情。'
      : 'Real people do not label each other\'s feelings on cue: make the comfort clumsy — the wrong tissue handed over, water that is too hot, sitting together in silence and only managing "I do not know what to say"; or have the comforter offer a wound of their own ("When my father died, I fell asleep at the funeral home"). Comfort with your own scar, not a diagnosis. One concrete action beats three empathy lines.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
