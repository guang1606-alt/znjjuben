/**
 * 对白功能性检测器（PRD 2.1.23 角色塑造与剧情推进的平衡）
 * ------------------------------------------------------------------
 * 短剧对白的核心原则：每一句台词都应至少承担以下四种功能之一
 *  1) 推进剧情（plot）：让故事往前走一步（动作、决定、转折）
 *  2) 塑造人物（character）：展示角色性格、背景、情感、动机
 *  3) 制造冲突（conflict）：制造或升级人物之间的对抗
 *  4) 传递信息（info）：向观众或剧中人传达关键事实、背景、设定
 *
 * 与现有引擎的分工：
 *  - dialogue-water-check.ts: 识别"完全无功能"的水分台词
 *  - dialogue-functionality-check.ts (本引擎): 评估对白功能分布是否均衡
 *
 * 短剧常见痛点：
 *  1) 角色塑造缺失：全集都是动作推进，没有展示角色性格的戏（角色扁平）
 *  2) 信息倾倒场景：某场戏90%对白都在交代设定/背景，观众听不懂记不住
 *  3) 冲突真空区：连续多场戏没有冲突，节奏松弛
 *  4) 单一功能主导：某角色所有对白都是info或都是conflict，形象单薄
 *  5) 关键时刻无功能混合：钩子/高潮场景对白单一功能，缺乏层次
 *  6) 功能分布失衡：plot功能>70%导致角色扁平，character功能>50%导致剧情慢
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

import { isSceneHeaderLine as isSharedSceneHeaderLine } from './script-scenes';

// c213：场头判定收口到共享切分器 script-scenes（单一事实源），本引擎不再私写场头正则
export type DfLang = 'zh' | 'en';

export interface DialogueFunctionIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export type DialogueFunction = 'plot' | 'character' | 'conflict' | 'info' | 'other';

export interface DialogueClassification {
  line: string;
  character: string;
  lineIndex: number;
  primaryFunction: DialogueFunction;
  functions: DialogueFunction[];
  confidence: number;
}

export interface CharacterFunctionBreakdown {
  name: string;
  lineCount: number;
  plot: number;
  character: number;
  conflict: number;
  info: number;
  other: number;
  isMonotone: boolean;
  dominantFunction: DialogueFunction;
}

export interface SceneFunctionBreakdown {
  sceneIndex: number;
  sceneTitle: string;
  lineCount: number;
  plot: number;
  character: number;
  conflict: number;
  info: number;
  other: number;
  isInfoDump: boolean;
  isConflictVacuum: boolean;
}

export interface DialogueFunctionResult {
  score: number;
  totalDialogueLines: number;
  functionDistribution: {
    plot: number;
    character: number;
    conflict: number;
    info: number;
    other: number;
  };
  functionRatio: {
    plot: number;
    character: number;
    conflict: number;
    info: number;
    other: number;
  };
  isBalanced: boolean;
  characterBreakdowns: CharacterFunctionBreakdown[];
  sceneBreakdowns: SceneFunctionBreakdown[];
  classifications: DialogueClassification[];
  issues: DialogueFunctionIssue[];
}

// —— 中文剧情推进信号：决定/动作/转折 ——
const PLOT_ZH = /(走|跑|冲|追|拦|挡|推|拉|打|杀|摔|砸|撕|抢|骂|吼|跪|求[饶谅]|滚|闭嘴|放手|凭什么|你敢|休想|做梦|不可能|没想到|原来|真相|身份|秘密|揭|穿|戳|露|报[复仇警]|合同|支票|钱|收购|签字|离婚|分手|出轨|背叛|怀孕|遗嘱|遗产|离开|出发|到达|进入|退出|逃|躲|藏|跟踪|调查|报警|立案|起诉|判决|逮捕|拘留|释放|和解|合作|谈判|签约|毁约|加入|辞职|就职|登基|退位|发动|开始|结束|停止|继续|放弃|坚持|决定|选择|同意|拒绝|答应|反对|支持|妥协|让步|进攻|撤退|反击|包围|突围|投降|被俘|逃脱|失忆|恢复记忆|穿越|重生|回到|前往|启程|归|回|来|去|到|下令|命令|指示|安排|部署|布置|下令|帮(?:我|你|他|她)(?:个)?忙|查清楚|查到底|复印|经侦|报案|举报|检举|讨回公道|联手|搭把手)/;

// —— 英文剧情推进信号 ——
const PLOT_EN = /\b(go|run|rush|chase|block|push|pull|hit|kill|smash|tear|grab|yell|kneel|beg|roll|shut up|let go|how dare|dream on|impossible|turns out|truth|identity|secret|expose|reveal|contract|check|money|buyout|sign|divorce|break up|cheat|betray|pregnant|will|inheritance|leave|depart|arrive|enter|exit|escape|hide|investigate|police|arrest|sue|verdict|release|reconcile|cooperate|negotiate|breach|join|resign|inaugurate|abdicate|launch|start|end|stop|continue|give up|persist|decide|choose|agree|refuse|oppose|support|compromise|attack|retreat|counterattack|surround|breakthrough|surrender|capture|amnesia|memory|reborn|return to|travel to|i need (?:a |your |me a )?favor|economic crimes|lawyer|copies|pressed charges|reported (?:him|her|them) to)\b/i;

// —— 中文塑造人物信号：性格/背景/情感/动机 ——
const CHARACTER_ZH = /(我是|我叫|我姓|我爹|我爸|我妈|我爷爷|我奶奶|我哥|我姐|我弟|我妹|我老公|我老婆|我儿子|我女儿|我家|我小时候|我年轻|我以前|我曾经|我过去|我见过|我听过|我做过|我希望|我想要|我渴望|我害怕|我担心|我恨|我爱|我喜欢|我讨厌|我舍不得|我后悔|我庆幸|我骄傲|我自卑|我自豪|我羞愧|我羡慕|我嫉妒|我同情|我可怜|我怨|我气|我笑|我哭|我开心|我难过|我害怕|我紧张|我兴奋|我冷静|我孤独|我寂寞|我相信|我认为|我怀疑|我信任|我记得|我忘了|我学会|我意识到|我发现|我明白|我懂了|我知道|我不知|我不懂|我不信|我信|我想|我觉得|我看|我看|我听过|我见过|我经历过)/;

// —— 英文塑造人物信号 ——
const CHARACTER_EN = /\b(i am|i'm|i was|my name is|my father|my mother|my brother|my sister|my son|my daughter|my husband|my wife|my family|when i was young|i used to|i once|i have|i had|i experienced|i saw|i heard|i did|i thought|i hope|i want|i wish|i desire|i fear|i worry|i hate|i love|i like|i dislike|i can't bear|i regret|i'm glad|i'm proud|i'm ashamed|i envy|i sympathize|i pity|i resent|i'm angry|i laugh|i cry|i'm happy|i'm sad|i'm scared|i'm nervous|i'm excited|i'm calm|i'm lonely|i feel|i believe|i think|i suspect|i doubt|i trust|i distrust|i remember|i forget|i learned|i realized|i discovered|i found out|i know|i don't know|i understand|i see|my dad|my mom|my mum|dad's|your (?:uncle|dad|daddy|mom|mum|father|mother|brother|sister|family)|you taught me|you raised me|you always|you never|find out myself|old enough)\b/i;

// —— 中文冲突信号：对抗/质疑/否定 ——
const CONFLICT_ZH = /(你凭什么|你怎么|你为什么|你算什么|你以为|你有什么|你怎么敢|你怎么能|你居然|你竟然|不可能|做梦|休想|想都别想|别想|别做梦|你想得美|滚|滚开|出去|闭嘴|别说|别废话|别啰嗦|少废话|少啰嗦|你闭嘴|你给我闭嘴|你给我滚|滚出去|我不答应|我不允许|我不同意|我不准|我不让|我不许|我不要|我不想|我不愿意|我不干|我不做|我不去|我偏不|我偏要|偏不|偏要|骗子|你骗我|你骗了我|你骗|我不服|我不甘心|我不认|我不认输|我不认命|我不甘|我不服气|你休想|休想|休想得逞|你想得美|做梦|别想|不许|不准|不行|不能|不可以|不允许|不同意|不答应|不干|不去|不做|不说|不听|不看|不理|不管|不问|不闻|不问|小孩子别问|别问|轮不到你|没你的事|有什么用|有用(?:么|吗)|你一个(?:高中生|女孩子|外人))/;

// —— 英文冲突信号 ——
const CONFLICT_EN = /\b(how dare you|how could you|why did you|why should i|who do you think you are|what gives you the right|impossible|dream on|forget it|no way|out of the question|get out|shut up|stop talking|cut the crap|less talk|i refuse|i disagree|i won't allow|i won't permit|i won't stand for|i won't tolerate|i won't accept|i won't agree|i won't go|i won't do|i won't make me|i won't let you|i insist|i demand|liar|you lied|you're lying|you deceived me|you cheated me|you tricked me|you fooled me|you betrayed me|i won't|no|i refuse|i don't agree|i don't think so|i won't accept|i won't allow|i won't permit|never|not|don't|stop|wait|hold on|what can (?:a|an|you|i|we)|what could (?:you|i)|pointless|useless)\b/i;

// —— 中文信息传递信号：交代设定/背景/事实 ——
const INFO_ZH = /(这是|这里有|这里就是|那里是|那个是|这就是|那就是|原来|据说|听说|传闻|传说|按规定|按规矩|按约定|按传统|依照|遵照|按照|根据|据我所知|据记载|据史书记载|据传|据闻|据实|史书记载|史载|史册|典籍|文献|档案|记录显示|纪录显示|有人说|传言说|消息说|新闻说|报道说|调查显示|数据显示|研究表明|法律规定|规则要求|协议约定|合同规定|条款约定|事实是|真相是|情况是|背景是|原因是|起因是|源头是|来源是|目的是|动机是|目标|目的|意图|企图|有记载|历史上|自古以来|历来|向来|从来|传统上|转账|汇款|收款人|空壳(?:公司)?|银行流水|流水|账目?|账本|录音|录像|监控|复印件?|律师(?:函|事务所)?|经侦|公安|报案|报社|媒体|记者|抵押|合同附件|凭证|发票|收据|证据(?:显示|表明)?)/;

// —— 英文信息传递信号 ——
const INFO_EN = /\b(this is|these are|here is|here are|there is|there are|that is|those are|according to|reportedly|i heard|rumor has it|legend has it|as a rule|by agreement|based on|as far as i know|it is said|it is reported|it is rumored|records show|history shows|the rules say|the law states|the prophecy|the legend|the contract|the agreement|the deal|the terms|the conditions|the facts|the truth|the reality|the situation|the background|the context|the setting|the story|the history|the origin|the source|the cause|the reason|the explanation|the plan|the procedure|the rule|the regulation|the clause|the condition|the requirement|the premise|the assumption|the setting|the background|the context|the environment|the situation|the status|the trend|the development|the process|the path|the direction|the destination|the goal|the purpose|the intention|the attempt|the plan|transfers?|shell compan|bank records?|ledger|receipts?|footage|surveillance|recordings?|fingerprints?|collateral|copies|the evidence)\b/i;

// —— 中文寒暄/水分信号（用于判定"无功能"对白） ——
const FILLER_ZH = /^(你好|您好|早上好|下午好|晚上好|再见|拜拜|晚安|吃了吗|吃了没|最近怎么样|最近好吗|好久不见|好久没见|身体怎么样|最近忙吗|在吗|在不在|喂|哈喽|嗨|你好呀|你好啊|辛苦了|麻烦了|打扰了|不好意思|好的|好|行|可以|没问题|知道了|明白|懂了|嗯|啊|哦|唉|呃|那个|这个|嗯啊|嗯哼|哦哦|唉唉|是的|对的|没错|对|是的)[？?！!。.，,]?\s*$/;

// —— 英文寒暄/水分信号 ——
const FILLER_EN = /^(hi|hello|hey|good (morning|afternoon|evening)|bye|goodbye|good night|how are you|how's it going|long time no see|what's up|sorry to bother you|excuse me|thank you|thanks|ok|okay|sure|fine|got it|understood|i see|i know|yeah|yes|no|uh|hmm|ah|oh|er|um|right|correct|exactly)\??\.?\s*$/i;

function isActionLine(line: string, lang: DfLang): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (lang === 'zh' && trimmed.startsWith('△')) return true;
  if (lang === 'en' && /^\([^)]+\)$/.test(trimmed)) return true;
  if (lang === 'en' && trimmed === trimmed.toUpperCase() && !/[,:]/.test(trimmed) && trimmed.length > 3) return true;
  return false;
}

function extractDialogue(line: string, _lang: DfLang): { character: string; content: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // 中文角色名：内容；角色名后可跟（舞台提示）。
  // 角色名只取括号前 1-12 字，避免"林小凡（把催款单往身后藏）：…"因总长度超龄被整行丢弃（c213）
  const cnMatch = trimmed.match(/^([^\s:：（(]{1,12})\s*(?:[（(][^）)]*[）)])?\s*[:：]\s*(.+)$/);
  if (cnMatch) return { character: cnMatch[1], content: cnMatch[2] };
  // 英文：CHARACTER: content / CHARACTER (stage): content
  const enMatch = trimmed.match(/^([A-Z][A-Z\s]{1,20})\s*(?:\([^)]+\))?\s*[:：]\s*(.+)$/);
  if (enMatch) return { character: enMatch[1].trim(), content: enMatch[2] };
  return null;
}

function classifyLine(content: string, lang: DfLang): { functions: DialogueFunction[]; confidence: number } {
  const trimmed = content.trim();
  if (!trimmed) return { functions: ['other'], confidence: 50 };

  // 寒暄/水分判定
  if (FILLER_ZH.test(trimmed) || FILLER_EN.test(trimmed)) {
    return { functions: ['other'], confidence: 90 };
  }

  const functions: DialogueFunction[] = [];
  const patternMap: Array<[DialogueFunction, RegExp]> = lang === 'zh'
    ? [
        ['plot', PLOT_ZH],
        ['character', CHARACTER_ZH],
        ['conflict', CONFLICT_ZH],
        ['info', INFO_ZH],
      ]
    : [
        ['plot', PLOT_EN],
        ['character', CHARACTER_EN],
        ['conflict', CONFLICT_EN],
        ['info', INFO_EN],
      ];

  for (const [fn, pattern] of patternMap) {
    if (pattern.test(trimmed)) functions.push(fn);
  }

  // 单字/短词回应（无功能）
  if (trimmed.length <= 4 && functions.length === 0) {
    return { functions: ['other'], confidence: 70 };
  }

  // 无任何功能信号，标记为 other
  if (functions.length === 0) {
    return { functions: ['other'], confidence: 50 };
  }

  // 多功能混合时，按优先级排序：plot > conflict > character > info
  const priority: Record<DialogueFunction, number> = { plot: 1, conflict: 2, character: 3, info: 4, other: 5 };
  functions.sort((a, b) => priority[a] - priority[b]);
  return { functions, confidence: 80 };
}

function buildSceneBreakdown(
  sceneIndex: number,
  sceneTitle: string,
  lineCount: number,
  distribution: { plot: number; character: number; conflict: number; info: number; other: number }
): SceneFunctionBreakdown {
  return {
    sceneIndex,
    sceneTitle,
    lineCount,
    plot: distribution.plot,
    character: distribution.character,
    conflict: distribution.conflict,
    info: distribution.info,
    other: distribution.other,
    isInfoDump: lineCount > 0 && distribution.info / lineCount > 0.5 && lineCount >= 3,
    isConflictVacuum: lineCount > 0 && distribution.conflict / lineCount < 0.1 && lineCount >= 3,
  };
}

export function dialogueFunctionalityCheck(script: string, lang: DfLang = 'zh'): DialogueFunctionResult {
  const lines = script.split('\n');
  const classifications: DialogueClassification[] = [];
  const characterBreakdownMap = new Map<string, CharacterFunctionBreakdown>();
  const sceneBreakdowns: SceneFunctionBreakdown[] = [];

  let currentSceneIndex = -1;
  let currentSceneTitle = '';
  let currentSceneLines = 0;
  let currentSceneDistribution = { plot: 0, character: 0, conflict: 0, info: 0, other: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 场景标题
    if (isSharedSceneHeaderLine(line, lang)) {
      // 提交上一场景
      if (currentSceneIndex >= 0 && currentSceneLines > 0) {
        sceneBreakdowns.push(buildSceneBreakdown(currentSceneIndex, currentSceneTitle, currentSceneLines, currentSceneDistribution));
      }
      currentSceneIndex++;
      currentSceneTitle = line.trim().slice(0, 30);
      currentSceneLines = 0;
      currentSceneDistribution = { plot: 0, character: 0, conflict: 0, info: 0, other: 0 };
      continue;
    }

    // 动作行跳过
    if (isActionLine(line, lang)) continue;

    // 对白行
    const dialogue = extractDialogue(line, lang);
    if (!dialogue) continue;

    const { functions, confidence } = classifyLine(dialogue.content, lang);
    const primaryFunction = functions[0];
    classifications.push({
      line: dialogue.content.slice(0, 60),
      character: dialogue.character,
      lineIndex: i,
      primaryFunction,
      functions,
      confidence,
    });

    // 更新角色分布
    const charName = dialogue.character;
    if (!characterBreakdownMap.has(charName)) {
      characterBreakdownMap.set(charName, {
        name: charName,
        lineCount: 0,
        plot: 0,
        character: 0,
        conflict: 0,
        info: 0,
        other: 0,
        isMonotone: false,
        dominantFunction: 'other',
      });
    }
    const charBreakdown = characterBreakdownMap.get(charName)!;
    charBreakdown.lineCount++;
    charBreakdown[primaryFunction]++;

    // 更新场景分布
    if (currentSceneIndex >= 0) {
      currentSceneLines++;
      currentSceneDistribution[primaryFunction]++;
    }
  }

  // 提交最后一场景
  if (currentSceneIndex >= 0 && currentSceneLines > 0) {
    sceneBreakdowns.push(buildSceneBreakdown(currentSceneIndex, currentSceneTitle, currentSceneLines, currentSceneDistribution));
  }

  // 计算总分布
  const functionDistribution = {
    plot: classifications.filter((c) => c.primaryFunction === 'plot').length,
    character: classifications.filter((c) => c.primaryFunction === 'character').length,
    conflict: classifications.filter((c) => c.primaryFunction === 'conflict').length,
    info: classifications.filter((c) => c.primaryFunction === 'info').length,
    other: classifications.filter((c) => c.primaryFunction === 'other').length,
  };

  const total = classifications.length || 1;
  const functionRatio = {
    plot: Math.round((functionDistribution.plot / total) * 100),
    character: Math.round((functionDistribution.character / total) * 100),
    conflict: Math.round((functionDistribution.conflict / total) * 100),
    info: Math.round((functionDistribution.info / total) * 100),
    other: Math.round((functionDistribution.other / total) * 100),
  };

  // 计算角色主导功能与单调性
  for (const cb of characterBreakdownMap.values()) {
    if (cb.lineCount === 0) continue;
    const fns: Array<[DialogueFunction, number]> = [
      ['plot', cb.plot],
      ['character', cb.character],
      ['conflict', cb.conflict],
      ['info', cb.info],
      ['other', cb.other],
    ];
    fns.sort((a, b) => b[1] - a[1]);
    cb.dominantFunction = fns[0][0];
    const dominantRatio = fns[0][1] / cb.lineCount;
    cb.isMonotone = dominantRatio > 0.8 && cb.lineCount >= 5;
  }

  // 计算场景信息倾倒与冲突真空
  for (const sb of sceneBreakdowns) {
    if (sb.lineCount === 0) continue;
    const infoRatio = sb.info / sb.lineCount;
    sb.isInfoDump = infoRatio > 0.5 && sb.lineCount >= 3;
    const conflictRatio = sb.conflict / sb.lineCount;
    sb.isConflictVacuum = conflictRatio < 0.1 && sb.lineCount >= 3;
  }

  // 功能分布均衡性
  const isBalanced =
    functionRatio.plot >= 25 && functionRatio.plot <= 60 &&
    functionRatio.character >= 10 && functionRatio.character <= 45 &&
    functionRatio.conflict >= 10 && functionRatio.conflict <= 45 &&
    functionRatio.info >= 5 && functionRatio.info <= 35;

  // —— 问题检测 ——
  const issues: DialogueFunctionIssue[] = [];

  // 1. 角色塑造缺失（character 功能 <10%）
  if (functionRatio.character < 10) {
    issues.push({
      severity: 'high',
      type: 'character_function_missing',
      evidence: lang === 'en'
        ? `Character-building dialogue only ${functionRatio.character}% (<10%). Characters feel flat.`
        : `塑造人物的对白仅占 ${functionRatio.character}%（<10%），角色形象扁平，缺乏情感与动机展示`,
      advice: lang === 'en'
        ? 'Add 2-3 character-building lines (hopes, fears, past, motives) per scene so the audience connects emotionally.'
        : '每场戏增加 2-3 句塑造人物的对白（希望/恐惧/过往/动机），让观众对角色有情感连接',
    });
  }

  // 2. 信息倾倒（info 功能 >35%）
  if (functionRatio.info > 35) {
    issues.push({
      severity: 'high',
      type: 'info_overload',
      evidence: lang === 'en'
        ? `Information dialogue ${functionRatio.info}% (>35%). Audience retention drops sharply.`
        : `信息传递对白占 ${functionRatio.info}%（>35%），观众吸收率急剧下降`,
      advice: lang === 'en'
        ? 'Convert exposition to conflict or action: instead of "As you know, your father died 10 years ago", show "Your father died because of him!"'
        : '把设定交代转为冲突或动作：不用"我父亲十年前去世了"，改为"你父亲就是被他害死的！"',
    });
  }

  // 3. 剧情推进过载（plot 功能 >70%）
  if (functionRatio.plot > 70) {
    issues.push({
      severity: 'mid',
      type: 'plot_overload',
      evidence: lang === 'en'
        ? `Plot-advancing dialogue ${functionRatio.plot}% (>70%). Pacing too fast, no breathing room.`
        : `推进剧情的对白占 ${functionRatio.plot}%（>70%），节奏过快，缺乏喘息与情感沉淀`,
      advice: lang === 'en'
        ? 'Insert character-building or reflective beats every 5-6 plot-advancing lines so the audience can absorb the action.'
        : '每 5-6 句推进剧情后插入 1-2 句塑造人物/反思对白，让观众有情感缓冲',
    });
  }

  // 4. 冲突真空（conflict 功能 <10%）
  if (functionRatio.conflict < 10) {
    issues.push({
      severity: 'high',
      type: 'conflict_vacuum',
      evidence: lang === 'en'
        ? `Conflict dialogue only ${functionRatio.conflict}% (<10%). No dramatic tension.`
        : `制造冲突的对白仅占 ${functionRatio.conflict}%（<10%），全剧缺乏戏剧张力`,
      advice: lang === 'en'
        ? 'Add confrontations: disagreement, refusal, accusation, ultimatum. Every scene should have at least one conflict beat.'
        : '每场戏至少一句冲突对白：反对/拒绝/指责/最后通牒/质疑，让对抗贯穿全剧',
    });
  }

  // 5. 信息倾倒场景（单场景 info >50%）
  const infoDumpScenes = sceneBreakdowns.filter((s) => s.isInfoDump);
  if (infoDumpScenes.length > 0) {
    const offenders = infoDumpScenes.slice(0, 3);
    issues.push({
      severity: infoDumpScenes.length >= 2 ? 'high' : 'mid',
      type: 'info_dump_scene',
      evidence: lang === 'en'
        ? `${infoDumpScenes.length} info-dump scenes (>50% exposition): ${offenders.map((o) => `S${o.sceneIndex + 1}=${Math.round((o.info / o.lineCount) * 100)}%`).join(', ')}`
        : `${infoDumpScenes.length} 个信息倾倒场景（info 功能 >50%）：${offenders.map((o) => `第${o.sceneIndex + 1}场=${Math.round((o.info / o.lineCount) * 100)}%`).join(', ')}`,
      advice: lang === 'en'
        ? 'Break up exposition: deliver through conflict, action, or visual storytelling rather than long monologues.'
        : '把设定信息拆散：通过冲突、动作、视觉呈现而非长段独白来交代',
    });
  }

  // 6. 冲突真空场景（连续 2+ 场戏无冲突）
  const conflictVacuumScenes = sceneBreakdowns.filter((s) => s.isConflictVacuum);
  if (conflictVacuumScenes.length >= 2) {
    const offenders = conflictVacuumScenes.slice(0, 3);
    issues.push({
      severity: 'mid',
      type: 'conflict_vacuum_scene',
      evidence: lang === 'en'
        ? `${conflictVacuumScenes.length} conflict-vacuum scenes (<10% conflict): ${offenders.map((o) => `S${o.sceneIndex + 1}`).join(', ')}`
        : `${conflictVacuumScenes.length} 个冲突真空场景（冲突对白 <10%）：${offenders.map((o) => `第${o.sceneIndex + 1}场`).join(', ')}`,
      advice: lang === 'en'
        ? 'Inject micro-conflicts: even ordinary scenes need disagreement, refusal, or hidden tension to maintain dramatic pressure.'
        : '注入微冲突：即使是日常场景也需要反对/拒绝/暗流涌动，保持戏剧压力',
    });
  }

  // 7. 角色功能单一（某角色所有对白都是同一功能）
  const monotoneChars = [...characterBreakdownMap.values()].filter((c) => c.isMonotone && c.lineCount >= 5);
  if (monotoneChars.length > 0) {
    const offenders = monotoneChars.slice(0, 3);
    issues.push({
      severity: monotoneChars.length >= 2 ? 'mid' : 'low',
      type: 'character_monotone_function',
      evidence: lang === 'en'
        ? `${monotoneChars.length} character(s) with monotone function (>80% one type): ${offenders.map((o) => `${o.name}=${o.dominantFunction}`).join(', ')}`
        : `${monotoneChars.length} 个角色对白功能单一（>80% 为同一类）：${offenders.map((o) => `${o.name}=${o.dominantFunction}`).join(', ')}`,
      advice: lang === 'en'
        ? `Diversify the character's dialogue functions: an "info-dump" character should also advance plot, express emotion, or trigger conflict.`
        : '丰富该角色的对白功能：信息交代角色也应推进剧情、表达情感、引发冲突',
    });
  }

  // 8. 无功能对白过多（other >30%）
  if (functionRatio.other > 30) {
    issues.push({
      severity: 'mid',
      type: 'too_many_no_function',
      evidence: lang === 'en'
        ? `Non-functional dialogue ${functionRatio.other}% (>30%). Many lines neither advance plot nor build character.`
        : `无功能对白占 ${functionRatio.other}%（>30%），大量对白既不推进剧情也不塑造人物`,
      advice: lang === 'en'
        ? 'Cut or rewrite: every line should advance plot, build character, create conflict, or deliver info. Cut filler greetings.'
        : '删除或重写：每句对白应至少承担一种功能，删除寒暄/客套/无意义回应',
    });
  }

  // —— 计算总分 ——
  let score = 100;

  // 空对白剧本直接返回 100（无对白不算违规）
  if (classifications.length === 0) {
    return {
      score: 100,
      totalDialogueLines: 0,
      functionDistribution: { plot: 0, character: 0, conflict: 0, info: 0, other: 0 },
      functionRatio: { plot: 0, character: 0, conflict: 0, info: 0, other: 0 },
      isBalanced: true,
      characterBreakdowns: [],
      sceneBreakdowns,
      classifications: [],
      issues: [],
    };
  }

  // 功能分布均衡度（核心扣分项）
  if (!isBalanced) {
    const deviations: number[] = [];
    if (functionRatio.plot < 25 || functionRatio.plot > 60) deviations.push(Math.abs(functionRatio.plot - 42.5) / 42.5);
    if (functionRatio.character < 10 || functionRatio.character > 45) deviations.push(Math.abs(functionRatio.character - 27.5) / 27.5);
    if (functionRatio.conflict < 10 || functionRatio.conflict > 45) deviations.push(Math.abs(functionRatio.conflict - 27.5) / 27.5);
    if (functionRatio.info < 5 || functionRatio.info > 35) deviations.push(Math.abs(functionRatio.info - 20) / 20);
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / Math.max(deviations.length, 1);
    score -= Math.min(40, Math.round(avgDeviation * 40));
  }

  // high 级问题扣分
  const highIssues = issues.filter((i) => i.severity === 'high');
  score -= highIssues.length * 12;

  // mid 级问题扣分
  const midIssues = issues.filter((i) => i.severity === 'mid');
  score -= midIssues.length * 5;

  // 单调角色扣分
  score -= monotoneChars.length * 3;

  // 信息倾倒场景扣分
  score -= infoDumpScenes.length * 4;

  // 冲突真空场景扣分
  score -= conflictVacuumScenes.length * 3;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score,
    totalDialogueLines: classifications.length,
    functionDistribution,
    functionRatio,
    isBalanced,
    characterBreakdowns: [...characterBreakdownMap.values()].sort((a, b) => b.lineCount - a.lineCount),
    sceneBreakdowns,
    classifications: classifications.slice(0, 30),
    issues,
  };
}
