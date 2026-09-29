/**
 * v2.144 闪回与梦境幻觉结构公平性检测（PRD 2.1.41——记忆是叙事工具，不是诈骗工具）
 * ------------------------------------------------------------------
 * 竖屏短剧大量使用"梦醒反转/回忆杀/脑补画面"：合法用法情绪浓度极高，滥用则是诈骗观众——
 * 演了半集死亡/背叛/告白，结尾"她猛地从梦中惊醒，原来是一场梦"，且入梦零标记；
 * 把幻想当真实事件演，角色不回神、叙事不收束，观众分不清真假；
 * 同一段车祸/葬礼记忆反复闪回三四次却从不补充新信息（硬凑时长）。
 * 本引擎专管**梦境/幻觉/闪回段落的进入标记、收束标记与信息增量**，不设题材门控
 * （梦与回忆是所有题材的通用手法，无相关信号即满分放行）。
 *
 * 分工（近邻引擎边界）：
 *  - craft-lint：把"陷入了回忆""旁白"当小说腔词汇单点禁用（管词不管结构）
 *  - genre-compensate：把短心声/短画外音点情趣当正信号（本引擎不判画外音，只判幻想段是否收束）
 *  - timeline-consistency(v2.138)：前进式时间跳跃/期限倒计时（不管倒退式回忆段）
 *  - scene-padding(v2.135)：通用注水/重复（本引擎只管闪回段的无信息重复）
 *  - relationship-progression / arc-tracker：情绪转折价格（不管记忆手法本身）
 *  - v2.144（本引擎）：梦醒假反转、幻觉当真实、闪回堆砌、同一记忆无新信息重复闪回
 *
 * 四类问题：
 *  1) dream_fakeout        无入梦标记的梦醒假反转：WAKE 行之前 8 行内无 DREAM_ENTER，
 *                                     且前 10 行窗口内演了强戏剧事件（死亡/血/刀枪/亲吻/
 *                                     告白/离婚协议/遗嘱等）→ 1 次 mid，第 2 次 high
 *  2) hallucination_unbound 想象/脑补段无"回到现实"收束，且幻想内容含强戏剧动作
 *                                     → 1 次 low，第 2 次起 mid（push 上限 2）
 *  3) flashback_overuse    闪回段（间隔 ≤3 行的标记合并为一段）≥4 处 low、≥6 处 mid，全文 1 条
 *  4) flashback_repeat     同一记忆事件（车祸/葬礼/大火/离婚等词根指纹）闪回 ≥2 次，
 *                                     第 2+ 次窗口内无新信息词（真相/原来/这才知道/realized…）
 *                                     → mid，每种记忆报 1 条，全文 ≤2 条
 *
 * 正信号：markedDream（入梦+梦醒成对）+2/次 cap4；fairRecall（重复闪回带新信息）+2/次 cap4；
 *         boundedFlash（闪回段有明确"回到现实/back in the present"收束）+1/次 cap3。
 */

import { isSceneHeaderLine } from './script-scenes';

export type MfLang = 'zh' | 'en';

export interface MemoryFakeoutIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'dream_fakeout'
    | 'hallucination_unbound'
    | 'flashback_overuse'
    | 'flashback_repeat';
  evidence: string;
  advice: string;
  scene: number;
  key: string;
}

export interface MemoryFakeoutSceneReport {
  index: number;
  header: string;
  flagCount: number;
}

export interface MemoryFakeoutResult {
  score: number;
  sceneCount: number;
  signalCount: number;
  issueCount: number;
  /** 入梦标记行数（睡着/昏迷/梦中/fell asleep…） */
  dreamEnterCount: number;
  /** 梦醒收束行数（惊醒/原来是一场梦/woke gasping…） */
  wakeCount: number;
  /** 入梦+梦醒成对的次数（正信号） */
  markedDreamCount: number;
  /** 无标记假反转次数（=问题①实际发生数，非 push 数） */
  fakeoutCount: number;
  /** 想象/脑补标记行数 */
  imagineCount: number;
  /** 幻觉无收束次数（=问题②实际发生数） */
  hallucinationCount: number;
  /** 闪回段数量（相邻标记已合并） */
  flashbackCount: number;
  /** 闪回收束标记行数 */
  flashExitCount: number;
  /** 被判"重复无新信息"的记忆词根种数 */
  repeatedMemoryKinds: number;
  /** 带新信息的重复闪回次数（正信号） */
  fairRecallCount: number;
  /** 有明确收束的闪回段数量（正信号） */
  boundedFlashCount: number;
  scenes: MemoryFakeoutSceneReport[];
  issues: MemoryFakeoutIssue[];
}

