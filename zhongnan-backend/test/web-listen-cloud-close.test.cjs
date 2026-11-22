/**
 * v2.638 听剧本「双声源」收口守卫（纯静态）
 *
 * 背景：v2.635 加了云端真人语音后，播放器里同时存在两条声源——浏览器 SpeechSynthesis 与
 * 云端 <audio>。三条退出路径（停止按钮 / 关闭弹窗 / 切集）都只走 listenFinish()，
 * 而 listenFinish 只 cancel 浏览器朗读，云端音频会继续在后台响：
 *   - 关掉弹窗后还能听见有人在念剧本，用户以为关不掉；
 *   - 再点某一段用浏览器朗读，两路同时出声，叠成双声。
 *
 * 判据：任何「停」的入口都必须同时停掉云端音频；云端音频与浏览器朗读必须互斥。
 * 这类缺陷没有异常、没有报错，只能靠静态断言兜住。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');

/** 截取某个函数体：从声明处到下一个同级 function 声明（或给定终点） */
function fnBody(startDecl, endDecl) {
  const start = js.indexOf(startDecl);
  assert.ok(start >= 0, `web/app.js 里找不到 ${startDecl}`);
  const end = js.indexOf(endDecl, start + startDecl.length);
  assert.ok(end > start, `找不到 ${startDecl} 的结束标记 ${endDecl}`);
  return js.slice(start, end);
}

/** 判断一段代码是否真的暂停了云端 <audio>（直接操作或经由统一收口函数） */
function stopsCloudAudio(code) {
  const direct = /listenCloudAudio/.test(code) && /pause\s*\(/.test(code);
  const viaHelper = /listenStopCloud\s*\(/.test(code);
  return direct || viaHelper;
}

test('L1 云端语音控件存在于页面，避免测试断言落空', () => {
  assert.ok(/id="listenCloudAudio"/.test(html), 'index.html 缺少 #listenCloudAudio');
  assert.ok(/id="listenCloudBar"/.test(html), 'index.html 缺少 #listenCloudBar');
});

test('L2 listenFinish 必须同时停掉云端音频（停止/关窗/切集共用这一出口）', () => {
  const body = fnBody('function listenFinish()', 'async function listenPlayCloud');
  assert.ok(stopsCloudAudio(body),
    'listenFinish 没有暂停云端音频：关闭弹窗/点停止/切集后云端语音会在后台继续播放');
});

test('L3 浏览器朗读开声前必须停云端音频，否则两路同时出声叠音', () => {
  const body = fnBody('function speakListenIdx(', 'function listenMarkActive(');
  assert.ok(stopsCloudAudio(body),
    'speakListenIdx 没有停云端音频：云端播放中点某一段朗读会双声叠放');
});

test('L4 云端开始播放时必须掐断浏览器朗读（反向互斥）', () => {
  const body = fnBody('async function listenPlayCloud(', '// how=\'natural\'');
  assert.ok(/listenFinish\s*\(/.test(body),
    'listenPlayCloud 播放前没有收口浏览器朗读');
});

test('L5 云端音频播完要收起播放条，不留「看着在播其实已结束」的控件', () => {
  const body = fnBody('async function listenPlayCloud(', '// how=\'natural\'');
  assert.ok(/audio\.onended\s*=\s*(\(|function)|addEventListener\(\s*'ended'/.test(body),
    'listenPlayCloud 没有给 audio 绑定播放结束处理函数');
});

test('L6 云端音频播放失败要给提示并复位控件', () => {
  const body = fnBody('async function listenPlayCloud(', '// how=\'natural\'');
  assert.ok(/audio\.onerror\s*=\s*(\(|function)|addEventListener\(\s*'error'/.test(body),
    'listenPlayCloud 没有给 audio 绑定播放失败处理函数');
});

test('L7 停云端必须同时作废在途合成：只 pause 不作废，响应回来仍会开播', () => {
  const body = fnBody('function listenStopCloud()', 'function listenFinish()');
  assert.ok(/listenCloudSeq\s*\+\+/.test(body),
    'listenStopCloud 只暂停音频、没有作废在途合成：浏览器朗读开声后云端请求回来会再次播放，双声叠放');
});
