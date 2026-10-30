import { isSceneOrTitleLine } from './script-scenes';
import { cliffhangerScore } from './cliffhanger-score';

/**
 * v2.349 跨集钩子瞬间化解检测（Cliffhanger Dissolve Check）——接钩质量半边
 * ------------------------------------------------------------------
 * 分工边界（先证伪再坐实，避免与邻居重复定罪）：
 *  - opening-continuity-check(v2.80)：查承接【有无】——前集结尾说话人/词汇在开场是否消失；
 *    它不看语义质量——开场人物都在、词也重叠，第一句"逗你玩的"把上集枪口指头消解了，它不报警。
 *  - memory-fakeout-check：查【同集内】已发生重大事件（死亡/背叛）原来是梦；不管跨集钩子消解。
 *  - cliffhanger-score：评本集结尾抛钩硬度（抛钩端）；不管下集接不接（接钩端）。
 *  - 本引擎：上集抛了实质钩（reversal/crisis/reveal/mystery 强钩 / emotional/action_cut 中钩），
 *    本集开场窗口内出现消解锚（虚惊一场/原来是误会/开玩笑/逗你玩/装的/演习/道具枪…）
 *    → 假承接，付费观众为上集钩子点进来，开场一句话被消解=被骗感最强的一刀（弃剧点）。
 *
 * 合法手法豁免：消解锚后紧跟「但/然而/突然 + 新危机」= 假化解真升级的反转手法，不罚。
 * 消解窗口：正文前 300 字（剔除场头/剧名行）——消解发生在开场越早越恶劣；
 * 窗口外的"误会/玩笑"是正常剧情（misunderstanding-drag 只管拖太久），不归本引擎。
 * 纯确定性、零 LLM、零 IO；中英双语。
 */

export type DsLang = 'zh' | 'en';

export interface DissolveIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export interface DissolveResult {
  score: number;
  /** prevEnding 有效（≥20 字）才检测；第 1 集/无焊点 checked=false 满分放行 */
  checked: boolean;
  /** 上集结尾识别到的钩子类型（cliffhanger-score 同源） */
  prevHookType: string;
  /** 钩子类型中文名（供前端显示） */
  prevHookLabel: string;
  /** 是否判定为「开场消解上集钩子」 */
  dissolved: boolean;
  /** 命中的消解锚原文（无则 ''） */
  dissolveAnchor: string;
  /** 是否触发「假化解真升级」豁免 */
  escalateExempt: boolean;
  issues: DissolveIssue[];
}

// —— 消解锚：一句话把上集紧张态作废的宣告 ——
const DISSOLVE_ZH = /虚惊一场|原来是(?:一场|个)?误会|一场误会|只是(?:个|一场)?误会|开玩笑|逗[你她他]玩|吓唬[你她他]|吓[你她他]的|装的|假装|装死|演戏|演给[你她他]看|演了一?场戏|试探[你她他]|考验[你她他]|试试[你她他]|排练|彩排|演习|拍戏|道具(?:枪|刀|血)|是假的|假血/;
const DISSOLVE_EN = /\b(just kidding|just a joke|only joking|i'?m joking|it was a prank|prank|false alarm|just a misunderstanding|a misunderstanding|only a test|testing you|i was testing|rehears(?:ing|al)|filming|prop gun|prop knife|fake blood|it'?s fake|pretend(?:ing)?|just pretend|fooled you|gotcha)\b/i;

// —— 反升级豁免：消解锚之后紧跟「转折词 + 新危机/反转信号」= 假化解真升级 ——
const ESCALATE_ZH = /(?:但|然而|可是|谁知|没想到|突然|猛然)[^。\n]{0,40}(?:枪口|刀|撞|抓|杀手|真相|身份|血|死|爆炸|报警|围堵|逼近|冲[向过来]|围住)/;
const ESCALATE_EN = /\b(?:but|however|suddenly|then)\b[^.\n]{0,60}\b(?:gun|knife|killer|truth|blood|dead|death|explosion|police|ambush|charged|swarmed)\b/i;

/** 消解检测窗口：正文前 300 字（剔除场头/剧名行后） */
const DISSOLVE_WINDOW = 300;
/** 反升级窗口：消解锚命中点之后 120 字 */
const ESCALATE_WINDOW = 120;

/** 强钩（被消解 → high）；其余有信号钩（emotional/action_cut → mid） */
const STRONG_HOOKS = new Set(['reversal', 'crisis', 'reveal', 'mystery']);