// c213：场头判定统一走 engine/script-scenes.ts 单一事实源（历史缺陷与
// emotional-aftermath 同款：漏 AIGC「内景/外景」、英文漏 INT./EXT.）。

/** 入梦标记：入睡/昏迷/失去意识/正在梦中 */
const DREAM_ENTER_ZH = /(?:沉沉|渐渐|慢慢|迷迷糊糊|昏昏沉沉)?(?:睡(?:着|了|去|过去|入)|入睡|入眠|沉睡|昏睡|酣睡|犯困打盹)|(?:晕|昏)(?:了)?(?:过去|倒|厥|迷|睡)|失去意识|意识(?:渐渐|开始|逐渐)?模糊|陷入(?:昏迷|昏睡|黑暗|沉睡|梦乡)|进入(?:了)?(?:梦乡|梦境)|(?:在|进入)?(?:了)?(?:梦里|梦中|梦境里)(?!(?:惊醒|醒来|醒转|尖叫|抽气|坐起|坐直))|做梦|梦见/;
/** 梦醒收束：必须带梦词汇，防止"虚惊一场"式现实误判 */
const WAKE_ZH = /(?:猛地|猛然|突然|骤然|一下子|忽地)?(?:从)?(?:梦|噩梦|睡梦|梦境)(?:中|里)?(?:惊醒|醒来|醒转|抽气|尖叫(?:着)?醒|坐起|坐直)|(?:醒|惊)(?:来|醒)(?:才|后)?发现(?:是|原来只是?)(?:一)?场梦|原来(?:只是?|不过是|竟然是)?(?:一)?场梦|不过(?:是)?一场噩梦|只是(?:一)?场梦而已|(?:猛地|陡然|惊得)坐(?:直|了?起来)[^。；\n]{0,10}?(?:冷汗|喘息|梦)/;
/** 想象/脑补标记 */
const IMAGINE_ZH = /脑补|(?:在)?脑海里?(?:想象|演练|模拟|设想)|脑(?:海|子)里幻想|想象(?:着|了|一下|出|中|的画面|的场景)|幻想着?|(?:要是|如果|假如)[^。；\n]{0,24}?(?:就好了|该多好)|(?:多)?希望(?:时间|这一刻)(?:能)?(?:停|倒回|重来|停留)/;
/** 回到现实收束 */
const RETURN_ZH = /(?:猛地|突然|骤然)?(?:回过神|回神|回过神来|神思归位|回过味儿)|(?:摇|揉)(?:了摇|着)?(?:头|眉心|太阳穴)[^。；\n]{0,10}?(?:甩开|驱散|打断|清空|摆脱|拉回|回神)|思绪(?:被)?(?:猛地)?(?:拉|拽|打|扯)回(?:现实|眼前|当下)?|(?:眨|揉)(?:了眨|着)?(?:眼|眼睛)[^。；\n]{0,10}?(?:发现|原来|自己还|依旧|仍在)|(?:咬|抿)(?:了咬|着)?(?:唇|嘴)[^。；\n]{0,8}?(?:清醒|回神)|回到(?:了)?现实|眼前(?:的)?(?:一切|场景)(?:依旧|没变)|原来是自己想多了|想什么呢/;
/** 闪回进入标记（裸"那一天"必须挂画面/记忆/回忆词，防止误伤正常叙事） */
const FLASH_ZH = /(?:画面|镜头|思绪|记忆)(?:一?转|一切|回|飘|飞)(?:到|回|向)?[^。；\n]{0,12}?(?:那年|当年|多年前|小时候|过去|从前)|闪回|回忆(?:片段|画面|涌(?:现|上|起)|袭来|开始|杀|不断|又起|被拉回)|陷入(?:了)?回忆|回忆(?:起|涌|的画面|里|到)|脑海(?:里|中)(?:浮现|闪过|响起|全是|回放)|记忆(?:深处|里|的画面|翻涌|涌上|涌现|如潮水)|尘封(?:的)?(?:往事|记忆)|往事(?:涌上(?:心头)?|浮现|历历在目)|思绪(?:飘|飞)回|想(?:起|到)(?:了)?(?:当年|那年|小时候|从前|过去的)|那(?:一)?(?:年|天|夜|刻)的?(?:画面|记忆|场景|一幕)|记忆(?:把|将)(?:她|他|他的|她的)?(?:拉|带|拽)回(?:到)?那(?:一)?(?:年|天|夜|刻)|(?:多年|数载|\d+\s*年)前(?:的)?(?:画面|往事|一幕|场景)/;
/** 闪回收束标记 */
const FLASH_EXIT_ZH = /(?:画面|镜头|思绪)(?:一?转|切回|拉回|回到)(?:现实|现在|眼前)|回到(?:了)?现实|思绪归位|而现在|眼下|现实(?:中|里)|(?:如今|现在)的(?:她|他|自己)/;
/** 新信息词：重复闪回若补充真相/细节即豁免 */
const NEW_INFO_ZH = /原来|真相|(?:这|此刻?)(?:才)?(?:知道|明白|看清|发现|意识到|懂了|注意到)|后来才(?:知道|明白|发现|看清)|(?:新的|关键|一个)?细节|秘密|实情|隐情|当年(?:她|他|自己)?(?:并不|根本没|从未|不知道|没看到|没看清)|第一次知道|没(?:人)?告诉过她|尘封的真相|这一(?:次|回)(?:她)?(?:终于)?(?:看清|发现|知道)/;
/** 强戏剧事件：假反转/幻觉必须"演了大事"才报 */
const DRAMATIC_ZH = /(?:死(?:了|亡|去|在|不瞑目)|咽气|断气|毙命|没了呼吸|气绝)|(?:鲜)?血(?:染|溅|泊|直流|模糊|糊了|涌)|中(?:枪|刀|弹)|(?:被|挨|遭)?(?:刺|捅|砍|劈|射|枪)(?:了|中|向|进|穿)[^。；\n]{0,6}|坠(?:楼|崖|下|落)|跳(?:楼|崖|江)|车(?:祸|猛地撞|直直撞)|(?:绑|捆)(?:架|了|在)?|撕票|(?:狠狠?)?(?:甩|扇|打)(?:了)?(?:她|他|我)?一?巴掌|(?:低头|俯身|主动)?(?:吻|亲)(?:了|上|住|下去|在|到)|(?:紧|深|搂|拥)?(?:拥抱|抱(?:住|紧|入怀|了抱))|(?:当场|当众|深情)?(?:表白|告白)|(?:我愿意|嫁给我|娶你|我们结婚)|婚礼(?:现场|进行曲|当天)?|(?:签(?:下|了|署)?|撕(?:碎|了)?)[^。；\n]{0,4}?(?:离婚协议|休书)|遗嘱|遗产|亲子鉴定|(?:双膝)?跪下|断绝(?:关系|父女|母女|亲缘)/;

