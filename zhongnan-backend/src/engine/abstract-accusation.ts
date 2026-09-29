import { isSceneHeaderLine } from './script-scenes';
/**
 * 全称指控吵架检测（v2.80 块78，创作能力类）
 * ------------------------------------------------------------------
 * 病象：角色吵架不下事实，只甩全称判断——
 *   林晚：你从来都这样！
 *   林晚：你心里从来只有公司！
 *   林晚：每次都是我让步，你永远不会改！
 *   LINNA: You never care about me!
 *   LINNA: All you ever care about is work. Every single time!
 * 全称句是 AI/新手写冲突的默认句式，三个硬伤：
 *  1) 无法证实也无法证伪——对方只能否认（"我没有"）或道歉，戏原地打转；
 *  2) 没有具体事件就没有画面，观众无从站队，情绪没有落点；
 *  3) 它是情绪标签不是指控，真正扎人的吵架用细节当刀子
 *     （"上周三家长会，你人在哪？""那晚在医院签字的只有我"）。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - mind-reading-narration：管叙述行的抽象认知（"她意识到自己从来……"），
 *    本引擎只扫台词中第二人称的全称指控；
 *  - emotion-label-dialogue：管直接喊情绪名（"我好难过"），本引擎管指责句；
 *  - emotion-vent-cliche：管自怜控诉清单，本引擎管两人争吵的空泛；
 *  - pingpong：管机械问答结构，不管指控内容有没有事实。
 *
 * 判定（按场切分，扫台词 speech）：
 *  - UNIVERSAL：你从来/总是/一直/永远不…、每次都是、你心里只有…、
 *    you never/you always/all you ever/every single time；
 *  - 命中句前后 4 行（同场，叙述行也算）出现具体事实锚点
 *    （那天/上周三/家长会/合同/医院/监控/金额/日期…）→ anchored 豁免：
 *    有事实的吵架是好写法，用全称开场但对方甩细节回击也豁免；
 *  - 同稿未锚定的全称指控 ≥2 句才判（情绪上头甩一次"你从来不"是生活话）。
 * 计分：n=2 → 70；此后每多 1 句 −20，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface AbstractAccusationHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  /** ±4 行内是否有具体事实锚点（有则豁免） */
  anchored: boolean;
  /** 命中的全称词 */
  marker: string;
  reason: string;
}

