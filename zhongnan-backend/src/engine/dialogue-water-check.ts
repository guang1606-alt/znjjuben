import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 台词水分检测器（PRD 2.1.12 短剧信息密度生死线）
 * ------------------------------------------------------------------
 * 短剧每一秒屏幕时间都极其宝贵——水分台词直接导致用户弃剧。
 * 水分台词定义：不推进剧情、不塑造人物、不制造冲突、不传递关键信息的对白。
 *
 * dialogue.ts 只检测"书面腔/AI腔"（台词像不像人话），
 * rhythm.ts 只检测"有没有冲突信号"（冲突信号数量），
 * 但都不评估"台词本身有没有用"——有没有在推进故事。
 *
 * 本引擎逐行扫描对白，识别五种水分台词：
 *  1) 寒暄型：无意义问候/客套/打招呼（"你好""最近怎么样"）
 *  2) 不推进型：说了半天剧情没动（纯聊天无冲突/无信息/无转折）
 *  3) 重复型：重复已知信息（把观众已经看到的事再说一遍）
 *  4) 过长铺垫型：铺垫太长才进入重点（观众等不及）
 *  5) 无功能型：不推进剧情/不塑造人物/不制造冲突/不传递信息
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type DwLang = 'zh' | 'en';

export interface DialogueWaterIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export type WaterType =
  | 'greeting'      // 寒暄型：无意义问候/客套
  | 'filler'        // 不推进型：纯聊天无剧情推进
  | 'repeat'        // 重复型：重复已知信息
  | 'long_setup'    // 过长铺垫型：铺垫太长
  | 'no_progress';  // 无功能型：不推进/不塑造/不冲突/不传递

export interface WaterHit {
  /** 水分台词原文 */
  line: string;
  /** 角色名 */
  character: string;
  /** 水分类型 */
  waterType: WaterType;
  /** 水分等级 0-100（越高越水） */
  waterLevel: number;
  /** 位置（行号） */
  lineIndex: number;
}

export interface DialogueWaterResult {
  /** 台词水分率 0-100（越低越好，0=零水分，100=全是水分） */
  score: number;
  /** 台词总行数 */
  totalLines: number;
  /** 水分台词数 */
  waterCount: number;
  /** 水分率（水分台词/总台词） */
  waterRatio: number;
  /** 命中的水分台词 */
  hits: WaterHit[];
  issues: DialogueWaterIssue[];
}

// —— 中文寒暄信号：整句只是打招呼/客套 ——
const GREETING_ZH = /^(你好|您好|早上好|下午好|晚上好|再见|拜拜|晚安|吃了吗|吃了没|最近怎么样|最近好吗|好久不见|好久没见|身体怎么样|身体还好吧|最近忙吗|在吗|在不在|喂|哈喽|嗨|你好呀|你好啊|辛苦了|麻烦了|打扰了|不好意思)[？?！!。.，,]?\s*$/;

// —— 英文寒暄信号 ——
const GREETING_EN = /^(hi|hello|hey|good (morning|afternoon|evening)|bye|goodbye|good night|how are you|how's it going|long time no see|what's up|sorry to bother you|excuse me|thank you|thanks)\??\.?\s*$/i;

// —— 中文剧情推进信号：台词包含这些才算"有用" ——
const PROGRESS_ZH = /(打|杀|摔|砸|撕|抢|骂|吼|怒|哭|笑|冷笑|瞪|逼|跪|求[饶谅]|滚|闭嘴|放手|凭什么|你敢|休想|做梦|不可能|没想到|原来|真相|身份|秘密|揭|穿|戳|露|报[复仇警]|合同|支票|钱|收购|签字|离婚|分手|出轨|背叛|怀孕|遗嘱|遗产|首富|总裁|董事长|走|跑|冲|追|拦|挡|推|拉|揪|踹|踢|扇|泼|砸|掀|摔|瞪|冷笑|怀孕|出轨|解雇|开除|不同意|答应|拒绝|威胁|警告|调查|证据|照片|视频|录音|聊天记录|转账|欠条|借条|抵押|拍卖|交易|合作|投资|入股|分红|股份|过户|改名|户口|遗物|遗书|目击|证人|嫌疑|报警|立案|拘留|逮捕|起诉|判决|律师|法庭|开庭|败诉|胜诉|上诉|合同|协议|条款|违约|赔偿|损失|责任|义务|权利|利益|价格|金额|数字|日期|时间|地点|地址|名字|关系|认识|知道|告诉|隐瞒|欺骗|坦白|承认|否认|撒谎|造假|伪造|篡改|删除|销毁|隐藏|找|发现|看到|听到|遇到|碰见|撞见|跟踪|监视|盯梢|尾随|调查|查|搜|翻|找)/;