export function cliffhangerDissolveCheck(prevEnding: string, draft: string, lang: DsLang = 'zh'): DissolveResult {
  const isZh = lang === 'zh';
  const base: DissolveResult = {
    score: 100, checked: false, prevHookType: 'none', prevHookLabel: isZh ? '无钩子' : 'None',
    dissolved: false, dissolveAnchor: '', escalateExempt: false, issues: [],
  };
  const ending = (prevEnding ?? '').trim();
  if (ending.length < 20) return base; // 第 1 集/无焊点：满分放行

  const text = (draft ?? '').replace(/\r\n?/g, '\n');
  if (text.trim().length < 20) return { ...base, checked: true };

  // 上集钩子类型判定（cliffhanger-score 同源，抛钩端结论直接复用）
  const hook = cliffhangerScore(ending, lang);
  const out: DissolveResult = {
    ...base, checked: true, prevHookType: hook.type, prevHookLabel: hook.typeLabel,
  };
  // 无实质钩（none/weak）→ 没有可化解的东西，放行
  if (hook.type === 'none' || hook.type === 'weak') return out;

  // 消解窗口：剔除场头/剧名行后取前 300 字
  const body = text.split('\n').map((l) => l.trim()).filter((l) => l && !isSceneOrTitleLine(l, lang));
  const window = body.join('\n').slice(0, DISSOLVE_WINDOW);

  const m = window.match(isZh ? DISSOLVE_ZH : DISSOLVE_EN);
  if (!m) return out;

  // 反升级豁免：消解锚后 120 字内出现「转折 + 新危机」→ 合法反转手法
  const after = window.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + ESCALATE_WINDOW);
  if ((isZh ? ESCALATE_ZH : ESCALATE_EN).test(after)) {
    return { ...out, escalateExempt: true };
  }

  const strong = STRONG_HOOKS.has(hook.type);
  const issue: DissolveIssue = strong
    ? {
        severity: 'high',
        type: 'cliffhanger_dissolved',
        evidence: isZh
          ? `上集${hook.typeLabel}被开场「${m[0]}」一句话消解`
          : `Previous ${hook.typeLabel} hook dissolved by opening "${m[0]}"`,
        advice: isZh
          ? '上集抛了强钩，本集开场必须正面承接：让危机真实落地（有人付出代价/局面升级），或在对抗中反转推进；用"虚惊/误会/开玩笑"一句话作废上集钩子，付费观众当场弃剧。要么真接，要么假化解后立刻用更大的危机再升级。'
          : 'A strong hook was thrown last episode; this opening must cash it for real: let the crisis land (someone pays, the situation escalates) or turn it in confrontation. Dissolving it with "just kidding / a misunderstanding" tells paying viewers they were cheated. Cash it for real — or fake-dissolve then immediately escalate harder.',
      }
    : {
        severity: 'mid',
        type: 'soft_hook_dissolved',
        evidence: isZh
          ? `上集${hook.typeLabel}被开场「${m[0]}」消解`
          : `Previous ${hook.typeLabel} hook dissolved by opening "${m[0]}"`,
        advice: isZh
          ? '情感/动作钩被开场一句话消解，追更张力被放掉：让情绪余波多落半拍（人物反应、后果露头）再翻篇，或用新信息把悬念接上。'
          : 'A soft hook dissolved in one line deflates binge tension: let the emotional aftermath land half a beat (reaction, visible consequence) before moving on, or bridge the suspense with new information.',
      };
  out.issues = [issue];
  out.dissolved = true;
  out.dissolveAnchor = m[0];
  out.score = Math.max(0, 100 - (strong ? 22 : 12));
  return out;
}

/**
 * v2.368 接钩质量前置教学（buildCliffhangerDissolveDirective）
 * ------------------------------------------------------------------
 * 与 cliffhangerDissolveCheck 同源同文件（v2.157 铁律）：五类消解锚、300 字窗口、
 * 120 字反升级豁免、strong 22 / soft 12 分级逐条反向前置，撰写师与润色师首轮一次写对。
 */
