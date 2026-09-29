import { isSceneHeaderLine } from './script-scenes';
/**
 * 回忆杀拐杖检测（v2.80 块82，创作能力类）
 * ------------------------------------------------------------------
 * 病象：情绪一不够就插回忆——被羞辱了闪回雨夜、对决前闪回誓言、
 * 告白前闪回初遇；同一场景的回忆整段重播三四遍，观众直接拖进度条：
 *   【闪回】
 *   △雨夜，她跪在沈家门口，婚书摔在她脸上。
 *   （每集都播这一段）
 *   FLASHBACK - RAIN - WEDDING
 *   She kneels at the gate. The contract hits the ground.
 * 回忆是快捷方式不是戏：第一次是信息，第二次是复习，第三次观众
 * 去拖进度条。当场冲突、当下细节才是戏，闪回只是调味。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - previewVoiceover：管预告腔画外音（"她不知道，这一切才刚开始"），
 *    本引擎管闪回块本身的结构性滥用；
 *  - echoDialogue：管相邻台词鹦鹉学舌与旁白复述，跨场景整段重播
 *    的回忆块无人管；
 *  - recap：管前情回顾节奏，不判单集内的闪回蒙太奇；
 *  - propLedger：管道具跨集连续性，与闪回无关。
 *
 * 判定：
 *  - 闪回块标记：【闪回】/（回忆）/△闪回：/回忆杀：/FLASHBACK/
 *    INT. FLASHBACK…；块延伸到下一个场景头/下一个标记/结束符；
 *  - 罪一（重复播片）：同一签名（标记行+前两行内容）的闪回第 2 次
 *    出现起，每次记 1 hit——重复不可救；
 *  - 罪二（长蒙太奇）：内容超 3 行的长闪回，第 3 个起每次记 1 hit；
 *    若块后两行内出现当下具体动作（拨通/签字/报警/推门/calls/signs/
 *    burns…），说明记忆落成了扳机 → rescued；
 *  - 计分（与家族其他引擎不同——闪回滥用是结构性病，单次已成立）：
 *    n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface FlashbackCrutchHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 闪回块内容行数（不含标记行） */
  blockLines: number;
  /** 是否重复播片（同一签名第 2 次及以上） */
  repeated: boolean;
  /** 长蒙太奇命中后，块后是否紧跟当下动作（扳机） */
  rescued: boolean;
  reason: string;
}

export interface FlashbackCrutchResult {
  score: number;
  /** 全片闪回块总数 */
  flashbackCount: number;
  /** 重复播片的闪回签名组数 */
  repeatCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: FlashbackCrutchHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const CUE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\((?:V\.?O\.?|O\.?S\.?|CONT(?:'?D)?|OFFSCREEN|FILTERED|ON THE PHONE|[^()]{0,40})\))?\s*:\s*(.+)$/;

/* 闪回块开始标记；（闪回结束）/FLASHBACK END 是终止符不算 */
const FB_ZH_RE = /^(?:【(?:闪回|回忆杀?)】|（(?:闪回|回忆杀?)）|△\s*(?:插入)?(?:闪回|回忆杀?)\s*[:：，,]|(?:插入)?(?:闪回|回忆杀?)\s*[:：])/;
const FB_EN_RE = /FLASHBACK/;
const FB_END_RE = /(?:闪回|回忆杀?)\s*(?:结束|完)|FLASHBACK\s*END/i;

/* 扳机：闪回后块边界外紧跟的当下具体动作 */
const ACTION_ZH = /拨(?:通|出|打)|拿起手机|打给|签(?:下|了|字)|盖章|起身|推门|摔门|夺门|烧掉|撕碎|报警|翻出|打开(?:录音|邮箱|保险柜)|查到|找到(?:了)?(?:证据|地址|账本)|写下|锁定了?/;
const ACTION_EN = /\b(?:call(?:s|ed)?|dial(?:s|ed)?|pick(?:s|ed)? up the phone|sign(?:s|ed)?|grab(?:s|bed)?|stands? up|walk(?:s|ed)? out|slam(?:s|med)?|burn(?:s|ed)?|tears? up|report(?:s|ed)?|unlocks?|found|looked? up|writes?)\b/i;

interface FlashBlock {
  markerLineIdx: number;
  markerText: string;
  contentLines: string[];
  /** 块最后一行在全文的 0 基行号 */
  endIdx: number;
  sceneIndex: number;
  sceneHeader: string;
}

/**
 * 纯函数：检测重复播片与超长蒙太奇式的回忆杀拐杖。
 */
export function flashbackCrutch(draft: string): FlashbackCrutchResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, flashbackCount: 0, repeatCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);

  const isMarker = (line: string): boolean => {
    if (FB_END_RE.test(line)) return false;
    return zh ? FB_ZH_RE.test(line) : (FB_EN_RE.test(line) && !CUE_EN.test(line));
  };

  const blocks: FlashBlock[] = [];
  let sceneIdx = -1;
  let header = '';
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i].trim();
    if (!line) { i++; continue; }
    if (isMarker(line)) {
      const content: string[] = [];
      let j = i + 1;
      while (j < rawLines.length) {
        const l2 = rawLines[j].trim();
        if (!l2) { j++; continue; }
        if (FB_END_RE.test(l2) || isSceneHeaderLine(l2) || isMarker(l2)) break;
        content.push(l2);
        j++;
      }
      blocks.push({ markerLineIdx: i, markerText: line, contentLines: content, endIdx: j - 1, sceneIndex: Math.max(0, sceneIdx), sceneHeader: header });
      i = j;
      continue;
    }
    if (isSceneHeaderLine(line)) {
      sceneIdx += 1;
      header = line;
    }
    i++;
  }

