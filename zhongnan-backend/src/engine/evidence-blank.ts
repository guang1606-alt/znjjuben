import { isSceneHeaderLine } from './script-scenes';
/**
 * 证据恰好失灵 / 取证载体阀门检测（v2.98 块106，创作能力类）
 * ------------------------------------------------------------------
 * 病象：取证设备成了编剧的阀门——剧情需要黑，监控就"恰好坏了"
 *   三天没修；需要保住秘密，内存卡就"恰好满了"、照片就"恰好糊了"、
 *   镜头就"恰好被货车挡住"：
 *     △保安挠头：那晚的监控坏了，还没修。
 *     △调出来的行车记录仪——内存卡满了，什么都没录上。
 *     △她把照片放大，一片模糊，看不清车牌。
 * 一次设备故障是现实，第三次观众就看穿：证据失灵是需要它失灵
 * 的时候才发生的事故。失灵要么有人为来路（被人剪线/砸/删/关），
 * 要么有替代证据兜底（备份/云/另一台/别的角度也拍到了）。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - recordsOnDemand：管"调取必中"（每次查都查到要的），本引擎
 *    管镜像的另一面"关键处恰好没录上"——取证便利性的双向，本块
 *    其权重退役让位（镜像兄弟惯例，同 weaponJam←commFailCrutch）；
 *  - evidenceChain：管甩证据无铺垫的公平性（出示前要有过程），
 *    本引擎管证据载体本身的时机性失灵；
 *  - commFailCrutch：管通讯工具失灵掐断呼救（打不通/没信号），
 *    本引擎管取证设备失灵掐断画面（坏了/没拍到/糊了）——设备域
 *    不相交（通讯设备 vs 取证载体），REC 锚把手机通话挡在门外；
 *  - causalLogic：泛巧合单发统计，本引擎管失灵密度病复用；
 *  - plotArmor：物理控制下生死免疫，本引擎管影像证据的时机性
 *    缺席。
 *
 * 判定：
 *  - 取证载体锚（监控/摄像头/探头/行车记录仪/摄像机/相机/录像/
 *    录音笔/内存卡/存储卡/照片/镜头/视频 + camera/surveillance/
 *    CCTV/footage/dashcam/memory card/photo/lens…）与失灵锚
 *    （坏了/出故障/维修/黑屏/没拍到/没录上/拍不到/糊了/模糊/
 *    看不清/被挡/满了/损坏/进水 + broken/out of order/under
 *    repair/didn't capture/corrupted/blurry/blocked/full…）
 *    ±2 行窗口共现 → 构成一次"证据失灵"事件；双条件缺一不可——
 *    纯载体陈述放行（装了新监控是布防交代），纯失灵词无载体放行
 *    （他眼睛模糊了不归本引擎）；
 *  - rescue：①人为来路锚（剪断/砸了/拆走/删掉/偷走/关掉/烧了 +
 *    cut the wire/smashed/deleted/stole/turned off）——人主动
 *    毁证是剧情行动，失灵有主使；②替代锚（备份/云端/另一台/
 *    别的角度/还有一段/也拍到了 + backup/cloud/another camera/
 *    different angle/also captured）——门关了窗还开着，失灵没
 *    有白掐；
 *  - rescue 扫描包含载体/失灵行自身与事件 ±2 行（来路词天然与
 *    失灵词同行——"监控坏了，保安说前天被人剪了线"），仅跳过
 *    场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的失灵表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次设备故障是现实），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface EvidenceBlankHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有人为来路/替代证据锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface EvidenceBlankResult {
  score: number;
  /** 证据失灵事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: EvidenceBlankHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 取证载体锚：能"记下真相"的设备与媒介 */
const REC_ZH = /监控|摄像头|探头|行车记录仪|记录仪|摄像机|相机|录像|录音笔|录音|内存卡|存储卡|记忆卡|SD卡|照片|相片|镜头|视频/;

const REC_EN = /\b(?:camera|camcorder|surveillance|CCTV|footage|video|recording|recorder|dashcam|dash ?cam|memory card|SD card|storage card|photo|photograph|picture|lens|tape)\b/i;

/* 失灵锚：载体在关键时刻交不出画面（坏了/故障本身即设备语义） */
const BROKEN_ZH = /坏了|出(?:了)?故障|故障|维修|黑屏|没拍到|没录上|没录到|拍不到|录不到|拍糊|糊了|模糊|看不清|被挡|挡住|满了|损坏|进水|摔坏|断电/;

