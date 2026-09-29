import { isSceneHeaderLine } from './script-scenes';
/**
 * 道歉循环检测（v2.114 块122，创作能力类）
 * ------------------------------------------------------------------
 * 病象：加害方对同一受害人反复道歉却无具体赎罪行动——
 *   周父：晚晚，爸爸对不起你。
 *   周父：是我错了，你原谅爸爸好不好？
 *   周父：爸爸给你赔不是了，你就别再怪我了。
 *   FATHER: I'm sorry, Lily.
 *   FATHER: I was wrong. Please forgive me.
 *   FATHER: I apologize. Can't we just move on?
 * 第一次是冲突余波，病在它被当成万能缓冲阀：
 *  1) 道歉没有赎罪——只反复念"对不起"，没有自首、赔偿、退股、
 *     撤案等具体代价，戏靠道歉续气；
 *  2) 道歉不增信息——第二遍第三遍还是同一句"我错了"，台词零
 *     新信息，人物不长记性只长歉意；
 *  3) 道歉替代行动——观众每次以为他要赎罪了，结果只是又道歉
 *     一遍，把戏剧张力用一句话掏空。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - cheap-forgiveness：管加害人道歉→受害人立刻原谅（一次即
 *    生效，重点是受害方无代价原谅）；本引擎管道歉反复无效
 *    （≥3 次仍不被接受），重点是加害方空转道歉；
 *  - empty-vow：管被伤害者方向复仇宣言空转（"我要让他付出
 *    代价"），本引擎管伤害者方向道歉宣言空转（"我对不起你"），
 *    结构镜像、情感指向相反；
 *  - empty-threat：管冲突现场第二人称当面威胁，本引擎管加害
 *    方第一人称道歉，不重叠。
 *
 * 判定：
 *  - APO 词表命中 cue speech 句（对不起/抱歉/我错了/赔不是/
 *    原谅我/I'm sorry/I apologize/please forgive me 等）；
 *  - 同一场景内累计 ≥3 次道歉（3 次循环 = 1 hit）；
 *  - rescue 双通道：
 *    1) ACT 锚：场景内任意位置出现具体赎罪行动（自首/赔偿/退股/
 *       撤案/认罪/换药/surrender/compensate/return the shares
 *       等）→ 道歉落到了具体赎罪，rescue；
 *    2) TIME 锚：本场景头与上一场景头之间出现时间跨度（多年/
 *       数年/years later 等）→ 情感磨化或现实变迁，rescue。
 *
 * 计分：n=1 → 100（首次豁免，单场景合法情绪缓冲）；n=2 → 70；
 *     每多 1 hit −20，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ApologyLoopHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  speaker: string;
  snippet: string;
  marker: string;
  /** 是否被救援（道歉带具体赎罪行动或时间跨度磨化） */
  rescued: boolean;
  reason: string;
}

