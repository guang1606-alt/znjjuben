/**
 * v2.54 小南能力 × 会员等级硬闸门（防白嫖：用户无法通过小南调用超出其会员等级的能力）
 * 对齐 PRD 6.2.2：
 *  免费：基础操作引导、FAQ、简单创作建议、基础提醒
 *  基础：创作灵感建议、基础台词润色、余额/进度通知
 *  高级：深度创作建议、人设/剧情优化、个性化题材推荐、长期创作记忆、定制化习惯学习、听剧本
 *  专业：全功能语音操控、专属创作助理、深度市场分析
 * 企业版等同专业。所有判定在服务端执行，前端仅做隐藏/引导，永远不信前端。
 */
import { MemberLevel } from './pricing';

export type AssistantAction =
  | 'guide'                 // 操作引导/FAQ/简单建议（免费）
  | 'inspiration'           // 创作灵感建议
  | 'dialogue_polish'       // 基础台词润色
  | 'notice'                // 余额/进度通知（免费）
  | 'deep_advice'           // 深度创作建议
  | 'character_plot_fix'    // 人设/剧情/节奏深度优化
  | 'personalized_reco'     // 个性化题材/策略推荐
  | 'long_memory'           // 长期创作记忆
  | 'voice_control'         // 全功能语音操控
  | 'dedicated_assistant'   // 专属创作助理
  | 'market_analysis'       // 深度市场分析
  | 'habit_learning'        // 定制化创作习惯学习
  | 'listen_script';        // 听剧本（朗读脚本/语音听稿，基础会员起）

/** 各能力所需最低会员等级 */
const ACTION_MIN_LEVEL: Record<AssistantAction, MemberLevel> = {
  guide: MemberLevel.FREE,
  notice: MemberLevel.FREE,
  inspiration: MemberLevel.BASIC,
  dialogue_polish: MemberLevel.BASIC,
  deep_advice: MemberLevel.ADVANCED,
  character_plot_fix: MemberLevel.ADVANCED,
  personalized_reco: MemberLevel.ADVANCED,
  long_memory: MemberLevel.ADVANCED,
  voice_control: MemberLevel.PRO,
  dedicated_assistant: MemberLevel.PRO,
  market_analysis: MemberLevel.PRO,
  habit_learning: MemberLevel.ADVANCED,
  listen_script: MemberLevel.BASIC,
};

const LEVEL_RANK: Record<MemberLevel, number> = {
  [MemberLevel.FREE]: 0, [MemberLevel.BASIC]: 1, [MemberLevel.ADVANCED]: 2,
  [MemberLevel.PRO]: 3,
};

export interface CapabilityVerdict {
  action: AssistantAction;
  allowed: boolean;
  needLevel: MemberLevel;
  /** 升级引导文案（双语） */
  upsell: { zh: string; en: string };
}

const LEVEL_NAME_ZH: Record<MemberLevel, string> = {
  [MemberLevel.FREE]: '免费用户', [MemberLevel.BASIC]: '基础会员',
  [MemberLevel.ADVANCED]: '高级会员', [MemberLevel.PRO]: '专业会员',
};
const LEVEL_NAME_EN: Record<MemberLevel, string> = {
  [MemberLevel.FREE]: 'Free', [MemberLevel.BASIC]: 'Basic',
  [MemberLevel.ADVANCED]: 'Advanced', [MemberLevel.PRO]: 'Pro',
};

export function assistantGate(level: MemberLevel | string | undefined | null, action: AssistantAction): CapabilityVerdict {
  const lv = (level && LEVEL_RANK[level as MemberLevel] !== undefined ? level : MemberLevel.FREE) as MemberLevel;
  const need = ACTION_MIN_LEVEL[action];
  const allowed = LEVEL_RANK[lv] >= LEVEL_RANK[need];
  return {
    action, allowed, needLevel: need,
    upsell: {
      zh: allowed ? '' : `这项小南能力为${LEVEL_NAME_ZH[need]}及以上专属，当前为${LEVEL_NAME_ZH[lv]}，升级后小南立刻为你启用。`,
      en: allowed ? '' : `This Xiaonan capability requires ${LEVEL_NAME_EN[need]} or above (current: ${LEVEL_NAME_EN[lv]}). Upgrade to unlock.`,
    },
  };
}

/**
 * 针对性优化（fix）按【服务端规则号】映射小南能力。
 * 安全：dimLabel 是展示文本、客户端可任意伪造（BASIC 用户把任意规则标成“台词”即可越权调用深度改写），
 * 因此降级判定只认 rule，且必须命中基础润色规则白名单；未知规则一律按高级深度优化 fail-closed。
 */
const BASIC_FIX_RULE_RE = /^(dialog(ue)?|spoken|colloquial|format|punct|typo|wording|tongue)([._:]|$)/i;

/**
 * c220 驼峰引擎键基础润色白名单：c220 质检 chip 点击即修后，rule 直接传引擎键（dialogueAiTaste
 * 而非 dialogue.ai_taste），旧正则的分隔符断言 ([._:]|$) 对驼峰键全部失配——纯台词病症被
 * 误判为高级深度优化，BASIC 会员平白被挡。此处只收「只改文字表层、不动剧情结构」的键，
 * 安全纪律不变：宁可把 borderline 键留在高级（fail-closed），也不把结构改写放进基础档。
 */
const BASIC_FIX_RULE_KEYS = new Set([
  // 闸门 + 纯台词/文字表层引擎（改写只动台词与文字，不重构场面调度与剧情）
  'tongue', 'dialogueAiTaste', 'dialogueWater', 'dialogueLength', 'dialoguePingpong',
  'dialogueNameCall', 'dialogueFunction', 'echoDialogue', 'expositionDialogue',
  'emotionLabelDialogue', 'rhetoricalBarrage', 'parenOverdirect', 'vagueWord',
  'mirrorVisualDialogue', 'roundRobinDialogue', 'subtextErase', 'voicePrint',
]);

export function fixActionByDim(dimLabel: string, rule = ''): AssistantAction {
  const r = String(rule || '').trim();
  if (BASIC_FIX_RULE_RE.test(r) || BASIC_FIX_RULE_KEYS.has(r)) return 'dialogue_polish';
  return 'character_plot_fix';
}

/** 某等级可见的全部小南能力（前端渲染会员对比与灰显） */
export function assistantCapabilitiesOf(level: MemberLevel | string): { action: AssistantAction; allowed: boolean; needLevel: MemberLevel }[] {
  return (Object.keys(ACTION_MIN_LEVEL) as AssistantAction[]).map((action) => {
    const v = assistantGate(level, action);
    return { action, allowed: v.allowed, needLevel: v.needLevel };
  });
}

export const ASSISTANT_MATRIX = ACTION_MIN_LEVEL;
