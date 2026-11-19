/**
 * v2.549 目标平台接线守卫
 *
 * 背景：前端「目标平台」下拉曾是死控件——值从不进请求、后端无该字段，
 * 用户选了红果/抖音/快手/ReelShort/DramaBox 却对生成毫无影响（名实不符）。
 * 本守卫锁定端到端链路：入口 → 载荷 → schema → 落库 → 三层解析 → 管线注入。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../dist/config/platform-targets.js');

const ROOT = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

test('目标平台：前端下拉在生成配置栏内，且选项 id 与后端注册表一致', () => {
  const html = read('web', 'index.html');
  const barAt = html.indexOf('id="genConfigBar"');
  assert.ok(barAt >= 0, '找不到生成配置栏');
  const selAt = html.indexOf('id="platform"');
  assert.ok(selAt > barAt && selAt - barAt < 4000, '「目标平台」下拉不在生成配置栏内');

  const js = read('web', 'app.js');
  const at = js.indexOf('platform: { zh: [');
  assert.ok(at >= 0, '前端 SELECT_OPTS.platform 被改名/删除');
  // 只取 zh 段：从 zh 起始到 en 起始（选项对里含 "],"，不能按首个 "]" 切）
  const enAt = js.indexOf('en: [[', at);
  assert.ok(enAt > at, '找不到 platform 的 en 段');
  const block = js.slice(at, enAt);
  const ids = [...block.matchAll(/\['([^']*)'/g)].map((m) => m[1]).filter((v) => v !== '');
  assert.deepStrictEqual(ids, P.PLATFORM_TARGETS.map((t) => t.id),
    '前端平台选项 id 必须与后端 PLATFORM_TARGETS 一一对应（顺序也一致）');
  assert.ok(block.includes("['',"), '缺少「不指定」空选项：用户应能保留系统默认，不被迫选平台');
});

test('目标平台：i18n 有标签与「不指定」文案', () => {
  const i18n = read('web', 'i18n.js');
  for (const k of ['platform:', 'platformAuto:']) {
    const n = i18n.split(k).length - 1;
    assert.ok(n >= 2, `i18n 键 ${k} 应中英各一处，实际 ${n}`);
  }
});

test('目标平台：立项与生成请求都透传，且取值函数存在', () => {
  const js = read('web', 'app.js');
  assert.ok(js.includes('function platformValue('), '缺少 platformValue()');
  assert.ok(js.includes('function platformPayload('), '缺少 platformPayload()');
  const projAt = js.indexOf('const projectPayload = {');
  assert.ok(projAt >= 0, '找不到立项载荷');
  assert.ok(js.slice(projAt, projAt + 1600).includes('platformPayload()'), '立项载荷未透传 platform');
  const genAt = js.indexOf("'/api/generate/episodes'");
  assert.ok(genAt >= 0, '找不到生成请求');
  assert.ok(js.slice(genAt, genAt + 1600).includes('platformPayload()'), '生成请求未透传 platform');
});

test('目标平台：续写已保存项目时还原并按项目锁定', () => {
  const js = read('web', 'app.js');
  assert.ok(js.includes("'platform'") && js.includes('syncDraftProject'), '续写链路缺失');
  assert.match(js, /\$\('platform'\)\.value = project\.bible\?\.platform/,
    '续写未从项目 bible 还原目标平台（界面显示默认、实际沿用落库值，名实不符）');
  assert.match(js, /\['episodes', 'engine', 'scriptFormatSel', 'scenesPerEp', 'platform'\]/,
    '续写时「目标平台」未随项目锁定（可被改成与已生成集不一致）');
});

test('目标平台：后端立项/生成 schema 接受、bible 落库、三层解析', () => {
  const src = read('src', 'routes', 'generate.ts');
  assert.match(src, /platform:\s*z\.enum\(\['hongguo', 'douyin', 'kuaishou', 'reelshort', 'dramabox'\]\)\.optional\(\)/,
    '立项或生成 schema 缺少 platform（前端传了也会被 zod 静默丢弃）');
  assert.match(src, /\.\.\.\(d\.platform \? \{ platform: d\.platform \} : \{\}\)/,
    'platform 未随立项落库 bible（续写/重生成会丢平台）');
  assert.match(src, /parsed\.data\.platform \?\? storedPlatform/,
    '生成路由未做「请求 > 项目落库」解析');
  assert.match(src, /\.\.\.\(platformOpt \? \{ platform: platformOpt \} : \{\}\)/,
    'platform 未传入创作管线 EpisodeOptions');
});

test('目标平台：管线注入三岗位，且海外平台触发本地化判定', () => {
  const src = read('src', 'agents', 'pipeline.ts');
  assert.ok(src.includes("platformDirectiveOf") && src.includes("from '../config/platform-targets'"),
    '管线未引入平台注册表');
  const hits = (src.match(/\$\{platformDirective\}/g) || []).length;
  assert.ok(hits >= 3, `平台指令应注入架构师/撰写师/润色师三岗，实际 ${hits} 处`);
  assert.match(src, /isOversea = [^;]*platformTargetOf\(options\.platform\)/,
    '海外判定未纳入平台维度（选 ReelShort/DramaBox 却不算海外）');
  // 未选平台必须零注入，行为与旧版一致
  assert.strictEqual(P.platformDirectiveOf(undefined, 'zh'), '');
  assert.strictEqual(P.platformDirectiveOf('unknown_id', 'en'), '');
  assert.ok(P.platformDirectiveOf('reelshort', 'zh').includes('本地化'));
  assert.ok(P.platformDirectiveOf('hongguo', 'en').includes('Hongguo'));
});
