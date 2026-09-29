import { isSceneHeaderLine } from './script-scenes';
/**
 * 强离场收尾依赖检测（v2.80 块74，创作能力类）
 * ------------------------------------------------------------------
 * 病象：每场冲突吵到顶点，编剧不知道怎么收，就让人摔门走——
 *   场1：……林晚抓起包，摔门而去。
 *   场2：……沈志国冷笑一声，夺门而出。
 *   场3：……她头也不回地冲出办公室，门在身后砰地关上。
 * 第一次是气势，第二次是套路，第三次观众明白：这个编剧只会用"走人"
 * 给场景打句号。场景的末拍本该落在牌桌上（物证、未答之问、新威胁、
 * 半截决定），离场是把牌桌整个掀了，能量随人物一起离场，下一场还得
 * 重新点火。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - scene-soft-ending：抓【软离场】（叹气/默默转身/轻轻带门），其注释
 *    明确"摔门/夺门是强能量收尾，不判"；本引擎专抓【强离场套路】，
 *    且只在"≥2 个非末场的末拍都落在同一类摔门动作"时才判；
 *  - repetition-check：全稿动词频次（摔出现 4 次），不看"场景末拍槽位"；
 *  - cliffhanger：管全集末场；本引擎显式跳过末场（末场归钩子评分）；
 *  - hollow-action：管场内空心动作密度，不管场景靠什么打句号。
 *
 * 豁免：
 *  - 末拍虽有离场，但最后一行落在钩子信号上（手机亮/未读短信/门被踹开/
 *    新人物出声/phone buzzed…）——场景实际句号是钩子，不是摔门；
 *  - 全场只有 1 次强离场（单次可能是情绪最高点，不构成依赖）。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ExitClicheHit {
  sceneHeader: string;
  sceneIndex: number;
  endLine: number;
  closer: string;
  /** 该收尾词是否与其他命中场完全同款（同款重复更差） */
  repeatedPhrase: boolean;
  reason: string;
}

