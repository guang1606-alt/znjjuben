/**
 * v2.642 云端朗读「失败可恢复」守卫（纯静态）
 *
 * 背景：v2.640 让长集按 part 逐段请求、播完自动接下一段。但合成请求是网络操作——
 * 中途某段遇到 502/429/断网时，catch 只写一行提示就结束：用户没有重试入口，
 * 也没有跳过坏段的办法；再点「☁ 云端语音」又固定从 part 0 开始，前几段要重新听一遍。
 *
 * 判据：
 * 1) 失败要记住失败段号（同集），提示区给出「重试本段 / 跳过本段」两个真实按钮；
 * 2) 重试必须请求同一个 part，跳过必须请求 part + 1；
 * 3) 失败后再次点云端按钮（默认 part 0）要续到失败段，而不是回到第一段；
 * 4) 每段开播后把续播点推进一段，整集播完清空，避免下次误续；
 * 5) 关窗清空续播点，下次打开从第一段开始（不留「莫名从中间开始」）；
 * 6) 配置缺失/过长这类永久失败不给「重试」，不给点了必然失败的按钮。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');

function fnBody(startDecl, endDecl) {
  const start = js.indexOf(startDecl);
  assert.ok(start >= 0, `web/app.js 里找不到 ${startDecl}`);
  const end = js.indexOf(endDecl, start + startDecl.length);
  assert.ok(end > start, `找不到 ${startDecl} 的结束标记 ${endDecl}`);
  return js.slice(start, end);
}

const cloud = fnBody('async function listenPlayCloud(', "// how='natural'");

test('F1 失败分支必须记住失败段号（同集），供重试/续播使用', () => {
  const catchAt = cloud.indexOf('} catch (e) {');
  assert.ok(catchAt > 0, 'listenPlayCloud 缺少 catch 分支');
  const after = cloud.slice(catchAt);
  assert.ok(/let listenCloudResume = null;/.test(js), '缺少 listenCloudResume 续播点声明');
  assert.ok(/listenCloudResume = \{ scriptId, part, total \}/.test(after),
    '失败分支没有记住失败段号：重试与续播都无从谈起');
});

test('F2 失败提示区给出「重试本段 / 跳过本段」两个真实按钮', () => {
  const catchAt = cloud.indexOf('} catch (e) {');
  const after = cloud.slice(catchAt);
  assert.ok(/id = 'listenCloudRetry'/.test(after), '失败提示里缺少「重试本段」按钮');
  assert.ok(/id = 'listenCloudSkip'/.test(after), '失败提示里缺少「跳过本段」按钮');
  assert.ok(/createElement\('button'\)/.test(after), '按钮必须是真实 button，不能是纯文本');
});

test('F3 重试请求同一段，跳过请求下一段（不是回到第一段）', () => {
  const catchAt = cloud.indexOf('} catch (e) {');
  const after = cloud.slice(catchAt);
  assert.ok(/listenPlayCloud\(scriptId, part, 0, null\)/.test(after),
    '「重试本段」没有以同一 part 重新请求');
  assert.ok(/listenPlayCloud\(scriptId, part \+ 1, 0, null\)/.test(after),
    '「跳过本段」没有请求 part + 1');
});

test('F4 失败后直接再点云端按钮，要续到失败段而不是从头', () => {
  const head = cloud.slice(0, cloud.indexOf('await Api.request'));
  assert.ok(/part === 0 && listenCloudResume/.test(head),
    '默认点击（part 0）没有读取续播点');
  assert.ok(/listenCloudResume\.scriptId === scriptId/.test(head),
    '续播点没有校验脚本归属：换集后会从上一集的段号开始');
  assert.ok(/part = listenCloudResume\.part/.test(head),
    '默认点击没有把段号接管为失败段');
});

test('F5 每段开播后推进续播点，整集播完清空', () => {
  assert.ok(/listenCloudResume = hasMore \? \{ scriptId, part: part \+ 1, total \} : null;/.test(cloud),
    '开播后没有推进/清空续播点：停止后再点会回到第一段或整集播完仍误续');
});

test('F6 关窗清空续播点，下次打开从第一段开始', () => {
  assert.ok(/setModalCloseHook\('listenModal', \(\) => \{ listenCloudResume = null; listenFinish\(\); \}\)/.test(js),
    '关窗没有清空云端续播点：下次打开会莫名从中间某段开始');
});

test('F7 永久失败不给「重试」按钮，避免点了必然失败的名实不符', () => {
  const pred = fnBody('function listenCloudRetryable(', 'async function listenPlayCloud');
  assert.ok(/TTS_NOT_CONFIGURED/.test(pred), '可重试判定没有排除未配置');
  assert.ok(/status === 400|status === 503/.test(pred), '可重试判定没有排除 400/503');
  const catchAt = cloud.indexOf('} catch (e) {');
  assert.ok(/listenCloudRetryable\(code, status\)/.test(cloud.slice(catchAt)),
    '失败分支没有使用可重试判定，配置缺失也会出现「重试」按钮');
});
