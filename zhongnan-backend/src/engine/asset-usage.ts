// —— v2.165 资产引用统计（c160 功能轮：三族"沉淀→引用→体检→检索"闭环的运营观测面）——
// 痛点：立项引用把资产快照进 project.bible.{castAssets,propAssets,sceneAssets}（保留 asset id），
// usedCount 是"历史累计立项次数"（项目删除不减、多次立项累加），用户看不到"资产当前被哪些剧引用"。
// 本文件提供零 IO 纯函数：扫描用户项目列表的 bible 快照，按 asset id 聚合引用明细。
// 口径约定：usedCount = 历史累计引用次数（热度）；本函数结果 = 当前仍引用的项目明细（实时）。
// 两者互补不改写：usedCount 保持既有语义（立项 increment:1，v2.153 时序修复），实时数由本函数按需计算。

export interface AssetUsageRef {
  projectId: string;
  projectTitle: string | null;
  status: string;
}

/**
 * 聚合三族资产引用明细：projects（当前用户项目，含 bible）→ { [assetId]: 引用项目列表 }。
 * 防御面：projects 非数组 / 条目非对象 / bible 缺家族键 / 快照非数组 → 全部安全跳过；
 * 快照条目无合法 id（历史脏数据）跳过——按名字归账会误并同名档（dup_name 家族教训：名字不是身份）。
 */
export function buildAssetUsageMap(
  projects: any[],
  familyKey: 'castAssets' | 'propAssets' | 'sceneAssets',
): Record<string, AssetUsageRef[]> {
  const out: Record<string, AssetUsageRef[]> = {};
  if (!Array.isArray(projects)) return out;
  for (const p of projects) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) continue;
    const bible = (p as any).bible;
    const list = bible && typeof bible === 'object' ? bible[familyKey] : null;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = item && typeof item === 'object' && typeof item.id === 'string' ? item.id : '';
      if (!id) continue;
      (out[id] ||= []).push({
        projectId: p.id,
        projectTitle: typeof p.title === 'string' ? p.title : null,
        status: typeof p.status === 'string' ? p.status : '',
      });
    }
  }
  return out;
}
