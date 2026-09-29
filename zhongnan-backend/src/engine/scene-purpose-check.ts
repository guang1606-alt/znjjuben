import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.137 场景目的效率检测器（Scene Purpose Check）
 *
 * 竖屏短剧的场景经济学：一场只干一件事，一件事只在一场干。与 v2.132 的分工：
 * - v2.132 scene-padding-check：场景"空不空"（三无空转/复述/寒暄/拖堂，密度维度）
 * - v2.137 scene-purpose-check（本引擎）：场景"准不准、省不省"（目的维度）
 *
 * 五类判定（五个目的簇：交代 exposition / 冲突 conflict / 决定 decision / 情感 romance / 揭晓 reveal）：
 * 1. multi_purpose_scene（单场 mid，≥2 场 high）目的稀释：短场（6-13 行）里撞到 ≥3 个目的簇，
 *    且其中 ≥2 个只有 1 次浅命中——每件事都点一下就走，没有一件演透。高潮场（长场、多强命中）
 *    天然豁免，那是"摊牌+揭晓+决裂"应有的汇流，不是稀释。
 * 2. duplicate_purpose（1 对 mid，≥2 对 high）重复目的场：两个薄场（各自推进信号 ≤3）主导目的相同、
 *    共享具体话题词（如同为"交代·遗嘱"、"交代·车祸"），且第二场没有升级动作——把同一件事讲两遍。
 * 3. late_purpose（mid）目的迟到：≥8 行的场景，第一个目的信号出现在 55% 之后，前面全是寒暄/动作铺垫。
 *    区别于 v2.132 slow_open：那个只查全片开头 15%，本引擎查每一场的进戏速度。
 * 4. weak_exit（low）软收尾：场景前面有目的推进，最后 25% 却落在"慢走/再见/改天再聊"上，
 *    没有决定/钩子砸在结尾——场没落点。区别于 v2.132 draggy_tail：那个查全片结尾，本引擎查每场。
 *
 * 正信号：单目的 + 末 30% 有推进落地的"干净场"每场回补 1 分（封顶 4）。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type SpLang = 'zh' | 'en';

export type PurposeKey = 'exposition' | 'conflict' | 'decision' | 'romance' | 'reveal';

export interface ScenePurposeIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'multi_purpose_scene' | 'duplicate_purpose' | 'late_purpose' | 'weak_exit';
  evidence: string;
  advice: string;
}

export interface ScenePurposeReport {
  /** 场景序号（1 起） */
  index: number;
  header: string;
  lineCount: number;
  /** 命中的目的簇 */
  purposes: PurposeKey[];
  /** 主导目的簇（命中数最多） */
  dominant: PurposeKey | null;
  /** 各簇命中次数 */
  hits: Record<PurposeKey, number>;
  /** 命中的具体话题词（用于跨场指纹去重） */
  fingerprint: string[];
  /** 第一个目的信号出现的行位比 0-1（无信号为 1） */
  firstPurposeRatio: number;
  /** 末 30% 行内是否有推进落地 */
  lands: boolean;
}

export interface ScenePurposeResult {
  score: number;
  sceneCount: number;
  purposefulSceneCount: number;
  multiPurposeCount: number;
  duplicatePairCount: number;
  latePurposeCount: number;
  weakExitCount: number;
  /** 干净利落的单目的落地场数（正信号） */
  focusedLandedCount: number;
  scenes: ScenePurposeReport[];
  issues: ScenePurposeIssue[];
}

