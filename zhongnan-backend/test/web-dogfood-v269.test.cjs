/**
 * v2.269 dogfood 第四轮（弱网/连点 lens）——两修复，静态守卫 web/
 * 背景（DEMO 8099 + 源码勘察证据）：
 *  1. [W1] 交流广场发帖 sqSubmit 无在途锁：弱网（或正常网连点）下用户双击「发布」，
 *     两次 POST /api/community/posts 都成功 → 广场出现重复帖（内容完全相同）。
 *     对比同站已有保护：authSubmit disabled、fbSubmitBtn disabled、tagRandom tagBusy、
 *     detailBuy _buyingListing、dealAction _dealBusy、pkStartBtn disabled。
 *     修法：sqSubmit 加 _sqPosting 在途锁（防重入）+ 按钮 disabled。
 *  2. [W2] 市场上架 listSubmit 无在途锁：弱网双击「上架」→ 两次 POST /api/market/listings
 *     → 同一剧本挂出两条 listing（价格/样章相同），卖家自己买不回、买家看到重复商品。
 *     修法：listSubmit 加 _listing 在途锁 + 按钮 disabled。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '..', 'web');
const srcRaw = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
// 剥行注释后再匹配代码形态（防注释文字击中断言造成假红）
const src = srcRaw.replace(/\/\/.*$/gm, '');

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 4000));
}

describe('v2.269 [W1] 交流广场发帖必须有在途锁防连点', () => {
  const w = fnWindow("$('sqSubmit').onclick", '/* ---------- 剧本交易广场');

  it('sqSubmit 处理器存在且可定位', () => {
    assert.ok(w, '应定位到 sqSubmit.onclick 窗口');
    assert.ok(/Api\.request\('\/api\/community\/posts'/.test(w), '窗口内应含 POST /api/community/posts');
  });

  it('POST 前有在途锁检查（防重入）', () => {
    const postPos = w.indexOf("Api.request('/api/community/posts'");
    const head = w.slice(0, postPos);
    assert.ok(/if\s*\(\s*_sqPosting\s*\)\s*return/.test(head),
      'POST /api/community/posts 之前必须有 if (_sqPosting) return 锁检查（防双击重复发帖）');
  });

  it('finally 中释放在途锁', () => {
    const postPos = w.indexOf("Api.request('/api/community/posts'");
    const tail = w.slice(postPos);
    assert.ok(/finally\s*\{[^}]*_sqPosting\s*=\s*false/.test(tail),
      'finally 中须将 _sqPosting 置回 false（否则发帖一次后按钮永久锁死）');
  });
});

describe('v2.269 [W2] 市场上架必须有在途锁防连点', () => {
  const w = fnWindow("$('listSubmit').onclick", "let _buyingListing = false", 3000);

  it('listSubmit 处理器存在且可定位', () => {
    assert.ok(w, '应定位到 listSubmit.onclick 窗口');
    assert.ok(/Api\.request\('\/api\/market\/listings'/.test(w), '窗口内应含 POST /api/market/listings');
  });

  it('POST 前有在途锁检查（防重入）', () => {
    const postPos = w.indexOf("Api.request('/api/market/listings'");
    const head = w.slice(0, postPos);
    assert.ok(/if\s*\(\s*_listing\s*\)\s*return/.test(head),
      'POST /api/market/listings 之前必须有 if (_listing) return 锁检查（防双击重复上架）');
  });

  it('finally 中释放在途锁', () => {
    const postPos = w.indexOf("Api.request('/api/market/listings'");
    const tail = w.slice(postPos);
    assert.ok(/finally\s*\{[^}]*_listing\s*=\s*false/.test(tail),
      'finally 中须将 _listing 置回 false（否则上架一次后按钮永久锁死）');
  });
});