export interface ApologyLoopResult {
  score: number;
  hitCount: number;
  /** 计入计分的命中（未救援） */
  unrescuedCount: number;
  hits: ApologyLoopHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const CUE_ZH = /^([一-鿿A-Za-z0-9·]{1,8})(?:（[^）]{0,40}）)?\s*[：:]\s*(.+)$/;
const CUE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\((?:V\.?O\.?|O\.?S\.?|CONT(?:'?D)?|OFFSCREEN|FILTERED|ON THE PHONE|[^()]{0,40})\))?\s*:\s*(.+)$/;

/* 道歉锚（严格只收加害方第一人称道歉；复仇宣言归 empty-vow） */
const APO_ZH = /(?:对不起|抱歉|赔不是|赔罪|我错了|是我[的错]?不对|我有罪|原谅我|怪我|我的锅|都怪我|千错万错[^\n。！？]{0,8}我的错)/;
const APO_EN = /\b(?:i'?m sorry|i am sorry|i apologize|please forgive me|i was wrong|i owe you an apology|my fault|my mistake|i regret what i did|forgive me)\b/i;

/* 赎罪锚（道歉落到具体行动：自首/赔偿/退股/撤案/认罪/换药/退还） */
const ACT_ZH = /(?:自首|投案|去(?:警察局|派出所|公安局)|报警|立案|撤案|起诉|退股|转让(?:股权|股份)|退还|赔偿|赔付|补偿|赔钱|弥补|换药|出院|手术|认罪|认罚|坐牢|蹲监狱|进监狱|看守所|顶罪|黑锅|退位|让位|辞职|下台|引咎|公开道歉|记者会|发布会|登报|公告|认错声明)/;
const ACT_EN = /\b(?:turn(?:ed)? (?:myself|himself|herself) in|surrender(?:ed)?|go to the (?:police|cops)|press(?:ed)? charges|drop(?:ped)? the (?:charges|case)|sue|lawsuit|return(?:ed)? (?:the shares|the money|what i took|everything)|compensat\w*|reimburse\w*|pay (?:back|you back|them back)|make amends|make restitution|resign(?:ed)?|step(?:ped)? down|held a press conference|publicly apologiz\w*|issue(?:d)? a (?:statement|apology)|confess(?:ed)?|plead(?: guilty)?|serve(?:d)? time|went to (?:prison|jail))\b/i;

/* 时间跨度锚（情感磨化或现实变迁；英文数字与阿拉伯数字双认） */
const TIME_ZH = /(?:[一二两三四五六七八九十\d]+年(?:后|以后|过去|之后)|多年(?:后|以后|过去|之后)|数年(?:后|以后)|几年(?:后|以后)|[一二两三四五六七八九十\d]+个月后)/;
const TIME_EN = /\b(?:a year|one year|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+) years|months|several months)\s+(?:later|after|passed|passed by)\b/i;

interface SceneBlock {
  index: number;
  header: string;
  /** 正文第一行在全文的 0 基行号 */
  bodyStart: number;
  lines: string[];
}

/**
 * 纯函数：检测加害方反复道歉却无具体赎罪的求饶阀门。
 */
export function apologyLoop(draft: string): ApologyLoopResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);

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

  const apoRe = zh ? APO_ZH : APO_EN;
  const actRe = zh ? ACT_ZH : ACT_EN;
  const timeRe = zh ? TIME_ZH : TIME_EN;
  const cueRe = zh ? CUE_ZH : CUE_EN;

  const hits: ApologyLoopHit[] = [];
  let hitCount = 0;

  for (let s = 0; s < scenes.length; s++) {
    const scene = scenes[s];
    /* 收集本场景内所有 APO 命中 */
    const apoHits: { line: number; speaker: string; snippet: string; marker: string; localIdx: number }[] = [];

    scene.lines.forEach((raw, localIdx) => {
      const line = raw.trim();
      if (!line) return;
      const cue = cueRe.exec(line);
      if (!cue) return;
      const speaker = cue[1] ?? '';
      const speech = cue[2] ?? '';
      if (!speech) return;

      if (apoRe.test(speech)) {
        const matched = speech.match(apoRe);
        apoHits.push({
          line: scene.bodyStart + localIdx + 1,
          speaker,
          snippet: zh ? speech.slice(0, 30) : speech.slice(0, 60),
          marker: (matched?.[0] ?? '').slice(0, 28),
          localIdx,
        });
      }
    });

    /* 同场景 ≥3 次道歉 = 1 hit */
    if (apoHits.length >= 3) {
      /* 第 3 次道歉的行号作为 hit line（标志循环成立的临界点） */
      const third = apoHits[2];
      hitCount += 1;

      /* rescue 1: ACT 锚——场景内任意位置出现具体赎罪行动 */
      const sceneText = scene.lines.join('\n');
      const actRescued = actRe.test(sceneText);

      /* rescue 2: TIME 锚——本场景头与上一场景头之间出现时间跨度 */
      let timeRescued = false;
      if (s > 0) {
        const prevHeader = scenes[s - 1].header;
        const curHeader = scene.header;
        const headerGap = `${prevHeader}\n${curHeader}`;
        if (timeRe.test(headerGap)) timeRescued = true;
      }
      /* 也检查场景头本身含时间跨度 */
      if (!timeRescued && timeRe.test(scene.header)) timeRescued = true;

      const rescued = actRescued || timeRescued;

      hits.push({
        line: third.line,
        sceneIndex: scene.index,
        sceneHeader: scene.header,
        speaker: third.speaker,
        snippet: third.snippet,
        marker: third.marker,
        rescued,
        reason: rescued
          ? (actRescued
            ? (zh ? '道歉落在了具体赎罪行动上（自首/赔偿/退股/撤案等）' : 'the apology lands on a concrete act of atonement (surrender/restitution/return)')
            : (zh ? '时间跨度磨化了情感，是合法缓冲' : 'a span of time dilutes the feeling — a legitimate buffer'))
          : (zh ? '只反复念"对不起"没有赎罪：无自首、无赔偿、无退股，无法证伪的求饶阀门' : 'apology without atonement: no surrender, no restitution, no return — an unfalsifiable plea loop'),
      });
    }
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n <= 1 ? 100 : Math.max(20, 70 - (n - 2) * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 2) {
    issues.push(zh
      ? `${n} 处"对不起/我错了/原谅我"式道歉循环——单场景内反复道歉三次以上，却没有自首、赔偿、退股、撤案等具体赎罪行动，把戏剧张力用空话掏空。`
      : `${n} scenes contain 3+ "I'm sorry / I was wrong / forgive me" apologies with no surrender, no restitution, no return — the loop drains dramatic tension with empty words.`);
    advice.push(zh
      ? '删掉重复道歉，把歉意换成赎罪：要么这句台词里就点出代价（"我明天去派出所自首"），要么干脆别让人物说——观众看见他收拾行李去自首、把股权过户、写认罪声明，比听见一百遍"对不起"都重。同场景内道歉最多留一次，放在他真的承担代价的那个节点。'
      : 'Cut the repeated apologies and replace regret with atonement: either name the cost inside the line ("I\'m going to the police station tomorrow"), or keep him silent — watching him pack for surrender, transfer the shares, or sign a confession hits harder than a hundred "I\'m sorry". Allow one apology per scene, at the moment he actually bears the cost.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
