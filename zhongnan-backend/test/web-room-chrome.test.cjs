'use strict';
// v2.686 编剧室首屏排布与空态：
// 1) 标签行的「我的编剧室」不再和「收起」平分 auto 外边距（桌面被挤到行中央、窄屏把收起挤到第二行）；
// 2) 窄屏隐藏面板内「收起」——工作台头部已有「← 返回」，重复按钮只会多占一行；
// 3) 会议纪要区在没有任何发言时不再显示空边框盒子，改用一条批注式提示说明「发起后会看到什么」，
//    有第一条发言后自动让位。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('web/index.html');
const css = read('web/styles.css');
const i18n = read('web/i18n.js');

test('静态契约：历史入口独占 auto 外边距，收起不再参与空白分配', () => {
  assert.match(html, /<button class="chip room-history-chip" id="roomHistoryBtn"[^>]*>/, '历史入口应带 room-history-chip 类');
  const tag = html.match(/<button[^>]*id="roomHistoryBtn"[^>]*>/)[0];
  assert.ok(!/margin-left\s*:\s*auto/.test(tag), '不应再用内联 margin-left:auto（会与 .room-close 平分空白）');
  assert.match(css, /\.room-history-chip\s*\{\s*margin-left:\s*auto;?\s*\}/);
  assert.match(css, /#roomClose\s*\{\s*margin-left:\s*0;?\s*\}/);
  // 其他面板仍靠 .room-close 的 auto 外边距把收起推到行尾，这条默认规则不能被改掉
  assert.match(css, /\.room-close\s*\{\s*margin-left:\s*auto;/);
});

test('静态契约：窄屏在 768px 断点内隐藏工作台面板内的重复收起', () => {
  const rule = '.workbench-body .room-close { display: none; }';
  const at = css.indexOf(rule);
  assert.ok(at > 0, `styles.css 缺少窄屏去重规则：${rule}`);
  const mediaAt = css.lastIndexOf('@media (max-width: 768px)', at);
  assert.ok(mediaAt > 0 && mediaAt < at, '该规则必须落在 768px 媒体查询内，避免影响桌面');
  // 返回按钮仍在头部（窄屏唯一出口）
  assert.match(html, /id="workbenchBack"/);
});

test('静态契约：空纪要区隐藏，批注提示紧随其后并成对出现', () => {
  assert.match(css, /\.room-stream:empty\s*\{\s*display:\s*none;?\s*\}/);
  assert.match(css, /\.room-stream:not\(:empty\)\s*\+\s*\.room-idle-hint\s*\{\s*display:\s*none;?\s*\}/);
  // DOM 顺序：提示必须紧跟在 #pitchStream 之后，兄弟选择器才成立
  const streamAt = html.indexOf('id="pitchStream"');
  const hintAt = html.indexOf('id="pitchIdleHint"');
  assert.ok(streamAt > 0 && hintAt > streamAt, 'pitchIdleHint 必须位于 pitchStream 之后');
  const hintTag = html.match(/<p[^>]*id="pitchIdleHint"[^>]*>/)[0];
  assert.match(hintTag, /data-i="roomIdleHint"/, '提示文案要走 i18n');
});

test('静态契约：中英双语文案键齐备', () => {
  const hits = i18n.match(/roomIdleHint\s*:/g) || [];
  assert.equal(hits.length, 2, 'roomIdleHint 必须在中英两份 DICT 中各出现一次');
});
