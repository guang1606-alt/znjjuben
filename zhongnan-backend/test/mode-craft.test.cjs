const test = require('node:test');
const assert = require('node:assert');
const MC = require('../dist/engine/mode-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.14 非对应模式不注入指令', () => {
  assert.strictEqual(MC.buildHitLabDirective('tag', undefined, 'zh'), '');
  assert.strictEqual(MC.buildHitLabDirective(undefined, undefined, 'en'), '');
  assert.strictEqual(MC.buildLongIpDirective('interview', 'zh'), '');
});

test('v2.14 名场面工作台两轨道指令不同：拓展重峰值前后延，逆向重骨架不复制+批量', () => {
  const scene = MC.buildHitLabDirective('hit_lab', 'signature_scene', 'zh');
  const rev = MC.buildHitLabDirective('hit_lab', 'hit_reverse', 'zh');
  assert.ok(scene.includes('峰值') && scene.includes('向前补'));
  assert.ok(rev.includes('方法论骨架') && rev.includes('3-5'));
  assert.ok(scene !== rev);
  // 缺省轨道回落名场面拓展
  assert.ok(MC.buildHitLabDirective('hit_lab', undefined, 'zh').includes('峰值'));
});

test('v2.14 长系列IP指令覆盖系列圣经/季终大钩/伏笔账本/多IP联动', () => {
  const zh = MC.buildLongIpDirective('long_ip', 'zh');
  ['系列圣经', '季终', '伏笔账本', '多IP联动', '单季可入坑'].forEach((k) => assert.ok(zh.includes(k), `缺 ${k}`));
  const en = MC.buildLongIpDirective('long_ip', 'en');
  assert.ok(/series bible/i.test(en) && /mega-hook/i.test(en) && /crossover/i.test(en) && !cjk(en));
  const revEn = MC.buildHitLabDirective('hit_lab', 'hit_reverse', 'en');
  assert.ok(/REVERSE-ENGINEERING/.test(revEn) && !cjk(revEn));
});

