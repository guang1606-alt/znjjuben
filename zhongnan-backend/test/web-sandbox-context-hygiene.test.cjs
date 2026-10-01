const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 防 lang 注入遗漏的元守卫：静态扫描全部构造 vm context 的 app.js 沙箱测试文件，
// 断言每个 context 构造对象必含 lang 键（防未来新增 context 忘注入时 _uiLangEn
// 的 typeof lang 静默走中文分支）。
// 形态支持两种：内联字面量 vm.createContext({ lang }) 与变量间接引用
// vm.createContext(c)（回溯到 const c = { 起点扫描，兼容跨行大对象）。

const LANG_RE = /\blang\b/;

/** 收集源码中 vm.createContext 调用点（行索引与实参文本） */
function findCreateContextCalls(source) {
  const lines = source.split('\n');
  const calls = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/vm\.createContext\(\s*([\s\S]*)$/);
    if (m) calls.push({ line: i, argText: m[1] });
  }
  return calls;
}

/** 判定单个调用点的 context 对象是否含 lang 键 */
function callHasLang(source, call) {
  const prefix = source.split('\n').slice(0, call.line + 1).join('\n');
  // 形态一：内联对象字面量——实参以 { 开头，从调用行向后扫一小段即可
  if (/^\{/.test(call.argText)) {
    const tail = source.split('\n').slice(call.line, call.line + 5).join('\n');
    return LANG_RE.test(tail);
  }
  // 形态二：变量间接引用——定位最后一次 `名字 = {` 起点，扫到调用行
  const idm = call.argText.match(/^([A-Za-z_$][\w$]*)/);
  assert.ok(idm, `无法解析 vm.createContext 实参形态：${call.argText.slice(0, 40)}`);
  const name = idm[1];
  const assignIdx = prefix.lastIndexOf(`${name} = {`);
  assert.ok(assignIdx !== -1, `未找到 context 变量 ${name} 的对象字面量赋值`);
  return LANG_RE.test(prefix.slice(assignIdx));
}

// A 组：app.js 沙箱测试，必含 vm.createContext 且 context 必含 lang
const APP_SANDBOX_FILES = [
  'web-interview-restore.test.cjs',
  'web-workbench-navigation.test.cjs',
  'web-account-isolation.test.cjs',
  'web-workflow.test.cjs',
  'web-qc-copy.test.cjs',
];

for (const file of APP_SANDBOX_FILES) {
  test(`${file} 的 vm.createContext 构造对象必含 lang 键`, () => {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const calls = findCreateContextCalls(source);
    assert.ok(calls.length > 0, `${file} 应至少有一处 vm.createContext`);
    for (const call of calls) {
      assert.ok(callHasLang(source, call),
        `${file} 第 ${call.line + 1} 行的 vm.createContext 构造对象缺少 lang 注入`);
    }
  });
}

// B 组：纯函数提取测试，无 vm.createContext（豁免）
test('web-market-price.test.cjs 无 vm.createContext（纯函数提取豁免）', () => {
  const source = fs.readFileSync(path.join(__dirname, 'web-market-price.test.cjs'), 'utf8');
  assert.ok(!/vm\.createContext/.test(source), '纯函数提取测试不应构造 vm context');
});

// C 组：api.js 模块级测试，语言走 localStorage 而非 vm context 的 lang（豁免）
const API_MODULE_FILES = ['web-api-session-races.test.cjs', 'web-api-sanitize.test.cjs'];
for (const file of API_MODULE_FILES) {
  test(`${file} 无 vm.createContext（api.js 模块级测试豁免）`, () => {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!/vm\.createContext/.test(source), 'api.js 模块级测试不应构造 vm context');
  });
}
