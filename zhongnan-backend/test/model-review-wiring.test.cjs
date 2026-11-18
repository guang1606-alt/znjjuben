/**
 * API 选型定期提醒 · 接线守卫（v2.505）
 *
 * 模型会持续进化：新模型发布、老型号停服、调价都会让现有组合不再最优。
 * 因此"定期提醒"必须是常驻机制，不能只靠人记得。本测试锁死三处接线：
 *  ①云端 daily 定时任务（POST /  <secret>:daily）必须连带跑每日选型体检；
 *  ②进程启动即补一次体检（同日幂等），常驻实例/云函数都能看到最新灯号；
 *  ③后台「模型与能力」必须把体检状态渲染出来，并提供「立即体检 / 今日已核对」两个动作。
 *
 * 任何一处删掉，用户就又回到"没人提醒"的状态——本测试即刻转红。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('API 选型定期提醒接线守卫', { concurrency: 1 }, () => {
  it('①云端 daily 定时任务连带跑每日选型体检（否则 serverless 下线调度器后永不提醒）', () => {
    const src = read('src/server/app.ts');
    const dailyBlock = src.slice(src.indexOf("if (task === 'daily')"), src.indexOf("if (task === 'weekly')"));
    assert.ok(dailyBlock.length > 0, '未找到 daily 任务分支');
    assert.ok(/await\s+runDailyModelReview\(/.test(dailyBlock), 'daily 分支必须真正调用 runDailyModelReview（不只是解构引入）');
  });

  it('②进程启动即补一次体检（同日幂等，不重复落库）', () => {
    const src = read('src/index.ts');
    assert.ok(/runDailyModelReview/.test(src), '启动流程必须补跑一次选型体检');
    assert.ok(/import[^;]*runDailyModelReview[^;]*auto-learning/.test(src), '必须显式引入 runDailyModelReview');
  });

  it('③后台有体检面板与两个动作（立即体检 / 今日已核对）', () => {
    const html = read('web/index.html');
    for (const id of ['admRevStatus', 'admReview', 'admRevRun', 'admRevAck']) {
      assert.ok(html.includes(`id="${id}"`), `index.html 缺少 #${id}`);
    }
    const js = read('web/app.js');
    assert.ok(js.includes("admApi('/model/portfolio/review')"), 'app.js 必须拉取 /model/portfolio/review');
    assert.ok(js.includes("'/model/portfolio/review/run'"), 'app.js 必须接「立即体检」');
    assert.ok(js.includes("'/model/portfolio/review/ack'"), 'app.js 必须接「今日已核对」');
    assert.ok(/\$\(['"]admRevRun['"]\)\.onclick/.test(js), '「立即体检」按钮必须绑定点击');
    assert.ok(/\$\(['"]admRevAck['"]\)\.onclick/.test(js), '「今日已核对」按钮必须绑定点击');
  });

  it('④进后台即提醒（不在模型 Tab 也能收到一次红灯提示）', () => {
    const js = read('web/app.js');
    assert.ok(/remindModelReview\s*\(/.test(js), '必须存在 remindModelReview');
    assert.ok(/if \(me\.isSuperAdmin\) remindModelReview\(\)/.test(js), '超管进后台时必须触发提醒');
  });
});
