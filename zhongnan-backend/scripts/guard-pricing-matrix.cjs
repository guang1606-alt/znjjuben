#!/usr/bin/env node
/**
 * v2.487 常驻守卫：会员「可售引擎」与「单集价」必须双向一一对应。
 *
 * 背景：generate.ts 的门控只查 MEMBERSHIP[level].engines（授权即可用），计费却走
 * episodePoints()——后者在 EP_PRICE 缺列时返回 0。两条链路各自都「正常」，组合起来就是
 * 「用户能选该引擎、能跑完整条 LLM 流水线、扣 0 积分」：不报错、不红测试，只在账单上漏营收。
 * 反向漂移同样要命：EP_PRICE 配了价但 engines 没授权 = 死价目，会员页会写出用户永远选不到的档位。
 * 两类都是「名实不符」，且只会在下一次调价/开档时出现，必须机械设卡而不是靠记性。
 *
 * 设卡口径（真值全部从 pricing.ts 文本解析，不手抄矩阵）：
 *   A. 每个等级：engines 的每个档位必须有 >0 的 EP_PRICE；EP_PRICE 的每个档位必须在 engines 里；
 *   B. RESERVED_TIERS（预留档）不得出现在任何 engines / EP_PRICE；
 *   C. 非预留档必须至少有一个等级可售（整档静默下架 = 漏配 engines）；
 *   D. assertNoLoss 必须遍历 Object.keys(ENGINE)，否则新增档位可绕开「售价≥成本×2」铁底。
 *
 * 用法：node scripts/guard-pricing-matrix.cjs → 0 violation 退出码 0，否则逐条列出并退出码 1
 * 测试：test/guard-pricing-matrix.test.cjs（真实仓库扫描 + fixture 红黑变异自证）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRICING = path.join(ROOT, 'src', 'config', 'pricing.ts');
/** 会员等级基线：解析出的等级少于 4 个视为结构变更，不许假绿 */
const MIN_LEVELS = 4;
const LEVELS = ['FREE', 'BASIC', 'ADVANCED', 'PRO'];

function block(text, startRe, endRe) {
  const m = text.match(startRe);
  if (!m || m.index == null) return '';
  const rest = text.slice(m.index + m[0].length);
  const end = rest.search(endRe);
  return end < 0 ? rest : rest.slice(0, end);
}

/** 解析 EP_PRICE：{ LEVEL: { TIER: 积分 } } */
function parseEpPrice(text) {
  const body = block(text, /export const EP_PRICE[^=]*=\s*\{/, /\n\};/);
  const out = {};
  const re = /^\s{2}([A-Z]+)\s*:\s*\{([^}]*)\}/gm;
  let m;
  while ((m = re.exec(body))) {
    const prices = {};
    const pre = /([A-Z]+)\s*:\s*(\d+)/g;
    let p;
    while ((p = pre.exec(m[2]))) prices[p[1]] = Number(p[2]);
    out[m[1]] = prices;
  }
  return out;
}

/** 解析 MEMBERSHIP.engines：{ LEVEL: ['ECONOMY', ...] } */
function parseEngines(text) {
  const body = block(text, /export const MEMBERSHIP\s*=\s*\{/, /\n\} as const;/);
  const out = {};
  const re = /^\s{2}([A-Z]+)\s*:\s*\{([\s\S]*?)^\s{2}\},/gm;
  let m;
  while ((m = re.exec(body))) {
    const arr = m[2].match(/engines\s*:\s*\[([^\]]*)\]/);
    out[m[1]] = arr ? [...arr[1].matchAll(/EngineTier\.([A-Z]+)/g)].map((x) => x[1]) : null;
  }
  return out;
}

/** 解析 ENGINE 的档位键（成本表覆盖哪些档） */
function parseEngineKeys(text) {
  const body = block(text, /export const ENGINE\s*=\s*\{/, /\n\} as const;/);
  return [...body.matchAll(/^\s{2}([A-Z]+)\s*:\s*\{/gm)].map((m) => m[1]);
}

/** 解析 RESERVED_TIERS 预留档 */
function parseReserved(text) {
  const m = text.match(/export const RESERVED_TIERS[^=]*=\s*\[([^\]]*)\]/);
  return m ? [...m[1].matchAll(/EngineTier\.([A-Z]+)/g)].map((x) => x[1]) : [];
}

