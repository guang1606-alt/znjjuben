/**
 * v2.684 工具箱入口一致性：首页预览与工具箱页必须是同一套工具
 *
 * 证伪：首页「创作工具箱」列出 6 张卡（选题会/剧本围读/拆爆款/多版本去重/剧本体检/打磨阶梯），
 * 点进导航「工具箱」却只有 5 张（缺选题会与剧本围读、多出互动分支校验）。
 * 同一个名字、两套清单：用户在首页看到选题会，进工具箱找不到；在工具箱发现的互动分支，
 * 首页预览里又没有。两边都自称「创作工具箱」，却互相否定。
 *
 * 修复口径：以 constants.js 的 HOME_TOOLS 为唯一清单（7 项、固定顺序），
 * 首页静态卡、工具箱静态卡、app.js 兜底三处同源同序，任何一处漂移立刻红。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WEB = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');

function loadConstants() {
  const code = fs.readFileSync(path.join(WEB, 'data', 'constants.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.ZN_DATA;
}
const TOOLS = Array.from(loadConstants().HOME_TOOLS);
const EXPECTED_KEYS = TOOLS.map((x) => x.key);
const EXPECTED_IDS = TOOLS.map((x) => x.id);

function sliceBetween(startMarker, endMarker) {
  const i = html.indexOf(startMarker);
  assert.ok(i >= 0, `index.html 缺少定位标记：${startMarker}`);
  const j = html.indexOf(endMarker, i);
  assert.ok(j > i, `index.html 缺少结束标记：${endMarker}`);
  return html.slice(i, j);
}

function titles(block, heading) {
  const re = new RegExp(`<${heading} data-i="(tbCard[^"]+)"`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
}

describe('v2.684 首页与工具箱的工具清单同源同序', () => {
  const home = sliceBetween('id="homeToolGrid"', '</section>');
  const box = sliceBetween('id="toolboxGrid"', '</div>');

  it('① 首页静态卡与 HOME_TOOLS 的标题键完全一致（含顺序）', () => {
    assert.deepStrictEqual(titles(home, 'h3'), EXPECTED_KEYS);
  });

  it('② 工具箱静态卡与 HOME_TOOLS 的标题键完全一致（含顺序）', () => {
    assert.deepStrictEqual(titles(box, 'h2'), EXPECTED_KEYS);
  });

  it('③ 互动分支校验在两边都能被看到（首页原先缺）', () => {
    assert.ok(home.includes('data-i="tbCardBr"'), '首页工具预览缺互动分支校验');
    assert.ok(box.includes('data-i="tbCardBr"'), '工具箱缺互动分支校验');
  });

  it('④ 选题会 / 剧本围读在工具箱页也有入口（原先只在首页）', () => {
    for (const id of ['toolPitch', 'toolRead']) {
      assert.ok(new RegExp(`id="${id}"`).test(box), `工具箱缺 #${id} 卡片`);
    }
  });

  it('⑤ 全部工具 id 都能在工具箱页找到，点击映射不会落空', () => {
    for (const id of EXPECTED_IDS) {
      assert.ok(new RegExp(`id="${id}"`).test(box), `工具箱缺 #${id}`);
    }
  });

  it('⑥ app.js 兜底清单与 constants.js 同源同序', () => {
    const fallback = app.slice(app.indexOf('const HOME_TOOLS'), app.indexOf('];', app.indexOf('const HOME_TOOLS')) + 2);
    const ids = Array.from(fallback.matchAll(/id:\s*'([^']+)'/g), (m) => m[1]);
    assert.deepStrictEqual(ids, EXPECTED_IDS);
  });
});
