import { isSceneHeaderLine } from './script-scenes';
/**
 * 加害者秒悔悟检测（v2.118 块126，创作能力类）
 * ------------------------------------------------------------------
 * 病象：加害者上一秒还在作恶、陷害、伤害，下一秒突然"我错了"——
 *   周父（指着鼻子）：你给我滚出去！我不认你这个女儿！
 *   周父（猛地一拍桌）：……我不该这样对你。
 *   周父：是我错了，原谅爸爸好不好。
 *   FATHER (shouting): Get out! You're dead to me!
 *   FATHER (lowers hand): ...I shouldn't have done that.
 *   FATHER: I was wrong. Forgive me.
 * 第一次悔悟是冲突余波，病在它被当成万能赎罪阀：
 *  1) 悔悟没有反思——只一句"我错了"，没有"我为什么这样"、
 *     "她有多委屈"的内心过场，戏靠悔悟续气；
 *  2) 悔悟不增信息——第二遍第三遍还是同一句"我错了"，台词零
 *     新信息，人物不长记性只长愧疚；
 *  3) 悔悟替代赎罪——观众以为他要赎罪了，结果只是又悔悟一遍，
 *     把戏剧张力用一句话掏空。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - apology-loop：管"加害方反复道歉≥3次无赎罪"（过度道歉），
 *    本引擎管"加害方作恶→秒级悔悟"（一次性秒悔悟）——前者
 *    管循环密度，后者管转换密度，结构镜像情感同向；
 *  - fight-reconcile-crutch：管"吵架→秒和"（双方和解，无重伤
 *    前提），本引擎管"作恶→秒悔"（加害方单方悔悟，有作恶
 *    前提）——前者管关系层和解，本引擎管态度层悔悟；
 *  - deathbed-confession：管"临终悔悟招供"（临终为时已晚的
 *    悔悟，时间锁死），本引擎管"平时秒悔悟"（无时间锁，无
 *    赎罪）——前者管临终阀门，本引擎管平时阀门；
 *  - villain-overconfession：管"反派炫耀式自爆"（反派炫耀
 *    机密），本引擎管"加害方悔悟式认错"（加害方认错）——
 *    前者管反派自爆，本引擎管加害方悔悟，情感指向相反；
 *  - empty-vow：管"复仇宣言空转"（被伤害方宣言复仇无兑付），
 *    本引擎管"加害方悔悟宣言空转"（加害方宣言悔悟无赎罪），
 *    结构镜像、情感指向相反。
 *
 * "冲突解决"家族第三员（apology-loop 过度道歉 + fight-reconcile
 * 吵架秒和 + instant-repentance 加害方秒悔悟——三维互补覆盖冲突
 * 解决不当的密度病）。本引擎让位 instantTrust 入池（免费情感白给
 * 族镜像兄弟退役：信任白给 vs 悔悟白给，结构同构）。
 *
 * 判定（镜像 fight-reconcile 单型双锚）：
 *  - 作恶锚（行凶/作恶/陷害/灭口/伤害/打/骂/赶/逼/害 + hurting/
 *    harming/killing/framing/harming/forcing/yelling at/driving
 *    away/threatening/abusing…）与悔悟锚（我错了/我不该/我后悔/
 *    是我不对/怪我/我有罪/原谅我 + i was wrong/i shouldn't have/
 *    i regret/it's my fault/forgive me/i overreacted…）±2行窗口
 *    共现 → 构成一次"秒悔悟"事件；双条件缺一不可——纯作恶无悔悟
 *    放行（作恶本身是戏）、纯悔悟无作恶放行（正常悔悟）；
 *  - rescue：① 内心过场锚（想了想/犹豫了一下/挣扎/内心斗争 +
 *    hesitated/struggled/doubt/inner conflict/thought about it
 *    …）——悔悟有内心，不是开关是产物；② 外部触发锚（看到/
 *    听到/想起/被提醒 + saw/heard/remembered/reminded/was told
 *    …）——悔悟有外因，不是凭空而来；③ 具体赎罪锚（退股/赔偿/
 *    自首/撤案/认罪/退位/辞职 + compensate/surrender/return/
 *    resign/step down/confess/serve time…）——悔悟落到具体赎罪；
 *  - 场景头行不参与任何词表匹配；①③rescue 扫描跳过作恶行与悔悟
 *    行自身，②全窗口扫描（外部触发常在场景头或旁白）；
 *  - 相邻 ≤2 行的悔悟表述合并为同一事件（跨场景头不合并）；
 *    事件 end 取窗口内最后一个锚行（保证 rescue 扫描覆盖锚行之后）；
 *  - 第 1 次豁免（一次作恶-悔悟是冲突余波），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantRepentanceHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有内心过场/外部触发/具体赎罪（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantRepentanceResult {
  score: number;
  /** 秒悔悟事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantRepentanceHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 作恶锚：加害方对受害方施加伤害的行为信号 */
