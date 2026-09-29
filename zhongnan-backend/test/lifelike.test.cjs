const test = require('node:test');
const assert = require('node:assert');
const L = require('../dist/engine/lifelike.js');

test('场景细节包具体、反悬浮', () => {
  const d = L.lifeDetailDirective('场景：深夜出租屋');
  assert.ok(d.includes('出租屋') && (d.includes('空调') || d.includes('小板凳') || d.includes('不锈钢')));
  assert.ok(d.includes('不许') || d.includes('1-2'), '强调克制不堆砌');
});

test('无关场景给通用克制提示', () => {
  const d = L.lifeDetailDirective('火星基地');
  assert.ok(d.includes('细节'));
});

test('抽象空洞叙述被抓，具体动作行加分', () => {
  const bad = L.groundedScan('他十分生气，气氛尴尬，内心五味杂陈。');
  assert.ok(bad.abstractHits.length >= 2);
  assert.ok(bad.suggestions.length >= 1);
  const good = L.groundedScan('△ 他没说话，把缴费单揉成一团塞进兜里。\n△ 指节捏得发白。');
  assert.ok(good.groundedScore > bad.groundedScore);
});

test('v2.00 英文细节指令零中文、按英文场景词命中，中文默认逐字不变', () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const generic = L.lifeDetailDirective('on a mars base', 'en');
  assert.ok(!cjk(generic), '英文通用指令零中文');
  const office = L.lifeDetailDirective('Alone in the office cubicle, she froze.', 'en');
  assert.ok(!cjk(office) && /setting|sticky|printer/i.test(office), '英文办公室场景命中细节库');
  const kitchen = L.lifeDetailDirective('At the stove, cooking dinner', 'en');
  assert.ok(!cjk(kitchen) && /wok|oil|kettle/i.test(kitchen), '英文厨房场景命中');
  const zh = L.lifeDetailDirective('在出租屋');
  assert.strictEqual(L.lifeDetailDirective('在出租屋', 'zh'), zh, '中文默认逐字不变');
  assert.ok(zh.includes('出租屋'));
});

test('v2.91 中文扩充场景命中：教室/宿舍/工地/网吧/健身房/地铁/公园/商场/美容院/KTV/银行/法庭/寺庙/老宅/弄堂/高铁', () => {
  const cases = [
    { scene: '教室里只剩他和她', key: '教室', hit: '黑板' },
    { scene: '宿舍熄灯后她还在刷剧', key: '宿舍', hit: '上铺' },
    { scene: '工地上风沙大得睁不开眼', key: '工地', hit: '安全帽' },
    { scene: '网吧里全是烟味', key: '网吧', hit: '键盘' },
    { scene: '健身房镜子里映出他的疲惫', key: '健身房', hit: '哑铃' },
    { scene: '地铁到站提示音响起', key: '地铁', hit: '扶手' },
    { scene: '公园长椅上她等了一个钟头', key: '公园', hit: '长椅' },
    { scene: '商场里冷气开得足', key: '商场', hit: '试衣' },
    { scene: '美容院里吹风机一直响', key: '美容院', hit: '镜前' },
    { scene: 'KTV包厢里没人唱歌', key: 'KTV', hit: '话筒' },
    { scene: '银行叫号到她了', key: '银行', hit: '取号' },
    { scene: '法庭上所有人起立', key: '法庭', hit: '法槌' },
    { scene: '寺庙里香火味很浓', key: '寺庙', hit: '香炉' },
    { scene: '老宅堂屋挂着旧照片', key: '老宅', hit: '八仙桌' },
    { scene: '弄堂口晾着衣服', key: '弄堂', hit: '晾衣' },
    { scene: '高铁窗外田野飞过', key: '高铁', hit: '行李架' },
  ];
  for (const c of cases) {
    const d = L.lifeDetailDirective(c.scene);
    assert.ok(d.includes(c.key), `场景「${c.scene}」应命中${c.key}词条`);
    assert.ok(d.includes(c.hit), `场景「${c.scene}」指令中应包含「${c.hit}」相关细节`);
  }
});

test('v2.91 英文扩充场景命中：classroom/dorm/construction/internetcafe/gym/subway/park/mall/salon/ktv/bank/court/temple/oldhouse/alley/highspeed', () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const cases = [
    { scene: 'Empty classroom after school', hit: 'chalk' },
    { scene: 'Bunk bed in the dorm', hit: 'bunk' },
    { scene: 'At the construction site', hit: 'scaffold' },
    { scene: 'Smoke in the internet cafe', hit: 'cigarette' },
    { scene: 'In the gym mirror', hit: 'dumbbell' },
    { scene: 'Riding the subway home', hit: 'pole' },
    { scene: 'On a park bench', hit: 'bench' },
    { scene: 'At the mall fitting room', hit: 'fitting' },
    { scene: 'Salon appointment at noon', hit: 'hairdryer' },
    { scene: 'KTV private room', hit: 'mic' },
    { scene: 'At the bank counter', hit: 'screen' },
    { scene: 'In the courtroom gallery', hit: 'gavel' },
    { scene: 'At the temple incense', hit: 'censer' },
    { scene: 'Old house in the village', hit: 'immortals' },
    { scene: 'Down the alley at dusk', hit: 'laundry' },
    { scene: 'On the high-speed rail', hit: 'tray' },
  ];
  for (const c of cases) {
    const d = L.lifeDetailDirective(c.scene, 'en');
    assert.ok(!cjk(d), `英文指令「${c.scene}」零中文`);
    assert.ok(d.toLowerCase().includes(c.hit.toLowerCase()), `英文指令「${c.scene}」应包含「${c.hit}」`);
  }
});

test('v2.91 抽象空洞标记扩充：抓得到“顿时火冒三丈/瞬间泪流满面/宛如仙子下凡/气宇轩昂/富丽堂皇/瞬间陷入死寂”', () => {
  const text = '他顿时火冒三丈，她瞬间泪流满面，宛如仙子下凡，气宇轩昂地站在富丽堂皇的大厅里，瞬间陷入死寂。';
  const r = L.groundedScan(text);
  assert.ok(r.abstractHits.length >= 5, `应至少抓到 5 个抽象词，实际 ${r.abstractHits.length}`);
  assert.ok(r.groundedScore < 50, `分数应低于 50（大量抽象词），实际 ${r.groundedScore}`);
  assert.ok(r.suggestions.length >= 5);
});

test('v2.91 扩充后具体场景细节提升 groundedScore（教室、宿舍、工地、网吧、健身房）', () => {
  const vague = '他在教室里很生气，气氛尴尬。';
  const concrete = '△ 他把修正带涂掉错字又涂重了。\n△ 黑板上还留着上一节的板书，窗台上摞着没人认领的水壶。\n「他（烦躁）：你到底想怎样？」';
  const v = L.groundedScan(vague);
  const c = L.groundedScan(concrete);
  assert.ok(c.groundedScore > v.groundedScore, `具体场景应得更高分：vague=${v.groundedScore} concrete=${c.groundedScore}`);
});
