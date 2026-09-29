import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.143 金手指规则一致性检测（PRD 2.1.40 系统/异能/重生题材——外挂可以强，但不能没有规矩）
 * ------------------------------------------------------------------
 * 竖屏短剧的系统流/异能流/重生流顶格爽点是"金手指碾压"，顶格差评是"作者临时发外挂"——
 * 能力想用时才出现、规则用过才补、危急关头突然觉醒新技能、外挂零代价解决一切、
 * 重生者靠前世记忆全知全能却零误差零蝴蝶效应。
 * 本引擎专管**金手指（系统/面板/异能/空间/读心/预知/重生记忆）的规则公平性与代价自洽**。
 *
 * 题材门控（现实豪门/复仇/甜宠稿无外挂信号 → gate='none' 满分放行，绝不误伤）：
 *  - system：系统/面板/商城/任务/金手指/异能/超能力/随身空间/读心/透视/预知/传承之力/灵气修为
 *  - rebirth：重生/前世记忆（无 system 信号时只跑"临时觉醒"与"全知零误差"两检）
 *
 * 分工（近邻引擎边界）：
 *  - xuanhuan/underdog/archetype/transmigrate craft：知识层（创作 directive 讲原则），不评分
 *  - causal-logic / unsourced_knowledge：普通角色"我早就知道"的信息空降（非外挂体系）
 *  - causal-logic / deus_ex_machina：外部救兵天降（本引擎管主角自身外挂）
 *  - foreshadow-ledger：器物跨集关键词松散记账（不管能力规则）
 *  - plot-armor(v2.141)：反派降智放人/致命无伤（不管外挂规则）
 *  - v2.143（本引擎）：能力是否先立规矩后使用、新功能是否临时解锁、外挂有无代价、
 *    能否一个念头终结危机、前世记忆是否零误差
 *
 * 五类问题（前四 system 门控，第五 rebirth 门控）：
 *  1) unestablished_cheat  先用后立规：USE 行之前无任何 RULE 行（同行事后补规不算，严格更早行）
 *  2) last_minute_unlock   临时觉醒：UNLOCK 行之前无 RULE → mid（第2次 high）；
 *                                    有 RULE 无升级预告 FORESEE → low（体系内升级也建议埋线）
 *  3) costless_overuse     零代价万能外挂：USE≥3 次、0 代价兑付、RULE 中无代价/冷却/次数限制，
 *                                    3-4 次 low、≥5 次 mid；全文 1 条
 *  4) cheat_solves_all     许愿机：无规则能力同行直接终结危机（一个念头解决/敌人纷纷倒下）
 *  5) flawless_foreknowledge 重生全知：前世记忆 USE≥3 次但全文无蝴蝶效应/记忆偏差信号
 *
 * 正信号：ruleFirst（先立规后使用）+2/次 cap6；costPaid（代价兑付）+2/次 cap4；
 *         fairUnlock（有预告的升级）+2/次 cap4。
 */

export type CrLang = 'zh' | 'en';
export type CrGate = 'none' | 'system' | 'rebirth';

export interface CheatRuleIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'unestablished_cheat'
    | 'last_minute_unlock'
    | 'costless_overuse'
    | 'cheat_solves_all'
    | 'flawless_foreknowledge';
  evidence: string;
  advice: string;
  scene: number;
  key: string;
}

export interface CheatRuleSceneReport {
  index: number;
  header: string;
  flagCount: number;
}

export interface CheatRuleResult {
  /** 题材门控：none=现实题材（满分放行）/ system=系统异能 / rebirth=纯重生 */
  gate: CrGate;
  score: number;
  sceneCount: number;
  signalCount: number;
  issueCount: number;
  /** 动用外挂/异能次数 */
  useCount: number;
  /** 立规矩行数量（规则/限制/代价/冷却/重生声明） */
  ruleCount: number;
  /** 觉醒/解锁新能力次数 */
  unlockCount: number;
  /** 升级预告行数量（技能树/任务奖励/即将解锁） */
  foreseeCount: number;
  /** 代价兑付行数量（反噬/虚脱/冷却/扣分） */
  costCount: number;
  /** 能力直接终结危机次数 */
  finishCount: number;
  /** 前世记忆使用次数 */
  rebirthUseCount: number;
  /** 蝴蝶效应/记忆偏差行数量 */
  fluxCount: number;
  /** 先立规后使用次数（正信号） */
  ruleFirstCount: number;
  /** 代价兑付次数（正信号，cap 计分） */
  costPaidCount: number;
  /** 有预告的升级次数（正信号） */
  fairUnlockCount: number;
  scenes: CheatRuleSceneReport[];
  issues: CheatRuleIssue[];
}