const WRONG_ZH = /行凶|作恶|陷害|灭口|伤害|杀害|毒打|痛打|殴打|抽打|扇了?[^。！？\n]{0,4}(?:耳光|巴掌)|打了?他|打了?她|骂了?他|骂了?她|赶走|赶出去|赶了?出去|滚出去|滚蛋|逼她|逼他|逼着|威胁|恐吓|勒索|敲诈|虐待|凌辱|羞辱|侮辱|打压|排挤|陷害|栽赃|诬陷|诬告|灭口|暗算|算计|坑害|祸害|伤害了?|伤了?他|伤了?她|害了?他|害了?她|动了?手|下手|痛下杀手|狠心|狠下心|黑心|抬手要打|要打|举手要打|扬手要打|抡起|挥拳|动了?拳头|举起了?拳头/;

const WRONG_EN = /\b(?:hurt(?:ing)? (?:him|her|me|you|them)|harmed|harming|killed|murdered|framed|set up|wronged|abused|abusing|insulted|humiliated|threatened|blackmailed|extorted|bullied|beating|beat (?:him|her|me|you)|slapped|punched|kicked|shoved|yelled (?:at|on) (?:her|him|me|you)|screamed (?:at|on) (?:her|him|me|you)|drove (?:her|him) (?:away|out)|threw (?:her|him) out|kicked (?:her|him) out|got rid of (?:her|him)|fired (?:her|him)|threatened (?:her|him|me|you|them) (?:with)?|forced (?:her|him|me|you|them) (?:to)?|coerced|abused (?:her|him|me|you|them))\b/i;

/* 悔悟锚：加害方反思性的认错表态 */
const REPENT_ZH = /我错了|我不该|我后悔|是我[的错]?不对|是我[的错]?不好|我有罪|我该死|怪我|都怪我|千错万错[^\n。！？]{0,8}我的错|我不应该|是我失[算策]|是我鲁莽|是我冲动|是我[太]?过分|是我[太]?过份|是我[太]?绝|是我[太]?狠|是我[太]?偏[面心]|郑重(?:道歉|认错)|正式道歉|深深(?:悔悟|歉意)|真诚(?:悔悟|歉意)|我悔悟|我忏悔|我认罪|我认罚|原谅我|请原谅|赔罪|赔不是/;

const REPENT_EN = /\b(?:i was wrong|i was mistaken|i shouldn'?t have|i shouldn'?t have done (?:that|this)|i regret(?:ted)? (?:what i did|it|my actions)|i regret|i'?m (?:so )?sorry|i apologize|i owe you an apology|my fault|my mistake|forgive me|please forgive me|i overreacted|i was out of line|i was an idiot|i'?m (?:truly )?sorry|i (?:was )?wrong|i (?:was )?too harsh|i (?:was )?too hard (?:on|for) (?:her|him|you|them)|i shouldn'?t have (?:said|done|acted|treated|hurt)|it'?s my fault|i feel terrible|i feel awful|i feel (?:so )?guilty|i feel bad|i take it back|i take (?:full )?responsibility|i was (?:too )?cruel|i was (?:too )?ruthless|i was (?:too )?rash|i was (?:too )?impulsive|i repented|i repent)\b/i;

