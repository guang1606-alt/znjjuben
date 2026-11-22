/**
 * v2.646 项目列表分页响应契约：四处旧消费者必须读取 items。
 *
 * GET /api/generate/projects 自 v2.553 起返回
 * { items, hasMore, nextCursor, total }，不再返回裸数组。
 * 作品库主列表已兼容，但围读改写桥、剧本上架、剧本 PK、编剧室选项目
 * 仍把响应当数组，分别导致关联项目打不开、误报无剧本、对手消失、误报无作品。
 * 本文件锁定四个调用点的响应归一化，同时保留旧数组响应兼容。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '..', 'web');
const app = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8').replace(/\/\/.*$/gm, '');
const room = fs.readFileSync(path.join(webDir, 'room-view.js'), 'utf8').replace(/\/\/.*$/gm, '');

function windowBetween(src, startMarker, endMarker, maxLen = 2400) {
  const start = src.indexOf(startMarker);
  if (start < 0) return '';
  const end = endMarker ? src.indexOf(endMarker, start + startMarker.length) : -1;
  return src.slice(start, end > start ? end : start + maxLen);
}

function assertItemsNormalization(w, rawName, listName) {
  const raw = rawName.replace(/[$]/g, '\\$');
  const list = listName.replace(/[$]/g, '\\$');
  assert.match(w,
    new RegExp(`const\\s+${list}\\s*=\\s*Array\\.isArray\\(${raw}\\)\\s*\\?\\s*${raw}\\s*:\\s*\\(${raw}\\.items\\s*\\|\\|\\s*\\[\\]\\)`),
    `${listName} 必须同时兼容旧数组响应与分页对象 items`);
}

describe('v2.646 围读意见去改写：分页对象不得再触发 list.find 异常', () => {
  const w = windowBetween(app, "window.addEventListener('zn-read-to-rewrite'", '/* ---------- 视图切换');
  it('定位改写桥调用点', () => {
    assert.ok(w, '应定位到 zn-read-to-rewrite 处理器');
    assert.match(w, /\/api\/generate\/projects/);
  });
  it('先把原始响应归一化为 list，再查找关联项目', () => {
    assertItemsNormalization(w, 'raw', 'list');
    assert.match(w, /list\.find\(\(x\)\s*=>\s*x\.id\s*===\s*d\.projectId\)/);
  });
});

describe('v2.646 剧本上架：已有项目不得被误判为请先创作', () => {
  const w = windowBetween(app, "$('mkListBtn').onclick = async () =>", '// v2.72 上架前价值预览');
  it('定位上架项目加载调用点', () => {
    assert.ok(w, '应定位到 mkListBtn 处理器');
    assert.match(w, /\/api\/generate\/projects/);
  });
  it('空态、下拉选项与首个价值预览共用归一化后的 projects', () => {
    assertItemsNormalization(w, 'projectsRaw', 'projects');
    assert.match(w, /if\s*\(!projects\.length\)/);
    assert.match(w, /projects\.map\(/);
    assert.match(w, /previewListingValue\(projects\[0\]\.id\)/);
  });
});

describe('v2.646 剧本 PK：自己的项目必须进入对手候选', () => {
  const w = windowBetween(app, 'async function openPk()', "$('pkBtn').onclick = openPk");
  it('定位 PK 对手加载调用点', () => {
    assert.ok(w, '应定位到 openPk');
    assert.match(w, /\/api\/generate\/projects/);
  });
  it('先归一化 projects，再筛选并渲染对手', () => {
    assertItemsNormalization(w, 'projectsRaw', 'projects');
    assert.match(w, /\(projects\s*\|\|\s*\[\]\)\.filter\(/);
    assert.match(w, /box\.appendChild\(el\)/);
  });
});

describe('v2.646 编剧室选项目：分页对象不得被转换成空列表', () => {
  const w = windowBetween(room, 'async function fillPickProjects()', 'async function onPickProjectChange()');
  it('定位编剧室项目加载调用点', () => {
    assert.ok(w, '应定位到 fillPickProjects');
    assert.match(w, /\/api\/generate\/projects/);
  });
  it('state.pickProjects 接收归一化后的列表，空态只响应真实空项目', () => {
    assertItemsNormalization(w, 'raw', 'list');
    assert.match(w, /state\.pickProjects\s*=\s*list/);
    assert.match(w, /if\s*\(!state\.pickProjects\.length\)/);
    assert.match(w, /state\.pickProjects\.map\(/);
  });
});