// —— 场景切分（复用 v2.132 起标题约定）——

// —— 题材门控 ——
const GATE_SYSTEM_ZH = /系统(?:提示音?|面板|商城|空间|发布|奖励|任务|绑定|宿主|签到|抽奖|金币|积分|属性|弹窗|规则|商城)|金手指|外挂|异能|超能力|随身空间|读心术?|透视(?:眼|术)?|天眼|预知(?:未来|能力|危险)|传承之力|神秘传承|灵气(?:复苏|之力|涌入)?|修为(?:突破|境界)?|境界(?:突破|提升)|宿主/;
const GATE_SYSTEM_EN = /\b(?:system (?:prompt|panel|shop|quest|reward|notification|chime|window|screen|space|binding|host|rule)|status panel|cheat(?:ing)? ability|golden finger|super ?power(?:s)?|psychic ability|telepathy|mind[- ]reading(?: ability)?|x[- ]ray vision|precognition|spatial inventory|system space|mystic inheritance|spiritual energy|cultivation (?:base|realm|breakthrough)|(?:hidden|latent|awakened|new) power)\b/i;
const GATE_REBIRTH_ZH = /重生(?:回到|归来|之后|一次|一回|第一天)?|上一世|上辈子|前世(?:的)?(?:记忆|她|他|经验)|重回(?:十年|三年|五年|二十年)?前?|回到(?:了)?\d{2,4}年(?:前)?/;
const GATE_REBIRTH_EN = /\b(?:reborn(?:\s+again)?|rebirth|past[- ]life memories?|in (?:her|his) past life|went back in time|woke up(?:\s+\d+ years)? (?:younger|back in)|returned to \d{4})\b/i;

