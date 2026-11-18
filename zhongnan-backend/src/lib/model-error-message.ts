/**
 * v2.507 模型调用失败的对用户话术（无 Key / 供应商故障降级体验）
 * ------------------------------------------------------------------
 * model-proxy 内部用 MODEL_* / IMAGE_* 机器码表达失败原因，这些码只该进日志与监控，
 * 绝不能原样展示给用户。本模块把机器码翻译成「用户看得懂 + 知道下一步做什么」的中文，
 * 同时保留 code 供前端分支；任何供应商原始报文（含 key 报错详情）一律丢弃。
 *
 * 调用方：generate SSE 失败分支（经 blackbox.sanitizeClientError）、
 *        增值服务（海报/PK/小南）、编剧室、采访等付费或用户可见的失败出口。
 */

export type ErrorLang = 'zh' | 'en';

export interface FriendlyModelError {
  /** 稳定的机器码（内部错误码首位 token；未知错误为 MODEL_UNKNOWN） */
  code: string;
  /** 可直接展示给用户的文案，绝不包含厂商/端点/密钥/英文堆栈 */
  message: string;
}

interface Rule {
  test: RegExp;
  zh: string;
  en: string;
}

/** 顺序敏感：先匹配更具体的失败类型，再落到通用兜底 */
const RULES: Rule[] = [
  {
    test: /(MODEL|IMAGE)_NOT_CONFIGURED/,
    zh: '创作引擎尚未接入真实模型服务：请联系管理员在超管后台填写 API Key 后重试。本次不扣积分。',
    en: 'The creative engine is not connected to a real model yet. Please ask the admin to configure the API key, then retry. No points were charged.',
  },
  {
    test: /(MODEL|IMAGE)_FATAL_HTTP_40[13]/,
    zh: '模型服务鉴权失败（API Key 无效或已过期），请联系管理员在超管后台更新密钥后重试。本次不扣积分。',
    en: 'Model authentication failed (invalid or expired API key). Please ask the admin to update the key, then retry. No points were charged.',
  },
  {
    test: /(AUDIT|DataInspection|内容审核|SENSITIVE|content.?policy)/i,
    zh: '内容未通过平台审核，请调整描述或剧情后重试。本次不扣积分。',
    en: 'The content did not pass moderation. Please revise the description or story and retry. No points were charged.',
  },
  {
    test: /(_TRANSIENT_HTTP_429|RATE_LIMIT|TOO_MANY_REQUESTS)/i,
    zh: '模型服务当前排队较多，请稍后重试。本次不扣积分。',
    en: 'The model service is busy right now. Please retry in a moment. No points were charged.',
  },
  {
    test: /(TIMEOUT|ETIMEDOUT|_TRANSIENT_HTTP_408)/,
    zh: '模型服务响应超时，请稍后重试。本次不扣积分。',
    en: 'The model service timed out. Please retry later. No points were charged.',
  },
  {
    test: /(CANCELLED|MODEL_ABORTED)/,
    zh: '生成已取消，本次不扣积分。',
    en: 'Generation was cancelled. No points were charged.',
  },
  {
    test: /(EMPTY_CONTENT|BAD_RESPONSE)/,
    zh: '模型返回内容为空或格式异常，请重试。本次不扣积分。',
    en: 'The model returned empty or malformed content. Please retry. No points were charged.',
  },
  {
    test: /(MODEL|IMAGE)_FATAL_HTTP_400/,
    zh: '内容被模型服务拒绝，请调整后重试。本次不扣积分。',
    en: 'The model service rejected the request. Please adjust and retry. No points were charged.',
  },
  {
    test: /(_TRANSIENT_HTTP_|ECONNRESET|ECONNREFUSED|ENOTFOUND|NETWORK|SOCKET)/i,
    zh: '模型服务暂时不可用，请稍后重试。本次不扣积分。',
    en: 'The model service is temporarily unavailable. Please retry later. No points were charged.',
  },
];

const GENERIC: Record<ErrorLang, string> = {
  zh: '生成失败，本次不扣积分，请稍后重试。',
  en: 'Generation failed and no points were charged. Please retry later.',
};

/** 提取内部码首位 token（如 MODEL_FATAL_HTTP_401），取不到则 UNKNOWN */
function codeOf(message: string): string {
  const m = message.match(/\b((?:MODEL|IMAGE)_[A-Z0-9_]+|CANCELLED)\b/);
  return m ? m[1] : 'MODEL_UNKNOWN';
}

/**
 * 命中已知模型失败类型时返回中文话术；非模型错误（如业务校验「项目不存在」）返回 null，
 * 由调用方决定是否原样透出，避免误伤已有中文提示。
 */
export function matchModelError(e: unknown, lang: ErrorLang = 'zh'): FriendlyModelError | null {
  const s = String((e as Error)?.message ?? e ?? '');
  if (!s) return null;
  for (const rule of RULES) {
    if (rule.test.test(s)) return { code: codeOf(s), message: lang === 'en' ? rule.en : rule.zh };
  }
  return null;
}

/** 模型失败一律给可展示文案；未命中时用通用兜底（仍保证中文、不泄露原始报文） */
export function friendlyModelError(e: unknown, lang: ErrorLang = 'zh'): FriendlyModelError {
  return matchModelError(e, lang) ?? { code: codeOf(String((e as Error)?.message ?? e ?? '')), message: GENERIC[lang] };
}

/**
 * HTTP 失败出口常用：模型错误 → 中文可操作话术；业务校验错误（如「积分不足」）→ 原样返回。
 * 保证 error 字段永远可直接展示，内部机器码另走 modelErrorCode。
 * 非模型且不含中文的异常（Prisma / 堆栈 / 英文断言）一律换成通用中文，避免内部细节外泄。
 */
export function userMessageOf(e: unknown, lang: ErrorLang = 'zh'): string {
  const hit = matchModelError(e, lang);
  if (hit) return hit.message;
  const raw = String((e as Error)?.message ?? e ?? '');
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw;
  return GENERIC[lang];
}

/** 内部机器码（未知错误为 MODEL_UNKNOWN），供前端分支与日志检索 */
export function modelErrorCode(e: unknown): string {
  return codeOf(String((e as Error)?.message ?? e ?? ''));
}

/**
 * HTTP 响应体附加字段：只有确属模型失败才下发 { code }，业务错误（「积分不足」「项目不存在」）返回 {}。
 * 否则业务失败会被前端拿到 MODEL_UNKNOWN，误判成模型故障并走错误的提示/重试路径。
 */
export function modelErrorMeta(e: unknown): { code?: string } {
  return matchModelError(e) ? { code: modelErrorCode(e) } : {};
}