// —— 中文目的簇信号库（簇间刻意错开，只用多字词——裸单字误伤教训）——
const EXPO_ZH = /(?:当年(?:的事|你爸|你妈|那场|那笔)?|小时候|那一年|那时候|身世|来历|出身|家族(?:的)?(?:旧事|恩怨|规矩)?|事情是这样(?:的)?|其实这些年|我一直没(?:敢)?告诉你|你不知道的是|背景(?:资料|调查)?|来龙去脉|前因后果|遗嘱(?:里|的)?(?:内容|事)?|遗产(?:的事)?|车祸(?:的)?(?:真相|事|经过)?|破产(?:的)?(?:原因|事|经过)?|当年(?:那场)?(?:火灾|事故)|旧事|往事|从头说起|跟你讲讲(?:以前|当年))/g;
const CONFLICT_ZH = /(?:争吵|吵架|大吵|质问|你凭什么|凭什么(?:管|拦|说)|胡说|放屁|闭嘴|你给我滚|威胁|摊牌|撕破脸|对峙|指责|控诉|兴师问罪|给我一个解释|算账|冷冷(?:地)?(?:说|道)|冷笑(?:一声|道)?|拍(?:了)?桌子|摔门|怒视|瞪着(?:他|她)|冲(?:他|她)吼|破口大骂|羞辱|嘲讽(?:道)?|讥(?:笑|讽))/g;
const DECISION_ZH = /(?:我决定|决定了|签字|签了|按手印|辞职|离职|离婚|退婚|解约|取消(?:婚礼|合作)|报警|立案|起诉|收购(?:方案|计划)?|动手(?:吧)?|现在就去|马上出发|我答应(?:你)?|我拒绝|开除|解雇|下令|命令(?:道)?|冻结(?:账户|资产)|转让股权|发布(?:声明|会上)|召开(?:发布会|董事会))/g;
const ROMANCE_ZH = /(?:表白|告白|求婚|嫁给我|娶你|我喜欢你|我爱你|在一起|复合|亲吻|吻(?:了|住|上)|拥抱|抱(?:住|紧)他|心动|心跳(?:加速)?|约会|牵手|依偎|脸红(?:了)?|轻声(?:说|道).{0,6}喜欢)/g;
const REVEAL_ZH = /(?:真相(?:大白)?|证据(?:确凿)?|录音(?:笔|文件|里)?|录像(?:带|画面|里)?|亲子鉴定|DNA(?:报告)?|遗嘱(?:出现|公布|揭晓|公开)|揭穿|戳穿|拆穿|暴露(?:身份)?|身份(?:曝光|揭晓|暴露)|真面目|原来(?:你|这|一切|事情)|竟然(?:是|有)|没想到(?:你|他|她)(?:就是|竟然)|伪装|假面具|卧底|幕后黑手(?:是)?|监控(?:录像|画面)?|病历(?:单|报告)?|诊断书)/g;

// —— 英文目的簇信号库 ——
const EXPO_EN = /\b(?:back then|when (?:we|you|she|he) (?:were|was) young|as a child|growing up|the truth about (?:his|her|their) past|family history|backstory|here'?s what happened|the whole story|how it all started|i never told you|what you don'?t know|the real story|years ago(?:,| when)?|that year|the old days|the will said|about the accident|why (?:we|the company) went bankrupt|let me explain from the beginning)\b/gi;
const CONFLICT_EN = /\b(?:argued|arguing|shouted at|yelled at|how dare you|shut up|get out|threatened|confronted|confrontation|accused (?:him|her|them) of|blamed|demanded answers|sneered|slammed the table|stormed|glared at|snapped|insulted|humiliated|mocked|raised (?:his|her) voice|furious)\b/gi;
const DECISION_EN = /\b(?:i'?ve decided|i decided|signed the papers|sign here|press (?:my )?fingerprint|quit(?:ting)? (?:my job)?|resign(?:ed)?|divorce(?:d)?|call off the wedding|called the police|press charges|sued|file a lawsuit|acquisition|let'?s do it now|moving out now|i accept|i refuse|fired (?:him|her)|ordered|froze the accounts|transfer(?:red)? the shares|press conference|board meeting)\b/gi;
const ROMANCE_EN = /\b(?:confessed (?:his|her) feelings|proposed|marry me|i love you|i like you|be together|got back together|kissed (?:him|her)|hugged (?:him|her) tightly|embraced|heart raced|heart skipped|date night|held hands|snuggled|blushed|first love)\b/gi;
const REVEAL_EN = /\b(?:the truth(?: is| came out)?|the evidence|the recording|security footage|paternity test|dna (?:test|report)|the will is revealed|exposed|unmasked|revealed (?:his|her) identity|real identity|true face|it turned out(?: to be)?|turned out (?:you|he|she) was|disguise|undercover|mastermind|medical record|diagnosis|the secret(?: is out)?)\b/gi;

