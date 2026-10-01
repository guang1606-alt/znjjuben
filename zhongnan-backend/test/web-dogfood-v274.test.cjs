/**
 * v2.274 dogfood 第九轮（移动端弱网 lens）——作品库搜索 stale-response 乱序竞态
 * 背景（DEMO 8099，iPhone13 模拟 + Playwright 弱网乱序实证，账号 13900000003 有 1 作品）：
 *  作品库搜索框 250ms 防抖触发 loadWorks。弱网下制造乱序：先发请求 A（无 q=全量）延迟 1500ms，
 *  随即输入无匹配词发请求 B（q=zzzznope）秒回空结果；B 返回时 grid=0、空态可见（正确）；
 *  1.5s 后 A 晚回，竟把全量 1 张卡片写回 grid、worksCount 显示「共 1 个项目」——
 *  而搜索框仍是 zzzznope，列表与搜索词完全不符。
 *  根因：loadWorks 只有「换号」守卫 isPrivateSessionCurrent（v2 合并隔离），能挡切号，
 *  却挡不住同一会话内两个查询乱序返回；v2.258/v2.259 已给市场 mkReqSeq、广场 feedReqSeq、
 *  投稿 subMatchSeq 加了请求序号，作品搜索是唯一漏网的高频参数切换加载。
 * 修法（沿用 mkReqSeq/feedReqSeq 成熟范式）：
 *  - 模块级 let worksReqSeq = 0；
 *  - loadWorks 在发请求前 const seq = ++worksReqSeq；
 *  - 成功路径 await jsonOrThrow 之后、写 worksCount/empty/grid 之前，
 *    在原有换号守卫上并列 seq !== worksReqSeq 拦截（旧响应直接 return，不碰 DOM）；
 *  - catch 分支同样加序号拦截——旧请求失败也不得用错误态覆盖新查询的正确结果。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8')
  .replace(/\/\/.*$/gm, ''); // 剥行注释

function fnWindow(startMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  return src.slice(s, s + (maxLen || 6000));
}

describe('v2.274 [R1] loadWorks 搜索请求序号防 stale-response 乱序', () => {
  const w = fnWindow('async function loadWorks() {', 6000);

  it('A1 模块级请求序号 let worksReqSeq = 0 已声明', () => {
    assert.match(src, /let\s+worksReqSeq\s*=\s*0\s*;/);
  });

  it('A2 loadWorks 窗口可定位且内含作品列表请求', () => {
    assert.ok(w.length > 0, 'loadWorks 未定位到');
    assert.match(w, /Api\.request\('\/api\/generate\/projects'/);
  });

  it('A3 发请求前自增序号（const seq = ++worksReqSeq）', () => {
    assert.match(w, /const\s+seq\s*=\s*\+\+worksReqSeq\s*;/);
  });

  it('A4 序号自增必须早于请求发出（不能在 await 之后才 ++）', () => {
    const iInc = w.indexOf('++worksReqSeq');
    const iReq = w.indexOf("Api.request('/api/generate/projects'");
    assert.ok(iInc >= 0 && iReq > 0, '序号自增/请求均应在窗口内');
    assert.ok(iInc < iReq, '序号必须在请求发出前自增，否则拦不住先发的旧响应');
  });

  it('A5 成功路径 await 之后有「换号 || 序号过期」联合拦截', () => {
    // 形态：if (!isPrivateSessionCurrent(account) || seq !== worksReqSeq) return;
    assert.match(
      w,
      /if\s*\(\s*!isPrivateSessionCurrent\(account\)\s*\|\|\s*seq\s*!==\s*worksReqSeq\s*\)\s*return\s*;/
    );
  });

  it('A6 catch 分支同样按序号作废旧失败（成功+失败合计 ≥2 处序号校验）', () => {
    const all = w.match(/seq\s*!==\s*worksReqSeq/g) || [];
    assert.ok(all.length >= 2, `期望成功路径与 catch 各一处序号校验（≥2），实际 ${all.length}`);
  });

  it('A7 序号拦截位于成功结果 DOM 写入之前（worksCount 结果渲染不得先于校验）', () => {
    const iGuard = w.indexOf('seq !== worksReqSeq');
    // 锚到成功路径渲染「共 N 个项目」，避开未登录分支的同名 worksCount 清空
    const iRender = w.indexOf("t('worksCount'");
    assert.ok(iGuard >= 0, '应有序号校验');
    assert.ok(iRender > iGuard, '首个序号校验必须早于 worksCount 结果渲染，旧响应才能在渲染前被丢弃');
  });

  it('A8 校验后仍保留换号隔离（不得因加序号而删掉账号守卫）', () => {
    const guards = w.match(/isPrivateSessionCurrent\(account\)/g) || [];
    assert.ok(guards.length >= 2, '成功与 catch 两条路径都必须保留 isPrivateSessionCurrent 换号守卫');
  });
});
