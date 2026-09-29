import { isSceneHeaderLine } from './script-scenes';
/**
 * 嘴炮退敌检测（v2.119 块127，创作能力类）
 * ------------------------------------------------------------------
 * 病象：对峙戏里，强势方本该是全场最难啃的那块骨头——他有武器、
 *   有人质、有同伙、有退路算计。AI 写的对峙却像纸糊的：枪刚举
 *   起来、刀刚架到脖子上，主角一句"把枪放下，别冲动，想想你的
 *   女儿"，反派就真放下了——
 *   男主（缓缓起身）：把枪放下。
 *   歹徒（手一抖）：……我凭什么听你的？
 *   男主：想想你女儿，她还在等你回家。
 *   歹徒（枪垂下）：……罢了。
 *   没有讨价还价、没有外力压制、没有僵持消耗，一场生死对峙被
 *   三句台词解压成茶话会。第一次对峙-说降是紧张-释然的节拍，
 *   病在它被当成万能对峙阀：
 *   1) 说降没有博弈——反派零回合就放下，他的人质筹码、炸弹
 *      引信、同伙后手全部蒸发，观众刚建立的恐惧瞬间清零；
 *   2) 说降不增代价——主角赢得毫无成本，连一根头发都没赔，
 *      悬念工具用完即弃；
 *   3) 说降替代高潮——本该用武力、智斗或牺牲解的死局，被嘴
 *      炮一键通关，高潮戏被台词掏空。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - soft-interrogation：管"审讯秒招"（审讯室里权威暴力解锁
 *    真话），本引擎管"对峙秒降"（对峙现场嘴炮解锁放下武器）——
 *    前者管审讯室博弈白给，本引擎管对峙现场博弈白给，场景不同
 *    词表不同，互为镜像兄弟；
 *  - instant-repentance：管"加害方作恶→秒悔悟"（加害方自发认
 *    错表态），本引擎管"强势方被劝→秒放下"（被说服的博弈解
 *    压）——前者管态度层悔悟，本引擎管行为层放下；
 *  - stance-flip：管"决定钉死→无因反转"（角色自己横跳，没人
 *    逼没证据），本引擎管"对峙状态被临场说服解除"（有明确的
 *    劝降者与劝降词）——前者管决定反转无因，本引擎管对峙解除
 *    白给；
 *  - empty-threat：管"威胁放完没下文"（狠话口嗨），本引擎管
 *    "对峙有下文但下文白给"（武器真举起来了却被三句话解掉）；
 *  - villain-overconfession：管"反派炫耀式自爆"（反派泄露机
 *    密），本引擎管"反派被劝放下武器"（反派解除武装）——前者
 *    管信息白给，本引擎管筹码白给；
 *  - plot-armor-check：管"主角被外力救场"（天降神兵），本引
 *    擎管"主角靠台词解压对峙"（嘴炮神兵）。
 *
 * "冲突解决"家族第四员（apology-loop 过度道歉 + fight-reconcile
 * 吵架秒和 + instant-repentance 加害方秒悔悟 + talk-down-crutch
 * 嘴炮退敌——四维互补覆盖冲突解决不当的密度病）。本引擎让位
 * softInterrogation 入池（博弈白给镜像兄弟退役：审讯博弈白给 vs
 * 对峙博弈白给，同构异景）。
 *
 * 判定（镜像 instant-repentance 单型双锚）：
 *  - 说降锚（放下枪/把刀放下/别冲动/冷静点/想想你女儿/不值得/
 *    听我说/给我一个机会/别做傻事/放开她 + put the gun down/
 *    don't do this/think about your family/it's not worth it/
 *    listen to me/let her go/stand down…）与对峙锚（举枪/枪指/
 *    枪口/刀架/挟持/人质/炸弹/上膛/扣扳机/勒住 + gun pointed/
 *    knife to her throat/hostage/bomb/finger on the trigger…）
 *    ±2行窗口共现 → 构成一次"嘴炮退敌"事件；双条件缺一不可——
 *    纯对峙无说降放行（对峙本身是戏）、纯说降无对峙放行（日常
 *    劝解）；
 *  - rescue：① 博弈过程锚（谈条件/开价/凭什么/休想/你先放下/
 *    怎么保证 + what do you want/why should i/you first/no
 *    deal…）——有来回不是白给；② 外力压制锚（警察包围/狙击
 *    手/支援赶到/夺下/制服 + police surrounded/sniper/backup/
 *    disarmed/tackled…）——放下武器有外因不是被说动；③ 时间
 *    消耗锚（僵持/对峙了三天/谈了几个小时/僵局 + standoff
 *    lasted/hours passed/stalemate…）——有过程不是秒解；
 *  - 场景头行不参与任何词表匹配；rescue 三路全窗口扫描（博弈/
 *    压制/消耗词常出现在说降行自身的舞台提示里，如"（枪口仍顶
 *    着太阳穴）：你先放开他们"，排除锚行会漏检，固化坑⑧）；
 *  - 相邻 ≤2 行的说降表述合并为同一事件（跨场景头不合并）；
 *    事件 end 取窗口内最后一个锚行（保证 rescue 扫描覆盖锚行
 *    之后）；
 *  - 第 1 次豁免（一次对峙-说降是紧张-释然节拍），第 2 次起每次
 *    1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface TalkDownHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有博弈过程/外力压制/时间消耗（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface TalkDownResult {
  score: number;
  /** 嘴炮退敌事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: TalkDownHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 对峙锚：强势方持有武器/人质/炸弹的暴力对峙状态信号 */
