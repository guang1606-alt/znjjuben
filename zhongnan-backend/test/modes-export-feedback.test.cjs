const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/config/modes.js');
const D = require('../dist/engine/export-doc.js');
const FB = require('../dist/engine/feedback.js');

test('创作模式 8 种（v2.329 三维重构），等级权限逐级开放', () => {
  assert.strictEqual(M.CREATION_MODES.length, 8);
  assert.strictEqual(M.modeAvailable('tag', 'FREE'), true);
  assert.strictEqual(M.modeAvailable('interview', 'FREE'), false);
  assert.strictEqual(M.modesForLevel('FREE').length, 1);
  assert.strictEqual(M.modesForLevel('BASIC').length, 4);
  assert.strictEqual(M.modesForLevel('ADVANCED').length, 7);
  assert.strictEqual(M.modesForLevel('PRO').length, 8);
  // 话力成本分层：灵感式门槛下调为 BASIC，轨道级（爆款逆向）仍 PRO 把关
  assert.strictEqual(M.modeAvailable('spark', 'BASIC'), true);
  assert.strictEqual(M.modeAvailable('duel', 'ADVANCED'), true);
  assert.strictEqual(M.modeAvailable('duel', 'BASIC'), false);
  assert.strictEqual(M.modeAvailable('multiverse', 'ADVANCED'), false);
  assert.strictEqual(M.modeAvailable('multiverse', 'PRO'), true);
  assert.strictEqual(M.unlockLevel('multiverse'), 'PRO');
});
test('历史 wire-id 全部能归一（12 个旧 id 收敛为 8 模式，不丢项目）', () => {
  const wire = ['interview', 'adapt', 'tags', 'novel', 'interactive', 'hit_lab', 'hot', 'shortvideo', 'softad', 'xscript', 'longip', 'film'];
  const canon = wire.map((w) => M.canonicalModeId(w));
  assert.ok(canon.every(Boolean), '所有前端模式 id 必须可识别');
  assert.strictEqual(new Set(canon).size, 6, '12 个前端 wire-id 全部有去处（收敛为 6 个 canonical 模式，其余 2 个新模式由前端直接发送）');
  assert.strictEqual(M.canonicalModeId('tags'), 'tag');
  assert.strictEqual(M.canonicalModeId('shortvideo'), 'spark');
  assert.strictEqual(M.canonicalModeId('softad'), 'spark');
  assert.strictEqual(M.canonicalModeId('novel'), 'spark');
  assert.strictEqual(M.canonicalModeId('xscript'), 'persona');
  assert.strictEqual(M.canonicalModeId('scene'), 'spark');
  assert.strictEqual(M.canonicalModeId('reverse'), 'spark');
  assert.strictEqual(M.canonicalModeId('longip'), 'multiverse');
  assert.strictEqual(M.canonicalModeId('interactive'), 'tag');
  assert.strictEqual(M.isComingSoon('film'), false);
  assert.strictEqual(M.modeAvailable('film', 'ADVANCED'), true);
  assert.strictEqual(M.modeAvailable('tags', 'FREE'), true);
});
test('灵感式三条轨道分级：素材改编 BASIC、名场面 ADVANCED、爆款逆向 PRO', () => {
  assert.strictEqual(M.trackAvailable('spark', 'material_rewrite', 'BASIC'), true);
  assert.strictEqual(M.trackAvailable('hit_lab', 'material_rewrite', 'BASIC'), true);
  assert.strictEqual(M.trackAvailable('spark', 'signature_scene', 'BASIC'), false);
  assert.strictEqual(M.trackAvailable('spark', 'signature_scene', 'ADVANCED'), true);
  assert.strictEqual(M.trackAvailable('spark', 'hit_reverse', 'ADVANCED'), false);
  assert.strictEqual(M.trackAvailable('spark', 'hit_reverse', 'PRO'), true);
  assert.strictEqual(M.trackUnlockLevel('spark', 'hit_reverse'), 'PRO');
  assert.strictEqual(M.canonicalSparkTrack(undefined), 'material_rewrite');
  assert.strictEqual(M.canonicalSparkTrack('reverse'), 'hit_reverse');
  // 非灵感式模式轨道闸门恒放行
  assert.strictEqual(M.trackAvailable('tag', undefined, 'FREE'), true);
  assert.strictEqual(M.trackUnlockLevel('tag', undefined), null);
});

