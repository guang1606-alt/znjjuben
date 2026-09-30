/**
 * 供应商余额监控纯函数（v2.612）：
 * · classifyAlertLevel：阈值→告警分级（NORMAL/LOW/CRITICAL/UNKNOWN）
 * · pickBalanceQueryStrategy：vendor→查询策略（自动查/手动填）
 * · summarizeBalances：聚合一批供应商最新余额→总体告警态
 *
 * 纯函数、不依赖 DB/网络；可离线对拍。
 */

export type AlertLevel = 'NORMAL' | 'LOW' | 'CRITICAL' | 'UNKNOWN';

/**
 * 阈值→告警分级：
 * · null → UNKNOWN
 * · > 2×threshold → NORMAL
 * · (threshold, 2×threshold] → LOW
 * · ≤ threshold → CRITICAL
 */
export function classifyAlertLevel(balanceYuan: number | null, thresholdYuan: number): AlertLevel {
  if (balanceYuan === null || balanceYuan === undefined || Number.isNaN(balanceYuan)) return 'UNKNOWN';
  const t = Number(thresholdYuan) || 0;
  if (balanceYuan > 2 * t) return 'NORMAL';
  if (balanceYuan > t) return 'LOW';
  return 'CRITICAL';
}

export interface BalanceQueryStrategy {
  auto: boolean;
  method?: 'GET' | 'POST';
  endpoint?: string;
  docUrl: string;
}

const DEEPSEEK_DOC = 'https://api-docs.deepseek.com/zh-cn/',
  MOONSHOT_DOC = 'https://platform.moonshot.cn/docs/api/misc#%E6%9F%A5%E8%AF%A2%E8%B4%A6%E6%88%B7%E4%BD%99%E9%A2%9D',
  MANUAL_DOC = 'https://console.volcengine.com/api/ | https://bailian.console.aliyun.com/ | https://platform.minimaxi.com/';

/**
 * vendor→查询策略：
 * · deepseek/moonshot → auto=true（提供 API 查余额端点）
 * · volcengine/aliyun/minimax/未知 → auto=false（手动填值，附控制台文档）
 */
export function pickBalanceQueryStrategy(vendor: string): BalanceQueryStrategy {
  const v = (vendor || '').toLowerCase();
  if (v === 'deepseek') {
    return { auto: true, method: 'GET', endpoint: 'https://api.deepseek.com/user/balance', docUrl: DEEPSEEK_DOC };
  }
  if (v === 'moonshot' || v === 'kimi' || v === '月之暗面') {
    return { auto: true, method: 'GET', endpoint: 'https://api.moonshot.cn/v1/users/me/balance', docUrl: MOONSHOT_DOC };
  }
  // 其余厂商无公开余额查询 API，仅手动填值
  return { auto: false, docUrl: MANUAL_DOC };
}

export interface ProviderBalanceRow {
  providerId: string;
  providerName: string;
  vendor: string;
  balanceYuan: number | null;
  thresholdYuan: number;
  alertLevel?: AlertLevel;
}

export interface BalanceSummary {
  total: number;
  critical: string[];
  low: string[];
  unknown: string[];
  worstLevel: AlertLevel;
}

const PRIORITY: Record<AlertLevel, number> = { NORMAL: 0, UNKNOWN: 1, LOW: 2, CRITICAL: 3 };

/**
 * 聚合一批供应商最新余额→总体告警态。
 * · total：非 null 余额累加
 * · 三列表：落入对应分级的 providerId 列表
 * · worstLevel：最严重的分级（CRITICAL > LOW > UNKNOWN > NORMAL）
 * 若行未带 alertLevel 字段，按 balanceYuan+thresholdYuan 现场推断。
 */
export function summarizeBalances(rows: ProviderBalanceRow[]): BalanceSummary {
  const critical: string[] = [], low: string[] = [], unknown: string[] = [];
  let total = 0;
  let worst: AlertLevel = 'NORMAL';
  for (const r of rows) {
    const level = r.alertLevel ?? classifyAlertLevel(r.balanceYuan, r.thresholdYuan);
    if (r.balanceYuan !== null && r.balanceYuan !== undefined && !Number.isNaN(r.balanceYuan)) {
      total += r.balanceYuan;
    }
    if (level === 'CRITICAL') critical.push(r.providerId);
    else if (level === 'LOW') low.push(r.providerId);
    else if (level === 'UNKNOWN') unknown.push(r.providerId);
    if (PRIORITY[level] > PRIORITY[worst]) worst = level;
  }
  return { total, critical, low, unknown, worstLevel: worst };
}
