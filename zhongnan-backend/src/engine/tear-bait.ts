import { isSceneHeaderLine } from './script-scenes';
/**
 * 泪点开关检测（v2.80 块86，创作能力类）
 * ------------------------------------------------------------------
 * 病象：需要观众共情了，就拧一下"泪点开关"——眼眶一红、鼻子一酸、
 * 泪水在眼眶里打转、一滴眼泪滑落：
 *   △听到这个名字，她眼眶一红。
 *   △他鼻子一酸，别开了脸。
 *   △泪水在她眼眶里打转。
 *   Her eyes welled up. / A single tear rolled down her cheek.
 * 弱档眼泪是 AI 的共情快捷键：不用铺悲情事件、不用写人物的挣扎，
 * 一行"眼眶一红"就宣布"这里该感动了"。第一次是生理反应，第三次
 * 起观众学会了一个规律——编剧要我们哭了。真眼泪贵在稀有：只在最
 * 重的那一拍落，其余时刻让人物把泪憋回去、擦干了去办事。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - emotion-vent-cliche：管强档宣泄四族（痛哭/嚎啕/嘶吼/跪求/自虐）
 *    的"最大音量拧死"，其 cry 词表不含弱档（眼眶一红/打转/滑落）；
 *    本引擎只收弱档泪信号的高频复用；
 *  - self-pity-litany：管苦难报告会独白（内容层的自怜），本引擎管
 *    生理反应的频次（形式层的泪点）；
 *  - emotion-prop-crutch：管道具外化（灌酒/淋雨/摔杯），本引擎管
 *    无道具的身体反应；
 *  - paren-overdirect：管台词行括号表演指示，本引擎只扫叙述行。
 *
 * 判定：
 *  - 弱档泪信号命中（眼眶一红/眼圈红了/眼睛一酸/鼻子一酸/泪水打转/
 *    眼泪滑落/噙着泪/水光/welled up/misty-eyed/a tear rolled down…）；
 *  - 相邻 2 行内的泪点视为同一次情绪（"眼睛一酸"→下一行"眼泪掉了
 *    下来"），不重复计；跨场景头重置；
 *  - 全片第 1、2 次豁免（生理反应正当），第 3 次起每次 1 hit；
 *  - rescue（±2 行内把泪收起来）：擦干/拭去/止住/憋回/逼回去/wipes
 *    her eyes/blinks them back——作者写了意志，眼泪没替人物说话；
 *  - 计分（结构性病，命中即成立）：n=1 → 70，每多 1 处 −20，封底 20；
 *    n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface TearBaitHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（把泪收起来，没让眼泪替人物说话） */
  rescued: boolean;
  reason: string;
}

