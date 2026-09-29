import { isSceneHeaderLine } from './script-scenes';
/**
 * 物象母题节奏 / 信物三现检测（v2.133 块140，创作能力类）
 * ------------------------------------------------------------------
 * 病象：契诃夫之枪法则"第一幕挂枪、第三幕开枪"，聚焦是第一现、
 * 使用是第二现、回响是第三现。AI 稿的物件节奏断在三处：
 *  ①聚焦即弃——玉佩被郑重特写（摩挲/凝视/贴胸口整整一行），随后
 *    全稿再无踪影：枪挂得隆重，再没人提，观众预期被白白吊起；
 *  ②冷枪远隔——枪早挂了，中间零互动，终幕突然掏出来一锤定音：
 *    观众早忘了它，兑现再重也使不上劲，是穿了马甲的后手空降；
 *  ③情感漂移——物件刚被宣布是遗物/信物/传家，转头就被随手扔进
 *    垃圾桶/丢在一边，角色毫无反应：情感锚漂移，"信物"沦为布景。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - unplanted-asset：管"零铺垫后手"——制胜物揭晓时刻才首次出现
 *    （planted 即是它的豁免区），本引擎管"planted 但节奏断链"——
 *    枪种了，只是挂错位/被忘掉/被随手放下，恰是它的豁免辖区；
 *  - foreshadow-ledger：用 plant/payoff 信号词做跨集记账（挂账层
 *    管理），不做单稿内距离节奏；本引擎做单稿"物件×距离×情感"
 *    三查；带 plant 钩子的行（暗示/埋下/以后再说）豁免出本引擎，
 *    留给跨集记账；
 *  - prop-ledger：管跨集归属记账（谁的物件、去了哪集），不管单稿
 *    聚焦-处置节奏；
 *  - fidget-prop：管"闲玩小动作"（反复把玩道具凑戏），本引擎管
 *    "物件本该有戏、稿子却忘了它的戏"。
 *
 * 判定（单稿、零 LLM）：
 *  - 信物族词表：玉佩/吊坠/戒指/项链/怀表/信件/日记/照片/音乐盒/
 *    打火机/平安符/长命锁/婚书/发簪…（手机/雨伞等日用品不入表
 *    ——手机每次出现都是功能性的，没有三现节奏可谈）；
 *  - focusOnce：物件全稿仅出现 1 次 + 同行聚焦语（摩挲/凝视/端详/
 *    贴身藏/特写…），且无 plant 钩子（暗示/埋下/以后再说…）→
 *    聚焦即弃；带钩子豁免留给跨集；
 *  - coldPayoff：物件末次出现落在终幕 20%（末行带决定性使用语：
 *    掏出/就是这/证据/证明…）、首现落在前 35%、中间最大相邻间隔
 *    超全稿 45%（零互动）→ 冷枪远隔；
 *  - driftCarry：信物语（遗物/信物/传家/定情/她留下…）与随手处置
 *    语（随手扔/丢掉/摔了/塞进抽屉/撂在一边…）同场景 ±3 行共现
 *    且两行都含同一物件 → 情感漂移；
 *  - rescue：处置窗口内有柔情反应（红了眼/犹豫/最后看一眼/轻声说
 *    对不起…）或反派语气（冷笑/咬牙/做个了结…）——前者是痛苦
 *    决断、后者是剧情，都不算漂移；
 *  - 场景头行不参与任何词表匹配；全稿不足 25 行不判节奏（太短无
 *    节奏可言）；
 *  - 计分：coldPayoff / driftCarry（未救）每处 −30，focusOnce 每
 *    处 −20，封底 20；零命中 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface PropMotifHit {
  line: number;
  kind: 'focus_once' | 'cold_payoff' | 'drift_carry';
  prop: string;
  snippet: string;
  /** 是否被救（柔情决断/反派剧情，处置不算漂移） */
  rescued: boolean;
  reason: string;
}

