import { isSceneHeaderLine } from './script-scenes';
/**
 * 过敏/哮喘剧情阀门 / 免疫系统当开关检测（v2.107 块115，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把角色的免疫系统当成随取随用的剧情开关，两种形态
 *   反复出现——
 *   A 接触秒发作/一口进急诊型：寿宴上夹一只虾、聚会上尝一口芒果、
 *     撸了两下猫，三行之内喉头水肿、过敏性休克、120 直接拉走；
 *     没有既存过敏史铺垫、没人提前问过食材、没人随身带急救针，
 *     过敏是制造危机、拆散宴席、逼男主英雄救美的即时炸弹；
 *   B 一针秒解除/下次还自己夹虾型：急救针一打，瞬间没事、活蹦
 *     乱跳，不留观、不随访、不终身忌口，宴会散场合同照签；下
 *     一集主角又自己夹起一只虾——免疫系统是编剧的暂停键：需要
 *     危机时一口虾进急诊，需要圆满时一针回正常。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里过敏从来不是病，
 *   是可以一键引爆又一键拆除的情节扳手，发作和痊愈双双贬值。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - faint-on-cue：晕倒阀门（晕倒掐断关键信息），管意识丧失机制，
 *    不管免疫病因；本引擎专管过敏/哮喘的发作与解除通道；
 *  - wound-on-cue：外伤战力阀门，伤口当开关；锚点（虾/芒果/
 *    荨麻疹/肾上腺素/EpiPen）与外伤词表正交；
 *  - terminal-diagnosis-on-cue（v2.106）：长期绝症的宣判与撤销，
 *    本引擎是急性免疫发作——休克再凶也是一顿饭内引爆又拆除；
 *  - pregnancy-on-cue/amnesia-on-cue/wake-on-cue：身体阀门家族
 *    其余成员，机制互不重叠；
 *  - emotional-aftermath 词表仅一处"过敏式"比喻，fake-choice 的
 *    "屏住呼吸"、paren-overdirect 的"喉头哽"均非过敏机制；
 *    romance-craft/family-craft/creativity 对过敏/哮喘零训诫。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A attack（接触秒发作）：
 *    EXPOSE 接触误食锚（吃/尝/夹芒果虾蟹海鲜花生坚果、摸猫碰花、
 *    被蜂蛰、误食 + ate/tasted shrimp/peanut/mango、stung by bee、
 *    petted the cat…）±2行与 REACT 发作锚共现；REACT 分两档——
 *    STRONG（喉头水肿/喘不上气/呼吸困难/窒息/过敏性休克/送急诊/
 *    当场倒下/气管堵 + throat closing/couldn't breathe/anaphylaxis/
 *    EpiPen/collapsed/rushed to ER…）自带危象语义直配；WEAK
 *    （红疹/荨麻疹/痒/打喷嚏/流鼻涕/咳嗽/气喘 + rash/hives/
 *    itchy/sneezing/coughing/wheezing…）必须在事件 ±3 行窗口内
 *    另有 ALLCTX 过敏语境锚（过敏(史/原/性)/哮喘/抗过敏/急救针 +
 *    allerg(y/ic/en)/asthma/antihistamine…），防普通咳嗽皮疹误判；
 *    纯吃海鲜无发作锚放行（普通家宴不归本引擎）；
 *  - 型B relief（一针秒解除）：
 *    TRIGGER 廉价解除锚（打了一针/急救针/肾上腺素/抗过敏药/激素针
 *    + EpiPen/shot of epinephrine/antihistamine/allergy shot/
 *    injection…）±2行与 FINE 整体秒愈锚共现；FINE 必须含瞬时修饰
 *    （立刻/马上/瞬间/一会儿 + 没事/好/恢复 + immediately/right
 *    away/in minutes + fine/recovered/back to normal/as if nothing
 *    happened…）；无触发物的缓慢好转（疹子两天才消）合法放行；
 *  - 相邻 ≤2 行的 EXPOSE/TRIGGER 行各自合并为同一事件（跨场景头
 *    不合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①KNOWN 既往史兑付——早就知道对X过敏/过敏史/随身携带
 *      急救针/聚餐前问过食材/翻配料表/从小忌口，发作不是天降；
 *      ②APROCESS 急救过程——急诊留观/吸氧/激素输液/抢救数小时/
 *      监护/住院观察，危象被规范处置而不是打完针就走；
 *      ③APRICE 代价真兑付——ICU/气管切开/插管/差点死/再晚一步
 *      就没救过来，阀门这次真掐到濒死；"打了一针就好"不救 attack
 *      （它本身就是型B病象）；
 *    型B：①RPROCESS 后续处置——留观一夜/留观数小时/激素吃几天/
 *      随访复查，秒愈不是拔针就散场；②PARTIAL 慢性尾巴——随身
 *      携带急救针/随时可能复发/终身忌口/远离海鲜芒果猫/慢性哮喘，
 *      暂停键留着尾巴；③COST 社交代价——寿宴婚宴搞砸/合同黄了/
 *      心理阴影再不敢外食/当众失态的代价，圆满有刺痛价格；
 *  - 第 1 次豁免（一次过敏桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface AllergyOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** attack=接触秒发作型；relief=一针秒解除型 */
  kind: 'attack' | 'relief';
  /** 是否有既往史/急救过程/濒死代价/留观尾巴/社交代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface AllergyOnCueResult {
  score: number;
  /** 过敏阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: AllergyOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：EXPOSE 接触误食锚 ===== */
