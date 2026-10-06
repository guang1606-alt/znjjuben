#!/usr/bin/env node
/**
 * 供应商连通性探针（运维工具，不参与产品运行）。
 * 用法：
 *   set -a && source .env && set +a
 *   node scripts/probe-providers.cjs           # 仅盘点（解密后不落盘、不打印明文 key）
 *   node scripts/probe-providers.cjs --ping    # 盘点 + 对每个有 key 的文本候选发 1-token 最小真实请求
 * 安全：API Key 只显示末 4 位；响应体截断 160 字符。
 */
const crypto = require('node:crypto');
const https = require('node:https');
const http = require('node:http');

const SECRET = process.env.CONFIG_SECRET || 'zhongnan-dev-secret-change-in-production-32b';
const KEY = crypto.createHash('sha256').update(SECRET).digest();
function decrypt(payload) {
  try {
    const [ivB64, tagB64, dataB64] = String(payload).split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
    d.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8');
  } catch { return ''; }
}
const mask = (s) => (!s ? '(无key)' : s.length <= 8 ? '••••' : '••••••' + s.slice(-4));

// 与 src/config/model-catalog.ts 同步的默认 baseUrl（仅用于条目留空时补全）
const CATALOG_BASE = {
  deepseek_v4flash: 'https://api.deepseek.com/v1', deepseek_v4pro: 'https://api.deepseek.com/v1',
  doubao_seedflash: 'https://ark.cn-beijing.volces.com/api/v3', doubao_seed2pro: 'https://ark.cn-beijing.volces.com/api/v3',
  qwen38max: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  kimi_k3: 'https://api.moonshot.cn/v1', minimax_m25: 'https://api.minimax.chat/v1',
  gpt_5flag: 'https://api.openai.com/v1',
  claude_sonnet5: 'https://api.anthropic.com/v1', claude_opus5: 'https://api.anthropic.com/v1',
  gemini_3pro: 'https://generativelanguage.googleapis.com/v1beta/openai',
};

function ping(baseUrl, model, apiKey, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl.replace(/\/$/, '') + '/chat/completions');
    const body = JSON.stringify({
      model, messages: [{ role: 'user', content: 'ping，请只回复两个字：在的' }],
      temperature: url.host.includes('moonshot') ? 1 : 0.9, max_tokens: 8,
    });
    const req = (url.protocol === 'http:' ? http : https).request(url, {
      method: 'POST', timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').replace(/\s+/g, ' ').slice(0, 160);
        let reply = '';
        try { reply = JSON.parse(Buffer.concat(chunks).toString('utf8'))?.choices?.[0]?.message?.content || ''; } catch {}
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, detail: text, reply: reply.slice(0, 40) });
      });
    });
    req.on('error', (e) => resolve({ status: 0, ok: false, detail: 'NET ' + e.message, reply: '' }));
    req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
    req.write(body); req.end();
  });
}

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const row = await prisma.modelConfig.findUnique({ where: { id: 'global' } });
  if (!row) { console.log('ModelConfig 无 global 行：后台尚未保存过任何供应商配置'); await prisma.$disconnect(); return; }
  const cfg = JSON.parse(decrypt(row.payloadEnc) || '{}');

  const tiers = [
    ['text.economy（经济档直配）', cfg.text?.economy],
    ['text.standard（标准档直配）', cfg.text?.standard],
    ['text.flagship（旗舰档直配）', cfg.text?.flagship],
    ['text.overseas（海外档直配）', cfg.text?.overseas],
  ];
  console.log('==== 档位直配 ====');
  for (const [label, c] of tiers) {
    console.log(`${label}\t baseUrl=${c?.baseUrl || '(空)'}\t model=${c?.model || '(空)'}\t key=${mask(c?.apiKey)}`);
  }

  const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
  console.log(`\n==== 供应商池（${providers.length} 条）====`);
  const targets = [];
  for (const p of providers) {
    const base = p.baseUrl || CATALOG_BASE[p.catalogId] || '';
    console.log(`[${p.enabled ? '启用' : '停用'}] ${p.name} (${p.modality || 'text'}) id=${p.id} catalog=${p.catalogId || '-'}\t base=${base || '(空)'}\t model=${p.model || '(空)'}\t key=${mask(p.apiKey)}`);
    if (process.argv.includes('--ping') && p.modality !== 'image' && p.enabled !== false && p.apiKey && base && p.model) {
      targets.push({ name: p.name, baseUrl: base, model: p.model, apiKey: p.apiKey });
    }
  }
  if (process.argv.includes('--ping')) {
    for (const [label, c] of tiers) {
      if (c?.apiKey && c?.baseUrl && c?.model) targets.push({ name: label, baseUrl: c.baseUrl, model: c.model, apiKey: c.apiKey });
    }
    console.log(`\n==== 真实 ping（${targets.length} 个文本端点，max_tokens=8，不重试）====`);
    for (const t of targets) {
      process.stdout.write(`→ ${t.name} [${t.model}] ... `);
      const r = await ping(t.baseUrl, t.model, t.apiKey);
      console.log(`${r.ok ? '✅' : '❌'} HTTP ${r.status}${r.reply ? ' 回复=' + r.reply : ''}\n   ${r.ok ? '' : r.detail}`);
    }
  }
  await prisma.$disconnect();
})().catch((e) => { console.error('探针失败:', e.message); process.exit(1); });
