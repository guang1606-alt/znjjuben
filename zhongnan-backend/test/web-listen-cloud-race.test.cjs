/**
 * v2.639 云端语音「在途竞态」守卫（纯静态）
 *
 * 背景：v2.638 把停止/关窗/切集合一到 listenFinish → listenStopCloud，
 * 但云端合成是异步请求：在途期间用户关窗/切集，listenFinish 已经执行完，
 * 响应回来后 listenPlayCloud 不做任何作废判断，照样建 blob、取消隐藏、audio.play()——
 * 关窗后照样有人念稿，切集后更是在新集里播旧集的音频（名实不符）。
 *
 * 邻居差集：浏览器朗读早就有 listenBumpReqSeq() 令牌 + openListen 里
 * `if (token !== listenReqSeq) return` 的在途作废；云端合成没有对应物。
 * 本守卫要求云端也有独立序号，并在「认领 → 校验 → 作废」三点闭环。
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

const cloud = fnBody('async function listenPlayCloud(', '// how=\'natural\'');
const finish = fnBody('function listenFinish()', 'async function listenPlayCloud');

test('R1 云端合成有独立序号，且每次发起请求先自增认领（新请求作废旧请求）', () => {
  assert.ok(/let\s+listenCloudSeq\s*=/.test(js), '缺少 listenCloudSeq 序号声明');
  assert.ok(/\+\+listenCloudSeq/.test(cloud), 'listenPlayCloud 发起请求前没有自增认领序号');
});

test('R2 响应回来后、建 blob 播放之前必须校验序号，已作废就直接返回', () => {
  const parsed = cloud.indexOf('await Api.jsonOrThrow(r)');
  const blob = cloud.indexOf('URL.createObjectURL');
  assert.ok(parsed > 0 && blob > parsed, 'listenPlayCloud 结构变化，无法定位校验点');
  const between = cloud.slice(parsed, blob);
  assert.ok(/listenCloudSeq/.test(between) && /return/.test(between),
    '拿到响应后没有作废校验：在途期间关窗/切集，旧音频照样会播放');
});

test('R3 listenFinish 必须作废在途云端请求（停止/关窗/切集共用这一出口）', () => {
  assert.ok(/listenCloudSeq\s*\+\+|\+\+listenCloudSeq/.test(finish),
    'listenFinish 没有作废在途云端请求，v2.638 的收口会被在途竞态绕过');
});

test('R4 失败分支同样要作废：关窗后不再往旧弹窗写错误提示', () => {
  const catchAt = cloud.indexOf('} catch (e) {');
  assert.ok(catchAt > 0, 'listenPlayCloud 缺少 catch 分支');
  const after = cloud.slice(catchAt, cloud.indexOf('} finally {'));
  assert.ok(/listenCloudSeq/.test(after) && /return/.test(after),
    'catch 里没有作废校验，已关闭/已切集的弹窗会被写入过期错误提示');
});

test('R5 浏览器朗读既有在途令牌不许回退（邻居对照组）', () => {
  assert.ok(/function listenBumpReqSeq\(/.test(js), 'listenBumpReqSeq 被移除');
  const open = fnBody('async function openListen(', 'async function openListenSeries(');
  assert.ok(/token !== listenReqSeq/.test(open), 'openListen 的在途响应作废被移除');
});
