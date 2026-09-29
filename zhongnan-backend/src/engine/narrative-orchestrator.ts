/**
 * 统一叙事编排器：把 钩子 / 反转 / 爽点 / 情绪节拍 四类手段协同规划为一份"创作蓝图"
 * 供剧情架构岗(大纲)与单集撰写岗(落稿)消费——让多手段 1+1>2，而不是各写各的。
 *
 * 关键：不僵硬。
 *  - 情绪强度按波形起伏，杜绝连续平铺(对应需求2.1.4呼吸感)；
 *  - 反转/爽点按密度档位稀疏有度，类型轮换防疲劳；
 *  - 反转断点集必须真有反转内容(钩子与剧情协同，不空喊)；
 *  - 全部支持 用户指定(manual)/系统默认(auto)/混合(hybrid)，复用 hook-system 的通用选择器。
 * 纯函数、可离线对拍。
 */

import {
  planHooks, auditHooks, hookName, pickWithPreference, DEFAULT_PREF,
  type CuePref, type HookPlan, type Strength,
} from './hook-system';
import { REVERSAL_BEATS } from './beat-system';
import type { BeatPlan, EpisodeBeat } from './beat-system';

// 关系/情感沉淀型节拍：把瞬时情绪刺激沉淀为人物关系资产，防止“爽完即忘”（情绪→情感驱动方法论）
const FEELING_BEAT_IDS = new Set(['emo_heal', 'emo_warmth', 'emo_tear', 'rev_cognition', 'pay_sweet', 'pay_truth']);
type HookEpisode = HookPlan['episodes'][number];

export interface NarrativeCue { id: string; name: string; definition: string; technique: string; cooldown: number; arousal?: number }

// —— 反转库（8型）——
export const REVERSALS: NarrativeCue[] = [
  { id: 'rev_identity', name: '身份反转', definition: '真实身份与表面身份错位', technique: '前期埋身份线索，关键节点一次性引爆', cooldown: 3 },
  { id: 'rev_stance', name: '立场反转', definition: '盟友/敌人立场互换', technique: '用动机转变铺垫，避免突兀', cooldown: 3 },
  { id: 'rev_friendfoe', name: '敌友反转', definition: '一直帮你的人是幕后黑手', technique: '前置细节伏笔，回收时细思极恐', cooldown: 4 },
  { id: 'rev_truefalse', name: '真假反转', definition: '所见所闻为假，真相相反', technique: '先让观众信以为真再推翻', cooldown: 3 },
  { id: 'rev_cause', name: '因果反转', definition: '以为的因其实是果', technique: '重排因果链，给观众恍然大悟感', cooldown: 4 },
  { id: 'rev_cognition', name: '认知反转', definition: '颠覆角色与观众的固有认知', technique: '用新信息重写人物关系', cooldown: 3 },
  { id: 'rev_power', name: '强弱反转', definition: '弱势方瞬间翻盘压制', technique: '先压抑到极致再反弹，爽感最大化', cooldown: 2 },
  { id: 'rev_timeline', name: '时间线反转', definition: '插叙/倒叙揭示另一时间真相', technique: '用时间错位制造信息差', cooldown: 4 },
];

