import { isSceneHeaderLine } from './script-scenes';
/**
 * 看一眼破案检测（v2.80 块87，创作能力类）
 * ------------------------------------------------------------------
 * 病象：线索链难写就跳过——主角到了现场扫一眼、翻两张照片，
 * 就当场宣布"我知道凶手是谁了"：
 *   △他环视了一圈现场："我明白了。"
 *   △她盯着照片看了几秒："全都对上了，凶手就是他。"
 *   He glanced around the room. "It all makes sense. I know who did it."
 * 观察成了万能解码器：从"看"到"真相"之间没有任何推理步骤、
 * 没有具体物证，聪明全靠嘴宣布。第一次是灵光，第三次起主角
 * 就是一台人形答案机——观众看到的是编剧把结论塞进他嘴里，
 * 而不是他自己想明白的。推理的价值在路径不在终点：哪怕最后
 * 结论正确，零过程破案也是假的。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - mind-reading-narration：管叙述层认知动词直报（"她突然
 *    明白了/realized"被旁白直接说出，叙述技巧病），本引擎管
 *    情节层的"观察×解谜强断言"零成本破案（结构病），情感领悟
 *    （明白了他的苦心）两边都不收；
 *  - causal-logic-check：管泛巧合推进与机械降神（恰好/碰巧/
 *    救兵天降），本引擎管"人形答案机"——主角自己零路径下结论；
 *  - investigation-craft：管侦查题材的知识框架（fair play、
 *    证据链原则），不做逐行病象检测；
 *  - villain-overconfession：管反派被质问后不打自招，本引擎
 *    管主角自己看一眼就懂。
 *
 * 判定：
 *  - 观察锚点命中（扫了一眼/环视/打量/勘察/glanced around/
 *    surveyed/studied…），且 ±2 行窗口内出现解谜强断言
 *    （我知道了/凶手就是/全都对上了/破案了/it all makes
 *    sense/I know who did it…）——纯观察、纯结论各自单飞放行；
 *  - 窗口内出现具体线索 payload（指纹/血迹/监控/账本/日期/
 *    fingerprint/report/receipt…）→ 放行：看到了具体物证，
 *    结论有据，不是零成本；
 *  - 相邻 2 行内的观察表述视为同一次观察，不重复计；跨场景
 *    头重置，各算一次；
 *  - 第 1 次豁免（一次灵光合法），第 2 次起每次 1 hit；
 *  - rescue（±2 行出现不下结论/去验证）：还得查/没有证据/调
 *    监控/找他当面对质/need to check/can't be sure——主角没
 *    当场定论；
 *  - 计分（结构性病，命中即成立）：n=1 → 70，每多 1 处 −20，
 *    封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantDeductionHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（不下结论/有具体物证/去验证） */
  rescued: boolean;
  reason: string;
}

export interface InstantDeductionResult {
  score: number;
  /** 零成本破案总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantDeductionHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 观察锚点：泛观察/浏览/勘察（不含结果） */
const OBSERVE_ZH = /扫了[^，。；\n]{0,4}眼|扫视|环视(?:一圈|四周|全场)?|打量|端详|看(?:了)?[^，。；\n]{0,3}(?:一圈|几眼|一眼)|目光[^，。；\n]{0,6}(?:扫过|掠过|移动)|盯着[^，。；\n]{0,8}看了|勘察|查看|翻看|翻着|盯着(?:照片|资料|文件|卷宗|图纸|地图)/;

const OBSERVE_EN = /\b(?:glanc(?:ed|ing|es)?\s+(?:around|over|at the (?:scene|room|photos|maps?|(?:lab |autopsy |case |old )?(?:report|file|folder|photograph|letter|note|ledger|document|paper|screen|board)))|look(?:ed|ing)?\s+around|survey(?:ed|ing)|scann(?:ed|ing)|studied|studying|examined|examining|looked\s+(?:the scene|the room|everything|the photos)\s+over|took in the (?:scene|room)|one look|a quick look|eyes?\s+swept|pored over)\b/i;

/* 解谜强断言：信息解谜型结论（情感领悟不收） */
const CONCLUDE_ZH = /我知道了|我知道(?:凶手|是谁|真相|怎么回事)|我明白(?:了)?(?:了|这一切|是怎么回事)|全明白了|全都?对上了|对上号了|串起来了|一切都?通了|破案了|真相(?:就)?是|凶手(?:就)?是|下(?:手|毒|套)(?:的|之人)就是|原来如此|答案(?:就)?是|我想到了|谜底/;

const CONCLUDE_EN = /\b(?:i know(?:n)?\s+(?:who\s+(?:did\s+(?:it|this)|killed|they\s+are)|what\s+happened|the\s+answer)|i'?ve\s+got\s+it|it\s+all\s+makes\s+sense|everything\s+makes\s+sense|so\s+that'?s\s+it|that'?s\s+the\s+answer|it\s+(?:all\s+)?(?:fits|adds\s+up)|case\s+closed|the\s+(?:killer|murderer|thief|impostor|poisoner)\s+is|so\s+it\s+was\s+(?:him|her|them)|now\s+(?:i\s+see|everything(?:'?s)?\s+clear)|all\s+the\s+pieces\s+(?:fit|came\s+together))\b/i;

