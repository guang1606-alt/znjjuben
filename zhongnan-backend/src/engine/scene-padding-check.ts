import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.132 场景注水/空转检测（Scene Padding Check）
 *
 * 竖屏短剧节奏生死线：每 30 秒必须有新信息/冲突/关系变化。检测五类注水：
 * 1. dead_scene（high）三无场景：整场无冲突、无新信息、无关系推进，只有寒暄/日常/闲聊
 * 2. recap_dump（mid）复述注水：前情提要/上集说到/"我不是告诉过你"/换句话说 反复回锅已知信息
 * 3. redundant_flashback（low）闪回注水：多次闪回却零新信息揭晓，只剩抒情重复
 * 4. slow_open（mid）寒暄开场：开场 15% 零推进，起床洗漱/天气/打招呼连篇
 * 5. draggy_tail（mid）结尾拖堂：末段 15% 矛盾已平，"从此/回归平静/岁月静好"式尾巴
 *
 * 纯文本启发式：场景按场景标题行切分；信号库中英双语。
 */

export type PaddingLang = 'zh' | 'en';

export interface PaddingIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export interface ScenePaddingResult {
  score: number;
  sceneCount: number;
  deadSceneCount: number;
  recapCount: number;
  flashbackCount: number;
  newInfoCount: number;
  fillerCount: number;
  slowOpen: boolean;
  draggyTail: boolean;
  deadScenes: string[];
  issues: PaddingIssue[];
}

// —— 中文信号库 ——
// 场内"有戏"硬信号：冲突动作 / 决定 / 新信息 / 关系变化 / 强钩子
const PROGRESS_ZH = /(摔|拍桌|怒吼|吼道|甩(?:门|手|下|在|出|给)|夺门|冲(?:进|出|到|向|着)|跪(?:在|下)|扑通|一巴掌|撕(?:碎|了)|泼(?:了|在)?|撞(?:倒|在|开|见)|抓(?:住|起)|拽(?:住)?|拦(?:住|在)|堵(?:在|住)|威胁|质问|争吵|吵架|翻脸|摊牌|拒(?:绝|了)|答(?:应|了)|决(?:定|心)|宣布|提出(?:离婚|分手|退婚|辞职|解约)|离婚|分手|退婚|签字|辞职|开除|退学|破产|收购|逮(?:捕|了)|警察|报警|起诉|证据|录音|录像|合同|亲子鉴定|遗嘱|遗产|真相|原来|发现|得知|获悉|查出|误会|表白|告白|求婚|亲吻|吻(?:了|住|上)|抱(?:住|紧)|怀(?:孕|上)|失忆|车祸|绝症|绑架|救人|翻盘|反转|震惊|全场(?:哗然|震惊)|热搜|曝光|拉黑|挂(?:断)?电话|转身就走|扭头就走|泪崩|崩溃|大哭|冷笑|羞辱|发誓|复仇|报仇|陷害|栽赃|揭穿|戳穿|掏(?:出)|命令|下令|解雇|逐出|赶(?:出|走)|断绝关系|改姓)/g;
// 空转信号：寒暄 / 日常起居 / 吃喝天气 / 客套闲聊
const FILLER_ZH = /(你好|早上好|早啊|早安|晚上好|晚安|再见|慢走|欢迎光临|请慢用|今天天气|天气(?:真|不错|很好|挺好)|阳光(?:明媚|真好)|下(?:着)?雨|风(?:真)?好大|吃(?:饭|早餐|晚饭|午饭|了吗|点东西)|多吃点|再来一碗|喝汤|夹菜|喝(?:杯|点)?(?:水|茶|咖啡)|喝茶|喝咖啡|起床|闹钟|洗漱|刷牙|洗脸|伸(?:了个)?懒腰|打(?:了个)?哈欠|发呆|无聊|闲(?:聊|着没事)|聊(?:聊)?天|随便聊聊|逛(?:了逛|街)|散(?:了个)?步|看电视|玩手机|刷手机|最近怎么样|好久不见|有空(?:吗|再聚)|改天(?:再|请)|吃了吗|随便坐|别客气|不客气|味道(?:真)?不错|这(?:茶|菜|咖啡)不错)/g;
// 复述注水：前情提要 / 换种说法重复已知信息
const RECAP_ZH = /(前情提要|上集说到|上一集说到|上回说到|书接上回|还记得吗|你还记不记得|记不记得|我不是(?:已经)?(?:告诉|跟你说)过|我之前(?:就)?(?:跟你)?说过|跟你说过多少遍|再说(?:一|最后)遍|重复(?:了)?一遍|也就是说|换句话说|简单(?:来)?说|总而言之|话说回来|如前所述)/g;
// 闪回信号
const FLASHBACK_ZH = /(闪回|回忆(?:涌上|起|片段|里|中)|想起(?:当年|那天|以前)|那一年|那一天|曾几何时|记忆(?:深处|里|中)|往事(?:一幕幕)?)/g;
// 闪回带新信息：闪回本身不注水，重复抒情的闪回才注水
const NEWINFO_ZH = /(真相|原来|其实|实际(?:上)?|发现|得知|查出|调查(?:发现|结果)?|证据|病历|鉴定|录音|遗嘱|秘密|隐瞒|骗了|身世)/g;
// 结尾拖堂
const TAIL_ZH = /(从(?:那)?此(?:以后|他们|，|,)?|故事(?:到这里)?(?:结束|告一段落|完)|回归(?:了)?平静|岁月静好|日子(?:一天天|渐渐|就这么)|生活(?:又|重|逐渐)?回?(?:归|到)?正轨|一切(?:都)?(?:恢复|回到)(?:了)?平静|阳光(?:依旧|洒(?:在|进))|多年以后|多年后|后来的后来|尾声|全剧终|大结局|幸福(?:美满)?地(?:生活|过)|各自(?:开始)?(?:了)?新的生活|时间(?:就这)?样(?:过去|流逝))/g;