const BROKEN_EN = /\b(?:broken|out of order|under repair|being repaired|maintenance|black screen|no signal|didn'?t (?:catch|capture|record)|did not (?:catch|capture|record)|no footage|corrupted|blurry|blurred|out of focus|blocked|obstructed|(?:memory|storage|card|disk|tape) (?:was |is )?full|damaged|water[- ]damaged|smashed)\b/i;

/* rescue A：人为来路锚——有人动了手脚，失灵有主使（是行动不是方便） */
const COST_ZH = /剪断|剪了|砸了|砸烂|砸碎|拆走|拆了|删掉|删了|偷走|偷了|烧了|拔了|关掉|关闭|关了|涂掉|拿走|抢走/;

const COST_EN = /\b(?:cut (?:the|its) (?:wire|cable|power|feed)|smashed|tore (?:it |the )?(?:down|apart)|removed|deleted|stole|stolen|burned|switched (?:it )?off|turned (?:it )?off|disabled|took the (?:card|tape|memory))\b/i;

/* rescue B：替代锚——门关了窗还开着（另一路证据还在，失灵没白失灵） */
const BACKUP_ZH = /备份|云端|云盘|另一台|另一个角度|别的角度|还有一段|也拍到了|别的路口/;

const BACKUP_EN = /\b(?:backup|cloud|another camera|other angle|different angle|another (?:video|recording)|a copy|also (?:caught|captured|recorded))\b/i;

/**
 * 纯函数：检测"证据在关键时刻恰好失灵"式取证载体阀门的密度病。
 */
export function evidenceBlank(draft: string): EvidenceBlankResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const recRe = zh ? REC_ZH : REC_EN;
  const brokenRe = zh ? BROKEN_ZH : BROKEN_EN;
  const costRe = zh ? COST_ZH : COST_EN;
  const backupRe = zh ? BACKUP_ZH : BACKUP_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasRec: boolean[] = new Array(rawLines.length).fill(false);
  const hasBroken: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasRec[i] = recRe.test(line);
    hasBroken[i] = brokenRe.test(line);
  });

  /* pass2：失灵行与 ±2 行内的取证载体配对成事件（相邻 ≤2 行失灵行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasBroken[i]) return;
    const m = raw.match(brokenRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的失灵表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasRec[j],
    );
    if (win.length === 0) return; /* 纯失灵无载体放行（人眼看不清不归本引擎） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（人为来路/替代两路；窗口含载体与失灵行自身与
     事件 ±2 行——来路词天然与失灵词同行"监控坏了，前天被人剪了线"，
     仅跳过场景头行） */
  const hits: EvidenceBlankHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次设备故障是现实） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = costRe.test(win) || backupRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"证据恰好失灵"——剧情需要黑的时候监控就坏、内存卡就满、照片就糊，取证设备成了编剧的阀门，真相想藏就藏'
        : 'evidence-blank again - the camera breaks, the card fills up, the photo blurs exactly when the plot needs it dark; the recorder is a switch the writer flips',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"证据恰好失灵"式取证阀门（${n} 处未救）——监控在该坏的时候才坏，一次是现实，第三次观众就看穿设备失灵是编剧的开关。`
      : `${hitCount} evidence-blank beats (${n} unrescued) - the recorder goes dark exactly when it matters. Once is reality; by the third, the outage is a switch the writer flips.`);
    advice.push(zh
      ? '设备失灵的账要当面算清，不在坏没坏，而在失灵这一下有没有主使和下文。给每次"恰好坏了"补一道门槛：要么有人为来路（被人剪了线、砸了摄像头、删了录像、偷走内存卡、提前关掉——人主动毁证是行动，失灵有主使，还会留下追查的线头）、要么有替代兜底（云端有备份、对面路口也拍到了、行车记录仪还录着一段——门关了窗还开着，失灵没白失灵）、要么让失灵有代价（监控维修要等一周、内存卡数据恢复要花钱找人——真相不是被顺走的，是要抢时间换的）。最忌讳的是失灵完就当没事发生：昨天还坏了三天没修的监控，今天关键时刻又好好的在拍——设备的账要连续。如果剧情必须一次"真相被黑掉"，把它留给唯一一次，并让这次失灵在后续被人认账（谁剪的线？内存卡去了哪？）——证据记得每一次掉链子。'
      : 'The outage keeps honest books - what matters is not whether the camera works, but whether the failure has a culprit and a consequence. Toll every convenient dark: a human cause (someone cut the wire, smashed the camera, deleted the footage, stole the memory card, switched it off in advance - sabotage is an action, it leaves threads to pull), a fallback (the cloud backup, the camera across the street, the dashcam still rolling - when the door closes, another window stays open), or a price (a week of repairs, a paid data-recovery guy - the truth is not walked off with, it is raced for). The unforgivable version: the camera that was broken for three days works perfectly the moment the plot wants it rolling - equipment must keep books. If the plot needs one dark screen, save it for the single beat - and make someone answer for it later (who cut the wire? where is the card?).');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