export interface PropMotifResult {
  score: number;
  hitCount: number;
  hits: PropMotifHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/** 全稿行数下限：低于此值不判节奏 */
const MIN_LINES = 25;

/* ───────── 信物族词表（承载叙事功能的物件，日用品不入表） ───────── */

const PROPS_ZH = [
  '玉佩', '玉坠', '玉镯', '吊坠', '挂坠', '戒指', '手镯', '手链', '脚链', '项链',
  '怀表', '钢笔', '发簪', '发卡', '耳环', '耳坠', '胸针', '袖扣', '手帕', '丝巾',
  '音乐盒', '八音盒', '打火机', '日记本', '日记', '相册', '信封', '信件', '情书',
  '平安符', '护身符', '长命锁', '婚书', '木梳', '铜镜', '弹壳', '勋章', '徽章',
  '糖纸', '千纸鹤', '布偶', '玩偶', '钥匙', '照片',
];

const PROPS_EN = [
  'locket', 'pendant', 'ring', 'bracelet', 'necklace', 'anklet', 'pocket watch',
  'fountain pen', 'hairpin', 'earring', 'earrings', 'brooch', 'cufflink', 'handkerchief',
  'scarf', 'music box', 'lighter', 'diary', 'journal', 'photo album', 'photograph',
  'photo', 'envelope', 'love letter', 'amulet', 'charm', 'comb', 'medal',
  'badge', 'toy', 'doll', 'key', 'letter',
];

const propReEn = (p: string): RegExp => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

/* ───────── 聚焦语（郑重特写，不是普通拿放） ───────── */

const FOCUS_ZH = /(?:特写|凝视|注视|端详|摩挲|抚摸着|攥紧|紧紧(?:握|攥|捏)着|贴身(?:带着|藏着|放着)|贴(?:在)?胸口|藏(?:在)?(?:胸口|怀里|枕下|枕头底下)|久久(?:凝|望|看)着|出了神|出神地|反复(?:看|摩挲|端详)着|对着(?:它|这)(?:发呆|出神))/;

const FOCUS_EN = /\b(?:close-?up (?:on|of)|lingers? on|gazes? at|stares? at|turns? (?:it|this) over in (?:his|her|their) hands?|runs? (?:his|her|their) (?:thumb|finger|fingers) (?:over|along)|clutches it to|presses? it to (?:his|her|their) chest|keeps? (?:it|this) (?:close|hidden|tucked)|tucks? it (?:away|into|under)|wears? it (?:close|next) to|strokes? it|traces? the)\b/i;

/* ───────── plant 钩子（跨集豁免：留给 foreshadow-ledger 记账） ───────── */

const HOOK_ZH = /(?:暗示|埋下|伏笔|暗藏|留着(?:以后|日后)|以后再|下(?:次|集|回)|到(?:时候|那天)|日后|改天)/;

const HOOK_EN = /\b(?:foreshadow|we(?:'ll| will) (?:talk|discuss) (?:about )?(?:it|this) later|save it for later|another (?:time|day)|some other time|there(?:'s| is) more to (?:it|this)|keep this safe|remember this)\b/i;

/* ───────── 决定性使用语（终幕兑现强度） ───────── */

const DECISIVE_ZH = /(?:拿出|掏出|取出|亮出|甩在|拍在|摔在|递给|递上|交出|就是这|关键(?:的)?(?:是|时刻)?|证据|凭据|信物|证明|真相|全靠|原来|认出|对上(?:了)?(?:暗号|笔迹|字迹))/;

const DECISIVE_EN = /\b(?:pulls? out|takes? out|produces|hands? over|slams? (?:it|the \w+)? down|this is it|here(?:'s| is) (?:the )?(?:proof|evidence)|the (?:proof|evidence|truth)|proves? (?:it|everything)|identif(?:y|ies)|match(?:es)? (?:the|his|her) (?:handwriting|signature|mark))\b/i;

/* ───────── 信物锚（物件被宣布携带情感） ───────── */

const EMOTION_ZH = /(?:遗物|遗照|遗言|信物|纪念|定情|订婚|嫁妆|陪嫁|祖传|传家|(?:妈妈|母亲|爸爸|父亲|奶奶|外婆|爷爷|外公|姥姥|姥爷)(?:留下|给的|送的|传的)|亡(?:夫|妻|女|子|母|父)|她留(?:下|给)|他留(?:下|给)|娘留(?:下|给)|爹留(?:下|给)|最后(?:一件|一样)|念想)/;

const EMOTION_EN = /\b(?:memento|keepsake|souvenir|heirloom|my (?:late )?(?:mother|father|mom|dad|wife|husband|daughter|son|grandma|grandpa|grandmother|grandfather) (?:gave|left|sent)|she left (?:me|it|this)|he left (?:me|it|this)|engagement|betrothal|dowry|passed down|in (?:her|his) memory|last gift|last thing|only thing (?:she|he) left)\b/i;

/* ───────── 随手处置锚（角色的轻慢动作，非剧情事件） ───────── */

const DISPOSE_ZH = /(?:随手(?:一扔|一丢|扔|丢|撂|放在|塞进|搁在)|扔(?:进|到|在|掉|了)|丢(?:进|到|在|掉|了)|摔(?:了|在地上|向|过去)|砸了|塞进(?:垃圾桶|抽屉|箱底|包底)|撂(?:在)?(?:一边|一旁)|丢(?:在)?(?:一边|一旁)|踩过|跨过|塞到(?:角落|床底|看不见))/;

const DISPOSE_EN = /\b(?:tosses? (?:it|the \w+) (?:aside|away)|throws? (?:it|the \w+) (?:away|aside|in the trash|into the trash)|chucks? (?:it|the \w+)|dumps? (?:it|the \w+)|shoves? (?:it|the \w+) (?:in|into) (?:a )?(?:drawer|box|corner|bag)|slams? (?:it|the \w+) down|kicks? it aside|steps? over it|leaves? (?:it|the \w+) behind|flings? (?:it|the \w+)|carelessly (?:drops|discards))\b/i;

/* ───────── rescue A：柔情反应（处置是痛苦决断） ───────── */

const TENDER_ZH = /(?:红了眼|含泪|流泪|眼泪|哽咽|颤抖|犹豫|迟疑|舍不得|最后(?:一眼|看了)|握了(?:很)?久|轻声|喃喃|对不起|抱歉|别怪(?:我|它)|一狠心|咬(?:了)?牙|沉默(?:了)?(?:许久|很久|片刻))/;

const TENDER_EN = /\b(?:tears|teary|eyes (?:well|red)|chokes? up|voice cracks|hesitates?|wavers?|can'?t bring (?:myself|himself|herself)|one last look|whispers?|whispering|i'?m sorry|forgive me|trembling hands?|silent for a long|pauses?)\b/i;

/* ───────── rescue B：反派语气（处置是剧情） ───────── */

const COLD_ZH = /(?:冷笑|嗤笑|阴沉|狞笑|恶狠狠|咬牙(?:切齿)?|做个了结|该结束|终于等到|这一天|报(?:应|仇)|算总账)/;

const COLD_EN = /\b(?:smirks?|sneers?|coldly|viciously|it ends (?:today|now)|time to end this|finally|at last|revenge|settle the score)\b/i;

/* ───────── 主函数 ───────── */

export function propMotifRhythm(draft: string): PropMotifResult {
  const text = draft ?? '';
  const empty: PropMotifResult = { score: 100, hitCount: 0, hits: [], issues: [], advice: [] };
  if (!text.trim()) return empty;
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length < MIN_LINES) return empty;
  const total = rawLines.length;

  /* 场景索引（跨场景头不计共现窗口） */
  let sceneIdx = -1;
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  rawLines.forEach((raw, i) => {
    if (isSceneHeaderLine(raw.trim())) sceneIdx += 1;
    sceneOf[i] = Math.max(0, sceneIdx);
  });

  /* 每物件出现位置索引（场景头行不参与） */
  const props = zh ? PROPS_ZH : PROPS_EN;
  const positions = new Map<string, number[]>();
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    for (const p of props) {
      const hit = zh ? line.includes(p) : propReEn(p).test(line);
      if (hit) {
        if (!positions.has(p)) positions.set(p, []);
        const arr = positions.get(p)!;
        if (arr[arr.length - 1] !== i) arr.push(i); /* 同行防重（词表重复项兜底） */
      }
    }
  });