// —— 英文信号库 ——
const PROGRESS_EN = /(slammed|shouted|yelled|snatched|grabbed|stormed (?:out|in|into)|marched (?:out|in|toward)|kicked|punched|slapped|shoved|threatened|confronted|accused|divorce|break up|broke up|fired(?: him| her)?|sued|arrested|police|handcuffed|evidence|recording|contract|dna test|will|inheritance|truth|turned out|discovered|found out|learned|realized|revealed|exposed|confessed|proposed|kissed|hugged (?:him|her)|pregnant|amnesia|car crash|kidnapped|rescued|revenge|framed|betrayed|humiliated|knelt|hung up|blocked (?:him|her)|burst into tears|sneered|ordered|evicted|disowned|lawsuit|bankrupt|acquisition|went viral|sealed the deal|signed the papers)/gi;
const FILLER_EN = /(good morning|good evening|good night|hello there|see you|take care|welcome to|how have you been|how's it going|long time no see|nice weather|lovely weather|the weather (?:is|was)|bright sunlight|it was raining|had (?:breakfast|lunch|dinner)|have a bite|eat up|more (?:tea|coffee|soup)|poured (?:tea|coffee|water)|a cup of (?:tea|coffee)|sipped (?:her|his|the) (?:tea|coffee)|woke up|alarm clock|washed (?:her|his) face|brushed (?:her|his) teeth|stretched|yawned|stared blankly|bored|small talk|chitchat|strolled|took a walk|watching tv|scrolled through (?:her|his) phone|take a seat|make yourself at home|how's work|another time|no rush|tastes (?:good|amazing|delicious)|this (?:tea|coffee|soup) is)/gi;
const RECAP_EN = /(previously on|last (?:episode|time on)|recap|remember when|do you remember|like i told you|i already told you|told you (?:before|already)|let me repeat|say it again|in other words|to put it simply|in summary|to sum up|as mentioned before)/gi;
const FLASHBACK_EN = /(flashback|flash back|he remembered|she remembered|memories (?:of|flooded)|memory of|that day|years earlier|years ago|in (?:his|her) memory|thought back to)/gi;
const NEWINFO_EN = /(truth|turned out|in fact|actually|discovered|found out|learned|evidence|medical record|test result|secret|hidden|lied to|real identity|revealed)/gi;
const TAIL_EN = /(from that day on|lived happily ever after|the end|the story ends?|epilogue|life returned to normal|finally at peace|all was well|went back to (?:their|normal)|years later|in the years that followed|time (?:slowly )?passed|moved on with (?:their|her|his) lives|sunlight streamed|everything went back to the way it was)/gi;

