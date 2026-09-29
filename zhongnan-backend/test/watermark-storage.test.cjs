const test = require('node:test');
const assert = require('node:assert');
const W = require('../dist/lib/watermark.js');
const S = require('../dist/lib/storage.js');

test('去水印权限：高级及以上可去，免费/基础强制带笔名水印', () => {
  assert.strictEqual(W.canRemoveWatermark('FREE'), false);
  assert.strictEqual(W.canRemoveWatermark('BASIC'), false, '新口径：基础也带水印');
  assert.strictEqual(W.canRemoveWatermark('ADVANCED'), true);
  assert.strictEqual(W.canRemoveWatermark('PRO'), true);
});

test('水印自动带笔名，高等级选择去除时返回干净原文', () => {
  const base = '第1集 ……（正文）';
  const wm = W.applyWatermark(base, { penName: '南山客', level: 'BASIC' });
  assert.strictEqual(wm.watermarked, true);
  assert.ok(wm.text.includes('南山客') && wm.text.includes('终南集 · 人工通用智能（AGI）编剧大师'));
  const clean = W.applyWatermark(base, { penName: '南山客', level: 'PRO', removeWatermark: true });
  assert.strictEqual(clean.watermarked, false);
  assert.strictEqual(clean.text, base);
  // 不重复叠加
  const twice = W.applyWatermark(wm.text, { penName: '南山客', level: 'BASIC' });
  assert.strictEqual((twice.text.match(/南山客/g) || []).length, 1);
});

test('无笔名时回退昵称/匿名', () => {
  assert.ok(W.applyWatermark('正文', { nickname: '阿明', level: 'FREE' }).text.includes('阿明'));
  assert.ok(W.applyWatermark('正文', { level: 'FREE' }).text.includes('匿名编剧'));
});

test('存储配额按等级，超限拒绝并引导扩容', () => {
  const MB = 1024 * 1024;
  assert.strictEqual(S.canStore('FREE', 90 * MB, 20 * MB).ok, false, '免费100M超限');
  assert.strictEqual(S.canStore('FREE', 90 * MB, 5 * MB).ok, true);
  assert.strictEqual(S.canStore('PRO', 9 * 1024 * MB, 2 * 1024 * MB).ok, false);
  const ok = S.canStore('BASIC', 400 * MB, 200 * MB, 500 * MB, ).ok; // 扩容叠加
  assert.strictEqual(ok, true);
});

test('删除内容释放空间后可再写', () => {
  const MB = 1024 * 1024;
  const full = S.canStore('FREE', 99 * MB, 5 * MB);
  assert.strictEqual(full.ok, false);
  const freed = S.canStore('FREE', 60 * MB, 5 * MB); // 删除到60M
  assert.strictEqual(freed.ok, true);
});

test('扩容包均为正积分（不免费、可创收）', () => {
  assert.ok(S.STORAGE_PACKS.length >= 2);
  S.STORAGE_PACKS.forEach((p) => assert.ok(p.points > 0 && p.gb > 0));
});
