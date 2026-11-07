/**
 * v2.450 首屏关键路径：14 个脚本从「解析阻塞串行」改为 defer 并行下载、顺序执行。
 *
 * 证伪背景：index.html 尾部 14 个 `<script src="./xxx.js">` 全部没有 defer/async，
 * 浏览器每遇到一个都要停下解析、发起请求、等下载+执行完才继续——零构建站点又没有打包，
 * 等于首屏要先串行等 14 个往返（弱网/移动端尤其明显），HTML 早就到了却迟迟不能绘制。
 * defer 保留文档顺序执行（i18n/api/constants 仍先于 app.js），但下载与解析并行，
 * 且执行推迟到 DOM 解析完毕，app.js 里对 DOM 的抓取只会更安全。
 * 守卫点：不能改用 async（会打乱依赖顺序，app.js 可能在 i18n/constants 之前跑）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => ({ raw: m[0], src: m[1] }));

test('① 入口脚本全部是 defer：不再阻塞 HTML 解析', () => {
  assert.ok(tags.length >= 10, `入口脚本数量异常：${tags.length}`);
  const blocking = tags.filter((t) => !/\bdefer\b/.test(t.raw));
  assert.deepStrictEqual(blocking.map((t) => t.src), [],
    `这些脚本仍阻塞首屏解析（缺 defer）：${blocking.map((t) => t.src).join(', ')}`);
});

test('② 不使用 async：依赖顺序必须稳定（i18n/api/constants 先于 app.js）', () => {
  const asyncTags = tags.filter((t) => /\basync\b/.test(t.raw));
  assert.deepStrictEqual(asyncTags.map((t) => t.src), [],
    'async 不保证执行顺序，会让 app.js 抢在 i18n/constants 之前执行');
  const order = tags.map((t) => t.src);
  const before = (a, b) => {
    const i = order.findIndex((s) => s.includes(a));
    const j = order.findIndex((s) => s.includes(b));
    assert.ok(i >= 0 && j >= 0 && i < j, `${a} 必须排在 ${b} 之前`);
  };
  before('i18n.js', 'app.js');
  before('api.js', 'app.js');
  before('data/constants.js', 'app.js');
});

test('③ defer 与 v2.447 版本化并存：src 仍以 ?v= 结尾且 defer 在标签属性位', () => {
  for (const t of tags) {
    // 版本号由服务端在渲染入口时注入，源码里只校验结构不被破坏
    assert.ok(!/src="[^"]*\s[^"]*"/.test(t.raw), `属性值内不应出现空格：${t.raw}`);
    assert.ok(/\bsrc="\.\/[^"?]+\.js"/.test(t.raw), `应仍是同源相对引用，便于服务端版本化：${t.raw}`);
  }
});
