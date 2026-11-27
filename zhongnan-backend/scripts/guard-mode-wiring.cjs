#!/usr/bin/env node
/**
 * v2.699 常驻守卫：创作模式「真源自洽 + 可见通路」设卡（AST-lite 文本扫描器）。
 *
 * 背景：同一个模式在前端散落四处真源——`web/i18n.js` 的 MODES（有哪些模式）、
 * 同文件 mode 名称表（卡片/详情页显示名，中英各一份）、`web/data/constants.js` 的
 * MODE_BRIEF（进入详情后的引导语）、`web/app.js` 的 _MODE_PANEL_MAP / structuredModeBrief
 * （用户到底能看到哪个输入面）。
 *
 * 历史事故同族：
 *  · v2.328 新增 auto 模式，只往 app.js 的兜底字面量加了引导语，constants.js 唯一真源漏加
 *    → 真机 auto 详情页一直显示 default「谁、遇到什么麻烦、准备怎么反击」。auto 支持改编 /
 *    拆解 / 口播，这句兜底把用户往「故事创意」上引，等于削弱自动路由的能力承诺。
 *  · v2.698 角色自述 / 双人对撞 / 世界线推演只有结构化字段、简报框留在隐藏工作台里，
 *    出本流程只认 #modeBrief → 字段填满仍被拦死。修复后靠 structuredModeBrief 兜底。
 *  · 中英 mode 名称表键集漂移（en 有 tags / zh 没有），英文回落到 raw id。
 *
 * 设卡规则（任一命中即 violation）：
 *   R1 mode-brief-missing         MODES 里的模式在 MODE_BRIEF 真源无条目 → 落 default 引导语
 *   R2 mode-name-lang-drift       zh / en 两套 mode 名称表键集不一致 → 切换语言出现 raw id
 *   R3 mode-name-missing          MODES 里的模式在 zh 名称表无显示名
 *   R4 mode-no-visible-input      MODES 里的模式既无可见 panel（_MODE_PANEL_MAP 为空）也无
 *                                 structuredModeBrief 合成分支 → 字段填了也进不了生成
 *   R5 structured-mode-orphan     structuredModeBrief 分支指向 MODES 之外（拼错/废弃后静默失效）
 *
 * 用法：node scripts/guard-mode-wiring.cjs  → 0 violation 退出码 0，否则列出并退出码 1
 * 测试：test/guard-mode-wiring.test.cjs（真实文件扫描 + fixture 红黑自证）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const FILES = {
  i18n: path.join(WEB, 'i18n.js'),
  constants: path.join(WEB, 'data', 'constants.js'),
  app: path.join(WEB, 'app.js'),
};

/** 跳过字符串/模板串字面量，i 指向引号，返回闭合引号后一位 */
function skipString(text, i) {
  const q = text[i];
  i++;
  while (i < text.length && text[i] !== q) {
    if (text[i] === '\\') i++;
    i++;
  }
  return i + 1;
}

/** 取 marker 之后首个 `{` 起始的对象字面量内部文本（不含外层花括号），支持嵌套 */
function objectBlock(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  let start = text.indexOf('{', at);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(text, i) - 1; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }
  return null;
}

/** 对象块顶层键（depth 0 的逗号/换行分段，取首个标识符） */
function topLevelKeys(block) {
  if (!block) return [];
  const keys = [];
  let depth = 0;
  let seg = '';
  const flush = () => {
    const k = seg.split(':')[0].trim();
    if (k) keys.push(k);
    seg = '';
  };
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(block, i) - 1; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    if (depth === 0) {
      if (c === ',' || c === '\n') flush();
      else seg += c;
    }
  }
  flush();
  return keys.filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
}

