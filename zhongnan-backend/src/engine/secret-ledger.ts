/**
 * v2.80 跨集信息差台账引擎（Secret & Reveal Ledger）——秘密与揭示的场记本
 * ------------------------------------------------------------------
 * 短剧的发动机是秘密：身世/怀孕/卧底/遗嘱……观众追的就是"谁瞒着谁、哪一集揭穿"。
 * 与既有引擎的分工（避免重复）：
 *  - foreshadow-ledger：器物/暗示的"伏笔账本"（种了没收、空回收）
 *  - misunderstanding-drag-check：单本内误会拖沓的节奏问题
 *  - 本引擎（v2.80）：跨集"秘密账本"——
 *    1) secret_dangling   悬空秘密：前集植入（瞒着/不能说），已跨 2 集仍未揭示（挖坑不填）
 *    2) reveal_amnesia    揭示失忆：主题已当众揭穿，后续集又按"还瞒着"写（连续性硬伤）
 *    3) reveal_pacing     节奏失衡：秘密≥3 且全篇 0 揭示
 *    4) no_secret         无处着力：连载中既无植入也无揭示，信息差无处发力
 * 离线启发式（纯函数、零 IO、可离线对拍）：
 *  事件判定 = 行内同时命中【主题锚点】×【信号短语】双条件，压低单词误报；
 *  跨集状态由调用方累积传递（prevLedger 模式，与 foreshadow-ledger 同构），
 *  引擎直接返回 nextState 供调用方持久化到 qcReport、下一集精确读取。
 * 中英双语：中文层为单一事实源，英文层零中文（由测试守护）。
 */

export type SlLang = 'zh' | 'en';

export interface SecretEvent {
  kind: 'plant' | 'reveal';
  /** 秘密主题锚点（身世/怀孕/卧底…，取自 TOPICS 词表） */
  topic: string;
  /** 命中的信号短语 */
  signal: string;
  /** 行号（1 基） */
  lineNo: number;
  /** 原文片段（前后约 20 字） */
  snippet: string;
}

export interface SecretLedgerIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'secret_dangling' | 'reveal_amnesia' | 'reveal_pacing' | 'no_secret';
  evidence: string;
  advice: string;
}

export interface SecretLedgerResult {
  /** 本集新植入的秘密事件 */
  plants: SecretEvent[];
  /** 本集揭示事件 */
  reveals: SecretEvent[];
  /** 悬空秘密：前集植入、至今未揭示且已跨 2 集 */
  dangling: { topic: string; plantedInEp: number; ageEp: number; snippet: string }[];
  /** 揭示失忆：前集已揭示的主题，本集又出现对该主题的"隐瞒"写法 */
  amnesia: { topic: string; revealedInEp: number; signal: string; snippet: string }[];
  score: number;
  issues: SecretLedgerIssue[];
  /** 累积后的账本状态（调用方原样持久化，下一集作为 prev 传入） */
  nextState: {
    plants: { topic: string; plantedInEp: number; snippet: string }[];
    revealedTopics: string[];
    epNo: number;
  };
}

// —— 中文主题锚点（只用多字词，避免单字误伤；与 foreshadow 器物锚点分工，不收器物） ——
const TOPICS_ZH = [
  '身世', '亲生', '私生子', '怀孕', '有孕', '身孕', '婚约', '退婚',
  '卧底', '内鬼', '遗嘱', '遗产', '破产', '欠债', '绝症', '癌症',
  '收养', '养子', '养女', '替身', '双胞胎', '假身份', '前科', '掉包', '错抱',
];
// —— 中文植入信号（瞒/藏/不能说） ——
const PLANT_ZH = [
  /瞒着/g, /隐瞒/g, /秘密/g, /千万别说/g, /打死也不(?:能)?说/g, /烂在肚子里/g,
  /守口如瓶/g, /不敢说/g, /一直瞒/g, /不能让[^，。；？！\n]{0,8}知道/g,
  /瞒了/g, /藏了(?:这么|那么)多年/g, /骗了[^，。；？！\n]{0,6}(他|她|我|你|大家)/g,
];
// —— 中文揭示信号（揭穿/摊牌/坦白） ——
const REVEAL_ZH = [
  /揭穿/g, /拆穿/g, /摊牌/g, /坦白/g, /说破/g, /戳穿/g, /挑明/g,
  /当众揭露/g, /曝光/g, /真相大白/g, /原形毕露/g, /纸包不住火/g,
  /承认了/g, /供认/g, /全招了/g, /真相当众/g, /秘密公开/g,
];

