import { isSceneHeaderLine } from './script-scenes';
/**
 * 野战手术秒成功检测（v2.120 块128，创作能力类）
 * ------------------------------------------------------------------
 * 病象：无资质角色在客厅/仓库/废墟里取子弹、缝合、正骨、接生，
 *   患者下一拍就没事了——零感染零并发症零失败：
 *     △陈默在客厅茶几上给他取子弹。
 *     陈默：血止住了，没事了。
 *     △He digs the bullet out on the kitchen table.
 *     He: She's fine now.
 * 一次绝境施救是高光，第二次观众开始皱眉，第三次观众直接看穿：
 * 医学是纸糊的门槛，只有剧情需要时才拦人。手术的账要当面算——
 * 资质来路、过程代价、或专业求助，一样都不能少。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - instantMarksman：管"无来路枪枪上靶"（武技零失败），本引擎
 *    管"无资质手术秒成功"（医术零失败）——同属零成本技能白给，
 *    一个罚枪法开挂，一个罚刀法开挂；
 *  - instantEscape：管"束缚秒脱"（绳/铐/锁自己失效，障碍失效），
 *    本引擎管"手术秒成功"（高门槛操作零失败，技能成功）——前者
 *    管障碍白给，本引擎管操作白给；
 *  - instantHack：管电子系统秒破（防火墙三下键盘崩塌），本引擎
 *    管人体系统秒修（血肉之躯茶几上开刀）——一个罚键盘开挂，
 *    一个罚手术刀开挂；
 *  - allergy/poison/paralysis/terminal-on-cue：管疾病发作时机与
 *    康复时间阀（病什么时候来、多久能好），本引擎管医疗操作成功
 *    率（谁来做、在哪做、做多干净）——前者管时间阀门，本引擎管
 *    技能阀门；
 *  - plotArmor：管物理安保放水（守卫恰好睡着/摄像头恰好坏了），
 *    本引擎管医学门槛放水（感染/大出血/麻醉风险全部缺席）。
 *
 * "零成本专技"家族第七员（instant-deduction 零成本推理 →
 * records-on-demand 零成本查档 → instant-hack 零成本破防 →
 * instant-marksman 零成本武技 → instant-language 零成本语言 →
 * instant-escape 零成本逃脱 → instant-surgery 零成本医术——
 * 七维互补覆盖专业技能白给的密度病）。本引擎让位 instantMarksman
 * 入池（零失败技能镜像兄弟退役：枪法零失败 vs 手术零失败，结构
 * 同构语义同向）。
 *
 * 判定（镜像 instant-marksman 单型双锚）：
 *  - 医疗操作锚（取子弹/缝合/正骨/接生/开刀/气管切开/清创/截肢
 *    + digs the bullet out/stitches up/deliver the baby/field
 *    surgery/tracheotomy/sets the bone…）与非正规环境/土法工具锚
 *    （客厅/厨房/仓库/废墟/车里/白酒消毒/缝衣针/鱼线/没打麻药 +
 *    kitchen table/warehouse/vodka/sewing needle/fishing line/
 *    without anesthesia…）±2行窗口共现 → 构成一次"野战手术"事件；
 *    双条件缺一不可——纯医疗操作无野战语境放行（正规手术是戏），
 *    纯环境无操作放行（日常场景）；
 *  - rescue：① 资质锚（军医/外科医生/护士/卫生员/学过医/急救
 *    培训 + army doctor/surgeon/nurse/medic/med school/first-aid
 *    training…）——操作者有来路，不是张嘴就开刀；② 代价锚（感染/
 *    发烧三天/手抖/昏过去/大出血/后遗症 + infection/fever/hands
 *    shaking/passed out/scar/complication…）——手术有代价，不是
 *    下一拍没事了；③ 求助锚（打电话问医生/视频连线/按医生指导 +
 *    called the doctor/on the phone with/guided by/following the
 *    manual…）——有专业指导，不是闭眼硬来；
 *  - 场景头行不参与任何词表匹配；rescue 三路全窗口扫描（资质/代价
 *    词常出现在操作行自身的舞台提示里，排除锚行会漏检，固化坑⑧）；
 *  - 相邻 ≤2 行的操作表述合并为同一事件（跨场景头不合并）；事件
 *    end 取窗口内最后一个锚行（保证 rescue 扫描覆盖锚行之后）；
 *  - 第 1 次豁免（一次绝境施救是高光），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantSurgeryHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有资质来路/过程代价/专业求助（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantSurgeryResult {
  score: number;
  /** 野战手术事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantSurgeryHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 医疗操作锚：高门槛医疗操作行为信号 */
