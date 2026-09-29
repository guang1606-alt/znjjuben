/**
 * 情感关系递进检测器（PRD 2.1.28 短剧情感线过硬线）v2.131
 * ------------------------------------------------------------------
 * 女频/情感短剧的第二条心跳（第一条是憋爽，见 payoff-rhythm-check）：
 * 观众嗑 CP 要的是"心动 → 阻碍 → 突破"的递进。关系写崩的五种死法：
 *  1) 有名无实：满口老公老婆/未婚夫妻，两人却零对手戏零亲密（关系是张标签，high）
 *  2) 突飞猛进：前面没有一个心动/暧昧节拍，直接亲嘴/表白/上床（感情没有地基，high）
 *  3) 一路糖水：亲密推进不断，但零误会/吃醋/外部阻力（甜而无钩，mid）
 *  4) 只暧昧不推进：心跳脸红一大堆，全集零表白零确定关系（光撩不给糖，mid）
 *  5) 告知式爱情：不靠动作演心动，全靠旁白"他发现自己爱上了她"（tell 不 show，low）
 *
 * 题材豁免：全文零关系锚点/零亲密/零心动（如复仇、男频逆袭、商战）时直接满分——
 * 不该把"没有爱情戏"误判成缺陷。
 *
 * 与现有引擎的分工：
 *  - arc-tracker: 角色情绪弧光跳变（情绪连续性）
 *  - character-balance: 戏份占比（屏幕时间）
 *  - relationship-progression (本引擎): 两人之间的亲密节拍"铺垫/阻碍/升级"关系
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
export type RelLang = 'zh' | 'en';

export interface RelationshipIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'decorative_relationship' // 有名无实
    | 'instant_love'            // 突飞猛进
    | 'sweet_no_obstacle'       // 一路糖水
    | 'stagnant_romance'        // 只暧昧不推进
    | 'told_not_shown_love';    // 告知式爱情
  evidence: string;
  advice: string;
}

export interface RelSignal {
  marker: string;
  snippet: string;
  position: number; // 0-1
  strong: boolean;
}

export interface RelationshipResult {
  /** 情感关系递进分 0-100（非情感题材自动满分） */
  score: number;
  /** 是否识别到情感线（false = 题材豁免，不参与评判） */
  hasRomanceLine: boolean;
  /** 关系锚点数（老公/老婆/未婚夫/前夫/夫妻/husband/wife…） */
  anchorCount: number;
  /** 强亲密数（吻/床/表白/求婚/我爱你） */
  strongCount: number;
  /** 暧昧心动数（心跳/脸红/牵手/凑近/吃醋/暧昧） */
  weakCount: number;
  /** 关系阻力数（误会/情敌/契约婚/前任/家族反对/禁忌） */
  obstacleCount: number;
  /** 关系升级数（在一起/确定关系/复合/领证/答应求婚/怀孕） */
  upgradeCount: number;
  /** 双人对手戏互动数（对视/抓手/抱住/拉住/挡在身前） */
  interactionCount: number;
  /** 告知式爱情数（"发现自己爱上了她"类旁白宣告） */
  tellingCount: number;
  /** 首个强亲密位置 0-1，无则 null */
  firstStrongPosition: number | null;
  /** 首个强亲密之前的暧昧铺垫数 */
  weakBeforeStrongCount: number;
  anchorHits: RelSignal[];
  strongHits: RelSignal[];
  weakHits: RelSignal[];
  issues: RelationshipIssue[];
}