const EXPOSE_ZH_RE = new RegExp(
  /(?:吃|喝)(?:了|过)?(?:一?口|几口|点|些|粒)?(?:芒果|虾|螃蟹|蟹|海鲜|花生|坚果|菠萝|牛奶|鸡蛋|桃|蚕蛹|贝类)/.source
  + '|' + /尝了[^。！？\n]{0,4}(?:芒果|虾|海鲜|花生|菠萝|蟹)/.source
  + '|' + /(?:夹|叉|塞|送|剥)(?:了|起)?[^。！？\n]{0,4}(?:虾|蟹|海鲜|芒果|花生|贝类)/.source
  + '|' + /(?:碰|摸|抱|撸)(?:了|过)?(?:一?下)?(?:花|猫|狗|毛绒玩具)|闻(?:了)?(?:一下)?(?:花|花粉)/.source
  + '|' + /被(?:蜜蜂|马蜂|野蜂|虫子)(?:蛰|叮|蜇)了?|蜂(?:蛰|蜇)/.source
  + '|' + /误食/.source,
);

const EXPOSE_EN_RE = new RegExp(
  /(?:\bate\b|\btook a bite of\b|\btasted\b|\bbit into\b|\bdrank\b)[^.?!\n]{0,24}?(?:shrimp|prawns?|mango|peanuts?|seafood|\bnuts?\b|shellfish|crab|lobster|\beggs?\b|dairy|milk)/.source
  + '|' + /(?:shrimp|prawns?|mango|peanuts?|seafood|shellfish|crab|lobster)[^.?!\n]{0,16}?(?:\bate\b|\btasted\b)/.source
  + '|' + /\bstung by a (?:bee|wasp|hornet)\b/.source
  + '|' + /(?:touched|petted|pet|held|hugged|brushed against|came into contact with)[^.?!\n]{0,18}?(?:\bcat\b|\bdog\b|pollen|\bflowers?\b|\bfur\b|cat hair|dog hair)/.source,
  'i',
);

/* REACT 强档：自带危象语义的发作锚（喉头/呼吸/休克/急诊直配） */
const REACT_STRONG_ZH_RE = /喉头水肿|喉头[^。！？\n]{0,4}(?:发紧|肿|堵|紧|锁住)|喘不上气|喘不过气|呼吸困难|窒息(?:感)?|过敏性休克|休克|当场倒下|直?送急诊|送医抢救|全身红肿|脸肿成|气管[^。！？\n]{0,4}(?:痉挛|肿|堵|收缩|闭塞)|嘴唇发紫|唇色青紫|面色青紫|翻白眼|没了?呼吸|停止呼吸/;

