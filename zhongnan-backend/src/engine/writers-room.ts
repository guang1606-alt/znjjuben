/**
 * writers-room.ts —— 编剧室协作引擎：选题会 + 剧本围读
 *
 * 来源：一线编剧日常工作流（2026-08-31《短剧编剧的一天》《最值钱的不是演员》《AI会淘汰编剧吗》）。
 *  真实编剧不是“等灵感写一遍”，而是：看市场 → 开选题会（判断人物关系/冲突空间/拍摄难度）
 *  → 写大纲正文 → 围读改稿（责编/导演/制片逐条挑问题）→ 再检查。本引擎把“判断与讨论”产品化。
 *
 * 设计原则：
 *  - 纯函数、规则驱动，未配置模型 Key（sandbox）也能产出完整、可用、可测的结构化会议结果；
 *    真实大模型只在路由层做语言润色，绝不依赖模型才能开会（杜绝“点了没反应”）。
 *  - 围读意见直接复用既有质检扫描器（节奏/AI腔/悬浮/通用反应/字数），与全剧流水线同一把尺子，不另立标准。
 *  - 这两个是“创作工具箱”协作功能，不占用十二大创作模式名额。
 */

import { antiAiScan, validateEpisodeLength, ScriptMode } from './playbook';
import { groundedScan } from './lifelike';
import { rhythmScan } from './rhythm';
import { genericReactionScan, titlePitchCheck, recommendTopics, TOPIC_BOTTOM_LINE, TOPIC_EN, TOPIC_BOTTOM_LINE_EN } from './craft-insights';
import { craftLint } from './craft-lint';
import { emotionCraftLint } from './emotion-craft';
import { webnovelLint } from './webnovel-craft';
import { matchGenreByPain, GENRE_EN } from './genre-compensate';
import { buildCraftParts } from './craft-registry';
import { matchArchetype, archetypeLint, PROTAG_EN, VILLAIN_EN, SYSTEM_EN } from './archetype-craft';
import { recommendHooks, matchCraftCards, narrativeLint, HOOK_EN, CARD_EN } from './narrative-craft';
import { investorLens, investorOneLiner } from './investor-lens';
import { localizeLintIssueEn } from './lint-i18n';

/* ============================ 选题会 ============================ */

export type PitchSeatRole = 'host' | 'market' | 'story' | 'production' | 'critic';
export type WrLang = 'zh' | 'en';
export interface PitchSeat { role: PitchSeatRole; name: string; focus: string }
/** 选题会五席：主持小南 + 市场/故事/制作三评估 + 观众挑刺，对应真实选题会的决策角色 */
export const PITCH_SEATS: PitchSeat[] = [
  { role: 'host', name: '小南(主持)', focus: '控场、收敛结论、形成可执行选题卡' },
  { role: 'market', name: '市场评估', focus: '目标受众、题材风向、平台适配、爆款潜力' },
  { role: 'story', name: '故事评估', focus: '人物关系是否成立、冲突空间能撑多少集' },
  { role: 'production', name: '制作评估', focus: '拍摄/制作难度、场景与演员成本、载体选择' },
  { role: 'critic', name: '观众挑刺', focus: '同质化风险、前3秒能否代入、致命问题' },
];
const PITCH_SEATS_EN: PitchSeat[] = [
  { role: 'host', name: 'Xiaonan (host)', focus: 'Facilitate and converge to an executable pitch card' },
  { role: 'market', name: 'Market', focus: 'Target audience, genre trend, platform fit, hit potential' },
  { role: 'story', name: 'Story', focus: 'Whether relationships hold and how many episodes the conflict sustains' },
  { role: 'production', name: 'Production', focus: 'Shoot/production difficulty, scene & cast cost, medium choice' },
  { role: 'critic', name: "Devil's advocate", focus: 'Sameness risk, first-3-second immersion, fatal flaws' },
];
export function pitchSeats(lang: WrLang = 'zh'): PitchSeat[] { return lang === 'en' ? PITCH_SEATS_EN : PITCH_SEATS; }

export interface PitchQuestion { seat: PitchSeatRole; name: string; question: string; why: string }
export interface OpenPitch {
  agenda: string[];
  questions: PitchQuestion[];
  hints: string[];
}