/** 从 i18n.js 解析 MODES 的 id 列表（单文件静态表，`{ id: 'x', free: 'y' }`） */
function parseModes(text) {
  const out = [];
  const re = /\{\s*id:\s*'([a-z_]+)'\s*,\s*free:\s*'[a-z]+'\s*\}/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

/**
 * 解析 zh / en 两套 mode 名称表键集。
 * 结构：`mode: { auto: '…', … },\n      modeDesc: {…}` 出现两次（zh 先、en 后）。
 */
function parseModeNameTables(text) {
  const blocks = [];
  const re = /mode:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*modeDesc\s*:/g;
  let m;
  while ((m = re.exec(text))) blocks.push(m[1]);
  return blocks.map((block) => [...block.matchAll(/(?:^|[\s,{])([a-z_]+)\s*:\s*'/g)].map((x) => x[1]));
}

/** 解析 _MODE_PANEL_MAP：返回 { id: 数组是否非空 } */
function parsePanelMap(text) {
  const block = objectBlock(text, 'const _MODE_PANEL_MAP =');
  const out = {};
  if (!block) return out;
  const re = /([a-z_]+)\s*:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(block))) out[m[1]] = m[2].trim().length > 0;
  return out;
}

/** 解析 structuredModeBrief 内的 `selectedMode === 'x'` 分支 */
function parseStructuredModes(text) {
  const at = text.indexOf('function structuredModeBrief(');
  if (at < 0) return [];
  const end = text.indexOf('\n  }', at);
  const body = text.slice(at, end > 0 ? end : undefined);
  const out = new Set();
  const re = /selectedMode\s*===\s*'([a-z_]+)'/g;
  let m;
  while ((m = re.exec(body))) out.add(m[1]);
  return [...out];
}

/**
 * 扫描源码映射，返回 violations: [{ rule, file, why }]
 * @param {{i18n:string, constants:string, app:string}} src
 */
function scanSources(src) {
  const modes = parseModes(src.i18n);
  const nameTables = parseModeNameTables(src.i18n);
  const modeBriefKeys = topLevelKeys(objectBlock(src.constants, 'C.MODE_BRIEF ='));
  const panelMap = parsePanelMap(src.app);
  const structured = new Set(parseStructuredModes(src.app));
  const zhNames = nameTables[0] || [];
  const enNames = nameTables[1] || [];

  const out = [];
  const push = (rule, file, why) => out.push({ rule, file, why });
  if (!modes.length) push('modes-unparsed', 'web/i18n.js', 'MODES 解析不到任何 id（表结构被改写，守卫失效需同步）');
  if (!modeBriefKeys.length) push('modes-unparsed', 'web/data/constants.js', 'MODE_BRIEF 解析不到任何键（结构被改写，守卫失效需同步）');

  for (const id of modes) {
    if (modeBriefKeys.length && !modeBriefKeys.includes(id)) {
      push('mode-brief-missing', 'web/data/constants.js', `模式 ${id} 在 MODE_BRIEF 无条目 → 详情页落 default 引导语，文案与模式语义不符`);
    }
    if (!zhNames.includes(id)) push('mode-name-missing', 'web/i18n.js', `模式 ${id} 在 zh 名称表无显示名`);
    if (!panelMap[id] && !structured.has(id)) {
      push('mode-no-visible-input', 'web/app.js', `模式 ${id} 无可见 panel 且无 structuredModeBrief 合成分支 → 用户填的内容进不了生成`);
    }
  }
  const zhSet = new Set(zhNames);
  const enSet = new Set(enNames);
  for (const k of enNames) if (!zhSet.has(k)) push('mode-name-lang-drift', 'web/i18n.js', `en mode 名称表键 ${k} 在 zh 缺失`);
  for (const k of zhNames) if (!enSet.has(k)) push('mode-name-lang-drift', 'web/i18n.js', `zh mode 名称表键 ${k} 在 en 缺失`);

  for (const id of structured) {
    if (!modes.includes(id)) push('structured-mode-orphan', 'web/app.js', `structuredModeBrief 分支 ${id} 不在 MODES 内 → 拼错或废弃后静默失效`);
  }
  return out;
}

/** 读取真实前端三份真源并扫描 */
function scanProject() {
  const src = {};
  for (const [k, p] of Object.entries(FILES)) src[k] = fs.readFileSync(p, 'utf8');
  return scanSources(src);
}

module.exports = { scanSources, scanProject, parseModes, parseModeNameTables, parseStructuredModes, parsePanelMap, objectBlock, topLevelKeys };

if (require.main === module) {
  const v = scanProject();
  if (!v.length) { console.log('guard-mode-wiring: 0 violation（模式真源与可见通路自洽）'); process.exit(0); }
  console.error(`guard-mode-wiring: ${v.length} violation(s)——模式真源不自洽：`);
  for (const x of v) console.error(`  [${x.rule}] ${x.file} ${x.why}`);
  process.exit(1);
}