export interface AbstractAccusationResult {
  score: number;
  /** 全部全称指控命中数 */
  universalCount: number;
  /** 无事实锚点的指控数（计分依据） */
  unrescuedCount: number;
  hits: AbstractAccusationHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const CUE_ZH = /^([一-鿿A-Za-z0-9·]{1,8})(?:（[^）]{0,40}）)?\s*[：:]\s*(.+)$/;
const CUE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\((?:V\.?O\.?|O\.?S\.?|CONT(?:'?D)?|OFFSCREEN|FILTERED|ON THE PHONE|[^()]{0,40})\))?\s*:\s*(.+)$/;

/* 第二人称全称指控（必须是冲"你"去的，叙述行"她从来……"不匹配） */
const UNIVERSAL_ZH = [
  /你(?:从来|一直|总是|老是|永远|根本)(?:也|都)?(?:不|没|没有|不肯|不愿|只会)/,
  /你(?:(?:从来|一直|总是|老是|永远)(?:也|都)?|都|也)这样/,
  /每次都(?:是|要|得|轮)/,
  /每一次都/,
  /你心里只有/,
  /你这辈子(?:都|也)?不?会?/,
  /你就知道/,
  /说过(?:多少遍|几百遍)了?/,
  /你又来这一套/,
];
const UNIVERSAL_EN = [
  /\byou (?:never|always)\b/i,
  /\byou'?ve? (?:got )?never\b/i,
  /\ball you (?:ever )?(?:care|think|do|want|talk) (?:about )?(?:is|about)\b/i,
  /\bevery (?:single )?time\b/i,
  /\byou never once\b/i,
  /\byou (?:can|will|could) never\b/i,
  /\b(?:men|women|people) like you never\b/i,
];

/* 具体事实锚点：时间/地点/物件/事件名/数字——吵架时甩出来的证据 */
const ANCHOR_ZH = /(?:那天|昨日?|前夜?|前天|今晚|今[早午晚]|刚[才刚]|上周|上(?:回|次|个)(?:周|月)?|这(?:回|次)|那晚|那[一二三四五六七八九十两\d]+次|几点|[一二三四五六七八九十两\d]+点|[一二三四五六七八九十两\d]+分(?:钟)?|\d+[%％]|[\d一二三四五六七八九十两千万亿]+[块元万千百]|合同|医院|学校|家长会|手术|病房|监控|录音|录像|视频|照片|聊天记录|短信|朋友圈|机场|车[站场]|生日|结婚纪念|纪念日|酒店|门口|楼下|办公室|车库|病房|保单|遗嘱|亲子鉴定|验伤|报警回执|辞退信|离婚协议)/;
const ANCHOR_EN = /\b(?:that day|that night|last night|yesterday|the night before|this morning|just now|last week|last month|last (?:mon|tues|wednes|thurs|fri|satur|sun)day|the \d{1,2}(?:st|nd|rd|th)?|at \d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?|o'?clock)?|\d+\s?(?:minutes?|hours?|days?|weeks?|months?|years?) (?:ago|late)|\d+\s?%|million|billion|thousand|the contract|the hospital|school|recital|surgery|ward|CCTV|footage|recording|the tape|photo|texts?|messages?|the airport|station|birthday|anniversary|the hotel|downstairs|the office|garage|insurance|the will|paternity test|police report|divorce papers)\b/i;

interface SceneBlock {
  index: number;
  header: string;
  /** 正文第一行在全文的 0 基行号 */
  bodyStart: number;
  lines: string[];
}

/**
 * 纯函数：检测对白中的无事实全称指控。
 */
export function abstractAccusation(draft: string): AbstractAccusationResult {
  const text = draft ?? '';
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);

  /* 按场切块（无场景头时全文归一场） */
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

  const universalRes = zh ? UNIVERSAL_ZH : UNIVERSAL_EN;
  const anchorRe = zh ? ANCHOR_ZH : ANCHOR_EN;
  const cueRe = zh ? CUE_ZH : CUE_EN;

  const hits: AbstractAccusationHit[] = [];
  let universalCount = 0;

  for (const scene of scenes) {
    scene.lines.forEach((raw, localIdx) => {
      const line = raw.trim();
      if (!line) return;
      const cue = cueRe.exec(line);
      if (!cue) return;
      const speech = cue[2] ?? '';
      if (!speech) return;

      /* 按句切分，逐句找全称词 */
      const sentences = zh
        ? speech.split(/[。！？!?…，,；;]+/).map((s) => s.trim()).filter(Boolean)
        : speech.split(/[.!?…,;]+/).map((s) => s.trim()).filter(Boolean);

      for (const sent of sentences) {
        const re = universalRes.find((r) => r.test(sent));
        if (!re) continue;
        const matched = sent.match(re);
        universalCount += 1;

        /* ±4 行同场窗口找事实锚点（台词、叙述行均可） */
        const lo = Math.max(0, localIdx - 4);
        const hi = Math.min(scene.lines.length - 1, localIdx + 4);
        let anchored = false;
        for (let j = lo; j <= hi; j += 1) {
          if (anchorRe.test(scene.lines[j])) {
            anchored = true;
            break;
          }
        }
        hits.push({
          line: scene.bodyStart + localIdx + 1,
          sceneIndex: scene.index,
          sceneHeader: scene.header,
          snippet: zh ? sent.slice(0, 30) : sent.slice(0, 60),
          anchored,
          marker: (matched?.[0] ?? '').slice(0, 24),
          reason: anchored
            ? (zh ? '全称指控但有具体事实兜底' : 'universal accusation anchored by a concrete fact')
            : (zh ? '全称判断零事实，对方只能否认或道歉，戏原地打转' : 'universal verdict with zero facts; the other side can only deny or apologize'),
        });
      }
    });
  }

  const unrescued = hits.filter((h) => !h.anchored);
  const n = unrescued.length;
  const score = n === 0 ? 100 : n === 1 ? 100 : Math.max(20, 70 - (n - 2) * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 2) {
    issues.push(zh
      ? `${n} 句吵架只有全称判断（从来/总是/每次/永远），没有一个具体事实——观众无从站队，对手也无从反驳。`
      : `${n} fighting lines deliver only universal verdicts (never/always/every time) with no concrete fact — the audience cannot pick a side and the opponent cannot rebut.`);
    advice.push(zh
      ? '把全称句换成一次具体事件的指控：时间、地点、物件任选其一当刀子——不是"你从来不管家"，而是"上周三家长会，座位上又是空的"。情绪最满的那句之前，先让一个细节落地；被指责的一方也用事实回击（"那晚我在医院签的字"），吵架才会往前推进。'
      : 'Replace the universal verdict with one specific event: a time, a place, or an object as the knife — not "you never care about this family" but "last Wednesday at the recital, your seat was empty again". Before the angriest line, land one concrete detail; let the accused fire a fact back ("I was signing papers at the hospital that night"), so the fight moves somewhere.');
  }

  return { score, universalCount, unrescuedCount: n, hits, issues, advice };
}