/** 选题会开场：各席位抛出“要立项必须先回答”的关键问题（源自真实选题会三硬维度 + 市场前置） */
export function openPitchMeeting(input: { idea: string; audience?: string; medium?: string; tags?: string[] }, lang: WrLang = 'zh'): OpenPitch {
  const en = lang === 'en';
  const idea = String(input.idea || '').trim();
  const agenda = en ? [
    '1. Market first: who is this for, and is now the right time?',
    '2. Story core: do the relationships hold and how many episodes can the conflict sustain?',
    '3. Production feasibility: scene/cast/VFX cost and medium (live-action / AI-realistic / motion-comic)',
    '4. Critic: where would viewers swipe away, and which existing hit is it close to?',
    '5. Host converges: green-light / hold / reject, with a refined pitch card',
  ] : [
    '1. 市场前置：这个想法拍给谁看？现在是不是时候？',
    '2. 故事内核：人物关系成不成立、冲突能撑多少集？',
    '3. 制作可行性：场景/演员/特效成本与载体（真人/AI仿真人/漫剧）',
    '4. 挑刺：哪里会被划走、和已有爆款撞在哪',
    '5. 主持人收敛：立项 / 缓议 / 否决，给出优化后的选题卡',
  ];
  const questions: PitchQuestion[] = en ? [
    { seat: 'market', name: 'Market', question: 'Who is the target viewer (gender/age/emotional need)? Is the comparable category rising or already crowded in the last 30 days?', why: 'Genre is only the entry point — first confirm someone needs this emotion' },
    { seat: 'story', name: 'Story', question: 'What does the lead want at the start? Who blocks them? How many layers of contradiction exist in the relationships — enough for your planned episodes?', why: 'Conflict space decides episode count; weak relationships mean forced plot later' },
    { seat: 'story', name: 'Story', question: 'Does the lead drive the plot actively, or is she/he pushed around by events? In which episode does the biggest reversal/payoff land?', why: 'The lead needs an active goal; a planted thread paid off is emotional reward' },
    { seat: 'production', name: 'Production', question: 'Roughly how many scenes? Any crashes/explosions/set pieces/period sets? Better as live-action, AI-realistic, or motion-comic?', why: 'Newcomers often die from runaway scene cost; the wrong medium wastes effort' },
    { seat: 'critic', name: "Devil's advocate", question: 'What do viewers see in the first 3 seconds? Does the logline carry identity + conflict + contrast? Which recent hit is it closest to, and what is the difference?', why: 'If nothing happens in the first 2 minutes viewers leave; heat is not quality' },
  ] : [
    { seat: 'market', name: '市场评估', question: '这部剧的目标观众是谁（性别/年龄/情绪需求）？近30天同类是在涨还是已经扎堆？', why: '题材只是入口，先确认有没有人需要这个情绪' },
    { seat: 'story', name: '故事评估', question: '主角开场想要什么？谁在挡她/他？人物关系里天然有几层矛盾，够撑你计划的集数吗？', why: '冲突空间决定集数，关系不成立后面全是硬凑' },
    { seat: 'story', name: '故事评估', question: '主角是主动推进，还是被事件推着走？最大的一次反转/兑付放在第几集？', why: '人物必须有主动目标，伏笔回收=情绪兑付' },
    { seat: 'production', name: '制作评估', question: '大概需要多少个场景？有没有车祸/爆炸/大场面/特殊年代置景？更适合真人、AI仿真人还是漫剧？', why: '新人常死于场景成本失控，载体选错事倍功半' },
    { seat: 'critic', name: '观众挑刺', question: '观众刷到前3秒看到什么？一句话里有没有身份+冲突+反差？和最近哪个爆款最像、差异点是什么？', why: '第一集2分钟没出事观众就划走，热度高也不等于质量高' },
  ];
  const hints: string[] = [];
  if (idea.length < 20) hints.push(en ? 'The idea is still thin — add one line of “who, what trouble, how they fight back”; the pitch read will be sharper' : '你的想法还比较简略，建议先补一句“谁、遇到什么麻烦、准备怎么反击”，选题会判断会更准');
  if (!input.audience) hints.push(en ? 'No target audience set yet — Market will infer from genre; correct it any time' : '还没指定目标受众，市场评估会先按题材推断，你可随时纠正');
  const probeText = `${idea} ${input.audience || ''}`;
  if (en) {
    // v1.94 英文模式同样注入七类知识库 hint（流派补偿/原型/钩子/工艺卡/资方/风向），匹配器走英文关键词
    const genres = matchGenreByPain(probeText, 'en');
    if (genres.length) {
      const g0 = GENRE_EN[genres[0].id];
      hints.push(`This demand fits the genre “${genres.map((g) => GENRE_EN[g.id]?.name || g.name).join(', ')}” — real-life pain: ${g0?.pain}; emotional compensation: ${g0?.comp}; short-drama transfer: ${g0?.fit}; avoid: ${g0?.avoid}`);
    }
    // v2.18 全部类型机制引擎统一走注册表，立项会与管线永不脱节
    buildCraftParts(probeText, 'en').forEach((p) => hints.push(p.directive));
    const arch = matchArchetype({ text: probeText, tags: input.tags }, 'en');
    if (arch.protag.length) {
      const p0 = PROTAG_EN[arch.protag[0].id];
      hints.push(`Protagonist archetype: ${arch.protag.map((p) => `“${PROTAG_EN[p.id]?.name || p.name}” (${PROTAG_EN[p.id]?.formula})`).join('; ')}. ${p0?.core}`);
    }
    if (arch.villain.length) {
      hints.push(`Antagonist archetype: ${arch.villain.map((v) => `“${VILLAIN_EN[v.id]?.name || v.name}” (${VILLAIN_EN[v.id]?.formula})`).join('; ')}. Keep the villain’s intelligence and stance online — the lead’s win is only valuable against an equal.`);
    }
    if (arch.system.length) {
      hints.push(`System / golden-finger mechanic: ${arch.system.map((s) => `“${SYSTEM_EN[s.id]?.name || s.name}”`).join(', ')} — ${arch.system.map((s) => SYSTEM_EN[s.id]?.tip).filter(Boolean).join(' ')}`);
    }
    const hooks = recommendHooks({ text: probeText, tags: input.tags }, 'en');
    hints.push(`Default hook mix (editable): ${hooks.slice(0, 6).map((h) => `“${HOOK_EN[h.id]?.name || h.name}”`).join(', ')}. Baseline: an episode hook per episode, a scene hook per scene, a chain hook in the opening two lines, then genre-specific hooks on top.`);
    const cards = matchCraftCards({ text: probeText, tags: input.tags, limit: 3 }, 'en');
    if (cards.length) {
      hints.push(`Narrative craft points: ${cards.map((c) => `“${CARD_EN[c.id]?.title || c.title}” ${CARD_EN[c.id]?.formula || c.formula}`).join('; ')}.`);
    }
    const wind = recommendTopics().slice(0, 3).map((t) => `${TOPIC_EN[t.id]?.segment || t.segment}·${TOPIC_EN[t.id]?.name || t.name}`);
    const il = investorLens({ text: `${probeText} ${input.medium || ''}`, tags: input.tags }, 'en');
    hints.push(`Investor lens: ${investorOneLiner(il, 'en')}Funders weigh track certainty, cost/recoupment and paid-traffic marketability first; content is only the threshold. Gap tips: ${il.pitchTips.slice(0, 2).join('; ')}.`);
    hints.push(`Reference topic wind right now: ${wind.join(' / ')} (reference only, don’t follow blindly). ${TOPIC_BOTTOM_LINE_EN}`);
  } else {
    const genres = matchGenreByPain(probeText);
    if (genres.length) {
      const g0 = genres[0];
      hints.push(`该诉求契合流派「${genres.map((g) => g.name).join('、')}」——现实痛点：${g0.realityPain}；情绪代偿：${g0.compensation}；短剧迁移：${g0.shortDramaFit}；禁忌：${g0.avoid}`);
    }
    // v2.18 全部类型机制引擎统一走注册表，立项会与管线永不脱节
    buildCraftParts(probeText, 'zh').forEach((p) => hints.push(p.directive));
    // 人物原型/反派哲学/系统机制选型（34条编剧方法论沉淀）：立项阶段就把“立什么主角、配什么反派、系统怎么成瘾”定下来
    const arch = matchArchetype({ text: probeText, tags: input.tags });
    if (arch.protag.length) {
      hints.push(`主角原型建议：${arch.protag.map((p) => `「${p.name}」(${p.formula})`).join('；')}。${arch.protag[0].core}`);
    }
    if (arch.villain.length) {
      hints.push(`反派选型建议：${arch.villain.map((v) => `「${v.name}」(${v.formula})`).join('；')}。反派智商与立场在线，主角的胜利才值钱。`);
    }
    if (arch.system.length) {
      hints.push(`系统/金手指机制建议：${arch.system.map((s) => `「${s.name}」`).join('、')}——拒绝明码标价小卖部，用代价/盲盒/因果律制造成瘾与期待。`);
    }
    // 钩子选型（导演提出：场/集/动作/氛围/语言/信息差/倒计时…系统默认按题材推荐组合，用户可自选增删）
    const hooks = recommendHooks({ text: probeText, tags: input.tags });
    hints.push(`系统默认钩子组合（可自行增删）：${hooks.slice(0, 6).map((h) => `「${h.name.split('（')[0]}」`).join('、')}。保底每集用集钩、每场用场钩、开篇前两句用连环钩，再按题材叠加专属钩。`);
    // 叙事工艺方法论卡片（累计113条写作方法论沉淀，按题材匹配最相关的立人/叙事/关系/类型技法）
    const cards = matchCraftCards({ text: probeText, tags: input.tags, limit: 3 });
    if (cards.length) {
      hints.push(`叙事工艺要点：${cards.map((c) => `「${c.title}」${c.formula}`).join('；')}。`);
    }
    const wind = recommendTopics().slice(0, 3).map((t) => `${t.segment}·${t.name}`);
    // 资方视角前置：内容只是入场券，赛道确定性/成本回收/可投流性才排前三（2026-09资方复盘）
    const il = investorLens({ text: `${probeText} ${input.medium || ''}`, tags: input.tags });
    hints.push(`资方视角：${investorOneLiner(il)}资方前三看赛道确定性、成本回收、可投流性，内容达标只是门槛；短板提示：${il.pitchTips.slice(0, 2).join('；')}。`);
    hints.push(`当前可参考的题材风向：${wind.join(' / ')}（仅参考不盲从）。${TOPIC_BOTTOM_LINE}`);
  }
  return { agenda, questions, hints };
}

export type PitchDecision = 'GO' | 'HOLD' | 'NO';
export interface PitchVerdict {
  decision: PitchDecision;
  decisionText: string;
  logline: string;
  relations: string;
  conflictSpace: string;
  episodes: number;
  /** 当前人物关系/冲突分层确定性可支撑的集数容量（c196：计划集数超容量 1.3 倍则拦截 GO，防中后期注水） */
  capacityEpisodes: number;
  audience: string;
  medium: string;
  difficulty: string;
  scores: { market: number; story: number; feasibility: number; novelty: number; total: number };
  risks: string[];
  fixes: string[];
}

