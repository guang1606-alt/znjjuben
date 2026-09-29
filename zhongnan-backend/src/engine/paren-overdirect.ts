import { isSceneHeaderLine } from './script-scenes';
/**
 * 括注导演检测（v2.80 块77，创作能力类）
 * ------------------------------------------------------------------
 * 病象：AI 稿不敢把表演交给演员和导演，每句台词都挂一根"情绪条"——
 *   林晚（冷笑）：你走吧。
 *   林晚（挑眉，不屑地勾了勾唇）：就凭你？
 *   林晚：（眼含热泪，声音颤抖）我没事。
 *   LINNA (smirking, coldly): Or what?
 * 问题：
 *  1) 高占比——十句台词八句带指导，正常拍摄本里括注是例外（全片个位数），
 *     演员每场戏每句怎么哭笑全被写死，等于导演和演员失业；
 *  2) 万能复用——同一根情绪条（冷笑/挑眉/勾唇/smirk/raise eyebrow）
 *     贴在所有台词上，人物没有属于自己的身体语言，只剩一张 AI 表情贴纸；
 *  3) 长导演讲——一个括注里塞"眼含热泪+嘴角勾起冷笑+声音颤抖"两三个 cue，
 *     把该拆成动作行的调度压进口语括注，演员没法演、镜头没法拍。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - reaction-cliche：只扫叙述/动作行的面部反应连缀与复用，不看台词挂条；
 *  - hollow-action：管动作行站坐叹气空转，本引擎管 cue 行内的 inline 括注；
 *  - emotion-label-dialogue：管台词直接喊情绪名（"我好难过"），不管括注；
 *  - script-format：管格式合规（V.O./O.S. 技术标记是合法格式，本引擎豁免）。
 *
 * 判定（解析台词 cue 行，三种版式：NAME（…）：/ NAME：（…）/ NAME (…): ，
 *       外加好莱坞独立行 (paren) 归属最近 cue）：
 *  - ratio（全文 1 条）：cue ≥ 6 且带表演指导的占比 ≥ 60% → −25；
 *  - repeat（每个标签 1 条，cap 3）：同一情绪/表情标签在括注里复用 ≥3 次 → −15；
 *  - long（每处 1 条，cap 3）：括注 ≥14 个中文字符（英文 ≥24）且含 ≥2 个
 *    表演 cue（微表情+语气+声线堆叠）→ −10；封底 20。
 * 豁免：V.O./O.S./O.C./CONT'D/画外音/心声/内心/电话另一端/OS 等纯技术括注，
 *       不计分子也不算违规（它们是拍摄格式，不是表演指导）。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ParenOverdirectHit {
  line: number;
  kind: 'ratio' | 'repeat' | 'long';
  /** repeat=归一化情绪标签；long/ratio 可空 */
  token?: string;
  /** 命中的括注原文（ratio 可空） */
  paren?: string;
  /** 仅 ratio 命中携带 */
  ratio?: number;
  cueCount?: number;
  directedCount?: number;
  reason: string;
}

export interface ParenOverdirectResult {
  score: number;
  cueCount: number;
  directedCount: number;
  hits: ParenOverdirectHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

/* 场景头（"场1：日"会被 cue 正则误吞，必须先跳过） */

/* cue 行：角色（括注）：台词 */
const CUE_ZH = /^([一-鿿A-Za-z0-9·]{1,8})(?:（([^）]{1,80})）)?\s*[：:]\s*(.*)$/;
const CUE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\(([^()]{1,80})\))?\s*:\s*(.*)$/;
/* 好莱坞三行式裸 cue：LINNA / VICTOR PRICE（排除 INT./EXT. 场景头与 CUT/FADE 转场） */
const CUE_BARE_EN = /^[A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.]$/;
const CUE_BARE_BLOCK_EN = /^(?:INT\.|EXT\.|SCENE|CUT|FADE|DISSOLVE|SMASH|INTERCUT|TRANSITION|TITLE|CLOSE ON|INSERT|MONTAGE)/;
/* 独立成段括注：(coldly)（好莱坞 NAME / (paren) / dialogue 三行式） */
const SOLO_PAREN_ZH = /^（([^）]{1,80})）$/;
const SOLO_PAREN_EN = /^\(([^()]{1,80})\)$/;
/* 台词行首内嵌括注：林晚：（冷笑）你走 */
const LEAD_PAREN_ZH = /^（([^）]{1,80})）\s*(.+)$/;
const LEAD_PAREN_EN = /^\(([^()]{1,80})\)\s*(.+)$/;

