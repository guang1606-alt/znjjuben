import { isSceneHeaderLine } from './script-scenes';
/**
 * 当众倒戈白给检测（v2.121 块129，创作能力类）
 * ------------------------------------------------------------------
 * 病象：主角当众揭露/演讲/亮出真相，上一秒全场还在骂他，下一秒
 *   "全场哗然""众人纷纷倒戈""所有人都站到了他一边"——零质疑、
 *   零分裂、零代价，群体信任像开关一样一场戏全拨过去：
 *     △陈默当众揭穿了他。
 *     △全场哗然。
 *     △众人纷纷倒向了他。
 *     △He exposed him in front of everyone.
 *     △The crowd turned.
 * 一次打脸是爽点，场场靠倒戈解决冲突观众就看穿了：人群不是
 * 变量是背景板。群体忠诚的戏剧价值在于挣得——铁证甩出去让众人
 * 自己看、人群里有反对声、揭露者付出真实代价，一样都不能少。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - stance-flip：管"同一角色个人立场无因横跳"（单人决定反转），
 *    本引擎管"群体当众倒戈"（多人忠诚转换）——前者管个人弧光，
 *    本引擎管群体反应；
 *  - instant-trust：管"初识方秒被托付"（一对一信任建立零过程），
 *    本引擎管"当众揭露后群体秒倒戈"（群体信任转换零摩擦）——
 *    前者管一对一托付，本引擎管群际态度；
 *  - twist-density-score：只数反转密度不判反转是否挣来，本引擎
 *    专判群体反转的摩擦成本；
 *  - witness-gratuity：管"关键时刻证人/证据白给出现"（供给白给），
 *    本引擎管"人群对揭露的服从反应白给"（接受白给）——前者管
 *    证人从哪来，本引擎管人群怎么信；
 *  - talk-down-crutch：管"长篇说教压服对手"（一对一说服拐杖），
 *    本引擎管"当众表演感召群体"（一对多感召白给）；
 *  - villain-overconfession：管反派自爆供出机密，本引擎管群众
 *    听信倒戈——前者管说漏嘴，本引擎管听的人。
 *
 * "免费关系"家族第六员（records-on-demand 免费情报 →
 * help-on-demand 免费人力 → instant-trust 免费信任 →
 * instant-kinship 免费亲情 → instant-love 免费爱情 → crowd-flip
 * 免费群众——六维互补覆盖关系白给的密度病）。本引擎让位
 * instantKinship 入池（免费关系族镜像兄弟退役：血缘速热 vs
 * 群体忠诚速热，同构"关系白给"，语义最近）。
 *
 * 判定（镜像 instant-surgery 单型双锚）：
 *  - 群体服从锚（倒戈/哗然/齐声/齐刷刷/鸦雀无声/掌声雷动 +
 *    群体词×反应词复合段 + the crowd turned/everyone gasped/
 *    the whole room erupted/one by one…）与揭露锚（揭穿/摊牌/
 *    亮出/宣读/放录音/坦白 + exposed/came clean/told everyone
 *    the truth/played the tape…）±2行窗口共现 → 构成一次"当众
 *    倒戈"事件；双条件缺一不可——纯群体反应无揭露放行（庆祝
 *    场面是戏），纯揭露无群体反应放行（揭露本身就是戏）；
 *  - rescue：① 质疑摩擦锚（仍有人/有人不服/半信半疑/议论纷纷/
 *    嘘声 + some still refused/not everyone bought it/boos/
 *    remained skeptical…）——人群有分裂，不是铁板一块；② 硬
 *    证据锚（铁证/录音/录像/账本/亲子鉴定/白纸黑字 + the tape/
 *    the ledger/DNA test/in writing…）——倒戈是证据挣来的，不
 *    是演讲感召的；③ 代价锚（得罪/树敌/身败名裂/豁出去/当众
 *    下跪 + made enemies/burned his reputation/kneeled in
 *    public…）——揭露者付出真实代价；
 *  - 场景头行不参与任何词表匹配；rescue 三路全窗口扫描（证据/
 *    代价词常出现在事件行自身的舞台提示里，如"录音在大厅里响起
 *    来""他得罪了赵家"，排除锚行会漏检，固化坑⑧）；
 *  - 相邻 ≤2 行的群体服从表述合并为同一事件（跨场景头不合并）；
 *    事件 end 取窗口内最后一个锚行（保证 rescue 扫描覆盖锚行之后）；
 *  - 第 1 次豁免（一次打脸是爽点），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface CrowdFlipHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有质疑摩擦/硬证据/付出代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface CrowdFlipResult {
  score: number;
  /** 当众倒戈事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: CrowdFlipHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 群体服从锚：人群集体态度转换/服从反应信号（固定短语自带群体性 + 群体词×反应词复合段） */
