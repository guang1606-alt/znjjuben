import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.141 反派降智 / 主角光环检测（PRD 2.1.38 翻盘必须靠主角挣来，不能靠对手犯蠢）
 * ------------------------------------------------------------------
 * 短剧顶格爽点是"压迫越狠翻盘越爽"，顶格差评是"主角赢得毫无含金量"——
 * 反派明明占尽上风却突然降智放人、刀架脖子开始长篇自白、看守法儿戏、
 * 主角中枪坠崖拍拍灰就跑。本引擎专管**翻盘时刻的对手自我拆台与肉身无敌**。
 *
 * 分工（三个近邻引擎）：
 *  - antagonist-quality：反派整体画像（缺席/纸老虎/无动机/无筹码），统计式
 *  - causal-logic / deus_ex_machina：外部救兵天降（外人替主角解决）
 *  - subtext-check(v2.135)：反派"说破秘密"的台词写法（不管拖延结构）
 *  - v2.141（本引擎）：事件级——具体哪个翻盘时刻，对手松手/话多/看守空转/主角无伤
 *  - continuity(v2.139)：伤在跨镜头后无痕；v2.141 是致命事件当下即无伤
 *
 * 四类问题：
 *  1) villain_spares_hero    占尽上风却放人：下令"处理掉他"自己离场/改日再杀/留条狗命
 *  2) monologue_delay        刀架脖子还长篇自白，给足主角反杀窗口（control+自白+逃脱 三件套）
 *  3) incompetent_restraint  束缚/看守法儿戏：松绑/门没锁/钥匙留锁上/看守睡着
 *  4) plot_armor             致命事件当下毫发无伤：中枪坠崖爆炸后"只是皮外伤/拍灰就跑"
 *
 * 豁免/正信号：
 *  - CLEVER 智取（提前准备/买通看守/袖藏刀片/将计就计/one step ahead）→ 同场 spares/monologue/restraint 全免
 *  - 放人有合理理由（留活口签字/人质/有监控/need him alive）→ spares 免
 *  - 提前穿戴护具（防弹衣/bulletproof vest）或伤害有代价（昏迷/住院/骨折）→ armor 免
 */

export type PaLang = 'zh' | 'en';

export interface PlotArmorIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'villain_spares_hero'
    | 'monologue_delay'
    | 'incompetent_restraint'
    | 'plot_armor';
  evidence: string;
  advice: string;
  scene: number;
  key: string;
}

export interface PlotArmorSceneReport {
  index: number;
  header: string;
  flagCount: number;
}

export interface PlotArmorResult {
  score: number;
  sceneCount: number;
  /** 翻盘风险信号总数（控制态/致命事件/放人/自白/逃脱/松绑/奇迹无伤） */
  signalCount: number;
  issueCount: number;
  sparesCount: number;
  monologueCount: number;
  restraintCount: number;
  armorCount: number;
  /** 智取翻盘次数（正信号） */
  cleverEscapeCount: number;
  scenes: PlotArmorSceneReport[];
  issues: PlotArmorIssue[];
}

// —— 场景切分（复用 v2.132 起标题约定）——

// —— 主角已被控制（占尽上风的前提）——
const CONTROL_ZH = /(?:被(?:绑|捆|困|扣|擒|控制)(?:在|住|了|到)?|绑(?:在|了|到)(?:椅子|柱子|床上)?|捆(?:在|了|到)?|枪(?:口|正)?抵(?:着|在)?|枪指(?:着|向)?|刀架在(?:脖子|颈)|(?:跪|瘫)在(?:他|她)?(?:面前|地上)|被(?:他|她)(?:掐|摁|按)(?:住|在)|手无寸铁|无路可退|被团团围住|被制服|被生擒|成了(?:他的)?(?:囊中之物|瓮中之鳖|阶下囚))/;
const CONTROL_EN = /\b(?:tied (?:to|up)|bound (?:to|with)|and gagged|at gunpoint|held at gunpoint|gun pressed to|knife at (?:his|her) throat|on (?:his|her| knees| knees)|on (?:his|her) knees|at (?:his|her) mercy|helpless(?:ly cornered)?|cornered and helpless|had (?:him|her) cornered|taken (?:him|her)? captive|hands tied|no way out)\b/i;