const DREAM_ENTER_EN = /\b(?:fell|drifted|slipped) (?:into |fast |deep )?(?:sleep|asleep|a deep sleep)|(?:was|fast|deep|sound) asleep|lost consciousness|(?:slowly )?(?:passed|blacked) out|darkness (?:took|closed in|swallowed)|(?:in|into) (?:a |the |her |his )?(?:vivid )?dream|began to dream|(?:in|inside) (?:her|his) dream|dreamed (?:of|about|that)|(?:the )?nightmare (?:began|started)\b/i;
const WAKE_EN = /\b(?:woke|wakened|awoke) (?:up )?(?:gasping|with a start|screaming|in a cold sweat|bathed in sweat|from (?:the )?(?:dream|nightmare))|(?:it|this|everything) was (?:only|all|just) a dream|(?:realized|knew) it had (?:only )?been a dream|just a nightmare|sat bolt upright[^.]{0,18}?(?:sweat|gasping|dream)\b/i;
const IMAGINE_EN = /\b(?:imagined|imagining|fantasized|fantasizing|pictured (?:it|herself|himself|that|the scene|them)|in (?:her|his) mind'?s eye|(?:she|he) could almost (?:see|hear|picture|feel))|if only[^.]{0,30}|wished (?:that )?(?:she|he|time|this moment) could\b/i;
const RETURN_EN = /\b(?:snapped|jerked|came) back to reality|shook (?:her|his) head (?:to clear|and (?:tried|forced) (?:to )?(?:focus|think))|brought (?:her|him) (?:back|crashing back)|back in the present|blinked (?:hard )?(?:and|to find)|(?:forced|pulled) (?:herself|himself) back (?:to|from)|realized (?:she|he) was (?:still|just) (?:sitting|standing|alone|there)\b/i;
const FLASH_EN = /\bflashback|the memory (?:of[^.]{0,30})?(?:surfaced|came|flooded|rushed|played)|memories (?:surfaced|flooded|rushed|came flooding)|(?:she|he) (?:suddenly|vividly)? ?remembered (?:the|that) day|(?:her|his) mind (?:went|drifted|traveled|flew) back|(?:think|thought) back to (?:that|the) day|the (?:image|scene) from (?:years ago|that day)|(?:years|months) earlier[^.]{0,18}?(?:memory|image|scene)|(?:old|buried) memories (?:of|rose)\b/i;
const FLASH_EXIT_EN = /\bback in the present|returned to the present|(?:the )?present day|(?:snapped|came) back (?:to the present|to reality)|now,? back (?:in|at)\b/i;
const NEW_INFO_EN = /\b(?:the truth|it turned out|turned out (?:that )?|(?:she|he) realized (?:that )?|only now (?:did )?(?:she|he) (?:know|realize|understand|see)|for the first time (?:she|he) (?:knew|understood|saw)|new detail|a detail (?:she|he) had (?:never|always) missed|had never known|discovered (?:that )?|hidden (?:truth|secret)|the real reason)\b/i;
const DRAMATIC_EN = /\b(?:died|was dead|slumped (?:lifeless|motionless)|blood (?:pooled|splattered|soaked|gushed)|(?:stabbed|shot|gunned down|slit (?:her|his) throat)|(?:fell|plunged) (?:off|from) (?:the )?(?:roof|cliff|building|rooftop)|car (?:crash|accident)|kidnapped|(?:slapped|struck) (?:her|him) across the face|(?:kissed|kiss) (?:her|him)(?:[^.]{0,12}?(?:deeply|hard|on the lips))?|(?:hugged|embraced) (?:her|him) (?:tight|firmly)|confessed (?:her|his)? ?love|marry me|I do|wedding (?:march|ceremony)|(?:signed|tore) (?:the )?divorce papers|divorce papers|(?:the )?will[^.]{0,8}(?:reading|revealed)?|paternity (?:test|results)|knelt (?:down)?|disowned)\b/i;

/** 记忆事件词根指纹（取窗口内首个命中） */
const ROOT_TABLE_ZH: Array<[string, RegExp]> = [
  ['car_crash', /车祸|撞车|被车撞|货车(?:冲|撞)/],
  ['funeral', /葬礼|灵堂|遗像|殡仪馆|黑白照片/],
  ['fire', /大火|火灾|烧死|火场|熊熊(?:燃|烈)火|烈焰|浓烟/],
  ['hospital', /手术室|抢救室|病危通知|病床|医院走廊|氧气罩|ICU|监护仪/],
  ['miscarriage', /流产|孩子没(?:了|保住)|打掉孩子|胎儿/],
  ['rooftop', /跳楼|天台(?:上)?(?:跳下|纵身)|坠楼/],
  ['divorce', /离婚协议|离婚证|签字离婚|民政局离婚/],
  ['betrayal', /背叛|出轨|捉奸在床|和别的(?:女人|男人)在床上|偷情/],
  ['will', /遗嘱|遗产(?:争夺)?|继承权/],
  ['paternity', /亲子鉴定|鉴定报告|血缘(?:报告)?/],
  ['rain', /(?:大|暴)?(?:雨|滂沱)|倾盆大雨|淋着?雨|雨夜/],
  ['slap', /巴掌|耳光/],
  ['kidnap', /绑架|被绑(?:在|架)|绳索(?:捆|绑)/],
  ['wedding', /婚礼|婚纱|拜堂|交换戒指/],
];

const ROOT_TABLE_EN: Array<[string, RegExp]> = [
  ['car_crash', /\bcar (?:crash|accident)|truck (?:slammed|crashed)|hit by a (?:car|truck)\b/i],
  ['funeral', /\bfuneral|casket|coffin|memorial service|black-and-white portrait\b/i],
  ['fire', /\b(?:the )?fire|flames|burned alive|blaze|thick smoke\b/i],
  ['hospital', /\b(?:operating room|ER|emergency room|hospital bed|ICU|heart monitor|oxygen mask)\b/i],
  ['miscarriage', /\bmiscarriag|lost the baby|baby didn'?t make it\b/i],
  ['rooftop', /\bjumped (?:off )?(?:the )?roof|rooftop (?:ledge|jump)|plunged from the (?:roof|building)\b/i],
  ['divorce', /\bdivorce papers|signed the divorce|divorce certificate\b/i],
  ['betrayal', /\bbetray(?:al|ed)|affair|cheated (?:on|with)|in bed with another\b/i],
  ['will', /\bthe (?:last )?will|inheritance|reading of the will\b/i],
  ['paternity', /\bpaternity (?:test|results)|DNA (?:test|report)\b/i],
  ['rain', /\b(?:heavy|pouring|torrential) rain|rain-soaked|rainy night|downpour\b/i],
  ['slap', /\bslap(?:ped)? across the face|struck (?:her|him) across\b/i],
  ['kidnap', /\bkidnapp|tied (?:up|to)|bound (?:with|to) (?:a )?rope|taken hostage\b/i],
  ['wedding', /\bwedding (?:ceremony|march|day)|wedding dress|exchange(?:d)? rings|vows\b/i],
];

interface LineRow {
  line: number;
  scene: number;
  text: string;
}

interface Hit {
  line: number;
  scene: number;
  text: string;
}

interface FlashSegment {
  start: number;
  scene: number;
  text: string;
  root: string | null;
  hasExit: boolean;
  hasNewInfo: boolean;
}

export function memoryFakeoutCheck(text: string, lang: MfLang = 'zh'): MemoryFakeoutResult {
  const isZh = lang === 'zh';
  const DREAM_ENTER = isZh ? DREAM_ENTER_ZH : DREAM_ENTER_EN;
  const WAKE = isZh ? WAKE_ZH : WAKE_EN;
  const IMAGINE = isZh ? IMAGINE_ZH : IMAGINE_EN;
  const RETURN = isZh ? RETURN_ZH : RETURN_EN;
  const FLASH = isZh ? FLASH_ZH : FLASH_EN;
  const FLASH_EXIT = isZh ? FLASH_EXIT_ZH : FLASH_EXIT_EN;
  const NEW_INFO = isZh ? NEW_INFO_ZH : NEW_INFO_EN;
  const DRAMATIC = isZh ? DRAMATIC_ZH : DRAMATIC_EN;
  const ROOT_TABLE = isZh ? ROOT_TABLE_ZH : ROOT_TABLE_EN;

  const clean = (text ?? '').replace(/\r\n?/g, '\n');
  if (!clean.trim() || clean.trim().length < 20) {
    return {
      score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
      dreamEnterCount: 0, wakeCount: 0, markedDreamCount: 0, fakeoutCount: 0,
      imagineCount: 0, hallucinationCount: 0, flashbackCount: 0, flashExitCount: 0,
      repeatedMemoryKinds: 0, fairRecallCount: 0, boundedFlashCount: 0,
      scenes: [], issues: [],
    };
  }

  // ---------- 切场 ----------
  const rawLines = clean.split('\n');
  const scenes: Array<{ index: number; header: string; flagCount: number }> = [];
  const all: LineRow[] = [];
  let curScene = 0;
  let curHeader = '';
  const ensureScene = (header: string) => {
    curScene += 1;
    curHeader = header.trim().slice(0, 24) || `S${curScene}`;
    scenes.push({ index: curScene, header: curHeader, flagCount: 0 });
  };
  let headerSeen = false;
  rawLines.forEach((raw) => {
    const t = raw.trim();
    if (isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      ensureScene(t);
      headerSeen = true;
      return;
    }
    if (!headerSeen && all.length === 0) {
      ensureScene(isZh ? '开场' : 'Opening');
      headerSeen = true;
    }
    if (t) all.push({ line: all.length + 1, scene: curScene, text: t });
  });
  if (scenes.length === 0) ensureScene(isZh ? '开场' : 'Opening');

  const linesInScene = (scene: number, from: number, to: number) =>
    all.filter((r) => r.scene === scene && r.line >= from && r.line <= to);
  /** 跨场全局行窗口（梦可以在一场演、在下一场醒） */
  const linesBetween = (from: number, to: number) =>
    all.filter((r) => r.line >= from && r.line <= to);

  // ---------- 收集标记行 ----------
  const enterHits: Hit[] = [];
  const wakeHits: Hit[] = [];
  const imagineHits: Hit[] = [];
  const returnHits: Hit[] = [];
  const flashHits: Hit[] = [];
  const flashExitHits: Hit[] = [];
  let signalCount = 0;
  const mark = (arr: Hit[], r: LineRow) => {
    arr.push({ line: r.line, scene: r.scene, text: r.text });
    signalCount += 1;
  };
  all.forEach((r) => {
    if (DREAM_ENTER.test(r.text)) mark(enterHits, r);
    if (WAKE.test(r.text)) mark(wakeHits, r);
    if (IMAGINE.test(r.text)) mark(imagineHits, r);
    if (RETURN.test(r.text)) mark(returnHits, r);
    if (FLASH.test(r.text)) mark(flashHits, r);
    if (FLASH_EXIT.test(r.text)) mark(flashExitHits, r);
  });

  const issues: MemoryFakeoutIssue[] = [];
  const ev = (r: { text: string }, scene: number) =>
    isZh ? `第${scene}场：${r.text.slice(0, 34)}` : `Scene ${scene}: ${r.text.slice(0, 60)}`;

  const adviceMap = {
    fakeout: {
      zh: '假反转：观众已经当真的重大事件（死亡/背叛/告白）必须在发生前给出入梦标记（睡着/昏迷/意识模糊/镜头入梦境），或让梦醒承接真实后果。无标记"原来是一场梦"是诈骗观众。',
      en: 'Fake-out: major events (death/betrayal/confession) need a dream-entry cue (falling asleep/losing consciousness/a dream transition) before they play, or real consequences after waking. An unmarked "it was all a dream" cheats the audience.',
    },
    hallucination: {
      zh: '幻想段无收束：脑补/想象的画面演了戏剧动作，却没有"回过神/摇摇头甩开念头/回到现实"的落点，真假边界不清。补一个回神动作，或用字幕/音效明确区分想象与现实。',
      en: 'Unbound fantasy: an imagined scene plays out a dramatic action with no return-to-reality beat (snapping back/shaking her head/blinking). Add a grounding beat or mark the fantasy with subtitle/sound design so the audience can tell.',
    },
    overuse: {
      zh: '闪回堆砌：本集闪回段过多且信息密度低，是典型凑时长。同一集回忆控制在 3 段以内，每段必须承担新信息或情绪递进，能用当下动作交代就不要闪回。',
      en: 'Flashback overload: too many flashback segments with low information density reads as padding. Cap flashbacks at 3 per episode; each must deliver new information or emotional escalation; prefer present-tense action.',
    },
    repeat: {
      zh: '重复闪回无新信息：同一记忆事件再次出现却没有补充任何新细节/新视角（观众已知的信息不再有价值）。第二次闪回必须揭示真相、补入当年缺失的细节或换一个当事人的视角。',
      en: 'Repeated memory with no new information: the same memory returns without new detail or perspective. A repeat flashback must reveal a truth, a missing detail from that moment, or another witness\'s point of view.',
    },
  };

  // ---------- ① 梦醒假反转 ----------
  let markedDreamCount = 0;
  let fakeoutCount = 0;
  wakeHits.forEach((w) => {
    const priorEnter = linesBetween(w.line - 8, w.line - 1).some((r) => DREAM_ENTER.test(r.text));
    if (priorEnter) {
      markedDreamCount += 1;
      return;
    }
    const playedBig = linesBetween(w.line - 10, w.line - 1).some((r) => DRAMATIC.test(r.text));
    if (playedBig) {
      fakeoutCount += 1;
      if (fakeoutCount <= 2) {
        issues.push({
          severity: fakeoutCount >= 2 ? 'high' : 'mid',
          type: 'dream_fakeout',
          evidence: ev(w, w.scene),
          advice: isZh ? adviceMap.fakeout.zh : adviceMap.fakeout.en,
          scene: w.scene,
          key: `fakeout_s${w.scene}_${w.line}`,
        });
      }
    }
  });

  // ---------- ② 幻觉/想象无收束 ----------
  let hallucinationCount = 0;
  imagineHits.forEach((g) => {
    const sameLineReturn = RETURN.test(g.text);
    const laterReturn = linesInScene(g.scene, g.line + 1, g.line + 5).some((r) => RETURN.test(r.text));
    if (sameLineReturn || laterReturn) return;
    const sameLineDramatic = DRAMATIC.test(g.text);
    const laterDramatic = linesInScene(g.scene, g.line + 1, g.line + 3).some((r) => DRAMATIC.test(r.text));
    if (!sameLineDramatic && !laterDramatic) return;
    hallucinationCount += 1;
    if (hallucinationCount <= 2) {
      issues.push({
        severity: hallucinationCount >= 2 ? 'mid' : 'low',
        type: 'hallucination_unbound',
        evidence: ev(g, g.scene),
        advice: isZh ? adviceMap.hallucination.zh : adviceMap.hallucination.en,
        scene: g.scene,
        key: `halluc_s${g.scene}_${g.line}`,
      });
    }
  });

  // ---------- 闪回段合并（同场仅相邻行标记合并为一段；隔行反应动作即视为新段） ----------
  /** 指代语：本段不复现事件名，但用"那天/那场/that day"承接上一段记忆 → 继承词根 */
  const MEM_REF = isZh
    ? /那(?:一)?(?:场|天|夜|刻|次)|又是(?:那|这)|同(?:一)?(?:场|段|个)记忆/
    : /\bthat (?:day|night|moment|scene)|the same (?:memory|scene|night)|the memory (?:again|returned)\b/i;
  const segments: FlashSegment[] = [];
  const sortedFlash = [...flashHits].sort((a, b) => a.line - b.line);
  sortedFlash.forEach((f, idx) => {
    const last = segments[segments.length - 1];
    if (last && last.scene === f.scene && f.line - last.start <= 1) return; // 合并到前段（起点不变）
    // 指纹/新信息窗口：本段起至多 3 行，且在下一个闪回标记之前结束，防止被后段污染
    const nextMarker = sortedFlash.slice(idx + 1).find((q) => q.scene === f.scene && q.line > f.line);
    // 紧邻的下一个标记行属于同段（内容常写在标记行上），窗口含它；再下一个标记则截到其前
    const hardEnd = !nextMarker
      ? f.line + 2
      : nextMarker.line - f.line <= 1
        ? nextMarker.line
        : nextMarker.line - 1;
    const winEnd = Math.min(f.line + 2, hardEnd);
    const win = linesInScene(f.scene, f.line, winEnd);
    const text = win.map((r) => r.text).join(' ');
    let root: string | null = null;
    for (const [key, re] of ROOT_TABLE) {
      if (re.test(text)) { root = key; break; }
    }
    // 本段无事件词根但有指代语：继承此前最近一段（行距 ≤10）的词根
    if (!root && MEM_REF.test(text)) {
      const prev = [...segments].reverse().find((s) => s.root && f.line - s.start <= 10);
      if (prev) root = prev.root;
    }
    segments.push({ start: f.line, scene: f.scene, text, root, hasExit: false, hasNewInfo: NEW_INFO.test(text) });
  });

  // 正信号：有收束的闪回段——每个收束行只归属其之前最近、相距 ≤3 行的一段（密集闪回时不重复奖励）
  let boundedFlashCount = 0;
  flashExitHits.forEach((x) => {
    const owner = [...segments]
      .filter((s) => s.scene === x.scene && s.start < x.line && x.line - s.start <= 3)
      .sort((a, b) => b.start - a.start)[0];
    if (owner) owner.hasExit = true;
  });
  boundedFlashCount = segments.filter((s) => s.hasExit).length;

  // ---------- ③ 闪回堆砌 ----------
  if (segments.length >= 4) {
    const firstScene = segments[0].scene;
    issues.push({
      severity: segments.length >= 6 ? 'mid' : 'low',
      type: 'flashback_overuse',
      evidence: isZh
        ? `第${firstScene}场：闪回段共 ${segments.length} 处（≥4 处即判堆砌）`
        : `Scene ${firstScene}: ${segments.length} flashback segments (>=4 is overload)`,
      advice: isZh ? adviceMap.overuse.zh : adviceMap.overuse.en,
      scene: firstScene,
      key: 'flash_overuse',
    });
  }

  // ---------- ④ 同一记忆重复闪回无新信息 ----------
  const rootBuckets = new Map<string, FlashSegment[]>();
  segments.filter((s) => s.root).forEach((s) => {
    const arr = rootBuckets.get(s.root as string) || [];
    arr.push(s);
    rootBuckets.set(s.root as string, arr);
  });
  let repeatedMemoryKinds = 0;
  let fairRecallCount = 0;
  rootBuckets.forEach((arr, root) => {
    if (arr.length < 2) return;
    for (let i = 1; i < arr.length; i += 1) {
      if (arr[i].hasNewInfo) fairRecallCount += 1;
    }
    const stale = arr.filter((s, i) => i >= 1 && !s.hasNewInfo);
    if (stale.length > 0) {
      repeatedMemoryKinds += 1;
      if (repeatedMemoryKinds <= 2) {
        const at = stale[0];
        issues.push({
          severity: 'mid',
          type: 'flashback_repeat',
          evidence: isZh
            ? `第${at.scene}场：「${root}」记忆第 ${arr.length} 次闪回，窗口内无新信息词`
            : `Scene ${at.scene}: "${root}" memory flashback #${arr.length} with no new-information cue`,
          advice: isZh ? adviceMap.repeat.zh : adviceMap.repeat.en,
          scene: at.scene,
          key: `flash_repeat_${root}`,
        });
      }
    }
  });

  // ---------- 场景旗标 ----------
  issues.forEach((it) => {
    const sc = scenes.find((s) => s.index === it.scene);
    if (sc) sc.flagCount += 1;
  });

  // ---------- 评分 ----------
  const sevRank = { high: 0, mid: 1, low: 2 };
  issues.sort((a, b) =>
    (sevRank[a.severity] - sevRank[b.severity]) || a.scene - b.scene || a.key.localeCompare(b.key));

  let penalty = 0;
  if (fakeoutCount > 0) penalty += Math.min(12 + (fakeoutCount - 1) * 10, 22);
  if (hallucinationCount > 0) penalty += hallucinationCount >= 2 ? 16 : 6;
  if (segments.length >= 6) penalty += 11;
  else if (segments.length >= 4) penalty += 7;
  if (repeatedMemoryKinds > 0) penalty += Math.min(repeatedMemoryKinds * 10, 18);

  let bonus = 0;
  bonus += Math.min(markedDreamCount * 2, 4);
  bonus += Math.min(fairRecallCount * 2, 4);
  bonus += Math.min(boundedFlashCount, 3);

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty + bonus)));

  return {
    score,
    sceneCount: scenes.length,
    signalCount,
    issueCount: issues.length,
    dreamEnterCount: enterHits.length,
    wakeCount: wakeHits.length,
    markedDreamCount,
    fakeoutCount,
    imagineCount: imagineHits.length,
    hallucinationCount,
    flashbackCount: segments.length,
    flashExitCount: flashExitHits.length,
    repeatedMemoryKinds,
    fairRecallCount,
    boundedFlashCount,
    scenes,
    issues,
  };
}
