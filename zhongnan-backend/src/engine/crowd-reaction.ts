import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 群体反应偷懒检测（Crowd Reaction）
 * -----------------------------------------------------------
 * 创作能力类引擎：镜头只能拍具体的人，拍不了"所有人"。编剧一旦写
 *   众人哗然。
 *   全场都愣住了。
 *   所有人倒吸一口凉气。
 *   台下议论纷纷，大家纷纷点头。
 * 等于把一个本该落到具体面孔上的镜头，用一个集体名词糊弄过去——
 * 没有可拍的脸、没有可拍的动作，导演只能给一群群众演员发盒饭式乱演。
 *
 * 判定：
 *  1) 只扫叙述/动作行（台词中引用"所有人都会震惊的"不算）；
 *  2) 群体主语 + 群体反应在同一行短窗口内共现（zh≤14字 / en≤60字符）；
 *  3) 或群体反应成语独立成句（议论纷纷/鸦雀无声/面面相觑/collective gasp）。
 * 专业豁免（rescue）：命中后 2 行内，镜头落到一个具体个体的具体生理
 *  动作上（"角落里，老管家攥紧了拐杖"/"the secretary knocked over her cup"），
 *  说明编剧知道群体之后要给特写——记 rescued，不扣分。换场清空。
 *
 * 边界：
 *  - payoffTaxonomy 管爽点"众人震惊"7 个固定短语（爽感类型学维度）；
 *    本引擎管所有场景里的结构模式（群体主语+反应），且认 rescue；
 *  - hollow-action 管个体无功能动作，本引擎管"根本没有个体"。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface CrowdHit {
  line: number;
  crowd: string;
  reaction: string;
  snippet: string;
  /** 命中后是否落到了具体个体特写（落到则不扣分） */
  rescued: boolean;
  rescueLine?: number;
  reason: string;
}