function count(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.test(text)) {
    n++;
    if (re.lastIndex === 0) re.lastIndex++;
  }
  return n;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));


function splitScenes(text: string, lang: PaddingLang): { header: string; body: string }[] {
  const isHeader = (line: string) => {
    const t = line.trim();
    if (!t) return false;
    return isSceneHeaderLine(t, lang); // c213：收口共享切分器
  };
  const scenes: { header: string; body: string }[] = [];
  let cur: { header: string; body: string } | null = null;
  for (const line of text.split('\n')) {
    if (isHeader(line)) {
      if (cur) scenes.push(cur);
      cur = { header: line.trim(), body: '' };
    } else if (cur) {
      cur.body += line + '\n';
    }
  }
  if (cur) scenes.push(cur);
  return scenes;
}

/**
 * v2.132 场景注水/空转检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function scenePaddingCheck(text: string, lang: PaddingLang): ScenePaddingResult {
  const empty: ScenePaddingResult = {
    score: 100,
    sceneCount: 0,
    deadSceneCount: 0,
    recapCount: 0,
    flashbackCount: 0,
    newInfoCount: 0,
    fillerCount: 0,
    slowOpen: false,
    draggyTail: false,
    deadScenes: [],
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const PROGRESS = isZh ? PROGRESS_ZH : PROGRESS_EN;
  const FILLER = isZh ? FILLER_ZH : FILLER_EN;
  const RECAP = isZh ? RECAP_ZH : RECAP_EN;
  const FLASHBACK = isZh ? FLASHBACK_ZH : FLASHBACK_EN;
  const NEWINFO = isZh ? NEWINFO_ZH : NEWINFO_EN;
  const TAIL = isZh ? TAIL_ZH : TAIL_EN;
  // 死场正文最短长度：过滤纯转场短行
  const DEAD_MIN = isZh ? 40 : 30;

  const fillerCount = count(text, FILLER);
  const recapCount = count(text, RECAP);
  const flashbackCount = count(text, FLASHBACK);
  const newInfoCount = count(text, NEWINFO);

  const scenes = splitScenes(text, lang);

  // 1) 开场复述：前 5% 内出现"前情提要/上集说到/previously on"即算
  const headSeg = text.slice(0, Math.max(50, Math.floor(text.length * 0.05)));
  const frontRecap = isZh
    ? /(前情提要|上集说到|上一集说到|上回说到|书接上回)/.test(headSeg)
    : /(previously on|last (?:episode|time on))/i.test(headSeg);
  const recapDump = recapCount >= 2 || frontRecap;

  // 2) 闪回注水：多次闪回却零新信息
  const redundantFlashback = flashbackCount >= 2 && newInfoCount === 0;

  // 3) 寒暄开场：开场 15% 零推进 + ≥3 个日常空转信号
  const openSeg = text.slice(0, Math.floor(text.length * 0.15));
  const slowOpen = count(openSeg, PROGRESS) === 0 && count(openSeg, FILLER) >= 3;

  // 4) 三无场景：逐场体检（开场空转归 slow_open 管，首场不重复记账）
  const deadScenes: string[] = [];
  scenes.forEach((s, idx) => {
    if (idx === 0 && slowOpen) return;
    const body = s.body.trim();
    if (body.length < DEAD_MIN) return;
    if (count(body, PROGRESS) === 0 && count(body, FILLER) >= 2) {
      deadScenes.push(body.replace(/\s+/g, ' ').slice(0, 30));
    }
  });
  const deadSceneCount = deadScenes.length;

  // 5) 结尾拖堂：末段 15% 零推进 + ≥2 个收尾套路
  const tailSeg = text.slice(Math.floor(text.length * 0.85));
  const draggyTail = count(tailSeg, PROGRESS) === 0 && count(tailSeg, TAIL) >= 2;

  const issues: PaddingIssue[] = [];
  let penalty = 0;

  if (deadSceneCount >= 1) {
    penalty += Math.min(18 + (deadSceneCount - 1) * 6, 30);
    issues.push({
      severity: 'high',
      type: 'dead_scene',
      evidence: isZh
        ? `${deadSceneCount} 个"三无场景"（无冲突/无新信息/无关系变化），如：${deadScenes[0]}…`
        : `${deadSceneCount} dead scene(s) with no conflict/new info/relationship change, e.g.: "${deadScenes[0]}…"`,
      advice: isZh
        ? '一场戏必须至少交付一样东西：推动剧情的动作、观众不知道的新信息、或两人关系的变化。三样全无的寒暄日常直接删掉，或给它埋一颗雷——茶杯还没放下，一句话先炸了。过场信息用一个镜头/一句台词带过，不要成场。'
        : 'Every scene must deliver at least one: a plot-moving action, new information, or a relationship change. If it delivers none, cut the small talk — or plant a bomb in it: one line detonates before the teacup lands. Transition material gets one shot or one line, never a full scene.',
    });
  }

  if (recapDump) {
    penalty += 12;
    issues.push({
      severity: 'mid',
      type: 'recap_dump',
      evidence: isZh
        ? `${recapCount} 处复述/总结话术${frontRecap ? '，开场即前情提要' : ''}`
        : `${recapCount} recap/summary phrase(s)${frontRecap ? ', opening with a "previously on" recap' : ''}`,
      advice: isZh
        ? '观众没忘，别替他们复习。必须补的前情用"带新信息的冲突"给出来——人物因为旧信息当场吵起来、拿出旧证据反杀，而不是坐下来"也就是说/换句话说"。前情提要压进字幕或首句钩子，10 秒内必须进入新事。'
        : 'The audience hasn\'t forgotten — don\'t study for them. Deliver essential backstory through conflict-with-new-info: a fight over the old fact, old evidence used as a countermove — never characters sitting down to explain "in other words". Bury the recap in a caption or the opening hook, then get to new business within 10 seconds.',
    });
  }

  if (redundantFlashback) {
    penalty += 8;
    issues.push({
      severity: 'low',
      type: 'redundant_flashback',
      evidence: isZh
        ? `${flashbackCount} 处闪回，0 处新信息揭晓`
        : `${flashbackCount} flashback(s), 0 new-reveal cues`,
      advice: isZh
        ? '闪回是信息武器，不是情绪复读机。每次闪回必须让观众知道一件此前不知道的事（真凶/谎言/动机），或推翻对当下的理解。只是把受伤的夜晚再放一遍的闪回，删。'
        : 'A flashback is an information weapon, not an emotion replay. Each one must reveal something previously unknown (the real culprit, the lie, the motive) or overturn the reading of the present. A flashback that merely re-airs the painful night gets cut.',
    });
  }

  if (slowOpen) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'slow_open',
      evidence: isZh
        ? `开场 15% 内 0 个推进信号，全是起床/天气/寒暄`
        : `Zero progress cues in the first 15% — waking/weather/small talk only`,
      advice: isZh
        ? '竖屏剧前 3 秒定生死，主角起床刷牙观众已经划走。把冲突提到第一句：一个耳光、一纸退婚、一条病危通知。日常背景全部后移到冲突缝隙里，用动作顺带交代。'
        : 'Vertical drama lives or dies in the first 3 seconds — viewers swipe past the wake-up routine. Open on the collision: a slap, divorce papers, a terminal diagnosis. Move all establishing routine later, smuggled in between beats.',
    });
  }

  if (draggyTail) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'draggy_tail',
      evidence: isZh
        ? `末段 15% 零推进，"从此/回归平静/岁月静好"式收尾`
        : `Zero progress in the final 15% — "from that day on/life returned to normal" coda`,
      advice: isZh
        ? '爽完之后别让观众坐着等片尾曲。矛盾一解决立刻上集尾钩子：新的威胁、被藏起来的证据、一句反转台词。"从此他们幸福地生活"是短剧大忌——观众要的是"下一集怎么办"。'
        : 'Don\'t make viewers sit through the credits after the payoff. The instant the conflict resolves, drop the cliffhanger: a new threat, hidden evidence, one reversal line. "They lived happily ever after" kills vertical drama — the audience wants "what happens next?".',
    });
  }

  return {
    score: clamp(100 - penalty),
    sceneCount: scenes.length,
    deadSceneCount,
    recapCount,
    flashbackCount,
    newInfoCount,
    fillerCount,
    slowOpen,
    draggyTail,
    deadScenes,
    issues,
  };
}