// —— 处决命令 + 离场（必须 2 行窗口内共现；单独"留条狗命/改日再杀"即可）——
const KILLORDER_ZH = /(?:处理掉他|做掉他|干掉他|解决掉他|弄死他|杀了他|灭了他|把他做了|让他消失)/;
const LEAVE_ZH = /(?:转身(?:就)?(?:离开|走|离去)|扬长而去|拂袖而去|大摇大摆(?:地)?(?:离开|走|走了)|大步(?:离开|走出)|走(?:出|离)(?:房间|仓库|地下室|大门)?|丢下他(?:一个人)?|吩咐手下|交代手下|交给(?:手下|兄弟们)|带(?:着|上)?人(?:离开|走了|撤了))/;
const DELAYKILL_ZH = /(?:留(?:你|他)(?:一条)?(?:狗命|小命)|让(?:你|他)多活(?:几天|一晚|一夜)|明天(?:再)?(?:收拾|送你上路|要你的命)|改日(?:再)?(?:收拾|算账)|不急于(?:这一时|这一时半刻)|先(?:留着|关着)(?:你|他)|有的是时间(?:收拾你|跟你算))/;
const REASON_ZH = /(?:留活口|当(?:人)?质|做人质|还不能杀(?:他)?|需要他(?:签字|按手印|画押|亲自签)|杀了他(?:就)?(?:拿|要)不到|有(?:监控|摄像头)|人多眼杂|留着他(?:对我)?还有用|用他(?:来)?(?:引|钓)|当诱饵|还(?:有|缺)(?:个)?(?:证人|证据|口供))/;

