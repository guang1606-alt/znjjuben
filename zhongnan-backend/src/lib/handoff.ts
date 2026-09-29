/**
 * v2.43 迭代接续档案（Handoff）
 * 解决"AI 对话窗口上下文有上限，换窗口/换 AI 后任务如何不中断"：
 *  - 系统事实快照由代码实时、确定性生成（版本/模式数/引擎装置数/策略卡/标签叶/素材源/定价锚点），不允许手改，杜绝凭记忆编造；
 *  - 迭代脉络（上次交付、迭代日志、backlog、未决问题、下一步）由管理员维护，加密落库 ModelConfig 单行 id='handoff'；
 *  - buildHandoffBrief 产出可直接粘贴到新对话窗口的"接续口令"Markdown；importHandoff 支持跨环境导入校验。
 */
import pkg from '../../package.json';
import { BRAND } from '../config/brand';
import { prisma } from './prisma';
import { encrypt, decrypt } from './crypto';
import { craftEngineCount } from '../engine/craft-registry';
import { HOOK_STRATEGIES } from '../engine/hook-strategy';
import { PACE_STRATEGIES, DIALOGUE_STRATEGIES, EMOTION_STRATEGIES, CHARACTER_STRATEGIES } from '../engine/creation-strategy';
import { leafCount } from '../config/tag-taxonomy';
import { NOVEL_SOURCES, validateSources } from '../engine/free-novel-sources';
import { CREATION_MODES, modesForLevel } from '../config/modes';
import { ANCHOR_PACKAGE } from '../config/pricing';
import type { MemberLevel } from '../config/pricing';

export interface SnapshotFact { label: string; value: string }
export interface SystemSnapshot {
  product: string;
  version: string;
  generatedAt: string;
  facts: SnapshotFact[];
}

export interface IterationEntry { version: string; date: string; summary: string }
export interface HandoffData {
  lastDelivery: string;          // 最近一次交付说明（人写，简明）
  iterationLog: IterationEntry[];
  backlog: string[];             // 顺延任务
  openQuestions: string[];       // 待用户拍板
  nextPlan: string;              // 下一轮计划
  notes: string;                 // 其他备注
  updatedAt?: string;
}

export const EMPTY_HANDOFF: HandoffData = {
  lastDelivery: '', iterationLog: [], backlog: [], openQuestions: [], nextPlan: '', notes: '',
};

const HANDOFF_ROW = 'handoff';
const MAX_LOG = 60;
let cache: { data: HandoffData; exp: number } | null = null;
const TTL_MS = 30_000;

/** 确定性系统快照：全部来自在册代码事实，时间戳除外 */
export function buildSystemSnapshot(now: Date = new Date()): SystemSnapshot {
  const DEVICES_PER_ENGINE = 10; // 21 引擎 × 10 装置，由 craft 测试锁死
  const strategyCards = HOOK_STRATEGIES.length + PACE_STRATEGIES.length + DIALOGUE_STRATEGIES.length
    + EMOTION_STRATEGIES.length + CHARACTER_STRATEGIES.length;
  const srcV = validateSources();
  const modeCount = CREATION_MODES.length;
  const liveByLevel = (['FREE', 'BASIC', 'ADVANCED', 'PRO'] as MemberLevel[])
    .map((lv) => `${lv}:${modesForLevel(lv).length}`).join('/');
  const facts: SnapshotFact[] = [
    { label: '创作模式（含灰度）', value: `${modeCount} 个；各等级可用 ${liveByLevel}` },
    { label: '题材引擎/装置', value: `${craftEngineCount()} 引擎 × ${DEVICES_PER_ENGINE} = ${craftEngineCount() * DEVICES_PER_ENGINE} 装置` },
    { label: '策略层卡片', value: `五套共 ${strategyCards} 卡（钩子/节奏/台词/情绪/人物）` },
    { label: '标签叶节点', value: `${leafCount()} 个` },
    { label: '免费合法小说来源', value: `${NOVEL_SOURCES.length} 个 / ${srcV.languages.length} 语种，自检${srcV.ok ? '通过' : '异常'}` },
    { label: '定价锚点', value: `${ANCHOR_PACKAGE.episodes}集=${ANCHOR_PACKAGE.yuan}元=${ANCHOR_PACKAGE.points}积分` },
  ];
  return { product: BRAND.fullName, version: pkg.version, generatedAt: now.toISOString(), facts };
}

function clampText(s: unknown, max: number): string {
  const v = typeof s === 'string' ? s.trim() : '';
  return v.length > max ? v.slice(0, max) : v;
}

