/**
 * v2.498 首页必须是登录界面：左右分屏布局。
 *
 * 产品要求：首页（#view-home）必须是登录界面；登录表单不要居中，放一侧；
 * 另一侧放品牌展示/动效/更新通知/广告位。
 *
 * 守卫断言：
 *  G1  #view-home 内含 .home-split 分屏容器
 *  G2  左侧含 #homeAuthForm 真表单（手机号/密码/提交），与弹窗 authModal 解耦
 *  G3  右侧含 .home-showcase 展示区（品牌文案 + 动效轮播 + 更新通知 + 广告位）
 *  G4  展示区含版本更新通知入口（#homeUpdateNotice 或 data-home-update）
 *  G5  展示区含广告位占位（.home-ad-slot）
 *  G6  首页登录表单密码字段含可见性切换（.pwd-toggle data-target）
 *  G7  分屏在移动端降级为单列堆叠（@media max-width 下 grid-template-columns 为 1fr）
 *  G8  更新通知关闭按钮点击目标 ≥44×44px（移动端可访问性，ui-audit tinyTargets 防线）
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8');

// 只截取 #view-home 区块
const homeStart = html.indexOf('<div id="view-home">');
assert.ok(homeStart >= 0, 'index.html 缺少 #view-home');
const homeEnd = html.indexOf('</div>\n\n    <!-- v2.191', homeStart);
const homeBlock = html.slice(homeStart, homeEnd > homeStart ? homeEnd : homeStart + 4000);

describe('v2.498 首页登录分屏布局', () => {
  it('G1 #view-home 内含 .home-split 分屏容器', () => {
    assert.ok(
      /class="[^"]*home-split[^"]*"/.test(homeBlock),
      '#view-home 缺少 .home-split 分屏容器'
    );
  });

  it('G2 左侧含 #homeAuthForm 真表单（手机号/密码/提交），与弹窗 authModal 解耦', () => {
    assert.ok(/id="homeAuthForm"/.test(homeBlock), '缺少 #homeAuthForm');
    assert.ok(/<form[^>]*id="homeAuthForm"/.test(homeBlock), '#homeAuthForm 必须是 <form>');
    assert.ok(/id="homeAuthPhone"/.test(homeBlock), '缺少手机号输入 #homeAuthPhone');
    assert.ok(/id="homeAuthPwd"/.test(homeBlock), '缺少密码输入 #homeAuthPwd');
    assert.ok(/id="homeAuthSubmit"/.test(homeBlock), '缺少提交按钮 #homeAuthSubmit');
    // 与弹窗解耦：首页表单不得复用 authModal 的 ID
    assert.ok(!/id="authForm"/.test(homeBlock), '首页表单不得复用弹窗 #authForm');
  });

  it('G3 右侧含 .home-showcase 展示区（品牌文案 + 动效轮播 + 更新通知 + 广告位）', () => {
    assert.ok(/class="[^"]*home-showcase[^"]*"/.test(homeBlock), '缺少 .home-showcase 展示区');
  });

  it('G4 展示区含版本更新通知入口', () => {
    assert.ok(
      /id="homeUpdateNotice"|data-home-update/.test(homeBlock),
      '展示区缺少版本更新通知入口（#homeUpdateNotice 或 data-home-update）'
    );
  });

  it('G5 展示区含广告位占位', () => {
    assert.ok(/class="[^"]*home-ad-slot[^"]*"/.test(homeBlock), '展示区缺少广告位 .home-ad-slot');
  });

  it('G6 首页登录表单密码字段含可见性切换', () => {
    const pwdWrap = homeBlock.match(/<div class="pwd-wrap">[\s\S]*?<\/div>/);
    assert.ok(pwdWrap, '密码字段缺少 .pwd-wrap 包裹');
    assert.ok(/class="pwd-toggle"[^>]*data-target="homeAuthPwd"/.test(homeBlock), '缺少 .pwd-toggle[data-target=homeAuthPwd]');
  });

  it('G7 分屏在移动端降级为单列堆叠', () => {
    // styles.css 中 .home-split 的媒体查询必须在窄屏设为单列
    // 用括号匹配提取媒体查询块（处理嵌套 {}）
    let found = false;
    let idx = 0;
    while ((idx = css.indexOf('@media', idx)) !== -1) {
      const braceStart = css.indexOf('{', idx);
      if (braceStart === -1) break;
      // 检查是否含 max-width
      const mediaHeader = css.slice(idx, braceStart);
      if (!/max-width/.test(mediaHeader)) { idx = braceStart + 1; continue; }
      // 括号匹配找媒体查询结束
      let depth = 0, end = braceStart;
      for (let i = braceStart; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      const block = css.slice(braceStart, end + 1);
      if (/home-split/.test(block) && /grid-template-columns\s*:\s*1fr/.test(block)) {
        found = true; break;
      }
      idx = end + 1;
    }
    assert.ok(found, '.home-split 缺少移动端单列堆叠（grid-template-columns: 1fr）');
  });

  it('G8 更新通知关闭按钮点击目标 ≥44×44px', () => {
    // 提取 .home-update-close 规则块
    const m = css.match(/\.home-update-close\s*\{([^}]*)\}/);
    assert.ok(m, '缺少 .home-update-close 样式规则');
    const rule = m[1];
    // 必须有 min-width / min-height ≥44px，或 padding 足够大使触控目标达标
    const hasMinW = /min-width\s*:\s*(\d+)px/.test(rule) && parseInt(rule.match(/min-width\s*:\s*(\d+)px/)[1]) >= 44;
    const hasMinH = /min-height\s*:\s*(\d+)px/.test(rule) && parseInt(rule.match(/min-height\s*:\s*(\d+)px/)[1]) >= 44;
    // 兜底：padding + font-size 估算（padding 上下+字号 ≥44）
    const padMatch = rule.match(/padding\s*:\s*(\d+)px\s+(\d+)px/);
    const fsMatch = rule.match(/font-size\s*:\s*(\d+)px/);
    const padEstimateOk = padMatch && fsMatch && (parseInt(padMatch[1]) * 2 + parseInt(fsMatch[1])) >= 44
      && (parseInt(padMatch[2]) * 2 + parseInt(fsMatch[1])) >= 44;
    assert.ok((hasMinW && hasMinH) || padEstimateOk,
      '.home-update-close 点击目标需 ≥44×44px（min-width/min-height≥44 或 padding+字号达标）');
  });
});