/* rescue A：内心过场锚——悔悟有内心（跳过锚行） */
const INTERNAL_ZH = /想了想|犹豫了?一下|挣扎|内心斗争|心[里内]斗争|心[里内]矛盾|天人交战|天人较量|思前想后|反复[思掂]|掂量|斟酌|迟疑|犹豫不决|内心煎熬|心里挣扎|心里矛盾|心头[一阵]+?酸|心[头里]发酸|百感交集|五味杂陈|纠结了?[^。！？\n]{0,4}半天|心[头里内][一]?.*?(?:软|沉|酸|痛|紧|慌|乱)/;

const INTERNAL_EN = /\b(?:hesitated|hesitation|struggled|struggle|inner conflict|inner turmoil|conflicted|torn|in two minds|wavered|wavering|doubted|doubt|second-guessed|thought it over|thought twice|reconsidered|reconsideration|agonized|agonizing|felt torn|felt conflicted|wrestled with (?:myself|herself|himself|it)|battled (?:with|within) (?:myself|herself|himself|his conscience|her conscience)|wrestling with (?:myself|her conscience|his conscience)|my conscience|her conscience|his conscience|a pang of (?:guilt|conscience|regret)|a flicker of (?:guilt|doubt|regret))\b/i;

/* rescue B：外部触发锚——悔悟有外因（全窗口扫描，常在场景头/旁白） */
const TRIGGER_ZH = /(?:看到|看见)[^。！？\n]{0,8}(?:哭|泪|流泪|伤|痛|血|失望|绝望|心碎)|听见[^。！？\n]{0,8}(?:哭|喊|求|话|声音)|听到[^。！？\n]{0,8}(?:哭|喊|求|话|声音)|想起[^。！？\n]{0,12}(?:过去|从前|往事|当年|小时候|曾经|相|情|恩|诺|誓|约)|被提醒|被点醒|被骂醒|幡然醒悟|恍然[觉悟]|猛然[觉醒]|突然[觉醒]|猛地?意识到|突然想起|忽然想起|恍然大悟|如梦初醒|当头棒喝|一语惊醒|看见[^。！？\n]{0,8}(?:照片|遗物|旧物|回忆|从前|当年|小时候)/;

const TRIGGER_EN = /\b(?:saw (?:her|him|them) (?:cry|crying|sob|sobbing|bleed|bleeding|hurt|injured|suffering|broken|shattered|defeated)|heard (?:her|him|them) (?:cry|crying|sob|sobbing|beg|plead|scream|shout)|saw (?:the tears|her tears|his tears|the blood|the look|the pain)|remembered (?:her|him|them|the past|old times|how it used to be|her smile|his smile|the promise|the vow)|was reminded|was woken up|snapped out of it|had an epiphany|sudden realization|suddenly realized|it hit (?:me|her|him)|dawned on (?:me|her|him)|like a slap|a wake-up call|a reality check)\b/i;

/* rescue C：具体赎罪锚——悔悟落到具体行动（跳过锚行） */
const ACT_ZH = /自首|投案|去(?:警察局|派出所|公安局)|报警|立案|撤案|起诉|退股|转让(?:股权|股份)|退还|赔偿|赔付|补偿|赔钱|弥补|换药|出院|手术|认罪|认罚|坐牢|蹲监狱|进监狱|看守所|顶罪|黑锅|退位|让位|辞职|下台|引咎|公开道歉|记者会|发布会|登报|公告|认错声明|赔礼|赔不是|退钱|退物|退还财物|归还|归还财物/;