// —— 英文层（零中文） ——
const TOPICS_EN = [
  'birth secret', 'birth', 'pregnan', 'engagement', 'undercover', 'mole',
  'will', 'inheritance', 'bankrupt', 'debt', 'terminal', 'cancer',
  'adopted', 'adoption', 'twin', 'fake identity', 'criminal record', 'swapped', 'affair',
];
const PLANT_EN = [
  /hid(?:e|ing)? it from/gi, /kept it from/gi, /keep (?:it )?hidden/gi, /never told/gi,
  /\bkeep(?:ing)?\b[^.,!?]{0,15}\bsecrets?\b/gi, /\bkept\b[^.,!?]{0,15}\bsecrets?\b/gi,
  /can'?t let[^.,!?]{0,20}know/gi, /sworn to secrecy/gi, /don'?t tell/gi,
];
const REVEAL_EN = [
  /exposed/gi, /expose[ds]/gi, /confessed/gi, /confession/gi, /came clean/gi,
  /truth is out/gi, /truth came out/gi, /revealed the truth/gi, /blew (?:the )?cover/gi, /called (?:him|her|them) out/gi,
];

function snippetOf(line: string, index: number): string {
  const start = Math.max(0, index - 15);
  return line.slice(start, Math.min(line.length, index + 30));
}

function scanEvents(
  lines: string[], kind: 'plant' | 'reveal', topics: string[], signals: RegExp[],
): SecretEvent[] {
  const out: SecretEvent[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hitTopics = topics.filter((t) => line.includes(t));
    if (!hitTopics.length) continue;
    for (const sig of signals) {
      sig.lastIndex = 0;
      const m = sig.exec(line);
      if (!m) continue;
      out.push({ kind, topic: hitTopics[0], signal: m[0], lineNo: i + 1, snippet: snippetOf(line, m.index ?? 0) });
      break; // 每行每类只记一次，防同义信号刷计数
    }
  }
  return out;
}

/**
 * 扫描本集并对照前集账本，输出悬空/失忆/节奏三检 + 累积 nextState。
 * prev 为 null 时按首集处理（epNo=1），不做悬空/失忆判定。
 */
