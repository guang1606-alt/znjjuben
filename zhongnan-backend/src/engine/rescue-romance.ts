import { isSceneHeaderLine } from './script-scenes';
/**
 * 英雄救美必生情 / 救命一次就心动检测（v2.116 块124，创作能力类）
 * ------------------------------------------------------------------
 * 病象：男主冲过去把她从车轮下拉开、替她挡了一刀、扑过去护住——
 *   两拍之内她心跳漏拍："就是他了，这个男人可以托付。"
 *     △货车冲来。陆沉扑过去把苏晚拉开，自己磕在路沿上。
 *     △苏晚（看着他的侧脸，心跳漏了一拍）：就是他了……
 *   一次英雄救美是桥段，第三次观众就看穿：救险成了恩情牌爱情
 *   开关。感激、安全感、依赖可以是爱情的起点之一，但"救我一命
 *   我就以身相许"跳过了相处、了解与选择，把心动当救险的附赠
 *   特效——这份心动能被任何人用一次救命换来，就不值钱。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - accidentalSpark：管秒级意外事故（摔倒/撞怀/意外之吻），
 *    本引擎管主动救险行为（救命/挡刀/护住）→心动认定；前者是
 *    "意外"（无施为者），本引擎是"救险"（一方为另一方冒险）；
 *  - instantLove：管"初见事件→高浓度承诺"（语言层：非你不嫁/
 *    娶我），本引擎管"救险事件→心动认定"（行动/情感层：心跳
 *    漏拍/就是他了）——一个管嘴快，一个管心快；
 *  - forcedProximity：关系阀门家族第一员（被动困处→靠近），
 *    本引擎是第二员（主动救险→心动）；
 *  - supportingArcCheck：把救援当配角转变的合法触发（不检测救
 *    美生情）；debtLedger 只记人情债台账（受恩/还债的账目），
 *    不判恩情是否被写成爱情；
 *  - cheapEmpathy：管安慰话术（空泛共情台词），本引擎管救险
 *    后的心动认定；woundOnCue：管带伤开挂（伤而不损），本引擎
 *    的 COST rescue 反而要求救险真有代价——互为正反面。
 *
 * "关系阀门"家族第二员：救险行为当爱情开关（救险→心动→认定）。
 *
 * 判定（镜像 instant-love 单型双锚）：
 *  - 救险锚（冲过去拉开/扑过去护住/替她挡刀挡枪/挡在身前/接住/
 *    从车轮枪口刀下救下/英雄救美 + saved her from/pulled her
 *    away/shielded/took the bullet/caught her…）与心动认定锚
 *    （心跳漏拍/怦然心动/就是他了/可以托付/安全感/莫名心安/
 *    动了心 + heart raced/knew he was the one/felt safe/fell for
 *    him…）±2 行窗口共现 → 构成一次"救美生情"事件；双条件缺
 *    一不可——纯救险无心动放行（救人本身是戏），纯心动无救险
 *    放行（正常恋爱心理）；
 *  - rescue：①已有关系基础锚（之前就有好感/暗恋已久/早就认识 +
 *    had feelings for|secret crush|already knew each other）——
 *    心动有来路，救险只是临门一脚；②报恩≠爱锚（只是感激/救命
 *    恩人/当他是哥哥/感激不是爱 + just grateful/my savior/
 *    gratitude isn't love）——人物或旁人替观众划清恩情与爱情；
 *    ③救险真代价锚（中刀中枪/流血/骨折/缝合/住院 + took a
 *    knife|bullet/bleeding/wounded/stitches/hospitalized）——救
 *    的人真付了代价，心动至少砸在血上（COST 证据允许出现在锚
 *    行自身：挡刀与中刀常是同一句）；
 *  - 场景头行不参与任何词表匹配；①②rescue 扫描跳过救险行与心
 *    动行自身，③扫描全窗口（含锚行）；
 *  - 相邻 ≤2 行的救险表述合并为同一事件（跨场景头不合并）；
 *    事件 end 取窗口内最后一个心动行（保证 rescue 扫描覆盖心动
 *    行之后）；
 *  - 第 1 次豁免（一次英雄救美是类型惯例），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface RescueRomanceHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有历史基础/报恩划界/救险代价锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface RescueRomanceResult {
  score: number;
  /** 救美生情事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: RescueRomanceHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 救险锚：一方为另一方主动涉险 */
