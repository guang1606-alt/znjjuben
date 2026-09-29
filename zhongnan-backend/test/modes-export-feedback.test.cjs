const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/config/modes.js');
const D = require('../dist/engine/export-doc.js');
const FB = require('../dist/engine/feedback.js');

test('创作模式保持十二大（v2.14 名场面+逆向整合为hit_lab、新增长IP；v2.86电影上线），等级权限逐级开放', () => {
  assert.strictEqual(M.CREATION_MODES.length, 12);
  assert.strictEqual(M.modeAvailable('tag', 'FREE'), true);
  assert.strictEqual(M.modeAvailable('interview', 'FREE'), false);
  assert.strictEqual(M.modesForLevel('BASIC').length, 5);
  assert.strictEqual(M.modesForLevel('ADVANCED').length, 9);
  // v2.86 电影剧本上线，专业版可用12个
  assert.strictEqual(M.modesForLevel('PRO').length, 12);
  // 第9种短视频、第10种软广均高级可用（与前端 wire-id 对齐）
  assert.strictEqual(M.modeAvailable('video_short', 'ADVANCED'), true);
  assert.strictEqual(M.modeAvailable('branded_skit', 'ADVANCED'), true);
  assert.strictEqual(M.modeAvailable('branded_skit', 'PRO'), true);
  assert.strictEqual(M.unlockLevel('branded_skit'), 'ADVANCED');
  // v2.14 整合：工作台高级可用、长系列IP专业可用
  assert.strictEqual(M.modeAvailable('hit_lab', 'ADVANCED'), true);
  assert.strictEqual(M.modeAvailable('long_ip', 'ADVANCED'), false);
  assert.strictEqual(M.modeAvailable('long_ip', 'PRO'), true);
});
test('前端线上 wire-id 全部能归一（旧 scene/reverse 归一到整合后的 hit_lab），12 模式不串模', () => {
  const wire = ['interview', 'adapt', 'tags', 'novel', 'interactive', 'hit_lab', 'hot', 'shortvideo', 'softad', 'xscript', 'longip', 'film'];
  const canon = wire.map((w) => M.canonicalModeId(w));
  assert.ok(canon.every(Boolean), '所有前端模式 id 必须可识别');
  assert.strictEqual(new Set(canon).size, 12, '12个前端模式归一后仍为12个、不串模');
  assert.strictEqual(M.canonicalModeId('tags'), 'tag');
  assert.strictEqual(M.canonicalModeId('shortvideo'), 'video_short');
  assert.strictEqual(M.canonicalModeId('softad'), 'branded_skit');
  assert.strictEqual(M.canonicalModeId('xscript'), 'mature_x');
  // 旧模式 id 向后兼容，统一进入整合后的工作台
  assert.strictEqual(M.canonicalModeId('scene'), 'hit_lab');
  assert.strictEqual(M.canonicalModeId('reverse'), 'hit_lab');
  assert.strictEqual(M.canonicalModeId('longip'), 'long_ip');
  assert.strictEqual(M.modeAvailable('reverse', 'FREE'), false);
  assert.strictEqual(M.modeAvailable('tags', 'FREE'), true);
  // v2.86 电影剧本模式已上线，不再是 coming_soon
  assert.strictEqual(M.isComingSoon('film'), false);
  assert.strictEqual(M.modeAvailable('film', 'PRO'), true);
});
test('v2.14 名场面工作台两轨道分级：名场面拓展高级、爆款逆向批量专业', () => {
  assert.strictEqual(M.trackAvailable('hit_lab', 'signature_scene', 'ADVANCED'), true);
  assert.strictEqual(M.trackAvailable('hit_lab', 'hit_reverse', 'ADVANCED'), false);
  assert.strictEqual(M.trackAvailable('hit_lab', 'hit_reverse', 'PRO'), true);
  assert.strictEqual(M.trackUnlockLevel('hit_lab', 'hit_reverse'), 'PRO');
  assert.strictEqual(M.canonicalHitLabTrack(undefined), 'signature_scene');
  assert.strictEqual(M.canonicalHitLabTrack('reverse'), 'hit_reverse');
  // 非工作台模式轨道闸门恒放行
  assert.strictEqual(M.trackAvailable('tag', undefined, 'FREE'), true);
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
