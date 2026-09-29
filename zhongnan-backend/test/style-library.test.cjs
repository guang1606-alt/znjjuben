const test = require('node:test');
const assert = require('node:assert');
const T = require('../dist/engine/style-library.js');

test('三维风格合并：题材+受众+地域参数正确叠加', () => {
  const p = T.resolveStyle({ theme: 'shuangwen', audience: 'mass', region: 'dongbei' });
  assert.strictEqual(p.colloquial, 100); // 85+10+10 封顶100
  assert.strictEqual(p.maxSentence, 18 - 3);
  assert.ok(p.dialect.includes('咋整'));
  assert.ok(p.hooks.includes('打脸'));
});

test('古装权谋出现现代网络俚语→时代错配硬伤', () => {
  const p = T.resolveStyle({ theme: 'costume', audience: 'premium' });
  const r = T.styleConsistencyScan('内景 大殿·日\n太子：你这操作真是绝绝子，yyds啊。', p);
  assert.ok(r.issues.some((i) => i.type === 'anachronism' && i.severity === 'high'));
  assert.ok(r.score < 80);
});

test('违和组合（古装+东北乡土）给协调提示但不崩', () => {
  const p = T.resolveStyle({ theme: 'costume', region: 'dongbei' });
  assert.ok(p.conflictNote && p.conflictNote.includes('古装'));
});

test('高口语风格却全是书面长句、零语气词→被抓', () => {
  const p = T.resolveStyle({ theme: 'shuangwen', audience: 'mass' });
  const long = '这是一句没有任何语气停顿并且刻意写得极其冗长充满书面表达的台词用来测试超长句识别逻辑是否能够正常工作到位';
  const text = `内景 家·日\n甲：${long}\n乙：${long}\n丙：${long}\n丁：${long}`;
  const r = T.styleConsistencyScan(text, p);
  assert.ok(r.issues.some((i) => i.type === 'too_long'));
  assert.ok(r.issues.some((i) => i.type === 'not_colloquial'));
});

test('贴合风格的短剧台词：短句+语气词+无违禁→高分无硬伤', () => {
  const p = T.resolveStyle({ theme: 'shuangwen', audience: 'mass' });
  const text = '内景 家·日\n陈凯：滚啊，别让我再看见你。\n林晚：行呗，那你可别后悔呀。\n陈凯：就你？呵，走吧。\n林晚：嘛，走着瞧。';
  const r = T.styleConsistencyScan(text, p);
  assert.strictEqual(r.issues.some((i) => i.severity === 'high'), false);
  assert.strictEqual(r.score >= 80, true, `得分${r.score}`);
});

test('风格指令含可执行参数（句长/语气词/爽点）', () => {
  const d = T.buildDirective(T.resolveStyle({ theme: 'urban', audience: 'young_female' }));
  assert.ok(d.includes('句长') && d.includes('语气词') && d.includes('钩子'));
});
