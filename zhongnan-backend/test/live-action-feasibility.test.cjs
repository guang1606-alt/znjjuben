const test = require('node:test');
const assert = require('node:assert');
const F = require('../dist/engine/live-action-feasibility.js');
const SF = require('../dist/engine/script-format.js');
const S = require('../dist/engine/sample-script.js');

const cjk = (s) => (String(s).match(/[一-鿿]/g) || []).length;

function scene(n, loc, time, name) {
  return [
    `场景${n}：${loc}·${time}`,
    `△ 他站在门边看着窗外的车流一动不动，手指在袖口上来回搓着，像是在等一句迟迟不来的话。`,
    `${name}：这件事到此为止，谁也别再提。`,
  ].join('\n');
}

/** 造 N 场、M 个说话角色的 LIVE 稿（角色名轮流取，地点默认每场不同） */
function buildLive({ scenes = 3, cast = 2, sameLocation = false, allNight = false, extra = '' } = {}) {
  const names = ['林晚', '陈凯', '管家', '阿婆', '老周', '小何', '王总', '苏晴', '李队', '阿舅'];
  const out = ['第1集 试点集'];
  for (let i = 1; i <= scenes; i += 1) {
    const loc = sameLocation ? '老宅客厅' : `地点${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][i - 1] || i}`;
    out.push(scene(i, loc, allNight ? '夜' : '日', names[(i - 1) % cast]));
  }
  if (extra) out.push(extra);
  return out.join('\n');
}

test('v2.337 黄金样例不被误伤：3 场 4 角色，pass 保持 true，可拍性数据可读', () => {
  const t = S.buildSampleScript('LIVE');
  const r = SF.validateScript(t, 'LIVE');
  assert.strictEqual(r.pass, true, r.violations.join(';'));
  assert.ok(r.feasibility, 'FormatReport 必须带 feasibility');
  assert.strictEqual(r.feasibility.level === 'over', false);
  assert.strictEqual(r.feasibility.stats.sceneCount, 3);
  assert.strictEqual(r.feasibility.stats.castCount, 4);
});

test('v2.337 场次硬上限：9 场判不可拍并进 violations（不是只给建议）', () => {
  const r = F.checkLiveFeasibility(buildLive({ scenes: 9 }), 'zh');
  assert.strictEqual(r.level, 'over');
  const so = r.issues.find((i) => i.kind === 'scene_overload');
  assert.ok(so && so.severity === 'high', JSON.stringify(r.issues));
  assert.ok(so.message.includes('不可拍') && so.message.includes('9'));
  const f = SF.validateScript(buildLive({ scenes: 9 }), 'LIVE');
  assert.strictEqual(f.pass, false);
  assert.ok(f.violations.some((v) => v.includes('制片不可行') && v.includes('9 场')), f.violations.join(';'));
});

test('v2.337 场次偏多只提示不拦截：6 场 level=watch、无制片 violation、分数折损', () => {
  const text = buildLive({ scenes: 6, sameLocation: true });
  const r = F.checkLiveFeasibility(text, 'zh');
  assert.strictEqual(r.level, 'watch');
  assert.strictEqual(r.issues.filter((i) => i.severity === 'high').length, 0);
  assert.ok(r.score < 100 && r.score > 0, `score=${r.score}`);
  const f = SF.validateScript(text, 'LIVE');
  assert.strictEqual(f.violations.some((v) => v.includes('制片不可行')), false, f.violations.join(';'));
});

test('v2.337 角色硬上限：9 个说话角色判不可拍（演员/妆造按人头计费）', () => {
  const names = ['林晚', '陈凯', '管家', '阿婆', '老周', '小何', '王总', '苏晴', '李队'];
  const blocks = [
    ['场景1：老宅客厅·日', ...names.slice(0, 3).map((n) => `${n}：今天谁也别想走。`)],
    ['场景2：巷口·日', ...names.slice(3, 6).map((n) => `${n}：话已经说到这个份上。`)],
    ['场景3：车里·夜', ...names.slice(6, 9).map((n) => `${n}：那就按规矩办。`)],
  ].map((b) => b.join('\n'));
  const text = `第1集 试点集\n${blocks.join('\n')}`;
  const r = F.checkLiveFeasibility(text, 'zh');
  assert.strictEqual(r.stats.castCount, 9);
  const co = r.issues.find((i) => i.kind === 'cast_overload');
  assert.ok(co && co.severity === 'high');
  const f = SF.validateScript(text, 'LIVE');
  assert.ok(f.violations.some((v) => v.includes('说话角色')), f.violations.join(';'));
});

