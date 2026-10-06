// v2.317 图像供应商真实测：解密 cfg → 逐家 POST /images/generations → 下载图片字节校验
// 用法：node scripts/probe-image-real.cjs [1024x1024]
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');

function decrypt(payloadEnc) {
  const key = crypto.createHash('sha256').update(process.env.CONFIG_SECRET || 'zhongnan-dev-secret-change-in-production-32b').digest();
  const [ivB, tagB, dataB] = payloadEnc.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8'));
}

const PROMPT = '中国江南小镇民宿的清晨，白墙黛瓦，院子里晾着白床单，远山薄雾，温暖金色阳光，水彩插画风格，宁静治愈，无人物无文字';
const SIZE = process.argv[2] || '1024x1024';

async function probeOne(prov) {
  const url = `${prov.baseUrl.replace(/\/$/, '')}/images/generations`;
  const body = { model: prov.model, prompt: PROMPT, n: 1, size: SIZE };
  console.log(`\n===== ${prov.name} :: ${prov.model} =====`);
  console.log('POST', url, 'size=', SIZE);
  const t0 = Date.now();
  let resp, txt;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prov.apiKey}` },
      body: JSON.stringify(body),
    });
    txt = await resp.text();
  } catch (e) {
    console.log('NETWORK_ERROR', e.message);
    return;
  }
  console.log('HTTP', resp.status, 'ms', Date.now() - t0);
  let data;
  try { data = JSON.parse(txt); } catch { console.log('NON_JSON_BODY', txt.slice(0, 400)); return; }
  if (resp.status !== 200) {
    console.log('ERROR_BODY', JSON.stringify(data).slice(0, 600));
    return;
  }
  console.log('top_keys=', Object.keys(data).join(','), ' usage=', JSON.stringify(data.usage || null));
  const item = data.data?.[0] || data.images?.[0];
  if (!item) { console.log('NO_IMAGE_ITEM', JSON.stringify(data).slice(0, 600)); return; }
  console.log('item_keys=', Object.keys(item).join(','));
  if (item.url) {
    console.log('url=', String(item.url).slice(0, 160));
    const t1 = Date.now();
    const img = await fetch(item.url);
    const buf = Buffer.from(await img.arrayBuffer());
    const magic = buf.slice(0, 4).toString('hex');
    const kind = magic.startsWith('ffd8') ? 'JPEG' : magic.startsWith('89504e47') ? 'PNG' : magic.startsWith('52494646') ? 'WEBP/RIFF' : `UNKNOWN(${magic})`;
    const out = `/tmp/probe-img-${prov.id}.${kind === 'JPEG' ? 'jpg' : kind === 'PNG' ? 'png' : 'bin'}`;
    fs.writeFileSync(out, buf);
    console.log(`DOWNLOAD HTTP ${img.status} bytes=${buf.length} type=${img.headers.get('content-type')} magic=${kind} dl_ms=${Date.now() - t1} saved=${out}`);
  } else if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, 'base64');
    const magic = buf.slice(0, 4).toString('hex');
    console.log(`B64 bytes=${buf.length} magic=${magic.slice(0, 8)}`);
    fs.writeFileSync(`/tmp/probe-img-${prov.id}.b64bin`, buf);
  } else {
    console.log('ITEM_HAS_NEITHER_URL_NOR_B64', JSON.stringify(item).slice(0, 300));
  }
  if (item.encoded_image_url) console.log('encoded_image_url(head)=', String(item.encoded_image_url).slice(0, 80));
}

async function main() {
  const prisma = new PrismaClient();
  const row = await prisma.$queryRawUnsafe(`SELECT "payloadEnc" FROM "ModelConfig" WHERE id='global'`);
  const cfg = decrypt(row[0].payloadEnc);
  const imgs = cfg.providers.filter((x) => x.modality === 'image' && x.enabled);
  console.log('image providers =', imgs.map((x) => x.name).join(' | '));
  for (const prov of imgs) {
    try { await probeOne(prov); } catch (e) { console.log('PROBE_FATAL', prov.name, e.message); }
  }
  await prisma.$disconnect();
}
main();