const FLIP_ZH = /倒戈|倒向|哗然|群情激[奋愤]|群情沸腾|齐声|异口同声|齐刷刷|众望所归|人心所向|民心所向|众叛亲离|掌声雷动|掌声如雷|雷鸣般的?掌声|全场肃然|满座肃然|鸦雀无声|落针可闻|(?:全场|满场|满堂|众人|人群|大家|所有人|在场的人|在场所有人|宾客|来宾|员工|职员|村民|乡亲|观众|股东|长辈|族人|族老|记者们?|家人们?)[^。\n]{0,12}(?:纷纷|全都|齐齐|一齐|一同)?(?:倒戈|倒向|起立|站起|鼓掌|落泪|流泪|动容|信服|服气|跪下|下跪|跪了|道歉|认错|致敬|欢呼|叫好|改口|松口|让开)/;

const FLIP_EN = /\b(?:the crowd (?:turned|roared|erupted|cheered|gasped|wept|fell silent|went wild|stood|bowed)|everyone (?:turned|gasped|cheered|wept|stood|applauded|bowed|fell silent|erupted)|the whole room (?:fell silent|erupted|cheered|roared|went quiet)|the entire (?:crowd|hall|room)|the audience (?:erupted|rose|cheered|wept|applauded|gasped)|one by one (?:they|the|people)|turned the tide|side(?:d)? with (?:him|her|them)|rallied behind (?:him|her|them)|stood behind (?:him|her|them)|in unison|unanimous(?:ly)?|all (?:bowed|knelt|wept|cheered|stood)|collectively (?:turned|bowed|knelt))\b/i;

/* 揭露锚：当众揭露/摊牌/亮证据行为信号 */
const REVEAL_ZH = /揭穿|揭发|揭破|戳穿|拆穿|道破|说破|摊牌|摊了牌|亮出|亮了出?来|出示|公布(?:了)?(?:真相|身份|秘密|实情)|真相大白|说出(?:了)?真相|真相(?:说了出来|公之[于于])|道出|揭出|抖出|捅出|坦白(?:了)?|坦承|曝光|曝出|甩出|拍出|丢出|放出?录音|放出?录像|宣读/;

const REVEAL_EN = /\b(?:expos\w+|reveal(?:s|ed|ing)?|came clean|confess(?:es|ed|ing)?|admit(?:s|ted|ting)?|laid (?:it|everything) (?:bare|out)|showed (?:everyone|them|the whole room)(?: the)? (?:tape|recording|video|photo|photos|proof|evidence|ledger|documents)|played the (?:tape|recording|video)|pulled out the (?:documents|contract|ledger|papers)|made (?:it|everything) public|told (?:everyone|everybody|them) the truth|the truth (?:came out|was out))\b/i;

/* rescue A：质疑摩擦锚——人群有分裂（跳过锚行） */
const DOUBT_ZH = /仍有人|还有人|有人(?:质疑|不信|不服|反对|反驳|冷笑|怒吼|喊道|喊了|嚷嚷|嘀咕|抗议)|半信半疑|将信将疑|议论纷纷|嘘声|起哄|不服气|仍不服/;

const DOUBT_EN = /\b(?:some(?:one)? (?:still )?(?:refused|doubted|questioned|objected|scoffed|jeered|protested)|not everyone (?:was )?(?:convinced|persuaded|bought it)|a few (?:people|voices) (?:still )?(?:doubted|objected|murmured|protested)|murmurs of doubt|objection|boos|booed|someone (?:shouted|yelled|screamed) (?:back|out)|remained skeptical|stayed (?:skeptical|unconvinced))\b/i;

/* rescue B：硬证据锚——倒戈是证据挣来的（跳过锚行） */
const EVIDENCE_ZH = /铁证|证据|录像|录音|监控|合同|文件|账本|字据|亲子鉴定|验血|滴血验亲|DNA|事实证明|白纸黑字|盖章|签了?字|按了?手印|人证物证/;

const EVIDENCE_EN = /\b(?:evidence|proof|the (?:tape|recording|footage|video|photos?|ledger|documents|contract|files|papers)|DNA (?:test|report)|paternity test|notarized|on record|in (?:black and )?writing|signed (?:contract|statement|affidavit)|stamped)\b/i;

