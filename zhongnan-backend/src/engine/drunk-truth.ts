import { isSceneHeaderLine } from './script-scenes';
/**
 * 灌醉吐真言检测（v2.80 块85，创作能力类）
 * ------------------------------------------------------------------
 * 病象：秘密一难产就上酒桌——主角把反派/证人灌醉，对方立刻竹筒
 * 倒豆子，藏了十年的真相三杯下肚全说了：
 *   △三杯下肚，他的舌头就松了。
 *   △他醉眼朦胧地说出了藏了十年的真相。
 *   She plies him with drinks. He spills the whole secret.
 * 酒成了万能钥匙：情报的锁扣被简化为酒精度数。真实的人醉了
 * 语无伦次、抵抗、昏睡，唯独不会条理清晰地交代机密；第一次是
 * 妙招，第三次酒桌就成了审讯室的廉价替身。真话要么靠筹码交换、
 * 要么靠当事人自己选择开口——醉话可以当线索，不能当证词。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - villainConfession：管反派被空泛质问后不打自招（对话结构
 *    漏洞，无酒也招），本引擎管"用灌酒这个手段批量解锁真话"
 *    的手段拐杖，锚点是酒而非质问；
 *  - plotArmor：管看守喝醉（主角逃脱的物理漏洞），本引擎管
 *    灌醉获取情报；
 *  - emotion-prop-crutch：管痛苦灌醉自己（自我麻醉当情绪道具），
 *    本引擎管灌别人套话；
 *  - eavesdropDump：管偷听免费获取机密，本引擎管酒桌免费获取。
 *
 * 判定：
 *  - 醉意/灌酒锚点命中（灌醉/劝酒/三杯下肚/喝高了/got him
 *    drunk/plied with drinks…），且 ±2 行窗口内出现秘密泄露词
 *    （吐真言/说出真相/松了口/spilled the secret/confessed…）
 *    ——纯醉酒戏（醉倒路边）无泄露放行；
 *  - 相邻 2 行内的醉意表述视为同一场酒局，不重复计；跨场景头
 *    重置，各算一次钥匙使用；
 *  - 第 1 次豁免（一次性妙招合法），第 2 次起每次 1 hit；
 *  - rescue（±2 行出现灌酒失败/拒酒）：灌不倒/不肯喝/滴酒不沾/
 *    把酒倒掉/越灌越清醒/refuses the drink/pours it out/stays
 *    sober——酒没起作用，作者没把它当钥匙用；
 *  - 计分（结构性病，命中即成立）：n=1 → 70，每多 1 处 −20，
 *    封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface DrunkTruthHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（酒没起作用/被拒，没当钥匙用） */
  rescued: boolean;
  reason: string;
}