const MEDOP_ZH = /取子弹|取出子弹|取出了子弹|把子弹取出来|把子弹取了出来|取出弹头|取出了弹头|剜出子弹|弹片取出|拔出?弹头|缝合|缝了?[一二三几]?[针针脚]|缝针|缝伤口|缝了?[几三]?下|正骨|正了骨|接骨|接上了骨|骨头复位|关节复位|复了位|接生|助产|剖腹产?|剖腹取子|开膛|开刀|动手术|做手术|气管切开|环甲膜穿刺|清创|截肢|导尿|胸腔穿刺|抽胸腔积液|胸腔引流|钻孔引流/;

const MEDOP_EN = /\b(?:dig(?:s|ging)? the bullet out|take(?:s)? the bullet out|pull(?:s|ed)? the bullet out|get(?:s|ting)? the bullet out|extract(?:s|ed|ing)? the bullet|remove(?:s|d)? the (?:bullet|shrapnel)|shrapnel removal|stitch(?:es|ed|ing)? ?(?:him|her|them|it|the wound)? ?up|stitch(?:es|ed)? the wound|suture[sd]?|deliver(?:s|ed|ing)? the baby|deliver(?:s|ed|ing)? (?:her|his|the) baby|field (?:surgery|amputation)|tracheotomy|tracheostomy|cricothyrotomy|perform(?:s|ed|ing)? (?:surgery|an operation|a tracheotomy|an amputation)|sets? (?:his|her|the) (?:broken )?(?:bone|arm|leg|shoulder|knuckles)|bone[- ]setting|realign(?:s|ed|ing)? the (?:bone|joint)|pop(?:s|ped)? (?:his|her)? ?(?:shoulder|bone)? ?back (?:in|into place)|emergency amputation|amputat\w+|debrid(?:e|es|ed|ing) (?:the wound|it))\b/i;

/* 非正规环境/土法工具锚：野战语境信号 */
const RAWENV_ZH = /客厅|厨房|仓库|废墟|工棚|船上|车里|车厢|山洞|地下室|阁楼|野外|荒野|树林|帐篷|民房|农家|土炕|茶几|餐桌|饭桌|门板上|桌子上|地板上|吧台上|后厨|柴房|牛棚|马厩|渔船|货舱|矿洞|桥洞|白酒消毒|烈酒消毒|烧红的?刀|烧红的?剪刀|缝衣针|鱼线|麻线|纳鞋底的?线|烈酒|水果刀|瑞士军刀|生锈的?剪刀|没打麻药|没有麻药|无麻药|没消毒|就着月光|就着手电/;

const RAWENV_EN = /\b(?:kitchen table|living room|warehouse|ruins|abandoned (?:factory|building|warehouse)|barn|cabin|tent|cave|mine shaft|basement|attic|on the floor|workbench|dining table|coffee table|on a door|plank|truck bed|back of (?:the|a) (?:car|truck|van)|fishing boat|fish(?:ing)? line|sewing (?:needle|kit)|suture kit|vodka|whisk(?:e)?y|liquor|boil(?:ed)? (?:the )?knife|red[- ]hot knife|heated (?:knife|blade)|flame[- ]sterilized|without anesthesia|no anesthetic|no painkillers|bare hands|swiss army knife|rusty (?:knife|blade|scissors)|flashlight|by lantern light)\b/i;

/* rescue A：资质来路锚——操作者有专业背景（跳过锚行） */
const QUAL_ZH = /军医|外科医生|内科医生|医生|大夫|护士|医护人员|战地医|卫生员|红十字会|急救培训|学过医|医学院|读过医|念过医|行医|从医|骨科医生|兽医|接生婆|稳婆|法医|部队里?(?:当过|干过)?医护|医院工作/;

const QUAL_EN = /\b(?:army doctor|field medic|combat medic|medic|surgeon|nurse|doctor|physician|paramedic|veterinarian|vet|midwife|medical training|med(?:ical)? school|studied medicine|went to med|used to practice|practiced medicine|residency|first[- ]aid (?:training|course|certified)|red cross|coroner)\b/i;

/* rescue B：过程代价锚——手术有代价（跳过锚行） */
const COST_ZH = /差点死|差点没挺过来|差点没救回来|死里逃生|感染|发炎|伤口恶化|化脓|溃烂|发烧|高烧|发热|手抖|抖得|疼得|痛得|撕心裂肺|惨叫|昏过去|昏迷|休克|大出血|血止不住|失血过多|落下了?病根|后遗症|疤痕|落下疤|瘸了|昏睡|躺了[一二三几]?天|咬着?布|疼晕过去/;

