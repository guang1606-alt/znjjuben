import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 情绪道具拐杖检测（Emotion-Prop Crutch）
 * ============================================================
 * 治什么病：
 *   写不出人物的选择，就派固定道具替情绪充值——
 *   愤怒必摔杯砸瓶，痛苦必灌醉自己/走进暴雨，决裂必撕照片/
 *   扔戒指扔钥匙，压抑必捏碎杯子/指甲掐进掌心。
 *   道具动作本身可演（第一次出现是好的外化），病在：
 *    1) 全片万能复用——每种情绪都走同一个道具，第三次观众
 *       就知道：她要摔东西了。道具从"人的延伸"退化成快捷键；
 *    2) 动作不改变局势——杯子碎完、酒醒之后，什么都没发生，
 *       情绪被发泄掉，戏却原地踏步；
 *    3) 多族连用冒充浓烈——同一句里又摔又灌又淋雨，宣泄堆叠
 *       冒充层次，依然零决定。
 *
 * 判定（只扫叙述行；台词行/场景头跳过）：
 *   五族道具套路：smash 摔砸 / drink 买醉抽烟 / rain 淋雨自虐 /
 *   tear 撕毁扔弃信物 / grip 捏碎掐掌。
 *   A. repeat：同一族全片第 1、2 次不罚（正当外化），第 3 次起
 *      charged 计入扣分；
 *   B. chain：同一行连用 ≥2 个不同族，单次即 charged（宣泄堆叠）。
 *   rescued（道具动作升级成局势改变，不扣分）：本句或后 2 个非空
 *   行内、换场前出现具体决定/后果（宣布取消、报警、叫律师、
 *   签字、甩出证据/录音/U盘、把戒指扔还、当场滚蛋/再没回头）。
 *
 * 边界（查重后确认）：
 *   - reaction-cliche 管面部反应零件（愣/皱眉/咬唇/瞳孔一缩），
 *     本引擎管人手里的道具；
 *   - hollow-action 明确把"摔/砸/夺"当强能量词豁免，本引擎不判
 *     单次摔砸，只管同族复用 ≥3 次与多族堆叠，且要求无后果；
 *   - pathetic-fallacy 管"雨在替人哭"的拟人，本引擎管"人走进
 *     雨里"的自虐套路，客观下雨不判；
 *   - 撕合同/扔戒指若当场推动谈判（带后果），rescued。
 *
 * 计分：bad=0 → 100；1 → 75；≥2 → max(25, 100-n*25)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^[一-鿿A-Za-z0-9·]{1,4}(?:（[^）]{0,12}）)?\s*[：:]\s*\S/;