export function secretLedger(
  text: string,
  prev?: { plants: { topic: string; plantedInEp: number; snippet: string }[]; revealedTopics: string[]; epNo: number } | null,
  lang: SlLang = 'zh',
): SecretLedgerResult {
  const isZh = lang !== 'en';
  const lines = text.split('\n');
  const topics = isZh ? TOPICS_ZH : TOPICS_EN;
  const plantSigs = isZh ? PLANT_ZH : PLANT_EN;
  const revealSigs = isZh ? REVEAL_ZH : REVEAL_EN;
  const plants = scanEvents(lines, 'plant', topics, plantSigs);
  const reveals = scanEvents(lines, 'reveal', topics, revealSigs);

  const curEp = prev ? prev.epNo + 1 : 1;
  const revealedTopics = new Set<string>([...(prev?.revealedTopics ?? []), ...reveals.map((r) => r.topic)]);

  // 悬空：前集植入、主题从未揭示、已跨 2 集
  const dangling: SecretLedgerResult['dangling'] = [];
  for (const p of prev?.plants ?? []) {
    if (revealedTopics.has(p.topic)) continue;
    const ageEp = curEp - p.plantedInEp;
    if (ageEp >= 2) dangling.push({ topic: p.topic, plantedInEp: p.plantedInEp, ageEp, snippet: p.snippet });
  }

  // 揭示失忆：前集已揭示的主题，本集又出现"隐瞒"写法
  const amnesia: SecretLedgerResult['amnesia'] = [];
  for (const p of plants) {
    if (prev?.revealedTopics?.includes(p.topic)) {
      amnesia.push({ topic: p.topic, revealedInEp: prev.epNo, signal: p.signal, snippet: p.snippet });
    }
  }

  // 累积 nextState：已揭示主题的植入移出待收池；植入池上限 40 防膨胀
  const resolvedTopics = new Set(reveals.map((r) => r.topic));
  const carriedPlants = (prev?.plants ?? []).filter((p) => !revealedTopics.has(p.topic) && !resolvedTopics.has(p.topic));
  const newPlants = plants
    .filter((p) => !revealedTopics.has(p.topic))
    .map((p) => ({ topic: p.topic, plantedInEp: curEp, snippet: p.snippet }));
  const nextState = {
    plants: [...carriedPlants, ...newPlants].slice(0, 40),
    revealedTopics: [...revealedTopics],
    epNo: curEp,
  };

  // 评分：悬空/失忆扣分；全篇零揭示但秘密多 → 节奏失衡
  let score = 100;
  const danglingPen = Math.min(40, dangling.length * 12);
  const amnesiaPen = Math.min(45, amnesia.length * 15);
  const totalPlants = nextState.plants.length;
  const totalReveals = (prev ? 0 : 0) + reveals.length; // 揭示按本集计（历史揭示已使对应主题出池）
  const pacingPen = totalPlants >= 3 && totalReveals === 0 && (prev?.revealedTopics?.length ?? 0) === 0 ? 15 : 0;
  score = Math.round(Math.max(0, Math.min(100, score - danglingPen - amnesiaPen - pacingPen)));

  // 问题清单（本地化）
  const issues: SecretLedgerIssue[] = [];
  if (dangling.length >= 2 || dangling.some((d) => d.ageEp >= 3)) {
    issues.push({
      severity: 'high', type: 'secret_dangling',
      evidence: isZh
        ? `${dangling.length} 个秘密悬空≥2集：${dangling.map((d) => `${d.topic}(第${d.plantedInEp}集植入)`).join('、')}`
        : `${dangling.length} secret(s) unresolved for 2+ episodes: ${dangling.map((d) => `${d.topic} (planted ep${d.plantedInEp})`).join(', ')}`,
      advice: isZh
        ? '观众没等来揭穿就会弃剧。要么在最近 1-2 集安排当众揭穿（摊牌/对峙/证据甩脸），要么给一个"差一点揭穿"的擦肩钩子维持期待，不许无声烂尾。'
        : 'Viewers churn when a secret never lands. Stage a public reveal within 1-2 episodes (confrontation / evidence thrown on the table), or a near-miss tease to keep the tension alive — never let it quietly die.',
    });
  } else if (dangling.length === 1) {
    issues.push({
      severity: 'mid', type: 'secret_dangling',
      evidence: isZh ? `1 个秘密悬空：${dangling[0].topic}（第${dangling[0].plantedInEp}集植入，已${dangling[0].ageEp}集）` : `1 unresolved secret: ${dangling[0].topic} (planted ep${dangling[0].plantedInEp}, ${dangling[0].ageEp} ep ago)`,
      advice: isZh ? '该秘密已悬 2 集，尽快安排揭示或强化"随时会爆"的擦肩戏，避免挖坑不填。' : 'This secret has hung for 2 episodes — stage the reveal soon or a near-miss scene to keep it hot.',
    });
  }
  if (amnesia.length >= 2) {
    issues.push({
      severity: 'high', type: 'reveal_amnesia',
      evidence: isZh
        ? `${amnesia.length} 个已揭穿主题又被当秘密写：${amnesia.map((a) => `${a.topic}(第${a.revealedInEp}集已揭示)`).join('、')}`
        : `${amnesia.length} already-revealed topic(s) treated as hidden again: ${amnesia.map((a) => `${a.topic} (revealed ep${a.revealedInEp})`).join(', ')}`,
      advice: isZh
        ? '真相已经当众揭开，后续不能再出现"瞒着/不能说"的写法——揭穿后要么写关系重排（清算/反目/将计就计），要么引入新秘密，别让信息差原地复活。'
        : 'The truth is already public — no more hiding beats. Move to fallout (reckoning, falling-out, counter-scheme) or plant a NEW secret; never resurrect a dead information gap.',
    });
  } else if (amnesia.length === 1) {
    issues.push({
      severity: 'mid', type: 'reveal_amnesia',
      evidence: isZh ? `1 处揭示失忆：${amnesia[0].topic}（第${amnesia[0].revealedInEp}集已当众揭示，本集又写"${amnesia[0].signal}"）` : `1 reveal amnesia: ${amnesia[0].topic} (revealed ep${amnesia[0].revealedInEp}) treated as hidden again`,
      advice: isZh ? '该主题第' + amnesia[0].revealedInEp + '集已揭穿，本集的隐瞒写法与之冲突，请改为揭穿后的关系清算或删掉。' : `Topic "${amnesia[0].topic}" was revealed in ep${amnesia[0].revealedInEp}; rewrite the hiding beat as post-reveal fallout or cut it.`,
    });
  }
  if (pacingPen > 0) {
    issues.push({
      severity: 'mid', type: 'reveal_pacing',
      evidence: isZh ? `秘密植入 ${totalPlants} 处而全篇揭示为 0` : `${totalPlants} secrets planted, 0 reveals so far`,
      advice: isZh
        ? '只挖坑不填坑，观众会判定"注水拖更"。每 3-4 集至少揭穿 1 个秘密（小揭穿也行），用"揭示→新麻烦"的节奏滚动推进。'
        : 'All plant and no payoff reads as padding. Land at least one reveal every 3-4 episodes (a small one counts) and roll "reveal → new trouble" forward.',
    });
  }
  if (plants.length === 0 && reveals.length === 0 && prev) {
    issues.push({
      severity: 'low', type: 'no_secret',
      evidence: isZh ? '本集既无秘密植入也无揭示' : 'No secret planted or revealed in this episode',
      advice: isZh ? '连载集全靠信息差拉追更：至少埋 1 个新秘密（一句台词即可）或推进 1 个旧秘密的揭示。' : 'Serialization runs on information gaps: plant at least one new secret (one line suffices) or advance an old one.',
    });
  }

  return { plants, reveals, dangling, amnesia, score, issues, nextState };
}
