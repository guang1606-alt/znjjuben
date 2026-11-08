/**
 * v2.490 自动化机制守卫
 *
 * 这一组不测业务，测「省力的机制本身还在不在」。
 * 背景：每轮的重复劳动（手工变异再手工还原、巡检盲区靠人记、新控件有没有接线靠人眼）都已经被脚本化，
 * 但只要任何一次「清理无用脚本」把其中一环删掉，流程就会静默退回手工，且没有任何红灯提醒。
 * 这里把每个机制的**关键安全属性**钉死：删掉或改弱都会立刻红。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('A1 变异脚本必须存在，且具备「强制还原 + 还原核对」能力', () => {
  const f = path.join(ROOT, 'scripts', 'mutation-run.cjs');
  assert.ok(fs.existsSync(f), '缺少 scripts/mutation-run.cjs（手工变异会退回靠人记还原）');
  const src = fs.readFileSync(f, 'utf8');
  assert.match(src, /}\s*finally\s*\{/, '变异必须在 finally 中还原（抛错/超时/中断都要写回原样）');
  assert.match(src, /sha256|createHash\('sha256'\)/, '必须用 sha256 核对还原是否真的还原');
  assert.match(src, /--find 在 .* 中未命中/, '必须拒绝「变异无效」的空跑');
  assert.match(src, /baselineDirty/, '必须比对变异前后的 git 状态，避免把未提交改动卷进来');
  assert.match(src, /--allow-dirty/, '必须默认拒绝脏文件变异，脏文件需显式放行');
  assert.match(pkg.scripts.mutate || '', /mutation-run\.cjs/, 'package.json 必须暴露 npm run mutate');
});

test('A2 doctor 必须播报巡检盲区数量（否则盲区会被当成全绿）', () => {
  const src = read('scripts/doctor.cjs');
  assert.match(src, /function auditBlindSpots/, 'doctor 必须统计 needsData 盲区');
  assert.match(src, /blindSpots/, '盲区数量必须进 doctor 状态');
  assert.match(src, /盲区 \$\{state\.blindSpots\}/, '盲区数量必须打印给每轮开工的人看');
});

test('A3 控件接线守卫必须进快速闸门 verify:copy', () => {
  assert.match(pkg.scripts['verify:copy'] || '', /web-ui-handlers\.test\.cjs/,
    'verify:copy 未包含控件接线守卫，新按钮点了没反应不会被拦');
});

test('A4 巡检脚本必须支持查询串形态深链', () => {
  const src = read('scripts/ui-audit.cjs');
  assert.match(src, /'\/#\/works\?id=123'/, '深链目录缺少哈希+查询串形态');
  assert.match(src, /'\/market\?id=123'/, '深链目录缺少路径+查询串形态');
  assert.match(src, /function expectedViewOf/, '必须能推导哈希深链的期望落点');
});