export interface ExitClicheResult {
  score: number;
  sceneCount: number;
  checkedScenes: number;
  hits: ExitClicheHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 强离场收尾：摔门/夺门/拂袖/头也不回/storm/slam */
const EXIT_ZH = /(?:摔门(?:而(?:去|离|走))?|夺门(?:而)?(?:出|去|走)|拂袖(?:而)?去|转身就走|扭头就走|起身就走|抓起?(?:包|外套|文件)[^\n。！？!?]{0,8}(?:就走|冲出|离开)|(?:猛(?:地|然)?|霍(?:然)?)(?:起身|站起)[^\n。！？!?]{0,8}(?:走|离开|冲出)|(?:冲|跑|奔|闯)出(?:了)?(?:门|房间|办公室|屋子|客厅|包厢|大门)|门在(?:他|她|两人)?身后(?:砰(?:地)?)?(?:关上|合上|响起)|(?:砰|嘭)(?:地|的一声)?(?:(?:带|关|摔)上(?:了)?(?:门|房门)|一声(?:门响|巨响))|扬长而去|头也不回(?:地)?(?:走|离开|走出|冲出)|甩门(?:而)?(?:去|上)?)/;
const EXIT_EN = /\b(?:stormed (?:out|off|out of the room)|marched (?:out|off)|stomped out|slammed (?:the door|out|the door behind (?:him|her|them))|the door slammed(?: behind (?:him|her|them))?|door (?:slammed|flew) shut behind|walked out on (?:him|her|them)|spun on (?:his|her) heel(?:s)?(?: and left)?|turned on (?:his|her) heel(?:s)? and (?:left|walked out)|whirled (?:around )?and (?:left|stormed out)|grabbed (?:his|her|their) (?:coat|bag|keys)(?: and (?:left|walked out|stormed out))?|headed (?:straight )?(?:for|to) the door(?: and left)?|without (?:a |another )backward glance(?:,? (?:he|she|they) left)?|swept out of the room)\b/i;

/* 末拍钩子：离场之后若最后一行落在钩子上，则句号不是摔门 */
const HOOK_ZH = /(?:手机|电话)(?:响|亮|震|屏幕亮|弹出|亮起)|未读(?:短信|消息)|门(?:被|给)?(?:推开|踹开|撞开)|身后传来(?:声音|一句|脚步声)|报告(?:单)?(?:从|掉|飘)|血|你到底是谁|(?:身后|门口|门外)(?:传来|响起|站着|出现|一个声音)|倒计时|红灯闪|录音笔还在转/;
const HOOK_EN = /\b(?:phone(?: (?:buzzed|rang|lit up|screen lit up))?|cell(?:\s?phone)? (?:buzzed|rang|lit up)|text message(?: (?:from|lit up))?|unread|door (?:burst|flew) (?:open|open behind)|a voice(?: came)? from (?:behind|the doorway)|behind (?:him|her|them) came|blood|who (?:are|the hell are) you|red light blinking|the recorder (?:kept|was still) running)\b/i;

interface Scene {
  header: string;
  index: number;
  lines: { no: number; text: string }[];
}

export function exitCliche(draft: string): ExitClicheResult {
  if (!draft || !draft.trim()) {
    return { score: 100, sceneCount: 0, checkedScenes: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(draft);
  const exitRe = zh ? EXIT_ZH : EXIT_EN;
  const hookRe = zh ? HOOK_ZH : HOOK_EN;

  // 切场（保留行号）
  const scenes: Scene[] = [];
  let header = zh ? '(开场)' : '(opening)';
  let cur: { no: number; text: string }[] = [];
  let idx = 0;
  const push = () => {
    if (cur.length > 0) scenes.push({ header, index: idx, lines: cur });
    cur = [];
  };
  draft.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    if (isSceneHeaderLine(text)) {
      push();
      header = text.slice(0, 24);
      idx += 1;
    }
    cur.push({ no: i + 1, text });
  });
  push();

  // 末场归 cliffhanger，不参与
  const checked = scenes.slice(0, Math.max(0, scenes.length - 1));

  const hits: ExitClicheHit[] = [];
  for (const sc of checked) {
    const last = sc.lines[sc.lines.length - 1];
    const prev = sc.lines[sc.lines.length - 2];
    // 最后一行是钩子 → 句号不是离场
    if (hookRe.test(last.text)) continue;
    const tail = [prev?.text ?? '', last.text].join('\n');
    const m = tail.match(exitRe);
    if (!m) continue;
    hits.push({
      sceneHeader: sc.header,
      sceneIndex: sc.index,
      endLine: last.no,
      closer: m[0],
      repeatedPhrase: false,
      reason: '',
    });
  }

  // 同款收尾词跨场复用 → 更差
  const phraseCount = new Map<string, number>();
  for (const h of hits) phraseCount.set(h.closer, (phraseCount.get(h.closer) ?? 0) + 1);
  for (const h of hits) {
    h.repeatedPhrase = (phraseCount.get(h.closer) ?? 0) > 1;
    h.reason = zh
      ? `「${h.sceneHeader}」末拍（第${h.endLine}行）落在强离场"${h.closer}"上${h.repeatedPhrase ? '，且同一收尾动作跨场复用' : ''}——冲突能量被人物带走，场景没在牌桌上收尾`
      : `Scene "${h.sceneHeader}" ends (L${h.endLine}) on a hard exit "${h.closer}"${h.repeatedPhrase ? ', and the same exit beat is reused across scenes' : ''} — the conflict leaves the room with the character instead of ending on the table`;
  }

  let score: number;
  if (hits.length <= 1) score = 100;
  else if (hits.length === 2) score = 70;
  else if (hits.length === 3) score = 45;
  else score = Math.max(20, 90 - hits.length * 15);
  if (hits.some((h) => h.repeatedPhrase) && hits.length >= 2) score = Math.max(20, score - 10);

  const issues = hits.map((h) => (zh
    ? `强离场收尾依赖：${h.reason}`
    : `Hard-exit crutch: ${h.reason}`));

  const advice = zh
    ? [
        '别让"摔门走人"替场景打句号——末拍留在牌桌上：一份甩出来的物证、一个没人回答的问题、一句被打断的话、一个新出现的威胁',
        '想保留离场，就让人走戏不冷：人走到门口被一句话钉住、手按在门把上回头开条件、门开了外面站着不该出现的人',
        '同集的强离场最多用一次；其余冲突换收尾方式——当场做决定、打一个电话、撕一份文件、或者让赢的一方先慌',
      ]
    : [
        'Do not let a slammed door punctuate every scene — end on the table: evidence flung out, a question nobody answers, a line cut in half, a fresh threat entering the room',
        'If a character must leave, keep the scene hot: pinned at the door by one line, hand on the handle turning back with terms, or the door opening on the wrong person',
        'Allow at most one hard exit per episode; close the other fights differently — a decision made on the spot, a call placed, a document torn, or the winner being the first to panic',
      ];

  return { score, sceneCount: scenes.length, checkedScenes: checked.length, hits, issues, advice };
}