/** 校验并规整外部提交的接续数据（防御脏数据/超长文本） */
export function sanitizeHandoff(input: any): { ok: true; data: HandoffData } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const data: HandoffData = { ...EMPTY_HANDOFF };
  data.lastDelivery = clampText(input?.lastDelivery, 4000);
  data.nextPlan = clampText(input?.nextPlan, 4000);
  data.notes = clampText(input?.notes, 8000);
  const strArr = (x: unknown, max: number): string[] => {
    if (!Array.isArray(x)) return [];
    return x.slice(0, MAX_LOG).map((v) => clampText(v, max)).filter(Boolean);
  };
  data.backlog = strArr(input?.backlog, 1000);
  data.openQuestions = strArr(input?.openQuestions, 1000);
  if (Array.isArray(input?.iterationLog)) {
    data.iterationLog = input.iterationLog.slice(0, MAX_LOG).map((e: any) => ({
      version: clampText(e?.version, 20),
      date: clampText(e?.date, 20),
      summary: clampText(e?.summary, 2000),
    })).filter((e: IterationEntry) => e.version || e.summary);
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const k of ['lastDelivery', 'nextPlan', 'notes', 'backlog', 'openQuestions', 'iterationLog']) {
      if (input[k] !== undefined && (input[k] === null || (typeof input[k] !== 'string' && !Array.isArray(input[k])))) {
        errors.push(`${k} 类型非法`);
      }
    }
  } else errors.push('主体必须是对象');
  return errors.length ? { ok: false, errors } : { ok: true, data };
}

export async function loadHandoff(p: any = prisma): Promise<HandoffData> {
  if (cache && cache.exp > Date.now()) return cache.data;
  const row = await p.modelConfig.findUnique({ where: { id: HANDOFF_ROW } });
  let data = { ...EMPTY_HANDOFF };
  if (row?.payloadEnc) {
    try { data = { ...EMPTY_HANDOFF, ...JSON.parse(decrypt(row.payloadEnc)) }; } catch { data = { ...EMPTY_HANDOFF }; }
  }
  cache = { data, exp: Date.now() + TTL_MS };
  return data;
}

export async function saveHandoff(data: HandoffData, updatedBy = 'admin', p: any = prisma): Promise<HandoffData> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  const enc = encrypt(JSON.stringify(payload));
  await p.modelConfig.upsert({
    where: { id: HANDOFF_ROW },
    create: { id: HANDOFF_ROW, payloadEnc: enc, updatedBy },
    update: { payloadEnc: enc, updatedBy },
  });
  cache = { data: payload, exp: Date.now() + TTL_MS };
  return payload;
}

/** 追加一条迭代日志（去重：同 version 覆盖） */
export function appendIteration(data: HandoffData, entry: IterationEntry): HandoffData {
  const log = data.iterationLog.filter((e) => e.version !== entry.version);
  log.unshift(entry);
  return { ...data, iterationLog: log.slice(0, MAX_LOG) };
}

/** 生成"接续口令"：新对话窗口粘贴即可无损接续 */
export function buildHandoffBrief(snapshot: SystemSnapshot, data: HandoffData): string {
  const L: string[] = [];
  L.push(`# 终南集 · 人工通用智能（AGI）编剧大师 · 迭代接续口令（v${snapshot.version}，生成于 ${snapshot.generatedAt}）`);
  L.push('> 新 AI 窗口请先完整读本档案，再按"下一步计划"继续；系统事实为代码实时快照，不得凭记忆改写。');
  L.push('\n## 一、系统事实快照');
  snapshot.facts.forEach((f) => L.push(`- ${f.label}：${f.value}`));
  L.push('\n## 二、最近一次交付');
  L.push(data.lastDelivery || '（未填写）');
  L.push('\n## 三、迭代日志（近条）');
  if (!data.iterationLog.length) L.push('（无）');
  data.iterationLog.slice(0, 20).forEach((e) => L.push(`- **${e.version}** ${e.date ? `（${e.date}）` : ''}：${e.summary}`));
  L.push('\n## 四、顺延 Backlog');
  if (!data.backlog.length) L.push('（无）');
  data.backlog.forEach((b, i) => L.push(`${i + 1}. ${b}`));
  L.push('\n## 五、待拍板问题');
  if (!data.openQuestions.length) L.push('（无）');
  data.openQuestions.forEach((q, i) => L.push(`${i + 1}. ${q}`));
  L.push('\n## 六、下一步计划');
  L.push(data.nextPlan || '（未填写）');
  if (data.notes) { L.push('\n## 七、备注'); L.push(data.notes); }
  L.push('\n## 接续规则');
  L.push('1. 已完成项跳过，未完成项按 Backlog 顺序推进，每轮必须完整彻底、不制造逻辑相悖与 bug；');
  L.push('2. 每轮末报各端完成度%与评分，并重读本档案更新；');
  L.push('3. 创作能力是核心中的核心；用户黑盒感知模型组合；不赔钱铁底不可破；不臆造数据。');
  return L.join('\n');
}

/** 导入外部接续档案（如换机/备份恢复），只接受本结构 JSON */
export function importHandoff(json: unknown): { ok: true; data: HandoffData } | { ok: false; errors: string[] } {
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch { return { ok: false, errors: ['不是合法 JSON'] }; }
  }
  return sanitizeHandoff(json);
}