  const focusRe = zh ? FOCUS_ZH : FOCUS_EN;
  const hookRe = zh ? HOOK_ZH : HOOK_EN;
  const decisiveRe = zh ? DECISIVE_ZH : DECISIVE_EN;
  const emotionRe = zh ? EMOTION_ZH : EMOTION_EN;
  const disposeRe = zh ? DISPOSE_ZH : DISPOSE_EN;
  const tenderRe = zh ? TENDER_ZH : TENDER_EN;
  const coldRe = zh ? COLD_ZH : COLD_EN;

  const hits: PropMotifHit[] = [];

  /* 检测器一：focusOnce 聚焦即弃（物件全稿仅 1 现 + 同行郑重聚焦 + 无 plant 钩子） */
  for (const [p, pos] of positions) {
    if (pos.length !== 1) continue;
    const i = pos[0];
    const line = rawLines[i].trim();
    if (!focusRe.test(line)) continue;
    if (hookRe.test(line)) continue;
    hits.push({
      line: i + 1,
      kind: 'focus_once',
      prop: p,
      snippet: line.slice(0, 30),
      rescued: false,
      reason: zh
        ? `「${p}」被郑重聚焦后再无踪影——枪挂得隆重，全稿却再没人提，观众的预期被白白吊起`
        : `"${p}" gets a solemn focus and then vanishes - the gun is hung with ceremony and never mentioned again, leaving the audience's expectation dangling`,
    });
  }