function meta() {
  return {
    title: '测试剧', penName: '南山客', synopsis: '女主逆袭的故事。'.repeat(10),
    logline: '一句话故事',
    characters: [{ name: '林晚', desc: '隐忍到爆发的女主' }, { name: '陈凯', desc: '前夫' }],
    episodes: [
      { n: 1, title: '离婚夜', body: '内景 家·夜\n△ 动作。\n林晚：走。'.repeat(20) },
      { n: 2, title: '反转', body: '外景 巷口·夜\n△ 远光。'.repeat(20) },
    ],
  };
}

test('导出文档含封面/大纲/人物小传/分集目录/完整分集与页码', () => {
  const doc = D.buildExportDocument(meta());
  assert.ok(doc.coverLines.some((l) => l.includes('测试剧')));
  assert.ok(doc.coverLines.some((l) => l.includes('南山客')));
  const keys = doc.sections.map((s) => s.key);
  assert.ok(keys.includes('synopsis') && keys.includes('characters'));
  assert.strictEqual(doc.sections.filter((s) => s.key.startsWith('ep_')).length, 2);
  assert.ok(doc.toc.some((t) => t.label.includes('第1集')));
  assert.match(doc.footer(1), /第 1 页\s+共 \d+ 页/);
  assert.ok(doc.pageCount >= doc.sections.length + 2);
});

test('导出空内容被拒绝（不生成空壳文档）', () => {
  assert.throws(() => D.buildExportDocument({ title: 'x', synopsis: '', characters: [], episodes: [] }));
  assert.throws(() => D.buildExportDocument({ title: '', synopsis: '', characters: [], episodes: [{ n: 1, title: 'a', body: 'b' }] }));
});

test('反馈三态：状态流转 + 小南暖心回复 + 管理员手改优先', () => {
  assert.strictEqual(FB.nextStatus('execute'), 'executing');
  assert.strictEqual(FB.nextStatus('todo'), 'todo');
  assert.strictEqual(FB.nextStatus('reject'), 'rejected');
  assert.strictEqual(FB.organizeRequest('这个按钮点了报错崩溃').category, '缺陷修复');
  const r = FB.xiaonanReply('execute', { penName: '南山客', summary: '增加听剧本' });
  assert.ok(r.includes('南山客') && r.includes('听剧本'));
  const manual = FB.xiaonanReply('reject', { manualText: '我自己写的回复' });
  assert.strictEqual(manual, '我自己写的回复');
  assert.ok(FB.xiaonanReply('reject', {}).includes('谢谢'));
});

test('待办可按会员等级/时间归纳排序', () => {
  const list = [
    { id: '1', content: 'a', level: 'FREE', createdAt: '2026-08-01' },
    { id: '2', content: 'b', level: 'PRO', createdAt: '2026-08-03' },
    { id: '3', content: 'c', level: 'ADVANCED', createdAt: '2026-08-02' },
  ];
  assert.strictEqual(FB.queryTodos(list, { sortBy: 'level' })[0].level, 'PRO');
  assert.strictEqual(FB.queryTodos(list, { sortBy: 'time' })[0].id, '2');
  assert.strictEqual(FB.queryTodos(list, { level: 'PRO' }).length, 1);
});

test('一键执行解决路径：知识类工具端自愈/代码类回豆包/资金类人工', () => {
  assert.strictEqual(FB.resolveFixPath('希望增加婆媳题材标签和敏感词').route, 'tool_auto');
  assert.strictEqual(FB.resolveFixPath('下载按钮点了报错崩溃').route, 'doubao');
  assert.strictEqual(FB.resolveFixPath('用户要求退款还说要投诉').route, 'manual');
  assert.strictEqual(FB.resolveFixPath('增加婆媳题材标签').autoFixable, true);
  assert.strictEqual(FB.resolveFixPath('下载按钮点了报错').autoFixable, false);
});