/** 冲突"分层加码"信号：命中说明同一矛盾被设计成多级兑付而非单层拉扯，每类 +10 集容量（封顶 +30） */
const CAP_SIGNALS_ZH = ['层', '升级', '递进', '反转', '副线', '多线', '双线', '秘密', '身份', '复仇', '阶段', '加码'];
const CAP_SIGNALS_EN = ['layer', 'escalat', 'progres', 'twist', 'subplot', 'multi-line', 'two-line', 'secret', 'identity', 'revenge', 'phase', 'stakes'];
/** 冲突空间容量（集）：故事分（关系+冲突+主动意志）定骨架，冲突文本里的分层信号加码——纯确定性、可解释 */
function conflictCapacityEpisodes(story: number, conflict: string, en: boolean): number {
  const cap = story >= 80 ? 100 : story >= 65 ? 80 : story >= 50 ? 60 : 40;
  const sigs = en ? CAP_SIGNALS_EN : CAP_SIGNALS_ZH;
  const hay = en ? conflict.toLowerCase() : conflict;
  const hits = sigs.filter((s) => hay.includes(s)).length;
  return cap + Math.min(3, hits) * 10;
}

const HIGH_COST_WORDS = ['车祸', '爆炸', '坠', '直升机', '飞机', '游艇', '大火', '雪崩', '战争', '千军万马', '宫殿', '古装大场面', '婚礼大场面', '特效', '巨兽', '灾难'];
const HIGH_COST_WORDS_EN = ['car crash', 'explosion', 'helicopter', 'airplane', 'yacht', 'fire', 'avalanche', 'war', 'palace', 'period epic', 'massive wedding', 'VFX', 'monster', 'disaster', 'cliff fall'];

/** 形成选题决议：对“想法+用户补充”做四维打分，给立项/缓议/否决与可执行选题卡 */
export function decidePitch(input: {
  idea: string; audience?: string; medium?: string; relation?: string; conflict?: string; scenes?: string; episodes?: number;
}, lang: WrLang = 'zh'): PitchVerdict {
  const en = lang === 'en';
  const idea = String(input.idea || '');
  const text = [idea, input.relation, input.conflict, input.scenes].filter(Boolean).join(' ');
  // 故事分：有关系+冲突+主动意志
  let story = 40;
  if ((input.relation || '').length >= 6) story += 20;
  if ((input.conflict || '').length >= 6) story += 25;
  const goalRe = en ? /(want|take back|decide|find out|prove|escape|scheme|resist|refuse|reclaim|hold on|fight back)/i : /想要|夺回|决定|查清|证明|逃离|布局|反抗|拒绝|拿回|守住/;
  if (goalRe.test(text)) story += 15;
  story = Math.min(100, story);
  // 市场分：有受众+信息密度
  let market = 45;
  if ((input.audience || '').length >= 2) market += 25;
  const tp = titlePitchCheck(idea.slice(0, 40));
  market += tp.score * 0.3;
  market = Math.min(100, Math.round(market));
  // 可行性分：高成本词越多越低
  const costWords = en ? HIGH_COST_WORDS_EN : HIGH_COST_WORDS;
  const costHits = costWords.filter((w) => (en ? text.toLowerCase().includes(w.toLowerCase()) : text.includes(w)));
  let feasibility = 90 - costHits.length * 12;
  feasibility = Math.max(20, Math.min(100, feasibility));
  // 新颖度：越短越泛越低
  let novelty = Math.min(90, 40 + Math.floor(text.length / 8));
  const cliché = en ? ['CEO falls for me', 'hidden daughter returns', 'war god returns'].filter((w) => text.toLowerCase().includes(w.toLowerCase())) : ['霸总爱上我', '千金归来', '战神回归'].filter((w) => text.includes(w));
  novelty -= cliché.length * 15;
  novelty = Math.max(20, novelty);
  const total = Math.round(story * 0.35 + market * 0.25 + feasibility * 0.2 + novelty * 0.2);

  // c196 集数-冲突空间护栏：开场问题问了"冲突够撑计划集数吗"，决议就必须真判（问而不判=逻辑断裂）
  const plannedEpisodes = input.episodes && input.episodes > 0 ? Math.floor(input.episodes) : 0;
  const capacityEpisodes = conflictCapacityEpisodes(story, input.conflict || '', en);
  const epOver = plannedEpisodes > 0 && plannedEpisodes > capacityEpisodes * 1.3;

  const risks: string[] = [];
  if (story < 65) risks.push(en ? 'Weak relationships/conflict space — risk of not sustaining episodes and forcing events' : '人物关系/冲突空间偏弱，存在“撑不起集数、靠事件硬推”的风险');
  if (market < 60) risks.push(en ? 'Unclear audience or hook; the first ~13 chars should carry identity + conflict + contrast' : '目标受众或传播抓手不清晰，前13字建议补齐身份+冲突+反差');
  if (costHits.length >= 2) risks.push(en ? `Many high-cost elements (${costHits.slice(0, 4).join(', ')}); new/small teams should use enclosed micro-scenes or AI-realistic/motion-comic` : `含较多高成本元素（${costHits.slice(0, 4).join('、')}），新人/小团队建议改用封闭微场景或换AI仿真人/漫剧载体`);
  if (novelty < 55) risks.push(en ? 'Heavy overlap with mature formulas — add at least one micro-innovation in identity/relationship/world' : '与成熟套路重合度高，需要至少在身份/关系/世界观上换一个微创新');
  if (epOver) risks.push(en
    ? `Planned ${plannedEpisodes} episodes exceed the conflict-space capacity (~${capacityEpisodes} eps for current relationships/layers); the mid-to-late acts risk filler, repeated reversals and new characters parachuted in to extend the story`
    : `计划${plannedEpisodes}集超出当前人物关系/冲突分层可支撑的容量（约${capacityEpisodes}集），中后期易注水、重复打脸、靠新角色空降续命`);

  const fixes: string[] = [];
  if (story < 65) fixes.push(en ? 'Before green-light, write one line: what the lead wants — who blocks — what emotional reward each reveal buys' : '先用一句话写清“主角想要什么—谁阻挡—每揭一层换来什么情绪回报”，再立项');
  if (feasibility < 70) fixes.push(en ? 'Replace big set pieces with enclosed micro-scenes (dinner table/elevator/market) and drive conflict through relationships to cut cost' : '把大场面替换成饭桌/电梯/菜市场等封闭微场景，用关系杠杆制造冲突以降本');
  if (epOver) fixes.push(en
    ? `Either trim to ~${capacityEpisodes} episodes, or add capacity before green-light: a second goal for the lead, an escalating antagonist tier, or a parallel payoff subplot`
    : `要么压缩到${capacityEpisodes}集左右，要么立项前先扩容量：再立一条主角目标线、让反派升一级、或开一条并行兑付的副线`);
  fixes.push(en ? 'Make sure something happens within the first 2 minutes of episode 1: trouble, who pressures, how to fight back, why keep watching' : '确认第一集前2分钟内“出事”：主角遇到的麻烦、谁在逼、怎么反击、为什么必须看，四者齐备');

  let decision: PitchDecision = 'HOLD';
  if (total >= 72 && story >= 65 && costHits.length <= 2 && !epOver) decision = 'GO';
  else if (total < 48 || story < 45) decision = 'NO';
  const decisionText = en
    ? (decision === 'GO' ? 'Green-light: core holds, move to outline' : decision === 'HOLD' ? 'Hold: fix the items below before green-light' : 'Do not green-light yet: story core/conflict space too thin, a new topic costs less')
    : (decision === 'GO' ? '建议立项：核心成立，可进入大纲阶段' : decision === 'HOLD' ? '缓议：按下方修改建议补齐后再立项' : '暂不建议立项：故事内核或冲突空间不足，换题更省成本');

  // c197：超容量被拦截时，"建议集数"必须给出可执行的容量值；若仍回显计划集数（如300），
  // 决议卡就会与同卡 risks/fixes 里的"压缩到110集"自相矛盾。未超载时尊重用户计划或给默认档。
  const episodes = epOver
    ? capacityEpisodes
    : (input.episodes && input.episodes > 0 ? input.episodes : story >= 80 ? 80 : 60);
  return {
    decision, decisionText,
    logline: idea.slice(0, 60),
    relations: input.relation || (en ? '(To add: interest/emotional relationships among main characters)' : '（待补充：主要人物之间的利益/情感关系）'),
    conflictSpace: input.conflict || (en ? '(To add: how many conflict layers and what pays off at each stage)' : '（待补充：冲突能分几层、各阶段兑付什么）'),
    episodes,
    capacityEpisodes,
    audience: input.audience || (en ? 'To define (Market suggests locking gender/age band first)' : '待明确（市场评估建议先锁定性别/年龄段）'),
    medium: input.medium || (costHits.length >= 2 ? (en ? 'AI-realistic / motion-comic (avoid costly live-action)' : 'AI仿真人/漫剧（规避高成本实拍）') : (en ? 'Live-action works; AI-realistic can amplify the premise' : '真人实拍即可，AI仿真人可放大设定')),
    difficulty: feasibility >= 75 ? (en ? 'Low' : '低') : feasibility >= 55 ? (en ? 'Medium' : '中') : (en ? 'High' : '高'),
    scores: { market, story, feasibility, novelty, total },
    risks, fixes,
  };
}