test('v2.14 长系列IP结构标签入树且全局无重名', () => {
  ['多季分季结构', '季终大钩子', '跨季伏笔账本', '主角团成长谱系', 'IP世界观扩容', '多IP联动宇宙', '系列反派阶梯', '系列记忆点回扣', '单季可入坑'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});

test('v2.86 十模式方法论：空/未知模式不注入，十模式(含film)中英双份且非空', () => {
  assert.strictEqual(MC.buildModeCraftDirective(undefined, 'zh'), '');
  assert.strictEqual(MC.buildModeCraftDirective('', 'zh'), '');
  assert.strictEqual(MC.buildModeCraftDirective('unknown_xyz', 'en'), '', '未知模式空串');
  const modes = ['interview', 'adapt', 'tag', 'novel', 'interactive', 'hot', 'video_short', 'branded_skit', 'mature_x', 'film'];
  for (const m of modes) {
    const zh = MC.buildModeCraftDirective(m, 'zh');
    const en = MC.buildModeCraftDirective(m, 'en');
    assert.ok(zh.length > 80, `${m} 中文方法论非空且充实`);
    assert.ok(en.length > 80, `${m} 英文方法论非空且充实`);
    assert.ok(!cjk(en), `${m} 英文链路零中文`);
  }
});

test('v2.83 模式方法论要点：短视频/软广/热点/成年向关键创作纪律存在', () => {
  const vs = MC.buildModeCraftDirective('video_short', 'zh');
  assert.ok(vs.includes('3 秒钩子') && vs.includes('分镜') && vs.includes('口播'), '短视频：钩子+分镜+口播');
  assert.ok(vs.includes('△') && vs.includes('台词行'), '短视频：兼容既有剧本版式闸门');
  assert.ok(/3-second hook/.test(MC.buildModeCraftDirective('video_short', 'en')) && /CTA/.test(MC.buildModeCraftDirective('video_short', 'en')));
  const bs = MC.buildModeCraftDirective('branded_skit', 'zh');
  assert.ok(bs.includes('解题者') && bs.includes('一个核心卖点') && bs.includes('合规边界'), '软广：解题者定位+单卖点+合规');
  const hot = MC.buildModeCraftDirective('hot', 'zh');
  assert.ok(hot.includes('借势档位') && hot.includes('风险前置') && hot.includes('3 秒'), '热点：借势档位+风险前置+信号前置');
  const mx = MC.buildModeCraftDirective('mature_x', 'zh');
  assert.ok(mx.includes('暗示') && mx.includes('留白') && mx.includes('未成年人性化'), '成年向：暗示留白+零容忍红线');
  assert.ok(/implication/.test(MC.buildModeCraftDirective('mature_x', 'en')) && !cjk(MC.buildModeCraftDirective('mature_x', 'en')));
  const iv = MC.buildModeCraftDirective('interactive', 'zh');
  assert.ok(iv.includes('真选择') && iv.includes('闭环') && iv.includes('好/坏/隐藏结局'), '互动：真选择+分支闭环+多结局');
});

test('v2.87 电影剧本模式方法论：片段序列+字数闸门兼容，中英双份不再保留旧长场口径', () => {
  const zh = MC.buildModeCraftDirective('film', 'zh');
  assert.ok(zh.includes('三幕结构'), '电影：三幕结构');
  assert.ok(zh.includes('片段序列'), '电影：片段序列推进');
  assert.ok(zh.includes('激励事件'), '电影：激励事件');
  assert.ok(zh.includes('中点反转'), '电影：中点反转');
  assert.ok(zh.includes('契诃夫之枪'), '电影：契诃夫之枪');
  assert.ok(zh.includes('潜台词'), '电影：潜台词');
  assert.ok(zh.includes('可拍摄的'), '电影：可拍摄描写');
  assert.ok(zh.includes('弧光'), '电影：人物弧光');
  assert.ok(zh.includes('字数闸门'), '电影：片段严守每集字数闸门');
  assert.ok(!zh.includes('4000-6000'), '电影：旧“单场4000-6000字”口径已废弃（与闸门冲突）');
  const en = MC.buildModeCraftDirective('film', 'en');
  assert.ok(/three-act/i.test(en), 'film: three-act');
  assert.ok(/FRAGMENT SEQUENCE/i.test(en), 'film: fragment-sequence generation');
  assert.ok(/Chekhov/i.test(en), 'film: Chekhov');
  assert.ok(/subtext/i.test(en), 'film: subtext');
  assert.ok(/filmable/i.test(en), 'film: filmable');
  assert.ok(!/4000-6000/.test(en), 'film EN: stale 4000-6000 wording removed');
  assert.ok(!cjk(en), 'film 英文链路零中文');
});

test('v2.87 电影三幕片段定位：幕次/段落按片段序号确定性推导，非film/短片/越界返回空串', () => {
  // 非 film 模式与缺省一律空串
  assert.strictEqual(MC.buildFilmActDirective('tag', 0, 48, 'zh'), '');
  assert.strictEqual(MC.buildFilmActDirective(undefined, 0, 48, 'zh'), '');
  // 片段总数 <8 或序号越界不注入（短片不分幕、脏数据不放行）
  assert.strictEqual(MC.buildFilmActDirective('film', 0, 7, 'zh'), '');
  assert.strictEqual(MC.buildFilmActDirective('film', 48, 48, 'zh'), '');
  assert.strictEqual(MC.buildFilmActDirective('film', -1, 48, 'zh'), '');
  assert.strictEqual(MC.buildFilmActDirective('film', NaN, NaN, 'zh'), '');
  // 48 片段长片：开场/激励/中点/灵魂黑夜/高潮/闭环各就各位
  const zh0 = MC.buildFilmActDirective('film', 0, 48, 'zh');
  assert.ok(zh0.includes('片段 1/48') && zh0.includes('第一幕') && zh0.includes('开场段'), '片段1=第一幕开场段');
  const zhInc = MC.buildFilmActDirective('film', 7, 48, 'zh');
  assert.ok(zhInc.includes('激励事件段') && zhInc.includes('第一幕'), '片段8=激励事件段');
  const zhMid = MC.buildFilmActDirective('film', 23, 48, 'zh');
  assert.ok(zhMid.includes('中点反转段') && zhMid.includes('第二幕'), '片段24=第二幕中点反转');
  const zhDark = MC.buildFilmActDirective('film', 33, 48, 'zh');
  assert.ok(zhDark.includes('灵魂黑夜段') && zhDark.includes('第二幕'), '片段34=灵魂黑夜');
  const zhClimax = MC.buildFilmActDirective('film', 38, 48, 'zh');
  assert.ok(zhClimax.includes('高潮决战段') && zhClimax.includes('第三幕'), '片段39=第三幕高潮');
  const zhFin = MC.buildFilmActDirective('film', 47, 48, 'zh');
  assert.ok(zhFin.includes('闭环终段') && zhFin.includes('第三幕'), '片段48=闭环终段');
  // 同参同果（确定性）
  assert.strictEqual(zhMid, MC.buildFilmActDirective('film', 23, 48, 'zh'));
  // 英文链路零中文、含幕次与段落语义
  const enMid = MC.buildFilmActDirective('film', 23, 48, 'en');
  assert.ok(/FRAGMENT ACT POSITION/.test(enMid) && /Act 2/.test(enMid) && /midpoint/i.test(enMid));
  assert.ok(!cjk(enMid), 'film act 英文链路零中文');
});

test('v2.83 模式方法论为纯函数：同参同果、默认中文', () => {
  assert.strictEqual(MC.buildModeCraftDirective('tag'), MC.buildModeCraftDirective('tag', 'zh'), '默认中文');
  assert.strictEqual(MC.buildModeCraftDirective('novel', 'en'), MC.buildModeCraftDirective('novel', 'en'), '确定性');
});