const RESCUE_ZH = /冲(?:过去|了?过来)[^。！？\n]{0,8}(?:拉开|拽开|拉回|拽回|推开|护住|挡住)|扑(?:过去|了?过来|身)[^。！？\n]{0,6}(?:护|挡|盖|压)|替(?:她|他|你)[^。！？\n]{0,4}(?:挡|挨)[^。！？\n]{0,4}(?:刀|枪|棍|一拳|一击|一棒|鞭子|子弹)|挡在(?:她|他|你)[^。！？\n]{0,4}(?:身前|面前|前面)|(?:伸手|一把|猛地)[^。！？\n]{0,4}(?:拉住|拽住|抓住|接住|拉回|拽回|搂)|从(?:车轮|车轮下|枪口|枪下|刀下|刀口|悬崖|火海|火里|水里|河中|江里|楼上|高处|轨道)[^。！？\n]{0,6}(?:救下|救回|救出|拉出|拽出|拉回|拽回|推开|拉了回来|拽了回来)|英雄救美|救了?(?:她|他|你)(?:一命|一条命)?|舍(?:身|命)相(?:救|护)|用身体(?:挡住|护住)|把(?:她|他)(?:护|搂|拉|拽|按)[^。！？\n]{0,4}(?:怀里|身后|身边|身下)|飞身(?:扑救|扑过去|接住)|接住(?:了)?(?:坠落|摔下|倒下)?(?:的)?(?:她|他|你)/;

const RESCUE_EN = /\b(?:saved (?:her|him|you) from|pulled (?:her|him|you) (?:away|back|out|to safety)|yanked (?:her|him|you) (?:away|back|out|clear)|threw (?:himself|herself) (?:over|in front)|shielded (?:her|him|you)|stepped in front of|took (?:a|the) (?:bullet|knife|blow) for|caught (?:her|him|you) (?:as|before|when)|dived (?:toward|for|at)|lunged (?:toward|for|at)|pushed (?:her|him|you) out of (?:the )?way|covered (?:her|his|your) body|rescued (?:her|him|you) from|snatched (?:her|him|you) (?:from|back|away)|dragged (?:her|him|you) (?:from|out of|away from|to safety))\b/i;

/* 心动认定锚：救险当场/紧随发生的"就是他了"式认定 */
const DEEP_ZH = /心跳(?:加速|漏拍|骤停|猛地一(?:沉|颤)|得很快|怦怦)|怦然心动|怦(?:然)?(?:心)?跳|那一[刻瞬][^。！？\n]{0,10}(?:心动|认定|爱上|动了心|沦陷|倾心|动心)|就是他了|就是她了|非他不嫁|非她不娶|可以托付|值得托付|托付(?:终身|一生)有靠|终身有靠|安全感|莫名(?:的)?心安|心里(?:莫名)?踏实|动了心|芳心(?:暗许|乱颤|一动|已许)|情窦(?:初开|顿开)|(?:深深|彻底|就此)爱上|爱上(?:他|她)了?|认定(?:他|她)了?|一颗心[^。！？\n]{0,6}(?:系|挂|交)给/;

const DEEP_EN = /\b(?:heart (?:raced|skipped a beat|pounded|fluttered|leapt|leaped)|skipped a beat|knew (?:he|she) was the one|(?:he|she) was the one|felt (?:safe|a surge of warmth|suddenly safe)|something shifted(?: inside)?|fell for (?:him|her) (?:right )?then|from that moment(?: on)?(?:,)? she knew|in that moment(?:,)? she loved|safe with (?:him|her)|warmth spread(?: through her)?|gave (?:him|her) her heart|her heart belonged to him)\b/i;

