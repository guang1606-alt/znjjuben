import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.147 角色在场感连续性检测（PRD 2.1.44——走了的人不能还在说话，死了的人不能当场复活）
 * ------------------------------------------------------------------
 * 竖屏短剧赶工最容易穿帮的不是道具，是"人在不在场"：
 *  - 林晚摔门而去，隔两行没有任何"推门回来"，她又接了一句台词（离场幽灵）；
 *  - 上一场刚咽气/身亡，中间没有抢救生还或假死反转，后一场死者本人开口说话（亡者复活）；
 *  - 电话已经挂断/忙音，角色还冲着手机"你听到没有"对答（断线幽灵通话）。
 * 本引擎专管**单稿内角色在场状态的交代是否存在**，行级触发，不需要 cast，无题材门控
 * （无台词/无离场/无死亡/无通话信号即满分放行；跨场默认由场标负责重新调度，不苛求）。
 *
 * 分工（近邻引擎边界）：
 *  - continuity-supervision(v2.139)：伤势/束缚/手机/道具等物理状态，不管人走没走
 *  - character-logic：情绪跳变/悬空人物/工具人/声口，不管在场穿帮
 *  - emotional-aftermath(v2.145)：创伤后情绪余波，装死/演戏由其豁免
 *  - location-continuity(v2.146)：空间位移合法性，本引擎只管"人是否还在现场"
 *
 * 三类问题：
 *  1) ghost_speech   同场内角色显式强离场后，无回归动作仍有本人台词
 *                    → 1 次 mid，第 2 次 high，每场每角色只算 1 次
 *  2) dead_alive     角色被明确写死（动作行），其后无抢救/生还/假死交代却再次开口
 *                    → high（同场/跨场同判），每个死者只报 1 条
 *  3) phantom_call   通话已挂断/忙音，3 行内仍像在通话里对答（窗口需有电话特征词）
 *                    → 1 次 low，第 2 次 mid
 *
 * 正信号：fairReenter（离场后给了明确回归动作再开口）+2/对 cap4。
 */

export type CpLang = 'zh' | 'en';

export interface CharacterPresenceIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'ghost_speech' | 'dead_alive' | 'phantom_call';
  evidence: string;
  advice: string;
  scene: number;
  key: string;
}

export interface CharacterPresenceSceneReport {
  index: number;
  header: string;
  flagCount: number;
}

export interface CharacterPresenceResult {
  score: number;
  sceneCount: number;
  signalCount: number;
  issueCount: number;
  /** 全稿不同说话人名个数 */
  speakerCount: number;
  /** 强离场动作次数 */
  exitCount: number;
  /** 明确死亡动作次数 */
  deathCount: number;
  /** 挂断事件次数（需前文有通话语境） */
  hangupCount: number;
  /** 离场后明确回归动作次数（正信号） */
  reenterCount: number;
  /** 离场幽灵条数 */
  ghostCount: number;
  /** 亡者复活条数 */
  deadAliveCount: number;
  /** 断线通话条数 */
  phantomCallCount: number;
  /** 合法离开-回归调度对数（同 reenterCount） */
  fairReenterCount: number;
  scenes: CharacterPresenceSceneReport[];
  issues: CharacterPresenceIssue[];
}

// —— 场景切分（复用 v2.132/v2.138/v2.139/v2.146 标题约定）——

