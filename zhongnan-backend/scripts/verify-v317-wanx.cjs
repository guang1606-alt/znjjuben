// v2.317 真机验证：项目 callImage() 生产路径 + 万相原生异步协议（真实网络、真实计费 n=1）
// 用法：set -a && source .env && set +a && node scripts/verify-v317-wanx.cjs
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const MP = require('../dist/lib/model-proxy');
const { EngineTier } = require('../dist/config/pricing');

function decrypt(payloadEnc) {
  const key = crypto.createHash('sha256').update(process.env.CONFIG_SECRET || 'zhongnan-dev-secret-change-in-production-32b').digest();
  const [ivB, tagB, dataB] = payloadEnc.split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(dataB, 'base64')), d.final()]).toString('utf8'));
}

(async () => {
  // 强制走供应商池（不使档位 env），池内只放真实万相一家
  for (const k of ['MODEL_IMAGE_STANDARD_KEY', 'MODEL_IMAGE_FLAGSHIP_KEY', 'MODEL_IMAGE_GATEWAY_BASE_URL']) delete process.env[k];
  const prisma = new PrismaClient();
  const row = await prisma.$queryRawUnsafe(`SELECT "payloadEnc" FROM "ModelConfig" WHERE id='global'`);
  const cfg = decrypt(row[0].payloadEnc);
  const wanx = cfg.providers.find((x) => (x.model || '').includes('wanx'));
  if (!wanx) throw new Error('未找到万相 provider');
  MP.__setProviderSource(async () => ({ providers: [wanx], routing: {} }));

  const prompt = '中国江南小镇民宿黄昏，白墙黛瓦，门前一盏暖黄灯笼，远山晚霞，水彩插画风格，宁静，无人物无文字';
  const t0 = Date.now();
  const r = await MP.callImage(EngineTier.STANDARD, prompt, 1, '1024x1536', { timeoutMs: 200000 });
  console.log('callImage OK', JSON.stringify({ costFen: r.costFen, fellback: r.fellback ?? false, n: r.images.length, ms: Date.now() - t0 }));
  const u = r.images[0];
  console.log('url head =', String(u).slice(0, 120));
  const img = await fetch(u);
  const buf = Buffer.from(await img.arrayBuffer());
  const magic = buf.slice(0, 4).toString('hex');
  const kind = magic.startsWith('ffd8') ? 'JPEG' : magic.startsWith('89504e47') ? 'PNG' : `UNKNOWN(${magic})`;
  fs.writeFileSync('/tmp/verify-v317-wanx.png', buf);
  console.log(`DOWNLOAD HTTP ${img.status} bytes=${buf.length} type=${img.headers.get('content-type')} magic=${kind} saved=/tmp/verify-v317-wanx.png`);
  if (!/aliyun|dashscope/i.test(u)) throw new Error('图片 URL 非阿里云域名，候选可能不对');
  if (kind === 'UNKNOWN') throw new Error('图片魔数异常');
  console.log('WANX_VERIFY_PASS');
  MP.__setProviderSource(null);
  await prisma.$disconnect();
})().catch((e) => { console.error('WANX_VERIFY_FAIL', e); process.exit(1); });
