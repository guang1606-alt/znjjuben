#!/usr/bin/env node
/**
 * v2.475 常驻守卫：前端积分价与后端定价表脱钩设卡。
 *
 * 背景：定价唯一真源是 src/config/pricing.ts（VALUE_ADDED / EP_PRICE / 会员折扣 / 邀请奖励）。
 * 但前端文案里的「N 积分 / N pts」是手写的（i18n.js 的 PK 一处曾写「内部免费」，
 * 后端实际扣 20 积分；同类漂移靠人眼每轮复读整站抓不住）。
 *
 * 设卡口径（低噪声、可长期常驻）：
 *   ①把 pricing.ts 中出现的所有整数收成「合法价集合」（含由 points×折扣/成本地板推导不出的
 *     常见值由真源数字覆盖，避免重复实现折扣公式导致守卫自身漂移）；
 *   ②扫描 web/*.js、web/*.html 里所有 `数字 + 积分/pts` 字面量；
 *   ③不在合法集合内的数字即视为「定价文案漂移」，逐条列出文件:行。
 *
 * 为什么用「全量整数集合」而不是关键词映射：价格文案语义分散（按钮、提示、tip、i18n），
 * 关键词映射必然漏配并制造假绿；而「前端写出的每个价必须曾是定价真源里的数」是必要不充分但
 * 零维护、可长期咬红漂移的不变量（99 积分这类凭空价格会被直接抓出）。
 *
 * 用法：node scripts/guard-pricing-copy.cjs  → 0 violation 退出码 0，否则列出并退出码 1
 * 测试：test/guard-pricing-copy.test.cjs（真实扫描 + fixture 变异红黑自证）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRICING = path.join(ROOT, 'src', 'config', 'pricing.ts');
const WEB_DIR = path.join(ROOT, 'web');
const WEB_FILES = fs.readdirSync(WEB_DIR).filter((f) => /\.(js|html)$/.test(f)).sort();

/** 额外合法值：0=权益内/员工免费，1=1分×10=10分（0.1 元）最小计价单位 */
const BASE_ALLOWED = new Set([0, 1]);

/** 价格文案形态：`20 积分` / `20积分` / `20 pts` / `20 points` */
const PRICE_RE = /(\d+)\s*(积分|pts|points)/gi;

function pricingSource() {
  return fs.readFileSync(PRICING, 'utf8');
}

/**
 * 会员折扣后的档位价（与 pricing.ts 的 vaPointsForLevel 同式）：
 * floor = ceil(costFen×2/10)（毛利≥2 倍地板），价 = max(floor, round(points×rate))。
 * 必须在此重算，否则「Pro 拆解 18 pts」这类由 30×0.6 推导出的价会被误判为凭空价。
 */
function derivedLevelPoints(text) {
  const block = (text.match(/export const VALUE_ADDED\s*=\s*\{([\s\S]*?)\n\} as const/) || [])[1] || '';
  const rates = [...((text.match(/VA_LEVEL_RATE[\s\S]*?\};/) || [''])[0]).matchAll(/:\s*([\d.]+)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0 && n <= 1);
  const out = new Set();
  for (const m of block.matchAll(/points:\s*(\d+),\s*costFen:\s*(\d+)/g)) {
    const points = Number(m[1]);
    const floor = Math.ceil((Number(m[2]) * 2) / 10);
    out.add(points);
    (rates.length ? rates : [1]).forEach((rate) => {
      out.add(Math.max(floor, Math.round(points * rate)));
    });
  }
  return out;
}

/** 从定价真源收集合法价集合；真源结构变化（缺关键常量/数字骤减）时直接抛错，不许假绿 */
function allowedPoints(src) {
  const text = src || pricingSource();
  for (const must of ['VALUE_ADDED', 'EP_PRICE', 'VA_LEVEL_RATE', 'INVITE']) {
    if (!text.includes(must)) throw new Error(`pricing.ts 缺少 ${must}，定价结构已变更，守卫需同步`);
  }
  const nums = [...text.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));
  if (nums.length < 30) throw new Error(`pricing.ts 仅解析出 ${nums.length} 个整数，疑似格式变更导致扫描失效`);
  const allowed = new Set(BASE_ALLOWED);
  nums.forEach((n) => allowed.add(n));
  derivedLevelPoints(text).forEach((n) => allowed.add(n));
  return allowed;
}

/** 扫描一段文本，返回越界价格 {file,line,snippet,value} */
function scanSource(text, file, allowed) {
  const set = allowed || allowedPoints();
  const out = [];
  const seen = new Set();
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(PRICE_RE)) {
      const value = Number(m[1]);
      // 同一行 en/zh 双语文案常写同一价格两次，按 行+值 去重，报告不刷屏
      const key = i + ':' + value;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!set.has(value)) {
        out.push({ file, line: i + 1, value, snippet: line.trim().slice(0, 120) });
      }
    }
  });
  return out;
}

/** 全量扫描前端 web 目录 */
function scanProject(allowed) {
  const set = allowed || allowedPoints();
  return WEB_FILES.flatMap((f) => {
    const abs = path.join(WEB_DIR, f);
    return scanSource(fs.readFileSync(abs, 'utf8'), 'web/' + f, set);
  });
}

if (require.main === module) {
  try {
    const v = scanProject();
    if (v.length === 0) {
      console.log('guard-pricing-copy: 0 violation（前端积分价全部命中定价真源）');
      process.exit(0);
    }
    console.error(`guard-pricing-copy: ${v.length} violation（前端积分价与 pricing.ts 脱钩）`);
    v.forEach((x) => console.error(`  ${x.file}:${x.line}  ${x.value} ← ${x.snippet}`));
    process.exit(1);
  } catch (e) {
    console.error('guard-pricing-copy 扫描失败：' + (e && e.message));
    process.exit(1);
  }
}

module.exports = { scanProject, scanSource, allowedPoints, pricingSource };
