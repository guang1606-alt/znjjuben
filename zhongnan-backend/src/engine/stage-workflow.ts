/**
 * 多轮打磨式创作流程（PRD 2.3）
 * 四阶段：梗概大纲 outline → 初稿剧本 draft → 润色优化 polish → 精修定稿 final
 *  - 必须按序推进，可停在任意阶段反复打磨
 *  - 每阶段单独计费（渐进打磨是增值服务，全流程总价高于一键生成，且每阶段都覆盖成本、不赔钱）
 *  - 每阶段有“产出物准入校验”，达不到不允许进入下一阶段
 */

export type StageId = 'outline' | 'draft' | 'polish' | 'final';
export type Tier = 'free' | 'basic' | 'high' | 'pro';

const TIER_FACTOR: Record<Tier, number> = { free: 1, basic: 1, high: 0.8, pro: 0.5 };

export interface StageDef {
  id: StageId;
  order: number;
  label: string;
  roles: string[];
  baseCredits: number;   // 基础会员基准积分（1元=10积分）
  deliverable: string;
  gate: string;          // 进入下一阶段的准入要求
}

export const STAGES: StageDef[] = [
  { id: 'outline', order: 0, label: '梗概大纲', roles: ['剧情架构师', '人设设计师'], baseCredits: 4, deliverable: '核心创意+人物小传+全剧大纲+分集梗概', gate: '必须含人物小传与分集梗概' },
  { id: 'draft', order: 1, label: '初稿剧本', roles: ['单集撰写师'], baseCredits: 10, deliverable: '完整初稿，剧情与台词完整', gate: '必须含场景与角色台词' },
  { id: 'polish', order: 2, label: '润色优化', roles: ['细节润色师', '去AI化校验'], baseCredits: 6, deliverable: '节奏/台词/细节润色，去AI痕迹', gate: '去AI化与节奏分达标' },
  { id: 'final', order: 3, label: '精修定稿', roles: ['合规审核师', '市场分析师'], baseCredits: 4, deliverable: '平台/拍摄/AIGC适配的交付级剧本', gate: '格式与字数达标、合规通过' },
];

export function stageCredits(stage: StageId, tier: Tier): number {
  const def = STAGES.find((s) => s.id === stage)!;
  return Math.max(1, Math.round(def.baseCredits * TIER_FACTOR[tier]));
}

/** 全流程积分（供前端对比“一键生成”） */
export function fullWorkflowCredits(tier: Tier): number {
  return STAGES.reduce((sum, s) => sum + stageCredits(s.id, tier), 0);
}

const ORDER: StageId[] = STAGES.map((s) => s.id);

/** 校验能否从当前阶段进入下一阶段：必须按顺序、前置阶段已完成、当前产出达标 */
export function canAdvance(
  target: StageId,
  completed: StageId[],
  currentArtifact: string,
): { ok: boolean; reason?: string } {
  const ti = ORDER.indexOf(target);
  if (ti === 0) return { ok: true };
  const prev = ORDER[ti - 1];
  if (!completed.includes(prev)) return { ok: false, reason: `需先完成「${STAGES.find((s) => s.id === prev)!.label}」阶段` };
  const gate = stageArtifactOk(prev, currentArtifact);
  if (!gate.ok) return { ok: false, reason: gate.reason };
  return { ok: true };
}

/** 各阶段产出物的最低结构校验（离线，不判文采，只判“有没有”） */
export function stageArtifactOk(stage: StageId, text: string): { ok: boolean; reason?: string } {
  const t = (text || '').trim();
  if (t.length < 20) return { ok: false, reason: '产出内容过少，无法进入下一阶段' };
  if (stage === 'outline') {
    const hasChar = /人物|小传|主角|人设/.test(t);
    const hasEp = /分集|第[一二三四五六七八九十0-9]+集|大纲/.test(t);
    if (!hasChar || !hasEp) return { ok: false, reason: '梗概大纲需包含人物小传与分集/全剧大纲' };
  }
  if (stage === 'draft') {
    const hasScene = /内景|外景|△/.test(t);
    const hasLine = /[一-龥]{1,6}(?:（[^）]*）)?[：:]/.test(t);
    if (!hasScene || !hasLine) return { ok: false, reason: '初稿需包含场景信息与角色台词' };
  }
  return { ok: true };
}
