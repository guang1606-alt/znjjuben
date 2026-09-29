/**
 * 每日 API 选型体检（v2.187）
 * ------------------------------------------------------------------
 * 模型"当下最强/最便宜"无法离线自证：本模块不假装能自动发现新模型，
 * 而是把"距上次人工联网核对多少天"变成每天可见的提醒：
 *   · <7 天 fresh；>=7 天 due（该核对了）；>=14 天 overdue（必须核对）；
 *   · portfolioSelfCheck 不通过（国产替补缺失等结构性问题）立即升级 due；
 *   · 超管联网核对价格/停服公告/新旗舰后点"已核对" → 写 MODEL_REVIEW_ACK，基准日刷新。
 * 厂商价格/控制台链接 2026-09-29 核实；如厂商改版以官网最新地址为准。
 */
import { portfolioSelfCheck } from './model-catalog';

/** catalog 型号/单价基准日（与 admin 组合全景 FAQ 的"2026-08 公开价"口径一致）；每次 ACK 后基准日前移 */
export const CATALOG_PRICING_AS_OF = '2026-08-01';
/** 超过该天数未核对 → due（亮黄） */
export const REVIEW_DUE_DAYS = 7;
/** 超过该天数未核对 → overdue（亮红） */
export const REVIEW_OVERDUE_DAYS = 14;

export type ReviewLevel = 'fresh' | 'due' | 'overdue';
type SelfCheckResult = ReturnType<typeof portfolioSelfCheck>;

export interface VendorReviewLink {
  vendor: string;
  models: string;
  pricingUrl: string;
  consoleUrl: string;
}

export interface ModelReviewStatus {
  level: ReviewLevel;
  due: boolean;
  daysSinceReview: number;
  baseDate: string;
  checkedToday: boolean;
  title: string;
  message: string;
  checklist: string[];
  vendors: VendorReviewLink[];
  selfCheckOk: boolean;
  selfCheckIssues: number;
  upgradeHints: number;
}

/** 各厂商"当期在卖什么 + 价格页 + 控制台"，提醒超管逐家核对（2026-09-29 口径） */
export const VENDOR_REVIEW_LINKS: VendorReviewLink[] = [
  {
    vendor: 'DeepSeek 深度求索', models: 'DeepSeek-V4.1-Flash（旧 deepseek-v4-flash 名已自动路由）/ V4-Pro 正式版',
    pricingUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
    consoleUrl: 'https://platform.deepseek.com/',
  },
  {
    vendor: '字节火山方舟（豆包/Seedream，亦可同入口调 DeepSeek、GLM）',
    models: 'Doubao-Seed-2.1-pro / 2.1-turbo / 2.1-lite（2.0-pro/code 已退出模型广场）、Seedream 5.0',
    pricingUrl: 'https://www.volcengine.com/docs/82379/1099320',
    consoleUrl: 'https://console.volcengine.com/ark',
  },
  {
    vendor: '阿里云百炼（通义/万相）', models: 'Qwen3.8-Max（1M 上下文）/ 通义万相',
    pricingUrl: 'https://help.aliyun.com/zh/model-studio/model-pricing',
    consoleUrl: 'https://bailian.console.aliyun.com/',
  },
  {
    vendor: '月之暗面 Kimi（平台已迁至 kimi.com，旧 moonshot.cn 跳转）', models: 'Kimi K3（1M）/ K2.6 / K2.7-Code',
    pricingUrl: 'https://platform.kimi.com/docs/pricing/chat',
    consoleUrl: 'https://platform.kimi.com/',
  },
  {
    vendor: 'MiniMax 稀宇（国内站）', models: 'MiniMax-M3（≤512k 五折价同 M2.5）/ M2.7；M2.5 为历史模型',
    pricingUrl: 'https://platform.minimaxi.com/docs/guides/pricing-paygo',
    consoleUrl: 'https://platform.minimaxi.com/',
  },
  {
    vendor: 'OpenAI（海外·预留档）', models: 'GPT-5.x 系列 / gpt-image',
    pricingUrl: 'https://platform.openai.com/docs/pricing',
    consoleUrl: 'https://platform.openai.com/',
  },
  {
    vendor: 'Anthropic（海外·预留档）', models: 'Claude Sonnet 5 / Opus 5',
    pricingUrl: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
    consoleUrl: 'https://console.anthropic.com/',
  },
  {
    vendor: 'Google（海外·预留档）', models: 'Gemini 3.x Pro',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    consoleUrl: 'https://aistudio.google.com/',
  },
];

