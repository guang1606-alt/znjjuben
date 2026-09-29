/**
 * lint-i18n.ts —— 围读深度质检（craft/emotion/webnovel/archetype/narrative 五大中文知识库）
 * 的规则级英文本地化层。
 *
 * 设计：五个质检引擎的检测逻辑与中文建议保持单一事实来源（不复制算法）；
 * 英文围读时按稳定的 rule id 把 dim/advice 映射为英文，并剥离命中词里的非 ASCII 片段，
 * 保证英文输出零中文。检测词库的英文召回在各引擎内增量播种，与此解耦。
 */
import type { LintLevel } from './craft-lint';

export interface LocalizableIssue {
  rule: string; dim: string; level: LintLevel | string;
  hit?: string[]; advice: string; score?: number;
}

interface EnRule { dim: string; advice: string }

/** key = issue.rule；覆盖 craft-lint / emotion-craft / webnovel-craft / archetype-craft / narrative-craft 全部规则 */
export const EN_LINT: Record<string, EnRule> = {
  // —— craft-lint 一线实战尺子 ——
  villain: { dim: 'Antagonist sophistication', advice: 'Do not let the antagonist rage or be evil for no reason. Use calm, matter-of-fact “dimensional deprivation”: quietly take what belongs to the lead through rules/class/contract (credit, quota, position). Quiet suffocation ignites anger better than yelling; then the counter-strike lands.' },
  filler: { dim: 'Opening information density', advice: 'Put an emotional chip (conflict action / cutting line / a deprivation event) in the first three lines. Cut hundreds of words of inner grievance or yelling matches. Short drama competes on information and payoff chips, not florid setup.' },
  novelistic: { dim: 'De-novelization (visualizability)', advice: 'Do not write short drama like a novel. Turn “he was furious” into “he smashed the cup”; turn “she was miserable” into a visible action. Convert all inner states into actable, shootable action, dialogue and confrontation.' },
  dumbPayoff: { dim: 'Payoff intelligence', advice: 'Retire kneeling/slapping/forced-dumb-villain/mindless-power fantasy. Upgrade to “smart cognitive strikes”: the composed lead uses industry rules, contract clauses and an evidence chain to make the rival self-destruct — respecting the viewer’s intelligence.' },
  agency: { dim: 'Lead agency / emotional payoff', advice: 'The lead may be kind but not weak, may reason but not only reason. Short drama is emotional payoff: when pressed, fight back. Cut explaining/enduring; add on-the-spot evidence, cancelled deals, counter-moves that make doubters regret.' },
  parity: { dim: 'Pressure–counter payoff', advice: 'The harder the pressure, the more satisfying the counter must be; the more arrogant the rival, the clearer the price. Once emotion is raised it must not be dropped. Add a counter action matching the scale of oppression.' },
  directness: { dim: 'Three directness (conflict/emotion/goal)', advice: 'Viewers give only seconds: the opening must show at a glance who bullies whom, who fights back, what the lead wants. Be direct in conflict, emotion and goal — be effective first, refined second.' },
  firstThree: { dim: 'First-three-episode rhythm', advice: 'The first three episodes decide survival: Ep1 put the lead in trouble and plant a hook (no backstory first); Ep2 keep pressing and build anticipation; Ep3 deliver a small counter or a clear hope of one. Do not slow-burn.' },
  title: { dim: 'At-a-glance title appeal', advice: 'It is not novelty but “want-to-watch at a glance”: no prose-y, guessing titles. State plainly who is wronged / who rises / by what means / where the satisfaction is.' },
  threeQ: { dim: 'Three questions per episode', advice: 'Every episode must answer: what the lead wants, who blocks it, and why the viewer must watch the next (end hook / information gap / secret). Missing any one and the episode drifts.' },
  // —— emotion-craft 情绪/爽感 ——
  emotionOutline: { dim: 'Emotion outline', advice: 'Plan the emotional curve before plot beats: mark the lead’s emotional state and the audience’s expected feeling per episode so emotion rises in steps instead of staying flat or jumping.' },
  payoffChain: { dim: 'Payoff chain', advice: 'Every setup must have a payoff and every payoff needs a prior buildup. Trace the setup→withhold→release chain; remove dangling threads and cluster small payoffs to keep the chain unbroken.' },
  villainDepth: { dim: 'Antagonist depth', advice: 'Give the antagonist their own interest, logic and even a reasonable standpoint; a smart, self-justifying rival makes the lead’s victory valuable. Avoid one-note evil.' },
  powerGrammar: { dim: 'Power-play grammar', advice: 'For intrigue/palace/business-war material, express power through resources, rules, information asymmetry and leverage exchanges — not blunt shouting. Show who controls what and how power shifts.' },
  payoffTaxonomy: { dim: 'Payoff taxonomy', advice: 'Vary payoff types (face-slap, identity reveal, justice, competence, emotional comfort, reversal). Avoid lazy “everyone present gasps” witnesses; design layered, specific witnesses and reactions for each payoff.' },
  earlyRetention: { dim: 'Early retention (first 10 eps)', advice: 'Front-load hooks, conflicts and mini-payoffs in the first 10 episodes; each episode ends on an open loop. Cut slow background so new viewers are retained before any slow stretch.' },
  sainthood: { dim: 'Lead sainthood', advice: 'Avoid an overly saintly lead who forgives instantly with no boundary. Let the lead have edge, self-interest and conditions for forgiveness so the emotional payoff is earned rather than hollow.' },
  // —— webnovel-craft 网文迁移 ——
  cliffhanger: { dim: 'Episode-end cliffhanger', advice: 'End on an unresolved crisis/reveal/choice rather than a fully closed scene. Avoid fake cliffhangers that the next episode instantly dissolves with no consequence.' },
  goldenFinger: { dim: 'Cheat ability & its cost', advice: 'A golden finger/system needs a cost, limit or cooldown to create tension and anticipation; reject an “all-you-can-use shop” that removes all stakes.' },
  showByChoice: { dim: 'Character through choices', advice: 'Reveal character through hard choices under pressure, not adjective labels. When values collide, the option the lead picks defines them.' },
  charEcosystem: { dim: 'Character emotional triangle', advice: 'Build at least three emotional dimensions/relations around the lead (ally, rival, mirror/kin) so conflict and emotion can circulate instead of relying on a single antagonist.' },
  backcast: { dim: 'Ending-backcast outline', advice: 'Decide the ending payoff first, then backcast the beats and foreshadowing needed to reach it, so every scene advances the promised ending.' },
  debtChain: { dim: 'Emotional debt chain', advice: 'Track emotional debts (wrongs owed, favors, secrets) and repay each with interest; do not tie everything off neatly at once — stagger repayments to sustain pull.' },
  death: { dim: 'Death as tear-jerker', advice: 'Make death land through accumulated relationship detail and unfinished wishes, not gore or on-the-nose mourning. Earn grief with setup before the loss.' },
  partner: { dim: 'Partner / female-lead depth', advice: 'Give the partner/co-lead their own goal and agency rather than a decorative “vase”; their arc should intersect and challenge the lead’s.' },
  // —— archetype-craft 原型/系统/张力 ——
  atVillainCheap: { dim: 'Antagonist depth', advice: 'Avoid cheap trash-talking villains; give them composed, rule-based means of pressure and a self-consistent motive so defeating them feels earned.' },
  atSaintMary: { dim: 'Lead edge', advice: 'Avoid instant, boundary-less forgiveness. Let the lead keep an edge and reconcile only after the other side pays a price.' },
  atSystemShop: { dim: 'System addiction design', advice: 'Design the system around cost/blind-box/causality to create craving and anticipation, not a price-tag convenience store that hands out wins.' },
  atSubtext: { dim: 'Dialogue subtext', advice: 'Avoid on-the-nose lines that state feelings directly. Let characters say one thing while meaning another through word choice, omission and deflection.' },
  atFlatOpen: { dim: 'Golden opening', advice: 'Open with trouble + a face of pressure + the lead’s active intent + a secret/contrast; avoid front-loading setting exposition.' },
  atPortrait: { dim: 'Character distinctiveness', advice: 'Replace static appearance/adjective descriptions with distinguishing actions, speech habits and choices so each character is recognizable without a label.' },
  atHysteria: { dim: 'Authentic emotional eruption', advice: 'A breakdown should externalize through staged physical detail and broken speech, not a list of emotion labels; build pressure before the eruption so it feels real.' },
  // —— narrative-craft 叙事工艺 ——
  ntFilterWord: { dim: 'Show, don’t tell', advice: 'Cut filter/telling words (felt/saw/knew/realized) and render the scene directly through action and sense detail.' },
  ntEmotionTag: { dim: 'Embodied dialogue', advice: 'Replace emotion tags (“she said angrily”) with body-level expression (gesture, breath, pause, action) that carries the feeling.' },
  ntThenChain: { dim: 'Causal chain', advice: 'Avoid a “then… then…”流水账; link scenes by cause-and-effect so each beat results from the previous one.' },
  ntSatisfiedEnd: { dim: 'Episode-end open loop', advice: 'Do not fully resolve at an episode end; leave an open question/reversal/choice to pull the viewer onward.' },
  ntPerfectSaint: { dim: 'Human wrinkles', advice: 'Give even good characters small flaws, contradictions and selfish moments; flawless saints feel fake and kill tension.' },
  ntDespairTell: { dim: 'Externalizing breakdown', advice: 'Do not label despair; externalize a collapse through concrete behavior, environment and fragmented speech the camera can capture.' },
};

const CJK = /[一-龥]/;
/** 把一条中文质检 issue 本地化为英文（rule 未登记时回退：dim/advice 用通用英文，避免泄漏中文） */
export function localizeLintIssueEn(iss: LocalizableIssue): LocalizableIssue {
  const hit = (iss.hit || []).filter((h) => !CJK.test(h));
  const rule = EN_LINT[iss.rule];
  return {
    ...iss,
    dim: rule?.dim || `Craft check (${iss.rule})`,
    advice: rule?.advice || 'Revise per this craft rule: strengthen conflict, agency and payoff while cutting telling and filler.',
    hit,
  };
}