export function buildCliffhangerDissolveDirective(mode: 'LIVE' | 'AIGC' = 'LIVE', lang: DsLang = 'zh'): string {
  if (lang === 'en') {
    return [
      '[Pre-write iron rule · Hook payoff — cash last episode\'s hook, never dissolve it in one line] This checklist shares the exact criteria of cliffhangerDissolveCheck. It only applies when the previous episode ended (20+ chars) on a substantive hook: reversal / crisis / reveal / mystery (strong), emotional / action cut (soft). Episode 1, endings under 20 chars, and none/weak hooks are not checked — skip this rule.',
      'Scoring window: the first 300 characters of this episode\'s body (scene headers and title lines excluded). A dissolve anchor inside that window cancels the previous hook:',
      '1) A crisis that was never real: "false alarm", "just a misunderstanding", "it was all a misunderstanding". Fix: let the crisis land for real — someone pays a price, the situation truly escalates.',
      '2) A threat played as a joke: "just kidding", "fooled you", "I was only scaring you". Fix: treat the threat as real; the person from last episode really acts or really speaks.',
      '3) Real events turned into performance: "pretend", "I was acting", "rehearsal", "we were filming". Fix: keep the event real, only change who is exploiting the "performance".',
      '4) Conflict turned into a test: "I was testing you", "just a test", "I had to try you". Fix: let the conflict run on real interests; a test may be one layer only.',
      '5) Weapons turned into props: "prop gun", "prop knife", "fake blood", "it\'s fake". Fix: the swap must be visible inside the story (the gun is empty but the knife is real) and the price must be paid on screen.',
      'Grading: a strong hook dissolved = high, -22; a soft hook (emotional / action cut) dissolved = mid, -12.',
      'Only legal exemption: within 120 characters after the anchor, a turn word (but/however/yet/suddenly/then) plus a NEW crisis (gun/knife/killer/truth/identity/blood/death/explosion/police/ambush/closing in) reads as fake-dissolve-then-escalate and is not penalized. If you use it, write the escalation fully: fake dissolve, then immediately a bigger threat.',
      'Boundaries: whether this episode\'s own ending throws a hard hook belongs to cliffhanger-score (the throwing side); which episode pays off a registered hook belongs to the payoff ledger (hookPayoffDirective); a same-episode "it was a dream" belongs to memory-fakeout; a misunderstanding dragged past the window belongs to misunderstanding-drag; whether the opening reconnects characters and wording belongs to the opening weld (opening-continuity). This checklist only governs "is the previous hook cancelled by a dissolve anchor in the first 300 characters, and is any fake dissolve escalated within 120 characters".',
      mode === 'AIGC'
        ? 'AIGC format: no triangle action lines in the body; let the crisis land through continuous action and (inner: …); never use narration to announce "it was nothing".'
        : 'LIVE format: write the payoff as standalone triangle action lines — he really pulls the trigger (the gun really fires / someone really bleeds), then continue the consequence; a fake dissolve must be followed by a visible new threat in its own line.',
    ].join('\n');
  }
  return [
    '[撰写前置铁律 · 接钩质量——上集抛的钩，本集开场必须正面兑现] 本清单与 cliffhangerDissolveCheck 的检测同源，第一遍就写对。仅当上集结尾 ≥20 字且被识别为实质钩时检测：反转/危机/揭秘/悬念为强钩，情感/动作收束为软钩；第 1 集、前集结尾不足 20 字、无钩（none/weak）不检测，本规则直接跳过。',
    '消解窗口：本集正文前 300 字（剔除场头与剧名行）。窗口内出现下列五类消解锚，等于一句话把上集钩子作废，付费观众当场弃剧：',
    '1）假的危机：「虚惊一场 / 原来是误会 / 一场误会」。替代：让危机真的落地——有人付出代价、局面真的升级。',
    '2）威胁当玩笑：「开玩笑 / 逗你玩 / 吓你的」。替代：把威胁当真，让上一集那个人真的动手或真的开口。',
    '3）真事变表演：「装的 / 假装 / 装死 / 演戏 / 排练 / 彩排 / 演习 / 拍戏」。替代：保留事件为真，只改解释方向（谁在利用这场"表演"）。',
    '4）冲突变测试：「试探你 / 考验你 / 试试你」。替代：让冲突按真实利益推进，测试只作为其中一层。',
    '5）实物变道具：「道具枪 / 道具刀 / 假血 / 是假的」。替代：道具必须是剧情内可见的替换（枪里没子弹但刀是真的），且当场揭示代价。',
    '分级：强钩被消解 high 扣 22；软钩（情感/动作收束）被消解 mid 扣 12。',
    '唯一合法豁免：消解锚之后 120 字内紧跟转折词（但/然而/突然/可是/谁知/没想到）+ 新危机（枪口/刀/杀手/真相/身份/血/死/爆炸/报警/围堵/逼近），读作"假化解真升级"，不罚。要写就把升级写完整：先假化解，立刻抛出更大的危机。',
    '边界：本集结尾抛钩够不够硬归 cliffhanger-score 抛钩端；上集登记钩子在第几集兑现归跨集兑现记账（hookPayoffDirective）；同集内"原来是梦"归 memory-fakeout；窗口外的误会拖太久归 misunderstanding-drag；开场人物与词汇是否接住归开场焊点（opening-continuity）。本清单只管开场前 300 字内"是否用消解锚一句话作废上集钩子，以及假化解后 120 字内有没有真升级"。',
    mode === 'AIGC'
      ? 'AIGC 制式：正文不加 △，危机落地写进连续动作与（内心：…），不用旁白宣布"虚惊一场"。'
      : 'LIVE 制式：兑现写成独占 △ 行——△ 他真的扣下扳机（枪真的响/人真的见血），再写后果；假化解后必须紧跟一行可见的新威胁。',
  ].join('\n');
}
