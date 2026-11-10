/**
 * v2.496 页脚与悬浮球不重叠守卫（纯静态 CSS）
 *
 * 背景：右下角悬浮球 .xn-float 是 position:fixed，桌面端 58px 高、bottom:22px
 * （占视口底部 22~80px），移动端 48px 高、bottom:calc(14px + var(--kb-inset))
 * （占底部 14~62px 起）。.wrap 已有 padding-bottom 保护主内容，但 .site-footer
 * 在 .wrap 之外，原 margin-bottom 仅 12px——滚动到底部时悬浮球压住页脚右下角
 * 商务联系信息，用户读不到/点不到。
 *
 * 守卫目的：固化 .site-footer 的底部留白必须 ≥ 悬浮球占位高度，防止以后改样式
 * 时把这段留白删掉又出现遮挡。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');

// 从 css 中抽出 .site-footer 规则块（取第一个出现的定义到其闭合 }）
function footerBlock() {
  const m = css.match(/\.site-footer\s*\{[\s\S]*?\n\}/);
  return m ? m[0] : '';
}

// 取移动端（@media max-width:640px）内的 .site-footer 规则
function mobileFooterBlock() {
  const mediaIdx = css.indexOf('@media (max-width: 640px)');
  if (mediaIdx < 0) return '';
  const after = css.slice(mediaIdx);
  // 找到该 media 块结束（匹配花括号深度）
  let depth = 0, end = -1;
  for (let i = after.indexOf('{'); i < after.length; i++) {
    if (after[i] === '{') depth++;
    else if (after[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = end >= 0 ? after.slice(0, end + 1) : after;
  const m = block.match(/\.site-footer[^{]*\{[\s\S]*?\}/);
  return m ? m[0] : '';
}

// 从一个 CSS 块中提取底部留白（margin 简写末位 / margin-bottom / padding-bottom 的最大值）
function bottomClearanceOf(block) {
  if (!block) return 0;
  const marginMatch = block.match(/margin\s*:[^;]*?(\d+)px\s*[;}]/);
  const mbMatch = block.match(/margin-bottom\s*:\s*(\d+)px/);
  const pbMatch = block.match(/padding-bottom\s*:\s*(\d+)px/);
  return Math.max(
    marginMatch ? parseInt(marginMatch[1], 10) : 0,
    mbMatch ? parseInt(mbMatch[1], 10) : 0,
    pbMatch ? parseInt(pbMatch[1], 10) : 0
  );
}

describe('v2.496 页脚与悬浮球不重叠', () => {
  it('桌面端 .site-footer 底部留白 ≥ 80px（悬浮球 58px + bottom:22px）', () => {
    const block = footerBlock();
    assert.ok(block, 'styles.css 缺少 .site-footer 规则');
    const bottomClearance = bottomClearanceOf(block);
    assert.ok(
      bottomClearance >= 80,
      `.site-footer 底部留白仅 ${bottomClearance}px，不足以避开悬浮球（需 ≥80px）`
    );
  });

  it('移动端 .site-footer 底部留白 ≥ 64px（悬浮球 48px + bottom:14px + 余量）', () => {
    // 移动端若未单独覆写底部留白，则继承桌面端值；取两者较大值
    const baseClearance = bottomClearanceOf(footerBlock());
    const mobileClearance = bottomClearanceOf(mobileFooterBlock());
    const effective = Math.max(baseClearance, mobileClearance);
    assert.ok(
      effective >= 64,
      `移动端 .site-footer 有效底部留白仅 ${effective}px，需 ≥64px`
    );
  });
});