// —— 强离场（只收高区分度动作，不收"我走了"这类可反悔的台词；挂断归③管）——
const EXIT_ZH = /摔门(?:而)?(?:去|离开|走出|走了)|夺门而出|拂袖而去|扬长而去|转身(?:就走|离开|离去|走出|走了)|愤然(?:离(?:开|去|席)|转身)|起身离开|猛地起身(?:离开|走出)?|冲(?:了)?(?:出|出去)(?:了|房门|大门|门外|房间|办公室|屋子)?|跑(?:了)?出去|推门而出|大步离开|转身上楼|上车(?:离开|走了|疾驰而去)|驱车(?:离开|离去|走远)|离(?:开|去)(?:了)?(?:房间|办公室|屋子|客厅|家门|现场|医院)|走(?:了|出)(?:房间|办公室|屋子|客厅|大门|家门)/;
const EXIT_NEG_ZH = /没(?:有)?(?:走|离开|离去)|别(?:走|离开)|不要(?:走|离开)|不许走|留(?:了)?下来|留(?:在|住)|并未(?:走|离开)|舍不得走|走不了|离不开/;
const EXIT_EN = /\b(?:stormed out|slammed the door(?: and left)?|walked out(?: of| on)?|ran out(?: of)?|rushed out(?: of)?|stormed off|marched out|stomped out|turned and left|left the room|headed for the door|drove off|sped off|disappeared through the door|exited(?: the room)?|got in the car and left)\b/i;
const EXIT_NEG_EN = /\b(?:didn'?t leave|did not leave|hadn'?t left|stayed behind|stayed put|stayed in the room|remained(?: in the room)?|couldn'?t leave)\b/i;

// —— 回归/重新入场（宽豁免：离场后出现任何进门回归动作即视为交代）——
const REENTER_ZH = /去而复返|再次出现|重新出现|又回(?:到|来|在)|回(?:来|到|进)(?:了)?(?:房间|办公室|屋|家|客厅|门口|身|现场)?|走(?:了)?进来|推(?:开)?(?:房)?门(?:而)?(?:入|进|回来)|踏(?:进|入)|冲(?:了)?进来|跑(?:了)?进来|推门而回|折(?:了)?回来|半途折回/;
const REENTER_EN = /\b(?:came back|walked back(?: in)?|returned(?: to the room)?|re-entered|reentered|stepped back in|burst back in|ran back in|reappeared|showed up again|got back|turned back around)\b/i;

// —— 明确死亡（只收确定性强的动作描写；裸"死了"不收，吓死/急死/装死等一律否定）——
const DEATH_ZH = /咽(?:了|下最后一口)?气|咽下最后一口气|断了气|气绝(?:身亡)?|停止了?呼吸|没了?呼吸|心跳停止|心脏(?:停止|骤停)|当场(?:死亡|身亡|毙命)|不治身亡|抢救无效死亡|确认死亡|已经死了|早已?(?:死亡|死去)|当场毙命|中弹身亡|倒地身亡/;
const DEATH_NEG_ZH = /假死|装死|炸死|诈死|半死|垂死|濒死|死里逃生|昏死|晕死|死去活来|死而复活/;
const DEATH_EN = /\b(?:died(?: instantly| on the spot)?|was dead|were dead|is dead|dead on arrival|killed instantly|killed on the spot|flatlined|stopped breathing|had no pulse|pronounced dead|life less body|lifeless body|breathed (?:his|her) last)\b/i;
const DEATH_NEG_EN = /\b(?:played dead|faked (?:his|her|their) death|half-dead|half dead|left for dead|near-death|near death|scared to death|bored to death)\b/i;

// —— 抢救/生还/反转（在死亡行之后出现即豁免亡者后续出场）——
const REVIVE_ZH = /抢救(?:过来|成功|回来了)?|救(?:了)?(?:回|活)|救(?:回|活)了?过来|苏醒|醒(?:了)?过来|奇迹(?:般)?(?:生还|醒来|活下来|获救)|还(?:有)?救|还活(?:着|了)|竟然没死|居然没死|活了?过来|心跳恢复|恢复(?:了)?(?:心跳|呼吸|意识)|捡回(?:一|半)条命|缓(了)?过来/;
const REVIVE_NEG_ZH = /救不活|抢救无效|没有抢救过来|没能抢救|无法生还|回天乏术/;
const REVIVE_EN = /\b(?:was saved|pulled through|came back to life|woke up from the coma|regained consciousness|survived|was alive|still alive|not actually dead|heartbeat returned|rescued and revived|brought (?:him|her) back)\b/i;
const REVIVE_NEG_EN = /\b(?:couldn'?t be saved|pronounced dead|failed to revive|did not survive|could not be revived)\b/i;

// —— 致死动作（解决"X倒在Y怀里身亡"误把Y认成死者：与名字紧邻的中枪/坠楼者才是受害者）——
const LETHAL_ZH = /中弹|中枪|中刀|身中数?(?:刀|枪)|被刺|被捅|被击中|被击毙|被枪杀|被砍(?:杀|伤|中)|坠楼|坠崖|坠江|坠海|溺水|中毒|遇袭|被撞|被车撞|车(?:祸|撞)/;
const LETHAL_EN = /\b(?:shot|stabbed|gunned down|hit by|struck by|fell from|drowned|poisoned|took a bullet|caught the bullet|ambushed|run over|gunned)\b/i;

// —— 通话语境 / 挂断 / 重拨 / 窗口内通话特征 ——
const CALL_ZH = /打电话|拨通|拨了?号码|接起电话|接听(?:电话)?|来电|电话(?:里|中|那头|声)|视频通话|视频电话|手机响|响了?起来|打(?:来|过)电话|回了?个?电话|手机贴(?:在|着)耳边|接通/;
const CALL_EN = /\b(?:on the phone|phone call|called (?:him|her|them)|picked up the phone|answered the call|video call|incoming call|rang (?:him|her|them)|phone rang|put the phone to (?:his|her) ear|got through)\b/i;
const HANGUP_ZH = /挂断(?:了)?(?:电话)?|挂(?:断|掉)(?:了)?(?:电话)?|挂了电话|挂了手机|通话结束|电话那头没了?声音|忙音|嘟嘟(?:声|地响)|手机离开耳边/;
const HANGUP_NEG_ZH = /没(?:有)?挂|不肯挂|不愿挂|舍不得挂|没有挂断/;
const HANGUP_EN = /\b(?:hung up|ended the call|call ended|line went dead|disconnected|dial tone|busy signal|cut the call)\b/i;
const HANGUP_NEG_EN = /\b(?:didn'?t hang (?:up)?|did not hang up|refused to hang up|wouldn'?t hang up)\b/i;
const RESUME_ZH = /重新打(?:来|过|过来)?|又打(?:来|过|过来)?|回拨(?:了)?(?:过去|电话)?|再次拨通|视频又(?:打|响)|电话又(?:打|响)|手机再次响起/;
const RESUME_EN = /\b(?:called (?:him|her|them) back|rang (?:him|her) again|called again|reconnected|new call came in|phone rang again)\b/i;
const PHONE_TALK_ZH = /电话|手机|那头|听到(?:吗|没有|没)|你在听(?:吗|我说)?|还在吗|说话啊|听我(?:说|把)|信号不好|喂[，,。、]?|听见(?:我|没)/;
const PHONE_TALK_EN = /\b(?:can you hear me|are you (?:still )?there|you (?:there|listening)|on the line|through the phone|hello\?|you hear me)\b/i;

interface CpRow {
  line: number;
  text: string;
  speaker: string | null;
}

interface SceneBlock {
  index: number;
  header: string;
  rows: CpRow[];
  report: CharacterPresenceSceneReport;
}

const adviceMap = {
  ghost: {
    zh: '角色已明确离场（摔门/转身走出/跑走），同场没有任何回归动作就又开口说话。补一个去而复返的动作（推门进来/回到房间），或删掉离场后他的台词。',
    en: 'The character clearly exited (stormed out / slammed the door / ran off) but speaks again in the same scene with no re-entry beat. Add a return action (opens the door, walks back in) or cut the post-exit lines.',
  },
  dead: {
    zh: '角色已被写成死亡（咽气/身亡/停止呼吸），之后没有任何抢救生还或假死反转交代，本人却再次开口说话。死亡是最高级穿帮：补抢救生还过程，或删掉亡者台词。',
    en: 'A character written as dead (died / flatlined / pronounced dead) speaks again with no rescue, survival or fake-death beat in between. Death is the hardest continuity break: add a survival beat or cut the lines.',
  },
  call: {
    zh: '电话已经挂断（挂断/忙音/通话结束），角色却还像在通话里对答。补一个重新拨通/又打来的动作，或让角色放下手机改成与身边人的面对面戏。',
    en: 'The call was ended (hung up / dial tone / disconnected) yet characters keep talking as if still on the line. Add a re-dial beat or stage the exchange face to face after putting the phone down.',
  },
};

export function characterPresenceCheck(text: string, lang: CpLang = 'zh'): CharacterPresenceResult {
  const isZh = lang === 'zh';
  const EXIT = isZh ? EXIT_ZH : EXIT_EN;
  const EXIT_NEG = isZh ? EXIT_NEG_ZH : EXIT_NEG_EN;
  const REENTER = isZh ? REENTER_ZH : REENTER_EN;
  const DEATH = isZh ? DEATH_ZH : DEATH_EN;
  const DEATH_NEG = isZh ? DEATH_NEG_ZH : DEATH_NEG_EN;
  const REVIVE = isZh ? REVIVE_ZH : REVIVE_EN;
  const REVIVE_NEG = isZh ? REVIVE_NEG_ZH : REVIVE_NEG_EN;
  const CALL = isZh ? CALL_ZH : CALL_EN;
  const HANGUP = isZh ? HANGUP_ZH : HANGUP_EN;
  const HANGUP_NEG = isZh ? HANGUP_NEG_ZH : HANGUP_NEG_EN;
  const RESUME = isZh ? RESUME_ZH : RESUME_EN;
  const PHONE_TALK = isZh ? PHONE_TALK_ZH : PHONE_TALK_EN;
  const LETHAL = isZh ? LETHAL_ZH : LETHAL_EN;

  const empty: CharacterPresenceResult = {
    score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
    speakerCount: 0, exitCount: 0, deathCount: 0, hangupCount: 0, reenterCount: 0,
    ghostCount: 0, deadAliveCount: 0, phantomCallCount: 0, fairReenterCount: 0,
    scenes: [], issues: [],
  };

  const clean = (text ?? '').replace(/\r\n?/g, '\n');
  if (!clean.trim() || clean.trim().length < 20) return empty;

  /** 说话人提取（复用 dialogue-functionality 约定；动作行/场标返回 null） */
  const extractSpeaker = (t: string): string | null => {
    const cn = t.match(/^([^\s:：△（()【】[\]]{2,8})(?:[（(][^）)]*[）)])?\s*[:：]\s*(\S.*)$/);
    if (cn) return cn[1];
    const en = t.match(/^([A-Z][A-Za-z .'-]{1,20}?)\s*(?:\([^)]*\))?\s*:\s*(\S.*)$/);
    if (en) return en[1].trim();
    return null;
  };

  // ---------- 切场 ----------
  const blocks: SceneBlock[] = [];
  let cur: SceneBlock | null = null;
  let globalLine = 0;
  const allSpeakerNames = new Set<string>();
  clean.split('\n').forEach((raw) => {
    const t = raw.trim();
    if (isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      cur = {
        index: blocks.length + 1,
        header: t.slice(0, 24) || `S${blocks.length + 1}`,
        rows: [],
        report: { index: blocks.length + 1, header: t.slice(0, 24) || `S${blocks.length + 1}`, flagCount: 0 },
      };
      blocks.push(cur);
      return;
    }
    if (!t) return;
    globalLine += 1;
    if (!cur) {
      cur = {
        index: 1,
        header: `S1`,
        rows: [],
        report: { index: 1, header: `S1`, flagCount: 0 },
      };
      blocks.push(cur);
    }
    const speaker = extractSpeaker(t);
    if (speaker) allSpeakerNames.add(speaker);
    cur.rows.push({ line: globalLine, text: t, speaker });
  });

  const issues: CharacterPresenceIssue[] = [];
  let exitCount = 0;
  let deathCount = 0;
  let hangupCount = 0;
  let reenterCount = 0;
  let ghostCount = 0;
  let deadAliveCount = 0;
  let phantomCount = 0;

  // 全局名表按长度降序（alternation 最长优先），英文动作行为 Title Case、说话标签为大写 → 匹配不区分大小写
  const sortedNames = Array.from(allSpeakerNames).sort((a, b) => b.length - a.length);
  const canonMap = new Map<string, string>();
  sortedNames.forEach((n) => canonMap.set(n.toLowerCase(), n));
  /** 动作行中出现、但尚未有台词的动态角色名（如死者"老张"在身亡前没说过话） */
  const dynamicNames: string[] = [];
  interface NamePos { canon: string; s: number; e: number }
  const namePositions = (t: string, extra: string[] = []): NamePos[] => {
    const all = sortedNames.concat(extra.filter((x) => !sortedNames.includes(x)));
    if (!all.length) return [];
    const alt = all.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(alt, isZh ? 'g' : 'gi');
    const out: NamePos[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      out.push({ canon: canonMap.get(m[0].toLowerCase()) ?? m[0], s: m.index, e: m.index + m[0].length });
      if (m[0] === '') re.lastIndex += 1;
    }
    return out;
  };

  /**
   * 从动作行动态提取"尚未有台词的受害者"姓名（死者可能从未在台词中出现）：
   *  - 中：致死动作/死亡词前 5 字符内的 2-4 个汉字（去把被在的等介词尾），如"老张中弹""老王当场身亡"
   *  - 英：致死动作前 25 字符内最近的 Title Case 姓名，如"Old Zhang was shot"
   * 返回 null 表示前面只有代词（他/he）或无主语，调用方可安全回退最近说话人。
   */
  const PARTICLE_TAIL_ZH = /[在把被了着的向朝让和与跟看听见使给]+$/;
  const PRONOUN_ZH = /^[他她它你我人那这]/;
  const extractSubjectBefore = (t: string, kwRe: RegExp): string | null => {
    if (isZh) {
      let m: RegExpExecArray | null;
      kwRe.lastIndex = 0;
      while ((m = kwRe.exec(t))) {
        const tail = t.slice(Math.max(0, m.index - 5), m.index);
        const mm = tail.match(/[\u4e00-\u9fa5]{2,4}$/);
        if (!mm) continue;
        let token = mm[0].replace(PARTICLE_TAIL_ZH, '');
        if (token.length < 2 || PRONOUN_ZH.test(token)) continue;
        return token;
      }
      return null;
    }
    // 句首代词/冠词不得当作人名（"...lifeless. He had died" 中的 He）
    const PRONOUN_EN = new Set([
      'he', 'she', 'they', 'it', 'him', 'her', 'them', 'his', 'their', 'its',
      'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'a', 'an', 'the',
      'this', 'that', 'these', 'those', 'who', 'whom', 'someone', 'anyone', 'everyone',
    ]);
    let m: RegExpExecArray | null;
    kwRe.lastIndex = 0;
    while ((m = kwRe.exec(t))) {
      const tail = t.slice(Math.max(0, m.index - 28), m.index);
      const mm = tail.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:was|were|had been|had|been)?\s*$/);
      // 多词名（Old Zhang）只查首词；单词名自身不得是代词
      if (mm && !PRONOUN_EN.has(mm[1].split(' ')[0].toLowerCase())) return mm[1];
    }
    return null;
  };

  /**
   * 动作行角色归属（离场/死亡共用）：
   *  a) 死亡/离场关键词前 6（英 10）字符内紧邻的名字优先（"陈峰看着林晚咽气"→林晚）
   *  b) 死亡专用：与致死动作同小句紧邻的名字（"老张中弹，倒在陈峰怀里，身亡"→老张）
   *  c) 第一个动词之前最早出现的名字（动词之后的"怀里只剩陈峰"不可能是主语）
   *  d) 都不是 → null（由调用方回退最近说话人或动态提取）
   */
  const attributeWho = (
    t: string,
    kind: 'exit' | 'death',
    extra: string[] = [],
    useEarliest = true,
  ): string | null => {
    const poss = namePositions(t, extra);
    if (!poss.length) return null;
    const kwRe = new RegExp((kind === 'death' ? DEATH : EXIT).source, isZh ? 'g' : 'gi');
    let m: RegExpExecArray | null;
    const firstKw = kwRe.exec(t);
    kwRe.lastIndex = 0;
    const near = isZh ? 6 : 10;
    const clausePunct = isZh ? /[，。；！？、]/ : /[,.;!?:]/;
    // a) 关键词前紧邻名字（同小句：中间不得有逗号/句号等隔断）
    while ((m = kwRe.exec(t))) {
      const idx = m.index;
      const cand = poss.filter(
        (p) => p.e <= idx && idx - p.e <= near && !clausePunct.test(t.slice(p.e, idx)),
      );
      if (cand.length) return cand.sort((x, y) => y.e - x.e)[0].canon;
    }
    if (kind === 'death') {
      // b) 致死动作：名字在前 8 字符内（同小句），或名字紧随其后 4 字符内
      const leRe = new RegExp(LETHAL.source, isZh ? 'g' : 'gi');
      while ((m = leRe.exec(t))) {
        const idx = m.index;
        const end = idx + m[0].length;
        const before = poss.filter(
          (p) => p.e <= idx && idx - p.e <= 8 && !clausePunct.test(t.slice(p.e, idx)),
        );
        if (before.length) return before.sort((x, y) => y.e - x.e)[0].canon;
        // 后窗必须同小句："中弹，倒在陈峰怀里"中陈峰在逗号之后，不是中弹者
        const after = poss.filter(
          (p) => p.s >= end && p.s - end <= 4 && !clausePunct.test(t.slice(end, p.s)),
        );
        if (after.length) return after.sort((x, y) => x.s - y.s)[0].canon;
      }
    }
    // c) 第一个动词之前最早出现的名字（动词后出现的不可能是施事者；死亡路径默认关闭，先走动态提取）
    if (useEarliest && firstKw) {
      const before = poss.filter((p) => p.e <= firstKw.index).sort((x, y) => x.s - y.s);
      if (before.length) return before[0].canon;
    }
    return null;
  };

  /** 致死动作/死亡词前的未知姓名主语；命中已知说话人则归一为 canon */
  const pickDynamicVictim = (t: string): string | null => {
    const leRe = new RegExp(LETHAL.source, isZh ? 'g' : 'gi');
    const dRe = new RegExp(DEATH.source, isZh ? 'g' : 'gi');
    const tok = extractSubjectBefore(t, leRe) ?? extractSubjectBefore(t, dRe);
    if (!tok) return null;
    return canonMap.get(tok.toLowerCase()) ?? tok;
  };

  // 全局死亡表（跨场复活检测）：who=展示名/匹配名，alias=英文小写别名（动作者可能是 Title Case 全名）
  const deaths: Array<{ who: string; alias: string; line: number; scene: number; closed: boolean }> = [];
  const reviveLines: number[] = [];
  let lastSpk: { who: string; line: number } | null = null;

  blocks.forEach((blk) => {
    // ① 本块未闭合离场事件
    const openExits: Array<{ who: string; line: number }> = [];
    // ③ 本块通话状态
    let callSeen = false;
    const hangEvents: number[] = [];

    blk.rows.forEach((r) => {
      // —— 通话/挂断信号（台词或动作行均可建立语境）——
      if (CALL.test(r.text)) callSeen = true;
      if (!r.speaker && HANGUP.test(r.text) && !HANGUP_NEG.test(r.text) && callSeen) {
        hangEvents.push(r.line);
        hangupCount += 1;
      }
      // —— 生还/抢救信号（死亡行之后出现即救活所有未闭合死者）——
      if (REVIVE.test(r.text) && !REVIVE_NEG.test(r.text)) reviveLines.push(r.line);

      if (r.speaker) {
        // 亡者匹配：中文精确等名；英文动作行 Title Case 全名按单词边界包含说话标签
        const isDeadWho = (d: { who: string; alias: string }, spk: string): boolean => {
          if (d.who === spk) return true;
          if (isZh) return false;
          const esc = spk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase();
          return new RegExp(`\\b${esc}\\b`).test(d.alias);
        };
        // ② 亡者复活（同场/跨场统一：死亡行与本行之间有 REVIVE 即豁免）
        for (const d of deaths) {
          if (d.closed || !isDeadWho(d, r.speaker) || d.line >= r.line) continue;
          const revived = reviveLines.some((l) => l > d.line && l < r.line);
          if (revived) {
            d.closed = true; // 已合法生还，不再追究
            break;
          }
          d.closed = true;
          deadAliveCount += 1;
          issues.push({
            severity: 'high',
            type: 'dead_alive',
            evidence: isZh
              ? `第${blk.index}场：${r.speaker}已死亡却开口：${r.text.slice(0, 26)}`
              : `Scene ${blk.index}: ${r.speaker} speaks after death: ${r.text.slice(0, 46)}`,
            advice: isZh ? adviceMap.dead.zh : adviceMap.dead.en,
            scene: blk.index,
            key: `dead_s${blk.index}_${r.speaker}`,
          });
          break;
        }

        // ① 离场幽灵：本人有未闭合离场事件
        const openIdx = openExits.findIndex((e) => e.who === r.speaker);
        if (openIdx >= 0) {
          ghostCount += 1;
          issues.push({
            severity: ghostCount >= 2 ? 'high' : 'mid',
            type: 'ghost_speech',
            evidence: isZh
              ? `第${blk.index}场：${r.speaker}离场后仍有台词：${r.text.slice(0, 26)}`
              : `Scene ${blk.index}: ${r.speaker} speaks after exiting: ${r.text.slice(0, 46)}`,
            advice: isZh ? adviceMap.ghost.zh : adviceMap.ghost.en,
            scene: blk.index,
            key: `ghost_s${blk.index}_${r.speaker}`,
          });
          openExits.splice(openIdx, 1); // 每场每角色只报 1 次，事件消费
        }

        lastSpk = { who: r.speaker, line: r.line };
        return;
      }

      // —— 以下为非台词动作行 ——
      // ① 强离场归属：行内含角色全名 → 该角色；否则回退最近 2 行内的说话人
      if (EXIT.test(r.text) && !EXIT_NEG.test(r.text)) {
        let who = attributeWho(r.text, 'exit');
        if (!who && lastSpk && r.line - lastSpk.line <= 2) who = lastSpk.who;
        if (who) {
          openExits.push({ who, line: r.line });
          exitCount += 1;
        }
      }
      // ① 回归动作：宽豁免，清除本场全部未闭合离场，计合法调度
      if (REENTER.test(r.text) && openExits.length > 0) {
        reenterCount += openExits.length;
        openExits.length = 0;
      }
      // ② 死亡归属（台词宣告死亡不归属，防归到医生）：
      //    a 紧邻死者名 → 致死动作前动态姓名（含未出场新人）→ c 行内已知最早名 → 代词行回退最近说话人
      if (DEATH.test(r.text) && !DEATH_NEG.test(r.text)) {
        let who = attributeWho(r.text, 'death', dynamicNames, false);
        let dynamic = false;
        if (!who) {
          const tok = pickDynamicVictim(r.text);
          if (tok) {
            who = tok;
            dynamic = !sortedNames.includes(tok);
          }
        }
        if (!who) who = attributeWho(r.text, 'death', dynamicNames, true);
        // 行内死亡词前已有名状主语（即使是不认识的新人）→ 不许偷拿最近说话人
        if (!who && lastSpk && r.line - lastSpk.line <= 2 && !pickDynamicVictim(r.text)) {
          who = lastSpk.who;
        }
        if (who) {
          deaths.push({ who, alias: who.toLowerCase(), line: r.line, scene: blk.index, closed: false });
          if (dynamic && !dynamicNames.includes(who)) dynamicNames.push(who);
          deathCount += 1;
        }
      }
    });

    // ③ 挂断后 3 行窗口：≥2 个不同角色对答 + 至少 1 条通话特征词，且无重拨交代
    for (const h of hangEvents) {
      const win = blk.rows.filter((r) => r.line > h && r.line <= h + 3 && r.speaker);
      const between = blk.rows.some((r) => r.line > h && r.line <= h + 3 && RESUME.test(r.text));
      if (between) continue;
      const speakers = new Set(win.map((r) => r.speaker));
      const stillOnCall = win.some((r) => PHONE_TALK.test(r.text));
      if (speakers.size >= 2 && stillOnCall) {
        phantomCount += 1;
        const hangRow = blk.rows.find((r) => r.line === h);
        issues.push({
          severity: phantomCount >= 2 ? 'mid' : 'low',
          type: 'phantom_call',
          evidence: isZh
            ? `第${blk.index}场：${(hangRow?.text ?? '').slice(0, 34)}`
            : `Scene ${blk.index}: ${(hangRow?.text ?? '').slice(0, 60)}`,
          advice: isZh ? adviceMap.call.zh : adviceMap.call.en,
          scene: blk.index,
          key: `call_s${blk.index}_${h}`,
        });
      }
    }
  });

  // push 上限：ghost/dead 各最多 2 条，phantom 最多 2 条（计数保留全量）
  const capByType: Record<string, number> = { ghost_speech: 2, dead_alive: 2, phantom_call: 2 };
  const pushedCount: Record<string, number> = { ghost_speech: 0, dead_alive: 0, phantom_call: 0 };
  const finalIssues = issues
    .filter((i) => {
      if (pushedCount[i.type] >= capByType[i.type]) return false;
      pushedCount[i.type] += 1;
      return true;
    })
    .sort((a, b) => {
      const w = { high: 0, mid: 1, low: 2 } as const;
      if (w[a.severity] !== w[b.severity]) return w[a.severity] - w[b.severity];
      if (a.scene !== b.scene) return a.scene - b.scene;
      return a.key.localeCompare(b.key);
    });

  // 旗标回写场景报告
  finalIssues.forEach((i) => {
    const blk = blocks.find((b) => b.index === i.scene);
    if (blk) blk.report.flagCount += 1;
  });

  // 计分：ghost 首条 12、其后 10/条 cap22，dead 18/条 cap24，call 7/13 cap13；fairReenter +2/对 cap4
  let penalty = 0;
  const ghosts = issues.filter((i) => i.type === 'ghost_speech').length;
  for (let i = 0; i < ghosts; i += 1) penalty += i === 0 ? 12 : 10;
  penalty = Math.min(penalty, 22);
  penalty += Math.min(deadAliveCount * 18, 24);
  penalty += phantomCount === 0 ? 0 : (phantomCount === 1 ? 7 : 13);
  const bonus = Math.min(reenterCount * 2, 4);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty + bonus)));

  return {
    score,
    sceneCount: blocks.length,
    signalCount: exitCount + deathCount + hangupCount + reenterCount,
    issueCount: finalIssues.length,
    speakerCount: allSpeakerNames.size,
    exitCount,
    deathCount,
    hangupCount,
    reenterCount,
    ghostCount: ghosts,
    deadAliveCount,
    phantomCallCount: phantomCount,
    fairReenterCount: reenterCount,
    scenes: blocks.map((b) => b.report),
    issues: finalIssues,
  };
}
