/**
 * v2.633 采访引擎的 AI 降级必须可归因。
 *
 * 先证伪：
 *   `src/engine/interview.ts` 的 `interviewTurn` 两处 AI 调用（素材提炼 / 下一问）失败时
 *   只有 `catch { /* 兜底已归档 rawNotes *\/ }`、`catch { /* 规则问兜底 *\/ }`，零日志。
 *   确定性兜底本身是对的（素材永不丢、采访不中断），但服务端没有任何线索区分
 *   「模型超时 / 额度耗尽 / 供应商 5xx」与「模型正常返回但 JSON 不可用」——前者一次故障
 *   会静默影响所有付费采访轮次，运维既不可观测也无法定位；用户侧只看到 aiExtract/aiQuestion
 *   为 false，却拿不到原因。吞错保流程是对的，静默不是。
 * 修复：两处 catch 分别改为 `logInternal(e,'interview.extract')`、`logInternal(e,'interview.question')`，
 *   仍走确定性兜底、返回形状与计费口径不变。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const ENG = require('../dist/engine/interview.js');
const MP = require('../dist/lib/model-proxy.js');

// 沙盘隔离：无供应商端点时 callText 返回 sandbox 空串（不抛错），作为正常路径基准
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

async function captureErrors(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => (x instanceof Error ? x.stack || String(x) : String(x))).join(' ')); };
  try { return { value: await fn(), calls }; } finally { console.error = orig; }
}

const USER_TEXT = '被辞退的女厨师想夺回餐厅。但前合伙人在处处打压她，她手里只剩一张老菜谱。';

describe('v2.633 采访 AI 降级留痕', () => {
  it('1) 素材提炼调用抛错 → 留痕 interview.extract，rawNotes 兜底不丢素材', async () => {
    const orig = MP.callText;
    MP.callText = async () => { throw new Error('供应商 502'); };
    let out; let calls;
    try {
      ({ value: out, calls } = await captureErrors(() => ENG.interviewTurn('STANDARD', USER_TEXT, ENG.emptyMaterials(), '', [], 'zh')));
    } finally { MP.callText = orig; }
    const hit = calls.find((c) => c.includes('[interview.extract]'));
    assert.ok(hit, '提炼失败必须留痕 interview.extract；实际：' + (calls.join(' | ') || '(零日志)'));
    assert.ok(hit.includes('供应商 502'), '必须带错误信息；实际：' + hit);
    assert.strictEqual(out.aiExtract, false, '降级如实上报');
    assert.ok(out.materials.rawNotes.length > 0, '素材必须按句归档，不得丢失');
    assert.ok(out.question.length > 0, '规则问兜底必须给出下一问');
  });

  it('2) 下一问调用抛错 → 留痕 interview.question，规则问兜底', async () => {
    const orig = MP.callText;
    let n = 0;
    MP.callText = async () => {
      n += 1;
      if (n === 1) return { text: '', tokensIn: 0, tokensOut: 0, costFen: 0 }; // 提炼返回空 → 正文兜底
      throw new Error('MODEL_TIMEOUT');
    };
    let out; let calls;
    try {
      ({ value: out, calls } = await captureErrors(() => ENG.interviewTurn('STANDARD', USER_TEXT, ENG.emptyMaterials(), '', [], 'zh')));
    } finally { MP.callText = orig; }
    const hit = calls.find((c) => c.includes('[interview.question]'));
    assert.ok(hit, '下一问失败必须留痕 interview.question；实际：' + (calls.join(' | ') || '(零日志)'));
    assert.ok(hit.includes('MODEL_TIMEOUT'), '必须带错误信息；实际：' + hit);
    assert.strictEqual(out.aiQuestion, false, '降级如实上报');
    assert.ok(out.question.length >= 6, '规则问兜底必须给出可读问题');
  });

  it('3) 正常路径（sandbox 空返回）零日志，不误伤', async () => {
    const { value: out, calls } = await captureErrors(() => ENG.interviewTurn('STANDARD', USER_TEXT, ENG.emptyMaterials(), '', [], 'zh'));
    assert.strictEqual(calls.length, 0, '正常路径不应记日志；实际：' + calls.join(' | '));
    assert.ok(out.materials.rawNotes.length > 0);
  });
});