/* 技术括注：拍摄格式，不是表演指导 */
const TECH_ZH = /^(?:\s*(?:画外音|心声|内心(?:独白)?|电话(?:另一端|那头|里)?|手机那头|os|v\.?o\.?|o\.?s\.?)\s*[,，、 ]*)+$/i;
const TECH_EN = /^(?:\s*(?:v\.?o\.?|o\.?s\.?|o\.?c\.?|off[\s-]?screen|off mike|cont(?:'?d)?|continuing|filtered|on (?:the )?phone|phone voice|speaker(?: ?phone)?)\s*[,，、 ]*)+$/i;

/* 表演 cue 归一化（标签 → 命中正则） */
const CUE_TOKENS_ZH: Array<[string, RegExp]> = [
  ['冷笑', /冷笑|嗤笑|讥笑|嘲笑|嘲讽/],
  ['不屑', /不屑|轻蔑|鄙夷/],
  ['挑眉', /挑眉|眉梢一挑|挑起眉/],
  ['勾唇', /勾唇|勾起.{0,4}唇|唇角.{0,2}勾/],
  ['皱眉', /皱眉|蹙眉|眉头[一皱紧]/],
  ['白眼', /白眼/],
  ['含泪', /含泪|眼含|热泪|泪光|眼眶.{0,2}红/],
  ['哽咽', /哽咽|喉头.{0,2}(?:哽|紧)|抽泣/],
  ['颤抖', /颤抖|发抖|哆嗦|声音发颤/],
  ['淡淡', /淡淡|淡然|平静|面无表情|毫无波澜/],
  ['温柔', /温柔|柔声|软声/],
  ['冷漠', /冷漠|冷淡|冰冷|冷声/],
  ['微笑', /微笑|浅笑|轻笑/],
  ['叹息', /叹气|叹息|叹了口气/],
  ['愤怒', /愤怒|怒吼|厉声|生气|大怒/],
  ['严肃', /严肃|郑重|沉脸|脸色一沉/],
  ['意味深长', /意味深长|若有所思/],
  ['低声', /低声|小声|压低声音|轻声|耳语/],
  ['大声', /大喊|大叫|吼道|高声|嘶吼/],
];

const CUE_TOKENS_EN: Array<[string, RegExp]> = [
  ['coldly', /cold(?:ly)?|ice in (?:his|her) voice/i],
  ['smirk', /smirk(?:ing|s|ed)?/i],
  ['sneer', /sneer(?:ing|s|ed)?/i],
  ['smile', /smil(?:ing|e|ed)|grin(?:ning|ned)?/i],
  ['frown', /frown(?:ing|s|ed)?/i],
  ['eyebrow', /(?:raises?|raising|lifts?|lifting|arches?|arching) (?:a |her |his |an )?eyebrow|eyebrow (?:raised|lifted|arched)/i],
  ['tearful', /tear(?:ful|fully|y)?|voice cracks|with tears/i],
  ['trembling', /trembl(?:ing|e|ed)|shaking (?:voice|hands)|voice shakes/i],
  ['angrily', /angril?y|furious(?:ly)?/i],
  ['softly', /soft(?:ly)?|gent(?:ly|le)/i],
  ['sarcastic', /sarcast(?:ic|ically)|dry(?:ly)?|flat(?:ly)?/i],
  ['dismissive', /dismissive(?:ly)?|scoff(?:s|ing|ed)?/i],
  ['sigh', /sigh(?:s|ing|ed)?/i],
  ['whisper', /whisper(?:s|ing|ed)?|under (?:his|her) breath/i],
  ['shout', /shout(?:s|ing|ed)?|yell(?:s|ing|ed)?|raised voice|raising (?:his|her) voice/i],
  ['calmly', /calm(?:ly)?|emotionless|deadpan|stone-?faced/i],
  ['sternly', /stern(?:ly)?|serious(?:ly)?|solemn(?:ly)?/i],
  ['meaningful', /meaning(?:ful|fully)|pensive(?:ly)?/i],
];

interface DirectedParen {
  line: number;
  raw: string;
  tokens: string[];
}

/**
 * 假选择式纯函数：输入剧本文本，输出括注导演评分与命中证据。
 */
export function parenOverdirect(draft: string): ParenOverdirectResult {
  const text = draft ?? '';
  const zh = isZhText(text);
  const lines = text.split(/\r?\n/);

  const techRe = zh ? TECH_ZH : TECH_EN;
  const cueRe = zh ? CUE_ZH : CUE_EN;
  const soloRe = zh ? SOLO_PAREN_ZH : SOLO_PAREN_EN;
  const leadRe = zh ? LEAD_PAREN_ZH : LEAD_PAREN_EN;
  const tokenTable = zh ? CUE_TOKENS_ZH : CUE_TOKENS_EN;

  const cueLines: number[] = [];
  const directed: DirectedParen[] = [];

  const extractTokens = (raw: string): string[] => {
    const found: string[] = [];
    for (const [label, re] of tokenTable) {
      if (re.test(raw)) found.push(label);
    }
    return found;
  };

  let lastCueLine = -10;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (isSceneHeaderLine(line)) continue;

    /* 1) cue 行：NAME（…）：dialogue / NAME (…): dialogue */
    const cue = cueRe.exec(line);
    if (cue) {
      cueLines.push(i + 1);
      lastCueLine = i + 1;
      let paren = cue[2] ?? '';
      const rest = cue[3] ?? '';
      /* 2) 台词行首内嵌括注：NAME：（…）dialogue */
      if (!paren) {
        const lead = leadRe.exec(rest);
        if (lead) paren = lead[1];
      }
      if (paren && !techRe.test(paren)) {
        const tokens = extractTokens(paren);
        directed.push({ line: i + 1, raw: paren, tokens });
      }
      continue;
    }

    /* 3) 独立行括注（好莱坞三行式），归属 2 行内最近 cue */
    const solo = soloRe.exec(line);
    if (solo && i + 1 - lastCueLine <= 2) {
      const paren = solo[1];
      if (!techRe.test(paren)) {
        const tokens = extractTokens(paren);
        directed.push({ line: i + 1, raw: paren, tokens });
      }
      continue;
    }

    /* 4) 英文裸 cue 行（NAME 独占一行，下一行是括注或台词） */
    if (!zh && CUE_BARE_EN.test(line) && !CUE_BARE_BLOCK_EN.test(line)) {
      const next1 = (lines[i + 1] ?? '').trim();
      const next2 = (lines[i + 2] ?? '').trim();
      if (next1 && !/^(?:INT\.|EXT\.|SCENE)/i.test(next1)) {
        cueLines.push(i + 1);
        lastCueLine = i + 1;
        /* 下一行直接是 (paren) 时由上面的 solo 分支在其自身行归属；这里无需吞行 */
        void next2;
      }
    }
  }

  const cueCount = cueLines.length;
  const directedCount = directed.length;
  const hits: ParenOverdirectHit[] = [];
  const issues: string[] = [];

  /* A. 高占比：cue ≥ 6 且带表演指导 ≥ 60% */
  const ratio = cueCount > 0 ? directedCount / cueCount : 0;
  if (cueCount >= 6 && ratio >= 0.6) {
    hits.push({
      line: cueLines[cueLines.length - 1],
      kind: 'ratio',
      paren: undefined,
      ratio: Math.round(ratio * 100) / 100,
      cueCount,
      directedCount,
      reason: zh
        ? `${cueCount} 句台词中 ${directedCount} 句挂了表演指导括注（${Math.round(ratio * 100)}%），括注应是例外不是标配`
        : `${directedCount} of ${cueCount} dialogue cues carry a directing parenthetical (${Math.round(ratio * 100)}%); wrylies must be the exception, not the default`,
    });
  }

  /* B. 万能复用：同一情绪标签 ≥3 次 */
  const tokenLines = new Map<string, number[]>();
  for (const d of directed) {
    for (const t of d.tokens) {
      const arr = tokenLines.get(t) ?? [];
      arr.push(d.line);
      tokenLines.set(t, arr);
    }
  }
  let repeatReported = 0;
  for (const [token, ls] of tokenLines) {
    if (repeatReported >= 3) break;
    if (ls.length >= 3) {
      const first = directed.find((d) => d.line === ls[ls.length - 1]);
      hits.push({
        line: ls[ls.length - 1],
        kind: 'repeat',
        token,
        paren: first?.raw,
        reason: zh
          ? `「${token}」在台词括注里贴了 ${ls.length} 次（第${ls.slice(0, 5).join('、')}行），人物被同一根情绪条统一了`
          : `"${token}" directing tag reused ${ls.length} times across cues (L${ls.slice(0, 5).join(', ')}); the character has been reduced to one sticker`,
      });
      repeatReported += 1;
    }
  }

  /* C. 长导演讲：多 cue 堆叠进一个括注 */
  const longLimit = zh ? 14 : 24;
  let longReported = 0;
  for (const d of directed) {
    if (longReported >= 3) break;
    if (d.tokens.length >= 2 && d.raw.replace(/[\s,，、。.；;]/g, '').length >= longLimit) {
      hits.push({
        line: d.line,
        kind: 'long',
        paren: d.raw,
        reason: zh
          ? `一个括注塞了 ${d.tokens.length} 个表演 cue（${d.tokens.join('+')}），把动作行的调度压进口语括注，演员没法演`
          : `One parenthetical stacks ${d.tokens.length} acting cues (${d.tokens.join(' + ')}); split it into an action beat, no one can play all of it at once`,
      });
      longReported += 1;
    }
  }

  /* 计分：ratio −25；repeat 每条 −15（cap3）；long 每条 −10（cap3）；封底 20 */
  let penalty = 0;
  for (const h of hits) {
    if (h.kind === 'ratio') penalty += 25;
    else if (h.kind === 'repeat') penalty += 15;
    else penalty += 10;
  }
  const score = Math.max(20, 100 - penalty);

  if (hits.some((h) => h.kind === 'ratio')) {
    issues.push(zh
      ? `台词指导括注占比 ${Math.round(ratio * 100)}%——十句里八句都在教演员怎么演。把情绪写进他说的话和做的事，只在"台词与表面情绪相反"时用一次括注（笑着说狠话）。`
      : `${Math.round(ratio * 100)}% of cues carry acting directions. Put emotion into what the character says and does; use a parenthetical only when delivery contradicts the line (smiling while threatening).`);
  }
  if (hits.some((h) => h.kind === 'repeat')) {
    issues.push(zh
      ? '同一根情绪条（冷笑/挑眉/勾唇）贴满全片——给不同人物不同的身体语言，让反应属于"这个人"。'
      : 'The same tag (smirk / raised eyebrow / coldly) is plastered everywhere — give each character a distinct physical vocabulary.');
  }
  if (hits.some((h) => h.kind === 'long')) {
    issues.push(zh
      ? '长括注把微表情、语气、声线捆在一起——拆成台词前后的动作行，一次只演一个。'
      : 'Stacked multi-cue parentheticals are unplayable — split them into action beats, one cue at a time.');
  }

  const advice: string[] = [];
  if (hits.length > 0) {
    advice.push(zh
      ? '括注三原则：①全片个位数，只留给"台词与表演相反"的节拍；②删掉情绪形容词，把它改写成台词里的用词选择或一个具体动作（不是"冷笑"，是把请帖推回去）；③需要两三个 cue 时，移出括注写成独立动作行。'
      : 'Parenthetical rule of three: (1) only a handful per script, reserved for beats where delivery contradicts the line; (2) cut emotion adjectives — encode them in word choice or a specific action (push the invitation back, do not "smirk coldly"); (3) when two cues are needed, move them out into an action line.');
  }

  return { score, cueCount, directedCount, hits, issues, advice };
}