// —— 跨场重复指纹：话题词根（同一件事在两场重复 = 同根；后缀写法不影响归并）——
const ROOT_ZH: Record<PurposeKey, RegExp> = {
  exposition: /(?:遗嘱|遗产|车祸|破产|火灾|事故|身世|当年|小时候|家族|往事|旧事)/g,
  conflict: /(?:合同|股份|孩子|儿子|女儿|钱|房|出轨)/g,
  decision: /(?:离婚|退婚|辞职|报警|起诉|收购|解约|开除|签字)/g,
  romance: /(?:喜欢|爱|嫁|娶|复合|表白|求婚)/g,
  reveal: /(?:亲子鉴定|录音|录像|监控|真相|身份|病历|诊断|遗嘱|证据)/g,
};
const ROOT_EN: Record<PurposeKey, RegExp> = {
  exposition: /\b(?:will|accident|bankrupt|years ago|backstory|family|as a child|growing up|the old days)\b/gi,
  conflict: /\b(?:contract|shares?|child|son|daughter|money|affair)\b/gi,
  decision: /\b(?:divorce|wedding|quit|resign|police|lawsuit|sued|acquisition|fired|signed)\b/gi,
  romance: /\b(?:love|marry|proposed|together|kiss)\b/gi,
  reveal: /\b(?:paternity|recording|footage|truth|identity|medical|diagnosis|will|evidence)\b/gi,
};

// 寒暄/铺垫（目的迟到的前段判定）
const FILLER_ZH = /(?:你好|早上好|早啊|晚上好|欢迎光临|请坐|随便坐|别客气|喝点(?:水|茶|咖啡)|今天天气|一路辛苦了|吃了吗|最近怎么样|好久不见|请进|坐吧|先坐下|倒(?:了杯|上)(?:水|茶))/g;
const FILLER_EN = /\b(?:hello|good morning|good evening|welcome|please sit|take a seat|make yourself comfortable|would you like (?:some )?(?:tea|coffee|water)|nice weather|you made it|how have you been|long time no see|come in|sit down|poured (?:some )?(?:tea|coffee))\b/gi;

// 软收尾词：场落在这些话上=没有决定/钩子砸尾
const EXIT_ZH = /(?:慢走|不送|再见|改天(?:再聊|再聚|再说|请你)|有空再聊|我先回去了|回去吧|早点休息|时候不早了|今天先这样|那就这样吧|散了吧|都散了|回去等消息|等通知)/g;
const EXIT_EN = /\b(?:see you|goodbye|good night|take care|drive safe|another time|let'?s talk soon|i should get going|head back|get some rest|it'?s getting late|let'?s call it a night|we'?re done here|go on home|wait for (?:my )?notice)\b/gi;

const PURPOSE_KEYS: PurposeKey[] = ['exposition', 'conflict', 'decision', 'romance', 'reveal'];
const PURPOSE_LABEL_ZH: Record<PurposeKey, string> = {
  exposition: '交代背景',
  conflict: '正面冲突',
  decision: '决定行动',
  romance: '情感推进',
  reveal: '反转揭晓',
};
const PURPOSE_LABEL_EN: Record<PurposeKey, string> = {
  exposition: 'exposition',
  conflict: 'confrontation',
  decision: 'decision/action',
  romance: 'romance',
  reveal: 'reveal',
};


const clamp = (n: number) => Math.max(0, Math.min(100, n));

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

interface SplitScene {
  header: string;
  lines: string[];
}

function splitScenes(text: string, lang: SpLang): SplitScene[] {
  const isHeader = (line: string) => {
    const t = line.trim();
    if (!t) return false;
    return isSceneHeaderLine(t, lang); // c213：收口共享切分器
  };
  const scenes: SplitScene[] = [];
  let cur: SplitScene | null = null;
  for (const raw of text.split('\n')) {
    if (isHeader(raw)) {
      if (cur) scenes.push(cur);
      cur = { header: raw.trim(), lines: [] };
    } else if (cur && raw.trim()) {
      cur.lines.push(raw.trim());
    }
  }
  if (cur) scenes.push(cur);
  return scenes;
}