// —— 爽点库（12型）——
export const PAYOFFS: NarrativeCue[] = [
  { id: 'po_faceSlap', name: '打脸逆袭', definition: '被看轻者当场反打质疑者', technique: '先抑后扬，让羞辱原样奉还', cooldown: 1 },
  { id: 'po_hideStrength', name: '扮猪吃虎', definition: '隐藏实力后不经意露一手', technique: '低调铺垫，露锋时点到即止', cooldown: 2 },
  { id: 'po_identityReveal', name: '身份揭晓', definition: '隐藏的尊贵身份/关系曝光', technique: '借第三方之口或物件揭晓更有力', cooldown: 2 },
  { id: 'po_crush', name: '实力碾压', definition: '以绝对实力正面碾压对手', technique: '对比拉满，动作/台词干净利落', cooldown: 1 },
  { id: 'po_revenge', name: '复仇得报', definition: '仇人得到应有的下场', technique: '新账旧账一起算，给足交代', cooldown: 2 },
  { id: 'po_comeback', name: '绝处翻盘', definition: '绝境中找到出路反败为胜', technique: '把退路口封死再亮底牌', cooldown: 2 },
  { id: 'po_clearMis', name: '误会澄清', definition: '关键误会当众澄清，沉冤得雪', technique: '用证据说话，情绪一次释放', cooldown: 2 },
  { id: 'po_sweet', name: '甜宠撒糖', definition: '高甜互动/偏爱护短', technique: '细节宠溺胜过大段告白', cooldown: 1 },
  { id: 'po_rich', name: '暴富逆袭', definition: '财富/资源到位实现阶层跃升', technique: '用具体数字/场面强化冲击', cooldown: 3 },
  { id: 'po_protect', name: '护短撑腰', definition: '强者出面为主角撑腰', technique: '撑腰者地位越高越解气', cooldown: 2 },
  { id: 'po_truth', name: '真相大白', definition: '隐藏真相公之于众', technique: '证据链闭环，当众还原', cooldown: 3 },
  { id: 'po_againstWind', name: '逆风翻盘', definition: '逆势中扭转局面赢得尊重', technique: '靠能力与意志一步步反转口碑', cooldown: 2 },
];

// —— 情绪节拍库（带唤醒度 1低/2中/3高，用于排波形）——
export const EMOTIONS: NarrativeCue[] = [
  { id: 'em_depress', name: '压抑憋屈', arousal: 3, definition: '让观众替角色憋一口气', technique: '具体的委屈细节，为后续反弹蓄力', cooldown: 1 },
  { id: 'em_tension', name: '紧张悬疑', arousal: 3, definition: '悬而未决的紧绷', technique: '用信息差和倒计时拉紧张力', cooldown: 1 },
  { id: 'em_burn', name: '高燃热血', arousal: 3, definition: '热血上涌的燃点', technique: '行动+宣言配合节奏推到高点', cooldown: 1 },
  { id: 'em_release', name: '爽感释放', arousal: 3, definition: '积压情绪一次性释放', technique: '与爽点绑定，给足兑现', cooldown: 1 },
  { id: 'em_abuse', name: '虐心', arousal: 2, definition: '心疼/意难平', technique: '克制表达，留白比哭喊更扎心', cooldown: 2 },
  { id: 'em_sweet', name: '甜', arousal: 2, definition: '心动/温暖的甜', technique: '小动作小细节制造心动', cooldown: 1 },
  { id: 'em_touch', name: '感动', arousal: 2, definition: '情感共鸣的动容', technique: '用具体的人和事落地，不喊口号', cooldown: 2 },
  { id: 'em_scare', name: '惊吓', arousal: 3, definition: '突发的惊/吓', technique: '先静后动，声音画面同步', cooldown: 2 },
  { id: 'em_heal', name: '治愈松弛', arousal: 1, definition: '舒缓、烟火气的喘息', technique: '生活细节做呼吸口，调节节奏', cooldown: 1 },
  { id: 'em_daily', name: '日常铺垫', arousal: 1, definition: '低强度交代与蓄势', technique: '埋信息、立人物，不拖时长', cooldown: 1 },
];

export type Density = 'sparse' | 'normal' | 'dense';
const REV_EVERY: Record<Density, number> = { sparse: 4, normal: 3, dense: 2 };
const PAYOFF_PER_EP: Record<Density, [number, number]> = { sparse: [0, 1], normal: [1, 2], dense: [2, 3] };
// 情绪唤醒度波形（张弛有度，避免一条直线）
const AROUSAL_WAVE = [2, 3, 1, 2, 3, 3, 1, 2];