/* rescue C：代价锚——揭露者付出真实代价（跳过锚行） */
const COST_ZH = /付出(?:了)?代价|得罪|树敌|名声扫地|名声尽毁|身败名裂|豁出(?:去|了)?|押上(?:了)?|赌上(?:了)?|拿命|拿前途|拿名声|不要命|当众下跪/;

const COST_EN = /\b(?:at the cost of|sacrific\w+|staked (?:everything|his|her)|risked (?:everything|his|her) (?:reputation|life|career)|made enemies|burned (?:his|her|their) (?:reputation|bridges)|humiliat\w+ (?:himself|herself)|paid (?:a|the) (?:heavy|dear|steep) price|gave up (?:everything|his|her)|offend(?:ed|ing)? (?:the|his|her)|kneel(?:ed|ing)? in public)\b/i;

/**
 * 纯函数：检测"当众倒戈白给"的群体忠诚零成本转换密度病。
 */
export function crowdFlip(draft: string): CrowdFlipResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const flipRe = zh ? FLIP_ZH : FLIP_EN;
  const revealRe = zh ? REVEAL_ZH : REVEAL_EN;
  const doubtRe = zh ? DOUBT_ZH : DOUBT_EN;
  const evidenceRe = zh ? EVIDENCE_ZH : EVIDENCE_EN;
  const costRe = zh ? COST_ZH : COST_EN;

  /* pass0：预计算每行的场景 id（用于 pass2 窗口跨场景头排除） */
  const sceneIdOf: number[] = new Array(rawLines.length).fill(0);
  let sceneCounter = 0;
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) sceneCounter += 1;
    sceneIdOf[i] = sceneCounter;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasF: boolean[] = new Array(rawLines.length).fill(false);
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasF[i] = flipRe.test(line);
    hasR[i] = revealRe.test(line);
  });

  /* pass2：群体服从行与 ±2 行内的揭露锚配对成事件（相邻 ≤2 行服从行合并，窗口不跨场景头） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasF[i]) return;
    const m = raw.match(flipRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的群体服从表述合并为同一事件（跨场景头不合并）；
           合并时以新服从行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const myScene = sceneIdOf[i];
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasR[j] && sceneIdOf[j] === myScene,
    );
    if (win.length === 0) return; /* 纯群体反应无揭露不构成事件（庆祝场面放行） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（质疑摩擦/硬证据/付出代价；全窗口扫描——
     DOUBT/EVIDENCE/COST 词常出现在事件行自身的舞台提示里，如
     "录音在大厅里响起来""他得罪了赵家这条路再也回不了头"，排除
     锚行会漏检 rescue，固化坑⑧） */
  const hits: CrowdFlipHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次打脸是爽点） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R2/R3 全部用全窗口扫描 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = doubtRe.test(win) || evidenceRe.test(win) || costRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"当众倒戈白给"——一场揭露就让全场态度齐刷刷翻转，零质疑零分裂零代价，把群体信任当开关拨，人群沦为给主角捧场的背景板'
        : 'crowd flip again - one revelation and the whole room flips in unison with zero doubt, zero division and zero cost, treating collective trust as a switch and the crowd as a cheering prop',
    });
  }

  const unrescuedCount = hits.filter((h) => !h.rescued).length;
  const score = unrescuedCount === 0 ? 100 : Math.max(20, 90 - unrescuedCount * 20);
  const issues: string[] = [];
  const advice: string[] = [];
  if (unrescuedCount > 0) {
    issues.push(zh
      ? `检测到 ${unrescuedCount} 处"当众倒戈白给"密度病（共 ${hitCount} 次群体倒戈事件，首次已豁免）`
      : `Detected ${unrescuedCount} crowd-flip crutch hits (out of ${hitCount} total crowd-flip events, first occurrence exempted)`);
    advice.push(zh
      ? '人群不是背景板是变量——给倒戈挣来：要么证据在场（铁证/录像/亲子鉴定甩出去让众人自己看），要么人群有分裂（有人仍骂/有人拂袖离场/有人报警），要么揭露者付出代价（身败名裂/得罪权贵/当众下跪）；更狠的写法是倒戈不完全——七成倒戈三成记恨，埋下一集反扑的种子'
      : 'The crowd is a variable, not a prop - earn the flip: hard evidence on the table (the tape, the ledger, the DNA report, let people see it themselves), a divided crowd (some still cursing, some walking out, someone calling the cops), or a real price paid (reputation burned, enemies made, kneeling in public); better still, flip only seventy percent - let thirty percent stay resentful and seed the backlash');
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