const ACT_EN = /\b(?:turn(?:ed)? (?:myself|himself|herself) in|surrender(?:ed)?|go to the (?:police|cops)|press(?:ed)? charges|drop(?:ped)? the (?:charges|case)|sue|lawsuit|return(?:ed)? (?:the shares|the money|what i took|everything|her property|his property)|compensat\w*|reimburse\w*|pay (?:back|you back|them back|her back|him back)|make amends|make restitution|resign(?:ed)?|step(?:ped)? down|held a press conference|publicly apologiz\w*|issue(?:d)? a (?:statement|apology)|confess(?:ed)?|plead(?: guilty)?|serve(?:d)? time|went to (?:prison|jail)|apologiz\w* in person|return(?:ed)? (?:what was taken|her money|his money|her property|his property))\b/i;

/**
 * 纯函数：检测"加害者秒悔悟"的无反思赎罪密度病。
 */
export function instantRepentance(draft: string): InstantRepentanceResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const wrongRe = zh ? WRONG_ZH : WRONG_EN;
  const repentRe = zh ? REPENT_ZH : REPENT_EN;
  const internalRe = zh ? INTERNAL_ZH : INTERNAL_EN;
  const triggerRe = zh ? TRIGGER_ZH : TRIGGER_EN;
  const actRe = zh ? ACT_ZH : ACT_EN;

  /* pass0：预计算每行的场景 id（用于 pass2 窗口跨场景头排除） */
  const sceneIdOf: number[] = new Array(rawLines.length).fill(0);
  let sceneCounter = 0;
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) sceneCounter += 1;
    sceneIdOf[i] = sceneCounter;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasW: boolean[] = new Array(rawLines.length).fill(false);
  const hasP: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasW[i] = wrongRe.test(line);
    hasP[i] = repentRe.test(line);
  });

  /* pass2：悔悟行与 ±2 行内的作恶锚配对成事件（相邻 ≤2 行悔悟行合并，窗口不跨场景头） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasP[i]) return;
    const m = raw.match(repentRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的悔悟表述合并为同一事件（跨场景头不合并）；
           合并时以新悔悟行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const myScene = sceneIdOf[i];
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasW[j] && sceneIdOf[j] === myScene,
    );
    if (win.length === 0) return; /* 纯悔悟无作恶不构成事件（正常悔悟放行） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（内心过场/外部触发/具体赎罪；全窗口扫描——
     INTERNAL/ACT 词常出现在悔悟行自身的舞台提示里，如"（手停在半空，
     天人交战）：……是我错了"或"是我错了，明天我就去撤诉"，排除锚行
     会漏检 rescue，固化坑⑧） */
  const hits: InstantRepentanceHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次作恶-悔悟是冲突余波） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R2/R3 全部用全窗口扫描 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = internalRe.test(win) || triggerRe.test(win) || actRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"秒悔悟"——作恶行凶后一句"我错了"，跳过反思与赎罪，把悔悟当万能赎罪阀，白给的悔悟撑不起作恶的分量'
        : 'instant repentance again - harming then a single "I was wrong", skipping reflection and amends, treating repentance as a universal redemption valve',
    });
  }

  const unrescuedCount = hits.filter((h) => !h.rescued).length;
  const score = unrescuedCount === 0 ? 100 : Math.max(20, 90 - unrescuedCount * 20);
  const issues: string[] = [];
  const advice: string[] = [];
  if (unrescuedCount > 0) {
    issues.push(zh
      ? `检测到 ${unrescuedCount} 处"加害者秒悔悟"密度病（共 ${hitCount} 次作恶-悔悟事件，首次已豁免）`
      : `Detected ${unrescuedCount} instant-repentance crutch hits (out of ${hitCount} total harm-repent events, first occurrence exempted)`);
    advice.push(zh
      ? '悔悟不是开关是产物——给加害方内心过场（犹豫/挣扎/天人交战）、外部触发（看到泪/血/旧物/旧情）、或具体赎罪行动（自首/赔偿/退股/认罪），让"我错了"有来路有去处'
      : 'Repentance is not a switch but a product - give the perpetrator an inner process (hesitation/struggle), an external trigger (saw tears/blood/old keepsakes), or concrete amends (surrender/compensation/return shares/confession), so "I was wrong" has a source and a destination');
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
