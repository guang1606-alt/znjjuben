/**
 * v2.546 创作入口注册表同步守卫：前端静态清单 ↔ 后端注册表
 *
 * 背景：模式 / 剧本类型 / 输出语言 / 创作引擎档在后端是唯一事实源（src/config/modes.ts、pricing.ts），
 * 前端为了离线可用又各存了一份静态表（web/i18n.js 的 MODES、web/data/constants.js 的
 * SCRIPT_TYPES / OUT_LANGS / ENGINE_TIERS / SCRIPT_TYPE_FORMAT）。两处一旦漂移：
 *  · 后端新增档位 → 前端不显示 → 用户根本选不到（能力空转）；
 *  · 前端多写/错写档位 → 立项/生成被 zod 600/400 → 用户「选了却报错」（v2.489 HIGH/PRO 事故同型）。
 *
 * 本守卫只读不写：解析前端源码文本，与构建产物里的后端表逐项比对 id 与最低会员档。
 * 新增/调整任何一张表时，两侧必须同步改，否则此测试必红。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../dist/config/modes.js');
const P = require('../dist/config/pricing.js');

const WEB = path.join(__dirname, '..', 'web');
const readWeb = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');

const TIER_ZH2EN = { FREE: 'free', BASIC: 'basic', ADVANCED: 'advanced', PRO: 'pro' };

/** 截取 `名字 = [ ... ];` 的数组字面量（前端静态表均为单文件字面量） */
function arrayLiteral(src, varName) {
  const at = src.indexOf(varName);
  assert.ok(at >= 0, `前端找不到 ${varName}（静态表被改名/删除，需同步本守卫）`);
  const start = src.indexOf('[', at);
  const end = src.indexOf('];', start);
  assert.ok(start >= 0 && end > start, `${varName} 数组字面量解析失败`);
  return src.slice(start, end);
}

/** 截取 `名字 = { ... };` 的对象字面量（SCRIPT_TYPE_FORMAT 是映射不是数组） */
function objectLiteral(src, varName) {
  const at = src.indexOf(varName);
  assert.ok(at >= 0, `前端找不到 ${varName}（静态表被改名/删除，需同步本守卫）`);
  const start = src.indexOf('{', at);
  const end = src.indexOf('};', start);
  assert.ok(start >= 0 && end > start, `${varName} 对象字面量解析失败`);
  return src.slice(start, end);
}

/** 提取 `{ id|code: 'x', ..., min: 'free' }` 单行对象，返回 { id: tier } */
function idTierEntries(block, idKey, tierKey) {
  const out = {};
  const re = new RegExp(`\\{[^}]*?\\b${idKey}:\\s*'([^']+)'[^}]*?\\b${tierKey}:\\s*'([^']+)'`, 'g');
  let m;
  while ((m = re.exec(block))) {
    assert.ok(!(m[1] in out), `${idKey} 重复：${m[1]}`);
    out[m[1]] = m[2];
  }
  return out;
}

function backendTiers(list, key) {
  const out = {};
  for (const item of list) out[item[key]] = TIER_ZH2EN[item.minLevel] ?? String(item.minLevel).toLowerCase();
  return out;
}

test('创作模式：前端 MODES = 后端 8 模式 + auto，最低会员档逐项一致', () => {
  const be = backendTiers(M.CREATION_MODES, 'id');
  const feBlock = arrayLiteral(readWeb('i18n.js'), 'const MODES =');
  const fe = idTierEntries(feBlock, 'id', 'free');
  assert.deepStrictEqual(Object.keys(fe).filter((k) => k !== 'auto').sort(), Object.keys(be).sort(),
    '前端模式清单必须与后端 CREATION_MODES 完全一致（后端新增模式前端没接 = 用户选不到）');
  assert.strictEqual(fe.auto, 'free', 'auto 是前端入口型伪模式，必须保持免费可选');
  for (const id of Object.keys(be)) assert.strictEqual(fe[id], be[id], `${id} 最低会员档漂移`);
});