export interface DrunkTruthResult {
  score: number;
  /** 酒桌钥匙总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: DrunkTruthHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 醉意/灌酒锚点 */
const DRUNK_ZH = /灌(?:醉|酒|下|进|了)|灌倒|劝酒|劝了[^，。；、\n]{0,3}杯|敬(?:了)?[^，。；、\n]{0,3}杯|酒过三巡|三杯下肚|几杯[^，。；、\n]{0,4}(?:下肚|落肚)|喝(?:得)?(?:酩酊|烂醉|醉醺醺)|醉(?:眼|意|倒|得不轻|醺)|(?:喝醉|喝高|喝多)了/;

const DRUNK_EN = /\b(?:got (?:him|her|them) drunk|pli(?:es|ed) (?:him|her|them) with|wines? and dines?|over drinks|after (?:a few|three|several) drinks|three drinks in|drunk enough|drinks? loosen(?:ed|ing)?|tongue loosened|loosened (?:up|his|her) tongue|drunk and (?:rambling|talkative|chatty))\b/i;

/* 秘密泄露结果：醉+泄露绑定才算钥匙，纯醉酒戏放行 */
const LEAK_ZH = /吐真言|说出(?:了)?[^，。；、\n]{0,8}(?:真相|实话|实情|秘密|底细|内情)|吐(?:出了?)?[^，。；、\n]{0,6}(?:真相|秘密|实话|实情)|竹筒倒豆子|和盘托出|交(?:了)?底|松了口(?!气)|说漏(?:嘴|了)?|全招了|全说了|坦白(?:了)?(?:一切|全部|所有)?|把秘密|把真相|憋了[^，。；、\n]{0,6}年的?话/;

const LEAK_EN = /\b(?:spil(?:l|ls|led|t) (?:the|his|her|everything)|told (?:the|his|her) (?:truth|secret)|confess(?:es|ed)?|let (?:the truth|it) slip|truth comes? out|talking freely|gave up the (?:name|address|location)|told (?:him|her) everything|the whole story)\b/i;

/* 救援：灌酒失败/被拒——酒没起作用，不是钥匙 */
const RESCUE_ZH = /灌不(?:倒|醉|多)|不肯喝|不能喝|不会喝|戒了酒|滴酒不沾|把酒(?:倒掉|泼了|推开|推回去)|越灌越(?:清醒|明白)|死活不开口|还(?:算)?清醒|根本没醉/;

const RESCUE_EN = /\b(?:won'?t drink|refuses? (?:the )?drink|doesn'?t drink|teetotal|pours? (?:it|the drink) out|spits? (?:out )?the (?:drink|whiskey)|holds? (?:his|her) liquor|stays? sober|not even tipsy|sober enough)\b/i;

/**
 * 纯函数：检测"灌醉套真话"式酒桌钥匙套路。
 */
export function drunkTruth(draft: string): DrunkTruthResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const drunkRe = zh ? DRUNK_ZH : DRUNK_EN;
  const leakRe = zh ? LEAK_ZH : LEAK_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: DrunkTruthHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevDrunkLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevDrunkLine = -10; return; }
    const m = line.match(drunkRe);
    if (!m) return;
    /* 相邻 2 行内的醉意表述 = 同一场酒局（"三杯下肚"+"醉眼朦胧"），不重复计 */
    if (i - prevDrunkLine <= 2) { prevDrunkLine = i; return; }
    prevDrunkLine = i;

    /* 泄露检查：±2 行窗口内须出现秘密泄露，纯醉酒戏放行 */
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    const win = rawLines.slice(lo, hi + 1).join('\n');
    if (!leakRe.test(win)) return;

    hitCount += 1;
    if (hitCount >= 2) {
      hits.push({
        line: i + 1,
        sceneIndex: Math.max(0, sceneIdx),
        sceneHeader: header,
        snippet: line.slice(0, 30),
        marker: (m[0] ?? '').slice(0, 28),
        rescued: rescueRe.test(win),
        reason: zh
          ? '又在用灌醉当万能钥匙——藏了十年的秘密三杯下肚全说了，情报的锁被简化成酒精度数'
          : 'alcohol as a master key again — a decade-old secret pours out after three drinks, the lock reduced to proof strength',
      });
    }
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"灌醉吐真言"式酒桌钥匙（${n} 处未救）——秘密难产就上酒桌，情报的锁扣被简化为酒精度数。`
      : `${hitCount} drunk-truth beats (${n} unrescued) — the secret is hard to extract, so out comes the bottle; the lock is reduced to proof strength.`);
    advice.push(zh
      ? '灌醉不许当万能钥匙——真实的人醉了语无伦次、抵抗、昏睡，唯独不会条理清晰地交代机密；第一次是妙招，第三次酒桌就成了审讯室的廉价替身。让真话贵起来：要么靠筹码交换（他拿她要的名字换女儿的抚养权），要么靠当事人自己选择开口（他不是醉了，是终于不想再扛了）；醉话最多当线索——第二天他矢口否认、说法对不上，逼主角去验证，而不是当证词直接采信。非要写酒，就写抵抗：他一边醉一边死咬关键的那一句，说漏的全是边角料，真正的话清醒时才说。'
      : 'Alcohol is not a master key — real drunk people ramble, resist, pass out; they do not deliver an organized debrief. The first time is a clever move, the third makes the dinner table a cheap interrogation room. Make the truth cost something: trade for it (he gives up the name in exchange for custody), or have the character choose to speak (he is not drunk — he is finally tired of carrying it). Drunk talk is a lead at best: next day he denies it, the details do not match, and the protagonist has to verify instead of taking it as testimony. If you must use drink, write resistance: he clamps down on the one thing that matters even while plastered, spills only scraps, and says the real words sober.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