/** 主角登场四连问（《最值钱的不是演员》）：出场不能只交代“她是谁”，2分钟内必须让观众知道四件事 */
export function firstAppearanceCheck(opening: string, lang: WrLang = 'zh'): {
  trouble: boolean; oppressor: boolean; counterPlan: boolean; mustWatch: boolean; missing: string[]; score: number;
} {
  const en = lang === 'en';
  const t = String(opening || '');
  const trouble = en ? /(trouble|dilemma|crisis|force|kick|owe|called off|fire|frame|threat|debt|divorce|break up|misdiagnos|lost)/i.test(t) : /麻烦|困境|出事|逼|赶|欠|退婚|开除|陷害|困|刁难|威胁|逼债|离婚|分手|误诊|丢/.test(t);
  const oppressor = en ? /(mother-in-law|step|boss|supervisor|ex-|antagonist|rival|creditor|they|them|other side)/i.test(t) : /婆婆|继|老板|上司|前妻|前夫|反派|对方|他们|债主|领导|小三|对手/.test(t);
  const counterPlan = en ? /(plan|going to|decide|fight back|take back|prove|find out|escape|scheme|in secret|counter)/i.test(t) : /准备|打算|决定|计划|反击|夺回|证明|查清|逃|布局|暗中|反手/.test(t);
  const mustWatch = en ? /(secret|truth|identity|twist|little did|turns out|of all people|actually|hidden|foreshadow)/i.test(t) : /秘密|真相|身份|反转|没想到|原来|偏偏|竟然|藏着|马甲|伏笔/.test(t);
  const missing: string[] = [];
  if (!trouble) missing.push(en ? 'What trouble is she/he in right now?' : '她现在遇到什么麻烦？');
  if (!oppressor) missing.push(en ? 'Who is forcing/blocking her/him?' : '是谁在逼她/挡她？');
  if (!counterPlan) missing.push(en ? 'How does she/he plan to fight back?' : '她准备怎么反击？');
  if (!mustWatch) missing.push(en ? 'Why must the viewer keep watching (suspense/contrast/secret)?' : '观众为什么必须继续看（悬念/反差/秘密）？');
  const score = Math.round(([trouble, oppressor, counterPlan, mustWatch].filter(Boolean).length / 4) * 100);
  return { trouble, oppressor, counterPlan, mustWatch, missing, score };
}

/* ============================ 剧本围读 ============================ */

/** 四种参与模式：我+我的小南 / 用户+用户 / 我+别人的小南 / 小南+小南自动围读 */
export type ReadMode = 'me_xn' | 'user_user' | 'me_other_xn' | 'xn_xn';
export interface ReadModeMeta { id: ReadMode; name: string; desc: string; aiAuto: boolean }
export const READ_MODES: ReadModeMeta[] = [
  { id: 'me_xn', name: '我 + 我的小南', desc: '我出剧本，小南分饰责编/导演/制片/观众多立场陪我围读', aiAuto: false },
  { id: 'user_user', name: '用户 + 用户', desc: '邀请其他创作者进入同一围读室，真人逐条讨论（异步，邀请码进入）', aiAuto: false },
  { id: 'me_other_xn', name: '我 + 别人的小南', desc: '我的剧本，邀请对方派 TA 的小南（带 TA 的创作偏好）一起提意见', aiAuto: false },
  { id: 'xn_xn', name: '小南 + 小南', desc: '多个不同立场的小南自动围读、互相辩论，无人值守直接产出修改清单', aiAuto: true },
];
const READ_MODES_EN: ReadModeMeta[] = [
  { id: 'me_xn', name: 'Me + my Xiaonan', desc: 'I supply the script; Xiaonan reads it from editor/director/producer/audience seats', aiAuto: false },
  { id: 'user_user', name: 'User + user', desc: 'Invite other creators into the same room and discuss line by line (async, by invite code)', aiAuto: false },
  { id: 'me_other_xn', name: 'Me + their Xiaonan', desc: 'My script, reviewed by the other person’s Xiaonan carrying their creative preferences', aiAuto: false },
  { id: 'xn_xn', name: 'Xiaonan + Xiaonan', desc: 'Multiple Xiaonan seats read and debate automatically, producing a fix list unattended', aiAuto: true },
];
export function readModes(lang: WrLang = 'zh'): ReadModeMeta[] { return lang === 'en' ? READ_MODES_EN : READ_MODES; }

export type ReadSeatRole = 'editor' | 'director' | 'producer' | 'audience' | 'host';
export const READ_SEATS: { role: ReadSeatRole; name: string; duty: string }[] = [
  { role: 'editor', name: '责编/老师', duty: '开头是否太慢、人物动机、节奏与集数、逻辑是否成立' },
  { role: 'director', name: '导演', duty: '台词是否能念、AI腔、动作与情绪是否够、演员能不能演' },
  { role: 'producer', name: '制片', duty: '场景数量与成本、能不能合并场景、制作难度' },
  { role: 'audience', name: '观众代表', duty: '哪里会划走、钩子够不够、情绪有没有被兑付' },
  { role: 'host', name: '小南记录', duty: '收敛意见、去重、排出优先级、形成修改清单' },
];
const READ_SEATS_EN: { role: ReadSeatRole; name: string; duty: string }[] = [
  { role: 'editor', name: 'Editor', duty: 'Slow opening, character motivation, rhythm & episode count, internal logic' },
  { role: 'director', name: 'Director', duty: 'Speakable lines, AI-speak, action/emotion adequacy, actability' },
  { role: 'producer', name: 'Producer', duty: 'Scene count & cost, scene merging, production difficulty' },
  { role: 'audience', name: 'Audience rep', duty: 'Where viewers swipe away, hook strength, whether emotion is paid off' },
  { role: 'host', name: 'Xiaonan notes', duty: 'Converge, de-duplicate, prioritize and produce the fix list' },
];
export function readSeats(lang: WrLang = 'zh') { return lang === 'en' ? READ_SEATS_EN : READ_SEATS; }

export type Priority = 'P0' | 'P1' | 'P2';
export interface ReadNote {
  seat: ReadSeatRole; seatName: string; kind: string; location: string;
  problem: string; suggestion: string; priority: Priority;
  /**
   * c200 服务端质检规则号（落 /api/generate/projects/:id/fix 的会员闸门只认它，不认可伪造的 dimLabel）：
   *  - lint 派生意见原样透传 iss.rule（如 sainthood/filler），未知号在闸门 fail-closed 按高级深度改写处理；
   *  - 手写意见只在【语义同源】时贴号：台词AI腔=dialog.aiTone、字数偏差=format.length（确属基础润色范畴），
   *    其余（钩子/成本/悬浮等）一律不贴，避免 BASIC 会员借围读包越权调深度改写。
   */
  rule?: string;
}
/**
 * c200 围读结论 → 定点改写包：一条 P0/P1 意见打包成 /fix 可直接消费的结构。
 * fix.rule/fix.dimLabel/fix.advice 与 fixSchema 同契约（60/20/500）；key 确定性，刷新与重放一致。
 */
