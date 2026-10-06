// 探针：designer 岗路由供应商（MiniMax-M3）对 JSON-only 指令的真实返回形态
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

function decrypt(payloadEnc) {
  const key = crypto.createHash('sha256').update(process.env.CONFIG_SECRET || 'zhongnan-dev-secret-change-in-production-32b').digest();
  const [ivB, tagB, dataB] = payloadEnc.split('.');
  const iv = Buffer.from(ivB, 'base64');
  const tag = Buffer.from(tagB, 'base64');
  const data = Buffer.from(dataB, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}

async function main() {
  const prisma = new PrismaClient();
  const row = await prisma.$queryRawUnsafe(`SELECT "payloadEnc" FROM "ModelConfig" WHERE id='global'`);
  const cfg = decrypt(row[0].payloadEnc);
  const routeKey = cfg.routing?.character || cfg.routing?.designer;
  console.log('routing.character =', JSON.stringify(cfg.routing?.character), ' designer =', JSON.stringify(cfg.routing?.designer));
  const p = cfg.providers.find((x) => x.id === routeKey || x.name === routeKey || JSON.stringify(cfg.routing?.character || '').includes(x.id));
  const prov = p || cfg.providers.find((x) => (x.model || '').toLowerCase().includes('m3')) || cfg.providers.find((x) => x.modality === 'text' && (x.baseUrl || '').includes('minimaxi'));
  if (!prov) { console.error('NO_PROVIDER; ids=', cfg.providers.map((x) => `${x.id}|${x.name}|${x.model}|${x.baseUrl}`).join('\n')); process.exit(1); }
  console.log('PROVIDER', prov.id, prov.name, prov.model, prov.baseUrl);

  const prompt = `你是人设设计师。根据以下大纲输出人物卡。
大纲：${JSON.stringify({ hookType: 'face_slap_pre', logline: '民宿老板反杀差评师', beats: ['一', '二', '三', '四'], cliffhanger: '差评师被感化' })}
只输出JSON人物卡Cast：形如 {"老桂":{"want":"...","voice":"...","arc":"...","hidden":["..."]}}，不要输出任何其他内容。`;

  const t0 = Date.now();
  const resp = await fetch(`${prov.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prov.apiKey}` },
    body: JSON.stringify({ model: prov.model, messages: [{ role: 'user', content: prompt }], temperature: 0.9, max_tokens: 4096 }),
  });
  const ms = Date.now() - t0;
  const data = await resp.json();
  console.log('HTTP', resp.status, 'ms', ms);
  const msg = data.choices?.[0]?.message ?? {};
  const c = msg.content ?? '';
  console.log('finish_reason =', data.choices?.[0]?.finish_reason);
  console.log('usage =', JSON.stringify(data.usage));
  console.log('content_len =', c.length, ' has_reasoning_field =', 'reasoning_content' in msg, ' reasoning_len =', (msg.reasoning_content || '').length);
  console.log('think_open =', c.includes('<think>'), ' think_close =', c.includes('</think>'));
  console.log('has_brace =', c.includes('{'), ' has_jsonfence =', c.includes('```json'));
  console.log('--- HEAD 400 ---'); console.log(c.slice(0, 400));
  console.log('--- TAIL 800 ---'); console.log(c.slice(-800));
  await prisma.$disconnect();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
