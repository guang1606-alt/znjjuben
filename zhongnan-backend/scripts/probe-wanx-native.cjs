// 通义万相双协议探测：A) compatible-mode images/generations（看404详情） B) 原生异步任务协议
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');

function decrypt(payloadEnc) {
  const key = crypto.createHash('sha256').update(process.env.CONFIG_SECRET || 'zhongnan-dev-secret-change-in-production-32b').digest();
  const [ivB, tagB, dataB] = payloadEnc.split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(dataB, 'base64')), d.final()]).toString('utf8'));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const prisma = new PrismaClient();
  const row = await prisma.$queryRawUnsafe(`SELECT "payloadEnc" FROM "ModelConfig" WHERE id='global'`);
  const cfg = decrypt(row[0].payloadEnc);
  const prov = cfg.providers.find((x) => (x.model || '').includes('wanx'));
  const K = prov.apiKey;
  const PROMPT = '中国江南小镇民宿的清晨，白墙黛瓦，远山薄雾，温暖金色阳光，水彩插画风格，无人物无文字';

  // A) 兼容模式重试，打印完整状态/头/体；size 分别试 x 与 *
  for (const size of ['1024x1024', '1024*1024']) {
    const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${K}` },
      body: JSON.stringify({ model: prov.model, prompt: PROMPT, n: 1, size }),
    });
    const t = await r.text();
    console.log(`[A compatible size=${size}] HTTP ${r.status} ct=${r.headers.get('content-type')} body=${t.slice(0, 300)}`);
  }

  // B) 原生异步：提交任务
  const submit = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${K}`, 'X-DashScope-Async': 'enable' },
    body: JSON.stringify({ model: prov.model, input: { prompt: PROMPT }, parameters: { size: '1024*1024', n: 1 } }),
  });
  const sj = await submit.json();
  console.log('[B submit] HTTP', submit.status, JSON.stringify(sj).slice(0, 300));
  const taskId = sj.output?.task_id;
  if (!taskId) { await prisma.$disconnect(); return; }
  // 轮询
  for (let i = 0; i < 20; i++) {
    await sleep(5000);
    const tr = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, { headers: { Authorization: `Bearer ${K}` } });
    const tj = await tr.json();
    const st = tj.output?.task_status;
    console.log(`[B poll ${i + 1}] ${st}`, JSON.stringify(tj.output).slice(0, 200));
    if (st === 'SUCCEEDED') {
      const u = tj.output.results?.[0]?.url || tj.output.results?.[0]?.b64_image;
      if (u && u.startsWith('http')) {
        const img = await fetch(u);
        const buf = Buffer.from(await img.arrayBuffer());
        fs.writeFileSync('/tmp/probe-img-wanx-native.jpg', buf);
        console.log(`[B img] HTTP ${img.status} bytes=${buf.length} type=${img.headers.get('content-type')} magic=${buf.slice(0, 2).toString('hex')}`);
      }
      console.log('[B usage]', JSON.stringify(tj.usage));
      break;
    }
    if (st === 'FAILED' || st === 'UNKNOWN') { console.log('[B FAILED]', JSON.stringify(tj)); break; }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