const STANDOFF_ZH = /举枪|举起了?枪|枪指|拿枪指|用枪指|枪口|顶在[^。！？\n]{0,4}头上?|抵在[^。！？\n]{0,6}(?:额|太阳穴|腰|脖)|抵住|刀架|架在[^。！？\n]{0,6}(?:脖子|颈|肩)|匕首抵?|挟持|劫持|绑架|人质|炸弹|引爆|雷管|拉环|上了膛|上膛|扣动扳机|扣下扳机|扳机|勒住|勒紧|掐住|掐紧|挥刀|扬刀|亮出刀|拔刀|拔出枪|掏出枪|端起枪|瞄准|枪顶|顶着枪|利刃/;

const STANDOFF_EN = /\b(?:pointed (?:a|the|his|her|your) (?:gun|pistol|revolver|rifle)|pointing (?:a|the|his|her|your) (?:gun|pistol|revolver|rifle)|gun (?:pointed|aimed|pressed)|at gunpoint|aimed the (?:gun|pistol|rifle)|pressed the (?:gun|barrel|muzzle)|gun to (?:her|his|my|their) head|knife (?:to|at|against) (?:her|his|my|their)|blade (?:against|pressed|at)|held (?:her|him|them) (?:at knifepoint|hostage)|hostages?|kidnap\w*|bomb|detonator|finger (?:hovered|rested) on the trigger|on the trigger|cocked the (?:gun|hammer)|drew (?:a|the|his|her) (?:gun|knife)|pulled (?:out )?(?:a|the|his|her) (?:gun|knife)|raised the (?:gun|knife|blade)|held the (?:knife|blade)|gripped the (?:knife|blade)|clutching the (?:detonator|trigger)|strapped (?:with )?explosives|noose|rope (?:around|tightened|pulled tight)|choked|strangling|knife (?:hovered|pressed))\b/i;

/* 说降锚：劝强势方放下武器/放开人质的话语 */
const TALKDOWN_ZH = /放下枪|把枪放下|放下了?枪|放下刀|把刀放下|放下武器|把武器放下|东西放下|别冲动|你冷静|冷静点|冷静一下|想想你[^。！？\n]{0,4}(?:家人|女儿|儿子|孩子|母亲|父亲|老婆|孩子)|不值得|你还有救|回头是岸|悬崖勒马|听我说|听我一句|给我一个机会|给我个机会|别做傻事|住手|住脚|放下屠刀|别伤害|放开[^。！？\n]{0,4}(?:她|他|他们|人质)|松手|退后|有话好好说|能谈谈|好好谈谈|深呼吸|把刀扔了|把枪扔了|扔了枪|丢掉枪|别开枪|先放下/;

