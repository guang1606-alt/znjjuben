/**
 * v2.260 异步提交重入守卫（双击/连点不得发起第二笔在途请求）—— 静态守卫 web/app.js
 * 背景：placeOrder（创建订单）/buyListing（积分购买托管）/dealAction（确认收货/退款）
 *  三个资金动作与 craftGo（递招推荐）此前无函数级在途锁：慢网络下双击 = 两笔订单/
 *  两次扣积分/重复推荐请求。项目既有范式：xMatureSubmit 与 submitFeedback 的
 *  btn.disabled=true/finally 复位；ivStart 的 ivBusy 标志。资金动作为多入口共享
 * （placeOrder 同时被 [data-sku] 按钮与 xMatureBuy 调用），按钮级锁挡不住跨入口
 *  重入，故统一采用函数级 in-flight 标志：入口 if (_xxx) return; finally 复位。
 * 本文件断言四处守卫不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const srcRaw = fs.readFileSync(path.join(path.join(__dirname, '..', 'web'), 'app.js'), 'utf8');
// 剥行注释后再匹配代码形态（防注释文字击中断言造成假红）
const src = srcRaw.replace(/\/\/.*$/gm, '');

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 2000));
}

function assertInFlightLock(fnName, flag, startMarker, endMarker) {
  const w = fnWindow(startMarker, endMarker);
  assert.ok(w, `应定位到 ${fnName}`);
  const early = w.indexOf(`if (${flag}) return`);
  assert.ok(early >= 0, `${fnName} 入口应有 if (${flag}) return 在途守卫`);
  const setPos = w.indexOf(`${flag} = true`);
  assert.ok(setPos > early, `${fnName} 应在守卫后置位 ${flag} = true`);
  const tryPos = w.indexOf('try');
  assert.ok(tryPos > setPos, `${fnName} 置位应在 try 之前（进入在途态后再发请求）`);
  const finallyPos = w.indexOf('finally');
  assert.ok(finallyPos > tryPos, `${fnName} 应有 finally 块`);
  const resetPos = w.indexOf(`${flag} = false`, finallyPos);
  assert.ok(resetPos > finallyPos, `${fnName} finally 内应复位 ${flag} = false（异常也必须解锁）`);
}

describe('v2.260 资金动作函数级在途锁（双击不双单）', () => {
  it('placeOrder：_placingOrder 锁（[data-sku] 与 xMatureBuy 两入口共享）', () => {
    assert.ok(/let\s+_placingOrder\s*=\s*false\s*;/.test(src), '应声明 let _placingOrder = false;');
    assertInFlightLock('placeOrder', '_placingOrder', 'async function placeOrder(', '/* ---------- v2.220');
  });

  it('buyListing：_buyingListing 锁（detailBuyBtn 双击不双扣积分）', () => {
    assert.ok(/let\s+_buyingListing\s*=\s*false\s*;/.test(src), '应声明 let _buyingListing = false;');
    assertInFlightLock('buyListing', '_buyingListing', 'async function buyListing(', 'async function viewPurchasedScript');
  });

  it('dealAction：_dealBusy 锁（确认收货/退款双击不重复提交）', () => {
    assert.ok(/let\s+_dealBusy\s*=\s*false\s*;/.test(src), '应声明 let _dealBusy = false;');
    assertInFlightLock('dealAction', '_dealBusy', 'async function dealAction(', "$('mkMineBtn').onclick");
  });
});

describe('v2.260 轻量提交在途锁', () => {
  it('craftGo：_craftGoing 锁（递招推荐双击不发重复请求；程序化调用共享同一锁）', () => {
    assert.ok(/let\s+_craftGoing\s*=\s*false\s*;/.test(src), '应声明 let _craftGoing = false;');
    assertInFlightLock('craftGo', '_craftGoing', 'async function craftGo(', "const craftGoBtn");
  });
});