  /* 检测器二：coldPayoff 冷枪远隔（首现早 / 末现终幕带决定性使用 / 中间最大相邻间隔 > 45%） */
  for (const [p, pos] of positions) {
    if (pos.length < 2) continue;
    const first = pos[0];
    const last = pos[pos.length - 1];
    if (first + 1 >= total * 0.35) continue;
    if (last + 1 <= total * 0.82) continue;
    let maxGap = 0;
    for (let k = 1; k < pos.length; k += 1) maxGap = Math.max(maxGap, pos[k] - pos[k - 1]);
    if (maxGap <= total * 0.45) continue;
    const lastLine = rawLines[last].trim();
    if (!decisiveRe.test(lastLine)) continue;
    hits.push({
      line: last + 1,
      kind: 'cold_payoff',
      prop: p,
      snippet: lastLine.slice(0, 30),
      rescued: false,
      reason: zh
        ? `「${p}」早挂枪、终幕才兑现，中间零互动——观众早忘了它，决定性使用再重也使不上劲`
        : `"${p}" is hung early and cashed in at the climax with nothing in between - the audience forgot it long ago, so the decisive use lands with no force`,
    });
  }

  /* 检测器三：driftCarry 情感漂移（信物语 × 随手处置语 ±3 行同场景共现同一物件） */
  for (const [p, pos] of positions) {
    for (const i of pos) {
      const line = rawLines[i].trim();
      if (!disposeRe.test(line)) continue;
      let emoLine = -1;
      for (let j = Math.max(0, i - 3); j <= Math.min(rawLines.length - 1, i + 3); j += 1) {
        if (Math.abs(j - i) > 3) continue;
        if (isSceneHeaderLine(rawLines[j].trim())) continue;
        if (sceneOf[j] !== sceneOf[i]) continue;
        const jl = rawLines[j].trim();
        const hasProp = zh ? jl.includes(p) : propReEn(p).test(jl);
        if (!hasProp || !emotionRe.test(jl)) continue;
        emoLine = j;
        break;
      }
      if (emoLine < 0) continue;
      const lo = Math.max(0, Math.min(emoLine, i) - 1);
      const hi = Math.min(rawLines.length - 1, Math.max(emoLine, i) + 1);
      let win = '';
      for (let j = lo; j <= hi; j += 1) {
        const t = rawLines[j].trim();
        if (!t || isSceneHeaderLine(t)) continue;
        win += `${t}\n`;
      }
      const rescued = tenderRe.test(win) || coldRe.test(win);
      hits.push({
        line: i + 1,
        kind: 'drift_carry',
        prop: p,
        snippet: line.slice(0, 30),
        rescued,
        reason: zh
          ? `「${p}」刚被称作信物就被随手处置${rescued ? '（有情感反应/剧情语气，已救回）' : '，角色毫无反应——情感锚漂移，信物沦为布景'}`
          : `"${p}" is called a keepsake and then casually disposed of${rescued ? ' (tender reaction or plot intent, rescued)' : ' with no reaction from anyone - the emotional anchor drifts and the token becomes set dressing'}`,
      });
    }
  }