export interface SceneBeat { scene: number; microHookIds: string[]; endHookId?: string; emotionId: string; arousal: number; payoffId?: string; reversalId?: string }
export interface EpisodeBlueprint { episode: number; openHookId: string; endHookId: string; beats: SceneBeat[]; hasReversal: boolean; payoffCount: number }
export interface CreativeBlueprint { episodes: EpisodeBlueprint[]; hookPlan: HookPlan; density: Density; strength: Strength }

export interface NarrativePrefs {
  hook: CuePref; reversal: CuePref; payoff: CuePref; emotion: CuePref;
  density: Density;
}
export const DEFAULT_NARRATIVE: NarrativePrefs = {
  hook: { ...DEFAULT_PREF }, reversal: { ...DEFAULT_PREF }, payoff: { ...DEFAULT_PREF }, emotion: { ...DEFAULT_PREF }, density: 'normal',
};

function pickCue(position: number, pool: NarrativeCue[], pref: CuePref, recent: string[], rng: () => number): NarrativeCue {
  // 复用通用选择器：把 NarrativeCue 适配成 hook-system 可消费的最小结构
  const adapted = pool.map((c) => ({ id: c.id, name: c.name, layer: 'micro' as const, definition: '', technique: '', example: '', bestFor: [], cooldown: c.cooldown }));
  const got = pickWithPreference(position, adapted, pref, recent, rng);
  return pool.find((c) => c.id === got.id)!;
}

export function buildBlueprint(episodeCount: number, scenesPerEp: number, prefs: NarrativePrefs = DEFAULT_NARRATIVE, rng: () => number = Math.random): CreativeBlueprint {
  const hookPlan = planHooks(episodeCount, scenesPerEp, prefs.hook, rng);
  const episodes: EpisodeBlueprint[] = [];
  const recentRev: string[] = []; const recentPay: string[] = []; let revPos = 0; let payPos = 0; let globalScene = 0;

  hookPlan.episodes.forEach((hp, ei) => {
    const beats: SceneBeat[] = [];
    // 该集是否安排反转：按密度周期，或集尾是反转断点则必须配
    const endIsReversal = hp.endHookId === 'ep_cliff_reversal';
    const needRev = endIsReversal || (ei + 1) % REV_EVERY[prefs.density] === 0;
    let reversalId: string | undefined;
    if (needRev) { const r = pickCue(revPos++, REVERSALS, prefs.reversal, recentRev, rng); recentRev.push(r.id); reversalId = r.id; }
    // 每集爽点数量
    const [lo, hi] = PAYOFF_PER_EP[prefs.density];
    let payLeft = lo + Math.floor(rng() * (hi - lo + 1));
    // 爽点分布到不同场景，避免挤在同一场；从不重复的可用场景中抽取
    const availScenes = Array.from({ length: scenesPerEp }, (_, i) => i);
    const payoffScenes = new Set<number>();
    while (payLeft > 0 && availScenes.length) { const idx = Math.floor(rng() * availScenes.length); payoffScenes.add(availScenes.splice(idx, 1)[0]); payLeft--; }

    hp.scenes.forEach((sc, si) => {
      globalScene++;
      // 情绪按波形取目标唤醒度，再从同唤醒度候选轮换
      const targetArousal = AROUSAL_WAVE[globalScene % AROUSAL_WAVE.length];
      const sameLevel = EMOTIONS.filter((e) => e.arousal === targetArousal && !prefs.emotion.avoid.includes(e.id));
      const pool = sameLevel.length ? sameLevel : EMOTIONS;
      const em = pickCue(globalScene, pool, prefs.emotion, [], rng);
      let payoffId: string | undefined;
      if (payoffScenes.has(si)) { const p = pickCue(payPos++, PAYOFFS, prefs.payoff, recentPay, rng); recentPay.push(p.id); payoffId = p.id; }
      // 反转落在该集靠后一场
      const revHere = reversalId && si === Math.max(0, scenesPerEp - 2) ? reversalId : undefined;
      beats.push({ scene: sc.scene, microHookIds: sc.microHookIds, endHookId: sc.endHookId, emotionId: em.id, arousal: em.arousal ?? 2, payoffId, reversalId: revHere });
    });
    episodes.push({
      episode: ei + 1, openHookId: hp.openHookId, endHookId: hp.endHookId, beats,
      hasReversal: !!reversalId, payoffCount: beats.filter((b) => b.payoffId).length,
    });
  });
  return { episodes, hookPlan, density: prefs.density, strength: prefs.hook.strength };
}