  /* 重复播片签名：标记行 + 前 2 行内容（去空白） */
  const sigOf = (b: FlashBlock): string =>
    (b.markerText + b.contentLines.slice(0, 2).join('')).replace(/\s+/g, '');
  const sigTotal = new Map<string, number>();
  for (const b of blocks) sigTotal.set(sigOf(b), (sigTotal.get(sigOf(b)) ?? 0) + 1);
  const seen = new Map<string, number>();
  let longOrdinal = -1;

  const hits: FlashbackCrutchHit[] = [];
  blocks.forEach((b) => {
    const sig = sigOf(b);
    const occurrence = (seen.get(sig) ?? 0) + 1;
    seen.set(sig, occurrence);
    const isLong = b.contentLines.length > 3;
    if (isLong) longOrdinal += 1;
    const repeated = (sigTotal.get(sig) ?? 0) >= 2 && occurrence >= 2;
    const overload = isLong && longOrdinal >= 2;
    if (!repeated && !overload) return;

    let rescued = false;
    if (overload && !repeated) {
      const after: string[] = [];
      for (let k = b.endIdx + 1; k < rawLines.length && after.length < 2; k++) {
        const l = rawLines[k].trim();
        if (l) after.push(l);
      }
      rescued = (zh ? ACTION_ZH : ACTION_EN).test(after.join('\n'));
    }

    hits.push({
      line: b.markerLineIdx + 1,
      sceneIndex: b.sceneIndex,
      sceneHeader: b.sceneHeader,
      snippet: b.markerText.slice(0, 30),
      marker: b.markerText.slice(0, 20),
      blockLines: b.contentLines.length,
      repeated,
      rescued,
      reason: repeated
        ? (zh ? '同一回忆整段重播——第二次是复习，第三次观众就去拖进度条' : 'the same flashback replayed wholesale — the second run is a rerun, the third is a skip button')
        : (zh ? '三行以上的回忆蒙太奇且未接当下动作——情绪不够回忆凑，当场冲突被快捷方式掏空' : 'a 4+ line flashback montage with no concrete present-day action after it — memory as filler, not trigger'),
    });
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);
  const repeatCount = [...sigTotal.values()].filter((c) => c >= 2).length;

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${blocks.length} 处闪回（${repeatCount} 组重复），其中 ${n} 处空转——重复播片或超三行蒙太奇且未落到当下行动，情绪不够回忆凑，当场冲突被快捷方式掏空。`
      : `${blocks.length} flashback(s) (${repeatCount} replayed), ${n} of them idle — wholesale replays or 4+ line montages with no concrete present-day action. Memory is doing the work the scene should do.`);
    advice.push(zh
      ? '回忆是快捷方式不是戏：第一次闪回是信息，第二次是复习，第三次观众就去拖进度条了。把回忆杀换成当下可演的动作——让往事在现场景发酵（她摸到同款婚书当场僵住、对手复刻当年的施害动作），或压成一句台词一个道具（"这裙子，和三年前那件一样"），信息给到就走。同一回忆全剧只播一次；闪回之后必须切回当下、立刻接一个具体动作，让记忆当扳机，别当床垫。'
      : 'Flashbacks are shortcuts, not scenes: the first is information, the second is a rerun, the third and the audience reaches for the skip button. Replace the replay with something playable now — let the past ferment in the present scene (she freezes touching the same wedding contract; the antagonist re-enacts the old cruelty), or compress it to one line and one prop ("This dress — same as three years ago"). Never replay the same flashback twice; after every flashback cut back to the present and land a concrete action — memory must be a trigger, not a mattress.');
  }

  return { score, flashbackCount: blocks.length, repeatCount, unrescuedCount: n, hits, issues, advice };
}
