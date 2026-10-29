/**
 * v2.357 跨集外观传承测试
 * 盲区：continuityBrief 五维（secret/revealed/state/foreshadow/arc）无 look——
 * 本集登记的外观槽下一集无人记得，换装/造型演进跨集断裂。
 * 覆盖：extractFinalLooks 终态归并/名归一/门控 + continuityBrief look 维度
 *       （条目生成/CAP/双语零中文/与既有五维并存/回归不破坏）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { extractFinalLooks } = require('../dist/engine/aigc-screenplay.js');
const { continuityBrief } = require('../dist/engine/continuity-brief.js');

// ---------- fixtures ----------
const ZH_EP = `《测试》第1集
内景 林晚公寓·夜
雨点敲窗。林晚站在窗边。
（外观：林晚=米色针织衫，头发松松挽起）
林晚（低声）：他真的会来吗。
外景 天台·夜
风很大。林晚裹紧外套。
（外观：林晚=黑色风衣，头发散开；陈凯=灰色西装）
陈凯：你来了。
`;
const EN_EP = `EP 1
INT. LIN WAN'S APARTMENT - NIGHT
Rain hits the window. Lin Wan stands by it.
(LOOK: Lin Wan=beige knit sweater, hair loosely pinned)
Lin Wan (whispering): Will he really come.
EXT. ROOFTOP - NIGHT
Wind howls.
(LOOK: Lin Wan=black trench coat, hair down; Chen Kai=grey suit)
Chen Kai: You came.
`;
const LIVE_EP = `第一集
【1-1】夜 内 林晚公寓
△雨点敲窗。
林晚：（低声）他真的会来吗。
`;

// ---------- extractFinalLooks ----------
test('zh：多场登记按名归并取终态（换装覆盖）', () => {
  const looks = extractFinalLooks(ZH_EP);
  const lw = looks.find((l) => l.name === '林晚');
  const ck = looks.find((l) => l.name === '陈凯');
  assert.ok(lw, '林晚应被提取');
  assert.strictEqual(lw.look, '黑色风衣，头发散开'); // 场3 换装覆盖场1
  assert.ok(ck && ck.look.includes('灰色西装'), '陈凯场3 登记应提取');
});

test('en：(LOOK:) 同认 + 名归一（大小写同人覆盖取终态）', () => {
  const mixed = EN_EP.replace('(LOOK: Lin Wan=black trench coat, hair down;', '(LOOK: lin wan=black trench coat, hair down;');
  const looks = extractFinalLooks(mixed);
  const lw = looks.filter((l) => l.name.toLowerCase() === 'lin wan');
  assert.strictEqual(lw.length, 1, '大小写变体应归并为一人');
  assert.strictEqual(lw[0].look, 'black trench coat, hair down');
});

test('空稿 → 空数组', () => {
  assert.deepStrictEqual(extractFinalLooks(''), []);
  assert.deepStrictEqual(extractFinalLooks(null), []);
});

test('真人稿（无外观槽）→ 空数组（天然门控，无需 format 判参）', () => {
  assert.deepStrictEqual(extractFinalLooks(LIVE_EP), []);
});

test('zh 单段多角色分号 → 全部提取', () => {
  const looks = extractFinalLooks(ZH_EP);
  assert.strictEqual(looks.length, 2);
});

// ---------- continuityBrief look 维度 ----------
test('prevLooks 缺省/空数组 → 无 look 条目（五维回归不破坏）', () => {
  const a = continuityBrief({});
  const b = continuityBrief({ prevLooks: [] });
  assert.ok(!a.items.some((i) => i.kind === 'look'));
  assert.ok(!b.items.some((i) => i.kind === 'look'));
  assert.strictEqual(b.directiveZh, '');
});

test('1 角色 → kind=look / priority=mid，zh 含角色名与描述', () => {
  const r = continuityBrief({ prevLooks: [{ name: '林晚', look: '黑色风衣' }] });
  const it = r.items.find((i) => i.kind === 'look');
  assert.ok(it, '应生成 look 条目');
  assert.strictEqual(it.priority, 'mid');
  assert.ok(it.zh.includes('林晚') && it.zh.includes('黑色风衣'));
  assert.ok(it.zh.includes('换装'), '应含换装重登指令');
});

test('5 角色 → 单条汇总 CAP 4 + 等 N 人', () => {
  const prevLooks = [
    { name: '林晚', look: '风衣' }, { name: '陈凯', look: '西装' },
    { name: '王丽', look: '裙装' }, { name: '管家', look: '马甲' },
    { name: '周导', look: '夹克' },
  ];
  const r = continuityBrief({ prevLooks });
  const looks = r.items.filter((i) => i.kind === 'look');
  assert.strictEqual(looks.length, 1, '外观传承单条汇总，不逐角色刷条');
  assert.ok(looks[0].zh.includes('林晚') && looks[0].zh.includes('管家'));
  assert.ok(!looks[0].zh.includes('周导'), '第 5 人截断');
  assert.ok(looks[0].zh.includes('等'), '应含等 N 人提示');
});

test('en：look 条目与 directiveEn 零中文', () => {
  const r = continuityBrief({ prevLooks: [{ name: 'Lin Wan', look: 'black trench coat' }] });
  const it = r.items.find((i) => i.kind === 'look');
  assert.ok(it);
  assert.ok(!/[一-鿿]/.test(it.en), 'item.en 零中文');
  assert.ok(!/[一-鿿]/.test(r.directiveEn), 'directiveEn 零中文');
  assert.ok(it.en.includes('Lin Wan') && it.en.includes('black trench coat'));
});

test('directiveZh 简报块含外观条目（拼进【跨集连续性简报】）', () => {
  const r = continuityBrief({ prevLooks: [{ name: '林晚', look: '黑色风衣' }] });
  assert.ok(r.directiveZh.includes('跨集连续性简报'));
  assert.ok(r.directiveZh.includes('林晚'));
});

test('与既有五维并存：secret + look 同传，两类条目都在', () => {
  const r = continuityBrief({
    prevSecrets: { plants: [{ topic: '身世', plantedInEp: 1, snippet: 'a' }], revealedTopics: [], epNo: 1 },
    prevLooks: [{ name: '林晚', look: '黑色风衣' }],
  });
  assert.ok(r.items.some((i) => i.kind === 'secret'));
  assert.ok(r.items.some((i) => i.kind === 'look'));
});

test('prevEnding 回归：endingBlock 不受 look 维度影响', () => {
  const r = continuityBrief({ prevEnding: '她回头一笑。', prevLooks: [{ name: '林晚', look: '风衣' }] });
  assert.ok(r.endingBlockZh.includes('她回头一笑'));
  assert.ok(r.items.some((i) => i.kind === 'look'));
});