// —— 中文信号库 ——
// 关系锚点：身份称谓/婚姻事件（不收裸"喜欢/爱"，避免"我喜欢吃苹果"式误判）
const ANCHOR_ZH = /(老公|老婆|男朋友|女朋友|未婚夫|未婚妻|妻子|丈夫|前夫|前妻|前男友|前女友|夫妻|情侣|心上人|结婚|离婚|婚礼|嫁人|嫁给他|娶了?|婚约|订婚)/g;
// 强亲密：吻/床/直球表白/求婚（牵手只算暧昧期节拍，不在此列；亲类带宾语约束防"亲自"误判）
const STRONG_ZH = /(亲吻|亲了?一?口|亲了?(?:他|她|我|你)|亲上|亲下去|吻了?(?:他|她|我|你)?|吻住|吻上去|吻下去|低头.{0,3}吻|舌吻|拥吻|激吻|圆房|同房|洞房|床笫|上床|表白|告白|我喜欢你|我爱你|向(?:她|他)求婚|求婚|嫁给我|领证|登记结婚)/g;
// 暧昧/心动：身体靠近但未确定关系的小节拍
const WEAK_ZH = /(心跳(?:加速|漏了?一拍|如鼓|得厉害)?|脸红|耳尖(?:发红|发烫|红了)|脸颊.{0,3}(?:发烫|发红|绯红)|心动|害羞|羞红|怦然|牵(?:起|着|住|了)?(?:他|她|我|你)?的?手|手牵手|十指相扣|依偎|凑近(?:他|她|我|你)?(?:耳边|脸|身旁)?|差一点(?:就|要)?(?:吻|亲)|暧昧|吃醋|醋意|占有欲|心(?:一下)?软了?|目光.{0,4}温柔|温柔地看着|凝视(?:着)?(?:他|她|我|你)|睫毛(?:轻颤|颤动)|呼吸(?:一滞|急促))/g;
// 关系阻力：误会/吃醋（外部/内部阻碍）/情敌/契约/前任/门第/禁忌
const OBSTACLE_ZH = /(误会|误解|吃醋|醋意大发|情敌|第三者|插足|反对(?:这门|他们|我俩|婚事)?|阻挠|阻止(?:他们|婚事|我们)|门不当户不对|门第|身份悬殊|契约(?:婚姻|结婚|夫妻|恋爱|女友|男友)|隐婚|前任|前女友|前男友|白月光|替身|不伦|禁忌之恋|家族恩怨|仇家|血海深仇|不能在(?:一起|一块儿)|注定(?:无缘|没有结果)|以大局为重)/g;
// 关系升级：关系状态发生明确正向跃迁
const UPGRADE_ZH = /(在一起了|在一起吧|正式交往|确定(?:了)?(?:恋爱)?关系|名正言顺|复合了?|领证|登记结婚|答应(?:了)?(?:他|她)?(?:求婚|表白|告白)|答应嫁|名分|官宣|公开恋情|怀(?:了|上)|有了身孕|我们在一起)/g;
// 双人对手戏互动（用于"有名无实"判定：身份挂着但人从不同框）
const INTERACT_ZH = /(看着(?:他|她|我|你)|盯着(?:他|她|我|你)|凝视(?:他|她|我|你)|抓(?:住|起).{0,4}的手|拉(?:住|了)?(?:他|她|我|你)|一把抱(?:住|了)?(?:他|她|我|你)|抱(?:住|紧).{0,3}(?:他|她|我|你)|推(?:开)?(?:他|她|我|你)|挡在(?:他|她|我|你)(?:身前|面前)|把(?:他|她).{0,4}(?:抱住|拉(?:住|回)|护在身后)|四目相对|对视)/g;
// 告知式爱情：抽象叙述代替可拍摄动作（中间允许 0-10 个副词/状语字，如"已经深深地""早就"）
const TELL_ZH = /(发现自己.{0,8}?(?:爱上|喜欢上?)|才(?:发现|知道|意识到|明白).{0,10}?(?:爱上|喜欢上?)|不得不承认.{0,8}?(?:爱|喜欢上?)|意识到.{0,10}?(?:爱上|喜欢上?)|心里(?:已经)?全是(?:她|他)|原来.{0,8}?(?:爱上|喜欢上?)|不知不觉.{0,6}?(?:爱上|喜欢上?))/g;

