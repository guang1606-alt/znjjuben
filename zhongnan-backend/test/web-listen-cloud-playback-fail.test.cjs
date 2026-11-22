/**
 * v2.644 云端播放失败也要可恢复（纯静态）
 *
 * 背景：v2.642 已让「合成失败」可重试/跳过，但同一链路的另一处失败——音频已返回、
 * 浏览器解码/播放失败（audio.onerror）——仍然只写一行字就结束，而且更糟：
 * 续播点在本段 src 赋值时就推进到了下一段，用户其实没听到，再点云端按钮会直接跳过本段，
 * 表现为「中间少了一段却毫无提示」。
 *
 * 判据：
 * 1) 播放失败必须把续播点退回本段（不然再点就静默吞段）；
 * 2) 播放失败与合成失败共用同一个提示出口，给出「重试本段 / 跳过本段」；
 * 3) 按钮只在一个地方构造，禁止两条失败路径各写一套（v2.642 就只覆盖了合成失败）；
 * 4) 云端播放条要有布局（可换行），窄屏下新增按钮不能挤成一团。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');

function fnBody(startDecl, endDecl) {
  const start = js.indexOf(startDecl);
  assert.ok(start >= 0, `web/app.js 里找不到 ${startDecl}`);
  const end = js.indexOf(endDecl, start + startDecl.length);
  assert.ok(end > start, `找不到 ${startDecl} 的结束标记 ${endDecl}`);
  return js.slice(start, end);
}

const cloud = fnBody('async function listenPlayCloud(', "// how='natural'");

function onerrorBody() {
  const at = cloud.indexOf('audio.onerror = () => {');
  assert.ok(at > 0, 'listenPlayCloud 缺少 audio.onerror 回调');
  const end = cloud.indexOf('audio.src =', at);
  assert.ok(end > at, '找不到 audio.onerror 的结束位置');
  return cloud.slice(at, end);
}

test('G1 播放失败把续播点退回本段，不静默吞段', () => {
  const body = onerrorBody();
  assert.ok(/listenCloudResume = \{ scriptId, part, total \}/.test(body),
    '播放失败没有回退续播点：再点云端会直接跳到下一段，用户永远听不到这一段');
});

test('G2 播放失败复用共用提示出口，而不是只留一行字', () => {
  const body = onerrorBody();
  assert.ok(/listenCloudFailTip\(/.test(body),
    '播放失败没有走失败提示出口：没有重试/跳过入口');
});

test('G3 失败按钮单点构造，合成失败与播放失败共用同一出口', () => {
  const catchAt = cloud.indexOf('} catch (e) {');
  assert.ok(catchAt > 0, 'listenPlayCloud 缺少 catch 分支');
  const after = cloud.slice(catchAt);
  assert.ok(/listenCloudFailTip\(/.test(after), '合成失败没有走共用提示出口');
  assert.ok(!/createElement\('button'\)/.test(after), 'catch 里又内联构造按钮：两条失败路径各写一套必然漂移');
  assert.strictEqual((js.match(/id = 'listenCloudRetry'/g) || []).length, 1, '「重试本段」按钮必须只在一个地方构造');
  assert.strictEqual((js.match(/id = 'listenCloudSkip'/g) || []).length, 1, '「跳过本段」按钮必须只在一个地方构造');
});

test('G4 共用提示里重试同段、跳过下一段', () => {
  const helper = fnBody('function listenCloudFailTip(', 'async function listenPlayCloud');
  assert.ok(/listenPlayCloud\(scriptId, part, 0, null\)/.test(helper), '「重试本段」没有以同一 part 重新请求');
  assert.ok(/listenPlayCloud\(scriptId, part \+ 1, 0, null\)/.test(helper), '「跳过本段」没有请求 part + 1');
});

test('G5 云端播放条补齐布局：可换行，窄屏按钮不挤成一团', () => {
  assert.ok(/\.listen-cloud\{[^}]*display:flex/.test(css), '云端播放条缺少 flex 布局：按钮、提示、播放器会散落换行');
  assert.ok(/\.listen-cloud\{[^}]*flex-wrap:wrap/.test(css), '云端播放条不允许换行：窄屏会被撑破');
  assert.ok(/\.listen-cloud \.muted\{[^}]*flex-wrap:wrap/.test(css), '提示区不允许换行：窄屏下提示与两个按钮会挤成一行');
});