/* rescue A：已有关系基础锚——心动有来路，救险只是催化 */
const HISTORY_ZH = /之前就(?:有|喜欢|暗恋|有好感)|暗恋(?:已久|多年|很久|[^。！？\n]{0,6}年)|早(?:就)?(?:喜欢|爱|暗恋|有好感)|早就认识|认识很久|认识多年|青梅竹马|前男友|前女友|前任|前夫|前妻|初恋|旧爱|旧情人|这些日子|这段时间|相处|同窗|共事|多年(?:朋友|交情)|老朋友|一直(?:喜欢|暗恋|爱)|心里早就/;

const HISTORY_EN = /\b(?:had feelings for|secret crush|already knew each other|childhood sweetheart|old flame|ex-(?:husband|wife|boyfriend|girlfriend)|first love|we go way back|we'?ve known each other|for (?:years|months|a long time)|all these (?:years|months)|always (?:liked|loved|had a thing for)|been in love with (?:him|her) (?:for|since)|feelings (?:for|about) (?:him|her) (?:for|since))\b/i;

/* rescue B：报恩≠爱锚——替观众划清恩情与爱情 */
const DECLINE_ZH = /只是(?:感激|感恩|感谢)|不过是(?:感激|感恩)|救命恩人|把他当(?:恩人|哥哥|大哥)|把她当(?:恩人|姐姐)|感激不(?:是|代表)(?:爱情|爱)|报恩|不能因为(?:他|她)(?:救|帮)过我|感情的?事不能勉强|对(?:他|她)没(?:有)?(?:那种|心动|男女)?(?:感觉|意思)|不是心动|没有心动|保持距离|推开(?:了)?(?:他|她)|一码归一码/;

const DECLINE_EN = /\b(?:just grateful|only grateful|i'?m grateful (?:to|but)|gratitude (?:is(?:n'?t| not) love|doesn'?t mean love)|he saved my life(?:, but| doesn'?t mean)|my savior|like a (?:brother|sister) to me|only (?:see|saw) (?:him|her) as|don'?t love (?:him|her) (?:just )?because|doesn'?t mean i love|no romantic feelings|just a debt|owe (?:him|her) (?:a|my life))\b/i;

/* rescue C：救险真代价锚——救的人真付了代价（允许命中锚行自身） */
const COST_ZH = /(?:刀伤|枪伤|中了?(?:一刀|一枪)|挨了?(?:一刀|一枪|一棍)|流(?:了|着)?(?:很多|一地|一滩)?血|鲜血(?:淋漓|直流|染红)|骨折|骨裂|住院|缝合|缝了?[^。！？\n]{0,3}针|包扎|绷带|伤口(?:很深|还在流血|流血)|昏迷(?:不醒)?|重伤|伤势|胳膊(?:中|挨)[^。！？\n]{0,2}(?:刀|枪)|替他挡的那(?:刀|枪)|身中(?:数|一|两|三)?(?:刀|枪)|头破血流)/;

const COST_EN = /\b(?:took a (?:knife|bullet|blow)|bleeding|blood (?:soaked|stained|trickled|from)|wounded|injur(?:ed|y)|deep cut|stitches|stitched up|hospital(?:ized)?|broke (?:his|her) \w+|fractured?|gash|bandaged|bandage|unconscious|surgery|knife wound|gunshot wound)\b/i;

/**
 * 纯函数：检测"救美必生情"的恩情牌爱情开关密度病。
 */
