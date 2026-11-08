#!/usr/bin/env node
/**
 * v2.485 常驻守卫：定价表里的每一项必须真的被收费代码引用（死配置设卡）。
 *
 * 背景：src/config/pricing.ts 是全站定价唯一真源，VALUE_ADDED 里的每一项都写着一个价
 * （如「听剧本TTS 39 积分/按本」）。但实际实现是「会员权益内、零扣费」，39 积分从未有过
 * 收费代码；同类死配置还有 8 项（零售单集被 EP_PRICE 取代、市场价值评估改为免费只读、
 * 分镜/版权存证/存储扩容从无路由）。这类配置不会让测试变红，却会在下一轮被当成真实现状
 * 引用（写进会员页、写进报价文档、写进运营口径），再纠正就要翻整站。
 *
 * 设卡口径：VALUE_ADDED 的每个键（K）都必须在 src/ 里 pricing.ts 之外被真实代码引用；
 * 只出现在注释里的引用不算（注释说明不是收费实现）。
 *
 * 用法：node scripts/guard-pricing-billing.cjs  → 0 violation 退出码 0，否则逐条列出并退出码 1
 * 测试：test/guard-pricing-billing.test.cjs（真实扫描 + fixture 变异红黑自证）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const PRICING = path.join(SRC_DIR, 'config', 'pricing.ts');
/** 定价表最少项数：低于此值视为结构解析失效，不许假绿 */
const MIN_KEYS = 5;

/** 递归收集 src 下的 .ts 文件（不含 pricing.ts 本身） */
function sourceFiles(dir = SRC_DIR, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) sourceFiles(abs, out);
    else if (name.endsWith('.ts') && abs !== PRICING) out.push(abs);
  }
  return out;
}

/** 去掉注释（块注释 + 整行 // 注释）：注释里提到某个键不等于该键真被收费代码使用 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

/** 从 pricing.ts 文本解析 VALUE_ADDED 的键名 */
function valueAddedKeys(pricingText) {
  const block = (pricingText.match(/export const VALUE_ADDED\s*=\s*\{([\s\S]*?)\n\} as const/) || [])[1] || '';
  const keys = [...block.matchAll(/^\s{2}([A-Z][A-Z0-9_]*)\s*:/gm)].map((m) => m[1]);
  return [...new Set(keys)];
}

/**
 * 纯函数扫描：给定定价文本与「文件 → 源码」集合，返回未被引用的键。
 * 独立出来是为了用 fixture 做变异自证（红黑双向）。
 */
function scanText(pricingText, files) {
  const keys = valueAddedKeys(pricingText);
  if (keys.length < MIN_KEYS) {
    throw new Error(`pricing.ts 的 VALUE_ADDED 只解析出 ${keys.length} 项（< ${MIN_KEYS}），结构已变更，守卫需同步`);
  }
  const corpus = [...files.entries()]
    .map(([file, text]) => ({ file, text: stripComments(text) }))
    .filter((f) => !/[\\/]config[\\/]pricing\.ts$/.test(f.file));
  const violations = [];
  for (const key of keys) {
    const re = new RegExp(`\\b${key}\\b`);
    const hit = corpus.find((f) => re.test(f.text));
    if (!hit) {
      violations.push({
        key,
        snippet: 'src/ 内无任何收费代码引用（只在定价表/注释里出现 = 死配置）',
      });
    }
  }
  return violations;
}

/** 全量扫描当前仓库 src/ */
function scanProject() {
  const pricingText = fs.readFileSync(PRICING, 'utf8');
  const files = new Map(sourceFiles().map((abs) => [abs, fs.readFileSync(abs, 'utf8')]));
  return scanText(pricingText, files);
}

if (require.main === module) {
  try {
    const v = scanProject();
    if (v.length === 0) {
      console.log('guard-pricing-billing: 0 violation（VALUE_ADDED 每一项都有真实收费代码引用）');
      process.exit(0);
    }
    console.error(`guard-pricing-billing: ${v.length} violation（定价表存在从未被收费代码引用的死配置）`);
    v.forEach((x) => console.error(`  ${x.key} ← ${x.snippet}`));
    process.exit(1);
  } catch (e) {
    console.error('guard-pricing-billing 扫描失败：' + (e && e.message));
    process.exit(1);
  }
}

module.exports = { scanProject, scanText, valueAddedKeys, stripComments, MIN_KEYS };