// —— 英文信号库 ——
const ANCHOR_EN = /(husband|wife|boyfriend|girlfriend|fianc[eé]e|married(?: to)?|marriage|divorce(?:d)?|wedding|bride|groom|couple|lovers|in love|sweetheart|engaged)/gi;
const STRONG_EN = /(kissed (?:him|her|me)|kissing (?:him|her|me)|kiss on the (?:lips|forehead)|made love|slept with (?:him|her)|sleeping together|confessed (?:his|her|my )?love|I love you|proposed to (?:him|her)|popped the question|marry me|eloped|made out|their lips met|slipped a ring on)/gi;
const WEAK_EN = /(heart (?:raced|skipped(?: a beat)?|fluttered)|blush(?:ed|ing)?|cheeks (?:turned|went) (?:red|pink)|ears burned|held hands|hand in hand|leaned in(?: close)?|almost kissed|jealous (?:of|streak)|jealousy|possessive|softened (?:at|toward)|gazed? (?:softly|at him|at her)|heartbeat quickened|knuckles brushing|fingers intertwined|rested (?:his|her) head on)/gi;
const OBSTACLE_EN = /(misunderstand(?:ing|stood)?|jealous(?:y)? (?:of|over)?|rival (?:for|lover)|the other (?:woman|man)|forbade (?:him|her) (?:to see|from)|forbidden (?:love|romance)|objected to (?:the|this) (?:marriage|match|relationship)|arranged marriage|contract (?:marriage|wife|husband|girlfriend|boyfriend)|secret (?:marriage|relationship)|ex(?:-| )(?:girlfriend|boyfriend|wife|husband)|family feud|forbidden love|can't be together|never meant to be|class (?:gap|divide)|star-crossed)/gi;
const UPGRADE_EN = /(got together|became a couple|made it official|officially dat(?:ing|ed)|got back together|reconciled with|registered (?:the|their) marriage|accepted (?:the|his|her) proposal|said yes to (?:him|her)|announced (?:their|the) relationship|(?:she|he) was pregnant|moving in together|asked (?:him|her) (?:out|to be))/gi;
const INTERACT_EN = /(looked at (?:him|her|me)|stared at (?:him|her|me)|gazed at (?:him|her|me)|grabbed (?:his|her|my) hand|took (?:his|her|my) hand|pulled (?:him|her|me)|hugged (?:him|her|me)|held (?:him|her|me) (?:close|tight)|pushed (?:him|her|me) away|stood in front of (?:him|her|me)|cupped (?:his|her|my) face|eyes met|locked eyes)/gi;
const TELL_EN = /(realized (?:that )?(?:he|she|I) loved|found (?:him|her|myself) in love|couldn'?t deny (?:his|her|the|my) (?:love|feelings)|realized (?:he|she|I) had fallen for|knew (?:he|she|I) was in love|had fallen for (?:him|her) without (?:noticing|realizing)|was already in love with (?:him|her) before (?:he|she) knew)/gi;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

function collect(text: string, re: RegExp, strong: boolean): RelSignal[] {
  const hits: RelSignal[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    hits.push({
      marker: m[0],
      snippet: text.slice(Math.max(0, m.index - 8), m.index + m[0].length + 12).replace(/\s+/g, ' ').trim(),
      position: m.index / Math.max(1, text.length),
      strong,
    });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return hits.sort((a, b) => a.position - b.position);
}

function count(text: string, re: RegExp): number {
  let n = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    n++;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return n;
}

/**
 * 情感关系递进检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function relationshipProgressionCheck(text: string, lang: RelLang): RelationshipResult {
  const empty: RelationshipResult = {
    score: 100,
    hasRomanceLine: false,
    anchorCount: 0,
    strongCount: 0,
    weakCount: 0,
    obstacleCount: 0,
    upgradeCount: 0,
    interactionCount: 0,
    tellingCount: 0,
    firstStrongPosition: null,
    weakBeforeStrongCount: 0,
    anchorHits: [],
    strongHits: [],
    weakHits: [],
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const anchorHits = collect(text, isZh ? ANCHOR_ZH : ANCHOR_EN, false);
  const strongHits = collect(text, isZh ? STRONG_ZH : STRONG_EN, true);
  const weakHits = collect(text, isZh ? WEAK_ZH : WEAK_EN, false);
  const obstacleCount = count(text, isZh ? OBSTACLE_ZH : OBSTACLE_EN);
  const upgradeCount = count(text, isZh ? UPGRADE_ZH : UPGRADE_EN);
  const interactionCount = count(text, isZh ? INTERACT_ZH : INTERACT_EN);
  const tellingCount = count(text, isZh ? TELL_ZH : TELL_EN);

  const anchorCount = anchorHits.length;
  const strongCount = strongHits.length;
  const weakCount = weakHits.length;
  const firstStrongPosition = strongCount ? strongHits[0].position : null;
  const weakBeforeStrongCount = firstStrongPosition === null
    ? 0
    : weakHits.filter((h) => h.position < firstStrongPosition).length;

  // 题材豁免：三种关系信号全无 → 非情感题材，不评判
  if (anchorCount === 0 && strongCount === 0 && weakCount === 0) return empty;

  const issues: RelationshipIssue[] = [];
  let penalty = 0;

  // 1) 有名无实：关系身份被反复提及，但两人零亲密零互动——CP 只是道具
  if (anchorCount >= 2 && strongCount === 0 && weakCount === 0 && interactionCount === 0) {
    penalty += 22;
    issues.push({
      severity: 'high',
      type: 'decorative_relationship',
      evidence: isZh
        ? `${anchorCount} 处夫妻/恋人身份称谓，却 0 处亲密动作、0 处双人互动`
        : `${anchorCount} relationship-title mentions, 0 intimate beats, 0 two-person interactions`,
      advice: isZh
        ? '"老公""未婚夫"不能只是贴在人物表上的标签——观众要看到这层关系在场面里"活着"。至少安排一场两人同框正戏：一次对视、一次肢体接触、一句只有他们之间才说得出口的话。先让 CP 同框，再谈关系好坏。'
        : 'Titles like "husband" or "fiancé" can\'t just live on a character sheet — the audience must see the bond in a scene. Give the pair at least one real two-hander: a held look, physical contact, a line no one else could say to them. Put the couple in a room together before judging the relationship.',
    });
  }

  // 2) 突飞猛进：首个强亲密出现在 15% 之后，且此前零暧昧铺垫；
  //    豁免一：亲密位于开场 15% 内（开场即已婚/已恋日常）；
  //    豁免二：强亲密前后 5% 内出现关系锚点（如"低头吻了吻妻子的额头"——身份即铺垫）
  const anchorNearFirstStrong = firstStrongPosition !== null
    && anchorHits.some((h) => Math.abs(h.position - firstStrongPosition!) <= 0.05);
  if (strongCount >= 1 && firstStrongPosition! > 0.15
    && weakBeforeStrongCount === 0 && !anchorNearFirstStrong) {
    penalty += 20;
    issues.push({
      severity: 'high',
      type: 'instant_love',
      evidence: isZh
        ? `首个吻/表白/床戏在 ${(firstStrongPosition! * 100).toFixed(0)}% 处，此前 0 个心动/暧昧节拍`
        : `First kiss/confession/sex at ${(firstStrongPosition! * 100).toFixed(0)}%, with 0 heartbeat/romance beats before it`,
      advice: isZh
        ? '没有铺垫的亲密观众只觉得假。在第一次吻/表白之前至少铺三级台阶：一次身体本能反应（心跳/脸红）、一次越界的靠近（指尖相碰/凑近耳边）、一次本该收回却没收的对视。让观众在亲下去之前就已经嗑到了，亲密才值钱。'
        : 'Intimacy with no buildup reads as fake. Lay at least three steps before the first kiss or confession: an involuntary body reaction (racing heart, blush), an encroaching closeness (brushing fingers, leaning in), a gaze that should have broken but didn\'t. Make the audience ship it before the lips touch — then intimacy pays off.',
    });
  }

  // 3) 一路糖水：亲密推进≥2 次却零阻力——甜而无钩，没有非看不可的张力
  if (strongCount >= 2 && obstacleCount === 0) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'sweet_no_obstacle',
      evidence: isZh
        ? `${strongCount} 处强亲密推进，0 处误会/吃醋/外部阻力`
        : `${strongCount} strong intimacy beats, 0 misunderstandings/jealousy/external obstacles`,
      advice: isZh
        ? '一路顺风顺水的糖吃三口就腻。甜点之间必须夹一道阻力：一场因信息差产生的误会、一次吃醋、一个门第或前任的外部威胁。阻力不用大，但要让观众在每颗糖之前先慌一下——糖才甜。'
        : 'Smooth, obstacle-free sweetness goes bland after three bites. Put a barrier between every two candies: an information-gap misunderstanding, a flash of jealousy, a class or ex threat. The obstacle need not be huge, but the audience must fear the sugar is lost — that fear is what makes it sweet.',
    });
  }

  // 4) 只暧昧不推进：心动信号≥3 却零强亲密零关系升级——光撩不给糖
  if (weakCount >= 3 && strongCount === 0 && upgradeCount === 0) {
    penalty += 12;
    issues.push({
      severity: 'mid',
      type: 'stagnant_romance',
      evidence: isZh
        ? `${weakCount} 处心跳/脸红/暧昧节拍，但 0 次表白/吻/确定关系`
        : `${weakCount} heartbeat/blush/tension beats, but 0 confession/kiss/relationship upgrade`,
      advice: isZh
        ? '暧昧是钩子，不是正菜，钩子抛三次不收就钝了。本集后 30% 必须给一次关系实质推进：一句说破的表白、一次没躲开的吻、一个对外公开的身份，哪怕推进后立刻被新矛盾打断。观众可以等，但要让他们等到东西。'
        : 'Tension is a hook, not the meal — thrown three times with no payoff, it goes blunt. By the final 30%, deliver one real escalation: a spoken confession, a kiss not dodged, a public label — even if a new conflict breaks it off a beat later. The audience may wait, but the wait must pay something.',
    });
  }

  // 5) 告知式爱情：抽象旁白宣告≥2 次，可拍摄的心动动作却不足 2 个
  if (tellingCount >= 2 && weakCount < 2) {
    penalty += 8;
    issues.push({
      severity: 'low',
      type: 'told_not_shown_love',
      evidence: isZh
        ? `${tellingCount} 处"发现自己爱上"式旁白宣告，仅 ${weakCount} 处可拍摄的心动动作`
        : `${tellingCount} "realized he loved" narrative declarations, only ${weakCount} filmable heartbeat beats`,
      advice: isZh
        ? '"他发现自己爱上了她"是编剧替角色谈恋爱，镜头拍不出来。把旁白翻译成动作：会在人群里第一眼找她、听到她名字会停住手里的杯子、明明该走了却又坐下。用只有摄影机才抓得到的小动作让观众自己得出"他爱她"的结论。'
        : '"He realized he loved her" is the writer dating on the character\'s behalf — the camera can\'t photograph it. Translate narration into behavior: scanning the crowd for her first, freezing mid-sip at her name, sitting back down when he should leave. Let the audience conclude "he loves her" from small moves only the camera catches.',
    });
  }

  const score = clamp(100 - penalty, 0, 100);

  return {
    score,
    hasRomanceLine: true,
    anchorCount,
    strongCount,
    weakCount,
    obstacleCount,
    upgradeCount,
    interactionCount,
    tellingCount,
    firstStrongPosition: firstStrongPosition === null ? null : r2(firstStrongPosition),
    weakBeforeStrongCount,
    anchorHits,
    strongHits,
    weakHits,
    issues,
  };
}