test('剧本类型：前端 SCRIPT_TYPES id 与最低会员档逐项一致', () => {
  const be = backendTiers(M.SCRIPT_TYPES, 'id');
  const fe = idTierEntries(arrayLiteral(readWeb('data/constants.js'), 'C.SCRIPT_TYPES ='), 'id', 'min');
  assert.deepStrictEqual(Object.keys(fe).sort(), Object.keys(be).sort(), '剧本类型清单必须与后端 SCRIPT_TYPES 一致');
  for (const id of Object.keys(be)) assert.strictEqual(fe[id], be[id], `${id} 最低会员档漂移`);
});

test('输出语言：前端 OUT_LANGS code 与最低会员档逐项一致', () => {
  const be = backendTiers(M.OUTPUT_LANGUAGES, 'code');
  const fe = idTierEntries(arrayLiteral(readWeb('data/constants.js'), 'C.OUT_LANGS ='), 'code', 'min');
  assert.deepStrictEqual(Object.keys(fe).sort(), Object.keys(be).sort(), '输出语言清单必须与后端 OUTPUT_LANGUAGES 一致');
  for (const code of Object.keys(be)) assert.strictEqual(fe[code], be[code], `${code} 最低会员档漂移`);
});

test('创作引擎档：前端 ENGINE_TIERS = 后端真实枚举剔除预留档，最低档 = 首个开通该档的会员层', () => {
  // OVERSEAS 属 RESERVED_TIERS（预留不开放购买），前端本就不应展示；其余枚举必须逐项在列
  const reserved = new Set(P.RESERVED_TIERS.map(String));
  const sellable = Object.values(P.EngineTier).filter((t) => !reserved.has(t));
  const feBlock = arrayLiteral(readWeb('data/constants.js'), 'C.ENGINE_TIERS =');
  const fe = idTierEntries(feBlock, 'id', 'min');
  assert.deepStrictEqual(Object.keys(fe).sort(), sellable.slice().sort(),
    '前端引擎档必须与后端可售 EngineTier 完全一致（多写即 v2.489 的 zod 400 事故，漏写即用户选不到）');
  // 逐档推导最低会员层：按 FREE→PRO 顺序找第一个 engines 包含该档的会员
  const order = ['FREE', 'BASIC', 'ADVANCED', 'PRO'];
  for (const eng of sellable) {
    const minLevel = order.find((lv) => (P.MEMBERSHIP[lv].engines || []).includes(eng));
    assert.ok(minLevel, `${eng} 没有任何会员层开放，前端不应展示可选`);
    assert.strictEqual(fe[eng], TIER_ZH2EN[minLevel], `${eng} 最低开放档应为 ${minLevel}`);
  }
});

test('剧本类型强制制式：前端 SCRIPT_TYPE_FORMAT 与后端 scriptTypeFormatOf 同口径', () => {
  const block = objectLiteral(readWeb('data/constants.js'), 'C.SCRIPT_TYPE_FORMAT =');
  const re = /([a-z_]+):\s*'(LIVE_ACTION|AIGC)'/g;
  const fe = {};
  let m;
  while ((m = re.exec(block))) fe[m[1]] = m[2];
  assert.ok(Object.keys(fe).length > 0, '前端 SCRIPT_TYPE_FORMAT 解析为空');
  for (const [id, fmt] of Object.entries(fe)) {
    assert.strictEqual(M.scriptTypeFormatOf(id), fmt, `${id} 强制制式与后端不一致`);
  }
  // 反向：后端强制的每种类型前端都必须声明，否则前端会允许用户选出脏组合
  for (const t of M.SCRIPT_TYPES) {
    const fmt = M.scriptTypeFormatOf(t.id);
    if (fmt) assert.strictEqual(fe[t.id], fmt, `${t.id} 后端强制 ${fmt}，前端漏配`);
  }
});