/* 线索 payload：窗口内有具体物证 → 结论有据，放行 */
const CLUE_ZH = /指纹|血迹|伤口|凶器|监控|录像|照片里|档案|账本|笔迹|登记|名单|日期|签?名|字条|遗书|录音|票根|发票|通话记录|车票|脚印|烟头|泥土|纤维|药瓶|毒物|检验|报告|鉴定|卷宗里|资料里|文件里/;

const CLUE_EN = /\b(?:fingerprint|blood(?:stain)?|wound|weapon|camera|footage|recording|photo|photograph|file|record|ledger|handwriting|signature|receipt|ticket|footprint|fiber|toxicology|autopsy|lab report|alibi|timestamp|the (?:date|name|number) (?:on|in) the)\b/i;

/* rescue：主角没当场定论 */
const RESCUE_ZH = /还得?(?:查|翻|调|核)|再查(?:查)?|需要?(?:核实|验证)|(?:回去|回头)(?:查|翻|调)|调(?:取)?监控|找[^，。；\n]{0,6}(?:核实|对质|确认)|不能?下定论|先别?(?:下结论|急着)|没有?(?:证据|实锤)|不敢肯定|说不准/;

const RESCUE_EN = /\b(?:need(?:s)?\s+to\s+(?:check|verify|confirm|dig)|have\s+to\s+(?:check|verify)|let\s+me\s+(?:check|verify|dig)|back\s+to\s+the\s+(?:records|files|archives)|pull(?:ing)?\s+the\s+(?:footage|records)|no\s+proof(?:\s+yet)?|not\s+enough\s+evidence|can'?t\s+be\s+sure|don'?t\s+jump\s+to\s+conclusions)\b/i;

/**
 * 纯函数：检测"看一眼就宣布真相"式零成本破案套路。
 */
export function instantDeduction(draft: string): InstantDeductionResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const observeRe = zh ? OBSERVE_ZH : OBSERVE_EN;
  const concludeRe = zh ? CONCLUDE_ZH : CONCLUDE_EN;
  const clueRe = zh ? CLUE_ZH : CLUE_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: InstantDeductionHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevObsLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevObsLine = -10; return; }
    const m = line.match(observeRe);
    if (!m) return;
    /* 相邻 2 行内的观察表述 = 同一次观察（"扫了一眼"+"目光移动"），不重复计 */
    if (i - prevObsLine <= 2) { prevObsLine = i; return; }
    prevObsLine = i;

    /* 强断言检查：±2 行窗口内须出现解谜结论，纯观察放行 */
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    /* 场景头不参与物证判定（"内景 档案室"的"档案"不是现场物证） */
    const win = rawLines.slice(lo, hi + 1).filter((l) => !isSceneHeaderLine(l.trim())).join('\n');
    if (!concludeRe.test(win)) return;
    /* 线索 payload：窗口内有具体物证 → 结论有据，放行 */
    if (clueRe.test(win)) return;

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
          ? '又在"看一眼破案"——从观察到真相之间零推理、零物证，主角成了人形答案机，结论是编剧塞进他嘴里的'
          : 'instant deduction again — zero reasoning, zero evidence between the glance and the verdict, the detective is a human answer machine fed lines by the writer',
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
      ? `${hitCount} 处"看一眼破案"式零成本推理（${n} 处未救）——从观察到真相之间没有推理路径，聪明全靠嘴宣布。`
      : `${hitCount} instant-deduction beats (${n} unrescued) — the leap from glance to verdict has no reasoning path; brilliance is announced, not earned.`);
    advice.push(zh
      ? '推理的价值在路径不在终点。把"看一眼就懂"拆成看得见的三步：先让他在具体物证前停下（"这只手表"——死者是左撇子，表却戴右手），再给一个错误假设被推翻的瞬间（他以为是情杀，直到查到那通半夜来电），最后让结论从他自己嘴里以不确定的语气落地（"除非……她根本没离开过这栋楼"）。每一次破案至少付出一次代价：跑一趟、错抓一个人、被上司骂越权；没有成本的聪明是编剧的聪明，不是人物的。真要保留灵光一现，就写清触发物——他不是凭空懂的，是死者袖口那道陈年烫伤让他想起了旧案卷宗里的照片。'
      : 'The value of deduction is the path, not the verdict. Break the glance-into-truth leap into three visible steps: stop him at a concrete clue (the watch — the victim was left-handed, yet it sits on the right), let a wrong hypothesis get overturned (he calls it a crime of passion, until the midnight phone record surfaces), and land the conclusion in an uncertain voice ("unless... she never left this building"). Every solution must cost something: a wasted trip, a wrongful arrest, a reprimand for overstepping. Brilliance without cost is the writer\'s brilliance, not the character\'s. Keep the flash of insight only if you show the trigger — he understands because the old burn scar on the victim\'s cuff matched a photo from the cold-case file.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