const QUOTE_RE = /^[「“"']/;

// 五族道具情绪套路（具体组合，避免孤立字误判）
const FAM_ZH: { family: CrutchFamily; re: RegExp }[] = [
  { family: 'smash', re: /(?:(?:摔|砸|掼|挥|扫|拂)[^\n。！？]{0,8}?(?:杯|碗|瓶|花瓶|手机|烟灰缸|盘子|镜子|桌上(?:的)?(?:东西|一切)|茶几)|(?:杯|瓶|碗|花瓶|手机)[^\n。！？]{0,4}?(?:摔|砸|碎)(?:在|到|向)?|拍(?:碎|裂)(?:了)?(?:桌上)?(?:杯|瓶)?)/ },
  { family: 'drink', re: /(?:(?:仰[头脖]|猛[地]?)[^\n。！？]{0,4}?(?:灌|喝|干)[^\n。！？]{0,4}?(?:酒|杯|瓶|威士忌|白酒|红酒)|一杯(?:接|紧接)着一杯|借酒(?:浇愁|消愁)|买醉|喝(?:得|到)(?:酩酊|烂醉|大醉)|酒(?:一瓶|一杯)(?:接|又)一(?:瓶|杯)|醉倒|(?:猛|狠)?抽(?:烟)?，?一根接(?:着)?一根|一根接(?:着)?一根(?:地)?抽|烟蒂(?:堆|摁)满)/ },
  { family: 'rain', re: /(?:冲[进出入]?[^\n。！？]{0,4}?暴雨?(?:里|中)?|(?:走|跑|跪|站|冲)进(?:了)?雨(?:里|中|幕)?|任(?:凭)?(?:暴雨?|雨水?|大雨)[^\n。！？]{0,6}?(?:淋|浇|打)(?:在|湿|透)?|淋(?:成|得)(?:了)?(?:落汤鸡|透|湿透|浑身湿透)|(?:全|浑)身(?:都)?(?:被)?淋(?:湿|透)|没(?:有)?打伞[^\n。！？]{0,6}?(?:走|站|冲|进))/ },
  { family: 'tear', re: /(?:(?:撕|扯)[^\n。！？]{0,4}?(?:碎|烂|成两半)?[^\n。！？]{0,4}?(?:照片|相片|信|信件|情书|合同|协议|离婚书|支票|请柬)|(?:照片|相片|信|合同|协议|支票|请柬)[^\n。！？]{0,4}?(?:撕|扯)(?:碎|烂|了)?|(?:摘|褪|撸|拔)[^\n。！？]{0,3}?(?:下|掉)?戒指[^\n。！？]{0,6}?(?:扔|摔|掼|砸|拍|放|递|还)|(?:扔|摔|掼|甩出)(?:了)?(?:那(?:枚|个|只))?戒指|(?:扔|摔|拍|甩)(?:下|出)?(?:了)?钥匙)/ },
  { family: 'grip', re: /(?:(?:攥|捏|揉|抓)[^\n。！？]{0,3}?(?:皱|紧|瘪|碎|烂|变形|成团)[^\n。！？]{0,4}?(?:纸|照片|信纸|纸巾|名片|杯子|裙摆|被角|衣角)?|指(?:甲|尖)[^\n。！？]{0,4}?(?:掐|陷|嵌|抠)进[^\n。！？]{0,4}?(?:掌心|手心|肉里)|(?:手|指节|骨节)[^\n。！？]{0,4}?(?:攥|捏|握)得(?:发|泛)?白|咬(?:紧|碎)(?:了)?(?:银|后)?牙(?:关|齿)?|拳头[^\n。！？]{0,4}?(?:攥|握|捏)得(?:指节)?(?:发|泛)?白)/ },
];

const FAM_EN: { family: CrutchFamily; re: RegExp }[] = [
  { family: 'smash', re: /\b(?:smashed|hurled|swept|flipped|slammed|shattered)\s+(?:the|his|her|a)?\s*(?:cup|glass|glasses|vase|bottle|plate|phone|ashtray|everything on the table|table)\b|\b(?:cup|vase|glass|bottle|phone)\s+(?:smashed|shattered)\s+(?:against|on|to)\b/i },
  { family: 'drink', re: /\b(?:downed|drained|chugged|gulped)\s+(?:the|his|her|another|a)\s+(?:glass|bottle|shot|wine|whiskey|whisky|vodka)\b|\bone\s+drink\s+after\s+another\b|\bbottle\s+after\s+bottle\b|\bdrank\s+(?:himself|herself)\s+into\s+oblivion\b|\bdrowned\s+(?:his|her)\s+sorrows\b|\bpoured\s+(?:himself|herself)\s+another\b|\b(?:lit\s+another|chain[-\s]?smoked|one\s+cigarette\s+after\s+another)\b/i },
  { family: 'rain', re: /\b(?:walked|ran|rushed|stepped|went|knelt|stood)\s+(?:out\s+)?into\s+the\s+(?:pouring\s+|driving\s+|heavy\s+)?rain\b|\bstood\s+in\s+the\s+(?:pouring|driving)\s+rain\b|\b(?:rain|rainwater)\s+(?:soaked|drenched)\s+(?:him|her)\b|\bsoaked\s+to\s+the\s+bone\b|\bdidn'?t\s+open\s+(?:his|her)\s+umbrella\b/i },
  { family: 'tear', re: /\btore\s+up\s+(?:the|his|her)\s+(?:photo|photograph|letter|contract|papers|check|invitation)\b|\bripped\s+(?:the|his|her)\s+(?:photo|letter|contract)\b|\b(?:slid|ripped|pulled)\s+(?:the|his|her)\s+ring\s+off\b|\bflung\s+(?:the|his|her)\s+ring\b|\bthrew\s+(?:the|his|her)\s+(?:ring|keys)\s+down\b|\bhurled\s+(?:the|his|her)\s+keys\b/i },
  { family: 'grip', re: /\bcrumpled\s+(?:the|his|her)\s+(?:paper|photo|photograph|letter|napkin|card)\b|\b(?:knuckles|grip)\s+(?:went|turned)\s+white\b|\bwhite[-\s]?knuckled\b|\bnails\s+dug\s+into\s+(?:his|her)\s+palms\b|\bcrushed\s+the\s+(?:cup|glass)\b|\bclenched\s+(?:his|her)\s+teeth\b|\bfist\s+clenched(?:\s+until\s+knuckles\s+whitened)?\b/i },
];

// 道具动作升级为局势改变（rescue）
const RESCUE_ZH = /(?:当场|立刻|马上|转身)[^\n。！？]{0,12}?(?:宣布|通知|召开|报警|叫律师|签字|退婚|取消婚礼|冻结|收回|开除|净身出户|证据|录音|U盘|录像|甩在|拍在|扔还|摔门而去|夺门而出|再没回头|头也不回)|(?:宣布|通知|召开记者会|报警|叫律师|签字|取消婚礼|冻结账户|甩出|拍在桌上)[^\n。！？]{0,10}?(?:证据|录音|U盘|录像|合同|协议)/;
const RESCUE_EN = /\b(?:called\s+the\s+cops|phoned\s+(?:his|her)\s+lawyer|press\s+conference|signed\s+(?:the|his|her)\s+papers|cancel(?:led|s)?\s+the\s+wedding|froze\s+(?:the|his|her|all)\s+accounts?|fired\s+(?:him|her)\s+on\s+the\s+spot|slammed\s+(?:the|his|her)\s+evidence\b|threw\s+(?:the|his|her)\s+evidence|(?:slapped|slammed)\s+(?:the|his|her)\s+(?:recording|USB|drive|photos?|contract)\s+(?:down|on)|walked\s+out\s+and\s+never\s+looked\s+back|slammed\s+the\s+door\s+(?:on|behind))\b/i;

type CrutchFamily = 'smash' | 'drink' | 'rain' | 'tear' | 'grip';

export interface EmotionCrutchHit {
  line: number;
  kind: 'repeat' | 'chain';
  families: CrutchFamily[];
  phrase: string;
  snippet: string;
  /** charged=true 才计入扣分（前两次单族出现不罚） */
  charged: boolean;
  rescued: boolean;
  rescueLine?: number;
  reason: string;
}

export interface EmotionPropCrutchResult {
  score: number;
  narrationLines: number;
  familyCounts: Record<CrutchFamily, number>;
  hits: EmotionCrutchHit[];
  issues: string[];
  advice: string;
}

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * 检测情绪道具拐杖。
 */
export function emotionPropCrutch(draft: string): EmotionPropCrutchResult {
  const emptyCounts: Record<CrutchFamily, number> = { smash: 0, drink: 0, rain: 0, tear: 0, grip: 0 };
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, familyCounts: emptyCounts, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const lines = draft.split(/\r?\n/);
  const fams = isZh ? FAM_ZH : FAM_EN;
  const hits: EmotionCrutchHit[] = [];
  const seen: Record<CrutchFamily, number> = { smash: 0, drink: 0, rain: 0, tear: 0, grip: 0 };
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line) || SPEAKER_RE.test(line) || QUOTE_RE.test(line)) return;
    narrationLines++;

    // 收集本行命中的族（每族取首个短语）
    const found: { family: CrutchFamily; phrase: string }[] = [];
    for (const { family, re } of fams) {
      const m = line.match(re);
      if (m) found.push({ family, phrase: m[0] });
    }
    if (found.length === 0) return;

    // rescue：本句或后 2 个非空行、换场前出现局势改变
    let rescued = (isZh ? RESCUE_ZH : RESCUE_EN).test(line);
    let rescueLine: number | undefined;
    if (rescued) rescueLine = i + 1;
    if (!rescued) {
      for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
        const near = lines[k].trim();
        if (!near) continue;
        if (isSceneHeaderLine(near)) break;
        if ((isZh ? RESCUE_ZH : RESCUE_EN).test(near)) {
          rescued = true;
          rescueLine = k + 1;
          break;
        }
      }
    }

    if (found.length >= 2) {
      // chain：多族连用，单次即 charged
      for (const f of found) seen[f.family]++;
      hits.push({
        line: i + 1,
        kind: 'chain',
        families: found.map((f) => f.family),
        phrase: found.map((f) => f.phrase).join(' / '),
        snippet: snippet(line),
        charged: true,
        rescued,
        rescueLine,
        reason: isZh
          ? '一行连用多个情绪道具套路，宣泄堆叠冒充浓烈但没有决定'
          : 'Several prop-emotion crutches stacked in one line — discharge without a decision',
      });
    } else {
      const f = found[0];
      seen[f.family]++;
      const charged = seen[f.family] >= 3; // 第 3 次起才罚
      hits.push({
        line: i + 1,
        kind: 'repeat',
        families: [f.family],
        phrase: f.phrase,
        snippet: snippet(line),
        charged,
        rescued,
        rescueLine,
        reason: isZh
          ? '同一种道具动作反复替情绪充值，第三次起就是快捷键'
          : 'The same prop move keeps cashing out emotion — from the third use it is just a hotkey',
      });
    }
  });

  const bad = hits.filter((h) => h.charged && !h.rescued);
  const n = bad.length;
  const score = n === 0 ? 100 : n === 1 ? 75 : Math.max(25, 100 - n * 25);
  const labelZh: Record<CrutchFamily, string> = {
    smash: '摔砸发泄', drink: '买醉抽烟', rain: '淋雨自虐', tear: '撕毁扔信物', grip: '捏碎掐掌',
  };
  const labelEn: Record<CrutchFamily, string> = {
    smash: 'smash-things', drink: 'drinking/smoking', rain: 'walking in rain', tear: 'tearing/throwing tokens', grip: 'grip-crushing',
  };
  const issues = bad.map((h) => (isZh
    ? `第${h.line}行：${h.kind === 'chain' ? '多族连用' : labelZh[h.families[0]]}「${h.snippet}」——${h.reason}；让这个动作改变局势（摔完当场甩出证据/宣布决定），或换成只属于这个人物的反应`
    : `L${h.line}: ${h.kind === 'chain' ? 'stacked crutches' : labelEn[h.families[0]]} "${h.snippet}" — ${h.reason}; make the prop move change the situation (slap down evidence, announce the decision) or give this character a reaction that belongs only to them`));
  const advice = isZh
    ? '道具不是情绪提款机。摔杯、灌酒、淋雨、撕照片、捏杯子全片各最多用两次，且每次必须让局势发生不可逆变化——摔东西就当场甩出证据，摘戒指就摔还并走人，否则把动作换成这个人物独有的选择（弱者的那一步往往是"不做什么"）。观众第三次看到同一个道具动作，情绪就清零了。'
    : 'Props are not emotion ATMs. Smashing glass, drinking, rain-walking, tearing photos and white-knuckle grips get two uses each, and every use must force an irreversible change — smash, then slap down the evidence; remove the ring, hand it back and leave. Otherwise replace the move with a choice only this character would make (for a weak person, the loudest move is often what they do not do). The third identical prop move empties the emotion.';

  return { score, narrationLines, familyCounts: seen, hits, issues, advice };
}