test('v2.337 制片风险元素分桶：特效/群演为 mid、高危动作为 low，均不阻断', () => {
  const text = buildLive({ scenes: 3, extra: '△ 远处忽然一声爆炸，火光冲起来，人群立刻围了过来。' });
  const r = F.checkLiveFeasibility(text, 'zh');
  const kinds = r.issues.map((i) => i.kind);
  assert.ok(kinds.includes('vfx_risk'), kinds.join(','));
  const vfx = r.issues.find((i) => i.kind === 'vfx_risk');
  assert.strictEqual(vfx.severity, 'mid');
  assert.ok(vfx.evidence.includes('爆炸'));
  assert.strictEqual(r.level, 'watch');
  assert.strictEqual(SF.validateScript(text, 'LIVE').violations.some((v) => v.includes('制片不可行')), false);
});

test('v2.337 场景零复用与夜戏占比：5 场 5 地点判零复用；3 场全夜给夜拍提醒', () => {
  const spread = F.checkLiveFeasibility(buildLive({ scenes: 5 }), 'zh');
  const ls = spread.issues.find((i) => i.kind === 'location_spread');
  assert.ok(ls && ls.severity === 'mid', spread.issues.map((i) => i.kind).join(','));
  const reused = F.checkLiveFeasibility(buildLive({ scenes: 5, sameLocation: true }), 'zh');
  assert.strictEqual(reused.issues.some((i) => i.kind === 'location_spread'), false);

  const night = F.checkLiveFeasibility(buildLive({ scenes: 3, allNight: true }), 'zh');
  const nh = night.issues.find((i) => i.kind === 'night_heavy');
  assert.ok(nh && nh.severity === 'low');
  assert.deepStrictEqual(nh.evidence, ['3/3']);
});

test('v2.337 英文链路零中文：9 场英文稿判 over，文案全英文', () => {
  const lines = ['EP1 Test'];
  for (let i = 1; i <= 9; i += 1) {
    lines.push(`INT. ROOM ${i} - DAY`, '△ He waits by the door and says nothing.', 'Anna: That is enough.');
  }
  const text = lines.join('\n');
  const r = F.checkLiveFeasibility(text, 'en');
  assert.strictEqual(r.level, 'over');
  const so = r.issues.find((i) => i.kind === 'scene_overload');
  assert.ok(so && /scenes/.test(so.message), so && so.message);
  assert.strictEqual(cjk(r.issues.map((i) => i.message).join('')), 0);
  const f = SF.validateScript(text, 'LIVE');
  assert.ok(f.violations.some((v) => v.startsWith('Production: ')), f.violations.join(';'));
  assert.ok(f.feasibility.issues.every((i) => cjk(i.message) === 0));
});

test('v2.337 生成前指令同步下发制片铁律：中文含场次/角色/风险口径，英文零中文', () => {
  const zh = SF.scriptFormatDirective('LIVE', 'zh');
  assert.ok(zh.includes('制片铁律'));
  assert.ok(zh.includes('硬上限8场'));
  assert.ok(zh.includes('说话角色不超过6人') || zh.includes('有台词角色不超过6人'));
  const en = SF.scriptFormatDirective('LIVE', 'en');
  assert.strictEqual(cjk(en), 0);
  assert.ok(/hard cap 8/.test(en) && /INT\.\/EXT\./.test(en));
});

test('v2.337 确定性 + 空稿短路：同输入同输出，空文本不报可拍性问题', () => {
  const text = buildLive({ scenes: 6 });
  assert.deepStrictEqual(F.checkLiveFeasibility(text, 'zh'), F.checkLiveFeasibility(text, 'zh'));
  const empty = F.checkLiveFeasibility('', 'zh');
  assert.strictEqual(empty.level, 'ok');
  assert.strictEqual(empty.score, 100);
  assert.deepStrictEqual(empty.issues, []);
});
