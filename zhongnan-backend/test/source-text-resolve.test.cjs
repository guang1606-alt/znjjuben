const { test } = require('node:test');
const assert = require('node:assert/strict');
// v2.319：episodes 原文解析——请求显式携带优先，项目 bible 兜底，三模式外一律不启用。
// 兜底是「拆爆款承接改编」与「立项后刷新续写」两条链路版权闸门不中断的关键。
const { resolveEpisodeSourceText } = require('../dist/engine/mode-gate.js');

test('请求显式 sourceText 优先于项目 bible 持久化原文', () => {
  const out = resolveEpisodeSourceText({
    canonMode: 'adapt', bodySourceText: '请求里携带的原作正文内容',
    project: { bible: { sourceText: '立项时持久化的原作正文内容' } },
  });
  assert.equal(out, '请求里携带的原作正文内容');
});

test('请求未携带时从 bible.sourceText 兜底（立项/拆爆款承接持久化路径）', () => {
  const out = resolveEpisodeSourceText({
    canonMode: 'adapt', bodySourceText: '',
    project: { bible: { sourceText: '立项时持久化的原作正文内容' } },
  });
  assert.equal(out, '立项时持久化的原作正文内容');
});

test('顶层缺失时回退 adaptationDraft.sourceText（历史承接数据兼容）', () => {
  const out = resolveEpisodeSourceText({
    canonMode: 'adapt',
    project: { bible: { adaptationDraft: { sourceText: '拆爆款时粘贴的爆款原文内容' } } },
  });
  assert.equal(out, '拆爆款时粘贴的爆款原文内容');
});

for (const mode of ['adapt', 'novel', 'hit_lab']) {
  test(`三模式之 ${mode} 启用原文解析`, () => {
    const out = resolveEpisodeSourceText({ canonMode: mode, bodySourceText: '足够长度的原作正文内容示例' });
    assert.equal(out, '足够长度的原作正文内容示例');
  });
}

for (const mode of ['tag', 'interview', 'softad', 'hot', 'interactive', 'film', 'long_ip', 'video_short', 'mature_x']) {
  test(`非原文模式 ${mode} 即使带 sourceText 也不启用（防越权注入）`, () => {
    const out = resolveEpisodeSourceText({
      canonMode: mode, bodySourceText: '足够长度的原作正文内容示例',
      project: { bible: { sourceText: '脏数据原文' } },
    });
    assert.equal(out, undefined);
  });
}

test('短于 10 字（含纯空白）视为无原文，不启用闸门', () => {
  assert.equal(resolveEpisodeSourceText({ canonMode: 'adapt', bodySourceText: '九个字啊啊啊啊啊' }), undefined);
  assert.equal(resolveEpisodeSourceText({ canonMode: 'adapt', bodySourceText: '   ' }), undefined);
  assert.equal(resolveEpisodeSourceText({ canonMode: 'adapt', bodySourceText: 123 }), undefined);
});

test('原文两侧空白被 trim，超长内容截断到 50000 字（防 bible 历史脏值撑爆提示词）', () => {
  const out = resolveEpisodeSourceText({ canonMode: 'novel', bodySourceText: '  足够长度的小说原文内容示例  ' });
  assert.equal(out, '足够长度的小说原文内容示例');
  const long = '源'.repeat(60000);
  const cut = resolveEpisodeSourceText({ canonMode: 'adapt', project: { bible: { sourceText: long } } });
  assert.equal(cut.length, 50000);
});

test('bible 为空/非对象形态不抛错', () => {
  assert.equal(resolveEpisodeSourceText({ canonMode: 'adapt', project: null }), undefined);
  assert.equal(resolveEpisodeSourceText({ canonMode: 'adapt', project: { bible: null } }), undefined);
  assert.equal(resolveEpisodeSourceText({ canonMode: 'adapt' }), undefined);
});