const CHECKLIST = [
  '停服/EOL：逐家核对模型广场在售状态，已停服或退出目录的型号先登记替代品、跑通验证后再切换（当前重点：豆包 Seed-2.0 系列）',
  '单价变动：按价格页核对 catalog 单价（注意高峰/空闲、按上下文分段计价就高取值）；任何涨价都要重算×2铁底，击穿先涨价不降配',
  '新一代/新旗舰：出现新型号先同题横评（中文去AI味/长文结构/逻辑挑漏/稳定性），不唯榜单，确认更强再在后台换型',
  '真实账单：拉近 7 天 ModelCallLog 实际消耗，用实付单价校准成本估算，缓存命中率一并核对',
  '国产替补：每岗首选与国产替补各发一条真实请求确认可连通；图片模型各跑一张验收图，海外断供时兜底必须立得住',
];

/** 两个日期之间的日历日差（按 UTC 年月日，b - a），可为负 */
export function calendarDayDiff(a: Date, b: Date): number {
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((db - da) / 86400000);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 计算当下的 API 选型体检状态。
 * @param lastAckAt 超管最近一次"已核对"时间；null 时以 catalog 基准日起算
 * @param now 当前时间（注入便于测试）
 * @param selfCheck 组合自检结果（注入便于测试，默认实时跑 portfolioSelfCheck）
 */
export function modelReviewStatus(
  lastAckAt: Date | null,
  now: Date = new Date(),
  selfCheck: SelfCheckResult = portfolioSelfCheck(),
): ModelReviewStatus {
  const base = lastAckAt ?? new Date(`${CATALOG_PRICING_AS_OF}T00:00:00Z`);
  const daysSinceReview = Math.max(0, calendarDayDiff(base, now));
  let level: ReviewLevel;
  if (daysSinceReview >= REVIEW_OVERDUE_DAYS) level = 'overdue';
  else if (daysSinceReview >= REVIEW_DUE_DAYS) level = 'due';
  else level = 'fresh';
  // 结构性问题（如某岗无国产替补）不容忍：即使刚核对过也要亮黄灯
  if (level === 'fresh' && !selfCheck.ok) level = 'due';

  const checkedToday = !!lastAckAt && daysSinceReview === 0;
  const title = level === 'overdue'
    ? `API 选型已 ${daysSinceReview} 天未人工核对（红线 ${REVIEW_OVERDUE_DAYS} 天）`
    : level === 'due'
      ? `API 选型该核对了（距上次 ${daysSinceReview} 天）`
      : `API 选型状态新鲜（${daysSinceReview} 天前刚核对）`;
  const message = level === 'fresh'
    ? '近期已人工核对。模型"当下最强/最便宜"无法离线自证，仍建议扫一眼厂商停服公告；组合自检通过。'
    : '新模型发布、老型号停服与调价都可能让现有组合不再最优甚至直接报错。请按下方清单逐家核对价格页/模型广场与后台真实账单，确认后点"今日已核对"刷新基准日。';
  return {
    level, due: level !== 'fresh', daysSinceReview,
    baseDate: ymd(base), checkedToday, title, message,
    checklist: CHECKLIST, vendors: VENDOR_REVIEW_LINKS,
    selfCheckOk: selfCheck.ok,
    selfCheckIssues: selfCheck.issues.length,
    upgradeHints: selfCheck.upgradeHints.length,
  };
}

/** 落 LearningReport.summary 的精简 JSON */
export function reviewSummary(s: ModelReviewStatus) {
  return {
    level: s.level, due: s.due, daysSinceReview: s.daysSinceReview, baseDate: s.baseDate,
    checkedToday: s.checkedToday, selfCheckOk: s.selfCheckOk,
    selfCheckIssues: s.selfCheckIssues, upgradeHints: s.upgradeHints,
    vendors: s.vendors.map((v) => ({ vendor: v.vendor, pricingUrl: v.pricingUrl })),
  };
}

/** 落 LearningReport.text 的纯文本报告 */
export function buildReviewText(s: ModelReviewStatus): string {
  const lines = [
    `【每日 API 选型体检】状态=${s.level} 距上次人工核对=${s.daysSinceReview}天 基准日=${s.baseDate}`,
    s.title,
    s.message,
    `组合自检：${s.selfCheckOk ? '通过' : `不通过（${s.selfCheckIssues} 个替补/铁底问题）`}；升级建议 ${s.upgradeHints} 条`,
    '',
    '人工核对清单：',
    ...s.checklist.map((c, i) => `${i + 1}. ${c}`),
    '',
    '厂商价格页 / 控制台：',
    ...s.vendors.map((v) => `- ${v.vendor}（${v.models}）\n  价格 ${v.pricingUrl}\n  控制台 ${v.consoleUrl}`),
    '',
    '核对完成后在超管后台点"今日已核对"，本提醒归零。',
  ];
  return lines.join('\n');
}