// —— 立规矩：限制/代价/冷却/条件/次数 + 重生声明 ——
const RULE_CORE_ZH = /(?:系统(?:的)?(?:规则|设定|限制|说明)|规则(?:是|为|：|:)|每天只能|每日只能|一(?:天|日)只能|一(?:天|日)仅能|只能(?:用|使|维持|持续)\d+次|用一次[^。；\n]{0,12}?(?:消耗|代价|反噬|虚脱)|使用(?:一次|一回)[^。；\n]{0,14}?(?:消耗|代价|反噬|虚脱)|冷却(?:时间|期)?(?:为|是|需要|开始|中)?\d*[^，。；\n]{0,6}?|代价(?:是|为|就?是|：|:)|副作用|反噬(?:为|是|会|袭来)|触发条件(?:是|为)?|能力(?:只|仅)能[^。；\n]{0,22}|无法(?:对|作用于)[^。；\n]{0,12}|对[^。；\n]{0,8}?无效|等级(?:不足|达到\s*\d+\s*级|不够)|积分(?:不足|兑换需要|不够)|需要\s*\d+\s*积分|寿命(?:减少|折损|消耗)|不能(?:连续|频繁|过度)使用|任务完成(?:才能|即可)(?:解锁|获得)|(?:天眼|异能|能力|金手指)(?:只|仅)能[^。；\n]{0,20}|(?:天眼|异能|能力|金手指)(?:不能|无法)[^。；\n]{0,14})/;
const RULE_DECLARE_ZH = /重生回到(?:了)?|一睁眼(?:回到|竟然|发现)|回到(?:了)?\d{2,4}年(?:前|的)[^。；\n]{0,10}?|重回(?:十年|三年|五年|二十年前)|重生(?:归来|之后|第一天)/;
const RULE_CORE_EN = /\b(?:system rules?|the rule (?:is|was)|rules? of (?:the|this) (?:system|ability)|only \d+ times? (?:per|a|each) day|once (?:per|a) day|cooldown(?: of \d+[^.]*)?(?: period|begins|starts)?|(?:each|every) use costs?[^.]{0,20}|at the cost of[^.]{0,20}|side effects?|backlash (?:is|was|meant|would)|trigger condition(?: is)?|ability can only[^.]{0,24}|can only be used[^.]{0,20}|does(?:n't| not) work on[^.]{0,16}|ineffective against|level \d+ required|not enough (?:level|points)|points? required|costs? \d+ points|life(?:span)? (?:shortened|drained|at stake)|cannot be used (?:consecutively|too often))\b/i;
const RULE_DECLARE_EN = /\b(?:reborn(?:\s+again)? into|woke up back in|went back in time to|returned to the year \d{4}|reborn five years earlier)\b/i;
// 规则行中是否含"代价类"表述（用于豁免 costless_overuse）
const RULE_HAS_COST_ZH = /代价|冷却|反噬|次数|消耗|副作用|寿命|虚脱|透支|折寿|只能用\s*\d+\s*次|每天只能|不能连续/;
const RULE_HAS_COST_EN = /\b(?:cost|cooldown|backlash|side effect|times? (?:per|a) day|life(?:span)?|consecutively|at the expense of)\b/i;

// —— 动用外挂/异能（system 题材）——
const USE_ZH = /系统(?:提示音?(?:响起|提示|播报)|发布(?:了)?(?:新)?任务|奖励(?:了)?[^。；\n]{0,10}?(?:积分|技能|金币)|商城(?:里)?(?:兑换|购买|刷新)|弹出(?:一(?:个|条))?(?:任务|奖励|提示|面板))|调出(?:系统)?面板|面板(?:上)?(?:显示|亮起|弹出|浮现)|打开(?:系统)?面板|点(?:下|了)?(?:领取|兑换|确认)|发动(?:了)?(?:异能|技能|能力|天眼|透视|读心术?|金手指|系统)|启动(?:了)?(?:异能|系统|法阵)|意念(?:一)?(?:动|闪)|心念一动|动用(?:了)?(?:异能|金手指|能力|底牌)|开启(?:了)?(?:天眼|透视|读心)|透视(?:眼|术)?(?:扫过|启动|开启|看向)|读(?:取|出)?(?:她|他|对方|众人)(?:的)?(?:心|心思|想法|内心)|预知(?:到|了)?(?:危险|未来|结局)|空间(?:里|中|内)(?:取出|拿出|闪出|丢出)|(?:从|自)?随身空间(?:里)?(?:取出|拿出)|金光(?:一闪)?(?:治愈|治疗|修复|笼罩)|传承之力(?:运转|涌出|爆发)|灵气(?:涌入|运转|修复|汇聚)|运转(?:心法|功法|灵气)/;
const USE_EN = /\b(?:the )?system (?:chimed|prompted|issued|rewarded(?: her|him)?|announced|dinged|notified)|opened (?:the|her|his) (?:status )?panel|(?:status )?panel (?:glowed|showed|popped up|lit up)|tapped (?:claim|redeem|confirm)|activated (?:the|her|his) (?:ability|skill|power|telepathy|x-ray|formation)|used (?:the|her|his) (?:cheat|ability|power|system|telepathy|x-ray|trump card)|with a thought|with (?:barely )?a thought|read (?:her|his|their) (?:mind|thoughts|heart)|foresaw (?:the )?(?:danger|future|ending)|pulled[^.]{0,24}?from (?:the|her|his) (?:spatial )?inventory|golden light (?:flashed|healed|mended|engulfed)|mystic inheritance (?:surged|flowed|erupted)|spiritual energy (?:surged|flowed|gathered)|cycled (?:her|his) (?:cultivation )?technique\b/i;

// —— 临时觉醒/解锁新能力 ——
const UNLOCK_ZH = /(?:突然|骤然|猛然|忽地|陡然)(?:觉醒|解锁|激活|领悟|爆发出?|突破)[^。；\n]{0,14}?(?:异能|能力|技能|功能|力量|天眼|金手指|天赋)?|(?:觉醒|解锁|激活)(?:了)?(?:新的|前所未有的|隐藏的| latent)?[^。；\n]{0,6}?(?:异能|能力|技能|功能|力量|天赋)|系统(?:突然)?(?:弹出|提示|发布)[^。；\n]{0,18}?(?:解锁|新技能|新功能|奖励技能)|关键(?:时刻|关头)[^。；\n]{0,12}?(?:觉醒|爆发|突破|领悟|解锁)|情急(?:之下|时刻)[^。；\n]{0,10}?(?:觉醒|爆发|解锁)|(?:体内|身体里|丹田|血脉)[^。；\n]{0,10}?(?:力量|暖流|金光|灵气)[^。；\n]{0,8}?(?:涌出|苏醒|爆发|觉醒|流淌)/;
const UNLOCK_EN = /\b(?:suddenly|abruptly|out of nowhere) (?:awakened|unlocked|activated|burst with|manifested|erupted)|(?:awakened|unlocked|activated) (?:a |her |his |the )?(?:new |hidden |latent )?(?:ability|power|skill|function|talent)|new (?:ability|skill|power) (?:unlocked|awakened|manifested)|at the critical moment[^.]{0,30}?(?:awakened|unlocked|burst|power surged)|power (?:surged|erupted) (?:within|through) (?:her|him)|(?:new|hidden) power stirred (?:in|within) (?:her|his) (?:body|blood|dantian)\b/i;

// —— 升级预告（体系内升级的公平铺垫）——
const FORESEE_ZH = /升级|经验值(?:满|攒|达到)|下一阶段|下一等级|技能树|即将(?:解锁|觉醒|获得|突破)|任务(?:奖励|完成)[^。；\n]{0,10}(?:解锁|获得|技能)|任务[^。；\n]{0,8}?就能?(?:解锁|获得|学到)|积分(?:兑换|商城)|等(?:她|他)?(?:升到?|等级达到)\s*\d+\s*级|提前(?:预告|知道)(?:了)?(?:这个)?(?:技能|能力)/;
const FORESEE_EN = /\b(?:level(?:ed|ing)? up|next tier|next level|skill tree|about to unlock|would unlock|will unlock(?:\s+at level \d+)?|quest reward[^.]{0,20}?(?:skill|ability|unlock)|points? (?:shop|exchange|store)|once (?:she|he) reached level \d+|advance to (?:the next )?level)\b/i;

// —— 代价兑付 ——
const COST_ZH = /反噬(?:袭来|而来|开始|发作|之下|涌)?|(?:一阵)?虚脱|体力(?:严重)?透支|(?:当场)?(?:昏倒|晕倒|昏死过去)|元气大伤|气血(?:一阵)?翻涌|脸色(?:一阵)?(?:苍白|煞白|发白)[^。；\n]{0,14}?|付出(?:了)?(?:沉重|相应)?(?:的)?代价|寿命(?:减少|折损|消耗|少了)[^。；\n]{0,8}?|冷却(?:中|开始|启动|时间)|积分(?:不足|被?扣除|清零)|扣除(?:了)?\s*\d*\s*(?:积分|金币)?|体力(?:不支|耗尽)|灵力(?:耗尽|枯竭)|昏死过去/;
const COST_EN = /\b(?:the )?backlash (?:hit|came|struck|began|washed over)|(?:a wave of )?exhaustion(?: washed over)?|(?:severely )?drained|(?:collapsed|passed out|fainted) (?:from exhaustion)?|paid (?:the|a) (?:heavy|terrible|steep) price|at a terrible cost|life(?:span)? (?:shortened|drained|was at stake)|cooldown (?:began|started|engaged|kicked in)|points? (?:deducted|insufficient|not enough)|energy (?:depleted|ran out|was spent)|vitality badly damaged\b/i;

// —— 能力当场终结危机（必须与 USE 同行才计入，避免误伤普通打斗）——
const FINISH_ZH = /(?:一个念头|意念(?:一)?动|心念一动|随手一击|轻轻一挥手|金光一闪)[^。；\n]{0,20}?(?:解决|搞定|摆平|反杀|击退|放倒|碾压|制服|结束)|(?:问题|危机|麻烦|困局)(?:迎刃而解|被[^。；\n]{0,8}轻松解决)|(?:敌人|对手|混混|保镖|黑衣人|打手)(?:们)?(?:全部|纷纷|应声|一排排)?(?:倒下|倒地|跪地|败退|被制服|躺了一地)|(?:发动|动用|启动)[^。；\n]{0,8}(?:异能|能力|金手指|系统)[^。；\n]{0,16}(?:反杀|翻盘|轻松(?:取胜|解决|获胜)|不费吹灰之力|毫发无伤(?:地)?(?:取胜|解决|反杀))/;
const FINISH_EN = /\bwith (?:a|one|barely a) thought[^.]{0,24}?(?:solved|defeated|ended|finished|neutralized|crushed|overpowered)|(?:problem|crisis|threat) (?:melted away|was solved instantly|solved itself|ended on the spot)|(?:enemies|guards|attackers|thugs) (?:all )?(?:fell|dropped|collapsed|went down|were subdued) at once|used (?:the|her|his) (?:cheat|power|ability)[^.]{0,24}?(?:defeated them|turned the tables|won effortlessly|without breaking a sweat)\b/i;

// —— 前世记忆使用（rebirth 题材）——
const REBIRTH_USE_ZH = /(?:上一世|前世|上辈子)[^。；\n]{0,20}?(?:记忆|经验|记得|知道|发生|轨迹|那场|这件事|结局)|(?:凭借|凭着|靠(?:着)?)(?:上一世|前世|上辈子)(?:的)?(?:记忆|经验|预知)|她(?:清晰|清楚)地?记得[^。；\n]{0,18}(?:会|要|发生|那天|这次|结局)|(?:因为|由于)?重生(?:一次|一回|归来)?[^。；\n]{0,12}(?:她|他)?(?:知道|记得|预知|提前)(?:了|过|到)?/;
const REBIRTH_USE_EN = /\b(?:in|from) (?:her|his) past life[^.]{0,30}?(?:remembered|knew|had happened|would happen)|past[- ]life memories?[^.]{0,20}?(?:told|warned|showed|let her know)|(?:she|he) (?:clearly |still )?remembered (?:what|that|how|the day)|(?:because|thanks to) (?:the )?rebirth[^.]{0,24}?(?:knew|remembered|foresaw|in advance)\b/i;

// —— 蝴蝶效应/记忆偏差（重生全知的豁免）——
const FLUX_ZH = /蝴蝶效应|历史(?:已经)?(?:被)?(?:改变|偏离|改写|不同)|与(?:上一世|前世)(?:不同|不一样|不符)|记(?:不|不太)清(?:了|楚)?|记忆(?:开始)?(?:模糊|错乱|对不上)|轨迹(?:已经)?(?:偏离|改变|偏转)|重生(?:带来)?的?蝴蝶|这一世(?:已经)?(?:不同|变了)|命运(?:已经)?(?:被)?(?:改写|改变)/;
const FLUX_EN = /\bbutterfly effect|history had (?:already )?changed|different from (?:her|his) past life|memories? (?:grew|turn(?:ed)?)? ?(?:blurry|hazy|fuzzy|unreliable)|could no longer remember (?:clearly|exactly)|timeline had shifted|fate had (?:already )?(?:changed|been rewritten)|this life was (?:already )?different\b/i;

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
  unestablished: '能力第一次登场就直接解决问题，观众没看到任何规矩，等于作者当场发外挂。先用一两句把规则立住：每天只能用三次、使用后会虚脱、对活人无效——先给边界再出手，后面的胜利才是主角"戴着镣铐跳舞"赢来的。',
  unlockMid: '危急关头突然觉醒/解锁新能力，前文没有任何规则体系支撑，这是临阵开挂。把新能力改成体系内升级：提前交代技能树、任务奖励或"达到三级解锁"，让观众在主角拼命前就知道这一枪存在。',
  unlockLow: '新能力虽然有规则体系，但解锁前毫无升级预告，爽感像白捡的。在前一到两场埋一句经验值将满/下阶段技能，兑现时观众会觉得是挣来的。',
  overuse: '同一集外挂动用多次，既无反噬虚脱也无冷却次数，外挂成了许愿机，张力会迅速归零。给能力加硬限制并真的兑付代价：用完昏倒、积分清零、冷却三天——限制越狠，下一次出手越爽。',
  solves: '没有规则的能力一个念头就终结危机、敌人纷纷倒下，胜利毫无过程。哪怕外挂很强，也要让主角先付代价、绕弯路或被规则卡一次，再完成反杀；碾压只能是铺垫足够后的收束，不能是全程的主菜。',
  foreknowledge: '重生者反复用前世记忆精准预知，却没有任何记忆偏差或蝴蝶效应，全知等于无敌，悬念很快枯竭。安排至少一处"与上一世不同"：小人物的选择改变轨迹、关键细节她记不清，让先知优势带风险。',
};
const adviceEn = {
  unestablished: 'The ability debuts by solving a problem with no rules ever stated — the writer hands out a cheat on the spot. Establish boundaries a line or two earlier: three uses a day, exhaustion afterward, it cannot work on the living. Set the fence before showing the win.',
  unlockMid: 'A new ability awakens at the critical moment with no rule system behind it: last-minute cheating. Make the new power an in-system upgrade seeded earlier — a skill tree, a quest reward, "unlocks at level three" — so the audience knows the gun exists before the heroine fights.',
  unlockLow: 'The ability sits inside a rule system, but the upgrade has no foreshadowing, so it feels free. Plant a line one or two scenes earlier — experience almost full, a next-tier skill — and the payoff feels earned.',
  overuse: 'The cheat is used many times in one episode with no backlash, exhaustion or cooldown: a wishing well that kills all tension. Add hard limits and actually pay them out — collapse after use, points wiped, a three-day cooldown. The harsher the limit, the sweeter the next use.',
  solves: 'An ungoverned ability ends the crisis with one thought, enemies dropping instantly, and there is no process to the victory. Even a strong cheat should demand a price, a detour or a rule blocking the hero once before the counter-kill. An effortless crush can only be the final beat, never the main course.',
  foreknowledge: 'The reborn character keeps predicting everything from past-life memories with zero memory gaps or butterfly effects — omniscience means invincibility, and suspense evaporates. Add at least one divergence from the past life: a minor character changes the path, a key detail she cannot quite remember. Give foreknowledge risk.',
};

interface Hit { line: number; scene: number; text: string }

/**
 * 金手指规则一致性检测
 * @param text 剧本全文
 * @param lang zh | en
 */
export function cheatRuleCheck(text: string, lang: CrLang = 'zh'): CheatRuleResult {
  const isZh = lang !== 'en';
  const empty: CheatRuleResult = {
    gate: 'none', score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
    useCount: 0, ruleCount: 0, unlockCount: 0, foreseeCount: 0, costCount: 0,
    finishCount: 0, rebirthUseCount: 0, fluxCount: 0,
    ruleFirstCount: 0, costPaidCount: 0, fairUnlockCount: 0, scenes: [], issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const scenes = splitScenes(text, isZh);
  if (!scenes.length) return empty;

  const gate: CrGate = (isZh ? GATE_SYSTEM_ZH : GATE_SYSTEM_EN).test(text)
    ? 'system'
    : (isZh ? GATE_REBIRTH_ZH : GATE_REBIRTH_EN).test(text)
      ? 'rebirth'
      : 'none';
  if (gate === 'none') return { ...empty, sceneCount: scenes.length, scenes: scenes.map((s, i) => ({ index: i + 1, header: s.header, flagCount: 0 })) };

  const USE = isZh ? USE_ZH : USE_EN;
  const UNLOCK = isZh ? UNLOCK_ZH : UNLOCK_EN;
  const FORESEE = isZh ? FORESEE_ZH : FORESEE_EN;
  const COST = isZh ? COST_ZH : COST_EN;
  const FINISH = isZh ? FINISH_ZH : FINISH_EN;
  const REBIRTH_USE = isZh ? REBIRTH_USE_ZH : REBIRTH_USE_EN;
  const FLUX = isZh ? FLUX_ZH : FLUX_EN;
  const RULE_RE = isZh ? RULE_CORE_ZH : RULE_CORE_EN;
  const RULE_DECLARE = isZh ? RULE_DECLARE_ZH : RULE_DECLARE_EN;
  const RULE_HAS_COST = isZh ? RULE_HAS_COST_ZH : RULE_HAS_COST_EN;
  const A = isZh ? adviceZh : adviceEn;

  const issues: CheatRuleIssue[] = [];
  const sceneFlags = new Map<number, number>();
  const flag = (scene: number) => sceneFlags.set(scene, (sceneFlags.get(scene) ?? 0) + 1);

  // 核心规则行（限制/代价/冷却/条件）与重生声明分开：重生声明只说明"重生"这一个金手指，
  // 不能为重生后新觉醒的异能充当规则（issue②/④ 只认核心规则行）
  const coreRuleHits: Hit[] = [];
  const declareHits: Hit[] = [];
  const useHits: Hit[] = [];
  const unlockHits: Hit[] = [];
  const foreseeHits: Hit[] = [];
  const costHits: Hit[] = [];
  const rawCostHits: Hit[] = [];
  const finishHits: Hit[] = [];
  const rbUseHits: Hit[] = [];
  const fluxHits: Hit[] = [];
  let globalLine = 0;
  let signalCount = 0;

  scenes.forEach((sc, si) => {
    for (const raw of sc.lines) {
      const line = globalLine++;
      const push = (arr: Hit[]) => { arr.push({ line, scene: si + 1, text: raw }); signalCount++; };
      if (RULE_RE.test(raw)) push(coreRuleHits);
      if (gate === 'rebirth' && RULE_DECLARE.test(raw)) push(declareHits);
      if (gate === 'system') {
        if (USE.test(raw)) push(useHits);
        // 代价原始命中先收集：规则行里"承诺"的代价不算兑付，兑付行必须不早于某次 USE
        if (COST.test(raw)) rawCostHits.push({ line, scene: si + 1, text: raw });
        if (USE.test(raw) && FINISH.test(raw)) push(finishHits);
      }
      // 同一行若命中预告（系统通知"将解锁"），那是铺垫而非真正解锁，不计 UNLOCK
      if (UNLOCK.test(raw) && !FORESEE.test(raw)) push(unlockHits);
      if (FORESEE.test(raw)) push(foreseeHits);
      if (REBIRTH_USE.test(raw)) push(rbUseHits);
      if (FLUX.test(raw)) push(fluxHits);
    }
  });

  // 兑付语义：代价行必须有不晚于它的 USE 行（规则中的代价承诺不发 bonus、不当兑付）
  for (const h of rawCostHits) {
    if (useHits.some((u) => u.line <= h.line)) {
      costHits.push(h);
      signalCount++;
    }
  }

  let penalty = 0;
  let ruleFirstCount = 0;
  let fairUnlockCount = 0;

  // —— ① 先用后立规（FINISH 同行交给 ④ 重罚，避免双罚）——
  if (gate === 'system') {
    const finishLines = new Set(finishHits.map((h) => h.line));
    let unestCount = 0;
    for (const h of useHits) {
      if (finishLines.has(h.line)) continue;
      if (coreRuleHits.some((r) => r.line < h.line)) {
        ruleFirstCount++;
      } else {
        unestCount++;
        if (unestCount <= 2) {
          issues.push({
            severity: unestCount >= 2 ? 'high' : 'mid',
            type: 'unestablished_cheat', key: 'unestablished', scene: h.scene,
            evidence: isZh ? `第${h.scene}场：${h.text.slice(0, 34)}` : `Scene ${h.scene}: ${h.text.slice(0, 60)}`,
            advice: A.unestablished,
          });
          flag(h.scene);
        }
      }
    }
    penalty += Math.min(unestCount * 12, 24);
  }

  // —— ② 临时觉醒/解锁（system 与 rebirth 均检；重生后觉醒异能也要有规矩）——
  let unlockNoRuleCount = 0;
  let unlockLowCount = 0;
  let unlockPushed = 0;
  for (const h of unlockHits) {
    const ruleBefore = coreRuleHits.some((r) => r.line < h.line);
    const foreseeBefore = foreseeHits.some((f) => f.line < h.line);
    if (!ruleBefore) {
      unlockNoRuleCount++;
      if (unlockPushed < 2) {
        unlockPushed++;
        issues.push({
          severity: unlockNoRuleCount >= 2 ? 'high' : 'mid',
          type: 'last_minute_unlock', key: 'unlock', scene: h.scene,
          evidence: isZh ? `第${h.scene}场：${h.text.slice(0, 34)}` : `Scene ${h.scene}: ${h.text.slice(0, 60)}`,
          advice: A.unlockMid,
        });
        flag(h.scene);
      }
    } else if (!foreseeBefore) {
      unlockLowCount++;
      if (unlockPushed < 2) {
        unlockPushed++;
        issues.push({
          severity: 'low',
          type: 'last_minute_unlock', key: 'unlockLow', scene: h.scene,
          evidence: isZh ? `第${h.scene}场：${h.text.slice(0, 34)}` : `Scene ${h.scene}: ${h.text.slice(0, 60)}`,
          advice: A.unlockLow,
        });
        flag(h.scene);
      }
    } else {
      fairUnlockCount++;
    }
  }
  penalty += Math.min(unlockNoRuleCount * 12, 22) + Math.min(unlockLowCount * 5, 8);

  // —— ③ 零代价万能外挂（全文 1 条）——
  if (gate === 'system' && useHits.length >= 3 && costHits.length === 0) {
    const ruleHasCost = coreRuleHits.some((r) => RULE_HAS_COST.test(r.text));
    if (!ruleHasCost) {
      const severity = useHits.length >= 5 ? 'mid' : 'low';
      const h = useHits[useHits.length - 1];
      issues.push({
        severity,
        type: 'costless_overuse', key: 'overuse', scene: h.scene,
        evidence: isZh
          ? `第${h.scene}场：本集外挂动用 ${useHits.length} 次，无反噬/虚脱/冷却/扣分等任何代价`
          : `Scene ${h.scene}: cheat used ${useHits.length} times with no backlash, exhaustion, cooldown or point cost`,
        advice: A.overuse,
      });
      flag(h.scene);
      penalty += useHits.length >= 5 ? 12 : 7;
    }
  }

  // —— ④ 许愿机：无规则能力同行终结危机 ——
  if (gate === 'system') {
    let solvesCount = 0;
    for (const h of finishHits) {
      if (coreRuleHits.some((r) => r.line < h.line)) continue;
      solvesCount++;
      if (solvesCount <= 2) {
        issues.push({
          severity: solvesCount >= 2 ? 'high' : 'mid',
          type: 'cheat_solves_all', key: 'solves', scene: h.scene,
          evidence: isZh ? `第${h.scene}场：${h.text.slice(0, 34)}` : `Scene ${h.scene}: ${h.text.slice(0, 60)}`,
          advice: A.solves,
        });
        flag(h.scene);
      }
    }
    penalty += Math.min(solvesCount * 11, 20);
  }

  // —— ⑤ 重生全知零误差（纯重生门控）——
  if (gate === 'rebirth' && rbUseHits.length >= 3 && fluxHits.length === 0) {
    const h = rbUseHits[0];
    issues.push({
      severity: 'low',
      type: 'flawless_foreknowledge', key: 'foreknowledge', scene: h.scene,
      evidence: isZh
        ? `第${h.scene}场：前世记忆被使用 ${rbUseHits.length} 次，全文 0 处蝴蝶效应/记忆偏差`
        : `Scene ${h.scene}: past-life foreknowledge used ${rbUseHits.length} times, 0 butterfly effects or memory gaps`,
      advice: A.foreknowledge,
    });
    flag(h.scene);
    penalty += 7;
  }

  // —— 正信号 ——
  const costPaidCount = gate === 'system' && costHits.length > 0 && useHits.length > 0
    ? Math.min(costHits.length, 2)
    : 0;
  const bonus = Math.min(ruleFirstCount * 2, 6) + costPaidCount * 2 + Math.min(fairUnlockCount * 2, 4);

  issues.sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 } as const;
    return order[a.severity] - order[b.severity] || a.scene - b.scene;
  });

  const sceneReports: CheatRuleSceneReport[] = scenes.map((s, i) => ({
    index: i + 1,
    header: s.header,
    flagCount: sceneFlags.get(i + 1) ?? 0,
  }));

  return {
    gate,
    score: clamp(Math.round(100 - penalty + bonus), 0, 100),
    sceneCount: scenes.length,
    signalCount,
    issueCount: issues.length,
    useCount: useHits.length,
    ruleCount: coreRuleHits.length + declareHits.length,
    unlockCount: unlockHits.length,
    foreseeCount: foreseeHits.length,
    costCount: costHits.length,
    finishCount: finishHits.length,
    rebirthUseCount: rbUseHits.length,
    fluxCount: fluxHits.length,
    ruleFirstCount,
    costPaidCount,
    fairUnlockCount,
    scenes: sceneReports,
    issues,
  };
}
