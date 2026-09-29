const test = require('node:test');
const assert = require('node:assert');
const D = require('../dist/config/api-directory.js');
const C = require('../dist/config/model-catalog.js');

test('v2.53 目录覆盖：模型目录每个型号都有申请入口，无悬空映射', () => {
  const cat = [...C.TEXT_MODELS, ...C.IMAGE_MODELS].map((m) => ({ id: m.id, modality: m.modality }));
  const cov = D.directoryCoverage(cat);
  assert.deepStrictEqual(cov.missing, []);
  assert.deepStrictEqual(cov.extra, []);
});

test('创作类条目链接合法：必需项必须有 http 申请入口；海外/国产标注完整', () => {
  for (const e of D.apiByLayer('llm_text').concat(D.apiByLayer('llm_image'))) {
    if (e.id === 'img_mj') { assert.strictEqual(e.consoleUrl, ''); continue; } // MJ 无官方 API 如实标注
    assert.ok(/^https:\/\//.test(e.consoleUrl), `${e.id} 缺申请链接`);
    assert.ok(e.usedBy.length >= 1, `${e.id} 没写用途`);
    assert.ok(['domestic', 'overseas'].includes(e.region));
  }
});

test('基础设施层覆盖登录/支付/存储/审核/语音五大必备件', () => {
  const ids = D.apiByLayer('infra').map((e) => e.id);
  for (const must of ['infra_sms', 'infra_wechat_login', 'infra_pay_wx', 'infra_oss', 'infra_moderation', 'infra_tts_asr']) {
    assert.ok(ids.includes(must), `缺基础设施 ${must}`);
  }
});
