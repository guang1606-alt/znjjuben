// v2.80 被动信息投喂检测（Info Delivery）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/info-delivery.js');

const HEADER = '内景·公寓·夜';

describe('v2.80 info-delivery 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.infoDelivery('').score, 100);
    assert.equal(M.infoDelivery('   ').hits.length, 0);
  });
});

describe('v2.80 info-delivery 中文命中', () => {
  test('手机弹出消息+事件', () => {
    const r = M.infoDelivery([HEADER, '手机弹出一条消息：母亲病危，速回老宅。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'device');
    assert.ok(r.score < 100);
  });

  test('电话那头传来+引语事件', () => {
    const r = M.infoDelivery([HEADER, '电话那头传来声音："人已经跑了，码头扑空。"'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('助理进来汇报事件', () => {
    const r = M.infoDelivery([HEADER, '助理快步进来汇报，合同被对方提前截胡了。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'messenger');
  });

  test('新闻播报事件', () => {
    const r = M.infoDelivery([HEADER, '电视新闻正在播报：林氏集团董事长昨夜车祸身亡。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'broadcast');
  });

  test('微信发来地址', () => {
    const r = M.infoDelivery([HEADER, '微信提示音响起，对方把孩子的位置发了过来。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('多命中压到下限', () => {
    const r = M.infoDelivery([
      HEADER,
      '手机弹出一条消息：母亲病危。',
      '电话那头说："人已经跑了。"',
      '助理快步进来汇报，合同被截胡了。',
      '电视新闻正在播报：董事长车祸身亡。',
      '她收到一条短信：亲子鉴定结果出来了。',
      '管家低声禀报，遗嘱已经被人改过。',
      '手下推门进来报告，目标在码头现身。',
    ].join('\n'));
    assert.equal(r.hits.length, 7);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 info-delivery 中文豁免', () => {
  test('只有物件没有内容：未接来电是悬念钩子', () => {
    const r = M.infoDelivery([
      HEADER,
      '手机屏幕亮了一下，只有一个没有备注的未接来电。',
      '她盯着那条短信看了很久，一个字也没点开。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('主角主动取证：抢手机翻记录逼问', () => {
    const r = M.infoDelivery([
      HEADER,
      '她一把夺过他的手机，翻出置顶聊天，指着最新一条录音逼问他。',
      '林棠黑入公司邮箱，查到了那份被撤回的合同。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('主动打电话但被挂断：无内容投递', () => {
    const r = M.infoDelivery([HEADER, '她连拨三通电话，最后一通被人直接挂断。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('亲手翻到物证：无渠道', () => {
    const r = M.infoDelivery([HEADER, '她在抽屉最底层的药盒下面，翻出了那份病历。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('台词豁免（当面亲口说归人物戏）', () => {
    const r = M.infoDelivery([
      HEADER,
      '助理：董事长，合同被截胡了，对方比我们快了一步。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 info-delivery English', () => {
  test('text message delivers event', () => {
    const r = M.infoDelivery([
      'INT. APARTMENT - NIGHT',
      'Her phone buzzed. A text read: "The wedding is off."',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'device');
  });

  test('subordinate reports disappearance', () => {
    const r = M.infoDelivery([
      'INT. OFFICE - NIGHT',
      'A bodyguard rushed in to report that the witness had escaped.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'messenger');
  });

  test('broadcast reports death', () => {
    const r = M.infoDelivery([
      'INT. APARTMENT - NIGHT',
      'The breaking news announced the chairman was dead.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'broadcast');
  });

  test('active snooping exempt', () => {
    const r = M.infoDelivery([
      'INT. OFFICE - NIGHT',
      'She grabbed his phone, scrolled through the pinned chat and confronted him with the recording.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('missed call with no content exempt', () => {
    const r = M.infoDelivery([
      'INT. APARTMENT - NIGHT',
      'The screen lit up once: one missed call, no name.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('en dialogue exempt', () => {
    const r = M.infoDelivery([
      'INT. OFFICE - NIGHT',
      'AIDE: Sir, the contract is gone — they moved first.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
