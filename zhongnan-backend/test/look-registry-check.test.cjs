/**
 * v2.356 AIGC 镜头间视觉连贯（候选池 D）—— 外观登记台账检测 look-registry-check
 * 缺口：v2.355 给稿式引入外观槽（MachineShot.looks + resolveLooksByShot），但全引擎体系
 *       无人判定「该登记的角色有没有登记、登记有没有矛盾」——主角全程零登记，生图/视频
 *       模型跨镜无据；同场重复登记不同描述必为笔误；登记晚于首次出场，前面镜头裸奔。
 * 本组用例：覆盖判定（主角/配角漏登记）、迟到登记、同场冲突、换装合法、旁白/群体豁免、
 *           制式门控（LIVE 放行）、双语、归一、score clamp、结构字段。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { lookRegistryCheck } = require('../dist/engine/look-registry-check');

// ---------- 共享夹具 ----------
// 健康中文稿：林晚 3 句+场首登记；周导 2 句+场首登记
const HEALTHY_ZH = [
  '第1集 试镜风波',
  '',
  '内景 试镜间·日',
  '（外观：林晚=洗白的米色风衣，长发挽起；周导=深色polo衫，手里转着笔）灯光明亮，长桌后坐着三个人。',
  '林晚（平静）：各位老师好，我是林晚。',
  '周导（翻资料）：开始吧。',
  '林晚：这场戏我准备了一个月。',
  '周导：别紧张。',
  '林晚：我不紧张，我只是不想输。',
].join('\n');

// 主角零登记：林晚 3 句台词全程无外观登记
const MISSING_LEAD_ZH = [
  '内景 试镜间·日',
  '（外观：周导=深色polo衫，手里转着笔）灯光明亮，长桌后坐着三个人。',
  '林晚（平静）：各位老师好，我是林晚。',
  '周导（翻资料）：开始吧。',
  '林晚：这场戏我准备了一个月。',
  '周导：别紧张。',
  '林晚：我不紧张，我只是不想输。',
].join('\n');

// 配角零登记：周导 2 句台词零登记（林晚已登记）
const MISSING_SUPPORT_ZH = [
  '内景 试镜间·日',
  '（外观：林晚=洗白的米色风衣，长发挽起）灯光明亮，长桌后坐着三个人。',
  '林晚（平静）：各位老师好，我是林晚。',
  '周导（翻资料）：开始吧。',
  '林晚：这场戏我准备了一个月。',
  '周导：别紧张。',
  '林晚：我不紧张，我只是不想输。',
].join('\n');

// 登记迟到：场1 已有台词，场2 才登记
const LATE_ZH = [
  '内景 试镜间·日',
  '灯光明亮，长桌后坐着三个人。',
  '林晚（平静）：各位老师好，我是林晚。',
  '周导（翻资料）：开始吧。',
  '',
  '内景 走廊·日',
  '（外观：林晚=洗白的米色风衣，长发挽起）她推门出来，长长吐了口气。',
  '林晚：终于结束了。',
].join('\n');

// 同场冲突：同一场内重复登记且描述不同
const CONFLICT_ZH = [
  '内景 试镜间·日',
  '（外观：林晚=洗白的米色风衣，长发挽起）灯光明亮。（外观：林晚=酒红色晚礼服，卷发披散）她走到中央。',
  '林晚（平静）：各位老师好，我是林晚。',
].join('\n');

// 换装合法：跨场登记不同描述（场1 风衣 → 场2 礼服），不算冲突
const CHANGE_OK_ZH = [
  '内景 试镜间·日',
  '（外观：林晚=洗白的米色风衣，长发挽起）灯光明亮。',
  '林晚（平静）：各位老师好。',
  '林晚：这场戏我准备了一个月。',
  '',
  '内景 晚宴厅·夜',
  '（外观：林晚=酒红色晚礼服，卷发披散）水晶灯刺眼，她举杯。',
  '林晚：这一杯，敬不服输的自己。',
].join('\n');

// 旁白豁免：旁白/解说零登记不报
const NARRATOR_ZH = [
  '内景 试镜间·日',
  '（外观：林晚=洗白的米色风衣，长发挽起）灯光明亮。',
  '旁白：这一天，她等了整整三年。',
  '解说：试镜的规则很简单。',
  '林晚（平静）：各位老师好。',
  '林晚：我不会输。',
  '林晚：请给我一个机会。',
].join('\n');

// 群体豁免：众人/大家零登记不报
const GROUP_ZH = [
  '内景 试镜间·日',
  '（外观：林晚=洗白的米色风衣，长发挽起）灯光明亮。',
  '众人（齐声）：好！',
  '大家：太棒了！',
  '林晚（鞠躬）：谢谢各位。',
  '林晚：我会继续努力的。',
  '林晚：谢谢。',
].join('\n');

// 健康英文稿：Lin Wan 3 句+登记；Director Zhao 2 句+登记
const HEALTHY_EN = [
  'EP1 The Audition',
  '',
  'INT. AUDITION ROOM - DAY',
  '(LOOK: Lin Wan=faded beige coat, hair pinned up; Director Zhao=dark polo shirt, twirling a pen) Bright lights over a long table, three judges seated behind it.',
  'Lin Wan (calm): Good morning, everyone. I am Lin Wan.',
  'Director Zhao (flipping pages): Begin when ready.',
  'Lin Wan: I prepared this scene for a month.',
  'Director Zhao: Do not be nervous.',
  'Lin Wan: I am not nervous. I just refuse to lose.',
].join('\n');

// 英文主角零登记
const MISSING_LEAD_EN = [
  'INT. AUDITION ROOM - DAY',
  '(LOOK: Director Zhao=dark polo shirt, twirling a pen) Bright lights over a long table.',
  'Lin Wan (calm): Good morning, everyone. I am Lin Wan.',
  'Director Zhao (flipping pages): Begin when ready.',
  'Lin Wan: I prepared this scene for a month.',
  'Director Zhao: Do not be nervous.',
  'Lin Wan: I am not nervous. I just refuse to lose.',
].join('\n');

// 英文配角零登记
const MISSING_SUPPORT_EN = [
  'INT. AUDITION ROOM - DAY',
  '(LOOK: Lin Wan=faded beige coat, hair pinned up) Bright lights over a long table.',
  'Lin Wan (calm): Good morning, everyone.',
  'Director Zhao (flipping pages): Begin when ready.',
  'Lin Wan: I prepared this scene for a month.',
  'Director Zhao: Do not be nervous.',
  'Lin Wan: I just refuse to lose.',
].join('\n');

// ---------- 1. zh 健康稿：满分无 issue ----------
test('zh: 全角色已登记的健康稿满分无 issue', () => {
  const r = lookRegistryCheck(HEALTHY_ZH, 'AIGC', 'zh');
  assert.equal(r.checked, true);
  assert.equal(r.score, 100);
  assert.equal(r.issues.length, 0);
  assert.equal(r.speakers, 2);
  assert.equal(r.registered, 2);
});

// ---------- 2. zh 主角零登记 → high ----------
test('zh: 主角（≥3 句台词）零登记报 look_missing_lead high 扣 22', () => {
  const r = lookRegistryCheck(MISSING_LEAD_ZH, 'AIGC', 'zh');
  assert.equal(r.score, 78);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].type, 'look_missing_lead');
  assert.equal(r.issues[0].severity, 'high');
  assert.ok(r.issues[0].evidence.includes('林晚') && r.issues[0].evidence.includes('3'));
});

// ---------- 3. zh 配角零登记 → mid ----------
test('zh: 配角（1-2 句台词）零登记报 look_missing_support mid 扣 10', () => {
  const r = lookRegistryCheck(MISSING_SUPPORT_ZH, 'AIGC', 'zh');
  assert.equal(r.score, 90);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].type, 'look_missing_support');
  assert.equal(r.issues[0].severity, 'mid');
  assert.ok(r.issues[0].evidence.includes('周导'));
});

// ---------- 4. zh 登记迟到 → mid ----------
test('zh: 登记场晚于首次台词场报 look_late_register mid', () => {
  const r = lookRegistryCheck(LATE_ZH, 'AIGC', 'zh');
  const late = r.issues.filter((i) => i.type === 'look_late_register');
  assert.equal(late.length, 1);
  assert.equal(late[0].severity, 'mid');
  assert.ok(late[0].evidence.includes('林晚'));
  // 周导 2 句零登记也应报 missing_support
  assert.ok(r.issues.some((i) => i.type === 'look_missing_support'));
});

// ---------- 5. zh 同场冲突 → mid ----------
test('zh: 同场同角色重复登记不同描述报 look_conflict_scene mid', () => {
  const r = lookRegistryCheck(CONFLICT_ZH, 'AIGC', 'zh');
  const c = r.issues.filter((i) => i.type === 'look_conflict_scene');
  assert.equal(c.length, 1);
  assert.equal(c[0].severity, 'mid');
  assert.ok(c[0].evidence.includes('林晚'));
});

// ---------- 6. zh 跨场换装合法不报冲突 ----------
test('zh: 跨场登记不同描述属合法换装，不报 look_conflict_scene', () => {
  const r = lookRegistryCheck(CHANGE_OK_ZH, 'AIGC', 'zh');
  assert.equal(r.issues.filter((i) => i.type === 'look_conflict_scene').length, 0);
  assert.equal(r.score, 100);
});

// ---------- 7. zh 旁白豁免 ----------
test('zh: 旁白/解说零登记不报（豁免）', () => {
  const r = lookRegistryCheck(NARRATOR_ZH, 'AIGC', 'zh');
  assert.equal(r.issues.length, 0);
  assert.equal(r.speakers, 1);
});

// ---------- 8. zh 群体豁免 ----------
test('zh: 众人/大家群体标签零登记不报（豁免）', () => {
  const r = lookRegistryCheck(GROUP_ZH, 'AIGC', 'zh');
  assert.equal(r.issues.length, 0);
  assert.equal(r.speakers, 1);
});

// ---------- 9. 短稿/空稿放行 ----------
test('空稿与短稿 checked=false 满分放行', () => {
  for (const t of ['', '   ', '只有一点点字']) {
    const r = lookRegistryCheck(t, 'AIGC', 'zh');
    assert.equal(r.checked, false);
    assert.equal(r.score, 100);
    assert.equal(r.issues.length, 0);
  }
});

// ---------- 10. LIVE 制式放行 ----------
test('LIVE 真人稿无外观槽机制，checked=false 满分放行', () => {
  const r = lookRegistryCheck(HEALTHY_ZH, 'LIVE', 'zh');
  assert.equal(r.checked, false);
  assert.equal(r.score, 100);
  assert.equal(r.issues.length, 0);
});

// ---------- 11. en 健康稿满分 ----------
test('en: fully registered healthy script scores 100 with no issues', () => {
  const r = lookRegistryCheck(HEALTHY_EN, 'AIGC', 'en');
  assert.equal(r.checked, true);
  assert.equal(r.score, 100);
  assert.equal(r.issues.length, 0);
  assert.equal(r.speakers, 2);
  assert.equal(r.registered, 2);
});

// ---------- 12. en 主角零登记 high 且零中文 ----------
test('en: lead with 3+ lines but no registry -> look_missing_lead high, zero Chinese in output', () => {
  const r = lookRegistryCheck(MISSING_LEAD_EN, 'AIGC', 'en');
  assert.equal(r.score, 78);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].type, 'look_missing_lead');
  assert.equal(r.issues[0].severity, 'high');
  const all = r.issues.map((i) => `${i.message}${i.advice}${i.evidence}`).join('');
  assert.ok(!/[一-鿿]/.test(all), `英文链路 evidence/advice 必须零中文: ${all}`);
});

// ---------- 13. en 配角零登记 mid ----------
test('en: supporting role (1-2 lines) without registry -> look_missing_support mid', () => {
  const r = lookRegistryCheck(MISSING_SUPPORT_EN, 'AIGC', 'en');
  assert.equal(r.score, 90);
  assert.equal(r.issues[0].type, 'look_missing_support');
  assert.equal(r.issues[0].severity, 'mid');
  assert.ok(r.issues[0].evidence.includes('Director Zhao'));
});

// ---------- 14. en 大小写归一 ----------
test('en: registry name case-insensitive (LOOK: lin wan vs dialogue Lin Wan)', () => {
  const text = [
    'INT. AUDITION ROOM - DAY',
    '(LOOK: lin wan=faded beige coat, hair pinned up) Bright lights over a long table.',
    'Lin Wan (calm): Good morning, everyone.',
    'Lin Wan: I prepared this scene for a month.',
    'Lin Wan: I just refuse to lose.',
  ].join('\n');
  const r = lookRegistryCheck(text, 'AIGC', 'en');
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
});

// ---------- 15. score clamp：多名主角全漏不跌破 0 ----------
test('score 恒在 0-100：五名主角全漏登记 clamp 到 0', () => {
  const lines = ['内景 大殿·日', '（外观：皇帝=明黄龙袍）灯火通明。'];
  const names = ['太子', '将军', '丞相', '公主', '太监'];
  for (const n of names) {
    for (let i = 0; i < 3; i++) lines.push(`${n}：台词${i}。`);
  }
  const r = lookRegistryCheck(lines.join('\n'), 'AIGC', 'zh');
  assert.equal(r.score, 0);
  assert.ok(r.issues.filter((i) => i.type === 'look_missing_lead').length >= 5);
  assert.ok(r.score >= 0 && r.score <= 100);
});

// ---------- 16. 结构字段齐全 ----------
test('结果结构字段齐全（checked/score/speakers/registered/issues.type/severity/message/advice/evidence）', () => {
  const r = lookRegistryCheck(MISSING_LEAD_ZH, 'AIGC', 'zh');
  for (const k of ['checked', 'score', 'speakers', 'registered', 'issues']) assert.ok(k in r, `缺字段 ${k}`);
  const i = r.issues[0];
  for (const k of ['type', 'severity', 'message', 'advice', 'evidence']) assert.ok(k in i, `issue 缺字段 ${k}`);
  assert.ok(i.message.length > 0 && i.advice.length > 0 && i.evidence.length > 0);
});