export interface BlueprintIssue { level: 'error' | 'warning'; at: string; msg: string; fix: string }
export function auditBlueprint(bp: CreativeBlueprint): BlueprintIssue[] {
  const issues: BlueprintIssue[] = auditHooks(bp.hookPlan, true).map((i) => ({ level: i.level, at: i.at, msg: i.msg, fix: i.fix }));
  bp.episodes.forEach((ep) => {
    // 1) 情绪平铺：连续3场同唤醒度=没有呼吸感
    let run = 1;
    for (let i = 1; i < ep.beats.length; i++) {
      if (ep.beats[i].arousal === ep.beats[i - 1].arousal) run++; else run = 1;
      if (run >= 3) issues.push({ level: 'warning', at: `第${ep.episode}集`, msg: '情绪强度连续平铺、缺少起伏', fix: '插入低唤醒度的治愈/日常场做呼吸口' });
    }
    // 2) 反转断点必须真有反转
    if (ep.endHookId === 'ep_cliff_reversal' && !ep.hasReversal) issues.push({ level: 'error', at: `第${ep.episode}集`, msg: '集尾是反转断点却没有安排反转内容', fix: '在靠后场景补一个反转节拍' });
  });
  // 3) 爽点空档：连续3集无爽点
  let blank = 0;
  bp.episodes.forEach((ep) => { blank = ep.payoffCount === 0 ? blank + 1 : 0; if (blank >= 3) issues.push({ level: 'warning', at: `第${ep.episode}集`, msg: '连续多集没有爽点，追更动力下降', fix: '安排打脸/揭晓/翻盘等爽点' }); });
  // 4) 情绪→情感驱动（《冒姓琅琊》方法论）：瞬时情绪刺激须沉淀为关系/情感资产，否则爽完即忘
  //    关系沉淀型节拍 = 认知反转(重写关系) / 身份揭晓(关系曝光) / 治愈场(关系修复)
  let payoffTotal = 0, feelingBeats = 0;
  bp.episodes.forEach((ep) => ep.beats.forEach((b) => {
    if (b.payoffId) payoffTotal++;
    if (b.emotionId === 'em_heal' || b.reversalId === 'rev_cognition' || b.payoffId === 'po_identityReveal') feelingBeats++;
  }));
  if (payoffTotal >= 6 && feelingBeats === 0) issues.push({
    level: 'warning', at: '全剧',
    msg: '情绪刺激密集却没有情感关系沉淀，容易“爽完即忘”、留不住人',
    fix: '从“情绪驱动”升级为“情感驱动”：让关键强情绪事件改变一段人物关系或留下情感印记（和解/误会消弭/身份揭晓/治愈场），把瞬时爽感变成观众对人物命运的长期牵挂',
  });
  return issues;
}

const emName = (id: string) => EMOTIONS.find((e) => e.id === id)?.name ?? id;
const payName = (id?: string) => (id ? PAYOFFS.find((p) => p.id === id)?.name : undefined);
const revName = (id?: string) => (id ? REVERSALS.find((p) => p.id === id)?.name : undefined);

/** 给剧情架构岗的大纲指令 */
export function renderForArchitect(bp: CreativeBlueprint, tagBrief = ''): string {
  const lines: string[] = [];
  lines.push('【创作蓝图·架构岗必须遵循】');
  if (tagBrief) lines.push(tagBrief);
  lines.push(`节奏强度=${bp.strength}，爽点密度=${bp.density}；全剧${bp.episodes.length}集，每集须有黄金3秒开场钩与集尾卡点。`);
  bp.episodes.forEach((ep) => {
    lines.push(`第${ep.episode}集：开场用「${hookName(ep.openHookId)}」，集尾用「${hookName(ep.endHookId)}」${ep.hasReversal ? '，本集安排一次反转' : ''}，含${ep.payoffCount}个爽点；情绪线：${ep.beats.map((b) => emName(b.emotionId)).join('→')}。`);
  });
  lines.push('要求：所有钩子/反转/爽点必须服务人物与剧情，自然融入，禁止生硬标注、禁止为卡点而卡点。');
  return lines.join('\n');
}