/**
 * v2.137 场景目的效率检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function scenePurposeCheck(text: string, lang: SpLang = 'zh'): ScenePurposeResult {
  const empty: ScenePurposeResult = {
    score: 100,
    sceneCount: 0,
    purposefulSceneCount: 0,
    multiPurposeCount: 0,
    duplicatePairCount: 0,
    latePurposeCount: 0,
    weakExitCount: 0,
    focusedLandedCount: 0,
    scenes: [],
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const BANKS: Record<PurposeKey, RegExp> = isZh
    ? { exposition: EXPO_ZH, conflict: CONFLICT_ZH, decision: DECISION_ZH, romance: ROMANCE_ZH, reveal: REVEAL_ZH }
    : { exposition: EXPO_EN, conflict: CONFLICT_EN, decision: DECISION_EN, romance: ROMANCE_EN, reveal: REVEAL_EN };
  const FILLER = isZh ? FILLER_ZH : FILLER_EN;
  const EXIT = isZh ? EXIT_ZH : EXIT_EN;
  const ROOT = isZh ? ROOT_ZH : ROOT_EN;
  const LABEL = isZh ? PURPOSE_LABEL_ZH : PURPOSE_LABEL_EN;

  const rawScenes = splitScenes(text, lang);
  if (rawScenes.length === 0) return empty;

  const reports: ScenePurposeReport[] = [];
  rawScenes.forEach((sc, i) => {
    const body = sc.lines.join('\n');
    const hits: Record<PurposeKey, number> = { exposition: 0, conflict: 0, decision: 0, romance: 0, reveal: 0 };
    const fpAll: string[] = [];
    for (const k of PURPOSE_KEYS) {
      hits[k] = matchAll(body, BANKS[k]).length;
      // 跨场指纹用词根归一化："遗嘱/遗嘱的事/遗嘱里"都归到同一根
      fpAll.push(...Array.from(new Set(matchAll(body, ROOT[k]).map((s) => isZh ? s : s.toLowerCase()))).map((root) => `${k}:${root}`));
    }
    const purposes = PURPOSE_KEYS.filter((k) => hits[k] > 0);
    let dominant: PurposeKey | null = null;
    let domHits = 0;
    for (const k of PURPOSE_KEYS) {
      if (hits[k] > domHits) {
        domHits = hits[k];
        dominant = k;
      }
    }

    // 行位扫描：第一个目的信号、末 30% 落地、寒暄前置、软收尾
    const n = sc.lines.length;
    let firstPurposeIdx = -1;
    let fillerBefore = 0;
    for (let li = 0; li < n; li++) {
      const hitAny = PURPOSE_KEYS.some((k) => {
        BANKS[k].lastIndex = 0;
        return BANKS[k].test(sc.lines[li]);
      });
      if (hitAny && firstPurposeIdx === -1) firstPurposeIdx = li;
      if (firstPurposeIdx === -1) {
        FILLER.lastIndex = 0;
        if (FILLER.test(sc.lines[li])) fillerBefore++;
      }
    }
    const firstPurposeRatio = firstPurposeIdx === -1 ? 1 : firstPurposeIdx / n;
    const tailStart = Math.floor(n * 0.7);
    const tail = sc.lines.slice(tailStart).join('\n');
    const tailHasPurpose = PURPOSE_KEYS.some((k) => {
      BANKS[k].lastIndex = 0;
      return BANKS[k].test(tail);
    });
    const lands = tailHasPurpose;
    const endsSoft = (() => {
      EXIT.lastIndex = 0;
      return EXIT.test(tail);
    })();

    reports.push({
      index: i + 1,
      header: sc.header,
      lineCount: n,
      purposes,
      dominant,
      hits,
      fingerprint: Array.from(new Set(fpAll)),
      firstPurposeRatio,
      lands,
      // 附带内部判定用的瞬态字段挂在报告上（类型不外露额外字段，用闭包 map 另存）
    });
    // 软收尾/寒暄等瞬态另建并行结构
    internal.set(reports[reports.length - 1], { fillerBefore, endsSoft, domHits, body });
  });

  // —— 逐场判定 ——
  const multiScenes: ScenePurposeReport[] = [];
  const lateScenes: ScenePurposeReport[] = [];
  const weakScenes: ScenePurposeReport[] = [];
  const focusedLandedScenes: ScenePurposeReport[] = [];

  for (const r of reports) {
    const intern = internal.get(r)!;
    const totalHits = PURPOSE_KEYS.reduce((s, k) => s + r.hits[k], 0);
    const thinPurposes = r.purposes.filter((k) => r.hits[k] === 1).length;

    // 多目的稀释：≥3 簇、≥2 簇浅尝、短场（<14 行）。长高潮场簇多但强命中多，自然不触发
    if (r.purposes.length >= 3 && thinPurposes >= 2 && r.lineCount < 14) {
      multiScenes.push(r);
    }

    // 目的迟到：≥8 行，首信号在 55% 后，且前面确有寒暄铺垫（不是动作戏蓄势）
    if (r.lineCount >= 8 && r.firstPurposeRatio > 0.55 && intern.fillerBefore >= 1) {
      lateScenes.push(r);
    }

    // 软收尾：前场有目的推进，末 25% 只有告别客套、零推进
    if (r.lineCount >= 6 && totalHits >= 1 && !r.lands && intern.endsSoft) {
      weakScenes.push(r);
    }

    // 正信号：单目的且末 30% 落地
    if (r.purposes.length === 1 && r.lands) focusedLandedScenes.push(r);
  }

  // —— 跨场重复目的：同主导目的 + 共享具体话题词 + 两场都薄（推进≤3 且主导命中≤2）——
  const thinScenes = reports.filter((r) => {
    if (!r.dominant) return false;
    const totalHits = PURPOSE_KEYS.reduce((s, k) => s + r.hits[k], 0);
    return totalHits <= 3 && r.hits[r.dominant] <= 2;
  });
  // 按 (dominant, 指纹词) 分桶，同桶 ≥2 场构成重复对（C(n,2)）
  const buckets = new Map<string, ScenePurposeReport[]>();
  for (const r of thinScenes) {
    for (const fp of r.fingerprint) {
      if (!fp.startsWith(`${r.dominant}:`)) continue;
      const key = fp;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }
  }
  let duplicatePairCount = 0;
  const duplicateTopics: string[] = [];
  for (const [key, group] of buckets) {
    // 同一场可能含多个相同词，先按场去重
    const uniq = Array.from(new Set(group.map((r) => r.index)));
    if (uniq.length >= 2) {
      const pairs = (uniq.length * (uniq.length - 1)) / 2;
      duplicatePairCount += pairs;
      duplicateTopics.push(`${LABEL[thinScenes.find((r) => r.index === uniq[0])!.dominant!]}×${uniq.length}场`);
    }
  }
  duplicatePairCount = Math.min(duplicatePairCount, 3);

  // —— 组装 issues 与分数 ——
  const issues: ScenePurposeIssue[] = [];
  let penalty = 0;

  if (multiScenes.length) {
    penalty += Math.min(9 * multiScenes.length, 20);
    const detail = multiScenes.map((r) => `第${r.index}场(${r.purposes.map((p) => LABEL[p]).join('+')})`).join('、');
    issues.push({
      severity: multiScenes.length >= 2 ? 'high' : 'mid',
      type: 'multi_purpose_scene',
      evidence: isZh
        ? `${detail}：一场戏塞了三件以上的事，每件只碰一下——目的互相稀释，观众哪件都记不住`
        : `${multiScenes.map((r) => `Scene ${r.index} (${r.purposes.map((p) => LABEL[p]).join('+')})`).join('; ')}: three+ purposes crammed into one short scene, each touched once — every beat gets diluted`,
      advice: isZh
        ? '一场只打一拳。把次要的事拆出去另开一场，或者干脆删并：先问"这场戏如果只留一个结果，留哪个"，其余推到后面的场次。想同时推进，也要让一条线压过另一条，主次分明。'
        : 'One scene, one punch. Move secondary business into its own scene or cut it entirely: ask "if only one result survives this scene, which one?" If beats must coexist, let one line clearly dominate the others.',
    });
  }

  if (duplicatePairCount > 0) {
    penalty += Math.min(10 * duplicatePairCount, 20);
    issues.push({
      severity: duplicatePairCount >= 2 ? 'high' : 'mid',
      type: 'duplicate_purpose',
      evidence: isZh
        ? `发现 ${duplicatePairCount} 对薄场在重复同一目的同一话题（${duplicateTopics.slice(0, 4).join('、')}），后一场没有升级动作——同一件事讲了两遍`
        : `${duplicatePairCount} pair(s) of thin scenes repeat the same purpose and topic (${duplicateTopics.slice(0, 4).join('; ')}), with no escalation in the later scene — the same beat twice`,
      advice: isZh
        ? '重复不是回响，是磨蹭。二选一：要么删掉前一场把信息并进后一场；要么让第二场带着新代价升级——第一次是听说，第二次就要亲眼看见；第一次是怀疑，第二次就要有证据砸脸。'
        : 'Repetition is not resonance, it\'s stalling. Either cut the first scene and merge its information into the second, or escalate: first time heard, second time seen; first time suspicion, second time evidence lands.',
    });
  }

  if (lateScenes.length) {
    penalty += Math.min(7 * lateScenes.length, 14);
    const detail = lateScenes.map((r) => `第${r.index}场(推进信号${Math.round(r.firstPurposeRatio * 100)}%才出现)`).join('、');
    issues.push({
      severity: 'mid',
      type: 'late_purpose',
      evidence: isZh
        ? `${detail}：观众要先熬过一大段寒暄/铺垫才看到这场戏要干什么——竖屏剧三秒定生死，进戏太慢就划走`
        : `${lateScenes.map((r) => `Scene ${r.index} (first purpose beat at ${Math.round(r.firstPurposeRatio * 100)}%)`).join('; ')}: the audience sits through greetings and warm-up before the scene declares itself`,
      advice: isZh
        ? '把目的提到第一句：开场就上冲突/悬念，寒暄挪到对峙的间隙里当喘息。先给结果或难题，再用倒插的一句话补前情——带着张力交代背景，观众才听得进去。'
        : 'Put the purpose in the first line: open on conflict or a question, and slide the pleasantries into the pauses between blows. Lead with the problem, then insert backstory under tension — exposition only lands while the audience cares.',
    });
  }

  if (weakScenes.length) {
    penalty += Math.min(4 * weakScenes.length, 8);
    const detail = weakScenes.map((r) => `第${r.index}场`).join('、');
    issues.push({
      severity: 'low',
      type: 'weak_exit',
      evidence: isZh
        ? `${detail}前面有推进，结尾却落在"慢走/改天再聊/等通知"上——场没有落点，观众情绪没被钩住就黑场`
        : `${weakScenes.map((r) => `Scene ${r.index}`).join('; ')} builds purpose, then ends on "see you/take care/we'?re done here" — the scene lands on nothing`,
      advice: isZh
        ? '让每一场的最后一句都带着钩子：一个决定、一个威胁、一个没回答的问题，或一个被看见的秘密。把客套删掉或提到场中，结尾必须把人推进下一场。'
        : 'Make the last line of every scene a hook: a decision, a threat, an unanswered question, or a secret someone just saw. Move or cut the pleasantries — the exit must push the audience into the next scene.',
    });
  }

  const bonus = Math.min(focusedLandedScenes.length, 4);
  issues.sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.severity] - { high: 0, mid: 1, low: 2 }[b.severity]));

  return {
    score: clamp(100 - penalty + bonus),
    sceneCount: reports.length,
    purposefulSceneCount: reports.filter((r) => r.purposes.length > 0).length,
    multiPurposeCount: multiScenes.length,
    duplicatePairCount,
    latePurposeCount: lateScenes.length,
    weakExitCount: weakScenes.length,
    focusedLandedCount: focusedLandedScenes.length,
    scenes: reports,
    issues,
  };
}

// 瞬态判定数据（不进对外类型字段）
const internal = new WeakMap<ScenePurposeReport, { fillerBefore: number; endsSoft: boolean; domHits: number; body: string }>();