export interface ReadRewritePack {
  key: string;
  priority: Priority;
  seat: ReadSeatRole; seatName: string;
  kind: string; location: string; problem: string; suggestion: string;
  fix: { rule: string; dimLabel: string; advice: string };
}
/**
 * c197 xn_xn（小南+小南）立场交锋：模式描述承诺"多个不同立场的小南互相辩论"，
 * 引擎结果就必须有对应的交锋结构——同参不同名等于模式名不副实。
 * 一组交锋 = 一席位基于 P0/P1 质检意见提出质询 → 另一实战席位从自身立场反驳 → 主持人裁决可执行改法。
 */
export interface DebateExchange {
  topic: string;
  fromSeat: ReadSeatRole; fromSeatName: string; challenge: string;
  toSeat: ReadSeatRole; toSeatName: string; reply: string;
  verdict: string;
}
/**
 * c198 真人讨论点：有人模式（me_xn/user_user/me_other_xn）房内真人发言经席位信号词确定性归类后进入结论。
 *  - point 保留真人原话（不润色、不杜撰）；adopted=true 表示与引擎同席位独立扫出的意见重合，false 表示引擎没扫到、
 *    属于真人补充的新增关注（制片预算等引擎不可见信息尤其不能蒸发）。
 *  - xn_xn 无人模式 / 空讨论恒为空数组（老 payload.lastRead 无此字段，前端须 Array.isArray 兜底）。
 */
export interface DiscussionPoint {
  seat: ReadSeatRole; seatName: string; point: string; adopted: boolean;
}
export interface TableReadResult {
  notes: ReadNote[];
  actionItems: string[];
  /** c200 P0/P1 意见的定点改写包（与 actionItems 同口径、同顺序），供一键带去作品页 /fix */
  rewritePacks: ReadRewritePack[];
  /** 仅 xn_xn 模式产出（1-2 组确定性交锋）；其余模式为空数组 */
  debates: DebateExchange[];
  /** 仅有人模式且房内存在真人讨论时产出（按席位归类，最多3条）；xn_xn/空讨论为空数组 */
  discussionPoints: DiscussionPoint[];
  scores: { rhythm: number; deAi: number; grounded: number; overall: number };
  sceneCost: { highCostHits: string[]; sceneCount: number; level: string };
  summary: string;
}

