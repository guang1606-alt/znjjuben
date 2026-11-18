/**
 * v2.54 用户端黑盒护栏：C 端任何响应/事件不得泄露底层第三方模型厂商、端点、密钥与开发逻辑。
 * 对外统一口径：终南映画自研大模型与 AGI 体系化提示词应用工程。
 * 注意：引擎档 ECONOMY/STANDARD/FLAGSHIP（经济/标准/旗舰）是产品概念，允许出现；
 *      本模块只拦截“厂商/型号/端点”级线索。后台路由不走此护栏。
 */
import { matchModelError } from './model-error-message';

export const VENDOR_LEAK_PATTERNS: RegExp[] = [
  /deepseek/i, /doubao|豆包/i, /seedream|seed[-_ ]?flash|seed[-_ ]?\d|seed2/i,
  /qwen|通义|tongyi|wanx|万相/i, /moonshot|kimi|月之暗面/i, /minimax/i,
  /openai|gpt[-_ ]?\d|chatgpt|dall[- ]?e|gpt-image/i, /anthropic|claude|opus5|sonnet5/i,
  /gemini|aistudio|googleapis/i, /volcengine|火山方舟|ark\.cn-/i, /dashscope|aliyuncs/i,
  /api\.moonshot|api\.minimax|api\.deepseek|api\.openai|api\.anthropic/i,
  /bfl\.ml|stability\.ai|recraft|midjourney|klingai|可灵/i,
  /sk-[a-z0-9]{16,}/i, /bearer\s+[a-z0-9._-]{16,}/i,
];

/** 扫描任意 JSON 可序列化对象，返回命中泄露的字段路径（空数组=干净）。content 类正文字段只查厂商词不查 key 名 */
export function scanVendorLeaks(input: unknown, path = '$', seen = new WeakSet()): string[] {
  const hits: string[] = [];
  if (input == null) return hits;
  if (typeof input === 'string') {
    for (const re of VENDOR_LEAK_PATTERNS) if (re.test(input)) { hits.push(path); break; }
    return hits;
  }
  if (typeof input === 'number' || typeof input === 'boolean') return hits;
  if (typeof input !== 'object') return hits;
  if (seen.has(input as object)) return hits;
  seen.add(input as object);
  if (Array.isArray(input)) {
    input.slice(0, 500).forEach((v, i) => hits.push(...scanVendorLeaks(v, `${path}[${i}]`, seen)));
    return hits;
  }
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    // key 名本身也不许是厂商型号（白名单字段除外）
    if (!/^(engineTier|tier|sandbox|aiLabel)$/.test(k)) {
      for (const re of VENDOR_LEAK_PATTERNS) if (re.test(k)) { hits.push(`${path}.${k}(key)`); break; }
    }
    hits.push(...scanVendorLeaks(v, `${path}.${k}`, seen));
  }
  return hits;
}

/** 清洗发往 C 端的异常消息：内部模型码先转用户话术，任何带厂商线索的报错再统一替换为中性话术，避免错误栈外泄 */
export function sanitizeClientError(message: unknown, lang: 'zh' | 'en' = 'zh'): string {
  const s = String(message ?? '');
  // 先判厂商泄露：报错里带端点/型号时统一走中性话术（优先级高于内部码翻译）
  const leaked = VENDOR_LEAK_PATTERNS.some((re) => re.test(s));
  if (leaked) {
    return lang === 'en'
      ? 'The creative engine is temporarily unavailable. Please retry; points were not charged.'
      : '创作引擎暂时不可用，请稍后重试，未扣除积分。';
  }
  // v2.507：MODEL_/IMAGE_ 机器码不直接见用户（如未配置 Key 应提示去超管后台），转成可操作中文
  const modelErr = matchModelError(s, lang);
  if (modelErr) return modelErr.message;
  return s.slice(0, 300);
}
