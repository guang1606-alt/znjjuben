/**
 * v2.216 500 错误响应脱敏契约（家族铁律）
 *  1. 500 一律 { error: 'INTERNAL_ERROR' }：内部异常详情（Prisma/文件路径/供应商错误）只进服务端日志，绝不直回客户端
 *     （与 FRONTEND-ADAPTATION.md「错误响应」约定对齐；400 业务错误中转配合退款的语义不受影响）
 *  2. 静态守卫：src/ 下不允许出现 status(500) 与动态异常消息（(e as Error).message / e?.message / 模板串插值）的组合
 *  3. failInternal 助手行为：scope 标签 + 完整错误进 console.error；客户端只收 INTERNAL_ERROR；headersSent 时静默防崩
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// —— 1. failInternal 单测（dist 产物） ——
const { failInternal } = require('../dist/lib/http-errors.js');

function fakeRes() {
  const calls = { status: [], json: [] };
  return {
    calls,
    headersSent: false,
    status(code) { calls.status.push(code); return this; },
    json(body) { calls.json.push(body); return this; },
  };
}
function silenceConsoleError(fn) {
  const orig = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.map(String).join(' '));
  try { fn(logged); } finally { console.error = orig; }
}

describe('failInternal（v2.216 500 脱敏助手）', () => {
  it('返回 500 + INTERNAL_ERROR，详情只进服务端日志（含 scope 标签）', () => {
    silenceConsoleError((logged) => {
      const res = fakeRes();
      failInternal(res, new Error('Prisma: table users not found at /db/schema.prisma'), 'admin-model.config');
      assert.deepStrictEqual(res.calls.status, [500]);
      assert.deepStrictEqual(res.calls.json, [{ error: 'INTERNAL_ERROR' }]);
      assert.strictEqual(logged.length, 1, '只记一条错误日志');
      assert.ok(logged[0].includes('[admin-model.config]'), '日志带 scope 标签');
      assert.ok(logged[0].includes('Prisma: table users not found'), '完整错误留在服务端日志');
    });
  });

  it('非 Error 抛出值（string/null/undefined）不崩，仍返回 INTERNAL_ERROR', () => {
    silenceConsoleError(() => {
      for (const bad of ['boom', null, undefined]) {
        const res = fakeRes();
        failInternal(res, bad, 'x');
        assert.deepStrictEqual(res.calls.json, [{ error: 'INTERNAL_ERROR' }]);
      }
    });
  });

  it('headersSent 时不再写响应（防 ERR_HTTP_HEADERS_SENT 二次崩溃）', () => {
    silenceConsoleError((logged) => {
      const res = fakeRes();
      res.headersSent = true;
      failInternal(res, new Error('late write'), 'export.render');
      assert.strictEqual(res.calls.json.length, 0, '不写响应体');
      assert.strictEqual(res.calls.status.length, 0);
      assert.ok(logged[0].includes('[export.render]'), '日志照记不误');
    });
  });
});

// —— 2. 静态守卫：500 行窗口禁止携带动态异常消息 ——
function walkTs(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('500 响应脱敏静态守卫（家族铁律）', () => {
  it('src/ 下不存在 status(500) 与动态异常消息的组合（500 行起 3 行窗口）', () => {
    const violations = [];
    const DYNAMIC = /\(e as Error\)\.message|e\?\.message|\be\.message|\$\{/;
    for (const f of walkTs(path.join(__dirname, '..', 'src'))) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!line.includes('status(500)')) return;
        const window = lines.slice(i, i + 3).join('\n');
        if (DYNAMIC.test(window)) violations.push(`${path.relative(process.cwd(), f)}:${i + 1}`);
      });
    }
    assert.deepStrictEqual(violations, [], `以下位置 500 响应直回动态异常消息（应改用 failInternal）：\n${violations.join('\n')}`);
  });

  it('固定文案 500 不受守卫影响（抽查 market.ts 支付语义仍保留）', () => {
    const market = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'market.ts'), 'utf8');
    assert.ok(market.includes("error: '支付失败，已取消'"), '业务语义固定文案合法');
  });
});
