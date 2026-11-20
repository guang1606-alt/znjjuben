/**
 * v2.632 角色资产沉淀的声纹重算失败必须可归因。
 *
 * 先证伪：
 *   `src/engine/character-asset.ts` 的 `extractCastAssetDrafts` 在成稿≥100字时用对白指纹引擎
 *   重算声纹，外层 catch 只留一句「指纹重算失败不阻断沉淀，声纹置空」注释、零日志。引擎一旦因正文
 *   形态/词典变化抛错，本次沉淀的每个角色 `voicePrint` 全为 null、`lineCount` 全为 0，
 *   排序退化为圣经声明序，用户看到的资产「有卡无声纹」，服务端毫无线索；后续 /fix 的
 *   voicePrint 对照也随之静默失效。吞错保沉淀是对的，静默不是。
 * 修复：catch 改为 `logInternal(e,'cast-asset.voiceprint')`，仍不阻断沉淀、返回形状不变。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const CA = require('../dist/engine/character-asset.js');
const VP = require('../dist/engine/voice-print.js');

const characters = {
  林晚: { traits: '隐忍/要强', arc: '从退让到反击', voice: '短句、带刺' },
  陈默: { traits: '沉默寡言', arc: '从旁观到并肩', voice: '语气平缓' },
};
const longText = [
  '△雨夜餐厅，水晶灯忽明忽暗。',
  '林晚：这婚，我不结了。',
  '林晚：他说得很轻，可满桌没有人敢接话，你听见了吗？',
  '林晚：走吧，别回头。',
  '陈默：你想清楚了？',
  '陈默：门外下着雨，她一步也没有回头，我想拦却没伸手。',
  '陈默：有些路，走了就不能退。',
].join('\n') + '\n'.repeat(3); // >100 字，触发声纹重算分支

function captureErrors(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => (x instanceof Error ? x.stack || String(x) : String(x))).join(' ')); };
  try { return { value: fn(), calls }; } finally { console.error = orig; }
}

describe('v2.632 声纹重算失败留痕', () => {
  it('1) 指纹引擎抛错 → 留痕 cast-asset.voiceprint，沉淀不阻断但声纹为空', () => {
    const orig = VP.voicePrint;
    VP.voicePrint = () => { throw new Error('词典损坏'); };
    const { value: drafts, calls } = captureErrors(() => CA.extractCastAssetDrafts(characters, longText));
    VP.voicePrint = orig;
    const hit = calls.find((c) => c.includes('[cast-asset.voiceprint]'));
    assert.ok(hit, '声纹重算失败必须留痕 cast-asset.voiceprint；实际：' + (calls.join(' | ') || '(零日志)'));
    assert.ok(hit.includes('词典损坏'), '必须带错误信息；实际：' + hit);
    assert.strictEqual(drafts.length, 2, '吞错不得阻断沉淀');
    assert.ok(drafts.every((d) => d.voicePrint === null && d.lineCount === 0), '失败时声纹应为空（可见降级）');
  });

  it('2) 正常路径零日志，声纹照常落摘要（不误伤）', () => {
    const { value: drafts, calls } = captureErrors(() => CA.extractCastAssetDrafts(characters, longText));
    assert.strictEqual(calls.length, 0, '正常路径不应记日志；实际：' + calls.join(' | '));
    assert.ok(drafts.some((d) => d.voicePrint && d.voicePrint.signature), '正常路径应有角色拿到声纹摘要');
  });
});
