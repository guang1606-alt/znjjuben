/**
 * v2.233 端点对齐 —— 生成取消闭环 + 采访会话关闭
 * 背景：端点全量审计（199 后端自有端点 vs 前端调用）发现两处用户可感知真缺口：
 *  ① POST /api/generate/tasks/:id/cancel（v2.190 后端 abort+退款闭环完备）前端零调用——
 *    且 SSE 早期帧不下发 taskId，前端无从调用；前端也无 cancelled 帧处理（会卡 running）。
 *  ② POST /api/interview/sessions/:id/close 前端零调用——采访会话无法主动结束。
 * 本文件静态断言两侧补全不被回退（读源码断言，不起服务器，跑得快）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('v2.233 生成取消闭环', () => {
  const gen = read('src/routes/generate.ts');
  const pv = read('web/progress-view.js');
  const app = read('web/app.js');
  const html = read('web/index.html');
  const i18n = read('web/i18n.js');

  it('后端 frozen 帧下发 taskId（前端调取消端点的前置契约）', () => {
    const i = gen.indexOf("send({ stage: 'frozen'");
    assert.ok(i > 0, 'frozen 帧应存在');
    const frame = gen.slice(i, gen.indexOf('});', i));
    assert.match(frame, /taskId: task\.id/, 'frozen 帧应携带 taskId（加字段，非破坏性契约）');
  });

  it('progress-view 状态机处理 cancelled 帧（不再卡 running）', () => {
    assert.match(pv, /case 'cancelled':/, '应有 cancelled 分支');
    const i = pv.indexOf("case 'cancelled':");
    const seg = pv.slice(i, i + 400);
    assert.match(seg, /next\.phase = 'failed'/, 'cancelled 应落入 failed 相位复用失败渲染');
    assert.match(seg, /next\.cancelled = true/, '应打 cancelled 标记供 UI 区分文案');
  });

  it('app.js handleEvent 捕获 taskId 且处理 cancelled 帧', () => {
    assert.match(app, /if \(data\.taskId && !session\.taskId\) session\.taskId = data\.taskId;/, '应捕获 taskId 到 session');
    assert.match(app, /data\.stage === 'cancelled'/, '应处理 cancelled 帧（会话置失败 + showFail）');
  });

  it('app.js 调用取消端点 POST /api/generate/tasks/:id/cancel', () => {
    assert.match(app, /\/api\/generate\/tasks\/' \+ [^']+\.taskId \+ '\/cancel'/, '应调用取消端点');
  });

  it('index.html progressPanel 内有 genCancelBtn（初始隐藏）', () => {
    const s = html.indexOf('id="progressPanel"');
    const e = html.indexOf('</section>', s);
    const seg = html.slice(s, e);
    assert.match(seg, /id="genCancelBtn"/, '进度面板应有取消按钮');
    assert.match(seg, /class="btn-ghost hidden" id="genCancelBtn"/, '取消按钮初始应隐藏');
  });

  it('renderProgress 依据会话状态显隐/置忙取消按钮', () => {
    const i = app.indexOf('function renderProgress');
    assert.ok(i > 0, 'renderProgress 应存在');
    const seg = app.slice(i, app.indexOf('\n  function ', i + 10) < 0 ? i + 4000 : app.indexOf('\n  function ', i + 10));
    assert.match(seg, /genCancelBtn/, 'renderProgress 应控制取消按钮显隐');
    assert.match(seg, /cancelling/, '应有取消中置忙态');
  });

  it('i18n genCancel/genCancelling/genCancelled/genCancelFail 双语齐备', () => {
    for (const k of ['genCancel:', 'genCancelling:', 'genCancelled:', 'genCancelFail:']) {
      const n = i18n.split(k).length - 1;
      assert.ok(n >= 2, k + ' 应在 zh/en 两块均有定义（当前 ' + n + ' 处）');
    }
  });
});

describe('v2.233 采访会话关闭', () => {
  const app = read('web/app.js');
  const html = read('web/index.html');

  it('index.html 有 ivStopBtn（初始隐藏）', () => {
    assert.match(html, /class="btn-ghost hidden" id="ivStopBtn"/, '应有结束会话按钮且初始隐藏');
  });

  it('app.js 调用 close 端点并联动本地 UI 态', () => {
    assert.match(app, /\/api\/interview\/sessions\/\$\{ivSessionId\}\/close/, '应调用 POST close 端点');
    assert.match(app, /ivStop:/, 'interview T 字典应有 ivStop 文案');
    assert.match(app, /ivStopBtn'\)\.classList\.toggle\('hidden'/, '应按会话状态显隐关闭按钮');
    assert.match(app, /\$\('ivStopBtn'\)\.onclick/, '应绑定关闭按钮事件');
  });
});