  hits.sort((a, b) => a.line - b.line);

  /* 计分：coldPayoff/driftCarry(未救) −30，focusOnce −20，封底 20 */
  let score = 100;
  for (const h of hits) {
    if (h.kind === 'focus_once') score -= 20;
    else if (!h.rescued) score -= 30;
  }
  if (score < 20) score = 20;

  const count = (kind: PropMotifHit['kind']) => hits.filter((h) => h.kind === kind).length;
  const focusN = count('focus_once');
  const coldN = count('cold_payoff');
  const driftN = count('drift_carry');

  const issues: string[] = [];
  const advice: string[] = [];
  if (focusN >= 1) {
    issues.push(zh
      ? `${focusN} 处"聚焦即弃"——物件被郑重特写后全稿零再现，铺垫成了摆设。`
      : `${focusN} focus-then-abandoned prop(s) - solemnly framed objects never return, turning setup into set decoration.`);
    advice.push(zh
      ? '聚焦过的物件要给第三现：让它在情节中段再"互动"一次——主角在低谷时拿出来看一眼、配角问起它的来历、对手留意到它——聚焦才成铺垫而不是布景。'
      : 'Every focused prop needs a second beat: have it interact again mid-draft - the lead takes it out at a low moment, a side character asks about it, the rival notices it - a focus only counts as setup if the story remembers it.');
  }
  if (coldN >= 1) {
    issues.push(zh
      ? `${coldN} 处"冷枪远隔"——物件首现与终幕兑现之间零互动，决定性使用失去力量。`
      : `${coldN} cold-payoff prop(s) - planted early and cashed in at the climax with nothing in between, draining the decisive use of force.`);
    advice.push(zh
      ? '冷枪要中途再上膛：挂枪点与兑现点之间至少插一次提及（哪怕一句带过的特写），或让兑现分层——先让它失败一次、再让它一锤定音，观众才认这笔账。'
      : 'Re-cock the cold gun mid-draft: insert at least one mention between plant and payoff (even a passing close-up), or pay it off in layers - let it fail once before it decides everything, so the audience cashes in with you.');
  }
  if (driftN >= 1) {
    const unrescued = hits.filter((h) => h.kind === 'drift_carry' && !h.rescued).length;
    issues.push(zh
      ? `${unrescued} 处"情感漂移"——信物被随手处置且无人有反应，情感锚断链。`
      : `${unrescued} drifted-keepsake beat(s) - tokens are disposed of casually and nobody reacts, snapping the emotional anchor.`);
    advice.push(zh
      ? '信物不许随手处置：若处置是剧情必需，就给一道痛苦决断——多攥一秒、最后一眼、轻声说句对不起；若只是写丢了，要么删掉信物身份，要么删掉那份随手。'
      : 'A keepsake is never tossed: if the disposal is story-necessary, charge it with pain - hold it one second longer, one last look, a whispered apology; if it is just careless writing, either drop the keepsake identity or drop the carelessness.');
  }

  return { score, hitCount: hits.length, hits, issues, advice };
}