const SCENE_HEAD = /(?:^|\n)\s*(?:[#\d\-第\s]*(?:场|景|集)|[△▲*]|内景|外景|日|夜|晨|昏|室内|室外)/g;

function pri(rank: number): Priority { return rank === 0 ? 'P0' : rank === 1 ? 'P1' : 'P2'; }

/**
 * c198 真人讨论 → 围读席位的确定性信号词表（纯规则、可单测、不调模型）。
 * 每个席位一组该职责独有的词：责编管道具/节奏、导演管台词表演、制片管成本工期、观众管钩子留存。
 * 命中数多者得席（打平按 editor→director→producer→audience 职责序），一个席位最多取一条最早发言。
 */
const DISCUSSION_SIGNALS_ZH: { seat: ReadSeatRole; words: string[] }[] = [
  { seat: 'editor', words: ['开头', '开场', '节奏', '动机', '逻辑', '集数', '人设', '太慢', '拖沓', '剧情'] },
  { seat: 'director', words: ['台词', '对白', '书面', '口语', '演员', '表演', '演不出', '没法演', '动作', '表情', 'AI腔', 'ai腔'] },
  { seat: 'producer', words: ['成本', '预算', '经费', '太贵', '花钱', '加场', '新场景', '场景', '换景', '工期'] },
  { seat: 'audience', words: ['划走', '钩子', '爽点', '想看', '无聊', '弃剧', '吸引', '没劲', '追下去'] },
];
const DISCUSSION_SIGNALS_EN: { seat: ReadSeatRole; words: string[] }[] = [
  { seat: 'editor', words: ['opening', 'start', 'pacing', 'motivation', 'logic', 'episode', 'too slow', 'drag', 'setup'] },
  { seat: 'director', words: ['line', 'dialogue', 'actor', 'unplayable', 'playable', 'perform', 'blocking', 'literary', 'wooden', 'deliver'] },
  { seat: 'producer', words: ['cost', 'budget', 'expensive', 'afford', 'new scene', 'reshoot', 'location', 'schedule'] },
  { seat: 'audience', words: ['swipe', 'hook', 'bored', 'boring', 'grab', 'quit', 'retention', 'payoff', 'tuned', 'watch'] },
];
const DISCUSSION_SEAT_ORDER: ReadSeatRole[] = ['editor', 'director', 'producer', 'audience'];
function extractDiscussionPoints(discussion: string, en: boolean, notes: ReadNote[], SN: Record<ReadSeatRole, string>): DiscussionPoint[] {
  const text = String(discussion || '').trim();
  if (!text) return [];
  const signals = en ? DISCUSSION_SIGNALS_EN : DISCUSSION_SIGNALS_ZH;
  // 先按换行、再按句读切分；中英文句末标点都切。过短碎片（语气词/系统消息）不具评审信息量，丢弃。
  const fragments = text.split(/[\r\n]+/)
    .flatMap((line) => line.split(/[。！？；!?;]+/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  const seen = new Set<string>();
  // c199：每席最多保留 2 条——同一席位的不同意见（责编同时提节奏与人设）第二条不得蒸发；
  // 2 条封顶仍防一人刷屏。席内严格按发言到达时间序。
  const PER_SEAT_CAP = 2;
  const perSeat = new Map<ReadSeatRole, { point: string; tokens: string[] }[]>();
  for (const frag of fragments) {
    const hay = en ? frag.toLowerCase() : frag;
    let best: { seat: ReadSeatRole; tokens: string[]; score: number } | null = null;
    for (const cfg of signals) {
      const tokens = cfg.words.filter((w) => hay.includes(en ? w.toLowerCase() : w));
      if (tokens.length && (!best || tokens.length > best.score)) best = { seat: cfg.seat, tokens, score: tokens.length };
    }
    if (!best) continue; // 零信号发言（如"进入围读室"）不归类，更不杜撰
    const list = perSeat.get(best.seat) || [];
    if (list.length >= PER_SEAT_CAP) continue;
    const key = frag.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ point: frag.slice(0, 120), tokens: best.tokens });
    perSeat.set(best.seat, list);
  }
  // 席位轮转展平：第一轮先取各席首条（保证责编/导演/制片/观众立场多样性），第二轮再补同席第二条；
  // 总数封顶 5，截断顺序固定可解释（优先级低的观众席首条之外、同席第三轮最先被舍）。
  const TOTAL_CAP = 5;
  const picked: { seat: ReadSeatRole; point: string; tokens: string[] }[] = [];
  for (let round = 0; round < PER_SEAT_CAP && picked.length < TOTAL_CAP; round++) {
    for (const seat of DISCUSSION_SEAT_ORDER) {
      const item = perSeat.get(seat)?.[round];
      if (item) picked.push({ seat, ...item });
      if (picked.length >= TOTAL_CAP) break;
    }
  }
  return picked.map(({ seat, point, tokens }) => {
    // 采纳判定：同席位引擎意见的 kind/problem/suggestion 是否独立命中了相同信号词；
    // 引擎没扫到（如真人掌握的预算/工期内部信息）→ adopted=false，作为新增关注保留给用户裁决。
    const adopted = notes.some((n) => {
      if (n.seat !== seat) return false;
      const bag = en ? `${n.kind} ${n.problem} ${n.suggestion}`.toLowerCase() : `${n.kind}${n.problem}${n.suggestion}`;
      return tokens.some((tok) => bag.includes(en ? tok.toLowerCase() : tok));
    });
    return { seat, seatName: SN[seat], point, adopted };
  });
}

const PACK_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };
/** 规则号合法字符：质检规则号是英文标识（如 sainthood、dialog.aiTone、format.length），其余一律回退兜底 */
const PACK_RULE_RE = /^[A-Za-z0-9._:-]{1,60}$/;
/**
 * c200 围读结论 → 定点改写包（纯函数：不连库、不调模型、确定性，可对老 payload.lastRead 离线重建）。
 * 口径与 actionItems 严格一致：仅 P0/P1、按优先级稳定排序。脏输入恒返回 []，不抛异常
 * （历史围读结论可能没有 rule/字段缺失，只读端点必须容错）。
 */
export function buildReadRewritePacks(notes: unknown, opts: { lang?: WrLang } = {}): ReadRewritePack[] {
  if (!Array.isArray(notes)) return [];
  const en = opts.lang === 'en';
  return (notes as unknown[])
    .map((n) => (n && typeof n === 'object' ? n as Partial<ReadNote> : null))
    .filter((n): n is ReadNote => !!n && (n.priority === 'P0' || n.priority === 'P1') && !!String(n.suggestion || '').trim())
    .slice()
    .sort((a, b) => PACK_ORDER[a.priority] - PACK_ORDER[b.priority])
    .map((n, i) => {
      const seat = (n.seat || 'editor') as ReadSeatRole;
      const fallbackRule = `read.${seat}.r${i}`;
      const rawRule = String(n.rule || '').trim();
      const rule = PACK_RULE_RE.test(rawRule) ? rawRule : fallbackRule;
      const dimLabel = String(n.kind || '').slice(0, 20);
      const loc = String(n.location || '').trim();
      const advice = `${loc ? `${loc}${en ? ': ' : '：'}` : ''}${String(n.suggestion || '').trim()}`.slice(0, 500);
      return {
        key: `${n.priority}-${seat}-${i}`,
        priority: n.priority,
        seat, seatName: String(n.seatName || ''),
        kind: String(n.kind || ''), location: loc,
        problem: String(n.problem || ''), suggestion: String(n.suggestion || ''),
        fix: { rule, dimLabel, advice },
      };
    });
}

/**
 * AI 围读：四立场用同一套质检尺子扫描同一剧本，各自产出“问题+改法+优先级”，主持人收敛成修改清单。
 * 纯规则即可产出；真实模型在路由层把每条 note 润色得更口语，但不改变结论。
 */
export function aiTableRead(input: { script: string; title?: string; mode?: ScriptMode; modeRead?: ReadMode; discussion?: string }, lang: WrLang = 'zh'): TableReadResult {
  const en = lang === 'en';
  const script = String(input.script || '');
  const mode: ScriptMode = input.mode === 'AIGC' ? 'AIGC' : 'LIVE';
  const notes: ReadNote[] = [];
  const head = script.slice(0, 260);
  const SN = en
    ? { editor: 'Editor', director: 'Director', producer: 'Producer', audience: 'Audience rep', host: 'Xiaonan notes' }
    : { editor: '责编/老师', director: '导演', producer: '制片', audience: '观众代表', host: '小南记录' };

  // —— 共用扫描结果（与生成流水线同一把尺） ——
  const rhythm = rhythmScan(script);
  const ai = antiAiScan(script);
  const grounded = groundedScan(script);
  const generic = genericReactionScan(script);
  const len = validateEpisodeLength(script, mode);
  const fa = firstAppearanceCheck(head, lang);
  const sceneCount = Math.max(1, (script.match(SCENE_HEAD) || []).length);
  const costWordList = en ? HIGH_COST_WORDS_EN : HIGH_COST_WORDS;
  const highCostHits = Array.from(new Set(costWordList.filter((w) => (en ? script.toLowerCase().includes(w.toLowerCase()) : script.includes(w)))));
  const costLevelZh: '低' | '中' | '高' = highCostHits.length >= 3 || sceneCount > 12 ? '高' : highCostHits.length >= 1 || sceneCount > 7 ? '中' : '低';
  const costLevel = en ? ({ 低: 'Low', 中: 'Medium', 高: 'High' } as const)[costLevelZh] : costLevelZh;

  // 责编：开头/动机/节奏/字数
  if (fa.score < 75) {
    notes.push({ seat: 'editor', seatName: SN.editor, kind: en ? 'Slow opening / weak motivation' : '开头太慢/人物动机不足', location: en ? 'First 2 minutes' : '开场前2分钟', problem: en ? `Opening four-question gaps: ${fa.missing.join('; ')}` : `主角登场四连问缺：${fa.missing.join('；')}`, suggestion: en ? 'Do not start with backstory — drop the trouble onto the lead at once, show intent to fight back and plant a suspense' : '不要先交代背景，开场直接把麻烦压到主角身上，并露出她的反击意图与一个悬念', priority: pri(0) });
  }
  if (!rhythm.arc.hook) {
    notes.push({ seat: 'editor', seatName: SN.editor, kind: en ? 'Weak hook' : '钩子弱', location: en ? 'Episode/scene opening' : '集/场开头', problem: en ? 'No clear opening hook' : '缺少明确开场钩子', suggestion: en ? 'Within 3 seconds use direct conflict / strong suspense / extreme contrast to give a can’t-stop reason' : '用直接冲突/强悬念/极致反差之一在3秒内立住停不下来的理由', priority: pri(0) });
  }
  if (!en) rhythm.issues.slice(0, 2).forEach((iss, i) => {
    notes.push({ seat: 'editor', seatName: SN.editor, kind: '节奏问题', location: '整体节奏', problem: String(iss), suggestion: '按“钩子-冲突-转折-留白”重排，张弛有度，不要全程高密度', priority: pri(i) });
  });
  if (en && rhythm.score < 65) {
    notes.push({ seat: 'editor', seatName: SN.editor, kind: 'Rhythm', location: 'Overall rhythm', problem: `Rhythm score ${rhythm.score} is low — tension stays flat or too dense`, suggestion: 'Reorder as hook–conflict–turn–breathing space; alternate tension and release instead of constant high density', priority: pri(1) });
  }
  if (!len.inRange) {
    notes.push({ seat: 'editor', seatName: SN.editor, kind: en ? 'Length deviation' : '字数偏差', location: en ? 'Whole/episode' : '全本/单集', problem: en ? `About ${len.len} chars now; ${mode === 'LIVE' ? 'live-action episodes should be 800-1000 chars' : 'AIGC episodes should be 1200-1500 chars'}` : `当前约${len.len}字，${mode === 'LIVE' ? '真人实拍单集应800-1000字' : 'AIGC单集应1200-1500字'}`, suggestion: en ? 'Add/trim to the standard length; leave room for the director in live-action scripts and enrich audiovisual/inner detail in AIGC scripts' : '按制式字数增删，真人本给导演留发挥空间，AIGC本补足视听与心理细节', priority: pri(1), rule: 'format.length' });
  }

  // 导演：AI腔/通用反应/动作占比
  if (!ai.pass) {
    notes.push({ seat: 'director', seatName: SN.director, kind: en ? 'AI-sounding dialogue' : '台词AI腔', location: en ? 'Dialogue' : '台词', problem: en ? `AI-speak / written-style expressions found (${ai.hitCount} hits)` : `出现AI腔/书面表达：${ai.hits.slice(0, 5).join('、')}`, suggestion: en ? 'Rewrite into spoken lines only this character’s identity/age/region would say; allow pauses, interruptions and catchphrases' : '改成这个人物身份、年龄、地域才说得出口的口语，允许停顿、打断、口头禅', priority: pri(1), rule: 'dialog.aiTone' });
  }
  if (generic.count > 0) {
    notes.push({ seat: 'director', seatName: SN.director, kind: en ? 'Generic reaction' : '通用反应', location: en ? 'Identity/truth reveals' : '身份/真相揭晓处', problem: en ? `Lazy generic shock reactions (${generic.count})` : `偷懒的通用震惊反应：${generic.hits.slice(0, 4).join('、')}`, suggestion: en ? 'Replace generic shock with a specific physical action tied to this character and relationship' : generic.advice, priority: pri(1) });
  }
  if (rhythm.actionRatio < 0.12) {
    notes.push({ seat: 'director', seatName: SN.director, kind: en ? 'Lack of action / actability' : '缺少动作/可拍摄性', location: en ? 'Whole script' : '全篇', problem: en ? 'Long dialogue/narration with low action ratio — no room for actors or camera' : '大段对话与叙述、动作占比偏低，演员和镜头没有发挥空间', suggestion: en ? 'Break inner thought and information into action, props and blocking; talk while doing' : '把心理和信息拆进动作、道具、走位里，边做事边说话', priority: pri(2) });
  }

  // 制片：场景成本
  if (en ? costLevel !== 'Low' : costLevel !== '低') {
    notes.push({ seat: 'producer', seatName: SN.producer, kind: en ? 'High scene cost' : '场景成本高', location: en ? `${sceneCount} scenes` : `${sceneCount}个场景`, problem: en ? `Too many scenes or high-cost elements: ${highCostHits.join(', ') || 'many scenes'}` : `场景偏多或含高成本元素：${highCostHits.join('、') || '场景数较多'}`, suggestion: en ? 'Merge same-location scenes; carry conflict in enclosed micro-scenes (dinner table/elevator/hospital room) to cut moves and sets' : '合并同地点场次，优先用饭桌/电梯/病房等封闭微场景承载冲突，减少转场与置景', priority: (en ? costLevel === 'High' : costLevel === '高') ? pri(0) : pri(2) });
  }

  // 观众：钩子兑付/悬浮/传播标题
  if (grounded.groundedScore < 70) {
    notes.push({ seat: 'audience', seatName: SN.audience, kind: en ? 'Floating / hollow' : '悬浮空洞', location: en ? 'Detail' : '细节', problem: en ? `Insufficient life detail (grounded=${grounded.groundedScore})` : `生活化细节不足（grounded=${grounded.groundedScore}）`, suggestion: en ? 'Add real environment/action/prop/sound details that serve the story so scenes feel lived-in' : '补环境/动作/道具/音效等有叙事作用的真实细节，让场景有烟火气', priority: pri(1) });
  }
  if (input.title) {
    const tp = titlePitchCheck(input.title);
    if (tp.score < 67) {
      notes.push({ seat: 'audience', seatName: SN.audience, kind: en ? 'Weak share hook' : '传播抓手弱', location: en ? 'Title' : '标题', problem: en ? 'The first ~13 chars lack identity + conflict + contrast' : `前13字未齐“身份+冲突+反差”：${tp.advice.join('；')}`, suggestion: en ? 'Front-load the most contrasting identity and conflict into the first 13 chars (buzz ≠ quality)' : '把最有反差的身份和冲突前置到标题前13字（注意：传播热度≠剧本质量）', priority: pri(2) });
    }
  }

  // 一线实战尺子（反派高级度/废话/小说化/降智爽点/主角能动性/压迫兑付/三直接）——v1.92 EN 经 lint-i18n 规则级本地化
  const craft = craftLint({ title: input.title, text: script, lang: en ? 'en' : 'zh' });
  const CRAFT_SEAT: Record<string, { seat: ReadNote['seat']; seatName: string }> = {
    villain: { seat: 'audience', seatName: SN.audience },
    dumbPayoff: { seat: 'audience', seatName: SN.audience },
    parity: { seat: 'audience', seatName: SN.audience },
    directness: { seat: 'audience', seatName: SN.audience },
    novelistic: { seat: 'director', seatName: SN.director },
    filler: { seat: 'editor', seatName: SN.editor },
    agency: { seat: 'editor', seatName: SN.editor },
    firstThree: { seat: 'editor', seatName: SN.editor },
    threeQ: { seat: 'editor', seatName: SN.editor },
  };
  craft.p1.slice(0, 5).forEach((raw) => {
    // v1.92：craft-lint 已原生双语（含英文检测召回），EN 直接采用；不再二次映射
    const iss = raw;
    const seatInfo = CRAFT_SEAT[iss.rule] || { seat: 'editor' as ReadNote['seat'], seatName: SN.editor };
    notes.push({
      seat: seatInfo.seat, seatName: seatInfo.seatName, kind: iss.dim, location: en ? 'Whole script / opening' : '全篇/开场',
      problem: (iss.hit && iss.hit.length) ? `${iss.dim}: ${en ? 'flagged ' : '命中 '}${iss.hit.slice(0, 4).join(en ? ', ' : '、')}` : iss.dim,
      suggestion: iss.advice, priority: 'P1', rule: iss.rule,
    });
  });

  // 进阶情绪/爽感尺子（爽点链路/反派厚度/权谋语法/分层见证/圣母化）——v1.92 EN 本地化
  const emo = emotionCraftLint({ text: script, isIntrigue: en ? /(court|palace|business war|power|faction|throne|succession)/i.test(script) : /权谋|宫斗|商战|朝堂|夺嫡/.test(script), lang: en ? 'en' : 'zh' });
  const EMO_SEAT: Record<string, { seat: ReadNote['seat']; seatName: string }> = {
    payoffChain: { seat: 'audience', seatName: SN.audience },
    payoffTaxonomy: { seat: 'audience', seatName: SN.audience },
    sainthood: { seat: 'audience', seatName: SN.audience },
    villainDepth: { seat: 'editor', seatName: SN.editor },
    powerGrammar: { seat: 'editor', seatName: SN.editor },
    emotionOutline: { seat: 'editor', seatName: SN.editor },
    earlyRetention: { seat: 'editor', seatName: SN.editor },
  };
  emo.p1.slice(0, 4).forEach((raw) => {
    // v1.92：emotion-craft 已原生双语（含英文检测召回），EN 直接采用
    const iss = raw;
    const s = EMO_SEAT[iss.rule] || { seat: 'editor' as ReadNote['seat'], seatName: SN.editor };
    notes.push({ seat: s.seat, seatName: s.seatName, kind: iss.dim, location: en ? 'Whole script / first 10 eps' : '全篇/前10集',
      problem: (iss.hit && iss.hit.length) ? `${iss.dim}: ${iss.hit.slice(0, 4).join(en ? ', ' : '、')}` : iss.dim,
      suggestion: iss.advice, priority: 'P1', rule: iss.rule });
  });

  // 网文迁移结构层（进阶层）：断章点/金手指代价/绝境立人/人设铁三角/情绪债链/死亡催泪/灵魂共犯——v1.92 EN 本地化
  const wn = webnovelLint({ text: script, ending: script, lang: en ? 'en' : 'zh' });
  const WN_SEAT: Record<string, { seat: ReadNote['seat']; seatName: string }> = {
    cliffhanger: { seat: 'director', seatName: SN.director },
    goldenFinger: { seat: 'editor', seatName: SN.editor },
    showByChoice: { seat: 'editor', seatName: SN.editor },
    charEcosystem: { seat: 'audience', seatName: SN.audience },
    debtChain: { seat: 'editor', seatName: SN.editor },
    death: { seat: 'editor', seatName: SN.editor },
    partner: { seat: 'audience', seatName: SN.audience },
  };
  wn.p1.slice(0, 4).forEach((raw) => {
    // v1.93：webnovel-craft 已原生双语（含英文检测召回），EN 直接采用
    const iss = raw;
    const s = WN_SEAT[iss.rule] || { seat: 'editor' as ReadNote['seat'], seatName: SN.editor };
    notes.push({ seat: s.seat, seatName: s.seatName, kind: iss.dim, location: en ? 'Whole script / episode ends' : '全篇/集尾',
      problem: (iss.hit && iss.hit.length) ? `${iss.dim}: ${iss.hit.slice(0, 4).join(en ? ', ' : '、')}` : iss.dim,
      suggestion: iss.advice, priority: 'P1', rule: iss.rule });
  });
  // 人物原型/反派哲学/系统成瘾/张力工艺层（34条方法论）——v1.92 EN 本地化
  const at = archetypeLint({ text: script, opening: head, lang: en ? 'en' : 'zh' });
  const AT_SEAT: Record<string, { seat: ReadNote['seat']; seatName: string }> = {
    atVillainCheap: { seat: 'audience', seatName: SN.audience },
    atSaintMary: { seat: 'audience', seatName: SN.audience },
    atSystemShop: { seat: 'editor', seatName: SN.editor },
    atSubtext: { seat: 'director', seatName: SN.director },
    atFlatOpen: { seat: 'editor', seatName: SN.editor },
    atPortrait: { seat: 'director', seatName: SN.director },
    atHysteria: { seat: 'director', seatName: SN.director },
  };
  at.issues.filter((i) => i.level === 'P1' || i.score < 60).slice(0, 5).forEach((raw) => {
    // v1.93：archetype-craft 已原生双语（含英文检测召回），EN 直接采用
    const iss = raw;
    const s = AT_SEAT[iss.rule] || { seat: 'editor' as ReadNote['seat'], seatName: SN.editor };
    notes.push({ seat: s.seat, seatName: s.seatName, kind: iss.dim, location: en ? 'Whole script / opening' : '全篇/开场',
      problem: (iss.hit && iss.hit.length) ? `${iss.dim}: ${en ? 'flagged ' : '命中 '}${iss.hit.slice(0, 4).join(en ? ', ' : '、')}` : iss.dim,
      suggestion: iss.advice, priority: iss.level === 'P1' ? 'P1' : 'P2', rule: iss.rule });
  });
  // 叙事工艺层（81条方法论）：感官滤镜/情绪标签说道/然后流水账/集尾圆满收束/完美圣人——v1.92 EN 本地化
  const nt = narrativeLint({ text: script, ending: script, lang: en ? 'en' : 'zh' });
  const NT_SEAT: Record<string, { seat: ReadNote['seat']; seatName: string }> = {
    ntFilterWord: { seat: 'director', seatName: SN.director },
    ntEmotionTag: { seat: 'director', seatName: SN.director },
    ntThenChain: { seat: 'editor', seatName: SN.editor },
    ntSatisfiedEnd: { seat: 'audience', seatName: SN.audience },
    ntDespairTell: { seat: 'director', seatName: SN.director },
    ntPerfectSaint: { seat: 'editor', seatName: SN.editor },
  };
  nt.issues.filter((i) => i.score < 60).slice(0, 5).forEach((raw) => {
    // v1.93：narrative-craft 已原生双语（含英文检测召回），EN 直接采用
    const iss = raw;
    const s = NT_SEAT[iss.rule] || { seat: 'director' as ReadNote['seat'], seatName: SN.director };
    notes.push({ seat: s.seat, seatName: s.seatName, kind: iss.dim, location: en ? 'Whole script / episode ends' : '全篇/集尾',
      problem: (iss.hit && iss.hit.length) ? `${iss.dim}: ${iss.hit.slice(0, 4).join(en ? ', ' : '、')}` : iss.dim,
      suggestion: iss.advice, priority: 'P2', rule: iss.rule });
  });

  // 主持人收敛：P0/P1 进修改清单
  const order: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };
  notes.sort((a, b) => order[a.priority] - order[b.priority]);
  const actionItems = notes
    .filter((n) => n.priority !== 'P2')
    .map((n, i) => `${i + 1}.[${n.priority}][${n.seatName}] ${n.suggestion}`);

  const deAi = Math.max(0, 100 - ai.hitCount * 12 - generic.count * 6);
  const overall = Math.round((rhythm.score + deAi + grounded.groundedScore) / 3);
  const p0 = notes.filter((n) => n.priority === 'P0').length;
  let summary = en
    ? (overall >= 80 && p0 === 0
      ? 'Ready for the next draft; polish per P1/P2 notes'
      : `The read found ${notes.length} issues, ${p0} of them P0 to fix first; work through the fix list before the next draft`)
    : overall >= 80 && p0 === 0
      ? '整体可进入下一稿，按P1/P2建议打磨即可'
      : `围读发现 ${notes.length} 处问题，其中 P0 ${p0} 处需先解决，按修改清单逐条改完再进入下一稿`;

  // —— c198 真人讨论进结论：有人模式把房内真人发言按席位归类，重合判"已采纳"、分歧判"新增关注" ——
  // xn_xn 无人模式不消费（自动围读时讨论位本来就不存在）；讨论是表演的前提是结论必须显性交代讨论去向。
  const discussionPoints: DiscussionPoint[] = input.modeRead === 'xn_xn'
    ? []
    : extractDiscussionPoints(String(input.discussion || ''), en, notes, SN);
  if (discussionPoints.length) {
    const adoptedN = discussionPoints.filter((p) => p.adopted).length;
    summary += en
      ? `; ${discussionPoints.length} live discussion point${discussionPoints.length > 1 ? 's' : ''} merged (${adoptedN} converged with the read, ${discussionPoints.length - adoptedN} newly flagged for your call)`
      : `；本房真人讨论 ${discussionPoints.length} 条已并入结论（与小南判断重合 ${adoptedN} 条、新增关注 ${discussionPoints.length - adoptedN} 条待裁决）`;
  }

  // —— c197 xn_xn 立场交锋：READ_MODES 承诺"多个不同立场的小南互相辩论"，结果里就必须有交锋产物 ——
  // 取最重的 1-2 条 P0/P1 意见：质询席基于质检尺子提出问题与改法，反驳席从实战立场顶回，主持人裁决可执行方案。
  const debates: DebateExchange[] = [];
  if (input.modeRead === 'xn_xn') {
    const counterSeat: Record<ReadSeatRole, 'producer' | 'director' | 'editor'> = {
      editor: 'producer', director: 'editor', producer: 'director', audience: 'editor', host: 'producer',
    };
    const rebutZh = {
      producer: '重拍、加场会把预算和工期打爆——能不能不加一场戏、不换一个景就把它解决？',
      director: '节奏意见没法让演员演，得说清具体改哪句台词、哪个走位，不能只给抽象判断。',
      editor: '再为节奏往下砍，人物动机和情绪兑付会更薄——先说清楚哪一拍必须保住？',
    };
    const rebutEn = {
      producer: 'Reshoots and added scenes blow the budget and schedule — can this be fixed without a single new scene or location?',
      director: 'Actors cannot perform an abstract rhythm note — which exact line and blocking change?',
      editor: 'Cutting further for pace thins motivation and emotional payoff — what is the one beat we must keep?',
    };
    const verdictZh = {
      producer: '不加新场景：用现有素材补拍一个特写或道具动作，台词做减法，先改后拍，下次围读复核。',
      director: '把意见落到具体台词与走位：锚定本场一个动作、一句话重写，演员能执行，不搞空泛重排。',
      editor: '保住动机/兑付的关键一拍再按节奏删减；该交代的信息用动作带出，而不是再添台词。',
    };
    const verdictEn = {
      producer: 'No new scenes: add one close-up or prop action from existing material, trim the dialogue, revise before any reshoot, and re-check at the next read.',
      director: 'Land the note on one concrete line and one blocking beat in this scene — something actors can execute, no abstract reshuffle.',
      editor: 'Keep the one motivation/payoff beat, cut the rest for pace, and carry the information through action instead of added lines.',
    };
    for (const n of notes.filter((x) => x.priority !== 'P2').slice(0, 2)) {
      const to = counterSeat[n.seat];
      debates.push({
        topic: n.kind,
        fromSeat: n.seat, fromSeatName: n.seatName,
        challenge: en ? `${n.problem} Proposed fix: ${n.suggestion}` : `${n.problem} 改法：${n.suggestion}`,
        toSeat: to, toSeatName: SN[to],
        reply: en ? rebutEn[to] : rebutZh[to],
        verdict: en ? verdictEn[to] : verdictZh[to],
      });
    }
  }

  // c200：P0/P1 意见打包成 /fix 可消费结构（在排序后构造，与 actionItems 同口径同顺序）
  const rewritePacks = buildReadRewritePacks(notes, { lang });

  return {
    notes, actionItems, rewritePacks, debates, discussionPoints,
    scores: { rhythm: rhythm.score, deAi, grounded: grounded.groundedScore, overall },
    sceneCost: { highCostHits, sceneCount, level: costLevel },
    summary,
  };
}