export function rescueRomance(draft: string): RescueRomanceResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;
  const deepRe = zh ? DEEP_ZH : DEEP_EN;
  const historyRe = zh ? HISTORY_ZH : HISTORY_EN;
  const declineRe = zh ? DECLINE_ZH : DECLINE_EN;
  const costRe = zh ? COST_ZH : COST_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  const hasD: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasR[i] = rescueRe.test(line);
    hasD[i] = deepRe.test(line);
  });

  /* pass2：救险行与 ±2 行内的心动认定锚配对成事件（相邻 ≤2 行救险行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasR[i]) return;
    const m = raw.match(rescueRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的救险表述合并为同一事件（跨场景头不合并）；
           合并时以新救险行窗口内的心动行继续延伸 end，不得缩短 */
        const ext = [i - 2, i - 1, i, i + 1, i + 2].filter(
          (j) => j >= 0 && j < rawLines.length && hasD[j],
        );
        if (ext.length) last.end = Math.max(last.end, ext[ext.length - 1]);
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasD[j],
    );
    if (win.length === 0) return; /* 纯救险无心动不构成事件（救人本身放行） */
    /* end 取窗口内最后一个心动行：保证 rescue 扫描覆盖心动行之后的内容 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（历史基础/报恩划界/救险代价；①②跳过锚行，③全窗口） */
  const hits: RescueRomanceHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次英雄救美是类型惯例） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    const costLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      costLines.push(rawLines[j]); /* COST 全窗口（挡刀与中刀常是同一句） */
      if (hasR[j] || hasD[j]) continue; /* 救险行与心动行自身不作①②rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const costWin = costLines.join('\n');
    const rescued = historyRe.test(win) || declineRe.test(win) || costRe.test(costWin);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"英雄救美必生情"——冲过去拉开、替她挡刀，两拍内心跳漏拍"就是他了"，救险成了恩情牌爱情开关'
        : 'rescue-romance again - he saves her and two beats later her heart skips and he is the one; gratitude is being handed out as love',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"救美生情"式恩情开关（${n} 处未救）——救险两拍内心动认定，感激、安全感被直接写成爱情，跳过相处与选择。`
      : `${hitCount} rescue-romance beats (${n} unrescued) - a save becomes a love switch within two beats; gratitude and safety are handed over as love with no time and no choice.`);
    advice.push(zh
      ? '救人可以动情，但恩情不是爱情的快捷键。给每次"救美心动"补一道落差：要么心动有来路（她暗恋他很久——救险只是让她不敢再骗自己，而不是从零开机）、要么让人物自己划界（"我只是感激他，感激不是爱"——恩人的身份反而先成为一道坎，后面越界才有重量）、要么让代价真实可见（他挡刀后流血、缝合、住院——心动砸在血上，且救人的代价要拖到后面几场持续影响他，而不是下一场活蹦乱跳）。更好用的写法是"救完反而疏远"——被救的人背负亏欠感，不敢靠近；救的人不图回报甚至避谈——爱情从"还清这笔债之后还想不想见他"里长出来。如果剧情就是需要救险定情，让她心动后立刻反悔（"我在想什么"），用三到五场把一时的安全感熬成主动选择——选来的爱情，才不会被下一次救命重新白给。'
      : 'A rescue can stir feelings, but gratitude is not a hotkey for love. Give every "saving -> heartbeat" beat a gap: feelings with a history (she has liked him for months - the save only stops her lying to herself, not a cold boot), someone drawing the line ("I\'m just grateful - gratitude isn\'t love"; the savior role becomes a wall first, so crossing it later carries weight), or a real visible cost (the knife, the blood, the stitches, the hospital - and the wound keeps costing him for scenes afterward, not gone by morning). Better still, rescue then distance: the saved one carries a debt and dares not approach; the savior wants nothing and avoids the topic - love grows out of "after the debt is settled, do I still want to see him". If the plot truly needs the rescue to kindle love, let her heart leap and then recoil ("What am I thinking"), then spend three to five scenes turning a flash of safety into an active choice - chosen love cannot be handed out again by the next rescue.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
