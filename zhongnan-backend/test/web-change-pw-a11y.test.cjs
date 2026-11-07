/**
 * v2.456 改密表单字段级可访问性。
 *
 * 证伪背景（v2.455 收尾时同族顺手核查）：
 * v2.455 给改密面板补了常驻错误区 `#chgPwErr`（role=alert），但只做到「有文字」：
 * ①两个输入框没有 `aria-describedby` 指向该错误区——读屏聚焦输入框时听不到错误内容；
 * ②出错时输入框不置 `aria-invalid`、也不聚焦——键盘/读屏用户要自己 Tab 回刚才那栏找问题；
 * ③登录表单（#authErr）在 v2.246 就做了这套字段级关联，改密是同一族缺口的遗留。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');

function pick(fnName, asyncFn = false) {
  const m = appJs.match(new RegExp(`${asyncFn ? 'async ' : ''}function ${fnName}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `缺 ${fnName}`);
  return m[0];
}

function formSeg() {
  const open = html.indexOf('<form id="chgPwForm"');
  assert.ok(open >= 0, '缺改密 form');
  const close = html.indexOf('</form>', open);
  assert.ok(close > open, 'form 必须闭合');
  return html.slice(open, close);
}

test('① 两个密码框用 aria-describedby 指向常驻错误区，并标注必填', () => {
  const seg = formSeg();
  for (const id of ['inCurPw', 'inNewPw']) {
    const tag = seg.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    assert.ok(tag, `缺 #${id}`);
    assert.match(tag[0], /aria-describedby="chgPwErr"/, `#${id} 必须把错误区挂为描述，读屏才能跟读`);
    assert.match(tag[0], /aria-required="true"/, `#${id} 必须标必填（与登录表单同口径）`);
  }
});

test('② showChgPwErr 支持定位到具体字段：置 aria-invalid 并聚焦', () => {
  const fn = pick('showChgPwErr');
  assert.match(fn, /fieldId/, '必须接受字段 id 参数');
  assert.match(fn, /setAttribute\('aria-invalid',\s*'true'\)/, '出错字段必须置 aria-invalid');
  assert.match(fn, /\.focus\(\)/, '出错字段要拿到焦点，键盘用户不用自己找');
  // 429 这类非字段错误不带 fieldId，不能冤枉某一栏
  assert.match(fn, /if\s*\(!fieldId\)\s*return/, '无字段 id 时直接返回，不标红任何输入框');
});

test('③ 用户一改输入就撤掉 aria-invalid（与登录表单同口径）', () => {
  assert.match(appJs, /\['inCurPw',\s*'inNewPw'\]\.forEach/, '两个改密输入框都要挂 input 监听');
  const seg = appJs.match(/\['inCurPw',\s*'inNewPw'\]\.forEach\(([\s\S]*?)\n  \}\);/);
  assert.ok(seg, '需要可读的监听注册片段');
  assert.match(seg[0], /removeAttribute\('aria-invalid'\)/, '输入即撤销无效态，不要一直红着');
});

test('④ doChangePw 的每条失败路径都指到对应字段，成功后清干净', () => {
  const fn = pick('doChangePw', true);
  assert.match(fn, /showChgPwErr\(t\('curPw'\),\s*'inCurPw'\)/, '缺当前密码 → 指向 #inCurPw');
  assert.match(fn, /showChgPwErr\(t\('pwClientErr'\),\s*'inNewPw'\)/, '弱新密码 → 指向 #inNewPw');
  assert.match(fn, /showChgPwErr\(e\.message,\s*'inCurPw'\)/, '服务端拒绝多半是当前密码错 → 指向 #inCurPw');
  assert.match(fn, /removeAttribute\('aria-invalid'\)/, '成功改密后必须清掉无效态');
});

test('⑤ 每次提交先重置两个字段的无效态，本次结果重新标记', () => {
  // 真机实测暴露：上次「弱新密码」把 #inNewPw 标红后，本次只改当前密码再提交，
  // 新密码框的 aria-invalid 会残留——读屏同时听到「当前密码错误」与「新密码无效」，名实不符。
  const fn = pick('doChangePw', true);
  const firstMark = fn.indexOf("showChgPwErr(t('curPw'), 'inCurPw')");
  const resetPos = fn.indexOf("$('inCurPw').removeAttribute('aria-invalid')");
  assert.ok(firstMark > 0, '缺少当前密码分支');
  assert.ok(resetPos > 0 && resetPos < firstMark, '重置必须发生在任何本次标记之前');
  assert.match(fn, /\$\('inNewPw'\)\.removeAttribute\('aria-invalid'\)/, '两个字段都要重置');
});