const REACT_STRONG_EN_RE = /\bthroat\b[^.?!\n]{0,14}?(?:clos(?:e|ing) up|swell(?:ed|ing)?|tighten(?:ed)?|closed)|(?:couldn(?:'t| not)|could not) breathe|\banaphylaxis\b|\banaphylactic shock\b|\bstopped breathing\b|\brushed to the (?:ER|emergency room|hospital)\b|\bEpiPen\b|\bepi pen\b|\bcollapsed\b|\bhives all over\b|\bairway\b[^.?!\n]{0,12}?(?:swell|close|block|constrict|shut)|(?:lips?|lip)\s+(?:turned|went)\s+blue|\bswollen tongue\b|\btongue swelled\b|\bgasped for air\b/i;

/* REACT 弱档：轻症反应（需 ALLCTX 过敏语境兜底，防普通感冒/咳嗽误判） */
const REACT_WEAK_ZH_RE = /起(?:了)?(?:一身)?红疹|起疹子|荨麻疹|发痒|痒|打喷嚏|流鼻涕|咳嗽(?:不止)?|气喘(?:吁吁)?|眼睛肿|眼泡肿/;

const REACT_WEAK_EN_RE = /\brash\b|\bhives\b|\bitchy\b|\bsneezing\b|\bsneezed\b|\brunny nose\b|\bcoughing\b|\bcoughed\b|\bwheezing\b|\bwheezed\b|\bswollen eye\b|\bred spots\b/i;

/* 过敏语境锚：弱档反应需它兜底（咳嗽两声≠过敏发作） */
const ALLCTX_ZH_RE = /过敏(?:史|原|性|反应)?|哮喘|抗过敏|抗敏|急救针|过敏原检测|变态反应/;

const ALLCTX_EN_RE = /\ballerg(?:y|ic|en)\b|\basthma\b|\bantihistamine\b|\bEpiPen\b|\bknown allergy\b/i;

/* ===== 型B：TRIGGER 廉价解除锚 ===== */
const TRIGGER_ZH_RE = /打(?:了)?一(?:针|剂)|急救针|肾上腺素|抗过敏针|抗过敏药|过敏药|激素针/;

const TRIGGER_EN_RE = /\bEpiPen\b|\bepi pen\b|\bshot of epinephrine\b|\bepinephrine shot\b|\bantihistamine\b|\ballergy shot\b|\b(?:steroid|cortisone) shot\b|\b(?:gave|got|received|administered)[^.?!\n]{0,14}?injection\b|\bgave (?:him|her) a shot\b/i;

/* FINE 整体秒愈锚（须含瞬时修饰且与 TRIGGER 配对；缓慢好转不收） */
const FINE_ZH_RE = new RegExp(
  /(?:立刻|马上|瞬间|转眼|一会儿|没过多久|几分钟后|片刻后|当场)[^。！？\n]{0,8}(?:就)?(?:没事|好了?|缓过来|恢复|消肿|消了|不喘)/.source
  + '|' + /跟没事人一样|活蹦乱跳|当场就好|秒好/.source,
);

const FINE_EN_RE = new RegExp(
  /(?:immediately|right away|instantly|in seconds|in minutes|within moments)[^.?!\n]{0,14}?(?:fine|okay|alright|recovered|back to normal|breathing normally|symptoms vanished)/.source
  + '|' + /(?:fine|okay|alright|back to normal|recovered)[^.?!\n]{0,14}?(?:immediately|right away|instantly|in seconds|in minutes)/.source
  + '|' + /as if nothing had happened|back to normal in (?:seconds|minutes|an instant)|symptoms (?:vanished|disappeared)|good as new/i.source,
  'i',
);

/* ===== 型A rescue：KNOWN 既往史（发作不是天降炸弹） ===== */
const KNOWN_ZH_RE = /过敏史|早就知道[^。！？\n]{0,8}过敏|一直知道[^。！？\n]{0,8}过敏|从小(?:就)?(?:对|忌口|有)[^。！？\n]{0,6}过敏|随身(?:携带|带着|备着)(?:急救针|肾上腺素|过敏药|抗过敏药)?|聚餐前问过|事先问过(?:食材|配料|成分)|翻(?:了|出)?配料表|看(?:过|了)?配料表|知道自己(?:对|有)[^。！？\n]{0,6}过敏|对[^。！？\n]{0,6}过敏[^。！？\n]{0,8}(?:很多年|好几年|多年|从小|老毛病)/;

const KNOWN_EN_RE = /\bknew about[^.?!\n]{0,14}?allerg|\bknown allergy\b|\bcarried an EpiPen\b|\balways carried\b[^.?!\n]{0,12}?(?:EpiPen|inhaler)|\basked about the ingredients\b|\bchecked the label\b|\bhad been allergic since\b|\bknew (?:he|she) was allergic\b|\blifelong? allergy history\b/i;

/* 型A rescue：APROCESS 急救过程（危象被规范处置，不是打完针就走） */
const APROCESS_ZH_RE = /急诊留观|留观(?:了)?(?:一?夜|[\d几两半六]+小时)?|住院观察|吸氧|激素输液|激素点滴|输液治疗|输液|抢救(?:了)?[\d几两半六]+小时|监护(?:室|了)?|观察(?:了)?(?:一?夜|[\d几两半六]+小时)|急诊观察|留院观察/;

const APROCESS_EN_RE = /\bER observation\b|\bkept overnight\b|\bfor observation\b|\bon oxygen\b|\bsteroid IV\b|\bIV steroids?\b|\bsteroids?[^.?!\n]{0,10}?(?:IV|infusion|drip)\b|\bmonitored for hours\b|\bhours? of observation\b|\badmitted overnight\b|\bovernight observation\b|\bstayed in the ER\b/i;

/* 型A rescue：APRICE 濒死代价（阀门这次真掐到生死线；"打一针就好"不救） */
const APRICE_ZH_RE = /ICU|重症监护|气管切开|气管插管|差点死|差点没命|没救过来|再晚(?:来|送|一步)[^。！？\n]{0,6}(?:就)?(?:没|死)|窒息而死|抢救无效|下(?:了)?病危(?:通知)?|鬼门关|进了?重症|命悬一线/;

const APRICE_EN_RE = /\bICU\b|\bintubated\b|\bnearly died\b|\balmost died\b|\balmost didn'?t make it\b|\bnear-?death\b|\bcritical condition\b|\bflatlined\b|\bstopped breathing for\b|\bemergency intubation\b/i;

/* ===== 型B rescue：RPROCESS 后续处置（秒愈不是拔针就散场） ===== */
const RPROCESS_ZH_RE = /留观(?:了)?(?:一?夜|[\d几两半六]+小时)|观察(?:了)?一?夜|激素[^。！？\n]{0,4}(?:还得)?吃(?:了)?好?几?天|吃(?:了)?好?几?天(?:过敏)?药|住院(?:观察)?(?:了)?[\d几两半六]+天|随访|定期复诊|复查/;

const RPROCESS_EN_RE = /\bhours? of observation\b|\bkept overnight\b|\bdays? of steroids\b|\bfollow-?up (?:appointment|visit|check)\b|\bmonitored overnight\b|\bstayed for observation\b|\bovernight observation\b/i;

/* 型B rescue：PARTIAL 慢性尾巴（暂停键留着尾巴） */
const PARTIAL_ZH_RE = /随身(?:携带|带着|备着)(?:急救针|肾上腺素)|随时(?:都|都可能|可能)?复发|远离(?:海鲜|芒果|猫|花|花生|过敏原|猫毛)|哮喘(?:慢性化)?|慢性哮喘|再也不敢碰|终身忌口|一辈子忌口|仍需随身(?:携带|带着)?|还(?:得|要)随身带着(?:急救针|药)/;

const PARTIAL_EN_RE = /\bstill carries an EpiPen\b|\bcould (?:still )?recur\b|\bavoids (?:seafood|peanuts|mangoes?|cats|the allergen|shellfish)\b|\bchronic asthma\b|\bcould never touch\b|\blifelong allergy\b|\bstill has to carry\b/i;

/* 型B rescue：COST 社交代价（圆满有刺痛价格） */
const COST_ZH_RE = /(?:宴会|寿宴|婚宴|宴席|婚礼|生日宴|饭局|聚餐)[^。！？\n]{0,6}(?:搞砸|不欢而散|毁了|搅黄)|合(?:同|作)[^。！？\n]{0,3}(?:黄了|泡汤|吹了|告吹)|心理阴影|再?不敢(?:再)?外食|外食(?:恐惧|障碍)|社交(?:场合)?(?:忌口|不敢吃|扫兴)|赔偿|扫了[^。！？\n]{0,4}的?兴/;

const COST_EN_RE = /\bruined the (?:banquet|wedding|party|dinner|reception)\b|\bdeal collapsed\b|\bdeal fell through\b|\btraumatized\b|\bafraid to eat out\b|\bsocial cost\b|\bspoiled the party\b|\bliability claim\b|\blawsuit\b/i;

const PAIR_PAD = 2;
const CONTEXT_PAD = 3;
const RESCUE_PAD = 2;

interface Ev {
  start: number;
  end: number;
  anchorEnd: number;
  kind: 'attack' | 'relief';
  marker: string;
}

/**
 * 纯函数：检测"过敏/哮喘剧情阀门/免疫系统当开关"密度病。
 */
export function allergyOnCue(draft: string): AllergyOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const exposeRe = zh ? EXPOSE_ZH_RE : EXPOSE_EN_RE;
  const reactStrongRe = zh ? REACT_STRONG_ZH_RE : REACT_STRONG_EN_RE;
  const reactWeakRe = zh ? REACT_WEAK_ZH_RE : REACT_WEAK_EN_RE;
  const allCtxRe = zh ? ALLCTX_ZH_RE : ALLCTX_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const fineRe = zh ? FINE_ZH_RE : FINE_EN_RE;
  const knownRe = zh ? KNOWN_ZH_RE : KNOWN_EN_RE;
  const aprocessRe = zh ? APROCESS_ZH_RE : APROCESS_EN_RE;
  const apriceRe = zh ? APRICE_ZH_RE : APRICE_EN_RE;
  const rprocessRe = zh ? RPROCESS_ZH_RE : RPROCESS_EN_RE;
  const partialRe = zh ? PARTIAL_ZH_RE : PARTIAL_EN_RE;
  const costRe = zh ? COST_ZH_RE : COST_EN_RE;

  /* 场景映射（场景头不参与词表匹配） */
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      sceneIdx += 1;
      header = line;
    }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasExpose: boolean[] = new Array(rawLines.length).fill(false);
  const hasReactStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasReactWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasAllCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasFine: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasExpose[i] = exposeRe.test(line);
    hasReactStrong[i] = reactStrongRe.test(line);
    hasReactWeak[i] = reactWeakRe.test(line);
    hasAllCtx[i] = allCtxRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasFine[i] = fineRe.test(line);
  });

  /** 锚行成组：相邻 ≤2 行合并，跨场景头不合并（between 切片） */
  const groupRows = (flags: boolean[]): { start: number; end: number }[] => {
    const groups: { start: number; end: number }[] = [];
    rawLines.forEach((raw, i) => {
      if (!flags[i]) return;
      const last = groups[groups.length - 1];
      if (last && i - last.end <= 2) {
        const between = rawLines.slice(last.end + 1, i);
        if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
          last.end = i;
          return;
        }
      }
      groups.push({ start: i, end: i });
    });
    return groups;
  };

  const events: Ev[] = [];

  /* 型A：EXPOSE 组 ±2 行找 REACT（强档直配；弱档需 ±3 行 ALLCTX） */
  for (const g of groupRows(hasExpose)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let reactLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasReactStrong[j]) { reactLine = j; strongHit = true; break; }
      if (reactLine < 0 && hasReactWeak[j]) reactLine = j;
    }
    if (reactLine < 0) continue; /* 吃海鲜撸猫但没有发作：普通家宴放行 */
    let ctxOk = strongHit;
    if (!ctxOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, reactLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasAllCtx[j] || hasReactStrong[j]) { ctxOk = true; break; }
      }
    }
    if (!ctxOk) continue; /* 无过敏语境：普通咳嗽/皮疹/感冒不归本引擎 */

    const exposeM = (rawLines[g.start].match(exposeRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const reactM = (rawLines[reactLine].match(strongHit ? reactStrongRe : reactWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, reactLine),
      anchorEnd: reactLine,
      kind: 'attack',
      marker: `${exposeM}→${reactM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 FINE（必须瞬时整体秒愈） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let fineLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasFine[j]) { fineLine = j; break; }
    }
    if (fineLine < 0) continue; /* 打了针但没有瞬时秒愈：仍在处置/观察中放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const fineM = (rawLines[fineLine].match(fineRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, fineLine),
      anchorEnd: fineLine,
      kind: 'relief',
      marker: `${trigM}→${fineM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: AllergyOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次过敏桥段是类型刚需） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = ev.kind === 'attack'
      ? (knownRe.test(win) || aprocessRe.test(win) || apriceRe.test(win))
      : (rprocessRe.test(win) || partialRe.test(win) || costRe.test(win));
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      kind: ev.kind,
      rescued,
      reason: ev.kind === 'attack'
        ? (zh
          ? '又是一口进急诊——寿宴上夹一只虾、聚会上尝一口芒果、撸两下猫，三行之内喉头水肿、过敏性休克直接送医；没有既存过敏史、没人提前问过食材、没人随身带急救针，过敏是制造危机、拆散宴席、逼英雄救美的即时炸弹，"打了一针就好"救不了这段（它本身就是一针秒解除的病象）'
          : 'another bite-straight-to-the-ER beat - one shrimp at the banquet, one slice of mango at the party, two strokes of a cat, and within three lines the throat is swelling, anaphylactic shock hits and the ambulance is called; no prior allergy history, nobody asked about the ingredients, nobody carries an EpiPen; the allergy is an instant bomb used to manufacture crisis, break up the banquet and force a rescue, and "a shot fixed it" does not rescue this beat (that is the instant-relief disease itself)')
        : (zh
          ? '又是一针秒解除——急救针一打瞬间没事、活蹦乱跳，不留观、不随访、不终身忌口，宴席散场合同照签；下一集主角又自己夹起一只虾，免疫系统是编剧的暂停键：需要危机时一口虾进急诊，需要圆满时一针回正常'
          : 'another one-shot instant cure - the EpiPen goes in and she is instantly fine, lively as ever, no observation, no follow-up, no lifelong avoidance, the banquet ends and the deal is signed; next episode the same character picks up another shrimp, the immune system is the writer\'s pause button: one bite into the ER when crisis is needed, one shot back to normal when a happy ending is due'),
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    const attackCount = events.filter((e) => e.kind === 'attack').length;
    const reliefCount = events.filter((e) => e.kind === 'relief').length;
    issues.push(zh
      ? `${hitCount} 处"过敏/哮喘剧情阀门"（接触秒发作 ${attackCount} 处、一针秒解除 ${reliefCount} 处，${n} 处未救）——免疫系统成了随取随用的剧情开关：需要危机时一只虾一口芒果三行进急诊，不需要铺垫过敏史；需要圆满时一针下去当场没事，不留观不忌口。第一次是类型桥段，第三次观众就看穿：这个剧里过敏从来不是病，是可以一键引爆又一键拆除的扳手；而每回发作都问都不问问食材、每回痊愈都不留尾巴，发作和痊愈双双贬值，下一集主角还敢自己夹虾。`
      : `${hitCount} allergy-on-cue beat(s) (${attackCount} instant attack, ${reliefCount} instant relief; ${n} unrescued) - the immune system is a plot switch: when crisis is needed one shrimp or a slice of mango sends someone to the ER in three lines with no history set up; when relief is needed one shot makes everything instantly fine with no observation and no avoidance. Once is genre grammar; by the third, the audience sees allergy is never an illness in this story, only a wrench that arms and disarms on command - and when every attack skips the ingredient question and every recovery skips the tail, both the attack and the cure lose their value, and next episode the character reaches for the shrimp again.`);
    advice.push(zh
      ? '让过敏恢复它应有的凶险与麻烦。接触秒发作型：①让既往史兑付——过敏史、早就知道对虾/芒果过敏、随身携带急救针、聚餐前主动问过食材配料、翻配料表、从小忌口，发作不该是天上掉下来的炸弹，周围人"怎么不早说"本身就是戏；②让急救有过程——急诊留观、吸氧、激素输液、抢救几个小时、住院观察、心电监护，过敏性休克是鬼门关不是门诊包扎；③要么让代价真兑付——进ICU、气管切开插管、差点死、再晚一步就没救过来，阀门这次真掐到生死线；记住"打了一针就好"不救发作戏，它本身就是秒解除的病象。一针秒解除型：④让秒愈有后续处置——留观一夜、留观数小时、激素吃几天、定期随访复查，拔针不等于散场；⑤给暂停键留尾巴——随身携带急救针、随时可能复发、终身忌口、远离海鲜芒果猫、哮喘慢性化、再也不敢碰，下一桌宴席要有"这个我不能吃"的尴尬；⑥如果必须圆满，让它带着价格——寿宴婚宴搞砸不欢而散、合同合作黄了、当众失态的心理阴影、再不敢外食、社交场合的忌口代价，虚惊一场也该留下账单。最忌讳一集两回"夹只虾→喉头水肿→打一针→马上没事→继续签合同"。过敏若要引爆，就得真的要命；若要拆除，也不能白拆除。'
      : 'Give the allergy its real danger and its real hassle. For instant-attack beats: (1) let the history in - a known allergy, years of knowing about the shrimp or mango, an EpiPen already in the bag, asking about the ingredients before the banquet, reading the label, avoiding the food since childhood; the attack should not fall from the sky, and "why didn\'t you say so earlier" is itself a scene. (2) Let the emergency take a process - ER observation, oxygen, IV steroids, hours of resuscitation, admission, monitoring; anaphylactic shock is a brush with death, not a band-aid visit. (3) Or let the price be paid in full - the ICU, an intubation, nearly dying, one minute later and it would have been too late; the valve only carries weight when it really closes to the life-or-death line; remember "a shot fixed it" never rescues an attack beat, because that is the instant-cure disease itself. For instant-relief beats: (4) give the recovery a tail of care - overnight observation, hours in the ER, days of steroids, follow-up visits; pulling the needle is not the end of the scene. (5) Leave the pause button a tail - still carrying an EpiPen, recurrence risk, lifelong avoidance, staying away from seafood, mangoes and cats, chronic asthma, never daring to touch it again; the next banquet needs the awkward "I can\'t eat that". (6) If it must end fine, make it cost something - the wedding banquet ruined, the deal dead, the humiliation and trauma, fear of eating out, the social cost of special diets; even a false alarm should leave a bill. The unforgivable pattern is two "one shrimp -> swelling throat -> one shot -> instantly fine -> back to signing contracts" loops per episode. If an allergy is armed, it must genuinely threaten a life; if it is disarmed, it must not be disarmed for free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