/** 给单集撰写岗的逐集落稿指令 */
export function renderForWriter(ep: EpisodeBlueprint): string {
  const lines: string[] = [`【第${ep.episode}集落稿蓝图】`, `黄金3秒开场钩：${hookName(ep.openHookId)}（开篇0铺垫直给，但信息要清楚）。`];
  ep.beats.forEach((b) => {
    const seg = [`第${b.scene}场`, `情绪=${emName(b.emotionId)}`];
    if (b.microHookIds.length) seg.push(`微钩=${b.microHookIds.map((id) => hookName(id)).join('/')}`);
    const p = payName(b.payoffId); if (p) seg.push(`爽点=${p}`);
    const r = revName(b.reversalId); if (r) seg.push(`反转=${r}`);
    if (b.endHookId) seg.push(`场末牵引=${hookName(b.endHookId)}`);
    lines.push(seg.join('，'));
  });
  lines.push(`集尾卡点：${hookName(ep.endHookId)}（在情绪/信息峰值处切断，引向下一集）。`);
  lines.push('台词口语化、动作与细节服务叙事；蓝图是骨架不是台词，严禁把"钩子/爽点"等术语写进正文。');
  return lines.join('\n');
}

/* ============================================================================
 * v1.97 跨模块叙事一致性质检（钩子工程 × 节拍工程 联动，1+1>2）
 * ----------------------------------------------------------------------------
 * beat-system.auditBeats 只看节拍自身、hook-system.auditHooks 只看钩子自身；
 * 两份“事前排布”用各自独立的 RNG/周期生成，确实可能相互脱配，下列问题只有对齐两份计划才查得到。
 * 只保留“恒成立、不会与用户选择相悖”的两项（其余候选经证伪后剔除）：
 *  1) 集尾是“反转卡点”，节拍表却没排反转（error，硬伤）——balanced/relaxed 下两规划周期不同步，真实可发生。
 *  2) 全剧爽点≥6 却没有一个关系/情感沉淀节拍（warning，爽完即忘、留不住人）。
 * 已剔除：①“连续3集无爽点”——只可能在 relax 稀疏档出现，而那是用户主动选择的节奏，告警会与之相悖；
 *        ②“同唤醒度即平铺”——憋屈→爆发→高燃同属高强度却是递进高潮，会误报；单集情绪平铺已由 beat-system 按 id 查。
 * 纯函数、默认中文逐字不变、英文并行。
 * ==========================================================================*/
export type CoherenceLang = 'zh' | 'en';
/**
 * 规划层对齐（治本）：钩子规划与节拍规划用独立 RNG/周期生成，balanced/relaxed 下约半数集可能
 * “集尾是反转卡点、节拍却没排反转”。在两份计划都生成后、审计前做一次确定性对齐——
 * 凡集尾为 ep_cliff_reversal 而该集无反转节拍的，补一个“不与近邻同型”的反转节拍。
 * 直接在传入的 beatPlan 上补齐并返回（每次 runEpisode 都是新建计划，就地改安全、可复现）。
 * 反向情况（有反转但集尾不是反转卡点）合法，不处理。
 */
