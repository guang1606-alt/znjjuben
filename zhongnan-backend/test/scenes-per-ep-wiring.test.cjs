/**
 * v2.547 每集场数入口守卫（静态接线）
 * ------------------------------------------------------------------
 * 真实缺口：此前「每集N场」只存在于钩子调色板内，仅用于调色板预览请求，
 * 从不随立项/生成请求下发。用户选「每集6场」规划钩子，真实写本集时后端仍按
 * 节奏策略默认（约3场）排布——入口在、不生效，规划与产出脱节。
 *
 * 本守卫锁定三件事：
 *   1) 生成配置栏有正式入口，且中英文案齐全；
 *   2) 立项落库 + 生成请求都透传同一取值（单事实源 scenesPayload）；
 *   3) 调色板不再自带独立选择器（双事实源必然漂移），改为复用同一取值。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const p = (...xs) => path.join(ROOT, ...xs);
const read = (...xs) => fs.readFileSync(p(...xs), 'utf8');

test('每集场数：生成配置栏有入口，中英文案齐全', () => {
  const html = read('web', 'index.html');
  assert.match(html, /id="scenesPerEp"/, '生成配置栏缺少「每集场数」选择器（能力无入口）');
  const bar = html.slice(html.indexOf('id="genConfigBar"'));
  assert.ok(bar.slice(0, 4000).includes('id="scenesPerEp"'), '「每集场数」应放在生成配置栏（立项/生成前可改）');
  const i18n = read('web', 'i18n.js');
  for (const key of ['scenesPerEp', 'scenesAuto']) {
    const hits = (i18n.match(new RegExp(`\\b${key}:`, 'g')) || []).length;
    assert.ok(hits >= 2, `i18n 缺少 ${key} 的中英双语键（实际 ${hits} 处）`);
  }
});

test('每集场数：立项与生成同源透传，调色板不再另设选择器', () => {
  const js = read('web', 'app.js');
  assert.match(js, /function scenesPerEpValue\(/, '缺少 scenesPerEpValue 统一取值函数');
  assert.match(js, /function scenesPayload\(/, '缺少 scenesPayload 统一载荷函数');

  const projAt = js.indexOf('const projectPayload = {');
  assert.ok(projAt > 0, '找不到立项载荷');
  assert.ok(js.slice(projAt, projAt + 1200).includes('scenesPayload()'), '立项请求未透传 scenesPerEp（续写/重生成会丢场数）');

  const epAt = js.indexOf("'/api/generate/episodes'");
  assert.ok(epAt > 0, '找不到生成请求');
  assert.ok(js.slice(epAt, epAt + 1200).includes('scenesPayload()'), '生成请求未透传 scenesPerEp（用户选了场数却不生效）');

  assert.ok(!js.includes('palette-scenes'), '调色板仍保留独立的场数选择器（双事实源，易漂移）');
  assert.ok(js.includes('scenesPerEpValue() || 4'), '调色板请求未复用同一场数取值');
});

test('每集场数：后端立项落库并可被生成请求沿用', () => {
  const ts = read('src', 'routes', 'generate.ts');
  assert.match(ts, /scenesPerEp:\s*z\.number\(\)\.int\(\)\.min\(1\)\.max\(8\)\.optional\(\)/, '立项 schema 缺少 scenesPerEp 校验');
  assert.match(ts, /\.\.\.\(d\.scenesPerEp \? \{ scenesPerEp: d\.scenesPerEp \} : \{\}\)/, '立项未把 scenesPerEp 落库进 bible');
  assert.match(ts, /parsed\.data\.scenesPerEp \?\? storedScenesPerEp/, '生成路由未沿用立项落库的 scenesPerEp');
});