/**
 * 纯函数扫描：给定 pricing.ts 文本返回 violations。
 * 独立出来是为了用 fixture 做变异自证（红黑双向），而不是只测真实仓库恰好为绿。
 */
function scanText(text) {
  const ep = parseEpPrice(text);
  const engines = parseEngines(text);
  const engineKeys = parseEngineKeys(text);
  const reserved = new Set(parseReserved(text));

  const levels = Object.keys(engines);
  if (levels.length < MIN_LEVELS || Object.keys(ep).length < MIN_LEVELS) {
    throw new Error(`pricing.ts 只解析出 ${levels.length} 个会员等级 / ${Object.keys(ep).length} 组单价（< ${MIN_LEVELS}），结构已变更，守卫需同步`);
  }
  if (engineKeys.length < 3) {
    throw new Error(`ENGINE 成本表只解析出 ${engineKeys.length} 个档位（< 3），结构已变更，守卫需同步`);
  }
  for (const lv of levels) {
    if (!engines[lv] || engines[lv].length === 0) {
      throw new Error(`${lv} 未解析出 engines 数组，结构已变更，守卫需同步`);
    }
  }

  const v = [];
  const push = (key, snippet) => v.push({ key, snippet });

  for (const lv of levels) {
    const sold = engines[lv];
    const priced = Object.keys(ep[lv] || {});
    for (const tier of sold) {
      if (reserved.has(tier)) push(`${lv}+${tier}`, '预留档出现在 engines：尚未开放售卖，用户却能看到/选择');
      const pts = (ep[lv] || {})[tier];
      if (pts == null || pts <= 0) push(`${lv}+${tier}`, '已授权但无有效单集价：用户可选却按 0 积分计费（漏营收）');
    }
    for (const tier of priced) {
      if (!sold.includes(tier)) push(`${lv}+${tier}`, '有单集价但未授权：死价目，用户永远选不到');
    }
  }

  for (const tier of engineKeys) {
    const soldSomewhere = levels.some((lv) => (engines[lv] || []).includes(tier));
    const pricedSomewhere = levels.some((lv) => (ep[lv] || {})[tier] != null);
    if (reserved.has(tier)) {
      if (soldSomewhere) push(tier, '已列 RESERVED_TIERS 却出现在 MEMBERSHIP.engines');
      if (pricedSomewhere) push(tier, '已列 RESERVED_TIERS 却出现在 EP_PRICE');
    } else if (!soldSomewhere) {
      push(tier, '非预留档却没有任何会员可售：整档静默下架/漏配 engines');
    }
  }

  // D. 铁底检查必须数据驱动：手抄档位列表会让新档位绕过「售价≥成本×2」
  const lossBody = block(text, /export function assertNoLoss\(\)[^{]*\{/, /\n\}/);
  if (!/Object\.keys\(ENGINE\)/.test(lossBody)) {
    push('assertNoLoss', '铁底检查必须遍历 Object.keys(ENGINE)：手抄档位列表会让新增档位绕过成本×2');
  }

  // 等级集合一致（避免新增等级只改了 EP_PRICE 没改 MEMBERSHIP 或反之）
  for (const lv of LEVELS) {
    if (!engines[lv]) push(lv, 'MEMBERSHIP 缺少该会员等级（等级集合与定稿不一致）');
    if (!ep[lv]) push(lv, 'EP_PRICE 缺少该会员等级（等级集合与定稿不一致）');
  }

  return v;
}

function scanProject() {
  return scanText(fs.readFileSync(PRICING, 'utf8'));
}

if (require.main === module) {
  try {
    const v = scanProject();
    if (v.length === 0) {
      console.log('guard-pricing-matrix: 0 violation（会员可售引擎与单集价双向一致，铁底覆盖全部档位）');
      process.exit(0);
    }
    console.error(`guard-pricing-matrix: ${v.length} violation（定价矩阵名实不符）`);
    v.forEach((x) => console.error(`  ${x.key} ← ${x.snippet}`));
    process.exit(1);
  } catch (e) {
    console.error('guard-pricing-matrix 扫描失败：' + (e && e.message));
    process.exit(1);
  }
}

module.exports = { scanProject, scanText, parseEpPrice, parseEngines, parseEngineKeys, parseReserved, MIN_LEVELS };
