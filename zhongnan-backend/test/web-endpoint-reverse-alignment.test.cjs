/**
 * v2.234 端点反向对齐守卫 —— 「前端调了、后端必须有」零幽灵调用
 * 背景：v2.233 做了「后端有→前端无」孤儿审计；本轮反向审计（前端 191 唯一 方法+路径 调用 vs 后端路由表）
 * 结论 0 真幽灵，但暴露审计口径缺口：MOUNT 映射漏了 craft.ts（/api/craft，7 路由 8 调用点）。
 * 本文件把反向审计固化成回归守卫：后端路由表 + 前端调用提取管线 + 假阳性通用规则，
 * 任何一侧未来漂移（前端调了不存在的端点）即红。纯静态读源码，不起服务器。
 *
 * 提取假阳性通用规则（v2.233/v2.234 审计沉淀，勿删）：
 *  ① seam-fill：'.../a' + expr + '/b' 整段（含引号）归一为 '/a:p/b'
 *  ② ${} 模板插值先于提取归一为 :p（防内层引号截断）
 *  ③ query 尾插值：`:p` 前非 '/' 者（如 character-assets${qs}）剔除该尾段
 *  ④ 封装前缀定义：字面量后紧跟 ' + ' 者跳过（如 admApi 定义里的 '/api/admin' + path）
 *  ⑤ 相对路径封装调用：admApi/admDownload→/api/admin、fbAdm→/api/feedback、adAdm→/api/ads（按行尾截窗）
 * 方法维度不做断言（helper 封装导致静态推断不可靠，v2.234 审计已逐一人工核实）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RDIR = path.join(ROOT, 'src/routes');
const WEB = path.join(ROOT, 'web');

// 文件→挂载前缀（与 src/server/app.ts 对齐；新增路由文件必须登记，否则守卫报幽灵）
const MOUNT = {
  'auth.ts': '/api/auth', 'generate.ts': '/api/generate', 'value-added.ts': '/api/va',
  'room.ts': '/api/room', 'interview.ts': '/api/interview', 'teardown.ts': '/api/teardown',
  'ads.ts': '/api/ads', 'order.ts': '/api/order', 'feedback.ts': '/api/feedback',
  'knowledge.ts': '/api/admin/knowledge', 'admin-model.ts': '/api/admin/model',
  'admin-safety.ts': '/api/admin/safety', 'admin.ts': '/api/admin', 'market.ts': '/api/market',
  'community.ts': '/api/community', 'export.ts': '/api/export', 'tags.ts': '/api/tags',
  'novel-sources.ts': '/api/novels', 'admin-handoff.ts': '/api/admin/handoff',
  'updates.ts': '/api', 'submission.ts': '/api/submission', 'craft.ts': '/api/craft',
};
const WRAP = { admApi: '/api/admin', admDownload: '/api/admin', fbAdm: '/api/feedback', adAdm: '/api/ads' };

function backendPaths() {
  const out = [];
  for (const [f, prefix] of Object.entries(MOUNT)) {
    const t = fs.readFileSync(path.join(RDIR, f), 'utf8');
    for (const m of t.matchAll(/\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g)) {
      const rel = m[2];
      const full = (rel === '/api' || rel.startsWith('/api/')) ? rel : prefix + rel;
      out.push(full.replace(/:[^/]+/g, ':p'));
    }
  }
  return out;
}

function seamFill(t) {
  for (let i = 0; i < 4; i++) t = t.replace(/(['"])\s*\+\s*[^;\n]*?\s*\+\s*(['"])/g, ':p');
  return t;
}
// 规则③：剔除前非 '/' 的 :p 尾段（query 尾插值形态）
const stripTailParam = (p) => p.replace(/([^/]):p(?=$|[^/\w])/g, '$1');
const normPath = (p) => stripTailParam(p.replace(/\$\{[^}]*\}/g, ':p').replace(/\?.*/, ''));

function frontendPaths() {
  const keys = new Set();
  const files = fs.readdirSync(WEB).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(WEB, f), 'utf8');
    const flat = seamFill(raw.replace(/\$\{[^}]*\}/g, ':p'));
    for (const m of flat.matchAll(/['"`](\/api\/[^'"`]+)['"`]/g)) {
      // 规则④：封装前缀定义（字面量后紧跟 +）跳过
      if (/^\s*\+/.test(flat.slice(m.index + m[0].length))) continue;
      const p = stripTailParam(m[1].replace(/\?.*/, ''));
      if (p !== '/api/' && p !== '/api') keys.add(p);
    }
    const wrapNames = Object.keys(WRAP).join('|');
    for (const am of raw.matchAll(new RegExp('\\b(' + wrapNames + ')\\(\\s*', 'g'))) {
      const idx = am.index + am[0].length;
      const nl = raw.indexOf('\n', idx);
      const win = seamFill(raw.slice(idx, nl < 0 ? idx + 400 : nl)).replace(/\$\{[^}]*\}/g, ':p');
      const pm = win.match(/['"`](\/[^'"`]+)['"`]/);
      if (pm) keys.add(WRAP[am[1]] + normPath(pm[1]));
    }
  }
  return keys;
}

function covered(beList, fePath) {
  const fs2 = fePath.split('/').filter(Boolean);
  return beList.some((bp) => {
    const bs = bp.split('/').filter(Boolean);
    if (bs.length !== fs2.length) return false;
    return bs.every((s, i) => s === ':p' || s === fs2[i]);
  });
}

describe('v2.234 端点反向对齐（前端零幽灵调用）', () => {
  const be = backendPaths();
  const fe = frontendPaths();

  it('MOUNT 映射覆盖全部路由文件（含 craft.ts，v2.234 审计补登）', () => {
    const onDisk = fs.readdirSync(RDIR).filter((f) => f.endsWith('.ts')).sort();
    const mapped = Object.keys(MOUNT).sort();
    assert.deepStrictEqual(mapped, onDisk, '路由文件与 MOUNT 映射必须一一对应（新增路由文件请同步登记）');
  });

  it('前端调用提取量 sanity（防规则过杀导致守卫失效）', () => {
    assert.ok(fe.size >= 150, '前端唯一调用键应 ≥150（当前 ' + fe.size + '），过少说明提取规则误杀');
  });

  it('前端每个调用路径都能在后端路由表解析（零幽灵）', () => {
    const ghosts = [...fe].filter((p) => !covered(be, p)).sort();
    assert.deepStrictEqual(ghosts, [], '前端调了但后端不存在的端点：\n  ' + ghosts.join('\n  '));
  });

  it('后端路由表 sanity（防 MOUNT 漏文件导致假绿）', () => {
    assert.ok(be.length >= 190, '后端端点应 ≥190（当前 ' + be.length + '），过少说明 MOUNT 漏登记');
    assert.ok(be.some((p) => p.startsWith('/api/craft/')), 'craft 路由应在后端路由表内');
  });
});