export function alignBeatsToHooks(hookPlan: HookPlan, beatPlan: BeatPlan, rng: () => number = Math.random): { plan: BeatPlan; alignedEpisodes: number[] } {
  const hookByEp = new Map<number, string>();
  hookPlan.episodes.forEach((h) => hookByEp.set(h.episode, h.endHookId));
  const recent: string[] = [];
  beatPlan.episodes.forEach((b) => { if (b.reversalId) recent.push(b.reversalId); });
  const alignedEpisodes: number[] = [];
  beatPlan.episodes.forEach((b) => {
    if (hookByEp.get(b.episode) === 'ep_cliff_reversal' && !b.reversalId) {
      const cand = REVERSAL_BEATS.filter((r) => !recent.includes(r.id));
      const pool = cand.length ? cand : REVERSAL_BEATS;
      const pick = pool[Math.floor(rng() * pool.length)];
      b.reversalId = pick.id; recent.push(pick.id); alignedEpisodes.push(b.episode);
    }
  });
  return { plan: beatPlan, alignedEpisodes };
}
export function auditNarrativeCoherence(hookPlan: HookPlan, beatPlan: BeatPlan, lang: CoherenceLang = 'zh'): BlueprintIssue[] {
  const en = lang === 'en';
  const issues: BlueprintIssue[] = [];
  const beatByEp = new Map<number, EpisodeBeat>();
  beatPlan.episodes.forEach((b) => beatByEp.set(b.episode, b));
  // 1) 反转卡点脱配（跨钩子×节拍，硬伤）
  hookPlan.episodes.forEach((h) => {
    const b = beatByEp.get(h.episode);
    if (h.endHookId === 'ep_cliff_reversal' && b && !b.reversalId) {
      issues.push(en
        ? { level: 'error', at: `Episode ${h.episode}`, msg: 'The episode ends on a reversal cliff, yet no reversal beat was planned', fix: 'Place a real identity/stance/friend-foe/cognition reversal in a late scene and cut at its peak' }
        : { level: 'error', at: `第${h.episode}集`, msg: '集尾是反转卡点，节拍表却没有安排反转内容', fix: '在靠后场景落实一次真正的身份/立场/敌友/认知反转，并在反转峰值处切断' });
    }
  });
  // 2) 情绪→情感沉淀（全剧软提示）
  let payoffTotal = 0; let feeling = 0;
  beatPlan.episodes.forEach((b) => {
    payoffTotal += b.payoffIds.length;
    if (FEELING_BEAT_IDS.has(b.reversalId ?? '')) feeling++;
    b.payoffIds.forEach((id) => { if (FEELING_BEAT_IDS.has(id)) feeling++; });
    b.emotionPath.forEach((id) => { if (FEELING_BEAT_IDS.has(id)) feeling++; });
  });
  if (payoffTotal >= 6 && feeling === 0) issues.push(en
    ? { level: 'warning', at: 'Whole series', msg: 'Dense payoffs but zero relationship/feeling payoff — viewers forget it after the rush', fix: 'Let one key high-emotion event change a relationship (reconciliation/truth reveal/healing), turning instant thrill into lasting investment' }
    : { level: 'warning', at: '全剧', msg: '爽点密集却没有情感关系沉淀，容易“爽完即忘”、留不住人', fix: '让一个关键强情绪事件改变一段人物关系（和解/真相揭晓/治愈场），把瞬时爽感变成对人物命运的长期牵挂' });
  return issues;
}
/**
 * 针对“当前正在生成的这一集”，把跨模块质检结论转成可直接喂岗位模型的纠正指令；
 * 无问题返回空串。架构师/撰写岗各注入一次，做到事前自纠而非事后报错。
 */
export function episodeCoherenceNote(hookEp: HookEpisode, beatEp: EpisodeBeat, lang: CoherenceLang = 'zh'): string {
  const en = lang === 'en';
  if (!(hookEp.endHookId === 'ep_cliff_reversal' && !beatEp.reversalId)) return '';
  return en
    ? '[Narrative coherence — mandatory]\nCoherence fix: this episode ends on a reversal cliff — you MUST land a genuine identity/stance/cognition reversal in a late scene and cut at its peak.'
    : '【叙事一致性·必须纠偏】\n一致性纠偏：本集集尾是反转卡点，必须在靠后场景落实一次真正的身份/立场/认知反转，并在反转峰值处切断。';
}