const TALKDOWN_EN = /\b(?:put (?:the|that|your) (?:gun|knife|weapon|pistol) down|put (?:it|them) down|drop (?:the|that|your) (?:gun|knife|weapon)|lower (?:the|your) (?:gun|weapon)|don'?t do this|don'?t be a fool|don'?t be stupid|don'?t make it worse|think about (?:your|her|his|their) (?:family|daughter|son|children|kids|mother|father|wife)|it'?s not worth it|not worth (?:it|dying)|come to your senses|listen to me|hear me out|give me a chance|let (?:her|him|them|the hostage) go|release (?:her|him|them)|stand down|we can talk|let'?s talk about this|don'?t hurt (?:her|him|them)|nobody (?:has to|needs to) (?:die|get hurt)|calm down|take it easy|easy now|slowly|hands where i can see)\b/i;

/* rescue A：博弈过程锚——对峙有来回（全窗口扫描） */
const BARGAIN_ZH = /谈条件|提条件|开价|交换|拿什么换|凭什么|凭什么听你|休想|做梦|你先放下|你先退后|先放开|先放了|先放人|你怎么保证|拿什么保证|我不放下|我不放手|别想让我|交换条件|你要什么|你想要什么|你还想要|作交换|留我一命|少来这套|你骗我|没门/;

const BARGAIN_EN = /\b(?:what do you want|why should i|you first|what'?s in it for me|what guarantees|no deal|make me a deal|terms first|let them go first|let her go first|let him go first|how do i know|promise me|you put yours down first|i won'?t put it down|not a chance|no way|swap|exchange|trade|bargain|negotiate|counteroffer|my terms|my conditions|you lie|liar)\b/i;

/* rescue B：外力压制锚——放下武器有外因（全窗口扫描） */
const FORCE_ZH = /警察包围|警方包围|特警|狙击手|瞄准镜|支援赶到|援兵赶到|包围了|包围圈|被击中|被击毙|击落|打落|打掉了|夺下|夺过|制服|扑倒|按倒|按住|手铐|戴上手铐|人质已解|救出|破门|突入|强行突入|断后路|退路被堵/;

const FORCE_EN = /\b(?:police surrounded|cops (?:surrounded|closed in|swarmed)|swat|sniper|scoped|backup (?:arrived|is here)|reinforcements|surrounded (?:the|him|her|them|the building)|shot the (?:gun|weapon) (?:out|off)|shot it (?:out|off)|disarmed|tackled|pinned (?:down|him|her|them)|subdued|handcuff\w*|breach\w*|stormed (?:in|the)|raided|rescued (?:the hostage|her|him|them)|taken down)\b/i;

/* rescue C：时间消耗锚——对峙有过程（全窗口扫描） */
const STALL_ZH = /僵持|对峙[^。！？\n]{0,8}(?:天|夜|小时|个小时|久)|僵局|谈判[^。！？\n]{0,6}(?:小时|很久|持续)|拖了[^。！？\n]{0,6}(?:很久|许久|几个小时)|时间一分一秒|一分一秒地?过|夜色渐深|天色渐亮|相持不下/;

const STALL_EN = /\b(?:standoff (?:lasted|dragged|went on|continued)|hours (?:passed|went by|of talking)|talked for hours|time dragged on|wore on|stalemate|deadlock|impasse|night fell|dawn broke|for hours)\b/i;

/**
 * 纯函数：检测"嘴炮退敌"的对峙零博弈密度病。
 */
export function talkDownCrutch(draft: string): TalkDownResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const standoffRe = zh ? STANDOFF_ZH : STANDOFF_EN;
  const talkdownRe = zh ? TALKDOWN_ZH : TALKDOWN_EN;
  const bargainRe = zh ? BARGAIN_ZH : BARGAIN_EN;
  const forceRe = zh ? FORCE_ZH : FORCE_EN;
  const stallRe = zh ? STALL_ZH : STALL_EN;

  /* pass0：预计算每行的场景 id（用于 pass2 窗口跨场景头排除，固化坑⑦） */
  const sceneIdOf: number[] = new Array(rawLines.length).fill(0);
  let sceneCounter = 0;
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) sceneCounter += 1;
    sceneIdOf[i] = sceneCounter;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasS: boolean[] = new Array(rawLines.length).fill(false);
  const hasT: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasS[i] = standoffRe.test(line);
    hasT[i] = talkdownRe.test(line);
  });

  /* pass2：说降行与 ±2 行内的对峙锚配对成事件（相邻 ≤2 行说降行合并，窗口不跨场景头） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasT[i]) return;
    const m = raw.match(talkdownRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的说降表述合并为同一事件（跨场景头不合并）；
           合并时以新说降行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const myScene = sceneIdOf[i];
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasS[j] && sceneIdOf[j] === myScene,
    );
    if (win.length === 0) return; /* 纯说降无对峙不构成事件（日常劝解放行） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（博弈过程/外力压制/时间消耗；全窗口扫描——
     BARGAIN/FORCE/STALL 词常出现在说降行自身的舞台提示里，如
     "（枪口仍顶着太阳穴）：你先放开他们"，排除锚行会漏检 rescue，
     固化坑⑧） */
  const hits: TalkDownHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次对峙-说降是紧张-释然节拍） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R2/R3 全部用全窗口扫描 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = bargainRe.test(win) || forceRe.test(win) || stallRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"嘴炮退敌"——枪口刀锋下的生死对峙被三句劝降词解压，跳过博弈与代价，把说降当万能对峙阀，白给的胜利撑不起对峙的分量'
        : 'talk-down crutch again - a life-and-death standoff defused by a few soothing lines, skipping bargaining and cost, treating persuasion as a universal standoff valve',
    });
  }

  const unrescuedCount = hits.filter((h) => !h.rescued).length;
  const score = unrescuedCount === 0 ? 100 : Math.max(20, 90 - unrescuedCount * 20);
  const issues: string[] = [];
  const advice: string[] = [];
  if (unrescuedCount > 0) {
    issues.push(zh
      ? `检测到 ${unrescuedCount} 处"嘴炮退敌"密度病（共 ${hitCount} 次对峙-说降事件，首次已豁免）`
      : `Detected ${unrescuedCount} talk-down crutch hits (out of ${hitCount} total standoff-talkdown events, first occurrence exempted)`);
    advice.push(zh
      ? '说降不是开关是博弈——给对峙来回（谈条件/开价/凭什么/你先放下）、外力压制（警察包围/狙击锁定/夺下武器）、或时间消耗（僵持数小时/僵局/夜色渐深），让放下武器有来路有代价'
      : 'Persuasion is not a switch but a bargain - give the standoff back-and-forth (terms/price/why should i/you first), external pressure (police surround/sniper lock/disarmed), or time cost (hours-long stalemate/nightfall), so putting the weapon down has a source and a price');
  }

  return {
    score,
    hitCount,
    unrescuedCount,
    hits,
    issues,
    advice,
  };
}