const COST_EN = /\b(?:infect\w*|inflam\w*|pus|fester\w*|fever|sepsis|almost (?:died|lost (?:him|her|them))|nearly (?:died|lost)|barely (?:survived|made it)|couldn'?t save|hands? (?:shaking|trembling)|trembled|shaking (?:hands|fingers)|scream(?:ed|ing)|passed out|blacked? out|fainted|bled out|bleeding won'?t stop|hemorrhag\w*|scar(?:red|ring)?|permanent (?:damage|nerve)|aftermath|complication|agony|excruciating|bit(?:ing)? (?:down on )?(?:the belt|a strap|cloth))\b/i;

/* rescue C：专业求助锚——有专业指导（跳过锚行） */
const GUIDE_ZH = /打电话问医生|打电话给医生|给医院打电话|视频连线|视频通话|连线医生|按(?:着)?医生(?:的)?(?:指导|指示|建议)|医生(?:的)?指导|远程指导|照着医书|照着急救手册|按说明书|问过医生/;

const GUIDE_EN = /\b(?:call(?:ed|ing)? (?:the )?(?:doctor|hospital)|on the (?:phone|call) with (?:the )?(?:doctor|surgeon)|video[- ]?call(?:ed|ing)? (?:the )?doctor|walked (?:him|her|them) through|talked (?:him|her|them) through|guided by|following (?:the )?(?:doctor|manual|guide|instructions|first[- ]aid manual)|step[- ]by[- ]step|as instructed by)\b/i;

/**
 * 纯函数：检测"野战手术秒成功"的零成本医术密度病。
 */
export function instantSurgery(draft: string): InstantSurgeryResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const medopRe = zh ? MEDOP_ZH : MEDOP_EN;
  const rawenvRe = zh ? RAWENV_ZH : RAWENV_EN;
  const qualRe = zh ? QUAL_ZH : QUAL_EN;
  const costRe = zh ? COST_ZH : COST_EN;
  const guideRe = zh ? GUIDE_ZH : GUIDE_EN;

  /* pass0：预计算每行的场景 id（用于 pass2 窗口跨场景头排除） */
  const sceneIdOf: number[] = new Array(rawLines.length).fill(0);
  let sceneCounter = 0;
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) sceneCounter += 1;
    sceneIdOf[i] = sceneCounter;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasM: boolean[] = new Array(rawLines.length).fill(false);
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasM[i] = medopRe.test(line);
    hasR[i] = rawenvRe.test(line);
  });

  /* pass2：操作行与 ±2 行内的野战环境锚配对成事件（相邻 ≤2 行操作行合并，窗口不跨场景头） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasM[i]) return;
    const m = raw.match(medopRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的操作表述合并为同一事件（跨场景头不合并）；
           合并时以新操作行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const myScene = sceneIdOf[i];
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasR[j] && sceneIdOf[j] === myScene,
    );
    if (win.length === 0) return; /* 纯操作无野战语境不构成事件（正规手术放行） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（资质来路/过程代价/专业求助；全窗口扫描——
     QUAL/COST/GUIDE 词常出现在操作行自身的舞台提示里，如"军医出身的
     陈默就着白酒给他取子弹"或"缝完就烧到三十九度"，排除锚行会漏检
     rescue，固化坑⑧） */
  const hits: InstantSurgeryHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次绝境施救是高光） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R2/R3 全部用全窗口扫描 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = qualRe.test(win) || costRe.test(win) || guideRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"野战手术秒成功"——客厅仓库里取子弹缝合，无资质无代价零失败，把医学门槛当纸糊，白给的医术撑不起生死的分量'
        : 'instant surgery again - digging bullets out and stitching up in a living room with zero training, zero cost and zero failure, treating medicine as a paper prop',
    });
  }

  const unrescuedCount = hits.filter((h) => !h.rescued).length;
  const score = unrescuedCount === 0 ? 100 : Math.max(20, 90 - unrescuedCount * 20);
  const issues: string[] = [];
  const advice: string[] = [];
  if (unrescuedCount > 0) {
    issues.push(zh
      ? `检测到 ${unrescuedCount} 处"野战手术秒成功"密度病（共 ${hitCount} 次野战手术事件，首次已豁免）`
      : `Detected ${unrescuedCount} instant-surgery crutch hits (out of ${hitCount} total field-surgery events, first occurrence exempted)`);
    advice.push(zh
      ? '医术不是道具是门槛——给操作者资质来路（军医/护士/兽医/急救培训/医学院肄业）、给过程代价（感染/高烧三天/手抖/差点死在台上/落下疤痕）、或给专业求助（打电话问诊/视频连线指导/照急救手册），让手术有来路有风险'
      : 'Surgery is a threshold, not a prop - give the operator credentials (army doctor/nurse/vet/first-aid training/med school dropout), give the process a cost (infection/days of fever/shaking hands/nearly died/scarring), or give professional guidance (call the doctor/video walkthrough/follow the manual), so the operation has a source and a risk');
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
