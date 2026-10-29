/**
 * v2.355 AIGC 稿式外观槽（look slot）—— 逐镜视觉连贯的登记台账
 * 缺口：MachineShot 只有 size/move/light/visual/lines/audio/inner，没有「角色外观」槽；
 *       下游逐镜生图/生视频时同一角色形象无台账可查，镜头间连贯检测（候选池 D）无据可依。
 * 本组用例：parser 外观括号分流 → manifest 挂载 → resolveLooksByShot 继承/换装 → 生成侧指令教学 → 样稿示范。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAigcEpisode,
  buildShotManifest,
  resolveLooksByShot,
  aigcScreenplayDirective,
} = require('../dist/engine/aigc-screenplay');
const { buildSampleScript } = require('../dist/engine/sample-script');

// ---------- 1. 中文：场首外观槽解析（pending 路径的前置：parse 层先出 look 块） ----------
test('zh: 场首（外观：…）解析为 look 块，叙述无括号残留', () => {
  const text = [
    '第1集 离婚当天继承千亿',
    '',
    '内景 出租屋·夜',
    '（外观：林晚=洗得发白的素色毛衣和旧牛仔裤，长发松松挽在脑后）冷白灯管滋滋作响，她蹲在地上把衬衫叠进纸箱。',
  ].join('\n');
  const p = parseAigcEpisode(text);
  const looks = p.scenes[0].blocks.filter((b) => b.type === 'look');
  assert.equal(looks.length, 1);
  assert.equal(looks[0].speaker, '林晚');
  assert.equal(looks[0].text, '洗得发白的素色毛衣和旧牛仔裤，长发松松挽在脑后');
  const narr = p.scenes[0].blocks.find((b) => b.type === 'narrate');
  assert.ok(narr && !narr.text.includes('外观'), `叙述块残留外观括号: ${narr && narr.text}`);
  assert.ok(narr.text.includes('冷白灯管'), '叙述正文应保留');
});

// ---------- 2. 中文：多角色分号分隔 + 与内心/音效混排各归各类 ----------
test('zh: 多角色（外观：A=…；B=…）拆成多条，且与（内心：）（音效：）混排各归各类', () => {
  const text = [
    '内景 出租屋·夜',
    '门被踹开，两人走进来。（外观：陈凯=崭亮皮夹克，头发抹了发胶；女人=酒红色紧身裙，卷发披散）（音效：皮鞋声由远及近。）（内心：她还是没忍住手一抖。）她没回头。',
  ].join('\n');
  const blocks = parseAigcEpisode(text).scenes[0].blocks;
  const looks = blocks.filter((b) => b.type === 'look');
  assert.equal(looks.length, 2);
  assert.deepEqual(looks.map((l) => l.speaker), ['陈凯', '女人']);
  assert.equal(looks[1].text, '酒红色紧身裙，卷发披散');
  assert.equal(blocks.filter((b) => b.type === 'sfx').length, 1);
  assert.equal(blocks.filter((b) => b.type === 'inner').length, 1);
  const narr = blocks.filter((b) => b.type === 'narrate').map((b) => b.text).join('');
  assert.ok(!narr.includes('外观') && !narr.includes('音效') && !narr.includes('内心'), `叙述残留括号语义: ${narr}`);
});

// ---------- 3. 英文：(LOOK: …) 解析 ----------
test('en: (LOOK: Name=look; Name2=look2) parses into look blocks', () => {
  const text = [
    'EP1 The Board Seat',
    '',
    'INT. RENTAL ROOM - NIGHT',
    '(LOOK: Lin Wan=faded beige cardigan, hair loosely pinned; Chen Kai=glossy leather jacket) The cold-white lamp buzzes as she folds shirts into a box.',
  ].join('\n');
  const p = parseAigcEpisode(text);
  const looks = p.scenes[0].blocks.filter((b) => b.type === 'look');
  assert.equal(looks.length, 2);
  assert.deepEqual(looks.map((l) => l.speaker), ['Lin Wan', 'Chen Kai']);
  assert.equal(looks[0].text, 'faded beige cardigan, hair loosely pinned');
  const narr = p.scenes[0].blocks.find((b) => b.type === 'narrate');
  assert.ok(narr && !/LOOK/i.test(narr.text) && narr.text.includes('cold-white lamp'));
});

// ---------- 4. 英文：(WARDROBE: …) 同认 ----------
test('en: (WARDROBE: …) is accepted as the same slot', () => {
  const text = [
    'INT. GALA HALL - NIGHT',
    'Crystal light glares. (WARDROBE: Lin Wan=wine-red gown, hair in an updo) She raises her glass.',
  ].join('\n');
  const looks = parseAigcEpisode(text).scenes[0].blocks.filter((b) => b.type === 'look');
  assert.equal(looks.length, 1);
  assert.equal(looks[0].speaker, 'Lin Wan');
  assert.equal(looks[0].text, 'wine-red gown, hair in an updo');
});

// ---------- 5. 容错：空描述 / 空名 / 无等号段全部跳过 ----------
test('容错：外观槽内空段、空名、空描述一律跳过不登记', () => {
  const text = [
    '内景 出租屋·夜',
    '（外观：林晚=；；=多余段；这段没等号）灯亮着。（外观：林晚=素色毛衣）她坐下。',
  ].join('\n');
  const looks = parseAigcEpisode(text).scenes[0].blocks.filter((b) => b.type === 'look');
  assert.equal(looks.length, 1);
  assert.equal(looks[0].speaker, '林晚');
  assert.equal(looks[0].text, '素色毛衣');
});

// ---------- 6. manifest：场首 look（叙述前）并入下一个有画面的镜头 ----------
test('manifest: 场首外观登记（叙述之前）并入本镜头，lines/audio 同款 pending 语义', () => {
  const text = [
    '内景 出租屋·夜',
    '（外观：林晚=素色旧毛衣）冷白灯管滋滋作响，她蹲在地上叠衬衫，指尖把每道折痕压平。林晚（很轻）：我走了。',
  ].join('\n');
  const m = buildShotManifest(text);
  assert.equal(m.shots.length >= 1, true);
  const sh = m.shots[0];
  assert.deepEqual(sh.looks, [{ name: '林晚', look: '素色旧毛衣' }]);
  assert.equal(sh.lines.length, 1);
});

// ---------- 7. manifest：场中 look 归当前镜头；旧稿无槽时 looks 恒为空数组 ----------
test('manifest: 场中外观登记归当前镜头；无槽旧稿每镜 looks 为空数组', () => {
  const text = [
    '内景 出租屋·夜',
    '冷白灯管滋滋作响，她蹲在地上叠衬衫。（外观：林晚=素色旧毛衣）门突然被踹开。',
    '内景 楼道·夜',
    '声控灯一明一灭，她拖着箱子往下挪。',
  ].join('\n');
  const m = buildShotManifest(text);
  const s1 = m.shots.find((s) => s.scene === 1);
  assert.deepEqual(s1.looks, [{ name: '林晚', look: '素色旧毛衣' }]);
  const s2 = m.shots.find((s) => s.scene === 2);
  assert.deepEqual(s2.looks, []);
  // 纯无槽旧稿
  const legacy = buildShotManifest(['内景 楼道·夜', '声控灯一明一灭，她拖着箱子往下挪，影子被拉得很长。'].join('\n'));
  assert.ok(legacy.shots.every((s) => Array.isArray(s.looks) && s.looks.length === 0));
});

// ---------- 8. resolveLooksByShot：登记 → 跨镜继承 → 换装覆盖 ----------
test('resolveLooksByShot: 登记后整集继承，换装登记当场覆盖', () => {
  const text = [
    '内景 出租屋·夜',
    '（外观：林晚=素色旧毛衣）冷白灯管滋滋作响，她蹲在地上叠衬衫，指尖把每道折痕压平，再把箱子合上。',
    '门被踹开，走廊暖光切进来，在地上拖出两道人影，皮鞋声由远及近。',
    '内景 酒店宴会厅·夜',
    '（外观：林晚=酒红色高定礼服，盘发）水晶灯亮得晃眼，她举杯向全场致意，嘴角带笑。',
    '掌声响起，她把酒杯轻轻放回托盘，转身走向露台。',
  ].join('\n');
  const m = buildShotManifest(text);
  const timeline = resolveLooksByShot(m.shots);
  assert.equal(timeline.length, m.shots.length);
  assert.equal(timeline[0]['林晚'], '素色旧毛衣');
  assert.equal(timeline[1]['林晚'], '素色旧毛衣'); // 第二镜无登记 → 继承
  assert.equal(timeline[2]['林晚'], '酒红色高定礼服，盘发'); // 换装覆盖
  assert.equal(timeline[3]['林晚'], '酒红色高定礼服，盘发'); // 跨镜继承新装
});

// ---------- 9. resolveLooksByShot：空清单 → 空数组 ----------
test('resolveLooksByShot: 空 shot 清单返回空数组', () => {
  assert.deepEqual(resolveLooksByShot([]), []);
});

// ---------- 9.5 口径守卫：外观登记计入总量但不占发声分子（v2.355 回归坐实的 else 兜底缺口） ----------
test('口径: analyzeAigcComposition 外观槽计入 lookCjk/总量，不推高 spokenRatio', () => {
  const { analyzeAigcComposition } = require('../dist/engine/aigc-screenplay');
  const base = [
    '内景 出租屋·夜',
    '冷白灯管滋滋作响，她蹲在地上把衬衫一件件叠进纸箱，指尖把每道折痕压平。林晚（很轻）：我走了。',
  ].join('\n');
  const withLook = [
    '内景 出租屋·夜',
    '（外观：林晚=洗得发白的素色毛衣和旧牛仔裤，长发松松挽在脑后）冷白灯管滋滋作响，她蹲在地上把衬衫一件件叠进纸箱，指尖把每道折痕压平。林晚（很轻）：我走了。',
  ].join('\n');
  const a = analyzeAigcComposition(base);
  const b = analyzeAigcComposition(withLook);
  assert.equal(a.spokenCjk, b.spokenCjk, '外观槽不得计入发声字数');
  assert.ok(b.lookCjk > 0, '外观字数应单列');
  assert.equal(b.totalCjk - a.totalCjk, b.lookCjk, '总量增量恒等于外观字数');
  assert.ok(b.spokenRatio <= a.spokenRatio, '外观槽只应摊薄发声占比');
});

// ---------- 10. 生成侧指令：中文版教外观槽写法与继承/换装纪律 ----------
test('directive: 中文版含外观槽规则（写法、继承、换装重新登记）', () => {
  const d = aigcScreenplayDirective('zh');
  assert.ok(d.includes('（外观：'), '中文指令未教（外观：…）写法');
  assert.ok(/继承|沿用/.test(d), '中文指令未讲继承语义');
  assert.ok(/换装|重新登记/.test(d), '中文指令未讲换装重新登记');
});

// ---------- 11. 生成侧指令：英文版同教 ----------
test('directive: English edition teaches (LOOK: …) with persist / re-register rules', () => {
  const d = aigcScreenplayDirective('en');
  assert.ok(d.includes('(LOOK:'), 'EN directive missing (LOOK: …) syntax');
  assert.ok(/persist|inherit/i.test(d), 'EN directive missing persistence semantics');
  assert.ok(/re-register|costume change/i.test(d), 'EN directive missing re-register rule');
});

// ---------- 12. 中文样稿：外观槽示范四角色登记 ----------
test('样稿 zh: AIGC 沙盘样稿登记林晚/陈凯/女人/管家外观', () => {
  const p = parseAigcEpisode(buildSampleScript('AIGC', 'zh'));
  const names = new Set(p.scenes.flatMap((s) => s.blocks.filter((b) => b.type === 'look').map((b) => b.speaker)));
  for (const n of ['林晚', '陈凯', '女人', '管家']) assert.ok(names.has(n), `样稿缺少 ${n} 的外观登记`);
});

// ---------- 13. 英文样稿：同标准登记 ----------
test('样稿 en: sandbox sample registers Lin Wan / Chen Kai / Lily / Butler', () => {
  const p = parseAigcEpisode(buildSampleScript('AIGC', 'en'));
  const names = new Set(p.scenes.flatMap((s) => s.blocks.filter((b) => b.type === 'look').map((b) => b.speaker)));
  for (const n of ['Lin Wan', 'Chen Kai', 'Lily', 'Butler']) assert.ok(names.has(n), `sample missing look for ${n}`);
});