export interface TearBaitResult {
  score: number;
  /** 泪点开关总次数（含豁免的前 2 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: TearBaitHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

/* 弱档泪信号（强档痛哭/嚎啕/夺眶而出归 emotion-vent-cliche，不收） */
const TEAR_ZH = /眼眶(?:一红|红了|微红|湿润)|眼圈(?:一红|红了)|红了(?:眼)?眶|眼睛一酸|鼻子一酸|(?:泪水|眼泪)[^，。；\n]{0,6}打转|眼泪(?:掉了下来|落了下来|滑落|顺着[^，。；\n]{0,6}滑)|一滴?(?:泪|眼泪)(?:落|掉|滑)(?:了下来|下)?|噙着泪|噙满泪|蓄满泪|泛起水光|蒙上一层水雾|眼底(?:泛|闪)着?泪/;

const TEAR_EN = /\b(?:eyes? (?:well(?:ed)? up|welled with tears|glisten(?:ed|ing)?|shimmer(?:ed|ing)?|grew moist|grew misty|went misty)|misty-eyed|mist(?:y|ed) over|tears? (?:prickl(?:ed|ing)|sting(?:ing)?|pool(?:ed|ing)|blur(?:red|ring))|a tear (?:fell|rolled|slipped|dripped|slid) down|blink(?:ed|ing)? back (?:the )?tears|red-rimmed eyes|tears (?:she|he) (?:wouldn'?t|refused to) shed)\b/i;

/* 救援：把泪收起来——擦干去办事，眼泪没替人物说话 */
const RESCUE_ZH = /擦(?:干|去|掉|了)?(?:眼角|眼眶|脸颊)?(?:的)?(?:眼泪|泪水|泪痕|泪)|拭(?:去|干|了)?(?:泪|眼角)|止住(?:了)?(?:泪|哭)|(?:把|将)?(?:泪水|眼泪|泪)逼回(?:去|了)?|逼回(?:去|了)?(?:泪|眼眶)|憋回(?:去|了)?(?:泪|眼泪)|把泪(?:擦|收|咽)/;

const RESCUE_EN = /\b(?:wipes? (?:her|his|the) (?:eyes|tears)|dries? (?:her|his) (?:eyes|tears)|brush(?:es|ed)? (?:the |her |his )?tears? (?:away|aside|from)|blink(?:s|ed)? (?:them )?back|forces? the tears back|swallows? (?:the )?tears)\b/i;

/**
 * 纯函数：检测"泪点开关"式弱档眼泪的高频复用。
 */
export function tearBait(draft: string): TearBaitResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const tearRe = zh ? TEAR_ZH : TEAR_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: TearBaitHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevTearLine = -10;

  const rawLines = text.split(/\r?\n/);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevTearLine = -10; return; }
    if (DIALOGUE_RE.test(line)) return; // 台词行括号表演归 paren-overdirect
    const m = line.match(tearRe);
    if (!m) return;
    /* 相邻 2 行内的泪点 = 同一次情绪（"眼睛一酸"→"眼泪掉了下来"），不重复计 */
    if (i - prevTearLine <= 2) { prevTearLine = i; return; }
    prevTearLine = i;

    hitCount += 1;
    if (hitCount >= 3) {
      /* ±2 行救援窗口：把泪收起来算作者写了意志 */
      const lo = Math.max(0, i - 2);
      const hi = Math.min(rawLines.length - 1, i + 2);
      const win = rawLines.slice(lo, hi + 1).join('\n');
      hits.push({
        line: i + 1,
        sceneIndex: Math.max(0, sceneIdx),
        sceneHeader: header,
        snippet: line.slice(0, 30),
        marker: (m[0] ?? '').slice(0, 28),
        rescued: rescueRe.test(win),
        reason: zh
          ? '又在拧泪点开关——不用铺悲情事件，一行"眼眶一红"就宣布这里该感动了'
          : 'the tear valve again — no grief built, just welling eyes announcing where the audience should feel',
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
      ? `${hitCount} 处弱档泪点（${n} 处未救）——需要共情就拧"泪点开关"，眼眶一红成了情绪的万能收据。`
      : `${hitCount} soft-tear beats (${n} unrescued) — every time empathy is due, out comes the welling eyes; the tear is a universal receipt for feeling.`);
    advice.push(zh
      ? '眼泪贵在稀有：全片只许在最重的一拍落泪，其余时刻让人物把泪憋回去——擦干了去签字、逼回去了继续谈判。共情靠事件不靠泪腺：先写她攒了什么、忍了什么、赔了什么，眼泪是压到极限后自己漏出来的那一滴，不是编剧点的外卖。弱档泪信号（眼眶一红/打转/滑落）一次不用也完全成立；真要用，写抵抗——她仰头把泪逼回去，声音稳得可怕，那比落泪疼十倍。'
      : 'Tears are expensive: allow exactly one moment of crying at the heaviest beat; everywhere else, have characters hold it back — wipe dry and go sign, force it down and keep negotiating. Empathy is earned by events, not glands: write what she saved, endured, and lost first; the tear leaks out at the breaking point — it is not ordered in by the writer. Soft-tear signals (welling eyes, misty look, a single rolling tear) can be skipped entirely; if you must use one, write resistance — she tilts her head back and forces the tears down, voice unnervingly steady. That hurts ten times more than crying.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