export interface CrowdReactionResult {
  score: number;
  narrationLines: number;
  hits: CrowdHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// 群体主语
const CROWD_ZH = /(众人|全场|满场|满座|在场(?:的)?(?:人|众人|宾客|客人|员工|股东|亲戚|家属)?|所有人|大家|围观(?:者|的人|人群|群众|路人)?|人群|宾客们?|客人们?|员工们?|股东们?|亲戚们?|家属们?|学生们?|同学们?|记者们?|台下|席上|席间)/;
const CROWD_EN = /\b(?:everyone|everybody|the whole room|the entire room|all the (?:guests|employees|reporters|students|relatives|shareholders)|the crowd|the onlookers|onlookers|the audience|the room|the guests|the reporters|people around)\b/i;

// 群体反应动词/状态
const REACT_ZH = /(哗然|震惊|惊呆|愣住|一怔|倒吸(?:一口)?(?:凉|冷)气|议论纷纷|窃窃私语|交头接耳|纷纷(?:点头|摇头|鼓掌|附和|后退|躲开|侧目)|哄笑|哄堂大笑|哄然|鸦雀无声|一片寂静|一片死寂|安静下来|静了?下来|寂静无声|沸腾|掌声雷动|起立鼓掌|起身鼓掌|面面相觑|勃然变色|脸色大变|屏住呼吸|大气不敢|不敢(?:出声|说话|吭声)|瞪大了?眼|瞪直了眼|骚动|唏嘘)/;
const REACT_EN = /\b(?:gasped|froze|frozen|went silent|fell silent|went quiet|fell quiet|went dead|nodded(?: in agreement)?|erupted|burst into (?:laughter|applause)|broke into laughter|laughed|applauded|broke into applause|stood up|rose to their feet|stared|looked at each other|exchanged glances|buzzed|murmured|held their breath|dared not (?:speak|breathe)|couldn'?t (?:speak|breathe)|were shocked|was shocked|stunned|staggered back|stepped back)\b/i;

// 群体反应成语：无需群体主语，本身即隐含一群人
const IDIOM_ZH = /(议论纷纷|窃窃私语|交头接耳|鸦雀无声|哄堂大笑|掌声雷动|面面相觑|一片哗然|一片死寂|一片寂静|倒吸(?:一口)?(?:凉|冷)气|全场(?:寂静|安静|死寂))/;
const IDIOM_EN = /\b(?:a collective gasp|collective intake of breath|the room went dead|dead silence filled|erupted in applause|thunderous applause|gasps rippled)\b/i;

// rescue：具体个体 + 具体生理动作（镜头给得出特写）
const RESCUE_ZH = /(?:角落|门边|门口|窗畔?|后排|前排|席末|桌首|主位|靠墙|站在|坐在|身旁|身后|对面|人群里|人堆里)[^。！？\n]{0,18}?[，、][^。！？\n]{0,14}(?:攥|握|捏|抓紧|收紧|后退|缩|颤|抖|红了眼|眼眶|咽|别过脸|低下头|皱眉|指节|僵|屏住|捏皱|攥皱|撞翻|碰倒)|(?:管家|秘书|助理|司机|保姆|保镖|侍应|服务生?员|股东|董事|亲戚|客人|学生|记者|老人|老头|男人|女人|孩子|小伙|姑娘|贵妇)[^。！？\n]{0,10}(?:攥|握|捏|抓紧|后退|缩了|颤抖|抖了|红了眼|眼眶一|咽了|别过脸|低下头|皱起眉|僵住|屏住|捏皱|撞翻|碰倒|猛地站|起身|站了起来)/;
const RESCUE_EN = /\b(?:in the (?:back|front|corner)|by the door|at the (?:table|bar|podium)|against the wall|the (?:old butler|butler|secretary|assistant|driver|bodyguard|waiter|reporter|old man|young woman|boy|girl|shareholder|guest))[^.\n]{0,70}?\b(?:tightened (?:his|her|their)?\s?grip|gripped|clenched|stepped back|shrank|trembled|swallowed|looked away|lowered (?:his|her) (?:eyes|head)|frowned|froze|held (?:his|her) breath|knocked over|stood up|rose)\b/i;

const snippet = (s: string, n = 28): string => (s.length > n ? `${s.slice(0, n)}…` : s);

interface RawHit {
  line: number;
  crowd: string;
  reaction: string;
}

export function crowdReaction(draft: string): CrowdReactionResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const crowdRe = isZh ? CROWD_ZH : CROWD_EN;
  const reactRe = isZh ? REACT_ZH : REACT_EN;
  const idiomRe = isZh ? IDIOM_ZH : IDIOM_EN;
  const rescueRe = isZh ? RESCUE_ZH : RESCUE_EN;

  const lines = draft.split(/\r?\n/);
  // 先记录同场内每个候选行及其后 2 行窗口，便于 rescue 判定
  const rawHits: RawHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) return;
    if (DIALOGUE_RE.test(line)) return; // 台词中说"所有人都会震惊"不算
    narrationLines++;

