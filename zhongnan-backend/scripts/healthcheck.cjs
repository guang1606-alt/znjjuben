#!/usr/bin/env node
/* 健康检查：GET /health，期望 {ok:true}。
 * 用法：node scripts/healthcheck.cjs [baseUrl]
 *   默认 http://127.0.0.1:${PORT:-8080}
 * 退出码：0 健康；1 异常/超时（可供 cron、负载均衡、pm2、监控系统消费）。
 */
'use strict';
const base = process.argv[2] || `http://127.0.0.1:${process.env.PORT || 8080}`;
const url = base.replace(/\/+$/, '') + '/health';
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 5000);
const started = Date.now();
(async () => {
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { 'Cache-Control': 'no-cache' } });
    const body = await res.text();
    let data = null;
    try { data = body ? JSON.parse(body) : null; } catch { /* 非 JSON 视为不健康 */ }
    if (res.status === 200 && data && data.ok === true) {
      console.log(`OK ${url} ${Date.now() - started}ms ts=${data.ts}`);
      process.exit(0);
    }
    console.error(`FAIL ${url} status=${res.status} body=${body.slice(0, 200)}`);
    process.exit(1);
  } catch (e) {
    console.error(`FAIL ${url} ${e && e.name === 'AbortError' ? 'timeout>5s' : (e && e.message)}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
})();
