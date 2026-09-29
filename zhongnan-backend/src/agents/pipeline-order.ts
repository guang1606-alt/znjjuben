/**
 * 多岗位流水线顺序（v2 梳理）
 * 关键修正：市场分析不是只在最后打分，而是【两次出现】——
 *   market_pre 立项前置（题材热度/受众/爽点方向/平台尺度，先定对不对路），
 *   market_post 成稿后置（六维评分/价值评估/投稿匹配，验证卖不卖得掉）。
 * 双校验为质量门，不合格回退撰写/润色；合规在成稿后、市场终评前。
 * 岗位数量不是固定7：可随模型能力演进增并（如新增观众代言、拆解岗），由本顺序表唯一编排。
 */

export type StageKind = 'llm' | 'gate' | 'local';
export interface PipelineStage {
  key: string;
  role: string;
  kind: StageKind;
  order: number;
  reworkTo?: string;      // 门岗不通过回退到哪个岗
  label: string;
}

export const PIPELINE_ORDER: PipelineStage[] = [
  // v2.191 修正：market_pre 实际是 buildCreationContext 上下文注入（题材/受众/爽点/平台尺度），不调 LLM；
  //   market_post 是唯一的 market LLM 调用（六维评分），ROLE_TO_ROUTE 的 'market' 路由即服务于它
  { key: 'market_pre', role: 'market', kind: 'local', order: 1, label: '市场定位（前置：buildCreationContext 注入题材/受众/爽点/平台尺度，不调 LLM）' },
  { key: 'architect', role: 'architect', kind: 'llm', order: 2, label: '剧情架构师（大纲/节拍/黄金三秒钩子）' },
  { key: 'character', role: 'character', kind: 'llm', order: 3, label: '人设设计师（人物小传/关系/成长弧/台词风格）' },
  { key: 'writer', role: 'writer', kind: 'llm', order: 4, label: '单集撰写师（强制消费大纲+人设写本集）' },
  { key: 'audience', role: 'audience', kind: 'llm', order: 5, label: '观众代言官（预判划走点，倒逼强化）' },
  { key: 'polish', role: 'polish', kind: 'llm', order: 6, label: '细节润色师（整稿修订、去AI腔、烟火气）' },
  { key: 'consistency', role: 'consistency', kind: 'gate', order: 7, reworkTo: 'writer', label: '一致性校验门（consistencyCheck 规则函数 pass/misses，不过回撰写）' },
  // v2.191 修正：deai 是 buildDims 规则评分维度（基于 antiAi.hitCount + OnCue 引擎加权），不调 LLM、不单独门岗拒绝回退；
  //   其分数纳入 fixLoop 2 轮修复循环由润色岗重写，reworkTo 语义不符已移除
  { key: 'deai', role: 'deai', kind: 'local', order: 8, label: '去AI化评分（buildDims 规则维度，纳入 fixLoop 修复循环，不单独门岗回退）' },
  { key: 'compliance', role: 'compliance', kind: 'llm', order: 9, label: '合规审核师（平台尺度/内容安全）' },
  { key: 'market_post', role: 'market', kind: 'llm', order: 10, label: '市场终评（后置：六维评分/价值/投稿匹配，唯一的 market LLM 调用）' },
];

export function orderedStages(): PipelineStage[] {
  return [...PIPELINE_ORDER].sort((a, b) => a.order - b.order);
}
/** 顺序合理性自检：市场前置必须在架构之前；市场终评必须在最后；门岗必须声明回退目标 */
export function validateOrder(stages = PIPELINE_ORDER): string[] {
  const errs: string[] = [];
  const idx = Object.fromEntries(stages.map((s) => [s.key, s.order]));
  if (!(idx.market_pre < idx.architect)) errs.push('市场前置必须早于架构');
  const maxOrder = Math.max(...stages.map((s) => s.order));
  if (idx.market_post !== maxOrder) errs.push('市场终评必须在最后');
  if (!(idx.consistency < idx.compliance && idx.deai < idx.compliance)) errs.push('双校验必须在合规之前');
  stages.filter((s) => s.kind === 'gate').forEach((g) => { if (!g.reworkTo) errs.push(`门岗${g.key}缺少回退目标`); });
  const orders = stages.map((s) => s.order);
  if (new Set(orders).size !== orders.length) errs.push('阶段order不能重复');
  return errs;
}