    // ① 群体主语 + 群体反应 近距离共现
    const cm = line.match(crowdRe);
    const rm = line.match(reactRe);
    if (cm && rm) {
      const gap = Math.abs((rm.index ?? 0) - (cm.index ?? 0));
      if (gap <= (isZh ? 14 : 60)) {
        rawHits.push({ line: i + 1, crowd: cm[0], reaction: rm[0] });
        return;
      }
    }
    // ② 群体反应成语独立成句
    const im = line.match(idiomRe);
    if (im) rawHits.push({ line: i + 1, crowd: isZh ? '群体' : 'crowd', reaction: im[0] });
  });

  // rescue：命中后 2 行内（不跨场景、不认台词）落到具体个体特写
  const hits: CrowdHit[] = rawHits.map((h) => {
    const startIdx = h.line; // 命中行的下一行为 lines[h.line]
    let rescued = false;
    let rescueLine: number | undefined;
    for (let k = startIdx; k <= startIdx + 1 && k < lines.length; k++) {
      const near = lines[k].trim();
      if (!near) continue;
      if (isSceneHeaderLine(near)) break;
      if (DIALOGUE_RE.test(near)) continue;
      if (rescueRe.test(near)) { rescued = true; rescueLine = k + 1; break; }
    }
    const lineText = (lines[h.line - 1] || '').trim();
    return {
      line: h.line,
      crowd: h.crowd,
      reaction: h.reaction,
      snippet: snippet(lineText),
      rescued,
      ...(rescueLine ? { rescueLine } : {}),
      reason: isZh
        ? '用集体名词代替具体镜头：没有一张可拍的脸、没有一个可拍的动作，群体反应等于没写'
        : 'a collective noun stands in for a shootable face — no specific person, no specific action; the crowd reaction films as nothing',
    };
  });

  const badHits = hits.filter((h) => !h.rescued);
  const score = Math.max(25, 100 - badHits.length * 12);

  const issues = badHits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」用"${h.crowd}${h.reaction}"糊掉了群体镜头——挑出在场最该有反应的那一个人（仇家/心腹/路人），给他一个具体生理动作：攥皱请帖、后退撞翻椅子、咽下半句话`
      : `L${h.line} "${h.snippet}" blurs the crowd into "${h.crowd} ${h.reaction}" — single out the one person who should react most (the rival, the insider, a stranger) and give one concrete physical beat: crushing the invitation, stepping back into a chair, swallowing a sentence`);

  const advice = isZh
    ? badHits.length > 0
      ? '镜头拍不了"所有人"，只能拍一个具体的人。群体反应的写法是：一句群体趋势之后，立刻落到一个有名有姓（或有身份）的人的特写反应上，让观众通过一张脸听见整间屋子。'
      : '群体反应都落到了具体面孔与动作上，保持。'
    : badHits.length > 0
      ? 'The camera cannot photograph "everyone", only a specific person. After one line of crowd tendency, cut to a named (or clearly typed) face on a concrete physical reaction — let the audience hear the whole room through one person.'
      : 'Crowd reactions land on specific faces and actions; keep it.';

  return { score, narrationLines, hits, issues, advice };
}

/**
 * 前置教学：buildCrowdReactionDirective(_format='LIVE', lang='zh')
 * ------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 crowdReaction 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"群体主语 + 群体反应糊镜头、rescue 挽救"的检测口径，
 *       避免写完被 prePolish crowdHint 与 craft/deai 复评打回。
 */
export function buildCrowdReactionDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Crowd-Reaction Laziness Pre-Writing Briefing (same source as crowdReaction: a collective noun replaces a shootable face; 12 points per un-rescued hit; floor 25)】',
      '- Scope: narration and action lines only; scene headers and "speaker: line" dialogue lines are skipped, and the rest count as narration lines for diagnostics.',
      '- Rule one: a crowd subject and a crowd reaction on the same line with their starting positions within 14 characters in Chinese or 60 characters in English count as one hit.',
      '- Crowd subjects: everyone / everybody / the whole room / the entire room / all the guests / all the employees / all the reporters / the crowd / the onlookers / the audience / the room / people around.',
      '- Crowd reactions: gasped / froze / went silent / fell quiet / went dead / nodded in agreement / erupted / burst into laughter / applauded / stood up / rose to their feet / stared / exchanged glances / buzzed / murmured / held their breath / stepped back.',
      '- Rule two: a crowd idiom standing alone also counts, because it already implies a group — a collective gasp / dead silence filled the room / thunderous applause / gasps rippled.',
      '- Rescue exemption: a hit is rescued when, within the next 2 lines and without crossing a scene header or a dialogue line, the camera lands on one specific person with one concrete physical beat; a rescued hit is never charged.',
      '- Rescue beats: tightened his grip / clenched / gripped / stepped back / shrank / trembled / swallowed / looked away / lowered her head / frowned / froze / held her breath / knocked over / stood up, on a butler, secretary, assistant, driver, bodyguard, waiter, reporter, shareholder, guest, old man or child.',
      '- Hit fields: line, crowd, reaction, snippet (first 28 characters), rescued and rescueLine, plus reason, are returned so the polisher can locate the blur.',
      '- Score: max(25, 100 - un-rescued hits x 12); empty draft = 100; rescued hits stay in the hit list for diagnostics only.',
      '- Rewrite: single out the one person in the room who should react most (the rival, the insider, a stranger) and give one concrete physical beat — crushing the invitation, stepping back into a chair, swallowing a sentence.',
      '- Division: payoff-taxonomy recognises only 7 fixed thrill phrases of "the crowd is shocked"; this engine scans the crowd-subject plus reaction pattern in every scene and honours rescue.',
      '- Division: hollow-action judges an individual doing a functionless action; this engine judges the case where there is no individual at all, only a group.',
      '- Pipeline consumption: prePolish injects un-rescued hits into the polisher as crowdHint; craft initial, craft re-eval and deai rescan consume the same result.',
      '- Score weight: the crowdReaction score enters the format dimension with a 0.05 weight (craft.avg 0.40 + showDontTell 0.20 + sceneDensity 0.15 + sceneHeader 0.20 + crowd 0.05).',
      '- Diagnostics: narrationLines is display-only and never charged.',
      '- Self-check: whose face can the director shoot in this beat? If there is no face, delete the crowd reaction and give one person one action.',
    ].join('\n');
  }
  return [
    '【群体反应偷懒·前置教学（检测同源：crowdReaction 用集体名词代替具体镜头，每条未挽救命中扣 12 分，25 分封底）】',
    '- 检测范围：只扫叙述/动作行；场头与「说话人：台词」行跳过，其余行计入 narrationLines（仅诊断）。',
    '- 口径一·群体主语 + 群体反应同行共现：两者起点相距 ≤14 字（英文 ≤60 字符）即记一条。',
    '- 群体主语词表：众人/全场/满场/满座/在场的人/所有人/大家/围观者/人群/宾客们/客人们/员工们/股东们/亲戚们/家属们/学生们/同学们/记者们/台下/席上/席间。',
    '- 群体反应词表：哗然/震惊/惊呆/愣住/倒吸一口凉气/议论纷纷/窃窃私语/交头接耳/纷纷点头/哄堂大笑/鸦雀无声/一片死寂/沸腾/掌声雷动/面面相觑/屏住呼吸/骚动/唏嘘。',
    '- 口径二·成语独立成句：无需群体主语，议论纷纷/窃窃私语/交头接耳/鸦雀无声/哄堂大笑/掌声雷动/面面相觑/一片哗然 本身即隐含一群人，也记一条。',
    '- rescue 豁免：命中后 2 行内（不跨场、不认台词）落到具体个体 + 具体生理动作 → 记 rescued，不扣分。',
    '- rescue 动作词表：攥/握/捏/抓紧/后退/颤/抖/红了眼/咽/别过脸/低下头/皱眉/指节发白/屏住/捏皱/撞翻；个体可为管家/秘书/助理/司机/保镖/侍应/股东/亲戚/客人/学生/记者/老人/孩子。',
    '- 命中字段：line（行号）、crowd（群体主语）、reaction（反应词）、snippet（前 28 字）、rescued / rescueLine、reason 随命中返回，供润色师定位。',
    '- 得分：score = max(25, 100 - 未挽救命中数 × 12)；空稿 100；rescued 的命中留在 hits 里只做诊断。',
    '- 改写方向：挑出在场最该有反应的那一个人（仇家/心腹/路人），给他一个具体生理动作——攥皱请帖、后退撞翻椅子、咽下半句话。',
    '- 与 payoff-taxonomy 分界：它只认爽点「众人震惊」7 个固定短语（爽感类型学维度）；本引擎扫所有场景的群体主语 + 反应结构，且认 rescue。',
    '- 与 hollow-action 分界：它管个体做了无功能动作；本引擎管「根本没有个体」，只有一群人。',
    '- pipeline 消费：prePolish 把未挽救命中注入润色师（crowdHint）；craft 初评、craft 复评、deai 复扫同一结果。',
    '- 评分权重：crowdReaction.score 以 0.05 权重计入 format 维度（craft.avg 0.40 + showDontTell 0.20 + sceneDensity 0.15 + sceneHeader 0.20 + crowd 0.05）。',
    '- 成稿自查：这个镜头导演能拍谁的脸？拍不出来就删掉群体反应，给一个人一个动作。',
  ].join('\n');
}