const KILLORDER_EN = /\b(?:deal with (?:him|her)|take care of (?:him|her)|finish (?:him|her) off|kill (?:him|her)|get rid of (?:him|her)|dispose of (?:him|her)|make (?:him|her) disappear)\b/i;
const LEAVE_EN = /\b(?:turned (?:and )?(?:left|away)|walked away|stormed out|strode out|left the room|left (?:him|her) (?:behind|alone)|ordered his men|told his men|with his (?:men|guards)|led his men out)\b/i;
const DELAYKILL_EN = /\b(?:save (?:him|her) for later|let (?:him|her) live (?:a little )?longer|live to see tomorrow|not today|we have all the time|keep (?:him|her) alive for now|another day)\b/i;
const REASON_EN = /\b(?:need (?:him|her) alive|(?:as|hold for) ransom|hostage|sign (?:the|his|her) |(?:his|her) signature|on camera|witnesses? (?:around|present)|can(?:'t|ot) kill (?:him|her) here|useful alive|bait to (?:lure|draw)|leverage)\b/i;

// —— 占优时长篇自白（必须 control + 自白 + 逃脱 三件套）——
const TALK_ZH = /(?:死个明白|让你死个明白|临死(?:前|之际)|送你上路之前|在你死之前|我不妨告诉你|你知道(你)?为什么|你想知道(为什么|原因|真相)|我告诉(?:你|过你)为什么|你以为(?:这一切|我)|你不是一直想知道|让我(?:给你|替你)(?:讲|说)个明白|你可知(?:道)?(?:我为|是谁))/;
const TALK_EN = /\b(?:before you die|before i kill you|any last words|let me tell you why|you want to know why|die knowing|so you (?:can|could) die (?:knowing|understanding)|you really want to know|you see,|you(?:'ve| have) always wondered why)\b/i;

// —— 逃脱/反杀动作 ——
const ESCAPE_ZH = /(?:趁(?:其|他|她)?(?:不备|不注意|分神)|一把(?:推开|打翻|抢过|夺过|推开他)|猛地(?:挣脱|撞开|扑向|踢)|挣脱(?:束缚|开|了)?|踢翻(?:他)?|踹开|夺门而逃|逃(?:走|了出去|脱)|抢过(?:枪|刀|手枪)|反将一军|撞开(?:他|门)|用头(?:撞|顶)|肘(?:击|撞)|抄起(?:身边的)?(?:椅|瓶|棍))/;
const ESCAPE_EN = /\b(?:took (?:the|his|her) chance|seized the (?:moment|opportunity)|broke free|snatched (?:the|his|her) (?:gun|knife|weapon)|kicked the gun(?: away)?|ducked and|lunged at|knocked him (?:off|aside)|wrestled (?:the|his) (?:gun|knife)|fled|escaped|drove (?:his|her) elbow|slammed into (?:him|her)|headbutt(?:ed)?|grabbed a (?:chair|bottle))\b/i;

// —— 束缚/看守法儿戏 ——
const RESTRAINT_ZH = /(?:绳子(?:一挣就松|松松的|没系紧)|松松(?:地)?(?:绑|捆)|(?:轻易|一下就|没费劲|毫不费力)[^，。；？！\n]{0,4}挣脱|门(?:根本|居然|竟然)?没锁|钥匙(?:还)?插在(?:锁孔|门锁|锁)上|看守(?:睡着|打盹|打瞌睡|犯困|喝醉|喝多|只有一个|没在看守)|守卫(?:睡着|打盹|喝醉|只有一个|一个人)|绑得很松|绳结(?:一拉就开|松了)|没人(?:看守|看着|盯着))/;
const RESTRAINT_EN = /\b(?:loosely tied|ropes came undone|easily broke free|broke free easily|door was unlocked|door(?:way)? stood unlocked|key was (?:still )?in the lock|guard(?:s)? (?:was|were) (?:asleep|drunk)|lone guard|only one guard|bonds? (?:were|was) loose|slipped (?:right )?out of the ropes|nobody (?:was )?watching|unguarded)\b/i;

// —— 智取翻盘（正信号，同场豁免 spares/monologue/restraint）——
const CLEVER_ZH = /(?:袖(?:里|口|中)?(?:藏|暗藏)[^，。；？！\n]{0,3}(?:刀片|碎瓷|小刀|钢丝)|(?:用|拿)(?:暗藏|藏着的)?刀片(?:划开|磨|割)|磨断(?:绳子)?|早有准备|早就(?:准备|布好|安排|料到|计划)|提前(?:准备|布好|安排|藏好|穿好)|留了(?:一)?后手|将计就计|反将一军|买通(?:了)?(?:守卫|看守|手下|保镖)|里应外合|暗藏(?:后手|机关)|配了(?:把)?(?:万能)?钥匙|钥匙是我(?:提前)?配的|做了记号|虚晃一枪|假意(?:投降|屈服|招供))/;
const CLEVER_EN = /\b(?:hidden (?:blade|razor|wire)|concealed blade|cut through the ropes with|slipped a blade|had planned (?:for|ahead)|planned for this|one step ahead|bribed(?: the)? (?:guard|guards|men)|bought off the guard|inside (?:man|help)|backup plan|was ready for this|saw it coming|set (?:it|this|him) up|turned (?:his|her) own trap|feigned surrender)\b/i;

// —— 致命事件 ——
const LETHAL_ZH = /(?:中枪|中了(?:一|两|数)?枪|挨了(?:一)?枪|(?:身|连)中(?:数|几|一)?枪|中刀|被(?:捅|刺|扎)(?:了)?(?:一)?刀|捅(?:了|进)?(?:一)?刀|坠崖|坠下悬崖|掉下(?:悬崖|高楼|天桥)|(?:被)?(?:卡|货|轿)?车(?:子)?(?:猛地)?(?:撞|碾)(?:在|向|上|过)?|(?:剧烈)?爆炸|被炸飞|火海(?:吞)?|从(?:高楼|天台|楼上)坠(?:下|落)|连中数刀)/;
const LETHAL_EN = /\b(?:got shot|was shot|took a bullet|gunshot(?: wound)?|stabbed(?: in| by)?|stab wound|fell off the cliff|plunged off(?: the cliff)?|hit by (?:a|the) (?:car|truck|van)|car crash|(?:violent|huge|massive) explosion|explosion (?:threw|blasted)|blasted (?:him|her) (?:back|away)|fell (?:three|two|several) stor(?:ies|y)|leapt from the (?:building|roof)|multiple (?:gunshot|stab) wounds)\b/i;

// —— 奇迹无伤 ——
const MIRACLE_ZH = /(?:毫发(?:无伤|无损)|安然无恙|只是皮外伤|皮外伤而已|擦破点皮|爬起来就跑|拍拍(?:身上)?(?:灰|尘土|衣服)|像(?:个)?没事人(?:一样|似的)?|若无其事(?:地)?(?:站|爬)起来|没受什么伤|竟然没事|居然没事|一点(?:儿)?事(?:都|也)?没有|完好无损地站|抹了把脸(?:就)?(?:继续|冲))/;
const MIRACLE_EN = /\b(?:without a scratch|without (?:even|so much as) a scratch|unharmed|unhurt|just a flesh wound|merely a flesh wound|got up and ran|got up as if nothing|brushed (?:himself|herself|the dust) off|as if nothing had happened|completely fine|barely a scratch|walked it off|no serious injury|stood up unharmed)\b/i;

// —— 伤害有合理代价（armor 豁免）——
const COST_ZH = /(?:昏迷|住院|手术(?:室|台)?|输血|骨折|断了(?:一根|两根|条)?(?:肋)?骨|绷带(?:包扎)?|包扎|疼得(?:直|打滚)?|剧痛|失血(?:过多)?|(?:瘸|跛)(?:了|着)?|拄(?:着)?拐|休养(?:了)?|昏迷(?:了)?[一二两三0-9]+天|内脏(?:受伤|出血)|肺部|抢救(?:室|了)?|中弹(?:的)?(?:部位)?隐隐作痛)/;
const COST_EN = /\b(?:passed out|knocked unconscious|lay unconscious|hospital|surgery|operating table|blood transfusion|broken (?:ribs?|leg|arm|collarbone)|bandaged(?: up)?|in agony|searing pain|limping|limped|intensive care|coma(?:tose)?|internal bleeding|emergency room|winced in pain|recovery took)\b/i;

// —— 提前穿戴护具（armor 豁免）——
const GEAR_ZH = /(?:防弹衣|避弹衣|防刺服|穿了防(?:弹|刺)|里面穿了件防)/;
const GEAR_EN = /\b(?:bulletproof vest|bullet-proof vest|stab-proof vest|was wearing a vest|wore (?:a )?vest(?: under)?|protective vest)\b/i;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface SplitScene { header: string; lines: string[] }

function splitScenes(text: string, isZh: boolean): SplitScene[] {
  const raw = text.split(/\r?\n/);
  const scenes: SplitScene[] = [];
  let cur: SplitScene = { header: isZh ? '开场' : 'Opening', lines: [] };
  for (const line of raw) {
    const t = line.trim();
    if (t && isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      if (cur.lines.length || cur.header !== (isZh ? '开场' : 'Opening')) scenes.push(cur);
      cur = { header: t.slice(0, 30), lines: [] };
    } else if (t) {
      cur.lines.push(t);
    }
  }
  scenes.push(cur);
  return scenes;
}

const adviceZh = {
  spares: '反派已经完全控制主角，却把处决甩给手下自己离场/一句"改日再杀"。要么让他盯着执行到底（由主角付出代价破局），要么给放人一个硬理由（必须本人签字/留作人质/现场有监控），别靠反派突然心大送活路。',
  monologue: '刀都架在脖子上，反派却停下来说长段自白，给主角递反杀窗口。把解释拆散到此前的对峙里，致命一击让他真的动手——主角靠抢先一步/藏好的后手脱身，而不是等反派讲完。',
  restraint: '捆绑看守形同虚设（松绑/门没锁/钥匙留在锁上/看守睡着），逃脱零成本。给束缚一个可信强度，主角必须靠道具、外援或付出伤痛代价才能脱身。',
  armor: '中枪坠崖爆炸后当场"只是皮外伤、拍拍灰就跑"，致命伤害失去分量。让他真的倒下（昏迷/骨折/手术/被人救走养伤），或提前铺垫护具与缓冲，爽感才不廉价。',
};
const adviceEn = {
  spares: 'The villain has the hero completely under control, then delegates the kill and walks away (or "save him for later"). Either make him see the execution through (the hero pays a cost to break it) or give a hard reason to keep the hero alive (needed signature, hostage, cameras).',
  monologue: 'With a blade at the hero\'s throat the villain pauses for a long confession, handing over the escape window. Spread the explanation into earlier confrontations and let him actually strike; the hero escapes through a planted edge or a split-second move, not a monologue.',
  restraint: 'The restraints are a joke (loose ropes, unlocked door, key in the lock, sleeping guard) and escape costs nothing. Make the restraint credible; require a tool, outside help, or physical pain to get free.',
  armor: 'After a gunshot, fall or explosion the hero walks off with "just a flesh wound". Let him truly go down (coma, broken bones, surgery, rescued and bedridden), or plant protective gear and a buffer beforehand so the stakes stay real.',
};

/**
 * 反派降智 / 主角光环检测
 * @param text 剧本全文
 * @param lang zh | en
 */
export function plotArmorCheck(text: string, lang: PaLang = 'zh'): PlotArmorResult {
  const isZh = lang !== 'en';
  const empty: PlotArmorResult = {
    score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
    sparesCount: 0, monologueCount: 0, restraintCount: 0, armorCount: 0,
    cleverEscapeCount: 0, scenes: [], issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const scenes = splitScenes(text, isZh);
  if (!scenes.length) return empty;

  const CONTROL = isZh ? CONTROL_ZH : CONTROL_EN;
  const KILLORDER = isZh ? KILLORDER_ZH : KILLORDER_EN;
  const LEAVE = isZh ? LEAVE_ZH : LEAVE_EN;
  const DELAYKILL = isZh ? DELAYKILL_ZH : DELAYKILL_EN;
  const REASON = isZh ? REASON_ZH : REASON_EN;
  const TALK = isZh ? TALK_ZH : TALK_EN;
  const ESCAPE = isZh ? ESCAPE_ZH : ESCAPE_EN;
  const RESTRAINT = isZh ? RESTRAINT_ZH : RESTRAINT_EN;
  const CLEVER = isZh ? CLEVER_ZH : CLEVER_EN;
  const LETHAL = isZh ? LETHAL_ZH : LETHAL_EN;
  const MIRACLE = isZh ? MIRACLE_ZH : MIRACLE_EN;
  const COST = isZh ? COST_ZH : COST_EN;
  const GEAR = isZh ? GEAR_ZH : GEAR_EN;
  const A = isZh ? adviceZh : adviceEn;

  const issues: PlotArmorIssue[] = [];
  const sceneFlags = new Map<number, number>();
  const flag = (scene: number) => sceneFlags.set(scene, (sceneFlags.get(scene) ?? 0) + 1);

  let signalCount = 0;
  let cleverEscapeCount = 0;
  let sparesCount = 0;
  let monologueCount = 0;
  let restraintCount = 0;
  let armorCount = 0;
  /** 每类最多记 2 条 issue；同一类在同一场只算 1 次（连续描写不去重会过罚） */
  const pushed = { spares: 0, mono: 0, restraint: 0, armor: 0 };
  const sceneCounted = { spares: false, mono: false, restraint: false, armor: false };

  scenes.forEach((sc, si) => {
    const sceneIdx = si + 1;
    const lines = sc.lines;
    const controlIdx: number[] = [];
    const killIdx: number[] = [];
    const leaveIdx: number[] = [];
    const delayIdx: number[] = [];
    const reasonIdx: number[] = [];
    const talkIdx: number[] = [];
    const escapeIdx: number[] = [];
    const restraintIdx: number[] = [];
    const cleverIdx: number[] = [];
    const lethalIdx: number[] = [];
    const miracleIdx: number[] = [];
    const costIdx: number[] = [];
    let gear = false;

    lines.forEach((line, li) => {
      if (CONTROL.test(line)) { controlIdx.push(li); signalCount++; }
      if (KILLORDER.test(line)) { killIdx.push(li); signalCount++; }
      if (LEAVE.test(line)) { leaveIdx.push(li); signalCount++; }
      if (DELAYKILL.test(line)) { delayIdx.push(li); signalCount++; }
      if (REASON.test(line)) { reasonIdx.push(li); signalCount++; }
      if (TALK.test(line)) { talkIdx.push(li); signalCount++; }
      if (ESCAPE.test(line)) { escapeIdx.push(li); signalCount++; }
      if (RESTRAINT.test(line)) { restraintIdx.push(li); signalCount++; }
      if (CLEVER.test(line)) { cleverIdx.push(li); signalCount++; }
      if (LETHAL.test(line)) { lethalIdx.push(li); signalCount++; }
      if (MIRACLE.test(line)) { miracleIdx.push(li); signalCount++; }
      if (COST.test(line)) { costIdx.push(li); signalCount++; }
      if (GEAR.test(line)) { gear = true; signalCount++; }
    });

    const hasClever = cleverIdx.length > 0;
    if (hasClever) cleverEscapeCount += cleverIdx.length;
    const hasReason = reasonIdx.length > 0;
    const hasControl = controlIdx.length > 0;
    sceneCounted.spares = false; sceneCounted.mono = false;
    sceneCounted.restraint = false; sceneCounted.armor = false;

    // —— ① 占尽上风却放人：控制态 + 处决命令后 2 行内离场，或"改日再杀"硬拖 ——
    if (!hasClever && !hasReason && hasControl) {
      const spareHits: number[] = [];
      for (const k of killIdx) {
        if (leaveIdx.some((l) => l >= k && l <= k + 2)) spareHits.push(k);
      }
      for (const d of delayIdx) spareHits.push(d);
      if (spareHits.length && !sceneCounted.spares) {
        sceneCounted.spares = true;
        const h = spareHits[0];
        sparesCount++;
        if (pushed.spares < 2) {
          pushed.spares++;
          issues.push({
            severity: sparesCount >= 2 ? 'high' : 'mid',
            type: 'villain_spares_hero', key: 'spares', scene: sceneIdx,
            evidence: isZh ? `第${sceneIdx}场：${lines[h].slice(0, 34)}` : `Scene ${sceneIdx}: ${lines[h].slice(0, 60)}`,
            advice: A.spares,
          });
          flag(sceneIdx);
        }
      }
    }

    // —— ② 刀架脖子的长篇自白：control + 自白 + 其后 4 行内逃脱 ——
    if (!hasClever && hasControl && !sceneCounted.mono) {
      const monoHit = talkIdx.find((t) => escapeIdx.some((e) => e > t && e <= t + 4));
      if (monoHit !== undefined) {
        sceneCounted.mono = true;
        monologueCount++;
        if (pushed.mono < 2) {
          pushed.mono++;
          issues.push({
            severity: monologueCount >= 2 ? 'high' : 'mid',
            type: 'monologue_delay', key: 'monologue', scene: sceneIdx,
            evidence: isZh ? `第${sceneIdx}场：${lines[monoHit].slice(0, 34)}` : `Scene ${sceneIdx}: ${lines[monoHit].slice(0, 60)}`,
            advice: A.monologue,
          });
          flag(sceneIdx);
        }
      }
    }

    // —— ③ 束缚/看守法儿戏：松绑信号 + 逃脱，或控制态下看守直接缺位，且无智取 ——
    if (!hasClever && !sceneCounted.restraint) {
      const restraintHit = restraintIdx.find((r) => escapeIdx.some((e) => e >= r && e <= r + 3) || hasControl);
      if (restraintHit !== undefined) {
        sceneCounted.restraint = true;
        restraintCount++;
        if (pushed.restraint < 2) {
          pushed.restraint++;
          issues.push({
            severity: restraintCount >= 2 ? 'mid' : 'low',
            type: 'incompetent_restraint', key: 'restraint', scene: sceneIdx,
            evidence: isZh ? `第${sceneIdx}场：${lines[restraintHit].slice(0, 34)}` : `Scene ${sceneIdx}: ${lines[restraintHit].slice(0, 60)}`,
            advice: A.restraint,
          });
          flag(sceneIdx);
        }
      }
    }

    // —— ④ 主角光环：致命事件后 3 行内奇迹无伤，且此前无代价、无护具（一场最多 1 次）——
    if (!gear && !sceneCounted.armor) {
      let armorHit: { lethal: number; miracle: number } | null = null;
      for (const l of lethalIdx) {
        const miracle = miracleIdx.find((mi) => mi >= l && mi <= l + 3);
        if (miracle === undefined) continue;
        // 奇迹行之前同场出现过伤害代价 → 合理化
        if (costIdx.some((c) => c <= miracle)) continue;
        armorHit = { lethal: l, miracle };
        break;
      }
      if (armorHit) {
        sceneCounted.armor = true;
        armorCount++;
        if (pushed.armor < 2) {
          pushed.armor++;
          issues.push({
            severity: armorCount >= 2 ? 'high' : 'mid',
            type: 'plot_armor', key: 'armor', scene: sceneIdx,
            evidence: isZh ? `第${sceneIdx}场：${lines[armorHit.miracle].slice(0, 34)}` : `Scene ${sceneIdx}: ${lines[armorHit.miracle].slice(0, 60)}`,
            advice: A.armor,
          });
          flag(sceneIdx);
        }
      }
    }
  });

  // —— 汇总打分 ——
  let penalty = 0;
  penalty += Math.min(sparesCount * 12, 24);
  penalty += Math.min(monologueCount * 10, 18);
  penalty += Math.min(restraintCount * 6, 12);
  penalty += Math.min(armorCount * 11, 22);
  const bonus = Math.min(cleverEscapeCount * 2, 6);

  issues.sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 } as const;
    return order[a.severity] - order[b.severity] || a.scene - b.scene;
  });

  const sceneReports: PlotArmorSceneReport[] = scenes.map((s, i) => ({
    index: i + 1,
    header: s.header,
    flagCount: sceneFlags.get(i + 1) ?? 0,
  }));

  return {
    score: clamp(100 - penalty + bonus, 0, 100),
    sceneCount: scenes.length,
    signalCount,
    issueCount: issues.length,
    sparesCount,
    monologueCount,
    restraintCount,
    armorCount,
    cleverEscapeCount,
    scenes: sceneReports,
    issues,
  };
}