// —— 英文剧情推进信号 ——
const PROGRESS_EN = /\b(fight|kill|hit|smash|tear|grab|yell|angry|cry|laugh|sneer|glare|force|kneel|beg|roll|shut up|let go|why|how dare|dream on|impossible|didn't expect|turns out|truth|identity|secret|expose|reveal|contract|check|money|buyout|sign|divorce|break up|cheat|betray|pregnant|will|inheritance|boss|ceo|chairman|go|run|rush|chase|block|push|pull|kick|slap|pour|fire|dismiss|disagree|agree|refuse|threaten|warn|investigate|evidence|photo|video|recording|transfer|debt|iou|mortgage|auction|deal|cooperate|invest|share|stock|name|change name|account|witness|suspect|police|arrest|sue|verdict|lawyer|court|lawsuit|breach|compensate|loss|responsibility|right|interest|price|amount|number|date|time|place|address|name|relationship|know|tell|hide|deceive|confess|admit|deny|lie|forge|fake|destroy|delete|hide|find|discover|see|hear|meet|catch|follow|monitor|investigate|search)\b/i;

// —— 重复信息信号：台词在复述观众已知的事 ——
const REPEAT_ZH = /(我刚才说的是|我告诉你了|你知道吗|你不知道|我跟你说|听我说|我说的是|你听懂了吗|明白了吗|懂了吗|我说了|我不是说了|我已经|我早就|你之前|上次|上次你说|你答应过|你承诺过|你说过|你保证过)/;
const REPEAT_EN = /\b(i told you|you know|did you know|listen to me|i'm saying|understand|got it|i said|i already|last time|you promised|you said|you agreed|you guaranteed)\b/i;

// —— 寒暄/水分台词（即使在剧情推进中，整段只是寒暄也算水分） ——
const FILLER_ZH = /(天气真好|今天天气|吃什么呢|去哪儿|去哪|下班了吗|下班了|回来啦|回来了|出门|回家|睡觉|休息|早安|晚安|吃饭了吗|吃了没|最近怎么样|最近好吗|好久不见|好久没见|身体怎么样|最近忙吗|在吗|在不在|辛苦了|麻烦了|打扰了|不好意思|没什么事|就是来看看你|就是想你了|想你了|喜欢你|爱你|想你|念你|牵挂你|担心你|关心你|在乎你)/;
const FILLER_EN = /\b(nice weather|what's for dinner|where are (you|we) going|off work|back home|go to bed|take a rest|good morning|good night|have you eaten|how are you|long time no see|nothing much|just checking on you|just missed you|like you|love you|miss you|worry about you|care about you)\b/i;

/**
 * 提取角色名：支持「角色名（情绪）：台词」和「角色名：台词」格式
 */
function extractCharacter(line: string): string {
  // 匹配「角色名（可选情绪）：台词」或「角色名: 台词」
  const m = line.match(/^([^\s:：]{1,8})(?:（[^）]*）)?[：:]/);
  return m ? m[1] : '';
}

/**
 * 提取台词正文：去掉角色名和情绪标注
 */
function extractDialogueText(line: string): string {
  // 去掉「角色名（情绪）：」前缀
  const m = line.match(/^[^\s:：]{1,8}(?:（[^）]*）)?[：:]\s*(.+)$/);
  return m ? m[1].trim() : line.trim();
}

/**
 * 判断一行是否为对白行（不是场景行/动作行）
 */
function isDialogueLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // c213：非正文行（共享切分器全格式场头 + 剧名页/集标题）；语种由行内容自探测
  if (isSceneOrTitleLine(trimmed)) return false;
  // 动作行：以 △ 开头
  if (trimmed.startsWith('△')) return false;
  // 对白行：匹配「角色名（情绪）：台词」或「角色名: 台词」
  return /^[^\s:：]{1,8}(?:（[^）]*）)?[：:]/.test(trimmed);
}

/**
 * 计算水分等级（0-100，越高越水）
 */
function calcWaterLevel(
  text: string,
  waterType: WaterType,
  lang: DwLang,
  lineIndex: number,
  allLines: string[],
): number {
  switch (waterType) {
    case 'greeting':
      return 95; // 纯寒暄几乎是100%水分
    case 'repeat':
      return 80; // 重复已知信息80%水分
    case 'long_setup': {
      // 铺垫过长：检查该台词前是否有连续3行以上无推进台词
      let setupCount = 0;
      for (let i = Math.max(0, lineIndex - 3); i < lineIndex; i++) {
        const prev = extractDialogueText(allLines[i] || '');
        if (prev && !PROGRESS_ZH.test(prev) && !PROGRESS_EN.test(prev)) setupCount++;
      }
      return Math.min(90, 50 + setupCount * 15);
    }
    case 'filler':
      return 70; // 不推进型70%水分
    case 'no_progress':
      return 60; // 无功能型60%水分
    default:
      return 50;
  }
}

/**
 * 主函数：检测台词水分
 * @param text 成稿全文
 * @param lang 中英文
 */
export function dialogueWaterCheck(text: string, lang: DwLang = 'zh'): DialogueWaterResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const dialogueLines: { raw: string; character: string; text: string; index: number }[] = [];

  // 提取所有对白行
  for (let i = 0; i < lines.length; i++) {
    if (isDialogueLine(lines[i])) {
      dialogueLines.push({
        raw: lines[i],
        character: extractCharacter(lines[i]),
        text: extractDialogueText(lines[i]),
        index: i,
      });
    }
  }

  const totalLines = dialogueLines.length;
  const hits: WaterHit[] = [];

  // 逐行检测水分
  for (const dl of dialogueLines) {
    const { text: dialogueText, character, index } = dl;
    let waterType: WaterType | null = null;

    // 1. 寒暄型检测（最高优先级——整句只是寒暄）
    const greetingRe = lang === 'en' ? GREETING_EN : GREETING_ZH;
    if (greetingRe.test(dialogueText)) {
      waterType = 'greeting';
    }

    // 2. 重复型检测
    if (!waterType) {
      const repeatRe = lang === 'en' ? REPEAT_EN : REPEAT_ZH;
      if (repeatRe.test(dialogueText)) {
        waterType = 'repeat';
      }
    }

    // 3. 不推进型检测（纯聊天无剧情推进信号）
    if (!waterType) {
      const progressRe = lang === 'en' ? PROGRESS_EN : PROGRESS_ZH;
      const fillerRe = lang === 'en' ? FILLER_EN : FILLER_ZH;
      // 如果台词既无推进信号，又包含水分词
      if (!progressRe.test(dialogueText) && fillerRe.test(dialogueText)) {
        waterType = 'filler';
      }
    }

    // 4. 过长铺垫型检测（该台词前有连续3行以上无推进台词）
    if (!waterType) {
      let noProgressCount = 0;
      for (let i = Math.max(0, index - 3); i < index; i++) {
        const prevText = extractDialogueText(lines[i] || '');
        if (prevText && isDialogueLine(lines[i])) {
          const progressRe = lang === 'en' ? PROGRESS_EN : PROGRESS_ZH;
          if (!progressRe.test(prevText)) noProgressCount++;
        }
      }
      if (noProgressCount >= 3) {
        waterType = 'long_setup';
      }
    }

    // 5. 无功能型检测（不推进/不塑造/不冲突/不传递——最后兜底）
    if (!waterType) {
      const progressRe = lang === 'en' ? PROGRESS_EN : PROGRESS_ZH;
      // 台词短且无推进信号（<8字 且 无动作/信息词）
      const isShort = dialogueText.length < (lang === 'en' ? 15 : 8);
      if (isShort && !progressRe.test(dialogueText)) {
        // 但要排除情绪表达（如"滚！""闭嘴！"虽短但推进）
        const emotionWords = lang === 'en'
          ? /\b(get out|shut up|go away|leave me alone|stop it|enough)\b/i
          : /(滚|闭嘴|放手|你敢|休想|做梦|滚开|出去|别碰|不许)/;
        if (!emotionWords.test(dialogueText)) {
          waterType = 'no_progress';
        }
      }
    }

    // 命中水分台词
    if (waterType) {
      const waterLevel = calcWaterLevel(dialogueText, waterType, lang, index, lines);
      hits.push({
        line: dialogueText,
        character: character || (lang === 'en' ? 'Unknown' : '未知角色'),
        waterType,
        waterLevel,
        lineIndex: index,
      });
    }
  }

  const waterCount = hits.length;
  const waterRatio = totalLines > 0 ? waterCount / totalLines : 0;

  // 综合得分：0=零水分（满分100），100=全是水分（0分）
  // 转换为"质量分"：score = 100 - waterRatio * 100（越低水分越高分）
  let score = Math.round(100 - waterRatio * 100);

  const issues: DialogueWaterIssue[] = [];

  // 1. 水分率过高（high 级：水分率 > 40%）
  if (totalLines >= 5) {
    if (waterRatio > 0.4) {
      issues.push({
        severity: 'high',
        type: 'excessive_water',
        evidence: lang === 'en'
          ? `Water ratio ${Math.round(waterRatio * 100)}% — almost half of all dialogue is filler`
          : `水分率${Math.round(waterRatio * 100)}%——近半数台词是水分`,
        advice: lang === 'en'
          ? 'Cut all filler dialogue — every line MUST advance plot, build character, or create conflict. Short drama has no room for small talk'
          : '删除所有水分台词——每句必须推进剧情、塑造人物或制造冲突。短剧没有闲聊的空间',
      });
    } else if (waterRatio > 0.25) {
      issues.push({
        severity: 'mid',
        type: 'high_water',
        evidence: lang === 'en'
          ? `Water ratio ${Math.round(waterRatio * 100)}% — too much filler dialogue`
          : `水分率${Math.round(waterRatio * 100)}%——水分台词偏多`,
        advice: lang === 'en'
          ? 'Reduce filler — every line should earn its screen time by advancing the story'
          : '减少水分——每句台词都要为推进故事争取屏幕时间',
      });
    }
  }

  // 2. 寒暄过多（high 级：寒暄台词 > 2 处）
  const greetingCount = hits.filter((h) => h.waterType === 'greeting').length;
  if (greetingCount > 2) {
    issues.push({
      severity: 'high',
      type: 'too_many_greetings',
      evidence: lang === 'en'
        ? `${greetingCount} greeting-only lines — short drama has no time for small talk`
        : `${greetingCount}句纯寒暄台词——短剧没有寒暄的时间`,
      advice: lang === 'en'
        ? 'Delete greetings unless they reveal character or hide critical info. Start scenes mid-conflict'
        : '删除寒暄，除非能塑造人物或藏关键信息。场景从冲突中间开始',
    });
  } else if (greetingCount > 0) {
    issues.push({
      severity: 'mid',
      type: 'has_greetings',
      evidence: lang === 'en'
        ? `${greetingCount} greeting-only line(s) detected`
        : `检测到${greetingCount}句纯寒暄台词`,
      advice: lang === 'en'
        ? 'Cut the greeting and start with conflict or a revealing line'
        : '删除寒暄，直接从冲突或信息台词切入',
    });
  }

  // 3. 重复信息过多（mid 级：重复台词 > 1 处）
  const repeatCount = hits.filter((h) => h.waterType === 'repeat').length;
  if (repeatCount > 1) {
    issues.push({
      severity: 'mid',
      type: 'repeated_info',
      evidence: lang === 'en'
        ? `${repeatCount} lines repeating known information — audience already saw it`
        : `${repeatCount}句重复已知信息——观众已经看到了`,
      advice: lang === 'en'
        ? 'Don\'t tell what the audience already saw — jump to the next story beat'
        : '不要复述观众已看到的——直接跳到下一个剧情节拍',
    });
  }

  // 4. 过长铺垫（mid 级：连续无推进台词 > 3 行）
  const longSetupCount = hits.filter((h) => h.waterType === 'long_setup').length;
  if (longSetupCount > 0) {
    issues.push({
      severity: 'mid',
      type: 'long_setup',
      evidence: lang === 'en'
        ? `${longSetupCount} line(s) after 3+ non-progressing lines — pacing is dragging`
        : `${longSetupCount}处连续3行以上无推进台词——节奏在拖`,
      advice: lang === 'en'
        ? 'Cut setup short — get to the point. Every line after the third should escalate'
        : '缩短铺垫——直接进入重点。第三行之后每句必须升级',
    });
  }

  // 5. 无功能台词过多（low 级：无功能台词 > 30%）
  const noProgressCount = hits.filter((h) => h.waterType === 'no_progress').length;
  if (totalLines >= 5 && noProgressCount / totalLines > 0.3) {
    issues.push({
      severity: 'low',
      type: 'no_function',
      evidence: lang === 'en'
        ? `${noProgressCount} lines with no story function (${Math.round((noProgressCount / totalLines) * 100)}%)`
        : `${noProgressCount}句无功能台词（${Math.round((noProgressCount / totalLines) * 100)}%）`,
      advice: lang === 'en'
        ? 'Each line should do at least one of: advance plot, build character, create conflict, or deliver info'
        : '每句台词至少完成一项：推进剧情、塑造人物、制造冲突、传递信息',
    });
  }

  // high 级问题额外扣分
  for (const issue of issues) {
    if (issue.severity === 'high') score -= 10;
    else if (issue.severity === 'mid') score -= 5;
    else score -= 2;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, totalLines, waterCount, waterRatio: Number(waterRatio.toFixed(2)), hits, issues };
}
